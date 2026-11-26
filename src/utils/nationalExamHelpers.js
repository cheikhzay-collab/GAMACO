/**
 * nationalExamHelpers.js — L'CONQ / GAMACO
 * Domain detection, normalization, metadata extraction and sorting for Moroccan National Exams.
 */

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
