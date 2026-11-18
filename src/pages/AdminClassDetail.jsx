// src/pages/AdminClassDetail.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClassById, updateClass, removeCompetitionFromClass, updateCompetitionGrade } from '../services/classService';
import { getAllUsers, createUserDoc, updateUserDoc } from '../services/userService';
import { getActiveLessons } from '../services/lessonService';
import { getLogbookEntries } from '../services/logbookService';
import { getAllExams, getExamById, getExamQuestionsOnly } from '../services/examService';
import { generateBatchAnswerSheets } from '../utils/generateAnswerSheet';
import { exportToMassarCSV } from '../utils/massarBridge';
import ClassDiagnosticRemediationModal from '../components/ClassDiagnosticRemediationModal';
import { openStudentProgressPrintWindow } from '../utils/generateStudentProgressPDF';

import { 
  ArrowLeft, Users, FileSpreadsheet, CheckSquare, Plus, Trash2, 
  Sparkles, CheckCircle2, AlertTriangle, Search, ChevronRight, 
  TrendingUp, Activity, Award, UserPlus, Save, Check, X, Printer,
  BookOpenCheck, Edit3
} from 'lucide-react';

const SYSTEM_LEVELS = [
  { id: 'common_core_sci', label: 'Tronc Commun Scientifique' },
  { id: 'common_core_arts', label: 'Tronc Commun Littéraire' },
  { id: '1bac_sci', label: '1ère Bac Sciences Expérimentales' },
  { id: '1bac_arts', label: '1ère Bac Littéraire' },
  { id: '2bac_sm', label: '2ème Bac Sciences Mathématiques' },
  { id: '2bac_pc_svt', label: '2ème Bac Sciences Expérimentales (PC/SVT)' },
  { id: '2bac_arts', label: '2ème Bac Lettres & Sciences Humaines' }
];

import { normalizeLevel } from '../utils/levelHelpers';

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

export default function AdminClassDetail() {
  const isMobile = useIsMobile();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, refreshAdminData } = useAuth();

  // Guard: Must be admin
  if (user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const getLevelLabel = (lvlId) => {
    const found = SYSTEM_LEVELS.find(l => l.id === lvlId);
    return found ? found.label : (lvlId || 'Niveau indéterminé');
  };

  const goBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }
    navigate('/admin/classes');
  };

  // Component States
  const [classObj, setClassObj] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'students'); // 'students', 'homework', 'grades', 'program'
  
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && ['students', 'homework', 'grades', 'program', 'competitions'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  // Quick Grader (Numpad) States
  const [showQuickGrader, setShowQuickGrader] = useState(false);
  const [quickGraderControl, setQuickGraderControl] = useState('');
  const [quickGraderStudentIdx, setQuickGraderStudentIdx] = useState(0);
  const [quickGraderValue, setQuickGraderValue] = useState('');
  const [quickGraderAutoAdvance, setQuickGraderAutoAdvance] = useState(true);
  const [editingCompGrade, setEditingCompGrade] = useState(null); // { studentId, massar, comp, val }

  const handleSaveCompGrade = async (massar, comp, val) => {
    try {
      await updateCompetitionGrade(id, massar, comp, val);
      setClassObj(prev => {
        const compGrades = { ...(prev.competitionGrades || {}) };
        if (!compGrades[massar]) compGrades[massar] = {};
        compGrades[massar][comp] = val;
        return { ...prev, competitionGrades: compGrades };
      });
      setEditingCompGrade(null);
    } catch (err) {
      console.error('Error saving competition grade:', err);
    }
  };

  const handleRemoveCompetition = async (compName) => {
    if (window.confirm(`Voulez-vous vraiment retirer le concours "${compName}" de la classe ${classObj?.name} ?`)) {
      try {
        await removeCompetitionFromClass(id, compName);
        setClassObj(prev => ({
          ...prev,
          competitions: (prev.competitions || []).filter(c => c !== compName),
          controls: (prev.controls || []).filter(c => c !== compName)
        }));
      } catch (err) {
        console.error('Error removing competition:', err);
      }
    }
  };

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
  }, [students]);

  // ── Massar CSV Export ───────────────────────────────────────────
  const handleExportMassar = (cls) => {
    if (!cls) return;
    const studentList = cls.students || [];
    const compGradesObj = cls.competitionGrades || {};
    const compList = cls.competitions || [];

    let csvContent = "\uFEFFCode Massar;Nom & Prénom";
    compList.forEach(comp => {
      csvContent += `;${comp}`;
    });
    csvContent += "\n";

    studentList.forEach(st => {
      const massar = st.massarCode || st.cne || st.id || '';
      const name = st.name || st.fullName || 'Élève';
      let row = `"${massar}";"${name}"`;

      compList.forEach(comp => {
        const gradesForSt = compGradesObj[massar] || compGradesObj[massar.toUpperCase()] || compGradesObj[st.id] || {};
        const scoreStr = gradesForSt[comp] || '';
        row += `;"${scoreStr}"`;
      });
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Massar-Export-${(cls.name || 'Classe').replace(/\s+/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Diagnostic IA PDF Report ──────────────────────────────────
  const handleGenerateDiagnosticPDF = (cls) => {
    if (!cls) return;
    const studentList = cls.students || [];
    const compList = cls.competitions || [];
    const compGradesObj = cls.competitionGrades || {};

    let totalGradesCount = 0;
    let totalScoreSum = 0;

    studentList.forEach(st => {
      const massar = st.massarCode || st.cne || st.id || '';
      const stGrades = compGradesObj[massar] || compGradesObj[massar.toUpperCase()] || compGradesObj[st.id] || {};
      compList.forEach(comp => {
        const val = stGrades[comp];
        if (val) {
          const match = String(val).match(/([\d.]+)\/20/);
          if (match) {
            totalScoreSum += parseFloat(match[1]);
            totalGradesCount++;
          }
        }
      });
    });

    const avgScore = totalGradesCount > 0 ? (totalScoreSum / totalGradesCount).toFixed(2) : 'N/A';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Rapport Diagnostic Pédagogique - ${cls.name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #7c3aed; padding-bottom: 15px; margin-bottom: 25px; }
          .title { font-size: 24px; font-weight: 800; color: #1e1b4b; margin: 0; }
          .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; text-align: center; }
          .card-num { font-size: 28px; font-weight: 900; color: #7c3aed; }
          .card-label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { padding: 10px 14px; border: 1px solid #cbd5e1; text-align: left; font-size: 13px; }
          th { background: #f1f5f9; color: #0f172a; font-weight: 800; }
          .badge { padding: 4px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; background: rgba(16, 185, 129, 0.15); color: #059669; }
          .recommendations { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; border-radius: 8px; margin-top: 25px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">📊 Rapport Diagnostic IA & Analyse Pédagogique</h1>
            <div class="subtitle">Classe : <strong>${cls.name}</strong> · Niveau : ${cls.level || 'Secondaire'}</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            Généré le ${new Date().toLocaleDateString('fr-MA')}<br>L'CONQ IA Engine v2.0
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-num">${studentList.length}</div>
            <div class="card-label">Effectif Élèves</div>
          </div>
          <div class="card">
            <div class="card-num">${compList.length}</div>
            <div class="card-label">Concours Evalués</div>
          </div>
          <div class="card">
            <div class="card-num">${avgScore} / 20</div>
            <div class="card-label">Moyenne Générale du Groupe</div>
          </div>
        </div>

        <h3>📈 Bilan par Concours & Épreuves Scannées</h3>
        <table>
          <thead>
            <tr>
              <th>Nom de la Compétition / Examen</th>
              <th>Nombre d'évalués</th>
              <th>Taux de Participation</th>
              <th>Statut IA</th>
            </tr>
          </thead>
          <tbody>
            ${compList.map(comp => `
              <tr>
                <td><strong>${comp}</strong></td>
                <td>${studentList.length} élèves</td>
                <td>100%</td>
                <td><span class="badge">Validé OMR</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="recommendations">
          <h4 style="color: #065f46; margin: 0 0 8px;">💡 Recommandations Pédagogiques Automatismes IA :</h4>
          <p style="margin: 0; font-size: 13px; color: #047857; line-height: 1.6;">
            · Maintien de l'entraînement régulier sur les QCM chronométrés pour consolider la vitesse d'exécution.<br>
            · Organiser une séance de soutien ciblée sur les questions de limites complexes et équations différentielles.<br>
            · Continuer l'attribution automatique par QR Code pour un suivi individuel sans faille.
          </p>
        </div>

        <script>window.print();</script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ── Student Bulletins PDF ──────────────────────────────────────
  const handleGenerateStudentBulletinsPDF = (cls) => {
    if (!cls) return;
    const studentList = cls.students || [];
    const compList = cls.competitions || [];
    const compGradesObj = cls.competitionGrades || {};

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Bulletins Fichiers Élèves - ${cls.name}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; background: #fff; margin: 0; }
          .bulletin-page { page-break-after: always; padding: 20px; border: 2px solid #e2e8f0; border-radius: 16px; margin-bottom: 30px; position: relative; }
          .b-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7c3aed; padding-bottom: 15px; margin-bottom: 20px; }
          .b-title { font-size: 20px; font-weight: 900; color: #1e1b4b; margin: 0; }
          .b-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { padding: 10px 14px; border: 1px solid #cbd5e1; text-align: left; font-size: 13px; }
          th { background: #7c3aed; color: #ffffff; font-weight: 800; }
          .badge { padding: 4px 8px; border-radius: 6px; font-weight: 800; font-size: 12px; background: rgba(16, 185, 129, 0.15); color: #059669; }
          .footer { margin-top: 40px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        ${studentList.map((st, idx) => {
          const massar = st.massarCode || st.cne || st.id || '';
          const stGrades = compGradesObj[massar] || compGradesObj[massar.toUpperCase()] || compGradesObj[st.id] || {};
          return `
            <div class="bulletin-page">
              <div class="b-header">
                <div>
                  <h2 class="b-title">🎓 BULLETIN DE PERFORMANCE INDIVIDUEL</h2>
                  <div style="font-size: 12px; color: #64748b; margin-top: 3px;">Plateforme L'CONQ · Évaluation par Intelligence Artificielle</div>
                </div>
                <div style="text-align: right; font-weight: 800; color: #7c3aed; font-size: 14px;">
                  Année Scolaire 2025/2026
                </div>
              </div>

              <div class="b-info">
                <div><strong>Nom & Prénom :</strong> ${st.name || 'Élève'}</div>
                <div><strong>Code Massar :</strong> ${massar || 'N/A'}</div>
                <div><strong>Classe :</strong> ${cls.name}</div>
                <div><strong>Niveau :</strong> ${cls.level || 'Secondaire'}</div>
              </div>

              <h3>📝 Relevé des Notes aux Concours & QCM Scannés</h3>
              <table>
                <thead>
                  <tr>
                    <th>Intitulé du Concours</th>
                    <th>Note Obtenue</th>
                    <th>Appréciation / Validation</th>
                  </tr>
                </thead>
                <tbody>
                  ${compList.map(comp => {
                    const scoreVal = stGrades[comp] || 'Non composé';
                    return `
                      <tr>
                        <td><strong>${comp}</strong></td>
                        <td><span class="badge">${scoreVal}</span></td>
                        <td>${scoreVal !== 'Non composé' ? 'Épreuve Validée' : 'Absent(e)'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>

              <div class="footer">
                Ce bulletin est généré automatiquement par l'IA L'CONQ pour le suivi individuel de l'élève.<br>
                Signature & Cachet de l'Établissement
              </div>
            </div>
          `;
        }).join('')}

        <script>window.print();</script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Modals / Editing States
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ massarCode: '', name: '', dob: '' });
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [columnType, setColumnType] = useState('homework'); // 'homework' or 'grades'
  
  // Grade Editing Inline
  const [editingCell, setEditingCell] = useState(null); // { massarCode, controlName }
  const [editValue, setEditValue] = useState('');

  // OMR Batch Export Modal
  const [showOMRModal, setShowOMRModal] = useState(false);
  const [allExamsList, setAllExamsList] = useState([]);
  const [selectedExamForOMR, setSelectedExamForOMR] = useState(null);
  const [isGeneratingOMR, setIsGeneratingOMR] = useState(false);
  
  // Programme States
  const [lessons, setLessons] = useState([]);
  const [logbookEntries, setLogbookEntries] = useState([]);
  const [selectedProgramLessonId, setSelectedProgramLessonId] = useState('');
  const [customProgramTitle, setCustomProgramTitle] = useState('');


  const fetchData = async () => {
    setLoading(true);
    try {
      const cls = await getClassById(id, { forceRefresh: true });
      if (!cls) {
        setError("Cette classe n'existe pas.");
        return;
      }
      const allUsers = await getAllUsers();
      const userStudents = allUsers.filter(u => u.role === 'student' && (u.classId === id || u.class_id === id));
      const studentMap = new Map();

      // 1. Add students from class object
      (cls.students || []).forEach(st => {
        const key = (st.massarCode || st.id || '').toUpperCase();
        if (key) {
          studentMap.set(key, {
            id: st.id || st.massarCode,
            massarCode: st.massarCode || st.id,
            name: st.name || 'Élève',
            dob: st.dob || '01/01/2009',
            email: st.email || `${key.toLowerCase()}@lconq.ma`,
            classId: id,
            ...st
          });
        }
      });

      // 2. Merge with registered user profiles
      userStudents.forEach(u => {
        const key = (u.massarCode || u.id || '').toUpperCase();
        if (key) {
          const existing = studentMap.get(key) || {};
          studentMap.set(key, {
            ...existing,
            ...u,
            id: u.id || existing.id,
            massarCode: u.massarCode || existing.massarCode || u.id,
            name: u.name || existing.name,
            classId: id,
            dob: u.dob || existing.dob || '01/01/2009'
          });
        }
      });

      const mergedStudents = Array.from(studentMap.values());
      const updatedCls = {
        ...cls,
        students: mergedStudents,
        studentCount: mergedStudents.length
      };

      setClassObj(updatedCls);
      setStudents(mergedStudents);

      if ((cls.students?.length || 0) !== mergedStudents.length) {
        updateClass(id, { students: mergedStudents, studentCount: mergedStudents.length }).catch(() => {});
      }

      // Fetch all active lessons & exams
      const activeLessons = await getActiveLessons();
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
      setLessons([...(activeLessons || []), ...mappedExams]);
      // Fetch logbook entries for the class
      const entries = await getLogbookEntries(id);
      setLogbookEntries(entries);
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des détails de la classe.');
    } finally {
      setLoading(false);
    }
  };

  // Add item to Class Program
  const handleAddProgramItem = async (e) => {
    e.preventDefault();
    if (!selectedProgramLessonId && !customProgramTitle.trim()) {
      setError("Veuillez sélectionner un cours ou saisir un titre personnalisé.");
      return;
    }

    try {
      let newItem = null;
      if (selectedProgramLessonId) {
        const found = lessons.find(l => l.id === selectedProgramLessonId);
        if (found) {
          newItem = {
            id: 'prog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            type: found.docType || 'course',
            title: found.title,
            lessonId: found.id
          };
        }
      } else {
        newItem = {
          id: 'prog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          type: 'custom',
          title: customProgramTitle.trim(),
          lessonId: null
        };
      }

      if (newItem) {
        const previousProgram = classObj.program || [];
        const nextProgram = [...previousProgram, newItem];
        setClassObj(prev => ({ ...prev, program: nextProgram }));
        try {
          await updateClass(id, { program: nextProgram });
          setSelectedProgramLessonId('');
          setCustomProgramTitle('');
          setSuccess("Élément ajouté au programme et enregistré dans MySQL.");
          setTimeout(() => setSuccess(''), 3000);
        } catch (saveErr) {
          setClassObj(prev => ({ ...prev, program: previousProgram }));
          throw saveErr;
        }
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Erreur lors de l'ajout au programme dans la base de données.");
      setTimeout(() => setError(''), 5000);
    }
  };

  // Reorder program items (swap index)
  const handleMoveProgramItem = async (index, direction) => {
    const previousProgram = [...(classObj.program || [])];
    const nextProgram = [...previousProgram];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= nextProgram.length) return;

    // Swap
    const temp = nextProgram[index];
    nextProgram[index] = nextProgram[targetIdx];
    nextProgram[targetIdx] = temp;

    setClassObj(prev => ({ ...prev, program: nextProgram }));
    try {
      await updateClass(id, { program: nextProgram });
    } catch (err) {
      console.error(err);
      setClassObj(prev => ({ ...prev, program: previousProgram }));
      setError(err?.message || "Erreur de sauvegarde de l'ordre dans la base de données.");
      setTimeout(() => setError(''), 5000);
    }
  };

  // Remove program item
  const handleRemoveProgramItem = async (index) => {
    if (!window.confirm("Retirer cet élément du programme ?")) return;
    const previousProgram = [...(classObj.program || [])];
    const nextProgram = previousProgram.filter((_, idx) => idx !== index);

    setClassObj(prev => ({ ...prev, program: nextProgram }));
    try {
      await updateClass(id, { program: nextProgram });
      setSuccess("Élément retiré du programme et synchronisé avec MySQL.");
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setClassObj(prev => ({ ...prev, program: previousProgram }));
      setError(err?.message || "Erreur de sauvegarde de la suppression dans la base de données.");
      setTimeout(() => setError(''), 5000);
    }
  };

  // Calculate status of program item relative to logbook entries
  const getProgramItemStatus = (item) => {
    // Collect all covered section titles across all logbook entries
    const coveredSections = new Set();
    logbookEntries.forEach(entry => {
      if (entry.selectedSections && Array.isArray(entry.selectedSections)) {
        entry.selectedSections.forEach(s => coveredSections.add(s));
      }
    });

    if (item.type === 'custom') {
      // Check if custom text is present in logbook entries
      const isLogged = logbookEntries.some(e => 
        (e.customContent && e.customContent.includes(item.title)) ||
        (e.component === 'Contrôle' && item.title.toUpperCase().includes('CONTRÔLE'))
      );
      return isLogged 
        ? { label: 'Terminé', color: 'var(--emerald)', bg: 'rgba(16, 185, 129, 0.08)' } 
        : { label: 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };
    }

    if (item.lessonId) {
      const lesson = lessons.find(l => l.id === item.lessonId);
      if (!lesson) return { label: 'N/A', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };
      const sections = lesson.content?.sections || [];
      if (sections.length === 0) return { label: 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };

      const completedCount = sections.filter(sec => coveredSections.has(sec.title)).length;
      if (completedCount === sections.length) {
        return { label: 'Terminé', color: 'var(--emerald)', bg: 'rgba(16, 185, 129, 0.08)' };
      } else if (completedCount > 0) {
        return { label: `En cours (${completedCount}/${sections.length})`, color: 'var(--violet)', bg: 'var(--violet-soft)' };
      } else {
        return { label: 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };
      }
    }

    return { label: 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };
  };


  useEffect(() => {
    fetchData();
  }, [id]);

  const saveQuickGradeAndGoNext = async (gradeValStr) => {
    if (!quickGraderControl) return;
    const currentStudent = sortedStudents[quickGraderStudentIdx];
    if (!currentStudent) return;

    let parsed = null;
    if (gradeValStr !== 'ABS' && gradeValStr !== '' && gradeValStr !== null) {
      parsed = parseFloat(String(gradeValStr).replace(',', '.'));
      if (isNaN(parsed) || parsed < 0 || parsed > 20) {
        return;
      }
    }

    try {
      const gradesData = { ...(classObj.grades || {}) };
      if (!gradesData[currentStudent.id]) {
        gradesData[currentStudent.id] = {};
      }
      gradesData[currentStudent.id][quickGraderControl] = parsed;

      setClassObj(prev => ({
        ...prev,
        grades: gradesData
      }));

      await updateClass(id, { grades: gradesData });

      if (quickGraderStudentIdx < sortedStudents.length - 1) {
        const nextIdx = quickGraderStudentIdx + 1;
        setQuickGraderStudentIdx(nextIdx);
        const nextStudent = sortedStudents[nextIdx];
        const existingGrade = classObj.grades?.[nextStudent.id]?.[quickGraderControl];
        setQuickGraderValue(existingGrade !== null && existingGrade !== undefined ? String(existingGrade) : '');
      } else {
        setSuccess("Saisie des notes terminée pour cette classe !");
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la sauvegarde de la note.");
    }
  };

  const handleQuickGraderPrev = () => {
    if (quickGraderStudentIdx > 0) {
      const prevIdx = quickGraderStudentIdx - 1;
      setQuickGraderStudentIdx(prevIdx);
      const prevStudent = sortedStudents[prevIdx];
      const existingGrade = classObj.grades?.[prevStudent.id]?.[quickGraderControl];
      setQuickGraderValue(existingGrade !== null && existingGrade !== undefined ? String(existingGrade) : '');
    }
  };

  const handleQuickGraderNext = () => {
    if (quickGraderStudentIdx < sortedStudents.length - 1) {
      const nextIdx = quickGraderStudentIdx + 1;
      setQuickGraderStudentIdx(nextIdx);
      const nextStudent = sortedStudents[nextIdx];
      const existingGrade = classObj.grades?.[nextStudent.id]?.[quickGraderControl];
      setQuickGraderValue(existingGrade !== null && existingGrade !== undefined ? String(existingGrade) : '');
    }
  };

  const handleQuickSaveCurrent = () => {
    saveQuickGradeAndGoNext(quickGraderValue);
  };

  const handleQuickSaveAndClose = async () => {
    if (!quickGraderControl) {
      setShowQuickGrader(false);
      return;
    }
    const currentStudent = sortedStudents[quickGraderStudentIdx];
    if (!currentStudent) {
      setShowQuickGrader(false);
      return;
    }

    let parsed = null;
    if (quickGraderValue !== 'ABS' && quickGraderValue !== '' && quickGraderValue !== null) {
      parsed = parseFloat(String(quickGraderValue).replace(',', '.'));
      if (isNaN(parsed) || parsed < 0 || parsed > 20) {
        alert("La note doit être un nombre valide entre 0 et 20.");
        return;
      }
    }

    try {
      const gradesData = { ...(classObj.grades || {}) };
      if (!gradesData[currentStudent.id]) {
        gradesData[currentStudent.id] = {};
      }
      gradesData[currentStudent.id][quickGraderControl] = parsed;

      setClassObj(prev => ({
        ...prev,
        grades: gradesData
      }));

      await updateClass(id, { grades: gradesData });
      setShowQuickGrader(false);
      setSuccess("Notes enregistrées avec succès !");
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la sauvegarde de la note.");
    }
  };

  const handleNumpadInput = (val) => {
    if (val === 'C') {
      setQuickGraderValue('');
    } else if (val === '⌫') {
      setQuickGraderValue(prev => prev.length > 0 ? prev.slice(0, -1) : '');
    } else if (val === '.00' || val === '.25' || val === '.50' || val === '.75') {
      const integerPart = quickGraderValue.split('.')[0] || '0';
      if (integerPart === '20' && val !== '.00') {
        return;
      }
      const newVal = val === '.00' ? integerPart : integerPart + val;
      setQuickGraderValue(newVal);
      if (quickGraderAutoAdvance) {
        saveQuickGradeAndGoNext(newVal);
      }
    } else if (val === '.') {
      if (!quickGraderValue.includes('.')) {
        setQuickGraderValue(prev => (prev || '0') + '.');
      }
    } else {
      setQuickGraderValue(prev => {
        if (prev === 'ABS') return val;
        
        if (prev.includes('.')) {
          const parts = prev.split('.');
          if (parts[1].length < 2) {
            return prev + val;
          }
          return prev;
        } else {
          const newVal = (prev === '0' || prev === '') ? val : prev + val;
          const parsedInt = parseInt(newVal);
          if (parsedInt > 20) {
            return prev;
          }
          return newVal;
        }
      });
    }
  };

  useEffect(() => {
    if (!showQuickGrader) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
        return;
      }
      
      const key = e.key;

      if (key >= '0' && key <= '9') {
        e.preventDefault();
        handleNumpadInput(key);
      } else if (key === '.' || key === ',') {
        e.preventDefault();
        handleNumpadInput('.');
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleNumpadInput('⌫');
      } else if (key === 'Escape') {
        e.preventDefault();
        setShowQuickGrader(false);
      } else if (key === 'Enter') {
        e.preventDefault();
        handleQuickSaveCurrent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQuickGrader, quickGraderValue, quickGraderStudentIdx, quickGraderControl, sortedStudents, quickGraderAutoAdvance]);

  // Add student manually
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.massarCode || !newStudent.name) {
      setError('Veuillez remplir le code Massar et le nom.');
      return;
    }
    setLoading(true);
    try {
      const dobStr = newStudent.dob || '01/01/2009';
      const cleanPassword = dobStr.replace(/\//g, '');
      const studentEmail = `${newStudent.massarCode.toLowerCase()}@lconq.ma`;

      const studentData = {
        name: newStudent.name,
        email: studentEmail,
        role: 'student',
        tier: 'premium',
        xp: 0,
        school: 'Lycée Qualifiant 18 Novembre',
        classId: id,
        className: classObj?.name || id,
        massarCode: newStudent.massarCode,
        dob: dobStr,
        crm: { 
          stage: 'Lead', 
          notes: [`Ajouté manuellement à la classe ${id}. Date de Naissance : ${dobStr}`], 
          reminders: [], 
          interactions: [] 
        }
      };

      await createUserDoc(newStudent.massarCode, studentData);

      const studentObj = {
        id: newStudent.massarCode,
        massarCode: newStudent.massarCode,
        name: newStudent.name,
        dob: dobStr,
        email: studentEmail,
        classId: id
      };

      const currentStudents = Array.isArray(classObj?.students) ? [...classObj.students] : [];
      const updatedStudents = currentStudents.filter(s => 
        s.id !== newStudent.massarCode && s.massarCode !== newStudent.massarCode
      );
      updatedStudents.push(studentObj);

      await updateClass(id, {
        students: updatedStudents,
        studentCount: updatedStudents.length
      });

      setClassObj(prev => ({
        ...prev,
        students: updatedStudents,
        studentCount: updatedStudents.length
      }));
      setStudents(updatedStudents);

      setSuccess(`L'élève ${newStudent.name} a été ajouté.`);
      setNewStudent({ massarCode: '', name: '', dob: '' });
      setShowAddStudent(false);
      await refreshAdminData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'ajout de l'élève.");
    } finally {
      setLoading(false);
    }
  };

  // Remove student from class
  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir retirer cet élève de la classe ?")) return;
    setLoading(true);
    try {
      const currentStudents = Array.isArray(classObj?.students) ? [...classObj.students] : [];
      const updatedStudents = currentStudents.filter(s => 
        s.id !== studentId && s.massarCode !== studentId
      );

      await updateUserDoc(studentId, { classId: null, class_id: null });
      await updateClass(id, {
        students: updatedStudents,
        studentCount: updatedStudents.length
      });

      setClassObj(prev => ({
        ...prev,
        students: updatedStudents,
        studentCount: updatedStudents.length
      }));
      setStudents(updatedStudents);

      setSuccess("L'élève a été retiré de la classe.");
      await refreshAdminData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors du retrait de l'élève.");
    } finally {
      setLoading(false);
    }
  };

  // Add Homework or Control Column
  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    setLoading(true);
    try {
      const colName = newColumnName.trim();
      if (columnType === 'homework') {
        const homeworkData = classObj.homework || {};
        // Initialize for all students
        students.forEach(s => {
          if (!homeworkData[s.id]) homeworkData[s.id] = {};
          homeworkData[s.id][colName] = false;
        });
        await updateClass(id, { homework: homeworkData });
      } else {
        const controlsList = [...(classObj.controls || [])];
        if (controlsList.includes(colName)) {
          setError("Ce contrôle existe déjà.");
          setLoading(false);
          return;
        }
        controlsList.push(colName);
        const gradesData = classObj.grades || {};
        students.forEach(s => {
          if (!gradesData[s.id]) gradesData[s.id] = {};
          gradesData[s.id][colName] = null;
        });
        await updateClass(id, { 
          controls: controlsList,
          grades: gradesData
        });
      }

      setSuccess(`Colonne "${colName}" ajoutée.`);
      setNewColumnName('');
      setShowAddColumn(false);
      await fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'ajout de la colonne.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Homework checkmark
  const handleToggleHomework = async (studentId, hwName) => {
    try {
      const homeworkData = { ...(classObj.homework || {}) };
      if (!homeworkData[studentId]) homeworkData[studentId] = {};
      homeworkData[studentId][hwName] = !homeworkData[studentId][hwName];
      
      // Optimistic state update
      setClassObj(prev => ({
        ...prev,
        homework: homeworkData
      }));

      await updateClass(id, { homework: homeworkData });
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la modification du devoir.");
    }
  };

  // Enter edit mode for cell
  const startEditCell = (massarCode, controlName, currentVal) => {
    setEditingCell({ massarCode, controlName });
    setEditValue(currentVal !== null && currentVal !== undefined ? String(currentVal) : '');
  };

  // Save grade value
  const handleSaveGrade = async () => {
    if (!editingCell) return;
    const { massarCode, controlName } = editingCell;
    const parsed = editValue.trim() === '' ? null : parseFloat(editValue.replace(',', '.'));
    
    if (parsed !== null && (isNaN(parsed) || parsed < 0 || parsed > 20)) {
      alert("La note doit être un nombre valide entre 0 et 20.");
      return;
    }

    try {
      const gradesData = { ...(classObj.grades || {}) };
      if (!gradesData[massarCode]) gradesData[massarCode] = {};
      gradesData[massarCode][controlName] = parsed;

      // Optimistic update
      setClassObj(prev => ({
        ...prev,
        grades: gradesData
      }));

      setEditingCell(null);
      await updateClass(id, { grades: gradesData });
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la sauvegarde de la note.");
    }
  };

  // Calculate statistics for each Control Column
  const controlStats = useMemo(() => {
    if (!classObj || !classObj.controls || students.length === 0) return {};
    
    const stats = {};
    classObj.controls.forEach(col => {
      const gradesList = students
        .map(s => {
          const sGrades = classObj.grades?.[s.id] || classObj.grades?.[s.massarCode] || {};
          return sGrades[col];
        })
        .filter(g => g !== null && g !== undefined && !isNaN(g));

      if (gradesList.length > 0) {
        const sum = gradesList.reduce((acc, curr) => acc + curr, 0);
        const avg = sum / gradesList.length;
        const min = Math.min(...gradesList);
        const max = Math.max(...gradesList);
        stats[col] = {
          avg: parseFloat(avg.toFixed(2)),
          min: parseFloat(min.toFixed(2)),
          max: parseFloat(max.toFixed(2)),
          count: gradesList.length
        };
      } else {
        stats[col] = { avg: '-', min: '-', max: '-', count: 0 };
      }
    });
    return stats;
  }, [classObj, students]);

  // Filter students by search term
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const nameMatch = s.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const massarMatch = s.massarCode?.toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || massarMatch;
    });
  }, [students, searchTerm]);

  // Get homework list from students' homework data
  const homeworkList = useMemo(() => {
    if (!classObj || !classObj.homework) return [];
    const keys = new Set();
    Object.values(classObj.homework).forEach(hwObj => {
      if (hwObj) {
        Object.keys(hwObj).forEach(k => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [classObj]);

  // Guard role
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Print generation handler
  const handlePrint = (printType) => {
    let printHTML = '';
    const schoolYear = '2025/2026';
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const levelLabel = SYSTEM_LEVELS.find(lvl => lvl.id === classObj.level)?.label || classObj.level;

    // Header styling
    const htmlHeader = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Impression - ${classObj.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          
          @page {
            size: A4 portrait;
            margin: 0.5cm 0.7cm;
          }
          
          body { 
            font-family: 'Inter', sans-serif; 
            color: #0f172a; 
            background: #fff; 
            margin: 0; 
            padding: 0;
            font-size: 11px; 
            line-height: 1.3; 
          }
          
          .print-header-modern {
            margin-bottom: 14px;
          }
          
          .header-top-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
          }
          
          .logo-text {
            font-size: 18px;
            font-weight: 800;
            letter-spacing: -0.04em;
            color: #4f46e5;
          }
          
          .year-badge {
            font-size: 10px;
            font-weight: 800;
            background: #4f46e5;
            color: #ffffff;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 6px;
            display: inline-block;
            vertical-align: middle;
          }
          
          .sub-text {
            font-size: 10px;
            color: #475569;
            margin-top: 2px;
            font-weight: 500;
          }
          
          .header-right {
            text-align: right;
          }
          
          .header-right strong {
            font-size: 12px;
            color: #0f172a;
          }
          
          .gradient-bar {
            height: 3px;
            background-color: #4f46e5;
            border-radius: 2px;
            margin-top: 4px;
          }

          .print-title-card {
            text-align: center;
            margin: 12px 0;
            padding: 8px 12px;
            background: #f8fafc;
            border: 2px solid #0f172a;
            border-radius: 6px;
          }
          
          .print-title {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.05em;
            margin: 0;
            text-transform: uppercase;
          }
          
          .print-meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin: 10px 0 14px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 12px;
          }
          
          .meta-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          
          .meta-label {
            font-size: 8px;
            font-weight: 800;
            color: #64748b;
            letter-spacing: 0.06em;
            margin-bottom: 2px;
          }
          
          .meta-value {
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
          }
          
          .print-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 8px; 
            font-size: 10px;
          }
          
          .print-table th { 
            background-color: #f1f5f9; 
            color: #0f172a;
            font-weight: 800; 
            text-transform: uppercase;
            font-size: 9px; 
            letter-spacing: 0.04em;
            border: 1.5px solid #0f172a; 
            padding: 5px 6px; 
            text-align: left;
          }
          
          .print-table td { 
            border: 1px solid #cbd5e1; 
            padding: 4px 6px; 
            color: #0f172a;
            line-height: 1.15;
          }
          
          .print-table tr:nth-child(even) {
            background-color: #f8fafc;
          }
          
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          
          .print-signature {
            margin-top: 15px;
            display: flex;
            justify-content: flex-end;
          }
          
          .signature-card {
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            padding: 8px 15px;
            width: 200px;
            text-align: center;
            font-size: 9.5px;
            font-weight: 700;
            color: #475569;
          }
          
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="print-header-modern">
          <div class="header-top-row">
            <div class="header-left">
              <span class="logo-text">L'CONQ</span> <span class="year-badge">2026</span>
              <div class="sub-text">Plateforme de Suivi Pédagogique</div>
            </div>
            <div class="header-right" style="text-align: right;">
              <strong>Lycée Qualifiant 18 Novembre</strong>
              <div class="sub-text">Année Scolaire : 2025/2026</div>
            </div>
          </div>
          <div class="gradient-bar"></div>
        </div>
    `;

    const teacherName = user?.name || 'Enseignant';

    const htmlFooter = `
        <div class="print-signature">
          <div class="signature-card">
            Signature de l'Enseignant<br/>
            <span style="font-weight: 800; font-size: 11px; color: #0f172a; display: block; margin-top: 5px;">${teacherName}</span>
          </div>
        </div>
      </body>
      </html>
    `;

    if (printType === 'list') {
      printHTML += htmlHeader;
      printHTML += `
        <div class="print-title-card">
          <h2 class="print-title">Liste Officielle des Élèves</h2>
        </div>
        <div class="print-meta-grid">
          <div class="meta-item">
            <span class="meta-label">CLASSE</span>
            <span class="meta-value">${classObj.name}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">NIVEAU</span>
            <span class="meta-value">${levelLabel}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">EFFECTIF</span>
            <span class="meta-value">${students.length} Élèves</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">DATE D'ÉDITION</span>
            <span class="meta-value">${dateStr}</span>
          </div>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 5%;" class="text-center">N°</th>
              <th style="width: 25%;">Code Massar</th>
              <th style="width: 40%;">Nom & Prénom</th>
              <th style="width: 15%;" class="text-center">Né(e) le</th>
              <th style="width: 15%;" class="text-center">Émargement</th>
            </tr>
          </thead>
          <tbody>
      `;
      students.forEach((s, idx) => {
        const dob = s.crm?.notes?.[0]?.split('Naissance : ')[1] || '01/01/2009';
        printHTML += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${s.massarCode || s.id}</strong></td>
            <td>${s.name}</td>
            <td class="text-center">${dob}</td>
            <td></td>
          </tr>
        `;
      });
      printHTML += `
          </tbody>
        </table>
      `;
      printHTML += htmlFooter;
    } else if (printType === 'homework') {
      printHTML += htmlHeader;
      printHTML += `
        <div class="print-title-card">
          <h2 class="print-title">Fiche de Suivi des Devoirs de Maison</h2>
        </div>
        <div class="print-meta-grid">
          <div class="meta-item">
            <span class="meta-label">CLASSE</span>
            <span class="meta-value">${classObj.name}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">NIVEAU</span>
            <span class="meta-value">${levelLabel}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">MATIÈRE</span>
            <span class="meta-value">Physique-Chimie</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">DATE DE SUIVI</span>
            <span class="meta-value">${dateStr}</span>
          </div>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 5%;" class="text-center">N°</th>
              <th style="width: 30%;">Nom & Prénom</th>
      `;
      homeworkList.forEach(hw => {
        printHTML += `<th class="text-center">${hw}</th>`;
      });
      printHTML += `
              <th style="width: 25%;">Observations</th>
            </tr>
          </thead>
          <tbody>
      `;
      students.forEach((s, idx) => {
        printHTML += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${s.name}</strong></td>
        `;
        homeworkList.forEach(hw => {
          const isDone = classObj.homework?.[s.id]?.[hw] || false;
          printHTML += `<td class="text-center" style="font-weight: bold; font-size: 11px;">${isDone ? '✓' : '☐'}</td>`;
        });
        printHTML += `
            <td></td>
          </tr>
        `;
      });
      printHTML += `
          </tbody>
        </table>
      `;
      printHTML += htmlFooter;
    } else if (printType === 'grades') {
      printHTML += htmlHeader;
      printHTML += `
        <div class="print-title-card">
          <h2 class="print-title">Bulletin de Notes des Contrôles Continus</h2>
        </div>
        <div class="print-meta-grid">
          <div class="meta-item">
            <span class="meta-label">CLASSE</span>
            <span class="meta-value">${classObj.name}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">NIVEAU</span>
            <span class="meta-value">${levelLabel}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">MATIÈRE</span>
            <span class="meta-value">Physique-Chimie</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">MISE À JOUR</span>
            <span class="meta-value">${dateStr}</span>
          </div>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 5%;" class="text-center">N°</th>
              <th style="width: 35%;">Nom & Prénom</th>
      `;
      (classObj.controls || []).forEach(col => {
        printHTML += `<th class="text-center">${col}</th>`;
      });
      printHTML += `
              <th class="text-center" style="width: 15%;">Moyenne</th>
            </tr>
          </thead>
          <tbody>
      `;
      students.forEach((s, idx) => {
        printHTML += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${s.name}</strong></td>
        `;
        let sum = 0;
        let count = 0;
        (classObj.controls || []).forEach(col => {
          const studentKey = s.id?.toUpperCase();
          const emailPrefix = s.email?.split('@')[0]?.toUpperCase();
          const studentGrades = classObj.grades?.[s.id] || 
                                classObj.grades?.[studentKey] || 
                                classObj.grades?.[emailPrefix] || 
                                {};
          const grade = studentGrades[col];
          const hasGrade = grade !== null && grade !== undefined && !isNaN(grade);
          printHTML += `<td class="text-center">${hasGrade ? grade : '-'}</td>`;
          if (hasGrade) {
            sum += grade;
            count++;
          }
        });
        const avg = count > 0 ? (sum / count).toFixed(2) : '-';
        printHTML += `<td class="text-center" style="font-weight: bold; background-color: #f8fafc;">${avg}</td>`;
        printHTML += `</tr>`;
      });

      // Stats row
      printHTML += `
        <tr style="background-color: #f1f5f9; font-weight: 700;">
          <td colspan="2" class="text-right">Moyenne de Classe :</td>
      `;
      (classObj.controls || []).forEach(col => {
        const stat = controlStats[col];
        printHTML += `<td class="text-center" style="color: #4f46e5;">${stat?.avg !== '-' ? stat?.avg : '-'}</td>`;
      });
      printHTML += `
          <td style="background-color: #e2e8f0;"></td>
        </tr>
        <tr style="background-color: #f8fafc; font-size: 8px; color: #475569; font-weight: 600;">
          <td colspan="2" class="text-right">Note Min / Max :</td>
      `;
      (classObj.controls || []).forEach(col => {
        const stat = controlStats[col];
        printHTML += `<td class="text-center">${stat?.min !== '-' ? `${stat?.min} / ${stat?.max}` : '-'}</td>`;
      });
      printHTML += `
          <td></td>
        </tr>
      `;

      printHTML += `
          </tbody>
        </table>
      `;
      printHTML += htmlFooter;
    }

    try {
      localStorage.setItem('print_html', printHTML);
      window.open('/print', '_blank');
    } catch (err) {
      console.error('Printing error:', err);
      alert('Impossible d\'ouvrir la page d\'impression.');
    }
  };

  if (loading && !classObj) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.1)', borderTop: '3px solid var(--violet)', animation: 'spinDetail 1s linear infinite', marginBottom: '1rem' }} />
        <p>Chargement des informations de la section...</p>
        <style>{`@keyframes spinDetail { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem', position: 'relative' }}>
      
      {/* Back button */}
      <button 
        onClick={goBack} 
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          background: 'none', border: 'none', color: 'var(--text-muted)',
          fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', marginBottom: '1.5rem',
          transition: 'color 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--violet)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <ArrowLeft size={16} /> Retour aux classes
      </button>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
            <span style={{ 
              background: 'linear-gradient(135deg, var(--violet), var(--emerald))', 
              color: 'white', fontWeight: 900, fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '6px' 
            }}>
              SECTION
            </span>
            <span style={{ 
              background: classObj.language === 'ar' ? 'var(--warning)' : 'var(--violet)', 
              color: 'white', fontWeight: 900, fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '6px' 
            }}>
              {classObj.language === 'ar' ? 'Option Arabe' : 'Option Français (BIOF)'}
            </span>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{classObj.name}</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            Niveau : <strong>{SYSTEM_LEVELS.find(lvl => lvl.id === classObj.level)?.label || classObj.level}</strong> 
            • Effectif : <strong>{students.length} élèves</strong>
            • Langue : 
            <select
              value={classObj.language || 'fr'}
              onChange={async (e) => {
                const newLang = e.target.value;
                try {
                  setClassObj(prev => ({ ...prev, language: newLang }));
                  await updateClass(id, { language: newLang });
                  setSuccess("La langue de la classe a été mise à jour.");
                  setTimeout(() => setSuccess(''), 3000);
                } catch (err) {
                  console.error(err);
                  setError("Impossible de modifier la langue de la classe.");
                  setTimeout(() => setError(''), 3000);
                }
              }}
              className="input-control"
              style={{
                display: 'inline-block',
                width: 'auto',
                padding: '0.15rem 1.75rem 0.15rem 0.5rem',
                fontSize: '0.8rem',
                height: 'auto',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-glass)',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="fr">Option Français (BIOF)</option>
              <option value="ar">Option Arabe</option>
            </select>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          {activeTab === 'students' && (
            <>
              <button 
                onClick={async () => {
                  setShowOMRModal(true);
                  if (allExamsList.length === 0) {
                    const ex = await getAllExams();
                    setAllExamsList(ex);
                  }
                }}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px',
                  borderColor: 'var(--violet)', color: 'var(--violet)', fontWeight: 700
                }}
              >
                <FileSpreadsheet size={15} /> Grilles de réponses OMR
              </button>
              <button 
                onClick={() => handlePrint('list')}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px'
                }}
              >
                <Printer size={15} /> Imprimer la Liste
              </button>
              <button 
                onClick={() => {
                  try {
                    exportToMassarCSV(students, [], classObj?.name || 'Classe');
                  } catch (err) {
                    alert(err.message);
                  }
                }}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px',
                  borderColor: 'rgba(16,185,129,0.4)', color: '#10B981', fontWeight: 700
                }}
                title="Exporter fichier Massar Excel/CSV"
              >
                <FileSpreadsheet size={15} /> Exporter Massar (CSV)
              </button>
              <button 
                onClick={() => {
                  openStudentProgressPrintWindow(students, classObj, {
                    teacher: user?.name || 'Professeur de Mathématiques',
                    school: 'Lycée Qualifiant 18 Novembre',
                    subject: 'Mathématiques'
                  });
                }}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px',
                  borderColor: '#0284c7', color: '#0284c7', fontWeight: 700
                }}
                title="Imprimer les bilans de progression individuels pour tous les élèves de la classe (PDF)"
              >
                <Printer size={15} /> Bilans Individuels (PDF)
              </button>
              <button 
                onClick={() => setShowAddStudent(true)}
                className="btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--violet), var(--emerald))', border: 'none'
                }}
              >
                <UserPlus size={16} /> Ajouter un élève
              </button>
            </>
          )}

          {activeTab === 'homework' && (
            <>
              <button 
                onClick={() => handlePrint('homework')}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px'
                }}
              >
                <Printer size={15} /> Imprimer Suivi Devoirs
              </button>
              <button 
                onClick={() => {
                  setColumnType('homework');
                  setShowAddColumn(true);
                }}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px'
                }}
              >
                <Plus size={16} /> Ajouter un devoir
              </button>
            </>
          )}

          {activeTab === 'grades' && (
            <>
              <button 
                onClick={() => setShowDiagnosticModal(true)}
                className="btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)', border: 'none',
                  color: '#fff', fontWeight: 800,
                  boxShadow: '0 4px 14px rgba(67, 56, 202, 0.35)'
                }}
                title="Analyse diagnostique des résultats et génération des fiches de soutien et remédiation"
              >
                <Sparkles size={15} /> Diagnostic & Soutien (IA)
              </button>
              <button 
                onClick={() => {
                  openStudentProgressPrintWindow(students, classObj, {
                    teacher: user?.name || 'Professeur de Mathématiques',
                    school: 'Lycée Qualifiant 18 Novembre',
                    subject: 'Mathématiques'
                  });
                }}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px',
                  borderColor: '#0284c7', color: '#0284c7', fontWeight: 700
                }}
                title="Imprimer les bilans de progression individuels pour tous les élèves de la classe (PDF)"
              >
                <Printer size={15} /> Bilans Individuels (PDF)
              </button>
              <button 
                onClick={() => handlePrint('grades')}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px'
                }}
              >
                <Printer size={15} /> Imprimer les Notes
              </button>
              <button 
                onClick={() => {
                  setColumnType('grades');
                  setShowAddColumn(true);
                }}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px'
                }}
              >
                <Plus size={16} /> Ajouter un contrôle
              </button>
              <button 
                onClick={() => {
                  setShowQuickGrader(true);
                  if (classObj.controls && classObj.controls.length > 0) {
                    const firstCtrl = classObj.controls[0];
                    setQuickGraderControl(firstCtrl);
                    setQuickGraderStudentIdx(0);
                    const firstStudent = sortedStudents[0];
                    const existingGrade = firstStudent ? (classObj.grades?.[firstStudent.id]?.[firstCtrl]) : '';
                    setQuickGraderValue(existingGrade !== null && existingGrade !== undefined ? String(existingGrade) : '');
                  } else {
                    setQuickGraderControl('');
                  }
                }}
                className="btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--violet), var(--emerald))', border: 'none',
                  color: '#fff', fontWeight: 800
                }}
              >
                <Sparkles size={15} /> Saisie Rapide (Numpad)
              </button>
            </>
          )}
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '1rem', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={20} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}
      {success && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)', borderRadius: '12px', padding: '1rem', color: 'var(--emerald)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle2 size={20} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{success}</p>
        </div>
      )}

      {/* Tabs list */}
      <div className="mobile-tabs-scroll" style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '2rem', gap: '1.5rem', overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setActiveTab('students')}
          style={{
            background: 'none', border: 'none', padding: '0.75rem 0.25rem',
            color: activeTab === 'students' ? 'var(--violet)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
            borderBottom: activeTab === 'students' ? '2.5px solid var(--violet)' : 'none',
            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s',
            flexShrink: 0
          }}
        >
          <Users size={16} /> Liste des Élèves
        </button>

        <button
          onClick={() => setActiveTab('homework')}
          style={{
            background: 'none', border: 'none', padding: '0.75rem 0.25rem',
            color: activeTab === 'homework' ? 'var(--violet)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
            borderBottom: activeTab === 'homework' ? '2.5px solid var(--violet)' : 'none',
            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s',
            flexShrink: 0
          }}
        >
          <CheckSquare size={16} /> Suivi des Devoirs
        </button>

        <button
          onClick={() => setActiveTab('grades')}
          style={{
            background: 'none', border: 'none', padding: '0.75rem 0.25rem',
            color: activeTab === 'grades' ? 'var(--violet)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
            borderBottom: activeTab === 'grades' ? '2.5px solid var(--violet)' : 'none',
            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s',
            flexShrink: 0
          }}
        >
          <FileSpreadsheet size={16} /> Notes des Contrôles
        </button>

        <button
          onClick={() => setActiveTab('program')}
          style={{
            background: 'none', border: 'none', padding: '0.75rem 0.25rem',
            color: activeTab === 'program' ? 'var(--violet)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
            borderBottom: activeTab === 'program' ? '2.5px solid var(--violet)' : 'none',
            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s',
            flexShrink: 0
          }}
        >
          <Activity size={16} /> Programme
        </button>

        <button
          onClick={() => setActiveTab('competitions')}
          style={{
            background: 'none', border: 'none', padding: '0.75rem 0.25rem',
            color: activeTab === 'competitions' ? 'var(--violet)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
            borderBottom: activeTab === 'competitions' ? '2.5px solid var(--violet)' : 'none',
            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s',
            flexShrink: 0
          }}
        >
          <Award size={16} /> Carnet des Concours (OMR)
        </button>
      </div>

      {/* Search Input for active tab */}
      {['students', 'homework', 'grades', 'competitions'].includes(activeTab) && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
            <Search size={17} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Rechercher par nom ou code Massar..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', padding: '0.65rem 1rem 0.65rem 2.8rem', background: 'var(--bg-glass)', 
                border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-main)', outline: 'none',
                fontSize: '0.85rem'
              }}
            />
          </div>
        </div>
      )}

      {/* Tab 1: Students list */}
      {activeTab === 'students' && (
        <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Élève</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Code Massar</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date Naissance</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Identifiants par défaut</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Users size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Aucun élève trouvé.</p>
                    </td>
                  </tr>
                ) : filteredStudents.map(s => {
                  const plainPass = s.joined ? '••••••••' : (s.crm?.notes?.[0]?.split('Naissance : ')[1]?.replace(/\//g, '') || '31052009');
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ 
                            width: '32px', height: '32px', borderRadius: '50%', 
                            background: 'linear-gradient(45deg, var(--violet), var(--emerald))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white', fontSize: '0.82rem'
                          }}>
                            {s.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                        {s.massarCode || s.id}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {s.crm?.notes?.[0]?.split('Naissance : ')[1] || '01/01/2009'}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div>Email: <code style={{ color: 'var(--emerald)' }}>{s.email}</code></div>
                          <div>Pass: <code style={{ color: 'var(--violet)' }}>{plainPass}</code></div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleRemoveStudent(s.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger-hover)', cursor: 'pointer', padding: '0.25rem' }}
                          title="Retirer de la classe"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Homework Tracker */}
      {activeTab === 'homework' && (
        <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ borderCollapse: 'collapse', textAlign: 'left', minWidth: '100%' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: '220px', sticky: 'left', background: 'var(--bg-card)' }}>Élève</th>
                  {homeworkList.map((hw, idx) => (
                    <th key={idx} style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center', minWidth: '130px' }}>
                      {hw}
                    </th>
                  ))}
                  {homeworkList.length === 0 && (
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Aucun devoir enregistré</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={homeworkList.length + 1} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <CheckSquare size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Aucun élève trouvé.</p>
                    </td>
                  </tr>
                ) : filteredStudents.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem', sticky: 'left', background: 'var(--bg-card)' }}>
                      {s.name}
                    </td>
                    {homeworkList.map((hw, idx) => {
                      const isChecked = classObj.homework?.[s.id]?.[hw] || false;
                      return (
                        <td key={idx} style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleHomework(s.id, hw)}
                            style={{ 
                              width: '18px', height: '18px', cursor: 'pointer',
                              accentColor: 'var(--violet)'
                            }}
                          />
                        </td>
                      );
                    })}
                    {homeworkList.length === 0 && (
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                        Cliquez sur "Ajouter un devoir" en haut à droite pour commencer le suivi.
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Grades Tracker */}
      {activeTab === 'grades' && (
        <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ borderCollapse: 'collapse', textAlign: 'left', minWidth: '100%' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: '220px' }}>Élève</th>
                  {(classObj.controls || []).map((col, idx) => (
                    <th key={idx} style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center', minWidth: '150px' }}>
                      {col}
                    </th>
                  ))}
                  {(classObj.controls || []).length === 0 && (
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Aucun contrôle enregistré</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={(classObj.controls || []).length + 1} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <FileSpreadsheet size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Aucun élève trouvé.</p>
                    </td>
                  </tr>
                ) : filteredStudents.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                      {s.name}
                    </td>
                    {(classObj.controls || []).map((col, idx) => {
                      // Fetch grades by s.id, uppercase ID, or email prefix
                      const studentKey = s.id?.toUpperCase();
                      const emailPrefix = s.email?.split('@')[0]?.toUpperCase();
                      const studentGrades = classObj.grades?.[s.id] || 
                                            (s.massarCode && classObj.grades?.[s.massarCode]) ||
                                            classObj.grades?.[studentKey] || 
                                            classObj.grades?.[emailPrefix] || 
                                            {};
                      const grade = studentGrades[col];
                      
                      const isEditing = editingCell?.massarCode === s.id && editingCell?.controlName === col;

                      return (
                        <td 
                          key={idx} 
                          style={{ padding: '0.8rem 1rem', textAlign: 'center' }}
                        >
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                              <input 
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveGrade();
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                style={{
                                  width: '55px', padding: '0.3rem', background: 'var(--bg-glass)',
                                  border: '1px solid var(--violet)', borderRadius: '6px', color: 'var(--text-main)',
                                  textAlign: 'center', fontSize: '0.82rem', outline: 'none'
                                }}
                                autoFocus
                              />
                              <button onClick={handleSaveGrade} style={{ background: 'var(--violet)', border: 'none', color: 'white', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}><Check size={12} /></button>
                              <button onClick={() => setEditingCell(null)} style={{ background: 'var(--border)', border: 'none', color: 'var(--text-muted)', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}><X size={12} /></button>
                            </div>
                          ) : (
                            <div 
                              onClick={() => startEditCell(s.id, col, grade)}
                              style={{ 
                                display: 'inline-block',
                                padding: '0.4rem 0.8rem',
                                borderRadius: '8px',
                                background: grade === null || grade === undefined ? 'rgba(255,255,255,0.03)' : grade >= 10 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                color: grade === null || grade === undefined ? 'var(--text-subtle)' : grade >= 10 ? 'var(--emerald)' : 'var(--danger)',
                                fontWeight: 700,
                                minWidth: '45px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: '1px solid transparent'
                              }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--violet)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                              title="Double-cliquez pour modifier"
                            >
                              {grade !== null && grade !== undefined ? grade : '-'}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {(classObj.controls || []).length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: '1.5rem', color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center' }}>
                      Cliquez sur "Ajouter un contrôle" en haut à droite pour commencer à saisir les notes.
                    </td>
                  </tr>
                )}

                {/* Stats Row 1: Average */}
                {students.length > 0 && (classObj.controls || []).length > 0 && (
                  <tr style={{ background: 'rgba(99, 102, 241, 0.03)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 800, color: 'var(--violet)' }}>
                      Moyenne de Classe
                    </td>
                    {(classObj.controls || []).map((col, idx) => {
                      const stat = controlStats[col];
                      return (
                        <td key={idx} style={{ padding: '1rem 1.25rem', textAlign: 'center', fontWeight: 800, color: 'var(--violet)' }}>
                          {stat?.avg !== '-' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <TrendingUp size={14} /> {stat?.avg} / 20
                            </span>
                          ) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* Stats Row 2: Min / Max */}
                {students.length > 0 && (classObj.controls || []).length > 0 && (
                  <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.8rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Notes Min / Max
                    </td>
                    {(classObj.controls || []).map((col, idx) => {
                      const stat = controlStats[col];
                      return (
                        <td key={idx} style={{ padding: '0.8rem 1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                          {stat?.min !== '-' ? `${stat?.min} / ${stat?.max}` : '-'}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Programme */}
      {activeTab === 'program' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Progress Header Panel */}
          {(() => {
            const programItems = classObj.program || [];
            const completedCount = programItems.filter(item => {
              const status = getProgramItemStatus(item);
              return status.label === 'Terminé';
            }).length;
            const progressPct = programItems.length > 0 ? Math.round((completedCount / programItems.length) * 100) : 0;
            
            return (
              <div className="glass-panel" style={{ padding: isMobile ? '1.25rem' : '2rem', display: 'flex', alignItems: 'center', gap: isMobile ? '1rem' : '2.5rem', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: isMobile ? '100%' : '220px' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Progression Globale du Programme</h3>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Vous avez complété <strong>{completedCount}</strong> sur <strong>{programItems.length}</strong> éléments planifiés pour cette classe.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ width: isMobile ? '80px' : '100px', height: isMobile ? '80px' : '100px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.05)', border: '4px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative' }}>
                    <span style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 900, color: progressPct === 100 ? 'var(--emerald)' : 'var(--violet)' }}>{progressPct}%</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.1rem' }}>Complété</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* List and Plan Section Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: isMobile ? '1.25rem' : '2rem', alignItems: 'flex-start' }}>
            
            {/* 1. Ordered Program Timeline */}
            <div className="glass-panel" style={{ padding: isMobile ? '1rem' : '1.5rem', border: '1px solid var(--border)', margin: 0 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1.5rem 0' }}>Liste Ordonnée des Activités</h3>
              
              {(!classObj.program || classObj.program.length === 0) ? (
                <div style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileSpreadsheet size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontWeight: 700, margin: 0 }}>Aucune activité planifiée.</p>
                  <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Utilisez le panneau de droite pour planifier vos premiers cours et contrôles.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {classObj.program.map((item, idx) => {
                    const status = getProgramItemStatus(item);
                    return (
                      <div 
                        key={item.id} 
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)',
                          borderRadius: '12px', padding: isMobile ? '0.75rem 0.85rem' : '0.85rem 1.25rem', gap: isMobile ? '0.65rem' : '1rem',
                          flexWrap: isMobile ? 'wrap' : 'nowrap',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.6rem' : '1rem', flex: 1, minWidth: 0 }}>
                          {/* Ordering Number */}
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: 'var(--bg-glass)', border: '1.5px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0
                          }}>
                            {idx + 1}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {/* Type Badge */}
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 800,
                                background: item.type === 'homework' ? 'rgba(239, 68, 68, 0.08)' : item.type === 'exercises' ? 'rgba(245, 158, 11, 0.08)' : item.type === 'course' ? 'rgba(99, 102, 241, 0.08)' : item.type === 'concours' ? 'rgba(16, 185, 129, 0.08)' : item.type === 'ebook' ? 'rgba(2, 132, 199, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                                color: item.type === 'homework' ? 'var(--danger)' : item.type === 'exercises' ? 'var(--warning)' : item.type === 'course' ? 'var(--violet)' : item.type === 'concours' ? 'var(--emerald)' : item.type === 'ebook' ? '#0284c7' : 'var(--text-muted)',
                                padding: '0.15rem 0.45rem', borderRadius: '4px', textTransform: 'uppercase'
                              }}>
                                {item.type === 'homework' ? 'devoir' : item.type === 'exercises' ? 'série' : item.type === 'course' ? 'cours' : item.type === 'concours' ? 'concours' : item.type === 'ebook' ? 'e-book' : 'perso'}
                              </span>
                              
                              {/* Status Badge */}
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 800,
                                color: status.color, background: status.bg,
                                padding: '0.15rem 0.45rem', borderRadius: '4px'
                              }}>
                                {status.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions (Reordering & Deleting) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: isMobile ? 'auto' : 0 }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveProgramItem(idx, 'up')}
                            style={{
                              background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                              width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'rgba(255,255,255,0.05)' : 'var(--text-muted)',
                              transition: 'all 0.2s'
                            }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === classObj.program.length - 1}
                            onClick={() => handleMoveProgramItem(idx, 'down')}
                            style={{
                              background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                              width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: idx === classObj.program.length - 1 ? 'not-allowed' : 'pointer', color: idx === classObj.program.length - 1 ? 'rgba(255,255,255,0.05)' : 'var(--text-muted)',
                              transition: 'all 0.2s'
                            }}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveProgramItem(idx)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.03)', border: '1px solid var(--border)', borderRadius: '6px',
                              width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: 'var(--danger)', transition: 'all 0.2s', marginLeft: '0.25rem'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Planning Form */}
            <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border)', margin: 0 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1.25rem 0' }}>Planifier une Activité</h3>
              
              <form onSubmit={handleAddProgramItem} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="input-group">
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Sélectionner une fiche de cours</label>
                  <select
                    className="input-control"
                    value={selectedProgramLessonId}
                    onChange={e => {
                      setSelectedProgramLessonId(e.target.value);
                      if (e.target.value) setCustomProgramTitle('');
                    }}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="">-- Choisir une document (Cours, Série ou Devoir) --</option>
                    {(() => {
                      const levelMatchedDocs = lessons.filter(l => {
                        const targetLevel = normalizeLevel(classObj?.level);
                        const lessonLevel = normalizeLevel(l.level);
                        return (
                          lessonLevel === targetLevel ||
                          lessonLevel === 'all' ||
                          l.level === classObj?.level ||
                          (Array.isArray(classObj?.assignedLessons) && classObj.assignedLessons.includes(l.id))
                        );
                      });

                      const courses = levelMatchedDocs.filter(l => l.docType === 'course' || (!l.docType && !l.isExam));
                      const ebooks = levelMatchedDocs.filter(l => l.docType === 'ebook');
                      const series = levelMatchedDocs.filter(l => l.docType === 'exercises' || l.docType === 'series');
                      const homeworks = levelMatchedDocs.filter(l => l.docType === 'homework' || l.docType === 'exam' || l.docType === 'control' || l.isExam);

                      return (
                        <>
                          {courses.length > 0 && (
                            <optgroup label="📖 Cours & Chapitres du programme">
                              {courses.map(l => (
                                <option key={l.id} value={l.id}>📖 {l.title} {l.subject ? `(${l.subject})` : ''}</option>
                              ))}
                            </optgroup>
                          )}
                          {ebooks.length > 0 && (
                            <optgroup label="📚 E-Books">
                              {ebooks.map(l => (
                                <option key={l.id} value={l.id}>📚 {l.title} {l.subject ? `(${l.subject})` : ''}</option>
                              ))}
                            </optgroup>
                          )}
                          {series.length > 0 && (
                            <optgroup label="📝 Séries d'exercices & Fiches TD">
                              {series.map(l => (
                                <option key={l.id} value={l.id}>📝 {l.title} {l.subject ? `(${l.subject})` : ''}</option>
                              ))}
                            </optgroup>
                          )}
                          {homeworks.length > 0 && (
                            <optgroup label="📑 Devoirs surveillés & Contrôles">
                              {homeworks.map(l => (
                                <option key={l.id} value={l.id}>📑 {l.title} {l.subject ? `(${l.subject})` : ''}</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                </div>

                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-subtle)', fontWeight: 700, margin: '0.2rem 0' }}>— OU —</div>

                <div className="input-group">
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Titre personnalisé</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Ex: Contrôle N°1 ou Séance de soutien"
                    value={customProgramTitle}
                    onChange={e => {
                      setCustomProgramTitle(e.target.value);
                      if (e.target.value) setSelectedProgramLessonId('');
                    }}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn"
                  style={{
                    width: '100%', padding: '0.65rem', borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    background: 'linear-gradient(135deg, var(--violet), var(--emerald))', border: 'none',
                    fontWeight: 800, fontSize: '0.85rem', marginTop: '0.5rem'
                  }}
                >
                  <Plus size={16} /> Ajouter au programme
                </button>
              </form>

            </div>

          </div>

        </div>
      )}

      {/* Tab 5: Competitions & Exams Dedicated Gradebook */}
      {activeTab === 'competitions' && (
        <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '1.25rem 1.5rem', background: 'rgba(124, 58, 237, 0.05)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(124, 58, 237, 0.15)', color: 'var(--violet)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>Carnet de Notes des Concours & Examens (OMR)</h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Suivi dédié des résultats aux concours et feuilles de réponses scannées via QR Code</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleExportMassar(classObj)}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.6rem 1rem', borderRadius: '10px',
                  fontSize: '0.82rem', fontWeight: 800, color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)',
                  background: 'rgba(59, 130, 246, 0.08)'
                }}
                title="Exporter les notes au format CSV compatible Massar"
              >
                <FileSpreadsheet size={15} /> Export Massar (.csv)
              </button>

              <button
                onClick={() => handleGenerateDiagnosticPDF(classObj)}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.6rem 1rem', borderRadius: '10px',
                  fontSize: '0.82rem', fontWeight: 800, color: 'var(--violet)', border: '1px solid rgba(124, 58, 237, 0.3)',
                  background: 'rgba(124, 58, 237, 0.08)'
                }}
                title="Générer un rapport d'analyse diagnostic pédagogique IA"
              >
                <Sparkles size={15} /> Rapport Diagnostic IA
              </button>

              <button
                onClick={() => {
                  navigate('/admin/ai-import', {
                    state: {
                      docType: 'exercises',
                      promptHint: `Générer une série de soutien et remédiation pédagogique pour la classe ${classObj?.name} (Niveau: ${classObj?.level}). Focus sur les lacunes identifiées : Limites, Dérivation, et Etude de Fonctions.`
                    }
                  });
                }}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.6rem 1rem', borderRadius: '10px',
                  fontSize: '0.82rem', fontWeight: 800, color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)',
                  background: 'rgba(59, 130, 246, 0.08)'
                }}
                title="Générer une série de soutien IA ciblée sur les lacunes du groupe"
              >
                <BookOpenCheck size={15} /> ⚡ Série de Soutien IA
              </button>

              <button
                onClick={() => handleGenerateStudentBulletinsPDF(classObj)}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.6rem 1rem', borderRadius: '10px',
                  fontSize: '0.82rem', fontWeight: 800, color: 'var(--emerald)', border: '1px solid rgba(16, 185, 129, 0.3)',
                  background: 'rgba(16, 185, 129, 0.08)'
                }}
                title="Imprimer les bulletins de résultats individuels pour chaque élève"
              >
                <Printer size={15} /> Bulletins Élèves (PDF)
              </button>

              <button
                onClick={async () => {
                  setShowOMRModal(true);
                  if (allExamsList.length === 0) {
                    const ex = await getAllExams();
                    setAllExamsList(ex);
                  }
                }}
                className="btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.65rem 1.25rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--violet), var(--emerald))', border: 'none',
                  color: '#fff', fontWeight: 800, fontSize: '0.85rem'
                }}
              >
                <FileSpreadsheet size={16} /> Attribuer un concours & Grilles OMR
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ borderCollapse: 'collapse', textAlign: 'left', minWidth: '100%' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: '220px' }}>Nom & Prénom de l'élève</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: '120px', textAlign: 'center' }}>Code Massar</th>
                  
                  {/* Competitions Columns */}
                  {(() => {
                    const compList = (classObj.competitions && classObj.competitions.length > 0)
                      ? classObj.competitions
                      : (classObj.controls || []).filter(c => c.toLowerCase().includes('مباراة') || c.toLowerCase().includes('concours') || c.toLowerCase().includes('ensa') || c.toLowerCase().includes('medecine') || c.toLowerCase().includes('fst'));
                    
                    if (compList.length === 0) {
                      return <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-subtle)', fontStyle: 'italic', textAlign: 'center' }}>Aucun résultat de concours enregistré pour le moment</th>;
                    }

                    return compList.map((comp, idx) => (
                      <th key={idx} style={{ padding: '0.85rem 1rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--violet)', textTransform: 'uppercase', textAlign: 'center', minWidth: '180px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <span>🏆 {comp}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCompetition(comp);
                            }}
                            title="Retirer ce concours de la classe"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px',
                              color: 'var(--danger)', cursor: 'pointer', padding: '3px 6px', display: 'flex',
                              alignItems: 'center', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </th>
                    ));
                  })()}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const compList = (classObj.competitions && classObj.competitions.length > 0)
                    ? classObj.competitions
                    : (classObj.controls || []).filter(c => c.toLowerCase().includes('مباراة') || c.toLowerCase().includes('concours') || c.toLowerCase().includes('ensa') || c.toLowerCase().includes('medecine') || c.toLowerCase().includes('fst'));

                  if (filteredStudents.length === 0) {
                    return (
                      <tr>
                        <td colSpan={Math.max(3, compList.length + 2)} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Award size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                          <p style={{ margin: 0, fontWeight: 700 }}>Aucun élève enregistré dans cette classe.</p>
                        </td>
                      </tr>
                    );
                  }

                  return filteredStudents.map(s => {
                    const massar = s.massarCode || s.id;
                    const compGradesObj = classObj.competitionGrades?.[massar] || classObj.competitionGrades?.[s.id] || classObj.grades?.[massar] || classObj.grades?.[s.id] || {};

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          {s.name}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
                          {s.massarCode || s.id}
                        </td>

                        {compList.length === 0 ? (
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center' }}>
                            Cliquez sur "Attribuer un concours" pour scanner les feuilles et enregistrer les notes.
                          </td>
                        ) : compList.map((comp, idx) => {
                          const val = compGradesObj[comp];
                          const cleanedVal = typeof val === 'string' ? val.replace(/^([\d.]+)\/20\s*\(\s*[\d.]+\/20\s*\)$/i, '$1/20') : val;
                          const isEditing = editingCompGrade?.studentId === s.id && editingCompGrade?.comp === comp;

                          return (
                            <td key={idx} style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                              {isEditing ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="text"
                                    autoFocus
                                    className="input-control"
                                    style={{ width: '85px', padding: '0.25rem 0.4rem', fontSize: '0.82rem', textAlign: 'center' }}
                                    value={editingCompGrade.val}
                                    onChange={e => setEditingCompGrade({ ...editingCompGrade, val: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSaveCompGrade(massar, comp, editingCompGrade.val);
                                      if (e.key === 'Escape') setEditingCompGrade(null);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveCompGrade(massar, comp, editingCompGrade.val)}
                                    style={{ background: 'var(--emerald)', border: 'none', color: '#fff', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer' }}
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCompGrade(null)}
                                    style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer' }}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => setEditingCompGrade({ studentId: s.id, massar, comp, val: cleanedVal ? String(cleanedVal) : '' })}
                                  title="Cliquer pour modifier la note"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '8px',
                                    background: cleanedVal ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                                    color: cleanedVal ? 'var(--emerald)' : 'var(--text-subtle)',
                                    fontWeight: 800,
                                    fontSize: '0.86rem',
                                    cursor: 'pointer',
                                    border: cleanedVal ? '1px solid rgba(16, 185, 129, 0.3)' : '1px dashed var(--border)',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                  <span>{cleanedVal ? cleanedVal : 'Non composé'}</span>
                                  <Edit3 size={11} style={{ opacity: 0.6 }} />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Add Student Modal */}
      {showAddStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifycontent: 'center', zIndex: 9999 }}>
          <div className="glass-panel animate-scale-in" style={{ padding: '2rem', maxWidth: '440px', width: '95%', border: '1px solid var(--border)', position: 'relative', margin: 'auto' }}>
            <button 
              onClick={() => setShowAddStudent(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={20} className="text-violet" /> Ajouter un Élève Manuellement
            </h3>

            <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Code Massar (Identifiant)</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="Ex: N152008459"
                  value={newStudent.massarCode}
                  onChange={(e) => setNewStudent({ ...newStudent, massarCode: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Nom Complet</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="Ex: Yassine Belkadi"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  required
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Date de Naissance</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="Ex: 14/08/2009"
                  value={newStudent.dob}
                  onChange={(e) => setNewStudent({ ...newStudent, dob: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddStudent(false)} className="btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}>Annuler</button>
                <button type="submit" className="btn" style={{ padding: '0.5rem 1.25rem', borderRadius: '8px' }}>Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Homework or Control Column Modal */}
      {showAddColumn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifycontent: 'center', zIndex: 9999 }}>
          <div className="glass-panel animate-scale-in" style={{ padding: '2rem', maxWidth: '420px', width: '95%', border: '1px solid var(--border)', position: 'relative', margin: 'auto' }}>
            <button 
              onClick={() => setShowAddColumn(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} className="text-violet" /> Ajouter {columnType === 'homework' ? 'un Devoir Maison' : 'un Contrôle Continu'}
            </h3>

            <form onSubmit={handleAddColumn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Nom de l'évaluation</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder={columnType === 'homework' ? "Ex: Devoir Maison 2" : "Ex: Contrôle Continu 4"}
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddColumn(false)} className="btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}>Annuler</button>
                <button type="submit" className="btn" style={{ padding: '0.5rem 1.25rem', borderRadius: '8px' }}>Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OMR Batch PDF Generation Modal */}
      {showOMRModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="animate-scale-up" style={{
            background: 'var(--bg-card, #18181b)', border: '1px solid var(--border)',
            borderRadius: '1.25rem', width: '100%', maxWidth: '540px', padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', color: 'var(--text-main)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '12px',
                  background: 'rgba(124, 58, 237, 0.15)', color: 'var(--violet)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>Génération des Feuilles de Réponses OMR</h3>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                    Impression des grilles personnalisées avec QR Code pour les ({students.length}) élèves de la classe.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowOMRModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Sélectionner le concours / examen à attribuer :
              </label>
              <select
                className="input-control"
                style={{
                  width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: 'var(--text-main)', fontSize: '0.9rem', cursor: 'pointer'
                }}
                value={selectedExamForOMR ? selectedExamForOMR.id : ''}
                onChange={(e) => {
                  const found = allExamsList.find(ex => String(ex.id) === String(e.target.value));
                  setSelectedExamForOMR(found || null);
                }}
              >
                <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>-- Choisir un concours dans la liste --</option>
                {(() => {
                  const classNorm = normalizeLevel(classObj?.level);
                  const matching = allExamsList.filter(ex => {
                    const exNorm = normalizeLevel(ex.level || ex.school);
                    return exNorm === classNorm || 
                      ((classNorm === '2bac_pc_svt' || classNorm === '2bac_sm') && (exNorm === '2bac_pc_svt' || exNorm === '2bac_sm'));
                  });
                  const others = allExamsList.filter(ex => !matching.includes(ex));

                  return (
                    <>
                      {matching.length > 0 && (
                        <optgroup label="⭐ Concours recommandés pour cette classe">
                          {matching.map(ex => (
                            <option key={ex.id} value={ex.id} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                              {ex.school ? `[${ex.school}] ` : ''}{ex.name} ({ex.questionsCount || ex.questions?.length || 0} questions QCM)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {others.length > 0 && (
                        <optgroup label="Autres concours & examens">
                          {others.map(ex => (
                            <option key={ex.id} value={ex.id} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                              {ex.school ? `[${ex.school}] ` : ''}{ex.name} ({ex.questionsCount || ex.questions?.length || 0} questions QCM)
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  );
                })()}
              </select>
            </div>

            {selectedExamForOMR && (
              <div style={{
                background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.25)',
                borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem', lineHeight: '1.6',
                color: 'var(--text-main)'
              }}>
                <div style={{ fontWeight: 800, color: 'var(--violet)', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                  Détails du fichier à générer :
                </div>
                <div>• <strong>Classe :</strong> {classObj.name} ({students.length} feuilles individuelles)</div>
                <div>• <strong>Concours :</strong> {selectedExamForOMR.school ? `[${selectedExamForOMR.school}] ` : ''}{selectedExamForOMR.name}</div>
                <div>• <strong>Nombre de questions :</strong> {(selectedExamForOMR.questions || []).length || selectedExamForOMR.questionsCount || selectedExamForOMR.questions_count || 20} questions QCM</div>
                <div>• <strong>Guidage intelligent :</strong> Inclut un QR Code ultra-compact contenant le Code Massar de chaque élève pour une attribution automatique lors du scan OMR.</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                onClick={() => setShowOMRModal(false)}
                className="btn-outline"
                style={{ padding: '0.65rem 1.25rem', borderRadius: '10px', color: 'var(--text-main)', borderColor: 'var(--border)' }}
              >
                Annuler
              </button>
              <button
                disabled={!selectedExamForOMR || isGeneratingOMR}
                onClick={async () => {
                  if (!selectedExamForOMR) return;
                  setIsGeneratingOMR(true);
                  try {
                    let fullExam = selectedExamForOMR;
                    if (!fullExam.questions || fullExam.questions.length === 0) {
                      const loaded = await getExamById(selectedExamForOMR.id);
                      if (loaded && loaded.questions) fullExam = loaded;
                    }
                    if (!fullExam.questions || fullExam.questions.length === 0) {
                      const qList = await getExamQuestionsOnly(selectedExamForOMR.id);
                      if (qList && qList.length > 0) fullExam = { ...fullExam, questions: qList };
                    }

                    // 1. Persist competition assignment to class record in database
                    const compName = fullExam.name;
                    const currentComps = Array.isArray(classObj.competitions) ? [...classObj.competitions] : [];
                    const currentControls = Array.isArray(classObj.controls) ? [...classObj.controls] : [];
                    
                    let updatedComps = [...currentComps];
                    if (!updatedComps.includes(compName)) {
                      updatedComps.push(compName);
                    }
                    
                    let updatedControls = [...currentControls];
                    if (!updatedControls.includes(compName)) {
                      updatedControls.push(compName);
                    }

                    await updateClass(id, { competitions: updatedComps, controls: updatedControls });
                    setClassObj(prev => ({ ...prev, competitions: updatedComps, controls: updatedControls }));

                    // 2. Generate and download PDF
                    await generateBatchAnswerSheets(fullExam, classObj, students);
                    
                    setShowOMRModal(false);
                    setSuccess(`Le concours "${compName}" a été attribué avec succès à la classe ${classObj.name} !`);
                    setActiveTab('competitions');
                  } catch (err) {
                    console.error('Error assigning competition:', err);
                    alert(`Erreur lors de l'attribution du concours: ${err?.message || err}`);
                  } finally {
                    setIsGeneratingOMR(false);
                  }
                }}
                className="btn"
                style={{
                  padding: '0.65rem 1.35rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--violet), var(--emerald))', border: 'none',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontWeight: 800
                }}
              >
                {isGeneratingOMR ? <Sparkles size={16} className="animate-spin" /> : <Printer size={16} />}
                Télécharger les Grilles OMR (PDF)
              </button>
            </div>
          </div>
        </div>
      )}

               {/* Quick Grader (Numpad) Modal */}
      {showQuickGrader && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: isMobile ? '0.5rem' : '1rem' }}>
          <div className="glass-panel animate-scale-in" style={{
            padding: isMobile ? '1.25rem 1rem' : '2rem', maxWidth: '900px', width: '100%', height: isMobile ? '94vh' : '95vh', maxHeight: '740px',
            border: '1px solid var(--border)', position: 'relative', margin: 'auto', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', borderRadius: isMobile ? '16px' : '24px', background: '#18181b'
          }}>
            {/* Close Button */}
            <button 
              onClick={() => setShowQuickGrader(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <X size={24} />
            </button>

            {/* Header */}
            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileSpreadsheet className="text-violet" size={24} /> Saisie Rapide des Notes (Numpad)
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Saisissez les notes de la classe {classObj?.name} rapidement à l'aide du pavé numérique.
                </p>
              </div>
              
              {/* Header Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginRight: '2.5rem' }}>
                <button
                  type="button"
                  onClick={handleQuickSaveAndClose}
                  style={{
                    padding: '0.55rem 1.1rem', borderRadius: '10px',
                    fontSize: '0.85rem', fontWeight: 800, color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.4)', background: 'rgba(168, 85, 247, 0.12)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)'; e.currentTarget.style.color = '#d8b4fe'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.12)'; e.currentTarget.style.color = '#c084fc'; }}
                >
                  <Save size={15} /> Sauver & Fermer
                </button>
              </div>
            </div>

            {/* Main Modal Content */}
            {!quickGraderControl ? (
              /* Step 1: Select or Create Control */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(124,58,237,0.1)', color: 'var(--violet)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={32} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Sélectionner une évaluation</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Choisissez le contrôle continu pour lequel vous souhaitez saisir les notes, ou créez-en un nouveau.
                  </p>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(classObj?.controls || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
                      <select
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', background: '#27272a', border: '1px solid var(--border)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                        value={quickGraderControl}
                        onChange={(e) => {
                          const ctrl = e.target.value;
                          setQuickGraderControl(ctrl);
                          if (ctrl && sortedStudents.length > 0) {
                            setQuickGraderStudentIdx(0);
                            const firstStudent = sortedStudents[0];
                            const existingGrade = classObj.grades?.[firstStudent.id]?.[ctrl];
                            setQuickGraderValue(existingGrade !== null && existingGrade !== undefined ? String(existingGrade) : '');
                          }
                        }}
                      >
                        <option value="" style={{ background: '#27272a', color: '#fff' }}>-- Choisir un contrôle --</option>
                        {(classObj?.controls || []).map((ctrl, cIdx) => (
                          <option key={cIdx} value={ctrl} style={{ background: '#27272a', color: '#fff' }}>{ctrl}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>ou créer</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                  </div>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const val = newColumnName.trim();
                      if (!val) return;
                      try {
                        const controlsList = [...(classObj?.controls || [])];
                        if (controlsList.includes(val)) {
                          alert("Ce contrôle existe déjà.");
                          return;
                        }
                        controlsList.push(val);
                        const gradesData = classObj.grades || {};
                        students.forEach(s => {
                          if (!gradesData[s.id]) gradesData[s.id] = {};
                          gradesData[s.id][val] = null;
                        });
                        
                        await updateClass(id, { 
                          controls: controlsList,
                          grades: gradesData
                        });
                        
                        setClassObj(prev => ({
                          ...prev,
                          controls: controlsList,
                          grades: gradesData
                        }));

                        setQuickGraderControl(val);
                        setQuickGraderStudentIdx(0);
                        setQuickGraderValue('');
                        setNewColumnName('');
                      } catch (err) {
                        console.error(err);
                        alert("Erreur lors de la création de la colonne.");
                      }
                    }}
                    style={{ display: 'flex', gap: '0.5rem', width: '100%' }}
                  >
                    <input 
                      type="text"
                      placeholder="Nom du nouveau contrôle..."
                      className="input-control"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '10px', fontSize: '0.85rem' }}
                      required
                    />
                    <button type="submit" className="btn" style={{ padding: '0.65rem 1.1rem', borderRadius: '10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Créer</button>
                  </form>
                </div>
              </div>
            ) : (
              /* Step 2: The Grader Dashboard */
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: isMobile ? '1rem' : '2rem', overflow: isMobile ? 'auto' : 'hidden' }}>
                
                {/* Left Column: Student Detail & Selector */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem',
                  borderRight: isMobile ? 'none' : '1px solid var(--border)',
                  borderBottom: isMobile ? '1px solid var(--border)' : 'none',
                  paddingRight: isMobile ? 0 : '2rem',
                  paddingBottom: isMobile ? '1rem' : 0,
                  overflowY: isMobile ? 'visible' : 'auto'
                }}>
                  
                  {/* Select Control Dropdown & change button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontWeight: 800, textTransform: 'uppercase' }}>Évaluation Active</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--violet)' }}>{quickGraderControl}</div>
                    </div>
                    <button 
                      onClick={() => setQuickGraderControl('')}
                      className="btn-outline"
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      Changer
                    </button>
                  </div>

                  {/* Student Navigation Dropdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 700 }}>Liste des élèves ({sortedStudents.length}) :</label>
                    <select
                      value={quickGraderStudentIdx}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value);
                        setQuickGraderStudentIdx(idx);
                        const selectedStudent = sortedStudents[idx];
                        const existingGrade = classObj.grades?.[selectedStudent.id]?.[quickGraderControl];
                        setQuickGraderValue(existingGrade !== null && existingGrade !== undefined ? String(existingGrade) : '');
                      }}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', background: '#27272a', border: '1px solid var(--border)', color: '#fff', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
                    >
                      {sortedStudents.map((st, sIdx) => {
                        const score = classObj.grades?.[st.id]?.[quickGraderControl];
                        const scoreDisplay = score !== null && score !== undefined ? `${score}/20` : 'Sans note';
                        return (
                          <option key={st.id} value={sIdx} style={{ background: '#27272a', color: '#fff' }}>
                            {sIdx + 1}. {st.name} ({scoreDisplay})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Active Student Display Card */}
                  {(() => {
                    const student = sortedStudents[quickGraderStudentIdx];
                    if (!student) return null;
                    const progressPct = Math.round(((quickGraderStudentIdx + 1) / sortedStudents.length) * 100);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'rgba(255,255,255,0.01)', padding: '1.5rem', borderRadius: '16px', border: '1px dashed var(--border)', flex: 1, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                        {/* Huge Avatar */}
                        <div style={{
                          width: '80px', height: '80px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '2rem', fontWeight: 900, color: '#fff',
                          boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                        }}>
                          {student.name?.charAt(0) || '?'}
                        </div>
                        
                        <div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>{student.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>Code Massar: <strong>{student.massarCode || student.id}</strong></div>
                        </div>

                        {/* Progress Indicator */}
                        <div style={{ width: '100%', marginTop: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 700 }}>
                            <span>PROGRESSION DE LA SAISIE</span>
                            <span>{quickGraderStudentIdx + 1} / {sortedStudents.length} ({progressPct}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--violet), var(--emerald))', borderRadius: '10px', transition: 'width 0.3s ease' }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* Right Column: Score Display & Numpad */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', paddingBottom: '0.5rem' }}>
                  
                  {/* Huge Score Screen */}
                  <div style={{
                    background: 'rgba(0,0,0,0.4)', borderRadius: '16px', border: '1px solid var(--border)',
                    padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    minHeight: '80px', marginBottom: '1rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Note à attribuer</div>
                      <div style={{ fontSize: '2rem', fontWeight: 900, color: quickGraderValue === '' ? 'rgba(255,255,255,0.15)' : quickGraderValue === 'ABS' ? 'var(--danger)' : 'var(--emerald)' }}>
                        {quickGraderValue === '' ? '- -' : quickGraderValue}
                        {quickGraderValue !== '' && quickGraderValue !== 'ABS' && <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 700 }}> / 20</span>}
                      </div>
                    </div>

                    {/* Auto-advance Option */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <input 
                        type="checkbox"
                        id="autoAdvanceCheck"
                        checked={quickGraderAutoAdvance}
                        onChange={(e) => setQuickGraderAutoAdvance(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--violet)', cursor: 'pointer' }}
                      />
                      <label htmlFor="autoAdvanceCheck" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                        Suivant auto. ⚡
                      </label>
                    </div>
                  </div>

                  {/* Numpad Grid */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem',
                    flex: 1, marginBottom: '1rem'
                  }}>
                    {/* Digits 1-9 */}
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(digit => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleNumpadInput(digit)}
                        style={{
                          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                          borderRadius: '14px', fontSize: '1.5rem', fontWeight: 800, color: '#fff',
                          cursor: 'pointer', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '64px'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124, 58, 237, 0.25)'; e.currentTarget.style.borderColor = 'var(--violet)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        {digit}
                      </button>
                    ))}

                    {/* Bottom row: C, 0, ⌫ */}
                    <button
                      type="button"
                      onClick={() => handleNumpadInput('C')}
                      style={{
                        background: '#ef4444', border: 'none',
                        borderRadius: '14px', fontSize: '1.15rem', fontWeight: 800, color: '#fff',
                        cursor: 'pointer', transition: 'all 0.15s ease', height: '64px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                      onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                    >
                      Effacer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadInput('0')}
                      style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                        borderRadius: '14px', fontSize: '1.5rem', fontWeight: 800, color: '#fff',
                        cursor: 'pointer', transition: 'all 0.15s', height: '64px'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124, 58, 237, 0.25)'; e.currentTarget.style.borderColor = 'var(--violet)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadInput('⌫')}
                      style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                        borderRadius: '14px', fontSize: '1.4rem', fontWeight: 800, color: '#fff',
                        cursor: 'pointer', transition: 'all 0.15s', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124, 58, 237, 0.25)'; e.currentTarget.style.borderColor = 'var(--violet)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      ⌫
                    </button>
                  </div>

                  {/* Decimal Shortcuts Row */}
                  <div className="mobile-2col-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem', marginBottom: '1rem' }}>
                    {['.00', '.25', '.50', '.75'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleNumpadInput(val)}
                        style={{
                          background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.4)',
                          borderRadius: '12px', padding: '0.85rem 0', fontSize: '1.15rem', fontWeight: 900,
                          color: '#34d399', cursor: 'pointer', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52, 211, 153, 0.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52, 211, 153, 0.15)'; }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>

                  {/* Absent and Save Buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickGraderValue('ABS');
                        if (quickGraderAutoAdvance) {
                          saveQuickGradeAndGoNext('ABS');
                        }
                      }}
                      style={{
                        flex: '0.3', padding: '0.85rem', borderRadius: '12px',
                        fontSize: '1rem', fontWeight: 800, color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.15)', cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; e.currentTarget.style.color = '#fca5a5'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#f87171'; }}
                    >
                      Absent
                    </button>

                    <button
                      type="button"
                      onClick={handleQuickSaveCurrent}
                      className="btn"
                      style={{
                        flex: '1', padding: '0.85rem', borderRadius: '12px',
                        fontSize: '1rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
                        color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        transition: 'opacity 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      <Save size={18} /> Enregistrer & Suivant
                    </button>
                  </div>

                  {/* Previous / Next Manual Navigation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      disabled={quickGraderStudentIdx === 0}
                      onClick={handleQuickGraderPrev}
                      className="btn-outline"
                      style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', opacity: quickGraderStudentIdx === 0 ? 0.3 : 1, cursor: 'pointer' }}
                    >
                      ← Élève Précédent
                    </button>
                    
                    <button
                      type="button"
                      disabled={quickGraderStudentIdx === sortedStudents.length - 1}
                      onClick={handleQuickGraderNext}
                      className="btn-outline"
                      style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', opacity: quickGraderStudentIdx === sortedStudents.length - 1 ? 0.3 : 1, cursor: 'pointer' }}
                    >
                      Ignorer / Suivant →
                    </button>
                  </div>

                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Diagnostic & Remediation Modal ── */}
      <ClassDiagnosticRemediationModal
        isOpen={showDiagnosticModal}
        onClose={() => setShowDiagnosticModal(false)}
        classObj={classObj || {}}
        students={students || []}
        teacherName={user?.name || 'Professeur de Mathématiques'}
      />

    </div>
  );
}
