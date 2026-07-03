"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"
import { FormState } from "./types"

type StatsTabFormProps = {
  form: FormState
  onFieldChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}

export function StatsTabForm({ form, onFieldChange }: StatsTabFormProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Stats are derived values. Only correct them when you know the ground truth differs from the computed stat.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-black/65 dark:text-white/65">Completed Classes</span>
          <input
            type="number"
            min="0"
            value={form.statsCompletedClasses}
            onChange={(e) => onFieldChange("statsCompletedClasses", e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-black/65 dark:text-white/65">Package Classes Used</span>
          <input
            type="number"
            min="0"
            value={form.statsPackageClassesUsed}
            onChange={(e) => onFieldChange("statsPackageClassesUsed", e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </label>
      </div>
    </div>
  )
}
