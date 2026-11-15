// src/utils/generateEbookTemplatePDF.js
// Dedicated high-fidelity HTML & PDF print generator for E-Book documents (docType === 'ebook').
// Features the redesigned E-Book Editorial Masthead paired with the 3-column academic sheet layout.

import katex from 'katex';
import QRCode from 'qrcode';
import { getLevelDisplayName, normalizeLevel } from './levelHelpers.js';

const formatEbookLevelParts = (rawLevel, isArabic = false) => {
  if (!rawLevel) {
    return isArabic
      ? { line1: 'الجذع المشترك', line2: 'العلمي' }
      : { line1: 'Tronc Commun', line2: 'Scientifique' };
  }

  const trimmed = String(rawLevel).trim();
  const resolved = /^(?:common_core|1bac|2bac|tc_?|tcs|tca)/i.test(trimmed)
    ? getLevelDisplayName(normalizeLevel(trimmed), isArabic)
    : trimmed;

  if (isArabic) {
    if (resolved.includes('جدع') || resolved.includes('مشترك')) {
      if (resolved.includes('آداب') || resolved.includes('إنسان')) {
        return { line1: 'الجذع المشترك', line2: 'الآداب والعلوم الإنسانية' };
      }
      return { line1: 'الجذع المشترك', line2: 'العلمي' };
    }
    if (resolved.includes('ثانية باك') || resolved.includes('2')) {
      if (resolved.includes('رياض')) return { line1: 'الثانية باكالوريا', line2: 'العلوم الرياضية' };
      if (resolved.includes('آداب')) return { line1: 'الثانية باكالوريا', line2: 'الآداب والعلوم الإنسانية' };
      if (resolved.includes('PC') || resolved.includes('SVT')) return { line1: 'الثانية باكالوريا', line2: 'العلوم التجريبية (PC/SVT)' };
      return { line1: 'الثانية باكالوريا', line2: 'العلوم التجريبية' };
    }
    if (resolved.includes('أولى باك') || resolved.includes('1')) {
      if (resolved.includes('رياض')) return { line1: 'الأولى باكالوريا', line2: 'العلوم الرياضية' };
      if (resolved.includes('آداب')) return { line1: 'الأولى باكالوريا', line2: 'الآداب والعلوم الإنسانية' };
      return { line1: 'الأولى باكالوريا', line2: 'العلوم التجريبية' };
    }
    const words = resolved.split(/\s+/);
    if (words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      return { line1: words.slice(0, mid).join(' '), line2: words.slice(mid).join(' ') };
    }
    return { line1: resolved, line2: '' };
  }

  if (/tronc\s*commun/i.test(resolved)) {
    const rest = resolved.replace(/tronc\s*commun/i, '').replace(/^[\s\-_:]+/, '').trim();
    return { line1: 'Tronc Commun', line2: rest || 'Scientifique' };
  }

  if (/2\s*(è|e|eme|ème)?\s*(année\s*)?bac/i.test(resolved)) {
    let rest = resolved.replace(/2\s*(è|e|eme|ème)?\s*(année\s*)?bac/i, '').replace(/^[\s\-_:]+/, '').trim();
    rest = rest.replace(/pc_svt/gi, 'PC / SVT');
    if (/^sx$/i.test(rest)) rest = 'Sciences Exp.';
    if (/^sm$/i.test(rest)) rest = 'Sciences Math.';
    if (/^se$/i.test(rest)) rest = 'Sciences Éco.';
    return { line1: '2ème Année Bac', line2: rest || 'Sciences' };
  }

  if (/1\s*(è|e|ere|ère)?\s*(année\s*)?bac/i.test(resolved)) {
    let rest = resolved.replace(/1\s*(è|e|ere|ère)?\s*(année\s*)?bac/i, '').replace(/^[\s\-_:]+/, '').trim();
    rest = rest.replace(/pc_svt/gi, 'PC / SVT');
    if (/^sx$/i.test(rest)) rest = 'Sciences Exp.';
    if (/^sm$/i.test(rest)) rest = 'Sciences Math.';
    if (/^se$/i.test(rest)) rest = 'Sciences Éco.';
    return { line1: '1ère Année Bac', line2: rest || 'Sciences' };
  }

  const words = resolved.replace(/pc_svt/gi, 'PC / SVT').split(/\s+/);
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return { line1: words.slice(0, mid).join(' '), line2: words.slice(mid).join(' ') };
  }

  return { line1: resolved, line2: '' };
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
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
    .replace(/\\\\(?=[{},|^_])/g, '\\');

  s = s
    .replace(/\\n\s*eq\b/g, '\\neq')
    .replace(/(?<=[x-z0-9\s])\beq\s*([0-9a-zA-Z])/g, '\\neq $1')
    .replace(/(?<![a-zA-Z\\])neq\b/g, '\\neq');

  const envPattern = /(?:(?:\$\$|\$)\s*)?((?:(?:[a-zA-Z0-9_'\(\)\s\^\{\}\[\]+\\-]+|\\left\.?|\\left\\\{)\s*[:=]\s*)?\\begin\{(cases|aligned|matrix|pmatrix|vmatrix|array|gather|split|bmatrix|Bmatrix)\}[\s\S]*?\\end\{\2\}(?:\s*\\right\.)?)(?:\s*(?:\$\$|\$))?/g;
  s = s.replace(envPattern, (match, body) => {
    let cleanBody = body.trim();
    cleanBody = cleanBody.replace(/^\${1,2}/, '').replace(/\${1,2}$/, '').trim();
    return `\n\n$$${cleanBody}$$\n\n`;
  });

  const parts = s.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g);
  let processed = parts.map((part, idx) => {
    if (idx % 2 === 1) return part;

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
      .replace(/[\u2115]/g, '$\\mathbb{N}$')
      .replace(/[\u211D]/g, '$\\mathbb{R}$')
      .replace(/[\u2124]/g, '$\\mathbb{Z}$')
      .replace(/[\u211A]/g, '$\\mathbb{Q}$')
      .replace(/[\u2102]/g, '$\\mathbb{C}$')
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bN\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{N}$')
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bR\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{R}$')
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bZ\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{Z}$')
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

  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(unescapeMathEntities(math.trim()), { displayMode: true, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<span style="font-style:italic;opacity:0.75">${math}</span>`;
    }
  });

  processed = processed.replace(/\$(\s*\\begin\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\}[\s\S]*?\\end\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\}\s*)\$/g, (_, math) => {
    try {
      return katex.renderToString(unescapeMathEntities(math.trim()), { displayMode: true, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<span style="font-style:italic;opacity:0.75">${math}</span>`;
    }
  });

  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(unescapeMathEntities(math.trim()), { displayMode: false, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<span style="font-style:italic;opacity:0.75">${math}</span>`;
    }
  });

  processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
    try {
      return katex.renderToString(unescapeMathEntities(math.trim()), { displayMode: false, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<span style="font-style:italic;opacity:0.75">${math}</span>`;
    }
  });

  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    try {
      return katex.renderToString(unescapeMathEntities(math.trim()), { displayMode: true, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<span style="font-style:italic;opacity:0.75">${math}</span>`;
    }
  });

  processed = processed.replace(/\*\*([^*]+?)\*\*/g, '<strong style="font-weight: 800;">$1</strong>');

  return processed;
};

const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  const str = String(unsafe);
  const parts = str.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) return part;
    return part
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }).join('');
};

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
    <div class="eb-table-wrapper">
      <table class="eb-mini-table">
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

export const generateEbookTemplateHTML = (data, qrDataUrl = '', options = {}) => {
  const showSolutions = options?.showSolutions !== false;
  const effectiveCols = [1, 2, 3].includes(Number(options?.columnsCount)) ? Number(options.columnsCount) : 3;

  const header = data?.content?.header || data?.header || {};
  const meta = header.summary_meta || {};

  const rawSections = data?.content?.sections || data?.sections || [];
  const summaryTitle = meta.title || header.fiche_title || data?.title || "Document E-Book";
  const rawTitle = (summaryTitle || '')
    .replace(/^(?:Résumé\s*(?:de\s*cours)?\s*\d*\s*:\s*|ملخص\s*(?:الدرس)?\s*\d*\s*:\s*|E-?Book\s*:\s*)/i, '')
    .trim() || summaryTitle;

  const hasArabic = (text) => /[\u0600-\u06FF]/.test(text || '');
  const isArabic = Boolean(
    data?.lang === 'ar' ||
    data?.language === 'ar' ||
    data?.content?.lang === 'ar' ||
    data?.content?.metadata?.language === 'ar' ||
    hasArabic(summaryTitle) ||
    hasArabic(rawTitle) ||
    hasArabic(data?.title) ||
    (rawSections && rawSections.some(s => hasArabic(s.title) || hasArabic(s.content) || (s.items && s.items.some(it => hasArabic(typeof it === 'string' ? it : it.text)))))
  );

  const rawProf = meta.prof || header.teacher || data?.teacher || (isArabic ? 'ذ. فيصل البطخيلي' : 'Fayssal el boutkhili');
  const profClean = rawProf.replace(/^(Prof\s*:|الأستاذ\s*:|ذ\.\s*:?)\s*/i, '').trim() || rawProf;
  const globalAcademicYear = (typeof window !== 'undefined' && window.localStorage)
    ? (localStorage.getItem('profAcademicYear') || localStorage.getItem('academicYear') || '')
    : '';
  const academicYear = meta.academic_year || meta.year || header.year || header.academic_year || data?.academicYear || globalAcademicYear || '2025/2026';
  const subjectName = header.subject || data?.subject || (isArabic ? 'الرياضيات' : 'Mathématiques');

  const badgeText = isArabic ? 'كتاب إلكتروني • طبعة رقمية' : 'E-BOOK • ÉDITION NUMÉRIQUE';
  const exerciseCount = (rawSections || []).filter(s => s?.type === 'exercise' || /exercice|تمرين/i.test(s?.title || '')).length;

  const candidateLevel = meta.level_name || data?.level_name || data?.level || data?.content?.level || header.level || header.niveau;
  const isSchoolName = (str) => /lyc[ée]e|coll[èe]ge|[ée]cole|direction|acad[ée]mie/i.test(str || '');
  const rawLevel = candidateLevel || (!isSchoolName(header?.prep_title) ? header?.prep_title : null) || (isArabic ? 'الجذع المشترك العلمي' : 'Tronc Commun Scientifique');
  const levelParts = formatEbookLevelParts(rawLevel, isArabic);

  const renderSectionHtml = (sec) => {
    const rawSecTitle = (sec.title || '').replace(/^([•\-*]\s*)+/, '').replace(/\*\*/g, '').trim();
    const theme = getSectionTheme(rawSecTitle, sec.type);
    const titleHtml = rawSecTitle ? renderLatexToHtml(escapeHtml(rawSecTitle)) : '';
    const hasPositivePoints = sec.points != null && sec.points !== '' && Number(sec.points) > 0;
    const pointsHtml = hasPositivePoints
      ? `<span class="eb-points-badge" style="margin-${isArabic ? 'right' : 'left'}: auto;">(${sec.points} ${isArabic ? 'ن' : 'pts'})</span>`
      : '';

    let bodyHtml = '';

    if (sec.accent_text) {
      const formattedAccent = renderLatexToHtml(escapeHtml(sec.accent_text));
      bodyHtml += `<div class="eb-accent-box"><span class="eb-accent-bullet">✦</span> <span>${formattedAccent}</span></div>`;
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
            return `<div class="eb-grid-item ${isHeader ? 'eb-grid-header' : ''}">${formatted}</div>`;
          }).join('');
          bodyHtml += `<div class="eb-grid-container" style="display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: 4px 6px; margin: 4px 0;">${gridItemsHtml}</div>`;
          return;
        }

        if (it.type === 'table' || it.table || it.table_data) {
          const tbl = it.table || it.table_data || it.data || it.text || '';
          if (typeof tbl === 'string') {
            bodyHtml += renderMarkdownTableHtml(tbl.split('\n'));
          } else if (tbl && tbl.headers && tbl.rows) {
            const headersHtml = tbl.headers.map(h => `<th>${renderLatexToHtml(escapeHtml(h))}</th>`).join('');
            const rowsHtml = tbl.rows.map(row => `<tr>${row.map(c => `<td>${renderLatexToHtml(escapeHtml(c))}</td>`).join('')}</tr>`).join('');
            bodyHtml += `<div class="eb-table-wrapper"><table class="eb-mini-table"><thead><tr>${headersHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
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
            bodyHtml += `<div class="eb-text-line">${renderLatexToHtml(escapeHtml(nonTableLines.join(' ')))}</div>`;
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
              return `<div class="eb-bullet-item"><span class="eb-bullet-dot">•</span> <span>${formatted}</span></div>`;
            }
            return `<div class="eb-text-line">${formatted}</div>`;
          }).filter(Boolean).join('');

          if (isHighlight) {
            bodyHtml += `<div class="eb-yellow-box">${renderedLines}</div>`;
          } else {
            bodyHtml += renderedLines;
          }
        }
      });
    }

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
          bodyHtml += `<div class="eb-yellow-box">${highlightLines.join('')}</div>`;
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
          ? `<div class="eb-bullet-item"><span class="eb-bullet-dot">•</span> <span>${formatted}</span></div>`
          : `<div class="eb-text-line">${formatted}</div>`;

        if (inHighlight) {
          highlightLines.push(lineHtml);
        } else {
          normalLines.push(lineHtml);
        }
      });

      flush();
    }

    const solHtml = (showSolutions && sec.solution && String(sec.solution).trim())
      ? `<div class="eb-solution-box"><div class="eb-solution-title"><span>📖</span><span>${isArabic ? 'الحل المقترح' : 'Démonstration & Solution'}</span></div><div>${renderLatexToHtml(escapeHtml(sec.solution)).replace(/\n/g, '<br/>')}</div></div>`
      : '';

    return `
      <div class="eb-section">
        ${titleHtml ? `
          <div class="eb-badge-header" style="background-color: ${theme.bg}; border-left-color: ${isArabic ? 'transparent' : theme.border}; border-right-color: ${isArabic ? theme.border : 'transparent'}; color: ${theme.text};">
            <span style="font-size: 0.9rem;">${theme.icon}</span> <span>${titleHtml}</span> ${pointsHtml}
          </div>
        ` : ''}
        <div class="eb-body-content">
          ${bodyHtml}
          ${solHtml}
        </div>
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="${isArabic ? 'ar' : 'fr'}" dir="${isArabic ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(rawTitle)} - E-Book</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.46/dist/katex.min.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;500;600;700;800;900&family=STIX+Two+Text:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600;1,700&display=swap" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'UKIJ Merdane';
      src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }

    @page {
      size: A4 ${effectiveCols >= 3 ? 'landscape' : 'portrait'};
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

    .eb-hero-shell {
      width: 100%;
      border-radius: 11px;
      overflow: hidden;
      margin-bottom: 10px;
      border: 1.5px solid #003865;
      background: #ffffff;
    }
    .eb-hero-banner {
      position: relative;
      background-color: #003b66 !important;
      background: linear-gradient(125deg, #001f3f 0%, #003b66 52%, #025d97 100%) !important;
      color: #ffffff !important;
      padding: 13px 18px 12px 18px;
      overflow: hidden;
    }
    .eb-hero-pattern {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.12;
    }
    .eb-hero-grid {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .eb-hero-left {
      flex: 1;
      min-width: 0;
    }
    .eb-hero-pills {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 7px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    .eb-pill-ebook {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2.5px 10px;
      border-radius: 9999px;
      background: rgba(245, 158, 11, 0.22) !important;
      border: 1px solid rgba(251, 191, 36, 0.7);
      color: #fef3c7 !important;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .eb-pill-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #fbbf24 !important;
      flex-shrink: 0;
    }
    .eb-pill-frost {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2.5px 9px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.14) !important;
      border: 1px solid rgba(255, 255, 255, 0.26);
      color: #e0f2fe !important;
      font-size: 0.65rem;
      font-weight: 700;
    }
    .eb-hero-title {
      margin: 0;
      font-size: 1.32rem;
      font-weight: 800;
      color: #ffffff !important;
      line-height: 1.24;
      letter-spacing: -0.01em;
    }
    .eb-hero-title .katex,
    .eb-hero-title .katex * {
      color: #ffffff !important;
    }
    .eb-hero-accent-rule {
      width: 58px;
      height: 3px;
      border-radius: 99px;
      background: #fbbf24 !important;
      margin-top: 7px;
    }
    .eb-hero-pedestal {
      flex-shrink: 0;
      background: #ffffff !important;
      color: #003865;
      border-radius: 9px;
      padding: 7px 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1.5px solid #ffffff;
    }
    .eb-pedestal-level {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      min-width: 105px;
    }
    .eb-niveau-label {
      font-size: 0.58rem;
      font-weight: 800;
      color: #0284c7;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      margin-bottom: 2px;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .eb-level-line1 {
      font-size: 0.86rem;
      font-weight: 900;
      color: #003865;
      line-height: 1.18;
    }
    .eb-level-line2 {
      display: inline-block;
      margin-top: 2.5px;
      padding: 1px 6px;
      border-radius: 4px;
      background: #e0f2fe !important;
      border: 1px solid #bae6fd;
      color: #0369a1;
      font-size: 0.7rem;
      font-weight: 800;
      line-height: 1.18;
    }
    .eb-qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1.5px solid #004777;
      border-radius: 5px;
      overflow: hidden;
      background: #ffffff;
    }
    .eb-qr-img {
      width: 46px;
      height: 46px;
      display: block;
      padding: 2px;
      background: #ffffff;
    }
    .eb-qr-placeholder {
      width: 46px;
      height: 46px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .eb-solution-banner {
      width: 100%;
      background: #003865 !important;
      color: #ffffff !important;
      font-size: 7.5px;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-align: center;
      padding: 2px 4px;
      line-height: 1.1;
      text-transform: uppercase;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .eb-hero-dock {
      background: #f8fafc !important;
      border-top: 2.5px solid #f59e0b;
      padding: 5.5px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 0.74rem;
      color: #1e293b;
    }
    .eb-dock-author {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-weight: 700;
      color: #0f172a;
    }
    .eb-dock-avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #003865 !important;
      color: #fbbf24 !important;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .eb-dock-stats {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.7rem;
      font-weight: 700;
      color: #475569;
    }
    .eb-dock-stat-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1.5px 7px;
      border-radius: 5px;
      background: #ffffff !important;
      border: 1px solid #cbd5e1;
      color: #003865;
    }

    /* ── Multi-Column Body ── */
    .eb-columns-container {
      column-count: ${effectiveCols};
      column-gap: 14px;
      column-rule: ${effectiveCols > 1 ? '1.5px solid #005086' : 'none'};
      border: 1.5px solid #005086;
      border-radius: 4px;
      padding: 6px 8px;
      background: #ffffff;
      column-fill: auto;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    .eb-section {
      margin-bottom: 7px;
      break-inside: auto;
    }
    .eb-badge-header {
      padding: 2.5px 6px;
      font-weight: 700;
      font-size: 0.84rem;
      margin-bottom: 4px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      gap: 5px;
      border-left: 3px solid;
      break-inside: avoid;
      break-after: avoid;
      page-break-after: avoid;
    }
    .eb-points-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(0, 80, 134, 0.08);
      color: #005086;
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .eb-yellow-box {
      break-inside: auto;
      background-color: #fffbeb !important;
      border: 1px solid #fde68a;
      border-left: 3px solid #f59e0b;
      padding: 4px 6px;
      margin: 4px 0;
      border-radius: 3px;
      font-size: 0.85rem;
      font-weight: 500;
      color: #0f172a;
      line-height: 1.44;
    }
    .eb-accent-box {
      background: #f0fdf4 !important;
      border: 1px solid #bbf7d0;
      border-left: 3px solid #16a34a;
      padding: 3px 6px;
      margin: 2px 0 5px 0;
      border-radius: 3px;
      font-size: 0.83rem;
      font-weight: 600;
      color: #15803d;
      line-height: 1.38;
      display: flex;
      align-items: flex-start;
      gap: 5px;
      break-inside: avoid;
    }
    .eb-solution-box {
      background: #f0fdf4 !important;
      border: 1px solid #bbf7d0;
      border-left: 3px solid #059669;
      padding: 4px 6px;
      margin: 5px 0 2px 0;
      border-radius: 3px;
      font-size: 0.82rem;
      line-height: 1.42;
      color: #064e3b;
      break-inside: auto;
    }
    .eb-solution-title {
      font-size: 0.72rem;
      font-weight: 800;
      color: #047857;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
      text-transform: uppercase;
    }
    .eb-bullet-item {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      margin-bottom: 2.5px;
      break-inside: avoid;
      font-size: 0.85rem;
      line-height: 1.42;
      font-weight: 500;
      color: #0f172a;
    }
    .eb-bullet-dot {
      color: #005086;
      font-weight: 800;
      flex-shrink: 0;
    }
    .eb-text-line {
      margin-bottom: 2.5px;
      break-inside: avoid;
      font-size: 0.85rem;
      line-height: 1.42;
      font-weight: 500;
      color: #0f172a;
    }
    .eb-table-wrapper {
      margin: 4px 0;
      break-inside: avoid;
    }
    .eb-mini-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      border: 1.2px solid #005086;
      border-radius: 3px;
      overflow: hidden;
      margin: 2px 0;
    }
    .eb-mini-table th, .eb-mini-table td {
      border: 1px solid #7dd3fc;
      padding: 2px 4px;
      text-align: center;
      vertical-align: middle;
    }
    .eb-mini-table th {
      background: #f0f9ff !important;
      color: #005086;
      font-weight: 700;
    }
    .eb-grid-container {
      width: 100%;
      margin: 4px 0;
      break-inside: avoid;
    }
    .eb-grid-item {
      background: #f8fafc !important;
      border: 1px solid #e2e8f0;
      border-radius: 3.5px;
      padding: 3px 5px;
      font-size: 0.82rem;
      line-height: 1.35;
      overflow-x: auto;
      word-break: break-word;
    }
    .eb-grid-header {
      background: #eff6ff !important;
      border-color: #bfdbfe !important;
      color: #1e40af !important;
      font-weight: 800 !important;
      text-align: center;
    }
    .eb-footer-bar {
      margin-top: 6px;
      padding: 3px 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.68rem;
      color: #475569;
      border-top: 1px solid #cbd5e1;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .katex {
      font-size: 1.04em;
      font-family: KaTeX_Main, 'STIX Two Text', serif;
    }
    .katex .msupsub {
      font-size: 1.0em !important;
    }
    .katex .msupsub .sizing.size3,
    .katex .msupsub .sizing.reset-size6.size3,
    .katex .msupsub .vlist-t:not(.vlist-t2) .sizing.size3,
    .katex .msupsub .vlist-t:not(.vlist-t2) .sizing.reset-size6.size3,
    .katex .msupsub .vlist-t.vlist-t2 span[style*="top:-3"] .sizing.size3,
    .katex .msupsub .vlist-t.vlist-t2 span[style*="top:-3"] .sizing.reset-size6.size3,
    .katex .msupsub .vlist-t .sizing.size3,
    .katex .msupsub .vlist-t .sizing.reset-size6.size3 {
      font-size: 0.70em !important;
    }
    .katex .msupsub .sizing > span,
    .katex .msupsub .sizing .mord,
    .katex .msupsub .sizing .mtight {
      font-size: inherit !important;
    }
    .katex .sqrt > .root {
      font-size: 1.0em !important;
    }
    .katex .sqrt > .root .sizing,
    .katex .sqrt > .root .sizing.size1,
    .katex .sqrt > .root .sizing.reset-size6.size1,
    .katex .sizing.reset-size6.size1,
    .katex .fontsize-ensurer.reset-size6.size1 {
      font-size: 0.58em !important;
    }
    .katex .sqrt > .root .sizing > span,
    .katex .sqrt > .root .sizing .mord,
    .katex .sqrt > .root .sizing .mtight {
      font-size: inherit !important;
    }

    html[dir="rtl"] body {
      direction: rtl;
      text-align: right;
    }
    html[dir="rtl"] .eb-pedestal-level {
      align-items: flex-end !important;
    }
    html[dir="rtl"] .eb-hero-dock,
    html[dir="rtl"] .eb-pill-ebook,
    html[dir="rtl"] .eb-pill-frost {
      letter-spacing: 0.01em !important;
    }
    html[dir="rtl"] .eb-badge-header {
      border-left: none !important;
      border-right: 3px solid !important;
    }
    html[dir="rtl"] .eb-yellow-box {
      border-left: 1px solid #fde68a !important;
      border-right: 3px solid #f59e0b !important;
    }
    html[dir="rtl"] .eb-accent-box,
    html[dir="rtl"] .eb-solution-box {
      border-left: 1px solid #bbf7d0 !important;
      border-right: 3px solid #059669 !important;
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
    <header class="eb-hero-shell">
      <div class="eb-hero-banner">
        <svg class="eb-hero-pattern" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <pattern id="eb-pdf-grid-pat" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#ffffff" stroke-width="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#eb-pdf-grid-pat)" />
          <circle cx="92%" cy="20%" r="120" fill="none" stroke="#fbbf24" stroke-width="1.2" />
          <circle cx="92%" cy="20%" r="165" fill="none" stroke="#ffffff" stroke-width="0.8" />
        </svg>

        <div class="eb-hero-grid">
          <div class="eb-hero-left">
            <div class="eb-hero-pills">
              <span class="eb-pill-ebook">
                <span class="eb-pill-dot"></span>
                <span>📚 ${escapeHtml(badgeText)}</span>
              </span>
              <span class="eb-pill-frost">${escapeHtml(subjectName)}</span>
              <span class="eb-pill-frost">${isArabic ? `السنة ${escapeHtml(academicYear)}` : `A.S ${escapeHtml(academicYear)}`}</span>
            </div>
            <h1 class="eb-hero-title">${renderLatexToHtml(escapeHtml(rawTitle))}</h1>
            <div class="eb-hero-accent-rule"></div>
          </div>

          <div class="eb-hero-pedestal">
            <div class="eb-pedestal-level">
              <span class="eb-niveau-label">${isArabic ? 'المستوى الدراسي' : 'NIVEAU'}</span>
              <span class="eb-level-line1">${escapeHtml(levelParts.line1)}</span>
              ${levelParts.line2 ? `<span class="eb-level-line2">${escapeHtml(levelParts.line2)}</span>` : ''}
            </div>

            <div class="eb-qr-container">
              ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Solution QR" class="eb-qr-img" />` : `
                <div class="eb-qr-placeholder">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#004777" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                  </svg>
                </div>
              `}
              <div class="eb-solution-banner">${isArabic ? 'الحل' : 'SOLUTION'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="eb-hero-dock">
        <div class="eb-dock-author">
          <span class="eb-dock-avatar">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </span>
          <span>
            ${isArabic ? 'الأستاذ :' : 'Prof :'} <strong style="color: #003865; font-weight: 800;">${escapeHtml(profClean)}</strong>
          </span>
        </div>

        <div class="eb-dock-stats">
          <span class="eb-dock-stat-chip">
            📑 ${rawSections.length} ${isArabic ? 'فقرات' : 'Sections'}
          </span>
          ${exerciseCount > 0 ? `
            <span class="eb-dock-stat-chip">
              📝 ${exerciseCount} ${isArabic ? 'تمارين' : (exerciseCount > 1 ? 'Exercices' : 'Exercice')}
            </span>
          ` : ''}
          <span class="eb-dock-stat-chip">
            📐 ${effectiveCols} ${isArabic ? 'أعمدة' : (effectiveCols > 1 ? 'Colonnes' : 'Colonne')}
          </span>
        </div>
      </div>
    </header>

    <div class="eb-columns-container">
      ${[...rawSections].sort((a, b) => (a.column || a.col || 1) - (b.column || b.col || 1)).map(renderSectionHtml).join('')}
    </div>

    <div class="eb-footer-bar">
      <span>${isArabic ? `كتاب إلكتروني • ${escapeHtml(subjectName)}` : `E-Book • ${escapeHtml(subjectName)}`}</span>
      <span>${escapeHtml(levelParts.line1)}${levelParts.line2 ? ` — ${escapeHtml(levelParts.line2)}` : ''}</span>
      <span>${escapeHtml(profClean)} • ${escapeHtml(academicYear)}</span>
    </div>
  </div>
</body>
</html>`;
};

export const openEbookTemplatePrintWindow = async (data, options = {}) => {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write('<!DOCTYPE html><html><head><title>Génération E-Book...</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#004777;"><h3>Préparation de l\'E-Book pour impression PDF...</h3></body></html>');
  }

  const header = data?.content?.header || data?.header || {};
  const meta = header.summary_meta || {};
  const rawTitle = meta.title || header.fiche_title || data?.title || 'E-Book';
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
    const rawTargetPhone = settingsPhone || header.phone || data?.phone || '';
    let cleanWaPhone = (rawTargetPhone || '').replace(/[^\d+]/g, '');
    if (cleanWaPhone.startsWith('0') && cleanWaPhone.length === 10) cleanWaPhone = '212' + cleanWaPhone.slice(1);
    else if (!cleanWaPhone.startsWith('+') && !cleanWaPhone.startsWith('212') && cleanWaPhone.length === 9) cleanWaPhone = '212' + cleanWaPhone;
    cleanWaPhone = cleanWaPhone.replace(/^\+/, '');

    if (cleanWaPhone) {
      const msg = customWaMessage || `Bonjour Professeur, je souhaite obtenir les solutions de l'E-Book "${rawTitle}".`;
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
      color: { dark: '#004777', light: '#ffffff' }
    });
  } catch (err) {
    console.warn('Ebook QR Code generation error:', err);
  }

  const html = generateEbookTemplateHTML(data, qrDataUrl, options);
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
