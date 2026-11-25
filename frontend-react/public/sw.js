/*
 * TrackFarm service worker: lets the installed app open, and show the records
 * it has seen, without network.
 *
 * - Page loads: network first, falling back to the cached app shell
 *   (index.html), so the app opens offline and React Router takes over.
 * - Built assets, icons and bird photos: served from cache, refreshed in the
 *   background (stale-while-revalidate).
 * - config.js: network first, cache as fallback (it changes per deploy).
 * - API reads (GET to the API origin the page tells us about): network
 *   first; offline, the last copy seen is returned with an
 *   X-FarmBook-Cached-At header so the app can say how old it is. Writes are
 *   never touched — offline writes go through the app's own IndexedDB queue.
 *
 * Updates: __BUILD_ID__ is replaced with a fresh value on every build
 * (vite.config.js), so each deploy changes this file and browsers notice.
 * The new worker waits until the app asks it to take over (SKIP_WAITING),
 * which the "new version ready" banner does.
 */
const BUILD_ID = '__BUILD_ID__';
const SHELL_CACHE = `farmbook-shell-${BUILD_ID}`;
// Not versioned: saved records must survive deploys. Cleared on logout.
const API_CACHE = 'farmbook-api';
const META_CACHE = 'farmbook-meta';
const SHELL = ['/', '/index.html', '/config.js', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('farmbook-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ---- API origin --------------------------------------------------------------
// The page posts config.apiBase; it's also kept in a cache so it survives the
// worker being stopped and restarted between messages.
let apiOrigin = null;

async function getApiOrigin() {
  if (apiOrigin) return apiOrigin;
  const res = await (await caches.open(META_CACHE)).match('/__api-origin');
  if (res) apiOrigin = await res.text();
  return apiOrigin;
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'API_BASE' && data.apiBase) {
    try {
      apiOrigin = new URL(data.apiBase).origin;
      event.waitUntil(caches.open(META_CACHE).then((c) => c.put('/__api-origin', new Response(apiOrigin))));
    } catch {
      // Not a URL; leave API caching off.
    }
  }
});

// ---- strategies --------------------------------------------------------------
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl || request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(fallbackUrl || request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || refresh;
}

async function apiNetworkFirst(request) {
  const cache = await caches.open(API_CACHE);
  // Keyed by URL only: the Authorization header differs per token refresh
  // but the farm (and so the data) is the same. Logout clears this cache.
  const key = request.url;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const body = await response.clone().arrayBuffer();
      const headers = new Headers(response.headers);
      headers.set('X-FarmBook-Cached-At', new Date().toISOString());
      cache.put(key, new Response(body, { status: 200, headers }));
    }
    return response;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(
      getApiOrigin().then((origin) => (origin && url.origin === origin ? apiNetworkFirst(request) : fetch(request)))
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'));
    return;
  }
  if (url.pathname === '/config.js') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (/^\/(assets|icon|birds|images|onboarding)\//.test(url.pathname) || url.pathname === '/manifest.json') {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// ---- Phone notifications ------------------------------------------------------
// The server (backend/src/lib/push.ts) sends { title, body, url, tag }. A
// newer notification with the same tag replaces the old one instead of
// stacking, so a farmer never sees a pile of identical reminders.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'TrackFarm';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon/app-icon-192.png',
      badge: '/icon/app-icon-192.png',
      tag: data.tag || 'trackfarm',
      renotify: Boolean(data.tag),
      data: { url: data.url || '/dashboard' },
    })
  );
});

// Tapping opens the page the notification is about. If TrackFarm is already
// open, that window is reused rather than opening a second copy.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) return client.navigate(target).catch(() => {});
          return undefined;
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
