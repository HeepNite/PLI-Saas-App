import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeCashPackageGrantRequest, authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { PAYMENT_CHANNEL, PURCHASE_STATUS, SETTLEMENT_STATUS } from "@/lib/payment-constants"
import { asObject } from "@/lib/shared"

export const runtime = "nodejs"

export async function GET(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:packages:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const isGrantIntent = new URL(req.url).searchParams.get("intent") === "grant"
  const authResult = isGrantIntent ? await authorizeCashPackageGrantRequest() : await authorizeOwnerOrAdminRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  try {
    const student = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    if (isGrantIntent) {
      const plans = await prisma.packagePlan.findMany({
        where: { active: true },
        orderBy: [{ label: "asc" }],
        select: {
          id: true,
          key: true,
          label: true,
          priceCents: true,
          cadence: true,
          totalCredits: true,
          isUnlimited: true,
        },
      })
      return NextResponse.json({ ok: true, data: { plans } })
    }

    const packages = await prisma.packagePurchase.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { purchasedAt: "desc" }],
      select: {
        id: true,
        packageLabel: true,
        packageId: true,
        status: true,
        totalCredits: true,
        remainingCredits: true,
        isUnlimited: true,
        expiresAt: true,
      },
    })

    const normalized = packages.map((pkg) => {
      const usedCredits = pkg.isUnlimited
        ? null
        : typeof pkg.totalCredits === "number" && typeof pkg.remainingCredits === "number"
          ? Math.max(0, pkg.totalCredits - pkg.remainingCredits)
          : null

      return {
        id: pkg.id,
        label: pkg.packageLabel || pkg.packageId || "Package",
        status: pkg.status,
        totalCredits: pkg.totalCredits,
        remainingCredits: pkg.remainingCredits,
        usedCredits,
        isUnlimited: pkg.isUnlimited,
        expiresAt: pkg.expiresAt?.toISOString() ?? null,
      }
    })

    return NextResponse.json({ ok: true, data: { packages: normalized } })
  } catch (error) {
    console.error("Package listing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:packages:patch", getClientIp(req)),
    limit: 90,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeOwnerOrAdminRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}
  const packagePurchaseId = typeof payload.packagePurchaseId === "string" ? payload.packagePurchaseId : ""
  if (!packagePurchaseId) {
    return NextResponse.json({ error: "packagePurchaseId is required." }, { status: 400 })
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : ""
  if (!reason || reason.length > 500) {
    return NextResponse.json({ error: "Reason is required (max 500 characters)." }, { status: 400 })
  }

  // Validate allowed fields
  const allowedFields = ["remainingCredits", "usedCredits", "expiresAt", "status"]
  const updates: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (field in payload) {
      updates[field] = payload[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 })
  }

  // Validate credits if provided
  if ("remainingCredits" in updates) {
    const credits = updates.remainingCredits
    if (typeof credits !== "number" || credits < 0 || !Number.isInteger(credits)) {
      return NextResponse.json({ error: "remainingCredits must be a non-negative integer." }, { status: 400 })
    }
  }

  if ("usedCredits" in updates) {
    const used = updates.usedCredits
    if (typeof used !== "number" || used < 0 || !Number.isInteger(used)) {
      return NextResponse.json({ error: "usedCredits must be a non-negative integer." }, { status: 400 })
    }
  }

  // Validate status if provided
  if ("status" in updates) {
    const validStatuses = ["active", "paused", "expired", "cancelled"]
    if (!validStatuses.includes(updates.status as string)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 })
    }
  }

  // Validate expiresAt if provided
  if ("expiresAt" in updates) {
    const expiresAt = updates.expiresAt
    if (typeof expiresAt !== "string") {
      return NextResponse.json({ error: "expiresAt must be an ISO date string." }, { status: 400 })
    }
    const parsed = new Date(expiresAt)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "expiresAt must be a valid ISO date string." }, { status: 400 })
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify student exists
      const student = await tx.user.findUnique({ where: { id: userId } })
      if (!student) {
        return { error: "Student not found", status: 404 } as const
      }

      // Find the package purchase
      const pkg = await tx.packagePurchase.findUnique({ where: { id: packagePurchaseId } })
      if (!pkg) {
        return { error: "Package purchase not found", status: 404 } as const
      }

      // Verify package belongs to student
      if (pkg.userId !== userId) {
        return { error: "Package does not belong to this student.", status: 403 } as const
      }

      // Build update data
      const updateData: Record<string, unknown> = {}
      const auditEntries: Array<{ field: string; valueBefore: unknown; valueAfter: unknown }> = []

      if ("remainingCredits" in updates) {
        const oldCredits = pkg.remainingCredits
        const newCredits = updates.remainingCredits as number

        // Guard: cannot exceed totalCredits if not unlimited
        if (!pkg.isUnlimited && pkg.totalCredits !== null && newCredits > pkg.totalCredits) {
          return { error: "remainingCredits cannot exceed totalCredits.", status: 400 } as const
        }

        updateData.remainingCredits = newCredits
        auditEntries.push({ field: "remainingCredits", valueBefore: oldCredits, valueAfter: newCredits })
      }

      if ("usedCredits" in updates) {
        const newUsed = updates.usedCredits as number

        // Guard: used cannot exceed totalCredits if not unlimited
        if (!pkg.isUnlimited && pkg.totalCredits !== null && newUsed > pkg.totalCredits) {
          return { error: "usedCredits cannot exceed totalCredits.", status: 400 } as const
        }

        // Calculate remaining from used
        const newRemaining = pkg.isUnlimited ? newUsed : Math.max(0, (pkg.totalCredits || 0) - newUsed)
        updateData.remainingCredits = newRemaining
        auditEntries.push({ field: "usedCredits", valueBefore: pkg.totalCredits! - (pkg.remainingCredits || 0), valueAfter: newUsed })
      }

      if ("expiresAt" in updates) {
        const oldExpires = pkg.expiresAt
        const newExpires = new Date(updates.expiresAt as string)
        updateData.expiresAt = newExpires
        auditEntries.push({
          field: "expiresAt",
          valueBefore: oldExpires?.toISOString() ?? null,
          valueAfter: newExpires.toISOString(),
        })
      }

      if ("status" in updates) {
        const oldStatus = pkg.status
        const newStatus = updates.status as string
        updateData.status = newStatus
        auditEntries.push({ field: "status", valueBefore: oldStatus, valueAfter: newStatus })
      }

      const updated = await tx.packagePurchase.update({
        where: { id: packagePurchaseId },
        data: updateData,
      })

      // Write audit entries for each field changed
      for (const entry of auditEntries) {
        await writeStudentDataAudit(
          {
            targetUserId: userId,
            staffClerkId: authResult.userId,
            staffName: authResult.staffName,
            entity: "package",
            entityId: packagePurchaseId,
            field: entry.field,
            valueBefore: entry.valueBefore ?? null,
            valueAfter: entry.valueAfter ?? null,
            reason,
            ipAddress: getClientIp(req),
          },
          tx
        )
      }

      return {
        ok: true,
        package: {
          id: updated.id,
          packageId: updated.packageId,
          packageLabel: updated.packageLabel,
          totalCredits: updated.totalCredits,
          remainingCredits: updated.remainingCredits,
          isUnlimited: updated.isUnlimited,
          expiresAt: updated.expiresAt,
          status: updated.status,
        },
      } as const
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error("Package override error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({ key: buildRateLimitKey("staff:packages:post", getClientIp(req)), limit: 30, windowMs: 60_000 })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } })
  }

  const authResult = await authorizeCashPackageGrantRequest()
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })

  const { userId } = await context.params
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const allowedFields = ["packagePlanId", "reason", "idempotencyKey"]
  const packagePlanId = typeof payload.packagePlanId === "string" ? payload.packagePlanId.trim() : ""
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : ""
  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey.trim() : ""
  if (Object.keys(payload).length !== allowedFields.length || Object.keys(payload).some((field) => !allowedFields.includes(field)) || !packagePlanId || !reason || reason.length > 500 || !idempotencyKey) {
    return NextResponse.json({ error: "Invalid grant request" }, { status: 400 })
  }

  const student = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${packagePlanId}))`

      const replay = await tx.purchase.findUnique({ where: { idempotencyKey } })
      if (replay) {
        const metadata = asObject(replay.metadata)
        if (replay.userId === userId && replay.packageId && metadata.source === "staff_package_grant" && metadata.packagePlanId === packagePlanId) {
          return { ok: true, purchaseId: replay.id, replayed: true } as const
        }
        return { ok: false, error: "IDEMPOTENCY_KEY_REUSED" } as const
      }

      const plan = await tx.packagePlan.findFirst({ where: { id: packagePlanId, active: true } })
      if (!plan) return { ok: false, error: "INVALID_PACKAGE_PLAN" } as const

      const activePackage = await tx.packagePurchase.findFirst({
        where: { userId, status: "active", OR: [{ packagePlanId }, { packageId: plan.key }] },
        select: { id: true },
      })
      if (activePackage) return { ok: false, error: "DUPLICATE_ACTIVE_PACKAGE" } as const

      const amount = plan.priceCents ?? 0
      const metadata = {
        source: "staff_package_grant", packagePlanId: plan.id, packageId: plan.key, packageLabel: plan.label,
        packageTotalCredits: plan.totalCredits === null ? "" : String(plan.totalCredits),
        packageIsUnlimited: String(plan.isUnlimited), packageCadence: plan.cadence ?? "",
        packageMakeUps: String(plan.makeUps), packageValidDays: String(plan.validDays),
        paymentChannel: PAYMENT_CHANNEL.CASH, settlementStatus: SETTLEMENT_STATUS.PENDING, outstandingBalance: amount,
      }
      const purchase = await tx.purchase.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          userId, courseSlug: plan.courseSlug ?? `package:${plan.key}`, courseTitle: plan.label, amount,
          currency: "usd", status: PURCHASE_STATUS.PENDING, packageId: plan.key, idempotencyKey, metadata,
        },
      })
      const createdMetadata = asObject(purchase.metadata)
      if (purchase.userId !== userId || purchase.packageId !== plan.key || createdMetadata.packagePlanId !== packagePlanId || createdMetadata.source !== "staff_package_grant") {
        return { ok: false, error: "IDEMPOTENCY_KEY_REUSED" } as const
      }

      await writeStudentDataAudit({
        targetUserId: userId, staffClerkId: authResult.userId, staffName: authResult.staffName,
        entity: "package", entityId: purchase.id, field: "cash_package_grant",
        valueAfter: { outcome: "CREATED", packagePlanId, purchaseId: purchase.id }, reason, ipAddress: getClientIp(req),
      }, tx)
      return { ok: true, purchaseId: purchase.id, replayed: false } as const
    })

    if (!result.ok) {
      await writeStudentDataAudit({
        targetUserId: userId, staffClerkId: authResult.userId, staffName: authResult.staffName,
        entity: "package", field: "cash_package_grant", valueAfter: { outcome: result.error }, reason, ipAddress: getClientIp(req),
      })
      return NextResponse.json({ error: result.error }, { status: result.error === "INVALID_PACKAGE_PLAN" ? 400 : 409 })
    }

    return NextResponse.json({ ok: true, data: { purchaseId: result.purchaseId, replayed: result.replayed } }, { status: result.replayed ? 200 : 201 })
  } catch (error) {
    console.error("Cash package grant error:", error)
    await writeStudentDataAudit({
      targetUserId: userId, staffClerkId: authResult.userId, staffName: authResult.staffName,
      entity: "package", field: "cash_package_grant", valueAfter: { outcome: "FAILED" }, reason, ipAddress: getClientIp(req),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
