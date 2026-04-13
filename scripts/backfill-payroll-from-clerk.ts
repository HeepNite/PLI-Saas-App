import "dotenv/config"

import { createClerkClient, type ClerkClient } from "@clerk/backend"
import { pathToFileURL } from "node:url"

import { prisma } from "@/lib/prisma"
import { extractStaffPayrollFallbackFromClerkUser } from "@/lib/security/staff-account-sync"

export type BackfillMode = "dry-run" | "write"

export type BackfillPayrollArgs = {
  mode: BackfillMode
  schoolId: string | null
}

type BackfillLogger = Pick<typeof console, "log" | "warn" | "error" | "table">

type StaffAccountRow = {
  id: string
  clerkUserId: string
  email: string
  hourlyRate: number | null
  paydayWeekday: number | null
}

type PrismaBackfillClient = {
  staffAccount: {
    findMany(args: {
      select: {
        id: true
        clerkUserId: true
        email: true
        hourlyRate: true
        paydayWeekday: true
      }
      orderBy: { email: "asc" }
    }): Promise<StaffAccountRow[]>
    update(args: {
      where: { id: string }
      data: {
        hourlyRate?: number
        paydayWeekday?: number
      }
    }): Promise<unknown>
  }
}

export type BackfillPayrollDeps = {
  prismaClient: PrismaBackfillClient
  clerk: Pick<ClerkClient, "users">
  logger: BackfillLogger
}

export type BackfillPayrollStaffResult = {
  clerkUserId: string
  staffAccountId: string
  email: string
  status: "updated" | "unchanged" | "skipped" | "failed"
  currentHourlyRate: number | null
  nextHourlyRate: number | null
  currentPaydayWeekday: number | null
  nextPaydayWeekday: number | null
  sentinelEntryCount: number
  reason?: string
}

export type BackfillPayrollSummary = {
  mode: BackfillMode
  schoolId: string | null
  processed: number
  succeeded: number
  failed: number
  skipped: number
  results: BackfillPayrollStaffResult[]
}

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const resolveSchoolIdFromClerkUser = (user: { publicMetadata?: unknown; privateMetadata?: unknown }): string | null => {
  const publicMetadata = asObject(user.publicMetadata)
  const privateMetadata = asObject(user.privateMetadata)

  return (
    asOptionalString(publicMetadata.schoolId) ||
    asOptionalString(publicMetadata.staffSchoolId) ||
    asOptionalString(privateMetadata.schoolId) ||
    asOptionalString(privateMetadata.staffSchoolId)
  )
}

const countHistoricalPaidEntries = (user: { publicMetadata?: unknown }): number => {
  const publicMetadata = asObject(user.publicMetadata)
  const payrollMetadata = asObject(publicMetadata.staffPayroll)
  return Array.isArray(payrollMetadata.paidEntries) ? payrollMetadata.paidEntries.length : 0
}

export const parseBackfillPayrollArgs = (argv: string[]): BackfillPayrollArgs => {
  let mode: BackfillMode = "dry-run"
  let schoolId: string | null = null

  for (const arg of argv) {
    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length)
      if (value !== "dry-run" && value !== "write") {
        throw new Error(`Invalid --mode value: ${value}. Expected dry-run or write.`)
      }
      mode = value
      continue
    }

    if (arg.startsWith("--school-id=")) {
      schoolId = asOptionalString(arg.slice("--school-id=".length))
    }
  }

  return { mode, schoolId }
}

export async function runBackfillPayrollFromClerk(
  args: BackfillPayrollArgs,
  deps: BackfillPayrollDeps
): Promise<BackfillPayrollSummary> {
  const staffAccounts = await deps.prismaClient.staffAccount.findMany({
    select: {
      id: true,
      clerkUserId: true,
      email: true,
      hourlyRate: true,
      paydayWeekday: true,
    },
    orderBy: { email: "asc" },
  })

  const summary: BackfillPayrollSummary = {
    mode: args.mode,
    schoolId: args.schoolId,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    results: [],
  }

  for (const staffAccount of staffAccounts) {
    summary.processed += 1

    try {
      const user = await deps.clerk.users.getUser(staffAccount.clerkUserId)
      const resolvedSchoolId = resolveSchoolIdFromClerkUser(user)

      if (args.schoolId && resolvedSchoolId !== args.schoolId) {
        summary.skipped += 1
        summary.results.push({
          clerkUserId: staffAccount.clerkUserId,
          staffAccountId: staffAccount.id,
          email: staffAccount.email,
          status: "skipped",
          currentHourlyRate: staffAccount.hourlyRate,
          nextHourlyRate: staffAccount.hourlyRate,
          currentPaydayWeekday: staffAccount.paydayWeekday,
          nextPaydayWeekday: staffAccount.paydayWeekday,
          sentinelEntryCount: countHistoricalPaidEntries(user),
          reason: `school mismatch (${resolvedSchoolId ?? "unknown"})`,
        })
        continue
      }

      const clerkPayroll = extractStaffPayrollFallbackFromClerkUser(user)
      const sentinelEntryCount = countHistoricalPaidEntries(user)
      const nextHourlyRate = clerkPayroll.hourlyRate ?? staffAccount.hourlyRate
      const nextPaydayWeekday = clerkPayroll.paydayWeekday ?? staffAccount.paydayWeekday

      if (clerkPayroll.hourlyRate === null && clerkPayroll.paydayWeekday === null) {
        deps.logger.warn(`Skipping ${staffAccount.clerkUserId}: missing Clerk payroll metadata`)
        summary.skipped += 1
        summary.results.push({
          clerkUserId: staffAccount.clerkUserId,
          staffAccountId: staffAccount.id,
          email: staffAccount.email,
          status: "skipped",
          currentHourlyRate: staffAccount.hourlyRate,
          nextHourlyRate,
          currentPaydayWeekday: staffAccount.paydayWeekday,
          nextPaydayWeekday,
          sentinelEntryCount,
          reason: "missing Clerk payroll metadata",
        })
        continue
      }

      const updateData: { hourlyRate?: number; paydayWeekday?: number } = {}
      if (clerkPayroll.hourlyRate !== null) updateData.hourlyRate = clerkPayroll.hourlyRate
      if (clerkPayroll.paydayWeekday !== null) updateData.paydayWeekday = clerkPayroll.paydayWeekday

      const changed =
        (updateData.hourlyRate !== undefined && updateData.hourlyRate !== staffAccount.hourlyRate) ||
        (updateData.paydayWeekday !== undefined && updateData.paydayWeekday !== staffAccount.paydayWeekday)

      if (args.mode === "write" && Object.keys(updateData).length > 0 && changed) {
        await deps.prismaClient.staffAccount.update({
          where: { id: staffAccount.id },
          data: updateData,
        })
      }

      summary.succeeded += 1
      summary.results.push({
        clerkUserId: staffAccount.clerkUserId,
        staffAccountId: staffAccount.id,
        email: staffAccount.email,
        status: changed ? "updated" : "unchanged",
        currentHourlyRate: staffAccount.hourlyRate,
        nextHourlyRate,
        currentPaydayWeekday: staffAccount.paydayWeekday,
        nextPaydayWeekday,
        sentinelEntryCount,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error"
      deps.logger.error(`Failed to backfill ${staffAccount.clerkUserId}:`, error)
      summary.failed += 1
      summary.results.push({
        clerkUserId: staffAccount.clerkUserId,
        staffAccountId: staffAccount.id,
        email: staffAccount.email,
        status: "failed",
        currentHourlyRate: staffAccount.hourlyRate,
        nextHourlyRate: staffAccount.hourlyRate,
        currentPaydayWeekday: staffAccount.paydayWeekday,
        nextPaydayWeekday: staffAccount.paydayWeekday,
        sentinelEntryCount: 0,
        reason,
      })
    }
  }

  deps.logger.table(
    summary.results.map((result) => ({
      clerkUserId: result.clerkUserId,
      status: result.status,
      currentHourlyRate: result.currentHourlyRate,
      nextHourlyRate: result.nextHourlyRate,
      currentPayday: result.currentPaydayWeekday,
      nextPayday: result.nextPaydayWeekday,
      sentinelEntryCount: result.sentinelEntryCount,
      reason: result.reason ?? "",
    }))
  )

  deps.logger.log(
    `[backfill-payroll-from-clerk] mode=${summary.mode} schoolId=${summary.schoolId ?? "all"} processed=${summary.processed} succeeded=${summary.succeeded} failed=${summary.failed} skipped=${summary.skipped}`
  )

  return summary
}

const createDefaultDeps = (): BackfillPayrollDeps => {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required to run payroll backfill")
  }

  return {
    prismaClient: prisma,
    clerk: createClerkClient({ secretKey }),
    logger: console,
  }
}

async function main() {
  const args = parseBackfillPayrollArgs(process.argv.slice(2))
  await runBackfillPayrollFromClerk(args, createDefaultDeps())
}

const isDirectExecution = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false

if (isDirectExecution) {
  main().catch((error) => {
    console.error("[backfill-payroll-from-clerk] fatal error", error)
    process.exitCode = 1
  })
}
