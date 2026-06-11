"use client"

import React from "react"
import AssistantWidgetMount from "@/components/front/AssistantWidgetMount"
import { useI18n } from "@/lib/i18n"
import { usePathname } from "next/navigation"

export default function AssistantWidgetMountI18n() {
  const { t } = useI18n()
  const pathname = usePathname()
  const isAuthRoute = pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up")

  if (isAuthRoute) return null

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
