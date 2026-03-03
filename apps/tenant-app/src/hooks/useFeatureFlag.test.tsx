/**
 * Unit tests: useFeatureFlag hook
 * Freeze §FE Phase 6 "Feature flags": feature-gated rendering must read
 *   GET /api/features response to decide which UI sections are shown.
 *
 * Tests:
 *   - returns `true`  when feature is enabled in the API response
 *   - returns `false` when feature is disabled
 *   - returns `undefined` while the query is loading
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import * as featuresApiModule from "@/api/features";
import type { FeatureKey } from "@/types/api";

// ── Wrapper ───────────────────────────────────────────────────────────────────
function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useFeatureFlag", () => {
  let queryClient: QueryClient;
  let listSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    listSpy?.mockRestore();
    queryClient.clear();
  });

  it("returns true when feature is enabled", async () => {
    listSpy = vi
      .spyOn(featuresApiModule.featuresApi, "list")
      .mockResolvedValue({
        features: [
          {
            key: "timetable" as FeatureKey,
            name: "Timetable",
            enabled: true,
            enabledAt: null,
          },
          {
            key: "attendance" as FeatureKey,
            name: "Attendance",
            enabled: false,
            enabledAt: null,
          },
        ],
      });

    const { result } = renderHook(() => useFeatureFlag("timetable"), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toBe(true);
  });

  it("returns false when feature is disabled", async () => {
    listSpy = vi
      .spyOn(featuresApiModule.featuresApi, "list")
      .mockResolvedValue({
        features: [
          {
            key: "timetable" as FeatureKey,
            name: "Timetable",
            enabled: false,
            enabledAt: null,
          },
          {
            key: "attendance" as FeatureKey,
            name: "Attendance",
            enabled: false,
            enabledAt: null,
          },
        ],
      });

    const { result } = renderHook(() => useFeatureFlag("timetable"), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toBe(false);
  });

  it("returns undefined while the query is still loading", () => {
    // Never resolves to simulate loading state
    listSpy = vi
      .spyOn(featuresApiModule.featuresApi, "list")
      .mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useFeatureFlag("attendance"), {
      wrapper: makeWrapper(queryClient),
    });

    // Immediately after render (no await) — should still be undefined
    expect(result.current).toBeUndefined();
  });

  it("returns undefined when feature key not present in API response", async () => {
    listSpy = vi
      .spyOn(featuresApiModule.featuresApi, "list")
      .mockResolvedValue({
        features: [
          {
            key: "timetable" as FeatureKey,
            name: "Timetable",
            enabled: true,
            enabledAt: null,
          },
        ],
      });

    const { result } = renderHook(() => useFeatureFlag("attendance"), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() =>
      // Once data is loaded, attendance is not present → undefined
      expect(result.current).toBeUndefined(),
    );
  });
});
