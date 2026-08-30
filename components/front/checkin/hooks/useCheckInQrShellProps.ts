import { toEsDateTime } from "@/lib/checkin/checkin-helpers"
import type { CheckInQrShellProps } from "@/components/front/checkin/CheckInQrShell"
import type { EntryMode, BootstrapResponse, ConsecutiveOffer, TerminalPastClass } from "@/components/front/checkin/checkin.types"
import type { PackageCheckInFailure } from "@/lib/checkin/existing-customer-flow"
import type { CourseData } from "@/constants/courses"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { ComponentProps } from "react"
import type { CheckInQrOverlays } from "@/components/front/checkin/CheckInQrOverlays"

// ─── Local aliases (mirror types used in CheckInQrShellProps) ────────────────

type EnrollModalLike = {
  completionMode: ComponentProps<typeof CheckInQrOverlays>["completionMode"]
  photoFlowContext: ComponentProps<typeof CheckInQrOverlays>["photoFlowContext"]
  prefillSelection: ComponentProps<typeof CheckInQrOverlays>["prefillSelection"]
}

type QuickCheckoutDetails = {
  serviceLabel?: string
  packageLabel?: string
  addonLabels?: string[]
} | null

type CheckInContext = {
  date?: string
  time?: string
  durationMinutes?: number
}

type PackageCheckInResult = { remainingCredits: number | null; points: number }

// ─── Input ───────────────────────────────────────────────────────────────────

export type UseCheckInQrShellPropsInput = {
  // Layout / variant
  shellVariant: "qr" | "terminal"
  mainSpacingClass: string

  // Header
  shellEyebrow: string
  welcomeLabel: string
  showSignedInBootstrapPanel: boolean
  bootstrap: BootstrapResponse | null
  breadcrumbItems: string[]
  terminalName?: string
  terminalLocation?: string

  // Course card panel
  showCourseCardPanel: boolean
  showQrPanel: boolean
  checkInCardImage: string
  checkInDisplayCourse: { title: string } | null
  checkInCardCategory: string
  checkInCardBadge: string
  checkInCardDuration: string
  checkInCardStudents: string
  checkInCardDescription: string
  checkInCardTeacher: string
  checkInCardPriceLabel?: string
  checkInDisplayDate: string
  checkInDisplayTime: string
  checkInQrImage: string
  terminalPastClasses?: TerminalPastClass[]
  selectedTerminalPastClass?: { courseSlug: string; time: string } | null
  onTerminalPastClassSelect?: (selection: { courseSlug: string; time: string }) => void

  // Context / QR prompt
  showContextWarning: boolean

  // Late payment panel
  showLatePaymentOffer: boolean
  latePaymentCourse: CourseData | null
  latePaymentRecommendation: { date: string; time: string } | null
  latePaymentQrImage: string
  onLatePaymentTablet: () => void
  onLatePaymentPhone: () => void
  onLatePaymentExisting: () => void
  onLatePaymentNew: () => void

  // Entry selection
  hideEntrySelection: boolean
  mode: EntryMode
  isKioskTerminalFlow: boolean
  onExistingClick: (contextOverride?: { courseSlug: string; date: string; time: string }) => void
  onNewClick: (contextOverride?: { courseSlug: string; date: string; time: string }) => void

  // Kiosk PIN (phone-only)
  showKioskPinPanel: boolean
  returnedFromNewStudentFlow: boolean
  kioskPinPanelCopy: { title: string; description: string }
  hasKioskPinSession: boolean
  kioskPhone: string
  kioskPhoneLoading: boolean
  onKioskPhoneIdentify: () => void
  kioskPinAttemptsRemaining: number | null
  kioskPinThrottleSeverity: "normal" | "warning" | "cooldown" | "emergency" | null
  kioskPinBlockedUntil: string | null
  onPinDigitInput: (digit: string) => void
  onPinBackspace: () => void
  onPinClear: () => void
  onExistingCustomerDismiss: () => void
  visibleError: string | null
  success: string | null

  // Bootstrap panel
  loadingBootstrap: boolean
  bootstrapCourseImage: string
  bootstrapCardCategory: string
  bootstrapCardBadge: string
  bootstrapCardDuration: string
  bootstrapCardStudents: string
  bootstrapCardDescription: string
  bootstrapCardTeacher: string
  quickCheckoutDetails: QuickCheckoutDetails
  isLatePaymentContext: boolean
  hasFixedRecommendation: boolean | null
  effectiveCheckInWindowOpen: boolean
  processingPackageCheckIn: boolean
  onSwitchAccount: () => void
  onBootstrapAction: () => void
  onBackToCurrentClass: () => void

  // Overlays
  activeCourseHasUsablePackage: boolean
  bootstrapContact: { firstName?: string; lastName?: string; email?: string; phone?: string } | null
  completionMode: EnrollModalLike["completionMode"]
  consecutiveError: string | null
  consecutiveOffer: ConsecutiveOffer | null
  consecutiveProcessing: boolean
  consecutiveProcessingAction: "accept" | "decline" | "cash" | "card" | null
  consecutiveQrCheckout: KioskQrCheckoutState
  consecutiveSuccess: { courseTitle: string } | null
  existingRegularBookingContext: CheckInContext
  existingRegularBookingCourse: CourseData | null
  existingRegularBookingInitialStep: number
  existingRegularBookingKey: number
  existingRegularBookingOverride: (CheckInContext & { courseSlug?: string; date?: string; time?: string }) | null
  forceRedirectUrl: string
  hasActiveClerkSession: boolean
  kioskPinSessionToken: string
  newBookingContext: CheckInContext
  newBookingCourse: CourseData | null
  openNewBooking: boolean
  packageCheckInResult: PackageCheckInResult | null
  /** Terminal kiosk package check-in failure, if any. */
  packageCheckInFailure: PackageCheckInFailure | null
  /** True when the kiosk failure overlay should render instead of the resolving spinner. */
  showPackageCheckInFailureOverlay: boolean
  /** Completed kiosk auto-retry attempts. */
  packageCheckInAttempts: number
  onRetryPackageCheckIn: () => void
  photoFlowContext: EnrollModalLike["photoFlowContext"]
  showConsecutiveOverlay: boolean
  showConsecutivePaymentSelection: boolean
  showDuplicatePurchasePopup: boolean
  showKioskResolvingOverlay: boolean
  showPhoneSignIn: boolean
  pendingLoginPhone: string
  prefillSelection: EnrollModalLike["prefillSelection"]
  onConsecutiveAccept: () => void | Promise<void>
  onConsecutiveDecline: () => void | Promise<void>
  onConsecutiveErrorDismiss: () => void
  onConsecutivePayCard: () => void | Promise<void>
  onConsecutivePayCash: () => void | Promise<void>
  onConsecutiveQrCancel: () => void
  onConsecutiveQrRetry: () => void
  onConsecutiveRetry: () => void
  onConsecutiveSuccessDone: () => void
  onDuplicateDone: () => void
  onExistingBookingClose: () => void
  onExistingBookingCompleted: () => void | Promise<void>
  onExistingUserDetected: () => void
  onKioskSessionCreated: (sessionId: string) => void
  onNewBookingClose: () => void
  onNewBookingCompleted: () => void | Promise<void>
  onPackageSuccessDone: () => void
  onPaymentsStepReady: () => void
  onPhoneSignInClose: () => void
  onPhoneSignInSession: (sessionId: string) => Promise<void>
  onPhoneSignInSuccess: () => Promise<void>
  onStationCompletion: () => void | Promise<void>
  // Quick repeat overlay
  showQuickRepeat: boolean
  quickRepeatQrCheckout: KioskQrCheckoutState
  quickRepeatProcessing: boolean
  quickRepeatSuccess: boolean
  quickRepeatSuccessChannel: "cash" | "card" | null
  onQuickRepeatConfirm: (paymentChannel: "cash" | "card", consecutiveAccepted: boolean) => void | Promise<void>
  onQuickRepeatDecline: () => void
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Assembles all props for `<CheckInQrShell />` from the container's state and
 * handlers. The only computation performed here is the derivation of the three
 * display labels (`kioskPinBlockedUntilLabel`, `checkInWindowLabel`,
 * `packageExpiresLabel`) that require `toEsDateTime` formatting. Everything
 * else is passed through unchanged so behaviour is strictly preserved.
 */
export function useCheckInQrShellProps(input: UseCheckInQrShellPropsInput): CheckInQrShellProps {
  const {
    kioskPinBlockedUntil,
    kioskPinThrottleSeverity,
    bootstrap,
    ...rest
  } = input

  // ─── Label derivation (previously inline in CheckInQrClient render) ──────

  const kioskPinBlockedUntilLabel: string | null = kioskPinBlockedUntil
    ? kioskPinThrottleSeverity === "emergency"
      ? `This terminal is temporarily protected until ${toEsDateTime(kioskPinBlockedUntil)}.`
      : `Please wait until ${toEsDateTime(kioskPinBlockedUntil)} before trying this PIN again.`
    : null

  // Terminal check-in has no lower bound (see isTerminalCheckInAllowed), so
  // only the closing time is presented — showing an "opens at" time would
  // wrongly imply check-in is unavailable before it.
  const checkInWindowLabel: string = bootstrap
    ? `open until ${toEsDateTime(bootstrap.context.checkInWindow.closesAt)}`
    : ""

  const packageExpiresLabel: string | undefined = bootstrap?.package?.expiresAt
    ? toEsDateTime(bootstrap.package.expiresAt)
    : undefined

  // ─── Assembled shell props ────────────────────────────────────────────────

  return {
    ...rest,
    bootstrap,
    kioskPinThrottleSeverity,
    kioskPinBlockedUntilLabel,
    checkInWindowLabel,
    packageExpiresLabel,
  }
}
