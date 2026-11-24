/**
 * generateNationalExamsBookPDF.js — L'CONQ / GAMACO
 * Master Book PDF Generator for Moroccan National Exams (كتاب وموسوعة الامتحانات الوطنية الشاملة)
 * Supports:
 *  - Royal Moroccan Cover Page (غلاف كتاب ملكي رسمي فاخر)
 *  - Table of Contents / Index (الفهرس المبوب الشامل)
 *  - Full compiled exams with or without detailed step-by-step solutions
 *  - Thematic books filtered by Domain (المتتاليات، الأعداد العقدية، التحليل، الاحتمالات...)
 *  - Official Ministry format or Royal DEVOIR PRIME format
 */

import QRCode from 'qrcode';
import { detectExerciseDomain, NATIONAL_EXAM_DOMAINS, normalizeNationalExam } from './nationalExamHelpers.js';

// Helper to escape HTML safely
const esc = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Helper to clean LaTeX
const cleanLatex = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)([A-ZÀ-ÖØ-ß])/g, '\n $1')
    .replace(/(?<![a-zA-Z\\])otin(?=[\\\{\sA-Z0-9\(\[]|$)/g, '\\notin ')
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
    .replace(/\*\*/g, '')
    .trim();
};

export async function generateNationalExamsBookHTML(rawExams, options = {}) {
  const normalizedExams = (rawExams || []).map(normalizeNationalExam).filter(Boolean);

  const {
    title = 'الموسوعة الشاملة في الرياضيات — الامتحانات الوطنية الموحدة',
    subtitle = 'الدورة العادية والدورة الاستدراكية — خيار فرنسية BIOF',
    branch = '2ème Baccalauréat — Sciences Expérimentales & Mathématiques',
    profName = 'الأستاذ: المشرف التربوي',
    academicYear = '2025 - 2026',
    showSolutions = true,
    domainFilter = 'all', // 'all' or domain id ('suites', 'complexes', etc.)
    includeCover = true,
    includeIndex = true,
    layoutMode = 'official', // 'official' or 'devoir_prime'
  } = options;

  // Filter exercises if domainFilter is specific
  const selectedDomainObj = NATIONAL_EXAM_DOMAINS.find(d => d.id === domainFilter) || NATIONAL_EXAM_DOMAINS[0];
  const isThematic = domainFilter !== 'all';

  // Prepare filtered exams / exercises
  const processedExams = normalizedExams.map(exam => {
    let sections = exam.sections || [];
    if (isThematic) {
      sections = sections.filter(sec => detectExerciseDomain(sec) === domainFilter);
    }
    return {
      ...exam,
      sections
    };
  }).filter(exam => exam.sections.length > 0);

  // Years Range
  const years = processedExams.map(e => e.year).filter(Boolean);
  const minYear = years.length > 0 ? Math.min(...years) : 2008;
  const maxYear = years.length > 0 ? Math.max(...years) : 2026;
  const yearsRangeStr = minYear === maxYear ? `${minYear}` : `${minYear} – ${maxYear}`;

  // Generate QR Code for digital solutions access
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(window.location.origin + '/national-exams', {
      width: 130,
      margin: 1,
      color: { dark: '#005086', light: '#ffffff' }
    });
  } catch {
    qrCodeDataUrl = '';
  }

  // Count total stats
  let totalExercises = 0;
  const domainCounts = {};
  processedExams.forEach(exam => {
    exam.sections.forEach(sec => {
      totalExercises++;
      const dom = detectExerciseDomain(sec);
      domainCounts[dom] = (domainCounts[dom] || 0) + 1;
    });
  });

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)} (${yearsRangeStr})</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400&family=Tajawal:wght@400;500;700;900&family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  
  <!-- KaTeX CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}, {left: '\\\\(', right: '\\\\)', display: false}, {left: '\\\\[', right: '\\\\]', display: true}], ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] });"></script>

  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Inter', 'Cairo', 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }

    /* Print Toolbar (Screen Only) */
    .screen-toolbar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #005086;
      color: #ffffff;
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 99999;
      font-family: 'Cairo', sans-serif;
    }
    .screen-toolbar button {
      background: #ffffff;
      color: #005086;
      border: none;
      border-radius: 99px;
      padding: 0.5rem 1.4rem;
      font-size: 0.95rem;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .screen-toolbar button:hover {
      background: #f0fdf4;
      color: #059669;
    }

    @media print {
      .screen-toolbar { display: none !important; }
      body { background: #fff !important; }
    }

    /* Page Breaks */
    .book-cover-page,
    .book-index-page,
    .book-exam-wrapper {
      page-break-before: always;
      break-before: page;
    }
    .book-cover-page:first-child {
      page-break-before: avoid;
      break-before: avoid;
    }

    /* ═══════════════════════════════════════════════════════════════════
       ROYAL MOROCCAN COVER PAGE
       ═══════════════════════════════════════════════════════════════════ */
    .book-cover-page {
      min-height: 270mm;
      position: relative;
      background: #ffffff;
      border: 3.5px double #005086;
      padding: 12mm 14mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .cover-ornate-corner {
      position: absolute;
      width: 48px;
      height: 48px;
      border: 2px solid #005086;
    }
    .cover-top-left { top: 6mm; left: 6mm; border-right: none; border-bottom: none; }
    .cover-top-right { top: 6mm; right: 6mm; border-left: none; border-bottom: none; }
    .cover-bottom-left { bottom: 6mm; left: 6mm; border-right: none; border-top: none; }
    .cover-bottom-right { bottom: 6mm; right: 6mm; border-left: none; border-top: none; }

    .cover-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid rgba(0, 80, 134, 0.25);
      padding-bottom: 1rem;
      direction: rtl;
      font-family: 'Amiri', 'Cairo', serif;
    }
    .cover-ministry-block {
      text-align: center;
      flex: 1;
    }
    .cover-ministry-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #005086;
      margin: 0;
      line-height: 1.4;
    }
    .cover-center-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 1.4rem;
      background: rgba(0, 80, 134, 0.08);
      border: 1.5px solid #005086;
      border-radius: 99px;
      font-size: 0.92rem;
      font-weight: 800;
      color: #005086;
      margin: 1.5rem auto 0;
      font-family: 'Cairo', sans-serif;
    }

    .cover-main-title {
      font-family: 'Cairo', 'Amiri', sans-serif;
      font-size: 2.2rem;
      font-weight: 900;
      color: #005086;
      line-height: 1.3;
      margin: 1.8rem 0 0.8rem;
      text-wrap: balance;
    }
    .cover-subtitle {
      font-size: 1.15rem;
      font-weight: 700;
      color: #0369a1;
      margin: 0 auto;
      max-width: 80%;
      line-height: 1.5;
    }
    .cover-thematic-pill {
      display: inline-block;
      margin-top: 1rem;
      background: linear-gradient(135deg, #005086, #0284c7);
      color: #ffffff;
      padding: 0.45rem 1.6rem;
      border-radius: 12px;
      font-size: 1.05rem;
      font-weight: 800;
      font-family: 'Cairo', sans-serif;
    }

    .cover-stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 2rem 0;
      direction: rtl;
      font-family: 'Cairo', sans-serif;
    }
    .cover-stat-box {
      border: 1.5px solid rgba(0, 80, 134, 0.2);
      border-radius: 12px;
      padding: 0.85rem 1rem;
      background: rgba(0, 80, 134, 0.02);
    }
    .cover-stat-number {
      font-size: 1.6rem;
      font-weight: 900;
      color: #005086;
      line-height: 1;
    }
    .cover-stat-label {
      font-size: 0.82rem;
      color: #64748b;
      font-weight: 700;
      margin-top: 0.35rem;
    }

    .cover-footer-card {
      border: 1.5px solid #005086;
      border-radius: 16px;
      padding: 1.25rem 1.75rem;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: space-between;
      direction: rtl;
      font-family: 'Cairo', sans-serif;
      margin-top: 1.5rem;
    }

    /* ═══════════════════════════════════════════════════════════════════
       TABLE OF CONTENTS / INDEX PAGE
       ═══════════════════════════════════════════════════════════════════ */
    .book-index-page {
      background: #ffffff;
      padding: 6mm 0;
      font-family: 'Cairo', sans-serif;
    }
    .index-header {
      border-bottom: 2.5px solid #005086;
      padding-bottom: 0.75rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      direction: rtl;
    }
    .index-header h2 {
      margin: 0;
      font-size: 1.6rem;
      font-weight: 900;
      color: #005086;
    }
    .index-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.5rem;
      font-size: 0.88rem;
    }
    .index-table th {
      background: #005086;
      color: #ffffff;
      padding: 0.65rem 0.75rem;
      font-weight: 800;
      border: 1px solid #005086;
      text-align: center;
    }
    .index-table td {
      padding: 0.6rem 0.75rem;
      border: 1px solid #cbd5e1;
      text-align: center;
    }
    .index-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .index-domain-tag {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 800;
      padding: 0.15rem 0.45rem;
      border-radius: 6px;
      margin: 1px 3px;
      background: rgba(0, 80, 134, 0.08);
      color: #005086;
      border: 1px solid rgba(0, 80, 134, 0.2);
    }

    /* ═══════════════════════════════════════════════════════════════════
       EXAMS & EXERCISES STYLES
       ═══════════════════════════════════════════════════════════════════ */
    .book-exam-wrapper {
      margin-bottom: 2rem;
      page-break-inside: auto;
    }
    .exam-official-header {
      border: 2px solid #000000;
      display: grid;
      grid-template-columns: 120px 1fr 200px;
      height: 135px;
      margin-bottom: 14px;
      box-sizing: border-box;
      page-break-inside: avoid;
    }
    .exam-header-col-left {
      border-right: 1.5px solid #000;
      text-align: center;
      padding: 6px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .exam-header-col-center {
      border-right: 1.5px solid #000;
      text-align: center;
      padding: 8px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .exam-header-col-right {
      text-align: center;
      padding: 6px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    .exam-meta-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      margin-bottom: 12px;
      font-size: 0.88rem;
      page-break-inside: avoid;
    }
    .exam-meta-table td, .exam-meta-table th {
      border: 1.5px solid #000;
      padding: 6px 8px;
      text-align: center;
    }

    .instructions-box {
      border: 1.5px solid #000;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 0.82rem;
      background: #fafafa;
      page-break-inside: avoid;
    }
    .instructions-box ul {
      margin: 4px 0 0 1.25rem;
      padding: 0;
    }

    /* Exercise Rows */
    .ex-card-box {
      border: 1.5px solid #000;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .ex-card-header {
      background: #f1f5f9;
      border-bottom: 1.5px solid #000;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 800;
      font-size: 0.95rem;
    }
    .ex-card-body {
      padding: 10px 14px;
      font-size: 0.92rem;
      line-height: 1.6;
    }

    .question-row {
      display: flex;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      margin-bottom: 8px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .question-bareme {
      width: 75px;
      background: #f8fafc;
      border-right: 1px solid #cbd5e1;
      font-weight: 800;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #005086;
      flex-shrink: 0;
    }
    .question-content {
      flex: 1;
      padding: 8px 12px;
      font-size: 0.9rem;
    }

    /* Solution Box */
    .solution-accordion-box {
      margin-top: 10px;
      border: 1.5px solid #059669;
      border-radius: 8px;
      background: #f0fdf4;
      padding: 10px 14px;
      page-break-inside: avoid;
    }
    .solution-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px dashed rgba(5, 150, 105, 0.3);
      padding-bottom: 6px;
      margin-bottom: 8px;
      font-weight: 800;
      color: #059669;
      font-size: 0.9rem;
    }
    .solution-body-text {
      color: #064e3b;
      font-size: 0.88rem;
      line-height: 1.65;
    }
  </style>
</head>
<body>

  <!-- Screen Floating Actions -->
  <div class="screen-toolbar">
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <span style="font-size:1.4rem;">📘</span>
      <div>
        <strong style="font-size:1.1rem; display:block;">${esc(title)}</strong>
        <span style="font-size:0.82rem; opacity:0.85;">المصنف الشامل للامتحانات الوطنية (${yearsRangeStr}) — عدد التمارين: ${totalExercises}</span>
      </div>
    </div>
    <div style="display:flex; gap:0.75rem;">
      <button onclick="window.print()">
        <span>🖨️ طباعة وتحميل الكتاب (PDF)</span>
      </button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.15); color:#fff; border:1px solid rgba(255,255,255,0.4);">
        <span>إغلاق</span>
      </button>
    </div>
  </div>

  ${includeCover ? `
  <!-- ═══════════════════════════════════════════════════════════════════
       1. ROYAL MOROCCAN COVER PAGE
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="book-cover-page">
    <div class="cover-ornate-corner cover-top-left"></div>
    <div class="cover-ornate-corner cover-top-right"></div>
    <div class="cover-ornate-corner cover-bottom-left"></div>
    <div class="cover-ornate-corner cover-bottom-right"></div>

    <!-- Ministry & Emblem Header -->
    <div class="cover-header-row">
      <div style="width:110px; text-align:right; font-size:0.82rem; font-weight:700;">
        المملكة المغربية<br/>
        Royaume du Maroc
      </div>
      <div class="cover-ministry-block">
        <svg width="52" height="52" viewBox="0 0 100 100" fill="none" style="margin-bottom:4px;">
          <circle cx="50" cy="50" r="46" stroke="#005086" stroke-width="2.5" fill="none" />
          <path d="M40 22 Q50 14 60 22 L57 26 Q50 19 43 26 Z" fill="#005086" />
          <circle cx="50" cy="15" r="3" fill="#005086" />
          <path d="M34 30 Q50 32 66 30 Q66 58 50 68 Q34 58 34 30 Z" stroke="#005086" stroke-width="2" fill="#ffffff" />
          <path d="M50 36 L53 44 L61 44 L55 49 L57 57 L50 52 L43 57 L45 49 L39 44 L47 44 Z" stroke="#005086" stroke-width="1.5" fill="#005086" fill-opacity="0.15" />
          <circle cx="50" cy="30" r="3.5" fill="#005086" />
          <path d="M30 74 Q50 80 70 74 Q60 84 50 82 Q40 84 30 74 Z" stroke="#005086" stroke-width="1.5" fill="#005086" />
        </svg>
        <h2 class="cover-ministry-title">وزارة التربية الوطنية والتعليم الأولي والرياضة</h2>
        <span style="font-size:0.8rem; color:#475569;">المركز الوطني للتقويم والامتحانات والتوجيه</span>
      </div>
      <div style="width:110px; text-align:left; font-size:0.82rem; font-weight:700;">
        مادة الرياضيات<br/>
        Mathématiques
      </div>
    </div>

    <!-- Center Titles -->
    <div>
      <div class="cover-center-badge">
        <span>⭐ الطبعة الرسمية المعتمدة للمراجعة والتحضير للبكالوريا ⭐</span>
      </div>

      <h1 class="cover-main-title">${esc(title)}</h1>
      <div class="cover-subtitle">${esc(subtitle)}</div>

      ${isThematic ? `
        <div class="cover-thematic-pill">
          🎯 مصنف موضوعاتي خاص بمجال: ${esc(selectedDomainObj.labelAr)} (${esc(selectedDomainObj.labelFr)})
        </div>
      ` : ''}

      <div style="margin-top:1.2rem; font-size:1.15rem; font-weight:800; color:#0f172a; font-family:'Cairo',sans-serif;">
        السلك: ${esc(branch)}
      </div>

      <!-- Stats Grid -->
      <div class="cover-stats-grid">
        <div class="cover-stat-box">
          <div class="cover-stat-number">${yearsRangeStr}</div>
          <div class="cover-stat-label">السنوات المشمولة</div>
        </div>
        <div class="cover-stat-box">
          <div class="cover-stat-number">${processedExams.length}</div>
          <div class="cover-stat-label">امتحان وطني موحد</div>
        </div>
        <div class="cover-stat-box">
          <div class="cover-stat-number">${totalExercises}</div>
          <div class="cover-stat-label">تمرين ومسألة شاملة</div>
        </div>
      </div>
    </div>

    <!-- Footer Profile & QR Box -->
    <div class="cover-footer-card">
      <div style="display:flex; align-items:center; gap:1.25rem;">
        ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="QR Code" style="width:78px; height:78px; border-radius:8px; border:1px solid #cbd5e1;" />` : ''}
        <div>
          <div style="font-size:1.1rem; font-weight:900; color:#005086;">${esc(profName)}</div>
          <div style="font-size:0.85rem; color:#64748b; font-weight:700; margin-top:2px;">الموسم الدراسي: ${esc(academicYear)}</div>
          <div style="font-size:0.75rem; color:#059669; font-weight:800; margin-top:4px;">
            ${showSolutions ? '✓ مصحوب بالحلول النموذجية المفصلة وسلم التنقيط' : '• مواضيع الامتحانات الرسمية للتدريب الفعلي'}
          </div>
        </div>
      </div>
      <div style="text-align:left; font-size:0.8rem; color:#64748b; font-weight:600; direction:ltr;">
        L'CONQ / GAMACO<br/>
        Préparation Baccalauréat BIOF
      </div>
    </div>
  </div>
  ` : ''}

  ${includeIndex ? `
  <!-- ═══════════════════════════════════════════════════════════════════
       2. TABLE OF CONTENTS / INDEX PAGE
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="book-index-page">
    <div class="index-header">
      <h2>📑 فهرس الامتحانات والمواضيع المضمنة</h2>
      <span style="font-weight:700; color:#64748b;">إجمالي الامتحانات: ${processedExams.length} | عدد المسائل: ${totalExercises}</span>
    </div>

    <!-- Domain Distribution Pills -->
    <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1.25rem; direction:rtl;">
      ${NATIONAL_EXAM_DOMAINS.filter(d => d.id !== 'all' && domainCounts[d.id]).map(d => `
        <span style="background:${d.color}15; color:${d.color}; border:1px solid ${d.color}35; padding:0.25rem 0.75rem; border-radius:99px; font-size:0.78rem; font-weight:800;">
          ${d.icon} ${esc(d.labelAr)} (${domainCounts[d.id]} تمرين)
        </span>
      `).join('')}
    </div>

    <table class="index-table">
      <thead>
        <tr>
          <th style="width:45px;">N°</th>
          <th style="width:75px;">السنة</th>
          <th style="width:130px;">الدورة</th>
          <th>الشعبة / المسلك</th>
          <th>المجالات والمواضيع المعالجة</th>
          <th style="width:80px;">التمارين</th>
          <th style="width:90px;">التصحيح</th>
        </tr>
      </thead>
      <tbody>
        ${processedExams.map((exam, idx) => {
          const doms = exam.domains.map(dId => {
            const dObj = NATIONAL_EXAM_DOMAINS.find(d => d.id === dId);
            return dObj ? `<span class="index-domain-tag">${dObj.icon} ${esc(dObj.labelAr)}</span>` : '';
          }).join('');

          return `
            <tr>
              <td><strong>${idx + 1}</strong></td>
              <td><strong style="color:#005086; font-size:1rem;">${exam.year}</strong></td>
              <td>${esc(exam.session)}</td>
              <td style="text-align:right; font-size:0.82rem;">${esc(exam.branch)}</td>
              <td style="text-align:right;">${doms || '—'}</td>
              <td><strong>${exam.sections.length}</strong></td>
              <td style="color:${exam.hasSolutions && showSolutions ? '#059669' : '#64748b'}; font-weight:800;">
                ${exam.hasSolutions && showSolutions ? '✓ متاح' : '—'}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- ═══════════════════════════════════════════════════════════════════
       3. EXAMS & EXERCISES BODY
       ═══════════════════════════════════════════════════════════════════ -->
  ${processedExams.map((exam, exIdx) => {
    return `
      <div class="book-exam-wrapper" id="exam-${exam.id}">
        
        <!-- Official Cartouche Header -->
        <div class="exam-official-header">
          <div class="exam-header-col-left">
            <div style="font-size:0.95rem; font-weight:bold; font-family:'Tajawal',sans-serif;">الامتحان N°</div>
            <div style="font-size:1.6rem; font-weight:900; color:#005086; line-height:1;">${exIdx + 1}</div>
            <div style="width:30px; height:1.5px; background:#000; margin:4px auto;"></div>
            <div style="font-size:1.1rem; font-weight:bold;">${exam.year}</div>
          </div>

          <div class="exam-header-col-center">
            <h2 style="font-size:1.25rem; font-weight:900; margin:0 0 4px 0; font-family:'Tajawal',sans-serif; color:#005086;">
              الامتحان الوطني الموحد للبكالوريا
            </h2>
            <h3 style="font-size:1.05rem; font-weight:700; margin:0; font-family:'Tajawal',sans-serif;">
              - ${esc(exam.session)} -
            </h3>
            <div style="font-size:0.75rem; color:#475569; font-weight:600; margin-top:4px;">
              ${esc(exam.branch)}
            </div>
          </div>

          <div class="exam-header-col-right">
            <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="46" stroke="#000" stroke-width="2" fill="none" />
              <path d="M40 22 Q50 14 60 22 L57 26 Q50 19 43 26 Z" fill="#000" />
              <circle cx="50" cy="15" r="2.5" fill="#000" />
              <path d="M34 30 Q50 32 66 30 Q66 58 50 68 Q34 58 34 30 Z" stroke="#000" stroke-width="2" fill="#fff" />
              <path d="M50 36 L53 44 L61 44 L55 49 L57 57 L50 52 L43 57 L45 49 L39 44 L47 44 Z" stroke="#000" stroke-width="1.5" fill="#000" fill-opacity="0.1" />
            </svg>
            <div style="font-weight:bold; font-size:0.62rem; line-height:1.2; font-family:'Tajawal',sans-serif; margin-top:3px;">
              المملكة المغربية<br/>
              وزارة التربية الوطنية
            </div>
          </div>
        </div>

        <!-- Meta Table -->
        <table class="exam-meta-table">
          <tr>
            <td style="width:25%;"><strong>المادة :</strong> ${esc(exam.subject)}</td>
            <td style="width:25%;"><strong>المعامل :</strong> ${esc(exam.coefficient)}</td>
            <td style="width:25%;"><strong>مدة الإنجاز :</strong> ${esc(exam.duration)}</td>
            <td style="width:25%;"><strong>الرمز :</strong> ${esc(exam.code)}</td>
          </tr>
        </table>

        <!-- Instructions Box -->
        <div class="instructions-box">
          <strong style="display:block; margin-bottom:2px;">تعليمات عامة للمترشح(ة) :</strong>
          <ul>
            <li>يسمح باستعمال الآلة الحاسبة غير القابلة للبرمجة ؛</li>
            <li>يمكن للمترشح إنجاز تمارين الموضوع حسب الترتيب الذي يناسبه ؛</li>
            <li>يوصى بتفادي استعمال اللون الأحمر عند تحرير عناصر الإجابة.</li>
          </ul>
        </div>

        <!-- Exercises List -->
        ${exam.sections.map((sec, sIdx) => {
          const dom = detectExerciseDomain(sec);
          const domObj = NATIONAL_EXAM_DOMAINS.find(d => d.id === dom);
          const pointsStr = sec.points ? `${sec.points} pts` : (sec.title?.match(/\((\d+(?:[.,]\d+)?)\s*(?:pt|pts|ن)\)/i)?.[1] ? `${sec.title.match(/\((\d+(?:[.,]\d+)?)\s*(?:pt|pts|ن)\)/i)[1]} pts` : '');

          const titleClean = (sec.title || `Exercice ${sIdx + 1}`).replace(/\*\*/g, '').trim();

          return `
            <div class="ex-card-box">
              <div class="ex-card-header">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                  <span style="color:#005086;">${esc(titleClean)}</span>
                  ${domObj ? `<span style="font-size:0.75rem; background:#ffffff; border:1px solid #cbd5e1; padding:1px 8px; border-radius:99px; color:#475569;">${domObj.icon} ${esc(domObj.labelAr)}</span>` : ''}
                </div>
                ${pointsStr ? `<span style="background:#005086; color:#ffffff; padding:2px 10px; border-radius:99px; font-size:0.8rem;">${esc(pointsStr)}</span>` : ''}
              </div>

              <div class="ex-card-body">
                ${sec.content ? `<div style="margin-bottom:0.75rem; line-height:1.65;">${cleanLatex(sec.content)}</div>` : ''}

                <!-- Sub-questions if present -->
                ${Array.isArray(sec.items) && sec.items.length > 0 ? `
                  <div style="display:flex; flex-direction:column; gap:6px;">
                    ${sec.items.map((it, itIdx) => {
                      const itText = it.text || (typeof it === 'string' ? it : '');
                      const itPoints = it.points ? `${it.points} pt` : '';
                      return `
                        <div class="question-row">
                          ${itPoints ? `<div class="question-bareme">${esc(itPoints)}</div>` : ''}
                          <div class="question-content">
                            ${cleanLatex(itText)}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : ''}

                <!-- Solution Section -->
                ${showSolutions && sec.solution ? `
                  <div class="solution-accordion-box">
                    <div class="solution-header-bar">
                      <span>📖 الحل النموذجي المفصل وسلم التنقيط :</span>
                      <span style="font-size:0.78rem; font-weight:700;">Corrigé officiel</span>
                    </div>
                    <div class="solution-body-text">
                      ${cleanLatex(sec.solution)}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}

      </div>
    `;
  }).join('')}

</body>
</html>`;
}

/**
 * Open Print Window for National Exams Book.
 */
export async function openNationalExamsBookPrintWindow(exams, options = {}) {
  const html = await generateNationalExamsBookHTML(exams, options);
  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert("Veuillez autoriser les fenêtres pop-up dans votre navigateur pour afficher et imprimer le livre des examens nationaux.");
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
