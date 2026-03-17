import { apiClient } from "./client";

interface PushSubscribePayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const pushApi = {
  subscribe: (payload: PushSubscribePayload) =>
    apiClient.post<void>("/push/subscribe", payload),
};
