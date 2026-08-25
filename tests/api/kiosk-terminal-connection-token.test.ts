import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffTerminalSession = vi.fn()
const mockCreateConnectionToken = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()

const ENV_KEYS = [
  "NEST_GATEWAY_ENABLED",
  "NEST_GATEWAY_ROUTE_TERMINAL_CONNECTION_TOKEN_ENABLED",
  "NEST_BACKEND_INTERNAL_URL",
  "NEST_GATEWAY_SHARED_SECRET",
  "STRIPE_SECRET_KEY",
] as const

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
)

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("stripe", () => ({
  default: class Stripe {
    terminal = {
      connectionTokens: {
        create: (...args: unknown[]) => mockCreateConnectionToken(...args),
      },
    }
    constructor() {}
  },
}))

describe("kiosk terminal connection-token route", () => {
  beforeEach(() => {
    vi.resetModules()
    restoreEnv()
    mockAuthorizeStaffTerminalSession.mockReset()
    mockCreateConnectionToken.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()

    delete process.env.NEST_GATEWAY_ENABLED
    delete process.env.NEST_GATEWAY_ROUTE_TERMINAL_CONNECTION_TOKEN_ENABLED
    delete process.env.NEST_BACKEND_INTERNAL_URL
    delete process.env.NEST_GATEWAY_SHARED_SECRET
    process.env.STRIPE_SECRET_KEY = "sk_test"

    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
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
    mockCreateConnectionToken.mockResolvedValue({ secret: "pst_connection_secret" })
  })

  afterEach(() => {
    restoreEnv()
    vi.unstubAllGlobals()
  })

  it("keeps the terminal connection-token route disabled by default and preserves the global kill switch", async () => {
    const { getNestGatewayConfig, isNestGatewayRouteEnabled } = await import("@/lib/nest-gateway/config")

    process.env.NEST_GATEWAY_ENABLED = "true"
    expect(isNestGatewayRouteEnabled(getNestGatewayConfig(process.env), "terminal-connection-token")).toBe(false)

    process.env.NEST_GATEWAY_ROUTE_TERMINAL_CONNECTION_TOKEN_ENABLED = "true"
    expect(isNestGatewayRouteEnabled(getNestGatewayConfig(process.env), "terminal-connection-token")).toBe(true)

    process.env.NEST_GATEWAY_ENABLED = "false"
    expect(isNestGatewayRouteEnabled(getNestGatewayConfig(process.env), "terminal-connection-token")).toBe(false)
  })

  it("requires terminal session authorization before creating a connection token", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValueOnce({ ok: false, reason: "missing" })

    const { POST } = await import("@/app/api/kiosk/terminal/connection-token/route")
    const res = await POST(new Request("http://localhost/api/kiosk/terminal/connection-token", { method: "POST" }))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: "Terminal session required for kiosk checkout." })
    expect(mockCreateConnectionToken).not.toHaveBeenCalled()
  })

  it("delegates to Nest when the terminal connection-token route flag is enabled and preserves the public response contract", async () => {
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_TERMINAL_CONNECTION_TOKEN_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ secret: "nest_connection_secret" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { INTERNAL_AUTH_HEADER, REQUEST_ID_HEADER } = await import("@/lib/nest-gateway/auth")
    const { POST } = await import("@/app/api/kiosk/terminal/connection-token/route")
    const res = await POST(
      new Request("http://localhost/api/kiosk/terminal/connection-token", {
        method: "POST",
        headers: { "x-request-id": "req-connection-1" },
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ secret: "nest_connection_secret" })
    expect(fetchMock).toHaveBeenCalledWith(
      "http://nest.internal/internal/terminal/connection-token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
          [REQUEST_ID_HEADER]: "req-connection-1",
        }),
      })
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      sessionId: "terminal_session_1",
      terminalId: "terminal_1",
      terminalLocation: "Lobby",
      terminalName: "Front desk",
      terminalSlug: "front-desk",
    })
    expect(mockCreateConnectionToken).not.toHaveBeenCalled()
  })

  it("falls back to the current Next Stripe token flow when Nest is unavailable", async () => {
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_TERMINAL_CONNECTION_TOKEN_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("nest unavailable")))

    const { POST } = await import("@/app/api/kiosk/terminal/connection-token/route")
    const res = await POST(new Request("http://localhost/api/kiosk/terminal/connection-token", { method: "POST" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ secret: "pst_connection_secret" })
    expect(mockCreateConnectionToken).toHaveBeenCalledTimes(1)
  })
})
