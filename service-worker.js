const SW_VERSION = new URL(self.location.href).searchParams.get('v') || 'v1';
const CACHE_NAME = `math-quiz-${SW_VERSION}`;
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

function isQuestionsRequest(request) {
  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin && url.pathname.endsWith('questions.json');
  } catch {
    return false;
  }
}

async function cachePut(request, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

async function cacheMatch(request) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(request);
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    void cachePut(request, res.clone());
    return res;
  } catch {
    return cacheMatch(request);
  }
}

async function cacheFirst(request) {
  const cached = await cacheMatch(request);
  if (cached) return cached;
  const res = await fetch(request);
  void cachePut(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cached = await cacheMatch(request);
  const fetchPromise = fetch(request)
    .then(res => {
      void cachePut(request, res.clone());
      return res;
    })
    .catch(() => undefined);

  return cached || fetchPromise || new Response('Offline', { status: 503 });
}

function isAppShellRequest(request) {
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return false;

    if (request.mode === 'navigate') return true;
    return (
      url.pathname.endsWith('/') ||
      url.pathname.endsWith('/index.html') ||
      url.pathname.endsWith('/styles.css') ||
      url.pathname.endsWith('/app.js') ||
      url.pathname.endsWith('/manifest.json')
    );
  } catch {
    return false;
  }
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

  // Only handle same-origin GET requests.
  if (req.method !== 'GET') return;
  try {
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
  } catch {
    return;
  }

  // Network-first for JSON (to get updates).
  if (isQuestionsRequest(req)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Keep the app shell fresh (important for iOS Safari caches).
  if (isAppShellRequest(req)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Cache-first for everything else, with an HTML fallback.
  event.respondWith(
    cacheFirst(req).catch(() => cacheMatch(toScopedUrl('index.html')))
  );
});
