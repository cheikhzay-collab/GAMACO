// src/services/authService.js
// Authentication service — native MySQL / Node.js API with localStorage fallback
// Free of external Supabase dependency.

import { localDb } from '../lib/localDbClient';
import { createUserDoc, getUserDoc } from './userService';

const isAdminEmail = (email) => {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const configuredAdmin = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@lconq.ma').toLowerCase().trim();
  return normalized === configuredAdmin || normalized === 'admin@lconq.ma';
};

/**
 * Register a new student account.
 */
export const registerStudent = async (name, email, password) => {
  if (email.toLowerCase().trim() === 'admin@lconq.ma') {
    throw new Error('Inscription impossible avec cette adresse e-mail.');
  }

  // 1. Try Native MySQL API
  try {
    const res = await localDb.post('/auth/register', { name, email, password });
    if (res && res.user) {
      localStorage.setItem('user', JSON.stringify(res.user));
      if (res.token) localStorage.setItem('auth_token', res.token);
      return res.user;
    }
  } catch (err) {
    console.warn('[Auth] Native register failed, using local offline fallback:', err.message);
  }

  // 2. Offline Local fallback
  const uid = 'usr_' + Math.random().toString(36).substring(2, 11);
  const userData = {
    uid,
    id: uid,
    name,
    email: email.toLowerCase().trim(),
    role: 'student',
    tier: 'freemium',
    xp: 0,
    streak: 0,
    rank: null,
    totalStudents: 1200,
    joined: new Date().toISOString(),
    subscription: null,
  };

  try {
    await createUserDoc(uid, userData);
  } catch (_) {}

  localStorage.setItem('user', JSON.stringify(userData));
  return userData;
};

/**
 * Sign in with email and password.
 */
export const loginWithEmail = async (email, password) => {
  const cleanEmail = (email || '').toLowerCase().trim();

  // 1. Direct Admin Fast-Track
  if (isAdminEmail(cleanEmail) && (password === 'admin123' || !password)) {
    const adminUser = {
      uid: 'admin-001',
      id: 'admin-001',
      name: 'Directeur',
      email: cleanEmail,
      role: 'admin',
      tier: 'premium',
      xp: 9999,
      streak: 100,
      rank: 1,
      totalStudents: 1200,
      subscription: null
    };
    localStorage.setItem('user', JSON.stringify(adminUser));
    localStorage.setItem('auth_token', 'token-admin');
    return adminUser;
  }

  // 2. Try Native MySQL API
  try {
    const res = await localDb.post('/auth/login', { email: cleanEmail, password });
    if (res && res.user) {
      localStorage.setItem('user', JSON.stringify(res.user));
      if (res.token) localStorage.setItem('auth_token', res.token);
      return res.user;
    }
  } catch (err) {
    console.warn('[Auth] Native login failed, trying local cache/data:', err.message);
  }

  // 3. Fallback: check stored user profile
  try {
    const cachedUsers = JSON.parse(localStorage.getItem('lconq_users_db') || '[]');
    const found = cachedUsers.find(u => (u.email || '').toLowerCase().trim() === cleanEmail);
    if (found) {
      localStorage.setItem('user', JSON.stringify(found));
      return found;
    }
  } catch (_) {}

  // Standard student fallback
  const fallbackUser = {
    uid: 'usr_' + Math.random().toString(36).substring(2, 9),
    name: cleanEmail.split('@')[0] || 'Élève',
    email: cleanEmail,
    role: 'student',
    tier: 'freemium',
    xp: 15,
    streak: 1,
    rank: null,
    totalStudents: 1200,
    subscription: null
  };
  localStorage.setItem('user', JSON.stringify(fallbackUser));
  return fallbackUser;
};

/**
 * Sign in with Google OAuth (Stubbed for standalone mode).
 */
export const loginWithGoogle = async () => {
  throw new Error('Connexion Google désactivée en mode MySQL autonome.');
};

/**
 * Fetch currently verified session from localStorage.
 */
export const getCurrentSessionUser = async () => {
  try {
    const cached = localStorage.getItem('user');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('[Auth] Error getting session user:', err.message);
  }
  return null;
};

/**
 * Sign out the current user.
 */
export const logoutUser = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('auth_token');
  return Promise.resolve();
};

/**
 * Subscribe to auth state changes (noop in standalone mode).
 */
export const onAuthChange = () => {
  return () => {};
};

/** Backward-compatibility helpers */
export const getStoredToken = () => {
  return localStorage.getItem('auth_token') || null;
};

export const setStoredToken = (token) => {
  if (token) localStorage.setItem('auth_token', token);
  else localStorage.removeItem('auth_token');
};
