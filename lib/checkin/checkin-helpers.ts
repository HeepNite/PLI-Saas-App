import type { CourseData } from "@/constants/courses"
import { getAvailableTimesForCourseDate, getDateKeyInTimeZone, getTimeKeyInTimeZone, buildSessionStartsAt } from "@/lib/class-schedule"

// ─── Constants ────────────────────────────────────────────────

export const CHECKIN_TIME_ZONE = "America/New_York"
export const WALK_IN_LATE_GRACE_MINUTES = 30
export const TERMINAL_ROTATION_LEAD_MINUTES = 15
export const TERMINAL_LATE_PAYMENT_AFTER_END_MINUTES = 15
export const TERMINAL_LATE_PAYMENT_NEXT_CLASS_MAX_GAP_MINUTES = 120
export const TRANSIENT_MESSAGE_TIMEOUT_MS = 3200

// ─── Time utilities ───────────────────────────────────────────

export const pad = (value: number) => String(value).padStart(2, "0")

export const toMinutes = (value: string): number | null => {
  if (!/^\d{2}:\d{2}$/.test(value)) return null
  const [hour, minute] = value.split(":").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

export const sortTimes = (times: string[]) =>
  [...new Set(times.filter((value) => /^\d{2}:\d{2}$/.test(value)))].sort(
    (a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0)
  )

export const shiftIsoDate = (isoDate: string, days: number) => {
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoDate
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

export const toEsDateTime = (value: string, options?: Intl.DateTimeFormatOptions) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(parsed)
}

// ─── Course utilities ─────────────────────────────────────────

export const getCourseFamilyKey = (courseSlug: string) => {
  const [family] = courseSlug.split("-")
  return family?.trim().toLowerCase() || ""
}

export const toCategoryLabel = (courseSlug: string) => {
  const key = getCourseFamilyKey(courseSlug)
  if (!key) return "Program"
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export const parseDuration = (value: string | null) => {
  if (!value) return 60
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 60
  return Math.max(15, Math.min(240, parsed))
}

export const getCourseDurationMinutes = (courseSlug: string, courses: CourseData[], fallbackMinutes = 60) => {
  const course = courses.find((item) => item.slug === courseSlug)
  const match = course?.duration?.match(/(\d+)/)
  const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN
  if (!Number.isFinite(parsed)) return fallbackMinutes
  return Math.max(15, Math.min(240, parsed))
}

// ─── Recommendation algorithms ────────────────────────────────

export const pickWalkInRecommendation = (
  courses: CourseData[],
  referenceDate = new Date(),
  preferredCourseSlug = ""
): null | { courseSlug: string; date: string; time: string } => {
  const todayIso = getDateKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  if (!todayIso) return null
  const nowMinutes = toMinutes(getTimeKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE))
  const preferredFamily = getCourseFamilyKey(preferredCourseSlug)

  for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
    const dateIso = shiftIsoDate(todayIso, dayOffset)
    let bestForDay: null | { courseSlug: string; date: string; time: string; minutes: number; preferred: boolean } = null

    for (const course of courses) {
      const slots = sortTimes(getAvailableTimesForCourseDate(course.slug, dateIso, courses))
      for (const slot of slots) {
        const slotMinutes = toMinutes(slot)
        if (slotMinutes === null) continue
        if (dayOffset === 0 && nowMinutes !== null && nowMinutes > slotMinutes + WALK_IN_LATE_GRACE_MINUTES) {
          continue
        }

        const isPreferred = preferredFamily
          ? getCourseFamilyKey(course.slug) === preferredFamily
          : false

        if (
          !bestForDay ||
          slotMinutes < bestForDay.minutes ||
          (slotMinutes === bestForDay.minutes && isPreferred && !bestForDay.preferred)
        ) {
          bestForDay = {
            courseSlug: course.slug,
            date: dateIso,
            time: slot,
            minutes: slotMinutes,
            preferred: isPreferred,
          }
        }
      }
    }

    if (bestForDay) {
      return {
        courseSlug: bestForDay.courseSlug,
        date: bestForDay.date,
        time: bestForDay.time,
      }
    }
  }

  return null
}

export const pickTerminalContextRecommendation = (
  courses: CourseData[],
  referenceDate = new Date(),
  preferredCourseSlug = ""
): null | { courseSlug: string; date: string; time: string } => {
  const normalizedPreferredCourseSlug = preferredCourseSlug.trim().toLowerCase()
  const preferredCourse = normalizedPreferredCourseSlug
    ? courses.find((course) => course.slug === normalizedPreferredCourseSlug) || null
    : null

  if (preferredCourse) {
    const todayIso = getDateKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
    const nowMinutes = toMinutes(getTimeKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE))
    const courseDurationMinutes = getCourseDurationMinutes(preferredCourse.slug, courses)

    if (todayIso) {
      for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
        const dateIso = shiftIsoDate(todayIso, dayOffset)
        const slots = sortTimes(getAvailableTimesForCourseDate(preferredCourse.slug, dateIso, courses))

        for (const slot of slots) {
          const slotMinutes = toMinutes(slot)
          if (slotMinutes === null) continue
          // Use the course's actual duration so the slot stays valid until class ends,
          // preventing a gap between grace expiry and auto-rotation.
          const lateCutoff = slotMinutes + courseDurationMinutes
          if (dayOffset === 0 && nowMinutes !== null && nowMinutes > lateCutoff) {
            continue
          }

          return {
            courseSlug: preferredCourse.slug,
            date: dateIso,
            time: slot,
          }
        }
      }
    }
  }

  return pickWalkInRecommendation(courses, referenceDate)
}

export const pickLatePaymentRecommendation = (
  courses: CourseData[],
  referenceDate = new Date()
): null | { courseSlug: string; date: string; time: string } => {
  const todayIso = getDateKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  if (!todayIso) return null
  const nowMs = referenceDate.getTime()
  let bestMatch: null | { courseSlug: string; date: string; time: string; startsAtMs: number } = null
  const todaySlots: Array<{ courseSlug: string; time: string; startsAtMs: number; endsAtMs: number }> = []

  for (const course of courses) {
    const slots = sortTimes(getAvailableTimesForCourseDate(course.slug, todayIso, courses))
    const durationMinutes = getCourseDurationMinutes(course.slug, courses)
    for (const slot of slots) {
      const startsAt = buildSessionStartsAt(todayIso, slot)
      if (!startsAt) continue
      const startsAtMs = startsAt.getTime()
      const endsAtMs = startsAtMs + durationMinutes * 60 * 1000
      todaySlots.push({
        courseSlug: course.slug,
        time: slot,
        startsAtMs,
        endsAtMs,
      })
    }
  }

  todaySlots.sort((a, b) => a.startsAtMs - b.startsAtMs)

  for (let index = 0; index < todaySlots.length; index += 1) {
    const slot = todaySlots[index]
    const latePaymentOpensAtMs = slot.endsAtMs - TERMINAL_ROTATION_LEAD_MINUTES * 60 * 1000
    const latePaymentClosesAtMs = slot.endsAtMs + TERMINAL_LATE_PAYMENT_AFTER_END_MINUTES * 60 * 1000
    if (nowMs < latePaymentOpensAtMs || nowMs > latePaymentClosesAtMs) continue

    const nextSlot = todaySlots[index + 1] || null
    if (nextSlot) {
      const gapMinutes = Math.round((nextSlot.startsAtMs - slot.endsAtMs) / (60 * 1000))
      if (gapMinutes > TERMINAL_LATE_PAYMENT_NEXT_CLASS_MAX_GAP_MINUTES) {
        continue
      }
    }

    if (!bestMatch || slot.startsAtMs > bestMatch.startsAtMs) {
      bestMatch = {
        courseSlug: slot.courseSlug,
        date: todayIso,
        time: slot.time,
        startsAtMs: slot.startsAtMs,
      }
    }
  }

  if (!bestMatch) return null
  return {
    courseSlug: bestMatch.courseSlug,
    date: bestMatch.date,
    time: bestMatch.time,
  }
}

// ─── Customer utilities ───────────────────────────────────────

export const normalizeCustomerNameParts = (input: { firstName?: string; lastName?: string; name?: string }) => {
  const firstName = input.firstName?.trim() || ""
  const lastName = input.lastName?.trim() || ""
  if (firstName || lastName) {
    return { firstName, lastName }
  }

  const parts = (input.name || "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) {
    return { firstName: "", lastName: "" }
  }

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  }
}
