/**
 * AuthContext.tsx — Tenant Session State
 *
 * WHY Context (not TanStack Query) for auth:
 * Auth is not "server state" — it's a local session derived from localStorage.
 * TanStack Query is for data that lives on the server and needs caching/refetch.
 * The JWT + user object are session-local; React Context is the correct tool.
 *
 * BOOT INITIALIZATION:
 * We read localStorage synchronously during useState initializer so the user
 * object is available on the very first render. This prevents a flash of the
 * login page on page refresh for already-authenticated users.
 *
 * AUTH_EXPIRED event flow:
 * 1. axios interceptor receives 401
 * 2. Interceptor fires window CustomEvent('AUTH_EXPIRED') and clears localStorage
 * 3. This listener sets isExpired = true
 * 4. SessionExpiredModal renders as a blocking overlay
 * 5. User clicks "Log in" → dismissExpired() + navigate('/login')
 *
 * SWITCH ROLE:
 * Calls POST /auth/switch-role, gets a NEW JWT with the new activeRole.
 * Replaces token + user in state AND localStorage atomically.
 * No page reload — all role-gated components re-render immediately.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { TenantUser, SwitchRoleRequest } from "@/types/api";
import { authApi } from "@/api/auth";

const AUTH_KEY = "auth";

interface AuthStorage {
  token: string;
  user: TenantUser;
}

interface AuthContextValue {
  user: TenantUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isExpired: boolean;
  login: (token: string, user: TenantUser) => void;
  logout: () => Promise<void>;
  switchRole: (req: SwitchRoleRequest) => Promise<void>;
  dismissExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStorage(): AuthStorage | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthStorage) : null;
  } catch {
    return null; // malformed — treat as logged out
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize synchronously from localStorage — no async, no flash
  const [user, setUser] = useState<TenantUser | null>(
    () => readStorage()?.user ?? null,
  );
  const [token, setToken] = useState<string | null>(
    () => readStorage()?.token ?? null,
  );
  const [isExpired, setIsExpired] = useState(false);

  const login = useCallback((newToken: string, newUser: TenantUser) => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ token: newToken, user: newUser }),
    );
    setToken(newToken);
    setUser(newUser);
    setIsExpired(false);
  }, []);

  const logout = useCallback(async () => {
    // Fire-and-forget per Freeze §4: don't block UI if backend call fails
    authApi.logout().catch(() => {});
    localStorage.removeItem(AUTH_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const switchRole = useCallback(
    async (req: SwitchRoleRequest) => {
      const res = await authApi.switchRole(req);
      login(res.token, res.user); // atomically replaces JWT + user
    },
    [login],
  );

  const dismissExpired = useCallback(() => setIsExpired(false), []);

  // Listen for 401s fired by the axios interceptor
  useEffect(() => {
    function handleExpired() {
      setToken(null);
      setUser(null);
      setIsExpired(true);
    }
    window.addEventListener("AUTH_EXPIRED", handleExpired);
    return () => window.removeEventListener("AUTH_EXPIRED", handleExpired);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isExpired,
        login,
        logout,
        switchRole,
        dismissExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
