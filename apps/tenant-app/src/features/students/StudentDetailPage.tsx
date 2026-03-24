/**
 * StudentDetailPage — Shows student detail + their guardians list.
 * GET /students (list + find by id), GET /students/:id/guardians
 */
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentsApi } from "@/api/students";
import { guardiansApi } from "@/api/guardians.api";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import { useAuth } from "@/hooks/useAuth";
import type { Guardian } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useAppToast();
  const { user } = useAuth();
  const isAdmin = user?.activeRole === "Admin";

  const studentQuery = useQuery({
    queryKey: QUERY_KEYS.custom("students", "list"),
    queryFn: () => studentsApi.list(),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  });

  const guardiansQuery = useQuery({
    queryKey: QUERY_KEYS.custom("guardians", "student", id),
    queryFn: () => guardiansApi.listForStudent(id!),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  });

  const deleteGuardianMut = useMutation({
    mutationFn: (guardianId: string) => guardiansApi.delete(guardianId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.custom("guardians", "student", id) });
      toast.success("Guardian removed.");
    },
    onError: (err) => {
      toast.mutationError(parseApiError(err).message);
    },
  });

  const student = studentQuery.data?.students.find((s) => s.id === id) ?? null;
  const guardians = guardiansQuery.data?.guardians ?? [];

  if (studentQuery.isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="rounded-lg border p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (studentQuery.isError || (!studentQuery.isLoading && !student)) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          {studentQuery.isError
            ? parseApiError(studentQuery.error).message
            : "Student not found."}
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{student?.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Student detail</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          Back
        </button>
      </div>

      {/* Student Info card */}
      <section
        aria-label="Student information"
        className="rounded-lg border bg-card p-4 mb-6"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Student Information
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium mt-0.5">{student?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Admission Number</dt>
            <dd className="font-mono mt-0.5">
              {student?.admissionNumber ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Login ID</dt>
            <dd className="font-mono mt-0.5">{student?.loginId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Date of Birth</dt>
            <dd className="mt-0.5">{student?.dob ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Class</dt>
            <dd className="mt-0.5">
              {student?.className ?? (student?.classId ? student.classId : "—")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Batch</dt>
            <dd className="mt-0.5">
              {student?.batchName ?? student?.batchId ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-0.5">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  student?.status === "Active"
                    ? "bg-green-100 text-green-800"
                    : student?.status === "DroppedOff"
                      ? "bg-red-100 text-red-800"
                      : "bg-purple-100 text-purple-800"
                }`}
              >
                {student?.status === "DroppedOff"
                  ? "Dropped Off"
                  : student?.status}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Guardians section */}
      <section aria-label="Guardians">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Guardians
          </h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate(`/admin/students/${id}/guardians/add`)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + Add Guardian
            </button>
          )}
        </div>

        {guardiansQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : guardiansQuery.isError ? (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
          >
            {parseApiError(guardiansQuery.error).message}
          </div>
        ) : guardians.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            No guardians linked to this student.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">Guardian list</caption>
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                  >
                    Relationship
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                  >
                    Phone
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                  >
                    Can Submit Leave
                  </th>
                  {isAdmin && (
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right font-medium text-muted-foreground"
                    >
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {guardians.map((g: Guardian) => (
                  <tr
                    key={g.id}
                    className="border-b last:border-b-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2.5 font-medium">{g.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {g.relationship}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {g.phone ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          g.canSubmitLeave
                            ? "bg-green-100 text-green-800"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {g.canSubmitLeave ? "Yes" : "No"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/admin/students/${id}/guardians/${g.id}/edit`,
                              )
                            }
                            className="rounded px-2.5 py-1 text-xs font-medium border border-input hover:bg-muted transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(`Remove guardian "${g.name}"?`)
                              ) {
                                deleteGuardianMut.mutate(g.id);
                              }
                            }}
                            disabled={deleteGuardianMut.isPending}
                            className="rounded px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
