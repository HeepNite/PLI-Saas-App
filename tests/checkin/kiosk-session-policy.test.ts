import { describe, expect, it } from "vitest"
import { CURRENT_CLERK_SESSION_SUPPRESSION } from "@/components/front/checkin/checkin-kiosk.types"
import {
  hasActiveKioskClerkSession,
  resolveSuppressedClerkSessionIdOnCompletion,
  shouldClearSuppressedClerkSessionId,
} from "@/lib/checkin/kiosk-session-policy"

describe("kiosk session policy", () => {
  it("hides privileged terminal clerk sessions from the customer flow", () => {
    expect(
      hasActiveKioskClerkSession({
        activeSessionId: "sess_staff",
        hasPrivilegedClerkSession: true,
        isKioskTerminalFlow: true,
        isSignedIn: true,
        suppressedClerkSessionId: null,
      })
    ).toBe(false)
  })

  it("suppresses the currently active session when completion falls back to the current clerk session", () => {
    expect(
      resolveSuppressedClerkSessionIdOnCompletion({
        activeSessionId: null,
        isSignedIn: true,
        kioskClerkSessionId: null,
      })
    ).toBe(CURRENT_CLERK_SESSION_SUPPRESSION)
  })

  it("keeps the customer signed out while the current session suppression token is active", () => {
    expect(
      hasActiveKioskClerkSession({
        activeSessionId: "sess_customer",
        hasPrivilegedClerkSession: false,
        isKioskTerminalFlow: false,
        isSignedIn: true,
        suppressedClerkSessionId: CURRENT_CLERK_SESSION_SUPPRESSION,
      })
    ).toBe(false)
    expect(
      shouldClearSuppressedClerkSessionId({
        activeSessionId: "sess_customer",
        isSignedIn: true,
        suppressedClerkSessionId: CURRENT_CLERK_SESSION_SUPPRESSION,
      })
    ).toBe(false)
  })

  it("clears a specific suppressed session once a different active session appears", () => {
    expect(
      shouldClearSuppressedClerkSessionId({
        activeSessionId: "sess_new",
        isSignedIn: true,
        suppressedClerkSessionId: "sess_old",
      })
    ).toBe(true)
  })

  it("clears suppression after sign out", () => {
    expect(
      shouldClearSuppressedClerkSessionId({
        activeSessionId: null,
        isSignedIn: false,
        suppressedClerkSessionId: "sess_old",
      })
    ).toBe(true)
  })
})
