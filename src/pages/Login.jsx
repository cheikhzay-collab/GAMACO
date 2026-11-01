import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Zap, AlertCircle, Check, Clock, UserCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LconqLogo from '../components/LconqLogo';

export default function Login() {
  const location = useLocation();
  const isRegistering = location.pathname === '/register';
  const queryParams = new URLSearchParams(location.search);
  const isExpired = queryParams.get('expired') === '1';
  const isInactive = queryParams.get('inactive') === '1';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleAuthSubmit = async (e) => {
    e?.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isRegistering) {
        if (!name.trim()) throw new Error('Veuillez saisir votre nom complet.');
        const newUser = await register(name.trim(), email, password);
        if (newUser && newUser.needsConfirmation) {
          setSuccessMsg("Compte créé avec succès ! Un e-mail de confirmation vous a été envoyé. Veuillez cliquer sur le lien dans l'e-mail pour activer votre compte.");
          setIsLoading(false);
          return;
        }
        navigate('/dashboard');
      } else {
        const loggedUser = await login(email, password);
        navigate(loggedUser?.role === 'admin' ? '/admin/dashboard' : '/dashboard');
      }
    } catch (err) {
      console.error('[Auth] Error:', err);
      let msg = err.message || 'Une erreur est survenue.';
      if (msg.includes('Invalid login credentials') || msg.includes('Identifiants incorrects')) {
        msg = 'Identifiants invalides. Veuillez vérifier votre e-mail et mot de passe.';
      } else if (msg.includes('already exists') || msg.includes('déjà enregistrée')) {
        msg = 'Cette adresse e-mail est déjà enregistrée. Veuillez vous connecter.';
      } else if (msg.includes('Password should be at least')) {
        msg = 'Le mot de passe doit contenir au moins 6 caractères.';
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('[Auth] Google Error:', err);
      let msg = err.message || 'Une erreur est survenue lors de la connexion Google.';
      setErrorMsg(msg);
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setIsLoading(true);
    setErrorMsg('');
    login(demoEmail, demoPass)
      .then((loggedUser) => {
        navigate(loggedUser?.role === 'admin' ? '/admin/dashboard' : '/dashboard');
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Erreur de connexion démo');
        setIsLoading(false);
      });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-base)',
      color: 'var(--text-main)',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* ── Left — decorative panel (hidden on mobile via CSS) ── */}
      <div style={{
        flex: '0 0 42%',
        background: 'linear-gradient(145deg, var(--violet) 0%, #312e81 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        position: 'relative',
        overflow: 'hidden'
      }} className="login-left-panel">
        {/* Ambient blobs */}
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: '#fff', maxWidth: 360 }}>
          <LconqLogo 
            size={64} 
            textSize="2.2rem" 
            variant="light"
            style={{ 
              flexDirection: 'column', 
              gap: '1rem', 
              marginBottom: '1.5rem',
              justifyContent: 'center' 
            }} 
          />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#fff' }}>
            L'excellence pédagogique
          </h2>
          <p style={{ opacity: 0.85, fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 2rem 0' }}>
            La plateforme de préparation aux concours propulsée par l'IA — Médecine, ENSA, ENSAM.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left', background: 'rgba(0,0,0,0.15)', padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-lg)' }}>
            {[
              'Algorithme SRS Anki-Grade (Répétition espacée)',
              'Banque nationale officielle 2010–2026',
              'Barème strict des concours et classement direct',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.88rem', opacity: 0.95 }}>
                <Zap size={16} color="#34d399" style={{ flexShrink: 0 }} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right — auth form ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(1.5rem, 5vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          {/* Mobile-only Logo */}
          <div className="login-mobile-logo" style={{ display: 'none', marginBottom: '1.75rem', justifyContent: 'center' }}>
            <LconqLogo size={42} textSize="1.5rem" />
          </div>

          {/* Back link */}
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '1.5rem', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            ← Retour à l'accueil
          </Link>

          <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 800, marginBottom: '0.4rem', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
            {isRegistering ? 'Rejoindre L\'CONQ' : 'Connexion à votre espace'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.92rem' }}>
            {isRegistering ? 'Préparez vos concours avec le programme officiel marocain.' : 'Entrez vos identifiants pour continuer vos révisions.'}
          </p>

          {/* Clean Tab Selector */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => { navigate('/login'); setErrorMsg(''); }}
              style={{
                flex: 1,
                padding: '0.75rem 0',
                background: 'none',
                border: 'none',
                borderBottom: !isRegistering ? '2px solid var(--violet)' : '2px solid transparent',
                color: !isRegistering ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => { navigate('/register'); setErrorMsg(''); }}
              style={{
                flex: 1,
                padding: '0.75rem 0',
                background: 'none',
                border: 'none',
                borderBottom: isRegistering ? '2px solid var(--violet)' : '2px solid transparent',
                color: isRegistering ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Inscription
            </button>
          </div>

          {/* Session Expiry or Inactivity Alert */}
          {(isExpired || isInactive) && !errorMsg && !successMsg && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              padding: '0.875rem 1rem',
              borderRadius: '12px',
              color: '#d97706',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              marginBottom: '1.25rem'
            }}>
              <Clock size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>
                {isExpired 
                  ? "Votre session a expiré. Veuillez vous reconnecter."
                  : "Déconnexion automatique après 30 minutes d'inactivité."}
              </span>
            </div>
          )}

          {/* Error Alert Display */}
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '0.875rem 1rem',
              borderRadius: '12px',
              color: 'var(--danger)',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{errorMsg}</span>
            </div>
          )}

          {/* Success Alert Display */}
          {successMsg && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '0.875rem 1rem',
              borderRadius: '12px',
              color: 'var(--emerald)',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem'
            }}>
              <Check size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {isRegistering && (
              <div className="input-group">
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Nom complet</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ex: Youssef Alaoui"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isLoading}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div className="input-group">
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Adresse email</label>
              <input
                type="email"
                className="input-control"
                placeholder="votre@email.ma"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Mot de passe</label>
                {!isRegistering && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', cursor: 'pointer' }}>
                    Mot de passe oublié ?
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  style={{ paddingRight: '3rem', width: '100%', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  disabled={isLoading}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.875rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-md)',
                marginTop: '0.5rem',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Opération en cours...' : isRegistering ? "S'inscrire" : 'Se connecter'}
            </button>
          </form>

          {/* Quick Demo Login Bar */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', fontWeight: 700, marginBottom: '0.75rem', textAlign: 'center' }}>
              Accès Démo Rapide (1-Clic)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleQuickLogin('youssef@massar.ma', 'student123')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-glass)', border: '1px solid var(--border)',
                  color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--emerald)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-glass)'; }}
              >
                <UserCheck size={15} color="var(--emerald)" />
                <span>Compte Élève</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin@lconq.ma', 'admin123')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-glass)', border: '1px solid var(--border)',
                  color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--violet)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-glass)'; }}
              >
                <ShieldCheck size={15} color="var(--violet)" />
                <span>Compte Directeur</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.875rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600 }}>OU</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: 'var(--bg-glass)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--border-hover)';
              e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--bg-glass)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6-4.53z" fill="#EA4335" />
            </svg>
            Continuer avec Google
          </button>

        </div>
      </div>
    </div>
  );
}
