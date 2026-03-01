/**
 * ClassesPage — Freeze §Screen: Class Management
 * TQ key: ['classes']  stale: 2 min
 * Edit/delete buttons have aria-label="Edit {className}" / "Delete {className}"
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { classesApi } from "@/api/classes";
import { batchesApi } from "@/api/batches";
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
  inputCls,
} from "@/components/manage/shared";
import type { Class } from "@/types/api";

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
      setCreateOpen(false);
      setDrawerError(null);
    },
    onError: (e) => setDrawerError(parseApiError(e).message),
  });

  const updateMut = useMutation({
    mutationFn: (v: FormValues) => classesApi.update(editClass!.id, v),
    onSuccess: async () => {
      await invalidate();
      setEditClass(null);
      setDrawerError(null);
    },
    onError: (e) => setDrawerError(parseApiError(e).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => classesApi.delete(id),
    onSuccess: invalidate,
    onError: (e) => {
      const { code } = parseApiError(e);
      setDeleteError(
        code === "CONFLICT"
          ? "Cannot delete: students are enrolled in this class."
          : parseApiError(e).message,
      );
    },
  });

  const bulkMut = useMutation({
    mutationFn: () => classesApi.bulkDelete({ ids: Array.from(selectedIds) }),
    onSuccess: async () => {
      await invalidate();
      setSelectedIds(new Set());
    },
    onError: (e) => setDeleteError(parseApiError(e).message),
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
        title="Classes"
        subtitle={`${classes.length} class${classes.length !== 1 ? "es" : ""}`}
        onAdd={() => {
          setDrawerError(null);
          setCreateOpen(true);
        }}
        addLabel="New Class"
      />

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
            {!isLoading && classes.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No classes found.
                </td>
              </tr>
            )}
            {classes.map((cls) => (
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
                        setDrawerError(null);
                        setEditClass(cls);
                      }}
                      label={`Edit ${cls.name}`}
                    />
                    <ActionBtn
                      onClick={() => {
                        setDeleteError(null);
                        deleteMut.mutate(cls.id);
                      }}
                      label={`Delete ${cls.name}`}
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
          bulkMut.mutate();
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
    </div>
  );
}
