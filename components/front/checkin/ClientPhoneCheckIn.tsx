"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useClientPhoneCheckIn } from "./hooks/useClientPhoneCheckIn"
import { buildQrBookingUrl, buildQrSignInUrl } from "@/lib/checkin/qr-booking-links"

// ─── Shared card wrapper ────────────────────────────────────
function CheckInCard({
  borderColor = "border-white/10",
  children,
}: {
  borderColor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div
        className={`w-full max-w-sm rounded-2xl border ${borderColor} bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg`}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Branded success header (logo + greeting + course title) ─
function BrandedSuccessHeader({
  firstName,
  courseTitle,
}: {
  firstName: string | null | undefined
  courseTitle: string | undefined
}) {
  return (
    <>
      <div className="mx-auto mb-4 flex justify-center">
        <Image
          src="/logo/logo-white.png"
          alt="Palladium Latin Art"
          width={120}
          height={48}
          className="h-auto w-[calc(var(--spacing)*30)] object-contain"
        />
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-[#b61616]">Check-in</p>
      <p className="mt-2 text-xl font-semibold text-white">
        {firstName ? `You're in, ${firstName}!` : "You're Checked In!"}
      </p>
      {courseTitle && (
        <p className="mt-1 text-sm text-white/60">{courseTitle}</p>
      )}
    </>
  )
}

// ─── Consecutive offer overlay (replicates kiosk design) ────
// Multi-phase: offer → payment-method → processing → cash-success / error
type OverlayPhase = "offer" | "payment" | "processing" | "cash-success" | "error"

function ConsecutiveOfferOverlay({
  offer,
  date,
  time,
  isPackageHolder,
  attendanceId,
  courseSlug,
  packageRemaining,
  onDismiss,
}: {
  offer: {
    linkedCourseSlug: string
    linkedCourseTitle: string
    linkedCourseTime?: string | null
    dropInConsecutiveCents: number | null
    packageHolderConsecutiveCents: number | null
    discountPercent: number
  }
  date: string
  time: string
  isPackageHolder: boolean
  attendanceId?: string
  courseSlug: string
  packageRemaining?: number | null
  onDismiss: () => void
}) {
  const [phase, setPhase] = React.useState<OverlayPhase>("offer")
  const [error, setError] = React.useState<string | null>(null)

  const priceCents = isPackageHolder
    ? offer.packageHolderConsecutiveCents
    : offer.dropInConsecutiveCents
  const displayPrice = priceCents != null ? (priceCents / 100).toFixed(2) : "—"
  const discountLabel = `${offer.discountPercent}% off`
  const subtitle = isPackageHolder
    ? "Add your second class at a special price (separate from your package)"
    : "Add your second class at a special price"

  const handleAccept = () => {
    if (isPackageHolder) {
      setPhase("payment")
    } else {
      window.location.href = buildQrBookingUrl({
        courseSlug: offer.linkedCourseSlug,
        date,
        time: offer.linkedCourseTime || undefined,
      })
    }
  }

  const handlePayCash = async () => {
    setPhase("processing")
    setError(null)
    try {
      const res = await fetch("/api/checkin/qr/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: offer.linkedCourseSlug,
          date,
          time: offer.linkedCourseTime ?? time,
          consecutiveAddOn: true,
          consecutiveCashPayment: true,
          linkedFromCourseSlug: courseSlug,
          ...(attendanceId ? { linkedFromAttendanceId: attendanceId } : {}),
          ...(priceCents != null ? { consecutivePriceCents: priceCents } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || "Unable to process. Please try again.")
        setPhase("error")
        return
      }
      setPhase("cash-success")
    } catch {
      setError("Unable to process. Please try again.")
      setPhase("error")
    }
  }

  const handlePayCard = async () => {
    setPhase("processing")
    setError(null)
    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: offer.linkedCourseSlug,
          courseTitle: offer.linkedCourseTitle,
          amount: priceCents,
          currency: "usd",
          date,
          time: offer.linkedCourseTime ?? time,
          serviceId: "dropin",
          participants: 1,
          consecutiveAddOnOnly: true,
          linkedFromCourseSlug: courseSlug,
          ...(attendanceId ? { linkedFromAttendanceId: attendanceId } : {}),
          consecutivePriceCents: priceCents,
          consecutiveLinkedCourseSlug: offer.linkedCourseSlug,
          consecutiveCourseTitle: offer.linkedCourseTitle,
          consecutiveLinkedCourseTime: offer.linkedCourseTime ?? time,
          ...(packageRemaining != null ? { packageRemaining } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.url) {
        setError(data?.error || "Unable to start card payment.")
        setPhase("error")
        return
      }
      window.location.href = data.url
    } catch {
      setError("Unable to start card payment.")
      setPhase("error")
    }
  }

  const overlayBase = "fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm px-4 text-center"
  const cardBase = "rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-6 max-w-sm w-full"

  // ─── Processing ─────────────────────────────────
  if (phase === "processing") {
    return (
      <div className={overlayBase}>
        <div className={cardBase}>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white" />
          <p className="mt-4 text-lg font-semibold text-white">Processing...</p>
          <p className="mt-1 text-sm text-white/60">One moment please.</p>
        </div>
      </div>
    )
  }

  // ─── Cash success ───────────────────────────────
  if (phase === "cash-success") {
    return (
      <div className={overlayBase}>
        <div className={cardBase}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/20">
            <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-white">You&apos;re all set!</h2>
          <p className="mt-2 text-sm text-white/70">
            Added <span className="font-medium text-white">{offer.linkedCourseTitle}</span> to your schedule.
          </p>
          <p className="mt-3 text-sm text-amber-300">
            Please pay ${displayPrice} at the front desk.
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-5 w-full rounded-xl bg-white px-5 py-3.5 text-base font-medium text-[#1a1d2e] transition-colors hover:bg-white/90"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  // ─── Error ──────────────────────────────────────
  if (phase === "error") {
    return (
      <div className={overlayBase}>
        <div className={cardBase}>
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-2xl mx-auto">
            ❌
          </span>
          <h2 className="mt-4 text-2xl font-semibold text-white">Unable to add class</h2>
          <p className="mt-2 text-sm text-white/70">{error}</p>
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setPhase("payment")}
              className="w-full rounded-xl bg-[var(--brand,#b61616)] px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#a01212]"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full rounded-xl border border-white/15 bg-white/10 px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/15"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Payment method selection ───────────────────
  if (phase === "payment") {
    return (
      <div className={overlayBase}>
        <div className={cardBase}>
          <h2 className="text-2xl font-semibold text-white">
            How would you like to pay?
          </h2>
          <p className="mt-2 text-sm text-white/70">
            {offer.linkedCourseTitle} — ${displayPrice}
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={handlePayCash}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-[var(--brand,#b61616)] px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#a01212]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M12 12a2 2 0 1 0 0-0.01" />
                <path d="M6 12h.01M18 12h.01" />
              </svg>
              Pay with Cash
            </button>
            <button
              type="button"
              onClick={handlePayCard}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/10 px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/15"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="1" y="4" width="22" height="16" rx="2" />
                <path d="M1 10h22" />
              </svg>
              Pay with Card
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Phase 1: Offer ────────────────────────────
  return (
    <div className={overlayBase}>
      <div className={cardBase}>
        {offer.discountPercent > 0 && (
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400 ring-1 ring-emerald-400/20">
            <span className="text-lg">{discountLabel}</span>
          </div>
        )}
        <h2 className="text-2xl font-semibold text-white">
          Add {offer.linkedCourseTitle}
        </h2>
        <p className="mt-2 text-sm text-white/70">{subtitle}</p>
        <div className="mt-5 rounded-xl bg-white/5 px-4 py-4 ring-1 ring-white/10">
          <p className="text-xs text-white/50">Your price</p>
          <p className="mt-1 text-3xl font-bold text-white">
            ${displayPrice}
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleAccept}
            className="w-full rounded-xl bg-[var(--brand,#b61616)] px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#a01212]"
          >
            Add Class
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-xl border border-white/15 bg-white/10 px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/15"
          >
            No Thanks
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ClientPhoneCheckIn() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const courseSlug = searchParams.get("courseSlug") || ""
  const date = searchParams.get("date") || ""
  const time = searchParams.get("time") || ""
  const durationMinutes = searchParams.get("durationMinutes")
    ? Number(searchParams.get("durationMinutes"))
    : undefined

  const { loading, result, error } = useClientPhoneCheckIn({
    courseSlug,
    date,
    time,
    durationMinutes,
  })
  const { user } = useUser()
  const rawFirstName = user?.firstName || ""
  const firstName = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1)

  const [offerDismissed, setOfferDismissed] = React.useState(false)

  const bookingUrl = buildQrBookingUrl({ courseSlug, date, time, durationMinutes })
  const signInUrl = buildQrSignInUrl(`/checkin?${searchParams.toString()}`)

  // Success terminals: already checked in, or checked_in (cash-pending, package-credit,
  // or standard Stripe-paid). Auto-redirect to the client profile 5s after the flow is
  // truly done. While a consecutive-promo card is still on screen and undismissed, the
  // student may still act on it, so hold the redirect until they dismiss it (or there is
  // no offer). Once resolved, the 5s countdown to the profile begins.
  const isSuccess = result?.status === "already_checked_in" || result?.status === "checked_in"
  const hasPendingOffer = Boolean(result?.consecutiveOffer) && !offerDismissed

  React.useEffect(() => {
    if (!isSuccess || hasPendingOffer) return
    const timer = setTimeout(() => {
      router.push("/client-profile")
    }, 15000)
    return () => clearTimeout(timer)
  }, [isSuccess, hasPendingOffer, router])

  if (!courseSlug || !date || !time) {
    return (
      <CheckInCard>
        <p className="text-lg font-semibold text-white">Invalid QR Code</p>
        <p className="mt-2 text-sm text-white/60">This QR code is missing class information.</p>
        <Link
          href="/courses-library"
          className="mt-4 inline-block rounded-md bg-[#b61616] px-4 py-2 text-sm font-semibold text-white"
        >
          Browse Classes
        </Link>
      </CheckInCard>
    )
  }

  if (loading) {
    return (
      <CheckInCard>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white" />
        <p className="mt-4 text-lg font-semibold text-white">Checking you in...</p>
        <p className="mt-1 text-sm text-white/60">One moment please.</p>
      </CheckInCard>
    )
  }

  if (error) {
    return (
      <CheckInCard borderColor="border-red-500/30">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl">
          ❌
        </span>
        <p className="mt-3 text-lg font-semibold text-white">Check-in Failed</p>
        <p className="mt-2 text-sm text-white/60">{error}</p>
        <Link
          href={bookingUrl}
          className="mt-4 inline-block rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
        >
          Browse Classes
        </Link>
      </CheckInCard>
    )
  }

  if (!result) return null

  // ─── Already checked in ─────────────────────────────────
  if (result.status === "already_checked_in") {
    return (
      <CheckInCard borderColor="border-blue-400/30">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 text-2xl">
          ℹ️
        </span>
        <p className="mt-3 text-lg font-semibold text-white">Already Checked In</p>
        <p className="mt-2 text-sm text-white/60">You&apos;re already checked in for this class.</p>
        {result.attendance && (
          <p className="mt-2 text-xs text-white/45">{result.attendance.courseTitle}</p>
        )}
      </CheckInCard>
    )
  }

  // ─── Window closed ──────────────────────────────────────
  if (result.status === "window_closed") {
    return (
      <CheckInCard>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">
          🕐
        </span>
        <p className="mt-3 text-lg font-semibold text-white">Check-in Not Available</p>
        <p className="mt-2 text-sm text-white/60">
          {result.message || "Check-in window is closed."}
        </p>
      </CheckInCard>
    )
  }

  // ─── Rejected ───────────────────────────────────────────
  if (result.status === "rejected") {
    return (
      <CheckInCard borderColor="border-red-500/30">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl">
          ❌
        </span>
        <p className="mt-3 text-lg font-semibold text-white">No Booking Found</p>
        <p className="mt-2 text-sm text-white/60">
          {result.message || "No booking found for this class."}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href={bookingUrl}
            className="inline-block rounded-md bg-[#b61616] px-4 py-2 text-sm font-semibold text-white"
          >
            Continue Booking
          </Link>
          <Link
            href={signInUrl}
            className="inline-block rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
          >
            Sign In Instead
          </Link>
        </div>
      </CheckInCard>
    )
  }

  const courseTitle = result.courseTitle || result.attendance?.courseTitle

  // ─── Checked in: cash pending ───────────────────────────
  if (result.status === "checked_in" && result.cashPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
          <BrandedSuccessHeader firstName={firstName} courseTitle={courseTitle} />
          <p className="mt-3 text-sm text-amber-300">
            Please pay ${result.cashAmount?.toFixed(2) || "—"} at the front desk.
          </p>
          {result.points && result.points.awarded > 0 && (
            <p className="mt-2 text-xs text-emerald-300">+{result.points.awarded} points earned!</p>
          )}
          {result.consecutiveOffer && !offerDismissed && (
            <ConsecutiveOfferOverlay
              offer={result.consecutiveOffer}
              date={date}
              time={time}
              isPackageHolder={!!result.package}
              attendanceId={result.attendance?.id}
              courseSlug={courseSlug}
              packageRemaining={result.package?.remainingCredits ?? null}
              onDismiss={() => setOfferDismissed(true)}
            />
          )}
        </div>
      </div>
    )
  }

  // ─── Checked in: package credit used ────────────────────
  if (result.status === "checked_in" && result.package) {
    const pkg = result.package
    const remaining = pkg.isUnlimited ? "Unlimited" : `${pkg.remainingCredits ?? 0} remaining`
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
          <BrandedSuccessHeader firstName={firstName} courseTitle={courseTitle} />
          <p className="mt-3 text-sm text-emerald-300">1 credit used · {remaining}</p>
          {pkg.packageLabel && (
            <p className="mt-1 text-xs text-white/50">{pkg.packageLabel}</p>
          )}
          {result.points && result.points.awarded > 0 && (
            <p className="mt-2 text-xs text-emerald-300">+{result.points.awarded} points earned!</p>
          )}
          {result.consecutiveOffer && !offerDismissed && (
            <ConsecutiveOfferOverlay
              offer={result.consecutiveOffer}
              date={date}
              time={time}
              isPackageHolder={!!result.package}
              attendanceId={result.attendance?.id}
              courseSlug={courseSlug}
              packageRemaining={result.package?.remainingCredits ?? null}
              onDismiss={() => setOfferDismissed(true)}
            />
          )}
        </div>
      </div>
    )
  }

  // ─── Checked in: standard (Stripe paid) ─────────────────
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
        <BrandedSuccessHeader firstName={firstName} courseTitle={courseTitle} />
        <p className="mt-3 text-sm text-white/60">Enjoy your class.</p>
        {result.points && result.points.awarded > 0 && (
          <p className="mt-2 text-xs text-emerald-300">+{result.points.awarded} points earned!</p>
        )}
        {result.consecutiveOffer && !offerDismissed && (
          <ConsecutiveOfferOverlay
            offer={result.consecutiveOffer}
            date={date}
            time={time}
            isPackageHolder={!!result.package}
            attendanceId={result.attendance?.id}
            courseSlug={courseSlug}
            packageRemaining={result.package?.remainingCredits ?? null}
            onDismiss={() => setOfferDismissed(true)}
          />
        )}
      </div>
    </div>
  )
}
