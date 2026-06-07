import React from "react"

import { COURSE_SPECIAL_DISCOUNT_OPTIONS, type CourseSpecialDiscountType } from "./staffAdminConstants"
import type { CourseFormState } from "./staffAdminTypes"

const COURSE_PRICE_FIELD_CLASS = "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
const COURSE_PRICE_FIELD_DISABLED_CLASS = `${COURSE_PRICE_FIELD_CLASS} disabled:opacity-45`

type StaffCoursePricingStepProps = {
  visible: boolean
  courseEditingSlug: string | null
  courseForm: CourseFormState
  setCourseForm: React.Dispatch<React.SetStateAction<CourseFormState>>
}

export default function StaffCoursePricingStep({ visible, courseEditingSlug, courseForm, setCourseForm }: StaffCoursePricingStepProps) {
  if (!visible) return null
  if (!courseEditingSlug) {
    return <p className="mt-4 text-center text-sm text-black/50 dark:text-white/50">Create the course first to configure this step.</p>
  }

  const updateCourseField = <Field extends keyof CourseFormState>(field: Field, value: CourseFormState[Field]) => {
    setCourseForm((previous) => ({ ...previous, [field]: value }))
  }

  const updateSpecialDiscountType = (value: CourseSpecialDiscountType) => {
    setCourseForm((previous) => ({
      ...previous,
      specialDiscountType: value,
      specialDiscountCustomLabel: value === "custom" ? previous.specialDiscountCustomLabel : "",
    }))
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Prices and special discounts</span>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          name="courseSpecialDiscountType"
          value={courseForm.specialDiscountType}
          onChange={(event) => updateSpecialDiscountType(event.target.value as CourseSpecialDiscountType)}
          className={COURSE_PRICE_FIELD_CLASS}
        >
          {COURSE_SPECIAL_DISCOUNT_OPTIONS.map((option) => (
            <option key={`course-special-discount-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          name="courseSpecialDiscountPrice"
          type="number"
          step="0.01"
          min={0}
          value={courseForm.specialDiscountPrice}
          onChange={(event) => updateCourseField("specialDiscountPrice", event.target.value)}
          placeholder="Discounted price USD"
          disabled={courseForm.specialDiscountType === "none"}
          className={COURSE_PRICE_FIELD_DISABLED_CLASS}
        />
      </div>
      {courseForm.specialDiscountType === "custom" ? (
        <input
          name="courseSpecialDiscountCustomLabel"
          value={courseForm.specialDiscountCustomLabel}
          onChange={(event) => updateCourseField("specialDiscountCustomLabel", event.target.value)}
          placeholder="Custom discount label (e.g., Anniversary Week)"
          className={`mt-2 ${COURSE_PRICE_FIELD_CLASS}`}
        />
      ) : null}
    </div>
  )
}
