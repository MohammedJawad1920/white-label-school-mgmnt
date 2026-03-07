import { apiClient } from "./client";
import type {
  ListBatchesResponse,
  CreateBatchRequest,
  UpdateBatchRequest,
  Batch,
  BulkDeleteResponse,
} from "@/types/api";

export const batchesApi = {
  list: () =>
    apiClient.get<ListBatchesResponse>("/batches").then((r) => r.data),
  create: (data: CreateBatchRequest) =>
    apiClient.post<{ batch: Batch }>("/batches", data).then((r) => r.data),
  update: (id: string, data: UpdateBatchRequest) =>
    apiClient.put<{ batch: Batch }>(`/batches/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete<void>(`/batches/${id}`).then((r) => r.data),
  bulkDelete: (batchIds: string[]) =>
    apiClient
      .post<BulkDeleteResponse>("/batches/bulk", { batchIds })
      .then((r) => r.data),
};
