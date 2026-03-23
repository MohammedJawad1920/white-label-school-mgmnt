/**
 * Fee Balance Calculation Utilities
 *
 * Pure functions for fee/payment calculations.
 * Extracted for unit testability per Freeze v6.1 §13.4.
 */

/**
 * Calculates the outstanding balance for a fee charge.
 *
 * @param amount - The total charge amount
 * @param totalPaid - The sum of all payments made (can be string from SQL)
 * @returns The remaining balance (amount - totalPaid)
 */
export function calculateBalance(
  amount: number | string,
  totalPaid: number | string | null | undefined,
): number {
  const amountNum = typeof amount === "string" ? parseFloat(amount) : amount;
  const paidNum = parseFloat(String(totalPaid ?? "0")) || 0;
  return amountNum - paidNum;
}

/**
 * Determines if a payment would result in an overpayment.
 *
 * @param chargeAmount - The total charge amount
 * @param totalPaidSoFar - Sum of existing payments
 * @param newPaymentAmount - The new payment being recorded
 * @returns true if the new payment would exceed the balance
 */
export function isOverpayment(
  chargeAmount: number,
  totalPaidSoFar: number,
  newPaymentAmount: number,
): boolean {
  const balance = calculateBalance(chargeAmount, totalPaidSoFar);
  return newPaymentAmount > balance;
}

/**
 * Calculates the payment status of a charge.
 *
 * @param amount - The total charge amount
 * @param totalPaid - The sum of all payments
 * @returns Status: "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID"
 */
export function getPaymentStatus(
  amount: number,
  totalPaid: number,
): "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID" {
  if (totalPaid <= 0) {
    return "UNPAID";
  }
  if (totalPaid < amount) {
    return "PARTIAL";
  }
  if (totalPaid === amount) {
    return "PAID";
  }
  return "OVERPAID";
}

/**
 * Calculates summary statistics for multiple fee charges.
 *
 * @param charges - Array of charge records with amount and totalPaid
 * @returns Summary with totals
 */
export function calculateFeeSummary(
  charges: Array<{ amount: number; totalPaid: number }>,
): {
  totalCharges: number;
  totalPaid: number;
  totalOutstanding: number;
  chargeCount: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
} {
  let totalCharges = 0;
  let totalPaid = 0;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;

  for (const charge of charges) {
    totalCharges += charge.amount;
    totalPaid += charge.totalPaid;

    const status = getPaymentStatus(charge.amount, charge.totalPaid);
    if (status === "PAID" || status === "OVERPAID") {
      paidCount++;
    } else if (status === "PARTIAL") {
      partialCount++;
    } else {
      unpaidCount++;
    }
  }

  return {
    totalCharges,
    totalPaid,
    totalOutstanding: totalCharges - totalPaid,
    chargeCount: charges.length,
    paidCount,
    partialCount,
    unpaidCount,
  };
}

/**
 * Validates a payment amount.
 *
 * @param amount - The payment amount to validate
 * @returns Object with isValid and error message if invalid
 */
export function validatePaymentAmount(amount: unknown): {
  isValid: boolean;
  error?: string;
} {
  if (amount === undefined || amount === null) {
    return { isValid: false, error: "Payment amount is required" };
  }

  const num = typeof amount === "string" ? parseFloat(amount) : Number(amount);

  if (isNaN(num)) {
    return { isValid: false, error: "Payment amount must be a number" };
  }

  if (num <= 0) {
    return { isValid: false, error: "Payment amount must be positive" };
  }

  return { isValid: true };
}
