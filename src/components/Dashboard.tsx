import { useState, useMemo } from 'react';
import {
  LayoutDashboard, BookOpen, ClipboardList, CalendarCheck, CalendarDays,
  LogOut, RefreshCw, ChevronDown, Loader2, AlertCircle,
  GraduationCap, Award, TrendingUp, Search, TriangleAlert,
  User, Mail, Phone, Calendar, CreditCard, ShieldCheck, Copy, Check,
  FileText, CheckCircle2, Clock, XCircle, FileSpreadsheet, Receipt,
  Building2, Sparkles
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import GradeTable from './GradeTable';
import { processAcademicData } from '../lib/processData';
import type { Semester, CatMark, AttendanceEntry, Timetable, StudentProfile, AssignmentMark, AcademicFeeData } from '../lib/processData';
import type { AppSession } from '../App';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

type Tab = 'overview' | 'results' | 'catmarks' | 'assignments' | 'attendance' | 'timetable' | 'profile' | 'fees';

interface DashboardProps {
  session: AppSession;
  onLoadSemester: (semNum: number) => Promise<Semester | null>;
  onLoadCatMarks: () => Promise<CatMark[]>;
  onLoadAttendance: () => Promise<AttendanceEntry[]>;
  onLoadTimetable: () => Promise<Timetable | null>;
  onLoadProfile: () => Promise<StudentProfile | null>;
  onLoadAssignmentMarks: () => Promise<AssignmentMark[]>;
  onLoadFeeData: () => Promise<AcademicFeeData | null>;
  onLogout: () => void;
  loading: boolean;
}

const SEMESTER_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

const DAYS_ORDER = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
];

const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

const PERIOD_TIMES: Record<number, string> = {
  1: '08:00 - 08:50',
  2: '08:50 - 09:40',
  3: '09:50 - 10:40',
  4: '10:40 - 11:30',
  5: '12:10 - 01:00',
  6: '01:00 - 01:50',
  7: '02:00 - 02:50',
  8: '02:50 - 03:40',
};

const gradeColors: Record<string, string> = {
  S: 'rgba(163,230,53,0.85)', O: 'rgba(163,230,53,0.85)',
  'A+': 'rgba(74,222,128,0.85)', A: 'rgba(34,197,94,0.85)',
  'B+': 'rgba(96,165,250,0.85)', B: 'rgba(59,130,246,0.85)',
  C: 'rgba(251,191,36,0.85)', D: 'rgba(249,115,22,0.85)',
  E: 'rgba(244,63,94,0.85)', U: 'rgba(239,68,68,0.85)',
  RA: 'rgba(239,68,68,0.85)', F: 'rgba(239,68,68,0.85)',
};

export default function Dashboard({ session, onLoadSemester, onLoadCatMarks, onLoadAttendance, onLoadTimetable, onLoadProfile, onLoadAssignmentMarks, onLoadFeeData, onLogout, loading }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedSem, setSelectedSem] = useState<number>(1);
  const [semLoading, setSemLoading] = useState(false);
  const [semError, setSemError] = useState('');
  const [catLoading, setCatLoading] = useState(false);
  const [attLoading, setAttLoading] = useState(false);
  const [ttLoading, setTtLoading] = useState(false);
  const [profLoading, setProfLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [feeLoading, setFeeLoading] = useState(false);
  const [semSearch, setSemSearch] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [attSearch, setAttSearch] = useState('');
  const [ttSearch, setTtSearch] = useState('');
  const [profSearch, setProfSearch] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedProfCategory, setSelectedProfCategory] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [lateralOverride, setLateralOverride] = useState<boolean | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [payAmount, setPayAmount] = useState<string>('');
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const handleDownloadPDF = async (semNum: number) => {
    setPdfDownloading(true);
    try {
      const res = await fetch(`/ims/admin/grade/student/mark/report/download/${semNum}`, {
        credentials: 'same-origin'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `semester_${semNum}_results.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to download PDF: ${err.message}`);
    } finally {
      setPdfDownloading(false);
    }
  };

  const isLateral = lateralOverride !== null ? lateralOverride : !!session.studentInfo.isLateralEntry;
  const loadedSemesters = Object.values(session.semesters).sort((a, b) => a.semester - b.semester);

  const currentTodayKey = useMemo(() => {
    const dayIdx = new Date().getDay();
    const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return map[dayIdx] || 'monday';
  }, []);

  // Process loaded semesters for CGPA / charts
  const processed = useMemo(() => {
    const filtered = isLateral ? loadedSemesters.filter(s => s.semester >= 3) : loadedSemesters;
    return processAcademicData({
      studentInfo: { ...session.studentInfo, isLateralEntry: isLateral },
      semesters: filtered,
      catMarks: session.catMarks ?? undefined,
      attendance: session.attendance ?? undefined,
      timetable: session.timetable ?? undefined,
      profile: session.profile ?? undefined,
      assignmentMarks: session.assignmentMarks ?? undefined,
      feeData: session.feeData ?? undefined,
    });
  }, [session, isLateral, loadedSemesters]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLoadSemester = async () => {
    if (session.semesters[selectedSem]) { setSemError(''); return; }
    setSemLoading(true);
    setSemError('');
    const result = await onLoadSemester(selectedSem);
    if (!result) setSemError(`No marks found for Semester ${selectedSem}. Results may not be published yet.`);
    setSemLoading(false);
  };

  const handleLoadCat = async () => {
    if (session.catMarks !== null) return;
    setCatLoading(true);
    await onLoadCatMarks();
    setCatLoading(false);
  };

  const handleLoadAtt = async () => {
    if (session.attendance !== null) return;
    setAttLoading(true);
    await onLoadAttendance();
    setAttLoading(false);
  };

  const handleLoadTt = async () => {
    setTtLoading(true);
    await onLoadTimetable();
    setTtLoading(false);
  };

  const handleLoadProf = async () => {
    setProfLoading(true);
    await onLoadProfile();
    setProfLoading(false);
  };

  const handleLoadAssign = async () => {
    setAssignLoading(true);
    await onLoadAssignmentMarks();
    setAssignLoading(false);
  };

  const handleLoadFees = async () => {
    setFeeLoading(true);
    await onLoadFeeData();
    setFeeLoading(false);
  };

  const handleSimulatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amountStr = payAmount || (session.feeData?.totalPendingAmount ? String(session.feeData.totalPendingAmount) : '225625');
    setPaymentSuccessMsg(`Payment of ₹${Number(amountStr).toLocaleString('en-IN')} successfully processed! Receipt #RIT-FEE-${Math.floor(100000 + Math.random() * 900000)} generated.`);
    setTimeout(() => {
      setShowPaymentModal(false);
      setPaymentSuccessMsg('');
    }, 4000);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  // ── Displayed semester (for results tab) ──────────────────────────────────
  const displayedSemester = session.semesters[selectedSem] ?? null;

  const filteredSemSubjects = useMemo(() => {
    if (!displayedSemester) return [];
    return displayedSemester.subjects.filter(s =>
      s.code.toLowerCase().includes(semSearch.toLowerCase()) ||
      s.title.toLowerCase().includes(semSearch.toLowerCase())
    );
  }, [displayedSemester, semSearch]);

  const filteredCat = useMemo(() => {
    if (!session.catMarks) return [];
    return session.catMarks.filter(m =>
      m.code.toLowerCase().includes(catSearch.toLowerCase()) ||
      m.title.toLowerCase().includes(catSearch.toLowerCase()) ||
      m.faculty.toLowerCase().includes(catSearch.toLowerCase())
    );
  }, [session.catMarks, catSearch]);

  const filteredAtt = useMemo(() => {
    if (!session.attendance) return [];
    return session.attendance.filter(m =>
      m.code.toLowerCase().includes(attSearch.toLowerCase()) ||
      m.title.toLowerCase().includes(attSearch.toLowerCase()) ||
      m.faculty.toLowerCase().includes(attSearch.toLowerCase())
    );
  }, [session.attendance, attSearch]);

  const filteredAssignments = useMemo(() => {
    if (!session.assignmentMarks) return [];
    return session.assignmentMarks.filter(m =>
      m.code.toLowerCase().includes(assignSearch.toLowerCase()) ||
      m.title.toLowerCase().includes(assignSearch.toLowerCase()) ||
      m.faculty.toLowerCase().includes(assignSearch.toLowerCase())
    );
  }, [session.assignmentMarks, assignSearch]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const trendData = {
    labels: processed.semesters.map(s => `Sem ${s.semester}`),
    datasets: [{
      label: 'GPA', data: processed.semesters.map(s => s.gpa),
      borderColor: '#a3e635', backgroundColor: 'rgba(163,230,53,0.1)',
      tension: 0.35, fill: true,
      pointBackgroundColor: '#a3e635', pointRadius: 5, pointHoverRadius: 7, borderWidth: 2,
    }],
  };

  const trendOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(11,12,16,0.95)', titleColor: '#fff', bodyColor: '#a3e635',
        borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, cornerRadius: 8, displayColors: false,
        callbacks: { label: (ctx: any) => `GPA: ${ctx.parsed.y.toFixed(2)}` },
      },
    },
    scales: {
      y: { min: 0, max: 10, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
    },
  };

  const gradeLabels = Object.keys(processed.gradeDistribution).sort((a, b) => {
    const pts: Record<string, number> = { S: 10, O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, D: 4, E: 3, U: 0, RA: 0, F: 0 };
    return (pts[b] || 0) - (pts[a] || 0);
  });

  const distData = {
    labels: gradeLabels,
    datasets: [{
      data: gradeLabels.map(g => processed.gradeDistribution[g]),
      backgroundColor: gradeLabels.map(g => gradeColors[g] || 'rgba(148,163,184,0.8)'),
      borderRadius: 6, borderWidth: 0, barThickness: 14,
    }],
  };

  const distOptions = {
    responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(11,12,16,0.95)', titleColor: '#fff', bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, cornerRadius: 8, displayColors: false,
      },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', stepSize: 1 } },
      y: { grid: { display: false }, ticks: { color: '#f8fafc', font: { weight: 700 as const } } },
    },
  };

  // ── Nav Items ─────────────────────────────────────────────────────────────
  const navItems: { tab: Tab; label: string; icon: React.ReactNode }[] = [
    { tab: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { tab: 'results', label: 'Semester Results', icon: <BookOpen size={18} /> },
    { tab: 'catmarks', label: 'CAT Marks', icon: <ClipboardList size={18} /> },
    { tab: 'assignments', label: 'Assignment Marks', icon: <FileSpreadsheet size={18} /> },
    { tab: 'fees', label: 'Academic Fee', icon: <CreditCard size={18} /> },
    { tab: 'attendance', label: 'Attendance', icon: <CalendarCheck size={18} /> },
    { tab: 'timetable', label: 'Time Table', icon: <CalendarDays size={18} /> },
    { tab: 'profile', label: 'My Profile', icon: <User size={18} /> },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <GraduationCap size={22} className="brand-icon" />
          <span className="brand-text">IMS Portal</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ tab, label, icon }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`nav-item ${activeTab === tab ? 'nav-item-active' : ''}`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={() => setLateralOverride(!isLateral)} className="btn-ghost-sm">
            {isLateral ? 'Switch to Regular' : 'Switch to Lateral'}
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="main-area">

        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-identity">
            <h1 className="topbar-name">{session.studentInfo.name}</h1>
            <div className="topbar-meta">
              <span>{session.studentInfo.regNo}</span>
              <span className="dot-separator" />
              <span>{session.studentInfo.department}</span>
              {session.studentInfo.batch && (
                <>
                  <span className="dot-separator" />
                  <span>{session.studentInfo.batch}</span>
                </>
              )}
              <span className="dot-separator" />
              <span className="badge-lateral">{isLateral ? 'Lateral Entry' : 'Regular'}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <button onClick={onLogout} disabled={loading} className="btn-danger">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">

          {/* ══════════════ OVERVIEW TAB ══════════════ */}
          {activeTab === 'overview' && (
            <div className="tab-page">
              <div className="page-heading">
                <h2>Academic Overview</h2>
                <p className="page-subheading">
                  {loadedSemesters.length === 0
                    ? 'Load a semester from the Semester Results tab to see your analytics.'
                    : `Showing analytics for ${loadedSemesters.length} loaded semester${loadedSemesters.length > 1 ? 's' : ''}.`}
                </p>
              </div>

              {/* If we have dashboard stats, display them immediately */}
              {session.studentInfo.dashboardStats ? (
                <>
                  {/* Realtime KPI Cards */}
                  <div className="kpi-grid">
                    <div className="kpi-card glass-panel kpi-accent">
                      <div className="kpi-header">
                        <span className="kpi-title">Cumulative CGPA</span>
                        <GraduationCap size={18} className="kpi-icon accent-icon" />
                      </div>
                      <div className="kpi-value-row">
                        <span className="kpi-value kpi-accent-value">
                          {session.studentInfo.dashboardStats.cgpa}
                        </span>
                        <span className="kpi-unit">/ 10.0</span>
                      </div>
                    </div>

                    <div className="kpi-card glass-panel kpi-success">
                      <div className="kpi-header">
                        <span className="kpi-title">Current Attendance</span>
                        <CalendarCheck size={18} className="kpi-icon success-icon" />
                      </div>
                      <div className="kpi-value-row">
                        <span className="kpi-value kpi-success-value">
                          {session.studentInfo.dashboardStats.attendance}
                        </span>
                      </div>
                    </div>

                    <div className="kpi-card glass-panel kpi-warning">
                      <div className="kpi-header">
                        <span className="kpi-title">Pending Dues</span>
                        <CreditCard size={18} className="kpi-icon warning-icon" />
                      </div>
                      <div className="kpi-value-row">
                        <span className="kpi-value kpi-warning-value">
                          {session.studentInfo.dashboardStats.pendingFees !== 'N/A' && !session.studentInfo.dashboardStats.pendingFees.startsWith('₹') && !session.studentInfo.dashboardStats.pendingFees.startsWith('Rs') ? '₹' : ''}
                          {session.studentInfo.dashboardStats.pendingFees}
                        </span>
                      </div>
                    </div>

                    <div className="kpi-card glass-panel kpi-danger">
                      <div className="kpi-header">
                        <span className="kpi-title">Active Arrears</span>
                        <TriangleAlert size={18} className="kpi-icon danger-icon" />
                      </div>
                      <div className="kpi-value-row">
                        <span className={`kpi-value ${session.studentInfo.dashboardStats.arrears !== '0' && session.studentInfo.dashboardStats.arrears !== 'N/A' ? 'kpi-danger-value' : 'muted-value'}`}>
                          {session.studentInfo.dashboardStats.arrears}
                        </span>
                        <span className="kpi-unit">Arrears</span>
                      </div>
                    </div>
                  </div>

                  {loadedSemesters.length === 0 ? (
                    <div className="prompt-card" style={{ marginTop: '1rem' }}>
                      <TrendingUp size={30} className="prompt-icon" />
                      <h3>Detailed Analytics</h3>
                      <p>To view your GPA trend and course-wise grade distributions, please load your semesters.</p>
                      <button className="btn-primary-sm" onClick={() => setActiveTab('results')}>
                        Go to Semester Results
                      </button>
                    </div>
                  ) : (
                    /* Charts */
                    <div className="analytics-section">
                      <div className="analytics-card glass-panel">
                        <h3 className="analytics-title">GPA Trend</h3>
                        <div className="chart-container">
                          <Line data={trendData} options={trendOptions} />
                        </div>
                      </div>
                      <div className="analytics-card glass-panel">
                        <h3 className="analytics-title">Grade Distribution</h3>
                        <div className="chart-container">
                          {gradeLabels.length > 0
                            ? <Bar data={distData} options={distOptions} />
                            : <div className="chart-empty">No grade data yet.</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Fallback if stats are not loaded */
                loadedSemesters.length === 0 ? (
                  <div className="prompt-card">
                    <TrendingUp size={40} className="prompt-icon" />
                    <h3>No Data Loaded Yet</h3>
                    <p>Go to <strong>Semester Results</strong> and load a semester to start seeing your CGPA and analytics here.</p>
                    <button className="btn-primary-sm" onClick={() => setActiveTab('results')}>
                      Go to Semester Results
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Fallback KPI Cards */}
                    <div className="kpi-grid">
                      <div className="kpi-card glass-panel kpi-accent">
                        <div className="kpi-header">
                          <span className="kpi-title">Cumulative CGPA</span>
                          <GraduationCap size={18} className="kpi-icon accent-icon" />
                        </div>
                        <div className="kpi-value-row">
                          <span className="kpi-value kpi-accent-value">{processed.cgpa.toFixed(2)}</span>
                          <span className="kpi-unit">/ 10.0</span>
                        </div>
                      </div>
                      <div className="kpi-card glass-panel kpi-success">
                        <div className="kpi-header">
                          <span className="kpi-title">Earned Credits</span>
                          <Award size={18} className="kpi-icon success-icon" />
                        </div>
                        <div className="kpi-value-row">
                          <span className="kpi-value kpi-success-value">{processed.totalCredits}</span>
                          <span className="kpi-unit">Credits</span>
                        </div>
                      </div>
                      <div className="kpi-card glass-panel">
                        <div className="kpi-header">
                          <span className="kpi-title">Completed Courses</span>
                          <BookOpen size={18} className="kpi-icon muted-icon" />
                        </div>
                        <div className="kpi-value-row">
                          <span className="kpi-value">{processed.totalSubjects}</span>
                          <span className="kpi-unit">Subjects</span>
                        </div>
                      </div>
                    </div>

                    {/* Charts */}
                    <div className="analytics-section">
                      <div className="analytics-card glass-panel">
                        <h3 className="analytics-title">GPA Trend</h3>
                        <div className="chart-container">
                          <Line data={trendData} options={trendOptions} />
                        </div>
                      </div>
                      <div className="analytics-card glass-panel">
                        <h3 className="analytics-title">Grade Distribution</h3>
                        <div className="chart-container">
                          {gradeLabels.length > 0
                            ? <Bar data={distData} options={distOptions} />
                            : <div className="chart-empty">No grade data yet.</div>}
                        </div>
                      </div>
                    </div>
                  </>
                )
              )}
            </div>
          )}

          {/* ══════════════ SEMESTER RESULTS TAB ══════════════ */}
          {activeTab === 'results' && (
            <div className="tab-page">
              <div className="page-heading">
                <h2>Semester Results</h2>
                <p className="page-subheading">Select a semester and load its grade report on demand.</p>
              </div>

              {/* Semester selector row */}
              <div className="sem-selector-row glass-panel">
                <div className="sem-select-wrapper">
                  <label className="sem-select-label">Select Semester</label>
                  <div className="select-box">
                    <select
                      className="sem-select"
                      value={selectedSem}
                      onChange={e => { setSelectedSem(Number(e.target.value)); setSemError(''); }}
                    >
                      {SEMESTER_NUMBERS.map(n => (
                        <option key={n} value={n}>Semester {n}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                <button
                  className="btn-load"
                  onClick={handleLoadSemester}
                  disabled={semLoading}
                >
                  {semLoading
                    ? <><Loader2 size={15} className="animate-spin" /> Loading…</>
                    : session.semesters[selectedSem]
                      ? <><RefreshCw size={15} /> Reload</>
                      : <>Load Semester {selectedSem}</>}
                </button>

                {/* Loaded chips */}
                {loadedSemesters.length > 0 && (
                  <div className="loaded-chips">
                    {loadedSemesters.map(s => (
                      <button
                        key={s.semester}
                        onClick={() => { setSelectedSem(s.semester); setSemError(''); }}
                        className={`sem-chip ${selectedSem === s.semester ? 'sem-chip-active' : ''}`}
                      >
                        Sem {s.semester}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Error */}
              {semError && (
                <div className="inline-error">
                  <AlertCircle size={16} />
                  {semError}
                </div>
              )}

              {/* Results content */}
              {semLoading && (
                <div className="loading-card glass-panel">
                  <Loader2 size={32} className="animate-spin accent-icon" />
                  <p>Fetching Semester {selectedSem} grades from RIT IMS…</p>
                </div>
              )}

              {!semLoading && !displayedSemester && !semError && (
                <div className="prompt-card">
                  <BookOpen size={40} className="prompt-icon" />
                  <h3>No Semester Loaded</h3>
                  <p>Select a semester above and click <strong>Load Semester</strong> to fetch your grades.</p>
                </div>
              )}

              {!semLoading && displayedSemester && (
                <div className="results-panel glass-panel">
                  <div className="results-header">
                    <div>
                      <h3 className="results-title">Semester {displayedSemester.semester}</h3>
                      <p className="results-sub">{displayedSemester.subjects.length} courses</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span className="semester-gpa">GPA: {displayedSemester.gpa.toFixed(2)}</span>
                      <button
                        onClick={() => handleDownloadPDF(displayedSemester.semester)}
                        disabled={pdfDownloading}
                        className="btn-ghost-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {pdfDownloading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <FileText size={13} />
                        )}
                        Download PDF
                      </button>
                    </div>
                  </div>

                  <div className="search-row">
                    <div className="search-box">
                      <Search className="search-icon" size={15} />
                      <input
                        type="text"
                        placeholder="Search course code or title…"
                        value={semSearch}
                        onChange={e => setSemSearch(e.target.value)}
                        className="search-input"
                      />
                    </div>
                  </div>

                  <GradeTable subjects={filteredSemSubjects} />

                  {filteredSemSubjects.length === 0 && semSearch && (
                    <div className="empty-search">No courses match "{semSearch}".</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════ CAT MARKS TAB ══════════════ */}
          {activeTab === 'catmarks' && (
            <div className="tab-page">
              <div className="page-heading">
                <h2>CAT Marks (Internal Assessment)</h2>
                <p className="page-subheading">Continuous Assessment Test marks for the current semester.</p>
              </div>

              {session.catMarks === null && !catLoading && (
                <div className="prompt-card">
                  <ClipboardList size={40} className="prompt-icon" />
                  <h3>CAT Marks Not Loaded</h3>
                  <p>Click the button below to fetch your internal assessment marks directly from RIT IMS.</p>
                  <button className="btn-load" onClick={handleLoadCat}>
                    Fetch CAT Marks
                  </button>
                </div>
              )}

              {catLoading && (
                <div className="loading-card glass-panel">
                  <Loader2 size={32} className="animate-spin accent-icon" />
                  <p>Fetching CAT marks from RIT IMS…</p>
                </div>
              )}

              {session.catMarks !== null && !catLoading && (
                <div className="glass-panel cat-table-card">
                  <div className="search-row">
                    <div className="search-box">
                      <Search className="search-icon" size={15} />
                      <input
                        type="text"
                        placeholder="Search subject or faculty…"
                        value={catSearch}
                        onChange={e => setCatSearch(e.target.value)}
                        className="search-input"
                      />
                    </div>
                    <button className="btn-ghost-sm" onClick={() => { setCatLoading(true); onLoadCatMarks().then(() => setCatLoading(false)); }}>
                      <RefreshCw size={13} /> Refresh
                    </button>
                  </div>

                  {filteredCat.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="cat-table">
                        <thead>
                          <tr>
                            <th>Code</th><th>Subject Title</th><th>Faculty</th>
                            <th className="text-center">CO-1 (25)</th>
                            <th className="text-center">CO-2 (25)</th>
                            <th className="text-center">Total (50)</th>
                            <th className="text-center">Weightage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCat.map((m, i) => {
                            const co1n = parseFloat(m.co1), co2n = parseFloat(m.co2), totn = parseFloat(m.total);
                            const co1Low = !isNaN(co1n) && co1n < 12.5;
                            const co2Low = !isNaN(co2n) && co2n < 12.5;
                            const totLow = !isNaN(totn) && totn < 25;
                            return (
                              <tr key={`${m.code}-${i}`}>
                                <td className="code-cell">{m.code}</td>
                                <td>{m.title}</td>
                                <td className="muted-cell">{m.faculty}</td>
                                <td className={`text-center mark-cell ${co1Low ? 'mark-low' : ''}`}>{m.co1 || '—'}</td>
                                <td className={`text-center mark-cell ${co2Low ? 'mark-low' : ''}`}>{m.co2 || '—'}</td>
                                <td className={`text-center mark-cell ${totLow ? 'mark-low' : 'mark-ok'}`} style={{ fontWeight: 700 }}>{m.total || '—'}</td>
                                <td className="text-center muted-cell">{m.weightage || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <AlertCircle size={28} />
                      <p>{session.catMarks.length > 0 ? `No matches for "${catSearch}"` : 'No CAT marks are published in the portal yet.'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════ ASSIGNMENT MARKS TAB ══════════════ */}
          {activeTab === 'assignments' && (
            <div className="tab-page">
              <div className="page-heading">
                <h2>Assignment Marks</h2>
                <p className="page-subheading">Continuous assignment scores (Assignments 1 to 5) for the current semester.</p>
              </div>

              {session.assignmentMarks === null && !assignLoading && (
                <div className="prompt-card">
                  <FileSpreadsheet size={40} className="prompt-icon" />
                  <h3>Assignment Marks Not Loaded</h3>
                  <p>Click the button below to fetch your official assignment marks directly from RIT IMS.</p>
                  <button className="btn-load" onClick={handleLoadAssign}>
                    Fetch Assignment Marks
                  </button>
                </div>
              )}

              {assignLoading && (
                <div className="loading-card glass-panel">
                  <Loader2 size={32} className="animate-spin accent-icon" />
                  <p>Fetching assignment marks from RIT IMS…</p>
                </div>
              )}

              {session.assignmentMarks !== null && !assignLoading && (
                <div className="glass-panel cat-table-card">
                  <div className="search-row">
                    <div className="search-box">
                      <Search className="search-icon" size={15} />
                      <input
                        type="text"
                        placeholder="Search subject or faculty…"
                        value={assignSearch}
                        onChange={e => setAssignSearch(e.target.value)}
                        className="search-input"
                      />
                    </div>
                    <button className="btn-ghost-sm" onClick={handleLoadAssign}>
                      <RefreshCw size={13} /> Refresh
                    </button>
                  </div>

                  {filteredAssignments.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="cat-table">
                        <thead>
                          <tr>
                            <th>Subject Code</th>
                            <th>Subject Name</th>
                            <th>Faculty Name</th>
                            <th className="text-center">A1 <br/><span className="sub-th">(10 Marks)</span></th>
                            <th className="text-center">A2 <br/><span className="sub-th">(10 Marks)</span></th>
                            <th className="text-center">A3 <br/><span className="sub-th">(10 Marks)</span></th>
                            <th className="text-center">A4 <br/><span className="sub-th">(10 Marks)</span></th>
                            <th className="text-center">A5 <br/><span className="sub-th">(10 Marks)</span></th>
                            <th className="text-center">Total <br/><span className="sub-th">(50 Marks)</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAssignments.map((m, i) => {
                            const totalNum = parseFloat(m.total);
                            const isHigh = !isNaN(totalNum) && totalNum >= 40;
                            const isLow = !isNaN(totalNum) && totalNum < 25;

                            return (
                              <tr key={`${m.code}-${i}`}>
                                <td className="code-cell">{m.code || '—'}</td>
                                <td>{m.title || '—'}</td>
                                <td className="muted-cell">{m.faculty || '—'}</td>
                                <td className="text-center mark-cell">{m.a1 || '—'}</td>
                                <td className="text-center mark-cell">{m.a2 || '—'}</td>
                                <td className="text-center mark-cell">{m.a3 || '—'}</td>
                                <td className="text-center mark-cell">{m.a4 || '—'}</td>
                                <td className="text-center mark-cell">{m.a5 || '—'}</td>
                                <td className={`text-center mark-cell ${isHigh ? 'mark-ok' : isLow ? 'mark-low' : ''}`} style={{ fontWeight: 700 }}>
                                  {m.total || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <AlertCircle size={28} />
                      <p>{session.assignmentMarks.length > 0 ? `No matches for "${assignSearch}"` : 'No assignment marks are published in the portal yet.'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════ ACADEMIC FEE TAB ══════════════ */}
          {activeTab === 'fees' && (
            <div className="tab-page">
              <div className="page-heading">
                <h2>Academic Fee & Online Payment</h2>
                <p className="page-subheading">View official fee structure, paid date history, quota details, and pay online dues.</p>
              </div>

              {session.feeData === null && !feeLoading && (
                <div className="prompt-card">
                  <CreditCard size={40} className="prompt-icon" />
                  <h3>Academic Fee Details Not Loaded</h3>
                  <p>Click the button below to fetch your official fee breakdown and payment status from RIT IMS.</p>
                  <button className="btn-load" onClick={handleLoadFees}>
                    Fetch Academic Fee
                  </button>
                </div>
              )}

              {feeLoading && (
                <div className="loading-card glass-panel">
                  <Loader2 size={32} className="animate-spin accent-icon" />
                  <p>Fetching fee records from RIT IMS…</p>
                </div>
              )}

              {session.feeData !== null && !feeLoading && (
                <div className="fee-container">
                  {/* Top KPI Cards */}
                  <div className="stats-grid">
                    <div className="stat-card glass-panel">
                      <div className="stat-card-header">
                        <span className="stat-card-title">Total Annual Fee</span>
                        <Building2 className="stat-card-icon" size={18} />
                      </div>
                      <div className="stat-card-val text-accent">
                        ₹{session.feeData.totalFeeAmount.toLocaleString('en-IN')}
                      </div>
                      <span className="stat-card-sub font-mono">{session.feeData.courseShort}</span>
                    </div>

                    <div className="stat-card glass-panel">
                      <div className="stat-card-header">
                        <span className="stat-card-title">Total Paid Fee</span>
                        <CheckCircle2 className="stat-card-icon text-success" size={18} />
                      </div>
                      <div className="stat-card-val text-success">
                        ₹{session.feeData.totalPaidAmount.toLocaleString('en-IN')}
                      </div>
                      <span className="stat-card-sub">
                        {session.feeData.totalPendingAmount === 0 ? '✓ 100% Cleared' : 'Partial Payment'}
                      </span>
                    </div>

                    <div className="stat-card glass-panel">
                      <div className="stat-card-header">
                        <span className="stat-card-title">Pending Balance</span>
                        <Receipt className="stat-card-icon text-warning" size={18} />
                      </div>
                      <div className={`stat-card-val ${session.feeData.totalPendingAmount > 0 ? 'text-warning' : 'text-success'}`}>
                        ₹{session.feeData.totalPendingAmount.toLocaleString('en-IN')}
                      </div>
                      <span className="stat-card-sub">
                        {session.feeData.totalPendingAmount > 0 ? 'Due for Payment' : 'No Dues Pending'}
                      </span>
                    </div>

                    <div className="stat-card glass-panel">
                      <div className="stat-card-header">
                        <span className="stat-card-title">Admission Quota</span>
                        <GraduationCap className="stat-card-icon" size={18} />
                      </div>
                      <div className="stat-card-val" style={{ fontSize: '15px', marginTop: '6px' }}>
                        {session.feeData.admittedMode}
                      </div>
                      <span className="stat-card-sub">
                        {session.feeData.isHosteler ? 'Hosteller' : 'Day Scholar'}
                      </span>
                    </div>
                  </div>

                  {/* Profile / Quota Information Banner */}
                  <div className="profile-hero-card glass-panel" style={{ padding: '20px 24px', margin: '20px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                          {session.feeData.courseName}
                        </h3>
                        <div className="profile-badges" style={{ marginTop: '8px' }}>
                          <span className="profile-badge-pill profile-badge-reg">
                            Quota: {session.feeData.admittedMode}
                          </span>
                          <span className="profile-badge-pill profile-badge-dept">
                            {session.feeData.isHosteler ? 'Hostel Resident' : 'Day Scholar'}
                          </span>
                          {session.feeData.isFirstGraduate && (
                            <span className="profile-badge-pill profile-badge-blood">
                              First Graduate Benefit
                            </span>
                          )}
                          {session.feeData.isScholarship && (
                            <span className="profile-badge-pill profile-badge-blood">
                              Scholarship Active
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          className="btn-primary-glow"
                          onClick={() => setShowPaymentModal(true)}
                        >
                          <Sparkles size={15} /> Pay Fee / Download Receipt
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Fee Records Per Academic Year */}
                  {session.feeData.feeRecords.map((record, rIdx) => (
                    <div key={rIdx} className="glass-panel cat-table-card" style={{ marginBottom: '24px' }}>
                      <div className="search-row" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Receipt className="accent-icon" size={20} />
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                              Academic Year {record.academicYear}
                            </h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Paid Date: {record.paidDate}
                            </span>
                          </div>
                        </div>

                        <span className={`leave-status-badge ${record.isFullyPaid ? 'leave-approved' : 'leave-pending'}`}>
                          {record.isFullyPaid ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                          {record.isFullyPaid ? 'Paid in Full' : 'Dues Pending'}
                        </span>
                      </div>

                      <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                        <table className="cat-table">
                          <thead>
                            <tr>
                              <th>Fee Breakdown Item</th>
                              <th className="text-center">Amount (₹)</th>
                              <th className="text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Tuition Fee</td>
                              <td className="text-center font-mono font-weight-bold">₹{record.tuitionFee.toLocaleString('en-IN')}</td>
                              <td className="text-center muted-cell">Included</td>
                            </tr>
                            {record.otherFee > 0 && (
                              <tr>
                                <td>Special / Other Academic Fees</td>
                                <td className="text-center font-mono font-weight-bold">₹{record.otherFee.toLocaleString('en-IN')}</td>
                                <td className="text-center muted-cell">Included</td>
                              </tr>
                            )}
                            {record.auFee > 0 && (
                              <tr>
                                <td>Anna University (AU) Statutory Fee</td>
                                <td className="text-center font-mono font-weight-bold">₹{record.auFee.toLocaleString('en-IN')}</td>
                                <td className="text-center muted-cell">Included</td>
                              </tr>
                            )}
                            {record.hostelFee > 0 && (
                              <tr>
                                <td>Hostel & Amenities Fee</td>
                                <td className="text-center font-mono font-weight-bold">₹{record.hostelFee.toLocaleString('en-IN')}</td>
                                <td className="text-center muted-cell">Included</td>
                              </tr>
                            )}
                            {record.fine > 0 && (
                              <tr>
                                <td>Fine / Late Payment Fee</td>
                                <td className="text-center font-mono font-weight-bold">₹{record.fine.toLocaleString('en-IN')}</td>
                                <td className="text-center muted-cell">Fine</td>
                              </tr>
                            )}
                            {record.breakage > 0 && (
                              <tr>
                                <td>Lab Breakage Charges</td>
                                <td className="text-center font-mono font-weight-bold">₹{record.breakage.toLocaleString('en-IN')}</td>
                                <td className="text-center muted-cell">Breakage</td>
                              </tr>
                            )}

                            {/* Summary Totals Row */}
                            <tr style={{ background: 'rgba(255,255,255,0.04)', fontWeight: 700 }}>
                              <td>Total Annual Fee</td>
                              <td className="text-center font-mono text-accent">₹{record.totalFee.toLocaleString('en-IN')}</td>
                              <td className="text-center text-accent">Total Payable</td>
                            </tr>
                            <tr style={{ background: 'rgba(74,222,128,0.06)', fontWeight: 700 }}>
                              <td>Paid Amount</td>
                              <td className="text-center font-mono text-success">₹{record.paidFee.toLocaleString('en-IN')}</td>
                              <td className="text-center text-success">Verified Paid</td>
                            </tr>
                            <tr style={{ background: record.pendingFee > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)', fontWeight: 700 }}>
                              <td>Outstanding Balance</td>
                              <td className={`text-center font-mono ${record.pendingFee > 0 ? 'text-warning' : 'text-success'}`}>
                                ₹{record.pendingFee.toLocaleString('en-IN')}
                              </td>
                              <td className={`text-center ${record.pendingFee > 0 ? 'text-warning' : 'text-success'}`}>
                                {record.pendingFee > 0 ? 'Action Required' : 'Cleared'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ════════════ ONLINE PAYMENT MODAL ════════════ */}
              {showPaymentModal && (
                <div className="payment-modal-overlay">
                  <div className="payment-modal-card glass-panel">
                    <div className="modal-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CreditCard className="accent-icon" size={22} />
                        <h3 style={{ margin: 0, fontSize: '18px' }}>RIT IMS Fee Payment Gateway</h3>
                      </div>
                      <button className="btn-close" onClick={() => setShowPaymentModal(false)}>×</button>
                    </div>

                    {paymentSuccessMsg ? (
                      <div className="payment-success-box">
                        <CheckCircle2 size={48} className="text-success" />
                        <h3>Payment Successful!</h3>
                        <p>{paymentSuccessMsg}</p>
                      </div>
                    ) : (
                      <form onSubmit={handleSimulatePayment} className="payment-form">
                        <div className="form-group">
                          <label className="form-label">Student Name / Reg No</label>
                          <input
                            type="text"
                            readOnly
                            value={`${session.studentInfo.name || 'Student'} (${session.studentInfo.regNo || session.profile?.regNo || 'RIT Student'})`}
                            className="form-input"
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Payment Amount (₹)</label>
                          <input
                            type="number"
                            placeholder="Enter amount (e.g. 225625)"
                            value={payAmount || (session.feeData?.totalPendingAmount ? String(session.feeData.totalPendingAmount) : '225625')}
                            onChange={e => setPayAmount(e.target.value)}
                            className="form-input font-mono"
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Select Payment Method</label>
                          <div className="payment-mode-tabs">
                            <button
                              type="button"
                              className={`pay-mode-btn ${selectedPaymentMode === 'upi' ? 'pay-mode-active' : ''}`}
                              onClick={() => setSelectedPaymentMode('upi')}
                            >
                              UPI / QR
                            </button>
                            <button
                              type="button"
                              className={`pay-mode-btn ${selectedPaymentMode === 'card' ? 'pay-mode-active' : ''}`}
                              onClick={() => setSelectedPaymentMode('card')}
                            >
                              Credit / Debit Card
                            </button>
                            <button
                              type="button"
                              className={`pay-mode-btn ${selectedPaymentMode === 'netbanking' ? 'pay-mode-active' : ''}`}
                              onClick={() => setSelectedPaymentMode('netbanking')}
                            >
                              Net Banking
                            </button>
                          </div>
                        </div>

                        {selectedPaymentMode === 'upi' && (
                          <div className="upi-box">
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Scan QR code using GPay, PhonePe, or Paytm:</p>
                            <div className="qr-placeholder glass-panel">
                              <Sparkles size={36} className="accent-icon animate-pulse" />
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>UPI ID: ritims@bank</span>
                            </div>
                          </div>
                        )}

                        {selectedPaymentMode === 'card' && (
                          <div className="card-fields">
                            <input type="text" placeholder="Card Number (16 digits)" className="form-input" maxLength={19} required />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <input type="text" placeholder="MM/YY" className="form-input" maxLength={5} required />
                              <input type="password" placeholder="CVV" className="form-input" maxLength={4} required />
                            </div>
                          </div>
                        )}

                        {selectedPaymentMode === 'netbanking' && (
                          <div className="form-group">
                            <select className="form-input">
                              <option>Select Bank...</option>
                              <option>State Bank of India (SBI)</option>
                              <option>HDFC Bank</option>
                              <option>ICICI Bank</option>
                              <option>Axis Bank</option>
                              <option>Indian Bank</option>
                            </select>
                          </div>
                        )}

                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn-ghost-sm" onClick={() => setShowPaymentModal(false)}>
                            Cancel
                          </button>
                          <button type="submit" className="btn-primary-glow">
                            Confirm Payment
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ ATTENDANCE TAB ══════════════ */}
          {activeTab === 'attendance' && (
            <div className="tab-page">
              <div className="page-heading">
                <h2>Subject Attendance</h2>
                <p className="page-subheading">Your attendance percentage for each subject this semester.</p>
              </div>

              {session.attendance === null && !attLoading && (
                <div className="prompt-card">
                  <CalendarCheck size={40} className="prompt-icon" />
                  <h3>Attendance Not Loaded</h3>
                  <p>Click the button below to fetch your subject attendance report from RIT IMS.</p>
                  <button className="btn-load" onClick={handleLoadAtt}>
                    Fetch Attendance
                  </button>
                </div>
              )}

              {attLoading && (
                <div className="loading-card glass-panel">
                  <Loader2 size={32} className="animate-spin accent-icon" />
                  <p>Fetching attendance from RIT IMS…</p>
                </div>
              )}

              {session.attendance !== null && !attLoading && (
                <>
                  <div className="glass-panel cat-table-card">
                    <div className="search-row">
                      <div className="search-box">
                        <Search className="search-icon" size={15} />
                        <input
                          type="text"
                          placeholder="Search subject or faculty…"
                          value={attSearch}
                          onChange={e => setAttSearch(e.target.value)}
                          className="search-input"
                        />
                      </div>
                      <button className="btn-ghost-sm" onClick={() => { setAttLoading(true); onLoadAttendance().then(() => setAttLoading(false)); }}>
                        <RefreshCw size={13} /> Refresh
                      </button>
                    </div>

                    {filteredAtt.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="cat-table">
                          <thead>
                            <tr>
                              <th>Code</th><th>Subject Title</th><th>Faculty</th>
                              <th className="text-center">Attended</th>
                              <th className="text-center">Total</th>
                              <th className="text-center">Percentage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAtt.map((a, i) => (
                              <tr key={`${a.code}-${i}`}>
                                <td className="code-cell">{a.code}</td>
                                <td>{a.title}</td>
                                <td className="muted-cell">{a.faculty}</td>
                                <td className="text-center" style={{ fontWeight: 600 }}>{a.attended}</td>
                                <td className="text-center" style={{ fontWeight: 600 }}>{a.total}</td>
                                <td className="text-center">
                                  <span className={a.percentage < 75 ? 'attendance-badge-low' : 'attendance-badge-good'}>
                                    {a.percentage}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-state">
                        <AlertCircle size={28} />
                        <p>{session.attendance.length > 0 ? `No matches for "${attSearch}"` : 'No attendance records found in the portal.'}</p>
                      </div>
                    )}
                  </div>

                  <div className="att-warning">
                    <TriangleAlert size={15} />
                    <span>Subjects with <strong>&lt; 75%</strong> attendance may make you ineligible to write the end-semester exam.</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════ TIMETABLE TAB ══════════════ */}
          {activeTab === 'timetable' && (
            <div className="tab-page">
              <div className="page-heading">
                <div className="page-heading-row">
                  <div>
                    <h2>Class Time Table</h2>
                    <p className="page-subheading">
                      {session.timetable?.className
                        ? `Weekly class schedule for ${session.timetable.className}`
                        : 'View your weekly class schedule and period timetable.'}
                    </p>
                  </div>
                  {session.timetable?.className && (
                    <div className="class-badge-pill">
                      <span className="class-badge-label">Class</span>
                      <span className="class-badge-val">{session.timetable.className}</span>
                    </div>
                  )}
                </div>
              </div>

              {session.timetable === null && !ttLoading && (
                <div className="prompt-card">
                  <CalendarDays size={40} className="prompt-icon" />
                  <h3>Time Table Not Loaded</h3>
                  <p>Click the button below to fetch your official class time table from RIT IMS.</p>
                  <button className="btn-load" onClick={handleLoadTt}>
                    Fetch Time Table
                  </button>
                </div>
              )}

              {ttLoading && (
                <div className="loading-card glass-panel">
                  <Loader2 size={32} className="animate-spin accent-icon" />
                  <p>Fetching time table from RIT IMS…</p>
                </div>
              )}

              {session.timetable !== null && !ttLoading && (
                <div className="timetable-container glass-panel">
                  {/* Controls row */}
                  <div className="tt-controls-row">
                    <div className="tt-day-tabs">
                      <button
                        onClick={() => setSelectedDay('all')}
                        className={`tt-day-chip ${selectedDay === 'all' ? 'tt-day-chip-active' : ''}`}
                      >
                        All Days
                      </button>
                      {DAYS_ORDER.map(({ key, short, label }) => {
                        const isToday = currentTodayKey === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedDay(key)}
                            className={`tt-day-chip ${selectedDay === key ? 'tt-day-chip-active' : ''} ${isToday ? 'tt-day-chip-today' : ''}`}
                            title={label}
                          >
                            {short}
                            {isToday && <span className="today-dot" title="Today" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="tt-actions">
                      <div className="search-box">
                        <Search className="search-icon" size={15} />
                        <input
                          type="text"
                          placeholder="Search subject or faculty…"
                          value={ttSearch}
                          onChange={e => setTtSearch(e.target.value)}
                          className="search-input"
                        />
                      </div>
                      <button className="btn-ghost-sm" onClick={handleLoadTt}>
                        <RefreshCw size={13} /> Refresh
                      </button>
                    </div>
                  </div>

                  {/* Timetable Grid View */}
                  <div className="tt-grid-wrapper">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th className="tt-period-col">Period</th>
                          {(selectedDay === 'all' ? DAYS_ORDER : DAYS_ORDER.filter(d => d.key === selectedDay)).map(d => (
                            <th key={d.key} className={currentTodayKey === d.key ? 'tt-th-today' : ''}>
                              <div className="tt-th-title">{d.label}</div>
                              {currentTodayKey === d.key && <span className="tt-today-badge">TODAY</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PERIOD_NUMBERS.map(periodNum => {
                          const dayKeys = selectedDay === 'all' ? DAYS_ORDER.map(d => d.key) : [selectedDay];
                          return (
                            <tr key={periodNum}>
                              <td className="tt-period-cell">
                                <div className="tt-period-num">Period {periodNum}</div>
                                <div className="tt-period-time">{PERIOD_TIMES[periodNum] || ''}</div>
                              </td>

                              {dayKeys.map(dayKey => {
                                const slots = session.timetable?.schedule[dayKey]?.[periodNum] || [];
                                const matchingSlots = slots.filter(s =>
                                  !ttSearch ||
                                  s.subjectName.toLowerCase().includes(ttSearch.toLowerCase()) ||
                                  s.subjectCode.toLowerCase().includes(ttSearch.toLowerCase()) ||
                                  s.staffName.toLowerCase().includes(ttSearch.toLowerCase())
                                );
                                const isTodayCell = currentTodayKey === dayKey;

                                return (
                                  <td key={dayKey} className={`tt-slot-cell ${isTodayCell ? 'tt-slot-today' : ''}`}>
                                    {matchingSlots.length > 0 ? (
                                      <div className="tt-slot-entries">
                                        {matchingSlots.map((entry, idx) => (
                                          <div key={idx} className="tt-entry-card">
                                            <div className="tt-entry-subject">
                                              <span className="tt-subject-name">{entry.subjectName}</span>
                                              {entry.subjectCode && (
                                                <span className="tt-subject-code">{entry.subjectCode}</span>
                                              )}
                                            </div>
                                            <div className="tt-entry-staff">
                                              <span className="tt-staff-name">{entry.staffName}</span>
                                              {entry.staffCode && (
                                                <span className="tt-staff-code">({entry.staffCode})</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="tt-empty-slot">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ PROFILE TAB ══════════════ */}
          {activeTab === 'profile' && (
            <div className="tab-page">
              <div className="page-heading">
                <div className="page-heading-row">
                  <div>
                    <h2>Student Profile</h2>
                    <p className="page-subheading">Complete student information and official records from RIT IMS.</p>
                  </div>
                  {session.profile && (
                    <button className="btn-ghost-sm" onClick={handleLoadProf}>
                      <RefreshCw size={13} /> Refresh Profile
                    </button>
                  )}
                </div>
              </div>

              {session.profile === null && !profLoading && (
                <div className="prompt-card">
                  <User size={40} className="prompt-icon" />
                  <h3>Student Profile Not Loaded</h3>
                  <p>Click the button below to fetch your complete student profile details from RIT IMS.</p>
                  <button className="btn-load" onClick={handleLoadProf}>
                    Fetch Profile Details
                  </button>
                </div>
              )}

              {profLoading && (
                <div className="loading-card glass-panel">
                  <Loader2 size={32} className="animate-spin accent-icon" />
                  <p>Fetching full student profile from RIT IMS…</p>
                </div>
              )}

              {session.profile !== null && !profLoading && (
                <div className="profile-wrapper">
                  {/* Hero Header Card */}
                  <div className="profile-hero-card glass-panel">
                    <div className="profile-hero-main">
                      <div className="profile-avatar-container">
                        {session.profile.avatarUrl ? (
                          <img src={session.profile.avatarUrl} alt={session.profile.name} className="profile-avatar-img" />
                        ) : (
                          <div className="profile-avatar-placeholder">
                            {session.profile.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="profile-identity">
                        <h1 className="profile-name">{session.profile.name}</h1>
                        <div className="profile-badges">
                          {session.profile.regNo && (
                            <span className="profile-badge-pill profile-badge-reg">
                              <CreditCard size={12} /> {session.profile.regNo}
                            </span>
                          )}
                          {session.profile.department && (
                            <span className="profile-badge-pill profile-badge-dept">
                              <GraduationCap size={12} /> {session.profile.department}
                            </span>
                          )}
                          {session.profile.bloodGroup && (
                            <span className="profile-badge-pill profile-badge-blood">
                              Blood: {session.profile.bloodGroup}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Info bar */}
                    <div className="profile-quick-stats">
                      {session.profile.email && (
                        <div className="profile-stat-item">
                          <Mail size={15} className="stat-icon" />
                          <div>
                            <span className="stat-label">Email</span>
                            <span className="stat-val">{session.profile.email}</span>
                          </div>
                        </div>
                      )}

                      {session.profile.mobile && (
                        <div className="profile-stat-item">
                          <Phone size={15} className="stat-icon" />
                          <div>
                            <span className="stat-label">Mobile</span>
                            <span className="stat-val">{session.profile.mobile}</span>
                          </div>
                        </div>
                      )}

                      {session.profile.dob && (
                        <div className="profile-stat-item">
                          <Calendar size={15} className="stat-icon" />
                          <div>
                            <span className="stat-label">Date of Birth</span>
                            <span className="stat-val">{session.profile.dob}</span>
                          </div>
                        </div>
                      )}

                      {session.profile.gender && (
                        <div className="profile-stat-item">
                          <ShieldCheck size={15} className="stat-icon" />
                          <div>
                            <span className="stat-label">Gender</span>
                            <span className="stat-val">{session.profile.gender}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category Filter Chips & Search Bar */}
                  <div className="profile-controls-row">
                    <div className="profile-cat-tabs">
                      <button
                        onClick={() => setSelectedProfCategory('all')}
                        className={`tt-day-chip ${selectedProfCategory === 'all' ? 'tt-day-chip-active' : ''}`}
                      >
                        All Sections
                      </button>
                      <button
                        onClick={() => setSelectedProfCategory('personal')}
                        className={`tt-day-chip ${selectedProfCategory === 'personal' ? 'tt-day-chip-active' : ''}`}
                      >
                        Personal
                      </button>
                      <button
                        onClick={() => setSelectedProfCategory('academic')}
                        className={`tt-day-chip ${selectedProfCategory === 'academic' ? 'tt-day-chip-active' : ''}`}
                      >
                        Academic
                      </button>
                      <button
                        onClick={() => setSelectedProfCategory('parent')}
                        className={`tt-day-chip ${selectedProfCategory === 'parent' ? 'tt-day-chip-active' : ''}`}
                      >
                        Parent & Family
                      </button>
                      <button
                        onClick={() => setSelectedProfCategory('address')}
                        className={`tt-day-chip ${selectedProfCategory === 'address' ? 'tt-day-chip-active' : ''}`}
                      >
                        Address & Contact
                      </button>
                      <button
                        onClick={() => setSelectedProfCategory('leaves')}
                        className={`tt-day-chip ${selectedProfCategory === 'leaves' ? 'tt-day-chip-active' : ''}`}
                      >
                        <FileText size={13} /> Leave & OD
                      </button>
                    </div>

                    <div className="search-box">
                      <Search className="search-icon" size={15} />
                      <input
                        type="text"
                        placeholder="Search any attribute (e.g. Aadhar, Father, Address, Leave)..."
                        value={profSearch}
                        onChange={e => setProfSearch(e.target.value)}
                        className="search-input"
                      />
                    </div>
                  </div>

                  {/* Profile Sections Grid */}
                  <div className="profile-sections-grid">
                    {session.profile.sections.map((section, sIdx) => {
                      // Filter by selected category tab
                      const titleLower = section.title.toLowerCase();
                      if (selectedProfCategory === 'personal' && !titleLower.includes('personal')) return null;
                      if (selectedProfCategory === 'academic' && !titleLower.includes('academic') && !titleLower.includes('program')) return null;
                      if (selectedProfCategory === 'parent' && !titleLower.includes('parent') && !titleLower.includes('guardian')) return null;
                      if (selectedProfCategory === 'address' && !titleLower.includes('address') && !titleLower.includes('contact')) return null;
                      if (selectedProfCategory === 'leaves') return null; // shown separately below

                      const matchingFields = section.fields.filter(f =>
                        !profSearch ||
                        f.label.toLowerCase().includes(profSearch.toLowerCase()) ||
                        f.value.toLowerCase().includes(profSearch.toLowerCase())
                      );

                      if (matchingFields.length === 0) return null;

                      return (
                        <div key={sIdx} className="profile-card glass-panel">
                          <div className="profile-card-header">
                            <h3>{section.title}</h3>
                            <span className="profile-field-count">{matchingFields.length} attributes</span>
                          </div>
                          <div className="profile-fields-grid">
                            {matchingFields.map((field, fIdx) => (
                              <div key={fIdx} className="profile-field-box">
                                <div className="profile-field-header">
                                  <span className="profile-field-label">{field.label}</span>
                                  <button
                                    className="btn-copy-icon"
                                    onClick={() => handleCopy(field.value, `${sIdx}-${fIdx}`)}
                                    title="Copy value"
                                  >
                                    {copiedLabel === `${sIdx}-${fIdx}` ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                                  </button>
                                </div>
                                <div className="profile-field-val">{field.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ════════════ DEDICATED LEAVE & OD SECTION ════════════ */}
                  {(selectedProfCategory === 'all' || selectedProfCategory === 'leaves') && (
                    <div className="leave-section-container glass-panel">
                      <div className="profile-card-header">
                        <div className="leave-header-title">
                          <FileText size={20} className="accent-icon" />
                          <div>
                            <h3>Leave & OD History</h3>
                            <p className="leave-subtext">Official leave applications, On Duty (OD) permissions, and request history.</p>
                          </div>
                        </div>
                        {session.profile.leaves && session.profile.leaves.length > 0 && (
                          <div className="leave-summary-badges">
                            <span className="leave-kpi-pill leave-kpi-total">
                              {session.profile.leaves.length} Total Requests
                            </span>
                            <span className="leave-kpi-pill leave-kpi-approved">
                              {session.profile.leaves.filter(l => l.status.toLowerCase() === 'approved').length} Approved
                            </span>
                          </div>
                        )}
                      </div>

                      {session.profile.leaves && session.profile.leaves.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="cat-table leave-table">
                            <thead>
                              <tr>
                                <th>Leave Type</th>
                                <th>Duration</th>
                                <th className="text-center">Days</th>
                                <th>Reason / Purpose</th>
                                <th className="text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {session.profile.leaves
                                .filter(l =>
                                  !profSearch ||
                                  l.type.toLowerCase().includes(profSearch.toLowerCase()) ||
                                  l.reason.toLowerCase().includes(profSearch.toLowerCase()) ||
                                  l.status.toLowerCase().includes(profSearch.toLowerCase())
                                )
                                .map((leave, idx) => {
                                  const isApproved = leave.status.toLowerCase() === 'approved';
                                  const isPending = leave.status.toLowerCase() === 'pending';

                                  return (
                                    <tr key={idx}>
                                      <td>
                                        <span className="leave-type-tag">
                                          {leave.type}
                                        </span>
                                      </td>
                                      <td>
                                        <div className="leave-dates">
                                          <span>{leave.fromDate || '—'}</span>
                                          <span className="leave-arrow">→</span>
                                          <span>{leave.toDate || '—'}</span>
                                        </div>
                                      </td>
                                      <td className="text-center font-weight-bold">
                                        {leave.noOfDays}
                                      </td>
                                      <td className="muted-cell">
                                        {leave.reason || 'Not specified'}
                                      </td>
                                      <td className="text-center">
                                        <span className={`leave-status-badge ${isApproved ? 'leave-approved' : isPending ? 'leave-pending' : 'leave-rejected'}`}>
                                          {isApproved ? <CheckCircle2 size={13} /> : isPending ? <Clock size={13} /> : <XCircle size={13} />}
                                          {leave.status}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="empty-state" style={{ padding: '28px 20px' }}>
                          <AlertCircle size={28} />
                          <p>No Leave / OD records currently registered in your profile.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Bottom nav (mobile) ───────────────────────────────────────────── */}
      <nav className="bottom-nav">
        {navItems.map(({ tab, label, icon }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`bottom-nav-item ${activeTab === tab ? 'bottom-nav-item-active' : ''}`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
