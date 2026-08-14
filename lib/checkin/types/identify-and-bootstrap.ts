/**
 * Types for the merged kiosk phone identify + bootstrap endpoint.
 *
 * The response is a discriminated union on the `path` field:
 * - `"fast"` — student has an active package for the current course AND a class
 *   session exists right now. Clerk is not called; consecutive offers and
 *   prepared checkout are skipped. Frontend goes directly to check-in UI.
 * - `"full"` — full bootstrap payload equivalent to the existing QR bootstrap
 *   response. Frontend renders the purchase/package UI.
 */

export type IdentifyAndBootstrapRequest = {
  phone: string
  courseSlug: string
  date: string
  time: string
  durationMinutes?: number
  linkedFromCourseSlug?: string
}

export type PackageInfo = {
  id: string
  packageId: string
  packageLabel: string | null
  courseSlug: string | null
  isUnlimited: boolean
  remainingCredits: number | null
  expiresAt: string | null
  status: string
}

export type BootstrapContext = {
  courseSlug: string
  courseTitle: string
  date: string
  time: string
  durationMinutes: number
  startsAt: string
  endsAt: string
  checkInWindow: {
    isOpen: boolean
    opensAt: string
    closesAt: string
  }
}

export type CustomerInfo = {
  userId: string
  name: string
  email: string
  phone: string
}

/**
 * Fast-path response — returned when the student has an active package for the
 * terminal's current course AND a class session exists at the current time.
 *
 * Clerk is NOT called. Consecutive offers, catalog lookup, and prepared
 * checkout context are all skipped to minimize latency.
 */
export type FastPathResponse = {
  identified: true
  path: "fast"
  sessionToken: string
  sessionExpiresAt: string
  customer: CustomerInfo
  package: PackageInfo
  context: BootstrapContext
  hasExistingPurchaseForSession: boolean
  hasAnyActivePackage: true
  consecutiveOffer: null
  quickCheckout: null
}

export type ConsecutiveOfferPayload = {
  linkedCourseSlug: string
  linkedCourseTitle: string
  dropInConsecutiveCents: number | null
  packageHolderConsecutiveCents: number | null
  regularDropInCents: number
  discountPercent: number
  hasAttendedFirstClass: boolean
}

export type QuickCheckoutTemplate = {
  serviceId: string
  packageId: string
  addons: string[]
  participants: number
  coupon: string
  amountCents: number
  currency: string
  sourcePurchaseId: string | null
  sourcePurchaseAt: string | null
}

export type FullCustomerInfo = CustomerInfo & {
  clerkUserId: string
  firstName: string
  lastName: string
  hasAvatar: boolean
}

/**
 * Full-path response — returned when the fast-path criteria are not met.
 *
 * Shape is a superset of the existing QR bootstrap payload, compatible with
 * how the frontend currently consumes bootstrap data.
 */
export type FullPathResponse = {
  identified: true
  path: "full"
  sessionToken: string
  sessionExpiresAt: string
  customer: FullCustomerInfo
  package: PackageInfo | null
  context: BootstrapContext
  hasExistingPurchaseForSession: boolean
  hasAnyActivePackage: boolean
  consecutiveOffer: ConsecutiveOfferPayload | null
  quickCheckout: QuickCheckoutTemplate | null
  quickRepeatEligible?: boolean
  lastPurchasePattern?: { paymentChannel: string; courseSlug: string; amount: number } | null
}

export type IdentifyAndBootstrapResponse = FastPathResponse | FullPathResponse
