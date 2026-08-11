// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import EnrollDeviceFlow from "@/components/front/staff/EnrollDeviceFlow"
import { formatIsoDate } from "@/components/front/staff/staffAdminFormatters"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)

const noDevices = () => jsonResponse({ devices: [] })

type RouteHandler = (method: string, url: string) => Promise<Response> | undefined

function mockFetch(handler: RouteHandler) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = String(input)
    const method = (init?.method ?? "GET").toUpperCase()
    const result = handler(method, url)
    if (!result) throw new Error(`Unhandled fetch in test: ${method} ${url}`)
    return result
  })
}

describe("EnrollDeviceFlow", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderFlow() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<EnrollDeviceFlow />)
    })
    return container
  }

  function queryByText(node: HTMLElement, text: string) {
    return Array.from(node.querySelectorAll<HTMLElement>("button, a")).find((el) => el.textContent?.trim() === text)
  }

  it("loads and lists the caller's enrolled trusted devices on mount", async () => {
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) {
        return jsonResponse({
          devices: [
            { id: "device_1", createdAt: "2026-01-01T00:00:00.000Z", lastUsedAt: "2026-01-05T00:00:00.000Z" },
          ],
        })
      }
      return undefined
    })

    const node = await renderFlow()

    const items = node.querySelectorAll('[data-testid="trusted-device-item"]')
    expect(items).toHaveLength(1)
    expect(node.textContent).toContain(formatIsoDate("2026-01-01T00:00:00.000Z"))
  })

  it("shows an empty state when the caller has no enrolled devices", async () => {
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) return noDevices()
      return undefined
    })

    const node = await renderFlow()

    expect(node.textContent).toContain("No trusted devices yet.")
  })

  it("sends an enrollment code and shows the code-entry state", async () => {
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) return noDevices()
      if (method === "POST" && url.includes("/api/staff/device/enroll/challenge")) return jsonResponse({ ok: true })
      return undefined
    })

    const node = await renderFlow()
    const sendButton = queryByText(node, "Send verification code")
    expect(sendButton).toBeTruthy()

    await act(async () => {
      sendButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.querySelector('input[name="enrollCode"]')).toBeTruthy()
    expect(node.textContent).toContain("Enter the 6-digit code we sent to your phone on file")
  })

  it("surfaces the server error message when sending the code fails", async () => {
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) return noDevices()
      if (method === "POST" && url.includes("/api/staff/device/enroll/challenge")) {
        return jsonResponse({ error: "Too many enrollment code requests. Please try again later." }, false, 429)
      }
      return undefined
    })

    const node = await renderFlow()
    const sendButton = queryByText(node, "Send verification code")

    await act(async () => {
      sendButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Too many enrollment code requests. Please try again later.")
    expect(node.querySelector('input[name="enrollCode"]')).toBeNull()
  })

  it("surfaces a network error without hanging when the challenge request throws", async () => {
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) return noDevices()
      return undefined
    })
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input)
      const method = (init?.method ?? "GET").toUpperCase()
      if (method === "GET" && url.includes("/api/staff/devices")) return noDevices()
      if (method === "POST" && url.includes("/api/staff/device/enroll/challenge")) return Promise.reject(new Error("network down"))
      return Promise.reject(new Error(`unhandled ${method} ${url}`))
    })

    const node = await renderFlow()
    const sendButton = queryByText(node, "Send verification code")

    await act(async () => {
      sendButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Network error while sending the verification code.")
  })

  it("requires a 6-digit code before submitting", async () => {
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) return noDevices()
      if (method === "POST" && url.includes("/api/staff/device/enroll/challenge")) return jsonResponse({ ok: true })
      return undefined
    })

    const node = await renderFlow()
    const sendButton = queryByText(node, "Send verification code")
    await act(async () => {
      sendButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    const verifyButton = queryByText(node, "Verify & enroll")
    await act(async () => {
      verifyButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Enter the 6-digit code sent to your phone.")
  })

  it("verifies the code, shows the enrolled success state, and refreshes the device list", async () => {
    let devicesCallCount = 0
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) {
        devicesCallCount += 1
        if (devicesCallCount === 1) return noDevices()
        return jsonResponse({
          devices: [{ id: "device_new", createdAt: "2026-02-01T00:00:00.000Z", lastUsedAt: null }],
        })
      }
      if (method === "POST" && url.includes("/api/staff/device/enroll/challenge")) return jsonResponse({ ok: true })
      if (method === "POST" && url.endsWith("/api/staff/device/enroll")) return jsonResponse({ ok: true })
      return undefined
    })

    const node = await renderFlow()
    const sendButton = queryByText(node, "Send verification code")
    await act(async () => {
      sendButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    const codeInput = node.querySelector<HTMLInputElement>('input[name="enrollCode"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(codeInput, "123456")
      codeInput.dispatchEvent(new Event("input", { bubbles: true }))
    })

    const verifyButton = queryByText(node, "Verify & enroll")
    await act(async () => {
      verifyButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("This device is now trusted for PIN sign-in.")
    expect(devicesCallCount).toBe(2)
    expect(node.querySelectorAll('[data-testid="trusted-device-item"]')).toHaveLength(1)
  })

  it("surfaces the server error on a wrong code without hanging, and allows retry", async () => {
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) return noDevices()
      if (method === "POST" && url.includes("/api/staff/device/enroll/challenge")) return jsonResponse({ ok: true })
      if (method === "POST" && url.endsWith("/api/staff/device/enroll")) return jsonResponse({ error: "Incorrect code." }, false, 409)
      return undefined
    })

    const node = await renderFlow()
    const sendButton = queryByText(node, "Send verification code")
    await act(async () => {
      sendButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    const codeInput = node.querySelector<HTMLInputElement>('input[name="enrollCode"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(codeInput, "000000")
      codeInput.dispatchEvent(new Event("input", { bubbles: true }))
    })
    const verifyButton = queryByText(node, "Verify & enroll")
    await act(async () => {
      verifyButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Incorrect code.")
    expect(node.querySelector('input[name="enrollCode"]')).toBeTruthy()
  })

  it("allows resending the code from the code-entry state", async () => {
    const challengeCalls: string[] = []
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) return noDevices()
      if (method === "POST" && url.includes("/api/staff/device/enroll/challenge")) {
        challengeCalls.push(url)
        return jsonResponse({ ok: true })
      }
      return undefined
    })

    const node = await renderFlow()
    const sendButton = queryByText(node, "Send verification code")
    await act(async () => {
      sendButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    const resendButton = queryByText(node, "Resend code")
    expect(resendButton).toBeTruthy()
    await act(async () => {
      resendButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(challengeCalls).toHaveLength(2)
  })

  it("revokes a device and refreshes the list", async () => {
    let devicesCallCount = 0
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) {
        devicesCallCount += 1
        if (devicesCallCount === 1) {
          return jsonResponse({ devices: [{ id: "device_1", createdAt: "2026-01-01T00:00:00.000Z", lastUsedAt: null }] })
        }
        return noDevices()
      }
      if (method === "DELETE" && url.includes("/api/staff/devices/device_1")) return jsonResponse({ ok: true })
      return undefined
    })

    const node = await renderFlow()
    const revokeButton = node.querySelector<HTMLButtonElement>('[data-testid="trusted-device-item"] button')
    expect(revokeButton?.textContent).toContain("Revoke")

    await act(async () => {
      revokeButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("No trusted devices yet.")
    expect(devicesCallCount).toBe(2)
  })

  it("surfaces an error message when revoke fails", async () => {
    mockFetch((method, url) => {
      if (method === "GET" && url.includes("/api/staff/devices")) {
        return jsonResponse({ devices: [{ id: "device_1", createdAt: "2026-01-01T00:00:00.000Z", lastUsedAt: null }] })
      }
      if (method === "DELETE" && url.includes("/api/staff/devices/device_1")) {
        return jsonResponse({ error: "Device not found." }, false, 404)
      }
      return undefined
    })

    const node = await renderFlow()
    const revokeButton = node.querySelector<HTMLButtonElement>('[data-testid="trusted-device-item"] button')

    await act(async () => {
      revokeButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Device not found.")
  })
})
