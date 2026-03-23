/**
 * Unit tests: Consecutive Streak Calculation
 *
 * Tests for calculateConsecutiveAbsences and related streak utilities.
 * Per Freeze v6.1 §13.4 mandatory test cases.
 */
import {
  calculateConsecutiveAbsences,
  calculateConsecutivePresence,
  shouldAlertAbsenceStreak,
  calculateStreaksForStudents,
} from "../../src/utils/streakCalculation";

describe("calculateConsecutiveAbsences", () => {
  it("3 consecutive Absent → streak = 3", () => {
    const records = [
      { status: "Absent" as const },
      { status: "Absent" as const },
      { status: "Absent" as const },
    ];
    expect(calculateConsecutiveAbsences(records)).toBe(3);
  });

  it("2 Absent + 1 Present (earlier) → streak = 2 (Present breaks streak going back)", () => {
    const records = [
      { status: "Absent" as const }, // most recent
      { status: "Absent" as const },
      { status: "Present" as const }, // breaks streak
      { status: "Absent" as const }, // not counted
    ];
    expect(calculateConsecutiveAbsences(records)).toBe(2);
  });

  it("Late breaks the streak", () => {
    const records = [
      { status: "Absent" as const },
      { status: "Late" as const }, // breaks streak
      { status: "Absent" as const },
    ];
    expect(calculateConsecutiveAbsences(records)).toBe(1);
  });

  it("Excused days do NOT break streak and are NOT counted in streak total", () => {
    const records = [
      { status: "Absent" as const },
      { status: "Excused" as const }, // skipped, doesn't break or add
      { status: "Absent" as const },
      { status: "Excused" as const }, // skipped
      { status: "Absent" as const },
    ];
    expect(calculateConsecutiveAbsences(records)).toBe(3);
  });

  it("0 records → streak = 0", () => {
    expect(calculateConsecutiveAbsences([])).toBe(0);
  });

  it("all Present → streak = 0", () => {
    const records = [
      { status: "Present" as const },
      { status: "Present" as const },
    ];
    expect(calculateConsecutiveAbsences(records)).toBe(0);
  });

  it("starts with Present then Absent → streak = 0", () => {
    const records = [
      { status: "Present" as const }, // most recent
      { status: "Absent" as const },
      { status: "Absent" as const },
    ];
    expect(calculateConsecutiveAbsences(records)).toBe(0);
  });

  it("only Excused → streak = 0 (no absences counted)", () => {
    const records = [
      { status: "Excused" as const },
      { status: "Excused" as const },
    ];
    expect(calculateConsecutiveAbsences(records)).toBe(0);
  });

  it("Absent, Excused, Present → streak = 1 (Present breaks after Excused)", () => {
    const records = [
      { status: "Absent" as const },
      { status: "Excused" as const },
      { status: "Present" as const }, // breaks streak
    ];
    expect(calculateConsecutiveAbsences(records)).toBe(1);
  });
});

describe("calculateConsecutivePresence", () => {
  it("3 consecutive Present → streak = 3", () => {
    const records = [
      { status: "Present" as const },
      { status: "Present" as const },
      { status: "Present" as const },
    ];
    expect(calculateConsecutivePresence(records)).toBe(3);
  });

  it("Late counts as present for presence streak", () => {
    const records = [
      { status: "Late" as const },
      { status: "Present" as const },
      { status: "Late" as const },
    ];
    expect(calculateConsecutivePresence(records)).toBe(3);
  });

  it("Absent breaks presence streak", () => {
    const records = [
      { status: "Present" as const },
      { status: "Absent" as const }, // breaks
      { status: "Present" as const },
    ];
    expect(calculateConsecutivePresence(records)).toBe(1);
  });
});

describe("shouldAlertAbsenceStreak", () => {
  it("returns true when streak >= threshold (default 3)", () => {
    const records = [
      { status: "Absent" as const },
      { status: "Absent" as const },
      { status: "Absent" as const },
    ];
    expect(shouldAlertAbsenceStreak(records)).toBe(true);
  });

  it("returns false when streak < threshold", () => {
    const records = [
      { status: "Absent" as const },
      { status: "Absent" as const },
    ];
    expect(shouldAlertAbsenceStreak(records)).toBe(false);
  });

  it("respects custom threshold", () => {
    const records = [
      { status: "Absent" as const },
      { status: "Absent" as const },
    ];
    expect(shouldAlertAbsenceStreak(records, 2)).toBe(true);
    expect(shouldAlertAbsenceStreak(records, 3)).toBe(false);
  });
});

describe("calculateStreaksForStudents", () => {
  it("calculates streak for each student independently", () => {
    const records = [
      { studentId: "s1", status: "Absent" as const, date: "2026-03-03" },
      { studentId: "s1", status: "Absent" as const, date: "2026-03-02" },
      { studentId: "s2", status: "Present" as const, date: "2026-03-03" },
      { studentId: "s2", status: "Absent" as const, date: "2026-03-02" },
    ];
    const streaks = calculateStreaksForStudents(records);
    expect(streaks.get("s1")).toBe(2); // 2 consecutive absences
    expect(streaks.get("s2")).toBe(0); // most recent is Present
  });

  it("handles empty input", () => {
    const streaks = calculateStreaksForStudents([]);
    expect(streaks.size).toBe(0);
  });

  it("sorts by date before calculating", () => {
    // Records provided out of order
    const records = [
      { studentId: "s1", status: "Absent" as const, date: "2026-03-01" },
      { studentId: "s1", status: "Present" as const, date: "2026-03-03" }, // most recent
      { studentId: "s1", status: "Absent" as const, date: "2026-03-02" },
    ];
    const streaks = calculateStreaksForStudents(records);
    expect(streaks.get("s1")).toBe(0); // Most recent is Present
  });
});
