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

// ── QueryClient — Freeze §4.2 (CR-FE-017) ────────────────────────────────────
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
      retry: (failureCount: number, error: unknown): boolean => {
        // never retry 4xx — only retry network/5xx errors up to 3 times
        if (isAxiosError(error) && error.response?.status) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt: number): number =>
        Math.min(1000 * 2 ** attempt, 4000),
      refetchOnWindowFocus: true,
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

// ── Per-route error boundary wrapper ─────────────────────────────────────────
function Guarded({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary fallbackRender={RouteError}>{children}</ErrorBoundary>;
}

export function App() {
  // Clear all cached queries when active role changes — prevents cross-role data leaks
  React.useEffect(() => {
    function handleRoleSwitch() {
      queryClient.clear();
    }
    window.addEventListener("ROLE_SWITCHED", handleRoleSwitch);
    return () => window.removeEventListener("ROLE_SWITCHED", handleRoleSwitch);
  }, []);

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

                  {/* ── Protected routes — all wrapped in Layout ────────────── */}
                  <Route element={<ProtectedRoute />}>
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
                      <Route
                        path="/attendance/record"
                        element={
                          <Guarded>
                            <FeatureGate featureKey="attendance">
                              <RecordAttendancePage />
                            </FeatureGate>
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
