import { beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.fn()
const kiosk = vi.fn()
const validate = vi.fn()
const state = vi.fn()
vi.mock("@/lib/security/staff-terminal", () => ({ authorizeStaffTerminalSession: (...args: unknown[]) => auth(...args) }))
vi.mock("@/lib/checkin/kiosk-session", () => ({ resolveTerminalKioskSession: (...args: unknown[]) => kiosk(...args) }))
vi.mock("@/lib/checkout/validation", () => ({ validateCheckoutPayload: (...args: unknown[]) => validate(...args) }))
vi.mock("@/lib/checkout/native-attempt-state", () => ({ getNativeAttemptState: (...args: unknown[]) => state(...args) }))

const request = (body: unknown) => new Request("http://localhost/api/checkout/native-attempt-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
const body = { photoContext: "kiosk_terminal", kioskSessionToken: "token", courseSlug: "salsa", amount: 2500 }
const invalidInputs: [unknown, number][] = [
  [{ ...body, photoContext: "qr_phone" }, 400],
  [{ ...body, purchaseId: "forbidden" }, 400],
  ...["readerId", "providerId", "capabilityId", "clientSecret", "unexpected"].map((key): [unknown, number] => [{ ...body, [key]: "forbidden" }, 400]),
  [null, 400],
]

describe("native attempt state route", () => {
  beforeEach(() => {
    vi.resetModules(); auth.mockReset(); kiosk.mockReset(); validate.mockReset(); state.mockReset()
    auth.mockResolvedValue({ ok: true, sessionId: "staff_session", terminal: { id: "terminal_1" } })
    kiosk.mockResolvedValue({ ok: true, session: { id: "old_kiosk_session", user: { id: "resolved_user" } } })
    validate.mockResolvedValue({ courseSlug: "salsa", courseTitle: "Salsa", amountInt: 2500, currency: "usd", packageId: "", serviceId: "dropin", addons: [], safeParticipants: 1, coupon: "", date: "2026-10-06", time: "20:10", kioskCurrentCourseDuration: 60, kioskCurrentCourseDate: null, kioskCurrentCourseTime: null })
    state.mockResolvedValue({ state: "pending_without_payment" })
  })

  it("binds only server-resolved terminal/session user, validates selection, sets no-store, and exposes only state", async () => {
    const { POST } = await import("@/app/api/checkout/native-attempt-state/route")
    const response = await POST(request(body))
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({ state: "pending_without_payment" })
    expect(auth).toHaveBeenCalledWith({ touchLastSeen: false })
    expect(kiosk).toHaveBeenCalledWith("token", { terminalAuth: expect.any(Object), touch: false })
    expect(state).toHaveBeenCalledWith(expect.objectContaining({ userId: "resolved_user", terminalId: "terminal_1", kioskSessionId: "old_kiosk_session", selection: expect.objectContaining({ courseSlug: "salsa" }) }))
  })

  it.each(invalidInputs)("rejects every non-schema field generically without reads or writes", async (input, status) => {
    const { POST } = await import("@/app/api/checkout/native-attempt-state/route")
    const response = await POST(request(input))
    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({ error: "Native attempt state unavailable" })
    expect(validate).not.toHaveBeenCalled(); expect(state).not.toHaveBeenCalled()
  })

  it("returns a no-store unresolved state when reconciliation fails", async () => {
    state.mockRejectedValue(new Error("database read failed"))
    const { POST } = await import("@/app/api/checkout/native-attempt-state/route")
    const response = await POST(request(body))
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({ state: "payment_unresolved" })
  })

  it("rejects unauthenticated requests before reconciliation", async () => {
    auth.mockResolvedValue({ ok: false, reason: "missing" })
    const { POST } = await import("@/app/api/checkout/native-attempt-state/route")
    expect((await POST(request(body))).status).toBe(401)
    expect(kiosk).not.toHaveBeenCalled(); expect(state).not.toHaveBeenCalled()
  })
})
