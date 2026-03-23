/**
 * Unit tests: Leave State Machine
 *
 * Tests for leave status transitions.
 * Per Freeze v6.1 §13.4 mandatory test cases.
 */
import {
  isValidTransition,
  getTargetStatus,
  validateTransition,
  getAllowedActions,
  isTerminalState,
  canCancel,
  isOnLeave,
  type LeaveStatus,
  type LeaveAction,
} from "../../src/utils/leaveStateMachine";

describe("isValidTransition", () => {
  describe("PENDING transitions", () => {
    it("PENDING → approve is valid", () => {
      expect(isValidTransition("PENDING", "approve")).toBe(true);
    });

    it("PENDING → reject is valid", () => {
      expect(isValidTransition("PENDING", "reject")).toBe(true);
    });

    it("PENDING → cancel is valid", () => {
      expect(isValidTransition("PENDING", "cancel")).toBe(true);
    });

    it("PENDING → depart is invalid", () => {
      expect(isValidTransition("PENDING", "depart")).toBe(false);
    });

    it("PENDING → return is invalid", () => {
      expect(isValidTransition("PENDING", "return")).toBe(false);
    });
  });

  describe("APPROVED transitions", () => {
    it("APPROVED → depart is valid", () => {
      expect(isValidTransition("APPROVED", "depart")).toBe(true);
    });

    it("APPROVED → approve is invalid (already reviewed)", () => {
      expect(isValidTransition("APPROVED", "approve")).toBe(false);
    });

    it("APPROVED → return is invalid (must depart first)", () => {
      expect(isValidTransition("APPROVED", "return")).toBe(false);
    });
  });

  describe("ACTIVE transitions", () => {
    it("ACTIVE → return is valid", () => {
      expect(isValidTransition("ACTIVE", "return")).toBe(true);
    });

    it("ACTIVE → mark_overdue is valid", () => {
      expect(isValidTransition("ACTIVE", "mark_overdue")).toBe(true);
    });

    it("ACTIVE → depart is invalid (already departed)", () => {
      expect(isValidTransition("ACTIVE", "depart")).toBe(false);
    });
  });

  describe("OVERDUE transitions", () => {
    it("OVERDUE → return is valid", () => {
      expect(isValidTransition("OVERDUE", "return")).toBe(true);
    });

    it("OVERDUE → mark_overdue is invalid (already overdue)", () => {
      expect(isValidTransition("OVERDUE", "mark_overdue")).toBe(false);
    });
  });

  describe("terminal states", () => {
    it("REJECTED has no valid transitions", () => {
      const actions: LeaveAction[] = [
        "approve",
        "reject",
        "cancel",
        "depart",
        "return",
        "mark_overdue",
      ];
      actions.forEach((action) => {
        expect(isValidTransition("REJECTED", action)).toBe(false);
      });
    });

    it("CANCELLED has no valid transitions", () => {
      const actions: LeaveAction[] = [
        "approve",
        "reject",
        "cancel",
        "depart",
        "return",
        "mark_overdue",
      ];
      actions.forEach((action) => {
        expect(isValidTransition("CANCELLED", action)).toBe(false);
      });
    });

    it("COMPLETED has no valid transitions", () => {
      const actions: LeaveAction[] = [
        "approve",
        "reject",
        "cancel",
        "depart",
        "return",
        "mark_overdue",
      ];
      actions.forEach((action) => {
        expect(isValidTransition("COMPLETED", action)).toBe(false);
      });
    });
  });
});

describe("getTargetStatus", () => {
  it("approve → APPROVED", () => {
    expect(getTargetStatus("approve")).toBe("APPROVED");
  });

  it("reject → REJECTED", () => {
    expect(getTargetStatus("reject")).toBe("REJECTED");
  });

  it("cancel → CANCELLED", () => {
    expect(getTargetStatus("cancel")).toBe("CANCELLED");
  });

  it("depart → ACTIVE", () => {
    expect(getTargetStatus("depart")).toBe("ACTIVE");
  });

  it("return → COMPLETED", () => {
    expect(getTargetStatus("return")).toBe("COMPLETED");
  });

  it("mark_overdue → OVERDUE", () => {
    expect(getTargetStatus("mark_overdue")).toBe("OVERDUE");
  });
});

describe("validateTransition", () => {
  it("returns isValid: true with targetStatus for valid transition", () => {
    const result = validateTransition("PENDING", "approve");
    expect(result.isValid).toBe(true);
    expect(result.targetStatus).toBe("APPROVED");
    expect(result.errorCode).toBeUndefined();
  });

  it("returns LEAVE_ALREADY_REVIEWED when approving non-PENDING", () => {
    const result = validateTransition("APPROVED", "approve");
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("LEAVE_ALREADY_REVIEWED");
  });

  it("returns LEAVE_ALREADY_REVIEWED when rejecting non-PENDING", () => {
    const result = validateTransition("REJECTED", "reject");
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("LEAVE_ALREADY_REVIEWED");
  });

  it("returns LEAVE_NOT_APPROVED when departing non-APPROVED", () => {
    const result = validateTransition("PENDING", "depart");
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("LEAVE_NOT_APPROVED");
  });

  it("returns LEAVE_NOT_ACTIVE when returning from non-ACTIVE/OVERDUE", () => {
    const result = validateTransition("APPROVED", "return");
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("LEAVE_NOT_ACTIVE");
  });

  it("valid return from ACTIVE", () => {
    const result = validateTransition("ACTIVE", "return");
    expect(result.isValid).toBe(true);
    expect(result.targetStatus).toBe("COMPLETED");
  });

  it("valid return from OVERDUE", () => {
    const result = validateTransition("OVERDUE", "return");
    expect(result.isValid).toBe(true);
    expect(result.targetStatus).toBe("COMPLETED");
  });
});

describe("getAllowedActions", () => {
  it("PENDING allows approve, reject, cancel", () => {
    const actions = getAllowedActions("PENDING");
    expect(actions).toContain("approve");
    expect(actions).toContain("reject");
    expect(actions).toContain("cancel");
    expect(actions).toHaveLength(3);
  });

  it("APPROVED allows only depart", () => {
    const actions = getAllowedActions("APPROVED");
    expect(actions).toEqual(["depart"]);
  });

  it("terminal states return empty array", () => {
    expect(getAllowedActions("REJECTED")).toEqual([]);
    expect(getAllowedActions("CANCELLED")).toEqual([]);
    expect(getAllowedActions("COMPLETED")).toEqual([]);
  });
});

describe("isTerminalState", () => {
  it("REJECTED is terminal", () => {
    expect(isTerminalState("REJECTED")).toBe(true);
  });

  it("CANCELLED is terminal", () => {
    expect(isTerminalState("CANCELLED")).toBe(true);
  });

  it("COMPLETED is terminal", () => {
    expect(isTerminalState("COMPLETED")).toBe(true);
  });

  it("PENDING is not terminal", () => {
    expect(isTerminalState("PENDING")).toBe(false);
  });

  it("ACTIVE is not terminal", () => {
    expect(isTerminalState("ACTIVE")).toBe(false);
  });
});

describe("canCancel", () => {
  it("returns true for PENDING", () => {
    expect(canCancel("PENDING")).toBe(true);
  });

  it("returns false for all other statuses", () => {
    const statuses: LeaveStatus[] = [
      "APPROVED",
      "REJECTED",
      "CANCELLED",
      "ACTIVE",
      "OVERDUE",
      "COMPLETED",
    ];
    statuses.forEach((status) => {
      expect(canCancel(status)).toBe(false);
    });
  });
});

describe("isOnLeave", () => {
  it("returns true for ACTIVE", () => {
    expect(isOnLeave("ACTIVE")).toBe(true);
  });

  it("returns true for OVERDUE", () => {
    expect(isOnLeave("OVERDUE")).toBe(true);
  });

  it("returns false for other statuses", () => {
    const statuses: LeaveStatus[] = [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "CANCELLED",
      "COMPLETED",
    ];
    statuses.forEach((status) => {
      expect(isOnLeave(status)).toBe(false);
    });
  });
});
