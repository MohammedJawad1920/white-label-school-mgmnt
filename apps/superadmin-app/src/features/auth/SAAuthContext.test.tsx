/**
 * Unit tests: SAAuthContext (SuperAdmin session state)
 *
 * Freeze §State Management KEY REQUIREMENT (v3.1 / CR-FE-029):
 *   "SuperAdmin portal must stay isolated — separate auth storage key ('sa-auth').
 *    Never mix tokens with tenant app ('auth_token' key).
 *    localStorage is forbidden for token storage — both apps use sessionStorage."
 *
 * Tests verify:
 *   - Correct sessionStorage key isolation: 'sa-auth', NOT 'auth_token'
 *   - login() stores token + superAdmin under 'sa-auth' in sessionStorage
 *   - logout() removes 'sa-auth' (tenant 'auth_token' key untouched)
 *   - No cross-contamination between the two storage keys
 *   - isAuthenticated reflects sessionStorage state on mount
 */
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { SAAuthProvider } from "@/features/auth/SAAuthContext";
import { useSAAuth } from "@/features/auth/SAAuthContext";
import * as superAdminAuthApiModule from "@/api/superAdminAuth";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const SA_AUTH_KEY = "sa-auth";
const TENANT_AUTH_KEY = "auth_token";

const MOCK_TOKEN = "test-super-admin-jwt-token";
const MOCK_SA = { id: "SA-test-1", name: "Test SA", email: "sa@test.com" };

function wrapper({ children }: { children: React.ReactNode }) {
  return <SAAuthProvider>{children}</SAAuthProvider>;
}

describe("SAAuthContext — sessionStorage key isolation (Freeze §8.1 / CR-FE-029)", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("login() writes to 'sa-auth' key in sessionStorage (not 'auth_token')", () => {
    const { result } = renderHook(() => useSAAuth(), { wrapper });

    act(() => result.current.login(MOCK_TOKEN, MOCK_SA));

    // SuperAdmin token must be under 'sa-auth' in sessionStorage
    expect(sessionStorage.getItem(SA_AUTH_KEY)).not.toBeNull();
    const stored = JSON.parse(sessionStorage.getItem(SA_AUTH_KEY)!);
    expect(stored.token).toBe(MOCK_TOKEN);
    expect(stored.superAdmin.email).toBe(MOCK_SA.email);
  });

  it("login() does NOT write to tenant 'auth_token' key", () => {
    const { result } = renderHook(() => useSAAuth(), { wrapper });

    act(() => result.current.login(MOCK_TOKEN, MOCK_SA));

    // Tenant auth key must remain empty
    expect(sessionStorage.getItem(TENANT_AUTH_KEY)).toBeNull();
  });

  it("logout() removes 'sa-auth' from sessionStorage", async () => {
    vi.spyOn(
      superAdminAuthApiModule.superAdminAuthApi,
      "logout",
    ).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSAAuth(), { wrapper });
    act(() => result.current.login(MOCK_TOKEN, MOCK_SA));
    expect(sessionStorage.getItem(SA_AUTH_KEY)).not.toBeNull();

    await act(async () => result.current.logout());
    expect(sessionStorage.getItem(SA_AUTH_KEY)).toBeNull();
  });

  it("logout() does NOT touch tenant 'auth_token' key", async () => {
    vi.spyOn(
      superAdminAuthApiModule.superAdminAuthApi,
      "logout",
    ).mockResolvedValue(undefined);

    // Simulate tenant app having its own session
    sessionStorage.setItem(
      TENANT_AUTH_KEY,
      JSON.stringify({ token: "tenant-tok" }),
    );

    const { result } = renderHook(() => useSAAuth(), { wrapper });
    act(() => result.current.login(MOCK_TOKEN, MOCK_SA));
    await act(async () => result.current.logout());

    // Tenant session must be completely untouched
    expect(sessionStorage.getItem(TENANT_AUTH_KEY)).not.toBeNull();
  });

  it("isAuthenticated is true when 'sa-auth' is pre-populated in sessionStorage", () => {
    sessionStorage.setItem(
      SA_AUTH_KEY,
      JSON.stringify({ token: MOCK_TOKEN, superAdmin: MOCK_SA }),
    );

    const { result } = renderHook(() => useSAAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.superAdmin?.email).toBe(MOCK_SA.email);
  });

  it("isAuthenticated is false on empty sessionStorage", () => {
    const { result } = renderHook(() => useSAAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.superAdmin).toBeNull();
    expect(result.current.token).toBeNull();
  });
});
