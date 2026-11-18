// src/utils/generateCoursePDF.js
// Dedicated publication-grade A4 Academic Textbook PDF Engine for `course` documents.
// Inspired by French/Moroccan LaTeX `tcolorbox` + `Book` typography:
//  - Strict 1-column textbook default (optional 2-column toggle, never polluted by exercise settings)
//  - True centered display math ($$...$$), full KaTeX inline CSS, zero raw LaTeX leaks
//  - Zero emojis, zero double-boxing, zero hardcoded fake school names
//  - Full RTL (Arabic) and LTR (French) support, automatic Plan du cours, running headers & Page X / N
//  - Bonus 1-click "Mode Révision" (Definitions/Theorems/Properties/Methods only) right inside the print bar!

import katex from 'katex';
import katexCss from 'katex/dist/katex.min.css?inline';
import {
  getCourseMeta,
  normalizeCourseSections,
  buildCourseOutline,
} from './courseHelpers';
import { ensureMathDelimiters } from './devoirPrimeHelpers';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLatexPiece(latex, displayMode = false) {
  try {
    return katex.renderToString(String(latex || '').trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
    });
  } catch {
    return `<code>${esc(latex)}</code>`;
  }
}

/**
 * Renders mixed text + $$display$$ + $inline$ + **bold** safely to HTML with KaTeX.
 */
function renderCourseHtmlText(rawText) {
  if (!rawText) return '';
  const text = ensureMathDelimiters(String(rawText));

  // Tokenize $$...$$, \[...\], $...$, \(...\)
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|(?<!\\)\$(?!\$)([^$\n]+?)(?<!\\)\$|\\\([\s\S]+?\\\))/g;
  let out = '';
  let lastIndex = 0;
  let match;

  const formatPlain = (plain) => {
    let s = esc(plain);
    // Bold **...**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Line breaks
    s = s.replace(/\n/g, '<br/>');
    return s;
  };

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out += formatPlain(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('$$') && token.endsWith('$$')) {
      out += `<div class="course-display-math">${renderLatexPiece(token.slice(2, -2), true)}</div>`;
    } else if (token.startsWith('\\[') && token.endsWith('\\]')) {
      out += `<div class="course-display-math">${renderLatexPiece(token.slice(2, -2), true)}</div>`;
    } else if (token.startsWith('\\(') && token.endsWith('\\)')) {
      out += `<span class="course-inline-math">${renderLatexPiece(token.slice(2, -2), false)}</span>`;
    } else if (token.startsWith('$') && token.endsWith('$')) {
      out += `<span class="course-inline-math">${renderLatexPiece(token.slice(1, -1), false)}</span>`;
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    out += formatPlain(text.slice(lastIndex));
  }
  return out;
}

function renderRichItemHtml(item, isArabic) {
  if (!item) return '';
  if (item.type === 'image') {
    const align = item.align || 'center';
    const widthPct = Math.min(100, Math.max(25, Number(item.width_pct) || 75));
    const isRedundantAlt = !item.alt || /^(figure(\s*g[ée]om[ée]trique)?|figure|image|photo|شكل(\s*هندسي)?)$/i.test(item.alt.trim());
    return `
      <figure class="course-figure" style="text-align:${align};">
        <div class="course-figure-inner" style="max-width:${widthPct}%;">
          <img src="${esc(item.url)}" alt="${esc(item.alt || 'Figure')}" />
          ${!isRedundantAlt ? `<figcaption>${renderCourseHtmlText(item.alt)}</figcaption>` : ''}
        </div>
      </figure>`;
  }

  if (item.type === 'table' && item.table) {
    const tbl = item.table;
    const headers = Array.isArray(tbl.headers) ? tbl.headers : [];
    const rows = Array.isArray(tbl.rows) ? tbl.rows : [];
    if (headers.length === 0 && rows.length === 0) return '';
    return `
      <div class="course-table-wrap">
        ${item.title ? `<div class="course-table-title">${renderCourseHtmlText(item.title)}</div>` : ''}
        <table class="course-table" dir="${isArabic ? 'rtl' : 'ltr'}">
          ${headers.length ? `<thead><tr>${headers.map(h => `<th>${renderCourseHtmlText(h)}</th>`).join('')}</tr></thead>` : ''}
          <tbody>
            ${rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${renderCourseHtmlText(c)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  if (item.type === 'notation_grid' && Array.isArray(item.notation_columns)) {
    return `
      <div class="course-notation-grid">
        ${item.notation_columns.map(col => `
          <div class="course-notation-col">
            <div class="course-notation-title">${renderCourseHtmlText(col.title || '')}</div>
            ${(col.math_blocks || []).map(b => `<div class="course-notation-item">${renderCourseHtmlText(b)}</div>`).join('')}
          </div>
        `).join('')}
      </div>`;
  }

  if (item.type === 'grid_items' && Array.isArray(item.items)) {
    return `
      <div class="course-grid-items">
        ${item.items.map(gi => {
          const txt = typeof gi === 'string' ? gi : (gi?.text || '');
          return `<div class="course-grid-cell"><span class="course-bullet-dot">▪</span><div>${renderCourseHtmlText(txt)}</div></div>`;
        }).join('')}
      </div>`;
  }

  return '';
}

function renderSectionBlockHtml(sec, isArabic, counters) {
  const { kind, meta, title, accentText, bodyBlocks, beforeItems, afterItems, solution } = sec;

  // Auto-increment clean academic numbering per block type
  let numTag = '';
  if (kind === 'definition') { counters.def++; numTag = `${counters.def}`; }
  else if (kind === 'theorem') { counters.thm++; numTag = `${counters.thm}`; }
  else if (kind === 'property') { counters.prop++; numTag = `${counters.prop}`; }
  else if (kind === 'corollary') { counters.cor++; numTag = `${counters.cor}`; }
  else if (kind === 'methode') { counters.meth++; numTag = `${counters.meth}`; }
  else if (kind === 'example') { counters.ex++; numTag = `${counters.ex}`; }
  else if (kind === 'activity') { counters.act++; numTag = `${counters.act}`; }
  else if (kind === 'exercise') { counters.exo++; numTag = `${counters.exo}`; }

  const kindLabel = isArabic ? meta.labelAr : meta.labelFr;
  const fullLabel = numTag ? `${kindLabel} ${numTag}` : kindLabel;
  const isKeyRevisionItem = meta.isKeyBox || kind === 'content';

  const bodyHtml = bodyBlocks.map(blk => {
    if (blk.type === 'bullet') {
      return `<div class="course-bullet-row"><span class="course-bullet-dot" style="color:${meta.accent};">•</span><div class="course-bullet-text">${renderCourseHtmlText(blk.text)}</div></div>`;
    }
    if (blk.type === 'highlight_box') {
      return `<div class="course-inline-highlight">${renderCourseHtmlText(blk.text)}</div>`;
    }
    return `<p class="course-para">${renderCourseHtmlText(blk.text)}</p>`;
  }).join('');

  const beforeHtml = beforeItems.map(it => renderRichItemHtml(it, isArabic)).join('');
  const afterHtml = afterItems.map(it => renderRichItemHtml(it, isArabic)).join('');

  const customStyle = [
    sec.fontSize ? `font-size:${sec.fontSize};` : '',
    sec.lineHeight ? `line-height:${sec.lineHeight};` : '',
    sec.bgColor && sec.bgColor !== 'transparent' && sec.bgColor !== '#ffffff' ? `background:${sec.bgColor};` : '',
  ].filter(Boolean).join('');

  const solutionTitle = kind === 'theorem' || kind === 'property' || kind === 'corollary'
    ? (isArabic ? 'البرهان (Démonstration)' : 'Démonstration')
    : (isArabic ? 'الحل النموذجي' : 'Correction');

  const solutionHtml = solution ? `
    <div class="course-solution-block">
      <div class="course-solution-header">${solutionTitle}</div>
      <div class="course-solution-body">
        ${solution.split(/\n/).filter(l => l.trim()).map(l => `<p class="course-para">${renderCourseHtmlText(l.trim())}</p>`).join('')}
        ${(kind === 'theorem' || kind === 'property' || kind === 'corollary') ? '<div class="qed-square">□</div>' : ''}
      </div>
    </div>` : '';

  // Special clean rendering for `demonstration`
  if (kind === 'demonstration') {
    return `
      <section class="course-block course-block-demo ${isKeyRevisionItem ? 'is-key-block' : 'is-extra-block'}" style="${customStyle}">
        <div class="course-demo-header">
          <span class="course-demo-label">${esc(fullLabel)}</span>
          ${title ? `<span class="course-block-subtitle">— ${renderCourseHtmlText(title)}</span>` : ''}
        </div>
        <div class="course-demo-body">
          ${beforeHtml}
          ${bodyHtml}
          ${afterHtml}
          <div class="qed-square">□</div>
        </div>
      </section>`;
  }

  // Plain prose paragraph (`content`)
  if (kind === 'content') {
    return `
      <section class="course-block course-block-prose is-key-block" style="${customStyle}">
        ${title ? `<h3 class="course-sub-heading">${renderCourseHtmlText(title)}</h3>` : ''}
        ${accentText ? `<div class="course-accent-note">${renderCourseHtmlText(accentText)}</div>` : ''}
        ${beforeHtml}
        ${bodyHtml}
        ${afterHtml}
        ${solutionHtml}
      </section>`;
  }

  // Academic tcolorbox-style frames (`definition`, `theorem`, `property`, `corollary`, `methode`, `example`, `remark`, `activity`, `exercise`)
  return `
    <section
      class="course-block course-tcolorbox kind-${kind} ${meta.isKeyBox ? 'is-key-block' : 'is-extra-block'}"
      style="--box-accent:${meta.accent}; --box-bg:${meta.bgLight}; --box-border:${meta.borderLight}; --badge-bg:${meta.badgeBg}; --badge-color:${meta.badgeColor}; ${customStyle}"
    >
      <div class="tcolorbox-head">
        <span class="tcolorbox-tag">${esc(fullLabel)}</span>
        ${title ? `<span class="tcolorbox-title">${renderCourseHtmlText(title)}</span>` : ''}
        ${sec.points && kind === 'exercise' ? `<span class="tcolorbox-pts">${esc(sec.points)} pts</span>` : ''}
      </div>
      <div class="tcolorbox-body">
        ${accentText ? `<div class="course-accent-note">${renderCourseHtmlText(accentText)}</div>` : ''}
        ${beforeHtml}
        ${bodyHtml}
        ${afterHtml}
        ${solutionHtml}
      </div>
    </section>`;
}

/**
 * Generates the complete standalone print-ready HTML document for a `course`.
 */
export function generateCoursePDFHtml(lesson, options = {}) {
  const showSolutions = options.showSolutions !== false;
  const initialCols = options.columnsCount === 2 ? 2 : 1; // Strict 1-column textbook default!
  const meta = getCourseMeta(lesson, options);
  const { isArabic, dir } = meta;

  const rawSections = lesson?.content?.sections || lesson?.sections || [];
  const sections = normalizeCourseSections(rawSections, isArabic);
  const { chapters, stats } = buildCourseOutline(sections);

  const counters = { def: 0, thm: 0, prop: 0, cor: 0, meth: 0, ex: 0, act: 0, exo: 0 };
  let prevHeader = '';
  let chapterIdx = 0;

  const sectionsHtml = sections.map((sec) => {
    let ribbonHtml = '';
    if (sec.sectionHeader && sec.sectionHeader !== prevHeader) {
      chapterIdx++;
      prevHeader = sec.sectionHeader;
      const hasRoman = /^(?:[IVX]+|\d+)\s*[\.\-\)]/i.test(sec.sectionHeader);
      const romanList = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
      const numBadge = hasRoman ? '' : `<span class="chapter-roman">${romanList[chapterIdx - 1] || chapterIdx}</span>`;
      ribbonHtml = `
        <div class="course-chapter-ribbon">
          ${numBadge}
          <h2 class="course-chapter-title">${renderCourseHtmlText(sec.sectionHeader)}</h2>
        </div>`;
    }
    return ribbonHtml + renderSectionBlockHtml(sec, isArabic, counters);
  }).join('\n');

  const metaItems = [];
  if (meta.teacher) metaItems.push(`<span><strong>${isArabic ? 'الأستاذ:' : 'Professeur :'}</strong> ${esc(meta.teacher)}</span>`);
  if (meta.school) metaItems.push(`<span><strong>${isArabic ? 'المؤسسة:' : 'Établissement :'}</strong> ${esc(meta.school)}</span>`);
  if (meta.academy) metaItems.push(`<span><strong>${isArabic ? 'الأكاديمية:' : 'Académie :'}</strong> ${esc(meta.academy)}</span>`);
  if (meta.direction) metaItems.push(`<span><strong>${isArabic ? 'المديرية:' : 'Direction :'}</strong> ${esc(meta.direction)}</span>`);
  if (meta.academicYear) metaItems.push(`<span><strong>${isArabic ? 'السنة الدراسية:' : 'Année scolaire :'}</strong> ${esc(meta.academicYear)}</span>`);
  if (meta.importance) metaItems.push(`<span class="imp-pill">${isArabic ? 'نسبة الأهمية:' : 'Importance :'} ${esc(meta.importance)}</span>`);

  const docTitleSafe = `${meta.levelLabel ? meta.levelLabel + ' - ' : ''}${meta.title}`;
  const runningFooterLeft = meta.teacher
    ? `${isArabic ? 'ذ. ' : 'Pr. '}${meta.teacher}${meta.school ? ' • ' + meta.school : ''}`
    : (meta.school || meta.brandName);

  const fontStack = isArabic
    ? `'Cairo', 'Amiri', 'Noto Naskh Arabic', Tahoma, sans-serif`
    : `'STIX Two Text', 'Computer Modern Serif', 'Cambria', 'Georgia', serif`;

  return `<!DOCTYPE html>
<html lang="${isArabic ? 'ar' : 'fr'}" dir="${dir}">
<head>
<meta charset="UTF-8">
<base href="${typeof window !== 'undefined' ? window.location.origin : ''}/">
<title>${esc(docTitleSafe)}</title>
<style id="katex-inline-css">${katexCss}</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@500;600;700;800&family=STIX+Two+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@page {
  size: A4 portrait;
  margin: 14mm 14mm 15mm 14mm;
  @top-left {
    content: "${esc(meta.levelLabel || meta.subject)}";
    font-family: ${fontStack};
    font-size: 7.8pt;
    color: #64748b;
    font-weight: 600;
  }
  @top-right {
    content: "${esc(meta.title)}";
    font-family: ${fontStack};
    font-size: 7.8pt;
    color: #0f294a;
    font-weight: 700;
  }
  @bottom-left {
    content: "${esc(runningFooterLeft)}";
    font-family: ${fontStack};
    font-size: 7.8pt;
    color: #64748b;
  }
  @bottom-right {
    content: "${isArabic ? 'صفحة ' : 'Page '}" counter(page) " / " counter(pages);
    font-family: ${fontStack};
    font-size: 8pt;
    font-weight: 700;
    color: #0f294a;
  }
}

@page :first {
  margin-top: 10mm;
  @top-left { content: none; }
  @top-right { content: none; }
}

html { font-size: 10.2pt; }
body {
  font-family: ${fontStack};
  color: #0f172a;
  background: #e2e8f0;
  line-height: 1.65;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

/* Interactive Print Bar (Hidden on print) */
.print-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: #0f172a; color: #f8fafc;
  padding: 0.6rem 1.25rem;
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem;
  font-family: 'Inter', 'Cairo', sans-serif; font-size: 8.5pt;
  box-shadow: 0 4px 18px rgba(0,0,0,0.25);
}
.bar-group {
  display: inline-flex; align-items: center; gap: 3px;
  background: rgba(255,255,255,0.08); padding: 3px; border-radius: 99px;
  border: 1px solid rgba(255,255,255,0.14);
}
.bar-btn {
  background: transparent; border: none; color: rgba(255,255,255,0.8);
  padding: 4px 10px; border-radius: 99px; font-weight: 700; font-size: 7.8pt;
  cursor: pointer; font-family: inherit;
}
.bar-btn.active { background: #2563eb; color: #fff; }
.bar-btn:hover:not(.active) { background: rgba(255,255,255,0.12); color: #fff; }
.bar-print-btn {
  background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff;
  border: none; padding: 6px 16px; border-radius: 99px;
  font-weight: 800; font-size: 8.2pt; cursor: pointer; font-family: inherit;
}

.paper-sheet {
  max-width: 210mm;
  margin: 58px auto 32px;
  background: #ffffff;
  padding: 12mm 14mm 16mm;
  box-shadow: 0 8px 36px rgba(15, 23, 42, 0.14);
  border-radius: 4px;
}

@media print {
  body { background: #ffffff !important; }
  .print-bar { display: none !important; }
  .paper-sheet { margin: 0 !important; padding: 0 !important; box-shadow: none !important; max-width: none !important; }
}

/* PAGE 1 ACADEMIC CHAPTER MASTHEAD */
.course-masthead {
  border: 1.5px solid #0f294a;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 0.9rem;
  break-inside: avoid;
}
.masthead-top {
  background: linear-gradient(135deg, #0f294a 0%, #1e3a8a 100%);
  color: #ffffff;
  padding: 0.85rem 1.2rem 0.95rem;
  position: relative;
}
.masthead-top::after {
  content: "";
  position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, #d97706, #fbbf24, #d97706);
}
.masthead-eyebrow {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.4rem;
  font-family: 'Inter', 'Cairo', sans-serif;
  font-size: 7.8pt; font-weight: 700; letter-spacing: 0.04em;
  color: #bfdbfe; text-transform: uppercase; margin-bottom: 0.35rem;
}
.masthead-chapter-pill {
  background: rgba(251, 191, 36, 0.2); border: 1px solid rgba(251, 191, 36, 0.55);
  color: #fde68a; padding: 1px 8px; border-radius: 99px; font-weight: 800;
}
.masthead-title {
  font-size: 16pt; font-weight: 900; line-height: 1.25; color: #ffffff;
  letter-spacing: -0.01em;
}
.masthead-meta-bar {
  background: #f8fafc;
  padding: 0.45rem 1rem;
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem 1.1rem;
  font-size: 8.2pt; color: #334155;
  border-top: 1px solid #e2e8f0;
}
.masthead-meta-bar strong { color: #0f294a; }
.imp-pill {
  background: #fef3c7; color: #92400e; padding: 1px 7px; border-radius: 4px; font-weight: 800;
}

/* PEDAGOGICAL OBJECTIVES GRID */
.pedago-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;
  margin-bottom: 0.85rem; background: #ffffff; break-inside: avoid;
}
.pedago-cell {
  padding: 0.5rem 0.75rem; border-inline-end: 1px solid #cbd5e1; font-size: 8.4pt;
}
.pedago-cell:last-child { border-inline-end: none; }
.pedago-cell-title {
  font-family: 'Inter', 'Cairo', sans-serif;
  font-size: 7.4pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;
  color: #1e3a8a; margin-bottom: 0.25rem;
  border-bottom: 1px solid #e2e8f0; padding-bottom: 0.15rem;
}

/* PLAN DU COURS (AUTOMATIC TOC) */
.course-toc {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-inline-start: 3.5px solid #0f294a;
  border-radius: 6px;
  padding: 0.55rem 0.85rem;
  margin-bottom: 0.95rem;
  break-inside: avoid;
}
.course-toc-head {
  font-family: 'Inter', 'Cairo', sans-serif;
  font-size: 7.8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
  color: #0f294a; margin-bottom: 0.35rem;
  display: flex; justify-content: space-between; align-items: center;
}
.course-toc-stats { font-size: 7.4pt; color: #64748b; font-weight: 600; text-transform: none; }
.course-toc-list {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.18rem 1rem;
  font-size: 8.4pt; color: #1e293b; font-weight: 600;
}
.course-toc-item { display: flex; align-items: baseline; gap: 0.35rem; }
.toc-num { color: #1d4ed8; font-weight: 800; font-size: 7.8pt; }

/* SECTIONS FLOW */
.course-body { width: 100%; }
.course-body.cols-2 {
  column-count: 2; column-gap: 1.4rem; column-rule: 1px solid #e2e8f0;
}

/* GRAND CHAPTER RIBBON (I., II., III.) */
.course-chapter-ribbon {
  display: flex; align-items: center; gap: 0.55rem;
  margin: 1.05rem 0 0.55rem;
  padding-bottom: 0.28rem;
  border-bottom: 2px solid #0f294a;
  break-after: avoid; page-break-after: avoid;
  column-span: all;
}
.chapter-roman {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 24px; height: 22px; padding: 0 6px;
  background: #0f294a; color: #ffffff;
  font-family: 'Inter', 'Cairo', sans-serif;
  font-size: 8.5pt; font-weight: 800; border-radius: 4px; flex-shrink: 0;
}
.course-chapter-title {
  font-size: 11.4pt; font-weight: 900; color: #0f294a; line-height: 1.3;
}

/* LATEX TCOLORBOX ACADEMIC BLOCKS */
.course-block { margin-bottom: 0.65rem; break-inside: auto; }

.course-tcolorbox {
  border: 1px solid var(--box-border);
  border-inline-start: 4px solid var(--box-accent);
  border-radius: 6px;
  background: var(--box-bg);
  overflow: hidden;
  break-inside: avoid-column;
}
.tcolorbox-head {
  padding: 0.32rem 0.7rem;
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem;
  border-bottom: 1px solid var(--box-border);
  background: rgba(255,255,255,0.65);
  break-after: avoid; page-break-after: avoid;
}
.tcolorbox-tag {
  font-family: 'Inter', 'Cairo', sans-serif;
  font-size: 7.8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;
  background: var(--badge-bg); color: var(--badge-color);
  padding: 1px 8px; border-radius: 4px;
}
.tcolorbox-title {
  font-size: 9.4pt; font-weight: 800; color: #0f172a;
}
.tcolorbox-pts {
  margin-inline-start: auto;
  font-family: 'Inter', 'Cairo', sans-serif;
  font-size: 7.4pt; font-weight: 800; color: #1d4ed8;
  background: #dbeafe; padding: 1px 7px; border-radius: 99px;
}
.tcolorbox-body { padding: 0.48rem 0.8rem 0.55rem; }

/* Subtle styling for non-boxed prose & proofs */
.course-block-prose { padding: 0.15rem 0.1rem; }
.course-sub-heading {
  font-size: 10pt; font-weight: 800; color: #1e3a8a;
  margin-bottom: 0.25rem; break-after: avoid;
}
.course-block-demo {
  border-inline-start: 2.5px solid #94a3b8;
  padding-inline-start: 0.8rem;
  margin: 0.45rem 0 0.7rem;
}
.course-demo-header {
  font-style: italic; font-weight: 700; font-size: 9pt; color: #334155;
  margin-bottom: 0.2rem; break-after: avoid;
}
.course-demo-label { text-decoration: underline; text-underline-offset: 2px; }
.qed-square {
  text-align: end; font-size: 10pt; color: #334155; line-height: 1; margin-top: 0.15rem;
}

.course-accent-note {
  font-size: 8.6pt; font-style: italic; font-weight: 700; color: #0f766e; margin-bottom: 0.3rem;
}
.course-para { margin-bottom: 0.28rem; }
.course-para:last-child { margin-bottom: 0; }
.course-bullet-row {
  display: flex; align-items: baseline; gap: 0.42rem; margin-bottom: 0.24rem;
}
.course-bullet-dot { font-weight: 900; flex-shrink: 0; }
.course-bullet-text { flex: 1; }
.course-inline-highlight {
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 5px;
  padding: 0.4rem 0.65rem; margin: 0.35rem 0;
}

/* SOLUTION / CORRECTION BLOCK */
.course-solution-block {
  margin-top: 0.5rem;
  border-top: 1px dashed #86efac;
  background: #f0fdf4;
  border-radius: 5px;
  padding: 0.45rem 0.7rem;
}
.course-solution-header {
  font-family: 'Inter', 'Cairo', sans-serif;
  font-size: 7.8pt; font-weight: 800; color: #15803d; text-transform: uppercase;
  margin-bottom: 0.25rem; break-after: avoid;
}
.course-solution-body { font-size: 9.2pt; color: #14532d; }

/* TRUE CENTERED DISPLAY MATH & RTL-SAFE KATEX */
.course-display-math {
  display: block;
  text-align: center;
  margin: 0.45rem auto;
  overflow-x: auto;
  direction: ltr;
  unicode-bidi: isolate;
}
.course-display-math .katex-display {
  display: block !important;
  text-align: center !important;
  margin: 0 !important;
}
.course-inline-math, .katex {
  direction: ltr !important;
  unicode-bidi: isolate;
}

/* FIGURES & TABLES */
.course-figure { margin: 0.55rem 0; break-inside: avoid; }
.course-figure-inner { display: inline-block; padding: 5px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; }
.course-figure-inner img { width: 100%; height: auto; display: block; border-radius: 4px; }
.course-figure-inner figcaption { font-size: 7.8pt; color: #64748b; margin-top: 4px; text-align: center; font-style: italic; }

.course-table-wrap { margin: 0.55rem 0; overflow-x: auto; break-inside: avoid; }
.course-table-title { font-size: 8.2pt; font-weight: 800; color: #0f294a; margin-bottom: 0.2rem; }
.course-table { width: 100%; border-collapse: collapse; font-size: 8.6pt; }
.course-table th { background: #eff6ff; color: #0f294a; font-weight: 800; border: 1px solid #94a3b8; padding: 0.35rem 0.55rem; text-align: center; }
.course-table td { border: 1px solid #cbd5e1; padding: 0.35rem 0.55rem; text-align: center; }

.course-notation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.6rem; margin: 0.4rem 0; }
.course-notation-col { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.45rem 0.65rem; }
.course-notation-title { font-weight: 800; color: #0f294a; font-size: 8.5pt; margin-bottom: 0.25rem; }
.course-grid-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.35rem 0.85rem; margin: 0.35rem 0; }
.course-grid-cell { display: flex; align-items: baseline; gap: 0.35rem; }

/* TOGGLE STATES */
body.hide-solutions .course-solution-block,
body.hide-solutions .course-block-demo { display: none !important; }
body.revision-only .is-extra-block { display: none !important; }
</style>
</head>
<body class="${showSolutions ? '' : 'hide-solutions'}">

<div class="print-bar">
  <div style="font-weight:800; color:#93c5fd;">
    ${isArabic ? 'نسخة الدرس الأكاديمية (A4)' : 'Édition Cours Académique (A4)'}
  </div>
  <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
    <div class="bar-group">
      <button id="btnCol1" class="bar-btn ${initialCols === 1 ? 'active' : ''}" onclick="setCols(1)">1 ${isArabic ? 'عمود' : 'Col'}</button>
      <button id="btnCol2" class="bar-btn ${initialCols === 2 ? 'active' : ''}" onclick="setCols(2)">2 ${isArabic ? 'عمودين' : 'Cols'}</button>
    </div>
    <div class="bar-group">
      <button id="btnModeFull" class="bar-btn active" onclick="setRevisionMode(false)">${isArabic ? 'الدرس كاملاً' : 'Cours complet'}</button>
      <button id="btnModeRev" class="bar-btn" onclick="setRevisionMode(true)">${isArabic ? 'ملخص القوانين' : 'Essentiel'}</button>
    </div>
    <div class="bar-group">
      <button id="btnSolOn" class="bar-btn ${showSolutions ? 'active' : ''}" onclick="setSolutions(true)">${isArabic ? 'مع الحلول والبراهين' : 'Avec corrigés'}</button>
      <button id="btnSolOff" class="bar-btn ${!showSolutions ? 'active' : ''}" onclick="setSolutions(false)">${isArabic ? 'بدون حلول' : 'Sans'}</button>
    </div>
    <div class="bar-group">
      <button class="bar-btn" onclick="stepFont(-0.5)">A−</button>
      <span id="fontVal" style="padding:0 5px; font-weight:700; font-size:7.6pt;">10.2pt</span>
      <button class="bar-btn" onclick="stepFont(0.5)">A+</button>
    </div>
    <button class="bar-print-btn" onclick="window.print()">${isArabic ? 'طباعة / حفظ PDF' : 'Imprimer / PDF'}</button>
  </div>
</div>

<article class="paper-sheet">
  <!-- ACADEMIC CHAPTER MASTHEAD -->
  <header class="course-masthead">
    <div class="masthead-top">
      <div class="masthead-eyebrow">
        <span>${esc(meta.subject)}${meta.levelLabel ? ' • ' + esc(meta.levelLabel) : ''}</span>
        ${meta.chapterNumber ? `<span class="masthead-chapter-pill">${isArabic ? 'الفصل ' : 'Chapitre '}${esc(meta.chapterNumber)}</span>` : `<span class="masthead-chapter-pill">${isArabic ? 'درس رسمي' : 'COURS'}</span>`}
      </div>
      <h1 class="masthead-title">${renderCourseHtmlText(meta.title)}</h1>
    </div>
    ${metaItems.length > 0 ? `<div class="masthead-meta-bar">${metaItems.join('')}</div>` : ''}
  </header>

  <!-- PEDAGOGICAL OBJECTIVES (ONLY IF FILLED) -->
  ${meta.hasPedagogicalBox ? `
  <section class="pedago-grid">
    ${meta.capacites ? `<div class="pedago-cell"><div class="pedago-cell-title">${isArabic ? 'القدرات المنتظرة' : 'Capacités attendues'}</div><div>${renderCourseHtmlText(meta.capacites)}</div></div>` : ''}
    ${meta.contenus ? `<div class="pedago-cell"><div class="pedago-cell-title">${isArabic ? 'المحتويات المبرمجة' : 'Contenus du programme'}</div><div>${renderCourseHtmlText(meta.contenus)}</div></div>` : ''}
    ${meta.prerequisites ? `<div class="pedago-cell"><div class="pedago-cell-title">${isArabic ? 'المكتسبات القبلية' : 'Prérequis'}</div><div>${renderCourseHtmlText(meta.prerequisites)}</div></div>` : ''}
    ${meta.leContenu ? `<div class="pedago-cell"><div class="pedago-cell-title">${isArabic ? 'توجيهات وملاحظات' : 'Orientations pédagogiques'}</div><div>${renderCourseHtmlText(meta.leContenu)}</div></div>` : ''}
  </section>` : ''}

  <!-- AUTOMATIC PLAN DU COURS (WHEN 2+ CHAPTERS EXIST) -->
  ${chapters.length >= 2 ? `
  <nav class="course-toc">
    <div class="course-toc-head">
      <span>${isArabic ? 'فهرس محاور الدرس' : 'Plan du cours'}</span>
      <span class="course-toc-stats">
        ${stats.definitions ? `${stats.definitions} ${isArabic ? 'تعريف' : 'Déf.'}` : ''}
        ${stats.theoremsAndProps ? ` • ${stats.theoremsAndProps} ${isArabic ? 'مبرهنة/خاصية' : 'Thm/Prop.'}` : ''}
        ${stats.examples ? ` • ${stats.examples} ${isArabic ? 'مثال' : 'Ex.'}` : ''}
      </span>
    </div>
    <div class="course-toc-list">
      ${chapters.map(ch => `<div class="course-toc-item"><span class="toc-num">${ch.index}.</span><span>${renderCourseHtmlText(ch.title)}</span></div>`).join('')}
    </div>
  </nav>` : ''}

  <!-- COURSE BODY -->
  <div id="courseBody" class="course-body ${initialCols === 2 ? 'cols-2' : ''}">
    ${sectionsHtml}
  </div>
</article>

<script>
var _fontPt = 10.2;
function setCols(c) {
  var body = document.getElementById('courseBody');
  if (body) body.classList.toggle('cols-2', c === 2);
  document.getElementById('btnCol1').classList.toggle('active', c === 1);
  document.getElementById('btnCol2').classList.toggle('active', c === 2);
}
function setSolutions(on) {
  document.body.classList.toggle('hide-solutions', !on);
  document.getElementById('btnSolOn').classList.toggle('active', on);
  document.getElementById('btnSolOff').classList.toggle('active', !on);
}
function setRevisionMode(rev) {
  document.body.classList.toggle('revision-only', rev);
  document.getElementById('btnModeFull').classList.toggle('active', !rev);
  document.getElementById('btnModeRev').classList.toggle('active', rev);
}
function stepFont(delta) {
  _fontPt = Math.max(8, Math.min(13, Math.round((_fontPt + delta) * 10) / 10));
  document.documentElement.style.fontSize = _fontPt + 'pt';
  var el = document.getElementById('fontVal');
  if (el) el.textContent = _fontPt + 'pt';
}
</script>
</body>
</html>`;
}

/**
 * Opens the print-ready Academic Course PDF window cleanly.
 */
export function openCoursePrintWindow(lesson, options = {}) {
  const html = generateCoursePDFHtml(lesson, options);
  const w = window.open('', '_blank');
  if (!w) {
    alert('يرجى السماح بالنوافذ المنبثقة لفتح معاينة الطباعة PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
