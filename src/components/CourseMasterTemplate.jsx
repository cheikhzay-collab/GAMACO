// src/components/CourseMasterTemplate.jsx
// Interactive Academic Textbook Viewer for `course` documents.
// Eliminates all legacy bugs (content vs items schism, missing tables, missing solutions,
// double-boxing, raw markdown stars, raw inputs shown to students, and cramped 2-column defaults).

import { useState, useMemo } from 'react';
import {
  Printer, Eye, EyeOff, BookOpen, Star, List, CheckCircle2,
  ChevronDown, ChevronRight, Sparkles, Loader2, Edit3, Minus, Plus
} from 'lucide-react';
import { renderWithMath } from '../utils/mathRenderer';
import SmartTableRenderer from './SmartTableRenderer';
import {
  getCourseMeta,
  normalizeCourseSections,
  buildCourseOutline,
} from '../utils/courseHelpers';
import { openCoursePrintWindow } from '../utils/generateCoursePDF';

function CourseParagraph({ text, isArabic }) {
  if (!text) return null;
  return (
    <div
      style={{
        marginBottom: '0.35rem',
        lineHeight: 1.75,
        direction: isArabic ? 'rtl' : 'ltr',
        textAlign: isArabic ? 'right' : 'left',
        wordBreak: 'break-word',
      }}
    >
      {renderWithMath(text)}
    </div>
  );
}

function CourseRichItem({ item, isArabic }) {
  if (!item) return null;

  if (item.type === 'image') {
    const align = item.align || 'center';
    const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
    const widthPct = Math.min(100, Math.max(25, Number(item.width_pct) || 75));
    const isRedundantAlt = !item.alt || /^(figure(\s*g[ée]om[ée]trique)?|figure|image|photo|شكل(\s*هندسي)?)$/i.test(item.alt.trim());
    return (
      <div style={{ display: 'flex', justifyContent: justify, margin: '0.85rem 0', width: '100%' }}>
        <figure
          style={{
            margin: 0,
            maxWidth: `${widthPct}%`,
            padding: '0.5rem',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
          }}
        >
          <img
            src={item.url}
            alt={item.alt || 'Figure'}
            style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '6px', objectFit: 'contain' }}
          />
          {!isRedundantAlt && (
            <figcaption style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
              {renderWithMath(item.alt)}
            </figcaption>
          )}
        </figure>
      </div>
    );
  }

  if (item.type === 'table' && item.table) {
    return (
      <div style={{ margin: '0.85rem 0', width: '100%', overflowX: 'auto' }}>
        <SmartTableRenderer table={item.table} title={item.title || ''} />
      </div>
    );
  }

  if (item.type === 'notation_grid' && Array.isArray(item.notation_columns)) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          margin: '0.75rem 0',
        }}
      >
        {item.notation_columns.map((col, cIdx) => (
          <div
            key={cIdx}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.6rem 0.8rem',
              direction: isArabic ? 'rtl' : 'ltr',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f294a', marginBottom: '0.35rem' }}>
              {renderWithMath(col.title || '')}
            </div>
            {(col.math_blocks || []).map((b, bIdx) => (
              <div key={bIdx} style={{ margin: '0.25rem 0' }}>{renderWithMath(b)}</div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (item.type === 'grid_items' && Array.isArray(item.items)) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '0.6rem 1rem',
          margin: '0.65rem 0',
          direction: isArabic ? 'rtl' : 'ltr',
        }}
      >
        {item.items.map((gi, gIdx) => {
          const txt = typeof gi === 'string' ? gi : (gi?.text || '');
          return (
            <div
              key={gIdx}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.45rem',
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                background: 'rgba(15, 41, 74, 0.03)',
                border: '1px solid #e2e8f0',
              }}
            >
              <span style={{ color: '#1d4ed8', fontWeight: 900 }}>▪</span>
              <div style={{ flex: 1 }}>{renderWithMath(txt)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

export default function CourseMasterTemplate({
  lesson = {},
  isAdmin = false,
  onEditClick = null,
  onSolveSection = null,
  solvingSectionId = null,
}) {
  const [revisionOnly, setRevisionOnly] = useState(false);
  const [showAllSolutions, setShowAllSolutions] = useState(true);
  const [openSolutions, setOpenSolutions] = useState({});
  const [fontScale, setFontScale] = useState(1.0);

  const meta = useMemo(() => getCourseMeta(lesson), [lesson]);
  const { isArabic, dir } = meta;

  const sections = useMemo(() => {
    const raw = lesson?.content?.sections || lesson?.sections || [];
    return normalizeCourseSections(raw, isArabic);
  }, [lesson, isArabic]);

  const { chapters, stats } = useMemo(() => buildCourseOutline(sections), [sections]);

  const visibleSections = useMemo(() => {
    if (!revisionOnly) return sections;
    return sections.filter(s => s.meta.isKeyBox || s.kind === 'content');
  }, [sections, revisionOnly]);

  const isSolutionOpen = (secId) => {
    if (openSolutions[secId] !== undefined) return openSolutions[secId];
    return showAllSolutions;
  };

  const toggleOneSolution = (secId) => {
    setOpenSolutions(prev => ({ ...prev, [secId]: !isSolutionOpen(secId) }));
  };

  const handleToggleAllSolutions = () => {
    const next = !showAllSolutions;
    setShowAllSolutions(next);
    setOpenSolutions({});
  };

  const scrollToChapter = (anchorId) => {
    const el = document.getElementById(`course-anchor-${anchorId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const fontStack = isArabic
    ? "'Cairo', 'Amiri', 'Noto Naskh Arabic', sans-serif"
    : "'STIX Two Text', 'Cambria', 'Georgia', serif";

  // Sequential counters for clean textbook numbering
  const counters = { def: 0, thm: 0, prop: 0, cor: 0, meth: 0, ex: 0, act: 0, exo: 0 };
  const romanList = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  let prevHeader = '';
  let chapterIdx = 0;

  return (
    <div
      dir={dir}
      style={{
        maxWidth: '980px',
        margin: '0 auto',
        fontFamily: fontStack,
        color: '#0f172a',
      }}
    >
      {/* 1. CLEAN STUDY & PRINT TOOLBAR */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.55rem',
          padding: '0.6rem 0.85rem',
          marginBottom: '1rem',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
          fontFamily: "'Inter', 'Cairo', sans-serif",
        }}
      >
        {/* Left: Full vs Key Revision Switch */}
        <div
          style={{
            display: 'inline-flex',
            padding: '3px',
            borderRadius: '9px',
            background: 'rgba(148, 163, 184, 0.12)',
            border: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            onClick={() => setRevisionOnly(false)}
            style={{
              padding: '0.32rem 0.7rem',
              borderRadius: '7px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: !revisionOnly ? '#0f294a' : 'transparent',
              color: !revisionOnly ? '#fff' : 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <BookOpen size={13} />
            <span>{isArabic ? 'الدرس كاملاً' : 'Cours complet'}</span>
          </button>
          <button
            type="button"
            onClick={() => setRevisionOnly(true)}
            style={{
              padding: '0.32rem 0.7rem',
              borderRadius: '7px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: revisionOnly ? '#b45309' : 'transparent',
              color: revisionOnly ? '#fff' : 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
            title={isArabic ? 'عرض التعاريف والمبرهنات والخصائص والمنهجيات فقط للمراجعة السريعة' : 'Afficher uniquement Définitions, Théorèmes, Propriétés et Méthodes'}
          >
            <Star size={13} />
            <span>{isArabic ? 'ملخص القوانين والمبرهنات' : 'Essentiel (Révision)'}</span>
          </button>
        </div>

        {/* Right: Solutions toggle, Font zoom, Print PDF, Admin Edit */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleToggleAllSolutions}
            className="btn-outline"
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '8px',
              fontSize: '0.76rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            {showAllSolutions ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>
              {showAllSolutions
                ? (isArabic ? 'إخفاء الحلول والبراهين' : 'Masquer corrigés')
                : (isArabic ? 'إظهار الحلول والبراهين' : 'Afficher corrigés')}
            </span>
          </button>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setFontScale(s => Math.max(0.85, Number((s - 0.08).toFixed(2))))}
              style={{ background: 'none', border: 'none', padding: '0.32rem 0.45rem', cursor: 'pointer', color: 'var(--text-main)' }}
              title="Réduire la police"
            >
              <Minus size={12} />
            </button>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', padding: '0 0.25rem' }}>
              {Math.round(fontScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setFontScale(s => Math.min(1.3, Number((s + 0.08).toFixed(2))))}
              style={{ background: 'none', border: 'none', padding: '0.32rem 0.45rem', cursor: 'pointer', color: 'var(--text-main)' }}
              title="Agrandir la police"
            >
              <Plus size={12} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => openCoursePrintWindow(lesson, { showSolutions: showAllSolutions })}
            className="btn"
            style={{
              padding: '0.38rem 0.8rem',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #0f294a, #1d4ed8)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Printer size={14} />
            <span>{isArabic ? 'طباعة PDF الأكاديمي' : 'Imprimer PDF Cours'}</span>
          </button>

          {isAdmin && typeof onEditClick === 'function' && (
            <button
              type="button"
              onClick={onEditClick}
              className="btn-outline"
              style={{
                padding: '0.36rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Edit3 size={13} />
              <span>{isArabic ? 'تعديل' : 'Modifier'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. PAPER ACADEMIC DOCUMENT CONTAINER */}
      <article
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 10px 36px rgba(15, 23, 42, 0.08)',
          padding: 'clamp(1.1rem, 3vw, 2.2rem)',
          fontSize: `${fontScale}rem`,
        }}
      >
        {/* ACADEMIC CHAPTER MASTHEAD */}
        <header
          style={{
            border: '1.5px solid #0f294a',
            borderRadius: '10px',
            overflow: 'hidden',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #0f294a 0%, #1e3a8a 100%)',
              color: '#ffffff',
              padding: '1.15rem 1.4rem 1.25rem',
              borderBottom: '3px solid #f59e0b',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#bfdbfe',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '0.45rem',
                fontFamily: "'Inter', 'Cairo', sans-serif",
              }}
            >
              <span>
                {meta.subject}
                {meta.levelLabel ? ` • ${meta.levelLabel}` : ''}
              </span>
              <span
                style={{
                  background: 'rgba(251, 191, 36, 0.2)',
                  border: '1px solid rgba(251, 191, 36, 0.55)',
                  color: '#fde68a',
                  padding: '2px 10px',
                  borderRadius: '99px',
                  fontWeight: 800,
                }}
              >
                {meta.chapterNumber
                  ? `${isArabic ? 'الفصل' : 'Chapitre'} ${meta.chapterNumber}`
                  : (isArabic ? 'درس رسمي' : 'COURS COMPLET')}
              </span>
            </div>

            <h1 style={{ margin: 0, fontSize: 'clamp(1.35rem, 2.6vw, 1.85rem)', fontWeight: 900, lineHeight: 1.28, color: '#ffffff' }}>
              {renderWithMath(meta.title)}
            </h1>
          </div>

          {/* Real Metadata Strip (only renders actually present info) */}
          {(meta.teacher || meta.school || meta.academy || meta.academicYear || meta.importance) && (
            <div
              style={{
                background: '#f8fafc',
                padding: '0.55rem 1.2rem',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.4rem 1.25rem',
                fontSize: '0.82rem',
                color: '#334155',
                fontFamily: "'Inter', 'Cairo', sans-serif",
              }}
            >
              {meta.teacher && (
                <span><strong style={{ color: '#0f294a' }}>{isArabic ? 'الأستاذ:' : 'Professeur :'}</strong> {meta.teacher}</span>
              )}
              {meta.school && (
                <span><strong style={{ color: '#0f294a' }}>{isArabic ? 'المؤسسة:' : 'Établissement :'}</strong> {meta.school}</span>
              )}
              {meta.academy && (
                <span><strong style={{ color: '#0f294a' }}>{isArabic ? 'الأكاديمية:' : 'Académie :'}</strong> {meta.academy}</span>
              )}
              {meta.academicYear && (
                <span><strong style={{ color: '#0f294a' }}>{isArabic ? 'السنة الدراسية:' : 'Année :'}</strong> {meta.academicYear}</span>
              )}
              {meta.importance && (
                <span style={{ background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: '6px', fontWeight: 800 }}>
                  {isArabic ? 'نسبة الأهمية:' : 'Importance :'} {meta.importance}
                </span>
              )}
            </div>
          )}
        </header>

        {/* PEDAGOGICAL OBJECTIVES BOX (Clean Read-Only Presentation!) */}
        {meta.hasPedagogicalBox && (
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '1.15rem',
              background: '#ffffff',
            }}
          >
            {meta.capacites && (
              <div style={{ padding: '0.7rem 0.95rem', borderInlineEnd: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '0.3rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem', fontFamily: "'Inter', 'Cairo', sans-serif" }}>
                  {isArabic ? 'القدرات المنتظرة' : 'Capacités attendues'}
                </div>
                <div style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>{renderWithMath(meta.capacites)}</div>
              </div>
            )}
            {meta.contenus && (
              <div style={{ padding: '0.7rem 0.95rem', borderInlineEnd: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '0.3rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem', fontFamily: "'Inter', 'Cairo', sans-serif" }}>
                  {isArabic ? 'المحتويات المبرمجة' : 'Contenus du programme'}
                </div>
                <div style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>{renderWithMath(meta.contenus)}</div>
              </div>
            )}
            {meta.prerequisites && (
              <div style={{ padding: '0.7rem 0.95rem', borderInlineEnd: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '0.3rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem', fontFamily: "'Inter', 'Cairo', sans-serif" }}>
                  {isArabic ? 'المكتسبات القبلية' : 'Prérequis'}
                </div>
                <div style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>{renderWithMath(meta.prerequisites)}</div>
              </div>
            )}
            {meta.leContenu && (
              <div style={{ padding: '0.7rem 0.95rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '0.3rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem', fontFamily: "'Inter', 'Cairo', sans-serif" }}>
                  {isArabic ? 'توجيهات وملاحظات' : 'Orientations pédagogiques'}
                </div>
                <div style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>{renderWithMath(meta.leContenu)}</div>
              </div>
            )}
          </section>
        )}

        {/* INTERACTIVE PLAN DU COURS (AUTOMATIC TOC) */}
        {chapters.length >= 2 && (
          <nav
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderInlineStart: '4px solid #0f294a',
              borderRadius: '10px',
              padding: '0.8rem 1.05rem',
              marginBottom: '1.35rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '0.55rem',
                fontFamily: "'Inter', 'Cairo', sans-serif",
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#0f294a', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <List size={15} /> {isArabic ? 'فهرس محاور الدرس' : 'Plan du cours'}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                {[
                  stats.definitions ? `${stats.definitions} ${isArabic ? 'تعريف' : 'Déf.'}` : '',
                  stats.theoremsAndProps ? `${stats.theoremsAndProps} ${isArabic ? 'مبرهنة/خاصية' : 'Thm/Prop.'}` : '',
                  stats.methods ? `${stats.methods} ${isArabic ? 'منهجية' : 'Méth.'}` : '',
                  stats.examples ? `${stats.examples} ${isArabic ? 'مثال' : 'Ex.'}` : '',
                  stats.activitiesAndExercises ? `${stats.activitiesAndExercises} ${isArabic ? 'تطبيق/تمرين' : 'Exo.'}` : '',
                ].filter(Boolean).join(' • ')}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.35rem 1.25rem' }}>
              {chapters.map(ch => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => scrollToChapter(ch.anchorId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.2rem 0',
                    textAlign: isArabic ? 'right' : 'left',
                    cursor: 'pointer',
                    color: '#1e293b',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.45rem',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ color: '#1d4ed8', fontWeight: 900, fontSize: '0.8rem' }}>{ch.index}.</span>
                  <span>{renderWithMath(ch.title)}</span>
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* COURSE SECTIONS */}
        {visibleSections.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
            {revisionOnly
              ? (isArabic ? 'لا توجد تعاريف أو مبرهنات مصنّفة في هذا الدرس لعرضها في وضع الملخص.' : 'Aucune définition ou propriété classifiée pour le mode révision.')
              : (isArabic ? 'محتوى هذا الدرس فارغ حالياً.' : 'Ce cours ne contient pas encore de contenu.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            {visibleSections.map((sec) => {
              const showRibbon = sec.sectionHeader && sec.sectionHeader !== prevHeader;
              if (showRibbon) {
                chapterIdx++;
                prevHeader = sec.sectionHeader;
              }
              const hasRoman = /^(?:[IVX]+|\d+)\s*[\.\-\)]/i.test(sec.sectionHeader || '');

              const { kind, meta: bMeta } = sec;
              let numTag = '';
              if (kind === 'definition') { counters.def++; numTag = `${counters.def}`; }
              else if (kind === 'theorem') { counters.thm++; numTag = `${counters.thm}`; }
              else if (kind === 'property') { counters.prop++; numTag = `${counters.prop}`; }
              else if (kind === 'corollary') { counters.cor++; numTag = `${counters.cor}`; }
              else if (kind === 'methode') { counters.meth++; numTag = `${counters.meth}`; }
              else if (kind === 'example') { counters.ex++; numTag = `${counters.ex}`; }
              else if (kind === 'activity') { counters.act++; numTag = `${counters.act}`; }
              else if (kind === 'exercise') { counters.exo++; numTag = `${counters.exo}`; }

              const kindLabel = isArabic ? bMeta.labelAr : bMeta.labelFr;
              const fullLabel = numTag ? `${kindLabel} ${numTag}` : kindLabel;
              const solOpen = isSolutionOpen(sec.id);
              const isProofKind = ['theorem', 'property', 'corollary'].includes(kind);
              const canAiSolve = isAdmin && typeof onSolveSection === 'function' && ['exercise', 'activity', 'example'].includes(kind);

              return (
                <div key={sec.id} id={`course-anchor-${sec.id}`} style={{ scrollMarginTop: '80px' }}>
                  {/* GRAND CHAPTER RIBBON */}
                  {showRibbon && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        marginTop: chapterIdx > 1 ? '1.3rem' : '0.25rem',
                        marginBottom: '0.75rem',
                        paddingBottom: '0.35rem',
                        borderBottom: '2.5px solid #0f294a',
                      }}
                    >
                      {!hasRoman && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '28px',
                            height: '26px',
                            padding: '0 8px',
                            background: '#0f294a',
                            color: '#ffffff',
                            borderRadius: '6px',
                            fontWeight: 900,
                            fontSize: '0.88rem',
                            fontFamily: "'Inter', 'Cairo', sans-serif",
                            flexShrink: 0,
                          }}
                        >
                          {romanList[chapterIdx - 1] || chapterIdx}
                        </span>
                      )}
                      <h2 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 900, color: '#0f294a', lineHeight: 1.3 }}>
                        {renderWithMath(sec.sectionHeader)}
                      </h2>
                    </div>
                  )}

                  {/* DEMONSTRATION BLOCK */}
                  {kind === 'demonstration' ? (
                    <section
                      style={{
                        borderInlineStart: '3px solid #94a3b8',
                        paddingInlineStart: '1rem',
                        paddingBlock: '0.25rem',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontStyle: 'italic', color: '#334155', marginBottom: '0.3rem', fontSize: '0.94rem' }}>
                        <span style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}>{fullLabel}</span>
                        {sec.title ? <span> — {renderWithMath(sec.title)}</span> : null}
                      </div>
                      {sec.beforeItems.map((it, i) => <CourseRichItem key={i} item={it} isArabic={sec.isArabic} />)}
                      {sec.bodyBlocks.map((blk, i) => <CourseParagraph key={i} text={blk.text} isArabic={sec.isArabic} />)}
                      {sec.afterItems.map((it, i) => <CourseRichItem key={i} item={it} isArabic={sec.isArabic} />)}
                      <div style={{ textAlign: 'end', color: '#334155', fontSize: '1.05rem', lineHeight: 1 }}>□</div>
                    </section>
                  ) : kind === 'content' ? (
                    /* PLAIN COURSE PROSE */
                    <section style={{ padding: '0.2rem 0.1rem' }}>
                      {sec.title && (
                        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.06rem', fontWeight: 800, color: '#1e3a8a' }}>
                          {renderWithMath(sec.title)}
                        </h3>
                      )}
                      {sec.accentText && (
                        <div style={{ color: '#0f766e', fontStyle: 'italic', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                          {renderWithMath(sec.accentText)}
                        </div>
                      )}
                      {sec.beforeItems.map((it, i) => <CourseRichItem key={i} item={it} isArabic={sec.isArabic} />)}
                      {sec.bodyBlocks.map((blk, i) =>
                        blk.type === 'bullet' ? (
                          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', marginBottom: '0.3rem' }}>
                            <span style={{ color: '#1d4ed8', fontWeight: 900 }}>•</span>
                            <div style={{ flex: 1 }}><CourseParagraph text={blk.text} isArabic={sec.isArabic} /></div>
                          </div>
                        ) : (
                          <CourseParagraph key={i} text={blk.text} isArabic={sec.isArabic} />
                        )
                      )}
                      {sec.afterItems.map((it, i) => <CourseRichItem key={i} item={it} isArabic={sec.isArabic} />)}
                    </section>
                  ) : (
                    /* ACADEMIC TCOLORBOX CARD */
                    <section
                      style={{
                        border: `1px solid ${bMeta.borderLight}`,
                        borderInlineStart: `4px solid ${bMeta.accent}`,
                        borderRadius: '10px',
                        background: sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : bMeta.bgLight,
                        overflow: 'hidden',
                        boxShadow: bMeta.isKeyBox ? '0 3px 12px rgba(15, 23, 42, 0.04)' : 'none',
                      }}
                    >
                      {/* Box Header */}
                      <div
                        style={{
                          padding: '0.48rem 0.95rem',
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          borderBottom: `1px solid ${bMeta.borderLight}`,
                          background: 'rgba(255, 255, 255, 0.72)',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Inter', 'Cairo', sans-serif",
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            padding: '0.14rem 0.6rem',
                            borderRadius: '6px',
                            background: bMeta.badgeBg,
                            color: bMeta.badgeColor,
                          }}
                        >
                          {fullLabel}
                        </span>

                        {sec.title && (
                          <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>
                            {renderWithMath(sec.title)}
                          </span>
                        )}

                        {sec.points && kind === 'exercise' && (
                          <span
                            style={{
                              marginInlineStart: 'auto',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              padding: '0.12rem 0.55rem',
                              borderRadius: '99px',
                              background: '#dbeafe',
                              color: '#1e40af',
                              fontFamily: "'Inter', 'Cairo', sans-serif",
                            }}
                          >
                            {sec.points} pts
                          </span>
                        )}

                        {canAiSolve && !sec.solution && (
                          <button
                            type="button"
                            disabled={solvingSectionId === sec.id}
                            onClick={() => onSolveSection(sec.originalIndex)}
                            style={{
                              marginInlineStart: 'auto',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(245, 158, 11, 0.45)',
                              background: 'rgba(254, 243, 199, 0.7)',
                              color: '#92400e',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontFamily: "'Inter', 'Cairo', sans-serif",
                            }}
                          >
                            {solvingSectionId === sec.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            <span>{isArabic ? 'حل (IA)' : 'Corrigé IA'}</span>
                          </button>
                        )}
                      </div>

                      {/* Box Body */}
                      <div style={{ padding: '0.7rem 1rem 0.8rem' }}>
                        {sec.accentText && (
                          <div style={{ color: '#0f766e', fontStyle: 'italic', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                            {renderWithMath(sec.accentText)}
                          </div>
                        )}

                        {sec.beforeItems.map((it, i) => <CourseRichItem key={i} item={it} isArabic={sec.isArabic} />)}

                        {sec.bodyBlocks.map((blk, i) => {
                          if (blk.type === 'bullet') {
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', marginBottom: '0.3rem' }}>
                                <span style={{ color: bMeta.accent, fontWeight: 900 }}>•</span>
                                <div style={{ flex: 1 }}><CourseParagraph text={blk.text} isArabic={sec.isArabic} /></div>
                              </div>
                            );
                          }
                          if (blk.type === 'highlight_box') {
                            return (
                              <div key={i} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.55rem 0.8rem', margin: '0.45rem 0' }}>
                                <CourseParagraph text={blk.text} isArabic={sec.isArabic} />
                              </div>
                            );
                          }
                          return <CourseParagraph key={i} text={blk.text} isArabic={sec.isArabic} />;
                        })}

                        {sec.afterItems.map((it, i) => <CourseRichItem key={i} item={it} isArabic={sec.isArabic} />)}

                        {/* COLLAPSIBLE SOLUTION / PROOF BLOCK (works on ALL section types!) */}
                        {sec.solution && (
                          <div
                            style={{
                              marginTop: '0.65rem',
                              borderRadius: '8px',
                              border: '1px solid #86efac',
                              background: '#f0fdf4',
                              overflow: 'hidden',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleOneSolution(sec.id)}
                              style={{
                                width: '100%',
                                padding: '0.42rem 0.75rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontWeight: 800,
                                fontSize: '0.82rem',
                                color: '#15803d',
                                fontFamily: "'Inter', 'Cairo', sans-serif",
                              }}
                            >
                              {solOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              <CheckCircle2 size={14} />
                              <span>
                                {isProofKind
                                  ? (isArabic ? 'البرهان (Démonstration)' : 'Démonstration')
                                  : (isArabic ? 'الحل النموذجي (Corrigé)' : 'Correction détaillée')}
                              </span>
                            </button>

                            {solOpen && (
                              <div style={{ padding: '0.2rem 0.9rem 0.75rem', borderTop: '1px dashed #86efac', color: '#14532d', fontSize: '0.94em' }}>
                                {sec.solution.split(/\n/).filter(l => l.trim()).map((line, lIdx) => (
                                  <CourseParagraph key={lIdx} text={line.trim()} isArabic={sec.isArabic} />
                                ))}
                                {isProofKind && (
                                  <div style={{ textAlign: 'end', color: '#15803d', fontSize: '1.05rem', lineHeight: 1 }}>□</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </section>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </article>
    </div>
  );
}
