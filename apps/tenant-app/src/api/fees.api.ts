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
  ) => apiClient.post<FeeCharge>("/fees/charges", data).then((r) => r.data),

  bulkCharge: (data: BulkChargeRequest) =>
    apiClient
      .post<{
        created: number;
        charges: FeeCharge[];
      }>("/fees/charges/bulk", data)
      .then((r) => r.data),

  listCharges: (filters?: FeeChargeFilters) =>
    apiClient
      .get<{
        charges: FeeCharge[];
        total: number;
      }>("/fees/charges", { params: filters })
      .then((r) => r.data),

  deleteCharge: (id: string) =>
    apiClient
      .delete<{ message: string }>(`/fees/charges/${id}`)
      .then((r) => r.data),

  recordPayment: (
    chargeId: string,
    data: {
      amount: number;
      paymentMode: "Cash" | "SelfPaid";
      receiptNumber?: string;
      notes?: string;
    },
  ) =>
    apiClient
      .post<FeePayment>(`/fees/charges/${chargeId}/payments`, data)
      .then((r) => r.data),

  summary: (filters?: { sessionId?: string; classId?: string }) =>
    apiClient
      .get<{ summary: FeeSummaryEntry[] }>("/fees/summary", { params: filters })
      .then((r) => r.data),
};

// Re-export for convenience
export type { FeeCategory };
