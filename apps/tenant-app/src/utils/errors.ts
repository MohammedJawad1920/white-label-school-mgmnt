import axios from "axios";
import type { ApiError } from "@/types/api";

export interface ParsedError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function parseApiError(error: unknown): ParsedError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;
    if (data?.error) {
      return {
        code: data.error.code ?? "UNKNOWN_ERROR",
        message: data.error.message ?? "An unexpected error occurred",
        details: data.error.details,
      };
    }
    if (error.message) return { code: "NETWORK_ERROR", message: error.message };
  }
  if (error instanceof Error)
    return { code: "CLIENT_ERROR", message: error.message };
  return { code: "UNKNOWN_ERROR", message: "An unexpected error occurred" };
}

export function getErrorMessage(error: unknown): string {
  return parseApiError(error).message;
}
