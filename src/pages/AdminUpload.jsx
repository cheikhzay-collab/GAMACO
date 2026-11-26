import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { useAuth } from '../context/AuthContext';
import { UploadCloud, CheckCircle2, Copy, Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getLevelDisplayName } from '../utils/levelHelpers';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function AdminUpload() {
  const isMobile = useIsMobile();
  const { addExam, schools } = useAuth();
  const [examName, setExamName] = useState('');
  const [school, setSchool] = useState(schools[0] || 'Médecine');
  const [year, setYear] = useState('');
  const [tier, setTier] = useState('freemium');
  const [fileData, setFileData] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [pdfName, setPdfName] = useState('');
  const navigate = useNavigate();

  // ── Claude AI Prompt Panel ─────────────────────────────────────────────
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [promptN, setPromptN] = useState('20');
  const [promptTheme, setPromptTheme] = useState('Suites et Limites');
  const [promptLevel, setPromptLevel] = useState('Concours Médecine Maroc');

  const buildPrompt = () => `Tu es un générateur expert de QCM pour concours de médecine marocains.

Génère ${promptN} questions QCM au format CSV strict ci-dessous — SANS aucune explication, juste le CSV brut.

═══ FORMAT CSV (7 colonnes) ═══
Context,Topic,Question,Options,Réponse,Astuce,Trick

RÈGLES STRICTES :
• Context  → mise en situation (laisser VIDE si non nécessaire)
• Topic    → ex: "Analyse", "Probabilités", "Algèbre"
• Question → texte LaTeX ou "img:URL" si image
• Options  → format : "A) ..., B) ..., C) ..., D) ..."
• Réponse  → UNE lettre : A / B / C / D
• Astuce   → explication mathématique complète
• Trick    → astuce d’élimination rapide — commencer par "⚡" (VIDE si aucun)
• Utiliser $...$ pour le LaTeX inline,  $$...$$ pour les blocs
• Toute cellule avec virgule DOIT être entre guillemets doubles

═══ EXEMPLE DE SORTIE ATTENDUE ═══
,"Analyse","$\\lim_{x \\to 0} \\frac{\\sin x}{x} = ?$","A) $0$, B) $1$, C) $-1$, D) $+\\infty$","B","Limite fondamentale classique.","⚡ Éliminer C et D : fonction paire et bornée."
"Soit $f(x)=x^2-3x+2$","Algèbre","Racines de $f$ ?","A) $1$ et $2$, B) $-1$ et $-2$, C) $0$ et $3$, D) Aucune","A","$(x-1)(x-2)=0 \\Rightarrow x=1$ ou $x=2$",""

═══ DEMANDE ═══
Génère ${promptN} questions sur : ${promptTheme}
Niveau : ${promptLevel}
Langue : Français (termes mathématiques en LaTeX)`;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildPrompt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = buildPrompt();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const stripCR = (s) => typeof s === 'string' ? s.replace(/[\r\n\t]+/g, ' ').trim() : s;
        const parsedQuestions = results.data.map(row => ({
          id: Math.random().toString(36).substring(2, 11),
          topic: stripCR(row['Sujet'] || row['Topic'] || 'Général'),
          context: row['Context'] ? stripCR(row['Context']) : null,
          question: stripCR(row['Question'] || ''),
          options: row['Options'] ? parseOptions(row['Options']) : [],
          correct_answer: stripCR(row['Réponse'] || row['Correct'] || ''),
          astuce: stripCR(row['Astuce'] || ''),
          trick: row['Trick'] ? stripCR(row['Trick']) : null
        }));
        
        setFileData(parsedQuestions);
      }
    });
  };

  const handlePdfUpload = (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') return;
    
    setPdfName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setPdfBase64(e.target.result);
    reader.readAsDataURL(file);
  };

  const parseOptions = (optionsStr) => {
    if (!optionsStr) return [];
    // Strip CR/LF embedded in option text (from Windows CSV line endings)
    const cleanStr = optionsStr.replace(/[\r\n]+/g, ' ');
    const regex = /([A-E])\)\s+/g;
    const matches = [];
    let match;
    while ((match = regex.exec(cleanStr)) !== null) {
      matches.push({
        id: match[1],
        index: match.index,
        length: match[0].length
      });
    }
    const options = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const startIndex = current.index + current.length;
      const endIndex = next ? next.index : cleanStr.length;
      let text = cleanStr.substring(startIndex, endIndex).trim();
      text = text.replace(/[,;]\s*$/, '').trim();
      options.push({ id: current.id, text });
    }
    if (options.length === 0) {
      return [{ id: 'A', text: cleanStr.trim() }];
    }
    return options;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fileData || !examName) return;

    addExam(examName, getLevelDisplayName(school), year, tier, fileData, pdfBase64, school);
    navigate('/admin/exams'); // redirect to library
  };

  const downloadTemplate = () => {
    // Columns: Context (optional) | Topic | Question | Options | Réponse | Astuce | Trick (optional)
    const rows = [
      // Header
      'Context,Topic,Question,Options,Réponse,Astuce,Trick',
      // Row 1 — with context, with trick
      '"Soit la fonction $f(x) = x^2$ définie sur $\\mathbb{R}$.","Analyse","Quelle est la dérivée de $f$ ?","A) $2x$, B) $x^2$, C) $1$, D) $2$","A","La dérivée de $x^n$ est $n \\cdot x^{n-1}$, donc celle de $x^2$ est $2x$.","⚡ Règle rapide : on multiplie par l\'exposant puis on le diminue de 1."',
      // Row 2 — without context, without trick
      ',"Suites","Soit $U_{n+1} = \\sqrt{2 + U_n}$ avec $U_0=1$. Quelle est la limite ?","A) $\\sqrt{2}$, B) $1+\\sqrt{2}$, C) $2$, D) divergente","C","Résoudre $L = \\sqrt{2+L}$ ⟹ $L^2 - L - 2 = 0$ ⟹ $L = 2$ (limite positive).",""',
      // Row 3 — with trick
      ',"Limites","$\\lim_{x \\to 0} \\dfrac{\\sin x}{x} = ?$","A) $0$, B) $1$, C) $-1$, D) $+\\infty$","B","Limite fondamentale classique. À retenir comme un réflexe.","⚡ Élimination rapide : les options C et D sont impossibles car la fonction est paire et bornée près de 0."',
      // Row 4 — image example
      ',"Probabilité","img:https://upload.wikimedia.org/wikipedia/commons/4/4c/Standard_Normal_Distribution.png","A) $\\frac{1}{2}$, B) $\\frac{1}{3}$, C) $0$, D) $1$","A","Par symétrie de la loi normale centrée réduite autour de 0.",""',
    ];

    const csvContent = rows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modele_examen_lconq.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UploadCloud size={22} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Uploader un Concours</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>Ajoutez de nouveaux examens ou concours à la base de données.</p>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          {/* Claude AI button */}
          <button
            onClick={() => setShowPrompt(p => !p)}
            style={{
              background: showPrompt
                ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
                : 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(99,102,241,0.12))',
              border: '1px solid rgba(124,58,237,0.4)',
              color: showPrompt ? '#fff' : 'var(--violet)',
              padding: '0.5rem 1rem', borderRadius: '10px',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Sparkles size={15} />
            Prompt Claude AI
            {showPrompt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Download template button */}
          <button
            onClick={downloadTemplate}
            style={{
              background:'var(--bg-glass)', border:'1px solid var(--violet)', color:'var(--violet)',
              padding:'0.5rem 1rem', borderRadius:'10px', fontSize:'0.85rem', fontWeight:700, cursor:'pointer',
              display:'flex', alignItems:'center', gap:'0.4rem'
            }}
          >
            📥 Modèle CSV
          </button>
        </div>
      </header>

      {/* ── Claude AI Prompt Panel ── */}
      {showPrompt && (
        <div className="animate-fade-in" style={{
          marginBottom: '1.5rem',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(124, 58, 237, 0.25)',
          background: 'linear-gradient(145deg, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.04) 100%)',
          overflow: 'hidden'
        }}>
          {/* Panel header */}
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(124,58,237,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(124,58,237,0.06)'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '10px',
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(124,58,237,0.4)'
              }}>
                <Sparkles size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: '0.9rem', margin: 0 }}>Générateur Claude AI</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                  Personnalise puis copie le prompt → colle dans Claude.ai
                </p>
              </div>
            </div>
            <button
              onClick={copyPrompt}
              style={{
                background: copied
                  ? 'linear-gradient(135deg, var(--emerald), #34d399)'
                  : 'linear-gradient(135deg, #7c3aed, #6366f1)',
                border: 'none', color: '#fff',
                padding: '0.5rem 1rem', borderRadius: '8px',
                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                transition: 'all 0.3s ease',
                boxShadow: copied
                  ? '0 4px 16px rgba(16,185,129,0.4)'
                  : '0 4px 16px rgba(124,58,237,0.4)'
              }}
            >
              {copied ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier le Prompt</>}
            </button>
          </div>

          {/* Customization fields */}
          <div style={{ padding: '1rem 1.25rem', display:'flex', gap:'0.75rem', flexWrap:'wrap', borderBottom:'1px solid rgba(124,58,237,0.1)' }}>
            <div className="input-group" style={{ flex:'0 0 70px' }}>
              <label style={{ fontSize:'0.7rem' }}>Nbre ❓</label>
              <input
                type="number" min="5" max="100"
                className="input-control"
                value={promptN}
                onChange={e => setPromptN(e.target.value)}
                style={{ padding:'0.4rem 0.6rem', fontSize:'0.85rem' }}
              />
            </div>
            <div className="input-group" style={{ flex:'1', minWidth:'200px' }}>
              <label style={{ fontSize:'0.7rem' }}>📚 Thème / Chapitre</label>
              <input
                type="text"
                className="input-control"
                placeholder="ex: Intégration, Suites, Probabilités..."
                value={promptTheme}
                onChange={e => setPromptTheme(e.target.value)}
                style={{ padding:'0.4rem 0.75rem', fontSize:'0.85rem' }}
              />
            </div>
            <div className="input-group" style={{ flex:'0 0 210px' }}>
              <label style={{ fontSize:'0.7rem' }}>🎯 Niveau</label>
              <select
                className="input-control"
                value={promptLevel}
                onChange={e => setPromptLevel(e.target.value)}
                style={{ padding:'0.4rem 0.6rem', fontSize:'0.85rem' }}
              >
                <option>Concours Médecine Maroc</option>
                <option>ENSA / ENSAM</option>
                <option>Baccalauréat Maroc</option>
                <option>Classes Préparatoires</option>
              </select>
            </div>
          </div>

          {/* Prompt preview */}
          <pre style={{
            margin: 0,
            padding: '1rem 1.25rem',
            fontSize: '0.72rem',
            lineHeight: '1.7',
            color: 'var(--text-muted)',
            fontFamily: "'Fira Code', 'Courier New', monospace",
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '280px',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.15)',
            borderRadius: '0 0 var(--radius-xl) var(--radius-xl)'
          }}>
            {buildPrompt()}
          </pre>
        </div>
      )}
      
      <div className="glass-panel" style={{ padding: '3rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="input-group">
            <label>Titre de l'Examen (Affiché aux élèves)</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="Ex: Concours Médecine Oujda 2024"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              required 
              style={{ fontSize: '1.1rem', fontWeight: 600 }}
            />
          </div>

          <div className="dashboard-grid" style={{ marginBottom: 0 }}>
            <div className="col-span-4 input-group">
              <label>Niveau Cible</label>
              <select className="input-control" value={school} onChange={(e) => setSchool(e.target.value)}>
                {schools.map(s => (
                  <option key={s} value={s}>{getLevelDisplayName(s)}</option>
                ))}
              </select>
            </div>

            <div className="col-span-4 input-group">
              <label>Année (optionnelle)</label>
              <input
                type="text"
                className="input-control"
                placeholder="Ex: 2025, ou laisser vide"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>

            <div className="col-span-4 input-group">
              <label>Accès</label>
              <select className="input-control" value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="freemium">Gratuit (Standard)</option>
                <option value="premium">Premium (Payant)</option>
              </select>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '2rem' }}>
            {/* CSV Upload */}
            <div className="input-group">
              <label>Contenu de l'examen (.csv)</label>
              <label className="upload-zone" style={{ minHeight: '180px' }}>
                <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                {!fileData ? (
                  <>
                    <UploadCloud className="upload-icon" size={32} style={{ marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 700, fontSize:'0.9rem' }}>Questions CSV</p>
                  </>
                ) : (
                  <div style={{ color:'var(--accent)' }}>
                    <CheckCircle2 size={32} style={{ margin:'0 auto 0.5rem' }} />
                    <p style={{ fontWeight: 800 }}>{fileData.length} QCM Chargés</p>
                    <span style={{ fontSize:'0.75rem', opacity:0.8 }}>Cliquez pour changer</span>
                  </div>
                )}
              </label>
            </div>

            {/* PDF Upload */}
            <div className="input-group">
              <label>Sujet de l'examen (Optionnel .pdf)</label>
              <label className="upload-zone" style={{ minHeight: '180px', borderColor: pdfBase64 ? 'var(--violet)' : '' }}>
                <input type="file" accept=".pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
                {!pdfBase64 ? (
                  <>
                    <UploadCloud className="upload-icon" size={32} style={{ marginBottom: '1rem', color:'var(--violet)' }} />
                    <p style={{ fontWeight: 700, fontSize:'0.9rem' }}>Document PDF</p>
                  </>
                ) : (
                  <div className="text-violet">
                    <CheckCircle2 size={32} style={{ margin:'0 auto 0.5rem' }} />
                    <p style={{ fontWeight: 800, fontSize:'0.8rem' }}>{pdfName}</p>
                    <span style={{ fontSize:'0.75rem', opacity:0.8 }}>Cliquez pour changer</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* SMART PREVIEW SECTION */}
          {fileData && (
            <div className="animate-slide-up" style={{ marginTop: '1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
                <h3 style={{ margin:0, fontSize:'1.1rem' }}>👀 Aperçu des questions</h3>
                <span style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>{fileData.length} questions prêtes</span>
              </div>
              
              <div style={{ 
                background:'rgba(0,0,0,0.2)', 
                borderRadius:'1rem', 
                border:'1px solid var(--border)',
                maxHeight: '400px',
                overflowX: 'auto',
                overflowY: 'auto',
                width: '100%',
                padding: '1px'
              }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.85rem' }}>
                  <thead style={{ position:'sticky', top:0, background:'var(--bg-card)', zIndex:1 }}>
                    <tr>
                      <th style={{ padding:'1rem', textAlign:'left', borderBottom:'1px solid var(--border)' }}>Sujet</th>
                      <th style={{ padding:'1rem', textAlign:'left', borderBottom:'1px solid var(--border)' }}>Question</th>
                      <th style={{ padding:'1rem', textAlign:'center', borderBottom:'1px solid var(--border)' }}>Rép</th>
                      <th style={{ padding:'1rem', textAlign:'right', borderBottom:'1px solid var(--border)' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.map((q, idx) => (
                      <tr key={q.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding:'1rem' }}>
                          <span style={{ background:'var(--violet-soft)', color:'var(--violet)', padding:'0.2rem 0.5rem', borderRadius:'6px', fontWeight:800, fontSize:'0.7rem' }}>
                            {q.topic}
                          </span>
                        </td>
                        <td style={{ padding:'1rem', color:'var(--text-main)' }}>
                          <div style={{ maxWidth:'400px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {q.context && <span style={{ color:'var(--emerald)', fontWeight:700 }}>[Ctx] </span>}
                            {q.question}
                          </div>
                        </td>
                        <td style={{ padding:'1rem', textAlign:'center', fontWeight:900, color:'var(--primary)' }}>{q.correct_answer}</td>
                        <td style={{ padding:'1rem', textAlign:'right' }}>
                          <button 
                            type="button"
                            onClick={() => setFileData(fileData.filter((_, i) => i !== idx))}
                            style={{ background:'rgba(239, 68, 68, 0.1)', color:'var(--danger)', border:'none', padding:'0.4rem 0.8rem', borderRadius:'8px', cursor:'pointer', fontSize:'0.75rem' }}
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button type="submit" className="btn" disabled={!fileData || !examName} style={{ 
            width: '100%', padding: '1.25rem', fontSize: '1.1rem', justifyContent: 'center',
            boxShadow: fileData && examName ? '0 10px 20px -5px rgba(79, 70, 229, 0.4)' : 'none',
            marginTop: '1rem'
          }}>
            🚀 Publier l'examen ({fileData?.length || 0} Questions)
          </button>
        </form>
      </div>
    </div>
  );
}
