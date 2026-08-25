import React from "react"
import Header from "@/components/front/Header"
import NotificationBar from "@/components/front/ui/NotificationBar"
import FooterQuote from "@/components/front/FooterQuote"
import { SuppressFloatingChrome } from "@/components/front/ui/FloatingChromeVisibility"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"

type PublicLayoutProps = {
  children: React.ReactNode
  headerVariant?: "default" | "compact" | "special-event"
  floatingChrome?: "default" | "hidden"
  specialEventNowMs?: number
  specialEventReservationHref?: string
  onSpecialEventReservationClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
}

export default function PublicLayout({
  children,
  headerVariant = "default",
  floatingChrome = "default",
  specialEventNowMs,
  specialEventReservationHref = "/special-salsa-class?reserve=1",
  onSpecialEventReservationClick,
}: PublicLayoutProps) {
  const specialAnnouncement = headerVariant === "special-event"
    ? {
        message: "Get your spot for $20 — save 20% until Sunday at 10:00 AM.",
        ctaHref: specialEventReservationHref,
        ctaLabel: "Reserve now",
        deadlineMs: SPECIAL_SALSA_CLASS.promotion.deadline.getTime(),
        initialNowMs: specialEventNowMs,
        hideOnExpiry: true,
        countdownFormat: "human" as const,
        onCtaClick: onSpecialEventReservationClick,
      }
    : {}

  return (
    <div className="min-h-screen w-full m-0 flex flex-col">
      {floatingChrome === "hidden" && <SuppressFloatingChrome />}
      <NotificationBar {...specialAnnouncement} />
      <Header variant={headerVariant} />
      <main>{children}</main>
      <FooterQuote compactMobileTopSpacing={headerVariant === "special-event"} />
    </div>
  )
}
