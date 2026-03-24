/**
 * AdminDashboardPage — Admin summary dashboard.
 * Cards: student count, active leave count, today's attendance %, upcoming exams count.
 */
import { useQuery } from "@tanstack/react-query";
import { studentsApi } from "@/api/students";
import { leaveApi } from "@/api/leave.api";
import { examsApi } from "@/api/exams.api";
import { attendanceApi } from "@/api/attendance";
import { useAuth } from "@/hooks/useAuth";
import { QUERY_KEYS } from "@/utils/queryKeys";

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

function StatCard({
  title,
  value,
  subtitle,
  color,
  isLoading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  isLoading?: boolean;
}) {
  return (
    <article
      className="rounded-lg border bg-card p-5"
      aria-label={`${title}: ${isLoading ? "loading" : value}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {isLoading ? (
        <div className="mt-2 h-8 w-1/2 animate-pulse bg-muted rounded" />
      ) : (
        <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      )}
      {subtitle && !isLoading && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </article>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const today = todayISO();

  // Total students
  const studentsQuery = useQuery({
    queryKey: QUERY_KEYS.custom("students", "count"),
    queryFn: () => studentsApi.list({ status: "Active" }),
    staleTime: 5 * 60 * 1000,
  });

  // Active leave (on-campus)
  const onCampusQuery = useQuery({
    queryKey: QUERY_KEYS.leave.onCampus(),
    queryFn: () => leaveApi.onCampus(),
    staleTime: 2 * 60 * 1000,
  });

  // Pending leaves
  const pendingLeavesQuery = useQuery({
    queryKey: QUERY_KEYS.custom("leave", { status: "PENDING" }),
    queryFn: () => leaveApi.list({ status: "PENDING" }),
    staleTime: 2 * 60 * 1000,
  });

  // Upcoming exams (DRAFT + PUBLISHED status)
  const upcomingExamsQuery = useQuery({
    queryKey: QUERY_KEYS.custom("exams", { status: "PUBLISHED" }),
    queryFn: () => examsApi.list({ status: "PUBLISHED" }),
    staleTime: 5 * 60 * 1000,
  });

  // Attendance summary for today
  const attendanceSummaryQuery = useQuery({
    queryKey: QUERY_KEYS.custom("attendance-summary", today),
    queryFn: () =>
      attendanceApi.getSummary({
        from: today,
        to: today,
      }),
    staleTime: 3 * 60 * 1000,
  });

  const studentCount = studentsQuery.data?.students?.length ?? 0;
  const onCampusCount = onCampusQuery.data?.leaves?.length ?? 0;
  const pendingLeaveCount = pendingLeavesQuery.data?.leaves?.length ?? 0;
  const publishedExamCount = upcomingExamsQuery.data?.exams?.length ?? 0;
  const attendanceRate =
    attendanceSummaryQuery.data?.summary?.averageAttendanceRate ?? null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back, {user?.name ?? "Admin"} · {today}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Active Students"
          value={studentCount}
          subtitle="Currently enrolled"
          color="text-foreground"
          isLoading={studentsQuery.isLoading}
        />
        <StatCard
          title="On Campus Leave"
          value={onCampusCount}
          subtitle={`${pendingLeaveCount} pending approval`}
          color={onCampusCount > 0 ? "text-blue-700" : "text-muted-foreground"}
          isLoading={onCampusQuery.isLoading}
        />
        <StatCard
          title="Today's Attendance"
          value={
            attendanceSummaryQuery.isLoading
              ? "—"
              : attendanceRate !== null
                ? `${attendanceRate.toFixed(1)}%`
                : "—"
          }
          subtitle="Average across all classes"
          color={
            attendanceRate === null
              ? "text-muted-foreground"
              : attendanceRate >= 80
                ? "text-green-700"
                : attendanceRate >= 60
                  ? "text-amber-700"
                  : "text-red-700"
          }
          isLoading={attendanceSummaryQuery.isLoading}
        />
        <StatCard
          title="Published Exams"
          value={publishedExamCount}
          subtitle="Active exam periods"
          color={
            publishedExamCount > 0 ? "text-violet-700" : "text-muted-foreground"
          }
          isLoading={upcomingExamsQuery.isLoading}
        />
      </div>

      {/* Quick actions */}
      <section
        aria-label="Quick actions"
        className="rounded-lg border bg-card p-4 mb-6"
      >
        <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Record Attendance", href: "/attendance/record" },
            { label: "Manage Leave", href: "/admin/leave" },
            { label: "View Exams", href: "/admin/exams" },
            { label: "Fee Charges", href: "/admin/fees" },
            { label: "Announcements", href: "/admin/announcements" },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {action.label}
            </a>
          ))}
        </div>
      </section>

      {/* Pending leaves */}
      {!pendingLeavesQuery.isLoading && pendingLeaveCount > 0 && (
        <section
          aria-label="Pending leave requests"
          className="rounded-lg border bg-card p-4 mb-6"
        >
          <h2 className="text-sm font-semibold mb-3">
            Pending Leave Requests
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs font-bold">
              {pendingLeaveCount}
            </span>
          </h2>
          <div className="space-y-2">
            {(pendingLeavesQuery.data?.leaves ?? [])
              .slice(0, 5)
              .map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between text-sm py-1.5 border-b last:border-b-0"
                >
                  <div>
                    <span className="font-medium">{leave.studentName}</span>
                    <span className="text-muted-foreground ml-2">
                      · {leave.className}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {leave.startDate} – {leave.endDate} ({leave.leaveType})
                  </div>
                </div>
              ))}
            {pendingLeaveCount > 5 && (
              <p className="text-xs text-muted-foreground pt-1">
                +{pendingLeaveCount - 5} more pending…
              </p>
            )}
          </div>
        </section>
      )}

      {/* Published exams */}
      {!upcomingExamsQuery.isLoading && publishedExamCount > 0 && (
        <section
          aria-label="Published exams"
          className="rounded-lg border bg-card p-4"
        >
          <h2 className="text-sm font-semibold mb-3">Published Exams</h2>
          <div className="space-y-2">
            {(upcomingExamsQuery.data?.exams ?? []).slice(0, 5).map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between text-sm py-1.5 border-b last:border-b-0"
              >
                <div>
                  <span className="font-medium">{exam.name}</span>
                  <span className="text-muted-foreground ml-2">
                    · {exam.className}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {exam.sessionName}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
