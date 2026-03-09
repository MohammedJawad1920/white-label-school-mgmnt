import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
} as const;

/**
 * SP5 — LoadingSpinner
 * Loader2 from lucide-react + animate-spin. Respects prefers-reduced-motion.
 * Freeze §5.5 SP5.
 */
export function LoadingSpinner({
  size = "md",
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      className="flex items-center justify-center"
      aria-label="Loading"
      role="status"
    >
      <Loader2
        className={cn(
          "motion-safe:animate-spin text-muted-foreground",
          sizeMap[size],
          className,
        )}
        aria-hidden="true"
      />
    </div>
  );
}
