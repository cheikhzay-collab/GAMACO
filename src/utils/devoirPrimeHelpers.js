// src/utils/devoirPrimeHelpers.js
// Helpers for DEVOIR PRIME: metadata defaults from settings, exercise-to-question parsing,
// dotted line estimation, and QR payload generation.

import {
  getSectionImageEntries,
  getImageItemUrl,
  FIGURE_TOKEN_GLOBAL_RE,
} from './figureShortcodes.js';

const VISUAL_CUE_RE = /(?:graphique\s*(?:ci[- ]dessous|suivant)|courbe[s]?.*(?:ci[- ]dessous|rep[èe]re)|figure\s*(?:ci[- ]dessous|suivante)|sch[ée]ma\s*(?:ci[- ]dessous|suivant)|tableau\s*ci[- ]dessous|repr[ée]sente.*(?:courbe|graphique)|dans\s+un\s+(?:m[êe]me\s+)?rep[èe]re|الشكل\s*(?:جانبه|أسفله)|المبيان)/i;

function collectReferencedFigIdsInStrings(strings = []) {
  const ids = new Set();
  const re = new RegExp(FIGURE_TOKEN_GLOBAL_RE.source, 'gi');
  strings.forEach((s) => {
    if (!s) return;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(String(s))) !== null) {
      ids.add(m[1].trim().toLowerCase());
    }
  });
  return ids;
}

function toFigureObj(it, fallbackId = '') {
  const url = getImageItemUrl(it);
  if (!url) return null;
  return {
    figId: it.figId !== undefined && it.figId !== null && String(it.figId).trim() !== '' ? String(it.figId).trim() : fallbackId,
    url,
    caption: it.caption || it.alt || '',
    width_pct: Number(it.width_pct) || 75,
    align: it.align || 'center',
    position: it.position || '',
  };
}

function normalizeImageList(primaryImg, imgList) {
  const seen = new Set();
  const out = [];
  const pushImg = (entry) => {
    if (!entry) return;
    const obj = typeof entry === 'string' ? { url: entry, caption: '', width_pct: 75, align: 'center' } : toFigureObj(entry);
    if (!obj || !obj.url || seen.has(obj.url)) return;
    seen.add(obj.url);
    out.push(obj);
  };
  if (Array.isArray(imgList)) imgList.forEach(pushImg);
  if (primaryImg) pushImg(primaryImg);
  return out;
}

function distributeUnplacedFigures(sectionFigures, preamble, preambleImages, questions) {
  if (!Array.isArray(sectionFigures) || sectionFigures.length === 0) {
    return { preambleImages, questions };
  }

  const allTexts = [
    preamble || '',
    ...(questions || []).flatMap(q => [
      q.text || '',
      ...(q.steps || []),
      ...(q.leftSteps || []),
      ...(q.rightSteps || []),
      q.finalBox || '',
    ]),
  ];
  const refIds = collectReferencedFigIdsInStrings(allTexts);

  const alreadyPlacedUrls = new Set();
  (preambleImages || []).forEach(img => { if (img?.url) alreadyPlacedUrls.add(img.url); });
  (questions || []).forEach(q => {
    if (q?.image) alreadyPlacedUrls.add(q.image);
    (q?.images || []).forEach(img => { if (img?.url) alreadyPlacedUrls.add(img.url); });
  });

  const nextPreambleImgs = [...(preambleImages || [])];
  const nextQuestions = (questions || []).map(q => ({
    ...q,
    images: [...(q.images || [])],
  }));

  sectionFigures.forEach((fig) => {
    if (!fig?.url) return;
    if (fig.figId && refIds.has(String(fig.figId).toLowerCase())) return;
    if (alreadyPlacedUrls.has(fig.url)) return;

    if (fig.position === 'before') {
      nextPreambleImgs.push(fig);
      alreadyPlacedUrls.add(fig.url);
      return;
    }

    // Try matching a question/stem whose wording explicitly refers to a figure/graph below
    const matchIdx = nextQuestions.findIndex(q => VISUAL_CUE_RE.test(q.text || '') && !q.image && (!q.images || q.images.length === 0));
    if (matchIdx !== -1) {
      nextQuestions[matchIdx].image = fig.url;
      nextQuestions[matchIdx].imageCaption = fig.caption || '';
      nextQuestions[matchIdx].images.push(fig);
      alreadyPlacedUrls.add(fig.url);
      return;
    }

    // Secondary fallback: attach to exercise preamble so it is always visible
    nextPreambleImgs.push(fig);
    alreadyPlacedUrls.add(fig.url);
  });

  return { preambleImages: nextPreambleImgs, questions: nextQuestions };
}

const BRANCH_AR_BY_LEVEL = {
  '2bac_pc_svt': 'مسلك علوم الحياة والأرض ومسلك العلوم الفيزيائية (خيار فرنسية)',
  '2bac_sm': 'مسلك العلوم الرياضية (أ) و (ب) (خيار فرنسية)',
  '2bac_arts': 'مسلك الآداب والعلوم الإنسانية',
  '1bac_sci': 'الأولى بكالوريا علوم تجريبية / رياضية (خيار فرنسية)',
  '1bac_arts': 'الأولى بكالوريا آداب وعلوم إنسانية',
  'common_core_sci': 'الجذع المشترك العلمي (خيار فرنسية)',
  'common_core_arts': 'الجذع المشترك للآداب والعلوم الإنسانية',
};

const COEFF_BY_LEVEL = {
  '2bac_pc_svt': '7',
  '2bac_sm': '9',
  '2bac_arts': '1',
  '1bac_sci': '7',
  '1bac_arts': '1',
  'common_core_sci': '4',
  'common_core_arts': '2',
};

/**
 * Reads global teacher/platform settings safely from localStorage.
 */
export function getGlobalPrimeSettings() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      profName: '',
      profPhone: '',
      academicYear: '',
      brandName: 'MATHS XYZ',
      handle: '',
      academy: '',
      school: '',
      ministryLogo: '',
    };
  }

  let profName = localStorage.getItem('profName') || '';
  let profPhone = localStorage.getItem('profPhone') || '';
  let academicYear = localStorage.getItem('profAcademicYear') || localStorage.getItem('academicYear') || '';
  let brandName = localStorage.getItem('devoirPrimeBrand') || '';
  let handle = localStorage.getItem('devoirPrimeHandle') || '';
  let academy = localStorage.getItem('profAcademy') || '';
  let school = localStorage.getItem('profSchool') || '';
  let ministryLogo = localStorage.getItem('ministryLogo') || '';

  try {
    const cached = localStorage.getItem('branding_config') || localStorage.getItem('config_branding');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (!academicYear) academicYear = parsed.profAcademicYear || parsed.academicYear || '';
      if (!profName) profName = parsed.profName || parsed.teacherName || '';
      if (!profPhone) profPhone = parsed.profPhone || parsed.phone || '';
      if (!brandName) brandName = parsed.brandName || parsed.platformName || '';
      if (!academy) academy = parsed.academy || parsed.profAcademy || '';
      if (!school) school = parsed.school || parsed.profSchool || '';
      if (!ministryLogo) ministryLogo = parsed.ministryLogo || '';
    }
  } catch (_) {}

  if (!academicYear) {
    const y = new Date().getFullYear();
    academicYear = `${y} - ${y + 1}`;
  }

  return {
    profName,
    profPhone,
    academicYear,
    brandName: brandName || 'MATHS PRIME',
    handle: handle || profPhone || '@prof_maths',
    academy,
    school,
    ministryLogo,
  };
}

/**
 * Builds normalized metadata for DEVOIR PRIME page 1 cover header & running headers.
 */
export function getDefaultDevoirPrimeMeta(lesson = {}, settings = {}) {
  const content = lesson?.content || {};
  const header = content?.header || lesson?.header || {};
  const savedMeta = content?.devoir_prime_meta || lesson?.devoir_prime_meta || header?.devoir_prime_meta || {};
  const globalCfg = getGlobalPrimeSettings();

  const level = savedMeta.level || lesson?.level || content?.level || header?.level || '2bac_pc_svt';
  const rawTitle = savedMeta.title || lesson?.title || header?.fiche_title || 'فرض محروس رقم 1';

  // Detect whether this document is a Moroccan National Exam (Examen National)
  const isNational = Boolean(
    savedMeta.isNational ||
    lesson?.docType === 'national' ||
    lesson?.type === 'national' ||
    content?.doc_type === 'national' ||
    header?.doc_type === 'national' ||
    header?.is_national_exam ||
    lesson?.is_national_exam ||
    /national|وطني|baccalaur[ée]at|examen\s*national/i.test(rawTitle)
  );

  // Normalize academic year display (e.g. "2025/2026" -> "2025 - 2026")
  const rawYear = settings?.academicYear || savedMeta.academicYear || header?.academic_year || globalCfg.academicYear;
  const academicYear = String(rawYear || '').replace(/\s*\/\s*/g, ' - ').trim();

  const teacherRaw = savedMeta.teacher || header?.teacher || lesson?.teacher || globalCfg.profName || '';
  const teacher = teacherRaw
    ? (/^(pr\.?|prof\.?)/i.test(teacherRaw.trim()) ? teacherRaw.trim() : `Pr. ${teacherRaw.trim()}`)
    : (isNational ? '' : 'Pr. Professeur');

  const brandName = savedMeta.brandName || globalCfg.brandName || 'MATHS PRIME';
  const handle = savedMeta.handle || header?.phone || lesson?.phone || globalCfg.handle || '';
  const neMeta = header?.national_exam_meta || content?.national_exam_meta || lesson?.national_exam_meta || {};
  const titleYearMatch = `${rawTitle} ${savedMeta.semester || ''} ${neMeta.session || ''}`.match(/\b(20[0-2][0-9]|199[0-9])\b/);
  const examYear = neMeta.year || (titleYearMatch ? titleYearMatch[1] : '');
  const code = savedMeta.code || neMeta.code || (isNational ? (level.includes('sm') || /sciences?\s*math|علوم\s*رياضية/i.test(rawTitle) ? 'NS 26F' : 'NS 22F') : '');

  const defaultTitle = isNational
    ? (rawTitle && rawTitle !== 'فرض محروس رقم 1' ? rawTitle : 'الامتحان الوطني الموحد للبكالوريا')
    : rawTitle;

  const baseSemester = isNational
    ? (savedMeta.semester || neMeta.session || (/rattrapage|استدراك/i.test(rawTitle) ? 'الدورة الاستدراكية' : 'الدورة العادية'))
    : (savedMeta.semester || 'الدورة الأولى');
  const defaultSemester = isNational && examYear && !String(baseSemester).includes(examYear)
    ? `${baseSemester} ${examYear}`
    : baseSemester;

  const defaultDuration = isNational
    ? (savedMeta.duration || (level.includes('sm') ? '4 ساعات' : '3 ساعات'))
    : (savedMeta.duration || '2س');

  const defaultCoeff = isNational
    ? (savedMeta.coefficient || (level.includes('sm') ? '9' : '7'))
    : (savedMeta.coefficient || COEFF_BY_LEVEL[level] || '7');

  return {
    title: defaultTitle,
    semester: defaultSemester,
    academicYear,
    teacher,
    brandName,
    code,
    handle,
    subject: savedMeta.subject || 'الرياضيات',
    branch: savedMeta.branch || BRANCH_AR_BY_LEVEL[level] || BRANCH_AR_BY_LEVEL['2bac_pc_svt'],
    duration: defaultDuration,
    coefficient: defaultCoeff,
    ministryLine1: savedMeta.ministryLine1 || 'المملكة المغربية',
    ministryLine2: savedMeta.ministryLine2 || 'وزارة التربية الوطنية والتعليم الأولي والرياضة',
    ministryLine3: savedMeta.ministryLine3 || (isNational ? 'المركز الوطني للامتحانات المدرسية وتقييم التعلمات' : (globalCfg.school || globalCfg.academy || 'المركز الوطني للامتحانات المدرسية وتقييم التعلمات')),
    ministryLogo: globalCfg.ministryLogo || settings?.ministryLogo || savedMeta.ministryLogo || '',
    showQR: savedMeta.showQR !== undefined ? Boolean(savedMeta.showQR) : true,
    showStudentStrip: savedMeta.showStudentStrip !== undefined ? Boolean(savedMeta.showStudentStrip) : true,
    solutionStyle: savedMeta.solutionStyle || 'clean_math', // 'clean_math' | 'handwritten'
    isNational,
    level,
  };
}

/**
 * Cleans LaTeX / markdown text safely without corrupting LaTeX commands.
 */
export function cleanPrimeText(str) {
  if (!str || typeof str !== 'string') return '';
  const parts = str.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  return parts
    .map((part, idx) => {
      if (idx % 2 === 1) {
        return part
          .replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)/gi, '\n')
          .replace(/(?<![a-zA-Z\\])otin(?=[\\\{\sA-Z0-9\(\[]|$)/g, '\\notin ');
      }
      return part
        .replace(/\\n/g, '\n')
        .replace(/\*\*/g, '');
    })
    .join('')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Estimates an appropriate number of dotted writing lines for a question based on its points and text.
 */
export function estimateDottedLines(pointsStr = '', text = '') {
  const match = String(pointsStr || '').match(/(\d+(?:[.,]\d+)?)/);
  const pts = match ? parseFloat(match[1].replace(',', '.')) : 1;

  let lines = 5;
  if (pts <= 0.5) lines = 4;
  else if (pts <= 0.75) lines = 5;
  else if (pts <= 1) lines = 5;
  else if (pts <= 1.5) lines = 7;
  else if (pts <= 2) lines = 9;
  else lines = 10;

  if (/tableau de variations|courbe|repr[ée]sentation graphique|tracer|d[ée]rivabilit[ée]/i.test(text)) {
    lines = Math.max(lines, 7);
  }
  return Math.max(3, Math.min(14, lines));
}

/**
 * Extracts a numeric points value from a string like "1.5 pt", "(2 pts)", "0,75 ن".
 */
export function parseNumericPoints(val) {
  if (typeof val === 'number' && !isNaN(val)) return val;
  const m = String(val || '').match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/**
 * Formats points badge cleanly (e.g. "1 pt", "0.5 pt", "1.5 pt", "2 pts").
 */
export function formatPointBadge(val) {
  const n = parseNumericPoints(val);
  if (!n) return '1 pt';
  const formatted = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  return n > 1 ? `${formatted} pt` : `${formatted} pt`;
}

/**
 * Splits raw exercise content/items into preamble + individual structured questions.
 */
function parseSectionIntoPrimeExercise(sec, exIdx) {
  const rawTitle = (sec.title || sec.section_header || sec.name || `Exercice ${exIdx + 1}`)
    .replace(/\*\*/g, '')
    .replace(/:\s*$/, '')
    .trim();

  // Extract points from title or sec.points
  let exPointsNum = parseNumericPoints(sec.points);
  let cleanTitle = rawTitle;
  const titlePtsMatch = rawTitle.match(/\(\s*(\d+(?:[.,]\d+)?)\s*(?:pts?|points?|ن|نقطة|نقط)\s*\)/i);
  if (titlePtsMatch) {
    if (!exPointsNum) exPointsNum = parseNumericPoints(titlePtsMatch[1]);
    cleanTitle = rawTitle.replace(titlePtsMatch[0], '').replace(/:\s*$/, '').trim();
  }

  const pointsRegex = /\(\s*(\d+(?:[.,]\d+)?)\s*(?:pts?|points?|ن|نقطة|نقط)\s*\)/i;
  const leadingPtsRegex = /^[\(\[]\s*(\d+(?:[.,]\d+)?)\s*(?:pts?|points?|ن)?\s*[\)\]]\s*/i;
  const qStartRegex = /^(\d+\s*[.)]\s*[a-z]\s*[.)]|\d+\s*[.)]|[a-z]\s*[.)]|I+\s*[.)])\s*/i;

  let preambleLines = [];
  let questions = [];

  const rawItems = Array.isArray(sec.items) && sec.items.length > 0
    ? sec.items
    : (Array.isArray(sec.questions) && sec.questions.length > 0 ? sec.questions : []);

  const sectionFigures = getSectionImageEntries(sec)
    .map(e => toFigureObj(e.item, e.figId))
    .filter(Boolean);

  const rawContent = cleanPrimeText(sec.content || sec.description || '');

  // Build candidate lines from either rawItems or rawContent
  let candidateBlocks = [];
  const textItemsCount = rawItems.filter(it => typeof it === 'string' || (it && it.type !== 'image' && it.type !== 'table')).length;

  const mapItemToBlock = (it) => {
    const imgUrl = it?.type === 'image' ? getImageItemUrl(it) : '';
    return {
      text: cleanPrimeText(typeof it === 'string' ? it : (it?.text || it?.question || it?.content || '')),
      points: it?.points || it?.pts || '',
      type: it?.type || 'auto',
      solution: it?.solution || it?.answer || '',
      image: imgUrl || null,
      imageObj: imgUrl ? toFigureObj(it) : null,
      caption: it?.caption || it?.alt || '',
    };
  };

  if (rawItems.length > 0 && textItemsCount > 0) {
    // Check if rawContent has full multi-line text while rawItems only has 1 summary entry (e.g. + 1 image)
    const firstTextItem = rawItems.find(it => typeof it === 'string' || (it && it.type !== 'image' && it.type !== 'table'));
    const firstItemText = cleanPrimeText(typeof firstTextItem === 'string' ? firstTextItem : (firstTextItem?.text || ''));
    if (textItemsCount === 1 && rawContent && rawContent.split('\n').length > 2 && (!firstItemText || !rawContent.startsWith(firstItemText.slice(0, 20)))) {
      candidateBlocks = rawContent.split('\n').map(l => ({ text: l.trim(), type: 'auto' })).filter(b => b.text);
    } else {
      candidateBlocks = rawItems.map(mapItemToBlock).filter(b => b.text || b.image);
    }
  } else if (rawContent) {
    candidateBlocks = rawContent.split('\n').map(l => ({ text: l.trim(), type: 'auto' })).filter(b => b.text);
  } else if (rawItems.length > 0) {
    candidateBlocks = rawItems.map(mapItemToBlock).filter(b => b.text || b.image);
  }

  // Group candidate blocks into preamble (before first numbered question) and questions
  let currentQ = null;
  let preambleImages = [];

  for (let i = 0; i < candidateBlocks.length; i++) {
    const blk = candidateBlocks[i];
    if (blk.image) {
      const figObj = blk.imageObj || { url: blk.image, caption: blk.caption || '', width_pct: 75, align: 'center' };
      const hasMoreTextAfter = candidateBlocks.slice(i + 1).some(b => !b.image && b.text);
      const cueTarget = (!hasMoreTextAfter && (!currentQ || !VISUAL_CUE_RE.test(currentQ.text || '')))
        ? questions.find(q => VISUAL_CUE_RE.test(q.text || '') && !q.image)
        : null;
      if (cueTarget) {
        cueTarget.image = blk.image;
        cueTarget.imageCaption = blk.caption || '';
        cueTarget.images.push(figObj);
      } else if (currentQ) {
        if (!currentQ.image) currentQ.image = blk.image;
        if (!currentQ.imageCaption) currentQ.imageCaption = blk.caption || '';
        currentQ.images.push(figObj);
      } else {
        preambleImages.push(figObj);
        preambleLines.push(`[IMAGE:${blk.image}]`);
      }
      continue;
    }

    let text = blk.text.trim();
    if (!text) continue;

    // Extract embedded points
    let pts = blk.points ? formatPointBadge(blk.points) : '';
    const ptMatch = text.match(pointsRegex);
    if (ptMatch) {
      if (!pts) pts = formatPointBadge(ptMatch[1]);
      text = text.replace(ptMatch[0], ' ').replace(/\s{2,}/g, ' ').trim();
    } else {
      const leadPt = text.match(leadingPtsRegex);
      if (leadPt) {
        if (!pts) pts = formatPointBadge(leadPt[1]);
        text = text.replace(leadPt[0], '').trim();
      }
    }

    const qMatch = text.match(qStartRegex);
    const isQuestionStart = Boolean(qMatch) || blk.type === 'bullet' || Boolean(pts);

    if (isQuestionStart) {
      if (currentQ) {
        questions.push(currentQ);
      }
      const qNum = qMatch ? qMatch[1].trim() : `${questions.length + 1}.`;
      const bodyWithoutPrefix = qMatch ? text.slice(qMatch[0].length).trim() : text;
      const resolvedPts = pts || '1 pt';

      currentQ = {
        id: `dp-ex${exIdx + 1}-q${questions.length + 1}`,
        number: qNum,
        text: bodyWithoutPrefix || text,
        points: resolvedPts,
        _hasExplicitPoints: Boolean(pts),
        isStem: false,
        linesCount: estimateDottedLines(resolvedPts, bodyWithoutPrefix || text),
        layout: 'single', // 'single' | 'two_columns'
        steps: blk.solution ? blk.solution.split('\n').filter(Boolean) : [],
        finalBox: '',
        leftTitle: '',
        leftSteps: [],
        leftConclusion: '',
        rightTitle: '',
        rightSteps: [],
        rightConclusion: '',
        qrUrl: '',
        image: null,
        images: [],
      };
    } else if (currentQ) {
      // Continuation line of the current question (e.g. a centered display formula $$...$$ or [[FIG:1]])
      currentQ.text = `${currentQ.text}\n${text}`;
    } else {
      // Text before the first numbered question -> exercise preamble
      preambleLines.push(text);
    }
  }

  if (currentQ) {
    questions.push(currentQ);
  }

  // Smart Parent-Stem Detection:
  // If a numbered question (e.g. "2. Le graphique ci-dessous...") is immediately followed
  // by sub-questions ("a)", "b)", "2.a.", "2.b."), treat it as a parent stem (no fake points, no answer box).
  const isNumberedParent = (num = '') => /^\d+\s*[.)]$/.test(String(num).trim());
  const isSubQuestionAfterParent = (parentNum = '', nextNum = '') => {
    const pDigit = String(parentNum).replace(/[^\d]/g, '');
    const nTrim = String(nextNum).trim();
    if (/^[a-z]\s*[.)]$/i.test(nTrim)) return true;
    if (pDigit && new RegExp(`^${pDigit}\\s*[.)]\\s*[a-z]\\s*[.)]?$`, 'i').test(nTrim)) return true;
    return false;
  };
  const looksLikeStemIntro = (txt = '') => {
    const t = String(txt).replace(FIGURE_TOKEN_GLOBAL_RE, '').trim();
    return /[:：]\s*$/.test(t) || /(?:suivantes?|suivants?|cas suivants?|on consid[èe]re|soit\s|soient\s|repr[ée]sente|ci[- ]dessous|في كل حالة|يلي|التالية|الآتية)/i.test(t);
  };

  for (let i = 0; i < questions.length - 1; i++) {
    const q = questions[i];
    const nextQ = questions[i + 1];
    if (
      isNumberedParent(q.number) &&
      isSubQuestionAfterParent(q.number, nextQ.number) &&
      (!q._hasExplicitPoints || looksLikeStemIntro(q.text))
    ) {
      q.isStem = true;
      q.points = '';
      q.linesCount = 0;
    }
  }
  questions.forEach(q => { delete q._hasExplicitPoints; });

  // Fallback: if no numbered questions were found, treat the whole exercise as 1 question
  if (questions.length === 0 && (preambleLines.length > 0 || rawContent)) {
    const fallbackText = preambleLines.filter(l => !l.startsWith('[IMAGE:')).join('\n') || rawContent;
    const pts = exPointsNum ? formatPointBadge(exPointsNum) : '2 pt';
    questions.push({
      id: `dp-ex${exIdx + 1}-q1`,
      number: '1.',
      text: fallbackText,
      points: pts,
      isStem: false,
      linesCount: estimateDottedLines(pts, fallbackText),
      layout: 'single',
      steps: sec.solution ? cleanPrimeText(sec.solution).split('\n').filter(Boolean) : [],
      finalBox: '',
      leftTitle: '',
      leftSteps: [],
      leftConclusion: '',
      rightTitle: '',
      rightSteps: [],
      rightConclusion: '',
      qrUrl: '',
      image: preambleImages[0]?.url || null,
      images: [...preambleImages],
    });
    preambleImages = [];
    preambleLines = [];
  }

  const preambleText = preambleLines.filter(l => !l.startsWith('[IMAGE:')).join('\n');
  const distributed = distributeUnplacedFigures(sectionFigures, preambleText, preambleImages, questions);
  preambleImages = distributed.preambleImages;
  questions = distributed.questions;

  // Recompute total points for exercise if missing (skip stems)
  const sumQPoints = questions.filter(q => !q.isStem).reduce((acc, q) => acc + parseNumericPoints(q.points), 0);
  const finalExPoints = exPointsNum || sumQPoints || 0;

  return {
    id: sec.id || `dp-ex-${exIdx + 1}`,
    title: cleanTitle || `Exercice ${exIdx + 1}`,
    points: finalExPoints ? (Number.isInteger(finalExPoints) ? String(finalExPoints) : String(Number(finalExPoints.toFixed(2)))) : '',
    preamble: preambleText,
    preambleImage: preambleImages[0]?.url || (preambleLines.find(l => l.startsWith('[IMAGE:')) || '').replace(/^\[IMAGE:|\]$/g, '') || null,
    preambleImages,
    figures: sectionFigures,
    questions,
  };
}

/**
 * Converts ANY lesson/homework object into a normalized DEVOIR PRIME exercises array.
 * If already saved with `devoir_prime_exercises`, returns them intact while hydrating any attached section figures.
 */
export function normalizeToDevoirPrimeExercises(lesson = {}) {
  const content = lesson?.content || {};
  const rawSections = content?.sections || lesson?.sections || [];
  const saved = content?.devoir_prime_exercises || lesson?.devoir_prime_exercises;
  if (Array.isArray(saved) && saved.length > 0) {
    return saved.map((ex, eIdx) => {
      const matchingSec = Array.isArray(rawSections) ? rawSections[eIdx] : null;
      const secFigures = matchingSec
        ? getSectionImageEntries(matchingSec).map(e => toFigureObj(e.item, e.figId)).filter(Boolean)
        : [];
      const mergedFigures = [...secFigures];
      const seenFigUrls = new Set(mergedFigures.map(f => f.url));
      if (Array.isArray(ex.figures)) {
        ex.figures.forEach(f => {
          const obj = toFigureObj(f);
          if (obj && !seenFigUrls.has(obj.url)) {
            seenFigUrls.add(obj.url);
            mergedFigures.push(obj);
          }
        });
      }

      const initPreambleImages = normalizeImageList(ex.preambleImage, ex.preambleImages);
      const initQuestions = Array.isArray(ex.questions)
        ? ex.questions.map((q, qIdx) => {
            const qImgs = normalizeImageList(q.image, q.images);
            return {
              id: q.id || `dp-ex${eIdx + 1}-q${qIdx + 1}`,
              number: q.number || `${qIdx + 1}.`,
              text: q.text || '',
              isStem: Boolean(q.isStem),
              points: q.isStem ? '' : (q.points || '1 pt'),
              linesCount: q.isStem ? 0 : (Number(q.linesCount) || estimateDottedLines(q.points, q.text)),
              layout: q.layout === 'two_columns' ? 'two_columns' : 'single',
              steps: Array.isArray(q.steps) ? q.steps : (q.solution ? String(q.solution).split('\n').filter(Boolean) : []),
              finalBox: q.finalBox || '',
              leftTitle: q.leftTitle || '',
              leftSteps: Array.isArray(q.leftSteps) ? q.leftSteps : [],
              leftConclusion: q.leftConclusion || '',
              rightTitle: q.rightTitle || '',
              rightSteps: Array.isArray(q.rightSteps) ? q.rightSteps : [],
              rightConclusion: q.rightConclusion || '',
              qrUrl: q.qrUrl || '',
              image: qImgs[0]?.url || q.image || null,
              images: qImgs,
            };
          })
        : [];

      const distributed = distributeUnplacedFigures(mergedFigures, ex.preamble || '', initPreambleImages, initQuestions);

      return {
        id: ex.id || `dp-ex-${eIdx + 1}`,
        title: ex.title || `Exercice ${eIdx + 1}`,
        points: ex.points !== undefined && ex.points !== null ? String(ex.points) : '',
        preamble: ex.preamble || '',
        preambleImage: distributed.preambleImages[0]?.url || ex.preambleImage || null,
        preambleImages: distributed.preambleImages,
        figures: mergedFigures,
        questions: distributed.questions,
      };
    });
  }

  if (!Array.isArray(rawSections) || rawSections.length === 0) return [];

  return rawSections.map((sec, idx) => parseSectionIntoPrimeExercise(sec, idx));
}

/**
 * Computes the points_table (for tbl_grades) directly from DEVOIR PRIME exercises.
 */
export function buildPointsTableFromPrimeExercises(exercises = []) {
  return (exercises || []).map((ex, idx) => {
    const subpoints = (ex.questions || [])
      .filter(q => !q.isStem)
      .map(q => ({
        question: q.number || '',
        points: parseNumericPoints(q.points),
      }));
    const sumSub = subpoints.reduce((s, sp) => s + (sp.points || 0), 0);
    const exPts = parseNumericPoints(ex.points) || sumSub;
    return {
      exercise: ex.title || `Exercice ${idx + 1}`,
      title: (ex.preamble || '').slice(0, 60),
      points: Number(exPts.toFixed(2)),
      subpoints,
    };
  });
}

/**
 * Builds the QR code payload for a specific question (carries question points & platform link).
 */
export function buildQuestionQrPayload(lesson = {}, meta = {}, exIdx = 0, q = {}, qIdx = 0) {
  if (q?.qrUrl && q.qrUrl.trim()) return q.qrUrl.trim();
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const pts = q?.points || '1 pt';
  const num = q?.number || `${qIdx + 1}.`;
  if (origin && lesson?.id) {
    return `${origin}/lessons/${lesson.id}?ex=${exIdx + 1}&q=${encodeURIComponent(num)}&pts=${encodeURIComponent(pts)}`;
  }
  return `${meta?.title || 'DEVOIR PRIME'} | Ex${exIdx + 1} Q${num} | ${pts}`;
}

const BARE_LATEX_CMD_RE = /\\(?:dfrac|tfrac|frac|overrightarrow|overleftarrow|overline|underline|widehat|widetilde|vec|sqrt|parallel|perp|cdot|times|div|pm|mp|lim|mathbb|mathcal|mathrm|text|iff|Longleftrightarrow|Leftrightarrow|Longrightarrow|Rightarrow|implies|to|rightarrow|leftarrow|mapsto|in|notin|neq|ne|leq|geq|leqslant|geqslant|approx|equiv|infty|sum|prod|int|alpha|beta|gamma|delta|Delta|theta|lambda|mu|pi|sigma|omega|subset|subseteq|supset|cup|cap|emptyset|forall|exists|left|right|sin|cos|tan|ln|log|exp)\b/;

/**
 * Tokenizes a non-math text segment and wraps any bare LaTeX expressions
 * (e.g. `\overrightarrow{AE'} = \dfrac{2}{3}\overrightarrow{AC}` or `(EE') \parallel (BC)`)
 * cleanly inside `$ ... $` without touching surrounding French/Arabic prose.
 */
function wrapBareLatexInTextSegment(segment) {
  if (!segment || !BARE_LATEX_CMD_RE.test(segment)) return segment;

  const tokens = [];
  let i = 0;
  const n = segment.length;

  const consumeBalanced = (openCh, closeCh) => {
    let depth = 0;
    let out = '';
    while (i < n) {
      const ch = segment[i];
      out += ch;
      if (ch === openCh) depth++;
      else if (ch === closeCh) {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
    return out;
  };

  while (i < n) {
    // 1. Whitespace
    if (/\s/.test(segment[i])) {
      let sp = '';
      while (i < n && /\s/.test(segment[i])) sp += segment[i++];
      tokens.push({ kind: 'space', val: sp });
      continue;
    }

    // 2. LaTeX command + any chained {...} / [...] / ^... / _... arguments
    if (segment[i] === '\\' && i + 1 < n && /[a-zA-Z{}]/.test(segment[i + 1])) {
      let cmd = segment[i++];
      if (/[a-zA-Z]/.test(segment[i])) {
        while (i < n && /[a-zA-Z]/.test(segment[i])) cmd += segment[i++];
      } else {
        cmd += segment[i++];
      }
      // Consume optional whitespace + [...] / {...} / ^ / _ arguments attached to this command
      while (i < n) {
        if (segment[i] === '{') {
          cmd += consumeBalanced('{', '}');
        } else if (segment[i] === '[') {
          cmd += consumeBalanced('[', ']');
        } else if (segment[i] === '^' || segment[i] === '_') {
          cmd += segment[i++];
          if (i < n && segment[i] === '{') cmd += consumeBalanced('{', '}');
          else if (i < n && !/\s/.test(segment[i])) cmd += segment[i++];
        } else {
          break;
        }
      }
      tokens.push({ kind: 'math_cmd', val: cmd });
      continue;
    }

    // 3. Arabic text -> prose
    if (/[\u0600-\u06FF]/.test(segment[i])) {
      let ar = '';
      while (i < n && /[\u0600-\u06FF]/.test(segment[i])) ar += segment[i++];
      tokens.push({ kind: 'prose', val: ar });
      continue;
    }

    // 4. Parenthesized / bracketed geometry or math expressions like (EE'), (BC), [AB], (E)
    if (segment[i] === '(' || segment[i] === '[') {
      const openCh = segment[i];
      const closeCh = openCh === '(' ? ')' : ']';
      const saveIdx = i;
      const chunk = consumeBalanced(openCh, closeCh);
      const inner = chunk.slice(1, -1).trim();
      // If inner has no multi-letter lowercase French words (3+ chars), treat as math atom
      if (inner && !/[a-zàâäéèêëîïôöùûüç]{3,}/.test(inner)) {
        tokens.push({ kind: 'math_atom', val: chunk });
        continue;
      }
      i = saveIdx;
    }

    // 5. Pure math operators & numbers
    if (/[=+\-<>^_0-9|/]/.test(segment[i])) {
      let op = '';
      while (i < n && /[=+\-<>^_0-9|/.,'′]/.test(segment[i])) {
        // Stop before trailing sentence period/comma if followed by space or end
        if ((segment[i] === '.' || segment[i] === ',') && (i + 1 >= n || /\s/.test(segment[i + 1]))) break;
        op += segment[i++];
      }
      if (op) {
        tokens.push({ kind: 'math_atom', val: op });
        continue;
      }
    }

    // 6. Latin word (distinguish French prose words vs short uppercase math identifiers like AB, AE', BC, x)
    if (/[a-zA-ZÀ-ÖØ-öø-ÿ]/.test(segment[i])) {
      let word = '';
      while (i < n && /[a-zA-ZÀ-ÖØ-öø-ÿ'’′0-9]/.test(segment[i])) word += segment[i++];
      // Common French connectors / words -> prose
      const isFrenchProse =
        /[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/.test(word) ||
        /^(?:on|a|et|ou|or|si|car|par|sur|dans|avec|pour|que|qui|est|sont|donc|alors|puisque|comme|aussi|les|des|une|un|la|le|en|de|du|au|aux|soit|soient|d'où|d'apres|d'après|l'on|n'est|pas|en|point|droite|droites|vecteur|vecteurs|triangle|théorème|theoreme|réciproque|reciproque|conclut|colinéaires|colineaires|parallèles|paralleles|continue|dérivable|derivable|strictement|croissante|décroissante|decroissante|fonction|limite|limites|ensemble|solutions|équation|equation|pose|donc)$/i.test(word) ||
        /[a-z]{2,}/.test(word);

      tokens.push({ kind: isFrenchProse ? 'prose' : 'math_atom', val: word });
      continue;
    }

    // 7. Punctuation (:, ;, ,, ., etc.) -> prose boundary
    tokens.push({ kind: 'prose', val: segment[i++] });
  }

  // Merge adjacent math tokens (including single spaces between math tokens) into contiguous spans.
  // Wrap a span in `$...$` ONLY if it contains at least one `math_cmd` token!
  let result = '';
  let idx = 0;
  while (idx < tokens.length) {
    if (tokens[idx].kind === 'math_cmd' || tokens[idx].kind === 'math_atom') {
      let start = idx;
      let end = idx;
      let hasCmd = tokens[idx].kind === 'math_cmd';
      let j = idx + 1;
      while (j < tokens.length) {
        if (tokens[j].kind === 'math_cmd' || tokens[j].kind === 'math_atom') {
          if (tokens[j].kind === 'math_cmd') hasCmd = true;
          end = j;
          j++;
        } else if (tokens[j].kind === 'space' && j + 1 < tokens.length && (tokens[j + 1].kind === 'math_cmd' || tokens[j + 1].kind === 'math_atom')) {
          j++;
        } else {
          break;
        }
      }

      const spanText = tokens.slice(start, end + 1).map(t => t.val).join('');
      if (hasCmd) {
        result += `$${spanText.trim()}$`;
      } else {
        result += spanText;
      }
      idx = end + 1;
    } else {
      result += tokens[idx].val;
      idx++;
    }
  }

  return result;
}

/**
 * Ensures all LaTeX expressions in a DEVOIR PRIME line (or finalBox) are properly wrapped in `$...$`
 * and fixes over-escaped JSON backslashes (`\\dfrac` -> `\dfrac`).
 */
export function ensureMathDelimiters(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw
    // Fix over-escaped backslashes like \\dfrac, \\overrightarrow, \\parallel
    .replace(/\\\\([a-zA-Z{}])/g, '\\$1')
    // Normalize \( ... \) and \[ ... \] to $ ... $ and $$ ... $$
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$ $1 $$$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // Split around existing $...$ and $$...$$ blocks and fix bare LaTeX only outside them
  const parts = s.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  return parts
    .map((part, idx) => (idx % 2 === 1 ? part : wrapBareLatexInTextSegment(part)))
    .join('');
}
