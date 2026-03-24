/**
 * AssignmentListAdminPage — All assignments table.
 * Filter by classId, status.
 * Create assignment inline form.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { assignmentsApi } from "@/api/assignments.api";
import { classesApi } from "@/api/classes";
import { subjectsApi } from "@/api/subjects";
import { academicSessionsApi } from "@/api/academicSessions";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import type { Assignment } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

const ASSIGNMENT_TYPES = [
  "HOMEWORK",
  "PROJECT",
  "CLASSWORK",
  "QUIZ",
  "LAB",
  "OTHER",
] as const;

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  assignmentType: z.enum(ASSIGNMENT_TYPES),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  sessionId: z.string().min(1, "Session is required"),
  dueDate: z.string().optional(),
  maxMarks: z
    .number({ invalid_type_error: "Must be a number" })
    .positive()
    .optional(),
});
type CreateFormValues = z.infer<typeof createSchema>;

const inputCls = (err: boolean) =>
  `w-full rounded-md border ${err ? "border-destructive" : "border-input"} bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function CreateAssignmentForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useAppToast();

  const { data: classesData } = useQuery({
    queryKey: QUERY_KEYS.classes(),
    queryFn: () => classesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: subjectsData } = useQuery({
    queryKey: QUERY_KEYS.subjects(),
    queryFn: () => subjectsApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: sessionsData } = useQuery({
    queryKey: QUERY_KEYS.custom("academic-sessions"),
    queryFn: () => academicSessionsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { assignmentType: "HOMEWORK" },
  });

  const mutation = useMutation({
    mutationFn: (v: CreateFormValues) => assignmentsApi.create(v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.assignments.all() });
      toast.success("Assignment created.");
      onClose();
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  return (
    <form
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      noValidate
      className="rounded-lg border bg-card p-4 mb-5 space-y-4"
    >
      <h2 className="text-sm font-semibold">New Assignment</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label
            htmlFor="asgn-title"
            className="block text-xs font-medium mb-1"
          >
            Title *
          </label>
          <input
            id="asgn-title"
            type="text"
            className={inputCls(!!errors.title)}
            {...register("title")}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-destructive">
              {errors.title.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="asgn-type" className="block text-xs font-medium mb-1">
            Type *
          </label>
          <select
            id="asgn-type"
            className={inputCls(!!errors.assignmentType)}
            {...register("assignmentType")}
          >
            {ASSIGNMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="asgn-session"
            className="block text-xs font-medium mb-1"
          >
            Session *
          </label>
          <select
            id="asgn-session"
            className={inputCls(!!errors.sessionId)}
            {...register("sessionId")}
          >
            <option value="">Select session…</option>
            {(sessionsData?.sessions ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.sessionId && (
            <p className="mt-1 text-xs text-destructive">
              {errors.sessionId.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="asgn-class"
            className="block text-xs font-medium mb-1"
          >
            Class *
          </label>
          <select
            id="asgn-class"
            className={inputCls(!!errors.classId)}
            {...register("classId")}
          >
            <option value="">Select class…</option>
            {(classesData?.classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.classId && (
            <p className="mt-1 text-xs text-destructive">
              {errors.classId.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="asgn-subject"
            className="block text-xs font-medium mb-1"
          >
            Subject *
          </label>
          <select
            id="asgn-subject"
            className={inputCls(!!errors.subjectId)}
            {...register("subjectId")}
          >
            <option value="">Select subject…</option>
            {(subjectsData?.subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.subjectId && (
            <p className="mt-1 text-xs text-destructive">
              {errors.subjectId.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="asgn-due" className="block text-xs font-medium mb-1">
            Due Date (optional)
          </label>
          <input
            id="asgn-due"
            type="date"
            className={inputCls(false)}
            {...register("dueDate")}
          />
        </div>
        <div>
          <label
            htmlFor="asgn-marks"
            className="block text-xs font-medium mb-1"
          >
            Max Marks (optional)
          </label>
          <input
            id="asgn-marks"
            type="number"
            min={1}
            className={inputCls(!!errors.maxMarks)}
            {...register("maxMarks", { valueAsNumber: true })}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="asgn-desc" className="block text-xs font-medium mb-1">
            Description (optional)
          </label>
          <textarea
            id="asgn-desc"
            rows={2}
            className={inputCls(false)}
            {...register("description")}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? "Creating…" : "Create Assignment"}
        </button>
      </div>
    </form>
  );
}

export default function AssignmentListAdminPage() {
  const qc = useQueryClient();
  const toast = useAppToast();
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CLOSED" | "">("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: QUERY_KEYS.classes(),
    queryFn: () => classesApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const assignmentsQuery = useQuery({
    queryKey: QUERY_KEYS.custom("assignments", { classId: classFilter, status: statusFilter }),
    queryFn: () =>
      assignmentsApi.list({
        classId: classFilter || undefined,
        status: statusFilter || undefined,
      }),
    staleTime: 2 * 60 * 1000,
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => assignmentsApi.close(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.assignments.all() });
      toast.success("Assignment closed.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => assignmentsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.assignments.all() });
      toast.success("Assignment deleted.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const assignments = assignmentsQuery.data?.assignments ?? [];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Assignments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage all assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {showCreate ? "Cancel" : "+ Create Assignment"}
        </button>
      </div>

      {showCreate && (
        <CreateAssignmentForm onClose={() => setShowCreate(false)} />
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="Filter by class"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Classes</option>
          {(classesData?.classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "OPEN" | "CLOSED" | "")
          }
          aria-label="Filter by status"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {assignmentsQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {parseApiError(assignmentsQuery.error).message}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Assignments</caption>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Title
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Class
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Subject
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Type
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Due
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {assignmentsQuery.isLoading && (
              <tr>
                <td colSpan={7} className="p-0">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex gap-4 px-4 py-3 border-b animate-pulse"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                        <Skeleton key={j} className="h-4 w-20 flex-1" />
                      ))}
                    </div>
                  ))}
                </td>
              </tr>
            )}
            {!assignmentsQuery.isLoading && assignments.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No assignments found.
                </td>
              </tr>
            )}
            {assignments.map((a: Assignment) => (
              <tr
                key={a.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">
                  {a.title}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.className}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.subjectName}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.assignmentType}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.dueDate ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.status === "OPEN"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    {a.status === "OPEN" && (
                      <button
                        type="button"
                        disabled={closeMut.isPending}
                        onClick={() => closeMut.mutate(a.id)}
                        className="rounded px-2.5 py-1 text-xs font-medium border border-input hover:bg-muted disabled:opacity-50"
                      >
                        Close
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (window.confirm("Delete this assignment?"))
                          deleteMut.mutate(a.id);
                      }}
                      className="rounded px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
