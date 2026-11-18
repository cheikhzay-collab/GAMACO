// src/services/solutionService.js
// Dedicated persistence layer for saving and hydrating exercise/question solutions
// and DEVOIR PRIME edits directly into MySQL (`tbl_solutions` and `tbl_devoir_prime`).

const API_BASE = '/api';
const SOLUTIONS_LS_KEY = 'gamaco_solutions_cache_v1';
const DP_LS_KEY = 'gamaco_devoir_prime_cache_v1';

const readMap = (key) => {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {};
  } catch {
    return {};
  }
};

const writeMap = (key, obj) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {}
};

/**
 * Saves an individual section or question solution to `tbl_solutions` (MySQL + localStorage fallback).
 */
export async function saveSolution({
  lessonId,
  sectionId,
  questionId = '',
  docType = 'homework',
  solutionText = '',
  solutionJson = null,
}) {
  if (!lessonId || !sectionId) return { success: false };
  const id = `sol-${lessonId}-${sectionId}${questionId ? '-' + questionId : ''}`.slice(0, 128);
  const payload = {
    id,
    lesson_id: lessonId,
    section_id: sectionId,
    question_id: questionId,
    doc_type: docType,
    solution_text: solutionText,
    solution_json: solutionJson,
    updated_at: new Date().toISOString(),
  };

  // Immediate localStorage persistence
  const cache = readMap(SOLUTIONS_LS_KEY);
  cache[id] = payload;
  writeMap(SOLUTIONS_LS_KEY, cache);

  // Sync to MySQL via /api/solutions
  try {
    const res = await fetch(`${API_BASE}/solutions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { success: true, id, synced: res.ok };
  } catch (err) {
    console.warn('[solutionService] /api/solutions sync warning:', err?.message || err);
    return { success: true, id, synced: false };
  }
}

/**
 * Fetches all saved solutions for a given lesson from MySQL (`tbl_solutions`).
 */
export async function getSolutionsByLesson(lessonId) {
  if (!lessonId) return [];
  try {
    const res = await fetch(`${API_BASE}/solutions?lesson_id=${encodeURIComponent(lessonId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {}
  const cache = readMap(SOLUTIONS_LS_KEY);
  return Object.values(cache).filter(s => s.lesson_id === lessonId);
}

/**
 * Saves a DEVOIR PRIME document's full edited metadata, questions, dotted lines, and solutions
 * directly into MySQL (`tbl_devoir_prime` + `tbl_solutions`).
 */
export async function saveDevoirPrimeSheet({
  lessonId,
  meta = {},
  exercises = [],
  totalPoints = 20,
}) {
  if (!lessonId) return { success: false };
  const payload = {
    id: `dp-${lessonId}`,
    lesson_id: lessonId,
    title: meta?.title || '',
    level: meta?.level || '',
    meta,
    exercises,
    total_points: totalPoints,
    updated_at: new Date().toISOString(),
  };

  const cache = readMap(DP_LS_KEY);
  cache[lessonId] = payload;
  writeMap(DP_LS_KEY, cache);

  try {
    const res = await fetch(`${API_BASE}/devoir-prime/${encodeURIComponent(lessonId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { success: true, synced: res.ok };
  } catch (err) {
    console.warn('[solutionService] /api/devoir-prime sync warning:', err?.message || err);
    return { success: true, synced: false };
  }
}

/**
 * Fetches saved DEVOIR PRIME edits & solutions for a lesson directly from MySQL (`tbl_devoir_prime`).
 */
export async function getDevoirPrimeSheet(lessonId) {
  if (!lessonId) return null;
  try {
    const res = await fetch(`${API_BASE}/devoir-prime/${encodeURIComponent(lessonId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.exercises || data.meta)) return data;
    }
  } catch {}
  const cache = readMap(DP_LS_KEY);
  return cache[lessonId] || null;
}
