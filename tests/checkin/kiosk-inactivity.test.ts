import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  KIOSK_INACTIVITY_TIMEOUT_MS,
  createKioskInactivityController,
} from "@/lib/checkin/kiosk-inactivity"

describe("kiosk inactivity controller", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("triggers the reset callback after inactivity", () => {
    const onTimeout = vi.fn()
    const controller = createKioskInactivityController({ onTimeout })

    controller.arm()
    vi.advanceTimersByTime(KIOSK_INACTIVITY_TIMEOUT_MS)

    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it("re-arms the timeout when activity occurs", () => {
    const onTimeout = vi.fn()
    const controller = createKioskInactivityController({ onTimeout })

    controller.arm()
    vi.advanceTimersByTime(KIOSK_INACTIVITY_TIMEOUT_MS - 1)
    controller.arm()
    vi.advanceTimersByTime(1)

    expect(onTimeout).not.toHaveBeenCalled()

    vi.advanceTimersByTime(KIOSK_INACTIVITY_TIMEOUT_MS)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })
})
