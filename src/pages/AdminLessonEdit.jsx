import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLessonById, updateLesson } from '../services/lessonService';
import { getAllClasses } from '../services/classService';
import { 
  ArrowLeft, Save, Trash2, Plus, AlertCircle, AlertTriangle,
  CheckCircle, Loader2, ChevronUp, ChevronDown, Crop,
  FileText, Eye, EyeOff, Bold, Italic, 
  Underline, AlignLeft, AlignCenter, AlignRight,
  Table, Image as ImageIcon, Sparkles, Check, X,
  Type, Palette, BookOpen, Layers, Lightbulb, CornerDownLeft,
  GraduationCap, School, Phone, Globe, Tag, Bookmark, CheckSquare, Settings2, Users, Languages,
  Zap, Award, Search, Target, MessageSquare, Link2, HelpCircle, Info, Pin,
  CheckCheck, Copy, Paintbrush, Columns, Wand2, RefreshCw, Database
} from 'lucide-react';
import PdfFigureCropperModal from '../components/PdfFigureCropperModal';
import AiFigureEnhancerModal from '../components/AiFigureEnhancerModal';
import ImageDropZone from '../components/ImageDropZone';
import FloatingLatexPalette from '../components/FloatingLatexPalette';
import SmartTableRenderer from '../components/SmartTableRenderer';
import { solveExerciseWithAI, filterBaremeByDocType } from '../utils/aiExerciseSolver';
import { renderWithMath, autoRepairMathText } from '../utils/mathRenderer';
import { normalizeLevel, getLevelDisplayName } from '../utils/levelHelpers';
import { uploadAsset } from '../services/storageService';
import { validateExercisePoints } from '../utils/scoreBalancingValidator';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

const MOROCCAN_LEVELS = [
  { id: 'common_core_sci', labelFr: 'Tronc Commun Scientifique', labelAr: 'جدع مشترك علمي' },
  { id: 'common_core_arts', labelFr: 'Tronc Commun Lettres & Humanités', labelAr: 'جدع مشترك آداب وعلوم إنسانية' },
  { id: '1bac_sci', labelFr: '1ère Bac Sciences Expérimentales', labelAr: 'أولى باك علوم تجريبية' },
  { id: '1bac_sm', labelFr: '1ère Bac Sciences Mathématiques', labelAr: 'أولى باك علوم رياضية' },
  { id: '1bac_arts', labelFr: '1ère Bac Lettres & Sciences Humaines', labelAr: 'أولى باك آداب وعلوم إنسانية' },
  { id: '2bac_pc_svt', labelFr: '2ème Bac Sciences Expérimentales (PC/SVT)', labelAr: 'ثانية باك علوم تجريبية (PC/SVT)' },
  { id: '2bac_sm', labelFr: '2ème Bac Sciences Mathématiques (A/B)', labelAr: 'ثانية باك علوم رياضية (أ/ب)' },
  { id: '2bac_arts', labelFr: '2ème Bac Lettres & Sciences Humaines', labelAr: 'ثانية باك آداب وعلوم إنسانية' }
];

const DOC_TYPES = [
  { id: 'course', labelFr: 'Cours théorique', labelAr: 'درس نظري' },
  { id: 'exercises', labelFr: 'Série d\'exercices', labelAr: 'سلسلة تمارين تطبيقية' },
  { id: 'homework', labelFr: 'Devoir surveillé (Contrôle)', labelAr: 'فرض محروس (مراقبة مستمرة)' },
  { id: 'national', labelFr: 'Examen National', labelAr: 'امتحان وطني موحد' },
  { id: 'summary', labelFr: 'Résumé de cours', labelAr: 'ملخص درس ومركز' },
  { id: 'ebook', labelFr: 'E-Book (Édition 3 Colonnes)', labelAr: 'كتاب إلكتروني (E-Book)' },
  { id: 'concours', labelFr: 'Concours d\'accès', labelAr: 'مباراة ولوج المعاهد والمدارس' }
];

const COMMON_SUBJECTS = [
  'Mathématiques',
  'Physique-Chimie',
  'Sciences de la Vie et de la Terre (SVT)',
  'Philosophie',
  'Français',
  'Anglais',
  'Informatique',
  'Éducation Islamique'
];

const QUICK_LATEX_CHIPS = [
  { label: 'a/b', latex: '\\frac{a}{b}', title: 'Fraction' },
  { label: '√x', latex: '\\sqrt{x}', title: 'Racine carrée' },
  { label: 'lim', latex: '\\lim_{x \\to x_0}', title: 'Limite' },
  { label: 'x²', latex: 'x^{2}', title: 'Carré / Puissance' },
  { label: 'uₙ', latex: 'u_{n}', title: 'Indice' },
  { label: '∑', latex: '\\sum_{k=1}^{n}', title: 'Somme' },
  { label: '∫', latex: '\\int_{a}^{b}', title: 'Intégrale' },
  { label: 'vec', latex: '\\vec{u}', title: 'Vecteur' },
  { label: '∞', latex: '\\infty', title: 'Infini' },
  { label: 'α', latex: '\\alpha', title: 'Alpha' },
  { label: 'β', latex: '\\beta', title: 'Beta' },
  { label: 'π', latex: '\\pi', title: 'Pi' },
  { label: '≤', latex: '\\le', title: 'Inférieur ou égal' },
  { label: '≥', latex: '\\ge', title: 'Supérieur ou égal' },
  { label: '≠', latex: '\\neq', title: 'Différent' },
  { label: '∈', latex: '\\in', title: 'Appartient' },
  { label: '⊂', latex: '\\subset', title: 'Inclus' },
  { label: '⇒', latex: '\\Rightarrow', title: 'Implique' },
  { label: '⇔', latex: '\\Leftrightarrow', title: 'Équivalent' },
  { label: '{...}', latex: '\\begin{cases} a \\\\ b \\end{cases}', title: 'Système' }
];



export default function AdminLessonEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();

  // Component States & Database Sync Trackers
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState('');
  const [dbSyncStatus, setDbSyncStatus] = useState(null);
  const isInitialLoadedRef = useRef(false);

  const goBack = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        isArMode
          ? 'لديك تعديلات غير محفوظة! هل أنت متأكد من رغبتك في المغادرة دون حفظ في قاعدة البيانات؟'
          : 'Vous avez des modifications non enregistrées ! Voulez-vous vraiment quitter sans enregistrer dans la base de données ?'
      );
      if (!confirmLeave) return;
    }
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    const savedOrigin = sessionStorage.getItem('last_lessons_origin');
    if (savedOrigin) {
      navigate(savedOrigin);
      return;
    }
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }
    navigate('/admin/lessons');
  };

  const [activeRibbonTab, setActiveRibbonTab] = useState('home'); // 'home' | 'math' | 'insert' | 'settings'

  // View mode: 'document' (Page A4 / WYSIWYG) | 'structured' (Blocs Structurés / Formulaire)
  const [editViewMode, setEditViewMode] = useState(() => {
    try {
      return localStorage.getItem('lesson_edit_view_mode') || 'document';
    } catch (_) {
      return 'document';
    }
  });

  const handleSetEditViewMode = (mode) => {
    setEditViewMode(mode);
    try {
      localStorage.setItem('lesson_edit_view_mode', mode);
    } catch (_) {}
  };

  // Header metadata
  const [ficheTitle, setFicheTitle] = useState('');
  const [subject, setSubject] = useState('Mathématiques');
  const [chapterNumber, setChapterNumber] = useState('');
  const [teacher, setTeacher] = useState('');
  const [phone, setPhone] = useState('');
  const [prepTitle, setPrepTitle] = useState('Préparation aux concours');
  const [selectedLevel, setSelectedLevel] = useState('2bac_pc_svt');
  const [docType, setDocType] = useState('course');
  const [docLanguage, setDocLanguage] = useState('fr');
  const [schools, setSchools] = useState([]);
  const [isActiveStatus, setIsActiveStatus] = useState(true);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [customClassInput, setCustomClassInput] = useState('');
  const [isGeneralInfoExpanded, setIsGeneralInfoExpanded] = useState(false);
  const [columnsCount, setColumnsCount] = useState(2);

  // Global Style States (Apply to all sections/exercises)
  const [globalBgColor, setGlobalBgColor] = useState('transparent');
  const [globalFontSize, setGlobalFontSize] = useState('');
  const [globalLineHeight, setGlobalLineHeight] = useState('');
  const [globalScope, setGlobalScope] = useState('all'); // 'all' | 'exercises' | 'course'
  const [applyStyleMenuIndex, setApplyStyleMenuIndex] = useState(null);

  // Pedagogical Objectives (Fiche header fields)
  const [capacitesAttendues, setCapacitesAttendues] = useState('');
  const [contenus, setContenus] = useState('');
  const [leContenu, setLeContenu] = useState('');

  // Load registered classes
  useEffect(() => {
    getAllClasses().then(cls => setAvailableClasses(cls || [])).catch(() => {});
  }, []);
  
  // Sections state
  const [sections, setSections] = useState([]);
  const isSavingRef = useRef(false);
  const lastSavedSnapshotRef = useRef('');

  // Deterministic serialization helper for unsaved-change tracking
  const computeStateSnapshot = (customSections = null, customFields = {}) => {
    const secList = customSections || sections;
    return JSON.stringify({
      title: (customFields.ficheTitle !== undefined ? customFields.ficheTitle : ficheTitle) || '',
      subject: (customFields.subject !== undefined ? customFields.subject : subject) || '',
      chapterNumber: (customFields.chapterNumber !== undefined ? customFields.chapterNumber : chapterNumber) || '',
      teacher: (customFields.teacher !== undefined ? customFields.teacher : teacher) || '',
      phone: (customFields.phone !== undefined ? customFields.phone : phone) || '',
      prepTitle: (customFields.prepTitle !== undefined ? customFields.prepTitle : prepTitle) || '',
      selectedLevel: (customFields.selectedLevel !== undefined ? customFields.selectedLevel : selectedLevel) || '',
      docType: (customFields.docType !== undefined ? customFields.docType : docType) || '',
      docLanguage: (customFields.docLanguage !== undefined ? customFields.docLanguage : docLanguage) || '',
      schools: customFields.schools !== undefined ? customFields.schools : schools,
      isActiveStatus: customFields.isActiveStatus !== undefined ? customFields.isActiveStatus : isActiveStatus,
      columnsCount: customFields.columnsCount !== undefined ? customFields.columnsCount : columnsCount,
      capacitesAttendues: (customFields.capacitesAttendues !== undefined ? customFields.capacitesAttendues : capacitesAttendues) || '',
      contenus: (customFields.contenus !== undefined ? customFields.contenus : contenus) || '',
      leContenu: (customFields.leContenu !== undefined ? customFields.leContenu : leContenu) || '',
      sections: (secList || []).map(sec => ({
        id: sec.id,
        title: sec.title || '',
        content: sec.content || '',
        solution: sec.solution || '',
        type: sec.type || '',
        section_number: sec.section_number || '',
        points: sec.points !== undefined && sec.points !== null ? sec.points : '',
        section_header: sec.section_header || '',
        accent_text: sec.accent_text || '',
        bgColor: sec.bgColor || sec.bg_color || '',
        fontSize: sec.fontSize || sec.font_size || '',
        lineHeight: sec.lineHeight || sec.line_height || '',
        interactive_answers: (sec.interactive_answers || []).map(a => ({
          question_idx: a.question_idx,
          label: a.label || '',
          expected_answer: a.expected_answer || ''
        })),
        items: (sec.items || []).map(it => ({
          type: it.type || '',
          text: it.text || it.content || '',
          src: it.src || it.url || ''
        }))
      }))
    });
  };

  // Active focused input/textarea for ribbon insertions
  const [activeFieldTarget, setActiveFieldTarget] = useState(null); // { secIdx, itemIdx, field: 'text'|'title'|'content'|'solution' }
  const activeTextareaRef = useRef(null);

  // Floating LaTeX Math Palette State
  const [isLatexPaletteOpen, setIsLatexPaletteOpen] = useState(false);
  const [solvingSecIdx, setSolvingSecIdx] = useState(null);
  const [solvingAll, setSolvingAll] = useState(false);
  const [solveAllProgress, setSolveAllProgress] = useState(null);

  // PDF Figure Cropper Modal State
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperTarget, setCropperTarget] = useState({ secIdx: 0, itemIdx: null });

  // AI Figure Enhancer Modal State
  const [isAiEnhancerOpen, setIsAiEnhancerOpen] = useState(false);
  const [aiEnhancerTarget, setAiEnhancerTarget] = useState({ secIdx: 0, itemIdx: 0, imageSrc: '', caption: '' });

  const handleOpenAiEnhancer = (secIdx, itemIdx, item) => {
    setAiEnhancerTarget({
      secIdx,
      itemIdx,
      imageSrc: item.url,
      caption: item.alt || ''
    });
    setIsAiEnhancerOpen(true);
  };

  const handleApplyAiEnhancedFigure = (newUrl) => {
    if (aiEnhancerTarget.secIdx === null || aiEnhancerTarget.itemIdx === null) return;
    setSections(prev => {
      const next = [...prev];
      const sec = { ...next[aiEnhancerTarget.secIdx] };
      const items = [...(sec.items || [])];
      if (items[aiEnhancerTarget.itemIdx]) {
        items[aiEnhancerTarget.itemIdx] = {
          ...items[aiEnhancerTarget.itemIdx],
          url: newUrl
        };
        sec.items = items;
        next[aiEnhancerTarget.secIdx] = sec;
      }
      return next;
    });
    setSuccess(isArMode ? '✓ تم اعتماد الصورة المولدة للشكل وتطبيقها بنجاح' : '✓ Figure IA haute résolution appliquée avec succès');
    setTimeout(() => setSuccess(''), 3000);
  };


  const handleCropComplete = ({ url, alt, width_pct, align, targetSectionIdx, targetItemIdx }) => {
    setSections(prev => {
      const next = [...prev];
      const secIdx = targetSectionIdx ?? 0;
      if (!next[secIdx]) return prev;
      const sec = { ...next[secIdx] };
      const items = Array.isArray(sec.items) ? [...sec.items] : [];

      const newImageItem = {
        type: 'image',
        url,
        alt: alt || 'Figure géométrique',
        width_pct: width_pct || 80,
        align: align || 'center'
      };

      if (targetItemIdx !== null && targetItemIdx >= 0 && items[targetItemIdx]?.type === 'image') {
        items[targetItemIdx] = {
          ...items[targetItemIdx],
          url,
          alt: alt || items[targetItemIdx].alt || 'Figure géométrique',
          width_pct: width_pct || items[targetItemIdx].width_pct || 80,
          align: align || items[targetItemIdx].align || 'center'
        };
      } else if (targetItemIdx !== null && targetItemIdx >= 0) {
        items.splice(targetItemIdx + 1, 0, newImageItem);
      } else {
        items.push(newImageItem);
      }

      sec.items = items;
      next[secIdx] = sec;
      return next;
    });
  };

  // Fetch Lesson on mount
  useEffect(() => {
    const fetchLessonData = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getLessonById(id, { forceRefresh: true });
        if (!data) {
          setError("Cette fiche de cours n'existe pas ou a été supprimée.");
        } else {
          setLesson(data);
          
          // Populate states
          const initTitle = data.title || '';
          const initSubject = data.subject || 'Mathématiques';
          const initChapterNumber = data.chapterNumber || '';
          const initTeacher = data.teacher || '';
          const initPhone = data.phone || '';
          const initSchools = Array.isArray(data.schools) ? data.schools : (data.content?.header?.schools || []);
          const initIsActive = data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? data.is_active : true);
          
          const header = data.content?.header || {};
          const initPrepTitle = header.prep_title || 'Préparation aux concours';
          const initLevel = normalizeLevel(data.level || data.content?.level || '2bac_pc_svt');
          const initDocType = data.docType || data.content?.doc_type || 'course';
          const initDocLang = data.content?.metadata?.language || header.metadata?.language || 'fr';
          const initCols = Number(data.content?.columns_count || data.columnsCount || 2);

          const initCapacites = header.capacites_attendues || '';
          const initContenus = header.contenus || '';
          const initLeContenu = header.le_contenu || '';
          
          setFicheTitle(initTitle);
          setSubject(initSubject);
          setChapterNumber(initChapterNumber);
          setTeacher(initTeacher);
          setPhone(initPhone);
          setSchools(initSchools);
          setIsActiveStatus(initIsActive);
          setPrepTitle(initPrepTitle);
          setSelectedLevel(initLevel);
          setDocType(initDocType);
          setDocLanguage(initDocLang);
          setColumnsCount(initCols);
          setCapacitesAttendues(initCapacites);
          setContenus(initContenus);
          setLeContenu(initLeContenu);
          
          const loadedSections = (data.content?.sections || []).map(sec => {
            const hasAr = /[\u0600-\u06FF]/.test((sec.title || '') + ' ' + (sec.content || '') + ' ' + (sec.solution || '') + ' ' + (sec.items || []).map(it => it.text || '').join(' '));
            const rawContent = (sec.content && sec.content.trim())
              ? sec.content
              : (Array.isArray(sec.items)
                  ? sec.items.filter(it => it.type !== 'image').map(it => it.text || it.content || '').filter(Boolean).join('\n\n')
                  : '');
            return {
              ...sec,
              content: autoRepairMathText(rawContent),
              solution: autoRepairMathText(sec.solution || ''),
              items: (sec.items || []).map(it => ({
                ...it,
                text: autoRepairMathText(it.text || it.content)
              })),
              language: sec.language || (hasAr ? 'ar' : 'fr')
            };
          });
          setSections(loadedSections);

          if (data.updatedAt || data.updated_at) {
            const d = new Date(data.updatedAt || data.updated_at);
            if (!isNaN(d.getTime())) {
              setLastSavedTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
          }

          // Establish clean baseline snapshot for unsaved-change tracking
          lastSavedSnapshotRef.current = computeStateSnapshot(loadedSections, {
            ficheTitle: initTitle,
            subject: initSubject,
            chapterNumber: initChapterNumber,
            teacher: initTeacher,
            phone: initPhone,
            prepTitle: initPrepTitle,
            selectedLevel: initLevel,
            docType: initDocType,
            docLanguage: initDocLang,
            schools: initSchools,
            isActiveStatus: initIsActive,
            columnsCount: initCols,
            capacitesAttendues: initCapacites,
            contenus: initContenus,
            leContenu: initLeContenu
          });
          setHasUnsavedChanges(false);

          // Check for any unsaved local recovery draft
          try {
            const draftRaw = sessionStorage.getItem(`lconq_draft_${id}`) || localStorage.getItem(`lconq_draft_${id}`);
            if (draftRaw) {
              const draft = JSON.parse(draftRaw);
              if (draft?.draftTimestamp) {
                const draftDate = new Date(draft.draftTimestamp);
                const serverDate = new Date(data.updatedAt || data.updated_at || 0);
                if (draftDate.getTime() > serverDate.getTime() + 15000) {
                  const shouldRestore = window.confirm(
                    isArMode
                      ? "تم العثور على مسودة محلية غير محفوظة في قاعدة البيانات. هل تود استرجاعها؟"
                      : "Une version locale non enregistrée a été trouvée. Voulez-vous restaurer votre travail précédent ?"
                  );
                  if (shouldRestore) {
                    if (draft.ficheTitle !== undefined) setFicheTitle(draft.ficheTitle);
                    if (draft.subject !== undefined) setSubject(draft.subject);
                    if (draft.sections) setSections(draft.sections);
                    if (draft.teacher !== undefined) setTeacher(draft.teacher);
                    if (draft.phone !== undefined) setPhone(draft.phone);
                    if (draft.prepTitle !== undefined) setPrepTitle(draft.prepTitle);
                    if (draft.selectedLevel !== undefined) setSelectedLevel(draft.selectedLevel);
                    if (draft.docType !== undefined) setDocType(draft.docType);
                    if (draft.columnsCount !== undefined) setColumnsCount(draft.columnsCount);
                    if (draft.capacitesAttendues !== undefined) setCapacitesAttendues(draft.capacitesAttendues);
                    if (draft.contenus !== undefined) setContenus(draft.contenus);
                    setHasUnsavedChanges(true);
                  } else {
                    sessionStorage.removeItem(`lconq_draft_${id}`);
                    localStorage.removeItem(`lconq_draft_${id}`);
                  }
                } else {
                  sessionStorage.removeItem(`lconq_draft_${id}`);
                  localStorage.removeItem(`lconq_draft_${id}`);
                }
              }
            }
          } catch (_) {}

          setTimeout(() => {
            isInitialLoadedRef.current = true;
          }, 350);
        }
      } catch (err) {
        console.error(err);
        setError("Erreur lors de la récupération de la fiche de cours.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchLessonData();
  }, [id]);

  // Track unsaved modifications against baseline snapshot
  useEffect(() => {
    if (!isInitialLoadedRef.current || isSavingRef.current) return;
    const currentSnapshot = computeStateSnapshot();
    if (lastSavedSnapshotRef.current && currentSnapshot !== lastSavedSnapshotRef.current) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [
    ficheTitle, subject, chapterNumber, teacher, phone, prepTitle,
    selectedLevel, docType, docLanguage, schools, isActiveStatus,
    columnsCount, capacitesAttendues, contenus, leContenu, sections
  ]);

  // Auto-backup unsaved draft to sessionStorage for crash-resilience
  useEffect(() => {
    if (!isInitialLoadedRef.current || isSavingRef.current || !hasUnsavedChanges || !id) return;
    const timer = setTimeout(() => {
      try {
        const draft = {
          ficheTitle, subject, chapterNumber, teacher, phone, prepTitle,
          selectedLevel, docType, docLanguage, schools, isActiveStatus,
          columnsCount, capacitesAttendues, contenus, leContenu, sections,
          draftTimestamp: new Date().toISOString()
        };
        sessionStorage.setItem(`lconq_draft_${id}`, JSON.stringify(draft));
      } catch (_) {}
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    ficheTitle, subject, chapterNumber, teacher, phone, prepTitle,
    selectedLevel, docType, docLanguage, schools, isActiveStatus,
    columnsCount, capacitesAttendues, contenus, leContenu, sections,
    hasUnsavedChanges, id
  ]);

  // Prevent accidental tab closure when unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Section manipulation helpers
  const handleAddSection = (type = 'exercise') => {
    const newId = `sec-${sections.length + 1}-${type}`;
    const titles = {
      exercise: 'Nouvel Exercice',
      content: 'Nouvelle Section de Cours',
      definition: 'Nouvelle Définition',
      property: 'Nouvelle Propriété',
      theorem: 'Nouveau Théorème',
      remark: 'Nouvelle Remarque',
      example: 'Nouvel Exemple',
      activity: 'Nouvelle Activité',
      corollary: 'Nouveau Corollaire'
    };
    const newSec = {
      id: newId,
      title: titles[type] || 'Nouvelle Section',
      type: type,
      section_number: '',
      points: type === 'exercise' ? '0' : '',
      section_header: '',
      accent_text: '',
      content: '',
      solution: '',
      items: [],
      interactive_answers: [],
      language: docLanguage
    };
    setSections([...sections, newSec]);
  };

  const handleRemoveSection = (index) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette section ?")) {
      setSections(sections.filter((_, i) => i !== index));
    }
  };

  const handleUpdateSection = (index, field, value) => {
    setSections(sections.map((sec, i) => i === index ? { ...sec, [field]: value } : sec));
  };

  // Close apply style dropdown menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => setApplyStyleMenuIndex(null);
    if (applyStyleMenuIndex !== null) {
      window.addEventListener('click', handleOutsideClick);
      return () => window.removeEventListener('click', handleOutsideClick);
    }
  }, [applyStyleMenuIndex]);

  // Apply single section's styling to all or scoped sections + Auto-save to DB
  const handleApplySectionStyleToAll = async (sourceIndex, targetScope = 'all') => {
    const source = sections[sourceIndex];
    if (!source) return;
    const { bgColor = 'transparent', fontSize = '', lineHeight = '' } = source;
    
    const updatedSections = sections.map(s => {
      if (targetScope === 'exercises' && s.type !== 'exercise') return s;
      if (targetScope === 'course' && s.type === 'exercise') return s;
      return { 
        ...s, 
        bgColor, 
        bg_color: bgColor,
        fontSize, 
        font_size: fontSize,
        lineHeight, 
        line_height: lineHeight 
      };
    });
    setSections(updatedSections);

    const scopeNames = {
      all: isArMode ? 'جميع أقسام وتمارين الملف' : 'toutes les sections et exercices',
      exercises: isArMode ? 'جميع تمارين الملف فقط' : 'tous les exercices uniquement',
      course: isArMode ? 'جميع فقرات الدرس فقط' : 'toutes les sections de cours uniquement'
    };

    // Auto-save immediately to database & localStorage
    if (id) {
      try {
        await updateLesson(id, {
          title: ficheTitle,
          subject,
          chapterNumber,
          teacher,
          phone,
          schools,
          level: selectedLevel,
          docType: docType,
          columnsCount: Number(columnsCount),
          isActive: isActiveStatus,
          content: {
            level: selectedLevel,
            doc_type: docType,
            columns_count: Number(columnsCount),
            metadata: {
              ...lesson?.content?.metadata,
              language: docLanguage
            },
            header: {
              prep_title: prepTitle,
              schools,
              subject,
              fiche_title: ficheTitle,
              chapter_number: chapterNumber,
              teacher,
              phone,
              capacites_attendues: capacitesAttendues,
              contenus: contenus,
              le_contenu: leContenu
            },
            sections: updatedSections
          }
        });
        setLesson(prev => ({
          ...prev,
          title: ficheTitle,
          subject,
          chapterNumber,
          teacher,
          phone,
          schools,
          level: selectedLevel,
          docType,
          columnsCount: Number(columnsCount),
          isActive: isActiveStatus,
          content: {
            ...(prev?.content || {}),
            level: selectedLevel,
            doc_type: docType,
            columns_count: Number(columnsCount),
            header: {
              ...(prev?.content?.header || {}),
              prep_title: prepTitle,
              schools,
              subject,
              fiche_title: ficheTitle,
              chapter_number: chapterNumber,
              teacher,
              phone
            },
            sections: updatedSections
          }
        }));
        setSuccess(isArMode 
          ? `✓ تم تطبيق التنسيق وحفظه فعلياً في قاعدة البيانات (${scopeNames[targetScope]})!` 
          : `✓ Style appliqué et enregistré dans la base de données (${scopeNames[targetScope]}) !`);
      } catch (err) {
        console.error('Auto-save error:', err);
        setSuccess(isArMode 
          ? `تم تطبيق التنسيق على ${scopeNames[targetScope]}! (يرجى النقر على حفظ لتأكيد التخزين)` 
          : `Style appliqué à ${scopeNames[targetScope]} !`);
      }
    } else {
      setSuccess(isArMode 
        ? `تم تطبيق التنسيق على ${scopeNames[targetScope]}!` 
        : `Style appliqué à ${scopeNames[targetScope]} !`);
    }
    setTimeout(() => setSuccess(''), 4500);
  };

  // Apply global style bar settings to all or scoped sections + Auto-save to DB
  const handleApplyGlobalStyleToAll = async () => {
    const updatedSections = sections.map(s => {
      if (globalScope === 'exercises' && s.type !== 'exercise') return s;
      if (globalScope === 'course' && s.type === 'exercise') return s;
      return { 
        ...s, 
        bgColor: globalBgColor, 
        bg_color: globalBgColor,
        fontSize: globalFontSize, 
        font_size: globalFontSize,
        lineHeight: globalLineHeight, 
        line_height: globalLineHeight 
      };
    });
    setSections(updatedSections);

    const scopeNames = {
      all: isArMode ? 'جميع أقسام وتمارين الملف' : 'toutes les sections et exercices',
      exercises: isArMode ? 'جميع تمارين الملف فقط' : 'tous les exercices uniquement',
      course: isArMode ? 'جميع فقرات الدرس فقط' : 'toutes les sections de cours uniquement'
    };

    if (id) {
      try {
        await updateLesson(id, {
          title: ficheTitle,
          subject,
          chapterNumber,
          teacher,
          phone,
          schools,
          level: selectedLevel,
          docType: docType,
          columnsCount: Number(columnsCount),
          isActive: isActiveStatus,
          content: {
            level: selectedLevel,
            doc_type: docType,
            columns_count: Number(columnsCount),
            metadata: {
              ...lesson?.content?.metadata,
              language: docLanguage
            },
            header: {
              prep_title: prepTitle,
              schools,
              subject,
              fiche_title: ficheTitle,
              chapter_number: chapterNumber,
              teacher,
              phone,
              capacites_attendues: capacitesAttendues,
              contenus: contenus,
              le_contenu: leContenu
            },
            sections: updatedSections
          }
        });
        setLesson(prev => ({
          ...prev,
          title: ficheTitle,
          subject,
          chapterNumber,
          teacher,
          phone,
          schools,
          level: selectedLevel,
          docType,
          columnsCount: Number(columnsCount),
          isActive: isActiveStatus,
          content: {
            ...(prev?.content || {}),
            level: selectedLevel,
            doc_type: docType,
            columns_count: Number(columnsCount),
            header: {
              ...(prev?.content?.header || {}),
              prep_title: prepTitle,
              schools,
              subject,
              fiche_title: ficheTitle,
              chapter_number: chapterNumber,
              teacher,
              phone
            },
            sections: updatedSections
          }
        }));
        setSuccess(isArMode 
          ? `✓ تم تطبيق التنسيق الموحد وحفظه فعلياً في قاعدة البيانات (${scopeNames[globalScope]})!` 
          : `✓ Style global appliqué et enregistré dans la base de données (${scopeNames[globalScope]}) !`);
      } catch (err) {
        console.error('Auto-save error:', err);
        setSuccess(isArMode 
          ? `تم تطبيق التنسيق على ${scopeNames[globalScope]}!` 
          : `Style global appliqué avec succès à ${scopeNames[globalScope]} !`);
      }
    } else {
      setSuccess(isArMode 
        ? `تم تطبيق التنسيق الموحد على ${scopeNames[globalScope]}!` 
        : `Style global appliqué avec succès à ${scopeNames[globalScope]} !`);
    }
    setTimeout(() => setSuccess(''), 4500);
  };

  const handleMoveSection = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newSections = [...sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;
    setSections(newSections);
  };

  // Content items manipulation helpers
  const handleAddItemToContentSection = (secIndex, itemType = 'text') => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        let newItem = { type: itemType, text: '' };
        if (itemType === 'table') {
          newItem = {
            type: 'table',
            table_data: {
              headers: ['Colonne 1', 'Colonne 2', 'Colonne 3'],
              rows: [['Donnée 1', 'Donnée 2', 'Donnée 3']]
            }
          };
        } else if (itemType === 'notation_grid') {
          newItem = {
            type: 'notation_grid',
            notation_columns: [{ title: '• Notation', math_blocks: ['f(x)'] }]
          };
        }
        return {
          ...sec,
          items: [...(sec.items || []), newItem]
        };
      }
      return sec;
    }));
  };

  const handleRemoveItemFromContentSection = (secIndex, itemIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        return {
          ...sec,
          items: sec.items.filter((_, idx) => idx !== itemIndex)
        };
      }
      return sec;
    }));
  };

  const handleUpdateContentItem = (secIndex, itemIndex, field, value) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        const newItems = sec.items.map((item, idx) => {
          if (idx === itemIndex) {
            return { ...item, [field]: value };
          }
          return item;
        });
        return { ...sec, items: newItems };
      }
      return sec;
    }));
  };

  const handleMoveItem = (secIndex, itemIndex, direction) => {
    const sec = sections[secIndex];
    if (!sec || !sec.items) return;
    if (direction === 'up' && itemIndex === 0) return;
    if (direction === 'down' && itemIndex === sec.items.length - 1) return;
    const targetIdx = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    const newItems = [...sec.items];
    const temp = newItems[itemIndex];
    newItems[itemIndex] = newItems[targetIdx];
    newItems[targetIdx] = temp;
    
    setSections(sections.map((s, i) => i === secIndex ? { ...s, items: newItems } : s));
  };

  const handleAddInteractiveAnswer = (secIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        const nextIdx = (sec.interactive_answers?.length || 0) + 1;
        return {
          ...sec,
          interactive_answers: [...(sec.interactive_answers || []), { question_idx: nextIdx, label: '', expected_answer: '' }]
        };
      }
      return sec;
    }));
  };

  const handleRemoveInteractiveAnswer = (secIndex, ansIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        return {
          ...sec,
          interactive_answers: (sec.interactive_answers || []).filter((_, idx) => idx !== ansIndex)
        };
      }
      return sec;
    }));
  };

  const handleUpdateInteractiveAnswer = (secIndex, ansIndex, field, value) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        const newAns = (sec.interactive_answers || []).map((ans, idx) => {
          if (idx === ansIndex) {
            return { ...ans, [field]: value };
          }
          return ans;
        });
        return { ...sec, interactive_answers: newAns };
      }
      return sec;
    }));
  };

  const handleOpenCropperModal = (secIdx, itemIdx = null) => {
    setCropperTarget({ secIdx, itemIdx });
    setIsCropperOpen(true);
  };

  // Smart cursor-aware LaTeX / Text insertion
  const insertTextOrSnippet = (snippet) => {
    const el = activeTextareaRef.current;
    
    // Check if target is a valid input/textarea element in the DOM
    if (el && document.body.contains(el)) {
      const start = el.selectionStart ?? el.value?.length ?? 0;
      const end = el.selectionEnd ?? el.value?.length ?? 0;
      const val = el.value || '';
      
      // Check if cursor is currently inside math mode ($...$)
      const prefix = val.substring(0, start);
      const dollarCount = (prefix.match(/(?<!\\)\$/g) || []).length;
      const isInsideMath = (dollarCount % 2 === 1);

      let textToInsert = snippet;
      const isFormulaSnippet = snippet.startsWith('\\') || snippet.startsWith('$') || snippet.includes('\\');

      if (isFormulaSnippet) {
        if (isInsideMath) {
          // If already inside $...$, strip outer $ if present
          if (textToInsert.startsWith('$') && textToInsert.endsWith('$') && textToInsert.length >= 2) {
            textToInsert = textToInsert.slice(1, -1);
          }
        } else {
          // If outside $...$, ensure it is wrapped in $
          if (!textToInsert.startsWith('$') && !textToInsert.endsWith('$')) {
            textToInsert = `$${textToInsert}$`;
          }
        }
      }

      // If user had text selected, see if we can wrap it (e.g. \frac, \sqrt)
      const selected = val.substring(start, end);
      if (selected) {
        if (textToInsert.includes('{a}')) {
          textToInsert = textToInsert.replace('{a}', `{${selected}}`);
        } else if (textToInsert.includes('{x}')) {
          textToInsert = textToInsert.replace('{x}', `{${selected}}`);
        }
      }

      const newVal = val.substring(0, start) + textToInsert + val.substring(end);
      
      // Update relevant state
      if (activeFieldTarget) {
        const { secIdx, itemIdx, field } = activeFieldTarget;
        if (field === 'ficheTitle') {
          setFicheTitle(newVal);
        } else if (field === 'capacites') {
          setCapacitesAttendues(newVal);
        } else if (field === 'contenus') {
          setContenus(newVal);
        } else if (field === 'sectionTitle' && secIdx !== undefined) {
          handleUpdateSection(secIdx, 'title', newVal);
        } else if ((field === 'exerciseContent' || field === 'sectionContent') && secIdx !== undefined) {
          handleUpdateSection(secIdx, 'content', newVal);
        } else if ((field === 'exerciseSolution' || field === 'sectionSolution') && secIdx !== undefined) {
          handleUpdateSection(secIdx, 'solution', newVal);
        } else if (field === 'itemText' && secIdx !== undefined && itemIdx !== null && itemIdx !== undefined) {
          handleUpdateContentItem(secIdx, itemIdx, 'text', newVal);
        }
      } else {
        el.value = newVal;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Restore focus and cursor position right after insertion
      requestAnimationFrame(() => {
        el.focus();
        const nextPos = start + textToInsert.length;
        el.setSelectionRange(nextPos, nextPos);
      });
      return;
    }

    // Fallback if no ref or active element
    if (!activeFieldTarget) {
      if (sections.length > 0) {
        const lastIdx = sections.length - 1;
        handleUpdateSection(lastIdx, 'content', (sections[lastIdx].content || '') + ' ' + snippet);
      }
      return;
    }

    const { secIdx, itemIdx, field } = activeFieldTarget;
    if (field === 'ficheTitle') {
      setFicheTitle(prev => prev + ' ' + snippet);
    } else if (field === 'capacites') {
      setCapacitesAttendues(prev => prev + ' ' + snippet);
    } else if (field === 'contenus') {
      setContenus(prev => prev + ' ' + snippet);
    } else if (field === 'sectionTitle' && secIdx !== undefined) {
      handleUpdateSection(secIdx, 'title', (sections[secIdx]?.title || '') + ' ' + snippet);
    } else if ((field === 'exerciseContent' || field === 'sectionContent') && secIdx !== undefined) {
      handleUpdateSection(secIdx, 'content', (sections[secIdx]?.content || '') + ' ' + snippet);
    } else if ((field === 'exerciseSolution' || field === 'sectionSolution') && secIdx !== undefined) {
      handleUpdateSection(secIdx, 'solution', (sections[secIdx]?.solution || '') + ' ' + snippet);
    } else if (field === 'itemText' && secIdx !== undefined && itemIdx !== null && itemIdx !== undefined) {
      const curr = sections[secIdx]?.items?.[itemIdx]?.text || '';
      handleUpdateContentItem(secIdx, itemIdx, 'text', curr + ' ' + snippet);
    }
  };

  // AI-Powered Exercise Solver
  const handleAiSolveExercise = async (secIdx) => {
    const sec = sections[secIdx];
    if (!sec) return;
    
    const contentToSolve = (sec.content || '').trim();
    if (!contentToSolve) {
      alert(isArMode ? 'يرجى كتابة نص التمرين أولاً ليتمكن الذكاء الاصطناعي من حله.' : "Veuillez d'abord rédiger l'énoncé de l'exercice avant de demander sa résolution par IA.");
      return;
    }

    if (sec.solution && sec.solution.trim()) {
      const confirmOverwrite = window.confirm(
        isArMode
          ? 'يوجد حل مسجل بالفعل لهذا التمرين. هل تريد استبداله بحل مفصل جديد تم توليده بالذكاء الاصطناعي؟'
          : 'Un corrigé existe déjà pour cet exercice. Voulez-vous le remplacer par une nouvelle solution détaillée générée par IA ?'
      );
      if (!confirmOverwrite) return;
    }

    setSolvingSecIdx(secIdx);
    setError('');
    try {
      const generatedSolution = await solveExerciseWithAI(contentToSolve, {
        level: selectedLevel,
        subject: subject || (isArMode ? 'الرياضيات' : 'Mathématiques'),
        language: docLanguage || (isArMode ? 'ar' : 'fr'),
        docTitle: ficheTitle || '',
        chapterTitle: ficheTitle || '',
        sectionTitle: sec.title || sec.section_header || '',
        secType: sec.type || 'exercise',
        docType: docType || 'course',
        capacitesAttendues: capacitesAttendues || '',
        contenus: contenus || ''
      });

      const repairedSolution = filterBaremeByDocType(autoRepairMathText(generatedSolution), docType || 'course', ficheTitle);
      handleUpdateSection(secIdx, 'solution', repairedSolution);
      setSuccess(isArMode ? 'تم حل التمرين بالذكاء الاصطناعي بنجاح ✓' : 'Corrigé généré par IA avec succès ✓');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      console.error('AI Solving Error:', err);
      alert(err.message || 'فشل توليد الحل بالذكاء الاصطناعي.');
    } finally {
      setSolvingSecIdx(null);
    }
  };

  // AI-Powered Bulk Exercise Solver (Moroccan Inspector Method)
  const handleAiSolveAllExercises = async () => {
    const exerciseSections = sections
      .map((sec, idx) => ({ ...sec, idx }))
      .filter(sec => (sec.type === 'exercise' || sec.type === 'activity') && (sec.content || '').trim().length > 0);

    if (exerciseSections.length === 0) {
      alert(isArMode ? 'لا توجد تمارين أو تطبيقات تحتوي على نص لحلها في هذه الوثيقة.' : "Aucun exercice ou application contenant un énoncé n'a été trouvé dans ce document.");
      return;
    }

    const confirmMsg = isArMode
      ? `سيتم حل ${exerciseSections.length} تمرين/تطبيق بالذكاء الاصطناعي وفق التوجيهات التربوية المغربية ومنهجية المفتش التربوي لمادة الرياضيات. هل تريد المتابعة؟`
      : `Résoudre ${exerciseSections.length} exercices/applications par IA selon les Orientations Pédagogiques Marocaines (Méthode de l'Inspecteur). Continuer ?`;
    if (!window.confirm(confirmMsg)) return;

    setSolvingAll(true);
    setError('');
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < exerciseSections.length; i++) {
      const ex = exerciseSections[i];
      setSolveAllProgress({ current: i + 1, total: exerciseSections.length, title: ex.title || `Exercice ${i + 1}` });
      setSolvingSecIdx(ex.idx);

      try {
        const generated = await solveExerciseWithAI(ex.content.trim(), {
          level: selectedLevel,
          subject: subject || (isArMode ? 'الرياضيات' : 'Mathématiques'),
          language: docLanguage || (isArMode ? 'ar' : 'fr'),
          docTitle: ficheTitle || '',
          chapterTitle: ficheTitle || '',
          sectionTitle: ex.title || ex.section_header || '',
          secType: ex.type || 'exercise',
          docType: docType || 'course',
          capacitesAttendues: capacitesAttendues || '',
          contenus: contenus || ''
        });

        const repaired = filterBaremeByDocType(autoRepairMathText(generated), docType || 'course', ficheTitle);
        handleUpdateSection(ex.idx, 'solution', repaired);
        successCount++;
      } catch (err) {
        console.error(`AI Bulk Solve error on exercise ${ex.idx}:`, err);
        failCount++;
      }
    }

    setSolvingSecIdx(null);
    setSolvingAll(false);
    setSolveAllProgress(null);

    const resultMsg = isArMode
      ? `اكتمل الحل: تم حل ${successCount} تمرين بنجاح وفق التوجيهات المغربية ${failCount > 0 ? `(وفشل ${failCount})` : ''} ✓`
      : `Résolution terminée : ${successCount} exercices résolus avec succès selon les normes officielles marocaines ${failCount > 0 ? `(${failCount} échecs)` : ''} ✓`;
    setSuccess(resultMsg);
    setTimeout(() => setSuccess(''), 4500);
  };

  // Direct Image Insertion Handler (Paste, Drag&Drop, Upload, Camera)
  const handleDirectImageInsert = async (dataUrl, alt = 'Figure') => {
    setHasUnsavedChanges(true);
    let finalUrl = dataUrl;
    try {
      const pathName = `lessons/${id || 'draft'}/${Date.now()}_fig.png`;
      finalUrl = await uploadAsset(dataUrl, pathName);
    } catch (_) {}

    let targetSecIdx = activeFieldTarget?.secIdx;
    if (targetSecIdx === undefined || targetSecIdx === null || !sections[targetSecIdx]) {
      targetSecIdx = sections.length > 0 ? sections.length - 1 : 0;
    }
    
    if (sections.length === 0) {
      const newSec = {
        id: 'sec-img-' + Date.now(),
        title: isArMode ? 'قسم مع شكل توضيحي' : 'Section avec Figure',
        type: 'content',
        section_number: '',
        section_header: '',
        accent_text: '',
        items: [{ type: 'image', url: finalUrl, alt, width_pct: 80, align: 'center', position: 'after' }],
        language: docLanguage
      };
      setSections([newSec]);
      return;
    }

    setSections(prev => {
      const next = [...prev];
      const sec = { ...next[targetSecIdx] };
      const items = Array.isArray(sec.items) ? [...sec.items] : [];
      const newImageItem = {
        type: 'image',
        url: finalUrl,
        alt,
        width_pct: 80,
        align: 'center',
        position: 'after'
      };
      items.push(newImageItem);
      sec.items = items;
      next[targetSecIdx] = sec;
      return next;
    });
  };

  // Save changes
  const handleSaveLesson = async () => {
    if (!ficheTitle.trim() || !subject.trim()) {
      setError('Le titre et la matière sont obligatoires.');
      return;
    }

    isSavingRef.current = true;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const cleanedSections = sections.map(sec => ({
        ...sec,
        bgColor: sec.bgColor || sec.bg_color || 'transparent',
        bg_color: sec.bgColor || sec.bg_color || 'transparent',
        fontSize: sec.fontSize || sec.font_size || '',
        font_size: sec.fontSize || sec.font_size || '',
        lineHeight: sec.lineHeight || sec.line_height || '',
        line_height: sec.lineHeight || sec.line_height || '',
        content: autoRepairMathText(sec.content),
        solution: autoRepairMathText(sec.solution),
        items: (sec.items || []).map(it => ({
          ...it,
          text: autoRepairMathText(it.text || it.content)
        }))
      }));

      const lessonData = {
        title: ficheTitle,
        subject,
        chapterNumber,
        teacher,
        phone,
        schools,
        level: selectedLevel,
        docType: docType,
        columnsCount: Number(columnsCount),
        isActive: isActiveStatus,
        content: {
          level: selectedLevel,
          doc_type: docType,
          columns_count: Number(columnsCount),
          metadata: {
            ...lesson?.content?.metadata,
            language: docLanguage
          },
          header: {
            prep_title: prepTitle,
            schools,
            subject,
            fiche_title: ficheTitle,
            chapter_number: chapterNumber,
            teacher,
            phone,
            capacites_attendues: capacitesAttendues,
            contenus: contenus,
            leContenu: leContenu
          },
          sections: cleanedSections
        }
      };

      const syncResult = await updateLesson(id, lessonData);
      
      // Update baseline snapshot to the exact saved state
      lastSavedSnapshotRef.current = computeStateSnapshot(cleanedSections, {
        ficheTitle,
        subject,
        chapterNumber,
        teacher,
        phone,
        prepTitle,
        selectedLevel,
        docType,
        docLanguage,
        schools,
        isActiveStatus,
        columnsCount: Number(columnsCount),
        capacitesAttendues,
        contenus,
        leContenu
      });

      setSections(cleanedSections);
      setLesson(prev => ({
        ...prev,
        ...lessonData,
        content: {
          ...(prev?.content || {}),
          ...lessonData.content
        }
      }));

      setHasUnsavedChanges(false);
      const nowFormatted = new Date().toLocaleTimeString(isArMode ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(nowFormatted);
      setDbSyncStatus(syncResult);

      try {
        sessionStorage.removeItem(`lconq_draft_${id}`);
        localStorage.removeItem(`lconq_draft_${id}`);
      } catch (_) {}

      const isCloudSuccess = syncResult?.supabaseSuccess || syncResult?.neonSuccess;
      const cloudError = syncResult?.supabaseError || syncResult?.neonError;

      if (isCloudSuccess && syncResult?.localDbSuccess) {
        setSuccess(isArMode 
          ? `✓ تم حفظ التعديلات والمزامنة بنجاح في قاعدة البيانات السحابية والمحلية [${nowFormatted}]` 
          : `✓ Fiche enregistrée et synchronisée avec la base Cloud et locale [${nowFormatted}]`);
      } else if (isCloudSuccess) {
        setSuccess(isArMode 
          ? `✓ تم الحفظ بنجاح في قاعدة البيانات السحابية [${nowFormatted}]` 
          : `✓ Synchronisé avec succès dans la base Cloud [${nowFormatted}]`);
      } else if (syncResult?.localDbSuccess) {
        setSuccess(isArMode 
          ? `✓ تم الحفظ في قاعدة البيانات المحلية [${nowFormatted}] (المزامنة السحابية ستكتمل تلقائياً عند عودة الاتصال)` 
          : `✓ Enregistré dans la base locale [${nowFormatted}] (Sync Cloud dès reconnexion)`);
      } else if (cloudError) {
        setError(isArMode 
          ? `تنبيه: تم حفظ التعديل محلياً فقط. تعذرت المزامنة السحابية: ${cloudError}` 
          : `Attention : Enregistré en local uniquement. Échec de synchronisation Cloud : ${cloudError}`);
      } else {
        setSuccess(isArMode 
          ? `✓ تم حفظ التعديلات في الذاكرة المؤقتة [${nowFormatted}]` 
          : `✓ Fiche enregistrée dans le cache [${nowFormatted}]`);
      }
      setTimeout(() => {
        setSuccess('');
      }, 4500);
    } catch (e) {
      console.error(e);
      setError(isArMode 
        ? `فشل الحفظ في قاعدة البيانات: ${e.message}` 
        : `Erreur lors de l'enregistrement dans la base de données : ${e.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => {
        isSavingRef.current = false;
      }, 300);
    }
  };

  // Keyboard shortcut for quick save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveLesson();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ficheTitle, subject, chapterNumber, teacher, phone, prepTitle, selectedLevel, docType, docLanguage, sections, capacitesAttendues, contenus, leContenu]);

  const isArMode = docLanguage === 'ar' || /[\u0600-\u06FF]/.test(ficheTitle + ' ' + subject + ' ' + (sections || []).map(s => s.title + ' ' + (s.content || '')).join(' '));

  const currentModeInfo = (() => {
    if (docType === 'exercises') {
      return {
        id: 'exercises',
        titleAr: 'وضع تعديل السلاسل',
        titleFr: 'Mode Série d\'Exercices',
        badgeAr: 'سلسلة تمارين تطبيقية',
        badgeFr: 'Série d\'exercices',
        color: '#10b981',
        bgSoft: 'rgba(16, 185, 129, 0.12)',
        borderSoft: 'rgba(16, 185, 129, 0.3)',
        gradient: 'linear-gradient(135deg, #059669, #10b981)',
        icon: Layers,
        descAr: 'تنظيم سلاسل التمارين التطبيقية، إعداد أعمدة العرض، الحلول النموذجية وسلم التنقيط',
        descFr: 'Organisation des séries d\'exercices, mise en colonnes, solutions et barèmes'
      };
    }
    if (docType === 'national' || docType === 'homework' || docType === 'concours') {
      return {
        id: 'exam',
        titleAr: 'وضع تعديل الامتحانات والفروض',
        titleFr: 'Mode Examens & Devoirs',
        badgeAr: docType === 'national' ? 'امتحان وطني موحد' : docType === 'homework' ? 'فرض محروس' : 'مباراة ولوج',
        badgeFr: docType === 'national' ? 'Examen National' : docType === 'homework' ? 'Devoir Surveillé' : 'Concours d\'accès',
        color: '#ef4444',
        bgSoft: 'rgba(239, 68, 68, 0.12)',
        borderSoft: 'rgba(239, 68, 68, 0.3)',
        gradient: 'linear-gradient(135deg, #b91c1c, #ef4444)',
        icon: Award,
        descAr: 'إعداد مواضيع الامتحانات الوطنية، الفروض المحروسة ومباريات المعاهد والمدارس العليا',
        descFr: 'Conception des examens nationaux, épreuves de contrôle et concours'
      };
    }
    if (docType === 'ebook') {
      return {
        id: 'ebook',
        titleAr: 'وضع تعديل الكتب الإلكترونية (E-Book)',
        titleFr: 'Mode E-Book (Édition 3 Colonnes)',
        badgeAr: 'كتاب إلكتروني E-Book',
        badgeFr: 'E-Book',
        color: '#005086',
        bgSoft: 'rgba(0, 80, 134, 0.12)',
        borderSoft: 'rgba(0, 80, 134, 0.35)',
        gradient: 'linear-gradient(135deg, #003865, #0284c7)',
        icon: BookOpen,
        descAr: 'قالب الكتاب الإلكتروني الاحترافي في 3 أعمدة مع الترويسة المعاد تصميمها',
        descFr: 'Édition E-Book haute fidélité en 3 colonnes avec entête éditoriale repensée'
      };
    }
    return {
      id: 'course',
      titleAr: 'وضع تعديل الدروس والملخصات',
      titleFr: 'Mode Cours & Résumés',
      badgeAr: docType === 'summary' ? 'ملخص درس' : 'درس نظري',
      badgeFr: docType === 'summary' ? 'Résumé de cours' : 'Cours théorique',
      color: '#0284c7',
      bgSoft: 'rgba(2, 132, 199, 0.12)',
      borderSoft: 'rgba(2, 132, 199, 0.3)',
      gradient: 'linear-gradient(135deg, #005086, #0284c7)',
      icon: BookOpen,
      descAr: 'صياغة الدروس النظرية، التعريفات، الخاصيات، المبرهنات التوليدية والأمثلة التطبيقية',
      descFr: 'Rédaction des cours théoriques, définitions, propriétés, théorèmes et exemples'
    };
  })();

  const handleToggleClass = (className) => {
    if (!className) return;
    setSchools(prev => {
      const exists = prev.includes(className);
      if (exists) {
        return prev.filter(c => c !== className);
      } else {
        return [...prev, className];
      }
    });
  };

  const handleAddCustomClass = () => {
    const trimmed = customClassInput.trim();
    if (trimmed && !schools.includes(trimmed)) {
      setSchools(prev => [...prev, trimmed]);
      setCustomClassInput('');
    }
  };

  // ── RENDER SIMPLIFIED DOCUMENT METADATA PANEL ──
  const renderGeneralInfoPanel = () => {
    return (
      <div 
        style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border)', 
          borderRadius: '12px', 
          padding: '0.85rem 1.25rem', 
          marginBottom: '1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
        }}
      >
        {/* Top summary bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Settings2 size={16} style={{ color: 'var(--violet)' }} />
              Informations du document
            </span>
            <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--violet)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
              {getLevelDisplayName(selectedLevel, isArMode)}
            </span>
            <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
              {DOC_TYPES.find(d => d.id === docType)?.[isArMode ? 'labelAr' : 'labelFr'] || docType}
            </span>
            <span style={{ background: isActiveStatus ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)', color: isActiveStatus ? 'var(--emerald)' : 'var(--text-muted)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
              {isActiveStatus ? '● Active' : '○ Masquée'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsGeneralInfoExpanded(prev => !prev)}
            className="lesson-general-info-toggle"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            {isGeneralInfoExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{isGeneralInfoExpanded ? 'Réduire' : 'Modifier'}</span>
          </button>
        </div>

        {/* Simplified Collapsible Body */}
        {isGeneralInfoExpanded && (
          <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* ROW 1: Titre, Niveau, Type, Colonnes */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (docType === 'exercises' ? '2.2fr 1.2fr 1fr 1.1fr' : '2.5fr 1.3fr 1.2fr'), gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Titre du document
                </label>
                <input 
                  type="text" 
                  className="input-control" 
                  value={ficheTitle} 
                  onChange={e => setFicheTitle(e.target.value)}
                  placeholder="Ex : Limites et continuité" 
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem 0.6rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Niveau scolaire
                </label>
                <select 
                  className="input-control" 
                  value={selectedLevel} 
                  onChange={e => setSelectedLevel(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.5rem' }}
                >
                  {MOROCCAN_LEVELS.map(lvl => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.labelFr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Type de document
                </label>
                <select 
                  className="input-control" 
                  value={docType} 
                  onChange={e => setDocType(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.5rem' }}
                >
                  {DOC_TYPES.map(dt => (
                    <option key={dt.id} value={dt.id}>
                      {dt.labelFr}
                    </option>
                  ))}
                </select>
              </div>

              {docType === 'exercises' && (
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                    Colonnes (Série)
                  </label>
                  <select 
                    className="input-control" 
                    value={columnsCount} 
                    onChange={e => setColumnsCount(Number(e.target.value))}
                    style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.5rem', fontWeight: 700 }}
                  >
                    <option value={3}>3 Colonnes (Compact)</option>
                    <option value={2}>2 Colonnes (Standard)</option>
                    <option value={1}>1 Colonne (Pleine page)</option>
                  </select>
                </div>
              )}
            </div>

            {/* ROW 2: Professeur, Téléphone, Chapitre, Langue, Statut */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr 0.8fr 1fr 1.2fr', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Professeur
                </label>
                <input 
                  type="text" 
                  className="input-control" 
                  value={teacher} 
                  onChange={e => setTeacher(e.target.value)}
                  placeholder="Ex : Pr. Zayani" 
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Téléphone
                </label>
                <input 
                  type="text" 
                  className="input-control" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)}
                  placeholder="06XXXXXXXX" 
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Chapitre
                </label>
                <input 
                  type="text" 
                  className="input-control" 
                  value={chapterNumber} 
                  onChange={e => setChapterNumber(e.target.value)}
                  placeholder="Ex : 01" 
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Languages size={12} /> Langue
                </label>
                <select 
                  className="input-control" 
                  value={docLanguage} 
                  onChange={e => setDocLanguage(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.5rem' }}
                >
                  <option value="fr">Français</option>
                  <option value="ar">Arabe</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Statut
                </label>
                <button
                  type="button"
                  onClick={() => setIsActiveStatus(prev => !prev)}
                  style={{
                    width: '100%',
                    padding: '0.42rem 0.6rem',
                    borderRadius: '6px',
                    border: isActiveStatus ? '1px solid var(--emerald)' : '1px solid var(--border)',
                    background: isActiveStatus ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                    color: isActiveStatus ? 'var(--emerald)' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActiveStatus ? 'var(--emerald)' : 'var(--text-muted)' }} />
                  {isActiveStatus ? 'Active' : 'Masquée'}
                </button>
              </div>
            </div>

            {/* ROW 3: Classes (Compact Selector) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <School size={13} /> Classes :
              </span>

              {/* Class Dropdown to add */}
              {availableClasses.length > 0 && (
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) handleToggleClass(e.target.value);
                  }}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  <option value="">+ Assigner une classe...</option>
                  {availableClasses.map(c => (
                    <option key={c.id || c.name} value={c.name} disabled={schools.includes(c.name)}>
                      {schools.includes(c.name) ? `✓ ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Quick custom class input */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="text"
                  placeholder="+ Classe personnalisée..."
                  value={customClassInput}
                  onChange={e => setCustomClassInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomClass(); } }}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '5px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', width: '150px' }}
                />
                {customClassInput && (
                  <button
                    type="button"
                    onClick={handleAddCustomClass}
                    style={{ background: 'var(--violet)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    +
                  </button>
                )}
              </div>

              {/* Selected class badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                {schools.map(sch => (
                  <span
                    key={sch}
                    style={{
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      color: 'var(--violet)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    {sch}
                    <X
                      size={11}
                      onClick={() => handleToggleClass(sch)}
                      style={{ cursor: 'pointer', opacity: 0.7 }}
                    />
                  </span>
                ))}
                {schools.length === 0 && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    (Toutes les classes)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Role Guard (Must run after all hooks to strictly adhere to React rules of hooks)
  if (!authLoading && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 className="animate-spin text-violet" size={48} />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Chargement de l'éditeur Office Word...</p>
      </div>
    );
  }

  // ── RENDER LIVE WORD DOCUMENT SHEET ──
  const renderLiveWordDocument = () => {
    return (
      <div className="word-paper-canvas" style={{
        background: '#ffffff',
        color: '#0f172a',
        borderRadius: '8px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)',
        padding: isMobile ? '1.25rem' : '2.5rem 3rem',
        minHeight: '1000px',
        border: '1px solid #e2e8f0',
        position: 'relative',
        direction: isArMode ? 'rtl' : 'ltr',
        fontFamily: isArMode ? "'Cairo', 'Amiri', 'Segoe UI', Tahoma, sans-serif" : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
        {/* Paper Watermark / Header Line */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #005086',
          paddingBottom: '0.6rem',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
          color: '#005086',
          fontWeight: 700
        }}>
          <div>
            <input
              type="text"
              value={prepTitle}
              onChange={e => setPrepTitle(e.target.value)}
              placeholder="Préparation aux concours..."
              style={{ border: 'none', background: 'transparent', color: '#005086', fontWeight: 800, fontSize: '0.85rem', width: '260px', outline: 'none' }}
            />
          </div>
          <div style={{ textAlign: 'center', color: '#dc2626', fontWeight: 900, fontSize: '0.95rem' }}>
            {renderWithMath(ficheTitle || 'Titre du document')}
          </div>
          <div style={{ textAlign: isArMode ? 'left' : 'right' }}>
            <input
              type="text"
              value={teacher}
              onChange={e => setTeacher(e.target.value)}
              placeholder="Professeur..."
              style={{ border: 'none', background: 'transparent', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem', textAlign: isArMode ? 'left' : 'right', width: '160px', outline: 'none' }}
            />
          </div>
        </div>

        {/* Pedagogical Header Block Table (Editable directly for ALL document types) */}
        {(() => {
          const docTypeConfig = {
            course: {
              badge: 'COURS (درس)',
              placeholder: 'TITRE DU COURS...',
              col1Title: isArMode ? 'القدرات المنتظرة' : 'LES CAPACITÉS ATTENDUES',
              col1Placeholder: 'Entrez les capacités attendues...',
              col2Title: isArMode ? 'المحتويات' : 'CONTENUS DU COURS',
              col2Placeholder: 'Entrez les contenus du cours...'
            },
            summary: {
              badge: 'RÉSUMÉ (ملخص)',
              placeholder: 'TITRE DU RÉSUMÉ DE COURS...',
              col1Title: isArMode ? 'المفاهيم والخاصيات الأساسية' : 'NOTIONS & FORMULES CLÉS',
              col1Placeholder: 'Entrez les notions essentielles...',
              col2Title: isArMode ? 'المكتسبات القبلية' : 'PRÉREQUIS & RAPPELS',
              col2Placeholder: 'Entrez les prérequis...'
            },
            exercises: {
              badge: 'EXERCICES (تمارين)',
              placeholder: 'TITRE DE LA SÉRIE D\'EXERCICES...',
              col1Title: isArMode ? 'الأهداف والكفايات' : 'OBJECTIFS & COMPÉTENCES',
              col1Placeholder: 'Entrez les objectifs de la série...',
              col2Title: isArMode ? 'المفاهيم المستهدفة' : 'NOTIONS COUVERTES',
              col2Placeholder: 'Entrez les notions couvertes...'
            },
            homework: {
              badge: 'DEVOIR (فرض)',
              placeholder: 'TITRE DU DEVOIR SURVEILLÉ...',
              col1Title: isArMode ? 'تعليمات وإرشادات' : 'CONSIGNES & BARÈME',
              col1Placeholder: 'Entrez les consignes, durée, calculatrice...',
              col2Title: isArMode ? 'المحاور والدروس' : 'CHAPITRES ÉVALUÉS',
              col2Placeholder: 'Entrez les chapitres du devoir...'
            },
            national: {
              badge: 'EXAMEN (امتحان)',
              placeholder: 'TITRE DE L\'EXAMEN NATIONAL...',
              col1Title: isArMode ? 'الدورة والشعبة' : 'SESSION & FILIÈRE',
              col1Placeholder: 'Session normale / rattrapage, filière...',
              col2Title: isArMode ? 'المدة والمعامل' : 'DURÉE & COEFFICIENT',
              col2Placeholder: 'Durée de l\'épreuve, coefficient, consignes...'
            },
            concours: {
              badge: 'CONCOURS (مباراة)',
              placeholder: 'TITRE DU CONCOURS D\'ACCÈS...',
              col1Title: isArMode ? 'المؤسسة والاختبار' : 'ÉCOLE & ÉPREUVE',
              col1Placeholder: 'ENSA, ENSAM, Médecine, CNC...',
              col2Title: isArMode ? 'شروط وإرشادات' : 'CONSIGNES & DURÉE',
              col2Placeholder: 'Durée, barème négatif, calculatrice...'
            },
            ebook: {
              badge: 'E-BOOK (كتاب إلكتروني)',
              placeholder: 'TITRE DE L\'E-BOOK...',
              col1Title: isArMode ? 'محاور الكتاب الإلكتروني' : 'AXES & OBJECTIFS',
              col1Placeholder: 'Entrez les axes de l\'E-Book...',
              col2Title: isArMode ? 'المحتويات والتمارين' : 'CONTENUS & SECTIONS',
              col2Placeholder: 'Entrez les contenus de l\'E-Book...'
            }
          };
          const cfg = docTypeConfig[docType] || docTypeConfig.course;

          return (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid #005086',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '1.5rem',
              background: '#ffffff'
            }}>
              <tbody>
                {/* Title row */}
                <tr>
                  <td colSpan={2} style={{
                    background: '#005086',
                    color: '#ffffff',
                    textAlign: 'center',
                    padding: '0.6rem 1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                      <span style={{
                        background: 'rgba(255,255,255,0.2)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em'
                      }}>
                        {cfg.badge}
                      </span>
                      <input
                        type="text"
                        value={ficheTitle}
                        onChange={e => setFicheTitle(e.target.value)}
                        onFocus={() => setActiveFieldTarget({ field: 'ficheTitle' })}
                        placeholder={cfg.placeholder}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          color: '#ffffff',
                          border: 'none',
                          textAlign: 'center',
                          fontWeight: 900,
                          fontSize: '1.15rem',
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                  </td>
                </tr>
                {/* Objectives 2 columns */}
                <tr className="lesson-ped-table-row">
                  <td style={{ width: '50%', padding: '0.5rem', borderRight: '1.5px solid #005086', borderBottom: '1.5px solid #005086', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#005086', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                      {cfg.col1Title}
                    </div>
                    <textarea
                      value={capacitesAttendues}
                      onChange={e => setCapacitesAttendues(e.target.value)}
                      onFocus={() => setActiveFieldTarget({ field: 'capacites' })}
                      placeholder={cfg.col1Placeholder}
                      rows={2}
                      className="lesson-section-textarea"
                      style={{ width: '100%', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.35rem', fontSize: '0.8rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                    />
                  </td>
                  <td style={{ width: '50%', padding: '0.5rem', borderBottom: '1.5px solid #005086', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#005086', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                      {cfg.col2Title}
                    </div>
                    <textarea
                      value={contenus}
                      onChange={e => setContenus(e.target.value)}
                      onFocus={() => setActiveFieldTarget({ field: 'contenus' })}
                      placeholder={cfg.col2Placeholder}
                      rows={2}
                      className="lesson-section-textarea"
                      style={{ width: '100%', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.35rem', fontSize: '0.8rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          );
        })()}

        {/* ── Document Body Sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {sections.map((sec, secIdx) => {
            const isExercise = sec.type === 'exercise';
            const blockColors = {
              definition: { border: '#0284c7', bg: '#f0f9ff', title: '#0369a1', badge: 'DÉFINITION (تعريف)' },
              property: { border: '#10b981', bg: '#ecfdf5', title: '#047857', badge: 'PROPRIÉTÉ (خاصية)' },
              theorem: { border: '#8b5cf6', bg: '#f5f3ff', title: '#6d28d9', badge: 'THÉORÈME (مبرهنة)' },
              corollary: { border: '#6366f1', bg: '#eef2ff', title: '#4338ca', badge: 'COROLLAIRE (نتيجة)' },
              remark: { border: '#f59e0b', bg: '#fffbeb', title: '#b45309', badge: 'REMARQUE (ملاحظة)' },
              example: { border: '#14b8a6', bg: '#f0fdfa', title: '#0f766e', badge: 'EXEMPLE (مثال)' },
              activity: { border: '#ec4899', bg: '#fdf2f8', title: '#be185d', badge: 'ACTIVITÉ (تطبيق)' },
              exercise: { border: '#ef4444', bg: '#fef2f2', title: '#b91c1c', badge: 'EXERCICE (تمرين)' },
              content: { border: '#005086', bg: '#f8fafc', title: '#005086', badge: 'COURS (درس)' }
            };
            const currentStyle = blockColors[sec.type] || blockColors.content;

            return (
              <div
                key={sec.id || secIdx}
                className="word-section-block lesson-section-block"
                style={{
                  border: `1.5px solid ${currentStyle.border}45`,
                  borderInlineStart: `5px solid ${currentStyle.border}`,
                  borderRadius: '10px',
                  background: sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : currentStyle.bg,
                  padding: isMobile ? '0.85rem' : '1.35rem',
                  position: 'relative',
                  transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
                  boxShadow: '0 3px 12px rgba(0,0,0,0.04)'
                }}
              >
                {/* Section Controls Bar (Pinned Top Right/Left) */}
                <div style={{
                  position: 'absolute',
                  top: '0.65rem',
                  right: isArMode ? 'auto' : '0.65rem',
                  left: isArMode ? '0.65rem' : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(255, 255, 255, 0.94)',
                  backdropFilter: 'blur(8px)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  zIndex: 10
                }}>
                  <select
                    value={sec.type}
                    onChange={e => handleUpdateSection(secIdx, 'type', e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      color: currentStyle.title,
                      outline: 'none',
                      cursor: 'pointer',
                      padding: '0.1rem 0.2rem'
                    }}
                  >
                    <option value="content">{isArMode ? 'فقرة درس عامة' : 'Cours (Général)'}</option>
                    <option value="definition">{isArMode ? 'تعريف' : 'Définition'}</option>
                    <option value="property">{isArMode ? 'خاصية' : 'Propriété'}</option>
                    <option value="theorem">{isArMode ? 'مبرهنة' : 'Théorème'}</option>
                    <option value="corollary">{isArMode ? 'نتيجة' : 'Corollaire'}</option>
                    <option value="remark">{isArMode ? 'ملاحظة' : 'Remarque'}</option>
                    <option value="example">{isArMode ? 'مثال تطبيقي' : 'Exemple'}</option>
                    <option value="activity">{isArMode ? 'نشاط' : 'Activité'}</option>
                    <option value="exercise">{isArMode ? 'تمرين' : 'Exercice'}</option>
                  </select>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <button
                    type="button"
                    onClick={() => handleMoveSection(secIdx, 'up')}
                    disabled={secIdx === 0}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: secIdx === 0 ? 'not-allowed' : 'pointer',
                      opacity: secIdx === 0 ? 0.25 : 1,
                      padding: '2px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={isArMode ? 'نقل للأعلى' : 'Monter'}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveSection(secIdx, 'down')}
                    disabled={secIdx === sections.length - 1}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: secIdx === sections.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: secIdx === sections.length - 1 ? 0.25 : 1,
                      padding: '2px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={isArMode ? 'نقل للأسفل' : 'Descendre'}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(secIdx)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={isArMode ? 'حذف هذه الفقرة' : 'Supprimer'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Section Title & Pill Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                  <span style={{
                    background: currentStyle.border,
                    color: '#ffffff',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    letterSpacing: '0.04em'
                  }}>
                    {currentStyle.badge}
                  </span>

                  <input
                    type="text"
                    value={sec.title || ''}
                    onChange={e => handleUpdateSection(secIdx, 'title', e.target.value)}
                    onFocus={() => setActiveFieldTarget({ secIdx, field: 'sectionTitle' })}
                    placeholder="Titre de la section / du théorème..."
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      color: currentStyle.title,
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* ── Unified Section Body (All Section Types) ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  
                  {/* Primary Statement / Content Block */}
                  <div style={{
                    background: sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : '#ffffff',
                    padding: '0.85rem',
                    borderRadius: '6px',
                    border: `1.5px solid ${currentStyle.border}35`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 900, color: currentStyle.title, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {sec.type === 'exercise' ? <><FileText size={14} /> <span>Énoncé de l'Exercice :</span></> :
                         sec.type === 'definition' ? <><BookOpen size={14} /> <span>Énoncé de la Définition :</span></> :
                         sec.type === 'property' ? <><Zap size={14} /> <span>Énoncé de la Propriété :</span></> :
                         sec.type === 'theorem' ? <><Award size={14} /> <span>Énoncé du Théorème :</span></> :
                         sec.type === 'corollary' ? <><Link2 size={14} /> <span>Énoncé du Corollaire :</span></> :
                         sec.type === 'remark' ? <><MessageSquare size={14} /> <span>Remarque :</span></> :
                         sec.type === 'example' ? <><Search size={14} /> <span>Exemple d'application :</span></> :
                         sec.type === 'activity' ? <><Target size={14} /> <span>Énoncé de l'Activité :</span></> :
                         <><BookOpen size={14} /> <span>Contenu de la Section :</span></>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* Compact Section Style Popover */}
                  <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setApplyStyleMenuIndex(prev => prev === `style-${secIdx}` ? null : `style-${secIdx}`)}
                      className="mode-pill-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        background: applyStyleMenuIndex === `style-${secIdx}` ? '#e0f2fe' : '#f8fafc',
                        border: `1px solid ${applyStyleMenuIndex === `style-${secIdx}` ? '#0284c7' : '#cbd5e1'}`,
                        color: applyStyleMenuIndex === `style-${secIdx}` ? '#0284c7' : '#475569',
                        cursor: 'pointer'
                      }}
                      title={isArMode ? "تخصيص التنسيق (الخلفية، حجم الخط، التباعد)" : "Personnaliser le style de cette section"}
                    >
                      <Paintbrush size={12} style={{ color: '#005086' }} />
                      <span>{isArMode ? 'تنسيق الفقرة' : 'Style'}</span>
                      <ChevronDown size={11} />
                    </button>

                    {applyStyleMenuIndex === `style-${secIdx}` && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: isArMode ? 0 : 'auto',
                        left: isArMode ? 'auto' : 0,
                        zIndex: 100,
                        marginTop: '6px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        padding: '0.75rem',
                        minWidth: '260px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        direction: isArMode ? 'rtl' : 'ltr'
                      }}>
                        {/* Background Color */}
                        <div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem' }}>
                            {isArMode ? 'لون الخلفية :' : 'Couleur de fond :'}
                          </div>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {[
                              { label: 'Sans fond', val: 'transparent', color: '#ffffff', border: '#cbd5e1' },
                              { label: 'Bleu doux', val: '#f0f9ff', color: '#f0f9ff', border: '#bae6fd' },
                              { label: 'Jaune doux', val: '#fefce8', color: '#fefce8', border: '#fef08a' },
                              { label: 'Vert menthe', val: '#f0fdf4', color: '#f0fdf4', border: '#bbf7d0' },
                              { label: 'Gris élégant', val: '#f8fafc', color: '#f8fafc', border: '#e2e8f0' },
                              { label: 'Rose pastel', val: '#fff1f2', color: '#fff1f2', border: '#fecdd3' },
                            ].map(c => (
                              <button
                                key={c.val}
                                type="button"
                                onClick={() => handleUpdateSection(secIdx, 'bgColor', (sec.bgColor || 'transparent') === c.val ? 'transparent' : c.val)}
                                title={c.label}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: c.color,
                                  border: `2px solid ${(sec.bgColor || 'transparent') === c.val ? '#005086' : c.border}`,
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              />
                            ))}
                            <input
                              type="color"
                              value={sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : '#ffffff'}
                              onChange={e => handleUpdateSection(secIdx, 'bgColor', e.target.value)}
                              title="Couleur personnalisée"
                              style={{ width: '20px', height: '20px', padding: 0, border: 'none', borderRadius: '3px', cursor: 'pointer', background: 'transparent' }}
                            />
                          </div>
                        </div>

                        {/* Font Size & Line Height in Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <div>
                            <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>
                              {isArMode ? 'حجم الخط :' : 'Taille :'}
                            </label>
                            <select
                              value={sec.fontSize || ''}
                              onChange={e => handleUpdateSection(secIdx, 'fontSize', e.target.value)}
                              style={{ width: '100%', fontSize: '0.72rem', padding: '3px 4px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: 600, outline: 'none' }}
                            >
                              <option value="">Normal (9.2pt)</option>
                              <option value="8pt">8pt (Compact)</option>
                              <option value="8.5pt">8.5pt</option>
                              <option value="9.2pt">9.2pt</option>
                              <option value="10pt">10pt</option>
                              <option value="11pt">11pt (Grand)</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>
                              {isArMode ? 'التباعد :' : 'Interligne :'}
                            </label>
                            <select
                              value={sec.lineHeight || ''}
                              onChange={e => handleUpdateSection(secIdx, 'lineHeight', e.target.value)}
                              style={{ width: '100%', fontSize: '0.72rem', padding: '3px 4px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: 600, outline: 'none' }}
                            >
                              <option value="">Normal (1.55)</option>
                              <option value="1.3">1.3 (Serré)</option>
                              <option value="1.55">1.55</option>
                              <option value="1.75">1.75</option>
                              <option value="2.0">2.0</option>
                            </select>
                          </div>
                        </div>

                        {/* Batch Apply Buttons */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              handleApplySectionStyleToAll(secIdx, 'all');
                              setApplyStyleMenuIndex(null);
                            }}
                            style={{
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              textAlign: isArMode ? 'right' : 'left',
                              background: '#eff6ff',
                              color: '#005086',
                              border: '1px solid #bfdbfe',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            📑 {isArMode ? 'تطبيق التنسيق على كامل الوثيقة' : 'Appliquer à tout le document'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleApplySectionStyleToAll(secIdx, 'exercises');
                              setApplyStyleMenuIndex(null);
                            }}
                            style={{
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textAlign: isArMode ? 'right' : 'left',
                              background: 'transparent',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              color: '#1e293b'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            📝 {isArMode ? 'تطبيق على التمارين فقط' : 'Appliquer aux exercices'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                        <span style={{ color: '#cbd5e1' }}>|</span>

                        {/* LaTeX Palette Trigger Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFieldTarget({ secIdx, field: 'sectionContent' });
                            setIsLatexPaletteOpen(prev => !prev);
                          }}
                          title="نافذة رموز وصيغ لاتك (LaTeX Palette)"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: isLatexPaletteOpen && activeFieldTarget?.secIdx === secIdx ? '#005086' : '#eff6ff',
                            color: isLatexPaletteOpen && activeFieldTarget?.secIdx === secIdx ? '#ffffff' : '#005086',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            padding: '0.15rem 0.5rem',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Sparkles size={12} style={{ color: isLatexPaletteOpen && activeFieldTarget?.secIdx === secIdx ? '#fef08a' : '#2563eb' }} />
                          <span>رموز LaTeX</span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={sec.content || ''}
                      onChange={e => handleUpdateSection(secIdx, 'content', e.target.value)}
                      onFocus={e => {
                        activeTextareaRef.current = e.target;
                        setActiveFieldTarget({ secIdx, field: 'sectionContent' });
                        if (sec.type === 'exercise') {
                          setIsLatexPaletteOpen(true);
                        }
                      }}
                      onClick={e => { activeTextareaRef.current = e.target; }}
                      onKeyUp={e => { activeTextareaRef.current = e.target; }}
                      onSelect={e => { activeTextareaRef.current = e.target; }}
                      placeholder={sec.type === 'exercise' ? "Écrivez l'énoncé de l'exercice (utilisez $...$ pour les formules KaTeX)..." : "Écrivez le contenu, la définition ou le théorème (utilisez $...$ pour les formules KaTeX)..."}
                      rows={Math.max(3, (sec.content || '').split('\n').length)}
                      style={{
                        width: '100%',
                        border: `1px dashed ${currentStyle.border}70`,
                        borderRadius: '4px',
                        padding: '0.55rem',
                        fontSize: sec.fontSize || '0.88rem',
                        lineHeight: sec.lineHeight || 1.55,
                        background: sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : '#ffffff',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                    {sec.content && (
                      <div style={{
                        marginTop: '0.4rem',
                        padding: '0.45rem 0.65rem',
                        background: sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : currentStyle.bg,
                        borderRadius: '4px',
                        border: `1px solid ${currentStyle.border}35`,
                        fontSize: sec.fontSize || '0.85rem',
                        lineHeight: sec.lineHeight || 1.55
                      }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: currentStyle.title, display: 'block', marginBottom: '2px' }}>
                          Aperçu direct (KaTeX) :
                        </span>
                        <div>{renderWithMath(sec.content)}</div>
                      </div>
                    )}
                  </div>

                  {/* Secondary Card: Corrigé Détaillé / Démonstration / Remarque */}
                  <div style={{
                    background: '#ffffff',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: sec.type === 'exercise' ? '1px solid #86efac' : '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      color: sec.type === 'exercise' ? '#15803d' : '#475569',
                      marginBottom: '0.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.35rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {sec.type === 'exercise' ? <><CheckCircle size={14} style={{ color: '#15803d' }} /> <span>Corrigé Détaillé :</span></> :
                         sec.type === 'theorem' || sec.type === 'property' || sec.type === 'corollary' ? <><HelpCircle size={14} style={{ color: '#475569' }} /> <span>Démonstration (Preuve) :</span></> :
                         <><Info size={14} style={{ color: '#475569' }} /> <span>Démonstration / Remarques :</span></>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handleAiSolveExercise(secIdx)}
                          disabled={solvingSecIdx === secIdx}
                          style={{
                            background: solvingSecIdx === secIdx
                              ? '#e2e8f0'
                              : 'linear-gradient(135deg, #059669, #10b981)',
                            border: 'none',
                            borderRadius: '5px',
                            padding: '0.25rem 0.7rem',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            color: solvingSecIdx === secIdx ? '#64748b' : '#ffffff',
                            cursor: solvingSecIdx === secIdx ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: solvingSecIdx === secIdx ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                          title={isArMode ? "حل التمرين خطوة بخطوة بالذكاء الاصطناعي مع التعليل والصيغ" : "Résoudre l'exercice étape par étape par IA"}
                        >
                          {solvingSecIdx === secIdx ? (
                            <>
                              <Loader2 className="animate-spin" size={12} />
                              <span>{isArMode ? 'جاري حل التمرين...' : 'Résolution IA...'}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} style={{ color: '#fef08a' }} />
                              <span>
                                {sec.type === 'exercise' 
                                  ? (isArMode ? 'حل التمرين بالذكاء' : 'Résoudre avec l\'IA') 
                                  : (isArMode ? 'برهان بالذكاء' : 'Démontrer par IA')}
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveFieldTarget({ secIdx, field: 'sectionSolution' });
                            setIsLatexPaletteOpen(true);
                          }}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '5px',
                            padding: '0.22rem 0.45rem',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                          title="نافذة رموز لاتك للحل"
                        >
                          <span>رموز LaTeX</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={sec.solution || ''}
                      onChange={e => handleUpdateSection(secIdx, 'solution', e.target.value)}
                      onFocus={e => {
                        activeTextareaRef.current = e.target;
                        setActiveFieldTarget({ secIdx, field: 'sectionSolution' });
                        if (sec.type === 'exercise') {
                          setIsLatexPaletteOpen(true);
                        }
                      }}
                      onClick={e => { activeTextareaRef.current = e.target; }}
                      onKeyUp={e => { activeTextareaRef.current = e.target; }}
                      onSelect={e => { activeTextareaRef.current = e.target; }}
                      placeholder={sec.type === 'exercise' ? "Écrivez la solution détaillée..." : "Écrivez la démonstration, remarques ou compléments (optionnel)..."}
                      rows={sec.solution ? Math.max(3, (sec.solution || '').split('\n').length) : 2}
                      style={{
                        width: '100%',
                        border: sec.type === 'exercise' ? '1px dashed #86efac' : '1px dashed #cbd5e1',
                        borderRadius: '4px',
                        padding: '0.5rem',
                        fontSize: '0.88rem',
                        outline: 'none',
                        fontFamily: 'inherit',
                        background: sec.type === 'exercise' ? '#f0fdf4' : '#fafafa'
                      }}
                    />
                    {sec.solution && (
                      <div style={{
                        marginTop: '0.35rem',
                        padding: '0.45rem 0.65rem',
                        background: sec.type === 'exercise' ? '#f0fdf4' : '#f8fafc',
                        borderRadius: '4px',
                        border: '1px solid ' + (sec.type === 'exercise' ? '#dcfce7' : '#e2e8f0'),
                        fontSize: '0.85rem'
                      }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: sec.type === 'exercise' ? '#15803d' : '#64748b', display: 'block', marginBottom: '2px' }}>
                          Aperçu (KaTeX) :
                        </span>
                        <div>{renderWithMath(sec.solution)}</div>
                      </div>
                    )}
                  </div>

                  {/* Attached Figures & PDF Cropper for ALL sections */}
                  {Array.isArray(sec.items) && sec.items.filter(i => i.type === 'image').length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '0.75rem', background: '#f8fafc' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <ImageIcon size={14} style={{ color: '#005086' }} /> Figures et Graphiques attachés :
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{sec.items.filter(i => i.type === 'image').length} figure(s)</span>
                      </div>
                      {sec.items.map((it, itIdx) => {
                        if (it.type !== 'image') return null;
                        return (
                          <div key={itIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                            {/* Top Row: Preview, Caption & Delete */}
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ position: 'relative', width: '90px', height: '65px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <img src={it.url} alt={it.alt || ''} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                <span style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.62rem', padding: '1px 4px', borderRadius: '3px' }}>
                                  {it.width_pct || 80}%
                                </span>
                              </div>
                              
                              <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>Légende / Titre de la figure :</label>
                                <input
                                  type="text"
                                  value={it.alt || ''}
                                  onChange={e => handleUpdateContentItem(secIdx, itIdx, 'alt', e.target.value)}
                                  placeholder="Figure géométrique, schéma..."
                                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%' }}
                                />
                              </div>

                              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAiEnhancer(secIdx, itIdx, it)}
                                  style={{
                                    background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                                    border: '1px solid #c4b5fd',
                                    borderRadius: '4px',
                                    padding: '0.35rem 0.6rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    color: '#6d28d9',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    boxShadow: '0 1px 2px rgba(109,40,217,0.1)'
                                  }}
                                  title="Améliorer la qualité ou régénérer la figure avec l'IA"
                                >
                                  <Sparkles size={12} style={{ color: '#7c3aed' }} /> Régénérer / HD IA
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCropperTarget({ secIdx, itemIdx: itIdx });
                                    setIsCropperOpen(true);
                                  }}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                  title="Recadrer depuis PDF"
                                >
                                  <Crop size={12} /> Recadrer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemFromContentSection(secIdx, itIdx)}
                                  style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: '4px', padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                                  title="Supprimer la figure"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Controls Row: Alignment, Size (Width %) & Position */}
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0', fontSize: '0.75rem' }}>
                              {/* Alignment */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontWeight: 700, color: '#475569' }}>الموقع / Position :</span>
                                <div style={{ display: 'inline-flex', borderRadius: '4px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                                  {[
                                    { id: 'left', label: 'اليسار (Gauche)', icon: <AlignLeft size={13} /> },
                                    { id: 'center', label: 'الوسط (Centré)', icon: <AlignCenter size={13} /> },
                                    { id: 'right', label: 'اليمين (Droite)', icon: <AlignRight size={13} /> }
                                  ].map(pos => {
                                    const isSelected = (it.align || 'center') === pos.id;
                                    return (
                                      <button
                                        key={pos.id}
                                        type="button"
                                        onClick={() => handleUpdateContentItem(secIdx, itIdx, 'align', pos.id)}
                                        style={{
                                          background: isSelected ? '#005086' : '#ffffff',
                                          color: isSelected ? '#ffffff' : '#475569',
                                          border: 'none',
                                          padding: '0.25rem 0.5rem',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center'
                                        }}
                                        title={pos.label}
                                      >
                                        {pos.icon}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Size / Width Presets & Slider */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '210px' }}>
                                <span style={{ fontWeight: 700, color: '#475569' }}>الحجم / Largeur :</span>
                                <div style={{ display: 'flex', gap: '0.2rem' }}>
                                  {[30, 50, 75, 100].map(pct => {
                                    const isSelected = (it.width_pct || 80) === pct;
                                    return (
                                      <button
                                        key={pct}
                                        type="button"
                                        onClick={() => handleUpdateContentItem(secIdx, itIdx, 'width_pct', pct)}
                                        style={{
                                          background: isSelected ? '#4f46e5' : '#f1f5f9',
                                          color: isSelected ? '#ffffff' : '#334155',
                                          border: '1px solid ' + (isSelected ? '#4338ca' : '#cbd5e1'),
                                          borderRadius: '3px',
                                          padding: '0.15rem 0.35rem',
                                          fontSize: '0.7rem',
                                          fontWeight: isSelected ? 800 : 600,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {pct}%
                                      </button>
                                    );
                                  })}
                                </div>
                                <input
                                  type="range"
                                  min="20"
                                  max="100"
                                  step="5"
                                  value={it.width_pct || 80}
                                  onChange={e => handleUpdateContentItem(secIdx, itIdx, 'width_pct', Number(e.target.value))}
                                  style={{ flex: 1, minWidth: '55px', height: '4px', accentColor: '#4f46e5', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 800, color: '#4f46e5', minWidth: '32px', textAlign: 'right' }}>
                                  {it.width_pct || 80}%
                                </span>
                              </div>

                              {/* Position in Section: Before / After */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontWeight: 700, color: '#475569' }}>الموضع :</span>
                                <select
                                  value={it.position || 'after'}
                                  onChange={e => handleUpdateContentItem(secIdx, itIdx, 'position', e.target.value)}
                                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', color: '#1e293b' }}
                                >
                                  <option value="after">En bas (بعد النص)</option>
                                  <option value="before">En haut (قبل النص)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Section Bottom Media Insertion Bar */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setCropperTarget({ secIdx, itemIdx: null });
                        setIsCropperOpen(true);
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '4px',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#6d28d9',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Crop size={13} /> + Figure PDF
                    </button>
                    <ImageDropZone
                      compact
                      onImageInsert={async (dataUrl, alt) => {
                        setHasUnsavedChanges(true);
                        let finalUrl = dataUrl;
                        try {
                          const pathName = `lessons/${id || 'draft'}/${Date.now()}_sec_${secIdx}.png`;
                          finalUrl = await uploadAsset(dataUrl, pathName);
                        } catch (_) {}
                        setSections(prev => {
                          const next = [...prev];
                          const sec = { ...next[secIdx] };
                          const items = Array.isArray(sec.items) ? [...sec.items] : [];
                          items.push({ type: 'image', url: finalUrl, alt, width_pct: 80, align: 'center', position: 'after' });
                          sec.items = items;
                          next[secIdx] = sec;
                          return next;
                        });
                      }}
                    />
                  </div>

                </div>
              </div>
            );
          })}

          {/* Quick Add Section Buttons on Canvas - Tailored to current active mode */}
          <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', margin: '2.5rem 0 1rem', flexWrap: 'wrap' }}>
            {docType === 'exercises' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleAddSection('exercise')}
                  className="mode-pill-btn"
                  style={{
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.8rem 1.65rem',
                    borderRadius: '10px',
                    fontWeight: 900,
                    fontSize: '0.94rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    boxShadow: '0 4px 18px rgba(16,185,129,0.35)'
                  }}
                >
                  <Plus size={18} />
                  <span>{isArMode ? '+ إضافة تمرين جديد للسلسلة' : '+ Ajouter un Exercice à la Série'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSection('activity')}
                  className="mode-pill-btn"
                  style={{
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1.5px solid #cbd5e1',
                    padding: '0.8rem 1.35rem',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <Target size={16} style={{ color: '#ec4899' }} />
                  <span>{isArMode ? '+ نشاط تطبيقي' : '+ Activité d\'application'}</span>
                </button>
              </>
            ) : (docType === 'national' || docType === 'homework' || docType === 'concours') ? (
              <>
                <button
                  type="button"
                  onClick={() => handleAddSection('exercise')}
                  className="mode-pill-btn"
                  style={{
                    background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.8rem 1.65rem',
                    borderRadius: '10px',
                    fontWeight: 900,
                    fontSize: '0.94rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    boxShadow: '0 4px 18px rgba(239,68,68,0.35)'
                  }}
                >
                  <Award size={18} />
                  <span>{isArMode ? '+ إضافة تمرين / مسألة امتحان' : '+ Ajouter un Exercice / Problème d\'Examen'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSection('content')}
                  className="mode-pill-btn"
                  style={{
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1.5px solid #cbd5e1',
                    padding: '0.8rem 1.35rem',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <FileText size={16} style={{ color: '#0284c7' }} />
                  <span>{isArMode ? '+ ديباجة / تعليمات الامتحان' : '+ Consignes / Préambule'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleAddSection('content')}
                  className="mode-pill-btn"
                  style={{
                    background: 'linear-gradient(135deg, #005086, #0284c7)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.8rem 1.5rem',
                    borderRadius: '10px',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 18px rgba(0,80,134,0.3)'
                  }}
                >
                  <BookOpen size={18} />
                  <span>{isArMode ? '+ إضافة فقرة درس' : '+ Section de Cours'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSection('definition')}
                  className="mode-pill-btn"
                  style={{
                    background: 'rgba(2, 132, 199, 0.08)',
                    color: '#0284c7',
                    border: '1.5px solid rgba(2, 132, 199, 0.35)',
                    padding: '0.8rem 1.25rem',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <BookOpen size={16} />
                  <span>{isArMode ? '+ تعريف' : '+ Définition'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSection('theorem')}
                  className="mode-pill-btn"
                  style={{
                    background: 'rgba(139, 92, 246, 0.08)',
                    color: '#7c3aed',
                    border: '1.5px solid rgba(139, 92, 246, 0.35)',
                    padding: '0.8rem 1.25rem',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <Award size={16} />
                  <span>{isArMode ? '+ مبرهنة' : '+ Théorème'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSection('exercise')}
                  className="mode-pill-btn"
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#dc2626',
                    border: '1.5px solid rgba(239, 68, 68, 0.35)',
                    padding: '0.8rem 1.25rem',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <Plus size={16} />
                  <span>{isArMode ? '+ تمرين تطبيقي' : '+ Exercice d\'application'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── RENDER STRUCTURED IMAGE ITEM (For Structured Block Mode) ──
  const renderStructuredImageItem = (item, secIdx, itemIdx) => {
    const hasUrl = Boolean(item.url || item.src);
    const imageUrl = item.url || item.src;

    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        background: hasUrl ? 'rgba(16,185,129,0.04)' : 'rgba(99,102,241,0.04)',
        padding: '0.85rem',
        borderRadius: '10px',
        border: `1.5px dashed ${hasUrl ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.35)'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '0.2rem 0.6rem',
            borderRadius: '99px',
            background: hasUrl ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
            color: hasUrl ? '#10b981' : 'var(--violet)',
            border: `1px solid ${hasUrl ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.25)'}`
          }}>
            {hasUrl ? '✅ Figure renseignée' : '🖼️ Emplacement de figure / forme géométrique'}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {hasUrl && (
              <button
                type="button"
                onClick={() => handleOpenAiEnhancer(secIdx, itemIdx, item)}
                className="btn-outline"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: '#8b5cf6', borderColor: 'rgba(139,92,246,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                title="Régénérer ou améliorer par IA"
              >
                <Sparkles size={11} /> IA HD
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenCropperModal(secIdx, itemIdx)}
              className="btn-outline"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: 'var(--emerald)', borderColor: 'rgba(16,185,129,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              title="قص / استخراج شكل من ملف PDF"
            >
              <Crop size={11} /> ✂️ قص من PDF
            </button>
          </div>
        </div>

        {hasUrl ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
              <img
                src={imageUrl}
                alt={item.alt || 'Figure'}
                style={{ display: 'block', maxWidth: '140px', maxHeight: '110px', objectFit: 'contain' }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%' }}>
              <input
                type="text"
                className="input-control"
                value={item.alt || ''}
                onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'alt', e.target.value)}
                placeholder="Légende / Titre de la figure..."
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Alignement :</span>
                {['left', 'center', 'right'].map(align => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => handleUpdateContentItem(secIdx, itemIdx, 'align', align)}
                    className="btn-outline"
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.72rem',
                      background: (item.align || 'center') === align ? 'var(--violet)' : 'transparent',
                      color: (item.align || 'center') === align ? '#fff' : 'var(--text-main)',
                      borderColor: (item.align || 'center') === align ? 'var(--violet)' : 'var(--border)'
                    }}
                  >
                    {align === 'left' ? 'Gauche' : align === 'center' ? 'Centré' : 'Droite'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <button
              type="button"
              onClick={() => handleOpenCropperModal(secIdx, itemIdx)}
              className="btn"
              style={{
                flex: 1,
                padding: '0.55rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, var(--violet), #8b5cf6)',
                justifyContent: 'center',
                gap: '0.4rem',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <Crop size={14} /> ✂️ قص شكل من مستند الـ PDF
            </button>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-main)'
              }}
            >
              <ImageIcon size={14} /> 📁 رفع صورة من الجهاز
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = ev => handleUpdateContentItem(secIdx, itemIdx, 'url', ev.target.result);
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          </div>
        )}
      </div>
    );
  };

  // ── RENDER STRUCTURED BLOCKS EDITOR (Mode Blocs Structurés / Formulaire) ──
  const renderStructuredBlocksEditor = () => {
    return (
      <div className="glass-panel" style={{ padding: isMobile ? '1rem' : '2rem', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {/* Header: Title + Action buttons */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            📝 Sections du Cours / Exercices
          </h2>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleAddSection('content')}
              className="btn-outline"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={14} /> + Section Théorique
            </button>
            <button
              type="button"
              onClick={() => handleAddSection('exercise')}
              className="btn-outline"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={14} /> + Exercice
            </button>
          </div>
        </div>

        {/* Sections List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {sections.map((sec, secIdx) => {
            const isExercise = sec.type === 'exercise';
            const scoreBalance = isExercise ? validateExercisePoints(sec) : null;

            return (
              <div
                key={sec.id || secIdx}
                className={docLanguage === 'ar' ? 'rtl-section' : 'ltr-section'}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: isMobile ? '1rem' : '1.5rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  position: 'relative'
                }}
              >
                {/* Delete Button & Quick Crop Header */}
                <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', zIndex: 5 }}>
                  <button
                    type="button"
                    onClick={() => handleMoveSection(secIdx, 'up')}
                    disabled={secIdx === 0}
                    className="btn-outline"
                    style={{ padding: '0.3rem 0.4rem', opacity: secIdx === 0 ? 0.3 : 1 }}
                    title="Monter"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveSection(secIdx, 'down')}
                    disabled={secIdx === sections.length - 1}
                    className="btn-outline"
                    style={{ padding: '0.3rem 0.4rem', opacity: secIdx === sections.length - 1 ? 0.3 : 1 }}
                    title="Descendre"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenCropperModal(secIdx)}
                    className="btn-outline"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--emerald)', borderColor: 'rgba(16,185,129,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    title="قص شكل هندسي من الـ PDF وربطه بهذا القسم"
                  >
                    <Crop size={13} /> ✂️ قص شكل من الـ PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(secIdx)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--danger)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.4rem',
                      cursor: 'pointer'
                    }}
                    title="Supprimer la section"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Section Title & Score Balance Badge */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', width: '100%', marginBottom: '1.25rem', alignItems: 'flex-start', paddingRight: isMobile ? 0 : '240px' }}>
                  <div style={{ flex: 1, width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Titre du Bloc</label>
                      {isExercise && scoreBalance && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 99,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: scoreBalance.isBalanced ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: scoreBalance.isBalanced ? '#10b981' : '#f59e0b',
                          border: `1px solid ${scoreBalance.isBalanced ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                        }}>
                          {scoreBalance.isBalanced ? (
                            <><CheckCircle size={12} /> {scoreBalance.declaredPoints || scoreBalance.calculatedSum} ن متوازنة</>
                          ) : (
                            <><AlertTriangle size={12} /> مجموع الأسئلة: {scoreBalance.calculatedSum} ن / المصرّح به: {scoreBalance.declaredPoints} ن</>
                          )}
                        </span>
                      )}
                    </div>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={sec.title || ''} 
                      onChange={e => handleUpdateSection(secIdx, 'title', e.target.value)}
                      style={{ fontWeight: 800, fontSize: '1rem', width: '100%' }}
                    />
                  </div>
                  <div style={{ width: isMobile ? '100%' : '170px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Type</label>
                    <select 
                      className="input-control"
                      value={sec.type}
                      onChange={e => handleUpdateSection(secIdx, 'type', e.target.value)}
                      style={{ width: '100%', fontWeight: 700 }}
                    >
                      <option value="content">Théorie (Général)</option>
                      <option value="definition">Définition</option>
                      <option value="property">Propriété</option>
                      <option value="theorem">Théorème</option>
                      <option value="corollary">Corollaire</option>
                      <option value="example">Exemple</option>
                      <option value="remark">Remarque</option>
                      <option value="activity">Activité / Application</option>
                      <option value="exercise">Exercice / Corrigé</option>
                    </select>
                  </div>
                </div>

                {/* Section Metadata Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '80px 100px 1.5fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>N° Section</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={sec.section_number || ''} 
                      onChange={e => handleUpdateSection(secIdx, 'section_number', e.target.value)}
                      placeholder="Ex: 1"
                      style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--amber)', fontWeight: 800 }}>⭐ Points</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={sec.points !== undefined && sec.points !== null ? sec.points : ''} 
                      onChange={e => handleUpdateSection(secIdx, 'points', e.target.value)}
                      placeholder="Ex: 3.5"
                      style={{ padding: '0.35rem', fontSize: '0.85rem', borderColor: 'var(--amber)', fontWeight: 800 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>En-tête de Section Pill (ex: Résumé : Suites Numériques)</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={sec.section_header || ''} 
                      onChange={e => handleUpdateSection(secIdx, 'section_header', e.target.value)}
                      placeholder="Laisse vide pour continuer la section précédente"
                      style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sous-titre Accent Vert (ex: Définitions-Notations-Vocabulaire)</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={sec.accent_text || ''} 
                      onChange={e => handleUpdateSection(secIdx, 'accent_text', e.target.value)}
                      placeholder="Optionnel"
                      style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Type 1: Content Block Editor */}
                {sec.type !== 'exercise' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--violet)' }}>Éléments de texte</span>
                      <button type="button" onClick={() => handleAddItemToContentSection(secIdx)} className="btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Plus size={12} /> Ajouter un point
                      </button>
                    </div>

                    {sec.items?.map((item, itemIdx) => (
                      <div key={itemIdx} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'stretch' : 'flex-start', width: '100%' }}>
                        <select
                          className="input-control"
                          value={item.type}
                          onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'type', e.target.value)}
                          style={{ width: isMobile ? '100%' : '160px', flexShrink: 0, padding: '0.4rem' }}
                        >
                          <option value="text">Texte Standard</option>
                          <option value="bullet">Puce (Bullet)</option>
                          <option value="highlight_box">Formule (Encadré)</option>
                          <option value="notation_grid">Grille de Notations</option>
                          <option value="table">Tableau Comparatif</option>
                          <option value="image">🖼️ Figure / Image (شكل/مبيان)</option>
                        </select>

                        {item.type === 'notation_grid' ? (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '0.8rem' }}>Colonnes de Notations :</strong>
                              <button
                                type="button"
                                onClick={() => {
                                  const cols = item.notation_columns || [];
                                  handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', [...cols, { title: '', math_blocks: [''] }]);
                                }}
                                className="btn-outline"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              >
                                + Ajouter Colonne
                              </button>
                            </div>
                            {item.notation_columns?.map((col, colIdx) => (
                              <div key={colIdx} style={{ border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <input
                                    type="text"
                                    className="input-control"
                                    placeholder="Titre de colonne (ex: • Notation fonctionnelle)"
                                    value={col.title || ''}
                                    onChange={e => {
                                      const newCols = item.notation_columns.map((c, ci) => ci === colIdx ? { ...c, title: e.target.value } : c);
                                      handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', newCols);
                                    }}
                                    style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newCols = item.notation_columns.filter((_, ci) => ci !== colIdx);
                                      handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', newCols);
                                    }}
                                    style={{ background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <textarea
                                  className="input-control"
                                  placeholder="Blocs mathématiques (un par ligne, ex: u : E \\rightarrow \\mathbb{R})"
                                  value={col.math_blocks?.join('\n') || ''}
                                  onChange={e => {
                                    const lines = e.target.value.split('\n');
                                    const newCols = item.notation_columns.map((c, ci) => ci === colIdx ? { ...c, math_blocks: lines } : c);
                                    handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', newCols);
                                  }}
                                  rows={2}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : item.type === 'table' ? (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>En-têtes du Tableau (séparés par | )</label>
                              <input
                                type="text"
                                className="input-control"
                                placeholder="ex: Concept | une suite arithmétique | une suite géométrique"
                                value={item.table_data?.headers?.join(' | ') || (Array.isArray(item.headers) ? item.headers.join(' | ') : '')}
                                onChange={e => {
                                  const headers = e.target.value.split('|').map(s => s.trim());
                                  const rows = item.table_data?.rows || item.rows || [[]];
                                  handleUpdateContentItem(secIdx, itemIdx, 'table_data', { headers, rows });
                                  handleUpdateContentItem(secIdx, itemIdx, 'headers', headers);
                                }}
                                style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Lignes du Tableau (une ligne par rangée, cellules séparées par | )</label>
                              <textarea
                                className="input-control"
                                placeholder="ex: Définition | U_{n+1} = U_n + r | U_{n+1} = qU_n"
                                value={(item.table_data?.rows || item.rows || []).map(r => Array.isArray(r) ? r.join(' | ') : String(r)).join('\n')}
                                onChange={e => {
                                  const rows = e.target.value.split('\n').map(line => line.split('|').map(s => s.trim()));
                                  const headers = item.table_data?.headers || item.headers || [];
                                  handleUpdateContentItem(secIdx, itemIdx, 'table_data', { headers, rows });
                                  handleUpdateContentItem(secIdx, itemIdx, 'rows', rows);
                                }}
                                rows={3}
                                style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div style={{ marginTop: '0.4rem' }}>
                              <SmartTableRenderer table={item.table_data || item} />
                            </div>
                          </div>
                        ) : item.type === 'image' ? (
                          renderStructuredImageItem(item, secIdx, itemIdx)
                        ) : (
                          <textarea
                            className="input-control"
                            value={item.text || item.content || ''}
                            onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'text', e.target.value)}
                            placeholder="Entrez le contenu (LaTeX supporté avec $ ... $)"
                            rows={2}
                            style={{ flex: 1, padding: '0.4rem' }}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveItemFromContentSection(secIdx, itemIdx)}
                          style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}
                          title="Supprimer l'élément"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Type 2: Exercise Block Editor */}
                {sec.type === 'exercise' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="input-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ fontWeight: 800 }}>Énoncé de l'Exercice</label>
                        <button
                          type="button"
                          onClick={() => handleAiSolveExercise(secIdx)}
                          disabled={solvingSecIdx === secIdx || saving}
                          className="btn-outline"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: 'var(--violet)', borderColor: 'rgba(99,102,241,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          {solvingSecIdx === secIdx ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          <span>{isArMode ? 'حل التمرين بـ IA' : 'Résoudre par IA'}</span>
                        </button>
                      </div>
                      <textarea
                        className="input-control"
                        value={sec.content || ''}
                        onChange={e => handleUpdateSection(secIdx, 'content', e.target.value)}
                        placeholder="Entrez l'énoncé de l'exercice..."
                        rows={4}
                      />
                    </div>

                    {/* Sub-items & Attached Images Editor for Exercises */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px dashed var(--border)', borderRadius: '8px', padding: '0.75rem', background: 'rgba(255,255,255,0.01)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--violet)' }}>
                          🖼️ عناصر وإشكال التمرين والأسئلة (Éléments & Figures d'exercice)
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenCropperModal(secIdx)}
                            className="btn-outline"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: 'var(--emerald)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="قص شكل من مستند الـ PDF وإدراجه في هذا التمرين"
                          >
                            <Crop size={12} /> ✂️ قص شكل من الـ PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddItemToContentSection(secIdx)}
                            className="btn-outline"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <Plus size={12} /> + إضافة سؤال / شكل صورة
                          </button>
                        </div>
                      </div>

                      {sec.items?.map((item, itemIdx) => (
                        <div key={itemIdx} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'stretch' : 'flex-start', width: '100%' }}>
                          <select
                            className="input-control"
                            value={item.type}
                            onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'type', e.target.value)}
                            style={{ width: isMobile ? '100%' : '160px', flexShrink: 0, padding: '0.4rem' }}
                          >
                            <option value="text">Texte Standard</option>
                            <option value="bullet">Puce / Question</option>
                            <option value="highlight_box">Formule (Encadré)</option>
                            <option value="table">📊 Tableau (جدول/تغيرات)</option>
                            <option value="image">🖼️ Figure / Image (شكل/مبيان)</option>
                          </select>

                          {item.type === 'table' ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                              <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>En-têtes du Tableau (séparés par | )</label>
                                <input
                                  type="text"
                                  className="input-control"
                                  placeholder="ex: x | -\\infty | 0 | +\\infty"
                                  value={(item.table_data?.headers || item.headers || []).join(' | ')}
                                  onChange={e => {
                                    const headers = e.target.value.split('|').map(s => s.trim());
                                    const rows = item.table_data?.rows || item.rows || [[]];
                                    handleUpdateContentItem(secIdx, itemIdx, 'table_data', { headers, rows });
                                    handleUpdateContentItem(secIdx, itemIdx, 'headers', headers);
                                    handleUpdateContentItem(secIdx, itemIdx, 'rows', rows);
                                  }}
                                  style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Lignes du Tableau (une ligne par rangée, cellules séparées par | )</label>
                                <textarea
                                  className="input-control"
                                  placeholder="ex: f'(x) | - | 0 | +&#10;f(x) | +\\infty | \\searrow -2 | \\nearrow +\\infty"
                                  value={(item.table_data?.rows || item.rows || []).map(r => Array.isArray(r) ? r.join(' | ') : String(r)).join('\n')}
                                  onChange={e => {
                                    const rows = e.target.value.split('\n').map(line => line.split('|').map(s => s.trim()));
                                    const headers = item.table_data?.headers || item.headers || [];
                                    handleUpdateContentItem(secIdx, itemIdx, 'table_data', { headers, rows });
                                    handleUpdateContentItem(secIdx, itemIdx, 'headers', headers);
                                    handleUpdateContentItem(secIdx, itemIdx, 'rows', rows);
                                  }}
                                  rows={3}
                                  style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                                />
                              </div>
                              <div style={{ marginTop: '0.4rem' }}>
                                <SmartTableRenderer table={item.table_data || item} />
                              </div>
                            </div>
                          ) : item.type === 'image' ? (
                            renderStructuredImageItem(item, secIdx, itemIdx)
                          ) : (
                            <textarea
                              className="input-control"
                              value={item.text || item.content || ''}
                              onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'text', e.target.value)}
                              placeholder="نص السؤال (LaTeX supporté مع $ ... $)"
                              rows={2}
                              style={{ flex: 1, padding: '0.4rem' }}
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromContentSection(secIdx, itemIdx)}
                            style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}
                            title="Supprimer la question / élément"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="input-group">
                      <label style={{ fontWeight: 800 }}>Solution Détaillée</label>
                      <textarea
                        className="input-control"
                        value={sec.solution || ''}
                        onChange={e => handleUpdateSection(secIdx, 'solution', e.target.value)}
                        placeholder="Entrez la correction rédigée..."
                        rows={6}
                      />
                    </div>

                    {/* Interactive Verification Checks */}
                    <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                          Champs de vérification interactive (Optionnel - Pour s'entraîner)
                        </span>
                        <button type="button" onClick={() => handleAddInteractiveAnswer(secIdx)} className="btn-outline" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Plus size={12} /> Ajouter une question interactive
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {sec.interactive_answers?.map((ans, ansIdx) => (
                          <div key={ansIdx} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'stretch' : 'center', width: '100%' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 900, minWidth: '40px' }}>Q{ans.question_idx} :</span>
                            <input
                              type="text"
                              className="input-control"
                              value={ans.label || ''}
                              onChange={e => handleUpdateInteractiveAnswer(secIdx, ansIdx, 'label', e.target.value)}
                              placeholder="Libellé (ex: Entrez la valeur de x)"
                              style={{ flex: 1, padding: '0.4rem' }}
                            />
                            <input
                              type="text"
                              className="input-control"
                              value={ans.expected_answer || ''}
                              onChange={e => handleUpdateInteractiveAnswer(secIdx, ansIdx, 'expected_answer', e.target.value)}
                              placeholder="Réponse exacte attendue"
                              style={{ width: isMobile ? '100%' : '180px', padding: '0.4rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveInteractiveAnswer(secIdx, ansIdx)}
                              style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}
                              title="Supprimer la question interactive"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const exerciseCount = sections.filter(s => s.type === 'exercise').length;
  const ModeIcon = currentModeInfo.icon;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '6rem', padding: isMobile ? '0 0.5rem 7rem' : '0 0 6rem' }}>
      
      {/* ── Scoped Ergonomic CSS for Office Ribbon and Mobile Responsiveness ── */}
      <style>{`
        .office-ribbon-tabs::-webkit-scrollbar { display: none; }
        .office-ribbon-tabs { -ms-overflow-style: none; scrollbar-width: none; }
        .mode-pill-btn {
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mode-pill-btn:hover {
          transform: translateY(-1px);
        }
        .mode-pill-btn:active {
          transform: scale(0.97);
        }
        .ribbon-action-chip {
          transition: all 0.16s ease;
        }
        .ribbon-action-chip:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
        }

        /* ── Mobile Responsive Overrides ── */
        @media (max-width: 768px) {

          /* Main canvas */
          .word-paper-canvas {
            padding: 1rem 0.75rem !important;
            border-radius: 8px !important;
            min-height: unset !important;
          }

          /* Floating save pill → full-width bottom bar */
          .floating-save-pill {
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
            padding: 0.65rem 1rem !important;
            justify-content: space-between !important;
            background: rgba(10, 15, 30, 0.97) !important;
            backdrop-filter: blur(20px) !important;
            box-shadow: 0 -4px 24px rgba(0,0,0,0.35) !important;
          }
          .floating-save-pill button {
            flex: 1;
            justify-content: center;
            padding: 0.65rem 1rem !important;
            font-size: 0.9rem !important;
          }

          /* Ribbon tabs: icon-only on mobile */
          .office-ribbon-tabs button span { display: none; }
          .office-ribbon-tabs button {
            padding: 0.75rem 0.85rem !important;
            min-width: 48px;
            justify-content: center;
          }
          .office-ribbon-tabs button svg { width: 18px !important; height: 18px !important; }

          /* Ribbon content: horizontal scroll on mobile */
          .word-ribbon-container > div:last-child {
            overflow-x: auto;
            flex-wrap: nowrap !important;
            padding: 0.65rem 0.75rem !important;
            -webkit-overflow-scrolling: touch;
          }

          /* Header: stack vertically */
          .lesson-edit-header-top {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.75rem !important;
          }
          .lesson-edit-header-top > div:last-child {
            width: 100%;
            justify-content: flex-end;
          }

          /* Mode switcher: horizontal scroll */
          .lesson-mode-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.5rem !important;
          }
          .lesson-mode-pills {
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            width: 100%;
            padding-bottom: 0.25rem;
            -webkit-overflow-scrolling: touch;
          }

          /* Pedagogical table: stack columns on mobile */
          .lesson-ped-table-row td {
            display: block !important;
            width: 100% !important;
            border-right: none !important;
          }
          .lesson-ped-table-row td:first-child {
            border-bottom: 1.5px solid #005086;
          }

          /* Section blocks: full padding */
          .lesson-section-block {
            padding: 0.75rem !important;
          }

          /* Input text in paper header: compact */
          .word-paper-canvas input[type=text] {
            font-size: 0.78rem !important;
          }

          /* Section textarea: bigger on mobile */
          .lesson-section-textarea {
            min-height: 120px !important;
            font-size: 0.9rem !important;
            line-height: 1.6 !important;
          }

          /* Title h1: smaller */
          .lesson-edit-title h1 {
            font-size: 1rem !important;
            max-width: 60vw;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          /* Quick action buttons: icon only on very small screens */
          @media (max-width: 480px) {
            .lesson-action-btn span { display: none; }
            .lesson-action-btn { padding: 0.55rem 0.65rem !important; }
          }

          /* Status alerts: compact */
          .lesson-status-alert {
            padding: 0.65rem 0.9rem !important;
            font-size: 0.82rem !important;
          }

          /* General info panel collapsible: touch-friendly toggle */
          .lesson-general-info-toggle {
            min-height: 48px;
          }

          /* Workspace max-width: full on mobile */
          .lesson-edit-workspace {
            max-width: 100% !important;
            padding: 0 0 5rem 0 !important;
          }
        }

        /* Touch devices: larger tap targets */
        @media (hover: none) and (pointer: coarse) {
          .mode-pill-btn {
            min-height: 44px;
          }
          .ribbon-action-chip {
            min-height: 44px;
            min-width: 44px;
          }
          .lesson-section-btn {
            min-height: 44px;
          }
        }

        /* Smooth scroll on iOS */
        .office-ribbon-tabs,
        .lesson-mode-pills,
        .word-ribbon-container > div:last-child {
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }
      `}</style>


      {/* ── Top Header Bar with Dynamic Mode Status & Quick Mode Switcher ── */}
      <header style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1.25rem',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '1.25rem'
      }}>
        
        {/* Upper row: Navigation + Mode Switcher + Action buttons */}
        <div className="lesson-edit-header-top" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          
          {/* Back & Document Title */}
          <div className="lesson-edit-title" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button
              onClick={goBack}
              className="btn-outline"
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 700
              }}
              title="Retour à la liste des fiches"
            >
              <ArrowLeft size={16} />
              <span style={{ fontSize: '0.82rem' }}>Retour</span>
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: isMobile ? '1.2rem' : '1.45rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                  {ficheTitle || (isArMode ? 'وثيقة بيداغوجية غير معنونة' : 'Fiche Pédagogique')}
                </h1>
                <span style={{
                  background: currentModeInfo.bgSoft,
                  color: currentModeInfo.color,
                  border: `1px solid ${currentModeInfo.borderSoft}`,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <ModeIcon size={12} />
                  {isArMode ? currentModeInfo.badgeAr : currentModeInfo.badgeFr}
                </span>
                <span style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: 'var(--violet)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800
                }}>
                  {getLevelDisplayName(selectedLevel, isArMode)}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '3px 0 0' }}>
                {isArMode ? currentModeInfo.descAr : currentModeInfo.descFr}
              </p>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {/* Toggle Settings Drawer / Card */}
            <button
              type="button"
              onClick={() => setIsGeneralInfoExpanded(prev => !prev)}
              className="btn-outline mode-pill-btn lesson-action-btn"
              style={{
                padding: '0.55rem 0.95rem',
                fontSize: '0.84rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                borderRadius: '10px',
                background: isGeneralInfoExpanded ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                borderColor: isGeneralInfoExpanded ? 'var(--violet)' : 'var(--border)',
                color: isGeneralInfoExpanded ? 'var(--violet)' : 'var(--text-main)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}
              title={isArMode ? "إعدادات الوثيقة: المستوى، الشعبة، الأقسام، الكفايات المستهدفة" : "Paramètres du document : Niveau, Classes, Objectifs"}
            >
              <Settings2 size={15} />
              <span>{isArMode ? 'إعدادات الوثيقة' : 'Paramètres'}</span>
              {isGeneralInfoExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {sections.some(s => (s.type === 'exercise' || s.type === 'activity') && (s.content || '').trim()) && (
              <button
                type="button"
                onClick={handleAiSolveAllExercises}
                disabled={solvingAll || saving}
                className="btn-outline mode-pill-btn lesson-action-btn"
                style={{
                  padding: '0.55rem 1rem',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  borderRadius: '10px',
                  background: solvingAll ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.08)',
                  borderColor: solvingAll ? 'var(--emerald)' : 'rgba(99, 102, 241, 0.35)',
                  color: solvingAll ? 'var(--emerald)' : 'var(--violet)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
                title={isArMode ? "حل جميع تمارين الدرس بالسلسلة بالذكاء الاصطناعي بطريقة المفتش التربوي المغربي" : "Résoudre tous les exercices par IA (Méthode de l'Inspecteur Marocain)"}
              >
                {solvingAll ? (
                  <>
                    <Loader2 className="animate-spin" size={15} />
                    <span>
                      {isArMode
                        ? `جاري الحل (${solveAllProgress?.current || 0}/${solveAllProgress?.total || 0})...`
                        : `Résolution (${solveAllProgress?.current || 0}/${solveAllProgress?.total || 0})...`}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} style={{ color: '#eab308' }} />
                    <span>{isArMode ? 'حل التمارين (IA)' : 'Résoudre (IA)'}</span>
                  </>
                )}
              </button>
            )}

            {/* Live Database Sync Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              {saving ? (
                <span style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: 'var(--violet)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <Loader2 size={13} className="animate-spin" />
                  <span>{isArMode ? 'جاري الحفظ في قاعدة البيانات...' : 'Sync DB en cours...'}</span>
                </span>
              ) : hasUnsavedChanges ? (
                <span style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#d97706',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
                title={isArMode ? "توجد تعديلات جديدة لم تحفظ بعد في قاعدة البيانات" : "Modifications non enregistrées dans la base de données"}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
                  <span>{isArMode ? 'تعديلات غير محفوظة' : 'Non enregistré'}</span>
                </span>
              ) : (
                <span style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  background: 'rgba(16, 185, 129, 0.08)',
                  color: 'var(--emerald)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
                title={isArMode ? "متزامن ومحفوظ بالكامل في قاعدة البيانات" : "Parfaitement synchronisé avec la base de données"}
                >
                  <Database size={13} style={{ color: 'var(--emerald)' }} />
                  <span>{isArMode ? `محفوظ (${lastSavedTime || 'محدث'})` : `Synchronisé DB (${lastSavedTime || 'À jour'})`}</span>
                </span>
              )}
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSaveLesson}
              disabled={saving || solvingAll}
              className="btn-primary mode-pill-btn lesson-action-btn"
              style={{
                padding: '0.55rem 1.3rem',
                fontSize: '0.86rem',
                fontWeight: 900,
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: hasUnsavedChanges 
                  ? 'linear-gradient(135deg, #10b981, #059669)' 
                  : 'rgba(16, 185, 129, 0.85)',
                boxShadow: hasUnsavedChanges
                  ? '0 4px 14px rgba(16, 185, 129, 0.45)'
                  : '0 2px 8px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              <span>{saving ? (isArMode ? 'جاري الحفظ...' : 'Enregistrement...') : hasUnsavedChanges ? (isArMode ? 'حفظ التعديلات (Ctrl+S)' : 'Enregistrer (Ctrl+S)') : (isArMode ? 'محفوظ ✓' : 'Enregistré ✓')}</span>
            </button>
          </div>
        </div>

      </header>

      {/* ── View Mode Switcher (Document A4 Canvas vs Structured Blocks) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.85rem',
        marginBottom: '1rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '0.55rem 0.95rem',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Layers size={15} style={{ color: 'var(--violet)' }} />
            {isArMode ? 'نمط التحرير والعرض :' : 'Mode d\'édition :'}
          </span>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '3px',
            gap: '3px'
          }}>
            <button
              type="button"
              onClick={() => handleSetEditViewMode('document')}
              className="mode-pill-btn"
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.83rem',
                fontWeight: 800,
                border: 'none',
                background: editViewMode === 'document' ? 'var(--violet)' : 'transparent',
                color: editViewMode === 'document' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: editViewMode === 'document' ? '0 2px 8px rgba(99, 102, 241, 0.35)' : 'none'
              }}
              title={isArMode ? 'معاينة وتحرير مباشر كصفحة A4' : 'Aperçu et édition directe sur la page A4'}
            >
              <FileText size={15} />
              <span>{isArMode ? 'معاينة وتحرير الصفحة (A4)' : 'Mode Document (Page A4)'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetEditViewMode('structured')}
              className="mode-pill-btn"
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.83rem',
                fontWeight: 800,
                border: 'none',
                background: editViewMode === 'structured' ? 'var(--violet)' : 'transparent',
                color: editViewMode === 'structured' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: editViewMode === 'structured' ? '0 2px 8px rgba(99, 102, 241, 0.35)' : 'none'
              }}
              title={isArMode ? 'تحرير بالفقرات والبطاقات وقص أشكال PDF وموازنة النقط' : 'Édition par blocs structurés avec découpage de figures PDF'}
            >
              <Layers size={15} />
              <span>{isArMode ? 'التحرير بالفقرات والبطاقات' : 'Mode Blocs Structurés'}</span>
            </button>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {editViewMode === 'structured'
            ? (isArMode ? '🧱 وضع بطاقات الأقسام والتمارين مع موازنة النقط وقص الأشكال' : '🧱 Mode formulaire par blocs avec barème et recadrage PDF')
            : (isArMode ? '📄 وضع صفحة A4 الحية للطباعة والتنسيق المباشر' : '📄 Canevas A4 en direct avec aperçu d\'impression')}
        </div>
      </div>

      {/* ── Status Alerts ── */}
      {error && (
        <div className="lesson-status-alert" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '0.85rem 1.25rem', color: 'var(--danger)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={20} />
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>{error}</p>
        </div>
      )}

      {success && (
        <div className="lesson-status-alert" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)', borderRadius: '12px', padding: '0.85rem 1.25rem', color: 'var(--emerald)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle size={20} />
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>{success}</p>
        </div>
      )}

      {/* ── GLOBAL DOCUMENT STYLE BAR (Mise en page & Style) ── */}
      <div style={{
        position: 'sticky',
        top: '0.5rem',
        zIndex: 40,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        marginBottom: '1.25rem',
        padding: '0.65rem 1.15rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          {/* Background Color */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Palette size={14} style={{ color: 'var(--violet)' }} />
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)' }}>
              {isArMode ? 'خلفية الوثيقة :' : 'Fond :'}
            </span>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {[
                { label: 'Sans fond', val: 'transparent', color: '#ffffff', border: '#cbd5e1' },
                { label: 'Bleu doux', val: '#f0f9ff', color: '#f0f9ff', border: '#bae6fd' },
                { label: 'Jaune doux', val: '#fefce8', color: '#fefce8', border: '#fef08a' },
                { label: 'Vert menthe', val: '#f0fdf4', color: '#f0fdf4', border: '#bbf7d0' },
                { label: 'Gris élégant', val: '#f8fafc', color: '#f8fafc', border: '#e2e8f0' },
                { label: 'Rose pastel', val: '#fff1f2', color: '#fff1f2', border: '#fecdd3' },
              ].map(c => (
                <button
                  key={c.val}
                  type="button"
                  onClick={() => setGlobalBgColor(c.val)}
                  title={c.label}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: c.color,
                    border: `2px solid ${globalBgColor === c.val ? 'var(--violet)' : c.border}`,
                    cursor: 'pointer',
                    padding: 0
                  }}
                />
              ))}
              <input
                type="color"
                value={globalBgColor && globalBgColor !== 'transparent' ? globalBgColor : '#ffffff'}
                onChange={e => setGlobalBgColor(e.target.value)}
                title="Couleur personnalisée"
                style={{ width: '20px', height: '20px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
            </div>
          </div>

          <div style={{ height: '20px', width: '1px', background: 'var(--border)' }} />

          {/* Global Font Size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Type size={13} style={{ color: 'var(--text-muted)' }} />
            <select
              value={globalFontSize}
              onChange={e => setGlobalFontSize(e.target.value)}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600, outline: 'none' }}
            >
              <option value="">{isArMode ? 'حجم الخط (9.2pt)' : 'Taille (9.2pt)'}</option>
              <option value="8pt">8pt (Compact)</option>
              <option value="8.5pt">8.5pt</option>
              <option value="9.2pt">9.2pt (Normal)</option>
              <option value="10pt">10pt</option>
              <option value="11pt">11pt (Grand)</option>
            </select>
          </div>

          {/* Global Line Height */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Layers size={13} style={{ color: 'var(--text-muted)' }} />
            <select
              value={globalLineHeight}
              onChange={e => setGlobalLineHeight(e.target.value)}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600, outline: 'none' }}
            >
              <option value="">{isArMode ? 'التباعد (1.55)' : 'Interligne (1.55)'}</option>
              <option value="1.3">1.3 (Serré)</option>
              <option value="1.55">1.55 (Standard)</option>
              <option value="1.75">1.75 (Aéré)</option>
              <option value="2.0">2.0 (Spacieux)</option>
            </select>
          </div>

          {/* Columns switcher (if series) */}
          {docType === 'exercises' && (
            <>
              <div style={{ height: '20px', width: '1px', background: 'var(--border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Columns size={13} style={{ color: 'var(--emerald)' }} />
                <select
                  value={columnsCount}
                  onChange={e => setColumnsCount(Number(e.target.value))}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 700, outline: 'none' }}
                >
                  <option value={1}>{isArMode ? 'عمود واحد' : '1 Colonne'}</option>
                  <option value={2}>{isArMode ? 'عمودان (2 Colonnes)' : '2 Colonnes'}</option>
                  <option value={3}>{isArMode ? '3 أعمدة' : '3 Colonnes'}</option>
                </select>
              </div>
            </>
          )}

          {/* Scope selector */}
          <select
            value={globalScope}
            onChange={e => setGlobalScope(e.target.value)}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 700, outline: 'none' }}
          >
            <option value="all">{isArMode ? 'كامل الملف' : 'Tout le document'}</option>
            <option value="exercises">{isArMode ? 'التمارين فقط' : 'Exercices uniquement'}</option>
            <option value="course">{isArMode ? 'الدرس فقط' : 'Cours uniquement'}</option>
          </select>
        </div>

        {/* Apply Button */}
        <button
          type="button"
          onClick={handleApplyGlobalStyleToAll}
          className="mode-pill-btn"
          style={{
            background: 'linear-gradient(135deg, #005086, #0284c7)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.45rem 1rem',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 2px 8px rgba(0,80,134,0.25)'
          }}
          title={isArMode ? "تطبيق هذه التنسيقات على عناصر الملف" : "Appliquer au document"}
        >
          <CheckCheck size={14} />
          <span>{isArMode ? 'تطبيق على الملف' : 'Appliquer au document'}</span>
        </button>
      </div>

      {/* ── MAIN WORKSPACE CONTENT ── */}
      <ImageDropZone onImageInsert={(dataUrl, alt) => handleDirectImageInsert(dataUrl, alt)}>
        <div className="lesson-edit-workspace" style={{ maxWidth: '1050px', margin: '0 auto' }}>
          {/* General Info Panel */}
          {renderGeneralInfoPanel(true)}

          {editViewMode === 'document' ? (
            renderLiveWordDocument()
          ) : (
            renderStructuredBlocksEditor()
          )}
        </div>
      </ImageDropZone>



      {/* PDF Figure Cropper Modal */}
      <PdfFigureCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        sections={sections}
        targetSectionIdx={cropperTarget.secIdx}
        targetItemIdx={cropperTarget.itemIdx}
        onCropComplete={handleCropComplete}
      />

      {/* AI Figure Enhancer Modal */}
      <AiFigureEnhancerModal
        isOpen={isAiEnhancerOpen}
        onClose={() => setIsAiEnhancerOpen(false)}
        imageSrc={aiEnhancerTarget.imageSrc}
        caption={aiEnhancerTarget.caption}
        onApply={handleApplyAiEnhancedFigure}
      />

      {/* Floating LaTeX Math Palette */}
      <FloatingLatexPalette
        isOpen={isLatexPaletteOpen}
        onClose={() => setIsLatexPaletteOpen(false)}
        onInsert={insertTextOrSnippet}
        activeTargetLabel={
          activeFieldTarget?.field === 'sectionContent'
            ? `Exercice #${(activeFieldTarget?.secIdx ?? 0) + 1} (Énoncé)`
            : activeFieldTarget?.field === 'sectionSolution'
            ? `Exercice #${(activeFieldTarget?.secIdx ?? 0) + 1} (Corrigé)`
            : 'Fiche Word'
        }
        isArMode={isArMode}
      />
    </div>
  );
}
