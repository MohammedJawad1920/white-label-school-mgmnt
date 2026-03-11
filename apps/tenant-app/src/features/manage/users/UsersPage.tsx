/**
 * UsersPage — Freeze §Screen: User Management
 * TQ key: ['users', roleFilter, searchQuery]  stale: 2 min
 *
 * v3.5 CR-12: Admin can now edit their own roles (self-edit permitted).
 * v3.5 CR-13: Student role removed from this page; students managed on Students page.
 * v4.0 CR-20: password optional on create; temporaryPassword one-time modal on 201.
 *
 * Self-target guard (Freeze §Screen):
 *   - Delete button hidden for current user (self-delete still blocked)
 *
 * Bulk delete shows failed rows highlighted red with reason.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usersApi } from "@/api/users";
import { useAuth } from "@/hooks/useAuth";
import { parseApiError } from "@/utils/errors";
import {
  TableSkeleton,
  BulkActionBar,
  Drawer,
  FormField,
  SubmitFooter,
  RowCheckbox,
  PageHeader,
  Th,
  ActionBtn,
  RootError,
  ConfirmDialog,
  inputCls,
} from "@/components/manage/shared";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import type { User } from "@/types/api";

// v3.5 CR-12+13: Student role is no longer manageable via Users page.
// Students are managed on the Students page with atomic account creation.
type Role = "Teacher" | "Admin";

// v4.0 CR-20: password is optional; if left blank, server auto-generates a temporaryPassword
const createSchema = z.object({
  name: z.string().min(1, "Required").max(255),
  email: z.string().email("Valid email required"),
  password: z
    .string()
    .optional()
    .refine((p) => p === undefined || p === "" || p.length >= 8, {
      message: "Minimum 8 characters (or leave blank to auto-generate)",
    }),
  roles: z
    .array(z.enum(["Teacher", "Admin"]))
    .min(1, "At least one role required"),
});
type CreateFormValues = z.infer<typeof createSchema>;

const ROLES: Role[] = ["Teacher", "Admin"];

// ── Create user form ──────────────────────────────────────────────────────────
function CreateUserForm({
  onSubmit,
  onCancel,
  isPending,
  rootError,
}: {
  onSubmit: (v: CreateFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  rootError?: string | null;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { roles: ["Teacher"] },
  });

  const selectedRoles = watch("roles") ?? [];

  function toggleRole(role: Role) {
    const next = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    setValue("roles", next, { shouldValidate: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {rootError && <RootError message={rootError} />}
        <FormField
          id="usr-name"
          label="Full Name"
          error={errors.name?.message}
          required
        >
          <input
            id="usr-name"
            type="text"
            aria-invalid={!!errors.name}
            className={inputCls(!!errors.name)}
            {...register("name")}
          />
        </FormField>
        <FormField
          id="usr-email"
          label="Email"
          error={errors.email?.message}
          required
        >
          <input
            id="usr-email"
            type="email"
            aria-invalid={!!errors.email}
            className={inputCls(!!errors.email)}
            {...register("email")}
          />
        </FormField>
        <FormField
          id="usr-password"
          label="Password"
          error={errors.password?.message}
          hint="Leave blank to auto-generate a temporary password"
        >
          <input
            id="usr-password"
            type="password"
            aria-invalid={!!errors.password}
            className={inputCls(!!errors.password)}
            {...register("password")}
          />
        </FormField>
        <FormField
          id="usr-roles"
          label="Roles"
          error={errors.roles?.message}
          required
        >
          <div className="flex gap-2">
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                aria-pressed={selectedRoles.includes(role)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedRoles.includes(role)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted",
                )}
              >
                {role}
              </button>
            ))}
          </div>
        </FormField>
      </div>
      <div className="border-t p-4 shrink-0">
        <SubmitFooter
          onCancel={onCancel}
          isLoading={isPending}
          submitLabel="Create User"
        />
      </div>
    </form>
  );
}

// ── Edit roles form ───────────────────────────────────────────────────────────
function EditRolesForm({
  user,
  onSubmit,
  onCancel,
  isPending,
  rootError,
}: {
  user: User;
  onSubmit: (roles: Role[]) => void;
  onCancel: () => void;
  isPending: boolean;
  rootError?: string | null;
}) {
  const [selected, setSelected] = useState<Role[]>(user.roles as Role[]);

  function toggle(role: Role) {
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  return (
    <div className="contents">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {rootError && <RootError message={rootError} />}
        <p className="text-sm text-muted-foreground">
          Editing roles for <strong>{user.name}</strong>
        </p>
        {selected.length === 0 && (
          <p role="alert" className="text-xs text-destructive">
            At least one role required.
          </p>
        )}
        <div className="flex gap-2">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggle(role)}
              aria-pressed={selected.includes(role)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected.includes(role)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {role}
            </button>
          ))}
        </div>
      </div>
      <div className="border-t p-4 shrink-0">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(selected)}
            disabled={isPending || selected.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Update Roles"}
          </button>
        </div>
      </div>
    </div>
  );
}
// ── Temporary Password Modal (CR-20) ───────────────────────────────────────────────────
function TempPasswordModal({
  password,
  onDismiss,
}: {
  password: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tmp-pwd-title"
    >
      <div className="bg-background rounded-lg shadow-xl w-full max-w-sm border">
        <div className="p-4 border-b">
          <h2 id="tmp-pwd-title" className="text-base font-semibold">
            Temporary Password Generated
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Share this password with the user. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono select-all break-all">
              {password}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy temporary password"
              title={copied ? "Copied!" : "Copy to clipboard"}
              className="shrink-0 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <div className="flex justify-end p-4 border-t">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
// ── Main page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editRolesUser, setEditRolesUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  // v4.0 CR-20: holds auto-generated password for one-time display
  const [tempPasswordModal, setTempPasswordModal] = useState<string | null>(
    null,
  );
  // Track bulk delete failures: id → reason
  const [bulkFailed, setBulkFailed] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["users", roleFilter, searchQuery],
    queryFn: () =>
      usersApi.list({
        role: roleFilter || undefined,
        search: searchQuery || undefined,
      }),
    staleTime: 2 * 60 * 1000,
  });
  const users = data?.users ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const createMut = useMutation({
    mutationFn: (v: CreateFormValues) =>
      usersApi.create({
        name: v.name,
        email: v.email,
        // CR-20: send undefined (not empty string) when blank → server auto-generates
        password: v.password && v.password.length > 0 ? v.password : undefined,
        roles: v.roles,
      }),
    onSuccess: async (data) => {
      await invalidate();
      toast.success("User created successfully.");
      setCreateOpen(false);
      setDrawerError(null);
      // CR-20: show one-time modal if server returned a temporary password
      if (data.temporaryPassword) {
        setTempPasswordModal(data.temporaryPassword);
      }
    },
    onError: (e) => {
      const { code, message } = parseApiError(e);
      if (code === "CONFLICT") {
        setDrawerError("Email already exists for this school.");
      } else {
        setDrawerError(message);
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const rolesMut = useMutation({
    mutationFn: (roles: Role[]) =>
      usersApi.updateRoles(editRolesUser!.id, { roles }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Roles updated successfully.");
      setEditRolesUser(null);
      setDrawerError(null);
    },
    onError: (e) => {
      const { code, message } = parseApiError(e);
      if (code === "NOT_FOUND") {
        setDrawerError("User not found.");
      } else if (code === "LASTADMIN") {
        setDrawerError(
          "Cannot remove Admin role — this user is the last admin of this tenant.",
        );
      } else {
        setDrawerError(message);
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("User deleted successfully.");
      setPendingDeleteId(null);
    },
    onError: (e) => {
      const { code } = parseApiError(e);
      setPendingDeleteId(null);
      if (code === "CONFLICT") {
        setDeleteError(
          "Cannot delete: user has active timetable assignments or attendance records.",
        );
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const bulkMut = useMutation({
    mutationFn: () => usersApi.bulkDelete(Array.from(selectedIds)),
    onSuccess: async () => {
      await invalidate();
      toast.success("Users deleted successfully.");
      setSelectedIds(new Set());
      setBulkFailed({});
      setPendingBulkDelete(false);
    },
    onError: () => {
      setPendingBulkDelete(false);
      toast.error("Something went wrong. Please try again.");
    },
  });

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      checked ? s.add(id) : s.delete(id);
      return s;
    });
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Users"
        subtitle={`${users.length} user${users.length !== 1 ? "s" : ""}`}
        onAdd={() => {
          setDrawerError(null);
          setCreateOpen(true);
        }}
        addLabel="New User"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search users"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-52"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Roles</option>
          <option value="Teacher">Teacher</option>
          <option value="Admin">Admin</option>
        </select>
      </div>

      {deleteError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {deleteError}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={
                    users.length > 0 && selectedIds.size === users.length
                  }
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked
                        ? new Set(users.map((u) => u.id))
                        : new Set(),
                    )
                  }
                  className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                />
              </Th>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Roles</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-0">
                  <TableSkeleton rows={8} cols={5} />
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No users found. Create the first user.
                </td>
              </tr>
            )}
            {users.map((user) => {
              const isSelf = user.id === currentUser?.id;
              const failedMsg = bulkFailed[user.id];
              return (
                <tr
                  key={user.id}
                  className={cn(
                    "border-b last:border-b-0 hover:bg-muted/20",
                    failedMsg ? "bg-destructive/5" : "",
                  )}
                >
                  <td className="px-4 py-2.5">
                    <RowCheckbox
                      id={user.id}
                      label={`Select ${user.name}`}
                      checked={selectedIds.has(user.id)}
                      onChange={(c) => toggleSelect(user.id, c)}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    {user.name}
                    {isSelf && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                    {failedMsg && (
                      <span className="block text-xs text-destructive mt-0.5">
                        {failedMsg}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {(user.roles as Role[]).map((r) => (
                        <span
                          key={r}
                          className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {/* CR-12: role editor is now available for all users including self */}
                      <ActionBtn
                        onClick={() => {
                          setDrawerError(null);
                          setEditRolesUser(user);
                        }}
                        label="Edit roles"
                        ariaLabel={`Edit roles for ${user.name}`}
                      />
                      {/* Delete hidden for self — Freeze §Screen */}
                      {!isSelf && (
                        <ActionBtn
                          onClick={() => {
                            setDeleteError(null);
                            setBulkFailed({});
                            setPendingDeleteId(user.id);
                          }}
                          label="Delete"
                          ariaLabel={`Delete ${user.name}`}
                          variant="destructive"
                          disabled={deleteMut.isPending}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        onDelete={() => {
          setDeleteError(null);
          setBulkFailed({});
          setPendingBulkDelete(true);
        }}
        onClear={() => setSelectedIds(new Set())}
        isDeleting={bulkMut.isPending}
      />

      {/* CR-20: Temporary password one-time modal */}
      {tempPasswordModal && (
        <TempPasswordModal
          password={tempPasswordModal}
          onDismiss={() => setTempPasswordModal(null)}
        />
      )}

      {/* Create drawer */}
      <Drawer
        open={createOpen}
        title="New User"
        onClose={() => setCreateOpen(false)}
        footer={null}
      >
        <CreateUserForm
          onSubmit={(v) => createMut.mutate(v)}
          onCancel={() => setCreateOpen(false)}
          isPending={createMut.isPending}
          rootError={drawerError}
        />
      </Drawer>

      {/* Edit roles drawer */}
      <Drawer
        open={!!editRolesUser}
        title="Edit Roles"
        onClose={() => setEditRolesUser(null)}
        footer={null}
      >
        {editRolesUser && (
          <EditRolesForm
            user={editRolesUser}
            onSubmit={(roles) => rolesMut.mutate(roles)}
            onCancel={() => setEditRolesUser(null)}
            isPending={rolesMut.isPending}
            rootError={drawerError}
          />
        )}
      </Drawer>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete User"
        message="Are you sure you want to delete this user? This cannot be undone."
        onConfirm={() => pendingDeleteId && deleteMut.mutate(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
        loading={deleteMut.isPending}
      />

      {/* Bulk delete confirm dialog */}
      <ConfirmDialog
        open={pendingBulkDelete}
        title="Delete Selected Users"
        message={`Delete ${selectedIds.size} selected user${
          selectedIds.size !== 1 ? "s" : ""
        }? This cannot be undone.`}
        onConfirm={() => bulkMut.mutate()}
        onCancel={() => setPendingBulkDelete(false)}
        loading={bulkMut.isPending}
      />
    </div>
  );
}
