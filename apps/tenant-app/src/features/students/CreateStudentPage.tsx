/**
 * CreateStudentPage — Admin-only form to create a new student.
 * POST /students
 * On success navigate to /admin/students.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { studentsApi } from "@/api/students";
import { classesApi } from "@/api/classes";
import { batchesApi } from "@/api/batches";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import { QUERY_KEYS } from "@/utils/queryKeys";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  admissionNumber: z
    .string()
    .min(1, "Admission number is required")
    .max(50, "Max 50 characters"),
  classId: z.string().min(1, "Class is required"),
  batchId: z.string().min(1, "Batch is required"),
  dob: z
    .string()
    .min(1, "Date of birth is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
});

type FormValues = z.infer<typeof schema>;

const inputCls = (hasError: boolean) =>
  `w-full rounded-md border ${
    hasError ? "border-destructive" : "border-input"
  } bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

export default function CreateStudentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useAppToast();

  const [rootError, setRootError] = useState<string | null>(null);
  const [admissionError, setAdmissionError] = useState<string | null>(null);

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

  const classes = classesData?.classes ?? [];
  const batches = batchesData?.batches ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => studentsApi.create(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.students() });
      toast.success("Student created successfully.");
      navigate("/admin/students");
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "ADMISSIONNUMBERCONFLICT") {
        setAdmissionError(
          "This admission number is already in use by another student.",
        );
      } else {
        setRootError(message);
        toast.mutationError("Failed to create student.");
      }
    },
  });

  function handleClassChange(classId: string) {
    setValue("classId", classId);
    const cls = classes.find((c) => c.id === classId);
    if (cls) setValue("batchId", cls.batchId);
  }

  function onSubmit(values: FormValues) {
    setRootError(null);
    setAdmissionError(null);
    mutation.mutate(values);
  }

  const selectedClassId = watch("classId");

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Add Student</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Create a new student record and linked login account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {rootError && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
          >
            {rootError}
          </div>
        )}

        <div>
          <label htmlFor="cs-name" className="block text-sm font-medium mb-1.5">
            Student Name{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="cs-name"
            type="text"
            aria-required="true"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "cs-name-err" : undefined}
            className={inputCls(!!errors.name)}
            {...register("name")}
          />
          {errors.name && (
            <p id="cs-name-err" className="mt-1 text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cs-adm" className="block text-sm font-medium mb-1.5">
            Admission Number{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="cs-adm"
            type="text"
            maxLength={50}
            aria-required="true"
            aria-invalid={!!(errors.admissionNumber || admissionError)}
            aria-describedby="cs-adm-err"
            className={inputCls(!!(errors.admissionNumber || admissionError))}
            {...register("admissionNumber")}
          />
          {(admissionError ?? errors.admissionNumber?.message) && (
            <p id="cs-adm-err" className="mt-1 text-xs text-destructive">
              {admissionError ?? errors.admissionNumber?.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="cs-class"
            className="block text-sm font-medium mb-1.5"
          >
            Class{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="cs-class"
            aria-required="true"
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
          {errors.classId && (
            <p className="mt-1 text-xs text-destructive">
              {errors.classId.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="cs-batch"
            className="block text-sm font-medium mb-1.5"
          >
            Batch{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="cs-batch"
            aria-required="true"
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
          {!selectedClassId && (
            <p className="mt-1 text-xs text-muted-foreground">
              Auto-filled when class is selected.
            </p>
          )}
          {errors.batchId && (
            <p className="mt-1 text-xs text-destructive">
              {errors.batchId.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cs-dob" className="block text-sm font-medium mb-1.5">
            Date of Birth{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="cs-dob"
            type="date"
            aria-required="true"
            aria-invalid={!!errors.dob}
            aria-describedby={errors.dob ? "cs-dob-err" : "cs-dob-hint"}
            className={inputCls(!!errors.dob)}
            {...register("dob")}
          />
          <p id="cs-dob-hint" className="mt-1 text-xs text-muted-foreground">
            Used to derive the student's initial login password.
          </p>
          {errors.dob && (
            <p id="cs-dob-err" className="mt-1 text-xs text-destructive">
              {errors.dob.message}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {mutation.isPending ? "Creating…" : "Add Student"}
          </button>
        </div>
      </form>
    </div>
  );
}
