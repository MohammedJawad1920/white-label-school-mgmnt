import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * SP9 — SectionCard
 * Lighter card for grouping subsections within a screen — no full Card chrome.
 * Used for At-Risk Students panel, Class Rankings card sections, Monthly Sheet filter bar.
 * Freeze §5.5 SP9.
 */
export function SectionCard({ title, children, className }: SectionCardProps) {
  return (
    <section
      className={`rounded-md border bg-card px-4 py-3 ${className ?? ""}`}
    >
      <h2 className="text-sm font-semibold text-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}
