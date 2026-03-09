import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  // Clear all cached queries when active role changes so pages refetch with new JWT
  React.useEffect(() => {
    function handleRoleSwitch() {
      queryClient.removeQueries();
    }
    window.addEventListener("ROLE_SWITCHED", handleRoleSwitch);
    return () => window.removeEventListener("ROLE_SWITCHED", handleRoleSwitch);
  }, []);

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

                  {/* Teacher + Admin — timetable feature-gated */}
                  <Route
                    path="/dashboard"
                    element={
                      <FeatureGate featureKey="timetable">
                        <DashboardPage />
                      </FeatureGate>
                    }
                  />
                  <Route
                    path="/timetable"
                    element={
                      <FeatureGate featureKey="timetable">
                        <TimetablePage />
                      </FeatureGate>
                    }
                  />
                  <Route
                    path="/attendance/record"
                    element={
                      <FeatureGate featureKey="attendance">
                        <RecordAttendancePage />
                      </FeatureGate>
                    }
                  />

                  {/* Admin only — inline "Not authorized" for Teacher per Freeze §2 */}
                  <Route
                    path="/attendance/summary"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <FeatureGate featureKey="attendance">
                          <AttendanceSummaryPage />
                        </FeatureGate>
                      </RoleGate>
                    }
                  />
                  <Route
                    path="/students/:studentId/attendance"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <FeatureGate featureKey="attendance">
                          <StudentAttendanceHistoryPage />
                        </FeatureGate>
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
                        <FeatureGate featureKey="timetable">
                          <SchoolPeriodsPage />
                        </FeatureGate>
                      </RoleGate>
                    }
                  />

                  {/* v4.5 CR-36: Monthly sheet — Admin + Teacher */}
                  <Route
                    path="/attendance/monthly-sheet"
                    element={
                      <RoleGate roles={["Admin", "Teacher"]}>
                        <FeatureGate featureKey="attendance">
                          <MonthlySheetPage />
                        </FeatureGate>
                      </RoleGate>
                    }
                  />

                  {/* v4.5 CR-37: Events — Admin only */}
                  <Route
                    path="/manage/events"
                    element={
                      <RoleGate roles={["Admin"]}>
                        <EventsPage />
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
