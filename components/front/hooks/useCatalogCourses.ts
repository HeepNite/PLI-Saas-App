"use client"

import React from "react"
import { demoCourses, type CourseData } from "@/constants/courses"

type CatalogCoursesResponse = {
  courses?: CourseData[]
}

export const useCatalogCourses = (initialCourses?: CourseData[]) => {
  const [courses, setCourses] = React.useState<CourseData[]>(() => initialCourses?.length ? initialCourses : [])
  const [loading, setLoading] = React.useState<boolean>(() => !(initialCourses && initialCourses.length > 0))

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/catalog/courses", { cache: "no-store" })
      const data = (await res.json().catch(() => null)) as CatalogCoursesResponse | null
      if (!res.ok || !data?.courses?.length) {
        setCourses((prev) => (prev.length ? prev : demoCourses))
        return
      }
      setCourses(data.courses)
    } catch {
      setCourses((prev) => (prev.length ? prev : demoCourses))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (initialCourses?.length) {
      setCourses(initialCourses)
      setLoading(false)
      return
    }
    void load()
  }, [initialCourses, load])

  return { courses, loading, reload: load }
}
