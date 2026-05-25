import React from "react"
import type { ReadonlyURLSearchParams } from "next/navigation"

import {
  COURSE_KIND_DATE_TONE,
  COURSE_KIND_LABELS,
  COURSE_KIND_REVIEW_HINTS,
  DEFAULT_QUICK_SCHEDULE_TIMES,
  ISO_DATE_REGEX,
  SCHOOL_COURSE_KINDS,
  SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY,
  SPECIAL_EVENT_COURSE_KINDS,
  type CoursePublicationMode,
  type CourseSpecialDiscountType,
} from "./staffAdminConstants"
import {
  centsToUsdInput,
  formatClockLabel,
  normalizeClockTime,
  toLocalIsoDate,
} from "./staffAdminFormatters"
import {
  buildSlotsFromScheduleRules,
  compareCourseSlots,
  deriveCourseScheduleData,
  deriveRulesFromScheduleSlots,
  deriveSpecialEventsFromScheduleSlots,
  getCourseSlotKey,
  normalizeCourseScheduleRules,
  normalizeQuickScheduleTimes,
  toCourseScheduleWeekday,
} from "./staffCourseScheduleHelpers"
import type {
  CourseFormState,
  CourseScheduleRulesPayload,
  CourseScheduleSlot,
  CourseSpecialDiscountSettings,
  CoursePublicationSettings,
  SchoolCourseRow,
} from "./staffAdminTypes"
import type { useSchoolWizard } from "./school"

const usdInputToCents = (value: string) => {
  const clean = value.trim().replace(",", ".")
  if (!clean) return null
  const parsed = Number(clean)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

const COURSE_IMAGE_MAX_BYTES = 2 * 1024 * 1024
const COURSE_VIDEO_MAX_BYTES = 15 * 1024 * 1024
const COURSE_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const COURSE_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"])

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

const createInitialCourseForm = (): CourseFormState => ({
  slug: "",
  title: "",
  kind: "course",
  category: "",
  description: "",
  previewImageUrl: "",
  previewVideoUrl: "",
  dropInPriceCents: "",
  firstClassPriceCents: "",
  level: "Beginner",
  durationMinutes: "55",
  location: "54 Coles St, Jersey City, NJ",
  defaultRoomId: "",
  publicationMode: "publish_now",
  launchDate: "",
  specialDiscountType: "none",
  specialDiscountCustomLabel: "",
  specialDiscountPrice: "",
  availableTimesCsv: "",
  active: true,
})

const loadShortcutsFromStorage = (): string[] => {
  if (typeof window === "undefined") return normalizeQuickScheduleTimes(DEFAULT_QUICK_SCHEDULE_TIMES)
  try {
    const raw = window.localStorage.getItem(SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY)
    if (!raw) return normalizeQuickScheduleTimes(DEFAULT_QUICK_SCHEDULE_TIMES)
    const parsed = JSON.parse(raw) as { quick?: unknown }
    if (Array.isArray(parsed.quick)) {
      const nextQuick = parsed.quick
        .map((item) => normalizeClockTime(String(item)))
        .filter((item): item is string => Boolean(item))
      if (nextQuick.length > 0) return normalizeQuickScheduleTimes(nextQuick)
    }
  } catch {
    // ignore corrupted local storage
  }
  return normalizeQuickScheduleTimes(DEFAULT_QUICK_SCHEDULE_TIMES)
}

export type CourseSlugConflictState = {
  exists: boolean
  suggestion: string | null
  existingTitle: string | null
}

export type StaffCoursesAdminInput = {
  schoolCourses: SchoolCourseRow[]
  isSchoolView: boolean
  searchParams: ReadonlyURLSearchParams | null
  schoolWizard: ReturnType<typeof useSchoolWizard>
  fetchSchoolData: (options?: { showLoader?: boolean }) => Promise<void>
  loadCourseLinks: (courseSlug: string) => Promise<void>
  clearCourseLinks: () => void
  resetCourseLinkForm: () => void
  handleStaffAuthFailure: (status: number) => boolean
  setSchoolError: (value: string | null) => void
  setSchoolSuccess: (value: string | null) => void
  setSchoolBusy: (value: "course" | "package" | "rule" | "assign" | null) => void
}

export const useStaffCoursesAdmin = (input: StaffCoursesAdminInput) => {
  const {
    schoolCourses,
    isSchoolView,
    searchParams,
    schoolWizard,
    fetchSchoolData,
    loadCourseLinks,
    clearCourseLinks,
    resetCourseLinkForm,
    handleStaffAuthFailure,
    setSchoolError,
    setSchoolSuccess,
    setSchoolBusy,
  } = input

  const [courseForm, setCourseForm] = React.useState<CourseFormState>(() => createInitialCourseForm())
  const [courseWeekdays, setCourseWeekdays] = React.useState<number[]>([])
  const [courseScheduleDate, setCourseScheduleDate] = React.useState("")
  const [courseScheduleDates, setCourseScheduleDates] = React.useState<string[]>([])
  const [courseRecurringWeekdays, setCourseRecurringWeekdays] = React.useState<number[]>([])
  const [courseMirrorEnabled, setCourseMirrorEnabled] = React.useState(false)
  const [courseMirrorWeekdays, setCourseMirrorWeekdays] = React.useState<number[]>([])
  const [courseRepeatAllMonth, setCourseRepeatAllMonth] = React.useState(true)
  const [courseRecurrenceMode, setCourseRecurrenceMode] = React.useState<"indefinite" | "until_date">("indefinite")
  const [courseRecurrenceEndsAt, setCourseRecurrenceEndsAt] = React.useState("")
  const [courseScheduleTime, setCourseScheduleTime] = React.useState("10:00")
  const [courseScheduleSlots, setCourseScheduleSlots] = React.useState<CourseScheduleSlot[]>([])
  const [quickScheduleTimes, setQuickScheduleTimes] = React.useState<string[]>(() => loadShortcutsFromStorage())
  const [editingQuickTimeIndex, setEditingQuickTimeIndex] = React.useState<number | null>(null)
  const [quickTimeDraft, setQuickTimeDraft] = React.useState("")
  const [scheduleTimePickerOpen, setScheduleTimePickerOpen] = React.useState(false)
  const [courseLocalImagePreview, setCourseLocalImagePreview] = React.useState("")
  const [courseLocalVideoPreview, setCourseLocalVideoPreview] = React.useState("")
  const [courseLocalImageName, setCourseLocalImageName] = React.useState("")
  const [courseLocalVideoName, setCourseLocalVideoName] = React.useState("")
  const [courseMediaUploading, setCourseMediaUploading] = React.useState<null | "image" | "video">(null)
  const [courseHydratedFromQuery, setCourseHydratedFromQuery] = React.useState(false)
  const [courseEditingSlug, setCourseEditingSlug] = React.useState<string | null>(null)
  const [courseCatalogSearch, setCourseCatalogSearch] = React.useState("")
  const [courseCatalogFilter, setCourseCatalogFilter] = React.useState<"all" | "active" | "inactive">("all")
  const [courseSlugConflict, setCourseSlugConflict] = React.useState<CourseSlugConflictState>({
    exists: false,
    suggestion: null,
    existingTitle: null,
  })

  const courseImageInputRef = React.useRef<HTMLInputElement>(null)
  const courseVideoInputRef = React.useRef<HTMLInputElement>(null)
  const scheduleTimePickerRef = React.useRef<HTMLDivElement>(null)
  const courseFormFieldsRef = React.useRef<HTMLDivElement>(null)

  const isSpecialEventCourse = SPECIAL_EVENT_COURSE_KINDS.has(courseForm.kind)

  // ─── localStorage persistence ────────────────────────────────────
  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(
        SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY,
        JSON.stringify({ quick: quickScheduleTimes })
      )
    } catch {
      // ignore storage write failures
    }
  }, [quickScheduleTimes])

  // ─── Reset / hydration helpers ───────────────────────────────────
  const resetCourseBuilder = React.useCallback(() => {
    setCourseForm(createInitialCourseForm())
    setCourseWeekdays([])
    setCourseScheduleDate("")
    setCourseScheduleDates([])
    setCourseRecurringWeekdays([])
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setCourseRepeatAllMonth(true)
    setCourseRecurrenceMode("indefinite")
    setCourseRecurrenceEndsAt("")
    setCourseScheduleTime(normalizeClockTime(quickScheduleTimes[0] || "") || "10:00")
    setCourseScheduleSlots([])
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
    setScheduleTimePickerOpen(false)
    setCourseHydratedFromQuery(false)
    setCourseEditingSlug(null)
    clearCourseLinks()
    resetCourseLinkForm()
    setCourseLocalImagePreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return ""
    })
    setCourseLocalVideoPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return ""
    })
    setCourseLocalImageName("")
    setCourseLocalVideoName("")
  }, [clearCourseLinks, quickScheduleTimes, resetCourseLinkForm])

  // ─── Save course ─────────────────────────────────────────────────
  const saveCourseCatalog = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    if (courseSlugConflict.exists) {
      setSchoolError("This slug already exists. Use the suggested slug or choose to edit the existing course.")
      return
    }
    setSchoolBusy("course")
    try {
      const derivedSchedule = deriveCourseScheduleData(courseScheduleSlots)
      const derivedRules = deriveRulesFromScheduleSlots(courseScheduleSlots)
      const derivedSpecialEvents = deriveSpecialEventsFromScheduleSlots(courseScheduleSlots)
      const fallbackTimes = courseForm.availableTimesCsv
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      const times = derivedSchedule.times.length > 0 ? derivedSchedule.times : fallbackTimes
      const weekdays = derivedSchedule.weekdays.length > 0 ? derivedSchedule.weekdays : courseWeekdays
      if (courseForm.publicationMode === "launch_date" && !ISO_DATE_REGEX.test(courseForm.launchDate.trim())) {
        setSchoolError("Select a valid launch date for Launch date mode.")
        return
      }
      if (courseForm.specialDiscountType === "custom" && !courseForm.specialDiscountCustomLabel.trim()) {
        setSchoolError("Write a custom discount label.")
        return
      }
      const scheduleRulesPayload: CourseScheduleRulesPayload | null = (() => {
        const rules =
          isSpecialEventCourse
            ? []
            : derivedRules.length > 0
            ? derivedRules
            : weekdays.length > 0 && times.length > 0
              ? weekdays.map((weekday) => ({ weekday, times }))
              : []
        const specialEvents = derivedSpecialEvents
        const publicationMode: CoursePublicationMode =
          courseForm.publicationMode === "coming_soon" || courseForm.publicationMode === "launch_date"
            ? courseForm.publicationMode
            : "publish_now"
        const launchDateRaw = courseForm.launchDate.trim()
        const launchDate =
          publicationMode === "launch_date" && ISO_DATE_REGEX.test(launchDateRaw)
            ? launchDateRaw
            : null
        const publication: CoursePublicationSettings = {
          mode: publicationMode,
          launchDate,
        }

        const specialDiscountType: CourseSpecialDiscountType =
          courseForm.specialDiscountType === "valentines_desc" ||
          courseForm.specialDiscountType === "christmas_desc" ||
          courseForm.specialDiscountType === "custom"
            ? courseForm.specialDiscountType
            : "none"
        const specialDiscountLabelRaw = courseForm.specialDiscountCustomLabel.trim()
        const specialDiscountLabel = specialDiscountType === "custom" && specialDiscountLabelRaw ? specialDiscountLabelRaw : null
        const specialDiscountPriceCents = usdInputToCents(courseForm.specialDiscountPrice)
        const specialDiscount: CourseSpecialDiscountSettings = {
          type: specialDiscountType,
          label: specialDiscountLabel,
          priceCents: specialDiscountType === "none" ? null : specialDiscountPriceCents,
        }

        const hasPublicationOverride = publication.mode !== "publish_now" || Boolean(publication.launchDate)
        const hasSpecialDiscount =
          specialDiscount.type !== "none" || specialDiscount.priceCents !== null || Boolean(specialDiscount.label)
        if (rules.length === 0 && specialEvents.length === 0 && !hasPublicationOverride && !hasSpecialDiscount) return null
        const derivedWeeklyTarget = [...new Set(rules.map((rule) => rule.weekday))].length
        return {
          mode: isSpecialEventCourse ? "special_event" : "regular",
          weeklyDaysTarget: Math.max(1, Math.min(7, derivedWeeklyTarget || courseRecurringWeekdays.length || 1)),
          repeatAllMonth: courseRepeatAllMonth,
          recurrenceMode: courseRecurrenceMode,
          recurrenceEndsAt:
            courseRecurrenceMode === "until_date" && courseRecurrenceEndsAt.trim() ? courseRecurrenceEndsAt.trim() : null,
          rules,
          specialEvents,
          publication,
          specialDiscount,
        }
      })()
      const res = await fetch("/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: courseForm.slug,
          title: courseForm.title,
          kind: courseForm.kind,
          category: courseForm.category,
          description: courseForm.description,
          coverImageUrl: courseForm.previewImageUrl,
          previewVideoUrl: courseForm.previewVideoUrl,
          dropInPriceCents: usdInputToCents(courseForm.dropInPriceCents),
          firstClassPriceCents: usdInputToCents(courseForm.firstClassPriceCents),
          level: courseForm.level,
          durationMinutes: courseForm.durationMinutes,
          location: courseForm.location,
          defaultRoomId: courseForm.defaultRoomId || null,
          availableWeekdays: weekdays,
          availableTimes: times,
          scheduleRules: scheduleRulesPayload,
          active: courseForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to save course.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Course saved.")
      await fetchSchoolData({ showLoader: false })
      resetCourseBuilder()
    } catch {
      setSchoolError("Network error while saving course.")
    } finally {
      setSchoolBusy(null)
    }
  }, [
    courseForm,
    courseRecurrenceEndsAt,
    courseRecurrenceMode,
    courseRecurringWeekdays,
    courseRepeatAllMonth,
    courseScheduleSlots,
    courseSlugConflict.exists,
    courseWeekdays,
    fetchSchoolData,
    isSpecialEventCourse,
    resetCourseBuilder,
    setSchoolBusy,
    setSchoolError,
    setSchoolSuccess,
  ])

  // ─── Hydrate from ?course= ───────────────────────────────────────
  React.useEffect(() => {
    const selectedSlug = searchParams?.get("course")
    if (!selectedSlug) {
      setCourseHydratedFromQuery(false)
      return
    }
    if (!isSchoolView || courseHydratedFromQuery || schoolCourses.length === 0) return
    const selected = schoolCourses.find((item) => item.slug === selectedSlug)
    if (!selected) return
    const parsedRules = normalizeCourseScheduleRules(selected.scheduleRules)
    const scheduleSlotsFromRules = parsedRules ? buildSlotsFromScheduleRules(parsedRules) : []
    const defaultWeekdays = parsedRules
      ? [...new Set(parsedRules.rules.map((rule) => rule.weekday))].sort((a, b) => a - b)
      : selected.availableWeekdays
    const defaultTimes = parsedRules
      ? [...new Set(parsedRules.rules.flatMap((rule) => rule.times).map((time) => normalizeClockTime(time)).filter(Boolean))].sort()
      : selected.availableTimes.map((time) => normalizeClockTime(time)).filter(Boolean)
    const publicationMode = parsedRules?.publication?.mode || "publish_now"
    const launchDate = publicationMode === "launch_date" ? parsedRules?.publication?.launchDate || "" : ""
    const specialDiscountType = parsedRules?.specialDiscount?.type || "none"
    const specialDiscountCustomLabel = specialDiscountType === "custom" ? parsedRules?.specialDiscount?.label || "" : ""
    const specialDiscountPrice =
      parsedRules?.specialDiscount?.priceCents !== null && parsedRules?.specialDiscount?.priceCents !== undefined
        ? centsToUsdInput(parsedRules.specialDiscount.priceCents)
        : ""
    setCourseForm((prev) => ({
      ...prev,
      slug: selected.slug,
      title: selected.title,
      kind: selected.kind,
      category: selected.category || "",
      description: selected.description || "",
      previewImageUrl: selected.coverImageUrl || "",
      previewVideoUrl: selected.previewVideoUrl || "",
      dropInPriceCents: centsToUsdInput(selected.dropInPriceCents),
      firstClassPriceCents: centsToUsdInput(selected.firstClassPriceCents),
      level: selected.level || "",
      durationMinutes: selected.durationMinutes?.toString() || "",
      location: selected.location || "",
      defaultRoomId: selected.defaultRoomId || "",
      publicationMode,
      launchDate,
      specialDiscountType,
      specialDiscountCustomLabel,
      specialDiscountPrice,
      availableTimesCsv: selected.availableTimes.join(","),
      active: selected.active,
    }))
    setCourseWeekdays(defaultWeekdays)
    setCourseRecurringWeekdays(defaultWeekdays)
    setCourseScheduleSlots(scheduleSlotsFromRules)
    setCourseRepeatAllMonth(parsedRules?.repeatAllMonth ?? true)
    setCourseRecurrenceMode(parsedRules?.recurrenceMode || "indefinite")
    setCourseRecurrenceEndsAt(parsedRules?.recurrenceEndsAt || "")
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setQuickScheduleTimes((prev) => normalizeQuickScheduleTimes([...defaultTimes, ...prev]))
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
    setScheduleTimePickerOpen(false)
    setCourseHydratedFromQuery(true)
    schoolWizard.goToEntity("courses")
  }, [courseHydratedFromQuery, isSchoolView, schoolCourses, schoolWizard, searchParams])

  // ─── Revoke blob URLs on unmount ─────────────────────────────────
  React.useEffect(() => {
    return () => {
      if (courseLocalImagePreview.startsWith("blob:")) URL.revokeObjectURL(courseLocalImagePreview)
      if (courseLocalVideoPreview.startsWith("blob:")) URL.revokeObjectURL(courseLocalVideoPreview)
    }
  }, [courseLocalImagePreview, courseLocalVideoPreview])

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

  // ─── External conflict maps ──────────────────────────────────────
  const externalRecurringSlotsMap = React.useMemo(() => {
    const map = new Map<string, { title: string; slug: string }[]>()
    const currentSlug = courseForm.slug.trim()
    for (const course of schoolCourses) {
      if (currentSlug && course.slug === currentSlug) continue
      const parsedRules = normalizeCourseScheduleRules(course.scheduleRules)
      const fallbackRules =
        !parsedRules && course.availableWeekdays.length > 0 && course.availableTimes.length > 0
          ? course.availableWeekdays.map((weekday) => ({
              weekday,
              times: course.availableTimes,
            }))
          : []
      const rules = parsedRules?.rules || fallbackRules
      for (const rule of rules) {
        for (const rawTime of rule.times) {
          const time = normalizeClockTime(rawTime)
          if (!time) continue
          const key = `${rule.weekday}|${time}`
          const current = map.get(key) || []
          current.push({ title: course.title, slug: course.slug })
          map.set(key, current)
        }
      }
    }
    return map
  }, [courseForm.slug, schoolCourses])

  const externalSpecialEventSlots = React.useMemo(() => {
    const items: Array<{ date: string; time: string; title: string; slug: string }> = []
    const currentSlug = courseForm.slug.trim()
    for (const course of schoolCourses) {
      if (currentSlug && course.slug === currentSlug) continue
      const parsedRules = normalizeCourseScheduleRules(course.scheduleRules)
      if (!parsedRules || parsedRules.specialEvents.length === 0) continue
      for (const event of parsedRules.specialEvents) {
        for (const rawTime of event.times) {
          const time = normalizeClockTime(rawTime)
          if (!time) continue
          if (!ISO_DATE_REGEX.test(event.date)) continue
          items.push({ date: event.date, time, title: course.title, slug: course.slug })
        }
      }
    }
    return items
  }, [courseForm.slug, schoolCourses])

  const externalSpecialEventSlotMap = React.useMemo(() => {
    const map = new Map<string, { title: string; slug: string }[]>()
    for (const item of externalSpecialEventSlots) {
      const key = `${item.date}|${item.time}`
      const current = map.get(key) || []
      current.push({ title: item.title, slug: item.slug })
      map.set(key, current)
    }
    return map
  }, [externalSpecialEventSlots])

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

  // ─── Slug conflict detection ─────────────────────────────────────
  React.useEffect(() => {
    const currentSlug = courseForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    if (!currentSlug || currentSlug.length < 3) {
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
      return
    }
    if (courseEditingSlug && courseEditingSlug.toLowerCase() === currentSlug) {
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
      return
    }
    const existingCourse = schoolCourses.find((course) => course.slug.toLowerCase() === currentSlug)
    if (!existingCourse) {
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
      return
    }
    let suffix = 2
    let suggestion = `${currentSlug}-${suffix}`
    while (schoolCourses.some((course) => course.slug.toLowerCase() === suggestion)) {
      suffix++
      suggestion = `${currentSlug}-${suffix}`
    }
    setCourseSlugConflict({ exists: true, suggestion, existingTitle: existingCourse.title })
  }, [courseForm.slug, courseEditingSlug, schoolCourses])

  const handleUseSlugSuggestion = React.useCallback(() => {
    if (courseSlugConflict.suggestion) {
      setCourseForm((prev) => ({ ...prev, slug: courseSlugConflict.suggestion! }))
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
    }
  }, [courseSlugConflict.suggestion])

  const handleEditExistingCourse = React.useCallback(() => {
    const normalizedSlug = courseForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    const existingCourse = schoolCourses.find((course) => course.slug.toLowerCase() === normalizedSlug)
    if (existingCourse) {
      setCourseForm({
        slug: existingCourse.slug,
        title: existingCourse.title,
        kind: existingCourse.kind || "course",
        category: existingCourse.category || "",
        description: existingCourse.description || "",
        previewImageUrl: existingCourse.coverImageUrl || "",
        previewVideoUrl: existingCourse.previewVideoUrl || "",
        dropInPriceCents: existingCourse.dropInPriceCents ? String(existingCourse.dropInPriceCents / 100) : "",
        firstClassPriceCents: existingCourse.firstClassPriceCents ? String(existingCourse.firstClassPriceCents / 100) : "",
        level: existingCourse.level || "Beginner",
        durationMinutes: existingCourse.durationMinutes ? String(existingCourse.durationMinutes) : "55",
        location: existingCourse.location || "54 Coles St, Jersey City, NJ",
        defaultRoomId: existingCourse.defaultRoomId || "",
        publicationMode: "publish_now",
        launchDate: "",
        specialDiscountType: "none",
        specialDiscountCustomLabel: "",
        specialDiscountPrice: "",
        availableTimesCsv: (existingCourse.availableTimes || []).join(", "),
        active: existingCourse.active ?? true,
      })
      setCourseWeekdays(existingCourse.availableWeekdays || [])
      setCourseHydratedFromQuery(true)
      setCourseEditingSlug(existingCourse.slug)
      loadCourseLinks(existingCourse.slug)
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
      setSchoolSuccess(`Loaded "${existingCourse.title}" for editing.`)
    }
  }, [courseForm.slug, loadCourseLinks, schoolCourses, setSchoolSuccess])

  // ─── Schedule slot manipulation ──────────────────────────────────
  const getSpecialEventConflictReason = React.useCallback(
    (isoDate: string, rawTime: string) => {
      const time = normalizeClockTime(rawTime)
      if (!time || !ISO_DATE_REGEX.test(isoDate)) return undefined
      const existingDateSlot = externalSpecialEventSlotMap.get(`${isoDate}|${time}`)
      if (existingDateSlot && existingDateSlot.length > 0) {
        return `Blocked: ${existingDateSlot[0].title} already uses ${formatClockLabel(time)} that day.`
      }
      const weekday = toCourseScheduleWeekday(isoDate)
      if (weekday !== null) {
        const recurring = externalRecurringSlotsMap.get(`${weekday}|${time}`)
        if (recurring && recurring.length > 0) {
          return `Blocked: ${recurring[0].title} has a regular class at ${formatClockLabel(time)}.`
        }
      }
      return undefined
    },
    [externalRecurringSlotsMap, externalSpecialEventSlotMap]
  )

  const addCourseScheduleSlot = React.useCallback(() => {
    const time = normalizeClockTime(courseScheduleTime)
    if (!time) return

    if (isSpecialEventCourse) {
      const dates = courseScheduleDates.length > 0 ? courseScheduleDates : []
      if (dates.length === 0) {
        setSchoolError("Select at least one date in the calendar to connect the event time slot.")
        return
      }
      const blockedDate = dates.find((date) => getSpecialEventConflictReason(date, time))
      if (blockedDate) {
        setSchoolError(getSpecialEventConflictReason(blockedDate, time) || "That time slot is already occupied.")
        return
      }
      setCourseScheduleSlots((prev) => {
        const next = [...prev]
        for (const date of dates) {
          const slot: CourseScheduleSlot = { date, time }
          const key = getCourseSlotKey(slot)
          if (next.some((item) => getCourseSlotKey(item) === key)) continue
          next.push(slot)
        }
        return next.sort(compareCourseSlots)
      })
      setCourseScheduleDate("")
      setCourseScheduleDates([])
      setCourseScheduleTime(normalizeClockTime(quickScheduleTimes[0] || "") || "10:00")
      setScheduleTimePickerOpen(false)
      setSchoolError(null)
      return
    }

    const recurringBase = [...new Set(courseRecurringWeekdays)].sort((a, b) => a - b)
    const mirrorWeekdays = courseMirrorEnabled
      ? courseMirrorWeekdays.filter((weekday) => !recurringBase.includes(weekday))
      : []
    const recurringWeekdays = [...new Set([...recurringBase, ...mirrorWeekdays])].sort((a, b) => a - b)
    if (recurringWeekdays.length === 0) return
    if (!quickScheduleTimes.includes(time) && typeof window !== "undefined") {
      const shouldAddShortcut = window.confirm("Do you want to add this time slot to your shortcuts?")
      if (shouldAddShortcut) {
        setQuickScheduleTimes((prev) => normalizeQuickScheduleTimes([...prev, time]))
      }
    }
    setCourseScheduleSlots((prev) => {
      const next = [...prev]
      for (const weekday of recurringWeekdays) {
        const candidate: CourseScheduleSlot = { weekday, recurring: true, time }
        const key = getCourseSlotKey(candidate)
        if (next.some((slot) => getCourseSlotKey(slot) === key)) continue
        next.push(candidate)
      }
      return next.sort(compareCourseSlots)
    })
    setCourseScheduleDate("")
    setCourseScheduleDates([])
    setCourseRecurringWeekdays([])
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setCourseScheduleTime(normalizeClockTime(quickScheduleTimes[0] || "") || "10:00")
    setScheduleTimePickerOpen(false)
  }, [
    courseMirrorEnabled,
    courseMirrorWeekdays,
    courseRecurringWeekdays,
    courseScheduleDates,
    courseScheduleTime,
    getSpecialEventConflictReason,
    isSpecialEventCourse,
    quickScheduleTimes,
    setSchoolError,
  ])

  const removeCourseScheduleSlot = React.useCallback((slotKey: string) => {
    setCourseScheduleSlots((prev) => prev.filter((slot) => getCourseSlotKey(slot) !== slotKey))
  }, [])

  const toggleCourseRecurringWeekday = React.useCallback((weekday: number) => {
    setCourseRecurringWeekdays((prev) => {
      if (prev.includes(weekday)) return prev.filter((item) => item !== weekday)
      return [...prev, weekday].sort((a, b) => a - b)
    })
  }, [])

  const toggleCourseMirrorWeekday = React.useCallback((weekday: number) => {
    setCourseMirrorWeekdays((prev) => {
      if (prev.includes(weekday)) return prev.filter((item) => item !== weekday)
      return [...prev, weekday].sort((a, b) => a - b)
    })
  }, [])

  // ─── Media upload ────────────────────────────────────────────────
  const uploadCourseMedia = React.useCallback(
    async (file: File, kind: "image" | "video"): Promise<string | null> => {
      const payload = new FormData()
      payload.set("file", file)
      payload.set("kind", kind)

      try {
        const res = await fetch("/api/staff/school/courses/upload", {
          method: "POST",
          body: payload,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (handleStaffAuthFailure(res.status)) return null
          setSchoolError(typeof data?.error === "string" ? data.error : `Unable to upload ${kind}.`)
          return null
        }
        const uploadedUrl = typeof data?.url === "string" ? data.url.trim() : ""
        if (!uploadedUrl) {
          setSchoolError(`Upload completed but ${kind} URL was empty.`)
          return null
        }
        return uploadedUrl
      } catch {
        setSchoolError(`Network error while uploading ${kind}.`)
        return null
      }
    },
    [handleStaffAuthFailure, setSchoolError]
  )

  const handleCourseLocalImage = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!COURSE_IMAGE_MIME_TYPES.has(file.type)) {
        setSchoolError("Formato inválido. Solo jpeg/png/webp.")
        event.target.value = ""
        return
      }
      if (file.size > COURSE_IMAGE_MAX_BYTES) {
        setSchoolError("Imagen demasiado grande. Máximo 2MB.")
        event.target.value = ""
        return
      }

      setSchoolError(null)
      setSchoolSuccess(null)
      const localPreviewUrl = URL.createObjectURL(file)
      setCourseLocalImagePreview((prev) => {
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
        return localPreviewUrl
      })
      setCourseMediaUploading("image")
      try {
        const uploadedUrl = await uploadCourseMedia(file, "image")
        if (!uploadedUrl) return
        setCourseForm((prev) => ({ ...prev, previewImageUrl: uploadedUrl }))
        setCourseLocalImagePreview((prev) => {
          if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
          return uploadedUrl
        })
        setCourseLocalImageName(file.name)
        setSchoolSuccess("Course image uploaded and linked. Save course to publish.")
      } finally {
        setCourseMediaUploading((prev) => (prev === "image" ? null : prev))
        event.target.value = ""
      }
    },
    [setSchoolError, setSchoolSuccess, uploadCourseMedia]
  )

  const handleCourseLocalVideo = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!COURSE_VIDEO_MIME_TYPES.has(file.type)) {
        setSchoolError("Formato inválido. Solo mp4/webm.")
        event.target.value = ""
        return
      }
      if (file.size > COURSE_VIDEO_MAX_BYTES) {
        setSchoolError("Video demasiado grande. Máximo 15MB.")
        event.target.value = ""
        return
      }

      setSchoolError(null)
      setSchoolSuccess(null)
      const localPreviewUrl = URL.createObjectURL(file)
      setCourseLocalVideoPreview((prev) => {
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
        return localPreviewUrl
      })
      setCourseMediaUploading("video")
      try {
        const uploadedUrl = await uploadCourseMedia(file, "video")
        if (!uploadedUrl) return
        setCourseForm((prev) => ({ ...prev, previewVideoUrl: uploadedUrl }))
        setCourseLocalVideoPreview((prev) => {
          if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
          return uploadedUrl
        })
        setCourseLocalVideoName(file.name)
        setSchoolSuccess("Course video uploaded and linked. Save course to publish.")
      } finally {
        setCourseMediaUploading((prev) => (prev === "video" ? null : prev))
        event.target.value = ""
      }
    },
    [setSchoolError, setSchoolSuccess, uploadCourseMedia]
  )

  // ─── Mirror weekday sync ─────────────────────────────────────────
  React.useEffect(() => {
    setCourseMirrorWeekdays((prev) => prev.filter((weekday) => !courseRecurringWeekdays.includes(weekday)))
    if (courseRecurringWeekdays.length !== 1) {
      setCourseMirrorEnabled(false)
    }
  }, [courseRecurringWeekdays])

  // ─── Clear recurrenceEndsAt when mode is indefinite ──────────────
  React.useEffect(() => {
    if (courseRecurrenceMode === "indefinite" && courseRecurrenceEndsAt) {
      setCourseRecurrenceEndsAt("")
    }
  }, [courseRecurrenceEndsAt, courseRecurrenceMode])

  // ─── Outside click for time picker ───────────────────────────────
  React.useEffect(() => {
    if (!scheduleTimePickerOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!scheduleTimePickerRef.current) return
      if (scheduleTimePickerRef.current.contains(event.target as Node)) return
      setScheduleTimePickerOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [scheduleTimePickerOpen])

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

  // ─── Quick time editing ──────────────────────────────────────────
  const startEditingQuickTime = React.useCallback(
    (index: number) => {
      const current = quickScheduleTimes[index] || ""
      setEditingQuickTimeIndex(index)
      setQuickTimeDraft(current)
    },
    [quickScheduleTimes]
  )

  const commitQuickTimeEdit = React.useCallback(() => {
    if (editingQuickTimeIndex === null) return
    const normalized = normalizeClockTime(quickTimeDraft)
    if (!normalized) {
      setEditingQuickTimeIndex(null)
      setQuickTimeDraft("")
      return
    }
    setQuickScheduleTimes((prev) => {
      if (!prev[editingQuickTimeIndex]) return prev
      const next = [...prev]
      next[editingQuickTimeIndex] = normalized
      return normalizeQuickScheduleTimes(next)
    })
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
  }, [editingQuickTimeIndex, quickTimeDraft])

  // ─── Load/delete/toggle course ───────────────────────────────────
  const loadCourseIntoForm = React.useCallback((item: SchoolCourseRow) => {
    const parsedRules = normalizeCourseScheduleRules(item.scheduleRules)
    const scheduleSlotsFromRules = parsedRules ? buildSlotsFromScheduleRules(parsedRules) : []
    const defaultWeekdays = parsedRules
      ? [...new Set(parsedRules.rules.map((rule) => rule.weekday))].sort((a, b) => a - b)
      : item.availableWeekdays
    const defaultTimes = parsedRules
      ? [...new Set(parsedRules.rules.flatMap((rule) => rule.times).map((time) => normalizeClockTime(time)).filter(Boolean))].sort()
      : item.availableTimes.map((time) => normalizeClockTime(time)).filter(Boolean)
    const publicationMode = parsedRules?.publication?.mode || "publish_now"
    const launchDate = publicationMode === "launch_date" ? parsedRules?.publication?.launchDate || "" : ""
    const specialDiscountType = parsedRules?.specialDiscount?.type || "none"
    const specialDiscountCustomLabel = specialDiscountType === "custom" ? parsedRules?.specialDiscount?.label || "" : ""
    const specialDiscountPrice =
      parsedRules?.specialDiscount?.priceCents !== null && parsedRules?.specialDiscount?.priceCents !== undefined
        ? centsToUsdInput(parsedRules.specialDiscount.priceCents)
        : ""
    setCourseForm({
      slug: item.slug,
      title: item.title,
      kind: item.kind,
      category: item.category || "",
      description: item.description || "",
      previewImageUrl: item.coverImageUrl || "",
      previewVideoUrl: item.previewVideoUrl || "",
      dropInPriceCents: centsToUsdInput(item.dropInPriceCents),
      firstClassPriceCents: centsToUsdInput(item.firstClassPriceCents),
      level: item.level || "",
      durationMinutes: item.durationMinutes?.toString() || "",
      location: item.location || "",
      defaultRoomId: item.defaultRoomId || "",
      publicationMode,
      launchDate,
      specialDiscountType,
      specialDiscountCustomLabel,
      specialDiscountPrice,
      availableTimesCsv: item.availableTimes.join(","),
      active: item.active,
    })
    setCourseWeekdays(defaultWeekdays)
    setCourseScheduleDate("")
    setCourseScheduleDates([])
    setCourseRecurringWeekdays(defaultWeekdays)
    setCourseScheduleSlots(scheduleSlotsFromRules)
    setCourseRepeatAllMonth(parsedRules?.repeatAllMonth ?? true)
    setCourseRecurrenceMode(parsedRules?.recurrenceMode || "indefinite")
    setCourseRecurrenceEndsAt(parsedRules?.recurrenceEndsAt || "")
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setQuickScheduleTimes((prev) => normalizeQuickScheduleTimes([...defaultTimes, ...prev]))
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
    setScheduleTimePickerOpen(false)
    setCourseHydratedFromQuery(true)
    setCourseEditingSlug(item.slug)
    loadCourseLinks(item.slug)
    schoolWizard.goToEntity("courses")
    schoolWizard.setStep(0)
    requestAnimationFrame(() => {
      courseFormFieldsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [loadCourseLinks, schoolWizard])

  const deleteCourse = React.useCallback(async (slug: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("course")
    try {
      const res = await fetch("/api/staff/school/courses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to delete course.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Course deleted.")
      await fetchSchoolData({ showLoader: false })
      if (courseForm.slug === slug) {
        resetCourseBuilder()
      }
    } catch {
      setSchoolError("Network error while deleting course.")
    } finally {
      setSchoolBusy(null)
    }
  }, [courseForm.slug, fetchSchoolData, resetCourseBuilder, setSchoolBusy, setSchoolError, setSchoolSuccess])

  const toggleCourseActive = React.useCallback(async (item: SchoolCourseRow) => {
    const next = !item.active
    const label = next ? "activate" : "deactivate"
    if (!window.confirm(`Are you sure you want to ${label} "${item.title}"?`)) return
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("course")
    try {
      const res = await fetch("/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: item.slug, title: item.title, kind: item.kind, active: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : `Unable to ${label} course.`)
        return
      }
      setSchoolSuccess(`Course ${next ? "activated" : "deactivated"}.`)
      await fetchSchoolData({ showLoader: false })
    } catch {
      setSchoolError(`Network error while trying to ${label} course.`)
    } finally {
      setSchoolBusy(null)
    }
  }, [fetchSchoolData, setSchoolBusy, setSchoolError, setSchoolSuccess])

  return {
    // state
    courseForm,
    setCourseForm,
    courseWeekdays,
    setCourseWeekdays,
    courseScheduleDate,
    setCourseScheduleDate,
    courseScheduleDates,
    setCourseScheduleDates,
    courseRecurringWeekdays,
    setCourseRecurringWeekdays,
    courseMirrorEnabled,
    setCourseMirrorEnabled,
    courseMirrorWeekdays,
    setCourseMirrorWeekdays,
    courseRepeatAllMonth,
    setCourseRepeatAllMonth,
    courseRecurrenceMode,
    setCourseRecurrenceMode,
    courseRecurrenceEndsAt,
    setCourseRecurrenceEndsAt,
    courseScheduleTime,
    setCourseScheduleTime,
    courseScheduleSlots,
    setCourseScheduleSlots,
    quickScheduleTimes,
    setQuickScheduleTimes,
    editingQuickTimeIndex,
    setEditingQuickTimeIndex,
    quickTimeDraft,
    setQuickTimeDraft,
    scheduleTimePickerOpen,
    setScheduleTimePickerOpen,
    courseLocalImagePreview,
    courseLocalVideoPreview,
    courseLocalImageName,
    courseLocalVideoName,
    courseMediaUploading,
    courseHydratedFromQuery,
    courseEditingSlug,
    setCourseEditingSlug,
    courseCatalogSearch,
    setCourseCatalogSearch,
    courseCatalogFilter,
    setCourseCatalogFilter,
    courseSlugConflict,

    // refs
    courseImageInputRef,
    courseVideoInputRef,
    scheduleTimePickerRef,
    courseFormFieldsRef,

    // derived
    isSpecialEventCourse,
    scheduleDerivedData,
    scheduleCalendarMap,
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
    externalRecurringSlotsMap,
    externalSpecialEventSlots,
    externalSpecialEventSlotMap,
    regularSlotsBlockedByEvents,
    regularScheduleWarningMessage,
    scheduleSlotTimeUsage,
    scheduleTimeCourseUsage,
    scheduleTimeOptions,

    // actions
    resetCourseBuilder,
    saveCourseCatalog,
    getCourseScheduleDateTooltip,
    getCourseScheduleDateTone,
    getCourseShareUrl,
    copyCourseLink,
    shareCourse,
    handleUseSlugSuggestion,
    handleEditExistingCourse,
    getSpecialEventConflictReason,
    addCourseScheduleSlot,
    removeCourseScheduleSlot,
    toggleCourseRecurringWeekday,
    toggleCourseMirrorWeekday,
    handleCourseLocalImage,
    handleCourseLocalVideo,
    loadCourseIntoForm,
    deleteCourse,
    toggleCourseActive,
    startEditingQuickTime,
    commitQuickTimeEdit,
  }
}
