// src/services/authService.js
// Hardened authentication service — native MySQL / Node.js API with HMAC-signed session tokens.

import { localDb } from '../lib/localDbClient';

/**
 * Register a new student account via server-side scrypt hashing + signed session token.
 */
export const registerStudent = async (name, email, password) => {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail || !password) {
    throw new Error('Email et mot de passe requis.');
  }

  const res = await localDb.post('/auth/register', { name, email: cleanEmail, password });
  if (res && res.user) {
    localStorage.setItem('user', JSON.stringify(res.user));
    if (res.token) localStorage.setItem('auth_token', res.token);
    return res.user;
  }
  throw new Error(res?.error || "Échec de l'inscription.");
};

/**
 * Sign in with email and password via server-side verification (issues HMAC token + HttpOnly cookie).
 */
export const loginWithEmail = async (email, password) => {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail || !password) {
    throw new Error('Veuillez saisir votre email et votre mot de passe.');
  }

  const res = await localDb.post('/auth/login', { email: cleanEmail, password });
  if (res && res.user) {
    localStorage.setItem('user', JSON.stringify(res.user));
    if (res.token) localStorage.setItem('auth_token', res.token);
    return res.user;
  }

  throw new Error(res?.error || 'Identifiants incorrects.');
};

/**
 * Sign in with Google OAuth (disabled in standalone MySQL mode).
 */
export const loginWithGoogle = async () => {
  throw new Error('Connexion Google désactivée en mode MySQL autonome.');
};

/**
 * Fetch currently verified session user.
 * Verifies localStorage session against GET /api/auth/me so stale pre-upgrade
 * unsigned tokens (e.g. legacy 'token-admin') are automatically cleared and re-authenticated.
 */
export const getCurrentSessionUser = async () => {
  try {
    const cached = localStorage.getItem('user');
    if (!cached) return null;
    const parsedUser = JSON.parse(cached);

    // Verify token/cookie with live server (graceful offline fallback on network error)
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'same-origin',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401 || res.status === 403) {
        console.warn('[Auth] Stale or expired session detected — clearing local cache for fresh sign-in.');
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        return null;
      }
    } catch (_) {
      // Offline / network unavailable — keep cached session for read-only fallback
    }

    return parsedUser;
  } catch (err) {
    console.warn('[Auth] Error getting session user:', err.message);
  }
  return null;
};

/**
 * Sign out the current user (clears both localStorage and server HttpOnly session cookie).
 */
export const logoutUser = async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (_) {}
  localStorage.removeItem('user');
  localStorage.removeItem('auth_token');
};

/**
 * Subscribe to auth state changes (noop in standalone mode).
 */
export const onAuthChange = () => {
  return () => {};
};
