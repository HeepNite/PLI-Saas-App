import "server-only"
import type { HeritagePinDb } from "@/lib/campaigns/heritage-pin-entitlement"
import { findHeritagePinEntitlementForIdentity } from "@/lib/campaigns/heritage-pin-entitlement"
import { getAvailableTimesForCourseDateFromCourse } from "@/lib/class-schedule"
import { getNewYorkDateKey, resolveCoursePromotionPrice, type CoursePromotionChannel } from "@/lib/promotions/course-promotions"
import type { CourseData } from "@/constants/courses"

export type CoursePromotionCheckoutShape = {
  serviceId: string
  safeParticipants: number
  packageId: string
  coupon: string
  addons: readonly string[]
  consecutivePriceCents: number | null
  consecutiveAddOnOnly: boolean
}

export type ResolvedCoursePromotionIdentity = {
  clerkId?: string | null
  email?: string | null
  phone?: string | null
}

export const resolveCoursePromotionCheckoutPricing = async (input: {
  db: HeritagePinDb
  trustedChannel: CoursePromotionChannel | null
  authoritativePromotions: unknown
  authoritativeCourse: CourseData
  classDate: string
  classTime: string
  amountCents: number
  regularPriceCents: number
  checkoutShape: CoursePromotionCheckoutShape
  resolvedIdentity: ResolvedCoursePromotionIdentity
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
  const promotionEligible = promotionShapeEligible && hasConfiguredPromotion
  const heritageEntitlement = promotionEligible
    ? await findHeritagePinEntitlementForIdentity(input.db, input.resolvedIdentity)
    : null
  const promotionPrice = promotionEligible && input.trustedChannel
    ? resolveCoursePromotionPrice({
        promotions: input.authoritativePromotions,
        channel: input.trustedChannel,
        classDate: input.classDate,
        purchaseDate: getNewYorkDateKey(),
        regularPriceCents: input.regularPriceCents,
        hasDeliveredHeritagePin: heritageEntitlement?.status === "delivered",
      })
    : { applied: false as const, reason: "no_eligible_promotion" as const }
  const hasScheduledOccurrence = !promotionPrice.applied ||
    promotionPrice.promotion.window.basis !== "class_date" ||
    getAvailableTimesForCourseDateFromCourse(input.authoritativeCourse, input.classDate).includes(input.classTime)
  const appliedPromotion = promotionPrice.applied && hasScheduledOccurrence && promotionPrice.amountCents < input.amountCents
    ? promotionPrice
    : null
  const promotionMetadata: Record<string, string> = appliedPromotion ? {
    coursePromotionId: appliedPromotion.promotion.id,
    coursePromotionLabel: appliedPromotion.promotion.label,
    coursePromotionPriceCents: String(appliedPromotion.amountCents),
    coursePromotionPricingKind: appliedPromotion.promotion.pricing.kind,
    coursePromotionAudience: appliedPromotion.promotion.audience,
    coursePromotionDateBasis: appliedPromotion.promotion.window.basis,
  } : {}

  return {
    effectiveAmountCents: appliedPromotion?.amountCents ?? input.amountCents,
    appliedPromotion,
    promotionMetadata,
  }
}
