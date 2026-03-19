"use client"

import React, { forwardRef, useImperativeHandle, useState } from "react"
import dynamic from "next/dynamic"
import { demoCourses, type CourseData } from "@/constants/courses"

const EnrollModal = dynamic(() => import("../courses/EnrollModal"), { ssr: false })

export type CourseEnrollTriggerRef = {
  open: (slug: string) => void
}

type CourseEnrollTriggerProps = {
  courses?: CourseData[]
}

function CourseEnrollTriggerInner({ courses = [] }: CourseEnrollTriggerProps, ref: React.Ref<CourseEnrollTriggerRef | null>) {
  const [open, setOpen] = useState(false)
  const [course, setCourse] = useState<CourseData | null>(null)
  const sourceCourses = courses.length > 0 ? courses : demoCourses

  useImperativeHandle(ref, () => ({
    open: (slug: string) => {
      const found = sourceCourses.find((c) => c.slug === slug) || sourceCourses[0]
      if (!found) return
      setCourse(found)
      setOpen(true)
    },
  }), [sourceCourses])

  if (!course) return null

  return (
    <EnrollModal
      course={course}
      open={open}
      onCloseAction={() => setOpen(false)}
    />
  )
}

const CourseEnrollTrigger = forwardRef<CourseEnrollTriggerRef | null, CourseEnrollTriggerProps>(CourseEnrollTriggerInner)
CourseEnrollTrigger.displayName = "CourseEnrollTrigger"

export default CourseEnrollTrigger
