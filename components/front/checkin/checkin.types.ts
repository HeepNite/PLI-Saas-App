export type EntryMode = "idle" | "existing" | "new"

export type PackageOfferScenario = "dropin-upsell" | "expired-rebuy" | "new-user-upsell"

export type PackageOfferContext = {
  scenario: PackageOfferScenario
  previousPackageId: string | null
  courseSlug: string
  date: string
  time: string
} | null

export type ConsecutiveOffer = {
  linkedCourseSlug: string
  linkedCourseTitle: string
  linkedCourseTime?: string
  dropInConsecutiveCents: number | null
  packageHolderConsecutiveCents: number | null
  regularDropInCents: number
  discountPercent: number
  hasAttendedFirstClass: boolean
}

export type BootstrapResponse = {
  context: {
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
  customer: {
    userId: string
    clerkUserId: string
    firstName: string
    lastName: string
    name: string
    email: string
    phone: string
    hasAvatar: boolean
  }
  package: {
    id: string
    packageId: string
    packageLabel: string | null
    isUnlimited: boolean
    remainingCredits: number | null
    expiresAt: string | null
    status: string
  } | null
  packages: Array<{
    id: string
    packageId: string
    packageLabel: string | null
    courseSlug: string | null
    isUnlimited: boolean
    remainingCredits: number | null
    expiresAt: string | null
    status: string
  }>
  quickCheckout: {
    serviceId: string
    packageId: string
    addons: string[]
    participants: number
    coupon: string
    amountCents: number
    currency: string
    sourcePurchaseId: string | null
    sourcePurchaseAt: string | null
  } | null
  purchaseHistory: Array<{
    id: string
    createdAt: string
    amount: number
    currency: string
    status: string
    participants: number | null
    serviceId: string
    packageId: string
    addons: string[]
    date: string
    time: string
  }>
  hasPreviousPurchase: boolean
  hasAnyCompletedPurchase: boolean
  /** True if user already has a successful purchase for this exact class session (date + time) */
  hasExistingPurchaseForSession?: boolean
  /** True if user has any valid active package (not necessarily scoped to current course) */
  hasAnyActivePackage?: boolean
  /** Consecutive class offer, present when student attended Class A and a CourseLink exists */
  consecutiveOffer?: ConsecutiveOffer | null
}

export type CheckInQrClientProps = {
  forcedDeviceMode?: "station" | "personal"
  forcedCourseSlug?: string
  selectedCourseSlug?: string
  hideQrPanel?: boolean
  shellVariant?: "qr" | "terminal"
  terminalName?: string
  terminalLocation?: string
  qrPathOverride?: string
  /** Optional simulated time override for test mode (e.g. kiosk rotation testing) */
  simulatedNowTick?: Date
  /** Callback to notify parent when sensitive flow state changes (for rotation guard) */
  onFlowActiveChange?: (active: boolean) => void
}
