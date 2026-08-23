// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffAdminHistoryOverlays from "@/components/front/staff/StaffAdminHistoryOverlays"

const timelineMocks = vi.hoisted(() => ({
  resolvePaymentHistoryRows: vi.fn(),
  resolveAttendanceHistoryRows: vi.fn(),
  transformPaymentRowsToEvents: vi.fn((rows: unknown[]) => rows.map((_, index) => ({ id: `payment-event-${index}` }))),
  transformPaymentRowsToAttendance: vi.fn(() => ({
    events: [{ id: "attendance-event-1" }],
    summary: { totalAttended: 1, noShows: 0, cancelled: 0 },
  })),
}))

vi.mock("@/components/front/staff/paymentTimelineTransforms", () => timelineMocks)

vi.mock("@/components/front/staff/PaymentHistoryTimeline", () => ({
  default: ({ payments, isOpen, onClose }: { payments: unknown[]; isOpen: boolean; onClose: () => void }) => (
    <section data-testid="payment-history">
      Payment history {String(isOpen)} {payments.length}
      <button type="button" onClick={onClose}>Close payment history</button>
    </section>
  ),
}))

vi.mock("@/components/front/staff/AttendanceHistoryTimeline", () => ({
  default: ({ attendance, summary, isOpen, onClose }: { attendance: unknown[]; summary: { totalAttended: number }; isOpen: boolean; onClose: () => void }) => (
    <section data-testid="attendance-history">
      Attendance history {String(isOpen)} {attendance.length} {summary.totalAttended}
      <button type="button" onClick={onClose}>Close attendance history</button>
    </section>
  ),
}))

vi.mock("@/components/front/staff/AuditHistoryPopover", () => ({
  default: ({ studentId, studentName, isOpen, onClose }: { studentId: string; studentName: string; isOpen: boolean; onClose: () => void }) => (
    <section data-testid="audit-history">
      Audit history {String(isOpen)} {studentId} {studentName}
      <button type="button" onClick={onClose}>Close audit history</button>
    </section>
  ),
}))

vi.mock("@/components/front/staff/StudentDataOverrideModal", () => ({
  default: ({ open, studentId, studentName, currentRole, currentCategory, currentSubCategory, onClose, onSuccess }: { open: boolean; studentId: string; studentName: string; currentRole: string; currentCategory: string | null; currentSubCategory: string | null; onClose: () => void; onSuccess: () => void }) => (
    <section data-testid="override-modal">
      Override {String(open)} {studentId} {studentName} {currentRole} {currentCategory} {currentSubCategory}
      <button type="button" onClick={onClose}>Close override</button>
      <button type="button" onClick={onSuccess}>Override success</button>
    </section>
  ),
}))

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffAdminHistoryOverlays>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  payments: [],
  userHistoryPayments: [],
  isHistoryMode: false,
  currentDateNY: "2026-05-29",
  historyFrom: "2026-05-01",
  historyTo: "2026-05-31",
  userHistoryLoading: false,
  paymentHistoryStudentId: null,
  paymentHistoryAnchor: null,
  attendanceHistoryStudentId: null,
  attendanceHistoryAnchor: null,
  auditHistoryStudentId: null,
  auditHistoryStudentName: null,
  auditHistoryAnchor: null,
  overrideModalOpen: false,
  overrideModalStudent: null,
  currentRole: "admin",
  currentCategory: "manager",
  currentSubCategory: null,
  onClosePaymentHistory: vi.fn(),
  onCloseAttendanceHistory: vi.fn(),
  onCloseAuditHistory: vi.fn(),
  onCloseOverrideModal: vi.fn(),
  onOverrideSuccess: vi.fn(),
  resolveHistoryDateIso: vi.fn(() => "2026-05-29"),
  ...overrides,
})

describe("StaffAdminHistoryOverlays", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderOverlays(props: Props) {
    timelineMocks.resolvePaymentHistoryRows.mockReturnValue([
      { id: "payment-1", createdAt: "2026-05-29" },
      { id: "payment-2", createdAt: "2026-05-28T23:30:00.000Z" },
    ])
    timelineMocks.resolveAttendanceHistoryRows.mockReturnValue([{ id: "attendance-payment-1" }])
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffAdminHistoryOverlays {...props} />))
    return container
  }

  it("renders closed timeline popovers without override modal", async () => {
    const node = await renderOverlays(createProps())

    expect(node.textContent).toContain("Payment history false 2")
    expect(node.textContent).toContain("Attendance history false 0 0")
    expect(node.textContent).toContain("Audit history false")
    expect(node.textContent).not.toContain("Override")
  })

  it("wires payment, attendance, and audit close callbacks", async () => {
    const props = createProps({
      paymentHistoryStudentId: "student-1",
      attendanceHistoryStudentId: "student-1",
      auditHistoryStudentId: "student-1",
      auditHistoryStudentName: "Student One",
      auditHistoryAnchor: document.createElement("button"),
    })
    const node = await renderOverlays(props)

    await act(async () => {
      Array.from(node.querySelectorAll("button")).forEach((button) => button.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    })

    expect(node.textContent).toContain("Payment history true 2")
    expect(node.textContent).toContain("Attendance history true 1 1")
    expect(node.textContent).toContain("Audit history true student-1 Student One")
    expect(props.onClosePaymentHistory).toHaveBeenCalledTimes(1)
    expect(props.onCloseAttendanceHistory).toHaveBeenCalledTimes(1)
    expect(props.onCloseAuditHistory).toHaveBeenCalledTimes(1)
  })

  it("renders student override modal and reports successful student id", async () => {
    const props = createProps({
      overrideModalOpen: true,
      overrideModalStudent: { id: "student-1", name: "Student One" },
      currentRole: "owner",
    })
    const node = await renderOverlays(props)

    await act(async () => {
      Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Override success")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Override true student-1 Student One owner manager")
    expect(props.onOverrideSuccess).toHaveBeenCalledWith("student-1")
  })
})
