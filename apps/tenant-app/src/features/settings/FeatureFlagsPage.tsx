/**
 * FeatureFlagsPage — Read-only list of tenant feature flags.
 * Shows feature key + enabled/disabled chip.
 */
import { useQuery } from "@tanstack/react-query";
import { featuresApi } from "@/api/features";
import { parseApiError } from "@/utils/errors";
import type { Feature } from "@/types/api";

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export default function FeatureFlagsPage() {
  const featuresQuery = useQuery({
    queryKey: ["features"],
    queryFn: () => featuresApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const features = featuresQuery.data?.features ?? [];

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Feature Flags</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Features enabled or disabled for this tenant.
        </p>
      </div>

      <div
        role="note"
        className="mb-5 flex items-start gap-2 rounded-md bg-muted border border-border px-3 py-2 text-sm text-muted-foreground"
      >
        <svg
          className="h-4 w-4 shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Feature flags are managed by the platform administrator. Contact your
        platform admin to enable or disable features.
      </div>

      {featuresQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {parseApiError(featuresQuery.error).message}
        </div>
      )}

      {featuresQuery.isLoading ? (
        <div className="rounded-lg border divide-y">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3.5 animate-pulse"
            >
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : features.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No feature flags configured for this tenant.
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {features.map((feature: Feature) => (
            <div
              key={feature.key}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/20"
            >
              <div>
                <p className="text-sm font-medium font-mono">{feature.key}</p>
                {feature.name && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {feature.name}
                  </p>
                )}
                {feature.enabledAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enabled: {new Date(feature.enabledAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  feature.enabled
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
                aria-label={`${feature.key} is ${feature.enabled ? "enabled" : "disabled"}`}
              >
                {feature.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
