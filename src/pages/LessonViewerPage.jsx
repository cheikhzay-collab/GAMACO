import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, Check, X, Eye, EyeOff, Edit,
  BookOpen, Calendar, User, Phone, CheckCircle, AlertCircle,
  Calculator, BookOpenCheck, Loader, FileText, ChevronLeft, ChevronRight,
  Target, Moon, Sun, ListFilter, Lightbulb, ZoomIn, ZoomOut, Settings, Layers, Palette, Type, CheckCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getLessonById, updateLesson } from '../services/lessonService';
import { renderWithMath } from '../utils/mathRenderer';
import SmartTableRenderer from '../components/SmartTableRenderer';
import { openLessonPrintWindow } from '../utils/generateLessonPDF';
import NationalExamTemplate from '../components/NationalExamTemplate';
import CourseSummaryTemplate from '../components/CourseSummaryTemplate';
import { openNationalExamPrintWindow } from '../utils/generateNationalExamPDF';
import { openCourseSummaryPrintWindow } from '../utils/generateCourseSummaryPDF';

/**
 * Convert **bold** markdown to <strong> inline spans, keeping the rest as plain text.
 * Returns a React element (or array of spans).
 */
const parseBold = (text) => {
  if (!text || !text.includes('**')) return text;
  const parts = text.split(/\*\*/);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 800 }}>{part}</strong>
      : part
  );
};

function SignTableViewer({ altText }) {
  const alt = (altText || '').toLowerCase();
  
  // Case A: Sign of ax + b
  if (alt.includes('ax+b') || alt.includes('ax + b') || (alt.includes('signe') && (alt.includes('1er degré') || alt.includes('1-er degré') || alt.includes('1er degre')))) {
    return (
      <div style={{ margin: '1.2rem 0', padding: '1.25rem', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', width: '100%' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--violet)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          📊 Tableaux de signe de f(x) = ax + b (a ≠ 0)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
          {/* Case a > 0 */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10B981', marginBottom: '0.4rem' }}>Premier cas : a &gt; 0</div>
            <table className="sheet-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(124, 58, 237, 0.08)' }}>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$x$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$-\\infty$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$-\\frac{b}{a}$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$+\\infty$')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.6rem', fontWeight: 800, border: '1px solid var(--border)', background: 'var(--bg-glass)' }}>{renderWithMath('$ax+b$')}</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></td>
                  <td style={{ padding: '0.6rem', color: '#EF4444', fontWeight: 900, border: '1px solid var(--border)', fontSize: '1.1rem' }}>−</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>
                    <span style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', border: '1px solid #fcd34d', padding: '2px 7px', borderRadius: '4px', fontWeight: 900, fontSize: '0.82rem', display: 'inline-block' }}>0</span>
                  </td>
                  <td style={{ padding: '0.6rem', color: '#10B981', fontWeight: 900, border: '1px solid var(--border)', fontSize: '1.1rem' }}>+</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Case a < 0 */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#F59E0B', marginBottom: '0.4rem' }}>Deuxième cas : a &lt; 0</div>
            <table className="sheet-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(124, 58, 237, 0.08)' }}>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$x$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$-\\infty$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$-\\frac{b}{a}$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$+\\infty$')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.6rem', fontWeight: 800, border: '1px solid var(--border)', background: 'var(--bg-glass)' }}>{renderWithMath('$ax+b$')}</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></td>
                  <td style={{ padding: '0.6rem', color: '#10B981', fontWeight: 900, border: '1px solid var(--border)', fontSize: '1.1rem' }}>+</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>
                    <span style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', border: '1px solid #fcd34d', padding: '2px 7px', borderRadius: '4px', fontWeight: 900, fontSize: '0.82rem', display: 'inline-block' }}>0</span>
                  </td>
                  <td style={{ padding: '0.6rem', color: '#EF4444', fontWeight: 900, border: '1px solid var(--border)', fontSize: '1.1rem' }}>−</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Case B: Sign of ax^2 + bx + c
  if (alt.includes('ax^2') || alt.includes('ax2') || alt.includes('delta') || alt.includes('trinôme') || alt.includes('trinome') || alt.includes('2nd degré') || alt.includes('2ème degré')) {
    return (
      <div style={{ margin: '1.2rem 0', padding: '1.25rem', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', width: '100%' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#10B981', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          📊 Tableaux de signe du trinôme f(x) = ax² + bx + c (a ≠ 0)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* Delta > 0 */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--violet)', marginBottom: '0.4rem' }}>
              {renderWithMath('1er cas : $\\Delta > 0$ ($x_1 < x_2$ deux racines distinctes)')}
            </div>
            <table className="sheet-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(124, 58, 237, 0.08)' }}>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$x$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$-\\infty$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$x_1$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$x_2$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$+\\infty$')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.6rem', fontWeight: 800, border: '1px solid var(--border)', background: 'var(--bg-glass)' }}>{renderWithMath('$ax^2+bx+c$')}</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></td>
                  <td style={{ padding: '0.6rem', fontWeight: 700, border: '1px solid var(--border)' }}>Signe de {renderWithMath('$a$')}</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>
                    <span style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', border: '1px solid #fcd34d', padding: '2px 7px', borderRadius: '4px', fontWeight: 900, fontSize: '0.82rem', display: 'inline-block' }}>0</span>
                  </td>
                  <td style={{ padding: '0.6rem', fontWeight: 800, color: 'var(--violet)', border: '1px solid var(--border)' }}>Signe de {renderWithMath('$-a$')}</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>
                    <span style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', border: '1px solid #fcd34d', padding: '2px 7px', borderRadius: '4px', fontWeight: 900, fontSize: '0.82rem', display: 'inline-block' }}>0</span>
                  </td>
                  <td style={{ padding: '0.6rem', fontWeight: 700, border: '1px solid var(--border)' }}>Signe de {renderWithMath('$a$')}</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Delta = 0 */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10B981', marginBottom: '0.4rem' }}>
              {renderWithMath('2ème cas : $\\Delta = 0$ ($x_0 = -\\frac{b}{2a}$ racine double)')}
            </div>
            <table className="sheet-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$x$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$-\\infty$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$x_0$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$+\\infty$')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.6rem', fontWeight: 800, border: '1px solid var(--border)', background: 'var(--bg-glass)' }}>{renderWithMath('$ax^2+bx+c$')}</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></td>
                  <td style={{ padding: '0.6rem', fontWeight: 700, border: '1px solid var(--border)' }}>Signe de {renderWithMath('$a$')}</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>
                    <span style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', border: '1px solid #fcd34d', padding: '2px 7px', borderRadius: '4px', fontWeight: 900, fontSize: '0.82rem', display: 'inline-block' }}>0</span>
                  </td>
                  <td style={{ padding: '0.6rem', fontWeight: 700, border: '1px solid var(--border)' }}>Signe de {renderWithMath('$a$')}</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Delta < 0 */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#F59E0B', marginBottom: '0.4rem' }}>
              {renderWithMath('3ème cas : $\\Delta < 0$ (aucune racine réelle)')}
            </div>
            <table className="sheet-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(245, 158, 11, 0.08)' }}>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$x$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$-\\infty$')}</th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></th>
                  <th style={{ padding: '0.6rem', border: '1px solid var(--border)' }}>{renderWithMath('$+\\infty$')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.6rem', fontWeight: 800, border: '1px solid var(--border)', background: 'var(--bg-glass)' }}>{renderWithMath('$ax^2+bx+c$')}</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></td>
                  <td style={{ padding: '0.6rem', fontWeight: 700, border: '1px solid var(--border)' }}>Signe de {renderWithMath('$a$')} sur {renderWithMath('$\\mathbb{R}$')} tout entier</td>
                  <td style={{ padding: '0.6rem', border: '1px solid var(--border)' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    );
  }

  // Fallback for general math image description
  return (
    <div style={{ margin: '0.75rem 0', padding: '0.85rem 1rem', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center', fontStyle: 'italic', color: 'var(--text-muted)', width: '100%' }}>
      {renderWithMath(altText)}
    </div>
  );
}


const parseExerciseTitle = (title, fallbackIdx, isArabicMode = false) => {
  if (!title) return { number: String(fallbackIdx + 1), label: '' };
  
  let clean = title.trim();

  // Handle Arabic titles: "تمرين 1" or "تمرين: 1" or "تمرين\n1"
  if (isArabicMode || /^\u062a\u0645\u0631\u064a\u0646/.test(clean)) {
    const arabicMatch = clean.match(/^\u062a\u0645\u0631\u064a\u0646[:\s]+([\d\u0661-\u0669]+)\s*(.*)$/);
    if (arabicMatch) {
      return { number: arabicMatch[1], label: arabicMatch[2].trim() };
    }
    const numMatch = clean.match(/([\d]+)/);
    return { number: numMatch ? numMatch[1] : String(fallbackIdx + 1), label: '' };
  }

  // Strip markdown bold markers
  clean = clean.replace(/\*\*/g, '').trim();

  // Map circled numbers to regular digits
  const circledMap = { '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10' };

  // Check for patterns like "Application ① :" or "Exercice ② de la série :"
  const circledMatch = clean.match(/^(Application|Exercice|Activité|Problème)\s*([①②③④⑤⑥⑦⑧⑨⑩])\s*[:\-–—]?\s*(.*)$/i);
  if (circledMatch) {
    const type = circledMatch[1];
    const num = circledMap[circledMatch[2]] || circledMatch[2];
    const rest = circledMatch[3].replace(/\*\*$/, '').trim();
    return {
      number: `${num}`,
      label: rest || '',
      prefix: type,
    };
  }

  // Check for circled number at start (e.g. "① Exercice :")
  const circledFirst = clean.match(/^([①②③④⑤⑥⑦⑧⑨⑩])\s*(.*)$/);
  if (circledFirst) {
    const num = circledMap[circledFirst[1]] || circledFirst[1];
    const rest = circledFirst[2].replace(/\*\*$/, '').trim();
    return { number: num, label: rest };
  }

  // Remove "Exercice" prefix if any
  const prefixMatch = clean.match(/^(Application|Exercice|Activité|Problème)\s*(?:N?°|N)?\s*/i);
  if (prefixMatch) {
    clean = clean.substring(prefixMatch[0].length).trim();
  }
  
  // Match number (digits, circled, alphanumeric) and the rest
  const match = clean.match(/^([0-9a-zA-Z①-⑩\s]+)(.*?)(\*\*)?$/);
  if (match) {
    const number = match[1].trim();
    let label = match[2].trim();
    
    // Clean leading separators from the label (colons, dashes, etc.)
    label = label.replace(/^[:\-–—\s]+/, '').replace(/\*\*$/, '').trim();
    
    return {
      number: number || String(fallbackIdx + 1),
      label: label
    };
  }
  
  // If nothing matched, return the whole clean string as label (strip **) with fallback number
  return {
    number: String(fallbackIdx + 1),
    label: clean.replace(/\*\*/g, '').trim()
  };
};


/* ── Render Devoir Surveillé homework body with barème ── */
const renderHomeworkBody = (text, isArabicMode, arabicFont, renderWithMath, secId, onPointsChange, isDirectEdit = false, onContentChange = null) => {
  if (text === null || text === undefined) return null;

  let rawText = String(text);
  
  // Split by math blocks to safely replace literal \n outside math without corrupting LaTeX commands like \neq
  const parts = rawText.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  const processedParts = parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return part.replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)/gi, '\n');
    } else {
      // Outside math block: replace all literal \n with real newlines safely
      return part.replace(/\\n/g, '\n');
    }
  });
  rawText = processedParts.join('');

  rawText = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = rawText.split('\n');
  const mergedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^(\*\*)?([a-zA-Z]|\d+)[.)](\*\*)?$/.test(line) && i + 1 < lines.length) {
      let nextNonEmptyIdx = i + 1;
      while (nextNonEmptyIdx < lines.length && lines[nextNonEmptyIdx].trim() === '') {
        nextNonEmptyIdx++;
      }
      if (nextNonEmptyIdx < lines.length) {
        mergedLines.push(line + ' ' + lines[nextNonEmptyIdx].trim());
        i = nextNonEmptyIdx;
        continue;
      }
    }
    mergedLines.push(lines[i]);
  }

  const pointsRegex = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
  const parenthesizedNumRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)\(([\d.,]+)\)/;
  const isSubQRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)/;

  const parsedItems = [];
  mergedLines.forEach((line, idx) => {
    let cleanLine = line.trim();
    if (!cleanLine) return;

    let pointsStr = '';
    const match = cleanLine.match(pointsRegex);
    if (match) {
      pointsStr = match[0];
      cleanLine = cleanLine.replace(pointsRegex, '').replace(/\s{2,}/g, ' ').trim();
    } else {
      const pMatch = cleanLine.match(parenthesizedNumRegex);
      if (pMatch) {
        const prefix = pMatch[1];
        const val = pMatch[2];
        const ptsWord = isArabicMode ? 'ن' : 'pts';
        pointsStr = `(${val} ${ptsWord})`;
        cleanLine = cleanLine.replace(parenthesizedNumRegex, prefix).trim();
      }
    }

    if (!cleanLine) return;

    let displayPoints = pointsStr;
    if (displayPoints.startsWith('(') && displayPoints.endsWith(')')) {
      displayPoints = displayPoints.slice(1, -1);
    }

    const isSubQ = isSubQRegex.test(cleanLine);
    parsedItems.push({
      idx,
      cleanLine,
      pointsStr,
      displayPoints,
      isSubQ
    });
  });

  const blocks = [];
  let i = 0;
  while (i < parsedItems.length) {
    const item = parsedItems[i];
    if (item.pointsStr || !item.isSubQ) {
      const block = { headerItem: item, subItems: [] };
      i++;
      while (i < parsedItems.length && parsedItems[i].isSubQ && !parsedItems[i].pointsStr) {
        block.subItems.push(parsedItems[i]);
        i++;
      }
      blocks.push(block);
    } else {
      const block = { headerItem: null, subItems: [] };
      while (i < parsedItems.length && parsedItems[i].isSubQ && !parsedItems[i].pointsStr) {
        block.subItems.push(parsedItems[i]);
        i++;
      }
      if (block.subItems.length === 0) {
        block.subItems.push(item);
        i++;
      }
      blocks.push(block);
    }
  }

  const rows = blocks.map((b, bIdx) => {
    const ptsStr = b.headerItem ? b.headerItem.pointsStr : '';
    const displayPts = b.headerItem ? b.headerItem.displayPoints : '';
    const hIdx = b.headerItem ? b.headerItem.idx : (b.subItems[0]?.idx || bIdx);

    const headerContent = b.headerItem ? (
      <div style={{ fontWeight: 700 }}>
        {isDirectEdit ? (
          <textarea
            className="homework-content-textarea"
            value={b.headerItem.cleanLine}
            onChange={(e) => onContentChange(secId, hIdx, e.target.value)}
            style={{
              width: '100%',
              border: '1px solid rgba(0, 80, 134, 0.2)',
              borderRadius: '4px',
              background: '#fff',
              padding: '0.4rem',
              fontSize: '0.95rem',
              color: '#1a202c',
              fontFamily: isArabicMode ? arabicFont : 'inherit',
              resize: 'vertical',
              minHeight: '2.5rem',
              direction: isArabicMode ? 'rtl' : 'ltr',
              textAlign: isArabicMode ? 'right' : 'left'
            }}
          />
        ) : (
          renderWithMath(b.headerItem.cleanLine)
        )}
      </div>
    ) : null;

    let subquestionsContent = null;
    if (b.subItems.length >= 2) {
      subquestionsContent = (
        <div className="homework-subquestions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.2rem', marginTop: '0.4rem' }}>
          {b.subItems.map((si) => (
            <div key={si.idx} className="homework-subq-item" style={{ padding: '0.15rem 0' }}>
              {isDirectEdit ? (
                <textarea
                  className="homework-content-textarea"
                  value={si.cleanLine}
                  onChange={(e) => onContentChange(secId, si.idx, e.target.value)}
                  style={{
                    width: '100%', border: '1px solid rgba(0, 80, 134, 0.2)', borderRadius: '4px',
                    background: '#fff', padding: '0.3rem', fontSize: '0.9rem', color: '#1a202c',
                    fontFamily: isArabicMode ? arabicFont : 'inherit', resize: 'vertical', minHeight: '2rem'
                  }}
                />
              ) : (
                renderWithMath(si.cleanLine)
              )}
            </div>
          ))}
        </div>
      );
    } else if (b.subItems.length === 1) {
      const si = b.subItems[0];
      subquestionsContent = (
        <div style={{ marginTop: '0.25rem' }}>
          {isDirectEdit ? (
            <textarea
              className="homework-content-textarea"
              value={si.cleanLine}
              onChange={(e) => onContentChange(secId, si.idx, e.target.value)}
              style={{
                width: '100%', border: '1px solid rgba(0, 80, 134, 0.2)', borderRadius: '4px',
                background: '#fff', padding: '0.4rem', fontSize: '0.95rem', color: '#1a202c',
                fontFamily: isArabicMode ? arabicFont : 'inherit', resize: 'vertical', minHeight: '2.5rem'
              }}
            />
          ) : (
            renderWithMath(si.cleanLine)
          )}
        </div>
      );
    }

    return (
      <div key={bIdx} className="homework-row">
        <div className="homework-bareme-cell" style={{ position: 'relative' }}>
          {b.headerItem && (
            <>
              <input
                type="text"
                className="homework-bareme-input no-print"
                value={displayPts}
                onChange={(e) => onPointsChange(secId, hIdx, e.target.value)}
                placeholder="..."
                style={{
                  width: '100%', border: 'none', background: 'transparent', textAlign: 'center',
                  fontWeight: 700, fontSize: '0.9rem', color: '#005086', outline: 'none', padding: '0.15rem'
                }}
              />
              <span className="print-only" style={{ fontWeight: 700, fontSize: '0.9rem' }}>{ptsStr}</span>
            </>
          )}
        </div>
        <div className="homework-content-cell" style={isArabicMode ? { textAlign: 'right', direction: 'rtl', fontFamily: arabicFont } : {}}>
          {headerContent}
          {subquestionsContent}
        </div>
      </div>
    );
  });

  return rows;
};

/* ── Calculate total points for Devoir Surveillé homework ── */
const calculateTotalPoints = (text, isArabicMode) => {
  if (!text) return isArabicMode ? '0 ن' : '0 pts';

  let rawText = String(text);
  
  // Split by math blocks to safely replace literal \n outside math without corrupting LaTeX commands like \neq
  const parts = rawText.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  const processedParts = parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return part.replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)/gi, '\n');
    } else {
      // Outside math block: replace all literal \n with real newlines safely
      return part.replace(/\\n/g, '\n');
    }
  });
  rawText = processedParts.join('');

  rawText = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = rawText.split('\n');
  let total = 0;

  const pointsRegex = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
  const parenthesizedNumRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)\(([\d.,]+)\)/;

  lines.forEach(line => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    const match = cleanLine.match(pointsRegex);
    if (match) {
      const val = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(val)) total += val;
    } else {
      const pMatch = cleanLine.match(parenthesizedNumRegex);
      if (pMatch) {
        const val = parseFloat(pMatch[2].replace(',', '.'));
        if (!isNaN(val)) total += val;
      }
    }
  });

  const totalStr = String(total).replace('.', ',');
  const ptsWord = isArabicMode ? 'ن' : (total > 1 ? 'pts' : 'pt');
  return `${totalStr} ${ptsWord}`;
};

export default function LessonViewerPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, profName, profPhone, trackDownload } = useAuth();

  // Smart back navigation: return to the page that opened this lesson
  const goBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    const savedOrigin = sessionStorage.getItem('last_lessons_origin');
    if (savedOrigin) {
      navigate(savedOrigin);
      return;
    }
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }
    navigate(user?.role === 'admin' ? '/admin/lessons' : '/levels');
  };


  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Ref to the printable content area
  const sheetRef = useRef(null);
  
  // Interactive UI Style Toggle: 'interactive' (Modern UI) or 'classic' (Worksheet Paper UI)
  const [uiStyle, setUiStyle] = useState('interactive');
  
  // Active Tab for Interactive Mode
  const [activeTab, setActiveTab] = useState('theory'); // 'theory' or 'exercises'
  
  // Solutions visibility states (section ID -> boolean)
  const [visibleSolutions, setVisibleSolutions] = useState({}); // sectionId -> boolean
  const [studentAnswers, setStudentAnswers] = useState({}); // key -> student input
  const [checkResults, setCheckResults] = useState({}); // key -> 'success' | 'error'
  const [includeSolutionsInPdf, setIncludeSolutionsInPdf] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('pdf_series_solutions');
        if (saved !== null) return saved === 'true';
      }
    } catch {}
    return true;
  });

  const handleToggleSolutions = () => {
    setIncludeSolutionsInPdf(prev => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('pdf_series_solutions', String(next));
        }
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  const [isDirectEdit, setIsDirectEdit] = useState(false);
  const [originalLessonBackup, setOriginalLessonBackup] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewSummaryMode, setViewSummaryMode] = useState(false);

  // Dynamic columns count for exercises series: 1 or 2 columns
  const [seriesColumns, setSeriesColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('lesson_viewer_columns');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 2;
  });

  const handleSetSeriesColumns = (cols) => {
    setSeriesColumns(cols);
    try {
      localStorage.setItem('lesson_viewer_columns', cols);
      localStorage.setItem('pdf_series_columns', cols);
    } catch {}
  };

  useEffect(() => {
    const fetchLesson = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getLessonById(id);
        if (!data) {
          setError("Ce cours n'existe pas ou a été supprimé.");
        } else {
          setLesson(data);
          const isSum = Boolean(
            data.docType === 'summary' ||
            data.content?.doc_type === 'summary' ||
            data.is_summary ||
            data.content?.header?.is_summary ||
            data.content?.header?.summary_meta ||
            /ملخص|r[ée]sum[ée]|synth[èe]se/i.test(data.title || data.content?.header?.fiche_title || '')
          );
          if (isSum) {
            setViewSummaryMode(true);
          }
          // Initialise solutions visibility
          const initialSols = {};
          data.content?.sections?.forEach(sec => {
            if (sec.type === 'exercise') {
              initialSols[sec.id] = false;
            }
          });
          setVisibleSolutions(initialSols);
        }
      } catch (err) {
        console.error(err);
        setError("Erreur lors de la récupération de la fiche de cours.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchLesson();
  }, [id]);

  const handleHeaderChange = (field, value) => {
    setLesson(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        ...(field === 'fiche_title' ? { title: value } : {}),
        ...(field === 'subject' ? { subject: value } : {}),
        ...(field === 'teacher' ? { teacher: value } : {}),
        ...(field === 'phone' ? { phone: value } : {}),
        content: {
          ...prev.content,
          header: {
            ...prev.content.header,
            [field]: value,
            ...(field === 'fiche_title' ? { fiche_title: value } : {}),
            ...(field === 'subject' ? { subject: value } : {}),
            ...(field === 'teacher' ? { teacher: value } : {}),
            ...(field === 'phone' ? { phone: value } : {})
          }
        }
      };
    });
  };

  const handleTitleChange = (secId, value) => {
    setLesson(prev => {
      if (!prev) return prev;
      const updatedSections = prev.content.sections.map(sec => {
        if (sec.id === secId) {
          return { ...sec, title: value };
        }
        return sec;
      });
      return {
        ...prev,
        content: {
          ...prev.content,
          sections: updatedSections
        }
      };
    });
  };

  const handleSectionHeaderChange = (secId, value) => {
    setLesson(prev => {
      if (!prev) return prev;
      const targetSec = prev.content.sections.find(s => s.id === secId);
      const oldHeader = targetSec ? targetSec.section_header : '';
      const updatedSections = prev.content.sections.map(sec => {
        if (sec.section_header === oldHeader || sec.id === secId) {
          return { ...sec, section_header: value };
        }
        return sec;
      });
      return {
        ...prev,
        content: {
          ...prev.content,
          sections: updatedSections
        }
      };
    });
  };

  const handleSectionNumberChange = (secId, value) => {
    setLesson(prev => {
      if (!prev) return prev;
      const targetSec = prev.content.sections.find(s => s.id === secId);
      const oldNumber = targetSec ? targetSec.section_number : '';
      const updatedSections = prev.content.sections.map(sec => {
        if (sec.section_number === oldNumber || sec.id === secId) {
          return { ...sec, section_number: value };
        }
        return sec;
      });
      return {
        ...prev,
        content: {
          ...prev.content,
          sections: updatedSections
        }
      };
    });
  };

  const handleContentChange = (secId, lineIdx, newText) => {
    setLesson(prev => {
      if (!prev) return prev;
      const updatedSections = prev.content.sections.map(sec => {
        if (sec.id !== secId) return sec;

        let rawText = String(sec.content);
        const parts = rawText.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
        const processedParts = parts.map((part, idx) => {
          if (idx % 2 === 1) return part.replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)/gi, '\n');
          return part.replace(/\\n/g, '\n');
        });
        rawText = processedParts.join('').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = rawText.split('\n');

        const mergedToOriginalMap = [];
        const mergedLines = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (/^(\*\*)?([a-zA-Z]|\d+)[.)](\*\*)?$/.test(line) && i + 1 < lines.length) {
            let nextNonEmptyIdx = i + 1;
            while (nextNonEmptyIdx < lines.length && lines[nextNonEmptyIdx].trim() === '') {
              nextNonEmptyIdx++;
            }
            if (nextNonEmptyIdx < lines.length) {
              mergedToOriginalMap.push({ start: i, end: nextNonEmptyIdx });
              mergedLines.push(line + ' ' + lines[nextNonEmptyIdx].trim());
              i = nextNonEmptyIdx;
              continue;
            }
          }
          mergedToOriginalMap.push({ start: i, end: i });
          mergedLines.push(lines[i]);
        }

        const mapEntry = mergedToOriginalMap[lineIdx];
        if (!mapEntry) return sec;

        const targetOriginalLineIdx = mapEntry.start;
        let originalLine = lines[targetOriginalLineIdx];

        const pointsRegex = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
        const matchPoints = originalLine.match(pointsRegex);
        let pointsStr = matchPoints ? matchPoints[0] : '';

        let updatedLine = newText;
        if (pointsStr) {
          const listPrefixRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)/;
          const prefixMatch = updatedLine.match(listPrefixRegex);
          if (prefixMatch) {
            const prefix = prefixMatch[1];
            const restOfLine = updatedLine.substring(prefix.length);
            updatedLine = `${prefix}${pointsStr} ${restOfLine}`;
          } else {
            updatedLine = `${pointsStr} ${updatedLine}`;
          }
        }

        lines[targetOriginalLineIdx] = updatedLine;
        if (mapEntry.start !== mapEntry.end) {
          lines[mapEntry.end] = '';
        }

        return {
          ...sec,
          content: lines.join('\n')
        };
      });

      return {
        ...prev,
        content: {
          ...prev.content,
          sections: updatedSections
        }
      };
    });
  };

  const handleSaveDirectEdit = async () => {
    if (!lesson) return;
    setIsSaving(true);
    try {
      const updates = {
        title: lesson.title,
        subject: lesson.subject,
        chapterNumber: lesson.chapterNumber || lesson.content?.chapter_number || lesson.chapter_number,
        teacher: lesson.teacher || lesson.content?.header?.teacher,
        phone: lesson.phone || lesson.content?.header?.phone,
        level: lesson.level || lesson.content?.level,
        docType: lesson.docType || lesson.content?.doc_type,
        content: lesson.content,
      };
      await updateLesson(id, updates);
      setIsDirectEdit(false);
      setOriginalLessonBackup(null);
      alert(lesson.content?.metadata?.language === 'ar' ? 'تم حفظ التعديلات بنجاح!' : 'Modifications enregistrées avec succès !');
    } catch (err) {
      console.error(err);
      alert(lesson.content?.metadata?.language === 'ar' ? 'حدث خطأ أثناء الحفظ.' : "Erreur lors de l'enregistrement des modifications.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelDirectEdit = () => {
    if (originalLessonBackup) {
      setLesson(originalLessonBackup);
      setOriginalLessonBackup(null);
    }
    setIsDirectEdit(false);
  };

  const handleToggleDirectEdit = () => {
    if (!isDirectEdit) {
      setOriginalLessonBackup(JSON.parse(JSON.stringify(lesson)));
      setIsDirectEdit(true);
    }
  };

  const handleUpdateSectionStyle = (secId, key, value) => {
    setLesson(prev => {
      if (!prev) return prev;
      const updatedSections = (prev.content?.sections || []).map(s => {
        if (s.id !== secId) return s;
        return { ...s, [key]: value };
      });
      return { ...prev, content: { ...prev.content, sections: updatedSections } };
    });
  };

  const handleApplySectionStyleToAll = async (sourceSecId, targetScope = 'all') => {
    const allSecs = lesson?.content?.sections || [];
    const source = allSecs.find(s => s.id === sourceSecId);
    if (!source) return;
    const { bgColor = 'transparent', fontSize = '', lineHeight = '' } = source;
    const updatedSections = allSecs.map(s => {
      if (targetScope === 'exercises' && s.type !== 'exercise') return s;
      if (targetScope === 'course' && s.type === 'exercise') return s;
      return { 
        ...s, 
        bgColor, 
        bg_color: bgColor,
        fontSize, 
        font_size: fontSize,
        lineHeight, 
        line_height: lineHeight 
      };
    });

    setLesson(prev => ({
      ...prev,
      content: { ...(prev?.content || {}), sections: updatedSections }
    }));

    const isArabic = lesson?.content?.metadata?.language === 'ar';
    const scopeNames = {
      all: isArabic ? 'جميع أقسام وتمارين الملف' : 'toutes les sections et exercices',
      exercises: isArabic ? 'جميع تمارين الملف فقط' : 'tous les exercices uniquement',
      course: isArabic ? 'جميع فقرات الدرس فقط' : 'toutes les sections de cours uniquement'
    };

    if (id) {
      try {
        await updateLesson(id, {
          content: {
            ...(lesson?.content || {}),
            sections: updatedSections
          }
        });
        alert(isArabic 
          ? `✓ تم تطبيق التنسيق وحفظه في الملف على ${scopeNames[targetScope]} بنجاح!` 
          : `✓ Style appliqué et enregistré sur ${scopeNames[targetScope]} avec succès !`);
      } catch (err) {
        console.error('Auto-save error:', err);
        alert(isArabic 
          ? `تم تطبيق التنسيق على ${scopeNames[targetScope]}!` 
          : `Style appliqué à ${scopeNames[targetScope]} !`);
      }
    }
  };

  const handleUpdateSectionContent = (secId, newContent) => {
    setLesson(prev => {
      if (!prev) return prev;
      const updatedSections = (prev.content?.sections || []).map(s => {
        if (s.id !== secId) return s;
        return { ...s, content: newContent };
      });
      return { ...prev, content: { ...prev.content, sections: updatedSections } };
    });
  };

  const handlePointsChange = (secId, lineIdx, newPoints) => {
    setLesson(prev => {
      if (!prev) return prev;
      const isArabicMode = prev.content?.metadata?.language === 'ar';
      const updatedSections = prev.content.sections.map(sec => {
        if (sec.id !== secId) return sec;

        let rawText = String(sec.content);
        
        // Split by math blocks to safely replace literal \n outside math without corrupting LaTeX commands like \neq
        const parts = rawText.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
        const processedParts = parts.map((part, idx) => {
          if (idx % 2 === 1) {
            return part.replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)/gi, '\n');
          } else {
            // Outside math block: replace all literal \n with real newlines safely
            return part.replace(/\\n/g, '\n');
          }
        });
        rawText = processedParts.join('');

        rawText = rawText
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n');

        const lines = rawText.split('\n');
        
        const mergedToOriginalMap = [];
        const mergedLines = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (/^(\*\*)?([a-zA-Z]|\d+)[.)](\*\*)?$/.test(line) && i + 1 < lines.length) {
            let nextNonEmptyIdx = i + 1;
            while (nextNonEmptyIdx < lines.length && lines[nextNonEmptyIdx].trim() === '') {
              nextNonEmptyIdx++;
            }
            if (nextNonEmptyIdx < lines.length) {
              mergedToOriginalMap.push({ start: i, end: nextNonEmptyIdx });
              mergedLines.push(line + ' ' + lines[nextNonEmptyIdx].trim());
              i = nextNonEmptyIdx;
              continue;
            }
          }
          mergedToOriginalMap.push({ start: i, end: i });
          mergedLines.push(lines[i]);
        }

        const mapEntry = mergedToOriginalMap[lineIdx];
        if (!mapEntry) return sec;

        const targetOriginalLineIdx = mapEntry.start;
        let originalLine = lines[targetOriginalLineIdx];

        const pointsRegex = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
        const parenthesizedNumRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)\(([\d.,]+)\)/;

        let pointsToInsert = newPoints.trim();
        if (pointsToInsert && !pointsToInsert.startsWith('(')) {
          const ptsWord = isArabicMode ? 'ن' : 'pts';
          pointsToInsert = `(${pointsToInsert} ${ptsWord})`;
        }

        if (originalLine.match(pointsRegex)) {
          if (pointsToInsert) {
            originalLine = originalLine.replace(pointsRegex, pointsToInsert);
          } else {
            originalLine = originalLine.replace(pointsRegex, '').trim();
          }
        } else {
          const listPrefixRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)/;
          const prefixMatch = originalLine.match(listPrefixRegex);
          if (prefixMatch && pointsToInsert) {
            const prefix = prefixMatch[1];
            originalLine = originalLine.replace(listPrefixRegex, `${prefix}${pointsToInsert} `);
          } else if (pointsToInsert) {
            originalLine = `${pointsToInsert} ${originalLine}`;
          }
        }

        lines[targetOriginalLineIdx] = originalLine;
        
        if (mapEntry.start !== mapEntry.end) {
          lines[mapEntry.end] = ''; 
        }

        return {
          ...sec,
          content: lines.join('\n')
        };
      });

      return {
        ...prev,
        content: {
          ...prev.content,
          sections: updatedSections
        }
      };
    });
  };

  const toggleSolution = (secId) => {
    setVisibleSolutions(prev => ({ ...prev, [secId]: !prev[secId] }));
  };

  const handleCheckAnswer = (secId, qIdx, expectedAnswer) => {
    const key = `${secId}-${qIdx}`;
    const userAns = (studentAnswers[key] || '').trim().toLowerCase();
    const expected = expectedAnswer.trim().toLowerCase();

    // Flexible checking: match exact or close matches (e.g. "oui" vs "yes", numbers)
    const isCorrect = userAns === expected;
    setCheckResults(prev => ({ ...prev, [key]: isCorrect ? 'success' : 'error' }));
  };

  /**
   * PDF Export: Opens a standalone, properly formatted HTML document
   * in a new window for clean print/save-as-PDF.
   */
  const handleExportPDF = () => {
    if (isExporting || !lesson) return;
    setIsExporting(true);
    try {
      if (typeof trackDownload === 'function') {
        trackDownload({ type: 'lesson', id: lesson.id, title: lesson.content?.header?.fiche_title || lesson.title || 'Fiche de Cours' });
      }
      const isSeriesOrHomework = lesson?.docType === 'exercises' || lesson?.docType === 'homework' || lesson?.content?.doc_type === 'exercises' || lesson?.content?.doc_type === 'homework' || /سلسلة|s[ée]rie|devoir|فرض/i.test(lesson?.title || '');
      const isNat = !isSeriesOrHomework && Boolean(lesson?.docType === 'national' || lesson?.content?.doc_type === 'national' || lesson?.content?.header?.is_national_exam || lesson?.is_national_exam);
      const isSummary = !isSeriesOrHomework && Boolean(
        lesson?.docType === 'summary' ||
        lesson?.content?.doc_type === 'summary' ||
        lesson?.is_summary ||
        lesson?.content?.header?.is_summary ||
        lesson?.content?.header?.summary_meta ||
        /ملخص|r[ée]sum[ée]|synth[èe]se/i.test(lesson?.title || lesson?.content?.header?.fiche_title || '')
      );
      if (isNat) {
        openNationalExamPrintWindow(lesson.content || lesson, { showSolutions: includeSolutionsInPdf });
      } else if (viewSummaryMode) {
        // Mode 3 Colonnes actif -> Impression au format Résumé (3 Colonnes)
        openCourseSummaryPrintWindow(lesson.content || lesson);
      } else {
        // Mode Standard actif -> Impression au format Standard avec le nombre de colonnes choisi
        openLessonPrintWindow(lesson, { showSolutions: includeSolutionsInPdf, layoutMode: 'standard', forceStandard: true, columnsCount: seriesColumns });
      }
    } catch (err) {
      console.error('[PDF Export] Error:', err);
      alert('Erreur lors de la génération du PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.1)', borderTop: '3px solid var(--violet)', animation: 'spinViewer 1s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Chargement de la fiche de cours...</p>
        <style>{`
          @keyframes spinViewer {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={48} className="text-danger" style={{ marginBottom: '1rem' }} />
        <h2 style={{ color: 'var(--text-main)', fontWeight: 800 }}>Erreur de chargement</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', marginBottom: '1.5rem' }}>{error || "Une erreur inconnue est survenue."}</p>
        <button onClick={goBack} className="btn">Retour aux fiches</button>
      </div>
    );
  }

  const rawContent = lesson?.content;
  let parsedContent = rawContent;
  if (typeof rawContent === 'string') {
    try {
      parsedContent = JSON.parse(rawContent);
    } catch {
      parsedContent = {};
    }
  }

  const content = (parsedContent && typeof parsedContent === 'object' && !Array.isArray(parsedContent))
    ? parsedContent
    : { sections: Array.isArray(parsedContent) ? parsedContent : [] };

  const rawHeader = content?.header || lesson?.header;
  const header = (rawHeader && typeof rawHeader === 'object' && !Array.isArray(rawHeader))
    ? rawHeader
    : {
        fiche_title: lesson?.title || '',
        subject: lesson?.subject || 'Mathématiques',
        prep_title: '',
        schools: lesson?.schools || [],
        teacher: lesson?.teacher || '',
        phone: lesson?.phone || ''
      };

  const sections = Array.isArray(content?.sections) ? content.sections : (Array.isArray(parsedContent) ? parsedContent : []);
  const theorySections = sections?.filter(s => s?.type !== 'exercise') || [];
  const exerciseSections = sections?.filter(s => s?.type === 'exercise') || [];

  // دعم RTL للنسخ المترجمة للعربية
  const checkArabicText = () => {
    if (content?.metadata?.language === 'ar') return true;
    const textToTest = [
      lesson.title,
      lesson.subject,
      header?.fiche_title,
      header?.subject,
      ...(sections || []).map(s => s.title)
    ].filter(Boolean).join(' ');
    return /[\u0600-\u06FF]/.test(textToTest);
  };
  const isArabic = checkArabicText();
  const lessonDir = isArabic ? 'rtl' : 'ltr';
  const arabicFont = isArabic ? "'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'Noto Naskh Arabic', Arial, sans-serif" : 'inherit';

  return (
    <div className={`lesson-viewer-container ${uiStyle === 'classic' ? 'classic-view-active' : ''}`} style={{
      minHeight: '100vh',
      padding: '1.5rem 0',
      maxWidth: '1200px',
      margin: '0 auto',
      position: 'relative'
    }}>
      <style>{`
        /* PDF Export Styling overrides to make fonts larger and reduce gaps */
        .exporting-pdf .sheet-body {
          padding: 1.5rem !important;
          gap: 1.2rem !important;
          font-size: 1.25rem !important; /* Larger font size */
        }
        
        .exporting-pdf .sheet-header-banner {
          font-size: 1.8rem !important;
          margin: 0 auto 1.2rem !important;
          padding: 0.5rem 2rem !important;
        }

        .exporting-pdf .subsection-card {
          padding: 1.2rem !important;
          gap: 0.8rem !important;
          border-radius: 8px !important;
        }

        .exporting-pdf .section-header-row {
          margin-top: 0.8rem !important;
          margin-bottom: 0.6rem !important;
          padding-bottom: 0.4rem !important;
        }

        .exporting-pdf .bullet-item {
          margin-bottom: 0.4rem !important;
          line-height: 1.5 !important;
        }

        .exporting-pdf .classic-highlight-box {
          padding: 0.8rem !important;
          margin: 0.3rem 0 !important;
        }

        .exporting-pdf .notation-grid {
          gap: 1rem !important;
          margin: 0.5rem 0 !important;
          padding: 0.5rem !important;
        }

        .exporting-pdf .notation-column {
          gap: 0.3rem !important;
          padding-left: 0.75rem !important;
        }

        .exporting-pdf .sheet-table {
          font-size: 1.1rem !important; /* Larger table font size */
          margin-top: 0.4rem !important;
        }

        .exporting-pdf .sheet-table th, .exporting-pdf .sheet-table td {
          padding: 0.6rem 0.8rem !important;
        }

        .exporting-pdf .exercise-wrapper {
          gap: 0.6rem !important;
        }

        .exporting-pdf .exercise-body-box {
          padding: 1rem !important;
          line-height: 1.6 !important;
        }

        .exporting-pdf .solution-block {
          padding: 1.2rem !important;
          margin-top: 0.5rem !important;
        }
        
        .exporting-pdf .katex {
          font-size: 0.98em !important;
        }

        .sheet-body .katex {
          font-size: 0.98em !important;
        }


        /* Loader spin animation */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ══ RTL — Arabic Lesson Support ═══════════════════════════════════ */
         .sheet-body[dir="rtl"] {
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'Noto Naskh Arabic', Arial, sans-serif !important;
          text-align: right;
        }

        /* All rendered text spans in RTL */
        .sheet-body[dir="rtl"] span[style*="display: block"],
        .sheet-body[dir="rtl"] span[style*="display:block"] {
          text-align: right;
          direction: rtl;
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif;
        }

        /* Bullet and numbered lists — keep normal row flex direction so numbers are on the right */
        .sheet-body[dir="rtl"] .list-item-row {
          flex-direction: row !important;
          text-align: right;
        }

        /* Number/bullet dot — flip margin, keep LTR for correct '1.' rendering */
        .sheet-body[dir="rtl"] .list-item-row .list-num {
          direction: ltr;
          text-align: center;
          unicode-bidi: embed;
          margin-right: 0;
          margin-left: 0.4rem;
        }

        /* Content span inside list — force RTL */
        .sheet-body[dir="rtl"] .list-item-row .list-content {
          text-align: right !important;
          direction: rtl;
        }

        /* Headings in RTL */
        .sheet-body[dir="rtl"] div[style*="fontWeight: 800"],
        .sheet-body[dir="rtl"] div[style*="font-weight: 800"],
        .sheet-body[dir="rtl"] div[style*="font-weight: 900"] {
          text-align: right;
          direction: rtl;
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif;
        }

        /* Response / Attention callout blocks in RTL */
        .sheet-body[dir="rtl"] .mfc-callout-response,
        .sheet-body[dir="rtl"] .mfc-callout-attention {
          border-left: none !important;
          border-right: 4px solid var(--emerald) !important;
          direction: rtl;
          text-align: right;
          font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif;
        }
        .sheet-body[dir="rtl"] .mfc-callout-attention {
          border-right-color: var(--warning) !important;
        }

        /* KaTeX stays LTR always — math direction is always LTR */
        .sheet-body[dir="rtl"] .katex {
          direction: ltr !important;
          text-align: left !important;
        }
        .sheet-body[dir="rtl"] .katex-display {
          direction: ltr !important;
          text-align: center !important;
        }
        .sheet-body[dir="rtl"] .inline-math-container {
          direction: ltr !important;
          unicode-bidi: normal !important;
          display: inline-block !important;
        }

        /* ═══════════════════════════════════════
           HOMEWORK EXAM LAYOUT (Devoir Surveillé)
           ═══════════════════════════════════════ */
        .homework-table {
          width: 100%;
          border-collapse: collapse;
          border: 1.5px solid #005086;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 0.65rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          background: var(--bg-card);
          display: flex;
          flex-direction: column;
        }
        .homework-header-row {
          display: flex;
          background: #005086;
          color: #ffffff;
          font-weight: 800;
          border-bottom: 2px solid #005086;
          align-items: stretch;
        }
        .homework-row {
          display: flex;
          border-bottom: 1px solid var(--border);
          align-items: stretch;
        }
        .homework-row:last-child {
          border-bottom: none;
        }
        .homework-bareme-cell, .homework-bareme-header {
          width: 55px;
          flex-shrink: 0;
          padding: 0.35rem 0.2rem;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          font-weight: 700;
        }
         .homework-bareme-header {
           background: rgba(255, 255, 255, 0.12);
           color: #ffffff;
           border-right: 2px solid #ffffff;
         }
        .homework-bareme-cell {
          background: rgba(0, 80, 134, 0.02);
          color: var(--text-muted);
          border-right: 2px solid #005086;
          font-family: inherit;
        }
        .homework-content-cell, .homework-content-header {
          flex: 1;
          padding: 0.4rem 0.75rem;
        }
        .homework-content-cell .katex,
        .homework-table .katex,
        .homework-row .katex,
        .homework-subq-item .katex {
          font-size: 1.0em !important;
        }
        .homework-content-header {
          font-size: 1.05rem;
          display: flex;
          align-items: center;
          font-weight: 800;
        }
        /* RTL support for homework table */
        .sheet-body[dir="rtl"] .homework-header-row,
        .sheet-body[dir="rtl"] .homework-row {
          flex-direction: row-reverse;
        }
        .sheet-body[dir="rtl"] .homework-bareme-cell {
          border-right: none;
          border-left: 2px solid #005086;
        }
        .sheet-body[dir="rtl"] .homework-bareme-header {
          border-right: none;
          border-left: 2px solid #ffffff;
        }



        /* Styles scoped specifically for this page sheet */
        .sheet-container {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          min-height: 80vh;
          box-shadow: var(--shadow-card);
          overflow: hidden;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .sheet-container {
          background: #ffffff !important;
          border: 2px solid #005086 !important;
          border-radius: 12px !important;
          color: #1a202c !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08) !important;
        }

        /* Worksheet Body */
        .sheet-body {
          flex: 1;
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          overflow-y: auto;
          transition: all 0.3s ease;
        }

        .sections-list-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        @media (min-width: 768px) {
          .exercises-two-columns-layout {
            display: block !important;
            column-count: 2 !important;
            column-gap: 1.5rem !important;
            column-rule: 1px solid var(--border) !important;
            column-fill: balance !important;
            width: 100% !important;
          }
          .classic-view-active .exercises-two-columns-layout {
            column-rule: 1px solid rgba(0, 80, 134, 0.2) !important;
          }
          .exercises-two-columns-layout > *,
          .exercises-two-columns-layout .exercise-wrapper,
          .exercises-two-columns-layout .exercise-body,
          .exercises-two-columns-layout .exercise-body-box {
            margin-bottom: 1rem !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            -webkit-column-break-inside: auto !important;
          }
          .exercises-two-columns-layout .section-header-row,
          .exercises-two-columns-layout .exercise-banner,
          .exercises-two-columns-layout .modern-exercise-banner {
            break-inside: avoid !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
            -webkit-column-break-after: avoid !important;
            margin-bottom: 0.65rem !important;
          }
          .exercises-two-columns-layout .list-item-row,
          .exercises-two-columns-layout .exercise-item-row,
          .exercises-two-columns-layout div[style*="display: flex"],
          .exercises-two-columns-layout div[style*="display:flex"] {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-column-break-inside: avoid !important;
          }
          
          /* Prevent math formulas from overflowing two-column layouts */
          .exercises-two-columns-layout .katex-display {
            max-width: 100% !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            font-size: 0.95em !important;
          }
          .exercises-two-columns-layout .katex,
          .exercises-two-columns-layout .katex-html {
            white-space: normal !important;
            display: inline !important;
          }
          .exercises-two-columns-layout .katex .base {
            white-space: nowrap !important;
            display: inline-block !important;
            margin-top: 2px;
            margin-bottom: 2px;
          }

          /* Table containment in two-column screen view */
          .exercises-two-columns-layout .markdown-table-wrapper {
            max-width: 100% !important;
            overflow: hidden !important;
          }
          .exercises-two-columns-layout table,
          .exercises-two-columns-layout .markdown-table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            font-size: 0.78rem !important;
            break-inside: avoid !important;
          }
          .exercises-two-columns-layout th,
          .exercises-two-columns-layout td {
            padding: 4px 6px !important;
            font-size: 0.78rem !important;
            word-break: break-word !important;
          }

          /* 3-columns screen layout */
          .exercises-three-columns-layout {
            display: block !important;
            column-count: 3 !important;
            column-gap: 1.2rem !important;
            column-rule: 1px solid var(--border) !important;
            column-fill: balance !important;
            width: 100% !important;
          }
          .classic-view-active .exercises-three-columns-layout {
            column-rule: 1px solid rgba(0, 80, 134, 0.2) !important;
          }
          .exercises-three-columns-layout > *,
          .exercises-three-columns-layout .exercise-wrapper,
          .exercises-three-columns-layout .exercise-body,
          .exercises-three-columns-layout .exercise-body-box {
            margin-bottom: 0.75rem !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            -webkit-column-break-inside: auto !important;
          }
          .exercises-three-columns-layout .section-header-row,
          .exercises-three-columns-layout .exercise-banner,
          .exercises-three-columns-layout .modern-exercise-banner {
            break-inside: avoid !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
            -webkit-column-break-after: avoid !important;
            margin-bottom: 0.5rem !important;
          }
          .exercises-three-columns-layout .list-item-row,
          .exercises-three-columns-layout .exercise-item-row,
          .exercises-three-columns-layout div[style*="display: flex"],
          .exercises-three-columns-layout div[style*="display:flex"] {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-column-break-inside: avoid !important;
          }
          .exercises-three-columns-layout .katex-display {
            max-width: 100% !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            font-size: 0.75em !important;
          }
          .exercises-three-columns-layout .katex,
          .exercises-three-columns-layout .katex-html {
            white-space: normal !important;
            display: inline !important;
          }
          .exercises-three-columns-layout .katex .base {
            white-space: nowrap !important;
            display: inline-block !important;
            margin-top: 1px;
            margin-bottom: 1px;
          }
          .exercises-three-columns-layout .markdown-table-wrapper {
            max-width: 100% !important;
            overflow: hidden !important;
          }
          .exercises-three-columns-layout table,
          .exercises-three-columns-layout .markdown-table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            font-size: 0.7rem !important;
            break-inside: avoid !important;
          }
          .exercises-three-columns-layout th,
          .exercises-three-columns-layout td {
            padding: 2px 4px !important;
            font-size: 0.7rem !important;
            word-break: break-word !important;
          }
        }

        @media (max-width: 768px) {
          .sheet-body {
            padding: 1.25rem 0.75rem !important;
            gap: 1.25rem !important;
          }
          .sheet-header-banner {
            font-size: 1.25rem !important;
            padding: 0.5rem 1.25rem !important;
            margin-bottom: 1rem !important;
          }
          .subsection-card {
            padding: 1rem !important;
          }
          .exercises-two-columns-layout,
          .exercises-three-columns-layout {
            display: block !important;
            column-count: 1 !important;
            width: 100% !important;
          }
          .lesson-viewer-container {
            padding: 0.75rem 0 !important;
          }
        }
        
        .classic-view-active .sheet-body {
          background: #ffffff !important;
          color: #1a202c !important;
          font-family: 'Times New Roman', Times, serif !important;
        }

        /* Force all text to dark in classic mode */
        .classic-view-active *:not(.sheet-header-banner):not(.section-badge-circle):not(.exercise-pill):not(.section-title-pill):not(.accent-green-text):not(.solution-link-btn) {
          color: #1a202c !important;
        }
        /* Restore intentional colors */
        .classic-view-active .sheet-header-banner { color: #ffffff !important; }
        .classic-view-active .section-badge-circle { color: #ffffff !important; }
        .classic-view-active .exercise-pill { color: #ffffff !important; }
        .classic-view-active .section-title-pill { color: #005086 !important; }
        .classic-view-active .accent-green-text { color: #009688 !important; }
        .classic-view-active .solution-link-btn { color: #b91c1c !important; }

        /* Sheet top header */
        .sheet-header-banner {
          background: linear-gradient(135deg, #005086, #007cc6);
          border-radius: 99px;
          padding: 0.75rem 2.5rem;
          color: #ffffff;
          display: inline-flex;
          align-self: center;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.6rem;
          box-shadow: 0 4px 15px rgba(0, 80, 134, 0.2);
          letter-spacing: 0.02em;
          border: 2px solid rgba(255, 255, 255, 0.1);
        }
        
        .classic-view-active .sheet-header-banner {
          background: #005086 !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 20px !important;
          padding: 0.6rem 3rem !important;
        }

        /* Section badges */
        .section-badge-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #005086;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 0.95rem;
          flex-shrink: 0;
          box-shadow: 0 2px 5px rgba(0, 80, 134, 0.25);
        }
        
        .section-header-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-bottom: 2px solid rgba(0, 80, 134, 0.1);
          padding-bottom: 0.5rem;
          margin-bottom: 1rem;
        }
        
        .section-title-pill {
          font-size: 1.15rem;
          font-weight: 800;
          color: #005086;
          border: 1px solid rgba(0, 80, 134, 0.3);
          border-radius: 99px;
          padding: 0.25rem 1.25rem;
          display: inline-flex;
          background: rgba(0, 80, 134, 0.02);
        }
        
        .classic-view-active .section-title-pill {
          border: 1.5px solid #005086 !important;
          background: none !important;
          color: #005086 !important;
        }

        /* Subsection boxes */
        .subsection-card {
          border: 1.5px solid #005086;
          border-radius: 12px;
          padding: 1.5rem;
          background: rgba(0, 80, 134, 0.01);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .subsection-card {
          border: 1.5px solid #005086 !important;
          background: #ffffff !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }
        
        .subsection-header-inline {
          font-size: 1.05rem;
          font-weight: 800;
          color: #2d3748;
          border-bottom: 1px dashed rgba(0, 80, 134, 0.25);
          padding-bottom: 0.5rem;
          margin-bottom: 0.5rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        
        .classic-view-active .subsection-header-inline {
          color: #1a202c !important;
        }
        
        .accent-green-text {
          color: #10B981;
          font-weight: 800;
        }
        
        .classic-view-active .accent-green-text {
          color: #009688 !important; /* Muted corporate green from the original print */
        }

        /* Classic style bullet points */
        .bullet-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          line-height: 1.6;
          margin-bottom: 0.5rem;
        }
        
        .bullet-dot {
          color: #005086;
          font-size: 1.2rem;
          line-height: 1;
          margin-top: -0.1rem;
        }

        /* Columns for Notations */
        .notation-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin: 0.75rem 0;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }
        
        .classic-view-active .notation-grid {
          background: #f8fafc !important;
          border: 1px solid rgba(0,80,134,0.1) !important;
        }
        
        @media (max-width: 640px) {
          .notation-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
        }
        
        .notation-column {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          border-left: 2px solid rgba(0, 80, 134, 0.15);
          padding-left: 1rem;
        }
        
        .classic-view-active .notation-column {
          border-left-color: #005086 !important;
        }

        /* Worksheet Math Table */
        .sheet-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.5rem;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(0, 80, 134, 0.2);
          font-size: 0.9rem;
        }
        
        .classic-view-active .sheet-table {
          border: 1.5px solid #1a202c !important;
        }
        
        .sheet-table th, .sheet-table td {
          border: 1px solid rgba(0, 80, 134, 0.2);
          padding: 0.75rem 1rem;
          text-align: center;
        }
        
        .classic-view-active .sheet-table th, 
        .classic-view-active .sheet-table td {
          border: 1.5px solid #1a202c !important;
          color: #1a202c !important;
        }
        
        .sheet-table th {
          background: rgba(0, 80, 134, 0.05);
          font-weight: 800;
          color: #005086;
        }
        
        .classic-view-active .sheet-table th {
          background: #f7fafc !important;
          color: #005086 !important;
        }

        /* Exercises design */
        .exercise-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .exercise-banner-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        /* RTL: pill group moves to the right, solution button to the left */
        .sheet-body[dir="rtl"] .exercise-banner-row {
          flex-direction: row !important;
        }
        
        .exercise-pill {
          background: #005086;
          color: #ffffff;
          padding: 0.35rem 1.25rem;
          border-radius: 99px;
          font-weight: 800;
          font-size: 0.9rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 2px 4px rgba(0, 80, 134, 0.15);
        }
        
        .solution-link-btn {
          background: none;
          border: none;
          color: #b91c1c; /* Maroon/reddish */
          cursor: pointer;
          font-weight: 700;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          text-decoration: underline;
          transition: all 0.2s;
        }
        
        .solution-link-btn:hover {
          color: #ef4444;
          transform: translateX(2px);
        }
        
        .exercise-body-box {
          border-left: 4px solid #005086;
          background: rgba(0, 80, 134, 0.02);
          border-top: 1px solid rgba(0, 80, 134, 0.1);
          border-right: 1px solid rgba(0, 80, 134, 0.1);
          border-bottom: 1px solid rgba(0, 80, 134, 0.1);
          border-radius: 4px 8px 8px 4px;
          padding: 1.25rem;
          line-height: 1.7;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .exercise-body-box:not(.has-custom-bg) {
          background: #ffffff !important;
          border: 1.5px solid #005086 !important;
          border-left: 5px solid #005086 !important;
          border-radius: 4px !important;
        }
        
        /* Interactive features */
        .interactive-form {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--bg-glass);
          border: 1px dashed var(--border);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .classic-view-active .interactive-form {
          border: 1px dashed #cbd5e1 !important;
          background: #f8fafc !important;
        }

        .print-only {
          display: none !important;
        }

        /* ── Print / PDF Export styles ── */
        @media print {
          .print-only {
            display: inline !important;
          }
          /* Page setup */
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }

          /* ── Override dark-mode CSS variables: target body directly ── */
          /* :root has same specificity as the dark theme :root so target body instead */
          html, body, body * {
            --text-main: #1a202c;
            --text-muted: #4a5568;
            --bg-card: #ffffff;
            --bg-glass: #f8fafc;
            --bg-base: #ffffff;
            --border: rgba(0,80,134,0.2);
            --violet: #4F46E5;
            --violet-soft: rgba(79,70,229,0.08);
            --emerald: #059669;
            --emerald-soft: rgba(5,150,105,0.08);
            --warning: #d97706;
            --danger: #dc2626;
            --shadow-card: none;
          }

          /* Root resets */
          html, body {
            background: #ffffff !important;
            color: #1a202c !important;
            font-family: 'Segoe UI', Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide everything that should not print */
          .no-print,
          nav, aside,
          .interactive-form {
            display: none !important;
          }

          /* Show print-only header */
          .print-only-header {
            display: grid !important;
          }

          /* Always show solutions in print */
          .solution-block {
            display: block !important;
            margin-top: 0.75rem !important;
            break-inside: avoid !important;
          }
          .hide-solutions-print .solution-block {
            display: none !important;
          }

          /* Page container */
          .lesson-viewer-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }

          /* Remove card box-shadow and border for print */
          .sheet-container {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #1a202c !important;
            overflow: visible !important;
            min-height: auto !important;
          }

          /* Sheet body — critical: remove overflow:auto so full content prints */
          .sheet-body {
            padding: 1rem 0 !important;
            background: #ffffff !important;
            color: #1a202c !important;
            gap: 1.25rem !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }

          .exercises-two-columns-layout {
            display: block !important;
            column-count: 2 !important;
            column-gap: 1.5rem !important;
            column-rule: 1px solid rgba(0, 80, 134, 0.2) !important;
            column-fill: auto !important;
            width: 100% !important;
          }
          .exercises-two-columns-layout > *,
          .exercises-two-columns-layout .exercise-wrapper,
          .exercises-two-columns-layout .exercise-body,
          .exercises-two-columns-layout .exercise-body-box {
            margin-bottom: 1rem !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            -webkit-column-break-inside: auto !important;
          }
          .exercises-two-columns-layout .exercise-banner,
          .exercises-two-columns-layout .modern-exercise-banner {
            break-inside: avoid !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
            -webkit-column-break-after: avoid !important;
          }
          .exercises-two-columns-layout .list-item-row,
          .exercises-two-columns-layout .exercise-item-row,
          .exercises-two-columns-layout div[style*="display: flex"],
          .exercises-two-columns-layout div[style*="display:flex"] {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-column-break-inside: avoid !important;
          }
          
          /* Prevent math formulas from overflowing two-column layouts in print */
          .exercises-two-columns-layout .katex-display {
            max-width: 100% !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            font-size: 0.95em !important;
          }
          .exercises-two-columns-layout .katex,
          .exercises-two-columns-layout .katex-html {
            white-space: normal !important;
            display: inline !important;
          }
          .exercises-two-columns-layout .katex .base {
            white-space: nowrap !important;
            display: inline-block !important;
            margin-top: 2px;
            margin-bottom: 2px;
          }

          /* Table containment in two-column print view */
          .exercises-two-columns-layout .markdown-table-wrapper {
            max-width: 100% !important;
            overflow: hidden !important;
            break-inside: avoid !important;
          }
          .exercises-two-columns-layout table,
          .exercises-two-columns-layout .markdown-table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            font-size: 0.74rem !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .exercises-two-columns-layout th,
          .exercises-two-columns-layout td {
            padding: 3px 5px !important;
            font-size: 0.74rem !important;
            word-break: break-word !important;
          }

          /* 3-columns print layout */
          .exercises-three-columns-layout {
            display: block !important;
            column-count: 3 !important;
            column-gap: 1.2rem !important;
            column-rule: 1px solid rgba(0, 80, 134, 0.2) !important;
            column-fill: auto !important;
            width: 100% !important;
          }
          .exercises-three-columns-layout > *,
          .exercises-three-columns-layout .exercise-wrapper,
          .exercises-three-columns-layout .exercise-body,
          .exercises-three-columns-layout .exercise-body-box {
            margin-bottom: 0.75rem !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            -webkit-column-break-inside: auto !important;
          }
          .exercises-three-columns-layout .exercise-banner,
          .exercises-three-columns-layout .modern-exercise-banner {
            break-inside: avoid !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
            -webkit-column-break-after: avoid !important;
          }
          .exercises-three-columns-layout .list-item-row,
          .exercises-three-columns-layout .exercise-item-row,
          .exercises-three-columns-layout div[style*="display: flex"],
          .exercises-three-columns-layout div[style*="display:flex"] {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-column-break-inside: auto !important;
          }
          .exercises-three-columns-layout .katex-display {
            max-width: 100% !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            font-size: 0.76em !important;
          }
          .exercises-three-columns-layout .katex,
          .exercises-three-columns-layout .katex-html {
            white-space: normal !important;
            display: inline !important;
          }
          .exercises-three-columns-layout .katex .base {
            white-space: nowrap !important;
            display: inline-block !important;
            margin-top: 1px;
            margin-bottom: 1px;
          }
          .exercises-three-columns-layout .markdown-table-wrapper {
            max-width: 100% !important;
            overflow: hidden !important;
            break-inside: avoid !important;
          }
          .exercises-three-columns-layout table,
          .exercises-three-columns-layout .markdown-table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            font-size: 0.68rem !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .exercises-three-columns-layout th,
          .exercises-three-columns-layout td {
            padding: 2px 3px !important;
            font-size: 0.68rem !important;
            word-break: break-word !important;
          }

          /* Force ALL text elements inside sheet-body to dark color */
          .sheet-body,
          .sheet-body span,
          .sheet-body div,
          .sheet-body p,
          .sheet-body li,
          .sheet-body h1,
          .sheet-body h2,
          .sheet-body h3,
          .sheet-body h4,
          .sheet-body strong,
          .sheet-body em {
            color: #1a202c !important;
          }

          /* Blue gradient banner - keep it */
          .sheet-header-banner {
            background: #005086 !important;
            color: #ffffff !important;
            border-radius: 20px !important;
            padding: 0.5rem 2.5rem !important;
            font-size: 1.25rem !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* Section header row */
          .section-header-row {
            border-bottom: 2px solid rgba(0,80,134,0.15) !important;
          }

          /* Section number badge */
          .section-badge-circle {
            background: #005086 !important;
            color: #ffffff !important;
            box-shadow: none !important;
          }

          /* Section title pill */
          .section-title-pill {
            color: #005086 !important;
            border-color: rgba(0,80,134,0.4) !important;
            background: rgba(0,80,134,0.04) !important;
            font-size: 1rem !important;
          }

          /* Subsection card */
          .subsection-card {
            border: 1.5px solid #005086 !important;
            background: #ffffff !important;
            border-radius: 8px !important;
            color: #1a202c !important;
            break-inside: avoid !important;
          }

          /* Subsection inline header */
          .subsection-header-inline {
            color: #1a202c !important;
          }

          /* Green accent */
          .accent-green-text { color: #009688 !important; }

          /* Bullet items */
          .bullet-dot { color: #005086 !important; }

          /* Notation grid */
          .notation-grid {
            background: #f8fafc !important;
            border: 1px solid rgba(0,80,134,0.1) !important;
          }
          .notation-column {
            border-left-color: rgba(0,80,134,0.3) !important;
          }

          /* Tables */
          .sheet-table {
            border: 1.5px solid #005086 !important;
          }
          .sheet-table th, .sheet-table td {
            border: 1px solid rgba(0,80,134,0.25) !important;
            color: #1a202c !important;
          }
          .sheet-table th {
            background: rgba(0,80,134,0.06) !important;
            color: #005086 !important;
          }

          /* Exercises page break flow — allow exercises to break across pages while keeping rows intact */
          .exercise-wrapper, .homework-table, .anisse-ex-card {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .homework-row, .anisse-ex-row, .homework-subq-item {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .homework-header-row, .anisse-ex-card-header, .exercise-banner-row {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .exercise-pill {
            background: #005086 !important;
            color: #ffffff !important;
          }
          .exercise-body-box {
            background: rgba(0,80,134,0.02) !important;
            border: 1px solid rgba(0,80,134,0.15) !important;
            border-left: 4px solid #005086 !important;
            color: #1a202c !important;
          }

          /* Solution block in print */
          .solution-block h4 { color: #059669 !important; }

          /* Classic highlight box */
          .classic-highlight-box {
            background: rgba(0,80,134,0.04) !important;
            border: 1.5px solid #005086 !important;
            color: #1a202c !important;
          }

          /* KaTeX math — always crisp regular weight, metric isolated, and strictly LTR */
          .katex, .katex *, .katex *::before, .katex *::after {
            box-sizing: content-box !important;
          }
          .katex .fbox, .katex .fcolorbox, .katex .angl {
            box-sizing: border-box !important;
          }
          .katex, .katex *, .katex .mathnormal, .katex .mord, .katex .mbin, .katex .mrel, .katex .mopen, .katex .mclose, .katex .mpunct {
            color: #1a202c !important;
            font-weight: normal !important;
            line-height: 1.2 !important;
          }
          .katex .mathbf, .katex .mathbf * { font-weight: bold !important; }
          .katex, .katex * {
            direction: ltr !important;
            unicode-bidi: normal !important;
          }
          .inline-math-container, .katex-inline, .katex {
            white-space: nowrap !important;
            font-weight: normal !important;
            direction: ltr !important;
          }
          .inline-math-container .katex .base {
            white-space: nowrap !important;
            display: inline-block !important;
            font-weight: normal !important;
          }
          .katex .hide-tail {
            width: 100% !important;
            position: relative !important;
            overflow: hidden !important;
          }
          .katex .sqrt > .vlist-t {
            position: relative !important;
          }
          .katex .mfrac .vlist-t {
            margin-top: 0.12em !important;
            margin-bottom: 0.12em !important;
          }
          .katex .mfrac .frac-line {
            margin-top: 0.06em !important;
            margin-bottom: 0.06em !important;
          }
          /* Targeted refined scale for superscripts / powers only (leaves subscripts untouched) */
          .katex .msupsub .vlist-t:not(.vlist-t2) .sizing.size3,
          .katex .msupsub .vlist-t:not(.vlist-t2) .sizing.reset-size6.size3,
          .katex .msupsub .vlist-t.vlist-t2 span[style*="top:-3"] .sizing.size3,
          .katex .msupsub .vlist-t.vlist-t2 span[style*="top:-3"] .sizing.reset-size6.size3 {
            font-size: 0.63em !important;
          }

          /* Response/attention callouts */
          .mfc-callout-response {
            background: rgba(16,185,129,0.06) !important;
            border-left-color: #009688 !important;
          }
          .mfc-callout-attention {
            background: rgba(245,158,11,0.06) !important;
          }

          /* Markdown headings rendered by renderWithMath */
          .sheet-body div[style*='#005086'] { color: #005086 !important; }
        }
      `}</style>

      {/* ── Action Header (No Print) ── */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <button 
          onClick={goBack}
          className="btn-outline"
          style={{ 
            padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '99px',
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border)'
          }}
        >
          <ArrowLeft size={15} /> Retour
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>

          {/* Column Count Selector for Exercise Series */}
          {Boolean(lesson?.docType === 'exercises' || lesson?.content?.doc_type === 'exercises' || /s[ée]rie|exercice/i.test(lesson?.title || '')) && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--bg-card, rgba(255, 255, 255, 0.08))',
              border: '1px solid var(--border)',
              borderRadius: '99px',
              padding: '2px',
              gap: '2px'
            }}>
              {[
                { val: 1, label: '1 Col' },
                { val: 2, label: '2 Cols' },
                { val: 3, label: '3 Cols' }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => handleSetSeriesColumns(opt.val)}
                  style={{
                    background: seriesColumns === opt.val ? 'linear-gradient(135deg, #005086, #007cc6)' : 'transparent',
                    color: seriesColumns === opt.val ? '#ffffff' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '99px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.74rem',
                    fontWeight: seriesColumns === opt.val ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Modèle Résumé (3 Colonnes) - Toujours visible */}
          <button 
            onClick={() => setViewSummaryMode(!viewSummaryMode)}
            className="btn-outline"
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '99px',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: viewSummaryMode ? 'linear-gradient(135deg, #0284c7, #0070ba)' : 'transparent',
              color: viewSummaryMode ? '#ffffff' : 'var(--text-main)',
              borderColor: viewSummaryMode ? '#0284c7' : 'var(--border)',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            title={viewSummaryMode ? 'Revenir à la vue standard' : 'Afficher en Modèle Résumé (3 Colonnes)'}
          >
            {viewSummaryMode ? (
              <><FileText size={14} /> Vue Standard</>
            ) : (
              <><Eye size={14} /> Modèle Résumé</>
            )}
          </button>

          {/* Option d'impression des solutions (Avec / Sans Solutions) */}
          <button 
            type="button"
            onClick={handleToggleSolutions}
            className="btn-outline"
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '99px',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: includeSolutionsInPdf ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
              color: includeSolutionsInPdf ? '#059669' : 'var(--text-muted)',
              borderColor: includeSolutionsInPdf ? 'rgba(16, 185, 129, 0.4)' : 'var(--border)',
              transition: 'all 0.15s ease',
              cursor: 'pointer'
            }}
            title={includeSolutionsInPdf ? 'Solutions incluses dans le PDF et l\'impression' : 'Solutions exclues (sans solutions)'}
          >
            {includeSolutionsInPdf ? (
              <><Check size={14} strokeWidth={2.5} /> Avec Solutions</>
            ) : (
              <><X size={14} strokeWidth={2.5} /> Sans Solutions</>
            )}
          </button>

          {/* PDF Download button */}
          <button 
            onClick={handleExportPDF}
            disabled={isExporting}
            className="btn"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 800,
              borderRadius: '99px',
              background: 'linear-gradient(135deg, #005086, #007cc6)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: isExporting ? 'not-allowed' : 'pointer'
            }}
            title={viewSummaryMode ? 'Télécharger PDF (3 Colonnes)' : 'Télécharger PDF'}
          >
            {isExporting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Export...</>
              : <><Download size={15} /> Télécharger PDF</>}
          </button>

          {/* Edit button */}
          {user?.role === 'admin' && (
            <button 
              onClick={() => navigate(`/admin/lessons/${id}/edit`, { state: { from: window.location.pathname } })}
              className="btn-outline"
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: '99px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                border: '1px solid var(--border)'
              }}
            >
              <Edit size={15} /> Éditer
            </button>
          )}
        </div>
      </div>

      {/* ── COURSE SUMMARY TEMPLATE VIEW MODE ── */}
      {viewSummaryMode ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          marginBottom: '2rem',
          overflowX: 'auto'
        }}>
          <CourseSummaryTemplate data={lesson} />
        </div>
      ) : (

      /* ── MAIN WORKsheet CONTAINER — ref used by html2canvas PDF export ── */
      <div ref={sheetRef} className={`sheet-container ${includeSolutionsInPdf ? '' : 'hide-solutions-print'}`}>
        
        {/* Print-only header row (3 columns) — hidden on screen, shows on print */}
        <header className="print-only-header" style={{
          display: 'none',
          gridTemplateColumns: '1fr 1.5fr 1fr',
          borderBottom: '2px solid #005086',
          marginBottom: '1.5rem',
          paddingBottom: '0.75rem',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.75rem', color: '#1a202c', fontWeight: 700 }}>
            <span>{header?.prep_title || ''}</span>
            <span style={{ color: '#005086' }}>{header?.schools?.join(' - ') || ''}</span>
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{header?.subject || lesson?.subject || ''}</span>
            <span style={{ fontWeight: 900, fontSize: '1rem', color: '#b91c1c', textDecoration: 'underline' }}>{renderWithMath(header?.fiche_title || lesson?.title || '')}</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#1a202c', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '0.1rem', alignItems: 'flex-end' }}>
            <span>{header?.teacher || profName || ''}</span>
            {(header?.phone || profPhone) && <span style={{ color: '#4b5563' }}>{header?.phone || profPhone}</span>}
          </div>
        </header>

        {/* Screen & Print Pedagogical Header Table — ONLY FOR LESSONS / COURSES */}
        {!(lesson?.docType === 'exercises' || lesson?.docType === 'homework' || lesson?.type === 'exercises' || lesson?.type === 'homework' || lesson?.content?.doc_type === 'homework') && (
          <table className="fiche-pedagogique-header" style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            border: '1.5px solid #005086',
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '1.25rem',
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(0,80,134,0.06)'
          }}>
            <tbody>
              <tr>
                {/* Left Main Content Block (73% width) */}
                <td style={{ width: '73%', padding: 0, borderRight: '1.5px solid #005086', borderBottom: 'none' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {/* Top Main Title Row */}
                      <tr>
                        <td colSpan={2} className="title-cell" style={{
                          background: '#005086',
                          color: '#ffffff',
                          textAlign: 'center',
                          fontWeight: 900,
                          fontSize: '1.25rem',
                          padding: '0.65rem 1rem',
                          letterSpacing: '0.04em',
                          borderBottom: '1.5px solid #005086'
                        }}>
                          <input
                            type="text"
                            value={header.fiche_title || header.subject || "CALCULS D' INTEGRALS"}
                            onChange={(e) => handleHeaderChange('fiche_title', e.target.value)}
                            placeholder="Titre de la fiche..."
                            style={{
                              width: '100%',
                              fontSize: '1.2rem',
                              background: 'transparent',
                              color: '#ffffff',
                              border: 'none',
                              textAlign: 'center',
                              fontWeight: 900,
                              outline: 'none',
                              fontFamily: 'inherit'
                            }}
                          />
                        </td>
                      </tr>

                      {/* Middle Row: Capacités Attendues & Contenus */}
                      <tr>
                        {/* Red Line 1: LES CAPACITÉS ATTENDUES */}
                        <td style={{ width: '50%', padding: 0, verticalAlign: 'top', borderRight: '1.5px solid #005086', borderBottom: '1.5px solid #005086' }}>
                          <div className="header-section-title" style={{ background: '#f8fafc', color: '#005086', fontWeight: 800, textAlign: 'center', padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderBottom: '1.5px solid #005086', textTransform: 'uppercase' }}>
                            {isArabic ? 'القدرات المنتظرة' : 'LES CAPACITÉS ATTENDUES'}
                          </div>
                          <div style={{ padding: '0.4rem 0.5rem', minHeight: '65px' }}>
                            <textarea
                              value={header.capacites_attendues || ''}
                              onChange={(e) => handleHeaderChange('capacites_attendues', e.target.value)}
                              placeholder={isArabic ? 'انقر هنا لإضافة القدرات المنتظرة...' : 'Cliquer ici pour ajouter les capacités attendues...'}
                              rows={3}
                              style={{
                                width: '100%',
                                fontSize: '0.82rem',
                                border: '1px dashed rgba(0,80,134,0.25)',
                                background: 'rgba(0,80,134,0.02)',
                                padding: '0.35rem',
                                borderRadius: '4px',
                                resize: 'vertical',
                                outline: 'none',
                                color: '#0f172a',
                                fontFamily: 'inherit'
                              }}
                            />
                          </div>
                        </td>

                        {/* Red Line 2: CONTENUS */}
                        <td style={{ width: '50%', padding: 0, verticalAlign: 'top', borderBottom: '1.5px solid #005086' }}>
                          <div className="header-section-title" style={{ background: '#f8fafc', color: '#005086', fontWeight: 800, textAlign: 'center', padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderBottom: '1.5px solid #005086', textTransform: 'uppercase' }}>
                            {isArabic ? 'المحتويات' : 'CONTENUS'}
                          </div>
                          <div style={{ padding: '0.4rem 0.5rem', minHeight: '65px' }}>
                            <textarea
                              value={header.contenus || ''}
                              onChange={(e) => handleHeaderChange('contenus', e.target.value)}
                              placeholder={isArabic ? 'انقر هنا لإضافة المحتويات...' : 'Cliquer ici pour ajouter les contenus...'}
                              rows={3}
                              style={{
                                width: '100%',
                                fontSize: '0.82rem',
                                border: '1px dashed rgba(0,80,134,0.25)',
                                background: 'rgba(0,80,134,0.02)',
                                padding: '0.35rem',
                                borderRadius: '4px',
                                resize: 'vertical',
                                outline: 'none',
                                color: '#0f172a',
                                fontFamily: 'inherit'
                              }}
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Bottom Row: Red Line 3: LE CONTENU */}
                      <tr>
                        <td colSpan={2} style={{ padding: 0, verticalAlign: 'top' }}>
                          <div className="header-section-title" style={{ background: '#f8fafc', color: '#005086', fontWeight: 800, textAlign: 'center', padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderBottom: '1.5px solid #005086', textTransform: 'uppercase' }}>
                            {isArabic ? 'المحتوى' : 'LE CONTENU'}
                          </div>
                          <div style={{ padding: '0.4rem 0.6rem', minHeight: '50px' }}>
                            <textarea
                              value={header.le_contenu || ''}
                              onChange={(e) => handleHeaderChange('le_contenu', e.target.value)}
                              placeholder={isArabic ? 'انقر هنا لإضافة المحتوى العام...' : 'Cliquer ici pour ajouter le contenu général...'}
                              rows={2}
                              style={{
                                width: '100%',
                                fontSize: '0.82rem',
                                border: '1px dashed rgba(0,80,134,0.25)',
                                background: 'rgba(0,80,134,0.02)',
                                padding: '0.35rem',
                                borderRadius: '4px',
                                resize: 'vertical',
                                outline: 'none',
                                color: '#0f172a',
                                fontFamily: 'inherit'
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>

                {/* Right Metadata Side (27% width) */}
                <td style={{ width: '27%', padding: 0, verticalAlign: 'top', borderBottom: 'none' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '0.45rem 0.65rem', borderBottom: '1.5px solid #005086', fontSize: '0.8rem' }}>
                          <strong style={{ color: '#005086' }}>{isArabic ? 'الأكاديمية' : 'Académie'} :</strong><br/>
                          <input
                            type="text"
                            value={header.academie || 'FES-MEKNES'}
                            onChange={(e) => handleHeaderChange('academie', e.target.value)}
                            style={{ width: '100%', fontSize: '0.78rem', border: '1px solid rgba(0,80,134,0.2)', background: 'transparent', fontWeight: 600, color: '#1e293b', outline: 'none', marginTop: '2px', borderRadius: '3px', padding: '0.1rem 0.25rem' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.45rem 0.65rem', borderBottom: '1.5px solid #005086', fontSize: '0.8rem' }}>
                          <strong style={{ color: '#005086' }}>{isArabic ? 'المديرية الإقليمية' : 'Direction Provinciale'} :</strong><br/>
                          <input
                            type="text"
                            value={header.direction || 'MY'}
                            onChange={(e) => handleHeaderChange('direction', e.target.value)}
                            style={{ width: '100%', fontSize: '0.78rem', border: '1px solid rgba(0,80,134,0.2)', background: 'transparent', fontWeight: 600, color: '#1e293b', outline: 'none', marginTop: '2px', borderRadius: '3px', padding: '0.1rem 0.25rem' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.45rem 0.65rem', borderBottom: '1.5px solid #005086', fontSize: '0.8rem' }}>
                          <strong style={{ color: '#005086' }}>{isArabic ? 'المؤسسة' : 'Etablissement'} :</strong><br/>
                          <input
                            type="text"
                            value={header.etablissement || '18 NOVEMBRE'}
                            onChange={(e) => handleHeaderChange('etablissement', e.target.value)}
                            style={{ width: '100%', fontSize: '0.78rem', border: '1px solid rgba(0,80,134,0.2)', background: 'transparent', fontWeight: 600, color: '#1e293b', outline: 'none', marginTop: '2px', borderRadius: '3px', padding: '0.1rem 0.25rem' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.45rem 0.65rem', borderBottom: '1.5px solid #005086', fontSize: '0.8rem' }}>
                          <strong style={{ color: '#005086' }}>{isArabic ? 'الأهمية' : "Degré d'importance"} :</strong><br/>
                          <input
                            type="text"
                            value={header.degre_importance || '40%'}
                            onChange={(e) => handleHeaderChange('degre_importance', e.target.value)}
                            style={{ width: '100%', fontSize: '0.78rem', border: 'none', background: '#fef08a', color: '#854d0e', fontWeight: 800, padding: '1px 5px', borderRadius: '3px', outline: 'none', marginTop: '2px' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem', borderBottom: 'none' }}>
                          <strong style={{ color: '#005086' }}>{isArabic ? 'ملاحظات' : 'Remarques'} :</strong><br/>
                          <input
                            type="text"
                            value={header.remarques || ''}
                            onChange={(e) => handleHeaderChange('remarques', e.target.value)}
                            placeholder="Remarques..."
                            style={{ width: '100%', fontSize: '0.78rem', border: '1px solid rgba(0,80,134,0.2)', background: 'transparent', color: '#1e293b', outline: 'none', marginTop: '2px', borderRadius: '3px', padding: '0.1rem 0.25rem' }}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* WORKBOOK MAIN BODY */}
        <div className="sheet-body" dir={lessonDir} style={isArabic ? { fontFamily: arabicFont } : {}}>
          {/* Direct Edit Mode Banner */}
          {isDirectEdit && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: 'rgba(79,70,229,0.08)',
              border: '1.5px dashed rgba(79,70,229,0.35)',
              borderRadius: '10px',
              padding: '0.65rem 1.1rem',
              marginBottom: '1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--violet)',
              flexWrap: 'wrap',
            }}>
              <Edit size={15} />
              <span>
                {isArabic
                  ? 'أنت الآن في وضع التعديل المباشر — يمكنك تعديل النصوص والعناوين. انقر على حقل لبدء التعديل.'
                  : 'Mode Modification Directe — Cliquez sur un champ pour le modifier. Les formules LaTeX entre $ sont supportées.'}
              </span>
            </div>
          )}
          {/* Arabic badge for translated lessons */}
          {isArabic && (
            <div style={{
              display: 'inline-flex', alignSelf: 'center', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(66,133,244,0.08)', border: '1px solid rgba(66,133,244,0.2)',
              borderRadius: '99px', padding: '0.3rem 1rem', marginBottom: '-0.5rem',
              fontSize: '0.75rem', fontWeight: 700, color: '#4285F4',
              direction: 'rtl', fontFamily: arabicFont,
            }}>
              🌐 Version Arabe — Traduction IA
            </div>
          )}
          {/* Centered blue banner title (hidden for homework/Devoir Surveillé as it is already in the ANISSE Cartouche Header) */}
          {!(lesson?.docType === 'homework' || lesson?.content?.doc_type === 'homework' || lesson?.type === 'homework') && (
            <div className="sheet-header-banner" style={{
              margin: '0 auto 2rem', display: 'inline-flex',
              fontFamily: isArabic ? arabicFont : 'inherit',
              direction: lessonDir,
            }}>
              {renderWithMath(header.fiche_title || header.subject || "Fiche de Cours")}
            </div>
          )}

          <div className={`sections-list-container ${
            (lesson?.docType === 'exercises' || lesson?.content?.doc_type === 'exercises')
              ? (seriesColumns === 3 ? 'exercises-three-columns-layout' : (seriesColumns === 2 ? 'exercises-two-columns-layout' : ''))
              : ''
          }`}>
            {sections?.map((sec, idx) => {
              const isTheory = sec.type !== 'exercise';
              const { number: exeNumber, label: exeLabel, prefix: exePrefix } = !isTheory 
                ? parseExerciseTitle(sec.title, idx, isArabic)
                : { number: '', label: '', prefix: '' };
              
              // Decide whether to show section header row
              const prevSec = idx > 0 ? sections[idx - 1] : null;
              const showSectionHeader = sec.section_header && (!prevSec || prevSec.section_header !== sec.section_header);
              
              return (
                <div key={sec.id || idx} className="exercise-section-wrapper" style={{ display: 'block', width: '100%', marginBottom: '1.25rem' }}>
                  {(showSectionHeader || (isDirectEdit && sec.section_header !== undefined)) && sec.section_header !== undefined && (
                    <div
                      className="section-header-row"
                      style={{
                        marginTop: idx > 0 ? '1.5rem' : '0',
                        marginBottom: '0.75rem',
                        flexDirection: isArabic ? 'row-reverse' : 'row',
                      }}
                    >
                      {isDirectEdit ? (
                        <input
                          type="text"
                          value={sec.section_number || ''}
                          onChange={(e) => handleSectionNumberChange(sec.id, e.target.value)}
                          style={{
                            width: '2.2rem',
                            height: '2.2rem',
                            borderRadius: '50%',
                            background: '#005086',
                            color: '#ffffff',
                            border: '2px solid rgba(255,255,255,0.3)',
                            textAlign: 'center',
                            fontWeight: 900,
                            fontSize: '0.85rem',
                            flexShrink: 0
                          }}
                        />
                      ) : (
                        <div className="section-badge-circle">{sec.section_number || '1'}</div>
                      )}
                      {isDirectEdit ? (
                        <input
                          type="text"
                          value={sec.section_header || ''}
                          onChange={(e) => handleSectionHeaderChange(sec.id, e.target.value)}
                          style={{
                            flex: 1,
                            fontFamily: isArabic ? arabicFont : 'inherit',
                            direction: lessonDir,
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: '#005086',
                            border: '1px solid rgba(0,80,134,0.25)',
                            borderRadius: '8px',
                            padding: '0.3rem 0.65rem',
                            background: 'rgba(0,80,134,0.04)'
                          }}
                        />
                      ) : (
                        <div
                          className="section-title-pill"
                          style={{ fontFamily: isArabic ? arabicFont : 'inherit', direction: lessonDir }}
                        >
                          {renderWithMath(sec.section_header)}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {isTheory ? (() => {
                    const type = sec.type || 'content';
                    const titleLower = (sec.title || '').toLowerCase();
                    
                    const isDefinition = type === 'definition' || titleLower.includes('définition') || titleLower.includes('definition') || titleLower.includes('تعريف');
                    const isProperty = type === 'property' || titleLower.includes('propriété') || titleLower.includes('propriete') || titleLower.includes('خاصية');
                    const isTheorem = type === 'theorem' || titleLower.includes('théorème') || titleLower.includes('theoreme') || titleLower.includes('مبرهنة');
                    const isCorollary = type === 'corollary' || titleLower.includes('corollaire') || titleLower.includes('نتيجة');
                    const isExample = type === 'example' || titleLower.includes('exemple') || titleLower.includes('مثال');
                    const isRemark = type === 'remark' || titleLower.includes('remarque') || titleLower.includes('ملاحظة');
                    const isActivity = type === 'activity' || titleLower.includes('activité') || titleLower.includes('activite') || titleLower.includes('تطبيق');

                    let cardStyle = {
                      ...(isArabic ? { fontFamily: arabicFont } : {}),
                    };

                    let headerStyle = {
                      flexDirection: isArabic ? 'row-reverse' : 'row',
                      textAlign: isArabic ? 'right' : 'left',
                      fontFamily: isArabic ? arabicFont : 'inherit',
                    };

                    if (isDefinition) {
                      cardStyle = {
                        ...cardStyle,
                        border: '1.5px solid var(--violet)',
                        background: 'var(--violet-soft)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                      };
                      headerStyle = {
                        ...headerStyle,
                        color: 'var(--violet)',
                        borderBottom: '1px dashed rgba(79, 70, 229, 0.25)',
                      };
                    } else if (isProperty) {
                      cardStyle = {
                        ...cardStyle,
                        border: '1.5px solid var(--emerald)',
                        background: 'var(--emerald-soft)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                      };
                      headerStyle = {
                        ...headerStyle,
                        color: 'var(--emerald)',
                        borderBottom: '1px dashed rgba(5, 150, 105, 0.25)',
                      };
                    } else if (isTheorem) {
                      cardStyle = {
                        ...cardStyle,
                        border: '1.5px solid var(--danger)',
                        background: 'var(--danger-soft)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                      };
                      headerStyle = {
                        ...headerStyle,
                        color: 'var(--danger)',
                        borderBottom: '1px dashed rgba(220, 38, 38, 0.25)',
                      };
                    } else if (isCorollary) {
                      cardStyle = {
                        ...cardStyle,
                        border: '1.5px solid var(--warning)',
                        background: 'var(--warning-soft)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                      };
                      headerStyle = {
                        ...headerStyle,
                        color: 'var(--warning)',
                        borderBottom: '1px dashed rgba(217, 119, 6, 0.25)',
                      };
                    } else if (isExample) {
                      cardStyle = {
                        ...cardStyle,
                        border: 'none',
                        background: 'rgba(148, 163, 184, 0.04)',
                        padding: '1rem 1.25rem',
                        borderRadius: '8px',
                        boxShadow: 'none',
                        ...(isArabic ? {
                          borderRight: '4px solid var(--text-subtle)',
                        } : {
                          borderLeft: '4px solid var(--text-subtle)',
                        })
                      };
                      headerStyle = {
                        ...headerStyle,
                        color: 'var(--text-main)',
                        fontWeight: '800',
                        borderBottom: 'none',
                        marginBottom: '0.25rem',
                        paddingBottom: 0,
                      };
                    } else if (isRemark) {
                      cardStyle = {
                        ...cardStyle,
                        border: '1px solid rgba(217, 119, 6, 0.15)',
                        background: 'var(--warning-soft)',
                        padding: '1rem 1.25rem',
                        borderRadius: '8px',
                        boxShadow: 'none',
                        ...(isArabic ? {
                          borderRight: '4px solid var(--warning)',
                        } : {
                          borderLeft: '4px solid var(--warning)',
                        })
                      };
                      headerStyle = {
                        ...headerStyle,
                        color: 'var(--warning)',
                        fontWeight: '800',
                        borderBottom: 'none',
                        marginBottom: '0.25rem',
                        paddingBottom: 0,
                      };
                    } else if (isActivity) {
                      cardStyle = {
                        ...cardStyle,
                        border: '1px solid rgba(79, 70, 229, 0.15)',
                        background: 'var(--violet-soft)',
                        padding: '1rem 1.25rem',
                        borderRadius: '8px',
                        boxShadow: 'none',
                        ...(isArabic ? {
                          borderRight: '4px solid var(--violet)',
                        } : {
                          borderLeft: '4px solid var(--violet)',
                        })
                      };
                      headerStyle = {
                        ...headerStyle,
                        color: 'var(--violet)',
                        fontWeight: '800',
                        borderBottom: 'none',
                        marginBottom: '0.25rem',
                        paddingBottom: 0,
                      };
                    } else {
                      cardStyle = {
                        ...cardStyle,
                        border: 'none',
                        background: 'transparent',
                        padding: '0.25rem 0 0.25rem 1rem',
                        boxShadow: 'none',
                        borderRadius: 0,
                        ...(isArabic ? {
                          borderRight: '3px solid rgba(0,80,134,0.15)',
                        } : {
                          borderLeft: '3px solid rgba(0,80,134,0.15)',
                        })
                      };
                      headerStyle = {
                        ...headerStyle,
                        borderBottom: '1px dashed rgba(0, 80, 134, 0.15)',
                      };
                    }

                    const customTheoryBg = sec.bgColor || sec.bg_color || '';
                    const customTheoryFontSize = sec.fontSize || sec.font_size || '';
                    const customTheoryLineHeight = sec.lineHeight || sec.line_height || '';
                    if (customTheoryBg && customTheoryBg !== 'transparent' && customTheoryBg !== '#ffffff') {
                      cardStyle.background = `${customTheoryBg} !important`;
                      cardStyle.border = '1px solid rgba(0,80,134,0.2)';
                    }
                    if (customTheoryFontSize) {
                      cardStyle.fontSize = `${customTheoryFontSize} !important`;
                    }
                    if (customTheoryLineHeight) {
                      cardStyle.lineHeight = `${customTheoryLineHeight} !important`;
                    }

                    return (
                    <div
                      className="subsection-card"
                      style={cardStyle}
                    >
                      <div
                        className="subsection-header-inline"
                        style={headerStyle}
                      >
                        {isDirectEdit ? (
                          <input
                            type="text"
                            value={sec.title || ''}
                            onChange={(e) => handleTitleChange(sec.id, e.target.value)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1.5px dashed rgba(79,70,229,0.4)',
                              outline: 'none',
                              fontSize: 'inherit',
                              fontWeight: 'inherit',
                              color: 'inherit',
                              width: '100%',
                              fontFamily: 'inherit',
                              padding: '0.1rem 0',
                              direction: lessonDir,
                            }}
                          />
                        ) : (
                          <span>{renderWithMath(sec.title)}</span>
                        )}
                        {sec.accent_text && (
                          <span className="accent-green-text" style={{ display: 'block', marginTop: '0.35rem', fontStyle: 'italic' }}>
                            {renderWithMath(sec.accent_text.replace(/\\n/g, '\n'))}
                          </span>
                        )}
                      </div>

                      {sec.items?.map((item, itemIdx) => {
                        if (item.type === 'grid_items' || Array.isArray(item.grid_items)) {
                          const gList = item.grid_items || item.items || [];
                          const minWidthVal = isMobile ? '100%' : '240px';
                          return (
                            <div
                              key={itemIdx}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(auto-fit, minmax(${minWidthVal}, 1fr))`,
                                gap: '0.75rem 1.25rem',
                                margin: '0.85rem 0',
                                direction: lessonDir
                              }}
                            >
                              {gList.map((gItem, gIdx) => {
                                const gText = typeof gItem === 'string' ? gItem : (gItem?.text || '');
                                return (
                                  <div 
                                    key={gIdx} 
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'flex-start', 
                                      gap: '0.5rem', 
                                      background: 'rgba(255,255,255,0.02)', 
                                      padding: '0.6rem 0.85rem', 
                                      borderRadius: '10px', 
                                      border: '1px solid var(--border)',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                    }}
                                  >
                                    <span style={{ color: 'var(--violet)', fontWeight: 900, fontSize: '0.9rem' }}>•</span>
                                    <div style={{ flex: 1, fontFamily: isArabic ? arabicFont : 'inherit' }}>
                                      {renderWithMath(gText)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        if (item.type === 'highlight_box') {
                          return (
                            <div
                              key={itemIdx}
                              className="classic-highlight-box"
                              style={isArabic ? { direction: 'rtl', textAlign: 'right', fontFamily: arabicFont } : {}}
                            >
                              {renderWithMath(item.text)}
                            </div>
                          );
                        }

                        if (item.type === 'table') {
                          return (
                            <div key={itemIdx} style={{ margin: '1.25rem 0', width: '100%' }}>
                              <SmartTableRenderer
                                table={item.table || item.data || item.text || item}
                                title={item.title}
                              />
                            </div>
                          );
                        }

                        if (item.type === 'image') {
                          const align = item.align || 'center';
                          const widthPct = item.width_pct || 80;
                          const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
                          const rawUrl = (item.url || '').trim();
                          const altText = item.alt || item.description || '';
                          const altLower = altText.toLowerCase();
                          const urlLower = rawUrl.toLowerCase();
                          
                          const isInvalidUrl = !rawUrl || rawUrl.length < 5 || rawUrl.includes('placeholder') || rawUrl.includes('example.com') || rawUrl === 'none' || rawUrl === 'url' || rawUrl === 'image';
                          const isSignTable = altLower.includes('tableau de signe') || altLower.includes('sign_table') || urlLower.includes('sign_table');

                          if (isSignTable) {
                            return (
                              <div key={itemIdx} style={{ display: 'flex', justifyContent: justifyMap[align], width: '100%', margin: '0.75rem 0' }}>
                                <SignTableViewer altText={altText || rawUrl} />
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={itemIdx} 
                              style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: justifyMap[align], 
                                margin: '1.25rem 0',
                                width: '100%' 
                              }}
                            >
                              <div 
                                style={{ 
                                  background: 'var(--bg-card)', 
                                  border: '1px solid var(--border)', 
                                  borderRadius: '16px', 
                                  padding: '0.85rem', 
                                  boxShadow: '0 4px 20px rgba(0,0,0,0.06)', 
                                  display: 'inline-flex', 
                                  flexDirection: 'column', 
                                  alignItems: 'center',
                                  maxWidth: `${widthPct}%`,
                                  minWidth: '260px'
                                }}
                              >
                                {isInvalidUrl ? (
                                  <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-subtle)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', width: '100%' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>📈</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{altText ? renderWithMath(altText) : (isArabic ? 'شكل هندسي / منحنى دالة' : 'Figure / Courbe représentative')}</div>
                                  </div>
                                ) : (
                                  <img
                                    src={rawUrl}
                                    alt={altText || 'Figure'}
                                    style={{
                                      width: '100%',
                                      maxHeight: '400px',
                                      borderRadius: '10px',
                                      display: 'block',
                                      objectFit: 'contain',
                                    }}
                                  />
                                )}
                                
                                {altText && (
                                  <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>
                                    {renderWithMath(altText)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        if (item.type === 'notation_grid') {
                          return (
                            <div key={itemIdx} className="notation-grid">
                              {item.notation_columns?.map((col, colIdx) => (
                                <div
                                  key={colIdx}
                                  className="notation-column"
                                  style={isArabic ? {
                                    borderLeft: 'none',
                                    borderRight: '2px solid rgba(0,80,134,0.15)',
                                    paddingLeft: 0,
                                    paddingRight: '1rem',
                                  } : {}}
                                >
                                  <strong style={{ fontSize: '0.85rem', color: '#005086', fontFamily: isArabic ? arabicFont : 'inherit' }}>{col.title}</strong>
                                  {col.math_blocks?.map((block, bIdx) => (
                                    <div key={bIdx} style={{ display: 'block', margin: '0.5rem 0' }}>
                                      {renderWithMath(block)}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        if (item.type === 'table') {
                          return (
                            <div key={itemIdx} style={{ overflowX: 'auto', width: '100%', margin: '0.5rem 0' }}>
                              <table className="sheet-table" style={isArabic ? { direction: 'rtl' } : {}}>
                                <thead>
                                  <tr>
                                    {item.table_data?.headers?.map((h, hIdx) => (
                                      <th key={hIdx} style={isArabic ? { fontFamily: arabicFont } : {}}>{renderWithMath(h)}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.table_data?.rows?.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} style={isArabic ? { fontFamily: arabicFont } : {}}>{renderWithMath(cell)}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        }
                        // text / bullet
                        return (
                          <div
                            key={itemIdx}
                            className="bullet-item"
                            style={isArabic ? {
                              flexDirection: 'row-reverse',
                              textAlign: 'right',
                              fontFamily: arabicFont,
                            } : {}}
                          >
                            {item.type === 'bullet' && (
                              <span className="bullet-dot" style={isArabic ? { marginLeft: '0.5rem', marginRight: 0 } : {}}>•</span>
                            )}
                            {isDirectEdit ? (
                              <textarea
                                value={item.text || ''}
                                onChange={(e) => {
                                  setLesson(prev => {
                                    if (!prev) return prev;
                                    const updatedSections = prev.content.sections.map(s => {
                                      if (s.id !== sec.id) return s;
                                      const newItems = (s.items || []).map((it, i) => i === itemIdx ? { ...it, text: e.target.value } : it);
                                      return { ...s, items: newItems };
                                    });
                                    return { ...prev, content: { ...prev.content, sections: updatedSections } };
                                  });
                                }}
                                style={{
                                  flex: 1,
                                  border: '1px solid rgba(0,80,134,0.15)',
                                  borderRadius: '4px',
                                  background: 'rgba(255,255,255,0.7)',
                                  padding: '0.3rem 0.5rem',
                                  fontSize: '0.95rem',
                                  color: '#1a202c',
                                  fontFamily: isArabic ? arabicFont : 'inherit',
                                  resize: 'vertical',
                                  minHeight: '2.2rem',
                                  width: '100%',
                                  direction: lessonDir
                                }}
                              />
                            ) : (
                              <span style={{ flex: 1 }}>{renderWithMath(item.text)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : (
                    (() => {
                      const isHomework = lesson.docType === 'homework' || lesson.content?.doc_type === 'homework';
                      if (isHomework) {
                        return (
                          <div className="homework-table" style={isArabic ? { fontFamily: arabicFont } : {}}>
                            <div className="homework-header-row">
                              <div className="homework-bareme-header">{calculateTotalPoints(sec.content, isArabic)}</div>
                              <div className="homework-content-header">
                                {isArabic ? 'تمرين' : 'Exercice'} {exeNumber} {exeLabel ? ` : ${exeLabel}` : ''}
                              </div>
                            </div>
                            
                            {renderHomeworkBody(sec.content, isArabic, arabicFont, renderWithMath, sec.id, handlePointsChange, isDirectEdit, handleContentChange)}

                            {/* Interactive student checks inside homework row */}
                            {sec.interactive_answers?.length > 0 && (
                              <div className="homework-row no-print" style={{ background: 'rgba(0,80,134,0.01)' }}>
                                <div className="homework-bareme-cell" style={{ color: '#005086' }}><Calculator size={18} /></div>
                                <div className="homework-content-cell">
                                  <form 
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      sec.interactive_answers.forEach(ans => {
                                        handleCheckAnswer(sec.id, ans.question_idx, ans.expected_answer);
                                      });
                                    }}
                                    className="interactive-form no-print"
                                    style={{ margin: 0 }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#005086', marginBottom: '0.5rem' }}>
                                      <Calculator size={16} /> Mode interactif : Calculez et valisez vos résultats
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                      {sec.interactive_answers.map((ans, ansIdx) => {
                                        const ansKey = `${sec.id}-${ans.question_idx}`;
                                        return (
                                          <div key={ansIdx} style={{ flex: 1, minWidth: '120px' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                              {ans.label}
                                            </label>
                                            <input 
                                              type="text" 
                                              placeholder="Votre réponse"
                                              value={studentAnswers[ansKey] || ''} 
                                              onChange={(e) => setStudentAnswers(prev => ({ ...prev, [ansKey]: e.target.value }))}
                                              className="input-control" 
                                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                      <button type="submit" className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', width: 'fit-content' }}>
                                        Vérifier mes réponses
                                      </button>

                                      {sec.interactive_answers.every(ans => checkResults[`${sec.id}-${ans.question_idx}`] === 'success') && (
                                        <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <Check size={16} strokeWidth={3} /> Réponses correctes !
                                        </span>
                                      )}
                                      {sec.interactive_answers.some(ans => checkResults[`${sec.id}-${ans.question_idx}`] === 'error') && (
                                        <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <X size={16} strokeWidth={3} /> Mauvaise réponse, réessayez.
                                        </span>
                                      )}
                                    </div>
                                  </form>
                                </div>
                              </div>
                            )}

                            {/* Solution block in homework row */}
                            {sec.solution && (
                              <div className="homework-row no-print" style={{ background: 'rgba(16,185,129,0.01)' }}>
                                <div className="homework-bareme-cell" style={{ background: 'rgba(16,185,129,0.03)', color: '#059669', cursor: 'pointer', borderTop: '1px solid rgba(16,185,129,0.12)' }} onClick={() => toggleSolution(sec.id)}>
                                  📖
                                </div>
                                <div className="homework-content-cell" style={{ borderTop: '1px solid rgba(16,185,129,0.12)' }}>
                                  <button 
                                    className="solution-link-btn"
                                    onClick={() => toggleSolution(sec.id)}
                                    style={{ padding: '0.25rem 0', fontFamily: isArabic ? arabicFont : 'inherit', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}
                                  >
                                    {visibleSolutions[sec.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                    {isArabic
                                      ? (visibleSolutions[sec.id] ? 'إخفاء الحل' : 'إظهار الحل المفصل')
                                      : (visibleSolutions[sec.id] ? 'Masquer la solution' : 'Afficher la solution rédigée')
                                    }
                                  </button>

                                  {visibleSolutions[sec.id] && (
                                    <div className="solution-block" style={{ marginTop: '0.65rem', padding: '0.75rem 0 0', borderTop: '1px dashed rgba(16,185,129,0.2)' }}>
                                      <h4 style={{ color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.95rem', flexDirection: isArabic ? 'row-reverse' : 'row', fontFamily: isArabic ? arabicFont : 'inherit' }}>
                                        <BookOpenCheck size={16} />
                                        {isArabic ? 'الحل المفصل' : 'Démonstration rédigée'}
                                      </h4>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem', lineHeight: 1.8, textAlign: isArabic ? 'right' : 'left', fontFamily: isArabic ? arabicFont : 'inherit', direction: isArabic ? 'rtl' : 'ltr' }}>
                                        {renderWithMath(sec.solution)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className="exercise-wrapper" style={isArabic ? { fontFamily: arabicFont } : {}}>
                          <div
                            className="exercise-banner-row"
                            style={isArabic ? { flexDirection: 'row' } : {}}
                          >
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                              flexDirection: isArabic ? 'row' : 'row',
                            }}>
                              <div className="exercise-pill" style={isArabic ? { fontFamily: arabicFont, flexDirection: 'row' } : {}}>
                                <span>
                                  {isArabic
                                    ? (exePrefix === 'Application' ? 'تطبيق' : exePrefix === 'Activité' ? 'نشاط' : 'تمرين')
                                    : (exePrefix || 'Exercice N°')
                                  }
                                </span>
                                <span style={{
                                  background: '#ffffff', color: '#005086',
                                  minWidth: '20px', height: '20px', borderRadius: '10px',
                                  padding: '0 5px',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.75rem', fontWeight: 900,
                                  whiteSpace: 'nowrap'
                                }}>{exeNumber}</span>
                              </div>
                              {exeLabel && (
                                <span style={{
                                  fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)',
                                  display: 'inline-flex', alignItems: 'center',
                                  fontFamily: isArabic ? arabicFont : 'inherit',
                                }}>
                                  {renderWithMath(exeLabel)}
                                </span>
                              )}
                            </div>

                            <button
                              className="solution-link-btn no-print"
                              onClick={() => toggleSolution(sec.id)}
                              style={isArabic ? { fontFamily: arabicFont, flexDirection: 'row' } : {}}
                            >
                              {visibleSolutions[sec.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                              {isArabic
                                ? (visibleSolutions[sec.id] ? 'إخفاء الحل' : 'إظهار الحل المفصل')
                                : (visibleSolutions[sec.id] ? 'Masquer la solution' : 'Afficher la solution rédigée')
                              }
                            </button>
                          </div>

                          {(() => {
                            const customBg = sec.bgColor || sec.bg_color || '';
                            const customFontSize = sec.fontSize || sec.font_size || '';
                            const customLineHeight = sec.lineHeight || sec.line_height || '';
                            const hasCustomBg = customBg && customBg !== 'transparent' && customBg !== '#ffffff';

                            return (
                              <div
                                className={`exercise-body-box ${hasCustomBg ? 'has-custom-bg' : ''}`}
                                style={{
                                  ...(isArabic ? {
                                    textAlign: 'right',
                                    fontFamily: arabicFont,
                                    direction: 'rtl',
                                  } : {}),
                                  background: hasCustomBg ? `${customBg} !important` : undefined,
                                  padding: hasCustomBg ? '0.75rem 1rem' : undefined,
                                  borderRadius: hasCustomBg ? '8px' : undefined,
                                  border: hasCustomBg ? '1px solid rgba(0,80,134,0.18)' : undefined,
                                  fontSize: customFontSize ? `${customFontSize} !important` : undefined,
                                  lineHeight: customLineHeight ? `${customLineHeight} !important` : undefined,
                                }}
                              >
                                {/* Direct Edit Style Toolbar */}
                                {isDirectEdit && (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    flexWrap: 'wrap',
                                    background: 'var(--bg-card, #f8fafc)',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border, #cbd5e1)',
                                    marginBottom: '0.6rem'
                                  }}>
                                    {/* Background color */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <Palette size={13} style={{ color: '#005086' }} />
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>{isArabic ? 'الخلفية:' : 'Fond :'}</span>
                                      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                        {[
                                          { label: 'Sans fond', val: 'transparent', color: '#ffffff', border: '#cbd5e1' },
                                          { label: 'Bleu ciel', val: '#f0f9ff', color: '#f0f9ff', border: '#bae6fd' },
                                          { label: 'Jaune doux', val: '#fefce8', color: '#fefce8', border: '#fef08a' },
                                          { label: 'Vert menthe', val: '#f0fdf4', color: '#f0fdf4', border: '#bbf7d0' },
                                          { label: 'Gris élégant', val: '#f8fafc', color: '#f8fafc', border: '#e2e8f0' },
                                          { label: 'Rose pastel', val: '#fff1f2', color: '#fff1f2', border: '#fecdd3' }
                                        ].map(c => (
                                          <button
                                            key={c.val}
                                            type="button"
                                            onClick={() => handleUpdateSectionStyle(sec.id, 'bgColor', (sec.bgColor || 'transparent') === c.val ? 'transparent' : c.val)}
                                            title={c.label}
                                            style={{
                                              width: '16px',
                                              height: '16px',
                                              borderRadius: '50%',
                                              background: c.color,
                                              border: `2px solid ${(sec.bgColor || 'transparent') === c.val ? '#005086' : c.border}`,
                                              cursor: 'pointer',
                                              padding: 0
                                            }}
                                          />
                                        ))}
                                        <input
                                          type="color"
                                          value={sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : '#ffffff'}
                                          onChange={e => handleUpdateSectionStyle(sec.id, 'bgColor', e.target.value)}
                                          title="Couleur personnalisée"
                                          style={{ width: '18px', height: '18px', padding: 0, border: 'none', borderRadius: '3px', cursor: 'pointer', background: 'transparent' }}
                                        />
                                      </div>
                                    </div>

                                    <span style={{ color: '#cbd5e1' }}>|</span>

                                    {/* Font size */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <Type size={13} style={{ color: '#005086' }} />
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>{isArabic ? 'الحجم:' : 'Taille :'}</span>
                                      <select
                                        value={sec.fontSize || ''}
                                        onChange={e => handleUpdateSectionStyle(sec.id, 'fontSize', e.target.value)}
                                        style={{ fontSize: '0.72rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'var(--bg-main, #ffffff)', color: 'var(--text-main, #334155)', fontWeight: 600 }}
                                      >
                                        <option value="">{isArabic ? 'افتراضي' : 'Standard (9.2pt)'}</option>
                                        <option value="8pt">8pt (Compact)</option>
                                        <option value="8.5pt">8.5pt</option>
                                        <option value="9.2pt">9.2pt (Normal)</option>
                                        <option value="10pt">10pt</option>
                                        <option value="11pt">11pt (Grand)</option>
                                      </select>
                                    </div>

                                    <span style={{ color: '#cbd5e1' }}>|</span>

                                    {/* Line height */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <Layers size={13} style={{ color: '#005086' }} />
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>{isArabic ? 'التباعد:' : 'Interligne :'}</span>
                                      <select
                                        value={sec.lineHeight || ''}
                                        onChange={e => handleUpdateSectionStyle(sec.id, 'lineHeight', e.target.value)}
                                        style={{ fontSize: '0.72rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'var(--bg-main, #ffffff)', color: 'var(--text-main, #334155)', fontWeight: 600 }}
                                      >
                                        <option value="">{isArabic ? 'عادي (1.55)' : 'Normal (1.55)'}</option>
                                        <option value="1.3">1.3 ({isArabic ? 'متقارب' : 'Serré'})</option>
                                        <option value="1.55">1.55 ({isArabic ? 'متوسط' : 'Standard'})</option>
                                        <option value="1.75">1.75 ({isArabic ? 'متباعد' : 'Aéré'})</option>
                                        <option value="2.0">2.0 ({isArabic ? 'واسع' : 'Spacieux'})</option>
                                      </select>
                                    </div>

                                    <span style={{ color: '#cbd5e1' }}>|</span>

                                    {/* Apply Style to All / تطبيق على كامل الملف */}
                                    <button
                                      type="button"
                                      onClick={() => handleApplySectionStyleToAll(sec.id, 'all')}
                                      title={isArabic ? "تطبيق هذه التنسيقات (الخلفية، الحجم، التباعد) على جميع عناصر الملف دفعة واحدة" : "Appliquer ce style (Fond, Taille, Interligne) à tout le document"}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        background: '#eff6ff',
                                        color: '#005086',
                                        border: '1px solid #bfdbfe',
                                        borderRadius: '4px',
                                        padding: '0.15rem 0.45rem',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <CheckCheck size={12} style={{ color: '#0284c7' }} />
                                      <span>{isArabic ? 'تطبيق على الكل' : 'Appliquer à tout'}</span>
                                    </button>
                                  </div>
                                )}

                                {/* Attached images/tables with position === 'before' */}
                                {sec.items?.filter(it => (it.type === 'image' || it.type === 'table') && it.position === 'before').map((item, itemIdx) => {
                                  if (item.type === 'image') {
                                    const align = item.align || 'center';
                                    const widthPct = item.width_pct || 80;
                                    const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
                                    const rawUrl = (item.url || '').trim();
                                    const altText = item.alt || item.description || '';
                                    if (!rawUrl) return null;
                                    return (
                                      <div key={`ex-img-before-${itemIdx}`} style={{ display: 'flex', flexDirection: 'column', alignItems: justifyMap[align], margin: '0.8rem 0', width: '100%' }}>
                                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.6rem', maxWidth: `${widthPct}%`, minWidth: '180px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                                          <img src={rawUrl} alt={altText || 'Figure'} style={{ width: '100%', maxHeight: '350px', borderRadius: '8px', objectFit: 'contain', display: 'block' }} />
                                          {altText && <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>{renderWithMath(altText)}</div>}
                                        </div>
                                      </div>
                                    );
                                  }
                                  if (item.type === 'table') {
                                    return (
                                      <div key={`ex-tbl-before-${itemIdx}`} style={{ margin: '0.8rem 0', width: '100%' }}>
                                        <SmartTableRenderer table={item.table || item.data || item.text || item} title={item.title} />
                                      </div>
                                    );
                                  }
                                  return null;
                                })}

                                {isDirectEdit ? (
                                  <textarea
                                    value={sec.content || ''}
                                    onChange={e => handleUpdateSectionContent(sec.id, e.target.value)}
                                    placeholder="Énoncé de l'exercice..."
                                    rows={Math.max(3, (sec.content || '').split('\n').length)}
                                    style={{
                                      width: '100%',
                                      border: '1px dashed #005086',
                                      borderRadius: '6px',
                                      padding: '0.6rem',
                                      fontSize: sec.fontSize || '0.92rem',
                                      lineHeight: sec.lineHeight || 1.55,
                                      background: hasCustomBg ? customBg : 'var(--bg-main, #ffffff)',
                                      color: 'var(--text-main)',
                                      fontFamily: isArabic ? arabicFont : 'inherit',
                                      direction: isArabic ? 'rtl' : 'ltr',
                                      outline: 'none'
                                    }}
                                  />
                                ) : (
                                  renderWithMath(sec.content)
                                )}

                            {/* Attached images and tables inside exercise (default / after) */}
                            {sec.items?.filter(it => (it.type === 'image' || it.type === 'table') && it.position !== 'before').map((item, itemIdx) => {
                              if (item.type === 'image') {
                                const align = item.align || 'center';
                                const widthPct = item.width_pct || 80;
                                const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
                                const rawUrl = (item.url || '').trim();
                                const altText = item.alt || item.description || '';
                                if (!rawUrl) return null;
                                return (
                                  <div key={`ex-img-${itemIdx}`} style={{ display: 'flex', flexDirection: 'column', alignItems: justifyMap[align], margin: '1rem 0', width: '100%' }}>
                                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.6rem', maxWidth: `${widthPct}%`, minWidth: '180px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                                      <img src={rawUrl} alt={altText || 'Figure'} style={{ width: '100%', maxHeight: '350px', borderRadius: '8px', objectFit: 'contain', display: 'block' }} />
                                      {altText && <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>{renderWithMath(altText)}</div>}
                                    </div>
                                  </div>
                                );
                              }
                              if (item.type === 'table') {
                                return (
                                  <div key={`ex-tbl-${itemIdx}`} style={{ margin: '1rem 0', width: '100%' }}>
                                    <SmartTableRenderer table={item.table || item.data || item.text || item} title={item.title} />
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        );
                      })()}

                          {/* Interactive student checks */}
                          {sec.interactive_answers?.length > 0 && (
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                sec.interactive_answers.forEach(ans => {
                                  handleCheckAnswer(sec.id, ans.question_idx, ans.expected_answer);
                                });
                              }}
                              className="interactive-form no-print"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#005086' }}>
                                <Calculator size={16} /> Mode interactif : Calculez et valisez vos résultats
                              </div>
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {sec.interactive_answers.map((ans, ansIdx) => {
                                  const ansKey = `${sec.id}-${ans.question_idx}`;
                                  return (
                                    <div key={ansIdx} style={{ flex: 1, minWidth: '120px' }}>
                                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                        {ans.label}
                                      </label>
                                      <input 
                                        type="text" 
                                        placeholder="Votre réponse"
                                        value={studentAnswers[ansKey] || ''} 
                                        onChange={(e) => setStudentAnswers(prev => ({ ...prev, [ansKey]: e.target.value }))}
                                        className="input-control" 
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <button type="submit" className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', width: 'fit-content' }}>
                                  Vérifier mes réponses
                                </button>

                                {sec.interactive_answers.every(ans => checkResults[`${sec.id}-${ans.question_idx}`] === 'success') && (
                                  <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Check size={16} strokeWidth={3} /> Réponses correctes !
                                  </span>
                                )}
                                {sec.interactive_answers.some(ans => checkResults[`${sec.id}-${ans.question_idx}`] === 'error') && (
                                  <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <X size={16} strokeWidth={3} /> Mauvaise réponse, réessayez.
                                  </span>
                                )}
                              </div>
                            </form>
                          )}

                          {/* Solution block: always rendered, hidden by CSS, shown in print */}
                          <div
                            className="solution-block"
                            style={{
                              display: visibleSolutions[sec.id] ? 'block' : 'none',
                              marginTop: '0.5rem',
                              background: 'rgba(16, 185, 129, 0.02)',
                              border: '1px solid rgba(16, 185, 129, 0.15)',
                              borderRadius: '12px',
                              padding: '1.5rem'
                            }}
                          >
                            <h4 style={{
                              color: '#059669', fontWeight: 800,
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              marginBottom: '0.75rem', fontSize: '1rem',
                              flexDirection: isArabic ? 'row-reverse' : 'row',
                              fontFamily: isArabic ? arabicFont : 'inherit',
                            }}>
                              <BookOpenCheck size={18} />
                              {isArabic ? 'الحل المفصل' : 'Démonstration rédigée'}
                            </h4>
                            <div style={{
                              display: 'flex', flexDirection: 'column', gap: '1rem',
                              fontSize: '0.92rem', lineHeight: 1.85,
                              textAlign: isArabic ? 'right' : 'left',
                              fontFamily: isArabic ? arabicFont : 'inherit',
                              direction: isArabic ? 'rtl' : 'ltr',
                            }}>
                              {renderWithMath(sec.solution)}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
