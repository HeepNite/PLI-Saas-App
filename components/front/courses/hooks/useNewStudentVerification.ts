import { useCallback, useReducer } from "react"

// --- Types ---

export type VerificationState =
  | "idle"
  | "verifying"
  | "existing_detected"
  | "sms_pending"
  | "sms_verifying"
  | "verified"
  | "error"

type ExistingIdentifier = "phone" | "email" | "both"

type VerifyAction =
  | { type: "VERIFY_START" }
  | { type: "VERIFY_EXISTING"; existingIdentifier?: ExistingIdentifier }
  | { type: "VERIFY_NEW" }
  | { type: "VERIFY_ELIGIBLE" }
  | { type: "SMS_SENT" }
  | { type: "SMS_VERIFIED" }
  | { type: "SMS_DISMISSED" }
  | { type: "VERIFY_ERROR"; error: string }
  | { type: "RESET" }

type VerificationContext = {
  error: string | null
  existingIdentifier: ExistingIdentifier | null
}

type State = {
  status: VerificationState
  ctx: VerificationContext
}

// --- Pure Reducer (exported for testing) ---

export const initialState: State = {
  status: "idle",
  ctx: { error: null, existingIdentifier: null },
}

export function verificationReducer(state: State, action: VerifyAction): State {
  switch (action.type) {
    case "VERIFY_START":
      // Allow restart from any state (auto-reset for retry scenarios)
      return { status: "verifying", ctx: { error: null, existingIdentifier: null } }

    case "VERIFY_EXISTING":
      return {
        status: "existing_detected",
        ctx: { ...state.ctx, existingIdentifier: action.existingIdentifier ?? null },
      }

    case "VERIFY_NEW":
      return { status: "sms_pending", ctx: { ...state.ctx, error: null } }

    case "VERIFY_ELIGIBLE":
      return { status: "verified", ctx: { ...state.ctx, error: null } }

    case "SMS_SENT":
      if (state.status !== "sms_pending") return state
      return { status: "sms_verifying", ctx: state.ctx }

    case "SMS_VERIFIED":
      if (state.status !== "sms_verifying" && state.status !== "sms_pending") return state
      return { status: "verified", ctx: state.ctx }

    case "SMS_DISMISSED":
      if (state.status !== "sms_pending" && state.status !== "sms_verifying") return state
      return { status: "existing_detected", ctx: state.ctx }

    case "VERIFY_ERROR":
      return { status: "error", ctx: { ...state.ctx, error: action.error } }

    case "RESET":
      return initialState

    default:
      return state
  }
}

type VerificationResponse = {
  outcome?: "eligible" | "requires_sms_verification" | "fallback_regular" | "existing_user"
  requiresSmsVerification?: boolean
}

export function resolveNewStudentVerificationOutcome(response: unknown): "existing_detected" | "sms_pending" | "verified" {
  if (!response || typeof response !== "object") {
    throw new Error("Unexpected verification response")
  }

  const { outcome, requiresSmsVerification } = response as VerificationResponse
  if (outcome === "existing_user" || outcome === "fallback_regular") return "existing_detected"
  if (outcome === "requires_sms_verification" || requiresSmsVerification === true) return "sms_pending"
  if (outcome === "eligible") return "verified"

  throw new Error("Unexpected verification response")
}

const getExistingIdentifier = (response: unknown): ExistingIdentifier | undefined => {
  if (!response || typeof response !== "object" || !Object.hasOwn(response, "existingIdentifier")) {
    return undefined
  }

  const existingIdentifier = (response as { existingIdentifier?: unknown }).existingIdentifier
  return existingIdentifier === "phone" || existingIdentifier === "email" || existingIdentifier === "both"
    ? existingIdentifier
    : undefined
}

// --- Hook ---

export function useNewStudentVerification() {
  const [state, dispatch] = useReducer(verificationReducer, initialState)

  const verify = useCallback(
    async (phone: string, email: string): Promise<VerificationState> => {
      dispatch({ type: "VERIFY_START" })

      try {
        const res = await fetch("/api/checkin/qr/new-student/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, email }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? "Verification failed")
        }

        const data: unknown = await res.json()
        const outcome = resolveNewStudentVerificationOutcome(data)

        if (outcome === "existing_detected") {
          dispatch({
            type: "VERIFY_EXISTING",
            existingIdentifier: getExistingIdentifier(data),
          })
          return "existing_detected"
        }

        if (outcome === "sms_pending") {
          dispatch({ type: "VERIFY_NEW" })
          return "sms_pending"
        }

        dispatch({ type: "VERIFY_ELIGIBLE" })
        return "verified"
      } catch {
        dispatch({ type: "VERIFY_ERROR", error: "We couldn't verify your details. Please try again." })
        return "error"
      }
    },
    [state.status]
  )

  const onSmsSent = useCallback(() => dispatch({ type: "SMS_SENT" }), [])
  const onSmsVerified = useCallback(() => dispatch({ type: "SMS_VERIFIED" }), [])
  const onSmsDismissed = useCallback(() => dispatch({ type: "SMS_DISMISSED" }), [])
  const reset = useCallback(() => dispatch({ type: "RESET" }), [])

  return {
    state: state.status,
    error: state.ctx.error,
    existingIdentifier: state.ctx.existingIdentifier,
    verify,
    onSmsSent,
    onSmsVerified,
    onSmsDismissed,
    reset,
  }
}
