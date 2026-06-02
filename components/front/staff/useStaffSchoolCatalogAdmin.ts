import React from "react"

import { demoCourses } from "@/constants/courses"
import { POINTS_RULE_DEFINITIONS } from "@/lib/points/constants"

import { resolveRoomCatalogErrorMessage } from "./staffRoomCatalogHelpers"
import { createEmptyPackageForm, getPackageLifecycleStatus } from "./staffPaymentFilters"
import type {
  CourseLinkRow,
  PackageFormState,
  PackagePlanStatus,
  PackageStatusFilter,
  PointsAssignFormState,
  PointsRuleFormState,
  PointsRuleRow,
  RoomReservationRow,
  RoomRow,
  SchoolCourseRow,
  SchoolPackageRow,
} from "./staffAdminTypes"

type SchoolBusyState = null | "course" | "package" | "rule" | "assign"

type CourseLinksMap = Record<string, { asA: CourseLinkRow[]; asB: CourseLinkRow[] }>

type UseStaffSchoolCatalogAdminOptions = {
  canAccessSchoolNav: boolean
  isSchoolView: boolean
  showStaffOps: boolean
  ensureMinimumLoadingTime: (startedAt: number) => Promise<void>
  handleStaffAuthFailure: (status: number) => boolean
  onCourseLinksMapLoaded: (map: CourseLinksMap) => void
}

export function useStaffSchoolCatalogAdmin({
  canAccessSchoolNav,
  isSchoolView,
  showStaffOps,
  ensureMinimumLoadingTime,
  handleStaffAuthFailure,
  onCourseLinksMapLoaded,
}: UseStaffSchoolCatalogAdminOptions) {
  const [schoolLoading, setSchoolLoading] = React.useState(false)
  const [schoolBusy, setSchoolBusy] = React.useState<SchoolBusyState>(null)
  const [schoolError, setSchoolError] = React.useState<string | null>(null)
  const [schoolSuccess, setSchoolSuccess] = React.useState<string | null>(null)
  const [schoolCourses, setSchoolCourses] = React.useState<SchoolCourseRow[]>([])
  const [schoolRooms, setSchoolRooms] = React.useState<RoomRow[]>([])
  const [schoolPackages, setSchoolPackages] = React.useState<SchoolPackageRow[]>([])
  const [packageStatusFilter, setPackageStatusFilter] = React.useState<PackageStatusFilter>("all")
  const [packageSearchQuery, setPackageSearchQuery] = React.useState("")
  const [editingPackageId, setEditingPackageId] = React.useState<string | null>(null)
  const [schoolPointsRules, setSchoolPointsRules] = React.useState<PointsRuleRow[]>([])
  const [roomReservations, setRoomReservations] = React.useState<RoomReservationRow[]>([])
  const [packageForm, setPackageForm] = React.useState<PackageFormState>(() => createEmptyPackageForm())
  const [pointsRuleForm, setPointsRuleForm] = React.useState<PointsRuleFormState>({
    templateKey: POINTS_RULE_DEFINITIONS[0]?.key || "profile-completed",
    points: "10",
    active: true,
  })
  const [pointsAssignForm, setPointsAssignForm] = React.useState<PointsAssignFormState>({
    userEmail: "",
    type: "MANUAL_STAFF_ASSIGNMENT",
    points: "10",
    note: "",
    eventKey: "",
  })

  const filteredSchoolPackages = React.useMemo(() => {
    const normalizedQuery = packageSearchQuery.trim().toLowerCase()
    const statusFiltered =
      packageStatusFilter === "all"
        ? schoolPackages.filter((item) => getPackageLifecycleStatus(item) !== "DELETED")
        : schoolPackages.filter((item) => getPackageLifecycleStatus(item) === packageStatusFilter)

    if (!normalizedQuery) return statusFiltered

    return statusFiltered.filter((item) => {
      const haystack = [item.label, item.key, item.courseSlug || "", item.cadence || ""].join(" ").toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [packageSearchQuery, packageStatusFilter, schoolPackages])

  const packageCounts = React.useMemo(
    () => ({
      all: schoolPackages.length,
      live: schoolPackages.filter((item) => getPackageLifecycleStatus(item) !== "DELETED").length,
      ACTIVE: schoolPackages.filter((item) => getPackageLifecycleStatus(item) === "ACTIVE").length,
      SUSPENDED: schoolPackages.filter((item) => getPackageLifecycleStatus(item) === "SUSPENDED").length,
      SCHEDULED: schoolPackages.filter((item) => getPackageLifecycleStatus(item) === "SCHEDULED").length,
      DELETED: schoolPackages.filter((item) => getPackageLifecycleStatus(item) === "DELETED").length,
    }),
    [schoolPackages]
  )

  const selectedPointsRuleTemplate = React.useMemo(
    () => POINTS_RULE_DEFINITIONS.find((item) => item.key === pointsRuleForm.templateKey) || null,
    [pointsRuleForm.templateKey]
  )
  const selectedPointsRuleRecord = React.useMemo(
    () => schoolPointsRules.find((item) => item.key === pointsRuleForm.templateKey) || null,
    [schoolPointsRules, pointsRuleForm.templateKey]
  )

  const fetchSchoolData = React.useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true
    const startedAt = Date.now()
    if (showLoader) setSchoolLoading(true)
    setSchoolError(null)
    try {
      const [coursesRes, roomsRes, packagesRes, rulesRes, reservationsRes] = await Promise.all([
        fetch("/api/staff/school/courses", { headers: { "Content-Type": "application/json" } }),
        fetch("/api/staff/rooms?pageSize=100", { headers: { "Content-Type": "application/json" } }),
        fetch("/api/staff/school/packages", { headers: { "Content-Type": "application/json" } }),
        fetch("/api/staff/school/points-rules", { headers: { "Content-Type": "application/json" } }),
        fetch("/api/staff/room-reservations", { headers: { "Content-Type": "application/json" } }),
      ])
      const [coursesData, roomsData, packagesData, rulesData, reservationsData] = await Promise.all([
        coursesRes.json().catch(() => ({})),
        roomsRes.json().catch(() => ({})),
        packagesRes.json().catch(() => ({})),
        rulesRes.json().catch(() => ({})),
        reservationsRes.json().catch(() => ({})),
      ])
      if (!coursesRes.ok || !roomsRes.ok || !packagesRes.ok || !rulesRes.ok || !reservationsRes.ok) {
        const authStatuses = [coursesRes.status, roomsRes.status, packagesRes.status, rulesRes.status, reservationsRes.status]
        if (authStatuses.some((status) => status === 401) && authStatuses.some((status) => handleStaffAuthFailure(status))) {
          return
        }
        const nextError = resolveRoomCatalogErrorMessage([coursesData, roomsData, packagesData, rulesData, reservationsData])
        setSchoolError(nextError)
        return
      }
      setSchoolCourses(Array.isArray(coursesData?.items) ? coursesData.items : [])
      setSchoolRooms(Array.isArray(roomsData?.items) ? roomsData.items : [])
      setSchoolPackages(Array.isArray(packagesData?.items) ? packagesData.items : [])
      setSchoolPointsRules(Array.isArray(rulesData?.items) ? rulesData.items : [])
      setRoomReservations(Array.isArray(reservationsData?.items) ? reservationsData.items : [])
      // Non-critical: fetch all course links per course for catalog display
      const courses: SchoolCourseRow[] = Array.isArray(coursesData?.items) ? coursesData.items : []
      if (courses.length > 0) {
        Promise.all(
          courses.map((c) =>
            fetch(`/api/staff/school/course-links?courseSlug=${encodeURIComponent(c.slug)}`)
              .then((r) => (r.ok ? r.json() : { asA: [], asB: [] }))
              .then((d) => ({ slug: c.slug, asA: d.asA || [], asB: d.asB || [] }))
              .catch(() => ({ slug: c.slug, asA: [], asB: [] }))
          )
        ).then((results) => {
          const map: CourseLinksMap = {}
          for (const r of results) map[r.slug] = { asA: r.asA, asB: r.asB }
          onCourseLinksMapLoaded(map)
        })
      }
    } catch {
      setSchoolError("Network error while loading school catalog.")
    } finally {
      if (showLoader) {
        await ensureMinimumLoadingTime(startedAt)
        setSchoolLoading(false)
      }
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure, onCourseLinksMapLoaded])

  const togglePackageCourse = React.useCallback((courseSlug: string) => {
    setPackageForm((prev) => {
      if (prev.courseSlugs.includes(courseSlug)) {
        return { ...prev, courseSlugs: prev.courseSlugs.filter((slug) => slug !== courseSlug) }
      }
      return { ...prev, courseSlugs: [...prev.courseSlugs, courseSlug] }
    })
  }, [])

  const savePackagePlan = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    if (packageForm.courseSlugs.length === 0) {
      setSchoolError("Select at least one course for this package.")
      return
    }
    setSchoolBusy("package")
    try {
      const res = await fetch("/api/staff/school/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: packageForm.id || null,
          key: packageForm.key,
          courseSlugs: packageForm.courseSlugs,
          label: packageForm.label,
          description: packageForm.description,
          priceCents: packageForm.priceCents,
          cadence: packageForm.cadence,
          status: packageForm.status,
          launchAt: packageForm.launchAt || null,
          totalCredits: packageForm.totalCredits,
          makeUps: packageForm.makeUps,
          validDays: packageForm.validDays,
          isUnlimited: packageForm.isUnlimited,
          active: packageForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to save package.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Package saved.")
      await fetchSchoolData({ showLoader: false })
      setEditingPackageId(null)
      setPackageForm(createEmptyPackageForm())
    } catch {
      setSchoolError("Network error while saving package.")
    } finally {
      setSchoolBusy(null)
    }
  }, [fetchSchoolData, packageForm])

  const setPackageLifecycleState = React.useCallback(
    async (item: SchoolPackageRow, nextStatus: PackagePlanStatus) => {
      setSchoolError(null)
      setSchoolSuccess(null)
      setSchoolBusy("package")
      try {
        const res = await fetch("/api/staff/school/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: item.key,
            courseSlugs: item.courseSlugs ?? (item.courseSlug ? [item.courseSlug] : []),
            label: item.label,
            description: item.description || "",
            priceCents: item.priceCents,
            cadence: item.cadence || "",
            status: nextStatus,
            launchAt: nextStatus === "SCHEDULED" ? item.launchAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
            totalCredits: item.totalCredits,
            makeUps: item.makeUps,
            validDays: item.validDays,
            isUnlimited: item.isUnlimited,
            active: nextStatus === "ACTIVE",
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setSchoolError(typeof data?.error === "string" ? data.error : "Unable to update package state.")
          return
        }
        setSchoolSuccess(typeof data?.message === "string" ? data.message : `Package moved to ${nextStatus.toLowerCase()}.`)
        await fetchSchoolData({ showLoader: false })
      } catch {
        setSchoolError("Network error while updating package state.")
      } finally {
        setSchoolBusy(null)
      }
    },
    [fetchSchoolData]
  )

  const deletePackagePlan = React.useCallback(
    async (item: SchoolPackageRow) => {
      if (typeof window !== "undefined") {
        const confirmed = window.confirm(`Delete package "${item.label}"? You can restore it later from the Deleted filter.`)
        if (!confirmed) return
      }
      await setPackageLifecycleState(item, "DELETED")
    },
    [setPackageLifecycleState]
  )

  const savePointsRule = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("rule")
    try {
      const template = POINTS_RULE_DEFINITIONS.find((item) => item.key === pointsRuleForm.templateKey)
      if (!template) {
        setSchoolError("Invalid points rule template.")
        return
      }
      const res = await fetch("/api/staff/school/points-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: template.key,
          label: template.label,
          eventType: template.eventType,
          points: pointsRuleForm.points,
          description: template.description,
          active: pointsRuleForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to save points rule.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Points rule saved.")
      await fetchSchoolData({ showLoader: false })
    } catch {
      setSchoolError("Network error while saving points rule.")
    } finally {
      setSchoolBusy(null)
    }
  }, [fetchSchoolData, pointsRuleForm])

  const assignPointsManually = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("assign")
    try {
      const res = await fetch("/api/staff/school/points-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: pointsAssignForm.userEmail,
          points: pointsAssignForm.points,
          type: pointsAssignForm.type,
          note: pointsAssignForm.note,
          eventKey: pointsAssignForm.eventKey,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to assign points.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Points assigned.")
      setPointsAssignForm((prev) => ({ ...prev, points: "10", note: "", eventKey: "" }))
    } catch {
      setSchoolError("Network error while assigning points.")
    } finally {
      setSchoolBusy(null)
    }
  }, [pointsAssignForm])

  const resetPointsRuleForm = React.useCallback(() => {
    const templateKey = pointsRuleForm.templateKey || POINTS_RULE_DEFINITIONS[0]?.key || "profile-completed"
    const template = POINTS_RULE_DEFINITIONS.find((item) => item.key === templateKey) || POINTS_RULE_DEFINITIONS[0] || null
    const existing = schoolPointsRules.find((item) => item.key === templateKey) || null
    setPointsRuleForm({
      templateKey,
      points: String(existing?.points ?? template?.defaultPoints ?? 10),
      active: existing?.active ?? true,
    })
  }, [pointsRuleForm.templateKey, schoolPointsRules])

  const resetPointsAssignForm = React.useCallback(() => {
    setPointsAssignForm({
      userEmail: "",
      type: "MANUAL_STAFF_ASSIGNMENT",
      points: "10",
      note: "",
      eventKey: "",
    })
  }, [])

  React.useEffect(() => {
    if (!showStaffOps || schoolCourses.length > 0) return
    let cancelled = false

    const loadAssignmentCourses = async () => {
      try {
        const res = await fetch("/api/staff/school/courses", { headers: { "Content-Type": "application/json" } })
        if (handleStaffAuthFailure(res.status)) return
        const data = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) return
        setSchoolCourses(Array.isArray(data?.items) ? data.items : [])
      } catch {
        // Keep the UI functional with the local fallback course catalog.
      }
    }

    void loadAssignmentCourses()

    return () => {
      cancelled = true
    }
  }, [handleStaffAuthFailure, schoolCourses.length, showStaffOps])

  React.useEffect(() => {
    if (!canAccessSchoolNav || !isSchoolView) return
    void fetchSchoolData({ showLoader: true })
  }, [canAccessSchoolNav, fetchSchoolData, isSchoolView])

  React.useEffect(() => {
    if (editingPackageId !== null) return // Don't auto-assign when editing an existing package
    if (packageForm.courseSlugs.length > 0) return
    const firstCourseSlug = schoolCourses[0]?.slug || demoCourses[0]?.slug || ""
    if (!firstCourseSlug) return
    setPackageForm((prev) => ({ ...prev, courseSlugs: [firstCourseSlug] }))
  }, [editingPackageId, packageForm.courseSlugs, schoolCourses])

  React.useEffect(() => {
    if (!selectedPointsRuleTemplate) return
    const nextPoints = selectedPointsRuleRecord ? String(selectedPointsRuleRecord.points) : String(selectedPointsRuleTemplate.defaultPoints)
    const nextActive = selectedPointsRuleRecord ? selectedPointsRuleRecord.active : true
    setPointsRuleForm((prev) => {
      if (prev.points === nextPoints && prev.active === nextActive) return prev
      return {
        ...prev,
        points: nextPoints,
        active: nextActive,
      }
    })
  }, [selectedPointsRuleRecord, selectedPointsRuleTemplate])

  return {
    schoolLoading,
    schoolBusy,
    schoolError,
    schoolSuccess,
    schoolCourses,
    schoolRooms,
    schoolPackages,
    packageStatusFilter,
    packageSearchQuery,
    editingPackageId,
    schoolPointsRules,
    roomReservations,
    packageForm,
    pointsRuleForm,
    pointsAssignForm,
    filteredSchoolPackages,
    packageCounts,
    selectedPointsRuleTemplate,
    setSchoolBusy,
    setSchoolError,
    setSchoolSuccess,
    setPackageStatusFilter,
    setPackageSearchQuery,
    setEditingPackageId,
    setPackageForm,
    setPointsRuleForm,
    setPointsAssignForm,
    fetchSchoolData,
    togglePackageCourse,
    savePackagePlan,
    setPackageLifecycleState,
    deletePackagePlan,
    savePointsRule,
    assignPointsManually,
    resetPointsRuleForm,
    resetPointsAssignForm,
  }
}
