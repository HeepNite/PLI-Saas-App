import "server-only"

import type { PreparedCheckoutAccount } from "@/lib/checkout"
import type { CheckoutValidation } from "@/lib/checkout/validation"
import { prisma } from "@/lib/prisma"

export const PREPARED_CHECKOUT_CONTEXT_TTL_MS = 60_000

export const PREPARED_CHECKOUT_FALLBACK_REASONS = {
  disabled: "feature_disabled",
  missingKioskSession: "missing_kiosk_session",
  terminalUnauthorized: "terminal_unauthorized",
  missing: "missing_prepared_context",
  expired: "expired_prepared_context",
  classSlotMismatch: "class_slot_mismatch",
  invalidSnapshot: "invalid_snapshot",
} as const

type PreparedCheckoutFallbackReason =
  (typeof PREPARED_CHECKOUT_FALLBACK_REASONS)[keyof typeof PREPARED_CHECKOUT_FALLBACK_REASONS]

type PreparedCheckoutContextTable = {
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>
  findFirst: (args: { where: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> }) => Promise<unknown>
}

type PreparedCheckoutRow = {
  id: string
  terminalId: string
  kioskSessionId: string
  classSlotKey: string
  dbUserId: string | null
  resolvedClerkUserId: string | null
  resolvedEmail: string
  phoneRaw: string | null
  phoneNormalized: string
  accountSnapshot: unknown
  verificationSnapshot: unknown
  expiresAt: Date
}

type PreparedCheckoutVerificationSnapshot = {
  hasVerifiedPhone: boolean
}

const preparedCheckoutContextTable = (prisma as typeof prisma & {
  preparedCheckoutContext: PreparedCheckoutContextTable
}).preparedCheckoutContext

const asRecord = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, unknown>) : null)

const asString = (value: unknown) => (typeof value === "string" ? value : "")

const asBoolean = (value: unknown) => value === true

export const isPreparedCheckoutContextEnabled = () => {
  const value = process.env.PREPARED_CHECKOUT_CONTEXT?.trim().toLowerCase()
  return value === "1" || value === "true" || value === "yes" || value === "on"
}

export const buildPreparedCheckoutClassSlotKey = (input: {
  courseSlug: string
  date: string
  time: string
  durationMinutes?: number | null
}) => [input.courseSlug.trim(), input.date.trim(), input.time.trim(), String(input.durationMinutes ?? "")].join("|")

export const snapshotPreparedCheckoutVerification = (
  input: PreparedCheckoutVerificationSnapshot
): PreparedCheckoutVerificationSnapshot => ({
  hasVerifiedPhone: Boolean(input.hasVerifiedPhone),
})

export const createPreparedCheckoutContext = async (input: {
  terminalId: string
  kioskSessionId: string
  validation: Pick<CheckoutValidation, "courseSlug" | "date" | "time"> & { durationMinutes?: number | null }
  preparedAccount: PreparedCheckoutAccount
  verification: PreparedCheckoutVerificationSnapshot
}) => {
  const classSlotKey = buildPreparedCheckoutClassSlotKey(input.validation)
  const now = new Date()

  await preparedCheckoutContextTable.deleteMany({
    where: {
      terminalId: input.terminalId,
      kioskSessionId: input.kioskSessionId,
    },
  })

  return preparedCheckoutContextTable.create({
    data: {
      terminalId: input.terminalId,
      kioskSessionId: input.kioskSessionId,
      classSlotKey,
      dbUserId: input.preparedAccount.userId,
      resolvedClerkUserId: input.preparedAccount.resolvedUserId,
      resolvedEmail: input.preparedAccount.identity.resolvedEmail,
      phoneRaw: input.preparedAccount.identity.phoneRaw,
      phoneNormalized: input.preparedAccount.identity.phoneNormalized,
      accountSnapshot: input.preparedAccount.account,
      verificationSnapshot: snapshotPreparedCheckoutVerification(input.verification),
      expiresAt: new Date(now.getTime() + PREPARED_CHECKOUT_CONTEXT_TTL_MS),
    },
  })
}

export const deletePreparedCheckoutContext = async (input: {
  terminalId: string
  kioskSessionId: string
  validation: Pick<CheckoutValidation, "courseSlug" | "date" | "time"> & { durationMinutes?: number | null }
}) => {
  const classSlotKey = buildPreparedCheckoutClassSlotKey(input.validation)
  await preparedCheckoutContextTable.deleteMany({
    where: {
      terminalId: input.terminalId,
      kioskSessionId: input.kioskSessionId,
      classSlotKey,
    },
  })
}

const decodePreparedAccountSnapshot = (row: PreparedCheckoutRow): PreparedCheckoutAccount | null => {
  const accountSnapshot = asRecord(row.accountSnapshot)
  const verificationSnapshot = asRecord(row.verificationSnapshot)
  if (!accountSnapshot || !verificationSnapshot) return null

  return {
    userId: row.dbUserId,
    clerkUser: null,
    resolvedUserId: row.resolvedClerkUserId,
    identity: {
      resolvedEmail: row.resolvedEmail,
      phoneRaw: row.phoneRaw || "",
      phoneNormalized: row.phoneNormalized,
    },
    account: {
      clerkUserId: asString(accountSnapshot.clerkUserId) || row.resolvedClerkUserId,
      created: asBoolean(accountSnapshot.created),
      requiresSignIn: asBoolean(accountSnapshot.requiresSignIn),
      hasAvatar: asBoolean(accountSnapshot.hasAvatar),
    },
  }
}

const decodePreparedVerificationSnapshot = (row: PreparedCheckoutRow): PreparedCheckoutVerificationSnapshot | null => {
  const snapshot = asRecord(row.verificationSnapshot)
  if (!snapshot) return null

  return {
    hasVerifiedPhone: asBoolean(snapshot.hasVerifiedPhone),
  }
}

export const lookupPreparedCheckoutContext = async (input: {
  terminalId: string
  kioskSessionId: string
  validation: Pick<CheckoutValidation, "courseSlug" | "date" | "time"> & { durationMinutes?: number | null }
}): Promise<
  | {
      ok: true
      preparedAccount: PreparedCheckoutAccount
      verification: PreparedCheckoutVerificationSnapshot
      rowId: string
    }
  | {
      ok: false
      reason: PreparedCheckoutFallbackReason
    }
> => {
  const classSlotKey = buildPreparedCheckoutClassSlotKey(input.validation)
  const now = new Date()

  const exact = (await preparedCheckoutContextTable.findFirst({
    where: {
      terminalId: input.terminalId,
      kioskSessionId: input.kioskSessionId,
      classSlotKey,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  })) as PreparedCheckoutRow | null

  if (exact) {
    const preparedAccount = decodePreparedAccountSnapshot(exact)
    const verification = decodePreparedVerificationSnapshot(exact)
    if (!preparedAccount || !verification) {
      return { ok: false, reason: PREPARED_CHECKOUT_FALLBACK_REASONS.invalidSnapshot }
    }

    return {
      ok: true,
      preparedAccount,
      verification,
      rowId: exact.id,
    }
  }

  const expired = (await preparedCheckoutContextTable.findFirst({
    where: {
      terminalId: input.terminalId,
      kioskSessionId: input.kioskSessionId,
      classSlotKey,
    },
    orderBy: { expiresAt: "desc" },
  })) as PreparedCheckoutRow | null
  if (expired && expired.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: PREPARED_CHECKOUT_FALLBACK_REASONS.expired }
  }

  const sameSessionDifferentClass = (await preparedCheckoutContextTable.findFirst({
    where: {
      terminalId: input.terminalId,
      kioskSessionId: input.kioskSessionId,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  })) as PreparedCheckoutRow | null

  if (sameSessionDifferentClass && sameSessionDifferentClass.classSlotKey !== classSlotKey) {
    return { ok: false, reason: PREPARED_CHECKOUT_FALLBACK_REASONS.classSlotMismatch }
  }

  return { ok: false, reason: PREPARED_CHECKOUT_FALLBACK_REASONS.missing }
}
