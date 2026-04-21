"use client"

import React from "react"
import { Loader2 } from "lucide-react"
import { useSignUp } from "@clerk/nextjs"
import { formatUSPhone, isCompleteUSPhone, toE164Phone } from "@/components/front/courses/utils/phone"
import {
  CODE_INPUT_ATTRIBUTES,
  INITIAL_KIOSK_NUMERIC_FIELD,
  PHONE_INPUT_ATTRIBUTES,
  selectKioskNumericField,
} from "@/lib/checkin/sign-in-inputs"
import KioskNumericKeypad from "@/components/front/checkin/KioskNumericKeypad"
import {
  appendCodeDigit,
  appendPhoneDigit,
  clearCodeDigits,
  clearPhoneDigits,
  type KioskNumericField,
  removeCodeDigit,
  removePhoneDigit,
} from "@/lib/checkin/numeric-keypad"

const CODE_LENGTH = 6
const PHONE_CODE_RATE_LIMIT_RE = /too many verification code requests|wait at least\s+\d+\s+seconds?/i

const getClerkErrorMessage = (err: unknown) => {
  if (!err || typeof err !== "object" || !("errors" in err)) return null
  return (
    (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0]?.longMessage ||
    (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0]?.message ||
    null
  )
}

export default function EmbeddedSignUp({
  phoneNumber,
  onSuccessAction,
  useNumericKeypad = false,
}: {
  phoneNumber?: string
  onSuccessAction?: () => void | Promise<void>
  useNumericKeypad?: boolean
}) {
  const { isLoaded, signUp } = useSignUp()
  const [phone, setPhone] = React.useState(() => formatUSPhone(phoneNumber || ""))
  const [code, setCode] = React.useState("")
  const [step, setStep] = React.useState<"phone" | "code">("phone")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activeField, setActiveField] = React.useState<KioskNumericField>(INITIAL_KIOSK_NUMERIC_FIELD)

  React.useEffect(() => {
    setPhone(formatUSPhone(phoneNumber || ""))
  }, [phoneNumber])

  React.useEffect(() => {
    if (!useNumericKeypad) {
      setActiveField(INITIAL_KIOSK_NUMERIC_FIELD)
    }
  }, [useNumericKeypad])

  const normalizedPhone = React.useMemo(() => toE164Phone(phone), [phone])
  const renderCursorHint = (field: KioskNumericField) =>
    useNumericKeypad && activeField === field ? (
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-5 w-[2px] -translate-y-1/2 animate-pulse rounded-full bg-[var(--brand,#ff7a7a)]"
      />
    ) : null

  const resetToPhoneStep = React.useCallback(() => {
    setStep("phone")
    setCode("")
    setError(null)
  }, [])

  const sendCode = React.useCallback(async () => {
    if (!normalizedPhone || !isCompleteUSPhone(phone)) {
      setError("Enter a valid US phone number.")
      return
    }
    if (!isLoaded || !signUp) {
      setError("Access is still loading. Please try again.")
      return
    }

    setBusy(true)
    setError(null)
    try {
      await signUp.create({
        phoneNumber: normalizedPhone,
      })

      await signUp.preparePhoneNumberVerification()

      setCode("")
      setStep("code")
    } catch (err) {
      const message = getClerkErrorMessage(err)
      if (message && PHONE_CODE_RATE_LIMIT_RE.test(message)) {
        setStep("code")
        setError("We already sent a code. Enter the one you received or wait 30 seconds to resend.")
        return
      }
      if (
        message &&
        (message.toLowerCase().includes("already exists") ||
          message.toLowerCase().includes("already been taken") ||
          message.toLowerCase().includes("identifier is already"))
      ) {
        setError("This phone number already has an account. Use the sign-in flow instead.")
        return
      }
      setError(message || "We couldn't send the code to your phone.")
    } finally {
      setBusy(false)
    }
  }, [isLoaded, normalizedPhone, phone, signUp])

  const verifyCode = React.useCallback(async () => {
    if (!isLoaded || !signUp) {
      setError("Access is still loading. Please try again.")
      return
    }
    if (code.trim().length !== CODE_LENGTH) {
      setError("Enter the 6-digit code.")
      return
    }

    setBusy(true)
    setError(null)
    try {
      const attempt = await signUp.attemptPhoneNumberVerification({
        code: code.trim(),
      })

      if (attempt.status === "complete" || attempt.status === "missing_requirements") {
        // Phone verified successfully. Do NOT set an active session here —
        // the checkout intent server endpoint handles account creation.
        if (onSuccessAction) {
          await onSuccessAction()
        }
        return
      }

      setError("We couldn't complete phone verification. Please try again.")
    } catch (err) {
      const message = getClerkErrorMessage(err)
      setError(message || "The code is invalid.")
    } finally {
      setBusy(false)
    }
  }, [code, isLoaded, onSuccessAction, signUp])

  const resendCode = React.useCallback(async () => {
    if (!isLoaded || !signUp) return
    setBusy(true)
    setError(null)
    try {
      await signUp.preparePhoneNumberVerification()
    } catch (err) {
      const message = getClerkErrorMessage(err)
      if (message && PHONE_CODE_RATE_LIMIT_RE.test(message)) {
        setError("We already sent a code. Use the one you received or wait 30 seconds to resend.")
        return
      }
      setError(message || "We couldn't resend the code.")
    } finally {
      setBusy(false)
    }
  }, [isLoaded, signUp])

  if (!isLoaded) {
    return (
      <div className="w-[20rem] max-w-full rounded-2xl border border-white/10 bg-[#171922]/95 p-4 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.65)]">
        <div className="space-y-3">
          <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-white/[0.06]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[20rem] max-w-full rounded-2xl border border-white/10 bg-[#171922]/95 p-4 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.65)]">
      {step === "phone" ? (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Verify your phone</p>
            <p className="mt-1 text-sm text-white/82">
              We will send you an SMS code to verify your number.
            </p>
          </div>
          <label className="block space-y-2">
            <span className="text-xs font-medium text-white/85">Phone</span>
            <div className="relative">
              <input
                type={PHONE_INPUT_ATTRIBUTES.type}
                value={phone}
                onChange={(event) => {
                  setPhone(formatUSPhone(event.target.value))
                  setError(null)
                }}
                onFocus={() => {
                  if (useNumericKeypad) setActiveField(selectKioskNumericField("phone"))
                }}
                onClick={() => {
                  if (useNumericKeypad) setActiveField(selectKioskNumericField("phone"))
                }}
                readOnly={useNumericKeypad}
                inputMode={PHONE_INPUT_ATTRIBUTES.inputMode}
                autoComplete={PHONE_INPUT_ATTRIBUTES.autoComplete}
                enterKeyHint={PHONE_INPUT_ATTRIBUTES.enterKeyHint}
                pattern={PHONE_INPUT_ATTRIBUTES.pattern}
                placeholder="+1 (929) 387-6584"
                className={`h-11 w-full rounded-xl border bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/40 outline-none transition ${
                  useNumericKeypad && activeField === "phone"
                    ? "border-[var(--brand,#ff7a7a)] ring-2 ring-[rgba(255,122,122,0.2)]"
                    : "border-white/12 focus:border-[var(--brand,#c71818)]"
                }`}
              />
              {renderCursorHint("phone")}
            </div>
          </label>
          {useNumericKeypad && (
            <KioskNumericKeypad
              disabled={busy}
              onDigit={(digit) => {
                setActiveField(selectKioskNumericField("phone"))
                setPhone((prev) => appendPhoneDigit(prev, digit))
                setError(null)
              }}
              onBackspace={() => {
                setActiveField(selectKioskNumericField("phone"))
                setPhone((prev) => removePhoneDigit(prev))
                setError(null)
              }}
              onClear={() => {
                setActiveField(selectKioskNumericField("phone"))
                setPhone(clearPhoneDigits())
                setError(null)
              }}
            />
          )}
          {error && <p className="text-xs text-red-200">{error}</p>}
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand,#c71818)] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_-14px_rgba(182,22,22,0.75)] transition hover:bg-[#d91b1b] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send code
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Verify your phone</p>
            <p className="mt-1 text-sm text-white/82">
              Enter the code we sent to {formatUSPhone(phone)}.
            </p>
          </div>
          <label className="block space-y-2">
            <span className="text-xs font-medium text-white/85">Code</span>
            <div className="relative">
              <input
                type={CODE_INPUT_ATTRIBUTES.type}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
                  setError(null)
                }}
                onFocus={() => {
                  if (useNumericKeypad) setActiveField(selectKioskNumericField("code"))
                }}
                onClick={() => {
                  if (useNumericKeypad) setActiveField(selectKioskNumericField("code"))
                }}
                readOnly={useNumericKeypad}
                inputMode={CODE_INPUT_ATTRIBUTES.inputMode}
                autoComplete={CODE_INPUT_ATTRIBUTES.autoComplete}
                enterKeyHint={CODE_INPUT_ATTRIBUTES.enterKeyHint}
                placeholder="123456"
                className={`h-11 w-full rounded-xl border bg-white/[0.03] px-3 text-center text-lg tracking-[0.35em] text-white placeholder:tracking-normal placeholder:text-white/35 outline-none transition ${
                  useNumericKeypad && activeField === "code"
                    ? "border-[var(--brand,#ff7a7a)] ring-2 ring-[rgba(255,122,122,0.2)]"
                    : "border-white/12 focus:border-[var(--brand,#c71818)]"
                }`}
              />
              {renderCursorHint("code")}
            </div>
          </label>
          {useNumericKeypad && (
            <KioskNumericKeypad
              disabled={busy}
              onDigit={(digit) => {
                setActiveField(selectKioskNumericField("code"))
                setCode((prev) => appendCodeDigit(prev, digit, CODE_LENGTH))
                setError(null)
              }}
              onBackspace={() => {
                setActiveField(selectKioskNumericField("code"))
                setCode((prev) => removeCodeDigit(prev))
                setError(null)
              }}
              onClear={() => {
                setActiveField(selectKioskNumericField("code"))
                setCode(clearCodeDigits())
                setError(null)
              }}
            />
          )}
          {error && <p className="text-xs text-red-200">{error}</p>}
          <div className="flex items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={resetToPhoneStep}
              className="text-white/65 underline decoration-white/20 underline-offset-4"
            >
              Change number
            </button>
            <button
              type="button"
              onClick={() => void resendCode()}
              disabled={busy}
              className="text-[var(--brand,#e31b1b)] underline decoration-[var(--brand,#e31b1b)]/30 underline-offset-4 disabled:opacity-60"
            >
              Resend code
            </button>
          </div>
          <button
            type="button"
            onClick={() => void verifyCode()}
            disabled={busy || code.length !== CODE_LENGTH}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand,#c71818)] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_-14px_rgba(182,22,22,0.75)] transition hover:bg-[#d91b1b] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Verify
          </button>
        </div>
      )}
    </div>
  )
}
