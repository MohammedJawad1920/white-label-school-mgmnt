import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

/**
 * SP1 — PageHeader
 * Renders the only <h1> on a screen. Mobile: title hidden (TopBar owns mobile title).
 * Freeze §5.5 SP1.
 */
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-semibold hidden md:block">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
