// src/components/editor/LessonEditorSettingsDrawer.jsx
// Clean slide-over settings & global styling drawer for AdminLessonEdit.
// Keeps secondary settings neatly tucked away until needed.

import { X, Settings2, Palette, CheckCheck, BookOpen, Users } from 'lucide-react';

export const MOROCCAN_LEVELS = [
  { id: 'common_core_sci', labelFr: 'Tronc Commun Scientifique', labelAr: 'جدع مشترك علمي' },
  { id: 'common_core_arts', labelFr: 'Tronc Commun Lettres & Humanités', labelAr: 'جدع مشترك آداب وعلوم إنسانية' },
  { id: '1bac_sci', labelFr: '1ère Bac Sciences Expérimentales', labelAr: 'أولى باك علوم تجريبية' },
  { id: '1bac_sm', labelFr: '1ère Bac Sciences Mathématiques', labelAr: 'أولى باك علوم رياضية' },
  { id: '1bac_arts', labelFr: '1ère Bac Lettres & Sciences Humaines', labelAr: 'أولى باك آداب وعلوم إنسانية' },
  { id: '2bac_pc_svt', labelFr: '2ème Bac Sciences Expérimentales (PC/SVT)', labelAr: 'ثانية باك علوم تجريبية (PC/SVT)' },
  { id: '2bac_sm', labelFr: '2ème Bac Sciences Mathématiques (A/B)', labelAr: 'ثانية باك علوم رياضية (أ/ب)' },
  { id: '2bac_arts', labelFr: '2ème Bac Lettres & Sciences Humaines', labelAr: 'ثانية باك آداب وعلوم إنسانية' },
];

export const DOC_TYPES = [
  { id: 'course', labelFr: 'Cours théorique', labelAr: 'درس نظري' },
  { id: 'exercises', labelFr: "Série d'exercices", labelAr: 'سلسلة تمارين تطبيقية' },
  { id: 'homework', labelFr: 'Devoir surveillé', labelAr: 'فرض محروس' },
  { id: 'devoir_prime', labelFr: 'DEVOIR PRIME ⭐', labelAr: '⭐ DEVOIR PRIME (مصحح بالنقط)' },
  { id: 'national', labelFr: 'Examen National', labelAr: 'امتحان وطني موحد' },
  { id: 'summary', labelFr: 'Résumé de cours', labelAr: 'ملخص درس' },
  { id: 'ebook', labelFr: 'E-Book (3 Colonnes)', labelAr: 'كتاب إلكتروني (E-Book)' },
  { id: 'concours', labelFr: "Concours d'accès", labelAr: 'مباراة ولوج' },
];

export default function LessonEditorSettingsDrawer({
  isOpen,
  onClose,
  fields,
  onChangeField,
  availableClasses = [],
  globalStyle,
  onChangeGlobalStyle,
  onApplyGlobalStyle,
}) {
  if (!isOpen) return null;

  const {
    ficheTitle, subject, chapterNumber, teacher, phone, prepTitle,
    selectedLevel, docType, docLanguage, schools = [], isActiveStatus,
    columnsCount, capacitesAttendues, contenus, leContenu,
  } = fields;

  const toggleClass = (clsName) => {
    const next = schools.includes(clsName)
      ? schools.filter(s => s !== clsName)
      : [...schools, clsName];
    onChangeField('schools', next);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          height: '100%',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
            <Settings2 size={18} style={{ color: 'var(--violet)' }} />
            <span>Paramètres du document &amp; mise en page</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-outline"
            style={{ padding: '0.35rem', borderRadius: '8px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.15rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 1. Core Identity */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--violet)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <BookOpen size={14} /> Identité et classification
            </h3>

            <div>
              <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Titre du document</label>
              <input
                type="text"
                className="input-control"
                value={ficheTitle}
                onChange={e => onChangeField('ficheTitle', e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.86rem', fontWeight: 700 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Type de document</label>
                <select
                  className="input-control"
                  value={docType}
                  onChange={e => onChangeField('docType', e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.55rem', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  {DOC_TYPES.map(dt => (
                    <option key={dt.id} value={dt.id}>{dt.labelFr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Niveau scolaire</label>
                <select
                  className="input-control"
                  value={selectedLevel}
                  onChange={e => onChangeField('selectedLevel', e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.55rem', fontSize: '0.82rem' }}
                >
                  {MOROCCAN_LEVELS.map(lvl => (
                    <option key={lvl.id} value={lvl.id}>{lvl.labelFr}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Langue</label>
                <select
                  className="input-control"
                  value={docLanguage}
                  onChange={e => onChangeField('docLanguage', e.target.value)}
                  style={{ width: '100%', padding: '0.42rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value="fr">Français</option>
                  <option value="ar">Arabe (العربية)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Colonnes</label>
                <select
                  className="input-control"
                  value={columnsCount}
                  onChange={e => onChangeField('columnsCount', Number(e.target.value))}
                  style={{ width: '100%', padding: '0.42rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value={1}>1 Colonne</option>
                  <option value={2}>2 Colonnes</option>
                  <option value={3}>3 Colonnes</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Statut</label>
                <button
                  type="button"
                  onClick={() => onChangeField('isActiveStatus', !isActiveStatus)}
                  style={{
                    width: '100%',
                    padding: '0.42rem 0.5rem',
                    borderRadius: '8px',
                    border: `1px solid ${isActiveStatus ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
                    background: isActiveStatus ? 'rgba(16,185,129,0.12)' : 'transparent',
                    color: isActiveStatus ? '#10b981' : 'var(--text-muted)',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  {isActiveStatus ? '● Publié' : '○ Masqué'}
                </button>
              </div>
            </div>
          </section>

          {/* 2. Teacher & Header Info */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingTop: '0.9rem', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--violet)' }}>
              Informations enseignant &amp; en-tête
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Matière</label>
                <input className="input-control" value={subject} onChange={e => onChangeField('subject', e.target.value)} style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.82rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>N° du chapitre / leçon</label>
                <input className="input-control" value={chapterNumber} onChange={e => onChangeField('chapterNumber', e.target.value)} placeholder="Ex: 01" style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.82rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Professeur</label>
                <input className="input-control" value={teacher} onChange={e => onChangeField('teacher', e.target.value)} placeholder="Pr. ..." style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.82rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Téléphone / Site</label>
                <input className="input-control" value={phone} onChange={e => onChangeField('phone', e.target.value)} placeholder="06XXXXXXXX" style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.82rem' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Sous-titre d&apos;en-tête</label>
              <input className="input-control" value={prepTitle} onChange={e => onChangeField('prepTitle', e.target.value)} style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.82rem' }} />
            </div>

            {availableClasses.length > 0 && (
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.35rem' }}>
                  <Users size={12} /> Classes associées
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {availableClasses.map(cls => {
                    const name = cls.name || cls.title || cls.id;
                    const active = schools.includes(name);
                    return (
                      <button
                        key={cls.id || name}
                        type="button"
                        onClick={() => toggleClass(name)}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '99px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: `1px solid ${active ? 'var(--violet)' : 'var(--border)'}`,
                          background: active ? 'rgba(99,102,241,0.14)' : 'transparent',
                          color: active ? 'var(--violet)' : 'var(--text-muted)',
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 3. Pedagogical Objectives (Optional) */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingTop: '0.9rem', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--violet)' }}>
              Cadrage pédagogique (optionnel)
            </h3>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Capacités attendues</label>
              <textarea rows={2} className="input-control" value={capacitesAttendues} onChange={e => onChangeField('capacitesAttendues', e.target.value)} style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.8rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Contenus</label>
              <textarea rows={2} className="input-control" value={contenus} onChange={e => onChangeField('contenus', e.target.value)} style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.8rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Remarques &amp; orientations</label>
              <textarea rows={2} className="input-control" value={leContenu} onChange={e => onChangeField('leContenu', e.target.value)} style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.8rem' }} />
            </div>
          </section>

          {/* 4. Global Document Styling */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingTop: '0.9rem', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--violet)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Palette size={14} /> Mise en forme globale
            </h3>
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>Arrière-plan :</span>
              {[
                { label: 'Transparent', val: 'transparent', color: '#ffffff', border: '#cbd5e1' },
                { label: 'Bleu doux', val: '#f0f9ff', color: '#f0f9ff', border: '#bae6fd' },
                { label: 'Jaune doux', val: '#fefce8', color: '#fefce8', border: '#fef08a' },
                { label: 'Vert menthe', val: '#f0fdf4', color: '#f0fdf4', border: '#bbf7d0' },
                { label: 'Gris clair', val: '#f8fafc', color: '#f8fafc', border: '#e2e8f0' },
              ].map(c => (
                <button
                  key={c.val}
                  type="button"
                  title={c.label}
                  onClick={() => onChangeGlobalStyle('bgColor', c.val)}
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: c.color,
                    border: `2px solid ${globalStyle.bgColor === c.val ? 'var(--violet)' : c.border}`,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <select className="input-control" value={globalStyle.fontSize} onChange={e => onChangeGlobalStyle('fontSize', e.target.value)} style={{ padding: '0.4rem', fontSize: '0.76rem' }}>
                <option value="">Taille normale</option>
                <option value="8.5pt">8.5pt</option>
                <option value="9.2pt">9.2pt</option>
                <option value="10pt">10pt</option>
                <option value="11pt">11pt</option>
              </select>
              <select className="input-control" value={globalStyle.lineHeight} onChange={e => onChangeGlobalStyle('lineHeight', e.target.value)} style={{ padding: '0.4rem', fontSize: '0.76rem' }}>
                <option value="">Interligne normal</option>
                <option value="1.3">1.3 Compact</option>
                <option value="1.55">1.55 Standard</option>
                <option value="1.75">1.75 Aéré</option>
                <option value="2.0">2.0 Large</option>
              </select>
              <select className="input-control" value={globalStyle.scope} onChange={e => onChangeGlobalStyle('scope', e.target.value)} style={{ padding: '0.4rem', fontSize: '0.76rem' }}>
                <option value="all">Tout le document</option>
                <option value="exercises">Exercices uniquement</option>
                <option value="course">Cours uniquement</option>
              </select>
            </div>

            <button
              type="button"
              onClick={onApplyGlobalStyle}
              className="btn"
              style={{ width: '100%', padding: '0.55rem', fontSize: '0.82rem', fontWeight: 800, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '9px' }}
            >
              <CheckCheck size={15} /> Appliquer le style aux sections
            </button>
          </section>
        </div>

        {/* Drawer Footer */}
        <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn" style={{ padding: '0.5rem 1.25rem', borderRadius: '9px', fontSize: '0.84rem', fontWeight: 800 }}>
            Terminer
          </button>
        </div>
      </div>
    </div>
  );
}
