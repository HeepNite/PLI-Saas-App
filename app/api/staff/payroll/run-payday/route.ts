import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { jsonError, readJsonBody } from "@/lib/payroll/route-helpers"
import { deriveHoursWorked } from "@/lib/payroll/hours"
import { closeOpenClockEntriesForPayroll } from "@/lib/payroll/auto-closure"
import { UNAVAILABILITY_TYPES, UNAVAILABILITY_STATUSES } from "@/lib/payroll/types"

export const runtime = "nodejs"

interface SkippedStaff {
  staffId: string
  reason: string
}

async function getSchoolIdFromUserId(userId: string): Promise<string | null> {
  // Import here to avoid circular dependency
  const { resolveSchoolIdForClerkUser } = await import("@/lib/payroll/route-helpers")
  return resolveSchoolIdForClerkUser(userId)
}

async function resolveEffectivePaymentModel(staffAccountId: string, schoolId: string | null) {
  const staffAccount = await prisma.staffAccount.findUnique({
    where: { id: staffAccountId },
    select: {
      paymentModelId: true,
    },
  })

  if (!staffAccount) {
    return null
  }

  if (staffAccount.paymentModelId) {
    const model = await prisma.staffPaymentModel.findUnique({
      where: { id: staffAccount.paymentModelId },
      select: { 
        id: true, 
        hourlyRate: true, 
        currency: true, 
        defaultPaymentMethodId: true,
        paydayWeekday: true,
      },
    })
    if (model) {
      return {
        modelId: model.id,
        hourlyRate: model.hourlyRate,
        currency: model.currency,
        paymentMethodId: model.defaultPaymentMethodId,
        paydayWeekday: model.paydayWeekday,
      }
    }
  }

  if (!schoolId) {
    return null
  }

  const defaultModel = await prisma.staffPaymentModel.findFirst({
    where: {
      schoolId,
      isDefault: true,
      active: true,
    },
    select: { 
      id: true, 
      hourlyRate: true, 
      currency: true, 
      defaultPaymentMethodId: true,
      paydayWeekday: true,
    },
  })

  if (!defaultModel) {
    return null
  }

  return {
    modelId: defaultModel.id,
    hourlyRate: defaultModel.hourlyRate,
    currency: defaultModel.currency,
    paymentMethodId: defaultModel.defaultPaymentMethodId,
    paydayWeekday: defaultModel.paydayWeekday,
  }
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

async function checkForApprovedSuspension(
  prismaClient: typeof prisma,
  staffAccountId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<boolean> {
  const suspensionCount = await prismaClient.staffUnavailabilityRequest.count({
    where: {
      staffAccountId,
      type: UNAVAILABILITY_TYPES.SUSPENSION,
      status: UNAVAILABILITY_STATUSES.APPROVED,
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
    }
  })
  
  return suspensionCount > 0
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
  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

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
  
  // Fetch all active staff accounts for the school
  const staffAccounts = await getActiveStaffAccounts(schoolId)
  
  const results = {
    created: 0,
    skipped: [] as SkippedStaff[],
    errors: [] as Array<{ staffId: string; error: string }>
  }
  
  // Process each staff account
  for (const staffAccount of staffAccounts) {
    try {
      // Resolve effective payment model
      const paymentModel = await resolveEffectivePaymentModel(staffAccount.id, schoolId)
      
      if (!paymentModel) {
        results.errors.push({
          staffId: staffAccount.id,
          error: "No payment model found for staff member"
        })
        continue
      }
      
      // Check if paydayWeekday reached for current week
      // We'll consider the periodEnd date to determine if we should process this pay period
      const nextPayday = calculateNextPayday(periodStartDate, paymentModel.paydayWeekday)
      
      // For simplicity, we'll process if the periodEnd is on or after the calculated payday
      // In a real implementation, you might want to check if today is the payday
      const shouldProcess = periodEndDate >= nextPayday
      
      if (!shouldProcess) {
        results.skipped.push({
          staffId: staffAccount.id,
          reason: "Payday not reached for current week"
        })
        continue
      }
      
      // Check for approved suspension overlap
      const hasSuspension = await checkForApprovedSuspension(
        prisma,
        staffAccount.id,
        periodStartDate,
        periodEndDate
      )
      
      if (hasSuspension) {
        results.skipped.push({
          staffId: staffAccount.id,
          reason: "Approved suspension overlaps with period"
        })
        continue
      }
      
      // If dryRun, skip actual creation but count as would-be created
      if (dryRun) {
        results.created++
        continue
      }
      
      // P0: auto-close open clock entries before deriving hours (idempotent)
      await closeOpenClockEntriesForPayroll(prisma, {
        staffAccountId: staffAccount.id,
        periodStart: periodStartDate,
        periodEnd: periodEndDate,
        source: "payroll-run-payday",
      })

      // Calculate hours worked using the existing function
      const hoursResult = await deriveHoursWorked(
        prisma,
        staffAccount.id,
        periodStartDate,
        periodEndDate
      )
      const hoursWorked = hoursResult.hoursWorked
      
      // Calculate bonus amount (simplified - in reality this would be more complex)
      // For now, we'll set bonus to 0 as the B04 logic would handle this separately
      const bonusAmount = 0
      
      // Calculate amounts
      const grossAmount = Math.ceil(hoursWorked * paymentModel.hourlyRate * 100)
      const totalAmount = grossAmount + bonusAmount
      
      // Create payroll entry
      await prisma.staffPayrollEntry.create({
        data: {
          staffAccountId: staffAccount.id,
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
      
      results.created++
    } catch (error) {
      console.error(`Error processing staff ${staffAccount.id}:`, error)
      results.errors.push({
        staffId: staffAccount.id,
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }
  
  return NextResponse.json(results)
}
