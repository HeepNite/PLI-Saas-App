import React from "react"
import Link from "next/link"
import { CheckCircle2, CircleAlert, Clock3 } from "lucide-react"
import type { SpecialClassConfirmationState } from "@/lib/checkout/special-class-confirmation"
import {
  SPECIAL_SALSA_CLASS,
  SPECIAL_SALSA_REFUND_POLICY,
  formatSpecialClassDateTime,
} from "@/lib/special-salsa-class/config"
import { createSpecialSalsaCalendarFile } from "@/lib/special-salsa-class/calendar"

const content = {
  confirmed: {
    title: "Reservation confirmed",
    message: "Your payment and class reservation are confirmed.",
    Icon: CheckCircle2,
  },
  finalizing: {
    title: "Payment received",
    message: "Your payment was received. We are finalizing your reservation now.",
    Icon: Clock3,
  },
  "not-confirmed": {
    title: "Payment not completed",
    message: "This payment is not complete, so the reservation is not confirmed.",
    Icon: CircleAlert,
  },
  unavailable: {
    title: "Unable to confirm this reservation",
    message: "We could not confirm a paid reservation from this link.",
    Icon: CircleAlert,
  },
} satisfies Record<SpecialClassConfirmationState, { title: string; message: string; Icon: typeof CheckCircle2 }>

export function SpecialSalsaClassConfirmation({ state }: { state: SpecialClassConfirmationState }) {
  const outcome = content[state]
  const Icon = outcome.Icon
  const calendarDownloadHref = state === "confirmed"
    ? `data:text/calendar;charset=utf-8,${encodeURIComponent(createSpecialSalsaCalendarFile())}`
    : null
  return (
    <div className="bg-[#fffaf5] px-4 py-12 text-[#211713] dark:bg-[#160f0d] dark:text-[#fff8f2] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[#e8d3c7] bg-white p-6 shadow-xl dark:border-white/15 dark:bg-[#241815] sm:p-10">
        <div role="status" tabIndex={-1} autoFocus className="focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand,#b61616)]/30">
          <Icon className="h-12 w-12 text-[var(--brand,#b61616)]" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-black sm:text-4xl">{outcome.title}</h1>
          <p className="mt-3 text-lg leading-8">{outcome.message}</p>
        </div>

        <section className="mt-8 rounded-xl bg-[#f8eee7] p-5 dark:bg-white/5" aria-labelledby="class-details">
          <h2 id="class-details" className="text-lg font-bold">{SPECIAL_SALSA_CLASS.displayTitle}</h2>
          <p className="mt-2">{formatSpecialClassDateTime(SPECIAL_SALSA_CLASS.startsAt)}</p>
          <p>{SPECIAL_SALSA_CLASS.durationMinutes} minutes · {SPECIAL_SALSA_CLASS.address}</p>
        </section>

        <p className="mt-6 text-sm leading-6">{SPECIAL_SALSA_REFUND_POLICY}</p>
        {calendarDownloadHref ? (
          <a
            href={calendarDownloadHref}
            download="salsa-de-cali.ics"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-[var(--brand,#b61616)] px-5 py-3 font-bold text-[var(--brand,#b61616)] outline-none transition-colors hover:bg-[var(--brand,#b61616)] hover:text-white focus-visible:ring-4 focus-visible:ring-[var(--brand,#b61616)]/35"
          >
            Add to calendar
          </a>
        ) : null}
        <Link href="/special-salsa-class" className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-[var(--brand,#b61616)] px-5 py-3 font-bold text-white outline-none transition-colors hover:bg-[#8f1010] focus-visible:ring-4 focus-visible:ring-[var(--brand,#b61616)]/35">
          Return to class details
        </Link>
      </section>
    </div>
  )
}
