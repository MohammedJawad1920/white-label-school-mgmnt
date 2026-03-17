import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useGuardianSelectedChild } from "../../hooks/useGuardianSelectedChild";
import { guardianPortalApi } from "../../api/guardian-portal.api";
import { QUERY_KEYS } from "../../utils/queryKeys";
import { getErrorMessage } from "../../utils/errors";
import { formatDisplayDate } from "../../utils/dates";
import type { FeeCharge } from "../../types/api";

const CATEGORY_LABELS: Record<string, string> = {
  TUITION: "Tuition",
  TRANSPORT: "Transport",
  HOSTEL: "Hostel",
  EXAM: "Exam",
  LIBRARY: "Library",
  SPORTS: "Sports",
  OTHER: "Other",
};

function BalanceBadge({ balance }: { balance: number }) {
  if (balance <= 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
      Due ₹{balance.toLocaleString()}
    </span>
  );
}

export default function GuardianFeesPage() {
  const { selectedChildId, selectedChild, children, setSelectedChild } =
    useGuardianSelectedChild();

  const feesQuery = useQuery({
    queryKey: QUERY_KEYS.guardianPortal.fees(selectedChildId ?? ""),
    queryFn: () => guardianPortalApi.childFees(selectedChildId!),
    enabled: !!selectedChildId,
    staleTime: 5 * 60 * 1000,
  });

  const charges: FeeCharge[] = feesQuery.data?.charges ?? [];

  const totalBalance = charges.reduce((sum, c) => sum + c.balance, 0);
  const totalCharged = charges.reduce((sum, c) => sum + c.amount, 0);
  const totalPaid = charges.reduce((sum, c) => sum + c.totalPaid, 0);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Fee Statement</h1>
      </div>

      {/* Child switcher */}
      {children.length > 1 && (
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">Viewing: </label>
          <select
            value={selectedChildId ?? ""}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.studentName}
              </option>
            ))}
          </select>
        </div>
      )}

      {!selectedChild ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading children...</p>
        </div>
      ) : (
        <>
          {/* Loading */}
          {feesQuery.isLoading && (
            <div
              className="animate-pulse space-y-3"
              aria-busy="true"
              aria-label="Loading fee statement"
            >
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg" />
                ))}
              </div>
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg border bg-card animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Error */}
          {feesQuery.isError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {getErrorMessage(feesQuery.error)}
            </div>
          )}

          {/* Empty */}
          {!feesQuery.isLoading &&
            !feesQuery.isError &&
            charges.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  No fee records found for {selectedChild.studentName}.
                </p>
              </div>
            )}

          {/* Content */}
          {!feesQuery.isLoading && !feesQuery.isError && charges.length > 0 && (
            <div className="space-y-5">
              {/* Summary totals */}
              <div
                className="grid grid-cols-3 gap-3 text-center text-sm"
                aria-label="Fee summary"
              >
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xl font-bold text-gray-900">
                    ₹{totalCharged.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Charged
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xl font-bold text-green-700">
                    ₹{totalPaid.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Paid
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div
                    className={`text-xl font-bold ${
                      totalBalance > 0 ? "text-red-700" : "text-green-700"
                    }`}
                  >
                    ₹{totalBalance.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Balance Due
                  </div>
                </div>
              </div>

              {/* Charges list */}
              <ul className="space-y-3" aria-label="Fee charges">
                {charges.map((charge) => (
                  <li key={charge.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {charge.description}
                          </span>
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                            {CATEGORY_LABELS[charge.category] ??
                              charge.category}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {charge.sessionName} · {charge.className}
                        </p>
                        {charge.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            Due: {formatDisplayDate(charge.dueDate)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{charge.amount.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Paid: ₹{charge.totalPaid.toLocaleString()}
                        </span>
                        <BalanceBadge balance={charge.balance} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="text-xs text-muted-foreground text-center">
                Fee statement is read-only. Contact the school administration to
                make payments.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
