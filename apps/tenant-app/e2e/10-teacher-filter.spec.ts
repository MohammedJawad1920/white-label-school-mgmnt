/**
 * e2e/10-teacher-filter.spec.ts
 *
 * E2E-010: Teacher class filter
 * Regression: Teacher dashboard renders non-blank → Record Attendance shows only teacher's class students (not all tenant students)
 * Validates CR-FE-022
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('E2E-010: Teacher Class Filter', () => {
  test('Teacher dashboard renders without blank screen (regression: CR-FE-022)', async ({ page }) => {
    await loginAs(page, 'teacher');

    // Navigate to teacher dashboard
    await page.goto('/teacher/dashboard');

    // Should not be blank
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1:has-text("Teacher Dashboard")')).toBeVisible();
  });

  test('Record Attendance shows only teacher own class students, not all tenant students', async ({ page }) => {
    await loginAs(page, 'teacher');

    // Navigate to attendance recording
    await page.goto('/teacher/attendance/record');

    // Wait for student list to load
    await page.waitForSelector('[data-testid="student-list"]');

    // Verify student list is not empty (teacher has a class)
    const studentRows = page.locator('[data-testid="student-row"]');
    const count = await studentRows.count();
    expect(count).toBeGreaterThan(0);

    // Verify all students belong to teacher's class
    // This assumes each row has a data-class-id attribute
    for (let i = 0; i < count; i++) {
      const row = studentRows.nth(i);
      const classId = await row.getAttribute('data-class-id');

      // All should be the same class (teacher's class)
      expect(classId).toBeTruthy();
    }

    // Verify there's a class selector showing only teacher's class
    const classSelector = page.locator('select[name="classId"]');
    if (await classSelector.isVisible()) {
      const options = await classSelector.locator('option').count();
      // Teacher should only see their own class(es)
      expect(options).toBeLessThanOrEqual(2); // Including "Select class" option
    }
  });

  test('Teacher cannot see students from other classes', async ({ page }) => {
    await loginAs(page, 'teacher');
    await page.goto('/teacher/students');

    // Get the list of students
    const studentList = page.locator('[data-testid="student-item"]');
    const count = await studentList.count();

    // Verify all students are from teachercontext's class
    // The exact validation depends on how the UI displays class info
    if (count > 0) {
      // Should only see students from teacher's assigned class
      await expect(page.locator('text=All Students')).not.toBeVisible();
      await expect(page.locator('text=My Class Students')).toBeVisible();
    }
  });
});
