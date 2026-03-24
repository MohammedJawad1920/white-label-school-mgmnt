/**
 * StudentsPage — Freeze §Screen: Student Management (v3.5 CR-13)
 * TQ key: ['students', statusFilter]  stale: 2 min
 *
 * v3.5 CR-13 changes:
 * - Create form: adds admissionNumber (required, max 50) + dob (required YYYY-MM-DD)
 * - POST /students atomically creates a linked user account server-side
 * - On 201: show "Student created. Login ID: {loginId}"
 * - On 409 ADMISSIONNUMBERCONFLICT: inline error on admissionNumber field
 * - Table: adds Admission No., DOB, Login ID (read-only + copy button)
 * - Edit drawer: PUT /students/:id; warn when dob/admissionNumber changes
 * - Link Account drawer REMOVED (deprecated v3.5)
 *
 * v4.0 CR-21: students.classId is nullable (graduated students have null classId)
 * v4.0 CR-22: students have a status field (Active | DroppedOff | Graduated)
 *   - Status filter added to table
 *   - Status badge per row
 *   - Edit form: Active/Dropped Off selectable; Graduated is read-only
 *
 * Cross-field validation: batchId must match selectedClass.batchId.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { studentsApi } from "@/api/students";
import { classesApi } from "@/api/classes";
import { batchesApi } from "@/api/batches";
import { parseApiError } from "@/utils/errors";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/utils/queryKeys";
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
import type { Student, Class, Batch, StudentStatus } from "@/types/api";

// ── Schemas ───────────────────────────────────────────────────────────────────
const createSchema = z.object({
  name: z.string().min(1, "Required").max(255),
  classId: z.string().min(1, "Class is required"),
  batchId: z.string().min(1, "Batch is required"),
  admissionNumber: z.string().min(1, "Required").max(50, "Max 50 characters"),
  dob: z
    .string()
    .min(1, "Required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
});
type CreateFormValues = z.infer<typeof createSchema>;

// v4.0 CR-21: classId is nullable for graduated students
const editSchema = z.object({
  name: z.string().min(1, "Required").max(255),
  classId: z.string().optional(), // null/empty allowed for Graduated students
  batchId: z.string().min(1, "Batch is required"),
  admissionNumber: z.string().min(1, "Required").max(50, "Max 50 characters"),
  dob: z
    .string()
    .min(1, "Required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  // v4.0 CR-22: status editable (Active/DroppedOff only; Graduated is server-managed)
  status: z.enum(["Active", "DroppedOff"]).optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

// ── Copy Login ID button ──────────────────────────────────────────────────────
function CopyLoginId({
  loginId,
  studentName,
}: {
  loginId: string;
  studentName: string;
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(loginId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <span className="inline-flex items-center gap-1">
      <code className="text-xs font-mono bg-muted rounded px-1 py-0.5 select-all">
        {loginId}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy login ID for ${studentName}`}
        title={copied ? "Copied!" : "Copy login ID"}
        className="rounded p-0.5 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground hover:text-foreground"
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        )}
      </button>
    </span>
  );
}

// ── Create form ───────────────────────────────────────────────────────────────
function CreateStudentForm({
  onSubmit,
  onCancel,
  isPending,
  rootError,
  admissionError,
  classes,
  batches,
}: {
  onSubmit: (v: CreateFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  rootError?: string | null;
  admissionError?: string | null;
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
  } = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) });

  const selectedClassId = watch("classId");
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  function handleClassChange(classId: string) {
    setValue("classId", classId);
    const cls = classes.find((c) => c.id === classId);
    if (cls) setValue("batchId", cls.batchId);
  }

  function handleSubmitWithCrossValidation(v: CreateFormValues) {
    const cls = classes.find((c) => c.id === v.classId);
    if (cls && cls.batchId !== v.batchId) {
      setError("batchId", {
        message: "The selected class does not belong to the selected batch.",
      });
      return;
    }
    onSubmit(v);
  }

  // Merge server-side admissionNumber error into field
  const admissionFieldError = admissionError ?? errors.admissionNumber?.message;

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
        <FormField
          id="stu-admission"
          label="Admission Number"
          error={admissionFieldError}
          required
          hint="Unique within this school. Used to derive the student's login ID."
        >
          <input
            id="stu-admission"
            type="text"
            maxLength={50}
            aria-invalid={!!admissionFieldError}
            className={inputCls(!!admissionFieldError)}
            {...register("admissionNumber")}
          />
        </FormField>
        <FormField
          id="stu-dob"
          label="Date of Birth"
          error={errors.dob?.message}
          required
          hint="YYYY-MM-DD. Used to derive the student's initial login password."
        >
          <input
            id="stu-dob"
            type="date"
            aria-invalid={!!errors.dob}
            className={inputCls(!!errors.dob)}
            {...register("dob")}
          />
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

// ── Edit form ─────────────────────────────────────────────────────────────────
function EditStudentForm({
  student,
  onSubmit,
  onCancel,
  isPending,
  rootError,
  admissionError,
  classes,
  batches,
}: {
  student: Student;
  onSubmit: (v: EditFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  rootError?: string | null;
  admissionError?: string | null;
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
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: student.name,
      classId: student.classId ?? "", // v4.0 CR-21: classId is nullable
      batchId: student.batchId,
      admissionNumber: student.admissionNumber,
      dob: student.dob,
      status:
        student.status === "Graduated"
          ? undefined
          : (student.status as "Active" | "DroppedOff"),
    },
  });

  // v4.0 CR-22: Graduated students are read-only (status is server-managed)
  const isGraduated = student.status === "Graduated";

  const currentAdmission = watch("admissionNumber");
  const currentDob = watch("dob");
  const credentialsWillReset =
    currentAdmission !== student.admissionNumber || currentDob !== student.dob;

  function handleClassChange(classId: string) {
    setValue("classId", classId);
    const cls = classes.find((c) => c.id === classId);
    if (cls) setValue("batchId", cls.batchId);
  }

  function handleSubmitWithCrossValidation(v: EditFormValues) {
    const cls = classes.find((c) => c.id === v.classId);
    if (cls && cls.batchId !== v.batchId) {
      setError("batchId", {
        message: "The selected class does not belong to the selected batch.",
      });
      return;
    }
    onSubmit(v);
  }

  const admissionFieldError = admissionError ?? errors.admissionNumber?.message;

  return (
    <form
      onSubmit={handleSubmit(handleSubmitWithCrossValidation)}
      noValidate
      className="contents"
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {rootError && <RootError message={rootError} />}
        {credentialsWillReset && (
          <div
            role="alert"
            className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800"
          >
            Changing admission number or date of birth will reset the student's
            login password.
          </div>
        )}
        <FormField
          id="edit-stu-name"
          label="Student Name"
          error={errors.name?.message}
          required
        >
          <input
            id="edit-stu-name"
            type="text"
            aria-invalid={!!errors.name}
            className={inputCls(!!errors.name)}
            {...register("name")}
          />
        </FormField>
        <FormField
          id="edit-stu-class"
          label="Class"
          error={errors.classId?.message}
          required={!isGraduated}
        >
          {isGraduated ? (
            <p className="text-sm text-muted-foreground py-1">— (graduated)</p>
          ) : (
            <select
              id="edit-stu-class"
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
          )}
        </FormField>
        <FormField
          id="edit-stu-batch"
          label="Batch"
          error={errors.batchId?.message}
          required
        >
          <select
            id="edit-stu-batch"
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
        <FormField
          id="edit-stu-admission"
          label="Admission Number"
          error={admissionFieldError}
          required
          hint="Changing this will reset the student's login password."
        >
          <input
            id="edit-stu-admission"
            type="text"
            maxLength={50}
            aria-invalid={!!admissionFieldError}
            className={inputCls(!!admissionFieldError)}
            {...register("admissionNumber")}
          />
        </FormField>
        <FormField
          id="edit-stu-dob"
          label="Date of Birth"
          error={errors.dob?.message}
          required
          hint="Changing this will reset the student's login password."
        >
          <input
            id="edit-stu-dob"
            type="date"
            aria-invalid={!!errors.dob}
            className={inputCls(!!errors.dob)}
            {...register("dob")}
          />
        </FormField>
        {/* v4.0 CR-22: status field (Active/DroppedOff only; Graduated is read-only) */}
        {!isGraduated && (
          <FormField
            id="edit-stu-status"
            label="Status"
            error={errors.status?.message}
          >
            <select
              id="edit-stu-status"
              aria-invalid={!!errors.status}
              className={inputCls(!!errors.status)}
              {...register("status")}
            >
              <option value="Active">Active</option>
              <option value="DroppedOff">Dropped Off</option>
            </select>
          </FormField>
        )}
      </div>
      <div className="border-t p-4 shrink-0">
        <SubmitFooter
          onCancel={onCancel}
          isLoading={isPending}
          submitLabel="Save Changes"
        />
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerAdmissionError, setDrawerAdmissionError] = useState<
    string | null
  >(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  // v4.0 CR-22: status filter
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "">("");

  const { data: studentsData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.custom("students", statusFilter),
    queryFn: () => studentsApi.list({ status: statusFilter || undefined }),
    staleTime: 2 * 60 * 1000,
  });
  const { data: classesData } = useQuery({
    queryKey: QUERY_KEYS.classes(),
    queryFn: () => classesApi.list(),
    staleTime: 2 * 60 * 1000,
  });
  const { data: batchesData } = useQuery({
    queryKey: QUERY_KEYS.batches(),
    queryFn: () => batchesApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const students = studentsData?.students ?? [];
  const classes = classesData?.classes ?? [];
  const batches = batchesData?.batches ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEYS.students() });

  const createMut = useMutation({
    mutationFn: (v: CreateFormValues) => studentsApi.create(v),
    onSuccess: async (data) => {
      await invalidate();
      setCreateOpen(false);
      setDrawerError(null);
      setDrawerAdmissionError(null);
      setSuccessMessage(`Student created. Login ID: ${data.student.loginId}`);
      toast.success("Student created successfully.");
    },
    onError: (e) => {
      const { code, message } = parseApiError(e);
      if (code === "ADMISSIONNUMBERCONFLICT") {
        setDrawerAdmissionError(
          "This admission number is already in use by another student.",
        );
        setDrawerError(null);
      } else if (code === "BATCH_CLASS_MISMATCH" || code === "INVALID") {
        setDrawerError(
          "The selected class does not belong to the selected batch.",
        );
      } else {
        setDrawerError(message);
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const editMut = useMutation({
    mutationFn: (v: EditFormValues) =>
      studentsApi.update(editStudent!.id, {
        ...v,
        // CR-21: omit classId if blank (graduated student)
        classId: v.classId || undefined,
        // CR-22: only send status if provided and not Graduated
        status:
          v.status === "Active" || v.status === "DroppedOff"
            ? v.status
            : undefined,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Student updated successfully.");
      setEditStudent(null);
      setDrawerError(null);
      setDrawerAdmissionError(null);
    },
    onError: (e) => {
      const { code, message } = parseApiError(e);
      if (code === "ADMISSIONNUMBERCONFLICT") {
        setDrawerAdmissionError(
          "This admission number is already in use by another student.",
        );
        setDrawerError(null);
      } else if (code === "BATCH_CLASS_MISMATCH") {
        setDrawerError(
          "The selected class does not belong to the selected batch.",
        );
      } else {
        setDrawerError(message);
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Student deleted successfully.");
      setPendingDeleteId(null);
    },
    onError: (e) => {
      const { code } = parseApiError(e);
      setPendingDeleteId(null);
      if (code === "HAS_REFERENCES" || code === "CONFLICT") {
        setDeleteError("Cannot delete: student has attendance records.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const bulkMut = useMutation({
    mutationFn: () => studentsApi.bulkDelete(Array.from(selectedIds)),
    onSuccess: async () => {
      await invalidate();
      toast.success("Students deleted successfully.");
      setSelectedIds(new Set());
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

  function openCreate() {
    setDrawerError(null);
    setDrawerAdmissionError(null);
    setSuccessMessage(null);
    setCreateOpen(true);
  }

  function openEdit(student: Student) {
    setDrawerError(null);
    setDrawerAdmissionError(null);
    setEditStudent(student);
  }

  const filteredStudents = useMemo(
    () =>
      students.filter((s) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.loginId.toLowerCase().includes(q);
        const matchesClass = !classFilter || s.classId === classFilter;
        const matchesBatch = !batchFilter || s.batchId === batchFilter;
        return matchesSearch && matchesClass && matchesBatch;
      }),
    [students, searchQuery, classFilter, batchFilter],
  );

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Students"
        subtitle={`${students.length} student${students.length !== 1 ? "s" : ""}`}
        onAdd={openCreate}
        addLabel="Add Student"
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or login ID…"
          aria-label="Search students"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-52"
        />
        <select
          id="stu-status-filter"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as StudentStatus | "")
          }
          aria-label="Filter by status"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="DroppedOff">Dropped Off</option>
          <option value="Graduated">Graduated</option>
        </select>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="Filter by class"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          aria-label="Filter by batch"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {successMessage && (
        <div
          role="status"
          className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800"
        >
          {successMessage}
        </div>
      )}

      {deleteError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {deleteError}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">Student list</caption>
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
              <Th>Status</Th>
              <Th>Class</Th>
              <Th>Batch</Th>
              <Th>Admission No.</Th>
              <Th>DOB</Th>
              <Th>
                Login ID
                <span
                  className="ml-1 text-xs font-normal text-muted-foreground cursor-help"
                  title="Share this login ID with the student. They use it as their username. Password is admission number + DOB (DDMMYYYY)."
                >
                  ⓘ
                </span>
              </Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="p-0">
                  <TableSkeleton rows={8} cols={9} />
                </td>
              </tr>
            )}
            {!isLoading && filteredStudents.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {students.length === 0
                    ? "No students found. Add the first student."
                    : "No students match your filters."}
                </td>
              </tr>
            )}
            {filteredStudents.map((student) => (
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
                <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                  {student.name}
                </td>
                {/* v4.0 CR-22: status badge */}
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      student.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : student.status === "DroppedOff"
                          ? "bg-red-100 text-red-800"
                          : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {student.status === "DroppedOff"
                      ? "Dropped Off"
                      : student.status}
                  </span>
                </td>
                {/* v4.0 CR-21: classId can be null for graduated students */}
                <td className="px-4 py-2.5 text-muted-foreground">
                  {student.classId === null
                    ? "—"
                    : (student.className ?? student.classId)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {student.batchName ?? student.batchId}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {student.admissionNumber}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {student.dob}
                </td>
                <td className="px-4 py-2.5">
                  <CopyLoginId
                    loginId={student.loginId}
                    studentName={student.name}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <ActionBtn
                      onClick={() =>
                        navigate(`/students/${student.id}/attendance`)
                      }
                      label="History"
                      ariaLabel={`View attendance history for ${student.name}`}
                    />
                    <ActionBtn
                      onClick={() => openEdit(student)}
                      label="Edit"
                      ariaLabel={`Edit ${student.name}`}
                    />
                    <ActionBtn
                      onClick={() => {
                        setDeleteError(null);
                        setPendingDeleteId(student.id);
                      }}
                      label="Delete"
                      ariaLabel={`Delete ${student.name}`}
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

      {/* Create drawer */}
      <Drawer
        open={createOpen}
        title="Add Student"
        onClose={() => setCreateOpen(false)}
        footer={null}
      >
        <CreateStudentForm
          onSubmit={(v) => {
            setDrawerAdmissionError(null);
            setDrawerError(null);
            createMut.mutate(v);
          }}
          onCancel={() => setCreateOpen(false)}
          isPending={createMut.isPending}
          rootError={drawerError}
          admissionError={drawerAdmissionError}
          classes={classes}
          batches={batches}
        />
      </Drawer>

      {/* Edit drawer */}
      <Drawer
        open={!!editStudent}
        title="Edit Student"
        onClose={() => setEditStudent(null)}
        footer={null}
      >
        {editStudent && (
          <EditStudentForm
            student={editStudent}
            onSubmit={(v) => {
              setDrawerAdmissionError(null);
              setDrawerError(null);
              editMut.mutate(v);
            }}
            onCancel={() => setEditStudent(null)}
            isPending={editMut.isPending}
            rootError={drawerError}
            admissionError={drawerAdmissionError}
            classes={classes}
            batches={batches}
          />
        )}
      </Drawer>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Student"
        message="Are you sure you want to delete this student? This cannot be undone."
        onConfirm={() => pendingDeleteId && deleteMut.mutate(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
        loading={deleteMut.isPending}
      />

      {/* Bulk delete confirm dialog */}
      <ConfirmDialog
        open={pendingBulkDelete}
        title="Delete Selected Students"
        message={`Delete ${selectedIds.size} selected student${
          selectedIds.size !== 1 ? "s" : ""
        }? This cannot be undone.`}
        onConfirm={() => bulkMut.mutate()}
        onCancel={() => setPendingBulkDelete(false)}
        loading={bulkMut.isPending}
      />
    </div>
  );
}
