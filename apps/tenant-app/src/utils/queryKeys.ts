/**
 * Centralized TanStack Query key factory — tenant-app (GAP-04)
 *
 * M-05: Keys aligned with Frontend Freeze §3 QK factory (v3.0).
 *
 * Usage:
 *   useQuery({ queryKey: QUERY_KEYS.classes(), ... })
 *   useQuery({ queryKey: QUERY_KEYS.timetableToday(date), ... })
 *   qc.invalidateQueries({ queryKey: QUERY_KEYS.students() })
 *
 * NOTE: Inline query keys in components must use these factory functions —
 * never hard-code key arrays in feature files.
 */

export const QUERY_KEYS = {
  // ── Escape hatch for legacy key shapes during compliance migration ────────
  custom: (...parts: ReadonlyArray<unknown>) => parts as readonly unknown[],

  // ── Timetable ──────────────────────────────────────────────────────────────
  timetableToday: (date: string) => ["timetable", "today", date] as const,
  timetable: (params?: Record<string, string>) =>
    params ? ["timetable", params] : (["timetable"] as const),

  // ── School Periods ─────────────────────────────────────────────────────────
  schoolPeriods: () => ["school-periods"] as const,

  // ── Classes ────────────────────────────────────────────────────────────────
  classes: () => ["classes"] as const,

  // ── Batches ────────────────────────────────────────────────────────────────
  batches: () => ["batches"] as const,

  // ── Subjects ──────────────────────────────────────────────────────────────
  subjects: () => ["subjects"] as const,

  // ── Users ─────────────────────────────────────────────────────────────────
  users: () => ["users"] as const,
  user: (id: string) => ["users", id] as const,

  // ── Students ──────────────────────────────────────────────────────────────
  students: () => ["students"] as const,
  student: (id: string) => ["students", id] as const,

  // ── Attendance ───────────────────────────────────────────────────────────
  /** Summary stats for a class slot */
  attendanceSummary: (slotId: string) =>
    ["attendance-summary", slotId] as const,
  /** A student's own attendance records — paginated */
  studentAttendancePaged: (
    studentId: string,
    from: string,
    to: string,
    page: number,
  ) => ["student-attendance", studentId, from, to, page] as const,
  /** A student's own attendance records — unpaginated range */
  studentAttendance: (studentId: string, from: string, to: string) =>
    ["student-attendance", studentId, from, to] as const,
  /** Per-student monthly attendance summary (§3.3) */
  studentAttendanceSummary: (studentId: string, year: number, month: number) =>
    ["student-attendance-summary", studentId, year, month] as const,
  /** Consecutive absent streaks for a time slot (§3.3) */
  attendanceStreaks: (timeSlotId: string) =>
    ["attendance-streaks", timeSlotId] as const,
  /**
   * All slots summary for a class on a given date (§3.3).
   * M-05: key root is ['attendance', 'daily-summary', ...] per Freeze §3 QK.attendanceDailySummary.
   */
  attendanceDailySummary: (classId: string, date: string) =>
    ["attendance", "daily-summary", classId, date] as const,
  /** Full monthly sheet for a class + subject (§3.3) */
  attendanceMonthlySheet: (
    classId: string,
    subjectId: string,
    year: number,
    month: number,
  ) => ["attendance-monthly-sheet", classId, subjectId, year, month] as const,
  /** Top attendance students for a class in a date range (§3.3) */
  attendanceToppers: (
    classId: string,
    from: string,
    to: string,
    offset: number,
  ) => ["attendance-toppers", classId, from, to, offset] as const,
  /**
   * Absent student names for a timeslot on a date — lazy (popup only).
   * M-05: key root is ['attendance', 'absentees', ...] per Freeze §3 QK.attendanceAbsentees.
   */
  absentees: (timeSlotId: string, date: string) =>
    ["attendance", "absentees", timeSlotId, date] as const,

  // ── Events ────────────────────────────────────────────────────────────────
  /** Calendar events within a date range (§3.3) */
  events: (from: string, to: string) => ["events", from, to] as const,
  /** Events for the current calendar month (§3.3) */
  eventsCurrentMonth: () => ["events", "current-month"] as const,

  // ── Features ──────────────────────────────────────────────────────────────
  features: () => ["features"] as const,

  // ── Academic Sessions (v5.0 M-013) ───────────────────────────────────────
  /** Root key for all sessions — invalidate to bust the entire sessions cache */
  sessions: () => ["sessions"] as const,
  /**
   * Sessions list (with optional filters).
   * Sits under ['sessions', 'list'] so invalidating sessions() busts this too.
   */
  sessionsList: (filters?: object) =>
    filters
      ? (["sessions", "list", filters] as const)
      : (["sessions", "list"] as const),
  /** Current active session (app-boot singleton) */
  sessionCurrent: () => ["sessions", "current"] as const,
  /**
   * Single session by ID.
   * M-05: key is ['sessions', id] per Freeze §3 QK.session — NOT ['sessions', 'detail', id].
   */
  sessionDetail: (id: string) => ["sessions", id] as const,

  // ── School Profile (v5.0 M-017) ──────────────────────────────────────────
  schoolProfile: () => ["school-profile"] as const,

  // ── Leave (Phase 1) ───────────────────────────────────────────────────────
  leave: {
    all: () => ["leave"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["leave", "list", filters] as const,
    detail: (id: string) => ["leave", id] as const,
    onCampus: () => ["leave", "on-campus"] as const,
  },

  // ── Exams (Phase 1) ───────────────────────────────────────────────────────
  exams: {
    all: () => ["exams"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["exams", "list", filters] as const,
    detail: (id: string) => ["exams", id] as const,
    results: (id: string) => ["exams", id, "results"] as const,
    marks: (examId: string, subjectId: string) =>
      ["exams", examId, "subjects", subjectId, "marks"] as const,
    reportCard: (examId: string, studentId: string) =>
      ["exams", examId, "report-card", studentId] as const,
  },

  // ── External Results (Phase 1) ────────────────────────────────────────────
  externalResults: {
    list: (filters?: Record<string, unknown>) =>
      ["external-results", "list", filters] as const,
  },

  // ── Fees (Phase 1) ────────────────────────────────────────────────────────
  fees: {
    all: () => ["fees"] as const,
    charges: (filters?: Record<string, unknown>) =>
      ["fees", "charges", filters] as const,
    summary: (filters?: Record<string, unknown>) =>
      ["fees", "summary", filters] as const,
  },

  // ── Announcements (Phase 1) ───────────────────────────────────────────────
  announcements: {
    all: () => ["announcements"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["announcements", "list", filters] as const,
    detail: (id: string) => ["announcements", id] as const,
  },

  // ── Assignments (Phase 1) ─────────────────────────────────────────────────
  assignments: {
    all: () => ["assignments"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["assignments", "list", filters] as const,
    detail: (id: string) => ["assignments", id] as const,
    submissions: (id: string) => ["assignments", id, "submissions"] as const,
  },

  // ── Import Jobs (Phase 1) ─────────────────────────────────────────────────
  importJobs: {
    history: () => ["import", "history"] as const,
    detail: (id: string) => ["import", id] as const,
  },

  // ── Notifications (Phase 1) ───────────────────────────────────────────────
  notifications: {
    all: () => ["notifications"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["notifications", "list", filters] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
  },

  // ── Guardian Portal (Phase 2) ─────────────────────────────────────────────
  guardianPortal: {
    children: () => ["guardian-portal", "children"] as const,
    attendance: (studentId: string, month: string) =>
      ["guardian-portal", studentId, "attendance", month] as const,
    timetable: (studentId: string) =>
      ["guardian-portal", studentId, "timetable"] as const,
    results: (studentId: string, sessionId?: string) =>
      ["guardian-portal", studentId, "results", sessionId] as const,
    fees: (studentId: string, sessionId?: string) =>
      ["guardian-portal", studentId, "fees", sessionId] as const,
    assignments: (studentId: string, sessionId?: string) =>
      ["guardian-portal", studentId, "assignments", sessionId] as const,
    leave: (studentId: string) =>
      ["guardian-portal", studentId, "leave"] as const,
  },

  // ── Guardians (Phase 1) ───────────────────────────────────────────────────
  guardians: {
    list: (studentId: string) => ["guardians", "student", studentId] as const,
    detail: (id: string) => ["guardians", id] as const,
  },
} as const;
