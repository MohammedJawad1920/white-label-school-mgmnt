import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
} from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { SessionExpiredModal } from "./SessionExpiredModal";
import { RoleGate } from "./RoleGate";
import { FeatureGate } from "./FeatureGate";

// ── Lazy-loaded routes ────────────────────────────────────────────────────────
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const ChangePasswordPage = lazy(
  () => import("@/features/auth/ChangePasswordPage"),
);
const PrivacyPage = lazy(() => import("@/features/static/PrivacyPage"));
const TermsPage = lazy(() => import("@/features/static/TermsPage"));
const Layout = lazy(() => import("@/components/Layout"));

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const TimetablePage = lazy(() => import("@/features/timetable/TimetablePage"));
const RecordAttendancePage = lazy(
  () => import("@/features/attendance/RecordAttendancePage"),
);
const AttendanceSummaryPage = lazy(
  () => import("@/features/attendance/AttendanceSummaryPage"),
);
const StudentAttendanceHistoryPage = lazy(
  () => import("@/features/attendance/StudentAttendanceHistoryPage"),
);
const UsersPage = lazy(() => import("@/features/manage/users/UsersPage"));
const StudentsPage = lazy(
  () => import("@/features/manage/students/StudentsPage"),
);
const ClassesPage = lazy(() => import("@/features/manage/classes/ClassesPage"));
const BatchesPage = lazy(() => import("@/features/manage/batches/BatchesPage"));
const SubjectsPage = lazy(
  () => import("@/features/manage/subjects/SubjectsPage"),
);
const SchoolPeriodsPage = lazy(
  () => import("@/features/manage/school-periods/SchoolPeriodsPage"),
);
const MonthlySheetPage = lazy(
  () => import("@/features/attendance/MonthlySheetPage"),
);
const EventsPage = lazy(() => import("@/features/manage/events/EventsPage"));
const SessionListPage = lazy(
  () => import("@/features/admin/sessions/SessionListPage"),
);
const SessionDetailPage = lazy(
  () => import("@/features/admin/sessions/SessionDetailPage"),
);
const BatchPromotionWizardPage = lazy(
  () => import("@/features/admin/sessions/BatchPromotionWizardPage"),
);
const SchoolProfilePage = lazy(
  () => import("@/features/admin/settings/SchoolProfilePage"),
);

// ── v5.0: Boot-time VITE_TENANT_ID validation ────────────────────────────────
const TENANT_ID = import.meta.env.VITE_TENANT_ID as string | undefined;
// H-02: Freeze §1.5 — VITE_TENANT_ID must be a valid UUID (not just non-empty)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isTenantIdValid =
  !!TENANT_ID && UUID_REGEX.test(TENANT_ID.trim());

// ── QueryClient — Freeze §3 (QC1–QC4 locked rules) ────────────────────────────
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 401) {
        window.dispatchEvent(new CustomEvent("AUTH_EXPIRED"));
      }
    },
  }),
  defaultOptions: {
    queries: {
      // M-06: Freeze §3 — default retry locked to 1 (network errors only)
      retry: (failureCount: number, error: unknown): boolean => {
        // never retry 4xx — only retry network/5xx errors up to 1 time (Freeze §3)
        if (isAxiosError(error) && error.response?.status) return false;
        return failureCount < 1;
      },
      retryDelay: (attempt: number): number =>
        Math.min(1000 * 2 ** attempt, 4000),
      // H-01: Freeze §3 QC2 — refetchOnWindowFocus locked to false
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

function PageLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      aria-label="Loading page"
    >
      <div
        className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
        role="status"
      />
    </div>
  );
}

// ── Error boundary fallbacks ──────────────────────────────────────────────────
function RouteError({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8">
      <p className="text-destructive font-medium">Something went wrong</p>
      <p className="text-sm text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Try again
      </button>
    </div>
  );
}

function RootError() {
  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <div className="text-center">
        <p className="text-destructive font-medium">Application error</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

// ── Boot error — VITE_TENANT_ID missing / invalid ────────────────────────────
function TenantIdError() {
  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <div className="text-center max-w-sm">
        <p className="text-destructive font-semibold">Configuration error</p>
        <p className="text-sm text-muted-foreground mt-2">
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            VITE_TENANT_ID
          </code>{" "}
          is missing or not a valid UUID. Set it in{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> and
          restart the dev server.
        </p>
      </div>
    </div>
  );
}

// ── Per-route error boundary wrapper ─────────────────────────────────────────
function Guarded({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary fallbackRender={RouteError}>{children}</ErrorBoundary>;
}

export function App() {
  // v5.0: fail fast if VITE_TENANT_ID is missing / malformed
  if (!isTenantIdValid) {
    return <TenantIdError />;
  }

  // Clear all cached queries when active role changes — prevents cross-role data leaks
  React.useEffect(() => {
    function handleRoleSwitch() {
      queryClient.clear();
    }
    window.addEventListener("ROLE_SWITCHED", handleRoleSwitch);
    return () => window.removeEventListener("ROLE_SWITCHED", handleRoleSwitch);
  }, []);

  // TODO M-01fe: Freeze §2 requires createBrowserRouter (not BrowserRouter JSX wrapper).
  // Switch to createBrowserRouter once all route definitions are stable to avoid
  // breaking changes. Current BrowserRouter works correctly in the interim.

  // TODO H-05: After useSessionStore is wired, call GET /academic-sessions/current
  // on app boot (after auth hydration) and populate useSessionStore.setCurrentSession.

  return (
    <ErrorBoundary fallbackRender={RootError}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <SessionExpiredModal />
              <Toaster richColors closeButton />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* ── Public routes ───────────────────────────────────────── */}
                  <Route
                    path="/login"
                    element={
                      <Guarded>
                        <LoginPage />
                      </Guarded>
                    }
                  />
                  <Route
                    path="/privacy"
                    element={
                      <Guarded>
                        <PrivacyPage />
                      </Guarded>
                    }
                  />
                  <Route
                    path="/terms"
                    element={
                      <Guarded>
                        <TermsPage />
                      </Guarded>
                    }
                  />

                  {/* ── Protected routes ────────────────────────────────────── */}
                  <Route element={<ProtectedRoute />}>
                    {/* v5.0 M-011: change-password outside Layout (forced mode has no nav) */}
                    <Route
                      path="/change-password"
                      element={
                        <Guarded>
                          <ChangePasswordPage />
                        </Guarded>
                      }
                    />

                    {/* All other protected routes — wrapped in Layout */}
                    <Route element={<Layout />}>
                      <Route
                        index
                        element={<Navigate to="/dashboard" replace />}
                      />

                      {/* Teacher + Admin — timetable feature-gated */}
                      <Route
                        path="/dashboard"
                        element={
                          <Guarded>
                            <FeatureGate featureKey="timetable">
                              <DashboardPage />
                            </FeatureGate>
                          </Guarded>
                        }
                      />
                      <Route
                        path="/timetable"
                        element={
                          <Guarded>
                            <FeatureGate featureKey="timetable">
                              <TimetablePage />
                            </FeatureGate>
                          </Guarded>
                        }
                      />
                      {/* Admin + Teacher — CR-FE-023: Teacher can record attendance */}
                      <Route
                        path="/attendance/record"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin", "Teacher"]}>
                              <FeatureGate featureKey="attendance">
                                <RecordAttendancePage />
                              </FeatureGate>
                            </RoleGate>
                          </Guarded>
                        }
                      />

                      {/* Admin only — inline "Not authorized" for Teacher per Freeze §2 */}
                      <Route
                        path="/attendance/summary"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <FeatureGate featureKey="attendance">
                                <AttendanceSummaryPage />
                              </FeatureGate>
                            </RoleGate>
                          </Guarded>
                        }
                      />
                      <Route
                        path="/students/:studentId/attendance"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <FeatureGate featureKey="attendance">
                                <StudentAttendanceHistoryPage />
                              </FeatureGate>
                            </RoleGate>
                          </Guarded>
                        }
                      />
                      <Route
                        path="/manage/users"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <UsersPage />
                            </RoleGate>
                          </Guarded>
                        }
                      />
                      <Route
                        path="/manage/students"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <StudentsPage />
                            </RoleGate>
                          </Guarded>
                        }
                      />
                      <Route
                        path="/manage/classes"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <ClassesPage />
                            </RoleGate>
                          </Guarded>
                        }
                      />
                      <Route
                        path="/manage/batches"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <BatchesPage />
                            </RoleGate>
                          </Guarded>
                        }
                      />
                      <Route
                        path="/manage/subjects"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <SubjectsPage />
                            </RoleGate>
                          </Guarded>
                        }
                      />
                      <Route
                        path="/manage/school-periods"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <FeatureGate featureKey="timetable">
                                <SchoolPeriodsPage />
                              </FeatureGate>
                            </RoleGate>
                          </Guarded>
                        }
                      />

                      {/* v4.5 CR-36: Monthly sheet — Admin + Teacher */}
                      <Route
                        path="/attendance/monthly-sheet"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin", "Teacher"]}>
                              <FeatureGate featureKey="attendance">
                                <MonthlySheetPage />
                              </FeatureGate>
                            </RoleGate>
                          </Guarded>
                        }
                      />

                      {/* v4.5 CR-37: Events — Admin only */}
                      <Route
                        path="/manage/events"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <EventsPage />
                            </RoleGate>
                          </Guarded>
                        }
                      />

                      {/* v5.0 M-013: Academic Sessions — Admin only */}
                      <Route
                        path="/admin/sessions"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <SessionListPage />
                            </RoleGate>
                          </Guarded>
                        }
                      />
                      <Route
                        path="/admin/sessions/:id"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <SessionDetailPage />
                            </RoleGate>
                          </Guarded>
                        }
                      />
                      <Route
                        path="/admin/sessions/:id/promote"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <BatchPromotionWizardPage />
                            </RoleGate>
                          </Guarded>
                        }
                      />

                      {/* v5.0 M-017: School Profile — Admin only */}
                      <Route
                        path="/admin/settings/profile"
                        element={
                          <Guarded>
                            <RoleGate roles={["Admin"]}>
                              <SchoolProfilePage />
                            </RoleGate>
                          </Guarded>
                        }
                      />

                      {/* H-06/H-07: Freeze §2 role-prefixed path aliases — redirect to
                          canonical paths while full route migration is pending.
                          These allow freeze-spec links (/admin/*, /teacher/*, etc.)
                          to work without breaking existing /dashboard, /timetable links. */}
                      <Route
                        path="/admin/dashboard"
                        element={<Navigate to="/dashboard" replace />}
                      />
                      <Route
                        path="/teacher/dashboard"
                        element={<Navigate to="/dashboard" replace />}
                      />
                      <Route
                        path="/student/dashboard"
                        element={<Navigate to="/dashboard" replace />}
                      />
                      <Route
                        path="/admin/timetable"
                        element={<Navigate to="/timetable" replace />}
                      />
                      <Route
                        path="/teacher/timetable"
                        element={<Navigate to="/timetable" replace />}
                      />
                      <Route
                        path="/student/timetable"
                        element={<Navigate to="/timetable" replace />}
                      />
                      <Route
                        path="/teacher/attendance"
                        element={<Navigate to="/attendance/record" replace />}
                      />
                      <Route
                        path="/admin/attendance/daily"
                        element={<Navigate to="/attendance/summary" replace />}
                      />
                      <Route
                        path="/admin/attendance/monthly"
                        element={
                          <Navigate to="/attendance/monthly-sheet" replace />
                        }
                      />
                      <Route
                        path="/teacher/attendance/monthly"
                        element={
                          <Navigate to="/attendance/monthly-sheet" replace />
                        }
                      />
                    </Route>
                  </Route>

                  <Route
                    path="*"
                    element={<Navigate to="/dashboard" replace />}
                  />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
