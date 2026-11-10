"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  clearNativeCollectionPrompt,
  handOffPreparedPurchase,
  isNativePaymentBridgeAvailable,
  isPreparedPurchaseResponse,
  pollPreparedPurchaseState,
} from "@/components/front/courses/enroll/effects/native-payment-bridge"
import { formatMoney } from "@/components/front/staff/staffAdminFormatters"
import { TERMINAL_CHARGE_POLL_TIMEOUT_MS, useTerminalChargePoll } from "@/components/front/staff/terminal-charge/useTerminalChargePoll"
import { isTerminalChargeFinal, type TerminalChargeView } from "@/lib/terminal-charges/contract"

const TERMINAL_CHARGE_PAID_SCREEN_MS = 3_000
const TERMINAL_CHARGE_DECLINED_SCREEN_MS = 4_000
/** How long "Confirming payment…" waits before offering to cancel a stuck collection. */
const TERMINAL_CHARGE_STUCK_CANCEL_MS = 30_000
/** How long the tablet follows the reader before handing over to "Confirming payment…". */
export const TERMINAL_CHARGE_COLLECT_DEADLINE_MS = 3 * 60_000

type Phase = "idle" | "unavailable" | "preparing" | "prepare_failed" | "reader_failed" | "collecting" | "verifying" | "paid" | "declined"

const STATUS_TEXT: Record<Exclude<Phase, "idle">, string> = {
  unavailable: "Card reader unavailable on this device",
  preparing: "Preparing card reader…",
  prepare_failed: "We couldn't start the card reader. Please ask staff for help.",
  reader_failed: "The card reader didn't respond",
  collecting: "Follow the instructions on the card reader.",
  verifying: "Confirming payment…",
  paid: "Payment complete. Thank you!",
  declined: "Card declined. Please ask staff for help.",
}

const chargeUrl = (chargeId: string, action: "prepare" | "result") =>
  `/api/staff/terminal/charges/${encodeURIComponent(chargeId)}/${action}`

/** Reports a tablet outcome; resolves with null on success or the server's reason ("" when none). */
async function postResult(chargeId: string, outcome: "declined" | "cancelled"): Promise<string | null> {
  try {
    const res = await fetch(chargeUrl(chargeId, "result"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) })
    if (res.ok) return null
    const data = (await res.json().catch(() => null)) as { error?: unknown } | null
    return typeof data?.error === "string" ? data.error : ""
  } catch {
    return "" // The panel still sees the charge; it expires or staff cancel it there.
  }
}

/**
 * Hands the prepared reference to the existing native bridge (its calls time out on their own) and
 * follows the admitted operation until it settles, `isStopped()` (takeover ended or unmounted), or
 * the reader deadline passes; then the outcome is uncertain and only the server settles the charge.
 */
async function collectOnReader(reference: string, pollIntervalMs: number, isStopped: () => boolean) {
  const handoff = await handOffPreparedPurchase(reference)
  if (handoff.state === "rejected") return "handoff_rejected" // no card was presented: not a decline
  if ((handoff.state !== "accepted" && handoff.state !== "pending") || !handoff.operationReference) return "uncertain"
  const deadline = Date.now() + TERMINAL_CHARGE_COLLECT_DEADLINE_MS
  while (!isStopped() && Date.now() < deadline) {
    const state = await pollPreparedPurchaseState(handoff.operationReference)
    if (state !== "pending") return state === "paid" || state === "rejected" ? state : "uncertain"
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
  return "uncertain"
}

/**
 * Full-screen takeover for a staff charge addressed to this tablet: shows the charge, prepares
 * it once, collects it on the paired M2 through the existing native bridge, and returns the kiosk
 * home when the charge ends. Reader prompts come from the kiosk's own NativeTapToPayPopup.
 */
export function TerminalChargeTakeover({ onReturnHome, onActiveChange, collectionPollMs = 500 }: {
  onReturnHome: () => void
  onActiveChange?: (active: boolean) => void
  collectionPollMs?: number
}) {
  const serverCharge = useTerminalChargePoll()
  const [charge, setCharge] = useState<TerminalChargeView | null>(null)
  const [phase, setPhaseState] = useState<Phase>("idle")
  const [stuckCancelReady, setStuckCancelReady] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const phaseRef = useRef<Phase>("idle")
  const activeIdRef = useRef<string | null>(null)
  const handledIds = useRef(new Set<string>())
  const declineUnreported = useRef(false)
  const screenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onReturnHomeRef = useRef(onReturnHome)
  onReturnHomeRef.current = onReturnHome

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const finish = useCallback((chargeId: string) => {
    if (activeIdRef.current !== chargeId) return
    if (screenTimer.current) clearTimeout(screenTimer.current)
    handledIds.current.add(chargeId)
    declineUnreported.current = false
    activeIdRef.current = null // also stops following the reader
    setCharge(null)
    setPhase("idle")
    onReturnHomeRef.current()
  }, [setPhase])

  // A decline counts as handled only once the server accepted it; until then it stays on screen
  // with the reason and is re-sent on each poll (the server may refuse while a payment is settling).
  const reportDecline = useCallback(async (chargeId: string) => {
    const refusal = await postResult(chargeId, "declined")
    if (activeIdRef.current !== chargeId || !declineUnreported.current) return
    if (refusal !== null) return setCancelError(refusal || "Couldn't report the declined card. Retrying…")
    declineUnreported.current = false
    setCancelError(null)
    screenTimer.current = setTimeout(() => finish(chargeId), TERMINAL_CHARGE_DECLINED_SCREEN_MS)
  }, [finish])

  const showOutcome = useCallback((chargeId: string, outcome: "paid" | "declined") => {
    if (activeIdRef.current !== chargeId || phaseRef.current === "paid" || (phaseRef.current === "declined" && !declineUnreported.current)) return
    setPhase(outcome)
    declineUnreported.current = outcome === "declined"
    if (outcome === "declined") void reportDecline(chargeId)
    else screenTimer.current = setTimeout(() => finish(chargeId), TERMINAL_CHARGE_PAID_SCREEN_MS)
  }, [finish, reportDecline, setPhase])

  const collect = useCallback(async (chargeId: string) => {
    const request = new AbortController()
    const timeout = setTimeout(() => request.abort(), TERMINAL_CHARGE_POLL_TIMEOUT_MS)
    const prepared = await fetch(chargeUrl(chargeId, "prepare"), { method: "POST", signal: request.signal })
      .then(async (res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .finally(() => clearTimeout(timeout))
    const isStopped = () => activeIdRef.current !== chargeId || phaseRef.current !== "collecting"
    if (activeIdRef.current !== chargeId) return
    if (!isPreparedPurchaseResponse(prepared)) return setPhase("prepare_failed")
    setPhase("collecting")
    const outcome = await collectOnReader(prepared.preparedPurchaseReference, collectionPollMs, isStopped).catch(() => "uncertain")
    clearNativeCollectionPrompt()
    if (activeIdRef.current !== chargeId) return
    if (outcome === "paid") showOutcome(chargeId, "paid")
    else if (outcome === "rejected") showOutcome(chargeId, "declined")
    else if (outcome === "handoff_rejected") setPhase("reader_failed")
    // The reader may still have charged the card: only the server (webhook) can settle it.
    else if (phaseRef.current === "collecting") setPhase("verifying")
  }, [collectionPollMs, setPhase, showOutcome])

  useEffect(() => {
    const activeId = activeIdRef.current
    if (!activeId) {
      if (!serverCharge || isTerminalChargeFinal(serverCharge.status) || handledIds.current.has(serverCharge.id)) return
      activeIdRef.current = serverCharge.id
      setCharge(serverCharge)
      if (serverCharge.status === "collecting") setPhase("verifying")
      else if (!isNativePaymentBridgeAvailable()) setPhase("unavailable")
      else {
        setPhase("preparing")
        void collect(serverCharge.id)
      }
      return
    }
    if (phaseRef.current === "paid" || (phaseRef.current === "declined" && !declineUnreported.current)) return
    // The server ended the charge (webhook paid, staff cancel, expiry): follow it and stop the reader.
    const same = serverCharge?.id === activeId ? serverCharge : null
    if (same?.status === "paid" && phaseRef.current !== "unavailable" && phaseRef.current !== "prepare_failed") showOutcome(activeId, "paid")
    else if (!same || isTerminalChargeFinal(same.status)) finish(activeId)
    else if (declineUnreported.current) void reportDecline(activeId)
  }, [serverCharge, collect, finish, reportDecline, setPhase, showOutcome])

  useEffect(() => {
    onActiveChange?.(phase !== "idle")
  }, [onActiveChange, phase])

  // An uncertain collection can stay "Confirming payment…" forever; after a while let the
  // customer/staff cancel it. The server refuses when the card was charged or is being processed.
  useEffect(() => {
    setStuckCancelReady(false)
    if (phase !== "declined") setCancelError(null) // a declined screen keeps its report error
    if (phase !== "verifying") return
    const timer = setTimeout(() => setStuckCancelReady(true), TERMINAL_CHARGE_STUCK_CANCEL_MS)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => () => {
    if (screenTimer.current) clearTimeout(screenTimer.current)
    activeIdRef.current = null
  }, [])

  // Only a confirmed cancel ends the takeover; on failure the charge stays on screen with the
  // reason and polling continues, so the tablet never ignores a charge the server still has.
  const handleCancel = async () => {
    const chargeId = activeIdRef.current
    if (!chargeId || cancelBusy) return
    setCancelBusy(true)
    setCancelError(null)
    const refusal = await postResult(chargeId, "cancelled")
    setCancelBusy(false)
    if (refusal === null) finish(chargeId)
    else setCancelError(refusal || "Couldn't cancel the charge. Please try again.")
  }

  if (phase === "idle" || !charge) return null
  const notStarted = phase === "unavailable" || phase === "prepare_failed" || phase === "reader_failed"
  const canCancel = notStarted || (phase === "verifying" && stuckCancelReady)
  const statusTone = phase === "paid" ? "text-emerald-300" : phase === "declined" || notStarted ? "text-red-300" : "text-white/80"

  return (
    <div data-terminal-charge-takeover role="dialog" aria-modal="true" aria-label="Staff charge" className="fixed inset-0 z-[11000] flex items-center justify-center bg-[#13141d] px-4 text-white">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[#12141d] p-6">
        <p className="text-sm uppercase tracking-wide text-white/50">Payment requested by staff</p>
        <p className="mt-1 text-2xl font-semibold">{charge.payerName}</p>
        <ul className="mt-5 divide-y divide-white/10 border-y border-white/10">
          {charge.items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-4 py-3 text-base">
              <span className="min-w-0 text-white/90">{item.label}</span>
              <span className="shrink-0 tabular-nums">{formatMoney(item.amountCents, charge.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-lg text-white/70">Total</span>
          <span className="text-3xl font-semibold tabular-nums">{formatMoney(charge.totalCents, charge.currency)}</span>
        </div>
        <div aria-live="assertive" className={`mt-6 text-center text-xl font-medium ${statusTone}`}>{STATUS_TEXT[phase]}</div>
        {cancelError ? <p role="status" className="mt-4 text-center text-base text-amber-200">{cancelError}</p> : null}
        {canCancel ? (
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={cancelBusy}
            className="mt-6 w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-base font-semibold text-white hover:bg-white/10 disabled:opacity-60"
          >
            {phase === "verifying" ? "Cancel charge" : "Cancel"}
          </button>
        ) : null}
      </div>
    </div>
  )
}
