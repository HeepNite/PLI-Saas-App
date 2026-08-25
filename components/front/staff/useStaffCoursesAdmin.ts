import React from "react"
import type { ReadonlyURLSearchParams } from "next/navigation"

import {
  ISO_DATE_REGEX,
  SPECIAL_EVENT_COURSE_KINDS,
} from "./staffAdminConstants"
import {
  centsToUsdInput,
  normalizeClockTime,
} from "./staffAdminFormatters"
import {
  buildSlotsFromScheduleRules,
  normalizeCourseScheduleRules,
  normalizeQuickScheduleTimes,
} from "./staffCourseScheduleHelpers"
import type {
  CourseFormState,
  SchoolCourseRow,
} from "./staffAdminTypes"
import type { useSchoolWizard } from "./school"

import { useStaffCoursesFilters } from "./useStaffCoursesFilters"
import { useStaffCoursesUpload } from "./useStaffCoursesUpload"
import { useStaffCoursesDerived } from "./useStaffCoursesDerived"
import { useStaffCoursesSchedule } from "./useStaffCoursesSchedule"
import { useStaffCoursesCRUD } from "./useStaffCoursesCRUD"

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
  saveDraftCourseLinkForCourse: (courseSlug: string) => Promise<{ ok: boolean; skipped: boolean; error?: string }>
  handleStaffAuthFailure: (status: number) => boolean
  setSchoolError: (value: string | null) => void
  setSchoolSuccess: (value: string | null) => void
  setSchoolBusy: (value: "course" | "package" | "rule" | "assign" | null) => void
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
    saveDraftCourseLinkForCourse,
    handleStaffAuthFailure,
    setSchoolError,
    setSchoolSuccess,
    setSchoolBusy,
  } = input

  // ─── Core form state (kept in main hook — needed across all sub-hooks) ───
  const [courseForm, setCourseForm] = React.useState<CourseFormState>(() => createInitialCourseForm())
  const [courseHydratedFromQuery, setCourseHydratedFromQuery] = React.useState(false)
  const [courseEditingSlug, setCourseEditingSlug] = React.useState<string | null>(null)

  const courseFormFieldsRef = React.useRef<HTMLDivElement>(null)

  const isSpecialEventCourse = SPECIAL_EVENT_COURSE_KINDS.has(courseForm.kind)

  // ─── External conflict maps (inline — no schedule slots needed) ──
  // These only depend on courseForm.slug + schoolCourses, so they can be
  // computed before the schedule hook to break the dependency cycle.
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

  // ─── Filters sub-hook ────────────────────────────────────────────
  const filters = useStaffCoursesFilters({
    schoolCourses,
    courseEditingSlug,
    courseFormSlug: courseForm.slug,
  })

  // ─── Upload sub-hook ─────────────────────────────────────────────
  const upload = useStaffCoursesUpload({
    handleStaffAuthFailure,
    setSchoolError,
    setSchoolSuccess,
    setCourseFormField: (field, value) => setCourseForm((prev) => ({ ...prev, [field]: value })),
  })

  // ─── Schedule sub-hook ───────────────────────────────────────────
  const schedule = useStaffCoursesSchedule({
    isSpecialEventCourse,
    externalSpecialEventSlotMap,
    externalRecurringSlotsMap,
    externalSpecialEventSlots,
    setSchoolError,
  })

  // ─── Derived sub-hook ────────────────────────────────────────────
  const derivedFull = useStaffCoursesDerived({
    courseForm,
    courseScheduleSlots: schedule.courseScheduleSlots,
    schoolCourses,
    isSpecialEventCourse,
    courseLocalImagePreview: upload.courseLocalImagePreview,
    courseLocalVideoPreview: upload.courseLocalVideoPreview,
    externalRecurringSlotsMap,
    externalSpecialEventSlots,
    externalSpecialEventSlotMap,
    setSchoolError,
    setSchoolSuccess,
  })

  // ─── CRUD sub-hook ───────────────────────────────────────────────
  const crud = useStaffCoursesCRUD({
    schoolCourses,
    courseForm,
    setCourseForm,
    courseScheduleSlots: schedule.courseScheduleSlots,
    setCourseScheduleSlots: schedule.setCourseScheduleSlots,
    courseWeekdays: schedule.courseWeekdays,
    setCourseWeekdays: schedule.setCourseWeekdays,
    courseRecurringWeekdays: schedule.courseRecurringWeekdays,
    setCourseRecurringWeekdays: schedule.setCourseRecurringWeekdays,
    courseRepeatAllMonth: schedule.courseRepeatAllMonth,
    setCourseRepeatAllMonth: schedule.setCourseRepeatAllMonth,
    courseRecurrenceMode: schedule.courseRecurrenceMode,
    setCourseRecurrenceMode: schedule.setCourseRecurrenceMode,
    courseRecurrenceEndsAt: schedule.courseRecurrenceEndsAt,
    setCourseRecurrenceEndsAt: schedule.setCourseRecurrenceEndsAt,
    courseHydratedFromQuery,
    setCourseHydratedFromQuery,
    courseEditingSlug,
    setCourseEditingSlug,
    courseSlugConflict: filters.courseSlugConflict,
    setCourseSlugConflict: filters.setCourseSlugConflict,
    quickScheduleTimes: schedule.quickScheduleTimes,
    setQuickScheduleTimes: schedule.setQuickScheduleTimes,
    resetScheduleState: schedule.resetScheduleState,
    resetUploadState: upload.resetUploadState,
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
    setCourseMirrorEnabled: schedule.setCourseMirrorEnabled,
    setCourseMirrorWeekdays: schedule.setCourseMirrorWeekdays,
    setCourseScheduleDate: schedule.setCourseScheduleDate,
    setCourseScheduleDates: schedule.setCourseScheduleDates,
    setEditingQuickTimeIndex: schedule.setEditingQuickTimeIndex,
    setQuickTimeDraft: schedule.setQuickTimeDraft,
    setScheduleTimePickerOpen: schedule.setScheduleTimePickerOpen,
  })

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
    schedule.setCourseWeekdays(defaultWeekdays)
    schedule.setCourseRecurringWeekdays(defaultWeekdays)
    schedule.setCourseScheduleSlots(scheduleSlotsFromRules)
    schedule.setCourseRepeatAllMonth(parsedRules?.repeatAllMonth ?? true)
    schedule.setCourseRecurrenceMode(parsedRules?.recurrenceMode || "indefinite")
    schedule.setCourseRecurrenceEndsAt(parsedRules?.recurrenceEndsAt || "")
    schedule.setCourseMirrorEnabled(false)
    schedule.setCourseMirrorWeekdays([])
    schedule.setQuickScheduleTimes((prev) => normalizeQuickScheduleTimes([...defaultTimes, ...prev]))
    schedule.setEditingQuickTimeIndex(null)
    schedule.setQuickTimeDraft("")
    schedule.setScheduleTimePickerOpen(false)
    setCourseHydratedFromQuery(true)
    schoolWizard.goToEntity("courses")
  }, [courseHydratedFromQuery, isSchoolView, schedule, schoolCourses, schoolWizard, searchParams])

  return {
    // state
    courseForm,
    setCourseForm,
    courseWeekdays: schedule.courseWeekdays,
    setCourseWeekdays: schedule.setCourseWeekdays,
    courseScheduleDate: schedule.courseScheduleDate,
    setCourseScheduleDate: schedule.setCourseScheduleDate,
    courseScheduleDates: schedule.courseScheduleDates,
    setCourseScheduleDates: schedule.setCourseScheduleDates,
    courseRecurringWeekdays: schedule.courseRecurringWeekdays,
    setCourseRecurringWeekdays: schedule.setCourseRecurringWeekdays,
    courseMirrorEnabled: schedule.courseMirrorEnabled,
    setCourseMirrorEnabled: schedule.setCourseMirrorEnabled,
    courseMirrorWeekdays: schedule.courseMirrorWeekdays,
    setCourseMirrorWeekdays: schedule.setCourseMirrorWeekdays,
    courseRepeatAllMonth: schedule.courseRepeatAllMonth,
    setCourseRepeatAllMonth: schedule.setCourseRepeatAllMonth,
    courseRecurrenceMode: schedule.courseRecurrenceMode,
    setCourseRecurrenceMode: schedule.setCourseRecurrenceMode,
    courseRecurrenceEndsAt: schedule.courseRecurrenceEndsAt,
    setCourseRecurrenceEndsAt: schedule.setCourseRecurrenceEndsAt,
    courseScheduleTime: schedule.courseScheduleTime,
    setCourseScheduleTime: schedule.setCourseScheduleTime,
    courseScheduleSlots: schedule.courseScheduleSlots,
    setCourseScheduleSlots: schedule.setCourseScheduleSlots,
    quickScheduleTimes: schedule.quickScheduleTimes,
    setQuickScheduleTimes: schedule.setQuickScheduleTimes,
    editingQuickTimeIndex: schedule.editingQuickTimeIndex,
    setEditingQuickTimeIndex: schedule.setEditingQuickTimeIndex,
    quickTimeDraft: schedule.quickTimeDraft,
    setQuickTimeDraft: schedule.setQuickTimeDraft,
    scheduleTimePickerOpen: schedule.scheduleTimePickerOpen,
    setScheduleTimePickerOpen: schedule.setScheduleTimePickerOpen,
    courseLocalImagePreview: upload.courseLocalImagePreview,
    courseLocalVideoPreview: upload.courseLocalVideoPreview,
    courseLocalImageName: upload.courseLocalImageName,
    courseLocalVideoName: upload.courseLocalVideoName,
    courseMediaUploading: upload.courseMediaUploading,
    courseHydratedFromQuery,
    courseEditingSlug,
    setCourseEditingSlug,
    courseCatalogSearch: filters.courseCatalogSearch,
    setCourseCatalogSearch: filters.setCourseCatalogSearch,
    courseCatalogFilter: filters.courseCatalogFilter,
    setCourseCatalogFilter: filters.setCourseCatalogFilter,
    courseSlugConflict: filters.courseSlugConflict,

    // refs
    courseImageInputRef: upload.courseImageInputRef,
    courseVideoInputRef: upload.courseVideoInputRef,
    scheduleTimePickerRef: schedule.scheduleTimePickerRef,
    courseFormFieldsRef,

    // derived
    isSpecialEventCourse,
    scheduleDerivedData: derivedFull.scheduleDerivedData,
    scheduleCalendarMap: derivedFull.scheduleCalendarMap,
    previewMediaUrl: derivedFull.previewMediaUrl,
    previewVideoUrl: derivedFull.previewVideoUrl,
    embedPreviewVideoUrl: derivedFull.embedPreviewVideoUrl,
    isEmbedPreviewVideo: derivedFull.isEmbedPreviewVideo,
    previewVideoSource: derivedFull.previewVideoSource,
    selectedCourseKindLabel: derivedFull.selectedCourseKindLabel,
    selectedCourseKindReviewLabel: derivedFull.selectedCourseKindReviewLabel,
    courseReviewVariants: derivedFull.courseReviewVariants,
    previewEditorHref: derivedFull.previewEditorHref,
    previewPublicHref: derivedFull.previewPublicHref,
    externalRecurringSlotsMap,
    externalSpecialEventSlots,
    externalSpecialEventSlotMap,
    regularSlotsBlockedByEvents: derivedFull.regularSlotsBlockedByEvents,
    regularScheduleWarningMessage: derivedFull.regularScheduleWarningMessage,
    scheduleSlotTimeUsage: derivedFull.scheduleSlotTimeUsage,
    scheduleTimeCourseUsage: derivedFull.scheduleTimeCourseUsage,
    scheduleTimeOptions: derivedFull.scheduleTimeOptions,

    // actions
    resetCourseBuilder: crud.resetCourseBuilder,
    saveCourseCatalog: crud.saveCourseCatalog,
    getCourseScheduleDateTooltip: derivedFull.getCourseScheduleDateTooltip,
    getCourseScheduleDateTone: derivedFull.getCourseScheduleDateTone,
    getCourseShareUrl: derivedFull.getCourseShareUrl,
    copyCourseLink: derivedFull.copyCourseLink,
    shareCourse: derivedFull.shareCourse,
    handleUseSlugSuggestion: crud.handleUseSlugSuggestion,
    handleEditExistingCourse: crud.handleEditExistingCourse,
    getSpecialEventConflictReason: schedule.getSpecialEventConflictReason,
    addCourseScheduleSlot: schedule.addCourseScheduleSlot,
    removeCourseScheduleSlot: schedule.removeCourseScheduleSlot,
    toggleCourseRecurringWeekday: schedule.toggleCourseRecurringWeekday,
    toggleCourseMirrorWeekday: schedule.toggleCourseMirrorWeekday,
    handleCourseLocalImage: upload.handleCourseLocalImage,
    handleCourseLocalVideo: upload.handleCourseLocalVideo,
    loadCourseIntoForm: crud.loadCourseIntoForm,
    deleteCourse: crud.deleteCourse,
    toggleCourseActive: crud.toggleCourseActive,
    startEditingQuickTime: schedule.startEditingQuickTime,
    commitQuickTimeEdit: schedule.commitQuickTimeEdit,
  }
}
