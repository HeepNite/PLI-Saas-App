import { describe, expect, it } from "vitest"

import {
  KIOSK_DEPLOY_MIN_RELOAD_INTERVAL_MS,
  shouldReloadForNewDeploy,
  type KioskDeployRefreshInput,
} from "@/lib/checkin/kiosk-deploy-refresh"

const NOW = 1_700_000_000_000

const baseInput = (overrides: Partial<KioskDeployRefreshInput> = {}): KioskDeployRefreshInput => ({
  runningBuildId: "sha-old",
  serverBuildId: "sha-new",
  hasSensitiveCustomerState: false,
  lastReloadAttemptAt: null,
  now: NOW,
  ...overrides,
})

describe("shouldReloadForNewDeploy", () => {
  it("returns true when ids differ, kiosk is idle, and no prior reload attempt", () => {
    expect(shouldReloadForNewDeploy(baseInput())).toBe(true)
  })

  describe("build id gates", () => {
    const cases: Array<{ name: string; overrides: Partial<KioskDeployRefreshInput> }> = [
      { name: "same build id on both sides", overrides: { serverBuildId: "sha-old" } },
      { name: "null running build id", overrides: { runningBuildId: null } },
      { name: "empty running build id", overrides: { runningBuildId: "" } },
      { name: "null server build id", overrides: { serverBuildId: null } },
      { name: "empty server build id", overrides: { serverBuildId: "" } },
      { name: "dev sentinel server build id", overrides: { serverBuildId: "dev" } },
      { name: "dev sentinel running build id", overrides: { runningBuildId: "dev" } },
    ]

    it.each(cases)("returns false with $name", ({ overrides }) => {
      expect(shouldReloadForNewDeploy(baseInput(overrides))).toBe(false)
    })
  })

  it("returns false while the kiosk has sensitive customer state", () => {
    expect(shouldReloadForNewDeploy(baseInput({ hasSensitiveCustomerState: true }))).toBe(false)
  })

  describe("reload interval throttle", () => {
    it("returns false when the last attempt is within the default interval", () => {
      const input = baseInput({
        lastReloadAttemptAt: NOW - KIOSK_DEPLOY_MIN_RELOAD_INTERVAL_MS + 1,
      })
      expect(shouldReloadForNewDeploy(input)).toBe(false)
    })

    it("returns true when the last attempt is older than the default interval", () => {
      const input = baseInput({
        lastReloadAttemptAt: NOW - KIOSK_DEPLOY_MIN_RELOAD_INTERVAL_MS,
      })
      expect(shouldReloadForNewDeploy(input)).toBe(true)
    })

    it("honors a custom minReloadIntervalMs", () => {
      const input = baseInput({ lastReloadAttemptAt: NOW - 5_000, minReloadIntervalMs: 10_000 })
      expect(shouldReloadForNewDeploy(input)).toBe(false)
      expect(
        shouldReloadForNewDeploy({ ...input, lastReloadAttemptAt: NOW - 10_000 })
      ).toBe(true)
    })
  })
})
