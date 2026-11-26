/**
 * nationalExamHelpers.js — L'CONQ / GAMACO
 * Domain detection, normalization, metadata extraction and sorting for Moroccan National Exams.
 */

import {
  getSectionImageEntries,
  getImageItemUrl,
  getReferencedFigIds,
} from './figureShortcodes.js';

export const NATIONAL_EXAM_DOMAINS = [
  { id: 'all',          labelAr: 'جميع المجالات',             labelFr: 'Tous les domaines',      icon: '📚', color: '#005086' },
  { id: 'analysis',     labelAr: 'دراسة الدوال وحساب التكامل', labelFr: 'Analyse & Intégrales',    icon: '📈', color: '#2563eb' },
  { id: 'suites',       labelAr: 'المتتاليات العددية',         labelFr: 'Suites Numériques',      icon: '🔢', color: '#0891b2' },
  { id: 'complexes',    labelAr: 'الأعداد العقدية',           labelFr: 'Nombres Complexes',      icon: '🌐', color: '#7c3aed' },
  { id: 'probabilites', labelAr: 'حساب الاحتمالات',          labelFr: 'Calcul des Probabilités',icon: '🎲', color: '#059669' },
  { id: 'geometrie',    labelAr: 'الهندسة الفضائية',          labelFr: "Géométrie dans l'Espace",icon: '📐', color: '#d97706' },
  { id: 'arithmetique', labelAr: 'الحسابيات (علوم رياضية)',    labelFr: 'Arithmétique (SM)',      icon: '➗', color: '#dc2626' },
  { id: 'structures',   labelAr: 'البنيات الجبرية (علوم رياضية)', labelFr: 'Structures Algébriques', icon: '🏛️', color: '#4f46e5' },
];

/**
 * Detect the mathematical domain of an exercise section from its title and content.
 */
export function detectExerciseDomain(section) {
  if (!section) return 'analysis';

  const title = (section.title || section.name || '').toLowerCase();
  const content = (section.content || section.description || '').toLowerCase();
  const itemsText = Array.isArray(section.items)
    ? section.items.map(it => (typeof it === 'string' ? it : (it?.text || '')).toLowerCase()).join(' ')
    : '';
  const text = `${title} ${content} ${itemsText}`;

  // 1. Structures algébriques (SM)
  if (/structure|groupe|anneau|corps|loi de composition|بنيات|زمرة|حلقة|جسم|قانون تركيب/i.test(text)) {
    return 'structures';
  }

  // 2. Arithmétique (SM)
  if (/arithm[ée]tique|congruence|pgcd|ppcm|premier|fermat|b[ée]zout|gauss|حسابيات|موافقات|أولي/i.test(text)) {
    return 'arithmetique';
  }

  // 3. Géométrie dans l'espace
  if (/g[ée]om[ée]trie dans l'espace|sph[èe]re|produit scalaire|produit vectoriel|plan\s*\(p\)|rep[èe]re orthonorm[ée]|فلكة|جداء سلمي|جداء متجهي|مستوى|هندسة فضائية/i.test(text)) {
    return 'geometrie';
  }

  // 4. Probabilités
  if (/probabilit[ée]|urne|boule|variable al[ée]atoire|tirage|esp[ée]rance|احتمال|صندوق|كرات|متغير عشوائي|سحب/i.test(text)) {
    return 'probabilites';
  }

  // 5. Nombres complexes
  if (/complexe|forme trigonom[ée]trique|forme exponentielle|rotation|translation|homoth[ée]tie|affixe|module|argument|عقدية|شكل مثلثي|إزاحة|دوران|تحاك|لحق|معيار/i.test(text)) {
    return 'complexes';
  }

  // 6. Suites numériques
  if (/suite|u_n|v_n|w_n|r[ée]currence|convergente|arithm[ée]tique|g[ée]om[ée]trique|متتالية|ترجع|متقاربة/i.test(text)) {
    return 'suites';
  }

  // 7. Analyse / Fonctions (Default or detected)
  return 'analysis';
}

/**
 * Extract domains present across all sections of an exam.
 */
export function getExamDomains(exam) {
  const sections = exam.content?.sections || exam.sections || exam.items || [];
  const domainSet = new Set();
  sections.forEach(sec => {
    domainSet.add(detectExerciseDomain(sec));
  });
  return Array.from(domainSet);
}

/**
 * Normalize and extract metadata from a national exam document.
 */
export function normalizeNationalExam(exam) {
  if (!exam) return null;

  const content = exam.content || {};
  const header = content.header || exam.header || {};
  const rawMeta = content.national_exam_meta || header.national_exam_meta || exam.national_exam_meta || {};

  const rawTitle = exam.title || header.fiche_title || '';

  // Extract Year
  let year = rawMeta.year || '';
  if (!year) {
    const yMatch = rawTitle.match(/\b(20[0-2][0-9]|199[0-9])\b/);
    year = yMatch ? yMatch[1] : (exam.created_at ? new Date(exam.created_at).getFullYear().toString() : '2026');
  }

  // Extract Session (Normale vs Rattrapage)
  let session = rawMeta.session || '';
  const isRattrapage = /rattrapage|استدراك/i.test(rawTitle) || /rattrapage|استدراك/i.test(session);
  if (!session) {
    session = isRattrapage ? `الدورة الاستدراكية ${year}` : `الدورة العادية ${year}`;
  }
  const sessionFr = isRattrapage ? `Session de Rattrapage ${year}` : `Session Normale ${year}`;
  const sessionShortFr = isRattrapage ? 'Rattrapage' : 'Session Normale';

  // Extract Branch / Filière
  const rawBranchSource = `${rawMeta.branch || ''} ${header.level || ''} ${exam.level || ''} ${rawTitle}`;
  let branchKey = 'pc_svt';
  if (/sciences?\s*math|علوم\s*رياضية|2bac_sm|\bsm\b/i.test(rawBranchSource)) {
    branchKey = 'sm';
  } else if (/techno|ste|stm|علوم\s*وتكنولوجيات/i.test(rawBranchSource)) {
    branchKey = 'tech';
  } else if (/[ée]co|gestion|اقتصاد/i.test(rawBranchSource)) {
    branchKey = 'eco';
  }

  let branch = rawMeta.branch || header.level || exam.level || '';
  if (!branch || branch === '2bac' || branch === 'national' || branch === '2bac_pc_svt' || branch === '2bac_sm') {
    if (branchKey === 'sm') {
      branch = 'شعبة العلوم الرياضية (أ) و (ب) خيار فرنسية';
    } else if (branchKey === 'tech') {
      branch = 'شعبة العلوم والتكنولوجيات (STE / STM)';
    } else if (branchKey === 'eco') {
      branch = 'شعبة العلوم الاقتصادية والتدبير';
    } else {
      branch = 'مسلك العلوم الفيزيائية ومسلك علوم الحياة والأرض (خيار فرنسية)';
    }
  }

  const branchFrMap = {
    sm: 'Sciences Mathématiques (A & B) — BIOF',
    tech: 'Sciences et Technologies (STE / STM)',
    eco: 'Sciences Économiques et Gestion',
    pc_svt: 'Sciences Physiques & SVT — BIOF',
  };
  const branchFr = /[\u0600-\u06FF]/.test(branch) || !rawMeta.branch || rawMeta.branch === '2bac_pc_svt' || rawMeta.branch === '2bac_sm'
    ? branchFrMap[branchKey]
    : branch;

  const shortBranchFrMap = {
    sm: 'Sciences Maths A & B',
    tech: 'STE / STM',
    eco: 'Éco & Gestion',
    pc_svt: 'PC / SVT',
  };
  const titleHasArabic = /[\u0600-\u06FF]/.test(rawTitle);
  const titleFr = (!rawTitle || titleHasArabic)
    ? `Examen National ${year} — ${sessionShortFr} (${shortBranchFrMap[branchKey]})`
    : rawTitle;

  const sections = Array.isArray(content.sections) && content.sections.length > 0
    ? content.sections
    : (Array.isArray(exam.sections) ? exam.sections : (Array.isArray(content.exercises) ? content.exercises : []));

  const domains = getExamDomains(exam);
  const rawSubject = rawMeta.subject || header.subject || 'Mathématiques';
  const subjectFr = /[\u0600-\u06FF]/.test(rawSubject) ? 'Mathématiques' : rawSubject;

  return {
    ...exam,
    id: exam.id,
    title: rawTitle || `الامتحان الوطني الموحد — ${session}`,
    titleFr,
    year: parseInt(year, 10) || 2026,
    session,
    sessionFr,
    sessionShortFr,
    isRattrapage,
    branch,
    branchFr,
    branchKey,
    code: rawMeta.code || (branchKey === 'sm' ? 'NS 26F' : 'NS 22F'),
    duration: rawMeta.duration || (branchKey === 'sm' ? '4س' : '3س'),
    durationFr: rawMeta.duration ? String(rawMeta.duration).replace('س', 'h') : (branchKey === 'sm' ? '4h' : '3h'),
    coefficient: rawMeta.coefficient || (branchKey === 'sm' ? '9' : '7'),
    subject: rawMeta.subject || header.subject || 'الرياضيات',
    subjectFr,
    totalPoints: header.total_points || 20,
    sections,
    domains,
    hasSolutions: sections.some(s => Boolean(s.solution && String(s.solution).trim())),
  };
}

/**
 * Check if a lesson is a National Exam.
 */
export function isNationalExamDocument(doc) {
  if (!doc) return false;
  return Boolean(
    doc.docType === 'national' ||
    doc.type === 'national' ||
    doc.content?.doc_type === 'national' ||
    doc.content?.type === 'national' ||
    doc.content?.header?.doc_type === 'national' ||
    doc.content?.header?.is_national_exam ||
    doc.content?.is_national_exam ||
    doc.is_national_exam ||
    /examen\s*national|الامتحان\s*الوطني/i.test(doc.title || doc.content?.header?.fiche_title || '')
  );
}

/**
 * Sort a list of normalized exams.
 */
export function sortNationalExams(exams, sortMode = 'year_desc') {
  const sorted = [...exams];
  switch (sortMode) {
    case 'year_desc':
      return sorted.sort((a, b) => b.year - a.year || (a.isRattrapage ? 1 : -1));
    case 'year_asc':
      return sorted.sort((a, b) => a.year - b.year || (a.isRattrapage ? 1 : -1));
    case 'session':
      return sorted.sort((a, b) => (a.isRattrapage ? 1 : -1) || b.year - a.year);
    case 'title':
      return sorted.sort((a, b) => (a.titleFr || a.title || '').localeCompare(b.titleFr || b.title || '', 'fr'));
    default:
      return sorted.sort((a, b) => b.year - a.year);
  }
}

// ─── Shared Official National Exam Parser & Cleaner ───────────────────────────

/**
 * Clean corrupted LaTeX escapes, AI extraction notes, and stray punctuation
 * while preserving markdown **bold** (for inline formatting) and valid math.
 */
export function cleanNationalExamLatex(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    // Convert literal escaped \n (except LaTeX commands like \neq, \notin, \nabla, \nu...)
    .replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg|nu|nolimits|nleftarrow|nrightarrow)\b)/g, '\n')
    // Fix corrupted \notin (otin -> \notin)
    .replace(/(?<![a-zA-Z\\])otin(?=[\\{\sA-Z0-9([]|$)/g, '\\notin ')
    // Fix double-escaped LaTeX commands (\\overrightarrow -> \overrightarrow), but keep \\ followed by space/newline
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
    // Strip leaked AI OCR notes like [Note: formule exacte...] or [ou formule équivalente]
    .replace(/\[(?:Note\s*:|ou formule|ou limite)[^\]]*\]/gi, '')
    // Clean stray markdown headings ### inside text
    .replace(/(^|\n)\s*#{1,4}\s*/g, '$1')
    // Collapse excessive whitespace lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const isMeaninglessFragment = (txt) => {
  if (!txt) return true;
  const stripped = String(txt).replace(/\*\*/g, '').replace(/\s+/g, '').trim();
  return !stripped || /^[.,;:!?–—\-_]+$/.test(stripped);
};

const stripOuterMarkdownBold = (txt) => String(txt || '').replace(/\*\*/g, '').trim();

const QUESTION_POINTS_RE = /\(\s*(\d+(?:[.,]\d+)?)\s*(?:pt|pts|point|points|ن|نقطة|نقط)\s*\)/i;
const LEADING_Q_LABEL_RE = /^(?:\*\*)?\s*((?:[IVX]+\.\s*)?\d+\s*[.)]\s*[a-zA-Z\u0621-\u064A]\s*[.)]?|\d+\s*[.)]|[a-zA-Z\u0621-\u064A]\s*[.)])\s*(?:\*\*)?\s*/i;
const CONTEXT_PHRASE_RE = /^(?:on\s+consid[èe]re|soit\b|soient\b|dans\s+(?:le\s+plan|l'espace)|une\s+urne|la\s+courbe|le\s+graphique|la\s+figure|le\s+tableau|partie\s+[IVX0-9]+|نعتبر|لتكن|ليكن|في\s+(?:الفضاء|المستوى)|يحتوي\s+صندوق)/i;
const QUESTION_VERB_RE = /\b(?:montrer|v[ée]rifier|calculer|d[ée]duire|en\s+d[ée]duire|r[ée]soudre|d[ée]terminer|justifier|tracer|[ée]tudier|etudier|copier|donner|interpr[ée]ter|exprimer|[ée]crire|ecrire|pr[ée]ciser|comparer)\b|بين|تحقق|احسب|استنتج|حدد|حل|أنشئ|ادرس|أعط|اكتب/i;

function classifyBlockKind(rawText, explicitType = '', explicitPoints = '') {
  const cleaned = cleanNationalExamLatex(rawText);
  if (isMeaninglessFragment(cleaned)) return null;

  let text = cleaned;
  let points = explicitPoints ? String(explicitPoints).trim() : '';

  const ptMatch = text.match(QUESTION_POINTS_RE);
  if (ptMatch) {
    if (!points) points = `${ptMatch[1].replace(',', '.')} pt`;
    text = text.replace(ptMatch[0], '').replace(/\s{2,}/g, ' ').trim();
  }

  // Re-check if only punctuation remains after stripping points
  if (isMeaninglessFragment(text)) return null;

  // Check if text has a leading question number/letter
  let number = '';
  const bodyCandidateForTest = stripOuterMarkdownBold(text);
  const labelMatch = text.match(LEADING_Q_LABEL_RE);
  if (labelMatch) {
    const extractedLabel = labelMatch[1].trim();
    const restText = text.slice(labelMatch[0].length).trim();
    if (isMeaninglessFragment(restText)) return null;
    number = extractedLabel;
    text = restText;
  }

  const plainRest = stripOuterMarkdownBold(text);

  // Determine whether this is an intro/context statement OR an actual graded question
  const hasExplicitPoints = Boolean(points);
  const isPartHeading = /^partie\s+[IVX0-9]+/i.test(bodyCandidateForTest);
  const startsWithContext = CONTEXT_PHRASE_RE.test(plainRest) && !QUESTION_VERB_RE.test(plainRest.slice(0, 65));
  const isBareNumberIntro = /^\d+\s*[.)]$/.test(number) && startsWithContext && !hasExplicitPoints;
  const isTextIntro = (explicitType === 'text' && !hasExplicitPoints && !QUESTION_VERB_RE.test(plainRest.slice(0, 50))) ||
    isPartHeading ||
    (!number && !hasExplicitPoints && startsWithContext) ||
    isBareNumberIntro;

  if (isTextIntro) {
    // Re-attach bare number (e.g. "3. Soit (v_n)...") cleanly inside paragraph text
    const fullParagraph = number ? `**${number}** ${text}` : text;
    return { kind: 'text', text: fullParagraph };
  }

  return {
    kind: 'question',
    number,
    points,
    text,
    solution: '',
  };
}

/**
 * Split a single concatenated exercise text string into ordered text/question blocks
 * while safely ignoring anything inside $...$ or $$...$$ math blocks.
 */
function splitExerciseTextToBlocks(rawText) {
  const cleaned = cleanNationalExamLatex(rawText);
  if (isMeaninglessFragment(cleaned)) return [];

  // Mask math expressions so markers inside LaTeX are never matched
  const mathTokens = [];
  const masked = cleaned.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g, (m) => {
    const idx = mathTokens.length;
    mathTokens.push(m);
    return `__MATH_TOK_${idx}__`;
  });
  const unmask = (s) => s.replace(/__MATH_TOK_(\d+)__/g, (_, i) => mathTokens[Number(i)] || '');

  // Match question markers at line starts or sentence boundaries:
  // e.g. **1.a.** | **1. a)** | 1. a) | 1.b) | **2.** | 1) | **a)** | b)
  const markerRe = /(?:^|\n|\s)(?:(\*\*(?:\d+\s*[.)]\s*[a-zA-Z\u0621-\u064A]\s*[.)]?|\d+\s*[.)]|[a-zA-Z\u0621-\u064A]\s*[.)])\*\*)|((?:^|\n|[.?!:]\s+)\s*(?:\d+\s*[.)]\s*[a-zA-Z\u0621-\u064A]\s*[.)]?|\d+\s*[.)]))|((?:^|\n|\s)\s*[a-zA-Z\u0621-\u064A]\)))/g;

  const matches = [];
  let m;
  while ((m = markerRe.exec(masked)) !== null) {
    const full = m[0];
    const labelRaw = m[1] || m[2] || m[3] || '';
    const trimmedLabel = labelRaw.replace(/^[.?!:\s]+/, '').replace(/\*\*/g, '').trim();
    if (!trimmedLabel) continue;
    // Skip matches like "c)" inside "c.à.d" or single uppercase letters mid-sentence
    const matchStart = m.index + full.indexOf(labelRaw.replace(/^[.?!:\s]+/, ''));
    const matchEnd = m.index + full.length;
    matches.push({ start: matchStart, end: matchEnd, label: trimmedLabel });
  }

  if (matches.length === 0) {
    return [{ kind: 'text', text: cleaned }];
  }

  const blocks = [];
  const leading = unmask(masked.slice(0, matches[0].start)).trim();
  if (!isMeaninglessFragment(leading)) {
    // Split multi-line intro paragraphs cleanly
    leading.split(/\n+/).forEach(p => {
      const t = p.trim();
      if (!isMeaninglessFragment(t)) blocks.push({ kind: 'text', text: t });
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : masked.length;
    const bodyRaw = unmask(masked.slice(curr.end, nextStart)).trim();
    if (isMeaninglessFragment(bodyRaw)) continue;

    const classified = classifyBlockKind(`**${curr.label}** ${bodyRaw}`);
    if (classified) blocks.push(classified);
  }

  return blocks;
}

/**
 * Parse a national exam section into clean, non-duplicated ordered blocks:
 *   - { kind: 'text', text }
 *   - { kind: 'question', number, points, text, solution }
 *   - { kind: 'table', cols, grid_items }
 */
export function parseNationalExamExercise(sec, idx = 0) {
  const rawTitle = sec.title || sec.name || `Exercice ${idx + 1}`;
  const cleanTitle = stripOuterMarkdownBold(rawTitle).replace(/:\s*$/, '').trim();
  const points = sec.points ? `${sec.points} points` : '';
  const rawContent = cleanNationalExamLatex(sec.content || sec.description || sec.intro || '');
  const rawItems = Array.isArray(sec.items)
    ? sec.items
    : (Array.isArray(sec.questions) ? sec.questions : (Array.isArray(sec.sub_questions) ? sec.sub_questions : []));

  const nonTableItems = rawItems.filter(it => !(it && (it.type === 'grid_items' || Array.isArray(it.grid_items))));
  const tableItems = rawItems.filter(it => it && (it.type === 'grid_items' || Array.isArray(it.grid_items)));
  const sectionFigures = getSectionImageEntries(sec).map(e => ({
    figId: e.figId,
    url: getImageItemUrl(e.item),
    caption: e.item.caption || e.item.alt || '',
    width_pct: Number(e.item.width_pct) || 75,
    align: e.item.align || 'center',
    position: e.item.position || '',
  })).filter(f => f.url);

  const blocks = [];

  if (nonTableItems.length > 0) {
    const textItemsOnly = nonTableItems.filter(it => typeof it === 'string' || (it && it.type !== 'image'));
    // Check if rawContent is a distinct preamble/partial block NOT duplicated in nonTableItems
    if (rawContent && !isMeaninglessFragment(rawContent)) {
      const firstItemText = textItemsOnly.length > 0
        ? (typeof textItemsOnly[0] === 'string'
            ? textItemsOnly[0]
            : (textItemsOnly[0]?.text || textItemsOnly[0]?.question || textItemsOnly[0]?.content || ''))
        : '';
      const normContent = stripOuterMarkdownBold(rawContent).replace(/\s+/g, ' ').toLowerCase();
      const normFirst = stripOuterMarkdownBold(cleanNationalExamLatex(firstItemText)).replace(/\s+/g, ' ').toLowerCase();
      const snippet = normFirst.slice(0, Math.min(32, normFirst.length));

      const isDuplicateDump = snippet.length >= 12 && normContent.includes(snippet);
      if (!isDuplicateDump) {
        blocks.push(...splitExerciseTextToBlocks(rawContent));
      }
    }

    // Insert tables & images in their exact item order
    let tablesInjected = false;
    const NE_CUE_EARLY_RE = /(?:graphique\s*(?:ci[- ]dessous|suivant)|courbe[s]?.*(?:ci[- ]dessous|rep[èe]re)|figure\s*(?:ci[- ]dessous|suivante)|repr[ée]sente.*(?:courbe|graphique)|dans\s+un\s+(?:m[êe]me\s+)?rep[èe]re|الشكل|المبيان)/i;
    rawItems.forEach((it, itemIdx) => {
      if (it && (it.type === 'grid_items' || Array.isArray(it.grid_items))) {
        blocks.push({ kind: 'table', cols: it.cols || 4, grid_items: it.grid_items || [] });
        tablesInjected = true;
        return;
      }

      if (it && it.type === 'image') {
        const url = getImageItemUrl(it);
        if (url) {
          const imgBlock = {
            kind: 'image',
            url,
            caption: it.caption || it.alt || '',
            width_pct: Number(it.width_pct) || 75,
            align: it.align || 'center',
            position: it.position || '',
          };
          const hasTextAfter = rawItems.slice(itemIdx + 1).some(nxt => typeof nxt === 'string' || (nxt && nxt.type !== 'image' && nxt.type !== 'table' && nxt.type !== 'grid_items'));
          const prevBlk = blocks[blocks.length - 1];
          if (!hasTextAfter && (!prevBlk || !NE_CUE_EARLY_RE.test(prevBlk.text || ''))) {
            const cueIdx = blocks.findIndex(b => (b.kind === 'text' || b.kind === 'question') && NE_CUE_EARLY_RE.test(b.text || ''));
            if (cueIdx !== -1) {
              blocks.splice(cueIdx + 1, 0, imgBlock);
              return;
            }
          }
          blocks.push(imgBlock);
        }
        return;
      }

      const qText = typeof it === 'string' ? it : (it?.text || it?.question || it?.content || '');
      const explicitPoints = it?.points || it?.pts || '';
      const explicitNumber = it?.number || it?.label || it?.index || '';
      const classified = classifyBlockKind(qText, it?.type || '', explicitPoints);
      if (!classified) return;

      if (classified.kind === 'question') {
        if (!classified.number && explicitNumber) {
          classified.number = String(explicitNumber).trim();
        }
        classified.solution = cleanNationalExamLatex(it?.solution || it?.answer || '');
      }
      blocks.push(classified);
    });

    if (!tablesInjected && tableItems.length > 0) {
      tableItems.forEach(t => blocks.push({ kind: 'table', cols: t.cols || 4, grid_items: t.grid_items || [] }));
    }
  } else {
    // No text/bullet items — parse rawContent + any grid tables
    if (rawContent) {
      blocks.push(...splitExerciseTextToBlocks(rawContent));
    }
    tableItems.forEach(t => blocks.push({ kind: 'table', cols: t.cols || 4, grid_items: t.grid_items || [] }));
  }

  // Ensure any unreferenced/unemitted section figures appear in their matching visual-cue spot
  const refFigIds = getReferencedFigIds(sec);
  const emittedUrls = new Set(blocks.filter(b => b.kind === 'image' && b.url).map(b => b.url));
  const NE_CUE_RE = /(?:graphique\s*(?:ci[- ]dessous|suivant)|courbe[s]?.*(?:ci[- ]dessous|rep[èe]re)|figure\s*(?:ci[- ]dessous|suivante)|repr[ée]sente.*(?:courbe|graphique)|dans\s+un\s+(?:m[êe]me\s+)?rep[èe]re|الشكل|المبيان)/i;

  sectionFigures.forEach((fig) => {
    if (!fig.url || emittedUrls.has(fig.url)) return;
    if (fig.figId && refFigIds.has(fig.figId.toLowerCase())) return;
    const imgBlock = {
      kind: 'image',
      url: fig.url,
      caption: fig.caption,
      width_pct: fig.width_pct,
      align: fig.align,
      position: fig.position,
    };
    if (fig.position === 'before') {
      blocks.unshift(imgBlock);
      emittedUrls.add(fig.url);
      return;
    }
    const cueIdx = blocks.findIndex(b => (b.kind === 'text' || b.kind === 'question') && NE_CUE_RE.test(b.text || ''));
    if (cueIdx !== -1) {
      blocks.splice(cueIdx + 1, 0, imgBlock);
    } else {
      blocks.push(imgBlock);
    }
    emittedUrls.add(fig.url);
  });

  // Backward-compatible summary fields
  const items = blocks.filter(b => b.kind === 'question');
  const firstTextIdx = blocks.findIndex(b => b.kind === 'text');
  const preamble = firstTextIdx === 0 ? blocks[0].text : '';

  return {
    title: cleanTitle,
    points,
    preamble,
    items,
    blocks,
    figures: sectionFigures,
    solution: cleanNationalExamLatex(sec.solution || ''),
  };
}

/**
 * Extract official Moroccan Baccalaureate metadata cleanly with proper defaults.
 */
export function extractNationalExamMeta(examData) {
  const meta = examData?.header?.national_exam_meta || examData?.national_exam_meta || {};
  const rawTitle = examData?.title || examData?.header?.fiche_title || '';

  let year = meta.year || '';
  if (!year) {
    const ym = rawTitle.match(/\b(20[0-2][0-9]|199[0-9])\b/);
    year = ym ? ym[1] : '2026';
  }

  const session = meta.session || (/rattrapage|استدراك/i.test(rawTitle) ? `الدورة الاستدراكية ${year}` : `الدورة العادية ${year}`);
  const subject = meta.subject || examData?.header?.subject || 'الرياضيات';
  const branch = meta.branch || examData?.header?.level || 'مسلك علوم الحياة والأرض ومسلك العلوم الفيزيائية (خيار فرنسية)';
  const code = meta.code || (/sciences?\s*math|علوم\s*رياضية/i.test(branch + ' ' + rawTitle) ? 'NS 26F' : 'NS 22F');

  let duration = meta.duration || '3 ساعات';
  if (/^\s*(\d+)\s*س\s*$/i.test(duration)) {
    duration = duration.replace(/^\s*(\d+)\s*س\s*$/i, '$1 ساعات');
  } else if (/^\s*(\d+)\s*h\s*$/i.test(duration)) {
    duration = duration.replace(/^\s*(\d+)\s*h\s*$/i, '$1 ساعات');
  }

  const coeff = meta.coefficient || (/sciences?\s*math|علوم\s*رياضية/i.test(branch + ' ' + rawTitle) ? '9' : '7');
  const subjectNumber = meta.subject_number || '3';
  const totalPages = meta.total_pages || 4;

  const instructions = meta.general_instructions || [
    "L'utilisation de la calculatrice non programmable est autorisée ;",
    "Le candidat peut traiter les exercices de l'épreuve suivant l'ordre qui lui convient ;",
    "L'utilisation de la couleur rouge lors de la rédaction des solutions est à éviter."
  ];

  const components = meta.subject_components || [
    { name: "Exercice 1", topic: "Suites numériques", points: "3 points" },
    { name: "Exercice 2", topic: "Géométrie dans l'espace", points: "3 points" },
    { name: "Exercice 3", topic: "Nombres complexes", points: "4 points" },
    { name: "Exercice 4", topic: "Calcul des probabilités", points: "2 points" },
    { name: "Problème", topic: "Étude de fonctions numériques et calcul intégral", points: "8 points" }
  ];

  const notations = meta.notations || [
    "On désigne par $\\bar{z}$ le conjugué du nombre complexe $z$ et par $|z|$ son module.",
    "$\\ln$ désigne la fonction logarithme népérien."
  ];

  return {
    year,
    session,
    subject,
    branch,
    code,
    duration,
    coeff,
    subjectNumber,
    totalPages,
    instructions,
    components,
    notations,
  };
}

