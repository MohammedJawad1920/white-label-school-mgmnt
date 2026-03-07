/**
 * TenantFeaturesPage — Freeze §Screen: Tenant Feature Flags
 *
 * Query:    ['sa-features', tenantId]   stale: 30 sec
 * Mutation: PUT /super-admin/tenants/:id/features/:key
 *
 * OPTIMISTIC UPDATES — only page in the app that uses them (Freeze §3):
 * 1. User clicks toggle
 * 2. UI immediately reflects new state (optimistic)
 * 3. PUT request fires
 * 4. On 200: server data replaces optimistic state
 * 5. On 400 FEATURE_DEPENDENCY: revert to old state + show inline warning
 * 6. On any other error: revert + show error message
 *
 * WHY optimistic here only:
 * Freeze §3: "Optimistic updates: Feature flag toggles on /tenants/:id/features only."
 * Toggle UX must feel instant — 30+ ms round trip feels laggy for a simple boolean.
 *
 * Client-side guard (Freeze §Screen):
 * Attendance toggle is disabled when timetable is currently OFF.
 * This mirrors the server-side dependency rule to prevent obviously blocked requests.
 *
 * Accessibility (Freeze §6):
 * Each toggle uses role="switch" + aria-checked + aria-label per WCAG.
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantsApi } from "@/api/tenants";
import { parseApiError } from "@/utils/errors";
import { cn } from "@/utils/cn";
import type { TenantFeature, FeatureKey } from "@/types/api";

// ── Toggle switch component ───────────────────────────────────────────────────
interface ToggleProps {
  featureKey: FeatureKey;
  label: string;
  enabled: boolean;
  disabled: boolean;
  loading: boolean;
  onToggle: (key: FeatureKey, newValue: boolean) => void;
}

function FeatureToggle({
  featureKey,
  label,
  enabled,
  disabled,
  loading,
  onToggle,
}: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      aria-disabled={disabled || loading}
      onClick={() => !disabled && !loading && onToggle(featureKey, !enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        enabled && !disabled ? "bg-primary" : "bg-input",
        disabled || loading
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200",
          enabled ? "translate-x-5" : "translate-x-0",
        )}
      />
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg
            className="h-3 w-3 animate-spin text-muted-foreground"
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
        </span>
      )}
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function FeatureSkeleton() {
  return (
    <div
      className="animate-pulse space-y-3"
      aria-busy="true"
      aria-label="Loading features"
    >
      {[1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-lg border"
        >
          <div className="space-y-1.5">
            <div className="h-4 bg-muted rounded w-40" />
            <div className="h-3 bg-muted rounded w-64" />
          </div>
          <div className="h-6 w-11 bg-muted rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TenantFeaturesPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Optimistic feature state — key: featureKey, value: overridden enabled bool
  // WHY Map not object: clean entry removal on revert
  const [optimistic, setOptimistic] = useState<Map<FeatureKey, boolean>>(
    new Map(),
  );
  const [loadingKeys, setLoadingKeys] = useState<Set<FeatureKey>>(new Set());
  const [errors, setErrors] = useState<Map<FeatureKey, string>>(new Map());

  const queryKey = ["sa-features", tenantId];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => tenantsApi.listFeatures(tenantId!),
    staleTime: 30 * 1000,
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: ({ key, enabled }: { key: FeatureKey; enabled: boolean }) =>
      tenantsApi.toggleFeature(tenantId!, key, { enabled }),

    onMutate: ({ key, enabled }) => {
      // Apply optimistic update immediately
      setOptimistic((prev) => new Map(prev).set(key, enabled));
      setLoadingKeys((prev) => new Set(prev).add(key));
      setErrors((prev) => {
        const m = new Map(prev);
        m.delete(key);
        return m;
      });
      // Return snapshot for rollback
      return { key, previousEnabled: !enabled };
    },

    onSuccess: async (data, { key }) => {
      setLoadingKeys((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
      // Remove optimistic override — server data takes over
      setOptimistic((prev) => {
        const m = new Map(prev);
        m.delete(key);
        return m;
      });
      await queryClient.invalidateQueries({ queryKey });
      // Update cache directly with server response to avoid stale flash
      // old is ListTenantFeaturesResponse (the GET query's cached data), not ToggleFeatureResponse
      queryClient.setQueryData(
        queryKey,
        (old: { features: TenantFeature[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            features: old.features.map((f: TenantFeature) =>
              f.featureKey === key ? data.feature : f,
            ),
          };
        },
      );
    },

    onError: (err, { key }, context) => {
      setLoadingKeys((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
      // Revert optimistic update
      if (context) {
        setOptimistic((prev) =>
          new Map(prev).set(key, context.previousEnabled),
        );
        // Small delay then remove so UI settles on server state after refetch
        setTimeout(() => {
          setOptimistic((prev) => {
            const m = new Map(prev);
            m.delete(key);
            return m;
          });
        }, 800);
      }
      const { code, message } = parseApiError(err);
      if (code === "FEATURE_DEPENDENCY") {
        setErrors((prev) =>
          new Map(prev).set(
            key,
            "Attendance requires Timetable to be enabled first.",
          ),
        );
      } else {
        setErrors((prev) => new Map(prev).set(key, message));
      }
    },
  });

  // Merge server data with optimistic overrides
  const features: TenantFeature[] = (data?.features ?? []).map((f) => ({
    ...f,
    enabled: optimistic.has(f.featureKey as FeatureKey)
      ? optimistic.get(f.featureKey as FeatureKey)!
      : f.enabled,
  }));

  // Client-side guard: attendance disabled when timetable is off
  const timetableEnabled =
    features.find((f) => f.featureKey === "timetable")?.enabled ?? false;

  function handleToggle(key: FeatureKey, newValue: boolean) {
    mutation.mutate({ key, enabled: newValue });
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      {/* Back */}
      <button
        onClick={() => navigate("/tenants")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Tenants
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">Feature Flags</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tenant ID: <span className="font-mono">{tenantId}</span>
        </p>
      </div>

      {isLoading && <FeatureSkeleton />}

      {isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          Failed to load features. Tenant may not exist.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-3" role="list" aria-label="Feature flags">
          {features.map((feature) => {
            const fkey = feature.featureKey as FeatureKey;
            const isAttendance = fkey === "attendance";
            // Disable attendance toggle if timetable is off (client guard)
            const isDisabled = isAttendance && !timetableEnabled;
            const isLoading = loadingKeys.has(fkey);
            const errorMsg = errors.get(fkey);

            return (
              <div
                key={fkey}
                role="listitem"
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {feature.featureName}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          feature.enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {feature.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {feature.featureDescription}
                    </p>
                    {isDisabled && (
                      <p className="text-xs text-muted-foreground italic">
                        Enable Timetable first to unlock Attendance.
                      </p>
                    )}
                  </div>

                  <FeatureToggle
                    featureKey={fkey}
                    label={feature.featureName}
                    enabled={feature.enabled}
                    disabled={isDisabled}
                    loading={isLoading}
                    onToggle={handleToggle}
                  />
                </div>

                {/* Inline error — shown below the toggle row */}
                {errorMsg && (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="mt-2 text-xs text-destructive"
                  >
                    {errorMsg}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
