import { describe, expect, it, vi } from "vitest"
import { completeKioskCustomerFlow } from "@/lib/checkin/kiosk-reset"

describe("completeKioskCustomerFlow", () => {
  it("always resets kiosk customer state", async () => {
    const resetCustomerState = vi.fn()

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: true,
    })

    expect(resetCustomerState).toHaveBeenCalledOnce()
  })

  it("also resets state when not in kiosk terminal flow", async () => {
    const resetCustomerState = vi.fn()

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: false,
    })

    expect(resetCustomerState).toHaveBeenCalledOnce()
  })
})
