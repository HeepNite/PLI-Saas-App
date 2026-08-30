import type { Metadata } from "next"
import { SpecialSalsaClassExperience } from "@/components/front/special-salsa-class/SpecialSalsaClassExperience"
import { getSpecialClassAvailability } from "@/lib/checkout/special-class-reservation"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"

export const metadata: Metadata = {
  title: `${SPECIAL_SALSA_CLASS.displayTitle} | PLI`,
  description: `Reserve your spot for ${SPECIAL_SALSA_CLASS.displayTitle} in Jersey City on August 30, 2026.`,
}

export const dynamic = "force-dynamic"

const buildReservationHref = (params?: Record<string, string | string[] | undefined>) => {
  const nextParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (key === "reserve" || value === undefined) continue
    if (Array.isArray(value)) {
      for (const entry of value) nextParams.append(key, entry)
      continue
    }
    nextParams.set(key, value)
  }
  nextParams.set("reserve", "1")
  return `/special-salsa-class?${nextParams.toString()}`
}

export default async function SpecialSalsaClassPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const cancelledAttemptId = params?.checkout === "cancelled" && typeof params.attempt === "string"
    ? params.attempt
    : undefined
  const initialDialogOpen = params?.reserve === "1"
  const availability = await getSpecialClassAvailability(SPECIAL_SALSA_CLASS.key).catch(() => null)
  const initialNowMs = Date.now()

  return (
    <SpecialSalsaClassExperience
      remaining={availability?.remaining ?? null}
      onlineCapacity={availability?.capacity ?? SPECIAL_SALSA_CLASS.webQuota}
      cancelledAttemptId={cancelledAttemptId}
      initialNowMs={initialNowMs}
      initialDialogOpen={initialDialogOpen}
      reservationHref={buildReservationHref(params)}
    />
  )
}
