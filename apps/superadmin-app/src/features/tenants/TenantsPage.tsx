/**
 * TenantsPage — Freeze §Screen: Tenant Management
 *
 * Queries:
 *   ['sa-tenants', statusFilter, searchQuery]  stale: 1 min
 *
 * Mutations:
 *   POST   /super-admin/tenants                    → create (v3.4: includes admin block)
 *   PUT    /super-admin/tenants/:id                → update name/slug
 *   PUT    /super-admin/tenants/:id/deactivate     → deactivate
 *   PUT    /super-admin/tenants/:id/reactivate     → reactivate (v3.4 CR-07)
 *
 * All mutations invalidate ['sa-tenants'].
 *
 * WHY optimistic update NOT used here:
 * Freeze §3: "Optimistic updates: Feature flag toggles only.
 * All other mutations wait for server confirmation before updating UI."
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { tenantsApi } from "@/api/tenants";
import { parseApiError } from "@/utils/errors";
import { cn } from "@/utils/cn";
import { SA_QUERY_KEYS } from "@/utils/queryKeys";
import { useAppToast } from "@/hooks/useAppToast";
import type { Tenant } from "@/types/api";

// ── Zod schemas — Freeze §Screen: Tenant Management validation ────────────────
// CR-FE-036: timezone must be a valid IANA tz string.
// Use Intl.DateTimeFormat instead of Intl.supportedValuesOf — the latter is
// ICU-build-dependent and may exclude canonicalized aliases like "Asia/Kolkata"
// (resolved to "Asia/Calcutta" on some Windows ICU builds).
function isIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Pre-compute datalist options once at module level (safe fallback for older envs)
const IANA_TZ_LIST: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? (Intl.supportedValuesOf("timeZone") as string[])
    : [];

const validTimezone = z
  .string()
  .refine(
    (tz) => !tz || isIanaTimezone(tz),
    { message: "Select a valid timezone from the list (e.g. Asia/Kolkata)" },
  )
  .optional()
  .or(z.literal(""));

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dash only"),
  // CR-FE-036: valid IANA timezone
  timezone: validTimezone,
  // v3.4 CR-06: first admin account
  admin: z.object({
    name: z.string().min(1, "Required").max(255),
    email: z.string().email("Valid email required"),
    password: z.string().min(8, "Minimum 8 characters"),
  }),
});
const updateSchema = z.object({
  name: z.string().max(255).optional().or(z.literal("")),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9-]*$/, "Lowercase letters, numbers and dash only")
    .optional()
    .or(z.literal("")),
  // CR-FE-036: valid IANA timezone
  timezone: validTimezone,
});
type CreateFormValues = z.infer<typeof createSchema>;
type UpdateFormValues = z.infer<typeof updateSchema>;

// ── Skeleton ──────────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div
      className="animate-pulse space-y-px"
      aria-busy="true"
      aria-label="Loading tenants"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-40 flex-1" />
          <div className="h-4 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-16" />
        </div>
      ))}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Tenant["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === "active"
          ? "bg-green-100 text-green-800"
          : "bg-muted text-muted-foreground",
      )}
    >
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

// ── Create Drawer ─────────────────────────────────────────────────────────────
interface CreateDrawerProps {
  open: boolean;
  onClose: () => void;
}
function CreateDrawer({ open, onClose }: CreateDrawerProps) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) });

  const mutation = useMutation({
    mutationFn: (data: CreateFormValues) => tenantsApi.create(data),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: SA_QUERY_KEYS.tenants() });
      toast.success(`Tenant '${variables.name}' created successfully.`);
      reset();
      onClose();
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "CONFLICT" || code === "DUPLICATE") {
        setError("root", { message: "Tenant ID or slug already exists." });
      } else if (code === "ADMIN_EMAIL_TAKEN") {
        setError("root", {
          message: "Admin email already exists. Use a different email.",
        });
      } else {
        setError("root", { message });
      }
      toast.error(message);
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-tenant-title"
        onKeyDown={(e) => e.key === "Escape" && handleClose()}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-background shadow-xl transition-transform duration-300 md:w-[400px] border-l",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0">
          <h2 id="create-tenant-title" className="text-base font-semibold">
            Create Tenant
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-1 flex-col overflow-y-auto"
          noValidate
        >
          <div className="flex-1 p-4 space-y-4">
            {errors.root && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
              >
                {errors.root.message}
              </div>
            )}

            {/* Name */}
            <div>
              <label
                htmlFor="tenant-name"
                className="block text-sm font-medium mb-1.5"
              >
                School Name
              </label>
              <input
                id="tenant-name"
                type="text"
                placeholder="e.g. Springfield High School"
                aria-describedby={errors.name ? "tenant-name-error" : undefined}
                aria-invalid={errors.name ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("name")}
              />
              {errors.name && (
                <p
                  id="tenant-name-error"
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Slug */}
            <div>
              <label
                htmlFor="tenant-slug"
                className="block text-sm font-medium mb-1.5"
              >
                Slug
              </label>
              <input
                id="tenant-slug"
                type="text"
                placeholder="e.g. springfield-high"
                aria-describedby={
                  errors.slug ? "tenant-slug-error" : "tenant-slug-hint"
                }
                aria-invalid={errors.slug ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("slug")}
              />
              {errors.slug ? (
                <p
                  id="tenant-slug-error"
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {errors.slug.message}
                </p>
              ) : (
                <p
                  id="tenant-slug-hint"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  Used in login URL. Lowercase letters, numbers, dash.
                </p>
              )}
            </div>

            {/* Section 2 — First Admin Account (v3.4 CR-06) */}
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                First Admin Account
              </p>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="admin-name"
                    className="block text-sm font-medium mb-1.5"
                  >
                    Admin Full Name
                  </label>
                  <input
                    id="admin-name"
                    type="text"
                    placeholder="e.g. Jane Smith"
                    aria-invalid={errors.admin?.name ? true : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                    {...register("admin.name")}
                  />
                  {errors.admin?.name && (
                    <p role="alert" className="mt-1 text-xs text-destructive">
                      {errors.admin.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="admin-email"
                    className="block text-sm font-medium mb-1.5"
                  >
                    Admin Email
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    placeholder="e.g. jane@school.edu"
                    aria-invalid={errors.admin?.email ? true : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                    {...register("admin.email")}
                  />
                  {errors.admin?.email && (
                    <p role="alert" className="mt-1 text-xs text-destructive">
                      {errors.admin.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="admin-password"
                    className="block text-sm font-medium mb-1.5"
                  >
                    Admin Password
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    aria-invalid={errors.admin?.password ? true : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                    {...register("admin.password")}
                  />
                  {errors.admin?.password && (
                    <p role="alert" className="mt-1 text-xs text-destructive">
                      {errors.admin.password.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-md bg-muted/60 border px-3 py-2.5 text-xs text-muted-foreground">
              8 default school periods will be seeded automatically on creation.
            </div>

            {/* Timezone (CR-FE-036) */}
            <div>
              <label
                htmlFor="tenant-timezone"
                className="block text-sm font-medium mb-1.5"
              >
                Timezone
              </label>
              <input
                id="tenant-timezone"
                type="text"
                list="iana-timezone-list-create"
                placeholder="Asia/Kolkata (default)"
                defaultValue="Asia/Kolkata"
                aria-describedby={
                  errors.timezone ? "tenant-timezone-error" : "tenant-timezone-hint"
                }
                aria-invalid={errors.timezone ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("timezone")}
              />
              <datalist id="iana-timezone-list-create">
                {IANA_TZ_LIST.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
              {errors.timezone ? (
                <p
                  id="tenant-timezone-error"
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {errors.timezone.message}
                </p>
              ) : (
                <p
                  id="tenant-timezone-hint"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  Type to search (e.g. "Kolkata" → "Asia/Kolkata"). Leave blank
                  to use default.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 p-4 border-t shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={mutation.isPending}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {mutation.isPending ? (
                <>
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Creating…
                </>
              ) : (
                "Create Tenant"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Edit Drawer ───────────────────────────────────────────────────────────────
interface EditDrawerProps {
  tenant: Tenant | null;
  onClose: () => void;
}
function EditDrawer({ tenant, onClose }: EditDrawerProps) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<UpdateFormValues>({
    resolver: zodResolver(updateSchema),
    values: tenant
      ? {
          name: tenant.name,
          slug: tenant.slug,
          timezone: tenant.timezone ?? "",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: UpdateFormValues) => tenantsApi.update(tenant!.id, data),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: SA_QUERY_KEYS.tenants() });
      toast.success(`Tenant '${variables.name ?? tenant!.name}' updated.`);
      reset();
      onClose();
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "CONFLICT" || code === "DUPLICATE") {
        setError("slug", { message: "Slug already taken." });
      } else {
        setError("root", { message });
      }
      toast.error(message);
    },
  });

  const open = !!tenant;
  function handleClose() {
    reset();
    onClose();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-tenant-title"
        onKeyDown={(e) => e.key === "Escape" && handleClose()}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-background shadow-xl transition-transform duration-300 md:w-[400px] border-l",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0">
          <h2 id="edit-tenant-title" className="text-base font-semibold">
            Edit Tenant
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-1 flex-col overflow-y-auto"
          noValidate
        >
          <div className="flex-1 p-4 space-y-4">
            {errors.root && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
              >
                {errors.root.message}
              </div>
            )}
            <div>
              <label
                htmlFor="edit-name"
                className="block text-sm font-medium mb-1.5"
              >
                School Name
              </label>
              <input
                id="edit-name"
                type="text"
                aria-invalid={errors.name ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("name")}
              />
              {errors.name && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="edit-slug"
                className="block text-sm font-medium mb-1.5"
              >
                Slug
              </label>
              <input
                id="edit-slug"
                type="text"
                aria-invalid={errors.slug ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("slug")}
              />
              {errors.slug && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.slug.message}
                </p>
              )}
            </div>
            {/* Timezone (CR-FE-036) */}
            <div>
              <label
                htmlFor="edit-timezone"
                className="block text-sm font-medium mb-1.5"
              >
                Timezone
              </label>
              <input
                id="edit-timezone"
                type="text"
                list="iana-timezone-list-edit"
                aria-invalid={errors.timezone ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("timezone")}
              />
              <datalist id="iana-timezone-list-edit">
                {IANA_TZ_LIST.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
              {errors.timezone && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.timezone.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 p-4 border-t shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={mutation.isPending}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Deactivate confirm dialog ─────────────────────────────────────────────────
interface DeactivateDialogProps {
  tenant: Tenant | null;
  onClose: () => void;
}
function DeactivateDialog({ tenant, onClose }: DeactivateDialogProps) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => tenantsApi.deactivate(tenant!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SA_QUERY_KEYS.tenants() });
      toast.success(`Tenant '${tenant!.name}' deactivated.`);
      onClose();
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "ALREADY_INACTIVE") setError("Tenant is already inactive.");
      else setError(message);
      toast.error(message);
    },
  });

  if (!tenant) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-title"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="bg-background rounded-lg shadow-xl w-full max-w-sm border">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="deactivate-title" className="text-base font-semibold">
            Deactivate Tenant
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm">
            Are you sure you want to deactivate <strong>{tenant.name}</strong>?
            Users of this tenant will no longer be able to log in.
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {mutation.isPending ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reactivate confirm dialog (v3.4 CR-07) ───────────────────────────────────
interface ReactivateDialogProps {
  tenant: Tenant | null;
  onClose: () => void;
}
function ReactivateDialog({ tenant, onClose }: ReactivateDialogProps) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => tenantsApi.reactivate(tenant!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SA_QUERY_KEYS.tenants() });
      toast.success(`Tenant '${tenant!.name}' reactivated.`);
      onClose();
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "ALREADY_ACTIVE") setError("Tenant is already active.");
      else setError(message);
      toast.error(message);
    },
  });

  if (!tenant) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reactivate-title"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="bg-background rounded-lg shadow-xl w-full max-w-sm border">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="reactivate-title" className="text-base font-semibold">
            Reactivate Tenant
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm">
            Are you sure you want to reactivate <strong>{tenant.name}</strong>?
            Users of this tenant will be able to log in again.
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {mutation.isPending ? "Reactivating…" : "Reactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TenantsPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [deactivateTenant, setDeactivateTenant] = useState<Tenant | null>(null);
  const [reactivateTenant, setReactivateTenant] = useState<Tenant | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "">(
    "",
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: SA_QUERY_KEYS.tenantsList(
      statusFilter || search
        ? { status: statusFilter || undefined, search: search || undefined }
        : undefined,
    ),
    queryFn: () =>
      tenantsApi.list({
        status: statusFilter || undefined,
        search: search || undefined,
      }),
    staleTime: 60 * 1000,
  });

  const tenants = data?.tenants ?? [];

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tenants.length} tenant{tenants.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug…"
          aria-label="Search tenants"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-56"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as typeof statusFilter)
          }
          aria-label="Filter by status"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_100px_180px] gap-4 px-4 py-2.5 bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Name / ID</span>
          <span>Slug</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading && <TableSkeleton />}

        {isError && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Failed to load tenants.{" "}
            <button
              onClick={() => void refetch()}
              className="underline text-foreground"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && tenants.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No tenants found.
          </div>
        )}

        {!isLoading &&
          !isError &&
          tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="grid grid-cols-[1fr_1fr_100px_180px] gap-4 px-4 py-3 border-b last:border-b-0 items-center hover:bg-muted/20 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{tenant.name}</p>
                <p className="text-xs text-muted-foreground truncate font-mono">
                  {tenant.id}
                </p>
              </div>
              <p className="text-sm text-muted-foreground truncate font-mono">
                {tenant.slug}
              </p>
              <StatusBadge status={tenant.status} />
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <button
                  onClick={() => navigate(`/tenants/${tenant.id}/features`)}
                  className="rounded-md px-2.5 py-1 text-xs font-medium bg-muted hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Manage features for ${tenant.name}`}
                >
                  Features
                </button>
                <button
                  onClick={() => setEditTenant(tenant)}
                  className="rounded-md px-2.5 py-1 text-xs font-medium border hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Edit ${tenant.name}`}
                >
                  Edit
                </button>
                {/* Deactivate/Reactivate toggle based on status — Freeze §Screen + v3.4 CR-07 */}
                {tenant.status === "active" ? (
                  <button
                    onClick={() => setDeactivateTenant(tenant)}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Deactivate ${tenant.name}`}
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    onClick={() => setReactivateTenant(tenant)}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-primary border border-primary/30 hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Reactivate ${tenant.name}`}
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditDrawer tenant={editTenant} onClose={() => setEditTenant(null)} />
      <DeactivateDialog
        tenant={deactivateTenant}
        onClose={() => setDeactivateTenant(null)}
      />
      <ReactivateDialog
        tenant={reactivateTenant}
        onClose={() => setReactivateTenant(null)}
      />
    </div>
  );
}
