/**
 * Tenant API client.
 * WHY 'auth' key (not 'sa_auth'): Freeze §4 localStorage keys — tenant app
 * uses 'auth', superadmin uses 'sa_auth'. Completely separate.
 */
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from "axios";

const AUTH_KEY = "auth";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Inject Bearer token from localStorage on every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const raw = localStorage.getItem(AUTH_KEY);
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

// 401 → clear session, fire AUTH_EXPIRED event, SessionExpiredModal catches it
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(AUTH_KEY);
      window.dispatchEvent(new CustomEvent("AUTH_EXPIRED"));
    }
    return Promise.reject(error);
  },
);
