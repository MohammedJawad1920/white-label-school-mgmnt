import { describe, it, expect } from "vitest";
import { parseApiError, getErrorMessage } from "@/utils/errors";
import { AxiosError, AxiosHeaders } from "axios";

// Helper to construct a fake AxiosError with a response body
function fakeAxiosError(data: unknown, status = 400): AxiosError {
  const headers = new AxiosHeaders();
  const err = new AxiosError(
    "Request failed",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    {
      data,
      status,
      statusText: "Bad Request",
      headers,
      config: { headers },
    },
  );
  return err;
}

describe("parseApiError", () => {
  it("extracts code, message, details from an API error response", () => {
    const data = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Name is required",
        details: { field: "name" },
        timestamp: "2024-01-01T00:00:00.000Z",
      },
    };
    const result = parseApiError(fakeAxiosError(data));
    expect(result).toEqual({
      code: "VALIDATION_ERROR",
      message: "Name is required",
      details: { field: "name" },
    });
  });

  it("returns NETWORK_ERROR for AxiosError without response data", () => {
    const err = new AxiosError("Network Error", "ERR_NETWORK");
    const result = parseApiError(err);
    expect(result.code).toBe("NETWORK_ERROR");
    expect(result.message).toBe("Network Error");
  });

  it("returns CLIENT_ERROR for a plain Error", () => {
    const result = parseApiError(new Error("something broke"));
    expect(result.code).toBe("CLIENT_ERROR");
    expect(result.message).toBe("something broke");
  });

  it("returns UNKNOWN_ERROR for non-Error values", () => {
    const result = parseApiError("a random string");
    expect(result.code).toBe("UNKNOWN_ERROR");
    expect(result.message).toBe("An unexpected error occurred");
  });

  it("handles missing code/message in API response gracefully", () => {
    const data = { error: {} };
    const result = parseApiError(fakeAxiosError(data));
    expect(result.code).toBe("UNKNOWN_ERROR");
    expect(result.message).toBe("An unexpected error occurred");
  });
});

describe("getErrorMessage", () => {
  it("returns the message string from an API error", () => {
    const data = {
      error: { code: "NOT_FOUND", message: "Student not found", timestamp: "" },
    };
    expect(getErrorMessage(fakeAxiosError(data))).toBe("Student not found");
  });

  it("returns generic message for unknown error", () => {
    expect(getErrorMessage(42)).toBe("An unexpected error occurred");
  });
});
