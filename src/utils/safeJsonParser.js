// src/utils/safeJsonParser.js
// Ultra-resilient JSON parser & repair engine tailored for AI-extracted Moroccan math documents
// (LaTeX formulas, Arabic/French text, missing/trailing commas, unescaped quotes, truncation).

/**
 * Strip <think>...</think> reasoning blocks, markdown code fences, and outer prose.
 */
export function extractJsonFromText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();

  // Strip reasoning tags from models like DeepSeek-R1 / Gemini thinking
  if (s.includes('</think>')) {
    s = s.split('</think>').pop().trim();
  }

  // Strip markdown code fences (```json ... ```)
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1] && (fenceMatch[1].trim().startsWith('{') || fenceMatch[1].trim().startsWith('['))) {
    s = fenceMatch[1].trim();
  } else {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace === -1 && firstBracket === -1) return s;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);

  if (start === -1) return s;
  const fromStart = s.slice(start);

  // Walk from start to find the matching closing brace/bracket of the root structure.
  // If the root is NOT closed (truncated JSON!), keep the ENTIRE tail fromStart intact!
  const rootOpen = fromStart[0];
  const rootClose = rootOpen === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  let matchedEnd = -1;

  for (let i = 0; i < fromStart.length; i++) {
    const ch = fromStart[i];
    if (escaped) { escaped = false; continue; }
    if (inString && ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === rootOpen) depth++;
    else if (ch === rootClose) {
      depth--;
      if (depth === 0) {
        matchedEnd = i;
        break;
      }
    }
  }

  return matchedEnd !== -1 ? fromStart.slice(0, matchedEnd + 1) : fromStart;
}

/**
 * Smart LaTeX-aware backslash sanitizer inside JSON string literals ONLY.
 * Preserves valid JSON escapes (\", \\, \/, \uXXXX, standalone \n/\r/\t)
 * while doubling LaTeX commands (\frac, \lim, \to, \neq, \right, \beta, \forall, \vec, \mathbb, etc.).
 */
export function sanitizeLatexInJsonStrings(str) {
  if (!str) return str;
  let out = '';
  let inString = false;
  let i = 0;

  while (i < str.length) {
    const ch = str[i];

    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      i++;
      continue;
    }

    // Inside a JSON string
    if (ch === '"') {
      inString = false;
      out += ch;
      i++;
      continue;
    }

    if (ch === '\\') {
      const next = str[i + 1];
      if (next === undefined) {
        out += '\\\\';
        i++;
        continue;
      }

      // Already valid escaped quote or backslash or slash
      if (next === '"' || next === '\\' || next === '/') {
        out += '\\' + next;
        i += 2;
        continue;
      }

      // Valid \uXXXX unicode escape
      if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(str.slice(i + 2, i + 6))) {
        out += str.slice(i, i + 6);
        i += 6;
        continue;
      }

      // Ambiguous escapes: \n, \r, \t, \b, \f — in LaTeX these start commands like
      // \neq, \nu, \right, \rho, \to, \tan, \times, \theta, \beta, \begin, \bar, \frac, \forall!
      if (next === 'n' || next === 'r' || next === 't' || next === 'b' || next === 'f') {
        const after = str[i + 2];
        const followedByLetter = Boolean(after && /[a-zA-Z]/.test(after));
        if (followedByLetter) {
          // It's a LaTeX command (e.g. \frac, \to, \neq, \right, \beta) -> double the backslash
          out += '\\\\' + next;
          i += 2;
        } else {
          // Genuine JSON escape (\n, \t, \r)
          out += '\\' + next;
          i += 2;
        }
        continue;
      }

      // Any other \X inside a JSON string is illegal in JSON (e.g. \lim, \alpha, \mathbb, \{, \}, \,)
      out += '\\\\' + next;
      i += 2;
      continue;
    }

    // Escape raw control characters inside strings
    const code = ch.charCodeAt(0);
    if (code < 0x20) {
      if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else out += ' ';
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Strip JS-style comments (// ... and /* ... *\/) outside JSON strings.
 */
function stripJsonComments(str) {
  let out = '';
  let inString = false;
  let escaped = false;
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '/' && str[i + 1] === '/') {
      i += 2;
      while (i < str.length && str[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && str[i + 1] === '*') {
      i += 2;
      while (i < str.length - 1 && !(str[i] === '*' && str[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Context-aware fixer for unescaped double quotes inside JSON strings.
 * Correctly handles French/Arabic prose like: "On appelle "f", la fonction continue"
 * without mistakenly treating the quote before ", la fonction" as a closing quote!
 */
export function escapeUnescapedQuotesSmart(str) {
  if (!str) return str;
  let out = '';
  let inString = false;
  let escaped = false;
  // Track container stack: '{' or '['
  const containers = [];
  // Track whether the current string is an object key (expecting ':' after it)
  let expectingKey = false;
  let currentStringIsKey = false;

  const peekNextNonWs = (fromIdx) => {
    let j = fromIdx;
    while (j < str.length && /\s/.test(str[j])) j++;
    return j;
  };

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }

    if (inString && ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        currentStringIsKey = expectingKey;
        out += ch;
      } else {
        // Decide whether this '"' truly closes the string or is an unescaped inner quote
        const nextIdx = peekNextNonWs(i + 1);
        const nextCh = nextIdx < str.length ? str[nextIdx] : '';
        let isClosing = false;

        if (nextIdx >= str.length) {
          isClosing = true;
        } else if (currentStringIsKey && nextCh === ':') {
          isClosing = true;
        } else if (!currentStringIsKey && (nextCh === '}' || nextCh === ']')) {
          isClosing = true;
        } else if (!currentStringIsKey && nextCh === ',') {
          // Verify what follows the comma actually looks like the next JSON entry, NOT prose!
          const afterCommaIdx = peekNextNonWs(nextIdx + 1);
          const afterCommaCh = afterCommaIdx < str.length ? str[afterCommaIdx] : '';
          const parent = containers[containers.length - 1];
          if (parent === '{') {
            // Next object entry MUST start with '"' (key) or '}' (trailing comma)
            isClosing = (afterCommaCh === '"' || afterCommaCh === '}');
          } else if (parent === '[') {
            // Next array item starts with '"', '{', '[', digit, '-', 't', 'f', 'n', or ']'
            isClosing = (
              afterCommaCh === '"' ||
              afterCommaCh === '{' ||
              afterCommaCh === '[' ||
              afterCommaCh === ']' ||
              afterCommaCh === '-' ||
              /[0-9]/.test(afterCommaCh) ||
              str.slice(afterCommaIdx, afterCommaIdx + 4) === 'true' ||
              str.slice(afterCommaIdx, afterCommaIdx + 5) === 'false' ||
              str.slice(afterCommaIdx, afterCommaIdx + 4) === 'null'
            );
          } else {
            isClosing = true;
          }
        } else if (!currentStringIsKey && nextCh === '"' && str.slice(i + 1, nextIdx).includes('\n')) {
          // Missing comma between two lines: "value"\n  "nextKey": ...
          const parent = containers[containers.length - 1];
          if (parent === '{' || parent === '[') {
            isClosing = true;
          }
        }

        if (isClosing) {
          inString = false;
          if (currentStringIsKey) expectingKey = false;
          currentStringIsKey = false;
          out += ch;
        } else {
          out += '\\"';
        }
      }
      continue;
    }

    if (!inString) {
      if (ch === '{') {
        containers.push('{');
        expectingKey = true;
      } else if (ch === '[') {
        containers.push('[');
        expectingKey = false;
      } else if (ch === '}' || ch === ']') {
        containers.pop();
        expectingKey = false;
      } else if (ch === ',') {
        expectingKey = containers[containers.length - 1] === '{';
      } else if (ch === ':') {
        expectingKey = false;
      }
    }

    out += ch;
  }

  return out;
}

/**
 * Fix missing commas between adjacent JSON values/properties AND remove trailing commas before } or ].
 */
export function fixCommasInJson(str) {
  if (!str) return str;
  // Tokenize lightly to avoid touching anything inside string literals
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (/\s/.test(ch)) {
      let start = i;
      while (i < str.length && /\s/.test(str[i])) i++;
      tokens.push({ type: 'ws', text: str.slice(start, i) });
      continue;
    }
    if (ch === '"') {
      let start = i;
      i++;
      let esc = false;
      while (i < str.length) {
        if (esc) { esc = false; i++; continue; }
        if (str[i] === '\\') { esc = true; i++; continue; }
        if (str[i] === '"') { i++; break; }
        i++;
      }
      tokens.push({ type: 'string', text: str.slice(start, i) });
      continue;
    }
    if ('{}[]:,'.includes(ch)) {
      tokens.push({ type: 'punct', text: ch });
      i++;
      continue;
    }
    // Number, boolean, null, or bareword
    let start = i;
    while (i < str.length && !/[\s{}\[\]:,"]/.test(str[i])) i++;
    tokens.push({ type: 'literal', text: str.slice(start, i) });
  }

  // Filter non-ws index helper
  const nonWsIndices = [];
  for (let k = 0; k < tokens.length; k++) {
    if (tokens[k].type !== 'ws') nonWsIndices.push(k);
  }

  const isValueEnd = (tok) =>
    tok.type === 'string' ||
    tok.type === 'literal' ||
    (tok.type === 'punct' && (tok.text === '}' || tok.text === ']'));

  const isValueStart = (tok) =>
    tok.type === 'string' ||
    tok.type === 'literal' ||
    (tok.type === 'punct' && (tok.text === '{' || tok.text === '['));

  // 1. Remove trailing commas before } or ]
  for (let p = 0; p < nonWsIndices.length - 1; p++) {
    const cur = tokens[nonWsIndices[p]];
    const nxt = tokens[nonWsIndices[p + 1]];
    if (cur.type === 'punct' && cur.text === ',' && nxt.type === 'punct' && (nxt.text === '}' || nxt.text === ']')) {
      cur.text = '';
    }
  }

  // 2. Insert missing commas between consecutive values/properties
  // Track whether the previous string was a key (followed by ':')
  for (let p = 0; p < nonWsIndices.length - 1; p++) {
    const curIdx = nonWsIndices[p];
    const nxtIdx = nonWsIndices[p + 1];
    const cur = tokens[curIdx];
    const nxt = tokens[nxtIdx];
    if (!cur.text || !nxt.text) continue;

    // Never insert a comma right before ':'
    if (nxt.type === 'punct' && nxt.text === ':') continue;

    if (isValueEnd(cur) && isValueStart(nxt)) {
      cur.text = cur.text + ',';
    }
  }

  return tokens.map(t => t.text).join('');
}

/**
 * Repair a truncated JSON string by closing unclosed strings, cleaning dangling keys/commas,
 * and closing all open braces/brackets in reverse order.
 */
export function repairTruncatedJson(str) {
  if (!str) return str;
  let s = extractJsonFromText(str);

  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (inString && c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === c) stack.pop();
      }
    }
  }

  if (inString) {
    // Strip trailing lone backslash before closing quote
    if (escaped) s = s.slice(0, -1);
    s += '"';
  }

  // Remove trailing comma or dangling key without colon/value inside an object
  s = s.replace(/,\s*$/, '');
  if (stack.length > 0 && stack[stack.length - 1] === '}') {
    // If ending with `, "partialKey"` (no colon), strip it
    s = s.replace(/,\s*"[^"]*"\s*$/, '');
    // If ending with `"key":` (missing value), give empty string
    s = s.replace(/:\s*$/, ': ""');
  } else {
    s = s.replace(/:\s*$/, ': ""');
  }

  // Re-compute stack after trimming
  const finalStack = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (inString && c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === '{') finalStack.push('}');
      else if (c === '[') finalStack.push(']');
      else if (c === '}' || c === ']') {
        if (finalStack.length > 0 && finalStack[finalStack.length - 1] === c) finalStack.pop();
      }
    }
  }

  s = s.replace(/,\s*$/, '');
  while (finalStack.length > 0) {
    s += finalStack.pop();
  }
  return s;
}

/**
 * Iterative position-guided JSON healer: reads V8/Browser JSON.parse error position
 * and patches localized syntax defects (up to 15 passes).
 */
function iterativePositionHeal(input) {
  let s = input;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      return JSON.parse(s);
    } catch (err) {
      const msg = String(err?.message || '');
      const posMatch = msg.match(/position\s+(\d+)/i);
      if (!posMatch) break;
      const pos = parseInt(posMatch[1], 10);
      if (isNaN(pos) || pos < 0 || pos > s.length) break;

      let next = s;
      if (/Expected ',' or '}'|Expected ',' or '\]'/i.test(msg)) {
        // Either a missing comma right before pos, or an unescaped quote just before pos
        const before = s.slice(Math.max(0, pos - 40), pos);
        const charAtPos = s[pos] || '';
        if (charAtPos === '"' || charAtPos === '{' || charAtPos === '[' || /[-0-9tfn]/.test(charAtPos)) {
          // Check if inserting a comma fixes a missing comma between properties/items
          next = s.slice(0, pos) + ',' + s.slice(pos);
        } else {
          // Look back for the nearest unescaped quote and escape it
          const lastQ = before.lastIndexOf('"');
          if (lastQ !== -1) {
            const absQ = Math.max(0, pos - 40) + lastQ;
            if (s[absQ - 1] !== '\\') {
              next = s.slice(0, absQ) + '\\"' + s.slice(absQ + 1);
            }
          }
        }
      } else if (/Bad escaped character/i.test(msg)) {
        // Double the bad backslash at pos-1
        const bPos = s[pos] === '\\' ? pos : (s[pos - 1] === '\\' ? pos - 1 : -1);
        if (bPos !== -1) {
          next = s.slice(0, bPos) + '\\\\' + s.slice(bPos + 1);
        }
      } else if (/Unexpected token ','/i.test(msg)) {
        if (s[pos] === ',') {
          next = s.slice(0, pos) + s.slice(pos + 1);
        }
      }

      if (next === s) break;
      s = next;
    }
  }
  return null;
}

/**
 * Last-resort salvager: extracts header + every complete section object inside "sections": [...]
 * when an extremely long AI output is irreparably corrupted near the tail.
 */
function salvagePartialLessonJson(str) {
  const secMatch = str.match(/"sections"\s*:\s*\[/);
  if (!secMatch) return null;

  let header = {};
  const hdrMatch = str.match(/"header"\s*:\s*(\{[\s\S]*?\})\s*,\s*"sections"/);
  if (hdrMatch && hdrMatch[1]) {
    try {
      header = JSON.parse(fixCommasInJson(sanitizeLatexInJsonStrings(hdrMatch[1])));
    } catch (_) {}
  }

  const startIdx = secMatch.index + secMatch[0].length;
  const sections = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { escaped = false; continue; }
    if (inString && ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const chunk = str.slice(objStart, i + 1);
        try {
          const obj = JSON.parse(fixCommasInJson(escapeUnescapedQuotesSmart(sanitizeLatexInJsonStrings(chunk))));
          if (obj && typeof obj === 'object') sections.push(obj);
        } catch (_) {
          const healed = iterativePositionHeal(fixCommasInJson(sanitizeLatexInJsonStrings(chunk)));
          if (healed && typeof healed === 'object') sections.push(healed);
        }
        objStart = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break;
    }
  }

  if (sections.length > 0) {
    return { header, sections };
  }
  return null;
}

/**
 * Master entry point: parses AI JSON output through escalating safe repair strategies.
 * Returns { parsed, strategyUsed } or throws the most informative Error.
 */
export function parseAiJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error("Réponse IA vide.");
  }

  const extracted = extractJsonFromText(rawText);
  const noComments = stripJsonComments(extracted);

  const candidates = [
    // 1. Untouched valid JSON first! (Never corrupt already-valid JSON)
    { name: 'direct', fn: () => extracted },
    // 2. Strip comments & fix trailing/missing commas
    { name: 'commas_only', fn: () => fixCommasInJson(noComments) },
    // 3. Smart LaTeX backslash sanitizer (preserves valid JSON escapes)
    { name: 'latex_sanitize', fn: () => sanitizeLatexInJsonStrings(noComments) },
    // 4. LaTeX sanitizer + missing/trailing comma repair
    { name: 'latex_plus_commas', fn: () => fixCommasInJson(sanitizeLatexInJsonStrings(noComments)) },
    // 5. LaTeX sanitizer + context-aware inner quote escaper + comma repair
    { name: 'latex_quotes_commas', fn: () => fixCommasInJson(escapeUnescapedQuotesSmart(sanitizeLatexInJsonStrings(noComments))) },
    // 6. Truncation repair + LaTeX + quotes + commas
    { name: 'truncated_full_repair', fn: () => repairTruncatedJson(fixCommasInJson(escapeUnescapedQuotesSmart(sanitizeLatexInJsonStrings(noComments)))) },
  ];

  let firstErr = null;
  let lastPrepared = noComments;

  for (const cand of candidates) {
    try {
      const prepared = cand.fn();
      lastPrepared = prepared;
      const parsed = JSON.parse(prepared);
      if (parsed && typeof parsed === 'object') {
        return { parsed, strategyUsed: cand.name };
      }
    } catch (e) {
      if (!firstErr) firstErr = e;
    }
  }

  // 7. Position-guided iterative healer
  const healed = iterativePositionHeal(lastPrepared);
  if (healed && typeof healed === 'object') {
    return { parsed: healed, strategyUsed: 'position_healer' };
  }

  // 8. Partial section salvager (recovers all complete sections if tail was corrupted)
  const salvaged = salvagePartialLessonJson(noComments);
  if (salvaged && Array.isArray(salvaged.sections) && salvaged.sections.length > 0) {
    return { parsed: salvaged, strategyUsed: 'partial_salvage' };
  }

  throw firstErr || new Error('JSON invalide');
}

export default parseAiJsonResponse;
