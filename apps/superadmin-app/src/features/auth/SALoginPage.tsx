/**
 * SALoginPage — Freeze §SuperAdmin portal login.
 * Two fields only: email + password (no tenantSlug — platform level).
 * On success: stores sa_auth token via SAAuthContext.login(), redirects to /tenants.
 */
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useLocation } from "react-router-dom";
import { useSAAuth } from "./SAAuthContext";
import { superAdminAuthApi } from "@/api/superAdminAuth";
import { parseApiError } from "@/utils/errors";

const schema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function SALoginPage() {
  const { isAuthenticated, login } = useSAAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? "/tenants";

  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) navigate("/tenants", { replace: true });
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  async function onSubmit(values: FormValues) {
    setGlobalError(null);
    try {
      const res = await superAdminAuthApi.login(values);
      login(res.token, res.superAdmin);
      navigate(from, { replace: true });
    } catch (err) {
      const { code, message } = parseApiError(err);
      setGlobalError(
        code === "INVALID_CREDENTIALS" ? "Invalid email or password." : message,
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            SuperAdmin access only
          </p>
        </div>

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
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={errors.email ? true : undefined}
              placeholder="admin@platform.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
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
      </div>
    </div>
  );
}
