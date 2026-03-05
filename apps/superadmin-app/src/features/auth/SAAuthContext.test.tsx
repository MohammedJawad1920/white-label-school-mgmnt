/**
 * Unit tests: SAAuthContext (SuperAdmin session state)
 *
 * Freeze §State Management KEY REQUIREMENT:
 *   "SuperAdmin portal must stay isolated — separate auth storage key ('sa-auth').
 *    Never mix tokens with tenant app ('auth' key)."
 *
 * Tests verify:
 *   - Correct localStorage key isolation: 'sa_auth', NOT 'auth'
 *   - login() stores token + superAdmin under 'sa_auth'
 *   - logout() removes 'sa_auth' (tenant 'auth' key untouched)
 *   - No cross-contamination between the two storage keys
 *   - isAuthenticated reflects localStorage state on mount
 */
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { SAAuthProvider } from "@/features/auth/SAAuthContext";
import { useSAAuth } from "@/features/auth/SAAuthContext";
import * as superAdminAuthApiModule from "@/api/superAdminAuth";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const SA_AUTH_KEY = "sa-auth";
const TENANT_AUTH_KEY = "auth";

const MOCK_TOKEN = "test-super-admin-jwt-token";
const MOCK_SA = { id: "SA-test-1", name: "Test SA", email: "sa@test.com" };

function wrapper({ children }: { children: React.ReactNode }) {
  return <SAAuthProvider>{children}</SAAuthProvider>;
}

describe("SAAuthContext — localStorage key isolation (Freeze §FE Phase 7)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("login() writes to 'sa_auth' key (not 'auth')", () => {
    const { result } = renderHook(() => useSAAuth(), { wrapper });

    act(() => result.current.login(MOCK_TOKEN, MOCK_SA));

    // SuperAdmin token must be under 'sa_auth'
    expect(localStorage.getItem(SA_AUTH_KEY)).not.toBeNull();
    const stored = JSON.parse(localStorage.getItem(SA_AUTH_KEY)!);
    expect(stored.token).toBe(MOCK_TOKEN);
    expect(stored.superAdmin.email).toBe(MOCK_SA.email);
  });

  it("login() does NOT write to tenant 'auth' key", () => {
    const { result } = renderHook(() => useSAAuth(), { wrapper });

    act(() => result.current.login(MOCK_TOKEN, MOCK_SA));

    // Tenant auth key must remain empty
    expect(localStorage.getItem(TENANT_AUTH_KEY)).toBeNull();
  });

  it("logout() removes 'sa_auth' key", async () => {
    vi.spyOn(
      superAdminAuthApiModule.superAdminAuthApi,
      "logout",
    ).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSAAuth(), { wrapper });
    act(() => result.current.login(MOCK_TOKEN, MOCK_SA));
    expect(localStorage.getItem(SA_AUTH_KEY)).not.toBeNull();

    await act(async () => result.current.logout());
    expect(localStorage.getItem(SA_AUTH_KEY)).toBeNull();
  });

  it("logout() does NOT touch tenant 'auth' key", async () => {
    vi.spyOn(
      superAdminAuthApiModule.superAdminAuthApi,
      "logout",
    ).mockResolvedValue(undefined);

    // Simulate tenant app having its own session
    localStorage.setItem(
      TENANT_AUTH_KEY,
      JSON.stringify({ token: "tenant-tok" }),
    );

    const { result } = renderHook(() => useSAAuth(), { wrapper });
    act(() => result.current.login(MOCK_TOKEN, MOCK_SA));
    await act(async () => result.current.logout());

    // Tenant session must be completely untouched
    expect(localStorage.getItem(TENANT_AUTH_KEY)).not.toBeNull();
  });

  it("isAuthenticated is true when 'sa_auth' is pre-populated in localStorage", () => {
    localStorage.setItem(
      SA_AUTH_KEY,
      JSON.stringify({ token: MOCK_TOKEN, superAdmin: MOCK_SA }),
    );

    const { result } = renderHook(() => useSAAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.superAdmin?.email).toBe(MOCK_SA.email);
  });

  it("isAuthenticated is false on empty localStorage", () => {
    const { result } = renderHook(() => useSAAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.superAdmin).toBeNull();
    expect(result.current.token).toBeNull();
  });
});
