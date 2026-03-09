import type { ReactNode } from "react";

interface DataCardProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * SP2 — DataCard
 * Card wrapper with header + content + optional footer.
 * Freeze §5.5 SP2.
 */
export function DataCard({
  header,
  footer,
  children,
  className,
}: DataCardProps) {
  return (
    <div
      className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className ?? ""}`}
    >
      {header && (
        <div className="flex flex-col space-y-1.5 p-6 pb-4">{header}</div>
      )}
      <div className="p-6 pt-0">{children}</div>
      {footer && <div className="flex items-center p-6 pt-0">{footer}</div>}
    </div>
  );
}
