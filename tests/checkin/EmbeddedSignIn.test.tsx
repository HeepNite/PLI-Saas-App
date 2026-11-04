// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"

const useSignInMock = vi.hoisted(() => vi.fn())
const routerReplaceMock = vi.hoisted(() => vi.fn())

vi.mock("@clerk/nextjs", () => ({
  useSignIn: useSignInMock,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
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
    routerReplaceMock.mockReset()
    vi.restoreAllMocks()
  })

  it("starts email-code access with the submitted email", async () => {
    vi.useFakeTimers()
    const preparedSignIn = {
      supportedFirstFactors: [
        { strategy: "email_code", emailAddressId: "email_1", safeIdentifier: "e***@example.com" },
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
          emailAddress="existing@example.com"
          initialStrategy="email_code"
          autoSend
        />
      )
    })
    await act(async () => vi.advanceTimersByTimeAsync(100))

    expect(signIn.create).toHaveBeenCalledWith({
      strategy: "email_code",
      identifier: "existing@example.com",
    })
    expect(preparedSignIn.prepareFirstFactor).toHaveBeenCalledWith({
      strategy: "email_code",
      emailAddressId: "email_1",
    })
    expect(container.textContent).toContain("e***@example.com")
  })

  it("does not retry Clerk's deterministic identifier-not-found error", async () => {
    vi.useFakeTimers()
    const signIn = {
      identifier: null,
      status: null,
      supportedFirstFactors: [],
      create: vi.fn().mockRejectedValue({
        errors: [{ code: "form_identifier_not_found", longMessage: "Couldn't find your account." }],
      }),
      prepareFirstFactor: vi.fn(),
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
      root!.render(<EmbeddedSignIn redirectUrl="/client-profile" phoneNumber="+15555550140" autoSend />)
    })
    await act(async () => vi.advanceTimersByTimeAsync(10_100))

    expect(signIn.create).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain("Check the phone number or contact staff for help.")
  })

  it("returns a standalone sign-in through client navigation with its full redirect URL", async () => {
    const signIn = {
      identifier: "+15555550140",
      status: "needs_first_factor",
      supportedFirstFactors: [{ strategy: "phone_code", phoneNumberId: "phone_1" }],
      create: vi.fn(),
      prepareFirstFactor: vi.fn(),
      attemptFirstFactor: vi.fn().mockResolvedValue({ status: "complete", createdSessionId: "sess_1" }),
    }
    const setActive = vi.fn().mockResolvedValue(undefined)
    useSignInMock.mockReturnValue({
      isLoaded: true,
      signIn,
      setActive,
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root!.render(
        <EmbeddedSignIn
          redirectUrl="/checkin?courseSlug=salsa-1&date=2026-06-11&time=19%3A30&durationMinutes=60&kioskQrCashGrant=signed.grant&enroll=1&step=2"
          phoneNumber="+15555550140"
        />
      )
    })

    const codeInput = container.querySelector('input[placeholder="123456"]') as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    await act(async () => {
      valueSetter?.call(codeInput, "123456")
      codeInput.dispatchEvent(new Event("input", { bubbles: true }))
    })
    const continueButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("Continue"))
    await act(async () => continueButton?.click())

    expect(setActive).toHaveBeenCalledWith({ session: "sess_1" })
    expect(routerReplaceMock).toHaveBeenCalledWith(
      "/checkin?courseSlug=salsa-1&date=2026-06-11&time=19%3A30&durationMinutes=60&kioskQrCashGrant=signed.grant&enroll=1&step=2"
    )
  })

  it("preserves an embedded success callback instead of navigating away", async () => {
    const signIn = {
      identifier: "+15555550140",
      status: "needs_first_factor",
      supportedFirstFactors: [{ strategy: "phone_code", phoneNumberId: "phone_1" }],
      create: vi.fn(),
      prepareFirstFactor: vi.fn(),
      attemptFirstFactor: vi.fn().mockResolvedValue({ status: "complete", createdSessionId: "sess_1" }),
    }
    const onSuccessAction = vi.fn().mockResolvedValue(undefined)
    useSignInMock.mockReturnValue({
      isLoaded: true,
      signIn,
      setActive: vi.fn().mockResolvedValue(undefined),
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(
        <EmbeddedSignIn
          redirectUrl="/checkin?courseSlug=salsa-1"
          phoneNumber="+15555550140"
          onSuccessAction={onSuccessAction}
        />
      )
    })

    const codeInput = container.querySelector('input[placeholder="123456"]') as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    await act(async () => {
      valueSetter?.call(codeInput, "123456")
      codeInput.dispatchEvent(new Event("input", { bubbles: true }))
    })
    const continueButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("Continue"))
    await act(async () => continueButton?.click())

    expect(onSuccessAction).toHaveBeenCalledTimes(1)
    expect(routerReplaceMock).not.toHaveBeenCalled()
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
