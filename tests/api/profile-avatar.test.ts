import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

describe("profile avatar route", () => {
  const usersApi = {
    updateUserProfileImage: vi.fn(),
  }

  beforeAll(async () => {
    if (!globalThis.File) {
      const { File } = await import("undici")
      // @ts-expect-error - runtime polyfill for tests
      globalThis.File = File
    }
  })

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    usersApi.updateUserProfileImage.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { POST } = await import("@/app/api/profile/avatar/route")
    const req = new Request("http://localhost/api/profile/avatar", { method: "POST" })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 on missing file", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    const formData = new FormData()
    const { POST } = await import("@/app/api/profile/avatar/route")
    const req = new Request("http://localhost/api/profile/avatar", {
      method: "POST",
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("updates avatar and returns image url", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.updateUserProfileImage.mockResolvedValue({ imageUrl: "https://img.test/avatar.png" })

    const formData = new FormData()
    const file = new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" })
    formData.append("file", file)

    const { POST } = await import("@/app/api/profile/avatar/route")
    const req = new Request("http://localhost/api/profile/avatar", {
      method: "POST",
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.imageUrl).toBe("https://img.test/avatar.png")
  })
})
