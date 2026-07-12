"use client"

import React from "react"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { AddPackageState, DuplicateActivePackage, PackagePlanOption } from "./types"

type AddPackageFormProps = {
  plans: PackagePlanOption[]
  plansLoading: boolean
  plansError: string | null
  selectedPlanId: string
  expiresAt: string
  reason: string
  state: AddPackageState
  errorMessage: string | null
  duplicate: DuplicateActivePackage | null
  grantedPurchaseId: string | null
  onSelectPlan: (planId: string) => void
  onExpiresAtChange: (value: string) => void
  onReasonChange: (value: string) => void
  onSubmit: () => void
  onConfirmDuplicate: () => void
  onStartAnother: () => void
}

const formatPlanSummary = (plan: PackagePlanOption): string => {
  const priceLabel = plan.priceCents != null ? `$${(plan.priceCents / 100).toFixed(2)}` : "No price"
  const creditsLabel = plan.isUnlimited ? "Unlimited" : `${plan.totalCredits ?? 0} credits`
  return `${plan.label} · ${priceLabel} · ${creditsLabel} · ${plan.validDays}d`
}

/**
 * Default expiry input value: today + plan.validDays, formatted for
 * `<input type="date">`.
 *
 * Reads the LOCAL calendar fields (year/month/day) directly instead of
 * going through `toISOString()`, which converts to UTC first. For studios
 * west of UTC (e.g. America/New_York), a UTC conversion can shift the
 * calendar date backward by one day, so a "today + validDays" default could
 * land a day earlier than intended (and, at the boundary, even in the past
 * once combined with the end-of-day expiry conversion on submit).
 */
const defaultExpiryFor = (plan: PackagePlanOption | undefined): string => {
  if (!plan) return ""
  const date = new Date()
  date.setDate(date.getDate() + plan.validDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function AddPackageForm({
  plans,
  plansLoading,
  plansError,
  selectedPlanId,
  expiresAt,
  reason,
  state,
  errorMessage,
  duplicate,
  grantedPurchaseId,
  onSelectPlan,
  onExpiresAtChange,
  onReasonChange,
  onSubmit,
  onConfirmDuplicate,
  onStartAnother,
}: AddPackageFormProps) {
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId)
  const isSubmitting = state === "submitting"

  if (state === "success") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-800 dark:text-emerald-200">
              Cash package grant created and pending settlement.
            </p>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              {grantedPurchaseId ? `Purchase ${grantedPurchaseId} ` : "It "}
              will appear on the payments board. Mark it paid there to activate the package.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStartAnother}
          className="mt-4 rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
        >
          Grant another package
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-black/10 bg-black/[0.015] p-4 dark:border-white/10 dark:bg-white/[0.015]">
      <div>
        <p className="text-sm font-semibold text-black dark:text-white">Add package (cash, pending)</p>
        <p className="mt-1 text-xs text-black/55 dark:text-white/55">
          Creates a pending cash purchase from a plan. It appears on the payments board and
          activates once marked paid there.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
          {errorMessage}
        </div>
      ) : null}

      {state === "duplicate" && duplicate ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">This student already has an active package for this plan.</p>
              <p className="mt-1 text-xs">
                {duplicate.label ? `${duplicate.label} · ` : ""}
                {duplicate.expiresAt
                  ? `Expires ${new Date(duplicate.expiresAt).toLocaleDateString()}`
                  : "No expiry"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onConfirmDuplicate}
            disabled={isSubmitting}
            className="mt-3 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isSubmitting ? "Granting..." : "Grant anyway"}
          </button>
        </div>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">
          Package plan <span className="text-[var(--brand,#b61616)]">*</span>
        </span>
        {plansLoading ? (
          <div className="flex items-center gap-2 rounded-md border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading package plans...
          </div>
        ) : plansError ? (
          <div className="rounded-md border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/5 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
            {plansError}
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            No active package plans available.
          </div>
        ) : (
          <select
            value={selectedPlanId}
            onChange={(e) => {
              const planId = e.target.value
              onSelectPlan(planId)
              const plan = plans.find((p) => p.id === planId)
              onExpiresAtChange(defaultExpiryFor(plan))
            }}
            disabled={isSubmitting}
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            <option value="">Select package plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {formatPlanSummary(plan)}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">Expires at</span>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => onExpiresAtChange(e.target.value)}
          disabled={!selectedPlan || isSubmitting}
          min={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
        <span className="text-[11px] text-black/45 dark:text-white/45">
          Defaults to the plan&apos;s valid days from today. Editable before granting.
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">
          Reason <span className="text-[var(--brand,#b61616)]">*</span>
        </span>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          maxLength={500}
          rows={2}
          disabled={isSubmitting}
          placeholder="Explain why this cash package grant is needed..."
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-white/30"
        />
        <span className="text-xs text-black/40 dark:text-white/40">{reason.length}/500</span>
      </label>

      <div className="flex items-center gap-2 rounded-md border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
        This grant is recorded as a <strong className="mx-1">cash</strong> payment, pending settlement on the
        payments board.
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting || !selectedPlanId || !reason.trim()}
        className="rounded-lg bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/90 disabled:opacity-50"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Granting...
          </span>
        ) : (
          "Grant cash package"
        )}
      </button>
    </div>
  )
}
