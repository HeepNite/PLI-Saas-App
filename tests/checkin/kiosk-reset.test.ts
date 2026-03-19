import { describe, expect, it, vi } from "vitest"
import { completeKioskCustomerFlow } from "@/lib/checkin/kiosk-reset"

describe("completeKioskCustomerFlow", () => {
  it("resets the kiosk state and signs out only the temporary local customer session", async () => {
    const events: string[] = []
    const resetCustomerState = vi.fn(() => {
      events.push("reset")
    })
    const signOut = vi.fn(async ({ redirectUrl, sessionId }: { redirectUrl: string; sessionId?: string }) => {
      events.push(`signout:${redirectUrl}:${sessionId || "none"}`)
    })

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: true,
      isCustomerSignedIn: true,
      redirectUrl: "/checkin?courseSlug=test",
      sessionId: "sess_terminal_123",
      signOut,
    })

    expect(resetCustomerState).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledWith({
      redirectUrl: "/checkin?courseSlug=test",
      sessionId: "sess_terminal_123",
    })
    expect(events).toEqual(["reset", "signout:/checkin?courseSlug=test:sess_terminal_123"])
  })

  it("does not sign out when no temporary customer session is active", async () => {
    const resetCustomerState = vi.fn()
    const signOut = vi.fn()

    await completeKioskCustomerFlow({
      resetCustomerState,
      isKioskTerminalFlow: true,
      isCustomerSignedIn: false,
      redirectUrl: "/checkin",
      sessionId: "sess_terminal_123",
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
      sessionId: "sess_terminal_123",
      signOut,
    })

    expect(resetCustomerState).toHaveBeenCalledOnce()
    expect(signOut).not.toHaveBeenCalled()
  })
})
