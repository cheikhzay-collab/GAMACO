import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const hasArabic = (str) => /[\u0600-\u06FF]/.test(str || '');
import {
  ArrowLeft, Save, FileText, Image, BrainCircuit,
  CheckCircle2, Lightbulb, Zap, Upload, Trash2,
  Plus, Eye, Lock, Unlock, AlertCircle,
  ChevronLeft, ChevronRight, X, Layers, Download, FileUp,
  ChevronUp, ChevronDown, Sparkles, Shuffle
} from 'lucide-react';
import { renderWithMath } from '../utils/mathRenderer';
import { uploadAsset } from '../services/storageService';
import { getExamQuestionsOnly, addExam } from '../services/examService';
import { getLevelDisplayName, mapLegacySchoolToLevel } from '../utils/levelHelpers';
import ExamVariantModal from '../components/ExamVariantModal';

/* ─────────────────────────────────────────────────────────────
   Tiny LaTeX toolbar
───────────────────────────────────────────────────────────── */
const LATEX_SYMBOLS = [
  { label: '½', latex: '\\frac{a}{b}' },
  { label: '√', latex: '\\sqrt{x}' },
  { label: 'lim', latex: '\\lim_{n \\to +\\infty}' },
  { label: 'Σ', latex: '\\sum_{k=1}^{n}' },
  { label: '∫', latex: '\\int_{a}^{b}' },
  { label: 'α', latex: '\\alpha' },
  { label: 'β', latex: '\\beta' },
  { label: 'π', latex: '\\pi' },
  { label: '∞', latex: '\\infty' },
  { label: 'x²', latex: 'x^{2}' },
  { label: 'xₙ', latex: 'x_{n}' },
  { label: '±', latex: '\\pm' },
];

function LatexToolbar({ onInsert }) {
  return (
    <div style={{
      display: 'flex', gap: 4, flexWrap: 'wrap',
      background: 'var(--bg-hover)', padding: '5px 6px',
      borderRadius: 8, border: '1px solid var(--border)',
      marginBottom: '0.4rem'
    }}>
      {LATEX_SYMBOLS.map(sym => (
        <button
          key={sym.label}
          type="button"
          onClick={() => onInsert(sym.latex)}
          title={sym.latex}
          style={{
            padding: '0.18rem 0.48rem', fontSize: '0.7rem',
            borderRadius: 5, border: '1px solid var(--border)',
            background: 'var(--bg-glass)', color: 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            transition: 'all 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-main)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-glass)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          {sym.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Live card preview (mini flashcard)
───────────────────────────────────────────────────────────── */
function CardPreview({ question, side, onFlip }) {
  if (!question) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 8 }}>
      <Eye size={28} style={{ opacity: 0.3 }} />
      <span style={{ fontSize: '0.8rem' }}>Sélectionnez une question</span>
    </div>
  );

  const q = question;
  const isQuestionArabic = q && (
    hasArabic(q.question) ||
    hasArabic(q.context) ||
    (q.options || []).some(o => hasArabic(typeof o === 'string' ? o : o.text))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Flip toggle */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-hover)', padding: 4, borderRadius: 10, border: '1px solid var(--border)', marginBottom: '0.85rem', flexShrink: 0 }}>
        {['front', 'back'].map(s => (
          <button key={s} type="button" onClick={() => onFlip(s)} style={{
            flex: 1, padding: '0.35rem 0.6rem', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: side === s ? 'linear-gradient(135deg, var(--violet), #6366f1)' : 'transparent',
            color: side === s ? '#fff' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.72rem', transition: 'all 0.25s',
            boxShadow: side === s ? '0 2px 10px rgba(99,102,241,0.3)' : 'none'
          }}>
            {s === 'front' ? 'Recto (Question)' : 'Verso (Corrigé)'}
          </button>
        ))}
      </div>

      {/* Card */}
      <div style={{
        flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '1.1rem', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column'
      }}>
        {side === 'front' ? (
          <>
            {/* Topic badge */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem',
              fontWeight: 800, padding: '0.22rem 0.55rem', borderRadius: 6,
              background: 'var(--violet-soft)', color: 'var(--violet)', marginBottom: '0.7rem', alignSelf: 'flex-start'
            }}>
              <BrainCircuit size={9} /> {q.topic || q.subject || 'Général'}
            </span>

            {/* Context Box */}
            {q.context && (
              <div style={{
                padding: '0.5rem 0.75rem',
                borderLeft: isQuestionArabic ? 'none' : '3px solid var(--violet)',
                borderRight: isQuestionArabic ? '3px solid var(--violet)' : 'none',
                background: 'var(--bg-glass)',
                borderRadius: isQuestionArabic ? '8px 0 0 8px' : '0 8px 8px 0',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '0.8rem',
                lineHeight: 1.5,
                direction: isQuestionArabic ? 'rtl' : 'ltr',
                textAlign: isQuestionArabic ? 'right' : 'left',
                fontFamily: isQuestionArabic ? "'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif" : 'inherit'
              }}>
                <span style={{ fontWeight: 800, display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>Contexte / Énoncé commun</span>
                {renderWithMath(q.context)}
                {(q.imagePosition === 'in_context' || q.imagePosition === 'context') && (() => {
                  const sizeH = {
                    small: 90,
                    medium: 150,
                    large: 220,
                    xlarge: 320
                  }[q.imageSize || 'medium'];
                  return q.image && (
                    <div style={{
                      borderRadius: 10, overflow: 'hidden',
                      border: { transparent: 'none', white: '1px solid #e2e8f0', dark: '1px solid rgba(255,255,255,0.08)' }[q.imageBg || 'transparent'],
                      background: { transparent: 'transparent', white: '#ffffff', dark: '#121214' }[q.imageBg || 'transparent'],
                      padding: q.imageBg === 'transparent' ? 0 : '0.4rem', 
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      flexShrink: 0, height: sizeH, width: '100%', marginTop: '0.6rem'
                    }}>
                      {q.image.startsWith('svg:') ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: q.image.slice(4) }} />
                      ) : (
                        <img src={q.image} alt="Figure" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {(() => {
              const pos = q.imagePosition || 'below_statement';
              const sizeH = {
                small: 90,
                medium: 150,
                large: 220,
                xlarge: 320
              }[q.imageSize || 'medium'];

              const showOnFront = pos !== 'in_context' && pos !== 'context' && pos !== 'in_correction' && pos !== 'below_options';

              const imageEl = q.image && showOnFront && (
                <div style={{
                  borderRadius: 10, overflow: 'hidden',
                  border: {
                    transparent: 'none',
                    white: '1px solid #e2e8f0',
                    dark: '1px solid rgba(255,255,255,0.08)'
                  }[q.imageBg || 'transparent'],
                  background: {
                    transparent: 'transparent',
                    white: '#ffffff',
                    dark: '#121214'
                  }[q.imageBg || 'transparent'],
                  padding: q.imageBg === 'transparent' ? 0 : '0.4rem', 
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  flexShrink: 0, height: sizeH, width: pos === 'side_by_side' ? '40%' : '100%',
                  marginBottom: pos === 'side_by_side' ? 0 : '0.85rem',
                  marginTop: pos === 'below_statement' ? '0.85rem' : 0
                }}>
                  {q.image.startsWith('svg:') ? (
                    <div 
                      style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }} 
                      dangerouslySetInnerHTML={{ __html: q.image.slice(4) }} 
                    />
                  ) : (
                    <img src={q.image} alt="Figure" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  )}
                </div>
              );

              const questionEl = (
                <div style={{
                  fontSize: '0.9rem',
                  lineHeight: 1.55,
                  fontWeight: 500,
                  flex: 1,
                  fontFamily: isQuestionArabic ? "'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif" : 'inherit',
                  direction: isQuestionArabic ? 'rtl' : 'ltr',
                  textAlign: isQuestionArabic ? 'right' : 'left'
                }}>
                  {renderWithMath(q.question || '...')}
                </div>
              );

              if (pos === 'side_by_side' && q.image) {
                return (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.8rem' }}>
                    {questionEl}
                    {imageEl}
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '0.8rem' }}>
                  {pos === 'above_statement' && imageEl}
                  {questionEl}
                  {pos === 'below_statement' && imageEl}
                </div>
              );
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: 'auto' }}>
              {(q.options || []).map((opt, idx) => {
                const isStr = typeof opt === 'string';
                const optId = isStr ? ['A','B','C','D','E'][idx] : opt.id;
                const optText = isStr ? opt : (opt.text || '');
                const isCorrect = q.correct_answer === optId;
                 return (
                  <div key={optId} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '0.38rem 0.6rem', borderRadius: 8,
                    background: isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isCorrect ? 'var(--emerald)' : 'var(--border)'}`,
                    fontSize: '0.78rem', fontWeight: isCorrect ? 700 : 400,
                    color: isCorrect ? 'var(--emerald)' : 'var(--text-main)',
                    direction: isQuestionArabic ? 'rtl' : 'ltr',
                    textAlign: isQuestionArabic ? 'right' : 'left',
                    fontFamily: isQuestionArabic ? "'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif" : 'inherit'
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontWeight: 900, fontSize: '0.7rem', flexShrink: 0,
                      background: isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isCorrect ? 'var(--emerald)' : 'var(--border)'}`,
                    }}>{optId}</span>
                    {renderWithMath(optText || '...')}
                  </div>
                );
              })}
            </div>
            {q.imagePosition === 'below_options' && (() => {
              const sizeH = {
                small: 90,
                medium: 150,
                large: 220,
                xlarge: 320
              }[q.imageSize || 'medium'];
              return q.image && (
                <div style={{
                  borderRadius: 10, overflow: 'hidden',
                  border: { transparent: 'none', white: '1px solid #e2e8f0', dark: '1px solid rgba(255,255,255,0.08)' }[q.imageBg || 'transparent'],
                  background: { transparent: 'transparent', white: '#ffffff', dark: '#121214' }[q.imageBg || 'transparent'],
                  padding: q.imageBg === 'transparent' ? 0 : '0.4rem', 
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  flexShrink: 0, height: sizeH, width: '100%', marginTop: '0.85rem'
                }}>
                  {q.image.startsWith('svg:') ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: q.image.slice(4) }} />
                  ) : (
                    <img src={q.image} alt="Figure" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 0.7rem',
              background: 'rgba(16,185,129,0.08)', border: '1px solid var(--emerald)',
              borderRadius: 8, marginBottom: '0.75rem', color: 'var(--emerald)', fontSize: '0.8rem', fontWeight: 700
            }}>
              <CheckCircle2 size={14} /> Réponse : <strong>{q.correct_answer || '—'}</strong>
            </div>
            <div style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              marginBottom: '0.75rem',
              lineHeight: 1.5,
              direction: isQuestionArabic ? 'rtl' : 'ltr',
              textAlign: isQuestionArabic ? 'right' : 'left',
              fontFamily: isQuestionArabic ? "'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif" : 'inherit'
            }}>
              {renderWithMath(q.question || '')}
            </div>
            {q.astuce && (
              <div style={{ marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--violet)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lightbulb size={10} /> Astuce
                </div>
                 <div style={{
                  fontSize: '0.78rem',
                  padding: '0.4rem 0.6rem',
                  borderLeft: isQuestionArabic ? 'none' : '2px solid var(--violet)',
                  borderRight: isQuestionArabic ? '2px solid var(--violet)' : 'none',
                  background: 'rgba(124,58,237,0.05)',
                  borderRadius: isQuestionArabic ? '6px 0 0 6px' : '0 6px 6px 0',
                  direction: isQuestionArabic ? 'rtl' : 'ltr',
                  textAlign: isQuestionArabic ? 'right' : 'left',
                  fontFamily: isQuestionArabic ? "'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif" : 'inherit'
                }}>
                  {renderWithMath(q.astuce)}
                  {q.imagePosition === 'in_correction' && (() => {
                    const sizeH = {
                      small: 90,
                      medium: 150,
                      large: 220,
                      xlarge: 320
                    }[q.imageSize || 'medium'];
                    return q.image && (
                      <div style={{
                        borderRadius: 10, overflow: 'hidden',
                        border: { transparent: 'none', white: '1px solid #e2e8f0', dark: '1px solid rgba(255,255,255,0.08)' }[q.imageBg || 'transparent'],
                        background: { transparent: 'transparent', white: '#ffffff', dark: '#121214' }[q.imageBg || 'transparent'],
                        padding: q.imageBg === 'transparent' ? 0 : '0.4rem', 
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        flexShrink: 0, height: sizeH, width: '100%', marginTop: '0.6rem'
                      }}>
                        {q.image.startsWith('svg:') ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: q.image.slice(4) }} />
                        ) : (
                          <img src={q.image} alt="Figure" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
            {q.trick && (
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--emerald)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={10} /> Trick
                </div>
                 <div style={{
                  fontSize: '0.78rem',
                  padding: '0.4rem 0.6rem',
                  borderLeft: isQuestionArabic ? 'none' : '2px solid var(--emerald)',
                  borderRight: isQuestionArabic ? '2px solid var(--emerald)' : 'none',
                  background: 'rgba(16,185,129,0.05)',
                  borderRadius: isQuestionArabic ? '6px 0 0 6px' : '0 6px 6px 0',
                  direction: isQuestionArabic ? 'rtl' : 'ltr',
                  textAlign: isQuestionArabic ? 'right' : 'left',
                  fontFamily: isQuestionArabic ? "'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif" : 'inherit'
                }}>
                  {renderWithMath(q.trick)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────── */
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

export default function AdminExamEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { exams, updateExamDetails, schools } = useAuth();
  const isMobile = useIsMobile();

  const goBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }
    navigate('/admin/exams');
  };

  const exam = useMemo(() => exams.find(e => e.id === id), [exams, id]);

  const [activeTab, setActiveTab] = useState('details');    // 'details' | 'questions'
  const [localQuestions, setLocalQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [previewSide, setPreviewSide] = useState('front');
  const [saved, setSaved] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isGeneratingAiFigure, setIsGeneratingAiFigure] = useState(false);

  const [editName, setEditName] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editTier, setEditTier] = useState('freemium');
  const [showVariantModal, setShowVariantModal] = useState(false);

  // Stable exam ID for effect dependency
  const examId = exam?.id;

  // CSV state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows]     = useState([]);   // parsed rows awaiting confirmation
  const [importMode, setImportMode]     = useState('merge');  // 'merge' | 'replace'
  const [importError, setImportError]   = useState('');

  // Sync metadata fields (name, school, year, tier) whenever exam object changes
  useEffect(() => {
    if (!exam) return;
    setEditName(prev => prev === exam.name ? prev : (exam.name || ''));
    setEditSchool(prev => prev === exam.school ? prev : (exam.school || ''));
    setEditLevel(prev => prev === exam.level ? prev : (exam.level || mapLegacySchoolToLevel(exam.school) || ''));
    setEditYear(prev => prev === exam.year ? prev : (exam.year || ''));
    setEditTier(prev => prev === exam.tier ? prev : (exam.tier || 'freemium'));
  }, [exam]);

  // Load questions once per exam.
  // getAllExams() fetches from exams_metadata view which has NO questions column.
  // We must fetch questions separately from the exams table when they are absent.
  useEffect(() => {
    if (!examId) return;
    if (exam && exam.questions && exam.questions.length > 0) {
      // Questions already in context (local/offline mode or previously merged)
      setLocalQuestions(prev => {
        const next = exam.questions;
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      return;
    }
    // Questions not in context — fetch directly from the exams table
    setQuestionsLoading(true);
    getExamQuestionsOnly(examId)
      .then(questions => {
        setLocalQuestions(questions || []);
      })
      .catch(e => {
        console.error('[AdminExamEdit] Failed to load exam questions:', e);
        setLocalQuestions([]);
      })
      .finally(() => {
        setQuestionsLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  if (!exam) {
    return (
      <div style={{ maxWidth: 600, margin: '6rem auto', textAlign: 'center', padding: '2rem' }}>
        <AlertCircle size={48} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
        <h2 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Concours introuvable</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>L'identifiant fourni ne correspond à aucun concours.</p>
        <button onClick={goBack} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Retour à la bibliothèque
        </button>
      </div>
    );
  }

  /* ── helpers ── */
  const markDirty = () => { setHasUnsaved(true); setSaved(false); };

  const handleSave = () => {
    // Safety guard: never save an empty questions array while questions are still
    // being fetched from the DB. This prevents accidental data loss.
    if (questionsLoading) {
      alert('Les questions sont en cours de chargement. Veuillez patienter quelques secondes avant de sauvegarder.');
      return;
    }
    updateExamDetails(exam.id, {
      name: editName,
      school: getLevelDisplayName(editLevel),
      level: editLevel,
      year: editYear,
      tier: editTier,
      questions: localQuestions,
    });
    setHasUnsaved(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleGenerateModelBVariant = async () => {
    if (!localQuestions || localQuestions.length === 0) {
      alert("لا توجد أسئلة لتوليد النموذج B");
      return;
    }

    const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);

    const shuffledQuestions = shuffleArray(localQuestions).map((q, idx) => {
      let options = Array.isArray(q.options) ? [...q.options] : [];
      const origExpected = (q.correct_answer || q.expected_answer || 'A').toUpperCase();

      let correctContent = '';
      if (options.length > 0) {
        if (typeof options[0] === 'string') {
          const letterIdx = origExpected.charCodeAt(0) - 65;
          correctContent = options[letterIdx] || options[0];
          options = shuffleArray(options);
        } else {
          const matchOpt = options.find(o => o.id === origExpected);
          if (matchOpt) correctContent = matchOpt.text;
          options = shuffleArray(options);
        }
      }

      let newExpected = 'A';
      const formattedOptions = options.map((opt, oIdx) => {
        const newLetter = String.fromCharCode(65 + oIdx);
        const optText = typeof opt === 'string' ? opt : opt.text;
        if (optText === correctContent) {
          newExpected = newLetter;
        }
        return { id: newLetter, text: optText };
      });

      return {
        ...q,
        id: `q_b_${Date.now()}_${idx}`,
        question_idx: idx + 1,
        options: formattedOptions,
        correct_answer: newExpected,
        expected_answer: newExpected
      };
    });

    const modelBExam = {
      name: `${editName || exam.name} (Modèle B - Anti-Triche)`,
      school: getLevelDisplayName(editLevel),
      level: editLevel,
      year: editYear,
      tier: editTier,
      questions: shuffledQuestions,
      dateAdded: new Date().toISOString()
    };

    try {
      await addExam(modelBExam);
      alert(`✅ تم إنشاء وتخزين النموذج البداغوجي الموازي (Modèle B) بنجاح!\nتم خلط ${shuffledQuestions.length} سؤالاً وتحديث إجابات الماسح الضوئي OMR تلقائياً.`);
      navigate('/admin/exams');
    } catch (err) {
      alert("خطأ أثناء إنشاء النموذج B: " + err.message);
    }
  };


  const updateQField = (idx, field, value) => {
    setLocalQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
    markDirty();
  };

  const updateQOption = (qIdx, optId, text, optIdx) => {
    setLocalQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = (q.options || []).map((opt, oi) => {
        if (typeof opt === 'string') return oi === optIdx ? text : opt;
        return opt.id === optId ? { ...opt, text } : opt;
      });
      return { ...q, options: opts };
    }));
    markDirty();
  };

  const handleGenerateFigureWithAi = async () => {
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
      alert("Clé API Gemini manquante. Veuillez configurer votre clé API dans les Paramètres de l'importateur IA ou dans l'application.");
      return;
    }

    setIsGeneratingAiFigure(true);

    try {
      let rawModel = (localStorage.getItem('geminiModel') || '').trim();
      if (!rawModel || ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', '3.7', '3.5'].includes(rawModel)) {
        rawModel = 'gemini-3.1-flash-lite';
      }
      const model = rawModel;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const prompt = `Tu es un expert en conception de figures scientifiques vectorielles en SVG pour des QCM de mathématiques, physique et chimie.
Voici la question pour laquelle tu dois concevoir une figure/illustration :
Sujet/Thème: ${q.topic || q.subject || 'Général'}
Énoncé: ${q.question}
Options possibles: ${q.options.map(opt => typeof opt === 'string' ? opt : opt.id + ') ' + opt.text).join(' | ')}
Explication: ${q.astuce || ''}

Tu dois analyser la question et :
1. Déterminer si la question nécessite RÉELLEMENT une figure scientifique (comme un graphe de courbe, un schéma de montage électrique, ou une figure géométrique). Si la question est purement textuelle ou calculatoire (sans référence à des courbes, circuits ou géométrie spécifique), tu dois renvoyer STRICTEMENT et UNIQUEMENT le texte : "NO_ILLUSTRATION_REQUIRED" (sans aucun autre texte autour).
2. Ne génère JAMAIS d'illustrations symboliques, décoratives ou hors-sujet (comme un chapeau de diplômé, une ampoule d'idée, ou un logo abstrait).
3. Si une figure scientifique est nécessaire, génère uniquement le code SVG brut de celle-ci (sans texte d'introduction/conclusion, et sans bloc de code markdown). Les dimensions doivent être adaptées, utilise viewBox="0 0 400 240" ou similaire.
4. IMPORTANT: Pour le texte, les axes et les grilles du SVG, utilise stroke="currentColor" et fill="currentColor" (ainsi ils s'adapteront automatiquement au mode sombre et clair du site). Pour les courbes et éléments physiques importants, utilise des couleurs vives (ex: #7c3aed, #10b981, #f59e0b).`;

      const payload = {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1
        }
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || ("Erreur API Gemini " + res.status));
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const nonThoughtParts = candidate?.content?.parts?.filter(p => !p.thought) || [];
      let rawSvg = (nonThoughtParts.length > 0 ? nonThoughtParts : (candidate?.content?.parts || []))
        .map(p => p.text || '')
        .join('');
      if (!rawSvg) {
        throw new Error("Aucun contenu généré.");
      }

      rawSvg = rawSvg.trim();
      
      // Check if AI determined that no illustration is required
      if (rawSvg.toUpperCase().includes("NO_ILLUSTRATION_REQUIRED")) {
        alert("Cette question n'a pas besoin de figure d'après l'analyse de l'IA (question textuelle/calculatoire simple).");
        setIsGeneratingAiFigure(false);
        return;
      }

      // Clean up any markdown blocks if generated
      if (rawSvg.startsWith('```')) {
        rawSvg = rawSvg.replace(/^```(?:xml|svg|html)?\s*/i, '').replace(/```\s*$/i, '').trim();
      }

      // Ensure it starts with <svg
      const svgStart = rawSvg.indexOf('<svg');
      if (svgStart === -1) {
        throw new Error("L'IA n'a pas retourné de code SVG valide. Veuillez réessayer.");
      }
      rawSvg = rawSvg.slice(svgStart);

      // Update the question's image property with the svg: prefix
      updateQField(selectedIdx, 'image', 'svg:' + rawSvg);
      updateQField(selectedIdx, 'imagePosition', 'below_statement');
      updateQField(selectedIdx, 'imageSize', 'large');
      updateQField(selectedIdx, 'imageBg', 'transparent');
      
    } catch (err) {
      alert("Erreur lors de la génération de la figure : " + err.message);
    } finally {
      setIsGeneratingAiFigure(false);
    }
  };

  const insertLatex = (textareaId, latex, field) => {
    const ta = document.getElementById(textareaId);
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const val = `$${latex}$`;
    const next = ta.value.substring(0, s) + val + ta.value.substring(e);
    updateQField(selectedIdx, field, next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + val.length, s + val.length); }, 30);
  };

  /* ── CSV EXPORT ── */
  const handleExportCSV = () => {
    const esc = (v = '') => {
      const s = String(v).replace(/"/g, '""');
      return /[,"\n\r]/.test(s) ? `"${s}"` : s;
    };
    const header = ['Question','Topic','OptionA','OptionB','OptionC','OptionD','OptionE','ReponseCorrecte','Astuce','Trick'];
    const rows = localQuestions.map(q => {
      const opts = (q.options || []).map((o) => typeof o === 'string' ? o : (o.text || ''));
      return [
        esc(q.question || ''),
        esc(q.topic || q.subject || ''),
        esc(opts[0] || ''), esc(opts[1] || ''), esc(opts[2] || ''), esc(opts[3] || ''), esc(opts[4] || ''),
        esc(q.correct_answer || ''),
        esc(q.astuce || ''),
        esc(q.trick || ''),
      ];
    });
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(editName || exam.name).replace(/\s+/g,'_')}_${exam.year || ''}_questions.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ── CSV IMPORT PARSE ── */
  const handleFileSelect = (e) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        // Simple CSV parser (handles quoted fields with commas/newlines)
        const parseCSV = (str) => {
          const rows = [];
          let row = [], field = '', inQuote = false;
          for (let i = 0; i < str.length; i++) {
            const ch = str[i], next = str[i+1];
            if (inQuote) {
              if (ch === '"' && next === '"') { field += '"'; i++; }
              else if (ch === '"') { inQuote = false; }
              else { field += ch; }
            } else {
              if (ch === '"') { inQuote = true; }
              else if (ch === ',') { row.push(field.trim()); field = ''; }
              else if (ch === '\n' || (ch === '\r' && next === '\n')) {
                row.push(field.trim()); rows.push(row); row = []; field = '';
                if (ch === '\r') i++;
              } else { field += ch; }
            }
          }
          if (field || row.length) { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); }
          return rows;
        };
        const rows = parseCSV(text);
        if (rows.length < 2) { setImportError('Le fichier CSV est vide ou invalide.'); return; }
        const header = rows[0].map(h => h.toLowerCase().trim());
        // Map column names flexibly
        const col = (names) => { for (const n of names) { const i = header.indexOf(n); if (i !== -1) return i; } return -1; };
        const iQuestion  = col(['question','énoncé','enonce','q']);
        const iTopic     = col(['topic','sujet','subject','domaine','th\u00e8me','theme']);
        const iOptA      = col(['optiona','option a','opt_a','choix_a','a']);
        const iOptB      = col(['optionb','option b','opt_b','choix_b','b']);
        const iOptC      = col(['optionc','option c','opt_c','choix_c','c']);
        const iOptD      = col(['optiond','option d','opt_d','choix_d','d']);
        const iOptE      = col(['optione','option e','opt_e','choix_e','e']);
        const iCorrect   = col(['reponsecorrecte','correct_answer','reponse','r\u00e9ponse','correct','answer']);
        const iAstuce    = col(['astuce','explication','hint']);
        const iTrick     = col(['trick','raccourci','shortcut']);
        if (iQuestion === -1) { setImportError('Colonne "Question" introuvable dans le fichier.'); return; }
        const parsed = rows.slice(1).filter(r => r.some(Boolean)).map((r, idx) => {
          const getOpt = (i, letter) => i === -1 ? null : (r[i] || '').trim() ? { id: letter, text: r[i].trim() } : null;
          const options = [getOpt(iOptA,'A'), getOpt(iOptB,'B'), getOpt(iOptC,'C'), getOpt(iOptD,'D'), getOpt(iOptE,'E')].filter(Boolean);
          return {
            id: `csv-${Date.now()}-${idx}`,
            question: iQuestion >= 0 ? (r[iQuestion] || '').trim() : '',
            topic:    iTopic    >= 0 ? (r[iTopic]    || '').trim() : '',
            options,
            correct_answer: iCorrect >= 0 ? (r[iCorrect] || '').trim().toUpperCase() : '',
            astuce: iAstuce >= 0 ? (r[iAstuce] || '').trim() : '',
            trick:  iTrick  >= 0 ? (r[iTrick]  || '').trim() : '',
          };
        });
        if (parsed.length === 0) { setImportError('Aucune ligne de données trouvée.'); return; }
        setImportRows(parsed);
        setShowImportModal(true);
      } catch (err) {
        setImportError('Erreur de lecture du fichier: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
    // Reset input
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    setLocalQuestions(prev => importMode === 'replace' ? importRows : [...prev, ...importRows]);
    markDirty();
    setShowImportModal(false);
    setImportRows([]);
    setSelectedIdx(0);
    setActiveTab('questions');
  };

  const handleAddQuestion = () => {
    const newQ = {
      id: `manual-${Date.now()}`,
      question: '',
      topic: '',
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
        { id: 'E', text: '' }
      ],
      correct_answer: 'A',
      astuce: '',
      trick: '',
      image: null
    };
    setLocalQuestions(prev => [...prev, newQ]);
    setSelectedIdx(localQuestions.length);
    markDirty();
    setActiveTab('questions');
  };

  const handleDeleteQuestion = (idx) => {
    if (localQuestions.length <= 1) {
      alert("Un concours doit contenir au moins une question.");
      return;
    }
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la question ${idx + 1} ?`)) {
      setLocalQuestions(prev => prev.filter((_, i) => i !== idx));
      setSelectedIdx(prev => Math.max(0, prev - 1));
      markDirty();
    }
  };

  const handleMoveQuestion = (idx, direction) => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === localQuestions.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    setLocalQuestions(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
    setSelectedIdx(targetIdx);
    markDirty();
  };

  const q = localQuestions[selectedIdx];

  /* ───────────────── RENDER ───────────────── */
  return (
    <>
    <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', height: isMobile ? 'auto' : 'calc(100vh - 80px)', minHeight: isMobile ? 'auto' : 600 }}>

      {/* ══ Top header bar ══════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 0 1.25rem 0', borderBottom: '1px solid var(--border)',
        flexShrink: 0, flexWrap: 'wrap', gap: '0.75rem'
      }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="button"
            onClick={goBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.45rem 0.85rem', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--bg-glass)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem',
              fontWeight: 600, transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <ArrowLeft size={14} /> Bibliothèque
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: isMobile ? '1.15rem' : '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
                {editName || exam.name}
              </h1>
              <span style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '0.15rem 0.55rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                🏛️ وضع تعديل الامتحانات
              </span>
              {hasUnsaved && (
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--warning)', background: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.45rem', borderRadius: 6, border: '1px solid rgba(245,158,11,0.25)' }}>
                  ● Non sauvegardé
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
              {exam.school}{exam.year ? ` · ${exam.year}` : ''} · {localQuestions.length} questions • Édition interactive QCM, astuces et figures
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--emerald)', fontWeight: 700 }}>
              <CheckCircle2 size={14} /> Sauvegardé !
            </span>
          )}

          {/* Separator */}
          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 0.15rem' }} />

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={localQuestions.length === 0}
            title={`Exporter ${localQuestions.length} questions en CSV`}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '0.5rem 0.95rem', borderRadius: 9,
              border: '1px solid rgba(16,185,129,0.35)',
              background: 'rgba(16,185,129,0.08)',
              color: localQuestions.length === 0 ? 'var(--text-muted)' : 'var(--emerald)',
              cursor: localQuestions.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem', fontWeight: 700, transition: 'all 0.2s',
              opacity: localQuestions.length === 0 ? 0.45 : 1
            }}
          >
            <Download size={13} /> Export CSV
          </button>

          {/* Import CSV */}
          <label
            htmlFor="csv-import-input"
            title="Importer des questions depuis un fichier CSV"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '0.5rem 0.95rem', borderRadius: 9,
              border: '1px solid rgba(124,58,237,0.35)',
              background: 'rgba(124,58,237,0.08)',
              color: 'var(--violet)',
              cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 700, transition: 'all 0.2s',
              userSelect: 'none'
            }}
          >
            <FileUp size={13} /> Import CSV
          </label>
          <input
            id="csv-import-input"
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          {importError && (
            <span style={{ fontSize: '0.75rem', color: 'var(--danger)', maxWidth: 180 }}>{importError}</span>
          )}

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 0.15rem' }} />

          <button
            type="button"
            onClick={() => navigate('/admin/exams')}
            className="btn-ghost"
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', borderRadius: 10 }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 1.4rem', fontSize: '0.85rem', borderRadius: 10 }}
          >
            <Save size={14} /> Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setShowVariantModal(true)}
            title="Générer, comparer et imprimer le Modèle B (Anti-Triche & Isomorphisme Pédagogique)"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.55rem 1.1rem', fontSize: '0.82rem', borderRadius: 10,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(139,92,246,0.3)'
            }}
          >
            <Shuffle size={14} /> Modèle B (Anti-Triche)
          </button>
        </div>
      </div>

      {/* ══ Tab switcher ════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: 4, padding: '1rem 0 0', flexShrink: 0 }}>
        {[
          { key: 'details', label: 'Détails Généraux', icon: <FileText size={14} /> },
          { key: 'questions', label: `Questions & Figures (${localQuestions.length})`, icon: <Layers size={14} /> },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.55rem 1.2rem', borderRadius: 10,
              border: `1px solid ${activeTab === tab.key ? 'transparent' : 'var(--border)'}`,
              background: activeTab === tab.key ? 'var(--btn-primary-bg)' : 'var(--bg-glass)',
              color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeTab === tab.key ? 'var(--btn-primary-shadow)' : 'none'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ══ Content area ════════════════════════════════════════ */}
      <div style={{ flex: 1, overflow: 'hidden', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column' }}>

        {/* ── TAB 1: General Details ── */}
        {activeTab === 'details' && (
          <div className="glass-panel animate-fade-in" style={{ maxWidth: 680, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Nom du Concours
              </label>
              <input
                value={editName}
                onChange={e => { setEditName(e.target.value); markDirty(); }}
                required
                className="input-control"
                style={{ fontSize: '1rem', fontWeight: 600 }}
                placeholder="Ex: Concours Médecine 2025"
              />
            </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Niveau Cible
                </label>
                <select
                  value={editLevel}
                  onChange={e => { setEditLevel(e.target.value); markDirty(); }}
                  required
                  className="input-control"
                  style={{ fontSize: '0.9rem' }}
                >
                  {schools.map(s => <option key={s} value={s}>{getLevelDisplayName(s)}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Année (optionnelle)
                </label>
                <input
                  value={editYear}
                  onChange={e => { setEditYear(e.target.value); markDirty(); }}
                  className="input-control"
                  style={{ fontSize: '0.9rem' }}
                  placeholder="Ex: 2025, ou laisser vide"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Abonnement
                </label>
                <select
                  value={editTier}
                  onChange={e => { setEditTier(e.target.value); markDirty(); }}
                  required
                  className="input-control"
                  style={{ fontSize: '0.9rem' }}
                >
                  <option value="freemium">Gratuit</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>

            {/* Tier preview badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.85rem 1.1rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-glass)' }}>
              {editTier === 'premium' ? (
                <>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Lock size={16} color="var(--warning)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Concours Premium</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Visible uniquement pour les abonnés payants</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Unlock size={16} color="var(--emerald)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Concours Gratuit</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accessible à tous les élèves</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: Questions (3-column layout) ── */}
        {activeTab === 'questions' && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr 380px', gap: '1.5rem', overflow: isMobile ? 'visible' : 'hidden' }}>

            {/* ── Column A: Question list ── */}
            <div className="glass-panel" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', overflowY: 'auto', scrollbarWidth: 'thin', maxHeight: isMobile ? '250px' : 'none' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '0 0.25rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                Questions ({localQuestions.length})
                {questionsLoading && (
                  <span style={{
                    display: 'inline-block', width: 10, height: 10,
                    border: '2px solid var(--border)', borderTopColor: 'var(--violet)',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0
                  }} />
                )}
              </div>
              {questionsLoading && localQuestions.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                  Chargement des questions…
                </p>
              )}
              {!questionsLoading && localQuestions.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                  Aucune question dans ce concours.
                </p>
              )}
              {localQuestions.map((q, idx) => {
                const isSelected = selectedIdx === idx;
                return (
                  <button
                    key={q.id || idx}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    style={{
                      width: '100%', padding: '0.65rem 0.75rem', borderRadius: 10,
                      border: `1.5px solid ${isSelected ? 'var(--violet)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--violet-soft)' : 'var(--bg-glass)',
                      color: isSelected ? 'var(--violet)' : 'var(--text-main)',
                      textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 2px 10px rgba(124,58,237,0.15)' : 'none'
                    }}
                    onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; } }}
                    onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'var(--bg-glass)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.78rem' }}>Q{idx + 1}</span>
                      {q.correct_answer && (
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--emerald)', background: 'rgba(16,185,129,0.12)', padding: '0.05rem 0.3rem', borderRadius: 4, border: '1px solid rgba(16,185,129,0.2)' }}>
                          {q.correct_answer}
                        </span>
                      )}
                      {q.image && <Image size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>
                      {q.topic || 'Général'} · {q.question ? q.question.substring(0, 35) + (q.question.length > 35 ? '…' : '') : 'Vide'}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleAddQuestion}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '0.65rem', borderRadius: 10, border: '1px dashed var(--violet)',
                  background: 'rgba(124,58,237,0.04)', color: 'var(--violet)',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                  marginTop: '0.5rem', transition: 'all 0.2s', flexShrink: 0
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.04)'; }}
              >
                <Plus size={14} /> Ajouter une question
              </button>
            </div>

            {/* ── Column B: Question editor ── */}
            <div className="glass-panel" style={{ padding: isMobile ? '1rem' : '1.5rem 2rem', overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* Navigation header */}
              {localQuestions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--btn-primary-bg)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900 }}>
                      {selectedIdx + 1}
                    </span>
                    Question {selectedIdx + 1} / {localQuestions.length}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {/* Move Up */}
                    <button type="button" onClick={() => handleMoveQuestion(selectedIdx, 'up')} disabled={selectedIdx === 0}
                      title="Déplacer vers le haut"
                      style={{ padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-glass)', cursor: selectedIdx === 0 ? 'not-allowed' : 'pointer', opacity: selectedIdx === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                      <ChevronUp size={14} />
                    </button>
                    {/* Move Down */}
                    <button type="button" onClick={() => handleMoveQuestion(selectedIdx, 'down')} disabled={selectedIdx === localQuestions.length - 1}
                      title="Déplacer vers le bas"
                      style={{ padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-glass)', cursor: selectedIdx === localQuestions.length - 1 ? 'not-allowed' : 'pointer', opacity: selectedIdx === localQuestions.length - 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                      <ChevronDown size={14} />
                    </button>

                    <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

                    {/* Navigation */}
                    <button type="button" onClick={() => setSelectedIdx(i => Math.max(0, i - 1))} disabled={selectedIdx === 0}
                      title="Question précédente"
                      style={{ padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-glass)', cursor: selectedIdx === 0 ? 'not-allowed' : 'pointer', opacity: selectedIdx === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                      <ChevronLeft size={14} />
                    </button>
                    <button type="button" onClick={() => setSelectedIdx(i => Math.min(localQuestions.length - 1, i + 1))} disabled={selectedIdx === localQuestions.length - 1}
                      title="Question suivante"
                      style={{ padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-glass)', cursor: selectedIdx === localQuestions.length - 1 ? 'not-allowed' : 'pointer', opacity: selectedIdx === localQuestions.length - 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                      <ChevronRight size={14} />
                    </button>

                    <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

                    {/* Delete */}
                    <button type="button" onClick={() => handleDeleteQuestion(selectedIdx)}
                      title="Supprimer la question"
                      style={{ padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}

              {q ? (
                <>
                  {/* Section 1: Énoncé */}
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--violet)', marginBottom: '0.6rem' }}>
                      <FileText size={13} /> 1 · Énoncé
                    </div>
                    <LatexToolbar onInsert={latex => insertLatex(`q-txt-${selectedIdx}`, latex, 'question')} />
                    <textarea
                      id={`q-txt-${selectedIdx}`}
                      value={q.question || ''}
                      onChange={e => updateQField(selectedIdx, 'question', e.target.value)}
                      className="input-control"
                      rows={6}
                      style={{ fontSize: '0.95rem', width: '100%', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }}
                      placeholder="Saisissez l'énoncé de la question..."
                    />
                  </section>

                  {/* Section 2: Topic + Correct answer */}
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--violet)', marginBottom: '0.6rem' }}>
                      <BrainCircuit size={13} /> 2 · Catégorie & Réponse
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>Thème / Domaine</label>
                        <input
                          type="text" value={q.topic || q.subject || ''}
                          onChange={e => updateQField(selectedIdx, 'topic', e.target.value)}
                          className="input-control" style={{ fontSize: '0.92rem', padding: '0.7rem 0.9rem' }}
                          placeholder="Ex: Analyse, Algèbre..."
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>Réponse Correcte</label>
                        <select
                          value={q.correct_answer || ''}
                          onChange={e => updateQField(selectedIdx, 'correct_answer', e.target.value)}
                          className="input-control" style={{ fontSize: '0.92rem', fontWeight: 700, padding: '0.7rem 0.9rem' }}
                        >
                          <option value="">-- Sélectionner --</option>
                          {(q.options || []).map((opt, oi) => {
                            const optId = typeof opt === 'string' ? ['A','B','C','D','E'][oi] : opt.id;
                            return <option key={optId} value={optId}>Option {optId}</option>;
                          })}
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Section 3: Options */}
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--violet)', marginBottom: '0.6rem' }}>
                      <CheckCircle2 size={13} /> 3 · Options de réponse
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(q.options || []).map((opt, oi) => {
                        const isStr = typeof opt === 'string';
                        const optId = isStr ? ['A','B','C','D','E'][oi] : opt.id;
                        const optText = isStr ? opt : (opt.text || '');
                        const isCorrect = q.correct_answer === optId;
                        return (
                          <div key={optId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontWeight: 900, fontSize: '1rem', flexShrink: 0,
                              background: isCorrect ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                              border: `2px solid ${isCorrect ? 'var(--emerald)' : 'var(--border)'}`,
                              color: isCorrect ? 'var(--emerald)' : 'var(--text-muted)',
                              boxShadow: isCorrect ? '0 0 12px rgba(16,185,129,0.2)' : 'none',
                              transition: 'all 0.2s'
                            }}>{optId}</span>
                            <input
                              type="text" value={optText}
                              onChange={e => updateQOption(selectedIdx, optId, e.target.value, oi)}
                              className="input-control"
                              style={{
                                fontSize: '0.92rem', padding: '0.65rem 0.9rem',
                                borderColor: isCorrect ? 'rgba(16,185,129,0.4)' : 'var(--border)',
                                background: isCorrect ? 'rgba(16,185,129,0.04)' : undefined
                              }}
                              placeholder={`Texte de l'option ${optId}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Section 4: Astuce & Trick */}
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--violet)', marginBottom: '0.6rem' }}>
                      <Lightbulb size={13} /> 4 · Astuce & Trick
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>Astuce / Explication</label>
                        <LatexToolbar onInsert={latex => insertLatex(`q-astuce-${selectedIdx}`, latex, 'astuce')} />
                        <textarea
                          id={`q-astuce-${selectedIdx}`}
                          value={q.astuce || ''}
                          onChange={e => updateQField(selectedIdx, 'astuce', e.target.value)}
                          className="input-control" rows={5}
                          style={{ fontSize: '0.9rem', width: '100%', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }}
                          placeholder="Expliquer la résolution..."
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>Trick (Raccourci rapide)</label>
                        <LatexToolbar onInsert={latex => insertLatex(`q-trick-${selectedIdx}`, latex, 'trick')} />
                        <textarea
                          id={`q-trick-${selectedIdx}`}
                          value={q.trick || ''}
                          onChange={e => updateQField(selectedIdx, 'trick', e.target.value)}
                          className="input-control" rows={5}
                          style={{ fontSize: '0.9rem', width: '100%', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }}
                          placeholder="Méthode rapide..."
                        />
                      </div>
                    </div>
                  </section>

                  {/* Section 5: Figure */}
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--violet)', marginBottom: '0.6rem' }}>
                      <Image size={13} /> 5 · Figure / Illustration
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '0.85rem 1rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-glass)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 4 }}>Image ou graphique</div>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {q.image ? 'Une figure est associée à cette question.' : 'Aucune figure pour le moment.'}
                          </p>
                          <div style={{ marginTop: '0.6rem', display: 'flex', gap: 6 }}>
                            <input
                              type="file" accept="image/*"
                              id={`img-upload-${q.id || selectedIdx}`}
                              style={{ display: 'none' }}
                              disabled={isUploadingImg}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setIsUploadingImg(true);
                                  try {
                                    const pathName = `questions/${exam.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                                    const publicUrl = await uploadAsset(file, pathName);
                                    updateQField(selectedIdx, 'image', publicUrl);
                                    updateQField(selectedIdx, 'imagePosition', 'below_statement');
                                    updateQField(selectedIdx, 'imageSize', 'medium');
                                    updateQField(selectedIdx, 'imageBg', 'transparent');
                                  } catch (err) {
                                    alert("Erreur lors du téléversement de l'image : " + err.message);
                                  } finally {
                                    setIsUploadingImg(false);
                                  }
                                }
                              }}
                            />
                            <label htmlFor={`img-upload-${q.id || selectedIdx}`} className="btn-outline"
                              style={{ padding: '0.38rem 0.85rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: isUploadingImg ? 'not-allowed' : 'pointer', margin: 0, borderRadius: 8, opacity: isUploadingImg ? 0.6 : 1 }}>
                              <Upload size={12} /> {isUploadingImg ? 'Envoi...' : q.image ? 'Remplacer' : "Importer"}
                            </label>

                            <button
                              type="button"
                              onClick={handleGenerateFigureWithAi}
                              disabled={isGeneratingAiFigure || !q.question}
                              className="btn"
                              style={{
                                padding: '0.38rem 0.85rem',
                                fontSize: '0.72rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                cursor: (isGeneratingAiFigure || !q.question) ? 'not-allowed' : 'pointer',
                                margin: 0,
                                borderRadius: 8,
                                opacity: (isGeneratingAiFigure || !q.question) ? 0.6 : 1,
                                background: 'linear-gradient(135deg, var(--violet), #6366f1)',
                                border: 'none',
                                color: '#fff',
                                fontWeight: 700
                              }}
                            >
                              {isGeneratingAiFigure ? (
                                <>
                                  <span style={{
                                    display: 'inline-block', width: 10, height: 10,
                                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                                    borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0
                                  }} />
                                  Génération...
                                </>
                              ) : (
                                <>
                                  <Sparkles size={12} /> Générer avec l'IA
                                </>
                              )}
                            </button>

                            {q.image && (
                              <button type="button" onClick={() => { 
                                updateQField(selectedIdx, 'image', null); 
                                updateQField(selectedIdx, 'imagePosition', null); 
                                updateQField(selectedIdx, 'imageSize', null); 
                                updateQField(selectedIdx, 'imageBg', null); 
                              }}
                                style={{ padding: '0.38rem 0.7rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 600 }}>
                                <Trash2 size={11} /> Supprimer
                              </button>
                            )}
                          </div>
                        </div>
                        {q.image && (
                          <div style={{ width: 120, height: 80, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: '#000', flexShrink: 0 }}>
                            {q.image.startsWith('svg:') ? (
                              <div 
                                style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', padding: '4px' }} 
                                dangerouslySetInnerHTML={{ __html: q.image.slice(4) }} 
                              />
                            ) : (
                              <img src={q.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            )}
                          </div>
                        )}
                      </div>

                      {q.image && (
                        <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem', padding: '1rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}>Position de la figure</label>
                            <select
                              value={q.imagePosition || 'below_statement'}
                              onChange={e => updateQField(selectedIdx, 'imagePosition', e.target.value)}
                              className="input-control" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                            >
                              <option value="below_statement">Sous l'énoncé (Défaut)</option>
                              <option value="above_statement">Au-dessus de l'énoncé</option>
                              <option value="side_by_side">Côte à côte (Énoncé à gauche, Image à droite)</option>
                              <option value="in_context">Dans le texte d'introduction (Contexte)</option>
                              <option value="below_options">Sous les choix de réponse (Options)</option>
                              <option value="in_correction">Dans l'explication (Correction/Astuce)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}>Taille de l'image</label>
                            <select
                              value={q.imageSize || 'medium'}
                              onChange={e => updateQField(selectedIdx, 'imageSize', e.target.value)}
                              className="input-control" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                            >
                              <option value="small">Petite (90px)</option>
                              <option value="medium">Moyenne (150px)</option>
                              <option value="large">Grande (220px)</option>
                              <option value="xlarge">Très grande (320px)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}>Arrière-plan</label>
                            <select
                              value={q.imageBg || 'transparent'}
                              onChange={e => updateQField(selectedIdx, 'imageBg', e.target.value)}
                              className="input-control" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                            >
                              <option value="transparent">Transparent (Défaut)</option>
                              <option value="white">Blanc (Schémas)</option>
                              <option value="dark">Sombre (Contraste)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: 8 }}>
                  <FileText size={32} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '0.85rem' }}>Sélectionnez une question pour l'éditer</span>
                </div>
              )}
            </div>

            {/* ── Column C: Live preview ── */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: isMobile ? '350px' : 'none' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Eye size={11} /> Aperçu en direct
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <CardPreview question={q} side={previewSide} onFlip={setPreviewSide} />
              </div>
            </div>

          </div>
        )}
      </div>
    </div>

    {/* ══ Import CSV Confirmation Modal ══ */}
    {showImportModal && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
      }}>
        <div className="glass-panel animate-fade-in" style={{
          width: '100%', maxWidth: 540,
          padding: '2rem', borderRadius: 20,
          border: '1px solid var(--border)',
          boxShadow: '0 30px 60px -12px rgba(0,0,0,0.6)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileUp size={18} style={{ color: 'var(--violet)' }} /> Importer des questions
              </h2>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--violet)' }}>{importRows.length}</strong> questions détectées dans le fichier CSV
              </p>
            </div>
            <button type="button" onClick={() => { setShowImportModal(false); setImportRows([]); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          {/* Preview table */}
          <div style={{
            maxHeight: 220, overflowY: 'auto', scrollbarWidth: 'thin',
            border: '1px solid var(--border)', borderRadius: 10, marginBottom: '1.5rem',
            background: 'var(--bg-glass)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'rgba(124,58,237,0.08)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Question</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Topic</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Réponse</th>
                </tr>
              </thead>
              <tbody>
                {importRows.slice(0, 20).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.4rem 0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: '0.4rem 0.75rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.question || <em style={{ color: 'var(--text-muted)' }}>vide</em>}
                    </td>
                    <td style={{ padding: '0.4rem 0.75rem', color: 'var(--text-muted)' }}>{r.topic || '—'}</td>
                    <td style={{ padding: '0.4rem 0.75rem', textAlign: 'center' }}>
                      {r.correct_answer ? (
                        <span style={{ fontWeight: 800, color: 'var(--emerald)', background: 'rgba(16,185,129,0.12)', padding: '0.1rem 0.4rem', borderRadius: 5, border: '1px solid rgba(16,185,129,0.25)' }}>
                          {r.correct_answer}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
                {importRows.length > 20 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                      + {importRows.length - 20} autres questions…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mode selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
              Comment importer ces questions ?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { val: 'merge', label: 'Ajouter aux questions existantes', desc: `Conserve les ${localQuestions.length} questions actuelles et ajoute ${importRows.length} nouvelles`, icon: '➕', color: 'var(--emerald)', border: 'rgba(16,185,129,0.4)', bg: 'rgba(16,185,129,0.06)' },
                { val: 'replace', label: 'Remplacer toutes les questions', desc: `Supprime les ${localQuestions.length} questions actuelles et importe uniquement les ${importRows.length} nouvelles`, icon: '🔄', color: 'var(--danger)', border: 'rgba(239,68,68,0.4)', bg: 'rgba(239,68,68,0.06)' },
              ].map(opt => (
                <label key={opt.val} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.75rem 1rem',
                  borderRadius: 12, border: `1.5px solid ${importMode === opt.val ? opt.border : 'var(--border)'}`,
                  background: importMode === opt.val ? opt.bg : 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}>
                  <input type="radio" name="importMode" value={opt.val}
                    checked={importMode === opt.val} onChange={() => setImportMode(opt.val)}
                    style={{ marginTop: 2, accentColor: opt.color }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: importMode === opt.val ? opt.color : 'var(--text-main)' }}>
                      {opt.icon} {opt.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button"
              onClick={() => { setShowImportModal(false); setImportRows([]); }}
              className="btn-ghost"
              style={{ padding: '0.6rem 1.25rem', borderRadius: 10, fontSize: '0.85rem' }}>
              Annuler
            </button>
            <button type="button"
              onClick={handleConfirmImport}
              style={{
                padding: '0.6rem 1.5rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700,
                border: 'none', cursor: 'pointer',
                background: importMode === 'replace'
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                  : 'linear-gradient(135deg, var(--violet), #6366f1)',
                color: '#fff',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: importMode === 'replace'
                  ? '0 4px 14px rgba(239,68,68,0.35)'
                  : '0 4px 14px rgba(124,58,237,0.35)',
                transition: 'all 0.2s'
              }}>
              <FileUp size={14} />
              {importMode === 'replace' ? `Remplacer (${importRows.length} Q)` : `Ajouter (${importRows.length} Q)`}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Anti-Cheat Equivalence Model A / Model B Modal */}
    <ExamVariantModal
      isOpen={showVariantModal}
      onClose={() => setShowVariantModal(false)}
      exam={{
        ...exam,
        name: editName || exam?.name,
        school: editSchool || exam?.school,
        level: editLevel || exam?.level,
        year: editYear || exam?.year,
        tier: editTier || exam?.tier
      }}
      questions={localQuestions}
      onApplyVariant={(newQuestions) => {
        setLocalQuestions(newQuestions);
        markDirty();
        setShowVariantModal(false);
      }}
    />
    </>
  );
}

