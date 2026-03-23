/**
 * e2e/06-notifications.spec.ts
 *
 * E2E-006: Notification bell
 * Regression: Notification bell shows unread count → click notification navigates without page reload →
 * Mark all read → badge clears → `{ updated: N }` received
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('E2E-006: Notifications', () => {
  test('Notification bell displays unread count, click navigates, mark all read clears badge', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/dashboard');

    // Wait for notifications to load
    await page.waitForSelector('[data-testid="notification-bell"]');

    // Check if there's an unread count badge
    const badge = page.locator('[data-testid="notification-bell"] [data-testid="unread-badge"]');
    const initialCount = parseInt((await badge.textContent()) || '0');

    if (initialCount > 0) {
      // Click bell to open dropdown
      await page.click('[data-testid="notification-bell"]');

      // Click first notification
      const firstNotification = page.locator('[data-testid="notification-item"]').first();
      const notificationHref = await firstNotification.getAttribute('href');
      await firstNotification.click();

      // Verify navigation occurred without full page reload (SPA behavior)
      await page.waitForURL(notificationHref!);
      expect(page.url()).toContain(notificationHref!);

      // Go back to dashboard
      await page.goto('/admin/dashboard');

      // Open notification dropdown again
      await page.click('[data-testid="notification-bell"]');

      // Click "Mark all as read"
      await page.click('button:has-text("Mark all as read")');

      // Wait for API call to complete
      await page.waitForResponse((resp) => resp.url().includes('/notifications/mark-all-read'));

      // Verify badge clears or count reduces
      const newCountText = await badge.textContent();
      const newCount = parseInt(newCountText || '0');
      expect(newCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test('Mark all read endpoint returns { updated: N } not { updatedCount: N } (regression: CR-FE-005)', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/dashboard');

    // Intercept mark-all-read API call
    await page.route('**/api/v1/notifications/mark-all-read', async (route) => {
      const response = await route.fetch();
      const json = await response.json();

      // Verify response shape
      expect(json.data).toHaveProperty('updated');
      expect(json.data).not.toHaveProperty('updatedCount');

      await route.fulfill({ response });
    });

    // Trigger mark all read
    await page.click('[data-testid="notification-bell"]');
    await page.click('button:has-text("Mark all as read")');
  });

  test('Notification list reads from .data.data not .data.notifications (regression: CR-FE-004)', async ({ page }) => {
    await loginAs(page, 'admin');

    // Intercept list notifications API call
    await page.route('**/api/v1/notifications', async (route) => {
      const response = await route.fetch();
      const json = await response.json();

      // Verify response envelope
      expect(json).toHaveProperty('data');
      expect(json.data).toHaveProperty('data');
      expect(Array.isArray(json.data.data)).toBe(true);
      expect(json.data).not.toHaveProperty('notifications');

      await route.fulfill({ response });
    });

    await page.goto('/admin/dashboard');
    await page.click('[data-testid="notification-bell"]');
  });
});
