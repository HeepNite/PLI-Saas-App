import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { parseQrCheckInContext, isQrCheckInWindowOpen } from "@/lib/checkin/qr"
import { resolveTerminalKioskSession } from "@/lib/checkin/kiosk-session"
import { createPreparedCheckoutContext, isPreparedCheckoutContextEnabled, snapshotPreparedCheckoutVerification } from "@/lib/checkout/prepared-context"
import type { CourseData } from "@/constants/courses"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"
import { findClerkUserByIdentifiers, getCachedClerkUser, resolveAvatarState } from "@/lib/clerk-users"
import { resolveKioskCustomerClerkAuth } from "@/lib/security/kiosk-customer-auth"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import { computeDiscountPercent } from "@/lib/course-links"
import { hasAttendedCourseToday, hasPurchaseForCourseToday } from "@/lib/checkin/consecutive-class"
import { getTimesForWeekday, parseScheduleRules } from "@/lib/schedule-rules"
import { normalizePhoneDigits } from "@/lib/shared"
import { FLOW_CONTEXT, PAYMENT_CHANNEL } from "@/lib/payment-constants"
import { getDayOfWeekCount } from "@/lib/checkin/day-of-week-counter"
import { getEtDateIso } from "@/lib/checkin/et-time"

export const runtime = "nodejs"

const DUPLICATE_BLOCKING_PURCHASE_STATUSES = [...SUCCESSFUL_PURCHASE_STATUSES, "pending"]

type ClerkUser = Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>

type CoursePricingTemplate = {
  serviceId: string
  packageId: string
  addons: string[]
  participants: number
  coupon: string
  amountCents: number
}

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const splitName = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: "", lastName: "" }
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  }
}

const toRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null

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
  const course = input.course

  const metadata = input.lastPurchaseMetadata
  const serviceIdCandidate = normalizeString(metadata?.serviceId)
  const packageIdCandidate = normalizeString(metadata?.packageId)
  const participantsCandidate = input.lastPurchaseParticipants && Number.isFinite(input.lastPurchaseParticipants)
    ? Math.max(1, Math.min(10, Math.round(input.lastPurchaseParticipants)))
    : 1
  const couponCandidate = normalizeString(input.lastPurchaseCoupon)
  const addonsFromMetadata = toStringArray(metadata?.addons)
  const addonsFromCsv = typeof input.lastPurchaseAddonsCsv === "string"
    ? input.lastPurchaseAddonsCsv
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : []
  const addonsRaw = addonsFromMetadata.length > 0 ? addonsFromMetadata : addonsFromCsv

  const service =
    course.enrollment.services.find((item) => item.id === serviceIdCandidate) ||
    course.enrollment.services.find((item) => item.id === "dropin") ||
    course.enrollment.services[0]
  if (!service) return null

  const pkg = packageIdCandidate ? course.enrollment.packages.find((item) => item.id === packageIdCandidate) : undefined
  const addons = (course.enrollment.addons || [])
    .filter((item) => addonsRaw.includes(item.id))
    .map((item) => item.id)

  const serviceCharge = pkg ? 0 : service.price || 0
  const packageCharge = pkg?.price || 0
  const addonsCharge = (course.enrollment.addons || [])
    .filter((item) => addons.includes(item.id))
    .reduce((sum, item) => sum + (item.price || 0), 0)
  const perPerson = serviceCharge + packageCharge + addonsCharge
  const subtotal = perPerson * participantsCandidate
  const discountPercent = pickPercentDiscount(couponCandidate)
  const discount = (subtotal * discountPercent) / 100
  const total = Math.max(0, subtotal - discount)
  const amountCents = Math.round(total * 100)

  if (!Number.isFinite(amountCents) || amountCents <= 0) return null

  return {
    serviceId: service.id,
    packageId: pkg?.id || "",
    addons,
    participants: participantsCandidate,
    coupon: couponCandidate,
    amountCents,
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
  const ordered = [...input.packages].sort((a, b) => {
    const aMatchesCourse =
      (a.courseSlug && a.courseSlug === input.courseSlug) ||
      (a.packagePlan?.courseSlugs?.includes(input.courseSlug) ?? false)
    const bMatchesCourse =
      (b.courseSlug && b.courseSlug === input.courseSlug) ||
      (b.packagePlan?.courseSlugs?.includes(input.courseSlug) ?? false)
    const aPriority = aMatchesCourse ? 0 : 1
    const bPriority = bMatchesCourse ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    const aExpires = a.expiresAt ? a.expiresAt.getTime() : Number.MAX_SAFE_INTEGER
    const bExpires = b.expiresAt ? b.expiresAt.getTime() : Number.MAX_SAFE_INTEGER
    return aExpires - bExpires
  })
  return ordered[0] || null
}

export async function POST(req: Request) {
  try {
    const startedAt = Date.now()
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("checkin:qr:bootstrap:post", getClientIp(req)),
      limit: 30,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const payload = toRecord(body)
    const authResult = await auth()
    const kioskSessionToken = normalizeString(payload?.kioskSessionToken)
    const flowContext = normalizeString(payload?.flowContext)
    const kioskCustomerAuth =
      flowContext === FLOW_CONTEXT.KIOSK_TERMINAL
        ? await resolveKioskCustomerClerkAuth(authResult.userId)
        : { userId: authResult.userId, clerkUser: null, blocked: false, blockedRole: null }
    const shouldPreferKioskSession = flowContext === FLOW_CONTEXT.KIOSK_TERMINAL && Boolean(kioskSessionToken)
    const customerClerkUserId = shouldPreferKioskSession ? null : kioskCustomerAuth.userId
    const shouldResolveKioskSession = shouldPreferKioskSession || (!customerClerkUserId && Boolean(kioskSessionToken))
    const kioskSessionResult = shouldResolveKioskSession
      ? await resolveTerminalKioskSession(kioskSessionToken)
      : null

    if (!customerClerkUserId && !kioskSessionResult?.ok) {
      return NextResponse.json(
        {
          error:
            kioskCustomerAuth.blocked && flowContext === FLOW_CONTEXT.KIOSK_TERMINAL
              ? "Kiosk customer identification is required before continuing."
              : kioskSessionResult?.error || "Unauthorized",
        },
        { status: kioskSessionResult?.status || 401 }
      )
    }

    const context = parseQrCheckInContext(
      {
        courseSlug: payload?.courseSlug,
        date: payload?.date,
        time: payload?.time,
        durationMinutes: payload?.durationMinutes,
      }
    )
    if ("status" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const now = new Date()
    const isWindowOpen = isQrCheckInWindowOpen(context, now)
    const course = await getCatalogCourseBySlug(context.courseSlug)
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const kioskUser = kioskSessionResult?.ok ? kioskSessionResult.session.user : null

    let clerkUser: ClerkUser | null = null
    let hasAvatar = false
    let email = kioskUser?.email || ""
    const kioskPhoneRaw = kioskUser?.phone || ""
    let phone = kioskUser ? normalizePhoneDigits(kioskUser.phone || "") : ""
    let firstName = ""
    let lastName = ""
    let name = kioskUser?.name || ""

    if (customerClerkUserId || kioskUser?.clerkId) {
      clerkUser = customerClerkUserId ? kioskCustomerAuth.clerkUser : null
      if (!clerkUser) {
        clerkUser = await getCachedClerkUser((customerClerkUserId || kioskUser?.clerkId) as string)
      }
      let avatarState = resolveAvatarState(clerkUser)
      if (avatarState.needsRefresh && clerkUser?.id) {
        clerkUser = await getCachedClerkUser(clerkUser.id)
        avatarState = resolveAvatarState(clerkUser)
      }
      hasAvatar = Boolean(avatarState.hasAvatar)
      email = clerkUser.primaryEmailAddress?.emailAddress || email
      const phoneRaw = clerkUser.primaryPhoneNumber?.phoneNumber || ""
      phone = normalizePhoneDigits(phoneRaw) || phone
      firstName = clerkUser.firstName?.trim() || firstName
      lastName = clerkUser.lastName?.trim() || lastName
      name = [firstName, lastName].filter(Boolean).join(" ").trim() || name
    } else if (email || kioskPhoneRaw) {
      clerkUser = await findClerkUserByIdentifiers({
        email,
        phone: kioskPhoneRaw,
      })
      if (clerkUser) {
        let avatarState = resolveAvatarState(clerkUser)
        if (avatarState.needsRefresh && clerkUser.id) {
          clerkUser = await getCachedClerkUser(clerkUser.id)
          avatarState = resolveAvatarState(clerkUser)
        }
        hasAvatar = Boolean(avatarState.hasAvatar)
        email = clerkUser.primaryEmailAddress?.emailAddress || email
        const phoneRaw = clerkUser.primaryPhoneNumber?.phoneNumber || ""
        phone = normalizePhoneDigits(phoneRaw) || phone
        firstName = clerkUser.firstName?.trim() || firstName
        lastName = clerkUser.lastName?.trim() || lastName
        name = [firstName, lastName].filter(Boolean).join(" ").trim() || name
      }
    }

    const dbUser = kioskSessionResult?.ok
      ? {
          id: kioskUser!.id,
          name: kioskUser!.name,
          email: kioskUser!.email,
          phone: kioskUser!.phone,
        }
      : customerClerkUserId
      ? await (async () => {
          return upsertUserByIdentifiers({
            clerkId: customerClerkUserId,
            email,
            phone,
            name,
            nameIsCanonical: true,
          })
        })()
      : null
    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    if (!firstName && !lastName) {
      const nameParts = splitName(dbUser.name || name)
      firstName = nameParts.firstName
      lastName = nameParts.lastName
    }

    const isTerminalFlow = flowContext === FLOW_CONTEXT.KIOSK_TERMINAL

    // ─── Consecutive offer detection ─────────────────────────
    const linkedFromCourseSlug = normalizeString(payload?.linkedFromCourseSlug)
    let consecutiveOffer: {
      linkedCourseSlug: string
      linkedCourseTitle: string
      dropInConsecutiveCents: number | null
      packageHolderConsecutiveCents: number | null
      regularDropInCents: number
      discountPercent: number
      hasAttendedFirstClass: boolean
    } | null = null

    if (linkedFromCourseSlug && dbUser) {
      const links = await prisma.courseLink.findMany({
        where: {
          OR: [
            { courseSlugA: linkedFromCourseSlug.toLowerCase() },
            { courseSlugB: linkedFromCourseSlug.toLowerCase() },
          ],
          active: true,
        },
      })

      if (links.length > 0) {
        const todayJsWeekday = (() => {
          const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
          const weekday = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            weekday: "short",
          }).format(now)
          return weekdayLabels.findIndex((label) => label === weekday)
        })()
        const aTimeMatch = /^(\d{2}):(\d{2})$/.exec(context.time || "")
        const aMinutes = aTimeMatch
          ? Number(aTimeMatch[1]) * 60 + Number(aTimeMatch[2])
          : null

        const candidates = await Promise.all(links.map(async (link) => {
          const linkedCourseSlug = link.courseSlugA === linkedFromCourseSlug.toLowerCase()
            ? link.courseSlugB
            : link.courseSlugA
          const linkedCourse = await getCatalogCourseBySlug(linkedCourseSlug)
          const hasAlreadyLinkedCourse = await hasPurchaseForCourseToday(dbUser.id, linkedCourseSlug, now)
          return { link, linkedCourseSlug, linkedCourse, hasAlreadyLinkedCourse }
        }))

        // Validate that course B is actually scheduled today and starts after A's
        // selected time. This prevents surfacing a consecutive offer for a class
        // that isn't scheduled today (e.g. Rueda on Mondays — only on Fridays).
        //
        // Only enforce the check when course B has day-specific schedule rules.
        // If no day-specific rules are present we cannot reliably determine
        // today's availability here, so we fall back to the prior behavior and
        // let downstream validation (attendance / check-in window) catch it.
        const hasAttendedA = await hasAttendedCourseToday(dbUser.id, linkedFromCourseSlug, now)
        const nextCandidate = candidates
          .filter((candidate) => candidate.linkedCourse && !candidate.hasAlreadyLinkedCourse)
          .map((candidate) => {
            const linkedScheduleRules = candidate.linkedCourse?.scheduleRules
            const parsedRules = parseScheduleRules(linkedScheduleRules)
            let linkedStartMinutes: number | null = null
            let isLinkedScheduledLaterToday = true
            if (parsedRules?.rules?.length) {
              const linkedTimesToday = getTimesForWeekday(linkedScheduleRules, todayJsWeekday) ?? []
              const laterTimes = linkedTimesToday
                .map((time) => {
                  const match = /^(\d{2}):(\d{2})$/.exec(time)
                  if (!match) return null
                  const minutes = Number(match[1]) * 60 + Number(match[2])
                  return aMinutes === null || minutes > aMinutes ? minutes : null
                })
                .filter((minutes): minutes is number => minutes !== null)
                .sort((left, right) => left - right)
              linkedStartMinutes = laterTimes[0] ?? null
              isLinkedScheduledLaterToday = laterTimes.length > 0
            }
            return { ...candidate, linkedStartMinutes, isLinkedScheduledLaterToday }
          })
          .filter((candidate) => candidate.isLinkedScheduledLaterToday)
          .sort((left, right) => (left.linkedStartMinutes ?? Number.MAX_SAFE_INTEGER) - (right.linkedStartMinutes ?? Number.MAX_SAFE_INTEGER))[0]

        if (nextCandidate?.linkedCourse && hasAttendedA) {
          const regularDropIn = nextCandidate.linkedCourse.enrollment.services.find((s) => s.id === "dropin")?.price ?? 0
          const discountPercent = computeDiscountPercent(
            regularDropIn * 100,
            nextCandidate.link.dropInConsecutiveCents
          )

          consecutiveOffer = {
            linkedCourseSlug: nextCandidate.linkedCourseSlug,
            linkedCourseTitle: nextCandidate.linkedCourse.title,
            dropInConsecutiveCents: nextCandidate.link.dropInConsecutiveCents,
            packageHolderConsecutiveCents: nextCandidate.link.packageHolderConsecutiveCents,
            regularDropInCents: regularDropIn * 100,
            discountPercent,
            hasAttendedFirstClass: hasAttendedA,
          }
        }
      }
    }

    // ─── Day-of-week counter query (terminal flow only) ──────────
    const currentDayOfWeek = (() => {
      const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
      }).format(now)
      return weekdayLabels.findIndex((label) => label === weekday)
    })()

    const [allActivePackages, recentPurchases, anyCompletedPurchase, dayOfWeekPurchaseCount] = await Promise.all([
      prisma.packagePurchase.findMany({
        where: {
          userId: dbUser.id,
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
        take: 10,
      }),
      prisma.purchase.findMany({
        where: {
          userId: dbUser.id,
          courseSlug: context.courseSlug,
          status: { in: DUPLICATE_BLOCKING_PURCHASE_STATUSES },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      isTerminalFlow
        ? Promise.resolve(null)
        : prisma.purchase.findFirst({
            where: {
              userId: dbUser.id,
              status: { in: SUCCESSFUL_PURCHASE_STATUSES },
            },
            select: { id: true },
          }),
      isTerminalFlow
        ? getDayOfWeekCount(dbUser.id, currentDayOfWeek)
        : Promise.resolve(0),
    ])
    const lastPurchase = recentPurchases[0] || null

    // Check if user already has an attendance record for this exact session.
    // A purchase alone does NOT mean "already checked in" — only an attendance
    // does. Web and QR purchases require explicit check-in at the studio;
    // kiosk purchases create attendance at purchase time.
    const existingSessionForCheckIn = await prisma.classSession.findUnique({
      where: {
        courseSlug_startsAt: {
          courseSlug: context.courseSlug,
          startsAt: context.startsAt,
        },
      },
      select: { id: true },
    })
    const hasExistingPurchaseForSession = existingSessionForCheckIn
      ? Boolean(await prisma.attendance.findUnique({
          where: {
            userId_sessionId: {
              userId: dbUser.id,
              sessionId: existingSessionForCheckIn.id,
            },
          },
          select: { id: true },
        }))
      : false

    const activePackages = allActivePackages.filter((item) =>
      item.courseSlug === null ||
      item.courseSlug === context.courseSlug ||
      (item.packagePlan?.courseSlugs?.includes(context.courseSlug) ?? false)
    )

    const preferredPackage = pickPreferredPackage({
      courseSlug: context.courseSlug,
      packages: activePackages,
    })

    const purchaseMetadata = toRecord(lastPurchase?.metadata)
    const quickTemplate = lastPurchase
      ? buildPricingTemplate({
          course,
          lastPurchaseMetadata: purchaseMetadata,
          lastPurchaseAddonsCsv: lastPurchase.addonsCsv,
          lastPurchaseParticipants: lastPurchase.participants,
          lastPurchaseCoupon: lastPurchase.coupon,
        })
      : null

    const packagesList = activePackages.map((item) => ({
      ...item,
      expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
    }))

    const purchaseHistory = recentPurchases.map((purchase) => {
      const metadata = toRecord(purchase.metadata)
      return {
        id: purchase.id,
        createdAt: purchase.createdAt.toISOString(),
        amount: purchase.amount,
        currency: purchase.currency || "usd",
        status: purchase.status,
        participants: purchase.participants,
        serviceId: normalizeString(metadata?.serviceId),
        packageId: normalizeString(metadata?.packageId),
        addons: toStringArray(metadata?.addons),
        date: normalizeString(metadata?.date),
        time: normalizeString(metadata?.time),
      }
    })

    if (flowContext === FLOW_CONTEXT.KIOSK_TERMINAL && kioskSessionResult?.ok && isPreparedCheckoutContextEnabled()) {
      await createPreparedCheckoutContext({
        terminalId: kioskSessionResult.terminalAuth.terminal.id,
        kioskSessionId: kioskSessionResult.session.id,
        validation: {
          courseSlug: context.courseSlug,
          date: context.date,
          time: context.time,
          durationMinutes: context.durationMinutes,
        },
        preparedAccount: {
          userId: dbUser.id,
          clerkUser: null,
          resolvedUserId: customerClerkUserId || kioskUser?.clerkId || clerkUser?.id || null,
          identity: {
            resolvedEmail: email || dbUser.email || "",
            phoneRaw: kioskPhoneRaw || clerkUser?.primaryPhoneNumber?.phoneNumber || dbUser.phone || "",
            phoneNormalized: phone || "",
          },
          account: {
            clerkUserId: customerClerkUserId || kioskUser?.clerkId || clerkUser?.id || null,
            created: false,
            requiresSignIn: false,
            hasAvatar,
          },
        },
        verification: snapshotPreparedCheckoutVerification({
          hasVerifiedPhone:
            clerkUser?.phoneNumbers?.some((entry) => entry.id === clerkUser.primaryPhoneNumberId && entry.verification?.status === "verified") ||
            clerkUser?.phoneNumbers?.some((entry) => entry.verification?.status === "verified") ||
            false,
        }),
      })
    }

    const quickRepeatEligible = dayOfWeekPurchaseCount >= 3

    // Extract last purchase pattern for quick-repeat overlay (terminal flow only)
    const lastPurchasePattern = isTerminalFlow && lastPurchase
      ? (() => {
          const meta = toRecord(lastPurchase.metadata)
          const paymentChannel =
            typeof meta?.paymentChannel === "string" && meta.paymentChannel
              ? meta.paymentChannel
              : PAYMENT_CHANNEL.CASH
          return {
            paymentChannel,
            courseSlug: lastPurchase.courseSlug,
            amount: lastPurchase.amount,
          }
        })()
      : null

    const terminalPayload = isTerminalFlow

    console.info("[staff-terminal-checkout-latency] bootstrap", {
      flowContext,
      source: terminalPayload ? "prepared_context_created" : "standard_bootstrap",
      durationMs: Date.now() - startedAt,
      hasQuickCheckout: Boolean(quickTemplate),
    })

    return NextResponse.json({
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
      customer: {
        userId: dbUser.id,
        clerkUserId: customerClerkUserId || kioskUser?.clerkId || "",
        firstName,
        lastName,
        name: dbUser.name || name,
        email: email || dbUser.email || "",
        phone: phone || dbUser.phone || "",
        hasAvatar,
      },
      package: preferredPackage
        ? {
            ...preferredPackage,
            expiresAt: preferredPackage.expiresAt ? preferredPackage.expiresAt.toISOString() : null,
          }
        : null,
      ...(terminalPayload ? {} : { packages: packagesList }),
      quickCheckout: quickTemplate
        ? {
            ...quickTemplate,
            currency: "usd",
            sourcePurchaseId: lastPurchase?.id || null,
            sourcePurchaseAt: lastPurchase?.createdAt?.toISOString() || null,
          }
        : null,
      ...(terminalPayload
        ? {
            hasExistingPurchaseForSession,
            dayOfWeekPurchaseCount,
            quickRepeatEligible,
            lastPurchasePattern,
          }
        : {
            purchaseHistory,
            hasPreviousPurchase: Boolean(lastPurchase),
            hasAnyCompletedPurchase: Boolean(anyCompletedPurchase),
            hasExistingPurchaseForSession,
          }),
      hasAnyActivePackage: allActivePackages.length > 0,
      consecutiveOffer,
    })
  } catch (error) {
    console.error("QR check-in bootstrap failed", error)
    return NextResponse.json({ error: "Unable to prepare QR check-in flow" }, { status: 500 })
  }
}
