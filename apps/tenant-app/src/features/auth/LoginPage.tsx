/**
 * LoginPage — Freeze §Screen: Tenant Login
 *
 * Error state map (Freeze §Screen: Tenant Login):
 *   400 VALIDATION_ERROR → field-level errors from server details
 *   401 INVALID_CREDENTIALS → "Invalid email or password."
 *   403 TENANT_INACTIVE → "This school account has been deactivated..."
 *   404 TENANT_NOT_FOUND → "School not found. Check the school ID and try again."
 *
 * WHY no TanStack Query:
 * Freeze explicit: "Server state: None (no TanStack Query — form POST only)."
 * Login is a one-shot mutation, not cached server state.
 *
 * WHY mode:'onBlur' on the form:
 * Freeze: "field-level errors on blur". onBlur triggers Zod per-field on
 * focus-leave, then validates the whole form on submit.
 */
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/api/auth";
import { parseApiError } from "@/utils/errors";

// ── Zod schema — matches Freeze §Screen validation rules exactly ──────────────
const loginSchema = z.object({
  // CR-19: Use z.string().min(1) — NOT .email() — student loginIds
  // (e.g. 530@greenvalley.local) are pseudo-emails exempt from RFC 5322
  email: z.string().min(1, "Email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // C-01fe: tenantId comes from VITE_TENANT_ID env var — not user input
});
type LoginFormValues = z.infer<typeof loginSchema>;

function resolveGlobalError(code: string, fallback: string): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "Invalid email or password.";
    case "TENANT_INACTIVE":
      return "This school account has been deactivated. Contact your platform administrator.";
    case "TENANT_NOT_FOUND":
      return "School not found. Check the school ID and try again.";
    default:
      return fallback;
  }
}

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? "/dashboard";

  const [globalError, setGlobalError] = useState<string | null>(null);

  // Already authenticated → skip login screen
  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: LoginFormValues) {
    setGlobalError(null);
    try {
      const res = await authApi.login({
        email: values.email,
        password: values.password,
        // C-01fe: tenantId is the UUID from VITE_TENANT_ID — never from user input
        tenantId: import.meta.env.VITE_TENANT_ID as string,
      });
      // TODO: H-07fe — add role-specific routing once role-specific routes are defined
      //   Admin → /admin/dashboard, Teacher/Student/Guardian → /dashboard
      login(res.token, res.user);
      navigate(from, { replace: true });
    } catch (err) {
      const { code, message, details } = parseApiError(err);

      // 400 VALIDATION_ERROR — apply per-field errors from server details object
      if (code === "VALIDATION_ERROR" && details) {
        const fieldMap = {
          email: "email",
          password: "password",
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

      setGlobalError(resolveGlobalError(code, message));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Sign in to your school
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your credentials below
          </p>
        </div>

        {/* Global error alert */}
        {globalError && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          >
            {globalError}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={errors.email ? true : undefined}
              placeholder="Email or Student Login ID"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive disabled:opacity-50"
              {...register("email")}
            />
            {errors.email && (
              <p
                id="email-error"
                role="alert"
                className="mt-1.5 text-xs text-destructive"
              >
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={errors.password ? true : undefined}
              placeholder="••••••••"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive disabled:opacity-50"
              {...register("password")}
            />
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="mt-1.5 text-xs text-destructive"
              >
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
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
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <a
            href="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Privacy Policy
          </a>
          {" · "}
          <a
            href="/terms"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  );
}
