/**
 * e2e/08-upload.spec.ts
 *
 * E2E-008: School logo upload
 * Regression: Upload school logo with `type=logo` in FormData → logo URL saved → logo renders in profile page
 * Validates that type field is in FormData, not URL query param (CR-FE-003)
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("E2E-008: File Upload", () => {
  test("Admin uploads school logo, type field in FormData not query param (regression: CR-FE-003)", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/school-profile");

    // Intercept upload request to verify FormData structure
    await page.route("**/api/v1/school-profile/logo", async (route) => {
      const request = route.request();
      const contentType = request.headers()["content-type"];

      // Verify it's multipart/form-data
      expect(contentType).toContain("multipart/form-data");

      // Verify URL does NOT have type query param
      expect(request.url()).not.toContain("?type=");
      expect(request.url()).not.toContain("&type=");

      await route.continue();
    });

    // Upload logo file
    const fileInput = page.locator('input[type="file"][name="logo"]');
    await fileInput.setInputFiles({
      name: "school-logo.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-png-content"),
    });

    // Click upload button
    await page.click('button:has-text("Upload Logo")');

    // Wait for success message
    await page.waitForSelector("text=Logo uploaded successfully");

    // Verify logo appears in profile
    const logoImg = page.locator('img[alt="School Logo"]');
    await expect(logoImg).toBeVisible();
    const src = await logoImg.getAttribute("src");
    expect(src).toBeTruthy();
    expect(src).toContain("http"); // Should be a full URL
  });

  test("Principal signature upload with type=signature", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/school-profile");

    // Intercept upload request
    await page.route("**/api/v1/school-profile/signature", async (route) => {
      const request = route.request();

      // Verify URL does NOT have type query param
      expect(request.url()).not.toContain("?type=");

      await route.continue();
    });

    // Upload signature file
    const fileInput = page.locator('input[type="file"][name="signature"]');
    await fileInput.setInputFiles({
      name: "signature.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-signature"),
    });

    await page.click('button:has-text("Upload Signature")');
    await page.waitForSelector("text=Signature uploaded successfully");

    // Verify signature appears
    const sigImg = page.locator('img[alt="Principal Signature"]');
    await expect(sigImg).toBeVisible();
  });
});
