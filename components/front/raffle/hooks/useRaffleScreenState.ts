"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type RaffleScreenWinnerPayload = {
  name: string
  phoneLast4: string
}

export type RaffleScreenDrawPayload = {
  id: string
  order: number
  prizeLabel: string
  status: string
  drawAt: string | null
  winner?: RaffleScreenWinnerPayload
}

/** Mirrors `lib/raffle/screen-state.ts`'s `RaffleScreenState`, but with dates
 * as the ISO strings they actually arrive as over JSON. */
export type RaffleScreenStatePayload = {
  now: string
  event: { slug: string; title: string; entryUrl: string }
  entryCount: number
  currentDrawId: string | null
  draws: RaffleScreenDrawPayload[]
}

const POLL_INTERVAL_MS = 5_000

type UseRaffleScreenStateResult = {
  data: RaffleScreenStatePayload | null
  error: string | null
  /** Manual poll, exposed so a failed draw can force a fresher read. */
  refresh: () => void
}

/**
 * Polls `GET /api/raffle/[slug]/screen-state` every ~5s (design.md D6).
 * Paused (no fetch issued) while `paused` is true, so an in-flight draw or
 * the reveal being shown is never disturbed by a stale response racing in —
 * and, in PR4b2, while the draw video plays.
 */
export function useRaffleScreenState(slug: string, paused: boolean): UseRaffleScreenStateResult {
  const [data, setData] = useState<RaffleScreenStatePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const poll = useCallback(async () => {
    if (pausedRef.current) return
    try {
      const res = await fetch(`/api/raffle/${encodeURIComponent(slug)}/screen-state`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as RaffleScreenStatePayload
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Poll failed")
    }
  }, [slug])

  useEffect(() => {
    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [poll])

  return { data, error, refresh: poll }
}
