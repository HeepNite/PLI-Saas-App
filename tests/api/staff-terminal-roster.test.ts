import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffTerminalSession = vi.fn()
const mockListStaffRosterForSchool = vi.fn()

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/security/staff-roster", () => ({
  listStaffRosterForSchool: (...args: unknown[]) => mockListStaffRosterForSchool(...args),
}))

const get = () => import("@/app/api/staff/terminal/roster/route").then(({ GET }) => GET())

describe("GET /api/staff/terminal/roster — self-authorizing, school-scoped picker (design v5)", () => {
  beforeEach(() => {
    mockAuthorizeStaffTerminalSession.mockReset()
    mockListStaffRosterForSchool.mockReset()
  })

  it("REJECTS a request with no terminal session — this route is under the PUBLIC middleware whitelist and MUST self-authorize", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })

    const res = await get()

    expect(res.status).toBe(401)
    expect(mockListStaffRosterForSchool).not.toHaveBeenCalled()
  })

  it("returns the school-scoped roster with minimal fields for a valid terminal session", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: "sess_1",
      terminal: { id: "term_1", slug: "front-desk", schoolId: "school_a", active: true },
    })
    mockListStaffRosterForSchool.mockResolvedValue([
      { id: "staff_1", displayName: "Ana Desk", role: "staff" },
      { id: "staff_2", displayName: "Beto Front", role: "admin" },
    ])

    const res = await get()

    expect(res.status).toBe(200)
    expect(mockListStaffRosterForSchool).toHaveBeenCalledWith("school_a")
    const data = await res.json()
    expect(data.staff).toEqual([
      { id: "staff_1", displayName: "Ana Desk", role: "staff" },
      { id: "staff_2", displayName: "Beto Front", role: "admin" },
    ])
  })

  it("a terminal with a NULL schoolId (backfill pending) is REJECTED — never an unscoped roster", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: "sess_1",
      terminal: { id: "term_1", slug: "front-desk", schoolId: null, active: true },
    })

    const res = await get()

    expect(res.status).toBe(403)
    expect(mockListStaffRosterForSchool).not.toHaveBeenCalled()
  })

  it("response never includes phone/email fields", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: "sess_1",
      terminal: { id: "term_1", slug: "front-desk", schoolId: "school_a", active: true },
    })
    mockListStaffRosterForSchool.mockResolvedValue([{ id: "staff_1", displayName: "Ana Desk", role: "staff" }])

    const res = await get()
    const data = await res.json()

    expect(Object.keys(data.staff[0])).toEqual(["id", "displayName", "role"])
  })
})
