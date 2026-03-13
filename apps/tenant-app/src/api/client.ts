/**
 * Tenant API client.
 * WHY 'auth_token' key: Frontend Freeze §4 TOKEN_KEY constant — tenant app
 * uses 'auth_token' stored in sessionStorage. Superadmin uses 'sa-auth'.
 * Completely separate apps, separate storage keys.
 *
 * v5.0 changes:
 * - localStorage → sessionStorage (freeze v3.0 bans localStorage for auth)
 * - AUTH_KEY renamed 'auth' → 'auth_token' (M-03, Freeze §4)
 * - X-Tenant-ID header injected on every request (from VITE_TENANT_ID)
 */
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from "axios";

const AUTH_KEY = "auth_token";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Inject Bearer token from sessionStorage and X-Tenant-ID on every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const raw = sessionStorage.getItem(AUTH_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { token?: string };
      if (parsed.token) config.headers.Authorization = `Bearer ${parsed.token}`;
    } catch {
      /* malformed — proceed without token */
    }
  }
  const tenantId = import.meta.env.VITE_TENANT_ID;
  if (tenantId) {
    config.headers["X-Tenant-ID"] = tenantId;
  }
  return config;
});

// 401 → clear session, fire AUTH_EXPIRED event, SessionExpiredModal catches it
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      sessionStorage.removeItem(AUTH_KEY);
      window.dispatchEvent(new CustomEvent("AUTH_EXPIRED"));
    }
    return Promise.reject(error);
  },
);
