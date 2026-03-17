/**
 * StudentFeesPage — Student's own fee charges and payments.
 *
 * Shows a list of fee charges with balance outstanding.
 * Displays a total balance summary at the top.
 *
 * Path: /student/fees
 */
import { useQuery } from "@tanstack/react-query";
import { feesApi } from "../../api/fees.api";
import { useAuth } from "../../hooks/useAuth";
import { useCurrentSession } from "../../hooks/useCurrentSession";
import { parseApiError } from "../../utils/errors";
import { QUERY_KEYS } from "../../utils/queryKeys";
import type { FeeCharge } from "../../types/api";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

// ── Fee charge row ────────────────────────────────────────────────────────
function FeeChargeRow({ charge }: { charge: FeeCharge }) {
  const hasDue = charge.balance > 0;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{charge.description}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {charge.category}
            {charge.dueDate && (
              <span className="ml-2">· Due: {charge.dueDate}</span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">
            {formatCurrency(charge.amount)}
          </p>
          <p
            className={`text-xs font-medium mt-0.5 ${hasDue ? "text-red-600" : "text-green-600"}`}
          >
            {hasDue ? `Balance: ${formatCurrency(charge.balance)}` : "Paid"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t">
        <div>
          <p className="text-muted-foreground">Charged</p>
          <p className="font-medium">{formatCurrency(charge.amount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Paid</p>
          <p className="font-medium text-green-700">
            {formatCurrency(charge.totalPaid)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Balance</p>
          <p
            className={`font-medium ${hasDue ? "text-red-600" : "text-muted-foreground"}`}
          >
            {formatCurrency(charge.balance)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function StudentFeesPage() {
  const { user } = useAuth();
  const studentId = user?.studentId ?? null;
  const currentSession = useCurrentSession();

  const chargesQ = useQuery({
    queryKey: QUERY_KEYS.fees.charges(
      studentId
        ? { studentId, sessionId: currentSession?.id }
        : { sessionId: currentSession?.id },
    ),
    queryFn: () =>
      feesApi.listCharges({
        studentId: studentId ?? undefined,
        sessionId: currentSession?.id,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!studentId,
  });

  const charges = chargesQ.data?.charges ?? [];
  const apiError = chargesQ.isError ? parseApiError(chargesQ.error) : null;

  // Compute totals
  const totalCharged = charges.reduce((s, c) => s + c.amount, 0);
  const totalPaid = charges.reduce((s, c) => s + c.totalPaid, 0);
  const totalBalance = charges.reduce((s, c) => s + c.balance, 0);

  if (!studentId) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold mb-4">My Fees</h1>
        <div
          role="alert"
          className="rounded-lg border bg-muted/20 px-4 py-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Your student profile is not linked. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">My Fees</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Fee charges and payment status
          {currentSession ? ` — ${currentSession.name}` : ""}
        </p>
      </div>

      {/* Loading */}
      {chargesQ.isLoading && (
        <div className="space-y-4">
          {/* Summary skeleton */}
          <div className="animate-pulse rounded-lg border bg-card p-4 flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 h-14 bg-muted rounded" />
            ))}
          </div>
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border bg-card p-4 space-y-2"
            >
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {chargesQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiError?.message ?? "Failed to load fee information."}
        </div>
      )}

      {/* Summary bar */}
      {!chargesQ.isLoading && !chargesQ.isError && charges.length > 0 && (
        <div
          className="grid grid-cols-3 gap-3 mb-5 rounded-lg border bg-card p-4 text-center text-sm"
          aria-label="Fee summary"
        >
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Charged</p>
            <p className="font-semibold">{formatCurrency(totalCharged)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
            <p className="font-semibold text-green-700">
              {formatCurrency(totalPaid)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Balance Due</p>
            <p
              className={`font-semibold ${totalBalance > 0 ? "text-red-600" : "text-muted-foreground"}`}
            >
              {formatCurrency(totalBalance)}
            </p>
          </div>
        </div>
      )}

      {/* Empty */}
      {!chargesQ.isLoading && !chargesQ.isError && charges.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border bg-muted/10">
          <p className="text-sm text-muted-foreground">
            No fee charges found
            {currentSession ? ` for ${currentSession.name}` : ""}.
          </p>
        </div>
      )}

      {/* Charge list */}
      {!chargesQ.isLoading && charges.length > 0 && (
        <ul className="space-y-3">
          {charges.map((charge) => (
            <li key={charge.id}>
              <FeeChargeRow charge={charge} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
