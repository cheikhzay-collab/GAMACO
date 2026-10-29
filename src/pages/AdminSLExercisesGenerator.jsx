// src/pages/AdminSLExercisesGenerator.jsx
// Générateur de séries d'exercices — Licence Mathématiques Appliquées (Maroc)
// Langue : Français uniquement | Gemini API + KaTeX + PDF avec / sans corrigé

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, PenLine, Sparkles, Save, Copy, Printer,
  CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff,
  Flame, Compass, Sliders, Award, Loader2
} from 'lucide-react';
import { renderToHtmlString } from '../utils/mathRenderer';
import { saveSelfLearningNote } from '../services/selfLearningService';

// ─── Programme officiel — Licence Mathématiques Appliquées — Maroc ───────────
const MA_CURRICULA = {
  S1: {
    label: 'Semestre 1 — Tronc Commun',
    modules: [
      {
        id: 'S1_analyse1', name: 'Analyse 1',
        topics: [
          'Logique mathématique et raisonnement',
          'Nombres réels — Construction et propriétés',
          'Suites numériques — Convergence et divergence',
          'Limites et continuité des fonctions',
          'Dérivation et règle de L\'Hôpital',
          'Étude de fonctions et représentation graphique',
          'Formules de Taylor et Maclaurin',
          'Développements limités — Applications',
        ]
      },
      {
        id: 'S1_algebre1', name: 'Algèbre 1',
        topics: [
          'Ensembles, relations et applications',
          'Arithmétique dans Z (PGCD, PPCM, Bézout, Gauss)',
          'Congruences et arithmétique modulaire',
          'Nombres complexes — Forme algébrique et trigonométrique',
          'Polynômes — Divisibilité et racines',
          'Fractions rationnelles',
        ]
      },
      {
        id: 'S1_algo1', name: 'Algorithmique & Programmation 1',
        topics: [
          'Complexité algorithmique',
          'Structures de contrôle (conditions, boucles)',
          'Tableaux et matrices',
          'Fonctions et récursivité',
          'Algorithmes de tri (bulle, insertion, sélection)',
        ]
      },
    ]
  },
  S2: {
    label: 'Semestre 2 — Tronc Commun',
    modules: [
      {
        id: 'S2_analyse2', name: 'Analyse 2',
        topics: [
          'Intégration de Riemann — Définition et propriétés',
          'Primitives et théorème fondamental du calcul intégral',
          'Intégration par parties et changement de variable',
          'Intégrales des fractions rationnelles et trigonométriques',
          'Intégrales impropres — Convergence et critères',
          'Séries numériques — Critères de convergence',
          'Séries alternées et absolument convergentes',
        ]
      },
      {
        id: 'S2_algebre2', name: 'Algèbre Linéaire',
        topics: [
          'Espaces vectoriels — Définition et exemples',
          'Sous-espaces, familles libres, bases, dimension',
          'Applications linéaires — Noyau et image',
          'Matrices — Opérations et rang',
          'Déterminants — Calcul et propriétés',
          'Systèmes linéaires — Méthode de Gauss-Jordan',
          'Valeurs propres, vecteurs propres, diagonalisation',
        ]
      },
      {
        id: 'S2_proba1', name: 'Probabilités & Statistiques 1',
        topics: [
          'Espaces de probabilité — Axiomes de Kolmogorov',
          'Probabilité conditionnelle et théorème de Bayes',
          'Variables aléatoires discrètes',
          'Lois classiques : Bernoulli, binomiale, Poisson',
          'Variables aléatoires continues : uniforme, exponentielle',
          'Loi normale et centrage réduction',
          'Espérance, variance, écart-type',
        ]
      },
    ]
  },
  S3: {
    label: 'Semestre 3 — Spécialisation',
    modules: [
      {
        id: 'S3_analyse3', name: 'Analyse 3',
        topics: [
          'Séries de fonctions — Convergence simple et uniforme',
          'Séries entières — Rayon de convergence',
          'Séries de Fourier — Coefficients et convergence',
          'Transformée de Fourier — Propriétés et applications',
          'Équations différentielles du 1er ordre',
          'EDO linéaires du 2nd ordre à coefficients constants',
          'Systèmes d\'équations différentielles',
        ]
      },
      {
        id: 'S3_analyse_num1', name: 'Analyse Numérique 1',
        topics: [
          'Erreurs d\'arrondi et arithmétique flottante',
          'Méthodes de résolution d\'équations non linéaires (Dichotomie, Newton, Sécante)',
          'Interpolation de Lagrange et de Newton',
          'Interpolation par splines cubiques',
          'Intégration numérique — Rectangles, trapèzes, Simpson',
          'Formules de quadrature de Gauss',
          'Résolution de systèmes linéaires — Décomposition LU',
          'Méthodes itératives : Jacobi, Gauss-Seidel',
        ]
      },
      {
        id: 'S3_proba2', name: 'Probabilités & Statistiques 2',
        topics: [
          'Vecteurs aléatoires — Lois jointes et marginales',
          'Covariance et corrélation',
          'Lois conditionnelles et espérance conditionnelle',
          'Loi des grands nombres et théorème central limite',
          'Estimation ponctuelle — Maximum de vraisemblance',
          'Intervalles de confiance',
          'Tests d\'hypothèses paramétriques',
        ]
      },
      {
        id: 'S3_structures', name: 'Structures Algébriques',
        topics: [
          'Groupes — Définition, sous-groupes, quotients',
          'Théorème de Lagrange et groupes cycliques',
          'Homomorphismes et isomorphismes de groupes',
          'Anneaux et idéaux',
          'Anneaux factoriels et euclidiens',
          'Corps — Extensions algébriques',
        ]
      },
    ]
  },
  S4: {
    label: 'Semestre 4 — Spécialisation',
    modules: [
      {
        id: 'S4_analyse4', name: 'Analyse Complexe',
        topics: [
          'Fonctions holomorphes et équations de Cauchy-Riemann',
          'Séries de Laurent',
          'Théorème de Cauchy et conséquences',
          'Pôles, résidus et calcul d\'intégrales réelles',
          'Transformée de Laplace — Définition et propriétés',
          'Transformée de Laplace inverse',
          'Application aux équations différentielles',
        ]
      },
      {
        id: 'S4_analyse_num2', name: 'Analyse Numérique 2',
        topics: [
          'Valeurs propres — Méthode de la puissance itérée',
          'Décomposition QR et méthode de Householder',
          'Résolution d\'EDO — Méthodes d\'Euler (explicite et implicite)',
          'Méthodes de Runge-Kutta (RK2, RK4)',
          'Méthodes multi-pas (Adams-Bashforth)',
          'Analyse de stabilité des schémas numériques',
        ]
      },
      {
        id: 'S4_ro1', name: 'Recherche Opérationnelle 1',
        topics: [
          'Modélisation en programmation linéaire',
          'Méthode du simplexe — Phase 1 et Phase 2',
          'Dualité et théorème des écarts complémentaires',
          'Analyse de sensibilité',
          'Problème de transport — Méthode Nord-Ouest, MODI',
          'Problème d\'affectation — Méthode hongroise',
        ]
      },
      {
        id: 'S4_topologie', name: 'Topologie',
        topics: [
          'Espaces métriques — Définitions et exemples',
          'Ouverts, fermés, adhérence, intérieur',
          'Continuité dans les espaces métriques',
          'Compacité — Théorème de Bolzano-Weierstrass',
          'Connexité et connexité par arcs',
          'Théorème du point fixe de Banach',
        ]
      },
    ]
  },
  S5: {
    label: 'Semestre 5 — Spécialisation Avancée',
    modules: [
      {
        id: 'S5_optimisation', name: 'Optimisation',
        topics: [
          'Optimisation sans contraintes — Conditions nécessaires et suffisantes',
          'Méthodes de descente : gradient, gradient conjugué',
          'Méthode de Newton et quasi-Newton (BFGS)',
          'Optimisation sous contraintes — Conditions KKT',
          'Multiplicateurs de Lagrange',
          'Programmation quadratique',
          'Méthodes de pénalité et barrière',
        ]
      },
      {
        id: 'S5_edp', name: 'Équations aux Dérivées Partielles',
        topics: [
          'Classification des EDP (elliptiques, paraboliques, hyperboliques)',
          'Équation de la chaleur — Séparation des variables',
          'Équation des ondes',
          'Équation de Laplace et de Poisson',
          'Conditions aux limites (Dirichlet, Neumann, Robin)',
          'Méthode des différences finies pour les EDP',
        ]
      },
      {
        id: 'S5_ro2', name: 'Recherche Opérationnelle 2',
        topics: [
          'Théorie des graphes — Représentation et parcours (BFS, DFS)',
          'Arbres couvrants minimaux (Kruskal, Prim)',
          'Plus courts chemins (Dijkstra, Bellman-Ford, Floyd-Warshall)',
          'Flots dans les réseaux — Ford-Fulkerson',
          'Ordonnancement PERT/CPM',
          'Programmation dynamique — Principe de Bellman',
        ]
      },
      {
        id: 'S5_stats_avancees', name: 'Statistiques Multivariées',
        topics: [
          'Analyse en Composantes Principales (ACP)',
          'Analyse Factorielle des Correspondances (AFC)',
          'Analyse Discriminante Linéaire',
          'Régression linéaire multiple — MCO et diagnostics',
          'Régression logistique',
          'Séries temporelles — Modèles ARMA/ARIMA',
        ]
      },
    ]
  },
  S6: {
    label: 'Semestre 6 — Spécialisation Avancée',
    modules: [
      {
        id: 'S6_ml', name: 'Machine Learning & IA',
        topics: [
          'Apprentissage supervisé — K-NN, arbres de décision',
          'Machines à vecteurs de support (SVM)',
          'Réseaux de neurones — Perceptron multicouche',
          'Rétropropagation du gradient',
          'Apprentissage non supervisé — K-means, DBSCAN',
          'Validation croisée et sélection de modèle',
          'Régularisation (Ridge L2, Lasso L1)',
        ]
      },
      {
        id: 'S6_calcul_stochastique', name: 'Calcul Stochastique',
        topics: [
          'Processus stochastiques — Définitions et exemples',
          'Chaînes de Markov à temps discret',
          'Classification des états — Ergodicité',
          'Processus de Poisson',
          'Mouvement Brownien — Propriétés',
          'Intégrale de Itô et lemme de Itô',
          'Équations différentielles stochastiques (EDS)',
        ]
      },
      {
        id: 'S6_methodes_num_edp', name: 'Méthodes Numériques pour les EDP',
        topics: [
          'Différences finies — Schémas implicites et explicites',
          'Stabilité, consistance et convergence (condition CFL)',
          'Formulation variationnelle et éléments finis',
          'Méthode des volumes finis',
          'Résolution de systèmes creux',
        ]
      },
      {
        id: 'S6_analyse_fonctionnelle', name: 'Analyse Fonctionnelle',
        topics: [
          'Espaces normés et de Banach',
          'Espaces de Hilbert — Bases orthonormales',
          'Opérateurs linéaires bornés',
          'Théorème de Hahn-Banach',
          'Théorème du graphe fermé',
          'Opérateurs compacts',
          'Distributions et espaces de Sobolev',
        ]
      },
    ]
  },
};

// ─── Niveaux de difficulté ─────────────────────────────────────────────────────
const DIFFICULTIES = [
  { id: 'basic',    label: 'Basique',     icon: Compass, color: '#10B981', desc: 'Application directe des définitions' },
  { id: 'medium',   label: 'Intermédiaire',icon: Sliders, color: '#3B82F6', desc: 'Analyse et combinaison de concepts' },
  { id: 'advanced', label: 'Avancé',      icon: Flame,   color: '#F59E0B', desc: 'Raisonnement approfondi, preuves' },
  { id: 'exam',     label: 'Examen / Contrôle', icon: Award, color: '#EC4899', desc: 'Format contrôle continu / examen final' },
];

// ─── Types d'exercices ────────────────────────────────────────────────────────
const EX_TYPES = [
  { id: 'definitional', label: 'Définitionnel' },
  { id: 'proof',        label: 'Démonstration' },
  { id: 'applied',      label: 'Applicatif' },
  { id: 'numerical',    label: 'Calcul numérique' },
  { id: 'mixed',        label: 'Mixte' },
];

// ─── Extraction structurée de la réponse ──────────────────────────────────────
// ─── Extraction structurée de la réponse ──────────────────────────────────────
function extractExercises(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const exercises = [];

  // Normalise les sauts de ligne
  const cleanRaw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split sur les titres d'exercice (## Exercice N, ## Problème N, etc.)
  const blocks = cleanRaw.split(/(?=^##\s+(?:Exercice|Problème|TD|Question)\s*\d*)/im);

  blocks.forEach((block) => {
    const trimmed = block.trim();
    if (!trimmed || !trimmed.startsWith('##')) return; // Ignore le préambule / intro

    const titleMatch = trimmed.match(/^##\s+(?:Exercice|Problème|TD|Question)?\s*(\d*)\s*[:\-–]?\s*([^\n]+)?/i);
    const num = titleMatch?.[1] || `${exercises.length + 1}`;
    const restOfTitle = titleMatch?.[2]?.trim() || '';
    const title = restOfTitle ? `Exercice ${num} : ${restOfTitle}` : `Exercice ${num}`;

    // Supprime la première ligne (le titre ##)
    const bodyWithoutTitle = trimmed.replace(/^##[^\n]*\n?/, '').trim();

    // Sépare énoncé et corrigé
    const parts = bodyWithoutTitle.split(/^###\s*(?:Corrigé|Solution|Correction|Résolution)[^\n]*/im);
    const statement = parts[0]?.trim() || '';
    const solution = parts[1]?.trim() || '';

    if (statement || solution) {
      exercises.push({
        id: `ex-${exercises.length + 1}`,
        title,
        statement,
        solution,
      });
    }
  });

  if (exercises.length > 0) return exercises;
  // Fallback si aucun format standard n'a été détecté
  return [{ id: 'ex-1', title: 'Exercices générés', statement: raw.trim(), solution: '' }];
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function AdminSLExercisesGenerator({ onBack }) {
  const [semester,  setSemester]  = useState('S3');
  const [moduleId,  setModuleId]  = useState('');
  const [topic,     setTopic]     = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [count,     setCount]     = useState(3);
  const [difficulty,setDifficulty]= useState('medium');
  const [exTypes,   setExTypes]   = useState(['mixed']);
  const [withSol,   setWithSol]   = useState(true);

  const [geminiKey, setGeminiKey] = useState(
    () => (localStorage.getItem('geminiApiKey') || localStorage.getItem('gemini_api_key') || '').trim()
  );
  const [isGenerating, setIsGenerating]     = useState(false);
  const [progressMsg,  setProgressMsg]      = useState('');
  const [sheet,        setSheet]            = useState(null);
  const [errorMsg,     setErrorMsg]         = useState(null);
  const [savingStatus, setSavingStatus]     = useState(null);
  const [copyStatus,   setCopyStatus]       = useState(false);
  const [expandedSols, setExpandedSols]     = useState({});

  const currentSem = useMemo(() => MA_CURRICULA[semester] || MA_CURRICULA.S3, [semester]);

  useEffect(() => {
    if (currentSem.modules.length > 0) setModuleId(currentSem.modules[0].id);
  }, [semester]);

  const currentModule = useMemo(
    () => currentSem.modules.find(m => m.id === moduleId) || currentSem.modules[0],
    [currentSem, moduleId]
  );

  useEffect(() => {
    if (currentModule?.topics?.length) setTopic(currentModule.topics[0]);
  }, [currentModule]);

  useEffect(() => {
    if (!geminiKey) {
      fetch('/api/config').then(r => r.ok ? r.json() : null).then(cfg => {
        const k = cfg?.ai_settings?.geminiApiKey;
        if (k?.trim()) { setGeminiKey(k.trim()); localStorage.setItem('geminiApiKey', k.trim()); }
      }).catch(() => {});
    }
  }, []);

  const resolvedTopic = useCustom ? customTopic.trim() : topic;
  const moduleName = currentModule?.name || '';
  const diffObj = DIFFICULTIES.find(d => d.id === difficulty) || DIFFICULTIES[1];

  const toggleExType = (id) => {
    setExTypes(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(t => t !== id) : prev) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!resolvedTopic.trim()) { setErrorMsg('Veuillez sélectionner ou saisir un sujet.'); return; }
    if (!geminiKey) { setErrorMsg('Clé API Gemini introuvable. Ajoutez-la dans les Paramètres.'); return; }

    setIsGenerating(true); setErrorMsg(null); setSheet(null); setSavingStatus(null); setExpandedSols({});

    try {
      setProgressMsg('Génération des exercices…');

      const typesList = exTypes.map(t => EX_TYPES.find(e => e.id === t)?.label).join(', ');
      const solInstruction = withSol
        ? 'Pour CHAQUE exercice, fournis un corrigé complet et détaillé étape par étape sous une section "### Corrigé" située directement après l\'énoncé.'
        : 'Ne fournis PAS de corrigé.';

      const prompt = `Tu es Professeur de Mathématiques Appliquées dans une université marocaine (UM5 Rabat, UCA Marrakech, UAE Tétouan, etc.).

Rédige EXACTEMENT ${count} exercice(s) de niveau [${diffObj.label} : ${diffObj.desc}], portant sur le sujet "${resolvedTopic}" du module "${moduleName}" (${currentSem.label} — Licence Mathématiques Appliquées, Maroc).
Type(s) d'exercices souhaité(s) : [${typesList}].

${solInstruction}

RÈGLES IMPORTANTES DE RÉDACTION ET STRUCTURE :
1. NE commence JAMAIS par une introduction, un barème général, un sommaire ou un plan.
2. Commence DIRECTEMENT par la première ligne : "## Exercice 1 : [Titre précis]"
3. Pour CHAQUE exercice :
   - Rédige un énoncé complet et riche, avec des questions numérotées claires (1., 2. a) b)...).
   ${withSol ? '- Place IMMÉDIATEMENT dessous la section "### Corrigé" avec la résolution détaillée pas à pas de chaque question, AVANT d\'écrire le titre de l\'exercice suivant.' : ''}
4. RÈGLES LaTeX :
   - Inline : $...$ (ex: $x \\in \\mathbb{R}$, $E = \\mathbb{R}^n$)
   - Display : $$...$$ (ex: $$\\det(A) = \\sum...$$)
   - Utilise toujours la notation standard avec accolades : \\mathbb{R}, \\mathbb{N}, \\mathbb{Z}, \\mathbb{C}, \\mathbb{K}.
   - Ne mets pas d'antislash double : écris \\mathbb{R}, \\frac{a}{b}, \\sqrt{x}.`;

      const storedModel = (localStorage.getItem('geminiModel') || '').trim();
      let preferred = storedModel;
      if (!preferred || ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', '3.7', '3.5'].includes(preferred)) {
        preferred = 'gemini-2.0-flash';
      }
      const models = Array.from(new Set([preferred, 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash']));

      let rawText = null, lastErr = null;
      for (const model of models) {
        try {
          if (geminiKey && geminiKey.trim()) {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey.trim()}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.5, maxOutputTokens: 8192 }
                })
              }
            );
            if (res.ok) {
              const data = await res.json();
              const parts = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought);
              const text = parts.map(p => p.text || '').join('');
              if (text) { rawText = text; break; }
            }
          }
          // Server-side fallback proxy with GEMINI_API_KEY
          const proxyRes = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              apiKey: geminiKey || undefined,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 8192 }
            })
          });
          if (proxyRes.ok) {
            const proxyData = await proxyRes.json();
            const parts = (proxyData?.data?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought);
            const text = parts.map(p => p.text || '').join('');
            if (text) { rawText = text; break; }
          }
        } catch (e) { lastErr = e; }
      }

      if (!rawText) throw new Error(lastErr?.message || 'Connexion à l\'API Gemini échouée. Vérifiez votre clé.');

      setProgressMsg('Rendu des formules LaTeX…');
      const exercises = extractExercises(rawText);
      setSheet({ exercises, raw: rawText, topic: resolvedTopic, module: moduleName, semester });

    } catch (e) { setErrorMsg(e.message); }
    finally { setIsGenerating(false); setProgressMsg(''); }
  };

  const handleSave = async () => {
    if (!sheet) return;
    setSavingStatus('saving');
    try {
      await saveSelfLearningNote({
        type: 'exercises', cycle: semester, module: moduleName,
        topic: resolvedTopic, content: sheet.raw, language: 'fr', level: difficulty,
      });
      setSavingStatus('saved');
    } catch (e) { setSavingStatus(null); setErrorMsg('Erreur de sauvegarde : ' + e.message); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sheet?.raw || '').then(() => {
      setCopyStatus(true); setTimeout(() => setCopyStatus(false), 2000);
    });
  };

  const handlePrint = (avecCorrige = true) => {
    const exercises = sheet?.exercises || [];
    const body = exercises.map(ex => {
      let md = `## ${ex.title}\n\n${ex.statement}`;
      if (avecCorrige && ex.solution) md += `\n\n### Corrigé\n${ex.solution}`;
      return md;
    }).join('\n\n---\n\n');

    const bodyHtml = renderToHtmlString(body || '');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Série — ${resolvedTopic}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 810px; margin: 2rem auto; line-height: 1.85; color: #111; }
    h1 { font-size: 1.35rem; border-bottom: 2px solid #059669; padding-bottom: .5rem; }
    h2 { font-size: 1.05rem; color: #059669; border-left: 3px solid #059669; padding-left: .6rem; margin-top: 2rem; }
    h3 { font-size: .95rem; color: #7C3AED; margin-top: 1.2rem; }
    .meta { color: #666; font-size: .82rem; margin-bottom: 1.5rem; }
    hr { margin: 2rem 0; opacity: .15; }
    ul { padding-left: 1.4rem; }
    li { margin: .22rem 0; }
    .katex { font-size: 1.0em !important; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>📝 ${resolvedTopic}</h1>
  <p class="meta">${moduleName} — ${currentSem.label} — Licence Mathématiques Appliquées${avecCorrige ? '' : ' | <strong>Sans corrigé</strong>'}</p>
  ${bodyHtml}
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  const toggleSol = (id) => setExpandedSols(prev => ({ ...prev, [id]: !prev[id] }));
  const allOpen = sheet?.exercises?.length > 0 && sheet.exercises.every(ex => expandedSols[ex.id]);
  const toggleAll = () => {
    if (!sheet?.exercises) return;
    const next = {};
    if (!allOpen) sheet.exercises.forEach(ex => { next[ex.id] = true; });
    setExpandedSols(next);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '1060px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={onBack} style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex', color: 'var(--text-main)'
        }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #059669, #10B981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <PenLine size={20} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>
              Générateur de Séries d'Exercices
            </h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Licence Mathématiques Appliquées — Universités marocaines
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Formulaire ── */}
        <div className="card" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Semestre */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>🎓 Semestre</label>
            <select value={semester} onChange={e => setSemester(e.target.value)} className="input" style={{ width: '100%' }}>
              {Object.entries(MA_CURRICULA).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          {/* Module */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>📚 Module</label>
            <select value={moduleId} onChange={e => setModuleId(e.target.value)} className="input" style={{ width: '100%' }}>
              {currentSem.modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Sujet */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>📌 Sujet</label>
              <button onClick={() => setUseCustom(v => !v)}
                style={{ fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', color: '#059669', padding: 0 }}>
                {useCustom ? '← Liste' : '+ Sujet libre'}
              </button>
            </div>
            {useCustom
              ? <input type="text" value={customTopic} onChange={e => setCustomTopic(e.target.value)}
                  placeholder="Ex : Méthode de Newton-Raphson…" className="input" style={{ width: '100%' }} />
              : <select value={topic} onChange={e => setTopic(e.target.value)} className="input" style={{ width: '100%' }}>
                  {currentModule?.topics?.map(t => <option key={t} value={t}>{t}</option>)}
                </select>}
          </div>

          {/* Nombre */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
              🔢 Nombre d'exercices : <span style={{ color: '#059669', fontWeight: 900 }}>{count}</span>
            </label>
            <input type="range" min={1} max={8} value={count} onChange={e => setCount(+e.target.value)}
              style={{ width: '100%', accentColor: '#059669' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <span>1</span><span>8</span>
            </div>
          </div>

          {/* Difficulté */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>📊 Niveau</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {DIFFICULTIES.map(d => {
                const Icon = d.icon;
                return (
                  <button key={d.id} onClick={() => setDifficulty(d.id)} style={{
                    padding: '7px 10px', borderRadius: '9px', cursor: 'pointer', textAlign: 'left',
                    border: '1px solid', transition: 'all .18s',
                    borderColor: difficulty === d.id ? d.color : 'var(--border)',
                    background: difficulty === d.id ? `${d.color}12` : 'var(--surface-2)',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                  }}>
                    <Icon size={14} style={{ color: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: difficulty === d.id ? d.color : 'var(--text-main)', flexShrink: 0 }}>
                      {d.label}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{d.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>🔖 Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {EX_TYPES.map(t => (
                <button key={t.id} onClick={() => toggleExType(t.id)} style={{
                  padding: '5px 11px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--border)', transition: 'all .18s',
                  background: exTypes.includes(t.id) ? '#059669' : 'var(--surface-2)',
                  color: exTypes.includes(t.id) ? '#fff' : 'var(--text-muted)',
                }}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Avec corrigé */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Avec corrigé détaillé ?</span>
            <button onClick={() => setWithSol(v => !v)} style={{
              width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: withSol ? '#059669' : 'var(--surface-2)', position: 'relative', transition: 'background .2s',
            }}>
              <div style={{
                position: 'absolute', top: '3px', left: withSol ? '22px' : '3px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)'
              }} />
            </button>
          </div>

          {errorMsg && (
            <div style={{
              background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
              borderRadius: '10px', padding: '0.7rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start'
            }}>
              <AlertCircle size={14} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.8rem', color: '#EF4444' }}>{errorMsg}</span>
            </div>
          )}

          <button onClick={handleGenerate} disabled={isGenerating || !resolvedTopic.trim()}
            className="btn btn-primary" style={{
              width: '100%', padding: '11px', fontWeight: 800, fontSize: '0.92rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
              background: 'linear-gradient(135deg, #059669, #10B981)',
              opacity: (isGenerating || !resolvedTopic.trim()) ? 0.6 : 1,
            }}>
            {isGenerating
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />{progressMsg || 'Génération…'}</>
              : <><Sparkles size={16} />Générer la série</>}
          </button>
        </div>

        {/* ── Résultats ── */}
        <div>
          {!sheet && !isGenerating && (
            <div style={{
              border: '2px dashed var(--border)', borderRadius: '16px', padding: '3rem 2rem',
              textAlign: 'center', color: 'var(--text-muted)'
            }}>
              <PenLine size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <div style={{ fontWeight: 600 }}>La série d'exercices apparaîtra ici</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.35rem', opacity: 0.7 }}>
                Sélectionnez un sujet et cliquez sur « Générer la série »
              </div>
            </div>
          )}

          {isGenerating && (
            <div style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '3rem 2rem', textAlign: 'center' }}>
              <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: '#059669' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#059669' }}>{progressMsg}</div>
            </div>
          )}

          {sheet && (
            <div className="card" style={{ padding: '1.25rem' }}>
              {/* Action bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
                <div style={{
                  fontSize: '0.82rem', fontWeight: 700, color: '#059669',
                  background: 'rgba(5,150,105,.08)', padding: '4px 10px', borderRadius: '20px',
                  border: '1px solid rgba(5,150,105,.2)', flexShrink: 0
                }}>
                  ✅ {sheet.exercises?.length} exercice(s) — {resolvedTopic}
                </div>
                <div style={{ flex: 1 }} />
                {withSol && (
                  <button onClick={toggleAll} className="btn btn-ghost"
                    style={{ padding: '6px 11px', fontSize: '0.78rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {allOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                    {allOpen ? 'Masquer les corrigés' : 'Afficher les corrigés'}
                  </button>
                )}
                <button onClick={handleCopy} className="btn btn-ghost"
                  style={{ padding: '6px 11px', fontSize: '0.78rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  {copyStatus ? <CheckCircle2 size={14} style={{ color: '#10B981' }} /> : <Copy size={14} />}
                  {copyStatus ? 'Copié !' : 'Copier'}
                </button>
                <button onClick={() => handlePrint(false)} className="btn btn-ghost"
                  style={{ padding: '6px 11px', fontSize: '0.78rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <Printer size={14} />Sans corrigé
                </button>
                <button onClick={() => handlePrint(true)} className="btn btn-ghost"
                  style={{ padding: '6px 11px', fontSize: '0.78rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <Printer size={14} />Avec corrigé
                </button>
                <button onClick={handleSave} disabled={savingStatus === 'saving' || savingStatus === 'saved'}
                  className="btn btn-ghost"
                  style={{ padding: '6px 11px', fontSize: '0.78rem', display: 'flex', gap: '0.35rem', alignItems: 'center',
                    color: savingStatus === 'saved' ? '#10B981' : undefined }}>
                  {savingStatus === 'saving'
                    ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Save size={14} />}
                  {savingStatus === 'saved' ? 'Sauvegardé ✓' : 'Sauvegarder'}
                </button>
                <button onClick={handleGenerate} className="btn btn-ghost"
                  style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                  title="Régénérer">
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Liste des exercices */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '65vh', overflowY: 'auto' }}>
                {(sheet.exercises || []).map((ex, idx) => {
                  const solOpen = !!expandedSols[ex.id];
                  const hasSol = !!ex.solution?.trim();
                  return (
                    <div key={ex.id} style={{
                      border: '1px solid var(--border)', borderRadius: '12px',
                      overflow: 'hidden', background: 'var(--surface-2)'
                    }}>
                      <div style={{
                        padding: '0.75rem 1rem', background: 'var(--surface-1)',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#059669' }}>
                          {ex.title || `Exercice ${idx + 1}`}
                        </span>
                        {withSol && hasSol && (
                          <button onClick={() => toggleSol(ex.id)} style={{
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            fontSize: '0.75rem', fontWeight: 700,
                            background: solOpen ? 'rgba(124,58,237,.1)' : 'var(--surface-2)',
                            color: solOpen ? 'var(--violet)' : 'var(--text-muted)',
                            border: '1px solid var(--border)', borderRadius: '8px',
                            padding: '4px 10px', cursor: 'pointer', transition: 'all .18s'
                          }}>
                            {solOpen ? <EyeOff size={12} /> : <Eye size={12} />}
                            {solOpen ? 'Masquer corrigé' : 'Voir corrigé'}
                          </button>
                        )}
                      </div>

                      <div className="math-content"
                        style={{ padding: '1rem', fontSize: '0.88rem', lineHeight: 1.85 }}
                        dangerouslySetInnerHTML={{ __html: renderToHtmlString(ex.statement || '') }}
                      />

                      {withSol && hasSol && solOpen && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '1rem', background: 'rgba(124,58,237,.04)' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--violet)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <CheckCircle2 size={13} /> Corrigé détaillé
                          </div>
                          <div className="math-content"
                            style={{ fontSize: '0.85rem', lineHeight: 1.85 }}
                            dangerouslySetInnerHTML={{ __html: renderToHtmlString(ex.solution) }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
