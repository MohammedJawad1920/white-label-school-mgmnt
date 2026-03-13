/**
 * authStore.ts — Zustand auth store (C-07, Frontend Freeze §4 locked pattern)
 *
 * TOKEN_KEY: 'auth_token' stored in sessionStorage.
 * Survives tab refresh; cleared on tab close (PWA and browser behaviour).
 *
 * IMPORTANT — DEPENDENCY MISSING:
 * TODO C-07: `zustand` is not in apps/tenant-app/package.json.
 * Run: npm install zustand --workspace=tenant-app
 * before building. This file will fail to compile until zustand is installed.
 *
 * Pattern locked by Frontend Freeze §4:
 * - token stored raw in sessionStorage['auth_token']
 * - user decoded from JWT via jwt-decode on login (not stored separately)
 * - Axios interceptor reads token from store.getState().token (not sessionStorage)
 *
 * NOTE: While AuthContext.tsx still manages auth state, this store provides
 * a Zustand-native path for components that need direct store access and for
 * the Axios interceptor pattern described in Freeze §3 (API assumptions).
 * Both may coexist during migration; AuthContext.tsx is the current source of truth.
 *
 * TODO jwt-decode: `jwt-decode` is also not in package.json. Install:
 * npm install jwt-decode --workspace=tenant-app
 * For now the store stores user as a passed-in TenantUser (not decoded from JWT).
 */

// TODO C-07: install zustand — npm install zustand --workspace=tenant-app
// TODO C-07: install jwt-decode — npm install jwt-decode --workspace=tenant-app
import { create } from "zustand";
import type { TenantUser } from "../types/api";

const TOKEN_KEY = "auth_token";

interface AuthState {
  token: string | null;
  user: TenantUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: TenantUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  setAuth: (token: string, user: TenantUser) => {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, user }));
    set({ token, user, isAuthenticated: true });
  },
  clearAuth: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },
}));

// Rehydrate from sessionStorage on module load (app boot / tab refresh)
const _stored = sessionStorage.getItem(TOKEN_KEY);
if (_stored) {
  try {
    const parsed = JSON.parse(_stored) as { token?: string; user?: TenantUser };
    if (parsed.token && parsed.user) {
      useAuthStore.getState().setAuth(parsed.token, parsed.user);
    }
  } catch {
    // Malformed storage entry — clear it silently
    sessionStorage.removeItem(TOKEN_KEY);
  }
}
