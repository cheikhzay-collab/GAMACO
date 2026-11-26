import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { getGlobalPrimeSettings } from '../utils/devoirPrimeHelpers';
import { renderWithMath } from '../utils/mathRenderer';
import { parseNationalExamExercise, extractNationalExamMeta } from '../utils/nationalExamHelpers';
import {
  buildFigureMapFromList,
  splitTextByFigureTokens,
  resolveFigureItem,
  hasFigureToken,
  getImageItemUrl,
} from '../utils/figureShortcodes';

const renderNeFigure = (fig, key) => {
  const url = getImageItemUrl(fig);
  if (!url) return null;
  const align = fig.align === 'left' || fig.align === 'right' ? fig.align : 'center';
  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  const widthPct = Math.min(100, Math.max(20, Number(fig.width_pct) || 75));
  const rawCap = (fig.caption || fig.alt || '').trim();
  const isRedundant = !rawCap || /^(figure(\s*g[ée]om[ée]trique)?|figure|image|photo|شكل(\s*هندسي)?)$/i.test(rawCap);
  return (
    <div key={key} style={{ display: 'flex', justifyContent: justify, margin: '10px 0', width: '100%' }}>
      <figure style={{ margin: 0, width: `${widthPct}%`, maxWidth: '100%', textAlign: 'center' }}>
        <img
          src={url}
          alt={rawCap || 'Figure'}
          style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', display: 'block', margin: '0 auto', borderRadius: '4px' }}
        />
        {!isRedundant && (
          <figcaption style={{ marginTop: '4px', fontSize: '9pt', color: '#475569', fontStyle: 'italic' }}>
            {renderWithMath(rawCap)}
          </figcaption>
        )}
      </figure>
    </div>
  );
};

const renderNeRichText = (txt, figMap) => {
  if (txt === null || txt === undefined) return null;
  const str = String(txt);
  if (!hasFigureToken(str) || !figMap || figMap.size === 0) {
    return renderWithMath(str);
  }
  return splitTextByFigureTokens(str).map((seg, i) => {
    if (seg.type === 'figure') {
      const resolved = resolveFigureItem(figMap, seg);
      return resolved ? renderNeFigure(resolved, `ne-fig-${i}-${seg.figId}`) : null;
    }
    return seg.value.trim() ? <span key={`ne-txt-${i}`}>{renderWithMath(seg.value)}</span> : null;
  });
};

// High-precision Moroccan Emblem Coat of Arms SVG Icon
const MoroccanEmblemSVG = () => (
  <svg width="42" height="42" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="46" stroke="#0f172a" strokeWidth="2" fill="none" />
    <path d="M40 22 Q50 14 60 22 L57 26 Q50 19 43 26 Z" fill="#0f172a" />
    <circle cx="50" cy="15" r="2.5" fill="#0f172a" />
    <path d="M34 30 Q50 32 66 30 Q66 58 50 68 Q34 58 34 30 Z" stroke="#0f172a" strokeWidth="2" fill="#ffffff" />
    <path d="M50 36 L53 44 L61 44 L55 49 L57 57 L50 52 L43 57 L45 49 L39 44 L47 44 Z" stroke="#0f172a" strokeWidth="1.5" fill="#0f172a" fillOpacity="0.12" />
    <circle cx="50" cy="30" r="3" fill="#0f172a" />
    <path d="M50 25 L50 21 M44 26 L41 23 M56 26 L59 23" stroke="#0f172a" strokeWidth="1.5" />
    <path d="M30 74 Q50 80 70 74 Q60 84 50 82 Q40 84 30 74 Z" stroke="#0f172a" strokeWidth="1.5" fill="#0f172a" />
  </svg>
);

const isArabicStr = (s) => /[\u0600-\u06FF]/.test(String(s || ''));

const renderGridTable = (blk, key) => {
  const cells = Array.isArray(blk.grid_items) ? blk.grid_items : [];
  if (cells.length === 0) return null;
  const rowLen = cells.length >= 6 && cells.length % 2 === 0 ? cells.length / 2 : Math.max(2, Number(blk.cols) || 4);
  const rows = [];
  for (let i = 0; i < cells.length; i += rowLen) {
    rows.push(cells.slice(i, i + rowLen));
  }
  return (
    <div key={key} style={{ margin: '10px 0 14px', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '10.2pt' }}>
        <tbody>
          {rows.map((r, rIdx) => (
            <tr key={rIdx}>
              {r.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    border: '1px solid #0f172a',
                    padding: '6px 14px',
                    textAlign: 'center',
                    minWidth: '52px',
                    fontWeight: cIdx === 0 || rIdx === 0 ? 700 : 400,
                    backgroundColor: cIdx === 0 || rIdx === 0 ? '#f8fafc' : '#ffffff',
                  }}
                >
                  {cell ? renderWithMath(String(cell)) : '\u00A0'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function NationalExamTemplate({ examData, solutionMode = false }) {
  const { ministryLogo: authMinistryLogo } = useAuth();
  const activeMinistryLogo = authMinistryLogo || getGlobalPrimeSettings().ministryLogo || '';
  const [qrCodeUrls, setQrCodeUrls] = useState({});

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
  } = useMemo(() => extractNationalExamMeta(examData), [examData]);

  const exercises = useMemo(() => {
    const rawSections = examData?.sections || examData?.items || examData?.questions || [];
    if (!Array.isArray(rawSections)) return [];
    return rawSections
      .filter(sec => {
        const t = (sec.title || sec.name || '').toLowerCase().trim();
        return !t.includes('composante') && !t.includes('instruction') && !t.includes('notation');
      })
      .map((sec, idx) => parseNationalExamExercise(sec, idx));
  }, [examData]);

  // Generate compact QR codes for graded questions
  useEffect(() => {
    let active = true;
    const generateQRs = async () => {
      const urls = {};
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
            const url = await QRCode.toDataURL(payload, {
              width: 96,
              margin: 1,
              color: { dark: '#0f172a', light: '#ffffff' }
            });
            if (active) urls[key] = url;
          } catch {
            // ignore QR failure
          }
        }
      }
      if (active) setQrCodeUrls(urls);
    };
    generateQRs();
    return () => { active = false; };
  }, [exercises, code]);

  return (
    <div
      className="national-exam-wrapper"
      dir="ltr"
      style={{
        backgroundColor: '#f1f5f9',
        padding: '20px 10px',
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      {/* Authentic Academic & Arabic Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@600;700;800&family=STIX+Two+Text:ital,wght@0,400;0,600;0,700;1,400&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
      <link href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css" rel="stylesheet" />

      <div
        className="national-exam-container"
        style={{
          fontFamily: "'Computer Modern Serif', 'STIX Two Text', 'Times New Roman', Georgia, serif",
          backgroundColor: '#ffffff',
          color: '#0f172a',
          width: '100%',
          maxWidth: '820px',
          padding: '28px 34px',
          boxSizing: 'border-box',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          border: '1px solid #cbd5e1',
          borderRadius: '2px',
          fontSize: '11pt',
          lineHeight: 1.62
        }}
      >
        <style>{`
          .ne-box { border: 1.5px solid #0f172a; box-sizing: border-box; }
          .ne-table { border-collapse: collapse; width: 100%; font-size: 10.4pt; }
          .ne-table td, .ne-table th { border: 1.25px solid #0f172a; padding: 7px 10px; text-align: center; }
          .ne-q-box { border: 1px solid #334155; border-radius: 3px; margin-bottom: 7px; display: flex; width: 100%; box-sizing: border-box; min-height: 40px; }
          .ne-q-points { width: 68px; border-right: 1px solid #334155; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 9.5pt; background: #f8fafc; color: #0f172a; text-align: center; padding: 4px; flex-shrink: 0; }
          .ne-q-content { flex: 1; padding: 7px 12px; font-size: 10.6pt; line-height: 1.64; display: flex; flex-direction: column; justify-content: center; overflow-wrap: anywhere; }
          .ne-q-qr { width: 52px; border-left: 1px solid #334155; display: flex; align-items: center; justify-content: center; background: #fff; padding: 3px; flex-shrink: 0; }
          .ne-q-qr img { width: 42px; height: 42px; object-fit: contain; }
          .ne-sol-box { border-left: 3px solid #059669; background: #f0fdf4; padding: 8px 12px; margin: 4px 0 10px 0; font-size: 10.2pt; line-height: 1.58; color: #064e3b; border-radius: 0 4px 4px 0; }
          .ne-ex-head { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin: 16px 0 8px 0; }
          .ne-section-title { text-align: center; font-size: 12pt; font-weight: 700; margin: 0 0 10px 0; }
          .ne-section-title > span { border-bottom: 1.5px solid #0f172a; padding-bottom: 2px; display: inline-block; }

          @media print {
            .national-exam-wrapper { background: #fff !important; padding: 0 !important; }
            .national-exam-container { width: 100% !important; max-width: none !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
            .ne-page-break { page-break-before: always; break-before: page; }
          }
        `}</style>

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PAGE 1: OFFICIAL COVER & HEADER SHEET */}
        {/* ════════════════════════════════════════════════════════════ */}
        <div className="ne-box" style={{ display: 'grid', gridTemplateColumns: '112px 1fr 220px', minHeight: '136px', marginBottom: '14px' }}>
          {/* Left Column: Page 1 Badge */}
          <div style={{ borderRight: '1.5px solid #0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px' }}>
            <div style={{ fontSize: '10.5pt', fontWeight: 800, marginBottom: '6px', fontFamily: "'Tajawal', sans-serif" }} dir="rtl">الصفحة</div>
            <div style={{ fontSize: '20pt', fontWeight: 900, lineHeight: 1 }}>1</div>
            <div style={{ width: '34px', height: '1.5px', backgroundColor: '#0f172a', margin: '5px 0' }} />
            <div style={{ fontSize: '9pt', fontWeight: 700, color: '#334155', fontFamily: "'Tajawal', sans-serif" }} dir="rtl">الموضوع</div>
          </div>

          {/* Middle Column: Title & Session */}
          <div style={{ borderRight: '1.5px solid #0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px 12px' }} dir="rtl">
            <h1 style={{ fontSize: '15.5pt', fontWeight: 900, margin: '0 0 6px 0', fontFamily: "'Tajawal', sans-serif", color: '#0f172a' }}>
              الامتحان الوطني الموحد للبكالوريا
            </h1>
            <h2 style={{ fontSize: '11.5pt', fontWeight: 700, margin: 0, fontFamily: "'Tajawal', sans-serif", color: '#1e293b' }}>
              - {session} -
            </h2>
          </div>

          {/* Right Column: Emblem & Ministry Text */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px 10px' }}>
            <svg width="36" height="36" viewBox="0 0 36 36" style={{ position: 'absolute', top: 0, left: 0 }}>
              <polygon points="0,0 36,0 0,36" fill="#0f172a" />
              <text x="6" y="15" fill="#ffffff" fontFamily="STIX Two Text, Tajawal, sans-serif" fontSize="11" fontWeight="800">{subjectNumber}</text>
            </svg>

            {activeMinistryLogo ? (
              <img
                src={activeMinistryLogo}
                alt="Logo du Ministère"
                style={{ maxHeight: '46px', maxWidth: '175px', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
              />
            ) : (
              <MoroccanEmblemSVG />
            )}
            <div style={{ fontSize: '7.5pt', fontWeight: 700, lineHeight: 1.3, marginTop: '4px', fontFamily: "'Tajawal', sans-serif" }} dir="rtl">
              المملكة المغربية<br />
              وزارة التربية الوطنية والتعليم الأولي والرياضة<br />
              <span style={{ fontSize: '6.8pt', fontWeight: 500, color: '#334155' }}>المركز الوطني للتقويم والامتحانات والتوجيه</span>
            </div>
          </div>
        </div>

        {/* Metadata Grid Table (Page 1) */}
        <table className="ne-table" style={{ marginBottom: '20px' }}>
          <tbody>
            <tr>
              <td style={{ width: '112px', fontWeight: 800, fontSize: '11pt', backgroundColor: '#f8fafc' }}>{code}</td>
              <td style={{ fontWeight: 900, fontSize: '13pt', fontFamily: "'Tajawal', sans-serif" }} dir="rtl">الموضوع</td>
            </tr>
            <tr>
              <td style={{ padding: '7px' }} dir="rtl">
                <div style={{ fontSize: '8pt', fontFamily: "'Tajawal', sans-serif", color: '#475569' }}>مدة الإنجاز</div>
                <div style={{ fontWeight: 800, fontSize: '11pt', fontFamily: "'Tajawal', sans-serif" }}>{duration}</div>
              </td>
              <td style={{ fontWeight: 800, fontSize: '11.5pt', textAlign: 'center', padding: '7px', fontFamily: "'Tajawal', sans-serif" }} dir={isArabicStr(subject) ? 'rtl' : 'ltr'}>
                <div style={{ fontSize: '8pt', fontWeight: 500, color: '#475569', marginBottom: '2px' }} dir="rtl">المادة</div>
                {subject}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '7px' }} dir="rtl">
                <div style={{ fontSize: '8pt', fontFamily: "'Tajawal', sans-serif", color: '#475569' }}>المعامل</div>
                <div style={{ fontWeight: 800, fontSize: '11pt', fontFamily: "'Tajawal', sans-serif" }}>{coeff}</div>
              </td>
              <td style={{ fontWeight: 700, fontSize: '10.2pt', textAlign: 'center', padding: '7px', fontFamily: "'Tajawal', sans-serif" }} dir={isArabicStr(branch) ? 'rtl' : 'ltr'}>
                <div style={{ fontSize: '8pt', fontWeight: 500, color: '#475569', marginBottom: '2px' }} dir="rtl">الشعبة والمسلك</div>
                {branch}
              </td>
            </tr>
          </tbody>
        </table>

        {/* General Instructions Section */}
        <div style={{ marginBottom: '20px' }}>
          <h3 className="ne-section-title"><span>Instructions générales</span></h3>
          <ul style={{ margin: 0, paddingLeft: '24px', fontSize: '10.8pt', lineHeight: 1.58 }}>
            {instructions.map((inst, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }} dir={isArabicStr(inst) ? 'rtl' : 'ltr'}>{renderWithMath(inst)}</li>
            ))}
          </ul>
        </div>

        {/* Composantes du Sujet Section */}
        <div style={{ marginBottom: '20px' }}>
          <h3 className="ne-section-title"><span>Composantes du sujet</span></h3>
          <p style={{ fontSize: '10.6pt', margin: '0 0 10px 0', lineHeight: 1.55 }}>
            L&apos;épreuve est composée des exercices et du problème suivants, indépendants entre eux, et répartis selon les domaines comme suit :
          </p>

          <table className="ne-table" style={{ fontSize: '10.4pt' }}>
            <tbody>
              {components.map((comp, idx) => (
                <tr key={idx}>
                  <td style={{ width: '140px', fontWeight: 700, textAlign: 'left', paddingLeft: '12px' }} dir={isArabicStr(comp.name) ? 'rtl' : 'ltr'}>
                    {comp.name}
                  </td>
                  <td style={{ textAlign: 'left', paddingLeft: '12px' }} dir={isArabicStr(comp.topic) ? 'rtl' : 'ltr'}>
                    {comp.topic}
                  </td>
                  <td style={{ width: '110px', fontWeight: 700 }} dir={isArabicStr(comp.points) ? 'rtl' : 'ltr'}>
                    {comp.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notations Section */}
        <div style={{ marginBottom: '20px' }}>
          <h3 className="ne-section-title"><span>Notations</span></h3>
          <ul style={{ margin: 0, paddingLeft: '24px', fontSize: '10.8pt', lineHeight: 1.58 }}>
            {notations.map((not, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }} dir={isArabicStr(not) ? 'rtl' : 'ltr'}>
                {renderWithMath(not)}
              </li>
            ))}
          </ul>
        </div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PAGES 2+: EXERCISES (Clean sequential flow) */}
        {/* ════════════════════════════════════════════════════════════ */}
        {exercises.length > 0 && (
          <div className="ne-page-break" style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '18px', marginTop: '22px' }}>
            {/* Single Running Exam Header Banner */}
            <div className="ne-box" style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px', padding: '5px 0', marginBottom: '14px', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ borderRight: '1.25px solid #0f172a', textAlign: 'center', fontWeight: 800, fontSize: '9.5pt' }}>
                {code}
              </div>
              <div style={{ textAlign: 'center', padding: '0 10px' }} dir="rtl">
                <div style={{ fontSize: '9pt', fontWeight: 800, fontFamily: "'Tajawal', sans-serif" }}>
                  موضوع الامتحان الوطني الموحد للبكالوريا — {session}
                </div>
                <div style={{ fontSize: '8pt', color: '#334155', fontFamily: "'Tajawal', sans-serif" }}>
                  مادة : {subject} — {branch}
                </div>
              </div>
              <div style={{ borderLeft: '1.25px solid #0f172a', textAlign: 'center', fontWeight: 800, fontSize: '9pt', fontFamily: "'Tajawal', sans-serif" }} dir="rtl">
                الموضوع
              </div>
            </div>

            {exercises.map((ex, eIdx) => {
              const titleHasPoints = /point|pt|نقط/i.test(ex.title);
              const blocks = ex.blocks || [];
              const figMap = buildFigureMapFromList(ex.figures || []);

              return (
                <div key={eIdx} style={{ marginBottom: '18px' }}>
                  <div className="ne-ex-head" dir={isArabicStr(ex.title) ? 'rtl' : 'ltr'}>
                    <h3 style={{ fontSize: '12.2pt', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                      {ex.title}
                    </h3>
                    {(ex.points && !titleHasPoints) && (
                      <span style={{ fontSize: '10.5pt', fontWeight: 700, color: '#005086', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                        ({ex.points})
                      </span>
                    )}
                  </div>

                  {blocks.map((blk, bIdx) => {
                    if (blk.kind === 'table') {
                      return renderGridTable(blk, bIdx);
                    }

                    if (blk.kind === 'image') {
                      return renderNeFigure(blk, `blk-img-${eIdx}-${bIdx}`);
                    }

                    if (blk.kind === 'text') {
                      return (
                        <div
                          key={bIdx}
                          style={{ fontSize: '10.8pt', lineHeight: 1.62, margin: '5px 0 8px 0', color: '#111827', textAlign: 'justify' }}
                          dir={isArabicStr(blk.text) ? 'rtl' : 'ltr'}
                        >
                          {renderNeRichText(blk.text, figMap)}
                        </div>
                      );
                    }

                    const qrUrl = qrCodeUrls[`ex${eIdx}_b${bIdx}`] || '';
                    return (
                      <React.Fragment key={bIdx}>
                        <div className="ne-q-box">
                          <div className="ne-q-points">
                            {blk.points || '—'}
                          </div>
                          <div className="ne-q-content" dir={isArabicStr(blk.text) ? 'rtl' : 'ltr'}>
                            <div>
                              {blk.number && <strong style={{ marginRight: '6px' }}>{blk.number}</strong>}
                              {renderNeRichText(blk.text, figMap)}
                            </div>
                          </div>
                          <div className="ne-q-qr">
                            {qrUrl && <img src={qrUrl} alt="QR" />}
                          </div>
                        </div>
                        {solutionMode && blk.solution && (
                          <div className="ne-sol-box" dir={isArabicStr(blk.solution) ? 'rtl' : 'ltr'}>
                            <strong>Corrigé : </strong>
                            {renderNeRichText(blk.solution, figMap)}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {solutionMode && ex.solution && (
                    <div className="ne-sol-box" dir={isArabicStr(ex.solution) ? 'rtl' : 'ltr'}>
                      <strong style={{ display: 'block', marginBottom: '3px' }}>📖 Éléments de réponse / Corrigé détaillé :</strong>
                      {renderNeRichText(ex.solution, figMap)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
