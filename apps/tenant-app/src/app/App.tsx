import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { SessionExpiredModal } from "./SessionExpiredModal";
import { RoleGate } from "./RoleGate";

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

// ── QueryClient — retry rules from Freeze §3 ─────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: unknown): boolean => {
        if (failureCount >= 2) return false;
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        return status === undefined || status >= 500;
      },
      retryDelay: (attempt: number): number =>
        Math.min(1000 * 2 ** attempt, 4000),
      staleTime: 2 * 60 * 1000,
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

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <SessionExpiredModal />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Public routes ─────────────────────────────────────────── */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              {/* ── Protected routes — all wrapped in Layout ──────────────── */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />

                  {/* Teacher + Admin */}
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/timetable" element={<TimetablePage />} />
                  <Route
                    path="/attendance/record"
                    element={<RecordAttendancePage />}
                  />

                  {/* Admin only — inline "Not authorized" for Teacher per Freeze §2 */}
                  <Route
                    path="/attendance/summary"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <AttendanceSummaryPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="/students/:studentId/attendance"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <StudentAttendanceHistoryPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="/manage/users"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <UsersPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="/manage/students"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <StudentsPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="/manage/classes"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <ClassesPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="/manage/batches"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <BatchesPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="/manage/subjects"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <SubjectsPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="/manage/school-periods"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <SchoolPeriodsPage />
                      </RoleGate>
                    }
                  />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
