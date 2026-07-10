export const KIOSK_DEPLOY_POLL_INTERVAL_MS = 5 * 60_000
export const KIOSK_DEPLOY_MIN_RELOAD_INTERVAL_MS = 10 * 60_000

/**
 * Sentinel returned by /api/build-id when no commit sha env var is available
 * (local dev). Treated as "unknown" so the kiosk never reloads against it —
 * this also protects an unattended kiosk from a reload loop if the server
 * ever flaps back to the fallback while the client holds a real sha.
 */
export const UNKNOWN_BUILD_ID = "dev"

export type KioskDeployRefreshInput = {
  runningBuildId: string | null
  serverBuildId: string | null
  hasSensitiveCustomerState: boolean
  lastReloadAttemptAt: number | null
  now: number
  minReloadIntervalMs?: number
}

const isKnownBuildId = (buildId: string | null): buildId is string =>
  Boolean(buildId) && buildId !== UNKNOWN_BUILD_ID

/**
 * Pure gate for the kiosk auto-reload-on-new-deploy behavior.
 *
 * Returns true only when:
 * - both build ids are known (non-empty and not the dev sentinel),
 * - they differ (a new deployment is live),
 * - the kiosk is NOT in a customer flow, and
 * - the last reload attempt is older than `minReloadIntervalMs`
 *   (prevents reload loops if the server build id flaps).
 */
export const shouldReloadForNewDeploy = (input: KioskDeployRefreshInput): boolean => {
  if (!isKnownBuildId(input.runningBuildId)) return false
  if (!isKnownBuildId(input.serverBuildId)) return false
  if (input.runningBuildId === input.serverBuildId) return false
  if (input.hasSensitiveCustomerState) return false

  const minReloadIntervalMs = input.minReloadIntervalMs ?? KIOSK_DEPLOY_MIN_RELOAD_INTERVAL_MS
  if (
    input.lastReloadAttemptAt !== null &&
    input.now - input.lastReloadAttemptAt < minReloadIntervalMs
  ) {
    return false
  }

  return true
}
