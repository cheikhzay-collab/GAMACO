// src/services/logger.js
// Lightweight client error logger (standalone MySQL backend mode).

export async function logError(error, extraInfo = {}) {
  console.error('[ErrorLogger]', error, extraInfo);
}

export const logErrorToSupabase = logError;
export default logError;
