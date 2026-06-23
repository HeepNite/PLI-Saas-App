import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { asObject, asText } from "@/lib/shared"

export const runtime = "nodejs"

const VALID_PAYMENT_METHODS = ["cash", "card", "transfer", "other"]
const normalizePaymentMethod = (raw: string): string =>
  VALID_PAYMENT_METHODS.includes(raw) ? raw : "cash"

export async function GET(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:payments:get", getClientIp(req)),
    limit: 120,
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

  try {
    const student = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const purchases = await prisma.purchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        courseSlug: true,
        courseTitle: true,
        amount: true,
        currency: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    })

    const normalized = purchases.map((purchase) => {
      const metadata = asObject(purchase.metadata)
      return {
        id: purchase.id,
        label: asText(purchase.courseTitle) || asText(purchase.courseSlug) || "Purchase",
        amount: purchase.amount,
        currency: purchase.currency,
        status: purchase.status,
        settlementStatus: asText(metadata.settlementStatus) || "pending",
        outstandingBalance: typeof metadata.outstandingBalance === "number" ? metadata.outstandingBalance : 0,
        paymentMethod: normalizePaymentMethod(asText(metadata.paymentMethod)),
        createdAt: purchase.createdAt.toISOString(),
      }
    })

    return NextResponse.json({ ok: true, data: { purchases: normalized } })
  } catch (error) {
    console.error("Payment listing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:payments:patch", getClientIp(req)),
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

  const payload = body as Record<string, unknown>
  const purchaseId = typeof payload.purchaseId === "string" ? payload.purchaseId : ""
  if (!purchaseId) {
    return NextResponse.json({ error: "purchaseId is required." }, { status: 400 })
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : ""
  if (!reason || reason.length > 500) {
    return NextResponse.json({ error: "Reason is required (max 500 characters)." }, { status: 400 })
  }

  // Validate allowed fields
  const allowedFields = ["amount", "settlementStatus", "outstandingBalance", "paymentMethod"]
  const updates: Record<string, unknown> = {}
  const auditEntries: Array<{ field: string; valueBefore: unknown; valueAfter: unknown }> = []

  for (const field of allowedFields) {
    if (field in payload) {
      updates[field] = payload[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 })
  }

  // Validate amount if provided
  if ("amount" in updates) {
    const amount = updates.amount
    if (typeof amount !== "number" || amount < 0 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: "Amount must be a non-negative integer (cents)." }, { status: 400 })
    }
  }

  // Validate settlementStatus if provided
  if ("settlementStatus" in updates) {
    const validSettlements = ["paid", "pending", "partial"]
    if (!validSettlements.includes(updates.settlementStatus as string)) {
      return NextResponse.json({ error: `Invalid settlementStatus. Must be one of: ${validSettlements.join(", ")}` }, { status: 400 })
    }
  }

  // Validate paymentMethod if provided
  if ("paymentMethod" in updates) {
    const validMethods = ["cash", "card", "transfer", "other"]
    if (!validMethods.includes(updates.paymentMethod as string)) {
      return NextResponse.json({ error: `Invalid paymentMethod. Must be one of: ${validMethods.join(", ")}` }, { status: 400 })
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify student exists
      const student = await tx.user.findUnique({ where: { id: userId } })
      if (!student) {
        return { error: "Student not found", status: 404 } as const
      }

      // Find the purchase
      const purchase = await tx.purchase.findUnique({ where: { id: purchaseId } })
      if (!purchase) {
        return { error: "Purchase not found", status: 404 } as const
      }

      // Verify purchase belongs to student
      if (purchase.userId !== userId) {
        return { error: "Purchase does not belong to this student.", status: 403 } as const
      }

      const metadata = asObject(purchase.metadata)
      const nextMetadata = { ...metadata }

      // Build update data
      const updateData: Record<string, unknown> = {}

      if ("amount" in updates) {
        const oldAmount = purchase.amount
        const newAmount = updates.amount as number
        updateData.amount = newAmount
        auditEntries.push({ field: "amount", valueBefore: oldAmount, valueAfter: newAmount })

        // Recalculate outstanding balance if amount changes
        const currentSettlementStatus = asText(metadata.settlementStatus)
        const currentOutstandingBalance = typeof metadata.outstandingBalance === "number" ? metadata.outstandingBalance : 0

        if (currentSettlementStatus === "paid") {
          // If already paid, outstanding balance stays 0
          nextMetadata.outstandingBalance = 0
        } else {
          // Adjust outstanding balance proportionally
          const paidAmount = oldAmount - currentOutstandingBalance
          nextMetadata.outstandingBalance = Math.max(0, newAmount - paidAmount)
        }
      }

      if ("settlementStatus" in updates) {
        const oldStatus = asText(metadata.settlementStatus) || "pending"
        const newStatus = updates.settlementStatus as string
        nextMetadata.settlementStatus = newStatus
        auditEntries.push({ field: "settlementStatus", valueBefore: oldStatus, valueAfter: newStatus })

        if (newStatus === "paid") {
          nextMetadata.settledAt = new Date().toISOString()
          nextMetadata.outstandingBalance = 0
          updateData.status = "paid"
        } else if (newStatus === "pending") {
          nextMetadata.settledAt = null
        }

        nextMetadata.settlementUpdatedBy = authResult.userId
      }

      if ("outstandingBalance" in updates) {
        const oldBalance = typeof metadata.outstandingBalance === "number" ? metadata.outstandingBalance : 0
        const newBalance = updates.outstandingBalance as number
        if (typeof newBalance !== "number" || newBalance < 0) {
          return { error: "Outstanding balance must be non-negative.", status: 400 } as const
        }
        nextMetadata.outstandingBalance = newBalance
        auditEntries.push({ field: "outstandingBalance", valueBefore: oldBalance, valueAfter: newBalance })
      }

      if ("paymentMethod" in updates) {
        const oldMethod = asText(metadata.paymentMethod) || "unknown"
        const newMethod = updates.paymentMethod as string
        nextMetadata.paymentMethod = newMethod
        auditEntries.push({ field: "paymentMethod", valueBefore: oldMethod, valueAfter: newMethod })
      }

      updateData.metadata = nextMetadata

      const updated = await tx.purchase.update({
        where: { id: purchaseId },
        data: updateData,
      })

      // Write audit entries for each field changed
      for (const entry of auditEntries) {
        await writeStudentDataAudit(
          {
            targetUserId: userId,
            staffClerkId: authResult.userId,
            staffName: authResult.staffName,
            entity: "payment",
            entityId: purchaseId,
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
        purchase: {
          id: updated.id,
          amount: updated.amount,
          status: updated.status,
          metadata: updated.metadata,
        },
      } as const
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error("Payment override error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:payments:delete", getClientIp(req)),
    limit: 30,
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

  const payload = body as Record<string, unknown>
  const purchaseId = typeof payload.purchaseId === "string" ? payload.purchaseId : ""
  if (!purchaseId) {
    return NextResponse.json({ error: "purchaseId is required." }, { status: 400 })
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : ""
  if (!reason || reason.length > 500) {
    return NextResponse.json({ error: "Reason is required (max 500 characters)." }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify student exists
      const student = await tx.user.findUnique({ where: { id: userId } })
      if (!student) {
        return { error: "Student not found", status: 404 } as const
      }

      // Find the purchase
      const purchase = await tx.purchase.findUnique({ where: { id: purchaseId } })
      if (!purchase) {
        return { error: "Purchase not found", status: 404 } as const
      }

      // Verify purchase belongs to student
      if (purchase.userId !== userId) {
        return { error: "Purchase does not belong to this student.", status: 403 } as const
      }

      // Null out any PackagePurchase.purchaseId pointing to this purchase
      await tx.packagePurchase.updateMany({
        where: { purchaseId },
        data: { purchaseId: null },
      })

      // Write audit entry
      await writeStudentDataAudit(
        {
          targetUserId: userId,
          staffClerkId: authResult.userId,
          staffName: authResult.staffName,
          entity: "payment",
          entityId: purchaseId,
          field: "purchase",
          valueBefore: { id: purchase.id, amount: purchase.amount, courseSlug: purchase.courseSlug, status: purchase.status },
          valueAfter: null,
          reason,
          ipAddress: getClientIp(req),
        },
        tx
      )

      // Hard delete the purchase
      await tx.purchase.delete({ where: { id: purchaseId } })

      return { ok: true } as const
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Payment delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
