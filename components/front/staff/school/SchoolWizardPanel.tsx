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
  children: React.ReactNode
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

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      {/* Entity tabs */}
      <div className="flex items-center justify-between gap-3">
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

        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveBusy}
            className="rounded-lg bg-[var(--brand,#b61616)] px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saveBusy ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      {/* Step nav */}
      <div className="mt-3">
        <SchoolWizardStepNav
          steps={steps}
          currentStep={wizard.step}
          onStepClick={wizard.setStep}
          enabledContext={enabledContext}
        />
      </div>

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
      <div className="mt-4">{children}</div>

      {/* Step navigation buttons */}
      <div className="mt-6 flex items-center justify-between border-t border-black/8 pt-4 dark:border-white/8">
        <button
          type="button"
          onClick={() => wizard.prevStep(enabledContext)}
          disabled={wizard.step === 0}
          className="rounded-lg border border-black/10 px-4 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.04] disabled:opacity-30 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04]"
        >
          ← Previous
        </button>
        <span className="text-[10px] text-black/40 dark:text-white/40">
          Step {wizard.step + 1} of {wizard.totalSteps}
        </span>
        <button
          type="button"
          onClick={() => wizard.nextStep(enabledContext)}
          disabled={wizard.step >= wizard.totalSteps - 1}
          className="rounded-lg border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-4 py-1.5 text-xs font-medium text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/20 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </article>
  )
}
