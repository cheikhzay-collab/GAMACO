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
import { extractPointsTableFromSections, saveGrade, calculateTotalPointsFromTable } from '../services/gradeService';
import { saveSolution, saveDevoirPrimeSheet } from '../services/solutionService';
import { solveExerciseWithAI } from '../utils/aiExerciseSolver';
import { Sparkles, Loader2 } from 'lucide-react';
import { renderWithMath } from '../utils/mathRenderer';
import SmartTableRenderer from '../components/SmartTableRenderer';
import { openLessonPrintWindow } from '../utils/generateLessonPDF';
import NationalExamTemplate from '../components/NationalExamTemplate';
import CourseSummaryTemplate from '../components/CourseSummaryTemplate';
import EbookTemplate from '../components/EbookTemplate';
import DevoirPrimeTemplate from '../components/DevoirPrimeTemplate';
import CourseMasterTemplate from '../components/CourseMasterTemplate';
import { openNationalExamPrintWindow } from '../utils/generateNationalExamPDF';
import { openCourseSummaryPrintWindow } from '../utils/generateCourseSummaryPDF';
import { openEbookTemplatePrintWindow } from '../utils/generateEbookTemplatePDF';
import { openDevoirPrimePrintWindow } from '../utils/generateDevoirPrimePDF';
import { openCoursePrintWindow } from '../utils/generateCoursePDF';
import { isCourseDocument } from '../utils/courseHelpers';
import { buildPointsTableFromPrimeExercises } from '../utils/devoirPrimeHelpers';
import {
  getSectionImageEntries,
  getSectionImageMap,
  getReferencedFigIds,
  hasFigureToken,
  isStandaloneFigureLine,
  splitTextByFigureTokens,
  resolveFigureItem,
} from '../utils/figureShortcodes';

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


const parseExerciseTitle = (title, fallbackIdx, isArabicMode = false, sectionNumber = '') => {
  if (!title) return { number: sectionNumber || String(fallbackIdx + 1), label: '' };
  
  let clean = title.trim();

  // Handle Arabic titles: "تمرين 1" or "تمرين: 1" or "تمرين\n1"
  if (isArabicMode || /^\u062a\u0645\u0631\u064a\u0646/.test(clean)) {
    const arabicMatch = clean.match(/^\u062a\u0645\u0631\u064a\u0646[:\s]+([\d\u0661-\u0669]+)\s*(.*)$/);
    if (arabicMatch) {
      return { number: arabicMatch[1], label: arabicMatch[2].trim() };
    }
    const numMatch = clean.match(/([\d]+)/);
    return { number: numMatch ? numMatch[1] : (sectionNumber || String(fallbackIdx + 1)), label: '' };
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
  
  // Match number with optional parentheses or standalone (e.g. "(1)", "1", "2.a")
  const parenMatch = clean.match(/^\(?([0-9]+|[a-zA-Z])\)?\s*[:.\-–—\s]*(.*)$/);
  if (parenMatch) {
    const number = parenMatch[1].trim();
    let label = parenMatch[2].replace(/^[:\-–—\s]+/, '').replace(/\*\*$/, '').trim();
    return {
      number: number || sectionNumber || String(fallbackIdx + 1),
      label: label
    };
  }
  
  // If clean does not have leading number, return clean as label with sectionNumber fallback
  return {
    number: sectionNumber || String(fallbackIdx + 1),
    label: clean.replace(/\*\*/g, '').trim()
  };
};


const renderInlineFigureNode = (imgItem, key) => {
  if (!imgItem) return null;
  const rawUrl = (imgItem.url || imgItem.src || '').trim();
  if (!rawUrl) return null;
  const align = imgItem.align || 'center';
  const widthPct = imgItem.width_pct || 80;
  const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const altText = imgItem.alt || imgItem.description || '';
  return (
    <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: justifyMap[align] || 'center', margin: '0.75rem 0', width: '100%' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.6rem', maxWidth: `${widthPct}%`, minWidth: '180px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
        <img src={rawUrl} alt={altText || 'Figure'} style={{ width: '100%', maxHeight: '380px', borderRadius: '8px', objectFit: 'contain', display: 'block' }} />
        {altText && <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>{renderWithMath(altText)}</div>}
      </div>
    </div>
  );
};

const renderMathWithSectionFigures = (text, section) => {
  if (text === null || text === undefined) return null;
  if (!section || !hasFigureToken(text)) {
    return renderWithMath(text);
  }
  const imageMap = getSectionImageMap(section);
  const segments = splitTextByFigureTokens(String(text));
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === 'figure') {
          const resolved = resolveFigureItem(imageMap, seg);
          return resolved ? renderInlineFigureNode(resolved, `inline-fig-${idx}-${seg.figId}`) : null;
        }
        return seg.value.trim() ? <span key={`inline-txt-${idx}`}>{renderWithMath(seg.value)}</span> : null;
      })}
    </>
  );
};

/* ── Render Devoir Surveillé homework body with barème ── */
const renderHomeworkBody = (text, isArabicMode, arabicFont, renderWithMath, secId, onPointsChange, isDirectEdit = false, onContentChange = null, section = null) => {
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

  // Heal split intervals (e.g. ]-\infty;$\n\n$$1[$$ -> ]-\infty; 1[$)
  rawText = rawText.replace(/([\]\[\(][^$\n]*[;,])\s*\${1,2}\s*\n+\s*\${1,2}\s*([^$\n]*?[\]\[\)])\${1,2}/g, '$1 $2$');
  rawText = rawText.replace(/([\]\[\(][^$\n]*)\s*\${1,2}\s*\n+\s*\${1,2}\s*([;,][^$\n]*?[\]\[\)])\${1,2}/g, '$1$2$');
  rawText = rawText.replace(/\n{3,}/g, '\n\n');

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
  const isQuestionRegex = /^(\s*(?:\*\*)?(?:\d+\s*[.)]\s*[a-zA-Z]|\d+|[a-zA-Z])[.)]\s*(?:\*\*)?)/;

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

    const standaloneFig = !isDirectEdit ? isStandaloneFigureLine(cleanLine) : null;
    if (standaloneFig) {
      parsedItems.push({
        idx,
        cleanLine,
        pointsStr: '',
        displayPoints: '',
        isSubQ: false,
        isFigure: true,
        figToken: standaloneFig,
      });
      return;
    }

    let displayPoints = pointsStr;
    if (displayPoints.startsWith('(') && displayPoints.endsWith(')')) {
      displayPoints = displayPoints.slice(1, -1);
    }

    const isSubQ = isQuestionRegex.test(cleanLine);
    parsedItems.push({
      idx,
      cleanLine,
      pointsStr,
      displayPoints,
      isSubQ,
      isFigure: false
    });
  });

  const blocks = [];
  let i = 0;
  while (i < parsedItems.length) {
    const item = parsedItems[i];
    if (item.isFigure) {
      blocks.push({ isFigureBlock: true, figToken: item.figToken });
      i++;
      continue;
    }
    if (item.pointsStr || item.isSubQ || blocks.length === 0) {
      const block = { headerItem: item, subItems: [] };
      i++;
      while (i < parsedItems.length && !parsedItems[i].isFigure && !parsedItems[i].pointsStr && !parsedItems[i].isSubQ) {
        block.headerItem.cleanLine += '\n' + parsedItems[i].cleanLine;
        i++;
      }
      blocks.push(block);
    } else {
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.headerItem) {
        lastBlock.headerItem.cleanLine += '\n' + item.cleanLine;
      } else {
        blocks.push({ headerItem: item, subItems: [] });
      }
      i++;
    }
  }

  const imageMap = section ? getSectionImageMap(section) : null;

  const rows = blocks.map((b, bIdx) => {
    if (b.isFigureBlock) {
      const resolved = resolveFigureItem(imageMap, b.figToken);
      if (!resolved) return null;
      return (
        <div key={`hw-fig-${bIdx}`} className="homework-row homework-media-row">
          <div className="homework-bareme-cell" />
          <div className="homework-content-cell homework-media-cell">
            {renderInlineFigureNode(resolved, `hw-fig-node-${bIdx}`)}
          </div>
        </div>
      );
    }

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
          renderMathWithSectionFigures(b.headerItem.cleanLine, section)
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
const calculateTotalPoints = (text, isArabicMode, fallbackHeader = '') => {
  let rawText = text ? String(text) : '';
  
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

  // If no points found in questions body, check if section header or title contains the total points, e.g. "Exercice (1) (4 Pts)"
  if (total === 0 && fallbackHeader) {
    const headerMatch = String(fallbackHeader).match(pointsRegex);
    if (headerMatch) {
      const val = parseFloat(headerMatch[1].replace(',', '.'));
      if (!isNaN(val)) total = val;
    }
  }

  const totalStr = String(total).replace('.', ',');
  const ptsWord = isArabicMode ? 'ن' : (total > 1 ? 'pts' : 'pt');
  return `${totalStr} ${ptsWord}`;
};

export default function LessonViewerPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, profName, profPhone, profAcademicYear, trackDownload } = useAuth();

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
  const [viewEbookMode, setViewEbookMode] = useState(false);
  const [viewDevoirPrimeMode, setViewDevoirPrimeMode] = useState(false);
  const [ebookColumns, setEbookColumns] = useState(3);
  const [solvingSecId, setSolvingSecId] = useState(null);

  const handleGenerateAiSolutionForSection = async (secId, sec) => {
    if (!sec) return;
    const contentToSolve = (sec.content || '').trim() || (sec.items || []).map(it => it.text || (typeof it === 'string' ? it : '')).join('\n').trim();
    if (!contentToSolve) {
      alert(isArabic ? 'لا يوجد نص تمرين للحل.' : 'Aucun énoncé à résoudre.');
      return;
    }

    setSolvingSecId(secId);
    try {
      const generated = await solveExerciseWithAI(contentToSolve, {
        level: lesson?.level,
        subject: lesson?.subject,
        language: isArabic ? 'ar' : 'fr',
        docTitle: lesson?.title,
        chapterTitle: lesson?.title,
        sectionTitle: sec.title || '',
        secType: sec.type || 'exercise',
        docType: lesson?.doc_type || 'course'
      });

      if (!generated || !generated.trim()) {
        throw new Error(isArabic ? 'لم يتم توليد أي حل.' : 'Aucune solution n’a été générée.');
      }

      const existingSections = (lesson?.sections && lesson.sections.length > 0)
        ? lesson.sections
        : (lesson?.content?.sections || []);
      const updatedSections = existingSections.map(s => {
        if (s.id === secId) {
          return { ...s, solution: generated.trim() };
        }
        return s;
      });

      setLesson(prev => ({
        ...prev,
        sections: updatedSections,
        content: prev?.content ? { ...prev.content, sections: updatedSections } : prev?.content
      }));
      setVisibleSolutions(prev => ({ ...prev, [secId]: true }));

      if (lesson?.id) {
        await updateLesson(lesson.id, {
          sections: updatedSections,
          content: { ...(lesson.content || {}), sections: updatedSections }
        });
        await saveSolution({
          lessonId: lesson.id,
          sectionId: secId,
          docType: lesson?.docType || lesson?.doc_type || 'course',
          solutionText: generated.trim(),
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[LessonViewer] AI Solution error:', err);
      alert(err.message || (isArabic ? 'حدث خطأ أثناء توليد الحل بالذكاء الاصطناعي.' : 'Erreur lors de la génération du corrigé par IA.'));
    } finally {
      setSolvingSecId(null);
    }
  };

  // Dynamic columns count for exercises series: 1 or 2 columns
  const [seriesColumns, setSeriesColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('lesson_viewer_columns');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 2;
  });

  const [showDetailedPedagogy, setShowDetailedPedagogy] = useState(false);
  const [showGradesTable, setShowGradesTable] = useState(false);

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
          const hasPed = Boolean(
            data.header?.capacites_attendues ||
            data.header?.contenus ||
            data.header?.le_contenu ||
            data.content?.capacites_attendues ||
            data.content?.contenus
          );
          if (hasPed) {
            setShowDetailedPedagogy(true);
          }
          const prefDocCols = Number(data.content?.columns_count || data.columns_count);
          if ([1, 2, 3].includes(prefDocCols)) {
            setSeriesColumns(prefDocCols);
          }
          const isPrime = Boolean(
            data.docType === 'devoir_prime' ||
            data.type === 'devoir_prime' ||
            data.content?.doc_type === 'devoir_prime' ||
            data.content?.type === 'devoir_prime' ||
            data.content?.header?.doc_type === 'devoir_prime' ||
            data.docType === 'national' ||
            data.type === 'national' ||
            data.content?.doc_type === 'national' ||
            data.content?.header?.is_national_exam ||
            data.is_national_exam
          );
          const isEb = !isPrime && Boolean(
            data.docType === 'ebook' ||
            data.type === 'ebook' ||
            data.content?.doc_type === 'ebook' ||
            data.content?.type === 'ebook' ||
            data.content?.header?.doc_type === 'ebook'
          );
          if (isPrime) {
            setViewDevoirPrimeMode(true);
            setViewEbookMode(false);
            setViewSummaryMode(false);
          } else if (isEb) {
            setViewDevoirPrimeMode(false);
            setViewEbookMode(true);
            setViewSummaryMode(false);
            const prefCols = Number(data.content?.columns_count || data.columns_count || 3);
            setEbookColumns([1, 2, 3].includes(prefCols) ? prefCols : 3);
          } else {
            setViewDevoirPrimeMode(false);
            setViewEbookMode(false);
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
        schools: lesson.schools || lesson.content?.header?.schools,
        level: lesson.level || lesson.content?.level,
        docType: lesson.docType || lesson.doc_type || lesson.content?.doc_type || 'course',
        isActive: lesson.isActive !== undefined ? lesson.isActive : (lesson.is_active !== undefined ? lesson.is_active : true),
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
      if (viewDevoirPrimeMode || lesson?.docType === 'devoir_prime' || lesson?.content?.doc_type === 'devoir_prime' || lesson?.docType === 'national' || lesson?.content?.doc_type === 'national') {
        openDevoirPrimePrintWindow(lesson, { showSolutions: includeSolutionsInPdf });
        return;
      }
      const isEbookPdf = Boolean(
        lesson?.docType === 'ebook' ||
        lesson?.type === 'ebook' ||
        lesson?.content?.doc_type === 'ebook' ||
        lesson?.content?.type === 'ebook' ||
        lesson?.content?.header?.doc_type === 'ebook'
      );
      if (isEbookPdf && viewEbookMode) {
        openEbookTemplatePrintWindow(lesson, { showSolutions: includeSolutionsInPdf, columnsCount: ebookColumns, academicYear: profAcademicYear });
        return;
      }
      const isHomeworkPdf = Boolean(
        lesson?.docType === 'homework' ||
        lesson?.type === 'homework' ||
        lesson?.content?.doc_type === 'homework' ||
        lesson?.content?.type === 'homework' ||
        lesson?.content?.header?.doc_type === 'homework' ||
        lesson?.isHomework ||
        /devoir|فرض|contr[ôo]le/i.test(lesson?.title || lesson?.content?.header?.fiche_title || lesson?.content?.header?.prep_title || '')
      );
      const isSeriesOrHomework = isHomeworkPdf || lesson?.docType === 'exercises' || lesson?.content?.doc_type === 'exercises' || /سلسلة|s[ée]rie/i.test(lesson?.title || '');
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
      } else if (!isSeriesOrHomework && isCourseDocument(lesson)) {
        // Dedicated Academic Textbook PDF Engine for Courses (COUR)
        openCoursePrintWindow(lesson, {
          showSolutions: includeSolutionsInPdf,
          academicYear: profAcademicYear
        });
      } else {
        // Mode Standard actif -> Impression au format Standard (Strictement 1 colonne pour les devoirs)
        const effectiveCols = isHomeworkPdf ? 1 : seriesColumns;
        openLessonPrintWindow(lesson, {
          showSolutions: includeSolutionsInPdf,
          layoutMode: 'standard',
          forceStandard: true,
          columnsCount: effectiveCols,
          academicYear: profAcademicYear
        });
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

  const sections = (Array.isArray(content?.sections) && content.sections.length > 0)
    ? content.sections
    : ((Array.isArray(lesson?.sections) && lesson.sections.length > 0)
        ? lesson.sections
        : ((Array.isArray(content?.exercises) && content.exercises.length > 0)
            ? content.exercises
            : ((Array.isArray(lesson?.exercises) && lesson.exercises.length > 0)
                ? lesson.exercises
                : ((Array.isArray(content?.devoir_prime_exercises) && content.devoir_prime_exercises.length > 0)
                    ? content.devoir_prime_exercises
                    : ((Array.isArray(lesson?.content?.devoir_prime_exercises) && lesson.content.devoir_prime_exercises.length > 0)
                        ? lesson.content.devoir_prime_exercises
                        : (Array.isArray(parsedContent) ? parsedContent : []))))));
  const theorySections = sections?.filter(s => s?.type !== 'exercise' && s?.type !== 'application') || [];
  const exerciseSections = sections?.filter(s => s?.type === 'exercise' || s?.type === 'application') || [];

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
  
  // DEVOIR PRIME detection
  const isDevoirPrime = Boolean(
    lesson?.docType === 'devoir_prime' ||
    lesson?.type === 'devoir_prime' ||
    content?.doc_type === 'devoir_prime' ||
    content?.type === 'devoir_prime' ||
    header?.doc_type === 'devoir_prime'
  );

  // National Exam detection
  const isNat = Boolean(
    lesson?.docType === 'national' ||
    lesson?.type === 'national' ||
    content?.doc_type === 'national' ||
    content?.type === 'national' ||
    header?.doc_type === 'national' ||
    content?.header?.is_national_exam ||
    lesson?.is_national_exam ||
    /national|وطني|baccalaur[ée]at/i.test(lesson?.title || header?.fiche_title || '')
  );

  // E-Book detection
  const isEbook = !isDevoirPrime && Boolean(
    lesson?.docType === 'ebook' ||
    lesson?.type === 'ebook' ||
    content?.doc_type === 'ebook' ||
    content?.type === 'ebook' ||
    header?.doc_type === 'ebook'
  );

  // Devoir Surveillé detection
  const isHomework = !isEbook && Boolean(
    isDevoirPrime ||
    lesson?.docType === 'homework' ||
    lesson?.type === 'homework' ||
    content?.doc_type === 'homework' ||
    content?.type === 'homework' ||
    header?.doc_type === 'homework' ||
    lesson?.isHomework ||
    /devoir|فرض|contr[ôo]le/i.test(lesson?.title || header?.fiche_title || header?.prep_title || '')
  );

  const handleSaveDevoirPrime = async (primeMeta, primeExercises, convertToPrime = false) => {
    if (!lesson?.id) return;
    const nextDocType = (convertToPrime || isDevoirPrime) ? 'devoir_prime' : (lesson.docType || content?.doc_type || 'homework');
    const primePointsTable = buildPointsTableFromPrimeExercises(primeExercises);
    const primeTotalPts = calculateTotalPointsFromTable(primePointsTable) || 20;

    const updatedContent = {
      ...(lesson.content || {}),
      doc_type: nextDocType,
      devoir_prime_meta: primeMeta,
      devoir_prime_exercises: primeExercises,
      points_table: primePointsTable,
      total_points: primeTotalPts,
      header: {
        ...(lesson.content?.header || {}),
        doc_type: nextDocType,
        fiche_title: primeMeta?.title || lesson.title,
        points_table: primePointsTable,
        total_points: primeTotalPts,
      }
    };

    await updateLesson(lesson.id, {
      title: primeMeta?.title || lesson.title,
      docType: nextDocType,
      content: updatedContent,
    });

    await saveDevoirPrimeSheet({
      lessonId: lesson.id,
      meta: primeMeta,
      exercises: primeExercises,
      totalPoints: primeTotalPts,
    }).catch((e) => console.warn('[DEVOIR PRIME] tbl_devoir_prime sync warning:', e));

    if (primePointsTable.length > 0) {
      try {
        await saveGrade({
          id: `grade-${lesson.id}`,
          lesson_id: lesson.id,
          title: primeMeta?.title || lesson.title,
          doc_type: nextDocType,
          total_points: primeTotalPts,
          data: {
            points_table: primePointsTable,
            total_points: primeTotalPts,
            title: primeMeta?.title || lesson.title,
            level: lesson.level || primeMeta?.level || '2bac_pc_svt',
          }
        });
      } catch (e) {
        console.warn('[DEVOIR PRIME] Grade sync warning:', e);
      }
    }

    setLesson(prev => ({
      ...prev,
      title: primeMeta?.title || prev.title,
      docType: nextDocType,
      content: updatedContent,
    }));
  };

  const activePointsTable = (
    lesson?.content?.points_table && Array.isArray(lesson.content.points_table) && lesson.content.points_table.length > 0
  ) ? lesson.content.points_table : (
    header?.points_table && Array.isArray(header.points_table) && header.points_table.length > 0
  ) ? header.points_table : (
    lesson?.points_table && Array.isArray(lesson.points_table) && lesson.points_table.length > 0
  ) ? lesson.points_table : (
    isHomework ? extractPointsTableFromSections(sections, header?.total_points || 20) : []
  );

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
        .homework-sections-container,
        .sections-list-container.homework-sections-container,
        .sections-list-container:has(.homework-table) {
          column-count: 1 !important;
          display: block !important;
          width: 100% !important;
          column-rule: none !important;
        }
        .homework-sections-container .homework-table,
        .sections-list-container:has(.homework-table) .homework-table {
          width: 100% !important;
          max-width: 100% !important;
        }

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

        .exercises-one-column-layout {
          display: flex !important;
          flex-direction: column !important;
          column-count: 1 !important;
          column-rule: none !important;
          width: 100% !important;
        }

        @media (min-width: 1025px) {
          .exercises-one-column-layout {
            display: block !important;
            column-count: 1 !important;
            column-rule: none !important;
            width: 100% !important;
          }

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

        @media (max-width: 1024px) {
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

          .exercises-one-column-layout {
            display: block !important;
            column-count: 1 !important;
            column-rule: none !important;
            width: 100% !important;
          }
          .exercises-one-column-layout > *,
          .exercises-one-column-layout .exercise-section-wrapper,
          .exercises-one-column-layout .exercise-wrapper,
          .exercises-one-column-layout .exercise-body {
            break-inside: auto !important;
            page-break-inside: auto !important;
            margin-bottom: 0.65rem !important;
          }
          .exercises-one-column-layout .list-item-row,
          .exercises-one-column-layout .exercise-item-row,
          .exercises-one-column-layout .bullet-item,
          .exercises-one-column-layout .classic-highlight-box,
          .exercises-one-column-layout .modern-figure-wrapper {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
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
          .exercises-two-columns-layout .exercise-section-wrapper,
          .exercises-two-columns-layout .exercise-wrapper,
          .exercises-two-columns-layout .exercise-body,
          .exercises-two-columns-layout .exercise-body-box {
            margin-bottom: 0.65rem !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            -webkit-column-break-inside: auto !important;
          }
          .exercises-two-columns-layout .exercise-banner,
          .exercises-two-columns-layout .modern-exercise-banner,
          .section-header-row,
          .fiche-pedagogique-header,
          .fiche-pedagogique-compact-header,
          h1, h2, h3, h4 {
            break-inside: avoid !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
            -webkit-column-break-after: avoid !important;
          }
          .exercises-two-columns-layout .list-item-row,
          .exercises-two-columns-layout .exercise-item-row,
          .bullet-item,
          .highlight-box,
          .classic-highlight-box,
          .modern-figure-wrapper,
          .notation-column {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-column-break-inside: avoid !important;
          }
          
          /* Prevent math formulas from overflowing two-column layouts in print */
          .exercises-two-columns-layout .katex-display {
            display: block !important;
            max-width: 100% !important;
            margin: 0.35em auto !important;
            text-align: center !important;
            box-sizing: border-box !important;
            font-size: 0.95em !important;
          }
          .exercises-two-columns-layout .katex-display > .katex {
            display: inline-block !important;
            max-width: 100% !important;
            text-align: center !important;
          }
          .exercises-two-columns-layout .katex,
          .exercises-two-columns-layout .katex-html {
            white-space: normal !important;
            display: inline !important;
            max-width: 100% !important;
          }
          .exercises-two-columns-layout .katex .base {
            white-space: nowrap !important;
            display: inline-block !important;
            max-width: 100% !important;
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
            border-radius: 6px !important;
            color: #1a202c !important;
            text-align: left !important;
            padding: 0.45rem 0.8rem !important;
            margin: 0.25rem 0 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          [dir="rtl"] .classic-highlight-box {
            text-align: right !important;
          }

          /* Compact pedagogical header */
          .fiche-pedagogique-compact-header {
            width: 100% !important;
            border: 1.5px solid #005086 !important;
            border-radius: 6px !important;
            overflow: hidden !important;
            margin-bottom: 0.65rem !important;
            background: #ffffff !important;
            box-shadow: 0 2px 8px rgba(0,80,134,0.06) !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
          }
          .fiche-pedagogique-compact-header .compact-title-cell {
            background: #005086 !important;
            color: #ffffff !important;
            text-align: center !important;
            font-weight: 900 !important;
            font-size: 1.15rem !important;
            padding: 0.55rem 1rem !important;
            letter-spacing: 0.03em !important;
          }
          .fiche-pedagogique-compact-header .compact-meta-bar {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            flex-wrap: wrap !important;
            padding: 0.4rem 0.85rem !important;
            background: #f8fafc !important;
            gap: 0.4rem 1rem !important;
            font-size: 0.78rem !important;
            color: #1e293b !important;
            border-top: 1px solid rgba(0,80,134,0.15) !important;
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
          
          /* Targeted refined scale for superscripts / powers (الأس) */
          .katex .msupsub {
            font-size: 1.0em !important;
          }
          .katex .msupsub .sizing.size3,
          .katex .msupsub .sizing.reset-size6.size3,
          .katex .msupsub .vlist-t:not(.vlist-t2) .sizing.size3,
          .katex .msupsub .vlist-t:not(.vlist-t2) .sizing.reset-size6.size3,
          .katex .msupsub .vlist-t.vlist-t2 span[style*="top:-3"] .sizing.size3,
          .katex .msupsub .vlist-t.vlist-t2 span[style*="top:-3"] .sizing.reset-size6.size3,
          .katex .msupsub .vlist-t .sizing.size3,
          .katex .msupsub .vlist-t .sizing.reset-size6.size3 {
            font-size: 0.70em !important;
          }
          .katex .msupsub .sizing > span,
          .katex .msupsub .sizing .mord,
          .katex .msupsub .sizing .mtight {
            font-size: inherit !important;
          }

          /* N-th root index (الجذر النوني): perfectly proportioned across display and print */
          .katex .sqrt > .root {
            font-size: 1.0em !important;
          }
          .katex .sqrt > .root .sizing,
          .katex .sqrt > .root .sizing.size1,
          .katex .sqrt > .root .sizing.reset-size6.size1,
          .katex .sizing.reset-size6.size1,
          .katex .fontsize-ensurer.reset-size6.size1 {
            font-size: 0.58em !important;
          }
          .katex .sqrt > .root .sizing > span,
          .katex .sqrt > .root .sizing .mord,
          .katex .sqrt > .root .sizing .mtight {
            font-size: inherit !important;
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

          {/* Column Count Selector for E-Book (defaults to 3 Cols) */}
          {isEbook && viewEbookMode && (
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
                  onClick={() => setEbookColumns(opt.val)}
                  style={{
                    background: ebookColumns === opt.val ? 'linear-gradient(135deg, #003865, #005086)' : 'transparent',
                    color: ebookColumns === opt.val ? '#ffffff' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '99px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.74rem',
                    fontWeight: ebookColumns === opt.val ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Column Count Selector for Lessons and Exercise Series (never for homework or ebook) */}
          {!isEbook && !isHomework && (
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

          {/* Modèle E-Book vs Modèle Résumé (keeps old documents completely untouched) */}
          {isEbook ? (
            <button
              onClick={() => setViewEbookMode(!viewEbookMode)}
              className="btn-outline"
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '99px',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: viewEbookMode ? 'linear-gradient(135deg, #003865, #005086)' : 'transparent',
                color: viewEbookMode ? '#ffffff' : 'var(--text-main)',
                borderColor: viewEbookMode ? '#005086' : 'var(--border)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              title={viewEbookMode ? 'Revenir à la vue standard' : 'Afficher le Modèle E-Book (3 Colonnes)'}
            >
              {viewEbookMode ? (
                <><FileText size={14} /> Vue Standard</>
              ) : (
                <><BookOpen size={14} /> Modèle E-Book</>
              )}
            </button>
          ) : (
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
          )}

          {/* DEVOIR PRIME toggle / converter button (for DEVOIR PRIME, National Exams and all homeworks) */}
          {(isDevoirPrime || isHomework || isNat || lesson?.docType === 'national') && (
            <button
              type="button"
              onClick={() => {
                const next = !viewDevoirPrimeMode;
                setViewDevoirPrimeMode(next);
                if (next) {
                  setViewSummaryMode(false);
                  setViewEbookMode(false);
                }
              }}
              className="btn-outline"
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '99px',
                fontSize: '0.78rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: viewDevoirPrimeMode ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(245, 158, 11, 0.1)',
                color: viewDevoirPrimeMode ? '#ffffff' : '#d97706',
                borderColor: '#f59e0b',
                transition: 'all 0.15s ease',
                cursor: 'pointer'
              }}
              title="Afficher ou convertir le devoir / examen au format DEVOIR PRIME (barème + lignes d'écriture + corrigé synthétique + impression officielle)"
            >
              {viewDevoirPrimeMode ? '📄 Vue Classique' : (isNat || lesson?.docType === 'national' ? '⭐ Modèle DEVOIR PRIME National' : '⭐ DEVOIR PRIME')}
            </button>
          )}

          {/* Grille / Barème des Points toggle button for homework */}
          {(isHomework || activePointsTable.length > 0) && (
            <button
              type="button"
              onClick={() => setShowGradesTable(!showGradesTable)}
              className="btn-outline"
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '99px',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: showGradesTable ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 'transparent',
                color: showGradesTable ? '#ffffff' : '#0284c7',
                borderColor: showGradesTable ? '#0284c7' : 'rgba(14, 165, 233, 0.4)',
                transition: 'all 0.15s ease',
                cursor: 'pointer'
              }}
              title="Afficher la grille et le barème des points"
            >
              📊 Barème des points ({activePointsTable.reduce((s, r) => s + (parseFloat(r.points) || 0), 0).toFixed(1)} / {header?.total_points || 20} pts)
            </button>
          )}

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

      {/* ── DEVOIR PRIME TEMPLATE VIEW MODE ── */}
      {viewDevoirPrimeMode ? (
        <div style={{ marginBottom: '2rem' }}>
          <DevoirPrimeTemplate
            lesson={lesson}
            editable={user?.role === 'admin'}
            isConvertedPreview={!isDevoirPrime}
            onSave={user?.role === 'admin' ? handleSaveDevoirPrime : null}
          />
        </div>
      ) : isEbook && viewEbookMode ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          marginBottom: '2rem',
          overflowX: 'auto'
        }}>
          <EbookTemplate
            data={lesson}
            columnsCount={ebookColumns}
            showSolutions={includeSolutionsInPdf}
          />
        </div>
      ) : viewSummaryMode ? (
        /* ── COURSE SUMMARY TEMPLATE VIEW MODE ── */
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
      ) : (isCourseDocument(lesson) && !isDirectEdit) ? (
        /* ── COURSE MASTER TEMPLATE (ACADEMIC TEXTBOOK VIEW) ── */
        <div style={{ marginBottom: '2rem' }}>
          <CourseMasterTemplate
            lesson={lesson}
            isAdmin={user?.role === 'admin'}
            onEditClick={() => navigate(`/admin/lessons/${id}/edit`, { state: { from: window.location.pathname } })}
            onSolveSection={(origIdx) => {
              const targetSec = (lesson?.content?.sections || lesson?.sections || [])[origIdx];
              if (targetSec) handleGenerateAiSolutionForSection(targetSec.id, targetSec);
            }}
            solvingSectionId={solvingSecId}
          />
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
        {!(lesson?.docType === 'exercises' || lesson?.docType === 'homework' || lesson?.type === 'exercises' || lesson?.type === 'homework' || lesson?.content?.doc_type === 'homework') && (() => {
          const hasPedagogy = Boolean(
            (header.capacites_attendues || '').trim() ||
            (header.contenus || '').trim() ||
            (header.le_contenu || '').trim()
          );

          if (!hasPedagogy && !showDetailedPedagogy) {
            return (
              <div className="fiche-pedagogique-compact-header" style={{
                width: '100%',
                border: '1.5px solid #005086',
                borderRadius: '6px',
                overflow: 'hidden',
                marginBottom: '1rem',
                background: '#ffffff',
                boxShadow: '0 2px 8px rgba(0,80,134,0.06)'
              }}>
                <div className="compact-title-cell" style={{
                  background: '#005086',
                  color: '#ffffff',
                  textAlign: 'center',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  padding: '0.65rem 1rem',
                  letterSpacing: '0.04em'
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
                </div>
                <div className="compact-meta-bar" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  padding: '0.45rem 1rem',
                  background: '#f8fafc',
                  gap: '0.5rem 1.25rem',
                  fontSize: '0.8rem',
                  color: '#1e293b',
                  borderTop: '1px solid rgba(0,80,134,0.15)'
                }}>
                  <div className="compact-meta-item">
                    <strong style={{ color: '#005086' }}>{isArabic ? 'الأكاديمية' : 'Académie'} :</strong>
                    <input
                      type="text"
                      value={header.academie || 'FES-MEKNES'}
                      onChange={(e) => handleHeaderChange('academie', e.target.value)}
                      style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.8rem', outline: 'none', color: '#1e293b', width: '90px' }}
                    />
                  </div>
                  <div className="compact-meta-item">
                    <strong style={{ color: '#005086' }}>{isArabic ? 'المديرية' : 'Direction'} :</strong>
                    <input
                      type="text"
                      value={header.direction || 'MY'}
                      onChange={(e) => handleHeaderChange('direction', e.target.value)}
                      style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.8rem', outline: 'none', color: '#1e293b', width: '50px' }}
                    />
                  </div>
                  <div className="compact-meta-item">
                    <strong style={{ color: '#005086' }}>{isArabic ? 'المؤسسة' : 'Établissement'} :</strong>
                    <input
                      type="text"
                      value={header.etablissement || '18 NOVEMBRE'}
                      onChange={(e) => handleHeaderChange('etablissement', e.target.value)}
                      style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.8rem', outline: 'none', color: '#1e293b', width: '110px' }}
                    />
                  </div>
                  <div className="compact-meta-item">
                    <strong style={{ color: '#005086' }}>{isArabic ? 'الأهمية' : 'Importance'} :</strong>
                    <input
                      type="text"
                      value={header.degre_importance || '40%'}
                      onChange={(e) => handleHeaderChange('degre_importance', e.target.value)}
                      style={{ background: '#fef08a', border: 'none', borderRadius: '3px', padding: '1px 5px', fontWeight: 800, color: '#854d0e', fontSize: '0.78rem', width: '45px', textAlign: 'center' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDetailedPedagogy(true)}
                    className="no-print"
                    style={{
                      background: 'rgba(0,80,134,0.08)',
                      border: '1px solid rgba(0,80,134,0.25)',
                      borderRadius: '99px',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#005086',
                      cursor: 'pointer'
                    }}
                  >
                    + {isArabic ? 'إضافة القدرات والمحتويات' : 'Détailler les capacités & contenus'}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div>
              {!hasPedagogy && showDetailedPedagogy && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }} className="no-print">
                  <button
                    type="button"
                    onClick={() => setShowDetailedPedagogy(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {isArabic ? 'تصغير الرأس التربوي' : 'Réduire au bandeau compact'}
                  </button>
                </div>
              )}
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
                              <div style={{ padding: '0.4rem 0.5rem', minHeight: '45px' }}>
                                <textarea
                                  value={header.capacites_attendues || ''}
                                  onChange={(e) => handleHeaderChange('capacites_attendues', e.target.value)}
                                  placeholder={isArabic ? 'انقر هنا لإضافة القدرات المنتظرة...' : 'Cliquer ici pour ajouter les capacités attendues...'}
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

                            {/* Red Line 2: CONTENUS */}
                            <td style={{ width: '50%', padding: 0, verticalAlign: 'top', borderBottom: '1.5px solid #005086' }}>
                              <div className="header-section-title" style={{ background: '#f8fafc', color: '#005086', fontWeight: 800, textAlign: 'center', padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderBottom: '1.5px solid #005086', textTransform: 'uppercase' }}>
                                {isArabic ? 'المحتويات' : 'CONTENUS'}
                              </div>
                              <div style={{ padding: '0.4rem 0.5rem', minHeight: '45px' }}>
                                <textarea
                                  value={header.contenus || ''}
                                  onChange={(e) => handleHeaderChange('contenus', e.target.value)}
                                  placeholder={isArabic ? 'انقر هنا لإضافة المحتويات...' : 'Cliquer ici pour ajouter les contenus...'}
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

                          {/* Bottom Row: Red Line 3: LE CONTENU */}
                          <tr>
                            <td colSpan={2} style={{ padding: 0, verticalAlign: 'top' }}>
                              <div className="header-section-title" style={{ background: '#f8fafc', color: '#005086', fontWeight: 800, textAlign: 'center', padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderBottom: '1.5px solid #005086', textTransform: 'uppercase' }}>
                                {isArabic ? 'المحتوى' : 'LE CONTENU'}
                              </div>
                              <div style={{ padding: '0.4rem 0.6rem', minHeight: '40px' }}>
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
            </div>
          );
        })()}

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

          {/* Collapsible / Viewable Points Table for Homework */}
          {(isHomework || (activePointsTable && activePointsTable.length > 0)) && activePointsTable.length > 0 && (
            <div className="homework-points-table-card no-print" style={{
              margin: '0 auto 1.5rem',
              width: '100%',
              borderRadius: '14px',
              border: '1.5px solid rgba(0, 80, 134, 0.25)',
              background: 'linear-gradient(135deg, rgba(0, 80, 134, 0.03) 0%, rgba(14, 165, 233, 0.03) 100%)',
              padding: '1rem 1.25rem',
              boxShadow: '0 2px 12px rgba(0, 80, 134, 0.05)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none'
              }} onClick={() => setShowGradesTable(!showGradesTable)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>📊</span>
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: '#005086' }}>
                      Grille &amp; Barème des Points
                    </strong>
                    <span style={{
                      marginRight: '0.6rem',
                      marginLeft: '0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '12px',
                      background: 'rgba(0, 80, 134, 0.1)',
                      color: '#005086'
                    }}>
                      Total : {activePointsTable.reduce((s, r) => s + (parseFloat(r.points) || 0), 0).toFixed(2)} / {header?.total_points || 20} pts
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#005086',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {showGradesTable ? 'Masquer la grille ▲' : 'Afficher le barème ▼'}
                </button>
              </div>

              {showGradesTable && (
                <div style={{ marginTop: '0.85rem', overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.82rem',
                    background: '#ffffff',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(0, 80, 134, 0.15)'
                  }}>
                    <thead>
                      <tr style={{ background: 'rgba(0, 80, 134, 0.08)', color: '#005086' }}>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 800 }}>Exercice</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 800 }}>Thème</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 800 }}>Points</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 800 }}>Détail des questions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePointsTable.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid rgba(0, 80, 134, 0.08)' }}>
                          <td style={{ padding: '0.45rem 0.75rem', fontWeight: 800, color: '#005086' }}>
                            {row.exercise || `Exercice ${rIdx + 1}`}
                          </td>
                          <td style={{ padding: '0.45rem 0.75rem' }}>
                            {row.title || '—'}
                          </td>
                          <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>
                            {row.points !== undefined ? `${row.points} pts` : '—'}
                          </td>
                          <td style={{ padding: '0.45rem 0.75rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {(row.subpoints && row.subpoints.length > 0) ? (
                                row.subpoints.map((sb, sbIdx) => (
                                  <span key={sbIdx} style={{
                                    fontSize: '0.72rem',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '4px',
                                    background: 'rgba(0, 80, 134, 0.06)',
                                    color: '#005086',
                                    border: '1px solid rgba(0, 80, 134, 0.15)'
                                  }}>
                                    <strong>{sb.question}:</strong> {sb.points} pt
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className={`sections-list-container ${
            !isHomework
              ? (seriesColumns === 3 ? 'exercises-three-columns-layout' : (seriesColumns === 2 ? 'exercises-two-columns-layout' : 'exercises-one-column-layout'))
              : 'homework-sections-container exercises-one-column'
          }`}>
            {(!sections || sections.length === 0) ? (
              <div style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                background: 'var(--bg-glass)',
                borderRadius: '16px',
                border: '1.5px dashed var(--border)',
                margin: '1.5rem 0'
              }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>📄</div>
                <h3 style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                  {isArabic ? 'لا توجد تمارين أو فقرات مسجلة في هذه الوثيقة' : 'Aucun exercice ou section trouvé dans ce document'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                  {isArabic ? 'يمكنك إضافة محتوى جديد أو تعديل الوثيقة بالضغط على الزر أسفله.' : 'Vous pouvez ajouter des exercices en cliquant sur le bouton ci-dessous.'}
                </p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsDirectEdit(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Edit size={16} /> {isArabic ? 'تعديل الوثيقة وإضافة تمارين' : 'Éditer et ajouter du contenu'}
                </button>
              </div>
            ) : sections.map((sec, idx) => {
              const secType = sec?.type || '';
              const secTitleLower = (sec?.title || '').toLowerCase();
              const isExplicitExercise = secType === 'exercise' || secType === 'application' || secTitleLower.startsWith('exercice') || secTitleLower.startsWith('application') || secTitleLower.startsWith('تمرين') || secTitleLower.startsWith('تطبيق');
              const isTheory = !isExplicitExercise && (secType === 'definition' || secType === 'property' || secType === 'theorem' || secType === 'corollary' || secType === 'example' || secType === 'remark' || secType === 'activity' || secType === 'content');
              const { number: exeNumber, label: exeLabel, prefix: exePrefix } = !isTheory 
                ? parseExerciseTitle(sec.title, idx, isArabic, sec.section_number)
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
                                table={item.table_data || item.table || item.data || item.text || item}
                                title={item.title}
                              />
                            </div>
                          );
                        }

                        if (item.type === 'image') {
                          const refFigs = getReferencedFigIds(sec);
                          const entryForIdx = getSectionImageEntries(sec).find(e => e.itemIdx === itemIdx);
                          if (entryForIdx && refFigs.has(entryForIdx.figId.toLowerCase())) {
                            return null;
                          }
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
                              <span style={{ flex: 1 }}>{renderMathWithSectionFigures(item.text, sec)}</span>
                            )}
                          </div>
                        );
                      })}

                      {/* Render text if stored in sec.content */}
                      {sec.content && (
                        <div style={{ marginTop: '0.65rem', marginBottom: '0.65rem', width: '100%', direction: lessonDir, fontFamily: isArabic ? arabicFont : 'inherit' }}>
                          {isDirectEdit ? (
                            <textarea
                              value={sec.content || ''}
                              onChange={e => handleUpdateSectionContent(sec.id, e.target.value)}
                              rows={Math.max(2, (sec.content || '').split('\n').length)}
                              style={{
                                width: '100%',
                                border: '1px dashed #005086',
                                borderRadius: '6px',
                                padding: '0.5rem',
                                fontSize: '0.92rem',
                                background: 'rgba(255,255,255,0.7)',
                                color: '#1a202c',
                                direction: lessonDir
                              }}
                            />
                          ) : (
                            renderMathWithSectionFigures(sec.content, sec)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })() : (
                    (() => {
                      if (isHomework) {
                        const hwRefFigs = getReferencedFigIds(sec);
                        const hwEntriesByIdx = new Map(getSectionImageEntries(sec).map(e => [e.itemIdx, e.figId.toLowerCase()]));
                        const hwUnplacedBefore = (sec.items || [])
                          .map((it, itIdx) => ({ it, itIdx }))
                          .filter(({ it, itIdx }) => it?.type === 'image' && it.position === 'before' && !hwRefFigs.has(hwEntriesByIdx.get(itIdx)));
                        const hwUnplacedAfter = (sec.items || [])
                          .map((it, itIdx) => ({ it, itIdx }))
                          .filter(({ it, itIdx }) => it?.type === 'image' && it.position !== 'before' && !hwRefFigs.has(hwEntriesByIdx.get(itIdx)));

                        return (
                          <div className="homework-table" style={isArabic ? { fontFamily: arabicFont } : {}}>
                            <div className="homework-header-row">
                              <div className="homework-bareme-header">{calculateTotalPoints(sec.content, isArabic, `${sec.points ? `(${sec.points} pts) ` : ''}${sec.title || ''} ${sec.section_header || ''}`.trim())}</div>
                              <div className="homework-content-header">
                                {isArabic ? 'تمرين' : 'Exercice'} {exeNumber} {exeLabel ? ` : ${exeLabel}` : ''}
                              </div>
                            </div>

                            {hwUnplacedBefore.length > 0 && (
                              <div className="homework-row homework-media-row">
                                <div className="homework-bareme-cell" />
                                <div className="homework-content-cell homework-media-cell">
                                  {hwUnplacedBefore.map(({ it, itIdx }) => renderInlineFigureNode(it, `hw-before-${itIdx}`))}
                                </div>
                              </div>
                            )}
                            
                            {renderHomeworkBody(sec.content, isArabic, arabicFont, renderWithMath, sec.id, handlePointsChange, isDirectEdit, handleContentChange, sec)}

                            {hwUnplacedAfter.length > 0 && (
                              <div className="homework-row homework-media-row">
                                <div className="homework-bareme-cell" />
                                <div className="homework-content-cell homework-media-cell">
                                  {hwUnplacedAfter.map(({ it, itIdx }) => renderInlineFigureNode(it, `hw-after-${itIdx}`))}
                                </div>
                              </div>
                            )}

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
                                        {renderMathWithSectionFigures(sec.solution, sec)}
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

                                {/* Attached images/tables with position === 'before' (skip images already placed via [[FIG:N]]) */}
                                {(() => {
                                  const refFigs = getReferencedFigIds(sec);
                                  const entriesByIdx = new Map(getSectionImageEntries(sec).map(e => [e.itemIdx, e.figId.toLowerCase()]));
                                  return (sec.items || [])
                                    .map((it, origIdx) => ({ item: it, origIdx }))
                                    .filter(({ item, origIdx }) =>
                                      (item.type === 'image' || item.type === 'table') &&
                                      item.position === 'before' &&
                                      !(item.type === 'image' && refFigs.has(entriesByIdx.get(origIdx)))
                                    )
                                    .map(({ item, origIdx }) => {
                                      if (item.type === 'image') {
                                        return renderInlineFigureNode(item, `ex-img-before-${origIdx}`);
                                      }
                                      if (item.type === 'table') {
                                        return (
                                          <div key={`ex-tbl-before-${origIdx}`} style={{ margin: '0.8rem 0', width: '100%' }}>
                                            <SmartTableRenderer table={item.table || item.data || item.text || item} title={item.title} />
                                          </div>
                                        );
                                      }
                                      return null;
                                    });
                                })()}

                                {isDirectEdit ? (
                                  <textarea
                                    value={sec.content !== undefined ? sec.content : (Array.isArray(sec.items) ? sec.items.filter(it => it && it.type !== 'image' && it.type !== 'table').map(it => it.text || (typeof it === 'string' ? it : '')).join('\n') : '')}
                                    onChange={e => handleUpdateSectionContent(sec.id, e.target.value)}
                                    placeholder="Énoncé de l'exercice..."
                                    rows={Math.max(3, (sec.content || (Array.isArray(sec.items) ? sec.items.map(it => it.text || '').join('\n') : '')).split('\n').length)}
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
                                  <>
                                    {sec.content ? renderMathWithSectionFigures(sec.content, sec) : null}
                                    {(!sec.content || (Array.isArray(sec.items) && sec.items.some(it => it && it.type !== 'image' && it.type !== 'table'))) && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: sec.content ? '0.75rem' : '0' }}>
                                        {(sec.items || [])
                                          .filter(it => it && it.type !== 'image' && it.type !== 'table')
                                          .map((it, itIdx) => {
                                            const itText = it?.text || (typeof it === 'string' ? it : '');
                                            if (!itText) return null;
                                            return (
                                              <div key={itIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                                                {it.type === 'bullet' && <span style={{ color: 'var(--violet)', fontWeight: 900, fontSize: '0.9rem', lineHeight: 1.5 }}>•</span>}
                                                <span style={{ flex: 1 }}>{renderMathWithSectionFigures(itText, sec)}</span>
                                              </div>
                                            );
                                          })}
                                      </div>
                                    )}
                                  </>
                                )}

                            {/* Attached images and tables inside exercise (default / after, skip images placed via [[FIG:N]]) */}
                            {(() => {
                              const refFigs = getReferencedFigIds(sec);
                              const entriesByIdx = new Map(getSectionImageEntries(sec).map(e => [e.itemIdx, e.figId.toLowerCase()]));
                              return (sec.items || [])
                                .map((it, origIdx) => ({ item: it, origIdx }))
                                .filter(({ item, origIdx }) =>
                                  (item.type === 'image' || item.type === 'table') &&
                                  item.position !== 'before' &&
                                  !(item.type === 'image' && refFigs.has(entriesByIdx.get(origIdx)))
                                )
                                .map(({ item, origIdx }) => {
                                  if (item.type === 'image') {
                                    return renderInlineFigureNode(item, `ex-img-after-${origIdx}`);
                                  }
                                  if (item.type === 'table') {
                                    return (
                                      <div key={`ex-tbl-${origIdx}`} style={{ margin: '1rem 0', width: '100%' }}>
                                        <SmartTableRenderer table={item.table || item.data || item.text || item} title={item.title} />
                                      </div>
                                    );
                                  }
                                  return null;
                                });
                            })()}
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
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexDirection: isArabic ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <h4 style={{
                                color: '#059669', fontWeight: 800,
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                fontSize: '1rem',
                                margin: 0,
                                flexDirection: isArabic ? 'row-reverse' : 'row',
                                fontFamily: isArabic ? arabicFont : 'inherit',
                              }}>
                                <BookOpenCheck size={18} />
                                {isArabic ? 'الحل المفصل والتصحيح' : 'Démonstration rédigée & Corrigé'}
                              </h4>
                              {sec.solution && (
                                <button
                                  type="button"
                                  onClick={() => handleGenerateAiSolutionForSection(sec.id, sec)}
                                  disabled={solvingSecId === sec.id}
                                  className="no-print"
                                  style={{
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    color: '#059669',
                                    border: '1px solid rgba(16, 185, 129, 0.25)',
                                    borderRadius: '6px',
                                    padding: '0.2rem 0.6rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: solvingSecId === sec.id ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                  }}
                                  title={isArabic ? 'إعادة توليد الحل بالذكاء الاصطناعي' : 'Régénérer le corrigé avec l\'IA'}
                                >
                                  {solvingSecId === sec.id ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                                  <span>{solvingSecId === sec.id ? (isArabic ? 'جاري الحل...' : 'Génération...') : (isArabic ? 'إعادة التوليد بالذكاء' : 'Régénérer par IA')}</span>
                                </button>
                              )}
                            </div>
                            <div style={{
                              display: 'flex', flexDirection: 'column', gap: '1rem',
                              fontSize: '0.92rem', lineHeight: 1.85,
                              textAlign: isArabic ? 'right' : 'left',
                              fontFamily: isArabic ? arabicFont : 'inherit',
                              direction: isArabic ? 'rtl' : 'ltr',
                            }}>
                              {sec.solution ? (
                                renderMathWithSectionFigures(sec.solution, sec)
                              ) : (
                                <div className="no-print" style={{ textAlign: 'center', padding: '1.25rem 0.5rem' }}>
                                  <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', fontSize: '0.88rem' }}>
                                    {isArabic ? 'لا يوجد حل مسجل لهذا التمرين حتى الآن.' : 'Aucun corrigé n’est encore enregistré pour cet exercice.'}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateAiSolutionForSection(sec.id, sec)}
                                    disabled={solvingSecId === sec.id}
                                    style={{
                                      background: 'linear-gradient(135deg, #059669, #10b981)',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '8px',
                                      padding: '0.5rem 1.25rem',
                                      fontWeight: 800,
                                      fontSize: '0.85rem',
                                      cursor: solvingSecId === sec.id ? 'not-allowed' : 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.45rem',
                                      boxShadow: '0 2px 10px rgba(16, 185, 129, 0.25)'
                                    }}
                                  >
                                    {solvingSecId === sec.id ? (
                                      <>
                                        <Loader2 className="animate-spin" size={15} />
                                        <span>{isArabic ? 'جاري توليد الحل بالذكاء الاصطناعي وفق المنهاج المغربي...' : 'Génération du corrigé IA officiel...'}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles size={15} style={{ color: '#fef08a' }} />
                                        <span>{isArabic ? '✨ تصحيح وحل التمرين بالذكاء الاصطناعي' : '✨ Résoudre et corriger avec l\'IA'}</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
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
