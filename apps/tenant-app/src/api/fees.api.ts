import { apiClient } from "./client";
import type {
  FeeCharge,
  FeePayment,
  FeeSummaryEntry,
  BulkChargeRequest,
  FeeCategory,
} from "@/types/api";

export interface FeeChargeFilters {
  sessionId?: string;
  studentId?: string;
  classId?: string;
  hasBalance?: boolean;
}

export const feesApi = {
  createCharge: (
    data: Omit<BulkChargeRequest, "studentIds" | "classId"> & {
      studentId: string;
    },
  ) =>
    apiClient
      .post<{ charge: FeeCharge }>("/fees/charges", data)
      .then((r) => r.data.charge),

  bulkCharge: (data: BulkChargeRequest) =>
    apiClient
      .post<{
        charged: number;
        skipped: number;
      }>("/fees/charges/bulk", data)
      .then((r) => r.data),

  listCharges: (filters?: FeeChargeFilters) =>
    apiClient
      .get<{
        data: FeeCharge[];
      }>("/fees/charges", { params: filters })
      .then((r) => ({ charges: r.data.data, total: r.data.data.length })),

  deleteCharge: (id: string) =>
    apiClient
      .delete<{ message: string }>(`/fees/charges/${id}`)
      .then((r) => r.data),

  recordPayment: (
    chargeId: string,
    data: {
      amountPaid: number;
      paymentMode: "Cash" | "SelfPaid";
      paidAt: string;
      receiptNumber?: string;
      notes?: string;
    },
  ) =>
    apiClient
      .post<{ payment: FeePayment }>(`/fees/charges/${chargeId}/payments`, data)
      .then((r) => r.data.payment),

  summary: (filters?: { sessionId?: string; classId?: string }) =>
    apiClient
      .get<{ data: FeeSummaryEntry[] }>("/fees/summary", { params: filters })
      .then((r) => ({ summary: r.data.data })),
};

// Re-export for convenience
export type { FeeCategory };
