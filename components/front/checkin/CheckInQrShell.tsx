import { CheckInHeader } from "@/components/front/checkin/CheckInHeader"
import { CourseCardPanel } from "@/components/front/checkin/CourseCardPanel"
import { QrPromptText, ContextWarning } from "@/components/front/checkin/CheckInQrPrompts"
import { LatePaymentPanel } from "@/components/front/checkin/LatePaymentPanel"
import { EntrySelectionButtons } from "@/components/front/checkin/EntrySelectionButtons"
import { KioskPinModal } from "@/components/front/checkin/KioskPinModal"
import { SignedInBootstrapPanel } from "@/components/front/checkin/SignedInBootstrapPanel"
import { InlineFeedback } from "@/components/front/checkin/InlineFeedback"
import { CheckInQrOverlays } from "@/components/front/checkin/CheckInQrOverlays"
import type { EntryMode, TerminalPastClass } from "@/components/front/checkin/checkin.types"
import type { ComponentProps } from "react"
import type { CourseData } from "@/constants/courses"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { KioskPinThrottleSeverity } from "@/lib/security/kiosk-pin-throttle"
import type { BootstrapResponse, ConsecutiveOffer } from "@/components/front/checkin/checkin.types"

type EnrollModalLike = {
  completionMode: ComponentProps<typeof CheckInQrOverlays>["completionMode"]
  photoFlowContext: ComponentProps<typeof CheckInQrOverlays>["photoFlowContext"]
  prefillSelection: ComponentProps<typeof CheckInQrOverlays>["prefillSelection"]
}

// ─── Sub-types shared with CheckInQrClient ──────────────────────────────────

type QuickCheckoutDetails = {
  serviceLabel?: string
  packageLabel?: string
  addonLabels?: string[]
} | null

/** Matches EnrollCheckInContext from EnrollModal */
type CheckInContext = {
  date?: string
  time?: string
  durationMinutes?: number
}

type PackageCheckInResult = { remainingCredits: number | null; points: number }

// ─── Shell props ─────────────────────────────────────────────────────────────

export type CheckInQrShellProps = {
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

  // Entry selection buttons
  hideEntrySelection: boolean
  mode: EntryMode
  isKioskTerminalFlow: boolean
  onExistingClick: (contextOverride?: { courseSlug: string; date: string; time: string }) => void
  onNewClick: (contextOverride?: { courseSlug: string; date: string; time: string }) => void

  // Kiosk PIN modal
  showKioskPinPanel: boolean
  returnedFromNewStudentFlow: boolean
  kioskPinPanelCopy: { title: string; description: string }
  hasKioskPinSession: boolean
  kioskPin: string
  entryRevealedIndex: number | null
  entryActiveSlot: number
  activePinField: "entry" | "next" | "confirm" | null
  kioskPinAttemptsRemaining: number | null
  kioskPinThrottleSeverity: KioskPinThrottleSeverity | null
  kioskPinBlockedUntilLabel: string | null
  canIdentify: boolean
  kioskPinLoading: boolean
  kioskPinNext: string
  nextRevealedIndex: number | null
  nextActiveSlot: number
  kioskPinConfirm: string
  confirmRevealedIndex: number | null
  confirmActiveSlot: number
  canRotate: boolean
  kioskPinRotating: boolean
  onKioskPinIdentify: () => void
  onKioskPinRotate: () => void
  onPinDigitInput: (digit: string) => void
  onPinBackspace: () => void
  onPinClear: () => void
  onExistingCustomerDismiss: () => void
  visibleError: string | null
  success: string | null

  // Signed-in bootstrap panel
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
  checkInWindowLabel: string
  packageExpiresLabel: string | undefined
  onSwitchAccount: () => void
  onBootstrapAction: () => void
  onBackToCurrentClass: () => void

  // Overlays (passed through)
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
  /** Includes courseSlug used by the key string; Overlays only reads date/time/durationMinutes */
  existingRegularBookingOverride: (CheckInContext & { courseSlug?: string; date?: string; time?: string }) | null
  forceRedirectUrl: string
  hasActiveClerkSession: boolean
  kioskPinSessionToken: string
  newBookingContext: CheckInContext
  newBookingCourse: CourseData | null
  openNewBooking: boolean
  packageCheckInResult: PackageCheckInResult | null
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
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CheckInQrShell({
  // Layout
  shellVariant,
  mainSpacingClass,

  // Header
  shellEyebrow,
  welcomeLabel,
  showSignedInBootstrapPanel,
  bootstrap,
  breadcrumbItems,
  terminalName,
  terminalLocation,

  // Course card
  showCourseCardPanel,
  showQrPanel,
  checkInCardImage,
  checkInDisplayCourse,
  checkInCardCategory,
  checkInCardBadge,
  checkInCardDuration,
  checkInCardStudents,
  checkInCardDescription,
  checkInCardTeacher,
  checkInDisplayDate,
  checkInDisplayTime,
  checkInQrImage,
  terminalPastClasses,
  selectedTerminalPastClass,
  onTerminalPastClassSelect,

  // Context warning
  showContextWarning,

  // Late payment
  showLatePaymentOffer,
  latePaymentCourse,
  latePaymentRecommendation,
  latePaymentQrImage,
  onLatePaymentTablet,
  onLatePaymentPhone,
  onLatePaymentExisting,
  onLatePaymentNew,

  // Entry selection
  hideEntrySelection,
  mode,
  isKioskTerminalFlow,
  onExistingClick,
  onNewClick,

  // Kiosk PIN
  showKioskPinPanel,
  returnedFromNewStudentFlow,
  kioskPinPanelCopy,
  hasKioskPinSession,
  kioskPin,
  entryRevealedIndex,
  entryActiveSlot,
  activePinField,
  kioskPinAttemptsRemaining,
  kioskPinThrottleSeverity,
  kioskPinBlockedUntilLabel,
  canIdentify,
  kioskPinLoading,
  kioskPinNext,
  nextRevealedIndex,
  nextActiveSlot,
  kioskPinConfirm,
  confirmRevealedIndex,
  confirmActiveSlot,
  canRotate,
  kioskPinRotating,
  onKioskPinIdentify,
  onKioskPinRotate,
  onPinDigitInput,
  onPinBackspace,
  onPinClear,
  onExistingCustomerDismiss,
  visibleError,
  success,

  // Bootstrap panel
  loadingBootstrap,
  bootstrapCourseImage,
  bootstrapCardCategory,
  bootstrapCardBadge,
  bootstrapCardDuration,
  bootstrapCardStudents,
  bootstrapCardDescription,
  bootstrapCardTeacher,
  quickCheckoutDetails,
  isLatePaymentContext,
  hasFixedRecommendation,
  effectiveCheckInWindowOpen,
  processingPackageCheckIn,
  checkInWindowLabel,
  packageExpiresLabel,
  onSwitchAccount,
  onBootstrapAction,
  onBackToCurrentClass,

  // Overlays
  activeCourseHasUsablePackage,
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
  prefillSelection,
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
}: CheckInQrShellProps) {
  const isTerminal = shellVariant === "terminal"

  const entrySelectionButtons = !hideEntrySelection ? (
    <EntrySelectionButtons
      mode={mode}
      isKioskTerminalFlow={isKioskTerminalFlow}
      onExisting={onExistingClick}
      onNew={onNewClick}
      variant={showCourseCardPanel && showQrPanel ? "embedded" : "standalone"}
    />
  ) : null
  const hasEmbeddedEntrySelection = Boolean(entrySelectionButtons && showCourseCardPanel && showQrPanel)

  return (
    <main className={`relative ${isTerminal ? "h-dvh" : "min-h-screen"} overflow-hidden bg-[#13141d] px-3 ${mainSpacingClass} sm:px-4`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
      <div className="relative mx-auto w-full max-w-[68rem]">
        <section className={`flex flex-col ${isTerminal ? "flex-1 min-h-0" : "min-h-[60rem] rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.26),transparent_55%),linear-gradient(145deg,rgba(15,19,35,0.97),rgba(20,25,45,0.97))] p-4 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.6)] backdrop-blur sm:p-6"}`}>
          <CheckInHeader
            variant={shellVariant === "terminal" ? "terminal" : "personal"}
            eyebrow={shellEyebrow}
            welcomeLabel={welcomeLabel}
            showWelcome={showSignedInBootstrapPanel && Boolean(bootstrap)}
            breadcrumbItems={breadcrumbItems}
            terminalName={terminalName}
            terminalLocation={terminalLocation}
          />

          <div className={`${isTerminal ? "mt-8 min-h-0 overflow-hidden" : "mt-6"} flex flex-1 flex-col justify-center`}>
            {showCourseCardPanel && showQrPanel && (
              <CourseCardPanel
                cardImage={checkInCardImage}
                courseTitle={checkInDisplayCourse?.title || "Current course"}
                category={checkInCardCategory}
                badge={checkInCardBadge}
                duration={checkInCardDuration}
                students={checkInCardStudents}
                description={checkInCardDescription}
                teacher={checkInCardTeacher}
                displayDate={checkInDisplayDate}
                displayTime={checkInDisplayTime}
                qrImage={checkInQrImage}
                terminalPastClasses={terminalPastClasses}
                selectedTerminalPastClass={selectedTerminalPastClass}
                onTerminalPastClassSelect={onTerminalPastClassSelect}
                onExistingClick={onExistingClick}
                onNewClick={onNewClick}
                compact={isTerminal}
                actionSlot={hasEmbeddedEntrySelection ? entrySelectionButtons : undefined}
              />
            )}
            {showCourseCardPanel && !showQrPanel && !isTerminal && (
              <CourseCardPanel
                cardImage={checkInCardImage}
                courseTitle={checkInDisplayCourse?.title || "Current course"}
                category={checkInCardCategory}
                badge={checkInCardBadge}
                duration={checkInCardDuration}
                students={checkInCardStudents}
                description={checkInCardDescription}
                teacher={checkInCardTeacher}
                displayDate={checkInDisplayDate}
                displayTime={checkInDisplayTime}
                compact={isTerminal}
              />
            )}
            {showQrPanel && !hasEmbeddedEntrySelection && (
              <QrPromptText variant={shellVariant === "terminal" ? "terminal" : "personal"} />
            )}

            {showContextWarning && <ContextWarning />}

            {showLatePaymentOffer && !terminalPastClasses?.length && (
              <LatePaymentPanel
                courseTitle={latePaymentCourse?.title || "Previous class"}
                date={latePaymentRecommendation?.date || ""}
                time={latePaymentRecommendation?.time || ""}
                qrImage={latePaymentQrImage}
                onUseTablet={onLatePaymentTablet}
                onOpenPhone={onLatePaymentPhone}
                onExistingCustomer={onLatePaymentExisting}
                onNewCustomer={onLatePaymentNew}
              />
            )}

            {!hasEmbeddedEntrySelection && entrySelectionButtons}

            {showKioskPinPanel && (
              <KioskPinModal
                title={returnedFromNewStudentFlow ? "Welcome back!" : kioskPinPanelCopy.title}
                description={returnedFromNewStudentFlow ? "You\u0027re already a registered customer. Enter your PIN to continue with regular pricing." : kioskPinPanelCopy.description}
                onClose={onExistingCustomerDismiss}
                hasSession={hasKioskPinSession}
                entryPin={kioskPin}
                entryRevealedIndex={entryRevealedIndex}
                entryActiveSlot={entryActiveSlot}
                isEntryActive={activePinField === "entry"}
                attemptsRemaining={kioskPinAttemptsRemaining}
                throttleSeverity={kioskPinThrottleSeverity}
                blockedUntilLabel={kioskPinBlockedUntilLabel}
                onIdentify={onKioskPinIdentify}
                canIdentify={canIdentify}
                isIdentifying={kioskPinLoading}
                nextPin={kioskPinNext}
                nextRevealedIndex={nextRevealedIndex}
                nextActiveSlot={nextActiveSlot}
                isNextActive={activePinField === "next"}
                confirmPin={kioskPinConfirm}
                confirmRevealedIndex={confirmRevealedIndex}
                confirmActiveSlot={confirmActiveSlot}
                isConfirmActive={activePinField === "confirm"}
                onRotate={onKioskPinRotate}
                canRotate={canRotate}
                isRotating={kioskPinRotating}
                onDigit={onPinDigitInput}
                onBackspace={onPinBackspace}
                onClear={onPinClear}
                isKeypadDisabled={hasKioskPinSession ? kioskPinRotating : kioskPinLoading}
                visibleError={visibleError}
                success={success}
              />
            )}

            {showSignedInBootstrapPanel && (
              <SignedInBootstrapPanel
                loading={loadingBootstrap}
                bootstrap={bootstrap}
                courseImage={bootstrapCourseImage}
                cardCategory={bootstrapCardCategory}
                cardBadge={bootstrapCardBadge}
                cardDuration={bootstrapCardDuration}
                cardStudents={bootstrapCardStudents}
                cardDescription={bootstrapCardDescription}
                cardTeacher={bootstrapCardTeacher}
                quickCheckoutDetails={quickCheckoutDetails}
                isLatePaymentContext={isLatePaymentContext}
                hasFixedRecommendation={hasFixedRecommendation}
                checkInWindowOpen={effectiveCheckInWindowOpen}
                processingPackageCheckIn={processingPackageCheckIn}
                checkInWindowLabel={checkInWindowLabel}
                packageExpiresLabel={packageExpiresLabel}
                onSwitchAccount={onSwitchAccount}
                onAction={onBootstrapAction}
                onBackToCurrentClass={onBackToCurrentClass}
              />
            )}

            <InlineFeedback error={visibleError} success={success} />
          </div>
        </section>
      </div>

      <CheckInQrOverlays
        activeCourseHasUsablePackage={activeCourseHasUsablePackage}
        bootstrap={bootstrap}
        bootstrapContact={bootstrapContact}
        completionMode={completionMode}
        consecutiveError={consecutiveError}
        consecutiveOffer={consecutiveOffer}
        consecutiveProcessing={consecutiveProcessing}
        consecutiveProcessingAction={consecutiveProcessingAction}
        consecutiveQrCheckout={consecutiveQrCheckout}
        consecutiveSuccess={consecutiveSuccess}
        existingRegularBookingContext={existingRegularBookingContext}
        existingRegularBookingCourse={existingRegularBookingCourse}
        existingRegularBookingInitialStep={existingRegularBookingInitialStep}
        existingRegularBookingKey={existingRegularBookingKey}
        existingRegularBookingOverride={existingRegularBookingOverride}
        forceRedirectUrl={forceRedirectUrl}
        hasActiveClerkSession={hasActiveClerkSession}
        isKioskTerminalFlow={isKioskTerminalFlow}
        kioskPinSessionToken={kioskPinSessionToken}
        newBookingContext={newBookingContext}
        newBookingCourse={newBookingCourse}
        openNewBooking={openNewBooking}
        packageCheckInResult={packageCheckInResult}
        photoFlowContext={photoFlowContext}
        showConsecutiveOverlay={showConsecutiveOverlay}
        showConsecutivePaymentSelection={showConsecutivePaymentSelection}
        showDuplicatePurchasePopup={showDuplicatePurchasePopup}
        showKioskResolvingOverlay={showKioskResolvingOverlay}
        showPhoneSignIn={showPhoneSignIn}
        pendingLoginPhone={pendingLoginPhone}
        processingPackageCheckIn={processingPackageCheckIn}
        onConsecutiveAccept={onConsecutiveAccept}
        onConsecutiveDecline={onConsecutiveDecline}
        onConsecutiveErrorDismiss={onConsecutiveErrorDismiss}
        onConsecutivePayCard={onConsecutivePayCard}
        onConsecutivePayCash={onConsecutivePayCash}
        onConsecutiveQrCancel={onConsecutiveQrCancel}
        onConsecutiveQrRetry={onConsecutiveQrRetry}
        onConsecutiveRetry={onConsecutiveRetry}
        onConsecutiveSuccessDone={onConsecutiveSuccessDone}
        onDuplicateDone={onDuplicateDone}
        onExistingBookingClose={onExistingBookingClose}
        onExistingBookingCompleted={onExistingBookingCompleted}
        onExistingUserDetected={onExistingUserDetected}
        onKioskSessionCreated={onKioskSessionCreated}
        onNewBookingClose={onNewBookingClose}
        onNewBookingCompleted={onNewBookingCompleted}
        onPackageSuccessDone={onPackageSuccessDone}
        onPaymentsStepReady={onPaymentsStepReady}
        onPhoneSignInClose={onPhoneSignInClose}
        onPhoneSignInSession={onPhoneSignInSession}
        onPhoneSignInSuccess={onPhoneSignInSuccess}
        onStationCompletion={onStationCompletion}
        prefillSelection={prefillSelection}
      />
    </main>
  )
}
