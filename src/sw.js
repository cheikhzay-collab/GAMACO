/**
 * L'CONQ — High-Performance Service Worker v3
 * Strategy: injectManifest (Vite Plugin PWA)
 *
 * Cache Layers:
 * - Precache:   All build assets (JS/CSS/HTML) — CacheFirst, immutable
 * - Fonts:      Google Fonts — CacheFirst, 1 year
 * - Images:     External images — StaleWhileRevalidate, 14 days, 50 entries
 * - App assets: JS/CSS chunks — StaleWhileRevalidate, 7 days
 * - LocalDB API: /api/* from companion — NetworkFirst with IDB fallback, 5 min
 * - Neon API:   NEVER cache (always network)
 * - Auth:       NEVER cache (always network)
 */

import { clientsClaim } from 'workbox-core';
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import {
  CacheFirst,
  StaleWhileRevalidate,
  NetworkFirst,
  NetworkOnly,
} from 'workbox-strategies';
import { ExpirationPlugin }        from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin }    from 'workbox-background-sync';

// ── Activate immediately ───────────────────────────────────────────────────
self.skipWaiting();
clientsClaim();

// ── Precache all build assets ──────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// ── Versioned Cache Names ──────────────────────────────────────────────────
const CACHE_VERSION = 'v3';
const CACHE = {
  fonts:    `lconq-fonts-${CACHE_VERSION}`,
  images:   `lconq-images-${CACHE_VERSION}`,
  assets:   `lconq-assets-${CACHE_VERSION}`,
  api:      `lconq-api-${CACHE_VERSION}`,
};

// ── Cleanup old versioned caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const current = Object.values(CACHE);
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.map((name) => {
          if (name.startsWith('lconq-') && !current.includes(name)) {
            console.log('[SW] Deleting outdated cache:', name);
            return caches.delete(name);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── NEVER cache: Auth routes ───────────────────────────────────────────────
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/auth/') ||
    url.pathname.startsWith('/auth/'),
  new NetworkOnly()
);

// ── Native API (/api/*) — NetworkFirst with fresh fallback cache ───────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: CACHE.api,
    networkTimeoutSeconds: 3, // Fall back to cache after 3s
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 5, // 5 minutes
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// ── SPA fallback: navigation → index.html ─────────────────────────────────
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  denylist: [
    /\/api\//,
    /\/_/,
    /\/admin\/.+\.(json|csv|pdf)$/,
    /\/print/,
  ],
});
registerRoute(navigationRoute);

// ── Google Fonts — CacheFirst (1 year) ────────────────────────────────────
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: CACHE.fonts,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 15,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// ── Images — StaleWhileRevalidate (14 days, 50 entries) ───────────────────
// Increased from 7 days / 25 entries for better offline experience.
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: CACHE.images,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// ── App JS/CSS chunks — StaleWhileRevalidate (7 days) ────────────────────
// Increased from 3 days since Vite uses content-hashed filenames (safe to cache longer).
registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: CACHE.assets,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// ── Background Sync for offline writes ───────────────────────────────────
// If a POST to /api/* fails while offline, it is queued and replayed
// automatically when the network comes back.
const bgSyncPlugin = new BackgroundSyncPlugin('lconq-offline-queue', {
  maxRetentionTime: 24 * 60, // Retain for 24 hours (in minutes)
});

registerRoute(
  ({ url, request }) =>
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    url.pathname.startsWith('/api/') &&
    request.method === 'POST',
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'POST'
);

// ── Listen for skip-waiting message ──────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
