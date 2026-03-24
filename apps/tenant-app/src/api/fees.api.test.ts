/**
 * fees.api.test.ts
 *
 * Regression tests for fees API client (Freeze v3.3 §10.1)
 * Targets: CR-FE-006
 *
 * Verifies:
 *   - `recordPayment` sends `amountPaid` (not `amount`) + `paidAt` in request body
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as feesApi from "./fees.api";
import { apiClient } from "./client";

vi.mock("./client");

describe("fees.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordPayment", () => {
    it("sends `amountPaid` (not `amount`) in request body (regression: CR-FE-006)", async () => {
      const mockResponse = {
        data: {
          data: {
            id: "payment-1",
            chargeId: "charge-1",
            amountPaid: 5000,
            paidAt: "2026-03-23T10:00:00Z",
            method: "cash",
          },
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await feesApi.feesApi.recordPayment("charge-1", {
        amountPaid: 5000,
        paidAt: "2026-03-23T10:00:00Z",
        paymentMode: "Cash",
      });

      expect(result.amount).toBe(5000);
      // Verify the POST call includes amountPaid and paidAt
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining("/fees"),
        expect.objectContaining({
          amountPaid: 5000,
          paidAt: "2026-03-23T10:00:00Z",
        }),
      );
    });

    it("does not use `amount` field, uses `amountPaid` instead", async () => {
      const mockResponse = {
        data: {
          data: {
            id: "payment-1",
            chargeId: "charge-1",
            amountPaid: 2000,
            paidAt: "2026-03-23",
            method: "cash",
          },
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      await feesApi.feesApi.recordPayment("charge-1", {
        amountPaid: 2000,
        paidAt: "2026-03-23",
        paymentMode: "Cash",
      });

      // Verify the call does NOT have an 'amount' field
      const callArgs = vi.mocked(apiClient.post).mock.calls[0]!;
      const payload = callArgs[1] as Record<string, unknown>;
      expect("amount" in payload).toBe(false);
      expect("amountPaid" in payload).toBe(true);
    });

    it("includes paidAt timestamp in request", async () => {
      const mockResponse = {
        data: {
          data: {
            id: "payment-1",
            chargeId: "charge-1",
            amountPaid: 3000,
            paidAt: "2026-03-23T14:30:00Z",
            method: "cash",
          },
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      await feesApi.feesApi.recordPayment("charge-1", {
        amountPaid: 3000,
        paidAt: "2026-03-23T14:30:00Z",
        paymentMode: "Cash",
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          paidAt: "2026-03-23T14:30:00Z",
        }),
      );
    });
  });
});
