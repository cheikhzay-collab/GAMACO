/**
 * @file examSchema.js
 * Domain Entities & Strict Schema Contracts validated via Zod.
 * Enforces compile-time/run-time schema boundary integrity for 2026/2027.
 */

import { z } from 'zod';

export const QuestionOptionSchema = z.object({
  id: z.enum(['A', 'B', 'C', 'D', 'E']),
  text: z.string().min(1, 'Option text cannot be empty'),
});

export const ExamQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1, 'Question text required'),
  topic: z.string().default('Général'),
  correct_answer: z.string().regex(/^[A-E]$/, 'Answer must be between A and E'),
  options: z.array(QuestionOptionSchema).min(2, 'Must have at least 2 options'),
  explanation: z.string().optional().default(''),
  astuce: z.string().optional().default(''),
  trick: z.string().optional().default(''),
  points: z.number().default(1),
  penalty: z.number().default(0.25), // Moroccan concours standard: -0.25 for incorrect answer
});

export const ExamMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, 'Exam title must be at least 2 characters'),
  school: z.string().default('Médecine / Pharmacie'),
  level: z.string().default('2bac_pc_svt'),
  year: z.string().regex(/^\d{4}$/, 'Year must be 4 digits'),
  tier: z.enum(['freemium', 'premium', 'institution']).default('freemium'),
  isActive: z.boolean().default(true),
  isArchived: z.boolean().default(false),
  questionsCount: z.number().int().nonnegative().default(0),
  pdfUrl: z.string().nullable().optional(),
  dateAdded: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()).optional(),
});

export const FullExamSchema = ExamMetadataSchema.extend({
  questions: z.array(ExamQuestionSchema).default([]),
});

export const ExamSubmissionSchema = z.object({
  examId: z.string(),
  userId: z.string(),
  answers: z.record(z.string(), z.string()), // questionId -> selectedOption
  durationSeconds: z.number().nonnegative(),
  submittedAt: z.string().datetime().default(() => new Date().toISOString()),
});

export const ExamScoreResultSchema = z.object({
  examId: z.string(),
  totalQuestions: z.number(),
  answeredCount: z.number(),
  correctCount: z.number(),
  incorrectCount: z.number(),
  blankCount: z.number(),
  rawScore: z.number(),
  scaledScore: z.number(), // Scale of 20
  percentage: z.number(),
  status: z.enum(['admis', 'rattrapage', 'ajourne']),
  topicBreakdown: z.record(z.string(), z.object({
    total: z.number(),
    correct: z.number(),
    accuracy: z.number(),
  })),
});
