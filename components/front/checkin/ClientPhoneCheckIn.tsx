"use client"

import React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useClientPhoneCheckIn } from "./hooks/useClientPhoneCheckIn"

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

  if (!courseSlug || !date || !time) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
          <p className="text-lg font-semibold text-white">Invalid QR Code</p>
          <p className="mt-2 text-sm text-white/60">This QR code is missing class information.</p>
          <Link href="/courses" className="mt-4 inline-block rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white">
            Browse Classes
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white" />
          <p className="mt-4 text-lg font-semibold text-white">Checking you in...</p>
          <p className="mt-1 text-sm text-white/60">One moment please.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl">❌</span>
          <p className="mt-3 text-lg font-semibold text-white">Check-in Failed</p>
          <p className="mt-2 text-sm text-white/60">{error}</p>
          <Link href="/courses" className="mt-4 inline-block rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80">
            Browse Classes
          </Link>
        </div>
      </div>
    )
  }

  if (!result) return null

  // ─── Already checked in ─────────────────────────────────
  if (result.status === "already_checked_in") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-blue-400/30 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 text-2xl">ℹ️</span>
          <p className="mt-3 text-lg font-semibold text-white">Already Checked In</p>
          <p className="mt-2 text-sm text-white/60">You&apos;re already checked in for this class.</p>
          {result.attendance && (
            <p className="mt-2 text-xs text-white/45">{result.attendance.courseTitle}</p>
          )}
        </div>
      </div>
    )
  }

  // ─── Window closed ──────────────────────────────────────
  if (result.status === "window_closed") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">🕐</span>
          <p className="mt-3 text-lg font-semibold text-white">Check-in Not Available</p>
          <p className="mt-2 text-sm text-white/60">{result.message || "Check-in window is closed."}</p>
        </div>
      </div>
    )
  }

  // ─── Rejected ───────────────────────────────────────────
  if (result.status === "rejected") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl">❌</span>
          <p className="mt-3 text-lg font-semibold text-white">No Booking Found</p>
          <p className="mt-2 text-sm text-white/60">{result.message || "No booking found for this class."}</p>
          <Link href="/courses" className="mt-4 inline-block rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white">
            Book Now
          </Link>
        </div>
      </div>
    )
  }

  // ─── Checked in: cash pending ───────────────────────────
  if (result.status === "checked_in" && result.cashPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-2xl">⚠️</span>
          <p className="mt-3 text-lg font-semibold text-white">Checked In</p>
          <p className="mt-2 text-sm text-amber-300">
            Please pay ${result.cashAmount?.toFixed(2) || "—"} at the front desk.
          </p>
          {result.attendance && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
              <p>{result.attendance.courseTitle}</p>
            </div>
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
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">✅</span>
          <p className="mt-3 text-lg font-semibold text-white">You&apos;re Checked In!</p>
          <p className="mt-2 text-sm text-emerald-300">1 credit used · {remaining}</p>
          {pkg.packageLabel && (
            <p className="mt-1 text-xs text-white/50">{pkg.packageLabel}</p>
          )}
          {result.attendance && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
              <p>{result.attendance.courseTitle}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Checked in: standard (Stripe paid) ─────────────────
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">✅</span>
        <p className="mt-3 text-lg font-semibold text-white">You&apos;re Checked In!</p>
        <p className="mt-2 text-sm text-white/60">Enjoy your class.</p>
        {result.attendance && (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
            <p>{result.attendance.courseTitle}</p>
          </div>
        )}
        {result.points && result.points.awarded > 0 && (
          <p className="mt-2 text-xs text-emerald-300">+{result.points.awarded} points earned!</p>
        )}
      </div>
    </div>
  )
}
