import { createHash } from "node:crypto"

export type SpecialClassAuthoringIntent = "save_draft" | "publish"

export type ConcreteSpecialClassSlotInput = {
  id?: string
  date: string
  time: string
}

const SCHOOL_TIME_ZONE = "America/New_York"
const MAX_SLUG_LENGTH = 100
const DAY_MS = 24 * 60 * 60 * 1000
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const timePattern = /^(\d{2}):(\d{2})$/
const schoolPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number }

const getSchoolParts = (instant: Date): LocalParts => {
  const parts = Object.fromEntries(
    schoolPartsFormatter.formatToParts(instant)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  ) as LocalParts
  return parts
}

const sameLocalParts = (left: LocalParts, right: LocalParts) =>
  left.year === right.year && left.month === right.month && left.day === right.day &&
  left.hour === right.hour && left.minute === right.minute

const parseLocalParts = ({ date, time }: ConcreteSpecialClassSlotInput): LocalParts => {
  const dateMatch = datePattern.exec(date)
  const timeMatch = timePattern.exec(time)
  if (!dateMatch || !timeMatch) throw new Error("invalid concrete slot date or time")
  const parts = {
    year: Number(dateMatch[1]), month: Number(dateMatch[2]), day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]), minute: Number(timeMatch[2]),
  }
  const calendarDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  if (calendarDate.getUTCMonth() !== parts.month - 1 || calendarDate.getUTCDate() !== parts.day || parts.hour > 23 || parts.minute > 59) {
    throw new Error("invalid concrete slot date or time")
  }
  return parts
}

const toSchoolInstant = (slot: ConcreteSpecialClassSlotInput) => {
  const desired = parseLocalParts(slot)
  const localTimestamp = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute)
  const offsets = new Set([-DAY_MS, 0, DAY_MS].map((delta) => {
    const sample = new Date(localTimestamp + delta)
    const local = getSchoolParts(sample)
    return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - sample.getTime()
  }))
  const matches = [...offsets]
    .map((offset) => new Date(localTimestamp - offset))
    .filter((candidate) => sameLocalParts(getSchoolParts(candidate), desired))
  if (matches.length === 0) throw new Error("nonexistent school-time slot")
  if (matches.length > 1) throw new Error("ambiguous school-time slot")
  return matches[0]
}

export const normalizeConcreteSpecialClassSlots = (slots: ConcreteSpecialClassSlotInput[]) => {
  const normalized = slots.map(({ id, ...slot }) => ({ ...(id ? { id } : {}), startsAt: toSchoolInstant(slot) }))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
  const instants = new Set(normalized.map(({ startsAt }) => startsAt.toISOString()))
  if (instants.size !== normalized.length) throw new Error("Duplicate concrete special-class slot")
  return normalized
}

export const createStableSpecialClassSlug = (courseSlug: string, slotId: string) => {
  const suffix = `-${slotId}`
  if (suffix.length >= MAX_SLUG_LENGTH) throw new Error("Stable slot ID is too long for a public slug")
  const sanitized = courseSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "special-class"
  const prefix = sanitized.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/g, "")
  return `${prefix}${suffix}`
}

const canonicalize = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`
  if (typeof value === "object") {
    const object = value as Record<string, unknown>
    const entries = Object.keys(object).filter((key) => object[key] !== undefined).sort()
    return `{${entries.map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`
  }
  throw new TypeError("Authoring payload contains an unsupported value")
}

export const hashAuthoringPayload = (payload: unknown) =>
  createHash("sha256").update(canonicalize(payload)).digest("hex")

export const mapInitialSpecialClassProjection = (input: { intent: SpecialClassAuthoringIntent; dropInPriceCents: number }) => {
  if (!Number.isInteger(input.dropInPriceCents) || input.dropInPriceCents <= 0) throw new Error("Drop-in price must be positive")
  return { currency: "usd" as const, priceCents: input.dropInPriceCents, status: input.intent === "publish" ? "published" as const : "draft" as const }
}

export const isGeneratedSlotMutationBlocked = (commitments: { holds: number; purchases: number; attendances: number }) =>
  commitments.holds > 0 || commitments.purchases > 0 || commitments.attendances > 0

export const shouldProjectSpecialClasses = (input: { specialClassOperationsEnabled: boolean; kind: string }) =>
  input.specialClassOperationsEnabled
