type CheckInBootstrapContextInput = {
  activeCourseSlug: string
  activeDate: string
  activeTime: string
  durationMinutes: number
  latePaymentEntryOverride: {
    courseSlug: string
    date: string
    time: string
  } | null
}

export const resolveCheckInBootstrapContextPayload = ({
  activeCourseSlug,
  activeDate,
  activeTime,
  durationMinutes,
  latePaymentEntryOverride,
}: CheckInBootstrapContextInput) => {
  const courseSlug = latePaymentEntryOverride?.courseSlug ?? activeCourseSlug

  return {
    courseSlug,
    date: latePaymentEntryOverride?.date ?? activeDate,
    time: latePaymentEntryOverride?.time ?? activeTime,
    durationMinutes,
    linkedFromCourseSlug: courseSlug,
  }
}
