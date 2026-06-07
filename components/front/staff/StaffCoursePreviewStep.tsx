import React from "react"
import Image from "next/image"

import CalendarPicker from "@/components/front/ui/CalendarPicker"
import type { CourseFormState } from "./staffAdminTypes"

type CourseReviewVariant = {
  kind: string
  label: string
  hint: string
  active: boolean
}

type CalendarTone = "course" | "event" | "warning" | "program" | "workshop" | "convention" | "bootcamp"

type StaffCoursePreviewStepProps = {
  visible: boolean
  schoolLoading: boolean
  courseForm: CourseFormState
  selectedCourseKindLabel: string
  selectedCourseKindReviewLabel: string
  courseReviewVariants: CourseReviewVariant[]
  reviewPreviewHover: "home" | "single" | null
  setReviewPreviewHover: React.Dispatch<React.SetStateAction<"home" | "single" | null>>
  previewVideoSource: string
  isEmbedPreviewVideo: boolean
  previewMediaUrl: string | null
  previewEditorHref: string
  defaultRoomName: string
  scheduleTimes: string[]
  scheduleCalendarValues: string[]
  formatUsdInputLabel: (value: string) => string
  formatClockLabel: (value: string) => string
  getCourseScheduleDateTooltip: (date: string) => string | undefined
  getCourseScheduleDateTone: (date: string) => CalendarTone | undefined
}

export default function StaffCoursePreviewStep({
  visible,
  schoolLoading,
  courseForm,
  selectedCourseKindLabel,
  selectedCourseKindReviewLabel,
  courseReviewVariants,
  reviewPreviewHover,
  setReviewPreviewHover,
  previewVideoSource,
  isEmbedPreviewVideo,
  previewMediaUrl,
  previewEditorHref,
  defaultRoomName,
  scheduleTimes,
  scheduleCalendarValues,
  formatUsdInputLabel,
  formatClockLabel,
  getCourseScheduleDateTooltip,
  getCourseScheduleDateTone,
}: StaffCoursePreviewStepProps) {
  if (!visible) return null

  return (
    <div className="text-xs">
      <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">{selectedCourseKindReviewLabel}</p>
      {schoolLoading ? (
        <div className="mt-2 animate-pulse space-y-2">
          <div className="h-16 rounded-md bg-black/10 dark:bg-white/10" />
          <div className="h-4 rounded bg-black/10 dark:bg-white/10" />
          <div className="h-4 rounded bg-black/10 dark:bg-white/10" />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <PreviewCard
              title="Home card"
              mediaAlt="Home card mini preview"
              emptyLabel="Course image"
              editLabel="Edit home card"
              hoverKey="home"
              courseSlug={courseForm.slug}
              reviewPreviewHover={reviewPreviewHover}
              setReviewPreviewHover={setReviewPreviewHover}
              previewVideoSource={previewVideoSource}
              isEmbedPreviewVideo={isEmbedPreviewVideo}
              previewMediaUrl={previewMediaUrl}
              previewEditorHref={previewEditorHref}
            />
            <PreviewCard
              title="Single page"
              mediaAlt="Single page mini preview"
              emptyLabel="Single image"
              editLabel="Edit single page"
              hoverKey="single"
              courseSlug={courseForm.slug}
              reviewPreviewHover={reviewPreviewHover}
              setReviewPreviewHover={setReviewPreviewHover}
              previewVideoSource={previewVideoSource}
              isEmbedPreviewVideo={isEmbedPreviewVideo}
              previewMediaUrl={previewMediaUrl}
              previewEditorHref={previewEditorHref}
            />
          </div>
          <CoursePreviewSummary
            schoolLoading={schoolLoading}
            courseForm={courseForm}
            selectedCourseKindLabel={selectedCourseKindLabel}
            courseReviewVariants={courseReviewVariants}
            defaultRoomName={defaultRoomName}
            scheduleTimes={scheduleTimes}
            scheduleCalendarValues={scheduleCalendarValues}
            formatUsdInputLabel={formatUsdInputLabel}
            formatClockLabel={formatClockLabel}
            getCourseScheduleDateTooltip={getCourseScheduleDateTooltip}
            getCourseScheduleDateTone={getCourseScheduleDateTone}
          />
        </div>
      )}
    </div>
  )
}

function PreviewCard({
  title,
  mediaAlt,
  emptyLabel,
  editLabel,
  hoverKey,
  courseSlug,
  reviewPreviewHover,
  setReviewPreviewHover,
  previewVideoSource,
  isEmbedPreviewVideo,
  previewMediaUrl,
  previewEditorHref,
}: {
  title: string
  mediaAlt: string
  emptyLabel: string
  editLabel: string
  hoverKey: "home" | "single"
  courseSlug: string
  reviewPreviewHover: "home" | "single" | null
  setReviewPreviewHover: React.Dispatch<React.SetStateAction<"home" | "single" | null>>
  previewVideoSource: string
  isEmbedPreviewVideo: boolean
  previewMediaUrl: string | null
  previewEditorHref: string
}) {
  const showVideo = reviewPreviewHover === hoverKey && Boolean(previewVideoSource)

  return (
    <div
      data-testid={`preview-card-${hoverKey}`}
      className="rounded-md border border-black/10 bg-black/[0.02] p-1.5 dark:border-white/10 dark:bg-white/[0.03]"
      onMouseEnter={() => setReviewPreviewHover(hoverKey)}
      onMouseLeave={() => setReviewPreviewHover((previous) => (previous === hoverKey ? null : previous))}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">{title}</p>
      <div className="relative mt-1 h-48 overflow-hidden rounded-md border border-black/10 bg-[#050810] dark:border-white/10">
        {showVideo ? (
          isEmbedPreviewVideo ? (
            <iframe
              src={previewVideoSource}
              title={mediaAlt}
              className="h-48 w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={previewVideoSource}
              poster={previewMediaUrl || undefined}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
            />
          )
        ) : previewMediaUrl ? (
          <Image
            src={previewMediaUrl}
            alt={mediaAlt}
            fill
            unoptimized
            sizes="(min-width: 768px) 50vw, 100vw"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-48 items-center justify-center bg-black/35 text-[10px] uppercase tracking-[0.2em] text-white/55">{emptyLabel}</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.72))]" />
        <a
          href={previewEditorHref}
          className={`absolute bottom-3 right-3 z-10 inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold backdrop-blur ${
            courseSlug.trim()
              ? "border-white/40 bg-black/55 text-white hover:border-[var(--brand,#ff4b4b)]/75 hover:text-[var(--brand,#ffb3b3)]"
              : "pointer-events-none border-white/20 bg-black/35 text-white/45"
          }`}
        >
          {editLabel}
        </a>
      </div>
    </div>
  )
}

function CoursePreviewSummary({
  schoolLoading,
  courseForm,
  selectedCourseKindLabel,
  courseReviewVariants,
  defaultRoomName,
  scheduleTimes,
  scheduleCalendarValues,
  formatUsdInputLabel,
  formatClockLabel,
  getCourseScheduleDateTooltip,
  getCourseScheduleDateTone,
}: {
  schoolLoading: boolean
  courseForm: CourseFormState
  selectedCourseKindLabel: string
  courseReviewVariants: CourseReviewVariant[]
  defaultRoomName: string
  scheduleTimes: string[]
  scheduleCalendarValues: string[]
  formatUsdInputLabel: (value: string) => string
  formatClockLabel: (value: string) => string
  getCourseScheduleDateTooltip: (date: string) => string | undefined
  getCourseScheduleDateTone: (date: string) => CalendarTone | undefined
}) {
  return (
    <div className="grid grid-cols-2 gap-4 border-t border-black/10 pt-3 dark:border-white/10">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-semibold text-black dark:text-white">{courseForm.title || "Untitled"}</p>
        <p className="text-black/70 dark:text-white/70">{courseForm.description || "No course description yet."}</p>
        <p className="truncate text-black/65 dark:text-white/65">Type: {selectedCourseKindLabel}</p>
        <p className="truncate text-black/65 dark:text-white/65">Slug: {courseForm.slug || "—"}</p>
        <p className="text-black/75 dark:text-white/75">
          Drop-in: {formatUsdInputLabel(courseForm.dropInPriceCents)} · First class: {formatUsdInputLabel(courseForm.firstClassPriceCents)}
        </p>
        <CourseDiscountSummary courseForm={courseForm} formatUsdInputLabel={formatUsdInputLabel} />
        <p className="text-black/75 dark:text-white/75">Publication: {formatPublication(courseForm)}</p>
        <p className="truncate text-black/75 dark:text-white/75">Address: {courseForm.location || "—"}</p>
        <p className="truncate text-black/75 dark:text-white/75">Default room: {defaultRoomName}</p>
        <p className="text-black/65 dark:text-white/65">
          {scheduleTimes.length > 0
            ? `Times: ${scheduleTimes.map((time) => formatClockLabel(time)).join(", ")}`
            : "Times: schedule to be defined"}
        </p>
        <CourseReviewVariants variants={courseReviewVariants} courseTitle={courseForm.title} dropInPrice={courseForm.dropInPriceCents} formatUsdInputLabel={formatUsdInputLabel} />
      </div>
      <div className="min-w-0">
        {schoolLoading ? (
          <div className="h-52 rounded-md bg-black/10 dark:bg-white/10 animate-pulse" />
        ) : (
          <CalendarPicker
            value=""
            onChange={() => {}}
            values={scheduleCalendarValues}
            multiple
            onValuesChange={() => {}}
            timezone="America/New_York"
            className="!w-full !rounded-md !bg-white/60 dark:!bg-white/[0.06]"
            compact
            locked
            getDateTooltip={getCourseScheduleDateTooltip}
            getDateTone={getCourseScheduleDateTone}
          />
        )}
      </div>
    </div>
  )
}

function CourseDiscountSummary({ courseForm, formatUsdInputLabel }: { courseForm: CourseFormState; formatUsdInputLabel: (value: string) => string }) {
  if (courseForm.specialDiscountType === "none") return null

  return (
    <p className="text-black/75 dark:text-white/75">
      Discount: {formatDiscountLabel(courseForm)} · Price {formatUsdInputLabel(courseForm.specialDiscountPrice)}
    </p>
  )
}

function CourseReviewVariants({ variants, courseTitle, dropInPrice, formatUsdInputLabel }: { variants: CourseReviewVariant[]; courseTitle: string; dropInPrice: string; formatUsdInputLabel: (value: string) => string }) {
  return (
    <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
      <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Reviews by type</p>
      <div className="mt-1 grid grid-cols-2 md:grid-cols-3 gap-2">
        {variants.map((variant) => (
          <div key={`course-review-variant-${variant.kind}`} className="rounded-md border border-black/10 bg-white/50 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="min-w-0 space-y-0.5">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${variant.active ? "text-[var(--brand,#b61616)] dark:text-[var(--brand,#ff6b6b)]" : "text-black dark:text-white"}`}>
                {variant.label}
              </p>
              <p className="text-[11px] text-black/70 dark:text-white/70">{variant.hint}</p>
              <p className="text-[11px] text-black/65 dark:text-white/65">{courseTitle || "Untitled"} · {formatUsdInputLabel(dropInPrice)}</p>
            </div>
            {variant.active ? (
              <span className="rounded-full border border-[var(--brand,#b61616)]/50 bg-[var(--brand,#b61616)]/15 px-1.5 py-0.5 text-[10px] text-[var(--brand,#ff4b4b)]">Active</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDiscountLabel(courseForm: CourseFormState) {
  if (courseForm.specialDiscountType === "custom") return courseForm.specialDiscountCustomLabel || "Custom"
  if (courseForm.specialDiscountType === "valentines_desc") return "San Valentin desc"
  return "Navidad desc"
}

function formatPublication(courseForm: CourseFormState) {
  if (courseForm.publicationMode === "coming_soon") return "Coming soon"
  if (courseForm.publicationMode === "launch_date") return `Launch ${courseForm.launchDate || "—"}`
  return "Publish now"
}
