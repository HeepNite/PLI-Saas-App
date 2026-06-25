import React from "react"
import Image from "next/image"

import type { StaffRole } from "@/lib/security/staff-role"
import type { CourseLinkRow, SchoolCourseRow } from "./staffAdminTypes"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const COURSE_CATALOG_FILTERS = ["all", "active", "inactive"] as const

export type CourseCatalogFilter = (typeof COURSE_CATALOG_FILTERS)[number]

type CourseLinksBySlug = Record<string, { asA: CourseLinkRow[]; asB: CourseLinkRow[] }>

type StaffCourseCatalogPanelProps = {
  visible: boolean
  schoolLoading: boolean
  schoolCourses: SchoolCourseRow[]
  courseCatalogSearch: string
  setCourseCatalogSearch: (value: string) => void
  courseCatalogFilter: CourseCatalogFilter
  setCourseCatalogFilter: (value: CourseCatalogFilter) => void
  allCourseLinksMap: CourseLinksBySlug
  schoolBusy: string | null
  currentRole: StaffRole
  onEditCourse: (course: SchoolCourseRow) => void
  onToggleCourseActive: (course: SchoolCourseRow) => void
  onDeleteCourse: (slug: string, title: string) => void
}

export default function StaffCourseCatalogPanel({
  visible,
  schoolLoading,
  schoolCourses,
  courseCatalogSearch,
  setCourseCatalogSearch,
  courseCatalogFilter,
  setCourseCatalogFilter,
  allCourseLinksMap,
  schoolBusy,
  currentRole,
  onEditCourse,
  onToggleCourseActive,
  onDeleteCourse,
}: StaffCourseCatalogPanelProps) {
  if (!visible) return null

  const filteredCourses = filterCourses(schoolCourses, courseCatalogSearch, courseCatalogFilter)
  const handleSavedCoursesWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget
    if (container.scrollHeight <= container.clientHeight) return
    event.preventDefault()
    event.stopPropagation()
    container.scrollTop += event.deltaY
  }

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Course catalog</p>
        <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Saved courses</h3>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={courseCatalogSearch}
          onChange={(event) => setCourseCatalogSearch(event.target.value)}
          placeholder="Search by name or slug..."
          className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
        <div className="flex items-center gap-1 rounded-lg border border-black/8 bg-black/[0.02] p-1 dark:border-white/8 dark:bg-white/[0.02]">
          {COURSE_CATALOG_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setCourseCatalogFilter(filter)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                courseCatalogFilter === filter
                  ? "bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                  : "text-black/55 hover:bg-black/[0.04] hover:text-black/80 dark:text-white/55 dark:hover:bg-white/[0.04] dark:hover:text-white/80"
              }`}
            >
              {formatCatalogFilterLabel(filter)}
            </button>
          ))}
        </div>
      </div>

      <div
        className="max-h-[28rem] overflow-y-auto overscroll-contain pr-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
        onWheel={handleSavedCoursesWheel}
      >
        {schoolLoading ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="h-24 animate-pulse rounded-md bg-black/10 dark:bg-white/10" />
            <div className="h-24 animate-pulse rounded-md bg-black/10 dark:bg-white/10" />
            <div className="h-24 animate-pulse rounded-md bg-black/10 dark:bg-white/10" />
          </div>
        ) : filteredCourses.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            {schoolCourses.length === 0 ? "No courses created yet." : "No courses match the current filter."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filteredCourses.map((course) => (
              <CourseCatalogCard
                key={`saved-course-ext-${course.slug}`}
                course={course}
                schoolCourses={schoolCourses}
                courseLinks={allCourseLinksMap[course.slug]}
                schoolBusy={schoolBusy}
                currentRole={currentRole}
                onEditCourse={onEditCourse}
                onToggleCourseActive={onToggleCourseActive}
                onDeleteCourse={onDeleteCourse}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

function filterCourses(courses: SchoolCourseRow[], search: string, filter: CourseCatalogFilter) {
  const query = search.toLowerCase().trim()

  return courses.filter((course) => {
    if (filter === "active" && !course.active) return false
    if (filter === "inactive" && course.active) return false
    if (query && !course.title.toLowerCase().includes(query) && !course.slug.toLowerCase().includes(query)) return false
    return true
  })
}

function formatCatalogFilterLabel(filter: CourseCatalogFilter) {
  return filter === "all" ? "All" : filter === "active" ? "Active" : "Inactive"
}

type CourseCatalogCardProps = {
  course: SchoolCourseRow
  schoolCourses: SchoolCourseRow[]
  courseLinks: { asA: CourseLinkRow[]; asB: CourseLinkRow[] } | undefined
  schoolBusy: string | null
  currentRole: StaffRole
  onEditCourse: (course: SchoolCourseRow) => void
  onToggleCourseActive: (course: SchoolCourseRow) => void
  onDeleteCourse: (slug: string, title: string) => void
}

function CourseCatalogCard({
  course,
  schoolCourses,
  courseLinks,
  schoolBusy,
  currentRole,
  onEditCourse,
  onToggleCourseActive,
  onDeleteCourse,
}: CourseCatalogCardProps) {
  const previewMediaUrl = course.coverImageUrl || (course.previewVideoUrl ? `/api/og?title=${encodeURIComponent(course.title)}` : null)

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-2.5 ${
        course.active
          ? "border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
          : "border-black/5 bg-black/[0.01] opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
      }`}
    >
      {previewMediaUrl ? (
        <Image
          src={previewMediaUrl}
          alt={course.title}
          width={48}
          height={48}
          unoptimized
          className="h-12 w-12 flex-none rounded-md object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-black/10 text-[8px] uppercase text-black/40 dark:bg-white/10 dark:text-white/40">img</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-black dark:text-white">{course.title}</p>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
            course.active
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50"
          }`}
          >
            {course.active ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="truncate text-[11px] text-black/60 dark:text-white/60">{course.slug}</p>
        <p className="text-[11px] text-black/55 dark:text-white/55">{formatCourseScheduleLabel(course)}</p>
        <CourseLinkPills course={course} schoolCourses={schoolCourses} courseLinks={courseLinks} />
        <div className="mt-1.5 flex gap-2">
          <button type="button" onClick={() => onEditCourse(course)} className="rounded border border-blue-500/40 px-2 py-0.5 text-[10px] font-semibold text-blue-500 transition hover:bg-blue-500/10">Edit</button>
          <button type="button" onClick={() => onToggleCourseActive(course)} disabled={schoolBusy !== null} className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition ${course.active ? "border-amber-500/40 text-amber-500 hover:bg-amber-500/10" : "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"}`}>{course.active ? "Hold" : "Activate"}</button>
          {currentRole === "owner" && (
            <button type="button" onClick={() => onDeleteCourse(course.slug, course.title)} disabled={schoolBusy !== null} className="rounded border border-red-500/60 px-2 py-0.5 text-[10px] font-semibold text-red-500 hover:bg-red-500/10">Delete</button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatCourseScheduleLabel(course: SchoolCourseRow) {
  const weekdays = course.availableWeekdays.length > 0
    ? course.availableWeekdays.slice().sort((a, b) => a - b).map((day) => WEEKDAY_LABELS[day]).join(", ")
    : ""
  const times = course.availableTimes.length > 0 ? ` · ${course.availableTimes.join(", ")}` : ""

  return `${weekdays}${times}`
}

function CourseLinkPills({
  course,
  schoolCourses,
  courseLinks,
}: {
  course: SchoolCourseRow
  schoolCourses: SchoolCourseRow[]
  courseLinks: { asA: CourseLinkRow[]; asB: CourseLinkRow[] } | undefined
}) {
  const allLinks = [...(courseLinks?.asA || []), ...(courseLinks?.asB || [])]
  if (allLinks.length === 0) return null

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {allLinks.map((link) => {
        const linkedSlug = link.courseSlugA === course.slug ? link.courseSlugB : link.courseSlugA
        const linkedCourse = schoolCourses.find((candidate) => candidate.slug === linkedSlug)
        return (
          <span key={link.id} className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${link.active ? "bg-violet-500/15 text-violet-500 dark:text-violet-400" : "bg-black/5 text-black/40 dark:bg-white/5 dark:text-white/40"}`}>
            ↔ {linkedCourse?.title || linkedSlug}
          </span>
        )
      })}
    </div>
  )
}
