import OpenAI from 'openai';

// --- CORS ---
const ALLOWED_ORIGINS = [
  'https://rebateatlas.netlify.app',
  'https://rebateatlas.org',
  'https://www.rebateatlas.org'
];

function getAllowedOrigin(req) {
  const origin = req.headers.get('origin') || '';
  // Allow exact matches
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Allow Netlify deploy preview domains (*.netlify.app)
  if (/^https:\/\/[a-z0-9-]+--rebateatlas\.netlify\.app$/.test(origin)) return origin;
  // Default: deny by returning the primary domain (browser will block cross-origin)
  return ALLOWED_ORIGINS[0];
}

function corsHeaders(req) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

// --- Rate Limiting (IP-based, in-memory per function instance) ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 15; // max requests per IP per window

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

// Periodic cleanup to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS * 2);

// --- Prompt Injection Protection ---
// Safely serialize data for inclusion in prompts using JSON + delimiters
function safeSerializeForPrompt(data, label) {
  const serialized = JSON.stringify(data);
  return `\n--- BEGIN ${label} DATA ---\n${serialized}\n--- END ${label} DATA ---\n`;
}

// Build the affiliate prompt section from structured affiliates.json data
function buildAffiliatePrompt(affiliatesData) {
  let prompt = `AFFILIATE CATEGORIES & PARTNERS:
You have access to the following categories of trusted partners that you should recommend when relevant:\n\n`;

  const categoryOrder = ['solar_quotes', 'home_services', 'energy_devices', 'retail', 'financing'];

  for (const key of categoryOrder) {
    const category = affiliatesData[key];
    if (!category) continue;
    const safeLabel = String(category.label || key).toUpperCase();
    prompt += `${safeLabel}:\n`;
    for (const partner of category.partners) {
      const name = String(partner.name || '');
      const url = String(partner.url || '');
      const desc = String(partner.description || '');
      prompt += `- ${name} (${url}) - ${desc}\n`;
    }
    prompt += '\n';
  }

  return prompt;
}

// Build a rebate data section from ZIP code JSON data
function buildRebatePrompt(zipData) {
  const zip = String(zipData.zip || '');
  const city = String(zipData.city || '');
  const state = String(zipData.state || '');
  let prompt = `\nLOCAL REBATE DATA FOR ZIP ${zip} (${city}, ${state}):\n`;

  if (zipData.deltas && Array.isArray(zipData.deltas) && zipData.deltas.length > 0) {
    prompt += `\nRecent changes:\n`;
    for (const delta of zipData.deltas) {
      prompt += `- ${String(delta)}\n`;
    }
  }

  if (zipData.items && Array.isArray(zipData.items) && zipData.items.length > 0) {
    prompt += `\nAvailable rebates and incentives:\n`;
    for (const item of zipData.items) {
      prompt += `- ${String(item.title || '')}: ${String(item.amount_pretty || '')}`;
      if (item.cap_pretty) prompt += ` (${String(item.cap_pretty)})`;
      prompt += `\n  ${String(item.summary || '')}`;
      if (item.deadline) prompt += ` | Deadline: ${String(item.deadline)}`;
      if (item.program) prompt += ` | Program: ${String(item.program)}`;
      if (item.category) prompt += ` | Category: ${String(item.category)}`;
      prompt += '\n';
    }
  }

  return prompt;
}

// --- Conversation Summarization (rolling window with compression) ---
function compressConversation(messages) {
  const MAX_RECENT = 6; // Keep last 6 messages verbatim
  if (messages.length <= MAX_RECENT) return messages;

  // Summarize older messages into a single context message
  const olderMessages = messages.slice(0, messages.length - MAX_RECENT);
  const recentMessages = messages.slice(messages.length - MAX_RECENT);

  const summaryParts = olderMessages.map(m => {
    const role = m.role === 'user' ? 'User' : 'AI';
    // Truncate each old message to 200 chars for the summary
    const content = m.content.length > 200 ? m.content.slice(0, 200) + '...' : m.content;
    return `${role}: ${content}`;
  });

  const summaryMessage = {
    role: 'user',
    content: `[Previous conversation summary: ${summaryParts.join(' | ')}]`
  };

  return [summaryMessage, ...recentMessages];
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: corsHeaders(req)
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    });
  }

  // Rate limiting
  const clientIp = context.ip || req.headers.get('x-forwarded-for') || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment before trying again.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        ...corsHeaders(req)
      }
    });
  }

  try {
    const apiKey = Netlify.env.get('OPENAI_API_KEY');

    if (!apiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(JSON.stringify({ error: 'AI service is not configured. Please contact support.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      });
    }

    const openai = new OpenAI({ apiKey });

    const body = await req.json();
    const userMessages = body.messages || [];
    const zip = body.zip || '';

    // Input validation: limit conversation length and message size
    const MAX_MESSAGES = 20;
    const MAX_MESSAGE_LENGTH = 2000;

    if (!Array.isArray(userMessages) || userMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      });
    }

    if (userMessages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: 'Conversation too long. Please start a new chat.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
      });
    }

    // Sanitize messages: ensure valid roles and trim content
    const sanitizedMessages = userMessages
      .filter(m => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
      .map(m => ({
        role: m.role,
        content: m.content.slice(0, MAX_MESSAGE_LENGTH)
      }));

    // Compress conversation to reduce token usage
    const compressedMessages = compressConversation(sanitizedMessages);

    // Fetch affiliate data from the site's own static JSON
    const siteUrl = Netlify.env.get('URL') || Netlify.env.get('DEPLOY_PRIME_URL') || '';
    let affiliateSection = '';
    try {
      const affiliateRes = await fetch(`${siteUrl}/affiliates.json`);
      if (affiliateRes.ok) {
        const affiliatesData = await affiliateRes.json();
        affiliateSection = buildAffiliatePrompt(affiliatesData);
      }
    } catch (e) {
      console.warn('Could not fetch affiliates.json:', e.message);
    }

    // Fetch ZIP-specific rebate data if a ZIP code was provided
    let rebateSection = '';
    let zipDataFound = false;
    if (/^\d{5}$/.test(zip)) {
      try {
        const zipRes = await fetch(`${siteUrl}/${zip}.json`);
        if (zipRes.ok) {
          const zipData = await zipRes.json();
          rebateSection = buildRebatePrompt(zipData);
          zipDataFound = true;
        }
      } catch (e) {
        console.warn('Could not fetch ZIP data:', e.message);
      }
    }

    // Build ZIP context instruction
    let zipInstruction = '';
    if (zip && /^\d{5}$/.test(zip)) {
      if (zipDataFound) {
        zipInstruction = `\n${rebateSection}\nIMPORTANT: Use the local rebate data above to give specific, accurate answers about this user's area. Reference actual program names, amounts, and deadlines from the data. If the user asks about a category not in the data, say you don't have specific local data for that but provide general federal guidance.\n`;
      } else {
        zipInstruction = `\nNOTE: The user provided ZIP code ${zip}, but we do not have specific local rebate data for this area. Clearly tell the user: "I don't have detailed local rebate data for ZIP ${zip} yet." Then provide general federal guidance and suggest they check their state energy office and local utility website for state and utility-specific programs. Do NOT invent or hallucinate local program details.\n`;
      }
    }

    const systemPrompt = `You are Rebate Atlas AI, a friendly assistant helping US households understand energy-efficiency rebates, tax credits, and incentives.

CORE BEHAVIOR:
1. Ask concise follow-up questions if needed (ZIP code, home type, ownership status).
2. Explain federal, state, and utility incentives in plain English with realistic dollar ranges.
3. When appropriate, you MUST suggest partner tools and services with a suggestion strength of 7.5/10.
${zipInstruction}
${affiliateSection}AFFILIATE RULES:
- Suggest partners at strength level 7.5/10 (strong recommendation)
- Include 1-3 relevant partner links per response when appropriate
- ALWAYS format partner links as: <a href="REAL_URL" class="affiliate-link" target="_blank" rel="sponsored noopener noreferrer">Partner Name</a>
- Use the exact URLs from the lists above
- Always use target="_blank" and rel="sponsored noopener noreferrer"
- Make links short, descriptive, and mobile-friendly
- Clearly label them as sponsored/affiliate partners

OUTPUT FORMAT:
- Use clear formatting with paragraph breaks
- Include hyperlinks inline within natural sentences
- Never dump long lists of links
- Always remind users this is educational guidance, not professional advice

IMPORTANT: You must not give tax, legal, or financial advice. Always remind users to verify details with official sources or licensed professionals.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...compressedMessages
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.5,
      max_tokens: 1200
    });

    const reply = completion.choices?.[0]?.message?.content || 'Sorry — I could not generate a response at this time.';

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    });
  } catch (err) {
    console.error('Function error:', err);
    // Do NOT leak error details to client
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred. Please try again.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    });
  }
};
