import React from "react"

import type { CourseLinkFormState, CourseLinkRow, SchoolCourseRow } from "./staffAdminTypes"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

type CourseLinkActions = {
  toggleActive: (link: CourseLinkRow) => void
  edit: (link: CourseLinkRow) => void
  delete: (linkId: string) => void
}

type CourseLinkPriceFormatters = {
  formatUsdInputLabel: (value: string) => string
  centsToUsdInput: (cents: number | null | undefined) => string
}

type StaffCourseLinksStepProps = {
  visible: boolean
  courseEditingSlug: string | null
  schoolCourses: SchoolCourseRow[]
  courseLinkError: string | null
  courseLinkSuccess: string | null
  courseLinkForm: CourseLinkFormState
  setCourseLinkForm: React.Dispatch<React.SetStateAction<CourseLinkFormState>>
  courseLinkSaving: boolean
  courseLinkEditingId: string | null
  courseLinksAsA: CourseLinkRow[]
  courseLinksAsB: CourseLinkRow[]
  onSaveCourseLink: (event: React.FormEvent) => void
  onResetCourseLinkForm: () => void
  onToggleCourseLinkActive: CourseLinkActions["toggleActive"]
  onEditCourseLink: CourseLinkActions["edit"]
  onDeleteCourseLink: CourseLinkActions["delete"]
  formatUsdInputLabel: CourseLinkPriceFormatters["formatUsdInputLabel"]
  centsToUsdInput: CourseLinkPriceFormatters["centsToUsdInput"]
}

export default function StaffCourseLinksStep({
  visible,
  courseEditingSlug,
  schoolCourses,
  courseLinkError,
  courseLinkSuccess,
  courseLinkForm,
  setCourseLinkForm,
  courseLinkSaving,
  courseLinkEditingId,
  courseLinksAsA,
  courseLinksAsB,
  onSaveCourseLink,
  onResetCourseLinkForm,
  onToggleCourseLinkActive,
  onEditCourseLink,
  onDeleteCourseLink,
  formatUsdInputLabel,
  centsToUsdInput,
}: StaffCourseLinksStepProps) {
  if (!visible) return null

  const currentCourseTitle = resolveCourseTitle(schoolCourses, courseEditingSlug)
  const actions: CourseLinkActions = {
    toggleActive: onToggleCourseLinkActive,
    edit: onEditCourseLink,
    delete: onDeleteCourseLink,
  }
  const priceFormatters: CourseLinkPriceFormatters = { formatUsdInputLabel, centsToUsdInput }

  return (
    <div className="mb-4 rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Consecutive Classes</p>
      {courseEditingSlug ? (
        <>
          <p className="mt-1 text-xs text-black/65 dark:text-white/65">
            Link <strong>{currentCourseTitle}</strong> to a consecutive class with special pricing.
          </p>

          {courseLinkError && (
            <div className="mt-2 rounded-md border border-red-500/30 bg-red-50 px-3 py-1.5 dark:border-red-400/30 dark:bg-red-900/20">
              <p className="text-xs text-red-800 dark:text-red-200">{courseLinkError}</p>
            </div>
          )}
          {courseLinkSuccess && (
            <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-50 px-3 py-1.5 dark:border-emerald-400/30 dark:bg-emerald-900/20">
              <p className="text-xs text-emerald-800 dark:text-emerald-200">{courseLinkSuccess}</p>
            </div>
          )}

          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-black/70 dark:text-white/70">Consecutive course</label>
                <select
                  value={courseLinkForm.courseSlugB}
                  onChange={(event) => setCourseLinkForm((prev) => ({ ...prev, courseSlugB: event.target.value }))}
                  className="w-full rounded-md border border-black/15 bg-white px-2 py-1.5 text-xs text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  <option value="">Select a course...</option>
                  {schoolCourses
                    .filter((course) => course.slug !== courseEditingSlug && course.active)
                    .map((course) => (
                      <option key={`link-course-${course.slug}`} value={course.slug}>
                        {formatCourseOptionLabel(course)}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-black/70 dark:text-white/70">Status</label>
                <button
                  type="button"
                  onClick={() => setCourseLinkForm((prev) => ({ ...prev, active: !prev.active }))}
                  className={`inline-flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                    courseLinkForm.active
                      ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-900/20 dark:text-emerald-300"
                      : "border-black/15 bg-white text-black/50 dark:border-white/15 dark:bg-white/5 dark:text-white/40"
                  }`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${courseLinkForm.active ? "bg-emerald-500" : "bg-black/20 dark:bg-white/20"}`} />
                  {courseLinkForm.active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-black/70 dark:text-white/70">Drop-in price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={courseLinkForm.dropInConsecutiveCents}
                  onChange={(event) => setCourseLinkForm((prev) => ({ ...prev, dropInConsecutiveCents: event.target.value }))}
                  placeholder="e.g., 12"
                  className="w-full rounded-md border border-black/15 bg-white px-2 py-1.5 text-xs text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-black/70 dark:text-white/70">Package-holder price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={courseLinkForm.packageHolderConsecutiveCents}
                  onChange={(event) => setCourseLinkForm((prev) => ({ ...prev, packageHolderConsecutiveCents: event.target.value }))}
                  placeholder="e.g., 5"
                  className="w-full rounded-md border border-black/15 bg-white px-2 py-1.5 text-xs text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(event) => onSaveCourseLink(event as unknown as React.FormEvent)}
                disabled={courseLinkSaving}
                className="inline-flex items-center rounded-md bg-[var(--brand,#b61616)] px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60"
              >
                {courseLinkSaving ? "Saving..." : courseLinkEditingId ? "Update link" : "Add link"}
              </button>
              {courseLinkEditingId && (
                <button
                  type="button"
                  onClick={onResetCourseLinkForm}
                  className="inline-flex items-center rounded-md border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold text-black/80 transition dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <CourseLinkList
            title={`Courses after this one (${courseLinksAsA.length})`}
            links={courseLinksAsA}
            schoolCourses={schoolCourses}
            currentCourseTitle={currentCourseTitle}
            courseEditingSlug={courseEditingSlug}
            direction="after"
            courseLinkSaving={courseLinkSaving}
            actions={actions}
            priceFormatters={priceFormatters}
          />

          <CourseLinkList
            title={`Courses before this one (${courseLinksAsB.length})`}
            links={courseLinksAsB}
            schoolCourses={schoolCourses}
            currentCourseTitle={currentCourseTitle}
            courseEditingSlug={courseEditingSlug}
            direction="before"
            courseLinkSaving={courseLinkSaving}
            actions={actions}
            priceFormatters={priceFormatters}
          />

          {courseLinksAsA.length === 0 && courseLinksAsB.length === 0 && (
            <p className="mt-2 text-[11px] text-black/50 dark:text-white/50">No consecutive class links yet.</p>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">Create the course first to manage consecutive class links.</p>
      )}
    </div>
  )
}

type CourseLinkListProps = {
  title: string
  links: CourseLinkRow[]
  schoolCourses: SchoolCourseRow[]
  currentCourseTitle: string | null
  courseEditingSlug: string
  direction: "after" | "before"
  courseLinkSaving: boolean
  actions: CourseLinkActions
  priceFormatters: CourseLinkPriceFormatters
}

function CourseLinkList({
  title,
  links,
  schoolCourses,
  currentCourseTitle,
  courseEditingSlug,
  direction,
  courseLinkSaving,
  actions,
  priceFormatters,
}: CourseLinkListProps) {
  if (links.length === 0) return null

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-black/60 dark:text-white/60">{title}</p>
      {links.map((link) => {
        const label = resolveCourseLinkLabel({ link, schoolCourses, currentCourseTitle, courseEditingSlug, direction })
        const priceLabel = formatCourseLinkPriceLabel(link, priceFormatters)

        return (
          <div key={`link-${direction}-${link.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-black dark:text-white">
                {label}
              </p>
              <p className="text-[11px] text-black/60 dark:text-white/60">{priceLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => actions.toggleActive(link)} disabled={courseLinkSaving} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${link.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-black/10 text-black/40 dark:bg-white/10 dark:text-white/40"}`}>
                {link.active ? "Active" : "Inactive"}
              </button>
              <button type="button" onClick={() => actions.edit(link)} className="rounded border border-black/20 px-1.5 py-0.5 text-[10px] font-semibold text-black/70 dark:border-white/20 dark:text-white/60">Edit</button>
              <button type="button" onClick={() => actions.delete(link.id)} disabled={courseLinkSaving} className="rounded border border-red-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-500 disabled:opacity-40">Remove</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function resolveCourseTitle(schoolCourses: SchoolCourseRow[], slug: string | null) {
  return schoolCourses.find((course) => course.slug === slug)?.title ?? slug
}

function formatCourseOptionLabel(course: SchoolCourseRow) {
  const weekdays = course.availableWeekdays
    .slice()
    .sort((a, b) => a - b)
    .map((weekday) => WEEKDAY_LABELS[weekday])
    .join(", ")
  const times = course.availableTimes.length > 0 ? ` · ${course.availableTimes.join(", ")}` : ""

  return `${course.title} — ${weekdays}${times}`
}

type ResolveCourseLinkLabelArgs = {
  link: CourseLinkRow
  schoolCourses: SchoolCourseRow[]
  currentCourseTitle: string | null
  courseEditingSlug: string
  direction: "after" | "before"
}

function resolveCourseLinkLabel({
  link,
  schoolCourses,
  currentCourseTitle,
  courseEditingSlug,
  direction,
}: ResolveCourseLinkLabelArgs) {
  const linkedSlug = direction === "after" ? link.courseSlugB : link.courseSlugA
  const linkedCourseTitle = resolveCourseTitle(schoolCourses, linkedSlug) ?? linkedSlug
  const currentTitle = currentCourseTitle ?? courseEditingSlug
  const beforeTitle = direction === "after" ? currentTitle : linkedCourseTitle
  const afterTitle = direction === "after" ? linkedCourseTitle : currentTitle

  return `${beforeTitle} → ${afterTitle}`
}

function formatCourseLinkPriceLabel(link: CourseLinkRow, priceFormatters: CourseLinkPriceFormatters) {
  const dropInPrice = priceFormatters.formatUsdInputLabel(priceFormatters.centsToUsdInput(link.dropInConsecutiveCents))
  const packagePrice = priceFormatters.formatUsdInputLabel(priceFormatters.centsToUsdInput(link.packageHolderConsecutiveCents))

  return `Drop-in: ${dropInPrice} · Package: ${packagePrice}`
}
