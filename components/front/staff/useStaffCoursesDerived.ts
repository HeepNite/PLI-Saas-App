import React from "react"

import {
  COURSE_KIND_DATE_TONE,
  COURSE_KIND_LABELS,
  COURSE_KIND_REVIEW_HINTS,
  SCHOOL_COURSE_KINDS,
} from "./staffAdminConstants"
import {
  formatClockLabel,
  normalizeClockTime,
  toLocalIsoDate,
} from "./staffAdminFormatters"
import {
  normalizeCourseScheduleRules,
  toCourseScheduleWeekday,
  deriveCourseScheduleData,
} from "./staffCourseScheduleHelpers"
import type { CourseFormState, CourseScheduleSlot, SchoolCourseRow } from "./staffAdminTypes"

const parseAbsoluteVideoUrl = (value: string) => {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

const toEmbedVideoUrl = (input: string) => {
  const value = input.trim()
  if (!value) return ""
  const url = parseAbsoluteVideoUrl(value)
  if (!url) return value
  const hostname = url.hostname.toLowerCase()
  if (hostname === "youtube.com" || hostname === "www.youtube.com" || hostname === "m.youtube.com") {
    const id = url.searchParams.get("v")?.trim()
    return id ? `https://www.youtube.com/embed/${id}` : value
  }
  if (hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0]
    return id ? `https://www.youtube.com/embed/${id}` : value
  }
  if (hostname === "vimeo.com" || hostname === "www.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0]
    return id ? `https://player.vimeo.com/video/${id}` : value
  }
  return value
}

const isEmbedVideoUrl = (value: string) => {
  const url = parseAbsoluteVideoUrl(value)
  if (!url) return false
  const hostname = url.hostname.toLowerCase()
  return (
    ((hostname === "youtube.com" || hostname === "www.youtube.com") && url.pathname.startsWith("/embed/")) ||
    (hostname === "player.vimeo.com" && url.pathname.startsWith("/video/"))
  )
}

const toAutoplayEmbedUrl = (value: string) => {
  const base = value.trim()
  if (!base) return ""
  const hasQuery = base.includes("?")
  const url = parseAbsoluteVideoUrl(base)
  const hostname = url?.hostname.toLowerCase()
  if ((hostname === "youtube.com" || hostname === "www.youtube.com") && url?.pathname.startsWith("/embed/")) {
    return `${base}${hasQuery ? "&" : "?"}autoplay=1&mute=1&controls=0&rel=0&playsinline=1`
  }
  if (hostname === "player.vimeo.com" && url?.pathname.startsWith("/video/")) {
    return `${base}${hasQuery ? "&" : "?"}autoplay=1&muted=1&background=1`
  }
  return base
}

export type StaffCoursesDerivedInput = {
  courseForm: CourseFormState
  courseScheduleSlots: CourseScheduleSlot[]
  schoolCourses: SchoolCourseRow[]
  isSpecialEventCourse: boolean
  courseLocalImagePreview: string
  courseLocalVideoPreview: string
  // Pre-computed conflict maps (owned by main hook to avoid circular deps)
  externalRecurringSlotsMap: Map<string, { title: string; slug: string }[]>
  externalSpecialEventSlots: Array<{ date: string; time: string; title: string; slug: string }>
  externalSpecialEventSlotMap: Map<string, { title: string; slug: string }[]>
  setSchoolError: (value: string | null) => void
  setSchoolSuccess: (value: string | null) => void
}

export const useStaffCoursesDerived = (input: StaffCoursesDerivedInput) => {
  const {
    courseForm,
    courseScheduleSlots,
    schoolCourses,
    isSpecialEventCourse,
    courseLocalImagePreview,
    courseLocalVideoPreview,
    externalRecurringSlotsMap,
    externalSpecialEventSlots,
    externalSpecialEventSlotMap,
    setSchoolError,
    setSchoolSuccess,
  } = input

  // ─── Derived schedule data ───────────────────────────────────────
  const scheduleDerivedData = React.useMemo(
    () => deriveCourseScheduleData(courseScheduleSlots),
    [courseScheduleSlots]
  )

  const scheduleCalendarMap = React.useMemo(() => {
    const map = new Map<string, string[]>()
    const appendTime = (isoDate: string, rawTime: string) => {
      const normalized = normalizeClockTime(rawTime)
      if (!normalized) return
      const existing = map.get(isoDate) || []
      if (!existing.includes(normalized)) {
        const next = [...existing, normalized].sort()
        map.set(isoDate, next)
      }
    }

    const recurring = courseScheduleSlots.filter(
      (slot): slot is CourseScheduleSlot & { weekday: number } =>
        typeof slot.weekday === "number" && slot.weekday >= 0 && slot.weekday <= 6 && !!normalizeClockTime(slot.time)
    )
    const explicitDates = courseScheduleSlots.filter((slot) => typeof slot.date === "string" && !!slot.date)

    for (const slot of explicitDates) {
      appendTime(slot.date!, slot.time)
    }

    if (recurring.length > 0) {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      start.setMonth(start.getMonth() - 1)
      const end = new Date(start)
      end.setFullYear(end.getFullYear() + 2)

      for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const weekday = cursor.getDay()
        const isoDate = toLocalIsoDate(cursor)
        for (const slot of recurring) {
          if (slot.weekday !== weekday) continue
          appendTime(isoDate, slot.time)
        }
      }
    }

    return map
  }, [courseScheduleSlots])

  const getCourseScheduleDateTooltip = React.useCallback(
    (isoDate: string) => {
      const times = scheduleCalendarMap.get(isoDate)
      if (!times || times.length === 0) return undefined
      return `${courseForm.title || "Course"} · ${times.map((time) => formatClockLabel(time)).join(", ")}`
    },
    [courseForm.title, scheduleCalendarMap]
  )

  const getCourseScheduleDateTone = React.useCallback(
    (isoDate: string) => {
      const times = scheduleCalendarMap.get(isoDate)
      if (!times || times.length === 0) return undefined
      return COURSE_KIND_DATE_TONE[courseForm.kind] || "course"
    },
    [courseForm.kind, scheduleCalendarMap]
  )

  // ─── Preview / share ─────────────────────────────────────────────
  const previewMediaUrl = courseLocalImagePreview || courseForm.previewImageUrl.trim()
  const previewVideoUrl = courseLocalVideoPreview || courseForm.previewVideoUrl.trim()
  const embedPreviewVideoUrl = toEmbedVideoUrl(previewVideoUrl)
  const isEmbedPreviewVideo = isEmbedVideoUrl(embedPreviewVideoUrl)
  const previewVideoSource = isEmbedPreviewVideo ? toAutoplayEmbedUrl(embedPreviewVideoUrl) : previewVideoUrl
  const selectedCourseKindLabel = COURSE_KIND_LABELS[courseForm.kind] || "Course"
  const selectedCourseKindReviewLabel = `${selectedCourseKindLabel} review`
  const courseReviewVariants = React.useMemo(
    () =>
      SCHOOL_COURSE_KINDS.map((kind) => ({
        kind,
        label: COURSE_KIND_LABELS[kind] || kind,
        hint: COURSE_KIND_REVIEW_HINTS[kind] || "",
        active: courseForm.kind === kind,
      })),
    [courseForm.kind]
  )
  const previewEditorHref = courseForm.slug.trim()
    ? `/staff/school/course/${courseForm.slug.trim()}`
    : "/staff/portal?nav=schedule"
  const previewPublicHref = courseForm.slug.trim() ? `/courses/${courseForm.slug.trim()}` : ""

  const getCourseShareUrl = React.useCallback(() => {
    if (!previewPublicHref) return ""
    if (typeof window === "undefined") return previewPublicHref
    return `${window.location.origin}${previewPublicHref}`
  }, [previewPublicHref])

  const copyCourseLink = React.useCallback(async () => {
    const link = getCourseShareUrl()
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setSchoolSuccess("Course link copied.")
      setSchoolError(null)
    } catch {
      setSchoolError("Could not copy the course link.")
    }
  }, [getCourseShareUrl, setSchoolError, setSchoolSuccess])

  const shareCourse = React.useCallback(
    (platform: "facebook" | "x" | "whatsapp" | "instagram" | "tiktok") => {
      const link = getCourseShareUrl()
      if (!link || typeof window === "undefined") return
      const encodedUrl = encodeURIComponent(link)
      const text = encodeURIComponent(`Check out this course: ${courseForm.title || "New PLI course"}`)
      if (platform === "instagram" || platform === "tiktok") {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          void navigator.clipboard
            .writeText(link)
            .then(() => {
              setSchoolSuccess("Link copied. Paste it into your social media post.")
              setSchoolError(null)
            })
            .catch(() => {
              setSchoolError("Could not copy the course link.")
            })
        }
        const socialHref = platform === "instagram" ? "https://www.instagram.com/" : "https://www.tiktok.com/"
        window.open(socialHref, "_blank", "noopener,noreferrer")
        return
      }
      const href =
        platform === "facebook"
          ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
          : platform === "x"
            ? `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`
            : `https://wa.me/?text=${text}%20${encodedUrl}`
      window.open(href, "_blank", "noopener,noreferrer")
    },
    [courseForm.title, getCourseShareUrl, setSchoolError, setSchoolSuccess]
  )

  // ─── Computed from pre-built conflict maps ───────────────────────
  const regularSlotsBlockedByEvents = React.useMemo(() => {
    if (isSpecialEventCourse) return [] as Array<{ date: string; time: string; title: string }>
    const recurringSlots = courseScheduleSlots.filter(
      (slot): slot is CourseScheduleSlot & { weekday: number } =>
        typeof slot.weekday === "number" && slot.weekday >= 0 && slot.weekday <= 6
    )
    if (recurringSlots.length === 0) return [] as Array<{ date: string; time: string; title: string }>
    const entries: Array<{ date: string; time: string; title: string }> = []
    const seen = new Set<string>()
    for (const recurringSlot of recurringSlots) {
      const time = normalizeClockTime(recurringSlot.time)
      if (!time) continue
      for (const specialSlot of externalSpecialEventSlots) {
        if (specialSlot.time !== time) continue
        const eventWeekday = toCourseScheduleWeekday(specialSlot.date)
        if (eventWeekday !== recurringSlot.weekday) continue
        const key = `${specialSlot.date}|${time}|${specialSlot.slug}`
        if (seen.has(key)) continue
        seen.add(key)
        entries.push({ date: specialSlot.date, time, title: specialSlot.title })
      }
    }
    return entries.sort((a, b) => `${a.date}|${a.time}`.localeCompare(`${b.date}|${b.time}`))
  }, [courseScheduleSlots, externalSpecialEventSlots, isSpecialEventCourse])

  const regularScheduleWarningMessage = React.useMemo(() => {
    if (regularSlotsBlockedByEvents.length === 0) return null
    const first = regularSlotsBlockedByEvents[0]
    const next = regularSlotsBlockedByEvents.length > 1 ? ` +${regularSlotsBlockedByEvents.length - 1} more` : ""
    return `Warning: there are special events that conflict with this time slot (${first.date} · ${formatClockLabel(first.time)} · ${first.title}${next}). That day skips the regular class and continues on the next available day.`
  }, [regularSlotsBlockedByEvents])

  // ─── Derived schedule usage maps ─────────────────────────────────
  const scheduleSlotTimeUsage = React.useMemo(() => {
    const counter = new Map<string, number>()
    for (const slot of courseScheduleSlots) {
      const normalized = normalizeClockTime(slot.time)
      if (!normalized) continue
      counter.set(normalized, (counter.get(normalized) || 0) + 1)
    }
    return counter
  }, [courseScheduleSlots])

  const scheduleTimeCourseUsage = React.useMemo(() => {
    const counter = new Map<string, number>()
    for (const course of schoolCourses) {
      const courseTimes = new Set<string>()
      const parsedRules = normalizeCourseScheduleRules(course.scheduleRules)
      if (parsedRules) {
        for (const rule of parsedRules.rules) {
          for (const rawTime of rule.times) {
            const normalized = normalizeClockTime(rawTime)
            if (normalized) courseTimes.add(normalized)
          }
        }
      } else {
        for (const rawTime of course.availableTimes) {
          const normalized = normalizeClockTime(rawTime)
          if (normalized) courseTimes.add(normalized)
        }
      }
      courseTimes.forEach((time) => counter.set(time, (counter.get(time) || 0) + 1))
    }
    return counter
  }, [schoolCourses])

  const scheduleTimeOptions = React.useMemo(() => {
    const options: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      options.push(`${String(hour).padStart(2, "0")}:00`)
      options.push(`${String(hour).padStart(2, "0")}:30`)
    }
    return options
  }, [])

  return {
    scheduleDerivedData,
    scheduleCalendarMap,
    getCourseScheduleDateTooltip,
    getCourseScheduleDateTone,
    previewMediaUrl,
    previewVideoUrl,
    embedPreviewVideoUrl,
    isEmbedPreviewVideo,
    previewVideoSource,
    selectedCourseKindLabel,
    selectedCourseKindReviewLabel,
    courseReviewVariants,
    previewEditorHref,
    previewPublicHref,
    getCourseShareUrl,
    copyCourseLink,
    shareCourse,
    regularSlotsBlockedByEvents,
    regularScheduleWarningMessage,
    scheduleSlotTimeUsage,
    scheduleTimeCourseUsage,
    scheduleTimeOptions,
  }
}
