import React, { lazy, Suspense, useEffect } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
} from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/features/auth/AuthContext";
import { pushApi } from "@/api/push.api";
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

// ── Phase 1: Admin pages ──────────────────────────────────────────────────────
const StudentListPage = lazy(
  () => import("@/features/students/StudentListPage"),
);
const CreateStudentPage = lazy(
  () => import("@/features/students/CreateStudentPage"),
);
const StudentDetailPage = lazy(
  () => import("@/features/students/StudentDetailPage"),
);
const LeaveManagementAdminPage = lazy(
  () => import("@/features/leave/LeaveManagementAdminPage"),
);
const AttendanceCorrectionPage = lazy(
  () => import("@/features/attendance/AttendanceCorrectionPage"),
);
const ExamListPage = lazy(() => import("@/features/exams/ExamListPage"));
const ExamDetailPage = lazy(() => import("@/features/exams/ExamDetailPage"));
const ConsolidatedResultsPage = lazy(
  () => import("@/features/exams/ConsolidatedResultsPage"),
);
const FeeChargeListPage = lazy(
  () => import("@/features/fees/FeeChargeListPage"),
);
const BulkChargeWizardPage = lazy(
  () => import("@/features/fees/BulkChargeWizardPage"),
);
const OutstandingFeesSummaryPage = lazy(
  () => import("@/features/fees/OutstandingFeesSummaryPage"),
);
const AssignmentListAdminPage = lazy(
  () => import("@/features/assignments/AssignmentListAdminPage"),
);
const CsvImportWizardPage = lazy(
  () => import("@/features/import/CsvImportWizardPage"),
);
const ImportHistoryPage = lazy(
  () => import("@/features/import/ImportHistoryPage"),
);
const GradeConfigPage = lazy(
  () => import("@/features/settings/GradeConfigPage"),
);
const FeatureFlagsPage = lazy(
  () => import("@/features/settings/FeatureFlagsPage"),
);
const AnnouncementFeedPage = lazy(
  () => import("@/features/announcements/AnnouncementFeedPage"),
);
const CreateAnnouncementPage = lazy(
  () => import("@/features/announcements/CreateAnnouncementPage"),
);
const EditAnnouncementPage = lazy(
  () => import("@/features/announcements/EditAnnouncementPage"),
);
const NotificationHistoryPage = lazy(
  () => import("@/features/notifications/NotificationHistoryPage"),
);
const AdminDashboardPage = lazy(
  () => import("@/features/dashboard/AdminDashboardPage"),
);

// ── Phase 1: Teacher pages ────────────────────────────────────────────────────
const TeacherDashboardPage = lazy(
  () => import("@/features/dashboard/TeacherDashboardPage"),
);
const TeacherTimetablePage = lazy(
  () => import("@/features/timetable/TeacherTimetablePage"),
);
const LeaveQueueClassTeacherPage = lazy(
  () => import("@/features/leave/LeaveQueueClassTeacherPage"),
);
const AssignedExamListPage = lazy(
  () => import("@/features/exams/AssignedExamListPage"),
);
const MarksEntrySheetPage = lazy(
  () => import("@/features/exams/MarksEntrySheetPage"),
);
const AssignmentListTeacherPage = lazy(
  () => import("@/features/assignments/AssignmentListTeacherPage"),
);

// ── Phase 1: Student portal pages ────────────────────────────────────────────
const StudentDashboardPage = lazy(
  () => import("@/features/student-portal/StudentDashboardPage"),
);
const StudentAttendancePage = lazy(
  () => import("@/features/student-portal/StudentAttendancePage"),
);
const StudentResultsPage = lazy(
  () => import("@/features/student-portal/StudentResultsPage"),
);
const StudentAssignmentsPage = lazy(
  () => import("@/features/student-portal/StudentAssignmentsPage"),
);
const StudentFeesPage = lazy(
  () => import("@/features/student-portal/StudentFeesPage"),
);
const StudentTimetablePage = lazy(
  () => import("@/features/student-portal/StudentTimetablePage"),
);
const StudentAnnouncementsPage = lazy(
  () => import("@/features/student-portal/StudentAnnouncementsPage"),
);

// ── Phase 1: Guardian portal pages ───────────────────────────────────────────
const GuardianDashboardPage = lazy(
  () => import("@/features/guardian-portal/GuardianDashboardPage"),
);
const GuardianAttendancePage = lazy(
  () => import("@/features/guardian-portal/GuardianAttendancePage"),
);
const GuardianLeaveHistoryPage = lazy(
  () => import("@/features/guardian-portal/GuardianLeaveHistoryPage"),
);
const GuardianLeaveFormPage = lazy(
  () => import("@/features/guardian-portal/GuardianLeaveFormPage"),
);
const GuardianResultsPage = lazy(
  () => import("@/features/guardian-portal/GuardianResultsPage"),
);
const GuardianFeesPage = lazy(
  () => import("@/features/guardian-portal/GuardianFeesPage"),
);
const GuardianAssignmentsPage = lazy(
  () => import("@/features/guardian-portal/GuardianAssignmentsPage"),
);
const GuardianTimetablePage = lazy(
  () => import("@/features/guardian-portal/GuardianTimetablePage"),
);

// ── v5.0: Boot-time VITE_TENANT_ID validation ────────────────────────────────
const TENANT_ID = import.meta.env.VITE_TENANT_ID as string | undefined;
// H-02: Freeze §1.5 — VITE_TENANT_ID must be a valid UUID.
// tenants.id is UUID type after migration 018.
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

// ── Role-aware post-login redirect ────────────────────────────────────────────
// Landing at "/" (index) sends each role to their Phase 1 dashboard.
// This runs inside <AuthProvider> so useAuth() is available.
function DashboardRedirect() {
  const { user } = useAuth();
  switch (user?.activeRole) {
    case "Admin":
      return <Navigate to="/admin/dashboard" replace />;
    case "Teacher":
      return <Navigate to="/teacher/dashboard" replace />;
    case "Student":
      return <Navigate to="/student/dashboard" replace />;
    case "Guardian":
      return <Navigate to="/guardian/dashboard" replace />;
    default:
      return <Navigate to="/admin/dashboard" replace />;
  }
}

// ── Per-route error boundary wrapper ─────────────────────────────────────────
function Guarded({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary fallbackRender={RouteError}>{children}</ErrorBoundary>;
}

// ── PWA effects — SW message handler + push subscription ─────────────────────
// Must live inside <AuthProvider> so it can access the auth context.
function PwaEffects() {
  const { user } = useAuth();

  // CR-FE-038: Listen for PUSH_CLICK messages from the service worker and
  // navigate to the deep-link route embedded in the notification payload.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent<unknown>) => {
      const data = event.data as { type?: unknown; route?: unknown } | null;
      if (data?.type === "PUSH_CLICK" && typeof data.route === "string") {
        window.location.href = data.route;
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // Subscribe to Web Push after the user logs in.
  // Skipped silently when VITE_VAPID_PUBLIC_KEY is not set (Phase 0 / Phase 1 builds).
  useEffect(() => {
    if (
      !user ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    )
      return;

    const vapidKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "") as string;
    if (!vapidKey) return;

    async function subscribeToPush() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return; // already subscribed — nothing to do

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });

        const subJson = sub.toJSON();
        const endpoint = subJson.endpoint ?? "";
        const p256dh = subJson.keys?.["p256dh"] ?? "";
        const auth = subJson.keys?.["auth"] ?? "";

        await pushApi.subscribe({ endpoint, p256dh, auth });
      } catch {
        // Push permission denied or subscription failed — fail silently.
        // A dismissible banner can be added here in a future CR.
      }
    }

    void subscribeToPush();
  }, [user]);

  return null;
}

// ── App shell — global overlays present on every route ───────────────────────
// Rendered as the root layout element so SessionExpiredModal, push effects,
// and the toast container are available to all routes via the data router.
function AppShell() {
  return (
    <>
      <SessionExpiredModal />
      <PwaEffects />
      <Toaster richColors closeButton />
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </>
  );
}

// ── Router — createBrowserRouter enables useBlocker (Freeze §2 M-01fe) ───────
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppShell />}>
      {/* ── Public routes ───────────────────────────────────────────── */}
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

      {/* ── Protected routes ────────────────────────────────────────── */}
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
          <Route index element={<DashboardRedirect />} />

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

          {/* Phase 1: Student management — Admin only */}
          <Route
            path="/admin/students"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <StudentListPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/students/new"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <CreateStudentPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/students/:id"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <StudentDetailPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Leave management — Admin only */}
          <Route
            path="/admin/leave"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <LeaveManagementAdminPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Attendance correction — Admin only */}
          <Route
            path="/admin/attendance/correction"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <FeatureGate featureKey="attendance">
                    <AttendanceCorrectionPage />
                  </FeatureGate>
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Exams — Admin only */}
          <Route
            path="/admin/exams"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <ExamListPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/exams/:examId"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <ExamDetailPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/exams/:examId/results"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <ConsolidatedResultsPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Fees — Admin only */}
          <Route
            path="/admin/fees"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <FeeChargeListPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/fees/bulk"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <BulkChargeWizardPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/fees/summary"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <OutstandingFeesSummaryPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Assignments — Admin only */}
          <Route
            path="/admin/assignments"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <AssignmentListAdminPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: CSV Import — Admin only */}
          <Route
            path="/admin/import"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <CsvImportWizardPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/import/history"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <ImportHistoryPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Settings — Admin only */}
          <Route
            path="/admin/settings/grades"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <GradeConfigPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/settings/features"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <FeatureFlagsPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Announcements — Admin view + create/edit for Admin+Teacher */}
          <Route
            path="/admin/announcements"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <AnnouncementFeedPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/announcements/new"
            element={
              <Guarded>
                <RoleGate roles={["Admin", "Teacher"]}>
                  <CreateAnnouncementPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/announcements/:announcementId/edit"
            element={
              <Guarded>
                <RoleGate roles={["Admin", "Teacher"]}>
                  <EditAnnouncementPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Freeze §2 shared announcement routes — all authenticated roles */}
          <Route
            path="/announcements"
            element={
              <Guarded>
                <AnnouncementFeedPage />
              </Guarded>
            }
          />
          <Route
            path="/announcements/new"
            element={
              <Guarded>
                <RoleGate roles={["Admin", "Teacher"]}>
                  <CreateAnnouncementPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/announcements/:announcementId/edit"
            element={
              <Guarded>
                <RoleGate roles={["Admin", "Teacher"]}>
                  <EditAnnouncementPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Notifications — any authenticated role */}
          <Route
            path="/notifications"
            element={
              <Guarded>
                <NotificationHistoryPage />
              </Guarded>
            }
          />

          {/* Phase 1: Teacher portal routes */}
          <Route
            path="/teacher/leave"
            element={
              <Guarded>
                <RoleGate roles={["Teacher"]}>
                  <LeaveQueueClassTeacherPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/teacher/exams"
            element={
              <Guarded>
                <RoleGate roles={["Teacher"]}>
                  <AssignedExamListPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/teacher/exams/:examId/subjects/:subjectId/marks"
            element={
              <Guarded>
                <RoleGate roles={["Teacher"]}>
                  <MarksEntrySheetPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/teacher/assignments"
            element={
              <Guarded>
                <RoleGate roles={["Teacher"]}>
                  <AssignmentListTeacherPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/teacher/announcements"
            element={
              <Guarded>
                <RoleGate roles={["Teacher"]}>
                  <AnnouncementFeedPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Student portal routes */}
          <Route
            path="/student/attendance"
            element={
              <Guarded>
                <RoleGate roles={["Student"]}>
                  <FeatureGate featureKey="attendance">
                    <StudentAttendancePage />
                  </FeatureGate>
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/student/results"
            element={
              <Guarded>
                <RoleGate roles={["Student"]}>
                  <StudentResultsPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/student/assignments"
            element={
              <Guarded>
                <RoleGate roles={["Student"]}>
                  <StudentAssignmentsPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/student/fees"
            element={
              <Guarded>
                <RoleGate roles={["Student"]}>
                  <StudentFeesPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/student/announcements"
            element={
              <Guarded>
                <RoleGate roles={["Student"]}>
                  <StudentAnnouncementsPage />
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Guardian portal routes */}
          <Route
            path="/guardian/dashboard"
            element={
              <Guarded>
                <RoleGate roles={["Guardian"]}>
                  <GuardianDashboardPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/guardian/attendance"
            element={
              <Guarded>
                <RoleGate roles={["Guardian"]}>
                  <FeatureGate featureKey="attendance">
                    <GuardianAttendancePage />
                  </FeatureGate>
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/guardian/leave"
            element={
              <Guarded>
                <RoleGate roles={["Guardian"]}>
                  <GuardianLeaveHistoryPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/guardian/leave/new"
            element={
              <Guarded>
                <RoleGate roles={["Guardian"]}>
                  <GuardianLeaveFormPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/guardian/results"
            element={
              <Guarded>
                <RoleGate roles={["Guardian"]}>
                  <GuardianResultsPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/guardian/fees"
            element={
              <Guarded>
                <RoleGate roles={["Guardian"]}>
                  <GuardianFeesPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/guardian/assignments"
            element={
              <Guarded>
                <RoleGate roles={["Guardian"]}>
                  <GuardianAssignmentsPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/guardian/timetable"
            element={
              <Guarded>
                <RoleGate roles={["Guardian"]}>
                  <FeatureGate featureKey="timetable">
                    <GuardianTimetablePage />
                  </FeatureGate>
                </RoleGate>
              </Guarded>
            }
          />

          {/* Phase 1: Role-prefixed dashboard and alias routes */}
          <Route
            path="/admin/dashboard"
            element={
              <Guarded>
                <RoleGate roles={["Admin"]}>
                  <AdminDashboardPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/teacher/dashboard"
            element={
              <Guarded>
                <RoleGate roles={["Teacher"]}>
                  <TeacherDashboardPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/student/dashboard"
            element={
              <Guarded>
                <RoleGate roles={["Student"]}>
                  <StudentDashboardPage />
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/admin/timetable"
            element={<Navigate to="/timetable" replace />}
          />
          <Route
            path="/teacher/timetable"
            element={
              <Guarded>
                <RoleGate roles={["Teacher"]}>
                  <FeatureGate featureKey="timetable">
                    <TeacherTimetablePage />
                  </FeatureGate>
                </RoleGate>
              </Guarded>
            }
          />
          <Route
            path="/student/timetable"
            element={
              <Guarded>
                <RoleGate roles={["Student"]}>
                  <FeatureGate featureKey="timetable">
                    <StudentTimetablePage />
                  </FeatureGate>
                </RoleGate>
              </Guarded>
            }
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

          {/* Freeze §2 URL aliases — canonical path redirects */}
          <Route
            path="/admin/attendance/correct"
            element={
              <Navigate to="/admin/attendance/correction" replace />
            }
          />
          <Route
            path="/admin/settings/grade-config"
            element={
              <Navigate to="/admin/settings/grades" replace />
            }
          />
          {/* Freeze §2 marks entry alias: /teacher/exams/:examId/marks/:subjectId */}
          <Route
            path="/teacher/exams/:examId/marks/:subjectId"
            element={
              <Guarded>
                <RoleGate roles={["Teacher"]}>
                  <MarksEntrySheetPage />
                </RoleGate>
              </Guarded>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<DashboardRedirect />} />
    </Route>
  ),
);

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
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
