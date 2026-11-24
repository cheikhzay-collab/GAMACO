// src/components/PWAUpdateBanner.jsx
// Detects when a new Service Worker is available and shows a clear update banner.
// Solves the mobile "must clear cache" problem by forcing a clean reload.

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, Zap } from 'lucide-react';

export default function PWAUpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Check for already-waiting SW on mount
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      setRegistration(reg);

      if (reg.waiting) {
        setUpdateReady(true);
      }

      // Listen for new SW installing → waiting
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });
    });

    // Poll for updates every 30 seconds (catches cases where update event fires late)
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) reg.update().catch(() => {});
      });
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = useCallback(() => {
    if (registration && registration.waiting) {
      // Tell the waiting SW to take control
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // Clear all caches then hard reload
    if ('caches' in window) {
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => caches.delete(key)));
      }).finally(() => {
        window.location.reload(true);
      });
    } else {
      window.location.reload(true);
    }
  }, [registration]);

  if (!updateReady || dismissed) return null;

  return (
    <div
      dir="rtl"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.6rem 1rem',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.4)',
        boxShadow: '0 2px 12px rgba(30, 58, 138, 0.35)',
        animation: 'slideDownBanner 0.3s ease-out',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
        <Zap size={16} color="#fbbf24" style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '0.82rem',
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1.3,
        }}>
          تحديث جديد متوفر — اضغط «تحديث الآن» لتفادي مسح الكاش يدوياً
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleUpdate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.38rem 0.9rem',
            borderRadius: '99px',
            border: 'none',
            background: '#ffffff',
            color: '#1e3a8a',
            fontWeight: 900,
            fontSize: '0.78rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <RefreshCw size={13} />
          تحديث الآن
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="إغلاق"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
