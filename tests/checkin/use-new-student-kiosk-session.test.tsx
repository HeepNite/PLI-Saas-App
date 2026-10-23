// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useNewStudentKioskSession } from "@/components/front/courses/enroll/hooks/useNewStudentKioskSession"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Input = Parameters<typeof useNewStudentKioskSession>[0]
type HookResult = ReturnType<typeof useNewStudentKioskSession>

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("useNewStudentKioskSession", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let result: HookResult | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    result = null
    vi.unstubAllGlobals()
  })

  const renderHook = async (input: Input) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    function Harness(next: Input) {
      result = useNewStudentKioskSession(next)
      return null
    }
    await act(async () => root!.render(<Harness {...input} />))
    return {
      getResult: () => result!,
      rerender: async (next: Input) => {
        await act(async () => root!.render(<Harness {...next} />))
      },
    }
  }

  it("mints a session after SMS verification and adopts the token without remounting", async () => {
    const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () =>
      jsonResponse({ sessionToken: "kiosk_new_1", sessionExpiresAt: "2026-10-23T12:15:00.000Z" })
    )
    vi.stubGlobal("fetch", fetchMock)
    const { getResult } = await renderHook({ enabled: true, phone: "(305) 555-0101" })
    expect(getResult().token).toBeNull()

    let minted: string | null = null
    await act(async () => {
      minted = await getResult().mint()
    })

    expect(minted).toBe("kiosk_new_1")
    expect(getResult().token).toBe("kiosk_new_1")
    expect(fetchMock.mock.calls[0][0]).toBe("/api/checkin/qr/new-student/kiosk-session")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ phone: "(305) 555-0101" })
  })

  it("keeps no token when minting is refused so card fails visibly and cash stays available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Phone verification required" }, 403)))
    const { getResult } = await renderHook({ enabled: true, phone: "3055550101" })

    let minted: string | null = "unset"
    await act(async () => {
      minted = await getResult().mint()
    })

    expect(minted).toBeNull()
    expect(getResult().token).toBeNull()
  })

  it("treats a network failure as no token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline") }))
    const { getResult } = await renderHook({ enabled: true, phone: "3055550101" })

    await act(async () => {
      await getResult().mint()
    })

    expect(getResult().token).toBeNull()
  })

  it("drops the token when the phone changes after minting", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ sessionToken: "kiosk_new_1" })))
    const { getResult, rerender } = await renderHook({ enabled: true, phone: "3055550101" })
    await act(async () => {
      await getResult().mint()
    })

    await rerender({ enabled: true, phone: "3055559999" })

    expect(getResult().token).toBeNull()
  })

  it("does nothing outside the kiosk new-student flow", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { getResult } = await renderHook({ enabled: false, phone: "3055550101" })

    await act(async () => {
      await getResult().mint()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(getResult().token).toBeNull()
  })
})
