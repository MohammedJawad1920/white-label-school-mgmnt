/**
 * AuthContext.tsx — Tenant Session State
 *
 * WHY Context (not TanStack Query) for auth:
 * Auth is not "server state" — it's a local session derived from sessionStorage.
 * TanStack Query is for data that lives on the server and needs caching/refetch.
 * The JWT + user object are session-local; React Context is the correct tool.
 *
 * BOOT INITIALIZATION:
 * We read sessionStorage synchronously during useState initializer so the user
 * object is available on the very first render. This prevents a flash of the
 * login page on page refresh for already-authenticated users.
 *
 * v5.0: localStorage replaced with sessionStorage (Frontend Freeze §1.3 S4).
 * v5.0: mustChangePassword surfaced from JWT; App.tsx redirects to /change-password.
 * v5.0: AUTH_KEY renamed 'auth' → 'auth_token' (M-03, Freeze §4 TOKEN_KEY constant).
 *
 * AUTH_EXPIRED event flow:
 * 1. axios interceptor receives 401
 * 2. Interceptor fires window CustomEvent('AUTH_EXPIRED') and clears sessionStorage
 * 3. This listener sets isExpired = true
 * 4. SessionExpiredModal renders as a blocking overlay
 * 5. User clicks "Log in" → dismissExpired() + navigate('/login')
 *
 * SWITCH ROLE:
 * Calls POST /auth/switch-role, gets a NEW JWT with the new activeRole.
 * Replaces token + user in state AND sessionStorage atomically.
 * No page reload — all role-gated components re-render immediately.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { TenantUser, SwitchRoleRequest, UserRole } from "@/types/api";
import { authApi } from "@/api/auth";

const AUTH_KEY = "auth_token";

interface AuthStorage {
  token: string;
  user: TenantUser;
}

interface AuthContextValue {
  user: TenantUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isExpired: boolean;
  /** Computed from user.activeRole — null when logged out */
  activeRole: UserRole | null;
  /** v5.0: true when admin has forced a password reset */
  mustChangePassword: boolean;
  login: (token: string, user: TenantUser) => void;
  logout: () => Promise<void>;
  switchRole: (req: SwitchRoleRequest) => Promise<void>;
  /** Convenience wrapper: calls switchRole({ role }) */
  setActiveRole: (role: UserRole) => Promise<void>;
  dismissExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStorage(): AuthStorage | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthStorage;
    // Validate required TenantUser fields — reject corrupted data
    if (
      !parsed.token ||
      !parsed.user?.id ||
      !parsed.user?.name ||
      !parsed.user?.email
    ) {
      sessionStorage.removeItem(AUTH_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null; // malformed — treat as logged out
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize synchronously from sessionStorage — no async, no flash
  const [user, setUser] = useState<TenantUser | null>(
    () => readStorage()?.user ?? null,
  );
  const [token, setToken] = useState<string | null>(
    () => readStorage()?.token ?? null,
  );
  const [isExpired, setIsExpired] = useState(false);

  const login = useCallback((newToken: string, newUser: TenantUser) => {
    sessionStorage.setItem(
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
    sessionStorage.removeItem(AUTH_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const switchRole = useCallback(
    async (req: SwitchRoleRequest) => {
      const res = await authApi.switchRole(req);
      login(res.token, res.user); // atomically replaces JWT + user
      // Signal cache invalidation — listeners (App.tsx) clear TanStack Query cache
      window.dispatchEvent(new CustomEvent("ROLE_SWITCHED"));
    },
    [login],
  );

  const setActiveRole = useCallback(
    (role: UserRole) => switchRole({ role }),
    [switchRole],
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
        activeRole: user?.activeRole ?? null,
        mustChangePassword: user?.mustChangePassword ?? false,
        login,
        logout,
        switchRole,
        setActiveRole,
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
