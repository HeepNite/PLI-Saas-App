import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { File as NodeFile } from "node:buffer"

const mockClerkClient = vi.fn()
const mockAuthorizeStaffPortalRequest = vi.fn()
const mockAuthorizeStaffTerminalSession = vi.fn()
const mockExtractStaffRoleFromUserMetadata = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizeStaffPortalRequest(...args),
}))

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/security/staff-role", () => ({
  extractStaffRoleFromUserMetadata: (...args: unknown[]) => mockExtractStaffRoleFromUserMetadata(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: () => "test",
  consumeRateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
}))

describe("staff avatar route terminal authorization", () => {
  const usersApi = {
    getUser: vi.fn(),
    updateUserProfileImage: vi.fn(),
  }

  beforeAll(() => {
    if (!globalThis.File) {
      globalThis.File = NodeFile as typeof globalThis.File
    }
  })

  beforeEach(() => {
    usersApi.getUser.mockReset()
    usersApi.updateUserProfileImage.mockReset()
    mockClerkClient.mockReset()
    mockAuthorizeStaffPortalRequest.mockReset()
    mockAuthorizeStaffTerminalSession.mockReset()
    mockExtractStaffRoleFromUserMetadata.mockReset()

    mockClerkClient.mockResolvedValue({ users: usersApi })
    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })
    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: "terminal_session_1",
      terminal: {
        id: "terminal_1",
        slug: "front-desk",
        name: "Front desk",
        location: "Lobby",
        defaultCourseSlug: null,
        active: true,
      },
    })
    mockExtractStaffRoleFromUserMetadata.mockReturnValue(null)
    usersApi.getUser.mockResolvedValue({ id: "user_customer" })
    usersApi.updateUserProfileImage.mockResolvedValue({ imageUrl: "https://img.test/avatar.png" })
  })

  it("allows kiosk-scoped avatar upload for customer accounts", async () => {
    const formData = new FormData()
    const file = new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" })
    formData.append("file", file)

    const { PATCH } = await import("@/app/api/staff/users/[userId]/avatar/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/users/user_customer/avatar", {
        method: "PATCH",
        body: formData,
      }),
      { params: Promise.resolve({ userId: "user_customer" }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.imageUrl).toBe("https://img.test/avatar.png")
    expect(usersApi.updateUserProfileImage).toHaveBeenCalledWith("user_customer", {
      file: expect.any(File),
    })
  })

  it("rejects staff accounts for terminal-scoped avatar upload", async () => {
    mockExtractStaffRoleFromUserMetadata.mockReturnValue("manager")

    const formData = new FormData()
    const file = new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" })
    formData.append("file", file)

    const { PATCH } = await import("@/app/api/staff/users/[userId]/avatar/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/users/user_staff/avatar", {
        method: "PATCH",
        body: formData,
      }),
      { params: Promise.resolve({ userId: "user_staff" }) }
    )

    expect(res.status).toBe(403)
    expect(usersApi.updateUserProfileImage).not.toHaveBeenCalled()
  })
})
