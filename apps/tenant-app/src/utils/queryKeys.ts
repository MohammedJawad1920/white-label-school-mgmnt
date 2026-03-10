/**
 * Centralized TanStack Query key factory — tenant-app (GAP-04)
 *
 * Usage:
 *   useQuery({ queryKey: QUERY_KEYS.classes(), ... })
 *   useQuery({ queryKey: QUERY_KEYS.timetableToday(date), ... })
 *   qc.invalidateQueries({ queryKey: QUERY_KEYS.students() })
 */

export const QUERY_KEYS = {
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
  /** All slots summary for a class on a given date (§3.3) */
  attendanceDailySummary: (classId: string, date: string) =>
    ["attendance-daily-summary", classId, date] as const,
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
  /** Absent student names for a timeslot on a date — lazy (popup only) */
  absentees: (timeSlotId: string, date: string) =>
    ["absentees", timeSlotId, date] as const,

  // ── Events ────────────────────────────────────────────────────────────────
  /** Calendar events within a date range (§3.3) */
  events: (from: string, to: string) => ["events", from, to] as const,
  /** Events for the current calendar month (§3.3) */
  eventsCurrentMonth: () => ["events", "current-month"] as const,

  // ── Features ──────────────────────────────────────────────────────────────
  features: () => ["features"] as const,
} as const;
