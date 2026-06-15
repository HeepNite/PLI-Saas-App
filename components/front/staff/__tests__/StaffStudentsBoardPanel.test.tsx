// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffStudentsBoardPanel, {
  type StaffStudentsBoardPanelProps,
  type TerminalPinAlert,
} from "@/components/front/staff/StaffStudentsBoardPanel"
import type { StudentProfileCard } from "@/components/front/staff/historyCardAggregates"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleAlert: TerminalPinAlert = {
  terminalId: "terminal-1",
  terminalName: "Front Desk",
  terminalLocation: "Lobby",
  severity: "warning",
  label: "Watch list",
  message: "Multiple PIN misses detected.",
  blockedUntil: null,
  missCount: 4,
}

const createControls = (): StaffStudentsBoardPanelProps["controls"] => ({
  studentsSummary: {
    totalStudents: 0,
    totalRevenueCents: 0,
    pendingByContext: 0,
    paidStudents: 0,
    checkedInStudents: 0,
  },
  paymentCategoryFilter: "all",
  onPaymentCategoryChange: vi.fn(),
  studentSearchQuery: "",
  setStudentSearchQuery: vi.fn(),
  isGlobalSearchLoading: false,
  isHistorySearchLoading: false,
  globalSearchError: null,
  paymentsFilter: "all",
  setPaymentsFilter: vi.fn(),
  isHistoryMode: false,
  historyFrom: "",
  historyTo: "",
  onHistoryRangeChange: vi.fn(),
  todayDateIso: "2026-05-26",
  historyReadableRange: "",
  historyClassKey: "",
  setHistoryClassKey: vi.fn(),
  historyClassOptions: [],
  historyPaymentMethodFilter: "all",
  setHistoryPaymentMethodFilter: vi.fn(),
  historyAttendanceFilter: "all",
  setHistoryAttendanceFilter: vi.fn(),
  historyDerivedStats: {
    studentCount: 0,
    paidCount: 0,
    pendingCount: 0,
    totalCollected: 0,
    checkedInCount: 0,
    packages: 0,
    dropIn: 0,
  },
  filteredStudentCardsLength: 0,
  visiblePaymentIds: [],
  selectPaymentIds: vi.fn(),
  clearSelectedPayments: vi.fn(),
  selectedFilteredPaymentIdsLength: 0,
  cashSelectedCount: 0,
  paymentsBulkBusyAction: null,
  selectedPaymentIds: [],
  onSettlementBulkUpdate: vi.fn(),
  hasGlobalSearchResults: false,
})

const createProps = (
  overrides: Partial<StaffStudentsBoardPanelProps> = {},
): StaffStudentsBoardPanelProps => ({
  isStudentsView: true,
  loadingStatus: {
    paymentsLoading: false,
    onRefreshPaymentsBoard: vi.fn(),
  },
  clerkSync: {
    canManageClerkSync: false,
    clerkSyncLoading: false,
    clerkSyncRepairing: false,
    clerkSyncError: null,
    clerkSyncMessage: null,
    clerkSyncHealth: null,
    onCheckClerkSync: vi.fn(),
    onRepairClerkSync: vi.fn(),
    clerkMismatchByUserId: new Map(),
    clerkSyncUserBusyId: null,
    onSyncClerkUser: vi.fn(),
  },
  terminalAlerts: {
    prioritizedTerminalPinAlerts: [],
    hasAnyTerminalPinAlerts: false,
    nowTs: Date.parse("2026-05-26T12:00:00.000Z"),
  },
  controls: createControls(),
  cards: {
    displayedStudentCards: [],
    filteredStudentCardsCount: 0,
    searchResultCards: null,
    shouldPreservePaymentBoard: false,
    cardContext: "daily",
    cardVariant: {
      context: "daily",
      showCheckout: true,
      showCashBulkSelection: true,
      showPinActions: true,
      showMailCopyActions: true,
      showHistorySubtitle: false,
      showHistoryTooltip: false,
      showLatestClassAttended: true,
      showActivePackage: true,
      showCheckInStatus: true,
    },
    studentSearchQuery: "",
    historyFrom: "",
    historyTo: "",
    selectedPaymentIds: [],
    selectPaymentIds: vi.fn(),
    deselectPaymentIds: vi.fn(),
    onSettlementBulkUpdate: vi.fn(),
    paymentHistoryStudentId: null,
    attendanceHistoryStudentId: null,
    setPaymentHistoryAnchor: vi.fn(),
    setAttendanceHistoryAnchor: vi.fn(),
    setPaymentHistoryStudentId: vi.fn(),
    setAttendanceHistoryStudentId: vi.fn(),
    setAuditHistoryAnchor: vi.fn(),
    setAuditHistoryStudentId: vi.fn(),
    setAuditHistoryStudentName: vi.fn(),
    usersWithAuditEntries: new Set<string>(),
    canOperateStudentPins: false,
    openStudentPinModal: vi.fn(),
    openStudentPinModalForProfile: vi.fn(),
    openOverrideModal: vi.fn(),
    currentRole: "staff",
    currentCategory: null,
    formatMoney: (cents) => `$${(cents / 100).toFixed(2)}`,
  },
  pagination: {
    currentPage: 1,
    totalPages: 1,
    setCurrentPage: vi.fn(),
  },
  ...overrides,
})

// ---------------------------------------------------------------------------
// Render harness
// ---------------------------------------------------------------------------

describe("StaffStudentsBoardPanel", () => {
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
  })

  async function renderPanel(props: StaffStudentsBoardPanelProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffStudentsBoardPanel {...props} />)
    })
    return container
  }

  it("returns null when isStudentsView is false", async () => {
    const node = await renderPanel(createProps({ isStudentsView: false }))
    expect(node.textContent).not.toContain("Student payment board")
    expect(node.querySelector("#students-payments")).toBeNull()
  })

  it("renders header and triggers refresh callback on click", async () => {
    const onRefreshPaymentsBoard = vi.fn()
    const node = await renderPanel(
      createProps({
        loadingStatus: { paymentsLoading: false, onRefreshPaymentsBoard },
      }),
    )

    expect(node.textContent).toContain("Student payment board")

    const refreshButton = node.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh payments board"]',
    )
    expect(refreshButton).not.toBeNull()
    await act(async () => {
      refreshButton!.click()
    })
    expect(onRefreshPaymentsBoard).toHaveBeenCalledTimes(1)
  })

  it("renders Clerk sync banner when users need sync and Sync users wires repair", async () => {
    const onRepairClerkSync = vi.fn()
    const node = await renderPanel(
      createProps({
        clerkSync: {
          canManageClerkSync: true,
          clerkSyncLoading: false,
          clerkSyncRepairing: false,
          clerkSyncError: null,
          clerkSyncMessage: null,
          clerkSyncHealth: {
            clerkUsers: 5,
            dbUsersWithClerkId: 4,
            missingCount: 2,
            missingUsers: [
              { clerkId: "c-1", email: "user1@example.com" },
              { clerkId: "c-2", email: "user2@example.com" },
            ],
          },
          onCheckClerkSync: vi.fn(),
          onRepairClerkSync,
          clerkMismatchByUserId: new Map(),
          clerkSyncUserBusyId: null,
          onSyncClerkUser: vi.fn(),
        },
      }),
    )

    expect(node.textContent).toContain("Users need sync")

    const syncButton = Array.from(node.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Sync users",
    )
    expect(syncButton).toBeDefined()

    await act(async () => {
      syncButton!.click()
    })
    expect(onRepairClerkSync).toHaveBeenCalledTimes(1)
  })

  it("hides Clerk sync banner when user cannot manage and nothing is wrong", async () => {
    const node = await renderPanel(createProps())
    expect(node.textContent).not.toContain("Users need sync")
    expect(node.textContent).not.toContain("Sync users")
  })

  it("renders terminal PIN alerts strip only when alerts exist", async () => {
    const empty = await renderPanel(createProps())
    expect(empty.textContent).not.toContain("Terminal alerts")

    const node = await renderPanel(
      createProps({
        terminalAlerts: {
          prioritizedTerminalPinAlerts: [sampleAlert],
          hasAnyTerminalPinAlerts: true,
          nowTs: Date.parse("2026-05-26T12:00:00.000Z"),
        },
      }),
    )

    expect(node.textContent).toContain("Terminal alerts")
    expect(node.textContent).toContain("Front Desk")
    expect(node.textContent).toContain("Multiple PIN misses detected.")
    expect(node.textContent).toContain("Auto-refresh every 5s")
  })

  it("wires pagination Previous/Next buttons and respects boundaries", async () => {
    const setCurrentPage = vi.fn()
    const node = await renderPanel(
      createProps({
        pagination: { currentPage: 1, totalPages: 3, setCurrentPage },
      }),
    )

    expect(node.textContent).toContain("Page 1 / 3")

    const buttons = Array.from(node.querySelectorAll("button"))
    const previousBtn = buttons.find((btn) => btn.textContent === "Previous")
    const nextBtn = buttons.find((btn) => btn.textContent === "Next")

    expect(previousBtn).toBeDefined()
    expect(nextBtn).toBeDefined()
    expect(previousBtn!.disabled).toBe(true)
    expect(nextBtn!.disabled).toBe(false)

    await act(async () => {
      nextBtn!.click()
    })
    expect(setCurrentPage).toHaveBeenCalledTimes(1)

    // Boundary: at last page Next is disabled.
    const lastPageNode = await renderPanel(
      createProps({
        pagination: { currentPage: 3, totalPages: 3, setCurrentPage: vi.fn() },
      }),
    )
    const lastButtons = Array.from(lastPageNode.querySelectorAll("button"))
    const lastNextBtn = lastButtons.find((btn) => btn.textContent === "Next")
    expect(lastNextBtn!.disabled).toBe(true)
  })

  it("hides pagination footer when there is only one page", async () => {
    const node = await renderPanel(
      createProps({
        pagination: { currentPage: 1, totalPages: 1, setCurrentPage: vi.fn() },
      }),
    )
    expect(node.textContent).not.toContain("Page 1 / 1")
    expect(node.textContent).not.toContain("Previous")
  })

  describe("Edit info button visibility", () => {
    const minimalProfileCard: StudentProfileCard = {
      source: "profile",
      key: "student-1",
      userId: "user-1",
      displayName: "Test Student",
      email: "student@example.com",
      phone: null,
      avatarUrl: null,
      registeredAt: "2024-01-01T00:00:00.000Z",
      checkInStatus: "none",
      latestClassAttended: null,
      latestCheckInAt: null,
      lastPayment: null,
      lastCourse: null,
      paymentStatus: null,
      activePackage: null,
      remainingCredits: null,
      outstandingBalance: null,
      pinStatus: "none",
      cashSettlement: null,
      pendingSettlement: null,
      pointsBalance: 0,
    }

    it("shows Edit info for staff with front_desk category", async () => {
      const node = await renderPanel(
        createProps({
          cards: {
            ...createProps().cards,
            displayedStudentCards: [minimalProfileCard],
            filteredStudentCardsCount: 1,
            currentRole: "staff",
            currentCategory: "front_desk",
          },
        }),
      )
      const buttons = Array.from(node.querySelectorAll("button"))
      const editInfoButton = buttons.find((btn) => btn.textContent?.trim() === "Edit info")
      expect(editInfoButton).toBeDefined()
    })

    it("hides Edit info for staff without front_desk category", async () => {
      const node = await renderPanel(
        createProps({
          cards: {
            ...createProps().cards,
            displayedStudentCards: [minimalProfileCard],
            filteredStudentCardsCount: 1,
            currentRole: "staff",
            currentCategory: "teacher",
          },
        }),
      )
      const buttons = Array.from(node.querySelectorAll("button"))
      const editInfoButton = buttons.find((btn) => btn.textContent?.trim() === "Edit info")
      expect(editInfoButton).toBeUndefined()
    })

    it("shows Edit info for owner", async () => {
      const node = await renderPanel(
        createProps({
          cards: {
            ...createProps().cards,
            displayedStudentCards: [minimalProfileCard],
            filteredStudentCardsCount: 1,
            currentRole: "owner",
            currentCategory: "partner",
          },
        }),
      )
      const buttons = Array.from(node.querySelectorAll("button"))
      const editInfoButton = buttons.find((btn) => btn.textContent?.trim() === "Edit info")
      expect(editInfoButton).toBeDefined()
    })

    it("shows Edit info for admin", async () => {
      const node = await renderPanel(
        createProps({
          cards: {
            ...createProps().cards,
            displayedStudentCards: [minimalProfileCard],
            filteredStudentCardsCount: 1,
            currentRole: "admin",
            currentCategory: "manager",
          },
        }),
      )
      const buttons = Array.from(node.querySelectorAll("button"))
      const editInfoButton = buttons.find((btn) => btn.textContent?.trim() === "Edit info")
      expect(editInfoButton).toBeDefined()
    })
  })

  it("passes refresh trigger through StaffPaymentsBoardControls payment category change", async () => {
    const onPaymentCategoryChange = vi.fn()
    const controls = createControls()
    const node = await renderPanel(
      createProps({
        controls: { ...controls, onPaymentCategoryChange },
      }),
    )

    // StaffPaymentsBoardControls renders a "Card" filter button — clicking it should call our handler.
    const cardFilterButton = Array.from(node.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Card",
    )
    expect(cardFilterButton).toBeDefined()
    await act(async () => {
      cardFilterButton!.click()
    })
    expect(onPaymentCategoryChange).toHaveBeenCalledWith("card")
  })
})
