import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck, Sparkles, BookOpen, UserCheck } from 'lucide-react';
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
          setSuccessMsg("Compte créé avec succès ! Veuillez vérifier votre boîte e-mail.");
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
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col lg:flex-row antialiased selection:bg-indigo-500/30 selection:text-white">
      {/* ── Left Editorial Showcase (Visible on Desktop) ── */}
      <section className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-12 xl:p-16 relative border-r border-zinc-800/80 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950 overflow-hidden">
        {/* Subtle architectural grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a0f_1px,transparent_1px),linear-gradient(to_bottom,#27272a0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <Link to="/" className="inline-block hover:opacity-90 transition">
            <LconqLogo size={42} textSize="1.65rem" />
          </Link>
          
          <div className="space-y-3 pt-8">
            <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">
              Concours Médecine & Baccalauréat Maroc
            </span>
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-zinc-100 text-balance leading-snug">
              L'excellence pédagogique propulsée par la répétition espacée.
            </h2>
            <p className="text-sm xl:text-base text-zinc-400 leading-relaxed max-w-md">
              Révisez avec la banque officielle nationale 2010–2026, simulez les concours chronométrés et identifiez instantanément vos axes de remédiation.
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="relative z-10 grid grid-cols-1 gap-4 pt-10">
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 flex-shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-200">Algorithme SRS Anki-Grade</h4>
              <p className="text-xs text-zinc-400 mt-0.5">Consolidation mnésique à long terme basée sur la courbe d'oubli d'Ebbinghaus.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-200">Barème Officiel des Concours</h4>
              <p className="text-xs text-zinc-400 mt-0.5">Calcul strict des notes avec pénalités (-0.25 pt par erreur) et classements en temps réel.</p>
            </div>
          </div>
        </div>

        {/* Quiet Footer Note */}
        <div className="relative z-10 pt-8 border-t border-zinc-800/60 text-xs text-zinc-500 flex justify-between items-center">
          <span>Plateforme nationale L'CONQ Maroc</span>
          <span className="font-mono text-[11px] text-zinc-600">v2.4.0 • 2026-2027</span>
        </div>
      </section>

      {/* ── Right Authentication Area ── */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Header Logo */}
          <div className="lg:hidden flex justify-center pb-2">
            <LconqLogo size={36} textSize="1.45rem" />
          </div>

          {/* Form Header */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-100">
              {isRegistering ? 'Rejoindre L\'CONQ' : 'Connexion à votre espace'}
            </h1>
            <p className="text-sm text-zinc-400">
              {isRegistering 
                ? 'Préparez vos concours avec le programme officiel marocain.' 
                : 'Entrez vos identifiants pour continuer vos révisions.'}
            </p>
          </div>

          {/* Segmented Auth Mode Switch */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              type="button"
              onClick={() => { navigate('/login'); setErrorMsg(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                !isRegistering 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => { navigate('/register'); setErrorMsg(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                isRegistering 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Alert Messages */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Primary Auth Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isRegistering && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Nom Complet</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Youssef Alaoui"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Adresse E-mail</label>
              <input
                type="email"
                required
                placeholder="votre.email@domaine.ma"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-zinc-300">Mot de passe</label>
                {!isRegistering && (
                  <span className="text-[11px] text-zinc-500 hover:text-indigo-400 cursor-pointer">
                    Mot de passe oublié ?
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-zinc-900/80 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegistering ? 'Créer mon compte' : 'Accéder à mes cours'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login Bar for Testing */}
          <div className="pt-6 border-t border-zinc-800/80 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold text-center">
              Accès Démo Rapide (1-Clic)
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('youssef@massar.ma', 'student123')}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Compte Élève</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin@lconq.ma', 'admin123')}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Compte Directeur</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
