import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { renderWithMath, SmartTableRenderer } from '../utils/mathRenderer';
import { getLevelDisplayName, normalizeLevel } from '../utils/levelHelpers';

/**
 * Formats and splits a Moroccan school level into two balanced display lines,
 * ensuring raw slugs like `pc_svt` or `2bac_pc_svt` never leak directly into the UI.
 */
const formatEbookLevelParts = (rawLevel, isArabic = false) => {
  if (!rawLevel) {
    return isArabic
      ? { line1: 'الجذع المشترك', line2: 'العلمي' }
      : { line1: 'Tronc Commun', line2: 'Scientifique' };
  }

  const trimmed = String(rawLevel).trim();
  // Resolve known raw IDs (e.g., 2bac_pc_svt, 2bac_sm, common_core_sci)
  const resolved = /^(?:common_core|1bac|2bac|tc_?|tcs|tca)/i.test(trimmed)
    ? getLevelDisplayName(normalizeLevel(trimmed), isArabic)
    : trimmed;

  if (isArabic) {
    if (resolved.includes('جدع') || resolved.includes('مشترك')) {
      if (resolved.includes('آداب') || resolved.includes('إنسان')) {
        return { line1: 'الجذع المشترك', line2: 'الآداب والعلوم الإنسانية' };
      }
      return { line1: 'الجذع المشترك', line2: 'العلمي' };
    }
    if (resolved.includes('ثانية باك') || resolved.includes('2')) {
      if (resolved.includes('رياض')) return { line1: 'الثانية باكالوريا', line2: 'العلوم الرياضية' };
      if (resolved.includes('آداب')) return { line1: 'الثانية باكالوريا', line2: 'الآداب والعلوم الإنسانية' };
      if (resolved.includes('PC') || resolved.includes('SVT')) return { line1: 'الثانية باكالوريا', line2: 'العلوم التجريبية (PC/SVT)' };
      return { line1: 'الثانية باكالوريا', line2: 'العلوم التجريبية' };
    }
    if (resolved.includes('أولى باك') || resolved.includes('1')) {
      if (resolved.includes('رياض')) return { line1: 'الأولى باكالوريا', line2: 'العلوم الرياضية' };
      if (resolved.includes('آداب')) return { line1: 'الأولى باكالوريا', line2: 'الآداب والعلوم الإنسانية' };
      return { line1: 'الأولى باكالوريا', line2: 'العلوم التجريبية' };
    }
    const words = resolved.split(/\s+/);
    if (words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      return { line1: words.slice(0, mid).join(' '), line2: words.slice(mid).join(' ') };
    }
    return { line1: resolved, line2: '' };
  }

  if (/tronc\s*commun/i.test(resolved)) {
    const rest = resolved.replace(/tronc\s*commun/i, '').replace(/^[\s\-_:]+/, '').trim();
    return { line1: 'Tronc Commun', line2: rest || 'Scientifique' };
  }

  if (/2\s*(è|e|eme|ème)?\s*(année\s*)?bac/i.test(resolved)) {
    let rest = resolved.replace(/2\s*(è|e|eme|ème)?\s*(année\s*)?bac/i, '').replace(/^[\s\-_:]+/, '').trim();
    rest = rest.replace(/pc_svt/gi, 'PC / SVT');
    if (/^sx$/i.test(rest)) rest = 'Sciences Exp.';
    if (/^sm$/i.test(rest)) rest = 'Sciences Math.';
    if (/^se$/i.test(rest)) rest = 'Sciences Éco.';
    return { line1: '2ème Année Bac', line2: rest || 'Sciences' };
  }

  if (/1\s*(è|e|ere|ère)?\s*(année\s*)?bac/i.test(resolved)) {
    let rest = resolved.replace(/1\s*(è|e|ere|ère)?\s*(année\s*)?bac/i, '').replace(/^[\s\-_:]+/, '').trim();
    rest = rest.replace(/pc_svt/gi, 'PC / SVT');
    if (/^sx$/i.test(rest)) rest = 'Sciences Exp.';
    if (/^sm$/i.test(rest)) rest = 'Sciences Math.';
    if (/^se$/i.test(rest)) rest = 'Sciences Éco.';
    return { line1: '1ère Année Bac', line2: rest || 'Sciences' };
  }

  const words = resolved.replace(/pc_svt/gi, 'PC / SVT').split(/\s+/);
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return { line1: words.slice(0, mid).join(' '), line2: words.slice(mid).join(' ') };
  }

  return { line1: resolved, line2: '' };
};

// Helper to clean raw text, protect valid LaTeX commands starting with \n, and fix broken tokens
const cleanLatex = (str) => {
  if (!str || typeof str !== 'string') return '';
  let s = str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  s = s.replace(/(\$(?:(?!\$).)*?\\begin\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\}[\s\S]*?\\end\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\})(?!\$)/g, '$1$');
  s = s.replace(/(?<![\$\\])(\\begin\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\}[\s\S]*?\\end\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\})(?!\$)/g, '$$$1$$');

  const parts = s.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) return part;

    return part
      .replace(/\\notin\b/g, '__LATEX_NOTIN__')
      .replace(/\\neq\b/g, '__LATEX_NEQ__')
      .replace(/\\ne\b/g, '__LATEX_NE__')
      .replace(/\\neg\b/g, '__LATEX_NEG__')
      .replace(/\\nabla\b/g, '__LATEX_NABLA__')
      .replace(/\\natural\b/g, '__LATEX_NATURAL__')
      .replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)([A-ZÀ-ÖØ-ß])/g, '\n $1')
      .replace(/__LATEX_NOTIN__/g, '\\notin ')
      .replace(/__LATEX_NEQ__/g, '\\neq ')
      .replace(/__LATEX_NE__/g, '\\ne ')
      .replace(/__LATEX_NEG__/g, '\\neg ')
      .replace(/__LATEX_NABLA__/g, '\\nabla ')
      .replace(/__LATEX_NATURAL__/g, '\\natural ')
      .replace(/(?<![a-zA-Z\\])otin(?=[\\\{\sA-Z0-9\(\[]|$)/g, '\\notin ')
      .replace(/\baotinN\b/g, '$a \\notin \\mathbb{N}$')
      .replace(/\ba\s*otin\s*N\b/g, '$a \\notin \\mathbb{N}$')
      .replace(/sinon\s*a\s*\n?\s*otin\s*N/gi, 'sinon $a \\notin \\mathbb{N}$')
      .replace(/[\u2115]/g, '$\\mathbb{N}$')
      .replace(/[\u211D]/g, '$\\mathbb{R}$')
      .replace(/[\u2124]/g, '$\\mathbb{Z}$')
      .replace(/[\u211A]/g, '$\\mathbb{Q}$')
      .replace(/[\u2102]/g, '$\\mathbb{C}$')
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bN\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{N}$')
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bR\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{R}$')
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bZ\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{Z}$')
      .replace(/(?<![$\w\\])(\\(?:mathbb|mathbf|mathcal|mathrm)\{[a-zA-Z0-9]+\})(?![$\w\\])/g, (_, m) => `$${m}$`)
      .replace(/(?<![$\w\\])(\\mathbb[a-zA-Z0-9])(?![$\w\\])/g, (_, m) => `$${m}$`);
  }).join('');
};

const wrapMathInArabicText = (text) => {
  if (!text || typeof text !== 'string') return '';
  if (!/[\u0600-\u06FF]/.test(text)) {
    return text;
  }

  let pass1 = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g).map((part, idx) => {
    if (idx % 2 === 1) return part;

    return part.replace(/(?<![$\w\\])([a-zA-Z\\(][a-zA-Z0-9\\_{}^+\-*\/=<>()[\]\s,.;:]*[a-zA-Z0-9\\_{}^+\-*\/=>)\]])(?![$\w\\])/g, (match) => {
      let m = match.trim();
      let trailingPunct = '';
      if (m.endsWith(':') || m.endsWith('؛') || m.endsWith('،')) {
        trailingPunct = m.slice(-1);
        m = m.slice(0, -1).trim();
      }

      const isMath = /[\\_^=+\-*\/<>]/.test(m) ||
                     /^\([a-zA-Z]\w*\)/.test(m) ||
                     /^[a-zA-Z]\w*_\w+/.test(m);

      if (isMath) {
        return ` $${m}$ ${trailingPunct}`;
      }
      return match;
    });
  }).join('');

  let pass2 = pass1.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g).map((part, idx) => {
    if (idx % 2 === 1) return part;
    return part.replace(/(?<![$\w\\])\b([a-zA-Z])\b(?![$\w\\])/g, ' $$$1$$ ');
  }).join('');

  return pass2.replace(/[ ]{2,}/g, ' ').trim();
};

const formatMathInText = (str) => {
  if (!str || typeof str !== 'string') return '';
  let s = cleanLatex(str);
  s = wrapMathInArabicText(s);
  return s;
};

/**
 * Semantic theme matching the 3-column template palette from the specification screenshot
 */
const getSectionTheme = (title = '', type = '') => {
  const t = (title || '').toLowerCase();
  const ty = (type || '').toLowerCase();

  if (ty === 'definition' || t.includes('définition') || t.includes('definition') || t.includes('notation') || t.includes('ensemble') || t.includes('vocabulaire') ||
      t.includes('تعريف') || t.includes('تعاريف') || t.includes('اصطلاح') || t.includes('مفهوم')) {
    return { bg: '#e0f2fe', border: '#005086', text: '#005086', icon: '📘' };
  }
  if (ty === 'property' || ty === 'theorem' || ty === 'corollary' || t.includes('propriété') || t.includes('propriete') || t.includes('théorème') || t.includes('theoreme') || t.includes('corollaire') || t.includes('règle') || t.includes('regle') || t.includes('critère') ||
      t.includes('خاصية') || t.includes('خاصيات') || t.includes('مبرهنة') || t.includes('مبرهنات') || t.includes('قاعدة') || t.includes('قواعد')) {
    return { bg: '#dcfce7', border: '#16a34a', text: '#15803d', icon: '📗' };
  }
  if (ty === 'example' || ty === 'exercise' || t.includes('exemple') || t.includes('application') || t.includes('exercice') || t.includes('activité') ||
      t.includes('مثال') || t.includes('أمثلة') || t.includes('تطبيق') || t.includes('تطبيقات') || t.includes('تمرين') || t.includes('تمارين') || t.includes('نشاط')) {
    return { bg: '#fef3c7', border: '#d97706', text: '#92400e', icon: '📙' };
  }
  if (ty === 'method' || t.includes('méthode') || t.includes('methode') || t.includes('comment savoir') || t.includes('démarche') ||
      t.includes('طريقة') || t.includes('طرائق') || t.includes('منهجية') || t.includes('كيفية')) {
    return { bg: '#ede9fe', border: '#7c3aed', text: '#6d28d9', icon: '💡' };
  }
  if (ty === 'remark' || t.includes('remarque') || t.includes('attention') || t.includes('note') ||
      t.includes('ملاحظة') || t.includes('ملاحظات') || t.includes('تنبيه') || t.includes('انتباه')) {
    return { bg: '#ffedd5', border: '#ea580c', text: '#c2410c', icon: '⚠️' };
  }
  return { bg: '#f1f5f9', border: '#005086', text: '#0f172a', icon: '🔷' };
};

/**
 * Parses section content lines / items into structured render blocks
 */
const parseSectionBlocks = (section) => {
  const blocks = [];

  if (section.items && Array.isArray(section.items) && section.items.length > 0) {
    section.items.forEach(it => {
      if (!it) return;

      if (typeof it === 'string') {
        blocks.push({ type: 'normal', text: it, content: it });
        return;
      }

      if (it.type === 'grid_items' || Array.isArray(it.grid_items)) {
        blocks.push({
          type: 'grid_items',
          cols: it.cols || 2,
          grid_items: it.grid_items || it.items || []
        });
        return;
      }

      if (it.type === 'table' || it.table || it.table_data) {
        blocks.push({
          type: 'table',
          table: it.table || it.table_data || it.data || it.text || it
        });
        return;
      }

      if (it.type === 'image' || it.url || it.svg_code) {
        blocks.push({
          type: 'image',
          url: it.url,
          alt: it.alt || it.description || '',
          svg_code: it.svg_code,
          width_pct: it.width_pct
        });
        return;
      }

      if (it.type === 'notation_grid') {
        blocks.push({
          type: 'notation_grid',
          notation_columns: it.notation_columns || []
        });
        return;
      }

      const text = it.text || it.content || '';
      const isHighlight = it.type === 'example' || it.type === 'highlight_box' || it.is_highlight || it.is_example || /^(exemple|exemples|مثال|أمثلة|خاصية|خاصيات)\s*:/i.test(text.trim());
      blocks.push({
        type: isHighlight ? 'highlight' : (it.type === 'bullet' ? 'bullet' : 'normal'),
        text,
        content: text
      });
    });

    const rawContent = (section.content || section.description || '').trim();
    if (rawContent) {
      const combinedItemsText = blocks.map(b => b.text || '').join(' ');
      if (rawContent.length > 30 && !combinedItemsText.includes(rawContent.slice(0, 30))) {
        blocks.unshift({ type: 'normal', text: rawContent, content: rawContent });
      }
    }

    return blocks;
  }

  const rawContent = section.content || section.description || '';
  if (!rawContent) return blocks;

  const lines = rawContent.split('\n');
  let currentNormal = [];
  let currentHighlight = [];
  let inHighlight = false;

  const flushNormal = () => {
    if (currentNormal.length > 0) {
      const t = currentNormal.join('\n');
      blocks.push({ type: 'normal', text: t, content: t });
      currentNormal = [];
    }
  };

  const flushHighlight = () => {
    if (currentHighlight.length > 0) {
      const t = currentHighlight.join('\n');
      blocks.push({ type: 'highlight', text: t, content: t });
      currentHighlight = [];
      inHighlight = false;
    }
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const isExStart = /^(exemple|exemples|propriété|propriétés|comment savoir|\d+\s+est-il|مثال|أمثلة|خاصية|خاصيات|قاعدة|قواعد|ملاحظة|ملاحظات|تطبيق|تطبيقات|تمرين|تمارين)/i.test(trimmed);

    if (isExStart) {
      flushNormal();
      inHighlight = true;
      currentHighlight.push(trimmed);
    } else if (inHighlight) {
      if (/^[•\-*]\s+[A-Z\u0600-\u06FF]/.test(trimmed) && !/^(•\s*L'entier|•\s*Exemple|•\s*مثال)/i.test(trimmed)) {
        flushHighlight();
        currentNormal.push(trimmed);
      } else {
        currentHighlight.push(trimmed);
      }
    } else {
      currentNormal.push(trimmed);
    }
  });

  flushNormal();
  flushHighlight();

  return blocks;
};

export default function EbookTemplate({
  data,
  printable = false,
  columnsCount = 3,
  showSolutions = true
}) {
  const header = data?.content?.header || data?.header || {};
  const meta = header.summary_meta || {};

  const rawSections = data?.content?.sections || data?.sections || [];
  const rawTitle = (meta.title || header.fiche_title || data?.title || "Document E-Book")
    .replace(/^(?:Résumé\s*(?:de\s*cours)?\s*\d*\s*:\s*|ملخص\s*(?:الدرس)?\s*\d*\s*:\s*|E-?Book\s*:\s*)/i, '')
    .trim() || (meta.title || header.fiche_title || data?.title || "Document E-Book");
  const cleanTitle = formatMathInText(rawTitle);

  // Detect Arabic content
  const hasArabic = (text) => /[\u0600-\u06FF]/.test(text || '');
  const isArabic = Boolean(
    data?.lang === 'ar' ||
    data?.language === 'ar' ||
    data?.content?.lang === 'ar' ||
    data?.content?.metadata?.language === 'ar' ||
    hasArabic(rawTitle) ||
    hasArabic(data?.title) ||
    (rawSections && rawSections.some(s => hasArabic(s.title) || hasArabic(s.content) || (s.items && s.items.some(it => hasArabic(typeof it === 'string' ? it : it.text)))))
  );

  const rawProf = meta.prof || header.teacher || data?.teacher || (isArabic ? 'ذ. فيصل البطخيلي' : 'Fayssal el boutkhili');
  const profClean = rawProf.replace(/^(Prof\s*:|الأستاذ\s*:|ذ\.\s*:?)\s*/i, '').trim() || rawProf;
  const academicYear = meta.academic_year || meta.year || header.year || '2025/2026';
  const subjectName = header.subject || data?.subject || (isArabic ? 'الرياضيات' : 'Mathématiques');
  const website = meta.website || header.phone || header.contact || data?.phone || '';

  const badgeText = isArabic ? 'كتاب إلكتروني • طبعة رقمية' : 'E-BOOK • ÉDITION NUMÉRIQUE';
  const exerciseCount = (rawSections || []).filter(s => s?.type === 'exercise' || /exercice|تمرين/i.test(s?.title || '')).length;

  // Format educational level reliably (no raw underscore slugs)
  const candidateLevel = meta.level_name || data?.level_name || data?.level || data?.content?.level || header.level || header.niveau;
  const isSchoolName = (str) => /lyc[ée]e|coll[èe]ge|[ée]cole|direction|acad[ée]mie/i.test(str || '');
  const rawLevel = candidateLevel || (!isSchoolName(header.prep_title) ? header.prep_title : null) || (isArabic ? 'الجذع المشترك العلمي' : 'Tronc Commun Scientifique');
  const levelParts = formatEbookLevelParts(rawLevel, isArabic);

  // QR Code generation
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    let isMounted = true;
    let payload = meta.solution_url || header.solution_url;
    if (!payload) {
      let settingsPhone = '';
      let customWaMessage = '';
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const waRaw = localStorage.getItem('whatsappSettings');
          if (waRaw) {
            const waParsed = JSON.parse(waRaw);
            settingsPhone = waParsed.phoneNumber || '';
            customWaMessage = waParsed.message || '';
          }
        } catch (_) {}
        if (!settingsPhone) settingsPhone = localStorage.getItem('profPhone') || '';
      }
      const rawTargetPhone = settingsPhone || header.phone || data?.phone || '';
      let cleanWaPhone = (rawTargetPhone || '').replace(/[^\d+]/g, '');
      if (cleanWaPhone.startsWith('0') && cleanWaPhone.length === 10) cleanWaPhone = '212' + cleanWaPhone.slice(1);
      else if (!cleanWaPhone.startsWith('+') && !cleanWaPhone.startsWith('212') && cleanWaPhone.length === 9) cleanWaPhone = '212' + cleanWaPhone;
      cleanWaPhone = cleanWaPhone.replace(/^\+/, '');

      if (cleanWaPhone) {
        const msg = customWaMessage || `Bonjour Professeur, je souhaite obtenir les solutions de l'E-Book "${rawTitle}".`;
        payload = `https://wa.me/${cleanWaPhone}?text=${encodeURIComponent(msg)}`;
      } else {
        const site = website || 'elboutkhili.jimdofree.com';
        payload = site.startsWith('http') ? site : `https://${site}`;
      }
    }
    QRCode.toDataURL(payload, {
      width: 150,
      margin: 1,
      color: { dark: '#004777', light: '#ffffff' }
    }).then(url => {
      if (isMounted) setQrUrl(url);
    }).catch(err => {
      console.warn('Ebook QR Code error:', err);
    });

    return () => { isMounted = false; };
  }, [meta.solution_url, header.solution_url, header.phone, data?.phone, website, rawTitle]);

  const effectiveCols = [1, 2, 3].includes(Number(columnsCount)) ? Number(columnsCount) : 3;

  return (
    <div
      className="ebook-template-root"
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{
        width: '100%',
        maxWidth: printable ? '100%' : '1160px',
        margin: '0 auto',
        boxSizing: 'border-box',
        fontFamily: isArabic
          ? "'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'STIX Two Text', serif"
          : "'STIX Two Text', 'Computer Modern Serif', 'Latin Modern Roman', 'Cambria', 'Times New Roman', serif",
        color: '#0f172a',
        backgroundColor: 'transparent',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}
    >
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;500;600;700;800;900&family=STIX+Two+Text:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600;1,700&display=swap" />
      <style>{`
        @font-face {
          font-family: 'UKIJ Merdane';
          src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
          font-weight: 100 900;
          font-style: normal;
          font-display: swap;
        }

        /* ══════════════════ COMPLETELY REDESIGNED E-BOOK HERO HEADER ══════════════════ */
        .eb-hero-shell {
          width: 100%;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 14px;
          border: 1.5px solid #003865;
          background: #ffffff;
          box-shadow: 0 10px 28px -8px rgba(0, 56, 101, 0.2);
          box-sizing: border-box;
        }

        .eb-hero-banner {
          position: relative;
          background: linear-gradient(125deg, #001f3f 0%, #003b66 52%, #025d97 100%);
          color: #ffffff;
          padding: 16px 22px 15px 22px;
          overflow: hidden;
        }

        .eb-hero-pattern {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.12;
        }

        .eb-hero-grid {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .eb-hero-left {
          flex: 1;
          min-width: 0;
        }

        .eb-hero-pills {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 9px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .eb-pill-ebook {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 11px;
          border-radius: 9999px;
          background: rgba(245, 158, 11, 0.18);
          border: 1px solid rgba(251, 191, 36, 0.65);
          color: #fef3c7;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .eb-pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #fbbf24;
          flex-shrink: 0;
        }

        .eb-pill-frost {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.13);
          border: 1px solid rgba(255, 255, 255, 0.24);
          color: #e0f2fe;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .eb-hero-title {
          margin: 0;
          font-size: 1.48rem;
          font-weight: 800;
          color: #ffffff;
          line-height: 1.25;
          font-family: 'STIX Two Text', 'Computer Modern Serif', 'Cambria', 'Times New Roman', serif;
          letter-spacing: -0.015em;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
        }

        .eb-hero-title .katex,
        .eb-hero-title .katex * {
          color: #ffffff !important;
        }

        .eb-hero-accent-rule {
          width: 64px;
          height: 3.5px;
          border-radius: 99px;
          background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 70%, rgba(251, 191, 36, 0.25) 100%);
          margin-top: 9px;
        }

        .eb-hero-pedestal {
          flex-shrink: 0;
          background: #ffffff;
          color: #003865;
          border-radius: 10px;
          padding: 8px 11px;
          display: flex;
          align-items: center;
          gap: 11px;
          box-shadow: 0 6px 20px rgba(0, 15, 35, 0.24);
          border: 1.5px solid rgba(255, 255, 255, 0.92);
        }

        .eb-pedestal-level {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          min-width: 112px;
        }

        .eb-niveau-label {
          font-size: 0.6rem;
          font-weight: 800;
          color: #0284c7;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 2px;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .eb-level-line1 {
          font-size: 0.92rem;
          font-weight: 900;
          color: #003865;
          line-height: 1.2;
        }

        .eb-level-line2 {
          display: inline-block;
          margin-top: 3px;
          padding: 1.5px 7px;
          border-radius: 4px;
          background: #e0f2fe;
          border: 1px solid #bae6fd;
          color: #0369a1;
          font-size: 0.72rem;
          font-weight: 800;
          line-height: 1.2;
        }

        .eb-qr-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1.5px solid #004777;
          border-radius: 6px;
          overflow: hidden;
          background: #ffffff;
        }

        .eb-qr-img {
          width: 50px;
          height: 50px;
          display: block;
          padding: 2px;
          background: #ffffff;
        }

        .eb-qr-placeholder {
          width: 50px;
          height: 50px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .eb-solution-banner {
          width: 100%;
          background: #003865;
          color: #ffffff;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.11em;
          text-align: center;
          padding: 2.5px 4px;
          line-height: 1.1;
          box-sizing: border-box;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          text-transform: uppercase;
        }

        .eb-hero-dock {
          background: #f8fafc;
          border-top: 2.5px solid #f59e0b;
          padding: 7px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          font-size: 0.78rem;
          color: #1e293b;
        }

        .eb-dock-author {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          color: #0f172a;
        }

        .eb-dock-avatar {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #003865;
          color: #fbbf24;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .eb-dock-stats {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 0.74rem;
          font-weight: 700;
          color: #475569;
        }

        .eb-dock-stat-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 6px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #003865;
        }

        /* ══════════════════ 3-COLUMN BODY (TEMPLATE FROM SCREENSHOT) ══════════════════ */
        .eb-columns-container {
          column-count: ${effectiveCols};
          column-gap: 14px;
          column-rule: ${effectiveCols > 1 ? '1.5px solid #005086' : 'none'};
          border: 1.5px solid #005086;
          border-radius: 5px;
          box-sizing: border-box;
          background: #ffffff;
          padding: 8px 10px;
          box-shadow: 0 2px 8px rgba(0, 80, 134, 0.05);
          column-fill: balance;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          font-family: 'STIX Two Text', 'Computer Modern Serif', 'Cambria', serif;
        }

        .eb-section {
          margin-bottom: 9px;
          break-inside: auto;
        }

        .eb-badge-header {
          padding: 4.5px 9px;
          font-weight: 700;
          font-size: 0.88rem;
          line-height: 1.35;
          margin-bottom: 6px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
          border-left: 3.5px solid;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          font-family: 'STIX Two Text', 'Computer Modern Serif', 'Cambria', serif;
          letter-spacing: 0.01em;
          break-inside: avoid;
          break-after: avoid;
          page-break-after: avoid;
        }

        .eb-points-badge {
          display: inline-flex;
          align-items: center;
          background: rgba(0, 80, 134, 0.08);
          color: #005086;
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 0.72rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .eb-yellow-box {
          background-color: #fffbeb;
          border: 1px solid #fde68a;
          border-left: 3.5px solid #f59e0b;
          padding: 5px 8px;
          margin: 5px 0;
          border-radius: 4px;
          font-size: 0.92rem;
          font-weight: 500;
          color: #0f172a;
          line-height: 1.5;
          box-shadow: 0 1px 3px rgba(245, 158, 11, 0.06);
          break-inside: auto;
        }

        .eb-accent-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-left: 3.5px solid #16a34a;
          padding: 3.5px 7px;
          margin: 3px 0 6px 0;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #15803d;
          line-height: 1.4;
          display: flex;
          align-items: flex-start;
          gap: 6px;
          break-inside: avoid;
        }

        .eb-solution-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-left: 3px solid #059669;
          padding: 5px 8px;
          margin: 6px 0 2px 0;
          border-radius: 4px;
          font-size: 0.86rem;
          line-height: 1.46;
          color: #064e3b;
          break-inside: auto;
        }

        .eb-solution-title {
          font-size: 0.76rem;
          font-weight: 800;
          color: #047857;
          margin-bottom: 3px;
          display: flex;
          align-items: center;
          gap: 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .eb-bullet-item {
          font-size: 0.92rem;
          line-height: 1.48;
          font-weight: 500;
          margin-bottom: 3px;
          padding-left: 4px;
          color: #0f172a;
          display: flex;
          align-items: flex-start;
          gap: 5px;
          break-inside: avoid;
        }

        .eb-bullet-dot {
          color: #005086;
          font-weight: 800;
          flex-shrink: 0;
        }

        .eb-text-line {
          font-size: 0.92rem;
          line-height: 1.48;
          font-weight: 500;
          margin-bottom: 3px;
          color: #0f172a;
          break-inside: avoid;
        }

        .eb-text-p {
          font-size: 0.92rem;
          line-height: 1.5;
          font-weight: 500;
          color: #0f172a;
          margin-bottom: 5px;
          break-inside: auto;
        }

        .eb-table-wrapper {
          margin: 5px 0;
          break-inside: avoid;
        }

        .eb-grid-container {
          width: 100%;
          margin: 4px 0;
          box-sizing: border-box;
          break-inside: avoid;
        }

        .eb-grid-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 3.5px;
          padding: 3px 6px;
          font-size: 0.84rem;
          line-height: 1.38;
          box-sizing: border-box;
          overflow-x: auto;
          word-break: break-word;
        }

        .eb-grid-header {
          background: #eff6ff !important;
          border-color: #bfdbfe !important;
          color: #1e40af !important;
          font-weight: 800 !important;
          text-align: center;
        }

        .eb-footer-bar {
          margin-top: 8px;
          padding: 4px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.72rem;
          color: #475569;
          border-top: 1px solid #cbd5e1;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .katex {
          font-size: 1.07em;
          font-family: KaTeX_Main, 'STIX Two Text', serif;
        }

        .katex-display {
          margin: 0.45em 0 !important;
        }

        /* ── RTL Support for Arabic E-Books ── */
        .ebook-template-root[dir="rtl"] {
          direction: rtl;
          text-align: right;
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'STIX Two Text', serif;
        }

        .ebook-template-root[dir="rtl"] .eb-pedestal-level {
          align-items: flex-end;
        }

        .ebook-template-root[dir="rtl"] .eb-hero-title,
        .ebook-template-root[dir="rtl"] .eb-level-line1,
        .ebook-template-root[dir="rtl"] .eb-level-line2,
        .ebook-template-root[dir="rtl"] .eb-badge-header,
        .ebook-template-root[dir="rtl"] .eb-yellow-box,
        .ebook-template-root[dir="rtl"] .eb-bullet-item,
        .ebook-template-root[dir="rtl"] .eb-text-line,
        .ebook-template-root[dir="rtl"] .eb-text-p {
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif;
        }

        .ebook-template-root[dir="rtl"] .eb-pill-ebook,
        .ebook-template-root[dir="rtl"] .eb-pill-frost,
        .ebook-template-root[dir="rtl"] .eb-niveau-label,
        .ebook-template-root[dir="rtl"] .eb-solution-banner,
        .ebook-template-root[dir="rtl"] .eb-hero-dock {
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif;
          letter-spacing: 0.01em;
        }

        .ebook-template-root[dir="rtl"] .eb-columns-container {
          direction: rtl;
          column-rule: ${effectiveCols > 1 ? '1.5px solid #005086' : 'none'};
        }

        .ebook-template-root[dir="rtl"] .eb-badge-header {
          border-left: none;
          border-right: 3.5px solid;
        }

        .ebook-template-root[dir="rtl"] .eb-yellow-box {
          border-left: 1px solid #fde68a;
          border-right: 3.5px solid #f59e0b;
        }

        .ebook-template-root[dir="rtl"] .eb-accent-box,
        .ebook-template-root[dir="rtl"] .eb-solution-box {
          border-left: 1px solid #bbf7d0;
          border-right: 3.5px solid #059669;
        }

        .ebook-template-root[dir="rtl"] .eb-bullet-item {
          padding-left: 0;
          padding-right: 4px;
        }

        .ebook-template-root[dir="rtl"] .katex {
          direction: ltr !important;
          unicode-bidi: embed !important;
          display: inline-block !important;
        }

        .ebook-template-root[dir="rtl"] .katex-display {
          direction: ltr !important;
          unicode-bidi: embed !important;
          display: block !important;
          text-align: center !important;
        }

        @media screen and (max-width: 900px) {
          .eb-hero-grid {
            flex-direction: column;
            align-items: stretch;
          }
          .eb-hero-pedestal {
            justify-content: space-between;
          }
          .eb-columns-container {
            column-count: 1 !important;
          }
        }
      `}</style>

      {/* ════════════════ COMPLETELY REDESIGNED E-BOOK HERO HEADER ════════════════ */}
      <header className="eb-hero-shell">
        <div className="eb-hero-banner">
          {/* Subtle architectural math pattern watermark */}
          <svg className="eb-hero-pattern" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <defs>
              <pattern id="eb-grid-pat" width="36" height="36" patternUnits="userSpaceOnUse">
                <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#ffffff" strokeWidth="0.6" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#eb-grid-pat)" />
            <circle cx="92%" cy="20%" r="120" fill="none" stroke="#fbbf24" strokeWidth="1.2" />
            <circle cx="92%" cy="20%" r="165" fill="none" stroke="#ffffff" strokeWidth="0.8" />
          </svg>

          <div className="eb-hero-grid">
            {/* Hero Left: Pills + Main Title + Amber Rule */}
            <div className="eb-hero-left">
              <div className="eb-hero-pills">
                <span className="eb-pill-ebook">
                  <span className="eb-pill-dot" />
                  <span>📚 {badgeText}</span>
                </span>
                <span className="eb-pill-frost">{subjectName}</span>
                <span className="eb-pill-frost">{isArabic ? `السنة ${academicYear}` : `A.S ${academicYear}`}</span>
              </div>
              <h1 className="eb-hero-title">
                {renderWithMath(cleanTitle)}
              </h1>
              <div className="eb-hero-accent-rule" />
            </div>

            {/* Hero Right: Floating White Pedestal (Level Stack + QR Solution) */}
            <div className="eb-hero-pedestal">
              <div className="eb-pedestal-level">
                <span className="eb-niveau-label">
                  {isArabic ? 'المستوى الدراسي' : 'NIVEAU'}
                </span>
                <span className="eb-level-line1">
                  {levelParts.line1}
                </span>
                {levelParts.line2 && (
                  <span className="eb-level-line2">
                    {levelParts.line2}
                  </span>
                )}
              </div>

              <div className="eb-qr-container">
                {qrUrl ? (
                  <img src={qrUrl} alt="Solution QR" className="eb-qr-img" />
                ) : (
                  <div className="eb-qr-placeholder">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#004777" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                  </div>
                )}
                <div className="eb-solution-banner">
                  {isArabic ? 'الحل' : 'SOLUTION'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sleek Amber-Topped Author & Publication Dock */}
        <div className="eb-hero-dock">
          <div className="eb-dock-author">
            <span className="eb-dock-avatar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span>
              {isArabic ? 'الأستاذ :' : 'Prof :'} <strong style={{ color: '#003865' }}>{profClean}</strong>
            </span>
          </div>

          <div className="eb-dock-stats">
            <span className="eb-dock-stat-chip">
              📑 {rawSections.length} {isArabic ? 'فقرات' : 'Sections'}
            </span>
            {exerciseCount > 0 && (
              <span className="eb-dock-stat-chip">
                📝 {exerciseCount} {isArabic ? 'تمارين' : (exerciseCount > 1 ? 'Exercices' : 'Exercice')}
              </span>
            )}
            <span className="eb-dock-stat-chip">
              📐 {effectiveCols} {isArabic ? 'أعمدة' : (effectiveCols > 1 ? 'Colonnes' : 'Colonne')}
            </span>
          </div>
        </div>
      </header>

      {/* ════════════════ 3-COLUMN CONTENT BODY (FROM SCREENSHOT TEMPLATE) ════════════════ */}
      {(() => {
        const orderedSections = [...rawSections].sort((a, b) => {
          const colA = a.column || a.col || 1;
          const colB = b.column || b.col || 1;
          return colA - colB;
        });

        const renderSectionContent = (sec, sKey) => {
          const rawSecTitle = (sec.title || '').replace(/^([•\-*]\s*)+/, '').replace(/\*\*/g, '').trim();
          const theme = getSectionTheme(rawSecTitle, sec.type);
          const blocks = parseSectionBlocks(sec);
          const hasPositivePoints = sec.points != null && sec.points !== '' && Number(sec.points) > 0;

          return (
            <div key={sKey} className="eb-section">
              {/* Themed Section Header Badge */}
              {rawSecTitle && (
                <div
                  className="eb-badge-header"
                  style={{
                    backgroundColor: theme.bg,
                    borderLeftColor: isArabic ? 'transparent' : theme.border,
                    borderRightColor: isArabic ? theme.border : 'transparent',
                    color: theme.text
                  }}
                >
                  <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{theme.icon}</span>
                  <span>{renderWithMath(rawSecTitle)}</span>
                  {hasPositivePoints && (
                    <span className="eb-points-badge" style={{ marginLeft: isArabic ? 0 : 'auto', marginRight: isArabic ? 'auto' : 0 }}>
                      ({sec.points} {isArabic ? 'ن' : 'pts'})
                    </span>
                  )}
                </div>
              )}

              {/* Accent Sub-Badge */}
              {sec.accent_text && (
                <div className="eb-accent-box">
                  <span style={{ color: '#16a34a', flexShrink: 0 }}>✦</span>
                  <span>{renderWithMath(formatMathInText(sec.accent_text))}</span>
                </div>
              )}

              {/* Section Body Blocks */}
              <div style={{ padding: '0 2px' }}>
                {(() => {
                  const isTableLine = (l) => l.trim().startsWith('|') && l.trim().endsWith('|');
                  const renderTextLines = (lines, baseKey, isBlockBullet = false) => {
                    const elements = [];
                    let tableBuffer = [];

                    const flushTable = () => {
                      if (tableBuffer.length > 0) {
                        const tbl = tableBuffer.join('\n');
                        elements.push(
                          <div key={`${baseKey}-tbl-${elements.length}`} className="eb-table-wrapper">
                            <SmartTableRenderer table={tbl} />
                          </div>
                        );
                        tableBuffer = [];
                      }
                    };

                    lines.forEach((line, lIdx) => {
                      const trimmed = line.trim();
                      if (!trimmed) return;
                      if (isTableLine(trimmed)) {
                        tableBuffer.push(trimmed);
                        return;
                      }
                      flushTable();

                      const numMatch = trimmed.match(/^([•\-*]\s*)?(\*+)?(\(?[\d\u0660-\u0669]+[.)]\)?)(\*+)?\s*(.*)$/);
                      let isBullet = false;
                      let cleanLine = trimmed;

                      if (numMatch && numMatch[3]) {
                        isBullet = false;
                        const numToken = numMatch[3];
                        const restOfText = numMatch[5] || '';
                        cleanLine = `**${numToken}** ${restOfText}`;
                      } else {
                        const hasBulletPrefix = /^([•]\s*|[-]\s+|\*(?!\*)\s+)/.test(trimmed);
                        isBullet = hasBulletPrefix || isBlockBullet;
                        cleanLine = trimmed.replace(/^([•]\s*|[-]\s+|\*(?!\*)\s+)/, '');
                      }

                      const isPureLtr = isArabic && !/[\u0600-\u06FF]/.test(cleanLine);

                      if (isBullet) {
                        elements.push(
                          <div
                            key={`${baseKey}-l-${lIdx}`}
                            className="eb-bullet-item"
                            dir={isPureLtr ? 'ltr' : undefined}
                            style={{ textAlign: isPureLtr ? 'right' : undefined }}
                          >
                            <span className="eb-bullet-dot">•</span>
                            <span>{renderWithMath(formatMathInText(cleanLine))}</span>
                          </div>
                        );
                      } else {
                        elements.push(
                          <div
                            key={`${baseKey}-l-${lIdx}`}
                            className="eb-text-line"
                            dir={isPureLtr ? 'ltr' : undefined}
                            style={{ textAlign: isPureLtr ? 'right' : undefined }}
                          >
                            {renderWithMath(formatMathInText(cleanLine))}
                          </div>
                        );
                      }
                    });

                    flushTable();
                    return elements;
                  };

                  return blocks.map((block, bIdx) => {
                    if (block.type === 'grid_items') {
                      const gList = block.grid_items || [];
                      if (!gList.length) return null;
                      const cols = block.cols || 2;
                      return (
                        <div
                          key={`b-${bIdx}`}
                          className="eb-grid-container"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                            gap: '4px 6px',
                            margin: '4px 0'
                          }}
                        >
                          {gList.map((gItem, gIdx) => {
                            const gText = typeof gItem === 'string' ? gItem : (gItem?.text || '');
                            const isHeader = /^\*\*[^*]+\*\*$/.test(gText.trim());
                            return (
                              <div key={gIdx} className={`eb-grid-item ${isHeader ? 'eb-grid-header' : ''}`}>
                                {renderWithMath(formatMathInText(gText))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    if (block.type === 'table') {
                      return (
                        <div key={`b-${bIdx}`} className="eb-table-wrapper">
                          <SmartTableRenderer table={block.table} />
                        </div>
                      );
                    }

                    if (block.type === 'image') {
                      if (block.svg_code) {
                        return (
                          <div key={`b-${bIdx}`} style={{ margin: '6px 0', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: block.svg_code }} />
                        );
                      }
                      if (!block.url) return null;
                      return (
                        <div key={`b-${bIdx}`} style={{ margin: '6px 0', textAlign: 'center' }}>
                          <img
                            src={block.url}
                            alt={block.alt || 'Figure'}
                            style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                          />
                          {block.alt && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>{renderWithMath(block.alt)}</div>}
                        </div>
                      );
                    }

                    if (block.type === 'notation_grid') {
                      return (
                        <div key={`b-${bIdx}`} style={{ display: 'flex', gap: '6px', margin: '4px 0' }}>
                          {(block.notation_columns || []).map((col, colIdx) => (
                            <div key={colIdx} style={{ flex: 1, padding: '4px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                              <strong style={{ fontSize: '0.82rem', color: '#005086', display: 'block', marginBottom: '2px' }}>{col.title}</strong>
                              {(col.math_blocks || []).map((mb, mIdx) => (
                                <div key={mIdx} style={{ margin: '2px 0' }}>{renderWithMath(mb)}</div>
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    }

                    const text = block.text || block.content || '';
                    if (!text) return null;
                    const lines = text.split('\n').filter(l => l.trim().length > 0);

                    if (block.type === 'highlight') {
                      return (
                        <div key={`b-${bIdx}`} className="eb-yellow-box">
                          {renderTextLines(lines, `b-${bIdx}`)}
                        </div>
                      );
                    }

                    if (block.type === 'bullet') {
                      return (
                        <div key={`b-${bIdx}`}>
                          {renderTextLines(lines.length > 0 ? lines : [text], `b-${bIdx}`, true)}
                        </div>
                      );
                    }

                    return (
                      <div key={`b-${bIdx}`} className="eb-text-p">
                        {renderTextLines(lines, `b-${bIdx}`)}
                      </div>
                    );
                  });
                })()}

                {/* Solution Block when showSolutions is active */}
                {showSolutions && sec.solution && sec.solution.trim() && (
                  <div className="eb-solution-box">
                    <div className="eb-solution-title">
                      <span>📖</span>
                      <span>{isArabic ? 'الحل المقترح' : 'Démonstration & Solution'}</span>
                    </div>
                    <div>{renderWithMath(formatMathInText(sec.solution))}</div>
                  </div>
                )}
              </div>
            </div>
          );
        };

        return (
          <div className="eb-columns-container">
            {orderedSections.map((sec, secIdx) => renderSectionContent(sec, `sec-${secIdx}`))}
          </div>
        );
      })()}

      {/* Clean Editorial Footer Strip */}
      <div className="eb-footer-bar">
        <span>{isArabic ? `كتاب إلكتروني • ${subjectName}` : `E-Book • ${subjectName}`}</span>
        <span>{levelParts.line1}{levelParts.line2 ? ` — ${levelParts.line2}` : ''}</span>
        <span>{profClean} • {academicYear}</span>
      </div>
    </div>
  );
}

