"use client"

import React from "react"
import { useAuth } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"

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
    const redirectUrl = `/checkin?${searchParams.toString()}`
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-6 text-center shadow-lg">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">🔐</span>
          <p className="mt-3 text-lg font-semibold text-white">Sign In to Check In</p>
          <p className="mt-2 text-sm text-white/60">Sign in with your account to check in for this class.</p>
          <a
            href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
            className="mt-4 inline-block rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white"
          >
            Sign In
          </a>
        </div>
      </div>
    )
  }

  // Default: kiosk flow
  return <CheckInQrClient />
}
