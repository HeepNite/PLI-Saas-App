// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffReportsPanel from "@/components/front/staff/StaffReportsPanel"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type StaffReportsPanelProps = React.ComponentProps<typeof StaffReportsPanel>
type StaffReportsAdmin = StaffReportsPanelProps["reports"]

const reportsData: StaffReportsAdmin["reportsData"] = {
  totalRevenueCents: 6000,
  totalPaidSales: 2,
  avgTicketCents: 3000,
  uniqueStudents: 2,
  checkInRate: 50,
  topCourses: [
    { courseTitle: "Salsa", paidSales: 1, paidRevenueCents: 3500, checkIns: 1 },
    { courseTitle: "Bachata Basics", paidSales: 1, paidRevenueCents: 2500, checkIns: 1 },
  ],
  monthlyPerformance: [
    { monthKey: "2026-05", monthLabel: "May 2026", paidSales: 2, pendingSales: 1, paidRevenueCents: 6000 },
  ],
  monthlyRevenueSeries: [
    { monthKey: "2026-05", monthLabel: "May 2026", paidSales: 2, pendingSales: 1, paidRevenueCents: 6000 },
  ],
  channelBreakdown: [{ key: "card", sales: 2, paidRevenueCents: 6000 }],
  weekdayPerformance: [{ weekday: 1, label: "Mon", paidSales: 2, paidRevenueCents: 6000 }],
  timeWindowRanking: [{ window: "Evening", paidSales: 2, paidRevenueCents: 6000 }],
  cohortRetention: [
    {
      weekStartTs: 1777852800000,
      weekLabel: "May 4 – May 10",
      students: 2,
      rates: [
        { offset: 0, active: 2, percentage: 100 },
        { offset: 1, active: 1, percentage: 50 },
        { offset: 2, active: 0, percentage: 0 },
        { offset: 3, active: 0, percentage: 0 },
        { offset: 4, active: 0, percentage: 0 },
      ],
    },
  ],
  paidPackageSales: 1,
  paidDropInSales: 1,
  pendingStripeSales: 1,
  totalRows: 3,
}

const createReports = (overrides: Partial<StaffReportsAdmin> = {}): StaffReportsAdmin => ({
  reportsDateFrom: "2026-05-01",
  reportsDateTo: "2026-05-31",
  reportsObjectiveFilter: "all",
  expandedSuggestionId: "monday-demand",
  doneSuggestionIds: [],
  reportSuggestionsProvider: "local",
  reportSuggestionsLoading: false,
  reportSuggestionsError: null,
  setReportsDateFrom: vi.fn(),
  setReportsDateTo: vi.fn(),
  setReportsObjectiveFilter: vi.fn(),
  setExpandedSuggestionId: vi.fn(),
  setDoneSuggestionIds: vi.fn(),
  reportFilteredPayments: [],
  reportsRangeLabel: "2026-05-01 to 2026-05-31",
  reportsData,
  reportsChartMeta: {
    maxMonthlyRevenue: 6000,
    maxTopCourseRevenue: 3500,
    maxWindowRevenue: 6000,
  },
  localReportSuggestions: [],
  reportSuggestionsMetrics: {
    rangeLabel: "2026-05-01 to 2026-05-31",
    totalRows: 3,
    totalPaidSales: 2,
    totalRevenueCents: 6000,
    avgTicketCents: 3000,
    uniqueStudents: 2,
    checkInRate: 50,
    pendingStripeSales: 1,
    mondayPaidSales: 2,
    avgPaidSalesPerDay: 2,
    paidPackageSales: 1,
    paidDropInSales: 1,
    packageSharePct: 50,
    latestCohortWeek: "May 4 – May 10",
    latestCohortW1RetentionPct: 50,
    topCourses: [],
    timeWindowRanking: [],
    channelBreakdown: [],
  },
  reportSuggestions: [],
  filteredReportSuggestions: [
    {
      id: "monday-demand",
      objective: "monday_sales",
      title: "Increase Monday demand",
      priority: "High",
      insight: "Monday paid sales: 2.",
      proposal: "Run a Monday experiment.",
      actions: ["Send segmented reminders"],
      aiBrief: "AI brief content",
    },
  ],
  refreshAiSuggestions: vi.fn().mockResolvedValue(undefined),
  exportReportsCsv: vi.fn(),
  exportReportsPdf: vi.fn(),
  ...overrides,
})

const createProps = (overrides: Partial<StaffReportsPanelProps> = {}): StaffReportsPanelProps => ({
  isReportsView: true,
  reports: createReports(),
  formatMoney: (cents) => `$${(cents / 100).toFixed(2)}`,
  setError: vi.fn(),
  ...overrides,
})

describe("StaffReportsPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function renderPanel(props: StaffReportsPanelProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffReportsPanel {...props} />)
    })
    return container
  }

  it("renders nothing when reports view is hidden", async () => {
    const node = await renderPanel(createProps({ isReportsView: false }))

    expect(node.textContent).not.toContain("Sales and student analytics")
  })

  it("renders reports KPIs and tables", async () => {
    const node = await renderPanel(createProps())

    expect(node.textContent).toContain("Sales and student analytics")
    expect(node.textContent).toContain("$60.00")
    expect(node.textContent).toContain("Paid sales")
    expect(node.textContent).toContain("Salsa")
    expect(node.textContent).toContain("May 2026")
    expect(node.textContent).toContain("Increase Monday demand")
  })

  it("wires date controls and export buttons", async () => {
    const reports = createReports()
    const node = await renderPanel(createProps({ reports }))

    const fromInput = node.querySelector<HTMLInputElement>('input[type="date"]')!
    const buttons = Array.from(node.querySelectorAll("button"))
    const setInputValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set

    await act(async () => {
      setInputValue?.call(fromInput, "2026-05-10")
      fromInput.dispatchEvent(new Event("change", { bubbles: true }))
      buttons.find((button) => button.textContent === "Clear")?.click()
      buttons.find((button) => button.textContent === "Export CSV")?.click()
      buttons.find((button) => button.textContent === "Export PDF")?.click()
    })

    expect(reports.setReportsDateFrom).toHaveBeenNthCalledWith(1, "2026-05-10")
    expect(reports.setReportsDateFrom).toHaveBeenNthCalledWith(2, "")
    expect(reports.setReportsDateTo).toHaveBeenCalledWith("")
    expect(reports.exportReportsCsv).toHaveBeenCalledTimes(1)
    expect(reports.exportReportsPdf).toHaveBeenCalledTimes(1)
  })

  it("wires objective filter, expand, done, and AI refresh actions", async () => {
    const reports = createReports()
    const node = await renderPanel(createProps({ reports }))
    const buttons = Array.from(node.querySelectorAll("button"))

    await act(async () => {
      buttons.find((button) => button.textContent === "Increase Monday sales")?.click()
      buttons.find((button) => button.textContent === "Generate AI suggestions")?.click()
      buttons.find((button) => button.textContent === "Hide steps")?.click()
      buttons.find((button) => button.textContent === "Mark done")?.click()
    })

    expect(reports.setReportsObjectiveFilter).toHaveBeenCalledWith("monday_sales")
    expect(reports.refreshAiSuggestions).toHaveBeenCalledTimes(1)
    expect(reports.setExpandedSuggestionId).toHaveBeenCalledWith(expect.any(Function))
    expect(reports.setDoneSuggestionIds).toHaveBeenCalledWith(expect.any(Function))
  })

  it("routes copy AI brief failures through the shared error setter", async () => {
    const setError = vi.fn()
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } })
    const node = await renderPanel(createProps({ setError }))
    const copyButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Copy AI brief")!

    await act(async () => {
      copyButton.click()
    })

    expect(setError).toHaveBeenCalledWith("Unable to copy AI brief.")
  })
})
