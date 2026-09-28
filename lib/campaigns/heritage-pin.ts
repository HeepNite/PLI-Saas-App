import { getCountries } from "libphonenumber-js/max"

export const HERITAGE_PIN_CAMPAIGN_KEY = "latin-heritage-2026"
export const HERITAGE_PIN_TIME_ZONE = "America/New_York"
export const HERITAGE_PIN_PRICE_CENTS = 1500

const DEFAULT_ACQUISITION_START = "2026-10-01"
const DEFAULT_ACQUISITION_END = "2026-10-31"
const DEFAULT_BENEFIT_START = "2026-10-01"
const DEFAULT_BENEFIT_END = "2026-10-31"
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const COUNTRY_CODES = new Set<string>(getCountries())

export type HeritagePinStatus = "pending" | "delivered"

export type HeritagePinCampaignConfig = {
  acquisitionStart: string
  acquisitionEnd: string
  benefitStart: string
  benefitEnd: string
}

export type HeritagePinEntitlement = {
  campaign: typeof HERITAGE_PIN_CAMPAIGN_KEY
  sourcePurchaseId: string
  countryCode: string
  countryName: string
  status: HeritagePinStatus
  earnedAt: string
  deliveredAt: string | null
  deliveredBy: string | null
  source: "public_booking"
}

type HeritagePinPurchaseLike = {
  id: string
  userId?: string
  metadata: unknown
  createdAt?: Date | string
}

const isValidDateKey = (value: string) => {
  if (!DATE_KEY_PATTERN.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const readBoundedDate = (
  value: string | undefined,
  fallback: string,
  min: string,
  max: string,
) => value && isValidDateKey(value) && value >= min && value <= max ? value : fallback

const resolveCampaignWindow = (
  startOverride: string | undefined,
  endOverride: string | undefined,
  defaultStart: string,
  defaultEnd: string,
) => {
  const start = readBoundedDate(startOverride, defaultStart, "2026-01-01", "2027-12-31")
  const end = readBoundedDate(endOverride, defaultEnd, "2026-01-01", "2027-12-31")
  return start <= end ? { start, end } : { start: defaultStart, end: defaultEnd }
}

export const getHeritagePinCampaignConfig = (
  env: Partial<Record<string, string | undefined>> = process.env,
): HeritagePinCampaignConfig => {
  const acquisition = resolveCampaignWindow(
    env.HERITAGE_PIN_ACQUISITION_START,
    env.HERITAGE_PIN_ACQUISITION_END,
    DEFAULT_ACQUISITION_START,
    DEFAULT_ACQUISITION_END,
  )
  const benefit = resolveCampaignWindow(
    env.HERITAGE_PIN_BENEFIT_START,
    env.HERITAGE_PIN_BENEFIT_END,
    DEFAULT_BENEFIT_START,
    DEFAULT_BENEFIT_END,
  )

  return {
    acquisitionStart: acquisition.start,
    acquisitionEnd: acquisition.end,
    benefitStart: benefit.start,
    benefitEnd: benefit.end,
  }
}

export const getHeritagePinDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HERITAGE_PIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export const isHeritagePinAcquisitionDate = (
  date: Date,
  config = getHeritagePinCampaignConfig(),
) => {
  const key = getHeritagePinDateKey(date)
  return key >= config.acquisitionStart && key <= config.acquisitionEnd
}

export const isHeritagePinBenefitClassDate = (
  dateKey: string,
  config = getHeritagePinCampaignConfig(),
) => {
  if (!isValidDateKey(dateKey) || dateKey < config.benefitStart || dateKey > config.benefitEnd) return false
  const [year, month, day] = dateKey.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
  return weekday === 0 || weekday === 1
}

export type HeritagePinPricingReason =
  | "applied"
  | "entitlement_missing"
  | "pin_pending"
  | "date_ineligible"
  | "not_single_drop_in"
  | "promotion_conflict"

export const resolveHeritagePinPrice = (input: {
  entitlement: HeritagePinEntitlement | null
  classDate: string
  participants: number
  serviceId: string
  packageId: string
  coupon: string
  addonCount: number
  consecutivePriceCents: number | null
  consecutiveAddOnOnly: boolean
}) => {
  if (!input.entitlement) return { applied: false as const, reason: "entitlement_missing" as const }
  if (input.entitlement.status !== "delivered") return { applied: false as const, reason: "pin_pending" as const }
  if (!isHeritagePinBenefitClassDate(input.classDate)) return { applied: false as const, reason: "date_ineligible" as const }
  if (input.participants !== 1 || !input.serviceId || input.packageId) {
    return { applied: false as const, reason: "not_single_drop_in" as const }
  }
  if (
    input.serviceId === "new-student" ||
    Boolean(input.coupon) ||
    input.addonCount > 0 ||
    input.consecutivePriceCents !== null ||
    input.consecutiveAddOnOnly
  ) {
    return { applied: false as const, reason: "promotion_conflict" as const }
  }
  return {
    applied: true as const,
    reason: "applied" as const,
    amountCents: HERITAGE_PIN_PRICE_CENTS,
    entitlementPurchaseId: input.entitlement.sourcePurchaseId,
  }
}

export const normalizeHeritagePinCountryCode = (value: unknown) => {
  if (typeof value !== "string") return null
  const code = value.trim().toUpperCase()
  return COUNTRY_CODES.has(code) ? code : null
}

export const getHeritagePinCountryOptions = (locale = "en") => {
  const names = new Intl.DisplayNames([locale], { type: "region" })
  return [...COUNTRY_CODES]
    .map((code) => ({ code, name: names.of(code) || code }))
    .sort((left, right) => left.name.localeCompare(right.name, locale))
}

export const getHeritagePinCountryName = (countryCode: string, locale = "en") => {
  const code = normalizeHeritagePinCountryCode(countryCode)
  if (!code) return countryCode
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) || code
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

const asIsoDateTime = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

export const parseHeritagePinEntitlement = (
  purchase: HeritagePinPurchaseLike,
): HeritagePinEntitlement | null => {
  const metadata = asRecord(purchase.metadata)
  if (metadata.heritagePinCampaign !== HERITAGE_PIN_CAMPAIGN_KEY) return null
  const countryCode = normalizeHeritagePinCountryCode(metadata.heritagePinCountryCode)
  const status = metadata.heritagePinStatus
  const earnedAt = asIsoDateTime(metadata.heritagePinEarnedAt)
    || (purchase.createdAt ? asIsoDateTime(purchase.createdAt instanceof Date ? purchase.createdAt.toISOString() : purchase.createdAt) : null)
  const source = metadata.heritagePinSource
  if (!countryCode || (status !== "pending" && status !== "delivered") || !earnedAt || source !== "public_booking") {
    return null
  }

  const deliveredAt = status === "delivered" ? asIsoDateTime(metadata.heritagePinDeliveredAt) : null
  const deliveredBy = status === "delivered" && typeof metadata.heritagePinDeliveredBy === "string"
    ? metadata.heritagePinDeliveredBy.trim() || null
    : null

  if (status === "delivered" && !deliveredAt) return null

  return {
    campaign: HERITAGE_PIN_CAMPAIGN_KEY,
    sourcePurchaseId: purchase.id,
    countryCode,
    countryName: getHeritagePinCountryName(countryCode),
    status,
    earnedAt,
    deliveredAt,
    deliveredBy,
    source,
  }
}

export const selectHeritagePinEntitlement = (
  purchases: readonly HeritagePinPurchaseLike[],
): HeritagePinEntitlement | null => {
  const entitlements = purchases
    .map(parseHeritagePinEntitlement)
    .filter((value): value is HeritagePinEntitlement => Boolean(value))
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "delivered" ? -1 : 1
      return left.earnedAt.localeCompare(right.earnedAt) || left.sourcePurchaseId.localeCompare(right.sourcePurchaseId)
    })
  return entitlements[0] || null
}

export const resolveHeritagePinAwardCountry = (
  metadata: unknown,
  settledAt: Date,
  config = getHeritagePinCampaignConfig(),
) => {
  const record = asRecord(metadata)
  if (record.heritagePinIntent !== HERITAGE_PIN_CAMPAIGN_KEY) return null
  if (record.heritagePinSource !== "public_booking") return null
  if (!isHeritagePinAcquisitionDate(settledAt, config)) return null
  return normalizeHeritagePinCountryCode(record.heritagePinCountryCode)
}

export const buildPendingHeritagePinMetadata = (
  metadata: unknown,
  input: { countryCode: string; earnedAt: Date },
) => {
  const countryCode = normalizeHeritagePinCountryCode(input.countryCode)
  if (!countryCode) throw new Error("Invalid Heritage pin country code")
  return {
    ...asRecord(metadata),
    heritagePinCampaign: HERITAGE_PIN_CAMPAIGN_KEY,
    heritagePinCountryCode: countryCode,
    heritagePinStatus: "pending",
    heritagePinEarnedAt: input.earnedAt.toISOString(),
    heritagePinSource: "public_booking",
  }
}

export const buildDeliveredHeritagePinMetadata = (
  metadata: unknown,
  input: { deliveredAt: Date; deliveredBy: string },
) => {
  const record = asRecord(metadata)
  if (record.heritagePinCampaign !== HERITAGE_PIN_CAMPAIGN_KEY || record.heritagePinStatus !== "pending") {
    throw new Error("Heritage pin is not pending delivery")
  }
  const deliveredBy = input.deliveredBy.trim()
  if (!deliveredBy) throw new Error("Missing Heritage pin delivery actor")
  return {
    ...record,
    heritagePinStatus: "delivered",
    heritagePinDeliveredAt: input.deliveredAt.toISOString(),
    heritagePinDeliveredBy: deliveredBy,
  }
}
