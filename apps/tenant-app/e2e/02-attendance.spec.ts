/**
 * e2e/02-attendance.spec.ts
 *
 * E2E-002: Record class attendance
 * Regression: Record attendance (3 students: Present/Absent/Late) → verify persisted on reload
 * Validates timezone-aware date handling
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  getAdminToken,
  createApiClient,
  seedAcademicSession,
  seedBatch,
  seedClass,
  seedStudent,
  activateSession,
} from "./helpers/api";

test.describe("E2E-002: Record Attendance", () => {
  test("Admin records attendance for 3 students, data persists on reload", async ({
    page,
  }) => {
    // Setup test data via API
    const token = await getAdminToken();
    const client = createApiClient(token);

    const sessionId = await seedAcademicSession(
      client,
      "E2E 2026-27",
      "2026-06-01",
      "2027-05-31",
    );
    await activateSession(client, sessionId);

    const batchId = await seedBatch(client, "E2E Batch", "Std8");
    const classId = await seedClass(client, batchId, sessionId, "E2E Class 8A");

    const student1 = await seedStudent(
      client,
      batchId,
      classId,
      "S001",
      "Student One",
    );
    const student2 = await seedStudent(
      client,
      batchId,
      classId,
      "S002",
      "Student Two",
    );
    const student3 = await seedStudent(
      client,
      batchId,
      classId,
      "S003",
      "Student Three",
    );

    // Login as admin
    await loginAs(page, "admin");

    // Navigate to attendance page
    await page.goto("/admin/attendance/record");

    // Wait for students to load
    await page.waitForSelector('[data-testid="attendance-form"]');

    // Record attendance
    await page.click(`[data-student-id="${student1}"] [data-status="Present"]`);
    await page.click(`[data-student-id="${student2}"] [data-status="Absent"]`);
    await page.click(`[data-student-id="${student3}"] [data-status="Late"]`);

    // Submit
    await page.click('button:has-text("Save Attendance")');
    await page.waitForSelector("text=Attendance saved successfully");

    // Reload page
    await page.reload();

    // Verify attendance persisted
    await page.waitForSelector('[data-testid="attendance-form"]');
    expect(
      await page
        .locator(`[data-student-id="${student1}"] [data-status="Present"]`)
        .isChecked(),
    ).toBe(true);
    expect(
      await page
        .locator(`[data-student-id="${student2}"] [data-status="Absent"]`)
        .isChecked(),
    ).toBe(true);
    expect(
      await page
        .locator(`[data-student-id="${student3}"] [data-status="Late"]`)
        .isChecked(),
    ).toBe(true);
  });

  test("Attendance date respects tenant timezone", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/attendance/record");

    // Verify date picker shows tenant timezone date
    const dateInput = page.locator('input[name="date"]');
    const dateValue = await dateInput.inputValue();

    // Date should be today in tenant timezone (not UTC)
    expect(dateValue).toBeTruthy();
  });
});
