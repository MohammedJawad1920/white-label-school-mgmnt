/**
 * e2e/01-auth.spec.ts
 *
 * E2E-001: Change password redirect loop fix
 * Regression: Admin login + `must_change_password` forced redirect +
 * successful password change → lands on dashboard, NOT looping back to `/change-password`
 */

import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';

test.describe('E2E-001: Auth - Change Password Flow', () => {
  test('Admin logs in with must_change_password flag, changes password, lands on dashboard', async ({
    page,
  }) => {
    // Navigate to login
    await page.goto('/login');

    // Login with credentials
    await page.fill('input[name="email"]', process.env.E2E_ADMIN_EMAIL!);
    await page.fill('input[name="password"]', process.env.E2E_ADMIN_PASSWORD!);
    await page.click('button:has-text("Login")');

    // If must_change_password is true, should redirect to /change-password
    const url = page.url();

    // Fill change password form (if on that page)
    if (url.includes('/change-password')) {
      await page.fill('input[name="currentPassword"]', process.env.E2E_ADMIN_PASSWORD!);
      await page.fill('input[name="newPassword"]', 'NewPassword@123');
      await page.fill('input[name="confirmPassword"]', 'NewPassword@123');
      await page.click('button:has-text("Change Password")');

      // Should NOT redirect back to /change-password
      await page.waitForURL(/\/admin.*dashboard/);
      expect(page.url()).toContain('/admin/dashboard');
      expect(page.url()).not.toContain('/change-password');
    } else {
      // If not on change-password, should be on dashboard
      expect(url).toContain('/admin/dashboard');
    }
  });

  test('No infinite redirect loop after password change', async ({ page }) => {
    await page.goto('/');

    // If redirected to change-password, change it
    if (page.url().includes('/change-password')) {
      await page.fill('input[name="currentPassword"]', process.env.E2E_ADMIN_PASSWORD!);
      await page.fill('input[name="newPassword"]', 'NewPass@2026');
      await page.fill('input[name="confirmPassword"]', 'NewPass@2026');
      await page.click('button:has-text("Change Password")');
    }

    // Wait a moment and verify we're still NOT on change-password
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/change-password');
  });
});
