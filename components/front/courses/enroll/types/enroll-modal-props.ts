import type { CourseEnrollmentData, EnrollmentContact, PaymentMethod } from "@/components/front/courses/types"
import type { PhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"

export type EnrollFlowVariant = "default" | "checkin-new" | "checkin-existing"
export type EnrollCompletionMode = "default" | "personal" | "station"
export type CompactBookingSource = "qr-mobile"

export type EnrollCheckInContext = {
  date?: string
  time?: string
  durationMinutes?: number
}

export type EnrollPrefillSelection = {
  service?: string
  packageId?: string
  addons?: string[]
  participants?: number
  paymentMethod?: PaymentMethod
}

export type PreparedAccountState = {
  clerkUserId: string | null
  created: boolean
  requiresSignIn: boolean
  hasAvatar: boolean
}

export type NewStudentVerifyResponse = {
  outcome?: "eligible" | "requires_sms_verification" | "fallback_regular"
  reason?: string
  message?: string
  eligibleForNewStudent?: boolean
  requiresSmsVerification?: boolean
  shouldFallbackToRegular?: boolean
}

export type FlowPopupState = {
  title: string
  message: string
}

export type EnrollModalProps = {
  course: CourseEnrollmentData
  open: boolean
  onCloseAction: () => void
  onCompletedAction?: () => void | Promise<void>
  /**
   * Called once when the modal reaches the payments step for the first time
   * after opening. Used by the kiosk terminal flow to know when to hide the
   * full-screen resolving overlay.
   */
  onPaymentsStepReadyAction?: () => void
  /**
   * Called when the inactivity timeout fires instead of onCompletedAction.
   * Use to reset to a different state (e.g. idle chooser) on timeout.
   */
  onTimeoutAction?: () => void
  onExistingUserDetected?: () => void
  onKioskSessionCreated?: (sessionId: string) => void
  initialStep?: number
  mode?: "modal" | "inline"
  prefillContact?: Partial<EnrollmentContact>
  prefillHasAvatar?: boolean
  prefillSelection?: EnrollPrefillSelection
  flowVariant?: EnrollFlowVariant
  compactBookingSource?: CompactBookingSource
  completionMode?: EnrollCompletionMode
  photoFlowContext?: PhotoFlowContext
  checkInContext?: EnrollCheckInContext
  kioskSessionToken?: string
  useDraft?: boolean
  preventOutsideClose?: boolean
  /** Trusted account flows can skip the contact / "Your Information" step. */
  skipContactStep?: boolean
  /** Consecutive class offer data — when present, inserts a "consecutive" step between packages and payments */
  consecutiveOffer?: ConsecutiveOfferData
  /** Whether the student has an active package (affects consecutive pricing) */
  isPackageHolder?: boolean
}
