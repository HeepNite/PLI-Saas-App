import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const authMock = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: (auth: typeof authMock, req: Request) => Promise<Response>) => {
    return (req: Request) => handler(authMock, req)
  },
}))

describe("middleware staff API auth guard", () => {
  beforeEach(() => {
    authMock.mockReset()
    authMock.mockResolvedValue({ userId: null })
  })

  it("allows unauthenticated staff PIN login requests to reach the route", async () => {
    const { default: middleware } = await import("../middleware")

    const response = await middleware(
      new NextRequest("http://localhost/api/staff/login/pin", { method: "POST" }),
      {} as never,
    )

    expect(response).toBeDefined()
    expect(response!.status).not.toBe(401)
    expect(authMock).not.toHaveBeenCalled()
  })

  it("lets root OPTIONS preflight requests through before auth processing", async () => {
    const { default: middleware } = await import("../middleware")

    const response = await middleware(
      new NextRequest("http://localhost/", { method: "OPTIONS" }),
      {} as never,
    )

    expect(response).toBeDefined()
    expect(response!.status).not.toBe(400)
    expect(response!.status).not.toBe(401)
    expect(authMock).not.toHaveBeenCalled()
  })

  it("lets API OPTIONS preflight requests through before auth processing", async () => {
    const { default: middleware } = await import("../middleware")

    const response = await middleware(
      new NextRequest("http://localhost/api/staff/users", { method: "OPTIONS" }),
      {} as never,
    )

    expect(response).toBeDefined()
    expect(response!.status).not.toBe(400)
    expect(response!.status).not.toBe(401)
    expect(authMock).not.toHaveBeenCalled()
  })

  it("allows unauthenticated staff check-in PIN requests to reach the route", async () => {
    const { default: middleware } = await import("../middleware")

    const response = await middleware(
      new NextRequest("http://localhost/api/staff/checkin/pin", { method: "POST" }),
      {} as never,
    )

    expect(response).toBeDefined()
    expect(response!.status).not.toBe(401)
    expect(authMock).not.toHaveBeenCalled()
  })

  it("still blocks other unauthenticated staff API requests", async () => {
    const { default: middleware } = await import("../middleware")

    const response = await middleware(
      new NextRequest("http://localhost/api/staff/users", { method: "GET" }),
      {} as never,
    )

    expect(response).toBeDefined()
    expect(response!.status).toBe(401)
    expect(authMock).toHaveBeenCalledTimes(1)
  })
})
