"use client"

import React from "react"
import AssistantWidgetMount from "@/components/front/AssistantWidgetMount"
import { useI18n } from "@/lib/i18n"
import { usePathname } from "next/navigation"
import { useHideFloatingChrome } from "@/lib/checkin/use-hide-floating-chrome"
import { useFloatingChromeHidden } from "@/components/front/ui/FloatingChromeVisibility"

export default function AssistantWidgetMountI18n() {
  const { t } = useI18n()
  const pathname = usePathname()
  const isAuthRoute = pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up")
  const isCheckInRoute = pathname?.startsWith("/checkin")
  const hiddenByLayout = useFloatingChromeHidden()
  // Hide across the QR flow (URL) AND whenever a full-screen modal locks body
  // scroll (covers every EnrollModal step regardless of route/param).
  const hideForCheckout = useHideFloatingChrome()

  if (hiddenByLayout || isAuthRoute || isCheckInRoute || hideForCheckout) return null

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
