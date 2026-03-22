/**
 * SA API client — completely isolated from tenant-app.
 * WHY separate client: SuperAdmin JWT must never be sent to tenant endpoints
 * and vice versa. Separate axios instance = separate interceptor chain.
 * WHY 'sa-auth' key: Freeze §FE Phase 7 — isolated sessionStorage key.
 * MUST match the key used in SAAuthContext (D-01 fix: was 'sa_auth', now 'sa-auth').
 */
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from "axios";

const SA_AUTH_KEY = "sa-auth";

export const saApiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

saApiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const raw = sessionStorage.getItem(SA_AUTH_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { token?: string };
      if (parsed.token) config.headers.Authorization = `Bearer ${parsed.token}`;
    } catch {
      /* malformed — proceed without token */
    }
  }
  return config;
});

saApiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      sessionStorage.removeItem(SA_AUTH_KEY);
      window.dispatchEvent(new CustomEvent("SA_AUTH_EXPIRED"));
    }
    return Promise.reject(error);
  },
);
