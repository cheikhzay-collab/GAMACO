// src/services/examService.js
// High-performance multi-tiered CRUD for exams with SWR caching and projection optimization.
// Supabase -> LocalDb Companion -> LocalStorage -> Seed Fallback.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';
import { queryCache } from './queryCache';
import { mapLegacySchoolToLevel } from '../utils/levelHelpers';

const STORAGE_KEY = 'lconq_exams_db';

const INITIAL_SEED_EXAMS = [
  {
    id: "QVVOBFE7",
    name: "Concours Médecine / Pharmacie 2024",
    school: "Médecine / Pharmacie",
    level: "2bac_pc_svt",
    year: "2024",
    tier: "freemium",
    isActive: true,
    isArchived: false,
    dateAdded: "2026-07-01T00:00:00.000Z",
    questions: Array.from({ length: 20 }, (_, i) => {
      const answers = ["C", "A", "B", "D", "C", "A", "E", "B", "C", "D", "B", "B", "A", "C", "D", "E", "B", "A", "D", "C"];
      const topics = ["Analyse", "Géométrie", "Algèbre", "Physique", "Chimie"];
      const optTexts = ["Option A", "Option B", "Option C", "Option D", "Option E"];
      return {
        id: `qvvobfe7-q-${i + 1}`,
        question: `Question ${i + 1} de concours Médecine/Pharmacie`,
        topic: topics[i % topics.length],
        correct_answer: answers[i],
        options: optTexts.map((txt, oIdx) => ({
          id: ["A", "B", "C", "D", "E"][oIdx],
          text: txt
        }))
      };
    })
  }
];

const getLocalStorageExams = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (e) {
    return null;
  }
};

const saveLocalStorageExams = (exams) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exams));
  } catch (e) {
    console.warn('[LocalStorage] Failed to save exams:', e);
  }
};

// Helper to map exam fields to DB columns
const mapExamToDB = (e) => ({
  name: e.name,
  school: e.school,
  level: e.level !== undefined ? e.level : (e.school ? mapLegacySchoolToLevel(e.school) : null),
  year: e.year,
  tier: e.tier,
  questions: e.questions || [],
  pdf_url: e.pdfUrl || e.pdf_url || null,
  is_active: e.isActive !== undefined ? e.isActive : true,
  is_archived: e.isArchived !== undefined ? e.isArchived : false,
  date_added: e.dateAdded || e.date_added || new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Helper to map DB columns to exam fields
const mapDBToExam = (row) => {
  if (!row) return null;
  const determinedLevel = row.level || mapLegacySchoolToLevel(row.school) || null;
  return {
    id: row.id,
    name: row.name,
    school: row.school,
    level: determinedLevel,
    year: row.year,
    tier: row.tier || 'freemium',
    questions: Array.isArray(row.questions) ? row.questions : [],
    questionsCount: row.questions_count !== undefined 
      ? row.questions_count 
      : (Array.isArray(row.questions) ? row.questions.length : 0),
    pdfUrl: row.pdf_url || row.pdfUrl || null,
    isActive: row.is_active !== undefined ? row.is_active : (row.isActive !== undefined ? row.isActive : true),
    isArchived: row.is_archived !== undefined ? row.is_archived : (row.isArchived !== undefined ? row.isArchived : false),
    dateAdded: row.date_added || row.dateAdded || row.created_at,
    updatedAt: row.updated_at || row.updatedAt,
  };
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch ALL exams (metadata-only for ultra-fast list & overview rendering)
 */
export const getAllExams = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('exams_all', async () => {
    // 1. Supabase attempt (Try metadata view first, fallback to lightweight projection)
    if (supabase) {
      try {
        let { data, error } = await supabase
          .from('exams_metadata')
          .select('*')
          .order('date_added', { ascending: false });

        if (error || !data) {
          const fallback = await supabase
            .from('exams')
            .select('id, name, school, level, year, tier, pdf_url, is_active, is_archived, date_added, updated_at')
            .order('date_added', { ascending: false });
          data = fallback.data;
          error = fallback.error;
        }

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(mapDBToExam);
          saveLocalStorageExams(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Failed to fetch exams:', err);
      }
    }

    // 2. Local Companion DB API fallback
    try {
      const data = await localDb.get('/exams');
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapDBToExam);
        saveLocalStorageExams(mapped);
        return mapped;
      }
    } catch (err) {}

    // 3. LocalStorage fallback
    const cache = getLocalStorageExams();
    if (cache && cache.length > 0) {
      return cache.map(mapDBToExam);
    }

    // 4. Initial seed fallback
    saveLocalStorageExams(INITIAL_SEED_EXAMS);
    return INITIAL_SEED_EXAMS.map(mapDBToExam);
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 3,
    cacheTime: 1000 * 60 * 30
  });
};

/**
 * Fetch only active, non-archived exams (student view).
 */
export const getActiveExams = async (options = {}) => {
  const exams = await getAllExams(options);
  return exams.filter(e => e.isActive && !e.isArchived);
};

/**
 * Fetch a single exam by ID (Loads full details + questions).
 */
export const getExamById = async (examId, options = {}) => {
  if (!examId) return null;
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache(`exam_detail_${examId}`, async () => {
    // 1. Supabase single query
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .maybeSingle();

        if (!error && data) {
          return mapDBToExam(data);
        }
      } catch (err) {
        console.warn(`[Supabase] Failed to fetch single exam ${examId}:`, err);
      }
    }

    // 2. Try Local Companion API
    try {
      const data = await localDb.get(`/exams/${examId}`);
      if (data) return mapDBToExam(data);
    } catch {}

    // 3. Try LocalStorage cached list
    const cachedList = getLocalStorageExams() || [];
    const found = cachedList.find(e => e.id === examId);
    if (found && found.questions && found.questions.length > 0) {
      return mapDBToExam(found);
    }

    // 4. Fallback to initial seed
    const seed = INITIAL_SEED_EXAMS.find(e => e.id === examId);
    return seed ? mapDBToExam(seed) : (found ? mapDBToExam(found) : null);
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 5,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Fetch only the questions array of a single exam.
 */
export const getExamQuestionsOnly = async (examId) => {
  const exam = await getExamById(examId);
  return exam ? (exam.questions || []) : [];
};

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Add a new exam.
 */
export const addExam = async (examData) => {
  const id = examData.id || Math.random().toString(36).substring(2, 11).toUpperCase();
  const now = new Date().toISOString();
  const determinedLevel = examData.level || mapLegacySchoolToLevel(examData.school) || null;

  const newExam = {
    id,
    name: examData.name,
    school: examData.school,
    level: determinedLevel,
    year: examData.year,
    tier: examData.tier,
    questions: examData.questions || [],
    pdfUrl: examData.pdfUrl || null,
    isActive: examData.isActive !== undefined ? examData.isActive : true,
    isArchived: examData.isArchived !== undefined ? examData.isArchived : false,
    dateAdded: examData.dateAdded || now,
    updatedAt: now
  };

  // 1. Invalidate SWR queries immediately
  queryCache.invalidate('exams_all');
  queryCache.set(`exam_detail_${id}`, newExam);

  // 2. Save to LocalStorage cache
  const currentExams = (await getAllExams()).filter(e => e.id !== id);
  currentExams.unshift(newExam);
  saveLocalStorageExams(currentExams);

  // 3. Sync to Supabase
  if (supabase) {
    try {
      await supabase.from('exams').insert({ id, ...mapExamToDB({ ...examData, level: determinedLevel }) });
    } catch (err) {
      console.warn('[Supabase] Could not sync addExam to Supabase:', err.message);
    }
  }

  // 4. Sync to Local Companion API
  try {
    await localDb.post('/exams', newExam);
  } catch (err) {}

  return id;
};

/**
 * Update specific fields of an exam.
 */
export const updateExam = async (examId, updates) => {
  const now = new Date().toISOString();

  queryCache.invalidate('exams_all');
  queryCache.invalidate(`exam_detail_${examId}`);

  // 1. Update LocalStorage cache immediately
  const currentExams = await getAllExams();
  const idx = currentExams.findIndex(e => e.id === examId);
  if (idx !== -1) {
    const determinedLevel = updates.level !== undefined 
      ? updates.level 
      : (updates.school ? mapLegacySchoolToLevel(updates.school) : currentExams[idx].level);

    currentExams[idx] = {
      ...currentExams[idx],
      ...updates,
      level: determinedLevel,
      updatedAt: now
    };
    saveLocalStorageExams(currentExams);
  }

  // 2. Build DB updates
  const dbUpdates = { updated_at: now };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.school !== undefined) dbUpdates.school = updates.school;
  if (updates.level !== undefined) {
    dbUpdates.level = updates.level;
  } else if (updates.school !== undefined) {
    dbUpdates.level = mapLegacySchoolToLevel(updates.school);
  }
  if (updates.year !== undefined) dbUpdates.year = updates.year;
  if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
  if (updates.questions !== undefined) dbUpdates.questions = updates.questions;
  if (updates.pdfUrl !== undefined) dbUpdates.pdf_url = updates.pdfUrl;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
  if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;

  // 3. Sync to Supabase
  if (supabase) {
    try {
      await supabase.from('exams').update(dbUpdates).eq('id', examId);
    } catch (err) {
      console.warn('[Supabase] Could not sync updateExam to Supabase:', err.message);
    }
  }

  // 4. Sync to Local Companion API
  try {
    const localExams = await localDb.get('/exams');
    const eIdx = localExams.findIndex(e => e.id === examId);
    if (eIdx !== -1) {
      const merged = { ...localExams[eIdx], ...updates, updatedAt: now };
      await localDb.post('/exams', merged);
    }
  } catch (err) {}
};

/**
 * Toggle active status of an exam.
 */
export const toggleExamStatus = async (examId, currentStatus) => {
  return updateExam(examId, { isActive: !currentStatus });
};

/**
 * Toggle archive status of an exam.
 */
export const toggleArchiveExam = async (examId, currentArchived) => {
  return updateExam(examId, { isArchived: !currentArchived });
};

/**
 * Permanently delete an exam from MySQL and local cache.
 */
export const deleteExam = async (examId) => {
  if (!examId) throw new Error('Identifiant de QCM manquant.');

  try {
    await localDb.delete('/exams', examId);
  } catch (err) {
    console.error('[examService] deleteExam MySQL delete failed:', err);
    if (err?.status === 401 || err?.status === 403) {
      throw new Error('انتهت صلاحية الجلسة — يرجى تسجيل الدخول مرة أخرى لحذف الاختبار من قاعدة البيانات.');
    }
    throw new Error(err?.message || 'تعذر حذف الاختبار من قاعدة البيانات.');
  }

  queryCache.invalidate('exams_all');
  queryCache.invalidate(`exam_detail_${examId}`);

  const currentExams = await getAllExams().catch(() => []);
  const filtered = (Array.isArray(currentExams) ? currentExams : []).filter(e => e.id !== examId);
  saveLocalStorageExams(filtered);
};
