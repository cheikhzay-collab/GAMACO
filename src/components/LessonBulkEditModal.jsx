// src/components/LessonBulkEditModal.jsx
import React, { useState } from 'react';
import { X, Layers, Check, AlertCircle, Loader2, BookOpen, Tag, Users, ShieldCheck } from 'lucide-react';

const MOROCCAN_LEVELS = [
  { id: 'common_core_sci', label: 'Tronc Commun Scientifique' },
  { id: 'common_core_arts', label: 'Tronc Commun Lettres & Humanités' },
  { id: '1bac_sci', label: '1ère Bac Sciences Expérimentales' },
  { id: '1bac_sm', label: '1ère Bac Sciences Mathématiques' },
  { id: '1bac_arts', label: '1ère Bac Lettres' },
  { id: '2bac_pc_svt', label: '2ème Bac Sciences Expérimentales (PC/SVT)' },
  { id: '2bac_sm', label: '2ème Bac Sciences Mathématiques' },
  { id: '2bac_arts', label: '2ème Bac Lettres & Sciences Humaines' }
];

const DOC_TYPES = [
  { id: 'course', label: 'Cours théorique' },
  { id: 'exercises', label: 'Série d\'exercices' },
  { id: 'homework', label: 'Devoir surveillé' },
  { id: 'national', label: 'Examen National' },
  { id: 'concours', label: 'Concours d\'accès' },
  { id: 'summary', label: 'Résumé de cours' },
  { id: 'ebook', label: 'E-Book (كتاب إلكتروني)' }
];

export default function LessonBulkEditModal({
  isOpen,
  onClose,
  selectedCount = 0,
  availableClasses = [],
  onApply,
  loading = false
}) {
  // Enabled fields to update
  const [fieldsToUpdate, setFieldsToUpdate] = useState({
    level: false,
    docType: false,
    teacher: false,
    isActive: false,
    school: false
  });

  // Values
  const [level, setLevel] = useState('2bac_pc_svt');
  const [docType, setDocType] = useState('course');
  const [teacher, setTeacher] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [schoolAction, setSchoolAction] = useState('add'); // 'add' | 'replace' | 'clear'
  const [selectedSchool, setSelectedSchool] = useState('');

  if (!isOpen) return null;

  const toggleField = (field) => {
    setFieldsToUpdate(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {};

    if (fieldsToUpdate.level) payload.level = level;
    if (fieldsToUpdate.docType) payload.docType = docType;
    if (fieldsToUpdate.teacher) payload.teacher = teacher.trim();
    if (fieldsToUpdate.isActive) payload.isActive = isActive;
    if (fieldsToUpdate.school) {
      payload.schoolUpdate = {
        action: schoolAction,
        schoolName: selectedSchool
      };
    }

    if (Object.keys(payload).length === 0) {
      alert('Veuillez cocher au moins un champ à modifier.');
      return;
    }

    onApply(payload);
  };

  const hasAnyFieldSelected = Object.values(fieldsToUpdate).some(Boolean);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(9, 14, 26, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        maxWidth: '560px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.15)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Layers size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Modification en masse (Bulk Edit)
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Appliquer des modifications à <span style={{ fontWeight: 800, color: 'var(--violet)' }}>{selectedCount} fiches sélectionnées</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{
            background: 'rgba(99, 102, 241, 0.06)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={15} style={{ color: 'var(--violet)', flexShrink: 0 }} />
            <span>Cochez uniquement les propriétés que vous souhaitez mettre à jour pour l'ensemble des fiches choisies.</span>
          </div>

          {/* FIELD 1: NIVEAU */}
          <div style={{
            border: `1px solid ${fieldsToUpdate.level ? 'var(--violet)' : 'var(--border)'}`,
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            background: fieldsToUpdate.level ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
            transition: 'all 0.2s'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: fieldsToUpdate.level ? '0.6rem' : '0' }}>
              <input
                type="checkbox"
                checked={fieldsToUpdate.level}
                onChange={() => toggleField('level')}
                style={{ width: '16px', height: '16px', accentColor: 'var(--violet)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                Niveau scolaire
              </span>
            </label>

            {fieldsToUpdate.level && (
              <select
                value={level}
                onChange={e => setLevel(e.target.value)}
                className="input-control"
                style={{ width: '100%', fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
              >
                {MOROCCAN_LEVELS.map(lvl => (
                  <option key={lvl.id} value={lvl.id}>{lvl.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* FIELD 2: TYPE DE DOCUMENT */}
          <div style={{
            border: `1px solid ${fieldsToUpdate.docType ? 'var(--violet)' : 'var(--border)'}`,
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            background: fieldsToUpdate.docType ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
            transition: 'all 0.2s'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: fieldsToUpdate.docType ? '0.6rem' : '0' }}>
              <input
                type="checkbox"
                checked={fieldsToUpdate.docType}
                onChange={() => toggleField('docType')}
                style={{ width: '16px', height: '16px', accentColor: 'var(--violet)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                Type de document
              </span>
            </label>

            {fieldsToUpdate.docType && (
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="input-control"
                style={{ width: '100%', fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
              >
                {DOC_TYPES.map(dt => (
                  <option key={dt.id} value={dt.id}>{dt.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* FIELD 3: ENSEIGNANT */}
          <div style={{
            border: `1px solid ${fieldsToUpdate.teacher ? 'var(--violet)' : 'var(--border)'}`,
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            background: fieldsToUpdate.teacher ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
            transition: 'all 0.2s'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: fieldsToUpdate.teacher ? '0.6rem' : '0' }}>
              <input
                type="checkbox"
                checked={fieldsToUpdate.teacher}
                onChange={() => toggleField('teacher')}
                style={{ width: '16px', height: '16px', accentColor: 'var(--violet)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                Nom de l'enseignant
              </span>
            </label>

            {fieldsToUpdate.teacher && (
              <input
                type="text"
                value={teacher}
                onChange={e => setTeacher(e.target.value)}
                placeholder="Ex: Pr. Zayani"
                className="input-control"
                style={{ width: '100%', fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
              />
            )}
          </div>

          {/* FIELD 4: STATUT (ACTIF / MASQUÉ) */}
          <div style={{
            border: `1px solid ${fieldsToUpdate.isActive ? 'var(--violet)' : 'var(--border)'}`,
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            background: fieldsToUpdate.isActive ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
            transition: 'all 0.2s'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: fieldsToUpdate.isActive ? '0.6rem' : '0' }}>
              <input
                type="checkbox"
                checked={fieldsToUpdate.isActive}
                onChange={() => toggleField('isActive')}
                style={{ width: '16px', height: '16px', accentColor: 'var(--violet)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                Statut de publication
              </span>
            </label>

            {fieldsToUpdate.isActive && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsActive(true)}
                  style={{
                    flex: 1,
                    padding: '0.45rem',
                    borderRadius: '6px',
                    border: isActive ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
                    background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    color: isActive ? 'var(--emerald)' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  ● Active
                </button>
                <button
                  type="button"
                  onClick={() => setIsActive(false)}
                  style={{
                    flex: 1,
                    padding: '0.45rem',
                    borderRadius: '6px',
                    border: !isActive ? '1.5px solid var(--warning)' : '1px solid var(--border)',
                    background: !isActive ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: !isActive ? 'var(--warning)' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  ○ Masquée
                </button>
              </div>
            )}
          </div>

          {/* FIELD 5: CLASSE / GROUPE */}
          {availableClasses.length > 0 && (
            <div style={{
              border: `1px solid ${fieldsToUpdate.school ? 'var(--violet)' : 'var(--border)'}`,
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              background: fieldsToUpdate.school ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
              transition: 'all 0.2s'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: fieldsToUpdate.school ? '0.6rem' : '0' }}>
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.school}
                  onChange={() => toggleField('school')}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--violet)', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  Assigner aux classes
                </span>
              </label>

              {fieldsToUpdate.school && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      value={schoolAction}
                      onChange={e => setSchoolAction(e.target.value)}
                      className="input-control"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', width: '130px' }}
                    >
                      <option value="add">+ Ajouter classe</option>
                      <option value="replace">Remplacer par</option>
                      <option value="clear">Retirer toutes</option>
                    </select>

                    {schoolAction !== 'clear' && (
                      <select
                        value={selectedSchool}
                        onChange={e => setSelectedSchool(e.target.value)}
                        className="input-control"
                        style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                      >
                        <option value="">Sélectionner une classe...</option>
                        {availableClasses.map(c => (
                          <option key={c.id || c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '0.5rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-outline"
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700 }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !hasAnyFieldSelected}
              className="btn-primary"
              style={{
                padding: '0.5rem 1.3rem',
                fontSize: '0.82rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                opacity: (!hasAnyFieldSelected || loading) ? 0.6 : 1,
                cursor: (!hasAnyFieldSelected || loading) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Mise à jour en cours...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Appliquer à {selectedCount} fiches</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
