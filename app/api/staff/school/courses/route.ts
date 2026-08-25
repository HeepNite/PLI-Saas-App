import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { prisma } from "@/lib/prisma"
import { expandCourseScheduleSlots } from "@/lib/course-schedule-blocks"
import { doUtcIntervalsOverlapWithBuffer } from "@/lib/class-schedule"
import { findAvailableRoomsForSlot } from "@/lib/room-availability"

export const runtime = "nodejs"

const COURSE_KIND_VALUES = ["course", "program", "bootcamp", "workshop", "convention", "congress"] as const
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LEGACY_COURSE_MEDIA_PREFIX = "/uploads/course-media/"

type CourseScheduleRuleEntry = {
  weekday: number
  times: string[]
}

type CourseSpecialEventEntry = {
  date: string
  times: string[]
  label: string | null
}

type CoursePublicationMode = "publish_now" | "coming_soon" | "launch_date"
type CourseSpecialDiscountType = "none" | "valentines_desc" | "christmas_desc" | "custom"

type CoursePublicationSettings = {
  mode: CoursePublicationMode
  launchDate: string | null
}

type CourseSpecialDiscountSettings = {
  type: CourseSpecialDiscountType
  label: string | null
  priceCents: number | null
}

type CourseScheduleRulesPayload = {
  mode: "regular" | "special_event"
  weeklyDaysTarget: number
  repeatAllMonth: boolean
  recurrenceMode: "indefinite" | "until_date"
  recurrenceEndsAt: string | null
  rules: CourseScheduleRuleEntry[]
  specialEvents: CourseSpecialEventEntry[]
  publication?: CoursePublicationSettings
  specialDiscount?: CourseSpecialDiscountSettings
}

const parseCoursePublication = (value: unknown): CoursePublicationSettings => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : null
  const modeRaw = source?.mode
  const mode: CoursePublicationMode =
    modeRaw === "coming_soon" || modeRaw === "launch_date" || modeRaw === "publish_now" ? modeRaw : "publish_now"
  const launchDateRaw = typeof source?.launchDate === "string" ? source.launchDate.trim() : ""
  const launchDate = mode === "launch_date" && DATE_REGEX.test(launchDateRaw) ? launchDateRaw : null
  return { mode, launchDate }
}

const parseCourseSpecialDiscount = (value: unknown): CourseSpecialDiscountSettings => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : null
  const typeRaw = source?.type
  const type: CourseSpecialDiscountType =
    typeRaw === "valentines_desc" || typeRaw === "christmas_desc" || typeRaw === "custom" || typeRaw === "none"
      ? typeRaw
      : "none"
  const labelRaw = typeof source?.label === "string" ? source.label.trim() : ""
  const label = type === "custom" && labelRaw ? labelRaw : null
  const priceRaw = Number(source?.priceCents)
  const priceCents = Number.isFinite(priceRaw) && priceRaw >= 0 ? Math.round(priceRaw) : null
  return { type, label, priceCents }
}

const toSafeText = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "")
const isLegacyCourseMediaUrl = (value: string | null) => value?.startsWith(LEGACY_COURSE_MEDIA_PREFIX) ?? false
const normalizeCourseMediaUrl = (value: string | null) => (isLegacyCourseMediaUrl(value) ? null : value)
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

  const publication = parseCoursePublication(source.publication)
  const specialDiscount = parseCourseSpecialDiscount(source.specialDiscount)

  const hasPublicationOverride = publication.mode !== "publish_now" || Boolean(publication.launchDate)
  const hasSpecialDiscount =
    specialDiscount.type !== "none" || specialDiscount.priceCents !== null || Boolean(specialDiscount.label)
  if (rules.length === 0 && specialEvents.length === 0 && !hasPublicationOverride && !hasSpecialDiscount) return null

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
    publication,
    specialDiscount,
  }
}

const toOptionalInt = (value: unknown, min: number, max: number) => {
  if (value === null || value === undefined || value === "") return null
  const out = Number(value)
  if (!Number.isFinite(out)) return null
  return Math.max(min, Math.min(max, Math.round(out)))
}

const toOptionalRoomId = (value: unknown) => {
  if (value === null || value === undefined || value === "") return { ok: true as const, value: null }
  const normalized = toSafeText(value, 36).toLowerCase()
  if (!UUID_REGEX.test(normalized)) return { ok: false as const }
  return { ok: true as const, value: normalized }
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

const roomDelegate = (prisma as typeof prisma & {
  room: {
    findUnique: (args: unknown) => Promise<{ id: string; active: boolean } | null>
  }
}).room

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
    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        coverImageUrl: normalizeCourseMediaUrl(item.coverImageUrl),
        previewVideoUrl: normalizeCourseMediaUrl(item.previewVideoUrl),
      })),
    })
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
  const hasDefaultRoomId = Object.prototype.hasOwnProperty.call(body, "defaultRoomId")
  const defaultRoomIdResult = hasDefaultRoomId
    ? toOptionalRoomId(body.defaultRoomId)
    : ({ ok: true as const, value: undefined })
  const availableWeekdays = toWeekdays(body.availableWeekdays)
  const availableTimes = toTimes(body.availableTimes)
  const scheduleRules = toScheduleRules(body.scheduleRules)
  const scheduleRulesInput: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull = scheduleRules
    ? (scheduleRules as Prisma.InputJsonValue)
    : Prisma.JsonNull
  const active = typeof body.active === "boolean" ? body.active : true

  if (!slug || slug.length < 3) {
    return NextResponse.json({ error: "Slug is required (min 3 chars)." }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 })
  }
  if (coverImageUrl?.startsWith("blob:")) {
    return NextResponse.json({ error: "Invalid cover image URL. Upload the image before saving." }, { status: 400 })
  }
  if (previewVideoUrl?.startsWith("blob:")) {
    return NextResponse.json({ error: "Invalid preview video URL. Upload the video before saving." }, { status: 400 })
  }
  if (isLegacyCourseMediaUrl(coverImageUrl)) {
    return NextResponse.json({ error: "Legacy course image is no longer available. Re-upload the image before saving." }, { status: 400 })
  }
  if (isLegacyCourseMediaUrl(previewVideoUrl)) {
    return NextResponse.json({ error: "Legacy course video is no longer available. Re-upload the video before saving." }, { status: 400 })
  }
  if (!defaultRoomIdResult.ok) {
    return NextResponse.json({ error: "Invalid defaultRoomId." }, { status: 400 })
  }

  if (typeof defaultRoomIdResult.value === "string") {
    const room = await roomDelegate.findUnique({
      where: { id: defaultRoomIdResult.value },
      select: {
        id: true,
        active: true,
      },
    })

    if (!room || !room.active) {
      return NextResponse.json({ error: "Default room not found or inactive." }, { status: 404 })
    }

    // --- Schedule conflict check for room assignment ---
    const BUFFER_MINUTES = 15
    const windowStart = new Date()
    const windowEnd = new Date(windowStart.getTime() + 90 * 24 * 60 * 60 * 1000)

    // Expand this course's schedule into virtual slots
    const thisCourseSlots = expandCourseScheduleSlots(
      {
        scheduleRules: scheduleRules ?? null,
        availableWeekdays: availableWeekdays ?? [],
        availableTimes: availableTimes ?? [],
        defaultRoomId: defaultRoomIdResult.value,
        durationMinutes: durationMinutes ?? null,
      },
      windowStart,
      windowEnd,
    )

    if (thisCourseSlots.length > 0) {
      // Load other active courses assigned to the same room
      const otherCourses = await prisma.courseCatalog.findMany({
        where: {
          defaultRoomId: defaultRoomIdResult.value,
          active: true,
          slug: { not: slug },
        },
        select: { slug: true, title: true, scheduleRules: true, availableWeekdays: true, availableTimes: true, durationMinutes: true, defaultRoomId: true },
      })

      for (const other of otherCourses) {
        const otherSlots = expandCourseScheduleSlots(other, windowStart, windowEnd)
        for (const a of thisCourseSlots) {
          for (const b of otherSlots) {
            if (doUtcIntervalsOverlapWithBuffer(a.startsAt, a.endsAt, b.startsAt, b.endsAt, BUFFER_MINUTES * 60_000)) {
              const alternatives = await findAvailableRoomsForSlot({
                targetStartsAt: a.startsAt,
                targetEndsAt: a.endsAt,
                excludeRoomId: defaultRoomIdResult.value,
                bufferMinutes: BUFFER_MINUTES,
                prisma,
              })
              return NextResponse.json({
                error: `Room is already assigned to "${other.title}" with an overlapping schedule.`,
                conflictsWith: `${other.title} (${other.slug})`,
                availableRooms: alternatives,
              }, { status: 409 })
            }
          }
        }
      }

      // Also check against active reservations in this room
      const reservations = await prisma.roomReservation.findMany({
        where: {
          roomId: defaultRoomIdResult.value,
          status: "active",
          endsAt: { gt: windowStart },
          startsAt: { lt: windowEnd },
        },
        select: { id: true, title: true, startsAt: true, endsAt: true },
      })

      for (const res of reservations) {
        for (const slot of thisCourseSlots) {
          if (doUtcIntervalsOverlapWithBuffer(slot.startsAt, slot.endsAt, res.startsAt, res.endsAt, BUFFER_MINUTES * 60_000)) {
            const alternatives = await findAvailableRoomsForSlot({
              targetStartsAt: slot.startsAt,
              targetEndsAt: slot.endsAt,
              excludeRoomId: defaultRoomIdResult.value,
              bufferMinutes: BUFFER_MINUTES,
              prisma,
            })
            return NextResponse.json({
              error: `Room has a private reservation "${res.title}" that conflicts with this course schedule.`,
              conflictsWith: `Reservation: ${res.title}`,
              availableRooms: alternatives,
            }, { status: 409 })
          }
        }
      }
    }
    // --- End schedule conflict check ---
  }

  const createData = {
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
    defaultRoomId: defaultRoomIdResult.value ?? null,
    availableWeekdays,
    availableTimes,
    scheduleRules: scheduleRulesInput,
    active,
  } as Prisma.CourseCatalogUncheckedCreateInput

  const updateData = {
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
    ...(hasDefaultRoomId ? { defaultRoomId: defaultRoomIdResult.value ?? null } : {}),
    availableWeekdays,
    availableTimes,
    scheduleRules: scheduleRulesInput,
    active,
  } as Prisma.CourseCatalogUncheckedUpdateInput

  try {
    const item = await prisma.courseCatalog.upsert({
      where: { slug },
      create: createData,
      update: updateData,
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

export async function DELETE(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:courses:delete", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })

  // Only owner can delete courses
  if (authResult.role !== "owner") {
    return NextResponse.json({ error: "Only owners can delete courses." }, { status: 403 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const body = payload as Record<string, unknown>
  const slug = typeof body.slug === "string" ? body.slug.trim() : ""

  if (!slug) {
    return NextResponse.json({ error: "Slug is required." }, { status: 400 })
  }

  try {
    // Check if course exists
    const existing = await prisma.courseCatalog.findUnique({
      where: { slug },
      select: { id: true, title: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 })
    }

    // Delete the course
    await prisma.courseCatalog.delete({
      where: { slug },
    })

    return NextResponse.json({
      ok: true,
      message: `Course "${existing.title}" deleted.`,
    })
  } catch (error) {
    return prismaRouteError(error, "Unable to delete course.")
  }
}
