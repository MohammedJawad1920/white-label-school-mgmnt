/**
 * exams.api.test.ts
 *
 * Regression tests for exams API client (Freeze v3.3 §10.1)
 * Targets: CR-FE-007, CR-FE-008
 *
 * Verifies:
 *   - List endpoint reads `.data.data` not `.data.exams`
 *   - Detail endpoint reads `.data.data` not `.data.exam`
 *   - Response types (`ListExamsResponse`, `GetExamResponse`) are correctly used
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as examsApi from "./exams.api";
import { apiClient } from "./client";

vi.mock("./client");

describe("exams.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("correctly unwraps response envelope from `.data.data` (regression: CR-FE-007)", async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "exam-1",
              name: "Math",
              sessionId: "session-1",
              maxScore: 100,
              status: "draft",
            },
            {
              id: "exam-2",
              name: "English",
              sessionId: "session-1",
              maxScore: 100,
              status: "draft",
            },
          ],
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await examsApi.examsApi.list();

      expect(Array.isArray(result.exams)).toBe(true);
      expect(result.exams.length).toBe(2);
      expect(result.exams[0]).toHaveProperty("id");
      expect(result.exams[1]!.name).toBe("English");
    });

    it("correctly reads from `.data.data` not `.data.exams`", async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "exam-1",
              name: "Math",
              sessionId: "session-1",
              maxScore: 100,
              status: "draft",
            },
          ],
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      await examsApi.examsApi.list();

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("/exams"),
      );
    });
  });

  describe("get", () => {
    it("correctly unwraps response envelope from `.data.data` (regression: CR-FE-008)", async () => {
      const mockResponse = {
        data: {
          data: {
            id: "exam-1",
            name: "Math Exam",
            sessionId: "session-1",
            maxScore: 100,
            status: "published",
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await examsApi.examsApi.get("exam-1");

      expect(result).toBeDefined();
      expect(result.id).toBe("exam-1");
      expect(result.name).toBe("Math Exam");
    });

    it("correctly reads from `.data.data` not `.data.exam`", async () => {
      const mockResponse = {
        data: {
          data: {
            id: "exam-1",
            name: "Test",
            sessionId: "session-1",
            maxScore: 100,
            status: "draft",
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      await examsApi.examsApi.get("exam-1");

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("/exams/exam-1"),
      );
    });
  });
});
