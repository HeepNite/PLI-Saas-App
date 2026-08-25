"use client"

import React from "react"
import { Loader2 } from "lucide-react"
import {
  FormState,
  PurchaseOption,
  SETTLEMENT_STATUSES,
  PAYMENT_METHODS,
} from "./types"

type PaymentTabFormProps = {
  form: FormState
  availablePurchases: PurchaseOption[]
  purchasesLoading: boolean
  purchasesError: string | null
  submitState: string
  onPurchaseSelect: (purchaseId: string) => void
  onFieldChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  onDeletePurchase: () => void
  formatPurchaseSummary: (p: PurchaseOption) => string
}

export function PaymentTabForm({
  form,
  availablePurchases,
  purchasesLoading,
  purchasesError,
  submitState,
  onPurchaseSelect,
  onFieldChange,
  onDeletePurchase,
  formatPurchaseSummary,
}: PaymentTabFormProps) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">
          Purchase <span className="text-[var(--brand,#b61616)]">*</span>
        </span>
        {purchasesLoading ? (
          <div className="flex items-center gap-2 rounded-md border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading purchases...
          </div>
        ) : purchasesError ? (
          <div className="rounded-md border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/5 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
            {purchasesError}
          </div>
        ) : availablePurchases.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            No purchases found for this student.
          </div>
        ) : (
          <>
            <select
              value={form.paymentPurchaseId}
              onChange={(e) => onPurchaseSelect(e.target.value)}
              className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            >
              <option value="">Select purchase</option>
              {availablePurchases.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatPurchaseSummary(p)}
                </option>
              ))}
            </select>
            {availablePurchases.length === 1 && form.paymentPurchaseId ? (
              <p className="text-[11px] text-black/45 dark:text-white/45">
                Auto-selected: {formatPurchaseSummary(availablePurchases[0])}
              </p>
            ) : null}
          </>
        )}
      </label>

      {form.paymentPurchaseId && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={submitState === "submitting"}
            onClick={() => {
              if (confirm("Are you sure you want to permanently delete this purchase? This cannot be undone.")) {
                onDeletePurchase()
              }
            }}
            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
          >
            Delete this purchase
          </button>
          <span className="text-[11px] text-black/40 dark:text-white/40">
            Permanently removes the purchase record
          </span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-black/65 dark:text-white/65">Amount (USD)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.paymentAmount}
            onChange={(e) => onFieldChange("paymentAmount", e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-black/65 dark:text-white/65">Outstanding Balance (USD)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.paymentOutstandingBalance}
            onChange={(e) => onFieldChange("paymentOutstandingBalance", e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-black/65 dark:text-white/65">Settlement Status</span>
          <select
            value={form.paymentSettlementStatus}
            onChange={(e) => onFieldChange("paymentSettlementStatus", e.target.value)}
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            {SETTLEMENT_STATUSES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-black/65 dark:text-white/65">Payment Method</span>
          <select
            value={form.paymentMethod}
            onChange={(e) => onFieldChange("paymentMethod", e.target.value)}
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            {PAYMENT_METHODS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
