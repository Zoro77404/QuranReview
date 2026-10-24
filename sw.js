// Service worker: opens instantly from cache, refreshes in the background, works offline after the first visit.
const CACHE = 'quran-review-v3';
const SHELL = ['./', 'index.html', 'match.js', 'listen.js', 'data/quran-simple-clean-67-114.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // transformers-cache holds the speech model; it is managed by Transformers.js, not here.
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('quran-review')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Serve from cache right away, update the cache from the network for next time.
function staleWhileRevalidate(req, key = req) {
  return caches.open(CACHE).then(c => c.match(key).then(hit => {
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) c.put(key, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
}

// Try the network first, fall back to the cached copy when offline.
function networkFirst(req) {
  return caches.open(CACHE).then(c => fetch(req).then(res => {
    if (res && res.ok) c.put(req, res.clone());
    return res;
  }).catch(() => c.match(req)));
}

// Versioned CDN files never change: cache once, then always serve the cached copy.
function cacheFirst(req) {
  return caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) c.put(req, res.clone());
    return res;
  })));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith(staleWhileRevalidate(req, 'index.html'));
  } else if (url.origin === location.origin) {
    // The speech model is downloaded once and kept by Transformers.js in its own cache.
    if (url.pathname.includes('/models/')) return;
    e.respondWith(staleWhileRevalidate(req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req));
  } else if (url.hostname === 'cdn.jsdelivr.net' && /\.m?js$/.test(url.pathname)) {
    // Transformers.js library + ONNX Runtime loader (the .wasm binary is cached by Transformers.js).
    e.respondWith(cacheFirst(req));
  } else if (url.hostname === 'api.alquran.cloud' || url.hostname === 'api.quran.com') {
    e.respondWith(networkFirst(req));
  }
  // Recitation audio streams straight from the network.
});
