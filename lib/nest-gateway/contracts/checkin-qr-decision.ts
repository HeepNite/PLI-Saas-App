import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"

export type CheckinQrDecisionGatewayResponse = BootstrapResponse

type CheckinQrDecisionGatewayCustomer = CheckinQrDecisionGatewayResponse["customer"]

export type CheckinQrDecisionGatewayRequest = {
  courseSlug: string
  date: string
  time: string
  durationMinutes?: number
  flowContext?: string
  linkedFromCourseSlug?: string
  customer: CheckinQrDecisionGatewayCustomer
}

const matchesGatewayRequest = ({
  response,
  request,
}: {
  response: CheckinQrDecisionGatewayResponse
  request: CheckinQrDecisionGatewayRequest
}) => {
  const matchesDurationMinutes =
    request.durationMinutes === undefined || response.context.durationMinutes === request.durationMinutes

  return (
    response.context.courseSlug === request.courseSlug &&
    response.context.date === request.date &&
    response.context.time === request.time &&
    response.customer.userId === request.customer.userId &&
    matchesDurationMinutes
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const isString = (value: unknown): value is string => typeof value === "string"
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean"
const isNullableString = (value: unknown): value is string | null => value === null || isString(value)
const isNullableNumber = (value: unknown): value is number | null => value === null || typeof value === "number"
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString)

const isBootstrapPackage = (value: unknown): value is NonNullable<CheckinQrDecisionGatewayResponse["package"]> => {
  if (!isRecord(value)) return false

  return (
    isString(value.id) &&
    isString(value.packageId) &&
    isNullableString(value.packageLabel) &&
    isBoolean(value.isUnlimited) &&
    isNullableNumber(value.remainingCredits) &&
    isNullableString(value.expiresAt) &&
    isString(value.status)
  )
}

const isBootstrapPackagesItem = (value: unknown): value is CheckinQrDecisionGatewayResponse["packages"][number] => {
  if (!isBootstrapPackage(value) || !isRecord(value)) return false
  const candidate = value as Record<string, unknown>
  return isNullableString(candidate.courseSlug)
}

const isPurchaseHistoryItem = (value: unknown): value is CheckinQrDecisionGatewayResponse["purchaseHistory"][number] => {
  if (!isRecord(value)) return false

  return (
    isString(value.id) &&
    isString(value.createdAt) &&
    typeof value.amount === "number" &&
    isString(value.currency) &&
    isString(value.status) &&
    isNullableNumber(value.participants) &&
    isString(value.serviceId) &&
    isString(value.packageId) &&
    isStringArray(value.addons) &&
    isString(value.date) &&
    isString(value.time)
  )
}

const isQuickCheckout = (value: unknown): value is NonNullable<CheckinQrDecisionGatewayResponse["quickCheckout"]> => {
  if (!isRecord(value)) return false

  return (
    isString(value.serviceId) &&
    isString(value.packageId) &&
    isStringArray(value.addons) &&
    typeof value.participants === "number" &&
    isString(value.coupon) &&
    typeof value.amountCents === "number" &&
    isString(value.currency) &&
    isNullableString(value.sourcePurchaseId) &&
    isNullableString(value.sourcePurchaseAt)
  )
}

const isConsecutiveOffer = (value: unknown): value is NonNullable<CheckinQrDecisionGatewayResponse["consecutiveOffer"]> => {
  if (!isRecord(value)) return false

  return (
    isString(value.linkedCourseSlug) &&
    isString(value.linkedCourseTitle) &&
    isNullableString(value.linkedCourseTime) &&
    isNullableNumber(value.dropInConsecutiveCents) &&
    isNullableNumber(value.packageHolderConsecutiveCents) &&
    typeof value.regularDropInCents === "number" &&
    typeof value.discountPercent === "number" &&
    isBoolean(value.hasAttendedFirstClass)
  )
}

const isCheckinQrDecisionGatewayResponse = (value: unknown): value is CheckinQrDecisionGatewayResponse => {
  if (!isRecord(value) || !isRecord(value.context) || !isRecord(value.customer)) return false

  const { context, customer } = value

  return (
    isString(context.courseSlug) &&
    isString(context.courseTitle) &&
    isString(context.date) &&
    isString(context.time) &&
    typeof context.durationMinutes === "number" &&
    isString(context.startsAt) &&
    isString(context.endsAt) &&
    isRecord(context.checkInWindow) &&
    isBoolean(context.checkInWindow.isOpen) &&
    isString(context.checkInWindow.opensAt) &&
    isString(context.checkInWindow.closesAt) &&
    isString(customer.userId) &&
    isString(customer.clerkUserId) &&
    isString(customer.firstName) &&
    isString(customer.lastName) &&
    isString(customer.name) &&
    isString(customer.email) &&
    isString(customer.phone) &&
    isBoolean(customer.hasAvatar) &&
    (value.package === null || isBootstrapPackage(value.package)) &&
    Array.isArray(value.packages) &&
    value.packages.every(isBootstrapPackagesItem) &&
    (value.quickCheckout === null || isQuickCheckout(value.quickCheckout)) &&
    Array.isArray(value.purchaseHistory) &&
    value.purchaseHistory.every(isPurchaseHistoryItem) &&
    isBoolean(value.hasPreviousPurchase) &&
    isBoolean(value.hasAnyCompletedPurchase) &&
    (value.hasExistingPurchaseForSession === undefined || isBoolean(value.hasExistingPurchaseForSession)) &&
    (value.hasAnyActivePackage === undefined || isBoolean(value.hasAnyActivePackage)) &&
    (value.consecutiveOffer === undefined || value.consecutiveOffer === null || isConsecutiveOffer(value.consecutiveOffer)) &&
    (value.dayOfWeekPurchaseCount === undefined || typeof value.dayOfWeekPurchaseCount === "number") &&
    (value.quickRepeatEligible === undefined || isBoolean(value.quickRepeatEligible)) &&
    (value.lastPurchasePattern === undefined ||
      value.lastPurchasePattern === null ||
      (isRecord(value.lastPurchasePattern) &&
        isString(value.lastPurchasePattern.paymentChannel) &&
        isString(value.lastPurchasePattern.courseSlug) &&
        typeof value.lastPurchasePattern.amount === "number"))
  )
}

export const parseCheckinQrDecisionGatewayResponse = (
  value: unknown,
  request?: CheckinQrDecisionGatewayRequest
): CheckinQrDecisionGatewayResponse | null => {
  if (!isCheckinQrDecisionGatewayResponse(value)) return null

  const response = {
    context: {
      courseSlug: value.context.courseSlug,
      courseTitle: value.context.courseTitle,
      date: value.context.date,
      time: value.context.time,
      durationMinutes: value.context.durationMinutes,
      startsAt: value.context.startsAt,
      endsAt: value.context.endsAt,
      checkInWindow: {
        isOpen: value.context.checkInWindow.isOpen,
        opensAt: value.context.checkInWindow.opensAt,
        closesAt: value.context.checkInWindow.closesAt,
      },
    },
    customer: {
      userId: value.customer.userId,
      clerkUserId: value.customer.clerkUserId,
      firstName: value.customer.firstName,
      lastName: value.customer.lastName,
      name: value.customer.name,
      email: value.customer.email,
      phone: value.customer.phone,
      hasAvatar: value.customer.hasAvatar,
    },
    package: value.package
      ? {
          id: value.package.id,
          packageId: value.package.packageId,
          packageLabel: value.package.packageLabel,
          isUnlimited: value.package.isUnlimited,
          remainingCredits: value.package.remainingCredits,
          expiresAt: value.package.expiresAt,
          status: value.package.status,
        }
      : null,
    packages: value.packages.map((pkg) => ({
      id: pkg.id,
      packageId: pkg.packageId,
      packageLabel: pkg.packageLabel,
      courseSlug: pkg.courseSlug ?? null,
      isUnlimited: pkg.isUnlimited,
      remainingCredits: pkg.remainingCredits,
      expiresAt: pkg.expiresAt,
      status: pkg.status,
    })),
    quickCheckout: value.quickCheckout
      ? {
          serviceId: value.quickCheckout.serviceId,
          packageId: value.quickCheckout.packageId,
          addons: [...value.quickCheckout.addons],
          participants: value.quickCheckout.participants,
          coupon: value.quickCheckout.coupon,
          amountCents: value.quickCheckout.amountCents,
          currency: value.quickCheckout.currency,
          sourcePurchaseId: value.quickCheckout.sourcePurchaseId,
          sourcePurchaseAt: value.quickCheckout.sourcePurchaseAt,
        }
      : null,
    purchaseHistory: value.purchaseHistory.map((purchase) => ({
      id: purchase.id,
      createdAt: purchase.createdAt,
      amount: purchase.amount,
      currency: purchase.currency,
      status: purchase.status,
      participants: purchase.participants,
      serviceId: purchase.serviceId,
      packageId: purchase.packageId,
      addons: [...purchase.addons],
      date: purchase.date,
      time: purchase.time,
    })),
    hasPreviousPurchase: value.hasPreviousPurchase,
    hasAnyCompletedPurchase: value.hasAnyCompletedPurchase,
    hasExistingPurchaseForSession: value.hasExistingPurchaseForSession,
    hasAnyActivePackage: value.hasAnyActivePackage,
    consecutiveOffer:
      value.consecutiveOffer === undefined
        ? undefined
        : value.consecutiveOffer === null
          ? null
          : {
              linkedCourseSlug: value.consecutiveOffer.linkedCourseSlug,
              linkedCourseTitle: value.consecutiveOffer.linkedCourseTitle,
              linkedCourseTime: value.consecutiveOffer.linkedCourseTime,
              dropInConsecutiveCents: value.consecutiveOffer.dropInConsecutiveCents,
              packageHolderConsecutiveCents: value.consecutiveOffer.packageHolderConsecutiveCents,
              regularDropInCents: value.consecutiveOffer.regularDropInCents,
              discountPercent: value.consecutiveOffer.discountPercent,
              hasAttendedFirstClass: value.consecutiveOffer.hasAttendedFirstClass,
            },
    dayOfWeekPurchaseCount: value.dayOfWeekPurchaseCount,
    quickRepeatEligible: value.quickRepeatEligible,
    lastPurchasePattern:
      value.lastPurchasePattern === undefined
        ? undefined
        : value.lastPurchasePattern === null
          ? null
          : {
              paymentChannel: value.lastPurchasePattern.paymentChannel,
              courseSlug: value.lastPurchasePattern.courseSlug,
              amount: value.lastPurchasePattern.amount,
            },
  }

  if (request && !matchesGatewayRequest({ response, request })) {
    return null
  }

  return response
}
