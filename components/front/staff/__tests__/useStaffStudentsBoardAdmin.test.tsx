// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffStudentsBoardAdmin } from "@/components/front/staff/useStaffStudentsBoardAdmin"
import type { PaymentRow, PaymentsApiSummary } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const emptySummary = (): PaymentsApiSummary => ({
  totalItems: 0,
  totalCollected: 0,
  pendingSettlement: 0,
  paidSettlement: 0,
  pendingStripe: 0,
  paidStripe: 0,
})

const payment = (overrides: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "payment-1",
  userId: "student-1",
  courseSlug: "reformer",
  courseTitle: "Reformer",
  customerName: "Ada Lovelace",
  customerEmail: "ada@example.com",
  customerPhone: "555-0100",
  customerAvatarUrl: null,
  packageId: null,
  serviceId: null,
  paymentChannel: "cash",
  purchaseCategory: "dropin",
  amount: 2500,
  currency: "usd",
  paymentStatus: "paid",
  settlementStatus: "pending",
  settlementNote: "",
  settledAt: null,
  createdAt: "2026-03-25T14:00:00.000Z",
  updatedAt: "2026-03-25T14:00:00.000Z",
  classDate: "2026-03-25",
  classTime: "10:00",
  classStartsAt: "2026-03-25T14:00:00.000Z",
  location: "Studio A",
  pointsBalance: 0,
  pointsHistory: [],
  classPaid: true,
  attendanceId: "attendance-1",
  checkInStatus: "checked_in",
  checkInAt: "2026-03-25T13:55:00.000Z",
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
  completedClassesTotal: 1,
  packageClassesUsedTotal: 0,
  outstandingBalance: null,
  stripeFailure: null,
  ...overrides,
})

type HookOptions = Parameters<typeof useStaffStudentsBoardAdmin>[0]
type HookState = ReturnType<typeof useStaffStudentsBoardAdmin>

const createOptions = (overrides: Partial<HookOptions> = {}): HookOptions => ({
  payments: [payment()],
  isHistoryMode: false,
  historyClassKey: "",
  historyPaymentMethodFilter: "all",
  historyAttendanceFilter: "all",
  historyFrom: "2026-03-25",
  historyTo: "2026-03-25",
  paymentCategoryFilter: "cash",
  paymentsFilter: "all",
  studentSearchQuery: "",
  selectedPaymentIds: [],
  paymentsMonthlySummaryApi: emptySummary(),
  paymentsMonthlyStudentCount: 0,
  paymentsMonthlyCheckedInStudents: 0,
  nowTs: Date.parse("2026-03-25T12:00:00.000Z"),
  currentRole: "admin",
  currentCategory: null,
  usersWithAuditEntries: new Set(),
  checkUserHasAuditEntries: vi.fn().mockResolvedValue(undefined),
  pruneSelectedPaymentIds: vi.fn(),
  updateSettlementBulk: vi.fn().mockResolvedValue(undefined),
  refreshPaymentsBoard: vi.fn().mockResolvedValue(undefined),
  handleStaffAuthFailure: vi.fn().mockReturnValue(false),
  // Default: transparent passthrough to `fetch`, matching `staffAuthedFetch`'s
  // contract for any non-401 response. Tests that exercise the 401
  // refresh-and-retry behavior live in useStaffAuthedFetch.test.tsx; these
  // poller tests only need the plumbing wired through.
  staffAuthedFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  ...overrides,
})

function HookHarness({ options, onState }: { options: HookOptions; onState: (state: HookState) => void }) {
  const state = useStaffStudentsBoardAdmin(options)
  React.useEffect(() => {
    onState(state)
  }, [onState, state])
  return null
}

describe("useStaffStudentsBoardAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let latestState: HookState | null = null
  let currentOptions: HookOptions = createOptions()

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    latestState = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function renderHook(options: HookOptions = createOptions()) {
    currentOptions = options
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness options={currentOptions} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  async function rerender(options: HookOptions) {
    currentOptions = options
    await act(async () => root!.render(<HookHarness options={currentOptions} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("derives daily board cards, cash selection ids, and student summary", async () => {
    const pruneSelectedPaymentIds = vi.fn()
    const checkUserHasAuditEntries = vi.fn().mockResolvedValue(undefined)
    const state = await renderHook(createOptions({
      payments: [
        payment({ id: "cash-open", userId: "student-1", customerName: "Ada Lovelace", settlementStatus: "pending", amount: 2500 }),
        payment({ id: "card-paid", userId: "student-2", customerName: "Grace Hopper", paymentChannel: "card", settlementStatus: "paid", amount: 3200 }),
      ],
      selectedPaymentIds: ["cash-open"],
      pruneSelectedPaymentIds,
      checkUserHasAuditEntries,
    }))

    expect(state.cardContext).toBe("daily")
    expect(state.cardVariant).toMatchObject({ context: "daily", showCheckout: true, showCheckInStatus: true })
    expect(state.filteredStudentCards).toHaveLength(1)
    expect(state.visiblePaymentIds).toEqual(["cash-open"])
    expect(state.selectedFilteredPaymentIds).toEqual(["cash-open"])
    expect(state.cashSelectedCount).toBe(1)
    expect(state.studentsSummary).toMatchObject({
      totalStudents: 1,
      paidStudents: 1,
      checkedInStudents: 1,
      totalRevenueCents: 2500,
      pendingByContext: 1,
    })
    expect(pruneSelectedPaymentIds).toHaveBeenCalledWith(["cash-open"])
    expect(checkUserHasAuditEntries).toHaveBeenCalledWith("student-1")
  })

  it("resets pagination when filters change", async () => {
    const payments = Array.from({ length: 12 }, (_, index) =>
      payment({
        id: `payment-${index}`,
        userId: `student-${index}`,
        customerName: `Student ${index}`,
        settlementStatus: index % 2 === 0 ? "pending" : "paid",
      })
    )
    let state = await renderHook(createOptions({ payments, paymentCategoryFilter: "cash" }))

    expect(state.totalPages).toBe(2)
    await act(async () => {
      latestState!.setCurrentPage(2)
    })
    expect(latestState!.currentPage).toBe(2)

    state = await rerender(createOptions({ payments, paymentCategoryFilter: "cash", paymentsFilter: "pending" }))

    expect(state.currentPage).toBe(1)
  })

  it("derives history context stats and readable range", async () => {
    const state = await renderHook(createOptions({
      isHistoryMode: true,
      paymentCategoryFilter: "history",
      historyFrom: "2026-03-25",
      historyTo: "2026-03-26",
      payments: [
        payment({ id: "package-credit", paymentChannel: "package_credit", purchaseCategory: "package", amount: 0, packageId: "pkg-1" }),
        payment({ id: "dropin-card", userId: "student-2", customerName: "Grace Hopper", paymentChannel: "card", purchaseCategory: "dropin", amount: 3000 }),
      ],
      paymentsMonthlySummaryApi: {
        totalItems: 4,
        totalCollected: 12000,
        pendingSettlement: 1000,
        paidSettlement: 11000,
        pendingStripe: 0,
        paidStripe: 12000,
      },
      paymentsMonthlyStudentCount: 7,
      paymentsMonthlyCheckedInStudents: 5,
    }))

    expect(state.cardContext).toBe("history")
    expect(state.cardVariant).toMatchObject({ context: "history", showCheckout: false, showHistoryTooltip: true })
    expect(state.historyDerivedStats).toMatchObject({ studentCount: 2, checkedInCount: 2, packages: 1, dropIn: 1 })
    expect(state.studentsSummary).toMatchObject({ totalStudents: 7, checkedInStudents: 5, totalRevenueCents: 12000 })
    expect(state.historyReadableRange).toBe("Wed 25 Mar 26 → Thu 26 Mar 26")
  })

  it("keeps history card aggregates and detail payments within the active filter scope", async () => {
    const state = await renderHook(createOptions({
      isHistoryMode: true,
      paymentCategoryFilter: "history",
      historyClassKey: "reformer",
      historyPaymentMethodFilter: "cash",
      historyAttendanceFilter: "attended",
      payments: [
        payment({ id: "reformer-paid", settlementStatus: "paid", outstandingBalance: 750, amount: 2500 }),
        payment({
          id: "salsa-pending",
          courseSlug: "salsa",
          courseTitle: "Salsa",
          settlementStatus: "pending",
          classPaid: false,
          amount: 9000,
        }),
      ],
    }))

    expect(state.filteredStudentCards).toHaveLength(1)
    expect(state.filteredStudentCards[0]).toMatchObject({
      totalPayments: 1,
      totalCollectedCents: 2500,
      paidPayments: 1,
      allPayments: [{ id: "reformer-paid" }],
    })
    expect(state.historyDerivedStats).toMatchObject({
      paidCount: 1,
      pendingCount: 0,
      totalCollected: 2500,
      dropIn: 1,
    })
  })

  it("orders the current filtered scope by collected spend while preserving equal-spend order and zero-spend students", async () => {
    await renderHook(createOptions({
      isHistoryMode: true,
      paymentCategoryFilter: "history",
      payments: [
        payment({ id: "first-equal", userId: "student-1", amount: 2000 }),
        payment({ id: "second-equal", userId: "student-2", customerName: "Grace Hopper", amount: 2000 }),
        payment({ id: "zero-spend", userId: "student-3", customerName: "Katherine Johnson", amount: 0 }),
      ],
    }))

    const preCollectedEqualSpendOrder = latestState!.filteredStudentCards
      .map((card) => card.latestPayment.id)
      .filter((id) => id !== "zero-spend")

    await act(async () => {
      latestState!.activateCollectedOrdering()
    })

    expect(latestState!.isCollectedOrdering).toBe(true)
    expect(latestState!.filteredStudentCards.map((card) => card.latestPayment.id)).toEqual([
      ...preCollectedEqualSpendOrder,
      "zero-spend",
    ])
  })

  it("backs off web-cash arrival polling when a degraded 200 response is returned", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"))
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "X-Staff-Service-Status": "degraded", "Retry-After": "30" },
      }),
    )

    await renderHook(createOptions())
    await act(async () => undefined)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => {
      vi.advanceTimersByTime(20_000)
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("backs off payments pulse polling when a degraded 200 payload is returned", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"))
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/payments/pulse")) {
        return Promise.resolve(new Response(JSON.stringify({ status: "degraded" }), { status: 200, headers: { "Retry-After": "30" } }))
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    })

    await renderHook(createOptions())
    await act(async () => undefined)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => {
      vi.advanceTimersByTime(15_000)
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/staff/payments/pulse"))).toHaveLength(1)
    await act(async () => {
      vi.advanceTimersByTime(15_000)
    })

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/staff/payments/pulse"))).toHaveLength(2)
  })
})
