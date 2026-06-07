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

const createJsonResponse = (payload: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as Response

const renderHookHarness = async () => {
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
})
