// src/utils/generateDevoirPrimePDF.js
// Generates faithful A4 Print & PDF output for DEVOIR PRIME:
// - Page 1 ONLY: Official Moroccan cover header (with diagonal 1/N page box) + Student identity strip
// - Pages 2..N: Compact 3-part rounded running header with dynamic X / N pagination
// - Question Cards: Left barème cell + Center KaTeX statement + Right QR code cell + Dotted writing box
// - Dual Print Mode:
//   * showSolutions = false -> Clean empty dotted lines ONLY (student exam copy)
//   * showSolutions = true  -> Concise Moroccan teacher-style clean math solution in blue ink + yellow highlighted final result boxes

import QRCode from 'qrcode';
import {
  getDefaultDevoirPrimeMeta,
  normalizeToDevoirPrimeExercises,
  buildQuestionQrPayload,
  ensureMathDelimiters,
} from './devoirPrimeHelpers.js';

const escapeHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Formats text for HTML while preserving LaTeX blocks ($...$ and $$...$$) untouched for KaTeX auto-render.
 */
const formatRichMathHtml = (raw) => {
  if (!raw) return '';
  const str = ensureMathDelimiters(String(raw));
  const parts = str.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  return parts
    .map((part, idx) => {
      if (idx % 2 === 1) {
        // Inside LaTeX math block — escape only HTML angle brackets safely without breaking < or >
        return part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      return escapeHtml(part).replace(/\n/g, '<br/>');
    })
    .join('');
};

const MOROCCO_EMBLEM_SVG = `
<svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="46" stroke="#854d0e" stroke-width="2.2" fill="#fffbeb"/>
  <path d="M35 23 Q50 13 65 23 L61 28 Q50 20 39 28 Z" fill="#b45309"/>
  <circle cx="50" cy="14" r="3" fill="#b45309"/>
  <path d="M32 32 Q50 35 68 32 Q68 62 50 74 Q32 62 32 32 Z" stroke="#991b1b" stroke-width="2.2" fill="#fef2f2"/>
  <path d="M50 39 L53.5 48 L63 48 L55.5 53.5 L58.5 63 L50 57 L41.5 63 L44.5 53.5 L37 48 L46.5 48 Z" stroke="#15803d" stroke-width="2.2" fill="none"/>
  <path d="M26 78 Q50 86 74 78" stroke="#854d0e" stroke-width="2" fill="none"/>
</svg>`;

/**
 * Generates the Page 1 Official Cover Header HTML.
 */
function buildPage1CoverHeaderHtml(meta) {
  return `
  <div class="dp-cover-header">
    <table class="dp-cover-table">
      <tbody>
        <tr>
          <td class="dp-page-diag-cell" rowspan="1">
            <div class="dp-page-diag-top">الصفحة</div>
            <div class="dp-page-diag-box">
              <svg class="dp-diag-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="100" y2="100" stroke="#000" stroke-width="1.3" />
              </svg>
              <span class="dp-diag-num-top">1</span>
              <span class="dp-diag-num-bottom dp-total-pages">1</span>
            </div>
          </td>
          <td class="dp-cover-center-cell">
            <div class="dp-cover-title">${escapeHtml(meta.title)}</div>
            <div class="dp-cover-session">– ${escapeHtml(meta.semester)} ${escapeHtml(meta.academicYear)} –</div>
            <div class="dp-cover-teacher">Réalisé par : ${escapeHtml(meta.teacher)}</div>
          </td>
          <td class="dp-cover-ministry-cell">
            <div class="dp-emblem">${MOROCCO_EMBLEM_SVG}</div>
            <div class="dp-ministry-text">
              <div class="dp-m-bold">${escapeHtml(meta.ministryLine1)}</div>
              <div>${escapeHtml(meta.ministryLine2)}</div>
              <div class="dp-m-sub">${escapeHtml(meta.ministryLine3)}</div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <table class="dp-meta-table">
      <tbody>
        <tr>
          <td class="dp-meta-left-col dp-meta-handle" colspan="2">${escapeHtml(meta.handle)}</td>
          <td class="dp-meta-center-col dp-meta-subject-header">الموضوع</td>
          <td class="dp-meta-right-col dp-meta-brand">${escapeHtml(meta.brandName)}</td>
        </tr>
        <tr>
          <td class="dp-meta-val-cell">${escapeHtml(meta.duration)}</td>
          <td class="dp-meta-lbl-cell">مدة الإنجاز</td>
          <td class="dp-meta-center-col">${escapeHtml(meta.subject)}</td>
          <td class="dp-meta-right-col dp-meta-ar-bold">المادة</td>
        </tr>
        <tr>
          <td class="dp-meta-val-cell">${escapeHtml(meta.coefficient)}</td>
          <td class="dp-meta-lbl-cell">المعامل</td>
          <td class="dp-meta-center-col dp-meta-branch">${escapeHtml(meta.branch)}</td>
          <td class="dp-meta-right-col dp-meta-ar-bold">الشعبة والمسلك</td>
        </tr>
      </tbody>
    </table>

    ${meta.showStudentStrip ? `
    <table class="dp-student-strip">
      <tbody>
        <tr>
          <td class="dp-st-lbl" style="width: 118px;">Nom et prénom</td>
          <td class="dp-st-dots">................................................................</td>
          <td class="dp-st-lbl" style="width: 62px;">Classe</td>
          <td class="dp-st-dots" style="width: 130px;">.........................</td>
          <td class="dp-st-lbl" style="width: 36px;">N°</td>
          <td class="dp-st-dots" style="width: 55px;">........</td>
        </tr>
      </tbody>
    </table>` : ''}
  </div>`;
}

/**
 * Generates the Compact 3-Part Running Header HTML template (used on Pages 2..N).
 */
function buildRunningHeaderTemplateHtml(meta) {
  return `
  <div class="dp-running-header">
    <div class="dp-rh-page-box">
      <div class="dp-rh-page-lbl">الصفحة</div>
      <div class="dp-rh-page-sep"></div>
      <div class="dp-rh-page-val"><span class="dp-page-num">2</span> / <span class="dp-total-pages">1</span></div>
    </div>
    <div class="dp-rh-center-box">
      <div class="dp-rh-line1">${escapeHtml(meta.semester)} - ${escapeHtml(meta.title)} - ${escapeHtml(meta.academicYear)}</div>
      <div class="dp-rh-line2">مادة : ${escapeHtml(meta.subject)} - ${escapeHtml(meta.branch)}</div>
    </div>
    <div class="dp-rh-brand-box">${escapeHtml(meta.brandName)}</div>
  </div>`;
}

/**
 * Renders the dotted lines backdrop for a given number of lines.
 */
function buildDottedLinesHtml(linesCount) {
  const count = Math.max(3, Math.min(16, Number(linesCount) || 5));
  let html = '<div class="dp-dotted-lines-bg">';
  for (let i = 0; i < count; i++) {
    html += '<div class="dp-dotted-line"></div>';
  }
  html += '</div>';
  return html;
}

/**
 * Renders the concise solution overlay inside a question's answer zone.
 */
function buildSolutionOverlayHtml(q, solutionStyle) {
  const hasSingle = (Array.isArray(q.steps) && q.steps.length > 0) || Boolean(q.finalBox);
  const hasTwoCols = q.layout === 'two_columns' && (
    (Array.isArray(q.leftSteps) && q.leftSteps.length > 0) ||
    (Array.isArray(q.rightSteps) && q.rightSteps.length > 0)
  );

  if (!hasSingle && !hasTwoCols) return '';

  const styleCls = solutionStyle === 'handwritten' ? 'dp-sol-handwritten' : 'dp-sol-clean';

  if (hasTwoCols) {
    const leftLines = (q.leftSteps || []).map(st => `<div class="dp-sol-line">${formatRichMathHtml(st)}</div>`).join('');
    const rightLines = (q.rightSteps || []).map(st => `<div class="dp-sol-line">${formatRichMathHtml(st)}</div>`).join('');

    return `
    <div class="dp-solution-overlay ${styleCls}">
      <div class="dp-sol-two-cols">
        <div class="dp-sol-col dp-sol-col-left">
          ${q.leftTitle ? `<div class="dp-sol-col-title">${formatRichMathHtml(q.leftTitle)}</div>` : ''}
          ${leftLines}
          ${q.leftConclusion ? `<div class="dp-sol-col-conclusion">${formatRichMathHtml(q.leftConclusion)}</div>` : ''}
        </div>
        <div class="dp-sol-col dp-sol-col-right">
          ${q.rightTitle ? `<div class="dp-sol-col-title">${formatRichMathHtml(q.rightTitle)}</div>` : ''}
          ${rightLines}
          ${q.rightConclusion ? `<div class="dp-sol-col-conclusion">${formatRichMathHtml(q.rightConclusion)}</div>` : ''}
        </div>
      </div>
      ${q.finalBox ? `<div class="dp-final-box-row"><span class="dp-final-box">${formatRichMathHtml(q.finalBox)}</span></div>` : ''}
    </div>`;
  }

  const linesHtml = (q.steps || []).map(st => `<div class="dp-sol-line">${formatRichMathHtml(st)}</div>`).join('');
  return `
  <div class="dp-solution-overlay ${styleCls}">
    ${linesHtml}
    ${q.finalBox ? `<div class="dp-final-box-row"><span class="dp-final-box">${formatRichMathHtml(q.finalBox)}</span></div>` : ''}
  </div>`;
}

/**
 * Generates the complete standalone printable HTML document for DEVOIR PRIME.
 */
export async function generateDevoirPrimeHTML(lesson, options = {}) {
  const meta = {
    ...getDefaultDevoirPrimeMeta(lesson, options.settings),
    ...(options.metaOverride || {}),
  };
  const exercises = options.exercisesOverride || normalizeToDevoirPrimeExercises(lesson);
  const initialShowSolutions = options.showSolutions !== undefined ? Boolean(options.showSolutions) : true;

  // Generate real QR codes for every question if enabled
  const qrMap = {};
  if (meta.showQR) {
    for (let eIdx = 0; eIdx < exercises.length; eIdx++) {
      const ex = exercises[eIdx];
      const qs = ex.questions || [];
      for (let qIdx = 0; qIdx < qs.length; qIdx++) {
        const q = qs[qIdx];
        const key = `${eIdx}_${qIdx}`;
        const payload = buildQuestionQrPayload(lesson, meta, eIdx, q, qIdx);
        try {
          qrMap[key] = await QRCode.toDataURL(payload, { width: 96, margin: 1 });
        } catch {
          qrMap[key] = '';
        }
      }
    }
  }

  // Build flow items (exercise headers + question cards) to be auto-paginated across A4 pages
  const flowBlocksHtml = [];
  exercises.forEach((ex, eIdx) => {
    const ptsLabel = ex.points ? ` (${ex.points} points)` : '';
    flowBlocksHtml.push(`
      <div class="dp-flow-item dp-ex-heading-block" data-keep-with-next="true">
        <div class="dp-ex-title">${escapeHtml(ex.title)}${escapeHtml(ptsLabel)} :</div>
        ${ex.preamble ? `<div class="dp-ex-preamble">${formatRichMathHtml(ex.preamble)}</div>` : ''}
        ${ex.preambleImage ? `<div class="dp-ex-img"><img src="${ex.preambleImage}" alt="Figure" /></div>` : ''}
      </div>
    `);

    (ex.questions || []).forEach((q, qIdx) => {
      const qrDataUrl = qrMap[`${eIdx}_${qIdx}`] || '';
      const solHtml = buildSolutionOverlayHtml(q, meta.solutionStyle);
      const dottedHtml = buildDottedLinesHtml(q.linesCount);
      const minHeightPx = Math.max(3, Number(q.linesCount) || 5) * 29 + 14;

      flowBlocksHtml.push(`
        <div class="dp-flow-item dp-q-card">
          <div class="dp-q-header">
            <div class="dp-q-pts">${escapeHtml(q.points || '1 pt')}</div>
            <div class="dp-q-statement">
              <div class="dp-q-statement-body"><span class="dp-q-num">${escapeHtml(q.number || `${qIdx + 1}.`)}</span> <span class="dp-q-text">${formatRichMathHtml((q.text || '').replace(/^\s+/, ''))}</span></div>
              ${q.image ? `<div class="dp-q-img"><img src="${q.image}" alt="Figure" /></div>` : ''}
            </div>
            ${meta.showQR ? `
              <div class="dp-q-qr">
                ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : '<span class="dp-qr-fallback">QR</span>'}
              </div>` : ''}
          </div>
          <div class="dp-answer-zone" style="min-height: ${minHeightPx}px;">
            ${dottedHtml}
            ${solHtml}
          </div>
        </div>
      `);
    });
  });

  const coverHeaderHtml = buildPage1CoverHeaderHtml(meta);
  const runningHeaderHtml = buildRunningHeaderTemplateHtml(meta);

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <title>DEVOIR PRIME — ${escapeHtml(meta.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=STIX+Two+Text:ital,wght@0,400;0,600;0,700;1,400&family=Kalam:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      background: #e2e8f0;
      font-family: 'STIX Two Text', 'Times New Roman', 'Tajawal', serif;
      color: #000;
      font-size: 13.5px;
      line-height: 1.45;
    }

    /* Floating Print Toolbar (Screen only) */
    .dp-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      font-family: 'Tajawal', sans-serif;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    }
    .dp-toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 15px;
    }
    .dp-badge {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #fff;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.4px;
    }
    .dp-toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .dp-btn {
      border: 1px solid rgba(255, 255, 255, 0.22);
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      padding: 7px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-family: 'Tajawal', sans-serif;
      font-weight: 700;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .dp-btn:hover { background: rgba(255, 255, 255, 0.18); }
    .dp-btn-active {
      background: #0284c7;
      border-color: #38bdf8;
    }
    .dp-btn-print {
      background: linear-gradient(135deg, #10b981, #059669);
      border-color: #34d399;
    }

    /* A4 Sheet Container */
    #dp-pages-root {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
      padding: 20px 0 40px;
    }

    .dp-sheet {
      width: 210mm;
      height: 297mm;
      background: #ffffff;
      padding: 10mm 12mm 10mm 12mm;
      box-shadow: 0 6px 28px rgba(15, 23, 42, 0.18);
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .dp-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .dp-sheet-body {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* ── PAGE 1 COVER HEADER ── */
    .dp-cover-header {
      margin-bottom: 10px;
    }
    .dp-cover-table,
    .dp-meta-table,
    .dp-student-strip {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .dp-cover-table td {
      border: 1.5px solid #000;
      vertical-align: middle;
    }
    .dp-page-diag-cell {
      width: 96px;
      padding: 0;
      text-align: center;
      vertical-align: top !important;
    }
    .dp-page-diag-top {
      font-family: 'Tajawal', sans-serif;
      font-weight: 800;
      font-size: 13px;
      padding: 5px 4px;
      border-bottom: 1.4px solid #000;
      background: #fafafa;
    }
    .dp-page-diag-box {
      position: relative;
      height: 82px;
      width: 100%;
    }
    .dp-diag-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .dp-diag-num-top {
      position: absolute;
      top: 12px;
      right: 16px;
      font-size: 17px;
      font-weight: 700;
    }
    .dp-diag-num-bottom {
      position: absolute;
      bottom: 10px;
      left: 16px;
      font-size: 17px;
      font-weight: 700;
    }
    .dp-cover-center-cell {
      text-align: center;
      padding: 8px 10px;
    }
    .dp-cover-title {
      font-family: 'Tajawal', sans-serif;
      font-size: 22px;
      font-weight: 900;
      color: #000;
      line-height: 1.2;
      margin-bottom: 4px;
    }
    .dp-cover-session {
      font-family: 'Tajawal', sans-serif;
      font-size: 15px;
      font-weight: 800;
      color: #000;
      margin-bottom: 6px;
    }
    .dp-cover-teacher {
      font-family: 'STIX Two Text', Georgia, serif;
      font-size: 15px;
      font-weight: 700;
      color: #1e3a8a;
    }
    .dp-cover-ministry-cell {
      width: 185px;
      text-align: center;
      padding: 5px 6px;
    }
    .dp-emblem {
      display: flex;
      justify-content: center;
      margin-bottom: 2px;
    }
    .dp-ministry-text {
      font-family: 'Tajawal', sans-serif;
      font-size: 9.5px;
      line-height: 1.25;
      color: #000;
    }
    .dp-m-bold { font-weight: 800; font-size: 10.5px; }
    .dp-m-sub { font-weight: 700; font-size: 9px; margin-top: 2px; }

    /* Bottom metadata table attached directly to cover table */
    .dp-meta-table {
      margin-top: -1.5px;
    }
    .dp-meta-table td {
      border: 1.5px solid #000;
      text-align: center;
      padding: 4px 8px;
      font-family: 'Tajawal', sans-serif;
      font-size: 13px;
      vertical-align: middle;
    }
    .dp-meta-val-cell { width: 96px; font-weight: 700; }
    .dp-meta-lbl-cell { width: 92px; font-weight: 800; background: #fafafa; }
    .dp-meta-left-col { width: 188px; }
    .dp-meta-handle {
      font-family: 'STIX Two Text', serif;
      font-weight: 700;
      font-size: 13px;
      direction: ltr;
    }
    .dp-meta-subject-header { font-weight: 900; font-size: 14px; }
    .dp-meta-right-col { width: 185px; }
    .dp-meta-brand {
      font-family: 'STIX Two Text', Georgia, serif;
      font-weight: 800;
      font-size: 14px;
      letter-spacing: 0.5px;
    }
    .dp-meta-ar-bold { font-weight: 800; background: #fafafa; }
    .dp-meta-branch { font-weight: 600; font-size: 12.5px; line-height: 1.3; }

    /* Student Strip */
    .dp-student-strip {
      margin-top: 8px;
    }
    .dp-student-strip td {
      border: 1.4px solid #000;
      padding: 4px 8px;
      font-size: 12.5px;
      vertical-align: middle;
    }
    .dp-st-lbl {
      background: #f3f4f6;
      font-weight: 700;
      text-align: center;
    }
    .dp-st-dots {
      color: #334155;
      letter-spacing: 1px;
      overflow: hidden;
      white-space: nowrap;
    }

    /* ── PAGES 2..N COMPACT RUNNING HEADER ── */
    .dp-running-header {
      display: flex;
      align-items: stretch;
      gap: 6px;
      margin-bottom: 10px;
      height: 54px;
      flex-shrink: 0;
    }
    .dp-rh-page-box {
      width: 96px;
      border: 1.4px solid #000;
      border-radius: 7px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Tajawal', sans-serif;
      padding: 2px 4px;
    }
    .dp-rh-page-lbl { font-size: 12px; font-weight: 800; line-height: 1.1; }
    .dp-rh-page-sep { width: 70%; height: 1px; background: #000; margin: 3px 0; }
    .dp-rh-page-val { font-size: 13px; font-weight: 800; line-height: 1.1; direction: ltr; }

    .dp-rh-center-box {
      flex: 1;
      border: 1.4px solid #000;
      border-radius: 7px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-family: 'Tajawal', sans-serif;
      padding: 3px 10px;
    }
    .dp-rh-line1 { font-size: 13px; font-weight: 900; color: #000; line-height: 1.25; }
    .dp-rh-line2 { font-size: 11.5px; font-weight: 600; color: #1e293b; line-height: 1.25; }

    .dp-rh-brand-box {
      width: 96px;
      border: 1.4px solid #000;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-family: 'STIX Two Text', Georgia, serif;
      font-weight: 800;
      font-size: 13px;
      padding: 4px;
      line-height: 1.15;
    }

    /* ── EXERCISE TITLE & PREAMBLE ── */
    .dp-ex-heading-block {
      margin: 4px 0 8px 0;
    }
    .dp-ex-title {
      font-size: 15px;
      font-weight: 700;
      text-decoration: underline;
      text-underline-offset: 3px;
      color: #000;
      margin-bottom: 4px;
    }
    .dp-ex-preamble {
      font-size: 13px;
      margin-bottom: 4px;
      color: #000;
    }
    .dp-ex-img img, .dp-q-img img {
      max-width: 100%;
      max-height: 180px;
      display: block;
      margin: 6px auto;
    }

    /* ── QUESTION CARD ── */
    .dp-q-card {
      border: 1.4px solid #000;
      margin-bottom: 10px;
      background: #fff;
    }
    .dp-q-header {
      display: flex;
      align-items: stretch;
      border-bottom: 1.4px solid #000;
      min-height: 52px;
    }
    .dp-q-pts {
      width: 68px;
      flex-shrink: 0;
      background: #f1f3f5;
      border-right: 1.3px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13.5px;
      text-align: center;
      padding: 4px;
    }
    .dp-q-statement {
      flex: 1;
      padding: 7px 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      font-size: 13.5px;
      color: #000;
    }
    .dp-q-num {
      font-weight: 700;
      margin-right: 4px;
    }
    .dp-q-qr {
      width: 68px;
      flex-shrink: 0;
      background: #f1f3f5;
      border-left: 1.3px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3px;
    }
    .dp-q-qr img {
      width: 54px;
      height: 54px;
      object-fit: contain;
      display: block;
    }
    .dp-qr-fallback {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
    }

    /* ── DOTTED ANSWER ZONE ── */
    .dp-answer-zone {
      position: relative;
      padding: 6px 12px 10px;
      background: #fff;
      overflow: hidden;
    }
    .dp-dotted-lines-bg {
      position: absolute;
      inset: 6px 10px 8px 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      pointer-events: none;
      z-index: 1;
    }
    .dp-dotted-line {
      height: 28px;
      border-bottom: 1.4px dotted #334155;
      width: 100%;
    }

    /* Solution Overlay (Hidden in Student Mode!) */
    body.hide-solutions .dp-solution-overlay {
      display: none !important;
    }

    .dp-solution-overlay {
      position: relative;
      z-index: 2;
      color: #1e3a8a;
      padding: 2px 4px;
    }
    .dp-sol-clean {
      font-family: 'STIX Two Text', 'Times New Roman', 'Tajawal', serif;
      font-size: 13.5px;
      line-height: 29px;
      font-weight: 500;
    }
    .dp-sol-handwritten {
      font-family: 'Kalam', 'Tajawal', cursive;
      font-size: 14px;
      line-height: 29px;
      font-weight: 400;
    }
    .dp-sol-line {
      margin: 0;
      padding: 1px 0;
      color: #1e3a8a;
    }
    .dp-sol-line .katex {
      color: #1e3a8a !important;
    }

    /* Two-Column Solution Split (e.g., Right vs Left Derivability / Limit) */
    .dp-sol-two-cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      margin-bottom: 6px;
    }
    .dp-sol-col {
      padding: 2px 8px;
    }
    .dp-sol-col-left {
      border-right: 1.4px solid #0f172a;
    }
    .dp-sol-col-title {
      font-weight: 700;
      text-decoration: underline;
      margin-bottom: 2px;
      color: #1e3a8a;
    }
    .dp-sol-col-conclusion {
      margin-top: 4px;
      padding: 3px 6px;
      background: rgba(254, 240, 138, 0.85);
      border-radius: 3px;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.35;
    }

    /* Final Highlighted Yellow Result Box (matching uploaded images) */
    .dp-final-box-row {
      display: flex;
      justify-content: center;
      margin-top: 4px;
    }
    .dp-final-box {
      display: inline-block;
      background: #fef08a;
      border: 1.6px solid #1d4ed8;
      border-radius: 3px;
      padding: 2px 12px;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.4;
      box-shadow: 0 1px 2px rgba(29, 78, 216, 0.15);
    }
    .dp-final-box .katex {
      color: #1e3a8a !important;
    }

    /* KaTeX Root & Exponent Fixes */
    .katex { font-size: 1.03em !important; }
    .katex-display { margin: 0.25em 0 !important; }

    /* Staging area (hidden after pagination) */
    #dp-staging {
      position: absolute;
      left: -9999px;
      top: 0;
      width: 186mm; /* 210mm - 24mm horizontal padding */
      visibility: hidden;
    }

    @media print {
      body { background: #fff !important; }
      .dp-toolbar, .no-print { display: none !important; }
      #dp-pages-root { padding: 0 !important; gap: 0 !important; }
      .dp-sheet {
        box-shadow: none !important;
        margin: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
      }
    }
  </style>
</head>
<body class="${initialShowSolutions ? '' : 'hide-solutions'}">
  <div class="dp-toolbar no-print">
    <div class="dp-toolbar-left">
      <span class="dp-badge">DEVOIR PRIME</span>
      <span>${escapeHtml(meta.title)}</span>
    </div>
    <div class="dp-toolbar-actions">
      <button type="button" id="btn-mode-student" class="dp-btn ${!initialShowSolutions ? 'dp-btn-active' : ''}" onclick="setSolutionsMode(false)">
        📝 نسخة التلميذ (نقط فقط - بدون حل)
      </button>
      <button type="button" id="btn-mode-corrige" class="dp-btn ${initialShowSolutions ? 'dp-btn-active' : ''}" onclick="setSolutionsMode(true)">
        ✅ نسخة التصحيح (بالحل المختصر)
      </button>
      <button type="button" class="dp-btn dp-btn-print" onclick="window.print()">
        🖨️ طباعة / حفظ PDF
      </button>
    </div>
  </div>

  <!-- Hidden Templates -->
  <template id="tpl-cover-header">${coverHeaderHtml}</template>
  <template id="tpl-running-header">${runningHeaderHtml}</template>

  <!-- Hidden Staging Container for Accurate DOM Height Measurement -->
  <div id="dp-staging">
    ${flowBlocksHtml.join('\n')}
  </div>

  <!-- Paginated A4 Sheets Root -->
  <div id="dp-pages-root"></div>

  <script>
    function renderAllMath(container) {
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(container, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\\\(', right: '\\\\)', display: false },
            { left: '\\\\[', right: '\\\\]', display: true }
          ],
          throwOnError: false,
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
        });
      }
    }

    function paginateDocument() {
      var root = document.getElementById('dp-pages-root');
      var staging = document.getElementById('dp-staging');
      var coverTpl = document.getElementById('tpl-cover-header');
      var runningTpl = document.getElementById('tpl-running-header');

      // Move any items currently in pages back to staging to re-measure cleanly
      var existingItems = root.querySelectorAll('.dp-flow-item');
      if (existingItems.length > 0) {
        existingItems.forEach(function(el) { staging.appendChild(el); });
      }
      root.innerHTML = '';

      var items = Array.from(staging.querySelectorAll(':scope > .dp-flow-item'));
      if (items.length === 0) return;

      // Measure A4 inner height in px accurately (297mm - 20mm vertical padding = 277mm)
      var probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;height:277mm;width:10px;';
      document.body.appendChild(probe);
      var maxSheetInnerHeight = probe.offsetHeight;
      document.body.removeChild(probe);

      function createSheet(pageIndex) {
        var sheet = document.createElement('section');
        sheet.className = 'dp-sheet';
        if (pageIndex === 1) {
          sheet.appendChild(coverTpl.content.cloneNode(true));
        } else {
          sheet.appendChild(runningTpl.content.cloneNode(true));
        }
        var body = document.createElement('div');
        body.className = 'dp-sheet-body';
        sheet.appendChild(body);
        root.appendChild(sheet);
        return { sheet: sheet, body: body };
      }

      var pageNum = 1;
      var current = createSheet(pageNum);

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var keepWithNext = item.getAttribute('data-keep-with-next') === 'true';

        // Measure current used height inside sheet
        current.body.appendChild(item);

        // If this is an exercise heading, peek whether it + next question card fit
        var overflow = current.sheet.scrollHeight > current.sheet.clientHeight + 2;

        if (!overflow && keepWithNext && i + 1 < items.length) {
          var nextItem = items[i + 1];
          var nextH = nextItem.offsetHeight || 160;
          var usedH = 0;
          Array.from(current.sheet.children).forEach(function(ch) { usedH += ch.offsetHeight; });
          if (usedH + nextH > maxSheetInnerHeight) {
            overflow = true;
          }
        }

        if (overflow && current.body.children.length > 1) {
          // Move item to a fresh next page
          pageNum += 1;
          current = createSheet(pageNum);
          current.body.appendChild(item);
        }
      }

      // Stamp exact page numbers X / N across all sheets
      var sheets = root.querySelectorAll('.dp-sheet');
      var total = sheets.length;
      sheets.forEach(function(sh, idx) {
        sh.querySelectorAll('.dp-page-num').forEach(function(el) { el.textContent = String(idx + 1); });
        sh.querySelectorAll('.dp-total-pages').forEach(function(el) { el.textContent = String(total); });
      });
    }

    function setSolutionsMode(show) {
      if (show) {
        document.body.classList.remove('hide-solutions');
      } else {
        document.body.classList.add('hide-solutions');
      }
      var btnS = document.getElementById('btn-mode-student');
      var btnC = document.getElementById('btn-mode-corrige');
      if (btnS) btnS.classList.toggle('dp-btn-active', !show);
      if (btnC) btnC.classList.toggle('dp-btn-active', show);
      setTimeout(paginateDocument, 30);
    }

    window.addEventListener('load', function() {
      var staging = document.getElementById('dp-staging');
      renderAllMath(staging);
      // Slight delay to let web fonts & KaTeX settle before measuring exact heights
      setTimeout(function() {
        paginateDocument();
        ${options.autoPrint ? 'setTimeout(function(){ window.print(); }, 350);' : ''}
      }, 250);
    });
  </script>
</body>
</html>`;
}

/**
 * Opens the DEVOIR PRIME A4 print preview window (student dotted-only copy OR concise solution copy).
 */
export async function openDevoirPrimePrintWindow(lesson, options = {}) {
  const html = await generateDevoirPrimeHTML(lesson, options);
  const win = window.open('', '_blank', 'width=1020,height=900');
  if (!win) {
    alert("Veuillez autoriser les fenêtres pop-up pour afficher l'aperçu d'impression DEVOIR PRIME.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
