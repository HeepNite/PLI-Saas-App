import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { buildRateLimitKey, getClientIp } from "@/lib/security/rate-limit"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { asObject, asText } from "@/lib/shared"
import { ATTENDANCE_STATUS, ATTENDED_CHECKIN_STATUSES } from "@/lib/attendance-constants"

export const runtime = "nodejs"

type AttendanceAction = "add" | "remove" | "update"

const MAX_SESSION_IDS = 20

// ─── Internal helpers (extracted to avoid duplication in multi-session loop) ───

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

type SessionInfo = { id: string; title: string | null; courseSlug: string }

/**
 * Fetch all sessions by IDs in one query. Returns a map id → session info.
 */
async function fetchSessions(tx: Tx, ids: string[]): Promise<Map<string, SessionInfo>> {
  const rows = await tx.classSession.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, courseSlug: true },
  })
  const map = new Map<string, SessionInfo>()
  for (const r of rows) map.set(r.id, r)
  return map
}

/**
 * Apply "add" logic for a single session.
 * Returns { ok, attendanceId } or { error, status }.
 */
async function applyAdd(
  tx: Tx,
  userId: string,
  sessionId: string,
  status: string,
  reason: string,
  authResult: { userId: string; staffName: string | null },
  req: Request
): Promise<{ ok: true; attendanceId: string } | { error: string; status: number }> {
  const existing = await tx.attendance.findUnique({
    where: { userId_sessionId: { userId, sessionId } },
  })
  if (existing) {
    return { error: `Attendance already exists for session ${sessionId}.`, status: 409 }
  }

  const attendance = await tx.attendance.create({
    data: {
      userId,
      sessionId,
      status,
      checkedInAt: new Date(),
      metadata: { source: "staff_override" },
    },
  })

  // Consume package credit if applicable
  const activePackage = await tx.packagePurchase.findFirst({
    where: {
      userId,
      status: "active",
      isUnlimited: false,
      remainingCredits: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { purchasedAt: "desc" },
  })

  if (activePackage && activePackage.remainingCredits! > 0) {
    await tx.packagePurchase.update({
      where: { id: activePackage.id },
      data: { remainingCredits: { decrement: 1 }, lastUsedAt: new Date() },
    })

    await tx.packageUsageLedger.create({
      data: {
        packagePurchaseId: activePackage.id,
        userId,
        attendanceId: attendance.id,
        delta: -1,
        reason: "staff_override_add_attendance",
        meta: { sessionId, overriddenBy: authResult.userId },
      },
    })
  }

  await writeStudentDataAudit(
    {
      targetUserId: userId,
      staffClerkId: authResult.userId,
      staffName: authResult.staffName,
      entity: "attendance",
      entityId: attendance.id,
      field: "status",
      valueBefore: null,
      valueAfter: { status, sessionId },
      reason,
      ipAddress: getClientIp(req),
    },
    tx
  )

  return { ok: true, attendanceId: attendance.id }
}

/**
 * Apply "remove" logic for a single session.
 * Returns { ok } or { error, status }.
 */
async function applyRemove(
  tx: Tx,
  userId: string,
  sessionId: string,
  reason: string,
  authResult: { userId: string; staffName: string | null },
  req: Request
): Promise<{ ok: true } | { error: string; status: number }> {
  const attendance = await tx.attendance.findUnique({
    where: { userId_sessionId: { userId, sessionId } },
  })
  if (!attendance) {
    return { error: `Attendance not found for session ${sessionId}.`, status: 404 }
  }

  const valueBefore = { status: attendance.status, sessionId }

  // Collect related records BEFORE deleting attendance (cascade sets attendanceId to null)
  const usageEntry = await tx.packageUsageLedger.findFirst({
    where: { attendanceId: attendance.id },
    include: { packagePurchase: true },
  })

  const linkedPurchases = await tx.purchase.findMany({
    where: {
      userId,
      metadata: { path: ["attendanceId"], equals: attendance.id },
    },
  })

  // Now delete the attendance
  await tx.attendance.delete({
    where: { userId_sessionId: { userId, sessionId } },
  })

  // Restore package credit if it was consumed
  if (usageEntry) {
    await tx.packagePurchase.update({
      where: { id: usageEntry.packagePurchaseId },
      data: {
        remainingCredits: { increment: 1 },
        ...(usageEntry.packagePurchase.status === "exhausted" ? { status: "active" } : {}),
      },
    })

    await tx.packageUsageLedger.delete({
      where: { id: usageEntry.id },
    })
  }

  // Remove the $0 package_credit purchase linked to this attendance
  for (const purchase of linkedPurchases) {
    await tx.purchase.delete({ where: { id: purchase.id } })
  }

  // Clear stat overrides so they recompute from actual data
  await tx.user.update({
    where: { id: userId },
    data: {
      completedClassesOverride: null,
      packageClassesUsedOverride: null,
    },
  })

  await writeStudentDataAudit(
    {
      targetUserId: userId,
      staffClerkId: authResult.userId,
      staffName: authResult.staffName,
      entity: "attendance",
      entityId: attendance.id,
      field: "status",
      valueBefore,
      valueAfter: null,
      reason,
      ipAddress: getClientIp(req),
    },
    tx
  )

  return { ok: true }
}

/**
 * Apply "update" logic for a single session.
 * Returns { ok } or { error, status }.
 */
async function applyUpdate(
  tx: Tx,
  userId: string,
  sessionId: string,
  status: string,
  payload: Record<string, unknown>,
  reason: string,
  authResult: { userId: string; staffName: string | null },
  req: Request
): Promise<{ ok: true } | { error: string; status: number }> {
  const attendance = await tx.attendance.findUnique({
    where: { userId_sessionId: { userId, sessionId } },
  })
  if (!attendance) {
    return { error: `Attendance not found for session ${sessionId}.`, status: 404 }
  }

  // Handle optimistic concurrency if valueBefore is provided
  const expectedStatus = typeof payload.valueBefore === "string" ? payload.valueBefore : null
  if (expectedStatus && attendance.status !== expectedStatus) {
    return { error: "Concurrent modification detected. The record has changed since you last viewed it.", status: 409 }
  }

  const valueBefore = { status: attendance.status }

  const updated = await tx.attendance.update({
    where: { userId_sessionId: { userId, sessionId } },
    data: { status },
  })

  // Handle credit restoration/consumption based on status change
  const wasAttended = ATTENDED_CHECKIN_STATUSES.includes(attendance.status)
  const isAttended = ATTENDED_CHECKIN_STATUSES.includes(status)

  if (wasAttended && !isAttended) {
    // Restoring credit: status changed from attended to non-attended
    const usageEntry = await tx.packageUsageLedger.findFirst({
      where: { attendanceId: attendance.id },
      include: { packagePurchase: true },
    })

    if (usageEntry) {
      await tx.packagePurchase.update({
        where: { id: usageEntry.packagePurchaseId },
        data: { remainingCredits: { increment: 1 } },
      })

      await tx.packageUsageLedger.delete({
        where: { id: usageEntry.id },
      })
    }
  } else if (!wasAttended && isAttended) {
    // Consuming credit: status changed from non-attended to attended
    const activePackage = await tx.packagePurchase.findFirst({
      where: {
        userId,
        status: "active",
        isUnlimited: false,
        remainingCredits: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { purchasedAt: "desc" },
    })

    if (activePackage && activePackage.remainingCredits! > 0) {
      await tx.packagePurchase.update({
        where: { id: activePackage.id },
        data: { remainingCredits: { decrement: 1 }, lastUsedAt: new Date() },
      })

      await tx.packageUsageLedger.create({
        data: {
          packagePurchaseId: activePackage.id,
          userId,
          attendanceId: attendance.id,
          delta: -1,
          reason: "staff_override_update_attendance",
          meta: { sessionId, overriddenBy: authResult.userId },
        },
      })
    }
  }

  await writeStudentDataAudit(
    {
      targetUserId: userId,
      staffClerkId: authResult.userId,
      staffName: authResult.staffName,
      entity: "attendance",
      entityId: attendance.id,
      field: "status",
      valueBefore,
      valueAfter: { status },
      reason,
      ipAddress: getClientIp(req),
    },
    tx
  )

  return { ok: true }
}

// ─── Route handler ───

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:attendance:patch", limit: 90, windowMs: 60_000 },
    authorize: () => authorizeOwnerOrAdminRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

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
  const action = typeof payload.action === "string" ? (payload.action as AttendanceAction) : ""
  if (!["add", "remove", "update"].includes(action)) {
    return NextResponse.json({ error: "Invalid action. Must be 'add', 'remove', or 'update'." }, { status: 400 })
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : ""
  if (!reason || reason.length > 500) {
    return NextResponse.json({ error: "Reason is required (max 500 characters)." }, { status: 400 })
  }

  // Accept either sessionId (legacy) or sessionIds (new multi)
  const legacySessionId = typeof payload.sessionId === "string" ? payload.sessionId : ""
  const sessionIdsRaw = payload.sessionIds
  let sessionIds: string[] = []

  if (Array.isArray(sessionIdsRaw) && sessionIdsRaw.length > 0) {
    sessionIds = sessionIdsRaw
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
  } else if (legacySessionId) {
    sessionIds = [legacySessionId]
  }

  if (sessionIds.length === 0) {
    return NextResponse.json({ error: "sessionId or sessionIds is required." }, { status: 400 })
  }

  if (sessionIds.length > MAX_SESSION_IDS) {
    return NextResponse.json(
      { error: `Too many sessions. Maximum is ${MAX_SESSION_IDS}.` },
      { status: 400 }
    )
  }

  // Deduplicate
  sessionIds = [...new Set(sessionIds)]

  const status = typeof payload.status === "string" ? payload.status : ""
  const validStatuses: string[] = [ATTENDANCE_STATUS.CHECKED_IN, ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE, ATTENDANCE_STATUS.CHECKED_OUT, ATTENDANCE_STATUS.SCHEDULED, ATTENDANCE_STATUS.NO_SHOW]
  if (action !== "remove" && !validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify student exists
      const student = await tx.user.findUnique({ where: { id: userId } })
      if (!student) {
        return { error: "Student not found", status: 404 } as const
      }

      // Fetch all sessions upfront
      const sessionMap = await fetchSessions(tx, sessionIds)

      // Verify all sessions exist
      const missing = sessionIds.filter((id) => !sessionMap.has(id))
      if (missing.length > 0) {
        return { error: `Session(s) not found: ${missing.join(", ")}`, status: 404 } as const
      }

      const results: Array<{ sessionId: string; ok: boolean; error?: string }> = []

      for (const sid of sessionIds) {
        if (action === "add") {
          const r = await applyAdd(tx, userId, sid, status, reason, authResult, req)
          if ("error" in r) return { error: r.error, status: r.status } as const
          results.push({ sessionId: sid, ok: true })
        } else if (action === "remove") {
          const r = await applyRemove(tx, userId, sid, reason, authResult, req)
          if ("error" in r) return { error: r.error, status: r.status } as const
          results.push({ sessionId: sid, ok: true })
        } else {
          // update
          const r = await applyUpdate(tx, userId, sid, status, payload, reason, authResult, req)
          if ("error" in r) return { error: r.error, status: r.status } as const
          results.push({ sessionId: sid, ok: true })
        }
      }

      return { ok: true, data: { action, processed: results.length, results } } as const
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true, data: result.data })
  } catch (error) {
    console.error("Attendance override error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
