"use client"

import React from "react"
import PublicLayout from "@/components/layouts/PublicLayout"
import { SpecialSalsaClassLanding } from "@/components/front/special-salsa-class/SpecialSalsaClassLanding"
import type { BannerReservationRequest } from "@/components/front/special-salsa-class/SpecialSalsaClassLanding"

export function SpecialSalsaClassExperience({
  remaining,
  onlineCapacity,
  cancelledAttemptId,
  initialNowMs,
  initialDialogOpen,
  reservationHref,
}: {
  remaining: number | null
  onlineCapacity: number
  cancelledAttemptId?: string
  initialNowMs: number
  initialDialogOpen: boolean
  reservationHref: string
}) {
  const requestIdRef = React.useRef(0)
  const [bannerReservationRequest, setBannerReservationRequest] = React.useState<BannerReservationRequest | null>(null)

  const openFromBanner = (event: React.MouseEvent<HTMLAnchorElement>) => {
    requestIdRef.current += 1
    setBannerReservationRequest({
      id: requestIdRef.current,
      opener: event.currentTarget,
    })
  }

  return (
    <PublicLayout
      headerVariant="special-event"
      floatingChrome="hidden"
      specialEventNowMs={initialNowMs}
      specialEventReservationHref={reservationHref}
      onSpecialEventReservationClick={openFromBanner}
    >
      <SpecialSalsaClassLanding
        remaining={remaining}
        onlineCapacity={onlineCapacity}
        cancelledAttemptId={cancelledAttemptId}
        initialNowMs={initialNowMs}
        initialDialogOpen={initialDialogOpen}
        bannerReservationRequest={bannerReservationRequest}
      />
    </PublicLayout>
  )
}
