// src/utils/aiFigureEnhancer.js
// Moteur intelligent de régénération et d'amélioration ultra-haute résolution pour figures mathématiques
// Spécifiquement optimisé pour le programme marocain (Lycée: Tronc Commun, 1BAC, 2BAC - SM, PC, SVT, Éco)

/**
 * Convertit une chaîne SVG en Data URL PNG haute résolution via HTML5 Canvas.
 * @param {string} svgString Code SVG complet
 * @param {number} scale Facteur d'échelle pour rendu Retina / 300+ DPI (défaut: 2.5)
 * @returns {Promise<string>} Data URL image/png
 */
export function svgToPngDataUrl(svgString, scale = 2.5) {
  return new Promise((resolve, reject) => {
    try {
      // Nettoyer et valider le SVG
      let cleanSvg = svgString.trim();
      if (!cleanSvg.includes('xmlns=')) {
        cleanSvg = cleanSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      // Parser les dimensions du SVG
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanSvg, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) throw new Error('Format SVG invalide');

      let width = parseFloat(svgEl.getAttribute('width')) || 800;
      let height = parseFloat(svgEl.getAttribute('height')) || 600;

      const viewBox = svgEl.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          width = parts[2];
          height = parts[3];
        }
      }

      const img = new Image();
      const svgBlob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');

        // Fond blanc pur pour impression et lecture
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png', 0.98));
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        // Fallback: retourner le SVG en data URL directement
        const encoded = encodeURIComponent(cleanSvg);
        resolve(`data:image/svg+xml;utf8,${encoded}`);
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Nettoie et extrait le bloc SVG pur à partir d'une réponse textuelle IA.
 * @param {string} rawText 
 * @returns {string|null}
 */
export function extractCleanSvg(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Chercher un bloc ```xml ou ```svg
  const codeBlockMatch = rawText.match(/```(?:xml|svg)?\s*([\s\S]*?)\s*```/i);
  let svgContent = codeBlockMatch ? codeBlockMatch[1] : rawText;

  // 2. Extraire la balise <svg ... </svg>
  const startIdx = svgContent.indexOf('<svg');
  const endIdx = svgContent.lastIndexOf('</svg>');

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    let clean = svgContent.substring(startIdx, endIdx + 6).trim();
    if (!clean.includes('xmlns=')) {
      clean = clean.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return clean;
  }

  return null;
}

/**
 * Filtre avancé d'amélioration et de super-résolution pour figures mathématiques (Canvas pur).
 * Idéal pour supprimer le fond grisâtre/jaunâtre des PDF scannés, contraster les courbes et rendre les textes nets.
 * 
 * @param {string} imageSrc Data URL ou URL de l'image source
 * @param {object} options
 * @param {number} options.whiteningThreshold Seuil de blanchiment du fond (0-255, défaut 210)
 * @param {number} options.contrast Contraste de l'encre mathématique (1.0 - 2.5, défaut 1.45)
 * @param {number} options.sharpness Netteté des contours de courbes (0.0 - 1.0, défaut 0.6)
 * @param {number} options.upscale Échelle d'upscaling (1.5 - 4.0, défaut 2.5)
 * @returns {Promise<{ dataUrl: string, width: number, height: number }>}
 */
export function enhanceMathLineArt(imageSrc, options = {}) {
  const {
    whiteningThreshold = 210,
    contrast = 1.45,
    sharpness = 0.55,
    upscale = 2.5
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        // Dimensions cibles après super-résolution
        const targetW = Math.round(origW * upscale);
        const targetH = Math.round(origH * upscale);

        // 1. Étape 1 : Dessin initial agrandi avec interpolation de haute qualité
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // 2. Étape 2 : Traitement par pixel (Purification du fond et contraste de l'encre)
        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const data = imgData.data;
        const len = data.length;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Luminance perçue
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // Saturation approximative
          const maxChannel = Math.max(r, g, b);
          const minChannel = Math.min(r, g, b);
          const sat = maxChannel - minChannel;

          // A. Si c'est le fond de la feuille (gris clair, beige, bruit de scanneur)
          if (lum >= whiteningThreshold && sat < 35) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          } else if (lum > whiteningThreshold - 25 && sat < 30) {
            // Zone de transition douce vers le blanc pur
            const factor = (lum - (whiteningThreshold - 25)) / 25;
            data[i] = Math.round(r + (255 - r) * factor);
            data[i + 1] = Math.round(g + (255 - g) * factor);
            data[i + 2] = Math.round(b + (255 - b) * factor);
          } else {
            // B. Encre mathématique (courbes, axes, chiffres, graduations)
            // Accentuer le contraste pour rendre les lignes franches et nettes
            const factor = contrast;
            data[i] = Math.max(0, Math.min(255, Math.round((r - 128) * factor + 128)));
            data[i + 1] = Math.max(0, Math.min(255, Math.round((g - 128) * factor + 128)));
            data[i + 2] = Math.max(0, Math.min(255, Math.round((b - 128) * factor + 128)));
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // 3. Étape 3 : Filtre de netteté (Unsharp Masking convolution) si activé
        if (sharpness > 0.05) {
          const sharpCanvas = document.createElement('canvas');
          sharpCanvas.width = targetW;
          sharpCanvas.height = targetH;
          const sharpCtx = sharpCanvas.getContext('2d');

          const srcData = ctx.getImageData(0, 0, targetW, targetH);
          const dstData = sharpCtx.createImageData(targetW, targetH);
          const src = srcData.data;
          const dst = dstData.data;

          const amount = sharpness * 0.8;
          // Kernel laplacien 3x3 pour netteté des contours de courbes
          for (let y = 1; y < targetH - 1; y++) {
            for (let x = 1; x < targetW - 1; x++) {
              const idx = (y * targetW + x) * 4;

              for (let c = 0; c < 3; c++) {
                const center = src[idx + c];
                const up     = src[((y - 1) * targetW + x) * 4 + c];
                const down   = src[((y + 1) * targetW + x) * 4 + c];
                const left   = src[(y * targetW + (x - 1)) * 4 + c];
                const right  = src[(y * targetW + (x + 1)) * 4 + c];

                // Formule de convolution
                const sharpVal = center + amount * (center * 4 - up - down - left - right);
                dst[idx + c] = Math.max(0, Math.min(255, Math.round(sharpVal)));
              }
              dst[idx + 3] = src[idx + 3]; // Alpha inchangé
            }
          }

          sharpCtx.putImageData(dstData, 0, 0);
          resolve({
            dataUrl: sharpCanvas.toDataURL('image/png', 0.96),
            width: targetW,
            height: targetH
          });
        } else {
          resolve({
            dataUrl: canvas.toDataURL('image/png', 0.96),
            width: targetW,
            height: targetH
          });
        }
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(new Error("Impossible de charger l'image source pour l'amélioration"));
    img.src = imageSrc;
  });
}

/**
 * Régénère une figure mathématique en format SVG vectoriel pur et ultra-net via Gemini Vision.
 * Respecte à 100% les axes, les coordonnées, les asymptotes, les points clés et les conventions officielles marocaines.
 * 
 * @param {string} imageBase64OrDataUrl Image source en base64 ou data:image/...
 * @param {object} options
 * @param {string} options.apiKey Clé Gemini API (optionnelle si dans localStorage)
 * @param {string} options.customInstructions Consignes supplémentaires de l'enseignant
 * @param {string} options.caption Titre ou légende de la figure
 * @param {function} options.onStatusUpdate Callback de progression pour l'interface
 * @returns {Promise<{ svg: string, pngDataUrl: string }>}
 */
export async function regenerateMathFigureWithAI(imageBase64OrDataUrl, options = {}) {
  const {
    apiKey = (localStorage.getItem('geminiApiKey') || localStorage.getItem('gemini_api_key') || '').trim(),
    customInstructions = '',
    caption = '',
    onStatusUpdate = () => {}
  } = options;

  if (!apiKey) {
    throw new Error("Clé API Gemini introuvable. Veuillez renseigner votre clé Gemini dans les Paramètres (Admin Settings).");
  }

  // Extraire la chaîne pure base64 et le type MIME
  let mimeType = 'image/png';
  let base64Data = imageBase64OrDataUrl;

  if (imageBase64OrDataUrl.startsWith('data:')) {
    const parts = imageBase64OrDataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch) mimeType = mimeMatch[1];
    base64Data = parts[1];
  }

  onStatusUpdate('فحص المعلم والمكونات الرياضية للشكل (Analyse des axes et composantes mathématiques)...');

  const systemPrompt = `Tu es un Expert Pédagogique et Concepteur Graphique de référence en Mathématiques pour l'enseignement secondaire marocain (Lycée : Tronc Commun, 1BAC, 2BAC Sciences Maths, PC, SVT).
Ta mission est d'analyser minutieusement l'image fournie (qui peut être une capture scannée d'un examen, d'un cours ou d'un devoir) et de la RECONSTRUIRE INTÉGRALEMENT sous forme de code SVG vectoriel d'une pureté géométrique et mathématique ABSOLUE.

RÈGLES MATHÉMATIQUES FONDAMENTALES :
1. RESPECT RIGOUROUX DU REPERE ET DES COORDONNÉES :
   - Si la figure contient un repère orthonormé (O, i, j) ou orthogonal :
   - Détecte l'intervalle exact des abscisses [xmin, xmax] et des ordonnées [ymin, ymax].
   - Trace l'axe horizontal (Ox) et vertical (Oy) parfaitement droits avec des flèches nettes (<marker>) au bout.
   - Marque l'origine 'O' clairement ainsi que les vecteurs unitaires ou graduations régulières (ex: -3, -2, -1, 1, 2, 3...).
   - Si un quadrillage (grid) existe, trace-le avec des traits très fins et discrets (#e2e8f0 ou #f1f5f9).

2. FIDÉLITÉ STRICTE DES COURBES DE FONCTIONS (Cf, Cg) :
   - Reproduis la courbe mathématique avec une trajectoire parfaitement lisse en utilisant des chemins SVG Bézier cubiques (<path d="M... C... S...">).
   - RESPECTE SCRUPULEUSEMENT :
     * Les extrema locaux (maximums, minimums) aux abscisses et ordonnées exactes du schéma d'origine.
     * Les asymptotes (verticale x=a, horizontale y=b, oblique y=ax+b) tracées en lignes discontinues nettes (stroke-dasharray="6,4") et étiquetées.
     * Les tangentes et demi-tangentes (flèches horizontales ou obliques aux points remarquables).
     * Les points d'inflexion et les intersections avec les axes tracés avec des points distincts (<circle r="3.5">) et des projections en pointillés vers les axes.
     * Le nom de la courbe (ex: '(Cf)', '(Cg)', '(D)').

3. FIGURES GÉOMÉTRIQUES & SCHÉMAS :
   - Si la figure représente un triangle, cercle trigonométrique, solide, arbre de probabilités ou tableau :
   - Trace des lignes rigoureusement droites, des angles droits nets (<polyline>), des arcs d'angles précis et des lettres de sommets (A, B, C, D...) parfaitement lisibles.

4. DESIGN ET ESTHÉTIQUE VISUELLE :
   - Dimensions SVG recommandées : viewBox="0 0 800 600" ou adapté au ratio de l'image.
   - Fond obligatoire : Blanc pur (#ffffff).
   - Palette de couleurs officielle :
     * Courbe principale (Cf) : Bleu roi (#0284c7 ou #2563eb) ou Marine (#005086) avec stroke-width="2.6"
     * Asymptotes / Tangentes : Rouge cramoisi (#dc2626) ou Violet (#7c3aed)
     * Axes et graduations : Gris ardoise foncé (#1e293b) avec stroke-width="1.6"
     * Lignes de projection : Gris moyen en pointillés (#64748b, stroke-dasharray="4,4")
     * Textes et symboles : Font-family standard propre (system-ui, -apple-system, sans-serif) en gras ou semi-bold.

FORMAT DE SORTIE EXCLUSIF :
Renvoie UNIQUEMENT le bloc SVG complet débutant par <svg viewBox="..." xmlns="http://www.w3.org/2000/svg"> et se terminant par </svg>.
Aucun commentaire, aucune balise Markdown autour du code SVG.`;

  const userPrompt = `Voici la figure mathématique d'origine${caption ? ` (Légende : "${caption}")` : ''}.
${customInstructions ? `Instructions spéciales de l'enseignant : ${customInstructions}\n` : ''}
Régénère cette figure avec une fidélité mathématique totale en code SVG pur, ultra-net, sans aucun flou ni déformation.`;

  onStatusUpdate('توليد الشكل الهندسي المتجهي فائق الدقة بالذكاء الاصطناعي (Génération vectorielle SVG)...');

  // Modèles candidats de Gemini supportant la vision multimodale
  const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      let generatedText = '';
      if (apiKey && apiKey.trim()) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: userPrompt },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: 0.1,
              topK: 32,
              topP: 0.95,
              maxOutputTokens: 8192
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const candidate = data?.candidates?.[0];
          const nonThoughtParts = candidate?.content?.parts?.filter(p => !p.thought) || [];
          generatedText = (nonThoughtParts.length > 0 ? nonThoughtParts : (candidate?.content?.parts || []))
            .map(p => p.text || '')
            .join('');
        }
      }

      // Proxy fallback
      if (!generatedText) {
        const proxyRes = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            apiKey: apiKey || undefined,
            contents: [
              {
                parts: [
                  { text: userPrompt },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192
            }
          })
        });
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          const candidate = proxyData?.data?.candidates?.[0];
          const nonThoughtParts = candidate?.content?.parts?.filter(p => !p.thought) || [];
          generatedText = (nonThoughtParts.length > 0 ? nonThoughtParts : (candidate?.content?.parts || []))
            .map(p => p.text || '')
            .join('');
        }
      }

      const cleanSvg = extractCleanSvg(generatedText);
      if (cleanSvg) {
        onStatusUpdate('تحويل الرسم المتجهي إلى صورة فائقة الدقة (Conversion en PNG 300+ DPI)...');
        const pngDataUrl = await svgToPngDataUrl(cleanSvg, 2.5);
        return {
          svg: cleanSvg,
          pngDataUrl: pngDataUrl
        };
      }
    } catch (err) {
      console.warn(`[AI Figure Enhancer] Gemini model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`Échec de la régénération vectorielle IA: ${lastError?.message || "Impossible de générer le SVG"}`);
}
