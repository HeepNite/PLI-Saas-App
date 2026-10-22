import {
  clearNativeCollectionPrompt,
  handOffPreparedPurchase,
  isPreparedPurchaseResponse,
  pollPreparedPurchaseState,
} from "@/components/front/courses/enroll/effects/native-payment-bridge"

export const NATIVE_PREPARE_FAILED_MESSAGE = "We couldn't prepare native payment. Please try again."
export const NATIVE_READER_UNRESPONSIVE_MESSAGE = "The card reader did not respond. Please try again or choose another payment method."

export type NativePreparedCheckoutResult =
  | { kind: "paid" }
  /** The prepared context refresh failed; the caller owns its visible error. */
  | { kind: "refresh_failed" }
  /** Native preparation failed before anything was handed to the reader. */
  | { kind: "prepare_failed" }
  /** The reader admitted (or may have admitted) the attempt but never reported PAID. */
  | { kind: "reader_unresolved" }

type NativePreparedCheckoutInput = {
  /** Freshly creates the prepared context at final confirmation; resolves false on failure. */
  refreshPreparedContext: () => Promise<boolean>
  /** POSTs the native_m2_prepare checkout intent. */
  requestPreparedPurchase: () => Promise<{ res: Response; data: unknown }>
  pollIntervalMs?: number
}

/**
 * Runs the native M2 prepared-purchase sequence: refresh context, prepare, hand off to the
 * reader, then poll the exact admitted operation. Every non-paid outcome is terminal: it
 * never re-prepares automatically and never falls back to another payment surface.
 */
export async function runNativePreparedCheckout({
  refreshPreparedContext,
  requestPreparedPurchase,
  pollIntervalMs = 500,
}: NativePreparedCheckoutInput): Promise<NativePreparedCheckoutResult> {
  let nativeHandoffStarted = false
  try {
    // The context used by native_m2_prepare must be freshly created at final
    // confirmation; earlier setup can expire while the customer reviews it.
    if (!(await refreshPreparedContext())) return { kind: "refresh_failed" }

    const prepared = await requestPreparedPurchase()
    if (!prepared.res.ok || !isPreparedPurchaseResponse(prepared.data)) return { kind: "prepare_failed" }

    nativeHandoffStarted = true
    const handoff = await handOffPreparedPurchase(prepared.data.preparedPurchaseReference)
    if ((handoff.state !== "accepted" && handoff.state !== "pending") || !handoff.operationReference) {
      return { kind: "reader_unresolved" }
    }

    for (;;) {
      const state = await pollPreparedPurchaseState(handoff.operationReference)
      if (state === "paid") return { kind: "paid" }
      if (state !== "pending") return { kind: "reader_unresolved" }
      await new Promise<void>((resolve) => window.setTimeout(resolve, pollIntervalMs))
    }
  } catch {
    return { kind: nativeHandoffStarted ? "reader_unresolved" : "prepare_failed" }
  } finally {
    // The sale is over for this page; a tap prompt the reader never cleared must not linger.
    clearNativeCollectionPrompt()
  }
}
