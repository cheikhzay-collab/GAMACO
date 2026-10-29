/**
 * smartExtractorFormatter.js
 * Utilitaires intelligents de post-traitement et Copilot IA :
 * 1. Correction des erreurs linguistiques, d'orthographe et d'OCR (Arabe & Français).
 * 2. Formattage intelligent du texte et des expressions LaTeX.
 * 3. Tréquage et numérotation logique des questions et sous-questions.
 * 4. Normalisation et découpage intelligent des propositions de réponse (QCM).
 * 5. Actions Copilot IA par question : Génération de variante, Ajustement de difficulté, Enrichissement du corrigé.
 */

import { cropPdfRegion } from './pdfFigureExtractor';

// Erreurs courantes d'OCR et de saisie en Arabe
const ARABIC_OCR_CORRECTIONS = [
  [/\bألا([ا-ي])/g, 'ال$1'], // Correction "ألا" en "ال" dans les mots courants (ex: ألاختبار -> الاختبار)
  [/\bأل([ا-ي])/g, 'ال$1'], // Correction "أل" en "ال" (ex: ألإمتحان -> الامتحان)
  [/\bإختبار/g, 'اختبار'],
  [/\bإمتحان/g, 'امتحان'],
  [/\bإستخراج/g, 'استخراج'],
  [/\bإستنتاج/g, 'استنتاج'],
  [/\bإستعمال/g, 'استعمال'],
  [/\bأحسب\b/g, 'احسب'],
  [/\bأوجد\b/g, 'اوجد'],
  [/\bأدرس\b/g, 'ادرس'],
  [/\bأنشئ\b/g, 'انشئ'],
  [/\bبيّن\b/g, 'بين'],
  [/\bالسؤآل\b/g, 'السؤال'],
  [/\bالتمرينّ\b/g, 'التمرين'],
  [/\s+([\؟\!\.\,\:\؛])/g, '$1'], // Supprimer les espaces avant les ponctuations
  [/([\؟\!\.\,\:\؛])([^\s\$0-9\)])/g, '$1 $2'], // Ajouter un espace après la ponctuation si manquant
];

// Erreurs courantes d'OCR et de numérisation en Français
const FRENCH_OCR_CORRECTIONS = [
  [/\b(E|e)xercice\s*n°?\s*([0-9]+)\b/gi, 'Exercice $2'],
  [/\b(Q|q)uestion\s*n°?\s*([0-9]+)\b/gi, 'Question $2'],
  [/\b(S|s)olution\s*:\s*/gi, 'Solution : '],
  [/\b(R|r)emarque\s*:\s*/gi, 'Remarque : '],
  [/\s+([\!\?\.\,\:\;])/g, '$1'], // Supprimer les espaces multiples avant ponctuation simple
  [/([\!\?\:\;])([^\s\$0-9\)])/g, '$1 $2'], // Espace après ponctuation forte
];

/**
 * Nettoie et corrige les erreurs linguistiques, d'orthographe et de numérisation OCR
 */
export function fixLinguisticAndOcrErrors(text) {
  if (!text || typeof text !== 'string') return text || '';
  
  let str = text;

  // Normalisation des espaces multiples et retours à la ligne superflus
  str = str.replace(/[ \t]+/g, ' ');
  str = str.replace(/\n{3,}/g, '\n\n');

  // Application des corrections spécifiques Arabe
  if (/[\u0600-\u06FF]/.test(str)) {
    for (const [regex, replacement] of ARABIC_OCR_CORRECTIONS) {
      str = str.replace(regex, replacement);
    }
  }

  // Application des corrections spécifiques Français
  for (const [regex, replacement] of FRENCH_OCR_CORRECTIONS) {
    str = str.replace(regex, replacement);
  }

  // Nettoyage des parenthèses/crochets mal espacés
  str = str.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  str = str.replace(/\[\s+/g, '[').replace(/\s+\]/g, ']');

  return str.trim();
}

/**
 * Formate et répare intelligemment les balises et expressions LaTeX
 */
export function smartFormatMathAndLatex(text) {
  if (!text || typeof text !== 'string') return text || '';

  let str = text;

  // 1. Réparer \neq corrompu (\n eq, bare eq 0, etc.)
  str = str
    .replace(/\\n\s*eq\b/g, '\\neq')
    .replace(/(?<=[x-z0-9\s])\beq\s*([0-9a-zA-Z])/g, '\\neq $1')
    .replace(/(?<![a-zA-Z\\])neq\b/g, '\\neq');

  // 2. Réparer et envelopper les environnements mathématiques (cases, aligned, matrix, etc.)
  const envPattern = /(?:(?:\$\$|\$)\s*)?((?:(?:[a-zA-Z0-9_'\(\)\s\^\{\}\[\]+\\-]+|\\left\.?|\\left\\\{)\s*[:=]\s*)?\\begin\{(cases|aligned|matrix|pmatrix|vmatrix|array|gather|split|bmatrix|Bmatrix)\}[\s\S]*?\\end\{\2\}(?:\s*\\right\.)?)(?:\s*(?:\$\$|\$))?/g;
  str = str.replace(envPattern, (match, body) => {
    let cleanBody = body.trim();
    cleanBody = cleanBody.replace(/^\${1,2}/, '').replace(/\${1,2}$/, '').trim();
    return `\n\n$$${cleanBody}$$\n\n`;
  });

  // 3. Réparer les doubles anti-slashs LaTeX accidentels
  str = str.replace(/\\\\([a-zA-Z]+)\b/g, '\\$1');

  // 4. Réparer les balises $ ouvertes mais non fermées en excluant les blocs $$ déjà fermés
  const textWithoutDisplayMath = str.replace(/\$\$[\s\S]*?\$\$/g, '');
  let dollarCount = (textWithoutDisplayMath.match(/(?<!\\)\$/g) || []).length;
  if (dollarCount % 2 !== 0) {
    str += '$';
  }

  // Nettoyer les blocs $ $ vides
  str = str.replace(/\$\s*\$/g, '');

  return str;
}

/**
 * Découpe et répare les options de réponses QCM si elles ont été fusionnées par l'OCR
 */
export function smartNormalizeOptions(options) {
  let rawList = [];

  if (Array.isArray(options)) {
    rawList = options;
  } else if (typeof options === 'string') {
    rawList = options.split('\n').filter(Boolean);
  } else if (typeof options === 'object' && options !== null) {
    rawList = Object.entries(options).map(([k, v]) => `${k}) ${v}`);
  }

  let finalOptions = [];

  // Vérifier si une option contient des choix fusionnés (ex: "A) 5  B) 10  C) 15  D) 20")
  for (const opt of rawList) {
    const optStr = String(opt || '').trim();
    if (!optStr) continue;

    // Détecter la présence de plusieurs préfixes [A-E]\) dans la même chaîne
    const splitMatches = optStr.split(/(?=\b[A-E][\)\.]\s*)/i);
    if (splitMatches.length > 1) {
      for (const sub of splitMatches) {
        if (sub.trim()) finalOptions.push(sub.trim());
      }
    } else {
      finalOptions.push(optStr);
    }
  }

  // Nettoyer et préfixer proprement avec A), B), C), D)
  const letters = ['A', 'B', 'C', 'D', 'E'];
  let cleaned = finalOptions.map((optText, i) => {
    const targetLetter = letters[i] || String.fromCharCode(65 + i);
    // Enlever le préfixe existant pour ré-harmoniser
    let pureText = optText.replace(/^[A-E][\)\.]\s*/i, '').trim();
    pureText = fixLinguisticAndOcrErrors(pureText);
    pureText = smartFormatMathAndLatex(pureText);
    return `${targetLetter}) ${pureText}`;
  });

  // S'assurer d'avoir toujours exactement 4 options minimum (A, B, C, D)
  while (cleaned.length < 4) {
    const letter = letters[cleaned.length] || String.fromCharCode(65 + cleaned.length);
    cleaned.push(`${letter}) `);
  }

  return cleaned.slice(0, 5); // Limiter à 5 max
}

/**
 * Re-numérote et ordonne intelligemment la liste des questions
 */
export function smartNumberQuestions(questions) {
  if (!Array.isArray(questions)) return [];

  // Conserver l'ordre chronologique exact d'extraction du document
  const seenNumbers = new Set();

  return questions.map((q, index) => {
    let cleanNum = parseInt(q.question_number || q.num, 10);

    // Si le numéro est invalide, manquant ou déjà vu, lui attribuer le numéro séquentiel exact (index + 1)
    if (isNaN(cleanNum) || cleanNum <= 0 || seenNumbers.has(cleanNum)) {
      cleanNum = index + 1;
    }

    seenNumbers.add(cleanNum);

    const questionText = smartFormatMathAndLatex(fixLinguisticAndOcrErrors(q.question || q.text || q.statement || q.enonce || q.énoncé || ''));
    const contextText = smartFormatMathAndLatex(fixLinguisticAndOcrErrors(q.context || q.enonce_commun || ''));
    const astuceText = smartFormatMathAndLatex(fixLinguisticAndOcrErrors(q.astuce || q.explanation || q.explication || q.solution || q.justification || ''));
    const trickText = smartFormatMathAndLatex(fixLinguisticAndOcrErrors(q.trick || q.astuce_rapide || q.quick_trick || q.shortcut || ''));
    const subjectText = fixLinguisticAndOcrErrors(q.subject || q.topic || 'Général');

    return {
      ...q,
      question_number: cleanNum,
      question: questionText,
      context: contextText,
      subject: subjectText,
      options: smartNormalizeOptions(q.options || q.choices || q.propositions || q.answers),
      correct_answer: String(q.correct_answer || q.answer || q.correct || 'A').trim().toUpperCase().replace(/[^A-E]/g, '') || 'A',
      astuce: astuceText,
      trick: trickText
    };
  });
}

/**
 * Helper API call to Gemini for Copilot actions
 */
async function callGeminiAi(prompt, systemPrompt, apiKey, model = 'gemini-2.5-flash') {
  const modelToUse = (model || 'gemini-2.5-flash').replace(/^models\//, '');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur IA : ${res.statusText}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const nonThoughtParts = candidate?.content?.parts?.filter(p => !p.thought) || [];
  const text = (nonThoughtParts.length > 0 ? nonThoughtParts : (candidate?.content?.parts || []))
    .map(p => p.text || '')
    .join('');
  if (!text) throw new Error("Aucune réponse reçue du modèle IA.");

  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
  else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/i, '').replace(/```\s*$/i, '');

  return JSON.parse(clean);
}

/**
 * Copilot Action: Générer une variante pédagogique d'une question
 */
export async function generateQuestionVariant(q, apiKey, model) {
  const isAr = /[\u0600-\u06FF]/.test(q.question + ' ' + q.context);
  const sys = `Tu es un Inspecteur de Mathématiques et Sciences.
Génère une variante équivalente de la question fournie (même concept mathématique, mêmes compétences, mais avec des valeurs numériques ou fonctions modifiées pour créer un nouvel exercice anti-triche).
Conserve impérativement la langue d'origine (${isAr ? 'Arabe' : 'Français'}).
Retourne UNIQUEMENT un objet JSON avec les clés :
{
  "question": "Énoncé modifié avec LaTeX $...$",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_answer": "A" (ou B/C/D),
  "astuce": "Corrigé détaillé pas à pas style inspecteur",
  "trick": "⚡ Astuce rapide d'élimination"
}`;

  const prompt = `Voici la question d'origine :\nQuestion: ${q.question}\nOptions:\n${q.options.join('\n')}\nRéponse: ${q.correct_answer}\n\nGénère la variante au format JSON.`;
  const result = await callGeminiAi(prompt, sys, apiKey, model);

  return {
    ...q,
    question: smartFormatMathAndLatex(fixLinguisticAndOcrErrors(result.question || q.question)),
    options: smartNormalizeOptions(result.options || q.options),
    correct_answer: String(result.correct_answer || q.correct_answer || 'A').toUpperCase().replace(/[^A-E]/g, '') || 'A',
    astuce: smartFormatMathAndLatex(fixLinguisticAndOcrErrors(result.astuce || q.astuce)),
    trick: smartFormatMathAndLatex(fixLinguisticAndOcrErrors(result.trick || q.trick))
  };
}

/**
 * Copilot Action: Ajuster la difficulté d'une question (plus simple ou plus avancée)
 */
export async function adjustQuestionDifficulty(q, mode = 'harder', apiKey, model) {
  const isAr = /[\u0600-\u06FF]/.test(q.question + ' ' + q.context);
  const sys = `Tu es un Inspecteur de Mathématiques.
Réécris la question fournie pour la rendre ${mode === 'harder' ? 'plus sélective et approfondie (concours)' : 'plus accessible et directe (application de base)'}.
Conserve impérativement la langue d'origine (${isAr ? 'Arabe' : 'Français'}).
Retourne UNIQUEMENT un objet JSON :
{
  "question": "Énoncé ajusté avec LaTeX $...$",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_answer": "A" (ou B/C/D),
  "astuce": "Corrigé détaillé",
  "trick": "⚡ Astuce rapide"
}`;

  const prompt = `Question:\n${q.question}\nOptions:\n${q.options.join('\n')}\nRéponse: ${q.correct_answer}\n\nAjuste la difficulté (${mode}) et retourne le JSON.`;
  const result = await callGeminiAi(prompt, sys, apiKey, model);

  return {
    ...q,
    question: smartFormatMathAndLatex(fixLinguisticAndOcrErrors(result.question || q.question)),
    options: smartNormalizeOptions(result.options || q.options),
    correct_answer: String(result.correct_answer || q.correct_answer || 'A').toUpperCase().replace(/[^A-E]/g, '') || 'A',
    astuce: smartFormatMathAndLatex(fixLinguisticAndOcrErrors(result.astuce || q.astuce)),
    trick: smartFormatMathAndLatex(fixLinguisticAndOcrErrors(result.trick || q.trick))
  };
}

/**
 * Copilot Action: Enrichir l'explication et la خدعة (Astuce & Trick)
 */
export async function enrichQuestionExplanation(q, apiKey, model) {
  const isAr = /[\u0600-\u06FF]/.test(q.question + ' ' + q.context);
  const sys = `Tu es un Inspecteur Principal de Mathématiques.
Rédige un corrigé-type officiel ultra-complet ('astuce') avec étapes numérotées, connecteurs logiques officiels et LaTeX irréprochable, ainsi qu'une astuce rapide ('trick') avec le symbole ⚡ pour éliminer les mauvaises réponses en moins de 20s.
Conserve la langue d'origine (${isAr ? 'Arabe' : 'Français'}).
Retourne UNIQUEMENT un objet JSON :
{
  "astuce": "Corrigé modèle étape par étape",
  "trick": "⚡ Astuce rapide d'élimination"
}`;

  const prompt = `Question:\n${q.question}\nOptions:\n${q.options.join('\n')}\nBonne réponse: ${q.correct_answer}\n\nRédige l'astuce et le trick officiels au format JSON.`;
  const result = await callGeminiAi(prompt, sys, apiKey, model);

  return {
    ...q,
    astuce: smartFormatMathAndLatex(fixLinguisticAndOcrErrors(result.astuce || q.astuce)),
    trick: smartFormatMathAndLatex(fixLinguisticAndOcrErrors(result.trick || q.trick))
  };
}

/**
 * Corrige l'imbrication bidirectionnelle (Arabe RTL avec formules LaTeX LTR)
 * pour éviter les inversions de parenthèses ou de symboles comparatifs.
 */
export function smartFixBidiMath(text) {
  if (!text || typeof text !== 'string') return text || '';

  let str = text;

  // Isoler les formules mathématiques $...$ et $$...$$ pour éviter les altérations bidi
  str = str.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+\$)/g, (match) => {
    // Nettoyer les espaces inutiles autour des délimiteurs
    return match.trim();
  });

  // Empêcher l'inversion des flèches et symboles d'équivalence en contexte arabe
  if (/[\u0600-\u06FF]/.test(str)) {
    str = str.replace(/(?<=[\u0600-\u06FF\s])(<=>|==>|->)(?=[\u0600-\u06FF\s])/g, (m) => `$${m}$`);
  }

  return str;
}

/**
 * Normalise les structures de tableaux et tableaux de variations
 */
export function smartNormalizeTables(text) {
  if (!text || typeof text !== 'string') return text || '';

  const lines = text.split('\n');
  const resultLines = [];
  let inTable = false;
  let tableBuffer = [];

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    if (tableBuffer.length >= 2) {
      // Normaliser chaque ligne du tableau
      const cleanedRows = tableBuffer.map(row => {
        let r = row.trim();
        if (!r.startsWith('|')) r = '| ' + r;
        if (!r.endsWith('|')) r = r + ' |';
        return r;
      });
      resultLines.push(...cleanedRows);
    } else {
      resultLines.push(...tableBuffer);
    }
    tableBuffer = [];
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') || (trimmed.includes('|') && trimmed.endsWith('|'))) {
      inTable = true;
      tableBuffer.push(line);
    } else {
      if (inTable) flushTable();
      resultLines.push(line);
    }
  }

  if (inTable) flushTable();

  return resultLines.join('\n');
}

/**
 * Découpe et extrait automatiquement les figures et graphiques à partir d'un PDF
 * en utilisant les boundingBoxes détectées par le modèle de vision.
 */
export async function autoCropFiguresFromPdf(items, pdfDocProxy) {
  if (!Array.isArray(items) || !pdfDocProxy) return items;

  const processed = [];

  for (const item of items) {
    const clone = { ...item };

    // Vérifier si l'élément possède des métadonnées de figure ou de boundingBox
    const hasFigureMeta = clone.figure && clone.figure.boundingBox && (clone.figure.pageIndex !== undefined);
    const hasDirectBox = clone.boundingBox && (clone.pageIndex !== undefined);

    if (hasFigureMeta || hasDirectBox) {
      const pageNum = (hasFigureMeta ? clone.figure.pageIndex : clone.pageIndex) + 1; // 1-based index
      const box = hasFigureMeta ? clone.figure.boundingBox : clone.boundingBox;

      try {
        const cropDataUrl = await cropPdfRegion(pdfDocProxy, pageNum, box, true, 2.5);
        if (hasFigureMeta) {
          clone.figure = {
            ...clone.figure,
            imageUrl: cropDataUrl
          };
        } else {
          clone.figureUrl = cropDataUrl;
          clone.imageUrl = cropDataUrl;
        }
      } catch (cropErr) {
        console.warn(`[AutoCrop] Échec de rognage pour l'élément (Page ${pageNum}) :`, cropErr);
      }
    }

    // Traiter les sous-questions récursives si existantes
    if (Array.isArray(clone.questions)) {
      clone.questions = await autoCropFiguresFromPdf(clone.questions, pdfDocProxy);
    }
    if (Array.isArray(clone.sub_questions)) {
      clone.sub_questions = await autoCropFiguresFromPdf(clone.sub_questions, pdfDocProxy);
    }

    processed.push(clone);
  }

  return processed;
}
