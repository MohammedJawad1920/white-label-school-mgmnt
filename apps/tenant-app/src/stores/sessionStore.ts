/**
 * sessionStore.ts — Zustand current-session store (C-07, Frontend Freeze §4 locked pattern)
 *
 * currentSession is populated on app boot by calling GET /academic-sessions/current
 * after successful auth hydration. It is the default sessionId used throughout
 * the app wherever a current session context is needed.
 *
 * IMPORTANT — DEPENDENCY MISSING:
 * TODO C-07: `zustand` is not in apps/tenant-app/package.json.
 * Run: npm install zustand --workspace=tenant-app
 * before building. This file will fail to compile until zustand is installed.
 *
 * Pattern locked by Frontend Freeze §4 session.store.ts:
 * - No persistence — cleared on logout (Zustand in-memory only)
 * - Populated from GET /academic-sessions/current on app boot (after auth)
 * - Used as default sessionId on all screens; screens that offer a picker
 *   override locally without changing this store's value.
 *
 * TODO H-05: Wire boot population in App.tsx after useAuthStore is wired:
 *   On authenticated app mount, call academicSessionsApi.getCurrent() and
 *   call useSessionStore.getState().setCurrentSession(result).
 */

// TODO C-07: install zustand — npm install zustand --workspace=tenant-app
import { create } from "zustand";
import type { AcademicSession } from "../types/api";

interface SessionState {
  currentSession: AcademicSession | null;
  setCurrentSession: (session: AcademicSession | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentSession: null,
  setCurrentSession: (session: AcademicSession | null) =>
    set({ currentSession: session }),
}));
