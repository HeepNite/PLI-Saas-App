import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { ATTENDED_CHECKIN_STATUSES } from "@/lib/attendance-constants"

export const runtime = "nodejs"

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:stats:patch", getClientIp(req)),
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
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : ""
  if (!reason || reason.length > 500) {
    return NextResponse.json({ error: "Reason is required (max 500 characters)." }, { status: 400 })
  }

  // Validate allowed fields
  const allowedFields = ["completedClasses", "packageClassesUsed"]
  const updates: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (field in payload) {
      updates[field] = payload[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update. Allowed: completedClasses, packageClassesUsed." }, { status: 400 })
  }

  // Validate numeric fields
  for (const field of allowedFields) {
    if (field in updates) {
      const value = updates[field]
      if (typeof value !== "number" || value < 0 || !Number.isInteger(value)) {
        return NextResponse.json({ error: `${field} must be a non-negative integer.` }, { status: 400 })
      }
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify student exists
      const student = await tx.user.findUnique({ where: { id: userId } })
      if (!student) {
        return { error: "Student not found", status: 404 } as const
      }

      const auditEntries: Array<{ field: string; valueBefore: unknown; valueAfter: unknown }> = []

      // Stats are derived from attendance and package usage, so we store corrections in metadata
      // For now, we'll create a stats correction record in the audit log
      // The actual stats are computed from attendance/package data

      if ("completedClasses" in updates) {
        // Count actual completed attendances
        const actualCompleted = await tx.attendance.count({
          where: {
            userId,
            status: { in: [...ATTENDED_CHECKIN_STATUSES] },
          },
        })

        auditEntries.push({
          field: "completedClasses",
          valueBefore: actualCompleted,
          valueAfter: updates.completedClasses,
        })
      }

      if ("packageClassesUsed" in updates) {
        // Get active package usage
        const activePackage = await tx.packagePurchase.findFirst({
          where: {
            userId,
            status: "active",
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          orderBy: { purchasedAt: "desc" },
        })

        let actualUsed = 0
        if (activePackage) {
          actualUsed = await tx.packageUsageLedger.count({
            where: {
              packagePurchaseId: activePackage.id,
              attendance: {
                status: { in: [...ATTENDED_CHECKIN_STATUSES] },
              },
            },
          })
        }

        auditEntries.push({
          field: "packageClassesUsed",
          valueBefore: actualUsed,
          valueAfter: updates.packageClassesUsed,
        })
      }

      // Write audit entries for each stat corrected
      for (const entry of auditEntries) {
        await writeStudentDataAudit(
          {
            targetUserId: userId,
            staffClerkId: authResult.userId,
            staffName: authResult.staffName,
            entity: "stats",
            entityId: null,
            field: entry.field,
            valueBefore: entry.valueBefore ?? null,
            valueAfter: entry.valueAfter ?? null,
            reason,
            ipAddress: getClientIp(req),
          },
          tx
        )
      }

      // Update the override fields on the User so corrections are reflected in the UI
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(("completedClasses" in updates) && { completedClassesOverride: updates.completedClasses as number }),
          ...(("packageClassesUsed" in updates) && { packageClassesUsedOverride: updates.packageClassesUsed as number }),
        },
      })

      return {
        ok: true,
        stats: {
          userId,
          corrections: auditEntries.map((e) => ({
            field: e.field,
            correctedTo: e.valueAfter,
          })),
        },
      } as const
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error("Stats override error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
