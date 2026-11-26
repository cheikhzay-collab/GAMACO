// src/components/AiFigureEnhancerModal.jsx
// Outil professionnel de régénération et d'amélioration ultra-haute résolution pour figures mathématiques
// Basé sur l'IA Vision (Gemini) et le moteur de super-résolution vectoriel et matriciel

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Sparkles, Wand2, RefreshCw, CheckCircle, Download,
  Sliders, Eye, Layers, ZoomIn, Info, AlertCircle, ArrowRightLeft,
  FileCheck, ShieldCheck
} from 'lucide-react';
import { regenerateMathFigureWithAI, enhanceMathLineArt, svgToPngDataUrl } from '../utils/aiFigureEnhancer';

export default function AiFigureEnhancerModal({
  isOpen,
  onClose,
  imageSrc,
  caption = '',
  onApply
}) {
  const [activeTab, setActiveTab] = useState('vector'); // 'vector' | 'enhance' | 'custom'
  const [viewMode, setViewMode] = useState('split');    // 'split' | 'enhanced' | 'original'

  // État de la figure générée / améliorée
  const [enhancedUrl, setEnhancedUrl] = useState(null);
  const [generatedSvg, setGeneratedSvg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successApplied, setSuccessApplied] = useState(false);

  // Consignes personnalisées
  const [customPrompt, setCustomPrompt] = useState('');

  // Paramètres du filtre de super-résolution Canvas
  const [whitening, setWhitening] = useState(215);
  const [contrast, setContrast] = useState(1.45);
  const [sharpness, setSharpness] = useState(0.60);
  const [upscaleFactor, setUpscaleFactor] = useState(2.5);

  // Clé API Gemini
  const geminiKey = (localStorage.getItem('geminiApiKey') || localStorage.getItem('gemini_api_key') || '').trim();

  // Réinitialisation à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setEnhancedUrl(null);
      setGeneratedSvg(null);
      setErrorMsg('');
      setStatusMsg('');
      setSuccessApplied(false);
      
      // Auto-lancement d'une amélioration haute définition instantanée si aucune clé ou par défaut
      if (imageSrc) {
        enhanceMathLineArt(imageSrc, {
          whiteningThreshold: whitening,
          contrast,
          sharpness,
          upscale: upscaleFactor
        }).then(res => {
          setEnhancedUrl(res.dataUrl);
        }).catch(() => {});
      }
    }
  }, [isOpen, imageSrc]);

  // 1. Régénération Vectorielle IA (Gemini Vision)
  const handleGenerateAIVector = async (promptOverride = '') => {
    if (!imageSrc) return;
    if (!geminiKey) {
      setErrorMsg("Clé API Gemini absente. Veuillez configurer votre clé dans les Paramètres (Admin Settings) ou utiliser le mode 'Super-Résolution HD' instantané.");
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setStatusMsg('Connexion au modèle IA pour analyser la figure mathématique...');

    try {
      const res = await regenerateMathFigureWithAI(imageSrc, {
        apiKey: geminiKey,
        caption,
        customInstructions: promptOverride || customPrompt,
        onStatusUpdate: (msg) => setStatusMsg(msg)
      });

      setGeneratedSvg(res.svg);
      setEnhancedUrl(res.pngDataUrl);
      setViewMode('enhanced');
      setStatusMsg('');
    } catch (err) {
      console.error('[AI Enhancer Error]', err);
      setErrorMsg(err.message || 'Erreur lors de la régénération IA');
    } finally {
      setLoading(false);
    }
  };

  // 2. Traitement Super-Résolution Canvas (Instantané)
  const handleApplyCanvasFilter = async () => {
    if (!imageSrc) return;
    setLoading(true);
    setErrorMsg('');
    setStatusMsg('Application du filtre HD et blanchiment de l’arrière-plan...');

    try {
      const res = await enhanceMathLineArt(imageSrc, {
        whiteningThreshold: whitening,
        contrast,
        sharpness,
        upscale: upscaleFactor
      });

      setEnhancedUrl(res.dataUrl);
      setGeneratedSvg(null); // Mode matriciel HD
      setViewMode('enhanced');
    } catch (err) {
      setErrorMsg("Erreur lors de l'amélioration de l'image : " + err.message);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  // 3. Application & Sauvegarde
  const handleApplyAndSave = () => {
    if (!enhancedUrl) return;
    if (onApply) {
      onApply(enhancedUrl);
    }
    setSuccessApplied(true);
    setTimeout(() => {
      setSuccessApplied(false);
      onClose();
    }, 800);
  };

  // 4. Téléchargement HD
  const handleDownloadHD = () => {
    if (!enhancedUrl) return;
    const a = document.createElement('a');
    a.href = enhancedUrl;
    a.download = `Figure_Mathematique_HD_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(5, 10, 25, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', direction: 'ltr', boxSizing: 'border-box'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '96vw', maxWidth: 1180, height: '92vh', maxHeight: 850,
          background: 'linear-gradient(165deg, #0f172a 0%, #090d16 100%)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 30px 90px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.25)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', color: '#f8fafc'
        }}
      >
        {/* ══ Header ══ */}
        <div style={{
          padding: '0.9rem 1.4rem',
          background: 'linear-gradient(90deg, rgba(79,70,229,0.18), rgba(14,165,233,0.12))',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)', color: '#fff'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Génération et amélioration des figures par IA
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.25)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)' }}>
                  Ultra-HD Math Engine
                </span>
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.73rem', color: '#94a3b8' }}>
                Régénération vectorielle (SVG) & Super-Résolution respectant les coordonnées, repères et courbes
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '0.45rem', color: '#94a3b8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ══ Body: Two Panels (Left: Controls, Right: Visual Preview) ══ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── Left Sidebar: Controls & Options ── */}
          <div style={{
            width: 380, borderRight: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(15,23,42,0.6)', padding: '1rem',
            display: 'flex', flexDirection: 'column', gap: '0.9rem',
            overflowY: 'auto'
          }}>

            {/* Mode Tabs */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Choisir la méthode de génération :
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('vector')}
                  style={{
                    padding: '0.6rem 0.4rem', borderRadius: 9,
                    border: activeTab === 'vector' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                    background: activeTab === 'vector' ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(79,70,229,0.15))' : 'rgba(255,255,255,0.03)',
                    color: activeTab === 'vector' ? '#c7d2fe' : '#94a3b8',
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3
                  }}
                >
                  <Wand2 size={16} style={{ color: activeTab === 'vector' ? '#818cf8' : '#64748b' }} />
                  <span>Vectoriel IA (SVG)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('enhance')}
                  style={{
                    padding: '0.6rem 0.4rem', borderRadius: 9,
                    border: activeTab === 'enhance' ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.08)',
                    background: activeTab === 'enhance' ? 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(14,165,233,0.15))' : 'rgba(255,255,255,0.03)',
                    color: activeTab === 'enhance' ? '#a5f3fc' : '#94a3b8',
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3
                  }}
                >
                  <Sliders size={16} style={{ color: activeTab === 'enhance' ? '#22d3ee' : '#64748b' }} />
                  <span>Amélioration HD</span>
                </button>
              </div>
            </div>

            {/* Tab 1: AI Vector SVG Generation */}
            {activeTab === 'vector' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <ShieldCheck size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: '0.73rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                    L&apos;IA analyse avec précision les repères, courbes $(C_f)$, asymptotes et tangentes, puis les redessine en <strong>Vector SVG</strong> haute netteté sans aucun bruit.
                  </p>
                </div>

                {caption && (
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(0,0,0,0.25)', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontWeight: 700, color: '#e2e8f0' }}>Légende : </span>{caption}
                  </div>
                )}

                {/* Additional instructions */}
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a5b4fc', display: 'block', marginBottom: '0.25rem' }}>
                    Instructions ou ajustements supplémentaires (optionnel) :
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex : Redessiner la courbe Cf en bleu avec une asymptote oblique rouge et un point d'inflexion en x = 1..."
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    style={{
                      width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.35)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                      color: '#f1f5f9', fontSize: '0.75rem', outline: 'none',
                      resize: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateAIVector()}
                  disabled={loading}
                  style={{
                    background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #4f46e5, #0284c7)',
                    color: '#ffffff', border: 'none', borderRadius: 10,
                    padding: '0.65rem', fontSize: '0.82rem', fontWeight: 800,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                    boxShadow: '0 4px 16px rgba(79,70,229,0.35)',
                    transition: 'all 0.2s'
                  }}
                >
                  {loading ? (
                    <><RefreshCw size={15} className="pdf-cropper-spin" /> Génération IA en cours...</>
                  ) : (
                    <><Wand2 size={15} /> Générer la figure vectorielle (Gemini AI)</>
                  )}
                </button>
              </div>
            )}

            {/* Tab 2: Canvas Super-Resolution Filters */}
            {activeTab === 'enhance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '0.85rem' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  Filtrage instantané fidèle à 100% à l&apos;original avec fond blanc pur et tracés renforcés.
                </p>

                {/* Whitening */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: 2 }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700 }}>Blanchiment du fond</span>
                    <span style={{ color: '#38bdf8' }}>{whitening}</span>
                  </div>
                  <input
                    type="range" min="160" max="245" step="1"
                    value={whitening} onChange={e => setWhitening(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                </div>

                {/* Contrast */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: 2 }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700 }}>Contraste des traits &amp; courbes</span>
                    <span style={{ color: '#38bdf8' }}>{contrast.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range" min="1.0" max="2.3" step="0.05"
                    value={contrast} onChange={e => setContrast(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                </div>

                {/* Sharpness */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: 2 }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700 }}>Netteté des lignes &amp; chiffres</span>
                    <span style={{ color: '#38bdf8' }}>{Math.round(sharpness * 100)}%</span>
                  </div>
                  <input
                    type="range" min="0.1" max="1.0" step="0.05"
                    value={sharpness} onChange={e => setSharpness(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                </div>

                {/* Upscale Factor */}
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
                    Facteur de résolution :
                  </label>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[1.5, 2.0, 2.5, 3.5].map(scale => (
                      <button
                        key={scale}
                        type="button"
                        onClick={() => setUpscaleFactor(scale)}
                        style={{
                          flex: 1, padding: '0.35rem 0', borderRadius: 6,
                          border: upscaleFactor === scale ? '1px solid #0284c7' : '1px solid rgba(255,255,255,0.08)',
                          background: upscaleFactor === scale ? '#0284c7' : 'rgba(255,255,255,0.04)',
                          color: '#fff', fontSize: '0.7rem', fontWeight: upscaleFactor === scale ? 800 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {scale}x HD
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApplyCanvasFilter}
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #0d9488)',
                    color: '#ffffff', border: 'none', borderRadius: 8,
                    padding: '0.55rem', fontSize: '0.78rem', fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    boxShadow: '0 2px 10px rgba(2,132,199,0.3)', marginTop: '0.2rem'
                  }}
                >
                  <RefreshCw size={14} /> Appliquer le filtre HD
                </button>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '0.6rem', color: '#fca5a5', fontSize: '0.73rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.4rem'
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Status notification */}
            {statusMsg && (
              <div style={{
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 8, padding: '0.55rem', color: '#c7d2fe', fontSize: '0.72rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}>
                <RefreshCw size={13} className="pdf-cropper-spin" />
                <span>{statusMsg}</span>
              </div>
            )}

            {/* Bottom Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleApplyAndSave}
                disabled={!enhancedUrl || loading || successApplied}
                style={{
                  padding: '0.75rem', borderRadius: 10, border: 'none',
                  background: successApplied
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : enhancedUrl
                    ? 'linear-gradient(135deg, #10b981, #0d9488)'
                    : 'rgba(255,255,255,0.06)',
                  color: (!enhancedUrl || loading) ? 'rgba(255,255,255,0.3)' : '#ffffff',
                  fontSize: '0.85rem', fontWeight: 800,
                  cursor: (!enhancedUrl || loading) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                  boxShadow: enhancedUrl ? '0 4px 16px rgba(16,185,129,0.35)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {successApplied ? (
                  <><CheckCircle size={16} /> Image appliquée avec succès !</>
                ) : (
                  <><FileCheck size={16} /> Enregistrer et appliquer la figure</>
                )}
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={handleDownloadHD}
                  disabled={!enhancedUrl}
                  style={{
                    padding: '0.45rem', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: enhancedUrl ? '#e2e8f0' : 'rgba(255,255,255,0.25)',
                    fontSize: '0.72rem', fontWeight: 700,
                    cursor: enhancedUrl ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem'
                  }}
                >
                  <Download size={13} /> Télécharger HD
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '0.45rem', borderRadius: 8,
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>

          </div>

          {/* ── Right Panel: Visual Comparison & Preview ── */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: '#070b14', overflow: 'hidden'
          }}>

            {/* View Mode Bar */}
            <div style={{
              padding: '0.55rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>Affichage :</span>
                {[
                  { id: 'split', label: 'Comparaison (Côte à côte)' },
                  { id: 'enhanced', label: 'Image générée (HD)' },
                  { id: 'original', label: 'Originale recadrée' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewMode(m.id)}
                    style={{
                      padding: '0.25rem 0.55rem', borderRadius: 6,
                      border: viewMode === m.id ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                      background: viewMode === m.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                      color: viewMode === m.id ? '#c7d2fe' : '#94a3b8',
                      fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {enhancedUrl && (
                <span style={{ fontSize: '0.68rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                  <CheckCircle size={12} />
                  {generatedSvg ? 'Vectoriel pur (SVG)' : 'Image haute résolution (HD)'}
                </span>
              )}
            </div>

            {/* Preview Canvas Area */}
            <div style={{
              flex: 1, padding: '1rem', overflow: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(circle at center, #111827 0%, #030712 100%)'
            }}>

              {/* View 1: Split Side-by-Side */}
              {viewMode === 'split' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', height: '100%' }}>
                  
                  {/* Original */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '0.4rem',
                    background: '#ffffff', borderRadius: 12, padding: '0.75rem',
                    border: '2px solid rgba(239,68,68,0.3)', overflow: 'hidden'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: 4 }}>
                        Image originale
                      </span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {imageSrc ? (
                        <img src={imageSrc} alt="Original" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Aucune image</span>
                      )}
                    </div>
                  </div>

                  {/* Enhanced */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '0.4rem',
                    background: '#ffffff', borderRadius: 12, padding: '0.75rem',
                    border: '2px solid #10b981', overflow: 'hidden',
                    boxShadow: '0 8px 30px rgba(16,185,129,0.15)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: 4 }}>
                        ✓ Image générée HD
                      </span>
                      {enhancedUrl && (
                        <button
                          type="button"
                          onClick={handleApplyAndSave}
                          style={{
                            background: '#10b981', color: '#fff', border: 'none',
                            borderRadius: 4, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Appliquer
                        </button>
                      )}
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {enhancedUrl ? (
                        <img src={enhancedUrl} alt="Enhanced HD" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#64748b' }}>
                          <RefreshCw size={24} className={loading ? "pdf-cropper-spin" : ""} />
                          <span style={{ fontSize: '0.78rem' }}>{loading ? 'Traitement en cours...' : 'Cliquez sur « Générer » ou « Appliquer le filtre »'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* View 2: Enhanced Only */}
              {viewMode === 'enhanced' && (
                <div style={{
                  width: '100%', height: '100%', background: '#ffffff',
                  borderRadius: 14, padding: '1rem', border: '2px solid #10b981',
                  display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#059669', background: '#dcfce7', padding: '2px 10px', borderRadius: 5 }}>
                      ✓ Aperçu complet HD (Ultra-HD Canvas)
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyAndSave}
                      style={{
                        background: '#10b981', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 800,
                        cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                      }}
                    >
                      ✓ Appliquer cette image
                    </button>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {enhancedUrl ? (
                      <img src={enhancedUrl} alt="Enhanced Full" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Aucune image générée pour le moment</span>
                    )}
                  </div>
                </div>
              )}

              {/* View 3: Original Only */}
              {viewMode === 'original' && (
                <div style={{
                  width: '100%', height: '100%', background: '#ffffff',
                  borderRadius: 14, padding: '1rem', border: '1px solid #cbd5e1',
                  display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden'
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>
                    Image originale recadrée
                  </span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img src={imageSrc} alt="Original Full" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
