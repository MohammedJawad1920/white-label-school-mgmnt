/**
 * SAAuthContext — SuperAdmin session state.
 * Mirror of tenant AuthContext but:
 *   - sessionStorage key: 'sa-auth' (Freeze §8.1 / CR-FE-029 — localStorage
 *     is forbidden for token storage in both apps)
 *   - Stores SuperAdmin object (not TenantUser)
 *   - Listens for SA_AUTH_EXPIRED (not AUTH_EXPIRED)
 *   - No switchRole (SuperAdmin has one role)
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { SuperAdmin } from "@/types/api";
import { superAdminAuthApi } from "@/api/superAdminAuth";

const SA_AUTH_KEY = "sa-auth";

interface SAAuthStorage {
  token: string;
  superAdmin: SuperAdmin;
}

interface SAAuthContextValue {
  superAdmin: SuperAdmin | null;
  token: string | null;
  isAuthenticated: boolean;
  isExpired: boolean;
  login: (token: string, superAdmin: SuperAdmin) => void;
  logout: () => Promise<void>;
  dismissExpired: () => void;
}

const SAAuthContext = createContext<SAAuthContextValue | null>(null);

function readStorage(): SAAuthStorage | null {
  try {
    const raw = sessionStorage.getItem(SA_AUTH_KEY);
    return raw ? (JSON.parse(raw) as SAAuthStorage) : null;
  } catch {
    return null;
  }
}

export function SAAuthProvider({ children }: { children: React.ReactNode }) {
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(
    () => readStorage()?.superAdmin ?? null,
  );
  const [token, setToken] = useState<string | null>(
    () => readStorage()?.token ?? null,
  );
  const [isExpired, setIsExpired] = useState(false);

  const login = useCallback((newToken: string, newSuperAdmin: SuperAdmin) => {
    sessionStorage.setItem(
      SA_AUTH_KEY,
      JSON.stringify({ token: newToken, superAdmin: newSuperAdmin }),
    );
    setToken(newToken);
    setSuperAdmin(newSuperAdmin);
    setIsExpired(false);
  }, []);

  const logout = useCallback(async () => {
    superAdminAuthApi.logout().catch(() => {});
    sessionStorage.removeItem(SA_AUTH_KEY);
    setToken(null);
    setSuperAdmin(null);
  }, []);

  const dismissExpired = useCallback(() => setIsExpired(false), []);

  useEffect(() => {
    function handleExpired() {
      setToken(null);
      setSuperAdmin(null);
      setIsExpired(true);
    }
    window.addEventListener("SA_AUTH_EXPIRED", handleExpired);
    return () => window.removeEventListener("SA_AUTH_EXPIRED", handleExpired);
  }, []);

  return (
    <SAAuthContext.Provider
      value={{
        superAdmin,
        token,
        isAuthenticated: !!token && !!superAdmin,
        isExpired,
        login,
        logout,
        dismissExpired,
      }}
    >
      {children}
    </SAAuthContext.Provider>
  );
}

export function useSAAuth(): SAAuthContextValue {
  const ctx = useContext(SAAuthContext);
  if (!ctx) throw new Error("useSAAuth must be used within SAAuthProvider");
  return ctx;
}
