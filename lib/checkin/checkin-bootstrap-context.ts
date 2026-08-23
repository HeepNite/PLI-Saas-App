import { pickTerminalContextRecommendation } from "@/lib/checkin/checkin-helpers"
import type { CourseData } from "@/constants/courses"

type CheckInActiveContextInput = {
  sourceCourses: CourseData[]
  shellVariant: "qr" | "terminal"
  searchParams: URLSearchParams
  forcedCourseSlug: string
  forcedClassContext?: {
    courseSlug: string
    date: string
    time: string
    durationMinutes?: number
  }
  selectedCourseSlug?: string
  nowTick: Date
  terminalTodayOnly?: boolean
}

type CheckInBootstrapContextInput = {
  activeCourseSlug: string
  activeDate: string
  activeTime: string
  durationMinutes: number
  latePaymentEntryOverride: {
    courseSlug: string
    date: string
    time: string
    durationMinutes?: number
  } | null
}

export const resolveCheckInActiveContext = ({
  sourceCourses,
  shellVariant,
  searchParams,
  forcedCourseSlug,
  forcedClassContext,
  selectedCourseSlug,
  nowTick,
  terminalTodayOnly,
}: CheckInActiveContextInput) => {
  const qrCourseSlug = (searchParams.get("courseSlug") || "").trim().toLowerCase()
  const qrDate = (searchParams.get("date") || "").trim()
  const qrTime = (searchParams.get("time") || "").trim()
  const effectivePreferredSlug = selectedCourseSlug?.trim().toLowerCase() || forcedCourseSlug.trim().toLowerCase()
  const baseCourseSlug = qrCourseSlug || effectivePreferredSlug
  const normalizedForcedContext = forcedClassContext?.courseSlug && forcedClassContext.date && forcedClassContext.time
    ? {
        courseSlug: forcedClassContext.courseSlug.trim().toLowerCase(),
        date: forcedClassContext.date,
        time: forcedClassContext.time,
      }
    : null
  const hasExplicitContext = Boolean(qrCourseSlug && qrDate && qrTime)
  const fixedContextRecommendation = normalizedForcedContext
    ? normalizedForcedContext
    : hasExplicitContext
    ? { courseSlug: qrCourseSlug, date: qrDate, time: qrTime }
    : shellVariant === "terminal"
      ? pickTerminalContextRecommendation(sourceCourses, nowTick, effectivePreferredSlug, { todayOnly: terminalTodayOnly !== false })
      : null

  const activeCourseSlug = fixedContextRecommendation?.courseSlug || baseCourseSlug
  const activeDate = fixedContextRecommendation?.date || qrDate
  const activeTime = fixedContextRecommendation?.time || qrTime

  return {
    activeCourseSlug,
    activeDate,
    activeTime,
    contextIsValid: Boolean(activeCourseSlug && activeDate && activeTime),
  }
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
