// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { PaymentRow, ReportsSuggestion } from "@/components/front/staff/staffAdminTypes"
import { useStaffReportsAdmin } from "@/components/front/staff/useStaffReportsAdmin"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookResult = ReturnType<typeof useStaffReportsAdmin>

const createPayment = (overrides: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "payment-1",
  userId: "user-1",
  courseSlug: "bachata",
  courseTitle: "Bachata Basics",
  isSpecialEvent: false,
  customerName: "Jane Student",
  customerEmail: "jane@example.com",
  customerPhone: "555-0100",
  customerAvatarUrl: null,
  packageId: null,
  serviceId: null,
  paymentChannel: "card",
  purchaseCategory: "dropin",
  amount: 2500,
  currency: "usd",
  paymentStatus: "paid",
  settlementStatus: "pending",
  settlementNote: "",
  settledAt: null,
  createdAt: "2026-05-05T12:00:00.000Z",
  updatedAt: "2026-05-05T12:00:00.000Z",
  classDate: "2026-05-05",
  classTime: "18:00",
  classStartsAt: "2026-05-05T18:00:00.000Z",
  location: null,
  pointsBalance: 0,
  pointsHistory: [],
  classPaid: true,
  attendanceId: "attendance-1",
  checkInStatus: "checked_in",
  checkInAt: null,
  checkedOutAt: null,
  activePackage: null,
  studentPin: {
    enabled: false,
    enrolled: false,
    locked: false,
    needsEnrollment: false,
    permanentStatus: null,
    provisionalActive: false,
    provisionalExpiresAt: null,
  },
  packageClassNumber: null,
  fundingPayment: null,
  completedClassesTotal: 0,
  packageClassesUsedTotal: 0,
  outstandingBalance: null,
  stripeFailure: null,
  ...overrides,
})

const payments = [
  createPayment(),
  createPayment({
    id: "payment-2",
    userId: "user-2",
    courseSlug: "salsa",
    courseTitle: "Salsa",
    amount: 3500,
    createdAt: "2026-05-12T12:00:00.000Z",
    classStartsAt: "2026-05-12T19:00:00.000Z",
    purchaseCategory: "package",
    paymentChannel: "cash",
    checkInStatus: "scheduled",
  }),
  createPayment({
    id: "payment-3",
    userId: "user-3",
    amount: 4500,
    createdAt: "2026-04-01T12:00:00.000Z",
    classPaid: false,
    checkInStatus: "none",
  }),
]

describe("useStaffReportsAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let captured: HookResult | null = null
  const setError = vi.fn()

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

  async function renderHook(inputPayments = payments) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function TestHarness() {
      captured = useStaffReportsAdmin({ payments: inputPayments, setError })
      return null
    }

    await act(async () => {
      root!.render(<TestHarness />)
    })

    return captured!
  }

  it("filters report payments by date range even when dates are swapped", async () => {
    const hook = await renderHook()

    await act(async () => {
      hook.setReportsDateFrom("2026-05-31")
      hook.setReportsDateTo("2026-05-01")
    })

    expect(captured!.reportFilteredPayments.map((payment) => payment.id)).toEqual(["payment-1", "payment-2"])
    expect(captured!.reportsRangeLabel).toBe("2026-05-31 to 2026-05-01")
  })

  it("aggregates report data from paid and pending payments", async () => {
    const hook = await renderHook()

    expect(hook.reportsData.totalRevenueCents).toBe(6000)
    expect(hook.reportsData.totalPaidSales).toBe(2)
    expect(hook.reportsData.avgTicketCents).toBe(3000)
    expect(hook.reportsData.uniqueStudents).toBe(2)
    expect(hook.reportsData.checkInRate).toBe(50)
    expect(hook.reportsData.pendingStripeSales).toBe(1)
    expect(hook.reportsData.topCourses[0]?.courseTitle).toBe("Salsa")
  })

  it("creates local suggestions and syncs the expanded suggestion with the active objective", async () => {
    const hook = await renderHook()

    expect(hook.localReportSuggestions.map((suggestion) => suggestion.id)).toContain("monday-demand")

    await act(async () => {
      hook.setReportsObjectiveFilter("retention")
    })

    expect(captured!.filteredReportSuggestions.every((suggestion) => suggestion.objective === "retention")).toBe(true)
    expect(captured!.expandedSuggestionId).toBe(captured!.filteredReportSuggestions[0]?.id)
  })

  it("loads remote AI suggestions when the suggestions endpoint succeeds", async () => {
    const remoteSuggestion: ReportsSuggestion = {
      id: "remote-1",
      objective: "class_quality",
      title: "Remote suggestion",
      priority: "High",
      insight: "Remote insight",
      proposal: "Remote proposal",
      actions: ["Act"],
      aiBrief: "Brief",
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, provider: "mock", suggestions: [remoteSuggestion] }) }))
    const hook = await renderHook()

    await act(async () => {
      await hook.refreshAiSuggestions()
    })

    expect(captured!.reportSuggestionsProvider).toBe("mock")
    expect(captured!.filteredReportSuggestions[0]?.id).toBe("remote-1")
    expect(captured!.reportSuggestionsError).toBeNull()
  })

  it("falls back to local suggestions when the suggestions endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: "AI unavailable" }) }))
    const hook = await renderHook()

    await act(async () => {
      await hook.refreshAiSuggestions()
    })

    expect(captured!.reportSuggestionsProvider).toBe("local")
    expect(captured!.reportSuggestionsError).toBe("AI unavailable")
    expect(captured!.filteredReportSuggestions.map((suggestion) => suggestion.id)).toContain("monday-demand")
  })

  it("surfaces the existing popup-blocked error when PDF export cannot open a window", async () => {
    vi.spyOn(window, "open").mockReturnValue(null)
    const hook = await renderHook()

    act(() => {
      hook.exportReportsPdf()
    })

    expect(setError).toHaveBeenCalledWith("Popup blocked. Allow popups to export PDF.")
  })

  it("exports CSV with report sections and payment rows", async () => {
    const clicked = vi.fn()
    const anchor = document.createElement("a")
    anchor.click = clicked
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      if (tagName === "a") return anchor
      return originalCreateElement(tagName, options)
    })
    const createObjectURL = vi.fn().mockReturnValue("blob:reports")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })
    const hook = await renderHook()

    act(() => {
      hook.exportReportsCsv()
    })

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    await expect(blob.text()).resolves.toContain("Top courses")
    expect(anchor.download).toMatch(/^staff-reports-.*\.csv$/)
    expect(clicked).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:reports")
  })
})
