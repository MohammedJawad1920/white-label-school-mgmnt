/**
 * StudentDashboardPage — Student portal dashboard
 *
 * Shows:
 *   - Attendance summary (present/absent/late counts for current month)
 *   - Recent announcements (≤ 3)
 *   - Upcoming exams (DRAFT or PUBLISHED in current session)
 *
 * Path: /student/dashboard
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { attendanceApi } from "../../api/attendance";
import { announcementsApi } from "../../api/announcements.api";
import { examsApi } from "../../api/exams.api";
import { useAuth } from "../../hooks/useAuth";
import { useCurrentSession } from "../../hooks/useCurrentSession";
import { parseApiError } from "../../utils/errors";
import { QUERY_KEYS } from "../../utils/queryKeys";

function thisYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// ── Skeleton card ─────────────────────────────────────────────────────────
function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-4 space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 bg-muted rounded ${i === 0 ? "w-1/3" : i === 1 ? "w-2/3" : "w-1/2"}`}
        />
      ))}
    </div>
  );
}

// ── Attendance summary card ────────────────────────────────────────────────
function AttendanceSummaryCard() {
  const { user } = useAuth();
  const studentId = user?.studentId ?? null;
  const { year, month } = thisYearMonth();

  const summaryQ = useQuery({
    queryKey: QUERY_KEYS.studentAttendanceSummary(studentId ?? "", year, month),
    queryFn: () => attendanceApi.getStudentSummary(studentId!, year, month),
    staleTime: 5 * 60 * 1000,
    enabled: !!studentId,
  });

  if (!studentId)
    return (
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-2">Attendance This Month</h2>
        <p className="text-xs text-muted-foreground">
          Student profile not linked.
        </p>
      </section>
    );

  if (summaryQ.isLoading) return <SkeletonCard lines={4} />;

  if (summaryQ.isError) {
    const err = parseApiError(summaryQ.error);
    return (
      <section className="rounded-lg border bg-destructive/10 p-4">
        <h2 className="text-sm font-semibold mb-1">Attendance This Month</h2>
        <p className="text-xs text-destructive">{err.message}</p>
      </section>
    );
  }

  const s = summaryQ.data?.summary;
  return (
    <section
      className="rounded-lg border bg-card p-4"
      aria-label="Attendance summary this month"
    >
      <h2 className="text-sm font-semibold mb-3">Attendance This Month</h2>
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-md bg-green-50 p-2">
          <div className="text-lg font-bold text-green-700">
            {s?.present ?? 0}
          </div>
          <div className="text-xs text-green-600">Present</div>
        </div>
        <div className="rounded-md bg-red-50 p-2">
          <div className="text-lg font-bold text-red-700">{s?.absent ?? 0}</div>
          <div className="text-xs text-red-600">Absent</div>
        </div>
        <div className="rounded-md bg-amber-50 p-2">
          <div className="text-lg font-bold text-amber-700">{s?.late ?? 0}</div>
          <div className="text-xs text-amber-600">Late</div>
        </div>
      </div>
      {s && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          {s.attendancePercentage.toFixed(1)}% attendance rate
        </p>
      )}
      <Link
        to="/student/attendance"
        className="mt-3 block text-center text-xs text-primary hover:underline underline-offset-2"
      >
        View full calendar
      </Link>
    </section>
  );
}

// ── Recent announcements card ──────────────────────────────────────────────
function RecentAnnouncementsCard() {
  const announcementsQ = useQuery({
    queryKey: QUERY_KEYS.announcements.list({ limit: 3, offset: 0 }),
    queryFn: () => announcementsApi.list({ limit: 3, offset: 0 }),
    staleTime: 5 * 60 * 1000,
  });

  if (announcementsQ.isLoading) return <SkeletonCard lines={3} />;

  const announcements = announcementsQ.data?.announcements ?? [];

  return (
    <section
      className="rounded-lg border bg-card p-4"
      aria-label="Recent announcements"
    >
      <h2 className="text-sm font-semibold mb-3">Recent Announcements</h2>
      {announcements.length === 0 ? (
        <p className="text-xs text-muted-foreground">No announcements.</p>
      ) : (
        <ul className="space-y-2">
          {announcements.map((ann) => (
            <li
              key={ann.id}
              className="text-sm border-b last:border-b-0 pb-2 last:pb-0"
            >
              <p className="font-medium truncate">{ann.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(ann.createdAt).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/student/announcements"
        className="mt-3 block text-center text-xs text-primary hover:underline underline-offset-2"
      >
        View all
      </Link>
    </section>
  );
}

// ── Upcoming exams card ────────────────────────────────────────────────────
function UpcomingExamsCard() {
  const { user } = useAuth();
  const currentSession = useCurrentSession();

  const examsQ = useQuery({
    queryKey: QUERY_KEYS.exams.list({
      sessionId: currentSession?.id,
    }),
    queryFn: () =>
      examsApi.list({
        sessionId: currentSession?.id,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!currentSession?.id && !!user?.id,
  });

  if (examsQ.isLoading) return <SkeletonCard lines={3} />;

  const exams = (examsQ.data?.exams ?? []).filter(
    (e) => e.status === "DRAFT" || e.status === "PUBLISHED",
  );

  return (
    <section
      className="rounded-lg border bg-card p-4"
      aria-label="Upcoming exams"
    >
      <h2 className="text-sm font-semibold mb-3">Upcoming Exams</h2>
      {exams.length === 0 ? (
        <p className="text-xs text-muted-foreground">No upcoming exams.</p>
      ) : (
        <ul className="space-y-2">
          {exams.slice(0, 4).map((exam) => (
            <li
              key={exam.id}
              className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0 gap-2"
            >
              <p className="font-medium truncate">{exam.name}</p>
              <span
                className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  exam.status === "PUBLISHED"
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {exam.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/student/results"
        className="mt-3 block text-center text-xs text-primary hover:underline underline-offset-2"
      >
        View results
      </Link>
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function StudentDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back{user ? `, ${user.name}` : ""}.
        </p>
      </div>

      <div className="space-y-4">
        <AttendanceSummaryCard />
        <RecentAnnouncementsCard />
        <UpcomingExamsCard />
      </div>
    </div>
  );
}
