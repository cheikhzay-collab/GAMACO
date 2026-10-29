/* eslint-disable react-refresh/only-export-components */
/**
 * mathRenderer.jsx — L'CONQ | KaTeX rendering utility (v4 — Direct KaTeX)
 *
 * ROOT CAUSE FIX:
 *   react-katex@3.1.0 does NOT support the `settings` prop — it ignores it
 *   completely. It always calls katex.renderToString with only:
 *     { displayMode, errorColor, throwOnError: !!renderError }
 *   This means strict:'ignore' was never applied → KaTeX kept using default
 *   strict:'warn' → console warnings for any impure LaTeX (e.g. \r accent).
 *
 * Solution: bypass react-katex entirely. Call katex.renderToString() directly
 *   with OUR settings. This guarantees strict:'ignore' + throwOnError:false.
 *
 * Pipeline: input → cleanControlChars → autoWrapLatex → tokenizeMath → renderKatex
 */

import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import SmartTableRenderer, { parseMarkdownTable } from '../components/SmartTableRenderer';

export { SmartTableRenderer, parseMarkdownTable };

export function MathText({ text, children }) {
  const content = text ?? children;
  return renderWithMath(content);
}

/* ─── 1. Master text sanitizer ──────────────────────────────────────────────
 *
 *  Strips ALL control characters that can break LaTeX rendering.
 *  NEVER replaces CR with the string "\r" — that creates the KaTeX
 *  ring-accent command \r which only works in text mode.
 */
export const cleanControlChars = (text) => {
  if (typeof text !== 'string') return String(text ?? '');
  return text
    .replace(/\r\n/g, ' ')          // Windows CRLF → space
    .replace(/[\r\n]/g, ' ')        // lone CR or LF → space
    .replace(/\t/g, ' ')            // Tab → space
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // other control chars → strip
    .replace(/[\u200B-\u200D\uFEFF]/g, '')              // zero-width / BOM → strip
    .replace(/ {2,}/g, ' ')         // collapse multiple spaces
    .trim();
};

/* ─── 2. KaTeX options — applied directly, no middleman ─────────────────────
 *
 *  strict: 'ignore'   → completely silences ALL KaTeX warnings/errors
 *  throwOnError: false → renders partial output on parse error (never throws)
 *  trust: false       → security: disallow \href, \url etc.
 */
const KATEX_OPTIONS = {
  strict: 'ignore',
  throwOnError: false,
  trust: false,
};

/* ─── 3. Core render functions — direct katex calls ─────────────────────────*/

export const repairMathExpression = (latex) => {
  if (!latex) return '';
  
  let repaired = String(latex).trim();

  // Strip accidental outer dollar signs when passed to KaTeX math renderer
  if (repaired.startsWith('$$') && repaired.endsWith('$$') && repaired.length >= 4) {
    repaired = repaired.slice(2, -2).trim();
  } else if (repaired.startsWith('$') && repaired.endsWith('$') && repaired.length >= 2) {
    repaired = repaired.slice(1, -1).trim();
  }
  
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

  // 1b. Repair mathbb (R, N, Z, C, Q, K) missing backslash or braces: mathbbR -> \mathbb{R}
  repaired = repaired
    .replace(/(?<![a-zA-Z\\])mathbb\{?([RNZQCKrnzqck])\}?/g, (_, l) => `\\mathbb{${l.toUpperCase()}}`)
    .replace(/\\mathbb([RNZQCKrnzqck])(?![a-zA-Z])/g, (_, l) => `\\mathbb{${l.toUpperCase()}}`);

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

  // 4b. Enhance fractions containing square roots to \dfrac for optimal textbook vertical clearance
  repaired = repaired.replace(/\\frac(?=\s*\{(?:[^{}]|\{[^{}]*\})*\\sqrt)/g, '\\dfrac');
  repaired = repaired.replace(/\\frac(\s*\{(?:[^{}]|\{[^{}]*\})*\})(\s*\{(?:[^{}]|\{[^{}]*\})*\\sqrt)/g, '\\dfrac$1$2');

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
    .replace(/\b([uvw])p\b/g, '$1_p');

  // 7. High quality vector, arrow, set, and operator repairs
  repaired = repaired
    .replace(/\\vec\{([a-zA-Z0-9]+)\}/g, '\\overrightarrow{$1}')
    .replace(/(?<!\\)vec\{([a-zA-Z0-9]+)\}/g, '\\overrightarrow{$1}')
    .replace(/==>/g, '\\implies')
    .replace(/<=>/g, '\\iff')
    .replace(/->/g, '\\to')
    .replace(/\\rightarrow\b/g, '\\to')
    .replace(/(?<![a-zA-Z\\])implies\b/g, '\\implies')
    .replace(/(?<![a-zA-Z\\])iff\b/g, '\\iff');

  // 8. Unwrap invalid \text{...} inside math if it wraps LaTeX commands
  repaired = repaired.replace(/\\text\{((?:[^{}]|\{[^{}]*\})*\\(?:exists|forall|in|notin|subset|supset|implies|iff|land|lor|neg|ne|neq|le|leq|ge|geq|to|cdot|times|frac|dfrac|sqrt|int|sum|prod|lim|alpha|beta|gamma|delta|pi|theta|infty|mathbb|mathbf|mathcal)\b(?:[^{}]|\{[^{}]*\})*)\}/g, '$1');

  // 8b. Repair broken otin -> \notin (e.g. \sqrt{2}otin\mathbb{R} -> \sqrt{2}\notin\mathbb{R})
  repaired = repaired.replace(/(?<![a-zA-Z\\])otin(?=[\\\{\sA-Z0-9\(\[]|$)/g, '\\notin ');

  // 8c. Repair missing spaces after quantifiers & set relations
  repaired = repaired
    .replace(/\\exists([a-zA-Z0-9])/g, (_, l) => `\\exists ${l}`)
    .replace(/\\exists!([a-zA-Z0-9])/g, (_, l) => `\\exists! ${l}`)
    .replace(/\\forall([a-zA-Z0-9])/g, (_, l) => `\\forall ${l}`)
    .replace(/\\in([A-Z])(?![a-zA-Z])/g, (_, l) => `\\in ${l}`)
    .replace(/\\notin([A-Z])(?![a-zA-Z])/g, (_, l) => `\\notin ${l}`);

  // 8d. Ensure PURE words with spaces inside \boxed{} are wrapped in \text{} for crisp KaTeX rendering
  // (NEVER wrap if it contains LaTeX commands or math operators)
  repaired = repaired.replace(/\\boxed\{((?:[^{}]|\{[^{}]*\})+)\}/g, (match, inner) => {
    const cleanInner = inner.trim();
    const isPureText = !cleanInner.includes('\\') && !/[=<>+\-*\/^_]/.test(cleanInner) && /[a-zA-ZÀ-ÿ]{2,}\s+[a-zA-ZÀ-ÿ]/.test(cleanInner);
    if (isPureText && !cleanInner.includes('\\text{')) {
      return `\\boxed{\\text{${cleanInner}}}`;
    }
    return match;
  });

  // 9. Convert unsupported KaTeX \cline to \hline
  repaired = repaired.replace(/\\cline\s*(?:\{[0-9\- ]+\}|[0-9\- ]+)/g, '\\hline');

  return repaired;
};

function renderInlineKatex(latex) {
  try {
    const repaired = repairMathExpression(latex);
    return katex.renderToString(repaired, { ...KATEX_OPTIONS, displayMode: false });
  } catch {
    // Fallback: show raw latex in italic
    return `<span style="font-style:italic;opacity:0.75">${escapeHtml(latex)}</span>`;
  }
}

function renderBlockKatex(latex) {
  try {
    const repaired = repairMathExpression(latex);
    return katex.renderToString(repaired, { ...KATEX_OPTIONS, displayMode: true });
  } catch {
    return `<span style="font-style:italic;opacity:0.75;display:block">${escapeHtml(latex)}</span>`;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── 4. Safe KaTeX React components ────────────────────────────────────────
 *
 *  Uses dangerouslySetInnerHTML with KaTeX's own sanitized HTML output.
 *  KaTeX output is safe — it only produces math markup.
 */
export function SafeInlineMath({ math }) {
  const html = renderInlineKatex(math);
  return (
    <span
      className="notranslate inline-math-container"
      translate="no"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function SafeBlockMath({ math }) {
  const html = renderBlockKatex(math);
  return (
    <span
      className="notranslate block-math-container"
      translate="no"
      style={{
        display: 'block',
        margin: '0.35em auto',
        textAlign: 'center',
        overflowX: 'auto',
        overflowY: 'hidden',
        maxWidth: '100%',
        WebkitOverflowScrolling: 'touch',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ─── 5. Error boundary (kept as safety net) ─────────────────────────────── */
export class MathErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    void error; // silently swallow
  }
  render() {
    if (this.state.hasError) {
      return (
        <span style={{ fontStyle: 'italic', opacity: 0.75, color: 'inherit' }}>
          {this.props.fallback ?? this.props.math}
        </span>
      );
    }
    return this.props.children;
  }
}

/* ─── 6. Robust $…$ / $$…$$ tokenizer ───────────────────────────────────────
 *
 *  Hand-rolled character-by-character tokenizer. Handles:
 *    • $$…$$  (block math, highest priority)
 *    • $…$    (inline math)
 *    • \$     (escaped dollar — literal $)
 *    • $a$ + $b$  (adjacent math blocks)
 *    • Unclosed $ (treated as literal text)
 */
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
        // Fallback resilience: If unclosed $ is followed by LaTeX commands or math environments,
        // treat remainder of expression as inline math rather than dumping raw code to screen!
        const remainder = text.slice(i + 1);
        if (!found && remainder.trim().length > 0 && (LATEX_COMMAND_RE.test(remainder) || /\\begin\{/.test(remainder))) {
          if (buf) { tokens.push({ type: 'text', content: buf }); buf = ''; }
          tokens.push({ type: 'inline', content: remainder });
          i = text.length;
          break;
        }
        buf += '$';
        i++;
      } else {
        if (buf) { tokens.push({ type: 'text', content: buf }); buf = ''; }
        const mathContent = text.slice(i + 1, j);
        if (/\\begin\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather|split)\}/.test(mathContent)) {
          tokens.push({ type: 'block', content: mathContent });
        } else {
          tokens.push({ type: 'inline', content: mathContent });
        }
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

/* ─── 7. Auto-wrap bare LaTeX (no $ delimiters) ─────────────────────────────
 *
 *  When a string has LaTeX commands but no $ signs, wraps it in $…$.
 */
const LATEX_COMMAND_RE = /\\(?:lim|frac|dfrac|left|right|cdot|sqrt|sum|int|prod|infty|to|ln|log|exp|sin|cos|tan|arcsin|arccos|arctan|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|mathbb|mathcal|mathbf|mathrm|text|vec|hat|bar|tilde|overline|underline|widehat|widetilde|dot|ddot|pm|mp|times|div|cap|cup|in|notin|subset|supset|leq|geq|le|ge|neq|approx|equiv|sim|forall|exists|partial|nabla|rightarrow|leftarrow|Rightarrow|Leftarrow|Leftrightarrow|iff|implies|quad|qquad|ell|Re|Im|max|min|sup|inf|det|dim|ker|rank|mod|circ|bullet|star|oplus|otimes|begin|end)\b/;

/**
 * Automatically wraps standalone LaTeX commands found in regular sentences or titles
 * (e.g. \mathbb{N}, \mathbb{R}, \mathbb{Z}, \in, \notin, \sqrt{x}, \vec{u}, unicode ℕ)
 * into $...$ delimiters so KaTeX parses and renders them elegantly.
 */
export const wrapStandaloneLatexCommands = (text) => {
  if (!text || typeof text !== 'string') return '';
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) return part; // inside existing math block, leave as-is

    // If the non-math part already contains unresolved complex LaTeX, do NOT blindly wrap single operators!
    if (/[\\^_{}]/.test(part) && /\\(?:lim|frac|dfrac|sqrt|sum|int|prod|begin)\b/.test(part)) {
      return part;
    }

    return part
      .replace(/[\u2115]/g, '$\\mathbb{N}$')
      .replace(/[\u211D]/g, '$\\mathbb{R}$')
      .replace(/[\u2124]/g, '$\\mathbb{Z}$')
      .replace(/[\u211A]/g, '$\\mathbb{Q}$')
      .replace(/[\u2102]/g, '$\\mathbb{C}$')
      .replace(/(?<![$\w\\])(\\boxed\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})+)\})(?![$\w\\])/g, (_, m, inner) => {
        const cleanInner = inner.trim();
        const isPureText = !cleanInner.includes('\\') && !/[=<>+\-*\/^_]/.test(cleanInner) && /[a-zA-ZÀ-ÿ]{2,}\s+[a-zA-ZÀ-ÿ]/.test(cleanInner);
        const formattedInner = isPureText && !cleanInner.includes('\\text{')
          ? `\\text{${cleanInner}}`
          : cleanInner;
        return `$\\boxed{${formattedInner}}$`;
      })
      .replace(/(?<![$\w\\])(\\(?:mathbb|mathbf|mathcal|mathrm)\{[a-zA-Z0-9]+\}(?:[\^_][a-zA-Z0-9\+\*\-]+)*)(?![$\w\\])/g, (_, m) => `$${m}$`)
      .replace(/(?<![$\w\\])(?:\\?mathbb\{?([RNZQCKrnzqck])\}?((?:[\^_][a-zA-Z0-9\+\*\-]+)*))(?![$\w\\])/g, (_, l, suf) => `$\\mathbb{${l.toUpperCase()}}${suf || ''}$`)
      .replace(/(?<![$\w\\])(\\(?:sqrt|vec|overrightarrow)\{[^{}]+\})(?![$\w\\])/g, (_, m) => `$${m}$`)
      .replace(/(?<![$\w\\])(\\(?:notin|in|subset|subseteq|cap|cup|emptyset|implies|iff|to|rightarrow|leftarrow|leq|geq|neq|approx|pm|mp|times|cdot|forall|exists))\b(?![$\w\\])/g, (_, m) => `$${m}$`);
  }).join('');
};

function autoWrapLatex(text) {
  if (!text) return '';
  if (text.includes('$')) return text;
  
  // Don't auto-wrap if it's a markdown bullet point or contains markdown bold/italic
  if (/^\s*[\*\-+]\s+/.test(text) || text.includes('**') || /(?<!\*)\*[^*]+\*/.test(text)) {
    return text;
  }
  
  // Any text containing Arabic characters is a textual sentence/instruction, NEVER wrap the whole string in $...$
  if (/[\u0600-\u06FF]/.test(text)) {
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

function renderTextWithBold(text) {
  if (!text || !text.includes('**')) {
    return text;
  }
  // Guard against unmatched/odd **: strip unclosed edge **
  const count = (text.match(/\*\*/g) || []).length;
  let sanitized = text;
  if (count % 2 !== 0) {
    sanitized = sanitized.replace(/(^\*\*|\*\*$)/, '');
  }
  if (!sanitized.includes('**')) {
    return sanitized;
  }
  const parts = sanitized.split('**');
  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return part ? <strong key={idx} style={{ fontWeight: 800 }}>{part}</strong> : null;
    }
    return part || null;
  });
}

/**
 * Global master math text auto-repairer.
 * Guarantees that all math environments (array, cases, aligned, matrix, etc.)
 * are enclosed in $$ ... $$, repairs unbalanced or missing delimiters,
 * and converts unsupported commands like \cline to \hline.
 */
export const autoRepairMathText = (text) => {
  if (!text || typeof text !== 'string') return text;
  let res = text;

  // 1. Repair broken \neq (e.g. \n eq, newline + eq, or plain eq 0 in conditions)
  res = res
    .replace(/\\n\s*eq\b/g, '\\neq')
    .replace(/(?<=[x-z0-9\s])\beq\s*([0-9a-zA-Z])/g, '\\neq $1')
    .replace(/(?<![a-zA-Z\\])neq\b/g, '\\neq');

  // 2. Convert any unsupported KaTeX \cline commands to \hline
  res = res.replace(/\\cline\s*(?:\{[0-9\- ]+\}|[0-9\- ]+)/g, '\\hline');

  // 3. Normalize and cleanly wrap ALL math environments
  // Catches bare environments, half-delimited environments (e.g. f(x) = \begin{cases}...\end{cases}$$),
  // and forces the entire formula (including LHS prefix) into well-formed display blocks ($$ ... $$)
  const envPattern = /(?:(?:\$\$|\$)\s*)?((?:(?:[a-zA-Z0-9_'\(\)\s\^\{\}\[\]+\\-]+|\\left\.?|\\left\\\{)\s*[:=]\s*)?\\begin\{(cases|aligned|matrix|pmatrix|vmatrix|array|gather|split|bmatrix|Bmatrix)\}[\s\S]*?\\end\{\2\}(?:\s*\\right\.)?)(?:\s*(?:\$\$|\$))?/g;

  res = res.replace(envPattern, (match, body) => {
    let cleanBody = body.replace(/\\cline\s*(?:\{[0-9\- ]+\}|[0-9\- ]+)/g, '\\hline').trim();
    cleanBody = cleanBody.replace(/^\${1,2}/, '').replace(/\${1,2}$/, '').trim();
    return `\n\n$$${cleanBody}$$\n\n`;
  });

  // 4. Repair common corrupted LaTeX commands
  res = res
    .replace(/(?<![a-zA-Z\\])ight\b/g, '\\right')
    .replace(/(?<!\\)right\b/g, '\\right')
    .replace(/(?<!\\)left\b/g, '\\left')
    .replace(/(?<![a-zA-Z\\])frac\{/g, '\\frac{')
    .replace(/(?<![a-zA-Z\\])dfrac\{/g, '\\dfrac{')
    .replace(/(?<![a-zA-Z\\])rac\{/g, '\\frac{')
    .replace(/(?<![a-zA-Z\\])otin(?=[\\\{\sA-Z0-9\(\[]|$)/g, '\\notin ')
    .replace(/\\exists([a-zA-Z0-9])/g, (_, l) => `\\exists ${l}`)
    .replace(/\\exists!([a-zA-Z0-9])/g, (_, l) => `\\exists! ${l}`)
    .replace(/\\forall([a-zA-Z0-9])/g, (_, l) => `\\forall ${l}`)
    .replace(/\\in([A-Z])(?![a-zA-Z])/g, (_, l) => `\\in ${l}`)
    .replace(/\\notin([A-Z])(?![a-zA-Z])/g, (_, l) => `\\notin ${l}`);

  // 5. Unwrap invalid \text{...} inside \boxed{} that wraps math formulas
  res = res.replace(/\\boxed\{\\text\{((?:[^{}]|\{[^{}]*\})*\\(?:exists|forall|in|notin|subset|supset|implies|iff|land|lor|neg|ne|neq|le|leq|ge|geq|to|cdot|times|frac|dfrac|sqrt|int|sum|prod|lim|alpha|beta|gamma|delta|pi|theta|infty|mathbb|mathbf|mathcal)\b(?:[^{}]|\{[^{}]*\})*)\}\}/g, '\\boxed{$1}');

  // 6. Wrap standalone bare \boxed{...} with $ if not already in math (supports nested braces)
  res = res.replace(/(?<![$a-zA-Z0-9_\\])(\\boxed\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})+)\})(?![$a-zA-Z0-9_\\])/g, '$$$1$$');

  return res;
};

// Helper to retroactively repair LaTeX formulas corrupted by JSON string escaping (e.g., \right becoming ight)
const repairCorruptedLatex = (text) => {
  if (!text) return text;
  return autoRepairMathText(text);
};

/* ─── 8. Main render function ────────────────────────────────────────────────
 *
 *  Entry point for ALL text rendering in the app.
 *  Pipeline: input → split on \n → clean each segment → tokenize → render
 *
 *  FIX (2026-06): cleanControlChars was collapsing ALL \n into spaces,
 *  destroying the multi-line structure of astuces (étapes numérotées).
 *  Now we split FIRST on \n\n (paragraphs) and \n (lines), clean each
 *  line individually, then reassemble with proper block/inline elements.
 */
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

const renderTableSegment = (segment, key) => {
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
  
  const renderCellContent = (cellText) => {
    const toParse = wrapStandaloneLatexCommands(autoWrapLatex(cellText));
    const tokens = tokenizeMath(toParse);
    if (tokens.length === 1 && tokens[0].type === 'text') {
      return renderTextWithBold(tokens[0].content);
    }
    return tokens.map((tok, i) => {
      if (tok.type === 'block')  return <SafeBlockMath  key={i} math={tok.content} />;
      if (tok.type === 'inline') return <SafeInlineMath key={i} math={tok.content} />;
      return <span key={i}>{renderTextWithBold(tok.content)}</span>;
    });
  };
  
  return (
    <div key={key} className="markdown-table-wrapper" style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0', width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
      <table className="markdown-table" style={{
        borderCollapse: 'collapse',
        width: '100%',
        maxWidth: '100%',
        border: '1px solid #cbd5e1',
        fontSize: '0.85rem',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#ffffff',
        tableLayout: 'auto'
      }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
            {headerCells.map((cell, idx) => (
              <th key={idx} style={{
                padding: '6px 10px',
                border: '1px solid #cbd5e1',
                fontWeight: '800',
                color: '#005086',
                textAlign: alignments[idx] || 'center',
                fontSize: '0.85rem',
                lineHeight: 1.3
              }}>
                {renderCellContent(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {segment.dataRows.map((row, rIdx) => {
            const cells = parseRowCells(row);
            const isAlt = rIdx % 2 === 1;
            return (
              <tr key={rIdx} style={{ backgroundColor: isAlt ? '#f8fafc' : '#ffffff' }}>
                {cells.map((cell, idx) => (
                  <td key={idx} style={{
                    padding: '5px 10px',
                    border: '1px solid #cbd5e1',
                    textAlign: alignments[idx] || 'center',
                    color: '#334155',
                    fontSize: '0.85rem',
                    lineHeight: 1.3
                  }}>
                    {renderCellContent(cell)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export function renderWithMath(text) {
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

  // Collapse colon followed by newline and math formula into a single line
  rawText = rawText.replace(/(:\s*)\n+\s*(\$\$|\$)/g, ' : $2');

  const lines = rawText.split('\n');
  const mergedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match prefix like "1.", "a)", "B.", "**1.**", "**a)**" on its own line
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
  rawText = mergedLines.join('\n');

  const repaired = repairCorruptedLatex(rawText);
  const raw = repaired;
  if (!raw.trim()) return null;

  const segments = extractTablesAndText(raw);
  
  if (segments.length === 1 && segments[0].type === 'text') {
    return renderWithMathInternal(segments[0].content);
  }
  
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === 'table') {
          return renderTableSegment(seg, idx);
        }
        return <span key={idx} style={{ display: 'block' }}>{renderWithMathInternal(seg.content)}</span>;
      })}
    </>
  );
}

function renderWithMathInternal(text) {
  const raw = text;
  if (!raw.trim()) return null;

  // ── Image shorthand ──
  if (raw.trim().startsWith('img:')) {
    const url = raw.trim().slice(4).trim();
    return (
      <div style={{ textAlign: 'center', margin: '1rem 0' }}>
        <img
          src={url}
          alt="Question illustration"
          style={{
            maxWidth: '100%',
            maxHeight: '240px',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            cursor: 'zoom-in',
            objectFit: 'contain',
          }}
          onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }}
        />
      </div>
    );
  }


  // ── Normalise line endings ──
  // Also convert literal escape sequences "\n" (2-char: backslash + n) → real newline.
  // These appear when astuces are stored/transmitted as JSON-escaped strings.
  // LaTeX commands like \nabla, \neq, \nearrow etc. are safe because we only replace
  // literal "\n" OUTSIDE of math blocks ($...$ or $$...$$).
  const normalisedTemp = raw
    .replace(/\r\n/g, '\n')                // Windows CRLF → LF
    .replace(/\r/g, '\n');                 // lone CR → LF
  
  const normalised = normalisedTemp.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g)
    .map((part, idx) => {
      if (idx % 2 === 1) return part;
      let cleanedPart = part.replace(/\\n(?!(?:eq|ne|notin|nabla|nsubseteq|nsupseteq|nexists|nparallel|natural|nearrow|nwarrow|ni|not|neg)\b)/gi, '\n');
      
      // Force line break after period followed by space and uppercase letter
      // NOTE: exclude when preceded by a digit (numbered list item like "1. Calculer") or single letter (like "A. Calculer")
      cleanedPart = cleanedPart.replace(/(?<!\d|^|\n|\b\d\.[a-zA-Z]|\bex|\betc|\bvs|\b[a-zA-Z])\.\s+([A-ZÀ-ÖØ-ß])/g, '.\n$1');

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
    const cleaned = cleanControlChars(normalised);
    if (!cleaned) return null;
    const toParse = autoWrapLatex(cleaned);
    const tokens = tokenizeMath(toParse);
    if (tokens.length === 1 && tokens[0].type === 'text') {
      return <span>{renderTextWithBold(tokens[0].content)}</span>;
    }
    return tokens.map((tok, i) => {
      if (tok.type === 'block')  return <SafeBlockMath  key={i} math={tok.content} />;
      if (tok.type === 'inline') return <SafeInlineMath key={i} math={tok.content} />;
      return <span key={i}>{renderTextWithBold(tok.content)}</span>;
    });
  }

  const renderLineContent = (text) => {
    const toParse = autoWrapLatex(text);
    const tokens = tokenizeMath(toParse);
    if (tokens.length === 1 && tokens[0].type === 'text') {
      return renderTextWithBold(tokens[0].content);
    }
    return tokens.map((tok, i) => {
      if (tok.type === 'block')  return <SafeBlockMath  key={i} math={tok.content} />;
      if (tok.type === 'inline') return <SafeInlineMath key={i} math={tok.content} />;
      return <span key={i}>{renderTextWithBold(tok.content)}</span>;
    });
  };

  // ── Multi-line path: render each line, group by paragraphs ──
  const renderLine = (line, key) => {
    const cleaned = line
      .replace(/\t/g, ' ')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/ {2,}/g, ' ')
      .trim();
    if (!cleaned) return null;

    // ── Markdown Headings: ###### ##### #### ### ## #
    if (/^######\s+/.test(cleaned)) {
      const text = cleaned.replace(/^######\s+/, '');
      return (
        <div key={key} style={{ fontWeight: 800, fontSize: '0.85rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.5rem 0 0.25rem' }}>
          {renderLineContent(text)}
        </div>
      );
    }
    if (/^#####\s+/.test(cleaned)) {
      const text = cleaned.replace(/^#####\s+/, '');
      return (
        <div key={key} style={{ fontWeight: 800, fontSize: '0.88rem', color: '#005086', margin: '0.6rem 0 0.3rem' }}>
          {renderLineContent(text)}
        </div>
      );
    }
    if (/^####\s+/.test(cleaned)) {
      const text = cleaned.replace(/^####\s+/, '');
      return (
        <div key={key} style={{ fontWeight: 800, fontSize: '0.92rem', color: '#005086', borderBottom: '1px dashed rgba(0,80,134,0.15)', paddingBottom: '0.2rem', margin: '0.75rem 0 0.35rem' }}>
          {renderLineContent(text)}
        </div>
      );
    }
    if (/^###\s+/.test(cleaned)) {
      const text = cleaned.replace(/^###\s+/, '');
      return (
        <div key={key} style={{ fontWeight: 800, fontSize: '0.98rem', color: '#005086', borderBottom: '1px solid rgba(0,80,134,0.15)', paddingBottom: '0.25rem', margin: '0.85rem 0 0.4rem' }}>
          {renderLineContent(text)}
        </div>
      );
    }
    if (/^##\s+/.test(cleaned)) {
      const text = cleaned.replace(/^##\s+/, '');
      return (
        <div key={key} style={{ fontWeight: 900, fontSize: '1.08rem', color: '#005086', borderBottom: '1.5px solid rgba(0,80,134,0.2)', paddingBottom: '0.3rem', margin: '1rem 0 0.5rem' }}>
          {renderLineContent(text)}
        </div>
      );
    }
    if (/^#\s+/.test(cleaned)) {
      const text = cleaned.replace(/^#\s+/, '');
      return (
        <div key={key} style={{ fontWeight: 900, fontSize: '1.25rem', color: '#005086', borderBottom: '2px solid rgba(0,80,134,0.3)', paddingBottom: '0.4rem', margin: '1.1rem 0 0.6rem' }}>
          {renderLineContent(text)}
        </div>
      );
    }

    // ── Horizontal Rule / Separator: ---, ***, ___
    if (/^(?:---|\*\*\*|___)\s*$/.test(cleaned)) {
      return <hr key={key} style={{ border: 'none', borderTop: '1px solid #cbd5e1', margin: '0.85rem 0' }} />;
    }

    // ── Markdown unordered list: - item  or  • item  or  * item (but not LaTeX like \mu, ** bold, etc.)
    if (/^[-•]\s+/.test(cleaned) || (/^\*\s+/.test(cleaned) && !cleaned.startsWith('**'))) {
      const text = cleaned.replace(/^[-•*]\s+/, '');
      return (
        <div key={key} className="list-item-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', margin: '0.2rem 0', lineHeight: 1.7 }}>
          <span className="list-num" style={{ color: '#005086', fontWeight: 800, flexShrink: 0, marginTop: '0.05em' }}>•</span>
          <span className="list-content" style={{ flex: 1 }}>{renderLineContent(text)}</span>
        </div>
      );
    }

    // ── Markdown numbered list: 1. or 1) 
    const numberedMatch = cleaned.match(/^(\d+)[.)\s]/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const text = cleaned.replace(/^\d+[.)\s]+/, '');
      return (
        <div key={key} className="list-item-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', margin: '0.2rem 0', lineHeight: 1.7 }}>
          <span className="list-num" style={{ color: '#005086', fontWeight: 800, flexShrink: 0, minWidth: '1.5em' }}>{num}.</span>
          <span className="list-content" style={{ flex: 1 }}>{renderLineContent(text)}</span>
        </div>
      );
    }

    // Response Block (Réponse :)
    if (cleaned.toLowerCase().startsWith('**réponse') || cleaned.toLowerCase().startsWith('réponse')) {
      const contentText = cleaned.replace(/^(\*\*)?réponse\s*:?\s*/i, '').replace(/\*\*$/, '');
      return (
        <div key={key} className="mfc-callout-response" style={{
          background: 'rgba(16, 185, 129, 0.08)',
          borderLeft: '4px solid var(--emerald)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          color: 'var(--text-main)',
          margin: '0.75rem 0',
          lineHeight: 1.6
        }}>
          <strong style={{ color: 'var(--emerald)', marginRight: '0.5rem', fontWeight: 800 }}>Réponse :</strong>
          {renderLineContent(contentText)}
        </div>
      );
    }

    // Attention/Warning Block (Attention :)
    if (cleaned.toLowerCase().startsWith('**attention') || cleaned.toLowerCase().startsWith('attention')) {
      const contentText = cleaned.replace(/^(\*\*)?attention\s*:?\s*/i, '').replace(/\*\*$/, '');
      return (
        <div key={key} className="mfc-callout-attention" style={{
          background: 'rgba(245, 158, 11, 0.08)',
          borderLeft: '4px solid var(--warning)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          color: 'var(--text-main)',
          margin: '0.75rem 0',
          lineHeight: 1.6
        }}>
          <strong style={{ color: 'var(--warning)', marginRight: '0.5rem', fontWeight: 800 }}>Attention :</strong>
          {renderLineContent(contentText)}
        </div>
      );
    }

    // Step Block (Étape N)
    const stepRegex = /^(\*\*)?Étape\s*(\d+)\s*(?:—|-|:)?\s*(.*)$/i;
    const stepMatch = cleaned.match(stepRegex);
    if (stepMatch) {
      const stepNum = stepMatch[2];
      const stepText = stepMatch[3].replace(/\*\*$/, '');
      return (
        <div key={key} className="mfc-callout-step" style={{
          margin: '1rem 0 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            alignSelf: 'flex-start',
            background: 'var(--violet-soft)',
            color: 'var(--violet)',
            padding: '0.2rem 0.65rem',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <span>Étape {stepNum}</span>
          </div>
          {stepText && (
            <div style={{ paddingLeft: '0.25rem', lineHeight: 1.7 }}>
              {renderLineContent(stepText)}
            </div>
          )}
        </div>
      );
    }

    // Bare LaTeX block: Line starts with \ and does not contain $
    if (cleaned.startsWith('\\') && !cleaned.includes('$')) {
      return <SafeBlockMath key={key} math={repairCorruptedLatex(cleaned)} />;
    }

    const content = renderLineContent(cleaned);
    return <span key={key} style={{ display: 'block', lineHeight: 1.75 }}>{content}</span>;
  };

  const tokens = tokenizeMath(normalised);

  // Group tokens into paragraphs (by \n\n) and lines (by \n)
  let paragraphs = [ [[]] ];
  
  for (const tok of tokens) {
    if (tok.type === 'block') {
      const currentPara = paragraphs[paragraphs.length - 1];
      if (currentPara[currentPara.length - 1].length > 0) {
        currentPara.push([]);
      }
      currentPara[currentPara.length - 1].push(tok);
      currentPara.push([]);
    } else if (tok.type === 'inline') {
      const currentPara = paragraphs[paragraphs.length - 1];
      currentPara[currentPara.length - 1].push(tok);
    } else {
      const paraParts = tok.content.split(/\n{2,}/);
      for (let pIdx = 0; pIdx < paraParts.length; pIdx++) {
        if (pIdx > 0) {
          paragraphs.push([[]]);
        }
        const currentPara = paragraphs[paragraphs.length - 1];
        
        const lineParts = paraParts[pIdx].split('\n');
        for (let lIdx = 0; lIdx < lineParts.length; lIdx++) {
          if (lIdx > 0) {
            currentPara.push([]);
          }
          if (lineParts[lIdx]) {
            currentPara[currentPara.length - 1].push({ type: 'text', content: lineParts[lIdx] });
          }
        }
      }
    }
  }

  const isSubListItem = (str) => {
    if (!str) return false;
    const trimmed = str.trim();
    return /^[-•*]\s+/i.test(trimmed) || /^[-•*]?\s*(\*\*|\*)?([a-zA-Z]|\d+)[\.\)]/i.test(trimmed);
  };

  const isTableLine = (str) => {
    if (!str) return false;
    const trimmed = str.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && (trimmed.match(/\|/g) || []).length >= 2;
  };

  const renderLinesGrouped = (lines, baseKey) => {
    const elements = [];
    let currentGridGroup = [];
    let currentTableLines = [];

    const flushTableGroup = () => {
      if (currentTableLines.length === 0) return;
      if (currentTableLines.length >= 2) {
        const tableText = currentTableLines.map(t => t.lineStr).join('\n');
        elements.push(<SmartTableRenderer key={`${baseKey}-table-${elements.length}`} table={tableText} />);
      } else {
        currentTableLines.forEach(({ lineStr, li }) => {
          elements.push(renderLine(lineStr, `${baseKey}-${li}`));
        });
      }
      currentTableLines = [];
    };

    const flushGridGroup = () => {
      if (currentGridGroup.length === 0) return;
      if (currentGridGroup.length === 1) {
        const { lineStr, li } = currentGridGroup[0];
        elements.push(renderLine(lineStr, `${baseKey}-${li}`));
      } else {
        elements.push(
          <div
            key={`${baseKey}-grid-${elements.length}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.4rem 1rem',
              margin: '0.5rem 0',
              width: '100%'
            }}
          >
            {currentGridGroup.map(({ lineStr, li }) => renderLine(lineStr, `${baseKey}-grid-item-${li}`))}
          </div>
        );
      }
      currentGridGroup = [];
    };

    lines.forEach((lineTokens, li) => {
      if (lineTokens.length === 0) return;
      if (lineTokens.length === 1 && lineTokens[0].type === 'block') {
        flushTableGroup();
        flushGridGroup();
        elements.push(<SafeBlockMath key={`${baseKey}-blk-${li}`} math={lineTokens[0].content} />);
        return;
      }
      const reconstructedLine = lineTokens.map(t => {
        if (t.type === 'inline') return `$${t.content}$`;
        if (t.type === 'block') return `$$${t.content}$$`;
        return t.content;
      }).join('');

      if (isTableLine(reconstructedLine)) {
        flushGridGroup();
        currentTableLines.push({ lineStr: reconstructedLine, li });
      } else {
        flushTableGroup();
        if (isSubListItem(reconstructedLine)) {
          currentGridGroup.push({ lineStr: reconstructedLine, li });
        } else {
          flushGridGroup();
          elements.push(renderLine(reconstructedLine, `${baseKey}-${li}`));
        }
      }
    });

    flushTableGroup();
    flushGridGroup();
    return elements;
  };

  if (paragraphs.length === 1) {
    const lines = paragraphs[0];
    return (
      <span style={{ display: 'block' }}>
        {renderLinesGrouped(lines, 'single-para')}
      </span>
    );
  }

  return (
    <>
      {paragraphs.map((lines, pi) => {
        return (
          <div key={pi} style={{ margin: '0.35em 0', lineHeight: 1.75 }}>
            {renderLinesGrouped(lines, `para-${pi}`)}
          </div>
        );
      })}
    </>
  );
}

/* ─── 9. renderToHtmlString — Pure HTML string for print windows ─────────────
 *
 *  Unlike renderWithMath() which returns JSX, this returns a plain HTML string.
 *  KaTeX renders math via renderToString. Markdown is converted to basic HTML.
 *  Safe to inject via innerHTML or window.open().
 *
 *  Supports: # ## ### headings, **bold**, bullet lists, $$…$$, $…$, ---
 */
export function renderToHtmlString(text) {
  if (!text || typeof text !== 'string') return '';

  // 1. Normalise newlines + literal \n escape sequences
  let raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  raw = raw.replace(/\\n/g, '\n');

  // 2. Pre-process LaTeX repair and standalone command wrapping
  raw = autoRepairMathText(raw);
  raw = wrapStandaloneLatexCommands(raw);

  // 3. Render math to KaTeX HTML
  const renderMathInline = (latex) => {
    try {
      return katex.renderToString(repairMathExpression(latex), { ...KATEX_OPTIONS, displayMode: false });
    } catch { return `<em>${latex}</em>`; }
  };

  const renderMathBlock = (latex) => {
    try {
      return `<div style="overflow-x:auto;text-align:center;margin:.75em 0">${katex.renderToString(repairMathExpression(latex), { ...KATEX_OPTIONS, displayMode: true })}</div>`;
    } catch { return `<pre>${latex}</pre>`; }
  };

  // 4. Extract multi-line block math ($$ ... $$) into placeholders BEFORE line splitting
  const blockPlaceholders = [];
  raw = raw.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    const ph = `__BLOCK_MATH_${blockPlaceholders.length}__`;
    blockPlaceholders.push(renderMathBlock(math));
    return `\n\n${ph}\n\n`;
  });

  // 5. Process inline math delimiters in a string
  const processMath = (str) => {
    let out = '';
    let i = 0;
    while (i < str.length) {
      if (str[i] === '\\' && str[i + 1] === '$') { out += '$'; i += 2; continue; }
      if (str[i] === '$') {
        let j = i + 1; let found = false;
        while (j < str.length) { if (str[j] === '\\') { j += 2; continue; } if (str[j] === '$') { found = true; break; } j++; }
        if (found && j > i + 1) { out += renderMathInline(str.slice(i + 1, j)); i = j + 1; continue; }
      }
      out += str[i]; i++;
    }
    return out;
  };

  // 6. Bold + math
  const processInline = (str) =>
    processMath(str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'));

  // 7. Line-by-line conversion
  const lines = raw.split('\n');
  const html = [];
  let inList = false;
  const flushList = () => { if (inList) { html.push('</ul>'); inList = false; } };

  for (const line of lines) {
    const t = line.trim();
    if (!t) { flushList(); html.push('<div style="height:.4em"></div>'); continue; }

    // Check for block math placeholder
    const blockMatch = t.match(/^__BLOCK_MATH_(\d+)__$/);
    if (blockMatch) {
      flushList();
      const idx = parseInt(blockMatch[1], 10);
      if (blockPlaceholders[idx]) html.push(blockPlaceholders[idx]);
      continue;
    }

    if (t.startsWith('### ')) { flushList(); html.push(`<h3 style="font-size:.97rem;color:#7C3AED;margin:1.1rem 0 .4rem">${processInline(t.slice(4))}</h3>`); continue; }
    if (t.startsWith('## '))  { flushList(); html.push(`<h2 style="font-size:1.06rem;color:#059669;border-left:3px solid #059669;padding-left:.6rem;margin:1.5rem 0 .5rem">${processInline(t.slice(3))}</h2>`); continue; }
    if (t.startsWith('# '))   { flushList(); html.push(`<h1 style="font-size:1.3rem;border-bottom:2px solid #7C3AED;padding-bottom:.4rem;margin-bottom:1rem">${processInline(t.slice(2))}</h1>`); continue; }
    if (/^---+$/.test(t))     { flushList(); html.push('<hr style="margin:1.5rem 0;opacity:.15">'); continue; }

    if (/^[-*•]\s+/.test(t)) {
      if (!inList) { html.push('<ul style="padding-left:1.4rem;margin:.4rem 0">'); inList = true; }
      html.push(`<li style="margin:.22rem 0">${processInline(t.replace(/^[-*•]\s+/, ''))}</li>`);
      continue;
    }

    flushList();
    html.push(`<p style="margin:.35rem 0;line-height:1.85">${processInline(t)}</p>`);
  }
  flushList();
  return html.join('\n');
}
