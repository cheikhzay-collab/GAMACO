import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Trophy, Flame, Target, BrainCircuit,
  Zap, Camera, CheckCircle2,
  FileText, GraduationCap,
  Play, ArrowRight, BarChart3
} from 'lucide-react';

import OnboardingModal from '../components/dashboard/OnboardingModal';
import WeeklyActivityChart from '../components/dashboard/WeeklyActivityChart';
import MockExamHistoryList from '../components/dashboard/MockExamHistoryList';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import ModernExamRunner from '../components/ModernExamRunner';

export default function StudentDashboard() {
  const { 
    user, 
    exams, 
    getStudentStats, 
    mockExamHistory, 
    profName, 
    profPhone, 
    profSite, 
    updateProfile,
    trackDownload,
    loadExamQuestions,
    loading: authLoading,
    supabaseEnabled
  } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();
  
  const stats = useMemo(() => getStudentStats(), [getStudentStats]);
  const [toastMessage, setToastMessage] = useState(null);
  const [activeQuickExam, setActiveQuickExam] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !!(user && user.role === 'student' && (!user.phone || !user.city || !user.school));
  });

  // Auto-trigger onboarding if fields are empty
  useEffect(() => {
    const shouldShow = !!(user && user.role === 'student' && (!user.phone || !user.city || !user.school));
    if (shouldShow !== showOnboarding) {
      const timer = setTimeout(() => {
        setShowOnboarding(shouldShow);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, showOnboarding]);

  const handleOnboardingSubmit = useCallback(async ({ phone, city, school }) => {
    await updateProfile({ phone, city, school });
    setShowOnboarding(false);
  }, [updateProfile]);

  useEffect(() => {
    if (location.state?.partialSave) {
      const count = location.state.count || 0;
      const message = `Session enregistrée ! Progression sauvegardée sur ${count} fiches révisées.`;
      
      const timer = setTimeout(() => {
        setToastMessage(message);
        navigate(location.pathname, { replace: true, state: {} });
      }, 0);
      
      const dismissTimer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(dismissTimer);
      };
    }
  }, [location, navigate]);

  const handleDownloadReport = useCallback(async (item) => {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
    const win = !isMobile ? window.open('', '_blank') : null;
    if (win) {
      win.document.write('<html><head><title>Génération du PDF...</title></head><body style="background:#09090b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;padding:20px;text-align:center;"><div><h3 style="margin:0 0 10px 0;">L\'CONQ</h3><p style="margin:0;color:#a1a1aa;font-size:0.9rem;">Génération de votre bulletin PDF en cours...</p></div></body></html>');
    }

    try {
      let exam = exams.find(e => e.id === item.examId);
      if (!exam && supabaseEnabled && item.examId) {
        try {
          const { getExamById } = await import('../services/examService');
          exam = await getExamById(item.examId);
        } catch (err) {
          console.warn('[StudentDashboard] Failed to fetch exam:', err);
        }
      }

      if (!exam) {
        exam = {
          id: item.examId || 'fallback',
          name: item.examName || "Examen Blanc",
          school: item.school || "—",
          year: item.date ? new Date(item.date).getFullYear().toString() : "—",
          questions: Array.from({ length: item.maxScore || 20 }, (_, i) => ({
            id: `q-${i + 1}`,
            question: `Question ${i + 1}`,
            correct_answer: '—',
            topic: 'Général'
          }))
        };
      }
      
      let questions = exam.questions;
      if (!questions || questions.length === 0) {
        try {
          questions = await loadExamQuestions(exam.id);
        } catch (_err) {
          questions = Array.from({ length: item.maxScore || 20 }, (_, i) => ({
            id: `q-${i + 1}`,
            question: `Question ${i + 1}`,
            correct_answer: '—',
            topic: 'Général'
          }));
        }
      }
      
      const totalQuestions = questions.length;
      const indices = Array.from({ length: totalQuestions }, (_, i) => i);
      const statusMap = {};
      let c = item.correctCount || 0;
      let w = item.wrongCount || 0;
      
      indices.forEach(idx => {
        if (c > 0) { statusMap[idx] = 'correct'; c--; }
        else if (w > 0) { statusMap[idx] = 'wrong'; w--; }
        else { statusMap[idx] = 'empty'; }
      });
  
      const corrected = (questions || []).map((q, idx) => ({
        index: idx + 1,
        question: q.question,
        topic: q.topic || 'Général',
        correctAnswer: q.correct_answer || 'A',
        studentAnswer: statusMap[idx] === 'correct' ? (q.correct_answer || 'A') : (statusMap[idx] === 'wrong' ? 'B' : '—'),
        isCorrect: statusMap[idx] === 'correct',
        isWrong: statusMap[idx] === 'wrong',
        isEmpty: statusMap[idx] === 'empty'
      }));

      const wrongPenalty = 0.25;
      const scoreObj = {
        pts: item.score,
        neg: (item.wrongCount || 0) * wrongPenalty,
        max: item.maxScore,
        pct: item.pct
      };
      
      const settings = {
        profName: profName || '',
        profPhone: profPhone || '',
        profSite: profSite || 'www.lconq.ma'
      };
      
      const { generateStudentReportHTML, openPrintWindow } = await import('../utils/generateExamPDF');
      const html = generateStudentReportHTML({ ...exam, questions }, scoreObj, corrected, settings);
      localStorage.setItem('print_html', html);
      openPrintWindow(html, `bulletin-${exam.name.toLowerCase().replace(/\s+/g, '-')}`, win);
  
      if (trackDownload) {
        trackDownload({
          type: 'report',
          id: item.examId || 'unknown',
          title: `Bulletin : ${item.examName || 'Examen Blanc'}`
        });
      }
    } catch (err) {
      console.error('Failed to generate student report:', err);
      alert('Erreur de génération : ' + (err.message || err));
      if (win) {
        try { win.close(); } catch {}
      }
    }
  }, [exams, profName, profPhone, profSite, loadExamQuestions, trackDownload, supabaseEnabled]);

  const handlePrintWeakTopics = useCallback(async () => {
    if (!stats.weakTopics || stats.weakTopics.length === 0) return;
    const topicsToPrint = stats.weakTopics.map(t => t.name);
    const activeExams = exams.filter(e => e.isActive && !e.isArchived);

    const questionsToPrint = [];
    activeExams.forEach(exam => {
      (exam.questions || []).forEach(q => {
        const t = q.subject || q.topic || 'Général';
        if (topicsToPrint.includes(t)) {
          questionsToPrint.push({
            ...q,
            _source: exam.name,
            _year: exam.year
          });
        }
      });
    });

    if (questionsToPrint.length === 0) {
      alert("Aucune question trouvée pour vos axes de révision.");
      return;
    }

    const s = {
      showCover: true,
      showTricks: true,
      showPageNumbers: true,
      startPage: 1,
      questionsPerPage: 3,
      profName: profName || '',
      profPhone: profPhone || '',
      profSite: profSite || 'www.lconq.ma'
    };
    
    const { generateEbookHTML, openPrintWindow } = await import('../utils/generateExamPDF');
    const title = "Fascicule de Révision Personnalisé";
    const html = generateEbookHTML(title, questionsToPrint, s);
    openPrintWindow(html, `cahier-revision-points-faibles`);
  }, [stats.weakTopics, exams, profName, profPhone, profSite]);

  if (authLoading && !user) {
    return <DashboardSkeleton />;
  }

  // If student clicked to run an interactive exam right inside the dashboard:
  if (activeQuickExam) {
    return (
      <div className="py-6 space-y-4">
        <button
          onClick={() => setActiveQuickExam(null)}
          className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition px-2"
        >
          ← Revenir au tableau de bord
        </button>
        <ModernExamRunner 
          initialExam={activeQuickExam} 
          onFinish={() => setActiveQuickExam(null)} 
        />
      </div>
    );
  }

  const primaryAvailableExam = exams.find(e => e.isActive && !e.isArchived) || exams[0];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 antialiased selection:bg-indigo-500/30">
      
      {/* ── 1. HERO BENTO STRIP ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800/80 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-bold uppercase tracking-wider">
              <span>{user?.school || "Lycée Qualifiant Maroc"}</span>
              <span aria-hidden="true" className="text-zinc-600">·</span>
              <span>Filière Scientifique (SM / PC / SVT)</span>
            </div>
            
            <h1 className="text-2xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight leading-tight">
              Bonjour, {user?.name || "Élève"}
            </h1>
            
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed text-balance">
              Préparez sereinement vos épreuves avec l'algorithme de répétition espacée (SRS) et les archives corrigées des concours nationaux.
            </p>
          </div>

          {/* Direct CTA Launchers */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {primaryAvailableExam && (
              <button
                onClick={() => setActiveQuickExam(primaryAvailableExam)}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-xl shadow-indigo-600/30 active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Simuler une épreuve</span>
              </button>
            )}

            <button
              onClick={() => navigate('/study')}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-200 font-bold text-sm transition active:scale-95"
            >
              <BrainCircuit className="w-4 h-4 text-emerald-400" />
              <span>Révision SRS ({stats.dueToday} dues)</span>
            </button>

            <button
              onClick={() => navigate('/scanner')}
              className="flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold text-sm transition"
              title="Scanner une feuille de réponses"
            >
              <Camera className="w-4 h-4 text-zinc-400" />
              <span className="hidden sm:inline">Scanner QCM</span>
            </button>
          </div>
        </div>

        {/* Ambient subtle baseline grid */}
        <div className="absolute right-0 bottom-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* ── 2. METRIC STATS CARDS ── */}
      <section aria-label="Statistiques de révision" className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
            <span>Classement National</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight tabular-nums">
            #{stats.rank}
            <span className="text-xs font-normal text-zinc-500 ml-1.5">/ {stats.totalStudents}</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <span>Top 5% académique</span>
          </div>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
            <span>Série de Travail</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight tabular-nums">
            {stats.streak}
            <span className="text-xs font-normal text-zinc-500 ml-1.5">jours consécutifs</span>
          </div>
          <div className="text-[11px] text-zinc-400 font-medium">
            Régularité optimale
          </div>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
            <span>Maîtrise Globale</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight tabular-nums">
            {stats.globalMasteryPct}%
          </div>
          <div className="text-[11px] text-zinc-400 font-medium">
            {stats.masteredCards} fiches mémorisées
          </div>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
            <span>Expérience (XP)</span>
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight tabular-nums">
            {user?.xp ?? 0}
            <span className="text-xs font-normal text-zinc-500 ml-1.5">pts</span>
          </div>
          <div className="text-[11px] text-indigo-400 font-medium">
            Niveau Prépa Avancé
          </div>
        </div>
      </section>

      {/* ── 3. MAIN WORKSPACE GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Mock Exam History & Bank (7 Cols) */}
        <section className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-400" />
              <span>Épreuves et Concours Réalisés</span>
            </h2>
            <button
              onClick={() => navigate('/levels')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
            >
              <span>Voir tout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/80 p-5 sm:p-6 backdrop-blur-xl">
            <MockExamHistoryList 
              mockExamHistory={mockExamHistory} 
              exams={exams} 
              onDownloadReport={handleDownloadReport} 
              onNavigateToLevels={() => navigate('/levels')} 
              onNavigateToScanner={() => navigate('/scanner')} 
            />
          </div>
        </section>

        {/* Right Column: Weak Points & Analytics (5 Cols) */}
        <aside className="lg:col-span-5 space-y-6">
          {/* Weekly Activity */}
          <div className="rounded-3xl bg-zinc-900/50 border border-zinc-800/80 p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <span>Assiduité Hebdomadaire</span>
            </h3>
            <WeeklyActivityChart data={stats.weeklyActivity} />
          </div>

          {/* Diagnostic Remediation Hub */}
          <div className="rounded-3xl bg-zinc-900/50 border border-zinc-800/80 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <span>Axes de Remédiation Ciblés</span>
              </h3>
              <span className="text-[11px] font-bold text-zinc-400">
                {stats.weakTopics.length} axes
              </span>
            </div>

            <div className="space-y-3.5">
              {stats.weakTopics.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500 rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  Aucune lacune critique détectée. Tous vos chapitres sont au-dessus de 70% de réussite.
                </div>
              ) : (
                stats.weakTopics.map(({ name, masteryPct }) => (
                  <div key={name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-zinc-300">
                      <span>{name}</span>
                      <span className={`tabular-nums ${masteryPct < 40 ? 'text-red-400' : 'text-amber-400'}`}>
                        {masteryPct}% maîtrisé
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          masteryPct < 40 ? 'bg-red-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${masteryPct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={handlePrintWeakTopics}
              disabled={stats.weakTopics.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-bold text-xs transition flex items-center justify-center gap-2 border border-zinc-700/60 shadow-sm"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Générer mon Cahier d'Erreurs PDF</span>
            </button>
          </div>
        </aside>
      </div>

      {/* ── Toast Feedback Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-zinc-900/95 border border-emerald-500/30 shadow-2xl backdrop-blur-xl text-zinc-100 text-xs font-semibold flex items-center gap-3 max-w-sm animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="flex-1 leading-snug">{toastMessage}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-zinc-500 hover:text-zinc-300 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Onboarding Modal ── */}
      {showOnboarding && (
        <OnboardingModal 
          initialPhone={user?.phone || ''} 
          initialCity={user?.city || ''} 
          initialSchool={user?.school || ''}
          onSubmit={handleOnboardingSubmit} 
        />
      )}
    </div>
  );
}
