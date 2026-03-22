/**
 * types/api.ts — LOCKED per Frontend Freeze §3.2
 * All interfaces match OpenAPI v4.0.0 exactly.
 * timestamp is INSIDE error.{} per OpenAPI ErrorResponse schema.
 * Never define API shapes in component files — always import from here.
 *
 * v3.5 changes (CR-12, CR-13):
 * - Student gains admissionNumber, dob, loginId
 * - CreateStudentRequest gains admissionNumber, dob (replaces manual user creation)
 * - New: UpdateStudentRequest/Response
 * - CreateUserRequest.roles: Teacher|Admin only (Student excluded)
 * - UpdateUserRolesRequest.roles: Teacher|Admin only
 *
 * v4.0 changes (CR-20 through CR-23):
 * - CR-20: CreateUserRequest.password optional; CreateUserResponse adds temporaryPassword
 * - CR-21: Student.classId/className nullable; PromoteRequest union; GraduateResult
 * - CR-22: Student.status (Active|DroppedOff|Graduated); UpdateStudentRequest.status
 * - CR-23: Batch.status Archived → Graduated
 *
 * v5.0 changes (M-010 through M-017):
 * - M-010: token_version in JWT (TOKEN_REVOKED on revocation)
 * - M-011: mustChangePassword in JWT + forced /change-password redirect
 * - M-012: AttendanceStatus += Excused; corrected_* → updated_by/updated_at
 * - M-013: AcademicSession lifecycle (UPCOMING→ACTIVE→COMPLETED) + promotion workflow
 * - M-017: SchoolProfile fields on tenant
 * - Guardian role added to UserRole
 */

// ─── ERROR ───────────────────────────────────────────────────────────────────
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string; // inside error per OpenAPI §ErrorResponse
  };
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
export type UserRole = "Teacher" | "Admin" | "Student" | "Guardian"; // v5.0: Guardian added

export interface TenantUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roles: Array<UserRole>;
  activeRole: UserRole;
  /** v4.5 CR-38: Student record ID when activeRole is Student; null otherwise */
  studentId: string | null;
  /** v5.0 M-011: true when admin has forced a password reset */
  mustChangePassword: boolean;
  /** v5.0: classId if user is class teacher for active session; null otherwise */
  classTeacherOf: string | null;
  /** v5.0 H-08: IANA timezone string from JWT e.g. "Asia/Kolkata" */
  tenantTimezone: string;
}
export interface TenantLoginRequest {
  email: string;
  password: string;
  /** v5.0 C-01fe: tenantId UUID from VITE_TENANT_ID (not slug) */
  tenantId: string;
}
export interface TenantLoginResponse {
  token: string;
  user: TenantUser;
}
export interface SwitchRoleRequest {
  role: UserRole;
}
export interface SwitchRoleResponse {
  token: string;
  user: TenantUser;
}

// ─── SCHOOL PERIODS ──────────────────────────────────────────────────────────
export interface SchoolPeriod {
  id: string;
  periodNumber: number;
  label?: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}
export interface ListSchoolPeriodsResponse {
  periods: SchoolPeriod[];
}
export interface CreateSchoolPeriodRequest {
  periodNumber: number;
  label?: string;
  startTime: string;
  endTime: string;
}
export interface CreateSchoolPeriodResponse {
  period: SchoolPeriod;
}
export interface UpdateSchoolPeriodRequest {
  label?: string;
  startTime?: string;
  endTime?: string;
}
export interface UpdateSchoolPeriodResponse {
  period: SchoolPeriod;
}

// ─── USERS ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  roles: Array<UserRole>;
}
export interface ListUsersResponse {
  users: User[];
}
/** Roles available in user management forms (v3.5 CR-13: Student excluded) */
export type ManageableUserRole = "Teacher" | "Admin";
export interface CreateUserRequest {
  name: string;
  email: string;
  password?: string; // v4.0 CR-20: optional; omit to auto-generate a temporaryPassword
  roles: Array<ManageableUserRole>;
}
export interface CreateUserResponse {
  user: User;
  temporaryPassword: string | null; // v4.0 CR-20: non-null only when password was auto-generated
}
export interface UpdateUserRolesRequest {
  roles: Array<ManageableUserRole>;
}
export interface UpdateUserRolesResponse {
  user: User;
}
export interface ResetPasswordResponse {
  user: TenantUser;
  temporaryPassword: string;
}

// ─── STUDENTS ────────────────────────────────────────────────────────────────
export type StudentStatus = "Active" | "DroppedOff" | "Graduated"; // v4.0 CR-22

export interface Student {
  id: string;
  name: string;
  userId: string | null; // auto-created on POST /students (v3.5 CR-13)
  classId: string | null; // v4.0 CR-21: null when graduated
  className?: string | null; // v4.0 CR-21: null when graduated
  batchId: string;
  batchName?: string;
  admissionNumber: string; // v3.5 CR-13
  dob: string; // YYYY-MM-DD  (v3.5 CR-13)
  status: StudentStatus; // v4.0 CR-22
  loginId: string; // {admissionNumber.lower}@{slug}.local  (v3.5 CR-13)
}

// v3.4 CR-08: DEPRECATED in v3.5 -- backend retained, frontend removed
export interface LinkStudentAccountRequest {
  userId: string;
}
export interface LinkStudentAccountResponse {
  student: Student;
}
export interface ListStudentsResponse {
  students: Student[];
}
export interface CreateStudentRequest {
  name: string;
  classId: string;
  batchId: string;
  admissionNumber: string; // v3.5 CR-13
  dob: string; // YYYY-MM-DD  (v3.5 CR-13)
}
export interface CreateStudentResponse {
  student: Student;
}
/** v3.5 CR-13: all fields optional; at least one required */
export interface UpdateStudentRequest {
  name?: string;
  classId?: string;
  batchId?: string;
  admissionNumber?: string;
  dob?: string;
  status?: "Active" | "DroppedOff"; // v4.0 CR-22: Graduated never sent via PUT
}
export interface UpdateStudentResponse {
  student: Student;
}

// ─── BATCHES ─────────────────────────────────────────────────────────────────
export type BatchStatus = "Active" | "Graduated"; // v4.0 CR-23: Archived renamed to Graduated

export interface Batch {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  status: BatchStatus;
}
export interface ListBatchesResponse {
  batches: Batch[];
}
export interface CreateBatchRequest {
  name: string;
  startYear: number;
  endYear: number;
}
export interface UpdateBatchRequest {
  name?: string;
  startYear?: number;
  endYear?: number;
  status?: BatchStatus; // v4.0 CR-23: Active | Graduated
}

// ─── SUBJECTS ────────────────────────────────────────────────────────────────
export interface Subject {
  id: string;
  name: string;
  code?: string | null;
}
export interface ListSubjectsResponse {
  subjects: Subject[];
}
export interface CreateSubjectRequest {
  name: string;
  code?: string;
}
export interface UpdateSubjectRequest {
  name?: string;
  code?: string;
}

// ─── CLASSES ─────────────────────────────────────────────────────────────────
export interface Class {
  id: string;
  name: string;
  batchId: string;
  batchName?: string;
}
export interface ListClassesResponse {
  classes: Class[];
}
export interface CreateClassRequest {
  name: string;
  batchId: string;
}
export interface UpdateClassRequest {
  name?: string;
}
// v4.0 CR-21: promote/graduate union types
/** Body sent to PUT /classes/{sourceClassId}/promote */
export type PromoteRequest = { targetClassId: string } | { action: "graduate" };

/** Response when promoting (moving to another class) */
export interface PromoteResult {
  updated: number;
  failed: Array<{ id: string; reason: string }>;
}

/** Response when graduating (classId set to null, status=Graduated) */
export interface GraduateResult {
  graduated: number;
  failed: Array<{ id: string; reason: string }>;
}

// Kept for legacy compatibility; superseded by PromoteResult | GraduateResult
export interface PromoteClassResponse {
  promoted: number;
  sourceClassId: string;
  targetClassId: string;
}

// ─── TIMETABLE ───────────────────────────────────────────────────────────────
export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";
export type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused"; // v5.0 M-012

export interface TimeSlot {
  id: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  label?: string;
  startTime?: string;
  endTime?: string | null;
}
export interface ListTimetableResponse {
  timetable: TimeSlot[];
}
export interface CreateTimeSlotRequest {
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
}
export interface CreateTimeSlotResponse {
  timeSlot: TimeSlot;
}
// ─── ATTENDANCE ──────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  /** User ID of last editor; null if never updated after initial record (v5.0 M-012) */
  updatedBy: string | null;
  /** ISO timestamp of last update; null if never updated after initial record (v5.0 M-012) */
  updatedAt: string | null;
  timeSlot: {
    id: string;
    subjectName?: string;
    periodNumber: number;
    dayOfWeek: string;
  };
  recordedBy: string;
  recordedAt: string;
}

// v3.4 CR-09 / v5.0 M-012: update an attendance record status
export interface CorrectAttendanceRequest {
  status: AttendanceStatus; // v5.0: includes "Excused" (Admin-only)
}
export interface CorrectAttendanceResponse {
  record: AttendanceRecord & { studentId: string; timeslotId: string };
}
export interface RecordClassAttendanceRequest {
  timeslotId: string;
  date: string;
  students: Array<{ studentId: string; status: AttendanceStatus }>;
}
export interface RecordClassAttendanceResponse {
  recorded: number;
  present: number;
  absent: number;
  late: number;
  excused: number; // v5.0 M-012
  date: string;
  timeSlot: {
    id: string;
    className?: string;
    subjectName?: string;
    periodNumber: number;
  };
}
export interface StudentAttendanceResponse {
  student: { id: string; name: string; classId?: string; batchId?: string };
  records: AttendanceRecord[];
  summary: {
    totalRecords: number;
    present: number;
    absent: number;
    late: number;
    /** v5.0 I-05: Excused count added to match AttendanceStatus enum */
    excused: number;
    attendanceRate: number;
  };
  pagination: { limit: number; offset: number; total: number };
}

export interface AttendanceSummaryResponse {
  summary: {
    classId: string;
    className: string;
    from: string;
    to: string;
    totalStudents: number;
    totalClasses: number;
    averageAttendanceRate: number;
  };
}

// ─── STUDENT MONTHLY ATTENDANCE SUMMARY (CR-25) ───────────────────────────────
export interface StudentAttendanceSummaryResponse {
  summary: {
    studentId: string;
    year: number;
    month: number;
    totalClasses: number;
    present: number;
    absent: number;
    late: number;
    attendancePercentage: number;
  };
}

// ─── FEATURES ────────────────────────────────────────────────────────────────
export type FeatureKey = "timetable" | "attendance";
export interface Feature {
  key: FeatureKey;
  name: string;
  enabled: boolean;
  enabledAt: string | null;
}
export interface ListFeaturesResponse {
  features: Feature[];
}

// ─── BULK DELETE ─────────────────────────────────────────────────────────────
export interface BulkDeleteRequest {
  userIds?: string[];
  studentIds?: string[];
  classIds?: string[];
  batchIds?: string[];
  subjectIds?: string[];
}
export interface BulkDeleteResponse {
  deletedCount: number;
}

// ─── ATTENDANCE ANALYTICS (v4.5 CR-33–36) ────────────────────────────────────

/** CR-33: Consecutive absent streak per student (one entry per student in the timeslot's class) */
export interface AttendanceStreak {
  studentId: string;
  consecutiveAbsentCount: number;
}
export interface GetAttendanceStreaksResponse {
  classId: string;
  subjectId: string;
  streaks: AttendanceStreak[];
}

/** CR-34: Ranked attendance percentage entry */
export interface AttendanceTopper {
  rank: number;
  studentId: string;
  studentName: string;
  presentCount: number;
  totalPeriods: number;
  /** (presentCount / totalPeriods) * 100; null when totalPeriods is 0 */
  attendancePercentage: number | null;
}
export interface GetAttendanceToppersResponse {
  classId: string;
  from: string;
  to: string;
  total: number;
  limit: number;
  offset: number;
  toppers: AttendanceTopper[];
}

/** CR-35: Per-slot marking status for a single class on a given date */
export interface DailySummarySlot {
  timeSlotId: string;
  periodNumber: number;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  /** true if at least one attendance record exists for this slot on this date */
  attendanceMarked: boolean;
  totalStudents: number;
  /** 0 when attendanceMarked is false */
  absentCount: number;
}
export interface AttendanceDailySummaryResponse {
  classId: string;
  date: string;
  dayOfWeek: string;
  slots: DailySummarySlot[];
}

/** CR-36: One row per student in the monthly sheet */
export interface MonthlySheetRow {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  /**
   * Dense map keyed "1"…"<daysInMonth>".
   * Each value is an array of {timeSlotId, status} records for that day+subject.
   * Empty array [] when no records exist (weekend/holiday/not-marked).
   */
  days: Record<string, Array<{ timeSlotId: string; status: AttendanceStatus }>>;
}
export interface MonthlySheetResponse {
  year: number;
  month: number;
  classId: string;
  subjectId: string;
  students: MonthlySheetRow[];
}

// ─── ATTENDANCE ABSENTEES — (CR-39/CR-41) ───────────────────────────────────
/** A single absent student entry in the absentee popup response */
export interface AbsenteeEntry {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  /** Consecutive absence streak for this student × subject, including today. Always >= 1. */
  consecutiveAbsentCount: number;
}
export interface GetAbsenteesResponse {
  timeSlotId: string;
  date: string;
  classId: string;
  subjectId: string;
  absentees: AbsenteeEntry[];
}

// ─── EVENTS — Academic Calendar (v4.5 CR-37) ─────────────────────────────────
export type EventType = "Holiday" | "Exam" | "Event" | "Other";

export interface Event {
  id: string;
  title: string;
  type: EventType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (inclusive)
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface CreateEventRequest {
  title: string;
  type: EventType;
  startDate: string;
  endDate: string;
  description?: string | null;
}
export interface CreateEventResponse {
  event: Event;
}
export interface UpdateEventRequest {
  title?: string;
  type?: EventType;
  startDate?: string;
  endDate?: string;
  description?: string | null;
}
export interface UpdateEventResponse {
  event: Event;
}
export interface ListEventsResponse {
  events: Event[];
  total: number;
}

// ─── AUTH v5.0 ────────────────────────────────────────────────────────────────
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
export interface ChangePasswordResponse {
  token: string;
  user: TenantUser;
}

// ─── ACADEMIC SESSIONS (v5.0 M-013) ──────────────────────────────────────────
export type AcademicSessionStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";

export interface AcademicSession {
  id: string;
  tenantId: string;
  name: string;
  status: AcademicSessionStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionRequest {
  name: string;
  startDate: string;
  endDate: string;
}
export interface CreateSessionResponse {
  session: AcademicSession;
}
export interface ListSessionsResponse {
  sessions: AcademicSession[];
}
export interface CopyTimetableRequest {
  fromSessionId: string;
}
export interface CopyTimetableResponse {
  copied: number;
}

// Promotion preview — expires 10 min after creation
export interface PromotionStudentPreview {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  currentClassId: string | null;
  currentClassName: string | null;
  targetClassId: string | null;
  targetClassName: string | null;
  action: "promote" | "graduate" | "unassigned";
}
export interface PromotionBatchPreview {
  batchId: string;
  batchName: string;
  students: PromotionStudentPreview[];
}
export interface PromotionPreview {
  /** v5.0 C-05fe: renamed from previewId → promotionPreviewId (matches OpenAPI) */
  promotionPreviewId: string;
  expiresAt: string; // ISO timestamp
  sourceSessionId: string;
  targetSessionId: string;
  batches: PromotionBatchPreview[];
}
/** v5.0 C-04fe: field renamed targetSessionId → toSessionId (matches OpenAPI) */
export interface TransitionPreviewRequest {
  toSessionId: string;
}
/** v5.0 C-05fe: updated to match OpenAPI transition/commit body */
export interface TransitionCommitRequest {
  promotionPreviewId: string;
  batches: Array<{
    batchId: string;
    promotedStudentIds: string[];
    skippedStudentIds: string[];
  }>;
}
export interface TransitionCommitResponse {
  promotionLogId: string;
  promoted: number;
  graduated: number;
}
export interface RollbackPromotionResponse {
  rolledBack: number;
}

// ─── SCHOOL PROFILE (v5.0 M-017) ─────────────────────────────────────────────
export interface SchoolProfile {
  tenantId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  brandingColor: string | null;
  principalName: string | null;
  principalSignatureUrl: string | null;
  activeLevels: string[] | null;
}
export interface UpdateSchoolProfileRequest {
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  brandingColor?: string | null;
  principalName?: string | null;
  principalSignatureUrl?: string | null;
  activeLevels?: string[] | null;
}
export interface UpdateSchoolProfileResponse {
  profile: SchoolProfile;
}
export interface UploadProfileFileResponse {
  url: string;
}

// ─── LEAVE (Phase 1) ─────────────────────────────────────────────────────────
export type LeaveStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "ACTIVE"
  | "COMPLETED"
  | "OVERDUE";
export type LeaveType = "SICK" | "CASUAL" | "EMERGENCY" | "OTHER";
export type DurationType = "FULL_DAY" | "HALF_DAY";

export interface LeaveRequest {
  id: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  sessionId: string;
  requestedById: string;
  requestedByName: string;
  leaveType: LeaveType;
  durationType: DurationType;
  startDate: string; // ISO date
  endDate: string; // ISO date
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  departedAt: string | null;
  returnedAt: string | null;
  createdAt: string;
}

export interface SubmitLeaveRequest {
  studentId: string;
  leaveType: LeaveType;
  durationType: DurationType;
  startDate: string;
  endDate: string;
  reason: string;
}

// ─── GUARDIANS (Phase 1) ─────────────────────────────────────────────────────
export interface Guardian {
  id: string;
  tenantId: string;
  name: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  canSubmitLeave: boolean;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuardianRequest {
  studentId: string;
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
  canSubmitLeave?: boolean;
  createAccount?: boolean;
  password?: string;
}

export interface CreateGuardianResponse {
  guardian: Guardian;
  userCreated: boolean;
}

// ─── NOTIFICATIONS (Phase 1) ──────────────────────────────────────────────────
export type NotificationType =
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_SUBMITTED"
  | "EXAM_PUBLISHED"
  | "EXAM_MARKS_ENTRY_OPEN"
  | "ANNOUNCEMENT"
  | "FEE_REMINDER"
  | "ATTENDANCE_ALERT"
  | "ASSIGNMENT_DUE";

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  route: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

// ─── EXAMS (Phase 1) ──────────────────────────────────────────────────────────
export type ExamStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
export type MarksStatus = "PENDING" | "ENTERED" | "ABSENT";

export interface GradeBoundary {
  grade: string;
  minPercent: number;
  label: string;
}

export interface Exam {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  classId: string;
  className: string;
  sessionId: string;
  sessionName: string;
  status: ExamStatus;
  publishedAt: string | null;
  gradeBoundaries: GradeBoundary[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamSubject {
  id: string;
  examId: string;
  subjectId: string;
  subjectName: string;
  totalMarks: number;
  passMarks: number;
  marksStatus: MarksStatus;
  createdAt: string;
}

export interface ExamResult {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  marksObtained: number | null;
  isAbsent: boolean;
  grade: string | null;
  isPass: boolean | null;
  marksStatus: MarksStatus;
}

export interface ConsolidatedResults {
  examId: string;
  examName: string;
  students: {
    studentId: string;
    studentName: string;
    admissionNumber: string;
    totalMarksObtained: number;
    totalMarksPossible: number;
    aggregatePercentage: number;
    overallGrade: string;
    overallResult: string;
    classRank: number | null;
  }[];
}

export interface ExamStudentSummary {
  examId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  totalMarksObtained: number;
  totalMarksPossible: number;
  aggregatePercentage: number;
  overallGrade: string;
  overallResult: string;
  classRank: number | null;
  subjects: {
    subjectName: string;
    totalMarks: number;
    passMarks: number;
    marksObtained: number | null;
    isAbsent: boolean;
    grade: string | null;
    isPass: boolean | null;
  }[];
}

export interface ExternalResult {
  id: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  examName: string;
  examBody: string;
  year: number;
  grade: string | null;
  marksObtained: number | null;
  totalMarks: number | null;
  remarks: string | null;
  createdAt: string;
}

// ─── FEES (Phase 1) ───────────────────────────────────────────────────────────
export type FeeCategory =
  | "TUITION"
  | "TRANSPORT"
  | "HOSTEL"
  | "EXAM"
  | "LIBRARY"
  | "SPORTS"
  | "OTHER";

export interface FeeCharge {
  id: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  className: string;
  sessionId: string;
  sessionName: string;
  category: FeeCategory;
  description: string;
  amount: number;
  dueDate: string | null;
  totalPaid: number;
  balance: number;
  createdAt: string;
}

export interface FeePayment {
  id: string;
  chargeId: string;
  tenantId: string;
  amount: number;
  paymentMode: "Cash" | "SelfPaid";
  paidAt: string;
  receiptNumber: string | null;
  notes: string | null;
  recordedById: string;
  createdAt: string;
}

export interface FeeSummaryEntry {
  classId: string;
  className: string;
  totalCharged: number;
  totalPaid: number;
  totalBalance: number;
  studentCount: number;
}

export interface BulkChargeRequest {
  sessionId: string;
  category: FeeCategory;
  description: string;
  amount: number;
  dueDate?: string;
  studentIds?: string[];
  classId?: string;
}

// ─── ANNOUNCEMENTS (Phase 1) ──────────────────────────────────────────────────
export type AudienceType =
  | "All"
  | "Teachers"
  | "Students"
  | "Guardians"
  | "Class";

export interface Announcement {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  audienceType: AudienceType;
  audienceClassId: string | null;
  audienceClassName: string | null;
  publishAt: string | null;
  expiresAt: string | null;
  createdById: string;
  createdByName: string;
  pushSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  body: string;
  audienceType: AudienceType;
  audienceClassId?: string;
  publishAt?: string;
  expiresAt?: string;
}

// ─── ASSIGNMENTS (Phase 1) ────────────────────────────────────────────────────
export type AssignmentType =
  | "HOMEWORK"
  | "PROJECT"
  | "CLASSWORK"
  | "QUIZ"
  | "LAB"
  | "OTHER";
export type SubmissionStatus =
  | "PENDING"
  | "COMPLETED"
  | "INCOMPLETE"
  | "NOT_SUBMITTED";

export interface Assignment {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  assignmentType: AssignmentType;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  sessionId: string;
  sessionName: string;
  dueDate: string | null;
  maxMarks: number | null;
  status: "OPEN" | "CLOSED";
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  status: SubmissionStatus;
  marksObtained: number | null;
  remark: string | null;
  markedById: string | null;
  markedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BulkMarkRequest {
  submissions: {
    submissionId: string;
    status: SubmissionStatus;
    marksObtained?: number;
    remark?: string;
  }[];
}

// ─── IMPORT (Phase 1) ─────────────────────────────────────────────────────────
export type ImportJobStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ApiImportJob {
  id: string;
  tenantId: string;
  entity: string;
  status: ImportJobStatus;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: ImportError[];
  previewData: Record<string, unknown>[];
  createdById: string;
  expiresAt: string;
  confirmedAt: string | null;
  createdAt: string;
}

export interface ImportPreviewResponse {
  job: ApiImportJob;
}

// ─── GUARDIAN PORTAL (Phase 2) ────────────────────────────────────────────────
export interface GuardianChild {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  className: string;
  batchId: string | null;
  batchName: string | null;
  canSubmitLeave: boolean;
  relationship: string;
}

export interface GuardianAttendanceCalendar {
  studentId: string;
  month: string;
  records: {
    date: string;
    dayOfWeek: number;
    status: string | null;
  }[];
  summary: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
}
