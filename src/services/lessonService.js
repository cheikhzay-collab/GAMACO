// src/services/lessonService.js
// High-performance resilient CRUD for lessons with SWR caching and direct single-lesson fetching.
// Supabase -> Local Companion API -> LocalStorage -> Seed Fallback.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';
import { queryCache } from './queryCache';

const STORAGE_KEY = 'lconq_lessons_db';

// Initial seed lessons if storage and remote DB are empty
const INITIAL_SEED_LESSONS = [
  {
    id: "MOCK-TC-MATH-01",
    title: "Fiche 01 : Logique Mathématique",
    subject: "Mathématiques",
    chapterNumber: "01",
    teacher: "Prof. Youssef",
    phone: "0681399067",
    schools: ["Bac BIOF"],
    level: "common_core_sci",
    docType: "course",
    isActive: true,
    createdAt: "2026-07-11T17:11:40.176Z",
    updatedAt: "2026-07-14T18:47:22.651Z",
    content: {
      level: "common_core_sci",
      doc_type: "course",
      header: {
        prep_title: "Tronc Commun Sciences",
        schools: ["Bac BIOF"],
        subject: "Mathématiques",
        fiche_title: "Fiche 01 : Logique Mathématique",
        teacher: "Prof. Youssef",
        phone: "0681399067"
      },
      sections: [
        {
          id: "sec-tc-1",
          title: "Assertions et connecteurs logiques",
          type: "definition",
          section_number: "1",
          section_header: "Résumé de cours : Logique",
          accent_text: "Définitions et propositions",
          items: [
            { type: "text", text: "Une **assertion** (ou proposition) est un énoncé mathématique qui a une valeur de vérité unique : soit **Vrai (V)** soit **Faux (F)**." },
            { type: "highlight_box", text: "L'implication $P \\Rightarrow Q$ est fausse uniquement dans le cas où $P$ est vraie et $Q$ est fausse. Elle est équivalente à $(\\text{non } P) \\text{ ou } Q$." },
            { type: "bullet", text: "La conjonction $P \\text{ et } Q$ est vraie si et seulement si les deux assertions sont vraies simultanément." }
          ],
          language: "fr"
        },
        {
          id: "ex-tc-1",
          title: "Exercice 1 : Négation de propositions",
          type: "exercise",
          section_number: "2",
          section_header: "Exercices d'application",
          content: "Écrire la négation mathématique de la proposition suivante :\n$$P: (\\forall x \\in \\mathbb{R})(\\exists y \\in \\mathbb{R}) : x + y > 0$$",
          solution: "Pour trouver la négation d'une proposition quantifiée, on inverse les quantificateurs et on prend la négation de l'assertion finale :\n\n- Le $\\forall x$ devient $\\exists x$\n- Le $\\exists y$ devient $\\forall y$\n- L'inégalité strict $>$ devient $\\le$\n\nAinsi, la négation est :\n$$\\text{non } P: (\\exists x \\in \\mathbb{R})(\\forall y \\in \\mathbb{R}) : x + y \\le 0$$",
          interactive_answers: [
            { question_idx: 1, label: "Entrez le symbole final de comparaison de la négation (<= ou >=) :", expected_answer: "<=" }
          ],
          language: "fr"
        }
      ],
      metadata: { language: "fr" }
    }
  },
  {
    id: "MOCK-L-TKF6NKSTI",
    title: "Barycentre",
    subject: "Mathématiques",
    chapterNumber: "",
    teacher: "Pr. LATRACH ABDELKBIR",
    phone: "",
    schools: [],
    level: "1bac_sci",
    docType: "course",
    isActive: true,
    createdAt: "2026-07-12T10:00:00.000Z",
    updatedAt: "2026-07-14T18:47:22.651Z",
    content: {
      level: "1bac_sci",
      doc_type: "course",
      header: {
        prep_title: "1ère Bac Sciences",
        schools: [],
        subject: "Mathématiques",
        fiche_title: "Barycentre",
        teacher: "Pr. LATRACH ABDELKBIR",
        phone: ""
      },
      sections: [],
      metadata: { language: "fr" }
    }
  }
];

// Helper to read from LocalStorage
const getLocalStorageLessons = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (e) {
    return null;
  }
};

const saveLocalStorageLessons = (lessons) => {
  if (!Array.isArray(lessons)) return;
  try {
    const lightweight = lessons.map(l => ({
      id: l.id,
      title: l.title,
      subject: l.subject,
      chapterNumber: l.chapterNumber || l.chapter_number,
      teacher: l.teacher,
      phone: l.phone,
      schools: l.schools,
      level: l.level || l.content?.level,
      docType: l.docType || l.doc_type || l.content?.doc_type,
      isActive: l.isActive !== undefined ? l.isActive : l.is_active,
      createdAt: l.createdAt || l.created_at,
      updatedAt: l.updatedAt || l.updated_at
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
  } catch (e) {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('lconq_draft_') || key.startsWith('lconq_lesson_'))) {
          localStorage.removeItem(key);
        }
      }
      const ultraLight = lessons.map(l => ({
        id: l.id,
        title: l.title,
        level: l.level || l.content?.level,
        docType: l.docType || l.doc_type || l.content?.doc_type,
        isActive: l.isActive !== undefined ? l.isActive : l.is_active,
        updatedAt: l.updatedAt || l.updated_at
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ultraLight));
    } catch (_) {}
  }
};

export const saveSingleLessonToLocalStorage = (lesson) => {
  if (!lesson?.id) return;
  try {
    localStorage.setItem(`lconq_lesson_${lesson.id}`, JSON.stringify(lesson));
  } catch (_) {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('lconq_lesson_') && key !== `lconq_lesson_${lesson.id}`) {
          localStorage.removeItem(key);
        }
      }
      localStorage.setItem(`lconq_lesson_${lesson.id}`, JSON.stringify(lesson));
    } catch (_) {}
  }
};

export const getSingleLessonFromLocalStorage = (lessonId) => {
  if (!lessonId) return null;
  try {
    const raw = localStorage.getItem(`lconq_lesson_${lessonId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const readRawLessons = () => getLocalStorageLessons() || [];

// Helper to map lesson fields to DB columns
const mapLessonToDB = (l) => {
  const docType = l.docType || l.doc_type || l.content?.doc_type || 'course';
  const isActive = l.isActive !== undefined ? Boolean(l.isActive) : (l.is_active !== undefined ? Boolean(l.is_active) : true);
  const chapterNumber = l.chapterNumber !== undefined ? l.chapterNumber : (l.chapter_number !== undefined ? l.chapter_number : null);
  const createdAt = l.createdAt || l.created_at || (l.content?.header?.date ? new Date(l.content.header.date).toISOString() : null) || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  return {
    title: l.title,
    subject: l.subject,
    chapter_number: chapterNumber,
    chapterNumber,
    teacher: l.teacher || null,
    phone: l.phone || null,
    schools: l.schools || [],
    level: l.level || l.content?.level || null,
    doc_type: docType,
    docType,
    content: {
      ...(l.content || {}),
      level: l.level || l.content?.level || null,
      doc_type: docType
    },
    is_active: isActive,
    isActive,
    created_at: createdAt,
    createdAt,
    updated_at: updatedAt,
    updatedAt
  };
};

const parseContent = (content) => {
  if (!content) return {};
  if (typeof content === 'object') return content;
  if (typeof content === 'string') {
    try {
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
  return {};
};

const parseSchools = (schools) => {
  if (Array.isArray(schools)) return schools;
  if (typeof schools === 'string') {
    try {
      const parsed = JSON.parse(schools);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const mapDBToLesson = (row) => {
  if (!row) return null;
  const parsedContent = parseContent(row.content);
  const docType = row.docType || row.doc_type || parsedContent?.doc_type || 'course';
  const isActive = row.isActive !== undefined ? Boolean(row.isActive) : (row.is_active !== undefined ? Boolean(row.is_active) : true);
  const isArchived = row.isArchived !== undefined ? Boolean(row.isArchived) : (row.is_archived !== undefined ? Boolean(row.is_archived) : false);
  const chapterNumber = row.chapterNumber !== undefined ? row.chapterNumber : (row.chapter_number !== undefined ? row.chapter_number : '');
  const createdAt = row.createdAt || row.created_at || (parsedContent?.header?.date ? new Date(parsedContent.header.date).toISOString() : null) || row.updatedAt || row.updated_at || new Date().toISOString();
  const updatedAt = row.updatedAt || row.updated_at || createdAt;
  const level = row.level || parsedContent?.level || null;

  return {
    id: row.id,
    title: row.title || parsedContent?.header?.fiche_title || 'Document',
    subject: row.subject || parsedContent?.header?.subject || '',
    chapterNumber,
    chapter_number: chapterNumber,
    teacher: row.teacher || parsedContent?.header?.teacher || '',
    phone: row.phone || parsedContent?.header?.phone || '',
    schools: parseSchools(row.schools || parsedContent?.header?.schools),
    content: parsedContent,
    level,
    docType,
    doc_type: docType,
    isActive,
    is_active: isActive,
    isArchived,
    is_archived: isArchived,
    createdAt,
    created_at: createdAt,
    updatedAt,
    updated_at: updatedAt,
  };
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch ALL lessons with SWR caching and fail-proof fallback sequence.
 */
export const getAllLessons = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('lessons_all', async () => {
    // 1. Try Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(mapDBToLesson);
          saveLocalStorageLessons(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] getAllLessons error:', err.message || err);
      }
    }

    // 2. Try Local Companion DB API (port 5002)
    try {
      const data = await localDb.get('/lessons');
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapDBToLesson);
        saveLocalStorageLessons(mapped);
        return mapped;
      }
    } catch (err) {}

    // 3. Try LocalStorage backup
    const localCache = getLocalStorageLessons();
    if (localCache && localCache.length > 0) {
      return localCache.map(mapDBToLesson);
    }

    // 4. Default Seed Fallback
    saveLocalStorageLessons(INITIAL_SEED_LESSONS);
    return INITIAL_SEED_LESSONS.map(mapDBToLesson);
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 3,
    cacheTime: 1000 * 60 * 30
  });
};

/**
 * Fetch only active lessons (student view).
 */
export const getActiveLessons = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('lessons_active', async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.filter(r => !r.is_archived).map(mapDBToLesson);
        }
      } catch (err) {
        console.warn('[Supabase] getActiveLessons error:', err.message || err);
      }
    }

    const allLessons = await getAllLessons(options);
    return allLessons.filter(l => l.isActive === true);
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 3,
    cacheTime: 1000 * 60 * 30,
  });
};

/**
 * Fetch a single lesson by ID.
 */
export const getLessonById = async (lessonId, options = {}) => {
  if (!lessonId) return null;
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache(`lesson_detail_${lessonId}`, async () => {
    // 1. Try Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .maybeSingle();

        if (!error && data) {
          const mapped = mapDBToLesson(data);
          if (mapped) {
            saveSingleLessonToLocalStorage(mapped);
            return mapped;
          }
        }
      } catch (err) {
        console.warn(`[Supabase] Failed to fetch single lesson ${lessonId}:`, err.message || err);
      }
    }

    // 2. Try single lesson from local storage
    const singleLocal = getSingleLessonFromLocalStorage(lessonId);
    if (singleLocal && singleLocal.content && Object.keys(singleLocal.content).length > 0) {
      return singleLocal;
    }

    // 3. Try Companion API
    try {
      const data = await localDb.get(`/lessons/${lessonId}`);
      if (data) {
        const mapped = mapDBToLesson(data);
        saveSingleLessonToLocalStorage(mapped);
        return mapped;
      }
    } catch {}

    // 4. Fallback to cached list
    const allLessons = await getAllLessons();
    const found = allLessons.find(l => l.id === lessonId);
    if (found) {
      saveSingleLessonToLocalStorage(found);
    }
    return found || null;
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 3,
    cacheTime: 1000 * 60 * 60
  });
};

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Add a new lesson.
 */
export const addLesson = async (lessonData) => {
  const id = lessonData.id || 'MOCK-L-' + Math.random().toString(36).substring(2, 11).toUpperCase();
  const now = new Date().toISOString();
  
  const mapped = {
    id,
    title: lessonData.title,
    subject: lessonData.subject,
    chapterNumber: lessonData.chapterNumber || lessonData.chapter_number || '',
    teacher: lessonData.teacher || '',
    phone: lessonData.phone || '',
    schools: lessonData.schools || [],
    content: {
      ...(lessonData.content || {}),
      level: lessonData.level || lessonData.content?.level || null,
      doc_type: lessonData.docType || lessonData.content?.doc_type || 'course'
    },
    level: lessonData.level || lessonData.content?.level || null,
    docType: lessonData.docType || lessonData.content?.doc_type || 'course',
    isActive: lessonData.isActive !== undefined ? lessonData.isActive : true,
    createdAt: now,
    updatedAt: now
  };

  // 1. LocalStorage first
  const rawLessons = readRawLessons().filter(l => l.id !== id);
  rawLessons.unshift(mapped);
  saveLocalStorageLessons(rawLessons);
  saveSingleLessonToLocalStorage(mapped);

  // 2. Invalidate cache
  queryCache.invalidate('lessons_all');
  queryCache.set(`lesson_detail_${id}`, mapped);

  // 3. Sync to Supabase
  const dbLesson = { 
    id, 
    ...mapLessonToDB(lessonData), 
    level: lessonData.level || lessonData.content?.level || null,
    doc_type: lessonData.docType || lessonData.content?.doc_type || 'course',
    created_at: now 
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('lessons').upsert(dbLesson, { onConflict: 'id' });
      if (error) console.warn('[Supabase] Error syncing addLesson:', error.message);
    } catch (err) {
      console.warn('[Supabase] Error syncing addLesson:', err.message || err);
    }
  }

  // 4. Companion API
  try {
    await localDb.post('/lessons', dbLesson);
  } catch (err) {}

  return id;
};

/**
 * Update dynamic fields of a lesson.
 */
export const updateLesson = async (lessonId, updates) => {
  const now = new Date().toISOString();
  
  // 1. LocalStorage first
  const rawLessons = readRawLessons();
  const idx = rawLessons.findIndex(l => l.id === lessonId);
  const singleStored = getSingleLessonFromLocalStorage(lessonId);
  const fallbackContent = (singleStored && singleStored.content && Object.keys(singleStored.content).length > 0)
    ? singleStored.content
    : ((idx !== -1 && rawLessons[idx]?.content) ? rawLessons[idx].content : {});

  let updatedRecord = null;
  if (idx !== -1) {
    const original = rawLessons[idx];
    const mergedContent = updates.content !== undefined
      ? { ...fallbackContent, ...updates.content }
      : fallbackContent;

    const docType = updates.docType || updates.doc_type || updates.content?.doc_type || original.docType || original.doc_type || 'course';
    const level = updates.level || updates.content?.level || original.level;
    const isActive = updates.isActive !== undefined ? Boolean(updates.isActive) : (updates.is_active !== undefined ? Boolean(updates.is_active) : (original.isActive !== undefined ? Boolean(original.isActive) : true));
    const isArchived = updates.isArchived !== undefined ? Boolean(updates.isArchived) : (updates.is_archived !== undefined ? Boolean(updates.is_archived) : (original.isArchived !== undefined ? Boolean(original.isArchived) : false));
    const chapterNumber = updates.chapterNumber !== undefined ? updates.chapterNumber : (updates.chapter_number !== undefined ? updates.chapter_number : (original.chapterNumber || original.chapter_number || ''));
    const createdAt = original.createdAt || original.created_at || updates.createdAt || updates.created_at || (original.content?.header?.date ? new Date(original.content.header.date).toISOString() : null) || now;

    updatedRecord = {
      ...original,
      ...updates,
      content: {
        ...mergedContent,
        level,
        doc_type: docType
      },
      level,
      docType,
      doc_type: docType,
      isActive,
      is_active: isActive,
      isArchived,
      is_archived: isArchived,
      chapterNumber,
      chapter_number: chapterNumber,
      createdAt,
      created_at: createdAt,
      updatedAt: now,
      updated_at: now
    };
    rawLessons[idx] = updatedRecord;
    saveLocalStorageLessons(rawLessons);
  } else {
    const mergedContent = updates.content !== undefined
      ? { ...fallbackContent, ...updates.content }
      : fallbackContent;

    const docType = updates.docType || updates.doc_type || updates.content?.doc_type || 'course';
    const level = updates.level || updates.content?.level;
    const isActive = updates.isActive !== undefined ? Boolean(updates.isActive) : (updates.is_active !== undefined ? Boolean(updates.is_active) : true);
    const isArchived = updates.isArchived !== undefined ? Boolean(updates.isArchived) : (updates.is_archived !== undefined ? Boolean(updates.is_archived) : false);
    const chapterNumber = updates.chapterNumber !== undefined ? updates.chapterNumber : (updates.chapter_number !== undefined ? updates.chapter_number : '');
    const createdAt = updates.createdAt || updates.created_at || now;

    updatedRecord = {
      id: lessonId,
      ...updates,
      content: {
        ...mergedContent,
        level,
        doc_type: docType
      },
      level,
      docType,
      doc_type: docType,
      isActive,
      is_active: isActive,
      isArchived,
      is_archived: isArchived,
      chapterNumber,
      chapter_number: chapterNumber,
      createdAt,
      created_at: createdAt,
      updatedAt: now,
      updated_at: now
    };
    rawLessons.unshift(updatedRecord);
    saveLocalStorageLessons(rawLessons);
  }

  if (updatedRecord) {
    saveSingleLessonToLocalStorage(updatedRecord);
  }

  // 2. Cache updates — Keep updatedRecord in cache (do not invalidate immediately!)
  queryCache.set(`lesson_detail_${lessonId}`, updatedRecord);
  
  // Safely update 'lessons_all' and 'lessons_active' in cache so components don't see empty list
  try {
    const cachedAll = queryCache.get('lessons_all');
    if (Array.isArray(cachedAll) && cachedAll.length > 0) {
      const allIdx = cachedAll.findIndex(l => l.id === lessonId);
      const nextAll = [...cachedAll];
      if (allIdx > -1) {
        nextAll[allIdx] = { ...nextAll[allIdx], ...updatedRecord };
      } else {
        nextAll.unshift(updatedRecord);
      }
      queryCache.set('lessons_all', nextAll);
    } else {
      queryCache.invalidate('lessons_all');
    }
  } catch (_) {
    queryCache.invalidate('lessons_all');
  }

  try {
    const cachedActive = queryCache.get('lessons_active');
    if (Array.isArray(cachedActive) && cachedActive.length > 0) {
      let nextActive;
      if (updatedRecord.isActive) {
        const actIdx = cachedActive.findIndex(l => l.id === lessonId);
        if (actIdx > -1) {
          nextActive = [...cachedActive];
          nextActive[actIdx] = { ...nextActive[actIdx], ...updatedRecord };
        } else {
          nextActive = [updatedRecord, ...cachedActive];
        }
      } else {
        nextActive = cachedActive.filter(l => l.id !== lessonId);
      }
      queryCache.set('lessons_active', nextActive);
    } else {
      queryCache.invalidate('lessons_active');
    }
  } catch (_) {
    queryCache.invalidate('lessons_active');
  }

  // 3. Build DB payload
  const dbUpdates = { updated_at: now };
  if (updates.title         !== undefined) dbUpdates.title          = updates.title;
  if (updates.subject       !== undefined) dbUpdates.subject        = updates.subject;
  if (updates.chapterNumber !== undefined) {
    dbUpdates.chapter_number = updates.chapterNumber;
    dbUpdates.chapterNumber  = updates.chapterNumber;
  }
  if (updates.teacher       !== undefined) dbUpdates.teacher        = updates.teacher;
  if (updates.phone         !== undefined) dbUpdates.phone          = updates.phone;
  if (updates.schools       !== undefined) dbUpdates.schools        = updates.schools;
  if (updates.level         !== undefined) dbUpdates.level          = updates.level;
  if (updates.docType       !== undefined) {
    dbUpdates.doc_type = updates.docType;
    dbUpdates.docType  = updates.docType;
  }
  if (updates.isActive      !== undefined) {
    dbUpdates.is_active = Boolean(updates.isActive);
    dbUpdates.isActive  = Boolean(updates.isActive);
  }
  if (updates.content !== undefined) {
    dbUpdates.content = {
      ...(updates.content || {}),
      ...(updates.level ? { level: updates.level } : {}),
      ...(updates.docType ? { doc_type: updates.docType } : {})
    };
  }

  // 4. Supabase sync
  let supabaseSuccess = false;
  let supabaseError = null;

  if (supabase) {
    try {
      const fullDbRecord = updatedRecord ? mapLessonToDB(updatedRecord) : {};
      const payload = {
        id: lessonId,
        ...fullDbRecord,
        ...dbUpdates,
        content: {
          ...((fullDbRecord && fullDbRecord.content) || {}),
          ...(dbUpdates.content || {})
        }
      };
      if (!payload.title && updatedRecord?.title) payload.title = updatedRecord.title;
      if (!payload.title && updates.title) payload.title = updates.title;

      const { error } = await supabase.from('lessons').upsert(payload, { onConflict: 'id' });
      if (error) {
        supabaseError = error.message;
        console.warn('[Supabase] Error syncing updateLesson:', error.message);
      } else {
        supabaseSuccess = true;
      }
    } catch (err) {
      supabaseError = err.message || String(err);
      console.warn('[Supabase] Error syncing updateLesson:', err.message || err);
    }
  }

  // 5. Companion API (Preserve both camelCase and snake_case in fullPayload)
  let localDbSuccess = false;
  try {
    const fullPayload = {
      id: lessonId,
      ...(updatedRecord || {}),
      ...(updatedRecord ? mapLessonToDB(updatedRecord) : {}),
      ...dbUpdates,
      docType: updatedRecord?.docType || updates.docType || 'course',
      doc_type: updatedRecord?.docType || updates.docType || 'course',
      isActive: updatedRecord?.isActive !== undefined ? Boolean(updatedRecord.isActive) : true,
      is_active: updatedRecord?.isActive !== undefined ? Boolean(updatedRecord.isActive) : true,
      createdAt: updatedRecord?.createdAt || now,
      created_at: updatedRecord?.createdAt || now,
      updatedAt: now,
      updated_at: now
    };
    await localDb.post(`/lessons/${lessonId}`, fullPayload);
    localDbSuccess = true;
  } catch (err) {}

  return { 
    success: true, 
    id: lessonId,
    supabaseSuccess,
    localDbSuccess,
    supabaseError,
    timestamp: now
  };
};

/**
 * Toggle active status of a lesson.
 */
export const toggleLessonStatus = async (lessonId, currentStatus) => {
  return updateLesson(lessonId, { isActive: !currentStatus });
};

/**
 * Permanently delete a lesson.
 */
export const deleteLesson = async (lessonId) => {
  const rawLessons = readRawLessons();
  saveLocalStorageLessons(rawLessons.filter(l => l.id !== lessonId));

  queryCache.invalidate('lessons_all');
  queryCache.invalidate(`lesson_detail_${lessonId}`);

  if (supabase) {
    try {
      await supabase.from('lessons').delete().eq('id', lessonId);
    } catch (err) {
      console.warn('[Supabase] Error syncing deleteLesson:', err.message || err);
    }
  }

  try {
    await localDb.delete('/lessons', lessonId);
  } catch (err) {}
};
