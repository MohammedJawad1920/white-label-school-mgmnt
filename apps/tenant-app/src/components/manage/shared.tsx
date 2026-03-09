/**
 * manage/shared.tsx — Shared UI primitives for all manage screens.
 *
 * Contains:
 *   TableSkeleton      — animated placeholder rows
 *   BulkActionBar      — sticky bar with count + bulk delete button
 *   Drawer             — slide-in panel (create/edit forms)
 *   ConfirmDialog      — destructive action confirmation
 *   FormField          — label + input + error wrapper
 *
 * WHY a single shared file (not separate files per component):
 * All manage pages use identical structural patterns. One import keeps
 * each page file short and the pattern consistent across 6 screens.
 *
 * WHY aria-live="polite" on BulkActionBar count:
 * Freeze §6: "aria-live='polite' on bulk action count updates".
 * Screen readers announce the selection count as it changes without
 * interrupting current speech.
 */
import { type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { ConfirmDialog as SharedConfirmDialog } from "@/components/ConfirmDialog";

// ── Table skeleton ────────────────────────────────────────────────────────────
export function TableSkeleton({
  rows = 8,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-b-0">
          <div className="h-4 w-4 bg-muted rounded" />
          {Array.from({ length: cols - 1 }).map((_, j) => (
            <div
              key={j}
              className={`h-4 bg-muted rounded ${j === 0 ? "flex-1" : "w-24"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Bulk action bar ───────────────────────────────────────────────────────────
interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
  isDeleting: boolean;
}
export function BulkActionBar({
  selectedCount,
  onDelete,
  onClear,
  isDeleting,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;
  return (
    <div
      className="sticky bottom-4 mx-auto max-w-3xl z-20"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center justify-between gap-4 rounded-lg border bg-background shadow-lg px-4 py-3">
        <span className="text-sm font-medium">
          <span aria-label={`${selectedCount} items selected`}>
            {selectedCount}
          </span>{" "}
          selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={onClear}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : `Delete ${selectedCount}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────
interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}
export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: DrawerProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-background shadow-xl border-l transition-transform duration-300 md:w-[420px]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0">
          <h2 id="drawer-title" className="text-base font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>
        <div className="border-t p-4 shrink-0">{footer}</div>
      </div>
    </>
  );
}

// ── Confirm dialog ───────────────────────────────────────────────────────────
// Adapter that maps the legacy manage-screen API onto the canonical SP6
// ConfirmDialog. New screens should use @/components/ConfirmDialog directly.
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
}
export function ConfirmDialog({
  open,
  title,
  message,
  error,
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  const description = error ? `${message}\n\n${error}` : message;
  return (
    <SharedConfirmDialog
      open={open}
      title={title}
      description={description}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isLoading={loading}
    />
  );
}

// ── Form field ────────────────────────────────────────────────────────────────
interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}
export function FormField({
  id,
  label,
  error,
  hint,
  required,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        {label}
        {required && (
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-xs text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ── Input / Select shared class ───────────────────────────────────────────────
export const inputCls = (hasError: boolean) =>
  cn(
    "w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    hasError ? "border-destructive" : "border-input",
  );

// ── Submit footer ─────────────────────────────────────────────────────────────
interface SubmitFooterProps {
  onCancel: () => void;
  isLoading: boolean;
  submitLabel: string;
}
export function SubmitFooter({
  onCancel,
  isLoading,
  submitLabel,
}: SubmitFooterProps) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <svg
              className="h-3.5 w-3.5 animate-spin"
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
            Saving…
          </>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}

// ── Row checkbox ──────────────────────────────────────────────────────────────
interface RowCheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}
export function RowCheckbox({
  id,
  label,
  checked,
  onChange,
}: RowCheckboxProps) {
  return (
    <input
      type="checkbox"
      id={`chk-${id}`}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
      className="h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
    />
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
}
export function PageHeader({
  title,
  subtitle,
  onAdd,
  addLabel = "Add",
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          {addLabel}
        </button>
      )}
    </div>
  );
}

// ── Table header cell ─────────────────────────────────────────────────────────
export function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </th>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────
interface ActionBtnProps {
  onClick: () => void;
  label: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
}
export function ActionBtn({
  onClick,
  label,
  variant = "default",
  disabled,
}: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
        variant === "destructive"
          ? "text-destructive border border-destructive/30 hover:bg-destructive/10"
          : "border hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

// ── Root error banner ─────────────────────────────────────────────────────────
export function RootError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
