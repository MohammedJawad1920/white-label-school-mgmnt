/**
 * SessionListPage — v5.0 M-013
 *
 * Route: /admin/sessions (Admin only)
 * API:
 *   GET  /academic-sessions        — list all sessions
 *   POST /academic-sessions        — create
 *   PUT  /academic-sessions/:id/activate — activate (UPCOMING → ACTIVE)
 *   PUT  /academic-sessions/:id/close    — close (ACTIVE → COMPLETED)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { academicSessionsApi } from "@/api/academicSessions";
import { parseApiError } from "@/utils/errors";
import { QUERY_KEYS } from "@/utils/queryKeys";
import type {
  AcademicSession,
  AcademicSessionStatus,
  CreateSessionRequest,
} from "@/types/api";

// ── Status badge helpers ──────────────────────────────────────────────────────
function statusBadgeCls(status: AcademicSessionStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-700";
    case "UPCOMING":
      return "bg-blue-100 text-blue-700";
    case "COMPLETED":
      return "bg-gray-100 text-gray-600";
  }
}

// ── Zod schema ───────────────────────────────────────────────────────────────
const schema = z
  .object({
    name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .refine((d) => d.endDate > d.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

export default function SessionListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: QUERY_KEYS.sessionsList(),
    queryFn: () => academicSessionsApi.list(),
    staleTime: 60 * 1000, // H-09fe: 60 s per Freeze Screen spec
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateSessionRequest) =>
      academicSessionsApi.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.sessions() });
      toast.success("Session created");
      setShowCreate(false);
      reset();
    },
    onError: (err) => {
      toast.error(parseApiError(err).message);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => academicSessionsApi.activate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.sessions() });
      toast.success("Session activated");
    },
    onError: (err) => {
      toast.error(parseApiError(err).message);
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => academicSessionsApi.close(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.sessions() });
      toast.success("Session closed");
    },
    onError: (err) => {
      toast.error(parseApiError(err).message);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  function onSubmit(values: FormValues) {
    createMutation.mutate(values);
  }

  const sessions: AcademicSession[] = data?.sessions ?? [];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Academic Sessions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage school year sessions and student promotions
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          + New Session
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          {parseApiError(error).message}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Sessions list */}
      {!isLoading && sessions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No sessions yet. Create your first academic session.
        </div>
      )}

      {!isLoading && sessions.length > 0 && (
        <div className="border rounded-lg divide-y">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => navigate(`/admin/sessions/${session.id}`)}
              >
                <p className="font-medium text-sm">{session.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {session.startDate} → {session.endDate}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeCls(session.status)}`}
                >
                  {session.status}
                </span>
                {session.status === "UPCOMING" && (
                  <button
                    onClick={() => activateMutation.mutate(session.id)}
                    disabled={activateMutation.isPending}
                    className="text-xs rounded border px-2 py-1 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors disabled:opacity-50"
                  >
                    Activate
                  </button>
                )}
                {session.status === "ACTIVE" && (
                  <button
                    onClick={() => closeMutation.mutate(session.id)}
                    disabled={closeMutation.isPending}
                    className="text-xs rounded border px-2 py-1 hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Close
                  </button>
                )}
                <button
                  onClick={() => navigate(`/admin/sessions/${session.id}`)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`View ${session.name}`}
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Session drawer */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <div className="w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-xl shadow-xl p-6">
            <h2 className="text-base font-semibold mb-4">
              Create Academic Session
            </h2>
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium mb-1.5"
                >
                  Session name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="e.g. 2025-2026"
                  aria-invalid={errors.name ? true : undefined}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                  {...register("name")}
                />
                {errors.name && (
                  <p role="alert" className="mt-1.5 text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="startDate"
                    className="block text-sm font-medium mb-1.5"
                  >
                    Start date
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    aria-invalid={errors.startDate ? true : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                    {...register("startDate")}
                  />
                  {errors.startDate && (
                    <p role="alert" className="mt-1.5 text-xs text-destructive">
                      {errors.startDate.message}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="endDate"
                    className="block text-sm font-medium mb-1.5"
                  >
                    End date
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    aria-invalid={errors.endDate ? true : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                    {...register("endDate")}
                  />
                  {errors.endDate && (
                    <p role="alert" className="mt-1.5 text-xs text-destructive">
                      {errors.endDate.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    reset();
                  }}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || createMutation.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
