/**
 * notifications.api.test.ts
 *
 * Regression tests for notifications API client (Freeze v3.3 §10.1)
 * Targets: CR-FE-004, CR-FE-005
 *
 * Verifies:
 *   - List endpoint reads `.data.data` not `.data.notifications`
 *   - `markAllRead` endpoint reads `.data.updated` not `.data.updatedCount`
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as notificationsApi from "./notifications.api";
import { apiClient } from "./client";

vi.mock("./client");

describe("notifications.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("correctly unwraps response envelope from `.data.data` (regression: CR-FE-004)", async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "notif-1",
              title: "Leave approved",
              body: "Leave approved",
              type: "leave",
              readAt: null,
            },
            {
              id: "notif-2",
              title: "Exam published",
              body: "Exam published",
              type: "exam",
              readAt: null,
            },
          ],
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await notificationsApi.notificationsApi.list();

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.data[0]!.title).toBe("Leave approved");
    });

    it("correctly reads from `.data.data` not `.data.notifications`", async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "notif-1",
              title: "Test",
              body: "Test",
              type: "leave",
              readAt: null,
            },
          ],
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      await notificationsApi.notificationsApi.list();

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("/notifications"),
      );
    });
  });

  describe("markAllRead", () => {
    it("correctly reads `.data.updated` not `.data.updatedCount` (regression: CR-FE-005)", async () => {
      const mockResponse = {
        data: {
          updated: 5,
        },
      };

      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);

      const result = await notificationsApi.notificationsApi.markAllRead();

      expect(typeof result.updated).toBe("number");
      expect(result.updated).toBe(5);
    });

    it("sends POST request to mark-all-read endpoint", async () => {
      const mockResponse = {
        data: {
          updated: 3,
        },
      };

      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);
      await notificationsApi.notificationsApi.markAllRead();

      expect(apiClient.put).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/read-all"),
      );
    });
  });
});
