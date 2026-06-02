import React from "react"

import type { StaffUserRow, TeacherAssignmentFormState } from "./staffAdminTypes"

const normalizeTeacherAssignmentCourseSlugs = (value: string[] | null | undefined) =>
  [...new Set((Array.isArray(value) ? value : []).filter(Boolean))].sort((a, b) => a.localeCompare(b))

const buildTeacherAssignmentFormState = (row: StaffUserRow): TeacherAssignmentFormState => ({
  assignedUserId: row.teacherAssignedUserId || row.id,
  recurrenceUnit: row.teacherRecurrenceUnit === "year" ? "year" : "month",
  recurrenceInterval:
    typeof row.teacherRecurrenceInterval === "number" && Number.isFinite(row.teacherRecurrenceInterval)
      ? Math.max(1, Math.min(12, Math.round(row.teacherRecurrenceInterval)))
      : 1,
  courseSlugs: normalizeTeacherAssignmentCourseSlugs(row.teacherCourseSlugs),
})

const areTeacherAssignmentStatesEqual = (a: TeacherAssignmentFormState, b: TeacherAssignmentFormState) =>
  a.assignedUserId === b.assignedUserId &&
  a.recurrenceUnit === b.recurrenceUnit &&
  a.recurrenceInterval === b.recurrenceInterval &&
  a.courseSlugs.length === b.courseSlugs.length &&
  a.courseSlugs.every((slug, index) => slug === b.courseSlugs[index])

type TeacherMetric = {
  key: string
  label: string
  value: number
  color: string
  valueLabel: string
}

type UseStaffTeacherAdminInput = {
  rows: StaffUserRow[]
  refreshRows: () => Promise<void>
}

export const useStaffTeacherAdmin = ({ rows, refreshRows }: UseStaffTeacherAdminInput) => {
  const lastHydratedTeacherIdRef = React.useRef<string | null>(null)
  const [teacherUserId, setTeacherUserId] = React.useState("")
  const [teacherReviewCycleDays, setTeacherReviewCycleDays] = React.useState(30)
  const [teacherAssignedUserId, setTeacherAssignedUserId] = React.useState("")
  const [teacherRecurrenceUnit, setTeacherRecurrenceUnit] = React.useState<"month" | "year">("month")
  const [teacherRecurrenceInterval, setTeacherRecurrenceInterval] = React.useState(1)
  const [teacherCourseSlugs, setTeacherCourseSlugs] = React.useState<string[]>([])
  const [teacherSaving, setTeacherSaving] = React.useState(false)
  const [teacherSuccess, setTeacherSuccess] = React.useState<string | null>(null)
  const [teacherError, setTeacherError] = React.useState<string | null>(null)
  const [metricsView, setMetricsView] = React.useState<"current" | "previous_cycle">("current")
  const [metricsSaving, setMetricsSaving] = React.useState(false)
  const [metricsSuccess, setMetricsSuccess] = React.useState<string | null>(null)
  const [metricsError, setMetricsError] = React.useState<string | null>(null)

  const teacherRows = React.useMemo(
    () => rows.filter((row) => row.category === "teacher" || row.role === "owner" || row.role === "admin"),
    [rows]
  )

  React.useEffect(() => {
    if (teacherRows.length === 0) {
      setTeacherUserId("")
      return
    }
    if (!teacherRows.some((row) => row.id === teacherUserId)) {
      setTeacherUserId(teacherRows[0].id)
    }
  }, [teacherRows, teacherUserId])

  React.useEffect(() => {
    if (teacherRows.length === 0) {
      setTeacherAssignedUserId("")
      return
    }
    if (!teacherAssignedUserId || !teacherRows.some((row) => row.id === teacherAssignedUserId)) {
      setTeacherAssignedUserId(teacherRows[0].id)
    }
  }, [teacherRows, teacherAssignedUserId])

  const selectedTeacher = React.useMemo(
    () => teacherRows.find((row) => row.id === teacherUserId) || null,
    [teacherRows, teacherUserId]
  )
  const assignedTeacher = React.useMemo(
    () => teacherRows.find((row) => row.id === teacherAssignedUserId) || null,
    [teacherRows, teacherAssignedUserId]
  )
  const selectedTeacherAssignmentState = React.useMemo(
    () => (selectedTeacher ? buildTeacherAssignmentFormState(selectedTeacher) : null),
    [selectedTeacher]
  )
  const teacherAssignmentDraftState = React.useMemo<TeacherAssignmentFormState | null>(() => {
    if (!selectedTeacher) return null
    return {
      assignedUserId: teacherAssignedUserId || selectedTeacher.id,
      recurrenceUnit: teacherRecurrenceUnit,
      recurrenceInterval: Math.max(1, Math.min(12, Math.round(teacherRecurrenceInterval))),
      courseSlugs: normalizeTeacherAssignmentCourseSlugs(teacherCourseSlugs),
    }
  }, [selectedTeacher, teacherAssignedUserId, teacherRecurrenceUnit, teacherRecurrenceInterval, teacherCourseSlugs])
  const teacherAssignmentDirty = React.useMemo(() => {
    if (!selectedTeacherAssignmentState || !teacherAssignmentDraftState) return false
    return !areTeacherAssignmentStatesEqual(teacherAssignmentDraftState, selectedTeacherAssignmentState)
  }, [selectedTeacherAssignmentState, teacherAssignmentDraftState])
  const teacherRecurrenceIntervalHelperText =
    teacherRecurrenceUnit === "year"
      ? "Example: Yearly + 2 means this program repeats every 2 years."
      : "Example: Monthly + 2 means this program repeats every 2 months."

  const teacherRating = React.useMemo(() => {
    if (!selectedTeacher) return 0
    if (typeof selectedTeacher.performanceRating !== "number" || !Number.isFinite(selectedTeacher.performanceRating)) return 0
    return Math.max(0, Math.min(5, Math.round(selectedTeacher.performanceRating * 10) / 10))
  }, [selectedTeacher])

  React.useEffect(() => {
    if (!selectedTeacher || !selectedTeacherAssignmentState) return
    const teacherChanged = lastHydratedTeacherIdRef.current !== selectedTeacher.id
    if (!teacherChanged && teacherAssignmentDirty) return
    setTeacherReviewCycleDays(
      typeof selectedTeacher.performanceReviewCycleDays === "number" && Number.isFinite(selectedTeacher.performanceReviewCycleDays)
        ? Math.max(7, Math.min(90, Math.round(selectedTeacher.performanceReviewCycleDays)))
        : 30
    )
    setTeacherAssignedUserId(selectedTeacherAssignmentState.assignedUserId)
    setTeacherRecurrenceUnit(selectedTeacherAssignmentState.recurrenceUnit)
    setTeacherRecurrenceInterval(selectedTeacherAssignmentState.recurrenceInterval)
    setTeacherCourseSlugs(selectedTeacherAssignmentState.courseSlugs)
    lastHydratedTeacherIdRef.current = selectedTeacher.id
    if (teacherChanged) {
      setTeacherSuccess(null)
      setTeacherError(null)
      setMetricsSuccess(null)
      setMetricsError(null)
    }
  }, [selectedTeacher, selectedTeacherAssignmentState, teacherAssignmentDirty])

  const teacherPunctualityScore = React.useMemo(() => {
    if (!selectedTeacher) return 100
    const entries = Array.isArray(selectedTeacher.payrollDelayEntries) ? selectedTeacher.payrollDelayEntries : []
    if (entries.length === 0) return 100
    const totalDelay = entries.reduce((sum, item) => sum + item.delayMinutes, 0)
    const avgDelay = totalDelay / Math.max(entries.length, 1)
    return Math.max(50, Math.round(100 - avgDelay * 1.6))
  }, [selectedTeacher])

  const teacherHoursWorked = React.useMemo(() => {
    if (!selectedTeacher || typeof selectedTeacher.payrollHoursWorked !== "number") return 0
    return Math.max(0, selectedTeacher.payrollHoursWorked)
  }, [selectedTeacher])
  const teacherBonusTargetHours = React.useMemo(() => {
    if (!selectedTeacher || typeof selectedTeacher.teacherBonusTargetHours !== "number") return 30
    return Math.max(1, Math.round(selectedTeacher.teacherBonusTargetHours))
  }, [selectedTeacher])
  const teacherWeekdaysCount = React.useMemo(() => {
    if (!selectedTeacher || !Array.isArray(selectedTeacher.teacherWeekdays)) return 0
    return selectedTeacher.teacherWeekdays.length
  }, [selectedTeacher])
  const teacherBonusProgress = React.useMemo(() => {
    const goal = Math.max(1, teacherBonusTargetHours)
    return Math.min(100, Math.round((teacherHoursWorked / goal) * 100))
  }, [teacherBonusTargetHours, teacherHoursWorked])
  const teacherRatingPercent = React.useMemo(() => {
    if (teacherRating <= 0) return 0
    return Math.round((teacherRating / 5) * 100)
  }, [teacherRating])

  const teacherMetrics = React.useMemo<TeacherMetric[]>(
    () => [
      { key: "rating", label: "Star rating", value: teacherRatingPercent, color: "#ff6b6b", valueLabel: teacherRating > 0 ? `${teacherRating.toFixed(1)} / 5` : "No data" },
      { key: "hours", label: "Hours vs bonus target", value: teacherBonusProgress, color: "#b61616", valueLabel: `${teacherHoursWorked.toFixed(1)}h / ${Math.max(1, teacherBonusTargetHours)}h` },
      { key: "punctuality", label: "Punctuality", value: teacherPunctualityScore, color: "#f59e0b", valueLabel: `${teacherPunctualityScore}%` },
    ],
    [teacherBonusProgress, teacherBonusTargetHours, teacherHoursWorked, teacherPunctualityScore, teacherRating, teacherRatingPercent]
  )

  const visibleTeacherMetrics = React.useMemo(() => {
    if (metricsView === "current") return teacherMetrics
    return teacherMetrics.map((metric) => {
      const value =
        metric.key === "hours"
          ? Math.max(0, Math.round(metric.value * 0.88))
          : metric.key === "punctuality"
            ? Math.max(0, Math.round(metric.value * 0.93))
            : Math.max(0, Math.round(metric.value * 0.9))
      return { ...metric, value }
    })
  }, [metricsView, teacherMetrics])

  const teacherDonutStyle = React.useMemo(() => {
    const total = visibleTeacherMetrics.reduce((sum, metric) => sum + metric.value, 0)
    if (total <= 0) return { background: "conic-gradient(rgba(255,255,255,0.18) 0 100%)" } as React.CSSProperties
    const ratingShare = Math.round((visibleTeacherMetrics[0].value / total) * 100)
    const hoursShare = Math.round((visibleTeacherMetrics[1].value / total) * 100)
    const firstStop = ratingShare
    const secondStop = Math.min(100, firstStop + hoursShare)
    return {
      background: `conic-gradient(${visibleTeacherMetrics[0].color} 0 ${firstStop}%, ${visibleTeacherMetrics[1].color} ${firstStop}% ${secondStop}%, ${visibleTeacherMetrics[2].color} ${secondStop}% 100%)`,
    } as React.CSSProperties
  }, [visibleTeacherMetrics])

  const teacherMetricsAverage = React.useMemo(() => {
    if (visibleTeacherMetrics.length === 0) return 0
    return Math.round(visibleTeacherMetrics.reduce((sum, metric) => sum + metric.value, 0) / visibleTeacherMetrics.length)
  }, [visibleTeacherMetrics])

  const teacherAiTips = React.useMemo(() => {
    if (!selectedTeacher) return []
    const tips: string[] = []
    if (teacherPunctualityScore < 85) tips.push("Low punctuality: reinforce check-in 10 minutes before start time.")
    if (teacherRating < 4) tips.push("Rating below 4.0: suggest an observed class + AI-guided feedback.")
    if (teacherBonusProgress < 70) tips.push("Hours below bonus target: offer shift coverage on available days.")
    if (teacherWeekdaysCount <= 2) tips.push("Short availability: open at least 1 extra day to improve schedule continuity.")
    if (tips.length === 0) tips.push("Stable performance: maintain evaluation cycle and gradually raise bonus target.")
    return tips.slice(0, 3)
  }, [selectedTeacher, teacherPunctualityScore, teacherRating, teacherBonusProgress, teacherWeekdaysCount])

  const toggleTeacherCourse = React.useCallback((courseSlug: string) => {
    setTeacherCourseSlugs((prev) => (prev.includes(courseSlug) ? prev.filter((slug) => slug !== courseSlug) : [...prev, courseSlug]))
  }, [])

  const saveTeacherPerformance = React.useCallback(async () => {
    if (!selectedTeacher) return
    if (teacherCourseSlugs.length === 0) {
      setTeacherError("Select at least one course for this program template.")
      setTeacherSuccess(null)
      return
    }
    if (!teacherAssignedUserId) {
      setTeacherError("Select the assigned teacher for this program.")
      setTeacherSuccess(null)
      return
    }
    setTeacherSaving(true)
    setTeacherError(null)
    setTeacherSuccess(null)
    try {
      const res = await fetch(`/api/staff/users/${selectedTeacher.id}/performance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTeacherUserId: teacherAssignedUserId,
          recurrenceUnit: teacherRecurrenceUnit,
          recurrenceInterval: teacherRecurrenceInterval,
          courseSlugs: teacherCourseSlugs,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTeacherError(typeof data?.error === "string" ? data.error : "Unable to save performance settings.")
        return
      }
      setTeacherSuccess("Teaching assignment saved.")
      await refreshRows()
    } catch {
      setTeacherError("Network error while saving settings.")
    } finally {
      setTeacherSaving(false)
    }
  }, [refreshRows, selectedTeacher, teacherAssignedUserId, teacherCourseSlugs, teacherRecurrenceInterval, teacherRecurrenceUnit])

  const saveTeacherReviewCycle = React.useCallback(async () => {
    if (!selectedTeacher) return
    setMetricsSaving(true)
    setMetricsError(null)
    setMetricsSuccess(null)
    try {
      const res = await fetch(`/api/staff/users/${selectedTeacher.id}/performance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewCycleDays: teacherReviewCycleDays }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMetricsError(typeof data?.error === "string" ? data.error : "Unable to save review cycle.")
        return
      }
      setMetricsSuccess("Review cycle saved.")
      await refreshRows()
    } catch {
      setMetricsError("Network error while saving review cycle.")
    } finally {
      setMetricsSaving(false)
    }
  }, [refreshRows, selectedTeacher, teacherReviewCycleDays])

  return {
    teacherRows,
    teacherUserId,
    setTeacherUserId,
    teacherReviewCycleDays,
    setTeacherReviewCycleDays,
    teacherAssignedUserId,
    setTeacherAssignedUserId,
    teacherRecurrenceUnit,
    setTeacherRecurrenceUnit,
    teacherRecurrenceInterval,
    setTeacherRecurrenceInterval,
    teacherCourseSlugs,
    teacherSaving,
    teacherSuccess,
    teacherError,
    metricsView,
    setMetricsView,
    metricsSaving,
    metricsSuccess,
    metricsError,
    selectedTeacher,
    assignedTeacher,
    teacherAssignmentDirty,
    teacherRecurrenceIntervalHelperText,
    teacherRating,
    visibleTeacherMetrics,
    teacherDonutStyle,
    teacherMetricsAverage,
    teacherAiTips,
    toggleTeacherCourse,
    saveTeacherPerformance,
    saveTeacherReviewCycle,
  }
}
