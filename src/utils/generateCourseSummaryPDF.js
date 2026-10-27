// src/utils/generateCourseSummaryPDF.js
// Standalone high-fidelity HTML & PDF print generator for Moroccan 3-Column Course Summary sheets.

import katex from 'katex';
import QRCode from 'qrcode';

/**
 * Splits Moroccan level into two elegant lines (e.g., Tronc Commun / Scientifique or الجذع المشترك / العلمي)
 */
const splitLevelTitle = (rawLevel, isArabic = false) => {
  if (!rawLevel) {
    return isArabic 
      ? { line1: 'الجذع المشترك', line2: 'العلمي' } 
      : { line1: 'Tronc Commun', line2: 'Scientifique' };
  }
  const s = String(rawLevel).trim();

  if (isArabic) {
    if (s.includes('جدع') || s.includes('مشترك') || s.includes('tronc') || s.includes('tc')) {
      if (s.includes('آداب') || s.includes('إنسان') || s.includes('art') || s.includes('lettre')) {
        return { line1: 'الجذع المشترك', line2: 'الآداب والعلوم الإنسانية' };
      }
      return { line1: 'الجذع المشترك', line2: 'العلمي' };
    }
    if (s.includes('2') || s.includes('ثانية')) {
      if (s.includes('رياض') || s.includes('sm')) return { line1: 'الثانية باكالوريا', line2: 'العلوم الرياضية' };
      if (s.includes('آداب') || s.includes('art')) return { line1: 'الثانية باكالوريا', line2: 'الآداب والعلوم الإنسانية' };
      return { line1: 'الثانية باكالوريا', line2: 'العلوم التجريبية' };
    }
    if (s.includes('1') || s.includes('أولى')) {
      if (s.includes('آداب') || s.includes('art')) return { line1: 'الأولى باكالوريا', line2: 'الآداب والعلوم الإنسانية' };
      return { line1: 'الأولى باكالوريا', line2: 'العلوم التجريبية' };
    }
    const words = s.split(/\s+/);
    if (words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      return { line1: words.slice(0, mid).join(' '), line2: words.slice(mid).join(' ') };
    }
    return { line1: s, line2: '' };
  }

  if (/tronc\s*commun/i.test(s)) {
    const rest = s.replace(/tronc\s*commun/i, '').replace(/^[\s\-_:]+/, '').trim();
    return { line1: 'Tronc Commun', line2: rest || 'Scientifique' };
  }

  if (/2\s*(è|e|eme|ème)?\s*(année\s*)?bac/i.test(s)) {
    let rest = s.replace(/2\s*(è|e|eme|ème)?\s*(année\s*)?bac/i, '').replace(/^[\s\-_:]+/, '').trim();
    if (/^sx$/i.test(rest)) rest = 'Sciences Exp';
    if (/^sm$/i.test(rest)) rest = 'Sciences Math';
    if (/^se$/i.test(rest)) rest = 'Sciences Éco';
    return { line1: '2ème Année Bac', line2: rest || 'Sciences' };
  }

  if (/1\s*(è|e|ere|ère)?\s*(année\s*)?bac/i.test(s)) {
    let rest = s.replace(/1\s*(è|e|ere|ère)?\s*(année\s*)?bac/i, '').replace(/^[\s\-_:]+/, '').trim();
    if (/^sx$/i.test(rest)) rest = 'Sciences Exp';
    if (/^sm$/i.test(rest)) rest = 'Sciences Math';
    if (/^se$/i.test(rest)) rest = 'Sciences Éco';
    return { line1: '1ère Année Bac', line2: rest || 'Sciences' };
  }

  const words = s.split(/\s+/);
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return { line1: words.slice(0, mid).join(' '), line2: words.slice(mid).join(' ') };
  }

  return { line1: s, line2: '' };
};

const LATEX_COMMAND_RE = /\\(?:boxed|lim|frac|dfrac|left|right|cdot|sqrt|sum|int|prod|infty|to|ln|log|exp|sin|cos|tan|arcsin|arccos|arctan|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|mathbb|mathcal|mathbf|mathrm|text|vec|hat|bar|tilde|overline|underline|widehat|widetilde|dot|ddot|pm|mp|times|div|cap|cup|in|notin|subset|supset|leq|geq|le|ge|neq|approx|equiv|sim|forall|exists|partial|nabla|rightarrow|leftarrow|Rightarrow|Leftarrow|Leftrightarrow|iff|implies|quad|qquad|ell|Re|Im|max|min|sup|inf|det|dim|ker|rank|mod|circ|bullet|star|oplus|otimes|begin|end)\b/;

function autoWrapLatex(text) {
  if (!text) return '';
  if (text.includes('$') || text.includes('\\(') || text.includes('\\[') || text.includes('$$')) return text;
  
  if (/^\s*[\*\-+]\s+/.test(text) || text.includes('**') || /(?<!\*)\*[^*]+\*/.test(text)) {
    return text;
  }
  
  if (/[\u0600-\u06FF]/.test(text)) {
    return text;
  }

  const prefixMatch = text.match(/^(\s*(?:\*\*[a-zA-Z0-9]+[.)]\*\*|\([a-zA-Z0-9]+\)|[a-zA-Z0-9]+[.)])\s*)(.*)$/);
  let prefix = '';
  let candidate = text;
  if (prefixMatch) {
    prefix = prefixMatch[1];
    candidate = prefixMatch[2];
  }

  if (candidate.includes(' ')) {
    const cleanWords = candidate.replace(/[{}\[\]\(\),;=+\-*\/\\]/g, ' ').split(/\s+/).filter(Boolean);
    const mathCommands = new Set(['sin', 'cos', 'tan', 'lim', 'log', 'ln', 'exp', 'max', 'min', 'det', 'dim', 'ker', 'mod', 'frac', 'sqrt', 'infty', 'to', 'pi', 'dx', 'dy', 'dt', 'df']);
    for (const word of cleanWords) {
      if (/^[a-zA-ZÀ-ÿ]{3,}$/.test(word) && !mathCommands.has(word.toLowerCase())) {
        return text;
      }
    }
  }

  const mathWords = /\b(?:sqrt|pi|theta|infty|sin|cos|tan|ln|log|exp|lim)\b/i;
  const hasDivision = /\b\d+\s*\/\s*\d+\b/.test(candidate) || 
                      /\b[a-zA-Z0-9_]\s*\/\s*[a-zA-Z0-9(]/.test(candidate) ||
                      /\)\s*\/\s*[\d(a-zA-Z]/.test(candidate) ||
                      /[\d(a-zA-Z]\s*\/\s*\(/.test(candidate);

  if (/[\\^_{}]/.test(candidate) || 
      LATEX_COMMAND_RE.test(candidate) || 
      mathWords.test(candidate) || 
      candidate.includes('*') || 
      hasDivision ||
      /^[\[\]].*[\[\]]$/.test(candidate.trim())) {
    if (prefix) {
      return `${prefix}$${candidate}$`;
    }
    return `$${text}$`;
  }

  return text;
}

// KaTeX render helper for print HTML
const renderLatexToHtml = (text) => {
  if (!text || typeof text !== 'string') return '';
  const preprocessed = autoWrapLatex(text);

  let s = preprocessed
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x60;/g, '`')
    // Fix double-backslash LaTeX commands (e.g. \\frac → \frac, \\iff → \iff, \\begin → \begin)
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
    // Fix double-backslash before non-alpha chars that are valid LaTeX (e.g. \\\\ → \\)
    .replace(/\\\\(?=[{},|^_])/g, '\\');

  // 1. Repair broken \neq (e.g. \n eq, newline + eq, or plain eq 0 in conditions)
  s = s
    .replace(/\\n\s*eq\b/g, '\\neq')
    .replace(/(?<=[x-z0-9\s])\beq\s*([0-9a-zA-Z])/g, '\\neq $1')
    .replace(/(?<![a-zA-Z\\])neq\b/g, '\\neq');

  // 2. Robust math environment wrapper
  // Matches optional equation LHS prefix (e.g. f(x) = or (S) : or u_n =) followed by \begin{env}...\end{env}
  // and guarantees the whole equation is enclosed in display math ($$ ... $$)
  const envPattern = /(?:(?:\$\$|\$)\s*)?((?:(?:[a-zA-Z0-9_'\(\)\s\^\{\}\[\]+\\-]+|\\left\.?|\\left\\\{)\s*[:=]\s*)?\\begin\{(cases|aligned|matrix|pmatrix|vmatrix|array|gather|split|bmatrix|Bmatrix)\}[\s\S]*?\\end\{\2\}(?:\s*\\right\.)?)(?:\s*(?:\$\$|\$))?/g;

  s = s.replace(envPattern, (match, body) => {
    let cleanBody = body.trim();
    cleanBody = cleanBody.replace(/^\${1,2}/, '').replace(/\${1,2}$/, '').trim();
    return `\n\n$$${cleanBody}$$\n\n`;
  });

  // Split by existing math blocks: ONLY modify text OUTSIDE math blocks!
  const parts = s.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g);
  let processed = parts.map((part, idx) => {
    if (idx % 2 === 1) return part; // inside existing math block: leave untouched!

    // If the non-math part already contains unresolved complex LaTeX, do NOT blindly wrap single operators!
    if (/[\\^_{}]/.test(part) && /\\(?:lim|frac|dfrac|sqrt|sum|int|prod|begin)\b/.test(part)) {
      return part;
    }

    let textPart = part
      .replace(/\\notin\b/g, '__LATEX_NOTIN__')
      .replace(/\\neq\b/g, '__LATEX_NEQ__')
      .replace(/\\ne\b/g, '__LATEX_NE__')
      .replace(/\\neg\b/g, '__LATEX_NEG__')
      .replace(/\\nabla\b/g, '__LATEX_NABLA__')
      .replace(/\\natural\b/g, '__LATEX_NATURAL__')
      .replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)([A-ZÀ-ÖØ-ß])/g, '\n $1')
      .replace(/__LATEX_NOTIN__/g, '\\notin ')
      .replace(/__LATEX_NEQ__/g, '\\neq ')
      .replace(/__LATEX_NE__/g, '\\ne ')
      .replace(/__LATEX_NEG__/g, '\\neg ')
      .replace(/__LATEX_NABLA__/g, '\\nabla ')
      .replace(/__LATEX_NATURAL__/g, '\\natural ')
      .replace(/(?<![a-zA-Z\\])otin(?=[\\\{\sA-Z0-9\(\[]|$)/g, '\\notin ')
      .replace(/\baotinN\b/g, '$a \\notin \\mathbb{N}$')
      .replace(/\ba\s*otin\s*N\b/g, '$a \\notin \\mathbb{N}$')
      .replace(/sinon\s*a\s*\n?\s*otin\s*N/gi, 'sinon $a \\notin \\mathbb{N}$')
      // Unicode sets: ℕ, ℝ, ℤ, ℚ, ℂ
      .replace(/[\u2115]/g, '$\\mathbb{N}$')
      .replace(/[\u211D]/g, '$\\mathbb{R}$')
      .replace(/[\u2124]/g, '$\\mathbb{Z}$')
      .replace(/[\u211A]/g, '$\\mathbb{Q}$')
      .replace(/[\u2102]/g, '$\\mathbb{C}$')
      // Contextual sets: e.g. "Ensemble N", "dans N", "appartient à N", "soit N"
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bN\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{N}$')
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bR\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{R}$')
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bZ\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{Z}$')
      // Wrap standalone \mathbb{...}, \mathcal{...}, \mathbf{...}, \mathrm{...}
      .replace(/(?<![$\w\\])(\\(?:mathbb|mathbf|mathcal|mathrm)\{[a-zA-Z0-9]+\})(?![$\w\\])/g, (_, m) => `$${m}$`)
      .replace(/(?<![$\w\\])(\\mathbb[a-zA-Z0-9])(?![$\w\\])/g, (_, m) => `$${m}$`);

    if (/[\u0600-\u06FF]/.test(textPart)) {
      textPart = textPart.replace(/(?<![$\w\\])([a-zA-Z\\(][a-zA-Z0-9\\_{}^+\-*\/=<>()[\]\s,.;:]*[a-zA-Z0-9\\_{}^+\-*\/=>)\]])(?![$\w\\])/g, (match) => {
        let m = match.trim();
        let trailingPunct = '';
        if (m.endsWith(':') || m.endsWith('؛') || m.endsWith('،')) {
          trailingPunct = m.slice(-1);
          m = m.slice(0, -1).trim();
        }
        const isMath = /[\\_^=+\-*\/<>]/.test(m) || /^\([a-zA-Z]\w*\)/.test(m) || /^[a-zA-Z]\w*_\w+/.test(m);
        if (isMath) {
          return ` $${m}$ ${trailingPunct}`;
        }
        return match;
      });

      textPart = textPart.replace(/(?<![$\w\\])\b([a-zA-Z])\b(?![$\w\\])/g, ' $$$1$$ ');
      textPart = textPart.replace(/[ ]{2,}/g, ' ').trim();
    }

    return textPart;
  }).join('');

  const unescapeMathEntities = (str) => {
    if (!str) return '';
    return str
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"');
  };

  // Display math $$...$$
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      const cleanMath = unescapeMathEntities(math.trim());
      return katex.renderToString(cleanMath, { displayMode: true, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<span style="font-style:italic;opacity:0.75">${math}</span>`;
    }
  });

  // Multiline inline math environments $\begin{cases} ... \end{cases}$
  processed = processed.replace(/\$(\s*\\begin\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\}[\s\S]*?\\end\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\}\s*)\$/g, (_, math) => {
    try {
      const cleanMath = unescapeMathEntities(math.trim());
      return katex.renderToString(cleanMath, { displayMode: true, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<span style="font-style:italic;opacity:0.75">${math}</span>`;
    }
  });

  // Inline math $...$
  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      const cleanMath = unescapeMathEntities(math.trim());
      return katex.renderToString(cleanMath, { displayMode: false, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<span style="font-style:italic;opacity:0.75">${math}</span>`;
    }
  });

  // LaTeX \( ... \)
  processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
    try {
      const cleanMath = unescapeMathEntities(math.trim());
      return katex.renderToString(cleanMath, { displayMode: false, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<span style="font-style:italic;opacity:0.75">${math}</span>`;
    }
  });

  // LaTeX \[ ... \]
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    try {
      const cleanMath = unescapeMathEntities(math.trim());
      return katex.renderToString(cleanMath, { displayMode: true, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<span style="font-style:italic;opacity:0.75">${math}</span>`;
    }
  });

  // Markdown bold outside math blocks
  processed = processed.replace(/\*\*([^*]+?)\*\*/g, '<strong style="font-weight: 800;">$1</strong>');

  return processed;
};

const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  // Protect math blocks ($...$ and $$...$$) from HTML entity encoding
  // Only escape HTML-special characters in TEXT portions, not inside math delimiters
  const str = String(unsafe);
  const parts = str.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) return part; // inside math block: leave untouched!
    return part
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
      // Note: do NOT escape apostrophes (') — they're safe in HTML content
      // and escaping them breaks LaTeX like \iff when passed through renderLatexToHtml
  }).join('');
};


// Markdown Table Parser to HTML
const renderMarkdownTableHtml = (lines) => {
  const isTableLine = (l) => l.trim().startsWith('|') && l.trim().endsWith('|');
  const validLines = lines.filter(isTableLine);
  if (validLines.length < 1) return '';

  const splitRow = (rowStr) => {
    return rowStr
      .trim()
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map(c => c.trim());
  };

  const headers = splitRow(validLines[0]);
  let startIndex = 1;

  if (validLines.length > 1 && /^\|(?:\s*:?-+:?\s*\|)+$/.test(validLines[1].trim())) {
    startIndex = 2;
  }

  const rows = [];
  for (let i = startIndex; i < validLines.length; i++) {
    const cells = splitRow(validLines[i]);
    if (cells.length > 0) {
      while (cells.length < headers.length) cells.push('');
      rows.push(cells.slice(0, headers.length));
    }
  }

  return `
    <div class="cs-table-wrapper">
      <table class="cs-mini-table">
        <thead>
          <tr>
            ${headers.map(h => `<th>${renderLatexToHtml(escapeHtml(h))}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${renderLatexToHtml(escapeHtml(cell))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

const getSectionTheme = (title = '', type = '') => {
  const t = (title || '').toLowerCase();
  const ty = (type || '').toLowerCase();

  if (ty === 'definition' || t.includes('définition') || t.includes('definition') || t.includes('notation') || t.includes('ensemble') || t.includes('vocabulaire') ||
      t.includes('تعريف') || t.includes('تعاريف') || t.includes('اصطلاح') || t.includes('مفهوم')) {
    return { bg: '#e0f2fe', border: '#005086', text: '#005086', icon: '📘' };
  }
  if (ty === 'property' || ty === 'theorem' || ty === 'corollary' || t.includes('propriété') || t.includes('propriete') || t.includes('théorème') || t.includes('theoreme') || t.includes('corollaire') || t.includes('règle') || t.includes('regle') || t.includes('critère') ||
      t.includes('خاصية') || t.includes('خاصيات') || t.includes('مبرهنة') || t.includes('مبرهنات') || t.includes('قاعدة') || t.includes('قواعد')) {
    return { bg: '#dcfce7', border: '#16a34a', text: '#15803d', icon: '📗' };
  }
  if (ty === 'example' || ty === 'exercise' || t.includes('exemple') || t.includes('application') || t.includes('exercice') || t.includes('activité') ||
      t.includes('مثال') || t.includes('أمثلة') || t.includes('تطبيق') || t.includes('تطبيقات') || t.includes('تمرين') || t.includes('تمارين') || t.includes('نشاط')) {
    return { bg: '#fef3c7', border: '#d97706', text: '#92400e', icon: '📙' };
  }
  if (ty === 'method' || t.includes('méthode') || t.includes('methode') || t.includes('comment savoir') || t.includes('démarche') ||
      t.includes('طريقة') || t.includes('طرائق') || t.includes('منهجية') || t.includes('كيفية')) {
    return { bg: '#ede9fe', border: '#7c3aed', text: '#6d28d9', icon: '💡' };
  }
  if (ty === 'remark' || t.includes('remarque') || t.includes('attention') || t.includes('note') ||
      t.includes('ملاحظة') || t.includes('ملاحظات') || t.includes('تنبيه') || t.includes('انتباه')) {
    return { bg: '#ffedd5', border: '#ea580c', text: '#c2410c', icon: '⚠️' };
  }
  return { bg: '#f1f5f9', border: '#005086', text: '#0f172a', icon: '🔷' };
};

export const generateCourseSummaryHTML = (data, qrDataUrl = '') => {
  const header = data?.content?.header || data?.header || {};
  const meta = header.summary_meta || {};

  const rawSections = data?.content?.sections || data?.sections || [];
  const summaryTitle = meta.title || header.fiche_title || data?.title || "Ensemble ℕ et l'arithmétique";
  const rawTitle = (summaryTitle || '')
    .replace(/^(?:Résumé\s*(?:de\s*cours)?\s*\d*\s*:\s*|ملخص\s*(?:الدرس)?\s*\d*\s*:\s*)/i, '')
    .trim() || summaryTitle;
  const cleanTitle = rawTitle;

  // Auto-detect if content or metadata is Arabic
  const hasArabic = (text) => /[\u0600-\u06FF]/.test(text || '');
  const isArabic = Boolean(
    data?.lang === 'ar' ||
    data?.language === 'ar' ||
    data?.content?.lang === 'ar' ||
    hasArabic(summaryTitle) ||
    hasArabic(rawTitle) ||
    hasArabic(data?.title) ||
    (rawSections && rawSections.some(s => hasArabic(s.title) || hasArabic(s.content) || (s.items && s.items.some(it => hasArabic(typeof it === 'string' ? it : it.text)))))
  );

  const rawProf = meta.prof || header.teacher || (isArabic ? 'فيصل البطخيلي' : 'Fayssal el boutkhili');
  const profClean = rawProf.replace(/^(Prof\s*:|الأستاذ\s*:|ذ\.\s*:?)\s*/i, '').trim() || rawProf;
  const academicYear = meta.academic_year || meta.year || header.year || '2025/2026';

  // Dynamic Badge Text: "RÉSUMÉ DE COURS" / "SÉRIE D'EXERCICES" or "ملخص الدرس" / "سلسلة التمارين"
  const getBadgeText = () => {
    if (meta.badge_label) return meta.badge_label;
    if (data?.badge_label) return data.badge_label;
    const combined = `${summaryTitle || ''} ${data?.type || ''} ${data?.category || ''}`.toLowerCase();
    const isExercise = combined.includes('exercice') || combined.includes('série') || combined.includes('serie') || combined.includes('تمرين') || combined.includes('سلسلة');
    if (isArabic) {
      return isExercise ? "سلسلة التمارين" : "ملخص الدرس";
    }
    return isExercise ? "SÉRIE D'EXERCICES" : "RÉSUMÉ DE COURS";
  };
  const badgeText = getBadgeText();

  // Avoid school name (e.g. Lycée ...) leaking into educational level
  const candidateLevel = meta.level_name || data?.level_name || data?.level || data?.content?.level || header.level || header.niveau;
  const isSchoolName = (str) => /lyc[ée]e|coll[èe]ge|[ée]cole|direction|acad[ée]mie/i.test(str || '');
  const rawLevel = candidateLevel || (!isSchoolName(header?.prep_title) ? header?.prep_title : null) || (isArabic ? 'الجذع المشترك العلمي' : 'Tronc Commun Scientifique');
  const levelParts = splitLevelTitle(rawLevel, isArabic);

  const hasManualColumns = rawSections.some(sec => sec.column || sec.col);

  const col1 = [];
  const col2 = [];
  const col3 = [];

  rawSections.forEach((sec, idx) => {
    if (sec.column === 1 || sec.col === 1) col1.push(sec);
    else if (sec.column === 2 || sec.col === 2) col2.push(sec);
    else if (sec.column === 3 || sec.col === 3) col3.push(sec);
    else {
      const third = Math.ceil(rawSections.length / 3);
      if (idx < third) col1.push(sec);
      else if (idx < third * 2) col2.push(sec);
      else col3.push(sec);
    }
  });

  const columns = [col1, col2, col3];

  const renderSectionHtml = (sec) => {
    const rawTitle = (sec.title || '').replace(/^([•\-*]\s*)+/, '').replace(/\*\*/g, '').trim();
    const theme = getSectionTheme(rawTitle, sec.type);
    const titleHtml = rawTitle ? renderLatexToHtml(escapeHtml(rawTitle)) : '';
    const pointsHtml = (sec.points != null && sec.points !== '')
      ? `<span class="cs-points-badge" style="margin-${isArabic ? 'right' : 'left'}: auto;">(${sec.points} ${isArabic ? 'ن' : 'pts'})</span>`
      : '';

    let bodyHtml = '';

    // Accent Sub-Badge for Key Rules / Definitions
    if (sec.accent_text) {
      const formattedAccent = renderLatexToHtml(escapeHtml(sec.accent_text));
      bodyHtml += `<div class="cs-accent-box"><span class="cs-accent-bullet">✦</span> <span>${formattedAccent}</span></div>`;
    }

    const items = sec.items || [];
    let itemsTextAccumulator = '';

    if (items.length > 0) {
      items.forEach(it => {
        if (!it) return;

        if (it.type === 'grid_items' || Array.isArray(it.grid_items)) {
          const gList = it.grid_items || it.items || [];
          const cols = it.cols || 2;
          const gridItemsHtml = gList.map(gItem => {
            const gText = typeof gItem === 'string' ? gItem : (gItem?.text || '');
            itemsTextAccumulator += ' ' + gText;
            const isHeader = /^\*\*[^*]+\*\*$/.test(gText.trim());
            const formatted = renderLatexToHtml(escapeHtml(gText));
            return `<div class="cs-grid-item ${isHeader ? 'cs-grid-header' : ''}">${formatted}</div>`;
          }).join('');
          bodyHtml += `<div class="cs-grid-container" style="display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: 4px 6px; margin: 4px 0;">${gridItemsHtml}</div>`;
          return;
        }

        if (it.type === 'table' || it.table || it.table_data) {
          const tbl = it.table || it.table_data || it.data || it.text || '';
          if (typeof tbl === 'string') {
            bodyHtml += renderMarkdownTableHtml(tbl.split('\n'));
          } else if (tbl && tbl.headers && tbl.rows) {
            const headersHtml = tbl.headers.map(h => `<th>${renderLatexToHtml(escapeHtml(h))}</th>`).join('');
            const rowsHtml = tbl.rows.map(row => `<tr>${row.map(c => `<td>${renderLatexToHtml(escapeHtml(c))}</td>`).join('')}</tr>`).join('');
            bodyHtml += `<div class="cs-table-wrapper"><table class="cs-mini-table"><thead><tr>${headersHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
          }
          return;
        }

        if (it.type === 'image' || it.url || it.svg_code) {
          if (it.svg_code) {
            bodyHtml += `<div style="margin: 6px 0; text-align: center;">${it.svg_code}</div>`;
          } else if (it.url) {
            bodyHtml += `<div style="margin: 6px 0; text-align: center;"><img src="${escapeHtml(it.url)}" alt="${escapeHtml(it.alt || '')}" style="max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 4px; border: 1px solid #e2e8f0;" /></div>`;
          }
          return;
        }

        if (it.type === 'notation_grid') {
          const colsHtml = (it.notation_columns || []).map(col => {
            const blocksHtml = (col.math_blocks || []).map(mb => `<div style="margin: 2px 0;">${renderLatexToHtml(escapeHtml(mb))}</div>`).join('');
            return `<div style="flex: 1; padding: 4px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;"><strong style="font-size: 0.82rem; color: #005086; display: block; margin-bottom: 2px;">${escapeHtml(col.title || '')}</strong>${blocksHtml}</div>`;
          }).join('');
          bodyHtml += `<div style="display: flex; gap: 6px; margin: 4px 0;">${colsHtml}</div>`;
          return;
        }

        const text = typeof it === 'string' ? it : (it.text || it.content || '');
        itemsTextAccumulator += ' ' + text;
        const lines = text.split('\n');
        const isTableLine = (l) => l.trim().startsWith('|') && l.trim().endsWith('|');
        const hasTable = lines.filter(isTableLine).length >= 1;

        if (hasTable) {
          const tableLines = [];
          const nonTableLines = [];
          lines.forEach(l => {
            if (isTableLine(l)) tableLines.push(l);
            else if (l.trim()) nonTableLines.push(l);
          });
          if (nonTableLines.length > 0) {
            bodyHtml += `<div class="cs-text-line">${renderLatexToHtml(escapeHtml(nonTableLines.join(' ')))}</div>`;
          }
          if (tableLines.length > 0) {
            bodyHtml += renderMarkdownTableHtml(tableLines);
          }
        } else {
          const isHighlight = it.type === 'example' || it.type === 'highlight_box' || it.is_highlight || it.is_example || /^(exemple|exemples|مثال|أمثلة)\s*:/i.test(text.trim());
          const renderedLines = lines.map(l => {
            const trimmed = l.trim();
            if (!trimmed) return '';

            const numMatch = trimmed.match(/^([•\-*]\s*)?(\*+)?(\(?[\d\u0660-\u0669]+[.)]\)?)(\*+)?\s*(.*)$/);
            let isBullet = false;
            let cleanLine = trimmed;

            if (numMatch && numMatch[3]) {
              isBullet = false;
              const numToken = numMatch[3];
              const restOfText = numMatch[5] || '';
              cleanLine = `**${numToken}** ${restOfText}`;
            } else {
              const hasBulletPrefix = /^([•]\s*|[-]\s+|\*(?!\*)\s+)/.test(trimmed);
              isBullet = hasBulletPrefix;
              cleanLine = trimmed.replace(/^([•]\s*|[-]\s+|\*(?!\*)\s+)/, '');
            }

            const formatted = renderLatexToHtml(escapeHtml(cleanLine));
            if (isBullet) {
              return `<div class="cs-bullet-item"><span class="cs-bullet-dot">•</span> <span>${formatted}</span></div>`;
            }
            return `<div class="cs-text-line">${formatted}</div>`;
          }).filter(Boolean).join('');

          if (isHighlight) {
            bodyHtml += `<div class="cs-yellow-box">${renderedLines}</div>`;
          } else {
            bodyHtml += renderedLines;
          }
        }
      });
    }

    // If section has raw content that is not represented in items, render it as well
    const rawContent = (sec.content || sec.description || '').trim();
    if (rawContent && (items.length === 0 || (rawContent.length > 30 && !itemsTextAccumulator.includes(rawContent.slice(0, 30))))) {
      const lines = rawContent.split('\n');
      let tableLines = [];
      let highlightLines = [];
      let normalLines = [];
      let inHighlight = false;

      const flush = () => {
        if (tableLines.length > 0) {
          bodyHtml += renderMarkdownTableHtml(tableLines);
          tableLines = [];
        }
        if (normalLines.length > 0) {
          bodyHtml += normalLines.join('');
          normalLines = [];
        }
        if (highlightLines.length > 0) {
          bodyHtml += `<div class="cs-yellow-box">${highlightLines.join('')}</div>`;
          highlightLines = [];
          inHighlight = false;
        }
      };

      lines.forEach(l => {
        const trimmed = l.trim();
        if (!trimmed) return;
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          flush();
          tableLines.push(trimmed);
          return;
        }
        if (tableLines.length > 0) {
          flush();
        }

        const isEx = /^(exemple|exemples|مثال|أمثلة|propriété|propriétés|خاصية|مبرهنة|comment savoir|\d+\s+est-il)/i.test(trimmed);
        if (isEx) {
          flush();
          inHighlight = true;
        }

        const numMatch = trimmed.match(/^([•\-*]\s*)?(\*+)?(\(?[\d\u0660-\u0669]+[.)]\)?)(\*+)?\s*(.*)$/);
        let isBullet = false;
        let cleanLine = trimmed;

        if (numMatch && numMatch[3]) {
          isBullet = false;
          const numToken = numMatch[3];
          const restOfText = numMatch[5] || '';
          cleanLine = `**${numToken}** ${restOfText}`;
        } else {
          const hasBulletPrefix = /^([•]\s*|[-]\s+|\*(?!\*)\s+)/.test(trimmed);
          isBullet = hasBulletPrefix;
          cleanLine = trimmed.replace(/^([•]\s*|[-]\s+|\*(?!\*)\s+)/, '');
        }

        const formatted = renderLatexToHtml(escapeHtml(cleanLine));
        const lineHtml = isBullet
          ? `<div class="cs-bullet-item"><span class="cs-bullet-dot">•</span> <span>${formatted}</span></div>`
          : `<div class="cs-text-line">${formatted}</div>`;

        if (inHighlight) {
          highlightLines.push(lineHtml);
        } else {
          normalLines.push(lineHtml);
        }
      });

      flush();
    }

    return `
      <div class="cs-section">
        ${titleHtml ? `
          <div class="cs-badge-header" style="background-color: ${theme.bg}; border-left-color: ${isArabic ? 'transparent' : theme.border}; border-right-color: ${isArabic ? theme.border : 'transparent'}; color: ${theme.text};">
            <span style="font-size: 0.9rem;">${theme.icon}</span> <span>${titleHtml}</span> ${pointsHtml}
          </div>
        ` : ''}
        <div class="cs-body-content">
          ${bodyHtml}
        </div>
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="${isArabic ? 'ar' : 'fr'}" dir="${isArabic ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(summaryTitle)} - Fiche</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.46/dist/katex.min.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;500;600;700;800;900&family=STIX+Two+Text:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600;1,700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'UKIJ Merdane';
      src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'UKIJ Merdane';
      src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'UKIJ Merdane';
      src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
      font-weight: bold;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'UKIJMerdane';
      src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'UKIJMerdaneRegular';
      src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'UKIJMerdaneRegular';
      src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'UKIJMerdaneRegular';
      src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
      font-weight: bold;
      font-style: normal;
      font-display: swap;
    }

    @page {
      size: A4 landscape;
      margin: 4mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: ${isArabic 
        ? "'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'STIX Two Text', serif" 
        : "'STIX Two Text', 'Computer Modern Serif', 'Latin Modern Roman', 'Cambria', 'Times New Roman', serif"};
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    .series-header-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1.5px solid #005086;
      border-radius: 8px;
      margin-bottom: 8px;
      background: #ffffff;
      box-shadow: 0 2px 6px rgba(0, 80, 134, 0.05);
      table-layout: fixed;
      font-family: inherit;
    }
    .series-header-table td {
      vertical-align: middle;
      padding: 8px 12px;
    }
    .series-header-left {
      width: 29%;
      border-right: 1px solid #7dd3fc;
      background: #ffffff !important;
      font-family: inherit;
    }
    .series-header-center {
      width: 42%;
      border-right: 1px solid #7dd3fc;
      text-align: center;
      padding: 8px 10px;
      background: #ffffff !important;
    }
    .series-header-right {
      width: 29%;
      background: #ffffff !important;
      padding: 6px 10px;
      font-family: inherit;
    }
    .series-main-title {
      margin: 0 0 5px 0;
      font-size: 1.2rem;
      font-weight: 800;
      color: #005086;
      line-height: 1.25;
      font-family: inherit;
      text-align: center;
      letter-spacing: -0.01em;
    }
    .series-pill-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 2px 14px;
      border: 1.2px solid #005086;
      border-radius: 9999px;
      background: #ffffff;
    }
    .series-pill-dot {
      color: #005086;
      font-size: 10px;
      line-height: 1;
    }
    .series-pill-text {
      color: #005086;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-family: inherit;
    }
    .series-niveau-label {
      font-size: 0.62rem;
      font-weight: 800;
      color: #0284c7;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 2px;
      font-family: inherit;
    }
    .series-level-text {
      font-size: 0.86rem;
      font-weight: 800;
      color: #005086;
      line-height: 1.2;
      font-family: inherit;
    }
    .series-qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1.5px solid #005086;
      border-radius: 5px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 1px 4px rgba(0, 80, 134, 0.12);
    }
    .series-qr-img {
      width: 52px;
      height: 52px;
      display: block;
      padding: 3px;
      background: #ffffff;
    }
    .series-qr-placeholder {
      width: 52px;
      height: 52px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .series-solution-banner {
      width: 100%;
      background: #005086;
      color: #ffffff;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-align: center;
      padding: 3px 4px;
      line-height: 1.15;
      box-sizing: border-box;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      text-transform: uppercase;
    }
    /* ── 3 Columns Continuous Flow (Sequential across columns, filling down to bottom) ── */
    .cs-columns-container {
      column-count: 3;
      column-gap: 14px;
      column-rule: 1.5px solid #005086;
      border: 1.5px solid #005086;
      border-radius: 4px;
      padding: 6px 8px;
      background: #ffffff;
      column-fill: balance;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      font-family: inherit;
    }
    @media print {
      .cs-columns-container {
        column-fill: auto !important;
      }
    }
    .cs-columns-container .cs-section {
      margin-bottom: 7px;
      break-inside: auto;
    }
    .cs-columns-container .cs-badge-header {
      break-inside: avoid;
      break-after: avoid;
      page-break-after: avoid;
    }
    .cs-columns-container .cs-yellow-box {
      break-inside: auto;
      background-color: #fffbeb !important;
      border: 1px solid #fde68a;
      border-left: 3px solid #f59e0b;
      padding: 4px 6px;
      margin: 4px 0;
      border-radius: 3px;
      font-family: inherit;
      font-size: 0.86rem;
      font-weight: 500;
      color: #0f172a;
      line-height: 1.45;
    }
    .cs-columns-container .cs-bullet-item {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      margin-bottom: 2.5px;
      break-inside: avoid;
      font-family: inherit;
      font-size: 0.86rem;
      line-height: 1.42;
      font-weight: 500;
      color: #0f172a;
    }
    .cs-columns-container .cs-bullet-dot {
      color: #005086;
      font-weight: 800;
      flex-shrink: 0;
    }
    .cs-columns-container .cs-text-line {
      margin-bottom: 2.5px;
      break-inside: avoid;
      font-family: inherit;
      font-size: 0.86rem;
      line-height: 1.42;
      font-weight: 500;
      color: #0f172a;
    }
    .cs-columns-container .cs-text-p {
      break-inside: auto;
      margin-bottom: 4px;
      font-family: inherit;
      font-size: 0.86rem;
      line-height: 1.45;
      font-weight: 500;
      color: #0f172a;
    }
    .cs-table-wrapper {
      margin: 4px 0;
      break-inside: avoid;
    }
    /* ── Accent Sub-Badge for Key Rules / Definitions ── */
    .cs-accent-box {
      background: #f0fdf4 !important;
      border: 1px solid #bbf7d0;
      border-left: 3px solid #16a34a;
      padding: 3px 6px;
      margin: 2px 0 5px 0;
      border-radius: 3px;
      font-size: 0.84rem;
      font-weight: 600;
      color: #15803d;
      line-height: 1.38;
      display: flex;
      align-items: flex-start;
      gap: 5px;
      break-inside: avoid;
    }
    .cs-accent-bullet {
      color: #16a34a;
      font-size: 0.85rem;
      line-height: 1.3;
      flex-shrink: 0;
    }
    /* ── Grid Items for formulas / comparative lists ── */
    .cs-grid-container {
      width: 100%;
      margin: 4px 0;
      box-sizing: border-box;
      break-inside: avoid;
    }
    .cs-grid-item {
      background: #f8fafc !important;
      border: 1px solid #e2e8f0;
      border-radius: 3.5px;
      padding: 3px 5px;
      font-size: 0.82rem;
      line-height: 1.35;
      box-sizing: border-box;
      overflow-x: auto;
      word-break: break-word;
    }
    .cs-grid-header {
      background: #eff6ff !important;
      border-color: #bfdbfe !important;
      color: #1e40af !important;
      font-weight: 800 !important;
      text-align: center;
    }
    .cs-points-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(0, 80, 134, 0.08);
      color: #005086;
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 0.72rem;
      font-weight: 700;
    }
    .cs-mini-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      border: 1.2px solid #005086;
      border-radius: 3px;
      overflow: hidden;
      margin: 2px 0;
    }
    .cs-mini-table th, .cs-mini-table td {
      border: 1px solid #7dd3fc;
      padding: 2px 4px;
      text-align: center;
      vertical-align: middle;
    }
    .cs-mini-table th {
      background: #f0f9ff;
      color: #005086;
      font-weight: 700;
    }
    .cs-mini-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* ── 3 Columns Manual Grid Layout (when column numbers are explicitly defined) ── */
    .cs-columns-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      border: 1.5px solid #005086;
      border-radius: 4px;
      background: #ffffff;
      font-family: inherit;
    }
    .cs-col {
      padding: 6px 8px;
    }
    .cs-col:not(:last-child) {
      border-right: 1.5px solid #005086;
    }
    .cs-section {
      margin-bottom: 7px;
    }
    .cs-badge-header {
      padding: 2px 6px;
      font-weight: 700;
      font-size: 0.85rem;
      margin-bottom: 4px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      gap: 5px;
      border-left: 3px solid;
      font-family: inherit;
      letter-spacing: 0.01em;
    }
    .cs-text-p {
      font-family: inherit;
      font-size: 0.86rem;
      line-height: 1.45;
      font-weight: 500;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .cs-yellow-box {
      background-color: #fffbeb !important;
      border: 1px solid #fde68a;
      border-left: 3px solid #f59e0b;
      padding: 4px 6px;
      margin: 4px 0;
      border-radius: 3px;
      font-family: inherit;
      font-size: 0.86rem;
      font-weight: 500;
      color: #0f172a;
      line-height: 1.45;
    }
    .katex {
      font-size: 1.05em;
      font-family: KaTeX_Main, 'STIX Two Text', serif;
    }

    /* ── RTL Styles for Arabic Mode ── */
    html[dir="rtl"] body {
      direction: rtl;
      text-align: right;
      font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'STIX Two Text', serif !important;
    }
    html[dir="rtl"] .series-header-left {
      border-right: none !important;
      border-left: 1px solid #7dd3fc !important;
    }
    html[dir="rtl"] .series-header-center {
      border-right: none !important;
      border-left: 1px solid #7dd3fc !important;
    }
    html[dir="rtl"] .series-main-title {
      letter-spacing: 0 !important;
      font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif !important;
    }
    html[dir="rtl"] .series-pill-text {
      font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif !important;
    }
    html[dir="rtl"] .series-niveau-label {
      font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif !important;
    }
    html[dir="rtl"] .series-level-text {
      font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif !important;
    }
    html[dir="rtl"] .series-solution-banner {
      font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif !important;
    }
    html[dir="rtl"] .cs-columns-container {
      direction: rtl;
      column-rule: 1.5px solid #005086;
    }
    html[dir="rtl"] .cs-col:not(:last-child) {
      border-right: none !important;
      border-left: 1.5px solid #005086 !important;
    }
    html[dir="rtl"] .cs-badge-header {
      border-left: none !important;
      border-right: 3px solid !important;
      font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif !important;
    }
    html[dir="rtl"] .cs-yellow-box {
      border-left: 1px solid #fde68a !important;
      border-right: 3px solid #f59e0b !important;
      font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif !important;
    }
    html[dir="rtl"] .cs-accent-box {
      border-left: 1px solid #bbf7d0 !important;
      border-right: 3px solid #16a34a !important;
    }
    html[dir="rtl"] .cs-grid-container {
      direction: rtl;
    }
    html[dir="rtl"] .cs-text-p,
    html[dir="rtl"] .cs-text-line,
    html[dir="rtl"] .cs-bullet-item {
      font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif !important;
    }
    html[dir="rtl"] .katex {
      direction: ltr !important;
      unicode-bidi: embed !important;
      display: inline-block !important;
    }
    html[dir="rtl"] .katex-display {
      direction: ltr !important;
      unicode-bidi: embed !important;
      display: block !important;
      text-align: center !important;
    }
  </style>
</head>
<body>
  <div>
    <table class="series-header-table">
      <tbody>
        <tr>
          <!-- Left Column: Teacher & Academic Year -->
          <td class="series-header-left">
            <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: #1e293b;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#005086" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>${isArabic ? 'الأستاذ :' : 'Prof :'} <strong style="color: #005086; font-weight: 800;">${escapeHtml(profClean)}</strong></span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: #1e293b;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#005086" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>${isArabic ? 'السنة الدراسية :' : 'A.S :'} <strong style="color: #005086; font-weight: 800;">${escapeHtml(academicYear)}</strong></span>
              </div>
            </div>
          </td>

          <!-- Middle Column: Title & Badge -->
          <td class="series-header-center">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <h1 class="series-main-title">
                ${renderLatexToHtml(escapeHtml(cleanTitle))}
              </h1>
              <div class="series-pill-badge">
                <span class="series-pill-dot">•</span>
                <span class="series-pill-text">${escapeHtml(badgeText)}</span>
              </div>
            </div>
          </td>

          <!-- Right Column: Level & QR Solution -->
          <td class="series-header-right">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
              <div style="flex: 1; text-align: center;">
                <div class="series-niveau-label">${isArabic ? 'المستوى' : 'NIVEAU'}</div>
                <div class="series-level-text">${escapeHtml(levelParts.line1)}</div>
                ${levelParts.line2 ? `<div class="series-level-text" style="margin-top: 1px;">${escapeHtml(levelParts.line2)}</div>` : ''}
              </div>

              <div class="series-qr-container">
                ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Solution QR" class="series-qr-img" />` : `
                  <div class="series-qr-placeholder">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#005086" stroke-width="2">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                    </svg>
                  </div>
                `}
                <div class="series-solution-banner">${isArabic ? 'الحل' : 'SOLUTION'}</div>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="cs-columns-container">
      ${[...rawSections].sort((a, b) => (a.column || a.col || 1) - (b.column || b.col || 1)).map(renderSectionHtml).join('')}
    </div>
  </div>
</body>
</html>`;
};

export const openCourseSummaryPrintWindow = async (data) => {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write('<!DOCTYPE html><html><head><title>Génération...</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#005086;"><h3>Préparation du document pour impression...</h3></body></html>');
  }

  const header = data?.content?.header || data?.header || {};
  const meta = header.summary_meta || {};
  let qrTarget = meta.solution_url || header.solution_url;
  if (!qrTarget) {
    let settingsPhone = '';
    let customWaMessage = '';
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const waRaw = localStorage.getItem('whatsappSettings');
        if (waRaw) {
          const waParsed = JSON.parse(waRaw);
          settingsPhone = waParsed.phoneNumber || '';
          customWaMessage = waParsed.message || '';
        }
      } catch (_) {}
      if (!settingsPhone) {
        settingsPhone = localStorage.getItem('profPhone') || '';
      }
    }
    const rawTargetPhone = settingsPhone || header.phone || '';
    let cleanWaPhone = (rawTargetPhone || '').replace(/[^\d+]/g, '');
    if (cleanWaPhone.startsWith('0') && cleanWaPhone.length === 10) cleanWaPhone = '212' + cleanWaPhone.slice(1);
    else if (!cleanWaPhone.startsWith('+') && !cleanWaPhone.startsWith('212') && cleanWaPhone.length === 9) cleanWaPhone = '212' + cleanWaPhone;
    cleanWaPhone = cleanWaPhone.replace(/^\+/, '');

    if (cleanWaPhone) {
      const msg = customWaMessage || `Bonjour Professeur, je souhaite avoir les résumés et solutions.`;
      qrTarget = `https://wa.me/${cleanWaPhone}?text=${encodeURIComponent(msg)}`;
    } else {
      const website = meta.website || header.phone || header.contact || 'www.elboutkhili.jimdofree.com';
      qrTarget = website?.startsWith('http') ? website : `https://${website || 'elboutkhili.jimdofree.com'}`;
    }
  }

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(qrTarget, {
      width: 150,
      margin: 1,
      color: { dark: '#005086', light: '#ffffff' }
    });
  } catch (err) {
    console.warn('QR Code generation error:', err);
  }

  const html = generateCourseSummaryHTML(data, qrDataUrl);
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 800);
  }
};
