"use client"

import React, { forwardRef, useImperativeHandle, useState } from "react"
import dynamic from "next/dynamic"
import { demoCourses } from "@/constants/courses"
import type { CourseData } from "@/constants/courses"

const EnrollModal = dynamic(() => import("../courses/EnrollModal"), { ssr: false })

export type CourseEnrollTriggerRef = {
  open: (slug: string) => void
}

function CourseEnrollTriggerInner(_props: unknown, ref: React.Ref<CourseEnrollTriggerRef | null>) {
  const [open, setOpen] = useState(false)
  const [course, setCourse] = useState<CourseData | null>(null)

  useImperativeHandle(ref, () => ({
    open: (slug: string) => {
      const found = demoCourses.find((c) => c.slug === slug) || demoCourses[0]
      setCourse(found)
      setOpen(true)
    },
  }))

  if (!course) return null

  return (
    <EnrollModal
      course={course}
      open={open}
      onCloseAction={() => setOpen(false)}
    />
  )
}

const CourseEnrollTrigger = forwardRef<CourseEnrollTriggerRef | null>(CourseEnrollTriggerInner)
CourseEnrollTrigger.displayName = "CourseEnrollTrigger"

export default CourseEnrollTrigger
