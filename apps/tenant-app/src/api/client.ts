/**
 * api/client.ts — Axios instance for Tenant App
 *
 * WHY AUTH_EXPIRED custom event (not direct React setState):
 * The axios interceptor lives outside the React tree. It fires a CustomEvent;
 * AuthContext listens and shows the SessionExpiredModal. Fully decoupled.
 *
 * WHY baseURL from import.meta.env:
 * Freeze §1.5 bans hardcoded URLs. Points at Prism mock in dev,
 * real backend in staging/prod via env var swap.
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

// Inject Bearer token on every outgoing request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const raw = localStorage.getItem(AUTH_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { token?: string };
      if (parsed.token) {
        config.headers.Authorization = `Bearer ${parsed.token}`;
      }
    } catch {
      // Malformed localStorage — proceed without token; 401 interceptor cleans up
    }
  }
  return config;
});

// Handle 401 globally — clear auth and notify AuthContext
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
