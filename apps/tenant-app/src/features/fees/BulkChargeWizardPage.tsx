/**
 * BulkChargeWizardPage — 3-step wizard for bulk fee charges.
 * Step 1: Target (classId or studentIds)
 * Step 2: Charge details (category, amount, description, dueDate)
 * Step 3: Preview and confirm
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { feesApi } from "@/api/fees.api";
import { classesApi } from "@/api/classes";
import { studentsApi } from "@/api/students";
import { academicSessionsApi } from "@/api/academicSessions";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import { StepWizard } from "@/components/StepWizard";
import type { FeeCategory, Class, Student } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

const FEE_CATEGORIES: FeeCategory[] = [
  "TUITION",
  "TRANSPORT",
  "HOSTEL",
  "EXAM",
  "LIBRARY",
  "SPORTS",
  "OTHER",
];

const targetSchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("class"),
    classId: z.string().min(1, "Class is required"),
    sessionId: z.string().min(1, "Session is required"),
  }),
  z.object({
    targetType: z.literal("students"),
    studentIds: z.string().min(1, "Select at least one student"),
    sessionId: z.string().min(1, "Session is required"),
  }),
]);
type TargetValues = z.infer<typeof targetSchema>;

const chargeSchema = z.object({
  category: z.enum([
    "TUITION",
    "TRANSPORT",
    "HOSTEL",
    "EXAM",
    "LIBRARY",
    "SPORTS",
    "OTHER",
  ]),
  amount: z
    .number({ invalid_type_error: "Amount is required" })
    .positive("Must be positive"),
  description: z.string().min(1, "Description is required"),
  dueDate: z.string().optional(),
});
type ChargeValues = z.infer<typeof chargeSchema>;

const inputCls = (err: boolean) =>
  `w-full rounded-md border ${err ? "border-destructive" : "border-input"} bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

const WIZARD_STEPS = [
  { label: "Target" },
  { label: "Details" },
  { label: "Confirm" },
];

export default function BulkChargeWizardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useAppToast();

  const [step, setStep] = useState(0);
  const [targetData, setTargetData] = useState<TargetValues | null>(null);
  const [chargeData, setChargeData] = useState<ChargeValues | null>(null);

  const { data: classesData } = useQuery({
    queryKey: QUERY_KEYS.classes(),
    queryFn: () => classesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: sessionsData } = useQuery({
    queryKey: QUERY_KEYS.custom("academic-sessions"),
    queryFn: () => academicSessionsApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: studentsData } = useQuery({
    queryKey: QUERY_KEYS.students(),
    queryFn: () => studentsApi.list(),
    staleTime: 2 * 60 * 1000,
    enabled: step === 0,
  });

  const classes: Class[] = classesData?.classes ?? [];
  const sessions = sessionsData?.sessions ?? [];
  const students: Student[] = studentsData?.students ?? [];

  const bulkMut = useMutation({
    mutationFn: () => {
      if (!targetData || !chargeData) throw new Error("Missing data");
      const payload = {
        sessionId: targetData.sessionId,
        category: chargeData.category,
        description: chargeData.description,
        amount: chargeData.amount,
        dueDate: chargeData.dueDate,
        ...(targetData.targetType === "class"
          ? { classId: targetData.classId }
          : {
              studentIds: targetData.studentIds
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean),
            }),
      };
      return feesApi.bulkCharge(payload);
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.custom("fees", "charges") });
      toast.success(
        `${data.charged} charge${data.charged !== 1 ? "s" : ""} created${data.skipped > 0 ? `, ${data.skipped} skipped` : ""}.`,
      );
      navigate("/admin/fees");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  // Step 1 form
  const {
    register: regTarget,
    handleSubmit: handleTarget,
    watch: watchTarget,
    formState: { errors: targetErrors },
  } = useForm<TargetValues>({
    resolver: zodResolver(targetSchema),
    defaultValues: { targetType: "class", classId: "", sessionId: "" },
  });
  const targetType = watchTarget("targetType");

  // Step 2 form
  const {
    register: regCharge,
    handleSubmit: handleCharge,
    formState: { errors: chargeErrors },
  } = useForm<ChargeValues>({
    resolver: zodResolver(chargeSchema),
    defaultValues: { category: "TUITION" },
  });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Bulk Fee Charge</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Apply fee charges to a class or selected students.
        </p>
      </div>

      <div className="mb-6">
        <StepWizard steps={WIZARD_STEPS} currentStep={step} />
      </div>

      {/* Step 1: Target */}
      {step === 0 && (
        <form
          onSubmit={handleTarget((v) => {
            setTargetData(v);
            setStep(1);
          })}
          noValidate
          className="rounded-lg border bg-card p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold">Step 1: Select Target</h2>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Target Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  value="class"
                  {...regTarget("targetType")}
                  className="accent-primary"
                />
                By Class
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  value="students"
                  {...regTarget("targetType")}
                  className="accent-primary"
                />
                Select Students
              </label>
            </div>
          </div>

          <div>
            <label
              htmlFor="bc-session"
              className="block text-sm font-medium mb-1.5"
            >
              Session *
            </label>
            <select
              id="bc-session"
              className={inputCls(
                !!(targetErrors as Record<string, { message?: string }>)
                  .sessionId,
              )}
              {...regTarget("sessionId")}
            >
              <option value="">Select session…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {targetType === "class" && (
            <div>
              <label
                htmlFor="bc-class"
                className="block text-sm font-medium mb-1.5"
              >
                Class *
              </label>
              <select
                id="bc-class"
                className={inputCls(
                  !!(targetErrors as Record<string, { message?: string }>)
                    .classId,
                )}
                {...regTarget("classId")}
              >
                <option value="">Select class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === "students" && (
            <div>
              <label
                htmlFor="bc-students"
                className="block text-sm font-medium mb-1.5"
              >
                Students *
              </label>
              <select
                id="bc-students"
                multiple
                className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...regTarget("studentIds")}
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.admissionNumber})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Hold Ctrl/Cmd to select multiple.
              </p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Next →
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Charge Details */}
      {step === 1 && (
        <form
          onSubmit={handleCharge((v) => {
            setChargeData(v);
            setStep(2);
          })}
          noValidate
          className="rounded-lg border bg-card p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold">Step 2: Charge Details</h2>

          <div>
            <label
              htmlFor="bc-category"
              className="block text-sm font-medium mb-1.5"
            >
              Category *
            </label>
            <select
              id="bc-category"
              className={inputCls(!!chargeErrors.category)}
              {...regCharge("category")}
            >
              {FEE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {chargeErrors.category && (
              <p className="mt-1 text-xs text-destructive">
                {chargeErrors.category.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="bc-description"
              className="block text-sm font-medium mb-1.5"
            >
              Description *
            </label>
            <input
              id="bc-description"
              type="text"
              className={inputCls(!!chargeErrors.description)}
              {...regCharge("description")}
            />
            {chargeErrors.description && (
              <p className="mt-1 text-xs text-destructive">
                {chargeErrors.description.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="bc-amount"
              className="block text-sm font-medium mb-1.5"
            >
              Amount *
            </label>
            <input
              id="bc-amount"
              type="number"
              step="0.01"
              min={0.01}
              className={inputCls(!!chargeErrors.amount)}
              {...regCharge("amount", { valueAsNumber: true })}
            />
            {chargeErrors.amount && (
              <p className="mt-1 text-xs text-destructive">
                {chargeErrors.amount.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="bc-duedate"
              className="block text-sm font-medium mb-1.5"
            >
              Due Date (optional)
            </label>
            <input
              id="bc-duedate"
              type="date"
              className={inputCls(false)}
              {...regCharge("dueDate")}
            />
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
            >
              ← Back
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Next →
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Preview & Confirm */}
      {step === 2 && targetData && chargeData && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold">
            Step 3: Preview &amp; Confirm
          </h2>

          <dl className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div>
              <dt className="text-muted-foreground">Target</dt>
              <dd className="font-medium mt-0.5">
                {targetData.targetType === "class"
                  ? `Class: ${classes.find((c) => c.id === (targetData as { classId: string }).classId)?.name ?? (targetData as { classId: string }).classId}`
                  : `${(targetData as { studentIds: string }).studentIds.split(",").length} student(s)`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Session</dt>
              <dd className="font-medium mt-0.5">
                {sessions.find((s) => s.id === targetData.sessionId)?.name ??
                  targetData.sessionId}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Category</dt>
              <dd className="font-medium mt-0.5">{chargeData.category}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-medium mt-0.5 font-mono">
                ₦{chargeData.amount.toLocaleString()}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="font-medium mt-0.5">{chargeData.description}</dd>
            </div>
            {chargeData.dueDate && (
              <div>
                <dt className="text-muted-foreground">Due Date</dt>
                <dd className="font-medium mt-0.5">{chargeData.dueDate}</dd>
              </div>
            )}
          </dl>

          {bulkMut.isError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
            >
              {parseApiError(bulkMut.error).message}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={bulkMut.isPending}
              onClick={() => bulkMut.mutate()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {bulkMut.isPending ? "Applying…" : "Confirm & Apply Charges"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
