// src/utils/massarBridge.js
// وحدة تصدير واستيراد نقط وتلاميذ منظومة مسار (Massar Integration Engine)

/**
 * توليد ملف CSV متوافق مع منظومة مسار لرفع النقط مباشرة
 * @param {Array} students - قائمة التلاميذ
 * @param {Array} examResults - نتائج الامتحان أو الفرض (اختياري)
 * @param {string} className - اسم الفصل
 */
export function exportToMassarCSV(students = [], examResults = [], className = 'Classe') {
  if (!students || students.length === 0) {
    throw new Error('Aucun élève à exporter vers le fichier Massar');
  }

  // Construction du dictionnaire des notes
  const gradeMap = {};
  examResults.forEach(res => {
    if (res.studentId) gradeMap[res.studentId] = res.score;
    if (res.massarCode) gradeMap[res.massarCode] = res.score;
  });

  const headers = ['Code Massar', 'Nom & Prénom', 'Note /20', 'Appréciation'];

  const rows = students.map(st => {
    const code = st.massarCode || st.codeMassar || st.id || '';
    const name = st.name || `${st.firstName || ''} ${st.lastName || ''}`.trim() || 'Élève';
    const rawNote = gradeMap[st.id] ?? gradeMap[code] ?? st.note ?? st.score ?? '';
    const noteNum = parseFloat(rawNote);
    const noteStr = isNaN(noteNum) ? '' : noteNum.toFixed(2);

    let appreciation = '';
    if (!isNaN(noteNum)) {
      if (noteNum >= 16) appreciation = 'Excellent';
      else if (noteNum >= 14) appreciation = 'Très bien';
      else if (noteNum >= 12) appreciation = 'Bien';
      else if (noteNum >= 10) appreciation = 'Moyen';
      else appreciation = 'À soutenir';
    }

    return [
      `"${code}"`,
      `"${name}"`,
      `"${noteStr}"`,
      `"${appreciation}"`
    ].join(',');
  });

  // الترويسة بترميز UTF-8 مع BOM ليدعمه Excel بطلاقة
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Notes_Massar_${className.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * تحليل واستيراد لائحة تلاميذ مسار من ملف CSV/Excel
 */
export function parseMassarCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const students = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length >= 2 && cols[0]) {
      students.push({
        massarCode: cols[0],
        name: cols[1] || 'Nouvel élève',
        note: cols[2] || '',
        appreciation: cols[3] || ''
      });
    }
  }
  return students;
}
