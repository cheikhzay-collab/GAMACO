// src/services/extractionTaskService.js
// Client service for Managing Asynchronous Lesson Extraction Tasks
// Supports Local Companion API (port 5002) with seamless Supabase Cloud sync & LocalStorage fallback

import { supabase } from '../lib/supabase';

const getCandidateBaseUrls = () => {
  return [''];
};

let activeBaseUrl = null;
let companionOnline = null;
let lastCheckTime = 0;

/**
 * Check if the server API (/ping) is running
 */
export const isCompanionAvailable = async (forceCheck = false) => {
  const now = Date.now();
  if (!forceCheck && companionOnline !== null && now - lastCheckTime < 5000) {
    return companionOnline;
  }

  const candidateBases = getCandidateBaseUrls();

  for (const base of candidateBases) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch(`${base}/ping`, { signal: ctrl.signal });
      clearTimeout(tid);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        if (data && data.status === 'online') {
          activeBaseUrl = base;
          companionOnline = true;
          lastCheckTime = now;
          return true;
        }
      }
    } catch {
      // continue
    }
  }

  activeBaseUrl = null;
  companionOnline = false;
  lastCheckTime = now;
  return false;
};

const fetchWithFailover = async (endpointPath, options = {}) => {
  const bases = activeBaseUrl ? [activeBaseUrl, ...getCandidateBaseUrls()] : getCandidateBaseUrls();
  const uniqueBases = Array.from(new Set(bases));

  let lastError = null;
  for (const base of uniqueBases) {
    try {
      const url = `${base}${endpointPath}`;
      const ctrl = new AbortController();
      const timeoutMs = options.timeout || 30000;
      const tid = setTimeout(() => ctrl.abort(), timeoutMs);

      const res = await fetch(url, {
        ...options,
        signal: ctrl.signal
      });
      clearTimeout(tid);

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error("L'endpoint a renvoyé du HTML au lieu d'une API JSON.");
      }

      if (res.ok) {
        activeBaseUrl = base;
        companionOnline = true;
        lastCheckTime = Date.now();
        return res;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Serveur compagnon injoignable.");
};

/**
 * Fetch all extraction tasks metadata (sorted newest first)
 */
export const getExtractionTasks = async () => {
  // 1. Companion API
  try {
    const res = await fetchWithFailover('/api/extraction-tasks', { method: 'GET', timeout: 4000 });
    if (res && res.ok) {
      return await res.json();
    }
  } catch (err) {}

  // 2. Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('extraction_tasks')
        .select('id, file_name, file_type, page_count, provider, model, status, progress_percent, progress_message, error_message, created_at, updated_at, completed_at')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(r => ({
          id: r.id,
          fileName: r.file_name,
          fileType: r.file_type,
          pageCount: r.page_count,
          provider: r.provider,
          model: r.model,
          status: r.status,
          progressPercent: r.progress_percent,
          progressMessage: r.progress_message,
          errorMessage: r.error_message,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          completedAt: r.completed_at
        }));
      }
    } catch (err) {
      console.warn('[ExtractionTasks] Supabase fetch error:', err.message);
    }
  }

  // 3. Fallback: localStorage
  try {
    const raw = localStorage.getItem('lconq_extraction_tasks') || '[]';
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

/**
 * Fetch full detail of a task including extracted JSON result
 */
export const getExtractionTaskById = async (id) => {
  // 1. Companion API
  try {
    const res = await fetchWithFailover(`/api/extraction-tasks?id=${encodeURIComponent(id)}`, { method: 'GET', timeout: 5000 });
    if (res && res.ok) {
      return await res.json();
    }
  } catch (err) {}

  // 2. Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('extraction_tasks')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          fileName: data.file_name,
          fileType: data.file_type,
          pageCount: data.page_count,
          provider: data.provider,
          model: data.model,
          status: data.status,
          progressPercent: data.progress_percent,
          progressMessage: data.progress_message,
          errorMessage: data.error_message,
          resultJson: data.result_json,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          completedAt: data.completed_at
        };
      }
    } catch (err) {
      console.warn('[ExtractionTasks] Supabase single fetch error:', err.message);
    }
  }

  return null;
};

/**
 * Create a new extraction task
 */
export const createExtractionTask = async (taskPayload) => {
  try {
    const res = await fetchWithFailover('/api/extraction-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskPayload),
      timeout: 60000
    });
    const data = await res.json();
    return data.task;
  } catch (err) {
    console.error('[ExtractionTaskService] Failed to create task via companion:', err);
    throw err;
  }
};

/**
 * Update task progress and result
 */
export const updateExtractionTask = async (id, updates = {}) => {
  try {
    const res = await fetchWithFailover(`/api/extraction-tasks?action=update_task&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'update_task', ...updates }),
      timeout: 10000
    });
    return res.ok;
  } catch (err) {
    return false;
  }
};

/**
 * Retry a failed task
 */
export const retryExtractionTask = async (id, newApiKey = null) => {
  try {
    const res = await fetchWithFailover(`/api/extraction-tasks?action=retry&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, apiKey: newApiKey }),
      timeout: 10000
    });
    const data = await res.json();
    return data.task;
  } catch (err) {
    throw new Error(`Erreur lors de la relance : ${err.message}`);
  }
};

/**
 * Delete a task
 */
export const deleteExtractionTask = async (id) => {
  if (supabase) {
    try {
      await supabase.from('extraction_tasks').delete().eq('id', id);
    } catch (_) {}
  }

  try {
    const res = await fetchWithFailover(`/api/extraction-tasks?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      timeout: 8000
    });
    return res.ok;
  } catch (err) {
    return true;
  }
};
