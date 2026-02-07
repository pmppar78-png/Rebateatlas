import OpenAI from 'openai';

// Build the affiliate prompt section from structured affiliates.json data
function buildAffiliatePrompt(affiliatesData) {
  let prompt = `AFFILIATE CATEGORIES & PARTNERS:
You have access to the following categories of trusted partners that you should recommend when relevant:\n\n`;

  const categoryOrder = ['solar_quotes', 'home_services', 'energy_devices', 'retail', 'financing'];

  for (const key of categoryOrder) {
    const category = affiliatesData[key];
    if (!category) continue;
    prompt += `${category.label.toUpperCase()}:\n`;
    for (const partner of category.partners) {
      prompt += `- ${partner.name} (${partner.url}) - ${partner.description}\n`;
    }
    prompt += '\n';
  }

  return prompt;
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const apiKey = Netlify.env.get('OPENAI_API_KEY') ||
                   Netlify.env.get('OPENAI_API_KEY_BILLBUSTER') ||
                   Netlify.env.get('OPENAI_API_KEY_REBATE_ATLAS');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured in environment variables' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const openai = new OpenAI({ apiKey });

    const body = await req.json();
    const userMessages = body.messages || [];

    // Fetch affiliate data from the site's own static JSON
    let affiliateSection = '';
    try {
      const siteUrl = Netlify.env.get('URL') || Netlify.env.get('DEPLOY_PRIME_URL') || '';
      const affiliateRes = await fetch(`${siteUrl}/affiliates.json`);
      if (affiliateRes.ok) {
        const affiliatesData = await affiliateRes.json();
        affiliateSection = buildAffiliatePrompt(affiliatesData);
      }
    } catch (e) {
      // If fetch fails, use a minimal fallback so the AI still works
      console.warn('Could not fetch affiliates.json:', e.message);
    }

    const systemPrompt = `You are Rebate Atlas AI, a friendly assistant helping US households understand energy-efficiency rebates, tax credits, and incentives.

CORE BEHAVIOR:
1. Ask concise follow-up questions if needed (ZIP code, home type, ownership status).
2. Explain federal, state, and utility incentives in plain English with realistic dollar ranges.
3. When appropriate, you MUST suggest partner tools and services with a suggestion strength of 7.5/10.

${affiliateSection}AFFILIATE RULES:
- Suggest partners at strength level 7.5/10 (strong recommendation)
- Include 1-3 relevant partner links per response when appropriate
- ALWAYS format partner links as: <a href="REAL_URL" style="color:#4fd1c5;" target="_blank" rel="sponsored noopener">Partner Name</a>
- Use the exact URLs from the lists above
- Always use target="_blank" and rel="sponsored noopener"
- Make links short, descriptive, and mobile-friendly
- Use the color #4fd1c5 for all affiliate links
- Clearly label them as sponsored/affiliate partners

OUTPUT FORMAT:
- Use clear formatting with paragraph breaks
- Include hyperlinks inline within natural sentences
- Never dump long lists of links
- Always remind users this is educational guidance, not professional advice

IMPORTANT: You must not give tax, legal, or financial advice. Always remind users to verify details with official sources or licensed professionals.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...userMessages
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.5,
      max_tokens: 800
    });

    const reply = completion.choices?.[0]?.message?.content || 'Sorry — I could not generate a response at this time.';

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({
      error: 'Server error',
      detail: err.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
