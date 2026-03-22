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

export type UserRole =
  | "Teacher"
  | "Admin"
  | "Student"
  | "Guardian"
  | "SuperAdmin"; // v5.0: Guardian added; SuperAdmin added for OpenAPI completeness (I-02)

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused"; // v5.0 M-012: Excused added

export type FeatureKey =
  | "timetable"
  | "attendance"
  | "leave"
  | "exams"
  | "fees"
  | "announcements"
  | "assignments"
  | "import"
  | "guardian"
  | "notifications";

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

// ─── Leave Requests (v5.0 M-019) ────────────────────────────────────────────

export type LeaveStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "ACTIVE"
  | "COMPLETED"
  | "OVERDUE";

export type LeaveType =
  | "HomeVisit"
  | "Medical"
  | "Emergency"
  | "ExternalExam"
  | "OfficialDuty"
  | "Personal";

export type DurationType = "HalfDayAM" | "HalfDayPM" | "FullDay" | "MultiDay";

export interface LeaveRequestRow {
  id: string;
  tenant_id: string;
  session_id: string;
  student_id: string;
  requested_by_user_id: string;
  requested_by_role: string;
  proxy_for: string | null;
  leave_type: LeaveType;
  duration_type: DurationType;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url: string | null;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  departed_at: Date | null;
  expected_return_at: Date;
  returned_at: Date | null;
  return_noted_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ApiLeaveRequest {
  id: string;
  tenantId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  requestedByUserId: string;
  requestedByRole: string;
  leaveType: LeaveType;
  durationType: DurationType;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl: string | null;
  status: LeaveStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  departedAt: string | null;
  expectedReturnAt: string;
  returnedAt: string | null;
  createdAt: string;
}

// ─── Guardians (v5.0 M-020) ─────────────────────────────────────────────────

export interface GuardianRow {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string | null;
  relationship: string | null;
  is_primary: boolean;
  can_submit_leave: boolean;
  user_id: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

export interface ApiGuardian {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  relationship: string | null;
  isPrimary: boolean;
  canSubmitLeave: boolean;
  userId: string | null;
  createdAt: string;
}

// ─── Push Subscriptions (v5.0 M-022) ────────────────────────────────────────

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  tenant_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_label: string | null;
  created_at: Date;
}

// ─── Notifications (v5.0 M-023) ─────────────────────────────────────────────

export type NotificationType =
  | "LEAVE_SUBMITTED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "STUDENT_DEPARTED"
  | "STUDENT_RETURNED"
  | "LEAVE_OVERDUE"
  | "ABSENCE_ALERT"
  | "EXAM_PUBLISHED"
  | "ASSIGNMENT_CREATED"
  | "ANNOUNCEMENT"
  | "FEE_CHARGED";

export interface NotificationRow {
  id: string;
  tenant_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: Date | null;
  push_sent_at: Date | null;
  push_delivered: boolean | null;
  created_at: Date;
}

export interface ApiNotification {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

// ─── Exams (v5.0 M-027 through M-031) ───────────────────────────────────────

export type ExamStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ONGOING"
  | "MARKS_PENDING"
  | "UNDER_REVIEW"
  | "PUBLISHED"
  | "UNPUBLISHED";

export type MarksStatus = "PENDING" | "ENTERED" | "LOCKED";

export interface GradeBoundary {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  label: string;
}

export interface ExamRow {
  id: string;
  tenant_id: string;
  session_id: string;
  class_id: string;
  name: string;
  type: "TermExam" | "PeriodicTest";
  status: ExamStatus;
  grade_boundaries: GradeBoundary[];
  created_by: string;
  published_by: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ExamSubjectRow {
  id: string;
  tenant_id: string;
  exam_id: string;
  subject_id: string;
  teacher_id: string;
  exam_date: string;
  start_time: string | null;
  end_time: string | null;
  total_marks: number;
  pass_marks: number;
  marks_status: MarksStatus;
  created_at: Date;
}

export interface ExamResultRow {
  id: string;
  tenant_id: string;
  exam_subject_id: string;
  student_id: string;
  marks_obtained: number | null;
  is_absent: boolean;
  grade: string | null;
  is_pass: boolean | null;
  entered_by: string | null;
  entered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExamStudentSummaryRow {
  id: string;
  tenant_id: string;
  exam_id: string;
  student_id: string;
  total_marks_obtained: number;
  total_marks_possible: number;
  aggregate_percentage: number;
  overall_grade: string;
  overall_result: "PASS" | "FAIL";
  class_rank: number | null;
  created_at: Date;
}

export interface ExternalResultRow {
  id: string;
  tenant_id: string;
  student_id: string;
  session_id: string;
  exam_name: string;
  conducted_by: string;
  result_summary: string | null;
  document_url: string | null;
  recorded_by: string;
  recorded_at: Date;
}

export interface ApiExam {
  id: string;
  tenantId: string;
  sessionId: string;
  classId: string;
  className: string;
  name: string;
  type: "TermExam" | "PeriodicTest";
  status: ExamStatus;
  gradeBoundaries: GradeBoundary[];
  subjects: ApiExamSubject[];
  createdBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiExamSubject {
  id: string;
  examId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  examDate: string;
  startTime: string | null;
  endTime: string | null;
  totalMarks: number;
  passMarks: number;
  marksStatus: MarksStatus;
}

export interface ApiExamResult {
  examSubjectId: string;
  marksObtained: number | null;
  isAbsent: boolean;
  grade: string | null;
  isPass: boolean | null;
}

export interface ApiConsolidatedResults {
  examId: string;
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    totalMarks: number;
    passMarks: number;
  }>;
  students: Array<{
    studentId: string;
    studentName: string;
    admissionNumber: string;
    results: ApiExamResult[];
    summary: {
      totalMarksObtained: number;
      totalMarksPossible: number;
      aggregatePercentage: number;
      overallGrade: string;
      overallResult: "PASS" | "FAIL";
      classRank: number | null;
    };
  }>;
}

export interface ApiExternalResult {
  id: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  examName: string;
  conductedBy: string;
  resultSummary: string | null;
  documentUrl: string | null;
  recordedBy: string;
  recordedAt: string;
}

// ─── Fees (v5.0 M-032 / M-033) ──────────────────────────────────────────────

export type FeeCategory =
  | "BoardExamFee"
  | "UniversityExamFee"
  | "InternalExamFee"
  | "Books"
  | "Other";

export interface FeeChargeRow {
  id: string;
  tenant_id: string;
  student_id: string;
  session_id: string;
  description: string;
  category: FeeCategory;
  amount: number;
  due_date: string | null;
  raised_by: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface FeePaymentRow {
  id: string;
  tenant_id: string;
  charge_id: string;
  student_id: string;
  amount_paid: number;
  payment_mode: "Cash" | "SelfPaid";
  paid_at: string;
  receipt_number: string | null;
  recorded_by: string;
  notes: string | null;
  recorded_at: Date;
}

export interface ApiFeeCharge {
  id: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  description: string;
  category: FeeCategory;
  amount: number;
  dueDate: string | null;
  totalPaid: number;
  balance: number;
  notes: string | null;
  createdAt: string;
}

export interface ApiFeePayment {
  id: string;
  chargeId: string;
  amountPaid: number;
  paymentMode: "Cash" | "SelfPaid";
  paidAt: string;
  receiptNumber: string | null;
  recordedBy: string;
  notes: string | null;
  recordedAt: string;
}

// ─── Announcements (v5.0 M-034) ─────────────────────────────────────────────

export type AudienceType =
  | "All"
  | "Class"
  | "Batch"
  | "StudentsOnly"
  | "TeachersOnly"
  | "GuardiansOnly";

export interface AnnouncementRow {
  id: string;
  tenant_id: string;
  session_id: string;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  audience_type: AudienceType;
  audience_class_id: string | null;
  audience_batch_id: string | null;
  created_by: string;
  created_by_role: string;
  publish_at: Date;
  expires_at: Date | null;
  push_sent: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ApiAnnouncement {
  id: string;
  tenantId: string;
  sessionId: string;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  audienceType: AudienceType;
  audienceClassId: string | null;
  audienceBatchId: string | null;
  createdBy: string;
  createdByName: string;
  publishAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Import Jobs (v5.0 M-035) ───────────────────────────────────────────────

export type ImportJobStatus =
  | "PREVIEW"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export interface ImportJobRow {
  id: string;
  tenant_id: string;
  entity_type: "Student" | "User";
  status: ImportJobStatus;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  preview_data: unknown[] | null;
  error_data: unknown[] | null;
  imported_rows: number | null;
  created_by: string;
  confirmed_at: Date | null;
  created_at: Date;
  expires_at: Date;
}

export interface ImportError {
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface ApiImportJob {
  id: string;
  tenantId: string;
  entityType: "Student" | "User";
  status: ImportJobStatus;
  totalRows: number;
  validRows: number;
  errorRows: number;
  previewData: unknown[] | null;
  errors: ImportError[] | null;
  importedRows: number | null;
  createdBy: string;
  confirmedAt: string | null;
  createdAt: string;
  expiresAt: string;
}

// ─── Assignments (v5.0 M-037 / M-038) ───────────────────────────────────────

export type AssignmentType =
  | "Written"
  | "Memorization"
  | "Reading"
  | "ProblemSet"
  | "Project"
  | "Revision";

export type SubmissionStatus =
  | "PENDING"
  | "COMPLETED"
  | "INCOMPLETE"
  | "NOT_SUBMITTED";

export interface AssignmentRow {
  id: string;
  tenant_id: string;
  session_id: string;
  class_id: string;
  subject_id: string;
  created_by: string;
  title: string;
  description: string | null;
  type: AssignmentType;
  due_date: string;
  is_graded: boolean;
  max_marks: number | null;
  status: "ACTIVE" | "CLOSED";
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface AssignmentSubmissionRow {
  id: string;
  tenant_id: string;
  assignment_id: string;
  student_id: string;
  status: SubmissionStatus;
  marks_obtained: number | null;
  remark: string | null;
  marked_by: string | null;
  marked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ApiAssignment {
  id: string;
  tenantId: string;
  sessionId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  createdBy: string;
  createdByName: string;
  title: string;
  description: string | null;
  type: AssignmentType;
  dueDate: string;
  isGraded: boolean;
  maxMarks: number | null;
  status: "ACTIVE" | "CLOSED";
  submissionsTotal: number;
  submissionsCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  status: SubmissionStatus;
  marksObtained: number | null;
  remark: string | null;
  markedBy: string | null;
  markedAt: string | null;
}
