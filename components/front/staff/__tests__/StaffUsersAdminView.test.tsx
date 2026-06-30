// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffUsersAdminView, { type StaffUsersAdminViewProps } from "@/components/front/staff/StaffUsersAdminView"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/components/front/staff/StaffPortalNavButton", () => ({
  default: ({ item, onSelect }: { item: { key: string; label: string }; onSelect: (key: string) => void }) => (
    <button type="button" data-testid={`nav-${item.key}`} onClick={() => onSelect(item.key)}>
      {item.label}
    </button>
  ),
}))

vi.mock("@/components/front/staff/StaffAssistantRightRail", () => ({
  default: ({ children }: { children: React.ReactNode }) => <aside data-testid="assistant-rail">{children}</aside>,
}))

vi.mock("@/components/front/staff/StaffAssistantRailContent", () => ({
  default: ({ onOpenAssistantConfig }: { onOpenAssistantConfig: () => void }) => (
    <button type="button" data-testid="open-assistant-config" onClick={onOpenAssistantConfig}>
      Open assistant config
    </button>
  ),
}))

vi.mock("@/components/front/staff/StaffProfileViewPanel", () => ({ default: () => <div data-testid="profile-view" /> }))
vi.mock("@/components/front/staff/StaffAccessCreatePanel", () => ({ default: () => <div data-testid="access-create" /> }))
vi.mock("@/components/front/staff/StaffAdminUtilityPanels", () => ({ default: () => <div data-testid="utility-panels" /> }))
vi.mock("@/components/front/staff/StaffTeamBoardPanel", () => ({ default: () => <div data-testid="team-board" /> }))
vi.mock("@/components/front/staff/StaffTeacherAssignmentPanel", () => ({ default: () => <div data-testid="teacher-assignment" /> }))
vi.mock("@/components/front/staff/StaffSchoolWorkspacePanel", () => ({ default: () => <div data-testid="school-workspace" /> }))
vi.mock("@/components/front/staff/StaffPayrollControlPanel", () => ({ default: () => <div data-testid="payroll-control" /> }))
vi.mock("@/components/front/staff/StaffStudentsBoardPanel", () => ({ default: () => <div data-testid="students-board" /> }))
vi.mock("@/components/front/staff/StaffReportsPanel", () => ({ default: () => <div data-testid="reports-panel" /> }))
vi.mock("@/components/front/staff/StaffApprovalsPanel", () => ({ default: () => <div data-testid="approvals-panel" /> }))
vi.mock("@/components/front/staff/StaffTeamCalendarPanel", () => ({ default: () => <div data-testid="team-calendar" /> }))
vi.mock("@/components/front/staff/StaffPerformanceMetricsPanel", () => ({ default: () => <div data-testid="performance-metrics" /> }))
vi.mock("@/components/front/staff/StaffAdminModalOverlays", () => ({ default: () => <div data-testid="modal-overlays" /> }))
vi.mock("@/components/front/staff/StaffProfileModal", () => ({ default: () => <div data-testid="profile-modal" /> }))
vi.mock("@/components/front/staff/StaffAdminHistoryOverlays", () => ({ default: () => <div data-testid="history-overlays" /> }))

const createProps = (): StaffUsersAdminViewProps => ({
  shell: {
    gridRef: { current: null },
    leftRailRef: { current: null },
    showInlineRightRail: false,
    reserveAssistantColumn: false,
    visibleNavItems: [
      { key: "users", label: "User Management", icon: (() => null) as never },
      { key: "assistant", label: "AI Assistant", icon: (() => null) as never },
    ],
    activeNav: "users",
    handleNavSelection: vi.fn(),
  },
  boards: {
    profileView: {} as never,
    accessCreate: {} as never,
    utilityPanels: {} as never,
    teamBoard: {} as never,
    teacherAssignment: {} as never,
    schoolWorkspace: {} as never,
    payrollControl: {} as never,
    studentsBoard: {} as never,
    reports: {} as never,
    approvals: {} as never,
    teamCalendar: {} as never,
    performanceMetrics: {} as never,
  },
  assistant: {
    rightRail: {} as never,
    content: {} as never,
  },
  modals: {
    adminModalOverlays: {} as never,
    profileModal: {} as never,
    assignableRoles: [],
    adminHistoryOverlays: {} as never,
  },
  actions: {
    onOpenAssistantConfig: vi.fn(),
    onClosePaymentHistory: vi.fn(),
    onCloseAttendanceHistory: vi.fn(),
    onCloseAuditHistory: vi.fn(),
    onOverrideSuccess: vi.fn(),
  },
  formatters: {
    resolveHistoryDateIso: () => "2026-05-31",
  },
  statusBanners: {
    currentRole: "owner",
  },
})

describe("StaffUsersAdminView", () => {
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

  async function renderView(props: StaffUsersAdminViewProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffUsersAdminView {...props} />)
    })
    return container
  }

  it("renders nav entries and wires nav selection callbacks", async () => {
    const props = createProps()
    const node = await renderView(props)

    const navUsersButton = node.querySelector<HTMLButtonElement>("[data-testid='nav-users']")
    const navAssistantButton = node.querySelector<HTMLButtonElement>("[data-testid='nav-assistant']")
    expect(navUsersButton).not.toBeNull()
    expect(navAssistantButton).not.toBeNull()

    await act(async () => {
      navAssistantButton!.click()
    })

    expect(props.shell.handleNavSelection).toHaveBeenCalledWith("assistant")
  })

  it("forwards assistant config open action to rail content", async () => {
    const props = createProps()
    const node = await renderView(props)
    const openAssistantButton = node.querySelector<HTMLButtonElement>("[data-testid='open-assistant-config']")

    expect(openAssistantButton).not.toBeNull()
    await act(async () => {
      openAssistantButton!.click()
    })

    expect(props.actions.onOpenAssistantConfig).toHaveBeenCalledTimes(1)
  })

  it("uses a two-column desktop grid when no assistant rail column is reserved", async () => {
    const props = createProps()
    const node = await renderView(props)
    const grid = node.firstElementChild

    expect(grid?.className).toContain("min-[1180px]:grid-cols-[86px_minmax(0,1fr)]")
    expect(grid?.className).not.toContain("_0px")
    expect(grid?.className).not.toContain("_330px")
    expect(grid?.className).not.toContain("transition-[grid-template-columns]")
  })

  it("uses a stable auto desktop assistant column when the rail participates in layout", async () => {
    const props = createProps()
    props.shell.reserveAssistantColumn = true
    const node = await renderView(props)
    const grid = node.firstElementChild

    expect(grid?.className).toContain("min-[1180px]:grid-cols-[86px_minmax(0,1fr)_auto]")
    expect(grid?.className).toContain("xl:grid-cols-[90px_minmax(0,1fr)_auto]")
    expect(grid?.className).not.toContain("transition-[grid-template-columns]")
  })

  it("keeps the desktop assistant rail close to the content without adding outer gap", async () => {
    const props = createProps()
    props.shell.showInlineRightRail = true
    const node = await renderView(props)
    const grid = node.firstElementChild

    expect(grid?.className).toContain("gap-y-4")
    expect(grid?.className).toContain("min-[1180px]:gap-x-2")
    expect(grid?.className).not.toContain("gap-4")
  })

  it("does not animate dashboard grid columns or gap", async () => {
    const props = createProps()
    const node = await renderView(props)
    const grid = node.firstElementChild
    const mainSection = node.querySelector("section")

    expect(grid?.className).not.toContain("transition-[grid-template-columns]")
    expect(grid?.className).not.toContain("transition-[gap")
    expect(mainSection?.className).toBe("min-w-0 space-y-4")
  })

  it("keeps rail width animation responsibility out of the dashboard grid", async () => {
    const props = createProps()
    const collapsedNode = await renderView(props)
    const collapsedGrid = collapsedNode.firstElementChild

    await act(async () => {
      root?.unmount()
    })
    root = null
    container?.remove()
    container = null

    props.shell.reserveAssistantColumn = true
    const expandedNode = await renderView(props)
    const expandedGrid = expandedNode.firstElementChild

    expect(collapsedGrid?.className).toContain("min-[1180px]:grid-cols-[86px_minmax(0,1fr)]")
    expect(expandedGrid?.className).toContain("min-[1180px]:grid-cols-[86px_minmax(0,1fr)_auto]")
    expect(collapsedGrid?.className).not.toContain("transition-[grid-template-columns]")
    expect(expandedGrid?.className).not.toContain("transition-[grid-template-columns]")
  })
})
