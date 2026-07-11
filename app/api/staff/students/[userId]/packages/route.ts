import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerOrAdminRequest, authorizeStudentOperationalRequest } from "@/lib/security/staff-portal-auth"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { getClientIp } from "@/lib/security/rate-limit"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { PAYMENT_CHANNEL, PURCHASE_SOURCE, SETTLEMENT_STATUS } from "@/lib/payment-constants"

export const runtime = "nodejs"

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Pending idempotency lookups only need to cover the double-submit window.
const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

// Thrown inside the $transaction to abort the write and surface a 409 to the caller once the
// duplicate-active-plan check (now transaction-scoped, see issue #1 fix) finds a match.
class DuplicateActivePackageError extends Error {
  constructor(public readonly existing: { id: string; packageLabel: string | null; expiresAt: Date | null }) {
    super("Duplicate active package")
  }
}

export async function GET(req: Request, context: { params: Promise<{ userId: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:packages:get", limit: 120, windowMs: 60_000 },
    authorize: () => authorizeOwnerOrAdminRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  try {
    const student = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
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
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:packages:patch", limit: 90, windowMs: 60_000 },
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

/**
 * Grant a cash package to a student from the admin/front-desk student panel.
 *
 * Creates ONLY a pending cash `Purchase` seeded from the chosen `PackagePlan`
 * — byte-parity with the tablet single-purchase metadata shape in
 * `app/api/checkout/cash/route.ts`. It does NOT create a `PackagePurchase`;
 * materialization happens later via the unchanged mark-paid path
 * (`syncPackagePurchaseFromPaidPurchase` in `lib/packages.ts`).
 */
export async function POST(req: Request, context: { params: Promise<{ userId: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:packages:post", limit: 30, windowMs: 60_000 },
    authorize: () => authorizeStudentOperationalRequest(),
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

  const packagePlanId = typeof payload.packagePlanId === "string" ? payload.packagePlanId.trim() : ""
  const key = typeof payload.key === "string" ? payload.key.trim() : ""
  if (!packagePlanId && !key) {
    return NextResponse.json({ error: "packagePlanId or key is required." }, { status: 400 })
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : ""
  if (!reason || reason.length > 500) {
    return NextResponse.json({ error: "Reason is required (max 500 characters)." }, { status: 400 })
  }

  const confirmDuplicate = payload.confirmDuplicate === true
  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey.trim() : ""

  if (!idempotencyKey) {
    return NextResponse.json({ error: "idempotencyKey is required." }, { status: 400 })
  }

  let expiresAtDate: Date | null = null
  if ("expiresAt" in payload && payload.expiresAt !== undefined && payload.expiresAt !== null && payload.expiresAt !== "") {
    if (typeof payload.expiresAt !== "string") {
      return NextResponse.json({ error: "expiresAt must be an ISO date string." }, { status: 400 })
    }
    const parsed = new Date(payload.expiresAt)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "expiresAt must be a valid ISO date string." }, { status: 400 })
    }
    if (parsed.getTime() <= Date.now()) {
      return NextResponse.json({ error: "expiresAt must be in the future." }, { status: 400 })
    }
    expiresAtDate = parsed
  }

  const purchaseSource = authResult.role === "owner" || authResult.role === "admin"
    ? PURCHASE_SOURCE.ADMIN
    : PURCHASE_SOURCE.FRONT_DESK

  try {
    const student = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const plan = await prisma.packagePlan.findFirst({
      where: packagePlanId ? { id: packagePlanId } : { key },
    })
    if (!plan) {
      return NextResponse.json({ error: "Package plan not found" }, { status: 404 })
    }
    if (!plan.active || plan.priceCents == null) {
      return NextResponse.json({ error: "Package plan is not available for purchase." }, { status: 400 })
    }

    // Idempotency pre-check: fast-path return for a recent double-submit. This is only a
    // best-effort shortcut — the `Purchase.idempotencyKey` unique DB constraint (see
    // prisma/schema.prisma) is the actual concurrency guard for two racing requests, handled
    // via the P2002 catch below.
    if (idempotencyKey) {
      const since = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS)
      const existingByIdempotencyKey = await prisma.purchase.findFirst({
        where: { userId, idempotencyKey, createdAt: { gte: since } },
      })
      if (existingByIdempotencyKey) {
        return NextResponse.json({
          ok: true,
          data: { purchaseId: existingByIdempotencyKey.id, settlementStatus: SETTLEMENT_STATUS.PENDING },
        })
      }
    }

    // LOAD-BEARING: syncPackagePurchaseFromPaidPurchase only reads metadata.packageValidDays
    // to compute expiresAt at materialization time (purchasedAt + validDays). It never reads
    // an explicit expiresAt. To honor a staff-editable expiry without touching the shared
    // mark-paid/sync path, translate the chosen expiry into a validDays count here.
    const packageValidDays = expiresAtDate
      ? String(Math.max(1, Math.ceil((expiresAtDate.getTime() - Date.now()) / MS_PER_DAY)))
      : String(plan.validDays)

    const courseSlug = plan.courseSlug ?? plan.courseSlugs[0] ?? null

    let result: Awaited<ReturnType<typeof prisma.purchase.create>>
    try {
      result = await prisma.$transaction(async (tx) => {
        // Duplicate-active-plan check runs inside the transaction so the read-then-decide
        // is consistent with the write that follows it.
        const existingActivePackage = await tx.packagePurchase.findFirst({
          where: {
            userId,
            status: "active",
            OR: [{ packagePlanId: plan.id }, { packageId: plan.key }],
          },
          select: { id: true, packageLabel: true, expiresAt: true },
        })
        if (existingActivePackage && !confirmDuplicate) {
          throw new DuplicateActivePackageError(existingActivePackage)
        }

        const purchase = await tx.purchase.create({
          data: {
            userId,
            courseSlug: courseSlug || "_staff_package_grant",
            courseTitle: plan.label,
            amount: plan.priceCents!,
            currency: "usd",
            status: "pending",
            participants: 1,
            packageId: plan.key,
            idempotencyKey,
            metadata: {
              source: "cash_checkout",
              purchaseSource,
              paymentMethod: "onsite",
              paymentChannel: PAYMENT_CHANNEL.CASH,
              settlementStatus: SETTLEMENT_STATUS.PENDING,
              settledAt: null,
              courseSlug,
              packageId: plan.key,
              packageLabel: plan.label || "",
              packageTotalCredits: plan.totalCredits === null ? "" : String(plan.totalCredits),
              packageIsUnlimited: String(plan.isUnlimited),
              packageCadence: plan.cadence || "",
              packageMakeUps: String(plan.makeUps),
              packageValidDays,
              userId,
              participants: "1",
              requiresCardMigration: true,
              idempotencyKey,
            },
          },
        })

        await writeStudentDataAudit(
          {
            targetUserId: userId,
            staffClerkId: authResult.userId,
            staffName: authResult.staffName,
            entity: "package",
            entityId: purchase.id,
            field: "created",
            valueBefore: null,
            valueAfter: {
              packagePlanId: plan.id,
              packageKey: plan.key,
              packageLabel: plan.label,
              paymentChannel: PAYMENT_CHANNEL.CASH,
            },
            reason,
            ipAddress: getClientIp(req),
          },
          tx
        )

        return purchase
      })
    } catch (transactionError) {
      if (transactionError instanceof DuplicateActivePackageError) {
        return NextResponse.json(
          {
            error: "Student already has an active package for this plan.",
            code: "DUPLICATE_ACTIVE_PACKAGE",
            existing: {
              id: transactionError.existing.id,
              label: transactionError.existing.packageLabel,
              expiresAt: transactionError.existing.expiresAt,
            },
          },
          { status: 409 }
        )
      }

      // Two concurrent/double-click requests can both pass the pre-check above; the DB-level
      // unique constraint on Purchase.idempotencyKey is the real guard. On a unique violation,
      // treat it as the idempotent duplicate and return the winning row instead of a 500.
      if (isUniqueConstraintError(transactionError)) {
        const winningPurchase = await prisma.purchase.findFirst({ where: { userId, idempotencyKey } })
        if (winningPurchase) {
          return NextResponse.json({
            ok: true,
            data: { purchaseId: winningPurchase.id, settlementStatus: SETTLEMENT_STATUS.PENDING },
          })
        }
      }

      throw transactionError
    }

    return NextResponse.json(
      { ok: true, data: { purchaseId: result.id, settlementStatus: SETTLEMENT_STATUS.PENDING } },
      { status: 201 }
    )
  } catch (error) {
    console.error("Package grant error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
