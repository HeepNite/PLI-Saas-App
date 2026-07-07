import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffTerminalSession = vi.fn()
const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const usersApi = { getUser: vi.fn() }

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

describe("staff-pin-gate: TOTAL gate context resolution (design v5)", () => {
  beforeEach(() => {
    mockAuthorizeStaffTerminalSession.mockReset()
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    usersApi.getUser.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi })
    delete process.env.STAFF_DEVICE_GATE_MODE

    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
    mockAuth.mockResolvedValue({ userId: null })
  })

  it("NO trusted context (monitor mode, default): rejects with 403 — no scan, no mint", async () => {
    const { resolveStaffPinGate } = await import("@/lib/security/staff-pin-gate")

    const result = await resolveStaffPinGate()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
  })

  it("NO trusted context in enforce mode ALSO rejects with 403 (mode-independent invariant)", async () => {
    process.env.STAFF_DEVICE_GATE_MODE = "enforce"
    const { resolveStaffPinGate } = await import("@/lib/security/staff-pin-gate")

    const result = await resolveStaffPinGate()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
  })

  it("TERMINAL context resolves with expectedSchoolId = terminal.schoolId", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: "sess_1",
      terminal: { id: "term_1", slug: "front-desk", schoolId: "school_a", active: true },
    })

    const { resolveStaffPinGate } = await import("@/lib/security/staff-pin-gate")
    const result = await resolveStaffPinGate()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.context.kind).toBe("TERMINAL")
      expect(result.context.expectedSchoolId).toBe("school_a")
      if (result.context.kind === "TERMINAL") {
        expect(result.context.terminalSlug).toBe("front-desk")
      }
    }
  })

  it("TERMINAL with NULL schoolId (backfill pending) rejects with 403 — fail-closed, never unscoped", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: "sess_1",
      terminal: { id: "term_1", slug: "front-desk", schoolId: null, active: true },
    })

    const { resolveStaffPinGate } = await import("@/lib/security/staff-pin-gate")
    const result = await resolveStaffPinGate()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
  })

  it("CLERK_SESSION context resolves ONLY in monitor mode, self-restricted to auth().userId", async () => {
    mockAuth.mockResolvedValue({ userId: "staff_9" })
    usersApi.getUser.mockResolvedValue({
      id: "staff_9",
      publicMetadata: { role: "staff", schoolId: "school_z" },
      privateMetadata: {},
    })

    const { resolveStaffPinGate } = await import("@/lib/security/staff-pin-gate")
    const result = await resolveStaffPinGate()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.context.kind).toBe("CLERK_SESSION")
      if (result.context.kind === "CLERK_SESSION") {
        expect(result.context.ownerUserId).toBe("staff_9")
      }
      expect(result.context.expectedSchoolId).toBe("school_z")
    }
  })

  it("ENFORCE mode: a Clerk-session-only request (no terminal/personal cookie) is rejected by the generic 403 — dead-branch-removal invariant (v5)", async () => {
    process.env.STAFF_DEVICE_GATE_MODE = "enforce"
    mockAuth.mockResolvedValue({ userId: "staff_9" })
    usersApi.getUser.mockResolvedValue({
      id: "staff_9",
      publicMetadata: { role: "staff", schoolId: "school_z" },
      privateMetadata: {},
    })

    const { resolveStaffPinGate } = await import("@/lib/security/staff-pin-gate")
    const result = await resolveStaffPinGate()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
    expect(usersApi.getUser).not.toHaveBeenCalled()
  })

  it("CLERK_SESSION with unresolvable school (no metadata schoolId) rejects with 403", async () => {
    mockAuth.mockResolvedValue({ userId: "staff_10" })
    usersApi.getUser.mockResolvedValue({
      id: "staff_10",
      publicMetadata: { role: "staff" },
      privateMetadata: {},
    })

    const { resolveStaffPinGate } = await import("@/lib/security/staff-pin-gate")
    const result = await resolveStaffPinGate()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
  })

  it("TERMINAL context takes precedence over CLERK_SESSION when both are present", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: "sess_1",
      terminal: { id: "term_1", slug: "front-desk", schoolId: "school_a", active: true },
    })
    mockAuth.mockResolvedValue({ userId: "staff_9" })

    const { resolveStaffPinGate } = await import("@/lib/security/staff-pin-gate")
    const result = await resolveStaffPinGate()

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.context.kind).toBe("TERMINAL")
    // CLERK_SESSION resolution must not even be attempted once TERMINAL resolves.
    expect(usersApi.getUser).not.toHaveBeenCalled()
  })

  it("STAFF_DEVICE_GATE_MODE defaults to monitor when unset", async () => {
    const { getStaffDeviceGateMode } = await import("@/lib/security/staff-pin-gate")
    expect(getStaffDeviceGateMode()).toBe("monitor")
  })

  it("STAFF_DEVICE_GATE_MODE=enforce is read from env", async () => {
    process.env.STAFF_DEVICE_GATE_MODE = "enforce"
    const { getStaffDeviceGateMode } = await import("@/lib/security/staff-pin-gate")
    expect(getStaffDeviceGateMode()).toBe("enforce")
  })
})
