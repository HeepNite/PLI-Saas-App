"use client"

import React from "react"
import type { SchoolWizardStepConfig, StepEnabledContext } from "./school-wizard-types"

interface SchoolWizardStepNavProps {
  steps: SchoolWizardStepConfig[]
  currentStep: number
  onStepClick: (index: number) => void
  enabledContext?: StepEnabledContext
}

const MAX_VISIBLE = 7

export function SchoolWizardStepNav({ steps, currentStep, onStepClick, enabledContext }: SchoolWizardStepNavProps) {
  const enabledSteps = steps.map((s, i) => ({
    ...s,
    index: i,
    isEnabled: !s.enabled || !enabledContext || s.enabled(enabledContext),
  }))

  const visibleEnabled = enabledSteps.filter((s) => s.isEnabled)
  const currentEnabledIdx = visibleEnabled.findIndex((s) => s.index === currentStep)
  const safeIdx = Math.max(0, currentEnabledIdx)

  const start = Math.max(0, Math.min(safeIdx - 1, visibleEnabled.length - MAX_VISIBLE))
  const visible = visibleEnabled.slice(start, start + MAX_VISIBLE)

  return (
    <nav aria-label="Wizard steps" className="flex flex-wrap items-center gap-1.5">
      {visible.map((st, idx) => {
        const done = st.index < currentStep
        const active = st.index === currentStep

        return (
          <React.Fragment key={st.key}>
            <button
              type="button"
              onClick={() => onStepClick(st.index)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition whitespace-nowrap ${
                active
                  ? "border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)]"
                  : "border-black/10 bg-transparent text-black/50 hover:bg-black/[0.04] dark:border-white/10 dark:text-white/50 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-green-500/20 text-green-600 dark:text-green-400"
                    : active
                      ? "bg-[var(--brand,#b61616)] text-white"
                      : "bg-black/10 text-black/40 dark:bg-white/10 dark:text-white/40"
                }`}
              >
                {done ? "✓" : st.index + 1}
              </span>
              <span>{st.label}</span>
            </button>
            {idx < visible.length - 1 && (
              <span className="text-black/20 dark:text-white/20">/</span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
