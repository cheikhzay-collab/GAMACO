import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Settings, School, KeyRound, Eye, EyeOff, CheckCircle2, Sparkles, RefreshCw, Layers, MousePointerClick, Crown, Download, Sliders, FileText, Camera, MessageCircle, Volume2, BookOpen, Calendar, Palmtree, Pencil, Upload, ExternalLink, ShieldCheck, Cpu, Zap, Globe, Loader2, Copy, RotateCcw, FileCode, Check, AlertTriangle } from 'lucide-react';
import { getAllClasses } from '../services/classService';
import {
  DEFAULT_EXAM_SYSTEM_PROMPT,
  DEFAULT_LESSON_SYSTEM_PROMPT,
  DEFAULT_EXTRACTOR_DIRECTIVES,
  getStoredExamPrompt,
  getStoredLessonPrompt,
  getStoredExtractorDirectives,
  saveExamPrompt,
  saveLessonPrompt,
  saveExtractorDirectives,
  resetExamPrompt,
  resetLessonPrompt,
  resetExtractorDirectives
} from '../utils/extractionPrompts';
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
    ministryLogo: initialMinistryLogo,
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
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem('deepseekApiKey') || '');
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

  // Dedicated AI Solver (Exams & Exercises) Provider & Model
  const [solverProvider, setSolverProvider] = useState(() => localStorage.getItem('ai_solver_provider') || 'auto');
  const [solverModel, setSolverModel] = useState(() => localStorage.getItem('ai_solver_model') || '');
  const [solverSaved, setSolverSaved] = useState(false);

  const SOLVER_MODELS_BY_PROVIDER = {
    gemini: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', tag: 'Le plus puissant pour les démonstrations' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tag: 'Rapide et équilibré (recommandé)' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', tag: 'Économique et très rapide' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', tag: 'Stable' },
      { id: 'gemini-pro-latest', label: 'Gemini Pro Latest', tag: 'Dernière version Pro' },
    ],
    deepseek: [
      { id: 'deepseek-reasoner', label: 'DeepSeek R1 (Reasoner)', tag: 'Optimal pour le raisonnement mathématique' },
      { id: 'deepseek-chat', label: 'DeepSeek V3 (Chat)', tag: 'Rapide et économique' },
    ],
    openai: [
      { id: 'o3-mini', label: 'OpenAI o3-mini', tag: 'Modèle de raisonnement avancé' },
      { id: 'o4-mini', label: 'OpenAI o4-mini', tag: 'Raisonnement moderne et rapide' },
      { id: 'gpt-4o', label: 'GPT-4o', tag: 'Haute précision polyvalente' },
      { id: 'gpt-4.1', label: 'GPT-4.1', tag: 'Dernier modèle texte' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', tag: 'Économique' },
    ],
    claude: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', tag: 'Le plus récent et précis en rédaction' },
      { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', tag: 'Raisonnement mathématique étendu' },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', tag: 'Stable et éprouvé' },
    ],
  };

  // AI Extraction Prompts & Custom Directives
  const [examPrompt, setExamPrompt] = useState(() => getStoredExamPrompt());
  const [lessonPrompt, setLessonPrompt] = useState(() => getStoredLessonPrompt());
  const [extractorDirectives, setExtractorDirectives] = useState(() => getStoredExtractorDirectives());
  const [promptsSaved, setPromptsSaved] = useState(false);
  const [activePromptSubTab, setActivePromptSubTab] = useState('exam');
  const [copiedField, setCopiedField] = useState(null);

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
        if (remoteSettings.solverProvider !== undefined) {
          setSolverProvider(remoteSettings.solverProvider || 'auto');
          localStorage.setItem('ai_solver_provider', remoteSettings.solverProvider || 'auto');
        }
        if (remoteSettings.solverModel !== undefined) {
          setSolverModel(remoteSettings.solverModel || '');
          localStorage.setItem('ai_solver_model', remoteSettings.solverModel || '');
        }
        if (remoteSettings.exam_extraction_prompt !== undefined) {
          setExamPrompt(remoteSettings.exam_extraction_prompt);
          saveExamPrompt(remoteSettings.exam_extraction_prompt);
        }
        if (remoteSettings.lesson_extraction_prompt !== undefined) {
          setLessonPrompt(remoteSettings.lesson_extraction_prompt);
          saveLessonPrompt(remoteSettings.lesson_extraction_prompt);
        }
        if (remoteSettings.extractor_custom_directives !== undefined) {
          setExtractorDirectives(remoteSettings.extractor_custom_directives);
          saveExtractorDirectives(remoteSettings.extractor_custom_directives);
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
      solverProvider: overrides.solverProvider !== undefined ? overrides.solverProvider : solverProvider,
      solverModel: overrides.solverModel !== undefined ? overrides.solverModel : solverModel.trim(),
      exam_extraction_prompt: overrides.exam_extraction_prompt !== undefined ? overrides.exam_extraction_prompt : examPrompt,
      lesson_extraction_prompt: overrides.lesson_extraction_prompt !== undefined ? overrides.lesson_extraction_prompt : lessonPrompt,
      extractor_custom_directives: overrides.extractor_custom_directives !== undefined ? overrides.extractor_custom_directives : extractorDirectives,
    };
    try {
      await saveAiSettingsConfig(payload);
    } catch (err) {
      console.warn('[AdminSettings] Failed to persist AI settings to DB:', err);
    }
  };

  const handleSavePromptsAndDirectives = async () => {
    saveExamPrompt(examPrompt);
    saveLessonPrompt(lessonPrompt);
    saveExtractorDirectives(extractorDirectives);
    await syncAiSettingsToDb({
      exam_extraction_prompt: examPrompt,
      lesson_extraction_prompt: lessonPrompt,
      extractor_custom_directives: extractorDirectives
    });
    setPromptsSaved(true);
    setTimeout(() => setPromptsSaved(false), 3000);
  };

  const handleResetExamPrompt = () => {
    if (window.confirm("Voulez-vous vraiment restaurer le prompt par défaut d'extraction des examens ?")) {
      const def = resetExamPrompt();
      setExamPrompt(def);
    }
  };

  const handleResetLessonPrompt = () => {
    if (window.confirm("Voulez-vous vraiment restaurer le prompt par défaut d'extraction des cours ?")) {
      const def = resetLessonPrompt();
      setLessonPrompt(def);
    }
  };

  const handleResetDirectives = () => {
    if (window.confirm('Voulez-vous vraiment restaurer les directives par défaut ?')) {
      const def = resetExtractorDirectives();
      setExtractorDirectives(def);
    }
  };

  const handleCopyText = (text, fieldName) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
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

  const saveSolverConfig = async (nextProvider = solverProvider, nextModel = solverModel) => {
    const cleanProv = (nextProvider || 'auto').trim();
    const cleanModel = cleanProv === 'auto' ? '' : (nextModel || '').trim();
    setSolverProvider(cleanProv);
    setSolverModel(cleanModel);
    localStorage.setItem('ai_solver_provider', cleanProv);
    localStorage.setItem('ai_solver_model', cleanModel);
    await syncAiSettingsToDb({ solverProvider: cleanProv, solverModel: cleanModel });
    setSolverSaved(true);
    setTimeout(() => setSolverSaved(false), 2500);
  };

  const handleSelectSolverProvider = (provId) => {
    setSolverProvider(provId);
    if (provId === 'auto') {
      setSolverModel('');
      return;
    }
    const presets = SOLVER_MODELS_BY_PROVIDER[provId] || [];
    const stillValid = presets.some(p => p.id === solverModel);
    if (!stillValid && presets.length > 0) {
      setSolverModel(presets[0].id);
    }
  };

  // ── Database Backup & Restore & Platform Reset ──────────────────────────────
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetIncludeConfig, setResetIncludeConfig] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Server Rolling Auto-Snapshots State
  const [snapshotsInfo, setSnapshotsInfo] = useState(null);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [restoringSnapshotFile, setRestoringSnapshotFile] = useState(null);
  const [snapshotNotice, setSnapshotNotice] = useState('');

  const fetchServerSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch('/api/admin/snapshots');
      if (res.ok) {
        const data = await res.json();
        setSnapshotsInfo(data);
      }
    } catch (err) {
      console.warn('[AdminSettings] Failed to load snapshots:', err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'backup_omr') {
      fetchServerSnapshots();
    }
  }, [activeTab]);

  const handleCreateServerSnapshot = async () => {
    setCreatingSnapshot(true);
    setSnapshotNotice('');
    try {
      const res = await fetch('/api/admin/snapshots/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'manual' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Échec de création');
      setSnapshotNotice(`✅ Sauvegarde instantanée enregistrée sur le serveur (${data.snapshot?.fileName})`);
      setTimeout(() => setSnapshotNotice(''), 4500);
      await fetchServerSnapshots();
    } catch (err) {
      alert('❌ ' + (err?.message || 'Impossible de créer la sauvegarde sur le serveur.'));
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleDownloadServerSnapshot = async (fileName) => {
    try {
      const res = await fetch(`/api/admin/snapshots/download?file=${encodeURIComponent(fileName)}`);
      if (!res.ok) throw new Error('Impossible de télécharger le fichier');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('❌ ' + (err?.message || 'Erreur téléchargement'));
    }
  };

  const handleRestoreServerSnapshot = async (fileName) => {
    if (!window.confirm(`Voulez-vous vraiment restaurer la sauvegarde « ${fileName} » dans la base de données MySQL ?\n\n(Une sauvegarde de sécurité de votre état actuel sera créée automatiquement avant la restauration)`)) {
      return;
    }
    setRestoringSnapshotFile(fileName);
    setSnapshotNotice('');
    try {
      const res = await fetch('/api/admin/snapshots/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Échec restauration');
      alert(`✅ Base de données restaurée avec succès depuis ${fileName} !\nCours : ${data.restored?.lessons || 0} | Classes : ${data.restored?.classes || 0} | Cahier de textes : ${data.restored?.logbook || 0}`);
      window.location.reload();
    } catch (err) {
      alert('❌ ' + (err?.message || 'La restauration a échoué.'));
    } finally {
      setRestoringSnapshotFile(null);
    }
  };

  const handleExportBackup = async () => {
    try {
      // 1. Fetch full server database (MySQL & JSON files)
      let serverBackup = null;
      try {
        const res = await fetch('/api/admin/backup-full');
        if (res.ok) serverBackup = await res.json();
      } catch (_) {}

      // 2. Collect localStorage items
      const localData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          localData[key] = localStorage.getItem(key);
        }
      }

      const fullBackup = {
        meta: {
          app: 'Gamaco Platform',
          exportedAt: new Date().toISOString(),
          version: '2.0'
        },
        server: serverBackup,
        localStorage: localData
      };

      const jsonStr = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `GAMACO_Sauvegarde_Complete_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export backup error:', e);
    }
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (typeof importedData !== 'object') throw new Error('Format de sauvegarde invalide');
        
        let count = 0;

        // If it's a full backup with server payload
        if (importedData.server && typeof importedData.server === 'object') {
          try {
            await fetch('/api/admin/restore-full', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(importedData.server)
            });
          } catch (srvErr) {
            console.warn('Server restore error:', srvErr);
          }
        }

        // Restore localStorage items
        const localSource = importedData.localStorage || importedData;
        Object.entries(localSource).forEach(([key, val]) => {
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

  const handleExecutePlatformReset = async () => {
    const cleaned = resetConfirmInput.trim().toUpperCase();
    if (cleaned !== 'RESET' && cleaned !== 'CONFIRMER' && resetConfirmInput.trim() !== 'تفريغ') {
      return;
    }
    setIsResetting(true);
    try {
      // 1. Call server API to wipe MySQL tables and persistent JSON files
      const res = await fetch('/api/admin/reset-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: 'RESET_PLATFORM',
          includeConfig: resetIncludeConfig
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la réinitialisation du serveur');
      }

      // 2. Wipe client-side localStorage data while preserving essential admin session
      const keysToKeep = ['token', 'user', 'theme'];
      if (!resetIncludeConfig) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('prof') || k.startsWith('bank') || k.includes('apiKey') || k.includes('settings'))) {
            keysToKeep.push(k);
          }
        }
      }

      const preserved = {};
      keysToKeep.forEach(k => {
        const val = localStorage.getItem(k);
        if (val !== null) preserved[k] = val;
      });

      localStorage.clear();

      Object.entries(preserved).forEach(([k, val]) => {
        localStorage.setItem(k, val);
      });

      // Clear common storage keys explicitly
      ['lconq_exams_db', 'lconq_lessons_db', 'lconq_classes_db', 'lconq_users_db', 'logbook_entries', 'lconq_offline_queue', 'progress', 'recent_tasks_v1'].forEach(k => {
        localStorage.removeItem(k);
      });

      setIsResetting(false);
      setResetSuccess(true);

      setTimeout(() => {
        window.location.href = '/admin';
      }, 1600);
    } catch (err) {
      setIsResetting(false);
      alert('Erreur: ' + err.message);
    }
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
  const [ministryLogo, setMinistryLogo] = useState(() => initialMinistryLogo || localStorage.getItem('ministryLogo') || '');
  const [ministryLogoSaved, setMinistryLogoSaved] = useState(false);
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
        if (cfg.ministryLogo !== undefined) setMinistryLogo(cfg.ministryLogo || '');
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
      if (initialMinistryLogo !== undefined && initialMinistryLogo !== '') setMinistryLogo(initialMinistryLogo);
    });
  }, [initialProfName, initialProfPhone, initialProfSchool, initialProfDirection, initialProfAcademy, initialProfSubject, initialProfSOM, initialProfEmail, initialProfAcademicYear, initialProfCity, initialProfSite, initialBankName, initialBankRIB, initialBankBeneficiary, initialFacebookPixelId, initialMinistryLogo]);

  const buildCurrentBrandingPayload = (overrideLogo = undefined) => ({
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
    fbPixelId: fbPixelId.trim(),
    ministryLogo: overrideLogo !== undefined ? overrideLogo : ministryLogo
  });

  const handleMinistryLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide (PNG, JPG, WebP ou SVG).');
      e.target.value = '';
      return;
    }

    const persistLogo = async (dataUrl) => {
      setMinistryLogo(dataUrl);
      await updateBrandingConfig(buildCurrentBrandingPayload(dataUrl));
      setMinistryLogoSaved(true);
      setTimeout(() => setMinistryLogoSaved(false), 3000);
    };

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result;
      if (typeof rawDataUrl !== 'string') return;

      // Keep crisp vector SVGs directly if compact
      if (file.type === 'image/svg+xml') {
        if (rawDataUrl.length > 260000) {
          alert('Le fichier SVG est trop volumineux (max 250 Ko).');
          return;
        }
        persistLogo(rawDataUrl);
        return;
      }

      // Downscale raster images proportionally for crisp print & fast storage
      const img = new Image();
      img.onload = () => {
        const maxW = 360;
        const maxH = 140;
        const scale = Math.min(1, maxW / (img.width || maxW), maxH / (img.height || maxH));
        const targetW = Math.max(1, Math.round((img.width || maxW) * scale));
        const targetH = Math.max(1, Math.round((img.height || maxH) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const compressedPng = canvas.toDataURL('image/png');
        persistLogo(compressedPng);
      };
      img.onerror = () => {
        alert('Impossible de lire cette image.');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleResetMinistryLogo = async () => {
    setMinistryLogo('');
    await updateBrandingConfig(buildCurrentBrandingPayload(''));
    setMinistryLogoSaved(true);
    setTimeout(() => setMinistryLogoSaved(false), 2500);
  };

  const saveBranding = async () => {
    await updateBrandingConfig(buildCurrentBrandingPayload());
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
      if (!window.confirm('Voulez-vous ajouter la liste officielle des vacances scolaires du Maroc à votre liste actuelle ?')) {
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
        setSyncSuccessMsg(`✓ Emploi du temps (${res.scheduleSlots} créneaux) et tous les paramètres synchronisés dans le cloud avec succès !`);
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
        setSyncSuccessMsg('⚠️ Synchronisation terminée avec quelques remarques : ' + (res.error || ''));
      }
    } catch (e) {
      setSyncSuccessMsg('❌ Erreur lors de la synchronisation : ' + (e.message || ''));
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
            title="Synchronisation complète de l'emploi du temps et de tous les paramètres dans le cloud et en local"
          >
            <RefreshCw size={14} className={syncingAll ? 'animate-spin' : ''} />
            <span>{syncingAll ? 'Synchronisation...' : "Synchroniser Cloud & Emploi du temps"}</span>
          </button>
          <div className="flex flex-col items-center px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl min-w-[75px]">
            <span className="text-lg font-black text-[var(--text-main)]">{(classes || []).length}</span>
            <span className="text-[10px] text-[var(--text-subtle)] font-bold uppercase tracking-wider">Classes</span>
          </div>
        </div>
      </div>

      {syncSuccessMsg && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
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
                      <optgroup label="✍️ Polices Manuscrites &amp; Cursives (Écriture à la main)">
                        <option value="Caveat">✍️ Caveat (Stylo plume fluide élégant)</option>
                        <option value="Patrick Hand">✍️ Patrick Hand (Manuscrit scolaire soigné)</option>
                        <option value="Kalam">✍️ Kalam (Écriture feutre / stylo bille)</option>
                        <option value="Marck Script">✍️ Marck Script (Cursive traditionnelle liée)</option>
                        <option value="Dancing Script">✍️ Dancing Script (Cursif calligraphique)</option>
                        <option value="Indie Flower">✍️ Indie Flower (Manuscrit naturel décontracté)</option>
                        <option value="Architects Daughter">✍️ Architects Daughter (Manuscrit d&apos;architecte net)</option>
                      </optgroup>
                      <optgroup label="📐 Polices Typographiques Classiques">
                        <option value="Computer Modern Serif">Computer Modern Serif (Scientifique LaTeX)</option>
                        <option value="STIX Two Text">STIX Two Text (Serif classique)</option>
                        <option value="Times New Roman">Times New Roman (Format Examen)</option>
                        <option value="Inter">Inter (Sans-Serif épurée)</option>
                      </optgroup>
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

              {/* ── DEDICATED SOLVER MODEL SELECTOR (EXAMS & EXERCISES) ── */}
              <div className="bento-card" style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(59, 130, 246, 0.06) 100%)',
                border: '1.5px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '1.25rem',
                padding: '1.6rem',
                boxShadow: '0 8px 30px rgba(16, 185, 129, 0.06)'
              }}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.28))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.35)'
                      }}>
                        <Cpu size={19} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                          Solveur IA dédié aux Examens &amp; Exercices
                        </h3>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Choisissez le fournisseur et le modèle par défaut pour résoudre les exercices, examens nationaux et DEVOIR PRIME
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                    padding: '0.45rem 0.9rem', borderRadius: '99px',
                    background: 'var(--bg-glass)', border: '1px solid var(--border)',
                    fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                    <span>
                      {solverProvider === 'auto'
                        ? 'Mode automatique intelligent (Cascade)'
                        : `${solverProvider.toUpperCase()} — ${solverModel || 'Par défaut'}`}
                    </span>
                  </div>
                </div>

                {/* Provider Selector Pills */}
                <div style={{ marginBottom: '1.15rem' }}>
                  <label className="settings-label" style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-subtle)', marginBottom: '0.5rem', display: 'block' }}>
                    1. Choisissez le fournisseur IA principal pour la résolution :
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      { id: 'auto', label: '⚡ Automatique intelligent (Auto)', color: '#6366f1', hasKey: true },
                      { id: 'deepseek', label: '🧠 DeepSeek (R1 / V3)', color: '#00BA7C', hasKey: Boolean(deepseekKey.trim()) },
                      { id: 'gemini', label: '✨ Google Gemini', color: '#4285F4', hasKey: Boolean(geminiKey.trim()) },
                      { id: 'openai', label: '🤖 OpenAI (o3 / GPT-4o)', color: '#8B5CF6', hasKey: Boolean(openaiKey.trim()) },
                      { id: 'claude', label: '🔑 Anthropic Claude', color: '#D97706', hasKey: Boolean(apiKey.trim()) },
                    ].map(p => {
                      const active = solverProvider === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectSolverProvider(p.id)}
                          style={{
                            padding: '0.55rem 0.95rem',
                            borderRadius: '10px',
                            border: `1.5px solid ${active ? p.color : 'var(--border)'}`,
                            background: active ? `${p.color}20` : 'var(--bg-glass)',
                            color: active ? p.color : 'var(--text-main)',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>{p.label}</span>
                          {p.id !== 'auto' && (
                            <span style={{
                              fontSize: '0.66rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '6px',
                              background: p.hasKey ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.12)',
                              color: p.hasKey ? '#10B981' : '#ef4444'
                            }}>
                              {p.hasKey ? '✓ Actif' : 'Sans clé'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Model Selector for chosen provider */}
                {solverProvider !== 'auto' ? (
                  <div style={{
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <label className="settings-label" style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-subtle)', marginBottom: '0.6rem', display: 'block' }}>
                      2. Choisissez le modèle exact dédié à la résolution :
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-3">
                      {(SOLVER_MODELS_BY_PROVIDER[solverProvider] || []).map(m => {
                        const isSelected = solverModel === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSolverModel(m.id)}
                            style={{
                              textAlign: 'left',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '10px',
                              border: `1.5px solid ${isSelected ? '#10B981' : 'var(--border)'}`,
                              background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.2rem',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: isSelected ? '#10B981' : 'var(--text-main)' }}>
                                {m.label}
                              </span>
                              {isSelected && <Check size={14} color="#10B981" />}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.tag}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="settings-field" style={{ marginBottom: 0 }}>
                      <label className="settings-label" style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                        Ou saisissez l&apos;identifiant du modèle manuellement (ID personnalisé) :
                      </label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="Ex: deepseek-reasoner, gemini-2.5-pro, o3-mini..."
                        value={solverModel}
                        onChange={e => setSolverModel(e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '0.82rem', borderRadius: '10px' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                    marginBottom: '1rem',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.55
                  }}>
                    💡 En mode <strong>Automatique</strong>, le système sélectionne le meilleur moteur actif disponible (avec bascule automatique vers le moteur de secours en cas de quota atteint ou de surcharge).
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => saveSolverConfig(solverProvider, solverModel)}
                    className="btn"
                    style={{
                      padding: '0.65rem 1.4rem',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      background: solverSaved ? '#10B981' : 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                      color: '#fff',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer'
                    }}
                  >
                    {solverSaved ? <Check size={16} /> : <Sparkles size={16} />}
                    <span>{solverSaved ? '✅ Modèle de résolution enregistré' : 'Enregistrer la configuration du solveur'}</span>
                  </button>
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
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(66,133,244,0.12)', color: '#4285F4' }}>Gemini 2.5 Flash (Recommandé)</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(66,133,244,0.12)', color: '#4285F4' }}>Gemini 2.5 Pro (Puissant en maths)</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(66,133,244,0.12)', color: '#4285F4' }}>Gemini 2.0 Flash</span>
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


              {/* ── SECTION: PROMPTS ET DIRECTIVES DE L'EXTRACTEUR (Extraction System Prompts & Custom Directives) ── */}
              <div className="bento-card" style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
                border: '1.5px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '1.25rem',
                padding: '1.75rem',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
                position: 'relative'
              }}>
                {/* Header with Icon, Title, and Description */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(99, 102, 241, 0.3) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--violet)', border: '1px solid rgba(139, 92, 246, 0.4)'
                      }}>
                        <FileCode size={20} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                          Prompts et directives de l&apos;extracteur intelligent
                        </h3>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Architecture des Prompts Système &amp; Directives d&apos;Extraction IA (QCM, Examens, Cours)
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6, maxWidth: '820px' }}>
                      Contrôlez avec précision le comportement des moteurs IA lors de l&apos;extraction de PDF et d&apos;images. Vous pouvez modifier le prompt de base des examens et QCM, celui des cours et synthèses, et ajouter des directives personnalisées appliquées automatiquement à toutes les extractions.
                    </p>
                  </div>

                  {/* Save Status / Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSavePromptsAndDirectives}
                      className="btn"
                      style={{
                        padding: '0.65rem 1.25rem',
                        borderRadius: '10px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        background: promptsSaved ? '#10B981' : 'linear-gradient(135deg, var(--violet) 0%, #4F46E5 100%)',
                        color: '#fff',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.25)',
                        cursor: 'pointer'
                      }}
                    >
                      {promptsSaved ? <Check size={16} /> : <Sparkles size={16} />}
                      {promptsSaved ? 'Enregistré et directives activées !' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </div>

                {/* Subtab Navigation Pills */}
                <div className="flex items-center gap-2 mb-5 flex-wrap border-b border-[var(--border)] pb-3">
                  <button
                    type="button"
                    onClick={() => setActivePromptSubTab('exam')}
                    className="btn"
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '0.45rem 0.9rem',
                      borderRadius: '8px',
                      background: activePromptSubTab === 'exam' ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-glass)',
                      color: activePromptSubTab === 'exam' ? 'var(--violet)' : 'var(--text-muted)',
                      border: activePromptSubTab === 'exam' ? '1px solid var(--violet)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <span>📝</span> Prompt d&apos;extraction Examens &amp; QCM
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePromptSubTab('lesson')}
                    className="btn"
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '0.45rem 0.9rem',
                      borderRadius: '8px',
                      background: activePromptSubTab === 'lesson' ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-glass)',
                      color: activePromptSubTab === 'lesson' ? 'var(--violet)' : 'var(--text-muted)',
                      border: activePromptSubTab === 'lesson' ? '1px solid var(--violet)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <span>📚</span> Prompt d&apos;extraction Cours &amp; Synthèses
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePromptSubTab('directives')}
                    className="btn"
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '0.45rem 0.9rem',
                      borderRadius: '8px',
                      background: activePromptSubTab === 'directives' ? 'rgba(16, 185, 129, 0.2)' : 'var(--emerald)',
                      color: activePromptSubTab === 'directives' ? 'var(--emerald)' : 'var(--text-muted)',
                      border: activePromptSubTab === 'directives' ? '1px solid var(--emerald)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <span>🎯</span> Directives supplémentaires de l&apos;extracteur
                  </button>
                </div>

                {/* SubTab 1: Exam & QCM Prompt */}
                {activePromptSubTab === 'exam' && (
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
                          Prompt d&apos;extraction Examens &amp; QCM (System Prompt - Examens &amp; Concours)
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                          Contrôle la précision de l&apos;extraction des questions, des quatre choix, de la bonne réponse, ainsi que la rédaction des Astuces et Tricks.
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
                          {examPrompt.length} car. (~{Math.round(examPrompt.length / 4)} tokens)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(examPrompt, 'exam')}
                          className="btn-secondary"
                          style={{ fontSize: '0.74rem', padding: '0.35rem 0.7rem', borderRadius: '8px', gap: '0.35rem', cursor: 'pointer' }}
                        >
                          {copiedField === 'exam' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                          {copiedField === 'exam' ? 'Copié' : 'Copier'}
                        </button>
                        <button
                          type="button"
                          onClick={handleResetExamPrompt}
                          className="btn-secondary"
                          style={{ fontSize: '0.74rem', padding: '0.35rem 0.7rem', borderRadius: '8px', gap: '0.35rem', color: 'var(--text-subtle)', cursor: 'pointer' }}
                        >
                          <RotateCcw size={13} /> Réinitialiser
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={examPrompt}
                      onChange={e => setExamPrompt(e.target.value)}
                      rows={14}
                      className="input-control"
                      style={{
                        width: '100%',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
                        fontSize: '0.8rem',
                        lineHeight: 1.6,
                        padding: '1rem',
                        borderRadius: '12px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-main)',
                        resize: 'vertical',
                        whiteSpace: 'pre-wrap',
                        direction: 'ltr',
                        textAlign: 'left'
                      }}
                    />
                  </div>
                )}

                {/* SubTab 2: Lessons & Courses Prompt */}
                {activePromptSubTab === 'lesson' && (
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
                          Prompt d&apos;extraction Cours &amp; Programmes (System Prompt - Cours &amp; Résumés)
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                          Définit les règles d&apos;extraction des résumés de cours, séries d&apos;exercices et activités avec mise en forme en tableaux et formules LaTeX.
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
                          {lessonPrompt.length} car. (~{Math.round(lessonPrompt.length / 4)} tokens)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(lessonPrompt, 'lesson')}
                          className="btn-secondary"
                          style={{ fontSize: '0.74rem', padding: '0.35rem 0.7rem', borderRadius: '8px', gap: '0.35rem', cursor: 'pointer' }}
                        >
                          {copiedField === 'lesson' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                          {copiedField === 'lesson' ? 'Copié' : 'Copier'}
                        </button>
                        <button
                          type="button"
                          onClick={handleResetLessonPrompt}
                          className="btn-secondary"
                          style={{ fontSize: '0.74rem', padding: '0.35rem 0.7rem', borderRadius: '8px', gap: '0.35rem', color: 'var(--text-subtle)', cursor: 'pointer' }}
                        >
                          <RotateCcw size={13} /> Réinitialiser
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={lessonPrompt}
                      onChange={e => setLessonPrompt(e.target.value)}
                      rows={14}
                      className="input-control"
                      style={{
                        width: '100%',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
                        fontSize: '0.8rem',
                        lineHeight: 1.6,
                        padding: '1rem',
                        borderRadius: '12px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-main)',
                        resize: 'vertical',
                        whiteSpace: 'pre-wrap',
                        direction: 'ltr',
                        textAlign: 'left'
                      }}
                    />
                  </div>
                )}

                {/* SubTab 3: Extractor Directives */}
                {activePromptSubTab === 'directives' && (
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
                          Directives personnalisées de l&apos;extracteur (Directives Personnalisées)
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                          Instructions et règles personnalisées injectées automatiquement dans chaque requête d&apos;extraction (style, langue cible ou contraintes spécifiques).
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
                          {extractorDirectives.length} car.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(extractorDirectives, 'directives')}
                          className="btn-secondary"
                          style={{ fontSize: '0.74rem', padding: '0.35rem 0.7rem', borderRadius: '8px', gap: '0.35rem', cursor: 'pointer' }}
                        >
                          {copiedField === 'directives' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                          {copiedField === 'directives' ? 'Copié' : 'Copier'}
                        </button>
                        <button
                          type="button"
                          onClick={handleResetDirectives}
                          className="btn-secondary"
                          style={{ fontSize: '0.74rem', padding: '0.35rem 0.7rem', borderRadius: '8px', gap: '0.35rem', color: 'var(--text-subtle)', cursor: 'pointer' }}
                        >
                          <RotateCcw size={13} /> Réinitialiser
                        </button>
                      </div>
                    </div>

                    <div style={{
                      padding: '0.75rem 1rem',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '10px',
                      fontSize: '0.78rem',
                      color: 'var(--text-main)',
                      marginBottom: '0.75rem',
                      lineHeight: 1.6
                    }}>
                      💡 <strong>Note importante :</strong> Toute directive ajoutée ici sera ajoutée automatiquement à la fin du prompt pour toutes les extractions (examens, exercices et cours) sans modifier les prompts de base.
                    </div>

                    <textarea
                      value={extractorDirectives}
                      onChange={e => setExtractorDirectives(e.target.value)}
                      rows={8}
                      className="input-control"
                      placeholder="Saisissez des directives supplémentaires pour l'extracteur ici (ex. : rédiger les solutions de manière détaillée, écrire tous les symboles en LaTeX...)"
                      style={{
                        width: '100%',
                        fontSize: '0.82rem',
                        lineHeight: 1.6,
                        padding: '1rem',
                        borderRadius: '12px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-main)',
                        resize: 'vertical',
                        whiteSpace: 'pre-wrap',
                        direction: 'ltr',
                        textAlign: 'left'
                      }}
                    />
                  </div>
                )}

                {/* Footer Quick Controls */}
                <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t border-[var(--border)] flex-wrap">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                      🔒 Les prompts et directives sont enregistrés localement et synchronisés dans la base de données cloud.
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Voulez-vous restaurer tous les prompts et directives aux valeurs par défaut ?')) {
                          setExamPrompt(resetExamPrompt());
                          setLessonPrompt(resetLessonPrompt());
                          setExtractorDirectives(resetExtractorDirectives());
                        }
                      }}
                      className="btn-secondary"
                      style={{ fontSize: '0.76rem', padding: '0.5rem 0.85rem', borderRadius: '9px', cursor: 'pointer' }}
                    >
                      <RotateCcw size={14} /> Tout réinitialiser
                    </button>

                    <button
                      type="button"
                      onClick={handleSavePromptsAndDirectives}
                      className="btn"
                      style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: '9px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: promptsSaved ? '#10B981' : 'linear-gradient(135deg, var(--violet) 0%, #4F46E5 100%)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      {promptsSaved ? <Check size={15} /> : <Sparkles size={15} />}
                      {promptsSaved ? 'Enregistré avec succès !' : 'Enregistrer les prompts'}
                    </button>
                  </div>
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
                      {/* Ministry Logo Upload Card */}
                      <div
                        className="settings-field"
                        style={{
                          gridColumn: '1 / -1',
                          padding: '1rem',
                          borderRadius: '14px',
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '240px', flex: 1 }}>
                          <div
                            style={{
                              width: '132px',
                              height: '62px',
                              borderRadius: '10px',
                              background: '#ffffff',
                              border: '1.5px solid #cbd5e1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '6px',
                              flexShrink: 0,
                              overflow: 'hidden'
                            }}
                          >
                            {ministryLogo ? (
                              <img
                                src={ministryLogo}
                                alt="Logo du Ministère"
                                style={{ maxHeight: '48px', maxWidth: '118px', width: 'auto', height: 'auto', objectFit: 'contain' }}
                              />
                            ) : (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textAlign: 'center', lineHeight: 1.25 }}>
                                Emblème par défaut
                              </span>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)' }}>
                              Logo officiel du Ministère
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', marginTop: '0.15rem', lineHeight: 1.4 }}>
                              S&apos;affiche automatiquement dans l&apos;en-tête des Examens Nationaux, DEVOIR PRIME et PDF.
                            </div>
                            {ministryLogoSaved && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', fontWeight: 700, color: 'var(--emerald)', marginTop: '0.3rem' }}>
                                <CheckCircle2 size={13} /> Logo appliqué et enregistré !
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <label
                            className="btn-primary-gradient"
                            style={{
                              padding: '0.55rem 1rem',
                              fontSize: '0.78rem',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}
                          >
                            <Upload size={14} />
                            {ministryLogo ? 'Changer le logo' : 'Importer le logo'}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/svg+xml"
                              onChange={handleMinistryLogoUpload}
                              style={{ display: 'none' }}
                            />
                          </label>
                          {ministryLogo && (
                            <button
                              type="button"
                              onClick={handleResetMinistryLogo}
                              className="btn-secondary-outline"
                              style={{
                                padding: '0.55rem 0.85rem',
                                fontSize: '0.76rem',
                                borderRadius: '10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                              title="Revenir à l'emblème par défaut"
                            >
                              <RotateCcw size={13} />
                              Réinitialiser
                            </button>
                          )}
                        </div>
                      </div>

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

              {/* 🛡️ Automatic Server Protection & Rolling Snapshots Card */}
              <div className="bento-card" style={{ border: '1.5px solid rgba(16, 185, 129, 0.28)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <h2 className="settings-title" style={{ margin: 0, fontSize: '1.18rem' }}>
                        Protection automatique de la base de données (Auto-Snapshots MySQL)
                      </h2>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Sauvegarde automatique dans un dossier persistant hors des mises à jour à chaque démarrage/mise à jour et toutes les 6 heures (conserve les {snapshotsInfo?.maxSnapshots || 30} dernières versions).
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={fetchServerSnapshots}
                      disabled={loadingSnapshots}
                      className="btn-outline"
                      style={{ padding: '0.55rem 0.9rem', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <RefreshCw size={14} className={loadingSnapshots ? 'animate-spin' : ''} />
                      Actualiser
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateServerSnapshot}
                      disabled={creatingSnapshot}
                      className="btn"
                      style={{
                        padding: '0.55rem 1rem', borderRadius: 10, fontSize: '0.82rem', fontWeight: 800,
                        background: 'linear-gradient(135deg, #6366f1, #10b981)', color: '#fff', border: 'none',
                        display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: creatingSnapshot ? 'wait' : 'pointer'
                      }}
                    >
                      {creatingSnapshot ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={15} />}
                      {creatingSnapshot ? 'Enregistrement...' : 'Créer un snapshot immédiat'}
                    </button>
                  </div>
                </div>

                {/* Live Protection Status Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{
                    padding: '0.28rem 0.7rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 800,
                    background: snapshotsInfo?.mysqlActive ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                    color: snapshotsInfo?.mysqlActive ? '#059669' : '#d97706',
                    border: `1px solid ${snapshotsInfo?.mysqlActive ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
                  }}>
                    {snapshotsInfo?.mysqlActive ? '● MySQL connecté et protégé' : '● Mode stockage local'}
                  </span>
                  <span style={{
                    padding: '0.28rem 0.7rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 800,
                    background: snapshotsInfo?.persistentDirActive ? 'rgba(99,102,241,0.1)' : 'rgba(148,163,184,0.12)',
                    color: snapshotsInfo?.persistentDirActive ? 'var(--violet)' : 'var(--text-muted)',
                    border: '1px solid rgba(99,102,241,0.25)'
                  }}>
                    {snapshotsInfo?.persistentDirActive ? '🛡️ Dossier persistant Hostinger actif (isolé des mises à jour)' : '💾 Dossier de sauvegarde local'}
                  </span>
                  {snapshotsInfo?.tables && (
                    <span style={{ padding: '0.28rem 0.7rem', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-main)' }}>
                      Cours : {snapshotsInfo.tables.tbl_lessons ?? 0} · Classes : {snapshotsInfo.tables.tbl_classes ?? 0} · Cahier de textes : {snapshotsInfo.tables.tbl_logbook ?? 0} · Examens : {snapshotsInfo.tables.tbl_exams ?? 0} · Notes : {snapshotsInfo.tables.tbl_grades ?? 0}
                    </span>
                  )}
                </div>

                {snapshotNotice && (
                  <div style={{ marginBottom: '0.9rem', padding: '0.65rem 0.9rem', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#059669', fontSize: '0.82rem', fontWeight: 700 }}>
                    {snapshotNotice}
                  </div>
                )}

                {/* Snapshots List */}
                {loadingSnapshots && !snapshotsInfo ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Chargement de l&apos;historique des sauvegardes depuis le serveur...
                  </div>
                ) : !snapshotsInfo?.snapshots?.length ? (
                  <div style={{ padding: '1.25rem', borderRadius: 12, background: 'var(--bg-glass)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    Aucune sauvegarde enregistrée pour le moment — cliquez sur « Créer un snapshot immédiat » pour enregistrer un premier point de restauration.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '290px', overflowY: 'auto', paddingRight: '2px' }}>
                    {snapshotsInfo.snapshots.map((snap) => {
                      const reasonLabels = {
                        startup: '🔄 Démarrage / Mise à jour',
                        auto: '⏱️ Automatique (6h)',
                        manual: '📌 Manuel',
                        'pre-restore': '🛡️ Avant restauration',
                        'pre-reset': '🛡️ Avant réinitialisation',
                        'pre-rollback': '🛡️ Avant retour arrière'
                      };
                      const label = reasonLabels[snap.reason] || snap.reason;
                      const formattedTime = (() => {
                        try {
                          return new Date(snap.createdAt).toLocaleString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          });
                        } catch { return snap.createdAt; }
                      })();
                      return (
                        <div
                          key={snap.fileName}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem',
                            padding: '0.65rem 0.85rem', borderRadius: 11, background: 'var(--bg-glass)', border: '1px solid var(--border)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.73rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: 'var(--violet)' }}>
                                {label}
                              </span>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                {formattedTime}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                                ({snap.sizeKB} Ko)
                              </span>
                            </div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                              {snap.stats?.lessonsCount ?? 0} cours · {snap.stats?.classesCount ?? 0} classes · {snap.stats?.logbookCount ?? 0} cahier de textes · {snap.stats?.examsCount ?? 0} examens · {snap.stats?.usersCount ?? 0} utilisateurs
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => handleDownloadServerSnapshot(snap.fileName)}
                              className="btn-outline"
                              style={{ padding: '0.35rem 0.65rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              title="Télécharger le fichier de sauvegarde"
                            >
                              <Download size={13} /> Télécharger
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRestoreServerSnapshot(snap.fileName)}
                              disabled={restoringSnapshotFile === snap.fileName}
                              style={{
                                padding: '0.35rem 0.7rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800,
                                background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)',
                                color: '#059669', cursor: restoringSnapshotFile === snap.fileName ? 'wait' : 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                              }}
                              title="Restaurer la base de données depuis ce point"
                            >
                              <RotateCcw size={13} /> {restoringSnapshotFile === snap.fileName ? 'En cours...' : 'Restaurer'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
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

              {/* ⚡ PWA & Mobile Cache Flush Tool Card */}
              <div className="bento-card" style={{ border: '1.5px solid rgba(99, 102, 241, 0.28)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                      <RefreshCw size={22} />
                    </div>
                    <div>
                      <h2 className="settings-title" style={{ margin: 0, fontSize: '1.18rem' }}>
                        Mise à jour immédiate et vidage du cache mobile (Force Clear Cache &amp; Reload)
                      </h2>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Si vous constatez un affichage obsolète ou si les dernières mises à jour n&apos;apparaissent pas sur votre téléphone, cliquez ici pour vider le Service Worker et le cache local et charger immédiatement la dernière version.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if ('serviceWorker' in navigator) {
                          const regs = await navigator.serviceWorker.getRegistrations();
                          for (const reg of regs) { await reg.unregister(); }
                        }
                        if ('caches' in window) {
                          const keys = await caches.keys();
                          await Promise.all(keys.map(k => caches.delete(k)));
                        }
                        if (typeof indexedDB !== 'undefined') {
                          try { indexedDB.deleteDatabase('lconq_cache_v3'); } catch {}
                        }
                        window.location.reload(true);
                      } catch (_) {
                        window.location.reload();
                      }
                    }}
                    className="btn"
                    style={{
                      padding: '0.75rem 1.35rem',
                      borderRadius: '12px',
                      fontSize: '0.86rem',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <RefreshCw size={16} />
                    Actualiser et vider le cache maintenant
                  </button>
                </div>
              </div>

              {/* ── ZONE DE DANGER : RÉINITIALISATION & PURGE COMPLÈTE DE LA PLATEFORME ── */}
              <div 
                className="bento-card" 
                style={{
                  background: 'rgba(239, 68, 68, 0.03)',
                  border: '1.5px solid rgba(239, 68, 68, 0.28)',
                  boxShadow: '0 8px 30px rgba(239, 68, 68, 0.06)'
                }}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] flex items-center justify-center text-red-500">
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="settings-title" style={{ margin: 0, fontSize: '1.18rem', color: '#ef4444' }}>
                            Zone de Danger : Réinitialisation &amp; Purge de la Plateforme
                          </h2>
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.55rem', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 800, border: '1px solid rgba(239,68,68,0.3)' }}>
                            DANGER / PURGE TOTALE
                          </span>
                        </div>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.86rem', fontWeight: 700, color: '#f87171' }}>
                          Réinitialiser et purger toutes les données de la plateforme (base de données et fichiers)
                        </p>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 0.5rem 0' }}>
                      Cette action vide entièrement la plateforme et la rétablit à son état initial : tous les cours, exercices, examens, devoirs, classes, listes d&apos;élèves et entrées du cahier de textes seront supprimés de la base de données (MySQL et serveur) et du stockage.
                    </p>
                    <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-subtle)', margin: 0 }}>
                      ⚠️ <b>Note de sécurité :</b> Cette action nécessite une confirmation explicite et n&apos;affecte ni la stabilité du serveur ni le code source de la plateforme.
                    </p>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setResetConfirmInput('');
                        setResetSuccess(false);
                        setShowResetModal(true);
                      }}
                      className="btn"
                      style={{
                        padding: '0.85rem 1.4rem',
                        borderRadius: '12px',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.65rem',
                        boxShadow: '0 4px 18px rgba(239, 68, 68, 0.35)',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Trash2 size={18} />
                      Purger et réinitialiser la plateforme
                    </button>
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
                        <span>Vacances officielles (Maroc)</span>
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
                        <option value="Aref Ruqaa">✍️ Aref Ruqaa (calligraphie manuscrite)</option>
                        <option value="Noto Naskh Arabic">Noto Naskh Arabic</option>
                        <option value="Amiri">Amiri (académique)</option>
                        <option value="Tajawal">Tajawal (moderne)</option>
                        <option value="Cairo">Cairo</option>
                      </select>
                    </div>

                    <div className="settings-field">
                      <label className="settings-label">Police de la langue française</label>
                      <select className="input-control" value={logbookFrFont} onChange={e => setLogbookFrFont(e.target.value)}>
                        <optgroup label="✍️ Polices Manuscrites & Cursives (Écriture à la main)">
                          <option value="Caveat">✍️ Caveat (Stylo plume fluide élégant)</option>
                          <option value="Patrick Hand">✍️ Patrick Hand (Manuscrit scolaire soigné)</option>
                          <option value="Kalam">✍️ Kalam (Écriture feutre / stylo bille)</option>
                          <option value="Marck Script">✍️ Marck Script (Cursive traditionnelle liée)</option>
                          <option value="Dancing Script">✍️ Dancing Script (Cursif calligraphique)</option>
                          <option value="Indie Flower">✍️ Indie Flower (Manuscrit naturel décontracté)</option>
                          <option value="Architects Daughter">✍️ Architects Daughter (Manuscrit d'architecte net)</option>
                        </optgroup>
                        <optgroup label="📐 Polices Typographiques Classiques">
                          <option value="Outfit">Outfit (Moderne sans-serif)</option>
                          <option value="Inter">Inter (Clair & géométrique)</option>
                          <option value="Computer Modern Serif">Computer Modern Serif (LaTeX académique)</option>
                          <option value="Times New Roman">Times New Roman (Standard classique)</option>
                        </optgroup>
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

                    {/* Live Real-Time Handwriting Preview Card */}
                    <div style={{
                      gridColumn: '1 / -1',
                      marginTop: '0.25rem',
                      padding: '0.85rem 1.25rem',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          ✍️ Aperçu en direct du texte manuscrit dans le cahier de textes :
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#6366f1', fontWeight: 800, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: '2px 10px', borderRadius: '6px' }}>
                          Police active : {logbookFrFont}
                        </span>
                      </div>
                      
                      {/* Notebook Ruled Line Simulation */}
                      <div style={{
                        backgroundImage: 'linear-gradient(rgba(186, 230, 253, 0.35) 1px, transparent 1px)',
                        backgroundSize: `100% ${logbookLineHeight || 20}px`,
                        lineHeight: `${logbookLineHeight || 20}px`,
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundRepeat: 'repeat-y',
                        backgroundPosition: '0 0'
                      }}>
                        <div style={{
                          fontFamily: `'${logbookFrFont}', cursive, 'Outfit', sans-serif`,
                          fontSize: logbookFontSize || '0.8rem',
                          color: logbookColorInk || '#334155',
                          fontWeight: ['Caveat', 'Kalam', 'Dancing Script'].includes(logbookFrFont) ? 600 : 500,
                          direction: 'ltr',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          <span style={{ color: logbookColorChapter || '#0f172a', fontWeight: 800 }}>Chapitre 2 :</span> Continuité d&apos;une fonction &bull; Théorème des valeurs intermédiaires (TVI).
                        </div>
                        <div style={{
                          fontFamily: `'${logbookArFont}', 'Amiri', 'Cairo', serif`,
                          fontSize: logbookFontSize || '0.8rem',
                          color: logbookColorAxis || '#2563eb',
                          fontWeight: 700,
                          direction: 'rtl',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          المحور الأول: دراسة الدوال العددية وحساب النهايات وتحديد الفروع اللانهائية.
                        </div>
                      </div>
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

      {/* ── SECURE PLATFORM RESET CONFIRMATION MODAL ── */}
      {showResetModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isResetting) setShowResetModal(false);
          }}
        >
          <div 
            style={{
              maxWidth: '560px',
              width: '100%',
              background: 'var(--bg-card, #1e293b)',
              border: '1.5px solid rgba(239, 68, 68, 0.45)',
              borderRadius: '20px',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
              color: 'var(--text-main, #f8fafc)',
              direction: 'rtl',
              textAlign: 'right'
            }}
          >
            {resetSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#10b981' }}>
                  <CheckCircle2 size={36} />
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#10b981' }}>
                  Plateforme réinitialisée avec succès !
                </h3>
                <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0' }}>
                  Toutes les données, cours, examens et tables de la base ont été purgés. Rechargement de l&apos;application...
                </p>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: '#10b981' }} />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ef4444' }}>
                      Confirmer la purge et réinitialisation
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Réinitialisation d&apos;usine et purge totale des données
                    </span>
                  </div>
                </div>

                <div style={{ padding: '0.9rem 1rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', marginBottom: '1.25rem', fontSize: '0.88rem', lineHeight: 1.6, color: '#fca5a5' }}>
                  ⚠️ <b>Avertissement final irréversible :</b> Cette opération supprimera définitivement tous les enregistrements de la base de données serveur (MySQL) et des fichiers persistants.
                </div>

                <div style={{ marginBottom: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
                  <p style={{ fontSize: '0.82rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
                    Éléments qui seront intégralement supprimés :
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    <li>🗑️ Tous les cours, fichiers, exercices et activités.</li>
                    <li>🗑️ Tous les examens, devoirs et banques de QCM.</li>
                    <li>🗑️ Toutes les classes, listes d&apos;élèves et notes.</li>
                    <li>🗑️ Tous les journaux du cahier de textes et activités quotidiennes.</li>
                    <li>🗑️ Tous les fichiers de cache temporaires.</li>
                  </ul>
                </div>

                {/* Backup recommendation button */}
                <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.75rem 1rem', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#34d399' }}>
                    💡 Conseil : téléchargez une sauvegarde complète avant de continuer :
                  </div>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      background: '#10b981',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Download size={14} /> Télécharger (.json)
                  </button>
                </div>

                {/* Include Config Checkbox */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.84rem', color: 'var(--text-main)', userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={resetIncludeConfig} 
                      onChange={(e) => setResetIncludeConfig(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#ef4444', cursor: 'pointer' }}
                    />
                    <span>Supprimer aussi les clés API et réglages (conservés par défaut pour éviter de les ressaisir)</span>
                  </label>
                </div>

                {/* Confirmation text input */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                    Pour confirmer, veuillez saisir <b style={{ color: '#ef4444' }}>CONFIRMER</b> ou <b style={{ color: '#ef4444' }}>RESET</b> ci-dessous :
                  </label>
                  <input 
                    type="text"
                    value={resetConfirmInput}
                    onChange={(e) => setResetConfirmInput(e.target.value)}
                    placeholder='Saisissez "CONFIRMER" ou "RESET" pour valider'
                    disabled={isResetting}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1.5px solid rgba(239, 68, 68, 0.4)',
                      color: '#fff',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={handleExecutePlatformReset}
                    disabled={
                      isResetting ||
                      (resetConfirmInput.trim().toUpperCase() !== 'RESET' &&
                       resetConfirmInput.trim().toUpperCase() !== 'CONFIRMER' &&
                       resetConfirmInput.trim() !== 'تفريغ')
                    }
                    style={{
                      flex: 1,
                      padding: '0.8rem 1.25rem',
                      borderRadius: '12px',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      background: (
                        resetConfirmInput.trim().toUpperCase() === 'RESET' ||
                        resetConfirmInput.trim().toUpperCase() === 'CONFIRMER' ||
                        resetConfirmInput.trim() === 'تفريغ'
                      ) ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'rgba(239, 68, 68, 0.2)',
                      color: '#fff',
                      border: 'none',
                      cursor: (
                        resetConfirmInput.trim().toUpperCase() === 'RESET' ||
                        resetConfirmInput.trim().toUpperCase() === 'CONFIRMER' ||
                        resetConfirmInput.trim() === 'تفريغ'
                      ) && !isResetting ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 15px rgba(239, 68, 68, 0.25)',
                      opacity: (
                        resetConfirmInput.trim().toUpperCase() === 'RESET' ||
                        resetConfirmInput.trim().toUpperCase() === 'CONFIRMER' ||
                        resetConfirmInput.trim() === 'تفريغ'
                      ) ? 1 : 0.5
                    }}
                  >
                    {isResetting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Réinitialisation...
                      </>
                    ) : (
                      <>
                        <Trash2 size={18} /> Confirmer la purge totale
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={() => setShowResetModal(false)}
                    style={{
                      padding: '0.8rem 1.25rem',
                      borderRadius: '12px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      background: 'var(--bg-glass, rgba(255,255,255,0.05))',
                      color: 'var(--text-main, #fff)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer'
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
