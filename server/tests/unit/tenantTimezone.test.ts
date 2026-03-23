/**
 * Unit tests: Tenant Timezone Utilities
 *
 * Tests for timezone-aware date validation.
 * Per Freeze v6.1 §13.4 mandatory test cases.
 */
import {
  getTodayInTimezone,
  getCurrentHourInTimezone,
  isDateInPast,
  isDateToday,
  isDateInFuture,
  validateAttendanceDate,
  isTargetHourInTimezone,
  formatInTenantTimezone,
} from "../../src/utils/tenantTimezone";

describe("getTodayInTimezone", () => {
  it("returns date in YYYY-MM-DD format", () => {
    const result = getTodayInTimezone("UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("respects timezone offset", () => {
    // At UTC 23:00 on 2026-03-20, it's already 2026-03-21 in Asia/Kolkata (UTC+5:30)
    const utcDate = new Date("2026-03-20T23:00:00Z");

    const utcToday = getTodayInTimezone("UTC", utcDate);
    const kolkataToday = getTodayInTimezone("Asia/Kolkata", utcDate);

    expect(utcToday).toBe("2026-03-20");
    expect(kolkataToday).toBe("2026-03-21"); // next day in IST
  });
});

describe("getCurrentHourInTimezone", () => {
  it("returns hour in HH format", () => {
    const result = getCurrentHourInTimezone("UTC");
    expect(result).toMatch(/^\d{2}$/);
  });

  it("respects timezone offset", () => {
    // UTC 18:30 = 00:00 IST (next day)
    const utcDate = new Date("2026-03-20T18:30:00Z");

    const utcHour = getCurrentHourInTimezone("UTC", utcDate);
    const kolkataHour = getCurrentHourInTimezone("Asia/Kolkata", utcDate);

    expect(utcHour).toBe("18");
    expect(kolkataHour).toBe("00"); // midnight in IST
  });
});

describe("isDateInPast", () => {
  it("returns true when date is before today in timezone", () => {
    const refDate = new Date("2026-03-20T12:00:00Z");
    expect(isDateInPast("2026-03-19", "UTC", refDate)).toBe(true);
  });

  it("returns false when date is today", () => {
    const refDate = new Date("2026-03-20T12:00:00Z");
    expect(isDateInPast("2026-03-20", "UTC", refDate)).toBe(false);
  });

  it("returns false when date is in future", () => {
    const refDate = new Date("2026-03-20T12:00:00Z");
    expect(isDateInPast("2026-03-21", "UTC", refDate)).toBe(false);
  });

  describe("timezone edge cases per Freeze §13.4", () => {
    it("Server UTC = 18:00, tenant TZ = Asia/Kolkata, local date = tomorrow → NOT in the past", () => {
      // 18:00 UTC = 23:30 IST (same day), so "tomorrow" in IST is valid future date
      const refDate = new Date("2026-03-20T18:00:00Z"); // 23:30 IST on Mar 20
      const tomorrowIST = "2026-03-21";

      expect(isDateInPast(tomorrowIST, "Asia/Kolkata", refDate)).toBe(false);
    });

    it("Server UTC = 20:31, tenant TZ = Asia/Kolkata, local time is 02:01 IST → 2026-03-20 IS in the past", () => {
      // 20:31 UTC = 02:01 IST (next day)
      // So in IST, it's now 2026-03-21 02:01
      // "2026-03-20" in IST is yesterday = in the past
      const refDate = new Date("2026-03-20T20:31:00Z"); // 02:01 IST on Mar 21
      const yesterdayIST = "2026-03-20";

      expect(isDateInPast(yesterdayIST, "Asia/Kolkata", refDate)).toBe(true);
    });
  });
});

describe("isDateToday", () => {
  it("returns true when date equals today in timezone", () => {
    const refDate = new Date("2026-03-20T12:00:00Z");
    expect(isDateToday("2026-03-20", "UTC", refDate)).toBe(true);
  });

  it("returns false when date is yesterday", () => {
    const refDate = new Date("2026-03-20T12:00:00Z");
    expect(isDateToday("2026-03-19", "UTC", refDate)).toBe(false);
  });

  it("handles timezone crossing midnight", () => {
    // 23:00 UTC on Mar 20 = 04:30 IST on Mar 21
    const refDate = new Date("2026-03-20T23:00:00Z");

    expect(isDateToday("2026-03-20", "UTC", refDate)).toBe(true);
    expect(isDateToday("2026-03-21", "Asia/Kolkata", refDate)).toBe(true);
  });
});

describe("isDateInFuture", () => {
  it("returns true when date is after today", () => {
    const refDate = new Date("2026-03-20T12:00:00Z");
    expect(isDateInFuture("2026-03-21", "UTC", refDate)).toBe(true);
  });

  it("returns false when date is today", () => {
    const refDate = new Date("2026-03-20T12:00:00Z");
    expect(isDateInFuture("2026-03-20", "UTC", refDate)).toBe(false);
  });
});

describe("validateAttendanceDate", () => {
  const refDate = new Date("2026-03-20T12:00:00Z");

  it("Admin bypasses guard regardless of date", () => {
    // Past date — admin can still modify
    const result = validateAttendanceDate("2026-03-15", "UTC", true, refDate);
    expect(result.isValid).toBe(true);
  });

  it("Teacher cannot backdate attendance", () => {
    const result = validateAttendanceDate("2026-03-19", "UTC", false, refDate);
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("BACKDATING_NOT_ALLOWED");
  });

  it("Teacher cannot future-date attendance", () => {
    const result = validateAttendanceDate("2026-03-21", "UTC", false, refDate);
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("FUTURE_DATE_NOT_ALLOWED");
  });

  it("Teacher can record today's attendance", () => {
    const result = validateAttendanceDate("2026-03-20", "UTC", false, refDate);
    expect(result.isValid).toBe(true);
  });

  it("uses tenant timezone for validation", () => {
    // 23:00 UTC on Mar 20 = next day in IST
    const lateUtc = new Date("2026-03-20T23:00:00Z");

    // Mar 20 in UTC is still today, but in IST it's yesterday
    const utcResult = validateAttendanceDate(
      "2026-03-20",
      "UTC",
      false,
      lateUtc,
    );
    const istResult = validateAttendanceDate(
      "2026-03-20",
      "Asia/Kolkata",
      false,
      lateUtc,
    );

    expect(utcResult.isValid).toBe(true); // Today in UTC
    expect(istResult.isValid).toBe(false); // Yesterday in IST
    expect(istResult.errorCode).toBe("BACKDATING_NOT_ALLOWED");
  });
});

describe("isTargetHourInTimezone", () => {
  it("returns true when current hour matches target", () => {
    const refDate = new Date("2026-03-20T09:30:00Z");
    expect(isTargetHourInTimezone("09", "UTC", refDate)).toBe(true);
  });

  it("returns false when hour does not match", () => {
    const refDate = new Date("2026-03-20T10:30:00Z");
    expect(isTargetHourInTimezone("09", "UTC", refDate)).toBe(false);
  });

  it("respects timezone for cron job scheduling", () => {
    // At 03:30 UTC, it's 09:00 IST
    const refDate = new Date("2026-03-20T03:30:00Z");

    expect(isTargetHourInTimezone("09", "Asia/Kolkata", refDate)).toBe(true);
    expect(isTargetHourInTimezone("09", "UTC", refDate)).toBe(false);
  });
});

describe("formatInTenantTimezone", () => {
  it("formats UTC date in tenant timezone", () => {
    const utcDate = new Date("2026-03-20T12:00:00Z");
    const result = formatInTenantTimezone(
      utcDate,
      "Asia/Kolkata",
      "yyyy-MM-dd HH:mm",
    );
    expect(result).toBe("2026-03-20 17:30"); // UTC+5:30
  });

  it("accepts ISO string input", () => {
    const result = formatInTenantTimezone(
      "2026-03-20T12:00:00Z",
      "UTC",
      "yyyy-MM-dd",
    );
    expect(result).toBe("2026-03-20");
  });

  it("defaults to UTC when timezone not provided", () => {
    const utcDate = new Date("2026-03-20T12:00:00Z");
    const result = formatInTenantTimezone(utcDate, undefined, "HH:mm");
    expect(result).toBe("12:00");
  });
});
