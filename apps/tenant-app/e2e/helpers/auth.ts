/**
 * e2e/helpers/auth.ts
 *
 * Authentication helpers for E2E tests.
 * Provides loginAs function to log in different user roles.
 */

import { Page } from "@playwright/test";

export async function loginAs(
  page: Page,
  role: "admin" | "teacher" | "guardian" | "student",
) {
  // Get credentials from environment
  let email: string;
  let password: string;
  let tenantId: string;

  switch (role) {
    case "admin":
      email = process.env.E2E_ADMIN_EMAIL || "";
      password = process.env.E2E_ADMIN_PASSWORD || "";
      break;
    case "teacher":
      email = process.env.E2E_TEACHER_EMAIL || "";
      password = process.env.E2E_TEACHER_PASSWORD || "";
      break;
    case "guardian":
      email = process.env.E2E_GUARDIAN_EMAIL || "";
      password = process.env.E2E_GUARDIAN_PASSWORD || "";
      break;
    case "student":
      email = process.env.E2E_STUDENT_EMAIL || "";
      password = process.env.E2E_STUDENT_PASSWORD || "";
      break;
    default:
      throw new Error(`Unknown role: ${role}`);
  }

  tenantId = process.env.E2E_TENANT_ID || "";

  if (!email || !password || !tenantId) {
    throw new Error(`Missing E2E credentials for role: ${role}`);
  }

  // Navigate to login page
  await page.goto("/login");

  // Fill in login form
  await page.fill("#email", email);
  await page.fill("#password", password);

  // Submit login
  await page.click('button:has-text("Sign in")');

  // First login for some seeded users (guardian/student) may force password change.
  if (page.url().includes("/change-password")) {
    const updatedPassword =
      role === "student" ? "Student@E2E456!" : "Guardian@E2E456!";
    await page.fill("#currentPassword", password);
    await page.fill("#newPassword", updatedPassword);
    await page.fill("#confirmNewPassword", updatedPassword);
    await page.click('button:has-text("Change Password")');

    if (role === "student") {
      process.env.E2E_STUDENT_PASSWORD = updatedPassword;
    }
    if (role === "guardian") {
      process.env.E2E_GUARDIAN_PASSWORD = updatedPassword;
    }
  }

  // Wait for navigation or dashboard to appear
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 20000,
  });

  console.log(`✅ Logged in as ${role}: ${email}`);
}

export async function logout(page: Page) {
  // Click user menu (usually top-right)
  await page.click('[data-testid="user-menu"] button');

  // Click logout
  await page.click('button:has-text("Logout")');

  // Wait for redirect to login
  await page.waitForURL((url) => url.pathname.includes("/login"));

  console.log("✅ Logged out");
}

export async function getCurrentUser(page: Page) {
  // This could read from localStorage or make an API call
  const raw = await page.evaluate(() => sessionStorage.getItem("auth_token"));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { token?: string };
    if (!parsed.token) return null;
    const payload = JSON.parse(atob(parsed.token.split(".")[1]!));
    return payload.user;
  } catch {
    return null;
  }
}
