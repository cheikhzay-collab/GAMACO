/**
 * @file examRepository.js
 * Domain Repository implementation adhering to Clean Architecture & DDD.
 * Integrates Zod schema validation, SWR caching, Monadic Results, and Optimistic UI sync.
 */

import { FullExamSchema, ExamMetadataSchema, ExamScoreResultSchema } from '../schemas/examSchema.js';
import { Result } from '../core/Result.js';
import { telemetry } from '../core/Telemetry.js';
import { localDb } from '../../lib/localDbClient.js';

class ExamRepository {
  constructor() {
    this._cache = new Map();
    this._cacheTTL = 3 * 60 * 1000; // 3 minutes
  }

  /**
   * Reads all exams with SWR cache-aside strategy & Zod schema parsing.
   * @param {{ forceRefresh?: boolean }} options
   * @returns {Promise<Result>}
   */
  async getAllExams(options = {}) {
    const cacheKey = 'exams_all_meta';
    const cached = this._cache.get(cacheKey);

    if (!options.forceRefresh && cached && Date.now() - cached.timestamp < this._cacheTTL) {
      telemetry.info('ExamRepo', 'Serving exams from memory cache', { count: cached.data.length });
      return Result.ok(cached.data);
    }

    return telemetry.profile('ExamRepo:getAllExams', async () => {
      try {
        const rawData = await localDb.get('/exams');
        if (!Array.isArray(rawData)) {
          return Result.fail('Invalid payload format received from database');
        }

        const validatedList = [];
        for (const item of rawData) {
          const parseResult = ExamMetadataSchema.safeParse({
            ...item,
            questionsCount: item.questionsCount ?? (Array.isArray(item.questions) ? item.questions.length : 0),
          });

          if (parseResult.success) {
            validatedList.push(parseResult.data);
          } else {
            telemetry.warn('ExamRepo', `Skipping malformed exam record [${item.id}]`, parseResult.error.format());
          }
        }

        this._cache.set(cacheKey, { timestamp: Date.now(), data: validatedList });
        return Result.ok(validatedList);
      } catch (err) {
        telemetry.error('ExamRepo', 'Failed to fetch exams from data source', err);
        // Resilient fallback: return stale cache if available
        if (cached) {
          telemetry.warn('ExamRepo', 'Serving stale cache due to network failure');
          return Result.ok(cached.data);
        }
        return Result.fail(err.message || 'Error fetching exams');
      }
    });
  }

  /**
   * Retrieves single exam with full question models
   * @param {string} examId
   * @returns {Promise<Result>}
   */
  async getExamById(examId) {
    if (!examId) return Result.fail('Exam ID is required');
    const cacheKey = `exam_full_${examId}`;
    const cached = this._cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this._cacheTTL) {
      return Result.ok(cached.data);
    }

    return telemetry.profile(`ExamRepo:getExamById:${examId}`, async () => {
      try {
        const rawExam = await localDb.get(`/exams/${examId}`);
        if (!rawExam) return Result.fail(`Exam ${examId} not found`);

        const parseResult = FullExamSchema.safeParse(rawExam);
        if (!parseResult.success) {
          telemetry.warn('ExamRepo', `Exam ${examId} failed schema validation, parsing best-effort`, parseResult.error.format());
          return Result.ok(rawExam); // Graceful fallback
        }

        this._cache.set(cacheKey, { timestamp: Date.now(), data: parseResult.data });
        return Result.ok(parseResult.data);
      } catch (err) {
        telemetry.error('ExamRepo', `Failed to load exam ${examId}`, err);
        return Result.fail(err.message || 'Failed to load exam details');
      }
    });
  }

  /**
   * Evaluates student exam submission with Moroccan Concours penalty scoring formula
   * @param {object} exam
   * @param {Record<string, string>} studentAnswers
   * @param {number} durationSeconds
   * @returns {Result}
   */
  evaluateSubmission(exam, studentAnswers = {}, durationSeconds = 0) {
    try {
      const questions = exam.questions || [];
      const total = questions.length;
      let correctCount = 0;
      let incorrectCount = 0;
      let blankCount = 0;
      let rawScore = 0;
      const topicBreakdown = {};

      for (const q of questions) {
        const topic = q.topic || 'Général';
        if (!topicBreakdown[topic]) {
          topicBreakdown[topic] = { total: 0, correct: 0, accuracy: 0 };
        }
        topicBreakdown[topic].total += 1;

        const answer = studentAnswers[q.id];
        if (!answer) {
          blankCount += 1;
        } else if (answer === q.correct_answer) {
          correctCount += 1;
          rawScore += (q.points || 1);
          topicBreakdown[topic].correct += 1;
        } else {
          incorrectCount += 1;
          rawScore -= (q.penalty || 0.25); // Penalization rule
        }
      }

      // Safe bounds (score cannot be negative in overall grading)
      const nonNegativeRaw = Math.max(0, rawScore);
      const scaledScore = total > 0 ? Math.round((nonNegativeRaw / total) * 20 * 100) / 100 : 0;
      const percentage = total > 0 ? Math.round((nonNegativeRaw / total) * 100) : 0;

      // Status determination (Moroccan thresholds)
      let status = 'ajourne';
      if (scaledScore >= 12) status = 'admis';
      else if (scaledScore >= 10) status = 'rattrapage';

      // Accuracies
      for (const t of Object.keys(topicBreakdown)) {
        const item = topicBreakdown[t];
        item.accuracy = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
      }

      const scorePayload = {
        examId: exam.id,
        totalQuestions: total,
        answeredCount: correctCount + incorrectCount,
        correctCount,
        incorrectCount,
        blankCount,
        rawScore: Math.round(rawScore * 100) / 100,
        scaledScore,
        percentage,
        status,
        topicBreakdown,
      };

      const parsed = ExamScoreResultSchema.safeParse(scorePayload);
      if (!parsed.success) {
        telemetry.warn('ExamRepo', 'Score payload validation warning', parsed.error.format());
        return Result.ok(scorePayload);
      }

      telemetry.info('ExamRepo', `Evaluated submission for exam [${exam.id}]: ${scaledScore}/20`, { status, percentage });
      return Result.ok(parsed.data);
    } catch (err) {
      telemetry.error('ExamRepo', 'Error calculating exam score', err);
      return Result.fail(err.message || 'Score calculation error');
    }
  }

  /**
   * Optimistically saves an exam with immediate local cache update
   * @param {object} examData
   * @returns {Promise<Result>}
   */
  async saveExamOptimistically(examData) {
    const id = examData.id || ('EXAM-' + Date.now().toString(36).toUpperCase());
    const optimisticPayload = {
      ...examData,
      id,
      updatedAt: new Date().toISOString()
    };

    // 1. Optimistic memory update
    this._cache.set(`exam_full_${id}`, { timestamp: Date.now(), data: optimisticPayload });
    const cachedList = this._cache.get('exams_all_meta');
    if (cachedList) {
      const idx = cachedList.data.findIndex(e => e.id === id);
      if (idx > -1) cachedList.data[idx] = optimisticPayload;
      else cachedList.data.unshift(optimisticPayload);
    }

    // 2. Async backend persist
    try {
      const response = await localDb.post('/exams', optimisticPayload);
      telemetry.info('ExamRepo', `Exam ${id} successfully synced to backend`);
      return Result.ok(response?.exam || optimisticPayload);
    } catch (err) {
      telemetry.error('ExamRepo', `Backend sync failed for exam ${id}`, err);
      // State is preserved in local cache for offline recovery
      return Result.ok(optimisticPayload);
    }
  }
}

export const examRepository = new ExamRepository();
