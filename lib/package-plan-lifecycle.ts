import { Prisma } from "@prisma/client"

export const PACKAGE_PLAN_STATUSES = ["ACTIVE", "SUSPENDED", "SCHEDULED", "DELETED"] as const
export type PackagePlanStatus = (typeof PACKAGE_PLAN_STATUSES)[number]

type LifecycleShape = {
  active?: boolean | null
  status?: unknown
  launchAt?: Date | string | null
}

export const normalizePackagePlanStatus = (value: unknown): PackagePlanStatus | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toUpperCase()
  return PACKAGE_PLAN_STATUSES.includes(normalized as PackagePlanStatus) ? (normalized as PackagePlanStatus) : null
}

export const getEffectivePackagePlanStatus = (plan: LifecycleShape): PackagePlanStatus => {
  const explicitStatus = normalizePackagePlanStatus(plan.status)
  if (explicitStatus) return explicitStatus
  return plan.active === false ? "SUSPENDED" : "ACTIVE"
}

export const isPackagePlanPubliclyAvailable = (plan: LifecycleShape, now = new Date()) => {
  if (plan.active === false) return false

  const status = getEffectivePackagePlanStatus(plan)
  if (status === "DELETED" || status === "SUSPENDED") return false
  if (status !== "SCHEDULED") return true

  if (!plan.launchAt) return false
  const launchAt = plan.launchAt instanceof Date ? plan.launchAt : new Date(plan.launchAt)
  return !Number.isNaN(launchAt.getTime()) && launchAt.getTime() <= now.getTime()
}

export const isPackagePlanLifecycleValidationError = (error: unknown) => {
  if (!(error instanceof Error)) return false

  const name = (error as { name?: string }).name || error.constructor?.name || ""
  const message = error.message || ""

  if (!name.includes("PrismaClientValidationError") && !(error instanceof Prisma.PrismaClientValidationError)) {
    return false
  }

  return (
    message.includes("packagePlan") &&
    (message.includes("Unknown argument `status`") || message.includes("Unknown argument `launchAt`"))
  )
}

export const omitPackagePlanLifecycleFields = <T extends Record<string, unknown>>(data: T) => {
  const { status: _status, launchAt: _launchAt, ...rest } = data
  return rest
}

export const withDerivedPackagePlanLifecycle = <T extends LifecycleShape>(plan: T): T & {
  status: PackagePlanStatus
  launchAt: Date | string | null
} => ({
  ...plan,
  status: getEffectivePackagePlanStatus(plan),
  launchAt: plan.launchAt ?? null,
})
