import * as React from "react"

import KioskNumericKeypad from "@/components/front/checkin/KioskNumericKeypad"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { I18nKey } from "@/lib/i18n-dict"
import { PHONE_INPUT_ATTRIBUTES } from "@/lib/checkin/sign-in-inputs"

import { formatUSPhone, formatUSPhoneOnChange, isCompleteUSPhone } from "../../utils/phone"

type ActiveNumericField = "phone" | "pin" | "pin-confirm" | null

type EnrollInfoStepProps = {
  activeNumericField: ActiveNumericField
  checkPinAvailability: (pin: string) => void | Promise<unknown>
  contact: EnrollmentContact
  handleNumpadBackspace: () => void
  handleNumpadClear: () => void
  handleNumpadDigit: (digit: string) => void
  isCheckInFlow: boolean
  isKioskTerminalFlow: boolean
  phoneTouched: boolean
  pinAvailabilityError: string | null
  service: string
  setActiveNumericField: React.Dispatch<React.SetStateAction<ActiveNumericField>>
  setContact: React.Dispatch<React.SetStateAction<EnrollmentContact>>
  setExistingAccountDetected: React.Dispatch<React.SetStateAction<boolean>>
  setPendingAutoPay: React.Dispatch<React.SetStateAction<boolean>>
  setPhoneTouched: React.Dispatch<React.SetStateAction<boolean>>
  setPinAvailabilityError: React.Dispatch<React.SetStateAction<string | null>>
  setRequiresSignIn: React.Dispatch<React.SetStateAction<boolean>>
  setResumeAfterSignInStep: React.Dispatch<React.SetStateAction<number | null>>
  setStudentPin: React.Dispatch<React.SetStateAction<string>>
  setStudentPinConfirm: React.Dispatch<React.SetStateAction<string>>
  shouldMaskKioskInfoContent: boolean
  studentPin: string
  studentPinConfirm: string
  t: (key: I18nKey) => string
}

const securePinStyle = { WebkitTextSecurity: "disc" } as React.CSSProperties

export default function EnrollInfoStep({
  activeNumericField,
  checkPinAvailability,
  contact,
  handleNumpadBackspace,
  handleNumpadClear,
  handleNumpadDigit,
  isCheckInFlow,
  isKioskTerminalFlow,
  phoneTouched,
  pinAvailabilityError,
  service,
  setActiveNumericField,
  setContact,
  setExistingAccountDetected,
  setPendingAutoPay,
  setPhoneTouched,
  setPinAvailabilityError,
  setRequiresSignIn,
  setResumeAfterSignInStep,
  setStudentPin,
  setStudentPinConfirm,
  shouldMaskKioskInfoContent,
  studentPin,
  studentPinConfirm,
  t,
}: EnrollInfoStepProps) {
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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      <fieldset className="space-y-2 sm:col-span-2">
        <label className="text-sm font-medium">Phone</label>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 items-center justify-center rounded-md border border-black/10 bg-white/70 px-2 text-[11px] font-semibold text-blue-900 dark:border-white/10 dark:bg-white/10 dark:text-blue-200">
            US
          </span>
          <div className="relative w-full">
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
              aria-invalid={phoneTouched && !isCompleteUSPhone(contact.phone)}
              className={`w-full rounded-md border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/10${isKioskTerminalFlow && activeNumericField === "phone" ? " border-white/30" : ""}`}
            />
            {isKioskTerminalFlow && activeNumericField === "phone" && (
              <span className="pointer-events-none absolute right-3 top-1/2 h-5 w-0.5 -translate-y-1/2 animate-pulse bg-white/70" />
            )}
          </div>
        </div>
        {phoneTouched && !isCompleteUSPhone(contact.phone) && (
          <p className="text-xs text-red-600">{t("phone_format_hint")}</p>
        )}
      </fieldset>
      {/* Notes field hidden — kept in data structure but not shown in UI */}
      {false && !isKioskTerminalFlow && (
        <fieldset className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">{t("label_notes")}</label>
          <textarea
            value={contact.note}
            onChange={(e) => setContact((c) => ({ ...c, note: e.target.value }))}
            rows={3}
            placeholder={t("placeholder_notes")}
            className="w-full rounded-md border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/10"
          />
        </fieldset>
      )}

      {service === "new-student" && (
        <div className="space-y-3 rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/10 sm:col-span-2">
          <div>
            <div className="text-sm font-semibold">Create student PIN</div>
            <div className="mt-1 text-xs text-neutral-500 dark:text-white/60">
              This 4-digit PIN is required for future kiosk check-ins and account recovery.
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="off"
                name="kiosk-pin"
                value={isKioskTerminalFlow ? "•".repeat(studentPin.length) : studentPin}
                onChange={(e) => {
                  setStudentPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  setPinAvailabilityError(null)
                }}
                readOnly={isKioskTerminalFlow}
                onClick={() => {
                  if (isKioskTerminalFlow) setActiveNumericField("pin")
                }}
                onFocus={() => {
                  if (isKioskTerminalFlow) setActiveNumericField("pin")
                }}
                style={!isKioskTerminalFlow ? securePinStyle : undefined}
                className={`w-full rounded-md border border-black/10 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10${isKioskTerminalFlow && activeNumericField === "pin" ? " border-white/30" : ""}`}
                placeholder="4-digit PIN"
              />
              {isKioskTerminalFlow && activeNumericField === "pin" && (
                <span className="pointer-events-none absolute right-3 top-1/2 h-5 w-0.5 -translate-y-1/2 animate-pulse bg-white/70" />
              )}
            </div>
            <div className="relative">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="off"
                name="kiosk-pin-confirm"
                value={isKioskTerminalFlow ? "•".repeat(studentPinConfirm.length) : studentPinConfirm}
                onChange={(e) => {
                  setStudentPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))
                  setPinAvailabilityError(null)
                }}
                readOnly={isKioskTerminalFlow}
                onClick={() => {
                  if (isKioskTerminalFlow) setActiveNumericField("pin-confirm")
                }}
                onFocus={() => {
                  if (isKioskTerminalFlow) setActiveNumericField("pin-confirm")
                }}
                onBlur={() => {
                  if (service === "new-student" && /^\d{4}$/.test(studentPin) && studentPin === studentPinConfirm) {
                    void checkPinAvailability(studentPin)
                  }
                }}
                style={!isKioskTerminalFlow ? securePinStyle : undefined}
                className={`w-full rounded-md border border-black/10 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10${isKioskTerminalFlow && activeNumericField === "pin-confirm" ? " border-white/30" : ""}`}
                placeholder="Confirm PIN"
              />
              {isKioskTerminalFlow && activeNumericField === "pin-confirm" && (
                <span className="pointer-events-none absolute right-3 top-1/2 h-5 w-0.5 -translate-y-1/2 animate-pulse bg-white/70" />
              )}
            </div>
          </div>
          {pinAvailabilityError && <p className="text-xs text-red-600">{pinAvailabilityError}</p>}
          <p className="text-xs text-neutral-500 dark:text-white/50">
            Remember your PIN — you&apos;ll use it for a faster check-in next time.
          </p>
        </div>
      )}

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
