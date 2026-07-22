// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useKioskPinFlow } from "@/components/front/checkin/useKioskPinFlow"

type HookSnapshot = ReturnType<typeof useKioskPinFlow<{ ready: boolean }>> & {
  bootstrap: { ready: boolean } | null
  error: string | null
  success: string | null
}

const IDENTIFY_ROTATION_RESPONSE = {
  identified: true as const,
  credentialKind: "provisional" as const,
  requiresPinRotation: true,
  sessionToken: "session_123",
  sessionExpiresAt: "2026-03-31T15:00:00.000Z",
}

const IDENTIFY_PERMANENT_RESPONSE = {
  identified: true as const,
  credentialKind: "permanent" as const,
  requiresPinRotation: false,
  sessionToken: "session_456",
  sessionExpiresAt: "2026-03-31T15:00:00.000Z",
}

const ROTATE_OK_RESPONSE = {
  rotated: true,
}

const FAST_PATH_RESPONSE = {
  identified: true as const,
  path: "fast" as const,
  sessionToken: "kiosk_session_fast",
  sessionExpiresAt: "2026-03-31T15:00:00.000Z",
  customer: {
    userId: "user_1",
    name: "Jane Student",
    email: "jane@example.com",
    phone: "15551112222",
  },
  package: {
    id: "pkg_1",
    packageId: "pkg_plan_1",
    packageLabel: "Starter",
    courseSlug: "salsa",
    isUnlimited: false,
    remainingCredits: 4,
    expiresAt: null,
    status: "active",
  },
  context: {
    courseSlug: "salsa",
    courseTitle: "Salsa",
    date: "2026-06-01",
    time: "11:00",
    durationMinutes: 60,
    startsAt: "2026-06-01T15:00:00.000Z",
    endsAt: "2026-06-01T16:00:00.000Z",
    checkInWindow: { isOpen: true, opensAt: "2026-06-01T13:00:00.000Z", closesAt: "2026-06-01T18:00:00.000Z" },
  },
  hasExistingPurchaseForSession: false,
  hasAnyActivePackage: true as const,
  consecutiveOffer: null,
  quickCheckout: null,
}

const UNKNOWN_PHONE_RESPONSE = {
  identified: false as const,
  terminalBlocked: false,
  blockedUntil: null,
  attemptsRemaining: 4,
  severity: "normal" as const,
  message: "We couldn't find an account with that phone number.",
}

const createJsonResponse = (payload: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as Response

type HarnessOptions = {
  contextPayload?: Record<string, unknown>
  adaptIdentifyAndBootstrapResponse?: (data: unknown) => { ready: boolean }
}

const renderHookHarness = async (options: HarnessOptions = {}) => {
  let snapshot: HookSnapshot | null = null

  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  function Harness() {
    const [bootstrap, setBootstrap] = React.useState<{ ready: boolean } | null>({ ready: true })
    const [error, setError] = React.useState<string | null>(null)
    const [success, setSuccess] = React.useState<string | null>(null)
    const hook = useKioskPinFlow<{ ready: boolean }>({
      isKioskTerminalFlow: true,
      setBootstrap,
      setError,
      setSuccess,
      pinLastDigitRevealMs: 25,
      contextPayload: options.contextPayload,
      adaptIdentifyAndBootstrapResponse: options.adaptIdentifyAndBootstrapResponse as
        | ((data: import("@/lib/checkin/types/identify-and-bootstrap").FastPathResponse | import("@/lib/checkin/types/identify-and-bootstrap").FullPathResponse) => { ready: boolean })
        | undefined,
    })

    snapshot = {
      ...hook,
      bootstrap,
      error,
      success,
    }

    return null
  }

  await act(async () => {
    root.render(<Harness />)
  })

  return {
    getSnapshot: () => {
      if (!snapshot) {
        throw new Error("Hook snapshot not ready")
      }
      return snapshot
    },
    root,
    container,
  }
}

const inputDigits = async (getSnapshot: () => HookSnapshot, digits: string) => {
  for (const digit of digits) {
    await act(async () => {
      getSnapshot().handlePinDigitInput(digit)
    })
  }
}

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

describe("useKioskPinFlow", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("identifies a kiosk PIN and routes keypad input into rotation fields", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse(IDENTIFY_ROTATION_RESPONSE))

    const rendered = await renderHookHarness()
    root = rendered.root
    container = rendered.container

    await inputDigits(rendered.getSnapshot, "1234")

    expect(rendered.getSnapshot().kioskPin).toBe("1234")
    expect(rendered.getSnapshot().entryActiveSlot).toBe(3)
    expect(rendered.getSnapshot().activePinField).toBe("entry")

    await act(async () => {
      await rendered.getSnapshot().handleKioskPinIdentify()
    })

    expect(fetch).toHaveBeenCalledWith(
      "/api/checkin/pin/identify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ pin: "1234" }),
      })
    )
    expect(rendered.getSnapshot().hasKioskPinSession).toBe(true)
    expect(rendered.getSnapshot().kioskPinSessionToken).toBe("session_123")
    expect(rendered.getSnapshot().kioskPinRotationRequired).toBe(true)
    expect(rendered.getSnapshot().kioskPin).toBe("")
    expect(rendered.getSnapshot().success).toBe("Identity confirmed. Create your permanent PIN to continue.")

    await inputDigits(rendered.getSnapshot, "567890")

    expect(rendered.getSnapshot().kioskPinNext).toBe("5678")
    expect(rendered.getSnapshot().kioskPinConfirm).toBe("90")
    expect(rendered.getSnapshot().activePinField).toBe("confirm")
    expect(rendered.getSnapshot().nextActiveSlot).toBe(3)
    expect(rendered.getSnapshot().confirmActiveSlot).toBe(2)

    await act(async () => {
      rendered.getSnapshot().handlePinBackspace()
    })
    expect(rendered.getSnapshot().kioskPinConfirm).toBe("9")

    await act(async () => {
      rendered.getSnapshot().handlePinClear()
    })
    expect(rendered.getSnapshot().kioskPinConfirm).toBe("")

    await act(async () => {
      rendered.getSnapshot().handlePinBackspace()
    })
    expect(rendered.getSnapshot().kioskPinNext).toBe("567")
  })

  it("rotates the kiosk PIN and clears the rotation form", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(createJsonResponse(IDENTIFY_ROTATION_RESPONSE))
      .mockResolvedValueOnce(createJsonResponse(ROTATE_OK_RESPONSE))

    const rendered = await renderHookHarness()
    root = rendered.root
    container = rendered.container

    await inputDigits(rendered.getSnapshot, "1234")

    await act(async () => {
      await rendered.getSnapshot().handleKioskPinIdentify()
    })

    await inputDigits(rendered.getSnapshot, "56785678")

    expect(rendered.getSnapshot().canRotate).toBe(true)

    await act(async () => {
      await rendered.getSnapshot().handleKioskPinRotate()
    })

    expect(fetch).toHaveBeenLastCalledWith(
      "/api/checkin/pin/rotate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          sessionToken: "session_123",
          nextPin: "5678",
          confirmPin: "5678",
        }),
      })
    )
    expect(rendered.getSnapshot().kioskPinRotationRequired).toBe(false)
    expect(rendered.getSnapshot().kioskPinNext).toBe("")
    expect(rendered.getSnapshot().kioskPinConfirm).toBe("")
    expect(rendered.getSnapshot().success).toBe("PIN updated. Loading your purchase options...")
  })

  it("keeps permanent kiosk PINs on the direct continuation path", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse(IDENTIFY_PERMANENT_RESPONSE))

    const rendered = await renderHookHarness()
    root = rendered.root
    container = rendered.container

    await inputDigits(rendered.getSnapshot, "1234")

    await act(async () => {
      await rendered.getSnapshot().handleKioskPinIdentify()
    })

    expect(rendered.getSnapshot().hasKioskPinSession).toBe(true)
    expect(rendered.getSnapshot().kioskPinSessionToken).toBe("session_456")
    expect(rendered.getSnapshot().kioskPinRotationRequired).toBe(false)
    expect(rendered.getSnapshot().activePinField).toBe("next")
    expect(rendered.getSnapshot().success).toBe("Identity confirmed. Loading your current class options...")
  })

  describe("handleKioskPhoneIdentify (identify-and-bootstrap port)", () => {
    const CONTEXT_PAYLOAD = {
      courseSlug: "salsa",
      date: "2026-06-01",
      time: "11:00",
      durationMinutes: 60,
      linkedFromCourseSlug: "salsa",
    }

    it("posts to /api/checkin/phone/identify-and-bootstrap with phone + class context", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse(FAST_PATH_RESPONSE))

      const rendered = await renderHookHarness({ contextPayload: CONTEXT_PAYLOAD })
      root = rendered.root
      container = rendered.container

      await act(async () => {
        rendered.getSnapshot().setKioskPhone("5551112222")
      })

      await act(async () => {
        await rendered.getSnapshot().handleKioskPhoneIdentify()
      })

      expect(fetch).toHaveBeenCalledWith(
        "/api/checkin/phone/identify-and-bootstrap",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ phone: "5551112222", ...CONTEXT_PAYLOAD }),
        })
      )
    })

    it("feeds the fast/full payload into setBootstrap via the adapter (ADR-9)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse(FAST_PATH_RESPONSE))
      const adapt = vi.fn().mockReturnValue({ ready: true })

      const rendered = await renderHookHarness({
        contextPayload: CONTEXT_PAYLOAD,
        adaptIdentifyAndBootstrapResponse: adapt,
      })
      root = rendered.root
      container = rendered.container

      await act(async () => {
        rendered.getSnapshot().setKioskPhone("5551112222")
      })

      await act(async () => {
        await rendered.getSnapshot().handleKioskPhoneIdentify()
      })

      expect(adapt).toHaveBeenCalledWith(FAST_PATH_RESPONSE)
      expect(rendered.getSnapshot().kioskPinSessionToken).toBe("kiosk_session_fast")
      expect(rendered.getSnapshot().kioskPhone).toBe("")
      expect(rendered.getSnapshot().success).toBe("Phone number verified. Loading your purchase options...")
    })

    it("does not call setBootstrap when no adapter is provided", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse(FAST_PATH_RESPONSE))

      const rendered = await renderHookHarness({ contextPayload: CONTEXT_PAYLOAD })
      root = rendered.root
      container = rendered.container

      await act(async () => {
        rendered.getSnapshot().setKioskPhone("5551112222")
      })

      await act(async () => {
        await rendered.getSnapshot().handleKioskPhoneIdentify()
      })

      // Bootstrap state is untouched (still the harness's initial seed value)
      expect(rendered.getSnapshot().bootstrap).toEqual({ ready: true })
    })

    // Scenario: unknown phone number → new-user flow, unaffected by the port.
    // The hook's failure handling (clear session, surface error message,
    // never populate bootstrap) is identical to the pre-port `/identify`
    // behavior — only the endpoint URL changed.
    it("routes an unrecognized phone number through the existing failure path (new-user flow)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse(UNKNOWN_PHONE_RESPONSE, false))

      const rendered = await renderHookHarness({ contextPayload: CONTEXT_PAYLOAD })
      root = rendered.root
      container = rendered.container

      await act(async () => {
        rendered.getSnapshot().setKioskPhone("5559998888")
      })

      await act(async () => {
        await rendered.getSnapshot().handleKioskPhoneIdentify()
      })

      expect(rendered.getSnapshot().kioskPinSessionToken).toBe("")
      expect(rendered.getSnapshot().bootstrap).toBeNull()
      expect(rendered.getSnapshot().error).toBe(UNKNOWN_PHONE_RESPONSE.message)
    })
  })
})
