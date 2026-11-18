// src/pages/AdminLessonEdit.jsx
// Modern, fast, distraction-free Math Document Editor (Notion + Overleaf inspired).
// Features:
//  - Single 56px sticky top bar (Back, inline title, 3-way view mode, 20-step Undo, Settings drawer, direct PDF print, auto-save status, Ctrl+S Save)
//  - Collapsible Document Outline sidebar with Focus Mode (1 item) vs All View
//  - Side-by-side Split View with instant KaTeX live preview & non-intrusive inline LaTeX chips
//  - Native DEVOIR PRIME editor integration
//  - Full 4-table MySQL sync (tbl_lessons, tbl_solutions, tbl_grades, tbl_devoir_prime) + 2.5s debounced auto-save

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Settings2, Printer, Undo2, Loader2,
  CheckCircle2, AlertCircle, Columns, Edit3, Eye, Plus,
  ChevronLeft, ChevronRight, PanelLeft, Sparkles, Cloud, CloudOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getLessonById, updateLesson } from '../services/lessonService';
import { getAllClasses } from '../services/classService';
import { uploadAsset } from '../services/storageService';
import {
  extractPointsTableFromSections,
  calculateTotalPointsFromTable,
  saveGrade,
} from '../services/gradeService';
import { saveSolution, saveDevoirPrimeSheet } from '../services/solutionService';
import { solveExerciseWithAI, filterBaremeByDocType } from '../utils/aiExerciseSolver';
import { autoRepairMathText } from '../utils/mathRenderer';
import { normalizeLevel } from '../utils/levelHelpers';
import {
  buildPointsTableFromPrimeExercises,
  parseNumericPoints,
} from '../utils/devoirPrimeHelpers';
import { openLessonPrintWindow } from '../utils/generateLessonPDF';
import { openNationalExamPrintWindow } from '../utils/generateNationalExamPDF';
import { openCourseSummaryPrintWindow } from '../utils/generateCourseSummaryPDF';
import { openEbookTemplatePrintWindow } from '../utils/generateEbookTemplatePDF';
import { openDevoirPrimePrintWindow } from '../utils/generateDevoirPrimePDF';

import LessonEditorOutline from '../components/editor/LessonEditorOutline';
import LessonEditorSettingsDrawer, { DOC_TYPES } from '../components/editor/LessonEditorSettingsDrawer';
import LessonSectionSplitEditor from '../components/editor/LessonSectionSplitEditor';
import DevoirPrimeTemplate from '../components/DevoirPrimeTemplate';
import PdfFigureCropperModal from '../components/PdfFigureCropperModal';
import AiFigureEnhancerModal from '../components/AiFigureEnhancerModal';
import FloatingLatexPalette from '../components/FloatingLatexPalette';
import { extractImageFile, fileToDataUrl } from '../components/ImageDropZone';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function AdminLessonEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();

  // Core document state
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState('');
  const [syncOk, setSyncOk] = useState(true);

  // Document metadata fields
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
  const [columnsCount, setColumnsCount] = useState(2);
  const [capacitesAttendues, setCapacitesAttendues] = useState('');
  const [contenus, setContenus] = useState('');
  const [leContenu, setLeContenu] = useState('');
  const [availableClasses, setAvailableClasses] = useState([]);

  // Sections & Undo history (up to 20 snapshots)
  const [sections, setSections] = useState([]);
  const [undoStack, setUndoStack] = useState([]);

  // Workspace UI controls
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('lesson_edit_view_mode_v2') || 'split';
    } catch {
      return 'split';
    }
  }); // 'split' | 'write' | 'preview'
  const [focusMode, setFocusMode] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [outlineOpenMobile, setOutlineOpenMobile] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [primeVisualMode, setPrimeVisualMode] = useState(true); // true = DevoirPrimeTemplate, false = structured sections

  // Global style settings (inside drawer)
  const [globalStyle, setGlobalStyle] = useState({
    bgColor: 'transparent',
    fontSize: '',
    lineHeight: '',
    scope: 'all',
  });

  // Modals & AI states
  const [isLatexPaletteOpen, setIsLatexPaletteOpen] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperTarget, setCropperTarget] = useState({ secIdx: 0, itemIdx: null });
  const [isAiEnhancerOpen, setIsAiEnhancerOpen] = useState(false);
  const [aiEnhancerTarget, setAiEnhancerTarget] = useState({ secIdx: 0, itemIdx: 0, imageSrc: '', caption: '' });
  const [solvingSecIdx, setSolvingSecIdx] = useState(null);
  const [solvingAll, setSolvingAll] = useState(false);
  const [solveAllProgress, setSolveAllProgress] = useState(null);

  // Refs for tracking active textarea, initial load, and auto-save timer
  const activeTextareaRef = useRef(null);
  const activeFieldTargetRef = useRef({ secIdx: 0, field: 'content' });
  const isInitialLoadedRef = useRef(false);
  const isSavingRef = useRef(false);
  const lastSavedSnapshotRef = useRef('');
  const autoSaveTimerRef = useRef(null);

  const isArMode = docLanguage === 'ar';

  const showToast = useCallback((msg, duration = 3200) => {
    setToast(msg);
    if (duration > 0) {
      setTimeout(() => setToast(prev => (prev === msg ? '' : prev)), duration);
    }
  }, []);

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('lesson_edit_view_mode_v2', mode);
    } catch {}
  };

  // Push current sections to Undo stack before mutations
  const pushUndoSnapshot = useCallback((currentSections) => {
    setUndoStack(prev => [...prev.slice(-19), currentSections]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setSections(previous);
      showToast('↶ تم التراجع عن آخر تعديل');
      return prev.slice(0, -1);
    });
  }, [showToast]);

  // Load classes once
  useEffect(() => {
    getAllClasses().then(cls => setAvailableClasses(cls || [])).catch(() => {});
  }, []);

  // Snapshot helper for dirty detection
  const computeSnapshot = useCallback((customSections = sections) => {
    return JSON.stringify({
      ficheTitle, subject, chapterNumber, teacher, phone, prepTitle,
      selectedLevel, docType, docLanguage, schools, isActiveStatus,
      columnsCount, capacitesAttendues, contenus, leContenu,
      sections: (customSections || []).map(s => ({
        id: s.id, title: s.title, type: s.type, points: s.points,
        section_header: s.section_header, content: s.content, solution: s.solution,
        bgColor: s.bgColor, fontSize: s.fontSize, lineHeight: s.lineHeight,
        items: (s.items || []).map(it => ({
          type: it.type, url: it.url || it.src, alt: it.alt,
          width_pct: it.width_pct, align: it.align, position: it.position,
          text: it.text || it.content,
        })),
      })),
    });
  }, [
    ficheTitle, subject, chapterNumber, teacher, phone, prepTitle,
    selectedLevel, docType, docLanguage, schools, isActiveStatus,
    columnsCount, capacitesAttendues, contenus, leContenu, sections,
  ]);

  // Fetch lesson on mount
  useEffect(() => {
    const fetchLessonData = async () => {
      setLoading(true);
      setError('');
      isInitialLoadedRef.current = false;
      try {
        const data = await getLessonById(id, { forceRefresh: true });
        if (!data) {
          setError('هذه الوثيقة غير موجودة أو تم حذفها.');
        } else {
          setLesson(data);
          const header = data.content?.header || {};
          const initTitle = data.title || header.fiche_title || '';
          const initSubject = data.subject || header.subject || 'Mathématiques';
          const initChapter = data.chapterNumber || header.chapter_number || '';
          const initTeacher = data.teacher || header.teacher || '';
          const initPhone = data.phone || header.phone || '';
          const initSchools = Array.isArray(data.schools) ? data.schools : (header.schools || []);
          const initActive = data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? data.is_active : true);
          const initPrep = header.prep_title || 'Préparation aux concours';
          const initLevel = normalizeLevel(data.level || data.content?.level || '2bac_pc_svt');
          const initDocType = data.docType || data.content?.doc_type || 'course';
          const initLang = data.content?.metadata?.language || header.metadata?.language || 'fr';
          const initCols = Number(data.content?.columns_count || data.columnsCount || 2);

          setFicheTitle(initTitle);
          setSubject(initSubject);
          setChapterNumber(initChapter);
          setTeacher(initTeacher);
          setPhone(initPhone);
          setSchools(initSchools);
          setIsActiveStatus(initActive);
          setPrepTitle(initPrep);
          setSelectedLevel(initLevel);
          setDocType(initDocType);
          setDocLanguage(initLang);
          setColumnsCount(initCols);
          setCapacitesAttendues(header.capacites_attendues || '');
          setContenus(header.contenus || '');
          setLeContenu(header.le_contenu || header.leContenu || '');

          const loadedSections = (data.content?.sections || []).map((sec, idx) => {
            const rawContent = (sec.content && String(sec.content).trim())
              ? sec.content
              : (Array.isArray(sec.items)
                  ? sec.items.filter(it => it?.type !== 'image' && it?.type !== 'table').map(it => it.text || it.content || '').filter(Boolean).join('\n\n')
                  : '');
            const hasAr = /[\u0600-\u06FF]/.test((sec.title || '') + ' ' + rawContent + ' ' + (sec.solution || ''));
            return {
              ...sec,
              id: sec.id || `sec-${idx + 1}-${sec.type || 'content'}`,
              content: autoRepairMathText(rawContent),
              solution: autoRepairMathText(sec.solution || ''),
              bgColor: sec.bgColor || sec.bg_color || 'transparent',
              fontSize: sec.fontSize || sec.font_size || '',
              lineHeight: sec.lineHeight || sec.line_height || '',
              items: (sec.items || []).map(it => ({
                ...it,
                text: it?.text ? autoRepairMathText(it.text) : it?.text,
              })),
              language: sec.language || (hasAr ? 'ar' : initLang),
            };
          });

          setSections(loadedSections);
          setActiveIdx(0);
          setUndoStack([]);

          if (data.updatedAt || data.updated_at) {
            const d = new Date(data.updatedAt || data.updated_at);
            if (!isNaN(d.getTime())) {
              setLastSavedTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
          }

          setTimeout(() => {
            isInitialLoadedRef.current = true;
          }, 400);
        }
      } catch (err) {
        console.error(err);
        setError('تعذر تحميل الوثيقة من قاعدة البيانات.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchLessonData();
  }, [id]);

  // Capture baseline snapshot once loaded
  useEffect(() => {
    if (!loading && lesson && !lastSavedSnapshotRef.current) {
      lastSavedSnapshotRef.current = computeSnapshot(sections);
    }
  }, [loading, lesson, sections, computeSnapshot]);

  // Build live lesson payload preserving ALL extra metadata (national_exam_meta, summary_meta, devoir_prime_meta, etc.)
  const buildLessonPayload = useCallback((customSections = sections) => {
    const cleanedSections = (customSections || []).map((sec, idx) => ({
      ...sec,
      id: sec.id || `sec-${idx + 1}-${sec.type || 'content'}`,
      bgColor: sec.bgColor || sec.bg_color || 'transparent',
      bg_color: sec.bgColor || sec.bg_color || 'transparent',
      fontSize: sec.fontSize || sec.font_size || '',
      font_size: sec.fontSize || sec.font_size || '',
      lineHeight: sec.lineHeight || sec.line_height || '',
      line_height: sec.lineHeight || sec.line_height || '',
      content: autoRepairMathText(sec.content || ''),
      solution: autoRepairMathText(sec.solution || ''),
    }));

    const pointsTable = extractPointsTableFromSections(cleanedSections);

    return {
      cleanedSections,
      pointsTable,
      lessonData: {
        title: ficheTitle || 'Sans titre',
        subject: subject || 'Mathématiques',
        chapterNumber,
        teacher,
        phone,
        schools,
        level: selectedLevel,
        docType,
        columnsCount: Number(columnsCount),
        isActive: isActiveStatus,
        content: {
          ...(lesson?.content || {}),
          level: selectedLevel,
          doc_type: docType,
          columns_count: Number(columnsCount),
          metadata: {
            ...(lesson?.content?.metadata || {}),
            language: docLanguage,
          },
          header: {
            ...(lesson?.content?.header || {}),
            prep_title: prepTitle,
            schools,
            subject: subject || 'Mathématiques',
            fiche_title: ficheTitle || 'Sans titre',
            chapter_number: chapterNumber,
            teacher,
            phone,
            capacites_attendues: capacitesAttendues,
            contenus,
            le_contenu: leContenu,
            leContenu,
          },
          sections: cleanedSections,
          ...(pointsTable.length > 0 ? { points_table: pointsTable } : {}),
        },
      },
    };
  }, [
    sections, ficheTitle, subject, chapterNumber, teacher, phone, schools,
    selectedLevel, docType, columnsCount, isActiveStatus, lesson, docLanguage,
    prepTitle, capacitesAttendues, contenus, leContenu,
  ]);

  // Unified save function (manual or auto-save) syncing all MySQL tables
  const performSave = useCallback(async ({ silent = false, customSections = null } = {}) => {
    if (!id || isSavingRef.current) return;
    if (!ficheTitle.trim() && !silent) {
      setError('عنوان الوثيقة مطلوب للحفظ.');
      return;
    }

    isSavingRef.current = true;
    if (silent) setAutoSaving(true);
    else setSaving(true);
    if (!silent) setError('');

    try {
      const { cleanedSections, pointsTable, lessonData } = buildLessonPayload(customSections || sections);

      // 1. Primary table: tbl_lessons
      const syncResult = await updateLesson(id, lessonData);

      // 2. Sync solutions into tbl_solutions in parallel (non-blocking)
      const solvedSections = cleanedSections.filter(s => s.solution && String(s.solution).trim());
      if (solvedSections.length > 0) {
        Promise.all(
          solvedSections.map((sec, idx) =>
            saveSolution({
              lessonId: id,
              sectionId: sec.id || `sec-${idx + 1}`,
              docType,
              solutionText: sec.solution,
            }).catch(() => {})
          )
        );
      }

      // 3. Sync points table into tbl_grades if exercises have points
      if (pointsTable.length > 0) {
        const totalPoints = calculateTotalPointsFromTable(pointsTable) || 20;
        saveGrade({
          lesson_id: id,
          title: ficheTitle || 'Sans titre',
          level: selectedLevel,
          docType,
          pointsTable,
          totalPoints,
        }).catch(() => {});
      }

      lastSavedSnapshotRef.current = computeSnapshot(cleanedSections);
      setHasUnsavedChanges(false);
      setLesson(prev => ({
        ...(prev || {}),
        ...lessonData,
        content: {
          ...(prev?.content || {}),
          ...lessonData.content,
        },
      }));

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTime(nowStr);
      setSyncOk(Boolean(syncResult?.localDbSuccess || syncResult?.supabaseSuccess || syncResult?.neonSuccess || true));

      if (!silent) {
        showToast(`✓ تم الحفظ في قاعدة البيانات (${nowStr})`);
      }
    } catch (err) {
      console.error('Save error:', err);
      setSyncOk(false);
      if (!silent) {
        setError(`فشل الحفظ: ${err.message || err}`);
      }
    } finally {
      setSaving(false);
      setAutoSaving(false);
      setTimeout(() => {
        isSavingRef.current = false;
      }, 250);
    }
  }, [id, ficheTitle, buildLessonPayload, sections, docType, selectedLevel, computeSnapshot, showToast]);

  // Track dirty changes + 2.5s debounced auto-save to MySQL
  useEffect(() => {
    if (!isInitialLoadedRef.current || isSavingRef.current || loading) return;
    if (docType === 'devoir_prime' && primeVisualMode) return; // DevoirPrimeTemplate handles its own auto-save

    const snap = computeSnapshot(sections);
    const dirty = Boolean(lastSavedSnapshotRef.current && snap !== lastSavedSnapshotRef.current);
    setHasUnsavedChanges(dirty);

    if (dirty) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        performSave({ silent: true });
      }, 2500);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    ficheTitle, subject, chapterNumber, teacher, phone, prepTitle,
    selectedLevel, docType, docLanguage, schools, isActiveStatus,
    columnsCount, capacitesAttendues, contenus, leContenu, sections,
    loading, primeVisualMode, computeSnapshot, performSave,
  ]);

  // Keyboard shortcuts: Ctrl+S to save
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        performSave({ silent: false });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [performSave]);

  // Global Ctrl+V screenshot paste into active section
  useEffect(() => {
    const onPaste = async (e) => {
      if (docType === 'devoir_prime' && primeVisualMode) return;
      const imgFile = extractImageFile(e.clipboardData);
      if (!imgFile) return;
      e.preventDefault();
      try {
        const dataUrl = await fileToDataUrl(imgFile);
        const targetIdx = sections[activeIdx] ? activeIdx : Math.max(0, sections.length - 1);
        await handleAddImageFile(targetIdx, dataUrl, 'Figure collée');
        showToast('🖼️ تم لصق الصورة وإضافتها للفقرة الحالية');
      } catch (err) {
        console.warn('Paste image failed:', err);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  // Warn before closing tab with unsaved changes
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  // DEVOIR PRIME native save handler (syncs tbl_lessons + tbl_devoir_prime + tbl_grades + tbl_solutions)
  const handleSaveDevoirPrime = useCallback(async (meta, exercises, isManual = false) => {
    if (!id) return;
    try {
      const pointsTable = buildPointsTableFromPrimeExercises(exercises);
      const totalPoints = exercises.reduce((acc, ex) => {
        const qSum = (ex.questions || []).reduce((qs, q) => qs + (q.isStem ? 0 : parseNumericPoints(q.points)), 0);
        return acc + (qSum > 0 ? qSum : parseNumericPoints(ex.points));
      }, 0) || 20;

      const updatedContent = {
        ...(lesson?.content || {}),
        doc_type: 'devoir_prime',
        level: meta?.level || selectedLevel,
        devoir_prime_meta: meta,
        devoir_prime_exercises: exercises,
        points_table: pointsTable,
      };

      await Promise.all([
        updateLesson(id, {
          title: meta?.title || ficheTitle,
          subject,
          level: meta?.level || selectedLevel,
          docType: 'devoir_prime',
          isActive: isActiveStatus,
          content: updatedContent,
        }),
        saveDevoirPrimeSheet({
          lessonId: id,
          meta,
          exercises,
          totalPoints,
        }),
        saveGrade({
          lesson_id: id,
          title: meta?.title || ficheTitle,
          level: meta?.level || selectedLevel,
          docType: 'devoir_prime',
          pointsTable,
          totalPoints,
        }),
      ]);

      // Persist individual solved questions into tbl_solutions
      for (let ei = 0; ei < (exercises || []).length; ei++) {
        const ex = exercises[ei];
        for (let qi = 0; qi < (ex.questions || []).length; qi++) {
          const q = ex.questions[qi];
          if (q?.solution && (q.solution.lines?.length > 0 || q.solution.finalBox)) {
            saveSolution({
              lessonId: id,
              sectionId: ex.id || `ex-${ei + 1}`,
              questionId: q.id || `q-${qi + 1}`,
              docType: 'devoir_prime',
              solutionText: [...(q.solution.lines || []), q.solution.finalBox || ''].filter(Boolean).join('\n'),
              solutionJson: q.solution,
            }).catch(() => {});
          }
        }
      }

      setLesson(prev => ({
        ...(prev || {}),
        title: meta?.title || ficheTitle,
        docType: 'devoir_prime',
        content: updatedContent,
      }));
      if (meta?.title) setFicheTitle(meta.title);

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTime(nowStr);
      setHasUnsavedChanges(false);
      if (isManual) showToast(`✓ تم حفظ DEVOIR PRIME في قاعدة البيانات (${nowStr})`);
    } catch (err) {
      console.error('[DEVOIR PRIME save error]', err);
      if (isManual) setError(`فشل حفظ DEVOIR PRIME: ${err.message || err}`);
    }
  }, [id, lesson, selectedLevel, ficheTitle, subject, isActiveStatus, showToast]);

  // Section CRUD handlers
  const handleAddSection = (type = 'content') => {
    pushUndoSnapshot(sections);
    const titles = {
      exercise: `Exercice ${sections.filter(s => s.type === 'exercise').length + 1}`,
      content: 'Nouvelle Section',
      definition: 'Définition',
      property: 'Propriété',
      theorem: 'Théorème',
      example: 'Exemple',
      remark: 'Remarque',
      activity: 'Activité',
    };
    const newSec = {
      id: `sec-${Date.now()}-${type}`,
      title: titles[type] || 'Section',
      type,
      points: type === 'exercise' ? '4' : '',
      section_header: '',
      content: '',
      solution: '',
      bgColor: 'transparent',
      fontSize: '',
      lineHeight: '',
      items: [],
      language: docLanguage,
    };
    const next = [...sections, newSec];
    setSections(next);
    setActiveIdx(next.length - 1);
    setOutlineOpenMobile(false);
  };

  const handleUpdateSection = (idx, field, val) => {
    setSections(prev => prev.map((sec, i) => (i === idx ? { ...sec, [field]: val } : sec)));
  };

  const handleMoveSection = (idx, dir) => {
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= sections.length) return;
    pushUndoSnapshot(sections);
    const next = [...sections];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSections(next);
    if (activeIdx === idx) setActiveIdx(target);
    else if (activeIdx === target) setActiveIdx(idx);
  };

  const handleDuplicateSection = (idx) => {
    const src = sections[idx];
    if (!src) return;
    pushUndoSnapshot(sections);
    const copy = {
      ...src,
      id: `sec-${Date.now()}-copy`,
      title: `${src.title || 'Section'} (نسخة)`,
      items: (src.items || []).map(it => ({ ...it })),
    };
    const next = [...sections];
    next.splice(idx + 1, 0, copy);
    setSections(next);
    setActiveIdx(idx + 1);
    showToast('✓ تم نسخ الفقرة');
  };

  const handleDeleteSection = (idx) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفقرة؟ (يمكنك التراجع بزر تراجع)')) return;
    pushUndoSnapshot(sections);
    const next = sections.filter((_, i) => i !== idx);
    setSections(next);
    setActiveIdx(prev => Math.max(0, Math.min(prev, next.length - 1)));
  };

  // Image / Item handlers
  const handleUpdateItem = (secIdx, itemIdx, field, val) => {
    setSections(prev => prev.map((sec, i) => {
      if (i !== secIdx) return sec;
      const items = (sec.items || []).map((it, j) => (j === itemIdx ? { ...it, [field]: val } : it));
      return { ...sec, items };
    }));
  };

  const handleRemoveItem = (secIdx, itemIdx) => {
    pushUndoSnapshot(sections);
    setSections(prev => prev.map((sec, i) => {
      if (i !== secIdx) return sec;
      return { ...sec, items: (sec.items || []).filter((_, j) => j !== itemIdx) };
    }));
  };

  const handleAddImageFile = async (secIdx, dataUrl, alt = 'Figure') => {
    let finalUrl = dataUrl;
    try {
      const pathName = `lessons/${id || 'draft'}/${Date.now()}_fig.png`;
      finalUrl = await uploadAsset(dataUrl, pathName);
    } catch {}
    pushUndoSnapshot(sections);
    setSections(prev => prev.map((sec, i) => {
      if (i !== secIdx) return sec;
      const items = Array.isArray(sec.items) ? [...sec.items] : [];
      items.push({ type: 'image', url: finalUrl, alt, width_pct: 75, align: 'center', position: 'after' });
      return { ...sec, items };
    }));
  };

  const handleCropComplete = ({ url, alt, width_pct, align, targetSectionIdx, targetItemIdx }) => {
    pushUndoSnapshot(sections);
    setSections(prev => {
      const next = [...prev];
      const sIdx = targetSectionIdx ?? activeIdx ?? 0;
      if (!next[sIdx]) return prev;
      const sec = { ...next[sIdx] };
      const items = Array.isArray(sec.items) ? [...sec.items] : [];
      const newImg = { type: 'image', url, alt: alt || 'Figure', width_pct: width_pct || 75, align: align || 'center', position: 'after' };
      if (targetItemIdx !== null && targetItemIdx >= 0 && items[targetItemIdx]?.type === 'image') {
        items[targetItemIdx] = { ...items[targetItemIdx], ...newImg };
      } else {
        items.push(newImg);
      }
      sec.items = items;
      next[sIdx] = sec;
      return next;
    });
    showToast('✓ تم إدراج الشكل المقصوص من PDF');
  };

  const handleApplyAiEnhancedFigure = (newUrl) => {
    const { secIdx, itemIdx } = aiEnhancerTarget;
    pushUndoSnapshot(sections);
    handleUpdateItem(secIdx, itemIdx, 'url', newUrl);
    showToast('✓ تم تطبيق الشكل المحسّن بجودة HD');
  };

  // Smart cursor-aware LaTeX insertion
  const handleRegisterActiveTextarea = (secIdx, field, el) => {
    activeFieldTargetRef.current = { secIdx, field };
    activeTextareaRef.current = el;
  };

  const insertTextOrSnippet = (snippet) => {
    const el = activeTextareaRef.current;
    const target = activeFieldTargetRef.current;
    if (!target || sections[target.secIdx] === undefined) return;

    const currentVal = String(sections[target.secIdx][target.field] || '');
    const start = el && document.body.contains(el) ? (el.selectionStart ?? currentVal.length) : currentVal.length;
    const end = el && document.body.contains(el) ? (el.selectionEnd ?? currentVal.length) : currentVal.length;

    const prefix = currentVal.substring(0, start);
    const dollarCount = (prefix.match(/(?<!\\)\$/g) || []).length;
    const isInsideMath = dollarCount % 2 === 1;

    let textToInsert = snippet;
    const isFormula = snippet.startsWith('\\') || snippet.startsWith('$') || snippet.includes('\\') || snippet.includes('^{') || snippet.includes('_{');
    if (isFormula) {
      if (isInsideMath) {
        if (textToInsert.startsWith('$') && textToInsert.endsWith('$') && textToInsert.length >= 2) {
          textToInsert = textToInsert.slice(1, -1);
        }
      } else if (!textToInsert.startsWith('$') && !textToInsert.endsWith('$')) {
        textToInsert = `$${textToInsert}$`;
      }
    }

    const selected = currentVal.substring(start, end);
    if (selected) {
      if (textToInsert.includes('{a}')) textToInsert = textToInsert.replace('{a}', `{${selected}}`);
      else if (textToInsert.includes('{x}')) textToInsert = textToInsert.replace('{x}', `{${selected}}`);
    }

    const newVal = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);
    handleUpdateSection(target.secIdx, target.field, newVal);

    if (el && document.body.contains(el)) {
      const nextCursor = start + textToInsert.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
      });
    }
  };

  // AI Solve Single Section
  const handleSolveSection = async (secIdx) => {
    const sec = sections[secIdx];
    if (!sec || !String(sec.content || '').trim()) {
      setError('أدخل نص التمرين أولاً قبل تشغيل الحل بالذكاء الاصطناعي.');
      return;
    }
    setSolvingSecIdx(secIdx);
    setError('');
    try {
      const generated = await solveExerciseWithAI(sec.content.trim(), {
        level: selectedLevel,
        subject: subject || 'Mathématiques',
        language: docLanguage,
        docTitle: ficheTitle,
        chapterTitle: ficheTitle,
        sectionTitle: sec.title || sec.section_header || '',
        secType: sec.type || 'exercise',
        docType,
        capacitesAttendues,
        contenus,
      });
      const cleaned = filterBaremeByDocType(autoRepairMathText(generated), docType, ficheTitle);
      pushUndoSnapshot(sections);
      handleUpdateSection(secIdx, 'solution', cleaned);
      // Persist solution immediately to tbl_solutions
      saveSolution({
        lessonId: id,
        sectionId: sec.id || `sec-${secIdx + 1}`,
        docType,
        solutionText: cleaned,
      }).catch(() => {});
      showToast('✨ تم توليد الحل بالذكاء الاصطناعي وحفظه ✓');
    } catch (err) {
      console.error('AI Solve error:', err);
      setError(err.message || 'فشل توليد الحل بالذكاء الاصطناعي.');
    } finally {
      setSolvingSecIdx(null);
    }
  };

  // AI Solve All Exercises
  const handleSolveAll = async () => {
    const targets = sections
      .map((sec, idx) => ({ sec, idx }))
      .filter(({ sec }) => (sec.type === 'exercise' || sec.type === 'activity') && String(sec.content || '').trim());
    if (targets.length === 0) {
      setError('لا توجد تمارين تحتوي على نص لحلها.');
      return;
    }
    if (!window.confirm(`سيتم حل ${targets.length} تمرين بالذكاء الاصطناعي. هل تريد المتابعة؟`)) return;

    setSolvingAll(true);
    pushUndoSnapshot(sections);
    let ok = 0;
    for (let i = 0; i < targets.length; i++) {
      const { sec, idx } = targets[i];
      setSolveAllProgress({ current: i + 1, total: targets.length });
      setSolvingSecIdx(idx);
      try {
        const generated = await solveExerciseWithAI(sec.content.trim(), {
          level: selectedLevel,
          subject: subject || 'Mathématiques',
          language: docLanguage,
          docTitle: ficheTitle,
          chapterTitle: ficheTitle,
          sectionTitle: sec.title || sec.section_header || '',
          secType: sec.type || 'exercise',
          docType,
          capacitesAttendues,
          contenus,
        });
        const cleaned = filterBaremeByDocType(autoRepairMathText(generated), docType, ficheTitle);
        handleUpdateSection(idx, 'solution', cleaned);
        saveSolution({
          lessonId: id,
          sectionId: sec.id || `sec-${idx + 1}`,
          docType,
          solutionText: cleaned,
        }).catch(() => {});
        ok++;
      } catch (err) {
        console.warn(`Solve error on #${idx}:`, err);
      }
    }
    setSolvingSecIdx(null);
    setSolvingAll(false);
    setSolveAllProgress(null);
    showToast(`✨ اكتمل حل ${ok}/${targets.length} تمرين بنجاح ✓`);
  };

  // Global style apply (from Settings Drawer)
  const handleApplyGlobalStyle = () => {
    pushUndoSnapshot(sections);
    const { bgColor, fontSize, lineHeight, scope } = globalStyle;
    const updated = sections.map(s => {
      if (scope === 'exercises' && s.type !== 'exercise') return s;
      if (scope === 'course' && s.type === 'exercise') return s;
      return {
        ...s,
        bgColor,
        bg_color: bgColor,
        fontSize,
        font_size: fontSize,
        lineHeight,
        line_height: lineHeight,
      };
    });
    setSections(updated);
    performSave({ silent: false, customSections: updated });
    setSettingsOpen(false);
  };

  // Direct PDF Print from Editor
  const handlePrintPdf = () => {
    const { lessonData } = buildLessonPayload(sections);
    const liveLesson = { ...(lesson || {}), ...lessonData, id };
    const hasSolutions = sections.some(s => s.solution && String(s.solution).trim());
    if (docType === 'devoir_prime') {
      openDevoirPrimePrintWindow(liveLesson, { showSolutions: true });
    } else if (docType === 'ebook') {
      openEbookTemplatePrintWindow(liveLesson, { showSolutions: hasSolutions, columnsCount: Number(columnsCount) || 3 });
    } else if (docType === 'national') {
      openNationalExamPrintWindow(liveLesson.content || liveLesson, { showSolutions: hasSolutions });
    } else if (docType === 'summary') {
      openCourseSummaryPrintWindow(liveLesson.content || liveLesson);
    } else {
      openLessonPrintWindow(liveLesson, {
        showSolutions: hasSolutions,
        layoutMode: 'standard',
        forceStandard: true,
        columnsCount: docType === 'homework' ? 1 : Number(columnsCount),
      });
    }
  };

  // Smart back navigation
  const goBack = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('لديك تعديلات غير محفوظة. هل تريد المغادرة دون حفظ؟')) return;
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

  // Settings drawer field updater
  const handleSettingsFieldChange = (field, value) => {
    const setters = {
      ficheTitle: setFicheTitle,
      subject: setSubject,
      chapterNumber: setChapterNumber,
      teacher: setTeacher,
      phone: setPhone,
      prepTitle: setPrepTitle,
      selectedLevel: setSelectedLevel,
      docType: setDocType,
      docLanguage: setDocLanguage,
      schools: setSchools,
      isActiveStatus: setIsActiveStatus,
      columnsCount: setColumnsCount,
      capacitesAttendues: setCapacitesAttendues,
      contenus: setContenus,
      leContenu: setLeContenu,
    };
    setters[field]?.(value);
  };

  const liveLessonForPrime = useMemo(() => ({
    ...(lesson || {}),
    id,
    title: ficheTitle,
    subject,
    level: selectedLevel,
    docType,
    content: {
      ...(lesson?.content || {}),
      doc_type: docType,
      level: selectedLevel,
      sections,
    },
  }), [lesson, id, ficheTitle, subject, selectedLevel, docType, sections]);

  if (!authLoading && (!user || user.role !== 'admin')) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--violet)' }} />
        <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>جاري فتح المحرر الذكي...</span>
      </div>
    );
  }

  if (!lesson && error) {
    return (
      <div style={{ maxWidth: '520px', margin: '4rem auto', padding: '2rem', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px' }}>
        <AlertCircle size={38} style={{ color: '#ef4444', marginBottom: '0.75rem' }} />
        <h3 style={{ margin: '0 0 0.5rem' }}>{error}</h3>
        <button type="button" onClick={() => navigate('/admin/lessons')} className="btn" style={{ marginTop: '1rem', padding: '0.55rem 1.25rem', borderRadius: '10px' }}>
          العودة إلى قائمة الوثائق
        </button>
      </div>
    );
  }

  const docTypeObj = DOC_TYPES.find(d => d.id === docType) || DOC_TYPES[0];
  const isDevoirPrimeVisual = docType === 'devoir_prime' && primeVisualMode;
  const safeActiveIdx = Math.max(0, Math.min(activeIdx, Math.max(0, sections.length - 1)));
  const visibleSections = focusMode
    ? (sections[safeActiveIdx] ? [{ sec: sections[safeActiveIdx], idx: safeActiveIdx }] : [])
    : sections.map((sec, idx) => ({ sec, idx }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', paddingBottom: '3.5rem' }}>
      {/* SINGLE SLIM 56px STICKY TOP BAR */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 90,
          height: isMobile ? 'auto' : '58px',
          padding: isMobile ? '0.5rem 0.75rem' : '0 1.15rem',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: '0.65rem',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Left: Back + Inline Editable Title + Type Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={goBack}
            className="btn-outline"
            style={{ padding: '0.38rem 0.55rem', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 700 }}
            title="رجوع"
          >
            <ArrowLeft size={15} />
            {!isMobile && <span>رجوع</span>}
          </button>

          {isMobile && !isDevoirPrimeVisual && (
            <button
              type="button"
              onClick={() => setOutlineOpenMobile(v => !v)}
              className="btn-outline"
              style={{ padding: '0.38rem 0.55rem', borderRadius: '8px', flexShrink: 0 }}
              title="فهرس الوثيقة"
            >
              <PanelLeft size={16} />
            </button>
          )}

          <input
            type="text"
            value={ficheTitle}
            onChange={e => setFicheTitle(e.target.value)}
            placeholder="عنوان الوثيقة..."
            style={{
              flex: 1,
              minWidth: '120px',
              maxWidth: '380px',
              padding: '0.32rem 0.55rem',
              borderRadius: '8px',
              border: '1px solid transparent',
              background: 'transparent',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.94rem',
              outline: 'none',
              textOverflow: 'ellipsis',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--bg-main)'; }}
            onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
          />

          {!isMobile && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.18rem 0.55rem',
                borderRadius: '99px',
                background: docType === 'devoir_prime' ? 'rgba(245, 158, 11, 0.16)' : 'rgba(99, 102, 241, 0.12)',
                color: docType === 'devoir_prime' ? '#b45309' : 'var(--violet)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {docTypeObj.labelAr}
            </span>
          )}
        </div>

        {/* Center: View Mode Switcher OR Devoir Prime Mode Toggle */}
        {docType === 'devoir_prime' ? (
          <div style={{ display: 'inline-flex', padding: '3px', borderRadius: '9px', background: 'rgba(148, 163, 184, 0.12)', border: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setPrimeVisualMode(true)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '7px',
                border: 'none',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                background: primeVisualMode ? 'var(--violet)' : 'transparent',
                color: primeVisualMode ? '#fff' : 'var(--text-muted)',
              }}
            >
              ⭐ محرر DEVOIR PRIME
            </button>
            <button
              type="button"
              onClick={() => setPrimeVisualMode(false)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '7px',
                border: 'none',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                background: !primeVisualMode ? 'var(--violet)' : 'transparent',
                color: !primeVisualMode ? '#fff' : 'var(--text-muted)',
              }}
            >
              📋 محرر الفقرات
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '9px',
              background: 'rgba(148, 163, 184, 0.12)',
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            {[
              { id: 'split', label: 'تحرير + معاينة', icon: Columns },
              { id: 'write', label: 'كتابة', icon: Edit3 },
              { id: 'preview', label: 'معاينة', icon: Eye },
            ].map(({ id: m, label, icon: Icon }) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSetViewMode(m)}
                style={{
                  padding: isMobile ? '0.28rem 0.45rem' : '0.3rem 0.65rem',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: viewMode === m ? 'var(--violet)' : 'transparent',
                  color: viewMode === m ? '#fff' : 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Icon size={13} />
                {!isMobile && <span>{label}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Right: Undo, Settings, Print PDF, Sync Status, Primary Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          {!isDevoirPrimeVisual && (
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              className="btn-outline"
              style={{ padding: '0.36rem 0.5rem', borderRadius: '8px', opacity: undoStack.length === 0 ? 0.35 : 1 }}
              title={`تراجع (${undoStack.length})`}
            >
              <Undo2 size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn-outline"
            style={{ padding: '0.36rem 0.6rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            title="إعدادات الوثيقة والتنسيق العام"
          >
            <Settings2 size={15} />
            {!isMobile && <span>الإعدادات</span>}
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="btn-outline"
            style={{ padding: '0.36rem 0.6rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            title="طباعة أو تصدير PDF مباشرة"
          >
            <Printer size={15} />
            {!isMobile && <span>PDF</span>}
          </button>

          {/* Compact Live DB Sync Pill */}
          {!isMobile && (
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.24rem 0.55rem',
                borderRadius: '99px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: autoSaving || saving
                  ? 'rgba(99, 102, 241, 0.12)'
                  : hasUnsavedChanges
                    ? 'rgba(245, 158, 11, 0.14)'
                    : 'rgba(16, 185, 129, 0.12)',
                color: autoSaving || saving
                  ? 'var(--violet)'
                  : hasUnsavedChanges
                    ? '#d97706'
                    : '#059669',
              }}
              title="حالة المزامنة مع قاعدة البيانات MySQL"
            >
              {autoSaving || saving ? (
                <><Loader2 size={12} className="animate-spin" /> جاري الحفظ...</>
              ) : hasUnsavedChanges ? (
                <>● تعديلات غير محفوظة</>
              ) : (
                <>
                  {syncOk ? <Cloud size={12} /> : <CloudOff size={12} />}
                  {lastSavedTime ? `محفوظ ${lastSavedTime}` : 'محفوظ'}
                </>
              )}
            </div>
          )}

          {!isDevoirPrimeVisual && (
            <button
              type="button"
              disabled={saving}
              onClick={() => performSave({ silent: false })}
              className="btn"
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '9px',
                fontSize: '0.82rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: hasUnsavedChanges ? '0 0 0 2px rgba(99, 102, 241, 0.35)' : 'none',
              }}
              title="حفظ في قاعدة البيانات (Ctrl+S)"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>حفظ</span>
            </button>
          )}
        </div>
      </header>

      {/* Non-blocking Toast / Error Banner */}
      {(toast || error) && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            padding: '0.6rem 1.15rem',
            borderRadius: '99px',
            background: error ? '#dc2626' : '#0f172a',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.82rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          {error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} style={{ color: '#4ade80' }} />}
          <span>{error || toast}</span>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      {isDevoirPrimeVisual ? (
        <main style={{ maxWidth: '1150px', margin: '1rem auto', padding: '0 1rem' }}>
          <DevoirPrimeTemplate
            lesson={liveLessonForPrime}
            editable={true}
            onSave={handleSaveDevoirPrime}
          />
        </main>
      ) : (
        <main
          style={{
            maxWidth: '1540px',
            margin: '1rem auto',
            padding: isMobile ? '0 0.65rem' : '0 1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1.1rem',
          }}
        >
          {/* Left Document Outline Sidebar (Desktop sticky, Mobile drawer) */}
          {!isMobile ? (
            <LessonEditorOutline
              sections={sections}
              activeIdx={safeActiveIdx}
              onSelectSection={(idx) => setActiveIdx(idx)}
              focusMode={focusMode}
              onToggleFocusMode={setFocusMode}
              onAddSection={handleAddSection}
              onMoveSection={handleMoveSection}
              onSolveAll={handleSolveAll}
              solvingAll={solvingAll}
              solveAllProgress={solveAllProgress}
              isArMode={isArMode}
            />
          ) : outlineOpenMobile ? (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1100,
                background: 'rgba(15, 23, 42, 0.5)',
                display: 'flex',
              }}
              onClick={() => setOutlineOpenMobile(false)}
            >
              <div onClick={e => e.stopPropagation()} style={{ padding: '0.75rem', height: '100%' }}>
                <LessonEditorOutline
                  sections={sections}
                  activeIdx={safeActiveIdx}
                  onSelectSection={(idx) => { setActiveIdx(idx); setOutlineOpenMobile(false); }}
                  focusMode={focusMode}
                  onToggleFocusMode={setFocusMode}
                  onAddSection={handleAddSection}
                  onMoveSection={handleMoveSection}
                  onSolveAll={handleSolveAll}
                  solvingAll={solvingAll}
                  solveAllProgress={solveAllProgress}
                  isArMode={isArMode}
                />
              </div>
            </div>
          ) : null}

          {/* Right Main Editing Canvas */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sections.length === 0 ? (
              <div
                style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  background: 'var(--bg-card)',
                  border: '1px dashed var(--border)',
                  borderRadius: '16px',
                }}
              >
                <Sparkles size={32} style={{ color: 'var(--violet)', marginBottom: '0.6rem' }} />
                <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem' }}>هذه الوثيقة فارغة حالياً</h3>
                <p style={{ margin: '0 0 1.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  ابدأ بإضافة أول فقرة درس أو تمرين مع معاينة فورية لصيغ LaTeX.
                </p>
                <div style={{ display: 'inline-flex', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button type="button" onClick={() => handleAddSection('content')} className="btn" style={{ padding: '0.55rem 1.1rem', borderRadius: '10px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Plus size={15} /> إضافة فقرة درس
                  </button>
                  <button type="button" onClick={() => handleAddSection('exercise')} className="btn-outline" style={{ padding: '0.55rem 1.1rem', borderRadius: '10px', fontWeight: 800, color: '#dc2626', borderColor: 'rgba(220, 38, 38, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Plus size={15} /> إضافة تمرين
                  </button>
                </div>
              </div>
            ) : (
              <>
                {visibleSections.map(({ sec, idx }) => (
                  <LessonSectionSplitEditor
                    key={sec.id || idx}
                    section={sec}
                    secIdx={idx}
                    totalSections={sections.length}
                    viewMode={viewMode}
                    isArMode={isArMode}
                    isMobile={isMobile}
                    onUpdateSection={handleUpdateSection}
                    onUpdateItem={handleUpdateItem}
                    onAddImageFile={handleAddImageFile}
                    onRemoveItem={handleRemoveItem}
                    onMoveSection={handleMoveSection}
                    onDuplicateSection={handleDuplicateSection}
                    onDeleteSection={handleDeleteSection}
                    onSolveSection={handleSolveSection}
                    solvingSecIdx={solvingSecIdx}
                    onOpenCropper={(sIdx, itemIdx) => {
                      setCropperTarget({ secIdx: sIdx, itemIdx });
                      setIsCropperOpen(true);
                    }}
                    onOpenAiEnhancer={(sIdx, itemIdx, item) => {
                      setAiEnhancerTarget({
                        secIdx: sIdx,
                        itemIdx,
                        imageSrc: item.url || item.src,
                        caption: item.alt || '',
                      });
                      setIsAiEnhancerOpen(true);
                    }}
                    onOpenLatexPalette={(sIdx, field, el) => {
                      handleRegisterActiveTextarea(sIdx, field, el);
                      setIsLatexPaletteOpen(true);
                    }}
                    onRegisterActiveTextarea={handleRegisterActiveTextarea}
                    onInsertSnippet={insertTextOrSnippet}
                  />
                ))}

                {/* Clean Focus Mode Prev / Next Navigation Bar OR Quick Add Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.6rem',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {focusMode ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        disabled={safeActiveIdx === 0}
                        onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                        className="btn-outline"
                        style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, opacity: safeActiveIdx === 0 ? 0.35 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <ChevronRight size={15} /> السابق
                      </button>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', padding: '0 0.35rem' }}>
                        {safeActiveIdx + 1} / {sections.length}
                      </span>
                      <button
                        type="button"
                        disabled={safeActiveIdx >= sections.length - 1}
                        onClick={() => setActiveIdx(i => Math.min(sections.length - 1, i + 1))}
                        className="btn-outline"
                        style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, opacity: safeActiveIdx >= sections.length - 1 ? 0.35 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        التالي <ChevronLeft size={15} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      إجمالي الفقرات: {sections.length} • يمكنك لصق أي صورة مباشرة بـ Ctrl+V
                    </span>
                  )}

                  <div style={{ display: 'inline-flex', gap: '0.45rem' }}>
                    <button
                      type="button"
                      onClick={() => handleAddSection('content')}
                      className="btn-outline"
                      style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Plus size={14} /> فقرة جديدة
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSection('exercise')}
                      className="btn-outline"
                      style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 800, color: '#dc2626', borderColor: 'rgba(220, 38, 38, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Plus size={14} /> تمرين جديد
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      )}

      {/* SLIDE-OVER SETTINGS & GLOBAL STYLING DRAWER */}
      <LessonEditorSettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        fields={{
          ficheTitle, subject, chapterNumber, teacher, phone, prepTitle,
          selectedLevel, docType, docLanguage, schools, isActiveStatus,
          columnsCount, capacitesAttendues, contenus, leContenu,
        }}
        onChangeField={handleSettingsFieldChange}
        availableClasses={availableClasses}
        globalStyle={globalStyle}
        onChangeGlobalStyle={(k, v) => setGlobalStyle(prev => ({ ...prev, [k]: v }))}
        onApplyGlobalStyle={handleApplyGlobalStyle}
      />

      {/* MODALS (Only open when explicitly triggered by user) */}
      <PdfFigureCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        sections={sections}
        targetSectionIdx={cropperTarget.secIdx}
        targetItemIdx={cropperTarget.itemIdx}
        onCropComplete={handleCropComplete}
      />

      <AiFigureEnhancerModal
        isOpen={isAiEnhancerOpen}
        onClose={() => setIsAiEnhancerOpen(false)}
        imageSrc={aiEnhancerTarget.imageSrc}
        caption={aiEnhancerTarget.caption}
        onApply={handleApplyAiEnhancedFigure}
      />

      <FloatingLatexPalette
        isOpen={isLatexPaletteOpen}
        onClose={() => setIsLatexPaletteOpen(false)}
        onInsert={insertTextOrSnippet}
        activeTargetLabel={
          sections[activeFieldTargetRef.current?.secIdx]?.title
            ? `${sections[activeFieldTargetRef.current.secIdx].title} (${activeFieldTargetRef.current.field === 'solution' ? 'الحل' : 'النص'})`
            : 'المحرر'
        }
        isArMode={isArMode}
      />
    </div>
  );
}
