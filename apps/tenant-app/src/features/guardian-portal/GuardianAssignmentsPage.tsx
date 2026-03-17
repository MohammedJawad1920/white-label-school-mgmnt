import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useGuardianSelectedChild } from "../../hooks/useGuardianSelectedChild";
import { guardianPortalApi } from "../../api/guardian-portal.api";
import { QUERY_KEYS } from "../../utils/queryKeys";
import { getErrorMessage } from "../../utils/errors";
import { formatDisplayDate } from "../../utils/dates";
import type { Assignment, AssignmentType } from "../../types/api";

const TYPE_STYLES: Record<AssignmentType, string> = {
  HOMEWORK: "bg-blue-100 text-blue-800",
  PROJECT: "bg-purple-100 text-purple-800",
  CLASSWORK: "bg-gray-100 text-gray-800",
  QUIZ: "bg-amber-100 text-amber-800",
  LAB: "bg-teal-100 text-teal-800",
  OTHER: "bg-muted text-muted-foreground",
};

const TYPE_LABELS: Record<AssignmentType, string> = {
  HOMEWORK: "Homework",
  PROJECT: "Project",
  CLASSWORK: "Classwork",
  QUIZ: "Quiz",
  LAB: "Lab",
  OTHER: "Other",
};

function AssignmentTypeBadge({ type }: { type: AssignmentType }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_STYLES[type]}`}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

export default function GuardianAssignmentsPage() {
  const { selectedChildId, selectedChild, children, setSelectedChild } =
    useGuardianSelectedChild();

  const assignmentsQuery = useQuery({
    queryKey: QUERY_KEYS.guardianPortal.assignments(selectedChildId ?? ""),
    queryFn: () => guardianPortalApi.childAssignments(selectedChildId!),
    enabled: !!selectedChildId,
    staleTime: 5 * 60 * 1000,
  });

  const assignments: Assignment[] = assignmentsQuery.data?.assignments ?? [];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Assignments</h1>
      </div>

      {/* Child switcher */}
      {children.length > 1 && (
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">Viewing: </label>
          <select
            value={selectedChildId ?? ""}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.studentName}
              </option>
            ))}
          </select>
        </div>
      )}

      {!selectedChild ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading children...</p>
        </div>
      ) : (
        <>
          {/* Loading */}
          {assignmentsQuery.isLoading && (
            <div
              className="animate-pulse space-y-3"
              aria-busy="true"
              aria-label="Loading assignments"
            >
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-4">
                  <div className="flex justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                    <div className="h-6 w-16 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {assignmentsQuery.isError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {getErrorMessage(assignmentsQuery.error)}
            </div>
          )}

          {/* Empty */}
          {!assignmentsQuery.isLoading &&
            !assignmentsQuery.isError &&
            assignments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  No assignments found for {selectedChild.studentName}.
                </p>
              </div>
            )}

          {/* Assignment list */}
          {!assignmentsQuery.isLoading &&
            !assignmentsQuery.isError &&
            assignments.length > 0 && (
              <ul className="space-y-3" aria-label="Assignments">
                {assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="rounded-lg border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {assignment.title}
                          </span>
                          <AssignmentTypeBadge
                            type={assignment.assignmentType}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {assignment.subjectName} · {assignment.className}
                        </p>
                        {assignment.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            Due:{" "}
                            <span className="font-medium">
                              {formatDisplayDate(assignment.dueDate)}
                            </span>
                          </p>
                        )}
                        {assignment.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {assignment.description}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            assignment.status === "OPEN"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {assignment.status === "OPEN" ? "Open" : "Closed"}
                        </span>
                        {assignment.maxMarks !== null && (
                          <p className="mt-1 text-xs text-muted-foreground text-right">
                            Max: {assignment.maxMarks} marks
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </>
      )}
    </div>
  );
}
