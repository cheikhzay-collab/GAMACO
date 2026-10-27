/**
 * @file ModernExamRunner.jsx
 * Flagship 2026/2027 Interactive Exam & Concours Runner.
 * Adheres to Modern Design Systems: Ultra-clean contrast, micro-interactions,
 * WCAG AAA accessibility, optimistic state, and mobile-first responsive layout.
 */

import React, { useState } from 'react';
import { useExamSession } from '../domain/hooks/useExamSession.js';
import { 
  Clock, 
  Bookmark, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sparkles, 
  RotateCcw,
  Award,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function ModernExamRunner({ examId, initialExam = null, onFinish = null }) {
  const {
    exam,
    isLoading,
    error,
    currentIndex,
    currentQuestion,
    answers,
    bookmarks,
    isSubmitted,
    evaluation,
    timeRemaining,
    progressPercent,
    answeredCount,
    totalQuestions,
    selectAnswer,
    toggleBookmark,
    goToNext,
    goToPrev,
    jumpToQuestion,
    submitExam,
  } = useExamSession(examId, initialExam);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Format MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isTimeCritical = timeRemaining < 120 && timeRemaining > 0;
  const isBookmarked = currentQuestion && bookmarks.has(currentQuestion.id);
  const selectedOption = currentQuestion ? answers[currentQuestion.id] : null;

  // ── SKELETON LOADING STATE ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-pulse">
        <div className="h-14 bg-zinc-800/60 rounded-2xl flex items-center justify-between px-6">
          <div className="h-5 w-40 bg-zinc-700/60 rounded-md" />
          <div className="h-8 w-24 bg-zinc-700/60 rounded-full" />
        </div>
        <div className="p-8 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-6">
          <div className="h-6 w-3/4 bg-zinc-800 rounded-lg" />
          <div className="h-4 w-1/2 bg-zinc-800/70 rounded-lg" />
          <div className="space-y-3 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-zinc-800/40 border border-zinc-800/60 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR STATE ─────────────────────────────────────────────────────────────
  if (error || !exam) {
    return (
      <div className="w-full max-w-md mx-auto my-12 p-8 text-center bg-zinc-900/90 border border-red-500/30 rounded-3xl backdrop-blur-xl shadow-2xl">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-zinc-100">Épreuve introuvable</h3>
        <p className="mt-2 text-sm text-zinc-400">{error || "Impossible de charger les questions."}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-semibold transition"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // ── POST-SUBMISSION RESULTS SUMMARY ─────────────────────────────────────────
  if (isSubmitted && evaluation) {
    const isAdmis = evaluation.status === 'admis';
    const isRattrapage = evaluation.status === 'rattrapage';

    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-8 animate-fadeIn">
        {/* Hero Score Card */}
        <div className={`relative overflow-hidden p-8 sm:p-10 rounded-3xl border ${
          isAdmis 
            ? 'bg-gradient-to-b from-emerald-950/40 via-zinc-900/80 to-zinc-950 border-emerald-500/30 shadow-emerald-500/10' 
            : isRattrapage
              ? 'bg-gradient-to-b from-amber-950/40 via-zinc-900/80 to-zinc-950 border-amber-500/30 shadow-amber-500/10'
              : 'bg-gradient-to-b from-red-950/30 via-zinc-900/80 to-zinc-950 border-red-500/30 shadow-red-500/10'
        } shadow-2xl backdrop-blur-2xl`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isAdmis ? 'bg-emerald-500/20 text-emerald-400' : isRattrapage ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
              }`}>
                <Award className="w-3.5 h-3.5" />
                {isAdmis ? 'Admis(e) au Concours' : isRattrapage ? 'Session de Rattrapage' : 'Ajourné(e)'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-100">{exam.name}</h2>
              <p className="text-zinc-400 text-sm">
                Barème officiel marocain : +1.00 pt par bonne réponse, -0.25 pt par erreur.
              </p>
            </div>

            <div className="text-center p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 min-w-[160px]">
              <div className="text-4xl sm:text-5xl font-black text-zinc-50 tracking-tight">
                {evaluation.scaledScore}
                <span className="text-lg text-zinc-500 font-semibold">/20</span>
              </div>
              <div className="text-xs text-zinc-400 mt-1 font-medium">{evaluation.percentage}% de réussite</div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-zinc-800/60">
            <div className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-700/30 text-center">
              <div className="text-xs text-zinc-400">Total Questions</div>
              <div className="text-xl font-bold text-zinc-100 mt-0.5">{evaluation.totalQuestions}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <div className="text-xs text-emerald-300">Bonnes Réponses</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">{evaluation.correctCount}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
              <div className="text-xs text-red-300">Erreurs (-0.25)</div>
              <div className="text-xl font-bold text-red-400 mt-0.5">{evaluation.incorrectCount}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-700/30 text-center">
              <div className="text-xs text-zinc-400">Non répondues</div>
              <div className="text-xl font-bold text-zinc-400 mt-0.5">{evaluation.blankCount}</div>
            </div>
          </div>
        </div>

        {/* Topics Breakdown */}
        {evaluation.topicBreakdown && Object.keys(evaluation.topicBreakdown).length > 0 && (
          <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
            <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Performances par Matière / Axe
            </h3>
            <div className="space-y-3">
              {Object.entries(evaluation.topicBreakdown).map(([topic, data]) => (
                <div key={topic} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-zinc-300">
                    <span>{topic}</span>
                    <span className="text-zinc-400">{data.correct}/{data.total} ({data.accuracy}%)</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        data.accuracy >= 70 ? 'bg-emerald-400' : data.accuracy >= 50 ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${data.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-4 pt-4">
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold transition"
          >
            <RotateCcw className="w-4 h-4" />
            Recommencer l'épreuve
          </button>
          {onFinish && (
            <button 
              onClick={onFinish}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-lg shadow-indigo-600/30"
            >
              Terminer la révision
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── ACTIVE QUESTION RUNNER ──────────────────────────────────────────────────
  return (
    <div className="w-full max-w-4xl mx-auto p-3 sm:p-6 space-y-6 select-none">
      {/* ── Top Bar with HUD ── */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-xl shadow-lg">
        <div>
          <div className="text-xs uppercase tracking-wider text-indigo-400 font-bold">{exam.school || "Concours Médecine"}</div>
          <h1 className="text-base sm:text-lg font-bold text-zinc-100 truncate max-w-xs sm:max-w-md">{exam.name}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer Display */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono text-sm font-bold tracking-tight transition-colors ${
            isTimeCritical 
              ? 'bg-red-500/10 border-red-500/40 text-red-400 animate-pulse' 
              : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-200'
          }`}>
            <Clock className={`w-4 h-4 ${isTimeCritical ? 'text-red-400' : 'text-zinc-400'}`} />
            <span>{formatTime(timeRemaining)}</span>
          </div>

          {/* End Test Button */}
          <button
            onClick={() => setShowConfirmModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition duration-200 shadow-sm"
          >
            Terminer ({answeredCount}/{totalQuestions})
          </button>
        </div>
      </header>

      {/* ── Question Navigation Chips Ribbon ── */}
      <nav aria-label="Question Navigator" className="flex items-center gap-1.5 overflow-x-auto p-2 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 scrollbar-none">
        {exam.questions.map((q, idx) => {
          const isCurrent = idx === currentIndex;
          const isAnswered = Boolean(answers[q.id]);
          const isMarked = bookmarks.has(q.id);

          return (
            <button
              key={q.id || idx}
              onClick={() => jumpToQuestion(idx)}
              className={`relative flex-shrink-0 w-9 h-9 rounded-xl text-xs font-bold transition-all duration-200 ${
                isCurrent 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-105 ring-2 ring-indigo-400'
                  : isAnswered 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                    : 'bg-zinc-800/60 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              {idx + 1}
              {isMarked && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-zinc-900" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Main Question Workspace Card ── */}
      {currentQuestion && (
        <article className="relative p-6 sm:p-8 rounded-3xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-2xl shadow-xl space-y-6">
          {/* Header of Question */}
          <div className="flex items-start justify-between gap-4 border-b border-zinc-800/60 pb-5">
            <div className="space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-zinc-800 text-indigo-400 border border-zinc-700/50">
                {currentQuestion.topic || 'Question'} • #{currentIndex + 1} sur {totalQuestions}
              </span>
              <h2 className="text-lg sm:text-xl font-medium text-zinc-100 leading-relaxed pt-1">
                {currentQuestion.question}
              </h2>
            </div>

            <button
              onClick={() => toggleBookmark(currentQuestion.id)}
              aria-label={isBookmarked ? "Retirer des favoris" : "Marquer pour relecture"}
              className={`p-2.5 rounded-xl border transition-colors ${
                isBookmarked 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
                  : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Bookmark className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 gap-3.5 pt-2" role="radiogroup">
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedOption === opt.id;

              return (
                <button
                  key={opt.id}
                  onClick={() => selectAnswer(currentQuestion.id, opt.id)}
                  role="radio"
                  aria-checked={isSelected}
                  className={`group relative flex items-center justify-between p-4 sm:p-4.5 rounded-2xl border text-left transition-all duration-200 ${
                    isSelected 
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/50 scale-[1.008]' 
                      : 'bg-zinc-800/30 hover:bg-zinc-800/60 border-zinc-800 hover:border-zinc-700 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3.5 pr-4">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-colors ${
                      isSelected 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200'
                    }`}>
                      {opt.id}
                    </span>
                    <span className="text-sm sm:text-base font-normal leading-relaxed text-zinc-100">{opt.text}</span>
                  </div>

                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected 
                      ? 'border-indigo-400 bg-indigo-500 text-white' 
                      : 'border-zinc-600 bg-transparent group-hover:border-zinc-400'
                  }`}>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Hints / Pedagogical Astuce (if available) */}
          {(currentQuestion.astuce || currentQuestion.trick) && (
            <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Astuce Concours : </span>
                {currentQuestion.astuce || currentQuestion.trick}
              </div>
            </div>
          )}

          {/* Keyboard shortcuts reminder */}
          <div className="hidden sm:flex items-center justify-between pt-4 border-t border-zinc-800/40 text-[11px] text-zinc-500">
            <span>Raccourcis clavier : Touches <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">A</kbd> à <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">E</kbd> pour sélectionner • <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">B</kbd> pour marquer</span>
            <span>Flèches <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">→</kbd> pour naviguer</span>
          </div>
        </article>
      )}

      {/* ── Footer Navigation Actions ── */}
      <footer className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl">
        <button
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Précédent
        </button>

        <div className="text-xs text-zinc-400 font-medium">
          Progression : <strong className="text-zinc-200">{progressPercent}%</strong>
        </div>

        {currentIndex < totalQuestions - 1 ? (
          <button
            onClick={goToNext}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/30"
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/30"
          >
            Soumettre l'examen
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
      </footer>

      {/* ── Submission Confirmation Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-5">
            <h3 className="text-lg font-bold text-zinc-100">Confirmer la fin de l'épreuve ?</h3>
            <p className="text-sm text-zinc-400">
              Vous avez répondu à <strong className="text-indigo-400">{answeredCount}</strong> sur <strong>{totalQuestions}</strong> questions.
              {answeredCount < totalQuestions && (
                <span className="block mt-1 text-amber-400/90 text-xs">
                  Attention : les {totalQuestions - answeredCount} questions non répondues obtiendront 0 point.
                </span>
              )}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition"
              >
                Continuer l'épreuve
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  submitExam();
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30"
              >
                Valider et noter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
