import type { CourseData, EnrollmentOption } from "@/constants/courses"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"
import { isEmail, normalizePhone } from "@/lib/shared"

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
  flowContext?: string
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
  /** True when hosted checkout is only charging the consecutive add-on for an existing package holder. */
  consecutiveAddOnOnly?: boolean
  /** Slug of the first class that unlocked the consecutive add-on. */
  linkedFromCourseSlug?: string
  /** Display-only: remaining credits in the payer's package (shown on the congrats screen). */
  packageRemaining?: number
  /** Authoritative current class date from kiosk context (YYYY-MM-DD) */
  kioskCurrentCourseDate?: string
  /** Authoritative current class time from kiosk context (HH:MM) */
  kioskCurrentCourseTime?: string
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
  kioskCurrentCourseDate: string | null
  kioskCurrentCourseTime: string | null
  consecutiveAddOnOnly: boolean
  linkedFromCourseSlug: string | null
  /** Display-only remaining credits for the congrats screen; never gates payment. */
  packageRemaining: number | null
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

const normalizeIsoDate = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

const normalizeTime24 = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : null
}

export { isEmail, normalizePhone }

export const validateCheckoutPayload = async (
  body: CheckoutBody,
  opts?: { prepareOnly?: boolean },
): Promise<CheckoutValidation | ApiError> => {
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
    consecutiveAddOnOnly = false,
    linkedFromCourseSlug,
    packageRemaining,
    kioskCurrentCourseDate,
    kioskCurrentCourseTime,
  } = body || {}

  const rawAmount = typeof amount === "number" ? amount : Number.NaN
  const amountInt = Number.isFinite(rawAmount) ? Math.round(rawAmount) : 0
  if (!courseSlug || (!opts?.prepareOnly && amountInt <= 0)) {
    return { status: 400, error: "Missing course slug or amount" }
  }

  // Validate consecutive fields consistency
  const hasConsecutive = typeof consecutivePriceCents === "number" && consecutivePriceCents > 0
  if (hasConsecutive && !consecutiveLinkedCourseSlug && !consecutiveAddOnOnly) {
    return { status: 400, error: "consecutiveLinkedCourseSlug is required when consecutivePriceCents is provided" }
  }
  if (consecutiveAddOnOnly && (!hasConsecutive || !linkedFromCourseSlug)) {
    return { status: 400, error: "linkedFromCourseSlug and consecutivePriceCents are required for consecutive add-on checkout" }
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
  const validatedKioskCurrentCourseDate = normalizeIsoDate(kioskCurrentCourseDate)
  const validatedKioskCurrentCourseTime = normalizeTime24(kioskCurrentCourseTime)

  if (consecutiveAddOnOnly && hasConsecutive && linkedFromCourseSlug) {
    const { findConsecutiveLinkBetween } = await import("@/lib/course-links")
    const link = await findConsecutiveLinkBetween(linkedFromCourseSlug, courseSlug)
    if (!link) {
      return { status: 400, error: "No active consecutive link found for this course pair" }
    }
    if (link.packageHolderConsecutiveCents !== consecutivePriceCents) {
      return { status: 400, error: "Consecutive price does not match configured package-holder price" }
    }

    validatedConsecutivePriceCents = consecutivePriceCents
    validatedConsecutiveLinkedCourseSlug = courseSlug
    validatedConsecutiveCourseTitle = consecutiveCourseTitle || courseTitle || null
    validatedConsecutiveLinkedCourseTime = consecutiveLinkedCourseTime || null
    expected = consecutivePriceCents / 100
  } else if (hasConsecutive && consecutiveLinkedCourseSlug) {
    // Validate the CourseLink exists and price matches
    const { findConsecutiveLinkBetween } = await import("@/lib/course-links")
    const link = await findConsecutiveLinkBetween(courseSlug, consecutiveLinkedCourseSlug)
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
    console.error("[validation] Amount mismatch", { expected, expectedCents: Math.round(expected * 100), amountInt, serviceId, servicePrice: service?.price, courseSlug })
    return { status: 400, error: `Amount mismatch (expected ${Math.round(expected * 100)} cents, got ${amountInt} cents, service.price=${service?.price})` }
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
    kioskCurrentCourseDate: validatedKioskCurrentCourseDate,
    kioskCurrentCourseTime: validatedKioskCurrentCourseTime,
    consecutiveAddOnOnly: Boolean(consecutiveAddOnOnly),
    linkedFromCourseSlug: typeof linkedFromCourseSlug === "string" && linkedFromCourseSlug.trim() ? linkedFromCourseSlug.trim() : null,
    packageRemaining:
      typeof packageRemaining === "number" && Number.isFinite(packageRemaining) && packageRemaining >= 0
        ? Math.floor(packageRemaining)
        : null,
  }
}
