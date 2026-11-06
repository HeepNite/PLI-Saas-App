"use client"

import { useEffect, useState } from "react"
import { TERMINAL_CHARGE_POLL_MS, type TerminalChargeView } from "@/lib/terminal-charges/contract"

export const TERMINAL_CHARGE_PENDING_URL = "/api/staff/terminal/charges/pending"
/** A pending-charge read that takes longer is aborted, so a hung request never stops polling. */
export const TERMINAL_CHARGE_POLL_TIMEOUT_MS = 8_000

const isVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden"

/**
 * Polls the charge addressed to this tablet (terminal cookie, same origin) while the page is
 * visible. A failed or malformed read keeps the last known charge, so a transient network error
 * never closes a takeover in progress; a lost terminal session (401/403) clears it.
 */
export function useTerminalChargePoll(intervalMs = TERMINAL_CHARGE_POLL_MS) {
  const [charge, setCharge] = useState<TerminalChargeView | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let request: AbortController | null = null

    async function poll() {
      timer = null
      if (cancelled || request || !isVisible()) return
      const controller = new AbortController()
      request = controller
      const timeout = setTimeout(() => controller.abort(), TERMINAL_CHARGE_POLL_TIMEOUT_MS)
      try {
        const res = await fetch(TERMINAL_CHARGE_PENDING_URL, { cache: "no-store", signal: controller.signal })
        const data = res.ok ? ((await res.json()) as { charge?: TerminalChargeView | null }) : null
        const next = res.status === 401 || res.status === 403 ? null : data?.charge
        if (!cancelled && (next === null || typeof next?.id === "string")) setCharge(next ?? null)
      } catch {
        // Keep the last known charge (also on a timed-out read); the next poll retries.
      } finally {
        clearTimeout(timeout)
        request = null
        if (!cancelled && isVisible()) timer = setTimeout(poll, intervalMs)
      }
    }

    const handleVisibility = () => {
      if (timer) clearTimeout(timer)
      timer = null
      void poll()
    }

    void poll()
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      cancelled = true
      request?.abort()
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [intervalMs])

  return charge
}
