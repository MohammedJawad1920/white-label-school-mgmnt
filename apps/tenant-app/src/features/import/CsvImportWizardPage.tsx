/**
 * CsvImportWizardPage — CSV import wizard.
 * Step 1: entity select + file upload (.csv validation)
 * Step 2: Preview table with error rows highlighted + CountdownTimer
 * Navigation guard when step===2 && jobId !== null.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBlocker } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { importApi } from "@/api/import.api";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import { CountdownTimer } from "@/components/CountdownTimer";
import { StepWizard } from "@/components/StepWizard";
import type { ApiImportJob } from "@/types/api";

const IMPORT_ENTITIES = [
  { value: "students", label: "Students" },
  { value: "users", label: "Users" },
  { value: "classes", label: "Classes" },
  { value: "subjects", label: "Subjects" },
];

const WIZARD_STEPS = [{ label: "Upload" }, { label: "Preview" }];

export default function CsvImportWizardPage() {
  const navigate = useNavigate();
  const toast = useAppToast();

  const [step, setStep] = useState(0);
  const [entity, setEntity] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [job, setJob] = useState<ApiImportJob | null>(null);
  const [expired, setExpired] = useState(false);

  // Navigation guard: block navigation when step===2 && jobId !== null
  const shouldBlock = step === 1 && job !== null && !expired;
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state === "blocked") {
      const confirmed = window.confirm(
        "You have an active import preview. Leaving will cancel the import. Are you sure?",
      );
      if (confirmed) {
        // Cancel the job
        if (job) {
          void importApi.cancel(job.id).catch(() => undefined);
        }
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker, job]);

  // Beforeunload guard for browser tab close
  useEffect(() => {
    if (!shouldBlock) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldBlock]);

  const previewMut = useMutation({
    mutationFn: ({ file: f, ent }: { file: File; ent: string }) =>
      importApi.preview(f, ent),
    onSuccess: (data) => {
      setJob(data.job);
      setStep(1);
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const confirmMut = useMutation({
    mutationFn: () => importApi.confirm(job!.id),
    onSuccess: (data) => {
      toast.success(
        `Import complete. ${data.imported} row${data.imported !== 1 ? "s" : ""} imported.`,
      );
      navigate("/admin/import/history");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const cancelMut = useMutation({
    mutationFn: () => importApi.cancel(job!.id),
    onSuccess: () => {
      setJob(null);
      setStep(0);
      setFile(null);
      setEntity("");
      toast.success("Import cancelled.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFileError(null);
    if (f) {
      if (!f.name.endsWith(".csv")) {
        setFileError("Only .csv files are accepted.");
        setFile(null);
        return;
      }
      setFile(f);
    }
  }

  function handleUpload() {
    if (!entity) {
      setFileError("Select an entity type.");
      return;
    }
    if (!file) {
      setFileError("Select a .csv file.");
      return;
    }
    previewMut.mutate({ file, ent: entity });
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">CSV Import</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Import data from a CSV file.
        </p>
      </div>

      <div className="mb-6">
        <StepWizard steps={WIZARD_STEPS} currentStep={step} />
      </div>

      {/* Step 1: Upload */}
      {step === 0 && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold">
            Step 1: Select Entity &amp; Upload File
          </h2>

          <div>
            <label
              htmlFor="imp-entity"
              className="block text-sm font-medium mb-1.5"
            >
              Entity Type{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="imp-entity"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select entity…</option>
              {IMPORT_ENTITIES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="imp-file"
              className="block text-sm font-medium mb-1.5"
            >
              CSV File{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="imp-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              aria-describedby={fileError ? "imp-file-err" : undefined}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-muted file:text-foreground"
            />
            {fileError && (
              <p
                id="imp-file-err"
                role="alert"
                className="mt-1 text-xs text-destructive"
              >
                {fileError}
              </p>
            )}
            {file && !fileError && (
              <p className="mt-1 text-xs text-muted-foreground">
                Selected: <span className="font-medium">{file.name}</span> (
                {(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {entity && (
            <div>
              <a
                href={importApi.templateUrl(entity)}
                download
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Download CSV template for {entity}
              </a>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={previewMut.isPending || !file || !entity}
              onClick={handleUpload}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {previewMut.isPending ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
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
                  Uploading…
                </>
              ) : (
                "Upload &amp; Preview"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 1 && job && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div>
                <h2 className="text-sm font-semibold">Step 2: Preview</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {job.totalRows} rows · {job.validRows} valid · {job.errorRows}{" "}
                  errors
                </p>
              </div>
              <CountdownTimer
                expiresAt={job.expiresAt}
                onExpired={() => {
                  setExpired(true);
                  toast.mutationError("Preview expired. Please upload again.");
                }}
              />
            </div>

            {expired && (
              <div
                role="alert"
                className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 mb-3"
              >
                The preview has expired. Please upload your file again.
              </div>
            )}

            {job.errorRows > 0 && (
              <div
                role="alert"
                className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 mb-3"
              >
                {job.errorRows} row{job.errorRows !== 1 ? "s have" : " has"}{" "}
                errors. Fix and re-upload before confirming.
              </div>
            )}

            {/* Preview table */}
            {job.previewData.length > 0 && (
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-xs">
                  <caption className="sr-only">Import preview</caption>
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left font-medium text-muted-foreground"
                      >
                        #
                      </th>
                      {Object.keys(job.previewData[0]!).map((col) => (
                        <th
                          key={col}
                          scope="col"
                          className="px-3 py-2 text-left font-medium text-muted-foreground capitalize"
                        >
                          {col}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="px-3 py-2 text-left font-medium text-muted-foreground"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.previewData.map((row, idx) => {
                      const rowError = job.errors.find(
                        (e) => e.row === idx + 1,
                      );
                      return (
                        <tr
                          key={idx}
                          className={`border-b last:border-b-0 ${rowError ? "bg-red-50" : "hover:bg-muted/20"}`}
                          aria-invalid={!!rowError}
                        >
                          <td className="px-3 py-2 text-muted-foreground">
                            {idx + 1}
                          </td>
                          {Object.values(row).map((cell, ci) => (
                            <td key={ci} className="px-3 py-2">
                              {String(cell)}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            {rowError ? (
                              <span
                                className="text-red-700 font-medium"
                                title={`${rowError.field}: ${rowError.message}`}
                              >
                                Error: {rowError.message}
                              </span>
                            ) : (
                              <span className="text-green-700">Valid</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel Import
            </button>
            <button
              type="button"
              disabled={job.errorRows > 0 || confirmMut.isPending || expired}
              onClick={() => confirmMut.mutate()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {confirmMut.isPending
                ? "Importing…"
                : `Confirm Import (${job.validRows} rows)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
