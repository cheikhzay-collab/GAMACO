// src/services/storageService.js
// Multi-tier asset storage: Native API Server (/api/assets) -> Inline Base64 Fallback.

/**
 * Uploads an asset (file/blob or base64 data url) to the API server or fallback.
 * @param {File|Blob|string} fileOrDataUrl - The file or base64 data URL to upload.
 * @param {string} path - The destination path (e.g. 'lessons/MOCK-1/fig1.png').
 * @param {string} [mimeType='image/png'] - MIME type.
 * @returns {Promise<string>} - The public URL of the stored asset or fallback data URL.
 */
export const uploadAsset = async (fileOrDataUrl, path, mimeType = 'image/png') => {
  if (!fileOrDataUrl) throw new Error('No file or data provided');

  let fileBlob = null;
  let base64Data = '';

  if (typeof fileOrDataUrl === 'string') {
    base64Data = fileOrDataUrl;
    const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (match && match[1]) {
      mimeType = match[1];
      const byteCharacters = atob(match[2]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      fileBlob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
    }
  } else {
    fileBlob = fileOrDataUrl;
    if (fileOrDataUrl.type) mimeType = fileOrDataUrl.type;
  }

  const cleanPath = path.replace(/^\/+/, '');

  // 1. Try Native API Server (/api/assets)
  try {
    const isLocalDev = typeof window !== 'undefined' && window.location && (window.location.port === '5173' || window.location.port === '3000');
    const apiUrl = isLocalDev 
      ? `http://${window.location.hostname || '127.0.0.1'}:5002/api/assets`
      : '/api/assets';

    // If we only have a blob, convert to base64 first
    if (!base64Data && fileBlob) {
      base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(fileBlob);
      });
    }

    const compResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cleanPath,
        data: base64Data,
        mimeType,
      }),
    });

    if (compResponse.ok) {
      const json = await compResponse.json();
      if (json.publicUrl) return json.publicUrl;
    }
  } catch (err) {
    console.warn('[Storage] API upload error, falling back to base64:', err.message);
  }

  // 2. Fallback to inline Base64 Data URL if offline
  if (base64Data) return base64Data;
  if (fileBlob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileBlob);
    });
  }

  return '';
};

export const uploadAssetData = uploadAsset;
