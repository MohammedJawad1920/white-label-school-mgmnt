/**
 * App.tsx — Root routing tree
 *
 * WHY React.lazy on every protected route:
 * Freeze §FE Phase 8: "all routes lazy-loaded via React.lazy".
 * Each route becomes its own JS chunk. Login page loads in ~20KB.
 * Full admin bundle downloads only when the user navigates there.
 *
 * Retry rules (Freeze §3):
 * - GET: retry 2×, exponential backoff, only on network error or 500
 * - mutations: never retry (non-idempotent)
 */
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { SessionExpiredModal } from "./SessionExpiredModal";

// ── Public pages ──────────────────────────────────────────────────────────────
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const PrivacyPage = lazy(() => import("@/features/static/PrivacyPage"));
const TermsPage = lazy(() => import("@/features/static/TermsPage"));

// ── Protected pages (lazy per Freeze §FE Phase 8) ─────────────────────────────
const Layout = lazy(() => import("@/components/Layout"));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const TimetablePage = lazy(() => import("@/features/timetable/TimetablePage"));
const RecordAttendancePage = lazy(
  () => import("@/features/attendance/RecordAttendancePage"),
);
const AttendanceSummaryPage = lazy(
  () => import("@/features/attendance/AttendanceSummaryPage"),
);
const StudentAttendanceHistory = lazy(
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

// ── QueryClient — typed retry callbacks (strict mode) ────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: unknown): boolean => {
        if (failureCount >= 2) return false;
        // Only retry network errors (no status) or 500
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        return status === undefined || status >= 500;
      },
      retryDelay: (attempt: number): number =>
        Math.min(1000 * 2 ** attempt, 4000), // 1s → 2s
      staleTime: 2 * 60 * 1000,
    },
    mutations: { retry: false },
  },
});

function PageLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      aria-label="Loading"
    >
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              {/* Protected — wrapped in Layout shell */}
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

                  {/* Admin only */}
                  <Route
                    path="/attendance/summary"
                    element={<AttendanceSummaryPage />}
                  />
                  <Route
                    path="/students/:studentId/attendance"
                    element={<StudentAttendanceHistory />}
                  />
                  <Route path="/manage/users" element={<UsersPage />} />
                  <Route path="/manage/students" element={<StudentsPage />} />
                  <Route path="/manage/classes" element={<ClassesPage />} />
                  <Route path="/manage/batches" element={<BatchesPage />} />
                  <Route path="/manage/subjects" element={<SubjectsPage />} />
                  <Route
                    path="/manage/school-periods"
                    element={<SchoolPeriodsPage />}
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
