// src/pages/AdminLogbook.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Trash2, Edit, Printer, Calendar, BookOpen, Clock, Tag, AlertCircle,
  User, ArrowLeft, FileText, CheckCircle2, ClipboardList, X, Check, Save, Sparkles,
  Eye, EyeOff, Settings, ListOrdered, RefreshCw
} from 'lucide-react';
import { getAllClasses, updateClass, syncLocalClassProgramsToCloud } from '../services/classService';
import { getActiveLessons } from '../services/lessonService';
import { getAllExams } from '../services/examService';
import { 
  getLogbookEntries, addLogbookEntry, updateLogbookEntry, deleteLogbookEntry, syncLocalLogbookToCloud
} from '../services/logbookService';
import { 
  getSchoolHolidaysConfig, 
  saveSchoolHolidaysConfig, 
  getTeacherAbsencesConfig, 
  saveTeacherAbsencesConfig, 
  getTeacherScheduleConfig, 
  saveTeacherScheduleConfig, 
  getLogbookStyleConfig, 
  saveLogbookStyleConfig,
  getOfficialMoroccanHolidays
} from '../services/schoolService';
import { renderWithMath } from '../utils/mathRenderer';
import { openLogbookPrintWindow } from '../utils/generateLogbookPDF';
import { normalizeLevel, getLevelDisplayName } from '../utils/levelHelpers';
import { 
  getMergedDaySessions, 
  mergeConsecutiveEntries, 
  checkTimeOverlap as checkScheduleOverlap,
  parseTimeRange 
} from '../utils/scheduleHelpers';

// Standard Curriculum Templates for Moroccan High School levels
const STANDARD_CURRICULA = {
  common_core_arts: [
    { id: 'prog_tcl_01', type: 'course', title: 'التقويم التشخيصي والدعم الاستدراكي', matchKeywords: ['diagnostique', 'تشخيصي'] },
    { id: 'prog_tcl_02', type: 'course', title: 'الحساب العددي والعمليات في المجموعة IR', matchKeywords: ['révision', 'calcul numérique', 'حساب'] },
    { id: 'prog_tcl_03', type: 'exercises', title: 'سلسلة تمارين: الحساب العددي وقوى الأعداد', matchKeywords: ['série', 'exercices', 'تمارين'] },
    { id: 'prog_tcl_04', type: 'course', title: 'الترتيب في IR والمعادلات والمتراجحات من الدرجة الأولى', matchKeywords: ['ordre', 'équations', 'ترتيب'] },
    { id: 'prog_tcl_05', type: 'exercises', title: 'سلسلة تمارين: المعادلات والمتراجحات وحل المسائل', matchKeywords: ['inéquations', 'متراجحات'] },
    { id: 'prog_tcl_06', type: 'homework', title: 'الفرض المحروس رقم 1 (الدورة الأولى)', matchKeywords: ['devoir 1', 'فرض 1'] },
    { id: 'prog_tcl_07', type: 'course', title: 'الإحصاء: الجداول، الترددات والتمثيلات المبيانية', matchKeywords: ['statistique', 'إحصاء'] },
    { id: 'prog_tcl_08', type: 'exercises', title: 'تطبيقات إحصائية ومميزات الموضع والتشتت', matchKeywords: ['statistiques', 'تشتت'] },
    { id: 'prog_tcl_09', type: 'course', title: 'الهندسة الفضائية: المستقيمات والمستويات وحساب الحجوم', matchKeywords: ['géométrie', 'espace', 'هندسة'] },
    { id: 'prog_tcl_10', type: 'homework', title: 'الفرض المحروس رقم 2 (الدورة الأولى)', matchKeywords: ['devoir 2', 'فرض 2'] },
    { id: 'prog_tcl_11', type: 'homework', title: 'دعم الحصيلة وتقويم نهاية الأسدس الأول', matchKeywords: ['bilan', 'حصيلة'] }
  ],
  common_core_sci: [
    { id: 'prog_tcs_01', type: 'course', title: 'التقويم التشخيصي والدعم الاستدراكي', matchKeywords: ['diagnostique', 'mise à niveau', 'révision'] },
    { id: 'prog_tcs_02', type: 'course', title: 'مبادئ في الحسابيات في المجموعة IN', matchKeywords: ['arithmétique', 'حسابيات', 'ensemble n'] },
    { id: 'prog_tcs_03', type: 'exercises', title: 'سلسلة تمارين: الحسابيات في IN', matchKeywords: ['série', 'arithmétique', 'notion d\'arithmétiques'] },
    { id: 'prog_tcs_04', type: 'course', title: 'الحساب المتجهي في المستوى', matchKeywords: ['vecteurs', 'متجهي', 'متجهات'] },
    { id: 'prog_tcs_05', type: 'homework', title: 'الفرض المحروس رقم 1 (الدورة الأولى)', matchKeywords: ['devoir surveillé n°1', 'فرض 1'] },
    { id: 'prog_tcs_06', type: 'course', title: 'مجموعات الأعداد والحساب العددي في IR', matchKeywords: ['ensembles', 'calcul numérique'] },
    { id: 'prog_tcs_07', type: 'course', title: 'الإسقاط في المستوى', matchKeywords: ['projection', 'إسقاط'] },
    { id: 'prog_tcs_08', type: 'course', title: 'الترتيب في IR ومجالاته', matchKeywords: ['ordre dans r', 'ordre', 'ترتيب'] },
    { id: 'prog_tcs_09', type: 'homework', title: 'الفرض المحروس رقم 2 (الدورة الأولى)', matchKeywords: ['devoir surveillé n°2', 'فرض 2'] },
    { id: 'prog_tcs_10', type: 'course', title: 'المستقيم في المستوى والحدوديات والدوال', matchKeywords: ['droite', 'polynômes', 'fonctions'] },
    { id: 'prog_tcs_11', type: 'homework', title: 'الفرض المحروس رقم 3 (الدورة الأولى)', matchKeywords: ['devoir 3', 'فرض 3'] }
  ],
  '1bac_sci': [
    { id: 'prog_1bs_01', type: 'course', title: 'التقويم التشخيصي وأنشطة التذكير', matchKeywords: ['diagnostique', 'révision'] },
    { id: 'prog_1bs_02', type: 'course', title: 'مبادئ في المنطق الرياضي', matchKeywords: ['logique', 'منطق'] },
    { id: 'prog_1bs_03', type: 'course', title: 'عموميات حول الدوال العددية', matchKeywords: ['généralités', 'fonctions', 'دوال'] },
    { id: 'prog_1bs_04', type: 'homework', title: 'الفرض المحروس رقم 1 (الدورة الأولى)', matchKeywords: ['devoir 1', 'فرض 1'] },
    { id: 'prog_1bs_05', type: 'course', title: 'المتتاليات العددية', matchKeywords: ['suites', 'متتاليات'] },
    { id: 'prog_1bs_06', type: 'course', title: 'المرجح في المستوى', matchKeywords: ['barycentre', 'مرجح'] },
    { id: 'prog_1bs_07', type: 'homework', title: 'الفرض المحروس رقم 2 (الدورة الأولى)', matchKeywords: ['devoir 2', 'فرض 2'] },
    { id: 'prog_1bs_08', type: 'course', title: 'الجداء السلمي وتطبيقاته والحساب المثلثي', matchKeywords: ['produit scalaire', 'trigonométrie'] },
    { id: 'prog_1bs_09', type: 'homework', title: 'الفرض المحروس رقم 3 (الدورة الأولى)', matchKeywords: ['devoir 3', 'فرض 3'] }
  ],
  '2bac_pc_svt': [
    { id: 'prog_2b_01', type: 'course', title: 'التقويم التشخيصي والتذكير بالمكتسبات', matchKeywords: ['diagnostique', 'révision', 'mise à niveau'] },
    { id: 'prog_2b_02', type: 'course', title: 'الاتصال والنهايات', matchKeywords: ['continuité', 'limites', 'اتصال', 'نهايات'] },
    { id: 'prog_2b_03', type: 'exercises', title: 'سلسلة تمارين: الاتصال وحساب النهايات', matchKeywords: ['série', 'continuité', 'limites'] },
    { id: 'prog_2b_04', type: 'course', title: 'المتتاليات العددية', matchKeywords: ['suites', 'متتاليات'] },
    { id: 'prog_2b_05', type: 'homework', title: 'الفرض المحروس رقم 1 (الدورة الأولى)', matchKeywords: ['devoir surveillé n° 1', 'فرض 1'] },
    { id: 'prog_2b_06', type: 'course', title: 'الاشتقاق ودراسة الدوال والفروع اللانهائية', matchKeywords: ['dérivation', 'اشتقاق', 'branches infinies'] },
    { id: 'prog_2b_07', type: 'course', title: 'الدوال اللوغاريتمية (Ln)', matchKeywords: ['logarithme', 'ln', 'لوغاريتم'] },
    { id: 'prog_2b_08', type: 'homework', title: 'الفرض المحروس رقم 2 (الدورة الأولى)', matchKeywords: ['devoir surveillé n° 2', 'فرض 2'] },
    { id: 'prog_2b_09', type: 'course', title: 'الأعداد العقدية (الجزء الأول)', matchKeywords: ['complexes', 'عقدية'] },
    { id: 'prog_2b_10', type: 'course', title: 'الدوال الأسية (Exp)', matchKeywords: ['exponentielle', 'exp', 'أسية'] },
    { id: 'prog_2b_11', type: 'homework', title: 'الفرض المحروس رقم 3 (الدورة الأولى)', matchKeywords: ['devoir 3', 'فرض 3'] }
  ],
  '2bac_sm': [
    { id: 'prog_2bsm_01', type: 'course', title: 'التقويم التشخيصي والمكتسبات السابقة', matchKeywords: ['diagnostique', 'révision'] },
    { id: 'prog_2bsm_02', type: 'course', title: 'الاتصال وحساب النهايات', matchKeywords: ['continuité', 'limites'] },
    { id: 'prog_2bsm_03', type: 'course', title: 'المتتاليات العددية', matchKeywords: ['suites', 'متتاليات'] },
    { id: 'prog_2bsm_04', type: 'homework', title: 'الفرض المحروس رقم 1', matchKeywords: ['devoir 1', 'فرض 1'] },
    { id: 'prog_2bsm_05', type: 'course', title: 'الاشتقاق ودراسة الدوال', matchKeywords: ['dérivation', 'fonctions'] },
    { id: 'prog_2bsm_06', type: 'course', title: 'الدوال الأسية واللوغاريتمية', matchKeywords: ['exponentielle', 'logarithme'] },
    { id: 'prog_2bsm_07', type: 'homework', title: 'الفرض المحروس رقم 2', matchKeywords: ['devoir 2', 'فرض 2'] },
    { id: 'prog_2bsm_08', type: 'course', title: 'الحسابيات في Z', matchKeywords: ['arithmétique', 'حسابيات'] },
    { id: 'prog_2bsm_09', type: 'homework', title: 'الفرض المحروس رقم 3', matchKeywords: ['devoir 3', 'فرض 3'] }
  ]
};



// Convert **bold** markdown to React strong elements
const parseBold = (text) => {
  if (!text || !text.includes('**')) return text;
  const parts = text.split(/\*\*/);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} style={{ fontWeight: 800 }}>{part}</strong> : part
  );
};


const SYSTEM_LEVELS = [
  { id: 'common_core_sci', label: 'Tronc Commun Scientifique' },
  { id: 'common_core_arts', label: 'Tronc Commun Lettres' },
  { id: '1bac_sci', label: '1ère Année Bac Sciences' },
  { id: '1bac_arts', label: '1ère Année Bac Lettres' },
  { id: '2bac_pc_svt', label: '2ème Année Bac PC / SVT' },
  { id: '2bac_sm', label: '2ème Année Bac Sciences Math' }
];

const WEEKDAYS_MAP = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi'
};

const CLASS_COLORS = [
  '#0f4c81', // Classic Navy Blue (like in the photo)
  '#065f46', // Dark Emerald Green
  '#7c2d12', // Dark Amber Rust
  '#4c1d95', // Deep Purple
  '#1e3a8a', // Dark Royal Blue
  '#831843', // Deep Rose/Magenta
  '#0369a1'  // Ocean Blue
];

const getClassColor = (cls) => {
  if (!cls) return '#0f4c81';
  let hash = 0;
  for (let i = 0; i < cls.name.length; i++) {
    hash = cls.name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % CLASS_COLORS.length;
  return CLASS_COLORS[idx];
};

const getShortLevelLabel = (levelId) => {
  if (levelId === 'common_core_sci') return 'TCS';
  if (levelId === 'common_core_arts') return 'TCL';
  if (levelId === '1bac_sci') return '1Bac';
  if (levelId === '1bac_arts') return '1Bac Lettres';
  if (levelId === '2bac_pc_svt') return '2Bac';
  if (levelId === '2bac_sm') return '2Bac SM';
  return levelId || '';
};

const getAcademicYearDates = (date = new Date()) => {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1; // 1-indexed
  let startYear, endYear;
  if (currentMonth >= 9) { // September to December
    startYear = currentYear;
    endYear = currentYear + 1;
  } else { // January to August
    startYear = currentYear - 1;
    endYear = currentYear;
  }
  const startDate = new Date(`${startYear}-09-01T00:00:00`);
  const endDate = new Date(`${endYear}-08-31T23:59:59`);
  const label = `${startYear}/${endYear}`;
  return { startDate, endDate, label };
};

const getAcademicYearMonths = () => {
  const today = new Date();
  const currentAcademicYear = getAcademicYearDates(today);
  const start = currentAcademicYear.startDate;
  const end = new Date(Math.min(today.getTime(), currentAcademicYear.endDate.getTime()));

  const months = [];
  let current = new Date(start.getFullYear(), start.getMonth(), 1);

  const monthNamesAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 
    'يوليوز', 'غشت', 'شتمبر', 'أكتوبر', 'نونبر', 'دجنبر'
  ];

  while (current <= end) {
    const year = current.getFullYear();
    const monthIndex = current.getMonth();
    const month = monthIndex + 1; // 1-indexed
    const formatted = `${year}-${String(month).padStart(2, '0')}`;
    
    const dateLabel = current.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const capitalizedLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
    const labelAr = `${monthNamesAr[monthIndex]} ${year}`;

    months.push({
      value: formatted,
      labelFr: capitalizedLabel,
      labelAr: labelAr
    });
    
    current.setMonth(current.getMonth() + 1);
  }
  
  return months.reverse();
};

const parseLocalDate = (dateStr, isEnd = false) => {
  if (!dateStr) return new Date(NaN);
  const [year, month, day] = dateStr.split('-').map(Number);
  const hour = isEnd ? 23 : 0;
  const minute = isEnd ? 59 : 0;
  const second = isEnd ? 59 : 0;
  const ms = isEnd ? 999 : 0;
  return new Date(year, month - 1, day, hour, minute, second, ms);
};

const formatLocalDate = (date = new Date()) => {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isTimeOverlapping = (slotTime, entryTime) => {
  if (!entryTime || !slotTime) return false;
  const slotNums = slotTime.match(/\d+/g)?.map(Number) || [];
  const entryHours = entryTime.split('-').map(t => {
    const hrMatch = t.match(/(\d+)(?::\d+)?/);
    return hrMatch ? parseInt(hrMatch[1], 10) : null;
  }).filter(h => h !== null);
  
  if (slotNums.length >= 2 && entryHours.length >= 2) {
    const [sStart, sEnd] = slotNums;
    const [eStart, eEnd] = entryHours;
    return Math.max(sStart, eStart) < Math.min(sEnd, eEnd);
  }
  const slotStartStr = slotNums[0]?.toString().padStart(2, '0') || '';
  return entryTime.includes(slotStartStr) || entryTime.includes(slotNums[0]?.toString() || '');
};

const getSelectedComponents = (compString) => {
  if (!compString || typeof compString !== 'string') return [];
  return compString.split(/\s*[\+&]\s*/).map(s => s.trim());
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

const checkTimeOverlap = (t1, t2) => {
  if (!t1 || !t2) return false;
  const getRange = (t) => {
    const nums = t.match(/\d+/g)?.map(Number) || [];
    if (nums.length >= 2) {
      const parts = t.split('-').map(p => {
        const matches = p.match(/(\d+)(?::(\d+))?/);
        if (matches) {
          const h = parseInt(matches[1], 10);
          const m = matches[2] ? parseInt(matches[2], 10) / 60 : 0;
          return h + m;
        }
        return null;
      }).filter(x => x !== null);
      if (parts.length >= 2) return [parts[0], parts[1]];
    }
    const first = nums[0];
    const last = nums[nums.length - 2] || nums[nums.length - 1];
    return [first, last];
  };

  const range1 = getRange(t1);
  const range2 = getRange(t2);

  if (range1 && range2) {
    const [start1, end1] = range1;
    const [start2, end2] = range2;
    return Math.max(start1, start2) < Math.min(end1, end2);
  }
  return false;
};

/**
 * Merges actual recorded entries with official school holidays and teacher absences.
 * Each holiday appears cleanly in its chronological position with standard banner styling.
 */
const buildCombinedEntries = (rawEntries = [], holidaysList = [], absencesList = [], currentClass) => {
  if (!currentClass) return [];
  const yearDates = getAcademicYearDates();
  const isAr = currentClass.language === 'ar' || 
               currentClass.isArabic || 
               (currentClass.name && currentClass.name.includes('عرب')) ||
               (currentClass.level && currentClass.level.includes('arts'));

  // 1. Filter manual entries to current academic year
  const actualFiltered = (rawEntries || []).filter(e => {
    if (!e || !e.date) return false;
    const d = new Date(e.date);
    return d >= yearDates.startDate && d <= yearDates.endDate;
  });

  // Automatically merge any two consecutive sessions on the same day for the same class into a unified 2-hour session
  const mergedActual = mergeConsecutiveEntries(actualFiltered);

  // Calculate effective date cutoff:
  // Holidays & absences should NOT be inserted into the logbook table in advance.
  // They only appear once their date has arrived/passed in reality (or preceding an already recorded session).
  const todayStr = formatLocalDate(new Date());
  let maxEntryDate = '';
  for (const e of mergedActual) {
    if (e.date && e.date > maxEntryDate) {
      maxEntryDate = e.date;
    }
  }
  const effectiveCutoff = todayStr > maxEntryDate ? todayStr : maxEntryDate;

  // 2. Generate unified official holiday entries
  const holidayEntries = (holidaysList || []).map(h => {
    if (!h || !h.startDate || !h.endDate) return null;
    const isSingleDay = h.startDate === h.endDate;

    const hStart = new Date(h.startDate);
    const hEnd = new Date(h.endDate);
    if (hEnd < yearDates.startDate || hStart > yearDates.endDate) return null;

    // Do not insert future holidays until their date has actually arrived/passed
    if (h.startDate > effectiveCutoff) return null;

    const dateDisplay = isSingleDay 
      ? h.startDate 
      : (isAr ? `من ${h.startDate} إلى ${h.endDate}` : `Du ${h.startDate} au ${h.endDate}`);

    const bannerText = isAr 
      ? `=== عطلة مدرسية: ${h.label} ===` 
      : `=== Vacances scolaires : ${h.label} ===`;

    return {
      id: `holiday-${h.id || h.startDate}`,
      classId: currentClass.id,
      date: h.startDate,
      displayDate: dateDisplay,
      endDate: h.endDate,
      time: '—',
      component: isAr ? 'عطلة مدرسية' : 'Vacances scolaires',
      subject: currentClass.subject || (isAr ? 'الرياضيات' : 'Mathématiques'),
      customContent: bannerText,
      holidayLabel: h.label,
      isHeaderSéance: true,
      isHolidayEntry: true
    };
  }).filter(Boolean);

  // 3. Generate teacher absence entries
  const absenceEntries = (absencesList || []).map(a => {
    if (!a || !a.startDate || !a.endDate) return null;
    const isSingleDay = a.startDate === a.endDate;
    const aStart = new Date(a.startDate);
    const aEnd = new Date(a.endDate);
    if (aEnd < yearDates.startDate || aStart > yearDates.endDate) return null;

    // Do not insert future absences until their date has actually arrived/passed
    if (a.startDate > effectiveCutoff) return null;

    const dateDisplay = isSingleDay 
      ? a.startDate 
      : (isAr ? `من ${a.startDate} إلى ${a.endDate}` : `Du ${a.startDate} au ${a.endDate}`);

    const bannerText = isAr 
      ? `=== رخصة/غياب: ${a.type} ===\nالسبب: ${a.reason || 'غير محدد'}` 
      : `=== Absence/Congé : ${a.type} ===\nMotif : ${a.reason || 'non spécifié'}`;

    return {
      id: `absence-${a.id || a.startDate}`,
      classId: currentClass.id,
      date: a.startDate,
      displayDate: dateDisplay,
      endDate: a.endDate,
      time: '—',
      component: isAr ? 'رخصة/غياب' : 'Absence/Congé',
      subject: currentClass.subject || (isAr ? 'الرياضيات' : 'Mathématiques'),
      customContent: bannerText,
      isHeaderSéance: true,
      isAbsenceEntry: true
    };
  }).filter(Boolean);

  // 4. Combine and sort chronologically by date
  return [...mergedActual, ...holidayEntries, ...absenceEntries].sort((a, b) => {
    const dComp = (a.date || '').localeCompare(b.date || '');
    if (dComp !== 0) return dComp;
    if (a.isHolidayEntry) return -1;
    if (b.isHolidayEntry) return 1;
    return (a.time || '').localeCompare(b.time || '');
  });
};

export default function AdminLogbook() {
  const { profName, profAcademy, profSchool } = useAuth();
  
  // State
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [allLogbookEntries, setAllLogbookEntries] = useState([]);
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [manualLanguage, setManualLanguage] = useState(null); // null = auto, 'ar', 'fr'
  const [showHoraireCol, setShowHoraireCol] = useState(() => {
    try { return localStorage.getItem('logbook_show_horaire') !== 'false'; } catch { return true; }
  });
  const [showComposantCol, setShowComposantCol] = useState(() => {
    try { return localStorage.getItem('logbook_show_composant') !== 'false'; } catch { return true; }
  });

  const persistColumnPrefsToDb = (nextHoraire, nextComposant) => {
    saveLogbookStyleConfig({
      arFont,
      frFont,
      fontSize: baseFontSize,
      lineHeight: gridLineHeight,
      colorInk,
      colorChapter,
      colorAxis,
      colorExercise,
      showHoraireCol: nextHoraire,
      showComposantCol: nextComposant
    }).catch(() => {});
  };

  const toggleHoraireCol = () => {
    setShowHoraireCol(prev => {
      const next = !prev;
      try { localStorage.setItem('logbook_show_horaire', String(next)); } catch {}
      persistColumnPrefsToDb(next, showComposantCol);
      return next;
    });
  };
  const toggleComposantCol = () => {
    setShowComposantCol(prev => {
      const next = !prev;
      try { localStorage.setItem('logbook_show_composant', String(next)); } catch {}
      persistColumnPrefsToDb(showHoraireCol, next);
      return next;
    });
  };
  const visibleLogbookColCount = 4 + (showHoraireCol ? 1 : 0) + (showComposantCol ? 1 : 0);
  const activityColWidth = `${52 + (showHoraireCol ? 0 : 12) + (showComposantCol ? 0 : 12)}%`;

  // Automatic RTL / Arabic mode detection with manual override option
  const isArMode = useMemo(() => {
    if (manualLanguage) return manualLanguage === 'ar';
    if (!selectedClass) return false;
    const lang = String(selectedClass.language || selectedClass.lang || selectedClass.option || '').toLowerCase();
    if (lang === 'ar' || lang === 'arabic' || lang === 'arabe' || lang.includes('عرب')) return true;
    if (selectedClass.isArabic || selectedClass.isAr) return true;
    const name = String(selectedClass.name || '').toLowerCase();
    if (name.includes('عرب') || name.includes('عام') || name.includes('(ar)') || name.includes(' ar')) return true;
    const level = String(selectedClass.level || '').toLowerCase();
    if (level.includes('arts') || level.includes('lettres') || level.includes('آداب')) return true;
    return false;
  }, [selectedClass, manualLanguage]);
  const [entries, setEntries] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [levelLessons, setLevelLessons] = useState([]);
  const [activeSessionSuggestion, setActiveSessionSuggestion] = useState(null);
  const [missingSessions, setMissingSessions] = useState([]);
  const [missingDaysFilter, setMissingDaysFilter] = useState('30days');

  // Timetable and calendar configurations state
  const [schedule, setSchedule] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [absences, setAbsences] = useState([]);
  
  // Style states
  const [arFont, setArFont] = useState('UKIJ Merdane');
  const [frFont, setFrFont] = useState('Outfit');
  const [baseFontSize, setBaseFontSize] = useState('0.8rem');
  const [gridLineHeight, setGridLineHeight] = useState(20);
  const [colorInk, setColorInk] = useState('#334155');
  const [colorChapter, setColorChapter] = useState('#0f172a');
  const [colorAxis, setColorAxis] = useState('#2563eb');
  const [colorExercise, setColorExercise] = useState('#d97706');

  // Control settings modal open & tabs
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('timetable'); // 'timetable' | 'holidays' | 'absences' | 'style'

  // Temp states for unsaved modal changes
  const [tempSchedule, setTempSchedule] = useState({});
  const [tempHolidays, setTempHolidays] = useState([]);
  const [tempAbsences, setTempAbsences] = useState([]);
  const [tempArFont, setTempArFont] = useState('UKIJ Merdane');
  const [tempFrFont, setTempFrFont] = useState('Outfit');
  const [tempBaseFontSize, setTempBaseFontSize] = useState('0.8rem');
  const [tempGridLineHeight, setTempGridLineHeight] = useState(20);
  const [tempColorInk, setTempColorInk] = useState('#334155');
  const [tempColorChapter, setTempColorChapter] = useState('#0f172a');
  const [tempColorAxis, setTempColorAxis] = useState('#2563eb');
  const [tempColorExercise, setTempColorExercise] = useState('#d97706');

  // Temp forms for adding holiday/absence
  const [holidayLabel, setHolidayLabel] = useState('');
  const [holidayStart, setHolidayStart] = useState('');
  const [holidayEnd, setHolidayEnd] = useState('');

  const [absenceType, setAbsenceType] = useState('Maladie');
  const [absenceReason, setAbsenceReason] = useState('');
  const [absenceStart, setAbsenceStart] = useState('');
  const [absenceEnd, setAbsenceEnd] = useState('');

  const handleTempScheduleChange = (slotKey, field, value) => {
    setTempSchedule(prev => ({
      ...prev,
      [slotKey]: {
        ...(prev[slotKey] || {}),
        [field]: value
      }
    }));
  };

  const handleAddHoliday = () => {
    if (!holidayLabel || !holidayStart || !holidayEnd) return;
    const newHol = {
      id: `hol-${Date.now()}`,
      label: holidayLabel,
      startDate: holidayStart,
      endDate: holidayEnd
    };
    setTempHolidays([...tempHolidays, newHol]);
    setHolidayLabel('');
    setHolidayStart('');
    setHolidayEnd('');
  };

  const handleAddAbsence = () => {
    if (!absenceStart || !absenceEnd) return;
    const newAbs = {
      id: `abs-${Date.now()}`,
      type: absenceType,
      reason: absenceReason,
      startDate: absenceStart,
      endDate: absenceEnd
    };
    setTempAbsences([...tempAbsences, newAbs]);
    setAbsenceReason('');
    setAbsenceStart('');
    setAbsenceEnd('');
  };

  const handleSaveSettings = async () => {
    try {
      localStorage.setItem('teacher_schedule_current', JSON.stringify(tempSchedule));
      setSchedule(tempSchedule);

      localStorage.setItem('school_holidays', JSON.stringify(tempHolidays));
      setHolidays(tempHolidays);

      localStorage.setItem('teacher_absences', JSON.stringify(tempAbsences));
      setAbsences(tempAbsences);

      localStorage.setItem('logbook_ar_font', tempArFont);
      setArFont(tempArFont);
      
      localStorage.setItem('logbook_fr_font', tempFrFont);
      setFrFont(tempFrFont);
      
      localStorage.setItem('logbook_font_size', tempBaseFontSize);
      setBaseFontSize(tempBaseFontSize);
      
      localStorage.setItem('logbook_line_height', String(tempGridLineHeight));
      setGridLineHeight(tempGridLineHeight);
      
      localStorage.setItem('logbook_color_ink', tempColorInk);
      setColorInk(tempColorInk);
      
      localStorage.setItem('logbook_color_chapter', tempColorChapter);
      setColorChapter(tempColorChapter);
      
      localStorage.setItem('logbook_color_axis', tempColorAxis);
      setColorAxis(tempColorAxis);
      
      localStorage.setItem('logbook_color_exercise', tempColorExercise);
      setColorExercise(tempColorExercise);

      // Persist to Cloud Database (MySQL /api/config)
      const results = await Promise.allSettled([
        saveTeacherScheduleConfig(tempSchedule),
        saveSchoolHolidaysConfig(tempHolidays),
        saveTeacherAbsencesConfig(tempAbsences),
        saveLogbookStyleConfig({
          arFont: tempArFont,
          frFont: tempFrFont,
          fontSize: tempBaseFontSize,
          lineHeight: tempGridLineHeight,
          colorInk: tempColorInk,
          colorChapter: tempColorChapter,
          colorAxis: tempColorAxis,
          colorExercise: tempColorExercise,
          showHoraireCol,
          showComposantCol
        })
      ]);

      const rejected = results.find(r => r.status === 'rejected');
      if (rejected) {
        throw rejected.reason || new Error('Échec de sauvegarde dans MySQL');
      }

      setSettingsModalOpen(false);
      setSuccess(isArMode ? 'تم تحديث الإعدادات والجدول بنجاح وحفظها في قاعدة البيانات!' : 'Paramètres enregistrés avec succès dans la base de données MySQL !');
      setTimeout(() => setSuccess(''), 3000);
      
      scanMissingSessions();
    } catch (e) {
      console.error("Error saving settings:", e);
      setError(e?.message || (isArMode ? 'حدث خطأ أثناء حفظ الإعدادات.' : 'Erreur lors de l\'enregistrement des paramètres.'));
      setTimeout(() => setError(''), 4500);
    }
  };

  const displayMissingSessions = useMemo(() => {
    let filtered = missingSessions;
    
    if (selectedClass) {
      filtered = filtered.filter(s => s.class && s.class.id === selectedClass.id);
    }
    
    if (missingDaysFilter === '30days') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(s => {
        const sessionDate = new Date(s.date);
        return sessionDate >= thirtyDaysAgo && sessionDate <= today;
      });
    } else {
      filtered = filtered.filter(s => s.date.startsWith(missingDaysFilter));
    }
    
    return filtered;
  }, [missingSessions, selectedClass, missingDaysFilter]);
  const [missingPanelOpen, setMissingPanelOpen] = useState(false);
  const [programDrawerOpen, setProgramDrawerOpen] = useState(false);
  const [previewSections, setPreviewSections] = useState({});
  const [sectionFilterMode, setSectionFilterMode] = useState('all'); // 'all' | 'uncovered' | 'covered'

  const toggleSectionPreview = (sectionId) => {
    setPreviewSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const getSectionContentString = (s) => {
    if (!s) return '';
    if (s.content) {
      return s.content;
    }
    if (s.items && s.items.length > 0) {
      return s.items.map(item => item.text || '').filter(t => t.trim() !== '').join('\n');
    }
    return '';
  };

  const insertTextToContent = (text, asBullet = false) => {
    if (!text || !text.trim()) return;
    const cleanText = text.replace(/\*\*/g, '').trim();
    const formatted = asBullet ? `• ${cleanText}` : cleanText;
    
    setFormData(prev => {
      let currentContent = prev.customContent || '';
      if (currentContent.trim() === '') {
        currentContent = formatted;
      } else {
        currentContent = currentContent.endsWith('\n')
          ? `${currentContent}${formatted}`
          : `${currentContent}\n${formatted}`;
      }
      return { ...prev, customContent: currentContent };
    });
  };

  const insertSectionContent = (s, mode = 'full') => {
    const rawTitle = (s.title || '').replace(/\*\*/g, '').trim();
    if (mode === 'title') {
      insertTextToContent(rawTitle, true);
      setFormData(prev => ({
        ...prev,
        selectedSections: prev.selectedSections.includes(s.title)
          ? prev.selectedSections
          : [...prev.selectedSections, s.title]
      }));
      return;
    }

    const contentToInsert = getSectionContentString(s);
    const textToInsert = contentToInsert || rawTitle;
    if (!textToInsert) return;
    
    setFormData(prev => {
      let currentContent = prev.customContent || '';
      if (currentContent.trim() === '') {
        currentContent = textToInsert;
      } else {
        currentContent = currentContent.endsWith('\n') 
          ? `${currentContent}${textToInsert}` 
          : `${currentContent}\n${textToInsert}`;
      }
      
      // Check the checkbox if not checked
      const nextSections = prev.selectedSections.includes(s.title)
        ? prev.selectedSections
        : [...prev.selectedSections, s.title];

      return {
        ...prev,
        selectedSections: nextSections,
        customContent: currentContent
      };
    });
  };
  
  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [isProgramOnlyMode, setIsProgramOnlyMode] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null); // null for new entry
  const [formData, setFormData] = useState({
    date: formatLocalDate(),
    time: '08:00 - 10:00',
    component: 'Cours',
    subject: 'Mathématiques',
    lessonId: '',
    selectedSections: [],
    customContent: '',
    isHeaderSéance: false
  });
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Manual / Initial full MySQL sync for both Logbook and Class Programs
  const handleManualCloudSync = async (silent = false) => {
    setIsSyncingDb(true);
    try {
      const [lbRes, clsRes] = await Promise.all([
        syncLocalLogbookToCloud(),
        syncLocalClassProgramsToCloud()
      ]);

      if (Array.isArray(lbRes?.entries)) {
        setAllLogbookEntries(lbRes.entries);
      }
      if (Array.isArray(clsRes?.classes)) {
        setClasses(clsRes.classes);
        setSelectedClass(prev => {
          if (!prev) return prev;
          return clsRes.classes.find(c => c.id === prev.id) || prev;
        });
      }

      if (selectedClass && Array.isArray(lbRes?.entries)) {
        const clsEntries = lbRes.entries.filter(e => e.classId === selectedClass.id);
        setEntries(buildCombinedEntries(clsEntries, holidays, absences, selectedClass));
      }

      if (!silent) {
        const uploadedNote = lbRes?.uploaded > 0
          ? (isArMode ? ` (تم رفع ${lbRes.uploaded} حصة محلية إلى قاعدة البيانات)` : ` (${lbRes.uploaded} séance(s) locale(s) migrée(s) vers MySQL)`)
          : '';
        setSuccess(
          (isArMode
            ? `تمت مزامنة دفتر النصوص (${lbRes?.total || 0} حصة) وبرامج الأقسام مع قاعدة البيانات بنجاح`
            : `Cahier de textes (${lbRes?.total || 0} séances) et programmes des classes synchronisés avec MySQL`) + uploadedNote
        );
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (err) {
      console.error('[AdminLogbook] Manual DB sync error:', err);
      if (!silent) {
        setError(err?.message || (isArMode ? 'تعذرت المزامنة مع قاعدة البيانات.' : 'Erreur de synchronisation avec MySQL.'));
        setTimeout(() => setError(''), 4500);
      }
    } finally {
      setIsSyncingDb(false);
    }
  };

  // Load classes, logbook entries, lessons, and exams on mount directly from MySQL
  useEffect(() => {
    const initData = async () => {
      try {
        const [cls, allEntries] = await Promise.all([
          getAllClasses({ forceRefresh: true }),
          getLogbookEntries()
        ]);
        setClasses(cls || []);
        setAllLogbookEntries(allEntries || []);
        
        const lsns = await getActiveLessons();
        const examsList = await getAllExams().catch(() => []);
        
        const mappedExams = (examsList || []).map(ex => ({
          id: `exam_${ex.id}`,
          title: ex.name || ex.title || 'Examen',
          subject: ex.subject || 'Mathématiques',
          level: ex.level || 'common_core_sci',
          docType: 'homework',
          isExam: true,
          content: {
            sections: (ex.questions || []).map((q, idx) => ({
              id: `q_${q.id || idx}`,
              title: `Question ${idx + 1}: ${q.question || ''}`,
              type: 'exercise',
              content: q.question,
              solution: q.astuce || ''
            }))
          }
        }));

        setLessons([...(lsns || []), ...mappedExams]);
      } catch (err) {
        console.error("Error loading data:", err);
      }
    };
    initData();
  }, []);

  // Initialize configurations from local cache and sync with Cloud DB on mount
  useEffect(() => {
    try {
      const sched = localStorage.getItem('teacher_schedule_current');
      if (sched) setSchedule(JSON.parse(sched));
      
      const hols = localStorage.getItem('school_holidays');
      if (hols) setHolidays(JSON.parse(hols));
      
      const abs = localStorage.getItem('teacher_absences');
      if (abs) setAbsences(JSON.parse(abs));
      
      setArFont(localStorage.getItem('logbook_ar_font') || 'UKIJ Merdane');
      setFrFont(localStorage.getItem('logbook_fr_font') || 'Outfit');
      setBaseFontSize(localStorage.getItem('logbook_font_size') || '0.8rem');
      setGridLineHeight(parseInt(localStorage.getItem('logbook_line_height') || '20', 10));
      setColorInk(localStorage.getItem('logbook_color_ink') || '#334155');
      setColorChapter(localStorage.getItem('logbook_color_chapter') || '#0f172a');
      setColorAxis(localStorage.getItem('logbook_color_axis') || '#2563eb');
      setColorExercise(localStorage.getItem('logbook_color_exercise') || '#d97706');
    } catch (e) {
      console.error("Error loading schedule settings from cache:", e);
    }

    // Fetch latest data from Cloud Database (Supabase)
    const syncFromCloud = async () => {
      try {
        const [cloudSched, cloudHols, cloudAbs, cloudStyle] = await Promise.all([
          getTeacherScheduleConfig({ forceRefresh: true }),
          getSchoolHolidaysConfig({ forceRefresh: true }),
          getTeacherAbsencesConfig({ forceRefresh: true }),
          getLogbookStyleConfig({ forceRefresh: true })
        ]);

        if (cloudSched && typeof cloudSched === 'object' && Object.keys(cloudSched).length > 0) {
          setSchedule(cloudSched);
        }
        if (Array.isArray(cloudHols) && cloudHols.length > 0) {
          setHolidays(cloudHols);
        }
        if (Array.isArray(cloudAbs) && cloudAbs.length > 0) {
          setAbsences(cloudAbs);
        }
        if (cloudStyle && typeof cloudStyle === 'object') {
          if (cloudStyle.arFont) setArFont(cloudStyle.arFont);
          if (cloudStyle.frFont) setFrFont(cloudStyle.frFont);
          if (cloudStyle.fontSize) setBaseFontSize(cloudStyle.fontSize);
          if (cloudStyle.lineHeight) setGridLineHeight(cloudStyle.lineHeight);
          if (cloudStyle.colorInk) setColorInk(cloudStyle.colorInk);
          if (cloudStyle.colorChapter) setColorChapter(cloudStyle.colorChapter);
          if (cloudStyle.colorAxis) setColorAxis(cloudStyle.colorAxis);
          if (cloudStyle.colorExercise) setColorExercise(cloudStyle.colorExercise);
          if (typeof cloudStyle.showHoraireCol === 'boolean') {
            setShowHoraireCol(cloudStyle.showHoraireCol);
            try { localStorage.setItem('logbook_show_horaire', String(cloudStyle.showHoraireCol)); } catch {}
          }
          if (typeof cloudStyle.showComposantCol === 'boolean') {
            setShowComposantCol(cloudStyle.showComposantCol);
            try { localStorage.setItem('logbook_show_composant', String(cloudStyle.showComposantCol)); } catch {}
          }
        }
      } catch (err) {
        console.warn('[AdminLogbook] Cloud config fetch warning:', err);
      }
    };
    syncFromCloud();
  }, []);

  // Sync temp states when settings modal opens
  useEffect(() => {
    if (settingsModalOpen) {
      setTempSchedule({ ...schedule });
      setTempHolidays([...holidays]);
      setTempAbsences([...absences]);
      setTempArFont(arFont);
      setTempFrFont(frFont);
      setTempBaseFontSize(baseFontSize);
      setTempGridLineHeight(gridLineHeight);
      setTempColorInk(colorInk);
      setTempColorChapter(colorChapter);
      setTempColorAxis(colorAxis);
      setTempColorExercise(colorExercise);
    }
  }, [settingsModalOpen, schedule, holidays, absences, arFont, frFont, baseFontSize, gridLineHeight, colorInk, colorChapter, colorAxis, colorExercise]);

  // Auto-detect current session from schedule
  useEffect(() => {
    const checkActiveSession = () => {
      const now = new Date();
      const dayNum = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
      const dayName = WEEKDAYS_MAP[dayNum];
      if (!dayName) return; // Sunday

      const currentHour = now.getHours();
      const daySessions = getMergedDaySessions(dayName, schedule, classes);
      const activeSession = daySessions.find(s => {
        const r = parseTimeRange(s.time);
        if (!r) return false;
        return currentHour >= r.start && currentHour < r.end;
      });

      if (activeSession && activeSession.class) {
        setActiveSessionSuggestion({
          class: activeSession.class,
          time: activeSession.displayTime.replace(/:00/g, 'h').replace('-', ' - '),
          rawSlot: activeSession.displayTime,
          displayTime: activeSession.displayTime,
          room: activeSession.room || '—',
          day: dayName,
          isDoubleHour: activeSession.isDoubleHour
        });
      } else {
        setActiveSessionSuggestion(null);
      }
    };

    if (classes.length > 0) {
      checkActiveSession();
    }
  }, [classes, schedule]);

  // Scan for missing sessions using MySQL-backed logbook entries
  const scanMissingSessions = () => {
    if (!schedule || Object.keys(schedule).length === 0) {
      setMissingSessions([]);
      return;
    }

    const allEntries = Array.isArray(allLogbookEntries) ? allLogbookEntries : [];

    const list = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkAcademicYear = getAcademicYearDates(today);

    if (missingDaysFilter === '30days') {
      // Scan last 30 calendar days
      for (let i = 1; i <= 30; i++) {
        const scanDate = new Date();
        scanDate.setDate(today.getDate() - i);
        scanDate.setHours(0, 0, 0, 0);

        // Exclude outside academic year
        if (scanDate < checkAcademicYear.startDate || scanDate > checkAcademicYear.endDate) {
          continue;
        }

        // Exclude Sunday
        const dayNum = scanDate.getDay();
        if (dayNum === 0) continue;

        const dayName = WEEKDAYS_MAP[dayNum];
        if (!dayName) continue;

        const dateStr = formatLocalDate(scanDate);

        // Exclude Holidays
        const isHoliday = holidays.some(h => {
          if (!h.startDate || !h.endDate) return false;
          return dateStr >= h.startDate && dateStr <= h.endDate;
        });
        if (isHoliday) continue;

        // Exclude Teacher Absences
        const isAbsent = absences.some(a => {
          if (!a.startDate || !a.endDate) return false;
          return dateStr >= a.startDate && dateStr <= a.endDate;
        });
        if (isAbsent) continue;

        // Find merged schedule sessions for this day
        const daySessions = getMergedDaySessions(dayName, schedule, classes);

        daySessions.forEach(session => {
          if (!session.class) return;

          const hasEntry = allEntries.some(e => {
            if (e.classId !== session.class.id) return false;
            if (e.date !== dateStr) return false;
            return checkTimeOverlap(session.displayTime, e.time);
          });

          if (!hasEntry) {
            list.push({
              id: `${dateStr}-${session.slotKey}`,
              date: dateStr,
              dayName,
              time: session.displayTime,
              class: session.class,
              room: session.room || '—',
              isDoubleHour: session.isDoubleHour
            });
          }
        });
      }
    } else {
      // Scan specific month (YYYY-MM)
      const [yearStr, monthStr] = missingDaysFilter.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // 0-indexed month

      // Get number of days in this month
      const numDays = new Date(year, month + 1, 0).getDate();

      for (let d = 1; d <= numDays; d++) {
        const scanDate = new Date(year, month, d);
        scanDate.setHours(0, 0, 0, 0);

        // Do not scan future dates
        if (scanDate > today) continue;

        // Exclude outside academic year
        if (scanDate < checkAcademicYear.startDate || scanDate > checkAcademicYear.endDate) {
          continue;
        }

        // Exclude Sunday
        const dayNum = scanDate.getDay();
        if (dayNum === 0) continue;

        const dayName = WEEKDAYS_MAP[dayNum];
        if (!dayName) continue;

        const dateStr = formatLocalDate(scanDate);

        // Exclude Holidays
        const isHoliday = holidays.some(h => {
          if (!h.startDate || !h.endDate) return false;
          return dateStr >= h.startDate && dateStr <= h.endDate;
        });
        if (isHoliday) continue;

        // Exclude Teacher Absences
        const isAbsent = absences.some(a => {
          if (!a.startDate || !a.endDate) return false;
          return dateStr >= a.startDate && dateStr <= a.endDate;
        });
        if (isAbsent) continue;

        // Find merged schedule sessions for this day
        const daySessions = getMergedDaySessions(dayName, schedule, classes);

        daySessions.forEach(session => {
          if (!session.class) return;

          const hasEntry = allEntries.some(e => {
            if (e.classId !== session.class.id) return false;
            if (e.date !== dateStr) return false;
            return checkTimeOverlap(session.displayTime, e.time);
          });

          if (!hasEntry) {
            list.push({
              id: `${dateStr}-${session.slotKey}`,
              date: dateStr,
              dayName,
              time: session.displayTime,
              class: session.class,
              room: session.room || '—',
              isDoubleHour: session.isDoubleHour
            });
          }
        });
      }
    }

    list.sort((a, b) => new Date(a.date) - new Date(b.date));
    setMissingSessions(list);
  };

  // Trigger scan when entries, classes, schedule, holidays, absences, or month filter change
  useEffect(() => {
    if (classes.length > 0) {
      scanMissingSessions();
    }
  }, [classes, entries, allLogbookEntries, schedule, holidays, absences, missingDaysFilter]);

  // Load entries when selected class changes or when holidays/absences update
  useEffect(() => {
    if (selectedClass) {
      const loadEntries = async () => {
        const data = await getLogbookEntries(selectedClass.id);
        const combined = buildCombinedEntries(data || [], holidays, absences, selectedClass);
        setEntries(combined);
      };
      loadEntries();
      
      const targetLevel = normalizeLevel(selectedClass.level);
      const filtered = lessons.filter(l => {
        const lessonLevel = normalizeLevel(l.level);
        return (
          lessonLevel === targetLevel ||
          lessonLevel === 'all' ||
          l.level === selectedClass.level ||
          (Array.isArray(selectedClass.assignedLessons) && selectedClass.assignedLessons.includes(l.id)) ||
          (Array.isArray(l.classes) && l.classes.includes(selectedClass.id)) ||
          (Array.isArray(l.schools) && l.schools.includes(selectedClass.name))
        );
      });
      setLevelLessons(filtered);
    } else {
      setEntries([]);
      setLevelLessons([]);
    }
  }, [selectedClass, lessons, schedule, holidays, absences]);

  // Handle lesson select in form: load sections for checkbox selection
  const handleLessonChange = (val) => {
    if (val.startsWith('prog_item_') || val.startsWith('custom_prog_')) {
      const itemId = val.replace('prog_item_', '').replace('custom_prog_', '');
      const progItem = selectedClass?.program?.find(item => item.id === itemId);
      if (progItem) {
        let comp = 'Cours';
        if (progItem.type === 'exercises') comp = 'Exercices';
        if (progItem.type === 'homework' || progItem.type === 'exam' || progItem.title.includes('فرض') || progItem.title.toUpperCase().includes('CONTRÔLE')) comp = 'Contrôle';

        let customContent = '';
        let isHeader = false;
        let suggestedSections = [];

        if (progItem.lessonId) {
          const lesson = lessons.find(l => l.id === progItem.lessonId);
          const coveredSections = new Set();
          entries.forEach(e => {
            if (e.selectedSections && Array.isArray(e.selectedSections)) {
              e.selectedSections.forEach(s => coveredSections.add(s));
            }
          });
          const allSections = lesson?.content?.sections || [];
          const uncovered = allSections.filter(s => !coveredSections.has(s.title));
          if (uncovered.length > 0) {
            suggestedSections = [uncovered[0].title];
            customContent = `• ${uncovered[0].title}`;
            if (uncovered.length === allSections.length) {
              isHeader = true;
              customContent = `=== ${lesson.title.toUpperCase()} ===\n` + customContent;
            }
          } else {
            isHeader = true;
            customContent = `=== ${lesson?.title?.toUpperCase() || progItem.title} ===\n`;
          }
        } else {
          isHeader = true;
          customContent = `=== ${progItem.title.toUpperCase()} ===\n`;
        }

        setFormData(prev => ({
          ...prev,
          lessonId: progItem.lessonId || '',
          selectedProgramItemId: itemId,
          selectedSections: suggestedSections,
          customContent: customContent,
          component: comp,
          isHeaderSéance: isHeader
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        lessonId: val,
        selectedProgramItemId: '',
        selectedSections: []
      }));
    }
  };

  // Toggle section checkbox selection incrementally
  const handleToggleSection = (sectionTitle) => {
    setFormData(prev => {
      const isSelected = prev.selectedSections.includes(sectionTitle);
      const nextSections = isSelected
        ? prev.selectedSections.filter(s => s !== sectionTitle)
        : [...prev.selectedSections, sectionTitle];
      
      let currentContent = prev.customContent || '';
      const cleanTitle = sectionTitle.replace(/\*\*/g, '').trim();
      const escapedRaw = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedClean = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      if (isSelected) {
        // Unchecked: remove the bullet point line for this section (raw or clean)
        const regexRaw = new RegExp(`^\\s*•\\s*${escapedRaw}\\s*\\n?`, 'm');
        const regexClean = new RegExp(`^\\s*•\\s*${escapedClean}\\s*\\n?`, 'm');
        currentContent = currentContent.replace(regexRaw, '').replace(regexClean, '');
      } else {
        // Checked: append the bullet point
        const line = `• ${cleanTitle}`;
        if (currentContent.trim() === '') {
          currentContent = line;
        } else {
          currentContent = currentContent.endsWith('\n') 
            ? `${currentContent}${line}` 
            : `${currentContent}\n${line}`;
        }
      }
      
      return {
        ...prev,
        selectedSections: nextSections,
        customContent: currentContent
      };
    });
  };

  const handleSelectAllVisibleSections = (sectionsList) => {
    if (!sectionsList || sectionsList.length === 0) return;
    setFormData(prev => {
      const currentSelected = new Set(prev.selectedSections);
      let content = prev.customContent || '';
      
      sectionsList.forEach(s => {
        if (!currentSelected.has(s.title)) {
          currentSelected.add(s.title);
          const cleanTitle = (s.title || '').replace(/\*\*/g, '').trim();
          const line = `• ${cleanTitle}`;
          if (content.trim() === '') {
            content = line;
          } else {
            content = content.endsWith('\n') ? `${content}${line}` : `${content}\n${line}`;
          }
        }
      });
      
      return {
        ...prev,
        selectedSections: Array.from(currentSelected),
        customContent: content
      };
    });
  };

  const handleDeselectAllVisibleSections = (sectionsList) => {
    if (!sectionsList || sectionsList.length === 0) return;
    setFormData(prev => {
      const titlesToRemove = new Set(sectionsList.map(s => s.title));
      let content = prev.customContent || '';
      
      sectionsList.forEach(s => {
        const cleanTitle = (s.title || '').replace(/\*\*/g, '').trim();
        const escapedRaw = s.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedClean = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        content = content.replace(new RegExp(`^\\s*•\\s*${escapedRaw}\\s*\\n?`, 'm'), '');
        content = content.replace(new RegExp(`^\\s*•\\s*${escapedClean}\\s*\\n?`, 'm'), '');
      });
      
      return {
        ...prev,
        selectedSections: prev.selectedSections.filter(t => !titlesToRemove.has(t)),
        customContent: content
      };
    });
  };

  const toggleComponent = (compName) => {
    setFormData(prev => {
      const currentList = getSelectedComponents(prev.component);
      let nextList;
      if (currentList.includes(compName)) {
        nextList = currentList.filter(c => c !== compName);
      } else {
        nextList = [...currentList, compName];
      }
      if (nextList.length === 0) {
        nextList = [compName];
      }
      return { ...prev, component: nextList.join(' + ') };
    });
  };

  // Get status details of a specific program item
  const getProgramItemStatus = (item) => {
    if (!item) return { label: 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)', isDone: false, pct: 0 };
    
    const coveredSections = new Set();
    entries.forEach(e => {
      if (e.selectedSections && Array.isArray(e.selectedSections)) {
        e.selectedSections.forEach(s => coveredSections.add(s));
      }
    });

    if (item.type === 'custom' || !item.lessonId) {
      const isLogged = entries.some(e => 
        (e.selectedProgramItemId && e.selectedProgramItemId === item.id) ||
        (e.customContent && e.customContent.includes(item.title)) ||
        (e.component === 'Contrôle' && item.title.toUpperCase().includes('CONTRÔLE')) ||
        (e.component === 'Contrôle' && item.title.includes('فرض'))
      );
      return isLogged 
        ? { label: isArMode ? 'مكتمل' : 'Terminé', color: 'var(--emerald)', bg: 'rgba(16, 185, 129, 0.08)', isDone: true, pct: 100 } 
        : { label: isArMode ? 'لم يبدأ' : 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)', isDone: false, pct: 0 };
    }

    const lesson = lessons.find(l => l.id === item.lessonId);
    if (!lesson) {
      const isLogged = entries.some(e => e.selectedProgramItemId === item.id || e.lessonId === item.lessonId);
      return isLogged
        ? { label: isArMode ? 'مكتمل' : 'Terminé', color: 'var(--emerald)', bg: 'rgba(16, 185, 129, 0.08)', isDone: true, pct: 100 }
        : { label: isArMode ? 'لم يبدأ' : 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)', isDone: false, pct: 0 };
    }

    const sections = lesson.content?.sections || [];
    if (sections.length === 0) {
      const isLogged = entries.some(e => e.selectedProgramItemId === item.id || e.lessonId === item.lessonId);
      return isLogged
        ? { label: isArMode ? 'مكتمل' : 'Terminé', color: 'var(--emerald)', bg: 'rgba(16, 185, 129, 0.08)', isDone: true, pct: 100 }
        : { label: isArMode ? 'لم يبدأ' : 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)', isDone: false, pct: 0 };
    }

    const completedCount = sections.filter(sec => coveredSections.has(sec.title)).length;
    const pct = Math.round((completedCount / sections.length) * 100);
    if (completedCount === sections.length) {
      return { label: isArMode ? 'مكتمل' : 'Terminé', color: 'var(--emerald)', bg: 'rgba(16, 185, 129, 0.08)', isDone: true, count: completedCount, total: sections.length, pct: 100 };
    } else if (completedCount > 0) {
      return { label: isArMode ? `قيد الإنجاز (${completedCount}/${sections.length})` : `En cours (${completedCount}/${sections.length})`, color: 'var(--violet)', bg: 'rgba(99, 102, 241, 0.1)', isDone: false, count: completedCount, total: sections.length, pct };
    } else {
      return { label: isArMode ? 'لم يبدأ' : 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)', isDone: false, count: 0, total: sections.length, pct: 0 };
    }
  };

  // Auto-generate standard Moroccan curriculum program for the selected class
  const handleAutoGenerateProgram = async () => {
    if (!selectedClass) return;
    const normLevel = normalizeLevel(selectedClass.level);
    const template = STANDARD_CURRICULA[normLevel] || STANDARD_CURRICULA['common_core_arts'];
    
    // Match each item with available levelLessons if found
    const generated = template.map(t => {
      const foundLesson = levelLessons.find(l => {
        const title = (l.title || '').toLowerCase();
        return t.matchKeywords.some(kw => title.includes(kw.toLowerCase()));
      });
      return {
        id: t.id + '_' + Date.now().toString(36),
        type: t.type,
        title: isArMode ? t.title : (foundLesson?.title || t.title),
        lessonId: foundLesson ? foundLesson.id : null
      };
    });

    try {
      await updateClass(selectedClass.id, { program: generated });
      const updatedCls = { ...selectedClass, program: generated };
      setSelectedClass(updatedCls);
      setClasses(prev => prev.map(c => c.id === selectedClass.id ? updatedCls : c));
      setSuccess(isArMode ? 'تم توليد برنامج القسم بنجاح وتعيينه لدفتر النصوص!' : 'Programme de la classe généré avec succès !');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      console.error(err);
      setError(err?.message || (isArMode ? 'حدث خطأ أثناء توليد البرنامج وحفظه في قاعدة البيانات.' : 'Erreur lors de la génération du programme.'));
      setTimeout(() => setError(''), 5000);
    }
  };

  // Get the first uncompleted planned item in the program
  const getNextPlannedItem = () => {
    if (!selectedClass || !selectedClass.program || selectedClass.program.length === 0) return null;
    
    // Get all covered sections and program item ids from logbook entries
    const coveredSections = new Set();
    const completedProgItemIds = new Set();
    entries.forEach(e => {
      if (e.selectedProgramItemId) {
        completedProgItemIds.add(e.selectedProgramItemId);
      }
      if (e.selectedSections && Array.isArray(e.selectedSections)) {
        e.selectedSections.forEach(s => coveredSections.add(s));
      }
    });

    for (const item of selectedClass.program) {
      if (item.type === 'custom' || !item.lessonId) {
        const isLogged = completedProgItemIds.has(item.id) || entries.some(e => 
          (e.customContent && e.customContent.includes(item.title)) || 
          (e.component === 'Contrôle' && item.title.toUpperCase().includes('CONTRÔLE')) ||
          (e.component === 'Contrôle' && item.title.includes('فرض'))
        );
        if (!isLogged) return item;
      } else if (item.lessonId) {
        const lesson = lessons.find(l => l.id === item.lessonId);
        if (!lesson) {
          if (!completedProgItemIds.has(item.id)) return item;
          continue;
        }
        const sections = lesson.content?.sections || [];
        const completedCount = sections.filter(sec => coveredSections.has(sec.title)).length;
        if (completedCount < sections.length) {
          const uncoveredSections = sections.filter(sec => !coveredSections.has(sec.title));
          return {
            ...item,
            lesson,
            uncoveredSections
          };
        }
      }
    }
    return null; // All completed
  };

  // Open "Add Séance" modal pre-filled with a specific program item
  const handleOpenAddSpecificProgramItem = (item, isProgramOnly = true) => {
    setIsProgramOnlyMode(isProgramOnly);
    setEditingEntry(null);
    let docTypeComponent = 'Cours';
    if (item.type === 'exercises') docTypeComponent = 'Exercices';
    if (item.type === 'homework' || item.type === 'exam' || item.title.includes('فرض') || item.title.toUpperCase().includes('CONTRÔLE')) docTypeComponent = 'Contrôle';

    let suggestedSections = [];
    let customContent = '';
    let isHeaderSéance = false;

    if (item.lessonId) {
      const lesson = lessons.find(l => l.id === item.lessonId);
      const coveredSections = new Set();
      entries.forEach(e => {
        if (e.selectedSections && Array.isArray(e.selectedSections)) {
          e.selectedSections.forEach(s => coveredSections.add(s));
        }
      });
      const allSections = lesson?.content?.sections || [];
      const uncovered = allSections.filter(s => !coveredSections.has(s.title));
      if (uncovered.length > 0) {
        suggestedSections = [uncovered[0].title];
        customContent = `• ${uncovered[0].title}`;
        if (uncovered.length === allSections.length) {
          isHeaderSéance = true;
          customContent = `=== ${lesson.title.toUpperCase()} ===\n` + customContent;
        }
      } else {
        customContent = `=== ${lesson?.title?.toUpperCase() || item.title} ===\n`;
        isHeaderSéance = true;
      }
    } else {
      customContent = item.title;
      if (item.title.toUpperCase().includes('CONTRÔLE') || item.title.includes('فرض')) {
        isHeaderSéance = true;
        customContent = `=== ${item.title.toUpperCase()} ===\n`;
      }
    }

    setFormData({
      date: formatLocalDate(),
      time: '08:00 - 10:00',
      component: docTypeComponent,
      subject: 'Mathématiques',
      lessonId: item.lessonId || '',
      selectedProgramItemId: item.id,
      selectedSections: suggestedSections,
      customContent: customContent,
      isHeaderSéance: isHeaderSéance
    });
    setProgramDrawerOpen(false);
    setModalOpen(true);
  };

  // Open "Add Séance" modal pre-filled with the next planned item (Filters strictly to programme items)
  const handleOpenAddFromProgram = () => {
    setIsProgramOnlyMode(true);
    const nextItem = getNextPlannedItem();
    if (!nextItem) {
      alert(isArMode ? "لقد تم إنجاز جميع دروس البرنامج المعتمد للقسم!" : "Tous les éléments du programme ont été complétés !");
      setEditingEntry(null);
      setFormData({
        date: formatLocalDate(),
        time: '08:00 - 10:00',
        component: 'Cours',
        subject: 'Mathématiques',
        lessonId: '',
        selectedProgramItemId: '',
        selectedSections: [],
        customContent: '',
        isHeaderSéance: false
      });
      setModalOpen(true);
      return;
    }

    handleOpenAddSpecificProgramItem(nextItem, true);
  };

  // Primary Add Séance handler (allows creating a free session or choosing from any lesson/program item)
  const handleOpenAddModal = () => {
    setIsProgramOnlyMode(false);
    setEditingEntry(null);
    setFormData({
      date: formatLocalDate(),
      time: '08:00 - 10:00',
      component: 'Cours',
      subject: 'Mathématiques',
      lessonId: '',
      selectedProgramItemId: '',
      selectedSections: [],
      customContent: '',
      isHeaderSéance: false
    });
    setModalOpen(true);
  };


  const handleOpenEditModal = (entry) => {
    setIsProgramOnlyMode(false);
    setEditingEntry(entry);
    setFormData({
      date: entry.date,
      time: entry.time,
      component: entry.component || 'Cours',
      subject: entry.subject || 'Mathématiques',
      lessonId: entry.lessonId || '',
      selectedProgramItemId: entry.selectedProgramItemId || '',
      selectedSections: entry.selectedSections || [],
      customContent: entry.customContent || entry.activities?.join('\n') || '',
      isHeaderSéance: entry.isHeaderSéance || false
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass) return;

    // Validation: Check for duplicate/overlapping session against live MySQL entries
    const allEntries = Array.isArray(allLogbookEntries) ? allLogbookEntries : [];
    
    const overlapExists = allEntries.some(entry => {
      // Must be same class and same date
      if (entry.classId !== selectedClass.id) return false;
      if (entry.date !== formData.date) return false;
      
      // If editing, ignore the entry currently being edited
      if (editingEntry && entry.id === editingEntry.id) return false;
      
      // Check if times overlap
      return checkTimeOverlap(entry.time, formData.time);
    });

    if (overlapExists) {
      setError(selectedClass.language === 'ar'
        ? "تنبيه: توجد بالفعل حصة مسجلة في هذا التاريخ وهذا التوقيت!" 
        : "Erreur : Une séance est déjà enregistrée pour cette date et cet horaire !"
      );
      setTimeout(() => setError(''), 5000);
      return; // Stop form submission
    }

    // Validation: Check if selected date is on a school holiday
    const holidayConflict = holidays.find(h => 
      h.startDate && h.endDate && formData.date >= h.startDate && formData.date <= h.endDate
    );
    if (holidayConflict) {
      const confirmMsg = isArMode
        ? `تنبيه: التاريخ المحدد (${formData.date}) يوافق عطلة مدرسية: "${holidayConflict.label}".\nهل تود تأكيد تسجيل هذه الحصة (مثلاً كحصة دعم أو استدراك)؟`
        : `Attention : La date sélectionnée (${formData.date}) coïncide avec des vacances scolaires : "${holidayConflict.label}".\nSouhaitez-vous confirmer l'enregistrement d'une séance exceptionnelle ?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    const entryPayload = {
      classId: selectedClass.id,
      date: formData.date,
      time: formData.time,
      component: formData.component,
      subject: formData.subject,
      lessonId: formData.lessonId,
      selectedProgramItemId: formData.selectedProgramItemId || null,
      selectedSections: formData.selectedSections,
      customContent: formData.customContent,
      isHeaderSéance: formData.isHeaderSéance,
      activities: formData.customContent.split('\n').filter(line => line.trim().length > 0)
    };

    try {
      if (editingEntry) {
        await updateLogbookEntry(editingEntry.id, entryPayload);
        setSuccess("Séance modifiée avec succès.");
      } else {
        await addLogbookEntry(entryPayload);
        setSuccess("Séance ajoutée au cahier de textes.");
      }
      
      // Reload entries from MySQL preserving holidays and absences
      const freshAll = await getLogbookEntries();
      setAllLogbookEntries(freshAll || []);
      const data = (freshAll || []).filter(e => e.classId === selectedClass.id);
      setEntries(buildCombinedEntries(data, holidays, absences, selectedClass));
      
      setModalOpen(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.message || "Impossible d'enregistrer la séance dans la base de données.");
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDelete = async (entryIdOrEntry) => {
    const confirmMsg = isArMode ? "هل أنت متأكد من حذف هذه الحصة من دفتر النصوص؟" : "Voulez-vous supprimer cette séance du cahier de textes ?";
    if (window.confirm(confirmMsg)) {
      try {
        // Support deleting merged double-hour sessions (which may have two underlying DB records)
        const entryToDelete = typeof entryIdOrEntry === 'object' ? entryIdOrEntry : null;
        const realId = typeof entryIdOrEntry === 'string' || typeof entryIdOrEntry === 'number' ? entryIdOrEntry : entryIdOrEntry?.id;

        if (entryToDelete?.isMergedDoubleSession && entryToDelete?.originalEntryIds?.length > 0) {
          // Delete all underlying split records
          await Promise.all(entryToDelete.originalEntryIds.map(id => deleteLogbookEntry(id)));
        } else {
          await deleteLogbookEntry(realId);
        }

        const freshAll = await getLogbookEntries();
        setAllLogbookEntries(freshAll || []);
        const data = (freshAll || []).filter(e => e.classId === selectedClass.id);
        setEntries(buildCombinedEntries(data, holidays, absences, selectedClass));
        setSuccess(isArMode ? "تم حذف الحصة بنجاح من قاعدة البيانات." : "Séance supprimée de la base de données.");
        setTimeout(() => setSuccess(''), 2500);
      } catch (err) {
        setError(err?.message || (isArMode ? "حدث خطأ أثناء الحذف من قاعدة البيانات." : "Erreur lors de la suppression."));
        setTimeout(() => setError(''), 5000);
      }
    }
  };

  const triggerPrint = () => {
    openLogbookPrintWindow(selectedClass, entries, profName, {
      isArMode,
      arFont,
      frFont,
      baseFontSize,
      gridLineHeight,
      colorInk,
      colorChapter,
      colorAxis,
      colorExercise,
      showHoraire: showHoraireCol,
      showComposant: showComposantCol
    });
  };

  const selectedClassLevelLabel = selectedClass
    ? SYSTEM_LEVELS.find(lvl => lvl.id === selectedClass.level)?.label || selectedClass.level
    : '';

  // Style properties are bound to React state variables

  const hexToRgba = (hex, alpha) => {
    if (!hex || hex.charAt(0) !== '#') return `rgba(245, 158, 11, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const renderActivityContent = (content, isHeader) => {
    if (!content) return null;

    // 1. Normalize line breaks and merge orphan continuation lines (e.g. solitary "$J$." or "." after text)
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
      // e.g. "$J$." or "$E$." or single letter with dot
      if (cleanedLines.length > 0 && /^(\$[A-Za-z0-9_\\^+\-=*<>]+\$[.,;]?|[A-Za-z][.,;])$/.test(cur)) {
        const prevIdx = cleanedLines.length - 1;
        if (cleanedLines[prevIdx] && !cleanedLines[prevIdx].endsWith('.')) {
          cleanedLines[prevIdx] += ' ' + cur;
          continue;
        }
      }

      // Filter out redundant empty exercise stubs immediately followed by full exercise headers
      // e.g. "• **Exercice 08 :**" followed by "• Exercice 08 : Étude de fonction..."
      const curClean = cur.replace(/^(\s*(?:[•▪■›–—]|-(?!-)\s+|\*(?!\*)\s+))+/, '').replace(/\*\*/g, '').trim();
      const isExerciseStub = /^(exercice|تمرين|devoir|contrôle|فرض)\s*n?°?\s*\d*\s*:?\s*$/i.test(curClean);
      if (isExerciseStub && i + 1 < rawLines.length) {
        const nextClean = rawLines[i + 1].trim().replace(/^(\s*(?:[•▪■›–—]|-(?!-)\s+|\*(?!\*)\s+))+/, '').replace(/\*\*/g, '').trim();
        const nextIsExercise = /^(exercice|تمرين|devoir|contrôle|فرض)\s*n?°?\s*\d*/i.test(nextClean);
        if (nextIsExercise) {
          continue;
        }
      }

      cleanedLines.push(rawLines[i]);
    }

    const lines = cleanedLines;

    const startsWithArabic = (str) => {
      if (!str) return false;
      const clean = str.trim();
      if (!clean) return false;
      const cleanFormatting = clean.replace(/^[\*\s_#\-✏■▪›–—]+/, '').trim();
      if (!cleanFormatting) return false;
      const firstChar = cleanFormatting.charAt(0);
      return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(firstChar);
    };

    // Detect the type and styling of a single content line
    const getLineStyle = (raw, index) => {
      const trimmed = raw.trim();
      if (trimmed === '') return { type: 'empty', text: '' };

      // Strip true bullets (•, ▪, ■, ›, –, — or a lone - / * followed by whitespace) without touching ** bold markers
      let clean = trimmed.replace(/^(\s*(?:[•▪■›–—]|-(?!-)\s+|\*(?!\*)\s+))+/, '').trim();
      // Plain text stripped of markdown ** for robust regex matching
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

      // 8. Pedagogical blocks by keyword: Définition, Propriété, Théorème, Remarque, Application, Exemple...
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

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '2px 0' }}>
        {lines.map((raw, idx) => {
          const { type, text, numLabel, color, bg } = getLineStyle(raw, idx);

          if (type === 'empty') {
            return <div key={idx} style={{ minHeight: `${gridLineHeight}px`, height: `${gridLineHeight}px` }} />;
          }

          const isArabic = isArMode || startsWithArabic(text);
          const lineDirection = isArabic ? 'rtl' : 'ltr';
          const lineTextAlign = isArabic ? 'right' : 'left';

          const commonStyle = {
            direction: lineDirection,
            textAlign: lineTextAlign,
            boxSizing: 'border-box',
            fontFamily: `'${isArabic ? arFont : frFont}', 'Outfit', 'Cairo', sans-serif`,
            margin: '0',
            lineHeight: `${gridLineHeight}px`,
            minHeight: `${gridLineHeight}px`,
            color: colorInk,
            fontSize: baseFontSize
          };

          if (type === 'chapter') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: `calc(${baseFontSize} * 1.25)`,
                fontWeight: 800,
                color: colorChapter,
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                borderBottom: `1.5px solid ${hexToRgba(colorChapter, 0.2)}`,
                paddingBottom: '2px',
                marginBottom: '4px',
                display: 'block'
              }}>
                {renderWithMath(text)}
              </div>
            );
          }

          if (type === 'exercise') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: baseFontSize,
                fontWeight: 700,
                color: colorExercise,
                background: hexToRgba(colorExercise, 0.08),
                borderLeft: lineDirection === 'ltr' ? `3px solid ${colorExercise}` : 'none',
                borderRight: lineDirection === 'rtl' ? `3px solid ${colorExercise}` : 'none',
                borderRadius: '4px',
                padding: '0 0.55rem',
                margin: '3px 0 2px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <span style={{ fontSize: '0.85em' }}>✏️</span>
                <span>{renderWithMath(text)}</span>
              </div>
            );
          }

          if (type === 'section') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: `calc(${baseFontSize} * 1.05)`,
                fontWeight: 700,
                color: '#4f46e5',
                borderLeft: lineDirection === 'ltr' ? '2.5px solid #6366f1' : 'none',
                borderRight: lineDirection === 'rtl' ? '2.5px solid #6366f1' : 'none',
                paddingLeft: lineDirection === 'ltr' ? '0.5rem' : '0',
                paddingRight: lineDirection === 'rtl' ? '0.5rem' : '0',
                margin: '3px 0 1px 0',
                display: 'block'
              }}>
                {renderWithMath(text)}
              </div>
            );
          }

          if (type === 'axis') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: `calc(${baseFontSize} * 1.1)`,
                fontWeight: 700,
                color: colorAxis,
                borderLeft: lineDirection === 'ltr' ? `3px solid ${colorAxis}` : 'none',
                borderRight: lineDirection === 'rtl' ? `3px solid ${colorAxis}` : 'none',
                paddingLeft: lineDirection === 'ltr' ? '0.55rem' : '0',
                paddingRight: lineDirection === 'rtl' ? '0.55rem' : '0',
                display: 'block'
              }}>
                {renderWithMath(text)}
              </div>
            );
          }

          if (type === 'numbered') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: baseFontSize,
                fontWeight: 500,
                paddingLeft: lineDirection === 'ltr' ? '0.75rem' : '0',
                paddingRight: lineDirection === 'rtl' ? '0.75rem' : '0',
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.45rem'
              }}>
                <span style={{ fontWeight: 800, color: '#2563eb', flexShrink: 0 }}>{numLabel}</span>
                <span style={{ flex: 1 }}>{renderWithMath(text)}</span>
              </div>
            );
          }

          if (type === 'formula') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: baseFontSize,
                display: 'flex',
                justifyContent: 'center',
                padding: '2px 0',
                margin: '2px 0'
              }}>
                {renderWithMath(text)}
              </div>
            );
          }

          if (type === 'intro_text') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: baseFontSize,
                fontWeight: 500,
                paddingLeft: lineDirection === 'ltr' ? '0.35rem' : '0',
                paddingRight: lineDirection === 'rtl' ? '0.35rem' : '0',
                display: 'block'
              }}>
                {renderWithMath(text)}
              </div>
            );
          }

          if (type === 'block') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: baseFontSize,
                fontWeight: 600,
                color: color,
                background: bg,
                borderLeft: lineDirection === 'ltr' ? `2px solid ${color}` : 'none',
                borderRight: lineDirection === 'rtl' ? `2px solid ${color}` : 'none',
                borderRadius: '4px',
                padding: '0 0.55rem',
                display: 'block'
              }}>
                {renderWithMath(text)}
              </div>
            );
          }

          if (type === 'bullet') {
            return (
              <div key={idx} className="notebook-line-text" style={{ 
                ...commonStyle,
                display: 'flex', 
                alignItems: 'baseline', 
                gap: '0.4rem',
                paddingLeft: lineDirection === 'ltr' ? '0.4rem' : '0',
                paddingRight: lineDirection === 'rtl' ? '0.4rem' : '0'
              }}>
                <span style={{ color: '#64748b', fontSize: '0.45rem', flexShrink: 0, transform: 'translateY(-1px)' }}>■</span>
                <span style={{ flex: 1 }}>{renderWithMath(text)}</span>
              </div>
            );
          }

          // Default text
          return (
            <div key={idx} className="notebook-line-text" style={{ 
              ...commonStyle,
              display: 'block'
            }}>
              {renderWithMath(text)}
            </div>
          );
        })}
      </div>
    );
  };


  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      
      <style>{`
        /* Notebook Squared Grid Look */
        .squared-grid-cell {
          background-color: #fafbfd;
          background-image: 
            linear-gradient(#e2e8f0 1px, transparent 1px),
            linear-gradient(90deg, #e2e8f0 1px, transparent 1px);
          background-size: ${gridLineHeight}px ${gridLineHeight}px;
          padding: ${gridLineHeight}px !important;
          vertical-align: top;
          min-height: 100px;
        }

        /* Harmonize KaTeX formulas with notebook text size and baseline alignment */
        .squared-grid-cell .katex {
          font-size: 1.04em !important;
          line-height: inherit !important;
          font-weight: inherit !important;
          white-space: nowrap !important;
        }
        .squared-grid-cell .katex-html {
          vertical-align: -0.04em !important;
        }
        .squared-grid-cell .inline-math-container {
          display: inline !important;
          vertical-align: baseline !important;
          white-space: nowrap !important;
        }
        .squared-grid-cell .katex-display {
          margin: 4px 0 !important;
          padding: 2px 0 !important;
          display: block !important;
          text-align: center !important;
        }
        .squared-grid-cell .katex-display .katex {
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

        .notebook-line-text {
          font-family: '${isArMode ? arFont : frFont}', 'Outfit', 'Cairo', sans-serif;
          font-size: ${baseFontSize};
          line-height: ${gridLineHeight}px; /* Aligns text with grid size */
          color: ${colorInk};
          font-weight: 500;
          white-space: pre-wrap;
        }

        @media print {
          /* Force everything to be visible and ignore animations/opacities */
          *, *::before, *::after {
            box-shadow: none !important;
            text-shadow: none !important;
            opacity: 1 !important;
            visibility: visible !important;
            animation: none !important;
            transition: none !important;
          }

          /* Hide navigation & screen-only elements */
          .sidebar, 
          .sidebar-float-toggle, 
          .mobile-bottom-nav, 
          .whatsapp-floating-btn,
          .whatsapp-tooltip-bubble,
          .no-print,
          .no-print * {
            display: none !important;
          }

          /* Show print-only elements */
          .print-only {
            display: flex !important;
          }

          /* Reset layouts for full page printing */
          body, html, #root, .app-layout, .main-content {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            position: static !important;
            display: block !important;
          }

          /* Force text to black except inside th */
          body, html, #root, .app-layout, .main-content, td, div, p, span {
            color: #000000 !important;
          }

          .main-content {
            margin-left: 0 !important;
            padding: 0 !important;
          }

          /* Reset flexbox columns to normal block layout except print-only headers */
          div[style*="display: flex"]:not(.print-only), 
          div[style*="display:flex"]:not(.print-only) {
            display: block !important;
            float: none !important;
            width: 100% !important;
            max-width: 100% !important;
            position: static !important;
          }

          .glass-panel {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Force black text variables */
          :root {
            --text-main: #000000 !important;
            --text-muted: #334155 !important;
            --text-subtle: #475569 !important;
            --border: #000000 !important;
          }

          /* Dotted line fills */
          .print-header-dotted {
            border-bottom: 1px dotted #000000 !important;
            display: inline-block;
            min-width: 120px;
            padding: 0 0.5rem;
            font-weight: bold;
          }

          /* High fidelity squared grid print adjust */
          .squared-grid-cell {
            background-color: #ffffff !important;
            background-image: 
              linear-gradient(#cbd5e1 1px, transparent 1px),
              linear-gradient(90deg, #cbd5e1 1px, transparent 1px) !important;
            background-size: ${gridLineHeight}px ${gridLineHeight}px !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          .squared-grid-cell * {
            background: transparent !important;
          }

          .notebook-table {
            border: 1.5px solid #0f172a !important;
            width: 100% !important;
            border-collapse: collapse !important;
            border-radius: 0 !important;
          }

          .notebook-table th {
            border: 1.5px solid #0f172a !important;
            background-color: #1e3a8a !important; /* Premium navy header */
            color: #ffffff !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            padding: 6px 8px !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            border-radius: 0 !important;
          }

          .notebook-table td {
            border: 1px solid #cbd5e1 !important; /* Soft gray cell borders */
            color: #000000 !important;
            border-radius: 0 !important;
            vertical-align: top !important;
            padding: 6px 8px !important;
          }

          .notebook-table tr {
            border-radius: 0 !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          .print-page-header-row {
            display: table-row !important;
          }
        }
      `}</style>

      {/* ── Screen Header (Hidden on Print) ── */}
      <header className="no-print" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={22} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Cahier de Textes</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
            {isArMode 
              ? 'ملء دفتر النصوص يتم من خلال البرنامج المخصص للقسم المعني.' 
              : 'Le remplissage du cahier de textes se fait à partir du programme officiel attribué à la classe.'}
          </p>
        </div>

        {/* Class Selection Dropdown + MySQL Sync Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleManualCloudSync(false)}
            disabled={isSyncingDb}
            title={isArMode ? 'مزامنة دفتر النصوص وبرامج الأقسام مع قاعدة البيانات MySQL' : 'Synchroniser le cahier de textes et les programmes avec MySQL'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.52rem 0.85rem',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              background: 'rgba(16, 185, 129, 0.08)',
              color: '#059669',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: isSyncingDb ? 'wait' : 'pointer'
            }}
          >
            <RefreshCw size={14} style={{ animation: isSyncingDb ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isSyncingDb ? (isArMode ? 'جاري المزامنة...' : 'Sync...') : (isArMode ? 'مزامنة MySQL' : 'Sync MySQL')}</span>
          </button>

          <label style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)' }}>Classe :</label>
          <select
            className="input-control"
            value={selectedClass ? selectedClass.id : ''}
            onChange={(e) => {
              const cls = classes.find(c => c.id === e.target.value);
              setSelectedClass(cls || null);
            }}
            style={{ width: '220px', fontWeight: 700 }}
          >
            <option value="">-- Choisir une classe --</option>
            {classes.map(c => {
              const isArClass = c.language === 'ar' || c.level?.includes('arts');
              return (
                <option key={c.id} value={c.id}>
                  {c.name} ({isArClass ? 'Arabe' : 'Français'})
                </option>
              );
            })}
          </select>
        </div>
      </header>

      {/* Notifications */}
      {success && (
        <div className="no-print" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)', borderRadius: '12px', padding: '1rem', color: 'var(--emerald)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle2 size={20} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{success}</p>
        </div>
      )}
      {error && (
        <div className="no-print" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '1rem', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle2 size={20} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}

      {/* activeSessionSuggestion Banner */}
      {activeSessionSuggestion && (
        <div className="no-print" style={{ 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.12) 100%)', 
          border: '1px solid var(--violet)', 
          borderRadius: '16px', 
          padding: '1.25rem', 
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--violet)' }}>
              <Clock size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {activeSessionSuggestion.class.language === 'ar' ? 'حصة مجدولة حالياً!' : 'Séance en cours détectée !'}
              </h4>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {activeSessionSuggestion.class.language === 'ar' 
                  ? `لديك حصة مع ${activeSessionSuggestion.class.name} (${activeSessionSuggestion.time}) في القاعة ${activeSessionSuggestion.room}` 
                  : `Vous avez un cours prévu avec ${activeSessionSuggestion.class.name} (${activeSessionSuggestion.time}) en Salle ${activeSessionSuggestion.room}`}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => {
              setSelectedClass(activeSessionSuggestion.class);
              setEditingEntry(null);
              setFormData({
                date: formatLocalDate(),
                // Use the exact displayTime (e.g. "10:00 - 12:00") for merged 2-hour sessions
                time: activeSessionSuggestion.displayTime || activeSessionSuggestion.rawSlot,
                component: 'Cours',
                subject: 'Mathématiques',
                lessonId: '',
                selectedSections: [],
                customContent: '',
                isHeaderSéance: false
              });
              setModalOpen(true);
            }}
            className="btn"
            style={{ 
              fontSize: '0.82rem', 
              padding: '0.45rem 1rem', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.3rem', 
              boxShadow: 'var(--shadow-sm)' 
            }}
          >
            <Check size={14} />
            {activeSessionSuggestion.class.language === 'ar' ? 'تعبئة دفتر النصوص' : 'Remplir le cahier'}
          </button>
        </div>
      )}

      {/* ── Smart Missing Sessions Alert Banner ── */}
      {schedule && Object.keys(schedule).length > 0 && (
        <div className="no-print animate-fade-in" style={{ 
          background: displayMissingSessions.length === 0
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.09) 100%)'
            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.12) 100%)', 
          border: displayMissingSessions.length === 0
            ? '1px solid rgba(16, 185, 129, 0.4)'
            : '1px solid var(--warning)', 
          borderRadius: '16px', 
          padding: '1.25rem', 
          marginBottom: '1.5rem',
          boxShadow: displayMissingSessions.length === 0
            ? '0 4px 20px rgba(16, 185, 129, 0.06)'
            : '0 4px 20px rgba(245, 158, 11, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                width: 36, 
                height: 36, 
                borderRadius: '10px', 
                background: displayMissingSessions.length === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: displayMissingSessions.length === 0 ? 'var(--emerald)' : 'var(--warning)', 
                position: 'relative' 
              }}>
                {displayMissingSessions.length === 0 ? <Check size={18} strokeWidth={3} /> : <Calendar size={18} />}
                {displayMissingSessions.length > 0 && (
                  <span className="animate-pulse" style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: 'var(--warning)' }} />
                )}
              </div>
              
              {(() => {
                const activeMonthObj = getAcademicYearMonths().find(m => m.value === missingDaysFilter);
                const monthLabel = activeMonthObj ? (isArMode ? activeMonthObj.labelAr : activeMonthObj.labelFr) : '';
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {displayMissingSessions.length === 0
                          ? (isArMode ? 'رائع! الحصص مكتملة' : 'Séances au complet !')
                          : (isArMode ? 'تنبيه: حصص غير مسجلة متأخرة!' : 'Séances en retard de saisie !')}
                      </h4>
                      <select
                        value={missingDaysFilter}
                        onChange={e => setMissingDaysFilter(e.target.value)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 1.6rem 0.2rem 0.5rem',
                          borderRadius: '8px',
                          border: displayMissingSessions.length === 0
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : '1px solid rgba(245, 158, 11, 0.3)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          outline: 'none',
                          fontWeight: 700,
                          marginLeft: isArMode ? undefined : '0.5rem',
                          marginRight: isArMode ? '0.5rem' : undefined
                        }}
                      >
                        <option value="30days" style={{ background: 'var(--bg-base)', color: 'var(--text-main)' }}>
                          {isArMode ? 'آخر 30 يوماً' : '30 derniers jours'}
                        </option>
                        {getAcademicYearMonths().map(m => (
                          <option key={m.value} value={m.value} style={{ background: 'var(--bg-base)', color: 'var(--text-main)' }}>
                            {isArMode ? m.labelAr : m.labelFr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {displayMissingSessions.length === 0
                        ? (isArMode
                            ? `عمل رائع! جميع حصصك مسجلة بالكامل لشهر ${monthLabel || 'المحدد'}.`
                            : `Excellent travail ! Toutes vos séances sont documentées pour ${monthLabel || 'la période sélectionnée'}.`)
                        : (isArMode 
                            ? (missingDaysFilter === '30days' 
                                ? `لديك ${displayMissingSessions.length} حصص في الـ 30 يوماً الماضية لم يتم ملؤها في دفتر النصوص.` 
                                : `لديك ${displayMissingSessions.length} حصص غير مسجلة في شهر ${monthLabel}.`) 
                            : (missingDaysFilter === '30days'
                                ? `Vous avez ${displayMissingSessions.length} séances programmées dans les 30 derniers jours et non documentées.`
                                : `Vous avez ${displayMissingSessions.length} séances programmées en ${monthLabel} et non documentées.`))}
                    </p>
                  </div>
                );
              })()}
            </div>
            
            {displayMissingSessions.length > 0 && (
              <button
                onClick={() => setMissingPanelOpen(!missingPanelOpen)}
                className="btn-outline"
                style={{ 
                  fontSize: '0.82rem', 
                  padding: '0.45rem 1rem', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.3rem',
                  borderColor: 'var(--warning)',
                  color: 'var(--warning)',
                  background: 'transparent'
                }}
              >
                {missingPanelOpen 
                  ? (isArMode ? 'إخفاء الحصص' : 'Masquer la liste') 
                  : (isArMode ? 'عرض الحصص المتأخرة' : 'Voir les séances en retard')}
              </button>
            )}
          </div>

          {/* Collapsible Panel with list of missing sessions */}
          {displayMissingSessions.length > 0 && missingPanelOpen && (
            <div style={{ 
              marginTop: '1.25rem', 
              paddingTop: '1.25rem', 
              borderTop: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
              gap: '0.75rem' 
            }}>
              {displayMissingSessions.map(session => (
                <div key={session.id} style={{ 
                  background: 'var(--bg-glass)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '12px', 
                  padding: '0.85rem 1rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {session.class.name}
                    </h5>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} • {session.time}{session.isDoubleHour ? ' (2h)' : ''}
                    </p>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>
                      Salle / القاعة: {session.room}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedClass(session.class);
                      setEditingEntry(null);
                      setFormData({
                        date: session.date,
                        // session.time already has the correct format: "10:00 - 12:00" (no replace needed)
                        time: session.time,
                        component: 'Cours',
                        subject: 'Mathématiques',
                        lessonId: '',
                        selectedSections: [],
                        customContent: '',
                        isHeaderSéance: false
                      });
                      setModalOpen(true);
                    }}
                    className="btn"
                    style={{ 
                      fontSize: '0.75rem', 
                      padding: '0.35rem 0.75rem', 
                      borderRadius: '6px',
                      background: 'var(--warning)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      fontWeight: 750,
                      boxShadow: '0 2px 6px rgba(217, 119, 6, 0.2)'
                    }}
                  >
                    {isArMode ? 'تعبئة' : 'Saisir'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty State ── */}
      {!selectedClass ? (
        <div className="glass-panel no-print" style={{ padding: '3.5rem 2rem', textAlign: 'center', borderRadius: '24px' }}>
          <ClipboardList size={48} style={{ color: 'var(--text-subtle)', marginBottom: '1.25rem', opacity: 0.4 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Aucune classe sélectionnée</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
            Veuillez sélectionner une classe dans le menu déroulant en haut à droite pour afficher et gérer son cahier de textes.
          </p>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          
          {/* Left / Main column: Table & Headers */}
          <div>

          {/* Missing Program Notice Banner */}
          {selectedClass && (!selectedClass.program || selectedClass.program.length === 0) && (
            <div className="no-print" style={{ 
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.12) 100%)', 
              border: '1.5px solid rgba(245, 158, 11, 0.35)', 
              borderRadius: '16px', 
              padding: '1.25rem 1.5rem', 
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              direction: isArMode ? 'rtl' : 'ltr'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={22} color="#d97706" />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {isArMode ? 'تنبيه: لم يتم بعد تعيين برنامج هذا القسم (Programme)' : 'Programme de la classe non configuré'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {isArMode 
                      ? 'ملء وتتبع دفتر النصوص يتم انطلاقاً من البرنامج المخصص للقسم. يمكنك توليد البرنامج الرسمي للمستوى تلقائياً، أو ضبطه يدوياً.' 
                      : 'Le remplissage du cahier de textes se base sur le programme de la classe. Vous pouvez initialiser le programme type du niveau ou le personnaliser.'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAutoGenerateProgram}
                  className="btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.45rem',
                    fontSize: '0.84rem', padding: '0.55rem 1.15rem', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                    border: 'none', color: 'white', fontWeight: 700
                  }}
                >
                  <Sparkles size={15} />
                  {isArMode ? 'توليد برنامج القسم تلقائياً' : 'Générer le programme du niveau'}
                </button>
                <Link
                  to={`/admin/classes/${selectedClass.id}?tab=program`}
                  className="btn-outline"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.45rem',
                    fontSize: '0.84rem', padding: '0.55rem 1.15rem', borderRadius: '10px',
                    color: 'var(--text-main)', borderColor: 'var(--border)'
                  }}
                >
                  <Settings size={15} />
                  {isArMode ? 'إعداد وتخصيص البرنامج' : 'Gérer le programme'}
                </Link>
              </div>
            </div>
          )}
          
          {/* ── Class Header Block (Dotted print style at top) ── */}
          <div className="glass-panel logbook-header-card">
            <style dangerouslySetInnerHTML={{__html: `
              .logbook-header-card {
                padding: 1.5rem 2rem;
                border-radius: 20px;
                margin-bottom: 2rem;
                border: 1px solid var(--border);
                transition: all 0.3s ease;
              }
              .logbook-toolbar-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 1.25rem;
              }
              .logbook-actions-group {
                display: flex;
                gap: 0.65rem;
                align-items: center;
                flex-wrap: wrap;
              }
              .logbook-action-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.48rem;
                height: 42px;
                padding: 0 1.15rem;
                border-radius: 12px;
                font-size: 0.86rem;
                font-weight: 750;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                white-space: nowrap;
                user-select: none;
                text-decoration: none;
                box-sizing: border-box;
                border: 1.5px solid transparent;
              }
              .logbook-action-btn:hover {
                transform: translateY(-2px);
              }
              .logbook-action-btn:active {
                transform: translateY(0) scale(0.97);
              }

              /* Primary: Ajouter une séance */
              .logbook-btn-primary {
                background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
                color: #ffffff !important;
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
              }
              .logbook-btn-primary:hover {
                box-shadow: 0 6px 20px rgba(79, 70, 229, 0.48);
                background: linear-gradient(135deg, #4338ca 0%, #4f46e5 100%);
              }

              /* Remplir auto: Emerald smart fill */
              .logbook-btn-auto {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.16) 100%);
                border: 1.5px solid rgba(16, 185, 129, 0.45);
                color: var(--emerald, #10b981) !important;
                box-shadow: 0 2px 8px rgba(16, 185, 129, 0.12);
              }
              .logbook-btn-auto:hover {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.26) 100%);
                border-color: rgba(16, 185, 129, 0.65);
                box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
              }

              /* Programme & Progression: Violet subtle */
              .logbook-btn-prog {
                background: rgba(99, 102, 241, 0.08);
                border: 1.5px solid rgba(99, 102, 241, 0.35);
                color: var(--violet, #6366f1) !important;
              }
              .logbook-btn-prog:hover {
                background: rgba(99, 102, 241, 0.16);
                border-color: rgba(99, 102, 241, 0.55);
              }

              /* Imprimer: Neutral glass */
              .logbook-btn-print {
                background: rgba(255, 255, 255, 0.03);
                border: 1.5px solid var(--border, rgba(255, 255, 255, 0.15));
                color: var(--text-main, #0f172a) !important;
              }
              .logbook-btn-print:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: var(--border-hover, rgba(255, 255, 255, 0.3));
              }

              /* Responsive Rules for Mobile */
              @media (max-width: 768px) {
                .logbook-header-card {
                  padding: 1.15rem 1rem !important;
                  border-radius: 16px !important;
                  margin-bottom: 1.25rem !important;
                }
                .logbook-toolbar-row {
                  flex-direction: column !important;
                  align-items: stretch !important;
                  gap: 1rem !important;
                }
                .logbook-actions-group {
                  display: grid !important;
                  grid-template-columns: 1fr 1fr !important;
                  gap: 0.55rem !important;
                  width: 100% !important;
                }
                .logbook-action-btn {
                  width: 100% !important;
                  height: 44px !important;
                  padding: 0 0.4rem !important;
                  font-size: 0.82rem !important;
                  border-radius: 11px !important;
                }
                .logbook-btn-label-long {
                  display: none !important;
                }
                .logbook-btn-label-short {
                  display: inline !important;
                }
              }
              @media (min-width: 769px) {
                .logbook-btn-label-long {
                  display: inline !important;
                }
                .logbook-btn-label-short {
                  display: none !important;
                }
              }
            `}} />
            
            {/* Screen layout */}
            <div className="no-print logbook-toolbar-row">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.3rem' }}>
                  <button 
                    onClick={() => setManualLanguage(prev => (isArMode ? 'fr' : 'ar'))}
                    title="اضغط لتغيير لغة العرض والطباعة بين العربية والفرنسية"
                    style={{ 
                      background: isArMode ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', 
                      color: 'white', fontWeight: 900, fontSize: '0.75rem', padding: '0.35rem 0.8rem', borderRadius: '8px',
                      border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                    }}
                  >
                    🌐 {isArMode ? 'خيار عربي (RTL)' : 'Option Français (BIOF)'}
                  </button>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>{selectedClass.name}</h2>
                </div>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Niveau : <strong>{selectedClassLevelLabel}</strong> • Année Scolaire : <strong>{getAcademicYearDates().label}</strong> • Enseignant : <strong>{profName || 'Professeur'}</strong>
                </p>
              </div>

              {/* Action Buttons Toolbar - 2x2 on Mobile, Inline on Desktop */}
              <div className="logbook-actions-group">
                {selectedClass && selectedClass.program && selectedClass.program.length > 0 && (
                  <button
                    onClick={handleOpenAddFromProgram}
                    className="logbook-action-btn logbook-btn-auto"
                    title={isArMode ? 'تعبئة سريعة للحصة التالية من المقرر' : 'Remplir automatiquement la prochaine séance du programme'}
                  >
                    <Sparkles size={16} /> 
                    <span>{isArMode ? 'تعبئة تلقائية' : 'Remplir auto'}</span>
                  </button>
                )}

                <button
                  onClick={handleOpenAddModal}
                  className="logbook-action-btn logbook-btn-primary"
                  title={isArMode ? 'إضافة حصة جديدة في دفتر النصوص' : 'Ajouter manuellement une séance au cahier de textes'}
                >
                  <Plus size={17} strokeWidth={2.5} /> 
                  <span className="logbook-btn-label-long">{isArMode ? 'إضافة حصة' : 'Ajouter une séance'}</span>
                  <span className="logbook-btn-label-short">{isArMode ? 'إضافة حصة' : '+ Séance'}</span>
                </button>

                {selectedClass && selectedClass.program && selectedClass.program.length > 0 && (
                  <button
                    onClick={() => setProgramDrawerOpen(true)}
                    className="logbook-action-btn logbook-btn-prog"
                    title={isArMode ? 'عرض البرنامج الرسمي ومؤشر التقدم' : 'Consulter le programme officiel et la progression'}
                  >
                    <ListOrdered size={16} /> 
                    <span className="logbook-btn-label-long">
                      {isArMode ? `البرنامج والتقدم (${selectedClass.program.length})` : `Programme & Progression (${selectedClass.program.length})`}
                    </span>
                    <span className="logbook-btn-label-short">
                      {isArMode ? `البرنامج (${selectedClass.program.length})` : `Prog. (${selectedClass.program.length})`}
                    </span>
                  </button>
                )}
                
                <button
                  onClick={triggerPrint}
                  className="logbook-action-btn logbook-btn-print"
                  title={isArMode ? 'طباعة دفتر النصوص' : 'Imprimer le cahier de textes'}
                >
                  <Printer size={16} /> 
                  <span>{isArMode ? 'طباعة' : 'Imprimer'}</span>
                </button>
              </div>
            </div>

            {/* Print Dotted Layout (Only visible when printing) */}
            <div className="print-only" style={{ 
              display: 'none', 
              width: '100%', 
              flexDirection: 'column',
              fontFamily: "'UKIJ Merdane', 'Outfit', 'Cairo', sans-serif", 
              color: '#0f172a',
              marginBottom: '1.5rem' 
            }}>
              {/* Top Official Header Card */}
              <div style={{ 
                borderTop: '4px solid #1e3a8a',
                background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
                borderRadius: '12px',
                padding: '14px 18px 12px',
                border: '1px solid #e2e8f0',
                marginBottom: '14px',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', direction: isArMode ? 'rtl' : 'ltr' }}>
                  {/* Left Dept */}
                  <div style={{
                    fontSize: '0.72rem',
                    lineHeight: 1.45,
                    color: '#334155',
                    textAlign: isArMode ? 'right' : 'left',
                    borderLeft: isArMode ? 'none' : '3.5px solid #3b82f6',
                    borderRight: isArMode ? '3.5px solid #3b82f6' : 'none',
                    paddingLeft: isArMode ? 0 : '10px',
                    paddingRight: isArMode ? '10px' : 0,
                  }}>
                    {isArMode ? (
                      <>
                        <div style={{ fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.04em' }}>المملكة المغربية</div>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                        <div style={{ color: '#475569', fontWeight: 600 }}>{profAcademy || 'الأكاديمية الجهوية للتربية والتكوين'}</div>
                        <div style={{ color: '#1e3a8a', fontWeight: 800, marginTop: '2px' }}>{profSchool || "مؤسسة L'CONQ للتميز"}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.04em' }}>Royaume du Maroc</div>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>Ministère de l'Éducation Nationale</div>
                        <div style={{ color: '#475569', fontWeight: 600 }}>{profAcademy || "Académie Régionale de l'Éducation et de la Formation"}</div>
                        <div style={{ color: '#1e3a8a', fontWeight: 800, marginTop: '2px' }}>{profSchool || "Établissement L'CONQ d'Excellence"}</div>
                      </>
                    )}
                  </div>

                  {/* Center Brand & Document Title Banner */}
                  <div style={{ textAlign: 'center', padding: '0 10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.85rem', fontWeight: 950, color: '#1e1b4b', letterSpacing: '-0.04em', lineHeight: 1, fontFamily: 'Outfit, sans-serif' }}>
                        L'CONQ
                      </span>
                      <span style={{ fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.2em', color: '#6366f1', textTransform: 'uppercase', marginTop: '1px' }}>
                        EXCELLENCE ACADÉMIQUE
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.78rem',
                      fontWeight: 900,
                      color: '#ffffff',
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                      padding: '5px 16px',
                      borderRadius: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginTop: '6px',
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 3px 8px rgba(15, 23, 42, 0.18)',
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      {isArMode ? 'دفتر النصوص الإلكتروني' : 'CAHIER DE TEXTES ÉLECTRONIQUE'}
                    </div>
                    <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '3px' }}>
                      {isArMode ? 'وثيقة رسمية للتتبع التربوي' : 'DOCUMENT OFFICIEL DE SUIVI PÉDAGOGIQUE'}
                    </div>
                  </div>

                  {/* Right Metadata */}
                  <div style={{ textAlign: isArMode ? 'left' : 'right', fontSize: '0.72rem', lineHeight: 1.6 }}>
                    <div>
                      <span style={{ color: '#64748b', fontWeight: 700 }}>{isArMode ? 'السنة الدراسية: ' : 'Année Scolaire : '}</span>
                      <span style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', fontWeight: 900, padding: '2px 8px', borderRadius: '5px', fontSize: '0.75rem' }}>
                        {getAcademicYearDates().label}
                      </span>
                    </div>
                    <div style={{ marginTop: '4px', color: '#0f172a', fontWeight: 700 }}>
                      {isArMode ? 'تاريخ الطبع: ' : 'Imprimé le : '} <strong>{new Date().toLocaleDateString('fr-FR')}</strong>
                    </div>
                    <div style={{ marginTop: '2px', background: '#d1fae5', color: '#059669', fontWeight: 900, padding: '1px 7px', borderRadius: '4px', display: 'inline-block', fontSize: '0.65rem' }}>
                      L'CONQ OS 2026
                    </div>
                  </div>
                </div>

                {/* Coordinates Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, 1fr)', 
                  gap: '8px', 
                  marginTop: '12px',
                  fontSize: '0.75rem',
                  direction: isArMode ? 'rtl' : 'ltr'
                }}>
                  <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {isArMode ? 'المستوى' : 'Niveau'}
                    </span>
                    <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{selectedClassLevelLabel}</strong>
                  </div>
                  <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {isArMode ? 'القسم / الفوج' : 'Classe / Groupe'}
                    </span>
                    <strong style={{ color: '#4f46e5', fontSize: '0.85rem' }}>{selectedClass.name}</strong>
                  </div>
                  <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {isArMode ? 'المادة الدراسية' : 'Matière'}
                    </span>
                    <strong style={{ color: '#059669', fontSize: '0.85rem' }}>{selectedClass.subject || 'Mathématiques'}</strong>
                  </div>
                  <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {isArMode ? 'الأستاذ المؤطر' : 'Enseignant'}
                    </span>
                    <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{profName || 'Prof. L\'CONQ'}</strong>
                  </div>
                </div>
              </div>

          </div>

          {/* ── Timetable Logbook entries table ── */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '24px', overflowX: 'auto', border: '1px solid var(--border)' }}>
            {/* Column visibility toggle bar (Horaire & Composant) */}
            <div className="no-print" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.6rem',
              marginBottom: '0.85rem',
              paddingBottom: '0.7rem',
              borderBottom: '1px dashed var(--border)',
              direction: isArMode ? 'rtl' : 'ltr'
            }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                {isArMode ? 'إظهار / إخفاء أعمدة الجدول (تُطبق أيضاً على الطباعة PDF):' : 'Colonnes optionnelles (appliquées aussi au PDF) :'}
              </span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={toggleHoraireCol}
                  style={{
                    padding: '0.32rem 0.8rem',
                    borderRadius: '99px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: `1.5px solid ${showHoraireCol ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.4)'}`,
                    background: showHoraireCol ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                    color: showHoraireCol ? '#059669' : '#dc2626',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.15s'
                  }}
                >
                  <span>{showHoraireCol ? '✓' : '✕'}</span>
                  <span>{isArMode ? 'عمود التوقيت (Horaire)' : 'Horaire'}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleComposantCol}
                  style={{
                    padding: '0.32rem 0.8rem',
                    borderRadius: '99px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: `1.5px solid ${showComposantCol ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.4)'}`,
                    background: showComposantCol ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                    color: showComposantCol ? '#059669' : '#dc2626',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.15s'
                  }}
                >
                  <span>{showComposantCol ? '✓' : '✕'}</span>
                  <span>{isArMode ? 'عمود المكون (Composant)' : 'Composant'}</span>
                </button>
              </div>
            </div>
            
            {/* Arabic Class Table (RTL) */}
            {isArMode ? (
              <table className="notebook-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', direction: 'rtl', textAlign: 'right' }}>
                <thead>
                  {/* Print-only page header repeating row */}
                  <tr className="print-page-header-row" style={{ display: 'none' }}>
                    <th colSpan={visibleLogbookColCount} style={{ 
                      padding: '10px 16px', 
                      backgroundColor: '#f8fafc', 
                      border: '1.5px solid #0f172a',
                      color: '#0f172a',
                      textAlign: 'right',
                      fontFamily: "'Cairo', sans-serif"
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', direction: 'rtl' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#4f46e5', fontWeight: 900, fontSize: '1rem', letterSpacing: '-0.02em' }}>L'CONQ</span>
                          <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>| دفتر النصوص المنجزة</span>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', fontSize: '0.8rem', fontWeight: 850 }}>
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>القسم:</span>
                            <span style={{ marginRight: '6px', color: '#0f172a', background: 'rgba(79, 70, 229, 0.08)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(79, 70, 229, 0.15)' }}>{selectedClass.name}</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>المادة:</span>
                            <span style={{ marginRight: '6px', color: '#0f172a', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>{selectedClass.subject || 'الرياضيات'}</span>
                          </div>
                        </div>
                      </div>
                    </th>
                  </tr>
                  <tr style={{ background: getClassColor(selectedClass), borderBottom: `2px solid ${getClassColor(selectedClass)}` }}>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>التاريخ</th>
                    {showHoraireCol && <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>التوقيت</th>}
                    {showComposantCol && <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>المكون</th>}
                    <th style={{ padding: '0.85rem', width: activityColWidth, fontWeight: 800, border: '1px solid var(--border)', color: '#ffffff' }}>طبيعة الأنشطة المنجزة</th>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>التوقيع</th>
                    <th className="no-print" style={{ padding: '0.85rem', width: '100px', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-main)' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', background: e.isHolidayEntry ? 'rgba(22, 163, 74, 0.02)' : 'transparent' }}>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 700, color: 'var(--text-main)', fontSize: e.displayDate ? '0.8rem' : 'inherit' }}>
                        {e.displayDate ? e.displayDate : new Date(e.date).toLocaleDateString('fr-FR')}
                      </td>
                      {showHoraireCol && (
                        <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {e.time || '—'}
                        </td>
                      )}
                      {showComposantCol && (
                        <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {e.isHolidayEntry ? (
                            <span style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.76rem' }}>
                              عطلة مدرسية
                            </span>
                          ) : e.isAbsenceEntry ? (
                            <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#b91c1c', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.76rem' }}>
                              رخصة
                            </span>
                          ) : (
                            getTranslatedComponent(e.component, true)
                          )}
                        </td>
                      )}
                      <td className={e.isHolidayEntry || e.isAbsenceEntry ? "normal-cell" : "squared-grid-cell"} style={{ border: '1px solid var(--border)', verticalAlign: 'middle' }}>
                        {e.isHolidayEntry ? (
                          <div style={{
                            padding: '0.65rem 1rem',
                            background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.09) 0%, rgba(16, 185, 129, 0.04) 100%)',
                            border: '1px dashed rgba(22, 163, 74, 0.4)',
                            borderRadius: '8px',
                            color: '#15803d',
                            fontWeight: 800,
                            textAlign: 'center',
                            fontSize: '0.86rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                          }}>
                            <span>🌴</span>
                            <span>{e.customContent.replace(/===/g, '').trim()}</span>
                          </div>
                        ) : e.isAbsenceEntry ? (
                          <div style={{
                            padding: '0.65rem 1rem',
                            background: 'rgba(239, 68, 68, 0.07)',
                            border: '1px dashed rgba(239, 68, 68, 0.35)',
                            borderRadius: '8px',
                            color: '#b91c1c',
                            fontWeight: 800,
                            textAlign: 'center',
                            fontSize: '0.86rem'
                          }}>
                            {e.customContent.replace(/===/g, '').trim()}
                          </div>
                        ) : (
                          renderActivityContent(e.customContent, e.isHeaderSéance)
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'middle' }}>
                        {e.isHolidayEntry || e.isAbsenceEntry ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Signé</span>
                        )}
                      </td>
                      <td className="no-print" style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'middle' }}>
                        {e.isHolidayEntry || e.isAbsenceEntry ? (
                          <span style={{ fontSize: '0.75rem', color: e.isHolidayEntry ? '#15803d' : '#b91c1c', fontStyle: 'italic', fontWeight: 700 }}>
                            {e.isHolidayEntry ? 'عطلة' : 'رخصة'}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button onClick={() => handleOpenEditModal(e)} style={{ background: 'transparent', border: 'none', color: 'var(--violet)', cursor: 'pointer', padding: '0.3rem' }} title="Modifier">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(e)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem' }} title="Supprimer">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={visibleLogbookColCount} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        لا توجد حصص مسجلة في دفتر النصوص حالياً. اضغط على "إضافة حصة" لبدء التعبئة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              /* French Class Table (LTR) */
              <table className="notebook-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', direction: 'ltr', textAlign: 'left' }}>
                <thead>
                  {/* Print-only page header repeating row */}
                  <tr className="print-page-header-row" style={{ display: 'none' }}>
                    <th colSpan={visibleLogbookColCount} style={{ 
                      padding: '10px 16px', 
                      backgroundColor: '#f8fafc', 
                      border: '1.5px solid #0f172a',
                      color: '#0f172a',
                      textAlign: 'left',
                      fontFamily: "'Outfit', sans-serif"
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', direction: 'ltr' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#4f46e5', fontWeight: 900, fontSize: '1rem', letterSpacing: '-0.02em' }}>L'CONQ</span>
                          <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>| Cahier de Textes</span>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', fontSize: '0.8rem', fontWeight: 850 }}>
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>Classe :</span>
                            <span style={{ marginLeft: '6px', color: '#0f172a', background: 'rgba(79, 70, 229, 0.08)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(79, 70, 229, 0.15)' }}>{selectedClass.name}</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>Matière :</span>
                            <span style={{ marginLeft: '6px', color: '#0f172a', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>{selectedClass.subject || 'Mathématiques'}</span>
                          </div>
                        </div>
                      </div>
                    </th>
                  </tr>
                  <tr style={{ background: getClassColor(selectedClass), borderBottom: `2px solid ${getClassColor(selectedClass)}` }}>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>Date</th>
                    {showHoraireCol && <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>Horaire</th>}
                    {showComposantCol && <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>Composant</th>}
                    <th style={{ padding: '0.85rem', width: activityColWidth, fontWeight: 800, border: '1px solid var(--border)', color: '#ffffff' }}>Nature des activités réalisées</th>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>Signature</th>
                    <th className="no-print" style={{ padding: '0.85rem', width: '100px', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-main)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', background: e.isHolidayEntry ? 'rgba(22, 163, 74, 0.02)' : 'transparent' }}>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 700, color: 'var(--text-main)', fontSize: e.displayDate ? '0.8rem' : 'inherit' }}>
                        {e.displayDate ? e.displayDate : new Date(e.date).toLocaleDateString('fr-FR')}
                      </td>
                      {showHoraireCol && (
                        <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {e.time || '—'}
                        </td>
                      )}
                      {showComposantCol && (
                        <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {e.isHolidayEntry ? (
                            <span style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.76rem' }}>
                              Vacances scolaires
                            </span>
                          ) : e.isAbsenceEntry ? (
                            <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#b91c1c', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.76rem' }}>
                              Absence
                            </span>
                          ) : (
                            getTranslatedComponent(e.component, false)
                          )}
                        </td>
                      )}
                      <td className={e.isHolidayEntry || e.isAbsenceEntry ? "normal-cell" : "squared-grid-cell"} style={{ border: '1px solid var(--border)', verticalAlign: 'middle' }}>
                        {e.isHolidayEntry ? (
                          <div style={{
                            padding: '0.65rem 1rem',
                            background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.09) 0%, rgba(16, 185, 129, 0.04) 100%)',
                            border: '1px dashed rgba(22, 163, 74, 0.4)',
                            borderRadius: '8px',
                            color: '#15803d',
                            fontWeight: 800,
                            textAlign: 'center',
                            fontSize: '0.86rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                          }}>
                            <span>🌴</span>
                            <span>{e.customContent.replace(/===/g, '').trim()}</span>
                          </div>
                        ) : e.isAbsenceEntry ? (
                          <div style={{
                            padding: '0.65rem 1rem',
                            background: 'rgba(239, 68, 68, 0.07)',
                            border: '1px dashed rgba(239, 68, 68, 0.35)',
                            borderRadius: '8px',
                            color: '#b91c1c',
                            fontWeight: 800,
                            textAlign: 'center',
                            fontSize: '0.86rem'
                          }}>
                            {e.customContent.replace(/===/g, '').trim()}
                          </div>
                        ) : (
                          renderActivityContent(e.customContent, e.isHeaderSéance)
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'middle' }}>
                        {e.isHolidayEntry || e.isAbsenceEntry ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Signé</span>
                        )}
                      </td>
                      <td className="no-print" style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'middle' }}>
                        {e.isHolidayEntry || e.isAbsenceEntry ? (
                          <span style={{ fontSize: '0.75rem', color: e.isHolidayEntry ? '#15803d' : '#b91c1c', fontStyle: 'italic', fontWeight: 700 }}>
                            {e.isHolidayEntry ? 'Vacances' : 'Absence'}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button onClick={() => handleOpenEditModal(e)} style={{ background: 'transparent', border: 'none', color: 'var(--violet)', cursor: 'pointer', padding: '0.3rem' }} title="Modifier">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(e)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem' }} title="Supprimer">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={visibleLogbookColCount} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Aucune séance enregistrée pour le moment. Cliquez sur "Ajouter une séance" pour commencer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            
          </div>

          {/* Dotted Signatures block at bottom (only visible on print) */}
          <div className="print-only" style={{ display: 'none', marginTop: '3.5rem', width: '100%', fontFamily: "'UKIJ Merdane', 'Outfit', 'Cairo', sans-serif" }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', width: '100%', direction: isArMode ? 'rtl' : 'ltr' }}>
              <div style={{ border: '1px dashed #94a3b8', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                  {isArMode ? 'توقيع المفتش التربوي' : "Signature de l'Inspecteur"}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3.5rem' }}>..........................................</div>
              </div>
              <div style={{ border: '1px dashed #94a3b8', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                  {isArMode ? 'توقيع رئيس المؤسسة' : "Signature du Directeur"}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3.5rem' }}>..........................................</div>
              </div>
              <div style={{ border: '1px dashed #94a3b8', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                  {isArMode ? 'توقيع الأستاذ' : "Signature de l'Enseignant"}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 700, marginTop: '1.5rem', marginBottom: '0.5rem' }}>{profName || 'Professeur'}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem' }}>..........................................</div>
              </div>
            </div>
          </div>

          </div>

        </div>
      </div>
    )}

      {/* ── Programme & Progression de la classe Drawer (Unified) ── */}
      {programDrawerOpen && (
        <>
          <div 
            onClick={() => setProgramDrawerOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
              zIndex: 9999, animation: 'fadeInLogbook 0.2s ease-out'
            }}
          />
          <div 
            className="no-print"
            style={{
              position: 'fixed', top: 0, right: isArMode ? 'auto' : 0, left: isArMode ? 0 : 'auto', bottom: 0,
              width: '430px', maxWidth: '92vw', background: 'var(--bg-card)',
              borderLeft: isArMode ? 'none' : '1px solid var(--border)',
              borderRight: isArMode ? '1px solid var(--border)' : 'none',
              boxShadow: '0 0 35px rgba(0,0,0,0.4)', zIndex: 10000,
              padding: '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem',
              direction: isArMode ? 'rtl' : 'ltr', animation: 'slideInRightLogbook 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.18rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ListOrdered size={20} color="var(--violet)" />
                  {isArMode ? 'برنامج وتقدم المقرر' : 'Programme & Progression'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {selectedClass ? `${selectedClass.name} • ${selectedClass.program?.length || 0} ${isArMode ? 'عناصر مقررة' : 'activités'}` : ''}
                </p>
              </div>
              <button 
                onClick={() => setProgramDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Overall Progress Summary Card */}
            {selectedClass?.program && selectedClass.program.length > 0 && (() => {
              const total = selectedClass.program.length;
              const doneCount = selectedClass.program.filter(item => getProgramItemStatus(item).isDone).length;
              const overallPct = Math.round((doneCount / total) * 100);
              return (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '1rem 1.15rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle2 size={16} color="var(--emerald)" />
                      {isArMode ? 'مستوى الإنجاز العام' : 'Progression Globale'}
                    </span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: overallPct === 100 ? 'var(--emerald)' : 'var(--violet)' }}>
                      {overallPct}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${overallPct}%`,
                      height: '100%',
                      borderRadius: '4px',
                      background: overallPct === 100
                        ? 'linear-gradient(90deg, var(--emerald) 0%, #34d399 100%)'
                        : 'linear-gradient(90deg, var(--violet) 0%, var(--emerald) 100%)',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.45rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>{doneCount} / {total} {isArMode ? 'عناصر منجزة' : 'éléments complétés'}</span>
                    <span>{total - doneCount} {isArMode ? 'متبقية' : 'restants'}</span>
                  </div>
                </div>
              );
            })()}

            <style dangerouslySetInnerHTML={{__html: `
              @keyframes fadeInLogbook {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideInRightLogbook {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `}} />

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
              {(!selectedClass?.program || selectedClass.program.length === 0) ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontWeight: 700 }}>{isArMode ? 'لم يتم تحديد برنامج لهذا القسم بعد.' : 'Aucun programme défini.'}</p>
                  <button onClick={handleAutoGenerateProgram} className="btn" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
                    ⚡ {isArMode ? 'توليد البرنامج تلقائياً' : 'Générer le programme'}
                  </button>
                </div>
              ) : (
                selectedClass.program.map((item, pIdx) => {
                  const status = getProgramItemStatus(item);
                  return (
                    <div 
                      key={item.id} 
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: status.isDone ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border)',
                        borderRadius: '12px', padding: '0.85rem 1rem',
                        display: 'flex', flexDirection: 'column', gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                          <span style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            background: 'var(--bg-glass)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0
                          }}>
                            {pIdx + 1}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 800,
                          color: status.color, background: status.bg,
                          padding: '0.15rem 0.45rem', borderRadius: '4px', flexShrink: 0
                        }}>
                          {status.label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.4rem' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700,
                          color: item.type === 'homework' ? 'var(--danger)' : item.type === 'exercises' ? 'var(--warning)' : 'var(--violet)',
                          textTransform: 'uppercase'
                        }}>
                          {item.type === 'homework' ? (isArMode ? 'فرض محروس' : 'devoir') : item.type === 'exercises' ? (isArMode ? 'تمارين' : 'série') : (isArMode ? 'درس' : 'cours')}
                        </span>
                        {!status.isDone ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAddSpecificProgramItem(item)}
                            className="btn"
                            style={{
                              padding: '0.25rem 0.75rem', fontSize: '0.72rem', borderRadius: '8px',
                              background: 'linear-gradient(135deg, var(--violet) 0%, #4338ca 100%)',
                              border: 'none', fontWeight: 700
                            }}
                          >
                            ⚡ {isArMode ? 'تعبئة في دفتر النصوص' : 'Saisir cette séance'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--emerald)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Check size={13} strokeWidth={3} /> {isArMode ? 'منجز' : 'Validé'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedClass && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', textAlign: 'center' }}>
                <Link
                  to={`/admin/classes/${selectedClass.id}?tab=program`}
                  className="btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.5rem 1rem', borderRadius: '8px' }}
                >
                  <Settings size={14} /> {isArMode ? 'إعداد وترتيب برنامج القسم' : 'Modifier le programme'}
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Add / Edit Séance Modal ── */}
      {modalOpen && (
        <div style={{
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(9, 9, 11, 0.65)', 
          backdropFilter: 'blur(10px)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999, 
          padding: '1rem',
          animation: 'modalFadeIn 0.25s ease'
        }}>
          {/* Custom style overrides for modal controls */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes modalFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes modalScaleIn {
              from { transform: scale(0.96); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            .modal-input {
              background: rgba(255, 255, 255, 0.02) !important;
              border: 1px solid var(--border) !important;
              color: var(--text-main) !important;
              border-radius: 12px !important;
              padding: 0.75rem 1rem !important;
              font-size: 0.9rem !important;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
              width: 100% !important;
              outline: none !important;
            }
            .modal-input:focus {
              border-color: var(--violet) !important;
              box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15) !important;
              background: rgba(255, 255, 255, 0.04) !important;
            }
            .modal-close-btn {
              background: transparent;
              border: none;
              color: var(--text-muted);
              cursor: pointer;
              padding: 0.5rem;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s ease;
            }
            .modal-close-btn:hover {
              background: rgba(255, 255, 255, 0.05);
              color: var(--text-main);
              transform: rotate(90deg);
            }
            .quick-tag-btn-ar {
              font-size: 0.75rem !important;
              padding: 0.35rem 0.8rem !important;
              border-radius: 20px !important;
              background: rgba(245, 158, 11, 0.05) !important;
              border: 1px solid rgba(245, 158, 11, 0.2) !important;
              color: var(--warning) !important;
              cursor: pointer !important;
              font-weight: 700 !important;
              transition: all 0.2s ease !important;
            }
            .quick-tag-btn-ar:hover {
              background: rgba(245, 158, 11, 0.12) !important;
              border-color: var(--warning) !important;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(245, 158, 11, 0.1);
            }
            .quick-tag-btn-fr {
              font-size: 0.75rem !important;
              padding: 0.35rem 0.8rem !important;
              border-radius: 20px !important;
              background: rgba(139, 92, 246, 0.05) !important;
              border: 1px solid rgba(139, 92, 246, 0.2) !important;
              color: var(--violet) !important;
              cursor: pointer !important;
              font-weight: 700 !important;
              transition: all 0.2s ease !important;
            }
            .quick-tag-btn-fr:hover {
              background: rgba(139, 92, 246, 0.12) !important;
              border-color: var(--violet) !important;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
            }
            .modal-save-btn {
              background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%) !important;
              color: #ffffff !important;
              border: none !important;
              box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3) !important;
              transition: all 0.2s ease !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 0.5rem !important;
            }
            .modal-save-btn:hover {
              background: linear-gradient(135deg, #7c3aed 0%, #4338ca 100%) !important;
              transform: translateY(-1px) !important;
              box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4) !important;
            }
          `}} />

          <div className="glass-panel" style={{ 
            maxWidth: '620px', 
            width: '100%', 
            padding: '2.25rem', 
            maxHeight: '92vh', 
            overflowY: 'auto', 
            borderRadius: '24px', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            background: 'var(--bg-card)',
            animation: 'modalScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                  {editingEntry 
                    ? (isArMode ? "تعديل حصة دفتر النصوص" : "Modifier la séance") 
                    : (isArMode ? "إضافة حصة جديدة" : "Ajouter une séance")}
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedClass?.name} • {getAcademicYearDates().label}
                </p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="animate-fade-in" style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid var(--danger)', 
                borderRadius: '12px', 
                padding: '0.85rem 1.25rem', 
                color: 'var(--danger)', 
                marginBottom: '1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.6rem', 
                fontSize: '0.85rem' 
              }}>
                <AlertCircle size={18} />
                <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {/* Date */}
                <div className="input-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>Date</label>
                  <input
                    type="date"
                    required
                    className="modal-input"
                    value={formData.date}
                    onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                  {(() => {
                    const activeHol = holidays.find(h => 
                      h.startDate && h.endDate && formData.date >= h.startDate && formData.date <= h.endDate
                    );
                    if (!activeHol) return null;
                    return (
                      <div style={{
                        marginTop: '0.45rem',
                        padding: '0.45rem 0.75rem',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '8px',
                        color: 'var(--warning)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <span>🌴</span>
                        <span>
                          {isArMode 
                            ? `تنبيه: هذا التاريخ يوافق عطلة مدرسية: "${activeHol.label}"`
                            : `Attention : Cette date coïncide avec des vacances scolaires : "${activeHol.label}"`}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Time */}
                <div className="input-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>Horaire / Durée</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 08:00 - 10:00"
                    className="modal-input"
                    value={formData.time}
                    onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  />
                </div>
              </div>

              {/* Component Pills Selection */}
              <div className="input-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
                  Composant(s)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                  {[
                    { value: 'Cours', labelAr: 'درس', labelFr: 'Cours' },
                    { value: 'Exercices', labelAr: 'تمارين', labelFr: 'Exercices' },
                    { value: 'Contrôle', labelAr: 'فرض', labelFr: 'Contrôle' },
                    { value: 'Activité', labelAr: 'نشاط', labelFr: 'Activité' }
                  ].map(item => {
                    const isSelected = getSelectedComponents(formData.component).includes(item.value);
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleComponent(item.value)}
                        style={{
                          fontSize: '0.82rem',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          transition: 'all 0.2s ease',
                          background: isSelected 
                            ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' 
                            : 'rgba(255, 255, 255, 0.04)',
                          border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#ffffff' : '#a1a1aa',
                          boxShadow: isSelected ? '0 4px 15px rgba(139, 92, 246, 0.3)' : 'none'
                        }}
                      >
                        {isArMode ? item.labelAr : item.labelFr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Programme / Lesson Selection */}
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                    {isProgramOnlyMode
                      ? (isArMode ? 'عنصر من برنامج القسم المعتمد (المحتوى المقرر فقط) :' : 'Élément du programme officiel (Programme uniquement) :')
                      : (isArMode ? 'عنصر من برنامج القسم أو المكتبة :' : 'Élément du programme ou des cours :')}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {selectedClass && selectedClass.program && selectedClass.program.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsProgramOnlyMode(prev => !prev)}
                        title={isProgramOnlyMode ? (isArMode ? 'إظهار جميع وثائق ودروس المكتبة' : 'Afficher l\'ensemble des cours et séries') : (isArMode ? 'تحديد عناصر برنامج القسم فقط' : 'Restreindre au programme de la classe')}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 750,
                          padding: '0.2rem 0.65rem',
                          borderRadius: '8px',
                          border: isProgramOnlyMode ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--border)',
                          background: isProgramOnlyMode ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                          color: isProgramOnlyMode ? 'var(--emerald)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Sparkles size={12} />
                        {isProgramOnlyMode 
                          ? (isArMode ? 'البرنامج فقط ✓' : 'Programme seul ✓') 
                          : (isArMode ? 'تصفية بالبرنامج' : 'Filtrer par programme')}
                      </button>
                    )}
                    {selectedClass && selectedClass.program && selectedClass.program.length > 0 && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--violet)', fontWeight: 700 }}>
                        ⭐ {selectedClass.program.length} {isArMode ? 'عناصر' : 'éléments'}
                      </span>
                    )}
                  </div>
                </div>
                <select
                  className="modal-input"
                  value={formData.selectedProgramItemId ? `prog_item_${formData.selectedProgramItemId}` : formData.lessonId}
                  onChange={e => handleLessonChange(e.target.value)}
                >
                  <option value="">{isArMode ? '-- اختر عنصراً من برنامج القسم --' : '-- Sélectionner un élément du programme --'}</option>
                  
                  {/* 1. Class Program Items (First Priority / Sole items if isProgramOnlyMode) */}
                  {selectedClass && selectedClass.program && selectedClass.program.length > 0 && (
                    <optgroup label={isArMode ? '⭐ برنامج القسم المعتمد (مرتب حسب التدرج)' : '⭐ Programme officiel de la classe'}>
                      {selectedClass.program.map((item, pIdx) => {
                        const status = getProgramItemStatus(item);
                        return (
                          <option key={`prog_${item.id}`} value={`prog_item_${item.id}`}>
                            {pIdx + 1}. {item.title} {status.isDone ? (isArMode ? '✓ (منجز)' : '✓ (Complété)') : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}

                  {/* 2. Courses / الدروس - Only shown when not in program-only mode */}
                  {!isProgramOnlyMode && levelLessons.filter(l => l.docType === 'course' || (!l.docType && !l.isExam)).length > 0 && (
                    <optgroup label={isArMode ? '📖 دروس وفصول إضافية' : '📖 Fiches de cours'}>
                      {levelLessons.filter(l => l.docType === 'course' || (!l.docType && !l.isExam)).map(l => (
                        <option key={l.id} value={l.id}>
                          📖 {l.title} {l.subject ? `(${l.subject})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* 3. Series & Exercises - Only shown when not in program-only mode */}
                  {!isProgramOnlyMode && levelLessons.filter(l => l.docType === 'exercises' || l.docType === 'series').length > 0 && (
                    <optgroup label={isArMode ? '📝 سلاسل تمارين إضافية' : '📝 Séries d\'exercices'}>
                      {levelLessons.filter(l => l.docType === 'exercises' || l.docType === 'series').map(l => (
                        <option key={l.id} value={l.id}>
                          📝 {l.title} {l.subject ? `(${l.subject})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* 4. Homeworks & Controls - Only shown when not in program-only mode */}
                  {!isProgramOnlyMode && levelLessons.filter(l => l.docType === 'homework' || l.docType === 'exam' || l.docType === 'control' || l.isExam).length > 0 && (
                    <optgroup label={isArMode ? '📑 فروض وامتحانات إضافية' : '📑 Devoirs & Contrôles'}>
                      {levelLessons.filter(l => l.docType === 'homework' || l.docType === 'exam' || l.docType === 'control' || l.isExam).map(l => (
                        <option key={l.id} value={l.id}>
                          📑 {l.title} {l.subject ? `(${l.subject})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-subtle)', margin: '0.35rem 0 0 0' }}>
                  {isProgramOnlyMode 
                    ? (isArMode ? '✨ يتم عرض عناصر برنامج القسم المعتمد فقط لتسهيل التعبئة السريعة والمباشرة.' : '✨ Seuls les éléments du programme officiel de la classe sont affichés pour un remplissage direct.')
                    : (isArMode ? 'يتم استخراج عنوان الحصة والفقرات المنجزة تلقائياً من برنامج القسم المعني.' : 'Les titres et sections sont extraits automatiquement à partir du programme de la classe.')}
                </p>
              </div>

              {/* Start new Chapter or Exam header toggle */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  background: formData.isHeaderSéance 
                    ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(99, 102, 241, 0.08) 100%)' 
                    : 'rgba(255, 255, 255, 0.01)', 
                  padding: '1rem 1.25rem', 
                  borderRadius: '16px', 
                  border: formData.isHeaderSéance ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border)',
                  boxShadow: formData.isHeaderSéance ? '0 4px 15px rgba(139, 92, 246, 0.05)' : 'none',
                  transition: 'all 0.25s ease',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  if (e.target.id === 'isHeaderSéance' || e.target.tagName === 'LABEL' || e.target.closest('label')) {
                    return;
                  }
                  const nextChecked = !formData.isHeaderSéance;
                  setFormData(prev => {
                    let customContent = prev.customContent;
                    if (nextChecked) {
                      if (prev.lessonId) {
                        const selectedLesson = lessons.find(l => l.id === prev.lessonId);
                        if (selectedLesson) {
                          customContent = `=== ${selectedLesson.title.toUpperCase()} ===\n` + prev.customContent;
                        }
                      } else if (prev.component === 'Contrôle') {
                        customContent = `=== CONTRÔLE N°1 ===\n` + prev.customContent;
                      } else {
                        customContent = `=== NOUVEAU CHAPITRE ===\n` + prev.customContent;
                      }
                    } else {
                      customContent = prev.customContent.replace(/^===.*===\n?/, '');
                    }
                    return { ...prev, isHeaderSéance: nextChecked, customContent };
                  });
                }}
              >
                <input
                  type="checkbox"
                  id="isHeaderSéance"
                  checked={formData.isHeaderSéance || false}
                  onChange={(e) => {
                    const nextChecked = e.target.checked;
                    setFormData(prev => {
                      let customContent = prev.customContent;
                      if (nextChecked) {
                        if (prev.lessonId) {
                          const selectedLesson = lessons.find(l => l.id === prev.lessonId);
                          if (selectedLesson) {
                            customContent = `=== ${selectedLesson.title.toUpperCase()} ===\n` + prev.customContent;
                          }
                        } else if (prev.component === 'Contrôle') {
                          customContent = `=== CONTRÔLE N°1 ===\n` + prev.customContent;
                        } else {
                          customContent = `=== NOUVEAU CHAPITRE ===\n` + prev.customContent;
                        }
                      } else {
                        customContent = prev.customContent.replace(/^===.*===\n?/, '');
                      }
                      return { ...prev, isHeaderSéance: nextChecked, customContent };
                    });
                  }}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--violet)', cursor: 'pointer' }}
                />
                <label 
                  htmlFor="isHeaderSéance" 
                  style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none', lineHeight: 1.35 }}
                >
                  Début de chapitre ou contrôle (Afficher un grand titre centré et élégant)
                </label>
              </div>

              {/* Checkbox selector for Sections */}
              {formData.lessonId && (
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem' }}>
                  {(() => {
                    const selectedLesson = lessons.find(l => l.id === formData.lessonId);
                    const sections = selectedLesson?.content?.sections || [];
                    if (sections.length === 0) {
                      return <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>Aucune section dans cette fiche.</span>;
                    }

                    // Find all sections covered in other entries for this class
                    const coveredInOtherEntries = new Set();
                    entries.forEach(e => {
                      if (editingEntry && e.id === editingEntry.id) return; // Skip the current entry we are editing
                      if (selectedClass && e.classId && e.classId !== selectedClass.id) return; // Only for current class
                      if (e.selectedSections && Array.isArray(e.selectedSections)) {
                        e.selectedSections.forEach(title => coveredInOtherEntries.add(title));
                      }
                    });

                    const totalCount = sections.length;
                    const uncoveredCount = sections.filter(s => !coveredInOtherEntries.has(s.title)).length;
                    const coveredCount = sections.filter(s => coveredInOtherEntries.has(s.title)).length;

                    let filteredSections = sections;
                    if (sectionFilterMode === 'uncovered') {
                      filteredSections = sections.filter(s => !coveredInOtherEntries.has(s.title));
                    } else if (sectionFilterMode === 'covered') {
                      filteredSections = sections.filter(s => coveredInOtherEntries.has(s.title));
                    }

                    // Detect block type from text prefix
                    const getBlockType = (s) => {
                      const t = (s.items?.[0]?.text || s.title || '').toLowerCase();
                      if (/^\*\*(activité|نشاط)/.test(t)) return { label: isArMode ? 'نشاط' : 'Activité', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
                      if (/^\*\*(définition|تعريف)/.test(t)) return { label: isArMode ? 'تعريف' : 'Déf.', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
                      if (/^\*\*(propriété|خاصية)/.test(t)) return { label: isArMode ? 'خاصية' : 'Prop.', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' };
                      if (/^\*\*(théorème|مبرهنة)/.test(t)) return { label: isArMode ? 'مبرهنة' : 'Thm.', color: '#ec4899', bg: 'rgba(236,72,153,0.12)' };
                      if (/^\*\*(remarque|ملاحظة)/.test(t)) return { label: isArMode ? 'ملاحظة' : 'Rem.', color: '#64748b', bg: 'rgba(100,116,139,0.12)' };
                      if (/^\*\*(application|تطبيق)/.test(t)) return { label: isArMode ? 'تطبيق' : 'Appl.', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
                      if (/^\*\*(correction|تصحيح)/.test(t)) return { label: isArMode ? 'تصحيح' : 'Corr.', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
                      if (s.type === 'exercise') return { label: isArMode ? 'تمرين' : 'Exo', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
                      return { label: isArMode ? 'درس' : 'Cours', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
                    };

                    let lastHeader = null;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {/* Header Banner: Document / Series title */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          flexWrap: 'wrap', 
                          gap: '0.5rem', 
                          padding: '0.6rem 0.85rem', 
                          background: 'rgba(99, 102, 241, 0.06)', 
                          border: '1px solid rgba(99, 102, 241, 0.2)', 
                          borderRadius: '10px' 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                            <BookOpen size={16} color="var(--violet)" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {selectedLesson.title}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => insertTextToContent(`=== ${selectedLesson.title.toUpperCase()} ===\n`)}
                              style={{ 
                                fontSize: '0.68rem', 
                                fontWeight: 700, 
                                padding: '0.2rem 0.5rem', 
                                borderRadius: '6px', 
                                background: 'rgba(99, 102, 241, 0.14)', 
                                border: '1px solid rgba(99, 102, 241, 0.35)', 
                                color: 'var(--violet)', 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title={isArMode ? 'إدراج كعنوان رئيسي كبير' : 'Insérer comme grand titre centré'}
                            >
                              <Plus size={11} />
                              {isArMode ? 'عنوان رئيسي' : 'Grand Titre'}
                            </button>
                            <button
                              type="button"
                              onClick={() => insertTextToContent(selectedLesson.title, true)}
                              style={{ 
                                fontSize: '0.68rem', 
                                fontWeight: 700, 
                                padding: '0.2rem 0.5rem', 
                                borderRadius: '6px', 
                                background: 'rgba(255, 255, 255, 0.05)', 
                                border: '1px solid var(--border)', 
                                color: 'var(--text-main)', 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title={isArMode ? 'إدراج كسطر نقطي' : 'Insérer comme puce'}
                            >
                              <Plus size={11} />
                              {isArMode ? 'نقطة عنوان' : 'Puce'}
                            </button>
                          </div>
                        </div>

                        {/* Filter Tabs & Bulk Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => setSectionFilterMode('all')}
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: sectionFilterMode === 'all' ? 800 : 500,
                                padding: '0.22rem 0.65rem',
                                borderRadius: '7px',
                                border: '1px solid',
                                borderColor: sectionFilterMode === 'all' ? 'var(--violet)' : 'var(--border)',
                                background: sectionFilterMode === 'all' ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.02)',
                                color: sectionFilterMode === 'all' ? 'var(--violet)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.18s'
                              }}
                            >
                              {isArMode ? `الكل (${totalCount})` : `Tous (${totalCount})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSectionFilterMode('uncovered')}
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: sectionFilterMode === 'uncovered' ? 800 : 500,
                                padding: '0.22rem 0.65rem',
                                borderRadius: '7px',
                                border: '1px solid',
                                borderColor: sectionFilterMode === 'uncovered' ? 'var(--violet)' : 'var(--border)',
                                background: sectionFilterMode === 'uncovered' ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.02)',
                                color: sectionFilterMode === 'uncovered' ? 'var(--violet)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.18s'
                              }}
                            >
                              {isArMode ? `غير منجزة (${uncoveredCount})` : `Non abordés (${uncoveredCount})`}
                            </button>
                            {coveredCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setSectionFilterMode('covered')}
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: sectionFilterMode === 'covered' ? 800 : 500,
                                  padding: '0.22rem 0.65rem',
                                  borderRadius: '7px',
                                  border: '1px solid',
                                  borderColor: sectionFilterMode === 'covered' ? 'var(--violet)' : 'var(--border)',
                                  background: sectionFilterMode === 'covered' ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.02)',
                                  color: sectionFilterMode === 'covered' ? 'var(--violet)' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  transition: 'all 0.18s'
                                }}
                              >
                                {isArMode ? `منجزة (${coveredCount})` : `Déjà abordés (${coveredCount})`}
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => handleSelectAllVisibleSections(filteredSections)}
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                background: 'rgba(99, 102, 241, 0.09)',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                color: 'var(--violet)',
                                cursor: 'pointer'
                              }}
                            >
                              {isArMode ? 'تحديد الكل' : 'Tout sélectionner'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeselectAllVisibleSections(filteredSections)}
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-subtle)',
                                cursor: 'pointer'
                              }}
                            >
                              {isArMode ? 'إلغاء التحديد' : 'Tout désélectionner'}
                            </button>
                          </div>
                        </div>

                        {/* List of Sections */}
                        {filteredSections.length === 0 ? (
                          <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-subtle)', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                            {sectionFilterMode === 'uncovered'
                              ? (isArMode ? 'تم إنجاز جميع عناصر هذا الدرس أو السلسلة في حصص سابقة!' : 'Toutes les sections ont été abordées dans des séances précédentes !')
                              : (isArMode ? 'لا توجد عناصر مطابقة.' : 'Aucun élément correspondant.')}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {filteredSections.map(s => {
                              const isChecked = formData.selectedSections.includes(s.title);
                              const isPreviewOpen = !!previewSections[s.id || s.title];
                              const isCovered = coveredInOtherEntries.has(s.title);
                              const blockType = getBlockType(s);
                              const showHeader = s.section_header && s.section_header !== lastHeader;
                              if (showHeader) lastHeader = s.section_header;

                              return (
                                <div key={s.id || s.title} style={{ marginBottom: '0.35rem' }}>
                                  {/* Section Header (Axe) */}
                                  {showHeader && (() => {
                                    const headerTitle = s.section_header;
                                    const isHeaderChecked = formData.selectedSections.includes(headerTitle);
                                    return (
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '0.55rem',
                                          padding: '0.4rem 0.75rem',
                                          marginTop: '0.35rem',
                                          background: isHeaderChecked
                                            ? 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.08) 100%)'
                                            : 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.02) 100%)',
                                          borderLeft: `3px solid ${isHeaderChecked ? 'var(--violet)' : 'rgba(99,102,241,0.4)'}`,
                                          borderRadius: '6px',
                                          transition: 'all 0.18s ease'
                                        }}
                                      >
                                        <label
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.55rem',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            flex: 1,
                                            margin: 0
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isHeaderChecked}
                                            onChange={() => handleToggleSection(headerTitle)}
                                            style={{ accentColor: 'var(--violet)', width: '14px', height: '14px', flexShrink: 0 }}
                                          />
                                          <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 900,
                                            color: isHeaderChecked ? 'var(--violet)' : 'rgba(99,102,241,0.7)',
                                            letterSpacing: '0.02em',
                                            flex: 1
                                          }}>
                                            {parseBold(headerTitle)}
                                          </span>
                                        </label>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              insertTextToContent(headerTitle, true);
                                              if (!formData.selectedSections.includes(headerTitle)) {
                                                setFormData(prev => ({ ...prev, selectedSections: [...prev.selectedSections, headerTitle] }));
                                              }
                                            }}
                                            style={{
                                              background: 'rgba(99, 102, 241, 0.1)',
                                              border: '1px solid rgba(99, 102, 241, 0.25)',
                                              color: 'var(--violet)',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.2rem',
                                              padding: '0.15rem 0.45rem',
                                              borderRadius: '5px',
                                              fontSize: '0.64rem',
                                              fontWeight: 700
                                            }}
                                            title={isArMode ? 'إدراج عنوان المحور' : "Insérer l'axe dans la séance"}
                                          >
                                            <Plus size={10} />
                                            {isArMode ? 'إدراج المحور' : '+ Axe'}
                                          </button>
                                          <span style={{
                                            fontSize: '0.6rem',
                                            fontWeight: 800,
                                            color: 'var(--violet)',
                                            background: 'rgba(99,102,241,0.1)',
                                            padding: '0.1rem 0.4rem',
                                            borderRadius: '4px'
                                          }}>
                                            {isArMode ? 'محور' : 'Axe'}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Section Row */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                                      border: isChecked ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                                      borderRadius: '10px',
                                      transition: 'all 0.18s ease',
                                      padding: '0.55rem 0.9rem',
                                      marginTop: '0.2rem'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1, cursor: 'pointer', margin: 0 }}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleSection(s.title)}
                                          style={{ accentColor: 'var(--violet)', width: '15px', height: '15px', flexShrink: 0 }}
                                        />
                                        <span style={{
                                          fontWeight: isChecked ? 700 : 500,
                                          fontSize: '0.8rem',
                                          color: isChecked ? 'var(--text-main)' : 'var(--text-muted)',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {parseBold(s.title)}
                                        </span>
                                      </label>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                                        {/* Covered badge */}
                                        {isCovered && (
                                          <span style={{
                                            fontSize: '0.6rem',
                                            fontWeight: 700,
                                            color: '#059669',
                                            background: 'rgba(16, 185, 129, 0.12)',
                                            padding: '0.1rem 0.4rem',
                                            borderRadius: '4px',
                                            whiteSpace: 'nowrap'
                                          }}>
                                            ✓ {isArMode ? 'منجز سابقاً' : 'Déjà abordé'}
                                          </span>
                                        )}

                                        {/* Insert Title Button */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            insertSectionContent(s, 'title');
                                          }}
                                          style={{
                                            background: 'rgba(99, 102, 241, 0.08)',
                                            border: '1px solid rgba(99, 102, 241, 0.25)',
                                            color: 'var(--violet)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.2rem',
                                            padding: '0.2rem 0.45rem',
                                            borderRadius: '6px',
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            transition: 'all 0.2s',
                                          }}
                                          title={isArMode ? 'إدراج عنوان هذا العنصر كنقطة' : 'Insérer le titre comme puce'}
                                        >
                                          <Plus size={10} />
                                          {isArMode ? 'عنوان' : 'Titre'}
                                        </button>

                                        {/* Insert Full Statement / Content Button */}
                                        {(s.content || (s.items && s.items.length > 0)) && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              insertSectionContent(s, 'full');
                                            }}
                                            style={{
                                              background: 'rgba(16, 185, 129, 0.08)',
                                              border: '1px solid rgba(16, 185, 129, 0.25)',
                                              color: 'var(--emerald)',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.2rem',
                                              padding: '0.2rem 0.45rem',
                                              borderRadius: '6px',
                                              fontSize: '0.65rem',
                                              fontWeight: 700,
                                              transition: 'all 0.2s',
                                            }}
                                            title={isArMode ? 'إدراج نص المحتوى / التمرين كاملاً' : "Insérer tout l'énoncé"}
                                          >
                                            <Plus size={10} />
                                            {isArMode ? 'نص' : 'Énoncé'}
                                          </button>
                                        )}

                                        {/* Preview Toggle Button */}
                                        {(s.content || (s.items && s.items.length > 0)) && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              toggleSectionPreview(s.id || s.title);
                                            }}
                                            style={{
                                              border: 'none',
                                              color: isPreviewOpen ? 'var(--violet)' : 'var(--text-muted)',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              padding: '0.25rem',
                                              borderRadius: '6px',
                                              transition: 'all 0.2s',
                                              background: isPreviewOpen ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
                                            }}
                                            title={isArMode ? 'عرض المحتوى والفقرات الفرعية' : 'Voir le contenu et sous-éléments'}
                                          >
                                            {isPreviewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                                          </button>
                                        )}

                                        {/* Block Type Tag */}
                                        <span style={{
                                          fontSize: '0.66rem',
                                          fontWeight: 800,
                                          color: blockType.color,
                                          background: blockType.bg,
                                          padding: '0.12rem 0.45rem',
                                          borderRadius: '6px',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {blockType.label}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Content & Sub-items Breakdown Drawer */}
                                    {isPreviewOpen && (s.content || (s.items && s.items.length > 0)) && (
                                      <div style={{
                                        marginTop: '0.55rem',
                                        marginLeft: isArMode ? 0 : '1.8rem',
                                        marginRight: isArMode ? '1.8rem' : 0,
                                        padding: '0.75rem',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        maxHeight: '230px',
                                        overflowY: 'auto'
                                      }}>
                                        {/* Drawer Top Toolbar */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.4rem' }}>
                                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                            {isArMode ? 'الفقرات الفرعية والأسئلة (إدراج انتقائي) :' : 'Sous-éléments et questions (insertion sélective) :'}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => insertSectionContent(s, 'full')}
                                            style={{
                                              fontSize: '0.65rem',
                                              fontWeight: 700,
                                              padding: '0.15rem 0.45rem',
                                              borderRadius: '4px',
                                              background: 'rgba(16, 185, 129, 0.1)',
                                              border: '1px solid rgba(16, 185, 129, 0.3)',
                                              color: 'var(--emerald)',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            <Plus size={10} style={{ display: 'inline', verticalAlign: '-1px' }} />
                                            {isArMode ? 'إدراج كل النص' : 'Insérer tout le texte'}
                                          </button>
                                        </div>

                                        {/* Granular Items / Questions Breakdown */}
                                        {s.items && s.items.length > 0 ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                            {s.items.map((it, itIdx) => {
                                              const itemText = it.text || it.content || '';
                                              if (!itemText.trim()) return null;
                                              return (
                                                <div
                                                  key={itIdx}
                                                  style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    justifyContent: 'space-between',
                                                    gap: '0.5rem',
                                                    padding: '0.4rem 0.55rem',
                                                    background: 'rgba(255, 255, 255, 0.02)',
                                                    borderRadius: '6px',
                                                    border: '1px solid rgba(255, 255, 255, 0.04)'
                                                  }}
                                                >
                                                  <div style={{ flex: 1, minWidth: 0, direction: 'ltr', textAlign: 'left', fontSize: '0.72rem', whiteSpace: 'pre-wrap' }}>
                                                    {renderWithMath(itemText)}
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => insertTextToContent(itemText, false)}
                                                    style={{
                                                      fontSize: '0.62rem',
                                                      fontWeight: 700,
                                                      padding: '0.15rem 0.45rem',
                                                      borderRadius: '4px',
                                                      background: 'rgba(99, 102, 241, 0.1)',
                                                      border: '1px solid rgba(99, 102, 241, 0.25)',
                                                      color: 'var(--violet)',
                                                      cursor: 'pointer',
                                                      flexShrink: 0
                                                    }}
                                                    title={isArMode ? 'إدراج هذه الفقرة/السؤال فقط' : 'Insérer cet élément uniquement'}
                                                  >
                                                    + {isArMode ? 'إدراج' : 'Insérer'}
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <div style={{ direction: 'ltr', textAlign: 'left', whiteSpace: 'pre-wrap' }}>
                                            {renderWithMath(getSectionContentString(s))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Nature of activities realized */}
              <div className="input-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
                  Nature des activités réalisées
                </label>

                {/* Quick Insert Tooltip Bar */}
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.45rem', 
                  marginBottom: '0.75rem', 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  padding: '0.6rem 0.8rem', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border)' 
                }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: 800, alignSelf: 'center', marginRight: '0.3rem' }}>
                    {isArMode ? 'إدراج سريع:' : 'Insertion rapide :'}
                  </span>
                  
                  {isArMode ? (
                    // Arabic Quick Tags
                    ['عنوان', 'محور', 'تمرين', 'تطبيق', 'تصحيح', 'تعريف', 'خاصية', 'مبرهنة', 'مثال', 'ملاحظة', 'نشاط', 'خلاصة'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setFormData(prev => {
                            let nextContent = prev.customContent.trim();
                            if (nextContent === '') {
                              nextContent = `• ${tag}`;
                            } else if (nextContent.endsWith('\n') || prev.customContent.endsWith('\n')) {
                              nextContent = `${prev.customContent}• ${tag}`;
                            } else {
                              nextContent = `${prev.customContent} - ${tag}`;
                            }
                            return { ...prev, customContent: nextContent };
                          });
                        }}
                        className="quick-tag-btn-ar"
                      >
                        + {tag}
                      </button>
                    ))
                  ) : (
                    // French Quick Tags
                    ['Titre', 'Axe', 'Exercice', 'Application', 'Correction', 'Définition', 'Propriété', 'Théorème', 'Exemple', 'Remarque', 'Activité', 'Synthèse'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setFormData(prev => {
                            let nextContent = prev.customContent.trim();
                            if (nextContent === '') {
                              nextContent = `• ${tag}`;
                            } else if (nextContent.endsWith('\n') || prev.customContent.endsWith('\n')) {
                              nextContent = `${prev.customContent}• ${tag}`;
                            } else {
                              nextContent = `${prev.customContent} - ${tag}`;
                            }
                            return { ...prev, customContent: nextContent };
                          });
                        }}
                        className="quick-tag-btn-fr"
                      >
                        + {tag}
                      </button>
                    ))
                  )}
                </div>

                <textarea
                  required
                  rows={5}
                  placeholder={isArMode ? "اكتب تفاصيل الدرس المنجز هنا..." : "Écrivez le contenu couvert dans la séance..."}
                  className="modal-input"
                  value={formData.customContent}
                  onChange={e => setFormData(prev => ({ ...prev, customContent: e.target.value }))}
                  style={{ fontFamily: 'inherit', resize: 'vertical', fontSize: '0.9rem', lineHeight: 1.45 }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-outline"
                  style={{ padding: '0.65rem 1.75rem', borderRadius: '12px', background: 'transparent', fontSize: '0.88rem' }}
                >
                  {isArMode ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="btn modal-save-btn"
                  style={{ 
                    padding: '0.65rem 2.25rem', 
                    borderRadius: '12px', 
                    fontSize: '0.88rem'
                  }}
                >
                  <Save size={16} /> {isArMode ? 'حفظ' : 'Enregistrer'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


    </div>
  );
}
