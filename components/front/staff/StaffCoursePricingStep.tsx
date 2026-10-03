import React from "react"

import type { CourseFormState } from "./staffAdminTypes"

const COURSE_PRICE_FIELD_CLASS = "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
type StaffCoursePricingStepProps = {
  visible: boolean
  courseEditingSlug: string | null
  courseForm: CourseFormState
  setCourseForm: React.Dispatch<React.SetStateAction<CourseFormState>>
}

export default function StaffCoursePricingStep({ visible, courseForm, setCourseForm }: StaffCoursePricingStepProps) {
  if (!visible) return null

  const updateCourseField = <Field extends keyof CourseFormState>(field: Field, value: CourseFormState[Field]) => {
    setCourseForm((previous) => ({ ...previous, [field]: value }))
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Base prices</span>
      {courseForm.specialClassOperationsEnabled ? <p className="text-xs text-black/55 dark:text-white/55">Drop-in is the shared initial Special Class price; first-class and discounts remain course-only.</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <input
          name="courseDropInPrice"
          type="number"
          step="0.01"
          min={0}
          value={courseForm.dropInPriceCents}
          onChange={(event) => updateCourseField("dropInPriceCents", event.target.value)}
          placeholder="Drop-in USD (e.g., 20)"
          className={COURSE_PRICE_FIELD_CLASS}
        />
        <input
          name="courseFirstClassPrice"
          type="number"
          step="0.01"
          min={0}
          value={courseForm.firstClassPriceCents}
          onChange={(event) => updateCourseField("firstClassPriceCents", event.target.value)}
          placeholder="First class USD (e.g., 15)"
          className={COURSE_PRICE_FIELD_CLASS}
        />
      </div>
      <p className="text-xs text-black/55 dark:text-white/55">Campaign pricing is configured in the Promotions step.</p>
    </div>
  )
}
