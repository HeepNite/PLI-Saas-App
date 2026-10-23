import { getAvailableTimesForCourseDateFromCourse } from "@/lib/class-schedule"
import { resolveCoursePromotionPrice, type CoursePromotionChannel } from "@/lib/promotions/course-promotions"

export type CoursePromotionCheckoutShape = {
  serviceId: string
  safeParticipants: number
  packageId: string
  coupon: string
  addons: readonly string[]
  consecutivePriceCents: number | null
  consecutiveAddOnOnly: boolean
}

/** Course promotions live in `scheduleRules.promotions` (same lookup as the checkout routes). */
export const getCoursePromotions = (scheduleRules: unknown) =>
  scheduleRules && typeof scheduleRules === "object" ? (scheduleRules as Record<string, unknown>).promotions : []

type PromotionScheduleCourse = Parameters<typeof getAvailableTimesForCourseDateFromCourse>[0]

/** Whether a checkout shape can receive a course promotion at all (single drop-in / first class, no extras). */
export const isCoursePromotionCheckoutEligible = (input: {
  trustedChannel: CoursePromotionChannel | null
  authoritativePromotions: unknown
  checkoutShape: CoursePromotionCheckoutShape
}) => {
  const { checkoutShape } = input
  const promotionShapeEligible = Boolean(
    input.trustedChannel &&
    (checkoutShape.serviceId === "dropin" || checkoutShape.serviceId === "new-student") &&
    checkoutShape.safeParticipants === 1 &&
    !checkoutShape.packageId && !checkoutShape.coupon && checkoutShape.addons.length === 0 &&
    checkoutShape.consecutivePriceCents === null && !checkoutShape.consecutiveAddOnOnly,
  )
  const hasConfiguredPromotion = Array.isArray(input.authoritativePromotions) && input.authoritativePromotions.length > 0
  return promotionShapeEligible && hasConfiguredPromotion
}

/**
 * Pure checkout promotion resolution shared by the checkout routes (server) and the
 * enroll modal display (client), so the displayed amount is the charged amount.
 */
export const resolveCoursePromotionCheckoutAmount = (input: {
  trustedChannel: CoursePromotionChannel | null
  authoritativePromotions: unknown
  authoritativeCourse: PromotionScheduleCourse | null | undefined
  classDate: string
  classTime: string
  purchaseDate: string
  amountCents: number
  regularPriceCents: number
  checkoutShape: CoursePromotionCheckoutShape
  hasDeliveredHeritagePin: boolean
}) => {
  const promotionPrice = isCoursePromotionCheckoutEligible(input) && input.trustedChannel
    ? resolveCoursePromotionPrice({
        promotions: input.authoritativePromotions,
        channel: input.trustedChannel,
        classDate: input.classDate,
        purchaseDate: input.purchaseDate,
        regularPriceCents: input.regularPriceCents,
        hasDeliveredHeritagePin: input.hasDeliveredHeritagePin,
      })
    : { applied: false as const, reason: "no_eligible_promotion" as const }
  const hasScheduledOccurrence = !promotionPrice.applied ||
    promotionPrice.promotion.window.basis !== "class_date" ||
    (input.authoritativeCourse
      ? getAvailableTimesForCourseDateFromCourse(input.authoritativeCourse, input.classDate).includes(input.classTime)
      : false)
  const appliedPromotion = promotionPrice.applied && hasScheduledOccurrence && promotionPrice.amountCents < input.amountCents
    ? promotionPrice
    : null

  return {
    effectiveAmountCents: appliedPromotion?.amountCents ?? input.amountCents,
    appliedPromotion,
  }
}
