// src/services/userService.js
// CRUD for user profiles, progress, mock exam history, and activity.
// Built cleanly for Supabase with graceful Local Companion and LocalStorage fallbacks.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';
import { queryCache } from './queryCache';
import initialUsersData from '../../data/users.json';

const STORAGE_KEY = 'lconq_users_db';

const getLocalStorageUsers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (e) {
    return null;
  }
};

const saveLocalStorageUsers = (users) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('[LocalStorage] Failed to save users:', e);
  }
};

// Helper to map camelCase fields to snake_case DB columns
const mapProfileToDB = (profile) => ({
  name: profile.name,
  email: profile.email,
  role: profile.role,
  tier: profile.tier,
  xp: profile.xp,
  streak: profile.streak,
  rank: profile.rank,
  total_students: profile.totalStudents,
  joined: profile.joined,
  subscription: profile.subscription,
  phone: profile.phone,
  city: profile.city,
  school: profile.school,
  downloads: profile.downloads,
  crm: profile.crm,
  class_id: profile.classId || profile.class_id || null,
});

// Helper to map snake_case DB columns to camelCase fields
const mapDBToProfile = (row) => {
  if (!row) return null;
  const classId = row.class_id || row.classId || null;
  return {
    id: row.id,
    uid: row.id || row.uid,
    name: row.name,
    email: row.email,
    role: row.role || 'student',
    tier: row.tier || 'freemium',
    xp: row.xp || 0,
    streak: row.streak || 0,
    rank: row.rank || 0,
    totalStudents: row.total_students || row.totalStudents,
    joined: row.joined || row.created_at,
    subscription: row.subscription,
    createdAt: row.created_at || row.joined,
    updatedAt: row.updated_at,
    phone: row.phone,
    city: row.city,
    school: row.school,
    downloads: row.downloads,
    crm: row.crm || { stage: 'Lead', notes: [], reminders: [], interactions: [] },
    classId: classId,
    class_id: classId,
    className: row.class_name || row.className || classId,
    massarCode: row.massarCode || row.id
  };
};

// ─── User Profile ─────────────────────────────────────────────────────────────

/**
 * Fetch a single user profile by UID.
 */
export const getUserDoc = async (uid) => {
  if (!uid) return null;

  // 1. Try Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (!error && data) {
        return mapDBToProfile(data);
      }
    } catch (err) {
      console.warn('[Supabase] getUserDoc error:', err.message || err);
    }
  }

  // 2. Try Local Companion
  try {
    const companionUser = await localDb.get(`/users/${uid}`);
    if (companionUser && (companionUser.id || companionUser.uid)) {
      return mapDBToProfile(companionUser);
    }
  } catch (err) {}

  // 3. Fallback to LocalStorage
  const localList = getLocalStorageUsers();
  if (localList) {
    const found = localList.find(u => u.id === uid || u.uid === uid);
    if (found) return found;
  }

  return null;
};

/**
 * Create a new user profile.
 */
export const createUserDoc = async (uid, data) => {
  const profile = {
    id: uid,
    ...data,
    joined: data.joined || new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Supabase
  if (supabase) {
    try {
      const dbRow = { id: uid, ...mapProfileToDB(profile) };
      const { error } = await supabase.from('profiles').upsert(dbRow, { onConflict: 'id' });
      if (error) {
        console.warn('[Supabase] createUserDoc error:', error.message);
      }
    } catch (err) {
      console.warn('[Supabase] Network error during createUserDoc:', err.message || err);
    }
  }

  // 2. Local Companion
  try {
    await localDb.post('/users', profile);
  } catch (err) {}

  // 3. LocalStorage
  const currentUsers = getLocalStorageUsers() || [];
  const updatedUsers = [...currentUsers.filter(u => u.id !== uid && u.uid !== uid), profile];
  saveLocalStorageUsers(updatedUsers);

  return profile;
};

/**
 * Update an existing user profile (partial update).
 */
export const updateUserDoc = async (uid, data) => {
  if (!uid) return null;

  // 1. Supabase
  if (supabase) {
    try {
      const dbData = { ...mapProfileToDB(data), updated_at: new Date().toISOString() };
      Object.keys(dbData).forEach(k => dbData[k] === undefined && delete dbData[k]);

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(dbData)
        .eq('id', uid)
        .select()
        .maybeSingle();

      if (!error && updated) {
        return mapDBToProfile(updated);
      }
    } catch (err) {
      console.warn('[Supabase] updateUserDoc error:', err.message || err);
    }
  }

  // 2. Local Companion
  try {
    await localDb.put(`/users/${uid}`, data);
  } catch (err) {}

  // 3. LocalStorage
  const currentUsers = getLocalStorageUsers() || [];
  const idx = currentUsers.findIndex(u => u.id === uid || u.uid === uid);
  if (idx !== -1) {
    currentUsers[idx] = { ...currentUsers[idx], ...data, updatedAt: new Date().toISOString() };
    saveLocalStorageUsers(currentUsers);
    return currentUsers[idx];
  }

  return null;
};

/**
 * Update subscription for a user.
 */
export const setUserSubscription = async (uid, subscription) => {
  return updateUserDoc(uid, {
    tier: subscription?.status === 'active' ? 'premium' : 'freemium',
    subscription
  });
};

// ─── Question Progress (SRS) ──────────────────────────────────────────────────

/**
 * Save / upsert SRS progress for a specific question.
 */
export const saveQuestionProgress = async (uid, questionId, cardData) => {
  if (!uid || !questionId) return;

  const row = {
    user_id: uid,
    question_id: questionId,
    difficulty: cardData.difficulty,
    stability: cardData.stability,
    repetitions: cardData.repetitions,
    ease_factor: cardData.easeFactor,
    last_review_date: cardData.lastReviewDate ? new Date(cardData.lastReviewDate).toISOString() : null,
    next_review_date: cardData.nextReviewDate ? new Date(cardData.nextReviewDate).toISOString() : null,
    updated_at: new Date().toISOString()
  };

  // 1. Supabase
  if (supabase) {
    try {
      const { error } = await supabase.from('progress').upsert(row, { onConflict: 'user_id,question_id' });
      if (error) console.warn('[Supabase] saveQuestionProgress error:', error.message);
    } catch (err) {
      console.warn('[Supabase] Network error during saveQuestionProgress:', err.message || err);
    }
  }

  // 2. Local Companion
  try {
    await localDb.post('/progress', {
      user_id: uid,
      question_id: questionId,
      ...cardData
    });
  } catch (err) {}
};

/**
 * Fetch all SRS progress cards for a user.
 */
export const getUserProgress = async (uid) => {
  if (!uid) return {};

  const mapRow = (r) => ({
    difficulty: r.difficulty,
    stability: r.stability,
    repetitions: r.repetitions,
    easeFactor: r.ease_factor,
    lastReviewDate: r.last_review_date,
    nextReviewDate: r.next_review_date,
    updatedAt: r.updated_at
  });

  // 1. Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', uid);

      if (!error && Array.isArray(data)) {
        const result = {};
        data.forEach(r => { result[r.question_id] = mapRow(r); });
        return result;
      }
    } catch (err) {
      console.warn('[Supabase] getUserProgress error:', err.message || err);
    }
  }

  // 2. Local Companion
  try {
    const list = await localDb.get(`/progress?user_id=${uid}`);
    if (Array.isArray(list)) {
      const result = {};
      list.forEach(r => { result[r.question_id] = mapRow(r); });
      return result;
    }
  } catch (err) {}

  return {};
};

export const getAllProgress = getUserProgress;

// ─── Mock Exam Results ────────────────────────────────────────────────────────

/**
 * Save the result of a completed mock exam.
 */
export const saveMockResult = async (uid, resultData) => {
  if (!uid) return;

  const row = {
    user_id: uid,
    exam_id: resultData.examId,
    exam_name: resultData.examName || null,
    school: resultData.school || null,
    score: resultData.score,
    max_score: resultData.maxScore,
    pct: resultData.pct,
    correct_count: resultData.correctCount,
    wrong_count: resultData.wrongCount,
    empty_count: resultData.emptyCount,
    mode: resultData.mode || 'exam',
    date: resultData.date ? new Date(resultData.date).toISOString() : new Date().toISOString()
  };

  // 1. Supabase
  if (supabase) {
    try {
      const { error } = await supabase.from('mock_history').insert(row);
      if (error) console.warn('[Supabase] saveMockResult error:', error.message);
    } catch (err) {
      console.warn('[Supabase] Network error during saveMockResult:', err.message || err);
    }
  }

  // 2. Local Companion
  try {
    await localDb.post('/mock_history', row);
  } catch (err) {}
};

/**
 * Fetch mock exam history for a user.
 */
export const getMockHistory = async (uid) => {
  if (!uid) return [];

  const mapRow = (r) => ({
    id: r.id,
    examId: r.exam_id,
    examName: r.exam_name,
    school: r.school,
    score: r.score,
    maxScore: r.max_score,
    pct: r.pct,
    correctCount: r.correct_count,
    wrongCount: r.wrong_count,
    emptyCount: r.empty_count,
    mode: r.mode,
    date: r.date
  });

  // 1. Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('mock_history')
        .select('*')
        .eq('user_id', uid)
        .order('date', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(mapRow);
      }
    } catch (err) {
      console.warn('[Supabase] getMockHistory error:', err.message || err);
    }
  }

  // 2. Local Companion
  try {
    const list = await localDb.get(`/mock_history?user_id=${uid}`);
    if (Array.isArray(list)) return list.map(mapRow);
  } catch (err) {}

  return [];
};

// ─── Daily Activity ───────────────────────────────────────────────────────────

/**
 * Increment today's activity counter for a user.
 */
export const incrementDailyActivity = async (uid) => {
  if (!uid) return;
  const today = new Date().toISOString().split('T')[0];

  // 1. Supabase: RPC or upsert
  if (supabase) {
    try {
      // First fetch today's count
      const { data } = await supabase
        .from('activity')
        .select('count')
        .eq('user_id', uid)
        .eq('date', today)
        .maybeSingle();

      const newCount = (data?.count || 0) + 1;
      await supabase
        .from('activity')
        .upsert({ user_id: uid, date: today, count: newCount }, { onConflict: 'user_id,date' });
      return;
    } catch (err) {
      console.warn('[Supabase] incrementDailyActivity error:', err.message || err);
    }
  }

  // 2. Local Companion
  try {
    await localDb.post('/activity/increment', { user_id: uid, date: today });
  } catch (err) {}
};

/**
 * Fetch daily activity counts for the last N days.
 */
export const getRecentActivity = async (uid, days = 90) => {
  if (!uid) return {};

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // 1. Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('activity')
        .select('date, count')
        .eq('user_id', uid)
        .gte('date', cutoffStr);

      if (!error && Array.isArray(data)) {
        const result = {};
        data.forEach(row => { result[row.date] = row.count || 0; });
        return result;
      }
    } catch (err) {
      console.warn('[Supabase] getRecentActivity error:', err.message || err);
    }
  }

  // 2. Local Companion
  try {
    const list = await localDb.get(`/activity?user_id=${uid}&since=${cutoffStr}`);
    if (Array.isArray(list)) {
      const result = {};
      list.forEach(row => { result[row.date] = row.count || 0; });
      return result;
    }
  } catch (err) {}

  return {};
};

/**
 * Delete a user profile and associated data.
 */
export const deleteUser = async (uid) => {
  if (!uid) return false;

  // 1. Delete from MySQL backend FIRST
  try {
    await localDb.delete('/users', uid);
  } catch (err) {
    console.error('[userService] deleteUser MySQL delete failed:', err);
    if (err?.status === 401 || err?.status === 403) {
      throw new Error('Session expirée — veuillez vous reconnecter pour supprimer le compte.');
    }
    throw new Error(err?.message || 'Impossible de supprimer le compte de la base de données.');
  }

  // 2. Clean up LocalStorage & caches
  const currentUsers = getLocalStorageUsers() || [];
  const filtered = currentUsers.filter(u => u.id !== uid && u.uid !== uid);
  saveLocalStorageUsers(filtered);
  queryCache.invalidate('all_users_list');

  return true;
};

/**
 * Fetch all registered users for the Admin Dashboard.
 */
export const getAllUsers = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('all_users_list', async () => {
    // 1. Supabase
    if (supabase) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_profiles');
        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          const mapped = rpcData.map(mapDBToProfile);
          saveLocalStorageUsers(mapped);
          return mapped;
        }
      } catch (rpcErr) {
        console.warn('[Supabase] RPC get_all_profiles failed, trying direct select:', rpcErr.message || rpcErr);
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('joined', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(mapDBToProfile);
          saveLocalStorageUsers(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] getAllUsers select error:', err.message || err);
      }
    }

    // 2. Local Companion
    try {
      const list = await localDb.get('/users');
      if (Array.isArray(list) && list.length > 0) {
        const mapped = list.map(mapDBToProfile);
        saveLocalStorageUsers(mapped);
        return mapped;
      }
    } catch (err) {}

    // 3. LocalStorage cache
    const cache = getLocalStorageUsers();
    if (Array.isArray(cache) && cache.length > 0) {
      return cache;
    }

    // 4. Seed fallback
    if (Array.isArray(initialUsersData) && initialUsersData.length > 0) {
      const mapped = initialUsersData.map(mapDBToProfile);
      saveLocalStorageUsers(mapped);
      return mapped;
    }

    return [];
  }, { forceRefresh });
};

/**
 * Fetch the public leaderboard of top 100 students with SWR caching.
 */
export const getLeaderboard = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('leaderboard_all', async () => {
    // 1. Supabase
    if (supabase) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_leaderboard');
        if (!rpcError && rpcData && rpcData.length > 0) {
          return rpcData;
        }
      } catch (err) {}

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name, xp, streak, tier, role')
          .neq('role', 'admin')
          .not('name', 'ilike', 'Directeur')
          .order('xp', { ascending: false })
          .limit(100);

        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.warn('[Supabase] getLeaderboard select error:', err.message || err);
      }
    }

    // 2. Local Companion fallback
    try {
      const list = await localDb.get('/users');
      if (Array.isArray(list) && list.length > 0) {
        return list
          .filter(u => u.role !== 'admin' && !u.name?.toLowerCase().includes('directeur'))
          .sort((a, b) => (b.xp || 0) - (a.xp || 0))
          .slice(0, 100)
          .map(u => ({ name: u.name, xp: u.xp || 0, streak: u.streak || 0, tier: u.tier || 'freemium' }));
      }
    } catch (err) {}

    return [];
  }, { forceRefresh });
};

/**
 * Log a user login.
 */
export const addLoginLog = async (uid) => {
  if (!uid) return;
  const id = `ll_${uid}_${Date.now()}`;

  if (supabase) {
    try {
      await supabase.from('login_logs').insert({ id, user_id: uid, logged_at: new Date().toISOString() });
    } catch (err) {
      console.warn('[Supabase] addLoginLog error:', err.message || err);
    }
  }
};

/**
 * Fetch login logs for a user.
 */
export const getLoginLogs = async (uid) => {
  if (!uid) return [];
  const mapRow = row => ({ id: row.id, userId: row.user_id, loggedAt: row.logged_at });

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('login_logs')
        .select('*')
        .eq('user_id', uid)
        .order('logged_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(mapRow);
      }
    } catch (err) {
      console.warn('[Supabase] getLoginLogs error:', err.message || err);
    }
  }

  return [];
};

/**
 * Fetch progress cards deltas since a timestamp.
 */
export const getProgressDeltas = async (uid, sinceTimestamp) => {
  if (!uid) return {};

  const mapRow = row => ({
    difficulty: row.difficulty,
    stability: row.stability,
    repetitions: row.repetitions,
    easeFactor: row.ease_factor,
    lastReviewDate: row.last_review_date,
    nextReviewDate: row.next_review_date,
    updatedAt: row.updated_at
  });

  if (supabase) {
    try {
      let query = supabase.from('progress').select('*').eq('user_id', uid);
      if (sinceTimestamp) query = query.gt('updated_at', sinceTimestamp);
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const result = {};
        data.forEach(row => { result[row.question_id] = mapRow(row); });
        return result;
      }
    } catch (err) {
      console.warn('[Supabase] getProgressDeltas error:', err.message || err);
    }
  }

  return {};
};

/**
 * Synchronize missing auth users with Supabase profiles (Admin only).
 */
export const syncStudentsWithSupabase = async () => {
  if (!supabase) return { success: true, synchronized_count: 0 };
  try {
    const { data, error } = await supabase.rpc('sync_auth_users_to_profiles');
    if (error) {
      console.warn('[Supabase] Failed to synchronize students:', error.message || error);
      return { success: false, synchronized_count: 0 };
    }
    return data || { success: true, synchronized_count: 0 };
  } catch (err) {
    console.warn('[Supabase] Network error during syncStudentsWithSupabase:', err.message || err);
    return { success: false, synchronized_count: 0 };
  }
};

/**
 * Log a document/report download.
 */
export const logUserDownload = async (uid, downloadData) => {
  if (!uid || !supabase) return;

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('downloads')
      .eq('id', uid)
      .maybeSingle();

    const currentDownloads = Array.isArray(profile?.downloads) ? profile.downloads : [];
    const newEntry = { ...downloadData, downloadedAt: new Date().toISOString() };
    const updatedDownloads = [newEntry, ...currentDownloads].slice(0, 100);

    await supabase
      .from('profiles')
      .update({ downloads: updatedDownloads })
      .eq('id', uid);
  } catch (err) {
    console.warn('[Supabase] logUserDownload error:', err.message || err);
  }
};


