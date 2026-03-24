// @ts-nocheck
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("a11y critical paths", () => {
  test("login screen has no critical/serious axe violations", async ({
    page,
  }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(blocking).toEqual([]);
  });

  test("admin dashboard shell has no critical/serious axe violations", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(blocking).toEqual([]);
  });

  test("attendance record screen has no critical/serious axe violations", async ({
    page,
  }) => {
    await page.goto("/admin/attendance/record");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(blocking).toEqual([]);
  });

  test("leave queue screen has no critical/serious axe violations", async ({
    page,
  }) => {
    await page.goto("/teacher/leave");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(blocking).toEqual([]);
  });

  test("marks entry screen has no critical/serious axe violations", async ({
    page,
  }) => {
    await page.goto("/teacher/exams/marks");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(blocking).toEqual([]);
  });

  test("guardian attendance screen has no critical/serious axe violations", async ({
    page,
  }) => {
    await page.goto("/guardian/attendance");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(blocking).toEqual([]);
  });
});
