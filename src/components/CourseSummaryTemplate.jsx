import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { renderWithMath, SmartTableRenderer } from '../utils/mathRenderer';

/**
 * Splits Moroccan level into two elegant lines (e.g., Tronc Commun / Scientifique or الجذع المشترك / العلمي)
 */
const splitLevelTitle = (rawLevel, isArabic = false) => {
  if (!rawLevel) {
    return isArabic 
      ? { line1: 'الجذع المشترك', line2: 'العلمي' } 
      : { line1: 'Tronc Commun', line2: 'Scientifique' };
  }
  const s = String(rawLevel).trim();

  if (isArabic) {
    if (s.includes('جدع') || s.includes('مشترك') || s.includes('tronc') || s.includes('tc')) {
      if (s.includes('آداب') || s.includes('إنسان') || s.includes('art') || s.includes('lettre')) {
        return { line1: 'الجذع المشترك', line2: 'الآداب والعلوم الإنسانية' };
      }
      return { line1: 'الجذع المشترك', line2: 'العلمي' };
    }
    if (s.includes('2') || s.includes('ثانية')) {
      if (s.includes('رياض') || s.includes('sm')) return { line1: 'الثانية باكالوريا', line2: 'العلوم الرياضية' };
      if (s.includes('آداب') || s.includes('art')) return { line1: 'الثانية باكالوريا', line2: 'الآداب والعلوم الإنسانية' };
      return { line1: 'الثانية باكالوريا', line2: 'العلوم التجريبية' };
    }
    if (s.includes('1') || s.includes('أولى')) {
      if (s.includes('آداب') || s.includes('art')) return { line1: 'الأولى باكالوريا', line2: 'الآداب والعلوم الإنسانية' };
      return { line1: 'الأولى باكالوريا', line2: 'العلوم التجريبية' };
    }
    const words = s.split(/\s+/);
    if (words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      return { line1: words.slice(0, mid).join(' '), line2: words.slice(mid).join(' ') };
    }
    return { line1: s, line2: '' };
  }

  if (/tronc\s*commun/i.test(s)) {
    const rest = s.replace(/tronc\s*commun/i, '').replace(/^[\s\-_:]+/, '').trim();
    return { line1: 'Tronc Commun', line2: rest || 'Scientifique' };
  }

  if (/2\s*(è|e|eme|ème)?\s*(année\s*)?bac/i.test(s)) {
    let rest = s.replace(/2\s*(è|e|eme|ème)?\s*(année\s*)?bac/i, '').replace(/^[\s\-_:]+/, '').trim();
    if (/^sx$/i.test(rest)) rest = 'Sciences Exp';
    if (/^sm$/i.test(rest)) rest = 'Sciences Math';
    if (/^se$/i.test(rest)) rest = 'Sciences Éco';
    return { line1: '2ème Année Bac', line2: rest || 'Sciences' };
  }

  if (/1\s*(è|e|ere|ère)?\s*(année\s*)?bac/i.test(s)) {
    let rest = s.replace(/1\s*(è|e|ere|ère)?\s*(année\s*)?bac/i, '').replace(/^[\s\-_:]+/, '').trim();
    if (/^sx$/i.test(rest)) rest = 'Sciences Exp';
    if (/^sm$/i.test(rest)) rest = 'Sciences Math';
    if (/^se$/i.test(rest)) rest = 'Sciences Éco';
    return { line1: '1ère Année Bac', line2: rest || 'Sciences' };
  }

  const words = s.split(/\s+/);
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return { line1: words.slice(0, mid).join(' '), line2: words.slice(mid).join(' ') };
  }

  return { line1: s, line2: '' };
};

// Helper to clean raw text, protect valid LaTeX words starting with \n, and fix broken LaTeX tokens
const cleanLatex = (str) => {
  if (!str || typeof str !== 'string') return '';
  let s = str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  // Repair unclosed math environments missing trailing $ (e.g., "$... \begin{cases} ... \end{cases}" with no closing $)
  s = s.replace(/(\$(?:(?!\$).)*?\\begin\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\}[\s\S]*?\\end\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\})(?!\$)/g, '$1$');
  // Wrap bare math environments without any dollar delimiters
  s = s.replace(/(?<![\$\\])(\\begin\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\}[\s\S]*?\\end\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\})(?!\$)/g, '$$$1$$');

  // Split by existing math blocks: ONLY modify text OUTSIDE math blocks!
  const parts = s.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) return part; // inside existing math block: leave untouched!

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
      // Unicode sets: ℕ, ℝ, ℤ, ℚ, ℂ
      .replace(/[\u2115]/g, '$\\mathbb{N}$')
      .replace(/[\u211D]/g, '$\\mathbb{R}$')
      .replace(/[\u2124]/g, '$\\mathbb{Z}$')
      .replace(/[\u211A]/g, '$\\mathbb{Q}$')
      .replace(/[\u2102]/g, '$\\mathbb{C}$')
      // Contextual sets in titles/text: e.g. "Ensemble N", "dans N", "appartient à N", "soit N"
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bN\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{N}$')
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bR\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{R}$')
      .replace(/(?<=(?:Ensemble|dans|appartient\s+[àa]|soit)\s+)\bZ\b(?=[\s,\.\}]|$)/gi, '$\\mathbb{Z}$')
      // Wrap any standalone \mathbb{...} in $...$
      .replace(/(?<![$\w\\])(\\(?:mathbb|mathbf|mathcal|mathrm)\{[a-zA-Z0-9]+\})(?![$\w\\])/g, (_, m) => `$${m}$`)
      .replace(/(?<![$\w\\])(\\mathbb[a-zA-Z0-9])(?![$\w\\])/g, (_, m) => `$${m}$`);
  }).join('');
};

const wrapMathInArabicText = (text) => {
  if (!text || typeof text !== 'string') return '';
  if (!/[\u0600-\u06FF]/.test(text)) {
    return text;
  }

  // Pass 1: wrap multi-char math expressions
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

  // Pass 2: wrap single Latin letter variables outside any existing math delimiters
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
 * Returns a distinct style theme based on section title semantics (French & Arabic)
 */
const getSectionTheme = (title = '', type = '') => {
  const t = (title || '').toLowerCase();
  const ty = (type || '').toLowerCase();

  if (ty === 'definition' || t.includes('définition') || t.includes('definition') || t.includes('notation') || t.includes('ensemble') || t.includes('vocabulaire') ||
      t.includes('تعريف') || t.includes('تعاريف') || t.includes('اصطلاح') || t.includes('مفهوم')) {
    return {
      bg: '#e0f2fe',
      border: '#005086',
      text: '#005086',
      icon: '📘'
    };
  }
  if (ty === 'property' || ty === 'theorem' || ty === 'corollary' || t.includes('propriété') || t.includes('propriete') || t.includes('théorème') || t.includes('theoreme') || t.includes('corollaire') || t.includes('règle') || t.includes('regle') || t.includes('critère') ||
      t.includes('خاصية') || t.includes('خاصيات') || t.includes('مبرهنة') || t.includes('مبرهنات') || t.includes('قاعدة') || t.includes('قواعد')) {
    return {
      bg: '#dcfce7',
      border: '#16a34a',
      text: '#15803d',
      icon: '📗'
    };
  }
  if (ty === 'example' || ty === 'exercise' || t.includes('exemple') || t.includes('application') || t.includes('exercice') || t.includes('activité') ||
      t.includes('مثال') || t.includes('أمثلة') || t.includes('تطبيق') || t.includes('تطبيقات') || t.includes('تمرين') || t.includes('تمارين') || t.includes('نشاط')) {
    return {
      bg: '#fef3c7',
      border: '#d97706',
      text: '#92400e',
      icon: '📙'
    };
  }
  if (ty === 'method' || t.includes('méthode') || t.includes('methode') || t.includes('comment savoir') || t.includes('démarche') ||
      t.includes('طريقة') || t.includes('طرائق') || t.includes('منهجية') || t.includes('كيفية')) {
    return {
      bg: '#ede9fe',
      border: '#7c3aed',
      text: '#6d28d9',
      icon: '💡'
    };
  }
  if (ty === 'remark' || t.includes('remarque') || t.includes('attention') || t.includes('note') ||
      t.includes('ملاحظة') || t.includes('ملاحظات') || t.includes('تنبيه') || t.includes('انتباه')) {
    return {
      bg: '#ffedd5',
      border: '#ea580c',
      text: '#c2410c',
      icon: '⚠️'
    };
  }
  return {
    bg: '#f1f5f9',
    border: '#005086',
    text: '#0f172a',
    icon: '🔷'
  };
};

/**
 * Parses section content lines into grouped items
 */
const parseSectionBlocks = (section) => {
  const blocks = [];

  if (section.items && Array.isArray(section.items) && section.items.length > 0) {
    section.items.forEach(it => {
      if (!it) return;

      if (typeof it === 'string') {
        blocks.push({
          type: 'normal',
          text: it,
          content: it
        });
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
        text: text,
        content: text
      });
    });

    // Check if section.content has additional text not covered by items
    const rawContent = (section.content || section.description || '').trim();
    if (rawContent) {
      const combinedItemsText = blocks.map(b => b.text || '').join(' ');
      if (rawContent.length > 30 && !combinedItemsText.includes(rawContent.slice(0, 30))) {
        blocks.unshift({
          type: 'normal',
          text: rawContent,
          content: rawContent
        });
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
      blocks.push({
        type: 'normal',
        text: t,
        content: t
      });
      currentNormal = [];
    }
  };

  const flushHighlight = () => {
    if (currentHighlight.length > 0) {
      const t = currentHighlight.join('\n');
      blocks.push({
        type: 'highlight',
        text: t,
        content: t
      });
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

export default function CourseSummaryTemplate({ data, printable = false }) {
  const header = data?.content?.header || data?.header || {};
  const meta = header.summary_meta || {};

  // Extract raw sections early for language detection
  const rawSections = data?.content?.sections || data?.sections || [];

  // Extract Header Info
  const summaryTitle = meta.title || header.fiche_title || data?.title || "Ensemble ℕ et l'arithmétique";
  const rawTitle = (summaryTitle || '')
    .replace(/^(?:Résumé\s*(?:de\s*cours)?\s*\d*\s*:\s*|ملخص\s*(?:الدرس)?\s*\d*\s*:\s*)/i, '')
    .trim() || summaryTitle;
  const cleanTitle = formatMathInText(rawTitle);

  // Auto-detect if content or metadata is Arabic
  const hasArabic = (text) => /[\u0600-\u06FF]/.test(text || '');
  const isArabic = Boolean(
    data?.lang === 'ar' ||
    data?.language === 'ar' ||
    data?.content?.lang === 'ar' ||
    hasArabic(summaryTitle) ||
    hasArabic(rawTitle) ||
    hasArabic(data?.title) ||
    (rawSections && rawSections.some(s => hasArabic(s.title) || hasArabic(s.content) || (s.items && s.items.some(it => hasArabic(typeof it === 'string' ? it : it.text)))))
  );

  const rawProf = meta.prof || header.teacher || (isArabic ? 'فيصل البطخيلي' : 'Fayssal el boutkhili');
  const profClean = rawProf.replace(/^(Prof\s*:|الأستاذ\s*:|ذ\.\s*:?)\s*/i, '').trim() || rawProf;
  const academicYear = meta.academic_year || meta.year || header.year || '2025/2026';
  const website = meta.website || header.phone || header.contact || 'www.elboutkhili.jimdofree.com';

  // Dynamic Badge Text: "RÉSUMÉ DE COURS" / "SÉRIE D'EXERCICES" or "ملخص الدرس" / "سلسلة التمارين"
  const getBadgeText = () => {
    if (meta.badge_label) return meta.badge_label;
    if (data?.badge_label) return data.badge_label;
    const combined = `${summaryTitle || ''} ${data?.type || ''} ${data?.category || ''}`.toLowerCase();
    const isExercise = combined.includes('exercice') || combined.includes('série') || combined.includes('serie') || combined.includes('تمرين') || combined.includes('سلسلة');
    if (isArabic) {
      return isExercise ? "سلسلة التمارين" : "ملخص الدرس";
    }
    return isExercise ? "SÉRIE D'EXERCICES" : "RÉSUMÉ DE COURS";
  };
  const badgeText = getBadgeText();

  // Avoid school name (e.g. Lycée ...) leaking into educational level
  const candidateLevel = meta.level_name || data?.level_name || data?.level || data?.content?.level || header.level || header.niveau;
  const isSchoolName = (str) => /lyc[ée]e|coll[èe]ge|[ée]cole|direction|acad[ée]mie/i.test(str || '');
  const rawLevel = candidateLevel || (!isSchoolName(header.prep_title) ? header.prep_title : null) || (isArabic ? 'الجذع المشترك العلمي' : 'Tronc Commun Scientifique');
  const levelParts = splitLevelTitle(rawLevel, isArabic);

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
      const rawTargetPhone = settingsPhone || header.phone || '';
      let cleanWaPhone = (rawTargetPhone || '').replace(/[^\d+]/g, '');
      if (cleanWaPhone.startsWith('0') && cleanWaPhone.length === 10) cleanWaPhone = '212' + cleanWaPhone.slice(1);
      else if (!cleanWaPhone.startsWith('+') && !cleanWaPhone.startsWith('212') && cleanWaPhone.length === 9) cleanWaPhone = '212' + cleanWaPhone;
      cleanWaPhone = cleanWaPhone.replace(/^\+/, '');

      if (cleanWaPhone) {
        const msg = customWaMessage || `Bonjour Professeur, je souhaite avoir les résumés et solutions.`;
        payload = `https://wa.me/${cleanWaPhone}?text=${encodeURIComponent(msg)}`;
      } else {
        payload = website?.startsWith('http') ? website : `https://${website || 'elboutkhili.jimdofree.com'}`;
      }
    }
    QRCode.toDataURL(payload, {
      width: 150,
      margin: 1,
      color: {
        dark: '#005086',
        light: '#ffffff'
      }
    }).then(url => {
      if (isMounted) setQrUrl(url);
    }).catch(err => {
      console.warn('QR Code generation error:', err);
    });

    return () => { isMounted = false; };
  }, [meta.solution_url, header.solution_url, website]);

  const hasManualColumns = rawSections.some(sec => sec.column || sec.col);

  // Distribute sections across 3 columns (only used when hasManualColumns is true)
  const col1 = [];
  const col2 = [];
  const col3 = [];

  rawSections.forEach((sec, idx) => {
    if (sec.column === 1 || sec.col === 1) {
      col1.push(sec);
    } else if (sec.column === 2 || sec.col === 2) {
      col2.push(sec);
    } else if (sec.column === 3 || sec.col === 3) {
      col3.push(sec);
    } else {
      const total = rawSections.length;
      const third = Math.ceil(total / 3);
      if (idx < third) {
        col1.push(sec);
      } else if (idx < third * 2) {
        col2.push(sec);
      } else {
        col3.push(sec);
      }
    }
  });

  const columns = [col1, col2, col3];

  return (
    <div
      className="course-summary-root"
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
        @font-face {
          font-family: 'UKIJ Merdane';
          src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'UKIJ Merdane';
          src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
          font-weight: bold;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'UKIJMerdane';
          src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
          font-weight: 100 900;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'UKIJMerdaneRegular';
          src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
          font-weight: 100 900;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'UKIJMerdaneRegular';
          src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'UKIJMerdaneRegular';
          src: local('UKIJ Merdane'), local('UKIJMerdane'), url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
          font-weight: bold;
          font-style: normal;
          font-display: swap;
        }

        /* ── Official Series Table Header ── */
        .series-header-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1.5px solid #005086;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 12px;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(0, 80, 134, 0.05);
          table-layout: fixed;
          font-family: inherit;
        }

        .series-header-table td {
          vertical-align: middle;
          padding: 8px 14px;
          box-sizing: border-box;
        }

        .series-header-left {
          width: 29%;
          border-right: 1px solid #7dd3fc;
          background: #ffffff;
          font-family: inherit;
        }

        .series-header-center {
          width: 42%;
          border-right: 1px solid #7dd3fc;
          text-align: center;
          padding: 8px 12px;
          background: #ffffff;
        }

        .series-header-right {
          width: 29%;
          background: #ffffff;
          padding: 6px 12px;
          font-family: inherit;
        }

        .series-main-title {
          margin: 0 0 6px 0;
          font-size: 1.25rem;
          font-weight: 800;
          color: #005086;
          line-height: 1.25;
          font-family: 'STIX Two Text', 'Computer Modern Serif', 'Cambria', 'Times New Roman', serif;
          text-align: center;
          letter-spacing: -0.01em;
        }

        .series-pill-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 2px 14px;
          border: 1.2px solid #005086;
          border-radius: 9999px;
          background: #ffffff;
        }

        .series-pill-dot {
          color: #005086;
          font-size: 11px;
          line-height: 1;
        }

        .series-pill-text {
          color: #005086;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-family: 'STIX Two Text', 'Computer Modern Serif', sans-serif;
        }

        .series-niveau-label {
          font-size: 0.65rem;
          font-weight: 800;
          color: #0284c7;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 2px;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .series-level-text {
          font-size: 0.88rem;
          font-weight: 800;
          color: #005086;
          line-height: 1.2;
          font-family: 'STIX Two Text', 'Computer Modern Serif', serif;
        }

        .series-qr-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1.5px solid #005086;
          border-radius: 5px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 1px 4px rgba(0, 80, 134, 0.12);
        }

        .series-qr-img {
          width: 52px;
          height: 52px;
          display: block;
          padding: 3px;
          background: #ffffff;
        }

        .series-qr-placeholder {
          width: 52px;
          height: 52px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .series-solution-banner {
          width: 100%;
          background: #005086;
          color: #ffffff;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-align: center;
          padding: 3px 4px;
          line-height: 1.15;
          box-sizing: border-box;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          text-transform: uppercase;
        }

        /* ── 3 Columns Continuous Flow (Starts from 1st column, then next, then next) ── */
        .cs-columns-container {
          column-count: 3;
          column-gap: 14px;
          column-rule: 1.5px solid #005086;
          border: 1.5px solid #005086;
          border-radius: 4px;
          box-sizing: border-box;
          background: #ffffff;
          padding: 6px 8px;
          box-shadow: 0 2px 8px rgba(0, 80, 134, 0.05);
          column-fill: balance;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          font-family: 'STIX Two Text', 'Computer Modern Serif', 'Cambria', serif;
        }

        .cs-columns-container .cs-section {
          margin-bottom: 7px;
          break-inside: auto;
        }

        .cs-columns-container .cs-badge-header {
          break-inside: avoid;
          break-after: avoid;
          page-break-after: avoid;
        }

        .cs-columns-container .cs-yellow-box {
          break-inside: auto;
          margin: 4px 0;
          padding: 4px 6px;
        }

        .cs-columns-container .cs-bullet-item {
          break-inside: avoid;
          margin-bottom: 2.5px;
          line-height: 1.42;
        }

        .cs-columns-container .cs-text-line {
          break-inside: avoid;
          margin-bottom: 2.5px;
          line-height: 1.42;
        }

        .cs-columns-container .cs-text-p {
          break-inside: auto;
          margin-bottom: 4px;
        }

        .cs-table-wrapper {
          margin: 4px 0;
          break-inside: avoid;
        }

        /* ── Accent Sub-Badge for Key Rules / Definitions ── */
        .cs-accent-box {
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

        .cs-accent-bullet {
          color: #16a34a;
          font-size: 0.85rem;
          line-height: 1.3;
          flex-shrink: 0;
        }

        /* ── Grid Items for formulas / comparative lists ── */
        .cs-grid-container {
          width: 100%;
          margin: 4px 0;
          box-sizing: border-box;
          break-inside: avoid;
        }

        .cs-grid-item {
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

        .cs-grid-header {
          background: #eff6ff !important;
          border-color: #bfdbfe !important;
          color: #1e40af !important;
          font-weight: 800 !important;
          text-align: center;
        }

        .cs-points-badge {
          display: inline-flex;
          align-items: center;
          background: rgba(0, 80, 134, 0.08);
          color: #005086;
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 0.72rem;
          font-weight: 700;
        }

        /* ── 3 Columns Manual Grid Layout (when column numbers are explicitly defined) ── */
        .cs-columns-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          border: 1.5px solid #005086;
          border-radius: 6px;
          box-sizing: border-box;
          background: #ffffff;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
          font-family: 'STIX Two Text', 'Computer Modern Serif', 'Cambria', serif;
        }

        .cs-col {
          padding: 10px 12px;
          box-sizing: border-box;
        }

        .cs-col:not(:last-child) {
          border-right: 1.5px solid #005086;
        }

        .cs-section {
          margin-bottom: 14px;
        }

        /* ── Categorized Section Badges ── */
        .cs-badge-header {
          padding: 5px 9px;
          font-weight: 700;
          font-size: 0.88rem;
          line-height: 1.35;
          margin-bottom: 7px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
          border-left: 3.5px solid;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          font-family: 'STIX Two Text', 'Computer Modern Serif', 'Cambria', serif;
          letter-spacing: 0.01em;
        }

        .cs-text-p {
          font-family: 'STIX Two Text', 'Computer Modern Serif', 'Cambria', 'Times New Roman', serif;
          font-size: 0.94rem;
          line-height: 1.56;
          font-weight: 500;
          color: #0f172a;
          margin-bottom: 6px;
        }

        /* ── Yellow / Amber Highlight Callout Box ── */
        .cs-yellow-box {
          background-color: #fffbeb;
          border: 1px solid #fde68a;
          border-left: 3.5px solid #f59e0b;
          padding: 7px 10px;
          margin: 7px 0;
          border-radius: 4px;
          font-family: 'STIX Two Text', 'Computer Modern Serif', 'Cambria', 'Times New Roman', serif;
          font-size: 0.94rem;
          font-weight: 500;
          color: #0f172a;
          line-height: 1.54;
          box-shadow: 0 1px 3px rgba(245, 158, 11, 0.06);
        }

        .cs-bullet-item {
          font-family: 'STIX Two Text', 'Computer Modern Serif', 'Cambria', serif;
          font-size: 0.94rem;
          line-height: 1.54;
          font-weight: 500;
          margin-bottom: 4px;
          padding-left: 4px;
          color: #0f172a;
        }

        .katex {
          font-size: 1.08em;
          font-family: KaTeX_Main, 'STIX Two Text', serif;
        }

        .katex-display {
          margin: 0.5em 0 !important;
        }

        /* ── RTL Support for Arabic Summaries ── */
        .course-summary-root[dir="rtl"] {
          direction: rtl;
          text-align: right;
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'STIX Two Text', serif;
        }

        .course-summary-root[dir="rtl"] .series-header-left {
          border-right: none;
          border-left: 1px solid #7dd3fc;
        }

        .course-summary-root[dir="rtl"] .series-header-center {
          border-right: none;
          border-left: 1px solid #7dd3fc;
        }

        .course-summary-root[dir="rtl"] .series-main-title {
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif;
          font-weight: 800;
          letter-spacing: 0;
        }

        .course-summary-root[dir="rtl"] .series-pill-text {
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif;
          letter-spacing: 0.02em;
        }

        .course-summary-root[dir="rtl"] .series-niveau-label {
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif;
          letter-spacing: 0.04em;
        }

        .course-summary-root[dir="rtl"] .series-level-text {
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif;
        }

        .course-summary-root[dir="rtl"] .series-solution-banner {
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', sans-serif;
          letter-spacing: 0.04em;
        }

        .course-summary-root[dir="rtl"] .cs-columns-container {
          direction: rtl;
          column-rule: 1.5px solid #005086;
        }

        .course-summary-root[dir="rtl"] .cs-col:not(:last-child) {
          border-right: none;
          border-left: 1.5px solid #005086;
        }

        .course-summary-root[dir="rtl"] .cs-badge-header {
          border-left: none;
          border-right: 3.5px solid;
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif;
        }

        .course-summary-root[dir="rtl"] .cs-yellow-box {
          border-left: 1px solid #fde68a;
          border-right: 3.5px solid #f59e0b;
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif;
        }

        .course-summary-root[dir="rtl"] .cs-accent-box {
          border-left: 1px solid #bbf7d0;
          border-right: 3.5px solid #16a34a;
        }

        .course-summary-root[dir="rtl"] .cs-bullet-item {
          padding-left: 0;
          padding-right: 4px;
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif;
        }

        .course-summary-root[dir="rtl"] .cs-text-p {
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', serif;
        }

        /* Ensure mathematical formulas remain LTR in Arabic mode */
        .course-summary-root[dir="rtl"] .katex {
          direction: ltr !important;
          unicode-bidi: embed !important;
          display: inline-block !important;
        }

        .course-summary-root[dir="rtl"] .katex-display {
          direction: ltr !important;
          unicode-bidi: embed !important;
          display: block !important;
          text-align: center !important;
        }

        @media screen and (max-width: 900px) {
          .series-header-table {
            display: block;
          }
          .series-header-table tr {
            display: flex;
            flex-direction: column;
          }
          .series-header-left, .series-header-center, .series-header-right {
            width: 100% !important;
            border: none !important;
            border-bottom: 1px solid #005086 !important;
            text-align: center !important;
          }
          .cs-columns-grid {
            grid-template-columns: 1fr;
          }
          .cs-col:not(:last-child) {
            border-right: none;
            border-bottom: 1.5px solid #005086;
          }
          .course-summary-root[dir="rtl"] .cs-col:not(:last-child) {
            border-left: none;
            border-bottom: 1.5px solid #005086;
          }
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 5mm;
          }
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .course-summary-root {
            max-width: 100% !important;
            width: 100% !important;
          }
          .series-header-table {
            border: 1.5px solid #005086 !important;
            margin-bottom: 6px !important;
            box-shadow: none !important;
          }
          .cs-columns-container {
            column-fill: auto !important;
            box-shadow: none !important;
          }
          .cs-columns-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            box-shadow: none !important;
          }
          .cs-col:not(:last-child) {
            border-right: 1.5px solid #005086 !important;
            border-bottom: none !important;
          }
          .course-summary-root[dir="rtl"] .cs-col:not(:last-child) {
            border-right: none !important;
            border-left: 1.5px solid #005086 !important;
          }
          .cs-badge-header, .cs-yellow-box, .series-header-left, .series-header-right {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ════════════════════ OFFICIAL SERIES HEADER TABLE ════════════════════ */}
      <table className="series-header-table">
        <tbody>
          <tr>
            {/* Left Column: Teacher & Academic Year */}
            <td className="series-header-left">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#1e293b' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#005086" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>
                    {isArabic ? 'الأستاذ :' : 'Prof :'} <strong style={{ color: '#005086', fontWeight: 800 }}>{profClean}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#1e293b' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#005086" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>
                    {isArabic ? 'السنة الدراسية :' : 'A.S :'} <strong style={{ color: '#005086', fontWeight: 800 }}>{academicYear}</strong>
                  </span>
                </div>
              </div>
            </td>

            {/* Middle Column: Title & Badge */}
            <td className="series-header-center">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h1 className="series-main-title">
                  {renderWithMath(cleanTitle)}
                </h1>
                <div className="series-pill-badge">
                  <span className="series-pill-dot">•</span>
                  <span className="series-pill-text">{badgeText}</span>
                </div>
              </div>
            </td>

            {/* Right Column: Level & QR Solution */}
            <td className="series-header-right">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div className="series-niveau-label">
                    {isArabic ? 'المستوى' : 'NIVEAU'}
                  </div>
                  <div className="series-level-text">
                    {levelParts.line1}
                  </div>
                  {levelParts.line2 && (
                    <div className="series-level-text" style={{ marginTop: '1px' }}>
                      {levelParts.line2}
                    </div>
                  )}
                </div>

                {/* QR Code with SOLUTION box */}
                <div className="series-qr-container">
                  {qrUrl ? (
                    <img
                      src={qrUrl}
                      alt="Solution QR"
                      className="series-qr-img"
                    />
                  ) : (
                    <div className="series-qr-placeholder">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#005086" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                      </svg>
                    </div>
                  )}
                  <div className="series-solution-banner">
                    {isArabic ? 'الحل' : 'SOLUTION'}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ════════════════════ 3-COLUMN CONTENT (SEQUENTIAL FLOW) ════════════════════ */}
      {(() => {
        // Order sections preserving any author sequence (col 1, col 2, col 3)
        const orderedSections = [...rawSections].sort((a, b) => {
          const colA = a.column || a.col || 1;
          const colB = b.column || b.col || 1;
          return colA - colB;
        });

        const renderSectionContent = (sec, sKey) => {
          const rawSecTitle = (sec.title || '').replace(/^([•\-*]\s*)+/, '').replace(/\*\*/g, '').trim();
          const cleanTitle = rawSecTitle;
          const theme = getSectionTheme(cleanTitle, sec.type);
          const blocks = parseSectionBlocks(sec);

          return (
            <div key={sKey} className="cs-section">
              {/* Themed Section Header Badge */}
              {cleanTitle && (
                <div
                  className="cs-badge-header"
                  style={{
                    backgroundColor: theme.bg,
                    borderLeftColor: isArabic ? 'transparent' : theme.border,
                    borderRightColor: isArabic ? theme.border : 'transparent',
                    color: theme.text
                  }}
                >
                  <span style={{ fontSize: '0.9rem' }}>{theme.icon}</span>
                  <span>{renderWithMath(cleanTitle)}</span>
                  {sec.points != null && sec.points !== '' && (
                    <span className="cs-points-badge" style={{ marginLeft: isArabic ? 0 : 'auto', marginRight: isArabic ? 'auto' : 0 }}>
                      ({sec.points} {isArabic ? 'ن' : 'pts'})
                    </span>
                  )}
                </div>
              )}

              {/* Accent Sub-Badge / Key Rule if present */}
              {sec.accent_text && (
                <div className="cs-accent-box">
                  <span className="cs-accent-bullet">✦</span>
                  <span>{renderWithMath(formatMathInText(sec.accent_text))}</span>
                </div>
              )}

              {/* Section Content Blocks */}
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
                          <div key={`${baseKey}-tbl-${elements.length}`} className="cs-table-wrapper">
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

                      // Detect numbered item: e.g. "1)", "1.", "(1)", "*1)", "**1)**", "• 1)", "• *1)**", "- 1)", etc.
                      const numMatch = trimmed.match(/^([•\-*]\s*)?(\*+)?(\(?[\d\u0660-\u0669]+[.)]\)?)(\*+)?\s*(.*)$/);
                      let isBullet = false;
                      let cleanLine = trimmed;

                      if (numMatch && numMatch[3]) {
                        // It's a numbered item: NEVER add a bullet dot, normalize asterisks into clean bold: **1)** text
                        isBullet = false;
                        const numToken = numMatch[3];
                        const restOfText = numMatch[5] || '';
                        cleanLine = `**${numToken}** ${restOfText}`;
                      } else {
                        // It's not a numbered item: check if it has a bullet prefix
                        const hasBulletPrefix = /^([•]\s*|[-]\s+|\*(?!\*)\s+)/.test(trimmed);
                        isBullet = hasBulletPrefix || isBlockBullet;
                        cleanLine = trimmed.replace(/^([•]\s*|[-]\s+|\*(?!\*)\s+)/, '');
                      }

                      const isPureLtr = isArabic && !/[\u0600-\u06FF]/.test(cleanLine);

                      if (isBullet) {
                        elements.push(
                          <div
                            key={`${baseKey}-l-${lIdx}`}
                            className="cs-bullet-item"
                            dir={isPureLtr ? 'ltr' : undefined}
                            style={{ textAlign: isPureLtr ? 'right' : undefined }}
                          >
                            <span className="cs-bullet-dot">•</span>
                            <span>{renderWithMath(formatMathInText(cleanLine))}</span>
                          </div>
                        );
                      } else {
                        elements.push(
                          <div
                            key={`${baseKey}-l-${lIdx}`}
                            className="cs-text-line"
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
                          className="cs-grid-container"
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
                              <div
                                key={gIdx}
                                className={`cs-grid-item ${isHeader ? 'cs-grid-header' : ''}`}
                              >
                                {renderWithMath(formatMathInText(gText))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    if (block.type === 'table') {
                      return (
                        <div key={`b-${bIdx}`} className="cs-table-wrapper">
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
                        <div key={`b-${bIdx}`} className="cs-yellow-box">
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

                    // Regular text paragraphs
                    return (
                      <div key={`b-${bIdx}`} className="cs-text-p">
                        {renderTextLines(lines, `b-${bIdx}`)}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          );
        };

        return (
          <div className="cs-columns-container">
            {orderedSections.map((sec, secIdx) => renderSectionContent(sec, `sec-${secIdx}`))}
          </div>
        );
      })()}

    </div>
  );
}
