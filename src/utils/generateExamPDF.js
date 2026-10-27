import katex from 'katex';
import QRCode from 'qrcode';
import { getLevelDisplayName } from './levelHelpers';
import { decodeHtmlEntities } from './security';

export { decodeHtmlEntities };

const hasArabic = (str) => /[\u0600-\u06FF]/.test(str || '');

/**
 * Nettoie et formate le titre de l'examen (espace manquant, tirets de fin, etc.)
 */
export const formatExamTitle = (title) => {
  if (!title) return '';
  let cleaned = decodeHtmlEntities(title).trim();
  // Correction des mots collés avec DE/DU (ex: DEMATHÉMATIQUES -> DE MATHÉMATIQUES)
  cleaned = cleaned.replace(/\bDE(MATH[ÉE]MATIQUES|PHYSIQUE|CHIMIE|SVT|FRAN[ÇC]AIS|PHILOSOPHIE|SCIENCES)\b/gi, 'DE $1');
  cleaned = cleaned.replace(/\bDU(MATH[ÉE]MATIQUES|DEVOIR|CONCOURS)\b/gi, 'DU $1');
  // Suppression des tirets, doubles tirets ou caractères parasites à la fin
  cleaned = cleaned.replace(/[\s—–\-_:]+$/g, '').trim();
  return cleaned;
};

/**
 * Détecte intelligemment les métadonnées et libellés du type de document
 */
export const getDocTypeInfo = (examTitle, settings = {}, docType = '') => {
  const lower = (String(examTitle || '') + ' ' + (docType || '') + ' ' + (settings.docType || '')).toLowerCase();
  
  if (lower.includes('diagnostic') || lower.includes('positionnement') || lower.includes('initial')) {
    return {
      typeLabel: 'Évaluation Diagnostique',
      badgeLabel: 'TEST DIAGNOSTIQUE',
      subTitle: 'ÉVALUATION DIAGNOSTIQUE',
      coverTag: 'Test Diagnostique'
    };
  }
  if (lower.includes('devoir') || lower.includes('controle') || lower.includes('contrôle') || lower.includes('homework')) {
    return {
      typeLabel: 'Devoir Surveillé',
      badgeLabel: 'DEVOIR SURVEILLÉ',
      subTitle: 'DEVOIR SURVEILLÉ',
      coverTag: 'Devoir Surveillé'
    };
  }
  if (lower.includes('national') || lower.includes('baccalauréat') || lower.includes('baccalaureat')) {
    return {
      typeLabel: 'Examen National',
      badgeLabel: 'EXAMEN NATIONAL',
      subTitle: 'EXAMEN DU BACCALAURÉAT',
      coverTag: 'Examen National'
    };
  }
  if (lower.includes('exercices') || lower.includes('série') || lower.includes('serie')) {
    return {
      typeLabel: "Série d'exercices",
      badgeLabel: "SÉRIE D'EXERCICES",
      subTitle: "SÉRIE D'EXERCICES",
      coverTag: "Série d'exercices"
    };
  }
  if (lower.includes('concours')) {
    return {
      typeLabel: 'Concours Officiel',
      badgeLabel: 'CONCOURS OFFICIEL',
      subTitle: "CONCOURS D'ACCÈS",
      coverTag: 'Sujet Officiel'
    };
  }
  
  return {
    typeLabel: 'Épreuve Officielle',
    badgeLabel: 'SUJET OFFICIEL',
    subTitle: 'ÉPREUVE OFFICIELLE',
    coverTag: 'Sujet Officiel'
  };
};

/**
 * Convertit un identifiant technique de niveau (ex: 2bac_sm) en libellé officiel français
 */
export const formatLevelOrSchool = (school) => {
  if (!school) return '';
  const decoded = decodeHtmlEntities(school);
  const levelDisplay = getLevelDisplayName(decoded);
  if (levelDisplay && levelDisplay !== decoded) {
    return levelDisplay;
  }
  const validKeys = ['common_core_sci', 'common_core_arts', '1bac_sci', '1bac_arts', '2bac_sm', '2bac_pc_svt', '2bac_arts', 'tc', 'tcs', 'tca'];
  if (validKeys.includes(String(decoded).toLowerCase().trim())) {
    return getLevelDisplayName(decoded);
  }
  return decoded;
};

/* ── PDF Template Settings configuration (book design expert options) ── */
const getPdfSettings = (settings = {}) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      avoidPageBreaks: settings.avoidPageBreaks !== undefined ? settings.avoidPageBreaks : true,
      forcePrintColors: settings.forcePrintColors !== undefined ? settings.forcePrintColors : true,
      fontSize: settings.fontSize || '11pt',
      fontFamily: settings.fontFamily || 'Computer Modern Serif',
      pageMargins: settings.pageMargins || 'standard',
      templateStyle: settings.templateStyle || 'classic_latex',
      showSidebar: settings.showSidebar !== undefined ? settings.showSidebar : true,
    };
  }

  return {
    avoidPageBreaks: settings.avoidPageBreaks !== undefined ? settings.avoidPageBreaks : (localStorage.getItem('pdf_avoid_page_breaks') !== 'false'),
    forcePrintColors: settings.forcePrintColors !== undefined ? settings.forcePrintColors : (localStorage.getItem('pdf_force_print_colors') !== 'false'),
    fontSize: settings.fontSize || (localStorage.getItem('pdf_font_size') || '11pt'),
    fontFamily: settings.fontFamily || (localStorage.getItem('pdf_font_family') || 'Computer Modern Serif'),
    pageMargins: settings.pageMargins || (localStorage.getItem('pdf_page_margins') || 'standard'),
    templateStyle: settings.templateStyle || (localStorage.getItem('pdf_template_style') || 'classic_latex'),
    showSidebar: settings.showSidebar !== undefined ? settings.showSidebar : (localStorage.getItem('pdf_show_sidebar') !== 'false'),
  };
};

const getFontImportLinks = () => {
  return `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=STIX+Two+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css">
  `.trim();
};

const getMarginStyle = (margin) => {
  if (margin === 'compact') return '1.0cm 0.8cm 0.2cm';
  if (margin === 'wide') return '1.5cm 1.8cm 0.4cm';
  return '1.5cm 1.3cm 0.3cm'; // standard
};

const getFontFamilyStyle = (font) => {
  if (font === 'Times New Roman') return "'Times New Roman', Times, serif";
  if (font === 'STIX Two Text') return "'STIX Two Text', serif";
  if (font === 'Inter') return "'Inter', sans-serif";
  return "'Computer Modern Serif', 'STIX Two Text', 'Times New Roman', serif";
};


const getTemplateStyles = (style, fontSize = null) => {
  if (style === 'anisse_classic') {
    return `
      /* === LYCÉE ANISSE / DEVOIR SURVEILLÉ MAROCAIN === */
      .anisse-header-frame {
        display: grid;
        grid-template-columns: 1.6fr 3.1fr 1.6fr 1.15fr;
        border: 1.5px solid #005086;
        border-radius: 4px;
        background: #ffffff;
        margin-bottom: 0.6rem;
        page-break-inside: avoid;
        font-family: 'Computer Modern Serif', 'STIX Two Text', 'Times New Roman', serif;
        box-shadow: 0 2px 8px rgba(0,80,134,0.06);
      }
      .anisse-col {
        padding: 0.45rem 0.65rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        border-right: 1.5px solid #005086;
      }
      .anisse-col:last-child {
        border-right: none;
      }
      .anisse-col.col-left {
        font-size: 0.84rem;
        color: #0f172a;
        line-height: 1.55;
      }
      .anisse-col.col-left strong {
        color: #005086;
        font-weight: 700;
      }
      .anisse-col.col-center {
        text-align: center;
        align-items: center;
      }
      .anisse-col.col-center .main-title {
        font-size: 1.25rem;
        font-weight: 800;
        color: #005086;
        font-family: 'STIX Two Text', 'Computer Modern Serif', serif;
        line-height: 1.2;
      }
      .anisse-col.col-center .sub-title {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: #475569;
        text-transform: uppercase;
        margin-top: 0.2rem;
      }
      .anisse-col.col-right {
        font-size: 0.84rem;
        text-align: center;
        align-items: center;
      }
      .anisse-col.col-right strong {
        color: #005086;
        font-weight: 700;
      }
      .anisse-col.col-qr {
        padding: 0.35rem 0.45rem;
        align-items: center;
        justify-content: center;
        background: #005086;
        color: #ffffff;
      }
      .anisse-col.col-qr img,
      .anisse-col.col-qr .qr-img {
        width: 52px;
        height: 52px;
        border-radius: 4px;
        background: #ffffff;
        padding: 3px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
        display: block;
      }
      .anisse-col.col-qr .qr-label {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 0.65rem;
        font-weight: 900;
        letter-spacing: 0.12em;
        margin-top: 0.25rem;
        text-transform: uppercase;
        color: #ffffff;
        line-height: 1.1;
        text-align: center;
      }
      .anisse-sub-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.8rem;
        padding-bottom: 0.45rem;
        border-bottom: 2px solid #005086;
        page-break-inside: avoid;
      }
      .anisse-sub-bar .badge-num {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #005086;
        color: #ffffff;
        font-weight: 800;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .anisse-sub-bar .pill-instructions {
        border: 1.5px solid #005086;
        border-radius: 20px;
        padding: 0.2rem 1.1rem;
        font-size: 0.88rem;
        font-style: italic;
        font-weight: 600;
        color: #005086;
        background: #ffffff;
      }

      .anisse-ex-card {
        border: 1.5px solid #005086;
        border-radius: 4px;
        margin-bottom: 0.65rem;
        background: #ffffff;
        overflow: visible;
        page-break-inside: auto;
        break-inside: auto;
      }
      .anisse-ex-card-header {
        display: flex;
        background: #005086;
        color: #ffffff;
        font-weight: 800;
        font-size: 0.95rem;
        page-break-after: avoid;
        break-after: avoid;
      }
      .anisse-ex-card-header .pts-col-header {
        width: 80px;
        min-width: 80px;
        padding: 0.45rem 0.65rem;
        border-right: 1.5px solid #ffffff;
        text-align: center;
        font-size: 0.88rem;
      }
      .anisse-ex-card-header .title-col-header {
        flex: 1;
        padding: 0.45rem 0.85rem;
        letter-spacing: 0.02em;
      }
      .anisse-ex-row {
        display: flex;
        border-top: 1px solid #cbd5e1;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .anisse-ex-row:first-child {
        border-top: none;
      }
      .anisse-ex-row .pts-col {
        width: 80px;
        min-width: 80px;
        padding: 0.65rem 0.4rem;
        border-right: 1px solid #cbd5e1;
        font-size: 0.8rem;
        color: #64748b;
        font-weight: 600;
        text-align: center;
        background: #f8fafc;
      }
      .anisse-ex-row .content-col {
        flex: 1;
        padding: 0.65rem 0.85rem;
        font-size: 0.92rem;
        line-height: 1.6;
        color: #0f172a;
      }

      @media print {
        .anisse-ex-card {
          display: table !important;
          width: 100% !important;
          border-collapse: collapse !important;
          border: 1.5px solid #005086 !important;
          overflow: visible !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
        }
        .anisse-ex-card-header {
          display: table-row !important;
          background: #005086 !important;
          color: #ffffff !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .anisse-ex-row {
          display: table-row !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .anisse-ex-card-header .pts-col-header, .anisse-ex-row .pts-col {
          display: table-cell !important;
          width: 80px !important;
          min-width: 80px !important;
          max-width: 80px !important;
          vertical-align: middle !important;
        }
        .anisse-ex-card-header .title-col-header, .anisse-ex-row .content-col {
          display: table-cell !important;
          vertical-align: top !important;
          padding: 0.55rem 0.85rem !important;
        }
      }
    `;
  }
  if (style === 'modern_minimalist') {
    return `
      /* === MODERN MINIMALIST OVERRIDES === */
      .cover { padding: 1.5cm; }
      .cover-frame { border: none; border-left: 5px solid #2563eb; padding: 2cm 0 2cm 2cm; align-items: flex-start; text-align: left; }
      .cover-logo { font-family: 'Inter', sans-serif; letter-spacing: 2px; color: #2563eb; font-size: 1.8rem; }
      .cover-divider { margin: 0 0 2rem 0; width: 60px; background: #2563eb; }
      .cover-topic { font-family: 'Inter', sans-serif; font-size: 2.2rem; line-height: 1.2; text-align: left; }
      .cover-desc { font-family: 'Inter', sans-serif; font-size: 0.95rem; text-align: left; }
      .cover-stats { justify-content: flex-start; gap: 1.5rem; }
      .cover-stat { border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
      .cover-stat .num { font-family: 'Inter', sans-serif; color: #2563eb; }
      .cover-prof { font-family: 'Inter', sans-serif; font-style: normal; color: #64748b; }
      
      .subj-section { border-left: 4px solid #2563eb; padding-left: 10px; margin-bottom: 25px; }
      .section-hdr { background: none; color: #2563eb; padding: 0; font-size: 1.2rem; border-bottom: 2px solid #e2e8f0; border-radius: 0; }
      .qcard { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; background: #f8fafc; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.01); }
      .qnum { background: #2563eb; color: #fff; border-radius: 6px; padding: 3px 8px; }
      .opt { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; transition: none; }
      .opt-badge { background: #2563eb; color: #fff; border: none; }
    `;
  }
  if (style === 'premium_royal') {
    return `
      /* === PREMIUM ROYAL OVERRIDES === */
      .cover { padding: 1.2cm; background: #fdfdfd; }
      .cover-frame { border: 2px solid #7c3aed; padding: 1.5cm; background: #FAF5FF; }
      .cover-logo { font-family: 'STIX Two Text', serif; letter-spacing: 4px; color: #7c3aed; }
      .cover-divider { background: #7c3aed; height: 2px; }
      .cover-topic { font-family: 'STIX Two Text', serif; color: #1e1b4b; }
      .cover-desc { font-family: 'STIX Two Text', serif; color: #4338ca; }
      .cover-stats { gap: 2rem; }
      .cover-stat { border-color: #c084fc; background: #fff; box-shadow: 0 4px 10px rgba(124,58,237,0.08); }
      .cover-stat .num { font-family: 'STIX Two Text', serif; color: #7c3aed; }
      .cover-prof { font-family: 'STIX Two Text', serif; color: #7c3aed; }
      
      .subj-section { margin-bottom: 30px; }
      .section-hdr { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; font-family: 'STIX Two Text', serif; letter-spacing: 1px; }
      .qcard { border: 1.5px solid #e9d5ff; border-radius: 16px; padding: 24px; background: #ffffff; box-shadow: 0 4px 12px rgba(124,58,237,0.04); margin-bottom: 24px; }
      .qnum { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; border-radius: 8px; }
      .opt { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; }
      .opt-badge { background: #7c3aed; color: #fff; border: none; }
      .correct-opt { background: #ecfdf5 !important; border-color: #10b981 !important; color: #065f46 !important; }
      .correct-badge { background: #10b981 !important; }
      .rule-box { border-left: 4px solid #10b981; background: #f0fdf4; border-radius: 8px; padding: 15px; margin-top: 15px; }
      .trick-box { border-left: 4px solid #f59e0b; background: #fffbeb; border-radius: 8px; padding: 15px; margin-top: 10px; }
    `;
  }
  if (style === 'compact_eco') {
    return `
      /* === COMPACT ECO OVERRIDES === */
      @page { 
        margin: 0.45cm 0.55cm 0.35cm 0.55cm; 
        @bottom-left { content: none; }
        @bottom-right { content: none; }
      }
      body { font-size: ${fontSize || '8.8pt'} !important; line-height: 1.28 !important; padding-bottom: 0 !important; }
      .cover { display: none !important; }
      .omr-page { display: none !important; }
      .ws-content { padding: 0 !important; margin: 0 !important; }
      .ws-doc-header { margin-bottom: 0.2rem !important; padding-bottom: 0.15rem !important; }
      .ws-doc-title { font-size: 1.05rem !important; }
      .ws-doc-meta { font-size: 0.72rem !important; }
      .ws-section { margin-bottom: 0 !important; padding: 0 !important; }
      .ws-exercise { margin-bottom: 0.12rem !important; }
      .ws-ex-body { padding: 0.12rem 0.45rem !important; line-height: 1.26 !important; }
      .ws-qtext { margin-bottom: 1.5px !important; line-height: 1.25 !important; font-size: 1.0em !important; }
      .ctx-box { margin-bottom: 2px !important; padding: 1.5px 5px !important; font-size: 0.95em !important; }
      .ws-opts { gap: 2.5px 6px !important; margin-top: 2px !important; }
      .ws-opt { padding: 2px 6px !important; border-radius: 4px !important; font-size: 1.0em !important; }
      .ws-opt-text { font-size: 1.0em !important; line-height: 1.25 !important; }
      .ws-opt .katex, .ws-qtext .katex { font-size: 1.0em !important; }
      .ws-opt-letter { width: 17px !important; height: 17px !important; font-size: 7.8pt !important; }
      .katex { font-size: 1.0em !important; }
      .katex-display { margin: 1px 0 !important; font-size: 1.0em !important; }
      .qcard { border: none; border-bottom: 1px dashed #cbd5e1; padding: 5px 0; margin-bottom: 6px; }
      .opts { gap: 4px 10px !important; }
      .opt { padding: 2px 5px; }
      .opt-badge { width: 17px; height: 17px; font-size: 7pt; }
      .subj-section { margin-bottom: 8px; }
      .section-hdr { font-size: 0.88rem; padding: 3px 6px; background: #64748b; }
      .rule-box, .trick-box { padding: 5px 8px; margin-top: 5px; font-size: 8.5pt; }
      
      /* Compact Header layout directly on page 1 */
      .compact-header-box {
        margin: 0.15cm 0 0.25cm 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 5px 8px;
        background: #f8fafc;
      }
      .ch-left .ch-school { font-size: 7.5pt; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
      .ch-left .ch-title { font-size: 1.1rem; font-weight: 900; color: #0f172a; margin-top: 2px; }
      .ch-right { display: flex; gap: 8px; font-size: 7.5pt; }
      .ch-pill { background: #e2e8f0; color: #334155; padding: 3px 8px; border-radius: 99px; font-weight: 600; white-space: nowrap; }
      .compact-divider { border: 0; border-top: 1.5px solid #475569; margin: 0 0 0.25cm 0; }
    `;
  }
  if (style === 'super_eco') {
    return `
      /* === SUPER ECO OVERRIDES === */
      @page { 
        margin: 0.35cm 0.45cm 0.3cm 0.45cm; 
        @bottom-left { content: none; }
        @bottom-right { content: none; }
      }
      body { font-size: ${fontSize || '8.4pt'} !important; line-height: 1.24 !important; padding-bottom: 0 !important; }
      .cover { display: none !important; }
      .omr-page { display: none !important; }
      .ws-content { padding: 0 !important; margin: 0 !important; }
      .ws-doc-header { margin-bottom: 0.15rem !important; padding-bottom: 0.12rem !important; }
      .ws-doc-title { font-size: 0.95rem !important; }
      .ws-doc-meta { font-size: 0.68rem !important; }
      .ws-section { margin-bottom: 0 !important; padding: 0 !important; }
      .ws-exercise { margin-bottom: 0.08rem !important; }
      .ws-ex-header { display: none !important; }
      .ws-ex-body { padding: 0.08rem 0.38rem !important; line-height: 1.2 !important; border-radius: 3px 5px 5px 3px !important; }
      .ws-qtext { margin-bottom: 1px !important; line-height: 1.25 !important; font-size: 1.0em !important; }
      .ctx-box { margin-bottom: 1.5px !important; padding: 1px 4px !important; font-size: 0.95em !important; }
      .ws-opts { gap: 2px 6px !important; margin-top: 1.5px !important; }
      .ws-opt { padding: 1.5px 5px !important; border-radius: 3px !important; font-size: 1.0em !important; }
      .ws-opt-text { font-size: 1.0em !important; line-height: 1.25 !important; }
      .ws-opt .katex, .ws-qtext .katex { font-size: 1.0em !important; }
      .ws-opt-letter { width: 16px !important; height: 16px !important; font-size: 7.5pt !important; }
      .katex { font-size: 1.0em !important; }
      .katex-display { margin: 1px 0 !important; font-size: 1.0em !important; }
      .qcard { border: none; border-bottom: 1px dashed #cbd5e1; padding: 4px 0; margin-bottom: 5px; }
      .opts { gap: 3px 8px !important; }
      .opt { padding: 1.5px 4px; }
      .opt-badge { width: 16px; height: 16px; font-size: 6.8pt; }
      .subj-section { margin-bottom: 6px; }
      .section-hdr { font-size: 0.84rem; padding: 2px 5px; background: #64748b; }
      .rule-box, .trick-box { padding: 4px 6px; margin-top: 4px; font-size: 8pt; }
      
      /* Hide elements requested by user */
      .ws-ex-pill { display: none !important; }
      .ws-ans-tag-subject { display: none !important; }
      
      /* Style for the inline question number box */
      .super-eco-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1.5px solid #005086;
        border-radius: 3px;
        width: 16px;
        height: 16px;
        font-weight: 800;
        font-size: 7.5pt;
        color: #005086;
        margin-right: 4px;
        vertical-align: middle;
        background: #ffffff;
      }
      html[dir="rtl"] .super-eco-num {
        margin-right: 0 !important;
        margin-left: 4px !important;
      }
    `;
  }
  return `
    /* === CLASSIC LaTeX DEFAULT === */
    .cover-frame { border: 4px double #0f172a; }
    .qcard { border-bottom: 1px solid #e2e8f0; padding: 15px 0; }
    .qnum { background: #0f172a; color: #fff; border-radius: 3px; }
  `;
};


// Helper to retroactively repair LaTeX formulas corrupted by JSON string escaping (e.g., \right becoming ight)
const repairCorruptedLatex = (text) => {
  if (!text) return text;
  return text
    // Replace " ight" or control-char + "ight" or lone "ight" (not preceded by letter/backslash) with "\right"
    .replace(/(?<![a-zA-Z\\])ight\b/g, '\\right')
    // Replace "right" (not preceded by backslash) with "\right"
    .replace(/(?<!\\)right\b/g, '\\right')
    // Replace "left" (not preceded by backslash) with "\left"
    .replace(/(?<!\\)left\b/g, '\\left')
    // Replace "frac{" (not preceded by letter/backslash) with "\frac{"
    .replace(/(?<![a-zA-Z\\])frac\{/g, '\\frac{')
    // Replace "dfrac{" (not preceded by letter/backslash) with "\dfrac{"
    .replace(/(?<![a-zA-Z\\])dfrac\{/g, '\\dfrac{')
    // Replace "rac{" (not preceded by letter/backslash) with "\frac{" (in case f was stripped as form feed)
    .replace(/(?<![a-zA-Z\\])rac\{/g, '\\frac{')
    .replace(/(?<![a-zA-Z\\])otin(?=[\\\{\sA-Z0-9\(\[]|$)/g, '\\notin ')
    .replace(/\\exists([a-zA-Z0-9])/g, (_, l) => `\\exists ${l}`)
    .replace(/\\exists!([a-zA-Z0-9])/g, (_, l) => `\\exists! ${l}`)
    .replace(/\\forall([a-zA-Z0-9])/g, (_, l) => `\\forall ${l}`)
    .replace(/\\in([A-Z])(?![a-zA-Z])/g, (_, l) => `\\in ${l}`)
    .replace(/\\notin([A-Z])(?![a-zA-Z])/g, (_, l) => `\\notin ${l}`);

  // Unwrap invalid \text{...} inside \boxed{} that wraps math
  text = text.replace(/\\boxed\{\\text\{((?:[^{}]|\{[^{}]*\})*\\(?:exists|forall|in|notin|subset|supset|implies|iff|land|lor|neg|ne|neq|le|leq|ge|geq|to|cdot|times|frac|dfrac|sqrt|int|sum|prod|lim|alpha|beta|gamma|delta|pi|theta|infty|mathbb|mathbf|mathcal)\b(?:[^{}]|\{[^{}]*\})*)\}\}/g, '\\boxed{$1}');

  // Wrap standalone bare \boxed{...} with $ if not already in math
  text = text.replace(/(?<![$a-zA-Z0-9_\\])(\\boxed\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})+)\})(?![$a-zA-Z0-9_\\])/g, '$$$1$$');

  return text;
};

const LATEX_COMMAND_RE = /\\(?:lim|frac|dfrac|left|right|cdot|sqrt|sum|int|prod|infty|to|ln|log|exp|sin|cos|tan|arcsin|arccos|arctan|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|mathbb|mathcal|mathbf|mathrm|text|vec|hat|bar|tilde|overline|underline|widehat|widetilde|dot|ddot|pm|mp|times|div|cap|cup|in|notin|subset|supset|leq|geq|le|ge|neq|approx|equiv|sim|forall|exists|partial|nabla|rightarrow|leftarrow|Rightarrow|Leftarrow|Leftrightarrow|iff|implies|quad|qquad|ell|Re|Im|max|min|sup|inf|det|dim|ker|rank|mod|circ|bullet|star|oplus|otimes|begin|end)\b/;

function autoWrapLatex(text) {
  if (!text) return '';
  if (text.includes('$')) return text;
  
  // Don't auto-wrap if it's a markdown bullet point or contains markdown bold/italic
  if (/^\s*[\*\-+]\s+/.test(text) || text.includes('**') || /(?<!\*)\*[^*]+\*/.test(text)) {
    return text;
  }

  // Check if string starts with an item label like "a.", "1.", "b)", "1)", "(a)", "**1.**", etc.
  const prefixMatch = text.match(/^(\s*(?:\*\*[a-zA-Z0-9]+[.)]\*\*|\([a-zA-Z0-9]+\)|[a-zA-Z0-9]+[.)])\s*)(.*)$/);
  let prefix = '';
  let candidate = text;
  if (prefixMatch) {
    prefix = prefixMatch[1];
    candidate = prefixMatch[2];
  }

  // Check if candidate looks like a normal language sentence
  if (candidate.includes(' ')) {
    // Strip mathematical punctuation: brackets, parens, commas, plus, minus, slashes, braces, backslashes
    const cleanWords = candidate.replace(/[{}\[\]\(\),;=+\-*\/\\]/g, ' ').split(/\s+/).filter(Boolean);
    const mathCommands = new Set(['sin', 'cos', 'tan', 'lim', 'log', 'ln', 'exp', 'max', 'min', 'det', 'dim', 'ker', 'mod', 'frac', 'sqrt', 'infty', 'to', 'pi', 'dx', 'dy', 'dt', 'df']);
    for (const word of cleanWords) {
      if (/^[a-zA-ZÀ-ÿ]{3,}$/.test(word) && !mathCommands.has(word.toLowerCase())) {
        return text; // It contains normal text words
      }
    }
  }

  const mathWords = /\b(?:sqrt|pi|theta|infty|sin|cos|tan|ln|log|exp|lim)\b/i;
  const hasDivision = /\b\d+\s*\/\s*\d+\b/.test(candidate) || 
                      /\b[a-zA-Z0-9_]\s*\/\s*[a-zA-Z0-9(]/.test(candidate) ||
                      /\)\s*\/\s*[\d(a-zA-Z]/.test(candidate) ||
                      /[\d(a-zA-Z]\s*\/\s*\(/.test(candidate);

  if (/[\\^_{}]/.test(candidate) || 
      LATEX_COMMAND_RE.test(candidate) || 
      mathWords.test(candidate) || 
      candidate.includes('*') || 
      hasDivision ||
      /^[\[\]].*[\[\]]$/.test(candidate.trim())) {
    if (prefix) {
      return `${prefix}$${candidate}$`;
    }
    return `$${text}$`;
  }
  return text;
}

/* ── Math renderer: LaTeX → HTML string ── */
// Tokenizer for $...$ and $$...$$ matching mathRenderer.jsx
function tokenizeMath(text) {
  const tokens = [];
  let i = 0;
  let buf = '';

  while (i < text.length) {
    // ── Block math $$…$$
    if (text[i] === '$' && text[i + 1] === '$') {
      if (buf) { tokens.push({ type: 'text', content: buf }); buf = ''; }
      const start = i + 2;
      const end = text.indexOf('$$', start);
      if (end === -1) {
        buf += text.slice(i);
        i = text.length;
      } else {
        tokens.push({ type: 'block', content: text.slice(start, end) });
        i = end + 2;
      }
      continue;
    }

    // ── Escaped dollar \$ → literal $
    if (text[i] === '\\' && text[i + 1] === '$') {
      buf += '$';
      i += 2;
      continue;
    }

    // ── Inline math $…$
    if (text[i] === '$') {
      let j = i + 1;
      let found = false;
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '$') { found = true; break; }
        j++;
      }
      if (!found || j === i + 1) {
        buf += '$';
        i++;
      } else {
        if (buf) { tokens.push({ type: 'text', content: buf }); buf = ''; }
        tokens.push({ type: 'inline', content: text.slice(i + 1, j) });
        i = j + 1;
      }
      continue;
    }

    buf += text[i];
    i++;
  }
  if (buf) tokens.push({ type: 'text', content: buf });
  return tokens;
}

const KATEX_OPTIONS = {
  strict: 'ignore',
  throwOnError: false,
  trust: false,
};

const esc = (s) => {
  if (typeof s !== 'string') return String(s ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const repairMathExpression = (latex) => {
  if (!latex) return '';
  
  let repaired = latex;
  
  // 1. Repair missing backslashes for Greek letters and standard functions
  repaired = repaired
    .replace(/(?<![a-zA-Z\\])pi\b/g, '\\pi')
    .replace(/(?<![a-zA-Z\\])theta\b/g, '\\theta')
    .replace(/(?<![a-zA-Z\\])infty\b/g, '\\infty')
    .replace(/(?<![a-zA-Z\\])sin\b/g, '\\sin')
    .replace(/(?<![a-zA-Z\\])cos\b/g, '\\cos')
    .replace(/(?<![a-zA-Z\\])tan\b/g, '\\tan')
    .replace(/(?<![a-zA-Z\\])ln\b/g, '\\ln')
    .replace(/(?<![a-zA-Z\\])log\b/g, '\\log')
    .replace(/(?<![a-zA-Z\\])exp\b/g, '\\exp')
    .replace(/(?<![a-zA-Z\\])lim\b/g, '\\lim');

  // 2. Convert sqrt(xxx) to \sqrt{xxx}
  repaired = repaired.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
  
  // Convert parenthesized powers ^(xxx) to ^{xxx}
  repaired = repaired.replace(/\^\(([^)]+)\)/g, '^{$1}');
  
  // 3. Convert multiplication asterisk * to \cdot ONLY when used as binary multiplication
  // Never convert superscript asterisks (e.g. \mathbb{R}^*, \mathbb{N}^*, x^*, ^{*})
  repaired = repaired.replace(/(\\mathbb\{[A-Z]\})\*/g, '$1^*');
  repaired = repaired.replace(/(?<!\^|\^\{)\*/g, '\\cdot');
  
  // 4. Convert division slashes to textbook fractions (\frac)
  // Case A: number/var / (expr) -> \frac{number/var}{expr}
  repaired = repaired.replace(/(?<![a-zA-Z0-9\\_])([a-zA-Z0-9\\_]+)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
  
  // Case B: (expr) / (expr) -> \frac{expr}{expr}
  repaired = repaired.replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
  
  // Case C: (expr) / number/var -> \frac{expr}{number/var}
  repaired = repaired.replace(/\(([^)]+)\)\s*\/\s*([a-zA-Z0-9\\_]+)(?![a-zA-Z0-9\\_])/g, '\\frac{$1}{$2}');
  
  // Case D: number/var / number/var -> \frac{number/var}{number/var}
  repaired = repaired.replace(/(?<![a-zA-Z0-9\\_])([a-zA-Z0-9\\_]+)\s*\/\s*([a-zA-Z0-9\\_]+)(?![a-zA-Z0-9\\_])/g, '\\frac{$1}{$2}');

  // 5. Repair common LaTeX symbols corrupted in JSON/extraction
  repaired = repaired
    .replace(/(?:ext\s*)?extgreater\s*=/gi, '\\geq')
    .replace(/(?:text\s*)?textgreater\s*=/gi, '\\geq')
    .replace(/(?:ext\s*)?extgreater/gi, '\\gt')
    .replace(/(?:text\s*)?textgreater/gi, '\\gt')
    .replace(/(?:ext\s*)?extless\s*=/gi, '\\leq')
    .replace(/(?:text\s*)?textless\s*=/gi, '\\leq')
    .replace(/(?:ext\s*)?extless/gi, '\\lt')
    .replace(/(?:text\s*)?textless/gi, '\\lt');

  // 6. Repair common sequence subscripts (e.g. un -> u_n, n0 -> n_0)
  repaired = repaired
    .replace(/\b([uvw])n\+1\b/g, '$1_{n+1}')
    .replace(/\b([uvw])n\-1\b/g, '$1_{n-1}')
    .replace(/\b([uvw])n\b/g, '$1_n')
    .replace(/\b([uvwn])0\b/g, '$1_0')
    .replace(/\b([uvw])p\b/g, '$1_p')
    .replace(/(?<![a-zA-Z\\])otin(?=[\\\{\sA-Z0-9\(\[]|$)/g, '\\notin ')
    .replace(/\\exists([a-zA-Z0-9])/g, (_, l) => `\\exists ${l}`)
    .replace(/\\exists!([a-zA-Z0-9])/g, (_, l) => `\\exists! ${l}`)
    .replace(/\\forall([a-zA-Z0-9])/g, (_, l) => `\\forall ${l}`)
    .replace(/\\in([A-Z])(?![a-zA-Z])/g, (_, l) => `\\in ${l}`)
    .replace(/\\notin([A-Z])(?![a-zA-Z])/g, (_, l) => `\\notin ${l}`);

  // Unwrap invalid \text{...} inside math if it wraps LaTeX commands
  repaired = repaired.replace(/\\text\{((?:[^{}]|\{[^{}]*\})*\\(?:exists|forall|in|notin|subset|supset|implies|iff|land|lor|neg|ne|neq|le|leq|ge|geq|to|cdot|times|frac|dfrac|sqrt|int|sum|prod|lim|alpha|beta|gamma|delta|pi|theta|infty|mathbb|mathbf|mathcal)\b(?:[^{}]|\{[^{}]*\})*)\}/g, '$1');

  return repaired;
};

const renderInlineKatex = (latex) => {
  try {
    const repaired = repairMathExpression(latex);
    return katex.renderToString(repaired, { ...KATEX_OPTIONS, displayMode: false });
  } catch {
    return `<span style="font-style:italic;opacity:0.75">${esc(latex)}</span>`;
  }
};

const renderBlockKatex = (latex) => {
  try {
    const repaired = repairMathExpression(latex);
    return katex.renderToString(repaired, { ...KATEX_OPTIONS, displayMode: true });
  } catch {
    return `<span style="font-style:italic;opacity:0.75;display:block">${esc(latex)}</span>`;
  }
};

const renderTextWithBold = (text) => {
  let html = esc(text);
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
  return html;
};

const renderLineContent = (text) => {
  const toParse = autoWrapLatex(text);
  const tokens = tokenizeMath(toParse);
  const html = tokens.map((tok) => {
    if (tok.type === 'block')  return renderBlockKatex(tok.content);
    if (tok.type === 'inline') return renderInlineKatex(tok.content);
    return esc(tok.content);
  }).join('');
  return html
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
};

const renderLine = (line) => {
  const cleaned = line
    .replace(/\t/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
  if (!cleaned) return '';

  // Markdown Headings: ###### ##### #### ### ## #
  if (/^######\s+/.test(cleaned)) {
    const text = cleaned.replace(/^######\s+/, '');
    return `<div style="font-weight: 800; font-size: 0.85rem; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin: 0.5rem 0 0.25rem;">${renderLineContent(text)}</div>`;
  }
  if (/^#####\s+/.test(cleaned)) {
    const text = cleaned.replace(/^#####\s+/, '');
    return `<div style="font-weight: 800; font-size: 0.88rem; color: #005086; margin: 0.6rem 0 0.3rem;">${renderLineContent(text)}</div>`;
  }
  if (/^####\s+/.test(cleaned)) {
    const text = cleaned.replace(/^####\s+/, '');
    return `<div style="font-weight: 800; font-size: 0.92rem; color: #005086; border-bottom: 1px dashed rgba(0,80,134,0.15); padding-bottom: 0.2rem; margin: 0.75rem 0 0.35rem;">${renderLineContent(text)}</div>`;
  }
  if (/^###\s+/.test(cleaned)) {
    const text = cleaned.replace(/^###\s+/, '');
    return `<div style="font-weight: 800; font-size: 0.98rem; color: #005086; border-bottom: 1px solid rgba(0,80,134,0.15); padding-bottom: 0.25rem; margin: 0.85rem 0 0.4rem;">${renderLineContent(text)}</div>`;
  }
  if (/^##\s+/.test(cleaned)) {
    const text = cleaned.replace(/^##\s+/, '');
    return `<div style="font-weight: 900; font-size: 1.08rem; color: #005086; border-bottom: 1.5px solid rgba(0,80,134,0.2); padding-bottom: 0.3rem; margin: 1rem 0 0.5rem;">${renderLineContent(text)}</div>`;
  }
  if (/^#\s+/.test(cleaned)) {
    const text = cleaned.replace(/^#\s+/, '');
    return `<div style="font-weight: 900; font-size: 1.25rem; color: #005086; border-bottom: 2px solid rgba(0,80,134,0.3); padding-bottom: 0.4rem; margin: 1.1rem 0 0.6rem;">${renderLineContent(text)}</div>`;
  }

  // Horizontal Rule / Separator: ---, ***, ___
  if (/^(?:---|\*\*\*|___)\s*$/.test(cleaned)) {
    return `<hr style="border: none; border-top: 1px solid #cbd5e1; margin: 0.85rem 0;" />`;
  }

  // Response Block (Réponse :)
  if (cleaned.toLowerCase().startsWith('**réponse') || cleaned.toLowerCase().startsWith('réponse') ||
      cleaned.toLowerCase().startsWith('**reponse') || cleaned.toLowerCase().startsWith('reponse')) {
    const contentText = cleaned.replace(/^(\*\*)?r[eé]ponse\s*:?\s*/i, '').replace(/\*\*$/, '');
    return `<span style="display: block; line-height: 1.75;"><strong>Réponse :</strong> ${renderLineContent(contentText)}</span>`;
  }

  // Attention/Warning Block (Attention :)
  if (cleaned.toLowerCase().startsWith('**attention') || cleaned.toLowerCase().startsWith('attention')) {
    const contentText = cleaned.replace(/^(\*\*)?attention\s*:?\s*/i, '').replace(/\*\*$/, '');
    return `<span style="display: block; line-height: 1.75;"><strong>Attention :</strong> ${renderLineContent(contentText)}</span>`;
  }

  // Step Block (Étape N / Step N / الخطوة N)
  const stepRegex = /^(\*\*)?(Étape|Step|الخطوة)\s*(\d+)\s*(?:—|-|:)?\s*(.*)$/i;
  const stepMatch = cleaned.match(stepRegex);
  if (stepMatch) {
    const stepLabel = stepMatch[2];
    const stepNum = stepMatch[3];
    const stepText = stepMatch[4].replace(/\*\*$/, '');
    const formattedLabel = stepLabel.toLowerCase().includes('خطوة') ? `الخطوة ${stepNum}` : `${stepLabel} ${stepNum}`;
    return `<span style="display: block; line-height: 1.75; margin-top: 0.5rem;"><strong>${formattedLabel} :</strong> ${stepText ? renderLineContent(stepText) : ''}</span>`;
  }

  const content = renderLineContent(cleaned);
  return `<span style="display: block; line-height: 1.75;">${content}</span>`;
};

const extractTablesAndText = (text) => {
  if (!text) return [];
  const lines = text.split('\n');
  const segments = [];
  let currentTextLines = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Check if it's the start of a table
    if (line.startsWith('|') && line.endsWith('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (nextLine.startsWith('|') && nextLine.endsWith('|') && /^[|\-:\s]+$/.test(nextLine)) {
        // First push any accumulated text segment
        if (currentTextLines.length > 0) {
          segments.push({ type: 'text', content: currentTextLines.join('\n') });
          currentTextLines = [];
        }
        
        // Accumulate all consecutive table rows
        const headerRow = line;
        const separatorRow = nextLine;
        const dataRows = [];
        i += 2;
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          dataRows.push(lines[i].trim());
          i++;
        }
        
        segments.push({
          type: 'table',
          headerRow,
          separatorRow,
          dataRows
        });
        continue;
      }
    }
    
    currentTextLines.push(lines[i]);
    i++;
  }
  
  if (currentTextLines.length > 0) {
    segments.push({ type: 'text', content: currentTextLines.join('\n') });
  }
  
  return segments;
};

const renderTableSegmentHTML = (segment) => {
  const parseRowCells = (rowText) => {
    const cells = rowText.split('|').map(c => c.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    return cells;
  };
  
  const headerCells = parseRowCells(segment.headerRow);
  const sepCells = parseRowCells(segment.separatorRow);
  
  const alignments = sepCells.map(cell => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
  
  const headerHtml = `
    <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
      ${headerCells.map((cell, idx) => `
        <th style="padding: 14px 22px; border: 1px solid #cbd5e1; font-weight: 800; color: #005086; text-align: ${alignments[idx] || 'center'};">
          ${renderLineContent(cell)}
        </th>
      `).join('')}
    </tr>`;
    
  const rowsHtml = segment.dataRows.map((row, rIdx) => {
    const cells = parseRowCells(row);
    const isAlt = rIdx % 2 === 1 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;';
    return `
      <tr style="${isAlt}">
        ${cells.map((cell, idx) => `
          <td style="padding: 14px 22px; border: 1px solid #cbd5e1; text-align: ${alignments[idx] || 'center'}; color: #334155;">
            ${renderLineContent(cell)}
          </td>
        `).join('')}
      </tr>`;
  }).join('');
  
  return `
    <div style="display: flex; justify-content: center; margin: 2rem 0; width: 100%;">
      <table style="border-collapse: collapse; min-width: 70%; max-width: 100%; border: 1px solid #cbd5e1; font-size: 1.15rem; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04); border-radius: 12px; overflow: hidden; background: #ffffff;">
        <thead>
          ${headerHtml}
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>`;
};

const renderMath = (text) => {
  if (text === null || text === undefined) return '';
  const repaired = repairCorruptedLatex(String(text));
  const raw = repaired;
  if (!raw.trim()) return '';

  const segments = extractTablesAndText(raw);
  
  if (segments.length === 1 && segments[0].type === 'text') {
    return renderMathInternal(segments[0].content);
  }
  
  return segments.map(seg => {
    if (seg.type === 'table') {
      return renderTableSegmentHTML(seg);
    }
    return renderMathInternal(seg.content);
  }).join('');
};

const renderMathInternal = (text) => {
  if (text === null || text === undefined) return '';
  const raw = text;
  if (!raw.trim()) return '';

  // ── Image shorthand ──
  if (raw.trim().startsWith('img:')) {
    const url = raw.trim().slice(4).trim();
    return `<div style="text-align: center; margin: 1rem 0;"><img src="${url}" alt="Question illustration" style="max-width: 100%; max-height: 240px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); object-fit: contain;" /></div>`;
  }

  // ── SVG shorthand (for physics/chemistry curves, graphs, and schemas) ──
  if (raw.trim().startsWith('svg:')) {
    const svgCode = raw.trim().slice(4).trim();
    return `<div style="display: flex; justify-content: center; align-items: center; margin: 1rem 0; width: 100%; overflow-x: auto; padding: 1rem;">${svgCode}</div>`;
  }

  // ── Normalise line endings ──
  const normalisedTemp = raw
    .replace(/\r\n/g, '\n')                // Windows CRLF → LF
    .replace(/\r/g, '\n');                 // lone CR → LF
  
  const normalised = normalisedTemp.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g)
    .map((part, idx) => {
      if (idx % 2 === 1) return part;
      let cleanedPart = part.replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)/gi, '\n');
      
      // Force line break after period followed by space and uppercase letter/backslash/math delimiter
      // NOTE: exclude when preceded by a digit (numbered list item like "1. Calculer") or single letter (like "A. Calculer")
      cleanedPart = cleanedPart.replace(/(?<!\d|^|\n|\b\d\.[a-zA-Z]|\bex|\betc|\bvs|\b[a-zA-Z])\.\s+([A-ZÀ-ÖØ-ß]|\\|\$)/g, '.\n$1');

      // Force line break before "Étape" / "Step" / "الخطوة" outside math blocks (case-insensitive)
      if (idx > 0) {
        cleanedPart = cleanedPart.replace(/^\s*(\*\*)?(étape|etape|step|الخطوة)\b/gi, '\n$1$2');
      }
      cleanedPart = cleanedPart.replace(/(?<=[.!?$;:\-)\]}»*])\s+(\*\*)?(étape|etape|step|الخطوة)\b/gi, '\n$1$2');

      // Force line break before Response / Attention blocks (case-insensitive)
      if (idx > 0) {
        cleanedPart = cleanedPart.replace(/^\s*(\*\*)?(réponse|reponse|attention)\b/gi, '\n$1$2');
      }
      cleanedPart = cleanedPart.replace(/(?<=[.!?$;:\-)\]}»*])\s+(\*\*)?(réponse|reponse|attention)\b/gi, '\n$1$2');
      
      return cleanedPart;
    })
    .join('');

  const hasNewlines = normalised.includes('\n');

  // ── Single-line fast path (questions, options, short text) ──
  if (!hasNewlines) {
    const cleaned = normalised
      .replace(/\r\n/g, ' ')
      .replace(/[\r\n]/g, ' ')
      .replace(/\t/g, ' ')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/ {2,}/g, ' ')
      .trim();
    if (!cleaned) return '';
    const toParse = autoWrapLatex(cleaned);
    const tokens = tokenizeMath(toParse);
    if (tokens.length === 1 && tokens[0].type === 'text') {
      return `<span>${renderTextWithBold(tokens[0].content)}</span>`;
    }
    return tokens.map((tok) => {
      if (tok.type === 'block')  return renderBlockKatex(tok.content);
      if (tok.type === 'inline') return renderInlineKatex(tok.content);
      return `<span>${renderTextWithBold(tok.content)}</span>`;
    }).join('');
  }

  // ── Multi-line path: render each line, group by paragraphs ──
  // Split into paragraphs (double newline), then lines within each paragraph
  const paragraphs = normalised.split(/\n{2,}/);

  if (paragraphs.length === 1) {
    // Single paragraph with line breaks
    const lines = normalised.split('\n');
    return `<span style="display: block;">${lines.map(line => renderLine(line)).join('')}</span>`;
  }

  return paragraphs.map(para => {
    const lines = para.split('\n');
    return `<p style="margin: 0.35em 0; line-height: 1.75;">${lines.map(line => renderLine(line)).join('')}</p>`;
  }).join('');
};



const renderQuestionImageHTML = (q, placement) => {
  if (!q.image) return '';
  const pos = q.imagePosition || 'below_statement';
  if (placement === 'side' && pos !== 'side_by_side') return '';
  if (placement === 'above' && pos !== 'above_statement') return '';
  if (placement === 'below' && pos !== 'below_statement' && pos !== 'top' && pos !== 'bottom') return '';
  if (placement === 'context' && pos !== 'in_context') return '';
  if (placement === 'options' && pos !== 'below_options') return '';
  if (placement === 'correction' && pos !== 'in_correction') return '';

  const sizeH = {
    small: '90px',
    medium: '110px',
    large: '180px',
    xlarge: '260px'
  }[q.imageSize || 'medium'];

  let bgCSS = '';
  if (q.imageBg === 'white') {
    bgCSS = 'background-color: #ffffff; padding: 6px; border-radius: 8px; border: 1px solid #cbd5e1; box-sizing: border-box;';
  } else if (q.imageBg === 'dark') {
    bgCSS = 'background-color: #0f172a; padding: 6px; border-radius: 8px; border: 1px solid #334155; box-sizing: border-box;';
  }

  const isSvg = q.image.startsWith('svg:');
  const innerContent = isSvg
    ? q.image.slice(4).trim()
    : `<img src="${q.image}" style="max-height: ${sizeH}; max-width: 100%; display: inline-block; object-fit: contain;" />`;

  if (pos === 'side_by_side') {
    return `<div style="float: right; margin-left: 15px; margin-bottom: 10px; max-width: 35%; display: block; text-align: center; ${bgCSS}">${innerContent}</div>`;
  }
  return `<div style="margin: 8px 0 10px 0; display: block; text-align: center; clear: both; ${bgCSS}">${innerContent}</div>`;
};

/* ── Normalize option text ── */
const optText = (opt) => {
  const raw = typeof opt === 'string' ? opt : (opt?.text || '');
  let cleaned = raw.replace(/^[A-E][).]\s*/i, '').trim();
  // Automatically promote \frac to \dfrac in options so fractions render full-size, not shrunken scriptstyle
  cleaned = cleaned.replace(/\\frac\b/g, '\\dfrac');
  return cleaned;
};



const getThemeClass = (subj) => {
  const norm = (subj || '').toLowerCase().trim();
  if (norm.includes('math') || norm.includes('analyse') || norm.includes('alg') || norm.includes('géo')) return 'theme-math';
  if (norm.includes('phys')) return 'theme-physique';
  if (norm.includes('chim')) return 'theme-chimie';
  if (norm.includes('svt') || norm.includes('bio') || norm.includes('géol')) return 'theme-svt';
  if (norm.includes('fran') || norm.includes('lang') || norm.includes('ang') || norm.includes('arab')) return 'theme-francais';
  return 'theme-general';
};

const getOptionsLayoutClass = (options) => {
  if (!options || options.length === 0) return 'ws-opts-1col';
  let maxLength = 0;
  options.forEach(opt => {
    const raw = typeof opt === 'string' ? opt : (opt?.text || '');
    const clean = raw.replace(/^[A-E][).\s]*/i, '');
    if (clean.length > maxLength) {
      maxLength = clean.length;
    }
  });

  if (maxLength < 15) {
    return options.length === 5 ? 'ws-opts-5col' : 'ws-opts-4col';
  } else if (maxLength < 40) {
    return 'ws-opts-2col';
  } else {
    return 'ws-opts-1col';
  }
};

/* ═══════════════════════════════════════════════
   1. SUJET BLANC — Exam Paper
   ═══════════════════════════════════════════════ */
export const generateSubjectHTML = async (examTitle, school, year, questions, settings = {}) => {
  const cleanTitle = formatExamTitle(examTitle);
  const formattedSchool = formatLevelOrSchool(school);
  const docInfo = getDocTypeInfo(cleanTitle, settings);

  const isArabic = hasArabic(cleanTitle) || questions.some(q => hasArabic(q.question) || hasArabic(q.context) || (q.options || []).some(o => hasArabic(typeof o === 'string' ? o : (o?.text || ''))));
  const pdfConf = getPdfSettings(settings);
  const marginCSS = getMarginStyle(pdfConf.pageMargins);
  const fontFamilyCSS = getFontFamilyStyle(pdfConf.fontFamily);
  const fontSizeCSS = pdfConf.fontSize;

  let profName = settings.profName || '';
  let profSchool = settings.profSchool || '';
  let profPhone = settings.profPhone || '';
  let profSite = settings.profSite || 'www.lconq.ma';
  const showCover = settings.showCover !== undefined ? settings.showCover : true;
  const showPageNumbers = settings.showPageNumbers !== undefined ? settings.showPageNumbers : true;
  const startPage = settings.startPage !== undefined ? settings.startPage : 1;
  const examId = settings.examId || 'PREVIEW';
  const variantBadge = settings.variantBadge || (settings.modelVariant ? (String(settings.modelVariant).toUpperCase().includes('MODÈLE') ? settings.modelVariant : `MODÈLE ${settings.modelVariant}`) : '');

  const templateStyle = pdfConf.templateStyle || 'classic_latex';
  const templateCSS = getTemplateStyles(templateStyle, fontSizeCSS);
  const shouldShowCover = (templateStyle === 'compact_eco' || templateStyle === 'super_eco') ? false : showCover;

  let schools = settings.schoolsList || ['ENSA', 'ENSAM', 'ENCG', 'Médecine / Pharmacie', 'INPT', 'INSEA'];
  if (school && !schools.some(s => s.toLowerCase() === school.toLowerCase())) {
    schools = [school, ...schools];
  }
  const sidebarTabsHtml = schools.map(sch => {
    const isActive = sch.toLowerCase() === school.toLowerCase();
    let displayName = formatLevelOrSchool(sch);
    if (sch === 'Médecine / Pharmacie') displayName = 'Médecine';
    if (displayName.includes('Général')) displayName = 'Prépa';
    if (displayName.length > 20) displayName = displayName.substring(0, 18) + '…';
    return `<div class="ws-vtab${isActive ? ' ws-vtab-active' : ''}">
      <span class="ws-vtab-dot"></span>
      ${displayName}
    </div>`;
  }).join('');

  if (typeof window !== 'undefined' && window.localStorage) {
    if (!profName) profName = localStorage.getItem('profName') || '';
    if (!profSchool) profSchool = localStorage.getItem('profSchool') || '';
    if (!profPhone) profPhone = localStorage.getItem('profPhone') || '';
    if (!profSite) profSite = localStorage.getItem('profSite') || 'www.lconq.ma';
  }

  const teacherDisplay = profName ? (profName.toLowerCase().startsWith('prof') ? profName : `Prof. ${profName}`) : 'Enseignant';
  const schoolDisplay = profSchool || 'Établissement Scolaire';

  const siteUrl = profSite;
  const copyrightLine = profName
    ? `© ${new Date().getFullYear()} L'CONQ × ${profName}. Tous droits réservés.`
    : `© ${new Date().getFullYear()} L'CONQ. Tous droits réservés.`;

  const premiumQrPayload = `LCQ:${examId.slice(0, 8)}`;
  let premiumQrUrl;
  try {
    premiumQrUrl = await QRCode.toDataURL(premiumQrPayload, {
      errorCorrectionLevel: 'H',
      width: 250,
      margin: 4,
      color: { dark: '#000000', light: '#FFFFFF' }
    });
  } catch (err) {
    console.error('Failed to generate local QR Code:', err);
    premiumQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(premiumQrPayload)}&ecc=H&margin=4`;
  }



  /* Premium OMR Sheet rows */
  const pCount = questions.length;
  const pHalf = Math.ceil(pCount / 2);
  const pOpts = ['A', 'B', 'C', 'D', 'E'];

  let premiumOmrHtml = '';
  
  premiumOmrHtml += '<div class="omr-column col-1">';
  premiumOmrHtml += `
    <div class="omr-col-header">
      <span class="lbl-num">N°</span>
      ${pOpts.map((o, i) => `<span class="lbl-opt" style="left: ${20 + i * 9 - 2.9}mm;">${o}</span>`).join('')}
    </div>
  `;
  for (let i = 0; i < pHalf; i++) {
    const isAlt = i % 2 === 0 ? ' alt' : '';
    const qNum = String(i + 1).padStart(2, '0');
    const bubblesHtml = pOpts.map((o, oi) => {
      const cx = 20 + oi * 9 - 2.9;
      return `<div class="omr-bubble" style="left: ${cx}mm;">${o}</div>`;
    }).join('');
    premiumOmrHtml += `
      <div class="omr-row${isAlt}">
        <span class="row-num">${qNum}</span>
        ${bubblesHtml}
      </div>
    `;
  }
  premiumOmrHtml += '</div>';
  premiumOmrHtml += '<div class="omr-column-divider"></div>';

  premiumOmrHtml += '<div class="omr-column col-2">';
  premiumOmrHtml += `
    <div class="omr-col-header">
      <span class="lbl-num">N°</span>
      ${pOpts.map((o, i) => `<span class="lbl-opt" style="left: ${20 + i * 9 - 2.9}mm;">${o}</span>`).join('')}
    </div>
  `;
  for (let i = pHalf; i < pCount; i++) {
    const isAlt = i % 2 === 0 ? ' alt' : '';
    const qNum = String(i + 1).padStart(2, '0');
    const bubblesHtml = pOpts.map((o, oi) => {
      const cx = 20 + oi * 9 - 2.9;
      return `<div class="omr-bubble" style="left: ${cx}mm;">${o}</div>`;
    }).join('');
    premiumOmrHtml += `
      <div class="omr-row${isAlt}">
        <span class="row-num">${qNum}</span>
        ${bubblesHtml}
      </div>
    `;
  }
  premiumOmrHtml += '</div>';

  const usedRows = Math.ceil(pCount / 2);
  const footerY = Math.max(96 + 7 + usedRows * 8.5 + 12, 258);
  const dateStr = new Date().toLocaleDateString('fr-MA');
  const examDuration = `${Math.ceil(questions.length * 1.5)} minutes`;

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  const coverHtml = shouldShowCover ? `
<div class="cover">
  <div class="cover-frame">
    <div class="cover-logo">L'CONQ</div>
    <div class="cover-subtitle">${docInfo.subTitle}</div>
    <div class="cover-divider"></div>
    
    <div class="cover-header-group">
      <div class="cover-tag">${docInfo.coverTag}${variantBadge ? ` · ${variantBadge}` : ''}</div>
      <div class="cover-topic">${cleanTitle}</div>
      <div class="cover-desc">${formattedSchool} &nbsp;·&nbsp; ${docInfo.typeLabel}${year ? ` &nbsp;·&nbsp; ${year}` : ''}</div>
    </div>
    
    <div class="cover-stats">
      <div class="cover-stat">
        <div class="num">${questions.length}</div>
        <div class="lbl">Questions</div>
      </div>
      <div class="cover-stat">
        <div class="num">2h00</div>
        <div class="lbl">Durée</div>
      </div>
      <div class="cover-stat">
        <div class="num">${year || '—'}</div>
        <div class="lbl">Année</div>
      </div>
    </div>
    
    <div class="cover-instructions">
      <h3>⚠️ INSTRUCTIONS AUX CANDIDATS :</h3>
      <ul>
        <li>Cette épreuve comporte <strong>${questions.length} questions</strong> à choix multiples.</li>
        <li>Chaque question comporte 5 options (A, B, C, D, E) ou 4 options (A, B, C, D) avec <strong>une seule réponse correcte</strong>.</li>
        <li>Remplissez la grille OMR située à la page suivante avec le plus grand soin.</li>
        <li>Aucune calculatrice n'est autorisée sauf mention contraire explicite.</li>
      </ul>
    </div>

    <div class="cover-prof">
      ${profName ? `Préparé par : <strong>${profName}</strong>${profPhone ? ' · ' + profPhone : ''}` : `<strong>${siteUrl}</strong>`}
    </div>
  </div>
</div>` : '';

  // Keep the order of questions exactly as they appear in the array (following CSV and editor order)
  const sortedQuestions = [...questions];

  /* Questions HTML */
  const questionsHtml = sortedQuestions.map((q, idx) => {
    const num = idx + 1;
    const subject = q.subject || q.topic || 'Général';
    const themeClass = getThemeClass(subject);
    const optionsHtml = (q.options || []).map((opt, oi) => {
      const letter = LETTERS[oi] || String(oi + 1);
      return `<div class="ws-opt">
        <span class="ws-opt-letter">${letter}</span>
        <span class="ws-opt-text">${renderMath(optText(opt))}</span>
      </div>`;
    }).join('');

    const qnumHtml = templateStyle === 'super_eco' ? `<span class="super-eco-num">${num}</span>` : '';

    return `
    <div class="ws-section ${themeClass}">
      <div class="ws-exercise">
        <div class="ws-ex-header">
          <div class="ws-ex-pill">
            <span class="ws-ex-pill-label">Question N°</span>
            <span class="ws-ex-num">${num}</span>
          </div>
          <span class="ws-ans-tag ws-ans-tag-subject">${subject.toUpperCase()}</span>
        </div>
        <div class="ws-ex-body">
          ${q.context ? `<div class="ctx-box">${qnumHtml}📋 ${renderMath(q.context)} ${renderQuestionImageHTML(q, 'context')}</div>` : ''}
          ${renderQuestionImageHTML(q, 'above')}
          <div class="ws-qtext">${renderQuestionImageHTML(q, 'side')}${q.context ? '' : qnumHtml}${renderMath(q.question || '')}</div>
          ${renderQuestionImageHTML(q, 'below')}
          <div class="ws-opts ${getOptionsLayoutClass(q.options)}">${optionsHtml}</div>
          ${renderQuestionImageHTML(q, 'options')}
        </div>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="${isArabic ? 'ar' : 'fr'}" dir="${isArabic ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8">
<title>${examTitle} — Sujet</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
${getFontImportLinks()}
<style>
@font-face {
  font-family: 'UKIJMerdaneRegular';
  src: url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}
html[dir="rtl"] body {
  font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'Noto Naskh Arabic', Arial, sans-serif !important;
  direction: rtl !important;
  text-align: right !important;
}
html[dir="rtl"] .cover-instructions {
  text-align: right !important;
}
html[dir="rtl"] .cover-instructions ul {
  padding-left: 0 !important;
  padding-right: 1.2rem !important;
}
html[dir="rtl"] .ws-ex-header {
  flex-direction: row-reverse !important;
}
html[dir="rtl"] .ws-ex-pill {
  flex-direction: row-reverse !important;
}
html[dir="rtl"] .ws-ex-num {
  margin-left: 0 !important;
  margin-right: 0.35rem !important;
}
html[dir="rtl"] .ws-opt {
  flex-direction: row !important;
}
html[dir="rtl"] .ws-opt-letter {
  margin-right: 0 !important;
  margin-left: 10px !important;
}
html[dir="rtl"] .katex, html[dir="rtl"] .katex-display {
  direction: ltr !important;
  unicode-bidi: isolate;
  display: inline-block;
}
*{box-decoration-break:clone;-webkit-box-decoration-break:clone;box-sizing:border-box;margin:0;padding:0}
body{
  font-family: ${fontFamilyCSS};
  color:#1e293b;background:#f8fafc;font-size:${fontSizeCSS};line-height:1.32;
  padding-bottom:0;
  print-color-adjust:exact;-webkit-print-color-adjust:exact;
  font-feature-settings:'liga' 1,'kern' 1;
}
@page{
  size:A4;
  margin: 0.45cm 0.55cm 0.35cm 0.55cm;
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
@page :first {
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
@page omr-page-layout {
  size: A4;
  margin: 0;
}
html{counter-reset:page ${startPage - 1}}

/* ── PRINT INSTRUCTION OVERLAY ── */
.print-hint{position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#0f172a,#1e293b);
  color:#fff;padding:0.9rem 1.5rem;display:flex;align-items:center;justify-content:space-between;
  font-size:9.5pt;gap:1rem;print-color-adjust:exact;font-family:'Plus Jakarta Sans',sans-serif;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15)}
.print-hint-msg{display:flex;align-items:center;gap:0.75rem}
.print-hint-icon{font-size:1.4rem;flex-shrink:0}
.print-hint-text strong{font-size:10pt;color:#38bdf8}
.print-hint-text span{color:rgba(255,255,255,0.7);font-size:8.5pt}
.hint-badge{background:#0284c7;color:#fff;font-size:8pt;font-weight:700;padding:4px 14px;border-radius:20px;
  white-space:nowrap;cursor:pointer;border:none;font-family:inherit;letter-spacing:.5px;transition: all 0.2s}
.hint-badge:hover{background:#0369a1}
@media print{.print-hint{display:none!important}}

/* ── COVER PAGE ── */
.cover{
  box-sizing:border-box;width:100%;height:27.5cm;padding:1.2cm;
  page-break-after:always;print-color-adjust:exact;-webkit-print-color-adjust:exact;
  background: radial-gradient(circle at 10% 20%, rgba(243, 246, 249, 1) 0%, rgba(255, 255, 255, 1) 90%);
  color:#0f172a;
}
.cover-frame{
  border:2px solid #e2e8f0;
  padding:2.5cm 2cm;
  height:100%;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  align-items:center;
  box-sizing:border-box;
  background:#ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.04);
}
.cover-logo{
  font-family: ${fontFamilyCSS};
  font-size:2.4rem;
  font-weight:900;
  letter-spacing:8px;
  text-transform:uppercase;
  margin-bottom:0.2rem;
  color:#005086;
}
.cover-subtitle{
  font-family:'Inter',sans-serif;
  font-size:0.85rem;
  font-weight:700;
  color:#64748b;
  letter-spacing:4px;
  text-transform:uppercase;
  margin-bottom:1.5rem;
}
.cover-divider{
  width:80px;
  height:4px;
  background:linear-gradient(90deg, #005086, #007cc6);
  border-radius:2px;
  margin:0 auto 2.5rem;
}
.cover-header-group{
  text-align:center;
  max-width: 90%;
}
.cover-tag{
  font-family:'Inter',sans-serif;
  font-size:0.8rem;
  font-weight:800;
  letter-spacing:3px;
  text-transform:uppercase;
  color:#ffffff;
  background: #005086;
  padding:6px 16px;
  border-radius:99px;
  display:inline-block;
  margin-bottom:1.2rem;
}
.cover-topic{
  font-family:${fontFamilyCSS};
  font-size:2.8rem;
  font-weight:800;
  line-height:1.2;
  margin:0.5rem 0 1.2rem;
  color:#0f172a;
  letter-spacing: -0.02em;
}
.cover-desc{
  font-family:${fontFamilyCSS};
  font-size:1.1rem;
  color:#475569;
  line-height: 1.6;
  margin-bottom:2rem;
}
.cover-stats{
  display:flex;
  gap:2rem;
  justify-content:center;
  margin:1.5rem 0;
  width:100%;
}
.cover-stat {
  border: 1px solid #e2e8f0;
  border-radius:12px;
  padding:16px 28px;
  min-width:130px;
  text-align:center;
  background:#f8fafc;
}
.cover-stat .num{
  font-family:${fontFamilyCSS};
  font-size:1.8rem;
  font-weight:800;
  color:#005086;
}
.cover-stat .lbl{
  font-family:'Inter',sans-serif;
  font-size:0.75rem;
  color:#64748b;
  text-transform:uppercase;
  letter-spacing:1px;
  margin-top:0.3rem;
  font-weight:700;
}
.cover-instructions{
  text-align:left;
  background:#f8fafc;
  border:1px solid #cbd5e1;
  border-radius:12px;
  padding:1.5rem;
  width:100%;
  max-width:550px;
  margin:1rem auto;
  font-family:${fontFamilyCSS};
  font-size:9pt;
  line-height:1.6;
}
.cover-instructions h3{
  font-size:10pt;
  font-weight:bold;
  margin-bottom:0.75rem;
  color:#0f172a;
  letter-spacing:0.5px;
}
.cover-instructions ul{
  list-style-type:disc;
  padding-left:1.2rem;
}
.cover-instructions li{
  margin-bottom:0.5rem;
  color:#334155;
}
.cover-prof{
  margin-top:1.5rem;
  font-size:1rem;
  color:#334155;
}
.cover-prof strong{
  color:#005086;
  font-weight:800;
}

/* ── STANDALONE PREMIUM OMR SHEET ── */
.omr-page {
  page: omr-page-layout;
  position: relative;
  width: 210mm;
  height: 297mm;
  box-sizing: border-box;
  background: #fff;
  page-break-after: always;
  break-inside: avoid;
  page-break-inside: avoid;
}
.omr-marker {
  position: absolute;
  width: 6mm;
  height: 6mm;
  box-sizing: border-box;
}
.omr-marker.tl {
  left: 14mm;
  top: 10mm;
  border-top: 0.6mm solid #005086;
  border-left: 0.6mm solid #005086;
}
.omr-marker.tl::after {
  content: '';
  position: absolute;
  left: 0.6mm;
  top: 0.6mm;
  width: 0.8mm;
  height: 0.8mm;
  background: #005086;
  border-radius: 50%;
}
.omr-marker.tr {
  right: 14mm;
  top: 10mm;
  border-top: 0.6mm solid #005086;
  border-right: 0.6mm solid #005086;
}
.omr-marker.tr::after {
  content: '';
  position: absolute;
  right: 0.6mm;
  top: 0.6mm;
  width: 0.8mm;
  height: 0.8mm;
  background: #005086;
  border-radius: 50%;
}
.omr-marker.bl {
  left: 14mm;
  bottom: 10mm;
  border-bottom: 0.6mm solid #005086;
  border-left: 0.6mm solid #005086;
}
.omr-marker.bl::after {
  content: '';
  position: absolute;
  left: 0.6mm;
  bottom: 0.6mm;
  width: 0.8mm;
  height: 0.8mm;
  background: #005086;
  border-radius: 50%;
}
.omr-marker.br {
  right: 14mm;
  bottom: 10mm;
  border-bottom: 0.6mm solid #005086;
  border-right: 0.6mm solid #005086;
}
.omr-marker.br::after {
  content: '';
  position: absolute;
  right: 0.6mm;
  bottom: 0.6mm;
  width: 0.8mm;
  height: 0.8mm;
  background: #005086;
  border-radius: 50%;
}

.omr-header {
  position: absolute;
  top: 12mm;
  left: 14mm;
  width: 182mm;
  height: 34mm;
  background: #005086;
  border-radius: 3mm;
  color: #fff;
  padding: 6mm;
}
.omr-header-logo {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 20pt;
  font-weight: bold;
  line-height: 1;
  display: flex;
  align-items: center;
}
.omr-header-logo span {
  width: 2.4mm;
  height: 2.4mm;
  background: #38bdf8;
  border-radius: 50%;
  display: inline-block;
  margin-left: 1.5mm;
  margin-top: 1.5mm;
}
.omr-header-subtitle {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 8.5pt;
  color: #bfc4d2;
  margin-top: 2mm;
  line-height: 1;
}
.omr-header-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 10.5pt;
  font-weight: bold;
  color: #fff;
  margin-top: 4.5mm;
  max-width: 130mm;
  line-height: 1.3;
}
.omr-header-qr {
  position: absolute;
  right: 4mm;
  top: 4mm;
  width: 28mm;
  height: 28mm;
  background: #fff;
  border-radius: 1mm;
  padding: 1mm;
}
.omr-header-qr img {
  width: 100%;
  height: 100%;
  display: block;
}

.omr-card {
  position: absolute;
  top: 51mm;
  height: 14mm;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 2mm;
  font-family: 'Plus Jakarta Sans', sans-serif;
  padding: 1.5mm 3mm;
}
.omr-card-label {
  font-size: 7.5pt;
  font-weight: bold;
  color: #64748b;
  line-height: 1;
}
.omr-card-val {
  font-size: 9pt;
  font-weight: bold;
  color: #1f2937;
  margin-top: 1.5mm;
  line-height: 1;
}
.omr-card.score {
  background: #f0fdf4;
  border: 1.5px solid #10b981;
}
.omr-card.score .omr-card-label {
  color: #10b981;
}
.omr-card.score .omr-card-val {
  color: #10b981;
  font-size: 9.5pt;
}

.omr-instructions {
  position: absolute;
  left: 14mm;
  top: 69mm;
  width: 182mm;
  height: 10mm;
  background: #f0f9ff;
  border-radius: 1.5mm;
  overflow: hidden;
  padding-left: 5mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
.omr-instructions-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2.5mm;
  background: #005086;
}
.omr-instructions-title {
  font-size: 7.5pt;
  font-weight: bold;
  color: #005086;
  line-height: 1.2;
}
.omr-instructions-text {
  font-size: 7pt;
  color: #1f2937;
  line-height: 1.2;
  margin-top: 0.5mm;
}

.omr-legend {
  position: absolute;
  left: 14mm;
  top: 82mm;
  height: 10mm;
  display: flex;
  align-items: center;
  gap: 6mm;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
.omr-legend-title {
  font-size: 7pt;
  font-weight: bold;
  color: #64748b;
  text-transform: uppercase;
}
.omr-legend-item {
  display: flex;
  align-items: center;
  gap: 1.5mm;
}
.omr-legend-bubble {
  width: 3.5mm;
  height: 3.5mm;
  border: 0.3mm solid #64748b;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 5pt;
  color: #64748b;
  font-weight: bold;
}
.omr-legend-bubble.filled {
  background: #1f2937;
  border-color: #1f2937;
  color: #fff;
}
.omr-legend-bubble.cross {
  position: relative;
  background: #fff;
}
.omr-legend-bubble.cross::after {
  content: '❌';
  font-size: 5.5pt;
}
.omr-legend-text {
  font-size: 7pt;
  color: #4b5563;
}

.omr-body {
  position: absolute;
  left: 14mm;
  top: 96mm;
  width: 182mm;
  height: 148mm;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 3mm;
  padding: 5mm;
}
.omr-column {
  position: absolute;
  top: 5mm;
  width: 83mm;
  height: 138mm;
}
.omr-column.col-1 {
  left: 5mm;
}
.omr-column.col-2 {
  right: 5mm;
}
.omr-column-divider {
  position: absolute;
  left: 90.75mm;
  top: 5mm;
  width: 0.5mm;
  height: 138mm;
  background: #e2e8f0;
}
.omr-col-header {
  position: relative;
  height: 6mm;
  border-bottom: 0.3mm solid #cbd5e1;
}
.lbl-num {
  position: absolute;
  left: 1mm;
  font-size: 7pt;
  font-weight: bold;
  color: #4b5563;
}
.lbl-opt {
  position: absolute;
  font-size: 7pt;
  font-weight: bold;
  color: #4b5563;
  width: 5mm;
  text-align: center;
}
.omr-row {
  position: relative;
  height: 8.5mm;
  border-bottom: 0.2mm solid #f1f5f9;
  display: flex;
  align-items: center;
}
.omr-row.alt {
  background: #f8fafc;
}
.row-num {
  position: absolute;
  left: 1.5mm;
  font-size: 7.5pt;
  font-weight: bold;
  color: #005086;
}
.omr-bubble {
  position: absolute;
  width: 5.2mm;
  height: 5.2mm;
  border: 0.4mm solid #475569;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 6.5pt;
  color: #475569;
  font-weight: 800;
  background: #fff;
}
.omr-bubble.filled {
  background: #1f2937 !important;
  border-color: #1f2937 !important;
  color: #fff !important;
}
.omr-bubble.correct {
  background: #d1fae5 !important;
  border-color: #10b981 !important;
  color: #065f46 !important;
}
.omr-bubble.wrong {
  background: #fee2e2 !important;
  border-color: #ef4444 !important;
  color: #991b1b !important;
}

.omr-footer {
  position: absolute;
  left: 14mm;
  width: 182mm;
  border-top: 0.3mm solid #cbd5e1;
  padding-top: 3mm;
  display: flex;
  justify-content: space-between;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 7pt;
  color: #64748b;
}

/* ═══════════════════════════════════════
   WORKSHEET DESIGN SYSTEM (ws- prefix)
   ═══════════════════════════════════════ */


/* ── Main Document Header ── */
.ws-doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #005086;
  padding-bottom: 0.5rem;
  margin-bottom: 0.8rem;
  page-break-inside: avoid;
  break-inside: avoid;
}
.ws-doc-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.ws-doc-meta {
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 600;
  margin-top: 0.2rem;
}
.ws-doc-type-badge {
  background: #005086;
  color: #ffffff;
  padding: 0.3rem 0.8rem;
  border-radius: 6px;
  font-weight: 800;
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

/* ── Main Document Header ── */
.ws-doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #005086;
  padding-bottom: 0.5rem;
  margin-bottom: 0.8rem;
  page-break-inside: avoid;
  break-inside: avoid;
}
.ws-doc-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.ws-doc-meta {
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 600;
  margin-top: 0.2rem;
}
.ws-doc-type-badge {
  background: #005086;
  color: #ffffff;
  padding: 0.3rem 0.8rem;
  border-radius: 6px;
  font-weight: 800;
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
/* ── Sidebar ── */
.ws-sidebar {
  position: fixed;
  top: 0;
  left: 0.3cm;
  width: 70px;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 2cm;
  gap: 1.25rem;
  box-sizing: border-box;
  z-index: 1000;
}
.ws-vtab {
  width: 48px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem 0.5rem;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: #64748b;
  text-align: center;
  font-family: 'Plus Jakarta Sans', sans-serif;
  line-height: 1.1;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}
.ws-vtab-dot {
  width: 6px;
  height: 6px;
  background: #cbd5e1;
  border-radius: 50%;
  display: inline-block;
}
.ws-vtab-active {
  background: #005086 !important;
  color: #ffffff !important;
  border-color: #005086 !important;
  box-shadow: 0 4px 15px rgba(0, 80, 134, 0.2);
}
.ws-vtab-active .ws-vtab-dot {
  background: #38bdf8 !important;
}

/* ── Content offset for sidebar ── */
.ws-content {
  padding: 0;
  margin-left: ${pdfConf.showSidebar ? '85px' : '0'};
}

/* ── Section Header ── */
.ws-sec-hdr {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.5rem;
  margin-top: 1.5rem;
  margin-bottom: 0.8rem;
  page-break-inside: avoid;
  break-inside: avoid;
}
.ws-sec-badge {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: #005086;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.95rem;
  flex-shrink: 0;
  font-family: 'Plus Jakarta Sans', sans-serif;
  box-shadow: 0 2px 6px rgba(0, 80, 134, 0.15);
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.ws-sec-pill {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: -0.02em;
}

/* ── Exercise Wrapper ── */
.ws-exercise { margin-bottom: 0.22rem;
  page-break-inside: avoid;
  break-inside: avoid;
}
.ws-ex-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.1rem;
}
.ws-ex-pill { background: #005086; color: #ffffff; padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-weight: 800;
  font-size: 0.76rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  box-shadow: 0 2px 6px rgba(0, 80, 134, 0.08);
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: 0.04em;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.ws-ex-pill-label {
  opacity: 0.85;
}
.ws-ex-num {
  background: #ffffff;
  color: #005086;
  padding: 1px 4px; border-radius: 4px;
  font-size: 0.76rem;
  font-weight: 900;
}
.ws-ans-tag {
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 500;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 1px 5px; border-radius: 4px;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

/* ── Exercise Body Box ── */
.ws-ex-body {
  display: flow-root;
  border-left: 3px solid #005086; background: #ffffff; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; border-radius: 4px 8px 8px 4px; padding: 0.22rem 0.6rem;
  line-height: 1.35;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.02);
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.ws-qtext { font-family: inherit; font-size: 1.0em; font-weight: 500; line-height: 1.34; color: #0f172a; margin-bottom: 2px;
  display: flow-root;
  break-inside: avoid;
  page-break-inside: avoid;
  white-space: pre-line;
  text-align: justify;
}

/* ── Options Grid ── */
.ws-opts { display: grid; gap: 3px 8px; padding-left: 0; margin-top: 2px;
  break-inside: avoid;
  page-break-inside: avoid;
}
.ws-opts-5col { grid-template-columns: repeat(5, 1fr); }
.ws-opts-4col { grid-template-columns: repeat(4, 1fr); }
.ws-opts-2col { grid-template-columns: repeat(2, 1fr); }
.ws-opts-1col { grid-template-columns: 1fr; }
@media (max-width: 600px) {
  .ws-opts-5col, .ws-opts-4col, .ws-opts-2col { grid-template-columns: 1fr; }
}

.ws-opt { display: flex; align-items: center; gap: 7px; font-size: 1.0em; color: #1e293b; padding: 2.5px 7px;
  border-radius: 5px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.ws-opt-letter {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 800;
  font-size: 8pt;
  width: 19px; height: 19px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; background: #ffffff; color: #64748b; border: 1px solid #cbd5e1;
  flex-shrink: 0;
}
.ws-opt-text {
  font-family: inherit;
  font-size: 1.0em;
  display: inline-flex;
  align-items: center;
  flex: 1;
}
.ws-opt .katex, .ws-qtext .katex {
  font-size: 1.0em !important;
}

/* ── Print Styles ── */
@media print {
  body {
    background: #ffffff !important;
  }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .cover { 
    -webkit-print-color-adjust: exact; 
    print-color-adjust: exact;
    background: #ffffff !important;
  }
  .cover-frame {
    box-shadow: none !important;
  }
  ${!shouldShowCover ? '.cover{display:none!important}' : ''}
  .ws-sidebar {
    display: flex !important;
    position: fixed !important;
    background: #ffffff !important;
  }
  .ws-ex-body {
    box-shadow: none !important;
  }
}
.katex { font-size: 1.0em !important; color: inherit !important; font-weight: normal !important; white-space: nowrap !important; } .katex .mathbf, .katex .mathbf * { font-weight: bold !important; } .katex-display { margin: 4px 0; font-size: 1.0em !important; white-space: normal !important; }
${templateCSS}
</style>
</head><body>

<!-- Sidebar -->
${pdfConf.showSidebar ? `<div class="ws-sidebar">${sidebarTabsHtml}</div>` : ''}

<div class="print-hint" id="printHint">
  <div class="print-hint-msg">
    <span class="print-hint-icon">🖨️</span>
    <div class="print-hint-text">
      <strong>Pour un résultat professionnel :</strong><br>
      <span>Dans la boîte d'impression → <b>Plus de paramètres</b> → décochez <b>"En-têtes et pieds de page"</b></span>
    </div>
  </div>
  <button class="hint-badge" onclick="document.getElementById('printHint').style.display='none'">✕ Fermer</button>
</div>

${coverHtml}

<!-- PREMIUM OMR SHEET PAGE -->
${settings.premiumOmr === true ? `
<div class="omr-page">
  <div class="omr-marker tl"></div>
  <div class="omr-marker tr"></div>
  <div class="omr-marker bl"></div>
  <div class="omr-marker br"></div>

  <div class="omr-header">
    <div class="omr-header-logo">${schoolDisplay.toUpperCase()}<span></span></div>
    <div class="omr-header-subtitle">Grille de Réponses Optique · Scanner Automatique${variantBadge ? ` · <strong style="color:#0284c7; background:#e0f2fe; padding:1px 6px; border-radius:4px;">${variantBadge}</strong>` : ''}</div>
    <div class="omr-header-title">${cleanTitle}</div>
    <div class="omr-header-qr">
      <img src="${premiumQrUrl}" alt="QR Code" />
    </div>
  </div>

  <div class="omr-card info-student" style="left: 14mm; width: 85mm;">
    <div class="omr-card-label">CANDIDAT (NOM ET PRÉNOM)</div>
    <div class="omr-card-val" style="border-bottom: 0.3mm solid #475569; height: 5mm; margin-top: 2.5mm;"></div>
  </div>

  <div class="omr-card info-code" style="left: 104mm; width: 44mm;">
    <div class="omr-card-label">DATE DE L'ÉPREUVE</div>
    <div class="omr-card-val">${dateStr}</div>
  </div>

  <div class="omr-card info-class" style="left: 152mm; width: 44mm;">
    <div class="omr-card-label">DURÉE DE L'ÉPREUVE</div>
    <div class="omr-card-val">${examDuration}</div>
  </div>

  <div class="omr-instructions">
    <div class="omr-instructions-bar"></div>
    <div class="omr-instructions-title">⚠️ CONSIGNES DE REMPLISSAGE</div>
    <div class="omr-instructions-text">Coloriez la case correspondante à votre réponse avec un stylo NOIR ou BLEU. Ne faites aucune autre marque.</div>
  </div>

  <div class="omr-legend">
    <span class="omr-legend-title">EXEMPLES :</span>
    <div class="omr-legend-item">
      <div class="omr-legend-bubble filled">A</div>
      <span class="omr-legend-text">Bon Remplissage</span>
    </div>
    <div class="omr-legend-item">
      <div class="omr-legend-bubble cross">B</div>
      <span class="omr-legend-text">Mauvais Remplissage</span>
    </div>
  </div>

  <div class="omr-body">
    ${premiumOmrHtml}
  </div>

  <div class="omr-footer" style="top: ${footerY}mm;">
    <span>⚡ L'CONQ OMR Engine v3.0</span>
    <span>ID de l'Examen : ${examId}</span>
    <span>Ne pas plier ni froisser cette feuille</span>
  </div>
</div>
` : ''}

<div class="ws-content">
  ${templateStyle === 'anisse_classic' ? `
<div class="anisse-header-frame">
  <div class="anisse-col col-left">
    <div>Prof : <strong>${profName || 'Professeur'}</strong></div>
    <div>A.S : <strong>${year || '2025/2026'}</strong></div>
  </div>
  <div class="anisse-col col-center">
    <div class="main-title">${cleanTitle || 'Devoir Surveillé N° 1 (Semestre 1)'}${variantBadge ? `<span style="display:inline-block; margin-left:8px; vertical-align:middle; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:4px; background:${variantBadge.includes('B') ? '#fef3c7' : '#e0f2fe'}; color:${variantBadge.includes('B') ? '#92400e' : '#0369a1'}; border:1px solid ${variantBadge.includes('B') ? '#f59e0b' : '#0284c7'}; letter-spacing:0.05em;">${variantBadge}</span>` : ''}</div>
    <div class="sub-title">${schoolDisplay}</div>
  </div>
  <div class="anisse-col col-right">
    <div>Niveau : <strong>${formattedSchool || '2ème Bac PC/SVT'}</strong></div>
  </div>
  <div class="anisse-col col-qr">
    <img src="${premiumQrUrl}" alt="Solution QR" class="qr-img" />
    <span class="qr-label">SOLUTION</span>
  </div>
</div>
<div class="anisse-sub-bar">
  <span class="badge-num">1</span>
  <span class="pill-instructions">(Les questions de l'exercice sont indépendantes)</span>
</div>
  ` : `
  <div class="ws-doc-header">
    <div class="ws-doc-header-left">
      <h1 class="ws-doc-title">${cleanTitle}${variantBadge ? `<span style="display:inline-block; margin-left:8px; vertical-align:middle; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:6px; background:${variantBadge.includes('B') ? '#fef3c7' : '#e0f2fe'}; color:${variantBadge.includes('B') ? '#92400e' : '#0369a1'}; border:1px solid ${variantBadge.includes('B') ? '#f59e0b' : '#0284c7'};">${variantBadge}</span>` : ''}</h1>
      <div class="ws-doc-meta">${formattedSchool} &nbsp;·&nbsp; ${teacherDisplay}${year ? ` &nbsp;·&nbsp; ${year}` : ''}</div>
    </div>
    <div class="ws-doc-header-right">
      <span class="ws-doc-type-badge">${schoolDisplay.toUpperCase()}</span>
    </div>
  </div>
  `}
  ${questionsHtml}
</div>

<script>
async function printWhenReady() {
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 1000));
  var hint = document.getElementById('printHint');
  if (hint) hint.style.display = 'none';
  window.print();
  if (hint) hint.style.display = 'flex';
}
printWhenReady();
</script>
</body></html>`;
};export const generateCorrectionHTML = (examTitle, school, year, questions, settings = {}) => {
  const cleanTitle = formatExamTitle(examTitle);
  const formattedSchool = formatLevelOrSchool(school);
  const docInfo = getDocTypeInfo(cleanTitle, settings);

  const isArabic = hasArabic(cleanTitle) || questions.some(q => hasArabic(q.question) || hasArabic(q.context) || (q.options || []).some(o => hasArabic(typeof o === 'string' ? o : (o?.text || ''))));
  const pdfConf = getPdfSettings(settings);
  const marginCSS = getMarginStyle(pdfConf.pageMargins);
  const fontFamilyCSS = getFontFamilyStyle(pdfConf.fontFamily);
  const fontSizeCSS = pdfConf.fontSize;

  let profName = settings.profName || '';
  let profSchool = settings.profSchool || '';
  let profPhone = settings.profPhone || '';
  let profSite = settings.profSite || 'www.lconq.ma';
  const showCover = settings.showCover !== undefined ? settings.showCover : true;
  const showPageNumbers = settings.showPageNumbers !== undefined ? settings.showPageNumbers : true;
  const startPage = settings.startPage !== undefined ? settings.startPage : 1;
  const showTricks = settings.showTricks !== undefined ? settings.showTricks : true;
  const variantBadge = settings.variantBadge || (settings.modelVariant ? (String(settings.modelVariant).toUpperCase().includes('MODÈLE') ? settings.modelVariant : `MODÈLE ${settings.modelVariant}`) : '');

  const templateStyle = pdfConf.templateStyle || 'classic_latex';
  const templateCSS = getTemplateStyles(templateStyle, fontSizeCSS);
  const shouldShowCover = (templateStyle === 'compact_eco' || templateStyle === 'super_eco') ? false : showCover;

  let schools = settings.schoolsList || ['ENSA', 'ENSAM', 'ENCG', 'Médecine / Pharmacie', 'INPT', 'INSEA'];
  if (school && !schools.some(s => s.toLowerCase() === school.toLowerCase())) {
    schools = [school, ...schools];
  }
  const sidebarTabsHtml = schools.map(sch => {
    const isActive = sch.toLowerCase() === school.toLowerCase();
    let displayName = formatLevelOrSchool(sch);
    if (sch === 'Médecine / Pharmacie') displayName = 'Médecine';
    if (displayName.includes('Général')) displayName = 'Prépa';
    if (displayName.length > 20) displayName = displayName.substring(0, 18) + '…';
    return `<div class="ws-vtab${isActive ? ' ws-vtab-active' : ''}">
      <span class="ws-vtab-dot"></span>
      ${displayName}
    </div>`;
  }).join('');

  if (typeof window !== 'undefined' && window.localStorage) {
    if (!profName) profName = localStorage.getItem('profName') || '';
    if (!profSchool) profSchool = localStorage.getItem('profSchool') || '';
    if (!profPhone) profPhone = localStorage.getItem('profPhone') || '';
    if (!profSite) profSite = localStorage.getItem('profSite') || 'www.lconq.ma';
  }

  const teacherDisplay = profName ? (profName.toLowerCase().startsWith('prof') ? profName : `Prof. ${profName}`) : 'Enseignant';
  const schoolDisplay = profSchool || 'Établissement Scolaire';

  const siteUrl = profSite;
  const premiumQrPayload = profSite ? profSite : 'https://lconq.ma';
  const premiumQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(premiumQrPayload)}&ecc=H&margin=4`;
  const copyrightLine = profName
    ? `© ${new Date().getFullYear()} L'CONQ × ${profName}. Tous droits réservés.`
    : `© ${new Date().getFullYear()} L'CONQ. Tous droits réservés.`;

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  const coverHtml = shouldShowCover ? `
<div class="cover">
  <div class="cover-frame">
    <div class="cover-logo">L'CONQ</div>
    <div class="cover-subtitle">${docInfo.subTitle} — CORRIGÉ DÉTAILLÉ</div>
    <div class="cover-divider"></div>
    
    <div class="cover-header-group">
      <div class="cover-tag">CORRIGÉ DÉTAILLÉ${variantBadge ? ` · ${variantBadge}` : ''}</div>
      <div class="cover-topic">${cleanTitle}</div>
      <div class="cover-desc">${formattedSchool} &nbsp;·&nbsp; ${docInfo.typeLabel} (Corrigé)${year ? ` &nbsp;·&nbsp; ${year}` : ''}</div>
    </div>
    
    <div class="cover-stats">
      <div class="cover-stat">
        <div class="num">${questions.length}</div>
        <div class="lbl">Questions</div>
      </div>
      <div class="cover-stat">
        <div class="num">100%</div>
        <div class="lbl">Explications</div>
      </div>
      <div class="cover-stat">
        <div class="num">${year || '—'}</div>
        <div class="lbl">Année</div>
      </div>
    </div>
    
    <div class="cover-instructions">
      <h3>⚠️ GUIDE DE CORRECTION :</h3>
      <ul>
        <li>Ce livret contient les réponses commentées de l'épreuve.</li>
        <li>Pour chaque question, l'alternative correcte est surlignée en vert.</li>
        <li>Consultez les rubriques <strong>Règle de l'Art</strong> pour les astuces rapides de calcul.</li>
        <li>Consultez les rubriques <strong>Coup de Grâce</strong> pour les techniques d'élimination par logique.</li>
      </ul>
    </div>

    <div class="cover-prof">
      ${profName ? `Préparé par : <strong>${profName}</strong>${profPhone ? ' · ' + profPhone : ''}` : `<strong>${siteUrl}</strong>`}
    </div>
  </div>
</div>` : '';

  // Keep the order of questions exactly as they appear in the array (following CSV and editor order)
  const sortedQuestions = [...questions];

  /* Questions HTML */
  const questionsHtml = sortedQuestions.map((q, idx) => {
    const num = idx + 1;
    const subject = q.subject || q.topic || 'Général';
    const themeClass = getThemeClass(subject);
    const optionsHtml = (q.options || []).map((opt, oi) => {
      const letter = LETTERS[oi] || String(oi + 1);
      const isCorrect = q.correct_answer === letter;
      return `<div class="ws-opt${isCorrect ? ' ws-opt-correct' : ''}">
        <span class="ws-opt-letter${isCorrect ? ' ws-opt-letter-correct' : ''}">${letter}</span>
        <span class="ws-opt-text">${renderMath(optText(opt))}</span>
        ${isCorrect ? '<span class="ws-check">✓</span>' : ''}
      </div>`;
    }).join('');

    const qnumHtml = templateStyle === 'super_eco' ? `<span class="super-eco-num">${num}</span>` : '';

    return `
    <div class="ws-section ${themeClass}">
      <div class="ws-exercise">
        <div class="ws-ex-header">
          <div class="ws-ex-pill">
            <span class="ws-ex-pill-label">Question N°</span>
            <span class="ws-ex-num">${num}</span>
          </div>
          <span class="ws-ans-tag">👁️ Réponse : <strong>${q.correct_answer || '?'}</strong></span>
        </div>
        <div class="ws-ex-body">
          ${q.context ? `<div class="ctx-box">${qnumHtml}📋 ${renderMath(q.context)} ${renderQuestionImageHTML(q, 'context')}</div>` : ''}
          ${renderQuestionImageHTML(q, 'above')}
          <div class="ws-qtext">${renderQuestionImageHTML(q, 'side')}${q.context ? '' : qnumHtml}${renderMath(q.question || '')}</div>
          ${renderQuestionImageHTML(q, 'below')}
          <div class="ws-opts ${getOptionsLayoutClass(q.options)}">${optionsHtml}</div>
          ${renderQuestionImageHTML(q, 'options')}
        </div>
      </div>
      ${q.astuce ? `<div class="ws-tip-card">
        <div class="ws-tip-header">
          <span class="ws-tip-icon">💡</span>
          <span class="ws-tip-title">Règle de l'Art</span>
          <span class="ws-tip-accent">Astuce & Méthode Rapide</span>
        </div>
        <div class="ws-tip-body">
          ${renderMath(q.astuce)}
          ${renderQuestionImageHTML(q, 'correction')}
        </div>
      </div>` : ''}
      ${showTricks && q.trick ? `<div class="ws-trick-card">
        <div class="ws-trick-header">
          <span class="ws-trick-icon">⚡</span>
          <span class="ws-trick-title">Coup de Grâce</span>
          <span class="ws-trick-accent">Technique d'Élimination</span>
        </div>
        <div class="ws-trick-body">${renderMath(q.trick)}</div>
      </div>` : ''}
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="${isArabic ? 'ar' : 'fr'}" dir="${isArabic ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8">
<title>${examTitle} — Correction</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=STIX+Two+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<style>
@font-face {
  font-family: 'UKIJMerdaneRegular';
  src: url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}
html[dir="rtl"] body {
  font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'Noto Naskh Arabic', Arial, sans-serif !important;
  direction: rtl !important;
  text-align: right !important;
}
html[dir="rtl"] .cover-instructions {
  text-align: right !important;
}
html[dir="rtl"] .cover-instructions ul {
  padding-left: 0 !important;
  padding-right: 1.2rem !important;
}
html[dir="rtl"] .ws-ex-header {
  flex-direction: row-reverse !important;
}
html[dir="rtl"] .ws-ex-pill {
  flex-direction: row-reverse !important;
}
html[dir="rtl"] .ws-ex-num {
  margin-left: 0 !important;
  margin-right: 0.35rem !important;
}
html[dir="rtl"] .ws-opt {
  flex-direction: row !important;
}
html[dir="rtl"] .ws-opt-letter {
  margin-right: 0 !important;
  margin-left: 10px !important;
}
html[dir="rtl"] .ws-tip-header, html[dir="rtl"] .ws-trick-header {
  flex-direction: row-reverse !important;
}
html[dir="rtl"] .ws-tip-title, html[dir="rtl"] .ws-trick-title {
  margin-left: auto !important;
  margin-right: 8px !important;
}
html[dir="rtl"] .ws-tip-accent, html[dir="rtl"] .ws-trick-accent {
  margin-left: 0 !important;
  margin-right: auto !important;
}
html[dir="rtl"] .ws-check {
  margin-left: 0 !important;
  margin-right: auto !important;
}
html[dir="rtl"] .katex, html[dir="rtl"] .katex-display {
  direction: ltr !important;
  unicode-bidi: isolate;
  display: inline-block;
}
*{box-decoration-break:clone;-webkit-box-decoration-break:clone;box-sizing:border-box;margin:0;padding:0}
body{
  font-family: 'Plus Jakarta Sans', sans-serif;
  color:#1e293b;background:#f8fafc;font-size:${fontSizeCSS};line-height:1.32;
  padding-bottom:0;
  print-color-adjust:exact;-webkit-print-color-adjust:exact;
  font-feature-settings:'liga' 1,'kern' 1;
}
@page{
  size:A4;
  margin: 0.45cm 0.55cm 0.35cm 0.55cm;
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
@page :first {
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
html{counter-reset:page ${startPage - 1}}

/* ── PRINT INSTRUCTION OVERLAY ── */
.print-hint{position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#0f172a,#1e293b);
  color:#fff;padding:0.9rem 1.5rem;display:flex;align-items:center;justify-content:space-between;
  font-size:9.5pt;gap:1rem;print-color-adjust:exact;font-family:'Plus Jakarta Sans',sans-serif;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15)}
.print-hint-msg{display:flex;align-items:center;gap:0.75rem}
.print-hint-icon{font-size:1.4rem;flex-shrink:0}
.print-hint-text strong{font-size:10pt;color:#38bdf8}
.print-hint-text span{color:rgba(255,255,255,0.7);font-size:8.5pt}
.hint-badge{background:#0284c7;color:#fff;font-size:8pt;font-weight:700;padding:4px 14px;border-radius:20px;
  white-space:nowrap;cursor:pointer;border:none;font-family:inherit;letter-spacing:.5px;transition: all 0.2s}
.hint-badge:hover{background:#0369a1}
@media print{.print-hint{display:none!important}}

/* ── COVER PAGE ── */
.cover{
  box-sizing:border-box;width:100%;height:27.5cm;padding:1.2cm;
  page-break-after:always;print-color-adjust:exact;-webkit-print-color-adjust:exact;
  background: radial-gradient(circle at 10% 20%, rgba(243, 246, 249, 1) 0%, rgba(255, 255, 255, 1) 90%);
  color:#0f172a;
}
.cover-frame{
  border:2px solid #e2e8f0;
  padding:2.5cm 2cm;
  height:100%;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  align-items:center;
  box-sizing:border-box;
  background:#ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.04);
}
.cover-logo{
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size:2.4rem;
  font-weight:900;
  letter-spacing:8px;
  text-transform:uppercase;
  margin-bottom:0.2rem;
  color:#005086;
}
.cover-subtitle{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:0.85rem;
  font-weight:700;
  color:#64748b;
  letter-spacing:4px;
  text-transform:uppercase;
  margin-bottom:1.5rem;
}
.cover-divider{
  width:80px;
  height:4px;
  background:linear-gradient(90deg, #005086, #007cc6);
  border-radius:2px;
  margin:0 auto 2.5rem;
}
.cover-header-group{
  text-align:center;
  max-width: 90%;
}
.cover-tag{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:0.8rem;
  font-weight:800;
  letter-spacing:3px;
  text-transform:uppercase;
  color:#ffffff;
  background: #005086;
  padding:6px 16px;
  border-radius:99px;
  display:inline-block;
  margin-bottom:1.2rem;
}
.cover-topic{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:2.8rem;
  font-weight:800;
  line-height:1.2;
  margin:0.5rem 0 1.2rem;
  color:#0f172a;
  letter-spacing: -0.02em;
}
.cover-desc{
  font-family:${fontFamilyCSS};
  font-size:1.1rem;
  color:#475569;
  line-height: 1.6;
  margin-bottom:2rem;
}
.cover-stats{
  display:flex;
  gap:2rem;
  justify-content:center;
  margin:1.5rem 0;
  width:100%;
}
.cover-stat {
  border: 1px solid #e2e8f0;
  border-radius:12px;
  padding:16px 28px;
  min-width:130px;
  text-align:center;
  background:#f8fafc;
}
.cover-stat .num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:1.8rem;
  font-weight:800;
  color:#005086;
}
.cover-stat .lbl{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:0.75rem;
  color:#64748b;
  text-transform:uppercase;
  letter-spacing:1px;
  margin-top:0.3rem;
  font-weight:700;
}
.cover-instructions{
  text-align:left;
  background:#f8fafc;
  border:1px solid #cbd5e1;
  border-radius:12px;
  padding:1.5rem;
  width:100%;
  max-width:550px;
  margin:1rem auto;
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:9pt;
  line-height:1.6;
}
.cover-instructions h3{
  font-size:10pt;
  font-weight:bold;
  margin-bottom:0.75rem;
  color:#0f172a;
  letter-spacing:0.5px;
}
.cover-instructions ul{
  list-style-type:disc;
  padding-left:1.2rem;
}
.cover-instructions li{
  margin-bottom:0.5rem;
  color:#334155;
}
.cover-prof{
  margin-top:1.5rem;
  font-size:1rem;
  color:#334155;
}
.cover-prof strong{
  color:#005086;
  font-weight:800;
}

/* ── COLOR THEMES PER SUBJECT ── */
.theme-math {
  --primary: #2563eb;
  --dark: #1e3a8a;
  --bg: #eff6ff;
  --border: #bfdbfe;
  --text: #1e3a8a;
}
.theme-physique {
  --primary: #0d9488;
  --dark: #0f766e;
  --bg: #f0fdfa;
  --border: #99f6e4;
  --text: #115e59;
}
.theme-chimie {
  --primary: #7c3aed;
  --dark: #6d28d9;
  --bg: #f5f3ff;
  --border: #ddd6fe;
  --text: #5b21b6;
}
.theme-svt {
  --primary: #16a34a;
  --dark: #15803d;
  --bg: #f0fdf4;
  --border: #bbf7d0;
  --text: #166534;
}
.theme-francais {
  --primary: #ea580c;
  --dark: #c2410c;
  --bg: #fff7ed;
  --border: #fed7aa;
  --text: #9a3412;
}
.theme-general {
  --primary: #4f46e5;
  --dark: #4338ca;
  --bg: #eef2ff;
  --border: #c7d2fe;
  --text: #3730a3;
}

/* ═══════════════════════════════════════
   WORKSHEET DESIGN SYSTEM (ws- prefix)
   ═══════════════════════════════════════ */

/* ── Sidebar ── */
.ws-sidebar {
  position: fixed;
  top: 0;
  left: 0.3cm;
  width: 70px;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 2cm;
  gap: 1.25rem;
  box-sizing: border-box;
  z-index: 1000;
}
.ws-vtab {
  width: 48px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem 0.5rem;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: #64748b;
  text-align: center;
  font-family: 'Plus Jakarta Sans', sans-serif;
  line-height: 1.1;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}
.ws-vtab-dot {
  width: 6px;
  height: 6px;
  background: #cbd5e1;
  border-radius: 50%;
  display: inline-block;
}
.ws-vtab-active {
  background: #005086 !important;
  color: #ffffff !important;
  border-color: #005086 !important;
  box-shadow: 0 4px 15px rgba(0, 80, 134, 0.2);
}
.ws-vtab-active .ws-vtab-dot {
  background: #38bdf8 !important;
}

/* ── Content offset for sidebar ── */
.ws-content {
  padding: ${marginCSS};
  margin-left: ${pdfConf.showSidebar ? '85px' : '0'};
}

/* ── Section Header ── */
.ws-sec-hdr {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.75rem;
  margin-top: 2.5rem;
  margin-bottom: 1.5rem;
  page-break-inside: avoid;
  break-inside: avoid;
}
.ws-sec-badge {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #005086;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.05rem;
  flex-shrink: 0;
  font-family: 'Plus Jakarta Sans', sans-serif;
  box-shadow: 0 4px 10px rgba(0, 80, 134, 0.2);
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.ws-sec-pill {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: -0.02em;
}

/* ── Exercise Wrapper ── */
.ws-exercise { margin-bottom: 0.45rem;
  page-break-inside: avoid;
  break-inside: avoid;
}
.ws-ex-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.15rem;
}
.ws-ex-pill { background: #005086; color: #ffffff; padding: 0.2rem 0.65rem;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 80, 134, 0.1);
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: 0.05em;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.ws-ex-pill-label {
  opacity: 0.85;
}
.ws-ex-num {
  background: #ffffff;
  color: #005086;
  padding: 1px 4px; border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 900;
}
.ws-ans-tag {
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 500;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 1px 6px; border-radius: 5px;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

/* ── Exercise Body Box ── */
.ws-ex-body {
  display: flow-root;
  border-left: 3px solid #005086; background: #ffffff; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; border-radius: 4px 10px 10px 4px; padding: 0.4rem 0.75rem;
  line-height: 1.75;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.02);
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.ws-qtext { font-family: inherit; font-size: 1.0em; font-weight: 500; line-height: 1.45; color: #0f172a; margin-bottom: 4px;
  display: flow-root;
  break-inside: avoid;
  page-break-inside: avoid;
  white-space: pre-line;
  text-align: justify;
}

/* ── Options Grid ── */
.ws-opts { display: grid; gap: 6px 12px; padding-left: 0; margin-top: 4px;
  break-inside: avoid;
  page-break-inside: avoid;
}
.ws-opts-5col { grid-template-columns: repeat(5, 1fr); }
.ws-opts-4col { grid-template-columns: repeat(4, 1fr); }
.ws-opts-2col { grid-template-columns: repeat(2, 1fr); }
.ws-opts-1col { grid-template-columns: 1fr; }
@media (max-width: 600px) {
  .ws-opts-5col, .ws-opts-4col, .ws-opts-2col { grid-template-columns: 1fr; }
}

.ws-opt { display: flex; align-items: center; gap: 8px; font-size: 1.0em; color: #1e293b; padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.ws-opt-letter {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 800;
  font-size: 8pt;
  width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; background: #ffffff; color: #64748b; border: 1px solid #cbd5e1;
  flex-shrink: 0;
}
.ws-opt-text {
  font-family: inherit;
  font-size: 1.0em;
  display: inline-flex;
  align-items: center;
  flex: 1;
}
.ws-opt .katex, .ws-qtext .katex {
  font-size: 1.0em !important;
}
.ws-opt-correct {
  background: #ecfdf5 !important;
  border: 1px solid #a7f3d0 !important;
  color: #065f46 !important;
  font-weight: 600;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.ws-opt-letter-correct {
  background: #10b981 !important;
  border-color: #10b981 !important;
  color: #ffffff !important;
  font-weight: bold;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.ws-check {
  margin-left: auto;
  color: #10b981;
  font-weight: bold;
  font-size: 9pt;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(16, 185, 129, 0.12);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

/* ── Tip / Trick Cards (Subsection Card Style) ── */
.ws-tip-card {
  border: 1px solid #e2e8f0;
  border-left: 4px solid #0284c7;
  border-radius: 12px;
  padding: 1.2rem 1.5rem;
  background: #f0f9ff;
  margin-top: 0.85rem;
  page-break-inside: avoid;
  break-inside: avoid;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.ws-tip-header {
  font-size: 0.9rem;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 700;
  color: #0369a1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.ws-tip-icon {
  font-size: 1.1rem;
}
.ws-tip-title {
  font-weight: 800;
}
.ws-tip-accent {
  font-weight: 500;
  opacity: 0.8;
  font-size: 0.8rem;
  margin-left: auto;
  background: rgba(3, 105, 161, 0.1);
  padding: 2px 8px;
  border-radius: 6px;
}
.ws-tip-body {
  font-family: inherit;
  font-size: 0.9em;
  line-height: 1.65;
  color: #0369a1;
  white-space: pre-line;
  text-align: justify;
}

.ws-trick-card {
  border: 1px solid #e9d5ff;
  border-left: 4px solid #7c3aed;
  border-radius: 12px;
  padding: 1.2rem 1.5rem;
  background: #faf5ff;
  margin-top: 0.65rem;
  page-break-inside: avoid;
  break-inside: avoid;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.ws-trick-header {
  font-size: 0.9rem;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 700;
  color: #6b21a8;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.ws-trick-icon {
  font-size: 1.1rem;
}
.ws-trick-title {
  font-weight: 800;
}
.ws-trick-accent {
  font-weight: 500;
  opacity: 0.8;
  font-size: 0.8rem;
  margin-left: auto;
  background: rgba(107, 33, 168, 0.08);
  padding: 2px 8px;
  border-radius: 6px;
}
.ws-trick-body {
  font-family: inherit;
  font-size: 0.9em;
  line-height: 1.65;
  color: #6b21a8;
  white-space: pre-line;
  text-align: justify;
}

/* ── Print Styles ── */
@media print {
  body {
    background: #ffffff !important;
  }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .cover { 
    -webkit-print-color-adjust: exact; 
    print-color-adjust: exact;
    background: #ffffff !important;
  }
  .cover-frame {
    box-shadow: none !important;
  }
  ${!shouldShowCover ? '.cover{display:none!important}' : ''}
  .ws-sidebar {
    display: flex !important;
    position: fixed !important;
    background: #ffffff !important;
  }
  .ws-ex-body {
    box-shadow: none !important;
  }
}
.katex { font-size: 1.0em !important; color: inherit !important; font-weight: normal !important; white-space: nowrap !important; } .katex .mathbf, .katex .mathbf * { font-weight: bold !important; } .katex-display { margin: 4px 0; font-size: 1.0em !important; white-space: normal !important; }
${templateCSS}
</style>
</head><body>

<!-- Sidebar -->
${pdfConf.showSidebar ? `<div class="ws-sidebar">${sidebarTabsHtml}</div>` : ''}

<div class="print-hint" id="printHint">
  <div class="print-hint-msg">
    <span class="print-hint-icon">🖨️</span>
    <div class="print-hint-text">
      <strong>Pour un résultat professionnel :</strong><br>
      <span>Dans la boîte d'impression → <b>Plus de paramètres</b> → décochez <b>"En-têtes et pieds de page"</b></span>
    </div>
  </div>
  <button class="hint-badge" onclick="document.getElementById('printHint').style.display='none'">✕ Fermer</button>
</div>

${coverHtml}

<div class="ws-content">
  ${templateStyle === 'anisse_classic' ? `
<div class="anisse-header-frame">
  <div class="anisse-col col-left">
    <div>Prof : <strong>${profName || 'Professeur'}</strong></div>
    <div>A.S : <strong>${year || '2025/2026'}</strong></div>
  </div>
  <div class="anisse-col col-center">
    <div class="main-title">${cleanTitle || 'Devoir Surveillé N° 1 (Semestre 1)'}${variantBadge ? `<span style="display:inline-block; margin-left:8px; vertical-align:middle; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:4px; background:${variantBadge.includes('B') ? '#fef3c7' : '#e0f2fe'}; color:${variantBadge.includes('B') ? '#92400e' : '#0369a1'}; border:1px solid ${variantBadge.includes('B') ? '#f59e0b' : '#0284c7'}; letter-spacing:0.05em;">${variantBadge}</span>` : ''}</div>
    <div class="sub-title" style="color: #7c3aed;">${schoolDisplay} — CORRIGÉ</div>
  </div>
  <div class="anisse-col col-right">
    <div>Niveau : <strong>${formattedSchool || '2ème Bac PC/SVT'}</strong></div>
  </div>
  <div class="anisse-col col-qr" style="background: #7c3aed;">
    <img src="${premiumQrUrl}" alt="Solution QR" class="qr-img" />
    <span class="qr-label">SOLUTION</span>
  </div>
</div>
<div class="anisse-sub-bar" style="border-bottom-color: #7c3aed;">
  <span class="badge-num" style="background: #7c3aed;">1</span>
  <span class="pill-instructions" style="border-color: #7c3aed; color: #7c3aed;">(Corrigé détaillé et astuces de résolution)</span>
</div>
  ` : `
  <div class="ws-doc-header" style="border-bottom-color: #7c3aed;">
    <div class="ws-doc-header-left">
      <h1 class="ws-doc-title">${cleanTitle}${variantBadge ? `<span style="display:inline-block; margin-left:8px; vertical-align:middle; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:6px; background:${variantBadge.includes('B') ? '#fef3c7' : '#e0f2fe'}; color:${variantBadge.includes('B') ? '#92400e' : '#0369a1'}; border:1px solid ${variantBadge.includes('B') ? '#f59e0b' : '#0284c7'};">${variantBadge}</span>` : ''}</h1>
      <div class="ws-doc-meta">${formattedSchool} &nbsp;·&nbsp; ${teacherDisplay} &nbsp;·&nbsp; Corrigé${year ? ` &nbsp;·&nbsp; ${year}` : ''}</div>
    </div>
    <div class="ws-doc-header-right">
      <span class="ws-doc-type-badge" style="background: #7c3aed;">${schoolDisplay.toUpperCase()}</span>
    </div>
  </div>
  `}
  ${questionsHtml}
</div>

<script>
async function printWhenReady() {
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 1000));
  var hint = document.getElementById('printHint');
  if (hint) hint.style.display = 'none';
  window.print();
  if (hint) hint.style.display = 'flex';
}
printWhenReady();
</script>
</body></html>`;
};export const generateEbookHTML = (topic, questionsWithSource, settings = {}) => {
  const pdfConf = getPdfSettings(settings);
  const marginCSS = getMarginStyle(pdfConf.pageMargins);
  const fontFamilyCSS = getFontFamilyStyle(pdfConf.fontFamily);
  const fontSizeCSS = pdfConf.fontSize;

  const {
    showCover = true,
    showTricks = true,
    showPageNumbers = true,
    startPage = 1,
    profName = '',
    profPhone = '',
    profSite = 'www.lconq.ma',
  } = settings;

  const templateStyle = pdfConf.templateStyle || 'classic_latex';
  const templateCSS = getTemplateStyles(templateStyle, fontSizeCSS);
  const shouldShowCover = (templateStyle === 'compact_eco' || templateStyle === 'super_eco') ? false : showCover;

  const compactHeaderHtml = (templateStyle === 'compact_eco' || templateStyle === 'super_eco') ? `
<div class="compact-header-box">
  <div class="ch-left">
    <div class="ch-school">E-BOOK DE PRÉPARATION</div>
    <div class="ch-title">${topic}</div>
  </div>
  <div class="ch-right">
    <div class="ch-pill">GUIDE DE MAÎTRISE</div>
    <div class="ch-pill">${questionsWithSource.length} Questions</div>
  </div>
</div>
<hr class="compact-divider">
` : '';

  const total = questionsWithSource.length;
  const sources = [...new Set(questionsWithSource.map(q => q._source || 'Inconnu'))];
  const year = new Date().getFullYear();
  const siteUrl = profSite || 'www.lconq.ma';
  const copyrightLine = profName
    ? `© ${year} L'CONQ × ${profName}. Tous droits réservés.`
    : `© ${year} L'CONQ. Tous droits réservés.`;

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  const cardsHtml = questionsWithSource.map((q, i) => {
    const optionsHtml = (q.options || []).map((opt, oi) => {
      const letter = LETTERS[oi] || String(oi + 1);
      const rawText = typeof opt === 'string' ? opt : (opt?.text || '');
      const text = rawText.replace(/^[A-E][).]\s*/i, '');
      const isCorrect = q.correct_answer === letter;
      return `<div class="opt${isCorrect ? ' correct-opt' : ''}">
        <span class="opt-badge${isCorrect ? ' correct-badge' : ''}">${letter}</span>
        <span>${renderMath(text)}</span>
        ${isCorrect ? '<span class="correct-check">✓</span>' : ''}
      </div>`;
    }).join('');

    const sourceTag = q._source ? `<span class="src-tag">${q._source.toUpperCase()}${q._year ? ' · ' + q._year : ''}</span>` : '';
    const themeClass = getThemeClass(q.subject || q.topic || 'Général');

    return `<div class="qcard ${themeClass}">
      <div class="card-hdr">
        <span class="qnum">Q${i + 1}</span>
        ${sourceTag}
        <span class="ans-badge">Réponse : ${q.correct_answer || '?'}</span>
      </div>
      ${q.context ? `<div class="ctx-box" style="margin-bottom: 4px;">📋 ${renderMath(q.context)} ${renderQuestionImageHTML(q, 'context')}</div>` : ''}
      ${renderQuestionImageHTML(q, 'above')}
      <div class="qtext">${renderQuestionImageHTML(q, 'side')}${renderMath(q.question || '')}</div>
      ${renderQuestionImageHTML(q, 'below')}
      <div class="opts ${getOptionsLayoutClass(q.options)}">${optionsHtml}</div>
      ${renderQuestionImageHTML(q, 'options')}
      ${q.astuce ? `<div class="rule-box">
        <div class="rule-title">⭐ RÈGLE DE L'ART</div>
        <div class="rule-body">
          ${renderMath(q.astuce)}
          ${renderQuestionImageHTML(q, 'correction')}
        </div>
      </div>` : ''}
      ${showTricks && q.trick ? `<div class="trick-box">
        <div class="trick-title">⚡ COUP DE GRÂCE</div>
        <div class="trick-body">${renderMath(q.trick)}</div>
      </div>` : ''}
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>E-Book — ${topic}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
${getFontImportLinks()}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:${fontFamilyCSS};
  background:#fff;color:#111;
  font-size:${fontSizeCSS};line-height:1.38;
  padding-bottom:0;
  print-color-adjust:exact;-webkit-print-color-adjust:exact;
  font-feature-settings:'liga' 1,'kern' 1;}

@page{
  size:A4;
  margin: 0.45cm 0.55cm 0.35cm 0.55cm;
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
@page :first {
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
html{counter-reset:page ${startPage - 1}}

.print-hint{position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#1a1a2e,#16213e);
  color:#fff;padding:0.9rem 1.5rem;display:flex;align-items:center;justify-content:space-between;
  font-size:9pt;gap:1rem;print-color-adjust:exact}
.print-hint-msg{display:flex;align-items:center;gap:0.75rem}
.print-hint-icon{font-size:1.3rem;flex-shrink:0}
.print-hint-text strong{font-size:9.5pt;color:#a78bfa}
.print-hint-text span{color:rgba(255,255,255,0.7);font-size:8pt}
.hint-badge{background:#7c3aed;color:#fff;font-size:7.5pt;font-weight:700;padding:3px 12px;border-radius:20px;
  white-space:nowrap;cursor:pointer;border:none;font-family:inherit;letter-spacing:.5px}
@media print{.print-hint{display:none!important}}

/* ── COVER PAGE ── */
.cover{
  box-sizing:border-box;
  width:100%;
  height:27.5cm;
  padding:1cm;
  page-break-after:always;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
  background:#fff;
  color:#0f172a;
}
.cover-frame{
  border:4px double #0f172a;
  padding:2cm 1.5cm;
  height:100%;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  align-items:center;
  box-sizing:border-box;
}
.cover-logo{
  font-family:${fontFamilyCSS};
  font-size:2.2rem;
  font-weight:bold;
  letter-spacing:6px;
  text-transform:uppercase;
  margin-bottom:0.2rem;
  color:#0f172a;
}
.cover-subtitle{
  font-family:'Inter',sans-serif;
  font-size:0.8rem;
  font-weight:600;
  color:#475569;
  letter-spacing:3px;
  text-transform:uppercase;
  margin-bottom:1.5rem;
}
.cover-divider{
  width:120px;
  height:1.5px;
  background:#0f172a;
  margin:0 auto 2rem;
}
.cover-header-group{
  text-align:center;
}
.cover-tag{
  font-family:'Inter',sans-serif;
  font-size:0.75rem;
  font-weight:800;
  letter-spacing:3px;
  text-transform:uppercase;
  color:#475569;
  border:1px solid #cbd5e1;
  padding:4px 12px;
  border-radius:4px;
  display:inline-block;
  margin-bottom:1rem;
}
.cover-topic{
  font-family:${fontFamilyCSS};
  font-size:2.4rem;
  font-weight:bold;
  line-height:1.25;
  margin:0.5rem 0 1rem;
  color:#0f172a;
}
.cover-desc{
  font-family:${fontFamilyCSS};
  font-size:1rem;
  color:#475569;
  font-style:italic;
  margin-bottom:2rem;
}
.cover-stats{
  display:flex;
  gap:2.5rem;
  justify-content:center;
  margin:1rem 0;
  width:100%;
}
.cover-stat{
  border:1px solid #cbd5e1;
  border-radius:6px;
  padding:12px 24px;
  min-width:110px;
  text-align:center;
  background:#f8fafc;
}
.cover-stat .num{
  font-family:${fontFamilyCSS};
  font-size:1.6rem;
  font-weight:bold;
  color:#0f172a;
}
.cover-stat .lbl{
  font-family:'Inter',sans-serif;
  font-size:0.7rem;
  color:#64748b;
  text-transform:uppercase;
  letter-spacing:1px;
  margin-top:0.2rem;
  font-weight:600;
}
.cover-sources{
  margin-top:1rem;
  padding:0.75rem 1.5rem;
  border:1px solid #cbd5e1;
  border-radius:6px;
  font-size:0.8rem;
  color:#334155;
  max-width:550px;
  width:100%;
  text-align:center;
  background:#f8fafc;
  font-family:'Inter',sans-serif;
}
.cover-sources strong{
  color:#0f172a;
}
.cover-prof{
  font-family:${fontFamilyCSS};
  margin-top:1.5rem;
  font-size:0.95rem;
  color:#334155;
  font-style:italic;
}
.cover-prof strong{
  color:#0f172a;
  font-style:normal;
}

/* ── COLOR THEMES PER SUBJECT ── */
.theme-math {
  --primary: #2563eb;
  --dark: #1e3a8a;
  --bg: #eff6ff;
  --border: #bfdbfe;
  --text: #1e3a8a;
}
.theme-physique {
  --primary: #0d9488;
  --dark: #0f766e;
  --bg: #f0fdfa;
  --border: #99f6e4;
  --text: #115e59;
}
.theme-chimie {
  --primary: #7c3aed;
  --dark: #6d28d9;
  --bg: #f5f3ff;
  --border: #ddd6fe;
  --text: #5b21b6;
}
.theme-svt {
  --primary: #16a34a;
  --dark: #15803d;
  --bg: #f0fdf4;
  --border: #bbf7d0;
  --text: #166534;
}
.theme-francais {
  --primary: #ea580c;
  --dark: #c2410c;
  --bg: #fff7ed;
  --border: #fed7aa;
  --text: #9a3412;
}
.theme-general {
  --primary: #4f46e5;
  --dark: #4338ca;
  --bg: #eef2ff;
  --border: #c7d2fe;
  --text: #3730a3;
}

.content{padding:0;}
.section-hdr{
  font-family:inherit;
  font-size:1.05em;
  font-weight:bold;
  letter-spacing:1px;
  text-transform:uppercase;
  color:#0f172a;
  text-align:center;
  border-top:1.5px solid #0f172a;
  border-bottom:1.5px solid #0f172a;
  padding:4px 0;
  margin:1rem 0 0.6rem 0;
  display:block;
  width:100%;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
}

.qcard{
  border:1px solid #e2e8f0;
  border-left:4px solid var(--primary,#cbd5e1);
  border-radius:6px;
  padding:8px 12px;
  margin-bottom:8px;
  background:#ffffff;
  box-shadow:none;
  ${pdfConf.avoidPageBreaks ? 'page-break-inside:avoid; break-inside:avoid;' : ''}
}
.card-hdr{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:12px;
  padding-bottom:8px;
  border-bottom:1px solid #f1f5f9;
  flex-wrap:wrap;
  break-inside:avoid;
  page-break-inside:avoid;
}
.qnum{
  font-family:'Inter',sans-serif;
  background:var(--primary,#4f46e5);
  color:#ffffff !important;
  font-size:8pt;
  font-weight:800;
  padding:3px 10px;
  border-radius:4px;
  letter-spacing:0.5px;
  text-transform:uppercase;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
}
.src-tag{
  font-family:'Inter',sans-serif;
  background:#f1f5f9;
  color:#475569;
  font-size:7pt;
  font-weight:700;
  padding:3px 9px;
  border-radius:4px;
  border:1px solid #cbd5e1;
  letter-spacing:0.5px;
  text-transform:uppercase;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
}
.ans-badge{
  font-family:'Inter',sans-serif;
  margin-left:auto;
  background:#f0fdf4;
  color:#16a34a;
  padding:3px 10px;
  border-radius:4px;
  font-size:8pt;
  font-weight:800;
  border:1px solid #bbf7d0;
  letter-spacing:0.5px;
  text-transform:uppercase;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
}
.qtext{
  font-family:inherit;
  font-size:1.05em;
  font-weight:500;
  line-height:1.65;
  color:#1e293b;
  margin-bottom:14px;
  break-inside:avoid;
  page-break-inside:avoid;
  white-space:pre-line;
  text-align:justify;
}
.opts{
  display:grid;
  gap:8px 24px;
  padding-left:0;
  margin-bottom:10px;
  break-inside:avoid;
  page-break-inside:avoid;
}
.opts-5col {
  grid-template-columns: repeat(5, 1fr);
}
.opts-4col {
  grid-template-columns: repeat(4, 1fr);
}
.opts-2col {
  grid-template-columns: repeat(2, 1fr);
}
.opts-1col {
  grid-template-columns: 1fr;
}
@media (max-width: 600px) {
  .opts-5col, .opts-4col, .opts-2col {
    grid-template-columns: 1fr;
  }
}
.opt{
  display:flex;
  align-items:center;
  gap:12px;
  font-size:1.0em;
  color:#334155;
  padding:6px 12px;
  border-radius:8px;
  border:1px solid transparent;
}
.opt-badge{
  font-family:'Inter',sans-serif;
  font-weight:700;
  font-size:8.5pt;
  width:24px;
  height:24px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:50%;
  background:#ffffff;
  color:#64748b;
  border:1px solid #cbd5e1;
  flex-shrink:0;
}
.correct-opt{
  background:#f0fdf4!important;
  border:1px solid #bbf7d0!important;
  color:#15803d!important;
  font-weight:600;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
}
.correct-opt .opt-badge.correct-badge{
  font-family:'Inter',sans-serif;
  background:#10b981 !important;
  border-color:#10b981 !important;
  color:#ffffff !important;
  font-weight:bold;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
}
.correct-check{
  margin-left:auto;
  color:#10b981;
  font-weight:bold;
  font-size:9pt;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  background:rgba(16, 185, 129, 0.12);
  width:18px;
  height:18px;
  border-radius:50%;
  flex-shrink:0;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
}

.ctx-box{
  background:#f8fafc;
  border-left:3px solid #64748b;
  padding:6px 10px;
  font-size:0.85em;
  margin-bottom:8px;
  border-radius:0 4px 4px 0;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
  font-family:inherit;
  break-inside:avoid;
  page-break-inside:avoid;
  white-space:pre-line;
  text-align:justify;
}

.rule-box{
  background:#fffbeb;
  border:1px solid #fde68a;
  border-left:4px solid #f59e0b;
  border-radius:4px;
  padding:8px 12px;
  margin-top:8px;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
  break-inside:avoid;
  page-break-inside:avoid;
}
.rule-title{
  font-family:'Inter',sans-serif;
  font-size:0.65rem;
  font-weight:800;
  letter-spacing:1.5px;
  color:#92400e;
  margin-bottom:4px;
  text-transform:uppercase;
}
.rule-body{
  font-family:inherit;
  font-size:0.85em;
  line-height:1.6;
  color:#78350f;
  white-space:pre-line;
  text-align:justify;
}
.trick-box{
  background:#fdf4ff;
  border:1px solid #e9d5ff;
  border-left:4px solid #7c3aed;
  border-radius:4px;
  padding:8px 12px;
  margin-top:6px;
  print-color-adjust:exact;
  -webkit-print-color-adjust:exact;
  break-inside:avoid;
  page-break-inside:avoid;
}
.trick-title{
  font-family:'Inter',sans-serif;
  font-size:0.65rem;
  font-weight:800;
  letter-spacing:1.5px;
  color:#6b21a8;
  margin-bottom:4px;
  text-transform:uppercase;
}
.trick-body{
  font-family:inherit;
  font-size:0.85em;
  line-height:1.6;
  color:#581c87;
  white-space:pre-line;
  text-align:justify;
}

@media print{
  ${pdfConf.forcePrintColors ? `
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  ` : ''}
  .cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  ${!shouldShowCover ? '.cover{display:none!important}' : ''}
}
.katex { font-size: 1.0em !important; color: inherit !important; font-weight: normal !important; white-space: nowrap !important; } .katex .mathbf, .katex .mathbf * { font-weight: bold !important; } .katex-display { margin: 4px 0; font-size: 1.0em !important; white-space: normal !important; }
${templateCSS}
</style>
</head><body>

<div class="print-hint" id="printHint">
  <div class="print-hint-msg">
    <span class="print-hint-icon">🖨️</span>
    <div class="print-hint-text">
      <strong>Pour un résultat professionnel :</strong><br>
      <span>Dans la boîte d'impression → <b>Plus de paramètres</b> → décochez <b>"En-têtes et pieds de page"</b></span>
    </div>
  </div>
  <button class="hint-badge" onclick="document.getElementById('printHint').style.display='none'">✕ Fermer</button>
</div>

${shouldShowCover ? `
<div class="cover">
  <div class="cover-frame">
    <div class="cover-logo">L'CONQ</div>
    <div class="cover-subtitle">Guide de Maîtrise · Prépa Concours Maroc</div>
    <div class="cover-divider"></div>
    
    <div class="cover-header-group">
      <div class="cover-tag">Domaine</div>
      <div class="cover-topic">${topic}</div>
      <div class="cover-desc">Toutes les questions · Toutes les astuces · Toutes les techniques d'élimination rapide</div>
    </div>
    
    <div class="cover-stats">
      <div class="cover-stat">
        <div class="num">${total}</div>
        <div class="lbl">Questions</div>
      </div>
      <div class="cover-stat">
        <div class="num">${sources.length}</div>
        <div class="lbl">Concours</div>
      </div>
      <div class="cover-stat">
        <div class="num">100%</div>
        <div class="lbl">Corrigées</div>
      </div>
    </div>
    
    <div class="cover-sources">
      <strong>Sources :</strong> ${sources.join(' · ')}
    </div>

    <div class="cover-prof">
      ${profName ? `Préparé par : <strong>${profName}</strong>${profPhone ? ' · ' + profPhone : ''}` : `<strong>${siteUrl}</strong>`}
    </div>
  </div>
</div>` : ''}

<div class="content">
  ${compactHeaderHtml}
  <div class="section-hdr">📚 ${total} questions — ${topic}</div>
  ${cardsHtml}
</div>

<script>
async function printWhenReady() {
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 1000));
  var hint = document.getElementById('printHint');
  if (hint) hint.style.display = 'none';
  window.print();
  if (hint) hint.style.display = 'flex';
}
printWhenReady();
</script>
</body></html>`;
};

export const generateStudentReportHTML = (exam, score, corrected, settings = {}) => {
  const pdfConf = getPdfSettings(settings);
  const fontFamilyCSS = getFontFamilyStyle(pdfConf.fontFamily);
  const {
    profSite = 'www.lconq.ma',
  } = settings;

  const total = corrected.length;
  let correctCount = 0;
  let wrongCount = 0;
  
  corrected.forEach(row => {
    if (row.result === 'correct') correctCount++;
    else if (row.result === 'wrong') wrongCount++;
  });

  const successRate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const grade20 = total > 0 ? ((score.pts / total) * 20) : 0;
  
  // Format Date
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const half = Math.ceil(corrected.length / 2);
  const leftCol = corrected.slice(0, half);
  const rightCol = corrected.slice(half);

  const renderTable = (rows) => {
    return `
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 15%; text-align: center;">N°</th>
            <th style="width: 40%;">Sujet</th>
            <th style="width: 15%; text-align: center;">Rép.</th>
            <th style="width: 15%; text-align: center;">Corr.</th>
            <th style="width: 15%; text-align: center;">Statut</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => {
            let statusClass = 'status-empty';
            let statusText = 'Vide';
            if (row.result === 'correct') {
              statusClass = 'status-correct';
              statusText = 'Ok';
            } else if (row.result === 'wrong') {
              statusClass = 'status-wrong';
              statusText = 'Faux';
            }
            return `
              <tr>
                <td style="font-weight:bold; text-align:center; font-size: 8pt;">Q${row.q}</td>
                <td style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px; font-size: 8pt;">${row.topic}</td>
                <td style="text-align:center; font-weight:bold; font-size: 8.5pt; color:${row.result === 'correct' ? '#059669' : '#dc2626'}">${row.detected || '—'}</td>
                <td style="text-align:center; font-weight:bold; font-size: 8.5pt; color:#059669">${row.correct}</td>
                <td style="text-align:center;"><span class="status-badge ${statusClass}">${statusText}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  };

  const tablesHtml = corrected.length <= 15
    ? renderTable(corrected)
    : `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>${renderTable(leftCol)}</div>
        <div>${renderTable(rightCol)}</div>
      </div>
    `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Rapport de Performance OMR - ${exam.name}</title>
${getFontImportLinks()}
<style>
html { font-size: 9.5pt; }
body {
  font-family: ${fontFamilyCSS};
  margin: 0;
  padding: 0;
  background-color: #fff;
  color: #0f172a;
  line-height: 1.4;
}
.page {
  padding: 10mm 15mm;
  box-sizing: border-box;
  min-height: 297mm;
  max-height: 297mm;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.cover-frame {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px 22px;
  background-color: #f8fafc;
  margin-bottom: 12px;
}
.report-title {
  font-size: 18pt;
  font-weight: 800;
  text-align: center;
  margin: 0 0 4px 0;
  color: #0f172a;
  letter-spacing: -0.01em;
}
.report-subtitle {
  font-size: 9.5pt;
  text-align: center;
  color: #64748b;
  margin: 0 0 15px 0;
  font-weight: 500;
}
.score-box {
  display: flex;
  justify-content: center;
  align-items: center;
}
.score-circle {
  border: 3px double #4f46e5;
  border-radius: 50%;
  width: 90px;
  height: 90px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.08);
}
.score-val {
  font-size: 20pt;
  font-weight: 900;
  color: #4f46e5;
  line-height: 1;
}
.score-lbl {
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-top: 2px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}
.stat-card {
  border: 1px solid #e2e8f0;
  padding: 8px;
  text-align: center;
  border-radius: 8px;
  background: #ffffff;
}
.stat-num {
  font-size: 13pt;
  font-weight: 800;
  color: #0f172a;
}
.stat-lbl {
  font-size: 7pt;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-top: 1px;
}
.section-title {
  font-size: 11pt;
  font-weight: 800;
  border-bottom: 1.5px solid #0f172a;
  padding-bottom: 3px;
  margin: 15px 0 10px 0;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.report-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}
.report-table th, .report-table td {
  border: 1px solid #e2e8f0;
  padding: 4px 8px;
  text-align: left;
  font-size: 8.5pt;
}
.report-table th {
  background-color: #f8fafc;
  font-weight: 700;
  color: #334155;
}
.status-badge {
  padding: 1.5px 5px;
  border-radius: 4px;
  font-size: 7pt;
  font-weight: 800;
  text-transform: uppercase;
  display: inline-block;
}
.status-correct { background-color: #d1fae5; color: #065f46; border: 1px solid #10b981; }
.status-wrong { background-color: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
.status-empty { background-color: #f1f5f9; color: #475569; border: 1px solid #94a3b8; }

.print-hint {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.print-hint-msg { display: flex; gap: 8px; align-items: center; }
.print-hint-icon { font-size: 16px; }
.print-hint-text { font-size: 8.5pt; color: #166534; }
.hint-badge {
  background: none;
  border: none;
  font-weight: bold;
  cursor: pointer;
  color: #166534;
}
.report-footer {
  text-align: center;
  font-size: 7.5pt;
  color: #94a3b8;
  border-top: 1px solid #e2e8f0;
  padding-top: 10px;
  margin-top: auto;
}

@media print {
  ${pdfConf.forcePrintColors ? `
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  ` : ''}
  body { background-color: #fff; }
  .print-hint { display: none !important; }
}
</style>
</head>
<body>

<div class="page">
  <div>
    <div class="print-hint" id="printHint">
      <div class="print-hint-msg">
        <span class="print-hint-icon">🖨️</span>
        <div class="print-hint-text">
          <strong>Conseil d'impression :</strong> Décochez les en-têtes/pieds de page dans les options d'impression du navigateur.
        </div>
      </div>
      <button class="hint-badge" onclick="document.getElementById('printHint').style.display='none'">✕ Fermer</button>
    </div>

    <div class="cover-frame">
      <h1 class="report-title">RAPPORT DE PERFORMANCE</h1>
      <div class="report-subtitle">Analyse Personnalisée — Correction de Feuille OMR</div>
      
      <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px;">
        <div>
          <p style="margin: 0 0 4px 0; font-size: 9.5pt;"><strong>Examen :</strong> ${exam.name}</p>
          <p style="margin: 0 0 4px 0; font-size: 9.5pt;"><strong>Établissement / Concours :</strong> ${exam.school}${exam.year ? ` (${exam.year})` : ''}</p>
          <p style="margin: 0; font-size: 9.5pt;"><strong>Date de l'analyse :</strong> ${dateStr}</p>
        </div>
        <div class="score-box" style="margin: 0;">
          <div class="score-circle">
            <span class="score-val">${grade20.toFixed(2)}</span>
            <span class="score-lbl">Note / 20</span>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-num">${total}</div>
          <div class="stat-lbl">Questions</div>
        </div>
        <div class="stat-card" style="border-color: #10b981;">
          <div class="stat-num" style="color: #10b981;">${correctCount}</div>
          <div class="stat-lbl">Correctes</div>
        </div>
        <div class="stat-card" style="border-color: #ef4444;">
          <div class="stat-num" style="color: #ef4444;">${wrongCount}</div>
          <div class="stat-lbl">Fausses</div>
        </div>
        <div class="stat-card" style="border-color: #f59e0b;">
          <div class="stat-num" style="color: #f59e0b;">${successRate}%</div>
          <div class="stat-lbl">Réussite</div>
        </div>
      </div>
    </div>

    <div class="section-title">📋 Synthèse des Réponses</div>
    ${tablesHtml}
  </div>

  <div class="report-footer">
    Généré automatiquement par L'CONQ — Plateforme de Préparation aux Concours d'Excellence
    ${profSite ? `<br><strong>${profSite}</strong>` : ''}
  </div>
</div>

<script>
async function printWhenReady() {
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 600));
  var hint = document.getElementById('printHint');
  if (hint) hint.style.display = 'none';
  window.print();
  if (hint) hint.style.display = 'flex';
}
printWhenReady();
</script>
</body>
</html>`;
};

export const openPrintWindow = (html, title, targetWindow) => {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
  
  if (isMobile) {
    // Close target window if it was opened pre-emptively on mobile
    if (targetWindow) {
      try { targetWindow.close(); } catch { /* ignore */ }
    }
    // Download document directly (same method as Grille) to avoid popup blockers and browser bugs
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'document'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  
  if (targetWindow) {
    try {
      targetWindow.document.open();
      targetWindow.document.write(html);
      targetWindow.document.close();
    } catch (err) {
      console.error('Error writing to print window:', err);
      // Fallback: redirect if writing fails
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      targetWindow.location.href = url;
    }
  } else {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank', 'width=960,height=720,scrollbars=yes');
    if (!win) {
      URL.revokeObjectURL(url);
      alert('Veuillez autoriser les popups pour ce site.');
      return;
    }
    win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  }
};

export const generateCompilationEbookHTML = (config, examsData, settings = {}) => {
  const pdfConf = getPdfSettings(settings);
  const fontFamilyCSS = getFontFamilyStyle(pdfConf.fontFamily);
  const fontSizeCSS = pdfConf.fontSize;
  const pageMargin = pdfConf.pageMargins === 'compact' ? '10mm' : pdfConf.pageMargins === 'wide' ? '25mm' : '15mm';
  const pageHeightMM = pdfConf.pageMargins === 'compact' ? 277 : pdfConf.pageMargins === 'wide' ? 247 : 267;

  const {
    title = "CONCOURS D'ACCÈS AUX GRANDES ÉCOLES",
    subtitle = "ARCHIVES & CORRECTIONS DÉTAILLÉES",
    selectedSchools = [],
    selectedExams = {}, // { schoolName: [examId1, examId2, ...] }
    schoolOrder = [],
    includeCover = true,
    includeTOC = true,
    includeSubject = true,
    includeOMR = true,
    includeCorrection = true,
    showTricks = true,
    profName = '',
    profPhone = '',
    profSite = 'www.lconq.ma',
  } = config;

  const siteUrl = profSite || 'www.lconq.ma';
  const copyrightLine = profName
    ? `© ${new Date().getFullYear()} L'CONQ × ${profName}. Tous droits réservés.`
    : `© ${new Date().getFullYear()} L'CONQ. Tous droits réservés.`;

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  // Helper for rendering blank OMR grid
  const renderBlankOMRGrid = (questionsCount) => {
    const pHalf = Math.ceil(questionsCount / 2);
    const pOpts = ['A', 'B', 'C', 'D', 'E'];

    let premiumOmrHtml = '';
    
    // Column 1
    premiumOmrHtml += '<div class="omr-column col-1">';
    premiumOmrHtml += `
      <div class="omr-col-header">
        <span class="row-num">N°</span>
        <div style="display:flex; justify-content:space-between; flex-grow:1; padding-left:10px;">
          ${pOpts.map(o => `<span style="width:20px; text-align:center;">${o}</span>`).join('')}
        </div>
      </div>
    `;
    for (let i = 0; i < pHalf; i++) {
      const isAlt = i % 2 === 0 ? ' alt' : '';
      const qNum = String(i + 1).padStart(2, '0');
      const bubblesHtml = pOpts.map(o => `<div class="omr-bubble">${o}</div>`).join('');
      premiumOmrHtml += `
        <div class="omr-row${isAlt}">
          <span class="row-num">${qNum}</span>
          <div style="display:flex; justify-content:space-between; flex-grow:1; padding-left:10px;">
            ${bubblesHtml}
          </div>
        </div>
      `;
    }
    premiumOmrHtml += '</div>';

    // Column 2
    premiumOmrHtml += '<div class="omr-column col-2">';
    premiumOmrHtml += `
      <div class="omr-col-header">
        <span class="row-num">N°</span>
        <div style="display:flex; justify-content:space-between; flex-grow:1; padding-left:10px;">
          ${pOpts.map(o => `<span style="width:20px; text-align:center;">${o}</span>`).join('')}
        </div>
      </div>
    `;
    for (let i = pHalf; i < questionsCount; i++) {
      const isAlt = i % 2 === 0 ? ' alt' : '';
      const qNum = String(i + 1).padStart(2, '0');
      const bubblesHtml = pOpts.map(o => `<div class="omr-bubble">${o}</div>`).join('');
      premiumOmrHtml += `
        <div class="omr-row${isAlt}">
          <span class="row-num">${qNum}</span>
          <div style="display:flex; justify-content:space-between; flex-grow:1; padding-left:10px;">
            ${bubblesHtml}
          </div>
        </div>
      `;
    }
    premiumOmrHtml += '</div>';
    return premiumOmrHtml;
  };

  const renderSubjectQuestions = (questions) => {
    return questions.map((q, idx) => {
      const num = idx + 1;
      const optionsHtml = (q.options || []).map((opt, oi) => {
        const letter = LETTERS[oi] || String(oi + 1);
        return `<div class="ws-opt">
          <span class="ws-opt-letter">${letter}</span>
          <span class="ws-opt-text">${renderMath(optText(opt))}</span>
        </div>`;
      }).join('');

      return `
      <div class="ws-exercise" style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #ffffff;">
        <div class="ws-ex-header" style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
          <div class="ws-ex-pill" style="display:flex; align-items:center; background:#f1f5f9; border-radius:4px; padding:2px 8px;">
            <span class="ws-ex-pill-label" style="font-size:0.75rem; font-weight:600; color:#64748b; margin-right:4px;">Question N°</span>
            <span class="ws-ex-num" style="font-size:0.8rem; font-weight:800; color:#0f172a;">${num}</span>
          </div>
          <span class="ws-ans-tag" style="font-size:0.75rem; font-weight:700; color:#1e3a8a; background:#dbeafe; padding:2px 6px; border-radius:4px; text-transform:uppercase;">${(q.subject || q.topic || 'Général').toUpperCase()}</span>
        </div>
        <div class="ws-ex-body">
          ${q.context ? `<div class="ctx-box" style="margin-bottom: 8px; font-size:0.95rem; color:#475569; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px;">📋 ${renderMath(q.context)} ${renderQuestionImageHTML(q, 'context')}</div>` : ''}
          ${renderQuestionImageHTML(q, 'above')}
          <div class="ws-qtext" style="font-size:0.95rem; font-weight:500; color:#1e293b; margin-bottom:12px;">${renderQuestionImageHTML(q, 'side')}${renderMath(q.question || '')}</div>
          ${renderQuestionImageHTML(q, 'below')}
          <div class="ws-opts ${getOptionsLayoutClass(q.options)}" style="display:grid; gap:8px;">${optionsHtml}</div>
          ${renderQuestionImageHTML(q, 'options')}
        </div>
      </div>`;
    }).join('');
  };

  const renderCorrectionQuestions = (questions, showTricks) => {
    return questions.map((q, idx) => {
      const num = idx + 1;
      const optionsHtml = (q.options || []).map((opt, oi) => {
        const letter = LETTERS[oi] || String(oi + 1);
        const isCorrect = q.correct_answer === letter;
        return `<div class="opt${isCorrect ? ' correct-opt' : ''}">
          <span class="opt-badge${isCorrect ? ' correct-badge' : ''}">${letter}</span>
          <span class="opt-text">${renderMath(optText(opt))}</span>
          ${isCorrect ? '<span class="correct-check">✓ Correcte</span>' : ''}
        </div>`;
      }).join('');

      return `
      <div class="qcard" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #ffffff;">
        <div class="qheader" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span class="qnum" style="background:#0f172a; color:#fff; padding:2px 8px; border-radius:4px; font-weight:800;">Q${num}</span>
          <span class="ans-badge" style="background:#f1f5f9; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:700;">Réponse : ${q.correct_answer || '?'}</span>
        </div>
        ${renderQuestionImageHTML(q, 'above')}
        <div class="qtext" style="font-size:0.95rem; font-weight:500; color:#1e293b; margin-bottom:12px;">${renderQuestionImageHTML(q, 'side')}${renderMath(q.question || '')}</div>
        ${renderQuestionImageHTML(q, 'below')}
        <div class="opts ${getOptionsLayoutClass(q.options)}">${optionsHtml}</div>
        ${renderQuestionImageHTML(q, 'options')}
        ${q.astuce ? `<div class="rule-box" style="margin-top:12px; padding:10px; border-left:4px solid #10b981; background:#f0fdf4; border-radius:4px;">
          <div class="rule-title" style="font-size:0.75rem; font-weight:800; color:#065f46; margin-bottom:4px;">⭐ RÈGLE DE L'ART</div>
          <div class="rule-body" style="font-size:0.85rem;">
            ${renderMath(q.astuce)}
            ${renderQuestionImageHTML(q, 'correction')}
          </div>
        </div>` : ''}
        ${showTricks && q.trick ? `<div class="trick-box" style="margin-top:8px; padding:10px; border-left:4px solid #f59e0b; background:#fffbeb; border-radius:4px;">
          <div class="trick-title" style="font-size:0.75rem; font-weight:800; color:#b45309; margin-bottom:4px;">⚡ COUP DE GRÂCE</div>
          <div class="trick-body" style="font-size:0.85rem;">${renderMath(q.trick)}</div>
        </div>` : ''}
      </div>`;
    }).join('');
  };

  let bookHtml = '';

  // ── Pre-compute page numbers for TOC ──
  // Each fixed page (cover, TOC, exam cover, OMR) = 1 page
  // Subject/correction sections: estimate based on question count
  const QUESTIONS_PER_PAGE_SUBJECT = 3;   // approx questions per page in subject
  const QUESTIONS_PER_PAGE_CORRECTION = 2; // approx questions per page in correction (with tips)
  const pageMap = {}; // { sectionId: pageNumber }
  let currentPage = 0;
  if (includeCover) currentPage++;
  if (includeTOC) currentPage++;

  schoolOrder.forEach(school => {
    const schoolExams = selectedExams[school] || [];
    schoolExams.forEach(examId => {
      const exam = examsData.find(e => e.id === examId);
      if (!exam) return;
      const qCount = (exam.questions || []).length || 20;
      // Exam cover page
      currentPage++;
      pageMap[`exam-${examId}-cover`] = currentPage;
      // Subject
      if (includeSubject) {
        currentPage++;
        pageMap[`exam-${examId}-subject`] = currentPage;
        currentPage += Math.max(0, Math.ceil(qCount / QUESTIONS_PER_PAGE_SUBJECT) - 1);
      }
      // OMR
      if (includeOMR) {
        currentPage++;
        pageMap[`exam-${examId}-omr`] = currentPage;
      }
      // Correction
      if (includeCorrection) {
        currentPage++;
        pageMap[`exam-${examId}-correction`] = currentPage;
        currentPage += Math.max(0, Math.ceil(qCount / QUESTIONS_PER_PAGE_CORRECTION) - 1);
      }
    });
  });
  const totalPages = currentPage;


  // 1. Cover Page
  if (includeCover) {
    bookHtml += `
    <div class="book-cover-container print-page" id="book-main-cover">
      <div class="book-cover-border">
        <div class="book-cover-header" style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 4mm;">
          <h2 style="font-family:'Inter', sans-serif; font-size:2.2rem; font-weight:900; letter-spacing:6px; color:#0f172a; margin-bottom:1mm;">L'CONQ</h2>
          <div style="font-family:'Inter', sans-serif; font-size:0.8rem; font-weight:700; color:#b89047; letter-spacing:4px;">EXCELLENCE &amp; PERFORMANCE</div>
        </div>
        
        <div class="book-cover-body" style="text-align: center; margin: 15mm 0; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <div style="font-family:'Inter', sans-serif; font-size:0.95rem; font-weight:800; color:#b89047; letter-spacing:3px; text-transform:uppercase; margin-bottom:6mm; background:rgba(184,144,71,0.08); border:1px solid rgba(184,144,71,0.2); padding:4px 16px; border-radius:99px;">LIVRE COMPILATION</div>
          <h1 style="font-family:'Plus Jakarta Sans', sans-serif; font-size:2.4rem; font-weight:900; color:#0f172a; line-height:1.2; margin-bottom:4mm; max-width:90%;">${title.toUpperCase()}</h1>
          <p style="font-family:'Inter', sans-serif; font-size:1.1rem; color:#475569; max-width:80%; margin-bottom:8mm;">${subtitle}</p>
          
          <div style="width: 60px; height: 3px; background: #b89047; border-radius: 2px; margin-bottom: 8mm;"></div>
          
          <div style="font-family:'Inter', sans-serif; font-size:0.85rem; font-weight:700; color:#64748b; margin-bottom:4mm; text-transform:uppercase; letter-spacing:1px;">Établissements &amp; Concours Inclus</div>
          <div class="school-list" style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 85%;">
            ${selectedSchools.map(sch => `<span style="background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 12px; font-size: 0.8rem; font-weight: 700; font-family:'Inter', sans-serif;">${sch}</span>`).join('')}
          </div>
        </div>
        
        <div class="book-cover-footer" style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6mm;">
          <div style="font-family:'Inter', sans-serif; font-size:0.9rem; color:#334155; margin-bottom:2mm;">
            ${profName ? `Préparé par : <strong>${profName}</strong>${profPhone ? ' · ' + profPhone : ''}` : `<strong>${siteUrl}</strong>`}
          </div>
          <div style="font-family:'Inter', sans-serif; font-size:0.75rem; color:#94a3b8;">
            ${copyrightLine}
          </div>
        </div>
      </div>
      <div id="page-1-end" style="position:absolute;bottom:0;width:1px;height:1px"></div>
    </div>
    `;
  }

  // 2. Table of Contents
  if (includeTOC) {
    bookHtml += `
    <div class="toc-page-container print-page" id="book-toc">
      <div class="toc-border">
        <h2 class="toc-title">TABLE DES MATIÈRES</h2>
        <div class="toc-divider"></div>
        
        <div class="toc-list">
          ${schoolOrder.map(school => {
            const schoolExamsList = selectedExams[school] || [];
            if (schoolExamsList.length === 0) return '';
            
            const examItemsHtml = schoolExamsList.map(examId => {
              const exam = examsData.find(e => e.id === examId);
              if (!exam) return '';
              
              const parts = [];
              if (includeSubject) {
                parts.push(`
                  <div class="toc-sub-item toc-item" data-target="exam-${exam.id}-subject">
                    <span class="toc-sub-label">Sujet de l'épreuve</span>
                    <span class="toc-dots"></span>
                    <span class="toc-page-num">${pageMap[`exam-${exam.id}-subject`] || '—'}</span>
                  </div>
                `);
              }
              if (includeOMR) {
                parts.push(`
                  <div class="toc-sub-item toc-item" data-target="exam-${exam.id}-omr">
                    <span class="toc-sub-label">Grille de réponses OMR</span>
                    <span class="toc-dots"></span>
                    <span class="toc-page-num">${pageMap[`exam-${exam.id}-omr`] || '—'}</span>
                  </div>
                `);
              }
              if (includeCorrection) {
                parts.push(`
                  <div class="toc-sub-item toc-item" data-target="exam-${exam.id}-correction">
                    <span class="toc-sub-label">Correction détaillée &amp; Solutions</span>
                    <span class="toc-dots"></span>
                    <span class="toc-page-num">${pageMap[`exam-${exam.id}-correction`] || '—'}</span>
                  </div>
                `);
              }
              
              return `
                <div class="toc-exam-item">
                  <div class="toc-exam-header">${exam.name}${exam.year ? ` — ${exam.year}` : ''}</div>
                  ${parts.join('')}
                </div>
              `;
            }).join('');
            
            return `
              <div class="toc-section">
                <div class="toc-part-title">${school.toUpperCase()}</div>
                ${examItemsHtml}
              </div>
            `;
          }).join('')}
        </div>
        
        <div style="font-family:'Inter', sans-serif; font-size:7.5pt; text-align:center; color:#94a3b8; margin-top:auto;">
          Généré le ${new Date().toLocaleDateString('fr-MA')} · ${siteUrl}
        </div>
      </div>
      <div id="page-2-end" style="position:absolute;bottom:0;width:1px;height:1px"></div>
    </div>
    `;
  }

  // 3. Exams
  schoolOrder.forEach(school => {
    const schoolExams = selectedExams[school] || [];
    schoolExams.forEach(examId => {
      const exam = examsData.find(e => e.id === examId);
      if (!exam) return;

      // A: Exam Divider / Cover Page
      bookHtml += `
      <div class="exam-cover-container print-page toc-anchor" id="exam-${exam.id}-cover" style="page-break-after: always; break-after: page; height: ${pageHeightMM}mm; padding:0; box-sizing:border-box; background:#ffffff;">
        <div class="exam-cover-border" style="border: 2px solid #0f172a; outline: 1px solid #b89047; outline-offset: -5px; padding: 15mm 10mm; height: 100%; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
          <div class="exam-cover-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            <span style="font-family:'Inter', sans-serif; font-size:1.2rem; font-weight:900; letter-spacing:2px; color:#0f172a;">L'CONQ</span>
            ${exam.year ? `<span style="font-family:'Inter', sans-serif; font-size:0.75rem; font-weight:800; color:#b89047; letter-spacing:1px;">SESSION ${exam.year}</span>` : ''}
          </div>
          
          <div class="exam-cover-body" style="flex-grow:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; margin:10mm 0;">
            <span style="font-family:'Inter', sans-serif; font-size:0.95rem; font-weight:800; color:#b89047; letter-spacing:3px; text-transform:uppercase; margin-bottom:4px;">ANNALE OFFICIELLE</span>
            <div style="font-family:'Plus Jakarta Sans', sans-serif; font-size:1.8rem; font-weight:800; color:#0f172a; line-height:1.3; margin-bottom:4px;">${exam.name.toUpperCase()}</div>
            <div style="font-family:'Inter', sans-serif; font-size:0.9rem; color:#64748b;">${exam.school}${exam.year ? ` — ${exam.year}` : ''}</div>
            
            <div style="width: 40px; height: 2px; background: #b89047; margin: 8mm auto;"></div>
            
            <div style="font-family:'Inter', sans-serif; font-size:0.8rem; color:#475569; max-width:70%;">
              Ce fascicule contient le sujet officiel de l'épreuve, une grille de réponses OMR vierge pour l'entraînement, ainsi que la correction détaillée et les astuces de résolution.
            </div>
          </div>
          
          <div class="exam-cover-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:4px; font-family:'Inter', sans-serif; font-size:0.75rem; color:#64748b;">
            <span>${profName || siteUrl}</span>
            <span>Examen Blanc National</span>
          </div>
        </div>
      </div>
      `;

      // B: Subject Section
      if (includeSubject) {
        bookHtml += `
        <div class="subject-section toc-anchor" id="exam-${exam.id}-subject" style="page-break-after: always; break-after: page; padding: 0; box-sizing: border-box;">
          <h2 style="font-family:'Plus Jakarta Sans', sans-serif; font-size:1.4rem; font-weight:800; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 8mm; display:flex; justify-content:space-between; align-items:center;">
            <span>SUJET OFFICIEL — ${exam.name.toUpperCase()}</span>
            <span style="font-size:0.75rem; background:#f1f5f9; padding:3px 10px; border-radius:4px; font-weight:700; color:#475569;">ÉPREUVE BLANCHE</span>
          </h2>
          <div class="questions-list">
            ${renderSubjectQuestions(exam.questions || [])}
          </div>
        </div>
        `;
      }

      // C: Blank OMR Grid Section
      if (includeOMR) {
        bookHtml += `
        <div class="omr-page-container print-page toc-anchor" id="exam-${exam.id}-omr" style="height: ${pageHeightMM}mm; padding: 0; box-sizing: border-box;">
          <div class="omr-border">
            <div class="omr-header">
              <div class="omr-logo" style="font-family:'Inter', sans-serif; font-weight:900; color:#0f172a;">L'CONQ</div>
              <div class="omr-title" style="font-family:'Plus Jakarta Sans', sans-serif; font-size:0.85rem; font-weight:800; text-align:center;">
                GRILLE OMR — ${exam.name.toUpperCase()}
              </div>
              <div class="omr-barcode"></div>
            </div>
            <div class="omr-instructions">
              <strong>Instructions :</strong> Remplissez complètement la bulle correspondante à votre réponse au stylo noir ou bleu foncé.
            </div>
            <div class="omr-grid-container">
              ${renderBlankOMRGrid(exam.questions?.length || 0)}
            </div>
            <div class="omr-footer" style="font-family:'Inter', sans-serif;">
              <span>Examen Blanc National — L'CONQ</span>
              <span>Propulsé par la technologie OMR Scanner L'CONQ</span>
            </div>
          </div>
        </div>
        `;
      }

      // D: Detailed Correction Section
      if (includeCorrection) {
        bookHtml += `
        <div class="correction-section toc-anchor" id="exam-${exam.id}-correction" style="page-break-after: always; break-after: page; padding: 0; box-sizing: border-box;">
          <h2 style="font-family:'Plus Jakarta Sans', sans-serif; font-size:1.4rem; font-weight:800; border-bottom: 2px solid #b89047; padding-bottom: 4px; margin-bottom: 8mm; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#b89047;">CORRIGÉ DÉTAILLÉ &amp; RÉSOLUTIONS</span>
            <span style="font-size:0.75rem; background:#fffbeb; border:1px solid #fef3c7; padding:3px 10px; border-radius:4px; font-weight:700; color:#d97706;">RESOLUTIONS RAPIDES</span>
          </h2>
          <div class="corrections-list">
            ${renderCorrectionQuestions(exam.questions || [], showTricks)}
          </div>
        </div>
        `;
      }
    });
  });

  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
${getFontImportLinks()}
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: ${fontFamilyCSS};
  background: #ffffff;
  color: #0f172a;
  font-size: ${fontSizeCSS};
  line-height: 1.6;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
@page {
  size: A4;
  margin: 0 0 10mm 0;
  @bottom-center {
    content: counter(page) " / ${totalPages}";
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    font-weight: 600;
    color: #64748b;
  }
}
@page :first {
  @bottom-center { content: none; }
}
@media print {
  .print-page {
    height: ${pageHeightMM}mm;
    margin: 0;
    padding: 0;
  }
  .subject-section, .correction-section {
    page-break-after: always;
    break-after: page;
  }
}
.print-page {
  box-sizing: border-box;
  width: 100%;
  height: ${pageHeightMM}mm;
  position: relative;
  background: #ffffff;
  page-break-after: always;
  break-after: page;
}

/* --- cover styling --- */
.book-cover-container {
  box-sizing: border-box;
  width: 100%;
  height: ${pageHeightMM}mm;
  padding: 0;
  background: #ffffff;
}
.book-cover-border {
  border: 2px solid #0f172a;
  outline: 1px solid #b89047;
  outline-offset: -5px;
  padding: 20mm 15mm;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
}

/* --- toc styling --- */
.toc-page-container {
  box-sizing: border-box;
  width: 100%;
  height: ${pageHeightMM}mm;
  padding: 0;
  background: #ffffff;
}
.toc-border {
  border: 2px solid #0f172a;
  outline: 1px solid #b89047;
  outline-offset: -5px;
  padding: 15mm 15mm;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.toc-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1.6rem;
  font-weight: 800;
  text-align: center;
  color: #0f172a;
  letter-spacing: 2px;
}
.toc-divider {
  width: 60px;
  height: 3px;
  background: #b89047;
  margin: 4mm auto 10mm;
}
.toc-list {
  display: flex;
  flex-direction: column;
  gap: 6mm;
}
.toc-part-title {
  font-family: 'Inter', sans-serif;
  font-size: 0.95rem;
  font-weight: 800;
  color: #1e3a8a;
  border-bottom: 2px solid #1e3a8a;
  padding-bottom: 2px;
  margin-bottom: 4mm;
  letter-spacing: 1px;
}
.toc-exam-item {
  margin-bottom: 4mm;
  padding-left: 2mm;
}
.toc-exam-header {
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 2mm;
}
.toc-sub-item {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  margin-bottom: 1.5mm;
  padding-left: 4mm;
  color: #64748b;
}
.toc-sub-label {
  flex-shrink: 0;
}
.toc-dots {
  flex-grow: 1;
  border-bottom: 1px dashed #cbd5e1;
  margin: 0 4px;
  position: relative;
  top: -3px;
}
.toc-page-num {
  font-weight: 700;
  color: #0f172a;
  width: 24px;
  text-align: right;
}

/* --- omr styling --- */
.omr-page-container {
  box-sizing: border-box;
  width: 100%;
  height: ${pageHeightMM}mm;
  padding: 0;
  background: #ffffff;
}
.omr-border {
  border: 2px solid #000000;
  padding: 8mm;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
}
.omr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #000;
  padding-bottom: 4mm;
}
.omr-logo {
  font-size: 1.4rem;
  font-weight: 900;
  letter-spacing: 1px;
  color: #000;
}
.omr-title {
  text-align: center;
  font-family: 'Inter', sans-serif;
}
.omr-title-main {
  font-size: 0.9rem;
  font-weight: 800;
  color: #000;
}
.omr-title-sub {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
  margin: 1mm 0 0 0;
}
.omr-barcode {
  width: 100px;
  height: 25px;
  background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 6px);
}
.omr-instructions {
  font-size: 0.7rem;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  padding: 3mm;
  border-radius: 4px;
  margin: 4mm 0;
}
.omr-grid-container {
  flex-grow: 1;
  display: flex;
  justify-content: space-around;
  margin: 6mm 0;
  padding: 0 4mm;
}
.omr-column {
  width: 45%;
  display: flex;
  flex-direction: column;
}
.omr-col-header {
  display: flex;
  font-weight: 800;
  font-size: 0.75rem;
  padding-bottom: 2mm;
  border-bottom: 1px solid #000;
  margin-bottom: 2mm;
}
.omr-row {
  display: flex;
  align-items: center;
  height: 7mm;
  font-size: 0.8rem;
  border-bottom: 1px solid #f1f5f9;
}
.omr-row.alt {
  background: #f8fafc;
}
.row-num {
  font-weight: 800;
  width: 25px;
}
.omr-bubble {
  width: 5mm;
  height: 5mm;
  border: 1.5px solid #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: bold;
}
.omr-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.6rem;
  color: #64748b;
  border-top: 1px solid #cbd5e1;
  padding-top: 3mm;
}

/* --- standard question rendering overrides --- */
.ws-section {
  margin-bottom: 25px;
}
.ws-exercise {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 15px;
  background: #ffffff;
}
.ws-ex-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  align-items: center;
}
.ws-ex-pill {
  display: flex;
  align-items: center;
  background: #f1f5f9;
  border-radius: 4px;
  padding: 2px 8px;
}
.ws-ex-pill-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  margin-right: 4px;
}
.ws-ex-num {
  font-size: 0.8rem;
  font-weight: 800;
  color: #0f172a;
}
.ws-ans-tag {
  font-size: 0.7rem;
  font-weight: 700;
  color: #1e3a8a;
  background: #dbeafe;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.ws-qtext {
  font-size: 0.95rem;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 12px;
}
.ws-opts {
  display: grid;
  gap: 8px;
}
.ws-opts-1col { grid-template-columns: 1fr; }
.ws-opts-2col { grid-template-columns: 1fr 1fr; }
.ws-opts-4col { grid-template-columns: repeat(4, 1fr); }
.ws-opts-5col { grid-template-columns: repeat(5, 1fr); }

.ws-opt {
  display: flex;
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 10px;
}
.ws-opt-letter {
  background: #f1f5f9;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 800;
  margin-right: 8px;
}
.ws-opt-text {
  font-size: 0.85rem;
}

.opt {
  display: flex;
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 6px;
  font-size: 0.85rem;
}
.opt-badge {
  background: #f1f5f9;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 800;
  margin-right: 8px;
}
.correct-opt {
  background: #ecfdf5 !important;
  border-color: #10b981 !important;
  color: #065f46 !important;
}
.correct-badge {
  background: #10b981 !important;
  color: #ffffff !important;
}
.correct-check {
  margin-left: auto;
  color: #10b981;
  font-weight: bold;
}
</style>
</head>
<body>
<div id="book-content">
  ${bookHtml}
</div>

<script>
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    // Page numbers are already pre-computed in the TOC — no DOM calculation needed
    // Just trigger print
    window.print();
  }, 1500);
});
</script>
</body>
</html>`;
};

