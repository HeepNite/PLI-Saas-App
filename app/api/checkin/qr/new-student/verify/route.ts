import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"
import { findClerkUserByIdentifiers } from "@/lib/clerk-users"
import { normalizePhone } from "@/lib/checkout/validation"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"

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

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const buildPhoneVariants = (normalizedPhone: string) => {
  const digits = normalizedPhone.replace(/\D/g, "")
  if (!digits) return [] as string[]
  const variants = new Set<string>([digits])

  // Extract last 10 digits as the core US number
  const last10 = digits.length >= 10 ? digits.slice(-10) : ""

  if (digits.length === 11 && digits.startsWith("1")) {
    variants.add(digits.slice(1)) // 10-digit without country code
  } else if (digits.length === 10) {
    variants.add(`1${digits}`) // 11-digit with country code
  }

  // Always include last 10 digits to catch formatted variants like "+1 (929) 387-6584"
  if (last10) {
    variants.add(last10)
    variants.add(`1${last10}`)
  }

  // Include E.164 format (+1XXXXXXXXXX) for direct DB matches
  if (last10) {
    variants.add(`+1${last10}`)
  }

  return [...variants]
}

const buildPhoneQueryFilters = (phoneVariants: string[]) => {
  const seen = new Set<string>()
  const filters: Array<Record<string, unknown>> = []
  for (const variant of phoneVariants) {
    if (!variant) continue
    if (!seen.has(`eq:${variant}`)) {
      filters.push({ phone: variant })
      seen.add(`eq:${variant}`)
    }
    if (!seen.has(`contains:${variant}`)) {
      filters.push({ phone: { contains: variant } })
      seen.add(`contains:${variant}`)
    }
  }
  return filters
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
    const phoneInput = normalizeString(payload?.phone)
    const emailInput = normalizeString(payload?.email)

    const phoneNormalized = normalizePhone(phoneInput) || ""
    const phoneVariants = buildPhoneVariants(phoneNormalized)

    if (!phoneNormalized && !emailInput) {
      return NextResponse.json({ error: "Missing or invalid phone or email" }, { status: 400 })
    }

    // Current session — used to detect if the session already owns the phone
    const { userId: sessionUserId } = await auth()

    // Clerk lookup by phone and/or email
    const us10Phone = phoneVariants.find((value) => value.length === 10) || ""
    const clerkLookupPhone = phoneInput.startsWith("+")
      ? phoneInput
      : us10Phone
        ? `+1${us10Phone}`
        : phoneInput

    const existingClerkUser = await findClerkUserByIdentifiers({
      phone: clerkLookupPhone || undefined,
      email: emailInput || undefined,
    })

    // Build DB identity filters from phone variants + email
    const identityFilters: Array<Record<string, unknown>> = []
    if (phoneVariants.length > 0) {
      identityFilters.push(...buildPhoneQueryFilters(phoneVariants))
    }
    if (existingClerkUser?.id) identityFilters.push({ clerkId: existingClerkUser.id })
    if (emailInput) identityFilters.push({ email: { equals: emailInput, mode: "insensitive" } })

    let existingDbUser = null as null | { id: string; clerkId: string | null; email: string; phone: string | null } | null

    if (identityFilters.length > 0) {
      existingDbUser = await prisma.user.findFirst({
        where: { OR: identityFilters },
        select: { id: true, clerkId: true, email: true, phone: true },
      })
    }

    const exists = Boolean(existingClerkUser || existingDbUser)

    // Determine which identifiers matched
    const phoneMatch = Boolean(
      existingClerkUser || (existingDbUser?.phone && phoneVariants.length > 0)
    )
    const emailMatch = Boolean(
      existingDbUser?.email && emailInput && existingDbUser.email.toLowerCase() === emailInput.toLowerCase()
    )

    const existingIdentifier = resolveExistingIdentifier(phoneMatch, emailMatch)

    // --- Unified outcome contract ---

    // Case 1: Current session already owns this phone → eligible (skip verification)
    if (sessionUserId && existingClerkUser?.id === sessionUserId) {
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

    // Case 2: Identity exists — check purchase history.
    // Returning customers (with completed purchases) get fallback to regular price.
    // Everyone else (truly new OR existing-but-no-purchases) requires SMS verification.
    const purchaseFilters: Array<Record<string, unknown>> = []
    if (existingClerkUser?.id) purchaseFilters.push({ user: { clerkId: existingClerkUser.id } })
    if (existingDbUser?.id) purchaseFilters.push({ userId: existingDbUser.id })
    if (phoneVariants.length > 0) purchaseFilters.push(...buildPhoneQueryFilters(phoneVariants))
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
      // Returning customer — fallback to regular price
      console.log("[new-student-verify]", {
        phoneInput,
        phoneVariants,
        clerkUserFound: !!existingClerkUser,
        dbUserFound: !!existingDbUser,
        purchaseFound: true,
        outcome: "fallback_regular",
      })
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

    // Case 3: No completed purchases — requires SMS verification.
    // Covers both truly new (no identity) and existing-but-no-purchases.
    console.log("[new-student-verify]", {
      phoneInput,
      phoneVariants,
      clerkUserFound: !!existingClerkUser,
      dbUserFound: !!existingDbUser,
      purchaseFound: false,
      outcome: exists ? "requires_sms_verification" : "requires_sms_verification",
    })
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
