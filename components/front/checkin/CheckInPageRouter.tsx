"use client"

import React from "react"
import { useAuth } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { buildQrBookingUrl, buildQrSignInUrl } from "@/lib/checkin/qr-booking-links"

const ClientPhoneCheckIn = dynamic(() => import("./ClientPhoneCheckIn"), { ssr: false })
const CheckInQrClient = dynamic(() => import("./CheckInQrClient"), { ssr: false })

/**
 * Router that detects whether the visitor is a signed-in client on their
 * phone (client-phone flow) or a kiosk terminal (kiosk flow).
 *
 * Client-phone: signed in via Clerk + has courseSlug/date/time params + no kiosk params.
 * Kiosk: has flowContext=kiosk_terminal or kioskSessionToken param, OR is not signed in.
 */
export default function CheckInPageRouter() {
  const { isSignedIn, isLoaded } = useAuth()
  const searchParams = useSearchParams()

  const hasKioskParams = Boolean(
    searchParams.get("flowContext") === "kiosk_terminal" ||
    searchParams.get("kioskSessionToken")
  )
  const hasClassParams = Boolean(
    searchParams.get("courseSlug") &&
    searchParams.get("date") &&
    searchParams.get("time")
  )

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white" />
      </div>
    )
  }

  // Client-phone flow: signed in + class params + no kiosk params
  if (isSignedIn && hasClassParams && !hasKioskParams) {
    return <ClientPhoneCheckIn />
  }

  // Not signed in but has class params (no kiosk) → prompt sign-in
  if (!isSignedIn && hasClassParams && !hasKioskParams) {
    return (
      <WelcomeScreen
        searchParams={searchParams}
      />
    )
  }

  // Default: kiosk flow
  return <CheckInQrClient />
}

function WelcomeScreen({ searchParams }: { searchParams: URLSearchParams }) {
  const [navigating, setNavigating] = React.useState(false)

  const redirectUrl = `/checkin?${searchParams.toString()}`
  const durationMinutes = searchParams.get("durationMinutes")
    ? Number(searchParams.get("durationMinutes"))
    : undefined
  const bookingUrl = buildQrBookingUrl({
    courseSlug: searchParams.get("courseSlug") || "",
    date: searchParams.get("date") || "",
    time: searchParams.get("time") || "",
    durationMinutes,
  })

  const handleNewClick = () => {
    setNavigating(true)
    window.location.href = bookingUrl
  }

  if (navigating) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-sm text-white/70">Loading your booking…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
        <p className="text-lg font-semibold text-white">Welcome!</p>
        <p className="mt-2 text-sm text-white/50">
          How would you like to continue?
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleNewClick}
            className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            I&apos;m new
          </button>
          <a
            href={buildQrSignInUrl(redirectUrl)}
            className="inline-block rounded-md border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80"
          >
            I have an account
          </a>
        </div>
      </div>
    </div>
  )
}
