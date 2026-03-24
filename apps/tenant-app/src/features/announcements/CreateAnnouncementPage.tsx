/**
 * CreateAnnouncementPage — RHF + Zod form to create a new announcement.
 * useBlocker when form isDirty.
 * audienceClassId is conditional on audienceType === 'Class'.
 */
import { useEffect } from "react";
import { useNavigate, useBlocker } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { announcementsApi } from "@/api/announcements.api";
import { classesApi } from "@/api/classes";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import type { AudienceType } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

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

const inputCls = (err: boolean) =>
  `w-full rounded-md border ${err ? "border-destructive" : "border-input"} bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

export default function CreateAnnouncementPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useAppToast();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { audienceType: "All" },
  });

  const audienceType = watch("audienceType");

  // Navigation block when form is dirty
  const blocker = useBlocker(isDirty);

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
    queryKey: QUERY_KEYS.classes(),
    queryFn: () => classesApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: audienceType === "Class",
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      announcementsApi.create({
        title: v.title,
        body: v.body,
        audienceType: v.audienceType as AudienceType,
        audienceClassId:
          v.audienceType === "Class" ? v.audienceClassId : undefined,
        publishAt: v.publishAt || undefined,
        expiresAt: v.expiresAt || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.announcements.all() });
      toast.success("Announcement created.");
      navigate("/admin/announcements");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">New Announcement</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Create a new announcement for your school community.
        </p>
      </div>

      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        noValidate
        className="space-y-5"
      >
        <div>
          <label
            htmlFor="ann-title"
            className="block text-sm font-medium mb-1.5"
          >
            Title{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="ann-title"
            type="text"
            aria-required="true"
            aria-invalid={!!errors.title}
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
          <label
            htmlFor="ann-body"
            className="block text-sm font-medium mb-1.5"
          >
            Body{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="ann-body"
            rows={5}
            aria-required="true"
            aria-invalid={!!errors.body}
            className={inputCls(!!errors.body)}
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
            htmlFor="ann-audience"
            className="block text-sm font-medium mb-1.5"
          >
            Audience{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="ann-audience"
            className={inputCls(!!errors.audienceType)}
            {...register("audienceType")}
          >
            <option value="All">All</option>
            <option value="Teachers">Teachers</option>
            <option value="Students">Students</option>
            <option value="Guardians">Guardians</option>
            <option value="Class">Specific Class</option>
          </select>
          {errors.audienceType && (
            <p className="mt-1 text-xs text-destructive">
              {errors.audienceType.message}
            </p>
          )}
        </div>

        {audienceType === "Class" && (
          <div>
            <label
              htmlFor="ann-class"
              className="block text-sm font-medium mb-1.5"
            >
              Class{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="ann-class"
              aria-invalid={!!errors.audienceClassId}
              className={inputCls(!!errors.audienceClassId)}
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
              htmlFor="ann-publish"
              className="block text-sm font-medium mb-1.5"
            >
              Publish At (optional)
            </label>
            <input
              id="ann-publish"
              type="datetime-local"
              className={inputCls(false)}
              {...register("publishAt")}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave blank to publish immediately.
            </p>
          </div>
          <div>
            <label
              htmlFor="ann-expires"
              className="block text-sm font-medium mb-1.5"
            >
              Expires At (optional)
            </label>
            <input
              id="ann-expires"
              type="datetime-local"
              className={inputCls(false)}
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
            {mutation.isPending ? "Creating…" : "Create Announcement"}
          </button>
        </div>
      </form>
    </div>
  );
}
