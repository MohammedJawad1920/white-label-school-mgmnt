import { apiClient } from "./client";
import type {
  SchoolProfile,
  UpdateSchoolProfileRequest,
  UpdateSchoolProfileResponse,
  UploadProfileFileResponse,
} from "@/types/api";

export const schoolProfileApi = {
  get: () =>
    apiClient
      .get<{ profile: SchoolProfile }>("/school-profile")
      .then((r) => r.data.profile),

  update: (payload: UpdateSchoolProfileRequest) =>
    apiClient
      .put<UpdateSchoolProfileResponse>("/school-profile", payload)
      .then((r) => r.data),

  uploadFile: (file: File, type: "logo" | "signature") => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    return apiClient
      .post<UploadProfileFileResponse>("/school-profile/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
