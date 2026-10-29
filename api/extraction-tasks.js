import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://lconq.ma,https://www.lconq.ma')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.endsWith('.vercel.app');

  const allowed = isAllowed ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', allowed || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gnokmutjfanekaxjswew.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2ttdXRqZmFuZWtheGpzd2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjcxMTAsImV4cCI6MjEwMzc0MzExMH0.WrUhI2idk2lBw9ChG6IFd70JiuOci-UK0sYMXKwOYqA';

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// â”€â”€ Moroccan Curriculum System Prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SYSTEM_PROMPT = `Tu es un Professeur AgrÃ©gÃ© de mathÃ©matiques et Inspecteur PÃ©dagogique, expert en manuels scolaires marocains (niveaux Tronc Commun, 1Ã¨re Bac, 2Ã¨me Bac â€” filiÃ¨res SM, PC/SVT, Arts, SGC).
Tu analyses des fiches de cours, chapitres de manuel, sÃ©ries d'exercices, devoirs surveillÃ©s ou Ã©preuves d'examen fournis en PDF ou image.
Ton objectif UNIQUE est de produire un JSON structurÃ© reprÃ©sentant FIDÃˆLEMENT, INTÃ‰GRALEMENT et INTELLIGEMMENT le contenu pÃ©dagogique du document.

Directives absolues :
1. DÃ‰TECTION DU NIVEAU ("header.detected_level") : "common_core_sci", "common_core_arts", "1bac_sci", "1bac_arts", "2bac_sm", "2bac_pc_svt", "2bac_arts".
2. DÃ‰TECTION DU TYPE ("header.doc_type") : "course", "exercises", "homework", "summary", "national", "concours".
3. CONSERVATION DE LA LANGUE : si en arabe -> extraire en arabe. Si en franÃ§ais -> extraire en franÃ§ais.
4. SYNTAXE LATEX : tout symbole mathÃ©matique DOIT Ãªtre encadrÃ© par $...$ ou $$...$$. Ne pas utiliser \\cline, utiliser \\hline.
5. EXHAUSTIVITÃ‰ ABSOLUE : extraire l'intÃ©gralitÃ© des sections, dÃ©finitions, thÃ©orÃ¨mes et exercices sans rien omettre.`;

const MOROCCAN_SOLVE_ADDENDUM = `
ðŸŽ¯ RÃˆGLES DE RÃ‰SOLUTION OFFICIELLES (INSPECTEUR PÃ‰DAGOGIQUE MAROCAIN) :
Pour chaque exercice dans le champ "solution", fournis un corrigÃ© mathÃ©matique rigoureux respectant le programme officiel marocain. Pas de rÃ¨gle de L'HÃ´pital.`;

const NO_SOLUTION_ADDENDUM = `
âš ï¸ INSTRUCTION EXTRACTION SANS RÃ‰SOLUTION :
Laisse le champ "solution" vide ("") et "interactive_answers" comme tableau vide []. Ne rÃ©sous rien.`;

function buildExtractionUserPrompt(pageCount, solveSolutions, preExtractedPdfText = '') {
  const pageNote = pageCount && pageCount > 1
    ? `âš ï¸ CE DOCUMENT COMPORTE ${pageCount} PAGES. Tu DOIS IMPÃ‰RATIVEMENT extraire l'intÃ©gralitÃ© de CHAQUE page de 1 Ã  ${pageCount}.`
    : `âš ï¸ Tu DOIS IMPÃ‰RATIVEMENT extraire l'intÃ©gralitÃ© absolue du document du dÃ©but Ã  la fin.`;

  const textFusion = preExtractedPdfText && preExtractedPdfText.trim()
    ? `\n\nðŸ“„ TEXTE BRUT DU PDF :\n"""\n${preExtractedPdfText.trim()}\n"""\n`
    : '';

  return `${pageNote}
${textFusion}
Extrais tout le document et retourne un JSON avec la structure :
{
  "header": {
    "fiche_title": "Titre du document",
    "subject": "MathÃ©matiques",
    "detected_level": "2bac_pc_svt",
    "doc_type": "course"
  },
  "sections": [
    {
      "id": "sec-1",
      "title": "Titre section / Exercice",
      "type": "content" ou "exercise",
      "content": "Texte complet en LaTeX...",
      "items": [{"type": "text", "text": "..."}],
      "solution": ""
    }
  ]
}`;
}

// â”€â”€â”€ JSON Repair & Sanitization Pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const repairTruncatedJson = (str) => {
  if (!str) return str;
  let s = str.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }
  if (start > 0) s = s.slice(start);

  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === c) {
          stack.pop();
        }
      }
    }
  }

  if (inString) s += '"';
  s = s.replace(/,\s*$/, '');
  s = s.replace(/:\s*$/, ': ""');

  while (stack.length > 0) {
    s += stack.pop();
  }
  return s;
};

const sanitizeLatexJson = (str) => {
  if (!str) return str;
  let result = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\') {
      const next = str[i + 1];
      if (next === '"') {
        result += '\\"';
        i += 2;
      } else if (next === '\\') {
        result += '\\\\';
        i += 2;
      } else if (next === 'n') {
        const afterN = str[i + 2];
        const isLetterAfterN = afterN && /[a-zA-Z]/.test(afterN);
        if (isLetterAfterN) {
          result += '\\\\';
          i += 1;
        } else {
          result += '\\n';
          i += 2;
        }
      } else {
        result += '\\\\';
        i += 1;
      }
    } else {
      result += str[i];
      i += 1;
    }
  }
  return result;
};

const escapeLiteralNewlinesInJson = (str) => {
  let inString = false;
  let escaped = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (inString && (char === '\n' || char === '\r')) {
      if (char === '\n') result += '\\n';
      continue;
    }
    result += char;
  }
  return result;
};

const escapeUnescapedQuotesInJson = (str) => {
  if (!str) return str;
  let inString = false;
  let escaped = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      if (!inString) {
        inString = true;
        result += char;
      } else {
        let isClosing = false;
        let j = i + 1;
        while (j < str.length && /\s/.test(str[j])) j++;
        if (j < str.length) {
          const nextChar = str[j];
          if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':') {
            isClosing = true;
          }
        } else {
          isClosing = true;
        }
        if (isClosing) {
          inString = false;
          result += char;
        } else {
          result += '\\"';
        }
      }
      continue;
    }
    result += char;
  }
  return result;
};

const extractJsonFromText = (str) => {
  if (!str) return str;
  let s = str.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace === -1 && firstBracket === -1) return s;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);

  const lastBrace = s.lastIndexOf('}');
  const lastBracket = s.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);

  if (start !== -1 && end !== -1 && end > start) {
    return s.slice(start, end + 1);
  }
  return start !== -1 ? s.slice(start) : s;
};

// Resilient 5-tier JSON parser for LaTeX formulas and strings
function parseJsonWithResilience(rawText) {
  let cleanText = rawText.trim();
  if (cleanText.includes('</think>')) {
    cleanText = cleanText.split('</think>').pop().trim();
  }
  cleanText = sanitizeLatexJson(cleanText);

  const strategies = [
    (t) => JSON.parse(extractJsonFromText(t)),
    (t) => JSON.parse(escapeLiteralNewlinesInJson(extractJsonFromText(t))),
    (t) => JSON.parse(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(extractJsonFromText(t)))),
    (t) => JSON.parse(repairTruncatedJson(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(extractJsonFromText(t))))),
    (t) => JSON.parse(repairTruncatedJson(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(sanitizeLatexJson(extractJsonFromText(t))))))
  ];

  let lastError = null;
  for (let i = 0; i < strategies.length; i++) {
    try {
      return strategies[i](cleanText);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Ã‰chec d'analyse du JSON produit par l'IA : ${lastError?.message || 'JSON invalide'}`);
}

// Serverless extraction execution using Gemini
async function executeGeminiExtraction({ base64Data, fileType, pageCount, apiKey, model, solveSolutions = true, preExtractedPdfText = '' }) {
  const isPdf = fileType && fileType.includes('pdf');
  const safeMime = isPdf ? 'application/pdf' : (fileType && fileType.includes('/') ? fileType : 'image/jpeg');

  const systemContent = solveSolutions
    ? SYSTEM_PROMPT + MOROCCAN_SOLVE_ADDENDUM
    : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;

  const userText = buildExtractionUserPrompt(pageCount, solveSolutions, preExtractedPdfText);

  let userPref = (model || '').trim().replace(/^models\//, '');
  if (!userPref || ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', '3.7', '3.5'].includes(userPref)) {
    userPref = 'gemini-2.5-flash';
  }

  // Active production models recommended by Google
  const defaultCascade = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ];
  const cascade = Array.from(new Set([userPref, ...defaultCascade].filter(Boolean)));

  const failureLog = [];
  const effectiveKey = (apiKey || '').trim() || (process.env.GEMINI_API_KEY || '').trim();
  for (let i = 0; i < cascade.length; i++) {
    const modelToUse = cascade[i];
    try {
      console.log(`[Server Extraction] Trying model [${modelToUse}] (${i + 1}/${cascade.length})...`);
      const cleanModelToUse = modelToUse.replace(/^models\//, '');
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelToUse}:generateContent?key=${effectiveKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': effectiveKey
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${res.status}`;
        throw new Error(`[${modelToUse}] ${msg}`);
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const nonThoughtParts = candidate?.content?.parts?.filter(p => !p.thought) || [];
      const textParts = (nonThoughtParts.length > 0 ? nonThoughtParts : (candidate?.content?.parts || []))
        .map(p => p.text || '')
        .join('');

      if (!textParts.trim()) throw new Error(`RÃ©ponse vide retournÃ©e par [${modelToUse}].`);

      const parsed = parseJsonWithResilience(textParts);
      console.log(`[Server Extraction] Success with model [${modelToUse}]!`);
      return { parsed, usedModel: modelToUse };
    } catch (err) {
      console.warn(`[Server Extraction] Model [${modelToUse}] failed:`, err.message);
      failureLog.push(err.message);
      // Automatically proceed to next model in cascade
    }
  }

  throw new Error(`Tous les modÃ¨les de secours ont Ã©chouÃ© : ${failureLog.join(' | ')}`);
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabase = getSupabase();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const id = url.searchParams.get('id') || (req.body && req.body.id) || null;
  const action = url.searchParams.get('action') || (req.body && req.body.action) || null;

  // ── 1. GET Requests ──────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (action === 'ping') {
      return res.status(200).json({ status: 'online', mode: 'server' });
    }

    if (id) {
      try {
        const { data: row, error } = await supabase
          .from('extraction_tasks')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error || !row) {
          return res.status(404).json({ error: 'Tâche introuvable' });
        }

        return res.status(200).json({
          id: row.id,
          fileName: row.file_name,
          fileType: row.file_type,
          pageCount: row.page_count,
          provider: row.provider,
          model: row.model,
          status: row.status,
          progressPercent: row.progress_percent,
          progressMessage: row.progress_message,
          attempts: row.attempts,
          maxAttempts: row.max_attempts,
          error: row.error_message,
          headerSummary: row.header_summary,
          result: row.result_json,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          completedAt: row.completed_at
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // List all tasks (newest first)
    try {
      const { data: rows, error } = await supabase
        .from('extraction_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const tasks = (rows || []).map(row => ({
        id: row.id,
        fileName: row.file_name,
        fileType: row.file_type,
        pageCount: row.page_count,
        provider: row.provider,
        model: row.model,
        status: row.status,
        progressPercent: row.progress_percent,
        progressMessage: row.progress_message,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        error: row.error_message,
        headerSummary: row.header_summary,
        hasResult: Boolean(row.result_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at
      }));

      return res.status(200).json(tasks);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── 2. POST Requests ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};

    // (A) Update Task State
    if (action === 'update_task' || body.action === 'update_task') {
      const targetId = id || body.id;
      if (!targetId) return res.status(400).json({ error: 'ID manquant' });

      try {
        const updatePayload = {
          updated_at: new Date().toISOString()
        };
        if (body.status !== undefined) updatePayload.status = body.status;
        if (body.progressPercent !== undefined) updatePayload.progress_percent = body.progressPercent;
        if (body.progressMessage !== undefined) updatePayload.progress_message = body.progressMessage;
        if (body.result !== undefined) updatePayload.result_json = body.result;
        if (body.headerSummary !== undefined) updatePayload.header_summary = body.headerSummary;
        if (body.error !== undefined) updatePayload.error_message = body.error;
        if (body.status === 'completed') updatePayload.completed_at = new Date().toISOString();

        const { error } = await supabase.from('extraction_tasks').update(updatePayload).eq('id', targetId);
        if (error) throw error;

        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // (B) Retry
    if (action === 'retry' || body.action === 'retry') {
      const targetId = id || body.id;
      if (!targetId) return res.status(400).json({ error: 'ID manquant' });

      try {
        const { error } = await supabase.from('extraction_tasks').update({
          status: 'pending',
          attempts: 0,
          progress_percent: 0,
          progress_message: 'Nouvelle tentative programmée...',
          error_message: null,
          updated_at: new Date().toISOString()
        }).eq('id', targetId);

        if (error) throw error;
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // (C) Create Task & Execute Server-Side AI Extraction
    const taskId = body.id || `TASK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const fileName = body.fileName || 'document.pdf';
    const fileType = body.fileType || 'application/pdf';
    const pageCount = body.pageCount || 1;
    const provider = body.provider || 'gemini';
    const model = body.model || '';
    const apiKey = body.apiKey || process.env.GEMINI_API_KEY || '';

    try {
      const taskRow = {
        id: taskId,
        file_name: fileName,
        file_type: fileType,
        page_count: pageCount,
        provider,
        model,
        status: 'processing',
        progress_percent: 20,
        progress_message: 'Extraction par IA en cours sur le serveur...',
        attempts: 1,
        max_attempts: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await supabase.from('extraction_tasks').upsert(taskRow);

      // Execute AI extraction on the server
      if (apiKey && (body.base64Data || body.preExtractedPdfText)) {
        try {
          const { parsed, usedModel } = await executeGeminiExtraction({
            base64Data: body.base64Data,
            fileType,
            pageCount,
            apiKey,
            model,
            solveSolutions: body.solveSolutions !== false,
            preExtractedPdfText: body.preExtractedPdfText
          });

          const header = parsed?.header || {};
          const sections = parsed?.sections || parsed?.items || parsed?.exercises || [];
          const headerSummary = {
            ficheTitle: header.fiche_title || header.title || fileName,
            subject: header.subject || 'Mathématiques',
            detectedLevel: header.detected_level || '2bac_pc_svt',
            docType: header.doc_type || 'course',
            sectionsCount: sections.length,
            extractedWithModel: usedModel
          };

          await supabase.from('extraction_tasks').update({
            status: 'completed',
            progress_percent: 100,
            progress_message: 'Fiche extraite avec succès !',
            result_json: parsed,
            header_summary: headerSummary,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq('id', taskId);

          return res.status(201).json({
            success: true,
            task: {
              id: taskId,
              fileName,
              status: 'completed',
              progressPercent: 100,
              progressMessage: 'Fiche extraite avec succès !',
              headerSummary,
              hasResult: true
            }
          });
        } catch (extractErr) {
          console.error('[Server Extraction Error]:', extractErr.message);
          await supabase.from('extraction_tasks').update({
            status: 'failed',
            progress_percent: 0,
            error_message: extractErr.message,
            progress_message: "Échec de l'extraction",
            updated_at: new Date().toISOString()
          }).eq('id', taskId);

          return res.status(201).json({
            success: true,
            task: {
              id: taskId,
              fileName,
              status: 'failed',
              error: extractErr.message
            }
          });
        }
      }

      return res.status(201).json({
        success: true,
        task: {
          id: taskId,
          fileName,
          status: 'pending',
          progressPercent: 0,
          progressMessage: 'En attente dans la file...'
        }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── 3. DELETE Requests ───────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'ID manquant' });
    try {
      await supabase.from('extraction_tasks').delete().eq('id', id);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}


