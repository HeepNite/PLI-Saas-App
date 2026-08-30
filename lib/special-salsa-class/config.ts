const STARTS_AT_UTC = "2026-08-30T20:00:00.000Z"
const REFUND_DEADLINE_UTC = "2026-08-28T20:00:00.000Z"
const PROMOTION_DEADLINE_UTC = "2026-08-30T14:00:00.000Z"

export const SPECIAL_SALSA_CLASS = Object.freeze({
  key: "special-salsa-class-2026-08-30",
  checkoutKind: "special-salsa-class",
  courseSlug: "special-salsa-calena-2026-08-30",
  title: "Special Salsa Caleña Class",
  displayTitle: "Salsa de Cali",
  videoSrc: "/Videos/special-salsa.mp4",
  videoPosterSrc: "/logo/logo-black.png",
  timeZone: "America/New_York",
  localDate: "2026-08-30",
  localTime: "16:00",
  startsAt: new Date(STARTS_AT_UTC),
  refundDeadline: new Date(REFUND_DEADLINE_UTC),
  durationMinutes: 60,
  amountCents: 2500,
  promotion: Object.freeze({
    amountCents: 2000,
    discountPercent: 20,
    deadline: new Date(PROMOTION_DEADLINE_UTC),
  }),
  currency: "usd",
  capacity: 40,
  webQuota: 17,
  address: "54 Coles St, Jersey City",
  holdMinutes: 3,
})

export const resolveSpecialClassPricing = (now: Date) => {
  const promotionActive = now.getTime() < SPECIAL_SALSA_CLASS.promotion.deadline.getTime()
  return promotionActive
    ? {
        amountCents: SPECIAL_SALSA_CLASS.promotion.amountCents,
        discountPercent: SPECIAL_SALSA_CLASS.promotion.discountPercent,
        promotionActive: true,
      }
    : {
        amountCents: SPECIAL_SALSA_CLASS.amountCents,
        discountPercent: 0,
        promotionActive: false,
      }
}

export const isSpecialClassPriceCents = (amountCents: number) =>
  amountCents === SPECIAL_SALSA_CLASS.promotion.amountCents || amountCents === SPECIAL_SALSA_CLASS.amountCents

export const SPECIAL_SALSA_REFUND_POLICY =
  "Cancellations and refunds are available until Friday, August 28, 2026 at 4:00 PM. Eligible refunds are handled manually by PLI staff."

const DURABLE_PURCHASE_STATUSES = new Set(["paid", "succeeded", "completed"])

export const getSpecialClassHoldCutoff = (now: Date) =>
  new Date(now.getTime() - SPECIAL_SALSA_CLASS.holdMinutes * 60_000)

export const getSpecialClassHoldExpiresAt = (now: Date) =>
  new Date(
    (Math.ceil(now.getTime() / 1000) + SPECIAL_SALSA_CLASS.holdMinutes * 60) * 1000,
  )

export const getSpecialClassHoldCreatedAt = (holdExpiresAt: Date) =>
  new Date(holdExpiresAt.getTime() - SPECIAL_SALSA_CLASS.holdMinutes * 60_000)

export const isSpecialClassPurchaseCounted = (
  purchase: { status: string; createdAt: Date },
  now: Date,
) => {
  const status = purchase.status.trim().toLowerCase()
  if (DURABLE_PURCHASE_STATUSES.has(status)) return true
  return status === "pending" && purchase.createdAt > getSpecialClassHoldCutoff(now)
}

export const formatSpecialClassDate = (instant: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: SPECIAL_SALSA_CLASS.timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(instant)

export const formatSpecialClassTime = (instant: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: SPECIAL_SALSA_CLASS.timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(instant)

export const formatSpecialClassDateTime = (instant: Date) =>
  `${formatSpecialClassDate(instant)} at ${formatSpecialClassTime(instant)}`
