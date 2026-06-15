import React from "react"

import type { StepEnabledContext } from "@/components/front/staff/school"
import StaffCourseMainInfoStep from "./StaffCourseMainInfoStep"
import StaffCoursePricingStep from "./StaffCoursePricingStep"
import StaffCourseMediaStep from "./StaffCourseMediaStep"
import StaffCourseScheduleStep from "./StaffCourseScheduleStep"
import StaffCourseLinksStep from "./StaffCourseLinksStep"
import StaffCoursePreviewStep from "./StaffCoursePreviewStep"
import StaffCoursePublishStep from "./StaffCoursePublishStep"

type CourseStudioWizard = {
  activeEntity: string
  step: number
  totalSteps: number
  enabledContext: StepEnabledContext
  onPrevious: (enabledContext: StepEnabledContext) => void
  onNext: (enabledContext: StepEnabledContext) => void
}

type CourseStudioForm = {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  courseImageInputRef: React.RefObject<HTMLInputElement | null>
  courseVideoInputRef: React.RefObject<HTMLInputElement | null>
  courseFormFieldsRef: React.RefObject<HTMLDivElement | null>
  onLocalImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onLocalVideoChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

type StaffCourseStudioPanelProps = {
  wizard: CourseStudioWizard
  form: CourseStudioForm
  isSpecialEventCourse: boolean
  mainInfo: Omit<React.ComponentProps<typeof StaffCourseMainInfoStep>, "visible">
  pricing: Omit<React.ComponentProps<typeof StaffCoursePricingStep>, "visible">
  media: Omit<React.ComponentProps<typeof StaffCourseMediaStep>, "visible" | "onUploadVideo" | "onUploadImage">
  schedule: Omit<React.ComponentProps<typeof StaffCourseScheduleStep>, "visible" | "isSpecialEventCourse">
  links: Omit<React.ComponentProps<typeof StaffCourseLinksStep>, "visible">
  preview: Omit<React.ComponentProps<typeof StaffCoursePreviewStep>, "visible">
  publish: Omit<React.ComponentProps<typeof StaffCoursePublishStep>, "visible">
}

export default function StaffCourseStudioPanel({
  wizard,
  form,
  isSpecialEventCourse,
  mainInfo,
  pricing,
  media,
  schedule,
  links,
  preview,
  publish,
}: StaffCourseStudioPanelProps) {
  if (wizard.activeEntity !== "courses") return null

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Course studio</p>
        <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">{resolveCourseStepTitle(wizard.step)}</h3>
        <p className="mt-1 text-sm text-black/65 dark:text-white/65">{resolveCourseStepDescription(wizard.step)}</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <form onSubmit={form.onSubmit}>
          <input ref={form.courseImageInputRef} name="courseLocalImage" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={form.onLocalImageChange} />
          <input ref={form.courseVideoInputRef} name="courseLocalVideo" type="file" accept="video/mp4,video/webm" className="hidden" onChange={form.onLocalVideoChange} />
          <div ref={form.courseFormFieldsRef} className="mt-4 space-y-4">
            <StaffCourseMainInfoStep visible={wizard.step === 0} {...mainInfo} />
            <StaffCoursePricingStep visible={wizard.step === 1} {...pricing} />
            <StaffCourseMediaStep
              visible={wizard.step === 2}
              {...media}
              onUploadVideo={() => form.courseVideoInputRef.current?.click()}
              onUploadImage={() => form.courseImageInputRef.current?.click()}
            />

            <div style={{ display: wizard.step >= 3 && wizard.step <= 5 ? undefined : "none" }} className="space-y-2">
              <p style={{ display: wizard.step === 3 ? undefined : "none" }} className="mb-2 text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
                {isSpecialEventCourse ? "Special events (calendar builder)" : "Schedules (guided builder)"}
              </p>
              <div className="space-y-5">
                <StaffCourseScheduleStep visible={wizard.step === 3} isSpecialEventCourse={isSpecialEventCourse} {...schedule} />
                <StaffCourseLinksStep visible={wizard.step === 4} {...links} />
                <StaffCoursePreviewStep visible={wizard.step === 5} {...preview} />
              </div>
            </div>
          </div>

          <StaffCoursePublishStep visible={wizard.step === 6} {...publish} />
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={() => wizard.onPrevious(wizard.enabledContext)}
            disabled={wizard.step === 0}
            className="rounded-lg border border-black/10 px-4 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.04] disabled:opacity-30 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04]"
          >
            ← Previous
          </button>
          <span className="text-[10px] text-black/40 dark:text-white/40">
            Step {wizard.step + 1} of {wizard.totalSteps}
          </span>
          <button
            type="button"
            onClick={() => wizard.onNext(wizard.enabledContext)}
            disabled={wizard.step >= wizard.totalSteps - 1}
            className="rounded-lg border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-4 py-1.5 text-xs font-medium text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/20 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>
    </article>
  )
}

function resolveCourseStepTitle(step: number) {
  return step === 0 ? "Course main information"
    : step === 1 ? "Prices and discounts"
    : step === 2 ? "Media assets"
    : step === 3 ? "Schedule builder"
    : step === 4 ? "Consecutive class links"
    : step === 5 ? "Preview and calendar"
    : "Publish course"
}

function resolveCourseStepDescription(step: number) {
  return step === 0 ? "Set the basic details: title, type, category, location, and default room."
    : step === 1 ? "Configure drop-in price, first class price, and special discounts."
    : step === 2 ? "Upload a cover image and add a video preview for the course."
    : step === 3 ? "Select days, time slots, repetition rules, and publication status."
    : step === 4 ? "Link this course to a consecutive class with special pricing."
    : step === 5 ? "Review how the course looks and check the monthly calendar."
    : "Share on social media and save the course."
}
