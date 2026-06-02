import React from "react"

import { centsToUsdInput } from "./staffAdminFormatters"
import type { CourseLinkFormState, CourseLinkRow } from "./staffAdminTypes"

type CourseLinksMap = Record<string, { asA: CourseLinkRow[]; asB: CourseLinkRow[] }>

const createEmptyCourseLinkForm = (): CourseLinkFormState => ({
  courseSlugB: "",
  dropInConsecutiveCents: "",
  packageHolderConsecutiveCents: "",
  active: true,
})

export function useStaffCourseLinksAdmin() {
  const [courseLinksAsA, setCourseLinksAsA] = React.useState<CourseLinkRow[]>([])
  const [courseLinksAsB, setCourseLinksAsB] = React.useState<CourseLinkRow[]>([])
  const [courseLinkForm, setCourseLinkForm] = React.useState<CourseLinkFormState>(() => createEmptyCourseLinkForm())
  const [courseLinkEditingId, setCourseLinkEditingId] = React.useState<string | null>(null)
  const [courseLinkSaving, setCourseLinkSaving] = React.useState(false)
  const [courseLinkError, setCourseLinkError] = React.useState<string | null>(null)
  const [courseLinkSuccess, setCourseLinkSuccess] = React.useState<string | null>(null)
  const [allCourseLinksMap, setAllCourseLinksMap] = React.useState<CourseLinksMap>({})

  const resetCourseLinkForm = React.useCallback(() => {
    setCourseLinkForm(createEmptyCourseLinkForm())
    setCourseLinkEditingId(null)
    setCourseLinkError(null)
    setCourseLinkSuccess(null)
  }, [])

  const loadCourseLinks = React.useCallback(async (courseSlug: string) => {
    try {
      const res = await fetch(`/api/staff/school/course-links?courseSlug=${encodeURIComponent(courseSlug)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Unable to load course links.")
      const asA = Array.isArray(data?.asA) ? data.asA : []
      const asB = Array.isArray(data?.asB) ? data.asB : []
      setCourseLinksAsA(asA as CourseLinkRow[])
      setCourseLinksAsB(asB as CourseLinkRow[])
    } catch {
      // Silently fail — links are optional
      setCourseLinksAsA([])
      setCourseLinksAsB([])
    }
  }, [])

  const clearCourseLinks = React.useCallback(() => {
    setCourseLinksAsA([])
    setCourseLinksAsB([])
  }, [])

  const courseLinkStats = React.useMemo(() => {
    const all: CourseLinkRow[] = []
    const seen = new Set<string>()
    for (const entry of Object.values(allCourseLinksMap)) {
      for (const link of [...entry.asA, ...entry.asB]) {
        if (!seen.has(link.id)) { seen.add(link.id); all.push(link) }
      }
    }
    return { total: all.length, active: all.filter((l) => l.active).length, inactive: all.filter((l) => !l.active).length }
  }, [allCourseLinksMap])

  const saveCourseLink = React.useCallback(async (event: React.FormEvent, courseEditingSlug: string | null) => {
    event.preventDefault()
    setCourseLinkError(null)
    setCourseLinkSuccess(null)

    if (!courseEditingSlug) {
      setCourseLinkError("Save the course first before adding consecutive class links.")
      return
    }

    // Client-side validation: prevent self-linking
    if (courseLinkForm.courseSlugB === courseEditingSlug) {
      setCourseLinkError("A course cannot be linked to itself.")
      return
    }

    if (!courseLinkForm.courseSlugB) {
      setCourseLinkError("Select a consecutive course.")
      return
    }

    // Validate prices are non-negative numbers (or empty)
    const dropInCents = courseLinkForm.dropInConsecutiveCents.trim()
    const packageCents = courseLinkForm.packageHolderConsecutiveCents.trim()

    if (dropInCents) {
      const parsed = Number(dropInCents.replace(",", "."))
      if (!Number.isFinite(parsed) || parsed < 0) {
        setCourseLinkError("Drop-in consecutive price must be a valid non-negative number.")
        return
      }
    }

    if (packageCents) {
      const parsed = Number(packageCents.replace(",", "."))
      if (!Number.isFinite(parsed) || parsed < 0) {
        setCourseLinkError("Package-holder consecutive price must be a valid non-negative number.")
        return
      }
    }

    setCourseLinkSaving(true)
    try {
      const dropInValue = dropInCents ? Math.round(Number(dropInCents.replace(",", ".")) * 100) : null
      const packageValue = packageCents ? Math.round(Number(packageCents.replace(",", ".")) * 100) : null

      const isUpdate = courseLinkEditingId !== null

      const res = await fetch("/api/staff/school/course-links", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isUpdate ? { id: courseLinkEditingId } : {}),
          courseSlugA: courseEditingSlug,
          courseSlugB: courseLinkForm.courseSlugB,
          dropInConsecutiveCents: dropInValue ?? (isUpdate ? undefined : 0),
          packageHolderConsecutiveCents: packageValue ?? (isUpdate ? undefined : 0),
          active: courseLinkForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCourseLinkError(typeof data?.error === "string" ? data.error : "Unable to save course link.")
        return
      }
      setCourseLinkSuccess(typeof data?.message === "string" ? data.message : "Course link saved.")
      resetCourseLinkForm()
      await loadCourseLinks(courseEditingSlug)
    } catch {
      setCourseLinkError("Network error while saving course link.")
    } finally {
      setCourseLinkSaving(false)
    }
  }, [courseLinkForm, courseLinkEditingId, loadCourseLinks, resetCourseLinkForm])

  const editCourseLink = React.useCallback((link: CourseLinkRow) => {
    setCourseLinkForm({
      courseSlugB: link.courseSlugB,
      dropInConsecutiveCents: centsToUsdInput(link.dropInConsecutiveCents),
      packageHolderConsecutiveCents: centsToUsdInput(link.packageHolderConsecutiveCents),
      active: link.active,
    })
    setCourseLinkEditingId(link.id)
    setCourseLinkError(null)
    setCourseLinkSuccess(null)
  }, [])

  const deleteCourseLink = React.useCallback(async (linkId: string, courseEditingSlug: string | null) => {
    setCourseLinkError(null)
    setCourseLinkSuccess(null)
    setCourseLinkSaving(true)
    try {
      const res = await fetch("/api/staff/school/course-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: linkId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCourseLinkError(typeof data?.error === "string" ? data.error : "Unable to delete course link.")
        return
      }
      setCourseLinkSuccess(typeof data?.message === "string" ? data.message : "Course link removed.")
      if (courseEditingSlug) {
        await loadCourseLinks(courseEditingSlug)
      }
      if (courseLinkEditingId === linkId) {
        resetCourseLinkForm()
      }
    } catch {
      setCourseLinkError("Network error while deleting course link.")
    } finally {
      setCourseLinkSaving(false)
    }
  }, [courseLinkEditingId, loadCourseLinks, resetCourseLinkForm])

  const toggleCourseLinkActive = React.useCallback(async (link: CourseLinkRow, courseEditingSlug: string | null) => {
    setCourseLinkError(null)
    setCourseLinkSaving(true)
    try {
      const res = await fetch("/api/staff/school/course-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: link.id,
          active: !link.active,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setCourseLinkError(typeof data?.error === "string" ? data.error : "Unable to toggle course link.")
        return
      }
      if (courseEditingSlug) {
        await loadCourseLinks(courseEditingSlug)
      }
    } catch {
      setCourseLinkError("Network error while toggling course link.")
    } finally {
      setCourseLinkSaving(false)
    }
  }, [loadCourseLinks])

  return {
    courseLinksAsA,
    courseLinksAsB,
    courseLinkForm,
    courseLinkEditingId,
    courseLinkSaving,
    courseLinkError,
    courseLinkSuccess,
    courseLinkStats,
    allCourseLinksMap,
    setCourseLinkForm,
    setAllCourseLinksMap,
    resetCourseLinkForm,
    loadCourseLinks,
    clearCourseLinks,
    saveCourseLink,
    editCourseLink,
    deleteCourseLink,
    toggleCourseLinkActive,
  }
}
