const CACHE_NAME = 'math-quiz-v4';
const PRECACHE_PATHS = [
  '',
  'index.html',
  'styles.css',
  'app.js',
  'questions.json',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

function toScopedUrl(path) {
  // Use the SW registration scope as the base so this works from any subfolder.
  return new URL(path, self.registration.scope).toString();
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_PATHS.map(toScopedUrl)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => { if(k !== CACHE_NAME) return caches.delete(k); })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Network-first for JSON (to get updates), cache-first for others
  if(req.url.endsWith('questions.json')){
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      return caches.open(CACHE_NAME).then(cache => { cache.put(req, res.clone()); return res; });
    })).catch(() => caches.match(toScopedUrl('index.html')))
  );
});
