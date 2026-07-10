"use client"

import { useEffect, useRef, useState } from "react"

import {
  KIOSK_DEPLOY_POLL_INTERVAL_MS,
  shouldReloadForNewDeploy,
} from "@/lib/checkin/kiosk-deploy-refresh"

const BUILD_ID_ENDPOINT = "/api/build-id"

/**
 * sessionStorage key for the last reload attempt timestamp. Reload wipes all
 * in-memory JS state, so the throttle must be persisted somewhere that
 * survives a same-tab reload — sessionStorage does, and is scoped to the
 * kiosk's single home-app session (a full app restart clears it, which is
 * acceptable).
 */
const LAST_RELOAD_ATTEMPT_STORAGE_KEY = "kiosk-deploy-refresh:last-reload-attempt-at"

/** Guarded so a misconfigured build id only warns once per session, not per poll. */
let hasWarnedAboutMissingBuildId = false

/**
 * Build id baked into the client bundle by Vercel at build time.
 * Empty in local dev, which makes the whole feature a no-op there.
 */
const getRunningBuildId = (): string | null =>
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null

const warnIfBuildIdMissingInProduction = (runningBuildId: string | null) => {
  if (runningBuildId) return
  if (process.env.NODE_ENV !== "production") return
  if (hasWarnedAboutMissingBuildId) return
  hasWarnedAboutMissingBuildId = true
  console.warn(
    "[useKioskDeployRefresh] NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is empty in production — " +
      "the kiosk auto-reload watchdog is disabled. Check that the build id env var is inlined at build time."
  )
}

const fetchServerBuildId = async (): Promise<string | null> => {
  const res = await fetch(BUILD_ID_ENDPOINT, { cache: "no-store" })
  if (!res.ok) return null
  const payload: unknown = await res.json()
  const buildId = (payload as { buildId?: unknown } | null)?.buildId
  return typeof buildId === "string" ? buildId : null
}

/**
 * Reads the persisted last-reload-attempt timestamp. sessionStorage access is
 * try/caught because Safari private mode (and storage-disabled environments)
 * throws on access — the feature must never crash the kiosk over this.
 */
const readPersistedLastReloadAttemptAt = (): number | null => {
  try {
    const raw = window.sessionStorage.getItem(LAST_RELOAD_ATTEMPT_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Best-effort persist. Silently no-ops when sessionStorage throws or is unavailable. */
const persistLastReloadAttemptAt = (timestamp: number): void => {
  try {
    window.sessionStorage.setItem(LAST_RELOAD_ATTEMPT_STORAGE_KEY, String(timestamp))
  } catch {
    // Ignore — the in-memory ref still throttles for the lifetime of this mount.
  }
}

export type UseKioskDeployRefreshInput = {
  /** Kiosk terminal surfaces only — the hook is inert when false. */
  enabled: boolean
  /** Live getter for the terminal sensitive-customer-state signal. */
  isFlowActive: () => boolean
  /** Test seam. Defaults to a full page reload. */
  reloadPage?: () => void
}

/**
 * Kiosk-only watchdog that polls /api/build-id every 5 minutes (and when the
 * tab becomes visible again) and reloads the page when a new deployment is
 * live AND no customer flow is in progress. The 24/7 terminal otherwise keeps
 * serving a stale bundle (broken hashed assets, outdated logic) forever.
 *
 * Fetch failures are silently ignored — the kiosk must never be disturbed.
 */
export function useKioskDeployRefresh({
  enabled,
  isFlowActive,
  reloadPage,
}: UseKioskDeployRefreshInput) {
  // Seeded from sessionStorage exactly once (first render) so the throttle
  // survives a same-tab reload (window.location.reload() wipes all in-memory
  // state). useState's lazy initializer form guarantees this runs only once,
  // unlike a plain useRef(readPersistedLastReloadAttemptAt()) call, which
  // would re-invoke the initializer expression on every render.
  const lastReloadAttemptAtRef = useRef<number | null>(
    useState(readPersistedLastReloadAttemptAt)[0]
  )
  const reloadPageRef = useRef(reloadPage)
  reloadPageRef.current = reloadPage
  // Prevents two concurrent checkForNewDeploy runs (interval tick racing a
  // visibilitychange) from both passing the gate before either awaited fetch
  // resolves and updates the throttle timestamp.
  const checkInFlightRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const runningBuildId = getRunningBuildId()
    warnIfBuildIdMissingInProduction(runningBuildId)
    if (!runningBuildId) return

    let cancelled = false

    const checkForNewDeploy = async () => {
      if (checkInFlightRef.current) return
      checkInFlightRef.current = true

      try {
        let serverBuildId: string | null = null
        try {
          serverBuildId = await fetchServerBuildId()
        } catch {
          return
        }
        if (cancelled) return

        const now = Date.now()
        const reload = shouldReloadForNewDeploy({
          runningBuildId,
          serverBuildId,
          hasSensitiveCustomerState: isFlowActive(),
          lastReloadAttemptAt: lastReloadAttemptAtRef.current,
          now,
        })
        if (!reload) return

        lastReloadAttemptAtRef.current = now
        persistLastReloadAttemptAt(now)
        const reloadPageFn = reloadPageRef.current ?? (() => window.location.reload())
        reloadPageFn()
      } finally {
        checkInFlightRef.current = false
      }
    }

    const interval = setInterval(() => {
      void checkForNewDeploy()
    }, KIOSK_DEPLOY_POLL_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      void checkForNewDeploy()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, isFlowActive])
}
