import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const COURSE_KIND_VALUES = ["course", "program", "bootcamp", "workshop", "convention"] as const
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

type CourseScheduleRuleEntry = {
  weekday: number
  times: string[]
}

type CourseSpecialEventEntry = {
  date: string
  times: string[]
  label: string | null
}

type CourseScheduleRulesPayload = {
  mode: "regular" | "special_event"
  weeklyDaysTarget: number
  repeatAllMonth: boolean
  recurrenceMode: "indefinite" | "until_date"
  recurrenceEndsAt: string | null
  rules: CourseScheduleRuleEntry[]
  specialEvents: CourseSpecialEventEntry[]
}

const toSafeText = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "")
const toSlug = (value: unknown, max = 80) =>
  toSafeText(value, max)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")

const toWeekdays = (value: unknown) => {
  if (!Array.isArray(value)) return [] as number[]
  return [...new Set(value.filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 6))].sort((a, b) => a - b)
}

const toTimes = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[]
  return [...new Set(value.filter((item): item is string => typeof item === "string" && TIME_REGEX.test(item.trim())).map((item) => item.trim()))]
}

const toScheduleRules = (value: unknown): CourseScheduleRulesPayload | null => {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const rawRules = Array.isArray(source.rules) ? source.rules : []
  const rawSpecialEvents = Array.isArray(source.specialEvents) ? source.specialEvents : []

  const grouped = new Map<number, Set<string>>()
  for (const rule of rawRules) {
    if (!rule || typeof rule !== "object") continue
    const candidate = rule as Record<string, unknown>
    const weekday = typeof candidate.weekday === "number" && Number.isInteger(candidate.weekday) ? candidate.weekday : null
    if (weekday === null || weekday < 0 || weekday > 6) continue
    const times = toTimes(candidate.times)
    if (times.length === 0) continue
    if (!grouped.has(weekday)) grouped.set(weekday, new Set<string>())
    const bucket = grouped.get(weekday)!
    times.forEach((time) => bucket.add(time))
  }

  const rules = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, times]) => ({
      weekday,
      times: [...times].sort(),
    }))

  const specialEventsGrouped = new Map<string, Set<string>>()
  for (const event of rawSpecialEvents) {
    if (!event || typeof event !== "object") continue
    const candidate = event as Record<string, unknown>
    const date = typeof candidate.date === "string" ? candidate.date.trim() : ""
    if (!DATE_REGEX.test(date)) continue
    const times = toTimes(candidate.times)
    if (times.length === 0) continue
    if (!specialEventsGrouped.has(date)) specialEventsGrouped.set(date, new Set<string>())
    const bucket = specialEventsGrouped.get(date)!
    times.forEach((time) => bucket.add(time))
  }

  const specialEvents = [...specialEventsGrouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, times]) => ({
      date,
      times: [...times].sort(),
      label: "Special event",
    }))

  if (rules.length === 0 && specialEvents.length === 0) return null

  const weeklyDaysTargetRaw = Number(source.weeklyDaysTarget)
  const weeklyDaysTarget = Number.isFinite(weeklyDaysTargetRaw)
    ? Math.max(1, Math.min(7, Math.round(weeklyDaysTargetRaw)))
    : Math.max(1, Math.min(7, rules.length || 1))

  const repeatAllMonth = typeof source.repeatAllMonth === "boolean" ? source.repeatAllMonth : true
  const recurrenceMode = source.recurrenceMode === "until_date" ? "until_date" : "indefinite"
  const recurrenceEndsAtRaw = typeof source.recurrenceEndsAt === "string" ? source.recurrenceEndsAt.trim() : ""
  const recurrenceEndsAt = recurrenceMode === "until_date" && DATE_REGEX.test(recurrenceEndsAtRaw) ? recurrenceEndsAtRaw : null
  const modeSource = source.mode === "special_event" ? "special_event" : source.mode === "regular" ? "regular" : null
  const mode: "regular" | "special_event" = modeSource || (specialEvents.length > 0 && rules.length === 0 ? "special_event" : "regular")

  return {
    mode,
    weeklyDaysTarget,
    repeatAllMonth,
    recurrenceMode,
    recurrenceEndsAt,
    rules,
    specialEvents,
  }
}

const toOptionalInt = (value: unknown, min: number, max: number) => {
  if (value === null || value === undefined || value === "") return null
  const out = Number(value)
  if (!Number.isFinite(out)) return null
  return Math.max(min, Math.min(max, Math.round(out)))
}

const prismaRouteError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
    return NextResponse.json(
      { error: "Database schema is out of sync. Run Prisma migrations (npx prisma migrate deploy)." },
      { status: 503 }
    )
  }
  console.error("Staff school courses route failed", error)
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:courses:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })

  try {
    const items = await prisma.courseCatalog.findMany({
      orderBy: [{ createdAt: "desc" }],
    })
    return NextResponse.json({ items })
  } catch (error) {
    return prismaRouteError(error, "Failed to load school courses.")
  }
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:courses:post", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const body = payload as Record<string, unknown>
  const slug = toSlug(body.slug, 80)
  const title = toSafeText(body.title, 120)
  const kindRaw = toSafeText(body.kind, 30).toLowerCase()
  const kind = (COURSE_KIND_VALUES.includes(kindRaw as (typeof COURSE_KIND_VALUES)[number]) ? kindRaw : "course") as (typeof COURSE_KIND_VALUES)[number]
  const category = toSafeText(body.category, 60) || null
  const description = toSafeText(body.description, 500) || null
  const coverImageUrl = toSafeText(body.coverImageUrl, 500) || null
  const previewVideoUrl = toSafeText(body.previewVideoUrl, 500) || null
  const dropInPriceCents = toOptionalInt(body.dropInPriceCents, 0, 2_000_000)
  const firstClassPriceCents = toOptionalInt(body.firstClassPriceCents, 0, 2_000_000)
  const level = toSafeText(body.level, 30) || null
  const durationMinutes = toOptionalInt(body.durationMinutes, 0, 600)
  const location = toSafeText(body.location, 160) || null
  const availableWeekdays = toWeekdays(body.availableWeekdays)
  const availableTimes = toTimes(body.availableTimes)
  const scheduleRules = toScheduleRules(body.scheduleRules)
  const active = typeof body.active === "boolean" ? body.active : true

  if (!slug || slug.length < 3) {
    return NextResponse.json({ error: "Slug is required (min 3 chars)." }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 })
  }

  try {
    const item = await prisma.courseCatalog.upsert({
      where: { slug },
      create: {
        slug,
        title,
        kind,
        category,
        description,
        coverImageUrl,
        previewVideoUrl,
        dropInPriceCents,
        firstClassPriceCents,
        level,
        durationMinutes,
        location,
        availableWeekdays,
        availableTimes,
        scheduleRules,
        active,
      },
      update: {
        title,
        kind,
        category,
        description,
        coverImageUrl,
        previewVideoUrl,
        dropInPriceCents,
        firstClassPriceCents,
        level,
        durationMinutes,
        location,
        availableWeekdays,
        availableTimes,
        scheduleRules,
        active,
      },
    })

    return NextResponse.json({
      ok: true,
      item,
      message: "Course saved.",
    })
  } catch (error) {
    return prismaRouteError(error, "Unable to save course.")
  }
}
