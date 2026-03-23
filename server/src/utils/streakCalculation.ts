/**
 * Consecutive Streak Calculation Utilities
 *
 * Pure functions for calculating attendance streaks.
 * Extracted for unit testability per Freeze v6.1 §13.4.
 */

import type { AttendanceStatus } from "../types";

/**
 * Calculates the consecutive absence streak from a list of attendance records.
 *
 * Rules per Freeze §13.4:
 * - Counts consecutive "Absent" statuses starting from the most recent
 * - "Present" or "Late" breaks the streak
 * - "Excused" days do NOT break the streak but are NOT counted in the total
 * - Empty records → streak = 0
 *
 * @param records - Attendance records in descending date order (most recent first)
 * @returns The number of consecutive absences
 */
export function calculateConsecutiveAbsences(
  records: Array<{ status: AttendanceStatus }>,
): number {
  let streak = 0;

  for (const record of records) {
    if (record.status === "Absent") {
      streak++;
    } else if (record.status === "Present" || record.status === "Late") {
      // Present or Late breaks the streak going back
      break;
    }
    // Excused: doesn't break streak, doesn't add to count — just continue
  }

  return streak;
}

/**
 * Calculates the consecutive presence streak (for positive tracking).
 *
 * @param records - Attendance records in descending date order
 * @returns The number of consecutive present/late days
 */
export function calculateConsecutivePresence(
  records: Array<{ status: AttendanceStatus }>,
): number {
  let streak = 0;

  for (const record of records) {
    if (record.status === "Present" || record.status === "Late") {
      streak++;
    } else if (record.status === "Absent") {
      // Absent breaks the presence streak
      break;
    }
    // Excused: doesn't break streak, doesn't add to count
  }

  return streak;
}

/**
 * Determines if a student qualifies for an absence streak alert.
 *
 * @param records - Attendance records in descending date order
 * @param threshold - Minimum consecutive absences to trigger alert (default: 3)
 * @returns true if streak >= threshold
 */
export function shouldAlertAbsenceStreak(
  records: Array<{ status: AttendanceStatus }>,
  threshold = 3,
): boolean {
  return calculateConsecutiveAbsences(records) >= threshold;
}

/**
 * Groups attendance records by student and calculates streak for each.
 *
 * @param records - All attendance records with student IDs
 * @returns Map of studentId -> consecutive absence count
 */
export function calculateStreaksForStudents(
  records: Array<{ studentId: string; status: AttendanceStatus; date: string }>,
): Map<string, number> {
  // Group by student
  const byStudent = new Map<string, Array<{ status: AttendanceStatus; date: string }>>();

  for (const record of records) {
    const existing = byStudent.get(record.studentId) ?? [];
    existing.push({ status: record.status, date: record.date });
    byStudent.set(record.studentId, existing);
  }

  // Calculate streak for each student (sort by date desc first)
  const streaks = new Map<string, number>();

  for (const [studentId, studentRecords] of byStudent) {
    const sorted = studentRecords.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    streaks.set(studentId, calculateConsecutiveAbsences(sorted));
  }

  return streaks;
}
