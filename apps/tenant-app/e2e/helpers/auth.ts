/**
 * e2e/helpers/auth.ts
 *
 * Authentication helpers for E2E tests.
 * Provides loginAs function to log in different user roles.
 */

import { Page } from '@playwright/test';

export async function loginAs(
  page: Page,
  role: 'admin' | 'teacher' | 'guardian' | 'student',
) {
  // Get credentials from environment
  let email: string;
  let password: string;
  let tenantId: string;

  switch (role) {
    case 'admin':
      email = process.env.E2E_ADMIN_EMAIL || '';
      password = process.env.E2E_ADMIN_PASSWORD || '';
      break;
    case 'teacher':
      email = process.env.E2E_TEACHER_EMAIL || '';
      password = process.env.E2E_TEACHER_PASSWORD || '';
      break;
    case 'guardian':
      email = process.env.E2E_GUARDIAN_EMAIL || '';
      password = process.env.E2E_GUARDIAN_PASSWORD || '';
      break;
    case 'student':
      email = process.env.E2E_STUDENT_EMAIL || '';
      password = process.env.E2E_STUDENT_PASSWORD || '';
      break;
    default:
      throw new Error(`Unknown role: ${role}`);
  }

  tenantId = process.env.E2E_TENANT_ID || '';

  if (!email || !password || !tenantId) {
    throw new Error(`Missing E2E credentials for role: ${role}`);
  }

  // Navigate to login page
  await page.goto('/login');

  // Fill in login form
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  // Optional: tenant selection if multi-tenant UI
  if (page.locator('input[name="tenantId"]').isVisible()) {
    await page.fill('input[name="tenantId"]', tenantId);
  }

  // Submit login
  await page.click('button:has-text("Login")');

  // Wait for navigation or dashboard to appear
  await page.waitForURL((url) => !url.pathname.includes('/login'));

  console.log(`✅ Logged in as ${role}: ${email}`);
}

export async function logout(page: Page) {
  // Click user menu (usually top-right)
  await page.click('[data-testid="user-menu"] button');

  // Click logout
  await page.click('button:has-text("Logout")');

  // Wait for redirect to login
  await page.waitForURL((url) => url.pathname.includes('/login'));

  console.log('✅ Logged out');
}

export async function getCurrentUser(page: Page) {
  // This could read from localStorage or make an API call
  const tokenStr = await page.evaluate(() => sessionStorage.getItem('auth-token'));

  if (!tokenStr) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(tokenStr.split('.')[1]));
    return payload.user;
  } catch {
    return null;
  }
}
