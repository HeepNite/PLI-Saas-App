import React from "react"
import Image from "next/image"
import PublicLayout from "@/components/layouts/PublicLayout"

export default function CoursesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <PublicLayout>
      <div className="qr-booking-route-loader" aria-live="polite" aria-label="Loading Heritage pin booking">
        <Image src="/logo/logo-white.png" alt="Palladium Latin Art" width={160} height={64} priority />
        <p className="qr-booking-route-badge">Heritage pin booking</p>
        <div className="qr-booking-route-spinner" aria-hidden="true" />
        <p className="qr-booking-route-status">Loading your booking…</p>
      </div>
      {children}
    </PublicLayout>
  )
}
