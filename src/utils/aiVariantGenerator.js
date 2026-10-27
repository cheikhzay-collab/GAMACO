// src/utils/aiVariantGenerator.js
// Générateur de Modèles Parallèles & Équivalents Anti-Triche (Modèle A / Modèle B)
// Conçu selon les Orientations Pédagogiques Officielles Marocaines pour les devoirs surveillés et examens.

import { normalizeLevel, getLevelDisplayName } from './levelHelpers';

/**
 * Mélange aléatoirement un tableau
 */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Normalise les options d'une question en tableau d'objets { id, text }
 */
function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((opt, idx) => {
    if (typeof opt === 'string') {
      return { id: String.fromCharCode(65 + idx), text: opt };
    }
    return {
      id: opt.id || String.fromCharCode(65 + idx),
      text: opt.text || ''
    };
  });
}

/**
 * 1. Mode Rapide & Fiable : Permutation Intelligente (Smart Shuffle)
 * Permute l'ordre des options et/ou des questions tout en conservant la correspondance exacte
 * des réponses correctes et de la clé de correction OMR.
 */
export function generateSmartShuffleVariant(questions, examMetadata = {}, options = {}) {
  if (!questions || questions.length === 0) {
    throw new Error('Aucune question disponible pour générer le Modèle B.');
  }

  const {
    shuffleQuestions = true,
    shuffleChoices = true,
    preserveContextGrouping = true
  } = options;

  let baseList = questions.map((q, idx) => ({ ...q, _originalIdx: idx }));

  // Si on mélange l'ordre des questions en respectant le regroupement par contexte
  if (shuffleQuestions) {
    if (preserveContextGrouping) {
      // Regroupe par contexte
      const groups = [];
      const visited = new Set();

      baseList.forEach((q, idx) => {
        if (visited.has(idx)) return;
        if (q.context && q.context.trim()) {
          const group = baseList.filter((item, i) => item.context === q.context);
          group.forEach(item => visited.add(baseList.indexOf(item)));
          groups.push(group);
        } else {
          visited.add(idx);
          groups.push([q]);
        }
      });

      const shuffledGroups = shuffleArray(groups);
      baseList = shuffledGroups.flat();
    } else {
      baseList = shuffleArray(baseList);
    }
  }

  const resultQuestions = baseList.map((q, qIdx) => {
    const normOpts = normalizeOptions(q.options);
    const origExpected = (q.correct_answer || q.expected_answer || 'A').toUpperCase().trim();

    // Trouver le texte de la bonne réponse
    let correctText = '';
    const match = normOpts.find(o => o.id.toUpperCase() === origExpected);
    if (match) {
      correctText = match.text;
    } else if (normOpts.length > 0) {
      const idxFromLetter = origExpected.charCodeAt(0) - 65;
      correctText = normOpts[idxFromLetter]?.text || normOpts[0].text;
    }

    let finalOptions = normOpts;
    let newExpected = origExpected;

    if (shuffleChoices && normOpts.length > 1) {
      const shuffled = shuffleArray(normOpts);
      let foundNewLetter = 'A';

      finalOptions = shuffled.map((opt, optIndex) => {
        const letter = String.fromCharCode(65 + optIndex);
        if (opt.text === correctText) {
          foundNewLetter = letter;
        }
        return {
          id: letter,
          text: opt.text
        };
      });

      newExpected = foundNewLetter;
    }

    return {
      ...q,
      id: `q_b_${Date.now()}_${qIdx}`,
      question_idx: qIdx + 1,
      options: finalOptions,
      correct_answer: newExpected,
      expected_answer: newExpected,
      variant: 'B',
      _sourceQuestionIdx: q._originalIdx + 1
    };
  });

  return {
    questions: resultQuestions,
    variantType: 'shuffle',
    variantName: 'Modèle B (Permutation Anti-Triche)',
    dateGenerated: new Date().toISOString()
  };
}

/**
 * 2. Mode Avancé : Isomorphisme Mathématique IA (Deep Variant)
 * Fait appel aux modèles IA (DeepSeek / Gemini / Claude) pour concevoir des variations
 * mathématiques isomorphes (mêmes compétences, même difficulté, équations/paramètres modifiés).
 */
export async function generateIsomorphicAiVariant(questions, examMetadata = {}, onProgress = null) {
  if (!questions || questions.length === 0) {
    throw new Error('Aucune question fournie.');
  }

  const deepseekKey = (localStorage.getItem('deepseekApiKey') || localStorage.getItem('deepseek_api_key') || '').trim();
  const deepseekUrl = (localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com').trim().replace(/\/$/, '');
  const geminiKey = (localStorage.getItem('geminiApiKey') || localStorage.getItem('gemini_api_key') || '').trim();
  const claudeKey = (localStorage.getItem('claudeApiKey') || '').trim();

  const availableEngines = [];
  if (deepseekKey) availableEngines.push('deepseek');
  if (geminiKey) availableEngines.push('gemini');
  if (claudeKey) availableEngines.push('claude');

  if (availableEngines.length === 0) {
    throw new Error('Aucune clé API configurée (DeepSeek, Gemini ou Claude). Veuillez configurer votre clé dans les Paramètres.');
  }

  const level = examMetadata.level || '2bac_pc_svt';
  const levelDisplay = getLevelDisplayName(level);
  const subject = examMetadata.subject || 'Mathématiques';

  if (onProgress) onProgress({ status: 'analyzing', message: 'Préparation du prompt d’inspection pédagogique...' });

  // Échantillonnage / traitement par lots de 5 questions max pour éviter les coupures de contexte
  const batchSize = 5;
  const batches = [];
  for (let i = 0; i < questions.length; i += batchSize) {
    batches.push(questions.slice(i, i + batchSize));
  }

  const allGeneratedQuestions = [];

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const startIndex = b * batchSize;

    if (onProgress) {
      onProgress({
        status: 'generating',
        currentBatch: b + 1,
        totalBatches: batches.length,
        message: `Génération IA du Modèle B : questions ${startIndex + 1} à ${startIndex + batch.length} sur ${questions.length}...`
      });
    }

    const systemPrompt = `Tu es un Inspecteur Pédagogique National de Mathématiques au Maroc et un Concepteur Principal des épreuves de devoirs surveillés et du Baccalauréat marocain (BIOF et Arabe).

MISSION :
Tu reçois une série de questions du "MODÈLE A". Tu dois concevoir une version rigoureusement ISOMORPHE pour le "MODÈLE B (Anti-triche)".

RÈGLES PÉDAGOGIQUES OFFICIELLES STRICTES :
1. ISOMORPHISME TOTAL : Chaque question du Modèle B doit évaluer exactement la même capacité attendue du programme officiel marocain (${levelDisplay}).
2. CONSERVATION DE LA DIFFICULTÉ : Même niveau taxonomique (application directe, analyse, déduction). Ne rends pas la question ni plus facile ni intempestivement difficile.
3. MODIFICATION DES PARAMÈTRES :
   - Modifie les valeurs numériques, coefficients, constantes, ou fonctions de base (ex: $2x+1 \\to 3x-2$, $e^{2x} \\to e^{3x}$, $\\ln(x+1) \\to \\ln(x+2)$, suites arithmético-géométriques avec coefficients modifiés mais convergents).
   - Veille scrupuleusement à ce que les calculs restent simples, élégants et sans fractions ingérables.
4. CALCUL ET VÉRIFICATION FORMELLE DES OPTIONS :
   - Calcule formellement la réponse exacte.
   - Génère 4 ou 5 options (A, B, C, D, E) avec UNE SEULE réponse rigoureusement vraie.
   - Crée des distracteurs plausibles (erreurs classiques de signe, oubli de valeur absolue, dérivation incorrecte).
   - Indique la lettre exacte dans "correct_answer".
5. LaTeX OBLIGATOIRE : Toutes les expressions mathématiques doivent être en syntaxe LaTeX valide entourée par des dollars simples (ex: $f(x) = \\sqrt{x^2+1}$).

FORMAT DE RÉPONSE STRICT (JSON UNIQUEMENT, AUCUN TEXTE AUTOUR) :
{
  "questions": [
    {
      "index": 1,
      "question": "Énoncé de la question isomorphe en français...",
      "context": "Contexte commun si applicable, sinon chaîne vide",
      "options": [
        { "id": "A", "text": "Option A en LaTeX..." },
        { "id": "B", "text": "Option B en LaTeX..." },
        { "id": "C", "text": "Option C en LaTeX..." },
        { "id": "D", "text": "Option D en LaTeX..." }
      ],
      "correct_answer": "C",
      "astuce": "Méthode succincte et justification formelle...",
      "trick": "Remarque d'astuce rapide pour concours/examen...",
      "topic": "Nom du chapitre/domaine"
    }
  ]
}`;

    const userPrompt = `Voici les questions sources du MODÈLE A (lot ${b + 1}/${batches.length}) :
${JSON.stringify(batch.map((q, idx) => ({
      index: startIndex + idx + 1,
      question: q.question,
      context: q.context || '',
      options: (q.options || []).map((o, oi) => typeof o === 'string' ? { id: String.fromCharCode(65 + oi), text: o } : o),
      correct_answer: q.correct_answer || q.expected_answer || 'A',
      topic: q.topic || q.subject || ''
    })), null, 2)}

Génère le JSON strict contenant la liste des questions équivalentes pour le MODÈLE B.`;

    let generatedBatch = null;

    // 1. Essai DeepSeek
    if (availableEngines.includes('deepseek')) {
      try {
        const response = await fetch(`${deepseekUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepseekKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 4000
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
              generatedBatch = parsed.questions;
            }
          }
        }
      } catch (err) {
        console.warn('[AI Variant] DeepSeek batch failed, trying fallback...', err.message);
      }
    }

    // 2. Essai Gemini si DeepSeek non disponible ou échoué
    if (!generatedBatch && availableEngines.includes('gemini')) {
      const storedModel = (localStorage.getItem('geminiModel') || '').trim();
      const preferredModel = (storedModel && !storedModel.includes('3.') && !storedModel.includes('2.5') && !storedModel.includes('3.6')) ? storedModel : 'gemini-2.0-flash';
      const modelsToTry = [preferredModel, 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];

      for (const model of modelsToTry) {
        if (generatedBatch) break;
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userPrompt }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json'
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const candidate = data?.candidates?.[0];
            const nonThoughtParts = candidate?.content?.parts?.filter(p => !p.thought) || [];
            const text = (nonThoughtParts.length > 0 ? nonThoughtParts : (candidate?.content?.parts || []))
              .map(p => p.text || '')
              .join('');
            if (text) {
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                generatedBatch = parsed.questions;
              }
            }
          }
        } catch (err) {
          console.warn(`[AI Variant] Gemini (${model}) batch failed:`, err.message);
        }
      }
    }

    // 3. Essai Claude si toujours pas résolu
    if (!generatedBatch && availableEngines.includes('claude')) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01',
            'dangerously-allow-browser': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            max_tokens: 4000,
            temperature: 0.2
          })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data?.content?.[0]?.text;
          if (text) {
            const cleanJson = text.replace(/```json\s*|```\s*$/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
              generatedBatch = parsed.questions;
            }
          }
        }
      } catch (err) {
        console.warn('[AI Variant] Claude batch failed:', err.message);
      }
    }

    // En cas d'échec pour ce lot, repli sur le smart shuffle local pour ce lot
    if (!generatedBatch || generatedBatch.length === 0) {
      console.warn(`[AI Variant] Lot ${b + 1} échoué via IA, application du mode permutation sécurisé.`);
      const fallbackShuffle = generateSmartShuffleVariant(batch, examMetadata);
      generatedBatch = fallbackShuffle.questions;
    }

    // Harmonisation et rattachement des métadonnées
    generatedBatch.forEach((genQ, qLocalIdx) => {
      const origQ = batch[qLocalIdx] || {};
      const globalIdx = startIndex + qLocalIdx;
      allGeneratedQuestions.push({
        id: `q_b_iso_${Date.now()}_${globalIdx}`,
        question_idx: globalIdx + 1,
        question: genQ.question || origQ.question,
        context: genQ.context || origQ.context || '',
        options: normalizeOptions(genQ.options && genQ.options.length > 0 ? genQ.options : origQ.options),
        correct_answer: (genQ.correct_answer || 'A').toUpperCase().trim(),
        expected_answer: (genQ.correct_answer || 'A').toUpperCase().trim(),
        topic: genQ.topic || origQ.topic || origQ.subject || 'Général',
        subject: origQ.subject || 'Mathématiques',
        astuce: genQ.astuce || origQ.astuce || '',
        trick: genQ.trick || origQ.trick || '',
        image: origQ.image || null,
        imagePosition: origQ.imagePosition || 'below_statement',
        imageSize: origQ.imageSize || 'medium',
        imageBg: origQ.imageBg || 'transparent',
        variant: 'B',
        _sourceQuestionIdx: globalIdx + 1
      });
    });
  }

  if (onProgress) onProgress({ status: 'done', message: 'Génération du Modèle B terminée avec succès !' });

  return {
    questions: allGeneratedQuestions,
    variantType: 'isomorphic_ai',
    variantName: 'Modèle B (Isomorphe IA)',
    dateGenerated: new Date().toISOString()
  };
}
