/**
 * StudentsPage — Freeze §Screen: Student Management
 * TQ key: ['students']  stale: 2 min
 *
 * No edit button — no PUT /students/:id in OpenAPI contract.
 * Cross-field validation: batchId must match selectedClass.batchId.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { studentsApi } from "@/api/students";
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
import type { Student, Class, Batch } from "@/types/api";

const schema = z.object({
  name: z.string().min(1, "Required").max(255),
  classId: z.string().min(1, "Class is required"),
  batchId: z.string().min(1, "Batch is required"),
});
type FormValues = z.infer<typeof schema>;

function StudentForm({
  onSubmit,
  onCancel,
  isPending,
  rootError,
  classes,
  batches,
}: {
  onSubmit: (v: FormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  rootError?: string | null;
  classes: Class[];
  batches: Batch[];
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const selectedClassId = watch("classId");
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // Auto-fill batchId when class is selected, validate match
  function handleClassChange(classId: string) {
    setValue("classId", classId);
    const cls = classes.find((c) => c.id === classId);
    if (cls) setValue("batchId", cls.batchId);
  }

  function handleSubmitWithCrossValidation(v: FormValues) {
    const cls = classes.find((c) => c.id === v.classId);
    if (cls && cls.batchId !== v.batchId) {
      setError("batchId", {
        message: "The selected class does not belong to the selected batch.",
      });
      return;
    }
    onSubmit(v);
  }

  return (
    <form
      onSubmit={handleSubmit(handleSubmitWithCrossValidation)}
      noValidate
      className="contents"
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {rootError && <RootError message={rootError} />}
        <FormField
          id="stu-name"
          label="Student Name"
          error={errors.name?.message}
          required
        >
          <input
            id="stu-name"
            type="text"
            aria-invalid={!!errors.name}
            className={inputCls(!!errors.name)}
            {...register("name")}
          />
        </FormField>
        <FormField
          id="stu-class"
          label="Class"
          error={errors.classId?.message}
          required
        >
          <select
            id="stu-class"
            aria-invalid={!!errors.classId}
            className={inputCls(!!errors.classId)}
            {...register("classId", {
              onChange: (e) => handleClassChange(e.target.value),
            })}
          >
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id="stu-batch"
          label="Batch"
          error={errors.batchId?.message}
          required
          hint={
            selectedClass ? undefined : "Auto-filled when class is selected"
          }
        >
          <select
            id="stu-batch"
            aria-invalid={!!errors.batchId}
            className={inputCls(!!errors.batchId)}
            {...register("batchId")}
          >
            <option value="">Select batch…</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="border-t p-4 shrink-0">
        <SubmitFooter
          onCancel={onCancel}
          isLoading={isPending}
          submitLabel="Add Student"
        />
      </div>
    </form>
  );
}

export default function StudentsPage() {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: () => studentsApi.list(),
    staleTime: 2 * 60 * 1000,
  });
  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => classesApi.list(),
    staleTime: 2 * 60 * 1000,
  });
  const { data: batchesData } = useQuery({
    queryKey: ["batches"],
    queryFn: () => batchesApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const students = studentsData?.students ?? [];
  const classes = classesData?.classes ?? [];
  const batches = batchesData?.batches ?? [];
  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));
  const batchMap = Object.fromEntries(batches.map((b) => [b.id, b.name]));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["students"] });

  const createMut = useMutation({
    mutationFn: (v: FormValues) => studentsApi.create(v),
    onSuccess: async () => {
      await invalidate();
      setCreateOpen(false);
      setDrawerError(null);
    },
    onError: (e) => {
      const { code, message } = parseApiError(e);
      setDrawerError(
        code === "CLASS_BATCH_MISMATCH" || code === "INVALID"
          ? "The selected class does not belong to the selected batch."
          : message,
      );
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: invalidate,
    onError: (e) => {
      const { code } = parseApiError(e);
      setDeleteError(
        code === "CONFLICT"
          ? "Cannot delete: student has attendance records."
          : parseApiError(e).message,
      );
    },
  });

  const bulkMut = useMutation({
    mutationFn: () => studentsApi.bulkDelete({ ids: Array.from(selectedIds) }),
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
        title="Students"
        subtitle={`${students.length} student${students.length !== 1 ? "s" : ""}`}
        onAdd={() => {
          setDrawerError(null);
          setCreateOpen(true);
        }}
        addLabel="Add Student"
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
                    students.length > 0 && selectedIds.size === students.length
                  }
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked
                        ? new Set(students.map((s) => s.id))
                        : new Set(),
                    )
                  }
                  className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                />
              </Th>
              <Th>Name</Th>
              <Th>Class</Th>
              <Th>Batch</Th>
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
            {!isLoading && students.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No students found. Add the first student.
                </td>
              </tr>
            )}
            {students.map((student) => (
              <tr
                key={student.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2.5">
                  <RowCheckbox
                    id={student.id}
                    label={`Select ${student.name}`}
                    checked={selectedIds.has(student.id)}
                    onChange={(c) => toggleSelect(student.id, c)}
                  />
                </td>
                <td className="px-4 py-2.5 font-medium">{student.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {student.classId
                    ? (classMap[student.classId] ?? student.classId)
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {student.batchId
                    ? (batchMap[student.batchId] ?? student.batchId)
                    : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <ActionBtn
                      onClick={() => {
                        setDeleteError(null);
                        deleteMut.mutate(student.id);
                      }}
                      label={`Delete ${student.name}`}
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
        title="Add Student"
        onClose={() => setCreateOpen(false)}
        footer={null}
      >
        <StudentForm
          onSubmit={(v) => createMut.mutate(v)}
          onCancel={() => setCreateOpen(false)}
          isPending={createMut.isPending}
          rootError={drawerError}
          classes={classes}
          batches={batches}
        />
      </Drawer>
    </div>
  );
}
