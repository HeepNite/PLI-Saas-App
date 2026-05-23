import React from "react"
import { ChevronDown } from "lucide-react"
import { type StaffPaymentPreference } from "@/lib/security/staff-category"
import { PAYMENT_PREFERENCE_LABELS } from "./staffAdminConstants"

type SummaryCard = { label: string; value: string; hint?: string | null }

type StaffProfilePaymentSectionProps = {
  resolvedSelfProfile: { paymentPreference: StaffPaymentPreference | null; assignedPaymentPreference: StaffPaymentPreference | null }
  profilePaymentExpanded: boolean
  profilePaymentSummaryCards: SummaryCard[]
  onToggleExpanded: () => void
  children: React.ReactNode
}

export default function StaffProfilePaymentSection(props: StaffProfilePaymentSectionProps) {
  const {
    resolvedSelfProfile,
    profilePaymentExpanded,
    profilePaymentSummaryCards,
    onToggleExpanded,
    children,
  } = props

  return (
    <section className="mt-5 rounded-xl border border-black/10 bg-white/65 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">Payment information</p>
          <h4 className="mt-1 text-base font-semibold text-black dark:text-white">How you prefer to get paid</h4>
          <p className="text-xs text-black/60 dark:text-white/60">Keep your cash/card/credits preference and payout details updated.</p>
        </div>
        <button type="button" onClick={onToggleExpanded} className="inline-flex items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-semibold text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white">
          {profilePaymentExpanded ? "Hide payment form" : "Edit payment details"}
          <ChevronDown className={`h-4 w-4 transition ${profilePaymentExpanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.05]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Preference</p>
          <p className="mt-1 text-sm font-semibold text-black dark:text-white">{resolvedSelfProfile.paymentPreference ? PAYMENT_PREFERENCE_LABELS[resolvedSelfProfile.paymentPreference] : "Not set"}</p>
        </div>
        {profilePaymentSummaryCards.map((card) => (
          <div key={`self-profile-payment-summary-${card.label}`} className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.05]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55">{card.label}</p>
            <p className="mt-1 text-sm font-semibold text-black dark:text-white">{card.value}</p>
            {card.hint ? <p className="text-xs text-black/60 dark:text-white/60">{card.hint}</p> : null}
          </div>
        ))}
      </div>

      {profilePaymentExpanded ? children : null}
    </section>
  )
}
