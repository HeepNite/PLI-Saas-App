import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"
import { buildQrBootstrapDecisionResponse, isQrDecisionResponseError } from "@/lib/checkin/qr-decision"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { parseQrCheckInContext } from "@/lib/checkin/qr"
import { resolveTerminalKioskSession } from "@/lib/checkin/kiosk-session"
import { createPreparedCheckoutContext, isPreparedCheckoutContextEnabled, snapshotPreparedCheckoutVerification } from "@/lib/checkout/prepared-context"
import { findClerkUserByIdentifiers, getCachedClerkUser, resolveAvatarState } from "@/lib/clerk-users"
import { resolveKioskCustomerClerkAuth } from "@/lib/security/kiosk-customer-auth"
import { getNestGatewayQrDecision } from "@/lib/nest-gateway/client"
import type { CheckinQrDecisionGatewayRequest } from "@/lib/nest-gateway/contracts/checkin-qr-decision"
import { asRecord, asText, normalizePhoneDigits } from "@/lib/shared"
import { FLOW_CONTEXT } from "@/lib/payment-constants"

export const runtime = "nodejs"

type ClerkUser = Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>

const splitName = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: "", lastName: "" }
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  }
}

type TerminalSafeBootstrapResponse = Omit<
  BootstrapResponse,
  | "package"
  | "packages"
  | "quickCheckout"
  | "purchaseHistory"
  | "hasPreviousPurchase"
  | "hasAnyCompletedPurchase"
  | "hasExistingPurchaseForSession"
  | "hasAnyActivePackage"
  | "dayOfWeekPurchaseCount"
  | "quickRepeatEligible"
  | "lastPurchasePattern"
> & {
  package?: undefined
  packages?: undefined
  quickCheckout?: undefined
  purchaseHistory?: undefined
  hasPreviousPurchase?: undefined
  hasAnyCompletedPurchase?: undefined
  hasExistingPurchaseForSession?: undefined
  hasAnyActivePackage?: undefined
  dayOfWeekPurchaseCount?: undefined
  quickRepeatEligible?: undefined
  lastPurchasePattern?: undefined
}

const createTerminalSafeBootstrapResponse = (bootstrap: BootstrapResponse): TerminalSafeBootstrapResponse => ({
  context: bootstrap.context,
  customer: bootstrap.customer,
  consecutiveOffer: bootstrap.consecutiveOffer,
})


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

    const payload = asRecord(body)
    const authResult = await auth()
    const kioskSessionToken = asText(payload?.kioskSessionToken)
    const flowContext = asText(payload?.flowContext)
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

    const decisionRequest: CheckinQrDecisionGatewayRequest = {
      courseSlug: context.courseSlug,
      date: context.date,
      time: context.time,
      durationMinutes: context.durationMinutes,
      flowContext,
      linkedFromCourseSlug: asText(payload?.linkedFromCourseSlug) || undefined,
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
    }

    const gatewayResult = await getNestGatewayQrDecision({
      payload: decisionRequest,
      requestId: req.headers.get("x-request-id") ?? undefined,
    })

    let bootstrap: BootstrapResponse
    if ("ok" in gatewayResult && !gatewayResult.ok) {
      try {
        bootstrap = await buildQrBootstrapDecisionResponse(decisionRequest)
      } catch (error) {
        if (isQrDecisionResponseError(error)) {
          return NextResponse.json({ error: error.message }, { status: error.status })
        }

        throw error
      }
    } else {
      bootstrap = gatewayResult as BootstrapResponse
    }

    if (flowContext === FLOW_CONTEXT.KIOSK_TERMINAL && kioskSessionResult?.ok && isPreparedCheckoutContextEnabled()) {
      await createPreparedCheckoutContext({
        terminalId: kioskSessionResult.terminalAuth.terminal.id,
        kioskSessionId: kioskSessionResult.session.id,
        validation: {
          courseSlug: bootstrap.context.courseSlug,
          date: bootstrap.context.date,
          time: bootstrap.context.time,
          durationMinutes: bootstrap.context.durationMinutes,
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
            hasAvatar: bootstrap.customer.hasAvatar,
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
    })

    return NextResponse.json(
      terminalPayload ? createTerminalSafeBootstrapResponse(bootstrap) : bootstrap
    )
  } catch (error) {
    console.error("QR check-in bootstrap failed", error)
    return NextResponse.json({ error: "Unable to prepare QR check-in flow" }, { status: 500 })
  }
}
