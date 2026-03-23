/**
 * Grade Computation Utilities
 *
 * Pure functions for calculating grades and determining pass/fail status.
 * Extracted from exams controller for unit testability per Freeze v6.1 §13.4.
 */

import type { GradeBoundary } from "../types";

/**
 * Default 8-grade A+ scale per Freeze §4.5
 */
export const DEFAULT_GRADE_BOUNDARIES: GradeBoundary[] = [
  { grade: "A+", minPercentage: 90, maxPercentage: 100, label: "Outstanding" },
  { grade: "A", minPercentage: 80, maxPercentage: 89, label: "Excellent" },
  { grade: "B+", minPercentage: 70, maxPercentage: 79, label: "Very Good" },
  { grade: "B", minPercentage: 60, maxPercentage: 69, label: "Good" },
  { grade: "C+", minPercentage: 50, maxPercentage: 59, label: "Above Average" },
  { grade: "C", minPercentage: 40, maxPercentage: 49, label: "Average" },
  { grade: "D", minPercentage: 30, maxPercentage: 39, label: "Below Average" },
  { grade: "F", minPercentage: 0, maxPercentage: 29, label: "Fail" },
];

/**
 * Looks up the grade for a given percentage against a set of boundaries.
 *
 * @param percentage - The percentage score (0-100)
 * @param boundaries - Grade boundary definitions (defaults to DEFAULT_GRADE_BOUNDARIES)
 * @returns The grade string (e.g., "A+", "B", "F") or "N/A" if no match
 */
export function lookupGrade(
  percentage: number,
  boundaries: GradeBoundary[] = DEFAULT_GRADE_BOUNDARIES,
): string {
  const match = boundaries.find(
    (b) => percentage >= b.minPercentage && percentage <= b.maxPercentage,
  );
  return match?.grade ?? "N/A";
}

/**
 * Determines if a student passed based on marks and pass marks threshold.
 *
 * @param marksObtained - Marks the student obtained
 * @param passMarks - The minimum marks required to pass
 * @returns true if passed, false if failed
 */
export function isPassing(marksObtained: number, passMarks: number): boolean {
  return marksObtained >= passMarks;
}

/**
 * Calculates the grade for a student's exam result.
 *
 * Rules per Freeze §13.4:
 * - If is_absent = true → grade = "AB", is_pass = null
 * - If marks_obtained < pass_marks → grade = "F" regardless of percentage
 * - Otherwise → grade from percentage lookup
 *
 * @param params - The student result parameters
 * @returns Object with grade, percentage, and is_pass
 */
export function calculateStudentGrade(params: {
  marksObtained: number | null;
  totalMarks: number;
  passMarks: number;
  isAbsent: boolean;
  boundaries?: GradeBoundary[];
}): {
  grade: string;
  percentage: number | null;
  isPass: boolean | null;
} {
  const { marksObtained, totalMarks, passMarks, isAbsent, boundaries } = params;

  // Absent student
  if (isAbsent) {
    return { grade: "AB", percentage: null, isPass: null };
  }

  // No marks recorded
  if (marksObtained === null) {
    return { grade: "N/A", percentage: null, isPass: null };
  }

  const percentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;

  // Failed by marks threshold (regardless of percentage grade)
  if (marksObtained < passMarks) {
    return { grade: "F", percentage, isPass: false };
  }

  // Passed — look up grade from percentage
  const grade = lookupGrade(percentage, boundaries);
  return { grade, percentage, isPass: true };
}

/**
 * Determines overall exam result based on subject results.
 *
 * Rule per Freeze §13.4:
 * - overall_result = "FAIL" if any single subject has is_pass = false
 * - overall_result = "PASS" if all subjects have is_pass = true
 * - overall_result = "PENDING" if any subject has is_pass = null (absent/not marked)
 */
export function calculateOverallResult(
  subjectResults: Array<{ isPass: boolean | null }>,
): "PASS" | "FAIL" | "PENDING" {
  // If any subject failed, overall is FAIL
  if (subjectResults.some((s) => s.isPass === false)) {
    return "FAIL";
  }

  // If any subject is pending/absent, overall is PENDING
  if (subjectResults.some((s) => s.isPass === null)) {
    return "PENDING";
  }

  // All subjects passed
  return "PASS";
}

/**
 * Assigns class ranks based on percentage scores.
 *
 * Rule per Freeze §13.4:
 * - Two students with identical percentage get the same rank
 * - Next rank is skipped (e.g., two students at rank 1, next is rank 3)
 */
export function assignClassRanks(
  students: Array<{ studentId: string; percentage: number | null }>,
): Map<string, number | null> {
  const ranks = new Map<string, number | null>();

  // Filter out null percentages (absent students don't get ranks)
  const withScores = students
    .filter((s) => s.percentage !== null)
    .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));

  let currentRank = 1;
  let previousPercentage: number | null = null;
  let sameRankCount = 0;

  for (const student of withScores) {
    if (student.percentage === previousPercentage) {
      // Same percentage as previous — same rank
      ranks.set(student.studentId, currentRank);
      sameRankCount++;
    } else {
      // Different percentage — new rank (skipping ties)
      currentRank += sameRankCount;
      ranks.set(student.studentId, currentRank);
      sameRankCount = 1;
      previousPercentage = student.percentage;
    }
  }

  // Set null rank for absent students
  for (const student of students) {
    if (student.percentage === null) {
      ranks.set(student.studentId, null);
    }
  }

  return ranks;
}
