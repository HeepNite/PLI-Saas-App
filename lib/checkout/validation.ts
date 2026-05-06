import type { CourseData, EnrollmentOption } from "@/constants/courses"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"

export type ApiError = { status: number; error: string; code?: string }

export type CheckoutBody = {
  courseSlug?: string
  courseTitle?: string
  amount?: number
  currency?: string
  date?: string
  time?: string
  packageId?: string
  serviceId?: string
  addons?: string[]
  participants?: number
  coupon?: string
  email?: string
  firstName?: string
  lastName?: string
  name?: string
  phone?: string
  prepareOnly?: boolean
  photoContext?: string
  kioskSessionToken?: string
  studentPin?: string
  studentPinConfirm?: string
  /** Price in cents for the consecutive class add-on */
  consecutivePriceCents?: number
  /** Slug of the course that the consecutive class links from */
  consecutiveLinkedCourseSlug?: string
  /** Human-readable title of the consecutive class */
  consecutiveCourseTitle?: string
  /** Time slot for the consecutive class (class B's time, falls back to class A's time) */
  consecutiveLinkedCourseTime?: string
}

export type CheckoutValidation = {
  courseSlug: string
  courseTitle: string
  amountInt: number
  currency: string
  date: string
  time: string
  packageId: string
  serviceId: string
  addons: string[]
  safeParticipants: number
  coupon: string
  course: CourseData
  service: EnrollmentOption
  pkg?: EnrollmentOption
  addonsOpts: EnrollmentOption[]
  expectedTotal: number
  packageTotalCredits: number | null
  packageIsUnlimited: boolean
  packageCadence: string
  packageMakeUps: number
  packageValidDays: number
  /** Consecutive class fields (present when user accepted the consecutive offer) */
  consecutivePriceCents: number | null
  consecutiveLinkedCourseSlug: string | null
  consecutiveCourseTitle: string | null
  consecutiveLinkedCourseTime: string | null
}

const getPackageCredits = (pkg?: EnrollmentOption) => {
  if (!pkg) return { packageTotalCredits: null, packageIsUnlimited: false, packageMakeUps: 0 }
  const totalClasses = pkg.meta?.totalClasses ?? 0
  const makeUps = pkg.meta?.makeUps ?? 0
  const combined = totalClasses + makeUps
  if (combined <= 0) {
    return {
      packageTotalCredits: null,
      packageIsUnlimited: true,
      packageMakeUps: makeUps,
    }
  }
  return {
    packageTotalCredits: combined,
    packageIsUnlimited: false,
    packageMakeUps: makeUps,
  }
}

export const isEmail = (val: string | undefined): val is string => Boolean(val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))

export const normalizePhone = (val?: string | null) => {
  const digits = val?.replace(/\D/g, "")
  return digits && digits.length >= 6 ? digits : undefined
}

export const validateCheckoutPayload = async (body: CheckoutBody): Promise<CheckoutValidation | ApiError> => {
  const {
    courseSlug,
    courseTitle = "Course booking",
    amount,
    currency = "usd",
    date = "",
    time = "",
    packageId = "",
    serviceId = "",
    addons = [],
    participants = 1,
    coupon = "",
    consecutivePriceCents,
    consecutiveLinkedCourseSlug,
    consecutiveCourseTitle,
    consecutiveLinkedCourseTime,
  } = body || {}

  const rawAmount = typeof amount === "number" ? amount : Number.NaN
  const amountInt = Number.isFinite(rawAmount) ? Math.round(rawAmount) : 0
  if (!courseSlug || amountInt <= 0) {
    return { status: 400, error: "Missing course slug or amount" }
  }

  // Validate consecutive fields consistency
  const hasConsecutive = typeof consecutivePriceCents === "number" && consecutivePriceCents > 0
  if (hasConsecutive && !consecutiveLinkedCourseSlug) {
    return { status: 400, error: "consecutiveLinkedCourseSlug is required when consecutivePriceCents is provided" }
  }

  const course = await getCatalogCourseBySlug(courseSlug)
  if (!course) {
    return { status: 404, error: "Course not found" }
  }

  const service = course.enrollment.services.find((s) => s.id === serviceId)
  const pkg = packageId ? course.enrollment.packages.find((p) => p.id === packageId) : undefined
  const addonsOpts = (course.enrollment.addons || []).filter((a) => addons.includes(a.id))
  if (!service) {
    return { status: 400, error: "Invalid service" }
  }
  if (packageId && !pkg) {
    return { status: 400, error: "Invalid package" }
  }
  if (addons.length && addonsOpts.length !== addons.length) {
    return { status: 400, error: "Invalid add-ons" }
  }

  const participantsCount = typeof participants === "number" && Number.isFinite(participants) ? participants : 1
  const safeParticipants = Math.min(10, Math.max(1, Math.floor(participantsCount)))
  const serviceCharge = pkg ? 0 : service.price || 0
  const perPerson = serviceCharge + (pkg?.price || 0) + addonsOpts.reduce((sum, a) => sum + (a.price || 0), 0)
  const subtotal = perPerson * safeParticipants
  const discountPercent = coupon?.toUpperCase() === "PLI10" ? 10 : coupon?.toUpperCase() === "PLI20" ? 20 : 0
  const discount = (subtotal * discountPercent) / 100
  let expected = Math.max(0, subtotal - discount)
  const packageInfo = getPackageCredits(pkg)

  // Validate consecutive class link and price when present
  let validatedConsecutivePriceCents: number | null = null
  let validatedConsecutiveLinkedCourseSlug: string | null = null
  let validatedConsecutiveCourseTitle: string | null = null
  let validatedConsecutiveLinkedCourseTime: string | null = null

  if (hasConsecutive && consecutiveLinkedCourseSlug) {
    // Validate the CourseLink exists and price matches
    const { findConsecutiveLink } = await import("@/lib/course-links")
    const link = await findConsecutiveLink(courseSlug, consecutiveLinkedCourseSlug)
    if (!link) {
      return { status: 400, error: "No active consecutive link found for this course pair" }
    }
    const validPrices = [link.dropInConsecutiveCents, link.packageHolderConsecutiveCents].filter(
      (p): p is number => p != null && p > 0
    )
    if (!validPrices.includes(consecutivePriceCents)) {
      return { status: 400, error: "Consecutive price does not match configured price" }
    }

    validatedConsecutivePriceCents = consecutivePriceCents
    validatedConsecutiveLinkedCourseSlug = consecutiveLinkedCourseSlug
    validatedConsecutiveCourseTitle = consecutiveCourseTitle || null
    validatedConsecutiveLinkedCourseTime = consecutiveLinkedCourseTime || null

    // Add consecutive price to expected total
    expected = expected + consecutivePriceCents / 100
  }

  if (Math.round(expected * 100) !== amountInt) {
    return { status: 400, error: "Amount mismatch" }
  }

  return {
    courseSlug,
    courseTitle,
    amountInt,
    currency,
    date,
    time,
    packageId,
    serviceId,
    addons,
    safeParticipants,
    coupon,
    course,
    service,
    pkg,
    addonsOpts,
    expectedTotal: expected,
    packageTotalCredits: packageInfo.packageTotalCredits,
    packageIsUnlimited: packageInfo.packageIsUnlimited,
    packageCadence: pkg?.meta?.cadence || "",
    packageMakeUps: packageInfo.packageMakeUps,
    packageValidDays: 180,
    consecutivePriceCents: validatedConsecutivePriceCents,
    consecutiveLinkedCourseSlug: validatedConsecutiveLinkedCourseSlug,
    consecutiveCourseTitle: validatedConsecutiveCourseTitle,
    consecutiveLinkedCourseTime: validatedConsecutiveLinkedCourseTime,
  }
}
