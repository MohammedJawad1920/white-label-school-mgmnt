/**
 * SubjectsPage — Freeze §Screen: Subject Management
 * TQ key: ['subjects']  stale: 5 min
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { subjectsApi } from "@/api/subjects";
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
import type { Subject } from "@/types/api";

const schema = z.object({
  name: z.string().min(1, "Required").max(255),
  code: z.string().max(50).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

function SubjectForm({
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
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {rootError && <RootError message={rootError} />}
        <FormField
          id="subj-name"
          label="Subject Name"
          error={errors.name?.message}
          required
        >
          <input
            id="subj-name"
            type="text"
            aria-invalid={!!errors.name}
            className={inputCls(!!errors.name)}
            {...register("name")}
          />
        </FormField>
        <FormField
          id="subj-code"
          label="Code"
          hint="Optional. e.g. MATH101"
          error={errors.code?.message}
        >
          <input
            id="subj-code"
            type="text"
            aria-invalid={!!errors.code}
            className={inputCls(!!errors.code)}
            {...register("code")}
          />
        </FormField>
      </div>
      <div className="border-t p-4 shrink-0">
        <SubmitFooter
          onCancel={onCancel}
          isLoading={isPending}
          submitLabel="Save Subject"
        />
      </div>
    </form>
  );
}

export default function SubjectsPage() {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => subjectsApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const subjects = data?.subjects ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["subjects"] });

  const createMut = useMutation({
    mutationFn: (v: FormValues) => subjectsApi.create(v),
    onSuccess: async () => {
      await invalidate();
      toast.success("Subject created successfully.");
      setCreateOpen(false);
      setDrawerError(null);
    },
    onError: (e) => setDrawerError(parseApiError(e).message),
  });

  const updateMut = useMutation({
    mutationFn: (v: FormValues) => subjectsApi.update(editSubject!.id, v),
    onSuccess: async () => {
      await invalidate();
      toast.success("Subject updated successfully.");
      setEditSubject(null);
      setDrawerError(null);
    },
    onError: (e) => setDrawerError(parseApiError(e).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => subjectsApi.delete(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Subject deleted successfully.");
    },
    onError: (e) => {
      const { code } = parseApiError(e);
      if (code === "CONFLICT") {
        setDeleteError(
          "Cannot delete: timetable slots reference this subject.",
        );
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const bulkMut = useMutation({
    mutationFn: () => subjectsApi.bulkDelete(Array.from(selectedIds)),
    onSuccess: async () => {
      await invalidate();
      toast.success("Subjects deleted successfully.");
      setSelectedIds(new Set());
    },
    onError: () => toast.error("Something went wrong. Please try again."),
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
        title="Subjects"
        subtitle={`${subjects.length} subject${subjects.length !== 1 ? "s" : ""}`}
        onAdd={() => {
          setDrawerError(null);
          setCreateOpen(true);
        }}
        addLabel="New Subject"
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
                    subjects.length > 0 && selectedIds.size === subjects.length
                  }
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked
                        ? new Set(subjects.map((s) => s.id))
                        : new Set(),
                    )
                  }
                  className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                />
              </Th>
              <Th>Name</Th>
              <Th>Code</Th>
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
            {!isLoading && subjects.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No subjects found.
                </td>
              </tr>
            )}
            {subjects.map((subject) => (
              <tr
                key={subject.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2.5">
                  <RowCheckbox
                    id={subject.id}
                    label={`Select ${subject.name}`}
                    checked={selectedIds.has(subject.id)}
                    onChange={(c) => toggleSelect(subject.id, c)}
                  />
                </td>
                <td className="px-4 py-2.5 font-medium">{subject.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                  {subject.code ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <ActionBtn
                      onClick={() => {
                        setDrawerError(null);
                        setEditSubject(subject);
                      }}
                      label="Edit"
                      ariaLabel={`Edit ${subject.name}`}
                    />
                    <ActionBtn
                      onClick={() => {
                        setDeleteError(null);
                        deleteMut.mutate(subject.id);
                      }}
                      label="Delete"
                      ariaLabel={`Delete ${subject.name}`}
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
        title="New Subject"
        onClose={() => setCreateOpen(false)}
        footer={null}
      >
        <SubjectForm
          onSubmit={(v) => createMut.mutate(v)}
          onCancel={() => setCreateOpen(false)}
          isPending={createMut.isPending}
          rootError={drawerError}
        />
      </Drawer>

      <Drawer
        open={!!editSubject}
        title="Edit Subject"
        onClose={() => setEditSubject(null)}
        footer={null}
      >
        {editSubject && (
          <SubjectForm
            defaultValues={{
              name: editSubject.name,
              code: editSubject.code ?? "",
            }}
            onSubmit={(v) => updateMut.mutate(v)}
            onCancel={() => setEditSubject(null)}
            isPending={updateMut.isPending}
            rootError={drawerError}
          />
        )}
      </Drawer>
    </div>
  );
}
