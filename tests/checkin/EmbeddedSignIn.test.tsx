// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"

const useSignInMock = vi.hoisted(() => vi.fn())

vi.mock("@clerk/nextjs", () => ({
  useSignIn: useSignInMock,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("EmbeddedSignIn resend cooldown", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("counts down every second before enabling resend", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-25T12:00:00.000Z"))

    const preparedSignIn = {
      supportedFirstFactors: [
        { strategy: "phone_code", phoneNumberId: "phone_1" },
        { strategy: "email_code", emailAddressId: "email_1", safeIdentifier: "m***@example.com" },
      ],
      prepareFirstFactor: vi.fn().mockResolvedValue(undefined),
    }
    const signIn = {
      identifier: null,
      status: null,
      supportedFirstFactors: [],
      create: vi.fn().mockResolvedValue(preparedSignIn),
      prepareFirstFactor: vi.fn().mockResolvedValue(undefined),
      attemptFirstFactor: vi.fn(),
    }
    useSignInMock.mockReturnValue({
      isLoaded: true,
      signIn,
      setActive: vi.fn(),
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root!.render(
        <EmbeddedSignIn
          redirectUrl="/client-profile"
          phoneNumber="+15555550100"
          autoSend
        />
      )
    })
    await act(async () => vi.advanceTimersByTimeAsync(100))

    const resendButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.match(/^(Wait \d+s|Resend code)$/)
    )

    expect(resendButton?.textContent).toBe("Wait 30s")
    expect(resendButton?.disabled).toBe(true)

    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(resendButton?.textContent).toBe("Wait 29s")
    expect(resendButton?.disabled).toBe(true)

    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(resendButton?.textContent).toBe("Wait 28s")
    expect(resendButton?.disabled).toBe(true)

    await act(async () => vi.advanceTimersByTimeAsync(28_000))
    expect(resendButton?.textContent).toBe("Resend code")
    expect(resendButton?.disabled).toBe(false)
  })
})
