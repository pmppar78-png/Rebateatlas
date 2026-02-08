/**
 * regenerate-state-pages.js
 *
 * Regenerates all 51 state pages (50 states + DC) with:
 * - 300+ words of unique, state-specific content drawn from data/states/*.json
 * - Unique meta descriptions per state
 * - FAQ schema (FAQPage JSON-LD) with state-specific questions
 * - Internal links to neighboring/related states
 * - Affiliate disclosure banner
 * - lang="en-US" geographic targeting
 * - State-specific rebate programs, utilities, and tax credits rendered inline
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'states');
const STATES_DIR = path.join(__dirname, '..', 'states');
const SITE_URL = 'https://rebateatlas.org';

// State code to slug and full name mapping
const STATE_MAP = {
  AL: { slug: 'alabama', name: 'Alabama' },
  AK: { slug: 'alaska', name: 'Alaska' },
  AZ: { slug: 'arizona', name: 'Arizona' },
  AR: { slug: 'arkansas', name: 'Arkansas' },
  CA: { slug: 'california', name: 'California' },
  CO: { slug: 'colorado', name: 'Colorado' },
  CT: { slug: 'connecticut', name: 'Connecticut' },
  DE: { slug: 'delaware', name: 'Delaware' },
  FL: { slug: 'florida', name: 'Florida' },
  GA: { slug: 'georgia', name: 'Georgia' },
  HI: { slug: 'hawaii', name: 'Hawaii' },
  ID: { slug: 'idaho', name: 'Idaho' },
  IL: { slug: 'illinois', name: 'Illinois' },
  IN: { slug: 'indiana', name: 'Indiana' },
  IA: { slug: 'iowa', name: 'Iowa' },
  KS: { slug: 'kansas', name: 'Kansas' },
  KY: { slug: 'kentucky', name: 'Kentucky' },
  LA: { slug: 'louisiana', name: 'Louisiana' },
  ME: { slug: 'maine', name: 'Maine' },
  MD: { slug: 'maryland', name: 'Maryland' },
  MA: { slug: 'massachusetts', name: 'Massachusetts' },
  MI: { slug: 'michigan', name: 'Michigan' },
  MN: { slug: 'minnesota', name: 'Minnesota' },
  MS: { slug: 'mississippi', name: 'Mississippi' },
  MO: { slug: 'missouri', name: 'Missouri' },
  MT: { slug: 'montana', name: 'Montana' },
  NE: { slug: 'nebraska', name: 'Nebraska' },
  NV: { slug: 'nevada', name: 'Nevada' },
  NH: { slug: 'new-hampshire', name: 'New Hampshire' },
  NJ: { slug: 'new-jersey', name: 'New Jersey' },
  NM: { slug: 'new-mexico', name: 'New Mexico' },
  NY: { slug: 'new-york', name: 'New York' },
  NC: { slug: 'north-carolina', name: 'North Carolina' },
  ND: { slug: 'north-dakota', name: 'North Dakota' },
  OH: { slug: 'ohio', name: 'Ohio' },
  OK: { slug: 'oklahoma', name: 'Oklahoma' },
  OR: { slug: 'oregon', name: 'Oregon' },
  PA: { slug: 'pennsylvania', name: 'Pennsylvania' },
  RI: { slug: 'rhode-island', name: 'Rhode Island' },
  SC: { slug: 'south-carolina', name: 'South Carolina' },
  SD: { slug: 'south-dakota', name: 'South Dakota' },
  TN: { slug: 'tennessee', name: 'Tennessee' },
  TX: { slug: 'texas', name: 'Texas' },
  UT: { slug: 'utah', name: 'Utah' },
  VT: { slug: 'vermont', name: 'Vermont' },
  VA: { slug: 'virginia', name: 'Virginia' },
  WA: { slug: 'washington', name: 'Washington' },
  DC: { slug: 'washington-d-c', name: 'Washington, D.C.' },
  WV: { slug: 'west-virginia', name: 'West Virginia' },
  WI: { slug: 'wisconsin', name: 'Wisconsin' },
  WY: { slug: 'wyoming', name: 'Wyoming' }
};

// Geographic neighbors for internal linking
const NEIGHBORS = {
  AL: ['MS', 'TN', 'GA', 'FL'],
  AK: ['HI', 'WA', 'CA'],
  AZ: ['NM', 'UT', 'NV', 'CA', 'CO'],
  AR: ['MO', 'TN', 'MS', 'LA', 'TX', 'OK'],
  CA: ['OR', 'NV', 'AZ'],
  CO: ['WY', 'NE', 'KS', 'OK', 'NM', 'UT'],
  CT: ['NY', 'MA', 'RI'],
  DE: ['MD', 'PA', 'NJ'],
  FL: ['GA', 'AL'],
  GA: ['FL', 'AL', 'TN', 'NC', 'SC'],
  HI: ['CA', 'AK'],
  ID: ['MT', 'WY', 'UT', 'NV', 'OR', 'WA'],
  IL: ['WI', 'IN', 'KY', 'MO', 'IA'],
  IN: ['MI', 'OH', 'KY', 'IL'],
  IA: ['MN', 'WI', 'IL', 'MO', 'NE', 'SD'],
  KS: ['NE', 'MO', 'OK', 'CO'],
  KY: ['IN', 'OH', 'WV', 'VA', 'TN', 'MO', 'IL'],
  LA: ['TX', 'AR', 'MS'],
  ME: ['NH', 'MA', 'VT'],
  MD: ['PA', 'DE', 'VA', 'WV', 'DC'],
  MA: ['NH', 'VT', 'NY', 'CT', 'RI'],
  MI: ['OH', 'IN', 'WI'],
  MN: ['WI', 'IA', 'SD', 'ND'],
  MS: ['AL', 'TN', 'AR', 'LA'],
  MO: ['IA', 'IL', 'KY', 'TN', 'AR', 'OK', 'KS', 'NE'],
  MT: ['ND', 'SD', 'WY', 'ID'],
  NE: ['SD', 'IA', 'MO', 'KS', 'CO', 'WY'],
  NV: ['CA', 'OR', 'ID', 'UT', 'AZ'],
  NH: ['VT', 'ME', 'MA'],
  NJ: ['NY', 'PA', 'DE'],
  NM: ['AZ', 'CO', 'OK', 'TX'],
  NY: ['VT', 'MA', 'CT', 'NJ', 'PA'],
  NC: ['VA', 'TN', 'GA', 'SC'],
  ND: ['MN', 'SD', 'MT'],
  OH: ['MI', 'IN', 'KY', 'WV', 'PA'],
  OK: ['KS', 'MO', 'AR', 'TX', 'NM', 'CO'],
  OR: ['WA', 'ID', 'NV', 'CA'],
  PA: ['NY', 'NJ', 'DE', 'MD', 'WV', 'OH'],
  RI: ['MA', 'CT'],
  SC: ['NC', 'GA'],
  SD: ['ND', 'MN', 'IA', 'NE', 'WY', 'MT'],
  TN: ['KY', 'VA', 'NC', 'GA', 'AL', 'MS', 'AR', 'MO'],
  TX: ['NM', 'OK', 'AR', 'LA'],
  UT: ['ID', 'WY', 'CO', 'NM', 'AZ', 'NV'],
  VT: ['NH', 'MA', 'NY'],
  VA: ['MD', 'DC', 'WV', 'KY', 'TN', 'NC'],
  WA: ['OR', 'ID'],
  DC: ['MD', 'VA'],
  WV: ['PA', 'MD', 'VA', 'KY', 'OH'],
  WI: ['MN', 'IA', 'IL', 'MI'],
  WY: ['MT', 'SD', 'NE', 'CO', 'UT', 'ID']
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateMetaDescription(data) {
  const state = data.state_name;
  const programs = data.state_rebate_programs || [];
  const taxCredits = data.state_tax_credits || [];
  const utilities = data.top_utilities || [];
  const status = data.homes_hear_status;

  let parts = [];

  if (status === 'launched') {
    parts.push(`${state} has launched HOMES & HEAR rebates.`);
  } else {
    parts.push(`${state} residents qualify for federal energy tax credits.`);
  }

  if (programs.length > 0) {
    const names = programs.slice(0, 2).map(p => p.name);
    parts.push(`State programs include ${names.join(' and ')}.`);
  }

  if (taxCredits.length > 0) {
    parts.push(`State tax credits available for ${taxCredits[0].eligible_items.split(',')[0].trim().toLowerCase()}.`);
  }

  if (utilities.length > 0) {
    parts.push(`Utility rebates from ${utilities[0].name} and more.`);
  }

  parts.push('Find all rebates for heat pumps, solar, EV chargers, and more.');

  let desc = parts.join(' ');
  // Truncate to ~155 chars for SEO
  if (desc.length > 160) {
    desc = desc.substring(0, 157) + '...';
  }
  return desc;
}

function generateFAQs(data) {
  const state = data.state_name;
  const code = data.state_code;
  const programs = data.state_rebate_programs || [];
  const taxCredits = data.state_tax_credits || [];
  const status = data.homes_hear_status;

  const faqs = [];

  // FAQ 1: What rebates are available
  let answer1 = `${state} residents can access federal tax credits including the 25C Energy Efficient Home Improvement Credit (up to $3,200/year) and the 25D Residential Clean Energy Credit (30% for solar and battery storage).`;
  if (programs.length > 0) {
    answer1 += ` State-level programs include ${programs.map(p => p.name).join(', ')}.`;
  }
  if (status === 'launched') {
    answer1 += ` ${state} has also launched the federal HOMES and HEAR rebate programs for income-qualifying households.`;
  }
  faqs.push({
    question: `What energy rebates are available in ${state}?`,
    answer: answer1
  });

  // FAQ 2: HOMES/HEAR status
  faqs.push({
    question: `Has ${state} launched the HOMES and HEAR rebate programs?`,
    answer: data.homes_hear_details
  });

  // FAQ 3: Income eligibility
  if (data.income_thresholds) {
    faqs.push({
      question: `What are the income limits for energy rebates in ${state}?`,
      answer: `${data.income_thresholds.low_income_80_ami} ${data.income_thresholds.moderate_income_150_ami}`
    });
  }

  // FAQ 4: Solar/net metering
  if (data.net_metering) {
    faqs.push({
      question: `Does ${state} have net metering for solar panels?`,
      answer: data.net_metering
    });
  }

  // FAQ 5: How to apply
  faqs.push({
    question: `How do I apply for energy rebates in ${state}?`,
    answer: `Start by entering your ZIP code on Rebate Atlas to get personalized guidance. For federal tax credits (25C and 25D), you claim them when you file your federal income tax return using IRS Form 5695. For state programs, contact the ${data.state_energy_office || state + ' state energy office'}. For utility rebates, check with your local utility provider directly.`
  });

  return faqs;
}

function generateStateContent(data) {
  const state = data.state_name;
  const code = data.state_code;
  const programs = data.state_rebate_programs || [];
  const taxCredits = data.state_tax_credits || [];
  const utilities = data.top_utilities || [];
  const status = data.homes_hear_status;

  let html = '';

  // State-specific overview section
  html += `      <h2>${state} Energy Rebate Overview</h2>\n`;
  html += `      <p>\n`;
  html += `        ${state} households have access to a combination of federal, state, and local utility incentives designed to make energy-efficient home upgrades more affordable. `;
  if (status === 'launched') {
    html += `${state} has launched both the HOMES (Home Owner Managing Energy Savings) and HEAR (High-Efficiency Electric Home Rebate) programs under the Inflation Reduction Act, making additional point-of-sale rebates available to qualifying residents. `;
  } else if (status === 'pending') {
    html += `${state} has not yet launched the HOMES and HEAR rebate programs under the Inflation Reduction Act, but federal tax credits are available now to all homeowners regardless of state program status. `;
  } else {
    html += `The state is in the process of setting up its HOMES and HEAR rebate programs under the Inflation Reduction Act. Federal tax credits remain available to all homeowners. `;
  }
  html += `The ${data.state_energy_office || state + ' state energy office'} coordinates state-level energy programs and can provide the latest information on available incentives.\n`;
  html += `      </p>\n\n`;

  // HOMES/HEAR details
  html += `      <h2>HOMES &amp; HEAR Program Status in ${state}</h2>\n`;
  html += `      <p>${escapeHtml(data.homes_hear_details)}</p>\n\n`;

  // Income thresholds
  if (data.income_thresholds) {
    html += `      <h2>Income Eligibility for ${state} Rebates</h2>\n`;
    html += `      <p>${escapeHtml(data.income_thresholds.low_income_80_ami)}</p>\n`;
    html += `      <p>${escapeHtml(data.income_thresholds.moderate_income_150_ami)}</p>\n\n`;
  }

  // State tax credits
  if (taxCredits.length > 0) {
    html += `      <h2>${state} State Tax Credits</h2>\n`;
    for (const credit of taxCredits) {
      html += `      <div class="program-card">\n`;
      html += `        <h3>${escapeHtml(credit.name)}</h3>\n`;
      html += `        <p><strong>Amount:</strong> ${escapeHtml(credit.amount)}</p>\n`;
      html += `        <p><strong>Eligible items:</strong> ${escapeHtml(credit.eligible_items)}</p>\n`;
      if (credit.details) {
        html += `        <p>${escapeHtml(credit.details)}</p>\n`;
      }
      if (credit.url) {
        html += `        <p><a href="${escapeHtml(credit.url)}" target="_blank" rel="noopener noreferrer" class="inline-link">Learn more</a></p>\n`;
      }
      html += `      </div>\n`;
    }
    html += '\n';
  }

  // State rebate programs
  if (programs.length > 0) {
    html += `      <h2>${state} State Rebate Programs</h2>\n`;
    for (const prog of programs) {
      html += `      <div class="program-card">\n`;
      html += `        <h3>${escapeHtml(prog.name)}</h3>\n`;
      if (prog.administrator) {
        html += `        <p><strong>Administered by:</strong> ${escapeHtml(prog.administrator)}</p>\n`;
      }
      html += `        <p><strong>Amount:</strong> ${escapeHtml(prog.amount)}</p>\n`;
      html += `        <p><strong>Eligible items:</strong> ${escapeHtml(prog.eligible_items)}</p>\n`;
      if (prog.details) {
        html += `        <p>${escapeHtml(prog.details)}</p>\n`;
      }
      if (prog.url) {
        html += `        <p><a href="${escapeHtml(prog.url)}" target="_blank" rel="noopener noreferrer" class="inline-link">Learn more</a></p>\n`;
      }
      html += `      </div>\n`;
    }
    html += '\n';
  }

  // Net metering
  if (data.net_metering) {
    html += `      <h2>Solar Net Metering in ${state}</h2>\n`;
    html += `      <p>${escapeHtml(data.net_metering)}</p>\n\n`;
  }

  // Utility programs
  if (utilities.length > 0) {
    html += `      <h2>Utility Rebate Programs in ${state}</h2>\n`;
    html += `      <p>${state} residents may qualify for additional rebates from their local utility company. Here are programs from major utilities serving the state:</p>\n`;
    for (const util of utilities) {
      html += `      <h3>${escapeHtml(util.name)}</h3>\n`;
      if (util.programs && util.programs.length > 0) {
        for (const prog of util.programs) {
          html += `      <div class="program-card">\n`;
          html += `        <h4>${escapeHtml(prog.name)}</h4>\n`;
          html += `        <p><strong>Amount:</strong> ${escapeHtml(prog.amount)}</p>\n`;
          html += `        <p><strong>Eligible items:</strong> ${escapeHtml(prog.eligible_items)}</p>\n`;
          if (prog.url) {
            html += `        <p><a href="${escapeHtml(prog.url)}" target="_blank" rel="noopener noreferrer" class="inline-link">Learn more</a></p>\n`;
          }
          html += `      </div>\n`;
        }
      }
    }
    html += '\n';
  }

  return html;
}

function generatePage(data) {
  const state = data.state_name;
  const code = data.state_code;
  const slug = STATE_MAP[code].slug;
  const metaDesc = generateMetaDescription(data);
  const faqs = generateFAQs(data);
  const stateContent = generateStateContent(data);

  // Build neighbor links
  const neighbors = (NEIGHBORS[code] || []).slice(0, 5);
  const neighborLinks = neighbors
    .filter(n => STATE_MAP[n])
    .map(n => `        <a href="/states/${STATE_MAP[n].slug}/" class="chip chip-link">${STATE_MAP[n].name}</a>`)
    .join('\n');

  // FAQ Schema JSON-LD
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(f => ({
      '@type': 'Question',
      'name': f.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': f.answer
      }
    }))
  };

  // WebPage schema
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': `${state} Energy Rebates & Incentives`,
    'description': metaDesc,
    'url': `${SITE_URL}/states/${slug}/`,
    'isPartOf': {
      '@type': 'WebSite',
      'name': 'Rebate Atlas',
      'url': SITE_URL
    }
  };

  // Breadcrumb schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${SITE_URL}/` },
      { '@type': 'ListItem', 'position': 2, 'name': 'States', 'item': `${SITE_URL}/states/` },
      { '@type': 'ListItem', 'position': 3, 'name': state, 'item': `${SITE_URL}/states/${slug}/` }
    ]
  };

  // FAQ HTML section
  const faqHtml = faqs.map(f =>
    `      <h3>${escapeHtml(f.question)}</h3>\n      <p>${escapeHtml(f.answer)}</p>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${state} Energy Rebates &amp; Incentives · Rebate Atlas</title>
  <meta name="description" content="${escapeHtml(metaDesc)}" />
  <meta property="og:title" content="${state} Energy Rebates &amp; Incentives · Rebate Atlas" />
  <meta property="og:description" content="${escapeHtml(metaDesc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE_URL}/states/${slug}/" />
  <meta property="og:image" content="${SITE_URL}/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${state} Energy Rebates &amp; Incentives · Rebate Atlas" />
  <meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
  <meta name="twitter:image" content="${SITE_URL}/og-image.png" />
  <link rel="canonical" href="${SITE_URL}/states/${slug}/" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <meta name="theme-color" content="#050816" />
  <script type="application/ld+json">
  ${JSON.stringify(webPageSchema, null, 2).replace(/^/gm, '  ').trim()}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify(breadcrumbSchema, null, 2).replace(/^/gm, '  ').trim()}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify(faqSchema, null, 2).replace(/^/gm, '  ').trim()}
  </script>
</head>
<body class="page">
  <a href="#main-content" class="skip-link">Skip to content</a>
  <header class="site-header" role="banner">
    <div class="site-brand">
      <span class="site-logo-dot"></span>
      <span class="site-title">Rebate Atlas</span>
    </div>
    <nav class="site-nav" id="site-nav" aria-label="Main navigation">
      <a href="/index.html" class="nav-link">Home</a>
      <a href="/chat.html" class="nav-link">Ask the AI</a>
      <a href="/states/" class="nav-link nav-link-active">States</a>
      <a href="/categories/" class="nav-link">Categories</a>
      <a href="/about.html" class="nav-link nav-link-secondary">About</a>
      <a href="/faq.html" class="nav-link nav-link-secondary">FAQ</a>
      <a href="/contact.html" class="nav-link nav-link-secondary">Contact</a>
    </nav>
    <button class="nav-toggle" id="nav-toggle" aria-label="Open navigation menu" aria-expanded="false" aria-controls="site-nav">
      <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
  </header>

  <main class="content" id="main-content">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/index.html">Home</a>
      <span class="breadcrumb-sep">/</span>
      <a href="/states/">States</a>
      <span class="breadcrumb-sep">/</span>
      <span>${state}</span>
    </nav>

    <p class="affiliate-disclosure">This page may contain affiliate links. If you use a partner link, we may earn a referral commission at no extra cost to you. See our <a href="/privacy-policy.html" class="inline-link">privacy policy</a>.</p>

    <section class="explainer">
      <h1>Energy Rebates in ${state}</h1>
      <p>
        ${state} residents can access a range of federal energy tax credits, state-specific incentive programs,
        and local utility rebates to help offset the cost of energy-efficient home improvements. This page covers
        the key programs available in ${state}, including heat pump rebates, solar incentives, EV charger credits,
        weatherization assistance, and more. Each program listed below includes eligibility details and links to
        official sources.
      </p>

      <h2>Federal Programs Available in ${state}</h2>
      <ul>
        <li><strong>25C Energy Efficient Home Improvement Credit:</strong> Up to $3,200/year for heat pumps, insulation, windows, doors, electrical panels, and home energy audits. Covers 30% of costs.</li>
        <li><strong>25D Residential Clean Energy Credit:</strong> 30% tax credit for solar panels and battery storage with no dollar cap. Available through 2032.</li>
        <li><strong>HOMES &amp; HEAR Rebates:</strong> Income-qualified point-of-sale rebates up to $14,000 for heat pumps, water heaters, electrical panels, and other electrification upgrades.</li>
        <li><strong>30C EV Charger Credit:</strong> Up to $1,000 for home EV charging equipment in eligible census tracts.</li>
        <li><strong>Weatherization Assistance Program (WAP):</strong> Free weatherization services for low-income households at or below 200% of the federal poverty level.</li>
      </ul>

${stateContent}
      <h2>Get Personalized ${state} Rebate Guidance</h2>
      <p>
        Enter your ZIP code below to chat with our AI about rebates specific to your area in ${state}.
        The AI will check federal, state, and utility programs and give you a personalized breakdown
        of what you may qualify for and how to apply.
      </p>

      <form class="zip-form" data-state="${code}">
        <div class="field-row">
          <label class="field">
            <span class="field-label">Your ${state} ZIP code</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="e.g. enter your ZIP" />
          </label>
        </div>
        <button class="btn-primary" type="submit">Find my rebates</button>
      </form>

      <p style="margin-top:16px;">
        Or <a href="/chat.html?state=${code}" class="inline-link">ask the AI about ${state} rebates directly</a>.
      </p>
    </section>

    <section class="explainer" style="margin-top:18px;">
      <h2>Frequently Asked Questions About ${state} Rebates</h2>
${faqHtml}
    </section>

    <section class="explainer" style="margin-top:18px;">
      <h2>Explore Nearby States</h2>
      <p>Compare energy rebate programs in neighboring states:</p>
      <div class="chip-row">
${neighborLinks}
      </div>
    </section>

    <section class="explainer" style="margin-top:18px;">
      <h2>Browse by Category</h2>
      <div class="chip-row">
        <a href="/categories/heat-pumps.html" class="chip chip-link">Heat pumps</a>
        <a href="/categories/water-heaters.html" class="chip chip-link">Water heaters</a>
        <a href="/categories/smart-thermostats.html" class="chip chip-link">Smart thermostats</a>
        <a href="/categories/ev-chargers.html" class="chip chip-link">EV chargers</a>
        <a href="/categories/solar-panels.html" class="chip chip-link">Solar panels</a>
        <a href="/categories/insulation-weatherization.html" class="chip chip-link">Insulation</a>
        <a href="/categories/windows-doors.html" class="chip chip-link">Windows &amp; doors</a>
        <a href="/categories/battery-storage.html" class="chip chip-link">Battery storage</a>
      </div>
      <p style="margin-top:12px;"><a href="/states/" class="inline-link">Back to all states</a></p>
    </section>

    <div class="ad-slot" data-ad-format="auto" style="margin:24px 0; min-height:0;"></div>
  </main>

  <footer class="site-footer" role="contentinfo">
    <p>&copy; <span id="year"></span> Rebate Atlas. Educational use only &middot; Not tax or legal advice.</p>
    <p>Some suggestions may include sponsored partners. This does not affect guidance.</p>
    <p><a href="/chat.html" class="inline-link">Ask the AI</a> &middot; <a href="/states/" class="inline-link">States</a> &middot; <a href="/categories/" class="inline-link">Categories</a> &middot; <a href="/blog/" class="inline-link">Updates</a> &middot; <a href="/about.html" class="inline-link">About</a> &middot; <a href="/faq.html" class="inline-link">FAQ</a> &middot; <a href="/privacy-policy.html" class="inline-link">Privacy Policy</a> &middot; <a href="/terms.html" class="inline-link">Terms</a> &middot; <a href="/contact.html" class="inline-link">Contact</a></p>
  </footer>

  <script src="/main.js"></script>
  <script src="/forms.js"></script>
  <script src="/injectors.js"></script>
</body>
</html>
`;
}

// Main execution
const stateFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
let generated = 0;

for (const file of stateFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  const code = data.state_code;
  if (!STATE_MAP[code]) {
    console.warn(`Skipping unknown state code: ${code}`);
    continue;
  }

  const slug = STATE_MAP[code].slug;
  const pageDir = path.join(STATES_DIR, slug);
  const pagePath = path.join(pageDir, 'index.html');

  if (!fs.existsSync(pageDir)) {
    fs.mkdirSync(pageDir, { recursive: true });
  }

  const html = generatePage(data);
  fs.writeFileSync(pagePath, html, 'utf8');
  generated++;
  console.log(`Generated: states/${slug}/index.html`);
}

console.log(`\nDone. Generated ${generated} state pages.`);
