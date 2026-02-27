import { apiClient } from "./client";
import type { ListFeaturesResponse } from "@/types/api";

export const featuresApi = {
  list: () =>
    apiClient.get<ListFeaturesResponse>("/features").then((r) => r.data),
};
