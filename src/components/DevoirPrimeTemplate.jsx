// src/components/DevoirPrimeTemplate.jsx
// Interactive viewer, editor, concise AI solver, and print controller for DEVOIR PRIME.

import { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Printer, Sparkles, Settings, Save, Eye, EyeOff,
  Plus, Minus, Trash2, Edit3, Check, Loader2, Columns, FileText
} from 'lucide-react';
import { renderWithMath } from '../utils/mathRenderer';
import {
  getDefaultDevoirPrimeMeta,
  normalizeToDevoirPrimeExercises,
  buildQuestionQrPayload,
  parseNumericPoints,
  ensureMathDelimiters,
} from '../utils/devoirPrimeHelpers';
import { solveDevoirPrimeWithAI } from '../utils/aiExerciseSolver';
import { openDevoirPrimePrintWindow } from '../utils/generateDevoirPrimePDF';

const renderPrimeMath = (txt) => renderWithMath(ensureMathDelimiters(txt || ''));

const MOROCCO_EMBLEM = (
  <svg width="38" height="38" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="46" stroke="#854d0e" strokeWidth="2.2" fill="#fffbeb" />
    <path d="M35 23 Q50 13 65 23 L61 28 Q50 20 39 28 Z" fill="#b45309" />
    <circle cx="50" cy="14" r="3" fill="#b45309" />
    <path d="M32 32 Q50 35 68 32 Q68 62 50 74 Q32 62 32 32 Z" stroke="#991b1b" strokeWidth="2.2" fill="#fef2f2" />
    <path d="M50 39 L53.5 48 L63 48 L55.5 53.5 L58.5 63 L50 57 L41.5 63 L44.5 53.5 L37 48 L46.5 48 Z" stroke="#15803d" strokeWidth="2.2" fill="none" />
    <path d="M26 78 Q50 86 74 78" stroke="#854d0e" strokeWidth="2" fill="none" />
  </svg>
);

export default function DevoirPrimeTemplate({
  lesson = {},
  editable = true,
  onChange = null,
  onSave = null,
  isConvertedPreview = false,
}) {
  const [meta, setMeta] = useState(() => getDefaultDevoirPrimeMeta(lesson));
  const [exercises, setExercises] = useState(() => normalizeToDevoirPrimeExercises(lesson));
  const [showSolutions, setShowSolutions] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editingQKey, setEditingQKey] = useState(null); // `${eIdx}_${qIdx}`
  const [solvingAll, setSolvingAll] = useState(false);
  const [solvingStatus, setSolvingStatus] = useState('');
  const [solvingQKey, setSolvingQKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [qrMap, setQrMap] = useState({});

  // Re-sync if parent switches to a different lesson id
  useEffect(() => {
    setMeta(getDefaultDevoirPrimeMeta(lesson));
    setExercises(normalizeToDevoirPrimeExercises(lesson));
  }, [lesson?.id]);

  // Notify parent when meta or exercises change (for AdminLessonsImport live sync)
  useEffect(() => {
    if (typeof onChange === 'function') {
      onChange(meta, exercises);
    }
  }, [meta, exercises]);

  // Generate QR codes for every question asynchronously
  useEffect(() => {
    if (!meta.showQR) return;
    let cancelled = false;
    const generateAll = async () => {
      const next = {};
      for (let eIdx = 0; eIdx < exercises.length; eIdx++) {
        const qs = exercises[eIdx]?.questions || [];
        for (let qIdx = 0; qIdx < qs.length; qIdx++) {
          const q = qs[qIdx];
          const key = `${eIdx}_${qIdx}`;
          const payload = buildQuestionQrPayload(lesson, meta, eIdx, q, qIdx);
          try {
            next[key] = await QRCode.toDataURL(payload, { width: 96, margin: 1 });
          } catch {
            next[key] = '';
          }
        }
      }
      if (!cancelled) setQrMap(next);
    };
    generateAll();
    return () => { cancelled = true; };
  }, [exercises, meta.showQR, meta.title, lesson?.id]);

  // Estimate page count for preview badge
  const estimatedPages = useMemo(() => {
    let totalUnits = 12; // Page 1 header
    exercises.forEach(ex => {
      totalUnits += 2;
      (ex.questions || []).forEach(q => {
        totalUnits += 3 + (Number(q.linesCount) || 5);
      });
    });
    return Math.max(1, Math.ceil(totalUnits / 28));
  }, [exercises]);

  const totalPoints = useMemo(() => {
    let sum = 0;
    exercises.forEach(ex => {
      const qSum = (ex.questions || []).filter(q => !q.isStem).reduce((s, q) => s + parseNumericPoints(q.points), 0);
      sum += qSum > 0 ? qSum : parseNumericPoints(ex.points);
    });
    return Number(sum.toFixed(2));
  }, [exercises]);

  const updateMetaField = (field, value) => {
    setMeta(prev => {
      const next = { ...prev, [field]: value };
      try {
        if (field === 'brandName') localStorage.setItem('devoirPrimeBrand', value);
        if (field === 'handle') localStorage.setItem('devoirPrimeHandle', value);
      } catch {}
      return next;
    });
  };

  const updateQuestion = (eIdx, qIdx, patch) => {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== eIdx) return ex;
      const updatedQs = (ex.questions || []).map((q, qi) => (qi === qIdx ? { ...q, ...patch } : q));
      const exSum = updatedQs.filter(q => !q.isStem).reduce((s, q) => s + parseNumericPoints(q.points), 0);
      return {
        ...ex,
        points: exSum > 0 ? (Number.isInteger(exSum) ? String(exSum) : String(Number(exSum.toFixed(2)))) : ex.points,
        questions: updatedQs,
      };
    }));
  };

  const toggleQuestionStem = (eIdx, qIdx) => {
    const q = exercises[eIdx]?.questions?.[qIdx];
    if (!q) return;
    if (q.isStem) {
      updateQuestion(eIdx, qIdx, { isStem: false, points: '1 pt', linesCount: 5 });
    } else {
      updateQuestion(eIdx, qIdx, {
        isStem: true,
        points: '',
        linesCount: 0,
        steps: [],
        finalBox: '',
        leftSteps: [],
        rightSteps: [],
        leftConclusion: '',
        rightConclusion: '',
      });
    }
  };

  const mergeWithNextQuestion = (eIdx, qIdx) => {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== eIdx) return ex;
      const qs = [...(ex.questions || [])];
      if (qIdx < 0 || qIdx >= qs.length - 1) return ex;
      const curr = qs[qIdx];
      const next = qs[qIdx + 1];
      const combinedPtsNum = (curr.isStem ? 0 : parseNumericPoints(curr.points)) + (next.isStem ? 0 : parseNumericPoints(next.points));
      const combinedPts = combinedPtsNum > 0
        ? `${Number.isInteger(combinedPtsNum) ? combinedPtsNum : Number(combinedPtsNum.toFixed(2))} pt`
        : (next.points || curr.points || '1 pt');

      const merged = {
        ...curr,
        isStem: false,
        text: `${curr.text || ''}\n${next.number ? `**${next.number}** ` : ''}${next.text || ''}`.trim(),
        points: combinedPts,
        linesCount: Math.max(curr.linesCount || 4, next.linesCount || 5),
        steps: (curr.steps && curr.steps.length > 0) ? curr.steps : (next.steps || []),
        finalBox: curr.finalBox || next.finalBox || '',
      };
      qs.splice(qIdx, 2, merged);
      const exSum = qs.filter(q => !q.isStem).reduce((s, q) => s + parseNumericPoints(q.points), 0);
      return {
        ...ex,
        points: exSum > 0 ? (Number.isInteger(exSum) ? String(exSum) : String(Number(exSum.toFixed(2)))) : ex.points,
        questions: qs,
      };
    }));
  };

  const addQuestionToExercise = (eIdx) => {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== eIdx) return ex;
      const nextNum = (ex.questions?.length || 0) + 1;
      return {
        ...ex,
        questions: [
          ...(ex.questions || []),
          {
            id: `dp-ex${eIdx + 1}-q${nextNum}-${Date.now()}`,
            number: `${nextNum}.`,
            text: 'Nouvelle question...',
            points: '1 pt',
            linesCount: 5,
            layout: 'single',
            steps: [],
            finalBox: '',
            leftTitle: '',
            leftSteps: [],
            leftConclusion: '',
            rightTitle: '',
            rightSteps: [],
            rightConclusion: '',
            qrUrl: '',
            image: null,
          }
        ]
      };
    }));
  };

  const deleteQuestion = (eIdx, qIdx) => {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== eIdx) return ex;
      return {
        ...ex,
        questions: (ex.questions || []).filter((_, qi) => qi !== qIdx),
      };
    }));
  };

  const handleSolveSingleQuestion = async (eIdx, qIdx) => {
    const key = `${eIdx}_${qIdx}`;
    const ex = exercises[eIdx];
    const q = ex?.questions?.[qIdx];
    if (!ex || !q) return;

    setSolvingQKey(key);
    setErrorMsg('');
    try {
      const results = await solveDevoirPrimeWithAI(ex, {
        level: meta.level || lesson?.level || '2bac_pc_svt',
        docTitle: meta.title,
        targetQuestionId: q.id,
      });
      const res = results[0];
      if (res) {
        updateQuestion(eIdx, qIdx, {
          layout: res.layout || 'single',
          steps: res.steps || [],
          finalBox: res.finalBox || '',
          leftTitle: res.leftTitle || '',
          leftSteps: res.leftSteps || [],
          leftConclusion: res.leftConclusion || '',
          rightTitle: res.rightTitle || '',
          rightSteps: res.rightSteps || [],
          rightConclusion: res.rightConclusion || '',
          linesCount: Math.max(q.linesCount || 4, res.recommendedLines || 5),
        });
        setShowSolutions(true);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Erreur lors de la résolution IA.');
    } finally {
      setSolvingQKey(null);
    }
  };

  const handleSolveAllExercises = async () => {
    if (exercises.length === 0) return;
    setSolvingAll(true);
    setErrorMsg('');
    try {
      const updated = [...exercises];
      for (let eIdx = 0; eIdx < updated.length; eIdx++) {
        const ex = updated[eIdx];
        setSolvingStatus(`جاري حل ${ex.title || `Exercice ${eIdx + 1}`} (${eIdx + 1}/${updated.length}) بأسلوب الأستاذ المغربي المختصر...`);
        const results = await solveDevoirPrimeWithAI(ex, {
          level: meta.level || lesson?.level || '2bac_pc_svt',
          docTitle: meta.title,
        });
        if (Array.isArray(results) && results.length > 0) {
          const byId = new Map(results.map(r => [r.id, r]));
          let nonStemIdx = 0;
          updated[eIdx] = {
            ...ex,
            questions: (ex.questions || []).map((q) => {
              if (q.isStem) return q;
              const r = byId.get(q.id) || results[nonStemIdx++];
              if (!r) return q;
              return {
                ...q,
                layout: r.layout || 'single',
                steps: r.steps || [],
                finalBox: r.finalBox || '',
                leftTitle: r.leftTitle || '',
                leftSteps: r.leftSteps || [],
                leftConclusion: r.leftConclusion || '',
                rightTitle: r.rightTitle || '',
                rightSteps: r.rightSteps || [],
                rightConclusion: r.rightConclusion || '',
                linesCount: Math.max(q.linesCount || 4, r.recommendedLines || 5),
              };
            }),
          };
          setExercises([...updated]);
        }
      }
      setShowSolutions(true);
      setSolvingStatus('');
    } catch (err) {
      setErrorMsg(err.message || 'Erreur lors de la génération des solutions.');
      setSolvingStatus('');
    } finally {
      setSolvingAll(false);
    }
  };

  const handleTriggerPrint = async (withSolutions) => {
    await openDevoirPrimePrintWindow(lesson, {
      showSolutions: withSolutions,
      metaOverride: meta,
      exercisesOverride: exercises,
    });
  };

  const handleSaveClick = async (convertToPrime = false) => {
    if (typeof onSave !== 'function') return;
    setSaving(true);
    setErrorMsg('');
    try {
      await onSave(meta, exercises, convertToPrime);
      setSaveToast(convertToPrime ? '✅ تم التحويل والحفظ بنظام DEVOIR PRIME بنجاح!' : '✅ تم حفظ تعديلات DEVOIR PRIME بنجاح!');
      setTimeout(() => setSaveToast(''), 3500);
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── TOP STICKY CONTROL BAR ── */}
      <div
        className="glass-panel no-print"
        style={{
          padding: '1rem 1.25rem',
          borderRadius: '14px',
          border: '1.5px solid rgba(245, 158, 11, 0.45)',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(30, 58, 138, 0.92) 100%)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff',
              padding: '0.25rem 0.75rem',
              borderRadius: '99px',
              fontWeight: 900,
              fontSize: '0.78rem',
              letterSpacing: '0.5px',
            }}>
              ⭐ DEVOIR PRIME
            </span>
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
              {meta.title}
            </span>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.15rem 0.55rem',
              borderRadius: '99px',
              background: 'rgba(255,255,255,0.12)',
              color: '#e2e8f0',
              fontWeight: 700,
            }}>
              {totalPoints} pts • ~{estimatedPages} صفحات
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Toggle Student vs Solutions Mode */}
            <button
              type="button"
              onClick={() => setShowSolutions(!showSolutions)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '9px',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                background: showSolutions ? '#0284c7' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {showSolutions ? <><Eye size={15} /> الأجوبة ظاهرة (التصحيح)</> : <><EyeOff size={15} /> نسخة التلميذ (نقط فقط)</>}
            </button>

            {/* Print Student Copy (Dotted lines ONLY) */}
            <button
              type="button"
              onClick={() => handleTriggerPrint(false)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '9px',
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="طباعة الفرض بدون أجوبة مع إبقاء سطور النقط فقط"
            >
              <Printer size={15} /> طباعة بدون حل (نقط فقط)
            </button>

            {/* Print Teacher Corrigé Copy */}
            <button
              type="button"
              onClick={() => handleTriggerPrint(true)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '9px',
                border: '1px solid rgba(52, 211, 153, 0.5)',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="طباعة الفرض مع الحل المختصر بأسلوب الأستاذ المغربي"
            >
              <Printer size={15} /> طباعة بالحل المختصر
            </button>

            {editable && (
              <>
                <button
                  type="button"
                  disabled={solvingAll}
                  onClick={handleSolveAllExercises}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '9px',
                    border: '1px solid rgba(251, 191, 36, 0.6)',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: solvingAll ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {solvingAll ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                  {solvingAll ? 'جاري الحل...' : 'حل الفرض كاملاً (مختصر)'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  style={{
                    padding: '0.45rem 0.8rem',
                    borderRadius: '9px',
                    border: '1px solid rgba(255,255,255,0.28)',
                    background: showSettings ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Settings size={15} /> إعدادات الرأس
                </button>

                {typeof onSave === 'function' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveClick(isConvertedPreview)}
                    style={{
                      padding: '0.45rem 0.9rem',
                      borderRadius: '9px',
                      border: '1px solid rgba(167, 139, 250, 0.6)',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: saving ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                    {isConvertedPreview ? 'حفظ كـ DEVOIR PRIME' : 'حفظ التعديلات'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Progress / Toast / Error */}
        {solvingStatus && (
          <div style={{ fontSize: '0.82rem', color: '#fde68a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Loader2 size={14} className="spin" /> {solvingStatus}
          </div>
        )}
        {saveToast && (
          <div style={{ fontSize: '0.82rem', color: '#6ee7b7', fontWeight: 800 }}>{saveToast}</div>
        )}
        {errorMsg && (
          <div style={{ fontSize: '0.82rem', color: '#fda4af', fontWeight: 700 }}>⚠️ {errorMsg}</div>
        )}

        {/* Collapsible Header Metadata Editor */}
        {showSettings && editable && (
          <div style={{
            marginTop: '0.25rem',
            padding: '1rem',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.16)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '0.75rem',
            fontSize: '0.8rem',
          }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>عنوان الفرض (الصفحة 1 والمتكرر)</span>
              <input className="input-control" value={meta.title} onChange={e => updateMetaField('title', e.target.value)} style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>الدورة</span>
              <input className="input-control" value={meta.semester} onChange={e => updateMetaField('semester', e.target.value)} style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>السنة الدراسية</span>
              <input className="input-control" value={meta.academicYear} onChange={e => updateMetaField('academicYear', e.target.value)} style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>الأستاذ (Réalisé par)</span>
              <input className="input-control" value={meta.teacher} onChange={e => updateMetaField('teacher', e.target.value)} style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>العلامة / الشعار النصي (يمين)</span>
              <input className="input-control" value={meta.brandName} onChange={e => updateMetaField('brandName', e.target.value)} style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>الحساب / الهاتف (يسار)</span>
              <input className="input-control" value={meta.handle} onChange={e => updateMetaField('handle', e.target.value)} style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>المادة</span>
              <input className="input-control" value={meta.subject} onChange={e => updateMetaField('subject', e.target.value)} style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>مدة الإنجاز</span>
              <input className="input-control" value={meta.duration} onChange={e => updateMetaField('duration', e.target.value)} style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>المعامل</span>
              <input className="input-control" value={meta.coefficient} onChange={e => updateMetaField('coefficient', e.target.value)} style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
              <span>الشعبة والمسلك</span>
              <input className="input-control" value={meta.branch} onChange={e => updateMetaField('branch', e.target.value)} style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>نمط خط الحل</span>
              <select
                value={meta.solutionStyle}
                onChange={e => updateMetaField('solutionStyle', e.target.value)}
                style={{ color: '#0f172a', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px' }}
              >
                <option value="clean_math">خط رياضي نظيف (أزرق) — موصى به</option>
                <option value="handwritten">نمط خط القلم المائل</option>
              </select>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', gridColumn: '1 / -1', paddingTop: '0.25rem' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={meta.showQR} onChange={e => updateMetaField('showQR', e.target.checked)} />
                <span>إظهار QR Code لكل سؤال</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={meta.showStudentStrip} onChange={e => updateMetaField('showStudentStrip', e.target.checked)} />
                <span>إظهار شريط (Nom et prénom / Classe / N°) في الصفحة الأولى</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ── FAITHFUL A4 DOCUMENT SHEET PREVIEW ── */}
      <div
        style={{
          width: '100%',
          maxWidth: '860px',
          margin: '0 auto',
          background: '#ffffff',
          color: '#000000',
          padding: '28px 32px',
          borderRadius: '10px',
          boxShadow: '0 8px 30px rgba(15, 23, 42, 0.14)',
          border: '1px solid #cbd5e1',
          fontFamily: "'STIX Two Text', 'Times New Roman', 'Tajawal', serif",
        }}
      >
        {/* ── 1. PAGE 1 OFFICIAL COVER HEADER ── */}
        <div style={{ marginBottom: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              <tr>
                {/* Left: Page Diagonal Box */}
                <td style={{ width: '96px', border: '1.5px solid #000', padding: 0, verticalAlign: 'top', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '13px', padding: '5px 4px', borderBottom: '1.4px solid #000', background: '#fafafa' }}>
                    الصفحة
                  </div>
                  <div style={{ position: 'relative', height: '82px', width: '100%' }}>
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                      <line x1="0" y1="0" x2="100" y2="100" stroke="#000" strokeWidth="1.4" />
                    </svg>
                    <span style={{ position: 'absolute', top: '10px', right: '15px', fontSize: '17px', fontWeight: 700 }}>1</span>
                    <span style={{ position: 'absolute', bottom: '8px', left: '15px', fontSize: '17px', fontWeight: 700 }}>{estimatedPages}</span>
                  </div>
                </td>

                {/* Center: Title + Semester + Teacher */}
                <td style={{ border: '1.5px solid #000', textAlign: 'center', padding: '8px 10px', verticalAlign: 'middle' }}>
                  <div style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '22px', fontWeight: 900, lineHeight: 1.2, marginBottom: '4px' }}>
                    {meta.title}
                  </div>
                  <div style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>
                    – {meta.semester} {meta.academicYear} –
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a8a' }}>
                    Réalisé par : {meta.teacher}
                  </div>
                </td>

                {/* Right: Ministry Emblem */}
                <td style={{ width: '185px', border: '1.5px solid #000', textAlign: 'center', padding: '5px 6px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2px' }}>{MOROCCO_EMBLEM}</div>
                  <div style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '9.5px', lineHeight: 1.25 }}>
                    <div style={{ fontWeight: 800, fontSize: '10.5px' }}>{meta.ministryLine1}</div>
                    <div>{meta.ministryLine2}</div>
                    <div style={{ fontWeight: 700, fontSize: '9px', marginTop: '2px' }}>{meta.ministryLine3}</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Attached Metadata Rows */}
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: '-1.5px' }}>
            <tbody>
              <tr>
                <td colSpan={2} style={{ width: '188px', border: '1.5px solid #000', textAlign: 'center', padding: '4px 8px', fontWeight: 700, fontSize: '13px' }}>
                  {meta.handle}
                </td>
                <td style={{ border: '1.5px solid #000', textAlign: 'center', padding: '4px 8px', fontFamily: 'Tajawal, sans-serif', fontWeight: 900, fontSize: '14px' }}>
                  الموضوع
                </td>
                <td style={{ width: '185px', border: '1.5px solid #000', textAlign: 'center', padding: '4px 8px', fontWeight: 800, fontSize: '14px', letterSpacing: '0.5px' }}>
                  {meta.brandName}
                </td>
              </tr>
              <tr>
                <td style={{ width: '96px', border: '1.5px solid #000', textAlign: 'center', padding: '4px 6px', fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: '13px' }}>
                  {meta.duration}
                </td>
                <td style={{ width: '92px', border: '1.5px solid #000', textAlign: 'center', padding: '4px 6px', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '13px', background: '#fafafa' }}>
                  مدة الإنجاز
                </td>
                <td style={{ border: '1.5px solid #000', textAlign: 'center', padding: '4px 8px', fontFamily: 'Tajawal, sans-serif', fontSize: '13px' }}>
                  {meta.subject}
                </td>
                <td style={{ width: '185px', border: '1.5px solid #000', textAlign: 'center', padding: '4px 8px', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '13px', background: '#fafafa' }}>
                  المادة
                </td>
              </tr>
              <tr>
                <td style={{ width: '96px', border: '1.5px solid #000', textAlign: 'center', padding: '4px 6px', fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: '13px' }}>
                  {meta.coefficient}
                </td>
                <td style={{ width: '92px', border: '1.5px solid #000', textAlign: 'center', padding: '4px 6px', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '13px', background: '#fafafa' }}>
                  المعامل
                </td>
                <td style={{ border: '1.5px solid #000', textAlign: 'center', padding: '4px 8px', fontFamily: 'Tajawal, sans-serif', fontWeight: 600, fontSize: '12.5px' }}>
                  {meta.branch}
                </td>
                <td style={{ width: '185px', border: '1.5px solid #000', textAlign: 'center', padding: '4px 8px', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '13px', background: '#fafafa' }}>
                  الشعبة والمسلك
                </td>
              </tr>
            </tbody>
          </table>

          {/* Student Strip (Page 1 only) */}
          {meta.showStudentStrip && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '120px', border: '1.4px solid #000', background: '#f3f4f6', fontWeight: 700, textAlign: 'center', padding: '4px 6px', fontSize: '12.5px' }}>Nom et prénom</td>
                  <td style={{ border: '1.4px solid #000', padding: '4px 8px', color: '#475569', letterSpacing: '1px' }}>....................................................</td>
                  <td style={{ width: '62px', border: '1.4px solid #000', background: '#f3f4f6', fontWeight: 700, textAlign: 'center', padding: '4px 6px', fontSize: '12.5px' }}>Classe</td>
                  <td style={{ width: '125px', border: '1.4px solid #000', padding: '4px 6px', color: '#475569' }}>.......................</td>
                  <td style={{ width: '36px', border: '1.4px solid #000', background: '#f3f4f6', fontWeight: 700, textAlign: 'center', padding: '4px 4px', fontSize: '12.5px' }}>N°</td>
                  <td style={{ width: '54px', border: '1.4px solid #000', padding: '4px 6px', color: '#475569' }}>.......</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* ── 2. RUNNING HEADER PREVIEW (Pages 2..N indicator) ── */}
        <div style={{
          margin: '12px 0 18px',
          padding: '8px 10px',
          borderRadius: '8px',
          background: '#f8fafc',
          border: '1px dashed #94a3b8',
        }}>
          <div style={{ fontSize: '11px', fontFamily: 'Tajawal, sans-serif', color: '#64748b', fontWeight: 700, marginBottom: '6px', textAlign: 'right' }}>
            معاينة الرأس المتكرر تلقائياً في الصفحة 2 وما بعدها عند الطباعة:
          </div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: '6px', height: '50px' }}>
            <div style={{ width: '92px', border: '1.4px solid #000', borderRadius: '7px', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 800 }}>الصفحة</div>
              <div style={{ width: '65%', height: '1px', background: '#000', margin: '2px 0' }} />
              <div style={{ fontSize: '12px', fontWeight: 800 }}>2 / {estimatedPages}</div>
            </div>
            <div style={{ flex: 1, border: '1.4px solid #000', borderRadius: '7px', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: 'Tajawal, sans-serif', padding: '2px 8px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 900 }}>{meta.semester} - {meta.title} - {meta.academicYear}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b' }}>مادة : {meta.subject} - {meta.branch}</div>
            </div>
            <div style={{ width: '92px', border: '1.4px solid #000', borderRadius: '7px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 800, fontSize: '12px', padding: '4px' }}>
              {meta.brandName}
            </div>
          </div>
        </div>

        {/* ── 3. EXERCISES & QUESTION CARDS ── */}
        {exercises.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontFamily: 'Tajawal, sans-serif' }}>
            لا توجد تمارين في هذا الملف بعد.
          </div>
        ) : (
          exercises.map((ex, eIdx) => (
            <div key={ex.id || eIdx} style={{ marginBottom: '20px' }}>
              {/* Exercise Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontSize: '15.5px', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: '3px', color: '#000' }}>
                  {ex.title}{ex.points ? ` (${ex.points} points)` : ''} :
                </div>
                {editable && (
                  <button
                    type="button"
                    onClick={() => addQuestionToExercise(eIdx)}
                    style={{
                      fontSize: '11.5px',
                      fontFamily: 'Tajawal, sans-serif',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#0f172a',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={12} /> إضافة سؤال
                  </button>
                )}
              </div>

              {ex.preamble && (
                <div style={{ fontSize: '13.5px', marginBottom: '8px', lineHeight: 1.5 }}>
                  {renderPrimeMath(ex.preamble)}
                </div>
              )}

              {/* Question Cards & Parent Stems */}
              {(ex.questions || []).map((q, qIdx) => {
                const key = `${eIdx}_${qIdx}`;
                const isEditing = editingQKey === key;
                const isSolving = solvingQKey === key;
                const qrDataUrl = qrMap[key] || '';
                const linesCount = Math.max(3, Math.min(16, Number(q.linesCount) || 5));
                const minBoxHeight = linesCount * 29 + 14;
                const hasSolution = (q.steps && q.steps.length > 0) || Boolean(q.finalBox) || (q.layout === 'two_columns' && ((q.leftSteps && q.leftSteps.length > 0) || (q.rightSteps && q.rightSteps.length > 0)));

                // Parent Stem Banner (e.g. "2. Calculer les limites suivantes :" before a), b), c) — NO points, NO QR, NO dotted box!)
                if (q.isStem) {
                  return (
                    <div key={q.id || key} style={{
                      margin: '10px 0 6px 0',
                      padding: '6px 10px',
                      borderLeft: '3px solid #1e3a8a',
                      background: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#000', lineHeight: 1.45 }}>
                          {renderPrimeMath(`${q.number ? `**${String(q.number).trim()}** ` : ''}${String(q.text || '').replace(/^\s+/, '')}`)}
                        </div>
                        {editable && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'Tajawal, sans-serif', fontSize: '11.5px' }}>
                            <button
                              type="button"
                              onClick={() => toggleQuestionStem(eIdx, qIdx)}
                              style={{ padding: '2px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer' }}
                              title="تحويل إلى بطاقة سؤال بصندوق نقط ونقطة"
                            >
                              ↩️ تحويل لسؤال
                            </button>
                            {qIdx < (ex.questions?.length || 0) - 1 && (
                              <button
                                type="button"
                                onClick={() => mergeWithNextQuestion(eIdx, qIdx)}
                                style={{ padding: '2px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', color: '#0369a1', fontWeight: 700, cursor: 'pointer' }}
                                title="دمج رأس السؤال مع السؤال الفرعي الموالي داخل بطاقة واحدة"
                              >
                                🔗 دمج مع الموالي
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingQKey(isEditing ? null : key)}
                              style={{ padding: '2px 7px', borderRadius: '5px', border: '1px solid #93c5fd', background: isEditing ? '#2563eb' : '#eff6ff', color: isEditing ? '#fff' : '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}
                            >
                              {isEditing ? '✓' : '✏️'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteQuestion(eIdx, qIdx)}
                              style={{ padding: '2px 6px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                      {editable && isEditing && (
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px', marginTop: '4px' }}>
                          <input
                            value={q.number || ''}
                            onChange={e => updateQuestion(eIdx, qIdx, { number: e.target.value })}
                            style={{ padding: '4px 6px', borderRadius: '5px', border: '1px solid #94a3b8', fontSize: '12px' }}
                          />
                          <input
                            value={q.text || ''}
                            onChange={e => updateQuestion(eIdx, qIdx, { text: e.target.value })}
                            style={{ padding: '4px 6px', borderRadius: '5px', border: '1px solid #94a3b8', fontSize: '12px', fontFamily: 'monospace' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={q.id || key} style={{ border: '1.4px solid #000', marginBottom: '12px', background: '#fff' }}>
                    {/* Top Row: Points | Question Statement | QR Code */}
                    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1.4px solid #000', minHeight: '54px' }}>
                      {/* Left Barème Cell */}
                      <div style={{
                        width: '70px',
                        flexShrink: 0,
                        background: '#f1f3f5',
                        borderRight: '1.3px solid #000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13.5px',
                        padding: '4px',
                        textAlign: 'center',
                      }}>
                        {editable ? (
                          <input
                            type="text"
                            value={q.points || ''}
                            onChange={e => updateQuestion(eIdx, qIdx, { points: e.target.value })}
                            style={{
                              width: '100%',
                              textAlign: 'center',
                              border: 'none',
                              background: 'transparent',
                              fontWeight: 700,
                              fontSize: '13.5px',
                              fontFamily: 'inherit',
                              color: '#000',
                            }}
                          />
                        ) : (q.points || '1 pt')}
                      </div>

                      {/* Center Question Statement */}
                      <div style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: '13.5px' }}>
                        <div style={{ lineHeight: 1.5 }}>
                          {renderPrimeMath(`${q.number ? `**${String(q.number).trim()}** ` : ''}${String(q.text || '').replace(/^\s+/, '')}`)}
                        </div>
                      </div>

                      {/* Right QR Cell */}
                      {meta.showQR && (
                        <div
                          style={{
                            width: '70px',
                            flexShrink: 0,
                            background: '#f1f3f5',
                            borderLeft: '1.3px solid #000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '3px',
                          }}
                          title={`QR: ${buildQuestionQrPayload(lesson, meta, eIdx, q, qIdx)}`}
                        >
                          {qrDataUrl ? (
                            <img src={qrDataUrl} alt="QR" style={{ width: '54px', height: '54px', objectFit: 'contain' }} />
                          ) : (
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>QR</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Dotted Answer Zone */}
                    <div style={{ position: 'relative', minHeight: `${minBoxHeight}px`, padding: '6px 12px 10px', background: '#fff' }}>
                      {/* Dotted Lines Background */}
                      <div style={{
                        position: 'absolute',
                        inset: '6px 10px 8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}>
                        {Array.from({ length: linesCount }).map((_, lIdx) => (
                          <div key={lIdx} style={{ height: '28px', borderBottom: `1.4px dotted ${showSolutions && hasSolution ? 'rgba(51, 65, 85, 0.32)' : '#334155'}`, width: '100%' }} />
                        ))}
                      </div>

                      {/* Concise Solution Overlay (ONLY visible when showSolutions === true) */}
                      {showSolutions && hasSolution && (
                        <div style={{
                          position: 'relative',
                          zIndex: 2,
                          color: '#1e3a8a',
                          fontFamily: meta.solutionStyle === 'handwritten' ? "'Kalam', 'Tajawal', cursive" : "'STIX Two Text', 'Times New Roman', 'Tajawal', serif",
                          fontSize: '13.5px',
                          lineHeight: '29px',
                          padding: '2px 4px',
                        }}>
                          {q.layout === 'two_columns' ? (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '6px' }}>
                                <div style={{ padding: '2px 8px', borderRight: '1.4px solid #0f172a' }}>
                                  {q.leftTitle && <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{renderPrimeMath(q.leftTitle)}</div>}
                                  {(q.leftSteps || []).map((st, sIdx) => (
                                    <div key={sIdx}>{renderPrimeMath(st)}</div>
                                  ))}
                                  {q.leftConclusion && (
                                    <div style={{ marginTop: '4px', padding: '3px 6px', background: 'rgba(254, 240, 138, 0.85)', borderRadius: '3px', fontWeight: 700, lineHeight: 1.35 }}>
                                      {renderPrimeMath(q.leftConclusion)}
                                    </div>
                                  )}
                                </div>
                                <div style={{ padding: '2px 8px' }}>
                                  {q.rightTitle && <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{renderPrimeMath(q.rightTitle)}</div>}
                                  {(q.rightSteps || []).map((st, sIdx) => (
                                    <div key={sIdx}>{renderPrimeMath(st)}</div>
                                  ))}
                                  {q.rightConclusion && (
                                    <div style={{ marginTop: '4px', padding: '3px 6px', background: 'rgba(254, 240, 138, 0.85)', borderRadius: '3px', fontWeight: 700, lineHeight: 1.35 }}>
                                      {renderPrimeMath(q.rightConclusion)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {q.finalBox && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    background: '#fef08a',
                                    border: '1.6px solid #1d4ed8',
                                    borderRadius: '3px',
                                    padding: '2px 12px',
                                    fontWeight: 700,
                                    lineHeight: 1.4,
                                  }}>
                                    {renderPrimeMath(q.finalBox)}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {(q.steps || []).map((st, sIdx) => (
                                <div key={sIdx}>{renderPrimeMath(st)}</div>
                              ))}
                              {q.finalBox && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    background: '#fef08a',
                                    border: '1.6px solid #1d4ed8',
                                    borderRadius: '3px',
                                    padding: '2px 12px',
                                    fontWeight: 700,
                                    lineHeight: 1.4,
                                  }}>
                                    {renderPrimeMath(q.finalBox)}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Per-question micro-toolbar (Editable mode only) */}
                    {editable && (
                      <div style={{
                        borderTop: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        padding: '5px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        fontFamily: 'Tajawal, sans-serif',
                        fontSize: '12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#475569', fontWeight: 700 }}>عدد سطور النقط:</span>
                          <button
                            type="button"
                            onClick={() => updateQuestion(eIdx, qIdx, { linesCount: Math.max(3, linesCount - 1) })}
                            style={{ width: '22px', height: '22px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={12} />
                          </button>
                          <strong style={{ minWidth: '18px', textAlign: 'center', color: '#0f172a' }}>{linesCount}</strong>
                          <button
                            type="button"
                            onClick={() => updateQuestion(eIdx, qIdx, { linesCount: Math.min(16, linesCount + 1) })}
                            style={{ width: '22px', height: '22px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            disabled={isSolving}
                            onClick={() => handleSolveSingleQuestion(eIdx, qIdx)}
                            style={{
                              padding: '3px 9px',
                              borderRadius: '6px',
                              border: '1px solid #f59e0b',
                              background: '#fffbeb',
                              color: '#b45309',
                              fontWeight: 700,
                              cursor: isSolving ? 'wait' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {isSolving ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                            {isSolving ? 'جاري الحل...' : 'حل مختصر (IA)'}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleQuestionStem(eIdx, qIdx)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#475569',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="تحويل إلى رأس سؤال/تعليمة بدون نقطة ولا صندوق نقط (مثلاً قبل a و b)"
                          >
                            📌 رأس سؤال (بدون نقط)
                          </button>

                          {qIdx < (ex.questions?.length || 0) - 1 && (
                            <button
                              type="button"
                              onClick={() => mergeWithNextQuestion(eIdx, qIdx)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#0369a1',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="دمج هذا السؤال مع السؤال الموالي داخل بطاقة واحدة"
                            >
                              🔗 دمج مع الموالي
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => updateQuestion(eIdx, qIdx, { layout: q.layout === 'two_columns' ? 'single' : 'two_columns' })}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: q.layout === 'two_columns' ? '#e0f2fe' : '#fff',
                              color: q.layout === 'two_columns' ? '#0369a1' : '#334155',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="تبديل بين عمود واحد أو عمودين (يمين / يسار)"
                          >
                            <Columns size={12} /> {q.layout === 'two_columns' ? 'عمودان' : 'عمود واحد'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingQKey(isEditing ? null : key)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #93c5fd',
                              background: isEditing ? '#2563eb' : '#eff6ff',
                              color: isEditing ? '#fff' : '#1d4ed8',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {isEditing ? <><Check size={12} /> إنهاء</> : <><Edit3 size={12} /> تعديل</>}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteQuestion(eIdx, qIdx)}
                            style={{
                              padding: '3px 6px',
                              borderRadius: '6px',
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="حذف السؤال"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expanded Inline Editor for Question & Concise Solution */}
                    {editable && isEditing && (
                      <div style={{
                        borderTop: '1px dashed #93c5fd',
                        background: '#f0f9ff',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        fontFamily: 'Tajawal, sans-serif',
                        fontSize: '12.5px',
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 140px', gap: '8px' }}>
                          <label>
                            <span style={{ fontWeight: 700 }}>الرقم</span>
                            <input
                              value={q.number || ''}
                              onChange={e => updateQuestion(eIdx, qIdx, { number: e.target.value })}
                              style={{ width: '100%', padding: '5px', borderRadius: '6px', border: '1px solid #94a3b8' }}
                            />
                          </label>
                          <label>
                            <span style={{ fontWeight: 700 }}>نص السؤال (LaTeX مدعوم)</span>
                            <textarea
                              rows={2}
                              value={q.text || ''}
                              onChange={e => updateQuestion(eIdx, qIdx, { text: e.target.value })}
                              style={{ width: '100%', padding: '5px', borderRadius: '6px', border: '1px solid #94a3b8', fontFamily: 'monospace', fontSize: '12px' }}
                            />
                          </label>
                          <label>
                            <span style={{ fontWeight: 700 }}>رابط QR (اختياري)</span>
                            <input
                              value={q.qrUrl || ''}
                              onChange={e => updateQuestion(eIdx, qIdx, { qrUrl: e.target.value })}
                              placeholder="تلقائي (السؤال + النقطة)"
                              style={{ width: '100%', padding: '5px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '11.5px' }}
                            />
                          </label>
                        </div>

                        {q.layout === 'two_columns' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <span style={{ fontWeight: 700 }}>خطوات العمود الأيسر (كل سطر خطوة):</span>
                              <textarea
                                rows={4}
                                value={(q.leftSteps || []).join('\n')}
                                onChange={e => updateQuestion(eIdx, qIdx, { leftSteps: e.target.value.split('\n') })}
                                style={{ width: '100%', padding: '5px', borderRadius: '6px', border: '1px solid #94a3b8', fontFamily: 'monospace', fontSize: '12px' }}
                              />
                              <input
                                value={q.leftConclusion || ''}
                                onChange={e => updateQuestion(eIdx, qIdx, { leftConclusion: e.target.value })}
                                placeholder="الاستنتاج الأيسر (يُبرز بالأصفر)"
                                style={{ width: '100%', marginTop: '4px', padding: '5px', borderRadius: '6px', border: '1px solid #eab308', background: '#fefce8' }}
                              />
                            </div>
                            <div>
                              <span style={{ fontWeight: 700 }}>خطوات العمود الأيمن (كل سطر خطوة):</span>
                              <textarea
                                rows={4}
                                value={(q.rightSteps || []).join('\n')}
                                onChange={e => updateQuestion(eIdx, qIdx, { rightSteps: e.target.value.split('\n') })}
                                style={{ width: '100%', padding: '5px', borderRadius: '6px', border: '1px solid #94a3b8', fontFamily: 'monospace', fontSize: '12px' }}
                              />
                              <input
                                value={q.rightConclusion || ''}
                                onChange={e => updateQuestion(eIdx, qIdx, { rightConclusion: e.target.value })}
                                placeholder="الاستنتاج الأيمن (يُبرز بالأصفر)"
                                style={{ width: '100%', marginTop: '4px', padding: '5px', borderRadius: '6px', border: '1px solid #eab308', background: '#fefce8' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <label>
                            <span style={{ fontWeight: 700 }}>خطوات الحل المختصر (سطر لكل مرحلة — LaTeX مدعوم):</span>
                            <textarea
                              rows={4}
                              value={(q.steps || []).join('\n')}
                              onChange={e => updateQuestion(eIdx, qIdx, { steps: e.target.value.split('\n') })}
                              placeholder="On a : $... = ...$"
                              style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #94a3b8', fontFamily: 'monospace', fontSize: '12px' }}
                            />
                          </label>
                        )}

                        <label>
                          <span style={{ fontWeight: 700 }}>النتيجة النهائية / الاستنتاج المؤطّر بالأصفر (Final Box):</span>
                          <input
                            value={q.finalBox || ''}
                            onChange={e => updateQuestion(eIdx, qIdx, { finalBox: e.target.value })}
                            placeholder="مثال: $= 1$ أو D'où la fonction $f$ est continue en $-1$."
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1.5px solid #2563eb', background: '#fef9c3', fontWeight: 700 }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
