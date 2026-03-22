/**
 * ChangePasswordPage — v5.0 M-011
 *
 * Two modes:
 * 1. Forced mode (mustChangePassword=true): full-screen, no nav, no escape.
 *    Admin has required the user to change their password before proceeding.
 * 2. Voluntary mode (user navigates to /change-password): rendered inside Layout.
 *    User can navigate away.
 *
 * On success: login() updates sessionStorage with fresh JWT (mustChangePassword=false),
 * then navigate to /dashboard.
 *
 * Error codes:
 *   401 INVALID_CURRENT_PASSWORD → inline "Current password is incorrect."
 *   400 VALIDATION_ERROR → per-field
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/api/auth";
import { parseApiError } from "@/utils/errors";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const { user, mustChangePassword, login } = useAuth();
  const navigate = useNavigate();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    setGlobalError(null);
    setSuccess(false);
    try {
      const res = await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      login(res.token, res.user);
      setSuccess(true);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const { code, message, details } = parseApiError(err);

      // C-03fe: correct error code — OpenAPI returns INCORRECT_PASSWORD (not INVALID_CURRENT_PASSWORD)
      if (code === "INCORRECT_PASSWORD") {
        setError("currentPassword", {
          message: "Current password is incorrect.",
        });
        return;
      }

      if (code === "VALIDATION_ERROR" && details) {
        const fieldMap = {
          currentPassword: "currentPassword",
          newPassword: "newPassword",
        } as const;
        let hadField = false;
        for (const [serverKey, formKey] of Object.entries(fieldMap)) {
          if (details[serverKey]) {
            setError(formKey, { message: String(details[serverKey]) });
            hadField = true;
          }
        }
        if (!hadField) setGlobalError(message);
        return;
      }

      setGlobalError(message);
    }
  }

  const form = (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {globalError && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          {globalError}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800"
        >
          Password changed successfully.
        </div>
      )}

      {/* Current Password */}
      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium mb-1.5"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          aria-describedby={
            errors.currentPassword ? "currentPassword-error" : undefined
          }
          aria-invalid={errors.currentPassword ? true : undefined}
          placeholder="••••••••"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive disabled:opacity-50"
          {...register("currentPassword")}
        />
        {errors.currentPassword && (
          <p
            id="currentPassword-error"
            role="alert"
            className="mt-1.5 text-xs text-destructive"
          >
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      {/* New Password */}
      <div>
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium mb-1.5"
        >
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-describedby={
            errors.newPassword ? "newPassword-error" : undefined
          }
          aria-invalid={errors.newPassword ? true : undefined}
          placeholder="At least 8 characters"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive disabled:opacity-50"
          {...register("newPassword")}
        />
        {errors.newPassword && (
          <p
            id="newPassword-error"
            role="alert"
            className="mt-1.5 text-xs text-destructive"
          >
            {errors.newPassword.message}
          </p>
        )}
      </div>

      {/* Confirm New Password */}
      <div>
        <label
          htmlFor="confirmNewPassword"
          className="block text-sm font-medium mb-1.5"
        >
          Confirm new password
        </label>
        <input
          id="confirmNewPassword"
          type="password"
          autoComplete="new-password"
          aria-describedby={
            errors.confirmNewPassword ? "confirmNewPassword-error" : undefined
          }
          aria-invalid={errors.confirmNewPassword ? true : undefined}
          placeholder="••••••••"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive disabled:opacity-50"
          {...register("confirmNewPassword")}
        />
        {errors.confirmNewPassword && (
          <p
            id="confirmNewPassword-error"
            role="alert"
            className="mt-1.5 text-xs text-destructive"
          >
            {errors.confirmNewPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors mt-2"
      >
        {isSubmitting ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
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
            Changing password…
          </>
        ) : (
          "Change password"
        )}
      </button>
    </form>
  );

  // Forced mode: full-screen, no nav (user cannot escape)
  if (mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-100 mb-4">
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Change your password
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your administrator requires you to set a new password before
              continuing.
            </p>
            {user && (
              <p className="text-xs text-muted-foreground mt-1">
                Signed in as <span className="font-medium">{user.email}</span>
              </p>
            )}
          </div>
          {form}
        </div>
      </div>
    );
  }

  // Voluntary mode: rendered inside the normal Layout shell
  return (
    <div className="max-w-sm mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Change password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your account password.
        </p>
      </div>
      {form}
    </div>
  );
}
