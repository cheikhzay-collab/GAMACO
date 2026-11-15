import { validateExercisePoints, extractPointsFromText } from '../utils/scoreBalancingValidator';

const API_BASE = '/api';

/**
 * Retrieve all grades or filter by lesson_id / class_id
 */
export async function getGrades(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/grades${query ? '?' + query : ''}`);
    if (res.ok) {
      const data = await res.json();
      try {
        localStorage.setItem('grades_cache', JSON.stringify(data));
      } catch (_) {}
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.warn('[gradeService] getGrades fetch failed, using cache:', err.message);
  }

  // Fallback to cache
  try {
    const cached = localStorage.getItem('grades_cache');
    if (cached) {
      const list = JSON.parse(cached);
      if (params.lesson_id || params.lessonId) {
        const lid = params.lesson_id || params.lessonId;
        return list.filter(g => g.lesson_id === lid || g.lessonId === lid);
      }
      return Array.isArray(list) ? list : [];
    }
  } catch (_) {}

  return [];
}

/**
 * Retrieve a grade sheet by lesson ID
 */
export async function getGradeByLessonId(lessonId) {
  if (!lessonId) return null;
  const list = await getGrades({ lesson_id: lessonId });
  return list.find(g => g.lesson_id === lessonId || g.lessonId === lessonId) || null;
}

/**
 * Save or update a points table / grade record in database
 */
export async function saveGrade(gradeData) {
  if (!gradeData) throw new Error('Missing grade data');
  const payload = {
    ...gradeData,
    id: gradeData.id || (gradeData.lesson_id ? `GRADE-L-${gradeData.lesson_id}` : `GRADE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`),
    updatedAt: new Date().toISOString()
  };

  try {
    const res = await fetch(`${API_BASE}/grades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      const saved = data.grade || payload;
      // Update cache
      updateLocalCache(saved);
      return saved;
    }
  } catch (err) {
    console.warn('[gradeService] saveGrade fetch failed, saving to cache:', err.message);
  }

  updateLocalCache(payload);
  return payload;
}

/**
 * Delete a grade record by ID or lessonId
 */
export async function deleteGrade(id) {
  if (!id) return false;
  try {
    await fetch(`${API_BASE}/grades?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (_) {}

  try {
    const cached = localStorage.getItem('grades_cache');
    if (cached) {
      const list = JSON.parse(cached).filter(g => g.id !== id && g.lesson_id !== id && g.lessonId !== id);
      localStorage.setItem('grades_cache', JSON.stringify(list));
    }
  } catch (_) {}
  return true;
}

/**
 * Helper: updates local cache of grades
 */
function updateLocalCache(item) {
  try {
    const raw = localStorage.getItem('grades_cache');
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(g => g.id === item.id || (item.lesson_id && (g.lesson_id === item.lesson_id || g.lessonId === item.lesson_id)));
    if (idx > -1) list[idx] = { ...list[idx], ...item };
    else list.unshift(item);
    localStorage.setItem('grades_cache', JSON.stringify(list));
  } catch (_) {}
}

/**
 * Automatically extracts the full points table (جدول النقط وسلم التنقيط) from homework sections.
 * Populates exercises, titles, exercise points, and sub-questions points.
 */
export function extractPointsTableFromSections(sections, fallbackTotal = 20) {
  if (!Array.isArray(sections) || sections.length === 0) return [];

  const table = [];
  sections.forEach((sec, idx) => {
    // Only examine exercises or sections with points / activities
    const rawTitle = sec.title || `Exercice ${idx + 1}`;
    const cleanTitle = rawTitle.replace(/\*\*/g, '').trim();
    const scoreBalance = validateExercisePoints(sec);

    let secPoints = parseFloat(sec.points);
    if (isNaN(secPoints) || secPoints <= 0) {
      secPoints = scoreBalance.declaredPoints || scoreBalance.calculatedSum || 0;
    }

    // Try parsing points from section title e.g. "Exercice 1 (7.5 pts)"
    if (secPoints <= 0) {
      const titlePts = extractPointsFromText(rawTitle);
      if (titlePts !== null) secPoints = titlePts;
    }

    const questions = (scoreBalance.subQuestions || []).map((sq, qIdx) => ({
      num: sq.number || `${qIdx + 1}`,
      points: sq.points || 0,
      desc: sq.text ? sq.text.slice(0, 120).replace(/\*\*/g, '').trim() : ''
    }));

    // If subquestions weren't parsed but content has lines with bullets, parse them
    if (questions.length === 0 && typeof sec.content === 'string') {
      const lines = sec.content.split('\n');
      lines.forEach((l, lIdx) => {
        const pts = extractPointsFromText(l);
        if (pts !== null) {
          const match = l.match(/^(\*\*|\s)*(\d+|[a-zA-Z])[.)]/);
          questions.push({
            num: match ? match[2] : `${lIdx + 1}`,
            points: pts,
            desc: l.slice(0, 120).replace(/\*\*/g, '').trim()
          });
        }
      });
    }

    // Extract exercise display label
    let exerciseLabel = `Exercice ${idx + 1}`;
    const exMatch = cleanTitle.match(/^(?:Exercice|تمرين)\s*(\d+|[a-zA-Z]+)?/i);
    if (exMatch && exMatch[1]) {
      exerciseLabel = `Exercice ${exMatch[1]}`;
    }

    table.push({
      exercise: exerciseLabel,
      title: cleanTitle,
      points: secPoints,
      questions
    });
  });

  return table;
}

/**
 * Calculate total points from points table
 */
export function calculateTotalPointsFromTable(pointsTable) {
  if (!Array.isArray(pointsTable) || pointsTable.length === 0) return 0;
  const sum = pointsTable.reduce((total, row) => total + (parseFloat(row.points) || 0), 0);
  return Math.round(sum * 100) / 100;
}
