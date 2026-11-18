import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/mobile-app.css'
import App from './App.jsx'
import { logError } from './services/logger'
import { queryCache } from './services/queryCache'

// ── Automatic Same-Origin Auth Header Attachment for /api/* ────────────────
// Ensures every API request across all services sends the HMAC Bearer token
// and HttpOnly session cookie seamlessly without duplicating header logic.
if (typeof window !== 'undefined' && typeof window.fetch === 'function' && !window.__gamacoAuthFetchPatched) {
  window.__gamacoAuthFetchPatched = true;
  const _origFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : (input?.url || '');
      const isSameOriginApi =
        url.startsWith('/api/') ||
        url.startsWith(`${window.location.origin}/api/`);
      if (isSameOriginApi) {
        const token = localStorage.getItem('auth_token');
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        return _origFetch(input, {
          ...init,
          credentials: init?.credentials || 'same-origin',
          headers,
        });
      }
    } catch (_) {}
    return _origFetch(input, init);
  };
}

// ── Global Error Listeners ─────────────────────────────────────────────────
window.addEventListener('error', (event) => {
  const errorObj = event.error || new Error(event.message || 'Global Window Error');
  logError(errorObj);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const errorObj = reason instanceof Error
    ? reason
    : new Error(reason ? String(reason) : 'Unhandled Promise Rejection');
  logError(errorObj);
});

// ── Cache Warm-up (non-blocking) ───────────────────────────────────────────
// Pre-populate memory cache from IndexedDB before first render.
// This ensures 0ms reads for frequently accessed data on app startup.
queryCache.warmUp([
  'classes_all',
  'lessons_all',
  'users_all',
  'school_config',
]).then(() => {
  // After warm-up, evict stale entries in background (runs once per session)
  return queryCache.evictExpired();
}).catch(() => {
  // Non-critical — ignore if IndexedDB is unavailable
});

// ── Mount React ────────────────────────────────────────────────────────────
const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ── Hide Splash Screen once React has mounted ──────────────────────────────
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    if (typeof window.__hideSplash === 'function') {
      window.__hideSplash();
    }
  });
});

// ── Auto-reload once when a new PWA Service Worker takes control ───────────
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let swReloading = false;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !swReloading) {
      swReloading = true;
      window.location.reload();
    }
  });
}
