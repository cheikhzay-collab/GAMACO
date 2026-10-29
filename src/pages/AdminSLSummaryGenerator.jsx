// src/pages/AdminSLSummaryGenerator.jsx
// Générateur de résumés — Mathématiques Appliquées (Licence MA, Maroc)
// Langue : Français uniquement | Gemini API + KaTeX + PDF + Sauvegarde

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, BookOpenText, Sparkles, Save, Copy, Printer,
  CheckCircle2, AlertCircle, RefreshCw, Loader2
} from 'lucide-react';
import { renderWithMath, renderToHtmlString } from '../utils/mathRenderer';
import { saveSelfLearningNote } from '../services/selfLearningService';

// ─── Programme officiel — Licence Mathématiques Appliquées — Maroc ───────────
// Basé sur les maquettes des universités marocaines (UM5, UCA, UAE, etc.)
const MA_CURRICULA = {
  S1: {
    label: 'Semestre 1 — Tronc Commun',
    modules: [
      {
        id: 'S1_analyse1', name: 'Analyse 1',
        topics: [
          'Logique mathématique et raisonnement',
          'Ensembles, relations et applications',
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
          'Logique et théorie des ensembles',
          'Relations d\'équivalence et d\'ordre',
          'Applications (injection, surjection, bijection)',
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
          'Introduction aux algorithmes et à la complexité',
          'Structures de contrôle (conditions, boucles)',
          'Tableaux et matrices',
          'Fonctions et récursivité',
          'Tri et recherche (tri bulle, insertion, sélection)',
          'Introduction à Python / C',
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
          'Intégration par parties',
          'Changement de variable dans les intégrales',
          'Intégrales des fractions rationnelles et trigonométriques',
          'Intégrales impropres (convergence, critères)',
          'Séries numériques — Critères de convergence',
          'Séries alternées et absolument convergentes',
        ]
      },
      {
        id: 'S2_algebre2', name: 'Algèbre 2 — Algèbre Linéaire',
        topics: [
          'Espaces vectoriels — Définition et exemples',
          'Sous-espaces vectoriels et opérations',
          'Familles libres, génératrices, bases et dimension',
          'Applications linéaires — Noyau et image',
          'Matrices — Opérations et rang',
          'Déterminants — Calcul et propriétés',
          'Systèmes linéaires — Méthode de Gauss-Jordan',
          'Valeurs propres et vecteurs propres',
          'Diagonalisation et trigonalisation',
        ]
      },
      {
        id: 'S2_proba1', name: 'Probabilités & Statistiques 1',
        topics: [
          'Espaces de probabilité — Axiomes de Kolmogorov',
          'Probabilité conditionnelle — Théorème de Bayes',
          'Variables aléatoires discrètes',
          'Loi de Bernoulli, binomiale, de Poisson',
          'Variables aléatoires continues — Loi uniforme, exponentielle',
          'Loi normale (Gauss) et centrage réduction',
          'Espérance, variance et écart-type',
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
          'Équations différentielles linéaires du 2nd ordre à coefficients constants',
          'Systèmes d\'équations différentielles',
        ]
      },
      {
        id: 'S3_analyse_num1', name: 'Analyse Numérique 1',
        topics: [
          'Erreurs d\'arrondi et arithmétique flottante',
          'Résolution d\'équations non linéaires (Dichotomie, Newton, Sécante)',
          'Interpolation polynomiale — Lagrange et Newton',
          'Interpolation par splines cubiques',
          'Intégration numérique — Rectangles, trapèzes, Simpson',
          'Formules de quadrature de Gauss',
          'Résolution de systèmes linéaires — Décomposition LU',
          'Méthodes itératives (Jacobi, Gauss-Seidel)',
        ]
      },
      {
        id: 'S3_proba2', name: 'Probabilités & Statistiques 2',
        topics: [
          'Vecteurs aléatoires — Lois jointes et marginales',
          'Covariance et corrélation',
          'Lois conditionnelles et espérance conditionnelle',
          'Fonctions génératrices et transformées de Laplace',
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
        id: 'S4_analyse4', name: 'Analyse 4 — Variables Complexes',
        topics: [
          'Fonctions holomorphes et équations de Cauchy-Riemann',
          'Séries de Laurent',
          'Intégration dans le plan complexe',
          'Théorème de Cauchy et ses conséquences',
          'Pôles et résidus — Calcul d\'intégrales réelles',
          'Transformée de Laplace — Définition et propriétés',
          'Transformée de Laplace inverse',
          'Application aux équations différentielles',
        ]
      },
      {
        id: 'S4_analyse_num2', name: 'Analyse Numérique 2',
        topics: [
          'Valeurs propres — Méthode de la puissance itérée',
          'Méthode de Householder et QR',
          'Résolution d\'EDO — Méthodes d\'Euler',
          'Méthodes de Runge-Kutta (RK2, RK4)',
          'Méthodes multi-pas (Adams-Bashforth)',
          'Analyse de stabilité des schémas numériques',
        ]
      },
      {
        id: 'S4_ro1', name: 'Recherche Opérationnelle 1',
        topics: [
          'Introduction à la programmation linéaire',
          'Modélisation des problèmes d\'optimisation',
          'Méthode du simplexe — Phase 1 et Phase 2',
          'Dualité — Théorème des écarts complémentaires',
          'Analyse de sensibilité',
          'Problème de transport et d\'affectation',
          'Algorithme de North-West, MODI',
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
          'Espaces de Banach et de Hilbert',
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
          'Optimisation sans contraintes — Conditions d\'optimalité',
          'Méthodes de descente — Gradient, gradient conjugué',
          'Méthode de Newton et quasi-Newton (BFGS)',
          'Optimisation sous contraintes — Conditions KKT',
          'Méthode des multiplicateurs de Lagrange',
          'Programmation quadratique',
          'Méthodes de pénalité et barrière',
          'Introduction à l\'optimisation stochastique',
        ]
      },
      {
        id: 'S5_edp', name: 'Équations aux Dérivées Partielles (EDP)',
        topics: [
          'Classification des EDP (elliptiques, paraboliques, hyperboliques)',
          'Équation de chaleur — Méthode de séparation des variables',
          'Équation des ondes',
          'Équation de Laplace et de Poisson',
          'Conditions aux limites (Dirichlet, Neumann, Robin)',
          'Méthode des différences finies pour les EDP',
          'Méthode des éléments finis — Introduction',
        ]
      },
      {
        id: 'S5_ro2', name: 'Recherche Opérationnelle 2',
        topics: [
          'Théorie des graphes — Représentation et parcours',
          'Arbres couvrants minimaux (Kruskal, Prim)',
          'Plus courts chemins (Dijkstra, Bellman-Ford, Floyd-Warshall)',
          'Flots dans les réseaux — Algorithme de Ford-Fulkerson',
          'Problèmes d\'ordonnancement (PERT, CPM)',
          'Programmation dynamique — Principe de Bellman',
          'Introduction aux métaheuristiques (recuit simulé, algorithmes génétiques)',
        ]
      },
      {
        id: 'S5_stats_multivariees', name: 'Statistiques Multivariées',
        topics: [
          'Analyse en Composantes Principales (ACP)',
          'Analyse Factorielle des Correspondances (AFC)',
          'Analyse Discriminante Linéaire (ADL)',
          'Classification hiérarchique — Dendrogramme',
          'Régression linéaire multiple — MCO et diagnostic',
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
        id: 'S6_machine_learning', name: 'Machine Learning & IA',
        topics: [
          'Apprentissage supervisé — K-NN, arbres de décision',
          'Machines à vecteurs de support (SVM)',
          'Réseaux de neurones artificiels — Perceptron multicouche',
          'Rétropropagation du gradient',
          'Apprentissage non supervisé — K-means, DBSCAN',
          'Validation croisée et sélection de modèle',
          'Introduction au Deep Learning',
          'Régularisation (Ridge, Lasso)',
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
          'Intégrale de Itô',
          'Équations différentielles stochastiques (EDS)',
          'Lemme de Itô — Applications en finance',
        ]
      },
      {
        id: 'S6_methodes_num_edp', name: 'Méthodes Numériques pour les EDP',
        topics: [
          'Méthodes de différences finies — Schémas implicites et explicites',
          'Stabilité, consistance et convergence (condition CFL)',
          'Méthode des éléments finis — Formulation variationnelle',
          'Méthode des volumes finis',
          'Résolution des systèmes linéaires creux',
          'Méthodes de décomposition de domaine',
        ]
      },
      {
        id: 'S6_analyse_fonctionnelle', name: 'Analyse Fonctionnelle',
        topics: [
          'Espaces normés et de Banach',
          'Espaces de Hilbert — Bases orthonormales',
          'Opérateurs linéaires bornés',
          'Théorème de Hahn-Banach',
          'Théorème du graphe fermé et de l\'application ouverte',
          'Opérateurs compacts et valeurs propres',
          'Distributions et espaces de Sobolev',
        ]
      },
    ]
  },
};

// ─── Depth options ────────────────────────────────────────────────────────────
const DEPTH_OPTIONS = [
  { id: 'brief',    label: 'Résumé court',   desc: 'Définitions clés et formules essentielles' },
  { id: 'normal',   label: 'Standard',        desc: 'Définitions + théorèmes + exemples' },
  { id: 'detailed', label: 'Détaillé',        desc: 'Complet avec preuves et exemples multiples' },
];

// ─── Extract text content from AI response ───────────────────────────────────
function extractContent(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const jsonBlock = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const str = jsonBlock ? jsonBlock[1] : raw;
  try {
    const obj = JSON.parse(str);
    if (obj.content) return obj.content;
    if (obj.summary) return obj.summary;
    if (obj.text) return obj.text;
  } catch (_) {}
  return raw;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminSLSummaryGenerator({ onBack }) {
  const [semester, setSemester] = useState('S3');
  const [moduleId, setModuleId] = useState('');
  const [topic, setTopic]       = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [depth, setDepth]       = useState('normal');

  const [geminiKey, setGeminiKey] = useState(
    () => (localStorage.getItem('geminiApiKey') || localStorage.getItem('gemini_api_key') || '').trim()
  );
  const [isGenerating, setIsGenerating]     = useState(false);
  const [progressMsg, setProgressMsg]       = useState('');
  const [generatedContent, setGeneratedContent] = useState(null);
  const [errorMsg, setErrorMsg]             = useState(null);
  const [savingStatus, setSavingStatus]     = useState(null);
  const [copyStatus, setCopyStatus]         = useState(false);

  const currentSem = useMemo(() => MA_CURRICULA[semester] || MA_CURRICULA.S3, [semester]);

  useEffect(() => {
    if (currentSem.modules.length > 0) {
      setModuleId(currentSem.modules[0].id);
    }
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
  const depthObj = DEPTH_OPTIONS.find(d => d.id === depth) || DEPTH_OPTIONS[1];

  const handleGenerate = async () => {
    if (!resolvedTopic.trim()) { setErrorMsg('Veuillez sélectionner ou saisir un sujet.'); return; }
    if (!geminiKey) { setErrorMsg('Clé API Gemini introuvable. Ajoutez-la dans les paramètres.'); return; }

    setIsGenerating(true); setErrorMsg(null); setGeneratedContent(null); setSavingStatus(null);

    try {
      setProgressMsg('Génération du résumé en cours…');

      const systemPrompt = `Tu es Professeur-chercheur en Mathématiques Appliquées dans une université marocaine (ex: UM5 Rabat, UCA Marrakech, UAE Tetouan).
Ta mission : rédiger un résumé de niveau ${depthObj.label} sur le sujet "${resolvedTopic}" du module "${moduleName}" (${currentSem.label} — Licence Mathématiques Appliquées, Maroc).

FORMAT DU RÉSUMÉ :
## 1. Définitions et notions fondamentales
(avec formules LaTeX précises)

## 2. Théorèmes et résultats clés
(avec hypothèses, conclusions et brèves remarques)

## 3. Méthodes et techniques (si applicable)
(algorithmes, étapes, procédures)

## 4. Exemples illustratifs
(exemples corrigés pas à pas)

## 5. Récapitulatif et formules à retenir

RÈGLES LaTeX :
- Inline : $...$ | Display : $$...$$
- Notation : \\mathbb{R}, \\mathbb{N}, \\mathbb{Z}, \\mathbb{C}
- Toujours doubler les antislashs dans les chaînes JSON si besoin

RÈGLES DE RÉDACTION :
- Français académique rigoureux, style cours universitaire marocain
- Notation BIOF/officielle (\\ln, \\exp, \\lim_{x \\to a}, \\int_a^b, \\sum_{n=0}^{+\\infty})
- Renvoyer uniquement du texte Markdown (PAS de JSON)
- Profondeur : ${depthObj.label} — ${depthObj.desc}`;

      const userPrompt = `Rédige un résumé ${depthObj.label} sur : "${resolvedTopic}" — ${moduleName} (${semester}, Licence MA Maroc).`;

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
                  contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
                  generationConfig: { temperature: 0.35, maxOutputTokens: 6144 }
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
          // Fallback to server proxy with server API key
          const proxyRes = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              apiKey: geminiKey || undefined,
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
              generationConfig: { temperature: 0.35, maxOutputTokens: 6144 }
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
      setGeneratedContent(extractContent(rawText));

    } catch (e) { setErrorMsg(e.message); }
    finally { setIsGenerating(false); setProgressMsg(''); }
  };

  const handleSave = async () => {
    if (!generatedContent) return;
    setSavingStatus('saving');
    try {
      await saveSelfLearningNote({
        type: 'summary', cycle: semester, module: moduleName,
        topic: resolvedTopic, content: generatedContent, language: 'fr', level: depth,
      });
      setSavingStatus('saved');
    } catch (e) { setSavingStatus(null); setErrorMsg('Erreur de sauvegarde : ' + e.message); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent || '').then(() => {
      setCopyStatus(true); setTimeout(() => setCopyStatus(false), 2000);
    });
  };

  const handlePrint = () => {
    const bodyHtml = renderToHtmlString(generatedContent || '');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${resolvedTopic} — ${moduleName} — ${semester}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.9; color: #111; }
    h1 { font-size: 1.35rem; border-bottom: 2px solid #7C3AED; padding-bottom: .5rem; margin-bottom: .5rem; }
    h2 { font-size: 1.08rem; color: #059669; border-left: 3px solid #059669; padding-left: .6rem; margin-top: 1.5rem; }
    h3 { font-size: .97rem; color: #7C3AED; margin-top: 1rem; }
    .subtitle { color: #666; font-size: .82rem; margin-bottom: 1.5rem; }
    ul { padding-left: 1.4rem; }
    li { margin: .22rem 0; }
    .katex { font-size: 1.0em !important; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>📖 ${resolvedTopic}</h1>
  <p class="subtitle">${moduleName} — ${currentSem.label} — Licence Mathématiques Appliquées, Maroc</p>
  ${bodyHtml}
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '960px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={onBack} style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-main)', display: 'flex'
        }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BookOpenText size={20} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>
              Générateur de Résumé
            </h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Licence Mathématiques Appliquées — Universités marocaines
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Formulaire ── */}
        <div className="card" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Semestre */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
              🎓 Semestre
            </label>
            <select value={semester} onChange={e => setSemester(e.target.value)} className="input" style={{ width: '100%' }}>
              {Object.entries(MA_CURRICULA).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          {/* Module */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
              📚 Module
            </label>
            <select value={moduleId} onChange={e => setModuleId(e.target.value)} className="input" style={{ width: '100%' }}>
              {currentSem.modules.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Sujet */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>📌 Sujet</label>
              <button
                onClick={() => setUseCustom(v => !v)}
                style={{ fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--violet)', padding: 0 }}
              >
                {useCustom ? '← Liste' : '+ Sujet libre'}
              </button>
            </div>
            {useCustom ? (
              <input
                type="text" value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                placeholder="Ex : Convergence des séries de Fourier…"
                className="input" style={{ width: '100%' }}
              />
            ) : (
              <select value={topic} onChange={e => setTopic(e.target.value)} className="input" style={{ width: '100%' }}>
                {currentModule?.topics?.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>

          {/* Profondeur */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
              📊 Profondeur du résumé
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {DEPTH_OPTIONS.map(d => (
                <button key={d.id} onClick={() => setDepth(d.id)} style={{
                  padding: '8px 11px', borderRadius: '10px', cursor: 'pointer',
                  textAlign: 'left', border: '1px solid', transition: 'all .18s',
                  borderColor: depth === d.id ? 'var(--violet)' : 'var(--border)',
                  background: depth === d.id ? 'rgba(124,58,237,.08)' : 'var(--surface-2)',
                }}>
                  <div style={{ fontSize: '0.83rem', fontWeight: 700, color: depth === d.id ? 'var(--violet)' : 'var(--text-main)' }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '2px' }}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Erreur */}
          {errorMsg && (
            <div style={{
              background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
              borderRadius: '10px', padding: '0.7rem 0.9rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start'
            }}>
              <AlertCircle size={14} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.8rem', color: '#EF4444' }}>{errorMsg}</span>
            </div>
          )}

          {/* Bouton */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !resolvedTopic.trim()}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '11px', fontWeight: 800, fontSize: '0.92rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
              opacity: (isGenerating || !resolvedTopic.trim()) ? 0.6 : 1,
            }}
          >
            {isGenerating
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />{progressMsg || 'Génération…'}</>
              : <><Sparkles size={16} />Générer le résumé</>}
          </button>
        </div>

        {/* ── Résultat ── */}
        <div>
          {!generatedContent && !isGenerating && (
            <div style={{
              border: '2px dashed var(--border)', borderRadius: '16px', padding: '3rem 2rem',
              textAlign: 'center', color: 'var(--text-muted)'
            }}>
              <BookOpenText size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Le résumé apparaîtra ici</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.35rem', opacity: 0.7 }}>
                Sélectionnez un sujet puis cliquez sur « Générer le résumé »
              </div>
            </div>
          )}

          {isGenerating && (
            <div style={{
              border: '1px solid var(--border)', borderRadius: '16px', padding: '3rem 2rem', textAlign: 'center'
            }}>
              <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: 'var(--violet)' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--violet)' }}>{progressMsg}</div>
            </div>
          )}

          {generatedContent && (
            <div className="card" style={{ padding: '1.25rem' }}>
              {/* Barre d'actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
                <div style={{
                  fontSize: '0.8rem', fontWeight: 700, color: 'var(--violet)',
                  background: 'rgba(124,58,237,.08)', padding: '4px 10px', borderRadius: '20px',
                  border: '1px solid rgba(124,58,237,.2)', flexShrink: 0
                }}>
                  ✅ {resolvedTopic}
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={handleCopy} className="btn btn-ghost"
                  style={{ padding: '6px 11px', fontSize: '0.78rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  {copyStatus ? <CheckCircle2 size={14} style={{ color: '#10B981' }} /> : <Copy size={14} />}
                  {copyStatus ? 'Copié !' : 'Copier'}
                </button>
                <button onClick={handlePrint} className="btn btn-ghost"
                  style={{ padding: '6px 11px', fontSize: '0.78rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <Printer size={14} />PDF
                </button>
                <button onClick={handleSave} disabled={savingStatus === 'saving' || savingStatus === 'saved'}
                  className="btn btn-ghost"
                  style={{
                    padding: '6px 11px', fontSize: '0.78rem', display: 'flex', gap: '0.35rem', alignItems: 'center',
                    color: savingStatus === 'saved' ? '#10B981' : undefined,
                  }}>
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

              {/* Contenu */}
              <div
                className="math-content lesson-body"
                style={{ maxHeight: '65vh', overflowY: 'auto', fontSize: '0.91rem', lineHeight: 1.85 }}
                dangerouslySetInnerHTML={{ __html: renderToHtmlString(generatedContent) }}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
