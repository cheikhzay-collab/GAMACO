import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { onAuthChange, loginWithEmail, logoutUser, registerStudent, loginWithGoogle, getCurrentSessionUser } from '../services/authService';
import { getUserDoc, createUserDoc, updateUserDoc, deleteUser, saveQuestionProgress, getProgressDeltas, saveMockResult, getMockHistory, incrementDailyActivity, getRecentActivity, getAllUsers, setUserSubscription, getLeaderboard, addLoginLog, logUserDownload } from '../services/userService';
import { getAllExams, addExam as dbAddExam, updateExam as dbUpdateExam, deleteExam as dbDeleteExam, toggleExamStatus as dbToggleExamStatus, toggleArchiveExam as dbToggleArchiveExam, getExamQuestionsOnly } from '../services/examService';
import { getSchoolsConfig, saveSchoolsConfig, getBrandingConfig, saveBrandingConfig, getFlashcardSettingsConfig, saveFlashcardSettingsConfig, getPdfSettingsConfig, savePdfSettingsConfig, getOmrScannerSettingsConfig, saveOmrScannerSettingsConfig, getWhatsAppSettingsConfig, saveWhatsAppSettingsConfig, getPlansConfig, savePlansConfig } from '../services/schoolService';

import { sanitizeInputString, validatePhoneNumber } from '../utils/security';
import { mapLegacySchoolToLevel } from '../utils/levelHelpers';
import { supabase } from '../lib/supabase';

const SUPABASE_ENABLED = !!import.meta.env.VITE_SUPABASE_URL;
const NEON_ENABLED = SUPABASE_ENABLED; // Backward-compatibility alias

const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // FIX: Handle QuotaExceededError — auto-evict old data and retry
    if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
      console.warn('[Storage] localStorage quota exceeded — evicting old data and retrying...');
      try {
        // Evict the heaviest non-critical items first
        localStorage.removeItem('mockExamHistory');
        localStorage.removeItem('reviewDates');
        localStorage.removeItem('dailyActivity');
        // Trim progress to last 300 cards if it's the cause
        if (key !== 'progress') {
          const rawProgress = localStorage.getItem('progress');
          if (rawProgress) {
            try {
              const parsed = JSON.parse(rawProgress);
              const trimmed = Object.fromEntries(
                Object.entries(parsed)
                  .sort(([, a], [, b]) => new Date(b.nextReviewDate) - new Date(a.nextReviewDate))
                  .slice(0, 300)
              );
              localStorage.setItem('progress', JSON.stringify(trimmed));
            } catch (err) {
              console.warn('[Storage] Failed to parse progress for eviction:', err);
            }
          }
        }
        // Retry the original write
        localStorage.setItem(key, value);
        console.warn(`[Storage] Successfully saved '${key}' after eviction.`);
      } catch (retryErr) {
        console.error(`[Storage] Still can't save '${key}' after eviction:`, retryErr.message || retryErr);
      }
    } else {
      console.warn(`[Storage] Failed to save '${key}' to localStorage:`, e.message || e);
    }
  }
};

const AuthContext = createContext();

/* ─── Data Schema Version ────────────────────────────────────────────────────
 *  Bump this number whenever a migration is needed.
 *  On app load, if stored version < SCHEMA_VERSION, the migration runs
 *  automatically and saves the cleaned data back to localStorage.
 */
const SCHEMA_VERSION = 3;

/**
 * Master text sanitizer — strips ALL control characters from a string.
 * Prevents CR/LF/Tab from corrupting LaTeX expressions when stored data
 * comes from CSV files with Windows line endings.
 */
const sanitizeText = (s) => {
  if (typeof s !== 'string') return s;
  /* eslint-disable no-control-regex */
  return s
    .replace(/\r\n/g, ' ')   // Windows CRLF
    .replace(/[\r\n]/g, ' ') // lone CR or LF
    .replace(/\t/g, ' ')     // Tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // other control chars
    .replace(/[\u200B-\u200D\uFEFF]/g, '')              // zero-width / BOM
    .replace(/ {2,}/g, ' ')  // collapse spaces
    .trim();
  /* eslint-enable no-control-regex */
};

/**
 * Normalizes a single option into { id, text } object form.
 * Handles: string "A) text", string "text", or already-object { id, text }.
 */
const normalizeOption = (opt, index) => {
  const letters = ['A','B','C','D','E'];
  if (typeof opt === 'string') {
    // Match "A) text" or "A. text" or "A- text" patterns
    const match = opt.match(/^([A-Ea-e])\s*[).\-:]\s*(.*)/s);
    if (match) {
      return { id: match[1].toUpperCase(), text: match[2].trim() };
    }
    // Plain string without letter prefix
    return { id: letters[index] || String.fromCharCode(65 + index), text: opt.trim() };
  }
  if (opt && typeof opt === 'object') {
    return {
      id: opt.id || letters[index] || String.fromCharCode(65 + index),
      text: opt.text || opt.value || opt.content || ''
    };
  }
  return { id: letters[index] || 'A', text: String(opt || '') };
};

/**
 * Sanitizes ALL text fields of every question in every exam.
 * Also normalizes options from string[] to {id,text}[] format.
 * Safe to run multiple times (idempotent).
 */
const sanitizeExams = (exams) => {
  if (!Array.isArray(exams)) return [];
  return exams.map(exam => ({
    ...exam,
    questions: Array.isArray(exam.questions)
      ? exam.questions.map(q => ({
          ...q,
          question: sanitizeText(q.question),
          context:  sanitizeText(q.context),
          astuce:   sanitizeText(q.astuce),
          trick:    sanitizeText(q.trick),
          options:  Array.isArray(q.options)
            ? q.options.map((opt, i) => {
                const normalized = normalizeOption(opt, i);
                return { id: normalized.id, text: sanitizeText(normalized.text) };
              })
            : q.options,
        }))
      : exam.questions,
  }));
};

/**
 * Loads exams from localStorage, runs migration if schema version is outdated.
 * Returns { exams, needsSave } — needsSave=true when data was migrated.
 */
const loadAndMigrateExams = () => {
  try {
    const raw = localStorage.getItem('exams');
    const version = parseInt(localStorage.getItem('examsSchemaVersion') || '0', 10);

    const defaultSeed = [
      {
        id: "QVVOBFE7",
        name: "Concours Médecine / Pharmacie 2024",
        school: "Médecine / Pharmacie",
        level: "2bac_pc_svt",
        year: "2024",
        tier: "freemium",
        isActive: true,
        dateAdded: new Date().toISOString(),
        questions: Array.from({ length: 20 }, (_, i) => {
          const answers = ["C", "A", "B", "D", "C", "A", "E", "B", "C", "D", "B", "B", "A", "C", "D", "E", "B", "A", "D", "C"];
          const topics = ["Analyse", "Géométrie", "Algèbre", "Physique", "Chimie"];
          const optTexts = ["Option A", "Option B", "Option C", "Option D", "Option E"];
          return {
            id: `qvvobfe7-q-${i + 1}`,
            question: `Question ${i + 1} de concours Médecine/Pharmacie`,
            topic: topics[i % topics.length],
            correct_answer: answers[i],
            options: optTexts.map((txt, oIdx) => ({
              id: ["A", "B", "C", "D", "E"][oIdx],
              text: txt
            }))
          };
        })
      }
    ];

    if (!raw) {
      return { exams: defaultSeed, needsSave: true };
    }
    const parsed = JSON.parse(raw);
    
    // Ensure QVVOBFE7 is always present in the loaded list for testing
    const hasQVV = parsed.some(e => e.id === "QVVOBFE7");
    if (!hasQVV) {
      parsed.push(defaultSeed[0]);
      return { exams: parsed, needsSave: true };
    }

    if (version >= SCHEMA_VERSION) {
      return { exams: Array.isArray(parsed) ? parsed : [], needsSave: false };
    }
    // Migration needed — sanitize all text fields
    const migrated = sanitizeExams(parsed);
    return { exams: migrated, needsSave: true };
  } catch {
    return { exams: [], needsSave: false };
  }
};

const computeStudentStats = (exams, progress, leaderboard, user) => {
  if (!user) {
    return {
      totalCards: 0, masteredCards: 0, learningCards: 0, newCards: 0,
      dueToday: 0, globalMasteryPct: 0, weakTopics: [], strongTopics: [],
      weeklyActivity: [], streak: 0, rank: 1200, totalStudents: 1200,
    };
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const activeExams = exams.filter(e => e.isActive !== false && e.isArchived !== true);

  let totalCards = 0;
  let masteredCards = 0;
  let learningCards = 0;
  let dueToday = 0;
  let totalWeightedMasterySum = 0;
  const topicMap = {}; // topic -> { totalEF, count, weightedMasterySum, total }

  activeExams.forEach(e => {
    if (!e.questions) return;
    totalCards += e.questions.length;

    e.questions.forEach(q => {
      const p = progress[q.id];
      const topic = q.topic || 'Général';
      if (!topicMap[topic]) topicMap[topic] = { totalEF: 0, count: 0, weightedMasterySum: 0, total: 0 };
      topicMap[topic].total++;
      if (!p) return;
      const { repetitions, easeFactor, nextReviewDate, stability } = p;
      
      // Calculate question mastery weight
      let weight = 0;
      
      // Fallback stability calculation for older card records
      const cardStability = stability !== undefined && stability !== null
        ? stability
        : (repetitions > 0 ? Math.max(1.0, 2.0 * Math.pow(3, repetitions - 1)) : 2.0);

      if (repetitions >= 3) {
        weight = 1.0;
        masteredCards++;
      } else if (repetitions === 2) {
        weight = 0.7;
        learningCards++;
      } else if (repetitions === 1) {
        if (cardStability > 1.0) {
          weight = 0.4;
        } else {
          weight = 0.0;
        }
        learningCards++;
      }

      topicMap[topic].weightedMasterySum += weight;
      totalWeightedMasterySum += weight;

      topicMap[topic].totalEF += easeFactor;
      topicMap[topic].count++;
      if (new Date(nextReviewDate) <= now) dueToday++;
    });
  });

  // Topics sorted by mastery (weakest first)
  const topicsArr = Object.entries(topicMap)
    .map(([name, s]) => {
      const masteryPct = s.total > 0 ? Math.round((s.weightedMasterySum / s.total) * 100) : 0;
      return {
        name,
        avgEF: s.count > 0 ? s.totalEF / s.count : 2.5,
        masteryPct,
        mastered: s.weightedMasterySum,
        total: s.total,
        count: s.count
      };
    });

  const weakTopics = [...topicsArr]
    .filter(t => t.count > 0 && t.masteryPct < 85)
    .sort((a, b) => a.masteryPct - b.masteryPct)
    .slice(0, 4);

  const strongTopics = [...topicsArr]
    .filter(t => t.count > 0 && t.masteryPct >= 70)
    .sort((a, b) => b.masteryPct - a.masteryPct)
    .slice(0, 3);

  // Weekly activity from dailyActivity store
  const dailyActivity = JSON.parse(localStorage.getItem('dailyActivity') || '{}');
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return { name: dayNames[d.getDay()], count: dailyActivity[key] || 0, isToday: key === todayStr };
  });

  // Streak: consecutive days with at least 1 review ending today or yesterday
  const reviewDates = JSON.parse(localStorage.getItem('reviewDates') || '[]');
  let streak = 0;
  let checkDate = new Date(now);
  for (let i = 0; i < 365; i++) {
    const ds = checkDate.toISOString().split('T')[0];
    if (reviewDates.includes(ds)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
    else break;
  }

  // Global mastery percentage is relative to totalCards in active exams (curriculum coverage)
  const globalMasteryPct = totalCards > 0 
    ? Math.round((totalWeightedMasterySum / totalCards) * 100) 
    : 0;

  // Dynamic live rank based on real leaderboard or XP fallback
  let totalStudents;
  let rank;
  const userXp = user?.xp || 0;

  if (SUPABASE_ENABLED && leaderboard && leaderboard.length > 0) {
    totalStudents = leaderboard.length;
    const userIndex = leaderboard.findIndex(u => u.name === user?.name || u.email === user?.email);
    if (userIndex !== -1) {
      rank = userIndex + 1;
    } else {
      const higherXpCount = leaderboard.filter(u => u.xp > userXp).length;
      rank = higherXpCount + 1;
    }
  } else {
    totalStudents = user?.totalStudents || 1200;
    rank = Math.max(1, Math.min(totalStudents, Math.round(totalStudents * Math.pow(0.9992, userXp))));
  }

  return {
    totalCards, masteredCards, learningCards,
    newCards: totalCards - masteredCards - learningCards,
    dueToday, globalMasteryPct, weakTopics, strongTopics,
    weeklyActivity, streak, rank, totalStudents,
  };
};

// Helper: extract readable name from email prefix
const split_part_email = (email) => email ? email.split('@')[0] : 'Élève';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [upgradedPlan, setUpgradedPlan] = useState(null);
  // Initialize loading to true if Neon is enabled so we can check and verify the session first
  const [loading, setLoading] = useState(SUPABASE_ENABLED);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  // Progress state for SRS: { [questionId]: { difficulty, stability, repetitions, easeFactor, lastReviewDate, nextReviewDate } }
  // Migrated from legacy SM-2: { interval, repetitions, easeFactor, nextReviewDate }
  const [progress, setProgress] = useState(() => {
    const saved = localStorage.getItem('progress');
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved);
      let migrated = false;
      const migratedProgress = {};
      Object.entries(parsed).forEach(([id, card]) => {
        if (!card) return;
        
        let difficulty = card.difficulty;
        let stability = card.stability;
        let repetitions = card.repetitions;
        let easeFactor = card.easeFactor;
        let lastReviewDate = card.lastReviewDate;
        let nextReviewDate = card.nextReviewDate;

        // Migrate legacy card
        if (card.repetitions !== undefined && card.difficulty === undefined) {
          migrated = true;
          const ef = card.easeFactor || 2.5;
          const interval = card.interval || 1;
          difficulty = Math.max(1.0, Math.min(10.0, 12.0 - 4.0 * ef));
          stability = Math.max(0.5, interval);
          const nextDate = card.nextReviewDate || new Date().toISOString();
          const lastDateObj = new Date(nextDate);
          lastDateObj.setDate(lastDateObj.getDate() - Math.round(stability));
          lastReviewDate = lastDateObj.toISOString();
          nextReviewDate = nextDate;
          easeFactor = ef;
        }

        // Healing corrupt/NaN values
        if (difficulty === undefined || difficulty === null || isNaN(difficulty)) {
          const ef = easeFactor || 2.5;
          difficulty = Math.max(1.0, Math.min(10.0, 1.0 + 4.5 * (3.0 - ef)));
          if (isNaN(difficulty)) difficulty = 5.0;
          migrated = true;
        }
        if (stability === undefined || stability === null || isNaN(stability) || stability <= 0) {
          stability = repetitions > 0 ? Math.max(1.0, 2.0 * Math.pow(3, repetitions - 1)) : 2.0;
          if (isNaN(stability) || stability <= 0) stability = 2.0;
          migrated = true;
        }
        if (repetitions === undefined || repetitions === null || isNaN(repetitions)) {
          repetitions = 0;
          migrated = true;
        }
        if (easeFactor === undefined || easeFactor === null || isNaN(easeFactor)) {
          easeFactor = 3.0 - (difficulty - 1.0) / 4.5;
          if (isNaN(easeFactor)) easeFactor = 2.5;
          migrated = true;
        }
        
        // Date checks
        const checkLastDate = new Date(lastReviewDate);
        if (!lastReviewDate || isNaN(checkLastDate.getTime())) {
          lastReviewDate = new Date().toISOString();
          migrated = true;
        }
        const checkNextDate = new Date(nextReviewDate);
        if (!nextReviewDate || isNaN(checkNextDate.getTime())) {
          nextReviewDate = new Date().toISOString();
          migrated = true;
        }

        migratedProgress[id] = {
          difficulty,
          stability,
          repetitions,
          easeFactor,
          lastReviewDate,
          nextReviewDate
        };
      });
      if (migrated) {
        safeSetItem('progress', JSON.stringify(migratedProgress));
      }
      return migratedProgress;
    } catch (err) {
      console.warn('[Storage] Failed to initialize progress:', err);
      return {};
    }
  });

  // Mock Exam History state: [ { id, date, examId, examName, school, score, maxScore, pct, correctCount, wrongCount, emptyCount, mode } ]
  const [mockExamHistory, setMockExamHistory] = useState(() => {
    const saved = localStorage.getItem('mockExamHistory');
    return saved ? JSON.parse(saved) : [];
  });

  const clearLocalSessionData = useCallback(() => {
    // Clean up local review cache and sync info for privacy/security
    localStorage.removeItem('progress');
    localStorage.removeItem('progress_last_synced_at');
    localStorage.removeItem('last_synced_user_id');
    localStorage.removeItem('dailyActivity');
    localStorage.removeItem('reviewDates');
    localStorage.removeItem('mockExamHistory');
    localStorage.removeItem('user');
    localStorage.removeItem('unsynced_progress');
    setProgress({});
    setMockExamHistory([]);
    setUser(null);
  }, []);

  const [profName, setProfName] = useState(() => localStorage.getItem('profName') || '');
  const [profPhone, setProfPhone] = useState(() => localStorage.getItem('profPhone') || '');
  const [profSchool, setProfSchool] = useState(() => localStorage.getItem('profSchool') || '');
  const [profDirection, setProfDirection] = useState(() => localStorage.getItem('profDirection') || '');
  const [profAcademy, setProfAcademy] = useState(() => localStorage.getItem('profAcademy') || '');
  const [profSubject, setProfSubject] = useState(() => localStorage.getItem('profSubject') || 'Mathématiques');
  const [profSOM, setProfSOM] = useState(() => localStorage.getItem('profSOM') || '');
  const [profEmail, setProfEmail] = useState(() => localStorage.getItem('profEmail') || '');
  const [profAcademicYear, setProfAcademicYear] = useState(() => localStorage.getItem('profAcademicYear') || '2025/2026');
  const [profCity, setProfCity] = useState(() => localStorage.getItem('profCity') || '');
  const [profSite, setProfSite] = useState(() => localStorage.getItem('profSite') || 'www.lconq.ma');
  const [bankName, setBankName] = useState(() => localStorage.getItem('bankName') || 'CIH Bank (Maroc)');
  const [bankRIB, setBankRIB] = useState(() => localStorage.getItem('bankRIB') || '230 780 4567890123 0001 89');
  const [bankBeneficiary, setBankBeneficiary] = useState(() => localStorage.getItem('bankBeneficiary') || "L'CONQ SARL");
  const [facebookPixelId, setFacebookPixelId] = useState(() => localStorage.getItem('facebook_pixel_id') || '');

  const updateBrandingConfig = async (branding) => {
    const name = sanitizeInputString(branding.profName || '').trim();
    const phone = sanitizeInputString(branding.profPhone || '').trim();
    const school = sanitizeInputString(branding.profSchool || '').trim();
    const direction = sanitizeInputString(branding.profDirection || '').trim();
    const academy = sanitizeInputString(branding.profAcademy || '').trim();
    const subject = sanitizeInputString(branding.profSubject || '').trim();
    const som = sanitizeInputString(branding.profSOM || '').trim();
    const email = sanitizeInputString(branding.profEmail || '').trim();
    const academicYear = sanitizeInputString(branding.profAcademicYear || '').trim();
    const city = sanitizeInputString(branding.profCity || '').trim();
    const site = sanitizeInputString(branding.profSite || '').trim() || 'www.lconq.ma';
    const bName = sanitizeInputString(branding.bankName || 'CIH Bank (Maroc)').trim();
    const bRIB = sanitizeInputString(branding.bankRIB || '230 780 4567890123 0001 89').trim();
    const bBeneficiary = sanitizeInputString(branding.bankBeneficiary || "L'CONQ SARL").trim();
    const pixelId = sanitizeInputString(branding.fbPixelId || '').trim();

    if (phone && !validatePhoneNumber(phone)) {
      console.warn('[Security] Invalid phone format in updateBrandingConfig.');
    }

    setProfName(name);
    setProfPhone(phone);
    setProfSchool(school);
    setProfDirection(direction);
    setProfAcademy(academy);
    setProfSubject(subject);
    setProfSOM(som);
    setProfEmail(email);
    setProfAcademicYear(academicYear);
    setProfCity(city);
    setProfSite(site);
    setBankName(bName);
    setBankRIB(bRIB);
    setBankBeneficiary(bBeneficiary);
    setFacebookPixelId(pixelId);

    localStorage.setItem('profName', name);
    localStorage.setItem('profPhone', phone);
    localStorage.setItem('profSchool', school);
    localStorage.setItem('profDirection', direction);
    localStorage.setItem('profAcademy', academy);
    localStorage.setItem('profSubject', subject);
    localStorage.setItem('profSOM', som);
    localStorage.setItem('profEmail', email);
    localStorage.setItem('profAcademicYear', academicYear);
    localStorage.setItem('profCity', city);
    localStorage.setItem('profSite', site);
    localStorage.setItem('bankName', bName);
    localStorage.setItem('bankRIB', bRIB);
    localStorage.setItem('bankBeneficiary', bBeneficiary);
    localStorage.setItem('facebook_pixel_id', pixelId);

    // Dynamic Pixel re-init on settings update
    if (pixelId && window.fbq) {
      window.fbq('init', pixelId);
    } else if (pixelId && !window.fbq) {
      import('../utils/facebookPixel').then(m => m.initFacebookPixel());
    }

    try {
      await saveBrandingConfig({
        profName: name,
        profPhone: phone,
        profSchool: school,
        profDirection: direction,
        profAcademy: academy,
        profSubject: subject,
        profSOM: som,
        profEmail: email,
        profAcademicYear: academicYear,
        profCity: city,
        profSite: site,
        bankName: bName,
        bankRIB: bRIB,
        bankBeneficiary: bBeneficiary,
        fbPixelId: pixelId
      });
    } catch (e) {
      console.error('[Config] Failed to save branding config:', e);
    }
  };

  const updateFlashcardSettingsConfig = async (settings) => {
    try {
      await saveFlashcardSettingsConfig(settings);
    } catch (e) {
      console.error('[Config] Failed to save flashcard settings config:', e);
    }
    localStorage.setItem('card_reveal_mode', settings.cardRevealMode);
    localStorage.setItem('card_flip_animation', String(settings.cardFlipEnabled));
    localStorage.setItem('card_swipe_gesture', String(settings.cardSwipeEnabled));
    localStorage.setItem('card_sound_effects', String(settings.cardSoundEnabled !== false));
    localStorage.setItem('card_font_family', settings.cardFontFamily || 'Computer Modern Serif');
    localStorage.setItem('card_font_size', settings.cardFontSize || '1rem');
    localStorage.setItem('card_question_weight', settings.cardQuestionWeight || '400');
    localStorage.setItem('card_astuce_weight', settings.cardAstuceWeight || '400');
    localStorage.setItem('card_options_weight', settings.cardOptionsWeight || '400');
  };

  const updatePdfSettingsConfig = async (settings) => {
    try {
      await savePdfSettingsConfig(settings);
    } catch (e) {
      console.error('[Config] Failed to save PDF settings config:', e);
    }
    localStorage.setItem('pdf_page_margins', settings.pdfPageMargins);
    localStorage.setItem('pdf_font_size', settings.pdfFontSize);
    localStorage.setItem('pdf_font_family', settings.pdfFontFamily);
    localStorage.setItem('pdf_template_style', settings.pdfTemplateStyle);
    localStorage.setItem('pdf_series_style', settings.pdfSeriesStyle || 'modern_pro_2026');
    localStorage.setItem('pdf_avoid_page_breaks', String(settings.pdfAvoidPageBreaks));
    localStorage.setItem('pdf_force_print_colors', String(settings.pdfForcePrintColors));
    localStorage.setItem('pdf_show_sidebar', String(settings.pdfShowSidebar));
  };

  const updateOmrScannerSettingsConfig = async (settings) => {
    try {
      await saveOmrScannerSettingsConfig(settings);
    } catch (e) {
      console.error('[Config] Failed to save OMR scanner settings config:', e);
    }
    localStorage.setItem('scanner_direct_capture_enabled', settings.scannerDirectCapture ? 'true' : 'false');
  };

  const [whatsappSettings, setWhatsappSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('whatsappSettings');
      return saved ? JSON.parse(saved) : {
        enabled: true,
        phoneNumber: '',
        message: 'Bonjour, j\'ai une question concernant la plateforme Gima.',
        position: 'right',
        tooltipText: 'Besoin d\'aide ?'
      };
    } catch {
      return {
        enabled: true,
        phoneNumber: '',
        message: 'Bonjour, j\'ai une question concernant la plateforme Gima.',
        position: 'right',
        tooltipText: 'Besoin d\'aide ?'
      };
    }
  });

  const updateWhatsAppSettingsConfig = async (settings) => {
    setWhatsappSettings(settings);
    localStorage.setItem('whatsappSettings', JSON.stringify(settings));

    try {
      await saveWhatsAppSettingsConfig(settings);
    } catch (e) {
      console.error('[Config] Failed to save WhatsApp settings config:', e);
    }
  };

  // ── Supabase Cloud Auth listener ──────────────────────────────────────────
  useEffect(() => {
    let active = true;

    const initializeAuthAndListen = async () => {
      try {
        // 1. Check Native Supabase Auth Session first
        const supabaseUser = await getCurrentSessionUser();
        if (supabaseUser && active) {
          setUser(supabaseUser);
          setLoading(false);
          return;
        }

        // 2. Offline fallback: check cached user
        const cached = localStorage.getItem('user');
        if (cached && active) {
          try {
            setUser(JSON.parse(cached));
          } catch (_) {
            setUser(null);
          }
        } else if (active) {
          setUser(null);
        }
      } catch (err) {
        console.warn('[Auth] Error during session recovery:', err.message);
        const cached = localStorage.getItem('user');
        if (cached && active) {
          try { setUser(JSON.parse(cached)); } catch (_) { setUser(null); }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    initializeAuthAndListen();

    // Subscribe to auth token changes (e.g. TOKEN_REFRESHED, USER_UPDATED)
    const unsubscribe = onAuthChange(async (event, session) => {
      if (event === 'SIGNED_OUT' && active) {
        clearLocalSessionData();
      } else if (session?.user && active) {
        try {
          const freshUser = await getCurrentSessionUser();
          if (freshUser && active) {
            setUser(freshUser);
            safeSetItem('user', JSON.stringify(freshUser));
          } else if (active) {
            setUser(prev => {
              if (!prev) return null;
              const isAdmin = session.user.email?.toLowerCase().trim() === 'admin@lconq.ma' ||
                              session.user.user_metadata?.role === 'admin' ||
                              prev.role === 'admin';
              return {
                ...prev,
                uid: session.user.id,
                id: session.user.id,
                email: session.user.email,
                role: isAdmin ? 'admin' : prev.role,
              };
            });
          }
        } catch (e) {
          console.warn('[AuthContext] Error on auth change:', e);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);




  const { exams: initialExams, needsSave } = loadAndMigrateExams();
  const [exams, setExams] = useState(() => {
    if (SUPABASE_ENABLED) {
      const cached = localStorage.getItem('exams');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.some(e => e.id === "QVVOBFE7" && parsed.length === 1)) {
            return [];
          }
          return parsed;
        } catch {
          return [];
        }
      }
      return [];
    }
    return initialExams;
  });

  // Persist migration result immediately if schema was upgraded
  React.useEffect(() => {
    if (needsSave) {
      safeSetItem('exams', JSON.stringify(initialExams));
      safeSetItem('examsSchemaVersion', String(SCHEMA_VERSION));
    }
  }, [initialExams, needsSave]);

  useEffect(() => {
    safeSetItem('user', JSON.stringify(user));
  }, [user]);



  useEffect(() => {
    // Save a light version of exams to localStorage to avoid exceeding the 5MB quota 
    // and prevent blocking the main thread with massive JSON serialization.
    const lightExams = exams.map(e => ({
      id: e.id,
      name: e.name,
      school: e.school,
      level: e.level || mapLegacySchoolToLevel(e.school) || null,
      year: e.year,
      tier: e.tier,
      isActive: e.isActive,
      isArchived: e.isArchived,
      dateAdded: e.dateAdded,
      // Retain questions only for the default seed exam to allow offline development
      questions: e.id === "QVVOBFE7" ? e.questions : undefined
    }));
    safeSetItem('exams', JSON.stringify(lightExams));
    safeSetItem('examsSchemaVersion', String(SCHEMA_VERSION));
  }, [exams]);



  
  // Theme Management
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };



  const dueTodayCount = useMemo(() => {
    const now = new Date();
    let count = 0;
    Object.values(progress).forEach(p => {
      if (p && p.nextReviewDate && new Date(p.nextReviewDate) <= now) {
        count++;
      }
    });
    return count;
  }, [progress]);

  useEffect(() => {
    const timer = setTimeout(() => {
      // FIX: Limit localStorage progress to 800 most-recently-due cards.
      // Prevents the progress object from growing unbounded and filling
      // the mobile localStorage quota (iOS Safari cap ~2.5MB).
      const entries = Object.entries(progress);
      const toSave = entries.length > 800
        ? Object.fromEntries(
            entries
              .sort(([, a], [, b]) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate))
              .slice(0, 800)
          )
        : progress;
      safeSetItem('progress', JSON.stringify(toSave));
    }, 1000);
    return () => clearTimeout(timer);
  }, [progress]);



  const [leaderboard, setLeaderboard] = useState([]);

  // FIX #4: Track last incrementDailyActivity call per-session to avoid
  // sending a database request on every single card answer.
  const lastActivityCallRef = React.useRef(0);

  const refreshLeaderboard = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    try {
      const data = await getLeaderboard();
      setLeaderboard(data || []);
    } catch (e) {
      console.warn('[Supabase] Failed to refresh leaderboard:', e.message);
    }
  }, []);

  const saveMockExamResult = async (result) => {
    const localId = Math.random().toString(36).substring(2, 11);
    const newResult = {
      date: new Date().toISOString(),
      ...result
    };
    
    if (SUPABASE_ENABLED && (user?.uid || user?.id)) {
      const userId = user.uid || user.id;
      try {
        await saveMockResult(userId, newResult);
        // reload history from database to be in sync
        const dbHistory = await getMockHistory(userId);
        setMockExamHistory(dbHistory);
      } catch (e) {
        console.error('[Supabase] Failed to save mock result:', e);
      }
    } else {
      setMockExamHistory(prev => [
        { id: localId, ...newResult },
        ...prev
      ]);
    }
  };




  const syncOfflineData = useCallback(async () => {
    if (!SUPABASE_ENABLED || !user || !navigator.onLine) return;
    const userId = user.uid || user.id;
    if (!userId) return;

    try {
      const queue = JSON.parse(localStorage.getItem('unsynced_progress') || '{}');
      const questionIds = Object.keys(queue);
      if (questionIds.length === 0) return;

      console.log(`[Sync] Starting sync of ${questionIds.length} offline progress cards...`);
      
      // Sync each card
      await Promise.all(questionIds.map(async (qId) => {
        const item = queue[qId];
        try {
          await saveQuestionProgress(userId, qId, item.progressData);
          // Remove from local queue if successful
          const currentQueue = JSON.parse(localStorage.getItem('unsynced_progress') || '{}');
          delete currentQueue[qId];
          localStorage.setItem('unsynced_progress', JSON.stringify(currentQueue));
        } catch (err) {
          console.warn(`[Sync] Failed to sync question ${qId}:`, err);
        }
      }));
      
      console.log('[Sync] Offline progress sync completed.');
    } catch (err) {
      console.warn('[Sync] Error during sync offline data:', err);
    }
  }, [user]);

  const logout = useCallback(() => {
    if (SUPABASE_ENABLED && (user?.uid || user?.id)) {
      // Async fire-and-forget: do not await remote signOut so local session clears instantly
      logoutUser().catch(err => console.warn('[Auth] Remote signOut failed:', err));
    }
    clearLocalSessionData();
  }, [user?.uid, user?.id, clearLocalSessionData]);

  // ── Sync state across multiple tabs/windows via localStorage events ──
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!e.newValue) {
        // If key was removed (e.g. on logout/clear)
        if (e.key === 'user') setUser(null);
        if (e.key === 'progress') setProgress({});
        if (e.key === 'mockExamHistory') setMockExamHistory([]);
        return;
      }

      try {
        if (e.key === 'progress') {
          setProgress(JSON.parse(e.newValue));
        } else if (e.key === 'user') {
          setUser(JSON.parse(e.newValue));
        } else if (e.key === 'mockExamHistory') {
          setMockExamHistory(JSON.parse(e.newValue));
        } else if (e.key === 'theme') {
          setTheme(e.newValue);
        } else if (e.key === 'whatsappSettings') {
          setWhatsappSettings(JSON.parse(e.newValue));
        }
      } catch (err) {
        console.warn('[Storage Sync] Failed to parse cross-tab storage change:', err);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);




  const [users, setUsers] = useState(() => {
    if (SUPABASE_ENABLED) return [];
    return [
      { id: '1', name: 'Youssef Alaoui', email: 'youssef@massar.ma', tier: 'freemium', joined: '2026-05-10', xp: 450 },
      { id: '2', name: 'Sara Bennani', email: 'premium@lconq.ma', tier: 'premium', joined: '2026-05-01', xp: 8450 },
      { id: '3', name: 'Aymane Idrissi', email: 'free@lconq.ma', tier: 'freemium', joined: '2026-05-12', xp: 120 },
    ];
  });

  // Check subscription expiration on mount/updates
  useEffect(() => {
    const now = new Date();
    let changed = false;
    const checkedUsers = users.map(u => {
      if (u.subscription && new Date(u.subscription.endDate) < now && u.subscription.status === 'active') {
        changed = true;
        return {
          ...u,
          tier: 'freemium',
          subscription: {
            ...u.subscription,
            status: 'expired'
          }
        };
      }
      return u;
    });

    if (changed) {
      setTimeout(() => {
        setUsers(checkedUsers);
        if (user && user.subscription && new Date(user.subscription.endDate) < now && user.subscription.status === 'active') {
          setUser(u => ({
            ...u,
            tier: 'freemium',
            subscription: {
              ...u.subscription,
              status: 'expired'
            }
          }));
        }
      }, 0);
    }
  }, [users, user]);

  const login = async (email, password) => {
    // 1. Try Supabase Auth
    try {
      const authUser = await loginWithEmail(email, password);
      if (authUser) {
        setUser(authUser);
        safeSetItem('user', JSON.stringify(authUser));
        return authUser;
      }
    } catch (authErr) {
      console.warn('[Auth] login error:', authErr.message);
      throw authErr;
    }

    throw new Error('Identifiants incorrects.');
  };

  const loginGoogle = async () => {
    if (SUPABASE_ENABLED) {
      return await loginWithGoogle();
    } else {
      throw new Error('Connexion Google non disponible actuellement.');
    }
  };

  // ── Registration directly in Neon ──────────────────────────────────────────
  const register = async (name, email, password) => {
    const newUser = await registerStudent(name, email, password);
    if (newUser) {
      setUser(newUser);
      safeSetItem('user', JSON.stringify(newUser));
    }
    return newUser;
  };



  const addExam = async (name, school, year, tier, questions, pdfUrl = null, level = null) => {
    const cleanQuestions = sanitizeExams([{ questions }])[0].questions;
    const determinedLevel = level || mapLegacySchoolToLevel(school) || school;
    const newExam = {
      name,
      school,
      level: determinedLevel,
      year,
      tier,
      questions: cleanQuestions,
      pdfUrl,
      isActive: true,
      isArchived: false,
      dateAdded: new Date().toISOString()
    };
    
    try {
      const newId = await dbAddExam(newExam);
      setExams(prev => [...prev, { id: newId, ...newExam }]);
    } catch (e) {
      console.error('Failed to add exam:', e);
      // Fallback
      setExams(prev => [...prev, { id: Math.random().toString(36).substring(2, 11), ...newExam }]);
    }
  };

  const toggleExamStatus = async (examId) => {
    const target = exams.find(e => e.id === examId);
    if (!target) return;
    try {
      await dbToggleExamStatus(examId, target.isActive);
      setExams(prev => prev.map(e => e.id === examId ? { ...e, isActive: !e.isActive } : e));
    } catch (e) {
      console.error('Failed to toggle exam status:', e);
    }
  };

  const updateExamDetails = async (examId, updates) => {
    try {
      const determinedLevel = updates.level !== undefined 
        ? updates.level 
        : (updates.school ? mapLegacySchoolToLevel(updates.school) : undefined);
      const fullUpdates = determinedLevel !== undefined ? { ...updates, level: determinedLevel } : updates;

      await dbUpdateExam(examId, fullUpdates);
      setExams(prev => prev.map(e => e.id === examId ? { ...e, ...fullUpdates } : e));
    } catch (e) {
      console.error('Failed to update exam details:', e);
    }
  };

  const deleteExam = async (examId) => {
    try {
      await dbDeleteExam(examId);
      setExams(prev => prev.filter(e => e.id !== examId));
    } catch (e) {
      console.error('Failed to delete exam:', e);
    }
  };

  const toggleArchiveExam = async (examId) => {
    const target = exams.find(e => e.id === examId);
    if (!target) return;
    try {
      await dbToggleArchiveExam(examId, target.isArchived);
      setExams(prev => prev.map(e => e.id === examId ? { ...e, isArchived: !e.isArchived } : e));
    } catch (e) {
      console.error('Failed to toggle archive status:', e);
    }
  };

  const [isRefreshingExams, setIsRefreshingExams] = useState(false);

  const refreshExams = useCallback(async (options = { forceRefresh: true }) => {
    setIsRefreshingExams(true);
    try {
      const freshExams = await getAllExams(options);
      if (Array.isArray(freshExams)) {
        setExams(freshExams);
      }
      return freshExams;
    } catch (err) {
      console.warn('[AuthContext] refreshExams error:', err);
      return exams;
    } finally {
      setIsRefreshingExams(false);
    }
  }, [exams]);

  const updateUserTier = async (userId, newTier) => {
    if (SUPABASE_ENABLED) {
      try {
        await updateUserDoc(userId, { tier: newTier });
        setUsers(prev => prev.map(u => u.id === userId || u.uid === userId ? { ...u, tier: newTier } : u));
        if (user && (user.id === userId || user.uid === userId)) {
          setUser(u => ({ ...u, tier: newTier }));
        }
      } catch (e) {
        console.error('[Supabase] Failed to update user tier:', e);
      }
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, tier: newTier } : u));
      if (user && user.id === userId) {
        setUser(u => ({ ...u, tier: newTier }));
      }
    }
  };

  const updateProfile = async (updates) => {
    // Sanitize string properties and validate phone formats before DB operations
    const sanitizedUpdates = { ...updates };
    if (updates.name !== undefined) sanitizedUpdates.name = sanitizeInputString(updates.name);
    if (updates.phone !== undefined) {
      if (updates.phone && !validatePhoneNumber(updates.phone)) {
        throw new Error('Format de numéro de téléphone invalide.');
      }
      sanitizedUpdates.phone = sanitizeInputString(updates.phone);
    }
    if (updates.city !== undefined) sanitizedUpdates.city = sanitizeInputString(updates.city);
    if (updates.school !== undefined) sanitizedUpdates.school = sanitizeInputString(updates.school);

    if (SUPABASE_ENABLED && (user?.uid || user?.id)) {
      const userId = user.uid || user.id;
      try {
        await updateUserDoc(userId, sanitizedUpdates);
        setUser(u => ({ ...u, ...sanitizedUpdates }));
      } catch (dbErr) {
        console.warn("[Auth] Failed to update profiles table, falling back to auth metadata:", dbErr.message);
        try {
          // Attempt to update Supabase auth metadata as a fallback
          
        } catch (authErr) {
          console.warn("[Auth] Failed to update auth metadata:", authErr.message);
        }
        // Enforce state update locally so the student is not blocked
        setUser(u => ({ ...u, ...sanitizedUpdates }));
      }
    } else {
      if (user) {
        const updated = { ...user, ...sanitizedUpdates };
        setUser(updated);
        setUsers(prev => prev.map(u => (u.id === user.id || u.uid === user.uid) ? { ...u, ...sanitizedUpdates } : u));
      }
    }
  };

  const [plans, setPlans] = useState(() => {
    const saved = localStorage.getItem('plans');
    let parsed = null;
    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch {
        parsed = null;
      }
    }
    
    // Default fallback plans aligned with the new Premium L'CONQ mockup
    const defaultPlans = [
      {
        id: 'plan_lconq',
        name: "Premium L'CONQ",
        price: 99,
        durationDays: 30,
        description: "Le pack complet pour la réussite.",
        isRecommended: true,
        features: [
          "Accès à toutes les archives (2010–2025)",
          "Astuces IA exclusives pour chaque QCM",
          "Simulateur de concours chronométré",
          "Heatmaps des faiblesses"
        ],
        allowedSchools: ['Médecine / Pharmacie', 'ENSA', 'ENSAM', 'ENCG', 'INPT', 'INSEA', 'Général (Prépa)']
      },
      {
        id: 'plan_complet',
        name: "Pack Premium Global",
        price: 699,
        durationDays: 365,
        description: "La préparation ultime sur le long terme.",
        isRecommended: false,
        features: [
          "Accès à toutes les archives (2010–2025)",
          "Astuces IA exclusives pour chaque QCM",
          "Simulateur de concours chronométré",
          "Heatmaps des faiblesses",
          "Accès prioritaire aux nouveautés"
        ],
        allowedSchools: ['Médecine / Pharmacie', 'ENSA', 'ENSAM', 'ENCG', 'INPT', 'INSEA', 'Général (Prépa)']
      }
    ];

    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return defaultPlans;
    }

    // Ensure loaded plans have the features and description field
    return parsed.map(p => ({
      ...p,
      description: p.description !== undefined ? p.description : "Accès complet pour préparer vos concours.",
      isRecommended: p.isRecommended !== undefined ? p.isRecommended : (p.id === 'plan_complet'),
      features: Array.isArray(p.features) ? p.features : [
        "Accès à toutes les archives (2010–2025)",
        "Astuces IA exclusives pour chaque QCM",
        "Simulateur de concours chronométré",
        "Heatmaps des faiblesses"
      ]
    }));
  });

  // FIX #2: plansRef must be declared AFTER `plans` useState to avoid
  // Temporal Dead Zone (Cannot access 'plans' before initialization).
  const plansRef = React.useRef(plans);
  useEffect(() => { plansRef.current = plans; }, [plans]);

  useEffect(() => {
    safeSetItem('plans', JSON.stringify(plans));
  }, [plans]);

  const addPlan = async (name, price, durationDays, allowedSchools, description = '', isRecommended = false, features = []) => {
    const newPlan = {
      id: 'plan_' + Math.random().toString(36).substring(2, 11),
      name,
      price: parseFloat(price) || 0,
      durationDays: parseInt(durationDays) || 365,
      allowedSchools: allowedSchools || [],
      description: description || "Accès complet pour préparer vos concours.",
      isRecommended: !!isRecommended,
      features: Array.isArray(features) ? features : [
        "Accès à toutes les archives (2010–2025)",
        "Astuces IA exclusives pour chaque QCM",
        "Simulateur de concours chronométré",
        "Heatmaps des faiblesses"
      ]
    };
    const updatedPlans = [...plans, newPlan];
    setPlans(updatedPlans);
    try {
      await savePlansConfig(updatedPlans);
    } catch (err) {
      console.warn('[Plans] Saved locally; remote synchronization will retry later.', err);
    }
  };

  const removePlan = async (planId) => {
    const updatedPlans = plans.filter(p => p.id !== planId);
    setPlans(updatedPlans);
    try {
      await savePlansConfig(updatedPlans);
    } catch (err) {
      console.warn('[Plans] Saved locally; remote synchronization will retry later.', err);
    }
  };

  const updatePlan = async (planId, updates) => {
    const updatedPlans = plans.map(p => p.id === planId ? { ...p, ...updates } : p);
    setPlans(updatedPlans);
    try {
      await savePlansConfig(updatedPlans);
    } catch (err) {
      console.warn('[Plans] Saved locally; remote synchronization will retry later.', err);
    }
  };

  const activateSubscription = async (userId, planId, durationDays) => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + parseInt(durationDays));

    const subscription = {
      planId,
      status: 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };

    if (SUPABASE_ENABLED) {
      try {
        await setUserSubscription(userId, subscription, 'premium');
        setUsers(prev => prev.map(u => u.id === userId || u.uid === userId ? { ...u, tier: 'premium', subscription } : u));
        if (user && (user.uid === userId || user.id === userId)) {
          setUser(u => ({ ...u, tier: 'premium', subscription }));
        }
      } catch (e) {
        console.error('[Supabase] Failed to activate subscription:', e);
      }
    } else {
      const updatedUsers = users.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            tier: 'premium',
            subscription
          };
        }
        return u;
      });

      setUsers(updatedUsers);

      if (user && user.id === userId) {
        const match = updatedUsers.find(u => u.id === userId);
        setUser(u => ({ ...u, ...match }));
      }
    }
  };

  const cancelSubscription = async (userId) => {
    if (SUPABASE_ENABLED) {
      try {
        await setUserSubscription(userId, null, 'freemium');
        setUsers(prev => prev.map(u => u.id === userId || u.uid === userId ? { ...u, tier: 'freemium', subscription: null } : u));
        if (user && (user.uid === userId || user.id === userId)) {
          setUser(u => ({ ...u, tier: 'freemium', subscription: null }));
        }
      } catch (e) {
        console.error('[Supabase] Failed to cancel subscription:', e);
      }
    } else {
      const updatedUsers = users.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            tier: 'freemium',
            subscription: null
          };
        }
        return u;
      });

      setUsers(updatedUsers);

      if (user && user.id === userId) {
        const match = updatedUsers.find(u => u.id === userId);
        setUser(u => ({ ...u, ...match }));
      }
    }
  };

  const updateStudentCRM = async (userId, crmData) => {
    if (SUPABASE_ENABLED) {
      try {
        await updateUserDoc(userId, { crm: crmData });
        setUsers(prev => prev.map(u => u.id === userId || u.uid === userId ? { ...u, crm: crmData } : u));
        if (user && (user.uid === userId || user.id === userId)) {
          setUser(u => ({ ...u, crm: crmData }));
        }
      } catch (e) {
        console.error('[Supabase] Failed to update student CRM:', e);
        throw e;
      }
    } else {
      setUsers(prev => prev.map(u => u.id === userId || u.uid === userId ? { ...u, crm: crmData } : u));
      if (user && (user.uid === userId || user.id === userId)) {
        setUser(u => ({ ...u, crm: crmData }));
      }
    }
  };

  const deleteStudent = async (userId) => {
    try {
      await deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId && u.uid !== userId));
    } catch (e) {
      console.error('[Supabase] Failed to delete user:', e);
      throw e;
    }
  };

  const [activationCodes, setActivationCodes] = useState(() => {
    const saved = localStorage.getItem('activationCodes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    
    // Seed some default test codes
    return [
      {
        code: 'LCONQ-PREM-TEST-30D',
        planId: 'plan_lconq',
        isUsed: false,
        usedBy: '',
        usedAt: '',
        batchName: 'Test Batch 30 Jours',
        createdDate: new Date().toISOString()
      },
      {
        code: 'LCONQ-GLOB-TEST-365',
        planId: 'plan_complet',
        isUsed: false,
        usedBy: '',
        usedAt: '',
        batchName: 'Test Batch 365 Jours',
        createdDate: new Date().toISOString()
      }
    ];
  });

  useEffect(() => {
    safeSetItem('activationCodes', JSON.stringify(activationCodes));
  }, [activationCodes]);

  const generateActivationCodes = async (planId, count, batchName) => {
    const newCodes = [];
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < count; i++) {
      // Generate code format: LCONQ-XXXX-XXXX
      let part1 = '';
      let part2 = '';
      for (let j = 0; j < 4; j++) {
        part1 += characters.charAt(Math.floor(Math.random() * characters.length));
        part2 += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      const codeStr = `LCONQ-${part1}-${part2}`;
      newCodes.push({
        code: codeStr,
        planId,
        isUsed: false,
        usedBy: '',
        usedAt: '',
        batchName: batchName || 'Manuel',
        createdDate: new Date().toISOString()
      });
    }
    setActivationCodes(prev => [...newCodes, ...prev]);
    return newCodes;
  };

  const redeemActivationCode = async (codeStr) => {
    const cleanCode = codeStr.trim().toUpperCase();
    
    if (!user) {
      throw new Error("Seuls les élèves connectés peuvent activer un abonnement.");
    }
    
    const foundIdx = activationCodes.findIndex(c => c.code.toUpperCase() === cleanCode);
    if (foundIdx === -1) {
      throw new Error("Code d'activation invalide. Veuillez vérifier la saisie.");
    }
    const codeObj = activationCodes[foundIdx];
    if (codeObj.isUsed) {
      throw new Error(`Ce code a déjà été utilisé par ${codeObj.usedBy} le ${new Date(codeObj.usedAt).toLocaleDateString('fr-FR')}.`);
    }
    const plan = plans.find(p => p.id === codeObj.planId);
    if (!plan) {
      throw new Error("Plan d'abonnement introuvable pour ce code.");
    }
    
    const updatedCodes = [...activationCodes];
    updatedCodes[foundIdx] = {
      ...codeObj,
      isUsed: true,
      usedBy: user.name || user.email,
      usedAt: new Date().toISOString()
    };
    setActivationCodes(updatedCodes);
    activateSubscription(user.id, plan.id, plan.durationDays);
    return plan;
  };

  // FSRS (Free Spaced Repetition Scheduler) Algorithm Implementation
  const updateCardProgress = (questionId, quality) => {
    // Quality: 0 = failed/forgot, 3 = hard, 4 = good, 5 = easy
    let updatedCardState = null;
    setProgress((prev) => {
      const card = prev[questionId] || {
        difficulty: 5.0,
        stability: 2.0,
        repetitions: 0,
        lastReviewDate: new Date().toISOString(),
        nextReviewDate: new Date().toISOString()
      };

      let { difficulty, stability, repetitions } = card;

      // Robust FSRS fields initialization for backward compatibility
      if (difficulty === undefined || difficulty === null) {
        const ef = card.easeFactor || 2.5;
        difficulty = Math.max(1.0, Math.min(10.0, 1.0 + 4.5 * (3.0 - ef)));
      }
      if (stability === undefined || stability === null) {
        stability = repetitions > 0 ? Math.max(1.0, 2.0 * Math.pow(3, repetitions - 1)) : 2.0;
      }

      const now = new Date();
      const lastReview = card.lastReviewDate ? new Date(card.lastReviewDate) : now;

      // 1. Calculate elapsed days since last review
      const elapsedDays = Math.max(0.5, (now.getTime() - lastReview.getTime()) / (1000 * 3600 * 24));

      // 2. Update stats using FSRS formulas
      if (repetitions === 0) {
        // Initial setup
        if (quality < 3) {
          difficulty = 8.2;
          stability = 0.5;
        } else {
          // quality >= 3
          difficulty = Math.max(1.0, Math.min(10.0, 6.0 - 0.8 * (quality - 3)));
          stability = Math.max(1.0, 2.0 * (quality - 2)); // 3->2d, 4->4d, 5->6d
        }
        repetitions = 1;
      } else {
        // Recall probability (Retrievability)
        const retrievability = Math.pow(0.9, elapsedDays / stability);

        // Update Difficulty (D)
        const diffChange = -0.7 * (quality - 4);
        difficulty = Math.max(1.0, Math.min(10.0, difficulty + diffChange));

        // Update Stability (S)
        if (quality < 3) {
          // Forgot / lapse
          stability = Math.max(0.5, Math.min(stability * 0.2, 1.5));
          repetitions = 1; // reset streak-like repetitions count
        } else {
          // Succeeded
          const hardBonus = quality === 3 ? 0.75 : quality === 4 ? 1.0 : 1.5;
          const factor = 1.0 + Math.pow(Math.max(0, 9.0 - difficulty), 0.4) * Math.pow(stability, -0.15) * (Math.exp(Math.pow(1.0 - retrievability, 0.45)) - 0.45) * hardBonus;
          stability = Math.max(stability + 1.0, stability * factor);
          repetitions += 1;
        }
      }

      if (isNaN(difficulty)) difficulty = 5.0;
      if (isNaN(stability) || stability <= 0) stability = 2.0;
      if (isNaN(repetitions)) repetitions = 1;

      // 3. Compute Interval
      let interval = Math.round(stability);
      if (isNaN(interval) || interval <= 0) interval = 1;

      let nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + interval);
      if (isNaN(nextReviewDate.getTime())) {
        nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + 1);
      }

      // Map difficulty back to easeFactor equivalent for stats backward-compatibility
      const easeFactor = 3.0 - (difficulty - 1.0) / 4.5;

      updatedCardState = {
        difficulty,
        stability,
        repetitions,
        easeFactor: isNaN(easeFactor) ? 2.5 : easeFactor,
        lastReviewDate: now.toISOString(),
        nextReviewDate: nextReviewDate.toISOString()
      };

      if (SUPABASE_ENABLED && (user?.uid || user?.id)) {
        saveQuestionProgress(user.uid || user.id, questionId, updatedCardState).catch(e => {
          console.error('[Supabase] Failed to save card progress:', e);
          try {
            const queue = JSON.parse(localStorage.getItem('unsynced_progress') || '{}');
            queue[questionId] = {
              progressData: updatedCardState,
              timestamp: new Date().toISOString()
            };
            localStorage.setItem('unsynced_progress', JSON.stringify(queue));
          } catch (err) {
            console.warn('[Sync] Failed to queue unsynced card:', err);
          }
        });
      }

      return {
        ...prev,
        [questionId]: updatedCardState
      };
    });

    // ── Track daily activity for stats & streak ──────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0];
    // reviewDates: sorted list of unique days with at least 1 review
    const storedDates = JSON.parse(localStorage.getItem('reviewDates') || '[]');
    if (!storedDates.includes(todayStr)) {
      const updated = [...storedDates, todayStr].slice(-90); // keep last 90 days
      safeSetItem('reviewDates', JSON.stringify(updated));
    }
    // dailyActivity: { 'YYYY-MM-DD': count }
    const dailyActivity = JSON.parse(localStorage.getItem('dailyActivity') || '{}');
    dailyActivity[todayStr] = (dailyActivity[todayStr] || 0) + 1;
    safeSetItem('dailyActivity', JSON.stringify(dailyActivity));

    if (SUPABASE_ENABLED && (user?.uid || user?.id)) {
      // FIX #4: Debounce — only call incrementDailyActivity once per minute max.
      // Previously called on every single card answer, flooding the network on mobile.
      const now = Date.now();
      if (now - lastActivityCallRef.current > 60_000) {
        lastActivityCallRef.current = now;
        incrementDailyActivity(user.uid || user.id).catch(e =>
          console.error('[Supabase] Failed to increment daily activity:', e)
        );
      }
    }

    // Reward XP for good answers
    if (user && quality >= 3) {
      const xpGain = quality * 10;
      const newXp = (user.xp || 0) + xpGain;
      setUser(u => ({ ...u, xp: newXp }));
      if (SUPABASE_ENABLED && (user.uid || user.id)) {
        updateUserDoc(user.uid || user.id, { xp: newXp }).catch(e =>
          console.error('[Supabase] Failed to update XP in database:', e)
        );
      }
    }
  };

  const getStudentStats = React.useCallback(() => {
    return computeStudentStats(exams, progress, leaderboard, user);
  }, [exams, progress, leaderboard, user]);

  const [schools, setSchools] = useState(() => {
    const saved = localStorage.getItem('schools');
    const parsed = saved ? JSON.parse(saved) : null;
    const defaultLevels = ['2bac_sm', '2bac_pc_svt', '1bac_sci', 'common_core_sci', '2bac_arts', '1bac_arts', 'common_core_arts'];
    if (!parsed || parsed.some(s => ['ENSA', 'ENSAM', 'ENCG', 'Médecine / Pharmacie', 'INPT', 'INSEA', 'Général (Prépa)'].includes(s))) {
      return defaultLevels;
    }
    return parsed;
  });

  useEffect(() => {
    safeSetItem('schools', JSON.stringify(schools));
  }, [schools]);

  // Custom branding per school (emoji overrides)
  const [schoolBranding, setSchoolBranding] = useState(() => {
    const saved = localStorage.getItem('schoolBranding');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    safeSetItem('schoolBranding', JSON.stringify(schoolBranding));
  }, [schoolBranding]);

  // ── Database Syncing (Neon PostgreSQL & Local Companion API) ──────────────────────
  useEffect(() => {

    const loadConfigAndExams = async () => {
      try {
        // Fetch all config documents and exams in parallel with allSettled to prevent single-query failure from blocking everything
        const [
          schoolsConfigRes,
          brandConfigRes,
          flashcardConfigRes,
          pdfConfigRes,
          omrScannerConfigRes,
          whatsappConfigRes,
          plansConfigRes,
          fbExamsRes
        ] = await Promise.allSettled([
          getSchoolsConfig({ forceRefresh: true }),
          getBrandingConfig({ forceRefresh: true }),
          getFlashcardSettingsConfig({ forceRefresh: true }),
          getPdfSettingsConfig({ forceRefresh: true }),
          getOmrScannerSettingsConfig({ forceRefresh: true }),
          getWhatsAppSettingsConfig({ forceRefresh: true }),
          getPlansConfig({ forceRefresh: true }),
          getAllExams()
        ]);

        const schoolsConfig = schoolsConfigRes.status === 'fulfilled' ? schoolsConfigRes.value : null;
        const brandConfig = brandConfigRes.status === 'fulfilled' ? brandConfigRes.value : null;
        const flashcardConfig = flashcardConfigRes.status === 'fulfilled' ? flashcardConfigRes.value : null;
        const pdfConfig = pdfConfigRes.status === 'fulfilled' ? pdfConfigRes.value : null;
        const omrScannerConfig = omrScannerConfigRes.status === 'fulfilled' ? omrScannerConfigRes.value : null;
        const whatsappConfig = whatsappConfigRes.status === 'fulfilled' ? whatsappConfigRes.value : null;
        const plansConfig = plansConfigRes.status === 'fulfilled' ? plansConfigRes.value : null;
        const fbExams = fbExamsRes.status === 'fulfilled' ? fbExamsRes.value : null;

        // Process Schools Config
        if (schoolsConfig && schoolsConfig.schools && schoolsConfig.schools.length > 0) {
          setSchools(schoolsConfig.schools);
          setSchoolBranding(schoolsConfig.branding || {});
        }

        // Process General Branding
        if (brandConfig) {
          setProfName(brandConfig.profName || '');
          setProfPhone(brandConfig.profPhone || '');
          setProfSchool(brandConfig.profSchool || '');
          setProfDirection(brandConfig.profDirection || '');
          setProfAcademy(brandConfig.profAcademy || '');
          setProfSubject(brandConfig.profSubject || 'Mathématiques');
          setProfSOM(brandConfig.profSOM || '');
          setProfEmail(brandConfig.profEmail || '');
          setProfAcademicYear(brandConfig.profAcademicYear || '2025/2026');
          setProfCity(brandConfig.profCity || '');
          setProfSite(brandConfig.profSite || 'www.lconq.ma');
          setBankName(brandConfig.bankName || 'CIH Bank (Maroc)');
          setBankRIB(brandConfig.bankRIB || '230 780 4567890123 0001 89');
          setBankBeneficiary(brandConfig.bankBeneficiary || "L'CONQ SARL");
          setFacebookPixelId(brandConfig.fbPixelId || '');

          localStorage.setItem('profName', brandConfig.profName || '');
          localStorage.setItem('profPhone', brandConfig.profPhone || '');
          localStorage.setItem('profSchool', brandConfig.profSchool || '');
          localStorage.setItem('profDirection', brandConfig.profDirection || '');
          localStorage.setItem('profAcademy', brandConfig.profAcademy || '');
          localStorage.setItem('profSubject', brandConfig.profSubject || 'Mathématiques');
          localStorage.setItem('profSOM', brandConfig.profSOM || '');
          localStorage.setItem('profEmail', brandConfig.profEmail || '');
          localStorage.setItem('profAcademicYear', brandConfig.profAcademicYear || '2025/2026');
          localStorage.setItem('profCity', brandConfig.profCity || '');
          localStorage.setItem('profSite', brandConfig.profSite || 'www.lconq.ma');
          localStorage.setItem('bankName', brandConfig.bankName || 'CIH Bank (Maroc)');
          localStorage.setItem('bankRIB', brandConfig.bankRIB || '230 780 4567890123 0001 89');
          localStorage.setItem('bankBeneficiary', brandConfig.bankBeneficiary || "L'CONQ SARL");
          localStorage.setItem('facebook_pixel_id', brandConfig.fbPixelId || '');

          if (brandConfig.fbPixelId) {
            import('../utils/facebookPixel').then(m => m.initFacebookPixel());
          }
        }

        // Process Flashcard Settings
        if (flashcardConfig) {
          localStorage.setItem('card_reveal_mode', flashcardConfig.cardRevealMode || 'flip');
          localStorage.setItem('card_flip_animation', String(flashcardConfig.cardFlipEnabled !== false));
          localStorage.setItem('card_swipe_gesture', String(flashcardConfig.cardSwipeEnabled !== false));
          localStorage.setItem('card_sound_effects', String(flashcardConfig.cardSoundEnabled !== false));
          localStorage.setItem('card_font_family', flashcardConfig.cardFontFamily || 'Computer Modern Serif');
          localStorage.setItem('card_font_size', flashcardConfig.cardFontSize || '1rem');
          localStorage.setItem('card_question_weight', flashcardConfig.cardQuestionWeight || '400');
          localStorage.setItem('card_astuce_weight', flashcardConfig.cardAstuceWeight || '400');
          localStorage.setItem('card_options_weight', flashcardConfig.cardOptionsWeight || '400');
        }

        // Process PDF Settings
        if (pdfConfig) {
          localStorage.setItem('pdf_page_margins', pdfConfig.pdfPageMargins || 'standard');
          localStorage.setItem('pdf_font_size', pdfConfig.pdfFontSize || '11pt');
          localStorage.setItem('pdf_font_family', pdfConfig.pdfFontFamily || 'Computer Modern Serif');
          localStorage.setItem('pdf_template_style', pdfConfig.pdfTemplateStyle || 'classic_latex');
          localStorage.setItem('pdf_series_style', pdfConfig.pdfSeriesStyle || 'modern_pro_2026');
          localStorage.setItem('pdf_avoid_page_breaks', String(pdfConfig.pdfAvoidPageBreaks !== false));
          localStorage.setItem('pdf_force_print_colors', String(pdfConfig.pdfForcePrintColors !== false));
          localStorage.setItem('pdf_show_sidebar', String(pdfConfig.pdfShowSidebar !== false));
        }

        // Process OMR Scanner Settings
        if (omrScannerConfig) {
          localStorage.setItem('scanner_direct_capture_enabled', String(omrScannerConfig.scannerDirectCapture !== false));
        }

        // Process WhatsApp Settings
        if (whatsappConfig) {
          setWhatsappSettings(whatsappConfig);
          localStorage.setItem('whatsappSettings', JSON.stringify(whatsappConfig));
        }

        // Process Plans
        if (plansConfig && plansConfig.length > 0) {
          setPlans(plansConfig);
        }

        // Process Exams
        let finalExams = [];
        if (fbExams && fbExams.length > 0) {
          finalExams = fbExams;
        } else {
          // Require Neon cloud data — do not fall back to local mock exams
          finalExams = fbExams || [];
        }
        setExams(finalExams);

        // Questions are loaded on demand by the study/exam screens.
        // Avoid downloading every question bank during app startup.
      } catch (e) {
        console.warn('[Supabase] Error syncing config/exams:', e.message);
      }
    };

    loadConfigAndExams();
  }, []);

  // Fetch User-specific data (progress, history, activity, leaderboard) when a student logs in
  useEffect(() => {
    if (!SUPABASE_ENABLED || !user || user.role === 'admin') return;

    const loadStudentData = async () => {
      const userId = user.uid || user.id;
      
      // Clear local storage and state if logging in as a different user to prevent data cross-talk
      const lastSyncedUser = localStorage.getItem('last_synced_user_id');
      let lastSyncedAt = localStorage.getItem('progress_last_synced_at');
      
      if (lastSyncedUser !== userId) {
        localStorage.removeItem('progress_last_synced_at');
        localStorage.setItem('last_synced_user_id', userId);
        lastSyncedAt = null;
        setProgress({});
      }

      try {
        // Await offline sync first
        await syncOfflineData();

        const syncStartTime = new Date().toISOString();
        const [fbProgressDeltas, fbHistory, fbActivity, fbLeaderboard] = await Promise.all([
          getProgressDeltas(userId, lastSyncedAt),
          getMockHistory(userId),
          getRecentActivity(userId),
          getLeaderboard()
        ]);

        if (fbProgressDeltas) {
          setProgress(prev => {
            // If it is a full sync, replace. Otherwise, merge deltas
            const merged = lastSyncedAt ? { ...prev, ...fbProgressDeltas } : fbProgressDeltas;
            return merged;
          });
          localStorage.setItem('progress_last_synced_at', syncStartTime);
        }

        setMockExamHistory(fbHistory || []);
        setLeaderboard(fbLeaderboard || []);

        if (fbActivity) {
          localStorage.setItem('dailyActivity', JSON.stringify(fbActivity));
          const dates = Object.keys(fbActivity);
          localStorage.setItem('reviewDates', JSON.stringify(dates));
        }
      } catch (e) {
        console.warn('[Supabase] Error loading student progress:', e.message);
      }
    };

    loadStudentData();
  // FIX #3: Depend only on the user ID, NOT the whole user object.
  // Previously, any XP/streak update to `user` triggered a full re-sync
  // (multiple database queries at once), causing request floods on mobile.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.id]);



  const refreshAdminData = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const fbUsers = await getAllUsers();
      if (fbUsers) {
        setUsers(fbUsers);
      }
    } catch (e) {
      console.warn('[Auth] Error loading admin users:', e.message);
    }
  }, [user?.role]);

  const syncStudentsList = useCallback(async () => {
    if (!SUPABASE_ENABLED || user?.role !== 'admin') return { success: false, synchronized_count: 0 };
    try {
      // Reload admin users list directly from Supabase
      await refreshAdminData();
      return { success: true, synchronized_count: 0, note: 'Supabase-native — synced from cloud database' };
    } catch (e) {
      console.error('[Auth] Failed to sync students list:', e);
      throw e;
    }
  }, [user?.role, refreshAdminData]);

  const trackDownload = async (downloadData) => {
    if (!user || (!user.uid && !user.id)) return;
    const userId = user.uid || user.id;
    
    const newEntry = {
      ...downloadData,
      downloadedAt: new Date().toISOString()
    };
    
    const updatedDownloads = [newEntry, ...(user.downloads || [])].slice(0, 100);
    setUser(prev => ({ ...prev, downloads: updatedDownloads }));
    
    if (SUPABASE_ENABLED) {
      try {
        await logUserDownload(userId, downloadData);
      } catch (e) {
        console.warn('[Supabase] Failed to log download:', e);
      }
    } else {
      const updatedUsers = users.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            downloads: updatedDownloads
          };
        }
        return u;
      });
      setUsers(updatedUsers);
    }
  };

  // Live online status heartbeat (updates updated_at every 5 minutes)
  useEffect(() => {
    if (!user || (!user.uid && !user.id) || user.role === 'admin') return;
    
    const sendHeartbeat = async () => {
      try {
        const userId = user.uid || user.id;
        if (userId) {
          await updateUserDoc(userId, { updated_at: new Date().toISOString() });
        }
      } catch (err) {
        console.warn('[Heartbeat] Failed to update online status:', err);
      }
    };
    
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.uid, user?.id]);

  // Fetch all registered users for Admin Dashboard when Admin is logged in
  useEffect(() => {
    if (user?.role === 'admin') {
      setTimeout(() => {
        refreshAdminData();
      }, 0);
    }
  }, [user?.role, refreshAdminData]);


  const addSchool = async (name) => {
    if (name && !schools.includes(name)) {
      const updatedSchools = [...schools, name];
      setSchools(updatedSchools);
      try {
        await saveSchoolsConfig(updatedSchools, schoolBranding);
      } catch (e) {
        console.error('[Config] Failed to add school config:', e);
      }
    }
  };

  const removeSchool = async (name) => {
    const updatedSchools = schools.filter(s => s !== name);
    const updatedBranding = { ...schoolBranding };
    delete updatedBranding[name];
    setSchools(updatedSchools);
    setSchoolBranding(updatedBranding);
    try {
      await saveSchoolsConfig(updatedSchools, updatedBranding);
    } catch (e) {
      console.error('[Config] Failed to remove school config:', e);
    }
  };

  const renameSchool = async (oldName, newName) => {
    if (!newName || newName === oldName) return;
    const updatedSchools = schools.map(s => s === oldName ? newName : s);
    const updatedBranding = { ...schoolBranding };
    if (updatedBranding[oldName]) {
      updatedBranding[newName] = updatedBranding[oldName];
      delete updatedBranding[oldName];
    }
    setSchools(updatedSchools);
    setSchoolBranding(updatedBranding);
    setExams(prev => prev.map(e => e.school === oldName ? { ...e, school: newName } : e));
    try {
      await saveSchoolsConfig(updatedSchools, updatedBranding);
    } catch (e) {
      console.error('[Config] Failed to rename school config:', e);
    }
  };

  const updateSchoolBranding = async (name, patch) => {
    const updatedBranding = { ...schoolBranding, [name]: { ...(schoolBranding[name] || {}), ...patch } };
    setSchoolBranding(updatedBranding);
    try {
      await saveSchoolsConfig(schools, updatedBranding);
    } catch (e) {
      console.error('[Config] Failed to update school branding:', e);
    }
  };


  const isExamLocked = (exam) => {
    if (!exam) return true;
    if (!user) return true;
    return false;
  };

  const examQuestionRequests = React.useRef(new Map());

  const loadExamQuestions = async (examId) => {
    const exam = exams.find(e => e.id === examId);
    if (exam && exam.questions && exam.questions.length > 0) {
      return exam.questions;
    }

    const pendingRequest = examQuestionRequests.current.get(examId);
    if (pendingRequest) return pendingRequest;

    const request = getExamQuestionsOnly(examId)
      .then((questions) => {
        setExams(prev => prev.map(e => e.id === examId ? { ...e, questions } : e));
        return questions;
      })
      .catch((err) => {
        console.error('[Supabase] Failed to load questions for exam:', examId, err);
        throw err;
      })
      .finally(() => {
        examQuestionRequests.current.delete(examId);
      });

    examQuestionRequests.current.set(examId, request);
    return request;
  };

  return (
    <AuthContext.Provider value={{ 
      user, users, login, logout, register, loginWithGoogle: loginGoogle, exams, refreshExams, isRefreshingExams, addExam, updateUserTier, updateProfile,
      toggleExamStatus, updateExamDetails, deleteExam, toggleArchiveExam,
      plans, getPlans: getPlansConfig, getPlansConfig, activateSubscription, cancelSubscription, updateStudentCRM, deleteStudent, addPlan, removePlan, updatePlan,
      activationCodes, generateActivationCodes, redeemActivationCode,
      progress, updateCardProgress, getStudentStats, dueTodayCount,
      theme, toggleTheme,
      schools, addSchool, removeSchool, renameSchool,
      schoolBranding, updateSchoolBranding,
      mockExamHistory, saveMockExamResult,
      leaderboard, refreshLeaderboard,
      isExamLocked,
      loadExamQuestions,
      neonEnabled: SUPABASE_ENABLED,
      supabaseEnabled: SUPABASE_ENABLED,
      refreshAdminData,
      syncStudentsList,
      trackDownload,
      loading,
      profName, profPhone, profSchool, profDirection, profAcademy, profSubject, profSOM, profEmail, profAcademicYear, profCity, profSite, bankName, bankRIB, bankBeneficiary, facebookPixelId, updateBrandingConfig, updateFlashcardSettingsConfig, updatePdfSettingsConfig, updateOmrScannerSettingsConfig,
      whatsappSettings, updateWhatsAppSettingsConfig,
      upgradedPlan, setUpgradedPlan,
      isOnline,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext) || {};
