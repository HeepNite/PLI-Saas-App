"use client"

import React from "react"
import { Loader2 } from "lucide-react"
import {
  FormState,
  PackageOption,
  PACKAGE_STATUSES,
} from "./types"

type PackageTabFormProps = {
  form: FormState
  availablePackages: PackageOption[]
  packagesLoading: boolean
  packagesError: string | null
  showManualPackageId: boolean
  onToggleManualPackageId: () => void
  onFieldChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  formatPackageSummary: (pkg: PackageOption) => string
}

export function PackageTabForm({
  form,
  availablePackages,
  packagesLoading,
  packagesError,
  showManualPackageId,
  onToggleManualPackageId,
  onFieldChange,
  formatPackageSummary,
}: PackageTabFormProps) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">
          Package purchase <span className="text-[var(--brand,#b61616)]">*</span>
        </span>
        {packagesLoading ? (
          <div className="flex items-center gap-2 rounded-md border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading package purchases...
          </div>
        ) : packagesError ? (
          <div className="rounded-md border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/5 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
            {packagesError}
          </div>
        ) : availablePackages.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            No package purchases found for this student.
          </div>
        ) : (
          <>
            <select
              value={form.packagePurchaseId}
              onChange={(e) => onFieldChange("packagePurchaseId", e.target.value)}
              className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            >
              <option value="">Select package purchase</option>
              {availablePackages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {formatPackageSummary(pkg)}
                </option>
              ))}
            </select>
            {availablePackages.length === 1 && form.packagePurchaseId ? (
              <p className="text-[11px] text-black/45 dark:text-white/45">
                Auto-selected: {formatPackageSummary(availablePackages[0])}
              </p>
            ) : null}
          </>
        )}
      </label>

      {availablePackages.length === 0 ? (
        <div className="space-y-1">
          <button
            type="button"
            onClick={onToggleManualPackageId}
            className="text-xs font-medium text-[var(--brand,#b61616)] underline-offset-2 hover:underline"
          >
            {showManualPackageId ? "Hide manual UUID entry" : "Use manual UUID entry (advanced)"}
          </button>
          {showManualPackageId ? (
            <input
              type="text"
              value={form.packagePurchaseId}
              onChange={(e) => onFieldChange("packagePurchaseId", e.target.value)}
              placeholder="package-purchase-uuid"
              className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-black/65 dark:text-white/65">Remaining Credits</span>
          <input
            type="number"
            min="0"
            value={form.packageRemainingCredits}
            onChange={(e) => onFieldChange("packageRemainingCredits", e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-black/65 dark:text-white/65">Used Credits</span>
          <input
            type="number"
            min="0"
            value={form.packageUsedCredits}
            onChange={(e) => onFieldChange("packageUsedCredits", e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-black/65 dark:text-white/65">Expires At</span>
          <input
            type="date"
            value={form.packageExpiresAt}
            onChange={(e) => onFieldChange("packageExpiresAt", e.target.value)}
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-black/65 dark:text-white/65">Status</span>
          <select
            value={form.packageStatus}
            onChange={(e) => onFieldChange("packageStatus", e.target.value)}
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            {PACKAGE_STATUSES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
