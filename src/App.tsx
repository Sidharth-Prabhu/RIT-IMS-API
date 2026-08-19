import { useState } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { loginIms, logoutIms, fetchSemesterGrades, fetchCatMarks, fetchAttendance, fetchTimetable, fetchStudentProfile, fetchAssignmentMarks, fetchAcademicFee, fetchExamFeeData } from './lib/imsScraper';
import type { StudentInfo, Semester, CatMark, AttendanceEntry, Timetable, StudentProfile, AssignmentMark, AcademicFeeData, ExamFeeData } from './lib/processData';

export interface AppSession {
  studentInfo: StudentInfo;
  csrfToken: string;
  semesters: Record<number, Semester>;
  catMarks: CatMark[] | null;
  attendance: AttendanceEntry[] | null;
  timetable: Timetable | null;
  profile: StudentProfile | null;
  assignmentMarks: AssignmentMark[] | null;
  feeData: AcademicFeeData | null;
  examFeeData: ExamFeeData | null;
}

export default function App() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (username: string, password: string) => {
    setLoading(true);
    setError('');
    try {
      const { studentInfo, csrfToken } = await loginIms(username, password);
      setSession({
        studentInfo,
        csrfToken,
        semesters: {},
        catMarks: null,
        attendance: null,
        timetable: null,
        profile: null,
        assignmentMarks: null,
        feeData: null,
        examFeeData: null,
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSemester = async (semNum: number): Promise<Semester | null> => {
    if (!session) return null;
    if (session.semesters[semNum]) return session.semesters[semNum];
    const sem = await fetchSemesterGrades(session.csrfToken, semNum);
    if (sem) {
      setSession(prev => prev ? { ...prev, semesters: { ...prev.semesters, [semNum]: sem } } : prev);
    }
    return sem;
  };

  const handleLoadCatMarks = async (): Promise<CatMark[]> => {
    if (!session) return [];
    if (session.catMarks !== null) return session.catMarks;
    const marks = await fetchCatMarks(session.csrfToken);
    setSession(prev => prev ? { ...prev, catMarks: marks } : prev);
    return marks;
  };

  const handleLoadAttendance = async (): Promise<AttendanceEntry[]> => {
    if (!session) return [];
    if (session.attendance !== null) return session.attendance;
    const att = await fetchAttendance(session.csrfToken);
    setSession(prev => prev ? { ...prev, attendance: att } : prev);
    return att;
  };

  const handleLoadTimetable = async (): Promise<Timetable | null> => {
    if (!session) return null;
    if (session.timetable !== null) return session.timetable;
    const tt = await fetchTimetable(session.csrfToken);
    setSession(prev => prev ? { ...prev, timetable: tt } : prev);
    return tt;
  };

  const handleLoadProfile = async (): Promise<StudentProfile | null> => {
    if (!session) return null;
    if (session.profile !== null) return session.profile;
    const prof = await fetchStudentProfile(session.csrfToken);
    if (prof) {
      setSession(prev => prev ? { ...prev, profile: prof } : prev);
    }
    return prof;
  };

  const handleLoadAssignmentMarks = async (): Promise<AssignmentMark[]> => {
    if (!session) return [];
    if (session.assignmentMarks !== null) return session.assignmentMarks;
    const assignMarks = await fetchAssignmentMarks(session.csrfToken);
    setSession(prev => prev ? { ...prev, assignmentMarks: assignMarks } : prev);
    return assignMarks;
  };

  const handleLoadFeeData = async (): Promise<AcademicFeeData | null> => {
    if (!session) return null;
    if (session.feeData !== null) return session.feeData;
    const fees = await fetchAcademicFee(session.csrfToken);
    if (fees) {
      setSession(prev => prev ? { ...prev, feeData: fees } : prev);
    }
    return fees;
  };

  const handleLoadExamFeeData = async (): Promise<ExamFeeData | null> => {
    if (!session) return null;
    if (session.examFeeData !== null) return session.examFeeData;
    const examFees = await fetchExamFeeData(session.csrfToken);
    if (examFees) {
      setSession(prev => prev ? { ...prev, examFeeData: examFees } : prev);
    }
    return examFees;
  };

  const handleLogout = async () => {
    setLoading(true);
    await logoutIms();
    setSession(null);
    setLoading(false);
  };

  if (session) {
    return (
      <Dashboard
        session={session}
        onLoadSemester={handleLoadSemester}
        onLoadCatMarks={handleLoadCatMarks}
        onLoadAttendance={handleLoadAttendance}
        onLoadTimetable={handleLoadTimetable}
        onLoadProfile={handleLoadProfile}
        onLoadAssignmentMarks={handleLoadAssignmentMarks}
        onLoadFeeData={handleLoadFeeData}
        onLoadExamFeeData={handleLoadExamFeeData}
        onLogout={handleLogout}
        loading={loading}
      />
    );
  }

  return <LoginForm onSubmit={handleLogin} loading={loading} error={error} />;
}
