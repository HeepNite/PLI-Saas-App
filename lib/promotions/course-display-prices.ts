import type { EnrollmentOption } from "@/constants/courses"
import { resolveCoursePromotionPrice, type CoursePromotionChannel } from "@/lib/promotions/course-promotions"

export type CourseDisplayPrices = {
  dropIn: number | null
  firstClass: number | null
  promotionLabel: string | null
}

const servicePrice = (services: readonly EnrollmentOption[] | undefined, id: string) => {
  const price = services?.find((service) => service.id === id)?.price
  return typeof price === "number" && Number.isFinite(price) ? price : null
}

/**
 * Display-only view of what checkout charges for a single drop-in / first class.
 * Prices come from the same `course.enrollment.services` checkout validates against,
 * and promotions go through the same `resolveCoursePromotionPrice` checkout uses
 * (regular price = drop-in; applied only when cheaper than the charged service).
 * Identity-bound (heritage pin) promotions are not shown before identification.
 */
export const resolveCourseDisplayPrices = (input: {
  services: readonly EnrollmentOption[] | undefined
  promotions: unknown
  channel: CoursePromotionChannel | null
  classDate: string
  purchaseDate: string
}): CourseDisplayPrices => {
  const dropIn = servicePrice(input.services, "dropin")
  const firstClass = servicePrice(input.services, "new-student")
  const promotion = input.channel && dropIn !== null
    ? resolveCoursePromotionPrice({
        promotions: input.promotions,
        channel: input.channel,
        classDate: input.classDate,
        purchaseDate: input.purchaseDate,
        regularPriceCents: Math.round(dropIn * 100),
        hasDeliveredHeritagePin: false,
      })
    : null
  if (!promotion?.applied) return { dropIn, firstClass, promotionLabel: null }

  const promoted = (price: number | null) =>
    price !== null && promotion.amountCents < Math.round(price * 100) ? promotion.amountCents / 100 : price
  return {
    dropIn: promoted(dropIn),
    firstClass: promoted(firstClass),
    promotionLabel: promotion.promotion.label,
  }
}
