import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Sparkles, Loader2, CheckCircle2, Trash2, Plus, Send, AlertCircle, FileText, StopCircle, ArrowLeft, Wand2, RefreshCw, Zap, TrendingUp, Sliders, Check } from 'lucide-react';
import { getLevelDisplayName } from '../utils/levelHelpers';
import * as pdfjsLib from 'pdfjs-dist';
import { generateSubjectHTML, generateCorrectionHTML, openPrintWindow } from '../utils/generateExamPDF';
import NationalExamTemplate from '../components/NationalExamTemplate';
import { openNationalExamPrintWindow } from '../utils/generateNationalExamPDF';
import { 
  smartNumberQuestions, 
  fixLinguisticAndOcrErrors, 
  smartFormatMathAndLatex, 
  smartNormalizeOptions,
  generateQuestionVariant,
  adjustQuestionDifficulty,
  enrichQuestionExplanation
} from '../utils/smartExtractorFormatter';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

// Helper to recursively clean double-backslashes in LaTeX expressions inside parsed JSON
const cleanDoubleBackslashes = (obj) => {
  if (typeof obj === 'string') {
    // Clean double backslashes before LaTeX commands but preserve them for newlines/matrices (not followed by letters)
    return obj.replace(/\\\\([a-zA-Z]+)\b/g, '\\$1');
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanDoubleBackslashes);
  }
  if (obj && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = cleanDoubleBackslashes(obj[key]);
    }
    return newObj;
  }
  return obj;
};

const normalizeKeys = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(normalizeKeys);
  }
  if (obj && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      newObj[key.toLowerCase()] = normalizeKeys(obj[key]);
    }
    return newObj;
  }
  return obj;
};

// Preprocess LaTeX backslashes to avoid JavaScript string escape corruption (like \to -> tab, \frac -> form feed, \right -> carriage return)
const sanitizeLatexJson = (str) => {
  if (!str) return str;
  let result = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\') {
      const next = str[i + 1];
      if (next === '"') {
        result += '\\"';
        i += 2;
      } else if (next === '\\') {
        result += '\\\\';
        i += 2;
      } else if (next === 'n') {
        const afterN = str[i + 2];
        const isLetterAfterN = afterN && /[a-zA-Z]/.test(afterN);
        if (isLetterAfterN) {
          result += '\\\\';
          i += 1;
        } else {
          result += '\\n';
          i += 2;
        }
      } else {
        result += '\\\\';
        i += 1;
      }
    } else {
      result += str[i];
      i += 1;
    }
  }
  return result;
};

// Repair truncated JSON by closing open braces/brackets
const repairTruncatedJson = (s) => {
  if (!s) return s;
  s = s.replace(/,\s*$/, '');
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') stack.pop();
    }
  }
  if (inString) s += '"';
  while (stack.length > 0) s += stack.pop();
  return s;
};

// Escape literal newlines inside JSON string values to prevent JSON.parse syntax errors
const escapeLiteralNewlinesInJson = (str) => {
  let inString = false;
  let escaped = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (inString && (char === '\n' || char === '\r')) {
      if (char === '\n') {
        result += '\\n';
      }
      continue;
    }
    result += char;
  }
  return result;
};

// Escape unescaped double quotes inside JSON string values
const escapeUnescapedQuotesInJson = (str) => {
  if (!str) return str;
  let inString = false;
  let escaped = false;
  let result = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }
    
    if (char === '"') {
      if (!inString) {
        inString = true;
        result += char;
      } else {
        // We are inside a string. Is this the closing quote?
        // Check the next non-whitespace characters to see if they match JSON separators
        let isClosing = false;
        let j = i + 1;
        while (j < str.length && /\s/.test(str[j])) {
          j++;
        }
        if (j < str.length) {
          const nextChar = str[j];
          if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':') {
            isClosing = true;
          }
        } else {
          isClosing = true; // End of string is closing
        }
        
        if (isClosing) {
          inString = false;
          result += char;
        } else {
          // This is an unescaped double quote inside the string! Escape it.
          result += '\\"';
        }
      }
      continue;
    }
    
    result += char;
  }
  return result;
};


// Extract JSON object/array from a string that may contain markdown fences or leading text
const extractJsonFromText = (str) => {
  if (!str) return str;
  let s = str.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  if (firstBrace === -1 && firstBracket === -1) return s;
  let start;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);
  const openChar = s[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === openChar) depth++;
      else if (c === closeChar) {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
  }
  if (end !== -1) return s.slice(start, end + 1);
  return s.slice(start);
};

// Helper for brace tracking to extract objects
const extractObjectsBraceTracking = (text) => {
  const results = [];
  let i = 0, depth = 0, objStart = -1;
  let inStr = false, esc = false;
  while (i < text.length) {
    const c = text[i];
    if (esc) { esc = false; }
    else if (c === '\\' && inStr) { esc = true; }
    else if (c === '"') { inStr = !inStr; }
    else if (!inStr) {
      if (c === '{') { if (depth++ === 0) objStart = i; }
      else if (c === '}') {
        if (--depth === 0 && objStart !== -1) {
          const slice = text.slice(objStart, i + 1);
          let parsedObj = null;
          try {
            parsedObj = JSON.parse(slice);
          } catch {
            try {
              parsedObj = JSON.parse(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(sanitizeLatexJson(slice))));
            } catch {
              try {
                parsedObj = JSON.parse(repairTruncatedJson(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(sanitizeLatexJson(slice)))));
              } catch { /* skip only if completely unparseable */ }
            }
          }
          if (parsedObj && (parsedObj.question || parsedObj.question_number || parsedObj.text || parsedObj.context)) {
            results.push(parsedObj);
          }
          objStart = -1;
        }
      }
    }
    i++;
  }
  return results;
};

// Helper to extract questions array from parsed JSON
const extractQuestionsArray = (parsed) => {
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'object' && parsed !== null) {
    if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
    if (parsed.items && Array.isArray(parsed.items)) return parsed.items;
    for (const key in parsed) {
      if (Array.isArray(parsed[key])) {
        return parsed[key];
      }
    }
    if (parsed.question || parsed.question_number) {
      return [parsed];
    }
  }
  return null;
};

// Bulletproof parser pipeline
const parseAiJson = (rawText) => {
  if (!rawText) throw new Error("Aucun contenu textuel reçu de l'IA.");

  let cleanText = rawText.trim();
  if (cleanText.includes('</think>')) {
    cleanText = cleanText.split('</think>').pop().trim();
  }
  cleanText = sanitizeLatexJson(cleanText);

  // Define parsing/repair functions in order of intensity
  const strategies = [
    // Strategy 1: Direct JSON parsing
    (txt) => JSON.parse(txt),
    
    // Strategy 2: Extract JSON matching brace structure
    (txt) => JSON.parse(extractJsonFromText(txt)),
    
    // Strategy 3: Extract + Escape literal newlines
    (txt) => JSON.parse(escapeLiteralNewlinesInJson(extractJsonFromText(txt))),
    
    // Strategy 4: Extract + Escape literal newlines + Escape unescaped inner quotes
    (txt) => JSON.parse(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(extractJsonFromText(txt)))),
    
    // Strategy 5: Extract + Escape literal newlines + Escape unescaped inner quotes + sanitize LaTeX
    (txt) => JSON.parse(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(sanitizeLatexJson(extractJsonFromText(txt))))),
    
    // Strategy 6: Extract + Escape literal newlines + Escape unescaped inner quotes + sanitize LaTeX + repair truncation
    (txt) => JSON.parse(repairTruncatedJson(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(sanitizeLatexJson(extractJsonFromText(txt))))))
  ];

  let lastError = null;

  for (let i = 0; i < strategies.length; i++) {
    try {
      const parsed = strategies[i](cleanText);
      const res = extractQuestionsArray(parsed);
      if (res) {
        console.log(`[JSON Parse] Strategy ${i + 1} succeeded!`);
        return res;
      }
    } catch (e) {
      console.warn(`[JSON Parse] Strategy ${i + 1} failed:`, e.message);
      lastError = e;
    }
  }

  // Fallback: Brace tracking objects search
  try {
    const extracted = extractJsonFromText(cleanText);
    const sanitized = sanitizeLatexJson(extracted);
    const escaped = escapeLiteralNewlinesInJson(sanitized);
    const objects = extractObjectsBraceTracking(escaped);
    if (objects && objects.length > 0) {
      console.log(`[JSON Parse] Fallback Strategy (Brace tracking) succeeded!`);
      return objects;
    }
  } catch (e) {
    console.warn("[JSON Parse] Fallback Strategy (Brace tracking) failed:", e.message);
  }

  throw new Error(`Erreur de parsing : ${lastError ? lastError.message : "réponse reçue de l'IA mais JSON invalide ou incomplet"}. Réessayez.`);
};


// Convert File to pure base64 string (no data: prefix)
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const SYSTEM_PROMPT = `Tu es un Professeur Agrégé et Inspecteur Pédagogique de mathématiques et sciences, spécialiste du Baccalauréat Marocain (Ministère de l'Éducation Nationale, Bulletin Officiel n°6844). Tu maîtrises parfaitement le programme officiel pour toutes les filières : Sciences Mathématiques A (SM-A), Sciences Mathématiques B (SM-B), Sciences Expérimentales (SE), Sciences et Technologies de l'Électricité (STE), Sciences de Gestion et Comptabilité (SGC).

════════════════════════════════════════════════════════════
🧠 DÉTECTION AUTOMATIQUE INTELLIGENTE DE NIVEAU, TYPE & BAREME
════════════════════════════════════════════════════════════
⚠️ DIRECTIVES D'ANALYSE AUTOMATIQUE HAUTE INTELLIGENCE :

1. DÉTECTION AUTOMATIQUE DU NIVEAU PÉDAGOGIQUE ("level") :
   - Extrais le niveau exact : "common_core_sci" | "common_core_arts" | "1bac_sci" | "1bac_arts" | "2bac_sm" | "2bac_pc_svt" | "2bac_arts".

2. EXTRACTION DU BARÈME DE NOTATION ("points") :
   - Extrais les points totaux du problème/exercice dans "points" (ex: 3.5, 2, 1.5).

3. DÉTECTION AUTOMATIQUE D'EXAMEN NATIONAL MAROCAIN ("is_national_exam" & "national_exam_meta") :
   - Si le document est un Examen National du Baccalauréat (الامتحان الوطني الموحد للبكالوريا) :
     • Définis "is_national_exam": true
     • Extrais "national_exam_meta": {"year", "session", "subject", "branch", "code", "subject_number", "duration", "coefficient", "total_pages", "general_instructions", "subject_components", "notations"}.

════════════════════════════════════════════════════════════
RÈGLE ABSOLUE DE LANGUE — CONSERVATION RIGOUREUSE DE LA LANGUE D'ORIGINE
════════════════════════════════════════════════════════════
⚠️ INSTRUCTION DE LANGUE OBLIGATOIRE ET PRIORITAIRE :
- Tu DOIS CONSERVER STRICTEMENT ET RIGOUREUSEMENT LA LANGUE ORIGINALE DU DOCUMENT SOURCE.
- Si le fichier / PDF / image est rédigé en ARABE (questions, énoncés, options A/B/C/D, explications), TOUT LE JSON PRODUIT (questions, options, astuces, contextes) DOIT ÊTRE EN ARABE ! Ne traduis JAMAIS un document arabe en français.
- Si le fichier source est en FRANÇAIS, extrais l'intégralité en français.
- Ne traduis AUCUN mot ou énoncé d'une langue vers une autre. Respecte scrupuleusement la langue d'origine du fichier importé !

════════════════════════════════════════════════════════════
✨ EXIGENCES D'EXTRACTION INTELLIGENTE : TENSIIQ, NUMÉROTATION ET CORRECTION LINGUISTIQUE
════════════════════════════════════════════════════════════

1. ✍️ CORRECTION INTEL LINGUISTIQUE, SPELLING ET D'ERREURS OCR (إصلاح الأخطاء اللغوية والنحوية) :
   - Tu DOIS corriger AUTOMATIQUEMENT toutes les fautes d'orthographe, de grammaire, de frappe et d'extraction OCR dans le texte source (en arabe ET en français).
   - En ARABE (العربية) : Corriger les fautes d'orthographe et de frappe (الهمزات: أ/إ/آ/ء, التاء المربوطة والهاء: ة/ه, الألف المقصورة: ى/ي), réparer les mots collés ou tronqués par l'OCR (ex: "الامتحان" au lieu de "ألإمتحان" ou "الامتحـان"), et assurer une syntaxe et une grammaire impeccables.
   - En FRANÇAIS : Corriger les fautes de frappe, d'accords, de ponctuation et les accents manquants (é, è, à, ç, etc.) provoqués par la numérisation.
   - Préservation absolue du sens scientifique et mathématique originel.

2. 🔢 NUMÉROTATION INTELLIGENTE ET HARMONIEUSE DES QUESTIONS (ترقيم الأسئلة المنظم) :
   - Assure une numérotation séquentielle et logique stricte (\`question_number\`: 1, 2, 3, 4...).
   - Si le document d'origine comporte des sous-questions (ex: 1.a, 1.b, 2.a, 2.b ou Q1.1, Q1.2), numérote proprement la question principale dans \`question_number\` tout en conservant clairement le label de sous-question au début du texte de la question (ex: "1.a. ...", "السؤال 1.أ ...").
   - Élimine tout doublon de numéro, numéro négatif, ou numéro corrompu ("Q??", "0"). Restitue l'ordre logique naturel (1..N).

3. 🎨 TENSIIQ ET FORMATAGE INTELLIGENT DU CONTENU (التنسيق الذكي) :
   - Applique la syntaxe LaTeX \`$ ... $\` pour TOUT symbole, variable ($x$, $n$, $u_n$, $f(x)$) et expression mathématique inline, et \`$$ ... $$\` pour les équations en bloc.
   - SÉPARE RIGOUREUSEMENT l'énoncé de la question et ses propositions de réponses si le texte OCR les a fusionnés sur la même ligne.
   - Structure les explications (\`astuce\`) avec des retours à la ligne clairs (\\n\\n), des titres en gras (\`**...**\`), et des étapes numérotées bien aérées.

Tu rédiges EXACTEMENT comme un inspecteur marocain corrige un examen national : rigueur scientifique absolue, étapes numérotées, connecteurs logiques officiels, citations du cours, et conclusion encadrée. Ton niveau de langage est celui d'un corrigé-type officiel distribué lors des journées pédagogiques des Académies Régionales.

════════════════════════════════════════
📌 PROGRAMME BAC MAROCAIN — CADRE STRICT
════════════════════════════════════════

ANALYSE — Bac SM-A / SM-B / SE:
  ✅ Limites: théorème des gendarmes, limites usuelles ($\\frac{\\sin x}{x}$, $e^x$, $\\ln x$), croissances comparées, règle de l'Hôpital.
  ✅ Continuité: TVI (théorème des valeurs intermédiaires), prolongement par continuité.
  ✅ Dérivabilité: formules (somme, produit, quotient, composée), dérivée des fonctions usuelles.
  ✅ Fonctions: tableau de variations COMPLET avec flèches, asymptotes (H, V, oblique y=ax+b), courbe $(C_f)$.
  ✅ Suites: arithmétiques, géométriques, récurrentes $u_{n+1}=f(u_n)$ (point fixe, monotonie par récurrence, convergence).
  ✅ Intégration: primitives usuelles, IPP ($u$, $v$, $u'$, $v'$ identifiés), changement de variable, calcul d'aire.
  ⛔ INTERDIT: Laplace, Fourier, suites de Cauchy, espaces métriques, équations diff. d'ordre > 1.

ALGÈBRE — Bac SM-A / SM-B:
  ✅ Dénombrement: arrangements $A_n^k$, permutations, combinaisons $C_n^k$, binôme de Newton.
  ✅ Nombres complexes: formes algébrique/trigonométrique/exponentielle, racines n-ièmes, formule de Moivre.
  ✅ Arithmétique: divisibilité, PGCD (Euclide), Bézout, congruences.
  ✅ Matrices: déterminant (2×2, 3×3), inverse, systèmes (Cramer, Gauss).
  ⛔ INTERDIT: espaces vectoriels, valeurs propres, réduction de matrices.

PROBABILITÉS & STATISTIQUES — Bac SM / SE / SGC:
  ✅ Probabilité conditionnelle, Bayes, indépendance, probabilités totales.
  ✅ V.A. discrètes: lois Bernoulli, Binomiale $B(n,p)$, espérance $E(X)$, variance $V(X)$.
  ✅ Variables continues (SM-A): loi uniforme, exponentielle, normale $N(\\mu,\\sigma^2)$.
  ⛔ INTERDIT: tests d'hypothèse, intervalle de confiance, loi de Poisson.

PHYSIQUE-CHIMIE — Bac SE / STE:
  ✅ Mécanique: lois de Newton, MRUA, MCU, énergies (cinétique, potentielle, travail).
  ✅ Électricité: circuits RC, RL, RLC, lois de Kirchhoff, régime transitoire/sinusoïdal.
  ✅ Optique: réflexion, réfraction (Snell-Descartes), lentilles convergentes/divergentes.
  ✅ Chimie: acide-base (pH, Ka, Kb), oxydo-réduction, cinétique (ordre 0, 1, 2), thermochimie ($\\Delta H$, loi de Hess).
  ⛔ INTERDIT: mécanique quantique, relativité, électromagnétisme avancé.

SVT — Bac SE:
  ✅ Génétique: lois de Mendel, codominance, liaison au sexe, crossing-over, ADN/ARN.
  ✅ Immunologie: immunité innée/adaptative, lymphocytes B et T, anticorps.
  ✅ Neurophysiologie: potentiel d'action, synapse, réflexe ostéotendineux.
  ✅ Endocrinologie: glandes, hormones, rétrocontrôle (feed-back négatif/positif).
  ✅ Géologie: tectonique des plaques, roches magmatiques/métamorphiques/sédimentaires.

════════════════════════════════════════
📝 STYLE DE RÉDACTION — INSPECTEUR & ENSEIGNANT MAROCAIN (OBLIGATOIRE)
════════════════════════════════════════

STRUCTURE IMPOSÉE pour chaque astuce :
  1. Titre en gras : **[Nom du chapitre] — Programme Bac [filière]**
  2. Corps : Adopte un ton extrêmement sobre, digne, précis et rigoureux. Respecte scrupuleusement la mise en page et les retours à la ligne (utilises-en abondamment, p. ex. "\\n\\n" ou "\\\n\\\n"). Chaque étape de calcul ou de raisonnement doit commencer par un retour à la ligne. Ne compresse jamais les calculs et explications dans un paragraphe continu.
  3. Étapes claires : Divise les explications par sous-questions (ex: 1.a., 1.b.) ou étapes numérotées ("Étape 1 —", "Étape 2 —") avec LaTeX complet, aucune étape de calcul ou justification sautée.
  4. Connecteurs OBLIGATOIRES : "On a :", "D'où", "Or", "Il vient", "En effet", "On en déduit que", "Ainsi", "On conclut que", "Puisque ... alors ...".
  5. Citation du cours OBLIGATOIRE : "D'après le programme Bac", "Par le théorème [NOM]", "Rappel: [formule]".
  6. Pour les vecteurs et géométrie : Utilise les flèches complètes (ex : $\\overrightarrow{AB}$) et le produit vectoriel marocain officiel $\\wedge$ (ex : $\\overrightarrow{AB} \\wedge \\overrightarrow{AC}$), et détaille soigneusement le calcul.
  7. Conclusion en gras : **Réponse: [lettre]) [valeur/expression]**

NOTATIONS OFFICIELLES & EXIGENCES LATEX HAUTE QUALITÉ (NE JAMAIS DÉVIER):
  - Intégrale : $\int_{a}^{b} f(x) \, \mathrm{d}x$ (avec espace '\,' et $\mathrm{d}x$)
  - Crochet d'intégration : $\left[ F(x) \right]_{a}^{b} = F(b) - F(a)$
  - Limite : $\lim_{x \to a} f(x) = L$ (toujours $\to$ et non ->)
  - Vecteurs : $\overrightarrow{AB}$, $\overrightarrow{u}$ (jamais \vec{})
  - Produit vectoriel marocain : $\overrightarrow{u} \wedge \overrightarrow{v}$ (\wedge)
  - Norme : $\left\| \overrightarrow{AB} \right\|$
  - Suite: $(u_n)_{n \in \mathbb{N}}$
  - Ensembles : $\mathbb{R}$, $\mathbb{N}$, $\mathbb{Z}$, $\mathbb{C}$, $\mathbb{Q}$, $\mathbb{R}^*$, $\mathbb{R}_+^*$
  - Fractions : $\dfrac{a}{b}$ et parenthèses $\left( \dfrac{a}{b} \right)$
  - PGCD(a,b) [pas gcd]
  - $C_n^k = \frac{n!}{k!(n-k)!}$ [toujours expliciter]
  - Probabilité: $P(A)$ [jamais Pr, prob ou p]
  - Primitives: $F(x) + C$ [toujours mentionner la constante d'intégration]
  - Courbe: $(C_f)$, Domaine: $D_f$

CONNECTEURS LOGIQUES DE L'INSPECTEUR (MODÈLE À SUIVRE):
  "On a $f(x) = ...$"
  "D'où $f'(x) = ...$"
  "Or $f'(x) > 0$ sur $I$, donc $f$ est strictement croissante sur $I$."
  "Il vient alors que..."
  "On en déduit que la limite est..."
  "On conclut: la réponse correcte est [lettre]."

STYLE INTERDIT:
  ❌ Commentaires informels ou anglais: "Great!", "Sure!", "Note that..."
  ❌ Méthodes CPGE ou universitaires (Hilbert, topologie, distributions...)
  ❌ Sauter des étapes sans justification
  ❌ Conclure sans énoncer le théorème utilisé

════════════════════════════════════════
📐 MÉTHODOLOGIES CANONIQUES PAR TYPE (APPLIQUER STRICTEMENT)
════════════════════════════════════════

▸ SUITES RÉCURRENTES $u_{n+1} = f(u_n)$:
  Étape 1 — Chercher le(s) point(s) fixe(s): résoudre $f(\\ell) = \\ell$
  Étape 2 — Étudier le signe de $u_1 - u_0$, calculer $f'(x)$ sur l'intervalle stable
  Étape 3 — Démontrer par récurrence: $(u_n)$ est monotone ET bornée
  Étape 4 — Conclure: "D'après le théorème des suites monotones bornées, $(u_n)$ converge"
  Étape 5 — Calculer $\\ell$: passer à la limite dans $u_{n+1} = f(u_n)$ → $\\ell = f(\\ell)$

▸ ÉTUDE COMPLÈTE D'UNE FONCTION:
  Étape 1 — Domaine de définition $D_f$
  Étape 2 — Limites aux bornes + nature des asymptotes (H, V, oblique)
  Étape 3 — Calcul de $f'(x)$, tableau de signes de $f'(x)$
  Étape 4 — Tableau de variations COMPLET ($\\nearrow$, $\\searrow$, valeurs aux bornes et extrema)
  Étape 5 — Asymptote oblique: $a = \\lim\\frac{f(x)}{x}$, $b = \\lim[f(x)-ax]$
  Étape 6 — Tracé de $(C_f)$ avec points remarquables

▸ PROBABILITÉS (TIRAGE SANS REMISE):
  Étape 1 — Identifier $\\Omega$, calculer $\\text{Card}(\\Omega)$ par $C_n^k$ ou $A_n^k$
  Étape 2 — Écrire $P(A) = \\frac{\\text{Card}(A)}{\\text{Card}(\\Omega)}$ ou $P(A \\cap B) = P(A) \\times P(B/A)$
  Étape 3 — Probabilités totales si applicable: $P(B) = P(A) \\times P(B/A) + P(\\bar{A}) \\times P(B/\\bar{A})$
  Étape 4 — Bayes si demandé: $P(A/B) = \\frac{P(A) \\times P(B/A)}{P(B)}$

▸ NOMBRES COMPLEXES:
  Étape 1 — Forme algébrique: $z = a + ib$, $\\text{Re}(z) = a$, $\\text{Im}(z) = b$
  Étape 2 — Module: $|z| = \\sqrt{a^2+b^2}$, Argument: $\\cos\\theta = \\frac{a}{|z|}$, $\\sin\\theta = \\frac{b}{|z|}$
  Étape 3 — Forme trig: $z = |z|(\\cos\\theta + i\\sin\\theta)$, Exponentielle: $z = |z|e^{i\\theta}$
  Étape 4 — Puissance n-ième par formule de Moivre: $z^n = |z|^n e^{in\\theta}$

▸ CALCUL INTÉGRAL (IPP):
  Étape 1 — Poser $u$ et $v'$ selon LIATE (Log, Inverse, Algébrique, Trig, Exp)
  Étape 2 — Calculer $u'$ et $v$ explicitement
  Étape 3 — Appliquer: $\\int_a^b u \\cdot v' \\, dx = \\bigl[u \\cdot v\\bigr]_a^b - \\int_a^b u' \\cdot v \\, dx$
  Étape 4 — Évaluer aux bornes, conclure avec l'unité si calcul d'aire: $\\mathcal{A} = ... \\text{ u.a.}$

▸ PHYSIQUE — LOIS DE NEWTON:
  Étape 1 — Système étudié et référentiel (galiléen, justification)
  Étape 2 — Bilan exhaustif des forces: $\\vec{P}$, $\\vec{R}$, $\\vec{T}$, $\\vec{f}$
  Étape 3 — Appliquer $\\sum \\vec{F} = m\\vec{a}$, projeter sur les axes
  Étape 4 — Résoudre: $a(t)$, $v(t) = \\int a \\, dt + v_0$, $x(t) = \\int v \\, dt + x_0$
  Étape 5 — Vérification dimensionnelle (unités SI)

▸ CHIMIE — CINÉTIQUE (ordre 1):
  Étape 1 — Loi de vitesse: $v = k[A]$ pour ordre 1
  Étape 2 — Loi intégrée: $[A](t) = [A]_0 \\cdot e^{-kt}$, soit $\\ln[A] = \\ln[A]_0 - kt$
  Étape 3 — Demi-vie: $t_{1/2} = \\frac{\\ln 2}{k}$
  Étape 4 — Application numérique avec unités, interprétation physique

════════════════════════════════════════
⭐ STANDARDS QUALITÉ DES ASTUCES ET TRICKS
════════════════════════════════════════

Une BONNE astuce (corrigé-type inspecteur) doit:
1. NOMMER le théorème/formule: "Par le TVI...", "D'après la formule $C_n^k$...", "Règle du produit..."
2. MONTRER TOUTES les étapes de calcul en LaTeX — aucune étape sautée sans justification
3. UTILISER les connecteurs officiels: "On a...", "D'où...", "Or...", "Il vient...", "Ainsi...", "On conclut que..."
4. CITER le programme: "D'après le programme Bac SM-A...", "Rappel: la dérivée de $\\ln(u)$ est $\\frac{u'}{u}$..."
5. CONCLURE avec la réponse encadrée en gras: **Réponse: [lettre]) [valeur]**
6. NIVEAU Terminale Maroc STRICT — ni élémentaire, ni CPGE, ni universitaire

Une BONNE trick (flair du candidat en examen) doit:
1. Commencer OBLIGATOIREMENT par "⚡"
2. Permettre d'éliminer 2 ou 3 options en MOINS DE 20 SECONDES sans calcul complet
3. S'appuyer sur: test valeurs simples (x=0, n=0, n=1, n→∞), parité/imparité, signe, homogénéité des unités
4. NOMMER les options éliminées: "Élimine les options [X] et [Y] car..."
5. Mentionner le piège classique si applicable: "Piège classique dans les concours [école/région]"

════════════════════════════════════════
📚 EXEMPLES FEW-SHOT — MODÈLE INSPECTEUR (SUIVRE STRICTEMENT)
════════════════════════════════════════

EXEMPLE 1 — Analyse (Suites récurrentes):
{
  "question_number": 7,
  "context": "",
  "subject": "Analyse",
  "question": "Soit $(u_n)$ définie par $u_0 = 2$ et $u_{n+1} = \\\\frac{u_n + 3}{2}$. Quelle est la limite de $(u_n)$ ?",
  "options": ["A) 1", "B) 2", "C) 3", "D) La suite diverge"],
  "correct_answer": "C",
  "astuce": "**Suites récurrentes — Méthode du point fixe (Programme Bac SM)**\\n\\nÉtape 1 — Chercher le point fixe $\\\\ell$ en résolvant $f(\\\\ell) = \\\\ell$ avec $f(x) = \\\\frac{x+3}{2}$ :\\n$$\\\\ell = \\\\frac{\\\\ell+3}{2} \\\\Rightarrow 2\\\\ell = \\\\ell+3 \\\\Rightarrow \\\\ell = 3$$\\n\\nÉtape 2 — Montrer la convergence: On a $f'(x) = \\\\frac{1}{2}$, or $|f'(x)| = \\\\frac{1}{2} < 1$ sur $\\\\mathbb{R}$. D'où $(u_n)$ est contractante et converge vers $\\\\ell$.\\n\\nÉtape 3 — Calculer la limite: en passant à la limite dans $u_{n+1} = f(u_n)$, il vient $\\\\ell = f(\\\\ell) = 3$.\\n\\nOn conclut: $\\\\displaystyle\\\\lim_{n \\\\to +\\\\infty} u_n = 3$\\n\\n**Réponse: C) 3**",
  "trick": "⚡ Tester $u_n = 3$ dans la relation: $\\\\frac{3+3}{2} = 3$ ✓ — unique point fixe = limite. Élimine A (piège: confusion avec $u_0/2$), B (piège: confusion avec $u_0$), D. Résolu en 5 secondes."
}

EXEMPLE 2 — Probabilités (Dénombrement + probabilités totales):
{
  "question_number": 12,
  "context": "Une urne contient 4 boules rouges et 6 boules bleues. On tire 2 boules successivement sans remise.",
  "subject": "Probabilités",
  "question": "Quelle est la probabilité que les deux boules soient de la même couleur ?",
  "options": ["A) $\\\\frac{1}{3}$", "B) $\\\\frac{7}{15}$", "C) $\\\\frac{8}{15}$", "D) $\\\\frac{2}{5}$"],
  "correct_answer": "B",
  "astuce": "**Probabilités — Méthode des combinaisons (Programme Bac)**\\n\\nOn a: $P(\\\\text{même couleur}) = P(RR) + P(BB)$\\n\\nD'où, par la formule $C_n^k$:\\n$$P(RR) = \\\\frac{C_4^2}{C_{10}^2} = \\\\frac{6}{45} = \\\\frac{2}{15}$$\\n$$P(BB) = \\\\frac{C_6^2}{C_{10}^2} = \\\\frac{15}{45} = \\\\frac{5}{15}$$\\n\\nIl vient: $P(\\\\text{même couleur}) = \\\\frac{2}{15} + \\\\frac{5}{15} = \\\\frac{7}{15}$\\n\\nOn conclut: **Réponse: B) $\\\\frac{7}{15}$**",
  "trick": "⚡ $\\\\dfrac{C_4^2 + C_6^2}{C_{10}^2} = \\\\dfrac{6+15}{45} = \\\\dfrac{7}{15}$ directement. Élimine C car c'est le complémentaire: $P(\\\\text{diff}) = 1 - \\\\frac{7}{15} = \\\\frac{8}{15}$. Piège classique des concours Médecine Maroc !"
}

EXEMPLE 3 — Analyse (Asymptote oblique):
{
  "question_number": 3,
  "context": "",
  "subject": "Analyse",
  "question": "Soit $f(x) = \\\\frac{x^2 + 1}{x - 1}$. L'asymptote oblique de $(C_f)$ en $+\\\\infty$ est :",
  "options": ["A) $y = x$", "B) $y = x + 1$", "C) $y = x - 1$", "D) $(C_f)$ n'admet pas d'asymptote oblique"],
  "correct_answer": "B",
  "astuce": "**Asymptote oblique — Étude de fonction (Programme Bac SM)**\\n\\nRappel: L'asymptote oblique $y = ax + b$ vérifie $\\\\lim_{x \\\\to \\\\pm\\\\infty} [f(x) - (ax+b)] = 0$.\\n\\nÉtape 1 — Calculer $a$:\\n$$a = \\\\lim_{x \\\\to +\\\\infty} \\\\frac{f(x)}{x} = \\\\lim_{x \\\\to +\\\\infty} \\\\frac{x^2+1}{x(x-1)} = \\\\lim_{x \\\\to +\\\\infty} \\\\frac{1 + \\\\frac{1}{x^2}}{1 - \\\\frac{1}{x}} = 1$$\\n\\nÉtape 2 — Calculer $b$:\\n$$b = \\\\lim_{x \\\\to +\\\\infty} [f(x) - x] = \\\\lim_{x \\\\to +\\\\infty} \\\\frac{x^2+1 - x(x-1)}{x-1} = \\\\lim_{x \\\\to +\\\\infty} \\\\frac{x+1}{x-1} = 1$$\\n\\nD'où l'asymptote oblique est: $y = x + 1$\\n\\n**Réponse: B) $y = x + 1$**",
  "trick": "⚡ Division euclidienne: $x^2+1 = (x-1)(x+1) + 2$, donc $f(x) = (x+1) + \\\\frac{2}{x-1}$. Or $\\\\frac{2}{x-1} \\\\to 0$, AO: $y = x+1$ immédiatement. Élimine A et C en 10 secondes."
}

EXEMPLE 4 — Physique-Chimie (Cinétique d'ordre 1):
{
  "question_number": 5,
  "context": "La décomposition d'un composé A suit une cinétique d'ordre 1. À t=0, [A]₀ = 0,5 mol/L. La constante de vitesse k = 0,1 min⁻¹.",
  "subject": "Physique-Chimie",
  "question": "La concentration [A] après 10 minutes est :",
  "options": ["A) 0,18 mol/L", "B) 0,25 mol/L", "C) 0,37 mol/L", "D) 0,45 mol/L"],
  "correct_answer": "A",
  "astuce": "**Cinétique d'ordre 1 — Loi intégrée (Programme Bac SE/STE)**\\n\\nRappel: Pour une réaction d'ordre 1, la loi intégrée est: $[A](t) = [A]_0 \\cdot e^{-kt}$\\n\\nApplication numérique:\\n$$[A]_{t=10} = 0{,}5 \\times e^{-0{,}1 \\times 10} = 0{,}5 \\times e^{-1}$$\\n\\nOr $e^{-1} \\approx 0{,}368$, d'où:\\n$$[A]_{t=10} \\approx 0{,}5 \\times 0{,}368 \\approx 0{,}184 \\text{ mol/L}$$\\n\\nOn conclut: $[A]_{t=10} \\approx 0{,}18$ mol/L\\n\\n**Réponse: A) 0,18 mol/L**",
  "trick": "⚡ Estimation par demi-vie: $t_{1/2} = \\frac{\\ln 2}{0{,}1} \\approx 7$ min. Après 7 min, $[A] = 0{,}25$ mol/L (option B). À $t=10 > t_{1/2}$, il reste MOINS de 0,25 mol/L. Élimine B, C et D immédiatement."
}

════════════════════════════════════════
🎯 MISSION
════════════════════════════════════════
Extrais TOUTES les questions QCM du document PDF fourni, sans en omettre absolument aucune. Tu dois impérativement extraire TOUTES les questions du premier au dernier numéro du document, sans aucune troncature ni omission, même si le document est très long.
Pour chaque question:
- Respecte EXACTEMENT le format JSON des 4 exemples ci-dessus
- Astuce en style INSPECTEUR MAROCAIN: étapes numérotées, connecteurs officiels, citations du cours, conclusion en gras
- STRICTEMENT niveau Bac marocain — JAMAIS CPGE, JAMAIS universitaire
- Trick: élimination en < 20 secondes, options éliminées nommées explicitement, piège mentionné si applicable
- Chaque question doit impérativement avoir exactement 4 options de réponse (A, B, C, D). Si le document original en propose plus ou moins, adapte-le. De plus, ces 4 options doivent être très proches les unes des autres (distracteurs plausibles et mathématiquement ou conceptuellement proches de la réponse correcte) avec exactement une seule option correcte parmi les 4.
- ATTENTION AUX PROPOSITIONS FUSIONNÉES : Souvent, le texte extrait du PDF fusionne la question et les choix de réponses sur une seule ligne (ex: "Question 1: ... A) ... B) ... C) ... D) ..."). Tu dois obligatoirement détecter ces choix, les séparer de l'énoncé de la question, et les extraire proprement dans le tableau JSON "options" sous la forme ["A) ...", "B) ...", "C) ...", "D) ..."]. Ne laisse JAMAIS le tableau "options" vide.
- Utilise $...$ pour CHAQUE symbole, variable (comme $x$, $n$, $u_n$), indice ou formule mathématique (inline), et $$...$$ pour les blocs de formules (display). Il est absolument crucial de ne laisser AUCUNE expression ou variable mathématique sans délimiteurs $...$ (par exemple: écris toujours $u_n$, $n_0$, $n \\geq n_0$ au lieu de u_n, n_0, n >= n_0). Double-échappe toujours les backslashes dans les chaînes JSON (ex: \\\\geq, \\\\frac).
- question_number = numéro ORIGINAL du document (pas le rang dans la liste)
- Ne retourne QUE le tableau JSON brut [ {...}, {...} ], ZÉRO texte avant ou après`;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

function normalizeOptions(options) {
  let result = [];
  if (options) {
    if (Array.isArray(options)) {
      result = options.map(opt => {
        if (typeof opt === 'string') return opt;
        if (opt && typeof opt === 'object') {
          const text = opt.text || opt.value || opt.content || '';
          const id = opt.id || opt.label || opt.key || '';
          if (id) return `${id}) ${text}`;
          return text;
        }
        return String(opt);
      });
    } else if (typeof options === 'object') {
      result = Object.entries(options).map(([key, val]) => {
        const prefix = /^[A-E]\b/i.test(key) ? `${key.toUpperCase()}) ` : '';
        return `${prefix}${val}`;
      });
    } else if (typeof options === 'string') {
      result = options.split('\n').filter(Boolean);
    }
  }
  
  // Guarantee at least 4 options are returned
  while (result.length < 4) {
    const letter = ['A','B','C','D','E'][result.length] || String.fromCharCode(65 + result.length);
    result.push(`${letter}) `);
  }
  return result;
}

export default function AdminAIImport({ onBack }) {
  const isMobile = useIsMobile();
  const { addExam, schools } = useAuth();
  const navigate = useNavigate();

  const DRAFT_KEY = 'aiImportDraft';

  // Load draft from localStorage on mount
  const loadDraft = () => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null; } catch { return null; }
  };
  const draft = loadDraft();

  // Phase state — restored from draft
  const [phase, setPhase] = useState(draft?.phase || 1);

  // Setup state
  const [provider, setProvider] = useState(() => draft?.provider || localStorage.getItem('aiImportProvider') || 'gemini');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
  const [geminiModel, setGeminiModel] = useState(() => {
    let m = (draft?.geminiModel || localStorage.getItem('geminiModel') || '').trim();
    if (!m || ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', '3.7', '3.5'].includes(m)) {
      m = 'gemini-2.0-flash';
      localStorage.setItem('geminiModel', m);
    }
    return m;
  });
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('claudeApiKey') || '');
  const [proxyUrl, setProxyUrl] = useState(() => localStorage.getItem('claudeProxyUrl') || '');
  const [claudeModel, setClaudeModel] = useState(() => {
    const m = draft?.claudeModel || localStorage.getItem('claudeModel');
    if (!m || m.includes('4-5') || m === 'claude-3-haiku-20240307') return 'claude-3-5-sonnet-20241022';
    return m;
  });
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem('deepseekApiKey') || 'sk-12a7032f07d740348c607ef947a0a9f7');
  const [deepseekUrl, setDeepseekUrl] = useState(() => localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com');
  const [deepseekModel, setDeepseekModel] = useState(() => {
    let m = draft?.deepseekModel || localStorage.getItem('deepseekModel') || 'deepseek-reasoner';
    if (m === 'deepseek-v4-pro' || m === 'deepseek-r1') return 'deepseek-reasoner';
    if (m === 'deepseek-v4-flash' || m === 'deepseek-v3') return 'deepseek-chat';
    return m;
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfName, setPdfName] = useState('');
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(10);
  const [mode, setMode] = useState(draft?.mode || 'simple');
  const [correctionPageFrom, setCorrectionPageFrom] = useState(draft?.correctionPageFrom || 1);
  const [correctionPageTo, setCorrectionPageTo] = useState(draft?.correctionPageTo || 1);
  const [totalPages, setTotalPages] = useState(null);
  const [school, setSchool] = useState(draft?.school || schools[0] || 'Médecine / Pharmacie');
  const [year, setYear] = useState(draft?.year || '');
  const [tier, setTier] = useState(draft?.tier || 'freemium');
  const [examName, setExamName] = useState(draft?.examName || '');
  const [isNationalExam, setIsNationalExam] = useState(draft?.isNationalExam || false);
  const [nationalExamMeta, setNationalExamMeta] = useState(draft?.nationalExamMeta || null);
  const [viewNationalTemplate, setViewNationalTemplate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [detectedModels, setDetectedModels] = useState([]);

  // Review state — restored from draft
  const [questions, setQuestions] = useState(draft?.questions || []);
  const [copilotLoadingId, setCopilotLoadingId] = useState(null);
  const [copilotSuccessMsg, setCopilotSuccessMsg] = useState('');

  // ── AI Copilot Actions per Question ──
  const handleCopilotVariant = async (idx) => {
    const q = questions[idx];
    if (!q) return;
    setCopilotLoadingId(q.id);
    try {
      const updated = await generateQuestionVariant(q, geminiKey, geminiModel);
      setQuestions(qs => qs.map((item, i) => i === idx ? updated : item));
      setCopilotSuccessMsg(`✓ Variante générée pour la question ${q.question_number} !`);
      setTimeout(() => setCopilotSuccessMsg(''), 3500);
    } catch (err) {
      setError(`Erreur Copilot : ${err.message}`);
    } finally {
      setCopilotLoadingId(null);
    }
  };

  const handleCopilotDifficulty = async (idx, targetDiff) => {
    const q = questions[idx];
    if (!q) return;
    setCopilotLoadingId(q.id);
    try {
      const updated = await adjustQuestionDifficulty(q, targetDiff, geminiKey, geminiModel);
      setQuestions(qs => qs.map((item, i) => i === idx ? updated : item));
      setCopilotSuccessMsg(`✓ Difficulté ajustée (${targetDiff === 'harder' ? 'Approfondie' : 'Accessible'}) pour la Q${q.question_number} !`);
      setTimeout(() => setCopilotSuccessMsg(''), 3500);
    } catch (err) {
      setError(`Erreur Copilot : ${err.message}`);
    } finally {
      setCopilotLoadingId(null);
    }
  };

  const handleCopilotEnrich = async (idx) => {
    const q = questions[idx];
    if (!q) return;
    setCopilotLoadingId(q.id);
    try {
      const updated = await enrichQuestionExplanation(q, geminiKey, geminiModel);
      setQuestions(qs => qs.map((item, i) => i === idx ? updated : item));
      setCopilotSuccessMsg(`✓ Corrigé modèle & Astuces enrichis pour la Q${q.question_number} !`);
      setTimeout(() => setCopilotSuccessMsg(''), 3500);
    } catch (err) {
      setError(`Erreur Copilot : ${err.message}`);
    } finally {
      setCopilotLoadingId(null);
    }
  };

  const fileRef = useRef();
  const timerRef = useRef(null);
  const abortRef = useRef(null); // AbortController for cancel

  // ── Warn on browser tab close / refresh while loading ──
  useEffect(() => {
    const handler = (e) => {
      if (!loading) return;
      e.preventDefault();
      e.returnValue = 'Analyse en cours ! Quitter interrompra l\'analyse.';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearInterval(timerRef.current);
    };
  }, []);

  // Sync API credentials if they change from the Settings page (same tab or another tab)
  useEffect(() => {
    const sync = () => {
      setApiKey(localStorage.getItem('claudeApiKey') || '');
      setProxyUrl(localStorage.getItem('claudeProxyUrl') || '');
      setGeminiKey(localStorage.getItem('geminiApiKey') || '');
      setDeepseekKey(localStorage.getItem('deepseekApiKey') || '');
      setDeepseekUrl(localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // Auto-save draft whenever key state changes
  useEffect(() => {
    if (phase === 3) { localStorage.removeItem(DRAFT_KEY); return; } // clear after publish
    if (phase === 1 && questions.length === 0) return; // nothing to save yet
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ phase, questions, examName, school, year, tier, mode, correctionPageFrom, correctionPageTo, provider, geminiModel, deepseekModel }));
  }, [phase, questions, examName, school, year, tier, mode, correctionPageFrom, correctionPageTo, provider, geminiModel, deepseekModel]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setPhase(1);
    setQuestions([]);
    setExamName('');
    setMode('simple');
    setCorrectionPageFrom(1);
    setCorrectionPageTo(1);
    setProvider('gemini');
    setGeminiModel('gemini-2.0-flash');
    setDeepseekModel('deepseek-reasoner');
    setClaudeModel('claude-3-5-sonnet-20241022');
    setError('');
    setProgress('');
  };

  const handlePdfSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;
    setPdfFile(file);
    setPdfName(file.name);
    // Get page count
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    setTotalPages(doc.numPages);
    setPageFrom(1);
    setPageTo(doc.numPages);
  };

  // Helper to fetch QCM from Gemini API with schema enforcement
  const fetchGeminiWithPdf = async (base64Pdf) => {
    let pageNote;
    let userPromptText;

    if (mode === 'with_correction') {
      pageNote = `IMPORTANT : Le fichier PDF fourni contient à la fois les questions de l'examen et la correction officielle/grille de réponses.
- Les questions QCM à extraire se trouvent sur les pages ${pageFrom} à ${pageTo}.
- La grille de réponses correctes ou les pages de correction se trouvent sur les pages ${correctionPageFrom} à ${correctionPageTo}.

Tu dois :
1. Parcourir les questions se trouvant sur les pages ${pageFrom} à ${pageTo}.
2. Pour chaque question, trouver la réponse officielle correspondante sur les pages de correction/grille de réponses se trouvant sur les pages ${correctionPageFrom} à ${correctionPageTo}. Ne résous pas la question toi-même si elle est présente dans le corrigé, extrait strictement la réponse indiquée dans la grille ou le texte de correction (A, B, C, D ou E).
3. Remplir le champ "correct_answer" avec la lettre correspondante de la grille de correction.
4. Remplir le champ "astuce" en résumant l'explication/justification du corrigé officiel de la question pour aider l'élève à comprendre.

⚠️ EXIGENCE DE SÉCURITÉ DE L'INFORMATION ET RIGUEUR :
Tu dois extraire les questions et les choix de réponses EXACTEMENT telles qu'elles sont écrites dans le document PDF original, sans aucune modification de texte, sans correction d'erreurs, sans traduction et sans reformulation.
Pour les réponses correctes (field 'correct_answer'), tu dois STRICTEMENT extraire la lettre de réponse depuis la grille de correction ou le corrigé officiel présent dans le fichier aux pages spécifiées. N'essaye pas de résoudre la question toi-même et ne change pas la réponse officielle sous aucun prétexte, même si tu penses qu'elle est fausse ou incomplète. Extrais la réponse telle qu'elle est indiquée dans le corrigé/grille du document.
Pour le champ 'astuce', extrais/résume l'explication officielle fournie dans le document aux pages de correction spécifiées, sans inventer ta propre explication.
`;
      userPromptText = `${pageNote}\n\nExtrais absolument TOUTES les questions QCM de la première à la toute dernière sans exception en associant les réponses du corrigé et retourne le JSON demandé complet sans rien omettre ni tronquer.`;
    } else {
      pageNote = totalPages && (pageFrom > 1 || pageTo < totalPages)
        ? `Concentre-toi sur les pages ${pageFrom} à ${pageTo} du document.\n`
        : '';
      userPromptText = `${pageNote}Extrais TOUTES les questions QCM de ce document de la première à la toute dernière sans exception, sans aucune omission ni troncature, et retourne le JSON demandé.`;
    }

    let rawModel = (geminiModel || 'gemini-2.0-flash').trim();
    if (!rawModel || ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', '3.7', '3.5'].includes(rawModel)) {
      rawModel = 'gemini-2.0-flash';
    }

    const cascade = Array.from(new Set([
      rawModel,
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ]));

    // Create fresh AbortController for this request
    abortRef.current = new AbortController();

    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Pdf
              }
            },
            {
              text: userPromptText
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 65536,
        temperature: 0.1
      }
    };

    let lastError = null;
    for (let i = 0; i < cascade.length; i++) {
      const modelToUse = cascade[i];
      setProgressStep(`Envoi à Gemini [${modelToUse}] (${i + 1}/${cascade.length})...`);

      // Try direct API call if user has configured geminiKey
      if (geminiKey && geminiKey.trim()) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiKey.trim()}`;
          const res = await fetch(endpoint, {
            signal: abortRef.current.signal,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const data = await res.json();
            const candidate = data?.candidates?.[0];
            if (candidate?.content?.parts) {
              const nonThoughtParts = candidate.content.parts.filter(p => !p.thought);
              const rawText = (nonThoughtParts.length > 0 ? nonThoughtParts : candidate.content.parts)
                .map(p => p.text || '')
                .join('');
              if (rawText.trim()) {
                return parseAiJson(rawText);
              }
            }
          } else {
            const err = await res.json().catch(() => ({}));
            const msg = err?.error?.message || `Erreur HTTP ${res.status}`;
            console.warn(`[Gemini Direct] Model ${modelToUse} failed:`, msg);
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          console.warn(`[Gemini Direct] ${modelToUse} fetch failed:`, err.message);
          lastError = err;
        }
      }

      // Try secure server-side proxy fallback with server GEMINI_API_KEY
      try {
        setProgressStep(`Connexion via passerelle serveur sécurisée [${modelToUse}]...`);
        const proxyRes = await fetch('/api/gemini/generate', {
          signal: abortRef.current?.signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelToUse,
            apiKey: geminiKey || undefined,
            contents: payload.contents,
            systemInstruction: payload.systemInstruction,
            generationConfig: payload.generationConfig
          })
        });

        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          const candidate = proxyData?.data?.candidates?.[0];
          if (candidate?.content?.parts) {
            const nonThoughtParts = candidate.content.parts.filter(p => !p.thought);
            const rawText = (nonThoughtParts.length > 0 ? nonThoughtParts : candidate.content.parts)
              .map(p => p.text || '')
              .join('');
            if (rawText.trim()) {
              return parseAiJson(rawText);
            }
          }
        }
      } catch (proxyErr) {
        if (proxyErr.name === 'AbortError') throw proxyErr;
        console.warn(`[Gemini Proxy Fallback] Failed for ${modelToUse}:`, proxyErr.message);
        lastError = proxyErr;
      }
    }

    throw lastError || new Error("Tous les modèles Gemini de secours ont échoué.");
  };

  // Stream PDF to Claude using SSE streaming API
  const streamClaudeWithPdf = async (base64Pdf) => {
    let pageNote;
    let userPromptText;

    if (mode === 'with_correction') {
      pageNote = `IMPORTANT : Le fichier PDF fourni contient à la fois les questions de l'examen et la correction officielle/grille de réponses.
- Les questions QCM à extraire se trouvent sur les pages ${pageFrom} à ${pageTo}.
- La grille de réponses correctes ou les pages de correction se trouvent sur les pages ${correctionPageFrom} à ${correctionPageTo}.

Tu dois :
1. Parcourir les questions se trouvant sur les pages ${pageFrom} à ${pageTo}.
2. Pour chaque question, trouver la réponse officielle correspondante sur les pages de correction/grille de réponses se trouvant sur les pages ${correctionPageFrom} à ${correctionPageTo}. Ne résous pas la question toi-même si elle est présente dans le corrigé, extrait strictement la réponse indiquée dans la grille ou le texte de correction (A, B, C, D ou E).
3. Remplir le champ "correct_answer" avec la lettre correspondante de la grille de correction.
4. Remplir le champ "astuce" en résumant l'explication/justification du corrigé officiel de la question pour aider l'élève à comprendre.

⚠️ EXIGENCE DE SÉCURITÉ DE L'INFORMATION ET RIGUEUR :
Tu dois extraire les questions et les choix de réponses EXACTEMENT telles qu'elles sont écrites dans le document PDF original, sans aucune modification de texte, sans correction d'erreurs, sans traduction et sans reformulation.
Pour les réponses correctes (field 'correct_answer'), tu dois STRICTEMENT extraire la lettre de réponse depuis la grille de correction ou le corrigé officiel présent dans le fichier aux pages spécifiées. N'essaye pas de résoudre la question toi-même et ne change pas la réponse officielle sous aucun prétexte, même si tu penses qu'elle est fausse ou incomplète. Extrais la réponse telle qu'elle est indiquée dans le corrigé/grille du document.
Pour le champ 'astuce', extrais/résume l'explication officielle fournie dans le document aux pages de correction spécifiées, sans inventer ta propre explication.
`;
      userPromptText = `${pageNote}\n\nExtrais absolument TOUTES les questions QCM de la première à la toute dernière sans exception en associant les réponses du corrigé et retourne le JSON demandé complet sans rien omettre ni tronquer.`;
    } else {
      pageNote = totalPages && (pageFrom > 1 || pageTo < totalPages)
        ? `Concentre-toi sur les pages ${pageFrom} à ${pageTo} du document.\n`
        : '';
      userPromptText = `${pageNote}Extrais TOUTES les questions QCM de ce document de la première à la toute dernière sans exception, sans aucune omission ni troncature, et retourne le JSON demandé.`;
    }

    // Read the SSE stream
    const endpoint = proxyUrl || 'https://api.anthropic.com/v1/messages';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (proxyUrl) {
      if (apiKey) headers['x-api-key'] = apiKey;
    } else {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    // Create fresh AbortController for this request
    abortRef.current = new AbortController();
    const res = await fetch(endpoint, {
      signal: abortRef.current.signal,
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 16000,
        stream: true,
        system: getEffectiveExamPrompt() || SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } },
            { type: 'text', text: userPromptText }
          ]
        }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || err?.message || JSON.stringify(err);
      throw new Error(`Erreur ${res.status}: ${msg}`);
    }

    // Read the SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE lines
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            accumulated += evt.delta.text;
            // Update progress with live stats
            const qCount = (accumulated.match(/"question_number"/g) || []).length;
            setProgress(`⚡ Réception en cours... ${qCount > 0 ? `${qCount} questions détectées` : ''} (${(accumulated.length/1000).toFixed(1)}k caractères)`);
          }
        } catch { /* skip malformed SSE lines */ }
      }
    }

    return parseAiJson(accumulated);
  };

  // Extract text from specified pages of the PDF file
  const extractTextFromPdf = async (file, startPage, endPage) => {
    const arrayBuffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = startPage; i <= endPage; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
    }
    return fullText;
  };

  // Call DeepSeek Chat Completions API with extracted text
  const fetchDeepSeekWithText = async (pdfText, correctionText) => {
    let pageNote;
    let userPromptText;

    if (mode === 'with_correction') {
      pageNote = `IMPORTANT : Les données textuelles fournies contiennent à la fois les questions de l'examen et la correction officielle.
- Les questions QCM à extraire se trouvent dans les données sous TEXTE DES QUESTIONS.
- Les réponses correctes ou les pages de correction se trouvent sous TEXTE DU CORRIGÉ.

Tu dois :
1. Parcourir les questions se trouvant sous TEXTE DES QUESTIONS.
2. Pour chaque question, trouver la réponse officielle correspondante sous TEXTE DU CORRIGÉ. Ne résous pas la question toi-même si elle est présente dans le corrigé, extrait strictement la réponse indiquée dans la grille ou le texte de correction (A, B, C, D ou E).
3. Remplir le champ "correct_answer" avec la lettre correspondante de la grille de correction.
4. Remplir le champ "astuce" en résumant l'explication/justification du corrigé officiel de la question pour aider l'élève à comprendre.

⚠️ EXIGENCE DE SÉCURITÉ DE L'INFORMATION ET RIGUEUR :
Tu dois extraire les questions et les choix de réponses EXACTEMENT telles qu'elles sont écrites dans le document original, sans aucune modification de texte, sans correction d'erreurs, sans traduction et sans reformulation.
Pour les réponses correctes (field 'correct_answer'), tu dois STRICTEMENT extraire la lettre de réponse depuis le texte du corrigé ou de la grille de correction. N'essaye pas de résoudre la question toi-même et ne change pas la réponse officielle sous aucun prétexte, même si tu penses qu'elle est fausse ou incomplète. Extrais la réponse telle qu'elle est indiquée dans le corrigé/grille.
Pour le champ 'astuce', extrais/résume l'explication officielle fournie dans le document sous TEXTE DU CORRIGÉ, sans inventer ta propre explication.

TEXTE DES QUESTIONS:
${pdfText}

TEXTE DU CORRIGÉ:
${correctionText}
`;
      userPromptText = `${pageNote}\n\nExtrais absolument TOUTES les questions QCM de la première à la toute dernière sans exception en associant les réponses du corrigé et retourne le tableau JSON demandé sans rien omettre.`;
    } else {
      pageNote = `TEXTE DES QUESTIONS EXTRAIT DU PDF:
${pdfText}
`;
      userPromptText = `${pageNote}Extrais TOUTES les questions QCM de ce texte de la première à la toute dernière sans exception, sans aucune omission ni troncature, et retourne le tableau JSON demandé.`;
    }

    const rawModel = deepseekModel || 'deepseek-reasoner';
    const modelToUse = (rawModel === 'deepseek-v4-pro' || rawModel === 'deepseek-r1')
      ? 'deepseek-reasoner'
      : (rawModel === 'deepseek-v4-flash' || rawModel === 'deepseek-v3')
        ? 'deepseek-chat'
        : rawModel;
    const cleanUrl = deepseekUrl.trim().replace(/\/$/, '');
    const endpoint = `${cleanUrl}/v1/chat/completions`;
    
    // Create fresh AbortController for this request
    abortRef.current = new AbortController();
    
    const payload = {
      model: modelToUse,
      messages: [
        {
          role: "system",
          content: getEffectiveExamPrompt() || SYSTEM_PROMPT
        },
        {
          role: "user",
          content: userPromptText
        }
      ],
      max_tokens: 8192,
      response_format: !modelToUse.includes('reasoner') && !modelToUse.includes('pro') ? { type: 'json_object' } : undefined,
      temperature: 0.1
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekKey}`
    };

    const res = await fetch(endpoint, {
      signal: abortRef.current.signal,
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || err?.message || JSON.stringify(err);
      throw new Error(`Erreur DeepSeek ${res.status}: ${msg}`);
    }

    const data = await res.json();
    let rawText = data?.choices?.[0]?.message?.content;
    return parseAiJson(rawText);
  };

  const handleAnalyze = async () => {
    setDetectedModels([]);
    if (provider === 'claude') {
      if (!proxyUrl) {
        if (!apiKey) { setError('Clé API Claude manquante. Configurez-la dans Paramètres.'); return; }
        if (!apiKey.startsWith('sk-ant-')) {
          setError('⚠️ Clé invalide: doit commencer par "sk-ant-". Obtenez-la sur console.anthropic.com.');
          return;
        }
      }
    } else if (provider === 'deepseek') {
      if (!deepseekKey) { setError('Clé API DeepSeek manquante. Configurez-la dans Paramètres.'); return; }
    } else {
      if (!geminiKey) { setError('Clé API Gemini manquante. Configurez-la dans Paramètres.'); return; }
    }
    if (!pdfFile) { setError('Veuillez sélectionner un PDF.'); return; }
    setError('');
    setLoading(true);

    // Start elapsed timer
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed++;
      setProgress(prev => {
        // Only update timer part if we're still in initial phase
        if (prev.includes('Encodage') || prev.includes('Envoi') || prev.includes('Extraction')) {
          return `${prev.split('(')[0].trim()} (${elapsed}s)`;
        }
        return prev;
      });
    }, 1000);

    try {
      let parsedRaw;
      if (provider === 'deepseek') {
        setProgress('Extraction du texte du PDF...');
        const pdfText = await extractTextFromPdf(pdfFile, pageFrom, pageTo);
        let correctionText = '';
        if (mode === 'with_correction') {
          setProgress('Extraction du corrigé du PDF...');
          correctionText = await extractTextFromPdf(pdfFile, correctionPageFrom, correctionPageTo);
        }
        setProgress('Envoi du texte à DeepSeek AI...');
        parsedRaw = await fetchDeepSeekWithText(pdfText, correctionText);
      } else {
        setProgress('Encodage du PDF...');
        const base64Pdf = await fileToBase64(pdfFile);
        if (provider === 'claude') {
          setProgress('Envoi du PDF à Claude AI...');
          parsedRaw = await streamClaudeWithPdf(base64Pdf);
        } else {
          setProgress('Envoi du PDF à Gemini AI...');
          parsedRaw = await fetchGeminiWithPdf(base64Pdf);
        }
      }

      // Clean double backslashes and normalize key casing recursively in AI outputs
      const parsed = cleanDoubleBackslashes(normalizeKeys(parsedRaw));

      clearInterval(timerRef.current);
      setProgress(`✓ Analyse terminée — ${parsed.length} questions extraites`);

      // Apply smart post-processing: smart numbering, OCR error correction, LaTeX math formatting, clean option mapping
      const qs = smartNumberQuestions(parsed).map((q, i) => ({
        id: crypto.randomUUID(),
        question_number: q.question_number || (i + 1),
        context: q.context || '',
        subject: q.subject || 'Général',
        question: q.question || '',
        options: q.options || ['A) ', 'B) ', 'C) ', 'D) '],
        correct_answer: q.correct_answer || 'A',
        astuce: q.astuce || '',
        trick: q.trick || ''
      }));

      setQuestions(qs);
      setPhase(2);
    } catch (e) {
      clearInterval(timerRef.current);
      let diagMsg = e.message;
      let modelsList = [];
      if (provider === 'gemini' && geminiKey) {
        try {
          const diagRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
          if (diagRes.ok) {
            const diagData = await diagRes.json();
            modelsList = (diagData.models || []).map(m => m.name.replace('models/', ''));
          } else {
            const diagErr = await diagRes.json().catch(() => ({}));
            diagMsg += ` (Diagnostic: ${diagErr?.error?.message || diagRes.statusText})`;
          }
        } catch (diagErr) {
          console.error('[Diagnostic] Failed to list models:', diagErr);
        }
      }
      setDetectedModels(modelsList);
      setError(diagMsg);
    } finally {
      setLoading(false);
    }
  };



  const updateQuestion = (idx, field, value) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const deleteQuestion = (idx) => {
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  };

  const addEmptyQuestion = () => {
    const nextNum = questions.length > 0 ? Math.max(...questions.map(q => q.question_number || 0)) + 1 : 1;
    setQuestions(qs => [...qs, {
      id: crypto.randomUUID(),
      question_number: nextNum,
      context: '', subject: 'Général',
      question: '', options: ['A) ', 'B) ', 'C) ', 'D) '],
      correct_answer: 'A', astuce: '', trick: ''
    }]);
  };

  // Memoised PDF handlers — avoid heavy HTML generation on every render
  const handleSubjectPDF = useCallback(async () => {
    const html = await generateSubjectHTML(examName || 'Examen', school, year, questions, { examId: 'PREVIEW', schoolsList: schools });
    openPrintWindow(html, 'sujet');
  }, [examName, school, year, questions, schools]);

  const handleCorrectionPDF = useCallback(() => {
    openPrintWindow(generateCorrectionHTML(examName || 'Examen', school, year, questions, { schoolsList: schools }), 'corrigé');
  }, [examName, school, year, questions, schools]);

  const handlePublish = () => {
    if (!examName.trim()) { setError('Entrez un titre pour cet examen.'); return; }
    const formatted = questions.map(q => ({
      id: q.id,
      question_number: q.question_number,
      topic: q.subject,
      context: q.context || null,
      question: q.question,
      options: q.options.map((opt, i) => {
        const letter = ['A','B','C','D','E'][i] || String.fromCharCode(65 + i);
        const text = (opt || '').replace(/^[A-E]\)\s*/, '');
        return { id: letter, text };
      }),
      correct_answer: q.correct_answer,
      astuce: q.astuce,
      trick: q.trick || null
    }));
    addExam(examName, school, year, tier, formatted, null, school);
    setPhase(3);
  };

  if (phase === 3) return (
    <div className="animate-fade-in" style={{ maxWidth: 600, margin: '4rem auto', textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,var(--emerald),#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 0 40px rgba(16,185,129,0.4)' }}>
        <CheckCircle2 size={40} color="#fff" />
      </div>
      <h1 style={{ marginBottom: '0.5rem' }}>Examen Publié ! 🚀</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{questions.length} questions ajoutées à la bibliothèque.</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="btn" onClick={() => { setPhase(1); setPdfFile(null); setPdfName(''); setQuestions([]); setExamName(''); }}>
          <Plus size={18} /> Nouveau Import
        </button>
        <button className="btn" style={{ background: 'var(--bg-glass)', color: 'var(--text-main)' }} onClick={() => navigate('/admin/exams')}>
          Voir la bibliothèque
        </button>
      </div>
    </div>
  );

  const isArMode = /[\u0600-\u06FF]/.test(examName + ' ' + school + ' ' + (questions || []).map(q => q.question + ' ' + q.subject).join(' '));

  return (
    <div className="animate-fade-in" style={{ maxWidth: 960, margin: '0 auto' }}>
      {isArMode && (
        <style>{`
          @font-face {
            font-family: 'UKIJ Merdane';
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
          input, textarea, select {
            font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif !important;
            direction: rtl !important;
            text-align: right !important;
          }
          label, th, td, h2, h3, h4 {
            font-family: 'UKIJ Merdane', 'UKIJMerdane', 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif !important;
            direction: rtl !important;
            text-align: right !important;
          }
        `}</style>
      )}
      {/* ── Back Button ── */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'var(--text-main)',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            transition: 'all 0.2s',
            fontFamily: 'inherit'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        >
          <ArrowLeft size={16} /> Retour au choix du générateur
        </button>
      )}
      {/* ── Page Header ── */}
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={22} color="#fff" />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Générateur de Contenu IA</h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>PDF → Analyse IA → Révision → Publication en 1 clic</p>
          </div>
        </div>

        {/* Phase indicator */}
        <div style={{ display: 'flex', gap: '0', marginTop: '1.5rem' }}>
          {[['1','Analyse PDF'],['2','Révision'],['3','Publication']].map(([n,label], i) => (
            <div key={n} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: i === 0 ? '10px 0 0 10px' : i === 2 ? '0 10px 10px 0' : 0, background: phase === i+1 ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : phase > i+1 ? 'rgba(16,185,129,0.2)' : 'var(--bg-glass)', border: '1px solid', borderColor: phase === i+1 ? '#7c3aed' : phase > i+1 ? 'var(--emerald)' : 'var(--border)', transition: 'all 0.3s' }}>
                <span style={{ fontWeight: 900, fontSize: '0.85rem', color: phase === i+1 ? '#fff' : phase > i+1 ? 'var(--emerald)' : 'var(--text-muted)' }}>{phase > i+1 ? '✓' : n}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: phase === i+1 ? '#fff' : 'var(--text-muted)', display: window.innerWidth < 500 ? 'none' : 'inline' }}>{label}</span>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* ── PHASE 1: Setup ── */}
      {phase === 1 && (
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>

          {/* Draft recovery banner */}
          {questions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.25rem', borderRadius: 12, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>💾</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--violet)' }}>Session sauvegardée</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{questions.length} questions prêtes pour révision{examName ? ` — "${examName}"` : ''}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setPhase(2)} style={{ padding: '0.5rem 1rem', borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#6366f1)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                  Reprendre la révision →
                </button>
                <button onClick={clearDraft} style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
                  Effacer
                </button>
              </div>
            </div>
          )}

          {/* AI Provider Toggle */}
          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label>Moteur d'intelligence artificielle</label>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => { setProvider('gemini'); localStorage.setItem('aiImportProvider', 'gemini'); }}
                style={{
                  flex: 1,
                  padding: '0.6rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderColor: provider === 'gemini' ? '#4285F4' : 'var(--border)',
                  background: provider === 'gemini' ? 'rgba(66,133,244,0.12)' : 'var(--bg-glass)',
                  color: provider === 'gemini' ? '#4285F4' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>✨</span>
                Google Gemini (Sécurisé & Rapide)
              </button>
              <button
                type="button"
                onClick={() => { setProvider('claude'); localStorage.setItem('aiImportProvider', 'claude'); }}
                style={{
                  flex: 1,
                  padding: '0.6rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderColor: provider === 'claude' ? '#7c3aed' : 'var(--border)',
                  background: provider === 'claude' ? 'rgba(124,58,237,0.12)' : 'var(--bg-glass)',
                  color: provider === 'claude' ? '#7c3aed' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🧠</span>
                Anthropic Claude (Modèle d'Examen)
              </button>
              <button
                type="button"
                onClick={() => { setProvider('deepseek'); localStorage.setItem('aiImportProvider', 'deepseek'); }}
                style={{
                  flex: 1,
                  padding: '0.6rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderColor: provider === 'deepseek' ? '#00BA7C' : 'var(--border)',
                  background: provider === 'deepseek' ? 'rgba(0,186,124,0.12)' : 'var(--bg-glass)',
                  color: provider === 'deepseek' ? '#00BA7C' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🚀</span>
                DeepSeek AI (Super Économique)
              </button>
            </div>
          </div>

          {provider === 'claude' && !apiKey && !proxyUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: '1.5rem' }}>
              <AlertCircle size={20} color="var(--danger)" />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--danger)', fontSize: '0.9rem' }}>Clé API ou Proxy Claude manquant</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allez dans <strong>Paramètres</strong> pour configurer votre clé Anthropic ou l'URL du proxy.</p>
              </div>
            </div>
          )}

          {provider === 'claude' && apiKey && !proxyUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: '1.5rem', fontSize: '0.82rem' }}>
              <AlertCircle size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--warning)', fontSize: '0.88rem' }}>⚠️ Appel direct au navigateur activé (sk-ant-...)</p>
                <p style={{ margin: 0, color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: 1.4 }}>
                  En production, configurez un <strong>Proxy Serveur</strong> dans les Paramètres pour masquer vos clés API et éviter le vol de crédits.
                </p>
              </div>
            </div>
          )}

          {provider === 'gemini' && !geminiKey && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: '1.5rem' }}>
              <AlertCircle size={20} color="var(--danger)" />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--danger)', fontSize: '0.9rem' }}>Clé API Gemini manquante</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allez dans <strong>Paramètres</strong> pour configurer votre clé Google Gemini.</p>
              </div>
            </div>
          )}

          {provider === 'deepseek' && !deepseekKey && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: '1.5rem' }}>
              <AlertCircle size={20} color="var(--danger)" />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--danger)', fontSize: '0.9rem' }}>Clé API DeepSeek manquante</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allez dans <strong>Paramètres</strong> pour configurer votre clé API DeepSeek.</p>
              </div>
            </div>
          )}

          {/* PDF Upload */}
          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label>Fichier PDF (Sujet de concours)</label>
            <label className="upload-zone" style={{ cursor: 'pointer', minHeight: 160 }} onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".pdf" onChange={handlePdfSelect} style={{ display: 'none' }} />
              {!pdfFile ? (
                <>
                  <UploadCloud size={36} style={{ marginBottom: '0.75rem', color: provider === 'claude' ? 'var(--violet)' : provider === 'deepseek' ? '#00BA7C' : '#4285F4' }} />
                  <p style={{ fontWeight: 700 }}>Cliquez pour choisir un PDF</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sujets de concours, examens, corrigés...</p>
                </>
              ) : (
                <div style={{ color: provider === 'claude' ? 'var(--violet)' : provider === 'deepseek' ? '#00BA7C' : '#4285F4' }}>
                  <CheckCircle2 size={36} style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ fontWeight: 800 }}>{pdfName}</p>
                  {totalPages && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{totalPages} pages détectées</p>}
                </div>
              )}
            </label>
          </div>

          {/* Mode Selector */}
          {totalPages && (
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label>Mode d'extraction</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setMode('simple')}
                  style={{
                    flex: 1,
                    padding: '0.6rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderColor: mode === 'simple' ? 'var(--violet)' : 'var(--border)',
                    background: mode === 'simple' ? 'rgba(124,58,237,0.12)' : 'var(--bg-glass)',
                    color: mode === 'simple' ? 'var(--violet)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>🧠</span>
                  Mode Simple (L'IA résout)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('with_correction')}
                  style={{
                    flex: 1,
                    padding: '0.6rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderColor: mode === 'with_correction' ? 'var(--emerald)' : 'var(--border)',
                    background: mode === 'with_correction' ? 'rgba(16,185,129,0.12)' : 'var(--bg-glass)',
                    color: mode === 'with_correction' ? 'var(--emerald)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>🎯</span>
                  Avec Grille/Corrigé (Depuis le fichier)
                </button>
              </div>
            </div>
          )}

          {/* Page range */}
          {totalPages && (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px', display: 'flex', gap: '1rem' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Pages questions (Début)</label>
                  <input type="number" className="input-control" min={1} max={totalPages} value={pageFrom} onChange={e => setPageFrom(+e.target.value)} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Pages questions (Fin)</label>
                  <input type="number" className="input-control" min={1} max={totalPages} value={pageTo} onChange={e => setPageTo(+e.target.value)} />
                </div>
              </div>
              
              {mode === 'with_correction' ? (
                <div style={{ flex: '1 1 300px', display: 'flex', gap: '1rem' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label style={{ color: 'var(--emerald)', fontWeight: 700 }}>Pages corrigé (Début)</label>
                    <input type="number" className="input-control" style={{ borderColor: 'rgba(16,185,129,0.4)' }} min={1} max={totalPages} value={correctionPageFrom} onChange={e => setCorrectionPageFrom(+e.target.value)} />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label style={{ color: 'var(--emerald)', fontWeight: 700 }}>Pages corrigé (Fin)</label>
                    <input type="number" className="input-control" style={{ borderColor: 'rgba(16,185,129,0.4)' }} min={1} max={totalPages} value={correctionPageTo} onChange={e => setCorrectionPageTo(+e.target.value)} />
                  </div>
                </div>
              ) : (
                <div style={{ flex: 2, minWidth: '250px', padding: '0.5rem 1rem', borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', gap: '0.4rem' }}>
                  💡 Sélectionnez uniquement les pages des questions pour réduire le coût API.
                </div>
              )}
            </div>
          )}

          {/* Exam metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="input-group">
              <label>Niveau cible</label>
              <select className="input-control" value={school} onChange={e => setSchool(e.target.value)}>
                {schools.map(s => <option key={s} value={s}>{getLevelDisplayName(s)}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Année <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(optionnelle)</span></label>
              <input
                type="text"
                className="input-control"
                placeholder="Ex: 2025, ou laisser vide"
                value={year}
                onChange={e => setYear(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Accès</label>
              <select className="input-control" value={tier} onChange={e => setTier(e.target.value)}>
                <option value="freemium">Gratuit</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>

          {/* Model selector */}
          {provider === 'claude' ? (
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label>Modèle Claude <span style={{fontWeight:400, color:'var(--text-muted)'}}>— ID exact de l'API</span></label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {[
                  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Recommandé - Stable & Précis)' },
                  { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Raisonnement Hybride)' },
                  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Rapide & Économique)' },
                  { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Haute précision)' }
                ].map(item => (
                  <button key={item.id} type="button"
                    onClick={() => { setClaudeModel(item.id); localStorage.setItem('claudeModel', item.id); }}
                    style={{ padding: '0.3rem 0.65rem', borderRadius: 8, border: '1px solid', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                      borderColor: claudeModel === item.id ? 'var(--violet)' : 'var(--border)',
                      background: claudeModel === item.id ? 'rgba(124,58,237,0.15)' : 'var(--bg-glass)',
                      color: claudeModel === item.id ? 'var(--violet)' : 'var(--text-muted)'
                    }}>{item.label}</button>
                ))}
              </div>
              <input
                type="text"
                className="input-control"
                value={claudeModel}
                onChange={e => { setClaudeModel(e.target.value); localStorage.setItem('claudeModel', e.target.value); }}
                placeholder="ex: claude-3-5-sonnet-20241022"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <p style={{ marginTop: '0.4rem', fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                💡 Recommandé : <strong>claude-3-5-sonnet-20241022</strong> (Ultra stable, précis et optimal pour l&apos;extraction de concours et documents complexes).
              </p>
            </div>
          ) : provider === 'deepseek' ? (
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label>Modèle DeepSeek <span style={{fontWeight:400, color:'var(--text-muted)'}}>— ID exact de l&apos;API</span></label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {[
                  { id: 'deepseek-reasoner', label: 'DeepSeek-R1 (Reasoner - Réflexion & Maths Approfondis)' },
                  { id: 'deepseek-chat', label: 'DeepSeek-V3 (Chat - Flash, Rapide & Économique)' }
                ].map(item => (
                  <button key={item.id} type="button"
                    onClick={() => { setDeepseekModel(item.id); localStorage.setItem('deepseekModel', item.id); }}
                    style={{ padding: '0.3rem 0.65rem', borderRadius: 8, border: '1px solid', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                      borderColor: (deepseekModel === item.id || (item.id === 'deepseek-reasoner' && (deepseekModel === 'deepseek-v4-pro' || deepseekModel === 'deepseek-r1')) || (item.id === 'deepseek-chat' && (deepseekModel === 'deepseek-v4-flash' || deepseekModel === 'deepseek-v3'))) ? '#00BA7C' : 'var(--border)',
                      background: (deepseekModel === item.id || (item.id === 'deepseek-reasoner' && (deepseekModel === 'deepseek-v4-pro' || deepseekModel === 'deepseek-r1')) || (item.id === 'deepseek-chat' && (deepseekModel === 'deepseek-v4-flash' || deepseekModel === 'deepseek-v3'))) ? 'rgba(0,186,124,0.15)' : 'var(--bg-glass)',
                      color: (deepseekModel === item.id || (item.id === 'deepseek-reasoner' && (deepseekModel === 'deepseek-v4-pro' || deepseekModel === 'deepseek-r1')) || (item.id === 'deepseek-chat' && (deepseekModel === 'deepseek-v4-flash' || deepseekModel === 'deepseek-v3'))) ? '#00BA7C' : 'var(--text-muted)'
                    }}>{item.label}</button>
                ))}
              </div>
              <input
                type="text"
                className="input-control"
                value={deepseekModel}
                onChange={e => { setDeepseekModel(e.target.value); localStorage.setItem('deepseekModel', e.target.value); }}
                placeholder="ex: deepseek-reasoner"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <p style={{ marginTop: '0.4rem', fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                💡 Utilisez <strong>deepseek-reasoner</strong> (DeepSeek-R1) pour le raisonnement logique poussé et la résolution d&apos;exercices complexes, ou <strong>deepseek-chat</strong> (DeepSeek-V3) pour l&apos;extraction ultra rapide et économique.
              </p>
            </div>
          ) : (
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label>Modèle Gemini <span style={{fontWeight:400, color:'var(--text-muted)'}}>— ID exact de l'API</span></label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {[
                  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recommandé - Vitesse & Haute Précision)' },
                  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite (Économique & Ultra Rapide)' },
                  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Raisonnement Complexe)' },
                  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Standard Robuste)' }
                ].map(item => (
                  <button key={item.id} type="button"
                    onClick={() => { setGeminiModel(item.id); localStorage.setItem('geminiModel', item.id); }}
                    style={{ padding: '0.3rem 0.65rem', borderRadius: 8, border: '1px solid', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                      borderColor: (geminiModel === item.id) ? '#4285F4' : 'var(--border)',
                      background: (geminiModel === item.id) ? 'rgba(66,133,244,0.15)' : 'var(--bg-glass)',
                      color: (geminiModel === item.id) ? '#4285F4' : 'var(--text-muted)'
                    }}>{item.label}</button>
                ))}
              </div>
              <input
                type="text"
                className="input-control"
                value={geminiModel}
                onChange={e => { setGeminiModel(e.target.value); localStorage.setItem('geminiModel', e.target.value); }}
                placeholder="ex: gemini-2.0-flash"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <p style={{ marginTop: '0.4rem', fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                💡 Recommandé : <strong>gemini-2.0-flash</strong> (Recommandé par défaut - multimodal haute précision), <strong>gemini-2.0-flash-lite</strong> ou <strong>gemini-1.5-pro</strong>.
              </p>
            </div>
          )}

          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label>Titre de l'examen (affiché aux élèves)</label>
            <input type="text" className="input-control" placeholder="Ex: Concours Médecine Oujda 2024" value={examName} onChange={e => setExamName(e.target.value)} />
          </div>

          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{error}</span>
              </div>
              
              {detectedModels.length > 0 && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(239,68,68,0.15)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>💡</span> Modèles disponibles (Cliquez pour sélectionner) :
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    {detectedModels.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setGeminiModel(m);
                          localStorage.setItem('geminiModel', m);
                        }}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: geminiModel === m ? '1px solid var(--violet)' : '1px solid rgba(255,255,255,0.1)',
                          background: geminiModel === m ? 'var(--violet-soft)' : 'rgba(255,255,255,0.03)',
                          color: geminiModel === m ? 'var(--violet)' : 'var(--text-muted)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          if (geminiModel !== m) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.color = 'var(--text-main)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (geminiModel !== m) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                            e.currentTarget.style.color = 'var(--text-muted)';
                          }
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
              <button
                className="btn"
                disabled
                style={{
                  flex: 1,
                  padding: '1.1rem',
                  fontSize: '1rem',
                  justifyContent: 'center',
                  background: provider === 'claude' ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : provider === 'deepseek' ? 'linear-gradient(135deg,#00BA7C,#4f46e5)' : 'linear-gradient(135deg,#4285F4,#34A853)',
                  boxShadow: provider === 'claude' ? '0 8px 24px rgba(124,58,237,0.35)' : provider === 'deepseek' ? '0 8px 24px rgba(0,186,124,0.35)' : '0 8px 24px rgba(66,133,244,0.35)',
                  opacity: 0.85
                }}
              >
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> {progress || 'Traitement...'}
              </button>
              <button
                onClick={() => { abortRef.current?.abort(); clearInterval(timerRef.current); setLoading(false); setProgress(''); setError('Analyse annulée.'); }}
                style={{ padding: '0 1.1rem', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                title="Arrêter l'analyse"
              >
                <StopCircle size={18} /> Arrêter
              </button>
            </div>
          ) : (
            <button
              className="btn"
              onClick={handleAnalyze}
              disabled={!pdfFile || (provider === 'claude' ? (!apiKey && !proxyUrl) : provider === 'deepseek' ? !deepseekKey : !geminiKey)}
              style={{
                width: '100%',
                padding: '1.1rem',
                fontSize: '1rem',
                justifyContent: 'center',
                background: provider === 'claude' ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : provider === 'deepseek' ? 'linear-gradient(135deg,#00BA7C,#4f46e5)' : 'linear-gradient(135deg,#4285F4,#34A853)',
                boxShadow: provider === 'claude' ? '0 8px 24px rgba(124,58,237,0.35)' : provider === 'deepseek' ? '0 8px 24px rgba(0,186,124,0.35)' : '0 8px 24px rgba(66,133,244,0.35)'
              }}
            >
              <Sparkles size={20} /> Analyser avec {provider === 'claude' ? 'Claude AI' : provider === 'deepseek' ? 'DeepSeek AI' : 'Gemini AI'} ✨
            </button>
          )}
        </div>
      )}

      {/* ── PHASE 2: Review Grid ── */}
      {phase === 2 && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* National Exam Banner */}
          {isNationalExam && (
            <div className="glass-panel" style={{
              padding: '1.25rem 1.75rem',
              borderRadius: '16px',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem' }}>🏆</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Examen National officiel détecté (Baccalauréat)
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Mise en page automatique selon la charte officielle des examens nationaux marocains.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setViewNationalTemplate(!viewNationalTemplate)}
                  style={{
                    background: viewNationalTemplate ? 'var(--violet)' : 'rgba(255,255,255,0.05)',
                    color: viewNationalTemplate ? '#fff' : 'inherit',
                    fontWeight: 700,
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem'
                  }}
                >
                  {viewNationalTemplate ? '✏️ Mode édition' : '👁️ Modèle Examen National'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => openNationalExamPrintWindow({
                    header: { fiche_title: examName, subject: 'Mathématiques', level: '2bac_pc_svt', is_national_exam: isNationalExam, national_exam_meta: nationalExamMeta },
                    questions: questions
                  })}
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 700, padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  🖨️ Imprimer / Exporter format officiel (PDF)
                </button>
              </div>
            </div>
          )}

          {isNationalExam && viewNationalTemplate ? (
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <NationalExamTemplate
                examData={{
                  header: { fiche_title: examName, subject: 'الرياضيات', level: '2bac_pc_svt', is_national_exam: isNationalExam, national_exam_meta: nationalExamMeta },
                  questions: questions
                }}
              />
            </div>
          ) : (
            <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>👀 Révision — {questions.length} questions extraites</h2>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cliquez sur une cellule pour modifier. Vérifiez les réponses correctes.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={addEmptyQuestion} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                <Plus size={16} /> Ajouter
              </button>
              <button onClick={() => setPhase(1)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>
                ← Retour
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.8rem 1rem', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Editable table */}
          <div style={{ borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-card)', marginBottom: '1.5rem' }}>
            <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-card)' }}>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['N°', 'Sujet', 'Question', 'Options (A→D)', 'Rép.', 'Astuce', 'Trick ⚡', ''].map((h, i) => (
                      <th key={i} style={{ padding: '0.875rem 0.75rem', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, idx) => (
                    <tr key={q.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} onMouseEnter={e => e.currentTarget.style.background='rgba(124,58,237,0.04)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                      <td style={{ padding: '0.5rem', minWidth: 52 }}>
                        <input
                          type="number" min={1}
                          value={q.question_number}
                          onChange={e => updateQuestion(idx, 'question_number', +e.target.value)}
                          style={{ width: 48, background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(99,102,241,0.1))', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8, padding: '0.3rem 0.4rem', color: 'var(--violet)', fontWeight: 900, fontSize: '0.9rem', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input value={q.subject} onChange={e => updateQuestion(idx, 'subject', e.target.value)}
                          style={{ width: '100%', minWidth: 90, background: 'var(--bg-glass)', border: '1px solid transparent', borderRadius: 6, padding: '0.3rem 0.5rem', color: 'var(--text-main)', fontSize: '0.78rem', fontWeight: 600 }}
                          onFocus={e => e.target.style.borderColor='var(--violet)'} onBlur={e => e.target.style.borderColor='transparent'} />
                      </td>
                      <td style={{ padding: '0.5rem', minWidth: 220 }}>
                        <textarea value={q.question} onChange={e => updateQuestion(idx, 'question', e.target.value)} rows={2}
                          style={{ width: '100%', background: 'var(--bg-glass)', border: '1px solid transparent', borderRadius: 6, padding: '0.3rem 0.5rem', color: 'var(--text-main)', fontSize: '0.78rem', resize: 'vertical', fontFamily: 'inherit' }}
                          onFocus={e => e.target.style.borderColor='var(--violet)'} onBlur={e => e.target.style.borderColor='transparent'} />
                      </td>
                      <td style={{ padding: '0.5rem', minWidth: 200 }}>
                        {(q.options || []).map((opt, oi) => (
                          <input key={oi} value={opt} onChange={e => {
                            const newOpts = [...q.options]; newOpts[oi] = e.target.value; updateQuestion(idx, 'options', newOpts);
                          }}
                            style={{ display: 'block', width: '100%', marginBottom: 2, background: 'var(--bg-glass)', border: '1px solid transparent', borderRadius: 6, padding: '0.25rem 0.5rem', color: 'var(--text-main)', fontSize: '0.75rem' }}
                            onFocus={e => e.target.style.borderColor='var(--violet)'} onBlur={e => e.target.style.borderColor='transparent'} />
                        ))}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <select value={q.correct_answer} onChange={e => updateQuestion(idx, 'correct_answer', e.target.value)}
                          style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.08))', border: '1px solid var(--emerald)', borderRadius: 8, padding: '0.3rem 0.5rem', color: 'var(--emerald)', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer' }}>
                          {['A','B','C','D','E'].map(l => <option key={l}>{l}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '0.5rem', minWidth: 180 }}>
                        <textarea value={q.astuce} onChange={e => updateQuestion(idx, 'astuce', e.target.value)} rows={2}
                          style={{ width: '100%', background: 'var(--bg-glass)', border: '1px solid transparent', borderRadius: 6, padding: '0.3rem 0.5rem', color: 'var(--text-main)', fontSize: '0.75rem', resize: 'vertical', fontFamily: 'inherit' }}
                          onFocus={e => e.target.style.borderColor='var(--violet)'} onBlur={e => e.target.style.borderColor='transparent'} />
                      </td>
                      <td style={{ padding: '0.5rem', minWidth: 160 }}>
                        <textarea value={q.trick || ''} onChange={e => updateQuestion(idx, 'trick', e.target.value)} rows={2}
                          placeholder="⚡ Trick rapide..."
                          style={{ width: '100%', background: 'var(--bg-glass)', border: '1px solid transparent', borderRadius: 6, padding: '0.3rem 0.5rem', color: 'var(--text-main)', fontSize: '0.75rem', resize: 'vertical', fontFamily: 'inherit' }}
                          onFocus={e => e.target.style.borderColor='var(--emerald)'} onBlur={e => e.target.style.borderColor='transparent'} />
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <button onClick={() => deleteQuestion(idx)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: 'var(--danger)', borderRadius: 8, padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Publish bar */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <input type="text" className="input-control" placeholder="Titre de l'examen (ex: Concours Médecine Fès 2024)" value={examName} onChange={e => { setExamName(e.target.value); setError(''); }} style={{ fontSize: '0.95rem', fontWeight: 600 }} />
            </div>
            {/* PDF buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleSubjectPDF}
                disabled={!examName.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(30,86,219,0.12)', border: '1px solid rgba(30,86,219,0.3)', color: '#1a56db', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                title="Télécharger le sujet blanc (impression)"
              >
                <FileText size={16} /> Sujet PDF
              </button>
              <button
                onClick={handleCorrectionPDF}
                disabled={!examName.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', color: 'var(--violet)', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                title="Télécharger le corrigé détaillé"
              >
                <FileText size={16} /> Corrigé PDF
              </button>
            </div>
            <button
              className="btn"
              onClick={handlePublish}
              style={{ flex: 1, minWidth: 180, padding: '0.9rem 1.5rem', justifyContent: 'center', background: 'linear-gradient(135deg,var(--emerald),#34d399)', boxShadow: '0 8px 24px rgba(16,185,129,0.35)', fontSize: '0.95rem' }}
            >
              <Send size={18} /> Valider et Publier 🚀
            </button>
          </div>
          </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
