/**
 * AssignedExamListPage — Teacher's view of exams
 *
 * Shows exams for the teacher's assigned class (filtered by classTeacherOf or
 * the classes visible through their timetable slots). Teachers enter marks per
 * exam subject via the MarksEntrySheetPage.
 *
 * API: GET /exams?classId=<classTeacherOf>
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { examsApi } from "@/api/exams.api";
import { useAuth } from "@/hooks/useAuth";
import { parseApiError } from "@/utils/errors";
import type { ExamStatus } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

const STATUS_BADGE: Record<ExamStatus, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-green-100 text-green-800",
  UNPUBLISHED: "bg-gray-100 text-gray-700",
};

function ExamStatusBadge({ status }: { status: ExamStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      {status}
    </span>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="animate-pulse border-b px-4 py-3 flex gap-4">
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
      <div className="h-6 w-20 bg-muted rounded" />
    </div>
  );
}

export default function AssignedExamListPage() {
  const { user } = useAuth();
  const classId = user?.classTeacherOf ?? undefined;
  const [statusFilter, setStatusFilter] = useState<ExamStatus | "">("");

  const examsQ = useQuery({
    queryKey: QUERY_KEYS.exams.list(
      classId
        ? { classId, status: statusFilter || undefined }
        : { status: statusFilter || undefined },
    ),
    queryFn: () =>
      examsApi.list(
        classId
          ? { classId, status: statusFilter || undefined }
          : { status: statusFilter || undefined },
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  const exams = examsQ.data?.exams ?? [];
  const apiError = examsQ.isError ? parseApiError(examsQ.error) : null;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Exams</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Exams for your assigned class
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ExamStatus | "")}
          aria-label="Filter by exam status"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="UNPUBLISHED">Unpublished</option>
        </select>
        {statusFilter && (
          <button
            onClick={() => setStatusFilter("")}
            className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Loading */}
      {examsQ.isLoading && (
        <div className="rounded-lg border overflow-hidden">
          {[1, 2, 3].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {examsQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiError?.message ?? "Failed to load exams."}
        </div>
      )}

      {/* Empty */}
      {!examsQ.isLoading && !examsQ.isError && exams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border bg-muted/10">
          <p className="text-sm text-muted-foreground">
            No exams found
            {statusFilter ? ` with status "${statusFilter}"` : ""}.
          </p>
        </div>
      )}

      {/* Exam list */}
      {!examsQ.isLoading && exams.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          {exams.map((exam, idx) => (
            <div
              key={exam.id}
              className={`flex items-center justify-between gap-4 px-4 py-3 flex-wrap${idx < exams.length - 1 ? " border-b" : ""}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{exam.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {exam.type} · {exam.className} · {exam.sessionName}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <ExamStatusBadge status={exam.status} />
                {exam.status !== "UNPUBLISHED" && (
                  <Link
                    to={`/teacher/exams/${exam.id}/marks`}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Enter marks for ${exam.name}`}
                  >
                    Enter Marks
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
