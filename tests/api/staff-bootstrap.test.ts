import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeBase = vi.fn()
const mockHasAnyAdmin = vi.fn()
const mockClerkClient = vi.fn()

const usersApi = {
  getUser: vi.fn(),
  updateUserMetadata: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalBaseRequest: (...args: unknown[]) => mockAuthorizeBase(...args),
  hasAnyStaffAdmin: (...args: unknown[]) => mockHasAnyAdmin(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

describe("staff bootstrap route", () => {
  beforeEach(() => {
    mockAuthorizeBase.mockReset()
    mockHasAnyAdmin.mockReset()
    mockClerkClient.mockReset()
    usersApi.getUser.mockReset()
    usersApi.updateUserMetadata.mockReset()

    mockClerkClient.mockResolvedValue({ users: usersApi })
    mockAuthorizeBase.mockResolvedValue({ ok: true, userId: "u_1", role: null })
    mockHasAnyAdmin.mockResolvedValue(false)
  })

  it("returns 401 when auth fails", async () => {
    mockAuthorizeBase.mockResolvedValue({ ok: false, status: 401, error: "Invalid key" })
    const { POST } = await import("@/app/api/staff/bootstrap/route")
    const res = await POST(new Request("http://localhost/api/staff/bootstrap", { method: "POST" }))
    expect(res.status).toBe(401)
  })

  it("returns 403 when an admin already exists", async () => {
    mockHasAnyAdmin.mockResolvedValue(true)
    const { POST } = await import("@/app/api/staff/bootstrap/route")
    const res = await POST(new Request("http://localhost/api/staff/bootstrap", { method: "POST" }))
    expect(res.status).toBe(403)
  })

  it("bootstraps first owner", async () => {
    usersApi.getUser.mockResolvedValue({ id: "u_1", publicMetadata: {} })
    usersApi.updateUserMetadata.mockResolvedValue({ id: "u_1", publicMetadata: { role: "owner" } })

    const { POST } = await import("@/app/api/staff/bootstrap/route")
    const res = await POST(new Request("http://localhost/api/staff/bootstrap", { method: "POST" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.mode).toBe("bootstrapped")
    expect(usersApi.updateUserMetadata).toHaveBeenCalled()
  })

  it("returns already_admin when caller is already admin", async () => {
    mockAuthorizeBase.mockResolvedValue({ ok: true, userId: "u_1", role: "admin" })

    const { POST } = await import("@/app/api/staff/bootstrap/route")
    const res = await POST(new Request("http://localhost/api/staff/bootstrap", { method: "POST" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.mode).toBe("already_admin")
  })
})
