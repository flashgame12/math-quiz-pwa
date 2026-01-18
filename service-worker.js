const SW_VERSION = new URL(self.location.href).searchParams.get('v') || 'v1';
const CACHE_NAME = `math-quiz-${SW_VERSION}`;
const TIMEOUT_MS = 4000;
const PRECACHE_PATHS = Array.from(new Set([
  '',
  'index.html',
  'styles.css',
  'src/app.js',
  'src/ui/index.js',
  'src/audio/index.js',
  'src/data/questions.js',
  'src/summary/index.js',
  'src/pwa/index.js',
  'questions.json',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
])).map(toScopedUrl);

function toScopedUrl(path) {
  // Use the SW registration scope as the base so this works from any subfolder.
  return new URL(path, self.registration.scope).toString();
}

const SHELL_FALLBACK = toScopedUrl('index.html');

function isQuestionsRequest(request) {
  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin && url.pathname.endsWith('questions.json');
  } catch {
    return false;
  }
}

async function safeCachePut(request, response) {
  // Only cache successful or opaque responses; avoid polluting cache with errors.
  if (!response || (!response.ok && response.type !== 'opaque')) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

async function cacheMatch(request) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(request);
}

async function fetchWithTimeout(request, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function networkFirst(request, { timeoutMs = TIMEOUT_MS, fallbackUrl } = {}) {
  try {
    const res = await fetchWithTimeout(request, timeoutMs);
    if (res) void safeCachePut(request, res.clone());
    return res;
  } catch {
    if (fallbackUrl) return cacheMatch(fallbackUrl);
    return cacheMatch(request);
  }
}

async function cacheFirst(request, { fallbackUrl } = {}) {
  const cached = await cacheMatch(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res) void safeCachePut(request, res.clone());
    return res;
  } catch {
    if (fallbackUrl) return cacheMatch(fallbackUrl);
    return new Response('Offline', { status: 503 });
  }
}

const APP_SHELL_PATHS = [
  '/',
  '/index.html',
  '/styles.css',
  '/src/app.js',
  '/src/ui/index.js',
  '/src/audio/index.js',
  '/src/data/questions.js',
  '/src/summary/index.js',
  '/src/pwa/index.js',
  '/manifest.json'
];

function isAppShellRequest(request) {
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return false;
    if (request.mode === 'navigate') return true;
    return APP_SHELL_PATHS.some(path => url.pathname === path || url.pathname.endsWith(path));
  } catch {
    return false;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_PATHS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(k => k.startsWith('math-quiz-') && k !== CACHE_NAME)
        .map(k => caches.delete(k))
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

  // Network-first for JSON (to get updates) with cache-busting.
  if (isQuestionsRequest(req)) {
    const url = new URL(req.url);
    url.searchParams.set('v', SW_VERSION);
    const versionedReq = new Request(url.toString(), {
      headers: req.headers,
      mode: req.mode,
      credentials: req.credentials,
      redirect: req.redirect,
      cache: 'no-cache'
    });
    event.respondWith(networkFirst(versionedReq, { timeoutMs: TIMEOUT_MS }));
    return;
  }

  // Keep the app shell fresh (important for iOS Safari caches).
  if (isAppShellRequest(req)) {
    event.respondWith(networkFirst(req, { timeoutMs: TIMEOUT_MS, fallbackUrl: SHELL_FALLBACK }));
    return;
  }

  // Cache-first for everything else, with an HTML fallback for navigations/offline.
  event.respondWith(
    cacheFirst(req, { fallbackUrl: req.mode === 'navigate' ? SHELL_FALLBACK : undefined })
  );
});
