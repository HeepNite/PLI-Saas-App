import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { findClerkUserByIdentifiers } from "@/lib/clerk-users"
import { buildExactPhoneLookup, parseServerPhoneInput } from "@/lib/phone"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import { asText } from "@/lib/shared"

export const runtime = "nodejs"

type VerifyOutcome = "eligible" | "requires_sms_verification" | "existing_user" | "fallback_regular"

type ExistingIdentifier = "phone" | "email" | "both"

type VerifyResponse = {
  outcome: VerifyOutcome
  reason: string
  message?: string
  eligibleForNewStudent: boolean
  requiresSmsVerification: boolean
  shouldFallbackToRegular: boolean
  requiresLogin: boolean
  sessionOwnsPhone?: boolean
  exists?: boolean
  hasCompletedPurchase?: boolean
  existingIdentifier?: ExistingIdentifier
  sources?: {
    clerk?: boolean
    databaseUser?: boolean
    completedPurchase?: boolean
  }
}
const resolveExistingIdentifier = (
  phoneMatch: boolean,
  emailMatch: boolean
): ExistingIdentifier | undefined => {
  if (phoneMatch && emailMatch) return "both"
  if (phoneMatch) return "phone"
  if (emailMatch) return "email"
  return undefined
}

const sessionOwnsVerifiedPhone = async (sessionUserId: string, canonicalPhone: string) => {
  try {
    const client = await clerkClient()
    const sessionUser = await client.users.getUser(sessionUserId)
    return sessionUser.phoneNumbers.some(
      (phone) =>
        phone.verification?.status === "verified" && phone.phoneNumber === canonicalPhone
    )
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("checkin:qr:new-student:verify:post", getClientIp(req)),
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

    const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null
    const phoneInput = asText(payload?.phone)
    const emailInput = asText(payload?.email)

    const phoneResult = phoneInput ? parseServerPhoneInput(phoneInput) : null
    if (phoneResult && !phoneResult.ok) {
      return NextResponse.json({ error: "Missing or invalid phone or email" }, { status: 400 })
    }
    const parsedPhone = phoneResult?.ok ? phoneResult.phone : null
    const phoneLookup = parsedPhone ? buildExactPhoneLookup(parsedPhone) : null

    if (!parsedPhone && !emailInput) {
      return NextResponse.json({ error: "Missing or invalid phone or email" }, { status: 400 })
    }

    // Current session — used to detect if the session already owns the phone
    const { userId: sessionUserId } = await auth()

    // Clerk lookup by phone and/or email
    const existingClerkUser = await findClerkUserByIdentifiers({
      phone: phoneLookup?.e164,
      email: emailInput || undefined,
    })

    // Build DB identity filters from exact phone candidates and email
    const identityFilters: Array<Record<string, unknown>> = []
    if (phoneLookup) identityFilters.push({ phone: { in: phoneLookup.digitCandidates } })
    if (existingClerkUser?.id) identityFilters.push({ clerkId: existingClerkUser.id })
    if (emailInput) identityFilters.push({ email: { equals: emailInput, mode: "insensitive" } })

    let existingDbUser = null as null | { id: string; clerkId: string | null; email: string; phone: string | null }

    if (identityFilters.length > 0) {
      const existingDbUsers = await prisma.user.findMany({
        where: { OR: identityFilters },
        select: { id: true, clerkId: true, email: true, phone: true },
        take: 2,
      })
      if (existingDbUsers.length > 1) {
        return NextResponse.json({ error: "Unable to verify customer identity" }, { status: 409 })
      }
      existingDbUser = existingDbUsers[0] || null
    }

    const exists = Boolean(existingClerkUser || existingDbUser)

    // Determine which identifiers matched
    const phoneMatch = Boolean(
      existingClerkUser || (existingDbUser?.phone && phoneLookup?.digitCandidates.includes(existingDbUser.phone))
    )
    const emailMatch = Boolean(
      existingDbUser?.email && emailInput && existingDbUser.email.toLowerCase() === emailInput.toLowerCase()
    )

    const existingIdentifier = resolveExistingIdentifier(phoneMatch, emailMatch)

    // --- Unified outcome contract ---

    // Purchase-history check runs FIRST to prevent session shortcut from bypassing
    // returning-customer detection. A staff session matching the phone must still
    // see fallback_regular if the phone owner has completed purchases.
    const purchaseFilters: Array<Record<string, unknown>> = []
    if (existingClerkUser?.id) purchaseFilters.push({ user: { clerkId: existingClerkUser.id } })
    if (existingDbUser?.id) purchaseFilters.push({ userId: existingDbUser.id })
    if (phoneLookup) purchaseFilters.push({ phone: { in: phoneLookup.digitCandidates } })
    if (emailInput) purchaseFilters.push({ email: { equals: emailInput, mode: "insensitive" } })


    let hasCompletedPurchase = false
    if (purchaseFilters.length > 0 && process.env.DATABASE_URL) {
      const completedPurchase = await prisma.purchase.findFirst({
        where: { OR: purchaseFilters, status: { in: SUCCESSFUL_PURCHASE_STATUSES } },
        select: { id: true },
      })
      hasCompletedPurchase = Boolean(completedPurchase)
    }

    if (hasCompletedPurchase) {
      // Returning customer — fallback to regular price (even if session matches)
      const response: VerifyResponse = {
        outcome: "fallback_regular",
        reason: "existing_customer",
        message: "This phone number is associated with an existing customer. Regular pricing will be applied.",
        eligibleForNewStudent: false,
        requiresSmsVerification: false,
        shouldFallbackToRegular: true,
        requiresLogin: true,
        exists: true,
        hasCompletedPurchase: true,
        existingIdentifier,
        sources: {
          clerk: Boolean(existingClerkUser),
          databaseUser: Boolean(existingDbUser),
          completedPurchase: true,
        },
      }
      return NextResponse.json(response)
    }

    // Case 1: No completed purchase and the matched Clerk identity is the active
    // session with a verified copy of the submitted phone → eligible (skip SMS).
    const sessionOwnsPhone =
      Boolean(sessionUserId && existingClerkUser?.id === sessionUserId) &&
      await sessionOwnsVerifiedPhone(sessionUserId as string, phoneLookup?.e164 || "")
    if (sessionOwnsPhone) {
      const response: VerifyResponse = {
        outcome: "eligible",
        reason: "verified_phone_session",
        eligibleForNewStudent: true,
        requiresSmsVerification: false,
        shouldFallbackToRegular: false,
        requiresLogin: false,
        sessionOwnsPhone: true,
        existingIdentifier,
        sources: { clerk: true },
      }
      return NextResponse.json(response)
    }

    // Case 3: No completed purchases — requires SMS verification.
    // Covers both truly new (no identity) and existing-but-no-purchases.
    const response: VerifyResponse = {
      outcome: "requires_sms_verification",
      reason: "phone_verification_required",
      eligibleForNewStudent: false,
      requiresSmsVerification: true,
      shouldFallbackToRegular: false,
      requiresLogin: false,
      exists,
      hasCompletedPurchase: false,
      existingIdentifier,
      sources: exists ? {
        clerk: Boolean(existingClerkUser),
        databaseUser: Boolean(existingDbUser),
      } : undefined,
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error("QR new-student verify failed", error)
    return NextResponse.json({ error: "Unable to verify customer identity" }, { status: 500 })
  }
}
