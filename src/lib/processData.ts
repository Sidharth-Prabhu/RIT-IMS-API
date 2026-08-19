export interface Subject {
  code: string;
  title: string;
  credits: number;
  grade: string;
  gradePoints: number;
}

export interface Semester {
  semester: number;
  gpa: number;
  subjects: Subject[];
}

export interface StudentInfo {
  name: string;
  regNo: string;
  department: string;
  college: string;
  isLateralEntry: boolean;
}

export interface CatMark {
  code: string;
  title: string;
  faculty: string;
  co1: string;
  co2: string;
  total: string;
  weightage: string;
}

export interface AttendanceEntry {
  code: string;
  title: string;
  faculty: string;
  attended: number;
  total: number;
  percentage: number;
}

export interface LeaveEntry {
  type: string;
  fromDate: string;
  toDate: string;
  noOfDays: string;
  reason: string;
  status: string;
  appliedDate?: string;
}

export interface ProfileField {
  label: string;
  value: string;
}

export interface ProfileSection {
  title: string;
  fields: ProfileField[];
}

export interface StudentProfile {
  name: string;
  regNo: string;
  email: string;
  mobile: string;
  avatarUrl?: string;
  dob?: string;
  age?: string;
  gender?: string;
  bloodGroup?: string;
  community?: string;
  religion?: string;
  motherTongue?: string;
  caste?: string;
  aadharNo?: string;
  state?: string;
  country?: string;
  department?: string;
  classSection?: string;
  batch?: string;
  admissionType?: string;
  academicYear?: string;
  fatherName?: string;
  fatherMobile?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherMobile?: string;
  guardianName?: string;
  address?: string;
  permanentAddress?: string;
  leaves?: LeaveEntry[];
  sections: ProfileSection[];
  rawFields: Record<string, string>;
}

export interface AssignmentMark {
  code: string;
  title: string;
  faculty: string;
  a1: string;
  a2: string;
  a3: string;
  a4: string;
  a5: string;
  total: string;
}

export interface FeeYearItem {
  academicYear: string;
  paidDate: string;
  tuitionFee: number;
  hostelFee: number;
  otherFee: number;
  fine: number;
  breakage: number;
  auFee: number;
  openingBalance: number;
  reversalAmt: number;
  totalFee: number;
  paidFee: number;
  pendingFee: number;
  isFullyPaid: boolean;
}

export interface AcademicFeeData {
  admittedMode: string;
  isFirstGraduate: boolean;
  isScholarship: boolean;
  isHosteler: boolean;
  courseName: string;
  courseShort: string;
  feeRecords: FeeYearItem[];
  totalFeeAmount: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
}

export interface AcademicData {
  studentInfo: StudentInfo;
  semesters: Semester[];
  catMarks?: CatMark[];
  attendance?: AttendanceEntry[];
  timetable?: Timetable;
  profile?: StudentProfile;
  assignmentMarks?: AssignmentMark[];
  feeData?: AcademicFeeData;
}

export interface GradeDistribution {
  [grade: string]: number;
}

export interface TimetableEntry {
  subjectName: string;
  subjectCode: string;
  staffName: string;
  staffCode: string;
  id?: string;
  subjectId?: string;
  userNameId?: string;
}

// period number → list of entries (multiple when batches share the same slot)
export type PeriodSlot = Record<number, TimetableEntry[]>;

export interface Timetable {
  className: string;
  studentId?: string;
  schedule: {
    monday:    PeriodSlot;
    tuesday:   PeriodSlot;
    wednesday: PeriodSlot;
    thursday:  PeriodSlot;
    friday:    PeriodSlot;
    saturday:  PeriodSlot;
    [day: string]: PeriodSlot;
  };
}

export interface ProcessedAcademicData {
  studentInfo: StudentInfo;
  semesters: Semester[];
  cgpa: number;
  totalCredits: number;
  totalSubjects: number;
  gradeDistribution: GradeDistribution;
  catMarks?: CatMark[];
  attendance?: AttendanceEntry[];
  timetable?: Timetable;
  profile?: StudentProfile;
  assignmentMarks?: AssignmentMark[];
  feeData?: AcademicFeeData;
}

export function processAcademicData(raw: AcademicData): ProcessedAcademicData {
  const isLateral = raw.studentInfo?.isLateralEntry;
  let semesters = raw.semesters || [];

  if (isLateral) {
    semesters = semesters.filter((s) => s.semester >= 3);
  }

  let totalQualityPoints = 0;
  let totalCredits = 0;
  let totalSubjects = 0;
  const gradeDistribution: GradeDistribution = {};

  const processedSemesters = semesters.map((sem) => {
    let semQP = 0;
    let semCredits = 0;

    const subjects = (sem.subjects || []).map((sub) => {
      const gp = Number(sub.gradePoints) || 0;
      const cr = Number(sub.credits) || 0;
      semQP += gp * cr;
      semCredits += cr;
      totalSubjects += 1;

      // Track grade distribution (normalize to upper case)
      const gradeLabel = (sub.grade || 'U').toUpperCase().trim();
      gradeDistribution[gradeLabel] = (gradeDistribution[gradeLabel] || 0) + 1;

      return {
        ...sub,
        gradePoints: gp,
        credits: cr,
      };
    });

    totalQualityPoints += semQP;
    totalCredits += semCredits;

    return {
      ...sem,
      subjects,
      gpa: semCredits > 0 ? Number((semQP / semCredits).toFixed(2)) : 0,
    };
  });

  return {
    studentInfo: raw.studentInfo,
    semesters: processedSemesters,
    cgpa: totalCredits > 0 ? Number((totalQualityPoints / totalCredits).toFixed(2)) : 0,
    totalCredits,
    totalSubjects,
    gradeDistribution,
    catMarks: raw.catMarks,
    attendance: raw.attendance,
    timetable: raw.timetable,
    profile: raw.profile,
    assignmentMarks: raw.assignmentMarks,
    feeData: raw.feeData,
  };
}
