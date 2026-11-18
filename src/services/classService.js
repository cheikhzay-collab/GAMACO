// src/services/classService.js
// Service for managing school classes and student assignments with SWR caching & fail-safe persistence.
// Supabase -> Local Companion API -> LocalStorage -> Seed Fallback.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';
import { queryCache } from './queryCache';
import initialClassesData from '../../data/classes.json';

const STORAGE_KEY = 'lconq_classes_db';

const getLocalStorageClasses = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (e) {
    return null;
  }
};

const saveLocalStorageClasses = (classes) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(classes));
  } catch (e) {
    console.warn('[LocalStorage] Failed to save classes:', e);
  }
};

const hasAdminSession = () => {
  try {
    const token = localStorage.getItem('gamaco_auth_token');
    const rawUser = localStorage.getItem('lconq_current_user');
    if (!token || !rawUser) return false;
    const u = JSON.parse(rawUser);
    return u?.role === 'admin';
  } catch (_) {
    return false;
  }
};

/**
 * Safe one-way rescue: if a class in MySQL has an empty program ([]) while the browser's
 * localStorage already holds a non-empty program array created before the DB fix,
 * preserve it and automatically push it to MySQL so existing work is never wiped.
 */
const rescueLocalProgramsIfNeeded = async (serverClasses) => {
  const localCache = getLocalStorageClasses();
  if (!Array.isArray(localCache) || localCache.length === 0) return serverClasses;

  const localById = new Map(localCache.filter(c => c && c.id).map(c => [c.id, normalizeClass(c)]));
  const canPush = hasAdminSession();
  const rescuedList = [];

  for (const srv of serverClasses) {
    const localCls = localById.get(srv.id);
    if (
      localCls &&
      Array.isArray(localCls.program) && localCls.program.length > 0 &&
      (!Array.isArray(srv.program) || srv.program.length === 0)
    ) {
      const merged = {
        ...srv,
        program: localCls.program,
        updatedAt: new Date().toISOString()
      };
      if (canPush) {
        try {
          await localDb.post(`/classes/${encodeURIComponent(srv.id)}`, merged);
          console.log(`[classService] Rescued local program (${localCls.program.length} items) to MySQL for class ${srv.id}`);
        } catch (err) {
          console.warn(`[classService] Could not push rescued program for ${srv.id}:`, err.message);
        }
      }
      rescuedList.push(merged);
    } else {
      rescuedList.push(srv);
    }
  }

  return rescuedList;
};

const safeParseJSON = (val, fallback) => {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
};

/**
 * Normalizes a class object from ANY source (Supabase snake_case, LocalDB camelCase, or localStorage).
 */
const normalizeClass = (row) => {
  if (!row) return null;

  const parsedStudents = safeParseJSON(row.students, []);
  const parsedGrades = safeParseJSON(row.grades, {});
  const parsedCompGrades = safeParseJSON(
    row.competitionGrades ?? row.competition_grades,
    {}
  );
  const parsedHomework = safeParseJSON(row.homework, {});
  const parsedControls = safeParseJSON(row.controls, []);
  const parsedCompetitions = safeParseJSON(row.competitions, []);
  const parsedProgram = safeParseJSON(row.program, []);

  const studentsList = Array.isArray(parsedStudents) ? parsedStudents : [];
  const count = row.student_count ?? row.studentCount ?? studentsList.length;

  return {
    id: row.id,
    name: row.name,
    level: row.level,
    students: studentsList,
    studentCount: count,
    competitions: Array.isArray(parsedCompetitions) ? parsedCompetitions : [],
    competitionGrades: parsedCompGrades,
    controls: Array.isArray(parsedControls) ? parsedControls : [],
    grades: parsedGrades,
    homework: typeof parsedHomework === 'object' && parsedHomework !== null ? parsedHomework : {},
    language: row.language || 'fr',
    program: Array.isArray(parsedProgram) ? parsedProgram : [],
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch ALL classes with SWR caching.
 */
export const getAllClasses = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('classes_all', async () => {
    // 1. Try Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(normalizeClass);
          saveLocalStorageClasses(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Failed to fetch classes:', err);
      }
    }

    // 2. Try MySQL / LocalDB companion server
    try {
      const data = await localDb.get('/classes');
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(normalizeClass);
        const reconciled = await rescueLocalProgramsIfNeeded(mapped);
        saveLocalStorageClasses(reconciled);
        return reconciled;
      }
    } catch (err) {
      console.warn('[classService] Failed to fetch classes from API:', err.message || err);
    }

    // 3. Fallback to localStorage
    const cache = getLocalStorageClasses();
    if (Array.isArray(cache) && cache.length > 0) {
      if (Array.isArray(initialClassesData)) {
        const seedMap = new Map(initialClassesData.map(c => [c.id, c]));
        let needsResave = false;
        const enriched = cache.map(c => {
          const seed = seedMap.get(c.id);
          if ((!c.students || c.students.length === 0) && seed && seed.students && seed.students.length > 0) {
            needsResave = true;
            return {
              ...c,
              students: seed.students,
              studentCount: seed.students.length
            };
          }
          return c;
        });
        if (needsResave) {
          saveLocalStorageClasses(enriched);
          return enriched;
        }
      }
      return cache;
    }

    // 4. Seed fallback
    if (Array.isArray(initialClassesData) && initialClassesData.length > 0) {
      const mapped = initialClassesData.map(normalizeClass);
      saveLocalStorageClasses(mapped);
      return mapped;
    }

    return [];
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 3,
    cacheTime: 1000 * 60 * 30
  });
};

/**
 * Fetch a single class by ID.
 */
export const getClassById = async (classId, options = {}) => {
  if (!classId) return null;
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache(`class_detail_${classId}`, async () => {
    // 1. Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .eq('id', classId)
          .maybeSingle();

        if (!error && data) {
          return normalizeClass(data);
        }
      } catch (err) {
        console.warn(`[Supabase] Failed to fetch class ${classId}:`, err);
      }
    }

    // 2. MySQL / LocalDB
    try {
      const data = await localDb.get(`/classes/${encodeURIComponent(classId)}`);
      if (data) {
        const normalized = normalizeClass(data);
        const [reconciled] = await rescueLocalProgramsIfNeeded([normalized]);
        // Sync updated class into localStorage list
        const cache = getLocalStorageClasses() || [];
        const cIdx = cache.findIndex(c => c.id === classId);
        if (cIdx > -1) {
          cache[cIdx] = reconciled;
          saveLocalStorageClasses(cache);
        }
        return reconciled;
      }
    } catch (err) {
      console.warn(`[classService] Failed to fetch class ${classId} from API:`, err.message || err);
    }

    // 3. Cached list
    const classes = await getAllClasses(options);
    return classes.find(c => c.id === classId) || null;
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 3,
    cacheTime: 1000 * 60 * 30
  });
};

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Add a new class.
 */
export const addClass = async (classData) => {
  const id = classData.id || `class_${Date.now()}`;
  const now = new Date().toISOString();

  const newClass = {
    id,
    name: classData.name,
    level: classData.level || '',
    students: classData.students || [],
    studentCount: (classData.students || []).length,
    competitions: classData.competitions || [],
    competitionGrades: classData.competitionGrades || {},
    controls: classData.controls || [],
    grades: classData.grades || {},
    homework: classData.homework || {},
    language: classData.language || 'fr',
    program: classData.program || [],
    createdAt: now,
    updatedAt: now
  };

  // 1. Invalidate cache
  queryCache.invalidate('classes_all');
  queryCache.set(`class_detail_${id}`, newClass);

  // 2. Save to localStorage
  const current = getLocalStorageClasses() || [];
  current.unshift(newClass);
  saveLocalStorageClasses(current);

  // 3. MySQL / Companion API (strict persistence)
  try {
    await localDb.post('/classes', newClass);
  } catch (err) {
    console.error('[classService] addClass MySQL save failed:', err);
    if (err?.status === 401 || err?.status === 403) {
      throw new Error('انتهت صلاحية الجلسة — يرجى تسجيل الدخول مرة أخرى لإنشاء القسم في قاعدة البيانات.');
    }
    throw new Error(err?.message || 'تعذر حفظ القسم في قاعدة البيانات.');
  }

  // 4. Supabase
  if (supabase) {
    try {
      await supabase.from('classes').upsert({
        id,
        name: classData.name,
        level: classData.level,
        student_count: newClass.studentCount,
        students: newClass.students,
        competitions: newClass.competitions,
        competition_grades: newClass.competitionGrades,
        controls: newClass.controls,
        grades: newClass.grades,
        homework: newClass.homework,
        language: newClass.language,
        program: newClass.program,
        updated_at: now
      });
    } catch (err) {
      console.warn('[Supabase] Could not sync addClass to Supabase:', err.message);
    }
  }

  return id;
};

/**
 * Update specific fields on a class.
 */
export const updateClass = async (classId, updates) => {
  const now = new Date().toISOString();

  // 1. LocalStorage
  const rawCurrent = getLocalStorageClasses() || [];
  const idx = rawCurrent.findIndex(c => c.id === classId);

  if (idx !== -1) {
    const existing = rawCurrent[idx];
    const updatedStudents = updates.students !== undefined ? updates.students : existing.students;
    const studentCount = updates.studentCount !== undefined
      ? updates.studentCount
      : (Array.isArray(updatedStudents) ? updatedStudents.length : existing.studentCount);

    rawCurrent[idx] = {
      ...existing,
      ...updates,
      students: updatedStudents,
      studentCount,
      updatedAt: now
    };
    saveLocalStorageClasses(rawCurrent);
  }

  queryCache.invalidate('classes_all');
  queryCache.invalidate(`class_detail_${classId}`);

  // 2. Supabase DB Payload
  const dbUpdates = {
    updated_at: now
  };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.level !== undefined) dbUpdates.level = updates.level;
  if (updates.language !== undefined) dbUpdates.language = updates.language;
  if (updates.students !== undefined) {
    dbUpdates.students = updates.students;
    dbUpdates.student_count = updates.studentCount !== undefined ? updates.studentCount : (Array.isArray(updates.students) ? updates.students.length : 0);
  } else if (updates.studentCount !== undefined) {
    dbUpdates.student_count = updates.studentCount;
  }
  if (updates.competitions !== undefined) dbUpdates.competitions = updates.competitions;
  if (updates.competitionGrades !== undefined) dbUpdates.competition_grades = updates.competitionGrades;
  if (updates.controls !== undefined) dbUpdates.controls = updates.controls;
  if (updates.grades !== undefined) dbUpdates.grades = updates.grades;
  if (updates.homework !== undefined) dbUpdates.homework = updates.homework;
  if (updates.program !== undefined) dbUpdates.program = updates.program;

  if (supabase) {
    try {
      await supabase.from('classes').update(dbUpdates).eq('id', classId);
    } catch (err) {
      console.warn('[Supabase] Could not sync updateClass to Supabase:', err.message);
    }
  }

  // 3. MySQL / Companion API (always merge with server or local base, never silently fail)
  let savedMerged = null;
  try {
    let baseClass = null;
    try {
      baseClass = await localDb.get(`/classes/${encodeURIComponent(classId)}`);
    } catch (_) {
      // Class may not exist on server yet (e.g. seeded locally); fall back to local record
      baseClass = idx !== -1 ? rawCurrent[idx] : { id: classId };
    }
    const updatedStudents = updates.students !== undefined ? updates.students : baseClass?.students;
    const studentCount = updates.studentCount !== undefined
      ? updates.studentCount
      : (Array.isArray(updatedStudents) ? updatedStudents.length : baseClass?.studentCount || 0);

    const merged = {
      ...(baseClass || {}),
      ...updates,
      id: classId,
      students: updatedStudents || [],
      studentCount,
      updatedAt: now
    };
    const res = await localDb.post(`/classes/${encodeURIComponent(classId)}`, merged);
    savedMerged = normalizeClass(res?.class || merged);
  } catch (err) {
    console.error('[classService] updateClass MySQL save failed:', err);
    if (err?.status === 401 || err?.status === 403) {
      throw new Error('انتهت صلاحية الجلسة — يرجى تسجيل الدخول مرة أخرى لحفظ تعديلات القسم في قاعدة البيانات.');
    }
    throw new Error(err?.message || 'تعذر حفظ بيانات القسم في قاعدة البيانات.');
  }

  // 4. Update caches cleanly with server-confirmed record
  if (savedMerged) {
    queryCache.set(`class_detail_${classId}`, savedMerged);
    const nextCache = getLocalStorageClasses() || [];
    const nextIdx = nextCache.findIndex(c => c.id === classId);
    if (nextIdx > -1) nextCache[nextIdx] = savedMerged;
    else nextCache.unshift(savedMerged);
    saveLocalStorageClasses(nextCache);
  }
  return savedMerged;
};

/**
 * Force-sync all local class programs to MySQL (for manual sync button).
 */
export const syncLocalClassProgramsToCloud = async () => {
  const data = await localDb.get('/classes');
  if (!Array.isArray(data)) return { synced: false, classesCount: 0 };
  const mapped = data.map(normalizeClass);
  const reconciled = await rescueLocalProgramsIfNeeded(mapped);
  saveLocalStorageClasses(reconciled);
  queryCache.set('classes_all', reconciled);
  return { synced: true, classesCount: reconciled.length, classes: reconciled };
};

/**
 * Delete a class permanently from MySQL and local cache.
 */
export const deleteClass = async (classId) => {
  if (!classId) throw new Error('Identifiant de classe manquant.');

  try {
    await localDb.delete('/classes', classId);
  } catch (err) {
    console.error('[classService] deleteClass MySQL delete failed:', err);
    if (err?.status === 401 || err?.status === 403) {
      throw new Error('انتهت صلاحية الجلسة — يرجى تسجيل الدخول مرة أخرى لحذف القسم من قاعدة البيانات.');
    }
    throw new Error(err?.message || 'تعذر حذف القسم من قاعدة البيانات.');
  }

  queryCache.invalidate('classes_all');
  queryCache.invalidate(`class_detail_${classId}`);

  const rawCurrent = getLocalStorageClasses() || [];
  saveLocalStorageClasses(rawCurrent.filter(c => c.id !== classId));
};

/**
 * Record/assign a student's grade for a specific control/exam in a class.
 */
export const recordStudentExamGrade = async (classId, studentMassar, examName, score, totalQuestions) => {
  if (!classId || !studentMassar) return null;

  const rawCurrent = getLocalStorageClasses() || [];
  const cls = rawCurrent.find(c => c.id === classId);
  if (!cls) return null;

  const competitions = Array.isArray(cls.competitions) ? [...cls.competitions] : [];
  if (!competitions.includes(examName)) {
    competitions.push(examName);
  }

  const controls = Array.isArray(cls.controls) ? [...cls.controls] : [];
  if (!controls.includes(examName)) {
    controls.push(examName);
  }

  const competitionGrades = { ...(cls.competitionGrades || {}) };
  const grades = { ...(cls.grades || {}) };

  const numericScore = parseFloat(score);
  const total = parseFloat(totalQuestions) || 20;
  const score20 = (total > 0 && !isNaN(numericScore)) ? ((numericScore / total) * 20).toFixed(2) : numericScore;

  let displayScore = `${numericScore}/${total}`;
  if (total !== 20 && !isNaN(numericScore)) {
    displayScore = `${numericScore}/${total} (${score20}/20)`;
  }

  const studentKeys = new Set([
    studentMassar,
    studentMassar.toUpperCase(),
    studentMassar.toLowerCase()
  ]);

  if (cls.students && Array.isArray(cls.students)) {
    const st = cls.students.find(s =>
      (s.massarCode && s.massarCode.toUpperCase() === studentMassar.toUpperCase()) ||
      (s.id && s.id.toUpperCase() === studentMassar.toUpperCase())
    );
    if (st) {
      if (st.id) studentKeys.add(st.id);
      if (st.massarCode) studentKeys.add(st.massarCode);
    }
  }

  studentKeys.forEach(key => {
    if (!competitionGrades[key]) competitionGrades[key] = {};
    competitionGrades[key][examName] = displayScore;

    if (!grades[key]) grades[key] = {};
    grades[key][examName] = displayScore;
  });

  await updateClass(classId, { competitions, competitionGrades, controls, grades });
  return { examName, score: numericScore, totalQuestions: total, score20, displayScore };
};

/**
 * Remove a competition from a class.
 */
export const removeCompetitionFromClass = async (classId, competitionName) => {
  if (!classId || !competitionName) return false;

  const rawCurrent = getLocalStorageClasses() || [];
  const cls = rawCurrent.find(c => c.id === classId);
  if (!cls) return false;

  const updatedComps = (cls.competitions || []).filter(c => c !== competitionName);
  const updatedControls = (cls.controls || []).filter(c => c !== competitionName);
  
  const competitionGrades = { ...(cls.competitionGrades || {}) };
  Object.keys(competitionGrades).forEach(studentKey => {
    if (competitionGrades[studentKey] && competitionGrades[studentKey][competitionName] !== undefined) {
      delete competitionGrades[studentKey][competitionName];
    }
  });

  const grades = { ...(cls.grades || {}) };
  Object.keys(grades).forEach(studentKey => {
    if (grades[studentKey] && grades[studentKey][competitionName] !== undefined) {
      delete grades[studentKey][competitionName];
    }
  });

  await updateClass(classId, {
    competitions: updatedComps,
    controls: updatedControls,
    competitionGrades,
    grades
  });

  return true;
};

/**
 * Update/set a manual competition grade for a student in a class.
 */
export const updateCompetitionGrade = async (classId, studentMassar, competitionName, gradeValue) => {
  if (!classId || !studentMassar || !competitionName) return false;

  const rawCurrent = getLocalStorageClasses() || [];
  const cls = rawCurrent.find(c => c.id === classId);
  if (!cls) return false;

  const competitions = Array.isArray(cls.competitions) ? [...cls.competitions] : [];
  if (!competitions.includes(competitionName)) {
    competitions.push(competitionName);
  }

  const competitionGrades = { ...(cls.competitionGrades || {}) };
  const grades = { ...(cls.grades || {}) };

  const studentKeys = new Set([
    studentMassar,
    studentMassar.toUpperCase(),
    studentMassar.toLowerCase()
  ]);

  if (cls.students && Array.isArray(cls.students)) {
    const st = cls.students.find(s =>
      (s.massarCode && s.massarCode.toUpperCase() === studentMassar.toUpperCase()) ||
      (s.id && s.id.toUpperCase() === studentMassar.toUpperCase())
    );
    if (st) {
      if (st.id) studentKeys.add(st.id);
      if (st.massarCode) studentKeys.add(st.massarCode);
    }
  }

  studentKeys.forEach(key => {
    if (!competitionGrades[key]) competitionGrades[key] = {};
    competitionGrades[key][competitionName] = gradeValue;

    if (!grades[key]) grades[key] = {};
    grades[key][competitionName] = gradeValue;
  });

  await updateClass(classId, { competitions, competitionGrades, grades });
  return true;
};

