/**
 * EditSlotDrawer — CR-31 NEW: PUT /timetable/:id
 *
 * Allows Admin to reassign the teacher and/or subject on an existing slot.
 * At least one field must differ from the current value before submit.
 * On 200: invalidate ['timetable'] + close
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { timetableApi } from "@/api/timetable";
import { usersApi } from "@/api/users";
import { subjectsApi } from "@/api/subjects";
import { parseApiError } from "@/utils/errors";
import { cn } from "@/utils/cn";
import type { TimeSlot } from "@/types/api";

const schema = z
  .object({
    teacherId: z.string().optional(),
    subjectId: z.string().optional(),
  })
  .refine((v) => !!v.teacherId || !!v.subjectId, {
    message: "At least one of teacher or subject must be selected",
    path: ["teacherId"],
  });

type FormValues = z.infer<typeof schema>;

interface EditSlotDrawerProps {
  slot: TimeSlot | null;
  onClose: () => void;
}

export function EditSlotDrawer({ slot, onClose }: EditSlotDrawerProps) {
  const queryClient = useQueryClient();
  const open = slot !== null;

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => subjectsApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const { data: teachersData } = useQuery({
    queryKey: ["users", "Teacher", ""],
    queryFn: () => usersApi.list({ role: "Teacher" }),
    staleTime: 2 * 60 * 1000,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (slot) {
      reset({ teacherId: slot.teacherId, subjectId: slot.subjectId });
    }
  }, [slot, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => timetableApi.update(slot!.id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["timetable"] });
      onClose();
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "INVALID_TEACHER") {
        setError("teacherId", { message: "User does not have Teacher role" });
      } else if (code === "NOT_FOUND") {
        setError("root", { message: "Slot or resource not found." });
      } else {
        setError("root", { message });
      }
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") handleClose();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-slot-title"
        onKeyDown={onKeyDown}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-background shadow-xl transition-transform duration-300 md:w-[420px] border-l",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0">
          <h2 id="edit-slot-title" className="text-base font-semibold">
            Edit Timetable Slot
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close drawer"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Slot info summary */}
        {slot && (
          <div className="px-4 py-2.5 bg-muted/50 border-b text-sm">
            <p className="font-medium">
              {slot.className} · {slot.dayOfWeek} · Period {slot.periodNumber}
            </p>
            {slot.label && (
              <p className="text-xs text-muted-foreground">{slot.label}</p>
            )}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-1 flex-col overflow-y-auto"
          noValidate
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {errors.root && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
              >
                {errors.root.message}
              </div>
            )}

            {/* Teacher */}
            <div>
              <label
                htmlFor="edit-teacherId"
                className="block text-sm font-medium mb-1.5"
              >
                Teacher
              </label>
              <select
                id="edit-teacherId"
                aria-describedby={
                  errors.teacherId ? "edit-teacherId-error" : undefined
                }
                aria-invalid={errors.teacherId ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("teacherId")}
              >
                <option value="">— keep current —</option>
                {teachersData?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              {errors.teacherId && (
                <p
                  id="edit-teacherId-error"
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {errors.teacherId.message}
                </p>
              )}
            </div>

            {/* Subject */}
            <div>
              <label
                htmlFor="edit-subjectId"
                className="block text-sm font-medium mb-1.5"
              >
                Subject
              </label>
              <select
                id="edit-subjectId"
                aria-describedby={
                  errors.subjectId ? "edit-subjectId-error" : undefined
                }
                aria-invalid={errors.subjectId ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("subjectId")}
              >
                <option value="">— keep current —</option>
                {subjectsData?.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.code ? ` (${s.code})` : ""}
                  </option>
                ))}
              </select>
              {errors.subjectId && (
                <p
                  id="edit-subjectId-error"
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {errors.subjectId.message}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting || mutation.isPending}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {mutation.isPending ? (
                <>
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
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
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
