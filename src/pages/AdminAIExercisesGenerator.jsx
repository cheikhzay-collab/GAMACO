import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  ArrowLeft, 
  BookOpen, 
  Layers, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Save, 
  Copy, 
  FileEdit, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  HelpCircle, 
  Flame, 
  Award, 
  Compass, 
  RefreshCw,
  Settings,
  Languages,
  Check,
  ChevronDown,
  Info,
  GraduationCap,
  Zap
} from 'lucide-react';
import { getAllLessons, addLesson } from '../services/lessonService';
import { renderWithMath } from '../utils/mathRenderer';
import { openLessonPrintWindow } from '../utils/generateLessonPDF';
import { normalizeLevel, getLevelDisplayName } from '../utils/levelHelpers';

// ── Official Moroccan Mathematics Curricula by Level ──
const MOROCCAN_CURRICULA = {
  common_core_sci: {
    labelFr: 'Tronc Commun Scientifique (BIOF)',
    labelAr: 'جذع مشترك علمي',
    defaultLang: 'fr',
    chapters: [
      { id: 'tcs_01', fr: 'Arithmétique dans l\'ensemble N', ar: 'مبادئ في الحسابيات في المجموعة N' },
      { id: 'tcs_02', fr: 'Calcul vectoriel dans le plan', ar: 'الحساب المتجهي في المستوى' },
      { id: 'tcs_03', fr: 'La projection dans le plan', ar: 'الإسقاط في المستوى' },
      { id: 'tcs_04', fr: 'Ensembles de nombres et calcul dans R', ar: 'مجموعات الأعداد والحساب العددي في R' },
      { id: 'tcs_05', fr: 'L\'ordre dans R et valeur absolue', ar: 'الترتيب في R والقيمة المطلقة' },
      { id: 'tcs_06', fr: 'La droite dans le plan', ar: 'المستقيم في المستوى' },
      { id: 'tcs_07', fr: 'Les polynômes', ar: 'الحدوديات' },
      { id: 'tcs_08', fr: 'Équations, inéquations et systèmes', ar: 'المعادلات والمتراجحات والنظمات' },
      { id: 'tcs_09', fr: 'Trigonométrie (Partie 1)', ar: 'الحساب المثلثي (الجزء الأول)' },
      { id: 'tcs_10', fr: 'Statistiques et caractéristiques', ar: 'الإحصاء ومميزات الموضع والتشتت' },
      { id: 'tcs_11', fr: 'Géométrie dans l\'espace', ar: 'الهندسة الفضائية وحساب الحجوم' }
    ]
  },
  common_core_arts: {
    labelFr: 'Tronc Commun Lettres & Sciences Humaines',
    labelAr: 'جذع مشترك آداب وعلوم إنسانية',
    defaultLang: 'ar',
    chapters: [
      { id: 'tcl_01', fr: 'Calcul numérique et puissances', ar: 'الحساب العددي وقوى الأعداد والنسب المئوية' },
      { id: 'tcl_02', fr: 'Ordre dans R et équations du premier degré', ar: 'الترتيب في R والمعادلات والمتراجحات من الدرجة الأولى' },
      { id: 'tcl_03', fr: 'Statistiques et pourcentages', ar: 'الإحصاء والجداول والتمثيلات المبيانية' },
      { id: 'tcl_04', fr: 'Géométrie dans l\'espace et volumes', ar: 'الهندسة الفضائية وحساب الحجوم' }
    ]
  },
  '1bac_sci': {
    labelFr: '1ère Bac Sciences Expérimentales',
    labelAr: 'أولى باك علوم تجريبية',
    defaultLang: 'fr',
    chapters: [
      { id: '1bs_01', fr: 'Notions de logique mathématique', ar: 'مبادئ في المنطق الرياضي' },
      { id: '1bs_02', fr: 'Généralités sur les fonctions numériques', ar: 'عموميات حول الدوال العددية' },
      { id: '1bs_03', fr: 'Le barycentre dans le plan', ar: 'المرجح في المستوى' },
      { id: '1bs_04', fr: 'Les suites numériques', ar: 'المتتاليات العددية (حسابية وهندسية)' },
      { id: '1bs_05', fr: 'Produit scalaire dans le plan et applications', ar: 'الجداء السلمي في المستوى وتطبيقاته' },
      { id: '1bs_06', fr: 'Trigonométrie (Formules de transformation)', ar: 'الحساب المثلثي (صيغ التحويل)' },
      { id: '1bs_07', fr: 'La rotation dans le plan', ar: 'الدوران في المستوى' },
      { id: '1bs_08', fr: 'Limites d\'une fonction numérique', ar: 'نهايات دالة عددية' },
      { id: '1bs_09', fr: 'Dérivation et étude des fonctions', ar: 'الاشتقاق ودراسة الدوال' },
      { id: '1bs_10', fr: 'Géométrie dans l\'espace (Produit scalaire)', ar: 'الهندسة الفضائية والجداء السلمي' }
    ]
  },
  '1bac_arts': {
    labelFr: '1ère Bac Lettres & Sciences Humaines',
    labelAr: 'أولى باك آداب وعلوم إنسانية',
    defaultLang: 'ar',
    chapters: [
      { id: '1ba_01', fr: 'Calcul numérique et proportionnalité', ar: 'مبادئ في الحساب العددي والنسب المئوية' },
      { id: '1ba_02', fr: 'Suites numériques (Arithmétiques et Géométriques)', ar: 'المتتاليات العددية (الحسابية والهندسية)' },
      { id: '1ba_03', fr: 'Fonctions numériques usuelles', ar: 'عموميات حول الدوال ودراسة دوال بسيطة' },
      { id: '1ba_04', fr: 'Dénombrement et probabilités simples', ar: 'التعداد والاحتمالات البسيطة' }
    ]
  },
  '2bac_pc_svt': {
    labelFr: '2ème Bac Sciences Expérimentales (PC / SVT)',
    labelAr: 'ثانية باك علوم تجريبية (PC / SVT)',
    defaultLang: 'fr',
    chapters: [
      { id: '2b_01', fr: 'Continuité et limites (TVI, Bijection, Racine n-ème)', ar: 'الاتصال وحساب النهايات (مبرهنة القيم الوسيطية، الدالة العكسية)' },
      { id: '2b_02', fr: 'Dérivation, branches infinies et étude de fonctions', ar: 'الاشتقاق ودراسة الدوال والفروع اللانهائية والتقعر' },
      { id: '2b_03', fr: 'Suites numériques (Suites récurrentes et convergence)', ar: 'المتتاليات العددية (المتتاليات الترجعية والتقارب)' },
      { id: '2b_04', fr: 'Fonction logarithme népérien (ln)', ar: 'الدوال اللوغاريتمية (دالة Ln وتطبيقاتها)' },
      { id: '2b_05', fr: 'Fonction exponentielle (exp)', ar: 'الدوال الأسية (دالة Exp والمعادلات)' },
      { id: '2b_06', fr: 'Nombres complexes (Forme algébrique, trigo, géométrie)', ar: 'الأعداد العقدية (الجبرية والمثلثية والتحويلات)' },
      { id: '2b_07', fr: 'Calcul intégral et primitives (Intégration par parties)', ar: 'الحساب التكاملي والدوال الأصلية والمساحات' },
      { id: '2b_08', fr: 'Équations différentielles linéaires', ar: 'المعادلات التفاضلية الخطية' },
      { id: '2b_09', fr: 'Géométrie dans l\'espace (Produit scalaire et vectoriel)', ar: 'الهندسة الفضائية والجداء السلمي والمتجهي والفلكة' },
      { id: '2b_10', fr: 'Calcul des probabilités et variables aléatoires', ar: 'حساب الاحتمالات والمتغيرات العشوائية' }
    ]
  },
  '2bac_sm': {
    labelFr: '2ème Bac Sciences Mathématiques (A & B)',
    labelAr: 'ثانية باك علوم رياضية (A & B)',
    defaultLang: 'fr',
    chapters: [
      { id: '2bsm_01', fr: 'Logique mathématique, Ensembles et Applications', ar: 'المنطق والمجموعات والتطبيقات' },
      { id: '2bsm_02', fr: 'Continuité, Dérivation et Théorème de Rolle / TAF', ar: 'الاتصال والاشتقاق ومبرهنات رول والتزايدات المنتهية' },
      { id: '2bsm_03', fr: 'Suites numériques et suites de Cauchy', ar: 'المتتاليات العددية والتقارب المونوطوني' },
      { id: '2bsm_04', fr: 'Structures algébriques (Groupes, Anneaux, Corps)', ar: 'البنيات الجبرية (الزمر، الحلقات، الأجسام)' },
      { id: '2bsm_05', fr: 'Arithmétique dans Z (Bézout, Gauss, Congruences)', ar: 'الحسابيات في Z (بيزو، غوص، الموافقة بترديد n)' },
      { id: '2bsm_06', fr: 'Nombres complexes et transformations planes', ar: 'الأعداد العقدية والبنيات والتحويلات الهندسية' },
      { id: '2bsm_07', fr: 'Fonctions logarithmes et exponentielles', ar: 'الدوال اللوغاريتمية والأسية' },
      { id: '2bsm_08', fr: 'Calcul intégral et sommes de Riemann', ar: 'الحساب التكاملي ومجاميع ريمان' },
      { id: '2bsm_09', fr: 'Équations différentielles', ar: 'المعادلات التفاضلية' },
      { id: '2bsm_10', fr: 'Espaces vectoriels réels', ar: 'الفضاءات المتجهية الحقيقية' },
      { id: '2bsm_11', fr: 'Probabilités et variables aléatoires', ar: 'الاحتمالات والمتغيرات العشوائية' }
    ]
  },
  '2bac_arts': {
    labelFr: '2ème Bac Lettres & Sciences Humaines',
    labelAr: 'ثانية باك آداب وعلوم إنسانية',
    defaultLang: 'ar',
    chapters: [
      { id: '2ba_01', fr: 'Suites numériques (Arithmétiques et géométriques)', ar: 'المتتاليات العددية (الحسابية والهندسية)' },
      { id: '2ba_02', fr: 'Fonctions numériques et intégrales simples', ar: 'الدوال العددية والتكامل المبسط' },
      { id: '2ba_03', fr: 'Dénombrement et probabilités', ar: 'الاحتمالات والتعداد' }
    ]
  }
};

// ── Difficulties ──
const DIFFICULTIES = [
  { id: 'facile', labelFr: 'Facile — Application directe du cours', labelAr: 'سهل — تطبيق مباشر للمكتسبات والقواعد', icon: Compass, color: '#10B981', badge: 'Application' },
  { id: 'moyen', labelFr: 'Moyen — Exercices types et devoirs surveillés', labelAr: 'متوسط — تمارين نموذجية والفروض المحروسة', icon: Sliders, color: '#3B82F6', badge: 'Standard' },
  { id: 'difficile', labelFr: 'Difficile — Approfondissement et raisonnement', labelAr: 'صعب — تعمق واستدلال رياضي متقدم', icon: Flame, color: '#F59E0B', badge: 'Avancé' },
  { id: 'olympiades', labelFr: 'Concours & Olympiades — Défis et astuces', labelAr: 'مباريات وأولمبياد — تميز ومسائل مفتوحة', icon: Award, color: '#EC4899', badge: 'Excellence' },
  { id: 'progressif', labelFr: 'Trousse progressive — De l\'application au défi', labelAr: 'تدرج بيداغوجي — من المباشر إلى المركب', icon: Layers, color: '#8B5CF6', badge: 'Progressif' }
];

// ── Ultra-resilient JSON parser for LLM-generated math/LaTeX content ──
function robustParseAiJson(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Réponse vide du modèle IA.');
  }

  let str = raw.trim();

  // 1. Remove markdown code blocks if present
  if (str.includes('```')) {
    str = str.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
  }

  // 2. Extract outermost JSON { ... }
  const firstBrace = str.indexOf('{');
  const lastBrace = str.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    str = str.substring(firstBrace, lastBrace + 1);
  }

  // Attempt 1: Direct parse
  try {
    const res = JSON.parse(str);
    if (res && (res.exercises || res.sheet_title)) return res;
  } catch (_) {}

  // Attempt 2: Sanitize invalid escape sequences (LaTeX \frac, \sqrt, \mathbb, etc.)
  // Valid JSON escape sequences: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
  try {
    const fixedEscapes = str
      .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\')
      .replace(/,\s*([}\]])/g, '$1'); // remove trailing commas
    const res = JSON.parse(fixedEscapes);
    if (res && (res.exercises || res.sheet_title)) return res;
  } catch (_) {}

  // Attempt 3: Fix unescaped newlines and carriage returns inside JSON strings
  try {
    let inString = false;
    let escaped = false;
    let fixed = '';
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '\\') {
        escaped = !escaped;
        fixed += c;
        continue;
      }
      if (c === '"' && !escaped) {
        inString = !inString;
      }
      if (inString && (c === '\n' || c === '\r')) {
        fixed += '\\n';
      } else if (inString && c === '\t') {
        fixed += '\\t';
      } else {
        fixed += c;
      }
      escaped = false;
    }
    const fixedEscapes = fixed
      .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\')
      .replace(/,\s*([}\]])/g, '$1');
    const res = JSON.parse(fixedEscapes);
    if (res && (res.exercises || res.sheet_title)) return res;
  } catch (_) {}

  // Attempt 4: Fallback Regex Extractor
  try {
    const exercises = [];
    const blocks = str.split(/(?=\{\s*"(?:id|title)"\s*:)/gi);
    for (const b of blocks) {
      if (b.includes('"title"') || b.includes('"content"')) {
        const titleM = b.match(/"title"\s*:\s*"([^"]+)"/);
        const pointsM = b.match(/"points"\s*:\s*"([^"]+)"/);
        const contentM = b.match(/"content"\s*:\s*"([\s\S]*?)"(?=,\s*"(?:items|solution|points)"|\s*\})/);
        const solM = b.match(/"solution"\s*:\s*"([\s\S]*?)"(?=\s*\})/);
        
        if (titleM || contentM) {
          exercises.push({
            id: `ex-${exercises.length + 1}`,
            title: titleM ? titleM[1] : `Exercice ${exercises.length + 1}`,
            points: pointsM ? pointsM[1] : '',
            content: contentM ? contentM[1].replace(/\\n/g, '\n').replace(/\\\\/g, '\\') : '',
            solution: solM ? solM[1].replace(/\\n/g, '\n').replace(/\\\\/g, '\\') : '',
            items: []
          });
        }
      }
    }

    if (exercises.length > 0) {
      const sheetTitleM = str.match(/"sheet_title"\s*:\s*"([^"]+)"/);
      return {
        sheet_title: sheetTitleM ? sheetTitleM[1] : "Série d'exercices",
        exercises: exercises
      };
    }
  } catch (reErr) {
    console.warn('[JSON Parse] Fallback regex failed:', reErr);
  }

  throw new Error("Erreur de décodage JSON : Les formules générées contiennent une syntaxe non reconnue. Veuillez relancer la génération.");
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function AdminAIExercisesGenerator({ onBack }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // ── Form State ──
  const [selectedLevel, setSelectedLevel] = useState('2bac_pc_svt');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [customChapterTitle, setCustomChapterTitle] = useState('');
  const [isCustomChapter, setIsCustomChapter] = useState(false);
  const [difficulty, setDifficulty] = useState('moyen');
  const [count, setCount] = useState(3);
  const [language, setLanguage] = useState('fr');
  const [respectGuidelines, setRespectGuidelines] = useState(true);
  const [customDirectives, setCustomDirectives] = useState('');
  const [includeSolutions, setIncludeSolutions] = useState(true);
  const [includeBareme, setIncludeBareme] = useState(true);

  // ── Database Lessons for current teacher ──
  const [existingLessons, setExistingLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(false);

  // ── API Key & Model ──
  const [geminiKey, setGeminiKey] = useState(() => (localStorage.getItem('geminiApiKey') || localStorage.getItem('gemini_api_key') || '').trim());
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');

  // Auto-sync Gemini key from system config if not in localStorage
  useEffect(() => {
    if (!geminiKey) {
      fetch('/api/config')
        .then(r => r.ok ? r.json() : null)
        .then(cfg => {
          const k = cfg?.ai_settings?.geminiApiKey;
          if (k && typeof k === 'string' && k.trim()) {
            setGeminiKey(k.trim());
            localStorage.setItem('geminiApiKey', k.trim());
          }
        })
        .catch(() => {});
    }
  }, [geminiKey]);

  // ── Generation State ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [generatedSheet, setGeneratedSheet] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [savingStatus, setSavingStatus] = useState(null); // 'saving', 'saved', null
  const [expandedSolutions, setExpandedSolutions] = useState({});
  const [savedLessonId, setSavedLessonId] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Fetch teacher lessons to allow selecting from them
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingLessons(true);
      try {
        const all = await getAllLessons();
        if (mounted && Array.isArray(all)) {
          setExistingLessons(all);
        }
      } catch (e) {
        console.warn('Could not load lessons:', e);
      } finally {
        if (mounted) setLoadingLessons(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Sync language with level default
  useEffect(() => {
    const lvlMeta = MOROCCAN_CURRICULA[selectedLevel];
    if (lvlMeta) {
      setLanguage(lvlMeta.defaultLang || 'fr');
      // Set default first chapter
      if (lvlMeta.chapters && lvlMeta.chapters.length > 0) {
        setSelectedChapterId(lvlMeta.chapters[0].id);
      }
    }
  }, [selectedLevel]);

  // Current level metadata
  const currentLevelMeta = useMemo(() => {
    return MOROCCAN_CURRICULA[selectedLevel] || MOROCCAN_CURRICULA['2bac_pc_svt'];
  }, [selectedLevel]);

  // Filter existing user lessons matching selected level
  const filteredUserLessons = useMemo(() => {
    return existingLessons.filter(l => normalizeLevel(l.level) === selectedLevel);
  }, [existingLessons, selectedLevel]);

  // Resolved chapter title
  const resolvedChapterTitle = useMemo(() => {
    if (isCustomChapter && customChapterTitle.trim()) {
      return customChapterTitle.trim();
    }
    const found = currentLevelMeta.chapters.find(c => c.id === selectedChapterId);
    if (found) {
      return language === 'ar' ? found.ar : found.fr;
    }
    return language === 'ar' ? 'تمارين في الرياضيات' : 'Exercices de Mathématiques';
  }, [isCustomChapter, customChapterTitle, currentLevelMeta, selectedChapterId, language]);

  // Handle API Key saving
  const handleSaveKey = () => {
    const k = tempKey.trim();
    setGeminiKey(k);
    localStorage.setItem('geminiApiKey', k);
    setShowKeyModal(false);
  };

  // Toggle single solution view
  const toggleSolution = (idx) => {
    setExpandedSolutions(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Toggle all solutions
  const toggleAllSolutions = () => {
    if (!generatedSheet?.content?.sections) return;
    const allOpen = Object.values(expandedSolutions).filter(Boolean).length === generatedSheet.content.sections.length;
    const nextState = {};
    if (!allOpen) {
      generatedSheet.content.sections.forEach((_, idx) => {
        nextState[idx] = true;
      });
    }
    setExpandedSolutions(nextState);
  };

  // ── Core AI Generation Call ──
  const handleGenerate = async () => {
    if (!geminiKey) {
      setShowKeyModal(true);
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedSheet(null);
    setSavingStatus(null);
    setExpandedSolutions({});

    try {
      setProgressStep(language === 'ar' ? 'تحليل التوجيهات التربوية المغربية للمستوى...' : 'Analyse des orientations pédagogiques marocaines...');

      const levelLabel = language === 'ar' ? currentLevelMeta.labelAr : currentLevelMeta.labelFr;
      const difficultyObj = DIFFICULTIES.find(d => d.id === difficulty) || DIFFICULTIES[1];
      const diffDesc = language === 'ar' ? difficultyObj.labelAr : difficultyObj.labelFr;

      // Pedagogical instructions according to official Moroccan curriculums
      const promptMoroccanGuidelines = respectGuidelines ? `
RÈGLES PÉDAGOGIQUES STRICTES DU MINISTÈRE DE L'ÉDUCATION NATIONALE DU MAROC :
1. Les exercices doivent respecter scrupuleusement le programme officiel et les cadres de référence (Cadre de référence officiel des examens et contrôles continus du Maroc).
2. Progression logique et méthodique : Décomposer les exercices en questions guidées et progressives (1. a), b), c) ou 1., 2., 3.).
3. Utiliser les formules pédagogiques canoniques : "Vérifier que...", "Montrer que...", "En déduire que...", "Déterminer...".
4. Pour les équations et les limites, ne pas utiliser de théorèmes hors programme (ex: Règle de L'Hôpital interdite en 2Bac sauf indication explicite ; privilégier la factorisation, l'expression conjuguée, TVI, taux d'accroissement).
5. Respecter la notation mathématique marocaine : crochets d'intervalles $[a, b]$, notation $\\mathbb{R}$, $\\mathbb{N}$, $\\ln(x)$, $\\exp(x)$, $\\lim_{x \\to x_0}$, etc.
6. Rédiger toutes les formules en notation LaTeX propre ($...$ pour inline, $$...$$ pour les blocs).
` : '';

      const languageInstruction = language === 'ar' 
        ? `Rédige TOUT en langue ARABE mathématique officielle (المصطلحات الرياضية المغربية الرسمية، ترقيم الأسئلة، والصياغة العربية الدقيقة، مع الحفاظ على الرموز الرياضية اللاتينية x, y, f, g...).`
        : `Rédige TOUT en FRANÇAIS BIOF (notations officielles du baccalauréat international au Maroc).`;

      const promptUserDirectives = customDirectives.trim() ? `
DIRECTIVES SPÉCIFIQUES DE L'ENSEIGNANT (À RESPECTER PRIORITAIREMENT) :
"${customDirectives.trim()}"
` : '';

      const baremeInstruction = includeBareme 
        ? `Attribue pour chaque exercice un barème de points cohérent (ex: "4 pts", "5 pts", "2.5 pts") totalisant entre 15 et 20 points au total.`
        : `Ne pas attribuer de points chiffrés.`;

      const solutionInstruction = includeSolutions
        ? `Fournis pour CHAQUE exercice une solution modèle détaillée pas à pas ("solution") rédigée avec rigueur pédagogique, justifiant chaque étape et règle appliquée.`
        : `Laisse le champ "solution" vide ("").`;

      const systemPrompt = `Tu es Inspecteur Général Pédagogique et Concepteur Expert de Mathématiques auprès du Ministère de l'Éducation Nationale du Maroc.
Ta mission est de concevoir et générer une série de mathématiques d'EXCELLENCE PÉDAGOGIQUE pour le niveau "${levelLabel}" sur le chapitre "${resolvedChapterTitle}".

═══════════════════════════════════════════════════════════════════════════
⭐ RÈGLES FONDAMENTALES DU MINISTÈRE DE L'ÉDUCATION NATIONALE DU MAROC :
═══════════════════════════════════════════════════════════════════════════

1. 🚫 100% INÉDIT — INTERDICTION STRICTE DE COPIER :
   - Ne recopie ni ne reprends aucune série existante sur la plateforme ni d'exercices déjà vus.
   - Tu dois INVENTER et CONCEVOIR des exercices ENTIÈREMENT NOUVEAUX, originaux, stimulants et parfaitement adaptés au niveau "${levelLabel}".

2. 🎯 COUVERTURE EXHAUSTIVE DE TOUS LES AXES DU CHAPITRE :
   - La série de ${count} exercices DOIT couvrir les DIFFÉRENTS axes fondamentaux du chapitre "${resolvedChapterTitle}".
   - Chaque exercice de la série doit être centré sur un axe pédagogique spécifique et distinct pour offrir une couverture complète du cours.
   - Par exemple :
     * Exercice 1 : Notions fondamentales, applications directes et manipulations algébriques.
     * Exercice 2 : Raisonnement mathématique, propriétés clés et démonstrations guidées.
     * Exercice 3 : Problème de synthèse, recherche et approfondissement avec questions enchaînées.

3. 📝 ÉNONCÉS EXHAUSTIFS ET COMPLETS (OBLIGATION ABSOLUE) :
   - Chaque exercice doit être un VRAI problème mathématique complet et rigoureux.
   - ⚠️ INTERDICTION FORMELLE DE S'ARRÊTER À UNE SIMPLE PHRASE D'INTRODUCTION SANS QUESTIONS !
   - Chaque exercice DOIT obligatoirement comporter :
     * Le contexte mathématique / données initiales (ex: "Soit $f$ la fonction...", "Soit $n \\in \\mathbb{N}^*$...").
     * Au minimum 3 à 5 questions numérotées et hiérarchisées de manière progressive :
       1) a) Vérifier que...
          b) Montrer que...
       2) a) En déduire que...
          b) Déterminer...
       3) Résoudre...
   - Utilise les formules canoniques marocaines : "Vérifier que", "Montrer que", "En déduire que", "Calculer", "Résoudre dans".

${promptMoroccanGuidelines}
${languageInstruction}
${baremeInstruction}
${solutionInstruction}
${promptUserDirectives}

═══════════════════════════════════════════════════════════════════════════
🔧 FORMAT JSON STRICT ET TECHNIQUE :
═══════════════════════════════════════════════════════════════════════════
Tu dois renvoyer UNIQUEMENT un objet JSON valide suivant exactement ce modèle :
{
  "sheet_title": "${language === 'ar' ? 'سلسلة تمارين : ' : 'Série d\'exercices : '}${resolvedChapterTitle}",
  "chapter": "${resolvedChapterTitle}",
  "level": "${selectedLevel}",
  "difficulty": "${difficulty}",
  "language": "${language}",
  "exercises": [
    {
      "id": "ex-1",
      "title": "${language === 'ar' ? 'التمرين 1 : [المحور الأول]' : 'Exercice 1 : [Premier Axe du cours]'}",
      "points": "5 pts",
      "statement": "Données introductives de l'exercice...\\n1) a) Première question...\\n   b) Deuxième question...\\n2) Troisième question...\\n3) Quatrième question...",
      "solution": "Corrigé modèle étape par étape pour chaque question 1) a), b), 2), 3)... avec toutes les justifications mathématiques et encadrement des résultats."
    }
  ]
}

RÈGLE TECHNIQUE CRITIQUE :
- Dans les chaînes JSON, TOUS les antislashs LaTeX doivent impérativement être DOUBLÉS (ex: "\\\\frac{a}{b}", "\\\\sqrt{x}", "\\\\lim_{x \\\\to 0}", "\\\\mathbb{R}").
- Dans "statement", inclus TOUT l'énoncé avec TOUTES les questions numérotées 1), 2), a), b)... Ne tronque jamais l'énoncé !`;

      const userPrompt = `Génère une série de ${count} exercices de mathématiques 100% INÉDITS et COMPLETS, de niveau "${diffDesc}", couvrant tous les axes du chapitre "${resolvedChapterTitle}" pour la classe de "${levelLabel}". Chaque exercice doit impérativement avoir toutes ses questions rédigées de 1) à 4).`;

      setProgressStep(language === 'ar' ? 'صياغة تمارين جديدة كلياً وتغطية محاور الدرس...' : 'Conception d\'exercices inédits et structuration des axes...');

      // Models to try in order of capability
      const storedModel = (localStorage.getItem('geminiModel') || '').trim();
      const preferredModel = (storedModel && !storedModel.includes('3.') && !storedModel.includes('2.5') && !storedModel.includes('3.6')) ? storedModel : 'gemini-2.0-flash';
      const modelsToTry = [preferredModel, 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];

      let rawResponseText = null;
      let lastError = null;

      for (const model of modelsToTry) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: `${systemPrompt}\n\n---\n\n${userPrompt}` }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.45,
                maxOutputTokens: 8192,
                responseMimeType: "application/json"
              }
            })
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson?.error?.message || `Gemini ${model} HTTP ${res.status}`);
          }

          const data = await res.json();
          const candidate = data.candidates?.[0];
          const nonThoughtParts = candidate?.content?.parts?.filter(p => !p.thought) || [];
          const text = (nonThoughtParts.length > 0 ? nonThoughtParts : (candidate?.content?.parts || []))
            .map(p => p.text || '')
            .join('');
          if (text) {
            rawResponseText = text;
            break;
          }
        } catch (mErr) {
          console.warn(`[AI Exercise Gen] Model ${model} failed:`, mErr.message);
          lastError = mErr;
        }
      }

      if (!rawResponseText) {
        throw new Error(lastError?.message || (language === 'ar' ? 'تعذر الاتصال بنماذج الذكاء الاصطناعي. تأكد من مفتاح API.' : 'Échec de connexion à l\'API Gemini. Vérifiez votre clé.'));
      }

      setProgressStep(language === 'ar' ? 'معالجة التنسيق الرياضي ورموز LaTeX...' : 'Finalisation et rendu des formules LaTeX...');

      // Robust JSON decoding specifically resilient to unescaped LaTeX
      const parsed = robustParseAiJson(rawResponseText);
      if (!parsed.exercises || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
        throw new Error(language === 'ar' ? 'لم يقم الذكاء الاصطناعي بإنشاء تمارين صالحة.' : 'Aucun exercice valide n\'a été renvoyé.');
      }

      // Format as standard lesson document sections
      const sections = parsed.exercises.map((ex, idx) => {
        const fullContent = (ex.statement || ex.content || '').trim();
        
        // Split content into structured items for PDF and multi-paragraph KaTeX rendering
        const rawLines = fullContent.split('\n').map(l => l.trim()).filter(Boolean);
        const items = rawLines.map(line => {
          const isBullet = /^(\d+[\.\)]|[a-zA-Z][\.\)]|[-*•])\s+/.test(line);
          return {
            type: isBullet ? 'bullet' : 'text',
            text: line
          };
        });

        return {
          id: ex.id || `ex-${idx + 1}`,
          type: 'exercise',
          title: ex.title || `${language === 'ar' ? 'التمرين ' : 'Exercice '}${idx + 1}`,
          points: ex.points || '',
          content: fullContent,
          items: items.length > 0 ? items : [{ type: 'text', text: fullContent }],
          solution: (ex.solution || '').trim(),
          language: language,
          section_number: `${idx + 1}`
        };
      });

      const sheetDoc = {
        title: parsed.sheet_title || `${language === 'ar' ? 'سلسلة تمارين : ' : 'Série d\'exercices : '}${resolvedChapterTitle}`,
        level: selectedLevel,
        subject: language === 'ar' ? 'الرياضيات' : 'Mathématiques',
        docType: 'exercises',
        chapterNumber: '',
        isActive: true,
        content: {
          level: selectedLevel,
          doc_type: 'exercises',
          metadata: { language },
          header: {
            subject: language === 'ar' ? 'الرياضيات' : 'Mathématiques',
            prep_title: levelLabel,
            fiche_title: parsed.sheet_title || `${language === 'ar' ? 'سلسلة تمارين : ' : 'Série d\'exercices : '}${resolvedChapterTitle}`,
            teacher: localStorage.getItem('teacher_name') || 'Professeur',
            phone: '',
            schools: [language === 'ar' ? 'الثانوي التأهيلي' : 'Lycée Qualifiant']
          },
          sections: sections
        }
      };

      setGeneratedSheet(sheetDoc);
      // Automatically expand first solution if available
      if (sections.length > 0 && sections[0].solution) {
        setExpandedSolutions({ 0: true });
      }

    } catch (err) {
      console.error('[AI Exercise Gen] Error:', err);
      setErrorMsg(err.message || (language === 'ar' ? 'حدث خطأ أثناء التوليد.' : 'Une erreur est survenue lors de la génération.'));
    } finally {
      setIsGenerating(false);
      setProgressStep('');
    }
  };

  // ── Save to Database as a Series (Série d'exercices) ──
  const handleSaveToDb = async () => {
    if (!generatedSheet) return;
    setSavingStatus('saving');
    try {
      const savedId = await addLesson(generatedSheet);
      setSavingStatus('saved');
      setSavedLessonId(savedId);
      setToastMessage(language === 'ar' ? '✅ تم حفظ سلسلة التمارين بنجاح في بنك الفروض والتمارين !' : '✅ Série d\'exercices enregistrée avec succès dans la base !');
      setShowSuccessModal(true);
      setTimeout(() => {
        setSavingStatus(null);
        setToastMessage(null);
      }, 5000);
      return savedId;
    } catch (err) {
      console.error('Failed to save exercise sheet:', err);
      alert(language === 'ar' ? 'حدث خطأ أثناء الحفظ في المنظومة : ' + (err.message || err) : 'Erreur lors de la sauvegarde dans la base : ' + (err.message || err));
      setSavingStatus(null);
    }
  };

  // ── Print or Export PDF ──
  const handlePrint = () => {
    if (!generatedSheet) return;
    openLessonPrintWindow(generatedSheet, {
      layoutMode: 'two_columns',
      showSolutions: includeSolutions
    });
  };

  // ── Copy Markdown / LaTeX to Clipboard ──
  const handleCopy = () => {
    if (!generatedSheet?.content?.sections) return;
    let fullText = `# ${generatedSheet.title}\n**Niveau / المستوى:** ${getLevelDisplayName(selectedLevel, language === 'ar')}\n\n`;
    generatedSheet.content.sections.forEach((s, idx) => {
      fullText += `## ${s.title} ${s.points ? `(${s.points})` : ''}\n\n`;
      fullText += `${s.content}\n\n`;
      if (s.solution) {
        fullText += `### Corrigé / الحل :\n${s.solution}\n\n`;
      }
      fullText += `---\n\n`;
    });
    navigator.clipboard.writeText(fullText);
    alert(language === 'ar' ? 'تم نسخ التمارين بصيغة Markdown/LaTeX بنجاح!' : 'Exercices copiés dans le presse-papier !');
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '2rem 1.5rem', maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* ── Top Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.25rem', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button 
            onClick={onBack || (() => navigate('/admin/ai-generator'))}
            type="button"
            style={{ 
              borderRadius: '14px', 
              padding: '0.65rem 1.15rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.6rem', 
              fontWeight: 700,
              fontSize: '0.86rem',
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text-main, #0f172a)',
              border: '1.5px solid var(--border, rgba(148, 163, 184, 0.25))',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
              e.currentTarget.style.borderColor = 'var(--violet, #7c3aed)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
              e.currentTarget.style.borderColor = 'var(--border, rgba(148, 163, 184, 0.25))';
            }}
          >
            <ArrowLeft size={18} style={{ color: 'var(--violet, #7c3aed)' }} />
            <span>{language === 'ar' ? 'الرجوع للاستوديو' : 'Retour au Studio'}</span>
          </button>
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ 
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)', 
                color: '#db2777', 
                fontSize: '0.74rem', 
                fontWeight: 800, 
                padding: '0.22rem 0.75rem', 
                borderRadius: '99px',
                border: '1px solid rgba(236, 72, 153, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                letterSpacing: '0.04em'
              }}>
                <Sparkles size={13} />
                {language === 'ar' ? 'ذكاء اصطناعي بيداغوجي' : 'IA PÉDAGOGIQUE'}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                • {language === 'ar' ? 'التوجيهات الرسمية لوزارة التربية الوطنية' : 'Orientations Officielles Marocaines'}
              </span>
            </div>
            <h1 style={{ 
              fontSize: '1.95rem', 
              fontWeight: 900, 
              margin: '0.35rem 0 0 0', 
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, var(--text-main, #0f172a) 40%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              {language === 'ar' ? 'صانع ومولد التمارين بالذكاء الاصطناعي' : 'Générateur d\'Exercices & Séries IA'}
            </h1>
          </div>
        </div>

        {/* Action Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* API Key Indicator */}
          <button 
            onClick={() => { setTempKey(geminiKey); setShowKeyModal(true); }}
            type="button"
            style={{ 
              borderRadius: '14px', 
              padding: '0.55rem 1rem', 
              fontSize: '0.82rem',
              background: geminiKey ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              color: geminiKey ? '#059669' : '#dc2626',
              border: `1.5px solid ${geminiKey ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: geminiKey ? '#10B981' : '#EF4444',
              boxShadow: geminiKey ? '0 0 8px #10B981' : '0 0 8px #EF4444'
            }} />
            <Settings size={15} />
            <span>{geminiKey ? (language === 'ar' ? 'مفتاح Gemini نشط ⚡' : 'Clé Gemini Active') : (language === 'ar' ? 'ضبط مفتاح API' : 'Configurer Clé API')}</span>
          </button>

          {/* Language Switcher */}
          <div style={{ 
            display: 'flex', 
            background: 'var(--bg-card, #ffffff)', 
            border: '1.5px solid var(--border, rgba(148, 163, 184, 0.25))', 
            borderRadius: '14px', 
            padding: '3px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <button
              type="button"
              onClick={() => setLanguage('fr')}
              style={{
                border: 'none',
                background: language === 'fr' ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : 'transparent',
                color: language === 'fr' ? '#fff' : 'var(--text-muted)',
                padding: '0.45rem 0.9rem',
                borderRadius: '11px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: language === 'fr' ? '0 2px 6px rgba(124, 58, 237, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Français (BIOF)
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ar')}
              style={{
                border: 'none',
                background: language === 'ar' ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : 'transparent',
                color: language === 'ar' ? '#fff' : 'var(--text-muted)',
                padding: '0.45rem 0.9rem',
                borderRadius: '11px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: language === 'ar' ? '0 2px 6px rgba(124, 58, 237, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              العربية
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Config Form + Results / Showcase ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : (generatedSheet ? '380px 1fr' : 'minmax(0, 1.15fr) minmax(0, 0.85fr)'), 
        gap: isMobile ? '1.5rem' : '2.25rem', 
        alignItems: 'start' 
      }}>
        
        {/* ── LEFT: Configuration Card ── */}
        <div style={{ 
          background: 'var(--bg-card, #ffffff)', 
          border: '1.5px solid var(--border, rgba(148, 163, 184, 0.2))', 
          borderRadius: '24px', 
          padding: '2rem',
          boxShadow: '0 20px 45px -15px rgba(0,0,0,0.05), 0 0 1px 1px rgba(0,0,0,0.02)',
          position: 'relative'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem', paddingBottom: '1.25rem', borderBottom: '1.5px solid var(--border, rgba(148, 163, 184, 0.15))' }}>
            <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(236, 72, 153, 0.35)', color: '#fff' }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {language === 'ar' ? 'معايير السلسلة البيداغوجية' : 'Paramètres de la Série'}
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {language === 'ar' ? 'تحديد المستوى والدرس ودرجة الصعوبة' : 'Cible, contenu & exigences'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
            
            {/* 1. Level Selection */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.45rem' }}>
                <span style={{ width: 22, height: 22, borderRadius: '6px', background: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>1</span>
                <span>{language === 'ar' ? 'المستوى الدراسي' : 'Niveau d\'études'}</span>
              </label>
              <div style={{ position: 'relative' }}>
                <select 
                  value={selectedLevel}
                  onChange={e => setSelectedLevel(e.target.value)}
                  style={{ 
                    width: '100%', 
                    borderRadius: '14px', 
                    padding: '0.75rem 2.5rem 0.75rem 2.6rem', 
                    fontSize: '0.9rem', 
                    fontWeight: 600,
                    color: 'var(--text-main, #0f172a)',
                    background: 'var(--bg-hover, #f8fafc)',
                    border: '1.5px solid var(--border, rgba(148, 163, 184, 0.25))',
                    outline: 'none',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {Object.entries(MOROCCAN_CURRICULA).map(([lvlKey, lvl]) => (
                    <option key={lvlKey} value={lvlKey}>
                      {language === 'ar' ? lvl.labelAr : lvl.labelFr}
                    </option>
                  ))}
                </select>
                <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#8B5CF6', display: 'flex', alignItems: 'center' }}>
                  <GraduationCap size={18} />
                </div>
                <div style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            {/* 2. Chapter / Lesson Selection */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '6px', background: 'rgba(236, 72, 153, 0.12)', color: '#EC4899', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>2</span>
                  <span>{language === 'ar' ? 'الدرس / المحور المستهدف' : 'Leçon / Chapitre cible'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomChapter(!isCustomChapter)}
                  style={{ 
                    background: 'rgba(124, 58, 237, 0.08)', 
                    border: '1px solid rgba(124, 58, 237, 0.2)', 
                    color: 'var(--violet, #7c3aed)', 
                    fontSize: '0.76rem', 
                    fontWeight: 700, 
                    cursor: 'pointer',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isCustomChapter ? <BookOpen size={13} /> : <Plus size={13} />}
                  <span>
                    {isCustomChapter 
                      ? (language === 'ar' ? '← العودة للمنهاج' : '← Choisir du programme') 
                      : (language === 'ar' ? '+ عنوان مخصص' : '+ Titre personnalisé')}
                  </span>
                </button>
              </div>

              {isCustomChapter ? (
                <input 
                  type="text"
                  placeholder={language === 'ar' ? 'مثال: النهايات والدوال العكسية، مبرهنة رول...' : 'Ex: Continuité, TVI, Fonctions réciproques...'}
                  value={customChapterTitle}
                  onChange={e => setCustomChapterTitle(e.target.value)}
                  style={{ 
                    width: '100%', 
                    borderRadius: '14px', 
                    padding: '0.75rem 1rem', 
                    fontSize: '0.9rem',
                    color: 'var(--text-main)',
                    background: 'var(--bg-hover, #f8fafc)',
                    border: '1.5px solid var(--border, rgba(148, 163, 184, 0.25))',
                    outline: 'none',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  <select 
                    value={selectedChapterId}
                    onChange={e => setSelectedChapterId(e.target.value)}
                    style={{ 
                      width: '100%', 
                      borderRadius: '14px', 
                      padding: '0.75rem 2.5rem 0.75rem 2.6rem', 
                      fontSize: '0.9rem', 
                      fontWeight: 600,
                      color: 'var(--text-main, #0f172a)',
                      background: 'var(--bg-hover, #f8fafc)',
                      border: '1.5px solid var(--border, rgba(148, 163, 184, 0.25))',
                      outline: 'none',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <optgroup label={language === 'ar' ? '📚 المنهاج المغربي الرسمي' : '📚 Programme officiel marocain'}>
                      {currentLevelMeta.chapters.map(c => (
                        <option key={c.id} value={c.id}>
                          {language === 'ar' ? c.ar : c.fr}
                        </option>
                      ))}
                    </optgroup>

                    {filteredUserLessons.length > 0 && (
                      <optgroup label={language === 'ar' ? '📁 دروسك المحفوظة' : '📁 Vos fiches de cours'}>
                        {filteredUserLessons.map(ul => (
                          <option key={ul.id} value={ul.id}>
                            {ul.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#EC4899', display: 'flex', alignItems: 'center' }}>
                    <BookOpen size={18} />
                  </div>
                  <div style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <ChevronDown size={18} />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Difficulty */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.55rem' }}>
                <span style={{ width: 22, height: 22, borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>3</span>
                <span>{language === 'ar' ? 'درجة الصعوبة البيداغوجية' : 'Degré de difficulté'}</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {DIFFICULTIES.map(d => {
                  const Icon = d.icon;
                  const isSelected = difficulty === d.id;
                  return (
                    <div 
                      key={d.id}
                      onClick={() => setDifficulty(d.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '14px',
                        border: `1.5px solid ${isSelected ? d.color : 'var(--border, rgba(148, 163, 184, 0.2))'}`,
                        background: isSelected 
                          ? `linear-gradient(135deg, ${d.color}15 0%, ${d.color}06 100%)` 
                          : 'var(--bg-hover, rgba(0,0,0,0.015))',
                        boxShadow: isSelected ? `0 4px 14px -3px ${d.color}35` : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease',
                        transform: isSelected ? 'translateY(-1px)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '10px',
                          background: isSelected ? d.color : `${d.color}15`,
                          color: isSelected ? '#fff' : d.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: isSelected ? `0 2px 8px ${d.color}50` : 'none'
                        }}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: isSelected ? 800 : 600, color: 'var(--text-main)' }}>
                            {language === 'ar' ? d.labelAr : d.labelFr}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 800, 
                          color: d.color, 
                          background: `${d.color}18`, 
                          border: `1px solid ${d.color}30`,
                          padding: '0.2rem 0.6rem', 
                          borderRadius: '8px' 
                        }}>
                          {d.badge}
                        </span>
                        {isSelected && (
                          <div style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: d.color,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Number of Exercises */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '6px', background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>4</span>
                  <span>{language === 'ar' ? 'عدد التمارين' : 'Nombre d\'exercices'}</span>
                </label>
                <span style={{ 
                  fontSize: '0.78rem', 
                  fontWeight: 800, 
                  color: 'var(--violet, #7c3aed)',
                  background: 'rgba(124, 58, 237, 0.1)',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '20px'
                }}>
                  {count} {language === 'ar' ? 'تمارين' : 'exercices'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: '0.5rem' }}>
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCount(num)}
                    style={{
                      padding: '0.6rem 0',
                      borderRadius: '12px',
                      border: `1.5px solid ${count === num ? 'var(--violet, #7c3aed)' : 'var(--border, rgba(148, 163, 184, 0.25))'}`,
                      background: count === num 
                        ? 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)' 
                        : 'var(--bg-hover, #f8fafc)',
                      color: count === num ? '#fff' : 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      boxShadow: count === num ? '0 4px 14px rgba(139, 92, 246, 0.35)' : 'none',
                      transform: count === num ? 'scale(1.03)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Custom Directives (خانة التوجيهات الخاصة) */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.45rem' }}>
                <span style={{ width: 22, height: 22, borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>5</span>
                <span>{language === 'ar' ? 'توجيهات وملاحظات خاصة (اختياري)' : 'Consignes & Directives spécifiques (Optionnel)'}</span>
              </label>
              <textarea 
                rows={3}
                placeholder={language === 'ar' 
                  ? 'مثال: التركيز على مبرهنة القيم الوسيطية، إضافة سؤال برهان بالترجع، تضمين متراجحة بمجهولين، تمارين مناسبة لفرض محروس مدته ساعة...'
                  : 'Ex: Insister sur le calcul des limites avec expressions conjuguées, inclure une question de TVI avec unicité par stricte monotonie, adapter pour un devoir d\'une heure...'}
                value={customDirectives}
                onChange={e => setCustomDirectives(e.target.value)}
                style={{ 
                  width: '100%', 
                  borderRadius: '14px', 
                  padding: '0.75rem 1rem', 
                  fontSize: '0.85rem', 
                  lineHeight: '1.45',
                  color: 'var(--text-main)',
                  background: 'var(--bg-hover, #f8fafc)',
                  border: '1.5px solid var(--border, rgba(148, 163, 184, 0.25))',
                  outline: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              />
            </div>

            {/* 6. Moroccan Guidelines & Pro Toggles */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem', 
              padding: '0.9rem 1rem', 
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(236, 72, 153, 0.03) 100%)', 
              borderRadius: '16px', 
              border: '1px solid rgba(124, 58, 237, 0.15)' 
            }}>
              
              {/* Moroccan Guidelines */}
              <div 
                onClick={() => setRespectGuidelines(!respectGuidelines)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.5rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>🇲🇦</span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {language === 'ar' ? 'احترام التوجيهات التربوية المغربية الرسمية' : 'Respect strict des Orientations Pédagogiques'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {language === 'ar' ? 'مطابقة للأطر المرجعية والامتحانات الإشهادية' : 'Cadres de référence & normes des examens'}
                    </div>
                  </div>
                </div>
                <div style={{
                  width: 40,
                  height: 22,
                  borderRadius: '99px',
                  background: respectGuidelines ? 'var(--violet, #7c3aed)' : 'rgba(100, 116, 139, 0.25)',
                  position: 'relative',
                  transition: 'all 0.25s ease',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: respectGuidelines ? 21 : 3,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }} />
                </div>
              </div>

              {/* Solutions Toggle */}
              <div 
                onClick={() => setIncludeSolutions(!includeSolutions)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.5rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>📝</span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {language === 'ar' ? 'توليد عناصر الإجابة والحلول المفصلة' : 'Générer le corrigé modèle pas à pas'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {language === 'ar' ? 'دليل تصحيح نموذجي مع خطوات البرهان' : 'Démonstrations détaillées prêtes pour l\'élève'}
                    </div>
                  </div>
                </div>
                <div style={{
                  width: 40,
                  height: 22,
                  borderRadius: '99px',
                  background: includeSolutions ? 'var(--violet, #7c3aed)' : 'rgba(100, 116, 139, 0.25)',
                  position: 'relative',
                  transition: 'all 0.25s ease',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: includeSolutions ? 21 : 3,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }} />
                </div>
              </div>

              {/* Barème Toggle */}
              <div 
                onClick={() => setIncludeBareme(!includeBareme)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.5rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>⚖️</span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {language === 'ar' ? 'وضع سلم التنقيط التقديري (Barème)' : 'Inclure le barème de notation'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {language === 'ar' ? 'توزيع النقاط حسب الأسئلة والمهام' : 'Attribution précise des points par question'}
                    </div>
                  </div>
                </div>
                <div style={{
                  width: 40,
                  height: 22,
                  borderRadius: '99px',
                  background: includeBareme ? 'var(--violet, #7c3aed)' : 'rgba(100, 116, 139, 0.25)',
                  position: 'relative',
                  transition: 'all 0.25s ease',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: includeBareme ? 21 : 3,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }} />
                </div>
              </div>

            </div>

            {/* Submit Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              type="button"
              style={{
                width: '100%',
                padding: '1rem 1.75rem',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1rem',
                letterSpacing: '-0.01em',
                border: 'none',
                boxShadow: '0 12px 30px -6px rgba(236, 72, 153, 0.45), 0 4px 12px rgba(139, 92, 246, 0.3)',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.75 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                transition: 'all 0.25s ease'
              }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={20} className="spin" />
                  <span>{language === 'ar' ? 'جاري صياغة التمارين بدقة بيداغوجية...' : 'Génération en cours selon le curriculum...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>{language === 'ar' ? 'صناعة وتوليد التمارين بالـ IA' : 'Générer la Série d\'Exercices'}</span>
                </>
              )}
            </button>

            {/* Status step during generation */}
            {isGenerating && progressStep && (
              <div style={{ 
                textAlign: 'center', 
                fontSize: '0.8rem', 
                color: 'var(--violet, #7c3aed)', 
                fontWeight: 700, 
                animation: 'pulse 1.5s infinite',
                padding: '0.6rem',
                background: 'rgba(124, 58, 237, 0.08)',
                borderRadius: '12px',
                border: '1px dashed rgba(124, 58, 237, 0.25)'
              }}>
                ⚡ {progressStep}
              </div>
            )}

            {errorMsg && (
              <div style={{ 
                padding: '0.85rem 1rem', 
                borderRadius: '12px', 
                background: 'rgba(239, 68, 68, 0.1)', 
                color: '#EF4444', 
                fontSize: '0.84rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <AlertCircle size={18} flexShrink={0} />
                <span>{errorMsg}</span>
              </div>
            )}

          </div>

        </div>

        {/* ── RIGHT: Educational Showcase (when sheet is not yet generated) ── */}
        {!generatedSheet && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              background: 'var(--bg-card, #ffffff)',
              border: '1.5px solid var(--border, rgba(148, 163, 184, 0.2))',
              borderRadius: '24px',
              padding: '2rem',
              boxShadow: '0 20px 45px -15px rgba(0, 0, 0, 0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: -40,
                right: -40,
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
                pointerEvents: 'none'
              }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={22} style={{ color: '#3B82F6' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {language === 'ar' ? 'معايير التميز في التوليد التربوي' : 'Studio d\'Excellence Pédagogique'}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {language === 'ar' ? 'صياغة رياضية محكمة متوافقة مع الأطر الوطنية' : 'Conformité didactique avancée & normes MEN'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Feature 1 */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  background: 'rgba(59, 130, 246, 0.04)',
                  border: '1px solid rgba(59, 130, 246, 0.14)',
                  display: 'flex',
                  gap: '0.85rem',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#3B82F6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }}>
                    <Compass size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                      {language === 'ar' ? 'احترام المنهاج المغربي ومستويات بلوم' : 'Curricula Officiels & Taxonomie de Bloom'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                      {language === 'ar' 
                        ? 'تدرج بيداغوجي دقيق من التطبيق المباشر للقواعد إلى حل المشكلات المركبة والاستدلال الرياضي.'
                        : 'Progression didactique rigoureuse : restitution des connaissances, application directe, puis raisonnement et synthèse.'}
                    </div>
                  </div>
                </div>

                {/* Feature 2 */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  background: 'rgba(16, 185, 129, 0.04)',
                  border: '1px solid rgba(16, 185, 129, 0.14)',
                  display: 'flex',
                  gap: '0.85rem',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#10B981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                      {language === 'ar' ? 'صياغة LaTeX / KaTeX عالية الجودة' : 'Rendu LaTeX / KaTeX Haute Définition'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                      {language === 'ar'
                        ? 'رموز رياضية واضحة، نهايات، تكاملات، متتاليات، وجداول إشارات مجهزة فوراً للطباعة والنشر.'
                        : 'Typographie mathématique impeccable : intégrales, limites, suites, systèmes et tableaux prêts à l\'impression.'}
                    </div>
                  </div>
                </div>

                {/* Feature 3 */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  background: 'rgba(236, 72, 153, 0.04)',
                  border: '1px solid rgba(236, 72, 153, 0.14)',
                  display: 'flex',
                  gap: '0.85rem',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#EC4899', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', boxShadow: '0 4px 10px rgba(236, 72, 153, 0.3)' }}>
                    <Printer size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                      {language === 'ar' ? 'تصدير PDF، طباعة وقارئ QR للحلول' : 'Export PDF Pro avec QR Code WhatsApp'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                      {language === 'ar'
                        ? 'إمكانية إخراج السلسلة في نمط عصري أو كلاسيكي، مع تضمين QR كود يربط التلميذ بحل التمرين.'
                        : 'Mise en page optimisée sur 1, 2 ou 3 colonnes avec génération automatique d\'un QR code menant aux solutions.'}
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer info badge */}
              <div style={{ 
                marginTop: '1.5rem', 
                paddingTop: '1.25rem', 
                borderTop: '1px dashed var(--border, rgba(148, 163, 184, 0.2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(124, 58, 237, 0.03)',
                padding: '0.85rem 1.15rem',
                borderRadius: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={16} style={{ color: '#8B5CF6' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {language === 'ar' ? 'محرك ذكاء اصطناعي فائق السرعة' : 'Moteur IA Haute Vitesse'}
                  </span>
                </div>
                <span style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 800, 
                  color: '#10B981', 
                  background: 'rgba(16, 185, 129, 0.12)', 
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '0.2rem 0.65rem', 
                  borderRadius: '99px' 
                }}>
                  ⚡ Gemini 2.5 Flash / Pro
                </span>
              </div>

            </div>
          </div>
        )}

        {/* ── RIGHT: Generated Sheet Preview & Actions ── */}
        {generatedSheet ? (
          <div className="glass-panel animate-fade-in" style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border)', 
            borderRadius: '20px', 
            padding: '2rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)'
          }}>
            
            {/* Sheet Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              justifyContent: 'space-between', 
              borderBottom: '2px solid var(--border)', 
              paddingBottom: '1.5rem',
              marginBottom: '1.75rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <span style={{ 
                    background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(139,92,246,0.15))', 
                    color: 'var(--violet)', 
                    fontWeight: 800, 
                    fontSize: '0.75rem', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '6px' 
                  }}>
                    {getLevelDisplayName(selectedLevel, language === 'ar')}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    • {generatedSheet.content.sections.length} {language === 'ar' ? 'تمارين معتمدة' : 'exercices générés'}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {generatedSheet.title}
                </h2>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                
                {/* Toggle Solutions */}
                {includeSolutions && (
                  <button 
                    onClick={toggleAllSolutions}
                    type="button"
                    style={{ 
                      borderRadius: '10px', 
                      padding: '0.6rem 1.05rem', 
                      fontSize: '0.84rem', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      fontWeight: 700,
                      color: '#0284C7',
                      background: '#F0F9FF',
                      border: '1.5px solid #BAE6FD',
                      boxShadow: '0 2px 4px rgba(2, 132, 199, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Eye size={16} />
                    <span>{language === 'ar' ? 'إظهار/إخفاء الحلول' : 'Afficher Corrigé'}</span>
                  </button>
                )}

                {/* Print PDF */}
                <button 
                  onClick={handlePrint}
                  type="button"
                  style={{ 
                    borderRadius: '10px', 
                    padding: '0.6rem 1.05rem', 
                    fontSize: '0.84rem', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    fontWeight: 700,
                    color: '#047857',
                    background: '#ECFDF5',
                    border: '1.5px solid #A7F3D0',
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Printer size={16} />
                  <span>{language === 'ar' ? 'طباعة PDF' : 'Imprimer PDF'}</span>
                </button>

                {/* Copy Markdown */}
                <button 
                  onClick={handleCopy}
                  type="button"
                  style={{ 
                    borderRadius: '10px', 
                    padding: '0.6rem 1.05rem', 
                    fontSize: '0.84rem', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    fontWeight: 700,
                    color: '#4F46E5',
                    background: '#EEF2FF',
                    border: '1.5px solid #C7D2FE',
                    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Copy size={16} />
                  <span>{language === 'ar' ? 'نسخ السلسلة' : 'Copier'}</span>
                </button>

                {/* Save to DB as Series */}
                <button 
                  onClick={handleSaveToDb}
                  disabled={savingStatus === 'saving'}
                  type="button"
                  style={{ 
                    borderRadius: '10px', 
                    padding: '0.6rem 1.3rem', 
                    fontSize: '0.86rem', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    fontWeight: 800,
                    color: '#ffffff',
                    background: savingStatus === 'saved' ? '#10B981' : 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                    border: 'none',
                    boxShadow: savingStatus === 'saved' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : '0 4px 14px rgba(124, 58, 237, 0.35)',
                    cursor: savingStatus === 'saving' ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {savingStatus === 'saving' ? (
                    <>
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>{language === 'ar' ? 'جاري الحفظ...' : 'Sauvegarde...'}</span>
                    </>
                  ) : savingStatus === 'saved' ? (
                    <>
                      <CheckCircle2 size={16} />
                      <span>{language === 'ar' ? 'تم الحفظ في المنصة !' : 'Enregistré avec succès !'}</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>{language === 'ar' ? 'حفظ السلسلة' : 'Enregistrer la Série'}</span>
                    </>
                  )}
                </button>

              </div>
            </div>

            {/* Exercises List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {generatedSheet.content.sections.map((section, idx) => {
                const isSolOpen = expandedSolutions[idx];
                return (
                  <div 
                    key={section.id || idx}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '16px',
                      background: 'rgba(255,255,255,0.02)',
                      overflow: 'hidden',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* Exercise Card Header */}
                    <div style={{
                      padding: '0.85rem 1.25rem',
                      background: 'rgba(124, 58, 237, 0.05)',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ 
                          width: 26, 
                          height: 26, 
                          borderRadius: '8px', 
                          background: 'var(--violet)', 
                          color: '#fff', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontWeight: 800, 
                          fontSize: '0.8rem' 
                        }}>
                          {idx + 1}
                        </span>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                          {section.title}
                        </h3>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {section.points && (
                          <span style={{ 
                            background: 'rgba(245, 158, 11, 0.15)', 
                            color: '#D97706', 
                            fontSize: '0.78rem', 
                            fontWeight: 800, 
                            padding: '0.2rem 0.55rem', 
                            borderRadius: '6px' 
                          }}>
                            {section.points}
                          </span>
                        )}

                        {section.solution && (
                          <button
                            onClick={() => toggleSolution(idx)}
                            style={{
                              border: 'none',
                              background: isSolOpen ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                              color: isSolOpen ? '#10B981' : 'var(--text-muted)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            {isSolOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span>{language === 'ar' ? (isSolOpen ? 'إخفاء الحل' : 'عرض الحل') : (isSolOpen ? 'Masquer corrigé' : 'Voir corrigé')}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Exercise Content with KaTeX */}
                    <div style={{ padding: '1.25rem', direction: language === 'ar' ? 'rtl' : 'ltr', lineHeight: 1.6 }}>
                      {section.items && section.items.length > 0 ? (
                        section.items.map((it, iIdx) => (
                          <div 
                            key={iIdx} 
                            style={{ 
                              marginBottom: '0.6rem',
                              paddingLeft: it.type === 'bullet' && language !== 'ar' ? '1rem' : 0,
                              paddingRight: it.type === 'bullet' && language === 'ar' ? '1rem' : 0
                            }}
                          >
                            {renderWithMath(it.text || '')}
                          </div>
                        ))
                      ) : (
                        <div>{renderWithMath(section.content || '')}</div>
                      )}

                      {/* Collapsible Solution Section */}
                      {section.solution && isSolOpen && (
                        <div className="animate-fade-in" style={{
                          marginTop: '1.25rem',
                          padding: '1rem 1.25rem',
                          borderRadius: '12px',
                          background: 'rgba(16, 185, 129, 0.06)',
                          border: '1px solid rgba(16, 185, 129, 0.25)'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            color: '#10B981', 
                            fontWeight: 800, 
                            fontSize: '0.85rem',
                            marginBottom: '0.6rem'
                          }}>
                            <CheckCircle2 size={16} />
                            <span>{language === 'ar' ? 'عناصر الإجابة والحل النموذجي :' : 'Corrigé type détaillé :'}</span>
                          </div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'pre-line' }}>
                            {renderWithMath(section.solution)}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Floating Shortcut */}
            <div style={{ 
              marginTop: '2rem', 
              padding: '1.25rem', 
              background: 'rgba(124, 58, 237, 0.05)', 
              borderRadius: '14px', 
              border: '1px solid rgba(124, 58, 237, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Info size={18} style={{ color: 'var(--violet)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {language === 'ar' 
                    ? 'تم توليد هذه السلسلة وفق التوجيهات التربوية المغربية. يمكنك حفظها مباشرة في بنك التمارين أو طباعتها بتنسيق رسمي.' 
                    : 'Cette série est conforme aux cadres de référence marocains. Vous pouvez la sauvegarder dans vos cours ou l\'imprimer.'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handlePrint}
                  type="button"
                  style={{
                    borderRadius: '12px',
                    padding: '0.65rem 1.25rem',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#047857',
                    background: '#ECFDF5',
                    border: '1.5px solid #A7F3D0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Printer size={16} />
                  <span>{language === 'ar' ? 'طباعة PDF' : 'Imprimer PDF'}</span>
                </button>

                <button 
                  onClick={handleSaveToDb} 
                  disabled={savingStatus === 'saving'}
                  type="button"
                  style={{ 
                    borderRadius: '12px', 
                    padding: '0.7rem 1.6rem', 
                    fontWeight: 800, 
                    fontSize: '0.9rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    color: '#ffffff',
                    background: savingStatus === 'saved' ? '#10B981' : 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                    border: 'none',
                    boxShadow: savingStatus === 'saved' ? '0 4px 16px rgba(16, 185, 129, 0.4)' : '0 4px 16px rgba(124, 58, 237, 0.4)',
                    cursor: savingStatus === 'saving' ? 'wait' : 'pointer',
                    transition: 'all 0.25s ease'
                  }}
                >
                  {savingStatus === 'saving' ? (
                    <>
                      <RefreshCw size={17} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>{language === 'ar' ? 'جاري الحفظ في المنظومة...' : 'Sauvegarde en cours...'}</span>
                    </>
                  ) : savingStatus === 'saved' ? (
                    <>
                      <CheckCircle2 size={17} />
                      <span>{language === 'ar' ? 'تم الحفظ بنجاح !' : 'Enregistré avec succès !'}</span>
                    </>
                  ) : (
                    <>
                      <Save size={17} />
                      <span>{language === 'ar' ? 'حفظ السلسلة في بنك الدروس والتمارين' : 'Sauvegarder dans la banque'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        ) : (
          /* Empty / Standby Placeholder */
          <div className="glass-panel" style={{ 
            background: 'var(--bg-card)', 
            border: '1px dashed var(--border)', 
            borderRadius: '20px', 
            padding: '4rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}>
            <div style={{ 
              width: 72, 
              height: 72, 
              borderRadius: '20px', 
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              marginBottom: '1.25rem' 
            }}>
              <Sparkles size={34} style={{ color: '#EC4899' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              {language === 'ar' ? 'جاهز لصناعة وتوليد التمارين الرياضية' : 'Prêt pour la création de séries d\'exercices'}
            </h3>
            <p style={{ maxWidth: '440px', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
              {language === 'ar' 
                ? 'اختر المستوى، الدرس، ودرجة الصعوبة من اللوحة المقابلة، ثم اضغط على زر التوليد لصياغة تمارين متوافقة تماماً مع التوجيهات التربوية المغربية.' 
                : 'Sélectionnez le niveau, le chapitre et la difficulté souhaitée, puis lancez la génération assistée par intelligence artificielle.'}
            </p>
          </div>
        )}

      </div>

      {/* ── API Key Modal ── */}
      {showKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '2rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              {language === 'ar' ? 'مفتاح Google Gemini API' : 'Clé API Google Gemini'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '1.25rem' }}>
              {language === 'ar' 
                ? 'أدخل مفتاح Gemini المجاني الخاص بك لتفعيل توليد التمارين البيداغوجية وحساب الحلول الرياضية بدقة عالية.' 
                : 'Renseignez votre clé API Gemini pour alimenter le moteur de génération d\'exercices et de solutions détaillées.'}
            </p>

            <input 
              type="password"
              placeholder="AIzaSy..."
              value={tempKey}
              onChange={e => setTempKey(e.target.value)}
              className="input-field"
              style={{ width: '100%', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.9rem', marginBottom: '1.25rem' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowKeyModal(false)} 
                className="btn btn-secondary"
                style={{ borderRadius: '10px' }}
              >
                {language === 'ar' ? 'إلغاء' : 'Annuler'}
              </button>
              <button 
                onClick={handleSaveKey} 
                className="btn btn-primary"
                style={{ borderRadius: '10px', background: 'var(--violet)' }}
              >
                {language === 'ar' ? 'حفظ المفتاح' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Toast Notification ── */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          background: '#065F46',
          color: '#ffffff',
          padding: '0.85rem 1.6rem',
          borderRadius: '14px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontWeight: 700,
          fontSize: '0.92rem',
          border: '1px solid rgba(52, 211, 153, 0.4)'
        }}>
          <CheckCircle2 size={20} color="#34D399" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Success Celebration Modal ── */}
      {showSuccessModal && generatedSheet && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1.25rem'
        }}>
          <div className="glass-panel" style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '24px',
            padding: '2.25rem',
            maxWidth: '540px',
            width: '100%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
            textAlign: 'center'
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.1) 100%)',
              border: '2px solid #10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem'
            }}>
              <CheckCircle2 size={36} style={{ color: '#10B981' }} />
            </div>

            <span style={{
              display: 'inline-block',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              fontSize: '0.8rem',
              fontWeight: 800,
              padding: '0.25rem 0.8rem',
              borderRadius: '20px',
              marginBottom: '0.75rem'
            }}>
              {language === 'ar' ? '🎉 تم الحفظ بنجاح في المنظومة' : '🎉 Enregistrement Réussi !'}
            </span>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', lineHeight: 1.3 }}>
              {generatedSheet.title}
            </h3>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.75rem' }}>
              {language === 'ar'
                ? 'تم تسجيل هذه السلسلة بنجاح في بنك الدروس والتمارين. يمكنك الآن فتحها وتصفحها من لوحة إدارة الدروس أو طباعتها فوراً بصيغة PDF.'
                : 'Cette série d\'exercices a été ajoutée avec succès à votre bibliothèque de cours et fiches. Vous pouvez la consulter immédiatement ou l\'imprimer.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Primary action: Go to lessons library */}
              <button
                type="button"
                onClick={() => navigate('/admin/lessons')}
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  padding: '0.85rem 1.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  boxShadow: '0 8px 20px rgba(124, 58, 237, 0.35)'
                }}
              >
                <BookOpen size={18} />
                <span>{language === 'ar' ? 'عرض السلسلة في بنك الدروس والتمارين' : 'Consulter dans la bibliothèque de cours'}</span>
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {/* Print PDF */}
                <button
                  type="button"
                  onClick={() => {
                    handlePrint();
                  }}
                  style={{
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: '#047857',
                    background: '#ECFDF5',
                    border: '1.5px solid #A7F3D0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Printer size={16} />
                  <span>{language === 'ar' ? 'طباعة PDF' : 'Imprimer PDF'}</span>
                </button>

                {/* Close modal */}
                <button
                  type="button"
                  onClick={() => setShowSuccessModal(false)}
                  style={{
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer'
                  }}
                >
                  {language === 'ar' ? 'متابعة المعاينة' : 'Continuer l\'aperçu'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
