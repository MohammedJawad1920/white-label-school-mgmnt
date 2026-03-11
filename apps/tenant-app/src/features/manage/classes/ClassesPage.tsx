/**
 * ClassesPage — Freeze §Screen: Class Management
 * TQ key: ['classes']  stale: 2 min
 * Edit/delete buttons have aria-label="Edit {className}" / "Delete {className}"
 * v3.6 CR-18: Promote button opens dialog to pick target class
 * v4.0 CR-21: Promote dialog gains "Graduate all students" option
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { classesApi } from "@/api/classes";
import { batchesApi } from "@/api/batches";
import { parseApiError } from "@/utils/errors";
import { toast } from "sonner";
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
import type { Class, PromoteRequest } from "@/types/api";

const schema = z.object({
  name: z.string().min(1, "Required").max(255),
  batchId: z.string().min(1, "Batch is required"),
});
type FormValues = z.infer<typeof schema>;

function ClassForm({
  defaultValues,
  onSubmit,
  onCancel,
  isPending,
  rootError,
}: {
  defaultValues?: Partial<FormValues>;
  onSubmit: (v: FormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  rootError?: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const { data: batchesData } = useQuery({
    queryKey: ["batches"],
    queryFn: () => batchesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {rootError && <RootError message={rootError} />}
        <FormField
          id="cls-name"
          label="Class Name"
          error={errors.name?.message}
          required
        >
          <input
            id="cls-name"
            type="text"
            placeholder="e.g. Class 10A"
            aria-invalid={!!errors.name}
            className={inputCls(!!errors.name)}
            {...register("name")}
          />
        </FormField>
        <FormField
          id="cls-batch"
          label="Batch"
          error={errors.batchId?.message}
          required
        >
          <select
            id="cls-batch"
            aria-invalid={!!errors.batchId}
            className={inputCls(!!errors.batchId)}
            {...register("batchId")}
          >
            <option value="">Select batch…</option>
            {batchesData?.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.startYear}–{b.endYear})
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="border-t p-4 shrink-0">
        <SubmitFooter
          onCancel={onCancel}
          isLoading={isPending}
          submitLabel="Save Class"
        />
      </div>
    </form>
  );
}

export default function ClassesPage() {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editClass, setEditClass] = useState<Class | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);

  // CR-18 / CR-21: promote dialog state
  const [promoteSource, setPromoteSource] = useState<Class | null>(null);
  const [promoteTargetId, setPromoteTargetId] = useState<string>("");
  const [promoteError, setPromoteError] = useState<string | null>(null);
  // v4.0 CR-21: promote action — promote to class or graduate all
  const [promoteAction, setPromoteAction] = useState<"promote" | "graduate">(
    "promote",
  );

  const { data: classesData, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => classesApi.list(),
    staleTime: 2 * 60 * 1000,
  });
  const { data: batchesData } = useQuery({
    queryKey: ["batches"],
    queryFn: () => batchesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const classes = classesData?.classes ?? [];
  const batchMap = Object.fromEntries(
    (batchesData?.batches ?? []).map((b) => [b.id, b.name]),
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["classes"] });

  const createMut = useMutation({
    mutationFn: (v: FormValues) => classesApi.create(v),
    onSuccess: async () => {
      await invalidate();
      toast.success("Class created successfully.");
      setCreateOpen(false);
      setDrawerError(null);
    },
    onError: (e) => setDrawerError(parseApiError(e).message),
  });

  const updateMut = useMutation({
    mutationFn: (v: FormValues) => classesApi.update(editClass!.id, v),
    onSuccess: async () => {
      await invalidate();
      toast.success("Class updated successfully.");
      setEditClass(null);
      setDrawerError(null);
    },
    onError: (e) => setDrawerError(parseApiError(e).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => classesApi.delete(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Class deleted successfully.");
      setPendingDeleteId(null);
    },
    onError: (e) => {
      const { code } = parseApiError(e);
      setPendingDeleteId(null);
      if (code === "CONFLICT") {
        setDeleteError("Cannot delete: students are enrolled in this class.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const bulkMut = useMutation({
    mutationFn: () => classesApi.bulkDelete(Array.from(selectedIds)),
    onSuccess: async () => {
      await invalidate();
      toast.success("Classes deleted successfully.");
      setSelectedIds(new Set());
      setPendingBulkDelete(false);
    },
    onError: () => {
      setPendingBulkDelete(false);
      toast.error("Something went wrong. Please try again.");
    },
  });

  // CR-18 / CR-21: year-end class promotion mutation
  const promoteMut = useMutation({
    mutationFn: () => {
      const body: PromoteRequest =
        promoteAction === "graduate"
          ? { action: "graduate" }
          : { targetClassId: promoteTargetId };
      return classesApi.promote(promoteSource!.id, body);
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["classes"] });
      await qc.invalidateQueries({ queryKey: ["students"] });
      setPromoteSource(null);
      setPromoteTargetId("");
      setPromoteError(null);
      setPromoteAction("promote");
      if ("graduated" in data) {
        toast.success(`${data.graduated} student(s) graduated.`);
      } else {
        toast.success(`${data.updated} student(s) moved to new class.`);
      }
    },
    onError: (e) => {
      const parsed = parseApiError(e);
      if (parsed.code === "SAME_CLASS") {
        setPromoteError("Source and target class cannot be the same.");
      } else if (parsed.code === "INVALID_PROMOTION_ACTION") {
        setPromoteError("Invalid promotion action.");
      } else {
        setPromoteError(parsed.message);
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      checked ? s.add(id) : s.delete(id);
      return s;
    });
  }

  const filteredClasses = useMemo(
    () =>
      classes.filter((cls) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || cls.name.toLowerCase().includes(q);
        const matchesBatch = !batchFilter || cls.batchId === batchFilter;
        return matchesSearch && matchesBatch;
      }),
    [classes, searchQuery, batchFilter],
  );

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Classes"
        subtitle={`${classes.length} class${classes.length !== 1 ? "es" : ""}`}
        onAdd={() => {
          setDrawerError(null);
          setCreateOpen(true);
        }}
        addLabel="New Class"
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name…"
          aria-label="Search classes"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-52"
        />
        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          aria-label="Filter by batch"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Batches</option>
          {(batchesData?.batches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
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

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={
                    classes.length > 0 && selectedIds.size === classes.length
                  }
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked
                        ? new Set(classes.map((c) => c.id))
                        : new Set(),
                    )
                  }
                  className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                />
              </Th>
              <Th>Name</Th>
              <Th>Batch</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="p-0">
                  <TableSkeleton rows={5} cols={4} />
                </td>
              </tr>
            )}
            {!isLoading && filteredClasses.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {classes.length === 0
                    ? "No classes found."
                    : "No classes match your filters."}
                </td>
              </tr>
            )}
            {filteredClasses.map((cls) => (
              <tr
                key={cls.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2.5">
                  <RowCheckbox
                    id={cls.id}
                    label={`Select ${cls.name}`}
                    checked={selectedIds.has(cls.id)}
                    onChange={(c) => toggleSelect(cls.id, c)}
                  />
                </td>
                <td className="px-4 py-2.5 font-medium">{cls.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {batchMap[cls.batchId] ?? cls.batchId}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <ActionBtn
                      onClick={() => {
                        setPromoteError(null);
                        setPromoteTargetId("");
                        setPromoteSource(cls);
                      }}
                      label="Promote"
                      ariaLabel={`Promote ${cls.name}`}
                    />
                    <ActionBtn
                      onClick={() => {
                        setDrawerError(null);
                        setEditClass(cls);
                      }}
                      label="Edit"
                      ariaLabel={`Edit ${cls.name}`}
                    />
                    <ActionBtn
                      onClick={() => {
                        setDeleteError(null);
                        setPendingDeleteId(cls.id);
                      }}
                      label="Delete"
                      ariaLabel={`Delete ${cls.name}`}
                      variant="destructive"
                      disabled={deleteMut.isPending}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        onDelete={() => {
          setDeleteError(null);
          setPendingBulkDelete(true);
        }}
        onClear={() => setSelectedIds(new Set())}
        isDeleting={bulkMut.isPending}
      />

      <Drawer
        open={createOpen}
        title="New Class"
        onClose={() => setCreateOpen(false)}
        footer={null}
      >
        <ClassForm
          onSubmit={(v) => createMut.mutate(v)}
          onCancel={() => setCreateOpen(false)}
          isPending={createMut.isPending}
          rootError={drawerError}
        />
      </Drawer>

      <Drawer
        open={!!editClass}
        title="Edit Class"
        onClose={() => setEditClass(null)}
        footer={null}
      >
        {editClass && (
          <ClassForm
            defaultValues={{ name: editClass.name, batchId: editClass.batchId }}
            onSubmit={(v) => updateMut.mutate(v)}
            onCancel={() => setEditClass(null)}
            isPending={updateMut.isPending}
            rootError={drawerError}
          />
        )}
      </Drawer>

      {/* CR-18 / CR-21: Promote / Graduate Class Dialog */}
      {promoteSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="promote-dialog-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setPromoteSource(null);
              setPromoteError(null);
              setPromoteAction("promote");
            }
          }}
        >
          <div className="bg-background rounded-lg shadow-xl w-full max-w-sm border">
            <div className="p-4 border-b">
              <h2 id="promote-dialog-title" className="text-base font-semibold">
                Promote / Graduate Students
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose an action for all students in{" "}
                <span className="font-medium text-foreground">
                  {promoteSource.name}
                </span>
                .
              </p>
              {/* v4.0 CR-21: radio group — promote vs graduate */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Action</legend>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="promoteAction"
                    value="promote"
                    checked={promoteAction === "promote"}
                    onChange={() => {
                      setPromoteAction("promote");
                      setPromoteError(null);
                    }}
                    className="accent-primary"
                  />
                  Move to another class
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="promoteAction"
                    value="graduate"
                    checked={promoteAction === "graduate"}
                    onChange={() => {
                      setPromoteAction("graduate");
                      setPromoteTargetId("");
                      setPromoteError(null);
                    }}
                    className="accent-primary"
                  />
                  Graduate all students
                </label>
              </fieldset>
              <div className="space-y-1">
                <label
                  htmlFor="promote-source"
                  className="block text-sm font-medium"
                >
                  Source Class
                </label>
                <input
                  id="promote-source"
                  type="text"
                  value={promoteSource.name}
                  readOnly
                  className={inputCls(false) + " bg-muted cursor-not-allowed"}
                />
              </div>
              {/* Only show target class select when promoting (not graduating) */}
              {promoteAction === "promote" && (
                <div className="space-y-1">
                  <label
                    htmlFor="promote-target"
                    className="block text-sm font-medium"
                  >
                    Target Class <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="promote-target"
                    value={promoteTargetId}
                    onChange={(e) => {
                      setPromoteTargetId(e.target.value);
                      setPromoteError(null);
                    }}
                    className={inputCls(!!promoteError && !promoteTargetId)}
                  >
                    <option value="">Select target class…</option>
                    {classes
                      .filter((c) => c.id !== promoteSource.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {promoteError && (
                <p role="alert" className="text-xs text-destructive">
                  {promoteError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => {
                  setPromoteSource(null);
                  setPromoteError(null);
                  setPromoteTargetId("");
                  setPromoteAction("promote");
                }}
                disabled={promoteMut.isPending}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (promoteAction === "promote" && !promoteTargetId) {
                    setPromoteError("Please select a target class.");
                    return;
                  }
                  promoteMut.mutate();
                }}
                disabled={
                  promoteMut.isPending ||
                  (promoteAction === "promote" && !promoteTargetId)
                }
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {promoteMut.isPending
                  ? promoteAction === "graduate"
                    ? "Graduating…"
                    : "Promoting…"
                  : promoteAction === "graduate"
                    ? "Graduate All"
                    : "Promote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Class"
        message="Are you sure you want to delete this class? This cannot be undone."
        onConfirm={() => pendingDeleteId && deleteMut.mutate(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
        loading={deleteMut.isPending}
      />

      {/* Bulk delete confirm dialog */}
      <ConfirmDialog
        open={pendingBulkDelete}
        title="Delete Selected Classes"
        message={`Delete ${selectedIds.size} selected class${
          selectedIds.size !== 1 ? "es" : ""
        }? This cannot be undone.`}
        onConfirm={() => bulkMut.mutate()}
        onCancel={() => setPendingBulkDelete(false)}
        loading={bulkMut.isPending}
      />
    </div>
  );
}
