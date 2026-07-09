"use client"
import React from "react"
import Link from "next/link"
import { initialKioskInfoPhase, type KioskInfoPhase } from "@/components/front/courses/enroll/model/kiosk-info-phase"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { I18nKey } from "@/lib/i18n-dict"

type Props = {
  step: number
  steps: Array<{ key: string; label: string }>
  activeStepKey: string
  isInline: boolean
  allowPanelAccess: boolean
  usesPhasedInfoForm: boolean
  kioskInfoPhase: KioskInfoPhase
  kioskQrCheckoutLocked: boolean
  kioskQrCheckout: KioskQrCheckoutState
  isKioskTerminalFlow: boolean
  paymentMethod: string
  processing: boolean
  identityCheckBusy: boolean
  consecutiveOfferLoading: boolean
  canContinueCurrentStep: boolean
  handleClose: () => void
  handleSubmit: () => void
  resetKioskQrCheckout: () => void
  setStep: (value: React.SetStateAction<number>) => void
  setKioskInfoPhase: (value: React.SetStateAction<KioskInfoPhase>) => void
  setActiveNumericField: (value: React.SetStateAction<"phone" | null>) => void
  t: (key: I18nKey) => string
}

export default function EnrollFormFooter({
  step, steps, activeStepKey, isInline, allowPanelAccess, usesPhasedInfoForm, kioskInfoPhase,
  kioskQrCheckoutLocked, kioskQrCheckout, isKioskTerminalFlow, paymentMethod, processing,
  identityCheckBusy, consecutiveOfferLoading, canContinueCurrentStep,
  handleClose, handleSubmit, resetKioskQrCheckout, setStep, setKioskInfoPhase, setActiveNumericField, t,
}: Props) {
  const initialPhase = initialKioskInfoPhase({ phoneFirst: isKioskTerminalFlow })
  return (
    <div className={isInline ? "flex flex-col gap-2 pt-2" : "flex items-center justify-between pt-2"}>
      <button
        type="button"
        onClick={handleClose}
        className={isInline ? "w-full px-4 py-2 rounded-md border border-black/10 dark:border-white/10" : "px-4 py-2 rounded-md border border-black/10 dark:border-white/10"}
      >
        {t("cancel")}
      </button>
      <div className={isInline ? `grid w-full ${allowPanelAccess ? "grid-cols-3" : "grid-cols-2"} gap-2` : "flex gap-2"}>
        {allowPanelAccess && (
          <Link href="/client-profile" className="px-4 py-2 rounded-md border border-black/10 dark:border-white/10 hidden sm:inline">{t("myPanel")}</Link>
        )}
        {!(usesPhasedInfoForm && step === 0 && kioskInfoPhase === initialPhase) && (
          <button
            type="button"
            onClick={() => {
              if (kioskQrCheckoutLocked) { resetKioskQrCheckout(); return }
              if (usesPhasedInfoForm && step === 0 && kioskInfoPhase !== initialPhase) {
                setKioskInfoPhase(initialPhase)
                if (isKioskTerminalFlow) setActiveNumericField("phone")
                else setActiveNumericField(null)
                return
              }
              if (step === 0) { handleClose(); return }
              setStep((s) => s - 1)
            }}
            className={isInline ? "px-3 py-2 rounded-md border border-black/10 dark:border-white/10 text-sm" : "px-4 py-2 rounded-md border border-black/10 dark:border-white/10"}
          >
            {kioskQrCheckoutLocked
              ? "Cancel QR"
              : usesPhasedInfoForm && step === 0 && kioskInfoPhase !== initialPhase
                ? "Back"
                : step === 0 ? t("cancel") : t("back")}
          </button>
        )}
        {step < steps.length - 1 ? (
          <button
            type="submit"
            disabled={!canContinueCurrentStep || identityCheckBusy}
            className={isInline ? "px-3 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50 text-sm" : "px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50"}
          >
            {identityCheckBusy
              ? t("verifyingAccount")
              : consecutiveOfferLoading && (activeStepKey === "datetime" || activeStepKey === "payments")
                ? "Checking promotions..."
                : t("continue")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canContinueCurrentStep || processing || identityCheckBusy || kioskQrCheckoutLocked}
            className={isInline ? "px-3 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50 text-sm" : "px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50"}
          >
            {processing
              ? "Processing..."
              : consecutiveOfferLoading && activeStepKey === "payments"
                ? "Checking promotions..."
                : isKioskTerminalFlow && paymentMethod === "stripe"
                  ? kioskQrCheckout.phase === "expired" || kioskQrCheckout.phase === "error"
                    ? "Create new QR"
                    : "Show QR"
                  : t("confirm")}
          </button>
        )}
      </div>
    </div>
  )
}
