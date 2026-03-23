/**
 * e2e/04-exams.spec.ts
 *
 * E2E-004: Full exam lifecycle + PDF
 * Regression: create → add subjects → enter marks → publish → verify grade `F` for failed subject,
 * `AB` for absent, overall `FAIL` if any subject fails → download PDF report card
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("E2E-004: Exam Lifecycle", () => {
  test("Full exam lifecycle: create, enter marks, publish, verify grades, download PDF", async ({
    page,
  }) => {
    await loginAs(page, "admin");

    // Create exam
    await page.goto("/admin/exams/create");
    await page.fill('input[name="name"]', "E2E Midterm Exam");
    await page.fill('input[name="maxScore"]', "100");
    await page.click('button:has-text("Create Exam")');

    // Wait for exam to be created
    await page.waitForSelector("text=Exam created successfully");
    const examId = page.url().split("/").pop();

    // Add subjects
    await page.click('button:has-text("Add Subject")');
    await page.selectOption('select[name="subjectId"]', {
      label: "Mathematics",
    });
    await page.click('button:has-text("Add")');

    await page.click('button:has-text("Add Subject")');
    await page.selectOption('select[name="subjectId"]', { label: "English" });
    await page.click('button:has-text("Add")');

    // Navigate to marks entry
    await page.goto(`/admin/exams/${examId}/marks`);

    // Enter marks for students
    // Student 1: Math=85 (A), English=40 (F) → Overall FAIL
    await page.fill(
      '[data-student="student-1"][data-subject="math"] input',
      "85",
    );
    await page.fill(
      '[data-student="student-1"][data-subject="english"] input',
      "40",
    );

    // Student 2: Math=AB (absent), English=75 (C+) → Overall AB
    await page.check(
      '[data-student="student-2"][data-subject="math"] input[type="checkbox"][value="absent"]',
    );
    await page.fill(
      '[data-student="student-2"][data-subject="english"] input',
      "75",
    );

    // Save marks
    await page.click('button:has-text("Save Marks")');
    await page.waitForSelector("text=Marks saved");

    // Publish exam
    await page.goto(`/admin/exams/${examId}`);
    await page.click('button:has-text("Publish")');
    await page.waitForSelector("text=Exam published");

    // Verify grades
    await page.goto(`/admin/exams/${examId}/results`);

    // Student 1: Overall status should be FAIL (one subject failed)
    await expect(
      page.locator('[data-student="student-1"] [data-field="overallStatus"]'),
    ).toHaveText("FAIL");
    await expect(
      page.locator(
        '[data-student="student-1"][data-subject="math"] [data-field="grade"]',
      ),
    ).toHaveText("A");
    await expect(
      page.locator(
        '[data-student="student-1"][data-subject="english"] [data-field="grade"]',
      ),
    ).toHaveText("F");

    // Student 2: Has AB (absent)
    await expect(
      page.locator(
        '[data-student="student-2"][data-subject="math"] [data-field="grade"]',
      ),
    ).toHaveText("AB");

    // Download PDF report card
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("Download Report Card")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain(".pdf");
  });

  test("Cannot publish exam with incomplete marks", async ({ page }) => {
    await loginAs(page, "admin");

    // Create exam with subjects
    await page.goto("/admin/exams/create");
    await page.fill('input[name="name"]', "Incomplete Exam");
    await page.fill('input[name="maxScore"]', "100");
    await page.click('button:has-text("Create Exam")');

    const examId = page.url().split("/").pop();

    // Try to publish without entering marks
    await page.goto(`/admin/exams/${examId}`);
    await page.click('button:has-text("Publish")');

    // Should show error
    await expect(page.locator("text=MARKS_NOT_COMPLETE")).toBeVisible();
  });
});
