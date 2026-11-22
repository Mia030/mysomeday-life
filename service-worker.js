const CACHE_NAME = 'waitlist-v2-shell-8';
const APP_SHELL = [
  './wishlist.html',
  './history.html',
  './review.html',
  './account.html',
  './manifest.webmanifest',
  './assets/styles.css',
  './assets/mock-data.js',
  './assets/data-store.js',
  './assets/app.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/product-placeholder.svg',
  './partials/header.html',
  './partials/footer.html'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then(response => response || caches.match('./wishlist.html'))));
    return;
  }

  event.respondWith(fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match(request)));
});
