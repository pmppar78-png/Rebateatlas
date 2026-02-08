const CACHE_NAME = 'ra-v9';
const ASSETS = [
  '/', '/index.html', '/chat.html', '/404.html', '/form-success.html',
  '/about.html', '/faq.html', '/contact.html',
  '/styles.css', '/main.js', '/partners.js', '/og-image.svg',
  '/categories/', '/categories/heat-pumps.html', '/categories/solar-panels.html',
  '/categories/ev-chargers.html', '/categories/water-heaters.html',
  '/categories/smart-thermostats.html', '/categories/insulation-weatherization.html',
  '/categories/windows-doors.html', '/categories/battery-storage.html'
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
  if (url.pathname.endsWith('.json') || url.pathname.includes('/.netlify/')) {
    return;
  }
  // For HTML pages, try network first so content stays fresh
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
  // For other assets, use cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
