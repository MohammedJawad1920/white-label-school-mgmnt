import { apiClient } from "./client";
import type { ApiImportJob, ImportPreviewResponse } from "@/types/api";

export const importApi = {
  preview: (file: File, entity: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity", entity);
    return apiClient
      .post<ImportPreviewResponse>("/import/preview", formData)
      .then((r) => r.data);
  },

  confirm: (jobId: string) =>
    apiClient
      .post<{ message: string; imported: number }>(`/import/${jobId}/confirm`)
      .then((r) => r.data),

  cancel: (jobId: string) =>
    apiClient
      .delete<{ message: string }>(`/import/${jobId}`)
      .then((r) => r.data),

  /** Returns a URL string for direct download — does not call apiClient */
  templateUrl: (entity: string) => `/import/template/${entity}`,

  history: () =>
    apiClient
      .get<{ jobs: ApiImportJob[] }>("/import/history")
      .then((r) => r.data),
};
