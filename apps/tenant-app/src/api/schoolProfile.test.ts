/**
 * schoolProfile.api.test.ts (or schoolProfile.test.ts)
 *
 * Regression tests for school profile API client (Freeze v3.3 §10.1)
 * Targets: CR-FE-003
 *
 * Verifies:
 *   - `uploadFile` appends `type` field to FormData before sending (not URL query param)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as schoolProfileApi from "./schoolProfile";
import { apiClient } from "./client";

vi.mock("./client");

describe("schoolProfile.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadFile", () => {
    it("appends `type` field to FormData before sending (regression: CR-FE-003)", async () => {
      const mockFile = new File(["logo content"], "logo.png", {
        type: "image/png",
      });
      const mockResponse = {
        data: {
          data: {
            url: "https://r2.example.com/logo.png",
            type: "logo",
          },
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await schoolProfileApi.uploadFile(mockFile, "logo");

      expect(result.url).toBe("https://r2.example.com/logo.png");
      expect(result.type).toBe("logo");

      // Verify FormData includes type field
      const callArgs = vi.mocked(apiClient.post).mock.calls[0];
      const formData = callArgs[1] as FormData;
      expect(formData.has("type")).toBe(true);
      expect(formData.get("type")).toBe("logo");
    });

    it("does not send type as URL query parameter", async () => {
      const mockFile = new File(["signature"], "sig.png", {
        type: "image/png",
      });
      const mockResponse = {
        data: {
          data: {
            url: "https://r2.example.com/sig.png",
            type: "signature",
          },
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      await schoolProfileApi.uploadFile(mockFile, "signature");

      // Verify the URL does NOT contain query parameters
      const callArgs = vi.mocked(apiClient.post).mock.calls[0];
      const url = callArgs[0] as string;
      expect(url).not.toContain("?");
      expect(url).not.toContain("type=");
    });

    it("sends file in FormData along with type field", async () => {
      const mockFile = new File(["content"], "test.png", { type: "image/png" });
      const mockResponse = {
        data: {
          data: {
            url: "https://example.com/test.png",
            type: "logo",
          },
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      await schoolProfileApi.uploadFile(mockFile, "logo");

      const callArgs = vi.mocked(apiClient.post).mock.calls[0];
      const formData = callArgs[1] as FormData;
      expect(formData.has("file")).toBe(true);
      expect(formData.has("type")).toBe(true);
    });
  });
});
