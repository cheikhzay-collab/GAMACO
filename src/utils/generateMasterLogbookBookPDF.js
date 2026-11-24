// src/utils/generateMasterLogbookBookPDF.js
// High-Fidelity Moroccan Official Teacher's Master Logbook Book Generator
// (كتاب دفتر النصوص الشامل لجميع الأقسام وفق المعايير الوزارية الرسمية للمملكة المغربية)

import {
  esc,
  renderActivityCellHTML,
  chunkActivityContent,
  getTranslatedComponent,
  getLevelDisplayName,
  getAcademicYear
} from './generateLogbookPDF.js';
import { mergeConsecutiveEntries, ORDERED_TIME_SLOTS } from './scheduleHelpers.js';
import { getOfficialMoroccanHolidays } from '../services/schoolService.js';

// Moroccan Kingdom Coat of Arms SVG Vector
const MOROCCAN_EMBLEM_SVG = `
<svg viewBox="0 0 160 160" width="80" height="80" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">
  <defs>
    <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#d97706" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#b91c1c"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </linearGradient>
    <linearGradient id="goldRibbon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <!-- Decorative halo -->
  <circle cx="80" cy="80" r="76" fill="none" stroke="#d97706" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.6"/>
  <circle cx="80" cy="80" r="72" fill="none" stroke="#b45309" stroke-width="0.8"/>
  
  <!-- Royal Crown on top -->
  <path d="M 66 38 L 70 48 L 80 42 L 90 48 L 94 38 L 98 52 L 62 52 Z" fill="#d97706" stroke="#78350f" stroke-width="0.8"/>
  <circle cx="66" cy="36" r="2.2" fill="#fbbf24"/>
  <circle cx="80" cy="40" r="2.8" fill="#fbbf24"/>
  <circle cx="94" cy="36" r="2.2" fill="#fbbf24"/>
  <rect x="64" y="52" width="32" height="3" rx="1.5" fill="#047857"/>

  <!-- Main Shield -->
  <path d="M 52 56 Q 80 50 108 56 Q 108 92 80 114 Q 52 92 52 56 Z" fill="url(#shieldGrad)" stroke="#d97706" stroke-width="2.5"/>
  
  <!-- Rising Sun inside shield -->
  <path d="M 62 82 Q 80 68 98 82 Z" fill="#fbbf24" opacity="0.85"/>
  <!-- Atlas Mountain peaks inside shield -->
  <polygon points="56,92 72,76 86,90 80,92" fill="#047857"/>
  <polygon points="76,92 90,78 104,92" fill="#065f46"/>
  
  <!-- Green Moroccan Star (Pentagram) -->
  <polygon points="80,82 82.5,89.5 90,89.5 84,94 86.5,101 80,96.5 73.5,101 76,94 70,89.5 77.5,89.5" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linejoin="round"/>
  
  <!-- Golden Banner / Scroll below shield -->
  <path d="M 40 120 Q 80 128 120 120 Q 112 130 80 132 Q 48 130 40 120 Z" fill="url(#goldRibbon)" stroke="#78350f" stroke-width="0.8"/>
  <!-- Verse: إِنْ تَنْصُرُوا اللَّهَ يَنْصُرْكُمْ -->
  <text x="80" y="127.5" font-size="5.2" font-family="'Amiri', 'Cairo', serif" font-weight="bold" fill="#451a03" text-anchor="middle">إِنْ تَنْصُرُوا اللَّهَ يَنْصُرْكُمْ</text>

  <!-- Side Atlas Laurel Branches -->
  <path d="M 44 64 Q 38 88 48 112" fill="none" stroke="#d97706" stroke-width="1.8"/>
  <path d="M 116 64 Q 122 88 112 112" fill="none" stroke="#d97706" stroke-width="1.8"/>
</svg>
`;

// Moroccan Map Silhouette SVG (Complete Map with Moroccan Sahara)
const MOROCCAN_MAP_SVG = `
<svg viewBox="0 0 240 240" width="130" height="130" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;opacity:0.88;">
  <defs>
    <linearGradient id="mapGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#065f46"/>
    </linearGradient>
  </defs>
  <!-- Stylized outline of the Kingdom of Morocco (Tanger to Lagouira) -->
  <path d="M 170 30 
           Q 185 32 195 40 
           Q 188 52 175 60 
           Q 180 75 190 85 
           Q 175 105 160 120 
           Q 145 135 135 155 
           Q 120 180 100 205 
           Q 85 225 75 220 
           Q 70 205 78 190 
           Q 85 170 95 150 
           Q 105 135 110 115 
           Q 115 95 125 75 
           Q 140 50 155 35 Z" 
        fill="url(#mapGrad)" stroke="#d97706" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- Sahara coordinates lines -->
  <line x1="80" y1="165" x2="140" y2="165" stroke="#fbbf24" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.6"/>
  <circle cx="170" cy="38" r="2.5" fill="#fbbf24" title="Tanger"/>
  <circle cx="152" cy="55" r="2.5" fill="#fbbf24" title="Rabat"/>
  <circle cx="145" cy="65" r="2.5" fill="#fbbf24" title="Casablanca"/>
  <circle cx="135" cy="95" r="2.5" fill="#fbbf24" title="Marrakech"/>
  <circle cx="120" cy="120" r="2.5" fill="#fbbf24" title="Agadir"/>
  <circle cx="95" cy="175" r="2.5" fill="#fbbf24" title="Laâyoune"/>
  <circle cx="80" cy="210" r="2.5" fill="#fbbf24" title="Dakhla"/>
  <text x="120" y="235" font-size="8" font-family="'Cairo', sans-serif" font-weight="800" fill="#047857" text-anchor="middle">المملكة المغربية الشريفة</text>
</svg>
`;

// Top-Left 3D Faceted Triangles + 'طبعة جديدة' Badge Vector (Matches Official Inspection Notebook)
const COVER_TOP_LEFT_SVG = `
<svg viewBox="0 0 290 270" width="290" height="270" xmlns="http://www.w3.org/2000/svg" style="display:block;">
  <defs>
    <!-- Facet Gradients for Top-Left 3D Cluster -->
    <linearGradient id="tlSlateDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#181f23"/>
      <stop offset="100%" stop-color="#2c353b"/>
    </linearGradient>
    <linearGradient id="tlSlateMid" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#47555e"/>
      <stop offset="100%" stop-color="#333e45"/>
    </linearGradient>
    <linearGradient id="tlSlateLight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#647480"/>
      <stop offset="100%" stop-color="#45535c"/>
    </linearGradient>
    <linearGradient id="tlRedBright" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c0392b"/>
      <stop offset="100%" stop-color="#962d22"/>
    </linearGradient>
    <linearGradient id="tlRedDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#80241a"/>
      <stop offset="100%" stop-color="#561811"/>
    </linearGradient>
    <filter id="badgeShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
  </defs>

  <!-- 3D Low-Poly Charcoal & Slate Facets -->
  <polygon points="0,0 150,0 90,90" fill="url(#tlSlateDark)"/>
  <polygon points="150,0 215,40 90,90" fill="url(#tlSlateMid)"/>
  <polygon points="215,40 245,110 145,120 90,90" fill="url(#tlSlateLight)"/>
  <polygon points="0,0 90,90 0,110" fill="#141a1d"/>
  
  <!-- 3D Low-Poly Terracotta / Brick Red Facets -->
  <polygon points="0,110 90,90 48,160 0,175" fill="url(#tlRedBright)"/>
  <polygon points="90,90 145,120 100,180 48,160" fill="url(#tlRedDark)"/>
  <polygon points="145,120 205,145 100,180" fill="#6d1f16"/>
  <polygon points="0,175 48,160 24,235 0,250" fill="#2d373c"/>
  <polygon points="48,160 100,180 72,240 24,235" fill="#3f4d54"/>

  <!-- Crisp 3D Wireframe Ridge Highlights -->
  <line x1="90" y1="90" x2="150" y2="0" stroke="rgba(255,255,255,0.22)" stroke-width="1.2"/>
  <line x1="90" y1="90" x2="215" y2="40" stroke="rgba(255,255,255,0.18)" stroke-width="1.2"/>
  <line x1="90" y1="90" x2="48" y2="160" stroke="rgba(255,255,255,0.3)" stroke-width="1.4"/>
  <line x1="48" y1="160" x2="100" y2="180" stroke="rgba(0,0,0,0.35)" stroke-width="1.2"/>

  <!-- Official 'طبعة جديدة' Badge (Authentic Moroccan Inspection Notebook Seal) -->
  <g transform="translate(100, 95) rotate(-6)">
    <!-- Badge Base with Drop Shadow -->
    <ellipse cx="0" cy="0" rx="44" ry="38" fill="#ffffff" stroke="#0f172a" stroke-width="2.6" filter="url(#badgeShadow)"/>
    <ellipse cx="0" cy="0" rx="38" ry="32" fill="none" stroke="#0f172a" stroke-width="1.2"/>
    
    <!-- Curved Ribbon Wings and Tail Lines -->
    <path d="M -35 25 Q 0 45 35 25" stroke="#0f172a" stroke-width="2.2" fill="none"/>
    <path d="M -28 32 Q 0 49 28 32" stroke="#0f172a" stroke-width="1.2" fill="none"/>
    <path d="M -40 18 Q -48 29 -36 34" stroke="#0f172a" stroke-width="1.6" fill="none"/>
    <path d="M 40 18 Q 48 29 36 34" stroke="#0f172a" stroke-width="1.6" fill="none"/>
    
    <!-- Text: طبعة جديدة -->
    <text x="0" y="-5" font-family="'Cairo', 'Amiri', sans-serif" font-weight="900" font-size="16.5" fill="#0f172a" text-anchor="middle" letter-spacing="0.5">طَبْعَة</text>
    <text x="0" y="18" font-family="'Cairo', 'Amiri', sans-serif" font-weight="900" font-size="16.5" fill="#0f172a" text-anchor="middle" letter-spacing="0.5">جَدِيدَة</text>
  </g>
</svg>
`;

// Bottom-Right 3D Low-Poly Faceted Pyramids & Floating Crystals Vector
const COVER_BOTTOM_RIGHT_SVG = `
<svg viewBox="0 0 390 450" width="390" height="450" xmlns="http://www.w3.org/2000/svg" style="display:block;">
  <defs>
    <!-- Facet Gradients for Bottom-Right Polyhedrons -->
    <linearGradient id="brRedApexLight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ef4444"/>
      <stop offset="40%" stop-color="#dc2626"/>
      <stop offset="100%" stop-color="#b91c1c"/>
    </linearGradient>
    <linearGradient id="brRedApexDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#991b1b"/>
      <stop offset="65%" stop-color="#781d1d"/>
      <stop offset="100%" stop-color="#551010"/>
    </linearGradient>
    <linearGradient id="brRedBase" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7f1d1d"/>
      <stop offset="100%" stop-color="#450a0a"/>
    </linearGradient>

    <!-- Sage / Slate Green Polyhedron Gradients -->
    <linearGradient id="brSageLight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#a3c4b5"/>
      <stop offset="100%" stop-color="#7c9f90"/>
    </linearGradient>
    <linearGradient id="brSageDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#557769"/>
      <stop offset="100%" stop-color="#3a5247"/>
    </linearGradient>
    <linearGradient id="brSageDeep" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2c3e35"/>
      <stop offset="100%" stop-color="#1c2822"/>
    </linearGradient>

    <!-- Terracotta Shard Gradients -->
    <linearGradient id="brOrangeLight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <linearGradient id="brOrangeDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c2410c"/>
      <stop offset="100%" stop-color="#9a3412"/>
    </linearGradient>

    <filter id="brDropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="-3" dy="5" stdDeviation="7" flood-color="#000000" flood-opacity="0.22"/>
    </filter>
  </defs>

  <!-- 1. Background Edge Shards -->
  <polygon points="345,240 390,210 390,295 340,285" fill="#475569"/>
  <polygon points="305,370 390,310 390,450 270,450" fill="#1e293b"/>
  
  <!-- 2. Lower Red Pyramid -->
  <g filter="url(#brDropShadow)">
    <polygon points="250,315 200,365 280,445" fill="url(#brRedApexLight)"/>
    <polygon points="250,315 280,445 375,400" fill="url(#brRedApexDark)"/>
    <polygon points="250,315 375,400 315,345" fill="url(#brRedBase)"/>
  </g>

  <!-- 3. Giant Dominant Red 3D Pyramid (Magnificent Focal Polyhedron) -->
  <g filter="url(#brDropShadow)">
    <!-- Top illuminated face (vibrant vermilion/crimson) -->
    <polygon points="180,145 390,180 290,270" fill="url(#brRedApexLight)"/>
    <!-- Left shadow face (deep mahogany wine) -->
    <polygon points="180,145 290,270 208,360" fill="url(#brRedApexDark)"/>
    <!-- Base face extending right -->
    <polygon points="290,270 390,180 390,315 320,370" fill="url(#brRedBase)"/>

    <!-- Sharp 3D Ridge Highlight Lines -->
    <line x1="180" y1="145" x2="290" y2="270" stroke="rgba(255,255,255,0.45)" stroke-width="1.8"/>
    <line x1="180" y1="145" x2="390" y2="180" stroke="rgba(255,255,255,0.3)" stroke-width="1.2"/>
    <line x1="180" y1="145" x2="208" y2="360" stroke="rgba(0,0,0,0.35)" stroke-width="1.4"/>
  </g>

  <!-- 4. Sage-Green Faceted 3D Pyramid (Natural Moroccan Contrast) -->
  <g filter="url(#brDropShadow)">
    <!-- Apex at (135, 280) -->
    <polygon points="135,280 82,355 150,380" fill="url(#brSageLight)"/>
    <polygon points="135,280 150,380 190,325" fill="url(#brSageDark)"/>
    <polygon points="82,355 150,380 128,410" fill="url(#brSageDeep)"/>
    <!-- Ridge highlight -->
    <line x1="135" y1="280" x2="150" y2="380" stroke="rgba(255,255,255,0.5)" stroke-width="1.4"/>
  </g>

  <!-- 5. Floating Sage-Green Crystal (Hovering upper left) -->
  <g filter="url(#brDropShadow)">
    <polygon points="100,195 74,238 122,248" fill="#a4beae"/>
    <polygon points="100,195 122,248 136,218" fill="#5f7f6f"/>
    <polygon points="74,238 122,248 108,264" fill="#3f554a"/>
    <line x1="100" y1="195" x2="122" y2="248" stroke="rgba(255,255,255,0.55)" stroke-width="1.2"/>
  </g>

  <!-- 6. Floating Terracotta / Orange Shard (Hovering left edge) -->
  <g filter="url(#brDropShadow)">
    <polygon points="70,295 44,328 85,338" fill="url(#brOrangeLight)"/>
    <polygon points="70,295 85,338 102,315" fill="url(#brOrangeDark)"/>
    <polygon points="44,328 85,338 75,352" fill="#7c2d12"/>
    <line x1="70" y1="295" x2="85" y2="338" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
  </g>

  <!-- 7. Tiny High Floating Crystal -->
  <polygon points="220,95 204,120 234,125" fill="#9ebdb0" opacity="0.85"/>
  <polygon points="220,95 234,125 242,110" fill="#557769" opacity="0.85"/>
</svg>
`;

// Bottom-Left Official Publisher / Educational Emblem Vector
const COVER_PUBLISHER_LOGO_SVG = `
<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
  <svg viewBox="0 0 160 70" width="138" height="60" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pubBlueGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1d4ed8"/>
        <stop offset="100%" stop-color="#1e3a8a"/>
      </linearGradient>
      <linearGradient id="pubCyanGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>
    </defs>
    
    <!-- Geometric Angled Wing / Quill Shape -->
    <path d="M 12 46 L 44 12 L 66 12 L 34 46 Z" fill="url(#pubBlueGrad)"/>
    <!-- Sweeping Forward Swoosh -->
    <path d="M 36 46 L 70 12 Q 102 16 120 34 Q 90 28 58 46 Z" fill="url(#pubCyanGrad)"/>
    <!-- Bottom Underline Swoosh -->
    <path d="M 20 52 Q 72 50 130 36 Q 98 56 34 56 Z" fill="#0369a1"/>
    
    <!-- Open Book Motif at lower fold -->
    <path d="M 122 54 L 128 48 L 134 54 L 128 52 Z" fill="#1e3a8a"/>
    <path d="M 134 54 L 140 48 L 146 54 L 140 52 Z" fill="#0284c7"/>

    <!-- Brand Typography: المسار -->
    <text x="58" y="38" font-family="'Cairo', sans-serif" font-weight="900" font-size="14.5" fill="#ffffff" text-anchor="middle" letter-spacing="1">المسار</text>
  </svg>
  <div style="font-family: 'Cairo', sans-serif; font-size: 9.5px; font-weight: 800; color: #1e293b; letter-spacing: 0.05em; padding-right: 4px;">
    للنشر والتوزيع والتوثيق التربوي
  </div>
</div>
`;

/**
 * Builds the combined chronological logbook sessions for a given class,
 * interleaving holidays and absences up to the current date.
 */
function buildClassLogbookRows(cls, allEntries = [], holidays = [], absences = [], academicYear = '2026/2027') {
  if (!cls) return [];
  const startYear = parseInt(String(academicYear).split(/[-/]/)[0], 10) || 2026;
  const yearStart = new Date(`${startYear}-09-01T00:00:00`);
  const yearEnd = new Date(`${startYear + 1}-08-31T23:59:59`);

  const isAr = Boolean(
    cls.language === 'ar' ||
    cls.isArabic ||
    (cls.name && cls.name.includes('عرب')) ||
    (cls.level && cls.level.includes('arts'))
  );

  // 1. Class manual entries
  const clsRaw = allEntries.filter(e => e.classId === cls.id && e.date);
  const filtered = clsRaw.filter(e => {
    const d = new Date(e.date);
    return d >= yearStart && d <= yearEnd;
  });
  const mergedActual = mergeConsecutiveEntries(filtered);

  // Effective cutoff
  const todayStr = new Date().toISOString().split('T')[0];
  let maxEntryDate = '';
  for (const e of mergedActual) {
    if (e.date && e.date > maxEntryDate) maxEntryDate = e.date;
  }
  const effectiveCutoff = todayStr > maxEntryDate ? todayStr : maxEntryDate;

  // 2. Holidays
  const holidayEntries = (holidays || []).map(h => {
    if (!h || !h.startDate || !h.endDate) return null;
    const hStart = new Date(h.startDate);
    const hEnd = new Date(h.endDate);
    if (hEnd < yearStart || hStart > yearEnd) return null;
    if (h.startDate > effectiveCutoff) return null;

    const isSingleDay = h.startDate === h.endDate;
    const dateDisplay = isSingleDay
      ? h.startDate
      : (isAr ? `من ${h.startDate} إلى ${h.endDate}` : `Du ${h.startDate} au ${h.endDate}`);

    return {
      id: `hol-${h.id || h.startDate}`,
      classId: cls.id,
      date: h.startDate,
      displayDate: dateDisplay,
      endDate: h.endDate,
      time: '—',
      component: isAr ? 'عطلة مدرسية' : 'Vacances',
      subject: cls.subject || (isAr ? 'الرياضيات' : 'Mathématiques'),
      customContent: isAr ? `=== عطلة مدرسية: ${h.label} ===` : `=== Vacances scolaires : ${h.label} ===`,
      holidayLabel: h.label,
      isHeaderSéance: true,
      isHolidayEntry: true
    };
  }).filter(Boolean);

  // 3. Absences
  const absenceEntries = (absences || []).map(a => {
    if (!a || !a.startDate || !a.endDate) return null;
    const aStart = new Date(a.startDate);
    const aEnd = new Date(a.endDate);
    if (aEnd < yearStart || aStart > yearEnd) return null;
    if (a.startDate > effectiveCutoff) return null;

    const isSingleDay = a.startDate === a.endDate;
    const dateDisplay = isSingleDay
      ? a.startDate
      : (isAr ? `من ${a.startDate} إلى ${a.endDate}` : `Du ${a.startDate} au ${a.endDate}`);

    return {
      id: `abs-${a.id || a.startDate}`,
      classId: cls.id,
      date: a.startDate,
      displayDate: dateDisplay,
      endDate: a.endDate,
      time: '—',
      component: isAr ? 'غياب الأستاذ' : 'Absence Enseignant',
      subject: cls.subject || (isAr ? 'الرياضيات' : 'Mathématiques'),
      customContent: isAr
        ? `=== رخصة / غياب: ${a.type || 'رخصة إدارية'} ===\nالسبب: ${a.reason || 'غير محدد'}`
        : `=== Absence / Congé : ${a.type || 'Autorisation'} ===\nMotif : ${a.reason || 'non spécifié'}`,
      isHeaderSéance: true,
      isAbsenceEntry: true
    };
  }).filter(Boolean);

  // Combine and sort chronologically
  const combined = [...mergedActual, ...holidayEntries, ...absenceEntries];
  combined.sort((a, b) => {
    const diff = (a.date || '').localeCompare(b.date || '');
    if (diff !== 0) return diff;
    return (a.time || '').localeCompare(b.time || '');
  });

  return combined;
}

/**
 * Generates the full master book HTML string containing all 10 official sections.
 */
export function generateMasterLogbookBookHTML({
  classes = [],
  allLogbookEntries = [],
  schedule = {},
  holidays = [],
  absences = [],
  teacherInfo = {},
  styleConfig = {}
}) {
  const academicYear = teacherInfo.profAcademicYear || getAcademicYear();
  const profName = teacherInfo.profName || 'الأستاذ(ة)';
  const profSchool = teacherInfo.profSchool || 'الثانوية التأهيلية';
  const profDirection = teacherInfo.profDirection || 'المديرية الإقليمية';
  const profAcademy = teacherInfo.profAcademy || 'الأكاديمية الجهوية للتربية والتكوين';
  const profSOM = teacherInfo.profSOM || '—';
  const profSubject = teacherInfo.profSubject || 'الرياضيات / Mathématiques';
  const profEmail = teacherInfo.profEmail || '—';
  const profPhone = teacherInfo.profPhone || '—';
  const profCity = teacherInfo.profCity || '—';
  const profCIN = teacherInfo.profCIN || '—';
  const profCadre = teacherInfo.profCadre || 'أستاذ التعليم الثانوي التأهيلي';
  const profGrade = teacherInfo.profGrade || 'الدرجة الأولى (ممتازة)';
  const profEchelon = teacherInfo.profEchelon || '—';

  // Fonts and Styles
  const arFont = styleConfig.arFont || 'Cairo';
  const frFont = styleConfig.frFont || 'Outfit';
  const gridLineHeight = styleConfig.gridLineHeight || 20;
  const showHoraire = styleConfig.showHoraire !== false;
  const showComposant = styleConfig.showComposant !== false;

  // Ensure full Moroccan official holidays fallback
  const effectiveHolidays = (holidays && holidays.length > 0)
    ? holidays
    : getOfficialMoroccanHolidays(academicYear);

  // Total weekly timetable hours
  const totalWeeklyHours = Object.values(schedule || {}).filter(s => s && s.classId).length;

  // Days of week mapping
  const daysOfWeek = [
    { key: 'Lundi', ar: 'الإثنين', fr: 'Lundi' },
    { key: 'Mardi', ar: 'الثلاثاء', fr: 'Mardi' },
    { key: 'Mercredi', ar: 'الأربعاء', fr: 'Mercredi' },
    { key: 'Jeudi', ar: 'الخميس', fr: 'Jeudi' },
    { key: 'Vendredi', ar: 'الجمعة', fr: 'Vendredi' },
    { key: 'Samedi', ar: 'السبت', fr: 'Samedi' }
  ];

  // Time periods
  const timePeriods = [
    { id: '08-09', label: '08h30 - 09h30' },
    { id: '09-10', label: '09h30 - 10h30' },
    { id: '10-11', label: '10h30 - 11h30' },
    { id: '11-12', label: '11h30 - 12h30' },
    { id: '14-15', label: '14h30 - 15h30' },
    { id: '15-16', label: '15h30 - 16h30' },
    { id: '16-17', label: '16h30 - 17h30' },
    { id: '17-18', label: '17h30 - 18h30' }
  ];

  // Dynamic target audience text based on teacher's classes (Collège vs Lycée)
  const hasQualifiant = classes.some(c => !c.level || c.level.includes('bac') || c.level.includes('tc') || c.level.includes('qualif') || c.level.includes('common_core'));
  const hasCollege = classes.some(c => c.level && (c.level.includes('ac') || c.level.includes('coll')));
  let levelTargetText = 'لأساتذة التعليم الثانوي التأهيلي';
  if (hasCollege && !hasQualifiant) {
    levelTargetText = 'لأساتذة التعليم الثانوي الإعدادي';
  } else if (hasCollege && hasQualifiant) {
    levelTargetText = 'لأساتذة التعليم الثانوي التأهيلي والإعدادي';
  }

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>دفتر النصوص الشامل — ${esc(profName)} — الموسم الدراسي ${esc(academicYear)}</title>
  
  <!-- Official Fonts & French handwriting cursive fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Outfit:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700&family=Architects+Daughter&family=Caveat:wght@400;500;600;700&family=Dancing+Script:wght@400;600;700&family=Indie+Flower&family=Kalam:wght@400;700&family=Marck+Script&family=Patrick+Hand&family=Aref+Ruqaa:wght@400;700&display=swap" rel="stylesheet">
  
  <!-- KaTeX CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">

  <style>
    /* Reset & Base Book Styles */
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      background: #e2e8f0;
      color: #0f172a;
      font-family: 'Cairo', '${arFont}', sans-serif;
      font-size: 11.5px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Screen Reader Book Canvas */
    @media screen {
      .book-container {
        max-width: 212mm;
        margin: 20px auto 60px auto;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .book-page {
        background: #ffffff;
        box-shadow: 0 4px 30px rgba(15, 23, 42, 0.15);
        border-radius: 4px;
        padding: 16mm 14mm;
        min-height: 297mm;
        position: relative;
        box-sizing: border-box;
      }
    }

    /* Print Setup */
    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm 10mm 12mm 10mm;
      }
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      #bookActionBar {
        display: none !important;
      }
      .book-container {
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
      }
      .book-page {
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        min-height: auto !important;
        page-break-before: always !important;
        break-before: page !important;
      }
      .book-page:first-child {
        page-break-before: avoid !important;
        break-before: avoid !important;
      }
      .no-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .page-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
      }
    }

    /* Column visibility toggles */
    body.hide-horaire .col-horaire { display: none !important; }
    body.hide-composant .col-composant { display: none !important; }
    body.hide-horaire:not(.hide-composant) .col-activity { width: 68% !important; }
    body.hide-composant:not(.hide-horaire) .col-activity { width: 68% !important; }
    body.hide-horaire.hide-composant .col-activity { width: 78% !important; }

    /* Moroccan Inspection Notebook Master Cover */
    #sec-cover {
      background: #ffffff !important;
      position: relative !important;
      overflow: hidden !important;
      min-height: 297mm !important;
      height: 297mm !important;
      max-height: 297mm !important;
      padding: 0 !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }
    @media print {
      #sec-cover {
        min-height: 297mm !important;
        height: 297mm !important;
        max-height: 297mm !important;
        page-break-before: avoid !important;
        break-before: avoid !important;
        page-break-after: always !important;
        break-after: page !important;
      }
    }
    .cover-top-left-decor {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      pointer-events: none;
    }
    .cover-bottom-right-decor {
      position: absolute;
      bottom: 0;
      right: 0;
      z-index: 1;
      pointer-events: none;
    }
    .cover-inner-content {
      position: relative;
      z-index: 10;
      height: 100%;
      min-height: 297mm;
      padding: 18mm 18mm 14mm 18mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
    }

    /* Moroccan Ornate Borders */
    .moroccan-double-frame {
      border: 4px double #1e3a8a;
      border-radius: 8px;
      padding: 16px;
      position: relative;
      background: #ffffff;
    }
    .moroccan-double-frame::before {
      content: '';
      position: absolute;
      top: 4px; left: 4px; right: 4px; bottom: 4px;
      border: 1px solid rgba(217, 119, 6, 0.45);
      border-radius: 6px;
      pointer-events: none;
    }

    /* Official Ministry Header */
    .ministry-header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 9.5px;
      color: #1e293b;
    }
    .ministry-header-table td {
      border: none !important;
      padding: 2px 4px !important;
      vertical-align: middle;
    }

    /* Badges & Tables */
    .official-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 10px;
    }
    .official-table th {
      background: #f1f5f9;
      color: #0f2942;
      border: 1px solid #94a3b8;
      padding: 6px 4px;
      font-weight: 800;
      text-align: center;
    }
    .official-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 6px;
      vertical-align: middle;
    }

    /* Notebook Seyès / Ruled Lines */
    .ruled-notebook-area {
      background: repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 25px,
        #cbd5e1 26px
      );
      min-height: 380px;
      line-height: 26px;
      padding: 0 8px;
      font-family: 'Amiri', serif;
      font-size: 13px;
      color: #1e3a8a;
    }

    /* Signatures Block */
    .signatures-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1.5px dashed #cbd5e1;
    }
    .signature-card {
      flex: 1;
      border: 1px solid #94a3b8;
      border-radius: 6px;
      padding: 8px 6px 36px 6px;
      text-align: center;
      background: #fafafa;
      font-size: 9.5px;
      font-weight: 700;
      color: #1e293b;
    }

    /* Section Divider Page */
    .class-divider-box {
      border: 3px double #1e3a8a;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Interactive screen action bar */
    #bookActionBar {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 999999;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 24px;
      box-shadow: 0 4px 25px rgba(0,0,0,0.4);
      gap: 12px;
      font-family: 'Cairo', sans-serif;
    }
  </style>
</head>
<body>

  <!-- Top Interactive Action Bar (Screen Only) -->
  <div id="bookActionBar">
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="font-size:1.3rem;">📚</span>
      <div>
        <div style="font-weight:900;font-size:0.95rem;color:#f8fafc;">
          دفتر النصوص الشامل — كتاب جميع الأقسام (${classes.length} أقسام)
        </div>
        <div style="font-size:0.75rem;color:#94a3b8;">
          المملكة المغربية • ${esc(profName)} • ${esc(academicYear)}
        </div>
      </div>
    </div>

    <!-- Quick Jump Selector -->
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <select id="jumpSelect" onchange="scrollToSection(this.value)" style="
        background: rgba(255,255,255,0.12);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.25);
        border-radius: 8px;
        padding: 6px 12px;
        font-family: inherit;
        font-size: 0.8rem;
        cursor: pointer;
      ">
        <option value="sec-cover" style="color:#000;">📖 الغلاف والصفحة التقديمية</option>
        <option value="sec-anthem" style="color:#000;">🇲🇦 النشيد الوطني المغربي</option>
        <option value="sec-teacher-id" style="color:#000;">👤 بطاقة معلومات الأستاذ(ة)</option>
        <option value="sec-timetable" style="color:#000;">⏱️ استعمال الزمن الأسبوعي</option>
        <option value="sec-holidays" style="color:#000;">🌴 لائحة العطل المدرسية</option>
        <option value="sec-diagnostic" style="color:#000;">📝 تقرير التقويم التشخيصي</option>
        <option value="sec-programs" style="color:#000;">📑 فهرس وتوزيع المقررات</option>
        ${classes.map((c, i) => `
          <option value="sec-class-${c.id}" style="color:#000;">📓 سجل حصص: ${esc(c.name)}</option>
          <option value="sec-roster-${c.id}" style="color:#000;">👥 لائحة تلاميذ: ${esc(c.name)}</option>
        `).join('')}
        <option value="sec-absences" style="color:#000;">📋 الرخص وملاحظات المفتش</option>
      </select>

      <button onclick="toggleHoraire()" style="
        background: rgba(255,255,255,0.12);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.25);
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
      ">
        ⏱️ التوقيت
      </button>

      <button onclick="toggleComposant()" style="
        background: rgba(255,255,255,0.12);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.25);
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
      ">
        🏷️ المكون
      </button>

      <button onclick="window.print()" style="
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 7px 22px;
        font-size: 0.88rem;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(16,185,129,0.4);
      ">
        🖨️ طباعة الكتاب كاملاً (PDF)
      </button>

      <button onclick="window.close()" style="
        background: rgba(255,255,255,0.12);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.25);
        border-radius: 8px;
        padding: 6px 14px;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
      ">
        ✕ إغلاق
      </button>
    </div>
  </div>

  <div class="book-container">

    <!-- =========================================================================
         PAGE 1: الغلاف الخارجي التقديمي الفاخر (OFFICIAL MOROCCAN INSPECTION NOTEBOOK COVER)
         ========================================================================= -->
    <div id="sec-cover" class="book-page">
      <!-- Top-Left 3D Faceted Triangles + 'طبعة جديدة' Badge -->
      <div class="cover-top-left-decor">
        ${COVER_TOP_LEFT_SVG}
      </div>

      <!-- Bottom-Right 3D Low-Poly Faceted Pyramids & Floating Crystals -->
      <div class="cover-bottom-right-decor">
        ${COVER_BOTTOM_RIGHT_SVG}
      </div>

      <!-- Main Cover Content Area -->
      <div class="cover-inner-content">
        
        <!-- Top Row: Official Ministry Hierarchy Header (Right-Aligned) -->
        <div style="display: flex; justify-content: flex-end; align-items: flex-start; width: 100%;">
          <div style="width: 290px; text-align: center; font-size: 11px; line-height: 1.55; color: #1e293b; font-family: 'Cairo', 'Amiri', serif;">
            <div style="margin-bottom: 6px;">
              ${MOROCCAN_EMBLEM_SVG}
            </div>
            <div style="font-weight: 800; font-size: 11.5px; color: #0f172a; margin-top: 2px;">
              المملكة المغربية
            </div>
            <div style="font-weight: 800; font-size: 11px; color: #1e293b; margin-top: 2px; line-height: 1.45;">
              وزارة التربية الوطنية والتكوين المهني<br>والتعليم العالي والبحث العلمي
            </div>
            <div style="font-size: 10.5px; font-weight: 700; color: #334155; margin-top: 6px;">
              الأكاديمية الجهوية للتربية والتكوين
            </div>
            <div style="font-size: 10.5px; color: #334155; margin-top: 3px; display: flex; justify-content: center; align-items: baseline; gap: 4px;">
              <span>لجهة:</span>
              ${profAcademy && profAcademy !== 'الأكاديمية الجهوية للتربية والتكوين'
      ? `<strong style="color: #0f172a; border-bottom: 1px dotted #64748b; padding: 0 6px;">${esc(profAcademy)}</strong>`
      : '<span style="letter-spacing: 1.5px; color: #64748b;">...............................................</span>'}
            </div>
            <div style="font-size: 10.5px; color: #334155; margin-top: 3px; display: flex; justify-content: center; align-items: baseline; gap: 4px;">
              <span>المديرية الإقليمية:</span>
              ${profDirection && profDirection !== 'المديرية الإقليمية'
      ? `<strong style="color: #0f172a; border-bottom: 1px dotted #64748b; padding: 0 6px;">${esc(profDirection)}</strong>`
      : '<span style="letter-spacing: 1.5px; color: #64748b;">...................................</span>'}
            </div>
          </div>
        </div>

        <!-- Upper-Middle Banner: Curriculum Standard -->
        <div style="text-align: center; margin: 26px 0 10px 0;">
          <div style="font-family: 'Cairo', sans-serif; font-size: 13.5px; font-weight: 800; color: #1e293b; letter-spacing: 0.01em;">
            وفق برامج ومناهج وزارة التربية الوطنية والتكوين المهني والتعليم العالي والبحث العلمي
          </div>
        </div>

        <!-- Centerpiece Title & Subtitles -->
        <div style="text-align: center; margin: 35px 0 20px 0;">
          <h1 style="font-family: 'Amiri', 'Cairo', serif; font-size: 70px; font-weight: 900; color: #9b2216; margin: 0; line-height: 1.1; letter-spacing: -0.01em; text-shadow: 0 2px 6px rgba(155, 34, 22, 0.15);">
            دفتر النصوص
          </h1>
          <div style="font-family: 'Cairo', sans-serif; font-size: 28px; font-weight: 900; color: #0f172a; margin-top: 16px; letter-spacing: 0.01em;">
            ${levelTargetText}
          </div>
          <div style="font-family: 'Cairo', sans-serif; font-size: 21px; font-weight: 800; color: #1e293b; margin-top: 24px;">
            خاص بالتعليم العمومي والخصوصي
          </div>
        </div>

        <!-- Bottom Row: Publisher Emblem & Teacher Metadata Card (Left-Aligned) -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; padding-bottom: 4px;">
          <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 320px;">
            ${COVER_PUBLISHER_LOGO_SVG}

            <!-- Elegant Official Teacher Profile Card -->
            <div style="background: rgba(255,255,255,0.95); border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; font-size: 10.5px; line-height: 1.6; width: 100%; box-shadow: 0 3px 12px rgba(0,0,0,0.04); text-align: right; box-sizing: border-box;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
                <span style="color: #64748b; font-weight: 700;">الأستاذ(ة):</span>
                <strong style="color: #0f2942; font-size: 11.5px;">${esc(profName)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
                <span style="color: #64748b; font-weight: 700;">المادة:</span>
                <strong style="color: #9b2216;">${esc(profSubject)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
                <span style="color: #64748b; font-weight: 700;">المؤسسة:</span>
                <strong style="color: #1e293b;">${esc(profSchool)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b; font-weight: 700;">الموسم الدراسي:</span>
                <strong style="color: #047857; font-weight: 900;">${esc(academicYear)}</strong>
              </div>
            </div>
          </div>

          <!-- Spacer on the right so the 3D low-poly faceted pyramids remain unobstructed -->
          <div style="width: 260px; height: 10px;"></div>
        </div>

      </div>
    </div>


    <!-- =========================================================================
         PAGE 2: النشيد الوطني المغربي وشعار المملكة (NATIONAL ANTHEM PAGE)
         ========================================================================= -->
    <div id="sec-anthem" class="book-page">
      <div class="moroccan-double-frame" style="min-height:265mm;display:flex;flex-direction:column;justify-content:space-between;text-align:center;padding:26px 24px;">
        
        <div>
          <div style="display:flex;justify-content:center;margin-bottom:8px;">
            ${MOROCCAN_EMBLEM_SVG}
          </div>
          <h2 style="font-family:'Amiri', serif;font-size:2rem;font-weight:900;color:#0f2942;margin:0;">
            النَّشِيدُ الوَطَنِيُّ المَغْرِبِيُّ
          </h2>
          <div style="font-size:10px;font-weight:700;color:#d97706;letter-spacing:0.1em;margin-top:2px;">
            HYMNE NATIONAL DU ROYAUME DU MAROC
          </div>
          <div style="width:120px;height:2px;background:#d97706;margin:10px auto;"></div>
        </div>

        <!-- Moroccan Anthem Poetic Grid (Diacritics Complete) -->
        <div style="max-width:540px;margin:10px auto;width:100%;background:rgba(248,250,252,0.85);border:1.5px solid #cbd5e1;border-radius:12px;padding:20px 24px;">
          <table style="width:100%;border-collapse:collapse;font-family:'Amiri', serif;font-size:1.22rem;font-weight:700;color:#0f2942;line-height:2.1;">
            <tr>
              <td style="width:48%;text-align:right;">مَنْبِتَ الأَحْرَار</td>
              <td style="width:4%;text-align:center;color:#d97706;">✦</td>
              <td style="width:48%;text-align:left;">مَشْرِقَ الأَنْوَار</td>
            </tr>
            <tr>
              <td style="text-align:right;">مُنْتَدَى السُّؤْدَدِ وَحِمَاه</td>
              <td style="text-align:center;color:#d97706;">✦</td>
              <td style="text-align:left;">دُمْتَ مُنْتَدَاهُ وَحِمَاه</td>
            </tr>
            <tr>
              <td style="text-align:right;">عِشْتَ فِي الأَوْطَان</td>
              <td style="text-align:center;color:#d97706;">✦</td>
              <td style="text-align:left;">لِلْعُلا عُنْوَان</td>
            </tr>
            <tr>
              <td style="text-align:right;">مِلْءَ كُلِّ جَنَان</td>
              <td style="text-align:center;color:#d97706;">✦</td>
              <td style="text-align:left;">ذِكْرَى كُلِّ لِسَان</td>
            </tr>
            <tr>
              <td style="text-align:right;color:#047857;font-weight:900;">بِالرُّوحِ</td>
              <td style="text-align:center;color:#d97706;">✦</td>
              <td style="text-align:left;color:#047857;font-weight:900;">بِالْجَسَد</td>
            </tr>
            <tr>
              <td style="text-align:right;">هَبَّ فَتَاك</td>
              <td style="text-align:center;color:#d97706;">✦</td>
              <td style="text-align:left;">لَبَّى نِدَاك</td>
            </tr>
            <tr>
              <td style="text-align:right;">فِي فَمِي وَفِي دَمِي</td>
              <td style="text-align:center;color:#d97706;">✦</td>
              <td style="text-align:left;">هَوَاكَ ثَارَ نُور وَنَار</td>
            </tr>
            <tr>
              <td style="text-align:right;">إِخْوَتِي هَيَّا</td>
              <td style="text-align:center;color:#d97706;">✦</td>
              <td style="text-align:left;">لِلْعُلا سَعْيَا</td>
            </tr>
            <tr>
              <td style="text-align:right;">نُشْهِدِ الدُّنْيَا</td>
              <td style="text-align:center;color:#d97706;">✦</td>
              <td style="text-align:left;">أَنَّ هُنَا نَحْيَا</td>
            </tr>
          </table>
        </div>

        <!-- Center Map Silhouette & Sacred Motto -->
        <div>
          ${MOROCCAN_MAP_SVG}
          <div style="margin-top:12px;font-family:'Amiri', serif;font-size:1.8rem;font-weight:900;color:#991b1b;letter-spacing:0.12em;">
            شِـعَـارُنَـا الخَـالِـد: اللَّهُ — الوَطَـن — المَلِـك
          </div>
        </div>

      </div>
    </div>


    <!-- =========================================================================
         PAGE 3: بطاقة المعلومات الشخصية والإدارية والمهنية للأستاذ(ة)
         ========================================================================= -->
    <div id="sec-teacher-id" class="book-page">
      <div class="moroccan-double-frame" style="min-height:265mm;padding:20px;">
        
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e3a8a;padding-bottom:12px;margin-bottom:16px;">
          <div>
            <div style="font-size:10px;font-weight:800;color:#0f2942;">المملكة المغربية • وزارة التربية الوطنية</div>
            <h2 style="font-size:1.35rem;font-weight:900;color:#1e3a8a;margin:2px 0;">
              بطاقة المعلومات الشخصية والإدارية والمهنية للأستاذ(ة)
            </h2>
            <div style="font-size:10px;color:#64748b;">الموسم الدراسي: <strong>${esc(academicYear)}</strong></div>
          </div>
          
          <!-- Photo Box (4x4) -->
          <div style="width:90px;height:105px;border:2px dashed #94a3b8;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8fafc;font-size:9.5px;color:#64748b;text-align:center;padding:4px;">
            <div style="font-size:1.4rem;margin-bottom:2px;">📷</div>
            صورة الأستاذ(ة)<br><span style="font-size:8px;">(Photo 4×4)</span>
          </div>
        </div>

        <!-- Section 1: المعلومات الشخصية -->
        <div style="margin-bottom:14px;">
          <div style="background:#1e3a8a;color:#fff;padding:4px 10px;border-radius:4px;font-weight:800;font-size:10.5px;margin-bottom:6px;">
            أولاً : المعلومات الشخصية (Renseignements Personnels)
          </div>
          <table class="official-table">
            <tr>
              <td style="width:25%;background:#f8fafc;font-weight:700;">الاسم العائلي والشخصي :</td>
              <td style="width:40%;font-weight:900;color:#0f2942;">${esc(profName)}</td>
              <td style="width:15%;background:#f8fafc;font-weight:700;">رقم ب.ت.و (CIN) :</td>
              <td style="width:20%;font-weight:800;">${esc(profCIN)}</td>
            </tr>
            <tr>
              <td style="background:#f8fafc;font-weight:700;">تاريخ ومكان الازدياد :</td>
              <td>...................................................</td>
              <td style="background:#f8fafc;font-weight:700;">الحالة العائلية :</td>
              <td>..............................</td>
            </tr>
            <tr>
              <td style="background:#f8fafc;font-weight:700;">رقم التأجير (PPR / SOM) :</td>
              <td style="font-weight:900;color:#1e3a8a;">${esc(profSOM)}</td>
              <td style="background:#f8fafc;font-weight:700;">الهاتف :</td>
              <td style="font-weight:700;">${esc(profPhone)}</td>
            </tr>
            <tr>
              <td style="background:#f8fafc;font-weight:700;">العنوان الشخصي :</td>
              <td>${esc(profCity)}</td>
              <td style="background:#f8fafc;font-weight:700;">البريد الإلكتروني :</td>
              <td style="font-size:9px;">${esc(profEmail)}</td>
            </tr>
          </table>
        </div>

        <!-- Section 2: المعلومات الإدارية -->
        <div style="margin-bottom:14px;">
          <div style="background:#047857;color:#fff;padding:4px 10px;border-radius:4px;font-weight:800;font-size:10.5px;margin-bottom:6px;">
            ثانياً : المعلومات الإدارية (Situation Administrative)
          </div>
          <table class="official-table">
            <tr>
              <td style="width:25%;background:#f8fafc;font-weight:700;">الإطار :</td>
              <td style="width:40%;font-weight:800;">${esc(profCadre)}</td>
              <td style="width:15%;background:#f8fafc;font-weight:700;">الدرجة والرتبة :</td>
              <td style="width:20%;font-weight:800;">${esc(profGrade)} ${profEchelon !== '—' ? `(الرتبة: ${esc(profEchelon)})` : ''}</td>
            </tr>
            <tr>
              <td style="background:#f8fafc;font-weight:700;">تاريخ أول توظيف :</td>
              <td>...................................................</td>
              <td style="background:#f8fafc;font-weight:700;">تاريخ الترسيم :</td>
              <td>..............................</td>
            </tr>
            <tr>
              <td style="background:#f8fafc;font-weight:700;">الأكاديمية الجهوية :</td>
              <td style="font-weight:800;">${esc(profAcademy)}</td>
              <td style="background:#f8fafc;font-weight:700;">المديرية الإقليمية :</td>
              <td style="font-weight:800;">${esc(profDirection)}</td>
            </tr>
            <tr>
              <td style="background:#f8fafc;font-weight:700;">تاريخ التعيين بالمؤسسة :</td>
              <td>...................................................</td>
              <td style="background:#f8fafc;font-weight:700;">مقر العمل السابق :</td>
              <td>..............................</td>
            </tr>
          </table>
        </div>

        <!-- Section 3: المعلومات المهنية والتربوية -->
        <div style="margin-bottom:14px;">
          <div style="background:#d97706;color:#fff;padding:4px 10px;border-radius:4px;font-weight:800;font-size:10.5px;margin-bottom:6px;">
            ثالثاً : المعلومات المهنية والتربوية (Profil Professionnel & Pédagogique)
          </div>
          <table class="official-table">
            <tr>
              <td style="width:25%;background:#f8fafc;font-weight:700;">المؤسسة الحالية :</td>
              <td style="width:40%;font-weight:900;">${esc(profSchool)}</td>
              <td style="width:15%;background:#f8fafc;font-weight:700;">مادة التدريس :</td>
              <td style="width:20%;font-weight:900;color:#047857;">${esc(profSubject)}</td>
            </tr>
            <tr>
              <td style="background:#f8fafc;font-weight:700;">مركز التكوين وتاريخ التخرج :</td>
              <td>...................................................</td>
              <td style="background:#f8fafc;font-weight:700;">ساعات العمل أسبوعياً :</td>
              <td style="font-weight:900;color:#1e3a8a;">${totalWeeklyHours || '21'} ساعة / أسبوع</td>
            </tr>
            <tr>
              <td style="background:#f8fafc;font-weight:700;">الأقسام المسندة ومجموعها :</td>
              <td colspan="3">
                <strong>${classes.length} أقسام :</strong> 
                ${classes.map(c => `${c.name} (${getLevelDisplayName(c.level, true)})`).join(' • ')}
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;font-weight:700;">تاريخ ونقطة آخر تفتيش :</td>
              <td>...................................................</td>
              <td style="background:#f8fafc;font-weight:700;">المفتش(ة) التربوي(ة) :</td>
              <td>..............................</td>
            </tr>
          </table>
        </div>

        <!-- Signatures Block -->
        <div class="signatures-row" style="margin-top:28px;">
          <div class="signature-card">
            توقيع السيد(ة) الأستاذ(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">Signature de l'Enseignant(e)</span>
          </div>
          <div class="signature-card">
            تأشيرة وخاتم السيد(ة) رئيس(ة) المؤسسة<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">Visa du Chef d'Établissement</span>
          </div>
        </div>

      </div>
    </div>


    <!-- =========================================================================
         PAGE 4: جدول استعمال الزمن الأسبوعي للأستاذ(ة)
         ========================================================================= -->
    <div id="sec-timetable" class="book-page">
      <div class="moroccan-double-frame" style="min-height:265mm;padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
        
        <div>
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a8a;padding-bottom:10px;margin-bottom:16px;">
            <div>
              <div style="font-size:10px;font-weight:800;color:#0f2942;">وزارة التربية الوطنية • الأكاديمية الجهوية: ${esc(profAcademy)}</div>
              <h2 style="font-size:1.35rem;font-weight:900;color:#1e3a8a;margin:2px 0;">
                جدول استعمال الزمن الأسبوعي للأستاذ(ة)
              </h2>
              <div style="font-size:10px;color:#64748b;">
                الأستاذ(ة): <strong>${esc(profName)}</strong> • المادة: <strong>${esc(profSubject)}</strong> • الموسم: <strong>${esc(academicYear)}</strong>
              </div>
            </div>
            <div style="text-align:left;font-size:11px;font-weight:800;color:#047857;">
              الغلاف الزمني: <strong>${totalWeeklyHours || '21'} ساعة أسبوعية</strong>
            </div>
          </div>

          <!-- Weekly Schedule Grid -->
          <table class="official-table" style="font-size:9.5px;text-align:center;">
            <thead>
              <tr>
                <th style="width:12%;background:#1e3a8a;color:#fff;">اليوم / الفترات</th>
                ${timePeriods.map(p => `
                  <th style="width:11%;background:#f1f5f9;color:#0f2942;font-weight:800;">${p.label}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${daysOfWeek.map(d => `
                <tr style="height:44px;">
                  <td style="background:#f8fafc;font-weight:900;color:#1e3a8a;border-left:2px solid #1e3a8a;">
                    ${d.ar}<br><span style="font-size:8px;color:#64748b;font-weight:600;">${d.fr}</span>
                  </td>
                  ${timePeriods.map(p => {
        const slotKey = `${d.key}-${p.id}`;
        const slotData = schedule[slotKey];
        if (!slotData || !slotData.classId) {
          return `<td style="color:#cbd5e1;font-weight:300;">—</td>`;
        }
        const matchingClass = classes.find(c => c.id === slotData.classId || c.name === slotData.classId);
        const className = matchingClass ? matchingClass.name : slotData.classId;
        return `
                      <td style="background:#e0f2fe;border:1px solid #7dd3fc;color:#0369a1;padding:4px 2px;">
                        <div style="font-weight:900;font-size:10px;">${esc(className)}</div>
                        ${slotData.room ? `<div style="font-size:8px;color:#0284c7;">قاعة: ${esc(slotData.room)}</div>` : ''}
                      </td>
                    `;
      }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Timetable Notes -->
          <div style="margin-top:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;font-size:9.5px;color:#475569;">
            📌 <strong>تنبيه إداري:</strong> يلتزم السيد(ة) الأستاذ(ة) باحترام الحصص المحددة في جدول استعمال الزمن أعلاه وتوثيق الأنشطة المنجزة في حينها بكل دقة.
          </div>
        </div>

        <!-- Three Official Signatures Block -->
        <div class="signatures-row" style="margin-top:20px;">
          <div class="signature-card">
            توقيع السيد(ة) الأستاذ(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">L'Enseignant(e)</span>
          </div>
          <div class="signature-card">
            تأشيرة وخاتم السيد(ة) المدير(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">Le Chef d'Établissement</span>
          </div>
          <div class="signature-card">
            تأشيرة وخاتم السيد(ة) المفتش(ة) التربوي(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">L'Inspecteur Pédagogique</span>
          </div>
        </div>

      </div>
    </div>


    <!-- =========================================================================
         PAGE 5: لائحة العطل المدرسية الرسمية
         ========================================================================= -->
    <div id="sec-holidays" class="book-page">
      <div class="moroccan-double-frame" style="min-height:265mm;padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
        
        <div>
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #047857;padding-bottom:10px;margin-bottom:14px;">
            <div>
              <div style="font-size:10px;font-weight:800;color:#0f2942;">المملكة المغربية • وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
              <h2 style="font-size:1.35rem;font-weight:900;color:#047857;margin:2px 0;">
                لائحة العطل المدرسية المقررة برسم الموسم الدراسي ${esc(academicYear)}
              </h2>
              <div style="font-size:10px;color:#64748b;">
                بمقتضى المقرر الوزاري لتنظيم السنة الدراسية ${esc(academicYear)}
              </div>
            </div>
            <div style="font-size:1.6rem;">🌴</div>
          </div>

          <!-- Holidays Table -->
          <table class="official-table" style="font-size:9.5px;">
            <thead>
              <tr style="background:#047857;color:#fff;">
                <th style="width:6%;background:#047857;color:#fff;">الرقم</th>
                <th style="width:38%;background:#047857;color:#fff;text-align:right;padding-right:8px;">العطلة المدرسية / المناسبة</th>
                <th style="width:20%;background:#047857;color:#fff;">تاريخ البداية</th>
                <th style="width:20%;background:#047857;color:#fff;">تاريخ النهاية</th>
                <th style="width:16%;background:#047857;color:#fff;">عدد الأيام</th>
              </tr>
            </thead>
            <tbody>
              ${effectiveHolidays.map((h, idx) => {
        const s = new Date(h.startDate);
        const e = new Date(h.endDate);
        const diffDays = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
        return `
                  <tr>
                    <td style="text-align:center;font-weight:700;color:#64748b;">${idx + 1}</td>
                    <td style="font-weight:800;color:#0f2942;text-align:right;padding-right:8px;">${esc(h.label)}</td>
                    <td style="text-align:center;font-weight:600;">${esc(h.startDate)}</td>
                    <td style="text-align:center;font-weight:600;">${esc(h.endDate)}</td>
                    <td style="text-align:center;font-weight:900;color:#047857;">${diffDays} ${diffDays === 1 ? 'يوم' : 'أيام'}</td>
                  </tr>
                `;
      }).join('')}
            </tbody>
          </table>

          <div style="margin-top:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;display:flex;justify-content:space-between;font-size:10px;font-weight:800;color:#1e3a8a;">
            <span>مجموع العطل المبرمجة : ${effectiveHolidays.length} عطلة رسمية</span>
            <span>تراعى التعديلات الطارئة أو الدينية بحسب ثبوت رؤية الهلال</span>
          </div>
        </div>

        <!-- Three Official Signatures Block -->
        <div class="signatures-row" style="margin-top:20px;">
          <div class="signature-card">
            توقيع السيد(ة) الأستاذ(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">L'Enseignant(e)</span>
          </div>
          <div class="signature-card">
            تأشيرة وخاتم السيد(ة) المدير(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">Le Chef d'Établissement</span>
          </div>
          <div class="signature-card">
            تأشيرة وخاتم السيد(ة) المفتش(ة) التربوي(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">L'Inspecteur Pédagogique</span>
          </div>
        </div>

      </div>
    </div>


    <!-- =========================================================================
         PAGE 6: تقرير التقويم التشخيصي والدعم الاستدراكي
         ========================================================================= -->
    <div id="sec-diagnostic" class="book-page">
      <div class="moroccan-double-frame" style="min-height:265mm;padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
        
        <div>
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a8a;padding-bottom:10px;margin-bottom:14px;">
            <div>
              <div style="font-size:10px;font-weight:800;color:#0f2942;">المملكة المغربية • وزارة التربية الوطنية</div>
              <h2 style="font-size:1.35rem;font-weight:900;color:#1e3a8a;margin:2px 0;">
                تقرير التقويم التشخيصي وأنشطة الدعم الاستدراكي
              </h2>
              <div style="font-size:10px;color:#64748b;">
                الأستاذ(ة): <strong>${esc(profName)}</strong> • المادة: <strong>${esc(profSubject)}</strong> • الموسم الدراسي: <strong>${esc(academicYear)}</strong>
              </div>
            </div>
            <div style="font-size:1.6rem;">📝</div>
          </div>

          <!-- Structured Pedagogical Overview Box -->
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:10px;line-height:1.6;">
            <div style="font-weight:900;color:#1e3a8a;margin-bottom:4px;">📌 العناصر البيداغوجية الأساسية للتقرير :</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div>• <strong>أهداف التقويم :</strong> تشخيص المكتسبات القبلية وتحديد مواطن القوة والتعثر.</div>
              <div>• <strong>المجالات المقومة :</strong> الحساب العددي، الجبر، الدوال، الهندسة، وحل المسائل.</div>
              <div>• <strong>خطة الدعم المعتمدة :</strong> ورشات معالجة جماعية وفردية، تمارين داعمة وبطاقات تقوية.</div>
              <div>• <strong>أثر المعالجة :</strong> تحسين جاهزية المتعلمات والمتعلمين لولوج برنامج المستوى الجديد.</div>
            </div>
          </div>

          <!-- Ruled Lined Notebook Sheet for Handwriting or Inspection Record -->
          <div style="font-weight:800;font-size:10.5px;color:#0f2942;margin-bottom:6px;">
            نص التقرير التركيبي وملاحظات الإنجاز :
          </div>
          <div class="ruled-notebook-area" style="min-height:340px;">
            <!-- Official lines ready for writing -->
          </div>
        </div>

        <!-- Three Official Signatures Block -->
        <div class="signatures-row" style="margin-top:20px;">
          <div class="signature-card">
            توقيع السيد(ة) الأستاذ(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">L'Enseignant(e)</span>
          </div>
          <div class="signature-card">
            تأشيرة وخاتم السيد(ة) المدير(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">Le Chef d'Établissement</span>
          </div>
          <div class="signature-card">
            تأشيرة وخاتم السيد(ة) المفتش(ة) التربوي(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">L'Inspecteur Pédagogique</span>
          </div>
        </div>

      </div>
    </div>


    <!-- =========================================================================
         PAGE 7: فهرس البرامج والتوزيع السنوي للمقررات
         ========================================================================= -->
    <div id="sec-programs" class="book-page">
      <div class="moroccan-double-frame" style="min-height:265mm;padding:20px;">
        
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a8a;padding-bottom:10px;margin-bottom:14px;">
          <div>
            <div style="font-size:10px;font-weight:800;color:#0f2942;">المملكة المغربية • وزارة التربية الوطنية</div>
            <h2 style="font-size:1.35rem;font-weight:900;color:#1e3a8a;margin:2px 0;">
              فهرس وتوزيع المقررات الدراسية السنوية للأقسام المسندة
            </h2>
            <div style="font-size:10px;color:#64748b;">
              الموسم الدراسي: <strong>${esc(academicYear)}</strong> • مجموع الأقسام المسندة: <strong>${classes.length}</strong>
            </div>
          </div>
          <div style="font-size:1.6rem;">📑</div>
        </div>

        <!-- Programs for each class -->
        ${classes.map(cls => {
        const prog = (cls.program && cls.program.length > 0) ? cls.program : [];
        return `
            <div style="margin-bottom:16px;border:1px solid #cbd5e1;border-radius:8px;padding:10px;background:#fafafa;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-weight:900;font-size:11.5px;color:#0f2942;">
                  قسم: <strong>${esc(cls.name)}</strong> (${esc(getLevelDisplayName(cls.level, true))})
                </span>
                <span style="font-size:9.5px;color:#64748b;background:#e2e8f0;padding:2px 8px;border-radius:4px;font-weight:700;">
                  عدد المحاور: ${prog.length}
                </span>
              </div>

              ${prog.length > 0 ? `
                <table class="official-table" style="font-size:9px;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="width:8%;">رقم</th>
                      <th style="width:48%;text-align:right;padding-right:8px;">عنوان الدرس / المحور المبرمج</th>
                      <th style="width:20%;">المكون</th>
                      <th style="width:24%;">حالة الإنجاز والتقدم</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${prog.map((item, pIdx) => `
                      <tr>
                        <td style="text-align:center;font-weight:700;color:#64748b;">${pIdx + 1}</td>
                        <td style="font-weight:800;color:#1e293b;text-align:right;padding-right:8px;">${esc(item.title)}</td>
                        <td style="text-align:center;font-weight:600;color:#64748b;">${esc(item.type || 'درس / تمارين')}</td>
                        <td style="text-align:center;font-weight:800;color:#047857;">
                          ${item.covered ? '✓ مُنجز بالكامل' : 'قيد الإنجاز / مبرمج'}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div style="padding:10px;text-align:center;color:#94a3b8;font-size:10px;">
                  — لم يتم ضبط برنامج مخصص لهذا القسم بعد (يتم الاعتماد على التوزيع السنوي الرسمي للوزارة) —
                </div>
              `}
            </div>
          `;
      }).join('')}

      </div>
    </div>


    <!-- =========================================================================
         SECTION 8: سجل الحصص والأنشطة اليومية لكل قسم (LOGBOOK ENTRIES PER CLASS)
         ========================================================================= -->
    ${classes.map(cls => {
        const isArMode = Boolean(
          cls.language === 'ar' ||
          cls.isArabic ||
          (cls.name && cls.name.includes('عرب')) ||
          (cls.level && cls.level.includes('arts'))
        );
        const dir = isArMode ? 'rtl' : 'ltr';
        const align = isArMode ? 'right' : 'left';
        const mainFont = isArMode ? arFont : frFont;

        const classEntries = buildClassLogbookRows(cls, allLogbookEntries, effectiveHolidays, absences, academicYear);

        // Render table rows
        const rowsHtml = classEntries.length > 0
          ? classEntries.flatMap(e => {
            const isHolidayOrAbsence = e.isHolidayEntry || e.isAbsenceEntry;
            const signatureText = isHolidayOrAbsence ? '—' : (isArMode ? 'موقّع' : 'Signé');
            const signatureStyle = isHolidayOrAbsence ? 'color:#94a3b8;font-style:italic;' : 'color:#10b981;font-weight:bold;font-size:0.75rem;';
            const componentText = getTranslatedComponent(e.component, isArMode);
            const dateText = e.displayDate
              ? (e.displayDate.includes('من') || e.displayDate.includes('Du')
                ? esc(e.displayDate)
                : new Date(e.date).toLocaleDateString('fr-FR'))
              : (e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '');

            if (isHolidayOrAbsence) {
              const bg = e.isHolidayEntry ? '#ecfdf5' : '#fffbeb';
              const border = e.isHolidayEntry ? '#a7f3d0' : '#fde68a';
              const color = e.isHolidayEntry ? '#065f46' : '#92400e';
              return `
                <tr class="no-break" style="background:${bg};border-top:1px solid ${border};border-bottom:1px solid ${border};">
                  <td style="text-align:center;font-weight:700;color:${color};padding:8px 4px;vertical-align:middle;">
                    ${dateText}
                  </td>
                  <td class="col-horaire" style="text-align:center;color:#94a3b8;font-style:italic;padding:8px 4px;vertical-align:middle;">—</td>
                  <td class="col-composant" style="text-align:center;font-weight:700;color:${color};padding:8px 4px;vertical-align:middle;">
                    ${esc(componentText)}
                  </td>
                  <td class="col-activity" style="padding:8px 12px;font-weight:800;color:${color};text-align:${align};vertical-align:middle;">
                    ${esc(e.customContent || e.holidayLabel || '')}
                  </td>
                  <td style="text-align:center;color:#94a3b8;padding:8px 4px;vertical-align:middle;">—</td>
                </tr>
              `;
            }

            const rawContent = e.customContent || e.content || '';
            const chunks = chunkActivityContent(rawContent);

            return chunks.map((chunk, cIdx) => {
              const isFirst = cIdx === 0;
              const cellDateHtml = isFirst ? `<strong>${dateText}</strong>` : `<span style="color:#cbd5e1;font-size:0.7rem;">〃</span>`;
              const cellTimeHtml = isFirst ? `<span style="font-weight:700;color:#475569;">${esc(e.time || '—')}</span>` : '';
              const cellCompHtml = isFirst ? `<span style="font-weight:700;color:#2563eb;">${esc(componentText)}</span>` : '';
              const cellSigHtml = isFirst ? signatureText : '';

              return `
                <tr class="no-break" style="border-bottom:${isFirst && chunks.length === 1 ? '1px solid #cbd5e1' : '1px dotted #e2e8f0'};">
                  <td style="width:13%;text-align:center;vertical-align:top;padding:6px 4px;font-size:10px;">
                    ${cellDateHtml}
                  </td>
                  <td class="col-horaire" style="width:10%;text-align:center;vertical-align:top;padding:6px 4px;font-size:10px;">
                    ${cellTimeHtml}
                  </td>
                  <td class="col-composant" style="width:11%;text-align:center;vertical-align:top;padding:6px 4px;font-size:10px;">
                    ${cellCompHtml}
                  </td>
                  <td class="col-activity" style="width:54%;vertical-align:top;padding:6px 8px;direction:${dir};text-align:${align};">
                    ${renderActivityCellHTML(chunk, isFirst ? e.isHeaderSéance : false, isArMode, styleConfig)}
                  </td>
                  <td style="width:12%;text-align:center;vertical-align:top;padding:6px 4px;${signatureStyle}">
                    ${cellSigHtml}
                  </td>
                </tr>
              `;
            });
          }).join('')
          : `
          <!-- Empty Ruled Rows if class has no entries yet -->
          ${[1, 2, 3, 4, 5, 6, 7, 8].map(() => `
            <tr style="height:38px;">
              <td style="border:1px solid #cbd5e1;"></td>
              <td class="col-horaire" style="border:1px solid #cbd5e1;"></td>
              <td class="col-composant" style="border:1px solid #cbd5e1;"></td>
              <td class="col-activity" style="border:1px solid #cbd5e1;"></td>
              <td style="border:1px solid #cbd5e1;"></td>
            </tr>
          `).join('')}
        `;

        return `
        <div id="sec-class-${cls.id}" class="book-page">
          <div class="moroccan-double-frame" style="min-height:265mm;padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
            
            <div>
              <!-- Class Cover Divider Banner -->
              <div class="class-divider-box">
                <div>
                  <div style="font-size:10px;font-weight:800;color:#d97706;letter-spacing:0.1em;text-transform:uppercase;">
                    سجل الأنشطة اليومية • CAHIER DE TEXTES
                  </div>
                  <h2 style="font-size:1.6rem;font-weight:900;color:#0f2942;margin:2px 0;">
                    قسم: ${esc(cls.name)}
                  </h2>
                  <div style="font-size:10.5px;color:#475569;">
                    المستوى: <strong>${esc(getLevelDisplayName(cls.level, isArMode))}</strong> • 
                    عدد التلاميذ: <strong>${cls.studentCount || cls.students?.length || 0}</strong> • 
                    الموسم الدراسي: <strong>${esc(academicYear)}</strong>
                  </div>
                </div>
                <div style="text-align:left;font-family:'Outfit',sans-serif;">
                  <span style="background:#1e3a8a;color:#fff;font-weight:800;padding:6px 14px;border-radius:8px;font-size:11px;">
                    ${esc(cls.name)}
                  </span>
                </div>
              </div>

              <!-- Sessions Table -->
              <table class="official-table" style="font-size:10px;">
                <thead>
                  <tr style="background:#1e3a8a;color:#fff;">
                    <th style="width:13%;background:#1e3a8a;color:#fff;">التاريخ واليوم</th>
                    <th class="col-horaire" style="width:10%;background:#1e3a8a;color:#fff;">التوقيت</th>
                    <th class="col-composant" style="width:11%;background:#1e3a8a;color:#fff;">المكون</th>
                    <th class="col-activity" style="width:54%;background:#1e3a8a;color:#fff;">الأنشطة المنجزة (الدروس والمفاهيم والتمارين والواجبات)</th>
                    <th style="width:12%;background:#1e3a8a;color:#fff;">التأشيرة</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>

            <!-- Periodic Inspector & Director Visa Block -->
            <div class="signatures-row" style="margin-top:24px;">
              <div class="signature-card">
                تأشيرة وملاحظات السيد(ة) رئيس(ة) المؤسسة<br>
                <span style="font-weight:400;color:#64748b;font-size:8.5px;">Visa et observations du Chef d'Établissement</span>
              </div>
              <div class="signature-card">
                تأشيرة وملاحظات السيد(ة) المفتش(ة) التربوي(ة)<br>
                <span style="font-weight:400;color:#64748b;font-size:8.5px;">Visa et observations de l'Inspecteur Pédagogique</span>
              </div>
            </div>

          </div>
        </div>
      `;
      }).join('')}


    <!-- =========================================================================
         SECTION 9: لوائح التلاميذ والتلميذات وشبكات التنقيط لكل قسم
         ========================================================================= -->
    ${classes.map(cls => {
        const studentsList = Array.isArray(cls.students) ? cls.students : [];
        const totalRows = Math.max(studentsList.length, 36);

        return `
        <div id="sec-roster-${cls.id}" class="book-page">
          <div class="moroccan-double-frame" style="min-height:265mm;padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
            
            <div>
              <!-- Header -->
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #d97706;padding-bottom:10px;margin-bottom:14px;">
                <div>
                  <div style="font-size:10px;font-weight:800;color:#0f2942;">المملكة المغربية • وزارة التربية الوطنية</div>
                  <h2 style="font-size:1.35rem;font-weight:900;color:#0f2942;margin:2px 0;">
                    لائحة أسماء التلميذات والتلاميذ وتتبع المراقبة المستمرة
                  </h2>
                  <div style="font-size:10.5px;color:#475569;">
                    قسم: <strong>${esc(cls.name)}</strong> • المستوى: <strong>${esc(getLevelDisplayName(cls.level, true))}</strong> • الموسم الدراسي: <strong>${esc(academicYear)}</strong>
                  </div>
                </div>
                <div style="text-align:left;font-size:11px;font-weight:800;color:#d97706;">
                  العدد الإجمالي: <strong>${studentsList.length || cls.studentCount || '—'} تلميذ(ة)</strong>
                </div>
              </div>

              <!-- Student Roster Grid -->
              <table class="official-table" style="font-size:9px;">
                <thead>
                  <tr style="background:#f1f5f9;color:#0f2942;">
                    <th style="width:4%;">رقم</th>
                    <th style="width:14%;">رقم مسار</th>
                    <th style="width:26%;text-align:right;padding-right:6px;">الاسم والنسب (Nom & Prénom)</th>
                    <th style="width:8%;">ف.م 1</th>
                    <th style="width:8%;">ف.م 2</th>
                    <th style="width:8%;">ف.م 3</th>
                    <th style="width:8%;">ف.م 4</th>
                    <th style="width:8%;">المواظبة</th>
                    <th style="width:8%;">المعدل</th>
                    <th style="width:8%;">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  ${Array.from({ length: totalRows }).map((_, idx) => {
          const st = studentsList[idx];
          const num = idx + 1;
          return `
                      <tr style="height:21px;">
                        <td style="text-align:center;font-weight:700;color:#64748b;">${num}</td>
                        <td style="text-align:center;font-family:'Outfit',sans-serif;font-weight:600;color:#1e3a8a;">
                          ${st?.massarCode || st?.id || ''}
                        </td>
                        <td style="font-weight:800;color:#0f172a;text-align:right;padding-right:6px;">
                          ${st?.name || ''}
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    `;
        }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Roster Footer -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1.5px dashed #cbd5e1;font-size:9.5px;color:#64748b;">
              <span>تأشيرة الأستاذ(ة) : ...................................</span>
              <span>تأشيرة السيد(ة) الحارس(ة) العام(ة) : ...................................</span>
              <span>تأشيرة السيد(ة) المدير(ة) : ...................................</span>
            </div>

          </div>
        </div>
      `;
      }).join('')}


    <!-- =========================================================================
         PAGE 10: غياب الأستاذ(ة) والرخص وملاحظات المفتش التربوي
         ========================================================================= -->
    <div id="sec-absences" class="book-page">
      <div class="moroccan-double-frame" style="min-height:265mm;padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
        
        <div>
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b45309;padding-bottom:10px;margin-bottom:14px;">
            <div>
              <div style="font-size:10px;font-weight:800;color:#0f2942;">المملكة المغربية • وزارة التربية الوطنية</div>
              <h2 style="font-size:1.35rem;font-weight:900;color:#b45309;margin:2px 0;">
                غياب الأستاذ(ة): الرخص الطبية والشخصية
              </h2>
              <div style="font-size:10px;color:#64748b;">
                الأستاذ(ة): <strong>${esc(profName)}</strong> • رقم التأجير: <strong>${esc(profSOM)}</strong> • الموسم الدراسي: <strong>${esc(academicYear)}</strong>
              </div>
            </div>
            <div style="font-size:1.6rem;">📋</div>
          </div>

          <!-- Absences & Leaves Table -->
          <table class="official-table" style="font-size:9.5px;">
            <thead>
              <tr style="background:#b45309;color:#fff;">
                <th style="width:6%;background:#b45309;color:#fff;">الرقم</th>
                <th style="width:20%;background:#b45309;color:#fff;">نوع الغياب</th>
                <th style="width:26%;background:#b45309;color:#fff;">نوع الرخصة</th>
                <th style="width:12%;background:#b45309;color:#fff;">المدة (أيام)</th>
                <th style="width:14%;background:#b45309;color:#fff;">من تاريخ</th>
                <th style="width:14%;background:#b45309;color:#fff;">إلى تاريخ</th>
                <th style="width:8%;background:#b45309;color:#fff;">تأشيرة الإدارة</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: Math.max(absences.length, 8) }).map((_, idx) => {
        const a = absences[idx];
        const s = a?.startDate ? new Date(a.startDate) : null;
        const e = a?.endDate ? new Date(a.endDate) : null;
        const days = (s && e) ? Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1) : '';

        return `
                  <tr style="height:26px;">
                    <td style="text-align:center;font-weight:700;color:#64748b;">${idx + 1}</td>
                    <td style="text-align:center;font-weight:700;">${a?.type ? esc(a.type) : ''}</td>
                    <td style="text-align:center;">${a?.reason ? esc(a.reason) : ''}</td>
                    <td style="text-align:center;font-weight:800;color:#b45309;">${days ? `${days} يوم` : ''}</td>
                    <td style="text-align:center;">${a?.startDate ? esc(a.startDate) : ''}</td>
                    <td style="text-align:center;">${a?.endDate ? esc(a.endDate) : ''}</td>
                    <td></td>
                  </tr>
                `;
      }).join('')}
            </tbody>
          </table>

          <!-- Section 2: ملاحظات وتوجيهات المفتش التربوي -->
          <div style="margin-top:24px;">
            <div style="background:#1e3a8a;color:#fff;padding:6px 12px;border-radius:4px;font-weight:800;font-size:11px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
              <span>ملاحظات وتوجيهات السيد(ة) المفتش(ة) التربوي(ة) والسيد(ة) المدير(ة)</span>
              <span style="font-size:9px;font-weight:600;">(Visites & Directives Pédagogiques)</span>
            </div>
            
            <div class="ruled-notebook-area" style="min-height:260px;">
              <!-- Ruled lines for handwritten inspection advice -->
            </div>
          </div>
        </div>

        <!-- Three Official Signatures Block -->
        <div class="signatures-row" style="margin-top:20px;">
          <div class="signature-card">
            توقيع السيد(ة) الأستاذ(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">L'Enseignant(e)</span>
          </div>
          <div class="signature-card">
            تأشيرة وخاتم السيد(ة) المدير(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">Le Chef d'Établissement</span>
          </div>
          <div class="signature-card">
            تأشيرة وخاتم السيد(ة) المفتش(ة) التربوي(ة)<br>
            <span style="font-weight:400;color:#64748b;font-size:8.5px;">L'Inspecteur Pédagogique</span>
          </div>
        </div>

      </div>
    </div>

  </div>

  <script>
    // Adjust top padding on body for sticky header
    document.body.style.paddingTop = '60px';

    // Quick jump to section
    function scrollToSection(id) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // Toggle Horaire
    function toggleHoraire() {
      document.body.classList.toggle('hide-horaire');
    }

    // Toggle Composant
    function toggleComposant() {
      document.body.classList.toggle('hide-composant');
    }

    // Hide action bar when printing
    const bar = document.getElementById('bookActionBar');
    window.addEventListener('beforeprint', () => { 
      if (bar) bar.style.display = 'none'; 
      document.body.style.paddingTop = '0'; 
    });
    window.addEventListener('afterprint', () => { 
      if (bar) bar.style.display = 'flex'; 
      document.body.style.paddingTop = '60px'; 
    });
  </script>
</body>
</html>
  `;
}

/**
 * Opens a print popup window or triggers download on mobile devices.
 */
export function openMasterLogbookBookPrintWindow({
  classes = [],
  allLogbookEntries = [],
  schedule = {},
  holidays = [],
  absences = [],
  teacherInfo = {},
  styleConfig = {}
}) {
  const html = generateMasterLogbookBookHTML({
    classes,
    allLogbookEntries,
    schedule,
    holidays,
    absences,
    teacherInfo,
    styleConfig
  });

  const academicYear = teacherInfo.profAcademicYear || getAcademicYear();
  const title = `Livre_Cahier_de_Textes_Complet_${academicYear.replace(/[/\\s]/g, '_')}`;

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
  const win = window.open(url, '_blank', 'width=1040,height=850,scrollbars=yes');
  if (!win) {
    URL.revokeObjectURL(url);
    alert('يرجى السماح بالنوافذ المنبثقة (Popups) لمعاينة وطباعة دفتر النصوص الشامل.');
    return;
  }
  win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
}
