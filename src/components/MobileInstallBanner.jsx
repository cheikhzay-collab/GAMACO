// src/components/MobileInstallBanner.jsx
// Native-app feel PWA Install Banner for Android Chrome (1-tap install) & iOS Safari (Add to Home Screen guide).
// Automatically hides when already installed as a standalone app or dismissed by user.

import { useState, useEffect } from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';

export default function MobileInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    try {
      const ts = Number(localStorage.getItem('gamaco_install_dismissed_at') || 0);
      // Re-offer gently after 7 days
      return ts > 0 && Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setIsIos(ios);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('gamaco_install_dismissed_at', String(Date.now()));
    } catch {}
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(v => !v);
    }
  };

  // Show only on mobile when not installed, not dismissed, and either Android prompt is ready or on iOS Safari
  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIos) return null;

  return (
    <div className="mobile-install-banner" dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '11px',
            background: 'rgba(255, 255, 255, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Smartphone size={20} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.84rem', lineHeight: 1.25 }}>
            ثبّت تطبيق GAMACO على هاتفك
          </div>
          <div style={{ fontSize: '0.72rem', opacity: 0.85, lineHeight: 1.3 }}>
            {showIosGuide
              ? 'اضغط على زر المشاركة (↑) بالأسفل ثم اختر «إضافة إلى الشاشة الرئيسية»'
              : 'دخول أسرع وتجربة تطبيق كامل بدون شريط المتصفح'}
          </div>
        </div>
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleInstallClick}
          style={{
            padding: '0.42rem 0.75rem',
            borderRadius: '99px',
            border: 'none',
            background: '#ffffff',
            color: '#1e3a8a',
            fontWeight: 900,
            fontSize: '0.76rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          {isIos ? <Share size={13} /> : <Download size={13} />}
          <span>{isIos ? 'الطريقة' : 'تثبيت'}</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="إغلاق"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.16)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
