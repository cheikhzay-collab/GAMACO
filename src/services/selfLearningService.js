// src/services/selfLearningService.js
// Gestion des notes de formation continue (التعلم الذاتي) pour le professeur.
// Utilise Supabase (si disponible) avec fallback localStorage.

import { supabase } from '../lib/supabase';

const LS_KEY = 'self_learning_notes';

// ─── LocalStorage helpers ────────────────────────────────────────────────────
function lsGetAll() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}
function lsSave(notes) {
  localStorage.setItem(LS_KEY, JSON.stringify(notes));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Save a new self-learning note (summary or exercises).
 * @param {{ type, cycle, module, topic, content, language, level }} data
 */
export async function saveSelfLearningNote(data) {
  const note = {
    id: crypto.randomUUID?.() || Date.now().toString(36),
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const row = { ...note, admin_id: user?.id };
      const { data: saved, error } = await supabase
        .from('self_learning_notes')
        .insert(row)
        .select()
        .single();
      if (!error && saved) return saved;
    } catch (e) {
      console.warn('[selfLearningService] Supabase insert failed, falling back to localStorage:', e);
    }
  }

  // localStorage fallback
  const all = lsGetAll();
  all.unshift(note);
  lsSave(all);
  return note;
}

/**
 * Fetch all self-learning notes for the current user.
 * @param {{ type?, cycle?, module? }} filters Optional filters
 */
export async function getSelfLearningNotes(filters = {}) {
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase
        .from('self_learning_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (user?.id) query = query.eq('admin_id', user.id);
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.cycle) query = query.eq('cycle', filters.cycle);
      if (filters.module) query = query.eq('module', filters.module);

      const { data, error } = await query;
      if (!error && Array.isArray(data)) return data;
    } catch (e) {
      console.warn('[selfLearningService] Supabase fetch failed, using localStorage:', e);
    }
  }

  // localStorage fallback
  let all = lsGetAll();
  if (filters.type)   all = all.filter(n => n.type   === filters.type);
  if (filters.cycle)  all = all.filter(n => n.cycle  === filters.cycle);
  if (filters.module) all = all.filter(n => n.module === filters.module);
  return all;
}

/**
 * Delete a note by id.
 */
export async function deleteSelfLearningNote(id) {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('self_learning_notes')
        .delete()
        .eq('id', id);
      if (!error) {
        // also remove from LS if exists
        lsSave(lsGetAll().filter(n => n.id !== id));
        return true;
      }
    } catch (e) {
      console.warn('[selfLearningService] Supabase delete failed:', e);
    }
  }

  lsSave(lsGetAll().filter(n => n.id !== id));
  return true;
}

/**
 * Update note content.
 */
export async function updateSelfLearningNote(id, patch) {
  const updated = { ...patch, updated_at: new Date().toISOString() };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('self_learning_notes')
        .update(updated)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data;
    } catch (e) {
      console.warn('[selfLearningService] Supabase update failed:', e);
    }
  }

  const all = lsGetAll();
  const idx = all.findIndex(n => n.id === id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...updated };
    lsSave(all);
    return all[idx];
  }
  return null;
}
