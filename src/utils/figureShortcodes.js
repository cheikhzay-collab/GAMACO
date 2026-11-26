// src/utils/figureShortcodes.js
// Shared shortcode engine for placing section images anywhere inside text or solutions
// using concise tokens like [[FIG:1]] (or optional [[FIG:1|60%|center]]).

export const FIGURE_TOKEN_GLOBAL_RE = /\[\[\s*FIG\s*:\s*([^\]|\s]+)(?:\|([^\]]*))?\s*\]\]/gi;
export const FIGURE_TOKEN_SINGLE_RE = /^\[\[\s*FIG\s*:\s*([^\]|\s]+)(?:\|([^\]]*))?\s*\]\]$/i;

const parseOptionalParams = (paramStr = '') => {
  let widthOverride = null;
  let alignOverride = null;
  if (!paramStr) return { widthOverride, alignOverride };
  const parts = String(paramStr).split('|').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const pctMatch = part.match(/^(\d{2,3})\s*%?$/);
    if (pctMatch) {
      const n = Number(pctMatch[1]);
      if (n >= 15 && n <= 100) widthOverride = n;
      continue;
    }
    const lower = part.toLowerCase();
    if (lower === 'left' || lower === 'gauche' || lower === 'يسار') alignOverride = 'left';
    else if (lower === 'center' || lower === 'centre' || lower === 'وسط') alignOverride = 'center';
    else if (lower === 'right' || lower === 'droite' || lower === 'يمين') alignOverride = 'right';
  }
  return { widthOverride, alignOverride };
};

export const getImageItemUrl = (item) => {
  if (!item || typeof item !== 'object') return '';
  return String(item.url || item.src || item.dataUrl || item.imageUrl || item.image || '').trim();
};

/**
 * Returns normalized image entries for a section with stable figId & shortcode token.
 */
export const getSectionImageEntries = (section) => {
  const items = Array.isArray(section?.items) ? section.items : [];
  const entries = [];
  let fallbackCounter = 0;

  items.forEach((item, itemIdx) => {
    if (item?.type !== 'image') return;
    const url = getImageItemUrl(item);
    if (!url) return;
    fallbackCounter += 1;
    const figId = item.figId !== undefined && item.figId !== null && String(item.figId).trim() !== ''
      ? String(item.figId).trim()
      : String(fallbackCounter);
    entries.push({
      item: item.url ? item : { ...item, url },
      itemIdx,
      figId,
      token: `[[FIG:${figId}]]`,
    });
  });

  return entries;
};

/**
 * Builds a lookup Map (lowercase figId -> { item, figId }) from a normalized figures array.
 */
export const buildFigureMapFromList = (figures = []) => {
  const map = new Map();
  if (!Array.isArray(figures)) return map;
  figures.forEach((fig, idx) => {
    const url = getImageItemUrl(fig);
    if (!url) return;
    const figId = fig.figId !== undefined && fig.figId !== null && String(fig.figId).trim() !== ''
      ? String(fig.figId).trim()
      : String(idx + 1);
    const entry = {
      figId,
      item: {
        url,
        caption: fig.caption || fig.alt || '',
        alt: fig.alt || fig.caption || '',
        width_pct: fig.width_pct || 75,
        align: fig.align || 'center',
        position: fig.position || '',
      },
    };
    map.set(figId.toLowerCase(), entry);
    const posKey = String(idx + 1);
    if (!map.has(posKey)) map.set(posKey, entry);
  });
  return map;
};

/**
 * Builds a lookup Map (lowercase figId -> entry) for fast token resolution.
 */
export const getSectionImageMap = (section) => {
  const entries = getSectionImageEntries(section);
  const map = new Map();
  entries.forEach((entry, orderIdx) => {
    map.set(entry.figId.toLowerCase(), entry);
    // Also index by 1-based position if not colliding, for convenience
    const posKey = String(orderIdx + 1);
    if (!map.has(posKey)) {
      map.set(posKey, entry);
    }
  });
  return map;
};

/**
 * Computes the next unused numeric figId string when adding a new image to a section.
 */
export const getNextFigId = (items = []) => {
  const list = Array.isArray(items) ? items : [];
  let maxId = 0;
  let imgCount = 0;
  list.forEach((item) => {
    if (item?.type !== 'image') return;
    imgCount += 1;
    const parsed = parseInt(String(item.figId || '').replace(/[^\d]/g, ''), 10);
    if (!Number.isNaN(parsed) && parsed > maxId) {
      maxId = parsed;
    }
  });
  return String(Math.max(maxId, imgCount) + 1);
};

export const hasFigureToken = (text) => {
  if (!text) return false;
  FIGURE_TOKEN_GLOBAL_RE.lastIndex = 0;
  return FIGURE_TOKEN_GLOBAL_RE.test(String(text));
};

export const isStandaloneFigureLine = (line) => {
  if (!line) return null;
  const m = String(line).trim().match(FIGURE_TOKEN_SINGLE_RE);
  if (!m) return null;
  const { widthOverride, alignOverride } = parseOptionalParams(m[2]);
  return {
    figId: m[1].trim(),
    widthOverride,
    alignOverride,
    rawToken: m[0],
  };
};

/**
 * Splits a string into alternating text and figure-token segments.
 */
export const splitTextByFigureTokens = (text) => {
  if (text === null || text === undefined) return [];
  const str = String(text);
  const segments = [];
  const re = new RegExp(FIGURE_TOKEN_GLOBAL_RE.source, 'gi');
  let lastIndex = 0;
  let match;

  while ((match = re.exec(str)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: str.slice(lastIndex, match.index) });
    }
    const { widthOverride, alignOverride } = parseOptionalParams(match[2]);
    segments.push({
      type: 'figure',
      figId: match[1].trim(),
      widthOverride,
      alignOverride,
      rawToken: match[0],
    });
    lastIndex = re.lastIndex;
  }

  if (lastIndex < str.length) {
    segments.push({ type: 'text', value: str.slice(lastIndex) });
  }

  return segments;
};

/**
 * Collects all figIds explicitly referenced anywhere in a section's content, solution, or text items.
 */
export const getReferencedFigIds = (section) => {
  const referenced = new Set();
  if (!section) return referenced;

  const scan = (str) => {
    if (!str) return;
    const re = new RegExp(FIGURE_TOKEN_GLOBAL_RE.source, 'gi');
    let m;
    while ((m = re.exec(String(str))) !== null) {
      referenced.add(m[1].trim().toLowerCase());
    }
  };

  scan(section.content);
  scan(section.solution);
  if (Array.isArray(section.items)) {
    section.items.forEach((it) => {
      if (it?.type !== 'image') {
        scan(it?.text);
        scan(it?.content);
      }
    });
  }

  return referenced;
};

/**
 * Resolves a figure token against the section's image map and merges any optional inline overrides.
 */
export const resolveFigureItem = (imageMap, tokenObj) => {
  if (!imageMap || !tokenObj?.figId) return null;
  const entry = imageMap.get(String(tokenObj.figId).trim().toLowerCase());
  if (!entry?.item) return null;
  return {
    ...entry.item,
    figId: entry.figId,
    width_pct: tokenObj.widthOverride || entry.item.width_pct || 75,
    align: tokenObj.alignOverride || entry.item.align || 'center',
  };
};
