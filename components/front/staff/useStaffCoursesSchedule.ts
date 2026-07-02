import React from "react"

import {
  DEFAULT_QUICK_SCHEDULE_TIMES,
  ISO_DATE_REGEX,
  SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY,
} from "./staffAdminConstants"
import {
  formatClockLabel,
  normalizeClockTime,
} from "./staffAdminFormatters"
import {
  compareCourseSlots,
  getCourseSlotKey,
  normalizeQuickScheduleTimes,
  toCourseScheduleWeekday,
} from "./staffCourseScheduleHelpers"
import type { CourseScheduleSlot } from "./staffAdminTypes"

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

export type StaffCoursesScheduleInput = {
  isSpecialEventCourse: boolean
  externalSpecialEventSlotMap: Map<string, { title: string; slug: string }[]>
  externalRecurringSlotsMap: Map<string, { title: string; slug: string }[]>
  externalSpecialEventSlots: Array<{ date: string; time: string; title: string; slug: string }>
  setSchoolError: (value: string | null) => void
}

export const useStaffCoursesSchedule = (input: StaffCoursesScheduleInput) => {
  const {
    isSpecialEventCourse,
    externalSpecialEventSlotMap,
    externalRecurringSlotsMap,
    externalSpecialEventSlots,
    setSchoolError,
  } = input

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

  const scheduleTimePickerRef = React.useRef<HTMLDivElement>(null)

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

  const resetScheduleState = React.useCallback((initialTimes?: string[]) => {
    setCourseWeekdays([])
    setCourseScheduleDate("")
    setCourseScheduleDates([])
    setCourseRecurringWeekdays([])
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setCourseRepeatAllMonth(true)
    setCourseRecurrenceMode("indefinite")
    setCourseRecurrenceEndsAt("")
    setCourseScheduleTime(normalizeClockTime((initialTimes ?? [])[0] || "") || "10:00")
    setCourseScheduleSlots([])
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
    setScheduleTimePickerOpen(false)
  }, [])

  // ─── Schedule slot conflict check ─────────────────────────────────
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

  // ─── Schedule slot manipulation ──────────────────────────────────
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

  return {
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
    scheduleTimePickerRef,
    resetScheduleState,
    getSpecialEventConflictReason,
    addCourseScheduleSlot,
    removeCourseScheduleSlot,
    toggleCourseRecurringWeekday,
    toggleCourseMirrorWeekday,
    startEditingQuickTime,
    commitQuickTimeEdit,
  }
}
