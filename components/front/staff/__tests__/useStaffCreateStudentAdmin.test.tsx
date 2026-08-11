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
    expect(calls[0][0]).toBe("/api/staff/students/sessions?date=2026-07-15")
    expect(JSON.parse(calls[1][1].body)).toMatchObject({
      checkIn: { enabled: true, date: "2026-07-15", sessionId: "session_1" },
    })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it("blocks submission until a session is selected and surfaces session-loading failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, json: async () => ({ error: "Session service unavailable" }) } as Response)
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

  it("renders optional check-in controls with advisory New York date bounds", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    const container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(
      <CreateStudentModal
        isOpen
        form={{ email: "student@example.com", phone: "", name: "", amountCents: "", paymentMode: "", note: "", createAttendance: true, attendanceDate: "2026-07-15", attendanceSessionId: "session_1", recoveryTicket: "" }}
        submitting={false}
        error={null}
        result={null}
        hasAmount={false}
        canSubmit
        attendanceSessions={[{ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt: "2026-07-15T23:00:00.000Z", durationMinutes: 60, isCurrent: false }]}
        onClose={() => undefined}
        onUpdateField={() => undefined}
        onSubmit={() => undefined}
      />
    ))

    const dateInput = document.querySelector('input[type="date"]')
    const sessionSelect = document.querySelector("select")
    expect(dateInput).not.toBeNull()
    expect(dateInput?.getAttribute("min")).toBe("2026-07-15")
    expect(dateInput?.getAttribute("max")).toBe("2026-07-29")
    expect(sessionSelect?.textContent).toContain("Salsa")
    vi.useRealTimers()
  })
})
