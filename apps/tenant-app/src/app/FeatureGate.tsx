import type { ReactNode } from "react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import type { FeatureKey } from "@/types/api";

function FeatureDisabledPage({ featureKey }: { featureKey: FeatureKey }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full p-8 text-center"
      role="main"
    >
      <div className="max-w-sm space-y-3">
        <div className="text-5xl" aria-hidden="true">
          🔒
        </div>
        <h2 className="text-xl font-semibold">Feature Not Enabled</h2>
        <p className="text-muted-foreground text-sm">
          The <span className="font-medium capitalize">{featureKey}</span>{" "}
          feature is not enabled for your school. Contact your platform
          administrator.
        </p>
      </div>
    </div>
  );
}

interface FeatureGateProps {
  featureKey: FeatureKey;
  children: ReactNode;
}

/**
 * WHY at route level (not inside pages):
 * Pages shouldn't know they might be disabled. FeatureGate wraps routes in
 * App.tsx so any child page gets full-page FEATURE_DISABLED state for free.
 */
export function FeatureGate({ featureKey, children }: FeatureGateProps) {
  const enabled = useFeatureFlag(featureKey);
  if (enabled === undefined) return null; // loading — avoid flash
  if (!enabled) return <FeatureDisabledPage featureKey={featureKey} />;
  return <>{children}</>;
}
