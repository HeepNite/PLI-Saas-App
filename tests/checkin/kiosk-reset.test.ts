import { describe, expect, it, vi } from "vitest"
import { completeKioskCustomerFlow } from "@/lib/checkin/kiosk-reset"

describe("completeKioskCustomerFlow", () => {
  it("resets the kiosk state and replaces the local terminal URL without global sign out", async () => {
    const events: string[] = []
    const resetCustomerState = vi.fn(() => {
      events.push("reset")
    })
    const replaceUrl = vi.fn(async (url: string) => {
      events.push(`replace:${url}`)
    })

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: true,
      resetUrl: "/checkin?courseSlug=test",
      replaceUrl,
    })

    expect(resetCustomerState).toHaveBeenCalledOnce()
    expect(replaceUrl).toHaveBeenCalledWith("/checkin?courseSlug=test")
    expect(events).toEqual(["reset", "replace:/checkin?courseSlug=test"])
  })

  it("signs out the kiosk customer session before replacing the terminal URL", async () => {
    const events: string[] = []
    const resetCustomerState = vi.fn(() => {
      events.push("reset")
    })
    const signOutCustomerSession = vi.fn(async () => {
      events.push("signout")
    })
    const replaceUrl = vi.fn(async (url: string) => {
      events.push(`replace:${url}`)
    })

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: true,
      resetUrl: "/checkin?courseSlug=test",
      replaceUrl,
      signOutCustomerSession,
    })

    expect(signOutCustomerSession).toHaveBeenCalledOnce()
    expect(replaceUrl).toHaveBeenCalledWith("/checkin?courseSlug=test")
    expect(events).toEqual(["signout", "reset", "replace:/checkin?courseSlug=test"])
  })

  it("keeps the kiosk local reset and URL reset even if Clerk sign-out fails", async () => {
    const signOutCustomerSession = vi.fn(async () => {
      throw new Error("clerk unavailable")
    })
    const resetCustomerState = vi.fn()
    const replaceUrl = vi.fn()

    await expect(
      completeKioskCustomerFlow({
        resetCustomerState,
        isKioskTerminalFlow: true,
        resetUrl: "/checkin",
        replaceUrl,
        signOutCustomerSession,
      })
    ).rejects.toThrow("clerk unavailable")

    expect(resetCustomerState).toHaveBeenCalledOnce()
    expect(replaceUrl).toHaveBeenCalledWith("/checkin")
  })

  it("does not replace the URL for non-kiosk flows", async () => {
    const resetCustomerState = vi.fn()
    const replaceUrl = vi.fn()

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: false,
      resetUrl: "/checkin",
      replaceUrl,
    })

    expect(resetCustomerState).toHaveBeenCalledOnce()
    expect(replaceUrl).not.toHaveBeenCalled()
  })

  it("does not replace the URL when no reset target is provided", async () => {
    const resetCustomerState = vi.fn()
    const replaceUrl = vi.fn()
    const signOutCustomerSession = vi.fn()

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: true,
      replaceUrl,
      signOutCustomerSession,
    })

    expect(resetCustomerState).toHaveBeenCalledOnce()
    expect(signOutCustomerSession).toHaveBeenCalledOnce()
    expect(replaceUrl).not.toHaveBeenCalled()
  })
})
