/**
 * Unit tests: Grade Computation Utilities
 *
 * Tests for lookupGrade, calculateStudentGrade, calculateOverallResult, assignClassRanks.
 * Per Freeze v6.1 §13.4 mandatory test cases.
 */
import {
  lookupGrade,
  DEFAULT_GRADE_BOUNDARIES,
  isPassing,
  calculateStudentGrade,
  calculateOverallResult,
  assignClassRanks,
} from "../../src/utils/gradeComputation";

describe("lookupGrade", () => {
  describe("with default boundaries", () => {
    it("95% → A+ with default boundaries", () => {
      expect(lookupGrade(95)).toBe("A+");
    });

    it("exactly 90.00% → A+ (inclusive boundary)", () => {
      expect(lookupGrade(90)).toBe("A+");
    });

    it("exactly 89.99% → A (just below A+ threshold)", () => {
      expect(lookupGrade(89.99)).toBe("A");
    });

    it("exactly 89% → A (upper boundary of A)", () => {
      expect(lookupGrade(89)).toBe("A");
    });

    it("exactly 80% → A (lower boundary of A)", () => {
      expect(lookupGrade(80)).toBe("A");
    });

    it("79% → B+", () => {
      expect(lookupGrade(79)).toBe("B+");
    });

    it("exactly 0% → F", () => {
      expect(lookupGrade(0)).toBe("F");
    });

    it("29% → F (upper boundary of F)", () => {
      expect(lookupGrade(29)).toBe("F");
    });

    it("30% → D (just above F threshold)", () => {
      expect(lookupGrade(30)).toBe("D");
    });

    it("100% → A+ (maximum)", () => {
      expect(lookupGrade(100)).toBe("A+");
    });
  });

  describe("edge cases", () => {
    it("negative percentage → N/A", () => {
      expect(lookupGrade(-5)).toBe("N/A");
    });

    it("percentage > 100 → N/A", () => {
      expect(lookupGrade(105)).toBe("N/A");
    });

    it("empty boundaries array → N/A", () => {
      expect(lookupGrade(50, [])).toBe("N/A");
    });
  });
});

describe("isPassing", () => {
  it("returns true when marks >= passMarks", () => {
    expect(isPassing(40, 35)).toBe(true);
  });

  it("returns true when marks === passMarks", () => {
    expect(isPassing(35, 35)).toBe(true);
  });

  it("returns false when marks < passMarks", () => {
    expect(isPassing(34, 35)).toBe(false);
  });
});

describe("calculateStudentGrade", () => {
  it("absent student → grade AB, isPass null", () => {
    const result = calculateStudentGrade({
      marksObtained: 80,
      totalMarks: 100,
      passMarks: 35,
      isAbsent: true,
    });
    expect(result.grade).toBe("AB");
    expect(result.percentage).toBeNull();
    expect(result.isPass).toBeNull();
  });

  it("null marks → grade N/A, isPass null", () => {
    const result = calculateStudentGrade({
      marksObtained: null,
      totalMarks: 100,
      passMarks: 35,
      isAbsent: false,
    });
    expect(result.grade).toBe("N/A");
    expect(result.isPass).toBeNull();
  });

  it("marks < passMarks → grade F regardless of percentage", () => {
    // 34/100 = 34% which would be D, but failed by passMarks threshold
    const result = calculateStudentGrade({
      marksObtained: 34,
      totalMarks: 100,
      passMarks: 35,
      isAbsent: false,
    });
    expect(result.grade).toBe("F");
    expect(result.isPass).toBe(false);
    expect(result.percentage).toBe(34);
  });

  it("passing student gets correct grade from percentage", () => {
    const result = calculateStudentGrade({
      marksObtained: 85,
      totalMarks: 100,
      passMarks: 35,
      isAbsent: false,
    });
    expect(result.grade).toBe("A");
    expect(result.isPass).toBe(true);
    expect(result.percentage).toBe(85);
  });

  it("handles totalMarks = 0 gracefully", () => {
    const result = calculateStudentGrade({
      marksObtained: 0,
      totalMarks: 0,
      passMarks: 0,
      isAbsent: false,
    });
    expect(result.percentage).toBe(0);
  });
});

describe("calculateOverallResult", () => {
  it("all passed → PASS", () => {
    const results = [{ isPass: true }, { isPass: true }, { isPass: true }];
    expect(calculateOverallResult(results)).toBe("PASS");
  });

  it("any failed → FAIL (even if others passed)", () => {
    const results = [{ isPass: true }, { isPass: false }, { isPass: true }];
    expect(calculateOverallResult(results)).toBe("FAIL");
  });

  it("any null (absent) with all others passed → PENDING", () => {
    const results = [{ isPass: true }, { isPass: null }, { isPass: true }];
    expect(calculateOverallResult(results)).toBe("PENDING");
  });

  it("failed takes precedence over pending", () => {
    const results = [{ isPass: false }, { isPass: null }, { isPass: true }];
    expect(calculateOverallResult(results)).toBe("FAIL");
  });

  it("empty results → PASS (vacuously true)", () => {
    expect(calculateOverallResult([])).toBe("PASS");
  });
});

describe("assignClassRanks", () => {
  it("assigns ranks in descending percentage order", () => {
    const students = [
      { studentId: "a", percentage: 70 },
      { studentId: "b", percentage: 90 },
      { studentId: "c", percentage: 80 },
    ];
    const ranks = assignClassRanks(students);
    expect(ranks.get("b")).toBe(1); // 90% → rank 1
    expect(ranks.get("c")).toBe(2); // 80% → rank 2
    expect(ranks.get("a")).toBe(3); // 70% → rank 3
  });

  it("same percentage → same rank, next rank skipped", () => {
    const students = [
      { studentId: "a", percentage: 90 },
      { studentId: "b", percentage: 90 },
      { studentId: "c", percentage: 80 },
    ];
    const ranks = assignClassRanks(students);
    expect(ranks.get("a")).toBe(1); // tied for 1st
    expect(ranks.get("b")).toBe(1); // tied for 1st
    expect(ranks.get("c")).toBe(3); // rank 2 skipped
  });

  it("null percentage (absent) → null rank", () => {
    const students = [
      { studentId: "a", percentage: 90 },
      { studentId: "b", percentage: null },
    ];
    const ranks = assignClassRanks(students);
    expect(ranks.get("a")).toBe(1);
    expect(ranks.get("b")).toBeNull();
  });

  it("empty list → empty map", () => {
    const ranks = assignClassRanks([]);
    expect(ranks.size).toBe(0);
  });

  it("three-way tie for first", () => {
    const students = [
      { studentId: "a", percentage: 95 },
      { studentId: "b", percentage: 95 },
      { studentId: "c", percentage: 95 },
      { studentId: "d", percentage: 85 },
    ];
    const ranks = assignClassRanks(students);
    expect(ranks.get("a")).toBe(1);
    expect(ranks.get("b")).toBe(1);
    expect(ranks.get("c")).toBe(1);
    expect(ranks.get("d")).toBe(4); // ranks 2, 3 skipped
  });
});
