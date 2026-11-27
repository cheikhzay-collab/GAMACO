import QRCode from 'qrcode';
import { parseNationalExamExercise, extractNationalExamMeta } from './nationalExamHelpers.js';
import { getGlobalPrimeSettings } from './devoirPrimeHelpers.js';
import {
  buildFigureMapFromList,
  splitTextByFigureTokens,
  resolveFigureItem,
  hasFigureToken,
  getImageItemUrl,
} from './figureShortcodes.js';

const escapeHtml = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Format inline text safely while preserving $...$ / $$...$$ math and converting **bold** & \n
const formatRichMathHtml = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  const mathTokens = [];
  const masked = raw.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g, (m) => {
    const idx = mathTokens.length;
    mathTokens.push(m);
    return `__KMATH_${idx}__`;
  });

  let html = escapeHtml(masked)
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*\*/g, '')
    .replace(/\n/g, '<br/>');

  html = html.replace(/__KMATH_(\d+)__/g, (_, i) => escapeHtml(mathTokens[Number(i)] || ''));
  return html;
};

const renderNePdfFigure = (fig) => {
  const url = getImageItemUrl(fig);
  if (!url) return '';
  const align = fig.align === 'left' || fig.align === 'right' ? fig.align : 'center';
  const widthPct = Math.min(100, Math.max(20, Number(fig.width_pct) || 75));
  const marginRule = align === 'center' ? '8px auto' : align === 'right' ? '8px 0 8px auto' : '8px auto 8px 0';
  const rawCap = (fig.caption || fig.alt || '').trim();
  const isRedundant = !rawCap || /^(figure(\s*g[ée]om[ée]trique)?|figure|image|photo|شكل(\s*هندسي)?)$/i.test(rawCap);
  return `<div style="text-align:${align};margin:8px 0;"><img src="${escapeHtml(url)}" alt="${escapeHtml(rawCap || 'Figure')}" style="width:${widthPct}%;max-width:100%;max-height:290px;object-fit:contain;display:block;margin:${marginRule};border-radius:4px;" />${!isRedundant ? `<div style="font-size:9pt;color:#475569;font-style:italic;margin-top:3px;">${formatRichMathHtml(rawCap)}</div>` : ''}</div>`;
};

const formatRichHtmlWithFigures = (raw, figMap) => {
  if (!raw || typeof raw !== 'string') return '';
  if (!hasFigureToken(raw) || !figMap || figMap.size === 0) return formatRichMathHtml(raw);
  return splitTextByFigureTokens(raw)
    .map((seg) => {
      if (seg.type === 'figure') {
        const resolved = resolveFigureItem(figMap, seg);
        return resolved ? renderNePdfFigure(resolved) : '';
      }
      return formatRichMathHtml(seg.value);
    })
    .join('');
};

const isArabicStr = (s) => /[\u0600-\u06FF]/.test(String(s || ''));

export const generateNationalExamHTML = async (examData, settings = {}) => {
  const showSolutions = Boolean(settings.showSolutions);
  const showQR = settings.showQR !== false;
  const ministryLogo = settings.ministryLogo || getGlobalPrimeSettings().ministryLogo || '';

  const {
    session,
    subject,
    branch,
    code,
    duration,
    coeff,
    subjectNumber,
    instructions,
    components,
    notations,
  } = extractNationalExamMeta(examData);

  const rawSections = examData?.sections || examData?.items || examData?.questions || [];
  const exercises = Array.isArray(rawSections)
    ? rawSections
        .filter(sec => {
          const t = (sec.title || sec.name || '').toLowerCase().trim();
          return !t.includes('composante') && !t.includes('instruction') && !t.includes('notation');
        })
        .map((sec, idx) => parseNationalExamExercise(sec, idx))
    : [];

  // Generate compact QR codes for graded question blocks
  const qrCodeUrls = {};
  if (showQR) {
    for (let eIdx = 0; eIdx < exercises.length; eIdx++) {
      const ex = exercises[eIdx];
      const blocks = ex.blocks || [];
      let qCounter = 0;
      for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
        const blk = blocks[bIdx];
        if (blk.kind !== 'question') continue;
        qCounter++;
        const key = `ex${eIdx}_b${bIdx}`;
        const payload = blk.qr_code_data || blk.qr_code_url || `https://lconq.ma/solve?ex=${eIdx + 1}&q=${qCounter}&code=${encodeURIComponent(code)}`;
        try {
          qrCodeUrls[key] = await QRCode.toDataURL(payload, {
            width: 96,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' }
          });
        } catch {
          qrCodeUrls[key] = '';
        }
      }
    }
  }

  const renderGridTable = (blk) => {
    const cells = Array.isArray(blk.grid_items) ? blk.grid_items : [];
    if (cells.length === 0) return '';
    // Heuristic: if cells look like 2 rows of probability distribution (length % 2 === 0 and > 4), split into 2 rows
    const rowLen = cells.length >= 6 && cells.length % 2 === 0 ? cells.length / 2 : Math.max(2, Number(blk.cols) || 4);
    const rows = [];
    for (let i = 0; i < cells.length; i += rowLen) {
      rows.push(cells.slice(i, i + rowLen));
    }
    return `
      <div style="margin: 8px 0 12px; display: flex; justify-content: center;">
        <table class="ne-prob-table">
          <tbody>
            ${rows.map((r, rIdx) => `
              <tr>
                ${r.map((cell, cIdx) => `
                  <td style="${cIdx === 0 || rIdx === 0 ? 'font-weight:700; background:#f8fafc;' : 'min-width:52px;'}">
                    ${cell ? formatRichMathHtml(String(cell)) : '&nbsp;'}
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>Examen National du Baccalauréat — ${escapeHtml(code)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@600;700;800&family=STIX+Two+Text:ital,wght@0,400;0,600;0,700;1,400&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css" rel="stylesheet">
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
      font-family: 'Computer Modern Serif', 'STIX Two Text', 'Times New Roman', Georgia, serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #cbd5e1;
      font-size: 10.8pt;
      line-height: 1.56;
    }

    .screen-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0f172a;
      color: #fff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-family: 'Tajawal', 'Cairo', system-ui, sans-serif;
      box-shadow: 0 4px 14px rgba(0,0,0,0.2);
    }

    .screen-toolbar button {
      background: #ffffff;
      color: #005086;
      border: none;
      padding: 7px 16px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
    }

    #ne-pages-root {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
      padding: 20px 0 40px;
    }

    .ne-sheet {
      width: 210mm;
      height: 297mm;
      background: #ffffff;
      padding: 10mm 13mm 11mm 13mm;
      box-shadow: 0 10px 35px rgba(15, 23, 42, 0.16);
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .ne-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .ne-sheet-body {
      display: block;
      width: 100%;
    }
    #ne-staging {
      position: absolute;
      left: -99999px;
      top: 0;
      width: 184mm;
      visibility: hidden;
      pointer-events: none;
    }

    /* ── PAGES 2..N COMPACT 3-PART RUNNING HEADER ── */
    .ne-running-header {
      display: flex;
      align-items: stretch;
      gap: 6px;
      margin-bottom: 12px;
      min-height: 52px;
      flex-shrink: 0;
    }
    .ne-rh-page-box {
      width: 92px;
      border: 1.4px solid #000;
      border-radius: 7px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Tajawal', sans-serif;
      padding: 2px 4px;
      flex-shrink: 0;
      background: #fff;
    }
    .ne-rh-page-lbl { font-size: 11.5px; font-weight: 800; line-height: 1.1; }
    .ne-rh-page-sep { width: 68%; height: 1px; background: #000; margin: 3px 0; }
    .ne-rh-page-val { font-size: 12.5px; font-weight: 800; line-height: 1.1; direction: ltr; }
    .ne-rh-center-box {
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
      background: #fff;
    }
    .ne-rh-line1 { font-size: 12.5px; font-weight: 900; color: #000; line-height: 1.25; }
    .ne-rh-line2 { font-size: 11px; font-weight: 600; color: #1e293b; line-height: 1.25; }
    .ne-rh-code-box {
      width: 92px;
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
      flex-shrink: 0;
      background: #fff;
    }

    .ne-box {
      border: 1.5px solid #0f172a;
    }

    .ne-table {
      border-collapse: collapse;
      width: 100%;
      font-size: 10.5pt;
    }

    .ne-table td, .ne-table th {
      border: 1.25px solid #0f172a;
      padding: 7px 10px;
      text-align: center;
    }

    .ne-section-title {
      text-align: center;
      font-size: 12pt;
      font-weight: 700;
      margin: 0 0 10px 0;
    }

    .ne-section-title > span {
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 2px;
      display: inline-block;
    }

    .ne-ex-block {
      margin-bottom: 16px;
    }

    .ne-ex-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 4px;
      margin: 14px 0 8px 0;
      break-after: avoid;
      page-break-after: avoid;
    }

    .ne-ex-title {
      font-size: 12.2pt;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .ne-ex-points {
      font-size: 10.5pt;
      font-weight: 700;
      color: #005086;
      white-space: nowrap;
      margin-left: 12px;
    }

    .ne-intro-p {
      font-size: 10.8pt;
      line-height: 1.62;
      margin: 5px 0 8px 0;
      color: #111827;
      text-align: justify;
    }

    .ne-q-box {
      border: 1px solid #334155;
      border-radius: 3px;
      margin-bottom: 6px;
      display: flex;
      width: 100%;
      min-height: 40px;
      break-inside: avoid;
      page-break-inside: avoid;
      background: #ffffff;
    }

    .ne-q-points {
      width: 66px;
      border-right: 1px solid #334155;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 9.5pt;
      background: #f8fafc;
      color: #0f172a;
      text-align: center;
      padding: 4px;
      flex-shrink: 0;
    }

    .ne-q-content {
      flex: 1;
      padding: 7px 11px;
      font-size: 10.6pt;
      line-height: 1.64;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow-wrap: anywhere;
    }

    .ne-q-qr {
      width: 52px;
      border-left: 1px solid #334155;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      padding: 3px;
      flex-shrink: 0;
    }

    .ne-q-qr img {
      width: 42px;
      height: 42px;
      object-fit: contain;
    }

    .ne-prob-table {
      border-collapse: collapse;
      font-size: 10.2pt;
    }

    .ne-prob-table td {
      border: 1px solid #0f172a;
      padding: 5px 14px;
      text-align: center;
    }

    .ne-sol-box {
      border-left: 3px solid #059669;
      background: #f0fdf4;
      padding: 8px 12px;
      margin: 4px 0 10px 0;
      font-size: 10.2pt;
      line-height: 1.58;
      color: #064e3b;
      border-radius: 0 4px 4px 0;
      break-inside: avoid;
    }

    .ne-page-break {
      page-break-before: always;
      break-before: page;
    }

    .ne-running-banner {
      display: grid;
      grid-template-columns: 90px 1fr 90px;
      border: 1.25px solid #0f172a;
      margin-bottom: 14px;
      padding: 5px 0;
      align-items: center;
      background: #f8fafc;
    }

    /* Respect natural TeX proportions in KaTeX */
    .katex {
      font-size: 1.02em;
    }
    .katex-display {
      margin: 0.45em 0;
    }

    @media print {
      body {
        background: #ffffff !important;
      }
      .screen-toolbar {
        display: none !important;
      }
      #ne-pages-root {
        padding: 0 !important;
        gap: 0 !important;
      }
      .ne-sheet {
        width: 210mm !important;
        height: 297mm !important;
        margin: 0 !important;
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="screen-toolbar">
    <div style="font-weight: 800; font-size: 14px;">
      🇲🇦 Examen National du Baccalauréat — ${escapeHtml(code)} ${showSolutions ? '(Avec Corrigé)' : ''}
    </div>
    <div style="display: flex; gap: 8px;">
      <button type="button" onclick="window.print()">🖨️ Imprimer / Enregistrer PDF</button>
      <button type="button" onclick="window.close()" style="background: rgba(255,255,255,0.16); color: #fff; border: 1px solid rgba(255,255,255,0.35);">Fermer</button>
    </div>
  </div>

  <!-- Repeating Header Template for Pages 2..N -->
  <template id="ne-tpl-running-header">
    <div class="ne-running-header">
      <div class="ne-rh-page-box">
        <div class="ne-rh-page-lbl">الصفحة</div>
        <div class="ne-rh-page-sep"></div>
        <div class="ne-rh-page-val"><span class="ne-page-num">2</span> / <span class="ne-total-pages">1</span></div>
      </div>
      <div class="ne-rh-center-box" dir="rtl">
        <div class="ne-rh-line1">موضوع الامتحان الوطني الموحد للبكالوريا - ${escapeHtml(session)} -</div>
        <div class="ne-rh-line2">مادة : ${escapeHtml(subject)} - ${escapeHtml(branch)}</div>
      </div>
      <div class="ne-rh-code-box">${escapeHtml(code)}</div>
    </div>
  </template>

  <!-- Hidden Staging Container for Exact DOM Pagination -->
  <div id="ne-staging">
    <!-- ── PAGE 1 COVER HEADER & METADATA ── -->
    <div class="ne-flow-item" data-page-one="true">
      <div class="ne-box" style="display: grid; grid-template-columns: 112px 1fr 220px; min-height: 136px; margin-bottom: 14px;">
        <div style="border-right: 1.5px solid #0f172a; text-align: center; padding: 8px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <div style="font-size: 10.5pt; font-weight: 800; margin-bottom: 6px; font-family: 'Tajawal', sans-serif;" dir="rtl">الصفحة</div>
          <div style="font-size: 20pt; font-weight: 900; line-height: 1;">1</div>
          <div style="width: 34px; height: 1.5px; background: #0f172a; margin: 5px auto;"></div>
          <div style="font-size: 9pt; font-weight: 700; color: #334155; font-family: 'Tajawal', sans-serif;" dir="rtl">الموضوع</div>
        </div>

        <div style="border-right: 1.5px solid #0f172a; text-align: center; padding: 10px 12px; display: flex; flex-direction: column; justify-content: center;" dir="rtl">
          <h1 style="font-size: 15.5pt; font-weight: 900; margin: 0 0 6px 0; font-family: 'Tajawal', sans-serif; color: #0f172a;">الامتحان الوطني الموحد للبكالوريا</h1>
          <h2 style="font-size: 11.5pt; font-weight: 700; margin: 0; font-family: 'Tajawal', sans-serif; color: #1e293b;">- ${escapeHtml(session)} -</h2>
        </div>

        <div style="position: relative; text-align: center; padding: 8px 10px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <svg width="36" height="36" viewBox="0 0 36 36" style="position: absolute; top: 0; left: 0;">
            <polygon points="0,0 36,0 0,36" fill="#0f172a" />
            <text x="6" y="15" fill="#ffffff" font-family="STIX Two Text, Tajawal, sans-serif" font-size="11" font-weight="800">${escapeHtml(subjectNumber)}</text>
          </svg>

          ${ministryLogo ? `<img src="${escapeHtml(ministryLogo)}" alt="Logo du Ministère" style="max-height:46px;max-width:175px;width:auto;height:auto;object-fit:contain;display:block;margin:0 auto;" />` : `<svg width="42" height="42" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="46" stroke="#0f172a" stroke-width="2" fill="none" />
            <path d="M40 22 Q50 14 60 22 L57 26 Q50 19 43 26 Z" fill="#0f172a" />
            <circle cx="50" cy="15" r="2.5" fill="#0f172a" />
            <path d="M34 30 Q50 32 66 30 Q66 58 50 68 Q34 58 34 30 Z" stroke="#0f172a" stroke-width="2" fill="#fff" />
            <path d="M50 36 L53 44 L61 44 L55 49 L57 57 L50 52 L43 57 L45 49 L39 44 L47 44 Z" stroke="#0f172a" stroke-width="1.5" fill="#0f172a" fill-opacity="0.12" />
          </svg>`}
          <div style="font-weight: 700; font-size: 7.5pt; line-height: 1.3; font-family: 'Tajawal', sans-serif; margin-top: 4px;" dir="rtl">
            المملكة المغربية<br/>
            وزارة التربية الوطنية والتعليم الأولي والرياضة<br/>
            <span style="font-size: 6.8pt; font-weight: 500; color: #334155;">المركز الوطني للتقويم والامتحانات والتوجيه</span>
          </div>
        </div>
      </div>

      <table class="ne-table" style="margin-bottom: 18px;">
        <tbody>
          <tr>
            <td style="width: 112px; font-weight: 800; font-size: 11pt; background: #f8fafc;">${escapeHtml(code)}</td>
            <td style="font-weight: 900; font-size: 13pt; font-family: 'Tajawal', sans-serif;" dir="rtl">الموضوع</td>
          </tr>
          <tr>
            <td style="padding: 7px;" dir="rtl">
              <div style="font-size: 8pt; font-family: 'Tajawal', sans-serif; color: #475569;">مدة الإنجاز</div>
              <div style="font-weight: 800; font-size: 11pt; font-family: 'Tajawal', sans-serif;">${escapeHtml(duration)}</div>
            </td>
            <td style="font-weight: 800; font-size: 11.5pt; text-align: center; padding: 7px; font-family: 'Tajawal', sans-serif;" dir="${isArabicStr(subject) ? 'rtl' : 'ltr'}">
              <div style="font-size: 8pt; font-weight: 500; color: #475569; margin-bottom: 2px;" dir="rtl">المادة</div>
              ${escapeHtml(subject)}
            </td>
          </tr>
          <tr>
            <td style="padding: 7px;" dir="rtl">
              <div style="font-size: 8pt; font-family: 'Tajawal', sans-serif; color: #475569;">المعامل</div>
              <div style="font-weight: 800; font-size: 11pt; font-family: 'Tajawal', sans-serif;">${escapeHtml(coeff)}</div>
            </td>
            <td style="font-weight: 700; font-size: 10.2pt; text-align: center; padding: 7px; font-family: 'Tajawal', sans-serif;" dir="${isArabicStr(branch) ? 'rtl' : 'ltr'}">
              <div style="font-size: 8pt; font-weight: 500; color: #475569; margin-bottom: 2px;" dir="rtl">الشعبة والمسلك</div>
              ${escapeHtml(branch)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="ne-flow-item" data-page-one="true" style="margin-bottom: 16px;">
      <h3 class="ne-section-title"><span>Instructions générales</span></h3>
      <ul style="margin: 0; padding-left: 24px; font-size: 10.6pt; line-height: 1.55;">
        ${instructions.map(i => `<li style="margin-bottom: 4px;" dir="${isArabicStr(i) ? 'rtl' : 'ltr'}">${formatRichMathHtml(i)}</li>`).join('')}
      </ul>
    </div>

    <div class="ne-flow-item" data-page-one="true" style="margin-bottom: 16px;">
      <h3 class="ne-section-title"><span>Composantes du sujet</span></h3>
      <p style="font-size: 10.5pt; margin: 0 0 10px 0; line-height: 1.5;">
        L&apos;épreuve est composée des exercices et du problème suivants, indépendants entre eux, et répartis selon les domaines comme suit :
      </p>
      <table class="ne-table" style="font-size: 10.2pt;">
        <tbody>
          ${components.map(c => `
            <tr>
              <td style="width: 140px; font-weight: 700; text-align: left; padding-left: 12px;" dir="${isArabicStr(c.name) ? 'rtl' : 'ltr'}">${escapeHtml(c.name)}</td>
              <td style="text-align: left; padding-left: 12px;" dir="${isArabicStr(c.topic) ? 'rtl' : 'ltr'}">${escapeHtml(c.topic)}</td>
              <td style="width: 110px; font-weight: 700;" dir="${isArabicStr(c.points) ? 'rtl' : 'ltr'}">${escapeHtml(c.points)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="ne-flow-item" data-page-one="true" style="margin-bottom: 10px;">
      <h3 class="ne-section-title"><span>Notations</span></h3>
      <ul style="margin: 0; padding-left: 24px; font-size: 10.6pt; line-height: 1.55;">
        ${notations.map(n => `<li style="margin-bottom: 4px;" dir="${isArabicStr(n) ? 'rtl' : 'ltr'}">${formatRichMathHtml(n)}</li>`).join('')}
      </ul>
    </div>

    <!-- ── PAGES 2..N EXERCISES (Every page 2..N gets the 3-part repeating header) ── -->
    ${exercises.map((ex, eIdx) => {
      const titleHasPoints = /point|pt|نقط/i.test(ex.title);
      const blocks = ex.blocks || [];
      const figMap = buildFigureMapFromList(ex.figures || []);

      const itemsHtml = [];
      itemsHtml.push(`
        <div class="ne-flow-item" ${eIdx === 0 ? 'data-exercises-start="true"' : ''} data-keep-with-next="true">
          <div class="ne-ex-head" dir="${isArabicStr(ex.title) ? 'rtl' : 'ltr'}">
            <h3 class="ne-ex-title">${escapeHtml(ex.title)}</h3>
            ${(ex.points && !titleHasPoints) ? `<span class="ne-ex-points">(${escapeHtml(ex.points)})</span>` : ''}
          </div>
        </div>
      `);

      blocks.forEach((blk, bIdx) => {
        if (blk.kind === 'table') {
          itemsHtml.push(`<div class="ne-flow-item">${renderGridTable(blk)}</div>`);
          return;
        }
        if (blk.kind === 'image') {
          itemsHtml.push(`<div class="ne-flow-item">${renderNePdfFigure(blk)}</div>`);
          return;
        }
        if (blk.kind === 'text') {
          itemsHtml.push(`<div class="ne-flow-item" data-keep-with-next="true"><div class="ne-intro-p" dir="${isArabicStr(blk.text) ? 'rtl' : 'ltr'}">${formatRichHtmlWithFigures(blk.text, figMap)}</div></div>`);
          return;
        }

        const qrUrl = qrCodeUrls[`ex${eIdx}_b${bIdx}`] || '';
        const ptsDisplay = blk.points ? escapeHtml(blk.points) : '&mdash;';
        itemsHtml.push(`
          <div class="ne-flow-item">
            <div class="ne-q-box">
              <div class="ne-q-points">${ptsDisplay}</div>
              <div class="ne-q-content" dir="${isArabicStr(blk.text) ? 'rtl' : 'ltr'}">
                <div>${blk.number ? `<strong style="margin-right: 6px;">${escapeHtml(blk.number)}</strong>` : ''}${formatRichHtmlWithFigures(blk.text, figMap)}</div>
              </div>
              ${showQR ? `<div class="ne-q-qr">${qrUrl ? `<img src="${qrUrl}" alt="QR" />` : ''}</div>` : ''}
            </div>
            ${showSolutions && blk.solution ? `
              <div class="ne-sol-box" dir="${isArabicStr(blk.solution) ? 'rtl' : 'ltr'}">
                <strong>Corrigé :</strong> ${formatRichHtmlWithFigures(blk.solution, figMap)}
              </div>
            ` : ''}
          </div>
        `);
      });

      if (showSolutions && ex.solution) {
        itemsHtml.push(`
          <div class="ne-flow-item">
            <div class="ne-sol-box" dir="${isArabicStr(ex.solution) ? 'rtl' : 'ltr'}">
              <strong style="display:block; margin-bottom:3px;">📖 Éléments de réponse / Corrigé détaillé :</strong>
              ${formatRichHtmlWithFigures(ex.solution, figMap)}
            </div>
          </div>
        `);
      }

      return itemsHtml.join('\n');
    }).join('\n')}
  </div>

  <!-- Paginated A4 Sheets Root -->
  <div id="ne-pages-root"></div>

  <script>
    (function () {
      function renderAllMath() {
        if (typeof window.renderMathInElement === 'function') {
          try {
            window.renderMathInElement(document.body, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\\\(', right: '\\\\)', display: false },
                { left: '\\\\[', right: '\\\\]', display: true }
              ],
              strict: 'ignore',
              throwOnError: false,
              ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
            });
          } catch (e) { console.warn('KaTeX render warning:', e); }
        }
      }

      function paginateDocument() {
        var root = document.getElementById('ne-pages-root');
        var staging = document.getElementById('ne-staging');
        var runningTpl = document.getElementById('ne-tpl-running-header');
        var items = Array.from(staging.querySelectorAll(':scope > .ne-flow-item'));
        if (items.length === 0) return;

        var probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:-9999px;height:276mm;width:10px;';
        document.body.appendChild(probe);
        var maxSheetInnerHeight = probe.offsetHeight;
        document.body.removeChild(probe);

        function getFullHeight(el) {
          if (!el) return 0;
          var cs = window.getComputedStyle(el);
          return el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
        }

        function getActualUsedHeight(sheet, body) {
          var header = sheet.firstElementChild;
          var headerH = (header && header !== body) ? getFullHeight(header) : 0;
          var bodyH = 0;
          Array.from(body.children).forEach(function(ch) { bodyH += getFullHeight(ch); });
          return headerH + bodyH;
        }

        var itemHeights = items.map(function(el) { return getFullHeight(el); });

        function createSheet(pageIndex) {
          var sheet = document.createElement('section');
          sheet.className = 'ne-sheet';
          if (pageIndex > 1 && runningTpl) {
            sheet.appendChild(runningTpl.content.cloneNode(true));
          }
          var body = document.createElement('div');
          body.className = 'ne-sheet-body';
          sheet.appendChild(body);
          root.appendChild(sheet);
          return { sheet: sheet, body: body };
        }

        var pageNum = 1;
        var current = createSheet(pageNum);

        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var startsExercises = item.getAttribute('data-exercises-start') === 'true';

          if (startsExercises && pageNum === 1 && current.body.children.length > 0) {
            pageNum = 2;
            current = createSheet(pageNum);
          }

          current.body.appendChild(item);

          var usedH = getActualUsedHeight(current.sheet, current.body);
          var overflow = usedH > maxSheetInnerHeight - 2 || current.sheet.scrollHeight > current.sheet.clientHeight + 2;

          var keepWithNext = item.getAttribute('data-keep-with-next') === 'true';
          if (!overflow && keepWithNext && i + 1 < items.length) {
            var nextH = itemHeights[i + 1] || 90;
            if (usedH + nextH > maxSheetInnerHeight - 2) {
              overflow = true;
            }
          }

          if (overflow && current.body.children.length > 1) {
            pageNum += 1;
            current = createSheet(pageNum);
            current.body.appendChild(item);
          }
        }

        var sheets = root.querySelectorAll('.ne-sheet');
        var total = sheets.length;
        sheets.forEach(function(sh, idx) {
          sh.querySelectorAll('.ne-page-num').forEach(function(el) { el.textContent = String(idx + 1); });
          sh.querySelectorAll('.ne-total-pages').forEach(function(el) { el.textContent = String(total); });
        });
      }

      window.addEventListener('load', function () {
        renderAllMath();
        var fontReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
        fontReady.then(function () {
          renderAllMath();
          paginateDocument();
          setTimeout(function () {
            try { window.print(); } catch (_) {}
          }, 400);
        });
      });
    })();
  </script>
</body>
</html>`;
};

export const openNationalExamPrintWindow = async (examData, settings = {}) => {
  const html = await generateNationalExamHTML(examData, settings);
  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  }
};
