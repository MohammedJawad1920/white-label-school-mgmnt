/**
 * Unit tests: Fee Balance Calculation
 *
 * Tests for calculateBalance, isOverpayment, getPaymentStatus, etc.
 * Per Freeze v6.1 §13.4 mandatory test cases.
 */
import {
  calculateBalance,
  isOverpayment,
  getPaymentStatus,
  calculateFeeSummary,
  validatePaymentAmount,
} from "../../src/utils/feeBalance";

describe("calculateBalance", () => {
  it("zero payments → balance = amount", () => {
    expect(calculateBalance(1000, 0)).toBe(1000);
  });

  it("partial payments → balance = amount - totalPaid", () => {
    expect(calculateBalance(1000, 300)).toBe(700);
  });

  it("full payment → balance = 0", () => {
    expect(calculateBalance(1000, 1000)).toBe(0);
  });

  it("handles null totalPaid as 0", () => {
    expect(calculateBalance(500, null)).toBe(500);
  });

  it("handles undefined totalPaid as 0", () => {
    expect(calculateBalance(500, undefined)).toBe(500);
  });

  it("handles string amount from DB", () => {
    expect(calculateBalance("1000.50", "300.25")).toBe(700.25);
  });

  it("handles overpayment (negative balance)", () => {
    expect(calculateBalance(500, 600)).toBe(-100);
  });
});

describe("isOverpayment", () => {
  it("returns false when payment <= balance", () => {
    expect(isOverpayment(1000, 300, 700)).toBe(false);
    expect(isOverpayment(1000, 300, 500)).toBe(false);
  });

  it("returns true when payment > balance", () => {
    expect(isOverpayment(1000, 300, 800)).toBe(true);
  });

  it("returns true for any payment on fully paid charge", () => {
    expect(isOverpayment(1000, 1000, 1)).toBe(true);
  });

  it("returns false for exact remaining balance", () => {
    expect(isOverpayment(1000, 500, 500)).toBe(false);
  });
});

describe("getPaymentStatus", () => {
  it("returns UNPAID when totalPaid = 0", () => {
    expect(getPaymentStatus(1000, 0)).toBe("UNPAID");
  });

  it("returns UNPAID when totalPaid is negative", () => {
    expect(getPaymentStatus(1000, -50)).toBe("UNPAID");
  });

  it("returns PARTIAL when 0 < totalPaid < amount", () => {
    expect(getPaymentStatus(1000, 500)).toBe("PARTIAL");
    expect(getPaymentStatus(1000, 1)).toBe("PARTIAL");
    expect(getPaymentStatus(1000, 999)).toBe("PARTIAL");
  });

  it("returns PAID when totalPaid === amount", () => {
    expect(getPaymentStatus(1000, 1000)).toBe("PAID");
  });

  it("returns OVERPAID when totalPaid > amount", () => {
    expect(getPaymentStatus(1000, 1001)).toBe("OVERPAID");
  });
});

describe("calculateFeeSummary", () => {
  it("calculates totals correctly", () => {
    const charges = [
      { amount: 1000, totalPaid: 1000 }, // PAID
      { amount: 500, totalPaid: 200 }, // PARTIAL
      { amount: 300, totalPaid: 0 }, // UNPAID
    ];
    const summary = calculateFeeSummary(charges);

    expect(summary.totalCharges).toBe(1800);
    expect(summary.totalPaid).toBe(1200);
    expect(summary.totalOutstanding).toBe(600);
    expect(summary.chargeCount).toBe(3);
    expect(summary.paidCount).toBe(1);
    expect(summary.partialCount).toBe(1);
    expect(summary.unpaidCount).toBe(1);
  });

  it("handles empty charges", () => {
    const summary = calculateFeeSummary([]);
    expect(summary.totalCharges).toBe(0);
    expect(summary.totalPaid).toBe(0);
    expect(summary.totalOutstanding).toBe(0);
    expect(summary.chargeCount).toBe(0);
  });

  it("counts overpaid as paid", () => {
    const charges = [{ amount: 500, totalPaid: 600 }];
    const summary = calculateFeeSummary(charges);
    expect(summary.paidCount).toBe(1);
  });
});

describe("validatePaymentAmount", () => {
  it("returns valid for positive number", () => {
    const result = validatePaymentAmount(100);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns valid for positive string number", () => {
    const result = validatePaymentAmount("50.5");
    expect(result.isValid).toBe(true);
  });

  it("returns error for null", () => {
    const result = validatePaymentAmount(null);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Payment amount is required");
  });

  it("returns error for undefined", () => {
    const result = validatePaymentAmount(undefined);
    expect(result.isValid).toBe(false);
  });

  it("returns error for zero", () => {
    const result = validatePaymentAmount(0);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Payment amount must be positive");
  });

  it("returns error for negative", () => {
    const result = validatePaymentAmount(-50);
    expect(result.isValid).toBe(false);
  });

  it("returns error for NaN string", () => {
    const result = validatePaymentAmount("abc");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Payment amount must be a number");
  });
});
