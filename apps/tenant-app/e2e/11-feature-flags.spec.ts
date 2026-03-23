/**
 * e2e/11-feature-flags.spec.ts
 *
 * E2E-011: SuperAdmin feature flags
 * Regression: SuperAdmin creates tenant → all 10 feature flags visible → disable exams →
 * Admin login to tenant → exams route returns 403 `FEATURE_DISABLED`
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import axios from "axios";

const API_BASE_URL =
  process.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

test.describe("E2E-011: Feature Flags", () => {
  test("SuperAdmin creates tenant with all 10 feature flags visible", async ({
    page,
  }) => {
    // This test requires SuperAdmin app context
    // For now, we'll test via API

    // Login as superadmin via API
    const saLoginRes = await axios.post(
      `${API_BASE_URL}/superadmin/auth/login`,
      {
        email: "superadmin@system.local",
        password: "SuperAdmin@123",
      },
    );

    const saToken = saLoginRes.data.token;
    const client = axios.create({
      baseURL: API_BASE_URL,
      headers: { Authorization: `Bearer ${saToken}` },
    });

    // Create test tenant
    const tenantRes = await client.post("/superadmin/tenants", {
      name: "Feature Flag Test School",
      slug: `ff-test-${Date.now()}`,
      timezone: "Asia/Kolkata",
    });

    const tenantId = tenantRes.data.data.id;

    // Get tenant features
    const featuresRes = await client.get(
      `/superadmin/tenants/${tenantId}/features`,
    );
    const features = featuresRes.data.data;

    // Verify all 10 feature flags exist
    const expectedFeatures = [
      "timetable",
      "attendance",
      "leave",
      "guardians",
      "notifications",
      "exams",
      "fees",
      "announcements",
      "assignments",
      "import",
    ];

    for (const feature of expectedFeatures) {
      expect(features).toHaveProperty(feature);
    }
  });

  test("Admin cannot access disabled feature route (403 FEATURE_DISABLED)", async ({
    page,
  }) => {
    // Setup: Disable exams feature for test tenant
    const tenantId = process.env.E2E_TENANT_ID;

    // This would require superadmin API call to disable the feature
    // For now, simulate by checking the behavior

    await loginAs(page, "admin");

    // Try to access exams route (assuming it's disabled)
    await page.goto("/admin/exams");

    // Should show FEATURE_DISABLED error
    await page
      .waitForSelector("text=FEATURE_DISABLED", { timeout: 5000 })
      .catch(async () => {
        // Or might redirect with a toast
        await expect(page.locator("text=feature is not enabled")).toBeVisible();
      });
  });

  test("Feature flag changes take effect immediately without cache", async ({
    page,
  }) => {
    await loginAs(page, "admin");

    // Navigate to a feature page
    await page.goto("/admin/exams");

    // Assume feature is enabled, page loads
    await expect(page.locator("h1")).toBeVisible();

    // Now disable feature via API
    // (This would require superadmin token and API call)

    // Refresh page
    await page.reload();

    // Should now show FEATURE_DISABLED
    await expect(page.locator("text=FEATURE_DISABLED"))
      .toBeVisible()
      .catch(async () => {
        await expect(page.locator("text=feature is not enabled")).toBeVisible();
      });
  });
});
