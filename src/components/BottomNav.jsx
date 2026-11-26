import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Trophy, GraduationCap,
  Library, Users, UploadCloud, LogOut, Sun, Moon, Camera, Zap, Settings,
  ClipboardList, Sparkles, FileText, BookMarked, Layers, Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const { user, logout, theme, toggleTheme, dueTodayCount } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const indicatorRef = useRef(null);
  const navRef       = useRef(null);
  const [showSheet, setShowSheet] = useState(false);

  const isStudent = user?.role === 'student';
  const isAdmin   = user?.role === 'admin' || user?.role === 'prof' || user?.role === 'teacher';
  const dueToday  = isStudent ? (dueTodayCount || 0) : 0;

  const studentItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Accueil'  },
    { to: '/levels',    icon: Library,         label: 'Cours'    },
    { to: '/study',     icon: BookOpen,        label: 'Révision' },
    { to: '/scanner',   icon: Camera,          label: 'Scanner'  },
  ];

  const adminItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Accueil' },
    { to: '/admin/lessons',   icon: FileText,        label: 'Cours'   },
    { to: '/admin/logbook',   icon: ClipboardList,   label: 'Cahier'  },
    { to: '/admin/classes',   icon: Users,           label: 'Classes' },
  ];

  const guestItems = [
    { to: '/national-exams', icon: Award,         label: 'Nationaux' },
    { to: '/levels',         icon: GraduationCap, label: 'Niveaux'   },
  ];

  const items = !user ? guestItems : (isStudent ? studentItems : adminItems);

  /* Sliding pill indicator */
  useEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    const activeEl = nav.querySelector('.mob-nav-item.active');
    if (!activeEl) {
      indicator.style.opacity = '0';
      return;
    }
    indicator.style.opacity = '1';
    const navRect  = nav.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();
    indicator.style.transform = `translateX(${itemRect.left - navRect.left + (itemRect.width - 40) / 2}px)`;
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/'); setShowSheet(false); };

  /* Avatar initial */
  const initial = (user?.name || user?.email || '?')[0].toUpperCase();

  const adminTools = [
    { label: 'Examens Nationaux', icon: Award, to: '/admin/national-exams', color: '#D97706', bg: 'rgba(217, 119, 6, 0.15)' },
    { label: 'Upload PDF', icon: UploadCloud, to: '/admin/upload', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
    { label: 'Import IA', icon: Sparkles, to: '/admin/ai-generator', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
    { label: 'Leçons', icon: FileText, to: '/admin/lessons', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)' },
    { label: 'Classes', icon: Users, to: '/admin/classes', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
    { label: 'Cahier Textes', icon: ClipboardList, to: '/admin/logbook', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
    { label: 'Banque QCM', icon: GraduationCap, to: '/admin/exams', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
    { label: 'Scanner OMR', icon: Camera, to: '/scanner', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
    { label: 'E-books', icon: BookMarked, to: '/admin/ebooks', color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.12)' },
    { label: 'Niveaux', icon: Layers, to: '/levels', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
    { label: 'Settings', icon: Settings, to: '/admin/settings', color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)' },
  ];

  const studentTools = [
    { label: 'Accueil', icon: LayoutDashboard, to: '/dashboard', color: '#716DF2', bg: 'rgba(113, 109, 242, 0.12)' },
    { label: 'Examens Nationaux', icon: Award, to: '/national-exams', color: '#D97706', bg: 'rgba(217, 119, 6, 0.15)' },
    { label: 'Cours', icon: Layers, to: '/levels', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
    { label: 'Scanner OMR', icon: Camera, to: '/scanner', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
    { label: 'Révision SRS', icon: BookOpen, to: '/study', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)' },
    { label: 'Classement', icon: Trophy, to: '/ranking', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
    { label: 'Fiche IA', icon: Sparkles, to: '/study/suites-numeriques', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  ];

  return (
    <>
      {/* ── Bottom navigation bar ── */}
      <nav className="mobile-bottom-nav" aria-label="Navigation principale">
        <div className="mob-nav-indicator" ref={indicatorRef} />

        <div className="mob-nav-items" ref={navRef}>
          {items.map(({ to, icon: Icon, label }) => {
            const showBadge = to === '/study' && isStudent && dueToday > 0;
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `mob-nav-item${isActive ? ' active' : ''}`}
                end={to === '/dashboard' || to === '/admin/dashboard'}
              >
                <div className="mob-nav-icon-wrap" style={{ position: 'relative' }}>
                  <Icon size={21} strokeWidth={2} />
                  {showBadge && (
                    <span className="mob-nav-badge">
                      {dueToday}
                    </span>
                  )}
                </div>
                <span className="mob-nav-label">{label}</span>
              </NavLink>
            );
          })}

          {/* Custom Avatar / Menu trigger tab */}
          {user?.role === 'admin' ? (
            <button
              className={`mob-nav-item${showSheet ? ' active' : ''}`}
              onClick={() => setShowSheet(true)}
              title="Plus d'outils"
              aria-label="Plus d'outils"
            >
              <div className="mob-nav-icon-wrap">
                <Zap size={21} strokeWidth={2} className={showSheet ? 'text-violet' : ''} />
              </div>
              <span className="mob-nav-label">Plus</span>
            </button>
          ) : (
            <button
              className={`mob-nav-item${showSheet ? ' active' : ''}`}
              onClick={() => setShowSheet(true)}
              title="Mon compte & paramètres"
              aria-label="Mon compte & paramètres"
              style={{ position: 'relative' }}
            >
              <div className="mob-nav-icon-wrap" style={{ position: 'relative' }}>
                {/* Avatar circle */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72rem', fontWeight: 900, color: '#fff',
                  border: '2px solid rgba(255,255,255,0.16)',
                }}>
                  {initial}
                </div>
              </div>
              <span className="mob-nav-label">Compte</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── Profile / Logout bottom sheet ── */}
      {showSheet && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowSheet(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 450,
              background: 'rgba(2, 6, 23, 0.6)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          {/* Sheet */}
          <div
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 460,
              background: 'var(--bg-card)',
              borderRadius: '1.75rem 1.75rem 0 0',
              border: '1px solid var(--border)',
              borderBottom: 'none',
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 -12px 48px rgba(0,0,0,0.4)',
              animation: 'sheetSlideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* Drag handle */}
            <div style={{
              width: 40, height: 4, borderRadius: 99,
              background: 'var(--border)',
              margin: '0.875rem auto 0',
            }} />

            {!user ? (
              <div style={{ padding: '1.75rem 1.5rem 1.25rem', textAlign: 'center' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Rejoignez L'CONQ</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  Créez un compte pour suivre votre progression, réviser avec l'algorithme SRS et participer au classement national.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <button
                    onClick={() => { navigate('/login'); setShowSheet(false); }}
                    className="btn"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, var(--violet), #818cf8)',
                      fontWeight: 800,
                      padding: '0.875rem',
                      borderRadius: 'var(--radius-lg)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                    }}
                  >
                    Se connecter / S'inscrire
                  </button>
                  <button
                    onClick={() => { toggleTheme(); setShowSheet(false); }}
                    className="btn-outline"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    {theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ── User Info Header ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '1.25rem 1.5rem 1.125rem',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '14px', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.35rem', fontWeight: 900, color: '#fff',
                    boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                  }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontWeight: 850, fontSize: '1rem', margin: 0,
                      color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {user?.name || (isAdmin ? 'Administrateur Local' : 'Élève')}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.email}
                    </p>
                  </div>
                  <span style={{
                    padding: '0.25rem 0.65rem', borderRadius: 99,
                    fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: isAdmin ? 'rgba(16, 185, 129, 0.12)' : 'var(--violet-soft)',
                    color: isAdmin ? 'var(--emerald)' : 'var(--violet)',
                    border: `1px solid ${isAdmin ? 'rgba(16, 185, 129, 0.22)' : 'rgba(99, 102, 241, 0.22)'}`,
                    flexShrink: 0
                  }}>
                    {isAdmin ? 'Directeur' : 'Élève'}
                  </span>
                </div>

                {/* ── Platform Tools Grid ── */}
                <div style={{
                  padding: '1.25rem 1.5rem 0.75rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.85rem',
                }}>
                  {(isAdmin ? adminTools : studentTools).map((tool, idx) => {
                    const ToolIcon = tool.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => { navigate(tool.to); setShowSheet(false); }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.85rem 0.25rem',
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border)',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          width: '100%',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '13px',
                          background: tool.bg,
                          color: tool.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        }}>
                          <ToolIcon size={21} strokeWidth={2} />
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: 'var(--text-main)',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                        }}>
                          {tool.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* ── Actions (Common to both student and admin) ── */}
                <div style={{ padding: '0.875rem 1.25rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                  {/* Theme toggle */}
                  <button
                    onClick={toggleTheme}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.875rem',
                      padding: '0.875rem 1rem',
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer', width: '100%',
                      fontFamily: 'inherit', textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                      background: 'var(--bg-hover)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {theme === 'dark'
                        ? <Sun  size={19} color="var(--warning)" />
                        : <Moon size={19} color="var(--violet)"  />
                      }
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.93rem', color: 'var(--text-main)', flex: 1 }}>
                      {theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                    </span>
                  </button>

                  {/* ── Logout ── */}
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.875rem',
                      padding: '0.875rem 1rem',
                      background: 'var(--danger-soft)',
                      border: '1px solid rgba(239,68,68,0.22)',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer', width: '100%',
                      fontFamily: 'inherit', textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                      background: 'rgba(239,68,68,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <LogOut size={19} color="var(--danger)" />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--danger)', flex: 1 }}>
                      Se déconnecter
                    </span>
                  </button>

                  {/* Cancel */}
                  <button
                    onClick={() => setShowSheet(false)}
                    style={{
                      padding: '0.75rem', background: 'transparent', border: 'none',
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)',
                      fontFamily: 'inherit', marginTop: '0.125rem',
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
