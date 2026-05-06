import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { deriveHoursWorked } from "@/lib/payroll/hours"
import { closeOpenClockEntriesForPayroll } from "@/lib/payroll/auto-closure"
import { resolveSchoolIdForClerkUser } from "@/lib/payroll/route-helpers"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { PAYROLL_ENTRY_STATUSES, CREDIT_LEDGER_ENTRY_TYPES } from "@/lib/payroll/types"

export const runtime = "nodejs"

function computeNextPayday(weekday: number | null): Date | null {
  if (weekday === null) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentWeekday = today.getDay()
  let daysUntil = weekday - currentWeekday
  if (daysUntil <= 0) daysUntil += 7
  const next = new Date(today)
  next.setDate(today.getDate() + daysUntil)
  return next
}

export async function GET(req: Request) {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const url = new URL(req.url)
  const limitParam = url.searchParams.get("limit")
  const creditParam = url.searchParams.get("creditLimit")
  const historyLimit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 100) : 10
  const creditHistoryLimit = creditParam ? Math.min(Math.max(parseInt(creditParam, 10) || 20, 1), 100) : 20

  const schoolId = await resolveSchoolIdForClerkUser(authResult.userId)

  const staffAccount = await prisma.staffAccount.findUnique({
    where: { clerkUserId: authResult.userId },
    select: {
      id: true,
      clerkUserId: true,
      hourlyRate: true,
      paydayWeekday: true,
      paymentModelId: true,
    },
  })

  if (!staffAccount) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 })
  }

  const effectivePaymentModel =
    (await prisma.staffPaymentModel.findFirst({
      where: { schoolId, isDefault: true },
      orderBy: { updatedAt: "desc" },
    })) ??
    (await prisma.staffPaymentModel.findFirst({
      where: { schoolId },
      orderBy: { updatedAt: "desc" },
    }))

  const hourlyRate = staffAccount.hourlyRate ?? effectivePaymentModel?.hourlyRate ?? 0

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  // P0: auto-close open clock entries before deriving hours (idempotent)
  await closeOpenClockEntriesForPayroll(prisma, {
    staffAccountId: staffAccount.id,
    periodStart,
    periodEnd,
    source: "payroll-me",
  })

  const { hoursWorked } = await deriveHoursWorked(prisma, staffAccount.id, periodStart, periodEnd)
  const calculatedAmount = Math.round(hoursWorked * hourlyRate * 100)

  const latestEntry = await prisma.staffPayrollEntry.findFirst({
    where: { staffAccountId: staffAccount.id },
    orderBy: { periodEnd: "desc" },
    select: { status: true },
  })

  const status = latestEntry?.status ?? "pending"

  const nextPayday = computeNextPayday(
    effectivePaymentModel?.paydayWeekday ?? staffAccount.paydayWeekday
  )

  const history = await prisma.staffPayrollEntry.findMany({
    where: { staffAccountId: staffAccount.id },
    orderBy: { periodEnd: "desc" },
    take: historyLimit,
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      hoursWorked: true,
      hourlyRate: true,
      grossAmount: true,
      bonusAmount: true,
      totalAmount: true,
      currency: true,
      status: true,
      paidAt: true,
    },
  })

  const creditBalanceResult = await prisma.staffCreditLedgerEntry.aggregate({
    where: {
      staffAccountId: staffAccount.id,
      type: { not: CREDIT_LEDGER_ENTRY_TYPES.FORFEITURE },
    },
    _sum: { amount: true },
  })

  const creditBalance = creditBalanceResult._sum.amount ?? 0

  const creditHistory = await prisma.staffCreditLedgerEntry.findMany({
    where: { staffAccountId: staffAccount.id },
    orderBy: { createdAt: "desc" },
    take: creditHistoryLimit,
    select: {
      id: true,
      type: true,
      amount: true,
      note: true,
      eventKey: true,
      awardedBy: true,
      createdAt: true,
    },
  })

  const activeBonuses = await prisma.staffPayrollBonus.findMany({
    where: {
      staffAccountId: staffAccount.id,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      type: true,
      amount: true,
      note: true,
      expiresAt: true,
      active: true,
      entryId: true,
    },
  })

  const pendingProposals = await prisma.staffPayrollEntry.findMany({
    where: {
      staffAccountId: staffAccount.id,
      status: PAYROLL_ENTRY_STATUSES.PARTIAL_PROPOSED,
    },
    orderBy: { periodEnd: "desc" },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      hoursWorked: true,
      hourlyRate: true,
      grossAmount: true,
      proposedAmount: true,
      proposedBy: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    currentCycle: {
      hoursWorked,
      hourlyRate,
      calculatedAmount,
      status,
      nextPayday: nextPayday?.toISOString() ?? null,
    },
    history,
    creditBalance,
    creditHistory,
    activeBonuses,
    pendingProposals,
  })
}