import "dotenv/config"

import { createClerkClient, type ClerkClient } from "@clerk/backend"
import { pathToFileURL } from "node:url"

import { prisma } from "@/lib/prisma"

// ── Types ──────────────────────────────────────────────────────────

export type MigrationMode = "dry-run" | "write"

export type MigrateArgs = {
  mode: MigrationMode
  limit?: number
  delta?: boolean
  userId?: string
  remap?: boolean
}

type MigrateLogger = Pick<Console, "log" | "warn" | "error" | "table">

export type MigratePrismaUserRow = {
  id: string
  clerkId: string
  email: string
  name: string | null
  phone: string | null
  updatedAt: Date
}

export type MigratePrismaStaffRow = {
  id: string
  clerkUserId: string
  email: string
  phone: string | null
  firstName: string | null
  lastName: string | null
  metadata: unknown
  updatedAt: Date
}

export type MigratePrismaClient = {
  user: {
    findMany(args: {
      where: { clerkId: { not: null }; updatedAt?: { gt: Date } }
      orderBy: { id: "asc" }
    }): Promise<MigratePrismaUserRow[]>
  }
  staffAccount: {
    findMany(args: {
      where?: { updatedAt?: { gt: Date } }
      orderBy: { id: "asc" }
    }): Promise<MigratePrismaStaffRow[]>
  }
  clerkIdMigration: {
    findUnique(args: {
      where: { entity_appId: { entity: string; appId: string } }
    }): Promise<ClerkIdMigrationRow | null>
    upsert(args: {
      where: { entity_appId: { entity: string; appId: string } }
      create: ClerkIdMigrationCreateInput
      update: ClerkIdMigrationUpdateInput
    }): Promise<ClerkIdMigrationRow>
    findMany(args?: { where?: { phase?: string } }): Promise<ClerkIdMigrationRow[]>
  }
  $transaction<T>(fn: (tx: MigrateTransactionClient) => Promise<T>): Promise<T>
}

export type MigrateTransactionClient = {
  user: {
    update(args: { where: { id: string }; data: { clerkId: string } }): Promise<unknown>
    findFirst(args: { where: { clerkId: string } }): Promise<{ id: string } | null>
  }
  staffAccount: {
    update(args: { where: { id: string }; data: { clerkUserId: string } }): Promise<unknown>
    findFirst(args: { where: { clerkUserId: string } }): Promise<{ id: string } | null>
  }
}

export type ClerkIdMigrationPhase = "user_created" | "phone_attached" | "skipped_deleted"

export type ClerkIdMigrationRow = {
  id: string
  entity: "user" | "staff"
  appId: string
  oldClerkId: string
  newClerkId: string
  phone: string | null
  email: string | null
  phase: ClerkIdMigrationPhase
  createdAt: Date
  appliedAt: Date | null
}

type ClerkIdMigrationCreateInput = {
  entity: "user" | "staff"
  appId: string
  oldClerkId: string
  newClerkId: string
  phone: string | null
  email: string | null
  phase: ClerkIdMigrationPhase
}

type ClerkIdMigrationUpdateInput = Partial<{
  newClerkId: string
  phone: string | null
  email: string | null
  phase: ClerkIdMigrationPhase
  appliedAt: Date
}>

export type MigrateSourceClient = Pick<ClerkClient, "users">
export type MigrateTargetClient = Pick<ClerkClient, "users" | "phoneNumbers">

export type MigrateDeps = {
  source: MigrateSourceClient
  target: MigrateTargetClient
  prismaClient: MigratePrismaClient
  logger: MigrateLogger
}

export type PerUserResult = {
  entity: "user" | "staff"
  appId: string
  oldClerkId: string
  newClerkId?: string
  phase: ClerkIdMigrationPhase | "reused" | "failed"
  reason?: string
}

export type MigrateResult = {
  mode: MigrationMode
  processed: number
  created: number
  phoneAttached: number
  reused: number
  skippedDeleted: number
  failed: number
  results: PerUserResult[]
}

export type RemapResult = {
  remapped: number
  results: Array<{ entity: "user" | "staff"; appId: string; newClerkId: string }>
}

export type RollbackResult = {
  restored: number
  skipped: Array<{ entity: "user" | "staff"; appId: string; reason: string }>
}

// ── CLI args ───────────────────────────────────────────────────────

export const parseMigrateArgs = (argv: string[]): MigrateArgs => {
  let mode: MigrationMode = "dry-run"
  let limit: number | undefined
  let delta = false
  let userId: string | undefined
  let remap = false

  for (const arg of argv) {
    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length)
      if (value !== "dry-run" && value !== "write") {
        throw new Error(`Invalid --mode value: ${value}. Expected dry-run or write.`)
      }
      mode = value
      continue
    }

    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length))
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --limit value: ${arg.slice("--limit=".length)}. Expected a positive integer.`)
      }
      limit = Math.floor(value)
      continue
    }

    if (arg.startsWith("--userId=")) {
      const value = arg.slice("--userId=".length).trim()
      userId = value.length > 0 ? value : undefined
      continue
    }

    if (arg === "--delta") {
      delta = true
      continue
    }

    if (arg === "--remap") {
      remap = true
      continue
    }
  }

  return { mode, limit, delta, userId, remap }
}

// ── E.164 normalization (design D7) ──────────────────────────────────
//
// Exact branching, no guessing on ambiguous input:
//   bare digits, length 10             ⇒ prepend "+1"
//   bare digits, length 11, starts "1" ⇒ prepend "+" only (no double "1")
//   bare digits, length 11, not "1"-led ⇒ reject (undefined)
//   bare digits, any other length      ⇒ reject (undefined)
//   already "+"-prefixed               ⇒ validate as-is (length/format check)

const MIN_E164_DIGITS = 8
const MAX_E164_DIGITS = 15

export const digitsToE164 = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/\D/g, "")
    if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS) return undefined
    return `+${digits}`
  }

  const digits = trimmed.replace(/\D/g, "")
  if (digits.length !== trimmed.length) return undefined

  if (digits.length === 10) {
    return `+1${digits}`
  }

  if (digits.length === 11) {
    return digits.startsWith("1") ? `+${digits}` : undefined
  }

  return undefined
}

// ── Placeholder email detection ───────────────────────────────────

const PLACEHOLDER_EMAIL_PATTERN = /^phone-.*@placeholder\.pli\.local$/

export const isPlaceholderEmail = (email: string | null | undefined): boolean => {
  if (!email) return false
  return PLACEHOLDER_EMAIL_PATTERN.test(email)
}

// ── Metadata bucket extraction (D6 — copied verbatim, no consolidation) ──

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

type MetadataBuckets = {
  publicMetadata: Record<string, unknown>
  privateMetadata: Record<string, unknown>
  unsafeMetadata: Record<string, unknown>
}

const extractMetadataBucketsFromStaffMetadata = (metadata: unknown): MetadataBuckets => {
  const record = asRecord(metadata)
  return {
    publicMetadata: asRecord(record.publicMetadata),
    privateMetadata: asRecord(record.privateMetadata),
    unsafeMetadata: asRecord(record.unsafeMetadata),
  }
}

// ── Sleep / rate limiting ─────────────────────────────────────────

const RATE_LIMIT_SLEEP_MS = 120
const MAX_RETRY_ATTEMPTS = 5
const INITIAL_BACKOFF_MS = 250

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const isRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false
  const status = (error as { status?: unknown; statusCode?: unknown }).status ?? (error as { statusCode?: unknown }).statusCode
  return status === 429
}

/**
 * Runs a Clerk write call with exponential backoff retry on 429 responses.
 * Never aborts the run for one user — callers wrap this in their own
 * per-user try/catch to record failures and continue.
 */
export const withRateLimitRetry = async <T>(
  fn: () => Promise<T>,
  logger: MigrateLogger,
  maxAttempts: number = MAX_RETRY_ATTEMPTS
): Promise<T> => {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxAttempts - 1) {
        throw error
      }
      const backoffMs = INITIAL_BACKOFF_MS * 2 ** attempt
      logger.warn(`[migrate-clerk-instance] 429 rate limited, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxAttempts})`)
      await sleep(backoffMs)
      attempt += 1
    }
  }
}

// ── Candidate model (unifies User + StaffAccount enumeration) ────

type MigrationCandidate = {
  entity: "user" | "staff"
  appId: string
  oldClerkId: string
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  staffMetadata: unknown
}

const candidateFromUserRow = (row: MigratePrismaUserRow): MigrationCandidate => {
  const nameParts = row.name?.trim().split(/\s+/) ?? []
  return {
    entity: "user",
    appId: row.id,
    oldClerkId: row.clerkId,
    email: row.email,
    phone: row.phone,
    firstName: nameParts[0] ?? null,
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
    staffMetadata: undefined,
  }
}

const candidateFromStaffRow = (row: MigratePrismaStaffRow): MigrationCandidate => ({
  entity: "staff",
  appId: row.id,
  oldClerkId: row.clerkUserId,
  email: row.email,
  phone: row.phone,
  firstName: row.firstName,
  lastName: row.lastName,
  staffMetadata: row.metadata,
})

const enumerateCandidates = async (
  prismaClient: MigratePrismaClient,
  args: MigrateArgs,
  sinceUpdatedAt: Date | undefined
): Promise<MigrationCandidate[]> => {
  const userWhere: { clerkId: { not: null }; updatedAt?: { gt: Date } } = { clerkId: { not: null } }
  const staffWhere: { updatedAt?: { gt: Date } } = {}

  if (args.delta && sinceUpdatedAt) {
    userWhere.updatedAt = { gt: sinceUpdatedAt }
    staffWhere.updatedAt = { gt: sinceUpdatedAt }
  }

  const [userRows, staffRows] = await Promise.all([
    prismaClient.user.findMany({ where: userWhere, orderBy: { id: "asc" } }),
    prismaClient.staffAccount.findMany({ where: staffWhere, orderBy: { id: "asc" } }),
  ])

  const candidates = [...userRows.map(candidateFromUserRow), ...staffRows.map(candidateFromStaffRow)]

  if (args.userId) {
    return candidates.filter((candidate) => candidate.oldClerkId === args.userId)
  }

  if (args.limit) {
    return candidates.slice(0, args.limit)
  }

  return candidates
}

// ── Idempotency lookup ────────────────────────────────────────────
//
// Bulk pass: phone-first (email fallback, skipped for placeholder emails).
// Delta pass: map-first by (entity, appId) — see design "Idempotency
// lookup: bulk pass vs delta pass".

const findExistingTargetUser = async (
  target: MigrateTargetClient,
  candidate: MigrationCandidate
): Promise<{ id: string } | null> => {
  const e164Phone = digitsToE164(candidate.phone)
  if (e164Phone) {
    const byPhone = await target.users.getUserList({ phoneNumber: [e164Phone], limit: 1 })
    if (byPhone.data.length > 0) return byPhone.data[0]
  }

  if (candidate.email && !isPlaceholderEmail(candidate.email)) {
    const byEmail = await target.users.getUserList({ emailAddress: [candidate.email], limit: 1 })
    if (byEmail.data.length > 0) return byEmail.data[0]
  }

  return null
}

// ── Per-user migration sequence ───────────────────────────────────

const migrateCandidate = async (
  candidate: MigrationCandidate,
  args: MigrateArgs,
  deps: MigrateDeps
): Promise<PerUserResult> => {
  const { source, target, prismaClient, logger } = deps
  const isDryRun = args.mode === "dry-run"

  // 1. Delta pass identity resolution — map-first, never re-create.
  const existingMapRow = await prismaClient.clerkIdMigration.findUnique({
    where: { entity_appId: { entity: candidate.entity, appId: candidate.appId } },
  })

  if (existingMapRow && (existingMapRow.phase === "user_created" || existingMapRow.phase === "phone_attached")) {
    return migrateFromExistingMapRow(candidate, existingMapRow, args, deps)
  }

  // 2. Cross-check against SOURCE instance — deleted-in-Clerk skip.
  try {
    await source.users.getUser(candidate.oldClerkId)
  } catch {
    if (!isDryRun) {
      await prismaClient.clerkIdMigration.upsert({
        where: { entity_appId: { entity: candidate.entity, appId: candidate.appId } },
        create: {
          entity: candidate.entity,
          appId: candidate.appId,
          oldClerkId: candidate.oldClerkId,
          newClerkId: "",
          phone: candidate.phone,
          email: candidate.email,
          phase: "skipped_deleted",
        },
        update: { phase: "skipped_deleted" },
      })
    }
    return { entity: candidate.entity, appId: candidate.appId, oldClerkId: candidate.oldClerkId, phase: "skipped_deleted" }
  }

  await sleep(RATE_LIMIT_SLEEP_MS)

  // 3. Bulk-pass idempotency check (phone-first, email fallback).
  const existingTargetUser = await findExistingTargetUser(target, candidate)
  if (existingTargetUser) {
    if (!isDryRun) {
      await prismaClient.clerkIdMigration.upsert({
        where: { entity_appId: { entity: candidate.entity, appId: candidate.appId } },
        create: {
          entity: candidate.entity,
          appId: candidate.appId,
          oldClerkId: candidate.oldClerkId,
          newClerkId: existingTargetUser.id,
          phone: candidate.phone,
          email: candidate.email,
          phase: "phone_attached",
        },
        update: { newClerkId: existingTargetUser.id, phase: "phone_attached" },
      })
    }
    return {
      entity: candidate.entity,
      appId: candidate.appId,
      oldClerkId: candidate.oldClerkId,
      newClerkId: existingTargetUser.id,
      phase: "reused",
    }
  }

  if (isDryRun) {
    return { entity: candidate.entity, appId: candidate.appId, oldClerkId: candidate.oldClerkId, phase: "user_created" }
  }

  // 4. createUser — metadata verbatim per bucket, skipPasswordRequirement.
  const metadataBuckets = extractMetadataBucketsFromStaffMetadata(candidate.staffMetadata)
  const emailAddress = candidate.email && !isPlaceholderEmail(candidate.email) ? [candidate.email] : undefined

  let createdUser: { id: string }
  try {
    createdUser = await withRateLimitRetry(
      () =>
        target.users.createUser({
          firstName: candidate.firstName ?? undefined,
          lastName: candidate.lastName ?? undefined,
          emailAddress,
          publicMetadata: metadataBuckets.publicMetadata,
          privateMetadata: metadataBuckets.privateMetadata,
          unsafeMetadata: metadataBuckets.unsafeMetadata,
          skipPasswordRequirement: true,
        }),
      logger
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error"
    logger.error(`[migrate-clerk-instance] createUser failed for ${candidate.entity}:${candidate.appId}`, error)
    return { entity: candidate.entity, appId: candidate.appId, oldClerkId: candidate.oldClerkId, phase: "failed", reason }
  }

  await prismaClient.clerkIdMigration.upsert({
    where: { entity_appId: { entity: candidate.entity, appId: candidate.appId } },
    create: {
      entity: candidate.entity,
      appId: candidate.appId,
      oldClerkId: candidate.oldClerkId,
      newClerkId: createdUser.id,
      phone: candidate.phone,
      email: candidate.email,
      phase: "user_created",
    },
    update: { newClerkId: createdUser.id, phase: "user_created" },
  })

  return attachPhone(candidate, createdUser.id, args, deps)
}

/**
 * Delta pass: a map row already exists (phase user_created|phone_attached).
 * Reconcile against the existing prod user — never re-create.
 */
const migrateFromExistingMapRow = async (
  candidate: MigrationCandidate,
  mapRow: ClerkIdMigrationRow,
  args: MigrateArgs,
  deps: MigrateDeps
): Promise<PerUserResult> => {
  if (mapRow.phase === "phone_attached") {
    return {
      entity: candidate.entity,
      appId: candidate.appId,
      oldClerkId: candidate.oldClerkId,
      newClerkId: mapRow.newClerkId,
      phase: "reused",
    }
  }

  // phase === "user_created" — resumable: retry phone attachment only.
  return attachPhone(candidate, mapRow.newClerkId, args, deps)
}

const attachPhone = async (
  candidate: MigrationCandidate,
  targetUserId: string,
  args: MigrateArgs,
  deps: MigrateDeps
): Promise<PerUserResult> => {
  const { target, prismaClient, logger } = deps
  const e164Phone = digitsToE164(candidate.phone)

  if (!e164Phone) {
    logger.warn(`[migrate-clerk-instance] no valid phone to attach for ${candidate.entity}:${candidate.appId}`)
    return {
      entity: candidate.entity,
      appId: candidate.appId,
      oldClerkId: candidate.oldClerkId,
      newClerkId: targetUserId,
      phase: "user_created",
    }
  }

  await sleep(RATE_LIMIT_SLEEP_MS)

  try {
    await withRateLimitRetry(
      () =>
        target.phoneNumbers.createPhoneNumber({
          userId: targetUserId,
          phoneNumber: e164Phone,
          verified: true,
          primary: true,
        }),
      logger
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error"
    logger.error(`[migrate-clerk-instance] createPhoneNumber failed for ${candidate.entity}:${candidate.appId}`, error)
    return {
      entity: candidate.entity,
      appId: candidate.appId,
      oldClerkId: candidate.oldClerkId,
      newClerkId: targetUserId,
      phase: "failed",
      reason,
    }
  }

  await prismaClient.clerkIdMigration.upsert({
    where: { entity_appId: { entity: candidate.entity, appId: candidate.appId } },
    create: {
      entity: candidate.entity,
      appId: candidate.appId,
      oldClerkId: candidate.oldClerkId,
      newClerkId: targetUserId,
      phone: candidate.phone,
      email: candidate.email,
      phase: "phone_attached",
    },
    update: { newClerkId: targetUserId, phase: "phone_attached" },
  })

  return {
    entity: candidate.entity,
    appId: candidate.appId,
    oldClerkId: candidate.oldClerkId,
    newClerkId: targetUserId,
    phase: "phone_attached",
  }
}

// ── Canary: log observed phone verification status (D6 SDK note) ──

export const logCanaryPhoneVerificationStatus = async (
  target: MigrateTargetClient,
  targetUserId: string,
  logger: MigrateLogger
): Promise<string | undefined> => {
  const user = await target.users.getUser(targetUserId)
  const primaryPhone = user.phoneNumbers?.find((phone) => phone.id === user.primaryPhoneNumberId) ?? user.phoneNumbers?.[0]
  const status = primaryPhone?.verification?.status
  logger.log(`[migrate-clerk-instance] canary observed phone verification.status=${status ?? "none"} for userId=${targetUserId}`)
  return status ?? undefined
}

// ── Main migration entry point ────────────────────────────────────

export async function runMigration(args: MigrateArgs, deps: MigrateDeps): Promise<MigrateResult> {
  const { prismaClient, logger } = deps

  let sinceUpdatedAt: Date | undefined
  if (args.delta) {
    const lastSuccessful = await prismaClient.clerkIdMigration.findMany({ where: { phase: "phone_attached" } })
    const latest = lastSuccessful.reduce<Date | undefined>((max, row) => {
      if (!row.appliedAt) return max
      return !max || row.appliedAt > max ? row.appliedAt : max
    }, undefined)
    sinceUpdatedAt = latest
  }

  const candidates = await enumerateCandidates(prismaClient, args, sinceUpdatedAt)

  const result: MigrateResult = {
    mode: args.mode,
    processed: 0,
    created: 0,
    phoneAttached: 0,
    reused: 0,
    skippedDeleted: 0,
    failed: 0,
    results: [],
  }

  for (const candidate of candidates) {
    result.processed += 1

    const perUserResult = await migrateCandidate(candidate, args, deps)
    result.results.push(perUserResult)

    if (perUserResult.phase === "phone_attached") result.phoneAttached += 1
    else if (perUserResult.phase === "user_created") result.created += 1
    else if (perUserResult.phase === "reused") result.reused += 1
    else if (perUserResult.phase === "skipped_deleted") result.skippedDeleted += 1
    else if (perUserResult.phase === "failed") result.failed += 1
  }

  logger.table(
    result.results.map((row) => ({
      entity: row.entity,
      appId: row.appId,
      oldClerkId: row.oldClerkId,
      newClerkId: row.newClerkId ?? "",
      phase: row.phase,
      reason: row.reason ?? "",
    }))
  )

  logger.log(
    `[migrate-clerk-instance] mode=${result.mode} processed=${result.processed} created=${result.created} phoneAttached=${result.phoneAttached} reused=${result.reused} skippedDeleted=${result.skippedDeleted} failed=${result.failed}`
  )

  return result
}

// ── Remap (D3): single transaction, User.clerkId + StaffAccount.clerkUserId ──

export async function runRemap(prismaClient: MigratePrismaClient, logger: MigrateLogger): Promise<RemapResult> {
  const mapRows = await prismaClient.clerkIdMigration.findMany({ where: { phase: "phone_attached" } })

  const newClerkIds = mapRows.map((row) => row.newClerkId)
  const duplicateNewClerkIds = newClerkIds.filter((id, index) => newClerkIds.indexOf(id) !== index)
  if (duplicateNewClerkIds.length > 0) {
    throw new Error(`[migrate-clerk-instance] remap aborted: duplicate newClerkId values in map: ${duplicateNewClerkIds.join(", ")}`)
  }

  return prismaClient.$transaction(async (tx) => {
    // Pre-remap assertion (design step 9): no StaffAccount row may already
    // hold a map newClerkId — catches an imperfect freeze before committing.
    for (const row of mapRows) {
      if (row.entity !== "staff") continue
      const colliding = await tx.staffAccount.findFirst({ where: { clerkUserId: row.newClerkId } })
      if (colliding && colliding.id !== row.appId) {
        throw new Error(
          `[migrate-clerk-instance] remap aborted: StaffAccount ${colliding.id} already holds newClerkId ${row.newClerkId} (expected appId ${row.appId})`
        )
      }
    }

    const results: RemapResult["results"] = []
    for (const row of mapRows) {
      if (row.entity === "user") {
        await tx.user.update({ where: { id: row.appId }, data: { clerkId: row.newClerkId } })
      } else {
        await tx.staffAccount.update({ where: { id: row.appId }, data: { clerkUserId: row.newClerkId } })
      }
      results.push({ entity: row.entity, appId: row.appId, newClerkId: row.newClerkId })
    }

    logger.log(`[migrate-clerk-instance] remap complete: ${results.length} rows updated`)
    return { remapped: results.length, results }
  })
}

// ── Rollback: restore oldClerkId, guarded WHERE current === newClerkId ──

export async function runRollback(prismaClient: MigratePrismaClient, logger: MigrateLogger): Promise<RollbackResult> {
  const mapRows = await prismaClient.clerkIdMigration.findMany({ where: { phase: "phone_attached" } })

  return prismaClient.$transaction(async (tx) => {
    const skipped: RollbackResult["skipped"] = []
    let restored = 0

    for (const row of mapRows) {
      if (row.entity === "user") {
        // Guarded: only restore rows whose current clerkId still equals newClerkId.
        const current = await tx.user.findFirst({ where: { clerkId: row.newClerkId } })
        if (!current || current.id !== row.appId) {
          skipped.push({ entity: row.entity, appId: row.appId, reason: "diverged post-cutover" })
          continue
        }
        await tx.user.update({ where: { id: row.appId }, data: { clerkId: row.oldClerkId } })
        restored += 1
      } else {
        const current = await tx.staffAccount.findFirst({ where: { clerkUserId: row.newClerkId } })
        if (!current || current.id !== row.appId) {
          skipped.push({ entity: row.entity, appId: row.appId, reason: "diverged post-cutover" })
          continue
        }
        await tx.staffAccount.update({ where: { id: row.appId }, data: { clerkUserId: row.oldClerkId } })
        restored += 1
      }
    }

    logger.log(`[migrate-clerk-instance] rollback complete: restored=${restored} skipped=${skipped.length}`)
    return { restored, skipped }
  })
}

// ── Coverage diff (script-local, NOT the app's getClerkCoverage) ─────

export type CoverageReport = {
  totalMapped: number
  missingInTarget: number
  mismatched: number
  gatePassed: boolean
}

export async function runCoverageDiff(
  prismaClient: MigratePrismaClient,
  target: MigrateTargetClient,
  logger: MigrateLogger
): Promise<CoverageReport> {
  const mapRows = await prismaClient.clerkIdMigration.findMany({ where: { phase: "phone_attached" } })

  let missingInTarget = 0
  for (const row of mapRows) {
    try {
      await target.users.getUser(row.newClerkId)
    } catch {
      missingInTarget += 1
    }
  }

  const report: CoverageReport = {
    totalMapped: mapRows.length,
    missingInTarget,
    mismatched: 0,
    gatePassed: missingInTarget === 0,
  }

  logger.log(
    `[migrate-clerk-instance] coverage gate: totalMapped=${report.totalMapped} missingInTarget=${report.missingInTarget} gatePassed=${report.gatePassed}`
  )

  return report
}

// ── main() — thin, reads env only here ────────────────────────────

const createDefaultDeps = (): MigrateDeps => {
  const sourceSecretKey = process.env.CLERK_SOURCE_SECRET_KEY
  const targetSecretKey = process.env.CLERK_TARGET_SECRET_KEY
  if (!sourceSecretKey) {
    throw new Error("CLERK_SOURCE_SECRET_KEY is required to run the migration script")
  }
  if (!targetSecretKey) {
    throw new Error("CLERK_TARGET_SECRET_KEY is required to run the migration script")
  }

  return {
    source: createClerkClient({ secretKey: sourceSecretKey }),
    target: createClerkClient({ secretKey: targetSecretKey }),
    prismaClient: prisma as unknown as MigratePrismaClient,
    logger: console,
  }
}

async function main() {
  const args = parseMigrateArgs(process.argv.slice(2))
  const deps = createDefaultDeps()

  if (args.remap) {
    await runRemap(deps.prismaClient, deps.logger)
    await runCoverageDiff(deps.prismaClient, deps.target, deps.logger)
    return
  }

  await runMigration(args, deps)
}

const isDirectExecution = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false

if (isDirectExecution) {
  main().catch((error) => {
    console.error("[migrate-clerk-instance] fatal error", error)
    process.exitCode = 1
  })
}
