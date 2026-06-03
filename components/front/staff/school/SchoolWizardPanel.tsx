"use client"

import React from "react"
import type { SchoolWizardEntity, SchoolWizardState, StepEnabledContext } from "./school-wizard-types"
import { WIZARD_STEP_CONFIGS } from "./school-wizard-configs"
import { SchoolWizardStepNav } from "./SchoolWizardStepNav"

const ENTITY_TABS: { key: SchoolWizardEntity; label: string; accent: string }[] = [
  { key: "courses", label: "Courses", accent: "var(--brand, #b61616)" },
  { key: "rooms", label: "Rooms", accent: "var(--brand, #b61616)" },
  { key: "packages", label: "Packages", accent: "var(--brand, #b61616)" },
  { key: "points", label: "Points", accent: "var(--brand, #b61616)" },
]

interface SchoolWizardPanelProps {
  wizard: SchoolWizardState
  enabledContext: StepEnabledContext
  onSave?: () => void
  saveBusy?: boolean
  error?: string | null
  success?: string | null
  children?: React.ReactNode
}

export function SchoolWizardPanel({
  wizard,
  enabledContext,
  onSave,
  saveBusy,
  error,
  success,
  children,
}: SchoolWizardPanelProps) {
  const steps = WIZARD_STEP_CONFIGS[wizard.activeEntity]
  const inline = steps.length <= 5

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      {/* Entity tabs + inline step nav when ≤5 steps */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-black/8 bg-black/[0.02] p-1 dark:border-white/8 dark:bg-white/[0.02]">
          {ENTITY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => wizard.goToEntity(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                wizard.activeEntity === tab.key
                  ? "bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                  : "text-black/55 hover:bg-black/[0.04] hover:text-black/80 dark:text-white/55 dark:hover:bg-white/[0.04] dark:hover:text-white/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {inline && (
          <div className="ml-auto">
            <SchoolWizardStepNav
              steps={steps}
              currentStep={wizard.step}
              onStepClick={wizard.setStep}
              enabledContext={enabledContext}
            />
          </div>
        )}

      </div>

      {/* Step nav below when 6+ steps */}
      {!inline && (
        <div className="mt-3">
          <SchoolWizardStepNav
            steps={steps}
            currentStep={wizard.step}
            onStepClick={wizard.setStep}
            enabledContext={enabledContext}
            stretch
          />
        </div>
      )}

      {/* Feedback */}
      {error && (
        <p className="mt-3 rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-md border border-green-500/35 bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
          {success}
        </p>
      )}

      {/* Step content */}
      {children && <div className="mt-4">{children}</div>}
    </article>
  )
}
