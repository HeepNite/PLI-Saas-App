// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffPinAdmin } from "@/components/front/staff/useStaffPinAdmin"
import type { PaymentRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffPinAdmin>

function HookHarness({
  canAccessStudentsNav = false,
  isStudentsView = false,
  fetchPayments: fetchPaymentsProp,
  fetchPaymentsMonthlySummary: fetchPaymentsMonthlySummaryProp,
  onState,
}: {
  canAccessStudentsNav?: boolean
  isStudentsView?: boolean
  fetchPayments?: () => Promise<void>
  fetchPaymentsMonthlySummary?: () => Promise<void>
  onState: (state: HookState) => void
}) {
  const fetchPayments = React.useCallback(fetchPaymentsProp ?? (async () => undefined), [fetchPaymentsProp])
  const fetchPaymentsMonthlySummary = React.useCallback(fetchPaymentsMonthlySummaryProp ?? (async () => undefined), [fetchPaymentsMonthlySummaryProp])
  const handleStaffAuthFailure = React.useCallback(() => false, [])
  const isInsideCriticalClassWindow = React.useCallback(() => false, [])
  const state = useStaffPinAdmin({
    canAccessStudentsNav,
    isStudentsView,
    scheduleEventsByDay: {},
    fetchPayments,
    fetchPaymentsMonthlySummary,
    handleStaffAuthFailure,
    isInsideCriticalClassWindow,
  })
  onState(state)
  return <div>{state.prioritizedTerminalPinAlerts.length}</div>
}

const payment = {
  userId: "user-1",
  customerName: "Ada Student",
  customerEmail: "ada@example.com",
  studentPin: {
    needsEnrollment: true,
    provisionalActive: false,
    provisionalExpiresAt: null,
  },
} as unknown as PaymentRow

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)

describe("useStaffPinAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let latestState: HookState | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    latestState = null
    vi.restoreAllMocks()
  })

  async function renderHookHarness(props: Partial<React.ComponentProps<typeof HookHarness>> = {}) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness {...props} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("does not auto-refresh payments or terminals while the Users nav is active", async () => {
    const fetchPayments = vi.fn(async () => undefined)
    const fetchPaymentsMonthlySummary = vi.fn(async () => undefined)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ items: [] }) as unknown as Response)

    await renderHookHarness({
      canAccessStudentsNav: true,
      isStudentsView: false,
      fetchPayments,
      fetchPaymentsMonthlySummary,
    })

    expect(fetchPayments).not.toHaveBeenCalled()
    expect(fetchPaymentsMonthlySummary).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/staff/terminals"))).toBe(false)
  })

  it("loads and prioritizes terminal PIN alerts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      items: [
        { id: "terminal-1", name: "Front", location: "Desk", pinAlert: { severity: "warning", label: "Warning", message: "Slow down", blockedUntil: null, missCount: 1 } },
        { id: "terminal-2", name: "Back", location: null, pinAlert: { severity: "emergency", label: "Locked", message: "Locked", blockedUntil: "2026-05-29T10:00:00.000Z", missCount: 3 } },
      ],
    }) as unknown as Response)
    const state = await renderHookHarness()

    await act(async () => {
      await state.fetchTerminalPinAlerts()
    })

    expect(latestState!.prioritizedTerminalPinAlerts.map((alert) => alert.terminalId)).toEqual(["terminal-2", "terminal-1"])
    expect(latestState!.hasAnyTerminalPinAlerts).toBe(true)
  })

  it("opens payment PIN modal and validates reason before submit", async () => {
    const state = await renderHookHarness()

    await act(async () => {
      state.openStudentPinModal(payment)
    })
    await act(async () => {
      await latestState!.submitStudentPinIssue()
    })

    expect(latestState!.studentPinModal?.userId).toBe("user-1")
    expect(latestState!.studentPinError).toBe("Add a short reason so the audit log explains the recovery.")
  })

  it("submits a provisional PIN and stores issued PIN details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ provisionalPin: "1234", provisionalPinMasked: "••34", expiresAt: "2026-05-29T23:59:00.000Z" }) as unknown as Response)
    const state = await renderHookHarness()

    await act(async () => {
      state.openStudentPinModal(payment)
      state.setStudentPinReason("Front desk assisted recovery")
      state.setStudentPinDraft("1234")
    })
    await act(async () => {
      await latestState!.submitStudentPinIssue()
    })

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/staff/users/user-1/pin", expect.objectContaining({ method: "POST" }))
    expect(latestState!.studentPinIssued?.value).toBe("1234")
  })
})
