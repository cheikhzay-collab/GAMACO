import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, Search, Filter, BookOpen, Calendar, Eye, Printer,
  Layers, Sparkles, ArrowUpDown, X, BookOpenCheck,
  SlidersHorizontal, ExternalLink, Edit, LayoutGrid, List, RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAllLessons } from '../services/lessonService';
import {
  normalizeNationalExam,
  isNationalExamDocument,
  sortNationalExams,
  NATIONAL_EXAM_DOMAINS,
  detectExerciseDomain
} from '../utils/nationalExamHelpers';
import { openNationalExamPrintWindow } from '../utils/generateNationalExamPDF';
import { openDevoirPrimePrintWindow } from '../utils/generateDevoirPrimePDF';
import { openNationalExamsBookPrintWindow } from '../utils/generateNationalExamsBookPDF';
import NationalExamTemplate from '../components/NationalExamTemplate';
import DevoirPrimeTemplate from '../components/DevoirPrimeTemplate';

export default function NationalExamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'prof' || user?.role === 'teacher';

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters, Search & View Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedSession, setSelectedSession] = useState('all'); // all, normale, rattrapage
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [sortMode, setSortMode] = useState('year_desc'); // year_desc, year_asc, session, title
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('national_exams_view_mode') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('national_exams_view_mode', mode);
    } catch {
      // ignore storage quota errors
    }
  };

  // Quick Preview Modal
  const [previewExam, setPreviewExam] = useState(null);
  const [previewTemplateMode, setPreviewTemplateMode] = useState('official'); // official, prime
  const [previewShowSolutions, setPreviewShowSolutions] = useState(false);

  // Book Printing Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookDomain, setBookDomain] = useState('all');
  const [bookTitle, setBookTitle] = useState('Annales des Examens Nationaux — Mathématiques');
  const [bookSubtitle, setBookSubtitle] = useState('Sessions Normales & de Rattrapage — Option Française (BIOF)');
  const [bookBranch, setBookBranch] = useState('2ème Baccalauréat — Sciences Mathématiques & Expérimentales');
  const [bookProfName, setBookProfName] = useState(user?.name ? `Prof. ${user.name}` : "Prof. L'CONQ");
  const [bookAcademicYear, setBookAcademicYear] = useState('2025 - 2026');
  const [bookShowSolutions, setBookShowSolutions] = useState(true);
  const [bookIncludeCover, setBookIncludeCover] = useState(true);
  const [bookIncludeIndex, setBookIncludeIndex] = useState(true);
  const [bookGenerating, setBookGenerating] = useState(false);

  // Load National Exams
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const allLessons = await getAllLessons();
        if (!mounted) return;

        const natExams = allLessons
          .filter(isNationalExamDocument)
          .map(normalizeNationalExam)
          .filter(Boolean);

        setExams(natExams);
      } catch (err) {
        console.error('Failed to load national exams:', err);
        setError('Impossible de charger les examens nationaux.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set(exams.map(e => e.year).filter(Boolean));
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [exams]);

  // Filtered & Sorted Exams
  const filteredExams = useMemo(() => {
    const result = exams.filter(exam => {
      // Search across both French & original fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (exam.title || '').toLowerCase().includes(q) || (exam.titleFr || '').toLowerCase().includes(q);
        const matchesSession = (exam.session || '').toLowerCase().includes(q) || (exam.sessionFr || '').toLowerCase().includes(q);
        const matchesYear = String(exam.year).includes(q);
        const matchesBranch = (exam.branch || '').toLowerCase().includes(q) || (exam.branchFr || '').toLowerCase().includes(q);
        const matchesSections = exam.sections.some(s => (s.title || '').toLowerCase().includes(q) || (s.content || '').toLowerCase().includes(q));
        if (!matchesTitle && !matchesSession && !matchesYear && !matchesBranch && !matchesSections) {
          return false;
        }
      }

      // Year Filter
      if (selectedYear !== 'all' && String(exam.year) !== String(selectedYear)) {
        return false;
      }

      // Session Filter
      if (selectedSession === 'normale' && exam.isRattrapage) return false;
      if (selectedSession === 'rattrapage' && !exam.isRattrapage) return false;

      // Branch Filter
      if (selectedBranch !== 'all' && exam.branchKey !== selectedBranch) {
        return false;
      }

      // Domain Filter
      if (selectedDomain !== 'all') {
        const hasDomain = exam.sections.some(s => detectExerciseDomain(s) === selectedDomain);
        if (!hasDomain) return false;
      }

      return true;
    });

    return sortNationalExams(result, sortMode);
  }, [exams, searchQuery, selectedYear, selectedSession, selectedBranch, selectedDomain, sortMode]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedYear !== 'all' ||
    selectedSession !== 'all' ||
    selectedBranch !== 'all' ||
    selectedDomain !== 'all'
  );

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedYear('all');
    setSelectedSession('all');
    setSelectedBranch('all');
    setSelectedDomain('all');
  };

  // Handler for Single Exam Print (Official or DEVOIR PRIME)
  const handlePrintSingleExam = async (exam, format = 'official', withSolutions = false) => {
    try {
      if (format === 'prime') {
        await openDevoirPrimePrintWindow(exam, {
          showSolutions: withSolutions,
          academicYear: bookAcademicYear,
          profName: user?.name || ''
        });
      } else {
        await openNationalExamPrintWindow(exam.content || exam, {
          showSolutions: withSolutions
        });
      }
    } catch (err) {
      alert(`Erreur lors de l'impression : ${err.message}`);
    }
  };

  // Handler for Master Book Print
  const handleGenerateBook = async () => {
    try {
      setBookGenerating(true);
      const targetExams = filteredExams.length > 0 ? filteredExams : exams;
      await openNationalExamsBookPrintWindow(targetExams, {
        title: bookTitle,
        subtitle: bookSubtitle,
        branch: bookBranch,
        profName: bookProfName,
        academicYear: bookAcademicYear,
        showSolutions: bookShowSolutions,
        domainFilter: bookDomain,
        includeCover: bookIncludeCover,
        includeIndex: bookIncludeIndex
      });
      setShowBookModal(false);
    } catch (err) {
      alert(`Erreur lors de la génération du recueil : ${err.message}`);
    } finally {
      setBookGenerating(false);
    }
  };

  return (
    <div
      className="national-exams-container"
      dir="ltr"
      style={{
        padding: '0 0.5rem 3rem',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
      }}
    >
      {/* ── 1. HERO HEADER BANNER ────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #005086 0%, #0369a1 60%, #0284c7 100%)',
        borderRadius: '20px',
        padding: '2rem 1.75rem',
        color: '#ffffff',
        marginBottom: '1.75rem',
        boxShadow: '0 10px 30px rgba(0, 80, 134, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Moroccan Emblem Background Watermark */}
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.12, pointerEvents: 'none' }}>
          <Award size={220} strokeWidth={1} />
        </div>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.28rem 0.9rem', background: 'rgba(255,255,255,0.18)', borderRadius: '99px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.75rem', backdropFilter: 'blur(8px)' }}>
              <span>🇲🇦</span> Royaume du Maroc — Ministère de l&apos;Éducation Nationale, du Préscolaire et des Sports
            </div>

            <h1 style={{ fontSize: '1.85rem', fontWeight: 900, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
              Examens Nationaux du Baccalauréat (2ème Bac)
            </h1>

            <p style={{ margin: 0, opacity: 0.92, fontSize: '0.92rem', maxWidth: '660px', lineHeight: 1.6 }}>
              Référentiel officiel intelligent de tous les examens nationaux de Mathématiques. Filtrez par domaines (Suites, Nombres Complexes, Analyse, Probabilités...) et imprimez des recueils complets avec couverture royale, sommaire et corrigés détaillés.
            </p>

            {/* Quick KPI stats */}
            <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(255,255,255,0.14)', padding: '0.42rem 0.9rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>
                📑 <strong>{exams.length}</strong> {exams.length > 1 ? 'examens nationaux' : 'examen national'}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.14)', padding: '0.42rem 0.9rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>
                📅 De <strong>{availableYears[availableYears.length - 1] || 2008}</strong> à <strong>{availableYears[0] || 2026}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.14)', padding: '0.42rem 0.9rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>
                🎯 <strong>{NATIONAL_EXAM_DOMAINS.length - 1}</strong> domaines indexés
              </div>
            </div>
          </div>

          {/* Master Actions Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: 'min(100%, 310px)' }}>
            <button
              type="button"
              onClick={() => {
                setBookDomain('all');
                setBookTitle('Annales des Examens Nationaux — Mathématiques');
                setShowBookModal(true);
              }}
              style={{
                background: '#ffffff',
                color: '#005086',
                border: 'none',
                padding: '0.75rem 1.35rem',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <BookOpenCheck size={19} color="#005086" />
              <span>Imprimer le Livre Complet (Couverture &amp; Index)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const targetDom = selectedDomain !== 'all' ? selectedDomain : 'suites';
                const dObj = NATIONAL_EXAM_DOMAINS.find(d => d.id === targetDom);
                setBookDomain(targetDom);
                setBookTitle(`Cahier Thématique — ${dObj?.labelFr || 'Mathématiques'}`);
                setShowBookModal(true);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                padding: '0.65rem 1.25rem',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                backdropFilter: 'blur(10px)'
              }}
            >
              <SlidersHorizontal size={17} />
              <span>Exporter un Cahier Thématique par Domaine</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin/ai-generator')}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Sparkles size={17} />
                <span>Importer un Examen National par IA</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. DOMAINS QUICK SELECTOR BAR ─────────────────────────────────── */}
      <div style={{ marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', minWidth: 'max-content' }}>
          {NATIONAL_EXAM_DOMAINS.map(dom => {
            const isActive = selectedDomain === dom.id;
            return (
              <button
                key={dom.id}
                type="button"
                onClick={() => setSelectedDomain(dom.id)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '99px',
                  border: `1.5px solid ${isActive ? dom.color : 'var(--border)'}`,
                  background: isActive ? dom.color : 'var(--bg-card)',
                  color: isActive ? '#ffffff' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? `0 4px 12px ${dom.color}40` : 'none'
                }}
              >
                <span>{dom.icon}</span>
                <span>{dom.labelFr}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. SEARCH, FILTERS & VIEW MODE TOOLBAR ────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.85rem',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 250px' }}>
          <Search size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Rechercher par année, session, thème ou énoncé..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-control"
            style={{ paddingLeft: '2.4rem', paddingRight: '0.85rem', height: '42px', fontSize: '0.86rem', width: '100%', direction: 'ltr' }}
          />
        </div>

        {/* Year Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calendar size={16} color="var(--text-muted)" />
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="input-control"
            style={{ height: '42px', padding: '0 0.85rem', fontSize: '0.84rem', fontWeight: 700 }}
          >
            <option value="all">Toutes les années</option>
            {availableYears.map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>

        {/* Session Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            value={selectedSession}
            onChange={e => setSelectedSession(e.target.value)}
            className="input-control"
            style={{ height: '42px', padding: '0 0.85rem', fontSize: '0.84rem', fontWeight: 700 }}
          >
            <option value="all">Toutes les sessions</option>
            <option value="normale">Session Normale uniquement</option>
            <option value="rattrapage">Session de Rattrapage uniquement</option>
          </select>
        </div>

        {/* Branch Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Layers size={16} color="var(--text-muted)" />
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="input-control"
            style={{ height: '42px', padding: '0 0.85rem', fontSize: '0.84rem', fontWeight: 700 }}
          >
            <option value="all">Toutes les filières</option>
            <option value="pc_svt">Sciences Expérimentales (PC / SVT / Agri)</option>
            <option value="sm">Sciences Mathématiques (A &amp; B)</option>
            <option value="tech">Sciences &amp; Technologies (STE / STM)</option>
            <option value="eco">Sciences Économiques &amp; Gestion</option>
          </select>
        </div>

        {/* Sort Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowUpDown size={16} color="var(--text-muted)" />
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value)}
            className="input-control"
            style={{ height: '42px', padding: '0 0.85rem', fontSize: '0.84rem', fontWeight: 700 }}
          >
            <option value="year_desc">Plus récents d&apos;abord (2026 → 2008)</option>
            <option value="year_asc">Plus anciens d&apos;abord (2008 → 2026)</option>
            <option value="session">Par session (Normale d&apos;abord)</option>
            <option value="title">Alphabétique (A → Z)</option>
          </select>
        </div>

        {/* View Mode Switcher (Grille / Liste) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '3px',
            gap: '2px',
            height: '42px'
          }}
          role="group"
          aria-label="Mode d'affichage"
        >
          <button
            type="button"
            onClick={() => handleSetViewMode('grid')}
            title="Affichage en cartes"
            style={{
              height: '34px',
              padding: '0 0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'grid' ? '#005086' : 'transparent',
              color: viewMode === 'grid' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutGrid size={15} />
            <span>Grille</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetViewMode('list')}
            title="Affichage en liste"
            style={{
              height: '34px',
              padding: '0 0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'list' ? '#005086' : 'transparent',
              color: viewMode === 'list' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease'
            }}
          >
            <List size={15} />
            <span>Liste</span>
          </button>
        </div>
      </div>

      {/* Results Summary Bar */}
      {!loading && !error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem',
          padding: '0 0.25rem',
          fontSize: '0.84rem',
          color: 'var(--text-muted)'
        }}>
          <span>
            <strong style={{ color: 'var(--text-main)' }}>{filteredExams.length}</strong>{' '}
            {filteredExams.length > 1 ? 'examens nationaux trouvés' : 'examen national trouvé'}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                background: 'none',
                border: 'none',
                color: '#005086',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: 0
              }}
            >
              <RotateCcw size={13} />
              <span>Réinitialiser les filtres</span>
            </button>
          )}
        </div>
      )}

      {/* ── 4. EXAMS VIEW (GRID OR LIST) ─────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem', width: '40px', height: '40px', border: '3px solid rgba(0,80,134,0.1)', borderTopColor: '#005086', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontWeight: 700 }}>Chargement et indexation des examens nationaux...</p>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#ef4444' }}>
          <p>{error}</p>
        </div>
      ) : filteredExams.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 1.5rem',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1.5px dashed var(--border)',
          color: 'var(--text-muted)'
        }}>
          <Award size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <h3 style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            Aucun examen national ne correspond à vos critères
          </h3>
          <p style={{ fontSize: '0.88rem', marginBottom: '1.25rem' }}>
            Essayez de réinitialiser les filtres ou de modifier votre recherche.
          </p>
          <button
            type="button"
            className="btn"
            onClick={resetFilters}
          >
            Réinitialiser tous les filtres
          </button>
        </div>
      ) : viewMode === 'list' ? (
        /* ── LIST / TABLE VIEW ───────────────────────────────────────────── */
        <div
          className="glass-panel"
          style={{
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border)',
            borderRadius: '16px',
            overflow: 'hidden',
            padding: 0,
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '780px' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 80, 134, 0.04)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.9rem 1.15rem', fontWeight: 800, fontSize: '0.73rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', width: '160px' }}>
                    Année &amp; Session
                  </th>
                  <th style={{ padding: '0.9rem 1rem', fontWeight: 800, fontSize: '0.73rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Examen &amp; Filière
                  </th>
                  <th style={{ padding: '0.9rem 1rem', fontWeight: 800, fontSize: '0.73rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Domaines abordés
                  </th>
                  <th style={{ padding: '0.9rem 1rem', fontWeight: 800, fontSize: '0.73rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', width: '145px' }}>
                    Contenu
                  </th>
                  <th style={{ padding: '0.9rem 1.15rem', fontWeight: 800, fontSize: '0.73rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.map((exam) => (
                  <tr
                    key={exam.id}
                    className="table-row-hover"
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                  >
                    {/* Year & Session */}
                    <td style={{ padding: '0.95rem 1.15rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            background: '#005086',
                            color: '#ffffff',
                            padding: '0.18rem 0.55rem',
                            borderRadius: '7px',
                            fontWeight: 900,
                            fontSize: '0.82rem'
                          }}>
                            {exam.year}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                            {exam.code}
                          </span>
                        </div>
                        <span style={{
                          background: exam.isRattrapage ? 'rgba(217, 119, 6, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                          color: exam.isRattrapage ? '#d97706' : '#059669',
                          border: `1px solid ${exam.isRattrapage ? 'rgba(217, 119, 6, 0.25)' : 'rgba(5, 150, 105, 0.25)'}`,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '99px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          whiteSpace: 'nowrap'
                        }}>
                          {exam.sessionShortFr}
                        </span>
                      </div>
                    </td>

                    {/* Title & Branch */}
                    <td style={{ padding: '0.95rem 1rem', verticalAlign: 'middle' }}>
                      <div
                        onClick={() => navigate(`/lessons/${exam.id}`)}
                        style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)', cursor: 'pointer', marginBottom: '0.2rem', lineHeight: 1.35 }}
                      >
                        {exam.titleFr}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {exam.branchFr}
                      </div>
                    </td>

                    {/* Domains */}
                    <td style={{ padding: '0.95rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {exam.domains.map(dId => {
                          const dObj = NATIONAL_EXAM_DOMAINS.find(d => d.id === dId);
                          if (!dObj) return null;
                          return (
                            <span
                              key={dId}
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                                background: `${dObj.color}12`,
                                color: dObj.color,
                                border: `1px solid ${dObj.color}25`,
                                fontWeight: 700,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {dObj.icon} {dObj.labelFr}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Structure & Points */}
                    <td style={{ padding: '0.95rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {exam.sections.length} {exam.sections.length > 1 ? 'exercices' : 'exercice'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#005086', fontWeight: 800, marginTop: '0.15rem' }}>
                        Barème : {exam.totalPoints} pts • {exam.durationFr}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.95rem 1.15rem', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => { setPreviewExam(exam); setPreviewTemplateMode('official'); }}
                          className="btn-outline"
                          title="Aperçu officiel"
                          style={{ padding: '0.38rem 0.6rem', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: '32px' }}
                        >
                          <Eye size={13} /> <span>Officiel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPreviewExam(exam); setPreviewTemplateMode('prime'); }}
                          className="btn-outline"
                          title="Aperçu DEVOIR PRIME"
                          style={{ padding: '0.38rem 0.6rem', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#d97706', borderColor: '#f59e0b', minHeight: '32px' }}
                        >
                          <Sparkles size={13} /> <span>PRIME</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintSingleExam(exam, 'official', false)}
                          className="btn"
                          title="Imprimer le sujet (PDF)"
                          style={{ padding: '0.38rem 0.65rem', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: '32px' }}
                        >
                          <Printer size={13} /> <span>Sujet</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintSingleExam(exam, 'official', true)}
                          className="btn"
                          title="Imprimer avec corrigé (PDF)"
                          style={{ padding: '0.38rem 0.65rem', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#059669', borderColor: '#059669', minHeight: '32px' }}
                        >
                          <BookOpen size={13} /> <span>Corrigé</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/lessons/${exam.id}`)}
                          className="btn-outline"
                          title="Ouvrir dans le lecteur"
                          style={{ padding: '0.38rem 0.55rem', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#005086', minHeight: '32px' }}
                        >
                          <ExternalLink size={13} />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/lessons/${exam.id}/edit`)}
                            className="btn-outline"
                            title="Modifier l'examen"
                            style={{ padding: '0.38rem 0.55rem', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', minHeight: '32px' }}
                          >
                            <Edit size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── CARDS GRID VIEW ─────────────────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))', gap: '1.25rem' }}>
          {filteredExams.map((exam) => {
            return (
              <div
                key={exam.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,80,134,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.03)'; }}
              >
                {/* Card Top: Year + Session Badges */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{
                        background: '#005086',
                        color: '#ffffff',
                        padding: '0.2rem 0.65rem',
                        borderRadius: '8px',
                        fontWeight: 900,
                        fontSize: '0.88rem'
                      }}>
                        {exam.year}
                      </span>
                      <span style={{
                        background: exam.isRattrapage ? 'rgba(217, 119, 6, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                        color: exam.isRattrapage ? '#d97706' : '#059669',
                        border: `1px solid ${exam.isRattrapage ? 'rgba(217, 119, 6, 0.25)' : 'rgba(5, 150, 105, 0.25)'}`,
                        padding: '0.2rem 0.65rem',
                        borderRadius: '99px',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}>
                        {exam.sessionFr}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {exam.code}
                    </span>
                  </div>

                  <h3 style={{
                    fontSize: '1.02rem',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    margin: '0 0 0.4rem 0',
                    lineHeight: 1.4
                  }}>
                    {exam.titleFr}
                  </h3>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                    {exam.branchFr}
                  </div>

                  {/* Domains Tags List */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.85rem' }}>
                    {exam.domains.map(dId => {
                      const dObj = NATIONAL_EXAM_DOMAINS.find(d => d.id === dId);
                      if (!dObj) return null;
                      return (
                        <span
                          key={dId}
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            background: `${dObj.color}10`,
                            color: dObj.color,
                            border: `1px solid ${dObj.color}25`,
                            fontWeight: 700
                          }}
                        >
                          {dObj.icon} {dObj.labelFr}
                        </span>
                      );
                    })}
                  </div>

                  {/* Exercises Mini-summary */}
                  <div style={{
                    background: 'rgba(0, 80, 134, 0.03)',
                    border: '1px solid rgba(0, 80, 134, 0.1)',
                    borderRadius: '10px',
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>Exercices &amp; problèmes : <strong>{exam.sections.length}</strong></span>
                    <span style={{ color: '#005086', fontWeight: 800 }}>Barème : {exam.totalPoints} pts</span>
                  </div>
                </div>

                {/* Card Actions Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <button
                      type="button"
                      onClick={() => { setPreviewExam(exam); setPreviewTemplateMode('official'); }}
                      className="btn-outline"
                      style={{ padding: '0.45rem', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    >
                      <Eye size={14} /> <span>Aperçu officiel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPreviewExam(exam); setPreviewTemplateMode('prime'); }}
                      className="btn-outline"
                      style={{ padding: '0.45rem', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: '#d97706', borderColor: '#f59e0b' }}
                    >
                      <Sparkles size={14} /> <span>DEVOIR PRIME</span>
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <button
                      type="button"
                      onClick={() => handlePrintSingleExam(exam, 'official', false)}
                      className="btn"
                      style={{ padding: '0.45rem', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    >
                      <Printer size={14} /> <span>Imprimer le sujet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintSingleExam(exam, 'official', true)}
                      className="btn"
                      style={{ padding: '0.45rem', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', background: '#059669', borderColor: '#059669' }}
                    >
                      <BookOpen size={14} /> <span>Avec corrigé</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/lessons/${exam.id}`)}
                      style={{ background: 'none', border: 'none', color: '#005086', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}
                    >
                      <span>Ouvrir dans le lecteur</span>
                      <ExternalLink size={13} />
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/lessons/${exam.id}/edit`)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}
                      >
                        <Edit size={13} />
                        <span>Modifier</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. MASTER BOOK PRINT MODAL ────────────────────────────────────── */}
      {showBookModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            maxWidth: '620px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            direction: 'ltr'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📘</span>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: '#005086' }}>
                    Configurer et imprimer le Recueil National
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Couverture royale + Sommaire indexé + Sujets officiels + Corrigés détaillés
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBookModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Fields Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Domain Target Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                  🎯 Domaine ciblé / Type de recueil :
                </label>
                <select
                  value={bookDomain}
                  onChange={e => {
                    const dom = e.target.value;
                    setBookDomain(dom);
                    if (dom === 'all') {
                      setBookTitle('Annales des Examens Nationaux — Mathématiques');
                    } else {
                      const dObj = NATIONAL_EXAM_DOMAINS.find(d => d.id === dom);
                      setBookTitle(`Cahier Thématique — ${dObj?.labelFr || ''}`);
                    }
                  }}
                  className="input-control"
                  style={{ width: '100%', height: '42px', fontSize: '0.86rem', fontWeight: 700 }}
                >
                  {NATIONAL_EXAM_DOMAINS.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.icon} {d.labelFr} {d.id === 'all' ? '— (Tous les examens complets)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Book Title */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                  Titre de l&apos;ouvrage (Couverture) :
                </label>
                <input
                  type="text"
                  value={bookTitle}
                  onChange={e => setBookTitle(e.target.value)}
                  className="input-control"
                  style={{ width: '100%', height: '40px', fontSize: '0.86rem', fontWeight: 700 }}
                />
              </div>

              {/* Book Subtitle */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                  Sous-titre :
                </label>
                <input
                  type="text"
                  value={bookSubtitle}
                  onChange={e => setBookSubtitle(e.target.value)}
                  className="input-control"
                  style={{ width: '100%', height: '40px', fontSize: '0.86rem' }}
                />
              </div>

              {/* Branch / Stream */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                  Filière / Niveau :
                </label>
                <input
                  type="text"
                  value={bookBranch}
                  onChange={e => setBookBranch(e.target.value)}
                  className="input-control"
                  style={{ width: '100%', height: '40px', fontSize: '0.86rem' }}
                />
              </div>

              {/* Author & Academic Year Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                    Professeur / Auteur :
                  </label>
                  <input
                    type="text"
                    value={bookProfName}
                    onChange={e => setBookProfName(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', height: '40px', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                    Année scolaire :
                  </label>
                  <input
                    type="text"
                    value={bookAcademicYear}
                    onChange={e => setBookAcademicYear(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', height: '40px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Toggles Options */}
              <div style={{ background: 'rgba(0, 80, 134, 0.04)', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid rgba(0, 80, 134, 0.12)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={bookIncludeCover}
                      onChange={e => setBookIncludeCover(e.target.checked)}
                      style={{ width: '17px', height: '17px' }}
                    />
                    <span>Inclure la page de couverture royale (Emblème officiel + Cadre + QR Code)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={bookIncludeIndex}
                      onChange={e => setBookIncludeIndex(e.target.checked)}
                      style={{ width: '17px', height: '17px' }}
                    />
                    <span>Inclure le sommaire complet (Tableau des examens, domaines et barèmes)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700, color: '#059669' }}>
                    <input
                      type="checkbox"
                      checked={bookShowSolutions}
                      onChange={e => setBookShowSolutions(e.target.checked)}
                      style={{ width: '17px', height: '17px' }}
                    />
                    <span>Inclure les corrigés détaillés et le barème officiel après chaque exercice</span>
                  </label>
                </div>
              </div>

              {/* Scope Info Summary */}
              <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                📌 <strong>Information :</strong>{' '}
                <strong>{filteredExams.length}</strong>{' '}
                {filteredExams.length > 1 ? 'examens nationaux correspondant' : 'examen national correspondant'} aux filtres actuels seront inclus. Filtrez par année ou session avant de générer si besoin.
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleGenerateBook}
                  disabled={bookGenerating}
                  className="btn"
                  style={{ flex: 1, height: '46px', fontSize: '0.92rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Printer size={18} />
                  <span>{bookGenerating ? 'Génération du livre en cours...' : 'Imprimer & Exporter le Livre (PDF)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="btn-outline"
                  style={{ height: '46px', padding: '0 1.25rem' }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. QUICK EXAM PREVIEW MODAL ───────────────────────────────────── */}
      {previewExam && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--bg-main)',
            borderRadius: '20px',
            maxWidth: '1000px',
            width: '100%',
            height: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
            direction: 'ltr'
          }}>
            {/* Modal Preview Header */}
            <div style={{
              padding: '0.85rem 1.5rem',
              background: '#005086',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Award size={22} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800 }}>{previewExam.titleFr}</h3>
                  <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{previewExam.sessionFr} • {previewExam.branchFr}</span>
                </div>
              </div>

              {/* Template Switcher & Print Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', borderRadius: '99px', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setPreviewTemplateMode('official')}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '99px',
                      border: 'none',
                      background: previewTemplateMode === 'official' ? '#ffffff' : 'transparent',
                      color: previewTemplateMode === 'official' ? '#005086' : '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Modèle National Officiel
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTemplateMode('prime')}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '99px',
                      border: 'none',
                      background: previewTemplateMode === 'prime' ? '#ffffff' : 'transparent',
                      color: previewTemplateMode === 'prime' ? '#005086' : '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    ⭐ DEVOIR PRIME
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewShowSolutions(v => !v)}
                  style={{
                    background: previewShowSolutions ? '#10b981' : 'rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.35)',
                    padding: '0.38rem 0.8rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <BookOpen size={14} /> <span>{previewShowSolutions ? 'Corrigé activé' : 'Afficher corrigé'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintSingleExam(previewExam, previewTemplateMode, previewShowSolutions)}
                  style={{
                    background: '#ffffff',
                    color: '#005086',
                    border: 'none',
                    padding: '0.4rem 0.95rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Printer size={15} /> <span>Imprimer PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewExam(null)}
                  style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Modal Preview Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#ffffff' }}>
              {previewTemplateMode === 'prime' ? (
                <DevoirPrimeTemplate
                  lesson={previewExam}
                  onSaveSuccess={() => {}}
                  isArabicMode={false}
                />
              ) : (
                <NationalExamTemplate
                  examData={previewExam.content || previewExam}
                  solutionMode={previewShowSolutions}
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
