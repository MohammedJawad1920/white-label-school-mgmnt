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
  /** A student's own attendance records (CG-01 — pending studentId in JWT) */
  studentAttendance: (studentId: string, from: string, to: string) =>
    ["student-attendance", studentId, from, to] as const,

  // ── Features ──────────────────────────────────────────────────────────────
  features: () => ["features"] as const,
} as const;
