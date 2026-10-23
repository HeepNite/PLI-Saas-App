import "server-only"
import type { HeritagePinDb } from "@/lib/campaigns/heritage-pin-entitlement"
import { findHeritagePinEntitlementForIdentity } from "@/lib/campaigns/heritage-pin-entitlement"
import { getNewYorkDateKey, type CoursePromotionChannel } from "@/lib/promotions/course-promotions"
import {
  isCoursePromotionCheckoutEligible,
  resolveCoursePromotionCheckoutAmount,
  type CoursePromotionCheckoutShape,
} from "@/lib/promotions/course-promotion-checkout"
import type { CourseData } from "@/constants/courses"

export type { CoursePromotionCheckoutShape }

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
  const heritageEntitlement = isCoursePromotionCheckoutEligible(input)
    ? await findHeritagePinEntitlementForIdentity(input.db, input.resolvedIdentity)
    : null
  const { effectiveAmountCents, appliedPromotion } = resolveCoursePromotionCheckoutAmount({
    ...input,
    purchaseDate: getNewYorkDateKey(),
    hasDeliveredHeritagePin: heritageEntitlement?.status === "delivered",
  })
  const promotionMetadata: Record<string, string> = appliedPromotion ? {
    coursePromotionId: appliedPromotion.promotion.id,
    coursePromotionLabel: appliedPromotion.promotion.label,
    coursePromotionPriceCents: String(appliedPromotion.amountCents),
    coursePromotionPricingKind: appliedPromotion.promotion.pricing.kind,
    coursePromotionAudience: appliedPromotion.promotion.audience,
    coursePromotionDateBasis: appliedPromotion.promotion.window.basis,
  } : {}

  return {
    effectiveAmountCents,
    appliedPromotion,
    promotionMetadata,
  }
}
