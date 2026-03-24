/**
 * e2e/global-teardown.ts
 *
 * Cleans up test data after all E2E tests complete.
 * Hard-deletes the test tenant (CASCADE).
 */

import axios from "axios";

const API_BASE_URL =
  process.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
const SUPERADMIN_EMAIL =
  process.env.E2E_SUPERADMIN_EMAIL || "admin@platform.com";
const SUPERADMIN_PASSWORD =
  process.env.E2E_SUPERADMIN_PASSWORD || "SuperAdmin@123";

export default async function globalTeardown() {
  console.log("E2E Global Teardown: cleaning up test data...");

  try {
    const tenantId = process.env.E2E_TENANT_ID;

    if (!tenantId) {
      console.warn("E2E_TENANT_ID not found, skipping teardown");
      return;
    }

    const saLogin = await axios.post(`${API_BASE_URL}/super-admin/auth/login`, {
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
    });
    const saToken = saLogin.data.token as string;

    await axios.put(
      `${API_BASE_URL}/super-admin/tenants/${tenantId}/deactivate`,
      {},
      {
        headers: {
          Authorization: `Bearer ${saToken}`,
        },
      },
    );

    console.log(`Deactivated test tenant: ${tenantId}`);
  } catch (error) {
    console.error("E2E Global Teardown failed:", error);
    // Don't exit with error; teardown failures shouldn't block test completion
  }
}
