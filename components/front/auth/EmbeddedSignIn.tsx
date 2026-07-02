"use client"

import React from "react"
import { Loader2 } from "lucide-react"
import { useSignIn } from "@clerk/nextjs"
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

type PhoneCodeFactor = {
  strategy: "phone_code"
  phoneNumberId: string
}

type EmailCodeFactor = {
  strategy: "email_code"
  emailAddressId: string
  safeIdentifier?: string
}

type VerificationStrategy = "phone_code" | "email_code"

const CODE_LENGTH = 6
const CODE_RESEND_COOLDOWN_MS = 30_000
const PHONE_CODE_RATE_LIMIT_RE = /too many verification code requests|wait at least\s+\d+\s+seconds?/i
const ALREADY_SIGNED_IN_RE = /already signed in|active session/i
const NOT_FOUND_RE = /couldn't find your account|couldn't find an account|no account found/i
const SIGN_IN_RETRY_DELAY_MS = 2000
const SIGN_IN_MAX_RETRIES = 2

const getPhoneCodeFactor = (factors: unknown): PhoneCodeFactor | null => {
  if (!Array.isArray(factors)) return null
  const factor = factors.find(
    (item) =>
      item &&
      typeof item === "object" &&
      "strategy" in item &&
      "phoneNumberId" in item &&
      (item as { strategy?: string }).strategy === "phone_code"
  )
  if (!factor) return null
  return factor as PhoneCodeFactor
}

const getEmailCodeFactor = (factors: unknown): EmailCodeFactor | null => {
  if (!Array.isArray(factors)) return null
  const factor = factors.find(
    (item) =>
      item &&
      typeof item === "object" &&
      "strategy" in item &&
      "emailAddressId" in item &&
      (item as { strategy?: string }).strategy === "email_code"
  )
  if (!factor) return null
  return factor as EmailCodeFactor
}

const getClerkErrorMessage = (err: unknown) => {
  if (!err || typeof err !== "object" || !("errors" in err)) return null
  return (
    (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0]?.longMessage ||
    (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0]?.message ||
    null
  )
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

interface SignInState {
  phone: string
  code: string
  step: "phone" | "code"
  busy: boolean
  error: string | null
  notice: string | null
  resendAvailableAt: number
  phoneNumberId: string
  emailAddressId: string
  emailSafeIdentifier: string
  verificationStrategy: VerificationStrategy
  activeField: KioskNumericField
}

type SignInAction =
  | { type: "SET_PHONE"; payload: string | ((prev: string) => string) }
  | { type: "SET_CODE"; payload: string | ((prev: string) => string) }
  | { type: "SET_STEP"; payload: "phone" | "code" }
  | { type: "SET_BUSY"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_NOTICE"; payload: string | null }
  | { type: "SET_RESEND_AVAILABLE_AT"; payload: number }
  | { type: "SET_PHONE_NUMBER_ID"; payload: string }
  | { type: "SET_EMAIL_ADDRESS_ID"; payload: string }
  | { type: "SET_EMAIL_SAFE_IDENTIFIER"; payload: string }
  | { type: "SET_VERIFICATION_STRATEGY"; payload: VerificationStrategy }
  | { type: "SET_ACTIVE_FIELD"; payload: KioskNumericField }
  | {
      type: "MOVE_TO_CODE_STEP"
      payload: {
        phoneNumberId: string
        emailAddressId: string
        emailSafeIdentifier: string
      }
    }
  | { type: "RESET_TO_PHONE_STEP" }

function applyFn<T>(value: T | ((prev: T) => T), prev: T): T {
  return typeof value === "function" ? (value as (prev: T) => T)(prev) : value
}

function signInReducer(state: SignInState, action: SignInAction): SignInState {
  switch (action.type) {
    case "SET_PHONE":
      return { ...state, phone: applyFn(action.payload, state.phone) }
    case "SET_CODE":
      return { ...state, code: applyFn(action.payload, state.code) }
    case "SET_STEP":
      return { ...state, step: action.payload }
    case "SET_BUSY":
      return { ...state, busy: action.payload }
    case "SET_ERROR":
      return { ...state, error: action.payload }
    case "SET_NOTICE":
      return { ...state, notice: action.payload }
    case "SET_RESEND_AVAILABLE_AT":
      return { ...state, resendAvailableAt: action.payload }
    case "SET_PHONE_NUMBER_ID":
      return { ...state, phoneNumberId: action.payload }
    case "SET_EMAIL_ADDRESS_ID":
      return { ...state, emailAddressId: action.payload }
    case "SET_EMAIL_SAFE_IDENTIFIER":
      return { ...state, emailSafeIdentifier: action.payload }
    case "SET_VERIFICATION_STRATEGY":
      return { ...state, verificationStrategy: action.payload }
    case "SET_ACTIVE_FIELD":
      return { ...state, activeField: action.payload }
    case "MOVE_TO_CODE_STEP":
      return {
        ...state,
        phoneNumberId: action.payload.phoneNumberId,
        emailAddressId: action.payload.emailAddressId,
        emailSafeIdentifier: action.payload.emailSafeIdentifier,
        verificationStrategy: "phone_code",
        code: "",
        step: "code",
      }
    case "RESET_TO_PHONE_STEP":
      return {
        ...state,
        step: "phone",
        code: "",
        phoneNumberId: "",
        emailAddressId: "",
        emailSafeIdentifier: "",
        verificationStrategy: "phone_code",
        error: null,
        notice: null,
      }
    default:
      return state
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmbeddedSignIn({
  redirectUrl,
  phoneNumber,
  onSuccessAction,
  onSessionCreated,
  onCodeSent,
  useNumericKeypad = false,
  activateSessionOnSuccess = true,
  autoSend = false,
  bare = false,
}: {
  redirectUrl: string
  phoneNumber?: string
  onSuccessAction?: () => void | Promise<void>
  onSessionCreated?: (sessionId: string) => void | Promise<void>
  onCodeSent?: () => void
  useNumericKeypad?: boolean
  activateSessionOnSuccess?: boolean
  /** When true, automatically sends SMS code on mount if phoneNumber is valid */
  autoSend?: boolean
  /** When true, renders without container border/bg/shadow — for embedding inside a parent modal */
  bare?: boolean
}) {
  const { isLoaded, signIn, setActive } = useSignIn()

  const [state, dispatch] = React.useReducer(signInReducer, undefined, (): SignInState => ({
    phone: formatUSPhone(phoneNumber || ""),
    code: "",
    step: "phone",
    busy: false,
    error: null,
    notice: null,
    resendAvailableAt: 0,
    phoneNumberId: "",
    emailAddressId: "",
    emailSafeIdentifier: "",
    verificationStrategy: "phone_code",
    activeField: INITIAL_KIOSK_NUMERIC_FIELD,
  }))

  const {
    phone,
    code,
    step,
    busy,
    error,
    notice,
    resendAvailableAt,
    phoneNumberId,
    emailAddressId,
    emailSafeIdentifier,
    verificationStrategy,
    activeField,
  } = state

  // Effect 1: Sync phone prop changes into state
  React.useEffect(() => {
    dispatch({ type: "SET_PHONE", payload: formatUSPhone(phoneNumber || "") })
  }, [phoneNumber])

  // Effect 2: Reset active field when switching keypad mode off
  React.useEffect(() => {
    if (!useNumericKeypad) {
      dispatch({ type: "SET_ACTIVE_FIELD", payload: INITIAL_KIOSK_NUMERIC_FIELD })
    }
  }, [useNumericKeypad])

  // Effect 3: Cooldown timer — clear resendAvailableAt once the window expires
  React.useEffect(() => {
    if (resendAvailableAt <= Date.now()) return
    const timer = window.setTimeout(
      () => dispatch({ type: "SET_RESEND_AVAILABLE_AT", payload: 0 }),
      resendAvailableAt - Date.now()
    )
    return () => window.clearTimeout(timer)
  }, [resendAvailableAt])

  const normalizedPhone = React.useMemo(() => toE164Phone(phone), [phone])
  const isResendCoolingDown = resendAvailableAt > Date.now()

  // Ref for auto-send - declared here but effect runs after sendCode is defined
  const autoSendTriggeredRef = React.useRef(false)

  const renderCursorHint = (field: KioskNumericField) =>
    useNumericKeypad && activeField === field ? (
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-5 w-[2px] -translate-y-1/2 animate-pulse rounded-full bg-[var(--brand,#ff7a7a)]"
      />
    ) : null

  const moveToCodeStepFromCurrentAttempt = React.useCallback(() => {
    if (!signIn) return false
    const factor = getPhoneCodeFactor(signIn.supportedFirstFactors)
    const emailFactor = getEmailCodeFactor(signIn.supportedFirstFactors)
    if (!factor?.phoneNumberId) return false
    dispatch({
      type: "MOVE_TO_CODE_STEP",
      payload: {
        phoneNumberId: factor.phoneNumberId,
        emailAddressId: emailFactor?.emailAddressId || "",
        emailSafeIdentifier: emailFactor?.safeIdentifier || "",
      },
    })
    return true
  }, [signIn])

  const resetToPhoneStep = React.useCallback(() => {
    dispatch({ type: "RESET_TO_PHONE_STEP" })
  }, [])

  const startCodeCooldown = React.useCallback(() => {
    dispatch({ type: "SET_RESEND_AVAILABLE_AT", payload: Date.now() + CODE_RESEND_COOLDOWN_MS })
  }, [])

  const blockDuringCooldown = React.useCallback(() => {
    if (resendAvailableAt <= Date.now()) return false
    dispatch({ type: "SET_ERROR", payload: "We already requested a code. Wait 30 seconds before trying again." })
    return true
  }, [resendAvailableAt])

  // Effect 4: Resume an in-progress sign-in attempt on Clerk re-mount
  React.useEffect(() => {
    if (!isLoaded || !signIn || step === "code" || !normalizedPhone) return
    if (signIn.status !== "needs_first_factor") return
    if (signIn.identifier !== normalizedPhone) return
    moveToCodeStepFromCurrentAttempt()
  }, [isLoaded, moveToCodeStepFromCurrentAttempt, normalizedPhone, signIn, step])

  const sendCode = React.useCallback(async () => {
    if (!normalizedPhone || !isCompleteUSPhone(phone)) {
      dispatch({ type: "SET_ERROR", payload: "Enter a valid US phone number." })
      return
    }
    if (!isLoaded || !signIn) {
      dispatch({ type: "SET_ERROR", payload: "Access is still loading. Please try again." })
      return
    }

    dispatch({ type: "SET_BUSY", payload: true })
    dispatch({ type: "SET_ERROR", payload: null })
    dispatch({ type: "SET_NOTICE", payload: "Sending SMS code..." })
    try {
      if (
        signIn.identifier === normalizedPhone &&
        signIn.status === "needs_first_factor" &&
        moveToCodeStepFromCurrentAttempt()
      ) {
        return
      }

      // Retry loop: newly created Clerk accounts may take a moment to propagate.
      let created = null as Awaited<ReturnType<typeof signIn.create>> | null
      for (let attempt = 0; attempt <= SIGN_IN_MAX_RETRIES; attempt++) {
        try {
          created = await signIn.create({
            strategy: "phone_code",
            identifier: normalizedPhone,
          })
          break
        } catch (retryErr) {
          const retryMsg = getClerkErrorMessage(retryErr)
          if (retryMsg && NOT_FOUND_RE.test(retryMsg) && attempt < SIGN_IN_MAX_RETRIES) {
            dispatch({ type: "SET_NOTICE", payload: "Setting up your account…" })
            await new Promise((r) => setTimeout(r, SIGN_IN_RETRY_DELAY_MS))
            continue
          }
          throw retryErr
        }
      }

      if (!created) {
        dispatch({ type: "SET_ERROR", payload: "We couldn't find your account. Please try again." })
        return
      }

      const factor = getPhoneCodeFactor(created.supportedFirstFactors)
      const emailFactor = getEmailCodeFactor(created.supportedFirstFactors)
      if (!factor?.phoneNumberId) {
        dispatch({ type: "SET_ERROR", payload: "We couldn't prepare phone sign-in." })
        return
      }

      await created.prepareFirstFactor({
        strategy: "phone_code",
        phoneNumberId: factor.phoneNumberId,
      })

      dispatch({
        type: "MOVE_TO_CODE_STEP",
        payload: {
          phoneNumberId: factor.phoneNumberId,
          emailAddressId: emailFactor?.emailAddressId || "",
          emailSafeIdentifier: emailFactor?.safeIdentifier || "",
        },
      })
      startCodeCooldown()
      dispatch({ type: "SET_NOTICE", payload: `We sent a code to ${formatUSPhone(phone)}.` })
      onCodeSent?.()
    } catch (err) {
      const message = getClerkErrorMessage(err)
      if (moveToCodeStepFromCurrentAttempt() || (message && PHONE_CODE_RATE_LIMIT_RE.test(message))) {
        dispatch({ type: "SET_STEP", payload: "code" })
        startCodeCooldown()
        dispatch({ type: "SET_NOTICE", payload: null })
        dispatch({ type: "SET_ERROR", payload: "We already sent a code. Enter the one you received or wait 30 seconds to resend." })
        return
      }
      if (message && ALREADY_SIGNED_IN_RE.test(message)) {
        dispatch({ type: "SET_ERROR", payload: "An active session was detected. Please close this modal and try again, or contact staff for help." })
        return
      }
      dispatch({ type: "SET_ERROR", payload: message || "We couldn't send the code to your phone." })
    } finally {
      dispatch({ type: "SET_BUSY", payload: false })
    }
  }, [isLoaded, moveToCodeStepFromCurrentAttempt, normalizedPhone, onCodeSent, phone, signIn, startCodeCooldown])

  // Effect 5: Auto-send SMS code on mount when autoSend is enabled and phone is valid
  // Small delay ensures Clerk is fully initialized before attempting to send
  React.useEffect(() => {
    if (
      autoSend &&
      !autoSendTriggeredRef.current &&
      isLoaded &&
      signIn &&
      step === "phone" &&
      normalizedPhone &&
      isCompleteUSPhone(phone)
    ) {
      autoSendTriggeredRef.current = true
      // Small delay to ensure Clerk's internal state is ready
      const timer = setTimeout(() => {
        void sendCode()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoSend, isLoaded, signIn, step, normalizedPhone, phone, sendCode])

  const verifyCode = React.useCallback(async () => {
    if (!isLoaded || !signIn || !setActive) {
      dispatch({ type: "SET_ERROR", payload: "Access is still loading. Please try again." })
      return
    }
    if (code.trim().length !== CODE_LENGTH) {
      dispatch({ type: "SET_ERROR", payload: "Enter the 6-digit code." })
      return
    }

    dispatch({ type: "SET_BUSY", payload: true })
    dispatch({ type: "SET_ERROR", payload: null })
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: verificationStrategy,
        code: code.trim(),
      })

      if (attempt.status === "complete" && attempt.createdSessionId) {
        if (activateSessionOnSuccess) {
          await setActive({ session: attempt.createdSessionId })
        }
        if (onSessionCreated) {
          await onSessionCreated(attempt.createdSessionId)
        }
        if (onSuccessAction) {
          await onSuccessAction()
        } else {
          window.location.assign(redirectUrl)
        }
        return
      }

      dispatch({ type: "SET_ERROR", payload: "We couldn't complete sign-in. Please try again." })
    } catch (err) {
      const message = getClerkErrorMessage(err)
      dispatch({ type: "SET_ERROR", payload: message || "The code is invalid." })
    } finally {
      dispatch({ type: "SET_BUSY", payload: false })
    }
  }, [activateSessionOnSuccess, code, isLoaded, onSessionCreated, onSuccessAction, redirectUrl, setActive, signIn, verificationStrategy])

  const resendCode = React.useCallback(async () => {
    if (!isLoaded || !signIn) return
    if (blockDuringCooldown()) return
    if (verificationStrategy === "phone_code" && !phoneNumberId) return
    if (verificationStrategy === "email_code" && !emailAddressId) return
    dispatch({ type: "SET_BUSY", payload: true })
    dispatch({ type: "SET_ERROR", payload: null })
    dispatch({ type: "SET_NOTICE", payload: verificationStrategy === "email_code" ? "Sending email code..." : "Sending SMS code..." })
    try {
      if (verificationStrategy === "email_code") {
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId,
        })
      } else {
        await signIn.prepareFirstFactor({
          strategy: "phone_code",
          phoneNumberId,
        })
      }
      startCodeCooldown()
      dispatch({
        type: "SET_NOTICE",
        payload:
          verificationStrategy === "email_code"
            ? `We sent a new code to ${emailSafeIdentifier || "your email"}.`
            : `We sent a new code to ${formatUSPhone(phone)}.`,
      })
      onCodeSent?.()
    } catch (err) {
      const message = getClerkErrorMessage(err)
      if (message && PHONE_CODE_RATE_LIMIT_RE.test(message)) {
        startCodeCooldown()
        dispatch({ type: "SET_NOTICE", payload: null })
        dispatch({ type: "SET_ERROR", payload: "We already sent a code. Use the one you received or wait 30 seconds to resend." })
        return
      }
      dispatch({ type: "SET_ERROR", payload: message || "We couldn't resend the code." })
    } finally {
      dispatch({ type: "SET_BUSY", payload: false })
    }
  }, [blockDuringCooldown, emailAddressId, emailSafeIdentifier, isLoaded, onCodeSent, phone, phoneNumberId, signIn, startCodeCooldown, verificationStrategy])

  const sendCodeByEmail = React.useCallback(async () => {
    if (!isLoaded || !signIn || !emailAddressId) return
    if (blockDuringCooldown()) return
    dispatch({ type: "SET_BUSY", payload: true })
    dispatch({ type: "SET_ERROR", payload: null })
    dispatch({ type: "SET_NOTICE", payload: "Sending email code..." })
    try {
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId,
      })
      dispatch({ type: "SET_VERIFICATION_STRATEGY", payload: "email_code" })
      dispatch({ type: "SET_CODE", payload: "" })
      startCodeCooldown()
      dispatch({ type: "SET_NOTICE", payload: `We sent a new code to ${emailSafeIdentifier || "your email"}.` })
    } catch (err) {
      const message = getClerkErrorMessage(err)
      if (message && PHONE_CODE_RATE_LIMIT_RE.test(message)) {
        startCodeCooldown()
        dispatch({ type: "SET_NOTICE", payload: null })
        dispatch({ type: "SET_ERROR", payload: "We already sent a code. Use the one you received or wait 30 seconds to resend." })
        return
      }
      dispatch({ type: "SET_ERROR", payload: message || "We couldn't send the code to your email." })
    } finally {
      dispatch({ type: "SET_BUSY", payload: false })
    }
  }, [blockDuringCooldown, emailAddressId, emailSafeIdentifier, isLoaded, signIn, startCodeCooldown])

  if (!isLoaded) {
    return (
    <div className={bare ? "w-full" : "w-full rounded-2xl border border-white/10 bg-[#171922]/95 p-4 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.65)]"}>
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
    <div className={bare ? "w-full" : "w-full rounded-2xl border border-white/10 bg-[#171922]/95 p-4 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.65)]"}>
      {step === "phone" ? (
        <div className="space-y-3">
          <div className="pr-16">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand,#c71818)]">Phone access</p>
            <p className="mt-1 text-xs text-white/82">We&apos;ll text you a verification code.</p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-white/85">Phone</span>
            <div className="relative">
              <input
                type={PHONE_INPUT_ATTRIBUTES.type}
                value={phone}
                onChange={(event) => {
                  dispatch({ type: "SET_PHONE", payload: formatUSPhone(event.target.value) })
                  dispatch({ type: "SET_ERROR", payload: null })
                }}
                onFocus={() => {
                  if (useNumericKeypad) dispatch({ type: "SET_ACTIVE_FIELD", payload: selectKioskNumericField("phone") })
                }}
                onClick={() => {
                  if (useNumericKeypad) dispatch({ type: "SET_ACTIVE_FIELD", payload: selectKioskNumericField("phone") })
                }}
                readOnly={useNumericKeypad}
                inputMode={PHONE_INPUT_ATTRIBUTES.inputMode}
                autoComplete={PHONE_INPUT_ATTRIBUTES.autoComplete}
                enterKeyHint={PHONE_INPUT_ATTRIBUTES.enterKeyHint}
                pattern={PHONE_INPUT_ATTRIBUTES.pattern}
                placeholder="+1 (929) 387-6584"
                className={`h-10 w-full rounded-lg border bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/40 outline-none transition ${
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
                dispatch({ type: "SET_ACTIVE_FIELD", payload: selectKioskNumericField("phone") })
                dispatch({ type: "SET_PHONE", payload: (prev) => appendPhoneDigit(prev, digit) })
                dispatch({ type: "SET_ERROR", payload: null })
              }}
              onBackspace={() => {
                dispatch({ type: "SET_ACTIVE_FIELD", payload: selectKioskNumericField("phone") })
                dispatch({ type: "SET_PHONE", payload: (prev) => removePhoneDigit(prev) })
                dispatch({ type: "SET_ERROR", payload: null })
              }}
              onClear={() => {
                dispatch({ type: "SET_ACTIVE_FIELD", payload: selectKioskNumericField("phone") })
                dispatch({ type: "SET_PHONE", payload: clearPhoneDigits() })
                dispatch({ type: "SET_ERROR", payload: null })
              }}
              size="compact"
              className="p-3"
            />
          )}
          {error && <p className="text-xs text-red-200">{error}</p>}
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={busy}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand,#c71818)] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_-14px_rgba(182,22,22,0.75)] transition hover:bg-[#d91b1b] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send code
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="pr-36">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Verify your access</p>
            <p className="mt-1 text-sm text-white/82">
              Enter the code we sent to {verificationStrategy === "email_code" ? emailSafeIdentifier || "your email" : formatUSPhone(phone)}.
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-white/85">Code</span>
            <div className="relative">
              <input
                type={CODE_INPUT_ATTRIBUTES.type}
                value={code}
                onChange={(event) => {
                  dispatch({ type: "SET_CODE", payload: event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH) })
                  dispatch({ type: "SET_ERROR", payload: null })
                }}
                onFocus={() => {
                  if (useNumericKeypad) dispatch({ type: "SET_ACTIVE_FIELD", payload: selectKioskNumericField("code") })
                }}
                onClick={() => {
                  if (useNumericKeypad) dispatch({ type: "SET_ACTIVE_FIELD", payload: selectKioskNumericField("code") })
                }}
                readOnly={useNumericKeypad}
                inputMode={CODE_INPUT_ATTRIBUTES.inputMode}
                autoComplete={CODE_INPUT_ATTRIBUTES.autoComplete}
                enterKeyHint={CODE_INPUT_ATTRIBUTES.enterKeyHint}
                placeholder="123456"
                className={`h-10 w-full rounded-xl border bg-white/[0.03] px-3 text-center text-lg tracking-[0.35em] text-white placeholder:tracking-normal placeholder:text-white/35 outline-none transition ${
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
                dispatch({ type: "SET_ACTIVE_FIELD", payload: selectKioskNumericField("code") })
                dispatch({ type: "SET_CODE", payload: (prev) => appendCodeDigit(prev, digit, CODE_LENGTH) })
                dispatch({ type: "SET_ERROR", payload: null })
              }}
              onBackspace={() => {
                dispatch({ type: "SET_ACTIVE_FIELD", payload: selectKioskNumericField("code") })
                dispatch({ type: "SET_CODE", payload: (prev) => removeCodeDigit(prev) })
                dispatch({ type: "SET_ERROR", payload: null })
              }}
              onClear={() => {
                dispatch({ type: "SET_ACTIVE_FIELD", payload: selectKioskNumericField("code") })
                dispatch({ type: "SET_CODE", payload: clearCodeDigits() })
                dispatch({ type: "SET_ERROR", payload: null })
              }}
              size="compact"
              className="p-3"
            />
          )}
          {notice && <p className="text-xs text-white/70">{notice}</p>}
          {error && <p className="text-xs text-red-200">{error}</p>}
          {emailAddressId && verificationStrategy === "phone_code" && (
            <button
              type="button"
              onClick={() => void sendCodeByEmail()}
              disabled={busy || isResendCoolingDown}
              className="text-left text-xs text-white/70 underline decoration-white/25 underline-offset-4 transition hover:text-white disabled:opacity-60"
            >
              {busy ? "Sending..." : "Didn't receive it? Send the code by email instead."}
            </button>
          )}
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
              disabled={busy || isResendCoolingDown}
              className="text-[var(--brand,#e31b1b)] underline decoration-[var(--brand,#e31b1b)]/30 underline-offset-4 disabled:opacity-60"
            >
              {isResendCoolingDown ? "Wait 30s" : "Resend code"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void verifyCode()}
            disabled={busy || code.length !== CODE_LENGTH}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand,#c71818)] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_-14px_rgba(182,22,22,0.75)] transition hover:bg-[#d91b1b] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue
          </button>
        </div>
      )}
    </div>
  )
}
