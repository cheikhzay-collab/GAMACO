import { lazy, Suspense, useTransition, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Keep only the public entry screen in the initial bundle.
import Login from './pages/Login';
import CommandPalette from './components/CommandPalette';

// Protected pages are lazy-loaded so login does not download charts, PDF tools,
// KaTeX, scanners, or admin-only dependencies.
const Layout             = lazy(() => import('./components/Layout'));
const StudentDashboard   = lazy(() => import('./pages/StudentDashboard'));
const StudyMode          = lazy(() => import('./pages/StudyMode'));
const AdminOverview      = lazy(() => import('./pages/AdminOverview'));
const AdminExams         = lazy(() => import('./pages/AdminExams'));
const AdminUpload        = lazy(() => import('./pages/AdminUpload'));
const AdminSettings      = lazy(() => import('./pages/AdminSettings'));
const MockExamMode       = lazy(() => import('./pages/MockExamMode'));
const AdminStudentDetail = lazy(() => import('./pages/AdminStudentDetail'));
const AdminEbooks        = lazy(() => import('./pages/AdminEbooks'));
const AdminExamEdit      = lazy(() => import('./pages/AdminExamEdit'));
const SuitesNumeriquesPage = lazy(() => import('./pages/SuitesNumeriquesPage'));
const AdminAIGenerator   = lazy(() => import('./pages/AdminAIGenerator'));
const AdminLessons       = lazy(() => import('./pages/AdminLessons'));
const AdminClasses       = lazy(() => import('./pages/AdminClasses'));
const AdminClassDetail   = lazy(() => import('./pages/AdminClassDetail'));
const LessonViewerPage   = lazy(() => import('./pages/LessonViewerPage'));
const AdminLessonEdit    = lazy(() => import('./pages/AdminLessonEdit'));
const AdminLogbook       = lazy(() => import('./pages/AdminLogbook'));
const LevelsPage         = lazy(() => import('./pages/LevelsPage'));
const OMRScannerPage     = lazy(() => import('./pages/OMRScannerPage'));
const RankingPage        = lazy(() => import('./pages/RankingPage'));
const AuthCallback       = lazy(() => import('./pages/AuthCallback'));
const AdminSelfLearning   = lazy(() => import('./pages/AdminSelfLearning'));
const PrintView          = lazy(() => import('./pages/PrintView'));

// ─── Route Guards ─────────────────────────────────────────────────────────────

/**
 * AdminRoute — protects all /admin/* routes.
 * Redirects non-admin users to /dashboard.
 */
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

/**
 * PrivateRoute — protects all student routes.
 * Redirects unauthenticated users to /login.
 */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * GuestRoute — prevents already-authenticated users from seeing /login.
 * Redirects admins to /admin/dashboard, students to /dashboard.
 */
function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback />;
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'} replace />;
  }
  return children;
}

/**
 * OAuthRedirectGuard — detects when OAuth provider redirected back with a hash-based
 * access_token (i.e. #access_token=...) and navigates to /dashboard once
 * the AuthContext has populated the user object.
 */
function OAuthRedirectGuard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=') && window.location.pathname !== '/auth/callback') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const wasOAuthRedirect = sessionStorage.getItem('_oauth_in_progress') === '1';
    if (user && wasOAuthRedirect) {
      sessionStorage.removeItem('_oauth_in_progress');
      const pathname = window.location.pathname;
      if (pathname === '/' || pathname === '/login' || pathname === '/register') {
        navigate(user.role === 'admin' ? '/admin/dashboard' : '/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  return null;
}

// ─── App Content ─────────────────────────────────────────────────────────────

function AppContent() {
  const location = useLocation();
  const [, startTransition] = useTransition();

  useEffect(() => {
    // Wrap title update in startTransition to avoid blocking renders
    startTransition(() => {
      const path = location.pathname;
      let title = "L'CONQ";

      if (path === '/login' || path === '/') {
        title = "Connexion — L'CONQ";
      } else if (path === '/register') {
        title = "Inscription — L'CONQ";
      } else if (path === '/dashboard') {
        title = "Tableau de Bord — L'CONQ";
      } else if (path === '/study/suites-numeriques') {
        title = "Fiche Interactive : Suites Numériques — L'CONQ";
      } else if (path === '/study') {
        title = "Mode Révision (SRS) — L'CONQ";
      } else if (path === '/exam') {
        title = "Examen Blanc Chronométré — L'CONQ";
      } else if (path === '/scanner') {
        title = "Scanner Intelligent OMR — L'CONQ";
      } else if (path === '/ranking') {
        title = "Classement — L'CONQ";
      } else if (path === '/admin/dashboard') {
        title = "Admin : Vue d'ensemble — L'CONQ";
      } else if (path === '/admin/exams') {
        title = "Admin : Bibliothèque Examens — L'CONQ";
      } else if (path.startsWith('/admin/exams/') && path.endsWith('/edit')) {
        title = "Admin : Édition de l'Examen — L'CONQ";
      } else if (path === '/admin/users') {
        title = "Admin : Gestion des Élèves — L'CONQ";
      } else if (path.startsWith('/admin/users/')) {
        title = "Admin : Dossier de l'Élève — L'CONQ";
      } else if (path === '/admin/upload') {
        title = "Admin : Upload de Sujets — L'CONQ";
      } else if (path === '/admin/ai-import' || path === '/admin/ai-lessons' || path === '/admin/ai-generator' || path === '/admin/ai-exercises') {
        title = "Admin : Générateur de Contenu IA — L'CONQ";
      } else if (path === '/admin/lessons') {
        title = "Admin : Fiches de Cours — L'CONQ";
      } else if (path === '/levels') {
        title = "Niveaux & Cours — L'CONQ";
      } else if (path.startsWith('/admin/lessons/') && path.endsWith('/edit')) {
        title = "Admin : Édition de la Fiche — L'CONQ";
      } else if (path.startsWith('/admin/lessons/')) {
        title = "Fiche Interactive — L'CONQ";
      } else if (path === '/admin/ebooks') {
        title = "Admin : Générateur d'E-Books — L'CONQ";
      } else if (path === '/admin/settings') {
        title = "Admin : Paramètres Système — L'CONQ";
      } else if (path === '/admin/logbook') {
        title = "Admin : Cahier de Textes — L'CONQ";
      } else if (path === '/admin/classes') {
        title = "Admin : Gestion des Classes — L'CONQ";
      }

      document.title = title;
    });
  }, [location, startTransition]);

  return (
    <>
      <CommandPalette />
      <OAuthRedirectGuard />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public routes — redirect to login if already authenticated */}
          <Route path="/" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/print" element={<PrintView />} />

          {/* Protected student routes inside Layout */}
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            {/* Student Routes */}
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/study" element={<StudyMode />} />
            <Route path="/study/suites-numeriques" element={<SuitesNumeriquesPage />} />
            <Route path="/exam" element={<MockExamMode />} />
            <Route path="/levels" element={<LevelsPage />} />
            <Route path="/scanner" element={<OMRScannerPage />} />
            <Route path="/scan" element={<Navigate to="/scanner" replace />} />
            <Route path="/ranking" element={<RankingPage />} />

            {/* Admin-only Routes — wrapped with AdminRoute guard */}
            <Route path="/admin/dashboard" element={<AdminRoute><AdminOverview /></AdminRoute>} />
            <Route path="/admin/exams" element={<AdminRoute><AdminExams /></AdminRoute>} />
            <Route path="/admin/exams/:id/edit" element={<AdminRoute><AdminExamEdit /></AdminRoute>} />
            <Route path="/admin/classes" element={<AdminRoute><AdminClasses /></AdminRoute>} />
            <Route path="/admin/classes/:id" element={<AdminRoute><AdminClassDetail /></AdminRoute>} />
            <Route path="/admin/users/:id" element={<AdminRoute><AdminStudentDetail /></AdminRoute>} />
            <Route path="/admin/upload" element={<AdminRoute><AdminUpload /></AdminRoute>} />
            <Route path="/admin/ai-generator" element={<AdminRoute><AdminAIGenerator /></AdminRoute>} />
            <Route path="/admin/ai-exercises" element={<AdminRoute><AdminAIGenerator /></AdminRoute>} />
            <Route path="/admin/ai-import" element={<AdminRoute><AdminAIGenerator /></AdminRoute>} />
            <Route path="/admin/ai-lessons" element={<AdminRoute><AdminAIGenerator /></AdminRoute>} />
            <Route path="/admin/lessons" element={<AdminRoute><AdminLessons /></AdminRoute>} />
            {/* [M-2 FIX] Both admin/lessons/:id routes now require AdminRoute */}
            <Route path="/admin/lessons/:id" element={<AdminRoute><LessonViewerPage /></AdminRoute>} />

            <Route path="/lessons/:id" element={<LessonViewerPage />} />
            <Route path="/admin/lessons/:id/edit" element={<AdminRoute><AdminLessonEdit /></AdminRoute>} />
            <Route path="/admin/ebooks" element={<AdminRoute><AdminEbooks /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
            <Route path="/admin/logbook" element={<AdminRoute><AdminLogbook /></AdminRoute>} />
            <Route path="/admin/self-learning" element={<AdminRoute><AdminSelfLearning /></AdminRoute>} />
          </Route>

          {/* Fallback — redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

// ─── Loading Fallback ──────────────────────────────────────────────────────────

const LoadingFallback = () => (
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
    <div style={{ position: 'relative', width: '60px', height: '60px', marginBottom: '1.2rem' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        border: '3px solid rgba(113, 109, 242, 0.15)',
        borderTop: '3px solid var(--violet)',
        borderRight: '3px solid var(--emerald)',
        animation: 'spinApp 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite'
      }} />
    </div>
    <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, margin: 0, fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>
      L'CONQ
    </h3>
  </div>
);

// ─── Root App ──────────────────────────────────────────────────────────────────

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
