// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useEnrollInit } from "@/components/front/courses/enroll/hooks/useEnrollInit"

type HookResult = ReturnType<typeof useEnrollInit>
type HookProps = Parameters<typeof useEnrollInit>[0]

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const defaultProps = (override: Partial<HookProps> = {}): HookProps => ({
  open: true,
  prefillContact: { firstName: "Ana", phone: "+1 917 555 1212" },
  prefillSelection: { service: "regular", participants: 2 },
  userContact: { firstName: "User", email: "user@example.com", phone: "+1 929 555 1212" },
  setKioskStepHydrating: vi.fn(),
  ...override,
})

describe("useEnrollInit", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let result: HookResult | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    result = null
    vi.restoreAllMocks()
  })

  const renderHook = async (props: HookProps) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness(nextProps: HookProps) {
      result = useEnrollInit(nextProps)
      return null
    }

    await act(async () => root!.render(<Harness {...props} />))
    return {
      getResult: () => result!,
      rerender: async (nextProps: HookProps) => {
        await act(async () => root!.render(<Harness {...nextProps} />))
      },
    }
  }

  it("keeps the latest prefill and user contact in refs", async () => {
    const initial = defaultProps()
    const { getResult, rerender } = await renderHook(initial)

    expect(getResult().prefillContactRef.current?.firstName).toBe("Ana")
    expect(getResult().prefillSelectionRef.current?.service).toBe("regular")
    expect(getResult().userContactRef.current.email).toBe("user@example.com")

    await rerender(
      defaultProps({
        prefillContact: { firstName: "Bea" },
        prefillSelection: { service: "new-student", participants: 1 },
        userContact: { firstName: "Updated", email: "updated@example.com" },
      })
    )

    expect(getResult().prefillContactRef.current?.firstName).toBe("Bea")
    expect(getResult().prefillSelectionRef.current?.service).toBe("new-student")
    expect(getResult().userContactRef.current.email).toBe("updated@example.com")
  })

  it("resets initialization and kiosk hydration when closed", async () => {
    const setKioskStepHydrating = vi.fn()
    const { getResult, rerender } = await renderHook(defaultProps({ setKioskStepHydrating }))
    getResult().openInitializationRef.current = true

    await rerender(defaultProps({ open: false, setKioskStepHydrating }))

    expect(getResult().openInitializationRef.current).toBe(false)
    expect(setKioskStepHydrating).toHaveBeenLastCalledWith(false)
  })
})
