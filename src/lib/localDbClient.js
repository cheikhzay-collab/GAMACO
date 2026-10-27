// src/lib/localDbClient.js
// Client API wrapper for communicating with the local Companion server database on port 5002.

const isLocalDev = () => {
  if (typeof window === 'undefined' || !window.location) return false;
  const p = window.location.port;
  return p === '5173' || p === '3000' || p === '5002';
};

const getBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5002/api';
  if (isLocalDev()) {
    const h = window.location.hostname || '127.0.0.1';
    return `http://${h}:5002/api`;
  }
  return '/api';
};

const getPingUrl = () => {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5002/ping';
  if (isLocalDev()) {
    const h = window.location.hostname || '127.0.0.1';
    return `http://${h}:5002/ping`;
  }
  return '/ping';
};

const PROBE_TIMEOUT_MS = 2500;
const REQUEST_TIMEOUT_MS = 15000;
const OFFLINE_COOLDOWN_MS = 5000;
const GET_CACHE_TTL_MS = 2000;

let companionAvailable = null;
let companionUnavailableUntil = 0;
let companionProbe = null;
const inFlightGets = new Map();
const getCache = new Map();

const unavailableError = () => {
  const error = new Error('Database API server unavailable');
  error.code = 'API_UNAVAILABLE';
  return error;
};

const probeCompanion = async () => {
  if (companionAvailable === true) return true;
  if (companionAvailable === false && Date.now() < companionUnavailableUntil) return false;
  if (companionProbe) return companionProbe;

  companionProbe = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(getPingUrl(), { method: 'GET', signal: controller.signal });
      companionAvailable = response.ok;
      if (!companionAvailable) companionUnavailableUntil = Date.now() + OFFLINE_COOLDOWN_MS;
      return companionAvailable;
    } catch {
      companionAvailable = false;
      companionUnavailableUntil = Date.now() + OFFLINE_COOLDOWN_MS;
      return false;
    } finally {
      clearTimeout(timeoutId);
      companionProbe = null;
    }
  })();

  return companionProbe;
};

const request = async (endpoint, options = {}) => {
  if (!(await probeCompanion())) throw unavailableError();

  const url = `${getBaseUrl()}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const controller = new AbortController();
  // The companion server can need a moment to read local JSON files on its
  // first request. A short timeout keeps the UI responsive without treating a
  // healthy local service as unavailable.
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const config = {
    ...options,
    headers,
    signal: controller.signal
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);
    companionAvailable = true;
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.name === 'TypeError') {
      companionAvailable = false;
      companionUnavailableUntil = Date.now() + OFFLINE_COOLDOWN_MS;
    } else if (error.code !== 'COMPANION_UNAVAILABLE') {
      console.warn(`[LocalDB Client] Request to ${endpoint} failed:`, error.message);
    }
    throw error;
  }
};

const get = (endpoint) => {
  const cached = getCache.get(endpoint);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);

  const pending = inFlightGets.get(endpoint);
  if (pending) return pending;

  const getRequest = request(endpoint, { method: 'GET' })
    .then((value) => {
      getCache.set(endpoint, { value, expiresAt: Date.now() + GET_CACHE_TTL_MS });
      return value;
    })
    .finally(() => {
      inFlightGets.delete(endpoint);
    });

  inFlightGets.set(endpoint, getRequest);
  return getRequest;
};

const mutate = async (endpoint, options) => {
  const result = await request(endpoint, options);
  getCache.clear();
  return result;
};

export const localDb = {
  get,
  post: (endpoint, body) => mutate(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => mutate(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint, id) => mutate(`${endpoint}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
};

export default localDb;
