import { useState, useEffect, Suspense, useMemo } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import MobileInstallBanner from './MobileInstallBanner';
import PWAUpdateBanner from './PWAUpdateBanner';
import { useAuth } from '../context/AuthContext';
import WhatsAppButton from './WhatsAppButton';
import CommandPalette from './CommandPalette';
import { Crown, CheckCircle2 } from 'lucide-react';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// Routes that enter Focus Mode (no nav, full-screen)
const FOCUS_ROUTES = ['/exam', '/study'];

const LayoutLoadingFallback = () => (
  <div style={{
    width: '100%',
    height: '60vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <div style={{ position: 'relative', width: '50px', height: '50px', marginBottom: '1rem' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        border: '3px solid rgba(113, 109, 242, 0.1)',
        borderTop: '3px solid var(--violet)',
        borderRight: '3px solid var(--emerald)',
        animation: 'spinLayout 1s cubic-bezier(0.5, 0, 0.5, 1) infinite'
      }} />
    </div>
  </div>
);

export default function Layout() {
  const { user, loading, upgradedPlan, setUpgradedPlan, isOnline } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Scroll smoothly to top on mobile/desktop route changes (native app feel)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  // Generate confetti in useEffect to keep rendering phase pure and idempotent.
  const [confettiArray, setConfettiArray] = useState([]);
  useEffect(() => {
    if (upgradedPlan) {
      const colors = ['#FFC72C', '#FF5A5F', '#00A699', '#7C3AED', '#3B82F6', '#EC4899', '#F59E0B', '#10B981'];
      const array = Array.from({ length: 70 }).map(() => ({
        left: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 2.5 + Math.random() * 3.5,
        size: 10 + Math.random() * 12,
        color: colors[Math.floor(Math.random() * colors.length)],
        isStar: Math.random() > 0.6,
        borderRadius: Math.random() > 0.5 ? '50%' : '3px'
      }));
      setConfettiArray(array);
    } else {
      setConfettiArray([]);
    }
  }, [upgradedPlan]);

  // No sidebar state needed — using top nav

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(circle at center, #18181B 0%, #09090B 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        {/* Animated glowing spinner */}
        <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '1.5rem' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid rgba(113, 109, 242, 0.15)',
            borderTop: '3px solid var(--violet)',
            borderRight: '3px solid var(--emerald)',
            animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite'
          }} />
          <div style={{
            position: 'absolute',
            inset: '6px',
            borderRadius: '50%',
            background: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 12px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
              animation: 'pulse 1.8s ease-in-out infinite'
            }} />
          </div>
        </div>

        {/* Branding text */}
        <h2 style={{
          fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
          fontSize: '1.8rem',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #ffffff 30%, #a1a1aa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 0.5rem 0',
          animation: 'pulse 2.2s ease-in-out infinite'
        }}>
          L'CONQ
        </h2>
        
        <p style={{
          fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
          fontSize: '0.88rem',
          color: 'var(--text-muted)',
          letterSpacing: '0.05em',
          margin: 0,
          fontWeight: 500
        }}>
          GIMA • Préparation Digitale
        </p>

      </div>
    );
  }

  const publicPaths = ['/schools', '/study/suites-numeriques', '/exam', '/study', '/scanner', '/scan', '/national-exams'];
  const isPublicPath = publicPaths.some(p => 
    location.pathname === p || 
    location.pathname.startsWith('/schools/') || 
    location.pathname.startsWith('/exam') ||
    location.pathname.startsWith('/study') ||
    location.pathname.startsWith('/scanner') ||
    location.pathname.startsWith('/scan')
  );

  if (!user && !isPublicPath) {
    return <Navigate to="/login" replace />;
  }

  const isFocusMode = FOCUS_ROUTES.some(r => location.pathname.startsWith(r)) || location.pathname.endsWith('/edit');

  if (isFocusMode) {
    return (
      <div className="focus-layout" style={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', background: 'var(--bg-base)', color: 'var(--text-main)', transition: 'background 0.3s, color 0.3s', paddingTop: '1rem' }}>
        <PWAUpdateBanner />
        <Suspense fallback={<LayoutLoadingFallback />}>
          <Outlet />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <Sidebar />

      {/* Main content area */}
      <main className="main-content">
        {/* PWA Update Banner (prompts user to reload without manually clearing cache) */}
        <PWAUpdateBanner />
        {/* Mobile PWA Install Banner (auto-hides on desktop & when installed) */}
        {isMobile && <MobileInstallBanner />}
        {/* Offline Banner */}
        {isOnline === false && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '0.625rem 1rem',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            animation: 'slideDownBanner 0.3s ease-out',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', animation: 'pulseOffline 1.5s infinite' }} />
            <span>Mode hors ligne — Vos révisions sont enregistrées localement et seront synchronisées au retour de la connexion.</span>
          </div>
        )}
        <Suspense fallback={<LayoutLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile bottom nav — hidden on desktop via CSS */}
      <BottomNav />

      {/* Floating WhatsApp Support Button */}
      <WhatsAppButton />

      {/* ── Premium Upgrade Success Modal (Global) ── */}
      {upgradedPlan && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(255, 253, 245, 0.82)',
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem',
          animation: 'fadeIn 0.25s ease'
        }}>
          {/* Confetti container with stars and shapes */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 10001 }}>
            {confettiArray.map((item, i) => (
              <div 
                key={i}
                style={{
                  position: 'absolute',
                  top: '-30px',
                  left: `${item.left}%`,
                  fontSize: item.isStar ? `${item.size}px` : undefined,
                  color: item.isStar ? item.color : undefined,
                  width: item.isStar ? undefined : `${item.size}px`,
                  height: item.isStar ? undefined : `${item.size}px`,
                  background: item.isStar ? undefined : item.color,
                  borderRadius: item.isStar ? undefined : item.borderRadius,
                  opacity: 0.9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: `confettiFall ${item.duration}s linear ${item.delay}s infinite`,
                  pointerEvents: 'none'
                }}
              >
                {item.isStar && '★'}
              </div>
            ))}
          </div>

          <div style={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(255, 199, 44, 0.4) 0%, rgba(255, 255, 255, 0) 70%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
            zIndex: 10000
          }} />

          <div className="animate-modal" style={{
            maxWidth: '440px', width: '100%',
            padding: isMobile ? '2.25rem 1.25rem' : '3rem 2rem', position: 'relative',
            background: '#FFFFFF', 
            border: '6px solid #FFC72C', 
            borderRadius: '32px',
            boxShadow: '0 16px 0px #D97706, 0 35px 60px rgba(0, 0, 0, 0.15)',
            textAlign: 'center', zIndex: 10002,
            overflow: 'hidden'
          }}>
            {/* Center Header Wrapper with Spinning Sunburst and Crown Badge */}
            <div style={{ position: 'relative', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', zIndex: 2 }}>
              {/* Spinning Sunburst Background */}
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '360px',
                height: '360px',
                background: 'conic-gradient(from 0deg, rgba(255, 215, 0, 0.18) 0deg 18deg, transparent 18deg 36deg, rgba(255, 215, 0, 0.18) 36deg 54deg, transparent 54deg 72deg, rgba(255, 215, 0, 0.18) 72deg 90deg, transparent 90deg 108deg, rgba(255, 215, 0, 0.18) 108deg 126deg, transparent 126deg 144deg, rgba(255, 215, 0, 0.18) 144deg 162deg, transparent 162deg 180deg, rgba(255, 215, 0, 0.18) 180deg 198deg, transparent 198deg 216deg, rgba(255, 215, 0, 0.18) 216deg 234deg, transparent 234deg 252deg, rgba(255, 215, 0, 0.18) 252deg 270deg, transparent 270deg 288deg, rgba(255, 215, 0, 0.18) 288deg 306deg, transparent 306deg 324deg, rgba(255, 215, 0, 0.18) 324deg 342deg, transparent 342deg 360deg)',
                borderRadius: '50%',
                pointerEvents: 'none',
                animation: 'spinSunburst 10s linear infinite',
                zIndex: 1
              }} />
              
              {/* Crown Icon Badge */}
              <div className="upgrade-success-icon-container" style={{ position: 'relative', zIndex: 2 }}>
                <Crown size={52} color="#fff" fill="#fff" />
              </div>
            </div>

            {/* Congratulatory Text */}
            <h2 style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: isMobile ? '2rem' : '2.5rem',
              fontWeight: 900,
              background: 'linear-gradient(to bottom, #FFE875 0%, #F59E0B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              WebkitTextStroke: '2px #78350F',
              textShadow: '0 4px 0px rgba(120, 53, 15, 0.3)',
              letterSpacing: '-0.02em',
              margin: '1rem 0 0.25rem 0',
              textTransform: 'uppercase',
              position: 'relative', zIndex: 2
            }}>
              VICTOIRE ! 🎉
            </h2>
            <p style={{
              fontSize: '1.25rem',
              color: '#78350F',
              fontWeight: 800,
              margin: '0 0 1.25rem 0',
              position: 'relative', zIndex: 2
            }}>
              Accès Premium Activé
            </p>

            {/* Plan Details Summary */}
            <div style={{
              background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
              border: '3px solid #FCD34D',
              borderRadius: '20px',
              padding: '1rem',
              margin: '1.25rem 0',
              textAlign: 'center',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
              position: 'relative', zIndex: 2
            }}>
              <span style={{ 
                fontSize: '0.8rem', 
                padding: '0.25rem 0.75rem',
                background: '#FF8C00',
                color: '#fff',
                fontWeight: 900,
                borderRadius: '50px',
                textTransform: 'uppercase',
                boxShadow: '0 3px 0px #B26200',
                display: 'inline-block',
                marginBottom: '0.5rem'
              }}>
                Statut : PREMIUM 👑
              </span>
              <h4 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#78350F' }}>
                {upgradedPlan.name}
              </h4>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem', color: '#B45309', fontWeight: 700 }}>
                Durée : {upgradedPlan.durationDays} jours de préparation
              </p>
            </div>

            {/* Unlocked Features Checkmarks */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
              textAlign: 'left', marginBottom: '2rem',
              position: 'relative', zIndex: 2
            }}>
              {[
                "Accès illimité à toutes les archives (2010–2025)",
                "Astuces IA (Cheat codes) pour chaque QCM",
                "Simulateur de concours et Heatmaps des faiblesses"
              ].map((feat, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  fontSize: '0.95rem', 
                  color: '#4B5563', 
                  fontWeight: 700,
                  background: '#F9FAFB',
                  border: '2px solid #E5E7EB',
                  borderRadius: '16px',
                  padding: '0.75rem 1rem',
                  boxShadow: '0 4px 0px #E5E7EB'
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 0px #047857'
                  }}>
                    <CheckCircle2 size={16} color="#fff" />
                  </div>
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            {/* Action CTA Button */}
            <button 
              onClick={() => {
                setUpgradedPlan(null);
                navigate('/dashboard');
              }}
              className="btn btn-game"
              style={{
                width: '100%',
                padding: '1.1rem',
                fontSize: '1.25rem',
                fontWeight: 900,
                background: '#10B981',
                color: '#fff',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                position: 'relative', zIndex: 2
              }}
            >
              C'est parti ! 🚀
            </button>
          </div>
        </div>
      )}
      <CommandPalette />
    </div>
  );
}
