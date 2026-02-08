// Cache version: auto-busted via deploy timestamp injected by build, or manual bump
const CACHE_VERSION = '20260208b';
const CACHE_NAME = 'ra-v13-' + CACHE_VERSION;

const ASSETS = [
  '/', '/index.html', '/chat.html', '/404.html', '/form-success.html',
  '/about.html', '/faq.html', '/contact.html',
  '/privacy-policy.html', '/terms.html', '/accessibility.html',
  '/styles.css', '/main.js', '/partners.js', '/injectors.js', '/forms.js',
  '/og-image.png', '/icon.svg', '/icon-192.png', '/icon-512.png',
  '/manifest.json',
  '/config.json', '/affiliates.json',
  '/categories/', '/categories/heat-pumps.html', '/categories/solar-panels.html',
  '/categories/ev-chargers.html', '/categories/water-heaters.html',
  '/categories/smart-thermostats.html', '/categories/insulation-weatherization.html',
  '/categories/windows-doors.html', '/categories/battery-storage.html',
  '/states/',
  '/guides/', '/guides/25c-tax-credit.html', '/guides/25d-clean-energy-credit.html',
  '/guides/30c-ev-charger-credit.html', '/guides/homes-rebate-program.html',
  '/guides/hear-rebate-program.html', '/guides/weatherization-assistance-program.html',
  '/guides/heat-pump-vs-furnace.html', '/guides/water-heater-comparison.html',
  '/guides/solar-vs-battery.html', '/guides/renter-vs-homeowner-rebates.html',
  '/guides/stacking-rebates.html', '/guides/low-income-rebates.html',
  '/guides/moderate-income-eligibility.html', '/guides/manufactured-home-rebates.html',
  '/guides/2026-rebate-deadlines.html',
  '/blog/', '/blog/homes-hear-program-tracker-2026.html',
  '/blog/2026-tax-credit-changes.html', '/blog/heat-pump-rebate-stacking-guide.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Never cache Netlify function calls
  if (url.pathname.includes('/.netlify/')) return;

  // For config/affiliate JSON: network-first with cache fallback
  if (url.pathname === '/config.json' || url.pathname === '/affiliates.json') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // For ZIP data JSON files: skip caching (too many, network-only)
  if (url.pathname.endsWith('.json')) return;

  // For HTML pages: network-first so content stays fresh
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
            return res;
          }
          return caches.match(e.request).then(cached => cached || caches.match('/404.html'));
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/404.html')))
    );
    return;
  }

  // For CSS and JS: network-first to prevent stale assets
  if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // For other assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
