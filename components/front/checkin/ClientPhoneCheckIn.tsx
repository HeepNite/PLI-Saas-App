"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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

// ─── Consecutive offer card ─────────────────────────────────
function ConsecutiveOfferCard({
  offer,
  date,
}: {
  offer: {
    linkedCourseSlug: string
    linkedCourseTitle: string
    dropInConsecutiveCents: number | null
    discountPercent: number
  }
  date: string
}) {
  const ctaUrl = buildQrBookingUrl({
    courseSlug: offer.linkedCourseSlug,
    date,
  })

  return (
    <div className="mt-4 rounded-xl border border-[#b61616]/30 bg-[#b61616]/10 p-4 text-left">
      <p className="text-xs uppercase tracking-[0.15em] text-[#b61616]">Join next class</p>
      <p className="mt-1 text-sm font-semibold text-white">{offer.linkedCourseTitle}</p>
      {offer.discountPercent > 0 && (
        <p className="mt-0.5 text-xs text-white/50">{offer.discountPercent}% consecutive discount</p>
      )}
      <Link
        href={ctaUrl}
        className="mt-3 inline-block w-full rounded-md bg-[#b61616] px-4 py-2 text-center text-sm font-semibold text-white"
      >
        Book {offer.linkedCourseTitle}
      </Link>
    </div>
  )
}

export default function ClientPhoneCheckIn() {
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
  const firstName = user?.firstName

  const bookingUrl = buildQrBookingUrl({ courseSlug, date, time, durationMinutes })
  const signInUrl = buildQrSignInUrl(`/checkin?${searchParams.toString()}`)

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
          {result.consecutiveOffer && (
            <ConsecutiveOfferCard offer={result.consecutiveOffer} date={date} />
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
          {result.consecutiveOffer && (
            <ConsecutiveOfferCard offer={result.consecutiveOffer} date={date} />
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
        {result.consecutiveOffer && (
          <ConsecutiveOfferCard offer={result.consecutiveOffer} date={date} />
        )}
      </div>
    </div>
  )
}
