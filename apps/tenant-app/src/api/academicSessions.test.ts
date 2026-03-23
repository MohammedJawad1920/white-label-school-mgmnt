/**
 * academicSessions.api.test.ts (or academicSessions.test.ts)
 *
 * Regression tests for academic sessions API client (Freeze v3.3 §10.1)
 * Targets: CR-FE-015
 *
 * Verifies:
 *   - `copyTimetable` sends `fromSessionId` (not `sourceSessionId`) in request body
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as academicSessionsApi from "./academicSessions";
import { apiClient } from "./client";

vi.mock("./client");

describe("academicSessions.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("copyTimetable", () => {
    it("sends `fromSessionId` (not `sourceSessionId`) in request body (regression: CR-FE-015)", async () => {
      const mockResponse = {
        data: {
          copiedCount: 24,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await academicSessionsApi.copyTimetable(
        "target-session-id",
        "source-session-id",
      );

      expect(result.copiedCount).toBe(24);
      // Verify the POST call includes fromSessionId not sourceSessionId
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining("/academic-sessions/"),
        expect.objectContaining({
          fromSessionId: "source-session-id",
        }),
      );
    });

    it("does not use `sourceSessionId` field, uses `fromSessionId` instead", async () => {
      const mockResponse = {
        data: {
          copiedCount: 12,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      await academicSessionsApi.copyTimetable("target-id", "source-id");

      const callArgs = vi.mocked(apiClient.post).mock.calls[0];
      const payload = callArgs[1] as Record<string, unknown>;
      expect("fromSessionId" in payload).toBe(true);
      expect("sourceSessionId" in payload).toBe(false);
    });

    it("sends POST request to copy-timetable endpoint with target session ID in URL", async () => {
      const mockResponse = {
        data: {
          copiedCount: 24,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      await academicSessionsApi.copyTimetable("target-123", "source-456");

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining("/academic-sessions/target-123"),
        expect.anything(),
      );
    });
  });
});
