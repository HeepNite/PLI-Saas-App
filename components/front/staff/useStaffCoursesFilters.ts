import React from "react"

import type { SchoolCourseRow } from "./staffAdminTypes"
import type { CourseSlugConflictState } from "./useStaffCoursesAdmin"

export type StaffCoursesFiltersInput = {
  schoolCourses: SchoolCourseRow[]
  courseEditingSlug: string | null
  courseFormSlug: string
}

export const useStaffCoursesFilters = (input: StaffCoursesFiltersInput) => {
  const { schoolCourses, courseEditingSlug, courseFormSlug } = input

  const [courseCatalogSearch, setCourseCatalogSearch] = React.useState("")
  const [courseCatalogFilter, setCourseCatalogFilter] = React.useState<"all" | "active" | "inactive">("all")
  const [courseSlugConflict, setCourseSlugConflict] = React.useState<CourseSlugConflictState>({
    exists: false,
    suggestion: null,
    existingTitle: null,
  })

  // ─── Slug conflict detection ─────────────────────────────────────
  React.useEffect(() => {
    const currentSlug = courseFormSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
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
  }, [courseFormSlug, courseEditingSlug, schoolCourses])

  return {
    courseCatalogSearch,
    setCourseCatalogSearch,
    courseCatalogFilter,
    setCourseCatalogFilter,
    courseSlugConflict,
    setCourseSlugConflict,
  }
}
