/**
 * EditAnnouncementPage — Edit form pre-populated from existing announcement.
 * Form locked after publishAt has passed.
 * useBlocker when form isDirty.
 */
import { useEffect } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { announcementsApi } from "@/api/announcements.api";
import { classesApi } from "@/api/classes";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import type { AudienceType } from "@/types/api";

const schema = z
  .object({
    title: z.string().min(1, "Title is required").max(255),
    body: z.string().min(1, "Body is required"),
    audienceType: z.enum(["All", "Teachers", "Students", "Guardians", "Class"]),
    audienceClassId: z.string().optional(),
    publishAt: z.string().optional(),
    expiresAt: z.string().optional(),
  })
  .refine(
    (v) =>
      v.audienceType !== "Class" ||
      (!!v.audienceClassId && v.audienceClassId.length > 0),
    {
      message: "Class is required when audience type is Class",
      path: ["audienceClassId"],
    },
  );

type FormValues = z.infer<typeof schema>;

const inputCls = (err: boolean, disabled?: boolean) =>
  `w-full rounded-md border ${err ? "border-destructive" : "border-input"} ${
    disabled ? "bg-muted opacity-70 cursor-not-allowed" : "bg-background"
  } px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  // ISO → "YYYY-MM-DDTHH:MM"
  return iso.substring(0, 16);
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export default function EditAnnouncementPage() {
  const { announcementId } = useParams<{ announcementId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useAppToast();

  const announcementQuery = useQuery({
    queryKey: ["announcements", announcementId],
    queryFn: () => announcementsApi.get(announcementId!),
    staleTime: 2 * 60 * 1000,
    enabled: !!announcementId,
  });

  const announcement = announcementQuery.data ?? null;

  // Is the announcement locked? (publishAt is in the past)
  const isLocked =
    !!announcement?.publishAt && new Date(announcement.publishAt) < new Date();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      body: "",
      audienceType: "All",
    },
  });

  const audienceType = watch("audienceType");

  // Populate form once data loads
  useEffect(() => {
    if (announcement) {
      reset({
        title: announcement.title,
        body: announcement.body,
        audienceType: announcement.audienceType,
        audienceClassId: announcement.audienceClassId ?? "",
        publishAt: toDatetimeLocal(announcement.publishAt),
        expiresAt: toDatetimeLocal(announcement.expiresAt),
      });
    }
  }, [announcement, reset]);

  // Navigation block when dirty
  const blocker = useBlocker(isDirty && !isLocked);

  useEffect(() => {
    if (blocker.state === "blocked") {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?",
      );
      if (confirmed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => classesApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: audienceType === "Class",
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      announcementsApi.update(announcementId!, {
        title: v.title,
        body: v.body,
        audienceType: v.audienceType as AudienceType,
        audienceClassId:
          v.audienceType === "Class" ? v.audienceClassId : undefined,
        publishAt: v.publishAt || undefined,
        expiresAt: v.expiresAt || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Announcement updated.");
      navigate("/admin/announcements");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  if (announcementQuery.isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (announcementQuery.isError || !announcement) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          {announcementQuery.isError
            ? parseApiError(announcementQuery.error).message
            : "Announcement not found."}
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Edit Announcement</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Update announcement details.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Back
        </button>
      </div>

      {isLocked && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800"
        >
          <svg
            className="h-4 w-4 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          This announcement has already been published and is locked for
          editing.
        </div>
      )}

      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        noValidate
        className="space-y-5"
      >
        <div>
          <label
            htmlFor="ea-title"
            className="block text-sm font-medium mb-1.5"
          >
            Title{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="ea-title"
            type="text"
            disabled={isLocked}
            aria-required="true"
            aria-invalid={!!errors.title}
            className={inputCls(!!errors.title, isLocked)}
            {...register("title")}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-destructive">
              {errors.title.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="ea-body" className="block text-sm font-medium mb-1.5">
            Body{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="ea-body"
            rows={5}
            disabled={isLocked}
            aria-required="true"
            aria-invalid={!!errors.body}
            className={inputCls(!!errors.body, isLocked)}
            {...register("body")}
          />
          {errors.body && (
            <p className="mt-1 text-xs text-destructive">
              {errors.body.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="ea-audience"
            className="block text-sm font-medium mb-1.5"
          >
            Audience{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="ea-audience"
            disabled={isLocked}
            className={inputCls(!!errors.audienceType, isLocked)}
            {...register("audienceType")}
          >
            <option value="All">All</option>
            <option value="Teachers">Teachers</option>
            <option value="Students">Students</option>
            <option value="Guardians">Guardians</option>
            <option value="Class">Specific Class</option>
          </select>
        </div>

        {audienceType === "Class" && (
          <div>
            <label
              htmlFor="ea-class"
              className="block text-sm font-medium mb-1.5"
            >
              Class{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="ea-class"
              disabled={isLocked}
              aria-invalid={!!errors.audienceClassId}
              className={inputCls(!!errors.audienceClassId, isLocked)}
              {...register("audienceClassId")}
            >
              <option value="">Select class…</option>
              {(classesData?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.audienceClassId && (
              <p className="mt-1 text-xs text-destructive">
                {errors.audienceClassId.message}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="ea-publish"
              className="block text-sm font-medium mb-1.5"
            >
              Publish At (optional)
            </label>
            <input
              id="ea-publish"
              type="datetime-local"
              disabled={isLocked}
              className={inputCls(false, isLocked)}
              {...register("publishAt")}
            />
          </div>
          <div>
            <label
              htmlFor="ea-expires"
              className="block text-sm font-medium mb-1.5"
            >
              Expires At (optional)
            </label>
            <input
              id="ea-expires"
              type="datetime-local"
              disabled={isLocked}
              className={inputCls(false, isLocked)}
              {...register("expiresAt")}
            />
          </div>
        </div>

        {mutation.isError && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
          >
            {parseApiError(mutation.error).message}
          </div>
        )}

        {!isLocked && (
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
