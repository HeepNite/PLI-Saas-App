import React from "react"

import {
  ISO_DATE_REGEX,
  SPECIAL_EVENT_COURSE_KINDS,
  type CoursePublicationMode,
  type CourseSpecialDiscountType,
} from "./staffAdminConstants"
import {
  centsToUsdInput,
  normalizeClockTime,
} from "./staffAdminFormatters"
import {
  buildSlotsFromScheduleRules,
  deriveCourseScheduleData,
  deriveRulesFromScheduleSlots,
  deriveSpecialEventsFromScheduleSlots,
  normalizeCourseScheduleRules,
  normalizeQuickScheduleTimes,
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
import type { CourseSlugConflictState } from "./useStaffCoursesAdmin"

const usdInputToCents = (value: string) => {
  const clean = value.trim().replace(",", ".")
  if (!clean) return null
  const parsed = Number(clean)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

export type StaffCoursesCRUDInput = {
  schoolCourses: SchoolCourseRow[]
  courseForm: CourseFormState
  setCourseForm: React.Dispatch<React.SetStateAction<CourseFormState>>
  courseScheduleSlots: CourseScheduleSlot[]
  setCourseScheduleSlots: React.Dispatch<React.SetStateAction<CourseScheduleSlot[]>>
  courseWeekdays: number[]
  setCourseWeekdays: React.Dispatch<React.SetStateAction<number[]>>
  courseRecurringWeekdays: number[]
  setCourseRecurringWeekdays: React.Dispatch<React.SetStateAction<number[]>>
  courseRepeatAllMonth: boolean
  setCourseRepeatAllMonth: React.Dispatch<React.SetStateAction<boolean>>
  courseRecurrenceMode: "indefinite" | "until_date"
  setCourseRecurrenceMode: React.Dispatch<React.SetStateAction<"indefinite" | "until_date">>
  courseRecurrenceEndsAt: string
  setCourseRecurrenceEndsAt: React.Dispatch<React.SetStateAction<string>>
  courseHydratedFromQuery: boolean
  setCourseHydratedFromQuery: React.Dispatch<React.SetStateAction<boolean>>
  courseEditingSlug: string | null
  setCourseEditingSlug: React.Dispatch<React.SetStateAction<string | null>>
  courseSlugConflict: CourseSlugConflictState
  setCourseSlugConflict: React.Dispatch<React.SetStateAction<CourseSlugConflictState>>
  quickScheduleTimes: string[]
  setQuickScheduleTimes: React.Dispatch<React.SetStateAction<string[]>>
  resetScheduleState: (initialTimes?: string[]) => void
  resetUploadState: () => void
  courseFormFieldsRef: React.RefObject<HTMLDivElement | null>
  schoolWizard: ReturnType<typeof useSchoolWizard>
  fetchSchoolData: (options?: { showLoader?: boolean }) => Promise<void>
  loadCourseLinks: (courseSlug: string) => Promise<void>
  clearCourseLinks: () => void
  resetCourseLinkForm: () => void
  saveDraftCourseLinkForCourse: (courseSlug: string) => Promise<{ ok: boolean; skipped: boolean; error?: string }>
  setSchoolError: (value: string | null) => void
  setSchoolSuccess: (value: string | null) => void
  setSchoolBusy: (value: "course" | "package" | "rule" | "assign" | null) => void
  // Extra schedule setters needed by loadCourseIntoForm
  setCourseMirrorEnabled: React.Dispatch<React.SetStateAction<boolean>>
  setCourseMirrorWeekdays: React.Dispatch<React.SetStateAction<number[]>>
  setCourseScheduleDate: React.Dispatch<React.SetStateAction<string>>
  setCourseScheduleDates: React.Dispatch<React.SetStateAction<string[]>>
  setEditingQuickTimeIndex: React.Dispatch<React.SetStateAction<number | null>>
  setQuickTimeDraft: React.Dispatch<React.SetStateAction<string>>
  setScheduleTimePickerOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export const useStaffCoursesCRUD = (input: StaffCoursesCRUDInput) => {
  const {
    schoolCourses,
    courseForm,
    setCourseForm,
    courseScheduleSlots,
    setCourseScheduleSlots,
    courseWeekdays,
    setCourseWeekdays,
    courseRecurringWeekdays,
    setCourseRecurringWeekdays,
    courseRepeatAllMonth,
    setCourseRepeatAllMonth,
    courseRecurrenceMode,
    setCourseRecurrenceMode,
    courseRecurrenceEndsAt,
    setCourseRecurrenceEndsAt,
    setCourseHydratedFromQuery,
    setCourseEditingSlug,
    courseSlugConflict,
    setCourseSlugConflict,
    quickScheduleTimes,
    setQuickScheduleTimes,
    resetScheduleState,
    resetUploadState,
    courseFormFieldsRef,
    schoolWizard,
    fetchSchoolData,
    loadCourseLinks,
    clearCourseLinks,
    resetCourseLinkForm,
    saveDraftCourseLinkForCourse,
    setSchoolError,
    setSchoolSuccess,
    setSchoolBusy,
    setCourseMirrorEnabled,
    setCourseMirrorWeekdays,
    setCourseScheduleDate,
    setCourseScheduleDates,
    setEditingQuickTimeIndex,
    setQuickTimeDraft,
    setScheduleTimePickerOpen,
  } = input

  const isSpecialEventCourse = SPECIAL_EVENT_COURSE_KINDS.has(courseForm.kind)

  // ─── Reset / hydration helpers ───────────────────────────────────
  const resetCourseBuilder = React.useCallback(() => {
    setCourseForm((() => ({
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
    }))())
    resetScheduleState(quickScheduleTimes)
    resetUploadState()
    setCourseHydratedFromQuery(false)
    setCourseEditingSlug(null)
    clearCourseLinks()
    resetCourseLinkForm()
  }, [
    clearCourseLinks,
    quickScheduleTimes,
    resetCourseLinkForm,
    resetScheduleState,
    resetUploadState,
    setCourseEditingSlug,
    setCourseForm,
    setCourseHydratedFromQuery,
  ])

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
      const savedSlug = typeof data?.item?.slug === "string" ? data.item.slug : courseForm.slug.trim()
      const draftLinkResult = savedSlug ? await saveDraftCourseLinkForCourse(savedSlug) : { ok: true, skipped: true }
      const savedMessage = typeof data?.message === "string" ? data.message : "Course saved."
      await fetchSchoolData({ showLoader: false })
      if (!draftLinkResult.ok) {
        setSchoolSuccess(savedMessage)
        setSchoolError(draftLinkResult.error || "Course saved, but the consecutive link could not be saved.")
        setCourseEditingSlug(savedSlug || null)
        if (savedSlug) await loadCourseLinks(savedSlug)
        return
      }
      setSchoolSuccess(draftLinkResult.skipped ? savedMessage : `${savedMessage} Consecutive link saved.`)
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
    loadCourseLinks,
    resetCourseBuilder,
    saveDraftCourseLinkForCourse,
    setCourseEditingSlug,
    setSchoolBusy,
    setSchoolError,
    setSchoolSuccess,
  ])

  // ─── Slug conflict handlers ──────────────────────────────────────
  const handleUseSlugSuggestion = React.useCallback(() => {
    if (courseSlugConflict.suggestion) {
      setCourseForm((prev) => ({ ...prev, slug: courseSlugConflict.suggestion! }))
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
    }
  }, [courseSlugConflict.suggestion, setCourseForm, setCourseSlugConflict])

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
  }, [
    courseForm.slug,
    loadCourseLinks,
    schoolCourses,
    setCourseEditingSlug,
    setCourseForm,
    setCourseHydratedFromQuery,
    setCourseSlugConflict,
    setCourseWeekdays,
    setSchoolSuccess,
  ])

  // ─── Load course into form ───────────────────────────────────────
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
    setCourseRecurringWeekdays(defaultWeekdays)
    setQuickScheduleTimes((prev) => normalizeQuickScheduleTimes([...defaultTimes, ...prev]))
    setCourseRepeatAllMonth(parsedRules?.repeatAllMonth ?? true)
    setCourseRecurrenceMode(parsedRules?.recurrenceMode || "indefinite")
    setCourseRecurrenceEndsAt(parsedRules?.recurrenceEndsAt || "")
    setCourseScheduleSlots(scheduleSlotsFromRules)
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setCourseScheduleDate("")
    setCourseScheduleDates([])
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
  }, [
    courseFormFieldsRef,
    loadCourseLinks,
    schoolWizard,
    setCourseEditingSlug,
    setCourseForm,
    setCourseHydratedFromQuery,
    setCourseRecurrenceEndsAt,
    setCourseRecurrenceMode,
    setCourseRecurringWeekdays,
    setCourseRepeatAllMonth,
    setCourseScheduleDate,
    setCourseScheduleDates,
    setCourseScheduleSlots,
    setCourseWeekdays,
    setCourseMirrorEnabled,
    setCourseMirrorWeekdays,
    setEditingQuickTimeIndex,
    setQuickTimeDraft,
    setQuickScheduleTimes,
    setScheduleTimePickerOpen,
  ])

  // ─── Delete course ───────────────────────────────────────────────
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

  // ─── Toggle course active ────────────────────────────────────────
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
    resetCourseBuilder,
    saveCourseCatalog,
    handleUseSlugSuggestion,
    handleEditExistingCourse,
    loadCourseIntoForm,
    deleteCourse,
    toggleCourseActive,
  }
}
