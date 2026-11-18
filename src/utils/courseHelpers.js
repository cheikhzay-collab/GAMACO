// src/utils/courseHelpers.js
// Unified data normalization, language detection, metadata resolution,
// automatic Plan du Cours (TOC), and pedagogical classification for `course` documents.

import { autoRepairMathText } from './mathRenderer';
import { ensureMathDelimiters } from './devoirPrimeHelpers';
import { getLevelDisplayName } from './levelHelpers';

export const COURSE_BLOCK_META = {
  definition: {
    id: 'definition',
    labelFr: 'Définition',
    labelAr: 'تعريف',
    accent: '#4338ca',
    bgLight: '#f5f7ff',
    borderLight: '#c7d2fe',
    badgeBg: '#e0e7ff',
    badgeColor: '#312e81',
    isKeyBox: true,
  },
  theorem: {
    id: 'theorem',
    labelFr: 'Théorème',
    labelAr: 'مبرهنة',
    accent: '#b91c1c',
    bgLight: '#fff7f7',
    borderLight: '#fecaca',
    badgeBg: '#fee2e2',
    badgeColor: '#991b1b',
    isKeyBox: true,
  },
  property: {
    id: 'property',
    labelFr: 'Propriété',
    labelAr: 'خاصية',
    accent: '#0369a1',
    bgLight: '#f0f9ff',
    borderLight: '#bae6fd',
    badgeBg: '#e0f2fe',
    badgeColor: '#075985',
    isKeyBox: true,
  },
  corollary: {
    id: 'corollary',
    labelFr: 'Corollaire',
    labelAr: 'نتيجة',
    accent: '#0f766e',
    bgLight: '#f0fdfa',
    borderLight: '#99f6e4',
    badgeBg: '#ccfbf1',
    badgeColor: '#115e59',
    isKeyBox: true,
  },
  methode: {
    id: 'methode',
    labelFr: 'Méthode & Savoir-Faire',
    labelAr: 'منهجية وطريقة الحل',
    accent: '#b45309',
    bgLight: '#fffbeb',
    borderLight: '#fde68a',
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    isKeyBox: true,
  },
  demonstration: {
    id: 'demonstration',
    labelFr: 'Démonstration',
    labelAr: 'برهان',
    accent: '#475569',
    bgLight: '#f8fafc',
    borderLight: '#cbd5e1',
    badgeBg: '#f1f5f9',
    badgeColor: '#334155',
    isKeyBox: false,
  },
  example: {
    id: 'example',
    labelFr: 'Exemple',
    labelAr: 'مثال تطبيقي',
    accent: '#047857',
    bgLight: '#f8fafc',
    borderLight: '#cbd5e1',
    badgeBg: '#d1fae5',
    badgeColor: '#065f46',
    isKeyBox: false,
  },
  remark: {
    id: 'remark',
    labelFr: 'Remarque',
    labelAr: 'ملاحظة هامة',
    accent: '#d97706',
    bgLight: '#fffdf5',
    borderLight: '#fde68a',
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    isKeyBox: false,
  },
  activity: {
    id: 'activity',
    labelFr: 'Activité',
    labelAr: 'نشاط تمهيدي',
    accent: '#0d9488',
    bgLight: '#f0fdfa',
    borderLight: '#99f6e4',
    badgeBg: '#ccfbf1',
    badgeColor: '#115e59',
    isKeyBox: false,
  },
  exercise: {
    id: 'exercise',
    labelFr: "Exercice d'application",
    labelAr: 'تمرين تطبيقي',
    accent: '#1d4ed8',
    bgLight: '#f8fafc',
    borderLight: '#bfdbfe',
    badgeBg: '#dbeafe',
    badgeColor: '#1e40af',
    isKeyBox: false,
  },
  content: {
    id: 'content',
    labelFr: 'Cours',
    labelAr: 'فقرة درس',
    accent: '#1e3a8a',
    bgLight: 'transparent',
    borderLight: '#e2e8f0',
    badgeBg: '#eff6ff',
    badgeColor: '#1e40af',
    isKeyBox: false,
  },
};

/**
 * Cleanly detects whether a lesson document is a theoretical course (`course`).
 */
export function isCourseDocument(lesson) {
  if (!lesson) return false;
  const dt = String(lesson.docType || lesson.content?.doc_type || lesson.type || '').toLowerCase().trim();
  if (dt === 'course') return true;
  if (['exercises', 'homework', 'devoir_prime', 'national', 'summary', 'ebook', 'concours'].includes(dt)) {
    return false;
  }
  // Fallback heuristic: if no docType set and contains theory blocks
  const secs = lesson.content?.sections || lesson.sections || [];
  if (Array.isArray(secs) && secs.length > 0) {
    const theoryCount = secs.filter(s => ['definition', 'theorem', 'property', 'corollary', 'methode', 'demonstration'].includes(s?.type)).length;
    return theoryCount >= 2;
  }
  return false;
}

/**
 * Detects whether the course is in Arabic (RTL) or French (LTR).
 */
export function detectCourseLanguage(lesson, settings = {}) {
  const content = lesson?.content || {};
  const header = content?.header || lesson?.header || {};
  const lang = String(
    settings?.language ||
    content?.metadata?.language ||
    lesson?.language ||
    content?.language ||
    header?.language ||
    ''
  ).toLowerCase().trim();

  if (lang === 'ar' || lang.startsWith('ar-')) return true;
  if (lang === 'fr' || lang.startsWith('fr-') || lang === 'en') return false;

  const titleAll = `${lesson?.title || ''} ${header?.fiche_title || ''}`;
  if (/\(نسخة عربية\)/i.test(titleAll)) return true;
  if (/\(version fran[çc]aise\)/i.test(titleAll)) return false;

  const secs = content?.sections || lesson?.sections || [];
  const sample = secs
    .slice(0, 12)
    .map(s => `${s?.title || ''} ${s?.content || ''} ${(s?.items || []).map(i => i?.text || '').join(' ')}`)
    .join(' ');
  const arChars = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const latChars = (sample.match(/[a-zA-Z]/g) || []).length;
  if (arChars > 0 || latChars > 0) return arChars > latChars;

  const titleAr = (titleAll.match(/[\u0600-\u06FF]/g) || []).length;
  const titleLat = (titleAll.match(/[a-zA-Z]/g) || []).length;
  return titleAr > titleLat;
}

/**
 * Resolves real teacher, institution, academic year, and pedagogical metadata
 * without ever injecting fake hardcoded placeholders (like FES-MEKNES / 18 NOVEMBRE / Pr. LATRACH).
 */
export function getCourseMeta(lesson = {}, settings = {}) {
  const content = lesson?.content || {};
  const header = content?.header || lesson?.header || {};
  const isArabic = detectCourseLanguage(lesson, settings);

  let lsProf = '';
  let lsPhone = '';
  let lsYear = '';
  let lsAcademy = '';
  let lsDirection = '';
  let lsSchool = '';
  let lsBrand = '';

  if (typeof window !== 'undefined' && window.localStorage) {
    lsProf = localStorage.getItem('profName') || '';
    lsPhone = localStorage.getItem('profPhone') || '';
    lsYear = localStorage.getItem('profAcademicYear') || localStorage.getItem('academicYear') || '';
    lsAcademy = localStorage.getItem('profAcademy') || '';
    lsDirection = localStorage.getItem('profDirection') || '';
    lsSchool = localStorage.getItem('profSchool') || '';
    try {
      const cached = localStorage.getItem('branding_config') || localStorage.getItem('config_branding');
      if (cached) {
        const p = JSON.parse(cached);
        if (!lsProf) lsProf = p.profName || p.teacherName || '';
        if (!lsPhone) lsPhone = p.profPhone || p.phone || '';
        if (!lsYear) lsYear = p.profAcademicYear || p.academicYear || '';
        if (!lsAcademy) lsAcademy = p.academy || p.profAcademy || '';
        if (!lsDirection) lsDirection = p.direction || p.profDirection || '';
        if (!lsSchool) lsSchool = p.school || p.profSchool || '';
        if (!lsBrand) lsBrand = p.platformName || p.brandName || '';
      }
    } catch {}
  }

  const nowYear = new Date().getFullYear();
  const defaultYear = new Date().getMonth() >= 8 ? `${nowYear} / ${nowYear + 1}` : `${nowYear - 1} / ${nowYear}`;

  const rawTeacher = header.teacher || lesson.teacher || settings.teacher || lsProf || '';
  const cleanTeacher = rawTeacher
    .replace(/^(prof\.?|pr\.?|pro\.?|أستاذ)\s*[:.]?\s*/i, '')
    .trim();

  const schools = Array.isArray(header.schools) && header.schools.length
    ? header.schools
    : (Array.isArray(lesson.schools) ? lesson.schools : []);

  const levelCode = lesson.level || content.level || header.level || '';
  const levelLabel = levelCode ? getLevelDisplayName(levelCode, isArabic) : '';

  const capacites = (header.capacites_attendues || lesson.header?.capacites_attendues || content.capacites_attendues || '').trim();
  const contenus = (header.contenus || lesson.header?.contenus || content.contenus || '').trim();
  const leContenu = (header.le_contenu || header.leContenu || lesson.header?.le_contenu || content.le_contenu || '').trim();
  const prerequisites = (header.prerequisites || header.prerequis || content.prerequisites || '').trim();
  const remarques = (header.remarques || lesson.header?.remarques || '').trim();

  return {
    isArabic,
    dir: isArabic ? 'rtl' : 'ltr',
    title: cleanMarkdownStars(header.fiche_title || lesson.title || (isArabic ? 'درس في الرياضيات' : 'Cours de Mathématiques')),
    subject: header.subject || lesson.subject || (isArabic ? 'الرياضيات' : 'Mathématiques'),
    chapterNumber: String(header.chapter_number || lesson.chapterNumber || '').trim(),
    levelCode,
    levelLabel,
    teacher: cleanTeacher,
    phone: header.phone || lesson.phone || lsPhone || '',
    academicYear: settings.academicYear || header.academic_year || header.academicYear || lsYear || defaultYear,
    academy: (header.academie || lesson.header?.academie || lsAcademy || '').trim(),
    direction: (header.direction || lesson.header?.direction || lsDirection || '').trim(),
    school: (header.etablissement || schools[0] || lesson.header?.etablissement || lsSchool || '').trim(),
    schools,
    importance: (header.degre_importance || lesson.header?.degre_importance || '').trim(),
    brandName: lsBrand || 'GAMACO',
    capacites,
    contenus,
    leContenu,
    prerequisites,
    remarques,
    hasPedagogicalBox: Boolean(capacites || contenus || leContenu || prerequisites),
  };
}

/**
 * Strips raw markdown bold/heading markers like **Définition :** or ### Title.
 */
export function cleanMarkdownStars(str) {
  if (!str) return '';
  return String(str)
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/g, '')
    .trim();
}

/**
 * Detects canonical pedagogical block kind from sec.type and sec.title.
 */
export function classifyCourseSection(sec) {
  const rawType = String(sec?.type || '').toLowerCase().trim();
  const titleLower = cleanMarkdownStars(sec?.title || '').toLowerCase();

  if (rawType === 'exercise') return 'exercise';
  if (rawType === 'demonstration' || rawType === 'proof' || /^(d[ée]monstration|preuve|برهان)\b/i.test(titleLower)) return 'demonstration';
  if (rawType === 'methode' || rawType === 'technique' || /^(m[ée]thode|savoir[\s-]faire|technique|منهجية|طريقة)\b/i.test(titleLower)) return 'methode';
  if (rawType === 'corollary' || /^(corollaire|cons[ée]quence|نتيجة)\b/i.test(titleLower)) return 'corollary';
  if (rawType === 'theorem' || /^(th[ée]or[èe]me|مبرهنة)\b/i.test(titleLower)) return 'theorem';
  if (rawType === 'definition' || /^(d[ée]finition|تعريف)\b/i.test(titleLower)) return 'definition';
  if (rawType === 'property' || /^(propri[ée]t[ée]|خاصية|خصائص)\b/i.test(titleLower)) return 'property';
  if (rawType === 'example' || /^(exemple|مثال|أمثلة)\b/i.test(titleLower)) return 'example';
  if (rawType === 'remark' || /^(remarque|attention|pi[èe]ge|ملاحظة|انتبه)\b/i.test(titleLower)) return 'remark';
  if (rawType === 'activity' || /^(activit[ée]|application|نشاط|تطبيق)\b/i.test(titleLower)) return 'activity';

  return 'content';
}

/**
 * Removes redundant keyword prefix from section titles so we never display "Définition : Définition :".
 */
export function stripKeywordFromTitle(rawTitle, kind) {
  let clean = cleanMarkdownStars(rawTitle);
  // Strip leading emoji or decorative bullets
  clean = clean.replace(/^[\s📌🔍💡✨⚖️🎯🚀🛠️📖•\-]+/gu, '').trim();

  const regexMap = {
    definition: /^(d[ée]finitions?|تعريف)\s*\d*\s*[:\-—]*\s*/i,
    theorem: /^(th[ée]or[èe]mes?|مبرهنة)\s*\d*\s*[:\-—]*\s*/i,
    property: /^(propri[ée]t[ée]s?|خاصية|خصائص)\s*\d*\s*[:\-—]*\s*/i,
    corollary: /^(corollaires?|cons[ée]quences?|نتيجة)\s*\d*\s*[:\-—]*\s*/i,
    methode: /^(m[ée]thodes?|savoir[\s-]faire|techniques?|منهجية|طريقة)\s*\d*\s*[:\-—]*\s*/i,
    demonstration: /^(d[ée]monstrations?|preuves?|برهان)\s*\d*\s*[:\-—]*\s*/i,
    example: /^(exemples?|مثال|أمثلة)\s*\d*\s*[:\-—]*\s*/i,
    remark: /^(remarques?|attention|ملاحظة|ملاحظات|انتبه)\s*\d*\s*[:\-—]*\s*/i,
    activity: /^(activit[ée]s?|applications?|نشاط|تطبيق)\s*\d*\s*[:\-—]*\s*/i,
  };

  if (regexMap[kind]) {
    clean = clean.replace(regexMap[kind], '').trim();
  }
  clean = clean.replace(/^[:\-—\s]+|[:\-—\s]+$/g, '').trim();
  return clean;
}

/**
 * Normalizes math text cleanly for both Web (KaTeX React) and Print (KaTeX HTML).
 */
export function sanitizeCourseMath(text) {
  if (!text) return '';
  let s = String(text).replace(/\\n/g, '\n');
  s = autoRepairMathText(s);
  s = ensureMathDelimiters(s);
  return s.trim();
}

/**
 * Normalizes a course's sections array:
 * - Unifies `sec.content` AND `sec.items` (fixing Bug #1 where edits disappeared)
 * - Eliminates double-boxing of `highlight_box` inside already-boxed definitions/properties/theorems
 * - Extracts `table_data` / `table` / `image` / `notation_grid` / `grid_items` cleanly
 * - Preserves `solution` across ALL section types (not just exercises!)
 * - Drops empty orphan sections that have neither text, images, tables, nor solutions
 */
export function normalizeCourseSections(rawSections = [], isArabic = false) {
  if (!Array.isArray(rawSections)) return [];
  const normalized = [];

  rawSections.forEach((sec, idx) => {
    if (!sec) return;
    const kind = classifyCourseSection(sec);
    const meta = COURSE_BLOCK_META[kind] || COURSE_BLOCK_META.content;
    const subtitle = stripKeywordFromTitle(sec.title || '', kind);
    const sectionHeader = cleanMarkdownStars(sec.section_header || '');

    const rawItems = Array.isArray(sec.items) ? sec.items : [];
    const richItems = []; // images, tables, notation_grid, grid_items
    const legacyTextBlocks = [];

    rawItems.forEach((it) => {
      if (!it) return;
      if (it.type === 'image') {
        const url = String(it.url || it.src || '').trim();
        const alt = String(it.alt || it.description || '').trim();
        const isInvalid = !url || url.length < 5 || /placeholder|example\.com/i.test(url) || ['none', 'url', 'image'].includes(url.toLowerCase());
        if (!isInvalid || /tableau de signe|sign_table/i.test(alt + url)) {
          richItems.push({
            type: 'image',
            url,
            alt,
            width_pct: it.width_pct || 75,
            align: it.align || 'center',
            position: it.position || 'after',
          });
        }
      } else if (it.type === 'table') {
        const tbl = it.table_data || it.table || it.data || (Array.isArray(it.headers) ? it : null);
        if (tbl) {
          richItems.push({ type: 'table', table: tbl, title: it.title || '', position: it.position || 'after' });
        }
      } else if (it.type === 'notation_grid' && Array.isArray(it.notation_columns)) {
        richItems.push({ type: 'notation_grid', notation_columns: it.notation_columns, position: it.position || 'after' });
      } else if (it.type === 'grid_items' || Array.isArray(it.grid_items)) {
        const gList = it.grid_items || it.items || [];
        if (gList.length > 0) {
          richItems.push({ type: 'grid_items', items: gList, position: it.position || 'after' });
        }
      } else {
        const txt = String(it.text || it.content || '').trim();
        if (txt) {
          legacyTextBlocks.push({
            type: it.type || 'text',
            text: sanitizeCourseMath(txt),
          });
        }
      }
    });

    // UNIFIED CONTENT RESOLUTION:
    // Priority: `sec.content` (if non-empty, reflects latest edits in AdminLessonEdit)
    // Fallback: `legacyTextBlocks` from `sec.items` (for legacy extracted courses)
    const cleanContent = sanitizeCourseMath(sec.content || '');
    const bodyBlocks = [];

    if (cleanContent) {
      // Split into clean paragraphs / bullet lines
      const lines = cleanContent.split(/\n/);
      lines.forEach((line) => {
        const t = line.trim();
        if (!t) return;
        const isBullet = /^(?:[-•▪▸]|\$\\bullet\$|\*)\s+/.test(t);
        const stripped = isBullet ? t.replace(/^(?:[-•▪▸]|\$\\bullet\$|\*)\s+/, '').trim() : t;
        bodyBlocks.push({ type: isBullet ? 'bullet' : 'text', text: stripped });
      });
    } else if (legacyTextBlocks.length > 0) {
      legacyTextBlocks.forEach((blk) => {
        const lines = blk.text.split(/\n/);
        lines.forEach((line) => {
          const t = line.trim();
          if (!t) return;
          const isBullet = blk.type === 'bullet' || /^(?:[-•▪▸]|\$\\bullet\$)\s+/.test(t);
          const stripped = t.replace(/^(?:[-•▪▸]|\$\\bullet\$)\s+/, '').trim();
          // Note: highlight_box inside an already-boxed section (definition/theorem/property/corollary/methode)
          // becomes normal text/bullet to eliminate ugly Double-Boxing!
          const effectiveType =
            blk.type === 'highlight_box' && !meta.isKeyBox
              ? 'highlight_box'
              : (isBullet ? 'bullet' : 'text');
          bodyBlocks.push({ type: effectiveType, text: stripped });
        });
      });
    }

    const cleanSolution = sanitizeCourseMath(sec.solution || '');
    const cleanAccent = sanitizeCourseMath(sec.accent_text || '');

    // Skip completely empty orphan sections (fixes Bug #8)
    const hasAnyContent = bodyBlocks.length > 0 || richItems.length > 0 || Boolean(cleanSolution) || Boolean(cleanAccent);
    if (!hasAnyContent) return;

    normalized.push({
      id: sec.id || `course-sec-${idx + 1}`,
      originalIndex: idx,
      kind,
      meta,
      title: subtitle,
      rawTitle: cleanMarkdownStars(sec.title || ''),
      sectionHeader,
      sectionNumber: String(sec.section_number || '').trim(),
      points: sec.points ? String(sec.points).trim() : '',
      accentText: cleanAccent,
      bodyBlocks,
      beforeItems: richItems.filter(it => it.position === 'before'),
      afterItems: richItems.filter(it => it.position !== 'before'),
      solution: cleanSolution,
      bgColor: sec.bgColor || sec.bg_color || '',
      fontSize: sec.fontSize || sec.font_size || '',
      lineHeight: sec.lineHeight || sec.line_height || '',
      isArabic: sec.language === 'ar' || isArabic,
    });
  });

  return normalized;
}

/**
 * Extracts automatic Course Outline (Plan du cours) and pedagogical stats.
 */
export function buildCourseOutline(normalizedSections = []) {
  const chapters = [];
  const seen = new Set();

  normalizedSections.forEach((sec, idx) => {
    if (sec.sectionHeader && !seen.has(sec.sectionHeader)) {
      seen.add(sec.sectionHeader);
      chapters.push({
        id: `chapter-${chapters.length + 1}`,
        anchorId: sec.id,
        index: chapters.length + 1,
        sectionIndex: idx,
        title: sec.sectionHeader,
      });
    }
  });

  const stats = {
    total: normalizedSections.length,
    chapters: chapters.length,
    definitions: normalizedSections.filter(s => s.kind === 'definition').length,
    theoremsAndProps: normalizedSections.filter(s => ['theorem', 'property', 'corollary'].includes(s.kind)).length,
    methods: normalizedSections.filter(s => s.kind === 'methode').length,
    examples: normalizedSections.filter(s => s.kind === 'example').length,
    activitiesAndExercises: normalizedSections.filter(s => ['activity', 'exercise'].includes(s.kind)).length,
    solvedCount: normalizedSections.filter(s => Boolean(s.solution)).length,
  };

  return { chapters, stats };
}
