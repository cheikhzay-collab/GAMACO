import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getActiveLessons } from '../services/lessonService';
import { 
  GraduationCap, Search, ArrowLeft, BookOpen, 
  User, ChevronRight, Sparkles, BookOpenCheck, FolderOpen,
  FileDown, Play, Clock, BrainCircuit, LayoutGrid, List, Calendar
} from 'lucide-react';
import { renderWithMath } from '../utils/mathRenderer';
import { mapLegacySchoolToLevel, normalizeLevel } from '../utils/levelHelpers';
import { generateSubjectHTML, generateCorrectionHTML, openPrintWindow } from '../utils/generateExamPDF';
import { generateAnswerSheet } from '../utils/generateAnswerSheet';

const MAIN_LEVELS = [
  {
    id: 'tc',
    name: 'Tronc Commun',
    subName: 'Tronc Commun',
    desc: 'Année de tronc commun pour s\'orienter vers les filières du baccalauréat.',
    icon: GraduationCap,
    gradient: 'linear-gradient(135deg, #10B981, #059669)',
    bgSoft: 'rgba(16, 185, 129, 0.05)',
    textColor: '#10B981',
    branches: [
      {
        id: 'common_core_sci',
        name: 'Tronc Commun Scientifique',
        subName: 'Tronc Commun Sciences',
        desc: 'Bases en Mathématiques, Physique-Chimie et SVT.'
      },
      {
        id: 'common_core_arts',
        name: 'Tronc Commun Littéraire',
        subName: 'Tronc Commun Lettres',
        desc: 'Bases en Langues, Littérature et Sciences Humaines.'
      }
    ]
  },
  {
    id: '1bac',
    name: '1ère Année Baccalauréat',
    subName: '1ère Année Bac',
    desc: 'Préparation aux examens régionaux marocains.',
    icon: Sparkles,
    gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
    bgSoft: 'rgba(59, 130, 246, 0.05)',
    textColor: '#3B82F6',
    branches: [
      {
        id: '1bac_sci',
        name: '1ère Bac Sciences Expérimentales',
        subName: '1ère Bac Sciences Exp.',
        desc: 'Physique-Chimie, SVT, Mathématiques et Français.'
      },
      {
        id: '1bac_arts',
        name: '1ère Bac Littéraire',
        subName: '1ère Bac Lettres',
        desc: 'Matières littéraires et examen régional.'
      }
    ]
  },
  {
    id: '2bac',
    name: '2ème Année Baccalauréat',
    subName: '2ème Année Bac',
    desc: 'Dernière ligne droite pour l\'obtention du diplôme national du Baccalauréat.',
    icon: BookOpenCheck,
    gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    bgSoft: 'rgba(139, 92, 246, 0.05)',
    textColor: '#8B5CF6',
    branches: [
      {
        id: '2bac_sm',
        name: '2ème Bac Sciences Mathématiques',
        subName: '2ème Bac Sciences Maths',
        desc: 'Préparation intensive aux écoles d\'ingénieurs (Sciences Maths A & B).'
      },
      {
        id: '2bac_pc_svt',
        name: '2ème Bac Sciences Expérimentales',
        subName: '2ème Bac PC / SVT',
        desc: 'Préparation au concours de Médecine, ENSA et facultés des sciences.'
      },
      {
        id: '2bac_arts',
        name: '2ème Bac Lettres & Sciences Humaines',
        subName: '2ème Bac Lettres & Sc. Humaines',
        desc: 'Filière littéraire nationale.'
      }
    ]
  }
];

export default function LevelsPage() {
  const { user, exams, schools, loadExamQuestions, trackDownload } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation states synced with URL search params (?level=2bac&branch=2bac_pc_svt)
  const selectedParentId = searchParams.get('level') || null;
  const selectedBranchId = searchParams.get('branch') || null;

  const setSelectedParentId = (parentId) => {
    if (parentId) {
      setSearchParams({ level: parentId });
    } else {
      setSearchParams({});
    }
  };

  const setSelectedBranchId = (branchId) => {
    if (branchId) {
      setSearchParams({ level: selectedParentId || '', branch: branchId });
    } else if (selectedParentId) {
      setSearchParams({ level: selectedParentId });
    } else {
      setSearchParams({});
    }
  };

  // Remember the exact origin so lesson viewer can return reliably
  useEffect(() => {
    const fullUrl = window.location.pathname + window.location.search;
    sessionStorage.setItem('last_lessons_origin', fullUrl);
  }, [selectedParentId, selectedBranchId]);

  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Tous');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'course', 'exercises', 'homework'
  const [lessonViewMode, setLessonViewMode] = useState('cards'); // 'cards' | 'list'

  // Load active lessons
  useEffect(() => {
    const fetchLessons = async () => {
      setLoading(true);
      try {
        const data = await getActiveLessons();
        setLessons(data || []);
      } catch (err) {
        console.error('[LevelsPage] Error loading lessons:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLessons();
  }, []);

  // Combine lessons and exams into a single resources list
  const allResources = useMemo(() => {
    const rawLessons = lessons;
    const normalizedExams = (exams || [])
      .filter(e => !e.isArchived)
      .map(e => {
        const examLvl = e.level || mapLegacySchoolToLevel(e.school);
        return {
          id: `exam_${e.id}`,
          title: e.name,
          subject: 'Mathématiques', // default subject for filters compatibility
          docType: 'concours',
          teacher: e.year ? `Annales ${e.year}` : 'Concours Officiel',
          isExam: true,
          examId: e.id,
          tier: e.tier,
          level: examLvl,
          year: e.year,
          questions: e.questions,
          pdfUrl: e.pdfUrl,
          schools: e.tier === 'premium' ? ['premium'] : []
        };
      });
    return [...rawLessons, ...normalizedExams];
  }, [lessons, exams]);

  // Compute counts for parent levels
  const parentCounts = useMemo(() => {
    const counts = {};
    MAIN_LEVELS.forEach(parent => {
      const branchIds = parent.branches.map(b => b.id);
      counts[parent.id] = allResources.filter(l => branchIds.includes(normalizeLevel(l.level))).length;
    });
    return counts;
  }, [allResources]);

  // Compute counts for branches
  const branchCounts = useMemo(() => {
    const counts = {};
    MAIN_LEVELS.forEach(parent => {
      parent.branches.forEach(branch => {
        counts[branch.id] = allResources.filter(l => {
          const normLvl = normalizeLevel(l.level);
          if (normLvl === branch.id) return true;
          if (l.docType === 'concours' || l.isExam) {
            if ((normLvl === '2bac_pc_svt' || normLvl === '2bac_sm') && (branch.id === '2bac_pc_svt' || branch.id === '2bac_sm')) {
              return true;
            }
          }
          return false;
        }).length;
      });
    });
    return counts;
  }, [allResources]);

  // Current active data
  const selectedParent = useMemo(() => {
    return MAIN_LEVELS.find(p => p.id === selectedParentId);
  }, [selectedParentId]);

  const selectedBranch = useMemo(() => {
    if (!selectedParent) return null;
    return selectedParent.branches.find(b => b.id === selectedBranchId);
  }, [selectedParent, selectedBranchId]);

  // Lessons list filtered by the selected branch
  const branchLessons = useMemo(() => {
    if (!selectedBranchId) return [];
    return allResources.filter(l => {
      const normLvl = normalizeLevel(l.level);
      if (normLvl === selectedBranchId) return true;
      if (l.docType === 'concours' || l.isExam) {
        if ((normLvl === '2bac_pc_svt' || normLvl === '2bac_sm') && (selectedBranchId === '2bac_pc_svt' || selectedBranchId === '2bac_sm')) {
          return true;
        }
      }
      return false;
    });
  }, [allResources, selectedBranchId]);

  // Subjects filter list
  const subjects = useMemo(() => {
    const subs = branchLessons.map(l => l.subject).filter(Boolean);
    return ['Tous', ...new Set(subs)];
  }, [branchLessons]);

  // Filter lessons search/subject
  const filteredLessons = useMemo(() => {
    return branchLessons.filter(l => {
      const matchesSearch = l.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            l.teacher?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSubject = selectedSubject === 'Tous' || l.subject === selectedSubject || (l.isExam && ['Mathématiques', 'Physique', 'Chimie', 'Sciences'].includes(selectedSubject));
      const matchesTab = activeTab === 'all' || l.docType === activeTab;
      return matchesSearch && matchesSubject && matchesTab;
    });
  }, [branchLessons, searchTerm, selectedSubject, activeTab]);


  const handleDownloadPDF = async (exam) => {
    let questions = exam.questions;
    if (!questions || questions.length === 0) {
      try {
        questions = await loadExamQuestions(exam.examId);
      } catch (err) {
        console.error('Failed to load questions for OMR sheet:', err);
        return;
      }
    }
    await generateAnswerSheet({ id: exam.examId, name: exam.title, school: exam.title, questions }, user);
  };

  const handlePrintExam = async (exam, type) => {
    if (type === 'sujet' && exam.pdfUrl) {
      window.open(exam.pdfUrl, '_blank');
      return;
    }

    const isMobile = window.innerWidth <= 768;
    let win = null;
    if (!isMobile) {
      win = window.open('', '_blank');
      if (win) {
        win.document.write('<html><head><title>Génération du PDF...</title></head><body style="background:#09090b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;padding:20px;text-align:center;"><div><h3 style="margin:0 0 10px 0;">GAMA</h3><p style="margin:0;color:#a1a1aa;font-size:0.9rem;">Génération de votre document PDF en cours...</p></div></body></html>');
      }
    }

    try {
      let questions = exam.questions;
      if (!questions || questions.length === 0) {
        questions = await loadExamQuestions(exam.examId);
      }
      const schoolsList = schools && schools.length > 0 ? schools : Array.from(new Set((exams || []).map(e => e.school))).filter(Boolean);
      
      let html = '';
      if (type === 'corrige') {
        html = generateCorrectionHTML(exam.title, exam.title, exam.year, questions || [], { examId: exam.examId, schoolsList });
      } else {
        html = await generateSubjectHTML(exam.title, exam.title, exam.year, questions || [], { examId: exam.examId, schoolsList });
      }

      // Write to localStorage for PrintView / Mobile sync
      localStorage.setItem('print_html', html);

      if (isMobile) {
        window.open(`/print?examId=${exam.examId}&type=${type}`, '_blank');
      } else {
        openPrintWindow(html, type, win);
      }
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      if (win) win.close();
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', minHeight: '80vh', paddingBottom: '2rem' }}>
      
      {/* Background radial glow */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-5%', width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124, 58, 237, 0.04) 0%, transparent 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none'
      }} />

      {/* ── BREADCRUMBS & NAVIGATION HEADER ── */}
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span 
            onClick={() => { setSelectedParentId(null); setSelectedBranchId(null); }}
            style={{ 
              color: selectedParentId ? 'var(--text-muted)' : 'var(--text-main)', 
              cursor: selectedParentId ? 'pointer' : 'default',
              fontWeight: 800, fontSize: '0.9rem'
            }}
          >
            Niveaux Scolaires
          </span>

          {selectedParentId && (
            <>
              <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>/</span>
              <span 
                onClick={() => setSelectedBranchId(null)}
                style={{ 
                  color: selectedBranchId ? 'var(--text-muted)' : 'var(--text-main)', 
                  cursor: selectedBranchId ? 'pointer' : 'default',
                  fontWeight: 800, fontSize: '0.9rem' 
                }}
              >
                {selectedParent?.name}
              </span>
            </>
          )}

          {selectedBranchId && (
            <>
              <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>/</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '0.9rem' }}>
                {selectedBranch?.name}
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
          {(selectedParentId || selectedBranchId) && (
            <button 
              onClick={() => {
                if (selectedBranchId) {
                  setSelectedBranchId(null);
                } else {
                  setSelectedParentId(null);
                }
                setSelectedSubject('Tous');
                setSearchTerm('');
              }}
              className="btn-outline" 
              style={{ padding: '0.5rem 0.75rem', borderRadius: '12px' }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)' }}>
              {selectedBranchId ? (
                <>
                  <FolderOpen size={26} style={{ color: selectedParent?.textColor }} />
                  {selectedBranch?.name}
                </>
              ) : selectedParentId ? (
                <>
                  <GraduationCap size={28} style={{ color: selectedParent?.textColor }} />
                  {selectedParent?.name}
                </>
              ) : (
                <>
                  <GraduationCap size={28} className="text-violet" />
                  Niveaux
                </>
              )}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {selectedBranchId ? (
                <>
                  <span style={{ direction: 'rtl', fontFamily: 'inherit', fontWeight: 700, color: 'var(--text-subtle)' }}>{selectedBranch?.subName}</span>
                  <span>—</span>
                  <span>Explorez et téléchargez les fiches de cours et exercices.</span>
                </>
              ) : selectedParentId ? (
                <>
                  <span style={{ direction: 'rtl', fontFamily: 'inherit', fontWeight: 700, color: 'var(--text-subtle)' }}>{selectedParent?.subName}</span>
                  <span>—</span>
                  <span>Sélectionnez votre filière / spécialité.</span>
                </>
              ) : (
                <span>Choisissez votre niveau puis votre branche pour accéder aux ressources pédagogiques.</span>
              )}
            </p>
          </div>
        </div>
      </header>

      {/* ── STEP 1: MAIN LEVELS SELECTION ── */}
      {!selectedParentId && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))',
          gap: '1.5rem',
          marginTop: '1rem'
        }}>
          {MAIN_LEVELS.map((parent) => {
            const IconComponent = parent.icon;
            const count = parentCounts[parent.id] || 0;
            return (
              <div 
                key={parent.id}
                onClick={() => setSelectedParentId(parent.id)}
                className="glass-panel"
                style={{
                  padding: '2.25rem 2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-glass)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = parent.textColor;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 12px 30px ${parent.bgSoft}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px',
                    background: parent.gradient, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    <IconComponent size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{parent.name}</h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600 }}>{parent.subName}</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
                  {parent.desc}
                </p>

                <div style={{
                  marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: parent.textColor, background: parent.bgSoft, padding: '0.25rem 0.65rem', borderRadius: '6px' }}>
                    {count} {count > 1 ? 'Ressources' : 'Ressource'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Voir les sections <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── STEP 2: BRANCHES/SECTIONS SELECTION (within selected level) ── */}
      {selectedParentId && !selectedBranchId && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          gap: '1.5rem',
          marginTop: '1rem'
        }}>
          {selectedParent?.branches.map((branch) => {
            const count = branchCounts[branch.id] || 0;
            return (
              <div 
                key={branch.id}
                onClick={() => setSelectedBranchId(branch.id)}
                className="glass-panel"
                style={{
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-glass)',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = selectedParent.textColor;
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = `0 10px 25px ${selectedParent.bgSoft}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.2rem 0', color: 'var(--text-main)' }}>{branch.name}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: 600 }}>{branch.subName}</span>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {branch.desc}
                </p>

                <div style={{
                  marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: '0.8rem'
                }}>
                  <span style={{ fontWeight: 800, color: selectedParent.textColor }}>
                    {count} Ressources
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Accéder aux cours <ChevronRight size={13} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── STEP 3: LESSONS LIST (within selected branch) ── */}
      {selectedBranchId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Controls: Search & Subject Pills */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: '1rem'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Rechercher un cours ou enseignant..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', background: 'var(--bg-glass)', 
                  border: '1px solid var(--border)', borderRadius: '12px', color: 'white', outline: 'none',
                  fontSize: '0.88rem'
                }}
              />
            </div>

          {/* Subject Filters + View Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
            {subjects.length > 2 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {subjects.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    style={{
                      padding: '0.45rem 1rem', borderRadius: '99px', fontSize: '0.78rem', fontWeight: 700,
                      cursor: 'pointer',
                      border: selectedSubject === sub ? '1px solid var(--violet)' : '1px solid var(--border)',
                      background: selectedSubject === sub ? 'var(--violet-soft)' : 'var(--bg-glass)',
                      color: selectedSubject === sub ? 'var(--violet)' : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {sub === 'Tous' ? 'Toutes les matières' : sub}
                  </button>
                ))}
              </div>
            )}

            {/* View mode toggle — always visible, pushed to the right */}
            <div style={{ display: 'flex', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px', gap: '2px', marginLeft: 'auto' }}>
              <button
                onClick={() => setLessonViewMode('list')}
                title="Vue liste"
                style={{
                  padding: '0.4rem 0.55rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: lessonViewMode === 'list' ? 'var(--violet)' : 'transparent',
                  color: lessonViewMode === 'list' ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', transition: 'all 0.18s ease'
                }}
              >
                <List size={15} />
              </button>
              <button
                onClick={() => setLessonViewMode('cards')}
                title="Vue cartes"
                style={{
                  padding: '0.4rem 0.55rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: lessonViewMode === 'cards' ? 'var(--violet)' : 'transparent',
                  color: lessonViewMode === 'cards' ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', transition: 'all 0.18s ease'
                }}
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>
          </div>

          {/* Document Type Tabs */}
          <div className="mobile-tabs-scroll" style={{ 
            display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', 
            paddingBottom: '0.25rem', margin: '0.5rem 0 1rem 0'
          }}>
            {[
              { id: 'all', label: 'Tous' },
              { id: 'course', label: '📖 Cours' },
              { id: 'ebook', label: '📚 E-Book' },
              { id: 'exercises', label: '📝 Séries d\'exercices' },
              { id: 'homework', label: '📑 Devoirs Surveillés' },
              { id: 'concours', label: '🏆 Concours' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none', border: 'none', 
                  borderBottom: activeTab === tab.id ? '2px solid var(--violet)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--violet)' : 'var(--text-muted)',
                  padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 800,
                  cursor: 'pointer', transition: 'all 0.2s', paddingBottom: '0.75rem',
                  marginBottom: '-5px'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Lessons List Grid */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.1)', borderTop: '3px solid var(--violet)', animation: 'spinLvl 1s linear infinite', marginBottom: '1rem' }} />
              <p>Chargement des fiches de cours...</p>
              <style>{`@keyframes spinLvl { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="glass-panel" style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <BookOpen size={48} style={{ margin: '0 auto 1rem', opacity: 0.25, display: 'block' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Aucune fiche de cours disponible</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '0.4rem', maxWidth: '380px', margin: '0.4rem auto 0' }}>
                {searchTerm || selectedSubject !== 'Tous'
                  ? 'Aucun cours ne correspond à vos filtres de recherche.'
                  : 'Les enseignants n\'ont pas encore publié de cours pour ce niveau scolaire.'
                }
              </p>
            </div>
          ) : activeTab === 'concours' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {filteredLessons.map((exam, idx) => {
                const qCount = exam.questions?.length || 0;
                const accent = selectedParent?.textColor || 'var(--violet)';
                const accentSoft = selectedParent?.bgSoft || 'rgba(99, 102, 241, 0.08)';

                return (
                  <div
                    key={exam.id}
                    className="exam-list-item"
                    style={{
                      borderLeft: `4px solid ${accent}`,
                      background: 'var(--bg-card)',
                      borderRadius: '12px',
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1.25rem',
                      border: '1px solid var(--border)',
                      borderLeftWidth: '4px',
                      borderLeftColor: accent,
                      transition: 'all 0.2s',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
                        background: accentSoft,
                        border: `1px solid ${accent}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', fontWeight: 900, color: accent,
                      }}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                          <h3 style={{ fontWeight: 700, fontSize: '0.97rem', margin: 0, color: 'var(--text-main)', lineHeight: 1.35 }}>
                            {exam.title}
                          </h3>

                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.76rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          {exam.year ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Clock size={11} /> {exam.year}
                            </span>
                          ) : null}
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <BookOpen size={11} /> {qCount} QCM
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <BrainCircuit size={11} /> Algorithme SRS
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="exam-actions-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        className="btn exam-action-btn srs-btn"
                        onClick={() => {
                           navigate(`/study?exam=${exam.examId}`, { state: { from: window.location.pathname } });
                        }}
                        title="Mode révision SRS"
                        style={{ 
                          fontWeight: 800,
                          background: accent,
                          boxShadow: `0 4px 12px ${accent}20`,
                          border: 'none',
                          color: '#fff',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          minHeight: '40px'
                        }}
                      >
                        <BrainCircuit size={14} /> SRS
                      </button>
                      
                      <button
                        className="btn-outline exam-action-btn blanc-btn"
                        onClick={() => {
                           navigate(`/exam?exam=${exam.examId}`, { state: { from: window.location.pathname } });
                        }}
                        title="Concours blanc chronométré"
                        style={{ 
                          fontWeight: 700,
                          border: '1.5px solid var(--border)',
                          color: 'var(--text-main)',
                          background: 'transparent',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          minHeight: '40px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = accent;
                          e.currentTarget.style.color = accent;
                          e.currentTarget.style.background = `${accent}0a`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text-main)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Play size={14} /> Blanc
                      </button>

                      <div style={{ height: '20px', width: '1px', background: 'var(--border)', margin: '0 0.25rem' }} />

                      <button
                        className="btn-outline exam-action-btn sujet-btn"
                        onClick={() => {
                           if (typeof trackDownload === 'function') {
                            trackDownload({ type: 'sujet', id: exam.examId, title: `${exam.title} - Sujet` });
                          }
                          handlePrintExam(exam, 'sujet');
                        }}
                        title="Voir le sujet de l'examen"
                        style={{ 
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-glass)',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          minHeight: '40px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = accent;
                          e.currentTarget.style.color = accent;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <FileDown size={13} /> Sujet
                      </button>
      
                      <button
                        className="btn-outline exam-action-btn corrige-btn"
                        onClick={() => {
                           if (typeof trackDownload === 'function') {
                            trackDownload({ type: 'corrige', id: exam.examId, title: `${exam.title} - Corrigé` });
                          }
                          handlePrintExam(exam, 'corrige');
                        }}
                        title="Voir le corrigé de l'examen"
                        style={{ 
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-glass)',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          minHeight: '40px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = accent;
                          e.currentTarget.style.color = accent;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <FileDown size={13} /> Corrigé
                      </button>
      
                      <button
                        className="btn-outline exam-action-btn grille-btn"
                        onClick={() => {
                           if (typeof trackDownload === 'function') {
                            trackDownload({ type: 'grille', id: exam.examId, title: `${exam.title} - Grille OMR` });
                          }
                          handleDownloadPDF(exam);
                        }}
                        title="Télécharger la grille de réponse OMR"
                        style={{ 
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-glass)',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          minHeight: '40px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = accent;
                          e.currentTarget.style.color = accent;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <FileDown size={13} /> Grille
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ──── LESSONS GRID / LIST ──── */
            lessonViewMode === 'list' ? (
              /* ──── LIST VIEW ──── */
              <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fiche de Cours</th>
                      <th style={{ padding: '0.9rem 1rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Type</th>
                      <th style={{ padding: '0.9rem 1rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enseignant</th>
                      <th style={{ padding: '0.9rem 1rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date</th>
                      <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLessons.map((l) => {
                      const accent = selectedParent?.textColor || 'var(--violet)';
                      const docTypeColor = l.docType === 'homework' ? 'var(--danger)' : l.docType === 'exercises' ? 'var(--warning)' : l.docType === 'concours' ? 'var(--emerald)' : l.docType === 'ebook' ? '#0284c7' : '#3B82F6';
                      const docTypeBg = l.docType === 'homework' ? 'rgba(239,68,68,0.09)' : l.docType === 'exercises' ? 'rgba(245,158,11,0.09)' : l.docType === 'concours' ? 'rgba(16,185,129,0.09)' : l.docType === 'ebook' ? 'rgba(2,132,199,0.12)' : 'rgba(59,130,246,0.09)';
                      const docTypeLabel = l.docType === 'homework' ? 'Devoir surveillé' : l.docType === 'exercises' ? "Série d'exercices" : l.docType === 'concours' ? 'Concours' : l.docType === 'ebook' ? 'E-Book' : 'Cours';
                      const createdAt = l.createdAt ? new Date(l.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
                      return (
                        <tr
                          key={l.id}
                          className="table-row-hover"
                          style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                          onClick={() => l.isExam ? navigate(`/study?exam=${l.examId}`) : navigate(`/admin/lessons/${l.id}`, { state: { from: window.location.pathname + window.location.search } })}
                        >
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                              <div style={{ width: 34, height: 34, borderRadius: '8px', flexShrink: 0, background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
                                <BookOpen size={14} />
                              </div>
                              <span style={{ fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.35, letterSpacing: '-0.01em', color: 'var(--text-main)', cursor: 'pointer' }}>
                                {l.title}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1rem' }}>
                            <span style={{ background: docTypeBg, color: docTypeColor, padding: '0.22rem 0.65rem', borderRadius: '20px', fontSize: '0.71rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {docTypeLabel}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                              <User size={11} />
                              <span>{l.teacher || "Prof. L'CONQ"}</span>
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1rem' }}>
                            {createdAt ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.73rem', color: 'var(--text-subtle)' }}>
                                <Calendar size={11} style={{ color: accent, opacity: 0.8 }} />
                                <span>{createdAt}</span>
                              </div>
                            ) : <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>—</span>}
                          </td>
                          <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700, color: accent, fontSize: '0.78rem', cursor: 'pointer' }}>
                              {l.isExam ? 'Commencer' : 'Ouvrir le cours'} <ChevronRight size={13} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: '1.5rem'
            }}>
              {filteredLessons.map((l) => {
                return (
                  <div
                    key={l.id}
                    onClick={() => {
                       if (l.isExam) {
                        navigate(`/study?exam=${l.examId}`, { state: { from: window.location.pathname + window.location.search } });
                      } else {
                        navigate(`/admin/lessons/${l.id}`, { state: { from: window.location.pathname + window.location.search } });
                      }
                    }}
                    className="glass-panel"
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-glass)',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--border-hover)';
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--bg-glass)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ 
                          background: l.subject === 'Physique' || l.subject === 'Chimie' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                          color: l.subject === 'Physique' || l.subject === 'Chimie' ? 'var(--emerald)' : 'var(--violet)',
                          padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800
                        }}>
                          {l.subject}
                        </span>

                        <span style={{ 
                          background: l.docType === 'homework' ? 'rgba(239, 68, 68, 0.08)' : l.docType === 'exercises' ? 'rgba(245, 158, 11, 0.08)' : l.docType === 'concours' ? 'rgba(16, 185, 129, 0.08)' : l.docType === 'ebook' ? 'rgba(2, 132, 199, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                          color: l.docType === 'homework' ? 'var(--danger)' : l.docType === 'exercises' ? 'var(--warning)' : l.docType === 'concours' ? 'var(--emerald)' : l.docType === 'ebook' ? '#0284c7' : '#3B82F6',
                          padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800
                        }}>
                          {l.docType === 'homework' ? 'Devoir surveillé' : l.docType === 'exercises' ? 'Série d\'exercices' : l.docType === 'concours' ? 'Concours' : l.docType === 'ebook' ? 'E-Book' : 'Cours'}
                        </span>
                      </div>
                      

                    </div>

                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', lineHeight: 1.45 }}>
                      {renderWithMath(l.title)}
                    </h3>

                    <div style={{ 
                      marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: '0.75rem', color: 'var(--text-subtle)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <User size={13} />
                        <span>{l.teacher || 'Prof. L\'CONQ'}</span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 700, color: selectedParent?.textColor || 'var(--violet)' }}>
                        {l.isExam ? "Commencer le concours" : "Ouvrir le cours"} <ChevronRight size={13} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )
          )}

        </div>
      )}

    </div>
  );
}
