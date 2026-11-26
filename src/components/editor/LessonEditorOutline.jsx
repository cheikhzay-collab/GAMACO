// src/components/editor/LessonEditorOutline.jsx
// Clean, fast Document Outline sidebar for jumping between sections/exercises,
// reordering, tracking total points, and toggling Focus Mode vs All View.

import {
  Plus, Sparkles, ChevronUp, ChevronDown, CheckCircle2,
  Image as ImageIcon, Loader2, Layers, Target, BookOpen
} from 'lucide-react';
import { validateExercisePoints } from '../../utils/scoreBalancingValidator';

const TYPE_META = {
  definition: { label: 'Définition', color: '#4338ca', bg: 'rgba(67, 56, 202, 0.12)' },
  theorem: { label: 'Théorème', color: '#b91c1c', bg: 'rgba(185, 28, 28, 0.12)' },
  property: { label: 'Propriété', color: '#0369a1', bg: 'rgba(3, 105, 161, 0.12)' },
  corollary: { label: 'Corollaire', color: '#0f766e', bg: 'rgba(15, 118, 110, 0.12)' },
  methode: { label: 'Méthode', color: '#b45309', bg: 'rgba(180, 83, 9, 0.12)' },
  demonstration: { label: 'Démonstration', color: '#475569', bg: 'rgba(71, 85, 105, 0.14)' },
  example: { label: 'Exemple', color: '#047857', bg: 'rgba(4, 120, 87, 0.12)' },
  remark: { label: 'Remarque', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' },
  activity: { label: 'Activité', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.12)' },
  exercise: { label: 'Exercice', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)' },
  content: { label: 'Paragraphe', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)' },
};

export default function LessonEditorOutline({
  sections = [],
  activeIdx = 0,
  onSelectSection,
  focusMode = true,
  onToggleFocusMode,
  onAddSection,
  onMoveSection,
  onSolveAll,
  solvingAll = false,
  solveAllProgress = null,
  isArMode = false,
}) {
  const totalPoints = sections.reduce((sum, sec) => {
    if (sec.type !== 'exercise') return sum;
    const pts = parseFloat(String(sec.points || '').replace(',', '.'));
    if (!isNaN(pts) && pts > 0) return sum + pts;
    const vb = validateExercisePoints(sec);
    return sum + (vb?.calculatedSum || 0);
  }, 0);

  const solvedCount = sections.filter(s => s.solution && String(s.solution).trim()).length;
  const exerciseCount = sections.filter(s => s.type === 'exercise' || s.type === 'activity').length;

  return (
    <aside
      style={{
        width: '265px',
        flexShrink: 0,
        position: 'sticky',
        top: '74px',
        maxHeight: 'calc(100vh - 92px)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* Top Outline Header */}
      <div style={{
        padding: '0.8rem 0.9rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={15} style={{ color: 'var(--violet)' }} />
            Plan du document ({sections.length})
          </span>
          {totalPoints > 0 && (
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.12rem 0.45rem',
              borderRadius: '99px',
              background: 'rgba(14, 165, 233, 0.14)',
              color: '#0284c7',
            }}>
              {Number(totalPoints.toFixed(2))} pts
            </span>
          )}
        </div>

        {/* Focus vs All Switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '3px',
          padding: '3px',
          borderRadius: '8px',
          background: 'rgba(148, 163, 184, 0.1)',
          border: '1px solid var(--border)',
        }}>
          <button
            type="button"
            onClick={() => onToggleFocusMode(true)}
            style={{
              padding: '0.32rem 0.4rem',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: focusMode ? 'var(--violet)' : 'transparent',
              color: focusMode ? '#fff' : 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
            }}
            title="Éditer un seul élément à la fois (mode focus)"
          >
            <Target size={12} /> Focus (1)
          </button>
          <button
            type="button"
            onClick={() => onToggleFocusMode(false)}
            style={{
              padding: '0.32rem 0.4rem',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: !focusMode ? 'var(--violet)' : 'transparent',
              color: !focusMode ? '#fff' : 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
            }}
            title="Afficher toutes les sections et exercices à la suite"
          >
            <BookOpen size={12} /> Tout voir
          </button>
        </div>
      </div>

      {/* Scrollable Sections List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
      }}>
        {sections.length === 0 ? (
          <div style={{ padding: '1.5rem 0.75rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Aucune section pour le moment. Ajoutez un paragraphe ou un exercice ci-dessous.
          </div>
        ) : (
          sections.map((sec, idx) => {
            const meta = TYPE_META[sec.type] || TYPE_META.content;
            const isSelected = activeIdx === idx;
            const hasSol = Boolean(sec.solution && String(sec.solution).trim());
            const imgCount = Array.isArray(sec.items) ? sec.items.filter(it => it?.type === 'image' && (it.url || it.src)).length : 0;
            const cleanTitle = (sec.title || sec.section_header || (sec.type === 'exercise' ? `Exercice ${idx + 1}` : `Section ${idx + 1}`))
              .replace(/\*\*/g, '')
              .trim();

            return (
              <div
                key={sec.id || idx}
                onClick={() => onSelectSection(idx)}
                style={{
                  padding: '0.5rem 0.6rem',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  border: isSelected ? '1.5px solid var(--violet)' : '1px solid transparent',
                  background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.14s ease',
                }}
              >
                <span style={{
                  fontSize: '0.67rem',
                  fontWeight: 800,
                  padding: '0.12rem 0.38rem',
                  borderRadius: '5px',
                  background: meta.bg,
                  color: meta.color,
                  flexShrink: 0,
                }}>
                  {meta.label}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 800 : 600,
                    color: 'var(--text-main)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    direction: isArMode ? 'rtl' : 'ltr',
                  }}>
                    {cleanTitle}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
                    {sec.points ? (
                      <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#0284c7' }}>{sec.points} pt</span>
                    ) : null}
                    {hasSol && (
                      <span style={{ fontSize: '0.67rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>
                        <CheckCircle2 size={10} /> Corrigé
                      </span>
                    )}
                    {imgCount > 0 && (
                      <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <ImageIcon size={10} /> {imgCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Compact Up / Down Reorder */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', opacity: isSelected ? 1 : 0.45 }} onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMoveSection(idx, 'up')}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: idx === 0 ? 'default' : 'pointer', color: 'var(--text-muted)', opacity: idx === 0 ? 0.25 : 1, lineHeight: 1 }}
                    title="Monter"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sections.length - 1}
                    onClick={() => onMoveSection(idx, 'down')}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: idx === sections.length - 1 ? 'default' : 'pointer', color: 'var(--text-muted)', opacity: idx === sections.length - 1 ? 0.25 : 1, lineHeight: 1 }}
                    title="Descendre"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Quick Add + AI Solve All */}
      <div style={{
        padding: '0.65rem',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
        background: 'rgba(148, 163, 184, 0.04)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={() => onAddSection('content')}
            className="btn-outline"
            style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 800, justifyContent: 'center', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Plus size={13} /> Paragraphe
          </button>
          <button
            type="button"
            onClick={() => onAddSection('exercise')}
            className="btn-outline"
            style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 800, justifyContent: 'center', borderRadius: '8px', color: '#dc2626', borderColor: 'rgba(220, 38, 38, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Plus size={13} /> Exercice
          </button>
        </div>

        {exerciseCount > 0 && typeof onSolveAll === 'function' && (
          <button
            type="button"
            disabled={solvingAll}
            onClick={onSolveAll}
            style={{
              width: '100%',
              padding: '0.45rem 0.65rem',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(99, 102, 241, 0.12))',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.75rem',
              cursor: solvingAll ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
            }}
          >
            {solvingAll ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Résolution ({solveAllProgress?.current || 0}/{solveAllProgress?.total || exerciseCount})...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} style={{ color: '#f59e0b' }} />
                <span>Tout résoudre (IA) • {solvedCount}/{exerciseCount}</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
