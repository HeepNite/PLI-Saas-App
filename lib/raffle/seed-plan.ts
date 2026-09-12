import { createHash, randomBytes } from "node:crypto"

/**
 * Pure, DB-free building blocks for `scripts/raffle-seed.ts`.
 *
 * Kept separate from the script so the seed contract (JSON validation,
 * eventDate normalization, draw upsert planning, token generation/hashing,
 * base URL resolution) is unit-testable without a real Prisma client.
 * See openspec/changes/event-raffle/design.md D8, D9, D11.
 */

export type RaffleSeedDrawConfig = {
  order: number
  prizeLabel: string
  drawAt?: string
}

export type RaffleSeedConfig = {
  slug: string
  title: string
  brand: string
  eventDate: string
  excludePreviousWinners: boolean
  videoUrl?: string
  draws: RaffleSeedDrawConfig[]
}

export type RaffleSeedConfigValidation = { ok: true; value: RaffleSeedConfig } | { ok: false; errors: string[] }

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validate and normalize the seed JSON config into a `RaffleSeedConfig`.
 * Hand-rolled `unknown` narrowing (no zod), matching this repo's validator
 * convention (see `lib/checkout/validation.ts`).
 */
export function parseRaffleSeedConfig(input: unknown): RaffleSeedConfigValidation {
  const errors: string[] = []

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["config must be a JSON object"] }
  }
  const raw = input as Record<string, unknown>

  const slug = typeof raw.slug === "string" ? raw.slug.trim() : ""
  if (!SLUG_PATTERN.test(slug)) errors.push("slug must match ^[a-z0-9-]{1,64}$")

  const title = typeof raw.title === "string" ? raw.title.trim() : ""
  if (title.length < 1) errors.push("title is required")

  const brand = typeof raw.brand === "string" && raw.brand.trim() ? raw.brand.trim() : "PLE"

  const eventDate = typeof raw.eventDate === "string" ? raw.eventDate.trim() : ""
  if (!DATE_ONLY_PATTERN.test(eventDate)) errors.push("eventDate must be an ISO date string (YYYY-MM-DD)")

  const excludePreviousWinners = typeof raw.excludePreviousWinners === "boolean" ? raw.excludePreviousWinners : true

  const videoUrl = typeof raw.videoUrl === "string" && raw.videoUrl.trim() ? raw.videoUrl.trim() : undefined

  const drawsInput = Array.isArray(raw.draws) ? raw.draws : []
  if (drawsInput.length === 0) errors.push("draws must be a non-empty array")

  const draws: RaffleSeedDrawConfig[] = []
  const seenOrders = new Set<number>()

  drawsInput.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      errors.push(`draws[${index}] must be an object`)
      return
    }
    const drawRaw = entry as Record<string, unknown>

    const order = typeof drawRaw.order === "number" && Number.isInteger(drawRaw.order) ? drawRaw.order : NaN
    if (!Number.isInteger(order) || order < 1) {
      errors.push(`draws[${index}].order must be a positive integer`)
      return
    }
    if (seenOrders.has(order)) {
      errors.push(`draws[${index}].order ${order} is duplicated`)
      return
    }
    seenOrders.add(order)

    const prizeLabel = typeof drawRaw.prizeLabel === "string" ? drawRaw.prizeLabel.trim() : ""
    if (!prizeLabel) {
      errors.push(`draws[${index}].prizeLabel is required`)
      return
    }

    const drawAt = typeof drawRaw.drawAt === "string" && drawRaw.drawAt.trim() ? drawRaw.drawAt.trim() : undefined
    if (drawAt && Number.isNaN(Date.parse(drawAt))) {
      errors.push(`draws[${index}].drawAt must be a valid ISO datetime`)
      return
    }

    draws.push({ order, prizeLabel, drawAt })
  })

  if (errors.length > 0) return { ok: false, errors }

  return { ok: true, value: { slug, title, brand, eventDate, excludePreviousWinners, videoUrl, draws } }
}

/**
 * Resolve the UTC offset (minutes) for America/New_York at a given UTC
 * instant, using `Intl.DateTimeFormat`'s `longOffset` name (e.g. "GMT-04:00").
 */
function getNyOffsetMinutes(atUtc: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
    hour: "2-digit",
  }).formatToParts(atUtc)
  const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00"
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offsetPart)
  if (!match) return 0
  const sign = match[1] === "-" ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3]))
}

/**
 * Normalize a `YYYY-MM-DD` date-only string to the UTC instant of the
 * America/New_York midnight that starts that day. This is the `eventDate`
 * stored on `RaffleEvent`, so `isRaffleEventClosed` (D11) can add the fixed
 * 24h grace window without any further timezone math at request time.
 */
export function nyMidnightUtc(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map(Number)
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const offsetMinutes = getNyOffsetMinutes(naiveUtc)
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000)
}

export type ExistingDrawRow = { id: string; order: number; status: string }

export type RaffleDrawUpsertPlan = {
  toCreate: RaffleSeedDrawConfig[]
  toUpdate: { id: string; order: number; prizeLabel: string; drawAt: Date | null }[]
  toSkip: { order: number; status: string; prizeLabel: string }[]
}

/**
 * Decide, for each configured draw, whether it must be created, updated, or
 * skipped-and-reported. A draw whose persisted status is not `open` (i.e.
 * `drawing` or `drawn`) is never mutated by the seed script (D8).
 */
export function planDrawUpserts(configDraws: RaffleSeedDrawConfig[], existingDraws: ExistingDrawRow[]): RaffleDrawUpsertPlan {
  const existingByOrder = new Map(existingDraws.map((draw) => [draw.order, draw]))
  const plan: RaffleDrawUpsertPlan = { toCreate: [], toUpdate: [], toSkip: [] }

  for (const draw of configDraws) {
    const existing = existingByOrder.get(draw.order)

    if (!existing) {
      plan.toCreate.push(draw)
      continue
    }

    if (existing.status !== "open") {
      plan.toSkip.push({ order: draw.order, status: existing.status, prizeLabel: draw.prizeLabel })
      continue
    }

    plan.toUpdate.push({
      id: existing.id,
      order: draw.order,
      prizeLabel: draw.prizeLabel,
      drawAt: draw.drawAt ? new Date(draw.drawAt) : null,
    })
  }

  return plan
}

export type RaffleScreenTokenPlan = { raw: string; hash: string }

/** SHA-256 hex digest of a raw screen token (persisted as `screenTokenHash`). */
export function hashRaffleScreenToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

/** Generate a fresh 32-byte base64url screen token and its persisted hash. */
export function generateRaffleScreenToken(): RaffleScreenTokenPlan {
  const raw = randomBytes(32).toString("base64url")
  return { raw, hash: hashRaffleScreenToken(raw) }
}

export type RaffleBaseUrlOverrides = {
  baseUrlArg?: string
  siteUrlEnv?: string
  vercelUrlEnv?: string
}

/**
 * `--base-url` flag ?? `NEXT_PUBLIC_SITE_URL` ?? `https://${VERCEL_URL}` ??
 * `http://localhost:3000` — same precedence as `getBaseUrl` in
 * `app/api/checkout/session/route.ts`.
 */
export function resolveRaffleBaseUrl(overrides: RaffleBaseUrlOverrides): string {
  const strip = (url: string) => url.replace(/\/+$/, "")
  if (overrides.baseUrlArg) return strip(overrides.baseUrlArg)
  if (overrides.siteUrlEnv) return strip(overrides.siteUrlEnv)
  if (overrides.vercelUrlEnv) return `https://${overrides.vercelUrlEnv}`
  return "http://localhost:3000"
}
