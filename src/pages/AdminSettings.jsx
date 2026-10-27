import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Settings, School, KeyRound, Eye, EyeOff, CheckCircle2, Sparkles, RefreshCw, Layers, MousePointerClick, Crown, Download, Sliders, FileText, Camera, MessageCircle, Volume2, BookOpen, Calendar, Palmtree, Pencil, Upload, ExternalLink, ShieldCheck, Cpu, Zap, Globe, Loader2 } from 'lucide-react';
import { getAllClasses } from '../services/classService';
import { 
  getAiSettingsConfig, 
  saveAiSettingsConfig,
  getBrandingConfig,
  getFlashcardSettingsConfig,
  getPdfSettingsConfig,
  getOmrScannerSettingsConfig,
  getWhatsAppSettingsConfig,
  getSchoolHolidaysConfig, 
  saveSchoolHolidaysConfig, 
  getTeacherScheduleConfig, 
  saveTeacherScheduleConfig, 
  getLogbookStyleConfig, 
  saveLogbookStyleConfig,
  getOfficialMoroccanHolidays,
  syncAllConfigsAndSchedule
} from '../services/schoolService';
import { decodeHtmlEntities } from '../utils/security';
import SectionErrorBoundary from '../components/SectionErrorBoundary';

const getSoftColorForClass = (className) => {
  if (!className) return { bg: 'transparent', text: 'var(--text-main)' };
  const colors = [
    { bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5' },
    { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981' },
    { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706' },
    { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444' },
    { bg: 'rgba(6, 182, 212, 0.12)', text: '#0891b2' },
    { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777' },
    { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed' },
    { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c' }
  ];
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export default function AdminSettings() {
  const { 
    profName: initialProfName,
    profPhone: initialProfPhone,
    profSchool: initialProfSchool,
    profDirection: initialProfDirection,
    profAcademy: initialProfAcademy,
    profSubject: initialProfSubject,
    profSOM: initialProfSOM,
    profEmail: initialProfEmail,
    profAcademicYear: initialProfAcademicYear,
    profCity: initialProfCity,
    profSite: initialProfSite,
    bankName: initialBankName,
    bankRIB: initialBankRIB,
    bankBeneficiary: initialBankBeneficiary,
    facebookPixelId: initialFacebookPixelId,
    updateBrandingConfig,
    updateFlashcardSettingsConfig,
    updatePdfSettingsConfig,
    updateOmrScannerSettingsConfig,
    whatsappSettings,
    updateWhatsAppSettingsConfig
  } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [profileSubTab, setProfileSubTab] = useState('contact');
  const [classes, setClasses] = useState([]);

  // Tab active indicator animation
  const tabBarRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, top: 0, height: 0, opacity: 0 });

  useEffect(() => {
    if (!tabBarRef.current) return;
    const timeoutId = setTimeout(() => {
      const activeBtn = tabBarRef.current.querySelector('.modern-tab-btn.active');
      if (activeBtn) {
        setIndicatorStyle({
          left: activeBtn.offsetLeft,
          width: activeBtn.offsetWidth,
          top: activeBtn.offsetTop,
          height: activeBtn.offsetHeight,
          opacity: 1
        });
      }
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [activeTab]);

  useEffect(() => {
    getAllClasses().then(data => setClasses(data || []));
  }, []);

  // Voucher states (removed)
  // Subscription plan states (removed)

  // Claude API Key
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('claudeApiKey') || '');
  const [showKey, setShowKey] = useState(false);
  const [proxyUrl, setProxyUrl] = useState(() => localStorage.getItem('claudeProxyUrl') || '');
  const [keySaved, setKeySaved] = useState(false);
  const [claudeSolveSolutions, setClaudeSolveSolutions] = useState(() => localStorage.getItem('claude_solve_solutions') !== 'false');

  // Gemini API Key
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const [geminiSolveSolutions, setGeminiSolveSolutions] = useState(() => localStorage.getItem('gemini_solve_solutions') !== 'false');

  // DeepSeek API Key
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem('deepseekApiKey') || 'sk-12a7032f07d740348c607ef947a0a9f7');
  const [deepseekUrl, setDeepseekUrl] = useState(() => localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com');
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [deepseekKeySaved, setDeepseekKeySaved] = useState(false);
  const [deepseekSolveSolutions, setDeepseekSolveSolutions] = useState(() => localStorage.getItem('deepseek_solve_solutions') !== 'false');

  // Groq API Key
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('groqApiKey') || '');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqKeySaved, setGroqKeySaved] = useState(false);

  // OpenAI API Key
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openaiApiKey') || '');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [openaiKeySaved, setOpenaiKeySaved] = useState(false);

  // Charger les paramètres IA distants depuis Supabase Cloud DB (config table) au montage
  useEffect(() => {
    getAiSettingsConfig({ forceRefresh: true }).then(remoteSettings => {
      if (remoteSettings && typeof remoteSettings === 'object') {
        if (remoteSettings.claudeApiKey !== undefined) {
          setApiKey(remoteSettings.claudeApiKey);
          localStorage.setItem('claudeApiKey', remoteSettings.claudeApiKey);
        }
        if (remoteSettings.claudeProxyUrl !== undefined) {
          setProxyUrl(remoteSettings.claudeProxyUrl);
          localStorage.setItem('claudeProxyUrl', remoteSettings.claudeProxyUrl);
        }
        if (remoteSettings.claude_solve_solutions !== undefined) {
          setClaudeSolveSolutions(!!remoteSettings.claude_solve_solutions);
          localStorage.setItem('claude_solve_solutions', String(remoteSettings.claude_solve_solutions));
        }
        if (remoteSettings.geminiApiKey !== undefined) {
          setGeminiKey(remoteSettings.geminiApiKey);
          localStorage.setItem('geminiApiKey', remoteSettings.geminiApiKey);
        }
        if (remoteSettings.gemini_solve_solutions !== undefined) {
          setGeminiSolveSolutions(!!remoteSettings.gemini_solve_solutions);
          localStorage.setItem('gemini_solve_solutions', String(remoteSettings.gemini_solve_solutions));
        }
        if (remoteSettings.deepseekApiKey !== undefined) {
          setDeepseekKey(remoteSettings.deepseekApiKey);
          localStorage.setItem('deepseekApiKey', remoteSettings.deepseekApiKey);
        }
        if (remoteSettings.deepseekApiUrl !== undefined) {
          setDeepseekUrl(remoteSettings.deepseekApiUrl);
          localStorage.setItem('deepseekApiUrl', remoteSettings.deepseekApiUrl);
        }
        if (remoteSettings.deepseek_solve_solutions !== undefined) {
          setDeepseekSolveSolutions(!!remoteSettings.deepseek_solve_solutions);
          localStorage.setItem('deepseek_solve_solutions', String(remoteSettings.deepseek_solve_solutions));
        }
        if (remoteSettings.groqApiKey !== undefined) {
          setGroqKey(remoteSettings.groqApiKey);
          localStorage.setItem('groqApiKey', remoteSettings.groqApiKey);
        }
        if (remoteSettings.openaiApiKey !== undefined) {
          setOpenaiKey(remoteSettings.openaiApiKey);
          localStorage.setItem('openaiApiKey', remoteSettings.openaiApiKey);
        }
      }
    }).catch(err => console.warn('[AdminSettings] Error fetching remote AI config:', err));
  }, []);

  const syncAiSettingsToDb = async (overrides = {}) => {
    const payload = {
      claudeApiKey: overrides.claudeApiKey !== undefined ? overrides.claudeApiKey : apiKey.trim(),
      claudeProxyUrl: overrides.claudeProxyUrl !== undefined ? overrides.claudeProxyUrl : proxyUrl.trim(),
      claude_solve_solutions: overrides.claude_solve_solutions !== undefined ? overrides.claude_solve_solutions : claudeSolveSolutions,
      geminiApiKey: overrides.geminiApiKey !== undefined ? overrides.geminiApiKey : geminiKey.trim(),
      gemini_solve_solutions: overrides.gemini_solve_solutions !== undefined ? overrides.gemini_solve_solutions : geminiSolveSolutions,
      deepseekApiKey: overrides.deepseekApiKey !== undefined ? overrides.deepseekApiKey : deepseekKey.trim(),
      deepseekApiUrl: overrides.deepseekApiUrl !== undefined ? overrides.deepseekApiUrl : (deepseekUrl.trim() || 'https://api.deepseek.com'),
      deepseek_solve_solutions: overrides.deepseek_solve_solutions !== undefined ? overrides.deepseek_solve_solutions : deepseekSolveSolutions,
      groqApiKey: overrides.groqApiKey !== undefined ? overrides.groqApiKey : groqKey.trim(),
      openaiApiKey: overrides.openaiApiKey !== undefined ? overrides.openaiApiKey : openaiKey.trim(),
    };
    try {
      await saveAiSettingsConfig(payload);
    } catch (err) {
      console.warn('[AdminSettings] Failed to persist AI settings to DB:', err);
    }
  };

  const handleToggleClaudeSolve = (val) => {
    setClaudeSolveSolutions(val);
    localStorage.setItem('claude_solve_solutions', String(val));
    syncAiSettingsToDb({ claude_solve_solutions: val });
  };

  const handleToggleGeminiSolve = (val) => {
    setGeminiSolveSolutions(val);
    localStorage.setItem('gemini_solve_solutions', String(val));
    syncAiSettingsToDb({ gemini_solve_solutions: val });
  };

  const handleToggleDeepseekSolve = (val) => {
    setDeepseekSolveSolutions(val);
    localStorage.setItem('deepseek_solve_solutions', String(val));
    syncAiSettingsToDb({ deepseek_solve_solutions: val });
  };

  const saveApiKey = () => {
    const trimmedKey = apiKey.trim();
    const trimmedProxy = proxyUrl.trim();
    localStorage.setItem('claudeApiKey', trimmedKey);
    localStorage.setItem('claudeProxyUrl', trimmedProxy);
    localStorage.setItem('claude_solve_solutions', String(claudeSolveSolutions));
    syncAiSettingsToDb({ claudeApiKey: trimmedKey, claudeProxyUrl: trimmedProxy });
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  };

  const saveGeminiKey = () => {
    const trimmedKey = geminiKey.trim();
    localStorage.setItem('geminiApiKey', trimmedKey);
    localStorage.setItem('gemini_solve_solutions', String(geminiSolveSolutions));
    syncAiSettingsToDb({ geminiApiKey: trimmedKey });
    setGeminiKeySaved(true);
    setTimeout(() => setGeminiKeySaved(false), 2500);
  };

  const saveDeepseekKey = () => {
    const trimmedKey = deepseekKey.trim();
    const trimmedUrl = deepseekUrl.trim() || 'https://api.deepseek.com';
    localStorage.setItem('deepseekApiKey', trimmedKey);
    localStorage.setItem('deepseekApiUrl', trimmedUrl);
    localStorage.setItem('deepseek_solve_solutions', String(deepseekSolveSolutions));
    syncAiSettingsToDb({ deepseekApiKey: trimmedKey, deepseekApiUrl: trimmedUrl });
    setDeepseekKeySaved(true);
    setTimeout(() => setDeepseekKeySaved(false), 2500);
  };

  const saveGroqKey = () => {
    const trimmedKey = groqKey.trim();
    localStorage.setItem('groqApiKey', trimmedKey);
    syncAiSettingsToDb({ groqApiKey: trimmedKey });
    setGroqKeySaved(true);
    setTimeout(() => setGroqKeySaved(false), 2500);
  };

  const saveOpenaiKey = () => {
    const trimmedKey = openaiKey.trim();
    localStorage.setItem('openaiApiKey', trimmedKey);
    syncAiSettingsToDb({ openaiApiKey: trimmedKey });
    setOpenaiKeySaved(true);
    setTimeout(() => setOpenaiKeySaved(false), 2500);
  };

  // ── Database Backup & Restore ──────────────────────────────────────────────
  const handleExportBackup = () => {
    const backupData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        backupData[key] = localStorage.getItem(key);
      }
    }
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LCONQ_Platform_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (typeof importedData !== 'object') throw new Error('Format de sauvegarde invalide');
        let count = 0;
        Object.entries(importedData).forEach(([key, val]) => {
          if (typeof val === 'string') {
            localStorage.setItem(key, val);
            count++;
          }
        });
        alert(`✅ Sauvegarde restaurée avec succès ! ${count} éléments récupérés. La page va se recharger.`);
        window.location.reload();
      } catch (err) {
        alert('❌ Erreur lors de la lecture du fichier de sauvegarde : ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // ── Card Display Settings ──────────────────────────────────────────────────
  const [cardFlip,   setCardFlip]   = useState(() => localStorage.getItem('card_flip_animation') !== 'false');
  const [cardReveal, setCardReveal] = useState(() => localStorage.getItem('card_reveal_mode') || 'flip');
  const [cardSwipe,  setCardSwipe]  = useState(() => localStorage.getItem('card_swipe_gesture') !== 'false');
  const [cardSound,  setCardSound]  = useState(() => localStorage.getItem('card_sound_effects') !== 'false');
  const [cardFontFamily, setCardFontFamily] = useState(() => localStorage.getItem('card_font_family') || 'Computer Modern Serif');
  const [cardFontSize, setCardFontSize] = useState(() => localStorage.getItem('card_font_size') || '1rem');
  const [cardQuestionWeight, setCardQuestionWeight] = useState(() => localStorage.getItem('card_question_weight') || '400');
  const [cardAstuceWeight, setCardAstuceWeight] = useState(() => localStorage.getItem('card_astuce_weight') || '400');
  const [cardOptionsWeight, setCardOptionsWeight] = useState(() => localStorage.getItem('card_options_weight') || '400');
  const [cardSaved,  setCardSaved]  = useState(false);

  const saveCardSettings = async () => {
    await updateFlashcardSettingsConfig({
      cardRevealMode: cardReveal,
      cardFlipEnabled: cardFlip,
      cardSwipeEnabled: cardSwipe,
      cardSoundEnabled: cardSound,
      cardFontFamily,
      cardFontSize,
      cardQuestionWeight,
      cardAstuceWeight,
      cardOptionsWeight
    });
    setCardSaved(true);
    setTimeout(() => setCardSaved(false), 2500);
  };

  // Branding / Identity / Profile
  const [profName, setProfName] = useState(() => decodeHtmlEntities(initialProfName || ''));
  const [profPhone, setProfPhone] = useState(() => decodeHtmlEntities(initialProfPhone || ''));
  const [profSchool, setProfSchool] = useState(() => decodeHtmlEntities(initialProfSchool || ''));
  const [profDirection, setProfDirection] = useState(() => decodeHtmlEntities(initialProfDirection || ''));
  const [profAcademy, setProfAcademy] = useState(() => decodeHtmlEntities(initialProfAcademy || ''));
  const [profSubject, setProfSubject] = useState(() => decodeHtmlEntities(initialProfSubject || 'Mathématiques'));
  const [profSOM, setProfSOM] = useState(() => decodeHtmlEntities(initialProfSOM || ''));
  const [profEmail, setProfEmail] = useState(() => decodeHtmlEntities(initialProfEmail || ''));
  const [profAcademicYear, setProfAcademicYear] = useState(() => decodeHtmlEntities(initialProfAcademicYear || '2025/2026'));
  const [profCity, setProfCity] = useState(() => decodeHtmlEntities(initialProfCity || ''));
  const [profSite, setProfSite] = useState(() => decodeHtmlEntities(initialProfSite || 'www.lconq.ma'));
  const [bankName, setBankName] = useState(() => decodeHtmlEntities(initialBankName || 'CIH Bank (Maroc)'));
  const [bankRIB, setBankRIB] = useState(() => decodeHtmlEntities(initialBankRIB || '230 780 4567890123 0001 89'));
  const [bankBeneficiary, setBankBeneficiary] = useState(() => decodeHtmlEntities(initialBankBeneficiary || "L'CONQ SARL"));
  const [fbPixelId, setFbPixelId] = useState(() => decodeHtmlEntities(initialFacebookPixelId || ''));
  const [brandSaved, setBrandSaved] = useState(false);

  // OMR Scanner Settings
  const [scannerDirectCapture, setScannerDirectCapture] = useState(() => localStorage.getItem('scanner_direct_capture_enabled') !== 'false');
  const [scannerSaved, setScannerSaved] = useState(false);

  // WhatsApp Floating Button Settings
  const [waEnabled, setWaEnabled] = useState(true);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waPosition, setWaPosition] = useState('right');
  const [waTooltip, setWaTooltip] = useState('');
  const [waSaved, setWaSaved] = useState(false);

  // Synchronisation directe des paramètres d'apparence, branding, flashcards et PDF depuis le Cloud (Supabase)
  useEffect(() => {
    getFlashcardSettingsConfig({ forceRefresh: true }).then(cfg => {
      if (cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0) {
        if (cfg.cardRevealMode !== undefined) setCardReveal(cfg.cardRevealMode);
        if (cfg.cardFlipEnabled !== undefined) setCardFlip(!!cfg.cardFlipEnabled);
        if (cfg.cardSwipeEnabled !== undefined) setCardSwipe(!!cfg.cardSwipeEnabled);
        if (cfg.cardSoundEnabled !== undefined) setCardSound(cfg.cardSoundEnabled !== false);
        if (cfg.cardFontFamily) setCardFontFamily(cfg.cardFontFamily);
        if (cfg.cardFontSize) setCardFontSize(cfg.cardFontSize);
        if (cfg.cardQuestionWeight) setCardQuestionWeight(cfg.cardQuestionWeight);
        if (cfg.cardAstuceWeight) setCardAstuceWeight(cfg.cardAstuceWeight);
        if (cfg.cardOptionsWeight) setCardOptionsWeight(cfg.cardOptionsWeight);
      }
    }).catch(() => {});

    getBrandingConfig({ forceRefresh: true }).then(cfg => {
      if (cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0) {
        if (cfg.profName !== undefined) setProfName(decodeHtmlEntities(cfg.profName));
        if (cfg.profPhone !== undefined) setProfPhone(decodeHtmlEntities(cfg.profPhone));
        if (cfg.profSchool !== undefined) setProfSchool(decodeHtmlEntities(cfg.profSchool));
        if (cfg.profDirection !== undefined) setProfDirection(decodeHtmlEntities(cfg.profDirection));
        if (cfg.profAcademy !== undefined) setProfAcademy(decodeHtmlEntities(cfg.profAcademy));
        if (cfg.profSubject !== undefined) setProfSubject(decodeHtmlEntities(cfg.profSubject));
        if (cfg.profSOM !== undefined) setProfSOM(decodeHtmlEntities(cfg.profSOM));
        if (cfg.profEmail !== undefined) setProfEmail(decodeHtmlEntities(cfg.profEmail));
        if (cfg.profAcademicYear !== undefined) setProfAcademicYear(decodeHtmlEntities(cfg.profAcademicYear));
        if (cfg.profCity !== undefined) setProfCity(decodeHtmlEntities(cfg.profCity));
        if (cfg.profSite !== undefined) setProfSite(decodeHtmlEntities(cfg.profSite));
        if (cfg.bankName !== undefined) setBankName(decodeHtmlEntities(cfg.bankName));
        if (cfg.bankRIB !== undefined) setBankRIB(decodeHtmlEntities(cfg.bankRIB));
        if (cfg.bankBeneficiary !== undefined) setBankBeneficiary(decodeHtmlEntities(cfg.bankBeneficiary));
        if (cfg.fbPixelId !== undefined) setFbPixelId(decodeHtmlEntities(cfg.fbPixelId));
      }
    }).catch(() => {});

    getPdfSettingsConfig({ forceRefresh: true }).then(cfg => {
      if (cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0) {
        if (cfg.pdfPageMargins) setPdfPageMargins(cfg.pdfPageMargins);
        if (cfg.pdfFontSize) setPdfFontSize(cfg.pdfFontSize);
        if (cfg.pdfFontFamily) setPdfFontFamily(cfg.pdfFontFamily);
        if (cfg.pdfTemplateStyle) setPdfTemplateStyle(cfg.pdfTemplateStyle);
        if (cfg.pdfSeriesStyle) setPdfSeriesStyle(cfg.pdfSeriesStyle);
        if (cfg.pdfAvoidPageBreaks !== undefined) setPdfAvoidPageBreaks(cfg.pdfAvoidPageBreaks !== false);
        if (cfg.pdfForcePrintColors !== undefined) setPdfForcePrintColors(cfg.pdfForcePrintColors !== false);
        if (cfg.pdfShowSidebar !== undefined) setPdfShowSidebar(cfg.pdfShowSidebar !== false);
      }
    }).catch(() => {});

    getOmrScannerSettingsConfig({ forceRefresh: true }).then(cfg => {
      if (cfg && typeof cfg === 'object' && cfg.scannerDirectCapture !== undefined) {
        setScannerDirectCapture(!!cfg.scannerDirectCapture);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (whatsappSettings) {
      setWaEnabled(!!whatsappSettings.enabled);
      setWaPhone(whatsappSettings.phoneNumber || '');
      setWaMessage(whatsappSettings.message || '');
      setWaPosition(whatsappSettings.position || 'right');
      setWaTooltip(whatsappSettings.tooltipText || '');
    }
  }, [whatsappSettings]);

  const saveWhatsAppSettings = async () => {
    await updateWhatsAppSettingsConfig({
      enabled: waEnabled,
      phoneNumber: waPhone.trim(),
      message: waMessage.trim(),
      position: waPosition,
      tooltipText: waTooltip.trim()
    });
    setWaSaved(true);
    setTimeout(() => setWaSaved(false), 2500);
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      if (initialProfName !== undefined && initialProfName !== '') setProfName(decodeHtmlEntities(initialProfName));
      if (initialProfPhone !== undefined && initialProfPhone !== '') setProfPhone(decodeHtmlEntities(initialProfPhone));
      if (initialProfSchool !== undefined && initialProfSchool !== '') setProfSchool(decodeHtmlEntities(initialProfSchool));
      if (initialProfDirection !== undefined && initialProfDirection !== '') setProfDirection(decodeHtmlEntities(initialProfDirection));
      if (initialProfAcademy !== undefined && initialProfAcademy !== '') setProfAcademy(decodeHtmlEntities(initialProfAcademy));
      if (initialProfSubject !== undefined && initialProfSubject !== '') setProfSubject(decodeHtmlEntities(initialProfSubject));
      if (initialProfSOM !== undefined && initialProfSOM !== '') setProfSOM(decodeHtmlEntities(initialProfSOM));
      if (initialProfEmail !== undefined && initialProfEmail !== '') setProfEmail(decodeHtmlEntities(initialProfEmail));
      if (initialProfAcademicYear !== undefined && initialProfAcademicYear !== '') setProfAcademicYear(decodeHtmlEntities(initialProfAcademicYear));
      if (initialProfCity !== undefined && initialProfCity !== '') setProfCity(decodeHtmlEntities(initialProfCity));
      if (initialProfSite !== undefined && initialProfSite !== '') setProfSite(decodeHtmlEntities(initialProfSite));
      if (initialBankName !== undefined && initialBankName !== '') setBankName(decodeHtmlEntities(initialBankName));
      if (initialBankRIB !== undefined && initialBankRIB !== '') setBankRIB(decodeHtmlEntities(initialBankRIB));
      if (initialBankBeneficiary !== undefined && initialBankBeneficiary !== '') setBankBeneficiary(decodeHtmlEntities(initialBankBeneficiary));
      if (initialFacebookPixelId !== undefined && initialFacebookPixelId !== '') setFbPixelId(decodeHtmlEntities(initialFacebookPixelId));
    });
  }, [initialProfName, initialProfPhone, initialProfSchool, initialProfDirection, initialProfAcademy, initialProfSubject, initialProfSOM, initialProfEmail, initialProfAcademicYear, initialProfCity, initialProfSite, initialBankName, initialBankRIB, initialBankBeneficiary, initialFacebookPixelId]);

  const saveBranding = async () => {
    await updateBrandingConfig({
      profName: profName.trim(),
      profPhone: profPhone.trim(),
      profSchool: profSchool.trim(),
      profDirection: profDirection.trim(),
      profAcademy: profAcademy.trim(),
      profSubject: profSubject.trim(),
      profSOM: profSOM.trim(),
      profEmail: profEmail.trim(),
      profAcademicYear: profAcademicYear.trim(),
      profCity: profCity.trim(),
      profSite: profSite.trim() || 'www.lconq.ma',
      bankName: bankName.trim(),
      bankRIB: bankRIB.trim(),
      bankBeneficiary: bankBeneficiary.trim(),
      fbPixelId: fbPixelId.trim()
    });
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 2500);
  };

  // ── PDF Styling Settings ───────────────────────────────────────────────────
  const [pdfPageMargins, setPdfPageMargins] = useState(() => localStorage.getItem('pdf_page_margins') || 'standard');
  const [pdfFontSize, setPdfFontSize] = useState(() => localStorage.getItem('pdf_font_size') || '11pt');
  const [pdfFontFamily, setPdfFontFamily] = useState(() => localStorage.getItem('pdf_font_family') || 'Computer Modern Serif');
  const [pdfTemplateStyle, setPdfTemplateStyle] = useState(() => localStorage.getItem('pdf_template_style') || 'classic_latex');
  const [pdfSeriesStyle, setPdfSeriesStyle] = useState(() => localStorage.getItem('pdf_series_style') || 'modern_pro_2026');
  const [pdfAvoidPageBreaks, setPdfAvoidPageBreaks] = useState(() => localStorage.getItem('pdf_avoid_page_breaks') !== 'false');
  const [pdfForcePrintColors, setPdfForcePrintColors] = useState(() => localStorage.getItem('pdf_force_print_colors') !== 'false');
  const [pdfShowSidebar, setPdfShowSidebar] = useState(() => localStorage.getItem('pdf_show_sidebar') !== 'false');
  const [pdfSaved, setPdfSaved] = useState(false);

  const savePdfSettings = async () => {
    localStorage.setItem('pdf_series_style', pdfSeriesStyle);
    await updatePdfSettingsConfig({
      pdfPageMargins,
      pdfFontSize,
      pdfFontFamily,
      pdfTemplateStyle,
      pdfSeriesStyle,
      pdfAvoidPageBreaks,
      pdfForcePrintColors,
      pdfShowSidebar
    });
    setPdfSaved(true);
    setTimeout(() => setPdfSaved(false), 2500);
  };

  // ── Logbook / Timetable / Holidays Settings ──────────────────────────────────
  const WEEKDAYS = [
    { id: 1, label: 'Lundi' },
    { id: 2, label: 'Mardi' },
    { id: 3, label: 'Mercredi' },
    { id: 4, label: 'Jeudi' },
    { id: 5, label: 'Vendredi' },
    { id: 6, label: 'Samedi' },
  ];

  const TIME_SLOTS = [
    { id: '08-09', label: '08:00 - 09:00' },
    { id: '09-10', label: '09:00 - 10:00' },
    { id: '10-11', label: '10:00 - 11:00' },
    { id: '11-12', label: '11:00 - 12:00' },
    { id: '14-15', label: '14:00 - 15:00' },
    { id: '15-16', label: '15:00 - 16:00' },
    { id: '16-17', label: '16:00 - 17:00' },
    { id: '17-18', label: '17:00 - 18:00' }
  ];

  const [logbookSchedule, setLogbookSchedule] = useState(() => {
    try { return JSON.parse(localStorage.getItem('teacher_schedule_current') || '{}'); }
    catch { return {}; }
  });

  const [logbookHolidays, setLogbookHolidays] = useState(() => {
    try { return JSON.parse(localStorage.getItem('school_holidays') || '[]'); }
    catch { return []; }
  });

  const [logbookArFont, setLogbookArFont] = useState(() => localStorage.getItem('logbook_ar_font') || 'UKIJ Merdane');
  const [logbookFrFont, setLogbookFrFont] = useState(() => localStorage.getItem('logbook_fr_font') || 'Outfit');
  const [logbookFontSize, setLogbookFontSize] = useState(() => localStorage.getItem('logbook_font_size') || '0.8rem');
  const [logbookLineHeight, setLogbookLineHeight] = useState(() => parseInt(localStorage.getItem('logbook_line_height') || '20', 10));
  const [logbookColorInk, setLogbookColorInk] = useState(() => localStorage.getItem('logbook_color_ink') || '#334155');
  const [logbookColorChapter, setLogbookColorChapter] = useState(() => localStorage.getItem('logbook_color_chapter') || '#0f172a');
  const [logbookColorAxis, setLogbookColorAxis] = useState(() => localStorage.getItem('logbook_color_axis') || '#2563eb');
  const [logbookColorExercise, setLogbookColorExercise] = useState(() => localStorage.getItem('logbook_color_exercise') || '#d97706');
  const [logbookSubTab, setLogbookSubTab] = useState('timetable');
  const [logbookSaved, setLogbookSaved] = useState(false);
  const [isSavingLogbook, setIsSavingLogbook] = useState(false);

  // Holiday form
  const [newHolLabel, setNewHolLabel] = useState('');
  const [newHolStart, setNewHolStart] = useState('');
  const [newHolEnd, setNewHolEnd] = useState('');

  // States for inline editing holiday
  const [editingHolId, setEditingHolId] = useState(null);
  const [editingHolLabel, setEditingHolLabel] = useState('');
  const [editingHolStart, setEditingHolStart] = useState('');
  const [editingHolEnd, setEditingHolEnd] = useState('');

  // Fetch remote schedule, holidays, and style configuration from cloud on mount
  useEffect(() => {
    getSchoolHolidaysConfig({ forceRefresh: true }).then(cloudHols => {
      if (Array.isArray(cloudHols) && cloudHols.length > 0) {
        setLogbookHolidays(cloudHols);
        try { localStorage.setItem('school_holidays', JSON.stringify(cloudHols)); } catch (_) {}
      }
    }).catch(() => {});

    getTeacherScheduleConfig({ forceRefresh: true }).then(cloudSched => {
      if (cloudSched && typeof cloudSched === 'object' && Object.keys(cloudSched).length > 0) {
        setLogbookSchedule(cloudSched);
        try { localStorage.setItem('teacher_schedule_current', JSON.stringify(cloudSched)); } catch (_) {}
      }
    }).catch(() => {});

    getLogbookStyleConfig({ forceRefresh: true }).then(cloudStyle => {
      if (cloudStyle && typeof cloudStyle === 'object') {
        if (cloudStyle.arFont) { setLogbookArFont(cloudStyle.arFont); localStorage.setItem('logbook_ar_font', cloudStyle.arFont); }
        if (cloudStyle.frFont) { setLogbookFrFont(cloudStyle.frFont); localStorage.setItem('logbook_fr_font', cloudStyle.frFont); }
        if (cloudStyle.fontSize) { setLogbookFontSize(cloudStyle.fontSize); localStorage.setItem('logbook_font_size', cloudStyle.fontSize); }
        if (cloudStyle.lineHeight) { setLogbookLineHeight(cloudStyle.lineHeight); localStorage.setItem('logbook_line_height', String(cloudStyle.lineHeight)); }
        if (cloudStyle.colorInk) { setLogbookColorInk(cloudStyle.colorInk); localStorage.setItem('logbook_color_ink', cloudStyle.colorInk); }
        if (cloudStyle.colorChapter) { setLogbookColorChapter(cloudStyle.colorChapter); localStorage.setItem('logbook_color_chapter', cloudStyle.colorChapter); }
        if (cloudStyle.colorAxis) { setLogbookColorAxis(cloudStyle.colorAxis); localStorage.setItem('logbook_color_axis', cloudStyle.colorAxis); }
        if (cloudStyle.colorExercise) { setLogbookColorExercise(cloudStyle.colorExercise); localStorage.setItem('logbook_color_exercise', cloudStyle.colorExercise); }
      }
    }).catch(() => {});
  }, []);

  const holidaysMountedRef = useRef(false);
  // Auto-save holidays to localStorage and Cloud DB on state changes (skip initial mount)
  useEffect(() => {
    if (!holidaysMountedRef.current) {
      holidaysMountedRef.current = true;
      return;
    }
    localStorage.setItem('school_holidays', JSON.stringify(logbookHolidays));
    saveSchoolHolidaysConfig(logbookHolidays).catch(err => console.warn('[AdminSettings] Error syncing holidays:', err));
  }, [logbookHolidays]);

  const handleLogbookScheduleChange = (slotKey, field, value) => {
    setLogbookSchedule(prev => ({
      ...prev,
      [slotKey]: { ...(prev[slotKey] || {}), [field]: value }
    }));
  };

  const addHoliday = () => {
    if (!newHolLabel || !newHolStart || !newHolEnd) return;
    const hol = { id: `hol-${Date.now()}`, label: newHolLabel, startDate: newHolStart, endDate: newHolEnd };
    setLogbookHolidays(prev => [...prev, hol]);
    setNewHolLabel(''); setNewHolStart(''); setNewHolEnd('');
  };

  const removeHoliday = (id) => {
    setLogbookHolidays(prev => prev.filter(h => h.id !== id));
    if (editingHolId === id) setEditingHolId(null);
  };

  const loadMoroccanOfficialHolidays = () => {
    if (logbookHolidays.length > 0) {
      if (!window.confirm("هل تريد إضافة لائحة العطل المدرسية الرسمية بالمغرب إلى لائحتك الحالية؟")) {
        return;
      }
    }
    const officialHols = getOfficialMoroccanHolidays('2026-2027');
    setLogbookHolidays(prev => {
      const existingKeys = new Set(prev.map(p => `${p.label}-${p.startDate}`));
      const fresh = officialHols.filter(o => !existingKeys.has(`${o.label}-${o.startDate}`));
      return [...prev, ...fresh];
    });
  };

  const isArabicText = (text) => {
    if (!text) return false;
    const arabicRange = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicRange.test(text);
  };

  const parseICS = (icsText) => {
    const events = [];
    const lines = icsText.split(/\r?\n/);
    let currentEvent = null;
    let isAllDayStart = false;
    let isAllDayEnd = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Handle folded lines (lines starting with space or tab are continuation of previous line)
      while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        line += lines[i + 1].substring(1);
        i++;
      }

      if (line === 'BEGIN:VEVENT') {
        currentEvent = {};
        isAllDayStart = false;
        isAllDayEnd = false;
      } else if (line === 'END:VEVENT') {
        if (currentEvent && currentEvent.summary && currentEvent.start) {
          let startDate = currentEvent.start;
          let endDate = currentEvent.end || currentEvent.start;

          // Standard iCal exclusive end-date adjustment for all-day events
          if (isAllDayStart && isAllDayEnd && startDate && endDate) {
            const sDate = new Date(startDate);
            const eDate = new Date(endDate);
            if (eDate > sDate) {
              eDate.setDate(eDate.getDate() - 1);
              const y = eDate.getFullYear();
              const m = String(eDate.getMonth() + 1).padStart(2, '0');
              const d = String(eDate.getDate()).padStart(2, '0');
              endDate = `${y}-${m}-${d}`;
            }
          }

          events.push({
            id: `hol-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            label: currentEvent.summary,
            startDate,
            endDate
          });
        }
        currentEvent = null;
      } else if (currentEvent) {
        if (line.startsWith('SUMMARY:')) {
          currentEvent.summary = line.substring('SUMMARY:'.length).replace(/\\,/g, ',').replace(/\\;/g, ';');
        } else if (line.startsWith('SUMMARY;')) {
          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1) {
            currentEvent.summary = line.substring(colonIdx + 1).replace(/\\,/g, ',').replace(/\\;/g, ';');
          }
        } else if (line.startsWith('DTSTART')) {
          isAllDayStart = line.includes('VALUE=DATE') || !line.includes('T');
          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1) {
            const val = line.substring(colonIdx + 1).trim();
            const match = val.match(/^(\d{4})(\d{2})(\d{2})/);
            if (match) {
              currentEvent.start = `${match[1]}-${match[2]}-${match[3]}`;
            }
          }
        } else if (line.startsWith('DTEND')) {
          isAllDayEnd = line.includes('VALUE=DATE') || !line.includes('T');
          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1) {
            const val = line.substring(colonIdx + 1).trim();
            const match = val.match(/^(\d{4})(\d{2})(\d{2})/);
            if (match) {
              currentEvent.end = `${match[1]}-${match[2]}-${match[3]}`;
            }
          }
        }
      }
    }
    return events;
  };

  const handleIcsUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') return;

      try {
        const parsedHols = parseICS(text);
        if (parsedHols.length === 0) {
          alert('Aucun événement valide n\'a été trouvé dans le fichier ICS.');
          return;
        }

        // Avoid adding duplicate holidays (based on label & dates)
        setLogbookHolidays(prev => {
          const updated = [...prev];
          let importedCount = 0;
          parsedHols.forEach(newHol => {
            const exists = updated.some(h => 
              h.label.toLowerCase() === newHol.label.toLowerCase() && 
              h.startDate === newHol.startDate
            );
            if (!exists) {
              updated.push(newHol);
              importedCount++;
            }
          });
          alert(`${importedCount} vacances scolaires importées avec succès !`);
          return updated;
        });
      } catch (err) {
        console.error('Error parsing ICS file:', err);
        alert('Erreur lors de la lecture du fichier ICS.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const saveLogbookSettings = async () => {
    setIsSavingLogbook(true);
    try {
      localStorage.setItem('teacher_schedule_current', JSON.stringify(logbookSchedule));
      localStorage.setItem('school_holidays', JSON.stringify(logbookHolidays));
      localStorage.setItem('logbook_ar_font', logbookArFont);
      localStorage.setItem('logbook_fr_font', logbookFrFont);
      localStorage.setItem('logbook_font_size', logbookFontSize);
      localStorage.setItem('logbook_line_height', String(logbookLineHeight));
      localStorage.setItem('logbook_color_ink', logbookColorInk);
      localStorage.setItem('logbook_color_chapter', logbookColorChapter);
      localStorage.setItem('logbook_color_axis', logbookColorAxis);
      localStorage.setItem('logbook_color_exercise', logbookColorExercise);

      // Persist to Cloud Database (Supabase & Companion DB)
      await Promise.allSettled([
        saveTeacherScheduleConfig(logbookSchedule),
        saveSchoolHolidaysConfig(logbookHolidays),
        saveLogbookStyleConfig({
          arFont: logbookArFont,
          frFont: logbookFrFont,
          fontSize: logbookFontSize,
          lineHeight: logbookLineHeight,
          colorInk: logbookColorInk,
          colorChapter: logbookColorChapter,
          colorAxis: logbookColorAxis,
          colorExercise: logbookColorExercise
        })
      ]);

      setLogbookSaved(true);
      setTimeout(() => setLogbookSaved(false), 3000);
    } catch (err) {
      console.error('[AdminSettings] Error saving logbook settings:', err);
    } finally {
      setIsSavingLogbook(false);
    }
  };

  const [syncingAll, setSyncingAll] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setSyncSuccessMsg('');
    try {
      const res = await syncAllConfigsAndSchedule();
      if (res.success) {
        setSyncSuccessMsg(`✓ تم مزامنة جدول الحصص (${res.scheduleSlots} حصص) وجميع الإعدادات سحابياً بنجاح!`);
        // Refresh local states
        const freshSched = await getTeacherScheduleConfig({ forceRefresh: true });
        if (freshSched && typeof freshSched === 'object' && Object.keys(freshSched).length > 0) {
          setLogbookSchedule(freshSched);
        }
        const freshHols = await getSchoolHolidaysConfig({ forceRefresh: true });
        if (freshHols && Array.isArray(freshHols) && freshHols.length > 0) {
          setLogbookHolidays(freshHols);
        }
      } else {
        setSyncSuccessMsg('⚠️ تمت المزامنة مع بعض الملاحظات: ' + (res.error || ''));
      }
    } catch (e) {
      setSyncSuccessMsg('❌ حدث خطأ أثناء المزامنة: ' + (e.message || ''));
    } finally {
      setSyncingAll(false);
      setTimeout(() => setSyncSuccessMsg(''), 5000);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      <style>{`
         /* ─── 2026 HORIZONTAL & SIDEBAR TOP NAVIGATION DESIGN SYSTEM ─── */
         .settings-layout {
           display: flex;
           flex-direction: column;
           gap: 1.75rem;
           margin-top: 1.5rem;
           width: 100%;
         }

         .settings-tab-bar {
           display: flex;
           align-items: center;
           gap: 0.4rem;
           padding: 0.45rem;
           background: linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(243, 244, 246, 0.3) 100%) !important;
           backdrop-filter: blur(25px) !important;
           -webkit-backdrop-filter: blur(25px) !important;
           border: 1px solid rgba(255, 255, 255, 0.45) !important;
           border-radius: 16px;
           overflow-x: auto;
           scrollbar-width: none;
           -ms-overflow-style: none;
           position: sticky;
           top: 1rem;
           z-index: 10;
           box-shadow: 0 8px 32px rgba(31, 38, 135, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
         }
         
         body.dark-theme .settings-tab-bar {
           background: linear-gradient(135deg, rgba(20, 20, 25, 0.5) 0%, rgba(30, 30, 35, 0.3) 100%) !important;
           border-color: rgba(255, 255, 255, 0.06) !important;
           box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
         }
         
         .settings-tab-bar::-webkit-scrollbar {
           display: none;
         }

         /* Gliding background indicator */
         .tab-active-indicator {
           position: absolute;
           pointer-events: none;
           transition: all 0.38s cubic-bezier(0.25, 1, 0.5, 1);
           border-radius: 12px;
           background: linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%);
           box-shadow: 0 4px 15px rgba(79, 70, 229, 0.22);
           z-index: 0;
         }
         body.dark-theme .tab-active-indicator {
           background: linear-gradient(135deg, var(--violet) 0%, #4F46E5 100%);
           box-shadow: 0 4px 15px var(--violet-glow);
         }

         .modern-tab-btn {
           display: flex;
           align-items: center;
           gap: 0.75rem;
           padding: 0.65rem 1.1rem;
           border-radius: 12px;
           background: transparent;
           color: #71717a !important; /* Inactive contrast */
           font-weight: 700;
           border: 1px solid transparent;
           cursor: pointer;
           transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
           white-space: nowrap;
           flex-shrink: 0;
           position: relative;
           z-index: 1;
         }
         body.dark-theme .modern-tab-btn {
           color: #a1a1aa !important;
         }
         
         .modern-tab-btn:hover {
           color: var(--violet) !important;
         }
         body.dark-theme .modern-tab-btn:hover {
           color: #fff !important;
         }
         
         .modern-tab-btn.active {
           color: #fff !important;
           background: transparent !important;
           border-color: transparent !important;
           box-shadow: none !important;
         }

         .tab-badge {
           width: 30px; height: 30px;
           border-radius: 8px;
           display: flex; align-items: center; justify-content: center;
           background: rgba(0, 0, 0, 0.03);
           border: 1px solid rgba(0, 0, 0, 0.04);
           color: #71717a;
           transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
           flex-shrink: 0;
         }
         body.dark-theme .tab-badge {
           background: rgba(255, 255, 255, 0.04);
           border: 1px solid rgba(255, 255, 255, 0.06);
           color: #a1a1aa;
         }
         .modern-tab-btn:hover .tab-badge {
           background: rgba(139, 92, 246, 0.08);
           border-color: rgba(139, 92, 246, 0.15);
           color: var(--violet);
         }
         body.dark-theme .modern-tab-btn:hover .tab-badge {
           background: rgba(255, 255, 255, 0.08);
           border-color: rgba(255, 255, 255, 0.1);
           color: #fff;
         }
         .modern-tab-btn.active .tab-badge {
           background: rgba(255, 255, 255, 0.18) !important;
           border-color: transparent !important;
           color: #fff !important;
         }

         .tab-badge-placeholder-dummy {
           color: inherit;
           transition: all 0.25s;
           flex-shrink: 0;
         }
         
         .modern-tab-btn.active .tab-badge {
           background: rgba(255, 255, 255, 0.2);
           border-color: transparent;
           color: #fff;
         }

         .tab-text {
           display: flex;
           flex-direction: column;
           align-items: flex-start;
           gap: 0.1rem;
           text-align: left;
         }

         .tab-title {
           font-weight: 750;
           font-size: 0.85rem;
           line-height: 1.2;
         }

         .tab-desc {
           font-size: 0.68rem;
           color: var(--text-subtle);
           display: none;
           font-weight: 500;
         }

         .modern-tab-btn.active .tab-desc {
           color: rgba(255, 255, 255, 0.75);
         }

         .settings-content {
           display: flex;
           flex-direction: column;
           gap: 1.5rem;
           width: 100%;
           min-width: 0;
         }

         /* Premium Bento Card Styling */
         .bento-card {
           background: var(--bg-card);
           border: 1px solid var(--border);
           border-radius: 24px;
           padding: 2.5rem;
           box-shadow: var(--shadow-card);
           position: relative;
           overflow: hidden;
           animation: cardFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
         }

         /* Subtle decorative grid effect on bento-card */
         .bento-card::before {
           content: '';
           position: absolute;
           top: 0; left: 0; right: 0; height: 1px;
           background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
           pointer-events: none;
         }

         @keyframes cardFadeIn {
           from { opacity: 0; transform: translateY(12px); }
           to   { opacity: 1; transform: translateY(0); }
         }

         /* Modern Settings Field & Controls */
         .settings-field {
           display: flex;
           flex-direction: column;
           gap: 0.45rem;
         }

         .settings-label {
           font-size: 0.72rem;
           font-weight: 800;
           text-transform: uppercase;
           letter-spacing: 0.08em;
           color: var(--text-subtle);
           display: flex;
           align-items: center;
           gap: 0.35rem;
         }

         .settings-title {
           font-size: 1.25rem;
           font-weight: 900;
           color: var(--text-main);
           margin: 0 0 0.5rem 0;
           display: flex;
           align-items: center;
           gap: 0.65rem;
         }

         .settings-desc {
           font-size: 0.82rem;
           color: var(--text-muted);
           line-height: 1.6;
           margin: 0 0 1.75rem 0;
         }

         /* Inputs & Controls */
         .input-control {
           background: rgba(255, 255, 255, 0.015) !important;
           backdrop-filter: blur(4px);
           border: 1px solid var(--border) !important;
           border-radius: 12px !important;
           padding: 0.75rem 1rem !important;
           font-size: 0.85rem !important;
           color: var(--text-main) !important;
           transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
           outline: none !important;
           width: 100%;
           box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02) !important;
         }
         .input-control:focus {
           border-color: var(--violet) !important;
           background: rgba(139, 92, 246, 0.015) !important;
           box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02), 0 0 0 3px rgba(139, 92, 246, 0.15) !important;
         }

         /* Switches styling */
         .modern-switch-row {
           display: flex;
           align-items: center;
           justify-content: space-between;
           padding: 1.15rem 1.5rem;
           border-radius: 16px;
           background: var(--bg-glass);
           border: 1px solid var(--border);
           transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
         }
         .modern-switch-row:hover {
           background: var(--bg-hover);
           border-color: var(--border-hover);
           box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
         }
         .modern-switch {
           width: 46px; height: 26px; border-radius: 99px;
           border: none; cursor: pointer; position: relative;
           background: var(--border);
           transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
           flex-shrink: 0;
         }
         .modern-switch.active {
           background: var(--violet);
           box-shadow: 0 0 14px var(--violet-glow);
         }
         .modern-switch-knob {
           width: 20px; height: 20px; border-radius: 50%;
           background: #fff; position: absolute; top: 3px;
           left: 3px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
           box-shadow: 0 1px 4px rgba(0,0,0,0.18);
         }
         .modern-switch.active .modern-switch-knob {
           left: 23px;
         }

         /* Premium Cards list */
         .premium-plan-card {
           background: var(--bg-glass);
           border: 1px solid var(--border);
           border-radius: 20px;
           padding: 1.75rem;
           transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
           box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
         }
         .premium-plan-card:hover {
           border-color: var(--violet);
           background: var(--bg-hover);
           transform: translateY(-2px);
           box-shadow: 0 8px 30px rgba(139, 92, 246, 0.08);
         }

         .holiday-card {
           background: var(--bg-glass);
           border: 1px solid var(--border);
           border-radius: 16px;
           padding: 1.15rem 1.35rem;
           transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
           display: flex;
           justify-content: space-between;
           align-items: center;
           gap: 1.25rem;
         }
         .holiday-card:hover {
           border-color: rgba(139, 92, 246, 0.3);
           background: var(--bg-hover);
           transform: translateY(-2px);
           box-shadow: 0 6px 20px rgba(139, 92, 246, 0.05);
         }

         /* Timetable Styling */
          .timetable-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 2px;
            font-size: 10px;
            position: relative;
          }
          
          .timetable-hdr {
            position: sticky;
            top: 0;
            z-index: 5;
            padding: 0.45rem 0.35rem;
            text-align: center;
            color: #09090b !important;
            background: rgba(255, 255, 255, 0.85) !important;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            font-weight: 900 !important;
            font-size: 0.72rem;
            border-bottom: 0.5px solid var(--border);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          body.dark-theme .timetable-hdr {
            background: rgba(17, 17, 21, 0.85) !important;
            color: #fff !important;
          }
          
          .timetable-top-left-hdr {
            position: sticky;
            top: 0;
            left: 0;
            z-index: 6;
            background: rgba(255, 255, 255, 0.95) !important;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #09090b !important;
            font-weight: 900 !important;
            font-size: 0.72rem;
            border-bottom: 0.5px solid var(--border);
            border-right: 0.5px solid var(--border);
            text-align: center;
          }
          body.dark-theme .timetable-top-left-hdr {
            background: rgba(17, 17, 21, 0.95) !important;
            color: #fff !important;
          }

          .timetable-time-cell {
            position: sticky;
            left: 0;
            z-index: 4;
            background: rgba(255, 255, 255, 0.9) !important;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-right: 0.5px solid var(--border);
            color: #09090b !important;
            font-weight: 900 !important;
            font-size: 0.72rem;
            white-space: nowrap;
            text-align: center;
            box-shadow: 4px 0 10px rgba(0,0,0,0.02);
            padding: 0.45rem 0.35rem;
            border-radius: 6px;
          }
          body.dark-theme .timetable-time-cell {
            background: rgba(24, 24, 30, 0.9) !important;
            color: #fff !important;
            box-shadow: 4px 0 10px rgba(0,0,0,0.2);
          }

          .timetable-slot-cell {
            vertical-align: middle;
            min-width: 95px;
          }
          
          .timetable-card {
            display: flex;
            flex-direction: column;
            gap: 0;
            padding: 0.25rem 0.35rem;
            border-radius: 8px;
            background: var(--bg-card);
            border: 0.5px solid var(--border);
            transition: all 0.25s cubic-bezier(0.25, 1, 0.5, 1);
            position: relative;
            min-height: 38px;
            justify-content: center;
          }
          
          .timetable-card:hover {
            transform: translateY(-1px);
            border-color: var(--border-hover);
            box-shadow: 0 4px 10px rgba(0,0,0,0.04);
          }

          .timetable-card.free {
            border: 0.5px dashed var(--border);
            background: transparent;
            opacity: 0.4;
          }
          .timetable-card.free:hover {
            opacity: 1;
            border-style: solid;
            border-color: var(--violet);
            background: var(--bg-hover);
          }

          .timetable-card.active {
            border: 0.5px solid var(--violet);
            background: linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(79, 70, 229, 0.01) 100%) !important;
            box-shadow: 0 2px 8px rgba(79, 70, 229, 0.04);
          }
          body.dark-theme .timetable-card.active {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%) !important;
            box-shadow: 0 2px 8px rgba(139, 92, 246, 0.04);
          }

          .timetable-select {
            width: 100%;
            background: rgba(255, 255, 255, 0.03);
            border: 0.5px solid var(--border);
            border-radius: 4px;
            padding: 0.2rem 0.3rem;
            font-size: 9px;
            font-weight: 800;
            color: var(--text-main);
            cursor: pointer;
            outline: none;
            transition: all 0.2s ease;
          }
          
          .timetable-free-hover-trigger {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
          }
          .timetable-plus-icon {
            color: var(--text-muted);
            opacity: 0.6;
            transition: all 0.2s;
          }
          .timetable-card.free:hover .timetable-plus-icon {
            opacity: 0;
          }
          
          .timetable-select-free {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            opacity: 0;
            cursor: pointer;
            background: transparent;
            border: none;
          }
          .timetable-card.free:hover .timetable-select-free {
            opacity: 1;
            padding: 0.25rem 0.35rem;
            font-size: 9px;
            font-weight: 800;
            color: var(--text-main);
            background: var(--bg-card);
            border-radius: 8px;
            border: 0.5px solid var(--violet);
          }

          .timetable-input-container {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            background: rgba(255, 255, 255, 0.01);
            border: 0.5px solid var(--border);
            border-radius: 4px;
            padding: 0.15rem 0.3rem;
            transition: all 0.2s ease;
          }

          .timetable-input {
            background: transparent;
            border: none;
            outline: none;
            width: 100%;
            font-size: 9px;
            color: var(--text-main);
            padding: 0;
            margin: 0;
          }

          .timetable-delete-btn {
            position: absolute;
            top: 0.2rem;
            right: 0.2rem;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(239, 68, 68, 0.08);
            color: var(--danger);
            border: 0.5px solid rgba(239, 68, 68, 0.12);
            cursor: pointer;
            opacity: 0;
            transition: all 0.2s ease;
            z-index: 10;
          }
          .timetable-card:hover .timetable-delete-btn {
            opacity: 1;
          }
          .timetable-delete-btn:hover {
            background: var(--danger);
            color: #fff;
          }

          /* Subtabs bar (Timetable/Holidays/Style) - Segmented Control */
          .logbook-subtabs-bar {
            display: inline-flex;
            gap: 2px;
            padding: 0.25rem;
            background: rgba(0, 0, 0, 0.03) !important;
            border: 0.5px solid var(--border);
            border-radius: 12px;
            margin-bottom: 1.75rem;
          }
          body.dark-theme .logbook-subtabs-bar {
            background: rgba(255, 255, 255, 0.02) !important;
          }

          .logbook-subtab-btn {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.45rem 1rem;
            border-radius: 9px;
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--text-muted) !important;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            border: none;
            background: transparent;
          }
          
          .logbook-subtab-btn:hover {
            color: var(--text-main) !important;
            background: rgba(0, 0, 0, 0.01);
          }
          body.dark-theme .logbook-subtab-btn:hover {
            background: rgba(255, 255, 255, 0.01);
          }
          
          .logbook-subtab-btn.active {
            color: #09090b !important;
            background: #ffffff !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          }
          body.dark-theme .logbook-subtab-btn.active {
            color: #ffffff !important;
            background: rgba(255, 255, 255, 0.08) !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }
          
          body.light-theme .logbook-subtabs-bar {
            background: rgba(0, 0, 0, 0.03) !important;
            border-color: rgba(0, 0, 0, 0.06) !important;
          }
          body.light-theme .logbook-subtab-btn.active {
            color: #09090b !important;
            background: #ffffff !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          }

          /* Credit Card Style */
         .credit-card-preview {
           background: linear-gradient(135deg, #101014 0%, #1e1b4b 100%);
           border-radius: 16px;
           padding: 1.25rem;
           color: #fff;
           position: relative;
           overflow: hidden;
           box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
           border: 0.5px solid rgba(255, 255, 255, 0.1);
           aspect-ratio: 1.75 / 1;
           display: flex;
           flex-direction: column;
           justify-content: space-between;
         }
         body.light-theme .credit-card-preview {
           background: linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%);
           box-shadow: 0 10px 25px rgba(79, 70, 229, 0.15);
           border-color: rgba(255, 255, 255, 0.2);
         }
         .card-chip {
           width: 32px;
           height: 24px;
           background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
           border-radius: 4px;
           position: relative;
         }
         .card-bank-name {
           font-size: 0.72rem;
           font-weight: 800;
           letter-spacing: 0.05em;
           text-transform: uppercase;
           opacity: 0.85;
           position: absolute;
           top: 1.25rem;
           right: 1.25rem;
         }
         .card-rib-number {
           font-family: 'Courier New', monospace;
           font-size: 0.82rem;
           font-weight: bold;
           letter-spacing: 0.05em;
           margin: 1.25rem 0 0.5rem 0;
           text-shadow: 0 1px 2px rgba(0,0,0,0.5);
         }
         .card-holder-label {
           font-size: 0.55rem;
           text-transform: uppercase;
           letter-spacing: 0.1em;
           opacity: 0.6;
           margin-bottom: 0.1rem;
         }
         .card-holder-name {
           font-size: 0.82rem;
           font-weight: 800;
           letter-spacing: 0.02em;
           text-transform: uppercase;
         }

         /* OMR control card styling */
         .omr-control-card {
           background: var(--bg-glass);
           border: 0.5px solid var(--border);
           border-radius: 16px;
           padding: 1rem 1.25rem;
           min-width: 300px;
           position: relative;
           box-shadow: 0 4px 15px rgba(0,0,0,0.02);
         }
         .omr-status-indicator {
           width: 8px; height: 8px; border-radius: 50%;
           background: var(--border);
           transition: all 0.3s;
         }
         .omr-status-indicator.active {
           background: var(--emerald);
           box-shadow: 0 0 8px var(--emerald);
         }
         .omr-feedback-toast {
           position: absolute;
           bottom: -24px; left: 50%; transform: translateX(-50%);
           background: var(--emerald);
           color: #fff; font-size: 10px; font-weight: 800;
           padding: 0.2rem 0.6rem; border-radius: 4px;
           box-shadow: 0 2px 8px rgba(0,0,0,0.15);
           animation: slideUpFade 0.2s ease-out;
         }
         @keyframes slideUpFade {
           from { transform: translate(-50%, 4px); opacity: 0; }
           to { transform: translate(-50%, 0); opacity: 1; }
         }
      `}</style>

      {/* Header Panel */}
      <div className="flex justify-between items-center flex-wrap gap-4 pb-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--violet-soft)] border border-[var(--violet)] flex items-center justify-center text-[var(--violet)]">
            <Settings size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)]">Paramètres</h1>
            <p className="text-sm text-[var(--text-muted)]">Ajustez et modifiez la configuration globale de L'CONQ.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="مزامنة شاملة لجدول الحصص وجميع الإعدادات سحابياً ومحلياً"
          >
            <RefreshCw size={14} className={syncingAll ? 'animate-spin' : ''} />
            <span>{syncingAll ? 'جاري المزامنة...' : 'مزامنة السحاب وجدول الحصص'}</span>
          </button>
          <div className="flex flex-col items-center px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl min-w-[75px]">
            <span className="text-lg font-black text-[var(--text-main)]">{(classes || []).length}</span>
            <span className="text-[10px] text-[var(--text-subtle)] font-bold uppercase tracking-wider">Classes</span>
          </div>
        </div>
      </div>

      {syncSuccessMsg && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in" style={{ direction: 'rtl' }}>
          <CheckCircle2 size={16} />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      <div className="settings-layout">
        
        {/* Navigation Horizontal Tab Bar */}
        <div className="settings-tab-bar" ref={tabBarRef} style={{ position: 'relative' }}>
          <div 
            className="tab-active-indicator"
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
              top: `${indicatorStyle.top}px`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.opacity
            }}
          />
          {[
            { id: 'general', label: 'Branding & Profil', desc: 'Identité & Établissement', icon: Crown },
            { id: 'backup_omr', label: 'Sauvegarde & OMR', desc: 'Backup JSON & Scanner', icon: Download },
            { id: 'whatsapp', label: 'WhatsApp', desc: 'Bouton de support direct', icon: MessageCircle },
            { id: 'pdf', label: 'Modèles PDF', desc: 'LaTeX, styles & polices', icon: FileText },
            { id: 'flashcards', label: 'Flashcards', desc: 'Révélation & animations', icon: Layers },
            { id: 'apis', label: 'Clés API & IA', desc: 'Claude, Gemini, OpenAI', icon: KeyRound },
            { id: 'logbook', label: 'Cahier de Textes', desc: 'Emploi du temps & vacances', icon: BookOpen },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`modern-tab-btn ${isActive ? 'active' : ''}`}
              >
                <div className="tab-badge">
                  <tab.icon size={15} />
                </div>
                <div className="tab-text">
                  <span className="tab-title">{tab.label}</span>
                  <span className="tab-desc">{tab.desc}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Content Column */}
        <div className="settings-content">
          <SectionErrorBoundary title={`Paramètres (${activeTab})`}>

          {/* ── WHATSAPP TAB ── */}
          {activeTab === 'whatsapp' && (
            <div className="bento-card">
              <h2 className="settings-title">
                <MessageCircle size={22} className="text-[#25D366]" /> Support WhatsApp
              </h2>
              <p className="settings-desc">
                Activez et configurez un bouton WhatsApp flottant pour permettre aux élèves de vous contacter directement pour du support ou des questions.
              </p>

              <div className="flex flex-col gap-6">
                
                {/* Toggle Row */}
                <div className="modern-switch-row">
                  <div className="flex items-center gap-3">
                    <MessageCircle size={20} className="text-[#25D366]" />
                    <div>
                      <p className="font-bold text-sm text-[var(--text-main)] m-0">Afficher le bouton WhatsApp</p>
                      <p className="text-xs text-[var(--text-subtle)] m-0 mt-0.5">Rendre le bouton flottant visible sur l&apos;ensemble de la plateforme</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWaEnabled(v => !v)}
                    className={`modern-switch ${waEnabled ? 'active' : ''}`}
                  >
                    <div className="modern-switch-knob" />
                  </button>
                </div>

                {/* Grid Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ opacity: waEnabled ? 1 : 0.45, transition: 'opacity 0.2s' }}>
                  
                  {/* Phone */}
                  <div className="settings-field">
                    <label className="settings-label">Numéro de Téléphone WhatsApp</label>
                    <input
                      type="text"
                      dir="auto"
                      disabled={!waEnabled}
                      className="input-control"
                      placeholder={profPhone ? `${profPhone} (Général)` : "+212 600-000000"}
                      value={waPhone}
                      onChange={e => setWaPhone(e.target.value)}
                    />
                    <p className="text-[11px] text-[var(--text-subtle)] leading-snug">
                      Laissez vide pour utiliser le numéro général de l&apos;identité : <strong>{profPhone || 'Non configuré'}</strong>.
                    </p>
                  </div>

                  {/* Tooltip */}
                  <div className="settings-field">
                    <label className="settings-label">Texte de l&apos;infobulle (Tooltip)</label>
                    <input
                      type="text"
                      dir="auto"
                      disabled={!waEnabled}
                      className="input-control"
                      placeholder="Besoin d'aide ?"
                      value={waTooltip}
                      onChange={e => setWaTooltip(e.target.value)}
                    />
                    <p className="text-[11px] text-[var(--text-subtle)] leading-snug">
                      Texte court affiché à côté du bouton au survol (ex: "Besoin d'aide ?").
                    </p>
                  </div>

                  {/* Position */}
                  <div className="settings-field col-span-1 md:col-span-2">
                    <label className="settings-label">Position sur l&apos;écran</label>
                    <select
                      disabled={!waEnabled}
                      value={waPosition}
                      onChange={e => setWaPosition(e.target.value)}
                      className="input-control"
                    >
                      <option value="right">En bas à Droite (Recommandé)</option>
                      <option value="left">En bas à Gauche</option>
                    </select>
                  </div>

                </div>

                {/* Message */}
                <div className="settings-field" style={{ opacity: waEnabled ? 1 : 0.45, transition: 'opacity 0.2s' }}>
                  <label className="settings-label">Message prédéfini par défaut</label>
                  <textarea
                    disabled={!waEnabled}
                    dir="auto"
                    className="input-control"
                    placeholder="Bonjour, j'ai une question concernant la plateforme Gima."
                    rows={3}
                    value={waMessage}
                    onChange={e => setWaMessage(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

              </div>

              {/* Action Save */}
              <div className="flex justify-between items-center gap-4 mt-8 pt-6 border-t border-[var(--border)]">
                <div>
                  {waSaved && (
                    <div className="save-badge">
                      <CheckCircle2 size={14} /> Enregistré !
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={saveWhatsAppSettings}
                  className="btn"
                  style={{ padding: '0.75rem 2rem' }}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* ── PDF TAB ── */}
          {activeTab === 'pdf' && (
            <div className="bento-card">
              <h2 className="settings-title">
                <FileText size={22} className="text-[var(--violet)]" /> Style & Impression PDF
              </h2>
              <p className="settings-desc">
                Configurez l&apos;affichage et la structure visuelle de vos documents PDF générés (sujets, corrigés, e-books) pour un rendu professionnel de type LaTeX.
              </p>

              <div className="flex flex-col gap-6">
                
                {/* Selectors Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Margins */}
                  <div className="settings-field">
                    <label className="settings-label">Marges de page</label>
                    <select
                      value={pdfPageMargins}
                      onChange={e => setPdfPageMargins(e.target.value)}
                      className="input-control"
                    >
                      <option value="standard">Standard (Marge équilibrée - A4 classique)</option>
                      <option value="compact">Compacte (Étroite pour économiser du papier)</option>
                      <option value="wide">Large (Aéré - type livre d&apos;art)</option>
                    </select>
                  </div>

                  {/* Font Size */}
                  <div className="settings-field">
                    <label className="settings-label">Taille de police de base</label>
                    <select
                      value={pdfFontSize}
                      onChange={e => setPdfFontSize(e.target.value)}
                      className="input-control"
                    >
                      <option value="8.5pt">Très Petit (8.5pt - Ultra économique)</option>
                      <option value="9.5pt">Compact (9.5pt)</option>
                      <option value="10pt">Petit (10pt)</option>
                      <option value="11pt">Normal (11pt - conseillé)</option>
                      <option value="12pt">Grand (12pt)</option>
                      <option value="13pt">Très Grand (13pt)</option>
                      <option value="14pt">Extra Grand (14pt)</option>
                      <option value="15pt">Large (15pt)</option>
                      <option value="16pt">Très Large (16pt)</option>
                      <option value="18pt">Géant (18pt)</option>
                      <option value="20pt">Maxi (20pt)</option>
                    </select>
                  </div>

                  {/* Font Family */}
                  <div className="settings-field">
                    <label className="settings-label">Police typographique</label>
                    <select
                      value={pdfFontFamily}
                      onChange={e => setPdfFontFamily(e.target.value)}
                      className="input-control"
                    >
                      <option value="Computer Modern Serif">Computer Modern Serif (Scientifique LaTeX)</option>
                      <option value="STIX Two Text">STIX Two Text (Serif classique)</option>
                      <option value="Times New Roman">Times New Roman (Format Examen)</option>
                      <option value="Inter">Inter (Sans-Serif épurée)</option>
                    </select>
                  </div>

                  {/* Template Style */}
                  <div className="settings-field">
                    <label className="settings-label">Modèle de mise en page Examens</label>
                    <select
                      value={pdfTemplateStyle}
                      onChange={e => setPdfTemplateStyle(e.target.value)}
                      className="input-control"
                    >
                      <option value="anisse_classic">Modèle Devoir Surveillé (Style Lycée ANISSE — En-tête Cadre & Barème)</option>
                      <option value="classic_latex">Classique LaTeX (Sobre & Académique)</option>
                      <option value="modern_minimalist">Moderne Épuré (Minimaliste contemporain)</option>
                      <option value="premium_royal">Royal Institutionnel (Ruban & En-tête officiel)</option>
                      <option value="compact_eco">Économique & Compact (Maximiser l&apos;espace)</option>
                      <option value="super_eco">Super Économique (Sans en-tête, sans matière, avec numéro compact)</option>
                    </select>
                  </div>

                  {/* Series & Lesson Template Style */}
                  <div className="settings-field">
                    <label className="settings-label">Modèle Séries d&apos;exercices & Cours</label>
                    <select
                      value={pdfSeriesStyle}
                      onChange={e => setPdfSeriesStyle(e.target.value)}
                      className="input-control"
                    >
                      <option value="modern_pro_2026">✨ Moderne Pro 2026 (Équilibré, En-tête raffiné, Tri auto 1→N & Footer)</option>
                      <option value="classic_original">🏛️ Classique Original (Ancien format à cadre 4 cellules)</option>
                    </select>
                  </div>

                </div>

                {/* Sauts de page Toggle */}
                <div className="modern-switch-row">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-[var(--violet)]" />
                    <div>
                      <p className="font-bold text-sm text-[var(--text-main)] m-0">Sauts de page intelligents</p>
                      <p className="text-xs text-[var(--text-subtle)] m-0 mt-0.5">Éviter de couper une question ou ses propositions sur deux pages distinctes</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPdfAvoidPageBreaks(v => !v)}
                    className={`modern-switch ${pdfAvoidPageBreaks ? 'active' : ''}`}
                  >
                    <div className="modern-switch-knob" />
                  </button>
                </div>

                {/* Colors Preserving Toggle */}
                <div className="modern-switch-row">
                  <div className="flex items-center gap-3">
                    <Sparkles size={18} className="text-[var(--emerald)]" />
                    <div>
                      <p className="font-bold text-sm text-[var(--text-main)] m-0">Impression couleur & arrière-plans</p>
                      <p className="text-xs text-[var(--text-subtle)] m-0 mt-0.5">Forcer la préservation des couleurs de fond, des badges et bulles OMR</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPdfForcePrintColors(v => !v)}
                    className={`modern-switch ${pdfForcePrintColors ? 'active' : ''}`}
                  >
                    <div className="modern-switch-knob" />
                  </button>
                </div>

                {/* Show Sidebar Toggle */}
                <div className="modern-switch-row">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-[var(--violet)]" />
                    <div>
                      <p className="font-bold text-sm text-[var(--text-main)] m-0">Bandeau latéral des Écoles (Sidebar)</p>
                      <p className="text-xs text-[var(--text-subtle)] m-0 mt-0.5">Afficher la bande latérale verticale des écoles sur les documents PDF générés</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPdfShowSidebar(v => !v)}
                    className={`modern-switch ${pdfShowSidebar ? 'active' : ''}`}
                  >
                    <div className="modern-switch-knob" />
                  </button>
                </div>

              </div>

              {/* Action Save */}
              <div className="flex justify-between items-center gap-4 mt-8 pt-6 border-t border-[var(--border)]">
                <div>
                  {pdfSaved && (
                    <div className="save-badge">
                      <CheckCircle2 size={14} /> Enregistré !
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={savePdfSettings}
                  className="btn"
                  style={{ padding: '0.75rem 2rem' }}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* ── FLASHCARDS TAB ── */}
          {activeTab === 'flashcards' && (
            <div className="bento-card">
              <h2 className="settings-title">
                <Layers size={22} className="text-[var(--violet)]" /> Révélation & Animations Flashcards
              </h2>
              <p className="settings-desc">
                Personnalisez le mode d&apos;affichage, l&apos;animation de retournement, les effets sonores et la typographie des flashcards de révision active.
              </p>

              <div className="flex flex-col gap-6">
                
                {/* Mode Select Grid */}
                <div>
                  <label className="settings-label mb-3">
                    <Layers size={14} /> Mode de révélation de la réponse
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { id: 'flip',    icon: '🔄', label: 'Retournement 3D',  desc: 'Animation de rotation 3D' },
                      { id: 'fade',    icon: '✨', label: 'Fondu doux',       desc: 'Révélation progressive' },
                      { id: 'instant', icon: '⚡', label: 'Révélation rapide', desc: 'Affichage instantané' },
                    ].map(({ id, icon, label, desc }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setCardReveal(id); if (id !== 'flip') setCardFlip(false); else setCardFlip(true); }}
                        style={{
                          padding: '1.25rem 1rem',
                          borderRadius: 16,
                          cursor: 'pointer',
                          background: cardReveal === id ? 'var(--violet-soft)' : 'var(--bg-glass)',
                          border: `1.5px solid ${cardReveal === id ? 'var(--violet)' : 'var(--border)'}`,
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          boxShadow: cardReveal === id ? '0 4px 15px -3px var(--violet-glow)' : 'none',
                        }}
                      >
                        <span className="text-xl block mb-2">{icon}</span>
                        <strong className="text-sm block text-[var(--text-main)] mb-1">{label}</strong>
                        <span className="text-xs block text-[var(--text-subtle)] leading-normal">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Commutateurs */}
                <div className="modern-switch-row" style={{ opacity: cardReveal === 'flip' ? 1 : 0.45 }}>
                  <div className="flex items-center gap-3">
                    <RefreshCw size={18} className="text-[var(--violet)]" />
                    <div>
                      <p className="font-bold text-sm text-[var(--text-main)] m-0">Animation de rotation 3D</p>
                      <p className="text-xs text-[var(--text-subtle)] m-0 mt-0.5">Actif uniquement en mode Retournement 3D</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={cardReveal !== 'flip'}
                    onClick={() => setCardFlip(v => !v)}
                    className={`modern-switch ${cardFlip && cardReveal === 'flip' ? 'active' : ''}`}
                  >
                    <div className="modern-switch-knob" />
                  </button>
                </div>

                <div className="modern-switch-row">
                  <div className="flex items-center gap-3">
                    <MousePointerClick size={18} className="text-[var(--emerald)]" />
                    <div>
                      <p className="font-bold text-sm text-[var(--text-main)] m-0">Geste de glissement (Swipe)</p>
                      <p className="text-xs text-[var(--text-subtle)] m-0 mt-0.5">Glisser vers la droite pour valider (Facile) ou la gauche (À revoir)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCardSwipe(v => !v)}
                    className={`modern-switch ${cardSwipe ? 'active' : ''}`}
                  >
                    <div className="modern-switch-knob" />
                  </button>
                </div>

                <div className="modern-switch-row">
                  <div className="flex items-center gap-3">
                    <Volume2 size={18} className="text-[var(--violet)]" />
                    <div>
                      <p className="font-bold text-sm text-[var(--text-main)] m-0">Effets sonores (Sons)</p>
                      <p className="text-xs text-[var(--text-subtle)] m-0 mt-0.5">Jouer un signal sonore lors de la validation d&apos;une réponse</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCardSound(v => !v)}
                    className={`modern-switch ${cardSound ? 'active' : ''}`}
                  >
                    <div className="modern-switch-knob" />
                  </button>
                </div>

                {/* Typography Settings */}
                <div className="border-t border-[var(--border)] pt-6 mt-2">
                  <h4 className="text-sm font-black text-[var(--text-main)] mb-4 flex items-center gap-2">
                    <Sliders size={14} /> Typographie des cartes de révision
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    
                    <div className="settings-field">
                      <label className="settings-label">Police typographique</label>
                      <select value={cardFontFamily} onChange={e => setCardFontFamily(e.target.value)} className="input-control">
                        <option value="Computer Modern Serif">Computer Modern Serif</option>
                        <option value="STIX Two Text">STIX Two Text</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Inter">Inter Sans-Serif</option>
                      </select>
                    </div>

                    <div className="settings-field">
                      <label className="settings-label">Taille du texte</label>
                      <select value={cardFontSize} onChange={e => setCardFontSize(e.target.value)} className="input-control">
                        <option value="0.82rem">Petite (0.82rem)</option>
                        <option value="0.9rem">Compacte (0.9rem)</option>
                        <option value="1rem">Standard (1rem)</option>
                        <option value="1.08rem">Grande (1.08rem)</option>
                        <option value="1.18rem">Très grande (1.18rem)</option>
                      </select>
                    </div>

                    <div className="settings-field">
                      <label className="settings-label">Épaisseur Question</label>
                      <select value={cardQuestionWeight} onChange={e => setCardQuestionWeight(e.target.value)} className="input-control">
                        <option value="400">Normal (400)</option>
                        <option value="500">Moyen (500)</option>
                        <option value="600">Demi-gras (600)</option>
                        <option value="700">Gras (700)</option>
                      </select>
                    </div>

                    <div className="settings-field">
                      <label className="settings-label">Épaisseur Options</label>
                      <select value={cardOptionsWeight} onChange={e => setCardOptionsWeight(e.target.value)} className="input-control">
                        <option value="400">Normal (400)</option>
                        <option value="500">Moyen (500)</option>
                        <option value="600">Demi-gras (600)</option>
                        <option value="700">Gras (700)</option>
                      </select>
                    </div>

                    <div className="settings-field">
                      <label className="settings-label">Épaisseur Solution / Astuce</label>
                      <select value={cardAstuceWeight} onChange={e => setCardAstuceWeight(e.target.value)} className="input-control">
                        <option value="400">Normal (400)</option>
                        <option value="500">Moyen (500)</option>
                        <option value="600">Demi-gras (600)</option>
                        <option value="700">Gras (700)</option>
                      </select>
                    </div>

                  </div>
                </div>

              </div>

              {/* Action Save */}
              <div className="flex justify-between items-center gap-4 mt-8 pt-6 border-t border-[var(--border)]">
                <div>
                  {cardSaved && (
                    <div className="save-badge">
                      <CheckCircle2 size={14} /> Enregistré !
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={saveCardSettings}
                  className="btn"
                  style={{ padding: '0.75rem 2rem' }}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* ── APIS TAB ── */}
          {activeTab === 'apis' && (
            <div className="flex flex-col gap-8">
              
              {/* Info & Security Header Card */}
              <div className="bento-card" style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(168, 85, 247, 0.06) 50%, rgba(236, 72, 153, 0.06) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                padding: '1.75rem',
                borderRadius: '1.25rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 40px rgba(0,0,0,0.05)'
              }}>
                <div style={{
                  position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px',
                  background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                  filter: 'blur(40px)', pointerEvents: 'none'
                }} />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles size={20} className="text-[var(--violet)] animate-pulse" />
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        Gestionnaire des Clés API & Modèles IA
                      </h3>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6, maxWidth: '750px' }}>
                      Connectez vos moteurs d&apos;intelligence artificielle favoris (Google Gemini, DeepSeek, Anthropic Claude, Groq et OpenAI). Toutes vos clés sont enregistrées <strong style={{ color: 'var(--emerald)' }}>localement dans votre navigateur (localStorage)</strong> avec confidentialité maximale.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap" style={{ background: 'var(--bg-glass)', padding: '0.65rem 1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    <ShieldCheck size={18} style={{ color: 'var(--emerald)' }} />
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)' }}>Stockage Sécurisé 100% Local</span>
                  </div>
                </div>

                {/* Quick Access Portal Toolbar */}
                <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center gap-2 flex-wrap">
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Globe size={14} /> Accès Direct aux Consoles :
                  </span>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', borderRadius: '8px', gap: '0.3rem', color: '#4285F4', borderColor: 'rgba(66, 133, 244, 0.3)' }}>
                    Google AI Studio <ExternalLink size={12} />
                  </a>
                  <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', borderRadius: '8px', gap: '0.3rem', color: '#00BA7C', borderColor: 'rgba(0, 186, 124, 0.3)' }}>
                    DeepSeek Console <ExternalLink size={12} />
                  </a>
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', borderRadius: '8px', gap: '0.3rem', color: '#D97706', borderColor: 'rgba(217, 119, 6, 0.3)' }}>
                    Anthropic Console <ExternalLink size={12} />
                  </a>
                  <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', borderRadius: '8px', gap: '0.3rem', color: '#F97316', borderColor: 'rgba(249, 115, 22, 0.3)' }}>
                    Groq Cloud <ExternalLink size={12} />
                  </a>
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', borderRadius: '8px', gap: '0.3rem', color: '#8B5CF6', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
                    OpenAI Console <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Grid of AI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 1. Google Gemini */}
                <div className="bento-card" style={{
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '430px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  backdropFilter: 'blur(12px)',
                  border: geminiKey ? '1.5px solid rgba(66, 133, 244, 0.4)' : '1px solid var(--border)',
                  boxShadow: geminiKey ? '0 8px 30px rgba(66, 133, 244, 0.06)' : 'none',
                  transition: 'all 0.3s ease',
                  padding: '1.5rem',
                  borderRadius: '1.25rem'
                }}>
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.15) 0%, rgba(26, 115, 232, 0.25) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#4285F4', border: '1px solid rgba(66, 133, 244, 0.3)'
                        }}>
                          <Sparkles size={22} />
                        </div>
                        <div>
                          <h4 style={{ fontWeight: 800, fontSize: '0.98rem', margin: 0, color: 'var(--text-main)' }}>Google Gemini</h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Moteur Général & Imagen 3</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '2rem',
                        background: geminiKey ? 'rgba(66, 133, 244, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        color: geminiKey ? '#4285F4' : 'var(--text-muted)',
                        border: geminiKey ? '1px solid rgba(66, 133, 244, 0.3)' : '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: '0.3rem'
                      }}>
                        {geminiKey && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4285F4' }} className="animate-ping" />}
                        {geminiKey ? 'Configuré' : 'Non actif'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(66,133,244,0.1)', color: '#4285F4' }}>Gemini 3.1 Flash-Lite</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(66,133,244,0.1)', color: '#4285F4' }}>Gemini 3.5 Flash</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(66,133,244,0.1)', color: '#4285F4' }}>Gemini 3.8 Flash</span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                      Utilisé pour la génération des cours, résolutions pas-à-pas et la création de couvertures visuelles artistiques via Imagen 3.
                    </p>

                    {/* Direct Key Link Button */}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyBetween: 'center', gap: '0.4rem',
                        width: '100%', padding: '0.5rem 0.75rem', borderRadius: '10px', fontSize: '0.76rem', fontWeight: 700,
                        background: 'rgba(66, 133, 244, 0.06)', color: '#4285F4', border: '1px solid rgba(66, 133, 244, 0.25)',
                        marginBottom: '1rem', textDecoration: 'none', transition: 'all 0.2s ease'
                      }}
                      className="hover:bg-[rgba(66,133,244,0.12)]"
                    >
                      <ExternalLink size={14} /> Obtenir une clé sur Google AI Studio (Gratuit)
                    </a>

                    <div className="settings-field" style={{ marginBottom: '1rem' }}>
                      <label className="settings-label" style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>Clé API Gemini</label>
                      <div className="relative">
                        <input
                          type={showGeminiKey ? 'text' : 'password'}
                          className="input-control"
                          placeholder="AIzaSy..."
                          value={geminiKey}
                          onChange={e => setGeminiKey(e.target.value)}
                          style={{
                            paddingRight: '2.75rem', fontSize: '0.82rem', borderRadius: '10px',
                            fontFamily: geminiKey && !showGeminiKey ? 'monospace' : 'inherit',
                            borderColor: geminiKey ? 'rgba(66, 133, 244, 0.35)' : undefined
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowGeminiKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-[var(--text-main)] cursor-pointer bg-none border-none flex"
                        >
                          {showGeminiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <label style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.65rem 0.75rem', borderRadius: '10px',
                      background: geminiSolveSolutions ? 'rgba(66, 133, 244, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: geminiSolveSolutions ? '1px solid rgba(66, 133, 244, 0.4)' : '1px solid var(--border)',
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>Résoudre les exercices</span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-subtle)' }}>Calcul automatique des solutions</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={geminiSolveSolutions}
                        onChange={e => handleToggleGeminiSolve(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#4285F4' }}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={saveGeminiKey}
                    className="btn"
                    style={{
                      width: '100%', marginTop: '1.25rem', padding: '0.65rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700,
                      background: geminiKeySaved ? '#10B981' : 'linear-gradient(135deg, #4285F4 0%, #1D4ED8 100%)',
                      color: '#fff', border: 'none', boxShadow: 'none'
                    }}
                  >
                    {geminiKeySaved ? '✅ Configuration Enregistrée' : 'Enregistrer la clé Gemini'}
                  </button>
                </div>

                {/* 2. DeepSeek */}
                <div className="bento-card" style={{
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '430px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  backdropFilter: 'blur(12px)',
                  border: deepseekKey ? '1.5px solid rgba(0, 186, 124, 0.4)' : '1px solid var(--border)',
                  boxShadow: deepseekKey ? '0 8px 30px rgba(0, 186, 124, 0.06)' : 'none',
                  transition: 'all 0.3s ease',
                  padding: '1.5rem',
                  borderRadius: '1.25rem'
                }}>
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(0, 186, 124, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#00BA7C', border: '1px solid rgba(0, 186, 124, 0.3)'
                        }}>
                          <Cpu size={22} />
                        </div>
                        <div>
                          <h4 style={{ fontWeight: 800, fontSize: '0.98rem', margin: 0, color: 'var(--text-main)' }}>DeepSeek API</h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Moteur Raisonnement (R1) & V3</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '2rem',
                        background: deepseekKey ? 'rgba(0, 186, 124, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        color: deepseekKey ? '#00BA7C' : 'var(--text-muted)',
                        border: deepseekKey ? '1px solid rgba(0, 186, 124, 0.3)' : '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: '0.3rem'
                      }}>
                        {deepseekKey && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00BA7C' }} className="animate-ping" />}
                        {deepseekKey ? 'Configuré' : 'Non actif'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(0,186,124,0.1)', color: '#00BA7C' }}>DeepSeek-V3</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(0,186,124,0.1)', color: '#00BA7C' }}>Reasoner R1</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(0,186,124,0.1)', color: '#00BA7C' }}>Ultra-Économique</span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                      Moteur haute performance et ultra-économique pour l&apos;importation automatique de sujets de concours et raisonnement poussé.
                    </p>

                    {/* Direct Key Link Button */}
                    <a
                      href="https://platform.deepseek.com/api_keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        width: '100%', padding: '0.5rem 0.75rem', borderRadius: '10px', fontSize: '0.76rem', fontWeight: 700,
                        background: 'rgba(0, 186, 124, 0.06)', color: '#00BA7C', border: '1px solid rgba(0, 186, 124, 0.25)',
                        marginBottom: '1rem', textDecoration: 'none', transition: 'all 0.2s ease'
                      }}
                      className="hover:bg-[rgba(0,186,124,0.12)]"
                    >
                      <ExternalLink size={14} /> Obtenir une clé sur DeepSeek Platform
                    </a>

                    <div className="settings-field" style={{ marginBottom: '0.75rem' }}>
                      <label className="settings-label" style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>Clé API DeepSeek</label>
                      <div className="relative">
                        <input
                          type={showDeepseekKey ? 'text' : 'password'}
                          className="input-control"
                          placeholder="sk-..."
                          value={deepseekKey}
                          onChange={e => setDeepseekKey(e.target.value)}
                          style={{
                            paddingRight: '2.75rem', fontSize: '0.82rem', borderRadius: '10px',
                            fontFamily: deepseekKey && !showDeepseekKey ? 'monospace' : 'inherit',
                            borderColor: deepseekKey ? 'rgba(0, 186, 124, 0.35)' : undefined
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowDeepseekKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-[var(--text-main)] cursor-pointer bg-none border-none flex"
                        >
                          {showDeepseekKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div className="settings-field" style={{ marginBottom: '0.75rem' }}>
                      <label className="settings-label" style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>Base URL (Endpoint)</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="https://api.deepseek.com"
                        value={deepseekUrl}
                        onChange={e => setDeepseekUrl(e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '0.82rem', borderRadius: '10px' }}
                      />
                    </div>

                    <label style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.65rem 0.75rem', borderRadius: '10px',
                      background: deepseekSolveSolutions ? 'rgba(0, 186, 124, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: deepseekSolveSolutions ? '1px solid rgba(0, 186, 124, 0.4)' : '1px solid var(--border)',
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>Résoudre les exercices</span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-subtle)' }}>Activer le raisonnement automatique</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={deepseekSolveSolutions}
                        onChange={e => handleToggleDeepseekSolve(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#00BA7C' }}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={saveDeepseekKey}
                    className="btn"
                    style={{
                      width: '100%', marginTop: '1.25rem', padding: '0.65rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700,
                      background: deepseekKeySaved ? '#10B981' : 'linear-gradient(135deg, #00BA7C 0%, #059669 100%)',
                      color: '#fff', border: 'none', boxShadow: 'none'
                    }}
                  >
                    {deepseekKeySaved ? '✅ Configuration Enregistrée' : 'Enregistrer la clé DeepSeek'}
                  </button>
                </div>

                {/* 3. Anthropic Claude */}
                <div className="bento-card" style={{
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '430px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  backdropFilter: 'blur(12px)',
                  border: apiKey ? '1.5px solid rgba(217, 119, 6, 0.4)' : '1px solid var(--border)',
                  boxShadow: apiKey ? '0 8px 30px rgba(217, 119, 6, 0.06)' : 'none',
                  transition: 'all 0.3s ease',
                  padding: '1.5rem',
                  borderRadius: '1.25rem'
                }}>
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15) 0%, rgba(180, 83, 9, 0.25) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#D97706', border: '1px solid rgba(217, 119, 6, 0.3)'
                        }}>
                          <KeyRound size={22} />
                        </div>
                        <div>
                          <h4 style={{ fontWeight: 800, fontSize: '0.98rem', margin: 0, color: 'var(--text-main)' }}>Anthropic Claude</h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Extraction Visuelle OCR & QCM</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '2rem',
                        background: apiKey ? 'rgba(217, 119, 6, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        color: apiKey ? '#D97706' : 'var(--text-muted)',
                        border: apiKey ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: '0.3rem'
                      }}>
                        {apiKey && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D97706' }} className="animate-ping" />}
                        {apiKey ? 'Configuré' : 'Non actif'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(217,119,6,0.1)', color: '#D97706' }}>Claude 3.5 Sonnet</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(217,119,6,0.1)', color: '#D97706' }}>Opus</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(217,119,6,0.1)', color: '#D97706' }}>Vision OCR</span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                      Moteur pour le découpage et l&apos;analyse intelligente des sujets de concours PDF et conversion en questions QCM.
                    </p>

                    {/* Direct Key Link Button */}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        width: '100%', padding: '0.5rem 0.75rem', borderRadius: '10px', fontSize: '0.76rem', fontWeight: 700,
                        background: 'rgba(217, 119, 6, 0.06)', color: '#D97706', border: '1px solid rgba(217, 119, 6, 0.25)',
                        marginBottom: '1rem', textDecoration: 'none', transition: 'all 0.2s ease'
                      }}
                      className="hover:bg-[rgba(217,119,6,0.12)]"
                    >
                      <ExternalLink size={14} /> Obtenir une clé sur Anthropic Console
                    </a>

                    <div className="settings-field" style={{ marginBottom: '0.75rem' }}>
                      <label className="settings-label" style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>Clé API Claude</label>
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          className="input-control"
                          placeholder="sk-ant-api03-..."
                          value={apiKey}
                          onChange={e => setApiKey(e.target.value)}
                          style={{
                            paddingRight: '2.75rem', fontSize: '0.82rem', borderRadius: '10px',
                            fontFamily: apiKey && !showKey ? 'monospace' : 'inherit',
                            borderColor: apiKey ? 'rgba(217, 119, 6, 0.35)' : undefined
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-[var(--text-main)] cursor-pointer bg-none border-none flex"
                        >
                          {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div className="settings-field" style={{ marginBottom: '0.75rem' }}>
                      <label className="settings-label" style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>Proxy Server (Optionnel)</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="https://proxy.example.com"
                        value={proxyUrl}
                        onChange={e => setProxyUrl(e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '0.82rem', borderRadius: '10px' }}
                      />
                    </div>

                    <label style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.65rem 0.75rem', borderRadius: '10px',
                      background: claudeSolveSolutions ? 'rgba(217, 119, 6, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: claudeSolveSolutions ? '1px solid rgba(217, 119, 6, 0.4)' : '1px solid var(--border)',
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>Résoudre les exercices</span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-subtle)' }}>Génération automatique du corrigé</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={claudeSolveSolutions}
                        onChange={e => handleToggleClaudeSolve(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#D97706' }}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={saveApiKey}
                    className="btn"
                    style={{
                      width: '100%', marginTop: '1.25rem', padding: '0.65rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700,
                      background: keySaved ? '#10B981' : 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
                      color: '#fff', border: 'none', boxShadow: 'none'
                    }}
                  >
                    {keySaved ? '✅ Configuration Enregistrée' : 'Enregistrer la clé Claude'}
                  </button>
                </div>

                {/* 4. Groq AI */}
                <div className="bento-card" style={{
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '430px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  backdropFilter: 'blur(12px)',
                  border: groqKey ? '1.5px solid rgba(249, 115, 22, 0.4)' : '1px solid var(--border)',
                  boxShadow: groqKey ? '0 8px 30px rgba(249, 115, 22, 0.06)' : 'none',
                  transition: 'all 0.3s ease',
                  padding: '1.5rem',
                  borderRadius: '1.25rem'
                }}>
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(194, 65, 12, 0.25) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#F97316', border: '1px solid rgba(249, 115, 22, 0.3)'
                        }}>
                          <Zap size={22} />
                        </div>
                        <div>
                          <h4 style={{ fontWeight: 800, fontSize: '0.98rem', margin: 0, color: 'var(--text-main)' }}>Groq Cloud</h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Inférence Ultra-Rapide</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '2rem',
                        background: groqKey ? 'rgba(249, 115, 22, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        color: groqKey ? '#F97316' : 'var(--text-muted)',
                        border: groqKey ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: '0.3rem'
                      }}>
                        {groqKey && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F97316' }} className="animate-ping" />}
                        {groqKey ? 'Configuré' : 'Non actif'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>Llama 3.3 70B</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>DeepSeek-R1 Distill</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>800 t/s</span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                      Serveur d&apos;inférence ultra-rapide permettant de générer des QCM et des quiz en moins d&apos;une seconde.
                    </p>

                    {/* Direct Key Link Button */}
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        width: '100%', padding: '0.5rem 0.75rem', borderRadius: '10px', fontSize: '0.76rem', fontWeight: 700,
                        background: 'rgba(249, 115, 22, 0.06)', color: '#F97316', border: '1px solid rgba(249, 115, 22, 0.25)',
                        marginBottom: '1rem', textDecoration: 'none', transition: 'all 0.2s ease'
                      }}
                      className="hover:bg-[rgba(249,115,22,0.12)]"
                    >
                      <ExternalLink size={14} /> Obtenir une clé sur Groq Console (Gratuit)
                    </a>

                    <div className="settings-field" style={{ marginBottom: '1rem' }}>
                      <label className="settings-label" style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>Clé API Groq</label>
                      <div className="relative">
                        <input
                          type={showGroqKey ? 'text' : 'password'}
                          className="input-control"
                          placeholder="gsk_..."
                          value={groqKey}
                          onChange={e => setGroqKey(e.target.value)}
                          style={{
                            paddingRight: '2.75rem', fontSize: '0.82rem', borderRadius: '10px',
                            fontFamily: groqKey && !showGroqKey ? 'monospace' : 'inherit',
                            borderColor: groqKey ? 'rgba(249, 115, 22, 0.35)' : undefined
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowGroqKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-[var(--text-main)] cursor-pointer bg-none border-none flex"
                        >
                          {showGroqKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveGroqKey}
                    className="btn"
                    style={{
                      width: '100%', marginTop: '1.25rem', padding: '0.65rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700,
                      background: groqKeySaved ? '#10B981' : 'linear-gradient(135deg, #F97316 0%, #C2410C 100%)',
                      color: '#fff', border: 'none', boxShadow: 'none'
                    }}
                  >
                    {groqKeySaved ? '✅ Configuration Enregistrée' : 'Enregistrer la clé Groq'}
                  </button>
                </div>

                {/* 5. OpenAI */}
                <div className="bento-card" style={{
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '430px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  backdropFilter: 'blur(12px)',
                  border: openaiKey ? '1.5px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--border)',
                  boxShadow: openaiKey ? '0 8px 30px rgba(139, 92, 246, 0.06)' : 'none',
                  transition: 'all 0.3s ease',
                  padding: '1.5rem',
                  borderRadius: '1.25rem'
                }}>
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(109, 40, 217, 0.25) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#8B5CF6', border: '1px solid rgba(139, 92, 246, 0.3)'
                        }}>
                          <KeyRound size={22} />
                        </div>
                        <div>
                          <h4 style={{ fontWeight: 800, fontSize: '0.98rem', margin: 0, color: 'var(--text-main)' }}>OpenAI Platform</h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ChatGPT / GPT-4o & Vision</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '2rem',
                        background: openaiKey ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        color: openaiKey ? '#8B5CF6' : 'var(--text-muted)',
                        border: openaiKey ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: '0.3rem'
                      }}>
                        {openaiKey && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8B5CF6' }} className="animate-ping" />}
                        {openaiKey ? 'Configuré' : 'Non actif'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>GPT-4o</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>GPT-4o-mini</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>Vision</span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                      Modèles de référence pour l&apos;analyse textuelle, l&apos;explication pédagogique et la synthèse de cours.
                    </p>

                    {/* Direct Key Link Button */}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        width: '100%', padding: '0.5rem 0.75rem', borderRadius: '10px', fontSize: '0.76rem', fontWeight: 700,
                        background: 'rgba(139, 92, 246, 0.06)', color: '#8B5CF6', border: '1px solid rgba(139, 92, 246, 0.25)',
                        marginBottom: '1rem', textDecoration: 'none', transition: 'all 0.2s ease'
                      }}
                      className="hover:bg-[rgba(139,92,246,0.12)]"
                    >
                      <ExternalLink size={14} /> Obtenir une clé sur OpenAI Platform
                    </a>

                    <div className="settings-field" style={{ marginBottom: '1rem' }}>
                      <label className="settings-label" style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>Clé API OpenAI</label>
                      <div className="relative">
                        <input
                          type={showOpenaiKey ? 'text' : 'password'}
                          className="input-control"
                          placeholder="sk-proj-..."
                          value={openaiKey}
                          onChange={e => setOpenaiKey(e.target.value)}
                          style={{
                            paddingRight: '2.75rem', fontSize: '0.82rem', borderRadius: '10px',
                            fontFamily: openaiKey && !showOpenaiKey ? 'monospace' : 'inherit',
                            borderColor: openaiKey ? 'rgba(139, 92, 246, 0.35)' : undefined
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowOpenaiKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-[var(--text-main)] cursor-pointer bg-none border-none flex"
                        >
                          {showOpenaiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveOpenaiKey}
                    className="btn"
                    style={{
                      width: '100%', marginTop: '1.25rem', padding: '0.65rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700,
                      background: openaiKeySaved ? '#10B981' : 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                      color: '#fff', border: 'none', boxShadow: 'none'
                    }}
                  >
                    {openaiKeySaved ? '✅ Configuration Enregistrée' : 'Enregistrer la clé OpenAI'}
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* ── BRANDING & PROFIL TAB ── */}
          {activeTab === 'general' && (
            <div className="flex flex-col gap-6">
              
              {/* Profile Card (Identité du Directeur & Enseignant) */}
              <div className="bento-card flex flex-col justify-between">
                <div>
                  
                  {/* Card Header & Sub-Tab Switcher */}
                  <div className="flex items-center justify-between gap-4 mb-5 flex-wrap pb-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[var(--violet-soft)] border border-[var(--violet)] flex items-center justify-center text-[var(--violet)]">
                        <Crown size={20} />
                      </div>
                      <div>
                        <h2 className="settings-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                          Profil du Directeur & Enseignant
                        </h2>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                          (Fiche d'identité et coordonnées)
                        </span>
                      </div>
                    </div>

                    {/* Pill Sub-Tabs Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-glass)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      {[
                        { id: 'contact', label: '1. Contact & Identité', icon: Pencil },
                        { id: 'school', label: '2. Établissement', icon: School },
                        { id: 'pedagogy', label: '3. Pédagogie & Web', icon: BookOpen },
                      ].map(subTab => {
                        const isActive = profileSubTab === subTab.id;
                        return (
                          <button
                            key={subTab.id}
                            type="button"
                            onClick={() => setProfileSubTab(subTab.id)}
                            style={{
                              padding: '0.45rem 0.85rem',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              background: isActive ? 'var(--violet)' : 'transparent',
                              color: isActive ? '#ffffff' : 'var(--text-muted)',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              boxShadow: isActive ? '0 2px 8px var(--violet-glow)' : 'none'
                            }}
                          >
                            <subTab.icon size={13} />
                            {subTab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sub-Tab 1: Contact & Identité */}
                  {profileSubTab === 'contact' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="settings-field">
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Nom et Prénom du Directeur / Enseignant *
                        </label>
                        <input className="input-control" dir="auto" placeholder="Ex: Prof. Mohamed Benali" value={profName} onChange={e => setProfName(e.target.value)} />
                      </div>
                      <div className="settings-field">
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Téléphone / WhatsApp *
                        </label>
                        <input className="input-control" dir="auto" placeholder="Ex: +212 661 234 567" value={profPhone} onChange={e => setProfPhone(e.target.value)} />
                      </div>
                      <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Adresse Email Professionnelle
                        </label>
                        <input type="email" className="input-control" dir="auto" placeholder="Ex: prof.benali@taalim.ma" value={profEmail} onChange={e => setProfEmail(e.target.value)} />
                      </div>
                    </div>
                  )}

                  {/* Sub-Tab 2: Établissement & Ministère */}
                  {profileSubTab === 'school' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Nom de l&apos;Établissement / École *
                        </label>
                        <input className="input-control" dir="auto" placeholder="Ex: Lycée Qualifiant Ibn Khaldoun" value={profSchool} onChange={e => setProfSchool(e.target.value)} />
                      </div>
                      <div className="settings-field">
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Direction Provinciale *
                        </label>
                        <input className="input-control" dir="auto" placeholder="Ex: Direction Provinciale de Rabat" value={profDirection} onChange={e => setProfDirection(e.target.value)} />
                      </div>
                      <div className="settings-field">
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Académie Régionale - AREF *
                        </label>
                        <input className="input-control" dir="auto" placeholder="Ex: AREF Rabat-Salé-Kénitra" value={profAcademy} onChange={e => setProfAcademy(e.target.value)} />
                      </div>
                      <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Ville / Commune
                        </label>
                        <input className="input-control" dir="auto" placeholder="Ex: Rabat" value={profCity} onChange={e => setProfCity(e.target.value)} />
                      </div>
                    </div>
                  )}

                  {/* Sub-Tab 3: Données Pédagogiques & Web */}
                  {profileSubTab === 'pedagogy' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="settings-field">
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Matière / Discipline
                        </label>
                        <input className="input-control" dir="auto" placeholder="Ex: Mathématiques / PC / SVT" value={profSubject} onChange={e => setProfSubject(e.target.value)} />
                      </div>
                      <div className="settings-field">
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Matricule SOM / N° PPA
                        </label>
                        <input className="input-control" dir="auto" placeholder="Ex: 1548923" value={profSOM} onChange={e => setProfSOM(e.target.value)} />
                      </div>
                      <div className="settings-field">
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Année Scolaire
                        </label>
                        <input className="input-control" dir="auto" placeholder="Ex: 2025/2026" value={profAcademicYear} onChange={e => setProfAcademicYear(e.target.value)} />
                      </div>
                      <div className="settings-field">
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          ID Pixel Facebook (Facebook Pixel ID)
                        </label>
                        <input
                          type="text"
                          dir="auto"
                          className="input-control"
                          placeholder="Ex: 123456789012345"
                          value={fbPixelId}
                          onChange={e => setFbPixelId(e.target.value)}
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="settings-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'none' }}>
                          Site web officiel
                        </label>
                        <input className="input-control" dir="auto" placeholder="www.lconq.ma" value={profSite} onChange={e => setProfSite(e.target.value)} />
                      </div>
                    </div>
                  )}

                </div>

                {/* Save Action Row */}
                <div className="flex justify-between items-center gap-4 mt-6 pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    {brandSaved ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--emerald)]">
                        <CheckCircle2 size={16} /> Identité enregistrée avec succès !
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-[var(--text-subtle)]">
                        Alimente automatiquement vos en-têtes officiels
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={saveBranding} className="btn" style={{ padding: '0.65rem 1.75rem', borderRadius: '12px', fontWeight: 800 }}>
                    Enregistrer l&apos;identité
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ── SAUVEGARDE & OMR TAB ── */}
          {activeTab === 'backup_omr' && (
            <div className="flex flex-col gap-6">
              
              {/* Backup & Restore Data Card */}
              <div className="bento-card settings-backup-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-[var(--emerald-soft)] border border-[var(--emerald)] flex items-center justify-center text-[var(--emerald)]">
                      <Download size={20} />
                    </div>
                    <div>
                      <h2 className="settings-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                        Sauvegarde et Restauration des données
                      </h2>
                    </div>
                  </div>
                  
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                    Sauvegardez une copie complète de toutes les classes, notes, devoirs, clés et leçons dans un fichier (.json), ou restaurez-la à tout moment en un clic.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="btn"
                      style={{
                        padding: '0.85rem 1.25rem', borderRadius: '12px', fontSize: '0.88rem', fontWeight: 800,
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      <Download size={18} /> Exporter une sauvegarde globale (.json)
                    </button>

                    <label
                      style={{
                        padding: '0.85rem 1.25rem', borderRadius: '12px', fontSize: '0.88rem', fontWeight: 800,
                        background: 'var(--bg-glass)', color: 'var(--text-main)', border: '1.5px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Upload size={18} /> Restaurer une sauvegarde depuis un fichier (.json)
                      <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: '1.75rem', padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                  🛡️ Sauvegarde complète : inclut l'intégralité des données, élèves, notes et clés dans un fichier sécurisé.
                </div>
              </div>

              {/* OMR Scanner - prominent card below */}
              <div className="bento-card">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-[var(--violet-soft)] border border-[var(--violet)] flex items-center justify-center text-[var(--violet)]">
                        <Camera size={20} />
                      </div>
                      <h2 className="settings-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                        Scanner OMR Intelligent
                      </h2>
                    </div>
                    <p className="settings-desc" style={{ margin: 0 }}>
                      Activez le mode continu pour capturer automatiquement les feuilles QCM dès qu&apos;elles sont détectées par la caméra, sans clic manuel.
                    </p>
                  </div>
                  
                  <div className="omr-control-card">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-3">
                        <div className={`omr-status-indicator ${scannerDirectCapture ? 'active' : ''}`}></div>
                        <div>
                          <p className="font-bold text-sm text-[var(--text-main)] m-0">Tir direct par caméra</p>
                          <p className="text-xs text-[var(--text-subtle)] m-0">Capture continue sans clic</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newVal = !scannerDirectCapture;
                          setScannerDirectCapture(newVal);
                          await updateOmrScannerSettingsConfig({ scannerDirectCapture: newVal });
                          setScannerSaved(true);
                          setTimeout(() => setScannerSaved(false), 2000);
                        }}
                        className={`modern-switch ${scannerDirectCapture ? 'active' : ''}`}
                      >
                        <div className="modern-switch-knob" />
                      </button>
                    </div>
                    {scannerSaved && (
                      <div className="omr-feedback-toast">
                        Configuration OMR mise à jour
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── LOGBOOK TAB ── */}
          {activeTab === 'logbook' && (
            <div className="bento-card">
              <h2 className="settings-title">
                <BookOpen size={22} className="text-[var(--violet)]" /> Cahier de Textes
              </h2>
              <p className="settings-desc">
                Configurez votre emploi du temps hebdomadaire, les vacances scolaires et le style d&apos;impression du cahier de textes.
              </p>

              {/* Sub-tabs - Segmented Control style */}
              <div className="logbook-subtabs-bar">
                {[
                  { id: 'timetable', label: 'Emploi du temps', icon: Calendar },
                  { id: 'holidays',  label: 'Vacances scolaires', icon: Palmtree },
                  { id: 'style',    label: 'Style du PDF', icon: Sliders },
                ].map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setLogbookSubTab(st.id)}
                    className={`logbook-subtab-btn ${logbookSubTab === st.id ? 'active' : ''}`}
                  >
                    <st.icon size={14} />
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>

              {/* Timetable Subtab */}
              {logbookSubTab === 'timetable' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-[var(--text-subtle)] mb-2">
                    Sélectionnez la classe et spécifiez la salle pour chaque créneau horaire afin de générer automatiquement les séances quotidiennes dans le cahier de textes :
                  </p>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-glass)] p-3" style={{ overflow: 'auto' }}>
                    <table className="timetable-table">
                      <thead>
                        <tr>
                          <th className="timetable-top-left-hdr" style={{ width: 110 }}>Jour</th>
                          {TIME_SLOTS.map(slot => (
                            <th key={slot.id} className="timetable-hdr">{slot.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {WEEKDAYS.map(d => (
                          <tr key={d.id}>
                            <td className="timetable-time-cell">
                              {d.label}
                            </td>
                            {TIME_SLOTS.map(slot => {
                              const key = `${d.label}-${slot.id}`;
                              const cell = logbookSchedule[key] || {};
                              const isActive = !!cell.classId;
                              
                              const classColors = getSoftColorForClass(cell.classId);

                              return (
                                <td key={slot.id} className="timetable-slot-cell">
                                  <div
                                    className={`timetable-card ${isActive ? 'active' : 'free'}`}
                                    style={isActive ? {
                                      backgroundColor: classColors.bg,
                                      borderColor: 'transparent',
                                      color: classColors.text,
                                      boxShadow: 'none'
                                    } : {}}
                                  >
                                    {isActive ? (
                                      <>
                                        <button
                                          type="button"
                                          className="timetable-delete-btn"
                                          onClick={() => {
                                            handleLogbookScheduleChange(key, 'classId', '');
                                            handleLogbookScheduleChange(key, 'room', '');
                                          }}
                                          title="Libérer ce créneau"
                                          style={{
                                            color: classColors.text,
                                            background: 'transparent',
                                            borderColor: 'transparent'
                                          }}
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                        
                                        <select
                                          className="timetable-select"
                                          value={cell.classId || ''}
                                          onChange={e => handleLogbookScheduleChange(key, 'classId', e.target.value)}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: classColors.text,
                                            padding: '0.2rem 0',
                                            fontWeight: 800,
                                            boxShadow: 'none'
                                          }}
                                        >
                                          <option value="">-- Libre --</option>
                                          {classes.map(c => (
                                            <option key={c.id} value={c.name} style={{ color: 'var(--text-main)', background: 'var(--bg-card)' }}>{c.name}</option>
                                          ))}
                                        </select>
                                      </>
                                    ) : (
                                      <div className="timetable-free-hover-trigger">
                                        <div className="timetable-plus-icon">
                                          <Plus size={14} />
                                        </div>
                                        <select
                                          className="timetable-select-free"
                                          value=""
                                          onChange={e => handleLogbookScheduleChange(key, 'classId', e.target.value)}
                                        >
                                          <option value="">+ Ajouter</option>
                                          {classes.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Holidays Subtab */}
              {logbookSubTab === 'holidays' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <p className="text-xs text-[var(--text-subtle)]">
                      Enregistrez les vacances scolaires pour les refléter dans le cahier de textes et les exclure des alertes de séances manquantes :
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={loadMoroccanOfficialHolidays}
                        className="btn flex items-center gap-1.5 py-1.5 px-3 text-xs bg-[rgba(16,185,129,0.1)] text-[var(--emerald)] border border-[var(--emerald)] hover:bg-[rgba(16,185,129,0.2)] transition-all duration-200 rounded-lg font-bold"
                        title="Charger la liste officielle des vacances scolaires au Maroc"
                      >
                        <Sparkles size={13} />
                        <span>العطل الرسمية (المغرب)</span>
                      </button>
                      <label className="btn flex items-center gap-1.5 py-1.5 px-3 text-xs cursor-pointer bg-[var(--violet-soft)] text-[var(--violet)] border border-[var(--violet)] hover:bg-[var(--violet-soft)] transition-all duration-200 rounded-lg">
                        <Upload size={13} />
                        Importer ICS
                        <input
                          type="file"
                          accept=".ics"
                          style={{ display: 'none' }}
                          onChange={handleIcsUpload}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[var(--bg-glass)] p-4 rounded-xl border border-[var(--border)] items-end">
                    <div className="settings-field">
                      <label className="settings-label">Nom des vacances</label>
                      <input type="text" dir="auto" className="input-control" placeholder="Ex: Vacances de fin de semestre" value={newHolLabel} onChange={e => setNewHolLabel(e.target.value)} />
                    </div>
                    <div className="settings-field">
                      <label className="settings-label">Date de début</label>
                      <input type="date" className="input-control" value={newHolStart} onChange={e => setNewHolStart(e.target.value)} style={{ direction: 'ltr', textAlign: 'center' }} />
                    </div>
                    <div className="settings-field">
                      <label className="settings-label">Date de fin</label>
                      <input type="date" className="input-control" value={newHolEnd} onChange={e => setNewHolEnd(e.target.value)} style={{ direction: 'ltr', textAlign: 'center' }} />
                    </div>
                    <button
                      type="button"
                      onClick={addHoliday}
                      className="btn flex items-center gap-1 py-3 px-6 whitespace-nowrap"
                    >
                      <Plus size={16} /> Ajouter
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    {[...logbookHolidays]
                      .sort((a, b) => a.startDate.localeCompare(b.startDate))
                      .map(h => {
                        const isArabic = isArabicText(h.label);
                        const isEditing = editingHolId === h.id;

                        if (isEditing) {
                          return (
                            <div key={h.id} className="flex flex-col gap-3 p-4 rounded-xl border border-[var(--violet)] bg-[var(--bg-glass)] transition-all duration-200" style={{ marginBottom: '0.5rem' }}>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="settings-field">
                                  <label className="settings-label text-xs">Nom des vacances</label>
                                  <input 
                                    type="text" 
                                    className="input-control" 
                                    value={editingHolLabel} 
                                    onChange={e => setEditingHolLabel(e.target.value)} 
                                    dir={isArabicText(editingHolLabel) ? 'rtl' : 'ltr'}
                                  />
                                </div>
                                <div className="settings-field">
                                  <label className="settings-label text-xs">Date de début</label>
                                  <input 
                                    type="date" 
                                    className="input-control" 
                                    value={editingHolStart} 
                                    onChange={e => setEditingHolStart(e.target.value)} 
                                    style={{ direction: 'ltr', textAlign: 'center' }} 
                                  />
                                </div>
                                <div className="settings-field">
                                  <label className="settings-label text-xs">Date de fin</label>
                                  <input 
                                    type="date" 
                                    className="input-control" 
                                    value={editingHolEnd} 
                                    onChange={e => setEditingHolEnd(e.target.value)} 
                                    style={{ direction: 'ltr', textAlign: 'center' }} 
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingHolId(null)}
                                  className="btn bg-[var(--border)] text-[var(--text-main)] border border-[var(--border)] hover:bg-[var(--bg-glass)] py-1.5 px-4"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!editingHolLabel || !editingHolStart || !editingHolEnd) return;
                                    setLogbookHolidays(prev => prev.map(hol => hol.id === h.id ? { ...hol, label: editingHolLabel, startDate: editingHolStart, endDate: editingHolEnd } : hol));
                                    setEditingHolId(null);
                                  }}
                                  className="btn py-1.5 px-4"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  Enregistrer
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={h.id} className="flex justify-between items-center p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] transition-all duration-200 gap-3" style={{ marginBottom: '0.5rem' }}>
                            <div className="flex items-center gap-3" style={{ flex: 1, minWidth: 0, flexDirection: isArabic ? 'row-reverse' : 'row' }}>
                              <div className="w-10 h-10 rounded-xl bg-[var(--violet-soft)] border border-[var(--violet)] flex items-center justify-center text-[var(--violet)] flex-shrink-0">
                                <span className="text-lg">🌴</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0, textAlign: isArabic ? 'right' : 'left', direction: isArabic ? 'rtl' : 'ltr' }}>
                                <strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.2rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                  {h.label}
                                </strong>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-subtle)', flexWrap: 'wrap' }}>
                                  <Calendar size={13} className="text-[var(--violet)] flex-shrink-0" />
                                  {isArabic ? (
                                    <span>من <strong>{h.startDate}</strong> إلى <strong>{h.endDate}</strong></span>
                                  ) : (
                                    <span>Du <strong>{h.startDate}</strong> au <strong>{h.endDate}</strong></span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingHolId(h.id);
                                  setEditingHolLabel(h.label);
                                  setEditingHolStart(h.startDate);
                                  setEditingHolEnd(h.endDate);
                                }}
                                className="timetable-delete-btn"
                                style={{ position: 'static', opacity: 1, color: 'var(--violet)' }}
                                title="Modifier"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeHoliday(h.id)}
                                className="timetable-delete-btn"
                                style={{ position: 'static', opacity: 1 }}
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {logbookHolidays.length === 0 && (
                      <div className="text-center p-8 text-[var(--text-subtle)] text-xs">
                        🌴 Aucune vacance scolaire enregistrée pour le moment.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Style Subtab */}
              {logbookSubTab === 'style' && (
                <div className="flex flex-col gap-5">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="settings-field">
                      <label className="settings-label">Police de la langue arabe</label>
                      <select className="input-control" value={logbookArFont} onChange={e => setLogbookArFont(e.target.value)}>
                        <option value="UKIJ Merdane">UKIJ Merdane (classique)</option>
                        <option value="Noto Naskh Arabic">Noto Naskh Arabic</option>
                        <option value="Amiri">Amiri (académique)</option>
                        <option value="Tajawal">Tajawal (moderne)</option>
                        <option value="Cairo">Cairo</option>
                      </select>
                    </div>

                    <div className="settings-field">
                      <label className="settings-label">Police de la langue française</label>
                      <select className="input-control" value={logbookFrFont} onChange={e => setLogbookFrFont(e.target.value)}>
                        <option value="Outfit">Outfit (moderne)</option>
                        <option value="Inter">Inter (clair)</option>
                        <option value="Computer Modern Serif">Computer Modern Serif</option>
                        <option value="Times New Roman">Times New Roman</option>
                      </select>
                    </div>

                    <div className="settings-field">
                      <label className="settings-label">Taille de police de base</label>
                      <select className="input-control" value={logbookFontSize} onChange={e => setLogbookFontSize(e.target.value)}>
                        <option value="0.7rem">Petit (0.7rem)</option>
                        <option value="0.8rem">Normal (0.8rem)</option>
                        <option value="0.9rem">Grand (0.9rem)</option>
                        <option value="1rem">Très grand (1rem)</option>
                      </select>
                    </div>

                    <div className="settings-field">
                      <label className="settings-label">Hauteur de ligne (Line-height)</label>
                      <input
                        type="number" min={12} max={40}
                        className="input-control"
                        value={logbookLineHeight}
                        onChange={e => setLogbookLineHeight(parseInt(e.target.value, 10) || 20)}
                      />
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)] pt-5">
                    <h4 className="text-sm font-black text-[var(--text-main)] mb-3">Couleurs du cahier de textes</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Couleur du texte principal', value: logbookColorInk, setter: setLogbookColorInk },
                        { label: 'Couleur des chapitres', value: logbookColorChapter, setter: setLogbookColorChapter },
                        { label: 'Couleur des axes', value: logbookColorAxis, setter: setLogbookColorAxis },
                        { label: 'Couleur des exercices', value: logbookColorExercise, setter: setLogbookColorExercise },
                      ].map(({ label, value, setter }) => (
                        <div key={label} className="flex items-center gap-3 p-3 bg-[var(--bg-glass)] border border-[var(--border)] rounded-xl">
                          <input
                            type="color"
                            value={value}
                            onChange={e => setter(e.target.value)}
                            style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '6px' }}
                          />
                          <div>
                            <strong className="block text-xs text-[var(--text-main)]">{label}</strong>
                            <span className="block text-[10px] text-[var(--text-subtle)] font-mono">{value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* Action Save */}
              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-[var(--border)]" style={{ justifyContent: 'flex-end' }}>
                {logbookSaved && (
                  <div className="save-badge">
                    <CheckCircle2 size={14} /> Enregistré avec succès !
                  </div>
                )}
                <button
                  type="button"
                  disabled={isSavingLogbook}
                  onClick={saveLogbookSettings}
                  className="btn"
                  style={{
                    padding: '0.55rem 1.5rem',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    opacity: isSavingLogbook ? 0.7 : 1,
                    cursor: isSavingLogbook ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSavingLogbook ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    'Enregistrer'
                  )}
                </button>
              </div>
            </div>
          )}
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
}
