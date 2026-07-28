import Stripe from "stripe"

export const normalize = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

export const parseIntSafe = (value: string | undefined) => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Extract and normalize known fields from Stripe checkout/payment metadata.
 * Single source of truth — used by webhook handler and finalize route.
 */
export const pickStripeMetadata = (metadata?: Stripe.Metadata | null) => ({
  courseSlug: normalize(metadata?.courseSlug),
  courseTitle: normalize(metadata?.courseTitle),
  date: normalize(metadata?.date),
  time: normalize(metadata?.time),
  packageId: normalize(metadata?.packageId),
  packageLabel: normalize(metadata?.packageLabel),
  packageTotalCredits: normalize(metadata?.packageTotalCredits),
  packageIsUnlimited: normalize(metadata?.packageIsUnlimited),
  packageCadence: normalize(metadata?.packageCadence),
  packageMakeUps: normalize(metadata?.packageMakeUps),
  packageValidDays: normalize(metadata?.packageValidDays),
  serviceId: normalize(metadata?.serviceId),
  userId: normalize(metadata?.userId),
  participants: normalize(metadata?.participants),
  coupon: normalize(metadata?.coupon),
  addons: normalize(metadata?.addons),
  name: normalize(metadata?.name),
  email: normalize(metadata?.email),
  phone: normalize(metadata?.phone),
  phoneRaw: normalize(metadata?.phoneRaw),
  consecutivePriceCents: normalize(metadata?.consecutivePriceCents),
  consecutiveLinkedCourseSlug: normalize(metadata?.consecutiveLinkedCourseSlug),
  consecutiveCourseTitle: normalize(metadata?.consecutiveCourseTitle),
  consecutiveLinkedCourseTime: normalize(metadata?.consecutiveLinkedCourseTime),
  flowContext: normalize(metadata?.flowContext),
  paymentSurface: normalize(metadata?.paymentSurface),
})

export type StripeMetadata = ReturnType<typeof pickStripeMetadata>
