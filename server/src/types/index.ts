// =====================================================
// FREEZE v4.5 — Canonical Type Definitions (§3.2)
// All application code must import from here.
// =====================================================

// ─── DB Row Types (snake_case — matches PostgreSQL columns) ──────────────────

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
  timezone: string; // v3.6 CR-17
  deactivated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SuperAdminRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserRow {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  password_hash: string;
  roles: UserRole[];
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BatchRow {
  id: string;
  tenant_id: string;
  name: string;
  start_year: number;
  end_year: number;
  status: "Active" | "Graduated"; // v4.0 CR-23: Archived → Graduated
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubjectRow {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ClassRow {
  id: string;
  tenant_id: string;
  name: string;
  batch_id: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StudentRow {
  id: string;
  tenant_id: string;
  name: string;
  class_id: string | null; // v4.0 CR-21: nullable — NULL after graduation
  batch_id: string;
  user_id: string | null; // v3.4: nullable FK → users.id
  admission_number: string; // v3.5 CR-13
  dob: Date | string; // v3.5 CR-13: pg DATE — may arrive as Date or ISO string
  status: "Active" | "DroppedOff" | "Graduated"; // v4.0 CR-22
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SchoolPeriodRow {
  id: string;
  tenant_id: string;
  period_number: number;
  label: string;
  start_time: string; // "HH:MM:SS" from PostgreSQL TIME
  end_time: string;
  created_at: Date;
  updated_at: Date;
}

export interface TimeslotRow {
  id: string;
  tenant_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: DayOfWeek;
  period_number: number;
  // effective_from and effective_to removed (v4.3 CR-31)
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AttendanceRecordRow {
  id: string;
  tenant_id: string;
  student_id: string;
  timeslot_id: string;
  date: string; // DATE as ISO string
  status: AttendanceStatus; // v3.4: NEVER mutated after insert (original status)
  recorded_by: string;
  recorded_at: Date;
  // v3.4: correction audit trail
  corrected_status: AttendanceStatus | null;
  corrected_by: string | null;
  corrected_at: Date | null;
}

export interface FeatureRow {
  id: string;
  key: FeatureKey;
  name: string;
  description: string | null;
  created_at: Date;
}

export interface TenantFeatureRow {
  id: string;
  tenant_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
  enabled_at: Date | null;
}

// ─── Domain Enums / Unions ───────────────────────────────────────────────────

export type UserRole = "Teacher" | "Admin" | "Student"; // v3.4: Student added

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type AttendanceStatus = "Present" | "Absent" | "Late";

export type FeatureKey = "timetable" | "attendance";

export type TenantStatus = "active" | "inactive";

export type BatchStatus = "Active" | "Graduated"; // v4.0 CR-23: Archived → Graduated

export type StudentStatus = "Active" | "DroppedOff" | "Graduated"; // v4.0 CR-22

// ─── JWT Payload Types ───────────────────────────────────────────────────────

/** Payload inside tenant-user JWTs */
export interface TenantJwtPayload {
  userId: string;
  tenantId: string;
  roles: UserRole[];
  activeRole: UserRole; // v3.4: enum includes Student
  studentId?: string | null; // v4.5 CR-38: populated when activeRole=Student and linked record exists; null otherwise; optional for backward-compat
  iat?: number;
  exp?: number;
}

/** Payload inside SuperAdmin JWTs */
export interface SuperAdminJwtPayload {
  superAdminId: string;
  role: "SuperAdmin";
  iat?: number;
  exp?: number;
}

// ─── Express Request Augmentation ────────────────────────────────────────────
// Adds typed fields that middleware attaches to req

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      userId?: string;
      userRoles?: UserRole[];
      activeRole?: UserRole;
      superAdminId?: string;
      studentId?: string | null; // v4.5 CR-38: attached by tenantContextMiddleware; null for non-Student roles
    }
  }
}

// ─── API Response Types (camelCase — matches OpenAPI) ────────────────────────

export interface ApiUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
  studentId: string | null; // v4.5 CR-38
}

export interface ApiTenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSchoolPeriod {
  id: string;
  tenantId: string;
  periodNumber: number;
  label: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  createdAt: string;
  updatedAt: string;
}

export interface ApiTimeslot {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string; // from JOIN with school_periods
  endTime: string | null; // from JOIN with school_periods; nullable (v4.3 CR-31)
  label: string; // from JOIN with school_periods
  // effectiveFrom and effectiveTo removed (v4.3 CR-31)
}

export interface ApiAttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  timeslotId: string;
  date: string;
  originalStatus: AttendanceStatus; // v3.4: original recorded value, never changes
  status: AttendanceStatus; // v3.4: effective = correctedStatus ?? originalStatus
  correctedBy: string | null; // v3.4
  correctedAt: string | null; // v3.4
  recordedBy: string;
  recordedAt: string;
}

// ─── Standard Error Shape (matches OpenAPI v3.4.0) ──────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  timestamp: string;
}

// ─── Events (v4.5 CR-37) ────────────────────────────────────────────────────

export type EventType = "Holiday" | "Exam" | "Event" | "Other";

export interface EventRow {
  id: string;
  tenant_id: string;
  title: string;
  type: EventType;
  start_date: string; // DATE as ISO string
  end_date: string; // DATE as ISO string
  description: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ApiEvent {
  id: string;
  title: string;
  type: EventType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Bulk Delete (Phase 3) ───────────────────────────────────────────────────

export interface BulkDeleteRequest {
  ids: string[];
}

export interface BulkDeleteResult {
  deleted: string[];
  failed: Array<{ id: string; reason: string; message: string }>;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
