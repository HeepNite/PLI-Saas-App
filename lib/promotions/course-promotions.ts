export const COURSE_PROMOTION_TIME_ZONE = "America/New_York"
export const MAX_COURSE_PROMOTIONS = 12
export const MIN_PROMOTIONAL_PRICE_CENTS = 50

export type CoursePromotionChannel = "public_booking" | "profile" | "trusted_kiosk"
export type CoursePromotionAudience = "everyone" | "heritage_pin_delivered"
export type CoursePromotionDateBasis = "class_date" | "purchase_date"
export type CoursePromotionPricing =
  | { kind: "fixed"; amountCents: number }
  | { kind: "percentage"; percentOff: number }

export type CoursePromotion = {
  id: string
  label: string
  active: boolean
  pricing: CoursePromotionPricing
  window: {
    basis: CoursePromotionDateBasis
    startDate: string
    endDate: string
  }
  audience: CoursePromotionAudience
  channels: CoursePromotionChannel[]
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/
const CHANNELS = new Set<CoursePromotionChannel>(["public_booking", "profile", "trusted_kiosk"])

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null

const isDateKey = (value: unknown): value is string => {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const normalizePricing = (value: unknown): CoursePromotionPricing | null => {
  const source = asRecord(value)
  if (!source) return null
  if (source.kind === "fixed") {
    const amountCents = source.amountCents
    return typeof amountCents === "number" && Number.isInteger(amountCents) && amountCents >= MIN_PROMOTIONAL_PRICE_CENTS && amountCents <= 1_000_000
      ? { kind: "fixed", amountCents }
      : null
  }
  if (source.kind === "percentage") {
    const percentOff = source.percentOff
    return typeof percentOff === "number" && Number.isInteger(percentOff) && percentOff >= 1 && percentOff <= 99
      ? { kind: "percentage", percentOff }
      : null
  }
  return null
}

const normalizePromotion = (value: unknown): CoursePromotion | null => {
  const source = asRecord(value)
  const window = asRecord(source?.window)
  if (!source || !window) return null

  const id = typeof source.id === "string" ? source.id.trim().toLowerCase() : ""
  const label = typeof source.label === "string" ? source.label.trim().slice(0, 80) : ""
  const pricing = normalizePricing(source.pricing)
  const basis = window.basis
  const startDate = window.startDate
  const endDate = window.endDate
  const audience = source.audience
  if (
    !ID_PATTERN.test(id) || !label || typeof source.active !== "boolean" || !pricing ||
    (basis !== "class_date" && basis !== "purchase_date") ||
    !isDateKey(startDate) || !isDateKey(endDate) || startDate > endDate ||
    (audience !== "everyone" && audience !== "heritage_pin_delivered") ||
    !Array.isArray(source.channels)
  ) return null

  const channels = [...new Set(source.channels.filter(
    (channel): channel is CoursePromotionChannel => typeof channel === "string" && CHANNELS.has(channel as CoursePromotionChannel),
  ))]
  if (channels.length === 0) return null

  return {
    id,
    label,
    active: source.active,
    pricing,
    window: { basis, startDate, endDate },
    audience,
    channels,
  }
}

export const normalizeCoursePromotions = (value: unknown): CoursePromotion[] => {
  if (!Array.isArray(value)) return []
  const promotions: CoursePromotion[] = []
  const ids = new Set<string>()
  for (const candidate of value) {
    if (promotions.length >= MAX_COURSE_PROMOTIONS) break
    const promotion = normalizePromotion(candidate)
    if (!promotion || ids.has(promotion.id)) continue
    ids.add(promotion.id)
    promotions.push(promotion)
  }
  return promotions
}

export const getNewYorkDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COURSE_PROMOTION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const appliesToContext = (promotion: CoursePromotion, input: {
  channel: CoursePromotionChannel
  classDate: string
  purchaseDate: string
}) => {
  if (!promotion.active || !promotion.channels.includes(input.channel)) return false
  const date = promotion.window.basis === "class_date" ? input.classDate : input.purchaseDate
  return isDateKey(date) && date >= promotion.window.startDate && date <= promotion.window.endDate
}

export const getPotentialCoursePromotionLabels = (input: {
  promotions: unknown
  channel: CoursePromotionChannel
  classDate: string
  purchaseDate: string
}) => [...new Set(normalizeCoursePromotions(input.promotions)
  .filter((promotion) => appliesToContext(promotion, input))
  .map((promotion) => promotion.label))]

export const resolveCoursePromotionPrice = (input: {
  promotions: unknown
  channel: CoursePromotionChannel
  classDate: string
  purchaseDate: string
  regularPriceCents: number
  hasDeliveredHeritagePin: boolean
}) => {
  if (!Number.isInteger(input.regularPriceCents) || input.regularPriceCents < MIN_PROMOTIONAL_PRICE_CENTS) {
    return { applied: false as const, reason: "invalid_regular_price" as const }
  }

  const candidates = normalizeCoursePromotions(input.promotions)
    .filter((promotion) => appliesToContext(promotion, input))
    .filter((promotion) => promotion.audience === "everyone" || input.hasDeliveredHeritagePin)
    .map((promotion) => ({
      promotion,
      amountCents: promotion.pricing.kind === "fixed"
        ? promotion.pricing.amountCents
        : Math.round(input.regularPriceCents * (100 - promotion.pricing.percentOff) / 100),
    }))
    .filter(({ amountCents }) => amountCents >= MIN_PROMOTIONAL_PRICE_CENTS && amountCents < input.regularPriceCents)
    .sort((left, right) => left.amountCents - right.amountCents)

  const winner = candidates[0]
  return winner
    ? { applied: true as const, amountCents: winner.amountCents, promotion: winner.promotion }
    : { applied: false as const, reason: "no_eligible_promotion" as const }
}
