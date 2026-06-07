import React from "react"
import { X } from "lucide-react"
import type { CourseData } from "@/constants/courses"

type CoursePickerModalProps = {
  coursePickerOpen: boolean
  setCoursePickerOpen: (open: boolean) => void
  orderedCourses: CourseData[]
  preferredSet: Set<string>
  setSelectedCourse: (course: CourseData) => void
  setEnrollOpen: (open: boolean) => void
}

export function CoursePickerModal({
  coursePickerOpen,
  setCoursePickerOpen,
  orderedCourses,
  preferredSet,
  setSelectedCourse,
  setEnrollOpen,
}: CoursePickerModalProps) {
  if (!coursePickerOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" data-lenis-prevent>
      <div className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#141017] via-[#0d0b12] to-[#09090d] p-6 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.85)] flex flex-col">
        <button
          className="absolute right-5 top-5 rounded-full border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white"
          onClick={() => setCoursePickerOpen(false)}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Book</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Choose the class you want to book</h3>
            <p className="mt-1 text-sm text-white/60">We show the classes you choose the most first.</p>
          </div>
        </div>

        <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orderedCourses.map((course) => (
              <button
                key={course.slug}
                type="button"
                onClick={() => {
                  setSelectedCourse(course)
                  setCoursePickerOpen(false)
                  setEnrollOpen(true)
                }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-[var(--brand,#b61616)]/60 hover:bg-white/10"
              >
                <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={course.heroMedia?.image ?? "/images/carousel/_DSC1079.JPG"}
                    alt={course.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{course.title}</p>
                    <p className="mt-1 text-xs text-white/60">{course.level} · {course.duration}</p>
                  </div>
                  {preferredSet.has(course.slug) && (
                    <span className="rounded-full border border-[var(--brand,#b61616)]/60 bg-[rgba(182,22,22,0.15)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--brand,#b61616)]">
                      Preferred
                    </span>
                  )}
                </div>
                <div className="mt-4 text-xs text-white/60">
                  <p>{course.schedule.day}</p>
                  <p>{course.location.address}</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-white/70">
                  <span className="rounded-full border border-white/10 px-2 py-1">View details</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">Book</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
