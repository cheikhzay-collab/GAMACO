import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, Sparkles, FileText,
  BookMarked, Camera, GraduationCap, FileUp, Layers, Settings,
  Trophy, BookOpen, Sun, Moon, LogOut, Menu, X, ChevronLeft, ChevronRight,
  BrainCircuit
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LconqLogo from './LconqLogo';

// ─── NAV ITEM COMPONENT ────────────────────────────────────────────────────────
const SidebarNavItem = ({ to, icon: Icon, label, collapsed }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `sidebar-nav-item${isActive ? ' sidebar-nav-item--active' : ''}`}
    title={collapsed ? label : undefined}
  >
    <span className="sidebar-nav-item__icon">
      <Icon size={19} />
    </span>
    {!collapsed && <span className="sidebar-nav-item__label">{label}</span>}
  </NavLink>
);

// ─── MAIN VERTICAL SIDEBAR COMPONENT ──────────────────────────────────────────
export default function Sidebar() {
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isStudent = user?.role === 'student';
  const isAdmin   = user?.role === 'admin';

  const adminLinks = [
    { to: '/admin/dashboard',      icon: LayoutDashboard, label: 'Tableau de bord'   },
    { to: '/admin/classes',        icon: Users,           label: 'Classes'           },
    { to: '/admin/logbook',        icon: ClipboardList,   label: 'Cahier de textes'  },
    { to: '/admin/ai-generator',   icon: Sparkles,        label: 'Générateur IA'     },
    { to: '/admin/lessons',        icon: FileText,        label: 'Fiches de cours'   },
    { to: '/admin/exams',          icon: GraduationCap,   label: 'Banque QCM'        },
    { to: '/admin/upload',         icon: FileUp,          label: 'Upload QCM'        },
    { to: '/scanner',              icon: Camera,          label: 'Scanner OMR'       },
    { to: '/admin/ebooks',         icon: BookMarked,      label: 'E-Books'           },
    { to: '/levels',               icon: Layers,          label: 'Niveaux'           },
    { to: '/admin/self-learning',  icon: BrainCircuit,    label: 'Auto-Formation'    },
    { to: '/admin/settings',       icon: Settings,        label: 'Paramètres'        },
  ];

  const studentLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Accueil'     },
    { to: '/levels',    icon: Layers,          label: 'Cours'       },
    { to: '/scanner',   icon: Camera,          label: 'Scanner'     },
    { to: '/study',     icon: BookOpen,        label: 'Révision'    },
    { to: '/ranking',   icon: Trophy,          label: 'Classement'  },
  ];

  const guestLinks = [
    { to: '/levels', icon: Layers, label: 'Niveaux' },
  ];

  const links = isAdmin ? adminLinks : isStudent ? studentLinks : guestLinks;

  return (
    <>
      {/* Mobile Top Header Toggle (visible on small screens) */}
      <div className="mobile-header">
        <button
          className="mobile-header__toggle"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="mobile-header__logo" onClick={() => navigate('/')}>
          <LconqLogo size={26} textSize="1rem" />
        </div>
        <button className="mobile-header__icon-btn" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Vertical Fixed Sidebar */}
      <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}${mobileOpen ? ' sidebar--mobile-open' : ''}`}>
        
        {/* Sidebar Header: Logo & Collapse Button */}
        <div className="sidebar__header">
          <div className="sidebar__logo" onClick={() => navigate('/')} title="L'CONQ">
            <LconqLogo size={32} textSize={collapsed ? '0' : '1.15rem'} />
          </div>
          <button
            className="sidebar__collapse-btn"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Déplier la barre' : 'Réduire la barre'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="sidebar__nav" onClick={() => setMobileOpen(false)}>
          {links.map(link => (
            <SidebarNavItem
              key={link.to}
              to={link.to}
              icon={link.icon}
              label={link.label}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Sidebar Footer: User Profile, Theme & Logout */}
        <div className="sidebar__footer">
          {/* User Info Card */}
          {user && (
            <div className="sidebar__user" title={user.name}>
              <div className="sidebar__avatar">
                {user.name?.[0]?.toUpperCase() || 'P'}
              </div>
              {!collapsed && (
                <div className="sidebar__user-info">
                  <div className="sidebar__user-name">{user.name}</div>
                  <span className={`badge ${isAdmin ? 'badge-emerald' : 'badge-free'}`}>
                    {isAdmin ? 'Professeur' : 'Élève'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions Row */}
          <div className="sidebar__footer-actions">
            <button
              className="sidebar__footer-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              {!collapsed && <span>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>}
            </button>

            {user && (
              <button
                className="sidebar__footer-btn sidebar__footer-btn--danger"
                onClick={handleLogout}
                title="Déconnexion"
              >
                <LogOut size={17} />
                {!collapsed && <span>Déconnexion</span>}
              </button>
            )}
          </div>
        </div>

      </aside>
    </>
  );
}
