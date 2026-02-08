import OpenAI from 'openai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ZIP_LOOKUP = require('../../data/zip-lookup.json');

// --- CORS ---
const ALLOWED_ORIGINS = [
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

  const categoryOrder = ['solar_quotes', 'home_services', 'energy_devices', 'retail', 'financing', 'ev_chargers', 'battery_backup'];

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

// Look up ZIP code city and state from consolidated database (946 prefix entries covering all US ZIPs)
function lookupZip(zip) {
  if (!zip || zip.length < 3) return null;
  const entry = ZIP_LOOKUP[zip.substring(0, 3)];
  if (!entry) return null;
  return { city: entry[0], state: entry[1] };
}

function getStateFromZip(zip) {
  const result = lookupZip(zip);
  return result ? result.state : null;
}

// Build a state-level data prompt for AI fallback when ZIP data is unavailable
function buildStatePrompt(stateData) {
  const stateName = String(stateData.state_name || '');
  const stateCode = String(stateData.state_code || '');
  let prompt = `\nSTATE-LEVEL REBATE DATA FOR ${stateName.toUpperCase()} (${stateCode}):\n`;

  // HOMES/HEAR status
  const status = String(stateData.homes_hear_status || 'unknown');
  prompt += `\nHOMES/HEAR Program Status: ${status}\n`;
  if (stateData.homes_hear_details) {
    prompt += `Details: ${String(stateData.homes_hear_details)}\n`;
  }

  // State energy office
  if (stateData.state_energy_office) {
    prompt += `\nState Energy Office: ${String(stateData.state_energy_office)}`;
    if (stateData.state_energy_office_url) prompt += ` (${String(stateData.state_energy_office_url)})`;
    prompt += '\n';
  }

  // Income thresholds
  if (stateData.income_thresholds) {
    prompt += `\nIncome Thresholds:\n`;
    if (stateData.income_thresholds.low_income_80_ami) {
      prompt += `- Low Income (80% AMI): ${String(stateData.income_thresholds.low_income_80_ami)}\n`;
    }
    if (stateData.income_thresholds.moderate_income_150_ami) {
      prompt += `- Moderate Income (150% AMI): ${String(stateData.income_thresholds.moderate_income_150_ami)}\n`;
    }
  }

  // Net metering
  if (stateData.net_metering) {
    prompt += `\nNet Metering: ${String(stateData.net_metering)}\n`;
  }

  // State tax credits
  if (stateData.state_tax_credits && Array.isArray(stateData.state_tax_credits) && stateData.state_tax_credits.length > 0) {
    prompt += `\nState Tax Credits:\n`;
    for (const credit of stateData.state_tax_credits) {
      prompt += `- ${String(credit.name || '')}: ${String(credit.amount || '')}`;
      if (credit.eligible_items) prompt += ` | Items: ${String(credit.eligible_items)}`;
      if (credit.details) prompt += ` | ${String(credit.details)}`;
      prompt += '\n';
    }
  }

  // State rebate programs
  if (stateData.state_rebate_programs && Array.isArray(stateData.state_rebate_programs) && stateData.state_rebate_programs.length > 0) {
    prompt += `\nState Rebate Programs:\n`;
    for (const prog of stateData.state_rebate_programs) {
      prompt += `- ${String(prog.name || '')}: ${String(prog.amount || '')}`;
      if (prog.administrator) prompt += ` | Admin: ${String(prog.administrator)}`;
      if (prog.eligible_items) prompt += ` | Items: ${String(prog.eligible_items)}`;
      prompt += '\n';
    }
  }

  // Top utilities
  if (stateData.top_utilities && Array.isArray(stateData.top_utilities) && stateData.top_utilities.length > 0) {
    prompt += `\nTop Utility Programs:\n`;
    for (const util of stateData.top_utilities) {
      prompt += `${String(util.name || '')}:\n`;
      if (util.programs && Array.isArray(util.programs)) {
        for (const prog of util.programs) {
          prompt += `  - ${String(prog.name || '')}: ${String(prog.amount || '')}`;
          if (prog.eligible_items) prompt += ` | Items: ${String(prog.eligible_items)}`;
          prompt += '\n';
        }
      }
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
    const stateParam = body.state || '';

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

    // Resolve ZIP code location from consolidated lookup database (covers all US ZIPs)
    let stateDataSection = '';
    let stateDataFound = false;
    let resolvedStateCode = '';
    let resolvedCity = '';
    let zipRecognized = false;

    if (/^\d{5}$/.test(zip)) {
      const zipInfo = lookupZip(zip);
      if (zipInfo) {
        resolvedCity = zipInfo.city;
        resolvedStateCode = zipInfo.state;
        zipRecognized = true;
      }
    }

    // Fall back to client-provided state parameter if ZIP lookup didn't resolve
    if (!resolvedStateCode && /^[A-Z]{2}$/i.test(stateParam)) {
      resolvedStateCode = stateParam.toUpperCase();
    }

    // Fetch state-level data (the ground truth for rebate programs)
    if (resolvedStateCode) {
      try {
        const stateRes = await fetch(`${siteUrl}/data/states/${resolvedStateCode.toLowerCase()}.json`);
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          stateDataSection = buildStatePrompt(stateData);
          stateDataFound = true;
        }
      } catch (e) {
        console.warn('Could not fetch state data:', e.message);
      }
    }

    // Build ZIP context instruction
    let zipInstruction = '';
    if (zip && /^\d{5}$/.test(zip)) {
      if (zipRecognized && stateDataFound) {
        zipInstruction = `\nUSER LOCATION: ZIP ${zip} — ${resolvedCity}, ${resolvedStateCode}\n${stateDataSection}\nIMPORTANT: The user is located in ${resolvedCity}, ${resolvedStateCode} (ZIP ${zip}). Use the state-level rebate data above to provide specific, accurate guidance. Reference actual program names, amounts, and utility programs from the data. Personalize your response by mentioning their city (${resolvedCity}) when relevant. Also suggest they contact their local utility for additional city-specific programs.\n`;
      } else if (stateDataFound) {
        zipInstruction = `\n${stateDataSection}\nIMPORTANT: The user provided ZIP ${zip}. The state-level data above contains real programs, incentives, and utility rebates for their state. Use this data to provide state-specific guidance. Reference actual program names, amounts, and utility programs from the data. Also suggest they contact their local utility for additional local programs.\n`;
      } else {
        zipInstruction = `\nNOTE: The user provided ZIP code ${zip}, but we do not have specific local or state rebate data for this area. Provide general federal guidance (25C, 25D, HOMES, HEAR programs) and suggest they check their state energy office and local utility website for state and utility-specific programs. Do NOT invent or hallucinate local program details.\nEXAMPLES:\n- WRONG: "Your area offers a $5,000 Solar Incentive Fund" (invented program)\n- CORRECT: "I don't have specific local rebate data for your ZIP code, but here are the federal programs you may qualify for."\n- WRONG: "The XYZ Utility Company offers a $2,000 heat pump rebate" (invented utility program)\n- CORRECT: "I recommend checking with your local utility company for any available rebates."\n`;
      }
    } else if (stateDataFound) {
      zipInstruction = `\n${stateDataSection}\nIMPORTANT: The user is asking about their state. Use the state-level data above to provide specific guidance about their state's programs, incentives, and utility rebates. Reference actual program names and amounts from the data.\n`;
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
