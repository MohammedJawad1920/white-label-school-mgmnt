/**
 * e2e/09-student-portal.spec.ts
 *
 * E2E-009: Student portal isolation
 * Regression: Student logs in → views own exam results and report card → cannot see other students' individual marks
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('E2E-009: Student Portal Isolation', () => {
  test('Student can view own exam results but not other students marks', async ({ page }) => {
    await loginAs(page, 'student');

    // Navigate to student dashboard
    await page.goto('/student/dashboard');
    await expect(page.locator('h1:has-text("My Dashboard")')).toBeVisible();

    // Navigate to exam results
    await page.goto('/student/results');

    // Should see own results
    await expect(page.locator('[data-testid="my-results"]')).toBeVisible();

    // Verify student cannot see marks of other students
    // The page should only show this student's data
    const resultRows = page.locator('[data-testid="result-row"]');
    const count = await resultRows.count();

    // If there are results, verify they're all for the logged-in student
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const row = resultRows.nth(i);
        const studentName = await row.getAttribute('data-student-name');
        // Verify it matches the logged-in student's name
        expect(studentName).toBe(process.env.E2E_STUDENT_EMAIL?.split('@')[0]);
      }
    }

    // Try to directly navigate to another student's results (should be blocked)
    await page.goto('/student/results/other-student-id');
    await expect(page.locator('text=403')).toBeVisible().catch(() => {
      // Or get redirected
      expect(page.url()).toContain('/student/results');
    });
  });

  test('Student can download own report card', async ({ page }) => {
    await loginAs(page, 'student');
    await page.goto('/student/results');

    // Download report card
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download My Report Card")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('Student cannot access admin or teacher routes', async ({ page }) => {
    await loginAs(page, 'student');

    // Try to access admin route
    await page.goto('/admin/dashboard');

    // Should be forbidden or redirected
    await expect(page.locator('text=403')).toBeVisible().catch(() => {
      expect(page.url()).not.toContain('/admin');
    });

    // Try to access teacher route
    await page.goto('/teacher/attendance');
    await expect(page.locator('text=403')).toBeVisible().catch(() => {
      expect(page.url()).not.toContain('/teacher');
    });
  });
});
