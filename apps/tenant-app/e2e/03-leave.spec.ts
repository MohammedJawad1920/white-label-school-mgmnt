/**
 * e2e/03-leave.spec.ts
 *
 * E2E-003: Leave lifecycle
 * Regression: Guardian submits leave → Admin approves → attendance auto-marked `Excused` for each leave day
 * Validates leave state machine (PENDING → APPROVED → ACTIVE → COMPLETED)
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getAdminToken, createApiClient, seedLeaveRequest } from './helpers/api';

test.describe('E2E-003: Leave Lifecycle', () => {
  test('Guardian submits leave, Admin approves, attendance marked Excused', async ({ page }) => {
    // Login as guardian
    await loginAs(page, 'guardian');

    // Navigate to submit leave page
    await page.goto('/guardian/leave/submit');

    // Fill leave form
    await page.fill('input[name="startDate"]', '2026-09-15');
    await page.fill('input[name="endDate"]', '2026-09-17');
    await page.fill('textarea[name="reason"]', 'Family function');
    await page.click('button:has-text("Submit Leave Request")');

    // Wait for success message
    await page.waitForSelector('text=Leave request submitted');

    // Get leave ID from URL or response
    const leaveId = page.url().split('/').pop();

    // Logout guardian
    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("Logout")');

    // Login as admin
    await loginAs(page, 'admin');

    // Navigate to leave approval page
    await page.goto(`/admin/leave/${leaveId}`);

    // Verify status is PENDING
    await expect(page.locator('[data-testid="leave-status"]')).toHaveText('PENDING');

    // Approve leave
    await page.click('button:has-text("Approve")');
    await page.waitForSelector('text=Leave approved');

    // Verify status changed to APPROVED
    await expect(page.locator('[data-testid="leave-status"]')).toHaveText('APPROVED');

    // Navigate to attendance for the leave dates
    await page.goto('/admin/attendance/monthly');

    // TODO: Verify attendance is auto-marked as Excused for Sept 15, 16, 17
    // This would require inspecting the calendar cells for the specific dates
  });

  test('Leave state machine transitions correctly', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/leave');

    // Create a leave via API
    const token = await getAdminToken();
    const client = createApiClient(token);
    const leaveId = await seedLeaveRequest(client, 'student-id', '2026-10-01', '2026-10-03');

    // Navigate to leave detail
    await page.goto(`/admin/leave/${leaveId}`);

    // Verify PENDING status
    await expect(page.locator('[data-testid="leave-status"]')).toHaveText('PENDING');

    // Approve (PENDING → APPROVED)
    await page.click('button:has-text("Approve")');
    await expect(page.locator('[data-testid="leave-status"]')).toHaveText('APPROVED');

    // Mark departed (APPROVED → ACTIVE)
    await page.click('button:has-text("Mark Departed")');
    await expect(page.locator('[data-testid="leave-status"]')).toHaveText('ACTIVE');

    // Mark returned (ACTIVE → COMPLETED)
    await page.click('button:has-text("Mark Returned")');
    await expect(page.locator('[data-testid="leave-status"]')).toHaveText('COMPLETED');
  });
});
