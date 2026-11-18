// src/utils/devoirPrimeHelpers.js
// Helpers for DEVOIR PRIME: metadata defaults from settings, exercise-to-question parsing,
// dotted line estimation, and QR payload generation.

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
    };
  }

  let profName = localStorage.getItem('profName') || '';
  let profPhone = localStorage.getItem('profPhone') || '';
  let academicYear = localStorage.getItem('profAcademicYear') || localStorage.getItem('academicYear') || '';
  let brandName = localStorage.getItem('devoirPrimeBrand') || '';
  let handle = localStorage.getItem('devoirPrimeHandle') || '';
  let academy = localStorage.getItem('profAcademy') || '';
  let school = localStorage.getItem('profSchool') || '';

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

  // Normalize academic year display (e.g. "2025/2026" -> "2025 - 2026")
  const rawYear = settings?.academicYear || savedMeta.academicYear || header?.academic_year || globalCfg.academicYear;
  const academicYear = String(rawYear || '').replace(/\s*\/\s*/g, ' - ').trim();

  const teacherRaw = savedMeta.teacher || header?.teacher || lesson?.teacher || globalCfg.profName || '';
  const teacher = teacherRaw
    ? (/^(pr\.?|prof\.?)/i.test(teacherRaw.trim()) ? teacherRaw.trim() : `Pr. ${teacherRaw.trim()}`)
    : 'Pr. Professeur';

  const brandName = savedMeta.brandName || globalCfg.brandName || 'MATHS PRIME';
  const handle = savedMeta.handle || header?.phone || lesson?.phone || globalCfg.handle || '';

  return {
    title: rawTitle,
    semester: savedMeta.semester || 'الدورة الأولى',
    academicYear,
    teacher,
    brandName,
    handle,
    subject: savedMeta.subject || 'الرياضيات',
    branch: savedMeta.branch || BRANCH_AR_BY_LEVEL[level] || BRANCH_AR_BY_LEVEL['2bac_pc_svt'],
    duration: savedMeta.duration || '2س',
    coefficient: savedMeta.coefficient || COEFF_BY_LEVEL[level] || '7',
    ministryLine1: savedMeta.ministryLine1 || 'المملكة المغربية',
    ministryLine2: savedMeta.ministryLine2 || 'وزارة التربية الوطنية والتعليم الأولي والرياضة',
    ministryLine3: savedMeta.ministryLine3 || globalCfg.school || globalCfg.academy || 'المركز الوطني للامتحانات المدرسية وتقييم التعلمات',
    showQR: savedMeta.showQR !== undefined ? Boolean(savedMeta.showQR) : true,
    showStudentStrip: savedMeta.showStudentStrip !== undefined ? Boolean(savedMeta.showStudentStrip) : true,
    solutionStyle: savedMeta.solutionStyle || 'clean_math', // 'clean_math' | 'handwritten'
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

  const rawContent = cleanPrimeText(sec.content || sec.description || '');

  // Build candidate lines from either rawItems or rawContent
  let candidateBlocks = [];
  if (rawItems.length > 0) {
    // Check if rawContent has preamble text not already repeated in items
    if (rawContent && rawItems.length > 0) {
      const firstItemText = cleanPrimeText(typeof rawItems[0] === 'string' ? rawItems[0] : (rawItems[0]?.text || ''));
      if (firstItemText && !rawContent.startsWith(firstItemText.slice(0, 20))) {
        // Content may contain both preamble and questions; prefer items if items has multiple entries
        if (rawItems.length === 1 && rawContent.split('\n').length > 2) {
          candidateBlocks = rawContent.split('\n').map(l => ({ text: l.trim(), type: 'auto' })).filter(b => b.text);
        } else {
          candidateBlocks = rawItems.map(it => ({
            text: cleanPrimeText(typeof it === 'string' ? it : (it?.text || it?.question || it?.content || '')),
            points: it?.points || it?.pts || '',
            type: it?.type || 'auto',
            solution: it?.solution || it?.answer || '',
            image: it?.type === 'image' ? it.url : null,
            caption: it?.caption || '',
          })).filter(b => b.text || b.image);
        }
      } else {
        candidateBlocks = rawItems.map(it => ({
          text: cleanPrimeText(typeof it === 'string' ? it : (it?.text || it?.question || it?.content || '')),
          points: it?.points || it?.pts || '',
          type: it?.type || 'auto',
          solution: it?.solution || it?.answer || '',
          image: it?.type === 'image' ? it.url : null,
          caption: it?.caption || '',
        })).filter(b => b.text || b.image);
      }
    } else {
      candidateBlocks = rawItems.map(it => ({
        text: cleanPrimeText(typeof it === 'string' ? it : (it?.text || it?.question || it?.content || '')),
        points: it?.points || it?.pts || '',
        type: it?.type || 'auto',
        solution: it?.solution || it?.answer || '',
        image: it?.type === 'image' ? it.url : null,
        caption: it?.caption || '',
      })).filter(b => b.text || b.image);
    }
  } else if (rawContent) {
    candidateBlocks = rawContent.split('\n').map(l => ({ text: l.trim(), type: 'auto' })).filter(b => b.text);
  }

  // Group candidate blocks into preamble (before first numbered question) and questions
  let currentQ = null;

  for (let i = 0; i < candidateBlocks.length; i++) {
    const blk = candidateBlocks[i];
    if (blk.image) {
      if (currentQ) {
        currentQ.image = blk.image;
        currentQ.imageCaption = blk.caption;
      } else {
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
      };
    } else if (currentQ) {
      // Continuation line of the current question (e.g. a centered display formula $$...$$)
      currentQ.text = `${currentQ.text}\n${text}`;
    } else {
      // Text before the first numbered question -> exercise preamble
      preambleLines.push(text);
    }
  }

  if (currentQ) {
    questions.push(currentQ);
  }

  // Fallback: if no numbered questions were found, treat the whole exercise as 1 question
  if (questions.length === 0 && (preambleLines.length > 0 || rawContent)) {
    const fallbackText = preambleLines.join('\n') || rawContent;
    const pts = exPointsNum ? formatPointBadge(exPointsNum) : '2 pt';
    questions.push({
      id: `dp-ex${exIdx + 1}-q1`,
      number: '1.',
      text: fallbackText,
      points: pts,
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
      image: null,
    });
    preambleLines = [];
  }

  // Recompute total points for exercise if missing
  const sumQPoints = questions.reduce((acc, q) => acc + parseNumericPoints(q.points), 0);
  const finalExPoints = exPointsNum || sumQPoints || 0;

  return {
    id: sec.id || `dp-ex-${exIdx + 1}`,
    title: cleanTitle || `Exercice ${exIdx + 1}`,
    points: finalExPoints ? (Number.isInteger(finalExPoints) ? String(finalExPoints) : String(Number(finalExPoints.toFixed(2)))) : '',
    preamble: preambleLines.filter(l => !l.startsWith('[IMAGE:')).join('\n'),
    preambleImage: (preambleLines.find(l => l.startsWith('[IMAGE:')) || '').replace(/^\[IMAGE:|\]$/g, '') || null,
    questions,
  };
}

/**
 * Converts ANY lesson/homework object into a normalized DEVOIR PRIME exercises array.
 * If already saved with `devoir_prime_exercises`, returns them intact.
 */
export function normalizeToDevoirPrimeExercises(lesson = {}) {
  const content = lesson?.content || {};
  const saved = content?.devoir_prime_exercises || lesson?.devoir_prime_exercises;
  if (Array.isArray(saved) && saved.length > 0) {
    return saved.map((ex, eIdx) => ({
      id: ex.id || `dp-ex-${eIdx + 1}`,
      title: ex.title || `Exercice ${eIdx + 1}`,
      points: ex.points !== undefined && ex.points !== null ? String(ex.points) : '',
      preamble: ex.preamble || '',
      preambleImage: ex.preambleImage || null,
      questions: Array.isArray(ex.questions)
        ? ex.questions.map((q, qIdx) => ({
            id: q.id || `dp-ex${eIdx + 1}-q${qIdx + 1}`,
            number: q.number || `${qIdx + 1}.`,
            text: q.text || '',
            points: q.points || '1 pt',
            linesCount: Number(q.linesCount) || estimateDottedLines(q.points, q.text),
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
            image: q.image || null,
          }))
        : [],
    }));
  }

  const rawSections = content?.sections || lesson?.sections || [];
  if (!Array.isArray(rawSections) || rawSections.length === 0) return [];

  return rawSections.map((sec, idx) => parseSectionIntoPrimeExercise(sec, idx));
}

/**
 * Computes the points_table (for tbl_grades) directly from DEVOIR PRIME exercises.
 */
export function buildPointsTableFromPrimeExercises(exercises = []) {
  return (exercises || []).map((ex, idx) => {
    const subpoints = (ex.questions || []).map(q => ({
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
