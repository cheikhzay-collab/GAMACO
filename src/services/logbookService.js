// src/services/logbookService.js
// Logbook (Cahier de Textes) CRUD utilities with native MySQL API persistence (/api/logbook)
// + safe automatic one-way rescue of any legacy localStorage-only entries to MySQL.

import { localDb } from '../lib/localDbClient';

const LOGBOOK_CACHE_KEY = 'logbook_entries';
const LOGBOOK_DELETED_KEY = 'logbook_deleted_ids_v1';

const readLocalEntries = () => {
  try {
    const raw = localStorage.getItem(LOGBOOK_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const writeLocalEntries = (entries) => {
  try {
    localStorage.setItem(LOGBOOK_CACHE_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
  } catch (_) {}
};

const getDeletedIds = () => {
  try {
    const raw = localStorage.getItem(LOGBOOK_DELETED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (_) {
    return new Set();
  }
};

const markDeletedId = (id) => {
  if (!id) return;
  try {
    const set = getDeletedIds();
    set.add(id);
    // Keep bounded to last 500 IDs
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(LOGBOOK_DELETED_KEY, JSON.stringify(arr));
  } catch (_) {}
};

const hasAdminSession = () => {
  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('gamaco_auth_token');
    const rawUser = localStorage.getItem('lconq_current_user');
    if (!token || !rawUser) return false;
    const u = JSON.parse(rawUser);
    return u?.role === 'admin';
  } catch (_) {
    return false;
  }
};

const sortByDateAsc = (entries) => {
  return [...entries].sort((a, b) => {
    const dA = new Date(a?.date || a?.createdAt || 0).getTime();
    const dB = new Date(b?.date || b?.createdAt || 0).getTime();
    return dA - dB;
  });
};

/**
 * Push any localStorage-only logbook entries up to MySQL (/api/logbook)
 * so existing work entered before MySQL migration is never lost.
 */
export const syncLocalLogbookToCloud = async () => {
  const localEntries = readLocalEntries();
  const deletedIds = getDeletedIds();

  let serverEntries = [];
  try {
    const res = await localDb.get('/logbook');
    serverEntries = Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[logbookService] Cannot reach /api/logbook for sync:', err.message);
    return { synced: false, total: localEntries.length, uploaded: 0, entries: localEntries, error: err.message };
  }

  const serverMap = new Map(serverEntries.filter(e => e && e.id).map(e => [e.id, e]));
  const missingOnServer = localEntries.filter(
    e => e && e.id && !serverMap.has(e.id) && !deletedIds.has(e.id)
  );

  let uploaded = 0;
  if (missingOnServer.length > 0 && hasAdminSession()) {
    try {
      await localDb.post('/logbook', { entries: missingOnServer });
      for (const item of missingOnServer) {
        serverMap.set(item.id, item);
      }
      uploaded = missingOnServer.length;
    } catch (uploadErr) {
      console.warn('[logbookService] Auto-migration of local logbook entries failed:', uploadErr.message);
      // Keep local entries visible in merged result without wiping them!
      for (const item of missingOnServer) {
        serverMap.set(item.id, item);
      }
    }
  } else if (missingOnServer.length > 0) {
    // Not logged in as admin yet — preserve local entries in cache until admin logs in
    for (const item of missingOnServer) {
      serverMap.set(item.id, item);
    }
  }

  const merged = sortByDateAsc(Array.from(serverMap.values()));
  writeLocalEntries(merged);
  return { synced: true, total: merged.length, uploaded, entries: merged };
};

/**
 * Get logbook entries from MySQL database (with automatic safe migration of legacy local entries).
 * @param {string} [classId] - Optional class ID to filter by
 * @returns {Promise<Array>}
 */
export const getLogbookEntries = async (classId) => {
  let allEntries = null;

  try {
    const syncRes = await syncLocalLogbookToCloud();
    if (Array.isArray(syncRes.entries)) {
      allEntries = syncRes.entries;
    }
  } catch (err) {
    console.warn('[logbookService] MySQL fetch warning, falling back to local cache:', err.message || err);
  }

  if (!allEntries) {
    allEntries = readLocalEntries();
  }

  if (classId) {
    return sortByDateAsc(allEntries.filter(e => e.classId === classId));
  }
  return sortByDateAsc(allEntries);
};

/**
 * Add a new logbook entry — persists directly to MySQL (/api/logbook).
 */
export const addLogbookEntry = async (entryData) => {
  const now = new Date().toISOString();
  const newEntry = {
    id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
    ...entryData,
    createdAt: now,
    updatedAt: now
  };

  try {
    const res = await localDb.post('/logbook', newEntry);
    const saved = res?.entry || newEntry;

    const local = readLocalEntries().filter(e => e.id !== saved.id);
    local.push(saved);
    writeLocalEntries(sortByDateAsc(local));
    return saved;
  } catch (err) {
    console.error('[logbookService] addLogbookEntry MySQL save failed:', err);
    if (err?.status === 401 || err?.status === 403) {
      throw new Error('Session expirée — veuillez vous reconnecter pour enregistrer le cahier de textes.');
    }
    throw new Error(err?.message || 'Impossible d\'enregistrer la séance dans la base de données.');
  }
};

/**
 * Update an existing logbook entry — persists directly to MySQL (/api/logbook/:id).
 */
export const updateLogbookEntry = async (entryId, updates) => {
  if (!entryId) return null;
  const now = new Date().toISOString();
  const local = readLocalEntries();
  const existing = local.find(e => e.id === entryId) || { id: entryId };

  const updatedEntry = {
    ...existing,
    ...updates,
    id: entryId,
    updatedAt: now
  };

  try {
    const res = await localDb.post(`/logbook/${encodeURIComponent(entryId)}`, updatedEntry);
    const saved = res?.entry || updatedEntry;

    const nextLocal = local.filter(e => e.id !== entryId);
    nextLocal.push(saved);
    writeLocalEntries(sortByDateAsc(nextLocal));
    return saved;
  } catch (err) {
    console.error('[logbookService] updateLogbookEntry MySQL save failed:', err);
    if (err?.status === 401 || err?.status === 403) {
      throw new Error('Session expirée — veuillez vous reconnecter pour enregistrer la modification.');
    }
    throw new Error(err?.message || 'Impossible de mettre à jour la séance dans la base de données.');
  }
};

/**
 * Delete a logbook entry — deletes directly from MySQL (/api/logbook?id=...).
 */
export const deleteLogbookEntry = async (entryId) => {
  if (!entryId) return false;

  try {
    await localDb.delete('/logbook', entryId);
    markDeletedId(entryId);
    const filtered = readLocalEntries().filter(e => e.id !== entryId);
    writeLocalEntries(filtered);
    return true;
  } catch (err) {
    console.error('[logbookService] deleteLogbookEntry MySQL delete failed:', err);
    if (err?.status === 401 || err?.status === 403) {
      throw new Error('Session expirée — veuillez vous reconnecter pour supprimer la séance.');
    }
    throw new Error(err?.message || 'Impossible de supprimer la séance de la base de données.');
  }
};
