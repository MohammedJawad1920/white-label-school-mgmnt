/**
 * StatusBadge — Freeze §5 "Component inventory", §11 project structure.
 *
 * Renders a coloured pill badge for attendance statuses (Present / Absent / Late).
 * Colours match Freeze §5 Design System:
 *   Present  → bg-green-100  text-green-800
 *   Absent   → bg-red-100    text-red-800
 *   Late     → bg-yellow-100 text-yellow-800
 *
 * Usage:
 *   <StatusBadge status={record.status} />
 *   <StatusBadge status={record.originalStatus} />
 *
 * The status text is always rendered as a visible text label so screen readers
 * get the value without needing an aria-label. (Freeze §6 A11y: "Status badges:
 * text label present".)
 */

export type AttendanceStatusLabel = "Present" | "Absent" | "Late";

const STATUS_CLASSES: Record<AttendanceStatusLabel, string> = {
  Present: "bg-green-100 text-green-800",
  Absent: "bg-red-100 text-red-800",
  Late: "bg-yellow-100 text-yellow-800",
};

interface StatusBadgeProps {
  /** The attendance status value — one of Present | Absent | Late */
  status: string;
  /** Optional extra Tailwind classes merged onto the badge span */
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colourCls =
    STATUS_CLASSES[status as AttendanceStatusLabel] ??
    "bg-muted text-muted-foreground";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colourCls,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {status}
    </span>
  );
}
