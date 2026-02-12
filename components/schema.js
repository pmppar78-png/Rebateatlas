/**
 * Schema.org JSON-LD generation utilities for Rebate Atlas.
 *
 * These helpers produce valid Schema.org structured data objects that can be
 * serialised into <script type="application/ld+json"> blocks. They are used
 * both at build time (category page generation) and at runtime when pages
 * need to inject schema dynamically.
 */

const SITE_URL = 'https://rebateatlas.com';
const SITE_NAME = 'Rebate Atlas';

/**
 * Generate a LocalBusiness schema for a location-specific page.
 * @param {string} zip  - 5-digit ZIP code
 * @param {string} city - City name
 * @param {string} state - Two-letter state abbreviation
 * @returns {object} Schema.org LocalBusiness JSON-LD object
 */
function generateLocalBusinessSchema(zip, city, state) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': `${SITE_NAME} — ${city}, ${state}`,
    'description': `Energy rebate and incentive guidance for households in ${city}, ${state} ${zip}.`,
    'url': `${SITE_URL}/chat.html?zip=${zip}`,
    'address': {
      '@type': 'PostalAddress',
      'addressLocality': city,
      'addressRegion': state,
      'postalCode': zip,
      'addressCountry': 'US'
    },
    'areaServed': {
      '@type': 'PostalAddress',
      'postalCode': zip,
      'addressCountry': 'US'
    }
  };
}

/**
 * Generate a FAQPage schema from an array of question/answer pairs.
 * @param {Array<{question: string, answer: string}>} faqs
 * @returns {object} Schema.org FAQPage JSON-LD object
 */
function generateFAQPageSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(function (faq) {
      return {
        '@type': 'Question',
        'name': faq.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': faq.answer
        }
      };
    })
  };
}

/**
 * Generate a BreadcrumbList schema from an ordered path.
 * @param {Array<{name: string, url?: string}>} path - Breadcrumb items in order; last item has no url.
 * @returns {object} Schema.org BreadcrumbList JSON-LD object
 */
function generateBreadcrumbSchema(path) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': path.map(function (item, index) {
      var entry = {
        '@type': 'ListItem',
        'position': index + 1,
        'name': item.name
      };
      if (item.url) {
        entry.item = item.url;
      }
      return entry;
    })
  };
}

/**
 * Generate an Article schema for an informational page.
 * @param {object} page
 * @param {string} page.headline   - Article title
 * @param {string} page.description - Short summary
 * @param {string} page.url        - Canonical URL of the article
 * @param {string} [page.datePublished] - ISO date
 * @param {string} [page.dateModified]  - ISO date
 * @returns {object} Schema.org Article JSON-LD object
 */
function generateArticleSchema(page) {
  var schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': page.headline,
    'description': page.description,
    'url': page.url,
    'publisher': {
      '@type': 'Organization',
      'name': SITE_NAME,
      'url': SITE_URL
    }
  };
  if (page.datePublished) {
    schema.datePublished = page.datePublished;
  }
  if (page.dateModified) {
    schema.dateModified = page.dateModified;
  }
  return schema;
}

/**
 * Generate a WebSite schema for the homepage.
 * @returns {object} Schema.org WebSite JSON-LD object
 */
function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': SITE_NAME,
    'url': SITE_URL,
    'description': 'Free AI-powered platform helping US households discover energy-efficiency rebates, tax credits, and incentives.',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${SITE_URL}/chat.html?zip={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
}

/**
 * Generate an Organization schema.
 * @returns {object} Schema.org Organization JSON-LD object
 */
function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': SITE_NAME,
    'url': SITE_URL,
    'description': 'Free educational platform helping US households discover energy-efficiency rebates, tax credits, and incentives.',
    'sameAs': []
  };
}

/**
 * Serialise a schema object into a ready-to-insert <script> tag string.
 * @param {object} schema - A Schema.org JSON-LD object
 * @returns {string} Complete <script type="application/ld+json"> tag
 */
function schemaToScript(schema) {
  return '<script type="application/ld+json">\n' + JSON.stringify(schema, null, 2) + '\n</script>';
}

// Export for Node.js / build scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateLocalBusinessSchema: generateLocalBusinessSchema,
    generateFAQPageSchema: generateFAQPageSchema,
    generateBreadcrumbSchema: generateBreadcrumbSchema,
    generateArticleSchema: generateArticleSchema,
    generateWebSiteSchema: generateWebSiteSchema,
    generateOrganizationSchema: generateOrganizationSchema,
    schemaToScript: schemaToScript,
    SITE_URL: SITE_URL,
    SITE_NAME: SITE_NAME
  };
}
