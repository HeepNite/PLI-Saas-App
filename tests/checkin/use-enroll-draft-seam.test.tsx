// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useEnrollDraft } from "@/components/front/courses/hooks/useEnrollDraft"
import type { EnrollDraftState } from "@/components/front/courses/types"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

const draftKey = "pli-enroll:test-course"
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

function createBaseState(): EnrollDraftState {
  return {
    service: "drop-in",
    pkg: "",
    addons: [],
    participants: 1,
    date: "2026-06-10",
    time: "20:00",
    contact: { firstName: "Ana", lastName: "Diaz", email: "ana@example.com", phone: "+1 917 555 1212", note: "" },
    couponInput: "",
    appliedCoupon: null,
    paymentMethod: "",
    step: 0,
  }
}

function createSetters() {
  return {
    setService: vi.fn(),
    setPkg: vi.fn(),
    setAddons: vi.fn(),
    setParticipants: vi.fn(),
    setDate: vi.fn(),
    setTime: vi.fn(),
    setContact: vi.fn(),
    setCouponInput: vi.fn(),
    setAppliedCoupon: vi.fn(),
    setPaymentMethod: vi.fn(),
    setStep: vi.fn(),
  }
}

describe("useEnrollDraft seam", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    sessionStorage.clear()
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
    sessionStorage.clear()
  })

  async function renderDraftHook(params: {
    open: boolean
    success: boolean
    stepsCount: number
    state?: EnrollDraftState
    setters?: ReturnType<typeof createSetters>
  }) {
    const state = params.state ?? createBaseState()
    const setters = params.setters ?? createSetters()

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness() {
      useEnrollDraft({
        open: params.open,
        success: params.success,
        draftKey,
        stepsCount: params.stepsCount,
        state,
        setters,
      })
      return null
    }

    await act(async () => {
      root?.render(<Harness />)
    })

    return { setters, state }
  }

  it("restores persisted draft and clamps persisted step", async () => {
    sessionStorage.setItem(
      draftKey,
      JSON.stringify({
        service: "new-student",
        participants: 3,
        step: 22,
        contact: { firstName: "Mari", email: "mari@example.com" },
      })
    )

    const { setters } = await renderDraftHook({ open: true, success: false, stepsCount: 5 })

    expect(setters.setService).toHaveBeenCalledWith("new-student")
    expect(setters.setParticipants).toHaveBeenCalledWith(3)
    expect(setters.setStep).toHaveBeenCalledWith(4)
    expect(setters.setContact).toHaveBeenCalledTimes(1)
  })

  it("persists current draft state while modal is open", async () => {
    const state = createBaseState()
    state.step = 2
    state.paymentMethod = "stripe"

    await renderDraftHook({ open: true, success: false, stepsCount: 6, state })

    expect(JSON.parse(sessionStorage.getItem(draftKey) || "{}")).toMatchObject({
      step: 2,
      paymentMethod: "stripe",
      service: "drop-in",
    })
  })

  it("keeps latest state in storage when success and open happen together", async () => {
    sessionStorage.setItem(draftKey, JSON.stringify(createBaseState()))

    await renderDraftHook({ open: true, success: true, stepsCount: 6 })

    expect(sessionStorage.getItem(draftKey)).not.toBeNull()
  })

  it("removes draft when success happens while modal is closed", async () => {
    sessionStorage.setItem(draftKey, JSON.stringify(createBaseState()))

    await renderDraftHook({ open: false, success: true, stepsCount: 6 })

    expect(sessionStorage.getItem(draftKey)).toBeNull()
  })
})
