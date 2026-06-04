import EnrollModal from "@/components/front/courses/EnrollModal"
import { toE164Phone } from "@/components/front/courses/utils/phone"
import {
  ConsecutiveClassOffer,
  ConsecutiveOfferError,
  ConsecutiveOfferSuccess,
} from "@/components/front/checkin/ConsecutiveClassOffer"
import {
  KioskDuplicatePurchaseOverlay,
  KioskPackageSuccessOverlay,
  KioskResolvingOverlay,
} from "@/components/front/checkin/KioskResolvingOverlay"
import { PhoneSignInModal } from "@/components/front/checkin/PhoneSignInModal"
import KioskQrPaymentPanel from "@/components/front/checkin/KioskQrPaymentPanel"
import type { CourseData } from "@/constants/courses"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { BootstrapResponse, ConsecutiveOffer } from "@/components/front/checkin/checkin.types"

type EnrollModalProps = Parameters<typeof EnrollModal>[0]
type CheckInContext = NonNullable<EnrollModalProps["checkInContext"]>
type PackageCheckInResult = { remainingCredits: number | null; points: number }

type CheckInQrOverlaysProps = {
  activeCourseHasUsablePackage: boolean
  bootstrap: BootstrapResponse | null
  bootstrapContact: { firstName?: string; lastName?: string; email?: string; phone?: string } | null
  completionMode: EnrollModalProps["completionMode"]
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
  existingRegularBookingOverride: (CheckInContext & { courseSlug?: string }) | null
  forceRedirectUrl: string
  hasActiveClerkSession: boolean
  isKioskTerminalFlow: boolean
  kioskPinSessionToken: string
  newBookingContext: CheckInContext
  newBookingCourse: CourseData | null
  openNewBooking: boolean
  packageCheckInResult: PackageCheckInResult | null
  photoFlowContext: EnrollModalProps["photoFlowContext"]
  showConsecutiveOverlay: boolean
  showConsecutivePaymentSelection: boolean
  showDuplicatePurchasePopup: boolean
  showKioskResolvingOverlay: boolean
  showPhoneSignIn: boolean
  pendingLoginPhone: string
  processingPackageCheckIn: boolean
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
  prefillSelection: EnrollModalProps["prefillSelection"]
}

export function CheckInQrOverlays({
  activeCourseHasUsablePackage,
  bootstrap,
  bootstrapContact,
  completionMode,
  consecutiveError,
  consecutiveOffer,
  consecutiveProcessing,
  consecutiveProcessingAction,
  consecutiveQrCheckout,
  consecutiveSuccess,
  existingRegularBookingContext,
  existingRegularBookingCourse,
  existingRegularBookingInitialStep,
  existingRegularBookingKey,
  existingRegularBookingOverride,
  forceRedirectUrl,
  hasActiveClerkSession,
  isKioskTerminalFlow,
  kioskPinSessionToken,
  newBookingContext,
  newBookingCourse,
  openNewBooking,
  packageCheckInResult,
  photoFlowContext,
  showConsecutiveOverlay,
  showConsecutivePaymentSelection,
  showDuplicatePurchasePopup,
  showKioskResolvingOverlay,
  showPhoneSignIn,
  pendingLoginPhone,
  processingPackageCheckIn,
  onConsecutiveAccept,
  onConsecutiveDecline,
  onConsecutiveErrorDismiss,
  onConsecutivePayCard,
  onConsecutivePayCash,
  onConsecutiveQrCancel,
  onConsecutiveQrRetry,
  onConsecutiveRetry,
  onConsecutiveSuccessDone,
  onDuplicateDone,
  onExistingBookingClose,
  onExistingBookingCompleted,
  onExistingUserDetected,
  onKioskSessionCreated,
  onNewBookingClose,
  onNewBookingCompleted,
  onPackageSuccessDone,
  onPaymentsStepReady,
  onPhoneSignInClose,
  onPhoneSignInSession,
  onPhoneSignInSuccess,
  onStationCompletion,
  prefillSelection,
}: CheckInQrOverlaysProps) {
  return (
    <>
      {(showDuplicatePurchasePopup || (bootstrap?.hasExistingPurchaseForSession && !showConsecutiveOverlay)) && (
        <KioskDuplicatePurchaseOverlay
          customerName={bootstrap?.customer?.firstName}
          courseTitle={bootstrap?.context?.courseTitle}
          remainingCredits={bootstrap?.package?.remainingCredits ?? null}
          hasConsecutiveOffer={Boolean(bootstrap?.consecutiveOffer || consecutiveOffer)}
          autoDoneMs={10_000}
          onDone={onDuplicateDone}
        />
      )}

      {newBookingCourse && (
        <EnrollModal
          course={newBookingCourse}
          open={openNewBooking}
          onCloseAction={onNewBookingClose}
          initialStep={0}
          flowVariant="checkin-new"
          completionMode={isKioskTerminalFlow ? "station" : completionMode}
          checkInContext={newBookingContext}
          photoFlowContext={photoFlowContext}
          kioskSessionToken={!hasActiveClerkSession && kioskPinSessionToken ? kioskPinSessionToken : undefined}
          useDraft={false}
          mode="modal"
          preventOutsideClose={isKioskTerminalFlow}
          onCompletedAction={isKioskTerminalFlow ? onNewBookingCompleted : undefined}
          onTimeoutAction={isKioskTerminalFlow ? onStationCompletion : undefined}
          onExistingUserDetected={isKioskTerminalFlow ? onExistingUserDetected : undefined}
          onKioskSessionCreated={isKioskTerminalFlow ? onKioskSessionCreated : undefined}
          consecutiveOffer={undefined}
          isPackageHolder={false}
        />
      )}

      {packageCheckInResult && (
        <KioskPackageSuccessOverlay
          remainingCredits={packageCheckInResult.remainingCredits}
          points={packageCheckInResult.points}
          onDone={onPackageSuccessDone}
        />
      )}

      {showKioskResolvingOverlay && !packageCheckInResult && !showDuplicatePurchasePopup && !bootstrap?.hasExistingPurchaseForSession && (
        <KioskResolvingOverlay message={processingPackageCheckIn ? "Checking you in…" : undefined} />
      )}

      {showConsecutiveOverlay && activeCourseHasUsablePackage && consecutiveOffer && !consecutiveSuccess && !consecutiveError && consecutiveQrCheckout.phase === "idle" && (
        <ConsecutiveClassOffer
          offer={consecutiveOffer}
          isPackageHolder={activeCourseHasUsablePackage}
          onAccept={onConsecutiveAccept}
          onDecline={onConsecutiveDecline}
          onPayCash={onConsecutivePayCash}
          onPayCard={onConsecutivePayCard}
          isProcessing={consecutiveProcessing}
          processingAction={consecutiveProcessingAction}
          showPaymentSelection={showConsecutivePaymentSelection}
        />
      )}

      {consecutiveSuccess && <ConsecutiveOfferSuccess courseTitle={consecutiveSuccess.courseTitle} onDone={onConsecutiveSuccessDone} />}

      {consecutiveError && consecutiveOffer && (
        <ConsecutiveOfferError error={consecutiveError} onRetry={onConsecutiveRetry} onDismiss={onConsecutiveErrorDismiss} />
      )}

      {consecutiveQrCheckout.phase !== "idle" && (
        <KioskQrPaymentPanel checkoutState={consecutiveQrCheckout} onCancel={onConsecutiveQrCancel} onRetry={onConsecutiveQrRetry} />
      )}

      {showPhoneSignIn && !hasActiveClerkSession && (
        <PhoneSignInModal
          redirectUrl={forceRedirectUrl}
          phoneNumber={toE164Phone(pendingLoginPhone)}
          useNumericKeypad={photoFlowContext === "kiosk_terminal"}
          onSessionCreated={onPhoneSignInSession}
          onSuccess={onPhoneSignInSuccess}
          onClose={onPhoneSignInClose}
        />
      )}

      {existingRegularBookingCourse && (
        <EnrollModal
          key={`existing-regular-${existingRegularBookingKey}-${existingRegularBookingOverride?.courseSlug || existingRegularBookingCourse.slug}-${existingRegularBookingOverride?.date || ""}-${existingRegularBookingOverride?.time || ""}`}
          course={existingRegularBookingCourse}
          open={Boolean(existingRegularBookingOverride)}
          onCloseAction={onExistingBookingClose}
          onPaymentsStepReadyAction={isKioskTerminalFlow ? onPaymentsStepReady : undefined}
          initialStep={existingRegularBookingInitialStep}
          prefillSelection={prefillSelection}
          flowVariant="checkin-existing"
          completionMode={isKioskTerminalFlow ? "station" : completionMode}
          checkInContext={existingRegularBookingContext}
          kioskSessionToken={!hasActiveClerkSession && kioskPinSessionToken ? kioskPinSessionToken : undefined}
          photoFlowContext={photoFlowContext}
          prefillHasAvatar={bootstrap?.customer.hasAvatar}
          useDraft={false}
          mode="modal"
          preventOutsideClose={isKioskTerminalFlow}
          onCompletedAction={isKioskTerminalFlow ? onExistingBookingCompleted : undefined}
          onTimeoutAction={isKioskTerminalFlow ? onStationCompletion : undefined}
          prefillContact={bootstrapContact || undefined}
          consecutiveOffer={undefined}
          isPackageHolder={activeCourseHasUsablePackage}
        />
      )}
    </>
  )
}
