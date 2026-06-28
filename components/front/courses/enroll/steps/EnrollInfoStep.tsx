import * as React from "react"
import { AnimatePresence, motion, type Variants } from "framer-motion"

import KioskNumericKeypad from "@/components/front/checkin/KioskNumericKeypad"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { I18nKey } from "@/lib/i18n-dict"
import { PHONE_INPUT_ATTRIBUTES } from "@/lib/checkin/sign-in-inputs"

import type { KioskInfoPhase } from "../model/kiosk-info-phase"
import { formatUSPhone, formatUSPhoneOnChange, isCompleteUSPhone } from "../../utils/phone"

type ActiveNumericField = "phone" | null

type EnrollInfoStepProps = {
  activeNumericField: ActiveNumericField
  contact: EnrollmentContact
  handleNumpadBackspace: () => void
  handleNumpadClear: () => void
  handleNumpadDigit: (digit: string) => void
  isCheckInFlow: boolean
  isKioskTerminalFlow: boolean
  kioskInfoPhase: KioskInfoPhase
  phoneTouched: boolean
  service: string
  setActiveNumericField: React.Dispatch<React.SetStateAction<ActiveNumericField>>
  setContact: React.Dispatch<React.SetStateAction<EnrollmentContact>>
  setExistingAccountDetected: React.Dispatch<React.SetStateAction<boolean>>
  setPendingAutoPay: React.Dispatch<React.SetStateAction<boolean>>
  setPhoneTouched: React.Dispatch<React.SetStateAction<boolean>>
  setRequiresSignIn: React.Dispatch<React.SetStateAction<boolean>>
  setResumeAfterSignInStep: React.Dispatch<React.SetStateAction<number | null>>
  setKioskInfoPhase: React.Dispatch<React.SetStateAction<KioskInfoPhase>>
  shouldMaskKioskInfoContent: boolean
  t: (key: I18nKey) => string
  usesPhasedInfoForm?: boolean
}

const phaseVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.18, ease: "easeIn" } },
}

const pillVariants: Variants = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, x: -8, transition: { duration: 0.15 } },
}

export default function EnrollInfoStep({
  activeNumericField,
  contact,
  handleNumpadBackspace,
  handleNumpadClear,
  handleNumpadDigit,
  isCheckInFlow,
  isKioskTerminalFlow,
  kioskInfoPhase,
  phoneTouched,
  service: _service,
  setActiveNumericField,
  setContact,
  setExistingAccountDetected,
  setPendingAutoPay,
  setPhoneTouched,
  setRequiresSignIn,
  setResumeAfterSignInStep,
  setKioskInfoPhase,
  shouldMaskKioskInfoContent,
  t,
  usesPhasedInfoForm = false,
}: EnrollInfoStepProps) {
  const phoneComplete = isCompleteUSPhone(contact.phone)

  // For phone-first kiosk flow: initial phase is "phone", second phase is "name-email".
  // For standard QR compact flow: initial phase is "name-email", second phase is "phone".
  const isPhoneFirst = isKioskTerminalFlow

  const editInitialPhase = React.useCallback(() => {
    setKioskInfoPhase(isPhoneFirst ? "phone" : "name-email")
    setActiveNumericField(isPhoneFirst ? "phone" : null)
  }, [isPhoneFirst, setActiveNumericField, setKioskInfoPhase])

  // Keep for QR compact flow compatibility
  const editNameEmail = React.useCallback(() => {
    setKioskInfoPhase("name-email")
    setActiveNumericField(null)
  }, [setActiveNumericField, setKioskInfoPhase])

  if (shouldMaskKioskInfoContent) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[var(--brand,#ff7a7a)]" aria-hidden />
        <h4 className="mt-4 text-lg font-semibold text-white">Getting payment ready</h4>
        <p className="mt-2 text-sm leading-relaxed text-white/68">
          We are using the saved student details and moving straight to payment.
        </p>
      </div>
    )
  }

  const nameEmailFields = (
    <>
      <fieldset className="space-y-2">
        <label className="text-sm font-medium">{t("label_firstName")}</label>
        <input
          value={contact.firstName}
          onChange={(e) => setContact((c) => ({ ...c, firstName: e.target.value }))}
          onFocus={() => setActiveNumericField(null)}
          placeholder={t("placeholder_firstName")}
          className="w-full rounded-md border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/10"
        />
      </fieldset>
      <fieldset className="space-y-2">
        <label className="text-sm font-medium">{t("label_lastName")}</label>
        <input
          value={contact.lastName}
          onChange={(e) => setContact((c) => ({ ...c, lastName: e.target.value }))}
          onFocus={() => setActiveNumericField(null)}
          placeholder={t("placeholder_lastName")}
          className="w-full rounded-md border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/10"
        />
      </fieldset>
      <fieldset className="space-y-2 sm:col-span-2">
        <label className="text-sm font-medium">{t("label_email")}</label>
        <input
          type="email"
          value={contact.email}
          onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
          onFocus={() => setActiveNumericField(null)}
          placeholder={t("placeholder_email")}
          className="w-full rounded-md border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/10"
        />
        {!isCheckInFlow && (
          <p className="text-xs text-neutral-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setRequiresSignIn(true)
                setExistingAccountDetected(false)
                setResumeAfterSignInStep(null)
                setPendingAutoPay(false)
              }}
              className="font-medium underline"
            >
              Sign in
            </button>{" "}
            and your details will be filled in automatically.
          </p>
        )}
      </fieldset>
    </>
  )

  const phoneKeypad = isKioskTerminalFlow ? (
    <KioskNumericKeypad
      onDigit={handleNumpadDigit}
      onBackspace={handleNumpadBackspace}
      onClear={handleNumpadClear}
      size="modal"
      className="w-full p-2 sm:p-2"
    />
  ) : null

  const phoneField = (
    <fieldset className={isKioskTerminalFlow ? "space-y-3 rounded-md border border-white/10 bg-white/[0.05] p-3 sm:col-span-2" : "space-y-2 sm:col-span-2"}>
      <label className="text-sm font-medium">Phone</label>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 items-center justify-center rounded-md border border-black/10 bg-white/70 px-2 text-[11px] font-semibold text-blue-900 dark:border-white/10 dark:bg-white/10 dark:text-blue-200">
          US
        </span>
        <div className="relative min-w-0 flex-1">
          <input
            type={PHONE_INPUT_ATTRIBUTES.type}
            value={contact.phone}
            onChange={(e) => {
              setPhoneTouched(true)
              setContact((c) => ({ ...c, phone: formatUSPhoneOnChange(e.target.value, c.phone) }))
            }}
            onBlur={() => setPhoneTouched(true)}
            onFocus={() => {
              if (isKioskTerminalFlow) setActiveNumericField("phone")
            }}
            readOnly={isKioskTerminalFlow}
            onClick={() => {
              if (isKioskTerminalFlow) setActiveNumericField("phone")
            }}
            placeholder="(929) 387-6584"
            inputMode={PHONE_INPUT_ATTRIBUTES.inputMode}
            autoComplete={PHONE_INPUT_ATTRIBUTES.autoComplete}
            enterKeyHint={PHONE_INPUT_ATTRIBUTES.enterKeyHint}
            pattern={PHONE_INPUT_ATTRIBUTES.pattern}
            aria-invalid={phoneTouched && !phoneComplete}
            className={`w-full rounded-md border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/10${isKioskTerminalFlow && activeNumericField === "phone" ? " border-white/30" : ""}`}
          />
          {isKioskTerminalFlow && activeNumericField === "phone" && (
            <span className="pointer-events-none absolute right-3 top-1/2 h-5 w-0.5 -translate-y-1/2 animate-pulse bg-white/70" />
          )}
        </div>
      </div>
      {phoneTouched && !phoneComplete && <p className="text-xs text-red-600">{t("phone_format_hint")}</p>}
      {phoneKeypad}
    </fieldset>
  )

  if (isKioskTerminalFlow || usesPhasedInfoForm) {
    // Phone-first flow (kiosk terminal): phone → name-email → done
    // Standard phased flow (QR compact): name-email → phone → done
    const isOnSecondPhase = isPhoneFirst
      ? kioskInfoPhase === "name-email"
      : kioskInfoPhase === "phone"

    return (
      <div className="space-y-4">
        <AnimatePresence>
          {isOnSecondPhase && (
            <motion.div
              key="first-phase-summary"
              variants={pillVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/80"
            >
              <span className="truncate">
                {isPhoneFirst
                  ? contact.phone
                  : `${contact.firstName} ${contact.lastName} · ${contact.email}`}
              </span>
              <button type="button" onClick={editInitialPhase} className="shrink-0 font-semibold text-[var(--brand,#ff7a7a)] underline-offset-4 hover:underline">
                Edit
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {kioskInfoPhase === "name-email" && (
            <motion.div key="name-email" variants={phaseVariants} initial="initial" animate="animate" exit="exit" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {nameEmailFields}
            </motion.div>
          )}

          {kioskInfoPhase === "phone" && (
            <motion.div key="phone" variants={phaseVariants} initial="initial" animate="animate" exit="exit" className="grid grid-cols-1 gap-4">
              {phoneField}
              {phoneComplete && (
                <p className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-sm text-white/70">
                  {isPhoneFirst
                    ? "Phone entered. Tap Continue to add your name and email."
                    : "Phone complete. Tap Continue below to finish."}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {nameEmailFields}
      {phoneField}

      {isKioskTerminalFlow && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out sm:col-span-2 ${
            activeNumericField !== null ? "mt-2 max-h-[400px] opacity-100" : "mt-0 max-h-0 opacity-0"
          }`}
        >
          <KioskNumericKeypad
            onDigit={handleNumpadDigit}
            onBackspace={handleNumpadBackspace}
            onClear={handleNumpadClear}
            size="modal"
          />
        </div>
      )}
    </div>
  )
}
