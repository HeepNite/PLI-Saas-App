"use client"

import { useEffect, useRef } from "react"

import {
  KIOSK_DEPLOY_POLL_INTERVAL_MS,
  shouldReloadForNewDeploy,
} from "@/lib/checkin/kiosk-deploy-refresh"

const BUILD_ID_ENDPOINT = "/api/build-id"

/**
 * Build id baked into the client bundle by Vercel at build time.
 * Empty in local dev, which makes the whole feature a no-op there.
 */
const getRunningBuildId = (): string | null =>
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null

const fetchServerBuildId = async (): Promise<string | null> => {
  const res = await fetch(BUILD_ID_ENDPOINT, { cache: "no-store" })
  if (!res.ok) return null
  const payload: unknown = await res.json()
  const buildId = (payload as { buildId?: unknown } | null)?.buildId
  return typeof buildId === "string" ? buildId : null
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
  const lastReloadAttemptAtRef = useRef<number | null>(null)
  const reloadPageRef = useRef(reloadPage)
  reloadPageRef.current = reloadPage

  useEffect(() => {
    if (!enabled) return

    const runningBuildId = getRunningBuildId()
    if (!runningBuildId) return

    let cancelled = false

    const checkForNewDeploy = async () => {
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
      const reloadPageFn = reloadPageRef.current ?? (() => window.location.reload())
      reloadPageFn()
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
