// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import CreateStudentModal from "@/components/front/staff/CreateStudentModal"
import { useStaffCreateStudentAdmin } from "@/components/front/staff/useStaffCreateStudentAdmin"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffCreateStudentAdmin>

function Harness({ onState, onSuccess }: { onState: (state: HookState) => void; onSuccess: () => Promise<void> }) {
  onState(useStaffCreateStudentAdmin({ onSuccess, handleStaffAuthFailure: () => false }))
  return null
}

describe("useStaffCreateStudentAdmin", () => {
  let root: Root | null = null
  let state: HookState | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    root = null
    state = null
    vi.restoreAllMocks()
  })

  it("posts the selected historical session and refreshes exactly once after success", async () => {
    const onSuccess = vi.fn(async () => undefined)
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt: "2026-07-15T23:00:00.000Z", durationMinutes: 60, isCurrent: false }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ userId: "user_1", clerkUserId: "clerk_1", isExisting: false, activation: {} }) } as Response)
    const container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(<Harness onState={(next) => { state = next }} onSuccess={onSuccess} />))
    await act(async () => state?.openModal())
    await act(async () => {
      state?.updateField("email", "student@example.com")
      state?.updateField("createAttendance", true)
      state?.updateField("attendanceDate", "2026-07-15")
      state?.updateField("attendanceSessionId", "session_1")
    })
    await act(async () => { await state?.submit() })

    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0][0]).toBe("/api/staff/students/package-plans")
    expect(calls[1][0]).toBe("/api/staff/students/sessions?date=2026-07-15")
    const request = JSON.parse(calls[2][1].body)
    expect(request).toMatchObject({
      checkIn: { enabled: true, date: "2026-07-15", sessionId: "session_1" },
    })
    expect(request.package).toBeUndefined()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it("blocks submission until a session is selected and surfaces session-loading failures", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) } as Response)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Session service unavailable" }) } as Response)
    const container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(<Harness onState={(next) => { state = next }} onSuccess={async () => undefined} />))
    await act(async () => state?.openModal())
    await act(async () => {
      state?.updateField("email", "student@example.com")
      state?.updateField("createAttendance", true)
    })

    expect(state?.canSubmit).toBe(false)
    await act(async () => undefined)
    expect(state?.error).toBe("Session service unavailable")
    expect(state?.attendanceSessions).toEqual([])
  })

  it("sends the selected active package only after staff enters a reason without a second payment", async () => {
    const onSuccess = vi.fn(async () => undefined)
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: "plan_1", label: "Ten classes", priceCents: 12500 }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt: "2026-07-15T23:00:00.000Z", durationMinutes: 60, isCurrent: false }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ userId: "user_1", clerkUserId: "clerk_1", isExisting: false, activation: {} }) } as Response)
    const container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(<Harness onState={(next) => { state = next }} onSuccess={onSuccess} />))
    await act(async () => state?.openModal())
    await act(async () => {
      state?.updateField("email", "student@example.com")
      state?.updateField("amountCents", "25")
      state?.updateField("paymentMode", "cash")
      state?.updateField("packagePlanId", "plan_1")
      state?.updateField("createAttendance", true)
      state?.updateField("attendanceDate", "2026-07-15")
      state?.updateField("attendanceSessionId", "session_1")
    })

    expect(state?.packagePlans).toEqual([{ id: "plan_1", label: "Ten classes", priceCents: 12500 }])
    expect(state?.canSubmit).toBe(false)

    await act(async () => state?.updateField("packageReason", "New student package"))
    expect(state?.canSubmit).toBe(true)
    await act(async () => { await state?.submit() })

    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
    const submitCall = calls.find(([url]) => url === "/api/staff/students")
    expect(submitCall).toBeDefined()
    expect(JSON.parse(submitCall![1].body)).toMatchObject({
      amountCents: 0,
      checkIn: { enabled: true, date: "2026-07-15", sessionId: "session_1" },
      package: { packagePlanId: "plan_1", reason: "New student package" },
    })
    expect(JSON.parse(submitCall![1].body).paymentMode).toBeUndefined()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it("preserves payment controls and payload when no package is selected", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ userId: "user_1", clerkUserId: "clerk_1", isExisting: false, activation: {} }) } as Response)
    const container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(<Harness onState={(next) => { state = next }} onSuccess={async () => undefined} />))
    await act(async () => state?.openModal())
    await act(async () => {
      state?.updateField("email", "student@example.com")
      state?.updateField("amountCents", "25")
      state?.updateField("paymentMode", "cash")
    })
    await act(async () => { await state?.submit() })

    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
    expect(JSON.parse(calls[1][1].body)).toMatchObject({ amountCents: 2500, paymentMode: "cash" })

    await act(async () => root?.render(
      <CreateStudentModal
        isOpen
        form={{ email: "student@example.com", phone: "", name: "", amountCents: "25", paymentMode: "cash", note: "", createAttendance: false, attendanceDate: "2026-07-15", attendanceSessionId: "", recoveryTicket: "", packagePlanId: "", packageReason: "" }}
        submitting={false}
        error={null}
        result={null}
        hasAmount
        canSubmit
        attendanceSessions={[]}
        packagePlans={[]}
        packagePlansLoading={false}
        onClose={() => undefined}
        onUpdateField={() => undefined}
        onSubmit={() => undefined}
      />
    ))

    expect(document.body.textContent).toContain("Amount ($)")
    expect(document.body.textContent).toContain("Payment mode")
  })

  it("hides payment controls but keeps check-in controls usable when a package is selected", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(
      <CreateStudentModal
        isOpen
        form={{ email: "student@example.com", phone: "", name: "", amountCents: "25", paymentMode: "cash", note: "", createAttendance: true, attendanceDate: "2026-07-15", attendanceSessionId: "session_1", recoveryTicket: "", packagePlanId: "plan_1", packageReason: "New student package" }}
        submitting={false}
        error="This user already exists in the system."
        result={null}
        hasAmount={false}
        canSubmit
        attendanceSessions={[{ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt: "2026-07-15T23:00:00.000Z", durationMinutes: 60, isCurrent: false }]}
        packagePlans={[{ id: "plan_1", label: "Ten classes", priceCents: 12500 }]}
        packagePlansLoading={false}
        onClose={() => undefined}
        onUpdateField={() => undefined}
        onSubmit={() => undefined}
      />
    ))

    expect(document.body.textContent).toContain("Selected: Ten classes · $125.00")
    expect(document.body.textContent).toContain("This user already exists in the system.")
    expect(document.body.textContent).not.toContain("Amount ($)")
    expect(document.body.textContent).not.toContain("Payment mode")
    expect(document.querySelector('input[type="date"]')).not.toBeNull()
    expect(document.body.textContent).toContain("Salsa")
  })

  it("renders optional check-in controls with advisory New York date bounds", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    const container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(
      <CreateStudentModal
        isOpen
        form={{ email: "student@example.com", phone: "", name: "", amountCents: "", paymentMode: "", note: "", createAttendance: true, attendanceDate: "2026-07-15", attendanceSessionId: "session_1", recoveryTicket: "", packagePlanId: "", packageReason: "" }}
        submitting={false}
        error={null}
        result={null}
        hasAmount={false}
        canSubmit
        attendanceSessions={[{ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt: "2026-07-15T23:00:00.000Z", durationMinutes: 60, isCurrent: false }]}
        packagePlans={[]}
        packagePlansLoading={false}
        onClose={() => undefined}
        onUpdateField={() => undefined}
        onSubmit={() => undefined}
      />
    ))

    const dateInput = document.querySelector('input[type="date"]')
    const sessionSelect = Array.from(document.querySelectorAll("select")).find((select) => select.textContent?.includes("Salsa"))
    expect(dateInput).not.toBeNull()
    expect(dateInput?.getAttribute("min")).toBe("2026-07-15")
    expect(dateInput?.getAttribute("max")).toBe("2026-07-29")
    expect(sessionSelect?.textContent).toContain("Salsa")
    vi.useRealTimers()
  })

  it("keeps recovery review in a dedicated dialog until staff confirms it", async () => {
    const onUpdateField = vi.fn()
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ draftId: "draft_1", phone: "+15551234567", email: "student@example.com", name: "Student" }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ticket: "ticket_1" }) } as Response)
    const container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(
      <CreateStudentModal
        isOpen
        form={{ email: "", phone: "", name: "", amountCents: "", paymentMode: "", note: "", createAttendance: false, attendanceDate: "2026-07-15", attendanceSessionId: "", recoveryTicket: "", packagePlanId: "", packageReason: "" }}
        submitting={false}
        error={null}
        result={null}
        hasAmount={false}
        canSubmit={false}
        attendanceSessions={[]}
        packagePlans={[]}
        packagePlansLoading={false}
        onClose={() => undefined}
        onUpdateField={onUpdateField}
        onSubmit={() => undefined}
      />
    ))

    const recoveryButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("SMS code did not arrive"))
    expect(recoveryButton).toBeDefined()
    expect(document.querySelector('[role="dialog"][aria-label="SMS recovery"]')).toBeNull()

    await act(async () => recoveryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    const recoveryDialog = document.querySelector('[role="dialog"][aria-label="SMS recovery"]')
    expect(recoveryDialog).not.toBeNull()

    const codeInput = recoveryDialog?.querySelector('input[aria-label="Recovery code"]') as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(codeInput, "PLI-1234")
      codeInput.dispatchEvent(new Event("input", { bubbles: true }))
    })
    const reviewButton = Array.from(recoveryDialog?.querySelectorAll("button") ?? []).find((button) => button.textContent === "Review code")
    await act(async () => reviewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })))

    expect(onUpdateField).not.toHaveBeenCalled()
    expect(recoveryDialog?.textContent).toContain("student@example.com")

    const checkboxes = recoveryDialog?.querySelectorAll('input[type="checkbox"]') ?? []
    await act(async () => checkboxes.forEach((checkbox) => checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }))))
    const confirmButton = Array.from(recoveryDialog?.querySelectorAll("button") ?? []).find((button) => button.textContent === "Confirm recovery")
    await act(async () => confirmButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })))

    expect(onUpdateField).toHaveBeenCalledWith("phone", "+15551234567")
    expect(onUpdateField).toHaveBeenCalledWith("email", "student@example.com")
    expect(onUpdateField).toHaveBeenCalledWith("name", "Student")
    expect(onUpdateField).toHaveBeenCalledWith("recoveryTicket", "ticket_1")
    expect(document.querySelector('[role="dialog"][aria-label="SMS recovery"]')).toBeNull()
  })
})
