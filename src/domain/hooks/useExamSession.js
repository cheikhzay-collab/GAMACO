/**
 * @file useExamSession.js
 * High-performance state management hook for interactive exam runners.
 * Features optimistic selection, keyboard controls, real-time timer, and telemetry.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { examRepository } from '../repositories/examRepository.js';
import { telemetry } from '../core/Telemetry.js';

export function useExamSession(examId, initialExam = null) {
  const [exam, setExam] = useState(initialExam);
  const [isLoading, setIsLoading] = useState(!initialExam);
  const [error, setError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [bookmarks, setBookmarks] = useState(new Set());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [evaluation, setEvaluation] = useState(null);

  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef(null);

  // 1. Initial Load
  useEffect(() => {
    let isMounted = true;
    if (initialExam) {
      setExam(initialExam);
      setTimeRemaining((initialExam.questions?.length || 20) * 90); // 90s per QCM
      setIsLoading(false);
      return;
    }

    if (!examId) return;

    setIsLoading(true);
    examRepository.getExamById(examId).then((result) => {
      if (!isMounted) return;
      result.match({
        ok: (loadedExam) => {
          setExam(loadedExam);
          setTimeRemaining((loadedExam.questions?.length || 20) * 90);
          setError(null);
        },
        fail: (err) => {
          setError(err);
        }
      });
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [examId, initialExam]);

  // 2. Timer Countdown
  useEffect(() => {
    if (isLoading || isSubmitted || timeRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitExam(); // Auto-submit on expiration
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isLoading, isSubmitted, timeRemaining]);

  // 3. Current Question Helper
  const currentQuestion = useMemo(() => {
    if (!exam || !exam.questions || exam.questions.length === 0) return null;
    return exam.questions[currentIndex] || null;
  }, [exam, currentIndex]);

  // 4. Optimistic Answer Selection
  const selectAnswer = useCallback((questionId, optionId) => {
    if (isSubmitted) return;

    setAnswers((prev) => {
      const next = { ...prev };
      if (next[questionId] === optionId) {
        delete next[questionId]; // Toggle off
        telemetry.addBreadcrumb('USER_ACTION', 'Deselected option', { questionId, optionId });
      } else {
        next[questionId] = optionId;
        telemetry.addBreadcrumb('USER_ACTION', 'Selected option', { questionId, optionId });
      }
      return next;
    });
  }, [isSubmitted]);

  // 5. Bookmark toggle
  const toggleBookmark = useCallback((questionId) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  // 6. Navigation
  const goToNext = useCallback(() => {
    if (!exam?.questions) return;
    setCurrentIndex((prev) => Math.min(exam.questions.length - 1, prev + 1));
  }, [exam]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const jumpToQuestion = useCallback((index) => {
    if (!exam?.questions || index < 0 || index >= exam.questions.length) return;
    setCurrentIndex(index);
  }, [exam]);

  // 7. Exam Submission & Scoring
  const submitExam = useCallback(() => {
    if (!exam || isSubmitted) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const totalTimeAllocated = (exam.questions?.length || 20) * 90;
    const timeSpent = totalTimeAllocated - timeRemaining;

    const evalResult = examRepository.evaluateSubmission(exam, answers, timeSpent);
    evalResult.match({
      ok: (evalData) => {
        setEvaluation(evalData);
        setIsSubmitted(true);
        telemetry.info('ExamSession', 'Exam completed and evaluated', evalData);
      },
      fail: (err) => {
        telemetry.error('ExamSession', 'Failed to evaluate exam', err);
      }
    });
  }, [exam, isSubmitted, timeRemaining, answers]);

  // 8. Hotkeys Listener (A, B, C, D, E, Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isSubmitted || !currentQuestion) return;
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
        e.preventDefault();
        selectAnswer(currentQuestion.id, key);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        toggleBookmark(currentQuestion.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitted, currentQuestion, selectAnswer, goToNext, goToPrev, toggleBookmark]);

  // Progress metrics
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = exam?.questions?.length || 0;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return {
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
  };
}
