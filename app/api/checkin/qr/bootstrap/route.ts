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
import { findClerkUserByIdentifiers, resolveAvatarState } from "@/lib/clerk-users"
import { resolveKioskCustomerClerkAuth } from "@/lib/security/kiosk-customer-auth"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import { findConsecutiveLink, computeDiscountPercent } from "@/lib/course-links"
import { hasAttendedCourseToday, hasPurchaseForCourseToday } from "@/lib/checkin/consecutive-class"

export const runtime = "nodejs"

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

const normalizePhoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6 ? digits : ""
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
  }>
}) => {
  const ordered = [...input.packages].sort((a, b) => {
    const aPriority = a.courseSlug && a.courseSlug === input.courseSlug ? 0 : 1
    const bPriority = b.courseSlug && b.courseSlug === input.courseSlug ? 0 : 1
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
      flowContext === "kiosk_terminal"
        ? await resolveKioskCustomerClerkAuth(authResult.userId)
        : { userId: authResult.userId, clerkUser: null, blocked: false, blockedRole: null }
    const customerClerkUserId = kioskCustomerAuth.userId
    const kioskSessionResult = !customerClerkUserId && kioskSessionToken
      ? await resolveTerminalKioskSession(kioskSessionToken)
      : null

    if (!customerClerkUserId && !kioskSessionResult?.ok) {
      return NextResponse.json(
        {
          error:
            kioskCustomerAuth.blocked && flowContext === "kiosk_terminal"
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
        const client = await clerkClient()
        clerkUser = await client.users.getUser((customerClerkUserId || kioskUser?.clerkId) as string)
      }
      let avatarState = resolveAvatarState(clerkUser)
      if (avatarState.needsRefresh && clerkUser?.id) {
        const client = await clerkClient()
        clerkUser = await client.users.getUser(clerkUser.id)
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
          const client = await clerkClient()
          clerkUser = await client.users.getUser(clerkUser.id)
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

    const dbUser = customerClerkUserId
      ? await (async () => {
          return upsertUserByIdentifiers({
            clerkId: customerClerkUserId,
            email,
            phone,
            name,
          })
        })()
      : kioskSessionResult?.ok
        ? {
            id: kioskUser!.id,
            name: kioskUser!.name,
            email: kioskUser!.email,
            phone: kioskUser!.phone,
          }
        : null
    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    if (!firstName && !lastName) {
      const nameParts = splitName(dbUser.name || name)
      firstName = nameParts.firstName
      lastName = nameParts.lastName
    }

    const isTerminalFlow = flowContext === "kiosk_terminal"

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
          courseSlugA: linkedFromCourseSlug.toLowerCase(),
          active: true,
        },
      })

      if (links.length > 0) {
        const link = links[0]
        const linkedCourse = await getCatalogCourseBySlug(link.courseSlugB)

        const hasAttendedA = await hasAttendedCourseToday(dbUser.id, linkedFromCourseSlug, now)
        const hasAlreadyB = await hasPurchaseForCourseToday(dbUser.id, link.courseSlugB, now)

        if (linkedCourse && hasAttendedA && !hasAlreadyB) {
          const regularDropIn = linkedCourse.enrollment.services.find((s) => s.id === "dropin")?.price ?? 0
          const discountPercent = computeDiscountPercent(
            regularDropIn * 100,
            link.dropInConsecutiveCents
          )

          consecutiveOffer = {
            linkedCourseSlug: link.courseSlugB,
            linkedCourseTitle: linkedCourse.title,
            dropInConsecutiveCents: link.dropInConsecutiveCents,
            packageHolderConsecutiveCents: link.packageHolderConsecutiveCents,
            regularDropInCents: regularDropIn * 100,
            discountPercent,
            hasAttendedFirstClass: hasAttendedA,
          }
        }
      }
    }

    const [activePackages, recentPurchases, anyCompletedPurchase] = await Promise.all([
      prisma.packagePurchase.findMany({
        where: {
          userId: dbUser.id,
          status: "active",
          AND: [
            { OR: [{ courseSlug: null }, { courseSlug: context.courseSlug }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            { OR: [{ isUnlimited: true }, { remainingCredits: { gt: 0 } }] },
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
        },
        orderBy: [{ expiresAt: "asc" }, { purchasedAt: "desc" }],
        take: 10,
      }),
      prisma.purchase.findMany({
        where: {
          userId: dbUser.id,
          courseSlug: context.courseSlug,
          status: { in: SUCCESSFUL_PURCHASE_STATUSES },
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
    ])
    const lastPurchase = recentPurchases[0] || null

    // Check if user already has a successful purchase for this exact session (date + time)
    const hasExistingPurchaseForSession = recentPurchases.some((purchase) => {
      const metadata = toRecord(purchase.metadata)
      const purchaseDate = normalizeString(metadata?.date)
      const purchaseTime = normalizeString(metadata?.time)
      return purchaseDate === context.date && purchaseTime === context.time
    })

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

    if (flowContext === "kiosk_terminal" && kioskSessionResult?.ok && isPreparedCheckoutContextEnabled()) {
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
        ? { hasExistingPurchaseForSession }
        : {
            purchaseHistory,
            hasPreviousPurchase: Boolean(lastPurchase),
            hasAnyCompletedPurchase: Boolean(anyCompletedPurchase),
            hasExistingPurchaseForSession,
          }),
      consecutiveOffer,
    })
  } catch (error) {
    console.error("QR check-in bootstrap failed", error)
    return NextResponse.json({ error: "Unable to prepare QR check-in flow" }, { status: 500 })
  }
}
