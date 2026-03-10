/**
 * BatchesPage — Freeze §Screen: Batch Management
 * TQ key: ['batches']  stale: 5 min
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { Batch } from "@/types/api";

const currentYear = new Date().getFullYear();

const schema = z
  .object({
    name: z.string().min(1, "Required").max(100),
    startYear: z.coerce.number().int().min(2000).max(2100),
    endYear: z.coerce.number().int().min(2000).max(2100),
    status: z.enum(["Active", "Graduated"]), // v4.0 CR-23
  })
  .refine((d) => d.endYear > d.startYear, {
    message: "End year must be after start year",
    path: ["endYear"],
  });
type FormValues = z.infer<typeof schema>;

function BatchForm({
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
    defaultValues: defaultValues ?? {
      status: "Active",
      startYear: currentYear,
      endYear: currentYear + 1,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {rootError && <RootError message={rootError} />}
        <FormField
          id="name"
          label="Batch Name"
          error={errors.name?.message}
          required
        >
          <input
            id="name"
            type="text"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={inputCls(!!errors.name)}
            {...register("name")}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="startYear"
            label="Start Year"
            error={errors.startYear?.message}
            required
          >
            <input
              id="startYear"
              type="number"
              min={2000}
              max={2100}
              aria-invalid={!!errors.startYear}
              className={inputCls(!!errors.startYear)}
              {...register("startYear")}
            />
          </FormField>
          <FormField
            id="endYear"
            label="End Year"
            error={errors.endYear?.message}
            required
          >
            <input
              id="endYear"
              type="number"
              min={2000}
              max={2100}
              aria-invalid={!!errors.endYear}
              className={inputCls(!!errors.endYear)}
              {...register("endYear")}
            />
          </FormField>
        </div>
        <FormField
          id="status"
          label="Status"
          error={errors.status?.message}
          required
        >
          <select
            id="status"
            aria-invalid={!!errors.status}
            className={inputCls(!!errors.status)}
            {...register("status")}
          >
            <option value="Active">Active</option>
            <option value="Graduated">Graduated</option>
          </select>
        </FormField>
      </div>
      <div className="border-t p-4 shrink-0">
        <SubmitFooter
          onCancel={onCancel}
          isLoading={isPending}
          submitLabel="Save Batch"
        />
      </div>
    </form>
  );
}

export default function BatchesPage() {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: () => batchesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const batches = data?.batches ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["batches"] });

  const createMut = useMutation({
    mutationFn: (v: FormValues) => batchesApi.create(v),
    onSuccess: async () => {
      await invalidate();
      setCreateOpen(false);
      setDrawerError(null);
    },
    onError: (e) => setDrawerError(parseApiError(e).message),
  });

  const updateMut = useMutation({
    mutationFn: (v: FormValues) => batchesApi.update(editBatch!.id, v),
    onSuccess: async () => {
      await invalidate();
      setEditBatch(null);
      setDrawerError(null);
    },
    onError: (e) => setDrawerError(parseApiError(e).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => batchesApi.delete(id),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e) => {
      const { code } = parseApiError(e);
      setDeleteError(
        code === "CONFLICT" || code === "HAS_REFERENCES"
          ? "Cannot delete: classes reference this batch."
          : parseApiError(e).message,
      );
    },
  });

  const bulkMut = useMutation({
    mutationFn: () => batchesApi.bulkDelete(Array.from(selectedIds)),
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
  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(batches.map((b) => b.id)) : new Set());
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Batches"
        subtitle={`${batches.length} batch${batches.length !== 1 ? "es" : ""}`}
        onAdd={() => {
          setDrawerError(null);
          setCreateOpen(true);
        }}
        addLabel="New Batch"
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
                    batches.length > 0 && selectedIds.size === batches.length
                  }
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                />
              </Th>
              <Th>Name</Th>
              <Th>Years</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-0">
                  <TableSkeleton rows={5} cols={5} />
                </td>
              </tr>
            )}
            {!isLoading && batches.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No batches found.
                </td>
              </tr>
            )}
            {batches.map((batch) => (
              <tr
                key={batch.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2.5">
                  <RowCheckbox
                    id={batch.id}
                    label={`Select ${batch.name}`}
                    checked={selectedIds.has(batch.id)}
                    onChange={(c) => toggleSelect(batch.id, c)}
                  />
                </td>
                <td className="px-4 py-2.5 font-medium">{batch.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {batch.startYear}–{batch.endYear}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      batch.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {batch.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <ActionBtn
                      onClick={() => {
                        setDrawerError(null);
                        setEditBatch(batch);
                      }}
                      label="Edit"
                      ariaLabel={`Edit ${batch.name}`}
                    />
                    <ActionBtn
                      onClick={() => {
                        setDeleteError(null);
                        deleteMut.mutate(batch.id);
                      }}
                      label="Delete"
                      ariaLabel={`Delete ${batch.name}`}
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
        title="New Batch"
        onClose={() => setCreateOpen(false)}
        footer={null}
      >
        <BatchForm
          onSubmit={(v) => createMut.mutate(v)}
          onCancel={() => setCreateOpen(false)}
          isPending={createMut.isPending}
          rootError={drawerError}
        />
      </Drawer>

      <Drawer
        open={!!editBatch}
        title="Edit Batch"
        onClose={() => setEditBatch(null)}
        footer={null}
      >
        {editBatch && (
          <BatchForm
            defaultValues={{
              name: editBatch.name,
              startYear: editBatch.startYear,
              endYear: editBatch.endYear,
              status: editBatch.status as "Active" | "Graduated",
            }}
            onSubmit={(v) => updateMut.mutate(v)}
            onCancel={() => setEditBatch(null)}
            isPending={updateMut.isPending}
            rootError={drawerError}
          />
        )}
      </Drawer>
    </div>
  );
}
