"use client"

import React from "react"
import AssistantWidgetMount from "@/components/front/AssistantWidgetMount"
import { useI18n } from "@/lib/i18n"
import { usePathname } from "next/navigation"
import { detectQrFlow } from "@/lib/checkin/qr-flow"

export default function AssistantWidgetMountI18n() {
  const { t } = useI18n()
  const pathname = usePathname()
  const isAuthRoute = pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up")
  const isCheckInRoute = pathname?.startsWith("/checkin")

  // Keep the QR-mobile checkout distraction-free. The check-in surfaces live
  // under /checkin (?fromQr=1); the scanned-QR booking navigates to
  // /courses/... with ?qrBooking=1 (see buildQrBookingUrl). Hide across both.
  const [isQrFlow, setIsQrFlow] = React.useState(() => detectQrFlow())
  React.useEffect(() => {
    setIsQrFlow(detectQrFlow())
  }, [pathname])

  if (isAuthRoute || isCheckInRoute || isQrFlow) return null

  return (
    <AssistantWidgetMount
      position="left"
      initialMinimized={true}
      title={t("assistant_title")}
      ctaLabel={t("assistant_cta")}
      startHref="/chat"
      videoSrc="/videos/assistant.mp4"
      poster="/images/FireShot Capture 002 - Home Version One – Jayden – OnePage Personal Portfolio WordPress Th_ - [wpriverthemes.com].png"
      links={[]}
    />
  )
}
