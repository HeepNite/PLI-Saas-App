import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffTerminalSession = vi.fn()
const mockConsumeRateLimit = vi.fn()

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: vi.fn(() => "kiosk-grant-rate-limit"),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

describe("kiosk QR cash grant route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockConsumeRateLimit.mockReset()
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockAuthorizeStaffTerminalSession.mockReset()
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: true, terminal: { id: "terminal_1" } })
  })

  it("requires an authorized terminal session", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValueOnce({ ok: false, reason: "missing" })
    const { POST } = await import("@/app/api/checkin/qr/cash-grant/route")
    const response = await POST(new Request("http://localhost/api/checkin/qr/cash-grant", { method: "POST", body: JSON.stringify({ courseSlug: "salsa-timba", date: "2026-10-23", time: "19:00" }) }))
    expect(response.status).toBe(401)
  })

  it("issues a context-bound grant for the authorized tablet", async () => {
    const { POST } = await import("@/app/api/checkin/qr/cash-grant/route")
    const response = await POST(new Request("http://localhost/api/checkin/qr/cash-grant", { method: "POST", body: JSON.stringify({ courseSlug: "salsa-timba", date: "2026-10-23", time: "19:00" }) }))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.grant).toEqual(expect.any(String))
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it.each([{ courseSlug: "", date: "2026-10-23", time: "19:00" }, { courseSlug: "salsa-timba", date: "2026-02-31", time: "19:00" }, { courseSlug: "salsa-timba", date: "2026-10-23", time: "7pm" }])("rejects malformed class context %o", async (body) => {
    const { POST } = await import("@/app/api/checkin/qr/cash-grant/route")
    const response = await POST(new Request("http://localhost/api/checkin/qr/cash-grant", { method: "POST", body: JSON.stringify(body) }))
    expect(response.status).toBe(400)
  })
})
