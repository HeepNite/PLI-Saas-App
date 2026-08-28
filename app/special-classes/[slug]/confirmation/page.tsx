import Link from "next/link"
import { CalendarDays, CheckCircle2, CircleAlert, Clock3, Home, MapPin, Timer } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"

type ConfirmationState = "confirmed" | "finalizing" | "not-confirmed" | "unavailable"

const SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]+$/

const STATE_CONTENT: Record<ConfirmationState, {
  title: string
  message: string
  Icon: typeof CheckCircle2
  accent: string
  badge: string
}> = {
  confirmed: {
    title: "Reservation confirmed",
    message: "Your payment went through and your spot is locked in. See you on the dance floor!",
    Icon: CheckCircle2,
    accent: "text-emerald-400",
    badge: "bg-emerald-400/10 ring-emerald-400/25",
  },
  finalizing: {
    title: "Payment received",
    message: "We received your payment and are finalizing your reservation. It will appear in the class roster in a moment.",
    Icon: Clock3,
    accent: "text-[#FB7185]",
    badge: "bg-[#FB7185]/10 ring-[#FB7185]/25",
  },
  "not-confirmed": {
    title: "Payment not completed",
    message: "This payment was not completed, so your spot is not reserved yet. You can try booking again from the class page.",
    Icon: CircleAlert,
    accent: "text-amber-400",
    badge: "bg-amber-400/10 ring-amber-400/25",
  },
  unavailable: {
    title: "We couldn't confirm this reservation",
    message: "We couldn't find a paid reservation from this link. If you completed a payment, it may still be processing.",
    Icon: CircleAlert,
    accent: "text-zinc-400",
    badge: "bg-white/5 ring-white/10",
  },
}

async function resolveConfirmation(slug: string, sessionId: string | undefined) {
  const specialClass = await prisma.specialClass.findFirst({
    where: { slug },
    include: { classSession: true },
  })
  if (!specialClass) return { state: "unavailable" as ConfirmationState, specialClass: null, amount: null as number | null }

  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
    return { state: "unavailable" as ConfirmationState, specialClass, amount: null }
  }
  // Do not trust the raw session id: only reveal a status when a purchase we created for THIS class
  // is bound to it.
  const purchase = await prisma.purchase.findFirst({
    where: { stripeCheckoutSessionId: sessionId, specialClassId: specialClass.id },
    select: { status: true, amount: true, currency: true },
  })
  if (!purchase) return { state: "unavailable" as ConfirmationState, specialClass, amount: null }

  const state: ConfirmationState = SUCCESSFUL_PURCHASE_STATUSES.includes(purchase.status)
    ? "confirmed"
    : purchase.status === "pending" || purchase.status === "capture_pending"
      ? "finalizing"
      : "not-confirmed"
  return { state, specialClass, amount: purchase.amount, currency: purchase.currency }
}

const formatWhen = (startsAt: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  }).format(startsAt)

export default async function SpecialClassConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : undefined
  const { state, specialClass, amount, currency } = await resolveConfirmation(slug, sessionId)

  const content = STATE_CONTENT[state]
  const Icon = content.Icon
  const paidLabel = amount != null
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "usd").toUpperCase() }).format(amount / 100)
    : null
  const classHref = slug === SPECIAL_SALSA_CLASS.key ? "/special-salsa-class" : `/special-classes/${encodeURIComponent(slug)}`

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-16 text-white">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#141418] shadow-2xl shadow-black/60">
        <div className="flex flex-col items-center gap-4 border-b border-white/10 px-8 pb-8 pt-10 text-center">
          <span className={`inline-flex h-16 w-16 items-center justify-center rounded-full ring-1 ${content.badge}`}>
            <Icon className={`h-8 w-8 ${content.accent}`} aria-hidden="true" />
          </span>
          <div role="status">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{content.title}</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">{content.message}</p>
          </div>
        </div>

        {specialClass ? (
          <div className="space-y-4 px-8 py-7">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FB7185]">Your class</p>
              <h2 className="mt-1 text-lg font-black">{specialClass.title}</h2>
              <dl className="mt-4 space-y-2.5 text-sm text-zinc-300">
                <div className="flex items-center gap-2.5">
                  <CalendarDays className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
                  <dd>{formatWhen(specialClass.classSession.startsAt)}</dd>
                </div>
                <div className="flex items-center gap-2.5">
                  <Timer className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
                  <dd>{specialClass.classSession.durationMinutes ?? 60} minutes</dd>
                </div>
                {specialClass.classSession.location ? (
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
                    <dd>{specialClass.classSession.location}</dd>
                  </div>
                ) : null}
              </dl>
              {paidLabel && state !== "not-confirmed" ? (
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-sm text-zinc-400">Amount paid</span>
                  <span className="text-base font-black">{paidLabel}</span>
                </div>
              ) : null}
            </div>
            {state === "confirmed" || state === "finalizing" ? (
              <p className="px-1 text-xs leading-5 text-zinc-500">
                A staff member will check you in at the door. Cancellations and refunds are handled manually by PLI staff.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="px-8 py-7" />
        )}

        <div className="flex flex-col gap-3 border-t border-white/10 px-8 py-6 sm:flex-row">
          <Link
            href={classHref}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#E11D48] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#BE123C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FB7185] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141418]"
          >
            {state === "not-confirmed" || state === "unavailable" ? "Back to class" : "View class details"}
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
        </div>
      </section>
    </main>
  )
}
