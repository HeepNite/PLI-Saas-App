import React from "react"

import { centsToUsdInput } from "./staffAdminFormatters"
import type { CourseLinkFormState, CourseLinkRow } from "./staffAdminTypes"

type CourseLinksMap = Record<string, { asA: CourseLinkRow[]; asB: CourseLinkRow[] }>
type ParsedConsecutivePrice = { ok: true; cents: number | null } | { ok: false }
type CourseLinkPriceValidation =
  | { ok: true; dropIn: ParsedConsecutivePrice & { ok: true }; packageHolder: ParsedConsecutivePrice & { ok: true } }
  | { ok: false; error: string }

const DROP_IN_PRICE_ERROR = "Drop-in consecutive price must be a valid non-negative number."
const PACKAGE_HOLDER_PRICE_ERROR = "Package-holder consecutive price must be a valid non-negative number."

const createEmptyCourseLinkForm = (): CourseLinkFormState => ({
  courseSlugB: "",
  dropInConsecutiveCents: "",
  packageHolderConsecutiveCents: "",
  active: true,
})

const parseConsecutivePrice = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return { ok: true as const, cents: null }
  const parsed = Number(trimmed.replace(",", "."))
  if (!Number.isFinite(parsed) || parsed < 0) return { ok: false as const }
  return { ok: true as const, cents: Math.round(parsed * 100) }
}

const validateCourseLinkPrices = (form: CourseLinkFormState): CourseLinkPriceValidation => {
  const dropIn = parseConsecutivePrice(form.dropInConsecutiveCents)
  if (!dropIn.ok) return { ok: false, error: DROP_IN_PRICE_ERROR }

  const packageHolder = parseConsecutivePrice(form.packageHolderConsecutiveCents)
  if (!packageHolder.ok) return { ok: false, error: PACKAGE_HOLDER_PRICE_ERROR }

  return { ok: true, dropIn, packageHolder }
}

const validateCourseLinkSelection = (form: CourseLinkFormState, courseSlugA: string | null) => {
  if (!form.courseSlugB) return "Select a consecutive course."
  if (courseSlugA && form.courseSlugB === courseSlugA) return "A course cannot be linked to itself."
  return null
}

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
        if (seen.has(link.id)) continue
        seen.add(link.id)
        all.push(link)
      }
    }
    const active = all.filter((link) => link.active).length
    return { total: all.length, active, inactive: all.length - active }
  }, [allCourseLinksMap])

  const saveCourseLink = React.useCallback(async (event: React.FormEvent, courseEditingSlug: string | null) => {
    event.preventDefault()
    setCourseLinkError(null)
    setCourseLinkSuccess(null)

    if (!courseEditingSlug) {
      const selectionError = validateCourseLinkSelection(courseLinkForm, null)
      if (selectionError) {
        setCourseLinkError(selectionError)
        return
      }
      const priceValidation = validateCourseLinkPrices(courseLinkForm)
      if (!priceValidation.ok) {
        setCourseLinkError(priceValidation.error)
        return
      }
      setCourseLinkSuccess("Consecutive link will be saved with the course.")
      return
    }

    const selectionError = validateCourseLinkSelection(courseLinkForm, courseEditingSlug)
    if (selectionError) {
      setCourseLinkError(selectionError)
      return
    }
    const priceValidation = validateCourseLinkPrices(courseLinkForm)
    if (!priceValidation.ok) {
      setCourseLinkError(priceValidation.error)
      return
    }

    setCourseLinkSaving(true)
    try {
      const isUpdate = courseLinkEditingId !== null

      const res = await fetch("/api/staff/school/course-links", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isUpdate ? { id: courseLinkEditingId } : {}),
          courseSlugA: courseEditingSlug,
          courseSlugB: courseLinkForm.courseSlugB,
          dropInConsecutiveCents: priceValidation.dropIn.cents ?? (isUpdate ? undefined : 0),
          packageHolderConsecutiveCents: priceValidation.packageHolder.cents ?? (isUpdate ? undefined : 0),
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

  const saveDraftCourseLinkForCourse = React.useCallback(async (courseSlugA: string) => {
    setCourseLinkError(null)
    setCourseLinkSuccess(null)

    if (courseLinkEditingId || !courseLinkForm.courseSlugB) {
      return { ok: true, skipped: true }
    }

    const selectionError = validateCourseLinkSelection(courseLinkForm, courseSlugA)
    if (selectionError) {
      setCourseLinkError(selectionError)
      return { ok: false, skipped: false, error: selectionError }
    }
    const priceValidation = validateCourseLinkPrices(courseLinkForm)
    if (!priceValidation.ok) {
      setCourseLinkError(priceValidation.error)
      return { ok: false, skipped: false, error: priceValidation.error }
    }

    setCourseLinkSaving(true)
    try {
      const res = await fetch("/api/staff/school/course-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlugA,
          courseSlugB: courseLinkForm.courseSlugB,
          dropInConsecutiveCents: priceValidation.dropIn.cents ?? 0,
          packageHolderConsecutiveCents: priceValidation.packageHolder.cents ?? 0,
          active: courseLinkForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const error = typeof data?.error === "string" ? data.error : "Unable to save course link."
        setCourseLinkError(error)
        return { ok: false, skipped: false, error }
      }
      setCourseLinkSuccess(typeof data?.message === "string" ? data.message : "Course link saved.")
      return { ok: true, skipped: false }
    } catch {
      const error = "Network error while saving course link."
      setCourseLinkError(error)
      return { ok: false, skipped: false, error }
    } finally {
      setCourseLinkSaving(false)
    }
  }, [courseLinkEditingId, courseLinkForm])

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
    saveDraftCourseLinkForCourse,
    editCourseLink,
    deleteCourseLink,
    toggleCourseLinkActive,
  }
}
