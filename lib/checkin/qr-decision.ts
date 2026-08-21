import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"
import { resolveConsecutiveOffer } from "@/lib/checkin/consecutive-offer"
import { parseQrCheckInContext, isTerminalCheckInAllowed } from "@/lib/checkin/qr"
import { prisma } from "@/lib/prisma"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import { asObject, asRecord, asText } from "@/lib/shared"
import { FLOW_CONTEXT, PAYMENT_CHANNEL } from "@/lib/payment-constants"
import type { CourseData } from "@/constants/courses"
import type { CheckinQrDecisionGatewayRequest } from "@/lib/nest-gateway/contracts/checkin-qr-decision"

const DUPLICATE_BLOCKING_PURCHASE_STATUSES = [...SUCCESSFUL_PURCHASE_STATUSES, "pending"]
const MIN_QUICK_CHECKOUT_PARTICIPANTS = 1
const MAX_QUICK_CHECKOUT_PARTICIPANTS = 10
const DEFAULT_QUICK_CHECKOUT_PARTICIPANTS = 1
const ACTIVE_PACKAGE_QUERY_LIMIT = 10
const RECENT_PURCHASE_QUERY_LIMIT = 8
const QUICK_REPEAT_PURCHASE_THRESHOLD = 3
const CENTS_PER_DOLLAR = 100

export class QrDecisionResponseError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "QrDecisionResponseError"
  }
}

export const isQrDecisionResponseError = (error: unknown): error is QrDecisionResponseError =>
  error instanceof QrDecisionResponseError

type CoursePricingTemplate = NonNullable<BootstrapResponse["quickCheckout"]>

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[]
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
}

const pickPercentDiscount = (coupon: string) => {
  const normalized = coupon.trim().toUpperCase()
  if (normalized === "PLI10") return 10
  if (normalized === "PLI20") return 20
  return 0
}

const buildPricingTemplate = (input: {
  course: CourseData
  lastPurchaseMetadata: Record<string, unknown> | null
  lastPurchaseAddonsCsv: string | null
  lastPurchaseParticipants: number | null
  lastPurchaseCoupon: string | null
}): CoursePricingTemplate | null => {
  const serviceIdCandidate = asText(input.lastPurchaseMetadata?.serviceId)
  const packageIdCandidate = asText(input.lastPurchaseMetadata?.packageId)
  const participantsCandidate = input.lastPurchaseParticipants && Number.isFinite(input.lastPurchaseParticipants)
    ? Math.max(MIN_QUICK_CHECKOUT_PARTICIPANTS, Math.min(MAX_QUICK_CHECKOUT_PARTICIPANTS, Math.round(input.lastPurchaseParticipants)))
    : DEFAULT_QUICK_CHECKOUT_PARTICIPANTS
  const couponCandidate = asText(input.lastPurchaseCoupon)
  const addonsFromMetadata = toStringArray(input.lastPurchaseMetadata?.addons)
  const addonsFromCsv = typeof input.lastPurchaseAddonsCsv === "string"
    ? input.lastPurchaseAddonsCsv.split(",").map((item) => item.trim()).filter(Boolean)
    : []
  const addonsRaw = addonsFromMetadata.length > 0 ? addonsFromMetadata : addonsFromCsv

  const service =
    input.course.enrollment.services.find((item) => item.id === serviceIdCandidate) ||
    input.course.enrollment.services.find((item) => item.id === "dropin") ||
    input.course.enrollment.services[0]
  if (!service) return null

  const pkg = packageIdCandidate ? input.course.enrollment.packages.find((item) => item.id === packageIdCandidate) : undefined
  const addons = (input.course.enrollment.addons || []).filter((item) => addonsRaw.includes(item.id)).map((item) => item.id)
  const serviceCharge = pkg ? 0 : service.price || 0
  const packageCharge = pkg?.price || 0
  const addonsCharge = (input.course.enrollment.addons || [])
    .filter((item) => addons.includes(item.id))
    .reduce((sum, item) => sum + (item.price || 0), 0)
  const subtotal = (serviceCharge + packageCharge + addonsCharge) * participantsCandidate
  const discount = (subtotal * pickPercentDiscount(couponCandidate)) / 100
  const amountCents = Math.round(Math.max(0, subtotal - discount) * CENTS_PER_DOLLAR)

  if (!Number.isFinite(amountCents) || amountCents <= 0) return null

  return {
    serviceId: service.id,
    packageId: pkg?.id || "",
    addons,
    participants: participantsCandidate,
    coupon: couponCandidate,
    amountCents,
    currency: "usd",
    sourcePurchaseId: null,
    sourcePurchaseAt: null,
  }
}

const pickPreferredPackage = (input: {
  courseSlug: string
  packages: Array<{
    id: string
    packageId: string
    packageLabel: string | null
    courseSlug: string | null
    isUnlimited: boolean
    remainingCredits: number | null
    expiresAt: Date | null
    status: string
    packagePlan?: { courseSlugs: string[] } | null
  }>
}) => {
  return [...input.packages].sort((left, right) => {
    const leftMatches = (left.courseSlug && left.courseSlug === input.courseSlug) || (left.packagePlan?.courseSlugs?.includes(input.courseSlug) ?? false)
    const rightMatches = (right.courseSlug && right.courseSlug === input.courseSlug) || (right.packagePlan?.courseSlugs?.includes(input.courseSlug) ?? false)
    if (leftMatches !== rightMatches) return leftMatches ? -1 : 1
    return (left.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
  })[0] || null
}

const getCurrentEtWeekday = (now: Date) => {
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now)
  return weekdayLabels.findIndex((label) => label === weekday)
}

const resolveOptionalConsecutiveOffer = async ({
  customerUserId,
  linkedFromCourseSlug,
  weekday,
  courseTimeMinutes,
  now,
}: {
  customerUserId: string
  linkedFromCourseSlug?: string
  weekday: number
  courseTimeMinutes: number | null
  now: Date
}) => {
  if (!linkedFromCourseSlug) return null

  try {
    return await resolveConsecutiveOffer({
      userId: customerUserId,
      linkedFromCourseSlug,
      todayJsWeekday: weekday,
      courseTimeMinutes,
      now,
    })
  } catch {
    return null
  }
}

export const buildQrBootstrapDecisionResponse = async (input: CheckinQrDecisionGatewayRequest): Promise<BootstrapResponse> => {
  const context = parseQrCheckInContext(input)
  if ("status" in context) {
    throw new QrDecisionResponseError(context.status, context.error)
  }

  const now = new Date()
  const course = await getCatalogCourseBySlug(context.courseSlug)
  if (!course) {
    throw new QrDecisionResponseError(404, "Course not found")
  }

  const isTerminalFlow = input.flowContext === FLOW_CONTEXT.KIOSK_TERMINAL
  const isWindowOpen = isTerminalCheckInAllowed(context, now)
  const weekday = getCurrentEtWeekday(now)
  const courseTimeMatch = /^(\d{2}):(\d{2})$/.exec(context.time || "")
  const courseTimeMinutes = courseTimeMatch ? Number(courseTimeMatch[1]) * 60 + Number(courseTimeMatch[2]) : null

  const [allActivePackages, recentPurchases, anyCompletedPurchase, classSession, totalPurchaseCount, consecutiveOffer] = await Promise.all([
    prisma.packagePurchase.findMany({
      where: {
        userId: input.customer.userId,
        status: "active",
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          { OR: [{ isUnlimited: true, remainingCredits: null }, { remainingCredits: { gt: 0 } }] },
        ],
      },
      select: {
        id: true,
        packageId: true,
        packageLabel: true,
        courseSlug: true,
        isUnlimited: true,
        remainingCredits: true,
        expiresAt: true,
        status: true,
        packagePlan: { select: { courseSlugs: true } },
      },
      orderBy: [{ expiresAt: "asc" }, { purchasedAt: "desc" }],
      take: ACTIVE_PACKAGE_QUERY_LIMIT,
    }),
    prisma.purchase.findMany({
      where: {
        userId: input.customer.userId,
        courseSlug: context.courseSlug,
        status: { in: DUPLICATE_BLOCKING_PURCHASE_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_PURCHASE_QUERY_LIMIT,
    }),
    isTerminalFlow
      ? Promise.resolve(null)
      : prisma.purchase.findFirst({
          where: { userId: input.customer.userId, status: { in: SUCCESSFUL_PURCHASE_STATUSES } },
          select: { id: true },
        }),
    prisma.classSession.findUnique({
      where: { courseSlug_startsAt: { courseSlug: context.courseSlug, startsAt: context.startsAt } },
      select: { id: true },
    }),
    isTerminalFlow
      ? prisma.purchase.count({ where: { userId: input.customer.userId, status: { in: SUCCESSFUL_PURCHASE_STATUSES } } })
      : Promise.resolve(0),
    resolveOptionalConsecutiveOffer({
      customerUserId: input.customer.userId,
      linkedFromCourseSlug: input.linkedFromCourseSlug,
      weekday,
      courseTimeMinutes,
      now,
    }),
  ])

  const hasExistingPurchaseForSession = classSession
    ? Boolean(
        await prisma.attendance.findUnique({
          where: { userId_sessionId: { userId: input.customer.userId, sessionId: classSession.id } },
          select: { id: true },
        })
      )
    : false

  const activePackages = allActivePackages.filter((item) =>
    item.courseSlug === null || item.courseSlug === context.courseSlug || (item.packagePlan?.courseSlugs?.includes(context.courseSlug) ?? false)
  )
  const preferredPackage = pickPreferredPackage({ courseSlug: context.courseSlug, packages: activePackages })
  const lastPurchase = recentPurchases[0] || null
  const purchaseMetadata = asRecord(lastPurchase?.metadata)
  const quickCheckoutTemplate = lastPurchase
    ? buildPricingTemplate({
        course,
        lastPurchaseMetadata: purchaseMetadata,
        lastPurchaseAddonsCsv: lastPurchase.addonsCsv,
        lastPurchaseParticipants: lastPurchase.participants,
        lastPurchaseCoupon: lastPurchase.coupon,
      })
    : null

  return {
    context: {
      courseSlug: context.courseSlug,
      courseTitle: course.title,
      date: context.date,
      time: context.time,
      durationMinutes: context.durationMinutes,
      startsAt: context.startsAt.toISOString(),
      endsAt: context.endsAt.toISOString(),
      checkInWindow: {
        isOpen: isWindowOpen,
        opensAt: context.opensAt.toISOString(),
        closesAt: context.closesAt.toISOString(),
      },
    },
    customer: { ...input.customer },
    package: preferredPackage
      ? {
          id: preferredPackage.id,
          packageId: preferredPackage.packageId,
          packageLabel: preferredPackage.packageLabel,
          isUnlimited: preferredPackage.isUnlimited,
          remainingCredits: preferredPackage.remainingCredits,
          expiresAt: preferredPackage.expiresAt ? preferredPackage.expiresAt.toISOString() : null,
          status: preferredPackage.status,
        }
      : null,
    packages: activePackages.map((item) => ({
      id: item.id,
      packageId: item.packageId,
      packageLabel: item.packageLabel,
      courseSlug: item.courseSlug,
      isUnlimited: item.isUnlimited,
      remainingCredits: item.remainingCredits,
      expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
      status: item.status,
    })),
    quickCheckout: quickCheckoutTemplate
      ? {
          ...quickCheckoutTemplate,
          sourcePurchaseId: lastPurchase?.id || null,
          sourcePurchaseAt: lastPurchase?.createdAt?.toISOString() || null,
        }
      : null,
    purchaseHistory: recentPurchases.map((purchase) => {
      const metadata = asRecord(purchase.metadata)
      return {
        id: purchase.id,
        createdAt: purchase.createdAt.toISOString(),
        amount: purchase.amount,
        currency: purchase.currency || "usd",
        status: purchase.status,
        participants: purchase.participants,
        serviceId: asText(metadata?.serviceId),
        packageId: asText(metadata?.packageId),
        addons: toStringArray(metadata?.addons),
        date: asText(metadata?.date),
        time: asText(metadata?.time),
      }
    }),
    hasPreviousPurchase: Boolean(lastPurchase),
    hasAnyCompletedPurchase: Boolean(anyCompletedPurchase),
    hasExistingPurchaseForSession,
    hasAnyActivePackage: allActivePackages.length > 0,
    consecutiveOffer: consecutiveOffer
      ? {
          ...consecutiveOffer,
          linkedCourseTime: consecutiveOffer.linkedCourseTime ?? undefined,
        }
      : null,
    ...(isTerminalFlow
      ? {
          // Not eligible when there's a usable package for this class — a package
          // holder must check in with their package, not be offered a repeat
          // purchase. Once the package is exhausted, preferredPackage is null and
          // Quick Repeat applies again.
          quickRepeatEligible: totalPurchaseCount >= QUICK_REPEAT_PURCHASE_THRESHOLD && !preferredPackage,
          lastPurchasePattern: {
            paymentChannel:
              lastPurchase && typeof asObject(lastPurchase.metadata)?.paymentChannel === "string"
                ? String(asObject(lastPurchase.metadata)?.paymentChannel)
                : PAYMENT_CHANNEL.CASH,
            courseSlug: context.courseSlug,
            amount: (course.enrollment?.services?.find((service: { id: string }) => service.id === "dropin")?.price ?? 0) * CENTS_PER_DOLLAR,
          },
        }
      : {}),
  }
}
