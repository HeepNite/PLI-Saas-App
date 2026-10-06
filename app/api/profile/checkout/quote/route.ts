import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { resolveCoursePromotionCheckoutPricing } from "@/lib/checkout/course-promotion-pricing"
import { enforcePublicBookingPolicy } from "@/lib/checkout/public-booking-policy"
import { validateCheckoutPayload, type ApiError, type CheckoutBody } from "@/lib/checkout/validation"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const isApiError = (value: unknown): value is ApiError =>
  Boolean(value && typeof value === "object" && "status" in value && "error" in value)

const toErrorResponse = (error: ApiError) =>
  NextResponse.json({ error: error.error, ...(error.code ? { code: error.code } : {}) }, { status: error.status })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: CheckoutBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const validation = await validateCheckoutPayload(body)
  if (isApiError(validation)) return toErrorResponse(validation)
  const bookingPolicy = enforcePublicBookingPolicy(validation)
  if (isApiError(bookingPolicy)) return toErrorResponse(bookingPolicy)

  const authoritativePromotions = validation.course && typeof validation.course.scheduleRules === "object" && validation.course.scheduleRules
    ? (validation.course.scheduleRules as Record<string, unknown>).promotions
    : []
  const regularDropIn = validation.course.enrollment.services.find((service) => service.id === "dropin")
  const { effectiveAmountCents, appliedPromotion } = await resolveCoursePromotionCheckoutPricing({
    db: prisma,
    trustedChannel: "profile",
    authoritativePromotions,
    authoritativeCourse: validation.course,
    classDate: validation.date,
    classTime: validation.time,
    amountCents: validation.amountInt,
    regularPriceCents: Math.round((regularDropIn?.price ?? 0) * 100),
    checkoutShape: {
      serviceId: validation.serviceId,
      safeParticipants: validation.safeParticipants,
      packageId: validation.packageId,
      coupon: validation.coupon,
      addons: validation.addons,
      consecutivePriceCents: validation.consecutivePriceCents,
      consecutiveAddOnOnly: validation.consecutiveAddOnOnly,
    },
    resolvedIdentity: { clerkId: userId },
  })

  return NextResponse.json({
    amountCents: effectiveAmountCents,
    currency: bookingPolicy.currency,
    ...(appliedPromotion ? { promotionLabel: appliedPromotion.promotion.label } : {}),
  })
}
