import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { createKioskIdentificationSession } from "@/lib/checkin/kiosk-session"
import {
  isTerminalBlocked,
  clearTerminalMisses,
  recordTerminalMiss,
} from "@/lib/security/student-pin"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { resolveKioskPinThrottleSeverity, getKioskPinThrottleMessage } from "@/lib/security/kiosk-pin-throttle"
import { asRecord, asText, normalizePhoneDigits } from "@/lib/shared"
import { buildExactPhoneLookup, parseServerPhoneInput } from "@/lib/phone"
import { parseQrCheckInContext, isTerminalCheckInAllowed } from "@/lib/checkin/qr"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"
import { findClerkUserByIdentifiers, resolveAvatarState, type ClerkUser } from "@/lib/clerk-users"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import { resolveConsecutiveOffer } from "@/lib/checkin/consecutive-offer"
import type { CourseData } from "@/constants/courses"
import type {
  FastPathResponse,
  FullPathResponse,
  PackageInfo,
  BootstrapContext,
} from "@/lib/checkin/types/identify-and-bootstrap"

export const runtime = "nodejs"

const DUPLICATE_BLOCKING_PURCHASE_STATUSES = [...SUCCESSFUL_PURCHASE_STATUSES, "pending"]
// Quick Repeat (terminal fast check-in) eligibility: >= 3 successful purchases.
// Mirrors QUICK_REPEAT_PURCHASE_THRESHOLD in lib/checkin/qr-decision.ts.
const QUICK_REPEAT_PURCHASE_THRESHOLD = 3
const CENTS_PER_DOLLAR = 100

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[]
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

const splitName = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: "", lastName: "" }
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  }
}

const pickPercentDiscount = (coupon: string) => {
  const normalized = coupon.trim().toUpperCase()
  if (normalized === "PLI10") return 10
  if (normalized === "PLI20") return 20
  return 0
}

type CoursePricingTemplate = {
  serviceId: string
  packageId: string
  addons: string[]
  participants: number
  coupon: string
  amountCents: number
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
  const serviceIdCandidate = asText(metadata?.serviceId)
  const packageIdCandidate = asText(metadata?.packageId)
  const participantsCandidate =
    input.lastPurchaseParticipants && Number.isFinite(input.lastPurchaseParticipants)
      ? Math.max(1, Math.min(10, Math.round(input.lastPurchaseParticipants)))
      : 1
  const couponCandidate = asText(input.lastPurchaseCoupon)
  const addonsFromMetadata = toStringArray(metadata?.addons)
  const addonsFromCsv =
    typeof input.lastPurchaseAddonsCsv === "string"
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

  const pkg = packageIdCandidate
    ? course.enrollment.packages.find((item) => item.id === packageIdCandidate)
    : undefined
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

const serializePackage = (pkg: {
  id: string
  packageId: string
  packageLabel: string | null
  courseSlug: string | null
  isUnlimited: boolean
  remainingCredits: number | null
  expiresAt: Date | null
  status: string
  packagePlan?: { courseSlugs: string[] } | null
}): PackageInfo => ({
  id: pkg.id,
  packageId: pkg.packageId,
  packageLabel: pkg.packageLabel,
  courseSlug: pkg.courseSlug,
  isUnlimited: pkg.isUnlimited,
  remainingCredits: pkg.remainingCredits,
  expiresAt: pkg.expiresAt ? pkg.expiresAt.toISOString() : null,
  status: pkg.status,
})

/**
 * Resolves the Clerk user for a DB user during kiosk bootstrap.
 *
 * A stale/cross-instance `dbUser.clerkId` (e.g. during the dev→prod Clerk
 * instance migration window) must never surface a 500 to the kiosk client.
 * If the direct getUser-by-id lookup fails, fall back to the same
 * identifier-based lookup already used when no clerkId is stored at all.
 */
const resolveClerkUserForBootstrap = async (dbUser: {
  clerkId: string | null
  email: string | null
  phone: string | null
}): Promise<ClerkUser | null> => {
  if (dbUser.clerkId) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server")
      const client = await clerkClient()
      return await client.users.getUser(dbUser.clerkId)
    } catch {
      return findClerkUserByIdentifiers({
        email: dbUser.email ?? undefined,
        phone: dbUser.phone ?? undefined,
      })
    }
  }

  return findClerkUserByIdentifiers({
    email: dbUser.email ?? undefined,
    phone: dbUser.phone ?? undefined,
  })
}

const buildBootstrapContext = (
  context: ReturnType<typeof parseQrCheckInContext> & { courseTitle?: string },
  courseTitle: string,
  isWindowOpen: boolean
): BootstrapContext => ({
  courseSlug: "courseSlug" in context ? context.courseSlug : "",
  courseTitle,
  date: "date" in context ? context.date : "",
  time: "time" in context ? context.time : "",
  durationMinutes: "durationMinutes" in context ? context.durationMinutes : 60,
  startsAt: "startsAt" in context ? context.startsAt.toISOString() : "",
  endsAt: "endsAt" in context ? context.endsAt.toISOString() : "",
  checkInWindow: {
    isOpen: isWindowOpen,
    opensAt: "opensAt" in context ? context.opensAt.toISOString() : "",
    closesAt: "closesAt" in context ? context.closesAt.toISOString() : "",
  },
})

export async function POST(req: Request) {
  const startedAt = Date.now()

  // ─── Auth: single call, result passed downstream ────────────
  const terminalAuth = await authorizeStaffTerminalSession({ touchLastSeen: true })
  if (!terminalAuth.ok) {
    return NextResponse.json(
      { error: "Terminal session required for kiosk identification." },
      { status: 401 }
    )
  }

  // ─── Rate limit ─────────────────────────────────────────────
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey(
      `checkin:phone:identify-and-bootstrap:${terminalAuth.sessionId}`,
      getClientIp(req)
    ),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  // ─── Parse body ─────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = asRecord(body)
  const rawPhone = typeof payload?.phone === "string" ? payload.phone.trim() : ""
  let phoneLookup: ReturnType<typeof buildExactPhoneLookup>
  try {
    const phoneResult = parseServerPhoneInput(rawPhone)

    if (!phoneResult.ok) {
      return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 })
    }
    phoneLookup = buildExactPhoneLookup(phoneResult.phone)
  } catch {
    return NextResponse.json({ error: "Unable to identify this phone number." }, { status: 500 })
  }

  // ─── Parse class context ────────────────────────────────────
  const context = parseQrCheckInContext({
    courseSlug: payload?.courseSlug,
    date: payload?.date,
    time: payload?.time,
    durationMinutes: payload?.durationMinutes,
  })
  if ("status" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status })
  }

  // ─── Terminal block check ───────────────────────────────────
  const terminalState = await isTerminalBlocked(prisma, terminalAuth.terminal.id)
  if (terminalState.blocked) {
    const severity = resolveKioskPinThrottleSeverity({
      missCount: terminalState.missCount,
      blockedUntil: terminalState.blockedUntil,
    })
    return NextResponse.json(
      {
        identified: false,
        terminalBlocked: terminalState.terminalBlocked,
        blockedUntil: terminalState.blockedUntil?.toISOString() || null,
        attemptsRemaining: terminalState.attemptsRemaining,
        severity,
        message: getKioskPinThrottleMessage(severity),
      },
      { status: terminalState.terminalBlocked ? 429 : 423 }
    )
  }

  // ─── Identify user by phone ─────────────────────────────────
  const dbUsers = await prisma.user.findMany({
    where: { phone: { in: phoneLookup.digitCandidates } },
    select: { id: true, name: true, email: true, phone: true, clerkId: true },
    take: 2,
  })
  if (dbUsers.length > 1) {
    return NextResponse.json(
      { identified: false, message: "Unable to identify this phone number." },
      { status: 409 }
    )
  }
  const dbUser = dbUsers[0] || null

  if (!dbUser) {
    const now = new Date()
    const miss = await recordTerminalMiss(prisma, terminalAuth.terminal.id, now)
    const severity = resolveKioskPinThrottleSeverity({
      missCount: miss.missCount,
      blockedUntil: miss.blockedUntil,
      now,
    })
    return NextResponse.json(
      {
        identified: false,
        terminalBlocked: miss.terminalBlocked,
        blockedUntil: miss.blockedUntil?.toISOString() || null,
        attemptsRemaining: miss.attemptsRemaining,
        severity,
        message: getKioskPinThrottleMessage(severity),
      },
      { status: miss.terminalBlocked ? 429 : miss.cooldownActive ? 423 : 404 }
    )
  }

  // ─── Create kiosk session + clear misses (transaction) ──────
  const kioskSession = await prisma.$transaction(async (tx) => {
    const session = await createKioskIdentificationSession(tx as typeof prisma, {
      terminalId: terminalAuth.terminal.id,
      userId: dbUser.id,
      credentialKind: "phone",
      requiresPinRotation: false,
    })
    await clearTerminalMisses(tx as typeof prisma, terminalAuth.terminal.id)
    return session
  })

  const now = new Date()
  const isWindowOpen = isTerminalCheckInAllowed(context, now)

  // ─── Fast-path detection ─────────────────────────────────────
  const courseSlug = context.courseSlug

  const [activePackageForCourse, existingSessionResult] = await Promise.all([
    prisma.packagePurchase.findFirst({
      where: {
        userId: dbUser.id,
        status: "active",
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          {
            OR: [
              { isUnlimited: true, remainingCredits: null },
              { remainingCredits: { gt: 0 } },
            ],
          },
          {
            OR: [
              { courseSlug: courseSlug },
              { packagePlan: { courseSlugs: { has: courseSlug } } },
            ],
          },
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
    }),
    prisma.classSession.findUnique({
      where: {
        courseSlug_startsAt: {
          courseSlug: courseSlug,
          startsAt: context.startsAt,
        },
      },
      select: { id: true },
    }),
  ])

  const isFastPath = Boolean(activePackageForCourse) && Boolean(existingSessionResult)

  if (isFastPath && activePackageForCourse && existingSessionResult) {
    // Check for existing attendance (already checked in)
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        userId_sessionId: {
          userId: dbUser.id,
          sessionId: existingSessionResult.id,
        },
      },
      select: { id: true },
    })

    const bootstrapContext = buildBootstrapContext(
      context,
      courseSlug, // will be replaced with course title below if needed
      isWindowOpen
    )

    // Get course title for context (cheap lookup from static catalog)
    const courseData = await getCatalogCourseBySlug(courseSlug)
    const courseTitle = courseData?.title ?? courseSlug
    bootstrapContext.courseTitle = courseTitle

    const fastResponse: FastPathResponse = {
      identified: true,
      path: "fast",
      sessionToken: kioskSession.id,
      sessionExpiresAt: kioskSession.expiresAt.toISOString(),
      customer: {
        userId: dbUser.id,
        name: dbUser.name ?? "",
        email: dbUser.email ?? "",
        phone: normalizePhoneDigits(dbUser.phone ?? ""),
      },
      package: serializePackage(activePackageForCourse),
      context: bootstrapContext,
      hasExistingPurchaseForSession: Boolean(existingAttendance),
      hasAnyActivePackage: true,
      consecutiveOffer: null,
      quickCheckout: null,
    }

    console.info("[kiosk-phone-identify-bootstrap] response", {
      path: "fast",
      durationMs: Date.now() - startedAt,
      userId: dbUser.id,
      courseSlug,
    })

    return NextResponse.json(fastResponse)
  }

  // ─── Full path ──────────────────────────────────────────────
  const linkedFromCourseSlug = asText(payload?.linkedFromCourseSlug)

  const todayJsWeekday = (() => {
    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    }).format(now)
    return weekdayLabels.findIndex((label) => label === weekday)
  })()

  const aTimeMatch = /^(\d{2}):(\d{2})$/.exec(context.time || "")
  const aMinutes = aTimeMatch ? Number(aTimeMatch[1]) * 60 + Number(aTimeMatch[2]) : null

  const [
    allActivePackagesResult,
    recentPurchasesResult,
    classSessionResult,
    consecutiveOfferResult,
    courseDataResult,
    clerkUserResult,
  ] = await Promise.all([
    prisma.packagePurchase.findMany({
      where: {
        userId: dbUser.id,
        status: "active",
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          {
            OR: [
              { isUnlimited: true, remainingCredits: null },
              { remainingCredits: { gt: 0 } },
            ],
          },
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
        courseSlug: courseSlug,
        status: { in: DUPLICATE_BLOCKING_PURCHASE_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    existingSessionResult
      ? Promise.resolve(existingSessionResult)
      : prisma.classSession.findUnique({
          where: {
            courseSlug_startsAt: {
              courseSlug: courseSlug,
              startsAt: context.startsAt,
            },
          },
          select: { id: true },
        }),
    linkedFromCourseSlug
      ? resolveConsecutiveOffer({
          userId: dbUser.id,
          linkedFromCourseSlug,
          todayJsWeekday,
          courseTimeMinutes: aMinutes,
          now,
        })
      : Promise.resolve(null),
    getCatalogCourseBySlug(courseSlug),
    resolveClerkUserForBootstrap(dbUser),
  ])

  const classSession = classSessionResult
  let clerkUser = clerkUserResult

  // Resolve avatar state — refresh once if needed. A refresh failure is
  // treated as transient (the id being refreshed was already resolved by
  // the guarded lookup above): keep the current clerkUser, skip the
  // refresh, and fall back to the pre-refresh avatar state. Do NOT
  // re-invoke findClerkUserByIdentifiers here — that would be a redundant
  // re-lookup, not a recovery.
  let hasAvatar = false
  if (clerkUser) {
    const avatarState = resolveAvatarState(clerkUser)
    if (avatarState.needsRefresh && clerkUser.id) {
      try {
        const { clerkClient } = await import("@clerk/nextjs/server")
        const client = await clerkClient()
        clerkUser = await client.users.getUser(clerkUser.id)
        hasAvatar = Boolean(resolveAvatarState(clerkUser).hasAvatar)
      } catch {
        hasAvatar = Boolean(avatarState.hasAvatar)
      }
    } else {
      hasAvatar = Boolean(avatarState.hasAvatar)
    }
  }

  const email = clerkUser?.primaryEmailAddress?.emailAddress || dbUser.email || ""
  const phoneRaw = clerkUser?.primaryPhoneNumber?.phoneNumber || dbUser.phone || ""
  const phoneNormalized = normalizePhoneDigits(phoneRaw)
  const firstName = clerkUser?.firstName?.trim() || ""
  const lastName = clerkUser?.lastName?.trim() || ""
  const nameParts = splitName(dbUser.name || [firstName, lastName].filter(Boolean).join(" "))
  const resolvedFirstName = firstName || nameParts.firstName
  const resolvedLastName = lastName || nameParts.lastName
  const resolvedName =
    [resolvedFirstName, resolvedLastName].filter(Boolean).join(" ").trim() ||
    dbUser.name ||
    ""

  const activePackages = allActivePackagesResult.filter(
    (item) =>
      item.courseSlug === null ||
      item.courseSlug === courseSlug ||
      (item.packagePlan?.courseSlugs?.includes(courseSlug) ?? false)
  )

  const preferredPackage = pickPreferredPackage({
    courseSlug,
    packages: activePackages,
  })

  // Check attendance for session
  const hasExistingPurchaseForSession =
    classSession
      ? Boolean(
          await prisma.attendance.findUnique({
            where: {
              userId_sessionId: { userId: dbUser.id, sessionId: classSession.id },
            },
            select: { id: true },
          })
        )
      : false

  const lastPurchase = recentPurchasesResult[0] || null
  const purchaseMetadata = asRecord(lastPurchase?.metadata)
  const quickTemplate =
    lastPurchase && courseDataResult
      ? buildPricingTemplate({
          course: courseDataResult,
          lastPurchaseMetadata: purchaseMetadata,
          lastPurchaseAddonsCsv: lastPurchase.addonsCsv,
          lastPurchaseParticipants: lastPurchase.participants,
          lastPurchaseCoupon: lastPurchase.coupon,
        })
      : null

  const bootstrapContext = buildBootstrapContext(
    context,
    courseDataResult?.title ?? courseSlug,
    isWindowOpen
  )

  // Quick Repeat (terminal fast check-in): a returning customer with >= 3
  // successful purchases skips the regular flow and gets the "same as always"
  // overlay. The terminal reads bootstrap.quickRepeatEligible directly from this
  // response (it does not re-fetch /api/checkin/qr/bootstrap), so it must be
  // computed here. Additive: <3 purchases -> false -> unchanged behavior.
  const successfulPurchaseCount = await prisma.purchase.count({
    where: { userId: dbUser.id, status: { in: SUCCESSFUL_PURCHASE_STATUSES } },
  })
  // Not eligible when there's a usable package for this class — a package holder
  // checks in with their package, not a repeat purchase. Once the package is
  // exhausted (preferredPackage null), Quick Repeat applies again.
  const quickRepeatEligible = successfulPurchaseCount >= QUICK_REPEAT_PURCHASE_THRESHOLD && !preferredPackage
  const lastPurchasePattern = {
    paymentChannel:
      typeof purchaseMetadata?.paymentChannel === "string"
        ? String(purchaseMetadata.paymentChannel)
        : "cash",
    courseSlug,
    amount:
      (courseDataResult?.enrollment?.services?.find((service: { id: string }) => service.id === "dropin")?.price ?? 0) *
      CENTS_PER_DOLLAR,
  }

  const fullResponse: FullPathResponse = {
    identified: true,
    path: "full",
    sessionToken: kioskSession.id,
    sessionExpiresAt: kioskSession.expiresAt.toISOString(),
    customer: {
      userId: dbUser.id,
      clerkUserId: clerkUser?.id ?? "",
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      name: resolvedName,
      email,
      phone: phoneNormalized,
      hasAvatar,
    },
    package: preferredPackage ? serializePackage(preferredPackage) : null,
    context: bootstrapContext,
    hasExistingPurchaseForSession,
    hasAnyActivePackage: allActivePackagesResult.length > 0,
    consecutiveOffer: consecutiveOfferResult,
    quickCheckout: quickTemplate
      ? {
          ...quickTemplate,
          currency: "usd",
          sourcePurchaseId: lastPurchase?.id || null,
          sourcePurchaseAt: lastPurchase?.createdAt?.toISOString() || null,
        }
      : null,
    quickRepeatEligible,
    lastPurchasePattern,
  }

  console.info("[kiosk-phone-identify-bootstrap] response", {
    path: "full",
    durationMs: Date.now() - startedAt,
    userId: dbUser.id,
    courseSlug,
  })

  return NextResponse.json(fullResponse)
}
