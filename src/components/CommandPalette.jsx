import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, BookOpen, Layers, Camera, Settings, Users, KeyRound, ArrowRight, Command, X } from 'lucide-react';

export default function CommandPalette({ defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // Global Keyboard listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const defaultActions = [
    { id: 'scanner', title: 'Scanner OMR', desc: 'Scan et correction automatique des QCM', icon: Camera, path: '/admin/omr-scanner', color: '#10B981' },
    { id: 'ai-gen', title: 'Studio IA (AI Studio)', desc: 'Génération automatique de cours et d\'exercices par IA', icon: Sparkles, path: '/admin/ai-generator', color: '#8B5CF6' },
    { id: 'lessons', title: 'Fiches de Cours & Ressources', desc: 'Gestion et consultation des cours interactifs', icon: BookOpen, path: '/admin/lessons', color: '#3B82F6' },
    { id: 'exams', title: 'Gestion des Évaluations & Devoirs', desc: 'Création de devoirs et génération des sujets A/B', icon: Layers, path: '/admin/exams', color: '#F59E0B' },
    { id: 'classes', title: 'Gestion des Classes & Élèves', desc: 'Gestion des étudiants et exportation Massar', icon: Users, path: '/admin/classes', color: '#EC4899' },
    { id: 'settings', title: 'Paramètres & Clés API', desc: 'Configuration système (Gemini, DeepSeek, Claude, Groq)', icon: Settings, path: '/admin/settings', color: '#64748B' },
  ];

  const filteredActions = defaultActions.filter(action => 
    action.title.toLowerCase().includes(query.toLowerCase()) || 
    action.desc.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (action) => {
    setIsOpen(false);
    navigate(action.path);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filteredActions.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredActions.length) % (filteredActions.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        handleSelect(filteredActions[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh', paddingLeft: '1rem', paddingRight: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={() => setIsOpen(false)}
    >
      <div 
        style={{
          width: '100%', maxWidth: '640px',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border, rgba(255,255,255,0.15))',
          borderRadius: '1.25rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))', gap: '0.75rem' }}>
          <Search size={20} style={{ color: 'var(--text-subtle, #94a3b8)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher une classe, un devoir, un cours ou un outil... (Ctrl + K)"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleInputKeyDown}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '0.95rem', color: 'var(--text-main, #f8fafc)', fontFamily: 'inherit'
            }}
          />
          <button 
            onClick={() => setIsOpen(false)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle, #94a3b8)', cursor: 'pointer', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '0.5rem' }}>
          {filteredActions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>
              Aucun résultat ne correspond à &quot;{query}&quot;
            </div>
          ) : (
            filteredActions.map((action, idx) => {
              const Icon = action.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={action.id}
                  onClick={() => handleSelect(action)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem 1rem', borderRadius: '0.75rem', cursor: 'pointer',
                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    border: isSelected ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: action.color, border: `1px solid ${action.color}30`
                    }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main, #f8fafc)' }}>
                        {action.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle, #94a3b8)' }}>
                        {action.desc}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: isSelected ? action.color : 'var(--text-subtle, #94a3b8)', fontSize: '0.75rem', fontWeight: 600 }}>
                    Ouvrir <ArrowRight size={14} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1.25rem', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid var(--border, rgba(255,255,255,0.05))', fontSize: '0.7rem', color: 'var(--text-subtle, #94a3b8)' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span>↑↓ Naviguer</span>
            <span>↵ Sélectionner</span>
            <span>Esc Fermer</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700, color: 'var(--violet, #8b5cf6)' }}>
            <Command size={12} /> L&apos;CONQ Platform Suite
          </div>
        </div>
      </div>
    </div>
  );
}
