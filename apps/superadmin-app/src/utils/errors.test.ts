import { describe, it, expect } from "vitest";
import { parseApiError, getErrorMessage } from "@/utils/errors";
import { AxiosError, AxiosHeaders } from "axios";

function fakeAxiosError(data: unknown, status = 400): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError(
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
}

describe("parseApiError", () => {
  it("extracts code + message from a structured API error", () => {
    const data = {
      error: {
        code: "TENANT_INACTIVE",
        message: "Tenant is inactive",
        timestamp: "",
      },
    };
    const result = parseApiError(fakeAxiosError(data));
    expect(result.code).toBe("TENANT_INACTIVE");
    expect(result.message).toBe("Tenant is inactive");
  });

  it("returns NETWORK_ERROR for AxiosError without response", () => {
    const err = new AxiosError("timeout", "ECONNABORTED");
    expect(parseApiError(err).code).toBe("NETWORK_ERROR");
  });

  it("returns CLIENT_ERROR for plain Error", () => {
    expect(parseApiError(new Error("oops")).code).toBe("CLIENT_ERROR");
  });

  it("returns UNKNOWN_ERROR for non-Error", () => {
    expect(parseApiError(null).code).toBe("UNKNOWN_ERROR");
  });
});

describe("getErrorMessage", () => {
  it("extracts message from API error", () => {
    const data = {
      error: { code: "NOT_FOUND", message: "Tenant not found", timestamp: "" },
    };
    expect(getErrorMessage(fakeAxiosError(data))).toBe("Tenant not found");
  });
});
