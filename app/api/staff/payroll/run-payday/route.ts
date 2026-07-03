import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { jsonError, readJsonBody } from "@/lib/payroll/route-helpers"
import { deriveHoursWorked } from "@/lib/payroll/hours"
import { closeOpenClockEntriesForPayroll } from "@/lib/payroll/auto-closure"
import { UNAVAILABILITY_TYPES, UNAVAILABILITY_STATUSES } from "@/lib/payroll/types"

export const runtime = "nodejs"

interface SkippedStaff {
  staffId: string
  reason: string
}

interface ResolvedPaymentModel {
  modelId: string
  hourlyRate: number
  currency: string
  paymentMethodId: string | null
  paydayWeekday: number
}

async function getSchoolIdFromUserId(userId: string): Promise<string | null> {
  // Import here to avoid circular dependency
  const { resolveSchoolIdForClerkUser } = await import("@/lib/payroll/route-helpers")
  return resolveSchoolIdForClerkUser(userId)
}

async function getActiveStaffAccounts(schoolId: string | null) {
  const whereClause: { schoolId?: string } = {}
  if (schoolId) {
    whereClause.schoolId = schoolId
  }

  return prisma.staffAccount.findMany({
    where: {
      ...whereClause,
      banned: false,
      locked: false,
    },
    select: {
      id: true,
      paymentModelId: true,
    }
  })
}

/**
 * Batch-resolve payment models for all staff accounts in 2 queries
 * instead of 2-3 queries per staff member.
 */
async function batchResolvePaymentModels(
  staffAccounts: Array<{ id: string; paymentModelId: string | null }>,
  schoolId: string | null,
): Promise<Map<string, ResolvedPaymentModel>> {
  const modelIds = [...new Set(
    staffAccounts.map((s) => s.paymentModelId).filter((id): id is string => Boolean(id))
  )]

  // Batch 1: fetch all referenced payment models + default model in parallel
  const [assignedModels, defaultModel] = await Promise.all([
    modelIds.length
      ? prisma.staffPaymentModel.findMany({
          where: { id: { in: modelIds } },
          select: {
            id: true,
            hourlyRate: true,
            currency: true,
            defaultPaymentMethodId: true,
            paydayWeekday: true,
          },
        })
      : Promise.resolve([]),
    schoolId
      ? prisma.staffPaymentModel.findFirst({
          where: { schoolId, isDefault: true, active: true },
          select: {
            id: true,
            hourlyRate: true,
            currency: true,
            defaultPaymentMethodId: true,
            paydayWeekday: true,
          },
        })
      : Promise.resolve(null),
  ])

  const modelById = new Map(assignedModels.map((m) => [m.id, m]))

  const result = new Map<string, ResolvedPaymentModel>()
  for (const staff of staffAccounts) {
    const model = staff.paymentModelId ? modelById.get(staff.paymentModelId) : null
    const resolved = model ?? defaultModel
    if (resolved) {
      result.set(staff.id, {
        modelId: resolved.id,
        hourlyRate: resolved.hourlyRate,
        currency: resolved.currency,
        paymentMethodId: resolved.defaultPaymentMethodId,
        paydayWeekday: resolved.paydayWeekday,
      })
    }
  }

  return result
}

/**
 * Batch-check suspensions for all staff accounts in 1 query
 * instead of 1 query per staff member.
 */
async function batchCheckSuspensions(
  staffIds: string[],
  periodStart: Date,
  periodEnd: Date,
): Promise<Set<string>> {
  if (staffIds.length === 0) return new Set()

  const suspensions = await prisma.staffUnavailabilityRequest.findMany({
    where: {
      staffAccountId: { in: staffIds },
      type: UNAVAILABILITY_TYPES.SUSPENSION,
      status: UNAVAILABILITY_STATUSES.APPROVED,
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
    },
    select: { staffAccountId: true },
    distinct: ["staffAccountId"],
  })

  return new Set(suspensions.map((s) => s.staffAccountId))
}

function calculateNextPayday(
  referenceDate: Date,
  paydayWeekday: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
): Date {
  const result = new Date(referenceDate)
  const currentDay = result.getDay()
  
  // Days until next payday (0 if today is payday)
  let daysUntilPayday = (paydayWeekday - currentDay + 7) % 7
  
  // If today is payday but we want the next occurrence, add 7 days
  if (daysUntilPayday === 0) {
    daysUntilPayday = 7
  }
  
  result.setDate(result.getDate() + daysUntilPayday)
  result.setHours(0, 0, 0, 0)
  
  return result
}

export async function POST(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: {
      scope: "staff:payroll:run-payday:post",
      limit: 10,
      windowMs: 60_000,
    },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const body = parsedBody.body as unknown
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonError("Invalid JSON body", 400)
  }
  
  const { periodStart, periodEnd, dryRun = false } = body as {
    periodStart?: string
    periodEnd?: string
    dryRun?: boolean
  }
  
  if (!periodStart || typeof periodStart !== "string") {
    return jsonError("periodStart is required", 422)
  }
  
  if (!periodEnd || typeof periodEnd !== "string") {
    return jsonError("periodEnd is required", 422)
  }

  const periodStartDate = new Date(periodStart)
  const periodEndDate = new Date(periodEnd)

  if (isNaN(periodStartDate.getTime())) {
    return jsonError("Invalid periodStart date", 422)
  }
  
  if (isNaN(periodEndDate.getTime())) {
    return jsonError("Invalid periodEnd date", 422)
  }

  if (periodStartDate >= periodEndDate) {
    return jsonError("Period start must be before period end", 422)
  }

  // Get school ID from the authenticated user
  const schoolId = await getSchoolIdFromUserId(authResult.userId)

  // Batch: fetch staff accounts, then payment models + suspensions in parallel
  const staffAccounts = await getActiveStaffAccounts(schoolId)
  const staffIds = staffAccounts.map((s) => s.id)

  const [paymentModelMap, suspendedStaffIds] = await Promise.all([
    batchResolvePaymentModels(staffAccounts, schoolId),
    batchCheckSuspensions(staffIds, periodStartDate, periodEndDate),
  ])

  const results = {
    created: 0,
    skipped: [] as SkippedStaff[],
    errors: [] as Array<{ staffId: string; error: string }>
  }

  // Pre-filter: resolve skips and errors synchronously before doing any DB writes
  const staffToProcess: Array<{ id: string; paymentModel: ResolvedPaymentModel }> = []

  for (const staffAccount of staffAccounts) {
    const paymentModel = paymentModelMap.get(staffAccount.id)

    if (!paymentModel) {
      results.errors.push({
        staffId: staffAccount.id,
        error: "No payment model found for staff member"
      })
      continue
    }

    const nextPayday = calculateNextPayday(periodStartDate, paymentModel.paydayWeekday)
    if (periodEndDate < nextPayday) {
      results.skipped.push({
        staffId: staffAccount.id,
        reason: "Payday not reached for current week"
      })
      continue
    }

    if (suspendedStaffIds.has(staffAccount.id)) {
      results.skipped.push({
        staffId: staffAccount.id,
        reason: "Approved suspension overlaps with period"
      })
      continue
    }

    if (dryRun) {
      results.created++
      continue
    }

    staffToProcess.push({ id: staffAccount.id, paymentModel })
  }

  // Process remaining staff in parallel (close → derive → create per staff)
  const processResults = await Promise.allSettled(
    staffToProcess.map(async ({ id, paymentModel }) => {
      await closeOpenClockEntriesForPayroll(prisma, {
        staffAccountId: id,
        periodStart: periodStartDate,
        periodEnd: periodEndDate,
        source: "payroll-run-payday",
      })

      const { hoursWorked } = await deriveHoursWorked(
        prisma,
        id,
        periodStartDate,
        periodEndDate
      )

      const bonusAmount = 0
      const grossAmount = Math.ceil(hoursWorked * paymentModel.hourlyRate * 100)
      const totalAmount = grossAmount + bonusAmount

      await prisma.staffPayrollEntry.create({
        data: {
          staffAccountId: id,
          periodStart: periodStartDate,
          periodEnd: periodEndDate,
          hoursWorked,
          hourlyRate: paymentModel.hourlyRate,
          grossAmount,
          bonusAmount,
          totalAmount,
          currency: paymentModel.currency,
          status: "pending",
          paymentMethodId: paymentModel.paymentMethodId,
          paymentModelId: paymentModel.modelId,
        }
      })

      return id
    })
  )

  for (let i = 0; i < processResults.length; i++) {
    const result = processResults[i]
    if (result.status === "fulfilled") {
      results.created++
    } else {
      const staffId = staffToProcess[i].id
      console.error(`Error processing staff ${staffId}:`, result.reason)
      results.errors.push({
        staffId,
        error: result.reason instanceof Error ? result.reason.message : "Unknown error"
      })
    }
  }

  return NextResponse.json(results)
}
