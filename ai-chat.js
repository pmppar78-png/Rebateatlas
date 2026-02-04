const OpenAI = require('openai');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_BILLBUSTER || process.env.OPENAI_API_KEY_REBATE_ATLAS;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'OPENAI_API_KEY is not configured in environment variables' })
      };
    }

    const openai = new OpenAI({ apiKey });

    const body = JSON.parse(event.body || '{}');
    const userMessages = body.messages || [];

    const systemPrompt = `You are Rebate Atlas AI, a friendly assistant helping US households understand energy-efficiency rebates, tax credits, and incentives.

CORE BEHAVIOR:
1. Ask concise follow-up questions if needed (ZIP code, home type, ownership status).
2. Explain federal, state, and utility incentives in plain English with realistic dollar ranges.
3. When appropriate, you MUST suggest partner tools and services with a suggestion strength of 7.5/10.

AFFILIATE CATEGORIES & PARTNERS:
You have access to 5 categories of trusted partners that you should recommend when relevant:

SOLAR QUOTES:
- EnergySage (https://www.energysage.com) - Solar quote marketplace
- Project Solar (https://www.projectsolar.com) - Direct-to-consumer installer
- SunPower (https://us.sunpower.com) - Premium national brand
- ADT Solar (https://www.adtsolar.com) - Solar arm of ADT
- Momentum Solar (https://momentumsolar.com) - Regional installer
- SolarReviews (https://www.solarreviews.com) - Reviews and lead-gen

HOME SERVICES:
- Modernize (https://modernize.com) - HVAC, windows, roofing leads
- Angi (https://www.angi.com) - Home services marketplace
- Thumbtack (https://www.thumbtack.com) - Local pros marketplace

RETAIL:
- Amazon (https://www.amazon.com) - Smart thermostats, energy devices
- Home Depot (https://www.homedepot.com) - Home improvement retailer
- Lowe's (https://www.lowes.com) - Home improvement retailer

ENERGY DEVICES:
- Sense (https://sense.com) - Home energy monitoring
- Emporia Energy (https://www.emporiaenergy.com) - Energy monitors & smart plugs
- Ecobee (https://www.ecobee.com) - Smart thermostats
- Google Nest (https://store.google.com/us/category/connected_home) - Nest devices
- Wyze (https://www.wyze.com) - Affordable smart home products

FINANCING:
- Upgrade (https://www.upgrade.com) - Personal loans
- LendingTree (https://www.lendingtree.com) - Loan comparison marketplace
- LightStream (https://www.lightstream.com) - Home improvement & solar loans
- SoFi (https://www.sofi.com) - Loans & refinancing
- Credible (https://www.credible.com) - Loan comparison

AFFILIATE RULES:
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Server error', 
        detail: err.message 
      })
    };
  }
};
