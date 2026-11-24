import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, Search, Filter, BookOpen, Calendar, Eye, Printer,
  Layers, ChevronDown, Check, Sparkles, ArrowUpDown, FileText,
  CheckCircle2, X, BookOpenCheck, SlidersHorizontal, BookMarked, ExternalLink,
  Edit, ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getLessons } from '../services/lessonService';
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
  const isAdmin = user?.role === 'admin';

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedSession, setSelectedSession] = useState('all'); // all, normale, rattrapage
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [sortMode, setSortMode] = useState('year_desc'); // year_desc, year_asc, session

  // Quick Preview Modal
  const [previewExam, setPreviewExam] = useState(null);
  const [previewTemplateMode, setPreviewTemplateMode] = useState('official'); // official, prime

  // Book Printing Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookDomain, setBookDomain] = useState('all');
  const [bookTitle, setBookTitle] = useState('الموسوعة الشاملة في الرياضيات — الامتحانات الوطنية الموحدة');
  const [bookSubtitle, setBookSubtitle] = useState('الدورة العادية والاستدراكية — خيار فرنسية BIOF');
  const [bookBranch, setBookBranch] = useState('2ème Baccalauréat — Sciences Mathématiques & Expérimentales');
  const [bookProfName, setBookProfName] = useState(user?.name ? `الأستاذ(ة): ${user.name}` : 'الأستاذ: ذ. بنك الرياضيات');
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
        const allLessons = await getLessons();
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
    let result = exams.filter(exam => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (exam.title || '').toLowerCase().includes(q);
        const matchesSession = (exam.session || '').toLowerCase().includes(q);
        const matchesYear = String(exam.year).includes(q);
        const matchesBranch = (exam.branch || '').toLowerCase().includes(q);
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
      if (selectedBranch !== 'all') {
        const b = (exam.branch || '').toLowerCase();
        if (selectedBranch === 'sm' && !b.includes('رياضية') && !b.includes('math')) return false;
        if (selectedBranch === 'pc_svt' && (b.includes('رياضية') || b.includes('math'))) return false;
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

  // Handler for Single Exam Print (Official or DEVOIR PRIME)
  const handlePrintSingleExam = (exam, format = 'official', withSolutions = false) => {
    if (format === 'prime') {
      openDevoirPrimePrintWindow(exam, {
        showSolutions: withSolutions,
        academicYear: bookAcademicYear,
        profName: user?.name || ''
      });
    } else {
      openNationalExamPrintWindow(exam.content || exam, {
        showSolutions: withSolutions
      });
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
      alert(`Erreur lors de la génération du livre: ${err.message}`);
    } finally {
      setBookGenerating(false);
    }
  };

  return (
    <div className="national-exams-container" style={{ padding: '0 0.5rem 3rem' }}>
      
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.25rem 0.85rem', background: 'rgba(255,255,255,0.18)', borderRadius: '99px', fontSize: '0.78rem', fontWeight: 800, marginBottom: '0.75rem', backdropFilter: 'blur(8px)' }}>
              <span>🇲🇦</span> المملكة المغربية — وزارة التربية الوطنية والتعليم الأولي والرياضة
            </div>
            
            <h1 style={{ fontSize: '1.85rem', fontWeight: 900, margin: '0 0 0.5rem 0', fontFamily: "'Cairo', 'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>
              الامتحانات الوطنية الموحدة للبكالوريا (2 Bac)
            </h1>
            
            <p style={{ margin: 0, opacity: 0.9, fontSize: '0.92rem', maxWidth: '650px', lineHeight: 1.6, fontFamily: "'Cairo', sans-serif" }}>
              مستودع رسمي ذكي لجميع الامتحانات الوطنية الموحدة لمادة الرياضيات. تصفح، حلل حسب المجالات (متتاليات، أعداد عقدية، دوال، احتمالات)، واطبع كتباً ومصنفات شاملة بالغلاف الملكي والفهرس والتصحيح النموذجي.
            </p>

            {/* Quick KPI stats */}
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(255,255,255,0.12)', padding: '0.4rem 0.85rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>
                📑 <strong>{exams.length}</strong> امتحان وطني مسجل
              </div>
              <div style={{ background: 'rgba(255,255,255,0.12)', padding: '0.4rem 0.85rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>
                📅 من <strong>{availableYears[availableYears.length - 1] || 2008}</strong> إلى <strong>{availableYears[0] || 2026}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.12)', padding: '0.4rem 0.85rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>
                🎯 <strong>{NATIONAL_EXAM_DOMAINS.length - 1}</strong> مجالات مبوبة
              </div>
            </div>
          </div>

          {/* Master Actions Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={() => { setBookDomain('all'); setShowBookModal(true); }}
              style={{
                background: '#ffffff',
                color: '#005086',
                border: 'none',
                padding: '0.75rem 1.4rem',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                transition: 'transform 0.15s ease',
                fontFamily: "'Cairo', sans-serif"
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <BookOpenCheck size={20} color="#005086" />
              <span>طبع كتاب الامتحانات الشامل (بالغلاف والفهرس)</span>
            </button>

            <button
              type="button"
              onClick={() => { setBookDomain(selectedDomain !== 'all' ? selectedDomain : 'suites'); setShowBookModal(true); }}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                padding: '0.65rem 1.25rem',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backdropFilter: 'blur(10px)',
                fontFamily: "'Cairo', sans-serif"
              }}
            >
              <SlidersHorizontal size={17} />
              <span>تصدير مصنف موضوعاتي حسب المجال (Cahier Thématique)</span>
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
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: "'Cairo', sans-serif"
                }}
              >
                <Sparkles size={17} />
                <span>استيراد امتحان وطني جديد بالذكاء الاصطناعي</span>
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
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? `0 4px 12px ${dom.color}40` : 'none',
                  fontFamily: "'Cairo', sans-serif"
                }}
              >
                <span>{dom.icon}</span>
                <span>{dom.labelAr}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. SEARCH & CONTROLS TOOLBAR ─────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.85rem',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="ابحث بالسنة، الدورة، الموضوع أو نص المسألة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-control"
            style={{ paddingRight: '2.4rem', paddingLeft: '0.85rem', height: '42px', fontSize: '0.88rem', width: '100%', direction: 'rtl', fontFamily: "'Cairo', sans-serif" }}
          />
        </div>

        {/* Year Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calendar size={16} color="var(--text-muted)" />
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="input-control"
            style={{ height: '42px', padding: '0 0.85rem', fontSize: '0.85rem', fontWeight: 700 }}
          >
            <option value="all">جميع السنوات</option>
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
            style={{ height: '42px', padding: '0 0.85rem', fontSize: '0.85rem', fontWeight: 700 }}
          >
            <option value="all">جميع الدورات</option>
            <option value="normale">الدورة العادية فقط</option>
            <option value="rattrapage">الدورة الاستدراكية فقط</option>
          </select>
        </div>

        {/* Branch Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Layers size={16} color="var(--text-muted)" />
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="input-control"
            style={{ height: '42px', padding: '0 0.85rem', fontSize: '0.85rem', fontWeight: 700 }}
          >
            <option value="all">جميع المسالك والشعب</option>
            <option value="pc_svt">علوم تجريبية (PC / SVT / Agri)</option>
            <option value="sm">علوم رياضية (A &amp; B)</option>
          </select>
        </div>

        {/* Sort Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowUpDown size={16} color="var(--text-muted)" />
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value)}
            className="input-control"
            style={{ height: '42px', padding: '0 0.85rem', fontSize: '0.85rem', fontWeight: 700 }}
          >
            <option value="year_desc">من الأحدث إلى الأقدم (2026 ← 2008)</option>
            <option value="year_asc">من الأقدم إلى الأحدث (2008 ← 2026)</option>
            <option value="session">حسب الدورة (العادية أولاً)</option>
            <option value="title">أبجدياً حسب العنوان</option>
          </select>
        </div>
      </div>

      {/* ── 4. EXAMS CARDS GRID ──────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem', width: '40px', height: '40px', border: '3px solid rgba(0,80,134,0.1)', borderTopColor: '#005086', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>جاري تحميل وفهرسة الامتحانات الوطنية...</p>
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
          <h3 style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', fontFamily: "'Cairo', sans-serif" }}>
            لم يتم العثور على أي امتحان وطني مطابق لخيارات البحث
          </h3>
          <p style={{ fontSize: '0.88rem', marginBottom: '1.25rem' }}>
            جرب إعادة ضبط الفلاتر أو إزالة شروط البحث للعثور على النتائج.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => { setSearchQuery(''); setSelectedYear('all'); setSelectedSession('all'); setSelectedBranch('all'); setSelectedDomain('all'); }}
          >
            إعادة ضبط جميع الفلاتر
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {filteredExams.map((exam, idx) => {
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
                        fontWeight: 800,
                        fontFamily: "'Cairo', sans-serif"
                      }}>
                        {exam.session}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {exam.code}
                    </span>
                  </div>

                  <h3 style={{
                    fontSize: '1.05rem',
                    fontWeight: 900,
                    color: 'var(--text-main)',
                    margin: '0 0 0.4rem 0',
                    lineHeight: 1.4,
                    fontFamily: "'Cairo', sans-serif"
                  }}>
                    {exam.title}
                  </h3>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                    {exam.branch}
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
                          {dObj.icon} {dObj.labelAr}
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
                    justifyContent: 'space-between',
                    fontFamily: "'Cairo', sans-serif"
                  }}>
                    <span>عدد التمارين والمسائل: <strong>{exam.sections.length}</strong></span>
                    <span style={{ color: '#005086', fontWeight: 900 }}>المجموع : 20 نقطة</span>
                  </div>
                </div>

                {/* Card Actions Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <button
                      type="button"
                      onClick={() => { setPreviewExam(exam); setPreviewTemplateMode('official'); }}
                      className="btn-outline"
                      style={{ padding: '0.45rem', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    >
                      <Eye size={14} /> <span>معاينة رسمية</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPreviewExam(exam); setPreviewTemplateMode('prime'); }}
                      className="btn-outline"
                      style={{ padding: '0.45rem', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: '#d97706', borderColor: '#f59e0b' }}
                    >
                      <Sparkles size={14} /> <span>DEVOIR PRIME</span>
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <button
                      type="button"
                      onClick={() => handlePrintSingleExam(exam, 'official', false)}
                      className="btn"
                      style={{ padding: '0.45rem', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    >
                      <Printer size={14} /> <span>طباعة الموضوع</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintSingleExam(exam, 'official', true)}
                      className="btn"
                      style={{ padding: '0.45rem', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', background: '#059669', borderColor: '#059669' }}
                    >
                      <BookOpen size={14} /> <span>مع التصحيح</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/lessons/${exam.id}`)}
                      style={{ background: 'none', border: 'none', color: '#005086', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}
                    >
                      <span>فتح في العارض التفاعلي</span>
                      <ExternalLink size={13} />
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/lessons/${exam.id}/edit`)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}
                      >
                        <Edit size={13} />
                        <span>تعديل</span>
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
            direction: 'rtl',
            fontFamily: "'Cairo', sans-serif"
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📘</span>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: '#005086' }}>
                    إعداد وطباعة كتاب الامتحانات الوطنية الشامل
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    غلاف ملكي مغربي فاخر + فهرس مبوب + مواضيع رسمية + تصحيح مفصل
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
                  🎯 نوع الكتاب والمجال المستهدف:
                </label>
                <select
                  value={bookDomain}
                  onChange={e => {
                    const dom = e.target.value;
                    setBookDomain(dom);
                    if (dom === 'all') {
                      setBookTitle('الموسوعة الشاملة في الرياضيات — الامتحانات الوطنية الموحدة');
                    } else {
                      const dObj = NATIONAL_EXAM_DOMAINS.find(d => d.id === dom);
                      setBookTitle(`مصنف الامتحانات الوطنية: ${dObj?.labelAr || ''} (${dObj?.labelFr || ''})`);
                    }
                  }}
                  className="input-control"
                  style={{ width: '100%', height: '42px', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  {NATIONAL_EXAM_DOMAINS.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.icon} {d.labelAr} {d.id !== 'all' ? `(${d.labelFr})` : '— (جميع الامتحانات كاملة)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Book Title */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                  عنوان الكتاب في الغلاف:
                </label>
                <input
                  type="text"
                  value={bookTitle}
                  onChange={e => setBookTitle(e.target.value)}
                  className="input-control"
                  style={{ width: '100%', height: '40px', fontSize: '0.88rem', fontWeight: 700 }}
                />
              </div>

              {/* Book Subtitle */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                  العنوان الفرعي:
                </label>
                <input
                  type="text"
                  value={bookSubtitle}
                  onChange={e => setBookSubtitle(e.target.value)}
                  className="input-control"
                  style={{ width: '100%', height: '40px', fontSize: '0.88rem' }}
                />
              </div>

              {/* Branch / Stream */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                  الشعبة / المسلك الدراسي:
                </label>
                <input
                  type="text"
                  value={bookBranch}
                  onChange={e => setBookBranch(e.target.value)}
                  className="input-control"
                  style={{ width: '100%', height: '40px', fontSize: '0.88rem' }}
                />
              </div>

              {/* Author & Academic Year Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                    اسم الأستاذ / المشرف:
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
                    الموسم الدراسي:
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={bookIncludeCover}
                      onChange={e => setBookIncludeCover(e.target.checked)}
                      style={{ width: '17px', height: '17px' }}
                    />
                    <span>تضمين صفحة الغلاف الملكي الفاخر (الشعار الرسمي + الإطار المزخرف + QR Code)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={bookIncludeIndex}
                      onChange={e => setBookIncludeIndex(e.target.checked)}
                      style={{ width: '17px', height: '17px' }}
                    />
                    <span>تضمين الفهرس الشامل المبوب (جدول الامتحانات والمجالات وأرقام الصفحات)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: '#059669' }}>
                    <input
                      type="checkbox"
                      checked={bookShowSolutions}
                      onChange={e => setBookShowSolutions(e.target.checked)}
                      style={{ width: '17px', height: '17px' }}
                    />
                    <span>تضمين الحلول النموذجية المفصلة وسلم التنقيط بعد كل تمرين ومسألة</span>
                  </label>
                </div>
              </div>

              {/* Scope Info Summary */}
              <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                📌 <strong>معلومة:</strong> سيتم تضمين <strong>{filteredExams.length}</strong> امتحان وطني مطابق لخيارات الفرز الحالية. إذا أردت تضمين سنوات محددة، قم بتحديدها في فلاتر الصفحة قبل الضغط على طباعة.
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleGenerateBook}
                  disabled={bookGenerating}
                  className="btn"
                  style={{ flex: 1, height: '46px', fontSize: '0.95rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Printer size={18} />
                  <span>{bookGenerating ? 'جاري تحضير الكتاب...' : 'طباعة وتصدير الكتاب الكامل (PDF)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="btn-outline"
                  style={{ height: '46px', padding: '0 1.25rem' }}
                >
                  إلغاء
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
            boxShadow: '0 25px 60px rgba(0,0,0,0.35)'
          }}>
            {/* Modal Preview Header */}
            <div style={{
              padding: '0.85rem 1.5rem',
              background: '#005086',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: "'Cairo', sans-serif"
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Award size={22} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>{previewExam.title}</h3>
                  <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{previewExam.session} • {previewExam.branch}</span>
                </div>
              </div>

              {/* Template Switcher & Print Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    القالب الوطني الرسمي
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
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    ⭐ DEVOIR PRIME
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handlePrintSingleExam(previewExam, previewTemplateMode, false)}
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
                  <Printer size={15} /> <span>طباعة PDF</span>
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
                  solutionMode={false}
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
