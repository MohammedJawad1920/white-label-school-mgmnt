/**
 * types/api.ts — LOCKED per Frontend Freeze §3.2
 * All interfaces match OpenAPI v3.5.0 exactly.
 * timestamp is INSIDE error.{} per OpenAPI ErrorResponse schema.
 * Never define API shapes in component files — always import from here.
 *
 * v3.5 changes (CR-12, CR-13):
 * - Student gains admissionNumber, dob, loginId
 * - CreateStudentRequest gains admissionNumber, dob (replaces manual user creation)
 * - New: UpdateStudentRequest/Response
 * - CreateUserRequest.roles: Teacher|Admin only (Student excluded)
 * - UpdateUserRolesRequest.roles: Teacher|Admin only
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
export type UserRole = "Teacher" | "Admin" | "Student"; // v3.4

export interface TenantUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roles: Array<UserRole>;
  activeRole: UserRole;
}
export interface TenantLoginRequest {
  email: string;
  password: string;
  tenantSlug: string;
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
  password: string;
  roles: Array<ManageableUserRole>;
}
export interface CreateUserResponse {
  user: User;
}
export interface UpdateUserRolesRequest {
  roles: Array<ManageableUserRole>;
}
export interface UpdateUserRolesResponse {
  user: User;
}

// ─── STUDENTS ────────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  userId: string | null; // auto-created on POST /students (v3.5 CR-13)
  classId: string;
  className?: string;
  batchId: string;
  batchName?: string;
  admissionNumber: string; // v3.5 CR-13
  dob: string; // YYYY-MM-DD  (v3.5 CR-13)
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
}
export interface UpdateStudentResponse {
  student: Student;
}

// ─── BATCHES ─────────────────────────────────────────────────────────────────
export interface Batch {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  status: "Active" | "Archived";
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
  status?: "Active" | "Archived";
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

// ─── TIMETABLE ───────────────────────────────────────────────────────────────
export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";
export type AttendanceStatus = "Present" | "Absent" | "Late";

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
  endTime?: string;
  effectiveFrom: string;
  effectiveTo: string | null;
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
  effectiveFrom: string;
  // v3.3: startTime/endTime removed from request — derived server-side via school_periods JOIN
}
export interface CreateTimeSlotResponse {
  timeSlot: TimeSlot;
}
export interface EndTimeSlotRequest {
  effectiveTo: string;
}
export interface EndTimeSlotResponse {
  timeSlot: Pick<TimeSlot, "id" | "effectiveTo">;
}

// ─── ATTENDANCE ──────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: string;
  date: string;
  /** Effective status = correctedStatus ?? originalStatus (v3.4) */
  status: AttendanceStatus;
  /** Immutable status written at record-time (v3.4) */
  originalStatus: AttendanceStatus;
  /** User ID of corrector; null if never corrected (v3.4) */
  correctedBy: string | null;
  /** ISO timestamp of last correction; null if never corrected (v3.4) */
  correctedAt: string | null;
  timeSlot: {
    id: string;
    subjectName?: string;
    periodNumber: number;
    dayOfWeek: string;
  };
  recordedBy: string;
  recordedAt: string;
}

// v3.4 CR-09: correct an attendance record status
export interface CorrectAttendanceRequest {
  status: AttendanceStatus;
}
export interface CorrectAttendanceResponse {
  record: AttendanceRecord & { studentId: string; timeslotId: string };
}
export interface RecordClassAttendanceRequest {
  timeSlotId: string;
  date: string;
  defaultStatus: AttendanceStatus;
  exceptions: Array<{ studentId: string; status: AttendanceStatus }>;
}
export interface RecordClassAttendanceResponse {
  recorded: number;
  present: number;
  absent: number;
  late: number;
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
    attendanceRate: number;
  };
  pagination: { limit: number; offset: number; total: number };
}
export interface AttendanceSummaryByStudent {
  studentId: string;
  studentName: string;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
}

export interface AttendanceSummaryResponse {
  class?: {
    id: string;
    name: string;
    studentCount: number;
  };
  period?: {
    from: string;
    to: string;
    days: number;
  };
  summary?: {
    totalRecords: number;
    present: number;
    absent: number;
    late: number;
    attendanceRate: number;
  };
  byStudent?: AttendanceSummaryByStudent[];
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
  ids: string[];
}
export interface BulkDeleteResponse {
  deleted: string[];
  failed: Array<{
    id: string;
    reason: "NOT_FOUND" | "HAS_REFERENCES";
    message: string;
  }>;
}
