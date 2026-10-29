// companionExtractionWorker.js
// Asynchronous Background Queue Worker & Resilient AI Extraction Engine
// Handles lesson extraction tasks detached from the client browser with auto-retry and persistent queue.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'extraction_tasks.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper: read tasks
const readTasks = () => {
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2), 'utf8');
    return [];
  }
  try {
    const raw = fs.readFileSync(TASKS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Worker] Error reading extraction_tasks.json:', err);
    return [];
  }
};

// Helper: write tasks
const writeTasks = (tasks) => {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (err) {
    console.error('[Worker] Error writing extraction_tasks.json:', err);
  }
};

// ─── Moroccan Curriculum System Prompt ────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un Professeur Agrégé de mathématiques et Inspecteur Pédagogique, expert en manuels scolaires marocains (niveaux Tronc Commun, 1ère Bac, 2ème Bac — filières SM, PC/SVT, Arts, SGC).
Tu analyses des fiches de cours, chapitres de manuel, séries d'exercices, devoirs surveillés ou épreuves d'examen fournis en PDF ou image.
Ton objectif UNIQUE est de produire un JSON structuré représentant FIDÈLEMENT, INTÉGRALEMENT et INTELLIGEMMENT le contenu pédagogique du document.

════════════════════════════════════════════════════════════
🧠 DÉTECTION AUTOMATIQUE INTELLIGENTE DE NIVEAU, TYPE & BAREME DE NOTATION (POINTS)
════════════════════════════════════════════════════════════
⚠️ DIRECTIVES D'ANALYSE AUTOMATIQUE HAUTE INTELLIGENCE :

1. DÉTECTION AUTOMATIQUE DU NIVEAU PÉDAGOGIQUE ("header.detected_level") :
   - Analyse le titre, l'en-tête, les références officielles et le contenu pour identifier le niveau exact :
     • "common_core_sci"  : Tronc Commun Scientifique (الجدع المشترك العلمي)
     • "common_core_arts" : Tronc Commun Littéraire (الجدع المشترك الأدبي)
     • "1bac_sci"         : 1ère Bac Sciences Expérimentales / Math (الأولى باك علوم تجريبية / رياضية)
     • "1bac_arts"        : 1ère Bac Littéraire (الأولى باك آداب)
     • "2bac_sm"          : 2ème Bac Sciences Mathématiques (الثانية باك علوم رياضية)
     • "2bac_pc_svt"      : 2ème Bac Sciences Expérimentales PC/SVT (الثانية باك علوم تجريبية)
     • "2bac_arts"        : 2ème Bac Lettres & Sciences Humaines (الثانية باك آداب)

2. DÉTECTION RIGOUREUSE DU TYPE DE DOCUMENT ET DE L'ARCHITECTURE ("header.doc_type" & "header.is_national_exam") :
   Tu DOIS IDENTIFIER AVEC PRÉCISION la nature exacte du document parmi ces 5 architectures distinctes :

   • 'exercises' : (سلسلة تمارين / Travaux Dirigés TD / Fiche d'exercices / Exercices d'application / Révision)
     - Tout document contenant les termes "سلسلة تمارين", "سلسلة رقم", "Série d'exercices", "TD", "Travaux dirigés", "Fiche d'exercices", "تمارين داعمة".
     - ⚠️ RÈGLE ABSOLUE & CRUCIALE : Même si la série de تمارين porte un titre mentionnant le Baccalauréat ou les examens nationaux (ex: "سلسلة تمارين مقتطفة من الامتحانات الوطنية" ou "Série Préparation Examen National"), son "header.doc_type" EST IMPÉRATIVEMENT 'exercises' et "header.is_national_exam" DOIT ÊTRE false !

   • 'national' : (الامتحان الوطني الموحد الرسمي للبكالوريا - Sujet Officiel d'Examen National)
     - ⚠️ CETTE ARCHITECTURE EST STRICTEMENT RÉSERVÉE AU SUJET OFFICIEL DE L'EXAMEN NATIONAL DU BACCALAURÉAT imprimé par le Ministère de l'Éducation Nationale (comportant l'en-tête officiel du Royaume du Maroc, le cadre d'examen avec durée, coefficient, code NS/NR, la case triangulaire du sujet, et les consignes officielles).
     - Dans ce cas UNIQUEMENT : définis "header.doc_type": "national" et "header.is_national_exam": true.

   • 'homework' : (فرض محروس / فرض منزلي / مراقبة مستمرة - Devoir Surveillé DS / Devoir Maison DM / Contrôle Continu)
     - Tout document de contrôle : "Devoir Surveillé", "DS N°", "فرض محروس", "فرض منزلي", "Contrôle continu".
     - Définis "header.doc_type": "homework", "header.is_national_exam": false, "header.total_points": 20.

   • 'summary' : (ملخص شامل / ملخص درس / بطاقة ملخص / Résumé de cours / Synthèse de cours)
     - Tout document condensé récapitulant les définitions, règles, propriétés et exemples d'un cours (ex: "Résumé de cours", "ملخص", "ملخص درس", "Fiche mémo", "Synthèse").
     - Définis "header.doc_type": "summary" et "header.is_summary": true.
     - Extrais l'objet "header.summary_meta" avec les informations d'en-tête :
       - "prof": Nom du professeur avec titre (ex: "Prof : Fayssal el boutkhili")
       - "website": Site web, lien ou contact (ex: "www.elboutkhili.jimdofree.com")
       - "title": Titre du résumé (ex: "Résumé de cours 1 : Ensemble ℕ et notion d'arithmétique")
       - "level_name": Niveau ou filière (ex: "Tronc commun science")
       - "school": Nom de l'établissement ou lycée (ex: "Lycée ABDE EL MOUMENE")
     - Organisation en 3 colonnes (Modèle Fiche Résumé) :
       - Pour chaque section, indique le champ "column" (1, 2, ou 3) pour répartir harmonieusement les notions sur les 3 colonnes du gabarit.
       - "title": Titre de la notion (ex: "Définitions et notations", "Nombres pairs et impairs", "Multiples d'un entier naturel", etc.).
       - "content": Texte explicatif, définitions et règles avec formules en LaTeX ($...$).
       - Les exemples d'application, calculs types, propriétés remarquables et contre-exemples doivent être marqués avec "type": "example" ou "type": "highlight_box" pour être affichés dans les encadrés jaunes signature du modèle.

   • 'course' : (درس كامل / بطاقة درس - Fiche de cours)
     - Document comportant du cours théorique développé, définitions, théorèmes, activités et démonstrations.
     - Définis "header.doc_type": "course", "header.is_national_exam": false.

   • 'concours' : (مباراة ولوج الكليات والمدارس العليا - Épreuve de Concours)
     - Épreuves de concours d'accès (Médecine FMP/FMD, ENSA, ENSAM, CNC, APESA, etc.).
     - Définis "header.doc_type": "concours", "header.is_national_exam": false.

3. EXTRACTION DU BARÈME DE NOTATION ET DES POINTS ("points" & "header.total_points") :
   - Si le document est un devoir / contrôle / examen ou s'il contient des mentions de points (ex: (1.5 pts), (2 pts), (0.75 pt), [3 pts], (1,5 ن), (2 ن), (0,75 نقطة)) :
     • Dans le "header", indique "total_points": 20 (ou la somme totale des points calculée).
     • Pour CHAQUE exercice ou section (type 'exercise' ou 'activity') :
       - Extrais le nombre numérique de points attribués dans le champ "points" (ex: 3.5, 2, 1.5, 0.75).
       - Conserve aussi les mentions de points des sous-questions dans le texte de l'énoncé (ex: "**1.a.** (0.75 pt) Montrer que...").

4. DÉTAILS DE L'EXAMEN NATIONAL MAROCAIN (UNIQUEMENT SI doc_type === 'national') :
   - Extrais l'objet "header.national_exam_meta" avec les champs exacts :
     - "year": Année de l'examen (ex: "2026")
     - "session": Nom de la session (ex: "الدورة العادية 2026")
     - "subject": Nom de la matière (ex: "الرياضيات")
     - "branch": Branche et filière (ex: "مسلك علوم الحياة والأرض ومسلك العلوم الفيزيائية (خيار فرنسية)")
     - "code": Code du sujet (ex: "NS 22F")
     - "subject_number": Numéro du sujet dans la case triangulaire (ex: "3")
     - "duration": Durée de l'épreuve (ex: "3س")
     - "coefficient": Coefficient de la matière (ex: "7")
     - "total_pages": Nombre total de pages (ex: 8)
     - "general_instructions": Tableau des consignes générales (ex: ["L'utilisation d'une calculatrice non programmable est autorisée ;", ...])
     - "subject_components": Tableau des composantes du sujet [{"name": "Exercice 1", "topic": "Géométrie dans l'espace", "points": "3 points"}, ...]
     - "notations": Tableau des notations officielles figurant sur la page de garde.
     - Pour CHAQUE sous-question de chaque exercice, indique les points attribués ("0.5 pt", "0.25 pt", etc.) et conserve les formules mathématiques en LaTeX ($ ... $).

5. DÉTECTION ET CAPTURE AUTOMATIQUE DES FIGURES GÉOMÉTRIQUES ET COURBES ("figure_bbox") :
   - Si un exercice, une question ou une partie de cours est accompagné d'une figure géométrique, d'une courbe $(C_f)$, d'un tableau graphique, d'un schéma ou d'un dessin :
     • Tu DOIS INSÉRER un élément de type "image" dans le tableau "items" à l'emplacement exact où se trouve la figure.
     • Définis l'objet "figure_bbox" avec les coordonnées de délimitation normalisées sur la page correspondante (échelle 0 à 1000) :
       {
         "type": "image",
         "alt": "Figure : Courbe représentative de la fonction f(x)",
         "figure_bbox": {
           "page": 1,        // Numéro de page (1-indexé)
           "ymin": 250,      // Coordonnée Y supérieure (0-1000)
           "xmin": 520,      // Coordonnée X gauche (0-1000)
           "ymax": 680,      // Coordonnée Y inférieure (0-1000)
           "xmax": 950       // Coordonnée X droite (0-1000)
         },
         "width_pct": 80,
         "align": "center"
       }

6. 📊 DÉTECTION ET EXTRACTION HAUTE-PRÉCISION DES TABLEAUX & TABLEAUX DE VARIATIONS ("table") :
   - Si un cours, une activité ou un exercice contient un tableau (Tableau de valeurs, Tableau statistique, Tableau de vérité, Tableau de signes, Tableau de variation de fonction $f(x)$) :
     • Tu DOIS INSÉRER un élément de type "table" dans le tableau "items" avec la structure JSON exacte :
       {
         "type": "table",
         "title": "Tableau de variation de f(x)",
         "table_data": {
           "headers": ["x", "-\\infty", "0", "1", "+\\infty"],
           "rows": [
             ["f'(x)", "", "-", "0", "+"],
             ["f(x)", "+\\infty", "\\searrow", "-2", "\\nearrow"]
           ]
         }
       }
     • Pour les flèches de variation : utilise impérativement "\\nearrow" (croissante) et "\\searrow" (décroissante).
     • Pour les valeurs interdites / discontinuités : utilise "||" (double barre).
     • Pour les zéros sous la dérivée : écris "0".
     • Chaque cellule doit contenir du LaTeX propre sans balises $ imbriquées.

⚠️ DÉCOUPAGE RIGOUREUX ET EXTRACTION INTÉGRALE DES EXERCICES & SÉRIES DE TEMARINE ("content" & "items") :
- Il est STRICTEMENT INTERDIT de n'extraire que la première phrase d'un exercice ou d'omettre les questions !
- Tu DOIS extraire L'ÉNONCÉ INTÉGRAL DE CHAQUE EXERCICE : le texte introductif ET ABSOLUMENT TOUTES LES QUESTIONS ET SOUS-QUESTIONS (1., 2.a., 2.b., 3.a., 3.b., 4., etc.) du début à la fin.
- Pour CHAQUE exercice (Exercice 1, Exercice 2, etc.) ou section d'exercice / activité :
  • Le champ "content" DOIT CONTENIR L'ÉNONCÉ COMPLET MULTI-LIGNES avec TOUTES les questions (chacune sur une ligne avec son barème, ex: "**1.a.** (0.5 pt) Montrer que...").
  • Le tableau "items" DOIT CONTENIR TOUTES LES QUESTIONS ET SOUS-QUESTIONS sous forme d'objets distincts :
    - { "type": "text", "text": "Préambule/Contexte de l'exercice..." }
    - { "type": "bullet", "text": "**1.a.** (0.5 pt) Énoncé de la question en LaTeX..." }
    - { "type": "bullet", "text": "**1.b.** (0.75 pt) ..." }
    ... et ainsi de suite pour 100% des questions du document.

════════════════════════════════════════════════════════════
RÈGLE ABSOLUE DE LANGUE — CONSERVATION RIGOUREUSE DE LA LANGUE D'ORIGINE
════════════════════════════════════════════════════════════
⚠️ INSTRUCTION DE LANGUE OBLIGATOIRE ET PRIORITAIRE :
- Tu DOIS CONSERVER STRICTEMENT ET RIGOUREUSEMENT LA LANGUE ORIGINALE DU DOCUMENT SOURCE.
- Si le fichier / PDF / image est rédigé en ARABE (titres, cours, définitions, théorèmes, activités, questions, exercices, remarques), TOUT LE JSON PRODUIT (titres, sous-titres, texte des items, solutions, remarques) DOIT ÊTRE EN ARABE ! Ne traduis JAMAIS un document arabe en français.
- Si le fichier source est en FRANÇAIS, extrais l'intégralité en français.
- Détermine la langue principale du document et indique-la dans le champ "language" du header/metadata JSON ("ar" ou "fr").
- Ne traduis AUCUN mot, titre, définition ou énoncé d'une langue vers une autre. Le résultat doit respecter à 100% la langue d'origine du fichier importé !

════════════════════════════════════════════════════════════
✨ EXIGENCES D'EXTRACTION INTELLIGENTE : TENSIIQ, NUMÉROTATION ET CORRECTION LINGUISTIQUE
════════════════════════════════════════════════════════════

1. ✍️ CORRECTION LINGUISTIQUE, SPELLING ET ERREURS OCR (إصلاح الأخطاء اللغوية والنحوية) :
   - Tu DOIS corriger AUTOMATIQUEMENT toutes les fautes d'orthographe, de grammaire, de frappe et d'extraction OCR dans le texte source (en arabe ET en français).
   - En ARABE (العربية) : Corriger les fautes d'orthographe et de frappe (الهمزات: أ/إ/آ/ء, التاء المربوطة والهاء: ة/ه, الألف المقصورة: ى/ي), réparer les mots collés ou tronqués par l'OCR (ex: "الامتحان" au lieu de "ألإمتحان" ou "الامتحـان"), et assurer une syntaxe et une grammaire impeccables.
   - En FRANÇAIS : Corriger les fautes de frappe, d'accords, de ponctuation et les accents manquants (é, è, à, ç, etc.) provoqués par la numérisation.
   - Préservation absolue du sens scientifique et mathématique originel.

2. 🔢 NUMÉROTATION INTELLIGENTE ET HARMONIEUSE DES QUESTIONS ET EXERCICES (ترقيم الأسئلة والتمارين) :
   - Numérote clairement et méthodiquement tous les exercices (Exercice 1, Exercice 2...), toutes les activités (Activité 1, Activité 2...), et toutes les sous-questions (1.a., 1.b., 2.a., 2.b...).
   - Restitue la hiérarchie exacte des questions et sous-questions de manière ordonnée et sans aucune omission ni numéros manquants.

3. 🎨 TENSIIQ ET FORMATAGE INTELLIGENT DU CONTENU (التنسيق الذكي) :
   - Applique la syntaxe LaTeX \`$ ... $\` pour TOUT symbole, variable ($x$, $n$, $u_n$, $f(x)$) et expression mathématique inline, et \`$$ ... $$\` pour les équations en bloc.
   - Structure chaque section pédagogique avec une aération optimale, des titres clairs en gras (\`**...**\`), et des encadrés appropriés pour les définitions et théorèmes.

════════════════════════════════════════════════════════════
MODÈLE DE COURS MAROCAIN — STRUCTURE HIÉRARCHIQUE OBLIGATOIRE
════════════════════════════════════════════════════════════

Tout cours de mathématiques marocain suit cette hiérarchie exacte. Tu DOIS la respecter :

┌──────────────────────────────────────────────────────────┐
│  TITRE DU CHAPITRE (ex: "Barycentre")                    │  → header.fiche_title
│                                                          │
│  I. Grand Titre (chiffres romains)                       │  → section_header
│     ┌────────────────────────────────────────┐           │
│     │  1. Définition / Sous-titre            │  → title  │
│     │     ┌──────────────────────────┐       │           │
│     │     │ ✦ Activité ① / ② / ③   │  section distincte │
│     │     │ ✦ Définitions :          │  section distincte │
│     │     │ ✦ Exemple :              │  section distincte │
│     │     │ ✦ Remarques :            │  section distincte │
│     │     │ ✦ Propriété :            │  section distincte │
│     │     │ ✦ Application ① / ② :  │  section distincte │
│     │     │ ✦ Exercice :             │  section distincte │
│     │     └──────────────────────────┘                   │
│     └────────────────────────────────────────┘           │
│  II. Grand Titre suivant                                 │
│  III. ...                                                │
└──────────────────────────────────────────────────────────┘

════════════════════════════════════════════════════════════
RÈGLES DE MAPPING — CHAQUE BLOC PÉDAGOGIQUE = UNE SECTION
════════════════════════════════════════════════════════════

▸ ACTIVITÉ (Activité ①, Activité ②, Activité de soutien des prérequis...) :
  - title: "**Activité ① :** Titre de l'activité" (ou ②, ③, etc.)
  - type: "activity"
  - items: tableau d'items "text" ou "bullet" avec TOUTES les sous-questions numérotées (1., 2., a., b., etc.)
  - Chaque question sur un item séparé. Les sous-questions "a." et "b." sont des items "bullet".
  - Le texte introductif (ex: "Soient A et B deux points...") est le premier item de type "text".
  - Inclure l'accent_text pour les phrases mises en évidence (fond orangé dans le manuel).

▸ DÉFINITIONS / DÉFINITION :
  - title: "**Définitions :**" ou "**Définition :** Nom de la définition"
  - type: "definition"
  - items: le contenu va dans un item de type "highlight_box" (fond grisé / encadré dans le manuel).
  - Respecte les symboles mathématiques officiels : $bar\\{(A;a),(B;b)\\}$, $\\overrightarrow{GA}$, etc.
  - Les sous-points (•) sont des items "bullet" APRÈS le highlight_box principal.

▸ PROPRIÉTÉ / PROPRIÉTÉS :
  - title: "**Propriété :** Nom de la propriété" ou "**Propriétés :**"
  - type: "property"
  - items: le contenu va dans un item "highlight_box" (encadré dans le manuel).
  - Si la propriété a un nom (ex: "conservation du barycentre"), l'inclure dans le title.

▸ THÉORÈME :
  - title: "**Théorème :** Nom du théorème"
  - type: "theorem"
  - items: item "highlight_box" pour l'énoncé.

▸ EXEMPLE :
  - title: "**Exemple :**" ou "**Exemple :** Bref titre"
  - type: "example"
  - items: items "text" ou "bullet" avec l'exemple détaillé.
  - Le texte "O Exemple :" dans le manuel = exactement ce type de section.

▸ REMARQUES / REMARQUE :
  - title: "**Remarques :**" ou "**Remarque :**"
  - type: "remark"
  - items: chaque point "•" est un item "bullet" distinct. Le texte introductif est un item "text".

▸ APPLICATION (Application ①, Application ②...) :
  - title: "**Application ① :**" (ou ②, ③, etc.)
  - type: "activity"
  - content: TOUT le texte de l'application avec les questions numérotées (une par ligne).
  - solution: résolution détaillée si mode résolution activé, sinon "".
  - interactive_answers: [] (tableau vide sauf si réponses numériques simples extraites).

▸ EXERCICE (Exercice 1, Exercice 2, Série d'exercices, Devoir, TD) :
  - title: "**Exercice 1 :**" (ou Exercice 2, Exercice N° X, etc.)
  - type: "exercise"
  - points: barème numérique si présent (ex: 3.5), sinon 0
  - content: L'ÉNONCÉ TOTAL MULTI-LIGNES de l'exercice incluant TOUTES LES QUESTIONS ET SOUS-QUESTIONS (1., 2.a., 2.b., 3., etc.). Ne coupe JAMAIS après la première phrase !
  - items: Tableau d'items contenant le préambule ("text") ET CHAQUE question numérotée ("bullet") avec son énoncé et son barème.
  - solution: Résolution détaillée si disponible, sinon "".

▸ TECHNIQUE DE CONSTRUCTION / MÉTHODE :
  - title: "**Technique de construction :**" ou "**Méthode :**"
  - type: "content"
  - items: items "text" décrivant les étapes.

════════════════════════════════════════════════════════════
EXEMPLE CONCRET — COURS "BARYCENTRE"
════════════════════════════════════════════════════════════

JSON attendu (extrait) :
[
  {
    "id": "sec-1",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "1. Définition",
    "type": "content",
    "section_number": "I",
    "accent_text": "",
    "items": [
      { "type": "text", "text": "Introduction optionnelle si présente dans le document." }
    ]
  },
  {
    "id": "sec-2",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "**Activité ① :** Soutien des prérequis",
    "type": "activity",
    "section_number": "I",
    "accent_text": "",
    "items": [
      { "type": "text", "text": "$ABC$ est un triangle. Soient $I$, $J$ et $K$ trois points du plan tels que $\\\\overrightarrow{AI} = \\\\frac{1}{2}\\\\overrightarrow{AB}$ et $\\\\overrightarrow{AJ} = \\\\frac{2}{5}\\\\overrightarrow{AC}$." },
      { "type": "bullet", "text": "**1.** Placer les points $I$, $J$ et $K$." }
    ]
  },
  {
    "id": "ex-1",
    "section_header": "Exercice 1 : Calcul de limites & Étude de fonction",
    "title": "**Exercice 1 :** (4 pts)",
    "type": "exercise",
    "points": 4,
    "section_number": "1",
    "content": "Soit $f$ la fonction numérique définie par $f(x) = \\dfrac{2x^2+x+3}{x-1}$.\\n**1.a.** (1 pt) Déterminer le domaine de définition $D_f$.\\n**1.b.** (1 pt) Calculer $\\lim_{x \\to +\\infty} f(x)$.",
    "items": [
      { "type": "text", "text": "Soit $f$ la fonction numérique définie par $f(x) = \\dfrac{2x^2+x+3}{x-1}$." },
      { "type": "bullet", "text": "**1.a.** (1 pt) Déterminer le domaine de définition $D_f$." },
      { "type": "bullet", "text": "**1.b.** (1 pt) Calculer $\\lim_{x \\to +\\infty} f(x)$." }
    ],
    "solution": "Solution détaillée si disponible, sinon \"\"",
    "interactive_answers": []
  }
]

════════════════════════════════════════════════════════════
🎯 DIRECTIVES EXIGENCES LATEX HAUTE QUALITÉ & SYMBOLISME RIGOUREUX
════════════════════════════════════════════════════════════

1. INTÉGRALES & CALCUL INTÉGRAL :
   - Intégrale définie : $\\int_{a}^{b} f(x) \\, \\mathrm{d}x$ (espace '\\,' et différentielle '\\mathrm{d}x')
   - Crochet d'intégration : $\\left[ F(x) \\right]_{a}^{b} = F(b) - F(a)$

2. LIMITES & ASYMPTOTES :
   - Forme canonique : $\\lim_{x \\to a} f(x) = L$ et $\\lim_{x \\to \\pm\\infty} \\frac{f(x)}{x} = l$
   - Flèches de limite : toujours $\\to$ (jamais -> ou \\rightarrow)

3. VECTEURS, NORMES & GÉOMÉTRIE (MAROC) :
   - Flèche complète : $\\overrightarrow{AB}$, $\\overrightarrow{u}$ (jamais \\vec{})
   - Produit vectoriel officiel : $\\overrightarrow{u} \\wedge \\overrightarrow{v}$ (symbole \\wedge)
   - Produit scalaire : $\\overrightarrow{u} \\cdot \\overrightarrow{v}$ ou $\\overrightarrow{AB} \\cdot \\overrightarrow{AC}$
   - Norme : $\\left\\| \\overrightarrow{AB} \\right\\|$

4. FRACTIONS ET PARENTHÈSES AUTOSIZE :
   - Utiliser $\\left( \\dfrac{a}{b} \\right)$, $\\left[ ... \\right]$, $\\left\\{ ... \\right\\}$.
   - Utiliser $\\dfrac{a}{b}$ pour les fractions principales en mode ligne.

5. ENSEMBLES ET NOTATIONS :
   - Ensembles officiels : $\\mathbb{R}$, $\\mathbb{N}$, $\\mathbb{Z}$, $\\mathbb{C}$, $\\mathbb{Q}$, $\\mathbb{R}^*$, $\\mathbb{R}_+^*$
   - Intervalles : $[a; b]$, $]a; b[$, $[a; +\\infty[$ (avec point-virgule)
   - Systèmes d'équations : $\\begin{cases} ax + by = c \\\\ dx + ey = f \\end{cases}$

6. DOUBLE BACKSLASH DANS LE JSON :
   - Dans toutes les chaînes JSON, échapper CHAQUE antislash LaTeX avec un double antislash (ex: \\frac → \\\\frac, \\overrightarrow → \\\\overrightarrow, \\neq → \\\\neq).
   - Formules en ligne: $...$ — Formules en bloc: $$...$$

════════════════════════════════════════════════════════════
RÈGLE CRITIQUE — EXTRACTION INTÉGRALE DE TOUTES LES PAGES SANS OMISSION
════════════════════════════════════════════════════════════

⚠️ OBLIGATION D'EXHAUSTIVITÉ ABSOLUE :
✅ Tu DOIS extraire L'INTÉGRALITÉ ABSOLUE du document du premier mot de la page 1 jusqu'au dernier mot de la toute dernière page.
✅ Il est STRICTEMENT INTERDIT de t'arrêter au milieu du document, après la première page, ou d'omettre des chapitres ou exercices !
✅ COURS THÉORIQUES (الدروس) : Extrais CHAQUE définition, théorème, corollaire, propriété, remarque, exemple, démonstration, activité et application sans en omettre aucun.
✅ SÉRIES D'EXERCICES ET DEVOIRS (سلاسل التمارين والفروض) : Extrais TOUS les exercices sans exception (Exercice 1, Exercice 2, Exercice 3...). Pour chaque exercice, extrais TOUTES les questions et sous-questions (1., 2.a., 2.b., 3., etc.) dans "content" et dans "items".
✅ Ne résume PAS : copie FIDÈLEMENT tout le texte, formule par formule, ligne par ligne.
✅ Retourne UNIQUEMENT le JSON brut. Zéro texte avant ou après. Pas de bloc \`\`\`json.

════════════════════════════════════════════════════════════
SCHÉMA JSON OBLIGATOIRE (STRUCTURE EXACTE ATTENDUE)
════════════════════════════════════════════════════════════

{
  "header": {
    "prep_title": "Titre de la série ou de la préparation si présent, sinon \"\"",
    "subject": "Matière (ex: Mathématiques)",
    "fiche_title": "Titre du chapitre ou du devoir (ex: Devoir Surveillé N°1 ou Barycentre)",
    "teacher": "Nom du professeur si présent, sinon \"\"",
    "phone": "Téléphone si présent, sinon \"\"",
    "doc_type": "'course' | 'homework' | 'exercises' | 'concours' | 'national' | 'summary'",
    "detected_level": "'common_core_sci' | 'common_core_arts' | '1bac_sci' | '1bac_arts' | '2bac_sm' | '2bac_pc_svt' | '2bac_arts'",
    "total_points": 20
  },
  "sections": [
    {
      "id": "sec-1",
      "section_header": "I. Grand titre (chiffres romains)",
      "title": "1. Sous-titre OU **Activité ① :** titre OU **Définitions :** OU ...",
      "type": "content | definition | property | theorem | corollary | example | remark | activity",
      "section_number": "I",
      "accent_text": "Texte mis en évidence (fond coloré) si présent, sinon \"\"",
      "items": [
        { "type": "text", "text": "Paragraphe ou introduction." },
        { "type": "highlight_box", "text": "Contenu encadré (définition, propriété, théorème)." },
        { "type": "bullet", "text": "• Point de liste ou sous-question." },
        {
          "type": "image",
          "url": "",
          "alt": "Légende de la figure",
          "align": "center",
          "width_pct": 70
        }
      ]
    },
    {
      "id": "ex-1",
      "section_header": "Exercice 1",
      "title": "**Exercice 1 :** (4 pts)",
      "type": "exercise",
      "points": 4,
      "section_number": "1",
      "content": "Énoncé complet multi-lignes de l'exercice avec toutes ses questions.",
      "items": [
        { "type": "text", "text": "Contexte de l'exercice..." },
        { "type": "bullet", "text": "**1.a.** (1 pt) Question..." }
      ],
      "solution": "Solution détaillée si disponible, sinon \"\"",
      "interactive_answers": []
    }
  ]
}

NOTE CRITIQUE SUR LES IMAGES ET FIGURES :
Si le document contient une figure géométrique, un graphique ou un schéma :
- Insère un item "image" dans "items" avec figure_bbox { page, xmin, ymin, xmax, ymax } (coordonnées 0 à 1000).
`;

const MOROCCAN_SOLVE_ADDENDUM = `
════════════════════════════════════════════════════════════
🎯 RÈGLES DE RÉSOLUTION OFFICIELLES (INSPECTEUR PÉDAGOGIQUE MAROCAIN)
════════════════════════════════════════════════════════════
Pour chaque exercice, activité ou application résolue dans le champ "solution" :
1. Respecte scrupuleusement le programme officiel marocain du niveau détecté.
2. ⚠️ RÈGLE DE L'HÔPITAL STRICTEMENT INTERDITE pour les limites (utiliser méthodes officielles : factorisation, quantité conjuguée, encadrements).
3. Rédige d'abord l'intégralité du corrigé mathématique détaillé question par question.
`;

const NO_SOLUTION_ADDENDUM = `
⚠️ INSTRUCTION STRICTE — MODE EXTRACTION UNIQUEMENT (SANS RÉSOLUTION) :
- Tu dois extraire et structurer FIDÈLEMENT tout le contenu du document sans résoudre.
- Pour le champ "solution" de chaque exercice, écris UNIQUEMENT la chaîne vide "".
- Pour le tableau "interactive_answers", retourne un tableau vide [].
`;

const buildExtractionUserPrompt = (pageCount, solveSolutions, preExtractedPdfText = '') => {
  const pageNote = pageCount && pageCount > 1
    ? `⚠️ CE DOCUMENT COMPORTE EXACTEMENT ${pageCount} PAGES (de la page 1 à la page ${pageCount}).\nTu DOIS IMPÉRATIVEMENT lire, parcourir et extraire l'intégralité de CHAQUE page de la page 1 jusqu'à la dernière page ${pageCount} sans t'arrêter en cours de route et sans sauter aucune section.`
    : `⚠️ Tu DOIS IMPÉRATIVEMENT extraire l'intégralité absolue du document du début à la toute fin sans rien omettre.`;

  const textFusion = preExtractedPdfText && preExtractedPdfText.trim()
    ? `\n\n📄 TEXTE BRUT DÉTECTÉ DIRECTEMENT DU PDF :\n"""\n${preExtractedPdfText.trim()}\n"""\n`
    : '';

  const commonRules = `
${pageNote}
${textFusion}
🎯 EXIGENCES STRICTES D'EXHAUSTIVITÉ TOTALE (AUCUN MANQUE TOLÉRÉ) :
1. COURS THÉORIQUES (الدروس النظرية) : Extrais L'INTÉGRALITÉ des chapitres, sections, définitions, théorèmes et exemples.
2. SÉRIES D'EXERCICES (سلاسل التمارين) : Extrais TOUS les exercices du premier au dernier avec toutes les sous-questions.
3. CONSERVATION DE LA LANGUE D'ORIGINE (arabe ou français).
4. SYNTAXE LATEX RIGOUREUSE avec $...$ et $$...$$.
`;

  if (solveSolutions) {
    return `${commonRules}\nTranscris et extrais l'intégralité absolue du document, résous les exercices de manière détaillée dans "solution" et génère le JSON complet.`;
  } else {
    return `${commonRules}\nExtrais et structure fidèlement tout le contenu sans résoudre. IMPORTANT : Laisse le champ "solution" vide ("") pour chaque exercice et "interactive_answers" comme tableau vide []. Ne résous rien et génère le JSON complet.`;
  }
};

// ─── JSON Repair & Sanitization Pipeline ──────────────────────────────────────

const repairTruncatedJson = (str) => {
  if (!str) return str;
  let s = str.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }
  if (start > 0) s = s.slice(start);

  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === c) {
          stack.pop();
        }
      }
    }
  }

  if (inString) s += '"';
  s = s.replace(/,\s*$/, '');
  s = s.replace(/:\s*$/, ': ""');

  while (stack.length > 0) {
    s += stack.pop();
  }
  return s;
};

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
      if (char === '\n') result += '\\n';
      continue;
    }
    result += char;
  }
  return result;
};

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
        let isClosing = false;
        let j = i + 1;
        while (j < str.length && /\s/.test(str[j])) j++;
        if (j < str.length) {
          const nextChar = str[j];
          if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':') {
            isClosing = true;
          }
        } else {
          isClosing = true;
        }
        if (isClosing) {
          inString = false;
          result += char;
        } else {
          result += '\\"';
        }
      }
      continue;
    }
    result += char;
  }
  return result;
};

const extractJsonFromText = (str) => {
  if (!str) return str;
  let s = str.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace === -1 && firstBracket === -1) return s;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);

  const lastBrace = s.lastIndexOf('}');
  const lastBracket = s.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);

  if (start !== -1 && end !== -1 && end > start) {
    return s.slice(start, end + 1);
  }
  return start !== -1 ? s.slice(start) : s;
};

const parseJsonWithResilience = (rawText) => {
  let cleanText = rawText.trim();
  if (cleanText.includes('</think>')) {
    cleanText = cleanText.split('</think>').pop().trim();
  }
  cleanText = sanitizeLatexJson(cleanText);

  const strategies = [
    (t) => JSON.parse(extractJsonFromText(t)),
    (t) => JSON.parse(escapeLiteralNewlinesInJson(extractJsonFromText(t))),
    (t) => JSON.parse(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(extractJsonFromText(t)))),
    (t) => JSON.parse(repairTruncatedJson(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(extractJsonFromText(t))))),
    (t) => JSON.parse(repairTruncatedJson(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(sanitizeLatexJson(extractJsonFromText(t))))))
  ];

  let lastError = null;
  for (let i = 0; i < strategies.length; i++) {
    try {
      const res = strategies[i](cleanText);
      console.log(`[Worker] JSON Parse Strategy ${i + 1} succeeded!`);
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Échec d'analyse du JSON produit par l'IA : ${lastError?.message || 'JSON invalide'}`);
};

// ─── AI API Drivers with Cascading Model Fallback & Quota Resilience ─────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Verified high-performing models per provider
const FALLBACK_MODELS = {
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ],
  claude: [
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022'
  ],
  deepseek: [
    'deepseek-reasoner',
    'deepseek-chat'
  ]
};

// Build unique ordered cascade list of models to try
const resolveModelCascade = (provider, userPreferredModel) => {
  const defaults = FALLBACK_MODELS[provider] || FALLBACK_MODELS.gemini;
  let cleanUser = (userPreferredModel || '').trim().replace(/^models\//, '');

  // Normalize aliases and deprecated models
  if (provider === 'gemini') {
    if (!cleanUser || ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', '3.7', '3.5'].includes(cleanUser)) {
      cleanUser = 'gemini-2.5-flash';
    }
  }

  const cascade = [];
  if (cleanUser && cleanUser !== 'default') {
    cascade.push(cleanUser);
  }
  for (const m of defaults) {
    if (!cascade.includes(m)) {
      cascade.push(m);
    }
  }
  return cascade;
};

// Quota wait helper with live countdown updates
const waitForQuotaRegeneration = async (seconds, modelName, onProgress) => {
  console.log(`[Worker] Quota exhausted for ${modelName}. Waiting ${seconds}s for quota regeneration...`);
  for (let rem = seconds; rem > 0; rem -= 5) {
    const chunk = Math.min(5, rem);
    if (onProgress) {
      onProgress(30, `Quota API saturé pour [${modelName}] (HTTP 429). Pause intelligente : reprise dans ${rem}s...`);
    }
    await sleep(chunk * 1000);
  }
};

// Strict Document Validation & Normalization: Ensure output is structured and non-empty
const validateExtractedDocument = (parsed) => {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error("Format JSON invalide : aucun objet structuré trouvé.");
  }

  let rawSections = [];
  if (Array.isArray(parsed)) {
    rawSections = parsed;
  } else if (Array.isArray(parsed.sections)) {
    rawSections = parsed.sections;
  } else if (Array.isArray(parsed.items)) {
    rawSections = parsed.items;
  } else if (Array.isArray(parsed.exercises)) {
    rawSections = parsed.exercises;
  } else if (Array.isArray(parsed.exercices)) {
    rawSections = parsed.exercices;
  } else if (Array.isArray(parsed.series)) {
    rawSections = parsed.series;
  } else if (Array.isArray(parsed.serie)) {
    rawSections = parsed.serie;
  } else if (Array.isArray(parsed.questions)) {
    rawSections = parsed.questions;
  } else if (Array.isArray(parsed.parties)) {
    rawSections = parsed.parties;
  } else if (Array.isArray(parsed.content)) {
    rawSections = parsed.content;
  } else if (Array.isArray(parsed.data)) {
    rawSections = parsed.data;
  } else if (Array.isArray(parsed.cours)) {
    rawSections = parsed.cours;
  } else if (parsed.course && Array.isArray(parsed.course.sections)) {
    rawSections = parsed.course.sections;
  } else if (parsed.course && Array.isArray(parsed.course.items)) {
    rawSections = parsed.course.items;
  } else {
    const arrayProp = Object.values(parsed).find(val => Array.isArray(val) && val.length > 0 && typeof val[0] === 'object');
    if (arrayProp) {
      rawSections = arrayProp;
    }
  }

  // Fallback if parsed is directly a single section object
  if (rawSections.length === 0) {
    if (parsed.content || parsed.questions || parsed.exercice || parsed.title || parsed.enonce) {
      rawSections = [parsed];
    }
  }

  if (!rawSections || rawSections.length === 0) {
    throw new Error("Document vide : aucune section ni exercice n'a été extrait par le modèle.");
  }

  // Normalize each section with comprehensive fallbacks for any LLM schema variations
  const normalizedSections = rawSections.map((sec, idx) => {
    if (typeof sec === 'string') {
      return {
        id: `sec-${idx + 1}`,
        title: '',
        content: sec,
        items: [{ type: 'text', text: sec }],
        type: 'content',
        points: '',
        solution: ''
      };
    }
    if (!sec || typeof sec !== 'object') {
      return { id: `sec-${idx + 1}`, title: '', content: '', items: [], type: 'content' };
    }

    const title = sec.title || sec.section_title || sec.titre || sec.name || '';
    let content = typeof sec.content === 'string' ? sec.content : (
      typeof sec.enonce === 'string' ? sec.enonce : (
        typeof sec.body === 'string' ? sec.body : (
          typeof sec.text === 'string' ? sec.text : (
            typeof sec.description === 'string' ? sec.description : ''
          )
        )
      )
    );

    let rawItems = Array.isArray(sec.items) ? sec.items : (Array.isArray(sec.questions) ? sec.questions : []);
    if (rawItems.length === 0 && Array.isArray(sec.sub_questions)) rawItems = sec.sub_questions;

    const items = rawItems.map(it => {
      if (typeof it === 'string') return { type: 'text', text: it };
      if (it && typeof it === 'object') {
        if (!it.text && it.enonce) return { ...it, text: it.enonce };
        if (!it.text && it.question) return { ...it, text: it.question };
        return it;
      }
      return { type: 'text', text: String(it || '') };
    });

    if (items.length > 0 && (!content || content.trim().length < 20)) {
      content = items.map(it => it.text || (typeof it === 'string' ? it : '')).filter(Boolean).join('\n');
    } else if (items.length === 0 && content.trim()) {
      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      items.push(...lines.map(line => {
        const isBullet = /^(\d+|[a-zA-Z])[.)]|\*\*(\d+|[a-zA-Z])/.test(line);
        return { type: isBullet ? 'bullet' : 'text', text: line };
      }));
    }

    const solution = typeof sec.solution === 'string' ? sec.solution : (
      typeof sec.corrigé === 'string' ? sec.corrigé : (
        typeof sec.corrige === 'string' ? sec.corrige : (
          typeof sec.answer === 'string' ? sec.answer : ''
        )
      )
    );

    const points = sec.points !== undefined && sec.points !== null ? sec.points : (sec.bareme || '');

    return {
      ...sec,
      id: sec.id || `sec-${idx + 1}`,
      title,
      content,
      items,
      type: sec.type || (points ? 'exercise' : 'content'),
      points,
      solution
    };
  });

  // Ensure at least one section has substantial content
  const hasSubstantiveContent = normalizedSections.some(sec => {
    if (!sec) return false;
    const title = (sec.title || '').trim();
    const content = (typeof sec.content === 'string' ? sec.content : '').trim();
    const solution = (typeof sec.solution === 'string' ? sec.solution : '').trim();
    const items = Array.isArray(sec.items) ? sec.items : [];

    const hasItemText = items.some(it => {
      if (!it) return false;
      if (typeof it === 'string') return it.trim().length > 5;
      return (it.text && it.text.trim().length > 5) || it.url || it.type === 'table' || it.table_data;
    });

    return title.length > 3 || content.length > 10 || solution.length > 10 || hasItemText;
  });

  if (!hasSubstantiveContent) {
    throw new Error("Document vide : les sections retournées ne contiennent aucun texte, formule ou exercice exploitable.");
  }

  const rootMeta = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  const nestedHeader = (parsed?.header && typeof parsed.header === 'object' && !Array.isArray(parsed.header)) ? parsed.header : {};
  const header = { ...rootMeta, ...nestedHeader };

  return {
    ...parsed,
    header,
    sections: normalizedSections
  };
};

// ─── Single Model Invocation Drivers ──────────────────────────────────────────

const callGeminiSingleAttempt = async ({ model, base64Data, safeMime, userText, systemContent, apiKey }) => {
  const effectiveKey = (apiKey || '').trim().replace(/^[\"']|[\"']$/g, '') || (process.env.GEMINI_API_KEY || '').trim().replace(/^[\"']|[\"']$/g, '');
  if (!effectiveKey) {
    const err = new Error("Clé API Google Gemini manquante. Veuillez renseigner votre clé API dans les paramètres.");
    err.status = 401;
    err.isAuthError = true;
    throw err;
  }

  const cleanModel = (model || '').trim().replace(/^models\//, '');
  const versions = ['v1beta', 'v1'];
  let lastErr = null;

  for (const apiVersion of versions) {
    const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${cleanModel}:generateContent?key=${effectiveKey}`;

    const payload = {
      contents: [
        {
          parts: [
            ...(base64Data ? [{
              inlineData: {
                mimeType: safeMime,
                data: base64Data
              }
            }] : []),
            { text: userText }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemContent }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 65536,
        temperature: 0.1
      }
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': effectiveKey
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const status = res.status;
        const msg = errJson?.error?.message || `Erreur HTTP ${status}`;
        const err = new Error(`Gemini [${cleanModel}]: ${msg}`);
        err.status = status;
        err.apiMessage = msg;
        err.isQuotaExceeded = (status === 429 || /resource_exhausted|quota|rate limit/i.test(msg));
        err.isNotFound = (status === 404 || /not found/i.test(msg));
        err.isAuthError = (status === 400 && /API_KEY_INVALID|API key not valid/i.test(msg)) || status === 401 || status === 403;
        lastErr = err;

        if (status === 404 && apiVersion === 'v1beta') {
          continue; // Try v1 before giving up
        }
        throw err;
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      if (!candidate || !candidate.content?.parts) {
        throw new Error(`Gemini [${cleanModel}] n'a retourné aucun contenu.`);
      }

      const nonThoughtParts = candidate.content.parts.filter(p => !p.thought);
      const text = (nonThoughtParts.length > 0 ? nonThoughtParts : candidate.content.parts)
        .map(p => p.text || '')
        .join('');

      if (!text.trim()) {
        throw new Error(`Gemini [${cleanModel}] a produit une réponse textuelle vide.`);
      }

      return text;
    } catch (fetchErr) {
      if (fetchErr.isNotFound && apiVersion === 'v1beta') {
        continue;
      }
      throw fetchErr;
    }
  }

  throw lastErr || new Error(`Gemini [${cleanModel}]: indisponible`);
};

const callClaudeSingleAttempt = async ({ model, base64Data, safeMime, userText, systemContent, apiKey, proxyUrl }) => {
  const endpoint = proxyUrl || 'https://api.anthropic.com/v1/messages';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  headers['anthropic-version'] = '2023-06-01';

  const isPdf = safeMime === 'application/pdf';
  const sourceBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
    : { type: 'image', source: { type: 'base64', media_type: safeMime, data: base64Data } };

  const maxTokens = (model.includes('3-7') || model.includes('opus-4') || model.includes('sonnet-4')) ? 16000 : 8192;

  const payload = {
    model,
    max_tokens: maxTokens,
    system: systemContent,
    messages: [
      {
        role: 'user',
        content: [
          sourceBlock,
          { type: 'text', text: userText }
        ]
      }
    ]
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const status = res.status;
    const msg = errJson?.error?.message || `Erreur HTTP ${status}`;
    const err = new Error(`Claude [${model}]: ${msg}`);
    err.status = status;
    err.isQuotaExceeded = (status === 429 || /rate_limit|overloaded/i.test(msg));
    throw err;
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text || !text.trim()) {
    throw new Error(`Claude [${model}] n'a retourné aucun texte.`);
  }
  return text;
};

const callDeepSeekSingleAttempt = async ({ model, preExtractedPdfText, pageCount, systemContent, apiKey, deepseekUrl }) => {
  const cleanUrl = (deepseekUrl || 'https://api.deepseek.com').trim().replace(/\/$/, '');
  const endpoint = `${cleanUrl}/v1/chat/completions`;

  const userContent = `TEXTE DU DOCUMENT EXTRAIT DU PDF :\n${preExtractedPdfText || ''}\n\n${buildExtractionUserPrompt(pageCount, solveSolutions)}`;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent }
    ],
    max_tokens: 8192,
    response_format: !model.includes('reasoner') ? { type: 'json_object' } : undefined,
    temperature: 0.1
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const status = res.status;
    const msg = errJson?.error?.message || `Erreur HTTP ${status}`;
    const err = new Error(`DeepSeek [${model}]: ${msg}`);
    err.status = status;
    err.isQuotaExceeded = (status === 429 || /rate limit|quota/i.test(msg));
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error(`DeepSeek [${model}] n'a retourné aucun contenu.`);
  }
  return content;
};

// ─── Background Task Queue Controller ─────────────────────────────────────────

let isWorkerRunning = false;

// Clean stuck tasks on startup
const initQueue = () => {
  const tasks = readTasks();
  let changed = false;
  tasks.forEach(t => {
    if (t.status === 'processing') {
      t.status = 'pending';
      t.progressMessage = 'Remis en attente après redémarrage du serveur.';
      changed = true;
    }
  });
  if (changed) writeTasks(tasks);
  setTimeout(processQueue, 1500);
};

// Main Queue Processing Loop with Multi-Model Fallback Cascade & Quota Resilience
export const processQueue = async () => {
  if (isWorkerRunning) return;

  const tasks = readTasks();
  const nextTask = tasks.find(t => t.status === 'pending');
  if (!nextTask) {
    isWorkerRunning = false;
    return;
  }

  isWorkerRunning = true;
  const taskId = nextTask.id;
  console.log(`[Worker] Starting extraction task: ${taskId} (${nextTask.fileName})`);

  const updateTaskState = (updates) => {
    const currentTasks = readTasks();
    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      currentTasks[idx] = { ...currentTasks[idx], ...updates, updatedAt: new Date().toISOString() };
      writeTasks(currentTasks);
    }
  };

  try {
    updateTaskState({
      status: 'processing',
      attempts: (nextTask.attempts || 0) + 1,
      progressPercent: 10,
      progressMessage: 'Initialisation du document et analyse des modèles disponibles...'
    });

    const onProgress = (percent, message) => {
      updateTaskState({ progressPercent: percent, progressMessage: message });
    };

    const provider = nextTask.provider || 'gemini';
    const modelsToTry = resolveModelCascade(provider, nextTask.model);
    console.log(`[Worker] Task ${taskId}: cascade list [${modelsToTry.join(' -> ')}]`);

    const isPdf = (nextTask.fileType && nextTask.fileType.includes('pdf'));
    const safeMime = isPdf ? 'application/pdf' : (nextTask.fileType && nextTask.fileType.includes('/') ? nextTask.fileType : 'image/jpeg');
    const solveSolutions = nextTask.solveSolutions !== false;

    let systemContent = '';
    if (nextTask.customPrompt && nextTask.customPrompt.trim()) {
      systemContent = nextTask.customPrompt.trim();
    } else {
      systemContent = solveSolutions
        ? SYSTEM_PROMPT + MOROCCAN_SOLVE_ADDENDUM
        : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;
    }
    if (nextTask.customDirectives && nextTask.customDirectives.trim()) {
      systemContent += `\n\n════════════════════════════════════════\n📌 DIRECTIVES SPÉCIALES D'EXTRACTION :\n${nextTask.customDirectives.trim()}\n════════════════════════════════════════`;
    }

    const userText = buildExtractionUserPrompt(nextTask.pageCount || 1, solveSolutions, nextTask.preExtractedPdfText);

    let extractedResult = null;
    let usedModel = null;
    const failureLog = [];

    // Cascading model failover loop
    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      const modelIndex = i + 1;
      const totalModels = modelsToTry.length;
      const baseProgress = 20 + Math.floor((i / totalModels) * 60);

      onProgress(baseProgress, `Essai du modèle [${currentModel}] (${modelIndex}/${totalModels})...`);
      console.log(`[Worker] Task ${taskId}: Trying model ${currentModel} (${modelIndex}/${totalModels})...`);

      let rawText = '';
      let modelSucceeded = false;

      // Inner retry loop for transient network glitches
      const MAX_INNER_RETRIES = 2;
      for (let attempt = 1; attempt <= MAX_INNER_RETRIES; attempt++) {
        try {
          if (provider === 'claude') {
            rawText = await callClaudeSingleAttempt({
              model: currentModel,
              base64Data: nextTask.base64Data,
              safeMime,
              userText,
              systemContent,
              apiKey: nextTask.apiKey,
              proxyUrl: nextTask.proxyUrl
            });
          } else if (provider === 'deepseek') {
            rawText = await callDeepSeekSingleAttempt({
              model: currentModel,
              preExtractedPdfText: nextTask.preExtractedPdfText || '',
              pageCount: nextTask.pageCount || 1,
              systemContent, apiKey: nextTask.apiKey, deepseekUrl: nextTask.deepseekUrl
            });
          } else {
            // Default: Gemini
            rawText = await callGeminiSingleAttempt({
              model: currentModel,
              base64Data: nextTask.base64Data,
              safeMime,
              userText,
              systemContent,
              apiKey: nextTask.apiKey
            });
          }

          modelSucceeded = true;
          break; // API call succeeded
        } catch (apiErr) {
          const isQuota = Boolean(apiErr.isQuotaExceeded || apiErr.status === 429);
          const isNotFound = Boolean(apiErr.isNotFound || apiErr.status === 404);

          console.warn(`[Worker] Model ${currentModel} attempt ${attempt} failed: ${apiErr.message}`);

          const isAuth = Boolean(apiErr.isAuthError || apiErr.status === 401 || (apiErr.status === 400 && /API_KEY_INVALID|API key not valid/i.test(apiErr.apiMessage || '')));
          if (isAuth) {
            failureLog.push(`${currentModel}: مفتاح API غير صالح`);
            throw new Error(`خطأ في مصادقة مفتاح Google Gemini : المفتاح غير صالح أو منتهي الصلاحية (${apiErr.apiMessage || apiErr.message}). يرجى إدخال مفتاح صالح في صفحة الإعدادات.`);
          }

          if (isNotFound) {
            failureLog.push(`${currentModel}: غير متوفر (404)`);
            break;
          }

          if (isQuota) {
            failureLog.push(`${currentModel}: quota dépassé (429)`);
            const hasMoreModels = i < modelsToTry.length - 1;
            if (hasMoreModels) {
              // Try next model tier which often has separate quota (e.g. Flash vs Pro)
              onProgress(baseProgress, `Quota atteint sur [${currentModel}]. Bascule automatique vers le modèle de secours...`);
              await sleep(2000);
              break;
            } else {
              // If this was the last model, wait for quota regeneration and retry
              await waitForQuotaRegeneration(30, currentModel, onProgress);
              continue;
            }
          }

          // Transient network or server error
          if (attempt < MAX_INNER_RETRIES) {
            onProgress(baseProgress, `Incident temporaire sur [${currentModel}]. Réessai dans 4s...`);
            await sleep(4000);
          } else {
            failureLog.push(`${currentModel}: ${apiErr.message}`);
          }
        }
      }

      if (!modelSucceeded || !rawText.trim()) {
        continue; // Proceed to next model in cascade
      }

      // Model returned text: parse and strictly validate content
      try {
        onProgress(baseProgress + 10, `Validation et contrôle qualité du contenu extrait (${currentModel})...`);
        const parsed = parseJsonWithResilience(rawText);
        const validatedDoc = validateExtractedDocument(parsed);

        // Document is verified NON-EMPTY with real sections!
        extractedResult = validatedDoc;
        usedModel = currentModel;
        console.log(`[Worker] Task ${taskId}: extraction succeeded with model ${currentModel}! Sections: ${validatedDoc.sections.length}`);
        break; // SUCCESS! Break out of model cascade
      } catch (parseOrValErr) {
        console.warn(`[Worker] Validation failed for model ${currentModel}: ${parseOrValErr.message}`);
        failureLog.push(`${currentModel}: ${parseOrValErr.message}`);
        onProgress(baseProgress + 5, `Contenu incomplet retourné par [${currentModel}]. Bascule vers le modèle suivant...`);
        await sleep(2000);
      }
    }

    // Check if any model in the cascade succeeded
    if (!extractedResult) {
      throw new Error(
        `Tous les modèles testés (${modelsToTry.join(', ')}) ont échoué ou ont retourné un contenu vide.\n` +
        `Détails : ${failureLog.join(' | ')}`
      );
    }

    // Finalize successful extraction
    const header = extractedResult.header || {};
    const sectionsCount = extractedResult.sections.length;

    updateTaskState({
      status: 'completed',
      progressPercent: 100,
      progressMessage: `Fiche extraite avec succès via [${usedModel}] ! (${sectionsCount} sections détectées)`,
      result: extractedResult,
      headerSummary: {
        ficheTitle: header.fiche_title || header.title || nextTask.fileName,
        subject: header.subject || 'Mathématiques',
        detectedLevel: header.detected_level || '2bac_pc_svt',
        docType: header.doc_type || 'course',
        sectionsCount,
        extractedWithModel: usedModel
      },
      // Remove heavy binary payloads
      base64Data: undefined,
      preExtractedPdfText: undefined,
      completedAt: new Date().toISOString(),
      error: null
    });

    console.log(`[Worker] Task ${taskId} successfully completed using model ${usedModel}!`);
  } catch (err) {
    console.error(`[Worker] Task ${taskId} failed completely:`, err.message);
    updateTaskState({
      status: 'failed',
      progressPercent: 0,
      progressMessage: `Échec de l'extraction : ${err.message}`,
      error: err.message,
      result: null, // STRICTLY NULL TO PREVENT EMPTY FILES
      base64Data: undefined,
      preExtractedPdfText: undefined
    });
  } finally {
    isWorkerRunning = false;
    setTimeout(processQueue, 500);
  }
};

// ─── Public CRUD API for Companion Server ─────────────────────────────────────

export const getExtractionTasks = ({ includeResult = false } = {}) => {
  const tasks = readTasks();
  return tasks
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(t => {
      if (includeResult) return t;
      const { base64Data, preExtractedPdfText, result, ...meta } = t;
      return {
        ...meta,
        hasResult: Boolean(result)
      };
    });
};

export const getExtractionTaskById = (id) => {
  const tasks = readTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return null;
  const { base64Data, preExtractedPdfText, ...safeTask } = task;
  return safeTask;
};

export const createExtractionTask = (data) => {
  const tasks = readTasks();
  const id = `TASK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const newTask = {
    id,
    fileName: data.fileName || 'document.pdf',
    fileType: data.fileType || 'application/pdf',
    pageCount: data.pageCount || 1,
    base64Data: data.base64Data || '',
    preExtractedPdfText: data.preExtractedPdfText || '',
    provider: data.provider || 'gemini',
    apiKey: data.apiKey || '',
    model: data.model || '',
    proxyUrl: data.proxyUrl || '',
    deepseekUrl: data.deepseekUrl || '',
    solveSolutions: data.solveSolutions !== false,
    status: 'pending',
    progressPercent: 0,
    progressMessage: 'En attente dans la file...',
    attempts: 0,
    maxAttempts: 3,
    error: null,
    result: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tasks.unshift(newTask);
  writeTasks(tasks);

  setTimeout(processQueue, 100);

  const { base64Data, preExtractedPdfText, ...safeTask } = newTask;
  return safeTask;
};

export const retryExtractionTask = (id, newApiKey = null) => {
  const tasks = readTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;

  const task = tasks[idx];
  task.status = 'pending';
  task.attempts = 0;
  task.error = null;
  task.progressPercent = 0;
  task.progressMessage = 'Nouvelle tentative programmée...';
  task.updatedAt = new Date().toISOString();
  if (newApiKey) task.apiKey = newApiKey;

  tasks[idx] = task;
  writeTasks(tasks);

  setTimeout(processQueue, 100);
  const { base64Data, preExtractedPdfText, ...safeTask } = task;
  return safeTask;
};

export const deleteExtractionTask = (id) => {
  const tasks = readTasks();
  const filtered = tasks.filter(t => t.id !== id);
  writeTasks(filtered);
  return true;
};

// Initialize on load
initQueue();
