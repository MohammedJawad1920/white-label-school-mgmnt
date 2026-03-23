/**
 * e2e/12-leave-polling.spec.ts
 *
 * E2E-012: Leave polling
 * Regression: On-campus list refreshes automatically every 30s (verify via network interception);
 * departure/return updates list in real time
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("E2E-012: Leave Polling", () => {
  test("On-campus list refreshes automatically every 30 seconds", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/leave/on-campus");

    // Track API calls
    const apiCalls: number[] = [];

    // Intercept leave/on-campus API calls
    await page.route("**/api/v1/leave/on-campus", async (route) => {
      apiCalls.push(Date.now());
      await route.continue();
    });

    // Wait for initial load
    await page.waitForLoadState("networkidle");
    const initialCallTime = apiCalls[apiCalls.length - 1];

    // Wait 30+ seconds to verify auto-refresh
    await page.waitForTimeout(31000);

    // Verify a new API call was made
    expect(apiCalls.length).toBeGreaterThan(1);

    // Verify the interval is approximately 30 seconds
    if (apiCalls.length >= 2) {
      const timeDiff = apiCalls[1] - apiCalls[0];
      expect(timeDiff).toBeGreaterThanOrEqual(29000); // Allow 1s margin
      expect(timeDiff).toBeLessThanOrEqual(31000);
    }
  });

  test("Marking student departed updates list immediately", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/leave");

    // Find a pending approved leave
    const leaveRow = page.locator('[data-status="APPROVED"]').first();

    if (await leaveRow.isVisible()) {
      const leaveId = await leaveRow.getAttribute("data-leave-id");

      // Click "Mark Departed"
      await leaveRow.locator('button:has-text("Mark Departed")').click();
      await page.waitForSelector("text=Student marked as departed");

      // Verify status updated to ACTIVE
      await expect(
        page.locator(`[data-leave-id="${leaveId}"][data-status="ACTIVE"]`),
      ).toBeVisible();

      // Navigate to on-campus list
      await page.goto("/admin/leave/on-campus");

      // Verify student no longer appears in on-campus list
      await expect(
        page.locator(`[data-leave-id="${leaveId}"]`),
      ).not.toBeVisible();
    }
  });

  test("Marking student returned updates list immediately", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/leave");

    // Find an active leave (student departed)
    const leaveRow = page.locator('[data-status="ACTIVE"]').first();

    if (await leaveRow.isVisible()) {
      const leaveId = await leaveRow.getAttribute("data-leave-id");
      const studentName = await leaveRow
        .locator('[data-field="studentName"]')
        .textContent();

      // Click "Mark Returned"
      await leaveRow.locator('button:has-text("Mark Returned")').click();
      await page.waitForSelector("text=Student marked as returned");

      // Verify status updated to COMPLETED
      await expect(
        page.locator(`[data-leave-id="${leaveId}"][data-status="COMPLETED"]`),
      ).toBeVisible();

      // Navigate to on-campus list
      await page.goto("/admin/leave/on-campus");

      // Verify student now appears back in on-campus list
      await expect(page.locator(`text=${studentName}`)).toBeVisible();
    }
  });

  test("Polling stops when user navigates away from page", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/leave/on-campus");

    const apiCalls: number[] = [];
    await page.route("**/api/v1/leave/on-campus", async (route) => {
      apiCalls.push(Date.now());
      await route.continue();
    });

    // Wait for initial load
    await page.waitForLoadState("networkidle");
    const callsBeforeNav = apiCalls.length;

    // Navigate away
    await page.goto("/admin/dashboard");

    // Wait 35 seconds
    await page.waitForTimeout(35000);

    // Verify no new calls were made after navigation
    expect(apiCalls.length).toBe(callsBeforeNav);
  });
});
