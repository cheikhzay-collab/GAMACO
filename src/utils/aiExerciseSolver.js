// src/utils/aiExerciseSolver.js
// Multi-Engine AI Exercise Solver (DeepSeek, Gemini, Claude)
// Conçu selon les Orientations Pédagogiques Officielles Marocaines (التوجيهات التربوية الرسمية لمادة الرياضيات)
// Adopte la démarche méthodologique rigoureuse d'un Inspecteur Pédagogique National ou Professeur Agrégé

import { normalizeLevel, getLevelDisplayName } from './levelHelpers';

/**
 * Détecte le domaine et le chapitre mathématique marocain concerné à partir de l'énoncé et des métadonnées
 */
function detectLessonDomain(exerciseContent = '', metadata = {}) {
  const text = `${exerciseContent} ${metadata.docTitle || ''} ${metadata.chapterTitle || ''} ${metadata.sectionTitle || ''} ${metadata.contenus || ''} ${metadata.capacitesAttendues || ''}`.toLowerCase();

  if (text.includes('complexe') || text.includes('forme algébrique') || text.includes('argument') || text.includes('module') || text.includes('عقدية') || text.includes('العقدية')) {
    return 'nombres_complexes';
  }
  if (text.includes('intégral') || text.includes('primitive') || text.includes('par parties') || text.includes('intégration') || text.includes('تكامل') || text.includes('أصلية') || text.includes('مكاملة بالأجزاء')) {
    return 'calcul_integral_primitives';
  }
  if (text.includes('différentielle') || text.includes('équadiff') || text.includes('y\'') || text.includes('y\'\'') || text.includes('تفاضلية')) {
    return 'equations_differentielles';
  }
  if (text.includes('suite') || text.includes('u_n') || text.includes('v_n') || text.includes('récurrence') || text.includes('متتالية') || text.includes('ترجع') || text.includes('حسابية') || text.includes('هندسية')) {
    return 'suites_numeriques';
  }
  if (text.includes('logarithme') || text.includes('ln(') || text.includes('\\ln') || text.includes('لوغاريتم') || text.includes('نيبيري')) {
    return 'fonctions_logarithmes';
  }
  if (text.includes('exponentielle') || text.includes('exp(') || text.includes('\\exp') || text.includes('e^x') || text.includes('أسية') || text.includes('الأسية')) {
    return 'fonctions_exponentielles';
  }
  if (text.includes('probabilité') || text.includes('dénombrement') || text.includes('combinaison') || text.includes('urne') || text.includes('احتمال') || text.includes('تعداد') || text.includes('متغير عشوائي')) {
    return 'probabilites_denombrement';
  }
  if (text.includes('espace') || text.includes('produit scalaire') || text.includes('produit vectoriel') || text.includes('sphère') || text.includes('plan') || text.includes('فضائية') || text.includes('فلكة') || text.includes('متجهي')) {
    return 'geometrie_espace';
  }
  if (text.includes('arithmétique') || text.includes('divisibilité') || text.includes('congruence') || text.includes('bézout') || text.includes('gauss') || text.includes('حسابيات') || text.includes('قابلية القسمة') || text.includes('موافقات')) {
    return 'arithmetique';
  }
  if (text.includes('groupe') || text.includes('anneau') || text.includes('corps') || text.includes('loi de composition') || text.includes('بنيات جبرية') || text.includes('قانون تركيب')) {
    return 'structures_algebriques';
  }
  if (text.includes('barycentre') || text.includes('مرجح')) {
    return 'barycentre';
  }
  if (text.includes('trigonométrie') || text.includes('cos') || text.includes('sin') || text.includes('tan') || text.includes('مثلثي') || text.includes('مثلثية')) {
    return 'trigonometrie';
  }
  if (text.includes('dérivab') || text.includes('dérivée') || text.includes('tangente') || text.includes('point d\'inflexion') || text.includes('concavité') || text.includes('اشتقاق') || text.includes('مماس') || text.includes('انعطاف') || text.includes('تقعر')) {
    return 'derivation_etude_fonctions';
  }
  if (text.includes('limite') || text.includes('continuité') || text.includes('tvi') || text.includes('asymptote') || text.includes('valeurs intermédiaires') || text.includes('نهاية') || text.includes('اتصال') || text.includes('قيم وسيطية') || text.includes('مقارب')) {
    return 'limites_continuite';
  }
  if (text.includes('polynôme') || text.includes('second degré') || text.includes('discriminant') || text.includes('حدودية') || text.includes('درجة ثانية')) {
    return 'polynomes_equations';
  }
  if (text.includes('logique') || text.includes('proposition') || text.includes('raisonnement') || text.includes('منطق') || text.includes('عبارة') || text.includes('استدلال')) {
    return 'logique_ensembles';
  }

  return 'analyse_generale';
}

/**
 * Génère le bloc des Orientations Pédagogiques Officielles Marocaines adaptées au niveau et au domaine
 */
function getMoroccanPedagogicalDirectives(normLevel, domain, isAr) {
  if (isAr) {
    let specificLevelRules;
    let prohibitions;

    if (normLevel === '2bac_pc_svt') {
      specificLevelRules = `
- المستوى المستهدف: الثانية بكالوريا مسلك العلوم التجريبية (علوم فيزيائية وعلوم الحياة والأرض والزراعية).
- المرجع البيداغوجي: الإطار المرجعي للامتحان الوطني الموحد للبكالوريا (شعبة العلوم التجريبية).
- مبرهنة القيم الوسيطية (TVI): يجب التأكد وجوباً من شرط الاتصال على المجال المغلق $[a,b]$ وحساب الجداء $f(a) \\times f(b) < 0$، والشرط الإضافي للرتابة القطعية في حالة طلب وحدانية الحل.
- دراسة الفروع اللانهائية: تحديد النهايات عند المحدات بدقة، ثم حساب $\\lim \\frac{f(x)}{x}$، ثم $\\lim [f(x)-ax]$ مع إعطاء التأويل الهندسي للمنحنى $(\\mathcal{C}_f)$ (مقارب مائل، مقارب عمودي، فرع شلجمي باتجاه محور الأفاصيل أو الراتب أو منصف الربع الأول).
- المتتاليات العددية: البرهان بالترجع (مراحل واضحة: التحقق، الافتراض، الاستنتاج)، دراسة الرتابة ($u_{n+1}-u_n$) والتأطير، وتطبيق مبرهنة تقارب كل متتالية تزايدية ومكبرة أو تناقصية ومصغرة، وحل المعادلة $f(l)=l$ للمتتاليات المعرفة بـ $u_{n+1}=f(u_n)$.
- التكامل: الاعتماد على الدوال الأصلية المباشرة والمكاملة بالأجزاء (IPP) مع التحديد الصريح للدوال المشتقة والأصلية.
- الأعداد العقدية: الانتقال المنظم بين الشكل الجبري والشكل المثلثي والأس، وتحديد المعنى الهندسي للمقادير (المسافة، قياس الزوايا، استقامية النقط، وطبيعة المثلثات والرباعيات، والكتابة العقدية للتحويلات: الإزاحة والتحاكي والدوران).
- الهندسة الفضائية: تحديد المتجهة المنظمية للمستوى، معادلة الفلكة، حساب المسافة $d(\\Omega, (P))$ ومقارنتها بالشعاع $R$ لتحديد تقاطع الفلكة والمستوى.`;

      prohibitions = `
⚠️ الممنوعات والمحظورات الرسمية الصارمة (تؤدي لنقطة الصفر في الامتحان الوطني):
1. قاعدة لوبيتال (Règle de L'Hôpital) ممنوعة منعاً باتاً ومطلقاً في حساب النهايات! يجب حساب النهايات حصرياً بالطرق الرسمية: التعميل بالحد الأكبر، المرافق، التأطير، النهايات الاعتيادية (مثل $\\lim_{x\\to 0}\\frac{e^x-1}{x}=1$ و $\\lim_{x\\to 0}\\frac{\\ln(1+x)}{x}=1$)، أو قابلية الاشتقاق عند نقطة، أو تغيير المتغير القانوني.
2. مبرهنة رول (Rolle) ومبرهنة التزايدات المنتهية (TAF) غير مقررة في مسلك العلوم التجريبية، لا تستخدمهما قط.
3. المكاملة بتغيير المتغير في حساب التكامل غير مقررة لشعبة العلوم التجريبية (استخدم فقط الدوال الأصلية والمكاملة بالأجزاء IPP).
4. مجموع ريمان والجذور النونية للوحدة غير مقررة في هذا المسلك.`;
    } else if (normLevel === '2bac_sm') {
      specificLevelRules = `
- المستوى المستهدف: الثانية بكالوريا شعبة العلوم الرياضية (أ و ب).
- المرجع البيداغوجي: التوجيهات التربوية الرسمية للمفتشية العامة لمادة الرياضيات بالثانوي التأهيلي (العلوم الرياضية).
- الصرامة الاستدلالية القصوى: استخدام المكممات المنطقية بدقة ($\\forall, \\exists, \\exists!$) وصياغة البراهين الرسمية (الخلف، الاستلزام العكسي، الفصل، الترجع القوي).
- التحليل: تطبيق مبرهنة رول ومبرهنة التزايدات المنتهية (TAF) والصيغة العامة لتفاوت التزايدات المنتهية، الاتصال المنتظم، مجموع ريمان لحساب النهايات والتكاملات، والدوال المثلثية العكسية ($\\arctan$).
- البنيات الجبرية: البرهان الصارم على القوانين التركيبية الداخلية، الزمر، الحلقات، الجسوم، والتشاكلات.
- الحسابيات في $\\mathbb{Z}$: استعمال القسمة الإقليدية، الموافقات بترديد $n$، مبرهنة بوزو، مبرهنة غوص، ومبرهنة فيرما الصغرى.
- الأعداد العقدية المتقدمة: الجذور النونية للوحدة والتحويلات النقطية في المستوى العقدي.`;

      prohibitions = `
⚠️ الممنوعات المنهجية:
1. قاعدة لوبيتال ممنوعة أيضاً في الامتحان الوطني لشعبة العلوم الرياضية ويجب التبرير بالنهايات الاعتيادية أو النشر المحدود في السياق المسموح به أو التزايدات المنتهية.
2. تجنب أي استنتاج غير معلل شروطه القبلية (مثلاً إغفال شروط الاستمرار أو قابلية الاشتقاق المفتوحة في TAF).`;
    } else if (normLevel === '1bac_sci' || normLevel === '1bac_sm') {
      specificLevelRules = `
- المستوى المستهدف: الأولى بكالوريا (${normLevel === '1bac_sm' ? 'علوم رياضية' : 'علوم تجريبية وتكنولوجية'}).
- النهايات: حساب النهايات بالتعميل، المرافق، النهايات المثلثية الاعتيادية، دون استعمال الدوال المشتقة في غير موضع العدد المشتق.
- الاشتقاق: حساب العدد المشتق من خلال نهاية معدل التغير، إيجاد معادلة مماس المنحنى $y = f'(x_0)(x-x_0) + f(x_0)$، ودراسة إشارة المشتقة لتحديد رتابة الدالة.
- المرجح: صياغة الخاصية المميزة $\\overrightarrow{MG}$، وإيجاد إحداثيات المرجح، وتحديد المجموعات الهندسية للنقط.
- الجداء السلمي والحساب المثلثي: استعمال صيغ التحويل المثلثية ($\\cos(a+b)$, $\\sin(a+b)$)، ومبرهنة الكاشي، ومبرهنة المتوسط.`;

      prohibitions = `
⚠️ الممنوعات الخاصة بهذا المستوى:
1. يمنع استعمال التكامل وحساب المساحات (مقرر في 2Bac فقط).
2. يمنع استعمال الدوال اللوغاريتمية والأسية (مقررة في 2Bac فقط).
3. يمنع استعمال الأعداد العقدية (مقررة في 2Bac فقط).`;
    } else {
      specificLevelRules = `
- المستوى المستهدف: الجذع المشترك (${normLevel.includes('arts') ? 'آداب وعلوم إنسانية' : 'علمي وتكنولوجي'}).
- المعارف المقررة: الحسابيات في $\\mathbb{N}$ (الأعداد الأولية، القواسم والمضاعفات، الزوجية)، المجموعات، الترتيب والقيمة المطلقة، الحساب المتجهي في المستوى (علاقة شال، الاستقامية)، الحدوديات والدوال من الدرجة الثانية (المميز $\\Delta$).`;

      prohibitions = `
⚠️ الممنوعات الخاصة بالجذع المشترك:
1. يمنع استعمال النهايات وحسابها قطيعاً.
2. يمنع استعمال المشتقات ودوال الاشتقاق نهائياً. يتم تحديد الرتابة عبر معدل التغير $T = \\frac{f(x)-f(y)}{x-y}$ فقط.`;
    }

    return `${specificLevelRules}\n${prohibitions}`;
  } else {
    // Version Française (BIOF)
    let specificLevelRules;
    let prohibitions;

    if (normLevel === '2bac_pc_svt') {
      specificLevelRules = `
- Niveau ciblé : 2ème Année Baccalauréat - Sciences Expérimentales (Option PC / SVT / Sc. Agro - BIOF).
- Référentiel pédagogique : Cadre de Référence Officiel de l'Examen National du Baccalauréat (Ministère de l'Éducation Nationale du Maroc).
- Théorème des Valeurs Intermédiaires (TVI) : Vérifier explicitement : 1) La continuité de $f$ sur l'intervalle $[a, b]$, 2) $f(a) \\times f(b) < 0$ (ou $0 \\in f([a, b])$), et 3) la stricte monotonie si l'unicité de la solution $\\alpha$ est exigée.
- Étude de fonctions & Branches infinies : Calcul rigoureux des limites aux bornes de $\\mathcal{D}_f$. Si $\\lim_{x\\to \\pm\\infty} f(x) = \\pm\\infty$, calculer $\\lim_{x\\to \\pm\\infty} \\frac{f(x)}{x} = a$, puis $\\lim_{x\\to \\pm\\infty} [f(x) - ax] = b$, puis énoncer l'interprétation géométrique complète ("La courbe $(\\mathcal{C}_f)$ admet une branche parabolique de direction...").
- Suites numériques : Démontrer par récurrence avec les trois étapes obligatoires (Initialisation, Hérédité, Conclusion). Étudier la monotonie via le signe de $u_{n+1} - u_n$. Utiliser le théorème de convergence monotone, et résoudre $f(l) = l$ pour les suites $u_{n+1} = f(u_n)$ en justifiant les hypothèses ($f$ continue, $f(I) \\subset I$, $u_0 \\in I$).
- Calcul intégral : Recourir aux primitives directes usuelles et à l'intégration par parties (IPP) en posant clairement $\\begin{cases} u(x) = \\dots & \\implies u'(x) = \\dots \\\\ v'(x) = \\dots & \\implies v(x) = \\dots \\end{cases}$.
- Nombres complexes : Forme algébrique, trigonométrique et exponentielle. Interprétations géométriques des modules et arguments (distances, angles de vecteurs, alignement, cocyclicité). Écritures complexes des transformations (translation $z' = z + b$, homothétie $z' - \\omega = k(z - \\omega)$, rotation $z' - \\omega = e^{i\\theta}(z - \\omega)$).
- Géométrie dans l'espace : Vecteur normal au plan, équation de sphère $(S)$, distance $d(\\Omega, (P))$ et position relative.`;

      prohibitions = `
⚠️ INTERDICTIONS OFFICIELLES ABSOLUES (Sous peine de note 0 à l'Examen National marocain) :
1. RÈGLE DE L'HÔPITAL STRICTEMENT INTERDITE pour le calcul des limites ! Les limites doivent être calculées exclusivement par les méthodes autorisées du programme marocain : factorisation par le terme dominant, expression conjuguée, encadrements, limites de référence ($\\lim_{x\\to 0}\\frac{e^x-1}{x}=1$, $\\lim_{x\\to 0}\\frac{\\ln(1+x)}{x}=1$), changement de variable légal ou nombre dérivé.
2. Théorème de Rolle et Théorème des Accroissements Finis (TAF) INTERDITS (réservés à la branche Sciences Mathématiques). Utiliser uniquement le TVI ou l'étude du signe de la dérivée.
3. Intégration par changement de variable INTERDITE en PC/SVT (utiliser uniquement les primitives directes et l'IPP).
4. Sommes de Riemann et racines n-ièmes de l'unité INTERDITES en PC/SVT.`;
    } else if (normLevel === '2bac_sm') {
      specificLevelRules = `
- Niveau ciblé : 2ème Année Baccalauréat - Sciences Mathématiques A & B (BIOF).
- Référentiel pédagogique : Orientations Pédagogiques Officielles de l'Inspection Générale de Mathématiques (SM).
- Rigueur formelle absolue : Utilisation précise des quantificateurs ($\\forall, \\exists, \\exists!$) et raisonnements axiomatiques complets (absurde, contraposée, récurrence forte, disjonction des cas).
- Analyse : Théorème de Rolle, Théorème des Accroissements Finis (TAF), Inégalité des Accroissements Finis (IAF), continuité uniforme, sommes de Riemann, fonction Arctangente ($\\arctan$).
- Structures algébriques : Lois de composition interne, groupes, sous-groupes, anneaux, corps, morphismes.
- Arithmétique dans $\\mathbb{Z}$ : Division euclidienne, congruences modulo $n$, théorèmes de Bézout, Gauss et petit théorème de Fermat.
- Nombres complexes avancés : Racines n-ièmes de l'unité, similitudes directes.`;

      prohibitions = `
⚠️ Consignes méthodologiques SM :
1. La règle de L'Hôpital est également proscrite au Bac National marocain SM : privilégier les limites usuelles, le TAF ou les développements limités autorisés.
2. Toute utilisation d'un théorème sans vérification intégrale préalable de toutes ses hypothèses entraîne une pénalité sur le barème officiel.`;
    } else if (normLevel === '1bac_sci' || normLevel === '1bac_sm') {
      specificLevelRules = `
- Niveau ciblé : 1ère Année Baccalauréat (${normLevel === '1bac_sm' ? 'Sciences Mathématiques' : 'Sciences Expérimentales & Tech'} - BIOF).
- Limites : Calcul algébrique rigoureux (factorisation, quantité conjuguée, limites trigonométriques usuelles).
- Dérivation : Taux d'accroissement, nombre dérivé, équation de la tangente $y = f'(x_0)(x-x_0) + f(x_0)$, lien entre signe de $f'(x)$ et sens de variation.
- Barycentre & Produit scalaire : Propriété caractéristique vectorielle, calcul de coordonnées, ensembles de points, formules trigonométriques d'Al-Kashi et de la médiane.`;

      prohibitions = `
⚠️ Interdictions pour la 1ère Bac :
1. Pas d'intégrales ni de calcul de primitives (programme de 2Bac).
2. Pas de fonctions logarithmes (ln) ni exponentielles (exp).
3. Pas de nombres complexes.`;
    } else {
      specificLevelRules = `
- Niveau ciblé : Tronc Commun (${normLevel.includes('arts') ? 'Lettres & Sciences Humaines' : 'Scientifique & Technologique'}).
- Notions : Arithmétique dans $\\mathbb{N}$ (divisibilité, nombres premiers, PGCD, PPCM), calcul vectoriel dans le plan (relation de Chasles, colinéarité), équations et inéquations du 2nd degré (discriminant $\\Delta$), ordre et valeur absolue.`;

      prohibitions = `
⚠️ Interdictions pour le Tronc Commun :
1. Aucune notion de limite n'est permise.
2. Aucune notion de dérivation n'est permise (l'étude de la monotonie se fait uniquement par le taux d'accroissement $T = \\frac{f(x)-f(y)}{x-y}$).`;
    }

    return `${specificLevelRules}\n${prohibitions}`;
  }
}

/**
 * Filtre et supprime le barème indicatif si le document n'est pas un devoir surveillé (فرض محروس) ou un examen officiel
 */
export function filterBaremeByDocType(text, docType = 'course', docTitle = '') {
  if (!text || typeof text !== 'string') return text;

  const isHomework = docType === 'homework' || /فرض|devoir|contr[ôo]le/i.test(docTitle || '');
  const isExamOrDevoir = isHomework || docType === 'national' || docType === 'concours' || /examen|امتحان|مباراة/i.test(docTitle || '');

  // Si c'est un devoir surveillé ou examen officiel, conserver le barème
  if (isExamOrDevoir) return text;

  let cleaned = text;

  // 1. Supprimer la section de barème avec titre Markdown et tableau associé :
  // e.g. "#### 2. Barème indicatif officiel (Évaluation de type Examen) :\n\n| Question | Étape du barème | Note attribuée |...\n| Total | | 5,00 pts |"
  cleaned = cleaned.replace(
    /(?:^|\n)(?:#{1,6}|\*\*)\s*(?:\d+[\.\)]\s*)?(?:Barème|Bareme|Grille de notation|Grille d'évaluation|سلم التنقيط|شبكة التنقيط|جدول التنقيط)[^\n]*(?:\*\*)?:?\s*\n+(?:\|[^\n]+\|\r?\n*)+/gi,
    '\n'
  );

  // 2. Supprimer tout tableau Markdown isolé contenant des colonnes de barème / notes
  cleaned = cleaned.replace(
    /(?:^|\n)(\|[^\n]*(?:bar[èe]me|note attribu[ée]e|سلم التنقيط|النقطة الممنوحة|grille de notation|نقطة الاستحقاق)[^\n]*\|\r?\n(?:\|[-:\s|]+\|\r?\n)?(?:\|[^\n]+\|\r?\n*)+)/gi,
    '\n'
  );

  // 3. Supprimer tout titre orphelin restant annonçant le barème
  cleaned = cleaned.replace(
    /(?:^|\n)(?:#{1,6}|\*\*)\s*(?:\d+[\.\)]\s*)?(?:Barème indicatif|Bareme indicatif|Grille de notation|Grille d'évaluation|سلم التنقيط|شبكة التنقيط|جدول التنقيط)[^\n]*(?:\*\*)?:?/gi,
    ''
  );

  // 4. Supprimer les puces résiduelles mentionnant le barème
  cleaned = cleaned.replace(
    /(?:^|\n)\s*[-*•]\s*(?:Un barème indicatif|Barème indicatif|سلم التنقيط|توزيع النقط)[^\n]*/gi,
    ''
  );

  // Nettoyer les sauts de ligne consécutifs excessifs
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Construit le prompt système d'Inspecteur Pédagogique Marocain
 */
function buildMoroccanInspectorSystemPrompt({
  level,
  subject,
  language,
  docTitle,
  chapterTitle,
  sectionTitle,
  contenus,
  capacitesAttendues,
  secType = 'exercise',
  docType = 'course'
}) {
  const normLevel = normalizeLevel(level);
  const isAr = language === 'ar';
  const levelDisplayName = getLevelDisplayName(normLevel, isAr);
  const detectedDomain = detectLessonDomain('', { docTitle, chapterTitle, sectionTitle, contenus, capacitesAttendues });
  const pedagogicalDirectives = getMoroccanPedagogicalDirectives(normLevel, detectedDomain, isAr);
  const isDemonstration = secType === 'theorem' || secType === 'property' || secType === 'corollary';

  // Conditionner le barème : UNIQUEMENT pour les devoirs surveillés (فرض محروس) et examens
  const isHomework = docType === 'homework' || /فرض|devoir|contr[ôo]le/i.test(docTitle || chapterTitle || sectionTitle || '');
  const isExamOrDevoir = isHomework || docType === 'national' || docType === 'concours' || /examen|امتحان|مباراة/i.test(docTitle || chapterTitle || sectionTitle || '');

  const baremeDirectiveAr = isExamOrDevoir
    ? `3. 📊 سلم التنقيط التقديري الرسمي (يُوضع حصراً في نهاية الإجابة بعد الانتهاء التام من الحل المفصل):
   - ضع جدولاً ختامياً لتوزيع النقط (Barème indicatif) على مراحل الإجابة (0.25 pt, 0.5 pt...) بحيث يطابق مجموعها النقطة الإجمالية للتمرين.
   - ⚠️ تأكيد حاسم: هذا الجدول يأتي فقط كملحق ختامي ولا يحل إطلاقاً محل الحل المفصل. الحل المفصل لكل سؤال هو الأصل الإلزامي.`
    : `3. ⚠️ حظر جدول التنقيط: هذه الوثيقة عبارة عن (درس نظري / سلسلة تمارين) وليست فرضاً محروساً ولا امتحاناً. يُمنع منعاً باتاً استخراج أو كتابة جدول سلم التنقيط (Barème indicatif) أو توزيع النقط (pts)! اقتصر حصرياً على الشرح المنهجي والحل والتعليلات الرياضية دون أي تقييم نقطي.`;

  const baremeDirectiveFr = isExamOrDevoir
    ? `3. 📊 BARÈME INDICATIF OFFICIEL (STRICTEMENT EN FIN DE RÉPONSE APRÈS LE CORRIGÉ COMPLET) :
   - Insère en toute fin de document un tableau récapitulatif du barème indicatif estimé (ex: 0.25 pt, 0.5 pt, Total pts) conforme aux critères officiels marocains.
   - ⚠️ RAPPEL STRICT : Ce tableau vient TOUJOURS EN COMPLÉMENT à la fin et NE REMPLACE EN AUCUN CAS la rédaction mathématique détaillée de toutes les questions.`
    : `3. ⚠️ RÈGLE STRICTE SUR LE BARÈME : Le document actuel est un (Cours / Série d'exercices) et NON un Devoir Surveillé ni un Examen. Il est STRICTEMENT INTERDIT d'inclure un tableau de barème indicatif, une grille de notation ou une attribution de points (ex: 0.5 pt, Total pts, Barème indicatif officiel). Rédige exclusivement le corrigé mathématique sans barème ni notation.`;

  if (isAr) {
    return `أنت مفتش تربوي تخصصي لمادة الرياضيات بوزارة التربية الوطنية والتعليم الأولي والرياضة بالمملكة المغربية، وأستاذ مبرز خبير في التدريس بالثانوي التأهيلي، ومسؤول عن إعداد وتدقيق عناصر الإجابة الرسمية وشبكات التنقيط للامتحانات الإشهادية الوطنية والمباريات.

المستوى الدراسي المستهدف: ${levelDisplayName}
المادة: ${subject || 'الرياضيات'}
${chapterTitle || docTitle ? `عنوان الدرس / الوحدة: ${chapterTitle || docTitle}` : ''}
${sectionTitle ? `عنوان الفقرة / التمرين: ${sectionTitle}` : ''}
${isDemonstration ? 'النوع المستهدف: برهان رياضي رسمي لخاصية أو مبرهنة' : 'النوع المستهدف: حل نموذجي لتمرين / مسألة توليفية'}

🎯 المهمة الرسمية:
تقديم حل نموذجي، متكامل، ودقيق بيداغوجياً ورياضياً للتمرين المقترح، تماماً كما يصوغه الأستاذ أو المفتش التربوي المغربي في عناصر الإجابة الرسمية للامتحان الوطني للبكالوريا وفروض المراقبة المستمرة.

📋 التوجيهات التربوية الرسمية الخاصة بالمستوى والمبحث:
${pedagogicalDirectives}

⚠️ هيكلة الإجابة الإلزامية والصارمة (يجب احترام الترتيب بدقة):
1. 📝 الحل الرياضي المفصل والشامل (إلزامي بنسبة 100% وهو متن الإجابة الأساسي):
   - يجب حل جميع أسئلة التمرين (1., 2. أ), 2. ب), 3., إلخ) بالتفصيل التام وبترتيبها الأصلي.
   - ذكر كل خطوات الحساب الجبري والتحليلي، ومراحل الاستدلال الرياضي، والتحقق المسبق من الشروط القبلية للنظريات (TVI، الاتصال، الرتابة، قابلية الاشتقاق).
   - تأطير النتائج والخلاصات النهائية بدقة بـ \\boxed{...}.
   - ⛔ تحذير قاطع: يُمنع منعاً كلياً الاقتصار على جدول سلم التنقيط، أو تقديم جدول النقط بدلاً من خطوات الحل المفصلة! الحل الرياضي المفصل هو الأهم والمطلوب أولاً.

2. 💡 إضاءة تربوية للمفتش (Remarque Pédagogique):
   - تنبيه موجز حول الأخطاء الشائعة في الامتحانات وكيفية تجنبها.

${baremeDirectiveAr}

📐 القواعد المنهجية والصياغة الإلزامية:
1. التطابق الصارم مع ترقيم أسئلة التمرين:
   - اتبع بدقة ترقيم وتقسيم أسئلة التمرين كما وردت في الإشعار (1., 2. أ), 2. ب), 3., إلخ).
2. التحقق المنهجي المسبق من شروط النظريات:
   - لا تطبق مبرهنة (TVI، رول، قابلية الاشتقاق، المكاملة بالأجزاء، تزايدية المتتالية) دون ذكر الشروط القبلية وتحققها صراحة.
3. التمييز المنطقي الدقيق بين الاستلزام والتكافؤ:
   - استخدم ($\\implies$) و ($\\iff$) بدقة متناهية، وتجنب الخلط بينهما.
4. إتقان صياغة LaTeX و KaTeX وضوابط الجداول والقسمة الإقليدية:
   - اكتب جميع الرموز الرياضية في صيغة LaTeX نظيفة: استخدم $...$ للصيغ في السطر و $$...$$ للصيغ المستقلة.
   - أطر النتائج النهائية بوضوح باستخدام \\boxed{...}.
   - ⚠️ حظر تام للتعليمة \\cline (لأن KaTeX لا يدعمها وتتسبب في إتلاف العرض). استخدم دائماً \\hline للفواصل الأفقية، ولا تكتب \\cline أبداً!
   - ⚠️ التأطير الإلزامي بـ $$ ... $$ لجميع الجداول: افتح بـ $$ قبل \\begin{array} واغلق بـ $$ بعد \\end{array}.
   - نموذج جدول الإشارة (Tableau de signes) المعتمد:
     $$\\begin{array}{|c|ccccccccc|} \\hline x & -\\infty & & x_1 & & x_2 & & +\\infty \\\\ \\hline ax+b & & - & 0 & + & | & + & \\\\ \\hline P(x) & & + & 0 & - & 0 & + & \\\\ \\hline \\end{array}$$
   - نموذج القسمة الإقليدية للحدوديات: استخدم جدولاً بعمودين باستخدام \\hline فقط (بدون \\cline نهائياً)، أو اعتمد جدول هورنر (Tableau de Horner) أو المطابقة الجبرية: $P(x) = (x - \\alpha)(a x^2 + b x + c)$.
5. البدء المباشر:
   - ابدأ مباشرة بحل السؤال الأول دون أي مقدمات ترحيبية أو عبارات ثانوية ("إليك الحل", "يسعدني أن أقدم لك").`;
  } else {
    return `Tu es Inspecteur Pédagogique National de Mathématiques auprès du Ministère de l'Éducation Nationale du Maroc, et Professeur Agrégé de l'Enseignement Secondaire Qualifiant, expert dans la conception des corrigés officiels et des barèmes du Baccalauréat marocain et des concours nationaux.

Niveau scolaire ciblé : ${levelDisplayName}
Discipline : ${subject || 'Mathématiques'}
${chapterTitle || docTitle ? `Chapitre / Titre du cours : ${chapterTitle || docTitle}` : ''}
${sectionTitle ? `Section / Exercice : ${sectionTitle}` : ''}

🎯 Mission officielle :
Rédiger le corrigé officiel, rigoureux, exhaustif et hautement pédagogique de l'exercice proposé, en adoptant exactement la démarche méthodologique d'un inspecteur ou professeur agrégé marocain, dans le respect scrupuleux et absolu des Orientations Pédagogiques Officielles marocaines.

📋 Orientations Pédagogiques Officielles pour ce niveau et ce chapitre :
${pedagogicalDirectives}

⚠️ STRUCTURE IMPÉRATIVE ET HIÉRARCHIE DE LA RÉPONSE :
1. 📝 CORRIGÉ MATHÉMATIQUE COMPLET ET DÉTAILLÉ (OBLIGATOIRE À 100% - CORPS PRINCIPAL) :
   - Commence DIRECTEMENT par la résolution question par question (1., 2.a., 2.b., 3., etc.).
   - Développe intégralement tous les calculs, factorisations, discriminants, limites, dérivées, tableaux de signes KaTeX et justifications rigoureuses de théorèmes.
   - Encadre chaque conclusion ou résultat final dans \\boxed{...}.
   - ⛔ INTERDICTION FORMELLE : Ne fournis JAMAIS uniquement le tableau de barème ! Tu ne dois sous aucun prétexte résumer les étapes dans le barème sans avoir rédigé la résolution mathématique complète au préalable.

2. 💡 ÉCLAIRAGE PÉDAGOGIQUE :
   - Conseils méthodologiques et pièges d'examen classiques à éviter.

${baremeDirectiveFr}

📐 Règles méthodologiques et rédactionnelles impératives :
1. Respect absolu de la numérotation :
   - Conserve rigoureusement la numérotation des questions de l'énoncé (ex: 1., 2.a., 2.b., 3., etc.).
2. Justification préalable systématique des hypothèses :
   - Ne jamais énoncer une conclusion de théorème (TVI, bijection, dérivabilité, IPP, convergence de suites) sans avoir explicité et vérifié au préalable chacune de ses hypothèses.
3. Rigueur logique et rédactionnelle :
   - Distinguer soigneusement l'implication ($\\implies$) et l'équivalence ($\\iff$).
   - Formuler les démonstrations selon le style académique officiel marocain : "Soit $x \\in \\mathcal{D}_f$...", "Puisque la fonction $f$ est...", "Or d'après...", "Donc...", "D'où...", "Conclusion :".
4. Typographie mathématique KaTeX / LaTeX impeccable & Règles des Tableaux :
   - Écrire TOUTES les expressions mathématiques en syntaxe KaTeX irréprochable : $...$ pour l'inline et $$...$$ pour les blocs.
   - Encadrer systématiquement chaque résultat final dans une boîte : \\boxed{...}.
   - ⚠️ RÈGLE CRUCIALE POUR \\boxed{...} : Ne JAMAIS mettre \\text{...} autour de formules mathématiques ou de quantificateurs (écris \\boxed{\\exists x_0 \\in I, f(x_0) = 0} et SURTOUT PAS \\boxed{\\text{\\exists...}} car cela détruit le rendu KaTeX !). N'utilise \\text{...} que pour des phrases textuelles pures sans symboles.
   - ⚠️ ESPACEMENT DES SYMBOLES : Toujours séparer les quantificateurs et symboles de leurs variables par un espace : écris \\exists x \\in I (avec espaces) et NON \\existsx \\inI. Pour la non-appartenance, écris toujours \\notin (ex: \\sqrt{2} \\notin \\mathbb{Q}).
   - ⚠️ INTERDICTION STRICTE DE LA COMMANDE \\cline : KaTeX ne supporte pas \\cline (cela provoque un échec d'affichage). Utiliser EXCLUSIVEMENT \\hline pour toutes les lignes horizontales !
   - ⚠️ ENCADREMENT PAR $$ ... $$ : Tout environnement \\begin{array} ... \\end{array} DOIT ÊTRE OBLIGATOIREMENT encadré par $$ ouvrant et $$ fermant.
   - Modèle officiel pour le Tableau de Signes :
     $$\\begin{array}{|c|ccccccccc|} \\hline x & -\\infty & & x_1 & & x_2 & & +\\infty \\\\ \\hline a x + b & & - & 0 & + & | & + & \\\\ \\hline P(x) & & + & 0 & - & 0 & + & \\\\ \\hline \\end{array}$$
   - Modèle officiel pour la Division Euclidienne : utiliser un tableau à deux colonnes avec \\hline uniquement (JAMAIS \\cline), OU le Tableau de Horner (\\begin{array}{|c|c|c|c|} ... \\end{array}), OU l'égalité par identification des coefficients : $P(x) = (x - \\alpha)(a x^2 + b x + c)$.
5. Démarrage direct :
   - Commence DIRECTEMENT par la résolution de la première question, sans phrase d'introduction ni politesse superficielle.`;
  }
}

/**
 * Fonction principale de résolution d'exercices par IA
 * Intègre les orientations pédagogiques marocaines et le style de l'inspecteur
 */
export async function solveExerciseWithAI(exerciseContent, options = {}) {
  const {
    level = '2bac_pc_svt',
    subject = 'Mathématiques',
    language = 'fr',
    docTitle = '',
    chapterTitle = '',
    sectionTitle = '',
    secType = 'exercise',
    docType = 'course',
    capacitesAttendues = '',
    contenus = '',
    customInstructions = ''
  } = options;

  if (!exerciseContent || !exerciseContent.trim()) {
    throw new Error(
      language === 'ar'
        ? 'يرجى كتابة نص التمرين أولاً ليتمكن الذكاء الاصطناعي من حله.'
        : "Veuillez d'abord rédiger l'énoncé de l'exercice avant de demander sa résolution par IA."
    );
  }

  // 1. Paramètres des Fournisseurs IA
  const deepseekAllowed = localStorage.getItem('deepseek_solve_solutions') !== 'false';
  const geminiAllowed = localStorage.getItem('gemini_solve_solutions') !== 'false';
  const claudeAllowed = localStorage.getItem('claude_solve_solutions') !== 'false';

  const deepseekKey = (localStorage.getItem('deepseekApiKey') || '').trim();
  const deepseekUrl = (localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com').trim().replace(/\/$/, '');
  const geminiKey = (localStorage.getItem('geminiApiKey') || localStorage.getItem('gemini_api_key') || '').trim();
  const claudeKey = (localStorage.getItem('claudeApiKey') || '').trim();

  // Vérifier si tous les moteurs sont désactivés
  if (!deepseekAllowed && !geminiAllowed && !claudeAllowed) {
    throw new Error('La résolution des exercices est désactivée dans les Paramètres IA. Veuillez activer la case "Résoudre les exercices" pour au moins un fournisseur.');
  }

  // Déterminer les moteurs candidats
  const availableEngines = [];
  if (deepseekAllowed && deepseekKey) availableEngines.push('deepseek');
  if (geminiAllowed && geminiKey) availableEngines.push('gemini');
  if (claudeAllowed && claudeKey) availableEngines.push('claude');

  if (availableEngines.length === 0) {
    if (!deepseekKey && !geminiKey && !claudeKey) {
      throw new Error('Aucune clé API configurée. Veuillez renseigner votre clé DeepSeek, Gemini ou Claude dans les Paramètres (Admin Settings).');
    } else {
      throw new Error('La résolution automatique des exercices est décochée pour vos fournisseurs configurés. Activez "Résoudre les exercices" dans les Paramètres IA.');
    }
  }

  const isAr = language === 'ar' || /[\u0600-\u06FF]/.test(exerciseContent);
  const resolvedLang = isAr ? 'ar' : 'fr';

  // Construction du Prompt Système Spécifique
  const systemPrompt = buildMoroccanInspectorSystemPrompt({
    level,
    subject,
    language: resolvedLang,
    docTitle: docTitle || chapterTitle,
    chapterTitle: chapterTitle || docTitle,
    sectionTitle,
    contenus,
    capacitesAttendues,
    secType,
    docType
  });

  const isHomework = docType === 'homework' || /فرض|devoir|contr[ôo]le/i.test(docTitle || chapterTitle || sectionTitle || '');
  const isExamOrDevoir = isHomework || docType === 'national' || docType === 'concours' || /examen|امتحان|مباراة/i.test(docTitle || chapterTitle || sectionTitle || '');

  const userPrompt = resolvedLang === 'ar'
    ? `نص التمرين (${subject || 'الرياضيات'} - ${docTitle || chapterTitle || 'تمرين'} ${sectionTitle ? `| ${sectionTitle}` : ''}) :

${exerciseContent.trim()}

${customInstructions ? `تعليمات إضافية خاصة : ${customInstructions}\n\n` : ''}المطلوب إنجازه بدقة وإلزام :
1. أكتب أولاً الحل الرياضي المفصل والشامل خطوة بخطوة لكل الأسئلة والأسئلة الفرعية (مع كافة الحسابات والتعليلات وتأطير النتائج النهائية بـ \\boxed{...}).
2. أضف بعد الحل "💡 إضاءة تربوية للمفتش"${isExamOrDevoir ? ' ثم جدول سلم التنقيط التقديري الرسمي (Barème indicatif) كملحق تقييمي ختامي' : ''}.
⛔ تحذير: لا تقدم جدول التنقيط بمفرده أبداً! كتابة خطوات الحل الرياضي المفصل والشامل لجميع الأسئلة إجبارية وأساسية!`
    : `Énoncé de l'exercice (${subject || 'Mathématiques'} - ${docTitle || chapterTitle || 'Exercice'} ${sectionTitle ? `| ${sectionTitle}` : ''}) :

${exerciseContent.trim()}

${customInstructions ? `Instructions supplémentaires : ${customInstructions}\n\n` : ''}Livrable exigé :
1. Rédige d'abord l'intégralité du corrigé mathématique détaillé question par question (avec tous les calculs, factorisations, tableaux de signes et résultats encadrés dans \\boxed{...}).
2. Ajoute à la suite la "💡 Remarque Pédagogique de l'Inspecteur"${isExamOrDevoir ? ' puis le tableau récapitulatif du barème indicatif officiel en fin de document' : ''}.
⛔ RAPPEL CRUCIAL : Ne donne JAMAIS le tableau de barème seul ! La résolution mathématique exhaustive de toutes les questions est OBLIGATOIRE et doit impérativement figurer en premier !`;

  let lastError = null;

  // ── 1. Engine 1 : DeepSeek (Excellence pour le raisonnement mathématique) ──
  if (availableEngines.includes('deepseek')) {
    try {
      const endpoint = `${deepseekUrl}/v1/chat/completions`;
      const response = await fetch(endpoint, {
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
          temperature: 0.15,
          max_tokens: 8000
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Erreur DeepSeek HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return filterBaremeByDocType(content.trim(), docType, docTitle || chapterTitle);
      }
    } catch (err) {
      console.warn('[AI Solver] DeepSeek solver failed, attempting fallback...', err.message);
      lastError = err;
    }
  }

  // ── 2. Engine 2 : Google Gemini (Haute disponibilité et rapidité) ──
  if (availableEngines.includes('gemini')) {
    const storedModel = (localStorage.getItem('geminiModel') || '').trim();
    let preferredModel = storedModel;
    if (!preferredModel || ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', '3.7', 'gemini-3.7', 'gemini-3.7-flash', '3.5'].includes(preferredModel)) {
      preferredModel = 'gemini-3.1-flash-lite';
    }
    const uniqueModels = Array.from(new Set([preferredModel, 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest']));

    for (const model of uniqueModels) {
      try {
        if (geminiKey && geminiKey.trim()) {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey.trim()}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userPrompt }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: {
                temperature: 0.15,
                topK: 40,
                maxOutputTokens: 8192
              }
            })
          });
          if (response.ok) {
            const data = await response.json();
            const text = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
            if (text.trim()) return filterBaremeByDocType(text.trim(), docType, docTitle || chapterTitle);
          }
        }
        // Proxy fallback
        const proxyRes = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            apiKey: geminiKey || undefined,
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: 0.15,
              topK: 40,
              maxOutputTokens: 8192
            }
          })
        });
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          const text = (proxyData?.data?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
          if (text.trim()) {
            return filterBaremeByDocType(text.trim(), docType, docTitle || chapterTitle);
          }
        }
      } catch (err) {
        console.warn(`[ExerciseSolver] Gemini ${model} failed:`, err.message);
        lastError = err;
      }
    }
  }

  // ── 3. Engine 3 : Anthropic Claude ──
  if (availableEngines.includes('claude')) {
    try {
      const endpoint = 'https://api.anthropic.com/v1/messages';
      const response = await fetch(endpoint, {
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
          max_tokens: 8000,
          temperature: 0.15
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Erreur Claude HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data?.content?.[0]?.text;
      if (text && text.trim()) {
        return filterBaremeByDocType(text.trim(), docType, docTitle || chapterTitle);
      }
    } catch (err) {
      console.warn('[AI Solver] Claude solver failed:', err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Impossible de résoudre l’exercice avec l’IA. Vérifiez votre connexion et vos clés API.');
}
