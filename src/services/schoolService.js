// src/services/schoolService.js
// Service for schools list, branding, and all app configuration with SWR caching.
// Fully integrated with Supabase and resilient Local Companion fallback.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';
import { queryCache } from './queryCache';

const DEFAULT_SCHOOLS = [
  '2bac_sm',
  '2bac_pc_svt',
  '1bac_sci',
  'common_core_sci',
  '2bac_arts',
  '1bac_arts',
  'common_core_arts'
];

/**
 * Generic helper to fetch config from Supabase or Local Companion
 */
async function fetchConfig(key, defaultVal) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (!error && data?.value !== undefined && data?.value !== null) {
        return data.value;
      }
    } catch (err) {
      console.warn(`[Supabase] Failed to fetch config '${key}':`, err.message || err);
    }
  }

  try {
    const config = await localDb.get('/config');
    if (config && config[key] !== undefined) {
      return config[key];
    }
  } catch (err) {}

  return defaultVal;
}

/**
 * Generic helper to save config to Supabase and Local Companion
 */
async function saveConfig(key, value) {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) {
        console.error(`[Supabase] saveConfig error '${key}':`, error);
      }
    } catch (err) {
      console.warn(`[Supabase] Network exception saving config '${key}':`, err.message || err);
    }
  }

  try {
    await localDb.post('/config', { [key]: value });
  } catch (err) {
    console.error(`[schoolService] saveConfig('${key}') MySQL save failed:`, err);
    if (err?.status === 401 || err?.status === 403) {
      throw new Error('Session expirée — veuillez vous reconnecter pour enregistrer les paramètres dans la base de données.');
    }
    throw err;
  }
}

// ─── 1. Schools & School Branding ─────────────────────────────────────────────

export const getSchoolsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_schools', async () => {
    const val = await fetchConfig('schools', null);
    if (val) {
      if (Array.isArray(val)) {
        const brandingVal = await fetchConfig('schoolBranding', {});
        return {
          schools: val,
          branding: (brandingVal && typeof brandingVal === 'object') ? brandingVal : {},
        };
      }
      return {
        schools: Array.isArray(val.schools) ? val.schools : DEFAULT_SCHOOLS,
        branding: val.branding || {},
      };
    }
    return { schools: DEFAULT_SCHOOLS, branding: {} };
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveSchoolsConfig = async (schools, branding) => {
  queryCache.invalidate('config_schools');
  await saveConfig('schools', { schools, branding });
  if (branding) {
    await saveConfig('schoolBranding', branding);
  }
};

// ─── 2. General Branding Config ───────────────────────────────────────────────

export const getBrandingConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_branding', async () => {
    return fetchConfig('branding', {});
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveBrandingConfig = async (brandingData) => {
  queryCache.invalidate('config_branding');
  await saveConfig('branding', brandingData);
};

// ─── 3. Flashcard Settings ───────────────────────────────────────────────────

export const getFlashcardSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_flashcard_settings', async () => {
    return fetchConfig('flashcard_settings', {});
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveFlashcardSettingsConfig = async (settings) => {
  queryCache.invalidate('config_flashcard_settings');
  await saveConfig('flashcard_settings', settings);
};

// ─── 4. PDF Settings ─────────────────────────────────────────────────────────

export const getPdfSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_pdf_settings', async () => {
    return fetchConfig('pdf_settings', {});
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const savePdfSettingsConfig = async (settings) => {
  queryCache.invalidate('config_pdf_settings');
  await saveConfig('pdf_settings', settings);
};

// ─── 5. OMR Scanner Settings ─────────────────────────────────────────────────

export const getOmrScannerSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_omr_scanner_settings', async () => {
    return fetchConfig('omr_scanner_settings', {});
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveOmrScannerSettingsConfig = async (settings) => {
  queryCache.invalidate('config_omr_scanner_settings');
  await saveConfig('omr_scanner_settings', settings);
};

// ─── 6. WhatsApp Settings ────────────────────────────────────────────────────

export const getWhatsAppSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_whatsapp_settings', async () => {
    return fetchConfig('whatsapp_settings', {});
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveWhatsAppSettingsConfig = async (settings) => {
  queryCache.invalidate('config_whatsapp_settings');
  await saveConfig('whatsapp_settings', settings);
};

// ─── 7. Subscription Plans ───────────────────────────────────────────────────

export const getPlansConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_plans', async () => {
    const val = await fetchConfig('plans', null);
    if (val) {
      if (Array.isArray(val.plans)) return val.plans;
      if (Array.isArray(val)) return val;
    }
    return [
      { id: 'free', name: 'Gratuit', price: 0, durationDays: 365, features: ['Accès limité'] },
      { id: 'pro', name: 'Pass Concours Pro', price: 299, durationDays: 365, features: ['Accès illimité'] }
    ];
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const getPlans = getPlansConfig;

export const savePlansConfig = async (plans) => {
  queryCache.invalidate('config_plans');
  await saveConfig('plans', plans);
};

export const savePlans = savePlansConfig;

// ─── 8. Exam Themes ──────────────────────────────────────────────────────────

export const getExamThemesConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_exam_themes', async () => {
    return fetchConfig('exam_themes', {});
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveExamThemesConfig = async (themes) => {
  queryCache.invalidate('config_exam_themes');
  await saveConfig('exam_themes', themes);
};

// ─── 9. Exam Settings ────────────────────────────────────────────────────────

export const getExamSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_exam_settings', async () => {
    return fetchConfig('exam_settings', {});
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveExamSettingsConfig = async (settings) => {
  queryCache.invalidate('config_exam_settings');
  await saveConfig('exam_settings', settings);
};

// ─── 10. Security Settings ───────────────────────────────────────────────────

export const getSecuritySettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_security_settings', async () => {
    return fetchConfig('security_settings', {});
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveSecuritySettingsConfig = async (settings) => {
  queryCache.invalidate('config_security_settings');
  await saveConfig('security_settings', settings);
};

// ─── 11. Schedule / Timetable Config ──────────────────────────────────────────

export const getScheduleConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_schedule', async () => {
    return fetchConfig('schedule', {});
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveScheduleConfig = async (scheduleData) => {
  queryCache.invalidate('config_schedule');
  await saveConfig('schedule', scheduleData);
};

// ─── 12. Landing AR Settings ─────────────────────────────────────────────────

export const getLandingArConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_landing_ar', async () => {
    return fetchConfig('landing_ar_settings', null);
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveLandingArConfig = async (landingConfig) => {
  queryCache.invalidate('config_landing_ar');
  await saveConfig('landing_ar_settings', landingConfig);
};

// ─── 13. AI Settings ─────────────────────────────────────────────────────────

export const getAiSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_ai_settings', async () => {
    return fetchConfig('ai_settings', null);
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveAiSettingsConfig = async (settings) => {
  queryCache.invalidate('config_ai_settings');
  await saveConfig('ai_settings', settings);
};

// ─── 14. School Holidays ─────────────────────────────────────────────────────

export const getOfficialMoroccanHolidays = (academicYear = '2026-2027') => {
  const startYear = parseInt(String(academicYear).split(/[-/]/)[0], 10) || 2026;
  const nextYear = startYear + 1;

  return [
    {
      id: `hol-mowlid-${startYear}`,
      label: 'Aïd Al Mawlid Annabaoui',
      startDate: `${startYear}-09-15`,
      endDate: `${startYear}-09-16`
    },
    {
      id: `hol-bainiya-1-${startYear}`,
      label: '1ères vacances inter-trimestrielles',
      startDate: `${startYear}-10-20`,
      endDate: `${startYear}-10-27`
    },
    {
      id: `hol-marche-verte-${startYear}`,
      label: 'Anniversaire de la Marche Verte',
      startDate: `${startYear}-11-06`,
      endDate: `${startYear}-11-06`
    },
    {
      id: `hol-independance-${startYear}`,
      label: 'Fête de l\'Indépendance',
      startDate: `${startYear}-11-18`,
      endDate: `${startYear}-11-18`
    },
    {
      id: `hol-bainiya-2-${startYear}`,
      label: '2èmes vacances inter-trimestrielles',
      startDate: `${startYear}-12-08`,
      endDate: `${startYear}-12-15`
    },
    {
      id: `hol-nouvel-an-${nextYear}`,
      label: 'Jour de l\'an',
      startDate: `${nextYear}-01-01`,
      endDate: `${nextYear}-01-01`
    },
    {
      id: `hol-manifeste-${nextYear}`,
      label: 'Manifeste de l\'Indépendance',
      startDate: `${nextYear}-01-11`,
      endDate: `${nextYear}-01-11`
    },
    {
      id: `hol-yennayer-${nextYear}`,
      label: 'Nouvel An Amazigh (Yennayer)',
      startDate: `${nextYear}-01-14`,
      endDate: `${nextYear}-01-14`
    },
    {
      id: `hol-mi-semestre-${nextYear}`,
      label: 'Vacances de mi-année scolaire',
      startDate: `${nextYear}-01-26`,
      endDate: `${nextYear}-02-02`
    },
    {
      id: `hol-bainiya-3-${nextYear}`,
      label: '3èmes vacances inter-trimestrielles',
      startDate: `${nextYear}-03-16`,
      endDate: `${nextYear}-03-23`
    },
    {
      id: `hol-aid-fitr-${nextYear}`,
      label: 'Vacances de l\'Aïd Al Fitr',
      startDate: `${nextYear}-03-30`,
      endDate: `${nextYear}-04-02`
    },
    {
      id: `hol-travail-${nextYear}`,
      label: 'Fête du Travail',
      startDate: `${nextYear}-05-01`,
      endDate: `${nextYear}-05-01`
    },
    {
      id: `hol-bainiya-4-${nextYear}`,
      label: '4èmes vacances inter-trimestrielles',
      startDate: `${nextYear}-05-04`,
      endDate: `${nextYear}-05-11`
    },
    {
      id: `hol-aid-adha-${nextYear}`,
      label: 'Vacances de l\'Aïd Al Adha',
      startDate: `${nextYear}-06-06`,
      endDate: `${nextYear}-06-10`
    },
    {
      id: `hol-1er-moharram-${nextYear}`,
      label: '1er Moharram — Nouvel An Hégirien',
      startDate: `${nextYear}-06-26`,
      endDate: `${nextYear}-06-26`
    }
  ];
};

export const getSchoolHolidaysConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_school_holidays', async () => {
    const val = await fetchConfig('school_holidays', null);
    if (Array.isArray(val) && val.length > 0) {
      try { localStorage.setItem('school_holidays', JSON.stringify(val)); } catch (_) {}
      return val;
    }

    try {
      const raw = localStorage.getItem('school_holidays');
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveSchoolHolidaysConfig = async (holidays) => {
  try { localStorage.setItem('school_holidays', JSON.stringify(holidays)); } catch (_) {}
  try {
    await queryCache.set('config_school_holidays', holidays);
  } catch (_) {
    queryCache.invalidate('config_school_holidays');
  }
  await saveConfig('school_holidays', holidays);
  return { success: true };
};

// ─── 15. Teacher Absences / Leaves ───────────────────────────────────────────

export const getTeacherAbsencesConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_teacher_absences', async () => {
    const val = await fetchConfig('teacher_absences', null);
    if (Array.isArray(val) && val.length > 0) {
      try { localStorage.setItem('teacher_absences', JSON.stringify(val)); } catch (_) {}
      return val;
    }

    try {
      const raw = localStorage.getItem('teacher_absences');
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveTeacherAbsencesConfig = async (absences) => {
  try { localStorage.setItem('teacher_absences', JSON.stringify(absences)); } catch (_) {}
  try {
    await queryCache.set('config_teacher_absences', absences);
  } catch (_) {
    queryCache.invalidate('config_teacher_absences');
  }
  await saveConfig('teacher_absences', absences);
  return { success: true };
};

// ─── 16. Teacher Schedule / Timetable ────────────────────────────────────────

export const getTeacherScheduleConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  let localSchedule = null;
  let localUpdatedAt = 0;
  try {
    const raw = localStorage.getItem('teacher_schedule_current');
    if (raw) localSchedule = JSON.parse(raw);
    localUpdatedAt = parseInt(localStorage.getItem('teacher_schedule_updated_at') || '0', 10);
  } catch (_) {}

  return queryCache.fetchWithCache('config_teacher_schedule', async () => {
    const isRecentlyUpdatedLocally = localSchedule && (Date.now() - localUpdatedAt < 1000 * 30);
    if (isRecentlyUpdatedLocally && !forceRefresh) {
      return localSchedule;
    }

    const val = await fetchConfig('teacher_schedule_current', null);
    if (val && typeof val === 'object' && Object.keys(val).length > 0) {
      try { localStorage.setItem('teacher_schedule_current', JSON.stringify(val)); } catch (_) {}
      return val;
    }

    return localSchedule || {};
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 30
  });
};

export const saveTeacherScheduleConfig = async (schedule) => {
  const now = Date.now();
  try {
    localStorage.setItem('teacher_schedule_current', JSON.stringify(schedule));
    localStorage.setItem('teacher_schedule_updated_at', String(now));
  } catch (_) {}

  try {
    await queryCache.set('config_teacher_schedule', schedule);
  } catch (_) {
    queryCache.invalidate('config_teacher_schedule');
  }

  await saveConfig('teacher_schedule_current', schedule);
  return { success: true };
};

// ─── 17. Logbook Styling ─────────────────────────────────────────────────────

export const getLogbookStyleConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_logbook_style', async () => {
    const val = await fetchConfig('logbook_style_settings', null);
    if (val && typeof val === 'object') {
      return val;
    }

    try {
      return {
        arFont: localStorage.getItem('logbook_ar_font') || 'UKIJ Merdane',
        frFont: localStorage.getItem('logbook_fr_font') || 'Outfit',
        fontSize: localStorage.getItem('logbook_font_size') || '0.8rem',
        lineHeight: parseInt(localStorage.getItem('logbook_line_height') || '20', 10),
        colorInk: localStorage.getItem('logbook_color_ink') || '#334155',
        colorChapter: localStorage.getItem('logbook_color_chapter') || '#0f172a',
        colorAxis: localStorage.getItem('logbook_color_axis') || '#2563eb',
        colorExercise: localStorage.getItem('logbook_color_exercise') || '#d97706',
      };
    } catch (_) {
      return null;
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveLogbookStyleConfig = async (settings) => {
  try {
    if (settings.arFont) localStorage.setItem('logbook_ar_font', settings.arFont);
    if (settings.frFont) localStorage.setItem('logbook_fr_font', settings.frFont);
    if (settings.fontSize) localStorage.setItem('logbook_font_size', settings.fontSize);
    if (settings.lineHeight) localStorage.setItem('logbook_line_height', String(settings.lineHeight));
    if (settings.colorInk) localStorage.setItem('logbook_color_ink', settings.colorInk);
    if (settings.colorChapter) localStorage.setItem('logbook_color_chapter', settings.colorChapter);
    if (settings.colorAxis) localStorage.setItem('logbook_color_axis', settings.colorAxis);
    if (settings.colorExercise) localStorage.setItem('logbook_color_exercise', settings.colorExercise);
  } catch (_) {}

  try {
    await queryCache.set('config_logbook_style', settings);
  } catch (_) {
    queryCache.invalidate('config_logbook_style');
  }

  await saveConfig('logbook_style_settings', settings);
  return { success: true };
};

// ─── 18. Classes Settings ────────────────────────────────────────────────────

export const getClassesSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_classes_settings', async () => {
    const val = await fetchConfig('classes_settings', null);
    if (val && typeof val === 'object') return val;

    try {
      const raw = localStorage.getItem('classes_settings');
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 15,
    cacheTime: 1000 * 60 * 60
  });
};

export const saveClassesSettingsConfig = async (settings) => {
  queryCache.invalidate('config_classes_settings');
  try { localStorage.setItem('classes_settings', JSON.stringify(settings)); } catch (_) {}
  await saveConfig('classes_settings', settings);
};

// ─── 19. Master Synchronization ──────────────────────────────────────────────

export const syncAllConfigsAndSchedule = async () => {
  const syncResults = {
    scheduleSlots: 0,
    holidaysCount: 0,
    syncedKeys: [],
    errors: []
  };

  try {
    const [cloudSched, cloudHols, cloudStyle, cloudAi, cloudBranding, cloudPdf, cloudFlash, cloudWa] = await Promise.allSettled([
      getTeacherScheduleConfig({ forceRefresh: true }),
      getSchoolHolidaysConfig({ forceRefresh: true }),
      getLogbookStyleConfig({ forceRefresh: true }),
      getAiSettingsConfig({ forceRefresh: true }),
      getBrandingConfig({ forceRefresh: true }),
      getPdfSettingsConfig({ forceRefresh: true }),
      getFlashcardSettingsConfig({ forceRefresh: true }),
      getWhatsAppSettingsConfig({ forceRefresh: true })
    ]);

    if (cloudSched.status === 'fulfilled' && cloudSched.value) {
      await saveTeacherScheduleConfig(cloudSched.value);
      syncResults.scheduleSlots = Object.keys(cloudSched.value).length;
      syncResults.syncedKeys.push('teacher_schedule_current');
    }

    if (cloudHols.status === 'fulfilled' && Array.isArray(cloudHols.value)) {
      await saveSchoolHolidaysConfig(cloudHols.value);
      syncResults.holidaysCount = cloudHols.value.length;
      syncResults.syncedKeys.push('school_holidays');
    }

    if (cloudStyle.status === 'fulfilled' && cloudStyle.value) {
      await saveLogbookStyleConfig(cloudStyle.value);
      syncResults.syncedKeys.push('logbook_style_settings');
    }

    if (cloudAi.status === 'fulfilled' && cloudAi.value) {
      await saveAiSettingsConfig(cloudAi.value);
      syncResults.syncedKeys.push('ai_settings');
    }

    if (cloudBranding.status === 'fulfilled' && cloudBranding.value) {
      await saveBrandingConfig(cloudBranding.value);
      syncResults.syncedKeys.push('branding');
    }

    if (cloudPdf.status === 'fulfilled' && cloudPdf.value) {
      await savePdfSettingsConfig(cloudPdf.value);
      syncResults.syncedKeys.push('pdf_settings');
    }

    if (cloudFlash.status === 'fulfilled' && cloudFlash.value) {
      await saveFlashcardSettingsConfig(cloudFlash.value);
      syncResults.syncedKeys.push('flashcard_settings');
    }

    if (cloudWa.status === 'fulfilled' && cloudWa.value) {
      await saveWhatsAppSettingsConfig(cloudWa.value);
      syncResults.syncedKeys.push('whatsapp_settings');
    }

    return { success: true, ...syncResults };
  } catch (err) {
    console.error('[syncAllConfigsAndSchedule] Error:', err);
    return { success: false, error: err.message, ...syncResults };
  }
};
