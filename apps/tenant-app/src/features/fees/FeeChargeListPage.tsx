/**
 * FeeChargeListPage — Fee charges list per student with balance.
 * Filter by sessionId, classId. Record payment button opens PaymentModal.
 * Delete charge (blocked if paid).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { feesApi } from "@/api/fees.api";
import { classesApi } from "@/api/classes";
import { academicSessionsApi } from "@/api/academicSessions";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import { PaymentModal } from "@/components/PaymentModal";
import type { FeeCharge } from "@/types/api";

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

export default function FeeChargeListPage() {
  const qc = useQueryClient();
  const toast = useAppToast();

  const [sessionFilter, setSessionFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [paymentCharge, setPaymentCharge] = useState<FeeCharge | null>(null);

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => classesApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: sessionsData } = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: () => academicSessionsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const chargesQuery = useQuery({
    queryKey: [
      "fees",
      "charges",
      { sessionId: sessionFilter, classId: classFilter },
    ],
    queryFn: () =>
      feesApi.listCharges({
        sessionId: sessionFilter || undefined,
        classId: classFilter || undefined,
      }),
    staleTime: 1 * 60 * 1000,
  });

  const paymentMut = useMutation({
    mutationFn: (data: {
      chargeId: string;
      amount: number;
      paymentMode: "Cash" | "SelfPaid";
      receiptNumber?: string;
      notes?: string;
    }) =>
      feesApi.recordPayment(data.chargeId, {
        amount: data.amount,
        paymentMode: data.paymentMode,
        receiptNumber: data.receiptNumber,
        notes: data.notes,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fees", "charges"] });
      setPaymentCharge(null);
      toast.success("Payment recorded.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => feesApi.deleteCharge(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fees", "charges"] });
      toast.success("Charge deleted.");
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "CONFLICT" || code === "HAS_REFERENCES") {
        toast.mutationError(
          "Cannot delete a charge that has been (partially) paid.",
        );
      } else {
        toast.mutationError(message);
      }
    },
  });

  const charges = chargesQuery.data?.charges ?? [];
  const classes = classesData?.classes ?? [];
  const sessions = sessionsData?.sessions ?? [];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Fee Charges</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          View and manage fee charges per student.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          aria-label="Filter by session"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Sessions</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="Filter by class"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {chargesQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {parseApiError(chargesQuery.error).message}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <caption className="sr-only">Fee charges</caption>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Student
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Class
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Category
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Description
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Amount
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Paid
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Balance
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {chargesQuery.isLoading && (
              <tr>
                <td colSpan={8} className="p-0">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex gap-4 px-4 py-3 border-b animate-pulse"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                        <Skeleton key={j} className="h-4 w-16 flex-1" />
                      ))}
                    </div>
                  ))}
                </td>
              </tr>
            )}
            {!chargesQuery.isLoading && charges.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No charges found.
                </td>
              </tr>
            )}
            {charges.map((charge: FeeCharge) => (
              <tr
                key={charge.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2.5 font-medium">
                  {charge.studentName}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {charge.className}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex rounded px-1.5 py-0.5 bg-muted text-muted-foreground text-xs font-medium">
                    {charge.category}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">
                  {charge.description}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">
                  {formatCurrency(charge.amount)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-green-700">
                  {formatCurrency(charge.totalPaid)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-medium">
                  <span
                    className={
                      charge.balance > 0
                        ? "text-red-700"
                        : "text-muted-foreground"
                    }
                  >
                    {formatCurrency(charge.balance)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    {charge.balance > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentCharge(charge)}
                        className="rounded px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        Record Payment
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={deleteMut.isPending || charge.totalPaid > 0}
                      title={
                        charge.totalPaid > 0
                          ? "Cannot delete a partially paid charge"
                          : undefined
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            "Delete this charge? This cannot be undone.",
                          )
                        ) {
                          deleteMut.mutate(charge.id);
                        }
                      }}
                      className="rounded px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment modal */}
      {paymentCharge && (
        <PaymentModal
          charge={paymentCharge}
          open={!!paymentCharge}
          onClose={() => setPaymentCharge(null)}
          isLoading={paymentMut.isPending}
          onSubmit={(data) =>
            paymentMut.mutate({
              chargeId: paymentCharge.id,
              ...data,
            })
          }
        />
      )}
    </div>
  );
}
