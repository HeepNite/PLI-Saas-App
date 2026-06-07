// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffApprovalsPanel from "@/components/front/staff/StaffApprovalsPanel"
import type { StaffApprovalFeedItem, StaffRequestSummary } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const summary: StaffRequestSummary = {
  total: 2,
  pending: 1,
  inReview: 0,
  approved: 1,
  rejected: 0,
}

const staffRequestItem: StaffApprovalFeedItem = {
  id: "request-1",
  createdAt: "2026-05-26T12:00:00.000Z",
  kind: "staff_request",
  request: {
    id: "request-1",
    type: "STAFF_DAY_OFF",
    status: "PENDING",
    message: "Need Friday off",
    meta: {},
    createdAt: "2026-05-26T12:00:00.000Z",
    updatedAt: "2026-05-26T12:00:00.000Z",
    resolvedAt: null,
    user: {
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "",
    },
  },
}

const paymentChangeItem: StaffApprovalFeedItem = {
  id: "payment-change-1",
  createdAt: "2026-05-26T13:00:00.000Z",
  kind: "payment_change_request",
  request: {
    id: "payment-change-1",
    staffAccountId: "staff-1",
    requestedMethod: "direct_deposit",
    requestedInfo: { accountNumber: "123456789" },
    reason: "New bank",
    status: "pending",
    createdAt: "2026-05-26T13:00:00.000Z",
    staffAccount: {
      firstName: "John",
      lastName: "Smith",
      email: "john@example.com",
    },
  },
}

type StaffApprovalsPanelProps = React.ComponentProps<typeof StaffApprovalsPanel>

const createProps = (overrides: Partial<StaffApprovalsPanelProps> = {}): StaffApprovalsPanelProps => ({
  showStaffOps: true,
  requestStatusFilter: "all",
  approvalsSummary: summary,
  approvalsLoading: false,
  approvalFeed: [paymentChangeItem, staffRequestItem],
  requestBusyId: null,
  paymentChangeRequestBusyId: null,
  setRequestStatusFilter: vi.fn(),
  updateRequestStatus: vi.fn(),
  updatePaymentChangeRequestStatus: vi.fn(),
  formatIsoDate: (value) => String(value || "—"),
  ...overrides,
})

describe("StaffApprovalsPanel", () => {
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

  async function renderPanel(props: StaffApprovalsPanelProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffApprovalsPanel {...props} />)
    })
    return container
  }

  it("renders nothing when staff ops are hidden", async () => {
    const node = await renderPanel(createProps({ showStaffOps: false }))

    expect(node.textContent).not.toContain("Notifications and approvals")
  })

  it("renders staff and payment-change approvals", async () => {
    const node = await renderPanel(createProps())

    expect(node.textContent).toContain("Notifications and approvals")
    expect(node.textContent).toContain("Payment change request · John Smith")
    expect(node.textContent).toContain("Day off · Jane Doe")
    expect(node.textContent).toContain("•••• 789")
  })
})
