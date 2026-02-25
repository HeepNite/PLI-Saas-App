import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { findClerkUserByIdentifiers } from "@/lib/clerk-users"
import { normalizePhone } from "@/lib/checkout/validation"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const COMPLETED_PURCHASE_STATUSES = ["paid", "succeeded"] as const

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const buildPhoneVariants = (normalizedPhone: string) => {
  const digits = normalizedPhone.replace(/\D/g, "")
  if (!digits) return [] as string[]
  const variants = new Set<string>([digits])
  if (digits.length === 11 && digits.startsWith("1")) {
    variants.add(digits.slice(1))
  } else if (digits.length === 10) {
    variants.add(`1${digits}`)
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

export async function POST(req: Request) {
  try {
    const authResult = await auth()
    const sessionUserId = authResult.userId || null
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

    const phoneNormalized = normalizePhone(phoneInput) || ""
    const phoneVariants = buildPhoneVariants(phoneNormalized)

    if (!phoneNormalized) {
      return NextResponse.json({ error: "Missing or invalid phone" }, { status: 400 })
    }

    const us10Phone = phoneVariants.find((value) => value.length === 10) || ""
    const clerkLookupPhone = phoneInput.startsWith("+")
      ? phoneInput
      : us10Phone
        ? `+1${us10Phone}`
        : phoneInput
    const existingClerkUser = await findClerkUserByIdentifiers({
      phone: clerkLookupPhone || undefined,
    })

    const identityFilters: Array<Record<string, unknown>> = buildPhoneQueryFilters(phoneVariants)
    if (existingClerkUser?.id) identityFilters.push({ clerkId: existingClerkUser.id })

    let existingDbUser = null as null | { id: string; clerkId: string | null }
    let existingPaidPurchase = null as null | { id: string; user: { clerkId: string | null } | null }

    if (identityFilters.length > 0) {
      existingDbUser = await prisma.user.findFirst({
        where: { OR: identityFilters },
        select: { id: true, clerkId: true },
      })

      const purchaseFilters: Array<Record<string, unknown>> = buildPhoneQueryFilters(phoneVariants)
      if (existingClerkUser?.id) purchaseFilters.push({ user: { clerkId: existingClerkUser.id } })
      if (existingDbUser?.id) purchaseFilters.push({ userId: existingDbUser.id })

      if (purchaseFilters.length > 0) {
        existingPaidPurchase = await prisma.purchase.findFirst({
          where: {
            status: { in: [...COMPLETED_PURCHASE_STATUSES] },
            OR: purchaseFilters,
          },
          select: {
            id: true,
            user: {
              select: {
                clerkId: true,
              },
            },
          },
        })
      }
    }

    const exists = Boolean(existingClerkUser || existingDbUser || existingPaidPurchase)
    const hasCompletedPurchase = Boolean(existingPaidPurchase)
    const matchedClerkIds = new Set<string>()
    if (existingClerkUser?.id) matchedClerkIds.add(existingClerkUser.id)
    if (existingDbUser?.clerkId) matchedClerkIds.add(existingDbUser.clerkId)
    if (existingPaidPurchase?.user?.clerkId) matchedClerkIds.add(existingPaidPurchase.user.clerkId)
    const sessionOwnsPhone = Boolean(sessionUserId && matchedClerkIds.has(sessionUserId))

    return NextResponse.json({
      exists,
      hasCompletedPurchase,
      sessionOwnsPhone,
      requiresLogin: Boolean(hasCompletedPurchase && !sessionOwnsPhone),
      sources: {
        clerk: Boolean(existingClerkUser),
        databaseUser: Boolean(existingDbUser),
        completedPurchase: Boolean(existingPaidPurchase),
      },
    })
  } catch (error) {
    console.error("QR new-student verify failed", error)
    return NextResponse.json({ error: "Unable to verify customer identity" }, { status: 500 })
  }
}
