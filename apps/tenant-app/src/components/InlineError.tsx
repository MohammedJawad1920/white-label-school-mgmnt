interface InlineErrorProps {
  message: string;
}

/**
 * SP4 — InlineError
 * Field-level or section-level inline error — NOT a toast.
 * Freeze §5.5 SP4.
 */
export function InlineError({ message }: InlineErrorProps) {
  return <p className="text-destructive text-sm mt-1">{message}</p>;
}
