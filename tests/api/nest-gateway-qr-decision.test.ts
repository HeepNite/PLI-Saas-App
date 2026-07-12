import { beforeEach, describe, expect, it, vi } from "vitest"

const createGatewayRequest = () => ({
  courseSlug: "salsa-femenina-matutina",
  date: "2026-02-24",
  time: "11:00",
  durationMinutes: 60,
  customer: {
    userId: "db_user_1",
    clerkUserId: "clerk_user_1",
    firstName: "Jane",
    lastName: "Student",
    name: "Jane Student",
    email: "student@example.com",
    phone: "15551112222",
    hasAvatar: true,
  },
})

const createGatewayResponse = () => ({
  context: {
    courseSlug: "salsa-femenina-matutina",
    courseTitle: "Salsa Femenina Matutina",
    date: "2026-02-24",
    time: "11:00",
    durationMinutes: 60,
    startsAt: "2026-02-24T16:00:00.000Z",
    endsAt: "2026-02-24T17:00:00.000Z",
    checkInWindow: {
      isOpen: true,
      opensAt: "2026-02-24T14:00:00.000Z",
      closesAt: "2026-02-24T17:15:00.000Z",
    },
  },
  customer: {
    userId: "db_user_1",
    clerkUserId: "clerk_user_1",
    firstName: "Jane",
    lastName: "Student",
    name: "Jane Student",
    email: "student@example.com",
    phone: "15551112222",
    hasAvatar: true,
  },
  package: null,
  packages: [],
  quickCheckout: null,
  purchaseHistory: [],
  hasPreviousPurchase: false,
  hasAnyCompletedPurchase: false,
  hasExistingPurchaseForSession: false,
  hasAnyActivePackage: false,
})

describe("nest gateway qr-decision client", () => {
  const env = {} as NodeJS.ProcessEnv

  beforeEach(() => {
    vi.resetModules()
    for (const key of Object.keys(env)) delete env[key]
  })

  it("keeps the qr-decision route disabled by default and preserves the global kill switch", async () => {
    const { getNestGatewayConfig, isNestGatewayRouteEnabled } = await import("@/lib/nest-gateway/config")

    env.NEST_GATEWAY_ENABLED = "true"
    expect(isNestGatewayRouteEnabled(getNestGatewayConfig(env), "qr-decision")).toBe(false)

    env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    expect(isNestGatewayRouteEnabled(getNestGatewayConfig(env), "qr-decision")).toBe(true)

    env.NEST_GATEWAY_ENABLED = "false"
    expect(isNestGatewayRouteEnabled(getNestGatewayConfig(env), "qr-decision")).toBe(false)
  })

  it("posts qr-decision payloads to the internal backend with auth headers and parses the response", async () => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createGatewayResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const { INTERNAL_AUTH_HEADER, REQUEST_ID_HEADER } = await import("@/lib/nest-gateway/auth")
    const { getNestGatewayQrDecision } = await import("@/lib/nest-gateway/client")

    await expect(
      getNestGatewayQrDecision({
        env,
        fetchImpl: fetchMock,
        payload: createGatewayRequest(),
        requestId: "req-qr-1",
      })
    ).resolves.toEqual(createGatewayResponse())

    expect(fetchMock).toHaveBeenCalledWith(
      "http://nest.internal/internal/checkin/qr/decision",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
          [REQUEST_ID_HEADER]: "req-qr-1",
        }),
        body: expect.any(String),
      })
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual(createGatewayRequest())
  })

  it("falls back when the Nest success payload does not correlate to the original request", async () => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const reporter = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...createGatewayResponse(),
          context: {
            ...createGatewayResponse().context,
            courseSlug: "mismatched-course",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    )

    const { getNestGatewayQrDecision } = await import("@/lib/nest-gateway/client")

    await expect(
      getNestGatewayQrDecision({
        env,
        fetchImpl: fetchMock,
        payload: createGatewayRequest(),
        reporter,
        requestId: "req-qr-mismatch",
      })
    ).resolves.toMatchObject({
      ok: false,
      reason: "upstream_error",
      source: "fallback",
    })

    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "upstream_error",
        requestId: "req-qr-mismatch",
        route: "qr-decision",
        status: 200,
        statusClass: "2xx",
      })
    )
  })

  it("falls back when the Nest success payload duration does not correlate to the original request", async () => {
    env.NEST_GATEWAY_ENABLED = "true"
    env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const reporter = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...createGatewayResponse(),
          context: {
            ...createGatewayResponse().context,
            durationMinutes: 45,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    )

    const { getNestGatewayQrDecision } = await import("@/lib/nest-gateway/client")

    await expect(
      getNestGatewayQrDecision({
        env,
        fetchImpl: fetchMock,
        payload: createGatewayRequest(),
        reporter,
        requestId: "req-qr-duration-mismatch",
      })
    ).resolves.toMatchObject({
      ok: false,
      reason: "upstream_error",
      source: "fallback",
    })

    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "upstream_error",
        requestId: "req-qr-duration-mismatch",
        route: "qr-decision",
        status: 200,
        statusClass: "2xx",
      })
    )
  })
})
