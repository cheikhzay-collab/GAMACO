import katex from 'katex';
import { mergeConsecutiveEntries } from './scheduleHelpers.js';

const KATEX_OPTIONS = {
  strict: 'ignore',
  throwOnError: false,
  trust: false,
};

const esc = (s) => {
  if (typeof s !== 'string') return String(s ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const getLevelDisplayName = (levelKey, isArabic) => {
  const mapping = {
    'common_core_sci': {
      fr: 'Tronc Commun Scientifique',
      ar: 'جدع مشترك علوم'
    },
    'common_core_arts': {
      fr: 'Tronc Commun Lettres',
      ar: 'جدع مشترك آداب'
    },
    '1bac_sci': {
      fr: '1ère Bac Sciences',
      ar: 'أولى باك علوم'
    },
    '1bac_arts': {
      fr: '1ère Bac Lettres',
      ar: 'أولى باك آداب'
    },
    '2bac_sm': {
      fr: '2ème Bac Sciences Maths',
      ar: 'ثانية باك علوم رياضية'
    },
    '2bac_pc_svt': {
      fr: '2ème Bac PC/SVT',
      ar: 'ثانية باك علوم تجريبية'
    },
    '2bac_arts': {
      fr: '2ème Bac Lettres',
      ar: 'ثانية باك آداب'
    }
  };
  const match = mapping[levelKey];
  if (match) return isArabic ? match.ar : match.fr;
  return levelKey || '';
};

const LATEX_COMMAND_RE = /\\(?:lim|frac|dfrac|left|right|cdot|sqrt|sum|int|prod|infty|to|ln|log|exp|sin|cos|tan|arcsin|arccos|arctan|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|mathbb|mathcal|mathbf|mathrm|text|vec|hat|bar|tilde|overline|underline|widehat|widetilde|dot|ddot|pm|mp|times|div|cap|cup|in|notin|subset|supset|leq|geq|le|ge|neq|approx|equiv|sim|forall|exists|partial|nabla|rightarrow|leftarrow|Rightarrow|Leftarrow|Leftrightarrow|iff|implies|quad|qquad|ell|Re|Im|max|min|sup|inf|det|dim|ker|rank|mod|circ|bullet|star|oplus|otimes|begin|end)\b/;

function autoWrapLatex(text) {
  if (text.includes('$')) return text;
  if (/^\s*[\*\-+]\s+/.test(text) || text.includes('**') || /(?<!\*)\*[^*]+\*/.test(text)) {
    return text;
  }
  if (text.includes(' ')) {
    const words = text.split(/\s+/);
    const mathCommands = new Set(['sin', 'cos', 'tan', 'lim', 'log', 'ln', 'exp', 'max', 'min', 'det', 'dim', 'ker', 'mod']);
    for (const word of words) {
      if (/^[a-zA-Z]{3,}$/.test(word) && !mathCommands.has(word.toLowerCase())) {
        return text;
      }
    }
  }
  const mathWords = /\b(?:sqrt|pi|theta|infty|sin|cos|tan|ln|log|exp|lim)\b/i;
  const hasDivision = /\b\d+\s*\/\s*\d+\b/.test(text) || 
                      /\b[a-zA-Z0-9_]\s*\/\s*[a-zA-Z0-9(]/.test(text) ||
                      /\)\s*\/\s*[\d(a-zA-Z]/.test(text) ||
                      /[\d(a-zA-Z]\s*\/\s*\(/.test(text);

  if (/[\\^_{}]/.test(text) || 
      LATEX_COMMAND_RE.test(text) || 
      mathWords.test(text) || 
      text.includes('*') || 
      hasDivision) {
    return `$${text}$`;
  }
  return text;
}

function tokenizeMath(text) {
  const tokens = [];
  let i = 0;
  let buf = '';

  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] === '$') {
      if (buf) { tokens.push({ type: 'text', content: buf }); buf = ''; }
      const start = i + 2;
      const end = text.indexOf('$$', start);
      if (end === -1) { buf += text.slice(i); i = text.length; }
      else { tokens.push({ type: 'block', content: text.slice(start, end) }); i = end + 2; }
      continue;
    }
    if (text[i] === '\\' && text[i + 1] === '$') { buf += '$'; i += 2; continue; }
    if (text[i] === '$') {
      let j = i + 1; let found = false;
      while (j < text.length) { if (text[j] === '\\') { j += 2; continue; } if (text[j] === '$') { found = true; break; } j++; }
      if (!found || j === i + 1) { buf += '$'; i++; }
      else { if (buf) { tokens.push({ type: 'text', content: buf }); buf = ''; } tokens.push({ type: 'inline', content: text.slice(i + 1, j) }); i = j + 1; }
      continue;
    }
    buf += text[i]; i++;
  }
  if (buf) tokens.push({ type: 'text', content: buf });
  return tokens;
}

const repairMathExpression = (latex) => {
  if (!latex) return '';
  let repaired = latex;
  repaired = repaired
    .replace(/(?<![a-zA-Z\\])pi\b/g, '\\pi')
    .replace(/(?<![a-zA-Z\\])theta\b/g, '\\theta')
    .replace(/(?<![a-zA-Z\\])infty\b/g, '\\infty')
    .replace(/(?<![a-zA-Z\\])sin\b/g, '\\sin')
    .replace(/(?<![a-zA-Z\\])cos\b/g, '\\cos')
    .replace(/(?<![a-zA-Z\\])tan\b/g, '\\tan')
    .replace(/(?<![a-zA-Z\\])ln\b/g, '\\ln')
    .replace(/(?<![a-zA-Z\\])log\b/g, '\\log')
    .replace(/(?<![a-zA-Z\\])exp\b/g, '\\exp')
    .replace(/(?<![a-zA-Z\\])lim\b/g, '\\lim');

  repaired = repaired.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
  repaired = repaired.replace(/\^\(([^)]+)\)/g, '^{$1}');
  repaired = repaired.replace(/\*/g, '\\cdot');
  repaired = repaired.replace(/(?<![a-zA-Z0-9\\_])([a-zA-Z0-9\\_]+)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
  repaired = repaired.replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
  repaired = repaired.replace(/\(([^)]+)\)\s*\/\s*([a-zA-Z0-9\\_]+)(?![a-zA-Z0-9\\_])/g, '\\frac{$1}{$2}');
  repaired = repaired.replace(/(?<![a-zA-Z0-9\\_])([a-zA-Z0-9\\_]+)\s*\/\s*([a-zA-Z0-9\\_]+)(?![a-zA-Z0-9\\_])/g, '\\frac{$1}{$2}');
  return repaired;
};

const renderInlineKatex = (latex) => {
  try {
    const repaired = repairMathExpression(latex);
    return katex.renderToString(repaired, { ...KATEX_OPTIONS, displayMode: false });
  }
  catch { return `<span style="font-style:italic;opacity:0.75">${esc(latex)}</span>`; }
};

const renderBlockKatex = (latex) => {
  try {
    const repaired = repairMathExpression(latex);
    return katex.renderToString(repaired, { ...KATEX_OPTIONS, displayMode: true });
  }
  catch { return `<span style="font-style:italic;opacity:0.75;display:block">${esc(latex)}</span>`; }
};

const renderLineContent = (text, isArabic) => {
  const toParse = autoWrapLatex(text);
  const tokens = tokenizeMath(toParse);
  const html = tokens.map((tok) => {
    if (tok.type === 'block') return renderBlockKatex(tok.content);
    if (tok.type === 'inline') return renderInlineKatex(tok.content);
    return esc(tok.content);
  }).join('');
  let processed = html
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
  // Strip any remaining unclosed orphan ** (safety guard)
  processed = processed.replace(/\*\*/g, '');
  return processed;
};

const startsWithArabic = (str) => {
  if (!str) return false;
  const clean = str.trim();
  if (!clean) return false;
  const cleanFormatting = clean.replace(/^[\*\s_#\-✏■›–—]+/, '').trim();
  if (!cleanFormatting) return false;
  const firstChar = cleanFormatting.charAt(0);
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(firstChar);
};

const getLineStyle = (raw, isHeader, index) => {
  const trimmed = raw.trim();
  if (trimmed === '') return { type: 'empty', text: '' };

  // Strip true bullets (•, ▪, ■, ›, –, — or a lone - / * followed by whitespace) without touching ** bold markers
  let clean = trimmed.replace(/^(\s*(?:[•▪■›–—]|-(?!-)\s+|\*(?!\*)\s+))+/, '').trim();
  // Plain text stripped of markdown ** for robust matching
  const plain = clean.replace(/\*\*/g, '').trim();

  // 1. Chapter Title: === TITLE === or first line header or all-caps header
  if (/^={2,}\s*(.*?)\s*={2,}$/.test(clean)) {
    const m = clean.match(/^={2,}\s*(.*?)\s*={2,}$/);
    return { type: 'chapter', text: m[1].replace(/\*\*/g, '').trim() };
  }
  if ((isHeader && index === 0) || (/^[A-ZÀ-ÖØ-ß\s\-_:]{5,}$/.test(plain) && index === 0)) {
    return { type: 'chapter', text: plain };
  }

  // 2. Exercise Title: Exercice 4..., تمرين..., etc.
  if (/^(exercice|تمرين|devoir|contrôle|فرض)\s*n?°?\s*\d*/i.test(plain)) {
    const exerciseText = clean.replace(/\*\*/g, '').replace(/\s*:\s*$/, ' :').trim();
    return { type: 'exercise', text: exerciseText };
  }

  // 3. Series / Section / Subheader: e.g. "Série de Révision : ...", "Partie A : ..."
  if (/^(série|serie|partie|châpitre|chapitre|axe|محور|سلسلة|جزء)\s*[:\d\-]/i.test(plain)) {
    return { type: 'section', text: clean.replace(/\*\*/g, '').trim() };
  }

  // 4. Roman numeral axis: I., II., III. …
  if (/^(I{1,3}|IV|V?I{0,3}|IX|X{0,3})\.\s+/i.test(plain)) {
    return { type: 'axis', text: clean };
  }

  // 5. Numbered items: 1., 2., 3., 1), a), 2.a), etc. (with or without **)
  const numMatch = clean.match(/^(\*\*)?(\d+(?:\.[a-zA-Z0-9]+)*|[a-zA-Z])([.)])(\*\*)?\s*(.*)$/);
  if (numMatch) {
    const numLabel = numMatch[2] + numMatch[3];
    const bodyText = numMatch[5].trim();
    return { type: 'numbered', numLabel, text: bodyText };
  }

  // 6. Math formula block on its own line: $$ ... $$ or starting with $$
  if (/^\$\$.*\$\$$/.test(clean) || clean.startsWith('$$') || clean.endsWith('$$')) {
    return { type: 'formula', text: clean };
  }

  // 7. Context / Statement introduction: "Soient ...", "On considère ...", "Dans un repère ...", "لتكن ..."
  if (/^(soient|soit|on considère|on pose|considérons|dans un|supposons|montrer que|démontrer que|déterminer|sachant que|ليكن|لتكن|نعتبر|في معلم|بين أن|أثبت أن)/i.test(plain)) {
    return { type: 'intro_text', text: clean };
  }

  // 8. Pedagogical blocks by keyword
  const lower = plain.toLowerCase();
  const pedagKeywords = {
    activité:    { color: '#d97706', bg: 'rgba(245,158,11,0.06)' },
    نشاط:        { color: '#d97706', bg: 'rgba(245,158,11,0.06)' },
    définition:  { color: '#4f46e5', bg: 'rgba(79,70,229,0.06)' },
    تعريف:       { color: '#4f46e5', bg: 'rgba(79,70,229,0.06)' },
    propriété:   { color: '#7c3aed', bg: 'rgba(124,58,237,0.06)' },
    خاصية:       { color: '#7c3aed', bg: 'rgba(124,58,237,0.06)' },
    théorème:    { color: '#db2777', bg: 'rgba(219,39,119,0.06)' },
    مبرهنة:      { color: '#db2777', bg: 'rgba(219,39,119,0.06)' },
    remarque:    { color: '#475569', bg: 'rgba(71,85,105,0.06)' },
    ملاحظة:      { color: '#475569', bg: 'rgba(71,85,105,0.06)' },
    application: { color: '#059669', bg: 'rgba(5,150,105,0.06)' },
    تطبيق:       { color: '#059669', bg: 'rgba(5,150,105,0.06)' },
    correction:  { color: '#dc2626', bg: 'rgba(220,38,38,0.06)' },
    تصحيح:       { color: '#dc2626', bg: 'rgba(220,38,38,0.06)' },
    exemple:     { color: '#0284c7', bg: 'rgba(2,132,199,0.06)' },
    مثال:        { color: '#0284c7', bg: 'rgba(2,132,199,0.06)' },
  };

  for (const [kw, style] of Object.entries(pedagKeywords)) {
    if (lower.startsWith(kw)) {
      return { type: 'block', text: clean, ...style };
    }
  }

  // 9. If the line originally had an explicit bullet marker (•, -, *, etc.), treat as bullet, otherwise normal text
  const hadBullet = /^[\s•▪■›–—]/.test(trimmed) || /^-(?!-)\s+/.test(trimmed) || /^\*(?!\*)\s+/.test(trimmed);
  return { type: hadBullet ? 'bullet' : 'text', text: clean };
};

const renderActivityCellHTML = (content, isHeader, isArMode, styleConfig) => {
  if (!content) return '';
  
  // 1. Normalize line breaks and merge orphan continuation lines
  const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cleanedLines = [];

  for (let i = 0; i < rawLines.length; i++) {
    let cur = rawLines[i].trim();

    // Skip stray dots, periods, hyphens on their own lines
    if (/^[.\-•▪■*,;:~]+$/.test(cur)) {
      if (cur === '.' && cleanedLines.length > 0 && !cleanedLines[cleanedLines.length - 1].endsWith('.')) {
        cleanedLines[cleanedLines.length - 1] += '.';
      }
      continue;
    }

    if (!cur) {
      cleanedLines.push('');
      continue;
    }

    // Check if this line is an orphan short token that belongs to the preceding line
    if (cleanedLines.length > 0 && /^(\$[A-Za-z0-9_\\^+\-=*<>]+\$[.,;]?|[A-Za-z][.,;])$/.test(cur)) {
      const prevIdx = cleanedLines.length - 1;
      if (cleanedLines[prevIdx] && !cleanedLines[prevIdx].endsWith('.')) {
        cleanedLines[prevIdx] += ' ' + cur;
        continue;
      }
    }

    // Filter out redundant empty exercise stubs ONLY when immediately followed by the SAME exercise number
    // e.g. "• **Exercice 08 :**" followed by "• Exercice 08 : Étude de fonction..."
    // Never drop distinct consecutive exercises like "Exercice 01 :", "Exercice 02 :", "Exercice 03 :"
    const curClean = cur.replace(/^(\s*(?:[•▪■›–—]|-(?!-)\s+|\*(?!\*)\s+))+/, '').replace(/\*\*/g, '').trim();
    const stubMatch = curClean.match(/^(exercice|تمرين|devoir|contrôle|فرض)\s*(?:n°|nº|num)?\s*(\d+)\s*:?\s*$/i);
    if (stubMatch && i + 1 < rawLines.length) {
      const nextClean = rawLines[i + 1].trim().replace(/^(\s*(?:[•▪■›–—]|-(?!-)\s+|\*(?!\*)\s+))+/, '').replace(/\*\*/g, '').trim();
      const nextMatch = nextClean.match(/^(exercice|تمرين|devoir|contrôle|فرض)\s*(?:n°|nº|num)?\s*(\d+)\b/i);
      if (
        nextMatch &&
        stubMatch[1].toLowerCase() === nextMatch[1].toLowerCase() &&
        Number(stubMatch[2]) === Number(nextMatch[2])
      ) {
        continue;
      }
    }

    cleanedLines.push(rawLines[i]);
  }

  const lines = cleanedLines;
  const gridLineHeight = styleConfig.gridLineHeight || 20;

  let html = `<div class="activities-wrapper" style="display:block;padding:0;">`;

  lines.forEach((raw, idx) => {
    const { type, text, numLabel, color, bg } = getLineStyle(raw, isHeader, idx);

    if (type === 'empty') {
      html += `<div style="height:3px;"></div>`;
      return;
    }

    const isArabic = isArMode || startsWithArabic(text);
    const direction = isArabic ? 'rtl' : 'ltr';
    const align = isArabic ? 'right' : 'left';
    const font = isArabic ? styleConfig.arFont : styleConfig.frFont;

    const commonStyle = `direction:${direction};text-align:${align};font-family:'${font}',sans-serif;margin:0;line-height:${gridLineHeight}px;min-height:${gridLineHeight}px;box-sizing:border-box;color:${styleConfig.colorInk};font-size:${styleConfig.baseFontSize};`;

    if (type === 'chapter') {
      html += `<div style="${commonStyle}font-size:calc(${styleConfig.baseFontSize} * 1.25);font-weight:800;color:${styleConfig.colorChapter};letter-spacing:-0.01em;text-transform:uppercase;border-bottom:1.5px solid rgba(15,23,42,0.15);padding-bottom:1px;margin-bottom:3px;display:block;">${renderLineContent(text, isArabic)}</div>`;
    } 
    else if (type === 'exercise') {
      const borderSide = direction === 'ltr' ? 'border-left' : 'border-right';
      html += `<div style="${commonStyle}font-size:${styleConfig.baseFontSize};font-weight:700;color:${styleConfig.colorExercise};background:rgba(217,119,6,0.06);${borderSide}:3px solid ${styleConfig.colorExercise};border-radius:4px;padding:1px 0.5rem;margin:2px 0;display:block;"><span style="display:inline-block;margin-${direction === 'ltr' ? 'right' : 'left'}:4px;">✏️</span><span>${renderLineContent(text, isArabic)}</span></div>`;
    } 
    else if (type === 'section') {
      const borderSide = direction === 'ltr' ? 'border-left' : 'border-right';
      html += `<div style="${commonStyle}font-size:calc(${styleConfig.baseFontSize} * 1.05);font-weight:700;color:#4f46e5;${borderSide}:2.5px solid #6366f1;padding-left:${direction === 'ltr' ? '0.5rem' : '0'};padding-right:${direction === 'rtl' ? '0.5rem' : '0'};margin:2px 0 1px 0;display:block;">${renderLineContent(text, isArabic)}</div>`;
    }
    else if (type === 'axis') {
      const borderSide = direction === 'ltr' ? 'border-left' : 'border-right';
      html += `<div style="${commonStyle}font-size:calc(${styleConfig.baseFontSize} * 1.1);font-weight:700;color:${styleConfig.colorAxis};${borderSide}:3px solid ${styleConfig.colorAxis};padding-left:${direction === 'ltr' ? '0.55rem' : '0'};padding-right:${direction === 'rtl' ? '0.55rem' : '0'};margin:2px 0;display:block;">${renderLineContent(text, isArabic)}</div>`;
    } 
    else if (type === 'numbered') {
      html += `<div style="${commonStyle}font-size:${styleConfig.baseFontSize};font-weight:500;padding-${direction === 'ltr' ? 'left' : 'right'}:0.4rem;margin:1px 0;display:block;"><span style="font-weight:800;color:#2563eb;display:inline-block;min-width:18px;">${esc(numLabel)}</span> <span>${renderLineContent(text, isArabic)}</span></div>`;
    }
    else if (type === 'formula') {
      html += `<div style="${commonStyle}font-size:${styleConfig.baseFontSize};text-align:center;padding:1px 0;margin:1px 0;display:block;">${renderLineContent(text, isArabic)}</div>`;
    }
    else if (type === 'intro_text') {
      html += `<div style="${commonStyle}font-size:${styleConfig.baseFontSize};font-weight:500;padding-left:${direction === 'ltr' ? '0.35rem' : '0'};padding-right:${direction === 'rtl' ? '0.35rem' : '0'};margin:1px 0;display:block;">${renderLineContent(text, isArabic)}</div>`;
    }
    else if (type === 'block') {
      const borderSide = direction === 'ltr' ? 'border-left' : 'border-right';
      html += `<div style="${commonStyle}font-size:${styleConfig.baseFontSize};font-weight:600;color:${color};background:${bg};${borderSide}:2px solid ${color};border-radius:4px;padding:1px 0.55rem;margin:1px 0;display:block;">${renderLineContent(text, isArabic)}</div>`;
    } 
    else if (type === 'bullet') {
      html += `<div style="${commonStyle}font-size:${styleConfig.baseFontSize};padding-${direction === 'ltr' ? 'left' : 'right'}:0.4rem;margin:1px 0;display:block;"><span style="color:#64748b;font-size:0.5rem;display:inline-block;vertical-align:middle;margin-${direction === 'ltr' ? 'right' : 'left'}:4px;">■</span> <span>${renderLineContent(text, isArabic)}</span></div>`;
    }
    else {
      // Default clean paragraph
      html += `<div style="${commonStyle}margin:1px 0;display:block;">${renderLineContent(text, isArabic)}</div>`;
    }
  });

  html += `</div>`;
  return html;
};

// Splits a long multi-exercise session into compact logical chunks
// to prevent massive whitespace gaps before page breaks in print
const chunkActivityContent = (content) => {
  if (!content || !content.trim()) return [''];
  const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const cleaned = [];
  let prevWasEmpty = false;
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!prevWasEmpty) cleaned.push('');
      prevWasEmpty = true;
    } else {
      cleaned.push(line);
      prevWasEmpty = false;
    }
  }

  const chunks = [];
  let curChunk = [];

  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i];
    const trimmed = line.trim();
    const plain = trimmed.replace(/[*#_~`]/g, '').trim();

    const isExerciseHeader = /^(?:•|-)?\s*(?:exercice|تمرين|devoir|contrôle|فرض)\s*n?°?\s*\d*/i.test(plain);
    const isSectionHeader = /^(?:•|-)?\s*(?:série|serie|partie|châpitre|chapitre|axe|محور|سلسلة|جزء)\s*[:\d\-]/i.test(plain);
    const isChapterHeader = /^={2,}\s*(.*?)\s*={2,}$/.test(trimmed);
    const isQuestionLine = /^\d+[.)]/.test(plain) || /^[a-zA-Z][.)]/.test(plain);

    // If chunk already has content and we hit an exercise or section header:
    const isHeaderBreak = curChunk.length >= 2 && (isExerciseHeader || isSectionHeader || (isChapterHeader && i > 0));
    // If chunk has >= 5 lines and we hit a question line, bullet or empty line:
    const isSizeBreak = curChunk.length >= 5 && (isQuestionLine || trimmed.startsWith('•') || !trimmed);

    if (curChunk.length > 0 && (isHeaderBreak || isSizeBreak)) {
      chunks.push(curChunk.join('\n'));
      curChunk = [];
    }

    curChunk.push(line);
  }

  if (curChunk.length > 0) {
    chunks.push(curChunk.join('\n'));
  }

  return chunks.length > 0 ? chunks : [content];
};

const getTranslatedComponent = (comp, isAr) => {
  if (!comp) return '';
  const map = {
    'Cours': isAr ? 'درس' : 'Cours',
    'Exercices': isAr ? 'تمارين' : 'Exercices',
    'Contrôle': isAr ? 'فرض' : 'Contrôle',
    'Activité': isAr ? 'نشاط' : 'Activité'
  };
  return comp.split(/\s*\+\s*/).map(c => map[c] || c).join(isAr ? ' + ' : ' + ');
};

const getAcademicYear = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem('profAcademicYear') || localStorage.getItem('academicYear');
    if (stored && stored.trim()) return stored.trim();
  }
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

export const generateLogbookHTML = (selectedClass, entries, profName, styleConfig = {}) => {
  const isArMode = styleConfig.isArMode !== undefined ? Boolean(styleConfig.isArMode) : Boolean(
    selectedClass?.language === 'ar' ||
    selectedClass?.lang === 'ar' ||
    selectedClass?.option === 'ar' ||
    selectedClass?.isArabic ||
    selectedClass?.isAr ||
    (selectedClass?.name && (selectedClass.name.includes('عرب') || selectedClass.name.includes('عام') || selectedClass.name.toLowerCase().includes('(ar)'))) ||
    (selectedClass?.level && (selectedClass.level.includes('arts') || selectedClass.level.includes('lettres') || selectedClass.level.includes('آداب')))
  );
  const academicYear = getAcademicYear();
  const dir = isArMode ? 'rtl' : 'ltr';
  const alignment = isArMode ? 'right' : 'left';
  const logoText = "L'CONQ";
  const titleText = isArMode ? "دفتر النصوص الإلكتروني" : "Cahier de Textes Électronique";
  
  const profSchool = (typeof window !== 'undefined' && window.localStorage) ? (localStorage.getItem('profSchool') || '') : '';
  const profDirection = (typeof window !== 'undefined' && window.localStorage) ? (localStorage.getItem('profDirection') || '') : '';
  const profAcademy = (typeof window !== 'undefined' && window.localStorage) ? (localStorage.getItem('profAcademy') || '') : '';
  const profSOM = (typeof window !== 'undefined' && window.localStorage) ? (localStorage.getItem('profSOM') || '') : '';
  const profSubject = (typeof window !== 'undefined' && window.localStorage) ? (localStorage.getItem('profSubject') || '') : '';
  
  const arFont = styleConfig.arFont || 'Cairo';
  const frFont = styleConfig.frFont || 'Outfit';
  const mainFont = isArMode ? arFont : frFont;
  
  const gridLineHeight = styleConfig.gridLineHeight || 20;
  const showHoraire = styleConfig.showHoraire !== false;
  const showComposant = styleConfig.showComposant !== false;
  const initialColSpan = 3 + (showHoraire ? 1 : 0) + (showComposant ? 1 : 0);

  // Build rows HTML (automatically chunk multi-exercise/long sessions into compact sub-rows to prevent whitespace gaps in print)
  const rowsHtml = entries.flatMap(e => {
    const isHolidayOrAbsence = e.isHolidayEntry || e.isAbsenceEntry;
    
    // Determine cell borders and background for grid
    const cellClass = isHolidayOrAbsence ? 'normal-cell' : 'seyes-grid-cell';
    const signatureText = isHolidayOrAbsence ? '—' : (isArMode ? 'موقّع' : 'Signé');
    const signatureStyle = isHolidayOrAbsence ? 'color:#94a3b8;font-style:italic;' : 'color:#10b981;font-weight:bold;font-size:0.75rem;';

    const componentText = getTranslatedComponent(e.component, isArMode);
    const dateText = e.displayDate 
      ? (e.displayDate.includes('من') || e.displayDate.includes('Du') 
          ? esc(e.displayDate) 
          : new Date(e.date).toLocaleDateString('fr-FR'))
      : (e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '');

    if (isHolidayOrAbsence) {
      return `
        <tr>
          <td style="width:11%;text-align:center;font-weight:800;color:#0f172a;border:1px solid #cbd5e1;padding:6px 4px;font-size:0.8rem;vertical-align:middle;">
            ${dateText}
          </td>
          <td class="col-horaire" style="width:11%;text-align:center;font-weight:600;color:#475569;border:1px solid #cbd5e1;padding:6px 4px;font-size:0.8rem;vertical-align:middle;">
            ${esc(e.time || '—')}
          </td>
          <td class="col-composant" style="width:12%;text-align:center;font-weight:700;color:#1e3a8a;border:1px solid #cbd5e1;padding:6px 4px;font-size:0.82rem;vertical-align:middle;">
            <span class="comp-badge holiday">${esc(componentText)}</span>
          </td>
          <td class="${cellClass} col-activity" style="width:54%;border:1px solid #cbd5e1;vertical-align:middle;position:relative;text-align:${alignment};padding:6px 10px;">
            <div class="holiday-absence-banner ${e.isHolidayEntry ? 'holiday' : 'absence'}">${esc(e.customContent.replace(/===/g, '').trim())}</div>
          </td>
          <td style="width:12%;text-align:center;border:1px solid #cbd5e1;vertical-align:middle;padding:6px 4px;${signatureStyle}">
            ${signatureText}
          </td>
        </tr>
      `;
    }

    const chunks = chunkActivityContent(e.customContent);
    return chunks.map((chunk, chunkIdx) => {
      const isFirst = chunkIdx === 0;
      const isLast = chunkIdx === chunks.length - 1;
      const rowClasses = [
        isFirst ? '' : 'logbook-subrow',
        isLast ? '' : 'logbook-has-next'
      ].filter(Boolean).join(' ');

      const cellDateHtml = isFirst ? dateText : '';
      const cellTimeHtml = isFirst ? esc(e.time || '—') : '';
      const cellCompHtml = isFirst
        ? `<span class="comp-badge ${e.component && e.component.toLowerCase().includes('contrôle') ? 'contrôle' : ''}">${esc(componentText)}</span>`
        : '';
      const cellSigHtml = isFirst ? signatureText : '';

      return `
        <tr class="${rowClasses}">
          <td style="width:11%;text-align:center;font-weight:800;color:#0f172a;padding:6px 4px;font-size:0.8rem;vertical-align:top;">
            ${cellDateHtml}
          </td>
          <td class="col-horaire" style="width:11%;text-align:center;font-weight:600;color:#475569;padding:6px 4px;font-size:0.8rem;vertical-align:top;">
            ${cellTimeHtml}
          </td>
          <td class="col-composant" style="width:12%;text-align:center;font-weight:700;color:#1e3a8a;padding:6px 4px;font-size:0.82rem;vertical-align:top;">
            ${cellCompHtml}
          </td>
          <td class="${cellClass} col-activity" style="width:54%;vertical-align:top;position:relative;text-align:${alignment};padding:5px 10px;">
            ${renderActivityCellHTML(chunk, isFirst ? e.isHeaderSéance : false, isArMode, styleConfig)}
          </td>
          <td style="width:12%;text-align:center;vertical-align:top;padding:6px 4px;${signatureStyle}">
            ${cellSigHtml}
          </td>
        </tr>
      `;
    });
  }).join('');

  return `
<!DOCTYPE html>
<html lang="${isArMode ? 'ar' : 'fr'}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <title>${esc(selectedClass.name)} - ${esc(titleText)}</title>
  
  <!-- Modern fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400&family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet">
  
  <!-- KaTeX CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">

  <style>
    /* Optional column visibility toggles (Horaire & Composant) */
    body.hide-horaire .col-horaire { display: none !important; }
    body.hide-composant .col-composant { display: none !important; }
    body.hide-horaire:not(.hide-composant) .col-activity { width: 65% !important; }
    body.hide-composant:not(.hide-horaire) .col-activity { width: 66% !important; }
    body.hide-horaire.hide-composant .col-activity { width: 77% !important; }

    .col-toggle-btn {
      background: rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.85);
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 99px;
      padding: 5px 12px;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }
    .col-toggle-btn.active {
      background: rgba(16, 185, 129, 0.28);
      border-color: rgba(52, 211, 153, 0.65);
      color: #ffffff;
    }
    .col-toggle-btn:not(.active) {
      background: rgba(239, 68, 68, 0.22);
      border-color: rgba(248, 113, 113, 0.5);
      color: #fecaca;
      text-decoration: line-through;
    }

    /* Base resets */
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: '${mainFont}', 'Cairo', 'Outfit', sans-serif;
      font-size: 13px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .print-page-wrapper {
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
    }

    /* ── Screen view: continuous flowing document, no A4 page boxes ── */
    @media screen {
      html {
        background: #d1d5db;
      }
      body {
        background: #d1d5db;
        padding: 24px 0 48px 0;
      }
      .print-page-wrapper {
        background: #ffffff;
        box-shadow: 0 4px 40px rgba(0,0,0,0.22);
        border-radius: 6px;
        padding: 22mm 16mm 28mm 16mm;
        /* Fully disable all page-break behaviour on screen */
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      /* Kill every page-break trigger on screen so no white gaps appear */
      .print-page-wrapper *,
      .logbook-table,
      .logbook-table tr,
      .logbook-table td,
      .logbook-table th {
        break-inside: auto !important;
        page-break-inside: auto !important;
        break-before: auto !important;
        page-break-before: auto !important;
        break-after: auto !important;
        page-break-after: auto !important;
      }
    }

    /* ── Print-only: A4 page rules and margins ── */
    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm 10mm 12mm 10mm;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      #printActionBar {
        display: none !important;
      }
      .print-page-wrapper {
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
      }
      .logbook-table {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      .logbook-table tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .logbook-subrow {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .logbook-table td {
        vertical-align: top !important;
      }
    }



    /* =========================================================================
       PREMIUM OFFICIAL HEADER (رأس وثيقة رسمية رفيع المستوى)
       ========================================================================= */
    .header-top-container {
      border-top: 4px solid #1e3a8a;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
      border-radius: 12px;
      padding: 14px 18px 12px;
      border: 1px solid #e2e8f0;
      margin-bottom: 14px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
    }

    .official-header {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Cairo', 'Outfit', sans-serif;
      direction: ${dir};
    }
    
    .official-header td {
      border: none !important;
      padding: 0 !important;
      vertical-align: middle !important;
    }

    /* Ministry block */
    .header-dept-block {
      width: 32%;
      font-size: 8.5px;
      line-height: 1.45;
      color: #334155;
      text-align: ${isArMode ? 'right' : 'left'};
      ${isArMode ? 'border-right: 3.5px solid #3b82f6; padding-right: 12px !important;' : 'border-left: 3.5px solid #3b82f6; padding-left: 12px !important;'}
    }
    .header-dept-block span {
      display: block;
    }
    .kingdom-title {
      font-size: 10px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 2px;
    }
    .ministry-title {
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 2px;
    }
    .academy-title {
      font-weight: 600;
      color: #475569;
    }
    .direction-title {
      font-weight: 600;
      color: #475569;
    }
    .school-title {
      font-weight: 800;
      color: #1e3a8a;
      margin-top: 2px;
    }

    /* Middle Emblem & Document Title */
    .header-center-block {
      width: 36%;
      text-align: center;
      padding: 0 8px;
    }
    .brand-logo-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
    }
    .header-emblem-text {
      font-size: 1.9rem;
      font-weight: 950;
      line-height: 1;
      letter-spacing: -0.04em;
      color: #1e1b4b;
      font-family: 'Outfit', sans-serif !important;
    }
    .brand-subtext {
      font-size: 7px;
      font-weight: 900;
      letter-spacing: 0.22em;
      color: #6366f1;
      text-transform: uppercase;
      margin-top: 1px;
    }
    .header-document-title {
      font-size: 11.5px;
      font-weight: 900;
      color: #ffffff;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      padding: 6px 16px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      display: inline-block;
      white-space: nowrap !important;
      box-shadow: 0 3px 8px rgba(15, 23, 42, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .header-document-sub {
      font-size: 7.5px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 4px;
    }

    /* Coordinates details block */
    .header-coords-block {
      width: 32%;
      font-size: 9px;
      font-weight: 700;
      text-align: ${isArMode ? 'left' : 'right'};
      line-height: 1.6;
      color: #334155;
    }
    .coord-item {
      display: block;
      margin-bottom: 3px;
    }
    .coord-badge {
      font-weight: 900;
      color: #1e40af;
      background: #dbeafe;
      border: 1px solid #bfdbfe;
      padding: 1px 8px;
      border-radius: 5px;
      font-size: 9.5px;
    }
    .coord-value {
      font-weight: 800;
      color: #0f172a;
    }
    .coord-system {
      font-weight: 900;
      color: #059669;
      background: #d1fae5;
      padding: 1px 7px;
      border-radius: 4px;
      font-size: 8.5px;
    }

    /* Metadata Badge Grid under header */
    .coords-badge-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 8px;
      margin-bottom: 12px;
      font-size: 11px;
      direction: ${dir};
    }
    .coords-badge-cell {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      padding: 5px 8px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }
    .coords-badge-label {
      font-size: 8px;
      color: #64748b;
      font-weight: 800;
      display: block;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }
    .coords-badge-val {
      font-size: 11.5px;
      font-weight: 900;
      color: #0f172a;
    }

    /* =========================================================================
       TABLE STYLING
       ========================================================================= */
    .logbook-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #0f172a !important;
      font-family: inherit;
    }

    .logbook-table th {
      border: 1.5px solid #0f172a !important;
      background: #0f172a !important;
      color: #ffffff !important;
      padding: 10px 8px !important;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      text-align: center;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* Repeating print page header row inside thead */
    .print-page-header-row th {
      background: #f8fafc !important;
      color: #0f172a !important;
      border-bottom: 1.5px solid #0f172a !important;
      padding: 10px 16px !important;
    }

    .logbook-table td {
      border: 1px solid #cbd5e1 !important;
      color: #0f172a;
      font-size: 12px;
    }

    /* Seamless continuation chunks within the SAME session (no cut lines, no "suite" repeats) */
    .logbook-table tr.logbook-has-next td {
      border-bottom: none !important;
      padding-bottom: 0 !important;
    }
    .logbook-table tr.logbook-subrow td {
      border-top: none !important;
      padding-top: 0 !important;
    }

    .logbook-table tr {
      /* page-break rules moved to @media print only */
    }

    .comp-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.15);
      color: #1e3a8a;
      font-weight: 800;
    }
    .comp-badge.contrôle {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.15);
      color: #b91c1c;
    }

    /* Seyes-like squared notebook lines background */
    .seyes-grid-cell {
      background-color: #ffffff;
      background-image: 
        linear-gradient(rgba(186, 230, 253, 0.5) 1px, transparent 1px);
      background-size: 100% ${gridLineHeight}px;
      padding: 5px 10px !important;
      line-height: ${gridLineHeight}px !important;
      vertical-align: top;
      position: relative;
    }
    .seyes-grid-cell * {
      background: transparent !important;
    }
    .seyes-grid-cell .katex {
      font-size: 1.04em !important;
      line-height: inherit !important;
      font-weight: inherit !important;
      white-space: nowrap !important;
    }
    .seyes-grid-cell .katex-html {
      vertical-align: -0.04em !important;
    }
    .seyes-grid-cell .inline-math-container {
      display: inline !important;
      vertical-align: baseline !important;
      white-space: nowrap !important;
    }
    .seyes-grid-cell .katex-display {
      margin: 4px 0 !important;
      display: block !important;
      text-align: center !important;
    }
    .seyes-grid-cell .katex-display .katex {
      display: inline-block !important;
      font-size: 1.08em !important;
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
    
    .normal-cell {
      padding: 12px 14px !important;
      vertical-align: middle;
      background-color: #fafbfc !important;
    }

    /* Holiday & Absence banner blocks */
    .holiday-absence-banner {
      width: 100%;
      text-align: center;
      font-weight: 800;
      font-size: 11px;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px dashed;
      line-height: 1.5;
    }
    .holiday-absence-banner.holiday {
      color: #15803d;
      background: rgba(22, 163, 74, 0.05);
      border-color: rgba(22, 163, 74, 0.25);
    }
    .holiday-absence-banner.absence {
      color: #b91c1c;
      background: rgba(220, 38, 38, 0.05);
      border-color: rgba(220, 38, 38, 0.25);
    }

    /* =========================================================================
       SIGNATURE BLOCKS AT BOTTOM
       ========================================================================= */
    .signatures-block {
      margin-top: 35px;
      width: 100%;
      border-spacing: 12px 0;
      border-collapse: separate;
    }
    
    .signatures-block td {
      border: 1px dashed #cbd5e1 !important;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      background: #f8fafc !important;
      width: 33%;
      vertical-align: top;
    }
    
    .signature-title {
      font-weight: 800;
      font-size: 11px;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .signature-teacher-name {
      font-size: 11px;
      color: #1e3a8a;
      font-weight: 800;
      margin-top: 15px;
      margin-bottom: 5px;
    }
    .signature-dots {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 45px;
    }

    .fiche-footer {
      margin-top: 40px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      text-align: center;
      font-size: 8px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }


  </style>
</head>
<body class="${!showHoraire ? 'hide-horaire' : ''} ${!showComposant ? 'hide-composant' : ''}">


  <div class="print-page-wrapper">
    
    <!-- ── OFFICIAL TOP HEADER CONTAINER (First Page Only) ── -->
    <div class="header-top-container">
      <table class="official-header">
        <tr>
          <!-- Left: Ministry & Institution -->
          <td class="header-dept-block">
            ${isArMode ? `
              <span class="kingdom-title">المملكة المغربية</span>
              <span class="ministry-title">وزارة التربية الوطنية والتعليم الأولي والرياضة</span>
              <span class="academy-title">${esc(profAcademy || 'الأكاديمية الجهوية للتربية والتكوين')}</span>
              ${profDirection ? `<span class="direction-title">${esc(profDirection)}</span>` : ''}
              <span class="school-title">${esc(profSchool || 'مؤسسة L\'CONQ للتميز')}</span>
            ` : `
              <span class="kingdom-title">Royaume du Maroc</span>
              <span class="ministry-title">Ministère de l'Éducation Nationale</span>
              <span class="academy-title">${esc(profAcademy || "Académie Régionale de l'Éducation et de la Formation")}</span>
              ${profDirection ? `<span class="direction-title">${esc(profDirection)}</span>` : ''}
              <span class="school-title">${esc(profSchool || "Établissement L'CONQ d'Excellence")}</span>
            `}
          </td>
          
          <!-- Center Emblem / Logo & Title Banner -->
          <td class="header-center-block">
            <div class="brand-logo-wrap">
              <span class="header-emblem-text">${logoText}</span>
              <span class="brand-subtext">EXCELLENCE ACADÉMIQUE</span>
            </div>
            <div class="header-document-title">
              ${isArMode ? 'دفتر النصوص الإلكتروني' : 'CAHIER DE TEXTES ÉLECTRONIQUE'}
            </div>
            <div class="header-document-sub">
              ${isArMode ? 'وثيقة رسمية للتتبع التربوي' : 'DOCUMENT OFFICIEL DE SUIVI PÉDAGOGIQUE'}
            </div>
          </td>
          
          <!-- Right: Print Metadata Coordinates -->
          <td class="header-coords-block">
            <span class="coord-item">
              ${isArMode ? 'السنة الدراسية: ' : 'Année Scolaire : '}
              <span class="coord-badge">${academicYear}</span>
            </span>
            <span class="coord-item">
              ${isArMode ? 'تاريخ الاستخراج: ' : 'Date d\'impression : '}
              <span class="coord-value">${new Date().toLocaleDateString('fr-FR')}</span>
            </span>
            <span class="coord-item">
              ${isArMode ? 'البرنامج المستعمل: ' : 'Généré via : '}
              <span class="coord-system">L'CONQ OS 2026</span>
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- ── BADGES GRID COORDINATES ── -->
    <div class="coords-badge-grid">
      <div class="coords-badge-cell">
        <span class="coords-badge-label">${isArMode ? 'المستوى' : 'Niveau'}</span>
        <span class="coords-badge-val">${esc(getLevelDisplayName(selectedClass.level, isArMode))}</span>
      </div>
      <div class="coords-badge-cell">
        <span class="coords-badge-label">${isArMode ? 'القسم / الفوج' : 'Classe / Groupe'}</span>
        <span class="coords-badge-val" style="color:#4f46e5;">${esc(selectedClass.name)}</span>
      </div>
      <div class="coords-badge-cell">
        <span class="coords-badge-label">${isArMode ? 'المادة الدراسية' : 'Matière'}</span>
        <span class="coords-badge-val" style="color:#059669;">${esc(selectedClass.subject || (isArMode ? 'الرياضيات' : 'Mathématiques'))}</span>
      </div>
      <div class="coords-badge-cell">
        <span class="coords-badge-label">${isArMode ? 'الأستاذ المؤطر' : 'Enseignant'}</span>
        <span class="coords-badge-val">${esc(profName || 'Prof. L\'CONQ')}${profSOM ? ` (SOM: ${esc(profSOM)})` : ''}</span>
      </div>
    </div>

    <!-- ── MAIN LOGBOOK TIMELINE TABLE ── -->
    <table class="logbook-table">
      <thead>
        
        <!-- Print-only page header repeating row inside table -->
        <tr class="print-page-header-row">
          <th id="printHeaderTh" colspan="${initialColSpan}">
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%;font-family:'Outfit','Cairo',sans-serif;direction:${dir};">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="color:#ffffff;background:#4f46e5;font-weight:900;font-size:0.8rem;padding:2px 6px;border-radius:4px;">${logoText}</span>
                <span style="color:#334155;font-size:0.75rem;font-weight:700;margin-left:5px;">| ${isArMode ? 'دفتر النصوص المنجزة' : 'Cahier de Textes'}</span>
              </div>
              <div style="display:flex;gap:20px;font-size:0.78rem;font-weight:800;color:#0f172a;">
                <div>
                  <span style="color:#64748b;font-weight:700;">${isArMode ? 'القسم:' : 'Classe :'}</span>
                  <span style="${isArMode ? 'margin-right:4px;' : 'margin-left:4px;'}color:#1e3a8a;background:rgba(30,58,138,0.06);padding:1px 6px;border-radius:4px;">${esc(selectedClass.name)}</span>
                </div>
                <div>
                  <span style="color:#64748b;font-weight:700;">${isArMode ? 'المادة:' : 'Matière :'}</span>
                  <span style="${isArMode ? 'margin-right:4px;' : 'margin-left:4px;'}color:#10b981;background:rgba(16,185,129,0.06);padding:1px 6px;border-radius:4px;">${esc(selectedClass.subject || (isArMode ? 'الرياضيات' : 'Mathématiques'))}</span>
                </div>
              </div>
            </div>
          </th>
        </tr>

        <!-- Column Headers -->
        <tr>
          <th style="width:11%;">${isArMode ? 'التاريخ' : 'Date'}</th>
          <th class="col-horaire" style="width:11%;">${isArMode ? 'التوقيت' : 'Horaire'}</th>
          <th class="col-composant" style="width:12%;">${isArMode ? 'المكون' : 'Composant'}</th>
          <th class="col-activity" style="width:54%;text-align:${alignment};">${isArMode ? 'طبيعة الأنشطة والدروس المنجزة تفصيلاً' : 'Nature des activités réalisées'}</th>
          <th style="width:12%;">${isArMode ? 'توقيع المراقبة' : 'Signature'}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- ── SIGNATURES BLOCK ── -->
    <table class="signatures-block">
      <tr>
        <td>
          <div class="signature-title">${isArMode ? 'توقيع المفتش التربوي' : 'Signature de l\'Inspecteur'}</div>
          <div class="signature-dots">..........................................</div>
        </td>
        <td>
          <div class="signature-title">${isArMode ? 'توقيع رئيس المؤسسة' : 'Signature du Directeur'}</div>
          <div class="signature-dots">..........................................</div>
        </td>
        <td>
          <div class="signature-title">${isArMode ? 'توقيع الأستاذ المؤطر' : 'Signature de l\'Enseignant'}</div>
          <div class="signature-teacher-name">${esc(profName || 'Professeur')}</div>
          <div class="signature-dots" style="margin-top:10px;">..........................................</div>
        </td>
      </tr>
    </table>

    <!-- ── FOOTER CORPORATE BRAND ── -->
    <div class="fiche-footer">
      © ${new Date().getFullYear()} ${logoText} • SYSTEM OF ACADEMIC EXCELLENCE • ALL RIGHTS RESERVED
    </div>

  </div>

  <div id="printActionBar" style="
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 99999;
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 24px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    font-family: 'Outfit', 'Cairo', sans-serif;
    gap: 12px;
    flex-wrap: wrap;
  ">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:1.3rem;font-weight:950;letter-spacing:-0.04em;color:#fff;">L'CONQ</span>
      <span style="font-size:0.8rem;color:rgba(255,255,255,0.7);font-weight:600;">
        ${isArMode ? '| معاينة دفتر النصوص — اضغط "طباعة" عند الاستعداد' : '| Aperçu du Cahier de Textes — Cliquez sur "Imprimer" quand vous êtes prêt'}
      </span>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <button id="btnToggleHoraire" class="col-toggle-btn ${showHoraire ? 'active' : ''}" onclick="toggleLogbookCol('horaire')" title="${isArMode ? 'إظهار أو إخفاء عمود التوقيت' : 'Afficher / Masquer la colonne Horaire'}">
        <span>${showHoraire ? '✓' : '✕'}</span>
        <span>${isArMode ? 'التوقيت (Horaire)' : 'Horaire'}</span>
      </button>
      <button id="btnToggleComposant" class="col-toggle-btn ${showComposant ? 'active' : ''}" onclick="toggleLogbookCol('composant')" title="${isArMode ? 'إظهار أو إخفاء عمود المكون' : 'Afficher / Masquer la colonne Composant'}">
        <span>${showComposant ? '✓' : '✕'}</span>
        <span>${isArMode ? 'المكون (Composant)' : 'Composant'}</span>
      </button>
      <button onclick="window.print()" style="
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 8px 22px;
        font-size: 0.88rem;
        font-weight: 800;
        cursor: pointer;
        letter-spacing: 0.04em;
        box-shadow: 0 4px 14px rgba(99,102,241,0.4);
        transition: opacity 0.2s;
      " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
        🖨️ ${isArMode ? 'طباعة / تحميل PDF' : 'Imprimer / PDF'}
      </button>
      <button onclick="window.close()" style="
        background: rgba(255,255,255,0.12);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s;
      " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.12)'">
        ✕ ${isArMode ? 'إغلاق' : 'Fermer'}
      </button>
    </div>
  </div>

  <script>
    // Add top padding to body to avoid content hiding behind the action bar
    document.body.style.paddingTop = '60px';
    // Live toggle for Horaire & Composant columns
    function toggleLogbookCol(col) {
      const cls = col === 'horaire' ? 'hide-horaire' : 'hide-composant';
      const hidden = document.body.classList.toggle(cls);
      const btn = document.getElementById(col === 'horaire' ? 'btnToggleHoraire' : 'btnToggleComposant');
      if (btn) {
        btn.classList.toggle('active', !hidden);
        const iconSpan = btn.querySelector('span');
        if (iconSpan) iconSpan.textContent = hidden ? '✕' : '✓';
      }
      const th = document.getElementById('printHeaderTh');
      if (th) {
        const visibleCount = 3 + (document.body.classList.contains('hide-horaire') ? 0 : 1) + (document.body.classList.contains('hide-composant') ? 0 : 1);
        th.setAttribute('colspan', String(visibleCount));
      }
    }
    // Hide action bar during actual print
    const bar = document.getElementById('printActionBar');
    window.addEventListener('beforeprint', () => { if (bar) bar.style.display = 'none'; document.body.style.paddingTop = '0'; });
    window.addEventListener('afterprint', () => { if (bar) bar.style.display = 'flex'; document.body.style.paddingTop = '60px'; });
  </script>
</body>
</html>
  `;
};

export const openLogbookPrintWindow = (selectedClass, entries, profName, styleConfig = {}) => {
  // Merge consecutive same-day sessions (double hours) into single 2-hour rows before export
  const mergedEntries = mergeConsecutiveEntries(entries || []);
  const html = generateLogbookHTML(selectedClass, mergedEntries, profName, styleConfig);
  const title = `Cahier_de_textes_${selectedClass.name.replace(/\s+/g, '_')}`;

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;

  if (isMobile) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=960,height=720,scrollbars=yes');
  if (!win) {
    URL.revokeObjectURL(url);
    alert('Veuillez autoriser les popups pour ce site.');
    return;
  }
  win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
};
