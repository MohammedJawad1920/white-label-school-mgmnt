import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { FeeCharge } from "../types/api";

interface PaymentModalProps {
  charge: FeeCharge;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    amount: number;
    paymentMode: "Cash" | "SelfPaid";
    receiptNumber?: string;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

const schema = z.object({
  amount: z
    .number({ invalid_type_error: "Amount is required" })
    .positive("Must be positive"),
  paymentMode: z.enum(["Cash", "SelfPaid"]),
  receiptNumber: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function PaymentModal({
  charge,
  open,
  onClose,
  onSubmit,
  isLoading,
}: PaymentModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { paymentMode: "Cash" },
  });

  if (!open) return null;

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">Record Payment</h2>
        <p className="mb-4 text-sm text-gray-500">
          Balance:{" "}
          <span className="font-medium text-gray-900">
            ₦{charge.balance.toLocaleString()}
          </span>
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Amount
            </label>
            <input
              {...register("amount", { valueAsNumber: true })}
              type="number"
              step="0.01"
              max={charge.balance}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            {errors.amount && (
              <p className="mt-1 text-xs text-red-600">
                {errors.amount.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Payment Mode
            </label>
            <select
              {...register("paymentMode")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="Cash">Cash</option>
              <option value="SelfPaid">Self Paid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Receipt Number (optional)
            </label>
            <input
              {...register("receiptNumber")}
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
