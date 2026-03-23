/**
 * e2e/05-fees.spec.ts
 *
 * E2E-005: Fee charge + payment
 * Regression: Raise fee charge → record payment with `{ amountPaid, paidAt }` → balance reduces → Guardian sees updated balance
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getAdminToken, createApiClient, createFeeCharge, recordPayment } from './helpers/api';

test.describe('E2E-005: Fees and Payments', () => {
  test('Admin raises fee charge, records payment, Guardian sees updated balance', async ({ page }) => {
    // Setup via API
    const token = await getAdminToken();
    const client = createApiClient(token);
    const chargeId = await createFeeCharge(client, 'student-id', 5000, '2026-09-30');

    // Login as admin
    await loginAs(page, 'admin');

    // Navigate to fees
    await page.goto('/admin/fees');

    // Verify charge exists
    await expect(page.locator(`[data-charge-id="${chargeId}"]`)).toBeVisible();
    await expect(page.locator(`[data-charge-id="${chargeId}"] [data-field="amount"]`)).toHaveText('5000');
    await expect(page.locator(`[data-charge-id="${chargeId}"] [data-field="balance"]`)).toHaveText('5000');

    // Record payment
    await page.click(`[data-charge-id="${chargeId}"] button:has-text("Record Payment")`);
    await page.fill('input[name="amountPaid"]', '3000');
    await page.fill('input[name="paidAt"]', '2026-09-15T10:00');
    await page.selectOption('select[name="method"]', 'cash');
    await page.click('button:has-text("Save Payment")');

    // Wait for success
    await page.waitForSelector('text=Payment recorded');

    // Verify balance updated
    await expect(page.locator(`[data-charge-id="${chargeId}"] [data-field="balance"]`)).toHaveText('2000');

    // Logout and login as guardian
    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("Logout")');

    await loginAs(page, 'guardian');

    // Navigate to child fees
    await page.goto('/guardian/child/fees');

    // Verify guardian sees updated balance
    await expect(page.locator(`[data-charge-id="${chargeId}"] [data-field="balance"]`)).toHaveText('2000');
  });

  test('Payment request includes amountPaid and paidAt fields (regression: CR-FE-006)', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/fees');

    // Intercept POST request to verify payload
    await page.route('**/api/v1/fees/charges/*/payment', async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();

      // Verify correct fields are present
      expect(postData).toHaveProperty('amountPaid');
      expect(postData).toHaveProperty('paidAt');
      expect(postData).not.toHaveProperty('amount');

      await route.continue();
    });

    // Record a payment
    await page.click('button:has-text("Record Payment")');
    await page.fill('input[name="amountPaid"]', '1000');
    await page.fill('input[name="paidAt"]', '2026-09-20T14:00');
    await page.click('button:has-text("Save Payment")');
  });

  test('Overpayment guard prevents recording more than outstanding balance', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/fees');

    // Try to record payment greater than balance
    await page.click('button:has-text("Record Payment")');
    await page.fill('input[name="amountPaid"]', '99999');
    await page.click('button:has-text("Save Payment")');

    // Should show OVERPAYMENT error
    await expect(page.locator('text=OVERPAYMENT')).toBeVisible();
  });
});
