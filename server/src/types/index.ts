// =====================================================
// FREEZE v5.0 — Canonical Type Definitions (§3.2)
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
  // v5.0 M-017: school profile columns
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  branding_color: string | null;
  principal_name: string | null;
  principal_signature_url: string | null;
  active_levels: string[] | null;
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
  // v5.0 M-010 / M-011
  token_version: number;
  must_change_password: boolean;
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
  // v5.0 M-014
  entry_level: string | null;
  entry_session_id: string | null;
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
  // v5.0 M-015
  session_id: string | null;
  level: string | null;
  section: string | null;
  class_teacher_id: string | null;
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
  // v5.0 M-016
  enrolled_at: Date | string | null;
  dropped_at: Date | string | null;
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
  status: AttendanceStatus;
  recorded_by: string;
  recorded_at: Date;
  // v5.0 M-012: replaces corrected_status/corrected_by/corrected_at
  updated_by: string | null;
  updated_at: Date | null;
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

export type UserRole = "Teacher" | "Admin" | "Student" | "Guardian" | "SuperAdmin"; // v5.0: Guardian added; SuperAdmin added for OpenAPI completeness (I-02)

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused"; // v5.0 M-012: Excused added

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
  activeRole: UserRole;
  studentId?: string | null; // v4.5 CR-38: populated when activeRole=Student; null otherwise
  // v5.0: logout revocation + forced password change
  tokenVersion: number; // incremented in DB on logout; middleware rejects stale tokens
  mustChangePassword: boolean; // frontend redirects to /change-password when true
  classTeacherOf: string | null; // classId if user is class teacher for an active session; null otherwise
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
      studentId?: string | null; // v4.5 CR-38
      // v5.0: attached by tenantContextMiddleware from JWT
      tokenVersion?: number;
      mustChangePassword?: boolean;
      classTeacherOf?: string | null;
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
  mustChangePassword: boolean; // v5.0
  classTeacherOf: string | null; // v5.0
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
  status: AttendanceStatus;
  recordedBy: string;
  recordedAt: string;
  // v5.0 M-012: replaces corrected_* fields
  updatedBy: string | null;
  updatedAt: string | null;
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

// ─── Academic Sessions (v5.0 M-013) ─────────────────────────────────────────

export type AcademicSessionStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";

export interface AcademicSessionRow {
  id: string;
  tenant_id: string;
  name: string;
  status: AcademicSessionStatus;
  start_date: string; // DATE as ISO string
  end_date: string; // DATE as ISO string
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // v5.0 M-06: computed by queries as (status = 'ACTIVE'), not a DB column
  is_current?: boolean;
}

export interface ApiAcademicSession {
  id: string;
  tenantId: string;
  name: string;
  status: AcademicSessionStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isCurrent: boolean; // v5.0 H-05: whether this is the currently active session
  createdAt: string;
  updatedAt: string;
}

export interface PromotionPreviewRow {
  id: string;
  tenant_id: string;
  source_session_id: string;
  preview_data: Record<string, unknown>;
  expires_at: Date;
  created_at: Date;
}

export interface PromotionLogRow {
  id: string;
  tenant_id: string;
  source_session_id: string;
  target_session_id: string;
  committed_by: string;
  snapshot: Record<string, unknown>;
  rolled_back: boolean;
  rolled_back_at: Date | null;
  rolled_back_by: string | null;
  created_at: Date;
}

// ─── School Profile (v5.0 M-017) ────────────────────────────────────────────

export interface ApiSchoolProfile {
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
