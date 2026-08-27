// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useStaffPaymentsAdmin } from "@/components/front/staff/useStaffPaymentsAdmin"
import type { PaymentsApiSummary } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const createEmptyPaymentsSummary = (): PaymentsApiSummary => ({
  totalItems: 0,
  totalCollected: 0,
  pendingSettlement: 0,
  paidSettlement: 0,
  pendingStripe: 0,
  paidStripe: 0,
})

const normalizePaymentsSummary = (value: unknown): PaymentsApiSummary => {
  if (!value || typeof value !== "object") return createEmptyPaymentsSummary()
  const partial = value as Partial<PaymentsApiSummary>
  return {
    totalItems: typeof partial.totalItems === "number" ? partial.totalItems : 0,
    totalCollected: typeof partial.totalCollected === "number" ? partial.totalCollected : 0,
    pendingSettlement: typeof partial.pendingSettlement === "number" ? partial.pendingSettlement : 0,
    paidSettlement: typeof partial.paidSettlement === "number" ? partial.paidSettlement : 0,
    pendingStripe: typeof partial.pendingStripe === "number" ? partial.pendingStripe : 0,
    paidStripe: typeof partial.paidStripe === "number" ? partial.paidStripe : 0,
  }
}

const createInput = (
  overrides: Partial<Parameters<typeof useStaffPaymentsAdmin>[0]> = {}
) => ({
  studentSearchQuery: "",
  createEmptyPaymentsSummary,
  normalizePaymentsSummary,
  ensureMinimumLoadingTime: vi.fn().mockResolvedValue(undefined),
  handleStaffAuthFailure: vi.fn().mockReturnValue(false),
  setError: vi.fn(),
  ...overrides,
})

type HookResult = ReturnType<typeof useStaffPaymentsAdmin>

describe("useStaffPaymentsAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let captured: HookResult | null = null
  let currentInput: ReturnType<typeof createInput> = createInput()

  beforeEach(() => {
    if (!globalThis.window) {
      throw new Error("jsdom window is required")
    }
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
    captured = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function renderHook(input = createInput()) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    currentInput = input

    function Harness() {
      captured = useStaffPaymentsAdmin(currentInput)
      return null
    }

    await act(async () => {
      root!.render(<Harness />)
    })

    return input
  }

  it("initialises with empty payments, default filters, and history mode off", async () => {
    await renderHook()
    expect(captured!.payments).toEqual([])
    expect(captured!.paymentsLoading).toBe(false)
    expect(captured!.paymentsFilter).toBe("all")
    expect(captured!.paymentCategoryFilter).toBe("all")
    expect(captured!.isHistoryMode).toBe(false)
    expect(captured!.selectedPaymentIds).toEqual([])
    expect(captured!.checkoutMenuPaymentId).toBeNull()
  })

  it("handlePaymentCategoryChange clears history filters when leaving history mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        items: [],
        summary: {},
        classOptions: [{ slug: "bachata-basics", title: "Bachata Basics" }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    await act(async () => {
      captured!.setHistoryFrom("2026-01-01")
      captured!.setHistoryTo("2026-01-31")
      captured!.setHistoryPaymentMethodFilter("cash")
      captured!.setHistoryAttendanceFilter("attended")
      captured!.setHistoryClassKey("bachata-basics")
    })

    // Switch to history — filters preserved
    await act(async () => {
      captured!.handlePaymentCategoryChange("history")
    })
    await act(async () => {
      await captured!.fetchPayments()
    })
    expect(captured!.isHistoryMode).toBe(true)
    expect(captured!.historyFrom).toBe("2026-01-01")
    expect(captured!.historyClassOptions).toHaveLength(1)

    // Switch back away from history — filters cleared
    await act(async () => {
      captured!.handlePaymentCategoryChange("cash")
    })
    expect(captured!.isHistoryMode).toBe(false)
    expect(captured!.historyFrom).toBe("")
    expect(captured!.historyTo).toBe("")
    expect(captured!.historyPaymentMethodFilter).toBe("all")
    expect(captured!.historyAttendanceFilter).toBe("all")
    expect(captured!.historyClassKey).toBe("")
    expect(captured!.historyClassOptions).toEqual([])
  })

  it("resets historyClassKey when its option disappears from history class options", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          items: [],
          summary: {},
          classOptions: [{ slug: "bachata-basics", title: "Bachata Basics" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          items: [],
          summary: {},
          classOptions: [{ slug: "bachata-basics", title: "Bachata Basics" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          items: [],
          summary: {},
          classOptions: [{ slug: "salsa-101", title: "Salsa 101" }],
        }),
      })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    await act(async () => {
      captured!.handlePaymentCategoryChange("history")
      captured!.setHistoryFrom("2026-01-01")
      captured!.setHistoryTo("2026-01-31")
    })
    await act(async () => {
      await captured!.fetchPayments()
      captured!.setHistoryClassKey("bachata-basics")
    })
    expect(captured!.historyClassKey).toBe("bachata-basics")

    await act(async () => {
      await captured!.fetchPayments()
    })
    expect(captured!.historyClassKey).toBe("")
  })

  it("fetchPayments hits /api/staff/payments with category=all and updates payments/summary", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          items: [{ id: "p1" }, { id: "p2" }],
          summary: { totalItems: 2, totalCollected: 5000, pendingSettlement: 1, paidSettlement: 1, pendingStripe: 0, paidStripe: 1 },
          classOptions: [{ slug: "x", title: "X" }],
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    await act(async () => {
      await captured!.fetchPayments()
    })

    expect(fetchMock).toHaveBeenCalled()
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain("/api/staff/payments")
    expect(captured!.payments).toHaveLength(2)
    expect(captured!.paymentsMonthlySummaryApi.totalItems).toBe(2)
    // classOptions only populated in history mode
    expect(captured!.historyClassOptions).toEqual([])
    expect(captured!.paymentsLoading).toBe(false)
  })

  it("fetchPayments routes non-OK responses through handleStaffAuthFailure and clears payments", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const input = createInput({
      handleStaffAuthFailure: vi.fn().mockReturnValue(true),
    })
    await renderHook(input)

    await act(async () => {
      await captured!.fetchPayments()
    })

    expect(input.handleStaffAuthFailure).toHaveBeenCalledWith(401)
    // setError NOT called because auth failure short-circuits before error branch
    expect(input.setError).not.toHaveBeenCalled()
  })

  it("fetchPayments in history mode without a valid range clears payments and skips network", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()
    await act(async () => {
      captured!.handlePaymentCategoryChange("history")
      // leave historyFrom/historyTo empty
    })

    await act(async () => {
      await captured!.fetchPayments()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(captured!.payments).toEqual([])
    expect(captured!.historyClassOptions).toEqual([])
  })

  it("fetchPaymentsMonthlySummary loads /api/staff/payments with current-month params and updates totals", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          items: [],
          summary: { totalItems: 7, totalCollected: 100, pendingSettlement: 1, paidSettlement: 6, pendingStripe: 0, paidStripe: 6 },
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()
    await act(async () => {
      await captured!.fetchPaymentsMonthlySummary()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain("/api/staff/payments")
    expect(captured!.paymentsMonthlySummaryApi.totalItems).toBe(7)
    expect(captured!.paymentsMonthlyStudentCount).toBe(0)
    expect(captured!.paymentsMonthlyCheckedInStudents).toBe(0)
  })

  it("selects, deselects, clears, and prunes selected payment ids", async () => {
    await renderHook()

    await act(async () => {
      captured!.selectPaymentIds(["p1", "p2"])
      captured!.selectPaymentIds(["p2", "p3"])
    })
    expect(captured!.selectedPaymentIds).toEqual(["p1", "p2", "p3"])

    await act(async () => {
      captured!.deselectPaymentIds(["p2"])
    })
    expect(captured!.selectedPaymentIds).toEqual(["p1", "p3"])

    await act(async () => {
      captured!.pruneSelectedPaymentIds(["p3"])
    })
    expect(captured!.selectedPaymentIds).toEqual(["p3"])

    await act(async () => {
      captured!.clearSelectedPayments()
    })
    expect(captured!.selectedPaymentIds).toEqual([])
  })

  it("updateSettlementBulk posts selected ids, runs success callback, and removes updated ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const onSuccess = vi.fn().mockResolvedValue(undefined)

    await renderHook()
    await act(async () => {
      captured!.selectPaymentIds(["p1", "p2", "p3"])
    })

    await act(async () => {
      await captured!.updateSettlementBulk({ action: "mark_paid", ids: ["p1", "p3"], onSuccess })
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/staff/payments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_paid", ids: ["p1", "p3"] }),
    })
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(captured!.selectedPaymentIds).toEqual(["p2"])
    expect(captured!.paymentsBulkBusyAction).toBeNull()
  })

  it("keeps the selection and reports when no cash payments were updated", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ updatedCount: 0 }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const onSuccess = vi.fn().mockResolvedValue(undefined)
    const input = createInput()

    await renderHook(input)
    await act(async () => {
      captured!.selectPaymentIds(["p1"])
    })

    await act(async () => {
      await captured!.updateSettlementBulk({ action: "mark_paid", ids: ["p1"], onSuccess })
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(captured!.selectedPaymentIds).toEqual(["p1"])
    expect(input.setError).toHaveBeenCalledWith("No selected cash payments were updated")
    expect(captured!.paymentsBulkBusyAction).toBeNull()
  })

  it("debounced history-mode search triggers fetchPayments with the trimmed query after 350ms", async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], summary: {}, classOptions: [] }),
      })
      vi.stubGlobal("fetch", fetchMock)

      container = document.createElement("div")
      document.body.appendChild(container)
      root = createRoot(container)

      // Drive studentSearchQuery via internal React state so updates re-render the hook.
      let updateQuery: ((value: string) => void) | null = null
      const baseInput = createInput()

      function Harness() {
        const [query, setQuery] = React.useState("")
        updateQuery = setQuery
        captured = useStaffPaymentsAdmin({ ...baseInput, studentSearchQuery: query })
        return null
      }

      await act(async () => {
        root!.render(<Harness />)
      })

      // Activate history mode and set a valid range so fetch executes
      await act(async () => {
        captured!.handlePaymentCategoryChange("history")
        captured!.setHistoryFrom("2026-01-01")
        captured!.setHistoryTo("2026-01-31")
      })

      // Flush any pending fetches and effect timers triggered by mode/range changes
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })
      fetchMock.mockClear()

      // Update the query — debounce should defer the fetch by 350ms
      await act(async () => {
        updateQuery!("alice")
      })

      // Before 350ms — no new fetch from the debounce path
      expect(fetchMock).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350)
      })

      const calls = fetchMock.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const lastUrl = calls[calls.length - 1][0] as string
      expect(lastUrl).toContain("alice")
    } finally {
      vi.useRealTimers()
    }
  })
})
