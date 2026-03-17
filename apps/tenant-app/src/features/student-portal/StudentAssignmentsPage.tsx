/**
 * StudentAssignmentsPage — Read-only assignment list for student's class.
 *
 * Shows assignment title, subject, type, due date, and the student's
 * submission status (from the submission perspective).
 *
 * Path: /student/assignments
 */
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi } from "../../api/assignments.api";
import { useAuth } from "../../hooks/useAuth";
import { useCurrentSession } from "../../hooks/useCurrentSession";
import { parseApiError } from "../../utils/errors";
import { QUERY_KEYS } from "../../utils/queryKeys";
import type { SubmissionStatus } from "../../types/api";

const SUBMISSION_STYLES: Record<SubmissionStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  INCOMPLETE: "bg-red-100 text-red-800",
  NOT_SUBMITTED: "bg-gray-100 text-gray-700",
};

export default function StudentAssignmentsPage() {
  const { user } = useAuth();
  const currentSession = useCurrentSession();
  const studentId = user?.studentId ?? null;

  // Fetch assignments for the student's class in the current session.
  // The backend filters by tenantId from JWT; classId is inferred from student record.
  const assignmentsQ = useQuery({
    queryKey: QUERY_KEYS.assignments.list({
      sessionId: currentSession?.id,
    }),
    queryFn: () => assignmentsApi.list({ sessionId: currentSession?.id }),
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id && !!currentSession?.id,
  });

  const assignments = assignmentsQ.data?.assignments ?? [];
  const apiError = assignmentsQ.isError
    ? parseApiError(assignmentsQ.error)
    : null;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">My Assignments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your class assignments
          {currentSession ? ` — ${currentSession.name}` : ""}
        </p>
      </div>

      {/* Loading */}
      {assignmentsQ.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border bg-card p-4 space-y-2"
            >
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {assignmentsQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiError?.message ?? "Failed to load assignments."}
        </div>
      )}

      {/* Empty */}
      {!assignmentsQ.isLoading &&
        !assignmentsQ.isError &&
        assignments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border bg-muted/10">
            <p className="text-sm text-muted-foreground">
              No assignments found
              {currentSession ? ` for ${currentSession.name}` : ""}.
            </p>
          </div>
        )}

      {/* Assignment list */}
      {!assignmentsQ.isLoading && assignments.length > 0 && (
        <ul className="space-y-3">
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              <article className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {assignment.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {assignment.subjectName}
                      {assignment.dueDate && (
                        <span className="ml-2">
                          · Due: {assignment.dueDate}
                        </span>
                      )}
                      {assignment.maxMarks !== null && (
                        <span className="ml-2">
                          · Max marks: {assignment.maxMarks}
                        </span>
                      )}
                    </p>
                    {assignment.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {assignment.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      assignment.status === "OPEN"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {assignment.status}
                  </span>
                </div>

                {/* Type badge */}
                <div className="mt-2">
                  <span className="inline-flex items-center rounded px-2 py-0.5 text-xs bg-muted text-muted-foreground">
                    {assignment.assignmentType}
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {!studentId && (
        <p className="text-xs text-muted-foreground mt-4">
          Note: submission status is visible once your student profile is
          linked.
        </p>
      )}
    </div>
  );
}
