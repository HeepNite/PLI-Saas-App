import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("nest gateway health client", () => {
  const env = {} as NodeJS.ProcessEnv
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    for (const key of Object.keys(env)) delete env[key]
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it("returns a disabled fallback without calling fetch when the gateway flag is off", async () => {
    const fetchMock = vi.fn()
    const { getNestGatewayHealth } = await import("@/lib/nest-gateway/client")

    const result = await getNestGatewayHealth({ env, fetchImpl: fetchMock })

    expect(result).toEqual({ ok: false, reason: "disabled", service: "next", source: "fallback" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("calls the internal health endpoint with the auth and request id headers", async () => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, service: "nest" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const { INTERNAL_AUTH_HEADER, REQUEST_ID_HEADER } = await import("@/lib/nest-gateway/auth")
    const { getNestGatewayHealth } = await import("@/lib/nest-gateway/client")

    const result = await getNestGatewayHealth({ env, fetchImpl: fetchMock, requestId: "req-123" })

    expect(result).toEqual({ ok: true, service: "nest", source: "nest" })
    expect(fetchMock).toHaveBeenCalledWith("http://nest.internal/internal/health", {
      cache: "no-store",
      headers: expect.objectContaining({
        [INTERNAL_AUTH_HEADER]: "shared-secret",
        [REQUEST_ID_HEADER]: "req-123",
      }),
      method: "GET",
      signal: expect.any(AbortSignal),
    })
  })

  it("normalizes a trailing slash in the base url before calling the health endpoint", async () => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal/"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, service: "nest" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const { getNestGatewayHealth } = await import("@/lib/nest-gateway/client")

    await getNestGatewayHealth({ env, fetchImpl: fetchMock })

    expect(fetchMock).toHaveBeenCalledWith("http://nest.internal/internal/health", expect.any(Object))
  })

  it("falls back without calling fetch when auth configuration is incomplete", async () => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"

    const fetchMock = vi.fn()
    const reporter = vi.fn()
    const { getNestGatewayHealth } = await import("@/lib/nest-gateway/client")

    const result = await getNestGatewayHealth({ env, fetchImpl: fetchMock, reporter, requestId: "req-missing" })

    expect(result).toEqual({ ok: false, reason: "missing_config", service: "next", source: "fallback" })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(reporter).toHaveBeenCalledWith({
      expected: true,
      reason: "missing_config",
      requestId: "req-missing",
      route: "internal-health",
      timeoutMs: 1500,
    })
  })

  it("falls back when the internal health route flag is off even if the global gateway flag is on", async () => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"
    env.NEST_GATEWAY_ROUTE_INTERNAL_HEALTH_ENABLED = "false"

    const fetchMock = vi.fn()
    const reporter = vi.fn()
    const { getNestGatewayHealth } = await import("@/lib/nest-gateway/client")

    const result = await getNestGatewayHealth({ env, fetchImpl: fetchMock, reporter, requestId: "req-flag-off" })

    expect(result).toEqual({ ok: false, reason: "disabled", service: "next", source: "fallback" })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(reporter).toHaveBeenCalledWith({
      expected: true,
      reason: "disabled",
      requestId: "req-flag-off",
      route: "internal-health",
      timeoutMs: 1500,
    })
  })

  it("falls back with a timeout reason when the internal service does not respond", async () => {
    vi.useFakeTimers()
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"
    env.NEST_GATEWAY_TIMEOUT_MS = "5"

    const fetchMock: typeof fetch = vi.fn((_: string | URL | Request, init?: RequestInit) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
        })
      })
    ) as typeof fetch

    const reporter = vi.fn()
    const { getNestGatewayHealth } = await import("@/lib/nest-gateway/client")
    const pending = getNestGatewayHealth({ env, fetchImpl: fetchMock, reporter, requestId: "req-timeout" })

    await vi.advanceTimersByTimeAsync(5)

    await expect(pending).resolves.toEqual({ ok: false, reason: "timeout", service: "next", source: "fallback" })
    expect(reporter).toHaveBeenCalledWith({
      expected: false,
      reason: "timeout",
      requestId: "req-timeout",
      route: "internal-health",
      timeoutMs: 5,
    })
  })

  it.each([401, 403])("falls back as unauthorized when the internal service returns %i", async (status) => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }))
    const reporter = vi.fn()
    const { getNestGatewayHealth } = await import("@/lib/nest-gateway/client")

    await expect(getNestGatewayHealth({ env, fetchImpl: fetchMock, reporter, requestId: `req-${status}` })).resolves.toEqual({
      ok: false,
      reason: "unauthorized",
      service: "next",
      source: "fallback",
    })
    expect(reporter).toHaveBeenCalledWith({
      expected: false,
      reason: "unauthorized",
      requestId: `req-${status}`,
      route: "internal-health",
      status,
      statusClass: "4xx",
      timeoutMs: 1500,
    })
  })

  it("falls back as upstream_error when the internal service returns a non-ok status", async () => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "bad gateway" }), { status: 502 }))
    const reporter = vi.fn()
    const { getNestGatewayHealth } = await import("@/lib/nest-gateway/client")

    await expect(getNestGatewayHealth({ env, fetchImpl: fetchMock, reporter, requestId: "req-502" })).resolves.toEqual({
      ok: false,
      reason: "upstream_error",
      service: "next",
      source: "fallback",
    })
    expect(reporter).toHaveBeenCalledWith({
      expected: false,
      reason: "upstream_error",
      requestId: "req-502",
      route: "internal-health",
      status: 502,
      statusClass: "5xx",
      timeoutMs: 1500,
    })
  })

  it("falls back as upstream_error when the internal service returns a malformed success payload", async () => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, service: "next" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    const reporter = vi.fn()
    const { getNestGatewayHealth } = await import("@/lib/nest-gateway/client")

    await expect(getNestGatewayHealth({ env, fetchImpl: fetchMock, reporter, requestId: "req-malformed" })).resolves.toEqual({
      ok: false,
      reason: "upstream_error",
      service: "next",
      source: "fallback",
    })
    expect(reporter).toHaveBeenCalledWith({
      expected: false,
      reason: "upstream_error",
      requestId: "req-malformed",
      route: "internal-health",
      timeoutMs: 1500,
    })
  })

  it("falls back as upstream_error when the fetch call rejects", async () => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const fetchMock = vi.fn().mockRejectedValue(new Error("socket hang up"))
    const reporter = vi.fn()
    const { getNestGatewayHealth } = await import("@/lib/nest-gateway/client")

    await expect(getNestGatewayHealth({ env, fetchImpl: fetchMock, reporter, requestId: "req-network" })).resolves.toEqual({
      ok: false,
      reason: "upstream_error",
      service: "next",
      source: "fallback",
    })
    expect(reporter).toHaveBeenCalledWith({
      expected: false,
      reason: "upstream_error",
      requestId: "req-network",
      route: "internal-health",
      timeoutMs: 1500,
    })
  })

  it("keeps today-classes route disabled by default and preserves the global kill switch", async () => {
    const { getNestGatewayConfig, isNestGatewayRouteEnabled } = await import("@/lib/nest-gateway/config")

    env.NEST_GATEWAY_ENABLED = "true"
    expect(isNestGatewayRouteEnabled(getNestGatewayConfig(env), "today-classes")).toBe(false)

    env.NEST_GATEWAY_ROUTE_TODAY_CLASSES_ENABLED = "true"
    expect(isNestGatewayRouteEnabled(getNestGatewayConfig(env), "today-classes")).toBe(true)

    env.NEST_GATEWAY_ENABLED = "false"
    expect(isNestGatewayRouteEnabled(getNestGatewayConfig(env), "today-classes")).toBe(false)
  })
})
