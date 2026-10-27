import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { renderWithMath } from '../utils/mathRenderer';

// High-precision Moroccan Emblem Coat of Arms SVG Icon
const MoroccanEmblemSVG = () => (
  <svg width="44" height="44" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="46" stroke="#000000" strokeWidth="2" fill="none" />
    <path d="M40 22 Q50 14 60 22 L57 26 Q50 19 43 26 Z" fill="#000000" />
    <circle cx="50" cy="15" r="2.5" fill="#000000" />
    <path d="M34 30 Q50 32 66 30 Q66 58 50 68 Q34 58 34 30 Z" stroke="#000000" strokeWidth="2" fill="#ffffff" />
    <path d="M50 36 L53 44 L61 44 L55 49 L57 57 L50 52 L43 57 L45 49 L39 44 L47 44 Z" stroke="#000000" strokeWidth="1.5" fill="#000000" fillOpacity="0.1" />
    <circle cx="50" cy="30" r="3" fill="#000000" />
    <path d="M50 25 L50 21 M44 26 L41 23 M56 26 L59 23" stroke="#000000" strokeWidth="1.5" />
    <path d="M30 74 Q50 80 70 74 Q60 84 50 82 Q40 84 30 74 Z" stroke="#000000" strokeWidth="1.5" fill="#000000" />
  </svg>
);

// Helper to clean markdown & LaTeX strings
const cleanLatexStr = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)([A-ZÀ-ÖØ-ß])/g, '\n $1') // Fix \nSoit -> \n Soit
    .replace(/(?<![a-zA-Z\\])otin(?=[\\\{\sA-Z0-9\(\[]|$)/g, '\\notin ') // Fix corrupted \notin (otin -> \notin)
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

export default function NationalExamTemplate({ examData, solutionMode = false }) {
  const [qrCodeUrls, setQrCodeUrls] = useState({});

  // Safely extract metadata from examData
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

  // Extract raw sections / exercises
  const rawSections = examData?.sections || examData?.items || examData?.questions || [];
  
  // Filter out meta-sections & parse each exercise cleanly
  const exercises = Array.isArray(rawSections) ? rawSections
    .filter(sec => {
      const t = (sec.title || sec.name || '').toLowerCase().trim();
      if (t.includes('composante') || t.includes('instruction') || t.includes('notation')) return false;
      return true;
    })
    .map((sec, idx) => parseExercise(sec, idx)) : [];

  // Generate QR codes for questions
  useEffect(() => {
    let active = true;
    const generateQRs = async () => {
      const urls = {};
      let qIndex = 1;
      for (let eIdx = 0; eIdx < exercises.length; eIdx++) {
        const ex = exercises[eIdx];
        const qList = ex.items || [];
        for (let qIdx = 0; qIdx < qList.length; qIdx++) {
          const q = qList[qIdx];
          const key = `ex${eIdx}_q${qIdx}`;
          const payload = q.qr_code_data || q.qr_code_url || `https://lconq.ma/solve?ex=${eIdx + 1}&q=${qIdx + 1}&code=${code}`;
          try {
            const url = await QRCode.toDataURL(payload, {
              width: 100,
              margin: 1,
              color: { dark: '#000000', light: '#ffffff' }
            });
            if (active) urls[key] = url;
          } catch (err) {
            console.error('QR code generation error:', err);
          }
          qIndex++;
        }
      }
      if (active) setQrCodeUrls(urls);
    };
    generateQRs();
    return () => { active = false; };
  }, [examData]);

  return (
    <div className="national-exam-wrapper" style={{
      backgroundColor: '#f8fafc',
      padding: '20px 10px',
      display: 'flex',
      justifyContent: 'center'
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700;900&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />

      <div className="national-exam-container" style={{
        fontFamily: "'Inter', 'Tajawal', 'Segoe UI', Arial, sans-serif",
        backgroundColor: '#ffffff',
        color: '#000000',
        width: '100%',
        maxWidth: '820px',
        padding: '24px 32px',
        boxSizing: 'border-box',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        border: '1px solid #e2e8f0',
        borderRadius: '2px',
        lineHeight: '1.45'
      }}>
        <style>{`
          .ne-box { border: 1.5px solid #000; box-sizing: border-box; }
          .ne-table { border-collapse: collapse; width: 100%; font-size: 0.92rem; }
          .ne-table td, .ne-table th { border: 1.5px solid #000; padding: 7px 10px; text-align: center; }
          .ne-q-box { border: 1.5px solid #000; margin-bottom: 14px; display: flex; width: 100%; box-sizing: border-box; min-height: 56px; }
          .ne-q-points { width: 85px; border-right: 1.5px solid #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem; background: #fff; text-align: center; padding: 6px; flex-shrink: 0; }
          .ne-q-content { flex: 1; padding: 10px 14px; font-size: 0.95rem; display: flex; flex-direction: column; justify-content: center; border-right: 1.5px solid #000; }
          .ne-q-qr { width: 85px; display: flex; align-items: center; justify-content: center; background: #fff; padding: 4px; flex-shrink: 0; }
          .ne-q-qr img { width: 75px; height: 75px; object-fit: contain; }

          @media print {
            .national-exam-wrapper { background: #fff !important; padding: 0 !important; }
            .national-exam-container { width: 100% !important; max-width: none !important; padding: 0 !important; boxShadow: none !important; border: none !important; }
            .ne-page-break { page-break-before: always; margin-top: 24px; }
          }
        `}</style>

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PAGE 1: OFFICIAL COVER & HEADER SHEET */}
        {/* ════════════════════════════════════════════════════════════ */}

        {/* Top Header Grid Box (Page 1) */}
        <div className="ne-box" style={{ display: 'grid', gridTemplateColumns: '130px 1fr 210px', height: '142px', marginBottom: '14px' }}>
          
          {/* Left Column: Page Numbers */}
          <div style={{ borderRight: '1.5px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6px' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '8px', fontFamily: "'Tajawal', sans-serif" }}>الصفحة</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', lineHeight: 1 }}>1</div>
            <div style={{ width: '36px', height: '1.5px', backgroundColor: '#000', margin: '5px 0' }} />
            <div style={{ fontSize: '1.35rem', fontWeight: 'bold' }}>{totalPages}</div>
          </div>

          {/* Middle Column: Title & Session */}
          <div style={{ borderRight: '1.5px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '900', margin: '0 0 6px 0', fontFamily: "'Tajawal', sans-serif", letterSpacing: '-0.01em' }}>
              الامتحان الوطني الموحد للبكالوريا
            </h1>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, fontFamily: "'Tajawal', sans-serif" }}>
              - {session} -
            </h2>
          </div>

          {/* Right Column: Emblem & Ministry Text */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6px' }}>
            {/* Triangular Badge */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '36px',
              height: '36px',
              clipPath: 'polygon(0 0, 100% 0, 0 100%)',
              backgroundColor: '#000',
              zIndex: 2,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              padding: '2px 0 0 5px'
            }}>
              <span style={{
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: '900',
                lineHeight: 1
              }}>
                {subjectNumber}
              </span>
            </div>

            <MoroccanEmblemSVG />
            <div style={{ fontSize: '0.68rem', fontWeight: 'bold', lineHeight: 1.2, marginTop: '4px', fontFamily: "'Tajawal', sans-serif" }}>
              المملكة المغربية<br />
              وزارة التربية الوطنية والتعليم الأولية والرياضة<br />
              <span style={{ fontSize: '0.62rem', fontWeight: 'normal' }}>المركز الوطني للامتحانات والتوجيه</span>
            </div>
          </div>
        </div>

        {/* Metadata Grid Table (Page 1) */}
        <table className="ne-table" style={{ marginBottom: '22px' }}>
          <tbody>
            <tr>
              <td style={{ width: '130px', fontWeight: 'bold', fontSize: '1.05rem', backgroundColor: '#fcfcfc' }}>{code}</td>
              <td style={{ fontWeight: '900', fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'Tajawal', sans-serif" }}>الموضوع</td>
            </tr>
            <tr>
              <td style={{ padding: '6px' }}>
                <div style={{ fontSize: '0.75rem', fontFamily: "'Tajawal', sans-serif", color: '#222' }}>مدة الإنجاز</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{duration}</div>
              </td>
              <td style={{ fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', padding: '6px', fontFamily: "'Tajawal', 'Inter', sans-serif" }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#222', marginBottom: '2px' }}>المادة</div>
                {subject}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px' }}>
                <div style={{ fontSize: '0.75rem', fontFamily: "'Tajawal', sans-serif", color: '#222' }}>المعامل</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{coeff}</div>
              </td>
              <td style={{ fontWeight: 'bold', fontSize: '0.95rem', textAlign: 'center', padding: '6px', fontFamily: "'Tajawal', 'Inter', sans-serif" }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#222', marginBottom: '2px' }}>الشعبة والمسلك</div>
                {branch}
              </td>
            </tr>
          </tbody>
        </table>

        {/* General Instructions Section */}
        <div style={{ marginBottom: '22px' }}>
          <h3 style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 10px 0', textDecoration: 'underline' }}>
            Instructions générales
          </h3>
          <ul style={{ margin: 0, paddingLeft: '24px', fontSize: '0.92rem', lineHeight: '1.5' }}>
            {instructions.map((inst, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{inst}</li>
            ))}
          </ul>
        </div>

        {/* Composantes du Sujet Section */}
        <div style={{ marginBottom: '22px' }}>
          <h3 style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 8px 0', textDecoration: 'underline' }}>
            Composantes du sujet
          </h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '12px', lineHeight: '1.4' }}>
            L'épreuve est composée de trois exercices et d'un problème, indépendants entre eux, et répartis selon les domaines comme suit :
          </p>

          <table className="ne-table" style={{ fontSize: '0.92rem' }}>
            <tbody>
              {components.map((comp, idx) => (
                <tr key={idx}>
                  <td style={{ width: '140px', fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>
                    {comp.name}
                  </td>
                  <td style={{ textAlign: 'left', paddingLeft: '12px' }}>
                    {comp.topic}
                  </td>
                  <td style={{ width: '110px', fontWeight: 'bold' }}>
                    {comp.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notations Section */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 8px 0', textDecoration: 'underline' }}>
            Notations
          </h3>
          <ul style={{ margin: 0, paddingLeft: '24px', fontSize: '0.92rem', lineHeight: '1.5' }}>
            {notations.map((not, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>
                {renderWithMath(not)}
              </li>
            ))}
          </ul>
        </div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PAGES 2+: EXERCISES & SUB-QUESTION BOX GRID */}
        {/* ════════════════════════════════════════════════════════════ */}

        {exercises.map((ex, eIdx) => {
          const titleHasPoints = ex.title.toLowerCase().includes('point') || ex.title.toLowerCase().includes('pt');
          const titlePointsSuffix = (ex.points && !titleHasPoints) ? ` (${ex.points})` : '';

          return (
            <div key={eIdx} className="ne-page-break" style={{ marginTop: '28px' }}>

              {/* Banner Header for Pages 2+ */}
              <div className="ne-box" style={{ display: 'grid', gridTemplateColumns: '110px 1fr 100px', height: '48px', marginBottom: '18px', alignItems: 'center' }}>
                <div style={{ borderRight: '1.5px solid #000', textAlign: 'center', fontWeight: 'bold', fontSize: '0.88rem' }}>
                  <div style={{ fontFamily: "'Tajawal', sans-serif" }}>الصفحة</div>
                  <div>{eIdx + 2} / {totalPages}</div>
                </div>
                <div style={{ borderRight: '1.5px solid #000', textAlign: 'center', padding: '0 8px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 'bold', fontFamily: "'Tajawal', sans-serif" }}>
                    موضوع الامتحان الوطني الموحد للبكالوريا - {session}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontFamily: "'Tajawal', 'Inter', sans-serif" }}>
                    مادة : {subject} - {branch}
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  {code}
                </div>
              </div>

              {/* Exercise Title */}
              <div style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.12rem', fontWeight: '900', textDecoration: 'underline', margin: '0 0 8px 0' }}>
                  {ex.title}{titlePointsSuffix} :
                </h3>
                {ex.preamble && (
                  <div style={{ fontSize: '0.95rem', marginBottom: '12px', lineHeight: 1.55 }}>
                    {renderWithMath(ex.preamble)}
                  </div>
                )}
              </div>

              {/* Sub-question Grid Cards */}
              {ex.items && ex.items.map((q, qIdx) => {
                const qrKey = `ex${eIdx}_q${qIdx}`;
                const qrUrl = qrCodeUrls[qrKey];
                const qPoints = q.points || q.pts || '0.5 pt';
                const qLabel = q.number || q.label || q.index || `${qIdx + 1}.`;
                const qText = typeof q === 'string' ? q : (q.text || q.question || q.content || '');
                const solutionText = q.solution || q.answer || '';

                return (
                  <div key={qIdx} className="ne-q-box">
                    {/* Left Cell: Allocated Points */}
                    <div className="ne-q-points">
                      {qPoints}
                    </div>

                    {/* Middle Cell: Question Statement */}
                    <div className="ne-q-content">
                      <div>
                        {qLabel && <strong style={{ marginRight: '6px', fontSize: '0.98rem' }}>{qLabel}</strong>}
                        {renderWithMath(qText)}
                      </div>

                      {solutionMode && solutionText && (
                        <div style={{
                          marginTop: '8px',
                          padding: '8px 12px',
                          background: '#f8fafc',
                          borderLeft: '3px solid #10b981',
                          fontSize: '0.88rem',
                          color: '#064e3b'
                        }}>
                          <strong style={{ display: 'block', marginBottom: '3px', color: '#047857' }}>التصحيح / الحل :</strong>
                          {renderWithMath(solutionText)}
                        </div>
                      )}
                    </div>

                    {/* Right Cell: Dynamic QR Code */}
                    <div className="ne-q-qr">
                      {qrUrl ? (
                        <img src={qrUrl} alt={`QR Code Q${qIdx + 1}`} />
                      ) : (
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>QR</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
