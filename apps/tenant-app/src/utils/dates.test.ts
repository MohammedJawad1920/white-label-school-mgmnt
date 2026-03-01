import { describe, it, expect } from "vitest";
import {
  todayISO,
  formatDisplayDate,
  formatDisplayDateTime,
  todayDayOfWeek,
  formatMonth,
} from "@/utils/dates";

describe("todayISO", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatDisplayDate", () => {
  it("formats a valid ISO date to EEE, d MMM yyyy", () => {
    // 2024-01-15 is a Monday
    expect(formatDisplayDate("2024-01-15")).toBe("Mon, 15 Jan 2024");
  });

  it("returns the raw string for invalid input", () => {
    expect(formatDisplayDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatDisplayDateTime", () => {
  it("formats a valid ISO datetime", () => {
    const result = formatDisplayDateTime("2024-06-15T14:30:00Z");
    // Contains date and time parts
    expect(result).toContain("Jun");
    expect(result).toContain("2024");
  });

  it("returns raw string for invalid input", () => {
    expect(formatDisplayDateTime("nope")).toBe("nope");
  });
});

describe("todayDayOfWeek", () => {
  it("returns a full day name", () => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    expect(days).toContain(todayDayOfWeek());
  });
});

describe("formatMonth", () => {
  it("formats YYYY-MM to MMM yyyy", () => {
    expect(formatMonth("2024-03")).toBe("Mar 2024");
    expect(formatMonth("2024-12")).toBe("Dec 2024");
  });

  it("returns raw string for invalid input", () => {
    expect(formatMonth("invalid")).toBe("invalid");
  });
});
