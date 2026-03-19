import { NextResponse } from "next/server"
import {
  enforceNewStudentRules,
  prepareCheckoutAccount,
  type ApiError,
} from "@/lib/checkout"
import { validateCheckoutPayload, type CheckoutBody } from "@/lib/checkout/validation"
import { parsePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { upsertUserByIdentifiers } from "@/lib/users"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const isApiError = (value: unknown): value is ApiError =>
  Boolean(value && typeof value === "object" && "status" in value && "error" in value)

const toErrorResponse = (error: ApiError) =>
  NextResponse.json({ error: error.error, ...(error.code ? { code: error.code } : {}) }, { status: error.status })

const normalizeCashNote = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, 500)
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("checkout:cash", getClientIp(req)),
    limit: 40,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  let body: CheckoutBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const {
    email,
    firstName,
    lastName,
    name,
    phone = "",
  } = body || {}
  const photoContext = parsePhotoFlowContext((body as Record<string, unknown>)?.photoContext)

  const cashNote = normalizeCashNote((body as Record<string, unknown>)?.cashNote)

  const validation = await validateCheckoutPayload(body)
  if (isApiError(validation)) {
    return toErrorResponse(validation)
  }

  const preparedAccount = await prepareCheckoutAccount(
    req,
    {
      email,
      firstName,
      lastName,
      name,
      phone,
    },
    {
      photoContext,
      allowExistingAccountLookup: photoContext === "kiosk_terminal",
    }
  )
  if (isApiError(preparedAccount)) {
    return toErrorResponse(preparedAccount)
  }

  const { userId, clerkUser, resolvedUserId, identity, account } = preparedAccount

  const newStudentError = await enforceNewStudentRules({
    serviceId: validation.serviceId,
    safeParticipants: validation.safeParticipants,
    clerkUserForVerification: clerkUser,
    resolvedUserId: resolvedUserId || undefined,
    resolvedEmail: identity.resolvedEmail,
    phoneNormalized: identity.phoneNormalized,
  })
  if (newStudentError) {
    return toErrorResponse(newStudentError)
  }

  const dbUser = await upsertUserByIdentifiers({
    clerkId: resolvedUserId || undefined,
    email: identity.resolvedEmail,
    phone: identity.phoneNormalized,
    name: name || [firstName, lastName].filter(Boolean).join(" ") || undefined,
  })

  if (!dbUser) {
    return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
  }

  const purchase = await prisma.purchase.create({
    data: {
      userId: dbUser.id,
      courseSlug: validation.courseSlug,
      courseTitle: validation.courseTitle,
      amount: validation.amountInt,
      currency: validation.currency,
      status: "pending",
      email: identity.resolvedEmail,
      name: name || [firstName, lastName].filter(Boolean).join(" ") || null,
      phone: identity.phoneNormalized,
      participants: validation.safeParticipants,
      coupon: validation.coupon || null,
      packageId: validation.packageId || null,
      serviceId: validation.serviceId || null,
      addonsCsv: validation.addons.join(",") || null,
      metadata: {
        source: "cash_checkout",
        paymentMethod: "onsite",
        paymentChannel: "cash",
        settlementStatus: "pending",
        settledAt: null,
        date: validation.date,
        time: validation.time,
        courseSlug: validation.courseSlug,
        courseTitle: validation.courseTitle,
        packageId: validation.packageId,
        packageLabel: validation.pkg?.label || "",
        packageTotalCredits: validation.packageTotalCredits === null ? "" : String(validation.packageTotalCredits),
        packageIsUnlimited: String(validation.packageIsUnlimited),
        packageCadence: validation.packageCadence,
        packageMakeUps: String(validation.packageMakeUps),
        packageValidDays: String(validation.packageValidDays),
        serviceId: validation.serviceId,
        userId: resolvedUserId || "guest",
        participants: String(validation.safeParticipants),
        coupon: validation.coupon || "",
        addons: validation.addons.join(","),
        name: name || [firstName, lastName].filter(Boolean).join(" ") || "",
        email: identity.resolvedEmail,
        phone: identity.phoneNormalized,
        phoneRaw: identity.phoneRaw || "",
        cashNote,
        requiresCardMigration: true,
      },
    },
  })

  return NextResponse.json({
    ok: true,
    purchaseId: purchase.id,
    packagePurchaseId: null,
    paymentMethod: "onsite",
    paymentStatus: purchase.status,
    migration: {
      target: "card",
      recommended: true,
      message: "Cash request recorded as pending. Staff must confirm payment before class access.",
    },
    account,
  })
}
