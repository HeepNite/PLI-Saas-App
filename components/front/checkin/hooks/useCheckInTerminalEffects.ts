import React from "react"
import {
  shouldSurfaceClosedWindowPackageError,
  shouldAutoOpenExistingPurchase,
  shouldAutoTriggerPackageCheckIn,
  shouldShowConsecutiveOfferGate,
  shouldPreserveOfferOnBootstrapClear,
  shouldAutoPromoteExistingMode,
} from "@/lib/checkin/existing-customer-flow"
import { TRANSIENT_MESSAGE_TIMEOUT_MS } from "@/lib/checkin/checkin-helpers"
import { hasTerminalSensitiveCustomerState } from "@/lib/checkin/terminal-sensitive-state"
import { createKioskInactivityController } from "@/lib/checkin/kiosk-inactivity"
import type { EntryMode, BootstrapResponse, PackageOfferContext, ConsecutiveOffer } from "@/components/front/checkin/checkin.types"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { PackageCheckInResult } from "@/components/front/checkin/hooks/useCheckInPackageFlow"

// ─── Input type ──────────────────────────────────────────────

export type UseCheckInTerminalEffectsInput = {
  // Bootstrap / session
  bootstrap: BootstrapResponse | null
  loadingBootstrap: boolean
  isLoaded: boolean
  hasActiveClerkSession: boolean
  kioskPinSessionToken: string | null
  hasKioskPinSession: boolean
  loadBootstrap: () => Promise<void>

  // Mode
  mode: EntryMode
  setMode: (mode: EntryMode) => void
  entryMode: string | null
  isKioskTerminalFlow: boolean

  // Clock / env
  setInternalNowTick: (d: Date) => void
  setOrigin: (origin: string) => void
  setIsCompactViewport: (compact: boolean) => void

  // Phone sign-in
  showPhoneSignIn: boolean
  setShowPhoneSignIn: (v: boolean) => void

  // Package offer
  packageOfferContext: PackageOfferContext
  setPackageOfferContext: (ctx: PackageOfferContext) => void
  setPackageOfferSelectedId: (id: string | null) => void

  // Booking state
  openNewBooking: boolean
  existingRegularBookingOverride: { courseSlug: string; date: string; time: string } | null
  newBookingOverride: { courseSlug: string; date: string; time: string } | null

  // Package check-in
  processingPackageCheckIn: boolean
  packageCheckInResult: PackageCheckInResult | null
  hasUsablePackageForCurrentClass: boolean
  effectiveCheckInWindowOpen: boolean
  handlePackageCheckIn: () => Promise<void>

  // Consecutive offer
  consecutiveOffer: ConsecutiveOffer | null
  consecutiveOfferSettled: boolean
  showConsecutiveOverlay: boolean
  setShowConsecutiveOverlay: (v: boolean) => void
  showConsecutivePaymentSelection: boolean
  setShowConsecutivePaymentSelection: (v: boolean) => void
  awaitingConsecutivePaymentSelection: boolean
  consecutiveQrCheckout: KioskQrCheckoutState
  consecutiveSuccess: { courseTitle: string } | null
  consecutiveError: string | null

  // Existing purchase flow
  openExistingPurchaseFlow: (args: { courseSlug: string; date: string; time: string }) => void
  setShowDuplicatePurchasePopup: (v: boolean) => void

  // Transient feedback
  error: string | null
  success: string | null
  setError: (e: string | null) => void
  setSuccess: (s: string | null) => void
  showKioskPinPanel: boolean

  // Kiosk sensitive-state / inactivity
  pendingLoginPhone: string
  showDuplicatePurchasePopup: boolean
  kioskPinSessionActive: boolean   // alias: hasKioskPinSession
  handleStationCompletion: () => void | Promise<void>
  onFlowActiveChange?: (active: boolean) => void
}

// ─── Hook ────────────────────────────────────────────────────

export function useCheckInTerminalEffects(input: UseCheckInTerminalEffectsInput): void {
  const {
    bootstrap,
    loadingBootstrap,
    isLoaded,
    hasActiveClerkSession,
    kioskPinSessionToken,
    hasKioskPinSession,
    loadBootstrap,
    mode,
    setMode,
    entryMode,
    isKioskTerminalFlow,
    setInternalNowTick,
    setOrigin,
    setIsCompactViewport,
    showPhoneSignIn,
    setShowPhoneSignIn,
    packageOfferContext,
    setPackageOfferContext,
    setPackageOfferSelectedId,
    openNewBooking,
    existingRegularBookingOverride,
    newBookingOverride,
    processingPackageCheckIn,
    packageCheckInResult,
    hasUsablePackageForCurrentClass,
    effectiveCheckInWindowOpen,
    handlePackageCheckIn,
    consecutiveOffer,
    consecutiveOfferSettled,
    showConsecutiveOverlay,
    setShowConsecutiveOverlay,
    showConsecutivePaymentSelection,
    setShowConsecutivePaymentSelection,
    awaitingConsecutivePaymentSelection,
    consecutiveQrCheckout,
    consecutiveSuccess,
    consecutiveError,
    openExistingPurchaseFlow,
    setShowDuplicatePurchasePopup,
    error,
    success,
    setError,
    setSuccess,
    showKioskPinPanel,
    pendingLoginPhone,
    showDuplicatePurchasePopup,
    handleStationCompletion,
    onFlowActiveChange,
  } = input

  // ── Clear package offer when bootstrap disappears ───────────
  React.useEffect(() => {
    if (!bootstrap && packageOfferContext) {
      // Scenario 3 (new-user-upsell): offer is set AFTER first purchase completes,
      // when bootstrap may be null. Don't clear it.
      if (!shouldPreserveOfferOnBootstrapClear(packageOfferContext.scenario)) {
        setPackageOfferContext(null)
        setPackageOfferSelectedId(null)
      }
    }
  }, [bootstrap, packageOfferContext, setPackageOfferContext, setPackageOfferSelectedId])

  // ── Existing-mode bootstrap load ────────────────────────────
  React.useEffect(() => {
    if (mode !== "existing") return
    if (!isLoaded) return
    if (!hasActiveClerkSession && !kioskPinSessionToken) return
    void loadBootstrap()
  }, [hasActiveClerkSession, isLoaded, kioskPinSessionToken, loadBootstrap, mode])

  // ── Auto-promote to existing mode ───────────────────────────
  React.useEffect(() => {
    if (
      shouldAutoPromoteExistingMode({
        entryMode,
        mode,
        hasActiveClerkSession,
        isKioskTerminalFlow,
      })
    ) {
      setMode("existing")
    }
  }, [entryMode, hasActiveClerkSession, isKioskTerminalFlow, mode, setMode])

  // ── Close phone sign-in when Clerk session appears ──────────
  React.useEffect(() => {
    if (!hasActiveClerkSession) return
    if (showPhoneSignIn) {
      setShowPhoneSignIn(false)
    }
  }, [hasActiveClerkSession, showPhoneSignIn, setShowPhoneSignIn])

  // ── Clock interval (30-second tick) ─────────────────────────
  React.useEffect(() => {
    const intervalId = window.setInterval(() => setInternalNowTick(new Date()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [setInternalNowTick])

  // ── Origin sync ──────────────────────────────────────────────
  React.useEffect(() => {
    if (typeof window === "undefined") return
    setOrigin(window.location.origin)
  }, [setOrigin])

  // ── Compact viewport media query ─────────────────────────────
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const media = window.matchMedia("(max-width: 1023px)")
    const syncViewport = () => setIsCompactViewport(media.matches)
    syncViewport()
    media.addEventListener("change", syncViewport)
    return () => media.removeEventListener("change", syncViewport)
  }, [setIsCompactViewport])

  // ── Duplicate purchase / auto-open existing purchase flow ────
  React.useEffect(() => {
    if (!isKioskTerminalFlow) return
    if (!bootstrap) return

    // Check for duplicate purchase BEFORE opening the flow
    if (bootstrap.hasExistingPurchaseForSession) {
      if (
        showConsecutiveOverlay ||
        showConsecutivePaymentSelection ||
        Boolean(consecutiveOffer) ||
        Boolean(packageCheckInResult) ||
        consecutiveQrCheckout.phase !== "idle"
      ) {
        return
      }
      setShowDuplicatePurchasePopup(true)
      return
    }

    // Package offer screen removed - packages step is now in EnrollModal
    if (
      !shouldAutoOpenExistingPurchase({
        mode,
        hasBootstrap: true,
        isSignedIn: hasActiveClerkSession,
        hasKioskPinSession,
        loadingBootstrap,
        hasExistingRegularBookingOverride: Boolean(existingRegularBookingOverride),
        openNewBooking,
        processingPackageCheckIn,
        hasPackage: Boolean(bootstrap.package),
      })
    ) {
      return
    }

    // Go directly to existing purchase flow - packages step is now integrated there
    openExistingPurchaseFlow({
      courseSlug: bootstrap.context.courseSlug,
      date: bootstrap.context.date,
      time: bootstrap.context.time,
    })
  }, [
    bootstrap,
    consecutiveOffer,
    consecutiveOfferSettled,
    consecutiveQrCheckout.phase,
    existingRegularBookingOverride,
    hasActiveClerkSession,
    hasKioskPinSession,
    isKioskTerminalFlow,
    loadingBootstrap,
    mode,
    openExistingPurchaseFlow,
    openNewBooking,
    packageCheckInResult,
    processingPackageCheckIn,
    setShowDuplicatePurchasePopup,
    showConsecutiveOverlay,
    showConsecutivePaymentSelection,
    hasUsablePackageForCurrentClass,
  ])

  // ── Kiosk package auto-check-in ──────────────────────────────
  // Auto-trigger package check-in on kiosk: PIN identify → bootstrap with package → deduct immediately
  // GATED: when a consecutive offer exists and is settled, show offer first instead of auto-checking-in
  React.useEffect(() => {
    if (
      !shouldAutoTriggerPackageCheckIn({
        isKioskTerminalFlow,
        mode,
        hasPackage: hasUsablePackageForCurrentClass,
        processingPackageCheckIn,
        hasPackageCheckInResult: Boolean(packageCheckInResult),
        hasExistingPurchaseForSession: Boolean(bootstrap?.hasExistingPurchaseForSession),
        effectiveCheckInWindowOpen,
        hasActiveSession: hasActiveClerkSession || hasKioskPinSession,
        hasConsecutiveOffer: Boolean(consecutiveOffer),
        consecutiveOfferSettled,
      })
    ) {
      // Gate returned false — distinguish: settled offer (show overlay) vs wait/other reasons
      // Only show overlay for PACKAGE HOLDERS — non-package users go through EnrollModal which has consecutive step
      if (shouldShowConsecutiveOfferGate({
        hasConsecutiveOffer: Boolean(consecutiveOffer),
        consecutiveOfferSettled,
        hasPackageCheckInResult: Boolean(packageCheckInResult),
        mode,
        hasBootstrap: Boolean(bootstrap),
        hasPackage: hasUsablePackageForCurrentClass,
        showConsecutivePaymentSelection,
        awaitingConsecutivePaymentSelection,
        isConsecutiveQrCheckoutIdle: consecutiveQrCheckout.phase === "idle",
        hasConsecutiveSuccess: Boolean(consecutiveSuccess),
        hasConsecutiveError: Boolean(consecutiveError),
      })) {
        setShowConsecutivePaymentSelection(false)
        setShowConsecutiveOverlay(true)
      }
      return
    }
    void handlePackageCheckIn()
  }, [
    bootstrap,
    consecutiveOffer,
    consecutiveError,
    consecutiveOfferSettled,
    consecutiveQrCheckout.phase,
    consecutiveSuccess,
    effectiveCheckInWindowOpen,
    handlePackageCheckIn,
    hasActiveClerkSession,
    hasKioskPinSession,
    isKioskTerminalFlow,
    mode,
    awaitingConsecutivePaymentSelection,
    packageCheckInResult,
    processingPackageCheckIn,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
    showConsecutivePaymentSelection,
    hasUsablePackageForCurrentClass,
  ])

  // ── Closed-window package error ──────────────────────────────
  React.useEffect(() => {
    if (
      !shouldSurfaceClosedWindowPackageError({
        isKioskTerminalFlow,
        mode,
        hasBootstrap: Boolean(bootstrap),
        hasPackage: hasUsablePackageForCurrentClass,
        effectiveCheckInWindowOpen,
        processingPackageCheckIn,
        hasPackageCheckInResult: Boolean(packageCheckInResult),
        hasExistingRegularBookingOverride: Boolean(existingRegularBookingOverride),
      })
    ) {
      return
    }

    setError("The check-in window for this class is closed.")
  }, [
    bootstrap,
    effectiveCheckInWindowOpen,
    existingRegularBookingOverride,
    hasUsablePackageForCurrentClass,
    isKioskTerminalFlow,
    mode,
    packageCheckInResult,
    processingPackageCheckIn,
    setError,
  ])

  // ── Transient feedback timeout ───────────────────────────────
  React.useEffect(() => {
    if (showKioskPinPanel) return
    if (!error && !success) return
    const timeoutId = window.setTimeout(() => {
      setError(null)
      setSuccess(null)
    }, TRANSIENT_MESSAGE_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [error, setError, setSuccess, showKioskPinPanel, success])

  // ── Terminal sensitive-state / inactivity guard ──────────────
  React.useEffect(() => {
    if (typeof window === "undefined") return

    const hasSensitiveState = hasTerminalSensitiveCustomerState({
      isKioskTerminalFlow,
      mode,
      bootstrapOpen: Boolean(bootstrap),
      newBookingOpen: openNewBooking || Boolean(newBookingOverride),
      existingBookingOpen: Boolean(existingRegularBookingOverride),
      phoneSignInOpen: showPhoneSignIn,
      packageOfferOpen: Boolean(packageOfferContext),
      duplicatePurchaseOpen: showDuplicatePurchasePopup || Boolean(bootstrap?.hasExistingPurchaseForSession),
      packageSuccessOpen: Boolean(packageCheckInResult),
      kioskPinOpen: showKioskPinPanel,
      kioskPinSessionActive: hasKioskPinSession,
      pendingLoginPhone: Boolean(pendingLoginPhone),
      consecutiveOfferOpen: Boolean(showConsecutiveOverlay && consecutiveOffer),
      consecutiveSuccessOpen: Boolean(consecutiveSuccess),
      consecutiveErrorOpen: Boolean(consecutiveError),
      qrCheckoutOpen: consecutiveQrCheckout.phase !== "idle",
    })

    // Notify parent (StaffTerminalShell) about flow active state for rotation guard
    onFlowActiveChange?.(hasSensitiveState)

    if (!hasSensitiveState) return

    const controller = createKioskInactivityController({
      onTimeout: () => {
        void handleStationCompletion()
      },
    })
    const handleActivity = () => controller.arm()
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"]

    controller.arm()
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleActivity, { passive: true })
    }

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleActivity)
      }
      controller.dispose()
    }
  }, [
    bootstrap,
    consecutiveError,
    consecutiveOffer,
    consecutiveQrCheckout.phase,
    consecutiveSuccess,
    existingRegularBookingOverride,
    handleStationCompletion,
    hasKioskPinSession,
    isKioskTerminalFlow,
    mode,
    newBookingOverride,
    onFlowActiveChange,
    openNewBooking,
    packageCheckInResult,
    packageOfferContext,
    showConsecutiveOverlay,
    pendingLoginPhone,
    showDuplicatePurchasePopup,
    showKioskPinPanel,
    showPhoneSignIn,
  ])
}
