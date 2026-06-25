import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  extractStaffRoleFromUserMetadata,
  type StaffRole,
} from "@/lib/security/staff-role"
import { asObject } from "@/lib/shared"
import {
  extractStaffCategoryFromUserMetadata,
  extractStaffSubCategoryFromUserMetadata,
  type StaffCategory,
  type StaffSubCategory,
} from "@/lib/security/staff-category"

type ClerkStaffUser = {
  id: string
  firstName?: string | null
  lastName?: string | null
  banned?: boolean | null
  locked?: boolean | null
  imageUrl?: string | null
  lastSignInAt?: number | null
  publicMetadata?: unknown
  privateMetadata?: unknown
  emailAddresses?: Array<{ emailAddress: string }>
  primaryEmailAddress?: { emailAddress: string } | null
  phoneNumbers?: Array<{ phoneNumber?: string | null }>
  primaryPhoneNumber?: { phoneNumber?: string | null } | null
}

export type StaffPayrollBridgeFields = {
  hourlyRate: number | null
  paydayWeekday: number | null
  paymentModelId: string | null
}

const skipStaffMirrorPersistence =
  process.env.NODE_ENV === "test" || process.env.STAFF_MIRROR_MODE === "disabled"

let staffMirrorModelWarningPrinted = false

const logMirrorWriteFailure = (scope: string, error: unknown) => {
  console.warn(`staff mirror sync skipped (${scope}) due to database error`, error)
}

const getStaffMirrorModels = () => {
  const prismaUnsafe = prisma as unknown as {
    staffAccount?: {
      upsert?: (args: unknown) => Promise<unknown>
      findUnique?: (args: unknown) => Promise<{
        id: string
        hourlyRate: number | null
        paydayWeekday: number | null
        paymentModelId: string | null
      } | null>
    }
    staffRoleAudit?: {
      create?: (args: unknown) => Promise<unknown>
    }
  }

  const hasModels =
    typeof prismaUnsafe.staffAccount?.upsert === "function" &&
    typeof prismaUnsafe.staffAccount?.findUnique === "function" &&
    typeof prismaUnsafe.staffRoleAudit?.create === "function"

  if (!hasModels && !staffMirrorModelWarningPrinted) {
    staffMirrorModelWarningPrinted = true
    console.warn(
      "Staff mirror models are not available in Prisma Client runtime. Skipping staff account sync/audit."
    )
  }

  return hasModels ? prismaUnsafe : null
}

const toDate = (value: number | null | undefined): Date | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return new Date(value)
}

const toIsoDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed)
}

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

const asWeekday = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 6) return null
  return value
}

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const primaryEmailFromUser = (user: ClerkStaffUser) =>
  user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || ""

const primaryPhoneFromUser = (user: ClerkStaffUser) =>
  user.primaryPhoneNumber?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber || ""

export const extractStaffPayrollFallbackFromClerkUser = (user: ClerkStaffUser): StaffPayrollBridgeFields => {
  const publicMetadata = asObject(user.publicMetadata)
  const payrollMetadata = asObject(publicMetadata.staffPayroll)

  return {
    hourlyRate: asFiniteNumber(payrollMetadata.hourlyRate),
    paydayWeekday: asWeekday(payrollMetadata.paydayWeekday),
    paymentModelId: asOptionalString(payrollMetadata.paymentModelId),
  }
}

export const resolveStaffPayrollBridgeFields = (
  staffAccount: Partial<StaffPayrollBridgeFields> | null | undefined,
  user: ClerkStaffUser
): StaffPayrollBridgeFields => {
  const clerkFallback = extractStaffPayrollFallbackFromClerkUser(user)

  return {
    hourlyRate:
      staffAccount?.hourlyRate ??
      // @deprecated-clerk-fallback: remove after backfill verified
      clerkFallback.hourlyRate,
    paydayWeekday:
      staffAccount?.paydayWeekday ??
      // @deprecated-clerk-fallback: remove after backfill verified
      clerkFallback.paydayWeekday,
    paymentModelId:
      staffAccount?.paymentModelId ??
      // @deprecated-clerk-fallback: remove after backfill verified
      clerkFallback.paymentModelId,
  }
}

const pickRoleCategory = (
  user: ClerkStaffUser,
  roleOverride?: StaffRole | "removed" | null,
  categoryOverride?: StaffCategory | null
) => {
  const extractedRole = extractStaffRoleFromUserMetadata(user)
  const extractedCategory = extractStaffCategoryFromUserMetadata(user)

  const role = roleOverride === undefined ? extractedRole : roleOverride
  const category = categoryOverride === undefined ? extractedCategory : categoryOverride

  return { role, category }
}

const pickSubCategory = (user: ClerkStaffUser, subCategoryOverride?: StaffSubCategory | null) => {
  const extractedSubCategory = extractStaffSubCategoryFromUserMetadata(user)
  return subCategoryOverride === undefined ? extractedSubCategory : subCategoryOverride
}

export type SyncStaffAccountOptions = {
  roleOverride?: StaffRole | "removed" | null
  categoryOverride?: StaffCategory | null
  subCategoryOverride?: StaffSubCategory | null
  allowWithoutRole?: boolean
  source?: string
  metadata?: Record<string, unknown>
}

export const syncStaffAccountFromClerkUser = async (user: ClerkStaffUser, options: SyncStaffAccountOptions = {}) => {
  if (skipStaffMirrorPersistence) return null
  const models = getStaffMirrorModels()
  if (!models) return null

  const { role, category } = pickRoleCategory(user, options.roleOverride, options.categoryOverride)
  const subCategory = pickSubCategory(user, options.subCategoryOverride)
  if (!role && !options.allowWithoutRole) return null

  const privateMetadata = asObject(user.privateMetadata)
  const hasPin = typeof privateMetadata.staffPinHash === "string" && privateMetadata.staffPinHash.length > 0
  const lastCheckInAt = toIsoDate(privateMetadata.staffLastCheckInAt)
  const email = primaryEmailFromUser(user)
  if (!email) return null

  const roleToPersist = role || "removed"
  const metadata = {
    imageUrl: user.imageUrl || null,
    syncSource: options.source || "clerk",
    ...(options.metadata || {}),
  }

  try {
    const existingAccount = await models.staffAccount!.findUnique!({
      where: { clerkUserId: user.id },
      select: {
        id: true,
        hourlyRate: true,
        paydayWeekday: true,
        paymentModelId: true,
      },
    })
    const payrollBridgeFields = resolveStaffPayrollBridgeFields(existingAccount, user)

    return await models.staffAccount!.upsert!({
      where: { clerkUserId: user.id },
      create: {
        clerkUserId: user.id,
        email,
        phone: primaryPhoneFromUser(user) || null,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        role: roleToPersist,
        category: category || null,
        subCategory: subCategory || null,
        banned: Boolean(user.banned),
        locked: Boolean(user.locked),
        hasPin,
        lastSignInAt: toDate(user.lastSignInAt),
        lastCheckInAt,
        hourlyRate: payrollBridgeFields.hourlyRate,
        paydayWeekday: payrollBridgeFields.paydayWeekday,
        paymentModelId: payrollBridgeFields.paymentModelId,
        source: options.source || "clerk",
        metadata,
      },
      update: {
        email,
        phone: primaryPhoneFromUser(user) || null,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        role: roleToPersist,
        category: category || null,
        subCategory: subCategory || null,
        banned: Boolean(user.banned),
        locked: Boolean(user.locked),
        hasPin,
        lastSignInAt: toDate(user.lastSignInAt),
        lastCheckInAt,
        hourlyRate: payrollBridgeFields.hourlyRate,
        paydayWeekday: payrollBridgeFields.paydayWeekday,
        paymentModelId: payrollBridgeFields.paymentModelId,
        source: options.source || "clerk",
        metadata,
      },
    })
  } catch (error) {
    logMirrorWriteFailure(options.source || "clerk", error)
    return null
  }
}

export type StaffRoleAuditInput = {
  staffClerkUserId: string
  actorClerkUserId?: string | null
  actorRole?: StaffRole | null
  action: string
  previousRole?: StaffRole | "removed" | null
  nextRole?: StaffRole | "removed" | null
  previousCategory?: StaffCategory | null
  nextCategory?: StaffCategory | null
  metadata?: Prisma.InputJsonValue
}

export const createStaffRoleAudit = async (input: StaffRoleAuditInput) => {
  if (skipStaffMirrorPersistence) return null
  const models = getStaffMirrorModels()
  if (!models) return null

  try {
    const account = await models.staffAccount!.findUnique!({
      where: { clerkUserId: input.staffClerkUserId },
      select: { id: true },
    })

    return await models.staffRoleAudit!.create!({
      data: {
        staffAccountId: account?.id || null,
        staffClerkUserId: input.staffClerkUserId,
        actorClerkUserId: input.actorClerkUserId || null,
        actorRole: input.actorRole || null,
        action: input.action,
        previousRole: input.previousRole || null,
        nextRole: input.nextRole || null,
        previousCategory: input.previousCategory || null,
        nextCategory: input.nextCategory || null,
        metadata: input.metadata || undefined,
      },
    })
  } catch (error) {
    logMirrorWriteFailure(`audit:${input.action}`, error)
    return null
  }
}

export const extractStaffRoleSnapshot = (user: ClerkStaffUser | null | undefined) => ({
  role: user ? extractStaffRoleFromUserMetadata(user) : null,
  category: user ? extractStaffCategoryFromUserMetadata(user) : null,
})
