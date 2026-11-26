// src/components/editor/LessonSectionSplitEditor.jsx
// Modern Split-View Section Editor: clean left editor pane (non-intrusive inline LaTeX chips,
// content textarea, collapsible AI-powered solution editor, clean figure manager)
// paired with an instant live KaTeX preview pane on the right.

import { useState, useRef, useEffect } from 'react';
import {
  ChevronUp, ChevronDown, MoreHorizontal, Copy, Trash2,
  Sparkles, Wand2, Loader2, CheckCircle2, ChevronRight,
  Image as ImageIcon, Crop, Upload, Sigma, AlertTriangle,
  AlignLeft, AlignCenter, AlignRight, Heading
} from 'lucide-react';
import { renderWithMath, autoRepairMathText } from '../../utils/mathRenderer';
import { ensureMathDelimiters } from '../../utils/devoirPrimeHelpers';
import { validateExercisePoints } from '../../utils/scoreBalancingValidator';
import {
  getSectionImageEntries,
  getSectionImageMap,
  getReferencedFigIds,
  splitTextByFigureTokens,
  resolveFigureItem,
} from '../../utils/figureShortcodes';
import SmartTableRenderer from '../SmartTableRenderer';

const SECTION_TYPES = [
  { id: 'content', label: 'Paragraphe', labelFr: 'Paragraphe', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
  { id: 'definition', label: 'Définition', labelFr: 'Définition', color: '#4338ca', bg: 'rgba(67, 56, 202, 0.1)' },
  { id: 'theorem', label: 'Théorème', labelFr: 'Théorème', color: '#b91c1c', bg: 'rgba(185, 28, 28, 0.1)' },
  { id: 'property', label: 'Propriété', labelFr: 'Propriété', color: '#0369a1', bg: 'rgba(3, 105, 161, 0.1)' },
  { id: 'corollary', label: 'Corollaire', labelFr: 'Corollaire', color: '#0f766e', bg: 'rgba(15, 118, 110, 0.1)' },
  { id: 'methode', label: 'Méthode', labelFr: 'Méthode', color: '#b45309', bg: 'rgba(180, 83, 9, 0.1)' },
  { id: 'demonstration', label: 'Démonstration', labelFr: 'Démonstration', color: '#475569', bg: 'rgba(71, 85, 105, 0.12)' },
  { id: 'example', label: 'Exemple', labelFr: 'Exemple', color: '#047857', bg: 'rgba(4, 120, 87, 0.1)' },
  { id: 'remark', label: 'Remarque', labelFr: 'Remarque', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
  { id: 'activity', label: 'Activité', labelFr: 'Activité', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.1)' },
  { id: 'exercise', label: 'Exercice', labelFr: 'Exercice', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
];

const QUICK_CHIPS = [
  { label: 'a/b', latex: '\\dfrac{a}{b}', title: 'Fraction' },
  { label: '√x', latex: '\\sqrt{x}', title: 'Racine carrée' },
  { label: 'lim', latex: '\\lim_{x \\to x_0}', title: 'Limite' },
  { label: 'x²', latex: 'x^{2}', title: 'Puissance / Exposant' },
  { label: 'uₙ', latex: 'u_{n}', title: 'Indice' },
  { label: '→', latex: '\\to', title: 'Tend vers' },
  { label: '∈', latex: '\\in', title: 'Appartient à' },
  { label: 'ℝ', latex: '\\mathbb{R}', title: 'Ensemble des réels' },
  { label: '∫', latex: '\\int_{a}^{b} f(x)\\,dx', title: 'Intégrale' },
  { label: '⇔', latex: '\\Leftrightarrow', title: 'Équivalence' },
  { label: 'vec', latex: '\\overrightarrow{AB}', title: 'Vecteur' },
  { label: '{...}', latex: '\\begin{cases} a \\\\ b \\end{cases}', title: 'Système' },
];

const BG_PRESETS = [
  { label: 'Transparent', val: 'transparent', swatch: '#ffffff', border: '#cbd5e1' },
  { label: 'Bleu doux', val: '#f0f9ff', swatch: '#f0f9ff', border: '#bae6fd' },
  { label: 'Jaune doux', val: '#fefce8', swatch: '#fefce8', border: '#fde047' },
  { label: 'Vert menthe', val: '#f0fdf4', swatch: '#f0fdf4', border: '#86efac' },
  { label: 'Gris clair', val: '#f8fafc', swatch: '#f8fafc', border: '#cbd5e1' },
];

function renderPreviewFigureCard(imgItem, key) {
  const align = imgItem.align || 'center';
  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  return (
    <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: justify, margin: '0.55rem 0' }}>
      <img
        src={imgItem.url || imgItem.src}
        alt={imgItem.alt || 'Figure'}
        style={{
          width: `${imgItem.width_pct || 75}%`,
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          background: '#fff',
        }}
      />
      {imgItem.alt && (
        <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', fontStyle: 'italic' }}>
          {imgItem.alt}
        </span>
      )}
    </div>
  );
}

function renderPreviewParagraphs(rawText, isAr, imageMap = null) {
  if (!rawText || !String(rawText).trim()) return null;
  const segments = splitTextByFigureTokens(String(rawText));
  const out = [];

  segments.forEach((seg, segIdx) => {
    if (seg.type === 'figure') {
      const resolved = resolveFigureItem(imageMap, seg);
      if (resolved) {
        out.push(renderPreviewFigureCard(resolved, `fig-${segIdx}-${seg.figId}`));
      } else {
        out.push(
          <div
            key={`missing-fig-${segIdx}`}
            style={{
              margin: '0.35rem 0',
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              background: '#fef3c7',
              border: '1px dashed #f59e0b',
              color: '#92400e',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'inline-block',
            }}
          >
            ⚠️ {seg.rawToken} (image introuvable dans cet exercice)
          </div>
        );
      }
      return;
    }

    const safe = ensureMathDelimiters(seg.value);
    const lines = safe.split(/\n/);
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (i > 0 && i < lines.length - 1) {
          out.push(<div key={`sp-${segIdx}-${i}`} style={{ height: '0.4rem' }} />);
        }
        return;
      }
      out.push(
        <div
          key={`ln-${segIdx}-${i}`}
          style={{
            marginBottom: '0.32rem',
            lineHeight: 1.7,
            direction: isAr ? 'rtl' : 'ltr',
            textAlign: isAr ? 'right' : 'left',
            wordBreak: 'break-word',
          }}
        >
          {renderWithMath(trimmed)}
        </div>
      );
    });
  });

  return out;
}

export default function LessonSectionSplitEditor({
  section,
  secIdx,
  totalSections,
  viewMode = 'split', // 'split' | 'write' | 'preview'
  isArMode = false,
  isMobile = false,
  onUpdateSection,
  onUpdateItem,
  onAddImageFile,
  onRemoveItem,
  onMoveSection,
  onDuplicateSection,
  onDeleteSection,
  onSolveSection,
  solvingSecIdx = null,
  onOpenCropper,
  onOpenAiEnhancer,
  onOpenLatexPalette,
  onRegisterActiveTextarea,
  onInsertSnippet,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHeaderField, setShowHeaderField] = useState(Boolean(section.section_header));
  const [solutionExpanded, setSolutionExpanded] = useState(
    Boolean(section.solution && String(section.solution).trim())
  );
  const [uploadingImg, setUploadingImg] = useState(false);
  const [copiedToken, setCopiedToken] = useState('');

  const menuRef = useRef(null);
  const contentRef = useRef(null);
  const solutionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync expanded states if user switches section in Focus Mode
  useEffect(() => {
    setShowHeaderField(Boolean(section.section_header));
    setSolutionExpanded(Boolean(section.solution && String(section.solution).trim()));
    setMenuOpen(false);
  }, [section.id, secIdx]);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const typeMeta = SECTION_TYPES.find(t => t.id === section.type) || SECTION_TYPES[0];
  const secIsAr = section.language === 'ar' || isArMode || /[\u0600-\u06FF]/.test((section.title || '') + (section.content || ''));
  const isSolving = solvingSecIdx === secIdx;
  const hasSolution = Boolean(section.solution && String(section.solution).trim());

  const imageEntries = getSectionImageEntries(section);
  const imageItems = imageEntries.map(({ item, itemIdx, figId, token }) => ({ item, idx: itemIdx, figId, token }));
  const imageMap = getSectionImageMap(section);
  const referencedFigIds = getReferencedFigIds(section);

  const tableItems = (section.items || [])
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item?.type === 'table' && item.table_data);

  const handleCopyFigureToken = async (item, itemIdx, figId, token) => {
    if (!item.figId) {
      onUpdateItem(secIdx, itemIdx, 'figId', figId);
    }
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      // Fallback copy
      const ta = document.createElement('textarea');
      ta.value = token;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(prev => (prev === token ? '' : prev)), 1600);
  };

  const handleInsertFigureToken = (field, item, itemIdx, figId, token) => {
    if (!item.figId) {
      onUpdateItem(secIdx, itemIdx, 'figId', figId);
    }
    if (field === 'solution' && !solutionExpanded) {
      setSolutionExpanded(true);
    }
    const currentText = String(section[field] || '');
    const ta = field === 'solution' ? solutionRef.current : contentRef.current;

    let nextText;
    let nextCursorPos = null;
    if (ta && typeof ta.selectionStart === 'number') {
      const start = ta.selectionStart;
      const end = ta.selectionEnd ?? start;
      const before = currentText.slice(0, start);
      const after = currentText.slice(end);
      const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
      const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
      const insertChunk = `${prefix}${token}${suffix}`;
      nextText = before + insertChunk + after;
      nextCursorPos = start + insertChunk.length;
    } else {
      nextText = currentText.trim()
        ? `${currentText.replace(/\s+$/, '')}\n${token}\n`
        : `${token}\n`;
    }

    onUpdateSection(secIdx, field, nextText);
    requestAnimationFrame(() => {
      const targetTa = field === 'solution' ? solutionRef.current : contentRef.current;
      if (targetTa) {
        targetTa.focus();
        if (nextCursorPos !== null) {
          targetTa.setSelectionRange(nextCursorPos, nextCursorPos);
        }
        onRegisterActiveTextarea?.(secIdx, field, targetTa);
      }
    });
  };

  const pointsCheck = section.type === 'exercise' ? validateExercisePoints(section) : null;

  const handleRepairLatex = () => {
    const fixedContent = ensureMathDelimiters(autoRepairMathText(section.content || ''));
    onUpdateSection(secIdx, 'content', fixedContent);
    if (section.solution) {
      const fixedSol = ensureMathDelimiters(autoRepairMathText(section.solution));
      onUpdateSection(secIdx, 'solution', fixedSol);
    }
  };

  const handleChipClick = (latex) => {
    // If neither content nor solution textarea is currently focused, focus content first
    const activeEl = document.activeElement;
    if (activeEl !== contentRef.current && activeEl !== solutionRef.current) {
      if (contentRef.current) {
        contentRef.current.focus();
        onRegisterActiveTextarea?.(secIdx, 'content', contentRef.current);
      }
    }
    onInsertSnippet?.(latex);
  };

  const handleLocalFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await onAddImageFile?.(secIdx, dataUrl, file.name.replace(/\.[^.]+$/, ''));
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const showEditorPane = viewMode === 'split' || viewMode === 'write';
  const showPreviewPane = viewMode === 'split' || viewMode === 'preview';
  const gridCols = !isMobile && viewMode === 'split' ? 'minmax(0, 1.05fr) minmax(0, 0.95fr)' : 'minmax(0, 1fr)';

  const renderPreviewImages = (position) => {
    const matching = imageItems.filter(
      ({ item, figId }) => !referencedFigIds.has(figId.toLowerCase()) && (item.position || 'after') === position
    );
    if (matching.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', margin: '0.65rem 0' }}>
        {matching.map(({ item, idx }) => renderPreviewFigureCard(item, idx))}
      </div>
    );
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: `3px solid ${typeMeta.color}`,
        borderRadius: '14px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
        overflow: 'visible',
      }}
    >
      {/* 1. CLEAN CARD HEADER */}
      <div
        style={{
          padding: '0.65rem 0.9rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          background: 'rgba(148, 163, 184, 0.04)',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
        }}
      >
        {/* Index Badge */}
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 900,
            padding: '0.18rem 0.45rem',
            borderRadius: '6px',
            background: typeMeta.bg,
            color: typeMeta.color,
            flexShrink: 0,
          }}
        >
          #{secIdx + 1}
        </span>

        {/* Section Type Select */}
        <select
          value={section.type || 'content'}
          onChange={e => onUpdateSection(secIdx, 'type', e.target.value)}
          style={{
            padding: '0.32rem 0.5rem',
            borderRadius: '8px',
            border: `1px solid ${typeMeta.color}44`,
            background: typeMeta.bg,
            color: typeMeta.color,
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {SECTION_TYPES.map(t => (
            <option key={t.id} value={t.id} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
              {t.label} ({t.labelFr})
            </option>
          ))}
        </select>

        {/* Editable Section Title */}
        <input
          type="text"
          value={section.title || ''}
          onChange={e => onUpdateSection(secIdx, 'title', e.target.value)}
          placeholder={section.type === 'exercise' ? 'Ex: Exercice 1 — Limites...' : 'Titre du paragraphe...'}
          style={{
            flex: 1,
            minWidth: '170px',
            padding: '0.35rem 0.65rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            fontWeight: 800,
            fontSize: '0.88rem',
            outline: 'none',
            direction: secIsAr ? 'rtl' : 'ltr',
          }}
        />

        {/* Points Input (Exercises only) */}
        {section.type === 'exercise' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <input
              type="text"
              value={section.points ?? ''}
              onChange={e => onUpdateSection(secIdx, 'points', e.target.value)}
              placeholder="pts"
              title="Barème de l'exercice"
              style={{
                width: '58px',
                padding: '0.32rem 0.45rem',
                borderRadius: '8px',
                border: '1px solid rgba(2, 132, 199, 0.35)',
                background: 'rgba(14, 165, 233, 0.08)',
                color: '#0284c7',
                fontWeight: 800,
                fontSize: '0.8rem',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>pts</span>
            {pointsCheck && !pointsCheck.isValid && pointsCheck.calculatedSum > 0 && (
              <span
                title={`La somme des sous-questions (${pointsCheck.calculatedSum}) diffère du barème total`}
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: '#d97706',
                  background: 'rgba(245, 158, 11, 0.14)',
                  padding: '0.16rem 0.4rem',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <AlertTriangle size={11} /> ∑={pointsCheck.calculatedSum}
              </span>
            )}
          </div>
        )}

        {/* Move Up / Down + Overflow Menu */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
          <button
            type="button"
            disabled={secIdx === 0}
            onClick={() => onMoveSection(secIdx, 'up')}
            className="btn-outline"
            style={{ padding: '0.3rem', borderRadius: '7px', opacity: secIdx === 0 ? 0.3 : 1 }}
            title="Monter"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            disabled={secIdx === totalSections - 1}
            onClick={() => onMoveSection(secIdx, 'down')}
            className="btn-outline"
            style={{ padding: '0.3rem', borderRadius: '7px', opacity: secIdx === totalSections - 1 ? 0.3 : 1 }}
            title="Descendre"
          >
            <ChevronDown size={14} />
          </button>

          {/* Overflow Options Menu */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              className="btn-outline"
              style={{
                padding: '0.3rem 0.45rem',
                borderRadius: '7px',
                background: menuOpen ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
              }}
              title="Options de mise en forme & actions"
            >
              <MoreHorizontal size={15} />
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: isArMode ? 0 : 'auto',
                  right: isArMode ? 'auto' : 0,
                  width: '250px',
                  zIndex: 50,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '0.65rem',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                {/* Toggle Grand Header */}
                <button
                  type="button"
                  onClick={() => { setShowHeaderField(v => !v); setMenuOpen(false); }}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.55rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-main)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Heading size={13} style={{ color: 'var(--violet)' }} />
                  {showHeaderField ? 'Masquer le grand titre (I. / II.)' : 'Ajouter un grand titre (I. / II.)'}
                </button>

                {/* Background Color */}
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    Couleur de fond
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {BG_PRESETS.map(p => (
                      <button
                        key={p.val}
                        type="button"
                        title={p.label}
                        onClick={() => {
                          onUpdateSection(secIdx, 'bgColor', p.val);
                          onUpdateSection(secIdx, 'bg_color', p.val);
                        }}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: p.swatch,
                          border: `2px solid ${(section.bgColor || 'transparent') === p.val ? 'var(--violet)' : p.border}`,
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Font size & line height */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <select
                    className="input-control"
                    value={section.fontSize || section.font_size || ''}
                    onChange={e => {
                      onUpdateSection(secIdx, 'fontSize', e.target.value);
                      onUpdateSection(secIdx, 'font_size', e.target.value);
                    }}
                    style={{ padding: '0.32rem', fontSize: '0.74rem' }}
                  >
                    <option value="">Taille normale</option>
                    <option value="8.5pt">8.5pt</option>
                    <option value="9.5pt">9.5pt</option>
                    <option value="10.5pt">10.5pt</option>
                    <option value="11.5pt">11.5pt</option>
                  </select>
                  <select
                    className="input-control"
                    value={section.lineHeight || section.line_height || ''}
                    onChange={e => {
                      onUpdateSection(secIdx, 'lineHeight', e.target.value);
                      onUpdateSection(secIdx, 'line_height', e.target.value);
                    }}
                    style={{ padding: '0.32rem', fontSize: '0.74rem' }}
                  >
                    <option value="">Interligne normal</option>
                    <option value="1.35">1.35</option>
                    <option value="1.55">1.55</option>
                    <option value="1.75">1.75</option>
                    <option value="2.0">2.0</option>
                  </select>
                </div>

                <div style={{ height: '1px', background: 'var(--border)' }} />

                {/* Duplicate & Delete */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => { onDuplicateSection(secIdx); setMenuOpen(false); }}
                    style={{
                      padding: '0.4rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Copy size={12} /> Dupliquer
                  </button>
                  <button
                    type="button"
                    onClick={() => { onDeleteSection(secIdx); setMenuOpen(false); }}
                    style={{
                      padding: '0.4rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Trash2 size={12} /> Supprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Optional Grand Section Header Input */}
      {showHeaderField && (
        <div style={{ padding: '0.5rem 0.9rem', borderBottom: '1px solid var(--border)', background: 'rgba(99, 102, 241, 0.05)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.73rem', fontWeight: 800, color: 'var(--violet)', whiteSpace: 'nowrap' }}>Grand titre :</span>
          <input
            type="text"
            value={section.section_header || ''}
            onChange={e => onUpdateSection(secIdx, 'section_header', e.target.value)}
            placeholder="Ex: I. Limite d'une fonction numérique..."
            style={{
              flex: 1,
              padding: '0.3rem 0.55rem',
              borderRadius: '7px',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          />
        </div>
      )}

      {/* 2. SPLIT VIEW BODY */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, minHeight: '280px' }}>
        {/* LEFT PANE: EDITOR */}
        {showEditorPane && (
          <div
            style={{
              padding: '0.85rem',
              borderRight: showPreviewPane && !isMobile ? '1px solid var(--border)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              minWidth: 0,
            }}
          >
            {/* Inline Quick LaTeX Chips Bar (Never blocks text!) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.28rem',
                flexWrap: 'wrap',
                padding: '0.38rem 0.5rem',
                borderRadius: '9px',
                background: 'rgba(148, 163, 184, 0.08)',
                border: '1px solid var(--border)',
              }}
            >
              {QUICK_CHIPS.map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  title={chip.title}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleChipClick(chip.latex)}
                  style={{
                    padding: '0.18rem 0.42rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    cursor: 'pointer',
                  }}
                >
                  {chip.label}
                </button>
              ))}

              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => onOpenLatexPalette?.(secIdx, 'content', contentRef.current)}
                style={{
                  padding: '0.18rem 0.48rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--violet)',
                  fontSize: '0.73rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
                title="Ouvrir la palette complète de symboles mathématiques"
              >
                <Sigma size={12} /> Symboles +
              </button>

              <button
                type="button"
                onClick={handleRepairLatex}
                style={{
                  marginLeft: 'auto',
                  padding: '0.18rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#059669',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
                title="Réparation automatique des formules LaTeX, fractions et racines"
              >
                <Wand2 size={11} /> Corriger LaTeX
              </button>
            </div>

            {/* Content Textarea */}
            <div>
              <textarea
                ref={contentRef}
                value={section.content || ''}
                onFocus={e => onRegisterActiveTextarea?.(secIdx, 'content', e.target)}
                onChange={e => onUpdateSection(secIdx, 'content', e.target.value)}
                rows={Math.min(18, Math.max(6, (section.content || '').split('\n').length + 2))}
                placeholder={
                  section.type === 'exercise'
                    ? 'Saisissez l’énoncé ici... Ex: Calculer $\\lim_{x \\to 0} \\dfrac{\\sin x}{x}$'
                    : 'Saisissez le contenu ici avec formules LaTeX entre $...$'
                }
                style={{
                  width: '100%',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  lineHeight: 1.65,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  resize: 'vertical',
                  outline: 'none',
                  direction: secIsAr ? 'rtl' : 'ltr',
                }}
              />
            </div>

            {/* Collapsible Solution Box */}
            <div
              style={{
                borderRadius: '10px',
                border: `1px solid ${hasSolution ? 'rgba(16, 185, 129, 0.38)' : 'var(--border)'}`,
                background: hasSolution ? 'rgba(16, 185, 129, 0.04)' : 'rgba(148, 163, 184, 0.03)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '0.48rem 0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  cursor: 'pointer',
                }}
                onClick={() => setSolutionExpanded(v => !v)}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.8rem', color: hasSolution ? '#059669' : 'var(--text-main)' }}>
                  <ChevronRight
                    size={15}
                    style={{
                      transform: solutionExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                  <CheckCircle2 size={14} style={{ color: hasSolution ? '#10b981' : 'var(--text-muted)' }} />
                  <span>Corrigé</span>
                  {hasSolution && (
                    <span style={{ fontSize: '0.68rem', padding: '0.08rem 0.4rem', borderRadius: '99px', background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>
                      Prêt ✓
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isSolving}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSolutionExpanded(true);
                    onSolveSection?.(secIdx);
                  }}
                  style={{
                    padding: '0.26rem 0.6rem',
                    borderRadius: '7px',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(99, 102, 241, 0.12))',
                    color: 'var(--text-main)',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: isSolving ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  {isSolving ? (
                    <><Loader2 size={12} className="animate-spin" /> Résolution...</>
                  ) : (
                    <><Sparkles size={12} style={{ color: '#f59e0b' }} /> Résoudre avec l&apos;IA</>
                  )}
                </button>
              </div>

              {solutionExpanded && (
                <div style={{ padding: '0 0.7rem 0.7rem' }}>
                  <textarea
                    ref={solutionRef}
                    value={section.solution || ''}
                    onFocus={e => onRegisterActiveTextarea?.(secIdx, 'solution', e.target)}
                    onChange={e => onUpdateSection(secIdx, 'solution', e.target.value)}
                    rows={Math.min(16, Math.max(4, (section.solution || '').split('\n').length + 1))}
                    placeholder="Saisissez le corrigé détaillé ou cliquez sur Résoudre avec l’IA..."
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.84rem',
                      lineHeight: 1.6,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                      resize: 'vertical',
                      outline: 'none',
                      direction: secIsAr ? 'rtl' : 'ltr',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Compact Figures / Images Strip */}
            <div
              style={{
                padding: '0.55rem 0.7rem',
                borderRadius: '10px',
                border: '1px dashed var(--border)',
                background: 'rgba(148, 163, 184, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ImageIcon size={13} /> Figures &amp; images ({imageItems.length})
                </span>
                <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLocalFileChange}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    disabled={uploadingImg}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-outline"
                    style={{ padding: '0.25rem 0.55rem', fontSize: '0.73rem', fontWeight: 700, borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    {uploadingImg ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Importer une image
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenCropper?.(secIdx, null)}
                    className="btn-outline"
                    style={{ padding: '0.25rem 0.55rem', fontSize: '0.73rem', fontWeight: 700, borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Crop size={12} /> Recadrer PDF
                  </button>
                </div>
              </div>

              {imageItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {imageItems.map(({ item, idx, figId, token }) => {
                    const isPlacedViaCode = referencedFigIds.has(figId.toLowerCase());
                    return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        padding: '0.5rem',
                        borderRadius: '8px',
                        background: 'var(--bg-card)',
                        border: isPlacedViaCode ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <img
                          src={item.url || item.src}
                          alt={item.alt || 'Figure'}
                          style={{ width: '54px', height: '42px', objectFit: 'contain', borderRadius: '6px', background: '#fff', border: '1px solid var(--border)' }}
                        />
                        <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <input
                            type="text"
                            value={item.alt || ''}
                            onChange={e => onUpdateItem(secIdx, idx, 'alt', e.target.value)}
                            placeholder="Légende de la figure (optionnel)"
                            style={{
                              width: '100%',
                              padding: '0.22rem 0.45rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-main)',
                              color: 'var(--text-main)',
                              fontSize: '0.74rem',
                            }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.7rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{item.width_pct || 75}%</span>
                            <input
                              type="range"
                              min={25}
                              max={100}
                              step={5}
                              value={item.width_pct || 75}
                              onChange={e => onUpdateItem(secIdx, idx, 'width_pct', Number(e.target.value))}
                              style={{ width: '72px' }}
                            />
                            <div style={{ display: 'inline-flex', gap: '2px' }}>
                              {[
                                { id: 'left', icon: AlignLeft },
                                { id: 'center', icon: AlignCenter },
                                { id: 'right', icon: AlignRight },
                              ].map(({ id: al, icon: Icon }) => (
                                <button
                                  key={al}
                                  type="button"
                                  onClick={() => onUpdateItem(secIdx, idx, 'align', al)}
                                  style={{
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border)',
                                    background: (item.align || 'center') === al ? 'var(--violet)' : 'transparent',
                                    color: (item.align || 'center') === al ? '#fff' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Icon size={11} />
                                </button>
                              ))}
                            </div>
                            {isPlacedViaCode ? (
                              <span
                                title="La figure s’affiche automatiquement à l’emplacement du shortcode"
                                style={{
                                  padding: '1px 6px',
                                  borderRadius: '99px',
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  border: '1px solid rgba(16, 185, 129, 0.35)',
                                  color: '#059669',
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                }}
                              >
                                ✓ Insérée par code
                              </span>
                            ) : (
                              <select
                                value={item.position || 'after'}
                                onChange={e => onUpdateItem(secIdx, idx, 'position', e.target.value)}
                                style={{
                                  padding: '1px 4px',
                                  borderRadius: '5px',
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-main)',
                                  color: 'var(--text-main)',
                                  fontSize: '0.69rem',
                                }}
                              >
                                <option value="before">Avant le texte</option>
                                <option value="after">Après le texte</option>
                              </select>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => onOpenAiEnhancer?.(secIdx, idx, item)}
                            title="Améliorer la qualité de la figure par IA (HD)"
                            style={{
                              padding: '0.28rem 0.45rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(139, 92, 246, 0.35)',
                              background: 'rgba(139, 92, 246, 0.1)',
                              color: '#7c3aed',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <Sparkles size={11} /> HD
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(secIdx, idx)}
                            title="Supprimer l'image"
                            style={{
                              padding: '0.28rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#ef4444',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Shortcode Positioning Toolbar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                          paddingTop: '0.35rem',
                          borderTop: '1px dashed var(--border)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleCopyFigureToken(item, idx, figId, token)}
                          title="Cliquer pour copier le code de l’image"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.18rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            background: copiedToken === token ? 'rgba(16, 185, 129, 0.14)' : 'rgba(99, 102, 241, 0.08)',
                            color: copiedToken === token ? '#059669' : '#4f46e5',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            direction: 'ltr',
                          }}
                        >
                          <Copy size={11} />
                          <span>{copiedToken === token ? 'Copié ✓' : token}</span>
                        </button>

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handleInsertFigureToken('content', item, idx, figId, token)}
                            title="Insérer le code de l’image au curseur dans l’énoncé"
                            style={{
                              padding: '0.18rem 0.5rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(37, 99, 235, 0.3)',
                              background: 'rgba(37, 99, 235, 0.08)',
                              color: '#2563eb',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            + Insérer (Énoncé)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertFigureToken('solution', item, idx, figId, token)}
                            title="Insérer le code de l’image au curseur dans le corrigé"
                            style={{
                              padding: '0.18rem 0.5rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              background: 'rgba(16, 185, 129, 0.08)',
                              color: '#059669',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            + Insérer (Corrigé)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RIGHT PANE: LIVE KATEX PAPER PREVIEW */}
        {showPreviewPane && (
          <div
            style={{
              padding: '1rem 1.15rem',
              background: '#f8fafc',
              color: '#0f172a',
              borderBottomLeftRadius: !showEditorPane ? '13px' : 0,
              borderBottomRightRadius: '13px',
              minWidth: 0,
              overflowX: 'auto',
            }}
          >
            <div
              style={{
                background: section.bgColor && section.bgColor !== 'transparent' ? section.bgColor : '#ffffff',
                border: `1px solid ${typeMeta.color}33`,
                borderLeft: secIsAr ? `1px solid ${typeMeta.color}33` : `4px solid ${typeMeta.color}`,
                borderRight: secIsAr ? `4px solid ${typeMeta.color}` : `1px solid ${typeMeta.color}33`,
                borderRadius: '10px',
                padding: '0.95rem 1.1rem',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
                fontSize: section.fontSize || '0.93rem',
                lineHeight: section.lineHeight || 1.65,
              }}
            >
              {/* Preview label */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94a3b8' }}>
                  Aperçu en direct (KaTeX)
                </span>
                {section.points && section.type === 'exercise' && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#0369a1', background: '#e0f2fe', padding: '0.1rem 0.5rem', borderRadius: '99px' }}>
                    {section.points} pts
                  </span>
                )}
              </div>

              {/* Grand Header */}
              {section.section_header && (
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: '1.05rem',
                    color: '#1e1b4b',
                    paddingBottom: '0.35rem',
                    marginBottom: '0.6rem',
                    borderBottom: '2px solid #e2e8f0',
                    direction: secIsAr ? 'rtl' : 'ltr',
                  }}
                >
                  {renderWithMath(ensureMathDelimiters(section.section_header))}
                </div>
              )}

              {/* Title */}
              {section.title && (
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.98rem',
                    color: typeMeta.color,
                    marginBottom: '0.55rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    direction: secIsAr ? 'rtl' : 'ltr',
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: typeMeta.color, flexShrink: 0 }} />
                  <span>{renderWithMath(ensureMathDelimiters(section.title))}</span>
                </div>
              )}

              {/* Before Images */}
              {renderPreviewImages('before')}

              {/* Main Rendered Math Content */}
              {section.content && String(section.content).trim() ? (
                <div style={{ color: '#0f172a' }}>
                  {renderPreviewParagraphs(section.content, secIsAr, imageMap)}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.84rem', padding: '0.6rem 0' }}>
                  Saisissez le texte de la section ou de l’exercice dans l’éditeur pour prévisualiser les formules ici...
                </div>
              )}

              {/* Tables (if any) */}
              {tableItems.map(({ item, idx }) => (
                <div key={idx} style={{ margin: '0.7rem 0' }}>
                  <SmartTableRenderer table={item.table_data} />
                </div>
              ))}

              {/* After Images */}
              {renderPreviewImages('after')}

              {/* Solution Live Preview */}
              {hasSolution && (
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '9px',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    color: '#14532d',
                  }}
                >
                  <div style={{ fontSize: '0.76rem', fontWeight: 900, color: '#15803d', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={13} /> Corrigé détaillé
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                    {renderPreviewParagraphs(section.solution, secIsAr, imageMap)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
