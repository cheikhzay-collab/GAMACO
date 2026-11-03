// src/services/translationService.js
// خدمة الترجمة بالذكاء الاصطناعي — تدعم Gemini و DeepSeek
// تُترجم دروس الرياضيات مع الحفاظ على LaTeX والمصطلحات المغربية الدقيقة

/**
 * قاموس المصطلحات الرياضية المغربية (فرنسي → عربي)
 */
const MOROCCAN_MATH_GLOSSARY = `
=== قاموس مصطلحات الرياضيات المغربية (يجب الالتزام بها) ===

** المتتاليات (Suites) **
Suite numérique → متتالية عددية
Suite arithmétique → متتالية حسابية (حسابية وليس "عددية" أو "حسبية")
Suite géométrique → متتالية هندسية
Suite croissante → متتالية متزايدة
Suite décroissante → متتالية متناقصة
Suite monotone → متتالية رتيبة
Suite bornée → متتالية محدودة
Suite convergente → متتالية متقاربة
Suite divergente → متتالية متباعدة
Suite stationnaire → متتالية ثابتة
Raison (arithmétique) → الأساس (للمتتالية الحسابية) - يُكتب r
Raison (géométrique) → الأساس (للمتتالية الهندسية) - يُكتب q
Premier terme → الحد الأول
Terme général → الحد العام
Terme d'une suite → حد المتتالية
Limite d'une suite → نهاية متتالية
Somme des termes → مجموع الحدود
Récurrence → التراجع / بالتراجع

** التحليل والاشتقاق (Analyse / Dérivation) **
Dérivée → المشتقة
Dérivée seconde → المشتقة الثانية
Dérivabilité → القابلية للاشتقاق
Fonction dérivée → الدالة المشتقة
Taux de variation → معدل التغير / نسبة التغير
Tangente → المماس
Extremum → النهاية العظمى / النهاية الصغرى
Maximum → النهاية العظمى (الحد الأعظم)
Minimum → النهاية الصغرى (الحد الأدنى)
Tableau de variations → جدول التغيرات
Croissant / Décroissant → متزايدة / متناقصة
Fonction → دالة / دوال (جمع)
Limite d'une fonction → نهاية دالة
Continuité → الاستمرارية

** التكامل (Intégration) **
Intégrale → التكامل
Primitive → الدالة الأصلية / الدالة البدئية
Intégration par parties → التكامل بالتجزئة
Aire → المساحة

** الهندسة والأشعة (Géométrie / Vecteurs) **
Vecteur → متجه / متجهات (جمع)
Norme d'un vecteur → معامل المتجه / القيمة المطلقة للمتجه
Produit scalaire → الجداء السلمي
Plan → المستوى
Droite → مستقيم / مستقيمات (جمع)
Cercle → دائرة
Sphère → كرة

** الإحصاء والاحتمالات (Stats / Probabilités) **
Probabilité → الاحتمال
Événement → حدث / أحداث
Variable aléatoire → متغيرة عشوائية
Espérance → الأمل الرياضي
Variance → التباين
Écart-type → الانحراف المعياري
Loi binomiale → القانون ذو الحدين / القانون الثنائي
Loi normale → القانون الطبيعي

** المنطق والمجموعات (Logique / Ensembles) **
Assertion / Proposition → قضية / قضايا
Implication → استلزام
Équivalence → تكافؤ
Négation → نفي
Quantificateur universel (∀) → كمّي الكليّ (لكل)
Quantificateur existentiel (∃) → كمّي الوجود (يوجد)
Ensemble → مجموعة
Sous-ensemble → مجموعة جزئية
Intersection → التقاطع
Union → الاتحاد
Complémentaire → المتمم

** المصفوفات والأنظمة (Matrices / Systèmes) **
Matrice → مصفوفة / مصفوفات
Déterminant → المحدد
Système d'équations → جملة معادلات

** قواعد الترجمة العامة **
- "On a" → "لدينا" أو "يكون"
- "Soit" → "ليكن" / "لتكن" (حسب المؤنث والمذكر)
- "D'où" → "ومنه" / "وعليه"
- "Donc" → "إذاً" / "وبذلك"
- "Or" → "غير أن" / "بيد أن"
- "Car" → "لأن"
- "En effet" → "في الواقع" / "فعلاً"
- "Ainsi" → "هكذا" / "وهكذا"
- "tel que" → "حيث" / "بحيث"
- "si et seulement si" → "إذا وفقط إذا"
- "pour tout" → "لكل"
- "il existe" → "يوجد"
- "vérifier" → "تحقق من أن" / "التحقق"
- "montrer" / "démontrer" → "بيّن أن" / "أثبت أن"
- "calculer" → "احسب"
- "déduire" → "استنتج"
- "on pose" → "نضع"
- "Exercice" → "تمرين"
- "Solution" / "Correction" → "الحل" / "التصحيح"
- "Cours" / "Leçon" → "الدرس"
- "Définition" → "تعريف"
- "Théorème" → "مبرهنة"
- "Propriété" → "خاصية"
- "Remarque" → "ملاحظة"
- "Exemple" → "مثال"
`;

/**
 * بناء prompt الترجمة المتخصص
 */
function buildTranslationPrompt(lesson, targetLang) {
  const langName = targetLang === 'ar' ? 'العربية المغربية' : targetLang === 'en' ? 'الإنجليزية' : 'الفرنسية';
  const rtlNote = targetLang === 'ar' ? `
- النص العربي يُكتب من اليمين إلى اليسار (RTL).
- استخدم صياغة الأستاذ المغربي في تدريس الرياضيات، وليس ترجمة حرفية.
- المصطلحات الرياضية يجب أن تتطابق مع ما هو موجود في الكتاب المدرسي المغربي.
- حوّل وحدات النقط من الفرنسية إلى العربية: "(1 pt)" أو "(2 pts)" تُصبح "(1 ن)" أو "(2 ن)".
${MOROCCAN_MATH_GLOSSARY}
` : `
- Le texte français s'écrit de gauche à droite (LTR).
- Utilise rigoureusement la terminologie mathématique marocaine officielle du programme BIOF (Baccalauréat International Option Français).
- Traduis fidèlement et rigoureusement tous les énoncés, questions, consignes, solutions et titres en français.
- Convertis les unités de barème arabes "(1 ن)" en notation française : "(1 pt)" ou "(x pts)".
`;

  return `أنت مترجم متخصص في ترجمة الدروس والامتحانات الرياضية المغربية إلى ${langName}.

## قواعد صارمة يجب اتباعها:
1. **الحفاظ على LaTeX**: كل معادلة تبدأ بـ $ أو $$ أو \\begin تُحافظ عليها كما هي بدون أي تغيير. لا تترجم أي رموز رياضية.
2. **Markdown**: الحفاظ على تنسيق **نص غامق** و*نص مائل* كما هو.
3. **هيكل JSON**: الإخراج يجب أن يكون JSON صالح 100% بنفس هيكل الإدخال. لا تُضف تعليقات // داخل JSON.
4. **لا تُضف ولا تحذف**: لا تُضف شرحاً إضافياً، ترجم فقط.
5. **ترجمة كائن header بالكامل**:
   - ترجم fiche_title إلى ${langName}.
   - اجعل حقل subject هو "${targetLang === 'ar' ? 'الرياضيات' : targetLang === 'en' ? 'Mathematics' : 'Mathématiques'}".
   - ترجم prep_title أو level إن وُجدا إلى ما يقابلهما في ${langName}.
6. **ترجمة الأقسام والتمارين**:
   - ترجم title (مثلاً: "تمرين 1" ↔ "Exercice 1").
   - ترجم نصوص الأسئلة text و content و solution بالكامل إلى ${langName}.
${rtlNote}

## الدرس أو الامتحان المطلوب ترجمته:
${JSON.stringify(lesson.content, null, 2)}

## المطلوب:
أرجع JSON كامل يمثل محتوى الدرس/الامتحان المترجم بالكامل إلى ${langName}.
- ترجم حقول: title, section_header, accent_text, text, content, solution, label وما شابهها.
- لا تترجم: id, type, section_number, question_idx, expected_answer, notation_columns (math_blocks), table_data.
- عنوان الدرس/الامتحان الرئيسي في header يُترجم أيضاً.

أرجع فقط JSON نقياً بدون أي نص إضافي قبله أو بعده، ابدأ مباشرة بـ { :`;
}

/**
 * استدعاء Gemini API
 */
async function callGemini(prompt, geminiKey, model = 'gemini-2.5-flash') {
  let cleanModel = (model || '').trim();
  if (!cleanModel || ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', '3.7', '3.5'].includes(cleanModel)) {
    cleanModel = 'gemini-2.5-flash';
  }

  // If client key is available, try direct call
  if (geminiKey && geminiKey.trim()) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${geminiKey.trim()}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const candidate = data?.candidates?.[0];
        if (candidate?.content?.parts) {
          const nonThoughtParts = candidate.content.parts.filter(p => !p.thought);
          const text = (nonThoughtParts.length > 0 ? nonThoughtParts : candidate.content.parts).map(p => p.text || '').join('');
          if (text.trim()) return text;
        }
      }
    } catch (_) {}
  }

  // Fallback to server proxy with server API key
  const proxyRes = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cleanModel,
      apiKey: geminiKey || undefined,
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    })
  });

  if (!proxyRes.ok) {
    const err = await proxyRes.json().catch(() => ({}));
    throw new Error(err?.error || `Gemini HTTP ${proxyRes.status}`);
  }

  const proxyData = await proxyRes.json();
  const candidate = proxyData?.data?.candidates?.[0];
  if (!candidate || !candidate.content?.parts) {
    throw new Error('لم يُرجع Gemini أي محتوى');
  }

  const nonThoughtParts = candidate.content.parts.filter(p => !p.thought);
  const text = (nonThoughtParts.length > 0 ? nonThoughtParts : candidate.content.parts)
    .map(p => p.text || '')
    .join('');
  if (!text) throw new Error('لم يُرجع Gemini أي نص');
  return text;
}

/**
 * استدعاء DeepSeek API (متوافق مع OpenAI)
 */
async function callDeepSeek(prompt, deepseekKey, deepseekUrl, model = 'deepseek-chat') {
  const baseUrl = (deepseekUrl || 'https://api.deepseek.com').replace(/\/$/, '');
  const endpoint = `${baseUrl}/v1/chat/completions`;

  const rawModel = model || 'deepseek-chat';
  const normalizedModel = (rawModel === 'deepseek-v4-pro' || rawModel === 'deepseek-r1')
    ? 'deepseek-reasoner'
    : (rawModel === 'deepseek-v4-flash' || rawModel === 'deepseek-v3')
      ? 'deepseek-chat'
      : rawModel;

  const payload = {
    model: normalizedModel,
    messages: [
      {
        role: 'system',
        content: 'أنت مترجم ومتخصص في المحتوى البيداغوجي والرياضي المغربي. تُرجع دائماً JSON نقياً صالحاً بدون أي تعليقات أو نص إضافي.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 32000,
  };

  if (!normalizedModel.includes('reasoner') && !normalizedModel.includes('pro')) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekKey}`,
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `DeepSeek HTTP ${response.status}`);
  }

  const data = await response.json();
  let text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('لم يُرجع DeepSeek أي نص');

  if (text.includes('</think>')) {
    text = text.split('</think>').pop().trim();
  }

  return text;
}

/**
 * تنظيف ناتج JSON (إزالة ```json ... ``` والتعليقات)
 */
function cleanJsonOutput(raw) {
  let cleaned = raw.trim();
  // إزالة code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  // إزالة تعليقات // من JSON (مشكلة شائعة مع DeepSeek)
  cleaned = cleaned.replace(/\/\/[^\n\r"]*/g, '');
  return cleaned;
}

/**
 * استدعاء Anthropic Claude API
 */
async function callClaude(prompt, claudeKey, proxyUrl = '') {
  const baseUrl = proxyUrl ? proxyUrl.replace(/\/$/, '') : 'https://api.anthropic.com';
  const endpoint = `${baseUrl}/v1/messages`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('لم يُرجع Claude أي نص');
  return text;
}

/**
 * استدعاء Groq API (Inference super rapide)
 */
async function callGroq(prompt, groqKey, model = 'llama-3.3-70b-versatile') {
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'أنت مساعد ذكي متخصص في تحليل وترجمة الدروس والتمارين الرياضية البيداغوجية. أرجع فقط JSON صالحاً.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('لم يُرجع Groq أي نص');
  return text;
}

/**
 * استدعاء OpenAI API (GPT-4o)
 */
async function callOpenAI(prompt, openaiKey, model = 'gpt-4o-mini') {
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'أنت مساعد ذكي للرياضيات والفيزياء البيداغوجية. أرجع دائماً ناتج JSON صالح.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('لم يُرجع OpenAI أي نص');
  return text;
}

/**
 * دالة التبديل التلقائي الذكي بين المزودين (Automatic AI Failover Engine)
 */
export async function callAIWithFailover(prompt, options = {}) {
  const preferredProvider = options.provider || 'gemini';
  
  const providers = [preferredProvider];
  ['gemini', 'deepseek', 'groq', 'openai', 'claude'].forEach(p => {
    if (!providers.includes(p)) providers.push(p);
  });

  const errors = [];

  for (const prov of providers) {
    try {
      if (prov === 'gemini') {
        const key = options.geminiKey || localStorage.getItem('geminiApiKey') || '';
        if (!key) continue;
        const rawModel = (options.geminiModel || localStorage.getItem('geminiModel') || 'gemini-2.5-flash').trim();
        const model = (rawModel.includes('3.') || !rawModel) ? 'gemini-2.5-flash' : rawModel;
        console.log(`[AI Failover] Attemping generation with Gemini (${model})...`);
        const text = await callGemini(prompt, key, model);
        return { text, provider: 'gemini' };
      }

      if (prov === 'deepseek') {
        const key = options.deepseekKey || localStorage.getItem('deepseekApiKey') || 'sk-12a7032f07d740348c607ef947a0a9f7';
        if (!key) continue;
        const url = options.deepseekUrl || localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com';
        const model = options.deepseekModel || localStorage.getItem('deepseekModel') || 'deepseek-chat';
        console.log(`[AI Failover] Attemping generation with DeepSeek (${model})...`);
        const text = await callDeepSeek(prompt, key, url, model);
        return { text, provider: 'deepseek' };
      }

      if (prov === 'groq') {
        const key = options.groqKey || localStorage.getItem('groqApiKey') || '';
        if (!key) continue;
        console.log(`[AI Failover] Attemping generation with Groq Cloud...`);
        const text = await callGroq(prompt, key);
        return { text, provider: 'groq' };
      }

      if (prov === 'openai') {
        const key = options.openaiKey || localStorage.getItem('openaiApiKey') || '';
        if (!key) continue;
        console.log(`[AI Failover] Attemping generation with OpenAI...`);
        const text = await callOpenAI(prompt, key);
        return { text, provider: 'openai' };
      }

      if (prov === 'claude') {
        const key = options.claudeKey || localStorage.getItem('claudeApiKey') || '';
        if (!key) continue;
        const proxy = options.proxyUrl || localStorage.getItem('claudeProxyUrl') || '';
        console.log(`[AI Failover] Attemping generation with Anthropic Claude...`);
        const text = await callClaude(prompt, key, proxy);
        return { text, provider: 'claude' };
      }
    } catch (err) {
      console.warn(`[AI Failover] Provider ${prov} failed:`, err.message);
      errors.push(`${prov}: ${err.message}`);
    }
  }

  throw new Error(`تعذر الاتصال بجميع خدمات الذكاء الاصطناعي المُهيأة. يرجى التأكد من إضافة مفتاح API واحد على الأقل في صفحة الإعدادات.\nالأخطاء المسجلة:\n${errors.join('\n')}`);
}

/**
 * ترجمة درس كامل بالذكاء الاصطناعي
 */
export async function translateLesson(lesson, targetLang, options = {}) {
  const prompt = buildTranslationPrompt(lesson, targetLang);
  const { text: rawOutput, provider: usedProvider } = await callAIWithFailover(prompt, options);

  const cleanedJson = cleanJsonOutput(rawOutput);

  let translatedContent;
  try {
    translatedContent = JSON.parse(cleanedJson);
  } catch (e) {
    console.error('[translationService] JSON parse error:', e, '\nRaw:', cleanedJson.substring(0, 500));
    throw new Error(`فشل تحليل JSON المُرجَع من ${usedProvider}. حاول مرة أخرى.`, { cause: e });
  }

  const langSuffix = {
    ar: '(نسخة عربية)',
    en: '(English Version)',
    fr: '(Version Française)',
  }[targetLang] || '';

  const subjectMap = {
    ar: 'الرياضيات',
    fr: 'Mathématiques',
    en: 'Mathematics'
  };

  const rawTitle = translatedContent?.header?.fiche_title || lesson.title || 'Fiche';
  const cleanBaseTitle = rawTitle
    .replace(/\s*\(نسخة عربية\)|\s*\(Version Fran[çc]aise\)|\s*\(English Version\)/gi, '')
    .trim();

  const finalTitle = `${cleanBaseTitle} ${langSuffix}`.trim();
  const finalSubject = subjectMap[targetLang] || translatedContent?.header?.subject || lesson.subject;

  if (!translatedContent.header) translatedContent.header = {};
  translatedContent.header.fiche_title = cleanBaseTitle;
  translatedContent.header.subject = finalSubject;
  translatedContent.header.language = targetLang;
  translatedContent.header.dir = targetLang === 'ar' ? 'rtl' : 'ltr';

  const translatedLesson = {
    ...lesson,
    id: undefined,
    title: finalTitle,
    subject: finalSubject,
    language: targetLang,
    content: {
      ...translatedContent,
      header: {
        ...(translatedContent.header || {}),
        fiche_title: cleanBaseTitle,
        subject: finalSubject,
        language: targetLang,
        dir: targetLang === 'ar' ? 'rtl' : 'ltr',
      },
      metadata: {
        ...(translatedContent.metadata || {}),
        translatedFrom: lesson.id,
        translatedFromTitle: lesson.title,
        language: targetLang,
        dir: targetLang === 'ar' ? 'rtl' : 'ltr',
        translatedAt: new Date().toISOString(),
        translatedBy: usedProvider,
      }
    },
    isActive: false,
  };

  return translatedLesson;
}

/**
 * اللغات المدعومة
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'ar', label: 'العربية', flag: '🇲🇦', dir: 'rtl' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
];

/**
 * مزودو الذكاء الاصطناعي للترجمة
 */
export const TRANSLATION_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Gemini',
    label: 'Google Gemini',
    color: '#4285F4',
    storageKey: 'geminiApiKey',
    icon: '✦',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    label: 'DeepSeek AI',
    color: '#00BA7C',
    storageKey: 'deepseekApiKey',
    icon: '◈',
  },
];
