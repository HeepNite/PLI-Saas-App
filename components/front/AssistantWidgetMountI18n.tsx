"use client"

import React from "react"
import AssistantWidgetMount from "@/components/front/AssistantWidgetMount"
import { useI18n } from "@/lib/i18n"
import { usePathname } from "next/navigation"

export default function AssistantWidgetMountI18n() {
  const { t } = useI18n()
  const pathname = usePathname()
  const isAuthRoute = pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up")
  const isCheckInRoute = pathname?.startsWith("/checkin")

  // Keep the QR-mobile checkout distraction-free: the scanned-QR new-student
  // booking runs under /courses/... carrying ?fromQr=1, and the check-in
  // surfaces live under /checkin. Hide the assistant across both.
  const [isQrFlow, setIsQrFlow] = React.useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("fromQr") === "1"
  )
  React.useEffect(() => {
    setIsQrFlow(new URLSearchParams(window.location.search).get("fromQr") === "1")
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
