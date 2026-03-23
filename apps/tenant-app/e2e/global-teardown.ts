/**
 * e2e/global-teardown.ts
 *
 * Cleans up test data after all E2E tests complete.
 * Hard-deletes the test tenant (CASCADE).
 */

import axios from "axios";

const API_BASE_URL =
  process.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

export async function globalTeardown() {
  console.log("🧹 E2E Global Teardown: Cleaning up test data...");

  try {
    const tenantId = process.env.E2E_TENANT_ID;

    if (!tenantId) {
      console.warn("⚠️  E2E_TENANT_ID not found, skipping teardown");
      return;
    }

    // Login as superadmin or use a cleanup token to delete tenant
    // This assumes a superadmin-specific endpoint exists
    await axios.delete(`${API_BASE_URL}/superadmin/tenants/${tenantId}`);

    console.log(`✅ Test tenant deleted: ${tenantId}`);
  } catch (error) {
    console.error("❌ E2E Global Teardown failed:", error);
    // Don't exit with error; teardown failures shouldn't block test completion
  }
}
