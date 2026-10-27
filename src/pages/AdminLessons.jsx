import { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getAllLessons, getLessonById, toggleLessonStatus, deleteLesson, updateLesson
} from '../services/lessonService';
import { queryCache } from '../services/queryCache';
import { getAllClasses } from '../services/classService';
import { 
  BookOpen, Sparkles, Search, Trash2, Eye, Edit, FileText,
  CheckCircle, XCircle, Library, PlusCircle, AlertCircle, Languages,
  Edit3, CheckSquare, Square, MinusSquare, X, Check, Filter, Layers,
  CheckCheck, HelpCircle, Loader2, Calendar, ArrowUpDown,
  LayoutGrid, List, User, ChevronRight, RotateCcw,
  Download, FileCode, Printer
} from 'lucide-react';
import TranslateModal from '../components/TranslateModal';
import LessonBulkEditModal from '../components/LessonBulkEditModal';
import { renderWithMath } from '../utils/mathRenderer';
import { normalizeLevel } from '../utils/levelHelpers';
import { openLessonPrintWindow } from '../utils/generateLessonPDF';

const getLevelLabel = (rawLevel) => {
  const level = normalizeLevel(rawLevel);
  switch (level) {
    case 'common_core_sci':
      return 'Tronc Commun Scientifique';
    case 'common_core_arts':
      return 'Tronc Commun Lettres';
    case '1bac_sci':
      return '1ère Bac Sciences Expérimentales';
    case '1bac_sm':
      return '1ère Bac Sciences Mathématiques';
    case '1bac_arts':
      return '1ère Bac Lettres';
    case '2bac_sm':
      return '2ème Bac Sciences Mathématiques';
    case '2bac_pc_svt':
      return '2ème Bac Sciences Expérimentales (PC/SVT)';
    case '2bac_arts':
      return '2ème Bac Lettres';
    default:
      return level || 'Non spécifié';
  }
};

export default function AdminLessons() {
  const { user, loading, profName, profPhone, addExam } = useAuth();
  const navigate = useNavigate();

  // Component States — Warmed up instantly from local cache to eliminate reload lag
  const [lessons, setLessons] = useState(() => {
    try {
      const raw = localStorage.getItem('lconq_lessons_db');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [classes, setClasses] = useState(() => {
    try {
      const raw = localStorage.getItem('lconq_classes_db') || localStorage.getItem('lconq_classes_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [loadingLessons, setLoadingLessons] = useState(() => {
    try {
      const raw = localStorage.getItem('lconq_lessons_db');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch (_) {}
    return true;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    sessionStorage.setItem('last_lessons_origin', '/admin/lessons');
  }, []);
  const [success, setSuccess] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('Tous');
  const [selectedDocTypeFilter, setSelectedDocTypeFilter] = useState('Tous');
  const [showConfirmDelete, setShowConfirmDelete] = useState(null); // id of lesson to delete
  const [showTranslateModal, setShowTranslateModal] = useState(null);
  const [generatingQcmLessonId, setGeneratingQcmLessonId] = useState(null);

  // Bulk selection and operations state
  const [selectedLessonIds, setSelectedLessonIds] = useState([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false);
  const [showBulkDownloadModal, setShowBulkDownloadModal] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  const handleGenerateQcmFromLesson = async (lesson) => {
    const geminiKey = localStorage.getItem('geminiApiKey') || '';
    if (!geminiKey) {
      alert("Veuillez d'abord configurer votre clé API Google Gemini dans les paramètres de la plateforme (Espace Paramètres).");
      navigate('/admin/settings');
      return;
    }

    if (!window.confirm(`Voulez-vous générer un QCM de 20 questions de révision pour le cours "${lesson.title}" via l'IA ?`)) {
      return;
    }

    setGeneratingQcmLessonId(lesson.id);
    setError('');
    setSuccess('');

    try {
      // 1. Extract plain text — ensure full content is loaded
      let fullLesson = lesson;
      if (!fullLesson.content?.sections || fullLesson.content.sections.length === 0) {
        const loaded = await getLessonById(lesson.id);
        if (loaded) fullLesson = loaded;
      }

      // THEORY ONLY (exclude exercises)
      const sectionsContentText = (fullLesson.content?.sections || [])
        .filter(sec => sec.type !== 'exercise') // Exclude exercise sections
        .map(sec => {
          const header = sec.section_header ? `[${sec.section_header}] ` : '';
          const title = sec.title ? `${sec.title}\n` : '';
          const itemsText = (sec.items || [])
            .map(it => it.text || '')
            .filter(Boolean)
            .join('\n');
          const bodyContent = sec.content ? `${sec.content}\n` : '';
          return `${header}${title}${itemsText}\n${bodyContent}`;
        })
        .join('\n\n');

      // 2. Call Gemini model
      const storedModel = (localStorage.getItem('geminiModel') || '').trim();
      let modelToUse = storedModel;
      if (!modelToUse || ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', '3.7', 'gemini-3.7', 'gemini-3.7-flash', '3.5'].includes(modelToUse)) {
        modelToUse = 'gemini-3.1-flash-lite';
      }
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiKey}`;

      // 3. Detect lesson language (Arabic or French)
      const arabicRegex = /[\u0600-\u06FF]/;
      const lessonSample = (lesson.title || '') + sectionsContentText;
      const isArabicLesson = arabicRegex.test(lessonSample);

      const userText = isArabicLesson
        ? `يجب عليك توليد 20 سؤالاً من نوع اختيار متعدد (QCM) للمراجعة النظرية للدرس التالي.
عنوان الدرس: "${lesson.title}"
المادة: الرياضيات
المستوى: ${getLevelLabel(lesson.level)}

════════════════════════════════════
📖 المحتوى النظري للدرس (المصدر الحصري)
════════════════════════════════════
${sectionsContentText}
════════════════════════════════════

⚠️ قواعد صارمة للتوليد (يجب احترامها دون استثناء):

1. النظرية فقط: يجب أن تتناول جميع الأسئلة العشرين حصراً التعريفات والخصائص والمبرهنات والصيغ والمفاهيم النظرية للدرس أعلاه.
   ❌ محظور: أسئلة من نوع تمارين أو حسابات طويلة أو حل مسائل أو تطبيقات عددية معقدة.
   ✅ مسموح: تحديد التعريف الصحيح، التعرف على صيغة رياضية، تطبيق مبرهنة أساسية، صح/خطأ على خاصية ما.

2. يجب أن يحتوي كل سؤال على 4 خيارات بالضبط على شكل مصفوفة (مثال: ["أ) الخيار 1", "ب) الخيار 2", "ج) الخيار 3", "د) الخيار 4"]).

3. حدد الإجابة الصحيحة بحرف واحد فقط من بين: "A" أو "B" أو "C" أو "D".

4. اكتب شرح التصحيح (astuce) باللغة العربية كاملاً، مع كتابة جميع الصيغ الرياضية بتنسيق LaTeX القياسي ($...$ أو $$...$$).

5. أعد النتيجة بصيغة JSON خالصة وفق مخطط الإخراج المطلوب — 20 عنصراً بالضبط في المصفوفة.`
        : `Tu dois générer exactement 20 questions à choix multiples (QCM) de RÉVISION THÉORIQUE pour le cours suivant.
Titre du cours : "${lesson.title}"
Matière : Mathématiques
Niveau : ${getLevelLabel(lesson.level)}

════════════════════════════════════
📖 CONTENU THÉORIQUE DU COURS (BASE EXCLUSIVE)
════════════════════════════════════
${sectionsContentText}
════════════════════════════════════

⚠️ RÈGLES STRICTES DE GÉNÉRATION (à respecter impérativement) :

1. THÉORIE UNIQUEMENT : Toutes les 20 questions doivent porter EXCLUSIVEMENT sur les définitions, propriétés, théorèmes, formules et concepts théoriques du cours ci-dessus.
   ❌ INTERDIT : questions de type exercice, calcul long, résolution de problème, ou application numérique complexe.
   ✅ AUTORISÉ : identifier la bonne définition, reconnaître une formule, appliquer un théorème de base, vrai/faux sur une propriété.

2. Chaque question doit comporter exactement 4 options sous forme de tableau (ex: ["A) option1", "B) option2", "C) option3", "D) option4"]).

3. Indique la bonne réponse correcte : une seule lettre parmi "A", "B", "C", ou "D".

4. Rédige l'astuce de correction (explication rédigée complète) en français avec toutes les équations mathématiques en LaTeX standard ($...$ ou $$...$$).

5. Retourne le résultat au format JSON pur selon le schéma de sortie exigé — exactement 20 objets dans le tableau.`;

      const promptSchema = {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            question_number: { type: "INTEGER" },
            context: { type: "STRING" },
            subject: { type: "STRING" },
            question: { type: "STRING" },
            options: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            correct_answer: { type: "STRING" },
            astuce: { type: "STRING" },
            trick: { type: "STRING" }
          },
          required: ["question_number", "context", "subject", "question", "options", "correct_answer", "astuce", "trick"]
        }
      };

      const payload = {
        contents: [
          {
            parts: [{ text: userText }]
          }
        ],
        systemInstruction: {
          parts: [{ text: isArabicLesson
            ? "أنت مفتش تربوي مغربي متخصص في الرياضيات. مهمتك هي إنشاء أسئلة اختيار متعدد للمراجعة النظرية — يجب أن يختبر كل سؤال معرفة التعريفات والصيغ والمبرهنات والخصائص من الدرس. لا تولّد أبدًا تمارين حسابية أو مسائل. جميع الصيغ الرياضية تستخدم تنسيق LaTeX القياسي ($...$ أو $$...$$). مستوى اللغة هو مستوى مصحح الامتحانات الرسمية للبكالوريا المغربية. اللغة الوحيدة للأسئلة والخيارات والشرح هي اللغة العربية."
            : "Tu es un inspecteur pédagogique de mathématiques marocain. Ta mission est de créer des QCM de RÉVISION THÉORIQUE — chaque question doit tester la connaissance des définitions, formules, théorèmes et propriétés du cours. Tu ne génères JAMAIS des exercices de calcul ou de résolution de problème. Toutes les formules utilisent la syntaxe LaTeX standard ($...$ ou $$...$$). Le niveau de langue est celui d'un correcteur officiel du Baccalauréat Marocain."
          }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: promptSchema,
          maxOutputTokens: 8192,
          temperature: 0.2
        }
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Erreur HTTP ${res.status}`);
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const nonThoughtParts = candidate?.content?.parts?.filter(p => !p.thought) || [];
      const rawText = (nonThoughtParts.length > 0 ? nonThoughtParts : (candidate?.content?.parts || []))
        .map(p => p.text || '')
        .join('');
      
      let questions = [];
      try {
        questions = JSON.parse(rawText);
      } catch (err) {
        console.error("Failed to parse JSON:", rawText);
        throw new Error("Le format de réponse de l'IA est invalide.", { cause: err });
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("L'IA n'a pas retourné de questions.");
      }

      // 3. Save Exam to Database
      const examName = `QCM : ${lesson.title} (20 Questions)`;
      
      // Determine the level and first class name for the exam if any
      const levelClasses = classes.filter(c => normalizeLevel(c.level) === normalizeLevel(lesson.level));
      const targetSchool = levelClasses.length > 0 ? levelClasses[0].name : getLevelLabel(lesson.level);

      const year = new Date().getFullYear().toString();
      const tier = 'Moyen';

      await addExam(examName, targetSchool, year, tier, questions, null, lesson.level);

      setSuccess(`Le QCM de 20 questions pour "${lesson.title}" a été généré et enregistré !`);
      setTimeout(() => {
        setSuccess('');
        navigate('/admin/exams');
      }, 2000);

    } catch (err) {
      console.error("Failed to generate QCM:", err);
      setError(`Erreur lors de la génération du QCM : ${err.message}`);
    } finally {
      setGeneratingQcmLessonId(null);
    }
  };

  // Fetch Lessons
  const fetchLessonsList = async (force = false) => {
    if (force) setIsRefreshing(true);
    // Only show full loading spinner if we don't have any cached lessons yet
    setLessons(prev => {
      if (!prev || prev.length === 0) {
        setLoadingLessons(true);
      }
      return prev;
    });
    try {
      const data = await getAllLessons({ forceRefresh: force });
      if (Array.isArray(data) && data.length > 0) {
        setLessons(data);
        if (force) {
          setSyncSuccessMsg(`Base de données synchronisée (${data.length} fiches)`);
          setTimeout(() => setSyncSuccessMsg(''), 3500);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des fiches de cours.');
    } finally {
      setLoadingLessons(false);
      if (force) setIsRefreshing(false);
    }
  };

  const fetchClassesList = async () => {
    try {
      const data = await getAllClasses();
      if (Array.isArray(data) && data.length > 0) {
        setClasses(data);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des classes:', err);
    }
  };

  useEffect(() => {
    fetchLessonsList(true);
    fetchClassesList();

    const unsubscribe = queryCache.subscribe('lessons_all', (updated) => {
      if (Array.isArray(updated) && updated.length > 0) {
        setLessons(updated);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle Toggle Active/Inactive Status
  const handleToggleStatus = async (lessonId, currentStatus) => {
    try {
      await toggleLessonStatus(lessonId, currentStatus);
      setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, isActive: !currentStatus } : l));
      setSuccess('Le statut de la fiche a été mis à jour.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Impossible de modifier le statut de la fiche.');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Handle Delete
  const handleDeleteLesson = async () => {
    if (!showConfirmDelete) return;
    try {
      await deleteLesson(showConfirmDelete);
      setLessons(prev => prev.filter(l => l.id !== showConfirmDelete));
      setShowConfirmDelete(null);
      setSuccess('La fiche de cours a été supprimée avec succès.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la suppression de la fiche.');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Helper: format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return null; }
  };

  // Filtering Logic (All lessons are Mathematics)
  const filteredLessons = lessons
    .filter(l => {
      const matchesSearch = l.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            l.teacher?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = selectedLevelFilter === 'Tous' || normalizeLevel(l.level) === selectedLevelFilter;
      const matchesDocType = selectedDocTypeFilter === 'Tous' || 
                            l.docType === selectedDocTypeFilter ||
                            (selectedDocTypeFilter === 'course' && (l.docType === 'summary' || !l.docType));
      const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'active' && l.isActive) || 
                            (statusFilter === 'inactive' && !l.isActive);
      return matchesSearch && matchesLevel && matchesDocType && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  // Selection state helpers
  const isAllSelected = filteredLessons.length > 0 && filteredLessons.every(l => selectedLessonIds.includes(l.id));
  const isSomeSelected = filteredLessons.some(l => selectedLessonIds.includes(l.id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const filteredIds = new Set(filteredLessons.map(l => l.id));
      setSelectedLessonIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      const newIds = new Set([...selectedLessonIds, ...filteredLessons.map(l => l.id)]);
      setSelectedLessonIds(Array.from(newIds));
    }
  };

  const handleToggleSelectLesson = (id) => {
    setSelectedLessonIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedLessonIds([]);
  };

  // Bulk Actions
  const handleBulkToggleStatus = async (newStatus) => {
    if (selectedLessonIds.length === 0) return;
    setIsBulkProcessing(true);
    setError('');
    try {
      await Promise.all(
        selectedLessonIds.map(id => updateLesson(id, { isActive: newStatus }))
      );
      setLessons(prev => prev.map(l => selectedLessonIds.includes(l.id) ? { ...l, isActive: newStatus } : l));
      setSuccess(`${selectedLessonIds.length} fiche(s) ${newStatus ? 'activée(s)' : 'masquée(s)'} avec succès.`);
      setTimeout(() => setSuccess(''), 3500);
      handleClearSelection();
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la modification du statut.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLessonIds.length === 0) return;
    setIsBulkProcessing(true);
    setError('');
    try {
      await Promise.all(
        selectedLessonIds.map(id => deleteLesson(id))
      );
      setLessons(prev => prev.filter(l => !selectedLessonIds.includes(l.id)));
      setSuccess(`${selectedLessonIds.length} fiche(s) de cours supprimée(s) définitivement.`);
      setTimeout(() => setSuccess(''), 3500);
      setShowConfirmBulkDelete(false);
      handleClearSelection();
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la suppression des fiches.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleApplyBulkEdit = async (payload) => {
    if (selectedLessonIds.length === 0) return;
    setIsBulkProcessing(true);
    setError('');
    try {
      await Promise.all(
        selectedLessonIds.map(async (id) => {
          const updates = {};
          if (payload.level) updates.level = payload.level;
          if (payload.docType) updates.docType = payload.docType;
          if (payload.subject) updates.subject = payload.subject;
          if (payload.teacher) updates.teacher = payload.teacher;
          if (payload.isActive !== undefined) updates.isActive = payload.isActive;
          
          if (payload.schoolUpdate) {
            const currentLesson = lessons.find(l => l.id === id);
            let currentSchools = Array.isArray(currentLesson?.schools) ? [...currentLesson.schools] : [];
            if (payload.schoolUpdate.action === 'add' && payload.schoolUpdate.schoolName) {
              if (!currentSchools.includes(payload.schoolUpdate.schoolName)) {
                currentSchools.push(payload.schoolUpdate.schoolName);
              }
            } else if (payload.schoolUpdate.action === 'replace' && payload.schoolUpdate.schoolName) {
              currentSchools = [payload.schoolUpdate.schoolName];
            } else if (payload.schoolUpdate.action === 'clear') {
              currentSchools = [];
            }
            updates.schools = currentSchools;
          }

          return updateLesson(id, updates);
        })
      );

      await fetchLessonsList(true);
      setShowBulkEditModal(false);
      setSuccess(`Mise à jour en masse appliquée à ${selectedLessonIds.length} fiche(s) de cours ✓`);
      setTimeout(() => setSuccess(''), 4000);
      handleClearSelection();
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la mise à jour en masse.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Bulk Download Helpers
  const fetchFullSelectedLessons = async () => {
    setIsBulkDownloading(true);
    try {
      const fullList = await Promise.all(
        selectedLessonIds.map(async (id) => {
          const inMemory = lessons.find(l => l.id === id);
          if (inMemory?.content?.sections && inMemory.content.sections.length > 0) {
            return inMemory;
          }
          const loaded = await getLessonById(id);
          return loaded || inMemory;
        })
      );
      return fullList.filter(Boolean);
    } catch (err) {
      console.error('Error fetching full lessons for download:', err);
      return lessons.filter(l => selectedLessonIds.includes(l.id));
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handleBulkDownloadJSON = async () => {
    const items = await fetchFullSelectedLessons();
    if (!items || items.length === 0) return;

    const dataStr = JSON.stringify(items, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = items.length === 1
      ? `fiche_${(items[0].title || 'cours').replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_')}_${dateStr}.json`
      : `fiches_lconq_${items.length}_elements_${dateStr}.json`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowBulkDownloadModal(false);
    setSuccess(`✅ ${items.length} fiche(s) téléchargée(s) en format JSON avec succès.`);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleBulkDownloadPDF = async () => {
    const items = await fetchFullSelectedLessons();
    if (!items || items.length === 0) return;

    setShowBulkDownloadModal(false);

    if (items.length === 1) {
      openLessonPrintWindow(items[0], { layoutMode: 'standard', forceStandard: true });
      return;
    }

    setSuccess(`Génération de ${items.length} fiches PDF en cours... Les fenêtres d'impression vont s'ouvrir.`);
    setTimeout(() => setSuccess(''), 5000);

    items.forEach((item, index) => {
      setTimeout(() => {
        openLessonPrintWindow(item, { layoutMode: 'standard', forceStandard: true });
      }, index * 750);
    });
  };

  // Stats
  const totalCount = lessons.length;
  const activeCount = lessons.filter(l => l.isActive).length;
  const inactiveCount = totalCount - activeCount;
  const uniqueLevelsCount = new Set(lessons.map(l => normalizeLevel(l.level)).filter(Boolean)).size;

  // Role Guard (Must run after all hooks)
  if (!loading && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      
      {/* Background glow blobs */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%', width: '350px', height: '350px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(113, 109, 242, 0.05) 0%, transparent 70%)',
        filter: 'blur(70px)', zIndex: 0, pointerEvents: 'none'
      }}></div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        
        {/* ── Page Header ── */}
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <div style={{ width: 44, height: 44, borderRadius: '14px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(113, 109, 242, 0.15)' }}>
                <Library size={22} color="#fff" />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-main)' }}>
                Bibliothèque de Fiches de Cours
              </h1>
              <span 
                title="Base de données Cloud Supabase & Mémorisation locale synchronisée"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '999px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#059669',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#10B981',
                  boxShadow: '0 0 6px #10B981',
                  display: 'inline-block'
                }} />
                Base de données connectée ({totalCount} Fiches)
              </span>
              {syncSuccessMsg && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: 'rgba(113, 109, 242, 0.1)',
                  border: '1px solid rgba(113, 109, 242, 0.25)',
                  color: 'var(--violet)',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <CheckCircle size={12} /> {syncSuccessMsg}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
              Gérez les fiches de cours dynamiques générées par IA avec mise en page LaTeX et impression PDF.
            </p>
          </div>

          {/* Header right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, flexWrap: 'wrap' }}>

            <button
              onClick={() => fetchLessonsList(true)}
              disabled={isRefreshing}
              title="Synchroniser immédiatement avec la base de données Supabase"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                padding: '0.65rem 1.05rem',
                borderRadius: 11,
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: isRefreshing ? 'wait' : 'pointer',
                boxShadow: 'var(--shadow-card)',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw
                size={15}
                style={{
                  color: 'var(--violet)',
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                }}
              />
              <span>{isRefreshing ? 'Synchronisation...' : 'Actualiser DB'}</span>
            </button>

            <button
              onClick={() => navigate('/admin/ai-lessons')}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
                border: 'none', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.7rem 1.3rem', fontSize: '0.85rem', borderRadius: '12px',
                boxShadow: '0 8px 20px rgba(124, 58, 237, 0.2)'
              }}
            >
              <PlusCircle size={16} /> Générer une fiche (IA)
            </button>

            {/* View mode toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
              <button
                onClick={() => setViewMode('table')}
                title="Vue tableau"
                style={{
                  padding: '0.42rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: viewMode === 'table' ? 'var(--violet)' : 'transparent',
                  color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', transition: 'all 0.18s ease'
                }}
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                title="Vue cartes"
                style={{
                  padding: '0.42rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: viewMode === 'cards' ? 'var(--violet)' : 'transparent',
                  color: viewMode === 'cards' ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', transition: 'all 0.18s ease'
                }}
              >
                <LayoutGrid size={16} />
              </button>
            </div>

          </div>
        </header>

        {/* ── Status Notifications ── */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '1rem', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{error}</p>
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)', borderRadius: '12px', padding: '1rem', color: 'var(--emerald)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={20} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{success}</p>
          </div>
        )}

        {/* ── Stats Indicators (Clickable Filters) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {/* Total Fiches */}
          <div 
            onClick={() => setStatusFilter('all')}
            className="glass-panel" 
            style={{ 
              padding: '1.25rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem',
              cursor: 'pointer',
              border: statusFilter === 'all' ? '1.5px solid var(--violet)' : '1px solid var(--border)',
              background: statusFilter === 'all' ? 'rgba(99, 102, 241, 0.05)' : undefined,
              boxShadow: statusFilter === 'all' ? '0 4px 20px rgba(99, 102, 241, 0.12)' : undefined,
              transition: 'all 0.2s ease'
            }}
            title="Afficher toutes les fiches de cours"
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--violet-soft)', color: 'var(--violet)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>Total Fiches</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)' }}>{totalCount}</div>
            </div>
          </div>
          
          {/* Fiches Actives */}
          <div 
            onClick={() => setStatusFilter(prev => prev === 'active' ? 'all' : 'active')}
            className="glass-panel" 
            style={{ 
              padding: '1.25rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem',
              cursor: 'pointer',
              border: statusFilter === 'active' ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
              background: statusFilter === 'active' ? 'rgba(16, 185, 129, 0.06)' : undefined,
              boxShadow: statusFilter === 'active' ? '0 4px 20px rgba(16, 185, 129, 0.15)' : undefined,
              transition: 'all 0.2s ease'
            }}
            title="Filtrer uniquement les fiches actives (publiées)"
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>Fiches Actives</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--emerald)' }}>{activeCount}</div>
            </div>
          </div>

          {/* Fiches Inactives */}
          <div 
            onClick={() => setStatusFilter(prev => prev === 'inactive' ? 'all' : 'inactive')}
            className="glass-panel" 
            style={{ 
              padding: '1.25rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem',
              cursor: 'pointer',
              border: statusFilter === 'inactive' ? '1.5px solid var(--danger)' : '1px solid var(--border)',
              background: statusFilter === 'inactive' ? 'rgba(239, 68, 68, 0.06)' : undefined,
              boxShadow: statusFilter === 'inactive' ? '0 4px 20px rgba(239, 68, 68, 0.15)' : undefined,
              transition: 'all 0.2s ease'
            }}
            title="Filtrer uniquement les fiches inactives (masquées)"
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>Fiches Inactives</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--danger)' }}>{inactiveCount}</div>
            </div>
          </div>

          {/* Niveaux Gérés */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>Niveaux Gérés</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)' }}>{uniqueLevelsCount}</div>
            </div>
          </div>
        </div>

        {/* ── Table Controls (Search & Filters) ── */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem', width: '100%' }}>
          
          {/* Search */}
          <div style={{ position: 'relative', flex: '2', minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Rechercher une fiche ou enseignant..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', background: 'var(--bg-glass)', 
                border: '1px solid var(--border)', borderRadius: '12px', color: 'white', outline: 'none',
                fontSize: '0.88rem'
              }}
            />
          </div>

          {/* Level Filter Dropdown */}
          <select
            value={selectedLevelFilter}
            onChange={(e) => setSelectedLevelFilter(e.target.value)}
            className="input-control"
            style={{ fontSize: '0.85rem', minWidth: '165px', flex: '1' }}
          >
            <option value="Tous">Tous les niveaux</option>
            <option value="common_core_sci">TC Scientifique</option>
            <option value="common_core_arts">TC Lettres</option>
            <option value="1bac_sci">1ère Bac Sciences</option>
            <option value="1bac_sm">1ère Bac SM</option>
            <option value="1bac_arts">1ère Bac Lettres</option>
            <option value="2bac_sm">2ème Bac SM</option>
            <option value="2bac_pc_svt">2ème Bac PC/SVT</option>
            <option value="2bac_arts">2ème Bac Lettres</option>
          </select>

          {/* DocType Filter Dropdown */}
          <select
            value={selectedDocTypeFilter}
            onChange={(e) => setSelectedDocTypeFilter(e.target.value)}
            className="input-control"
            style={{ fontSize: '0.85rem', minWidth: '150px', flex: '1' }}
          >
            <option value="Tous">Tous les types</option>
            <option value="course">Cours (درس)</option>
            <option value="summary">Résumé (ملخص درس)</option>
            <option value="exercises">Exercices (تمارين)</option>
            <option value="homework">Devoirs (فرض محروس)</option>
            <option value="national">Examen National (امتحان وطني)</option>
            <option value="concours">Concours (مباراة)</option>
          </select>

          {/* Date Sort Dropdown */}
          <div style={{ position: 'relative', flex: '1', minWidth: '170px' }}>
            <div style={{
              position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--violet)', pointerEvents: 'none', display: 'flex', alignItems: 'center'
            }}>
              <ArrowUpDown size={15} />
            </div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="input-control"
              style={{
                fontSize: '0.85rem', width: '100%', paddingLeft: '2.25rem',
                border: sortOrder !== 'newest' ? '1px solid rgba(113, 109, 242, 0.5)' : '1px solid var(--border)',
                background: sortOrder !== 'newest' ? 'rgba(113, 109, 242, 0.07)' : 'var(--bg-glass)',
              }}
            >
              <option value="newest">🆕 Ajout : Récent → Ancien</option>
              <option value="oldest">📅 Ajout : Ancien → Récent</option>
            </select>
          </div>

        </div>

        {/* ── Lessons List ── */}
        <div className={viewMode === 'cards' ? '' : 'glass-panel'} style={viewMode === 'cards' ? {} : { overflow: 'hidden', padding: 0 }}>
          {loadingLessons ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.1)', borderTop: '3px solid var(--violet)', animation: 'spinList 1s linear infinite', marginBottom: '1rem' }} />
              <p>Chargement des fiches de cours...</p>
              <style>{`@keyframes spinList { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filteredLessons.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <BookOpen size={44} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
              <p style={{ fontWeight: 700, margin: 0 }}>Aucune fiche de cours trouvée.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {searchTerm ? 'Essayez de réinitialiser vos critères de recherche.' : 'Générez votre première fiche de cours à l\'aide de l\'IA.'}
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            /* ────────────── CARD GRID VIEW ────────────── */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: '1.25rem'
            }}>
              {filteredLessons.map((l) => {
                const isSelected = selectedLessonIds.includes(l.id);
                const docTypeColor = l.docType === 'homework' ? 'var(--danger)' : l.docType === 'exercises' ? 'var(--warning)' : l.docType === 'concours' ? 'var(--emerald)' : l.docType === 'national' ? '#a855f7' : '#3B82F6';
                const docTypeBg = l.docType === 'homework' ? 'rgba(239,68,68,0.09)' : l.docType === 'exercises' ? 'rgba(245,158,11,0.09)' : l.docType === 'concours' ? 'rgba(16,185,129,0.09)' : l.docType === 'national' ? 'rgba(168,85,247,0.09)' : 'rgba(59,130,246,0.09)';
                const docTypeLabel = l.docType === 'homework' ? 'Devoir surveillé' : l.docType === 'exercises' ? "Série d'exercices" : l.docType === 'concours' ? 'Concours' : l.docType === 'national' ? 'Examen National' : 'Cours';
                return (
                  <div
                    key={l.id}
                    className="glass-panel"
                    style={{
                      padding: '1.4rem',
                      display: 'flex', flexDirection: 'column', gap: '0.85rem',
                      border: isSelected ? '1.5px solid var(--violet)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(113,109,242,0.06)' : 'var(--bg-glass)',
                      position: 'relative', transition: 'all 0.2s ease',
                      cursor: 'default'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--border-hover)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '';
                      }
                    }}
                  >
                    {/* Checkbox top-right */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectLesson(l.id)}
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute', top: '0.9rem', right: '0.9rem',
                        width: '15px', height: '15px', accentColor: 'var(--violet)', cursor: 'pointer'
                      }}
                    />

                    {/* Badges row */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', paddingRight: '1.5rem' }}>
                      <span style={{
                        background: 'rgba(113,109,242,0.09)', color: 'var(--violet)',
                        padding: '0.22rem 0.6rem', borderRadius: '6px', fontSize: '0.71rem', fontWeight: 700
                      }}>
                        {l.subject || 'Mathématiques'}
                      </span>
                      <span style={{
                        background: docTypeBg, color: docTypeColor,
                        padding: '0.22rem 0.6rem', borderRadius: '6px', fontSize: '0.71rem', fontWeight: 700
                      }}>
                        {docTypeLabel}
                      </span>
                    </div>

                    {/* Title */}
                    <Link
                      to={`/admin/lessons/${l.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <h3 style={{
                        fontSize: '0.97rem', fontWeight: 700, margin: 0,
                        color: 'var(--text-main)', lineHeight: 1.45,
                        letterSpacing: '-0.01em', transition: 'color 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--violet)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-main)'}
                      >
                        {renderWithMath(l.title)}
                      </h3>
                    </Link>

                    {/* Statut badge */}
                    <div>
                      <button
                        onClick={() => handleToggleStatus(l.id, l.isActive)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.28rem',
                          padding: '0.22rem 0.65rem', borderRadius: '20px',
                          fontSize: '0.7rem', fontWeight: 700,
                          border: l.isActive ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                          cursor: 'pointer',
                          background: l.isActive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                          color: l.isActive ? 'var(--emerald)' : 'var(--danger)',
                          transition: 'all 0.18s'
                        }}
                        title="Basculer le statut"
                      >
                        {l.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {l.isActive ? 'Actif' : 'Masqué'}
                      </button>
                    </div>

                    {/* Footer: teacher + date + actions */}
                    <div style={{
                      marginTop: 'auto', paddingTop: '0.85rem',
                      borderTop: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                        {l.teacher && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-subtle)', overflow: 'hidden' }}>
                            <User size={11} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.teacher}</span>
                          </div>
                        )}
                        {formatDate(l.createdAt) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: 'var(--text-subtle)' }}>
                            <Calendar size={10} style={{ flexShrink: 0, color: 'var(--violet)', opacity: 0.7 }} />
                            <span>{formatDate(l.createdAt)}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '0.22rem', flexShrink: 0 }}>
                        <Link
                          to={`/admin/lessons/${l.id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="btn-outline"
                          title="Consulter"
                          style={{ padding: '0.38rem', borderRadius: '7px', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', color: 'inherit', textDecoration: 'none' }}
                        >
                          <Eye size={13} />
                        </Link>
                        <Link
                          to={`/admin/lessons/${l.id}/edit`}
                          target="_blank" rel="noopener noreferrer"
                          className="btn-outline"
                          title="Modifier"
                          style={{ padding: '0.38rem', borderRadius: '7px', border: '1px solid rgba(113,109,242,0.3)', color: 'var(--violet)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                        >
                          <Edit size={13} />
                        </Link>
                        <button
                          onClick={() => setShowTranslateModal(l)}
                          className="btn-outline" title="Traduire"
                          style={{ padding: '0.38rem', borderRadius: '7px', border: '1px solid rgba(66,133,244,0.3)', color: '#4285F4' }}
                        >
                          <Languages size={13} />
                        </button>
                        <button
                          onClick={() => setShowConfirmDelete(l.id)}
                          className="btn-outline" title="Supprimer"
                          style={{ padding: '0.38rem', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '860px', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid var(--border)' }}>
                    {/* Checkbox column */}
                    <th style={{ width: '48px', padding: '0.9rem 0.85rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                        onChange={handleToggleSelectAll}
                        style={{ width: '15px', height: '15px', accentColor: 'var(--violet)', cursor: 'pointer' }}
                        title={isAllSelected ? "Tout désélectionner" : "Tout sélectionner"}
                      />
                    </th>
                    <th style={{ padding: '0.9rem 1rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fiche de Cours</th>
                    <th style={{ padding: '0.9rem 1rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Niveau / Classe</th>
                    <th style={{ padding: '0.9rem 1rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Type</th>
                    <th
                      onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
                      style={{
                        padding: '0.9rem 1rem', fontWeight: 700, fontSize: '0.72rem',
                        color: 'var(--violet)', textTransform: 'uppercase', letterSpacing: '0.08em',
                        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap'
                      }}
                      title="Cliquer pour inverser le tri par date"
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={12} />
                        Date ajout
                        <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 900 }}>{sortOrder === 'newest' ? '▼' : '▲'}</span>
                      </span>
                    </th>
                    <th style={{ padding: '0.9rem 1rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Statut</th>
                    <th style={{ padding: '0.9rem 1rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLessons.map(l => {
                    const isSelected = selectedLessonIds.includes(l.id);
                    return (
                      <tr 
                        key={l.id} 
                        style={{ 
                          borderBottom: '1px solid var(--border)', 
                          background: isSelected ? 'rgba(99, 102, 241, 0.06)' : undefined,
                          transition: 'background 0.18s ease'
                        }}
                        className="table-row-hover"
                      >
                        {/* Checkbox */}
                        <td style={{ width: '48px', padding: '1rem 0.85rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectLesson(l.id)}
                            style={{ width: '15px', height: '15px', accentColor: 'var(--violet)', cursor: 'pointer' }}
                          />
                        </td>

                        {/* Fiche details */}
                        <td style={{ padding: '1rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ 
                              width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                              background: l.isActive ? 'rgba(113, 109, 242, 0.1)' : 'rgba(255,255,255,0.04)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: l.isActive ? 'var(--violet)' : 'var(--text-subtle)',
                              border: l.isActive ? '1px solid rgba(113,109,242,0.15)' : '1px solid rgba(255,255,255,0.06)'
                            }}>
                              <BookOpen size={15} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.35, letterSpacing: '-0.01em' }}>
                                <Link
                                  to={`/admin/lessons/${l.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--text-main)', textDecoration: 'none', transition: 'color 0.15s ease' }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--violet)'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                                  title="Consulter la fiche (Ouvrir dans une nouvelle page)"
                                >
                                  {renderWithMath(l.title)}
                                </Link>
                              </div>
                              {(l.teacher || l.chapterNumber) && (
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', marginTop: '0.28rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', lineHeight: 1.2 }}>
                                  {l.chapterNumber && (
                                    <span style={{ color: 'var(--violet)', fontWeight: 700, fontSize: '0.7rem' }}>Ch.{l.chapterNumber}</span>
                                  )}
                                  {l.teacher && (
                                    <span style={{ color: 'var(--text-subtle)', fontWeight: 500 }}>{l.chapterNumber ? '· ' : ''}{l.teacher}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Niveau / Classe */}
                        <td style={{ padding: '1rem 1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                            <span style={{ 
                              background: 'rgba(255,255,255,0.04)',
                              color: 'var(--text-main)',
                              padding: '0.22rem 0.6rem', borderRadius: '6px',
                              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.01em',
                              border: '1px solid rgba(255,255,255,0.08)', lineHeight: 1.4
                            }}>
                              {getLevelLabel(l.level)}
                            </span>
                            {Array.isArray(l.schools) && l.schools.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                                {l.schools.map((sc, scIdx) => (
                                  <span key={scIdx} style={{ fontSize: '0.67rem', color: 'var(--violet)', background: 'rgba(113, 109, 242, 0.1)', padding: '0.08rem 0.45rem', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.02em' }}>
                                    {sc}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Type */}
                        <td style={{ padding: '1rem 1rem' }}>
                          <span style={{ 
                            background: l.docType === 'homework' ? 'rgba(239,68,68,0.09)' : l.docType === 'exercises' ? 'rgba(245,158,11,0.09)' : l.docType === 'concours' ? 'rgba(16,185,129,0.09)' : l.docType === 'national' ? 'rgba(168,85,247,0.09)' : 'rgba(59,130,246,0.09)',
                            color: l.docType === 'homework' ? 'var(--danger)' : l.docType === 'exercises' ? 'var(--warning)' : l.docType === 'concours' ? 'var(--emerald)' : l.docType === 'national' ? '#a855f7' : '#3B82F6',
                            padding: '0.28rem 0.7rem', borderRadius: '20px', fontSize: '0.73rem', fontWeight: 700,
                            letterSpacing: '0.01em', whiteSpace: 'nowrap', lineHeight: 1.4
                          }}>
                            {l.docType === 'homework' ? 'Devoir surveillé' : l.docType === 'exercises' ? "Série d'exercices" : l.docType === 'concours' ? 'Concours' : l.docType === 'national' ? 'Examen National' : 'Cours'}
                          </span>
                        </td>

                        {/* Date Ajout */}
                        <td style={{ padding: '1rem 1rem' }}>
                          {formatDate(l.createdAt) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.32rem' }}>
                                <Calendar size={11} style={{ color: 'var(--violet)', flexShrink: 0, opacity: 0.85 }} />
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                                  {formatDate(l.createdAt)}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.69rem', color: 'var(--text-subtle)', paddingLeft: '1.05rem', fontWeight: 500 }}>
                                {(() => {
                                  try {
                                    const diff = Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000);
                                    if (diff === 0) return "Aujourd'hui";
                                    if (diff === 1) return 'Hier';
                                    if (diff < 7) return `Il y a ${diff}j`;
                                    if (diff < 30) return `Il y a ${Math.floor(diff/7)} sem.`;
                                    if (diff < 365) return `Il y a ${Math.floor(diff/30)} mois`;
                                    return `Il y a ${Math.floor(diff/365)} an(s)`;
                                  } catch { return ''; }
                                })()}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>—</span>
                          )}
                        </td>

                        {/* Statut */}
                        <td style={{ padding: '1rem 1rem' }}>
                          <button
                            onClick={() => handleToggleStatus(l.id, l.isActive)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.32rem',
                              padding: '0.3rem 0.75rem', borderRadius: '20px',
                              fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.01em',
                              border: l.isActive ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                              cursor: 'pointer',
                              background: l.isActive ? 'rgba(16,185,129,0.09)' : 'rgba(239,68,68,0.09)',
                              color: l.isActive ? 'var(--emerald)' : 'var(--danger)',
                              transition: 'all 0.18s ease', lineHeight: 1
                            }}
                            title="Cliquer pour basculer le statut"
                          >
                            {l.isActive ? <CheckCircle size={11} /> : <XCircle size={11} />}
                            {l.isActive ? 'Actif' : 'Masqué'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '1rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.28rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <Link
                              to={`/admin/lessons/${l.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-outline"
                              title="Consulter la fiche (Ouvrir dans une nouvelle page)"
                              style={{ padding: '0.42rem', borderRadius: '7px', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'inherit', textDecoration: 'none' }}
                            >
                              <Eye size={15} />
                            </Link>

                            <Link
                              to={`/admin/lessons/${l.id}/edit`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-outline"
                              title="Modifier dans l'éditeur complet (Ouvrir dans une nouvelle page)"
                              style={{ padding: '0.42rem', borderRadius: '7px', border: '1px solid rgba(99, 102, 241, 0.3)', color: 'var(--violet)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                            >
                              <Edit size={15} />
                            </Link>

                            <button
                              onClick={() => setShowTranslateModal(l)}
                              className="btn-outline"
                              title="Traduction IA (Arabe / Français)"
                              style={{ padding: '0.42rem', borderRadius: '7px', border: '1px solid rgba(66, 133, 244, 0.3)', color: '#4285F4' }}
                            >
                              <Languages size={15} />
                            </button>

                            <button
                              onClick={() => handleGenerateQcmFromLesson(l)}
                              className="btn-outline"
                              title="Générer QCM de révision par IA"
                              style={{ padding: '0.42rem', borderRadius: '7px', border: '1px solid var(--border)', color: 'var(--warning)' }}
                            >
                              <HelpCircle size={15} />
                            </button>
                            
                            <button
                              onClick={() => setShowConfirmDelete(l.id)}
                              className="btn-outline"
                              title="Supprimer la fiche"
                              style={{ padding: '0.42rem', borderRadius: '7px', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ── FLOATING BULK ACTION BAR ── */}
      {selectedLessonIds.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(99, 102, 241, 0.25)',
          borderRadius: '16px',
          padding: '0.65rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          maxWidth: '94vw',
          flexWrap: 'wrap'
        }}>
          {/* Badge with count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRight: '1px solid rgba(255,255,255,0.15)', paddingRight: '0.85rem' }}>
            <span style={{
              background: 'linear-gradient(135deg, var(--violet), #8b5cf6)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '0.2rem 0.6rem',
              fontSize: '0.8rem',
              fontWeight: 900
            }}>
              {selectedLessonIds.length}
            </span>
            <span style={{ fontSize: '0.82rem', color: '#ffffff', fontWeight: 700 }}>
              sélectionnée{selectedLessonIds.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Bulk Edit Button */}
          <button
            type="button"
            onClick={() => setShowBulkEditModal(true)}
            disabled={isBulkProcessing}
            style={{
              background: 'linear-gradient(135deg, var(--violet), #8b5cf6)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0.95rem',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Edit3 size={14} />
            <span>Modifier en masse (Bulk Edit)</span>
          </button>

          {/* Bulk Download Button */}
          <button
            type="button"
            onClick={() => setShowBulkDownloadModal(true)}
            disabled={isBulkProcessing || isBulkDownloading}
            style={{
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0.95rem',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.15s ease'
            }}
            title="Télécharger les fiches sélectionnées (JSON ou PDF)"
          >
            {isBulkDownloading ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            <span>Télécharger ({selectedLessonIds.length})</span>
          </button>

          {/* Bulk Activate */}
          <button
            type="button"
            onClick={() => handleBulkToggleStatus(true)}
            disabled={isBulkProcessing}
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              borderRadius: '8px',
              padding: '0.45rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <CheckCircle size={13} />
            <span>Activer</span>
          </button>

          {/* Bulk Deactivate */}
          <button
            type="button"
            onClick={() => handleBulkToggleStatus(false)}
            disabled={isBulkProcessing}
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              borderRadius: '8px',
              padding: '0.45rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <XCircle size={13} />
            <span>Masquer</span>
          </button>

          {/* Bulk Delete */}
          <button
            type="button"
            onClick={() => setShowConfirmBulkDelete(true)}
            disabled={isBulkProcessing}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              borderRadius: '8px',
              padding: '0.45rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Trash2 size={13} />
            <span>Supprimer</span>
          </button>

          {/* Clear selection */}
          <button
            type="button"
            onClick={handleClearSelection}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Désélectionner tout"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Bulk Download Modal ── */}
      {showBulkDownloadModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', 
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', zIndex: 99999, padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '560px', width: '100%', padding: '1.75rem',
            background: 'var(--bg-surface, #1e293b)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa'
                }}>
                  <Download size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main, #ffffff)' }}>
                    Télécharger les fiches sélectionnées
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.2rem' }}>
                    {selectedLessonIds.length} fiche{selectedLessonIds.length > 1 ? 's' : ''} sélectionnée{selectedLessonIds.length > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkDownloadModal(false)}
                disabled={isBulkDownloading}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)',
                  borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', display: 'flex'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* List preview of selected fiches */}
            <div style={{
              maxHeight: '140px', overflowY: 'auto', marginBottom: '1.25rem',
              padding: '0.6rem 0.8rem', background: 'rgba(0,0,0,0.25)',
              borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-subtle, #94a3b8)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Aperçu des éléments sélectionnés :
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {lessons
                  .filter(l => selectedLessonIds.includes(l.id))
                  .slice(0, 6)
                  .map(l => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main, #ffffff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }}>
                        {l.title}
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '12px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600, flexShrink: 0 }}>
                        {getLevelLabel(l.level)}
                      </span>
                    </div>
                  ))}
                {selectedLessonIds.length > 6 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                    + {selectedLessonIds.length - 6} autre(s) fiche(s)...
                  </div>
                )}
              </div>
            </div>

            {/* Download Options Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
              {/* Option 1: JSON */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px', padding: '1rem',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                    <FileCode size={18} color="#60a5fa" />
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#60a5fa' }}>Format JSON</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>
                    Export complet des cours, exercices, formules LaTeX et solutions. Idéal pour sauvegarde et import.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBulkDownloadJSON}
                  disabled={isBulkDownloading}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    color: '#ffffff', border: 'none', borderRadius: '8px',
                    padding: '0.55rem', fontWeight: 800, fontSize: '0.8rem',
                    cursor: isBulkDownloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '0.4rem', opacity: isBulkDownloading ? 0.7 : 1
                  }}
                >
                  {isBulkDownloading ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                  <span>Télécharger JSON</span>
                </button>
              </div>

              {/* Option 2: PDF */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px', padding: '1rem',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                    <Printer size={18} color="#f59e0b" />
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fbbf24' }}>Format PDF</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>
                    Génération haute fidélité prête pour impression ou enregistrement PDF avec mise en page marocaine.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBulkDownloadPDF}
                  disabled={isBulkDownloading}
                  style={{
                    background: 'linear-gradient(135deg, #d97706, #b45309)',
                    color: '#ffffff', border: 'none', borderRadius: '8px',
                    padding: '0.55rem', fontWeight: 800, fontSize: '0.8rem',
                    cursor: isBulkDownloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '0.4rem', opacity: isBulkDownloading ? 0.7 : 1
                  }}
                >
                  {isBulkDownloading ? <Loader2 size={13} className="spin" /> : <Printer size={13} />}
                  <span>Imprimer / PDF</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowBulkDownloadModal(false)}
                disabled={isBulkDownloading}
                className="btn-outline"
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Edit Modal ── */}
      <LessonBulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        selectedCount={selectedLessonIds.length}
        availableClasses={classes}
        onApply={handleApplyBulkEdit}
        loading={isBulkProcessing}
      />

      {/* ── Confirmation Modal for Bulk Deletion ── */}
      {showConfirmBulkDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', 
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', zIndex: 99999, padding: '1rem'
        }}>
          <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', padding: '2rem', textAlign: 'center' }}>
            <Trash2 size={44} style={{ color: 'var(--danger)', margin: '0 auto 1.25rem', display: 'block' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              Suppression en masse ({selectedLessonIds.length} fiches)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 2rem 0' }}>
              Êtes-vous sûr de vouloir supprimer définitivement ces <strong>{selectedLessonIds.length} fiches de cours</strong> ? Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowConfirmBulkDelete(false)} 
                disabled={isBulkProcessing}
                className="btn-outline" 
                style={{ flex: 1, padding: '0.75rem' }}
              >
                Annuler
              </button>
              <button 
                onClick={handleBulkDelete} 
                disabled={isBulkProcessing}
                className="btn" 
                style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, var(--danger) 0%, #b91c1c 100%)', border: 'none' }}
              >
                {isBulkProcessing ? 'Suppression...' : `Supprimer (${selectedLessonIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Traduction IA ── */}
      {showTranslateModal && (
        <TranslateModal
          lesson={showTranslateModal}
          onClose={() => setShowTranslateModal(null)}
          onSuccess={({ newId, language }) => {
            setShowTranslateModal(null);
            fetchLessonsList(); // Refresh the list to show the new translated lesson
            setSuccess(
              language === 'ar'
                ? '✅ تم إنشاء النسخة العربية بنجاح! يمكنك مراجعتها في القائمة.'
                : `✅ La version traduite a été créée avec succès !`
            );
            setTimeout(() => setSuccess(''), 5000);
          }}
        />
      )}

      {/* ── Confirmation Modal for Deletion ── */}
      {showConfirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', 
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div className="glass-panel" style={{ maxWidth: '420px', width: '100%', padding: '2rem', textAlign: 'center' }}>
            <Trash2 size={44} style={{ color: 'var(--danger)', margin: '0 auto 1.25rem', display: 'block' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Confirmer la suppression</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 2rem 0' }}>
              Êtes-vous sûr de vouloir supprimer définitivement cette fiche de cours ? Cette action est irréversible et retirera le cours de la base de données.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowConfirmDelete(null)} 
                className="btn-outline" 
                style={{ flex: 1, padding: '0.75rem' }}
              >
                Annuler
              </button>
              <button 
                onClick={handleDeleteLesson} 
                className="btn" 
                style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, var(--danger) 0%, #b91c1c 100%)', border: 'none' }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {generatingQcmLessonId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(9, 9, 11, 0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, color: 'white'
        }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', border: '4px solid rgba(16, 185, 129, 0.1)', borderTop: '4px solid var(--emerald)', animation: 'spinList 1s linear infinite', marginBottom: '1.5rem' }} />
          <h3 style={{ margin: 0, fontWeight: 800 }}>Génération du QCM de 20 questions par l'IA...</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', maxWidth: '400px', textAlign: 'center' }}>
            L'IA analyse le contenu de la fiche de cours pour formuler des questions à choix multiples de haute qualité avec corrections détaillées en LaTeX. Cela peut prendre environ 30 secondes.
          </p>
        </div>
      )}

    </div>
  );
}
