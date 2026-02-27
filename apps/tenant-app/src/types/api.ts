/**
 * types/api.ts — LOCKED per Frontend Freeze §3.2
 * All interfaces match OpenAPI v3.3.0 exactly.
 * timestamp is INSIDE error.{} per OpenAPI ErrorResponse schema.
 * Never define API shapes in component files — always import from here.
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
export interface TenantUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roles: Array<"Teacher" | "Admin">;
  activeRole: "Teacher" | "Admin";
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
  role: "Teacher" | "Admin";
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
  roles: Array<"Teacher" | "Admin">;
}
export interface ListUsersResponse {
  users: User[];
}
export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  roles: Array<"Teacher" | "Admin">;
}
export interface CreateUserResponse {
  user: User;
}
export interface UpdateUserRolesRequest {
  roles: Array<"Teacher" | "Admin">;
}
export interface UpdateUserRolesResponse {
  user: User;
}

// ─── STUDENTS ────────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  classId: string;
  className?: string;
  batchId: string;
  batchName?: string;
}
export interface ListStudentsResponse {
  students: Student[];
}
export interface CreateStudentRequest {
  name: string;
  classId: string;
  batchId: string;
}
export interface CreateStudentResponse {
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
  status: AttendanceStatus;
  timeSlot: {
    id: string;
    subjectName?: string;
    periodNumber: number;
    dayOfWeek: string;
  };
  recordedBy: string;
  recordedAt: string;
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
export interface AttendanceSummaryResponse {
  class: { id: string | null; name: string; studentCount: number };
  period: { from: string; to: string; days: number };
  summary: {
    totalRecords: number;
    present: number;
    absent: number;
    late: number;
    attendanceRate: number;
  };
  byStudent: Array<{
    studentId: string;
    studentName: string;
    present: number;
    absent: number;
    late: number;
    attendanceRate: number;
  }>;
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
