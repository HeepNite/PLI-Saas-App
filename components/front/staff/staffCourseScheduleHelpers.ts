import {
  COURSE_KIND_LABELS,
  DEFAULT_QUICK_SCHEDULE_TIMES,
  ISO_DATE_REGEX,
  QUICK_SCHEDULE_SLOT_COUNT,
  WEEKDAY_LABELS,
  type CoursePublicationMode,
  type CourseSpecialDiscountType,
} from "./staffAdminConstants"
import { formatClockLabel, formatIsoDate, normalizeClockTime } from "./staffAdminFormatters"
import type {
  CoursePublicationSettings,
  CourseScheduleRuleEntry,
  CourseScheduleRulesPayload,
  CourseScheduleSlot,
  CourseSpecialDiscountSettings,
  CourseSpecialEventEntry,
  SchoolCourseRow,
} from "./staffAdminTypes"

export const normalizeQuickScheduleTimes = (values: string[]) => {
  const normalized = [...new Set(values.map((item) => normalizeClockTime(String(item))).filter((item): item is string => Boolean(item)))]
    .sort((a, b) => a.localeCompare(b))

  if (normalized.length < QUICK_SCHEDULE_SLOT_COUNT) {
    for (const fallback of DEFAULT_QUICK_SCHEDULE_TIMES) {
      const value = normalizeClockTime(fallback)
      if (!value || normalized.includes(value)) continue
      normalized.push(value)
      if (normalized.length >= QUICK_SCHEDULE_SLOT_COUNT) break
    }
  }

  return normalized.sort((a, b) => a.localeCompare(b)).slice(0, QUICK_SCHEDULE_SLOT_COUNT)
}

export const toCourseScheduleWeekday = (isoDate: string) => {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.getDay()
}

export const getCourseSlotWeekday = (slot: CourseScheduleSlot) => {
  if (typeof slot.weekday === "number" && slot.weekday >= 0 && slot.weekday <= 6) return slot.weekday
  if (slot.date) return toCourseScheduleWeekday(slot.date)
  return null
}

export const getCourseSlotKey = (slot: CourseScheduleSlot) => {
  const time = normalizeClockTime(slot.time)
  if (typeof slot.weekday === "number") return `w:${slot.weekday}|${time}`
  return `d:${slot.date || ""}|${time}`
}

export const formatCourseSlotLabel = (slot: CourseScheduleSlot) => {
  const timeLabel = formatClockLabel(slot.time)
  if (typeof slot.weekday === "number") {
    const weekdayLabel = WEEKDAY_LABELS[slot.weekday] || `Day ${slot.weekday}`
    return `Every ${weekdayLabel} · ${timeLabel}`
  }
  return `${slot.date || "—"} · ${timeLabel}`
}

export const formatCourseWeekdayList = (weekdays: number[]) =>
  weekdays
    .map((weekday) => WEEKDAY_LABELS[weekday] || `Day ${weekday}`)
    .filter(Boolean)
    .join(" / ")

export const formatCourseTimesList = (times: string[]) =>
  times
    .map((time) => normalizeClockTime(time))
    .filter((time): time is string => Boolean(time))
    .map((time) => formatClockLabel(time))
    .join(", ")

export const buildAssignmentCourseScheduleLabel = (course: SchoolCourseRow) => {
  const parsedRules = normalizeCourseScheduleRules(course.scheduleRules)
  const ruleWeekdays = parsedRules ? [...new Set(parsedRules.rules.map((rule) => rule.weekday))].sort((a, b) => a - b) : []
  const ruleTimes = parsedRules
    ? [...new Set(parsedRules.rules.flatMap((rule) => rule.times).map((time) => normalizeClockTime(time)).filter(Boolean))].sort()
    : []
  const weekdays = ruleWeekdays.length > 0 ? ruleWeekdays : course.availableWeekdays
  const times = ruleTimes.length > 0 ? ruleTimes : course.availableTimes.map((time) => normalizeClockTime(time)).filter(Boolean)
  const weekdayLabel = weekdays.length > 0 ? formatCourseWeekdayList(weekdays) : ""
  const timeLabel = times.length > 0 ? formatCourseTimesList(times) : ""

  if (weekdayLabel && timeLabel) return `${weekdayLabel} · ${timeLabel}`
  if (weekdayLabel) return weekdayLabel
  if (timeLabel) return timeLabel

  const firstSpecialEvent = parsedRules?.specialEvents[0]
  if (!firstSpecialEvent) return null
  const specialEventTimes = formatCourseTimesList(firstSpecialEvent.times)
  return specialEventTimes ? `${formatIsoDate(firstSpecialEvent.date)} · ${specialEventTimes}` : formatIsoDate(firstSpecialEvent.date)
}

export const buildAssignmentCourseKindLabel = (course: SchoolCourseRow) => {
  const kindLabel = COURSE_KIND_LABELS[course.kind] || course.kind || ""
  if (kindLabel && course.category) return `${kindLabel} · ${course.category}`
  return kindLabel || course.category || null
}

export const compareCourseSlots = (a: CourseScheduleSlot, b: CourseScheduleSlot) => {
  const aWeekday = getCourseSlotWeekday(a)
  const bWeekday = getCourseSlotWeekday(b)
  const aTime = normalizeClockTime(a.time)
  const bTime = normalizeClockTime(b.time)
  if (aWeekday !== null && bWeekday !== null && aWeekday !== bWeekday) return aWeekday - bWeekday
  if (aTime !== bTime) return aTime.localeCompare(bTime)
  const aDate = a.date || ""
  const bDate = b.date || ""
  return aDate.localeCompare(bDate)
}

export const deriveCourseScheduleData = (slots: CourseScheduleSlot[]) => {
  if (slots.length === 0) {
    return { weekdays: [] as number[], times: [] as string[] }
  }
  const weekdays = [...new Set(slots.map((slot) => getCourseSlotWeekday(slot)).filter((item): item is number => item !== null))].sort(
    (a, b) => a - b
  )
  const times = [...new Set(slots.map((slot) => normalizeClockTime(slot.time)).filter(Boolean))].sort()
  return { weekdays, times }
}

export const normalizeCourseScheduleRules = (value: unknown): CourseScheduleRulesPayload | null => {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const rulesInput = Array.isArray(source.rules) ? source.rules : []
  const grouped = new Map<number, Set<string>>()

  for (const rule of rulesInput) {
    if (!rule || typeof rule !== "object") continue
    const candidate = rule as Record<string, unknown>
    const weekday =
      typeof candidate.weekday === "number" && Number.isInteger(candidate.weekday) && candidate.weekday >= 0 && candidate.weekday <= 6
        ? candidate.weekday
        : null
    if (weekday === null) continue
    const times = Array.isArray(candidate.times)
      ? candidate.times.map((time) => normalizeClockTime(String(time))).filter(Boolean)
      : []
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

  const specialEventsInput = Array.isArray(source.specialEvents) ? source.specialEvents : []
  const specialEventsMap = new Map<string, Set<string>>()
  for (const item of specialEventsInput) {
    if (!item || typeof item !== "object") continue
    const candidate = item as Record<string, unknown>
    const date = typeof candidate.date === "string" && ISO_DATE_REGEX.test(candidate.date.trim()) ? candidate.date.trim() : ""
    if (!date) continue
    const times = Array.isArray(candidate.times)
      ? candidate.times.map((time) => normalizeClockTime(String(time))).filter(Boolean)
      : []
    if (times.length === 0) continue
    if (!specialEventsMap.has(date)) specialEventsMap.set(date, new Set<string>())
    const bucket = specialEventsMap.get(date)!
    times.forEach((time) => bucket.add(time))
  }
  const specialEvents = [...specialEventsMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, times]) => ({
      date,
      times: [...times].sort(),
      label: "Special event",
    }))

  const publicationSource =
    source.publication && typeof source.publication === "object"
      ? (source.publication as Record<string, unknown>)
      : null
  const publicationModeRaw = publicationSource?.mode
  const publicationMode: CoursePublicationMode =
    publicationModeRaw === "coming_soon" || publicationModeRaw === "launch_date" || publicationModeRaw === "publish_now"
      ? publicationModeRaw
      : "publish_now"
  const launchDateRaw = typeof publicationSource?.launchDate === "string" ? publicationSource.launchDate.trim() : ""
  const launchDate = publicationMode === "launch_date" && ISO_DATE_REGEX.test(launchDateRaw) ? launchDateRaw : null
  const publication: CoursePublicationSettings = {
    mode: publicationMode,
    launchDate,
  }

  const specialDiscountSource =
    source.specialDiscount && typeof source.specialDiscount === "object"
      ? (source.specialDiscount as Record<string, unknown>)
      : null
  const specialDiscountTypeRaw = specialDiscountSource?.type
  const specialDiscountType: CourseSpecialDiscountType =
    specialDiscountTypeRaw === "valentines_desc" ||
    specialDiscountTypeRaw === "christmas_desc" ||
    specialDiscountTypeRaw === "custom" ||
    specialDiscountTypeRaw === "none"
      ? specialDiscountTypeRaw
      : "none"
  const specialDiscountLabelRaw = typeof specialDiscountSource?.label === "string" ? specialDiscountSource.label.trim() : ""
  const specialDiscountLabel = specialDiscountType === "custom" && specialDiscountLabelRaw ? specialDiscountLabelRaw : null
  const specialDiscountPriceRaw = Number(specialDiscountSource?.priceCents)
  const specialDiscountPrice =
    Number.isFinite(specialDiscountPriceRaw) && specialDiscountPriceRaw >= 0
      ? Math.round(specialDiscountPriceRaw)
      : null
  const specialDiscount: CourseSpecialDiscountSettings = {
    type: specialDiscountType,
    label: specialDiscountLabel,
    priceCents: specialDiscountPrice,
  }

  const hasPublicationOverride = publication.mode !== "publish_now" || Boolean(publication.launchDate)
  const hasSpecialDiscount =
    specialDiscount.type !== "none" || specialDiscount.priceCents !== null || Boolean(specialDiscount.label)
  if (rules.length === 0 && specialEvents.length === 0 && !hasPublicationOverride && !hasSpecialDiscount) return null

  const target = Number(source.weeklyDaysTarget)
  const weeklyDaysTarget = Number.isFinite(target) ? Math.max(1, Math.min(7, Math.round(target))) : Math.max(1, Math.min(7, rules.length))
  const repeatAllMonth = typeof source.repeatAllMonth === "boolean" ? source.repeatAllMonth : true
  const recurrenceMode = source.recurrenceMode === "until_date" ? "until_date" : "indefinite"
  const recurrenceEndsAt = recurrenceMode === "until_date" && typeof source.recurrenceEndsAt === "string" ? source.recurrenceEndsAt : null
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

export const buildSlotsFromScheduleRules = (payload: CourseScheduleRulesPayload) => {
  const slots: CourseScheduleSlot[] = []
  for (const rule of payload.rules) {
    for (const time of rule.times) {
      const normalized = normalizeClockTime(time)
      if (!normalized) continue
      slots.push({ weekday: rule.weekday, recurring: true, time: normalized })
    }
  }
  for (const event of payload.specialEvents) {
    for (const time of event.times) {
      const normalized = normalizeClockTime(time)
      if (!normalized) continue
      slots.push({ date: event.date, time: normalized })
    }
  }
  return slots.sort(compareCourseSlots)
}

export const deriveRulesFromScheduleSlots = (slots: CourseScheduleSlot[]): CourseScheduleRuleEntry[] => {
  const grouped = new Map<number, Set<string>>()
  for (const slot of slots) {
    if (typeof slot.weekday !== "number") continue
    const normalized = normalizeClockTime(slot.time)
    if (!normalized) continue
    if (!grouped.has(slot.weekday)) grouped.set(slot.weekday, new Set<string>())
    grouped.get(slot.weekday)!.add(normalized)
  }
  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, times]) => ({
      weekday,
      times: [...times].sort(),
    }))
}

export const deriveSpecialEventsFromScheduleSlots = (slots: CourseScheduleSlot[]): CourseSpecialEventEntry[] => {
  const grouped = new Map<string, Set<string>>()
  for (const slot of slots) {
    if (!slot.date || !ISO_DATE_REGEX.test(slot.date)) continue
    const normalized = normalizeClockTime(slot.time)
    if (!normalized) continue
    if (!grouped.has(slot.date)) grouped.set(slot.date, new Set<string>())
    grouped.get(slot.date)!.add(normalized)
  }
  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, times]) => ({
      date,
      times: [...times].sort(),
      label: "Special event",
    }))
}

export const parseMinutesFromClassTime = (classTime: string | null) => {
  if (!classTime) return null
  const value = classTime.trim().toUpperCase()
  if (!value) return null
  const match = value.match(/(\d{1,2})[:h](\d{2})(?:\s*([AP]M))?/)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null
  const meridiem = match[3]
  if (meridiem === "PM" && hour < 12) hour += 12
  if (meridiem === "AM" && hour === 12) hour = 0
  if (hour < 0 || hour > 23) return null
  return hour * 60 + minute
}

export const resolveTimeWindowByMinute = (minutes: number) => {
  if (minutes >= 300 && minutes < 720) return "Morning"
  if (minutes >= 720 && minutes < 1020) return "Afternoon"
  if (minutes >= 1020 && minutes < 1320) return "Evening"
  return "Night"
}
