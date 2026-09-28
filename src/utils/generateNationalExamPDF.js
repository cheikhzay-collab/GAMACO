import QRCode from 'qrcode';

// Helper to clean markdown & LaTeX strings
const cleanLatexStr = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\\n([a-zA-Z])/g, '\n $1') // Fix \nSoit -> \n Soit
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1') // Fix \\overrightarrow -> \overrightarrow
    .replace(/\*\*/g, '') // Strip markdown **
    .trim();
};

// Helper to parse exercise text, titles, points and sub-questions
const parseExercise = (sec, idx) => {
  let rawTitle = sec.title || sec.name || `Exercice ${idx + 1}`;
  let cleanTitle = rawTitle.replace(/\*\*/g, '').replace(/:\s*$/, '').trim();

  let points = sec.points ? `${sec.points} points` : '';
  let rawContent = sec.content || sec.description || sec.intro || '';
  let rawItems = sec.items || sec.questions || sec.sub_questions || [];

  let preamble = '';
  let items = [];

  if (Array.isArray(rawItems) && rawItems.length > 1) {
    preamble = cleanLatexStr(rawContent);
    items = rawItems.map((it, qIdx) => {
      const qText = typeof it === 'string' ? it : (it.text || it.question || it.content || '');
      const qLabel = it.number || it.label || it.index || `${qIdx + 1}.`;
      let qPoints = it.points || it.pts || '';
      let cleanText = cleanLatexStr(qText);
      const ptMatch = cleanText.match(/\(\s*(\d+(?:[\.,]\d+)?)\s*(?:pt|pts|ن|نقطة)\s*\)/i);
      if (ptMatch) {
        if (!qPoints) qPoints = `${ptMatch[1]} pt`;
        cleanText = cleanText.replace(ptMatch[0], '').trim();
      }
      if (!qPoints) qPoints = '0.5 pt';
      return { number: qLabel, points: qPoints, text: cleanText, solution: it.solution || it.answer || '' };
    });
  } else {
    // Single text block — split preamble and sub-questions dynamically
    const fullText = (rawContent + ' ' + (rawItems[0]?.text || rawItems[0] || '')).trim();
    
    // Pattern to match sub-question markers like 1.a. , 1.b. , 2.a. , 1. , 2.
    const qMarkerRegex = /(?:\*\*|\s|^)(\d+\.[a-z]\.|\d+\.|\b[a-z]\.)(?:\*\*|\s)/gi;
    
    let matches = [];
    let match;
    while ((match = qMarkerRegex.exec(fullText)) !== null) {
      matches.push({ index: match.index, label: match[1].trim(), length: match[0].length });
    }

    if (matches.length > 0) {
      preamble = cleanLatexStr(fullText.slice(0, matches[0].index));
      for (let i = 0; i < matches.length; i++) {
        const curr = matches[i];
        const nextIndex = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
        let segment = fullText.slice(curr.index + curr.length, nextIndex).trim();

        let qPoints = '0.5 pt';
        const ptMatch = segment.match(/\(\s*(\d+(?:[\.,]\d+)?)\s*(?:pt|pts|ن|نقطة)\s*\)/i);
        if (ptMatch) {
          qPoints = `${ptMatch[1]} pt`;
          segment = segment.replace(ptMatch[0], '').trim();
        }

        items.push({
          number: curr.label,
          points: qPoints,
          text: cleanLatexStr(segment),
          solution: ''
        });
      }
    } else {
      preamble = cleanLatexStr(fullText);
    }
  }

  return { title: cleanTitle, points, preamble, items };
};

export const generateNationalExamHTML = async (examData, settings = {}) => {
  const meta = examData?.header?.national_exam_meta || examData?.national_exam_meta || {};
  
  const year = meta.year || '2026';
  const session = meta.session || `الدورة العادية ${year}`;
  const subject = meta.subject || examData?.header?.subject || 'الرياضيات';
  const branch = meta.branch || examData?.header?.level || 'مسلك علوم الحياة والأرض ومسلك العلوم الفيزيائية (خيار فرنسية)';
  const code = meta.code || 'NS 22F';
  const duration = meta.duration || '3س';
  const coeff = meta.coefficient || '7';
  const subjectNumber = meta.subject_number || '3';
  const totalPages = meta.total_pages || 8;

  const instructions = meta.general_instructions || [
    "L'utilisation d'une calculatrice non programmable est autorisée ;",
    "Le candidat peut traiter les exercices et le problème suivant l'ordre qui lui convient ;",
    "Il est recommandé d'éviter l'usage de la couleur rouge dans la rédaction des solutions."
  ];

  const components = meta.subject_components || [
    { name: "Exercice 1", topic: "Géométrie dans l'espace", points: "3 points" },
    { name: "Exercice 2", topic: "Nombres complexes", points: "3.5 points" },
    { name: "Exercice 3", topic: "Calcul des probabilités", points: "2.5 points" },
    { name: "Problème", topic: "Etude de fonctions numériques, suites numériques et calcul intégral", points: "11 points" }
  ];

  const notations = meta.notations || [
    "On note z̄ le conjugué d'un nombre complexe z, et |z| son module.",
    "ln désigne la fonction logarithme népérien.",
    "e est le nombre réel tel que ln(e) = 1."
  ];

  const rawSections = examData?.sections || examData?.items || examData?.questions || [];
  const exercises = Array.isArray(rawSections) ? rawSections
    .filter(sec => {
      const t = (sec.title || sec.name || '').toLowerCase().trim();
      if (t.includes('composante') || t.includes('instruction') || t.includes('notation')) return false;
      return true;
    })
    .map((sec, idx) => parseExercise(sec, idx)) : [];

  // Generate QR codes
  const qrCodeUrls = {};
  for (let eIdx = 0; eIdx < exercises.length; eIdx++) {
    const ex = exercises[eIdx];
    const qList = ex.items || [];
    for (let qIdx = 0; qIdx < qList.length; qIdx++) {
      const q = qList[qIdx];
      const key = `ex${eIdx}_q${qIdx}`;
      const payload = q.qr_code_data || q.qr_code_url || `https://lconq.ma/solve?ex=${eIdx + 1}&q=${qIdx + 1}&code=${code}`;
      try {
        qrCodeUrls[key] = await QRCode.toDataURL(payload, { width: 100, margin: 1 });
      } catch (err) {
        qrCodeUrls[key] = '';
      }
    }
  }

  const escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>الامتحان الوطني الموحد للبكالوريا - ${escapeHtml(code)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}, {left: '\\\\(', right: '\\\\)', display: false}, {left: '\\\\[', right: '\\\\]', display: true}], ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] });"></script>
  <style>
    @page {
      size: A4;
      margin: 12mm 14mm;
    }
    body {
      font-family: 'Inter', 'Tajawal', 'Segoe UI', Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #000;
      background: #fff;
      font-size: 13px;
      line-height: 1.45;
    }
    .ne-page {
      width: 100%;
      box-sizing: border-box;
    }
    .ne-box { border: 1.5px solid #000; box-sizing: border-box; }
    .ne-table { border-collapse: collapse; width: 100%; font-size: 0.92rem; }
    .ne-table td, .ne-table th { border: 1.5px solid #000; padding: 7px 10px; text-align: center; }
    .ne-q-box { border: 1.5px solid #000; margin-bottom: 12px; display: flex; width: 100%; box-sizing: border-box; min-height: 54px; page-break-inside: avoid; }
    .ne-q-points { width: 85px; border-right: 1.5px solid #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.95rem; background: #fff; text-align: center; padding: 6px; flex-shrink: 0; }
    .ne-q-content { flex: 1; padding: 10px 14px; font-size: 0.95rem; display: flex; flex-direction: column; justify-content: center; border-right: 1.5px solid #000; }
    .ne-q-qr { width: 85px; display: flex; align-items: center; justify-content: center; background: #fff; padding: 4px; flex-shrink: 0; }
    .ne-q-qr img { width: 75px; height: 75px; object-fit: contain; }
    .page-break { page-break-before: always; }
    .katex {
      font-size: 1.0em !important;
    }
    .katex .msupsub .vlist-t:not(.vlist-t2) .sizing.size3,
    .katex .msupsub .vlist-t:not(.vlist-t2) .sizing.reset-size6.size3,
    .katex .msupsub .vlist-t.vlist-t2 span[style*="top:-3"] .sizing.size3,
    .katex .msupsub .vlist-t.vlist-t2 span[style*="top:-3"] .sizing.reset-size6.size3 {
      font-size: 0.63em !important;
    }
  </style>
</head>
<body>
  <div class="ne-page">
    <!-- PAGE 1 COVER -->
    <div class="ne-box" style="display: grid; grid-template-columns: 130px 1fr 210px; height: 142px; margin-bottom: 14px;">
      <div style="border-right: 1.5px solid #000; text-align: center; padding: 6px; display: flex; flex-direction: column; justify-content: center;">
        <div style="font-size: 1.05rem; font-weight: bold; margin-bottom: 8px; font-family: 'Tajawal', sans-serif;">الصفحة</div>
        <div style="font-size: 1.8rem; font-weight: 900; line-height: 1;">1</div>
        <div style="width: 36px; height: 1.5px; background: #000; margin: 5px auto;"></div>
        <div style="font-size: 1.35rem; font-weight: bold;">${totalPages}</div>
      </div>
      <div style="border-right: 1.5px solid #000; text-align: center; padding: 8px; display: flex; flex-direction: column; justify-content: center;">
        <h1 style="font-size: 1.4rem; font-weight: 900; margin: 0 0 6px 0; font-family: 'Tajawal', sans-serif;">الامتحان الوطني الموحد للبكالوريا</h1>
        <h2 style="font-size: 1.1rem; font-weight: 700; margin: 0; font-family: 'Tajawal', sans-serif;">- ${escapeHtml(session)} -</h2>
      </div>
      <div style="position: relative; text-align: center; padding: 6px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <div style="position: absolute; top:0; left:0; width:36px; height:36px; clip-path: polygon(0 0, 100% 0, 0 100%); background:#000; display:flex; align-items:flex-start; justify-content:flex-start; padding:2px 0 0 5px;">
          <span style="color:#fff; font-size:0.85rem; font-weight:900; line-height:1;">${subjectNumber}</span>
        </div>
        <svg width="44" height="44" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" stroke="#000" stroke-width="2" fill="none" />
          <path d="M40 22 Q50 14 60 22 L57 26 Q50 19 43 26 Z" fill="#000" />
          <circle cx="50" cy="15" r="2.5" fill="#000" />
          <path d="M34 30 Q50 32 66 30 Q66 58 50 68 Q34 58 34 30 Z" stroke="#000" stroke-width="2" fill="#fff" />
          <path d="M50 36 L53 44 L61 44 L55 49 L57 57 L50 52 L43 57 L45 49 L39 44 L47 44 Z" stroke="#000" stroke-width="1.5" fill="#000" fill-opacity="0.1" />
        </svg>
        <div style="font-weight: bold; font-size: 0.68rem; line-height: 1.2; font-family: 'Tajawal', sans-serif; margin-top: 4px;">
          المملكة المغربية<br/>
          وزارة التربية الوطنية والتعليم الأولية والرياضة<br/>
          <span style="font-size: 0.62rem; font-weight: normal;">المركز الوطني للامتحانات والتوجيه</span>
        </div>
      </div>
    </div>

    <!-- METADATA TABLE -->
    <table class="ne-table" style="margin-bottom: 22px;">
      <tbody>
        <tr>
          <td style="width: 130px; font-weight: bold; font-size: 1.05rem; background: #fcfcfc;">${escapeHtml(code)}</td>
          <td style="font-weight: 900; font-size: 1.25rem; font-family: 'Tajawal', sans-serif;">الموضوع</td>
        </tr>
        <tr>
          <td style="padding: 6px;">
            <div style="font-size: 0.75rem; font-family: 'Tajawal', sans-serif;">مدة الإنجاز</div>
            <div style="font-weight: bold; font-size: 1.1rem;">${escapeHtml(duration)}</div>
          </td>
          <td style="font-weight: bold; font-size: 1.1rem; text-align: center; padding: 6px; font-family: 'Tajawal', 'Inter', sans-serif;">
            <div style="font-size: 0.75rem; font-weight: normal; margin-bottom: 2px;">المادة</div>
            ${escapeHtml(subject)}
          </td>
        </tr>
        <tr>
          <td style="padding: 6px;">
            <div style="font-size: 0.75rem; font-family: 'Tajawal', sans-serif;">المعامل</div>
            <div style="font-weight: bold; font-size: 1.1rem;">${escapeHtml(coeff)}</div>
          </td>
          <td style="font-weight: bold; font-size: 0.95rem; text-align: center; padding: 6px; font-family: 'Tajawal', 'Inter', sans-serif;">
            <div style="font-size: 0.75rem; font-weight: normal; margin-bottom: 2px;">الشعبة والمسلك</div>
            ${escapeHtml(branch)}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- INSTRUCTIONS -->
    <div style="margin-bottom: 22px;">
      <h3 style="text-align: center; font-size: 1.1rem; font-weight: bold; margin: 0 0 10px 0; text-decoration: underline;">Instructions générales</h3>
      <ul style="margin: 0; padding-left: 24px; font-size: 0.92rem; line-height: 1.5;">
        ${instructions.map(i => `<li style="margin-bottom: 4px;">${escapeHtml(i)}</li>`).join('')}
      </ul>
    </div>

    <!-- COMPOSANTES DU SUJET -->
    <div style="margin-bottom: 22px;">
      <h3 style="text-align: center; font-size: 1.1rem; font-weight: bold; margin: 0 0 8px 0; text-decoration: underline;">Composantes du sujet</h3>
      <p style="font-size: 0.9rem; margin-bottom: 12px; line-height: 1.4;">L'épreuve est composée de trois exercices et d'un problème, indépendants entre eux, et répartis selon les domaines comme suit :</p>
      <table class="ne-table" style="font-size: 0.92rem;">
        <tbody>
          ${components.map(c => `
            <tr>
              <td style="width: 140px; font-weight: bold; text-align: left; padding-left: 12px;">${escapeHtml(c.name)}</td>
              <td style="text-align: left; padding-left: 12px;">${escapeHtml(c.topic)}</td>
              <td style="width: 110px; font-weight: bold;">${escapeHtml(c.points)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- NOTATIONS -->
    <div style="margin-bottom: 28px;">
      <h3 style="text-align: center; font-size: 1.1rem; font-weight: bold; margin: 0 0 8px 0; text-decoration: underline;">Notations</h3>
      <ul style="margin: 0; padding-left: 24px; font-size: 0.92rem; line-height: 1.5;">
        ${notations.map(n => `<li style="margin-bottom: 4px;">${escapeHtml(n)}</li>`).join('')}
      </ul>
    </div>

    <!-- EXERCISES -->
    ${exercises.map((ex, eIdx) => {
      const titleHasPoints = ex.title.toLowerCase().includes('point') || ex.title.toLowerCase().includes('pt');
      const titlePointsSuffix = (ex.points && !titleHasPoints) ? ` (${escapeHtml(ex.points)})` : '';

      return `
        <div class="page-break" style="margin-top: 28px;">
          <div class="ne-box" style="display: grid; grid-template-columns: 110px 1fr 100px; height: 48px; margin-bottom: 18px; align-items: center;">
            <div style="border-right: 1.5px solid #000; text-align: center; font-weight: bold; font-size: 0.88rem;">
              <div style="font-family: 'Tajawal', sans-serif;">الصفحة</div>
              <div>${eIdx + 2} / ${totalPages}</div>
            </div>
            <div style="border-right: 1.5px solid #000; text-align: center; padding: 0 8px;">
              <div style="font-size: 0.78rem; font-weight: bold; font-family: 'Tajawal', sans-serif;">موضوع الامتحان الوطني الموحد للبكالوريا - ${escapeHtml(session)}</div>
              <div style="font-size: 0.72rem; font-family: 'Tajawal', 'Inter', sans-serif;">مادة : ${escapeHtml(subject)} - ${escapeHtml(branch)}</div>
            </div>
            <div style="text-align: center; font-weight: bold; font-size: 0.88rem;">${escapeHtml(code)}</div>
          </div>

          <div style="margin-bottom: 12px;">
            <h3 style="font-size: 1.12rem; font-weight: 900; text-decoration: underline; margin: 0 0 8px 0;">
              ${escapeHtml(ex.title)}${titlePointsSuffix} :
            </h3>
            ${ex.preamble ? `<div style="font-size: 0.95rem; margin-bottom: 12px; line-height: 1.55;">${escapeHtml(ex.preamble)}</div>` : ''}
          </div>

          ${(ex.items || []).map((q, qIdx) => {
            const qrKey = `ex${eIdx}_q${qIdx}`;
            const qrUrl = qrCodeUrls[qrKey] || '';
            const qPts = q.points || q.pts || '0.5 pt';
            const qLabel = q.number || q.label || q.index || `${qIdx + 1}.`;
            const qText = typeof q === 'string' ? q : (q.text || q.question || q.content || '');

            return `
              <div class="ne-q-box">
                <div class="ne-q-points">${escapeHtml(qPts)}</div>
                <div class="ne-q-content">
                  <div><strong style="margin-right: 6px; font-size: 0.98rem;">${escapeHtml(qLabel)}</strong> ${escapeHtml(qText)}</div>
                </div>
                <div class="ne-q-qr">
                  ${qrUrl ? `<img src="${qrUrl}" alt="QR" />` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('')}
  </div>
</body>
</html>
  `;
};

export const openNationalExamPrintWindow = async (examData, settings = {}) => {
  const html = await generateNationalExamHTML(examData, settings);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 800);
  }
};
