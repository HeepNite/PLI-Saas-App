import { describe, expect, it, vi } from "vitest"
import { completeKioskCustomerFlow } from "@/lib/checkin/kiosk-reset"

describe("completeKioskCustomerFlow", () => {
  it("resets the kiosk state and signs out the temporary customer session", async () => {
    const events: string[] = []
    const resetCustomerState = vi.fn(() => {
      events.push("reset")
    })
    const signOut = vi.fn(async ({ redirectUrl }: { redirectUrl: string }) => {
      events.push(`signout:${redirectUrl}`)
    })

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: true,
      isCustomerSignedIn: true,
      redirectUrl: "/checkin?courseSlug=test",
      signOut,
    })

    expect(resetCustomerState).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledWith({ redirectUrl: "/checkin?courseSlug=test" })
    expect(events).toEqual(["reset", "signout:/checkin?courseSlug=test"])
  })

  it("does not sign out when no temporary customer session is active", async () => {
    const resetCustomerState = vi.fn()
    const signOut = vi.fn()

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: true,
      isCustomerSignedIn: false,
      redirectUrl: "/checkin",
      signOut,
    })

    expect(resetCustomerState).toHaveBeenCalledOnce()
    expect(signOut).not.toHaveBeenCalled()
  })

  it("does not sign out for non-kiosk flows", async () => {
    const resetCustomerState = vi.fn()
    const signOut = vi.fn()

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: false,
      isCustomerSignedIn: true,
      redirectUrl: "/checkin",
      signOut,
    })

    expect(resetCustomerState).toHaveBeenCalledOnce()
    expect(signOut).not.toHaveBeenCalled()
  })
})
