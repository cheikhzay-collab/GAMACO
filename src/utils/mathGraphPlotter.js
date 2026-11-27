// src/utils/mathGraphPlotter.js
// Deterministic, safe SVG coordinate-plane & curve plotter for Moroccan Baccalauréat & DEVOIR PRIME.
// Evaluates mathematical expressions via a pure recursive-descent parser (no eval/Function)
// and renders orthonormal axes (O, i, j), curves, asymptotes, tangents, and projected points.

const CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
};

const FUNCTIONS = {
  ln: (x) => (x > 0 ? Math.log(x) : NaN),
  log: (x) => (x > 0 ? Math.log10(x) : NaN),
  log10: (x) => (x > 0 ? Math.log10(x) : NaN),
  exp: (x) => Math.exp(x),
  sqrt: (x) => (x >= 0 ? Math.sqrt(x) : NaN),
  abs: (x) => Math.abs(x),
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  asin: (x) => Math.asin(x),
  acos: (x) => Math.acos(x),
  atan: (x) => Math.atan(x),
  arctan: (x) => Math.atan(x),
  sinh: (x) => Math.sinh(x),
  sh: (x) => Math.sinh(x),
  cosh: (x) => Math.cosh(x),
  ch: (x) => Math.cosh(x),
  tanh: (x) => Math.tanh(x),
  th: (x) => Math.tanh(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  sign: (x) => Math.sign(x),
  pow: (a, b) => Math.pow(a, b),
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
};

function sanitizeRawExpr(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  // Strip optional assignment prefix like "f(x) =" or "y ="
  s = s.replace(/^(?:[a-zA-Z]\s*\(\s*x\s*\)|y)\s*=\s*/i, '');
  // Normalize Math.* prefixes if LLM emitted JS math syntax
  s = s
    .replace(/\bMath\.log10\b/g, 'log10')
    .replace(/\bMath\.log\b/g, 'ln')
    .replace(/\bMath\.E\b/g, 'e')
    .replace(/\bMath\.PI\b/g, 'pi')
    .replace(/\bMath\.([a-zA-Z0-9_]+)\b/g, '$1');
  // Convert ** power operator and Unicode minus/multiplication signs
  s = s
    .replace(/\*\*/g, '^')
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/');
  // Handle simple non-nested |expr| -> abs(expr)
  s = s.replace(/\|([^|]+)\|/g, 'abs($1)');
  return s;
}

function tokenizeMathExpr(raw) {
  const expr = sanitizeRawExpr(raw);
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        if (expr[i] === '.') dotCount++;
        if (dotCount > 1) break;
        numStr += expr[i++];
      }
      // Scientific notation e.g. 1e-3
      if (i < expr.length && (expr[i] === 'e' || expr[i] === 'E') && /[0-9+-]/.test(expr[i + 1] || '')) {
        const save = i;
        let expPart = expr[i++];
        if (expr[i] === '+' || expr[i] === '-') expPart += expr[i++];
        let digits = '';
        while (i < expr.length && /[0-9]/.test(expr[i])) digits += expr[i++];
        if (digits) {
          numStr += expPart + digits;
        } else {
          i = save;
        }
      }
      const val = Number(numStr);
      if (!Number.isFinite(val)) return null;
      tokens.push({ type: 'num', value: val });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i++];
      }
      tokens.push({ type: 'ident', value: id.toLowerCase() });
      continue;
    }
    if ('+-*/^(),'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    // Unknown character
    return null;
  }

  // Insert implicit multiplication tokens:
  // 2x -> 2*x, 2(x) -> 2*(x), x(x+1) -> x*(x+1), (a)(b) -> (a)*(b), (a)x -> (a)*x, e^x stays e^x
  const withImplicit = [];
  const isValueEnd = (t) =>
    t && (t.type === 'num' || (t.type === 'ident' && !FUNCTIONS[t.value]) || (t.type === 'op' && t.value === ')'));
  const isValueStart = (t) =>
    t && (t.type === 'num' || t.type === 'ident' || (t.type === 'op' && t.value === '('));

  for (let k = 0; k < tokens.length; k++) {
    const prev = withImplicit[withImplicit.length - 1];
    const curr = tokens[k];
    if (prev && isValueEnd(prev) && isValueStart(curr)) {
      withImplicit.push({ type: 'op', value: '*' });
    }
    withImplicit.push(curr);
  }

  return withImplicit;
}

/**
 * Compiles a math expression in variable `x` into a safe evaluator `(x) => number`.
 * Returns null if the expression cannot be parsed.
 */
export function compileMathExpr(raw) {
  const tokens = tokenizeMathExpr(raw);
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;
  const peek = () => tokens[pos] || null;
  const consume = () => tokens[pos++];

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseMulDiv();
      const l = left;
      const r = right;
      left = op === '+' ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
    }
    return left;
  }

  function parseMulDiv() {
    let left = parseUnary();
    while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value;
      const right = parseUnary();
      const l = left;
      const r = right;
      left = op === '*' ? (x) => l(x) * r(x) : (x) => l(x) / r(x);
    }
    return left;
  }

  function parseUnary() {
    if (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const inner = parseUnary();
      return op === '-' ? (x) => -inner(x) : inner;
    }
    return parsePow();
  }

  function parsePow() {
    const base = parsePrimary();
    if (peek() && peek().type === 'op' && peek().value === '^') {
      consume();
      const exponent = parseUnary();
      return (x) => Math.pow(base(x), exponent(x));
    }
    return base;
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok.type === 'num') {
      consume();
      const val = tok.value;
      return () => val;
    }

    if (tok.type === 'ident') {
      consume();
      const name = tok.value;
      if (peek() && peek().type === 'op' && peek().value === '(') {
        consume(); // '('
        const args = [];
        if (!(peek() && peek().type === 'op' && peek().value === ')')) {
          args.push(parseAddSub());
          while (peek() && peek().type === 'op' && peek().value === ',') {
            consume();
            args.push(parseAddSub());
          }
        }
        if (!peek() || peek().type !== 'op' || peek().value !== ')') {
          throw new Error('Missing closing parenthesis');
        }
        consume(); // ')'
        const fn = FUNCTIONS[name];
        if (!fn) throw new Error(`Unknown function: ${name}`);
        return (x) => fn(...args.map((a) => a(x)));
      }
      if (name === 'x') return (x) => x;
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
        const c = CONSTANTS[name];
        return () => c;
      }
      throw new Error(`Unknown identifier: ${name}`);
    }

    if (tok.type === 'op' && tok.value === '(') {
      consume();
      const inner = parseAddSub();
      if (!peek() || peek().type !== 'op' || peek().value !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      consume();
      return inner;
    }

    throw new Error('Unexpected token');
  }

  try {
    const fn = parseAddSub();
    if (pos !== tokens.length) return null;
    return fn;
  } catch {
    return null;
  }
}

const escapeXml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const niceStep = (span) => {
  if (span <= 8) return 1;
  if (span <= 16) return 2;
  if (span <= 35) return 5;
  return 10;
};

const formatTickLabel = (n) => {
  if (Math.abs(n) < 1e-9) return '0';
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
};

/**
 * Normalizes a raw AI-returned graph specification object.
 * Returns null if the object has no drawable elements.
 */
export function normalizeGraphSpec(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const toFinite = (v, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };

  let xMin = toFinite(raw.xMin, -3);
  let xMax = toFinite(raw.xMax, 6);
  let yMin = toFinite(raw.yMin, -3);
  let yMax = toFinite(raw.yMax, 6);
  if (xMax <= xMin) { xMin = -3; xMax = 6; }
  if (yMax <= yMin) { yMin = -3; yMax = 6; }

  const curves = Array.isArray(raw.curves)
    ? raw.curves
        .filter((c) => c && typeof c.expr === 'string' && c.expr.trim())
        .map((c, idx) => ({
          expr: c.expr.trim(),
          label: String(c.label || (idx === 0 ? '(C)' : '')).trim(),
          color: c.color || (idx === 0 ? '#1d4ed8' : '#0f766e'),
          dashed: Boolean(c.dashed),
          strokeWidth: toFinite(c.strokeWidth, idx === 0 ? 2.2 : 1.7),
          domain: Array.isArray(c.domain) && c.domain.length === 2 ? [toFinite(c.domain[0], xMin), toFinite(c.domain[1], xMax)] : null,
          domains: Array.isArray(c.domains)
            ? c.domains.filter((d) => Array.isArray(d) && d.length === 2).map((d) => [toFinite(d[0], xMin), toFinite(d[1], xMax)])
            : null,
        }))
    : [];

  const asymptotes = Array.isArray(raw.asymptotes)
    ? raw.asymptotes
        .filter((a) => a && typeof a === 'object')
        .map((a) => ({
          type: ['vertical', 'horizontal', 'oblique'].includes(a.type) ? a.type : 'vertical',
          value: a.value !== undefined && a.value !== null ? toFinite(a.value, NaN) : NaN,
          expr: typeof a.expr === 'string' ? a.expr.trim() : '',
          a: a.a !== undefined ? toFinite(a.a, NaN) : NaN,
          b: a.b !== undefined ? toFinite(a.b, 0) : 0,
          label: String(a.label || '').trim(),
          color: a.color || '#dc2626',
        }))
    : [];

  const tangents = Array.isArray(raw.tangents)
    ? raw.tangents
        .filter((t) => t && Number.isFinite(Number(t.x)) && Number.isFinite(Number(t.y)))
        .map((t) => ({
          x: Number(t.x),
          y: Number(t.y),
          slope: t.slope === 'vertical' || t.slope === 'Infinity' ? 'vertical' : toFinite(t.slope, 0),
          half: ['left', 'right', 'both'].includes(t.half) ? t.half : 'both',
          length: toFinite(t.length, 1.5),
          label: String(t.label || '').trim(),
          color: t.color || '#7c3aed',
        }))
    : [];

  const points = Array.isArray(raw.points)
    ? raw.points
        .filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
        .map((p) => ({
          x: Number(p.x),
          y: Number(p.y),
          label: String(p.label || '').trim(),
          project: Boolean(p.project),
          color: p.color || '#0f172a',
        }))
    : [];

  if (curves.length === 0 && asymptotes.length === 0 && tangents.length === 0 && points.length === 0) {
    return null;
  }

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    showGrid: raw.showGrid !== false,
    caption: String(raw.caption || '').trim(),
    curves,
    asymptotes,
    tangents,
    points,
  };
}

/**
 * Generates a crisp standalone SVG string representing the Moroccan coordinate system & plotted elements.
 */
export function buildMathGraphSvg(rawGraph, options = {}) {
  const graph = normalizeGraphSpec(rawGraph);
  if (!graph) return '';

  const maxWidth = Number(options.maxWidth) || 410;
  const maxHeight = Number(options.maxHeight) || 265;
  const pad = { top: 18, right: 22, bottom: 22, left: 26 };

  const xSpan = graph.xMax - graph.xMin;
  const ySpan = graph.yMax - graph.yMin;

  // Preserve orthonormal 1:1 scale as much as possible within box bounds
  const availW = maxWidth - pad.left - pad.right;
  const availH = maxHeight - pad.top - pad.bottom;
  const pxPerUnit = Math.min(availW / xSpan, availH / ySpan);

  const plotW = Math.round(xSpan * pxPerUnit);
  const plotH = Math.round(ySpan * pxPerUnit);
  const svgW = plotW + pad.left + pad.right;
  const svgH = plotH + pad.top + pad.bottom;

  const toPxX = (x) => pad.left + (x - graph.xMin) * pxPerUnit;
  const toPxY = (y) => pad.top + (graph.yMax - y) * pxPerUnit;
  const fmt = (n) => Number(n.toFixed(2));

  const clipId = `dp-clip-${Math.random().toString(36).slice(2, 9)}`;
  const arrowDarkId = `dp-arr-dark-${clipId}`;
  const arrowVecId = `dp-arr-vec-${clipId}`;
  const arrowTanId = `dp-arr-tan-${clipId}`;

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="max-width:100%;height:auto;display:block;background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;">`
  );

  // Defs: ClipPath + Arrow Markers
  parts.push(`<defs>`);
  parts.push(`<clipPath id="${clipId}"><rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}"/></clipPath>`);
  parts.push(`<marker id="${arrowDarkId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0f172a"/></marker>`);
  parts.push(`<marker id="${arrowVecId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#1e3a8a"/></marker>`);
  parts.push(`<marker id="${arrowTanId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 2 L 8.5 5 L 0 8 z" fill="#7c3aed"/></marker>`);
  parts.push(`</defs>`);

  // Plot frame background
  parts.push(`<rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8"/>`);

  // Grid lines
  const stepX = niceStep(xSpan);
  const stepY = niceStep(ySpan);
  if (graph.showGrid) {
    const startGx = Math.ceil(graph.xMin);
    for (let gx = startGx; gx <= Math.floor(graph.xMax); gx++) {
      const px = fmt(toPxX(gx));
      const isMajor = gx % stepX === 0;
      parts.push(
        `<line x1="${px}" y1="${pad.top}" x2="${px}" y2="${pad.top + plotH}" stroke="${isMajor ? '#e2e8f0' : '#f1f5f9'}" stroke-width="${isMajor ? '0.9' : '0.6'}"/>`
      );
    }
    const startGy = Math.ceil(graph.yMin);
    for (let gy = startGy; gy <= Math.floor(graph.yMax); gy++) {
      const py = fmt(toPxY(gy));
      const isMajor = gy % stepY === 0;
      parts.push(
        `<line x1="${pad.left}" y1="${py}" x2="${pad.left + plotW}" y2="${py}" stroke="${isMajor ? '#e2e8f0' : '#f1f5f9'}" stroke-width="${isMajor ? '0.9' : '0.6'}"/>`
      );
    }
  }

  // Coordinate Axes (Ox, Oy)
  const hasOriginX = graph.xMin <= 0 && graph.xMax >= 0;
  const hasOriginY = graph.yMin <= 0 && graph.yMax >= 0;
  const axisY = hasOriginY ? fmt(toPxY(0)) : fmt(pad.top + plotH);
  const axisX = hasOriginX ? fmt(toPxX(0)) : fmt(pad.left);

  // Horizontal Ox axis
  parts.push(
    `<line x1="${pad.left}" y1="${axisY}" x2="${pad.left + plotW}" y2="${axisY}" stroke="#0f172a" stroke-width="1.35" marker-end="url(#${arrowDarkId})"/>`
  );
  // Vertical Oy axis
  parts.push(
    `<line x1="${axisX}" y1="${pad.top + plotH}" x2="${axisX}" y2="${pad.top}" stroke="#0f172a" stroke-width="1.35" marker-end="url(#${arrowDarkId})"/>`
  );

  // Ticks & graduation numbers
  const tickFont = `font-family="'STIX Two Text', 'Times New Roman', serif" font-size="10.5" fill="#334155"`;
  for (let gx = Math.ceil(graph.xMin / stepX) * stepX; gx <= graph.xMax - 0.15; gx += stepX) {
    if (Math.abs(gx) < 1e-6) continue;
    const px = fmt(toPxX(gx));
    parts.push(`<line x1="${px}" y1="${fmt(axisY - 3)}" x2="${px}" y2="${fmt(axisY + 3)}" stroke="#0f172a" stroke-width="1"/>`);
    parts.push(`<text x="${px}" y="${fmt(axisY + 13)}" text-anchor="middle" ${tickFont}>${escapeXml(formatTickLabel(gx))}</text>`);
  }
  for (let gy = Math.ceil(graph.yMin / stepY) * stepY; gy <= graph.yMax - 0.15; gy += stepY) {
    if (Math.abs(gy) < 1e-6) continue;
    const py = fmt(toPxY(gy));
    parts.push(`<line x1="${fmt(axisX - 3)}" y1="${py}" x2="${fmt(axisX + 3)}" y2="${py}" stroke="#0f172a" stroke-width="1"/>`);
    parts.push(`<text x="${fmt(axisX - 6)}" y="${fmt(py + 3.5)}" text-anchor="end" ${tickFont}>${escapeXml(formatTickLabel(gy))}</text>`);
  }

  // Origin O + Unit vectors i, j when origin is inside frame
  if (hasOriginX && hasOriginY) {
    const ox = fmt(toPxX(0));
    const oy = fmt(toPxY(0));
    parts.push(`<text x="${fmt(ox - 6)}" y="${fmt(oy + 13)}" text-anchor="end" font-family="'STIX Two Text', serif" font-size="11" font-weight="700" fill="#0f172a">O</text>`);
    if (graph.xMax >= 1.15) {
      const ix = fmt(toPxX(1));
      parts.push(`<line x1="${ox}" y1="${oy}" x2="${ix}" y2="${oy}" stroke="#1e3a8a" stroke-width="2" marker-end="url(#${arrowVecId})"/>`);
      parts.push(`<text x="${fmt((ox + ix) / 2)}" y="${fmt(oy - 5)}" text-anchor="middle" font-family="'STIX Two Text', serif" font-size="11" font-style="italic" font-weight="700" fill="#1e3a8a">i⃗</text>`);
    }
    if (graph.yMax >= 1.15) {
      const jy = fmt(toPxY(1));
      parts.push(`<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${jy}" stroke="#1e3a8a" stroke-width="2" marker-end="url(#${arrowVecId})"/>`);
      parts.push(`<text x="${fmt(ox + 8)}" y="${fmt((oy + jy) / 2 + 3)}" text-anchor="start" font-family="'STIX Two Text', serif" font-size="11" font-style="italic" font-weight="700" fill="#1e3a8a">j⃗</text>`);
    }
  }

  // Axis end labels (x, y)
  parts.push(`<text x="${fmt(pad.left + plotW + 6)}" y="${fmt(axisY + 4)}" font-family="'STIX Two Text', serif" font-size="11.5" font-style="italic" fill="#0f172a">x</text>`);
  parts.push(`<text x="${fmt(axisX + 6)}" y="${fmt(pad.top + 8)}" font-family="'STIX Two Text', serif" font-size="11.5" font-style="italic" fill="#0f172a">y</text>`);

  // Clipped group for asymptotes, curves, tangents, projected points
  parts.push(`<g clip-path="url(#${clipId})">`);

  // 1. Asymptotes
  const labelOverlays = [];
  graph.asymptotes.forEach((asym) => {
    if (asym.type === 'vertical' && Number.isFinite(asym.value)) {
      const px = fmt(toPxX(asym.value));
      parts.push(`<line x1="${px}" y1="${pad.top}" x2="${px}" y2="${pad.top + plotH}" stroke="${escapeXml(asym.color)}" stroke-width="1.4" stroke-dasharray="5,4"/>`);
      if (asym.label && asym.value >= graph.xMin && asym.value <= graph.xMax) {
        labelOverlays.push({ x: Math.min(pad.left + plotW - 18, px + 5), y: pad.top + 14, text: asym.label, color: asym.color });
      }
    } else if (asym.type === 'horizontal' && Number.isFinite(asym.value)) {
      const py = fmt(toPxY(asym.value));
      parts.push(`<line x1="${pad.left}" y1="${py}" x2="${pad.left + plotW}" y2="${py}" stroke="${escapeXml(asym.color)}" stroke-width="1.4" stroke-dasharray="5,4"/>`);
      if (asym.label && asym.value >= graph.yMin && asym.value <= graph.yMax) {
        labelOverlays.push({ x: pad.left + 8, y: Math.max(pad.top + 13, py - 5), text: asym.label, color: asym.color });
      }
    } else if (asym.type === 'oblique') {
      const fn = asym.expr
        ? compileMathExpr(asym.expr)
        : (Number.isFinite(asym.a) ? (x) => asym.a * x + asym.b : null);
      if (fn) {
        const y1 = fn(graph.xMin);
        const y2 = fn(graph.xMax);
        if (Number.isFinite(y1) && Number.isFinite(y2)) {
          parts.push(
            `<line x1="${fmt(toPxX(graph.xMin))}" y1="${fmt(toPxY(y1))}" x2="${fmt(toPxX(graph.xMax))}" y2="${fmt(toPxY(y2))}" stroke="${escapeXml(asym.color)}" stroke-width="1.4" stroke-dasharray="5,4"/>`
          );
          if (asym.label) {
            const lx = graph.xMax - 0.8;
            const ly = fn(lx);
            if (ly >= graph.yMin + 0.3 && ly <= graph.yMax - 0.3) {
              labelOverlays.push({ x: fmt(toPxX(lx)), y: fmt(toPxY(ly) - 6), text: asym.label, color: asym.color });
            }
          }
        }
      }
    }
  });

  // 2. Curves
  const yClampMin = graph.yMin - ySpan * 1.5;
  const yClampMax = graph.yMax + ySpan * 1.5;

  graph.curves.forEach((curve) => {
    const fn = compileMathExpr(curve.expr);
    if (!fn) return;

    const domainList = curve.domains && curve.domains.length > 0
      ? curve.domains
      : [curve.domain || [graph.xMin, graph.xMax]];

    let lastVisibleSample = null;
    const allPaths = [];

    domainList.forEach(([rawStart, rawEnd]) => {
      const start = Math.max(graph.xMin, Math.min(rawStart, rawEnd));
      const end = Math.min(graph.xMax, Math.max(rawStart, rawEnd));
      if (end <= start) return;

      const steps = 420;
      let seg = [];
      let prevY = null;

      const flushSeg = () => {
        if (seg.length >= 2) {
          allPaths.push(
            seg.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${fmt(toPxX(pt.x))} ${fmt(toPxY(pt.y))}`).join(' ')
          );
        }
        seg = [];
      };

      for (let i = 0; i <= steps; i++) {
        const x = start + ((end - start) * i) / steps;
        const y = fn(x);
        if (!Number.isFinite(y) || y < yClampMin || y > yClampMax) {
          flushSeg();
          prevY = null;
          continue;
        }
        // Split path across vertical asymptote jumps
        if (prevY !== null && Math.abs(y - prevY) > ySpan * 0.95) {
          flushSeg();
        }
        seg.push({ x, y });
        prevY = y;
        if (y >= graph.yMin + 0.15 && y <= graph.yMax - 0.15 && x >= graph.xMin + 0.25 && x <= graph.xMax - 0.35) {
          lastVisibleSample = { x, y };
        }
      }
      flushSeg();
    });

    if (allPaths.length > 0) {
      const dashAttr = curve.dashed ? ` stroke-dasharray="6,4"` : '';
      parts.push(
        `<path d="${allPaths.join(' ')}" fill="none" stroke="${escapeXml(curve.color)}" stroke-width="${curve.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}/>`
      );
      if (curve.label && lastVisibleSample) {
        labelOverlays.push({
          x: Math.min(pad.left + plotW - 22, fmt(toPxX(lastVisibleSample.x) - 4)),
          y: Math.max(pad.top + 14, Math.min(pad.top + plotH - 6, fmt(toPxY(lastVisibleSample.y) - 8))),
          text: curve.label,
          color: curve.color,
        });
      }
    }
  });

  // 3. Tangents / Half-Tangents
  graph.tangents.forEach((tan) => {
    if (tan.slope === 'vertical') {
      const px = fmt(toPxX(tan.x));
      const py0 = fmt(toPxY(tan.y));
      const dy = (tan.half === 'left' ? 1 : -1) * tan.length;
      const py1 = fmt(toPxY(tan.y + dy));
      parts.push(
        `<line x1="${px}" y1="${py0}" x2="${px}" y2="${py1}" stroke="${escapeXml(tan.color)}" stroke-width="1.5" marker-end="url(#${arrowTanId})"/>`
      );
      return;
    }
    const m = Number(tan.slope);
    const norm = Math.hypot(1, m) || 1;
    const dx = tan.length / norm;
    const dy = (m * tan.length) / norm;
    const x1 = tan.half === 'right' ? tan.x : tan.x - dx;
    const y1 = tan.half === 'right' ? tan.y : tan.y - dy;
    const x2 = tan.half === 'left' ? tan.x : tan.x + dx;
    const y2 = tan.half === 'left' ? tan.y : tan.y + dy;
    const markers = tan.half === 'both'
      ? ` marker-start="url(#${arrowTanId})" marker-end="url(#${arrowTanId})"`
      : ` marker-end="url(#${arrowTanId})"`;
    parts.push(
      `<line x1="${fmt(toPxX(x1))}" y1="${fmt(toPxY(y1))}" x2="${fmt(toPxX(x2))}" y2="${fmt(toPxY(y2))}" stroke="${escapeXml(tan.color)}" stroke-width="1.5"${markers}/>`
    );
    if (tan.label) {
      labelOverlays.push({ x: fmt(toPxX(x2) + 4), y: fmt(toPxY(y2) - 4), text: tan.label, color: tan.color });
    }
  });

  // 4. Remarkable Points & Projections
  graph.points.forEach((pt) => {
    const px = fmt(toPxX(pt.x));
    const py = fmt(toPxY(pt.y));
    if (pt.project) {
      parts.push(`<line x1="${px}" y1="${py}" x2="${px}" y2="${axisY}" stroke="#64748b" stroke-width="1" stroke-dasharray="3,3"/>`);
      parts.push(`<line x1="${px}" y1="${py}" x2="${axisX}" y2="${py}" stroke="#64748b" stroke-width="1" stroke-dasharray="3,3"/>`);
    }
    parts.push(`<circle cx="${px}" cy="${py}" r="3.2" fill="${escapeXml(pt.color)}" stroke="#ffffff" stroke-width="1"/>`);
    if (pt.label) {
      labelOverlays.push({ x: px + 5, y: py - 5, text: pt.label, color: pt.color });
    }
  });

  parts.push(`</g>`);

  // Draw crisp labels outside clip or on top
  labelOverlays.forEach((lb) => {
    const lx = Math.max(pad.left + 4, Math.min(pad.left + plotW - 14, lb.x));
    const ly = Math.max(pad.top + 11, Math.min(pad.top + plotH - 4, lb.y));
    parts.push(
      `<text x="${fmt(lx)}" y="${fmt(ly)}" font-family="'STIX Two Text', 'Times New Roman', serif" font-size="11.5" font-weight="700" fill="${escapeXml(lb.color)}">${escapeXml(lb.text)}</text>`
    );
  });

  parts.push(`</svg>`);
  return parts.join('');
}
