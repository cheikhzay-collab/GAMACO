// src/pages/AdminSelfLearning.jsx
// Hub — Formation continue du professeur : Résumés & Séries d'exercices
// Licence Mathématiques Appliquées — Maroc | 100 % Français

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BrainCircuit, BookOpenText, PenLine,
  Sparkles, Clock, Trash2, BookOpen, Layers,
  Printer, Copy, CheckCircle2
} from 'lucide-react';
import AdminSLSummaryGenerator from './AdminSLSummaryGenerator';
import AdminSLExercisesGenerator from './AdminSLExercisesGenerator';
import { getSelfLearningNotes, deleteSelfLearningNote } from '../services/selfLearningService';
import { renderToHtmlString } from '../utils/mathRenderer';

// ─── Carte note sauvegardée ───────────────────────────────────────────────────
function NoteCard({ note, onDelete, onView }) {
  const meta = note.type === 'summary'
    ? { label: 'Résumé',    icon: BookOpenText, color: '#8B5CF6' }
    : { label: 'Exercices', icon: PenLine,      color: '#10B981' };
  const Icon = meta.icon;

  return (
    <div
      className="card animate-fade-in"
      style={{
        padding: '1.1rem 1.25rem',
        display: 'flex', flexDirection: 'column', gap: '0.6rem',
        borderLeft: `3px solid ${meta.color}`,
        cursor: 'pointer', transition: 'box-shadow 0.2s',
      }}
      onClick={() => onView(note)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon size={15} style={{ color: meta.color }} />
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, color: meta.color,
            background: `${meta.color}18`, padding: '2px 8px', borderRadius: '20px'
          }}>
            {meta.label}
          </span>
          <span style={{
            fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
            background: 'var(--surface-2, #27272A)', padding: '2px 8px', borderRadius: '20px'
          }}>
            {note.cycle}
          </span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(note.id); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '2px', borderRadius: '4px', transition: 'color 0.2s',
          }}
          title="Supprimer"
          onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
        {note.topic}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {note.module}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
        <Clock size={11} />
        {new Date(note.created_at).toLocaleDateString('fr-MA', { year: 'numeric', month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}

// ─── Modal de prévisualisation ────────────────────────────────────────────────
function NoteViewModal({ note, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!note) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(note.content || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    const bodyHtml = renderToHtmlString(note.content || '');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${note.topic} — ${note.module}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.9; color: #111; }
    h1 { font-size: 1.35rem; border-bottom: 2px solid #7C3AED; padding-bottom: .5rem; margin-bottom: .5rem; }
    h2 { font-size: 1.08rem; color: #059669; border-left: 3px solid #059669; padding-left: .6rem; margin-top: 1.5rem; }
    h3 { font-size: .97rem; color: #7C3AED; margin-top: 1rem; }
    .subtitle { color: #666; font-size: .82rem; margin-bottom: 1.5rem; }
    ul { padding-left: 1.4rem; }
    li { margin: .22rem 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${note.type === 'summary' ? '📖' : '📝'} ${note.topic}</h1>
  <p class="subtitle">${note.module} — ${note.cycle} — Licence Mathématiques Appliquées, Maroc</p>
  ${bodyHtml}
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface-1, #18181B)', borderRadius: '16px',
          maxWidth: '860px', width: '100%', maxHeight: '90vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)', border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2, #27272A)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{note.topic}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {note.module} — {note.cycle}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={handleCopy}
              className="btn btn-ghost"
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                gap: '0.4rem',
                alignItems: 'center',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            >
              {copied ? <CheckCircle2 size={14} style={{ color: '#10B981' }} /> : <Copy size={14} style={{ color: 'var(--violet)' }} />}
              <span style={{ color: 'var(--text-main)' }}>{copied ? 'Copié' : 'Copier'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="btn btn-ghost"
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                gap: '0.4rem',
                alignItems: 'center',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            >
              <Printer size={14} style={{ color: '#059669' }} />
              <span style={{ color: 'var(--text-main)' }}>PDF</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(120, 120, 128, 0.15)', border: 'none', cursor: 'pointer',
                width: '32px', height: '32px', borderRadius: '8px', fontSize: '1rem',
                color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(120, 120, 128, 0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(120, 120, 128, 0.15)'}
            >✕</button>
          </div>
        </div>
        <div style={{ padding: '1.75rem', overflow: 'auto', flex: 1, background: 'var(--surface-1, #18181B)' }}>
          <div
            className="math-content lesson-body"
            style={{ fontSize: '0.92rem', lineHeight: 1.85, color: 'var(--text-main)' }}
            dangerouslySetInnerHTML={{ __html: renderToHtmlString(note.content || '') }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Cartes de sélection du mode ──────────────────────────────────────────────
const MODE_CARDS = [
  {
    id: 'summary',
    icon: BookOpenText,
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
    shadowColor: 'rgba(124, 58, 237, 0.3)',
    title: 'Résumé de Cours',
    subtitle: 'Résumé Universitaire — Mathématiques Appliquées',
    desc: 'Générez un résumé structuré (définitions, théorèmes, exemples, formules) pour n\'importe quel sujet de la Licence MA au Maroc.',
    tags: ['Définitions', 'Théorèmes', 'Exemples', 'Export PDF'],
    cta: 'Générer un résumé',
  },
  {
    id: 'exercises',
    icon: PenLine,
    gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    shadowColor: 'rgba(16, 185, 129, 0.3)',
    title: 'Série d\'Exercices',
    subtitle: 'Exercices Universitaires — Mathématiques Appliquées',
    desc: 'Générez une série d\'exercices au niveau choisi, avec ou sans corrigé détaillé — idéal pour les TDs, les contrôles et l\'auto-formation.',
    tags: ['Basique', 'Intermédiaire', 'Avancé', 'Avec corrigé'],
    cta: 'Générer une série',
  },
];

// ─── Composant principal ──────────────────────────────────────────────────────
export default function AdminSelfLearning() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode,         setMode]         = useState(null);
  const [notes,        setNotes]        = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [filterType,   setFilterType]   = useState('all');
  const [viewNote,     setViewNote]     = useState(null);

  // Sync mode avec URL param
  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'summary' || m === 'exercises') setMode(m);
    else setMode(null);
  }, [searchParams]);

  // Charger notes sauvegardées (hub uniquement)
  useEffect(() => {
    if (mode !== null) return;
    let mounted = true;
    setLoadingNotes(true);
    getSelfLearningNotes()
      .then(data => { if (mounted) setNotes(data); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoadingNotes(false); });
    return () => { mounted = false; };
  }, [mode]);

  const handleSelect = (m) => { setMode(m); setSearchParams({ mode: m }); };
  const handleBack   = () => {
    setMode(null); setSearchParams({});
    getSelfLearningNotes().then(setNotes).catch(() => {});
  };
  const handleDelete = async (id) => {
    await deleteSelfLearningNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  if (mode === 'summary')   return <AdminSLSummaryGenerator onBack={handleBack} />;
  if (mode === 'exercises') return <AdminSLExercisesGenerator onBack={handleBack} />;

  const filteredNotes = filterType === 'all' ? notes : notes.filter(n => n.type === filterType);

  return (
    <div className="animate-fade-in" style={{ padding: '2rem 1.5rem', maxWidth: '1060px', margin: '0 auto' }}>

      {/* ── En-tête ── */}
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
          marginBottom: '1.25rem', padding: '0.5rem 1.25rem', borderRadius: '30px',
          background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.2)'
        }}>
          <BrainCircuit size={17} style={{ color: 'var(--violet)' }} />
          <span style={{
            color: 'var(--violet)', fontSize: '0.82rem', fontWeight: 800,
            letterSpacing: '0.05em', textTransform: 'uppercase'
          }}>
            Formation Continue — Licence Mathématiques Appliquées, Maroc
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900,
          color: 'var(--text-main)', margin: '0 0 0.8rem 0', lineHeight: 1.2
        }}>
          Auto-Formation du Professeur
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '560px', margin: '0 auto', lineHeight: 1.75 }}>
          Générez des résumés de cours et des séries d'exercices adaptés au programme officiel de la
          Licence <strong>Mathématiques Appliquées</strong> au Maroc, propulsé par l'IA Gemini.
        </p>
      </header>

      {/* ── Cartes de sélection ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3.5rem',
      }}>
        {MODE_CARDS.map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => handleSelect(card.id)}
              style={{
                background: 'var(--surface-1)', border: '1px solid var(--border)',
                borderRadius: '20px', padding: '2rem',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.25s',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 16px 48px ${card.shadowColor}`;
                e.currentTarget.style.borderColor = 'transparent';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {/* Lueur de fond */}
              <div style={{
                position: 'absolute', top: '-30px', right: '-30px',
                width: '130px', height: '130px', borderRadius: '50%',
                background: card.gradient, opacity: 0.07, filter: 'blur(30px)',
                pointerEvents: 'none'
              }} />

              {/* Icône */}
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.25rem', boxShadow: `0 8px 24px ${card.shadowColor}`,
              }}>
                <Icon size={26} color="white" />
              </div>

              {/* Titre */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '3px' }}>
                  {card.title}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {card.subtitle}
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: '0.87rem', color: 'var(--text-sub)', lineHeight: 1.65, margin: '0 0 1.25rem 0' }}>
                {card.desc}
              </p>

              {/* Tags */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {card.tags.map(tag => (
                  <span key={tag} style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px',
                    borderRadius: '20px', background: 'var(--surface-2)',
                    color: 'var(--text-muted)', border: '1px solid var(--border)'
                  }}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                fontSize: '0.85rem', fontWeight: 800,
                background: card.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                <Sparkles size={14} style={{ color: card.id === 'summary' ? '#A855F7' : '#10B981' }} />
                {card.cta}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Bibliothèque de notes ── */}
      <section>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BookOpen size={18} style={{ color: 'var(--violet)' }} />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Bibliothèque sauvegardée
            </h2>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700,
              background: 'var(--surface-2)', color: 'var(--text-muted)',
              padding: '2px 9px', borderRadius: '20px', border: '1px solid var(--border)'
            }}>
              {filteredNotes.length}
            </span>
          </div>

          {/* Filtres */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {[
              { id: 'all',       label: 'Tout'       },
              { id: 'summary',   label: 'Résumés'    },
              { id: 'exercises', label: 'Exercices'  },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                style={{
                  padding: '5px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.18s',
                  background: filterType === f.id ? 'var(--violet)' : 'var(--surface-2)',
                  color: filterType === f.id ? '#fff' : 'var(--text-muted)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loadingNotes ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Chargement…
          </div>
        ) : filteredNotes.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem 2rem',
            border: '2px dashed var(--border)', borderRadius: '16px', color: 'var(--text-muted)'
          }}>
            <Layers size={32} style={{ marginBottom: '0.75rem', opacity: 0.35 }} />
            <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>Aucune note sauvegardée</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.35rem', opacity: 0.7 }}>
              Générez un résumé ou une série d'exercices — ils apparaîtront ici automatiquement.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {filteredNotes.map(note => (
              <NoteCard key={note.id} note={note} onDelete={handleDelete} onView={setViewNote} />
            ))}
          </div>
        )}
      </section>

      {/* ── Modal de prévisualisation ── */}
      {viewNote && <NoteViewModal note={viewNote} onClose={() => setViewNote(null)} />}
    </div>
  );
}
