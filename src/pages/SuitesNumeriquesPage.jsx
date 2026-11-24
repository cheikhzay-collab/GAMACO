import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SafeInlineMath, SafeBlockMath } from '../utils/mathRenderer';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, Printer, Check, X, Eye, EyeOff, 
  BookOpen, Calculator, BookOpenCheck
} from 'lucide-react';

export default function SuitesNumeriquesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const goBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }
    navigate('/study');
  };

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('suites'); // 'suites', 'denombrement', 'arithmetique', 'probabilites'
  
  // Interactive UI Style Toggle
  const [uiStyle, setUiStyle] = useState('interactive'); // 'interactive' (glassmorphism/dashboard) or 'classic' (exact paper look)
  
  // Solutions visibility
  const [showSolution1, setShowSolution1] = useState(false);
  const [showSolution2, setShowSolution2] = useState(false);
  
  // Interactive student checks
  const [ansU1, setAnsU1] = useState('');
  const [ansU2, setAnsU2] = useState('');
  const [checkResult2, setCheckResult2] = useState(null); // 'success', 'error', or null
  
  // Exercises Solutions visibility for other tabs
  const [showSolutionDenom, setShowSolutionDenom] = useState(false);
  const [showSolutionArith, setShowSolutionArith] = useState(false);
  const [showSolutionProb, setShowSolutionProb] = useState(false);
  
  // Inputs for other tab exercises
  const [ansDenom, setAnsDenom] = useState('');
  const [checkResultDenom, setCheckResultDenom] = useState(null);
  
  const [ansArith, setAnsArith] = useState('');
  const [checkResultArith, setCheckResultArith] = useState(null);
  
  const [ansProb, setAnsProb] = useState('');
  const [checkResultProb, setCheckResultProb] = useState(null);


  const handleCheckAnswersEx2 = (e) => {
    e.preventDefault();
    const cleanU1 = ansU1.trim();
    const cleanU2 = ansU2.trim();
    
    // Correct answers: u_1 = 3, u_2 = 7/3 (accept 7/3 or 2.33)
    const isU1Correct = cleanU1 === '3';
    const isU2Correct = cleanU2 === '7/3' || cleanU2 === '2.33' || cleanU2 === '2,33';
    
    if (isU1Correct && isU2Correct) {
      setCheckResult2('success');
    } else {
      setCheckResult2('error');
    }
  };

  const handleCheckDenom = (e) => {
    e.preventDefault();
    if (ansDenom.trim() === '120') {
      setCheckResultDenom('success');
    } else {
      setCheckResultDenom('error');
    }
  };

  const handleCheckArith = (e) => {
    e.preventDefault();
    const cleanVal = ansArith.trim();
    if (cleanVal === '2') {
      setCheckResultArith('success');
    } else {
      setCheckResultArith('error');
    }
  };

  const handleCheckProb = (e) => {
    e.preventDefault();
    const cleanVal = ansProb.trim().toLowerCase();
    if (
      cleanVal === '1/15' || 
      cleanVal === '0.067' || 
      cleanVal === '0,067' || 
      cleanVal === '0.0667' || 
      cleanVal === '0,0667'
    ) {
      setCheckResultProb('success');
    } else {
      setCheckResultProb('error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`suites-page-container ${uiStyle === 'classic' ? 'classic-view-active' : ''}`} style={{
      minHeight: '100vh',
      padding: '1.5rem',
      maxWidth: '1280px',
      margin: '0 auto',
      position: 'relative'
    }}>
      {/* Scope style variables */}
      <style>{`
        /* Styles scoped specifically for this page sheet */
        .sheet-container {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          display: flex;
          min-height: 80vh;
          box-shadow: var(--shadow-card);
          overflow: hidden;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .sheet-container {
          background: #ffffff !important;
          border: 2px solid #005086 !important;
          border-radius: 12px !important;
          color: #1a202c !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08) !important;
        }

        /* Sidebar Tabs layout */
        .sheet-sidebar {
          width: 80px;
          background: rgba(0, 80, 134, 0.03);
          border-right: 1.5px solid rgba(0, 80, 134, 0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 0;
          gap: 1.5rem;
          flex-shrink: 0;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .sheet-sidebar {
          background: #ffffff !important;
          border-right: 2px solid #005086 !important;
        }
        
        .vertical-tab {
          width: 44px;
          background: transparent;
          border: 1px solid rgba(0, 80, 134, 0.25);
          border-radius: 8px;
          padding: 1.5rem 0.5rem;
          cursor: pointer;
          writing-mode: vertical-rl;
          text-orientation: mixed;
          font-weight: 800;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          text-align: center;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: center;
        }
        
        .classic-view-active .vertical-tab {
          color: #005086 !important;
          border: 1.5px solid #005086 !important;
        }
        
        .vertical-tab:hover {
          background: rgba(0, 80, 134, 0.08);
          transform: translateY(-2px);
        }
        
        .vertical-tab.active-tab {
          background: #005086 !important;
          color: #ffffff !important;
          border-color: #005086 !important;
          box-shadow: 0 4px 15px rgba(0, 80, 134, 0.25);
          transform: scale(1.05);
        }

        /* Worksheet Body */
        .sheet-body {
          flex: 1;
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          overflow-y: auto;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .sheet-body {
          background: #ffffff !important;
          font-family: 'Times New Roman', Times, serif !important;
        }

        @media (max-width: 1024px) {
          .sheet-container {
            flex-direction: column !important;
          }
          .sheet-sidebar {
            width: 100% !important;
            height: auto !important;
            flex-direction: row !important;
            border-right: none !important;
            border-bottom: 1.5px solid rgba(0, 80, 134, 0.15) !important;
            padding: 0.5rem 0.75rem !important;
            gap: 0.5rem !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
          }
          .sheet-sidebar::-webkit-scrollbar {
            display: none !important;
          }
          .vertical-tab {
            writing-mode: horizontal-tb !important;
            width: auto !important;
            white-space: nowrap !important;
            padding: 0.45rem 0.85rem !important;
            font-size: 0.78rem !important;
            border-radius: 99px !important;
          }
          .sheet-body {
            padding: 1.25rem 0.85rem !important;
            gap: 1.25rem !important;
          }
          .sheet-header-banner {
            font-size: 1.25rem !important;
            padding: 0.5rem 1.25rem !important;
          }
        }

        /* Sheet top header */
        .sheet-header-banner {
          background: linear-gradient(135deg, #005086, #007cc6);
          border-radius: 99px;
          padding: 0.75rem 2.5rem;
          color: #ffffff;
          display: inline-flex;
          align-self: center;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.6rem;
          box-shadow: 0 4px 15px rgba(0, 80, 134, 0.2);
          letter-spacing: 0.02em;
          border: 2px solid rgba(255, 255, 255, 0.1);
        }
        
        .classic-view-active .sheet-header-banner {
          background: #005086 !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 20px !important;
          padding: 0.6rem 3rem !important;
        }

        /* Section badges */
        .section-badge-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #005086;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 0.95rem;
          flex-shrink: 0;
          box-shadow: 0 2px 5px rgba(0, 80, 134, 0.25);
        }
        
        .section-header-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-bottom: 2px solid rgba(0, 80, 134, 0.1);
          padding-bottom: 0.5rem;
          margin-bottom: 1rem;
        }
        
        .section-title-pill {
          font-size: 1.15rem;
          font-weight: 800;
          color: #005086;
          border: 1px solid rgba(0, 80, 134, 0.3);
          border-radius: 99px;
          padding: 0.25rem 1.25rem;
          display: inline-flex;
          background: rgba(0, 80, 134, 0.02);
        }
        
        .classic-view-active .section-title-pill {
          border: 1.5px solid #005086 !important;
          background: none !important;
          color: #005086 !important;
        }

        /* Subsection boxes */
        .subsection-card {
          border: 1.5px solid #005086;
          border-radius: 12px;
          padding: 1.5rem;
          background: rgba(0, 80, 134, 0.01);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .subsection-card {
          border: 1.5px solid #005086 !important;
          background: #ffffff !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }
        
        .subsection-header-inline {
          font-size: 1.05rem;
          font-weight: 800;
          color: #2d3748;
          border-bottom: 1px dashed rgba(0, 80, 134, 0.25);
          padding-bottom: 0.5rem;
          margin-bottom: 0.5rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        
        .classic-view-active .subsection-header-inline {
          color: #1a202c !important;
        }
        
        .accent-green-text {
          color: #10B981;
          font-weight: 800;
        }
        
        .classic-view-active .accent-green-text {
          color: #009688 !important; /* Muted corporate green from the original print */
        }

        /* Classic style bullet points */
        .bullet-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          line-height: 1.6;
          margin-bottom: 0.5rem;
        }
        
        .bullet-dot {
          color: #005086;
          font-size: 1.2rem;
          line-height: 1;
          margin-top: -0.1rem;
        }

        /* Columns for Notations */
        .notation-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin: 0.75rem 0;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }
        
        @media (max-width: 640px) {
          .notation-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
        }
        
        .notation-column {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          border-left: 2px solid rgba(0, 80, 134, 0.15);
          padding-left: 1rem;
        }

        /* Worksheet Math Table */
        .sheet-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.5rem;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(0, 80, 134, 0.2);
          font-size: 0.9rem;
        }
        
        .classic-view-active .sheet-table {
          border: 1.5px solid #1a202c !important;
        }
        
        .sheet-table th, .sheet-table td {
          border: 1px solid rgba(0, 80, 134, 0.2);
          padding: 0.75rem 1rem;
          text-align: center;
        }
        
        .classic-view-active .sheet-table th, 
        .classic-view-active .sheet-table td {
          border: 1.5px solid #1a202c !important;
          color: #1a202c !important;
        }
        
        .sheet-table th {
          background: rgba(0, 80, 134, 0.05);
          font-weight: 800;
          color: #005086;
        }
        
        .classic-view-active .sheet-table th {
          background: #f7fafc !important;
          color: #005086 !important;
        }

        /* Exercises design */
        .exercise-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .exercise-banner-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        
        .exercise-pill {
          background: #005086;
          color: #ffffff;
          padding: 0.35rem 1.25rem;
          border-radius: 99px;
          font-weight: 800;
          font-size: 0.9rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 2px 4px rgba(0, 80, 134, 0.15);
        }
        
        .solution-link-btn {
          background: none;
          border: none;
          color: #b91c1c; /* Maroon/reddish */
          cursor: pointer;
          font-weight: 700;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          text-decoration: underline;
          transition: all 0.2s;
        }
        
        .solution-link-btn:hover {
          color: #ef4444;
          transform: translateX(2px);
        }
        
        .exercise-body-box {
          border-left: 4px solid #005086;
          background: rgba(0, 80, 134, 0.02);
          border-top: 1px solid rgba(0, 80, 134, 0.1);
          border-right: 1px solid rgba(0, 80, 134, 0.1);
          border-bottom: 1px solid rgba(0, 80, 134, 0.1);
          border-radius: 4px 8px 8px 4px;
          padding: 1.25rem;
          line-height: 1.7;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .exercise-body-box {
          background: #ffffff !important;
          border: 1.5px solid #005086 !important;
          border-left: 5px solid #005086 !important;
          border-radius: 4px !important;
        }
        
        /* Interactive features */
        .interactive-form {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--bg-glass);
          border: 1px dashed var(--border);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .classic-view-active .interactive-form {
          border: 1px dashed #cbd5e1 !important;
          background: #f8fafc !important;
        }
        
        /* Printable css queries */
        @media print {
          body {
            background: #ffffff !important;
            color: #1a202c !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .suites-page-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
          .sheet-container {
            border: 1px solid #005086 !important;
            border-radius: 12px !important;
            box-shadow: none !important;
            background: #ffffff !important;
            display: flex !important;
            min-height: auto !important;
            overflow: visible !important;
          }
          .sheet-sidebar {
            display: flex !important;
            width: 80px !important;
            background: rgba(0, 80, 134, 0.03) !important;
            border-right: 1.5px solid rgba(0, 80, 134, 0.15) !important;
            padding: 2rem 0 !important;
            gap: 1.5rem !important;
            flex-shrink: 0 !important;
          }
          .vertical-tab {
            display: block !important;
            width: 44px !important;
            padding: 1.5rem 0.5rem !important;
            border-radius: 8px !important;
            font-size: 0.8rem !important;
            font-weight: 800 !important;
            writing-mode: vertical-rl !important;
            text-orientation: mixed !important;
            text-align: center !important;
          }
          .vertical-tab.active-tab {
            background: #005086 !important;
            color: #ffffff !important;
            border-color: #005086 !important;
          }
          .sheet-body {
            padding: 2.5rem !important;
            background: #ffffff !important;
            flex: 1 !important;
          }
          .exercise-body-box {
            background: rgba(0, 80, 134, 0.02) !important;
            border: 1px solid rgba(0, 80, 134, 0.1) !important;
            border-left: 4px solid #005086 !important;
          }
          .sheet-table {
            border: 1px solid rgba(0, 80, 134, 0.2) !important;
          }
          .sheet-table th, .sheet-table td {
            border: 1px solid rgba(0, 80, 134, 0.2) !important;
          }
          .subsection-card {
            border: 1.5px solid #005086 !important;
            background: rgba(0, 80, 134, 0.01) !important;
          }
          .interactive-form {
            display: none !important;
          }
        }
      `}</style>

      {/* BACK NAVIGATION & ACTIONS HEADER */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <button 
          onClick={goBack}
          className="btn-outline"
          style={{ 
            padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 800, 
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem' 
          }}
        >
          <ArrowLeft size={16} /> Retour aux révisions
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Style Switcher */}
          <div className="glass-panel" style={{
            padding: '0.25rem',
            borderRadius: '99px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.1rem',
            margin: 0,
            border: '1px solid var(--border)'
          }}>
            <button 
              onClick={() => setUiStyle('interactive')}
              style={{
                background: uiStyle === 'interactive' ? 'var(--violet)' : 'transparent',
                color: uiStyle === 'interactive' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                padding: '0.4rem 0.85rem',
                borderRadius: '99px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🚀 Dashboard
            </button>
            <button 
              onClick={() => setUiStyle('classic')}
              style={{
                background: uiStyle === 'classic' ? '#005086' : 'transparent',
                color: uiStyle === 'classic' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                padding: '0.4rem 0.85rem',
                borderRadius: '99px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📄 Style Papier
            </button>
          </div>

          {/* Print Button */}
          <button 
            onClick={handlePrint}
            className="btn"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #005086, #007cc6)'
            }}
          >
            <Printer size={16} /> Imprimer / PDF
          </button>
        </div>
      </div>

      {/* DOCUMENT SHEET WORKSPACE */}
      <div className="sheet-container">
        
        {/* LEFT VERTICAL CHAPTER TABS (Recreating the original layout) */}
        <div className="sheet-sidebar no-print">
          <button 
            className={`vertical-tab ${activeTab === 'suites' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('suites')}
          >
            Suites Numériques
          </button>
          <button 
            className={`vertical-tab ${activeTab === 'denombrement' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('denombrement')}
          >
            Dénombrement
          </button>
          <button 
            className={`vertical-tab ${activeTab === 'arithmetique' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('arithmetique')}
          >
            Arithmétique
          </button>
          <button 
            className={`vertical-tab ${activeTab === 'probabilites' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('probabilites')}
          >
            Probabilités
          </button>
        </div>

        {/* WORKBOOK MAIN BODY */}
        <div className="sheet-body">
          
          {/* TAB 1: SUITES NUMERIQUES */}
          {activeTab === 'suites' && (
            <>
              {/* Banner Title */}
              <div className="sheet-header-banner">
                Suites Numériques
              </div>

              {/* SECTION 1: RESUME */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="section-header-row">
                  <div className="section-badge-circle">1</div>
                  <div className="section-title-pill">Résumé : Suites Numériques</div>
                </div>

                {/* Generalities Card */}
                <div className="subsection-card">
                  <div className="subsection-header-inline">
                    <span>Généralités sur les suites numériques</span>
                    <span className="accent-green-text">Définitions-Notations-Vocabulaire</span>
                  </div>

                  <div className="bullet-item">
                    <span className="bullet-dot">•</span>
                    <span>On appelle suite numérique, toute fonction de <SafeInlineMath math="\mathbb{N}" /> vers <SafeInlineMath math="\mathbb{R}" />.</span>
                  </div>

                  <div style={{ marginTop: '0.25rem' }}>
                    Si <SafeInlineMath math="E" /> désigne l'ensemble de définition d'une suite numérique <SafeInlineMath math="u" />, on a les notations suivantes :
                  </div>

                  <div className="notation-grid">
                    <div className="notation-column">
                      <strong style={{ fontSize: '0.85rem', color: '#005086' }}>• Notation fonctionnelle</strong>
                      <SafeBlockMath math="u : E \rightarrow \mathbb{R}" />
                      <SafeBlockMath math="n \mapsto u(n)" />
                    </div>
                    <div className="notation-column">
                      <strong style={{ fontSize: '0.85rem', color: '#005086' }}>• Notation indicielle</strong>
                      <SafeBlockMath math="(u_n)_{n \in E}" />
                      <div style={{ textAlign: 'center', fontSize: '0.85rem', margin: '0.5rem 0' }}>ou, plus simplement,</div>
                      <SafeBlockMath math="(u_n)" />
                    </div>
                  </div>

                  <div style={{ lineHeight: 1.6, borderTop: '1px solid rgba(0,80,134,0.1)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                    <SafeInlineMath math="u(n)" /> ou <SafeInlineMath math="u_n" /> est appelé terme d'indice <SafeInlineMath math="n" /> ou terme général ; le <SafeInlineMath math="n^{\text{ème}}" /> terme est appelé terme de rang <SafeInlineMath math="n" />.
                  </div>
                </div>

                {/* Cas Particuliers Card */}
                <div className="subsection-card" style={{ marginTop: '0.5rem' }}>
                  <div className="subsection-header-inline">
                    <span>Cas particuliers</span>
                    <span className="accent-green-text">La suite arithmétique la suite géométrique</span>
                  </div>

                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table className="sheet-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>une suite arithmétique</th>
                          <th>une suite géométrique</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 800, color: '#005086' }}>Définition</td>
                          <td>
                            <SafeInlineMath math="(\forall n \ge n_0) : U_{n+1} = U_n + r" />
                          </td>
                          <td>
                            <SafeInlineMath math="(\forall n \ge n_0) : U_{n+1} = qU_n" />
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 800, color: '#005086' }}>Terme général</td>
                          <td>
                            <SafeInlineMath math="(\forall n \ge n_0) : U_n = U_p + (n-p)r" />
                          </td>
                          <td>
                            <SafeInlineMath math="(\forall n \ge n_0) : U_n = U_p \times q^{n-p}" />
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 800, color: '#005086' }}>
                            <SafeInlineMath math="S_n = U_p + \dots + U_n" />
                          </td>
                          <td>
                            <SafeBlockMath math="S_n = \left(\frac{n-p+1}{2}\right)(U_p + U_n)" />
                          </td>
                          <td>
                            <SafeBlockMath math="S_n = \left(\frac{1 - q^{n-p+1}}{1 - q}\right) \times U_p \quad (q \neq 1)" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PROBLEMS & EXERCISES */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                <div className="section-header-row">
                  <div className="section-badge-circle">2</div>
                  <div className="section-title-pill">Problème</div>
                </div>

                {/* EXERCICE 1 */}
                <div className="exercise-wrapper">
                  <div className="exercise-banner-row">
                    <div className="exercise-pill">
                      <span>Exercice N°</span>
                      <span style={{ 
                        background: '#ffffff', color: '#005086', 
                        width: '20px', height: '20px', borderRadius: '50%',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 900
                      }}>1</span>
                    </div>

                    <button 
                      className="solution-link-btn no-print"
                      onClick={() => setShowSolution1(!showSolution1)}
                    >
                      {showSolution1 ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showSolution1 ? 'Masquer la solution' : 'Solution de l\'exercice dans la page 9'}
                    </button>
                  </div>

                  <div className="exercise-body-box">
                    Montrer que la suite <SafeInlineMath math="(u_n)" /> définie par <SafeInlineMath math="u_0 = 1" />, <SafeInlineMath math="u_1 = 1" /> et, pour tout <SafeInlineMath math="n \in \mathbb{N}" />, par <SafeInlineMath math="u_{n+2} = 2u_{n+1} - u_n - 2" /> est décroissante.
                  </div>

                  {/* Collapsible Solution 1 */}
                  {showSolution1 && (
                    <div className="animate-fade-in glass-panel" style={{
                      marginTop: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.02)',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      padding: '1.5rem'
                    }}>
                      <h4 style={{ color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <BookOpenCheck size={18} /> Démonstration rédigée
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.92rem', lineHeight: 1.7 }}>
                        <p>
                          Soit la relation de récurrence : <SafeInlineMath math="u_{n+2} = 2u_{n+1} - u_n - 2" />.
                        </p>
                        <p>
                          On peut la réécrire sous la forme : 
                          <SafeBlockMath math="u_{n+2} - u_{n+1} = u_{n+1} - u_n - 2" />
                        </p>
                        <p>
                          Posons, pour tout entier <SafeInlineMath math="n" />, la suite différence <SafeInlineMath math="v_n = u_{n+1} - u_n" />. La relation devient alors :
                          <SafeBlockMath math="v_{n+1} = v_n - 2" />
                        </p>
                        <p>
                          On en déduit que la suite <SafeInlineMath math="(v_n)" /> est une <strong>suite arithmétique</strong> de raison <SafeInlineMath math="r = -2" /> et de premier terme :
                          <SafeBlockMath math="v_0 = u_1 - u_0 = 1 - 1 = 0" />
                        </p>
                        <p>
                          Ainsi, le terme général de <SafeInlineMath math="(v_n)" /> est :
                          <SafeBlockMath math="v_n = v_0 + n \cdot r = 0 - 2n = -2n" />
                        </p>
                        <p>
                          Pour tout <SafeInlineMath math="n \in \mathbb{N}" />, la différence entre deux termes consécutifs de <SafeInlineMath math="(u_n)" /> vaut :
                          <SafeBlockMath math="u_{n+1} - u_n = -2n" />
                        </p>
                        <p>
                          Puisque <SafeInlineMath math="n \ge 0" />, on a clairement <SafeInlineMath math="-2n \le 0" />, d'où :
                          <SafeBlockMath math="u_{n+1} - u_n \le 0 \quad (\forall n \in \mathbb{N})" />
                        </p>
                        <p style={{ color: '#059669', fontWeight: 700 }}>
                          La suite <SafeInlineMath math="(u_n)" /> est donc strictement décroissante. <SafeInlineMath math="\blacksquare" />
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* EXERCICE 2 */}
                <div className="exercise-wrapper" style={{ marginTop: '0.5rem' }}>
                  <div className="exercise-banner-row">
                    <div className="exercise-pill">
                      <span>Exercice N°</span>
                      <span style={{ 
                        background: '#ffffff', color: '#005086', 
                        width: '20px', height: '20px', borderRadius: '50%',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 900
                      }}>2</span>
                    </div>

                    <button 
                      className="solution-link-btn no-print"
                      onClick={() => setShowSolution2(!showSolution2)}
                    >
                      {showSolution2 ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showSolution2 ? 'Masquer la solution' : 'Solution de l\'exercice dans la page 9'}
                    </button>
                  </div>

                  <div className="exercise-body-box">
                    On considère la suite <SafeInlineMath math="(u_n)" /> définie par <SafeInlineMath math="u_0 = 5" /> et, pour tout entier <SafeInlineMath math="n" />, <SafeInlineMath math="3u_{n+1} = u_n + 4" />.
                    <div style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
                      1. Calculer <SafeInlineMath math="u_1" /> et <SafeInlineMath math="u_2" /> puis démontrer que, pour tout entier <SafeInlineMath math="n" />, <SafeInlineMath math="u_n \ge 2" />.
                    </div>
                  </div>

                  {/* Interactive Solver / Self-Check (No Print) */}
                  <form onSubmit={handleCheckAnswersEx2} className="interactive-form no-print">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#005086' }}>
                      <Calculator size={16} /> Mode interactif : Calculez et validez vos résultats
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '120px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                          <SafeInlineMath math="u_1 =" />
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: 3"
                          value={ansU1} 
                          onChange={(e) => setAnsU1(e.target.value)}
                          className="input-control" 
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: '120px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                          <SafeInlineMath math="u_2 =" />
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: 7/3"
                          value={ansU2} 
                          onChange={(e) => setAnsU2(e.target.value)}
                          className="input-control" 
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
                        />
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                      <button type="submit" className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', width: 'fit-content' }}>
                        Vérifier mes réponses
                      </button>

                      {checkResult2 === 'success' && (
                        <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={16} strokeWidth={3} /> Excellent ! Réponses correctes.
                        </span>
                      )}
                      {checkResult2 === 'error' && (
                        <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <X size={16} strokeWidth={3} /> Mauvaise réponse, réessayez (astuce : utilisez les fractions).
                        </span>
                      )}
                    </div>
                  </form>

                  {/* Collapsible Solution 2 */}
                  {showSolution2 && (
                    <div className="animate-fade-in glass-panel" style={{
                      marginTop: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.02)',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      padding: '1.5rem'
                    }}>
                      <h4 style={{ color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <BookOpenCheck size={18} /> Corrigé de l'exercice
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.92rem', lineHeight: 1.7 }}>
                        <div>
                          <strong style={{ color: '#005086' }}>1. Calcul des premiers termes :</strong>
                          <div style={{ paddingLeft: '1rem', marginTop: '0.5rem' }}>
                            <p>
                              Pour <SafeInlineMath math="n = 0" /> :
                              <SafeBlockMath math="3u_1 = u_0 + 4 \implies 3u_1 = 5 + 4 = 9 \implies u_1 = 3" />
                            </p>
                            <p style={{ marginTop: '0.5rem' }}>
                              Pour <SafeInlineMath math="n = 1" /> :
                              <SafeBlockMath math="3u_2 = u_1 + 4 \implies 3u_2 = 3 + 4 = 7 \implies u_2 = \frac{7}{3}" />
                            </p>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(0,80,134,0.1)', paddingTop: '0.75rem' }}>
                          <strong style={{ color: '#005086' }}>2. Démonstration par récurrence de la relation <SafeInlineMath math="u_n \ge 2" /> :</strong>
                          <div style={{ paddingLeft: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <p>
                              Soit la propriété <SafeInlineMath math="\mathcal{P}(n) : u_n \ge 2" /> pour tout entier <SafeInlineMath math="n \ge 0" />.
                            </p>
                            <p>
                              <strong>• Initialisation :</strong> Pour <SafeInlineMath math="n = 0" />, <SafeInlineMath math="u_0 = 5" />. 
                              Comme <SafeInlineMath math="5 \ge 2" />, la propriété <SafeInlineMath math="\mathcal{P}(0)" /> est vraie.
                            </p>
                            <p>
                              <strong>• Hérédité :</strong> Soit un entier <SafeInlineMath math="n \ge 0" />. 
                              Supposons que <SafeInlineMath math="\mathcal{P}(n)" /> soit vraie, c'est-à-dire que <SafeInlineMath math="u_n \ge 2" /> (Hypothèse de récurrence).
                              Montrons que <SafeInlineMath math="\mathcal{P}(n+1)" /> est vraie, c'est-à-dire <SafeInlineMath math="u_{n+1} \ge 2" />.
                            </p>
                            <div style={{ paddingLeft: '1rem' }}>
                              On a la relation de récurrence : <SafeInlineMath math="3u_{n+1} = u_n + 4" />.
                              <br />
                              Puisque par hypothèse <SafeInlineMath math="u_n \ge 2" />, on a :
                              <SafeBlockMath math="u_n + 4 \ge 2 + 4 \implies u_n + 4 \ge 6" />
                              Par conséquent :
                              <SafeBlockMath math="3u_{n+1} \ge 6 \implies u_{n+1} \ge \frac{6}{3} \implies u_{n+1} \ge 2" />
                              La propriété est donc héritée au rang <SafeInlineMath math="n+1" />.
                            </div>
                            <p>
                              <strong>• Conclusion :</strong> Par le principe de récurrence, nous avons démontré que pour tout entier naturel <SafeInlineMath math="n" />, <SafeInlineMath math="u_n \ge 2" />. <SafeInlineMath math="\blacksquare" />
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: DENOMBREMENT */}
          {activeTab === 'denombrement' && (
            <>
              <div className="sheet-header-banner">
                Dénombrement
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="section-header-row">
                  <div className="section-badge-circle">1</div>
                  <div className="section-title-pill">Résumé : Analyse Combinatoire</div>
                </div>

                <div className="subsection-card">
                  <div className="subsection-header-inline">
                    <span>Outils de dénombrement fondamentaux</span>
                    <span className="accent-green-text">Formules et Propriétés</span>
                  </div>

                  <div className="bullet-item">
                    <span className="bullet-dot">•</span>
                    <span><strong>Cardinal d'un ensemble :</strong> Le cardinal d'un ensemble fini <SafeInlineMath math="A" />, noté <SafeInlineMath math="\text{card}(A)" /> ou <SafeInlineMath math="\#A" />, est le nombre d'éléments de cet ensemble.</span>
                  </div>

                  <div style={{ overflowX: 'auto', width: '100%', marginTop: '0.5rem' }}>
                    <table className="sheet-table">
                      <thead>
                        <tr>
                          <th>Concept</th>
                          <th>Conditions</th>
                          <th>Formule d'obtention</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 800, color: '#005086' }}>Permutations</td>
                          <td>Ordre important, tous les éléments sans répétition</td>
                          <td>
                            <SafeInlineMath math="P_n = n!" />
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 800, color: '#005086' }}>Arrangements</td>
                          <td>Ordre important, <SafeInlineMath math="p" /> éléments parmi <SafeInlineMath math="n" /> sans répétition</td>
                          <td>
                            <SafeInlineMath math="A_n^p = \frac{n!}{(n-p)!}" />
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 800, color: '#005086' }}>Combinaisons</td>
                          <td>Ordre NON important, <SafeInlineMath math="p" /> éléments parmi <SafeInlineMath math="n" /></td>
                          <td>
                            <SafeInlineMath math="C_n^p = \binom{n}{p} = \frac{n!}{p!(n-p)!}" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: '0.75rem', lineHeight: 1.6 }}>
                    <strong style={{ color: '#005086' }}>• Propriétés des Combinaisons :</strong>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <SafeBlockMath math="\binom{n}{0} = 1 \quad ; \quad \binom{n}{n} = 1" />
                      </div>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <SafeBlockMath math="\binom{n}{p} = \binom{n}{n-p}" />
                      </div>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <SafeBlockMath math="\binom{n}{p} + \binom{n}{p+1} = \binom{n+1}{p+1}" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="section-header-row" style={{ marginTop: '1rem' }}>
                  <div className="section-badge-circle">2</div>
                  <div className="section-title-pill">Application Interactive</div>
                </div>

                <div className="exercise-wrapper">
                  <div className="exercise-banner-row">
                    <div className="exercise-pill">Exercice N° 1</div>
                    <button 
                      className="solution-link-btn no-print"
                      onClick={() => setShowSolutionDenom(!showSolutionDenom)}
                    >
                      {showSolutionDenom ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showSolutionDenom ? 'Masquer la solution' : 'Afficher la solution rédigée'}
                    </button>
                  </div>

                  <div className="exercise-body-box">
                    De combien de manières différentes peut-on asseoir 5 étudiants sur une rangée de 5 chaises ?
                  </div>

                  <form onSubmit={handleCheckDenom} className="interactive-form no-print">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#005086' }}>
                      <Calculator size={16} /> Entrez votre réponse numérique :
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        placeholder="Ex: 120"
                        value={ansDenom} 
                        onChange={(e) => setAnsDenom(e.target.value)}
                        className="input-control" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '120px' }}
                      />
                      <button type="submit" className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>
                        Vérifier
                      </button>

                      {checkResultDenom === 'success' && (
                        <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={16} strokeWidth={3} /> Correct ! C'est bien une permutation de 5 éléments.
                        </span>
                      )}
                      {checkResultDenom === 'error' && (
                        <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <X size={16} strokeWidth={3} /> Incorrect, pensez à calculer <SafeInlineMath math="5!" />.
                        </span>
                      )}
                    </div>
                  </form>

                  {showSolutionDenom && (
                    <div className="animate-fade-in glass-panel" style={{
                      marginTop: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.02)',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      padding: '1.5rem'
                    }}>
                      <strong style={{ color: '#059669' }}>Corrigé rédigé :</strong>
                      <p style={{ marginTop: '0.5rem', lineHeight: 1.6 }}>
                        Il s'agit d'ordonner 5 personnes distinctes dans 5 emplacements ordonnés. C'est une permutation simple de 5 éléments.
                        <br />
                        Le nombre de dispositions possibles est :
                        <SafeBlockMath math="P_5 = 5! = 5 \times 4 \times 3 \times 2 \times 1 = 120" />
                        Il y a donc <strong>120 manières</strong> différentes d'asseoir ces étudiants.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 3: ARITHMETIQUE */}
          {activeTab === 'arithmetique' && (
            <>
              <div className="sheet-header-banner">
                Arithmétique
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="section-header-row">
                  <div className="section-badge-circle">1</div>
                  <div className="section-title-pill">Résumé : Propriétés dans <SafeInlineMath math="\mathbb{Z}" /></div>
                </div>

                <div className="subsection-card">
                  <div className="subsection-header-inline">
                    <span>Arithmétique modulaire et Divisibilité</span>
                    <span className="accent-green-text">Congruences, Bézout, Gauss</span>
                  </div>

                  <div className="bullet-item">
                    <span className="bullet-dot">•</span>
                    <span><strong>Division Euclidienne :</strong> Pour tout <SafeInlineMath math="(a, b) \in \mathbb{Z} \times \mathbb{N}^*" />, il existe un unique couple <SafeInlineMath math="(q, r) \in \mathbb{Z}^2" /> tel que :
                    <SafeBlockMath math="a = bq + r \quad \text{avec} \quad 0 \le r < b" />
                    </span>
                  </div>

                  <div className="bullet-item" style={{ marginTop: '0.5rem' }}>
                    <span className="bullet-dot">•</span>
                    <span><strong>Relation de congruence :</strong> <SafeInlineMath math="a \equiv b \pmod n" /> signifie que <SafeInlineMath math="a - b" /> est un multiple de <SafeInlineMath math="n" />.</span>
                  </div>

                  <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'rgba(0,80,134,0.03)', borderRadius: '8px', border: '1px solid rgba(0,80,134,0.1)' }}>
                    <strong style={{ color: '#005086' }}>Théorèmes fondamentaux :</strong>
                    <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <li><strong>Identité de Bézout :</strong> <SafeInlineMath math="a" /> et <SafeInlineMath math="b" /> sont premiers entre eux si et seulement s'il existe <SafeInlineMath math="(u, v) \in \mathbb{Z}^2" /> tel que <SafeInlineMath math="au + bv = 1" />.</li>
                      <li><strong>Théorème de Gauss :</strong> Si <SafeInlineMath math="a" /> divise le produit <SafeInlineMath math="bc" /> et si <SafeInlineMath math="a" /> et <SafeInlineMath math="b" /> sont premiers entre eux, alors <SafeInlineMath math="a" /> divise <SafeInlineMath math="c" />.</li>
                    </ul>
                  </div>
                </div>

                <div className="section-header-row" style={{ marginTop: '1rem' }}>
                  <div className="section-badge-circle">2</div>
                  <div className="section-title-pill">Application Interactive</div>
                </div>

                <div className="exercise-wrapper">
                  <div className="exercise-banner-row">
                    <div className="exercise-pill">Exercice N° 1</div>
                    <button 
                      className="solution-link-btn no-print"
                      onClick={() => setShowSolutionArith(!showSolutionArith)}
                    >
                      {showSolutionArith ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showSolutionArith ? 'Masquer la solution' : 'Afficher la solution rédigée'}
                    </button>
                  </div>

                  <div className="exercise-body-box">
                    Déterminer le reste de la division euclidienne de <SafeInlineMath math="2^{2026}" /> par <SafeInlineMath math="7" />.
                  </div>

                  <form onSubmit={handleCheckArith} className="interactive-form no-print">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#005086' }}>
                      <Calculator size={16} /> Entrez le reste obtenu :
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        placeholder="Reste entre 0 et 6"
                        value={ansArith} 
                        onChange={(e) => setAnsArith(e.target.value)}
                        className="input-control" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '150px' }}
                      />
                                 {checkResultArith === 'success' && (
                        <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={16} strokeWidth={3} /> Correct ! Le reste est effectivement 2.
                        </span>
                      )}
                      {checkResultArith === 'error' && (
                        <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <X size={16} strokeWidth={3} /> Incorrect. Rappel : calculez les premières puissances de 2 modulo 7.
                        </span>
                      )}
                    </div>
                  </form>

                  {showSolutionArith && (
                    <div className="animate-fade-in glass-panel" style={{
                      marginTop: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.02)',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      padding: '1.5rem'
                    }}>
                      <strong style={{ color: '#059669' }}>Corrigé rédigé :</strong>
                      <div style={{ marginTop: '0.5rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p>Étudions les puissances de 2 modulo 7 :</p>
                        <ul style={{ paddingLeft: '1.5rem' }}>
                          <li><SafeInlineMath math="2^0 \equiv 1 \pmod 7" /></li>
                          <li><SafeInlineMath math="2^1 \equiv 2 \pmod 7" /></li>
                          <li><SafeInlineMath math="2^2 \equiv 4 \pmod 7" /></li>
                          <li><SafeInlineMath math="2^3 \equiv 8 \equiv 1 \pmod 7" /></li>
                        </ul>
                        <p>Ainsi, le reste se répète avec une période de 3. Effectuons la division de l'exposant 2026 par 3 :</p>
                        <SafeBlockMath math="2026 = 3 \times 675 + 1" />
                        <p>On en conclut :</p>
                        <SafeBlockMath math="2^{2026} = 2^{3 \times 675 + 1} = (2^3)^{675} \times 2^1 \equiv 1^{675} \times 2 \equiv 2 \pmod 7" />
                        <p style={{ color: '#059669', fontWeight: 700 }}>
                          Le reste de la division euclidienne de <SafeInlineMath math="2^{2026}" /> par 7 est donc égal à 2. <SafeInlineMath math="\blacksquare" />
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 4: PROBABILITES */}
          {activeTab === 'probabilites' && (
            <>
              <div className="sheet-header-banner">
                Probabilités
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="section-header-row">
                  <div className="section-badge-circle">1</div>
                  <div className="section-title-pill">Résumé : Probabilités fondamentales</div>
                </div>

                <div className="subsection-card">
                  <div className="subsection-header-inline">
                    <span>Espace probabilisé fini et conditionnement</span>
                    <span className="accent-green-text">Équiprobabilité, Bayes, Totales</span>
                  </div>

                  <div className="bullet-item">
                    <span className="bullet-dot">•</span>
                    <span><strong>Équiprobabilité :</strong> Si tous les événements élémentaires ont la même probabilité d'apparaître, pour tout événement <SafeInlineMath math="A" /> :
                    <SafeBlockMath math="P(A) = \frac{\text{card}(A)}{\text{card}(\Omega)}" />
                    </span>
                  </div>

                  <div className="bullet-item" style={{ marginTop: '0.5rem' }}>
                    <span className="bullet-dot">•</span>
                    <span><strong>Probabilité conditionnelle :</strong> La probabilité de l'événement <SafeInlineMath math="A" /> sachant que l'événement <SafeInlineMath math="B" /> (avec <SafeInlineMath math="P(B) > 0" />) est réalisé est :
                    <SafeBlockMath math="P_B(A) = P(A|B) = \frac{P(A \cap B)}{P(B)}" />
                    </span>
                  </div>

                  <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'rgba(0,80,134,0.03)', borderRadius: '8px', border: '1px solid rgba(0,80,134,0.1)' }}>
                    <strong style={{ color: '#005086' }}>Formule des Probabilités Totales :</strong>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.88rem', lineHeight: 1.6 }}>
                      Soit <SafeInlineMath math="B_1, B_2, \dots, B_n" /> une partition de l'univers <SafeInlineMath math="\Omega" /> formée d'événements de probabilités non nulles. Pour tout événement <SafeInlineMath math="A" /> :
                      <SafeBlockMath math="P(A) = \sum_{i=1}^{n} P(A \cap B_i) = \sum_{i=1}^{n} P(B_i) \times P_{B_i}(A)" />
                    </div>
                  </div>
                </div>

                <div className="section-header-row" style={{ marginTop: '1rem' }}>
                  <div className="section-badge-circle">2</div>
                  <div className="section-title-pill">Application Interactive</div>
                </div>

                <div className="exercise-wrapper">
                  <div className="exercise-banner-row">
                    <div className="exercise-pill">Exercice N° 1</div>
                    <button 
                      className="solution-link-btn no-print"
                      onClick={() => setShowSolutionProb(!showSolutionProb)}
                    >
                      {showSolutionProb ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showSolutionProb ? 'Masquer la solution' : 'Afficher la solution rédigée'}
                    </button>
                  </div>

                  <div className="exercise-body-box">
                    Une urne contient 3 boules blanches et 7 boules noires. On tire successivement et sans remise 2 boules de l'urne.
                    <br />
                    Quelle est la probabilité d'obtenir une boule blanche au premier tirage et une boule blanche au second tirage ?
                  </div>

                  <form onSubmit={handleCheckProb} className="interactive-form no-print">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#005086' }}>
                      <Calculator size={16} /> Entrez la probabilité obtenue (fraction ou décimal) :
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        placeholder="Ex: 3/10 or 0.3"
                        value={ansProb} 
                        onChange={(e) => setAnsProb(e.target.value)}
                        className="input-control" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '150px' }}
                      />
                      <button type="submit" className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>
                        Vérifier
                      </button>

                      {checkResultProb === 'success' && (
                        <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={16} strokeWidth={3} /> Correct ! La probabilité est effectivement <SafeInlineMath math="1/15 \approx 0.067" />.
                        </span>
                      )}
                      {checkResultProb === 'error' && (
                        <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <X size={16} strokeWidth={3} /> Réponse incorrecte. Pensez au tirage sans remise.
                        </span>
                      )}
                    </div>
                  </form>

                  {showSolutionProb && (
                    <div className="animate-fade-in glass-panel" style={{
                      marginTop: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.02)',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      padding: '1.5rem'
                    }}>
                      <strong style={{ color: '#059669' }}>Corrigé rédigé :</strong>
                      <p style={{ marginTop: '0.5rem', lineHeight: 1.6 }}>
                        Soit <SafeInlineMath math="B_1" /> l'événement "obtenir une boule blanche au premier tirage" et <SafeInlineMath math="B_2" /> l'événement "obtenir une boule blanche au second tirage".
                        <br />
                        On cherche à calculer la probabilité de l'intersection <SafeInlineMath math="P(B_1 \cap B_2)" /> :
                        <SafeBlockMath math="P(B_1 \cap B_2) = P(B_1) \times P_{B_1}(B_2)" />
                        Au premier tirage, il y a 3 boules blanches sur 10 au total :
                        <SafeBlockMath math="P(B_1) = \frac{3}{10}" />
                        Puisque le tirage est sans remise, il reste 9 boules dans l'urne au second tirage, dont 2 blanches. La probabilité conditionnelle vaut donc :
                        <SafeBlockMath math="P_{B_1}(B_2) = \frac{2}{9}" />
                        Ainsi :
                        <SafeBlockMath math="P(B_1 \cap B_2) = \frac{3}{10} \times \frac{2}{9} = \frac{6}{90} = \frac{1}{15} \approx 0,067" />
                        La probabilité d'obtenir deux boules blanches consécutives est de <strong>1/15</strong> (soit environ <strong>6,7%</strong>).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
