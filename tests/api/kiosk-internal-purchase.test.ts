import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  construct: vi.fn(),
  token: vi.fn(),
  account: vi.fn(),
  product: vi.fn(),
  price: vi.fn(),
  location: vi.fn(),
  reader: vi.fn(), create: vi.fn(), retrieve: vi.fn(),
  usersQueryRaw: vi.fn(), usersFindUnique: vi.fn(),
  purchaseFindUnique: vi.fn(), purchaseCreate: vi.fn(), purchaseUpdateMany: vi.fn(),
}))
vi.mock("@/lib/security/staff-terminal", () => ({ authorizeStaffTerminalSession: mocks.auth }))
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: mocks.limit,
  buildRateLimitKey: (scope: string, ip: string) => `${scope}:${ip}`,
  getClientIp: () => "127.0.0.1",
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mocks.usersFindUnique(...args),
    },
    $queryRaw: (...args: unknown[]) => mocks.usersQueryRaw(...args),
    purchase: {
      findUnique: (...args: unknown[]) => mocks.purchaseFindUnique(...args),
      create: (...args: unknown[]) => mocks.purchaseCreate(...args),
      updateMany: (...args: unknown[]) => mocks.purchaseUpdateMany(...args),
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      purchase: {
        findUnique: (...args: unknown[]) => mocks.purchaseFindUnique(...args),
        create: (...args: unknown[]) => mocks.purchaseCreate(...args),
        updateMany: (...args: unknown[]) => mocks.purchaseUpdateMany(...args),
      },
    }),
  },
}))
vi.mock("stripe", () => ({
  default: class Stripe {
    constructor(...args: unknown[]) {
      mocks.construct(...args)
    }
    accounts = { retrieve: mocks.account }
    products = { retrieve: mocks.product }
    prices = { retrieve: mocks.price }
    terminal = { locations: { retrieve: mocks.location }, connectionTokens: { create: mocks.token }, readers: { retrieve: mocks.reader } }
    paymentIntents = { create: mocks.create, retrieve: mocks.retrieve }
  },
}))

let boundPurchase: Record<string, unknown> | null = null

const catalog = {
  accountId: "acct_1PWRzcRtYdjwed35", productId: "prod_VJV0rf6b1sjK9x",
  priceId: "price_1UIs02RtYdjwed35ZB3jho1F", locationId: "tml_GqQ6wPY5rSAhAt",
  amount: 100, currency: "usd", livemode: true, paymentCreationEnabled: false,
}
const fixtures = {
  account: { id: catalog.accountId, charges_enabled: true, country: "US" },
  product: { id: catalog.productId, active: true, livemode: true },
  price: {
    id: catalog.priceId, product: catalog.productId, active: true, livemode: true,
    type: "one_time", unit_amount: 100, currency: "usd", lookup_key: "pli_internal_usd1_live",
  },
  location: {
    id: catalog.locationId, livemode: true,
    address: { line1: "54 Coles St", city: "Jersey City", state: "NJ", postal_code: "07302", country: "US" },
  },
}
const request = async (body: unknown = { action: "preflight" }, query = "") => {
  const { POST } = await import("@/app/api/kiosk/terminal/internal-purchase/route")
  return POST(new Request(`http://localhost/api/kiosk/terminal/internal-purchase${query}`, {
    method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }))
}
const expectNoProvider = () => {
  expect(mocks.construct).not.toHaveBeenCalled()
  for (const key of ["account", "product", "price", "location", "token"] as const) {
    expect(mocks[key]).not.toHaveBeenCalled()
  }
}

describe("internal LIVE preflight and connection-token boundary", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("INTERNAL_PURCHASE_LIVE_ENABLED", "true")
    vi.stubEnv("INTERNAL_PURCHASE_LIVE_TERMINAL_ID", "terminal_live")
    vi.stubEnv("STRIPE_INTERNAL_PURCHASE_LIVE_SECRET_KEY", "rk_live_fixture")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unrelated")
    vi.stubEnv("INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED", undefined)
    vi.stubEnv("INTERNAL_PURCHASE_ATTEMPT_SECRET", undefined)
    vi.stubEnv("INTERNAL_PURCHASE_LIVE_READER_ID", undefined)
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network access is forbidden") }))
    mocks.limit.mockReturnValue({ ok: true })
    mocks.auth.mockResolvedValue({
      ok: true, sessionId: "session_live",
      terminal: { id: "terminal_live", slug: "front-desk", name: "Front desk", location: "Lobby", active: true },
    })
    for (const key of ["account", "product", "price", "location"] as const) {
      mocks[key].mockResolvedValue(structuredClone(fixtures[key]))
    }
    mocks.token.mockResolvedValue({ secret: "pst_fixture", location: catalog.locationId })
    mocks.reader.mockResolvedValue({ id: "tmr_fixture", livemode: true, device_type: "stripe_m2", location: catalog.locationId })
    mocks.retrieve.mockReset()
    mocks.usersQueryRaw.mockReset()
    mocks.usersFindUnique.mockReset()
    mocks.purchaseFindUnique.mockReset()
    mocks.purchaseCreate.mockReset()
    mocks.purchaseUpdateMany.mockReset()
    boundPurchase = null
    mocks.usersQueryRaw.mockResolvedValue([{ id: "student_1", name: "Test Student" }])
    mocks.usersFindUnique.mockResolvedValue({ id: "student_1", email: "student@example.test", name: "Test Student", phone: "+15550101" })
    mocks.purchaseFindUnique.mockImplementation(async ({ where }) => {
      if (!boundPurchase) return null
      if (where.id && where.id === boundPurchase.id) return boundPurchase
      if (where.idempotencyKey && where.idempotencyKey === boundPurchase.idempotencyKey) return boundPurchase
      return null
    })
    mocks.purchaseCreate.mockImplementation(async ({ data }) => {
      boundPurchase = { id: "purchase_internal_1", stripePaymentIntentId: null, ...data }
      return boundPurchase
    })
    mocks.purchaseUpdateMany.mockImplementation(async ({ data }) => {
      if (boundPurchase && data.stripePaymentIntentId) boundPurchase = { ...boundPurchase, stripePaymentIntentId: data.stripePaymentIntentId }
      return { count: 1 }
    })
    mocks.create.mockImplementation(async (params) => {
      const intent = { ...params, id: "pi_fixture", object: "payment_intent", livemode: true,
        status: "requires_payment_method", amount_received: 0, customer: null, receipt_email: null, client_secret: "pi_fixture_secret" }
      mocks.retrieve.mockResolvedValue(intent)
      return intent
    })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it.each([undefined, "false", "1", "TRUE"])("fails closed when flag is %s", async (flag) => {
    vi.stubEnv("INTERNAL_PURCHASE_LIVE_ENABLED", flag)
    expect((await request()).status).toBe(503)
    expect(mocks.auth).not.toHaveBeenCalled()
    expectNoProvider()
  })
  it("requires production even with the feature flag set", async () => {
    vi.stubEnv("NODE_ENV", "test")
    expect((await request()).status).toBe(503)
    expectNoProvider()
  })
  it.each(["missing", "expired", "inactive"])("denies %s sessions", async (reason) => {
    mocks.auth.mockResolvedValue({ ok: false, reason })
    expect((await request()).status).toBe(401)
    expect(mocks.auth).toHaveBeenCalledWith({ touchLastSeen: false })
    expectNoProvider()
  })
  it("preserves rate limiting before authentication or provider access", async () => {
    mocks.limit.mockReturnValue({ ok: false, retryAfterSec: 12 })
    const response = await request()
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("12")
    expect(mocks.auth).not.toHaveBeenCalled()
    expectNoProvider()
  })
  it("finds a stored phone format outside the former finite variants through the canonical production query", async () => {
    mocks.usersQueryRaw.mockResolvedValue([{ id: "student_1", name: "Test Student" }])
    const response = await request({ action: "student-lookup", phone: "+1 (555) 0101" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ student: { name: "Test Student" } })
    expect(mocks.usersQueryRaw).toHaveBeenCalledOnce()
    const [sql, canonicalPhone] = mocks.usersQueryRaw.mock.calls[0] as [TemplateStringsArray, string]
    expect(sql.join(" ")).toContain(`regexp_replace("phone", '[^0-9]', '', 'g')`)
    expect(canonicalPhone).toBe("15550101")
  })
  it.each([
    ["missing", [], 404],
    ["ambiguous", [{ id: "student_1", name: "One" }, { id: "student_2", name: "Two" }], 409],
  ])("rejects a %s student lookup without provider access", async (_name, matches, status) => {
    mocks.usersQueryRaw.mockResolvedValue(matches)
    expect((await request({ action: "student-lookup", phone: "+1 (555) 0101" })).status).toBe(status)
    expectNoProvider()
  })
  it("does not accept a student selection after attempt creation begins", async () => {
    expect((await request({ action: "payment-intent", ticket: "ticket", studentId: "student_2" })).status).toBe(400)
    expectNoProvider()
  })
  it.each([undefined, "another_terminal"])("fails closed for terminal assignment %s", async (id) => {
    vi.stubEnv("INTERNAL_PURCHASE_LIVE_TERMINAL_ID", id)
    expect((await request()).status).toBe(id ? 403 : 503)
    expectNoProvider()
  })
  it.each([undefined, "sk_test_fixture", "rk_test_fixture", "invalid"])("rejects runtime key %s without fallback", async (key) => {
    vi.stubEnv("STRIPE_INTERNAL_PURCHASE_LIVE_SECRET_KEY", key)
    expect((await request()).status).toBe(503)
    expectNoProvider()
  })
  it.each(["amount", "currency", "priceId", "productId", "accountId", "locationId", "terminalId", "readerId", "userId", "name", "phone"])(
    "rejects client %s overrides before provider access", async (field) => {
      expect((await request({ action: "connection-token", [field]: "override" })).status).toBe(400)
      expectNoProvider()
    },
  )
  it.each([null, [], {}, "{", { action: "payment-intent" }, { action: ["attempt"] }].map((body) => ({ body })))("rejects invalid payload $body", async ({ body }) => {
    expect((await request(body)).status).toBe(400)
    expectNoProvider()
  })
  it("rejects query-string overrides", async () => {
    expect((await request({ action: "preflight" }, "?amount=1")).status).toBe(400)
    expectNoProvider()
  })
  it("verifies server-selected resources without creating a token or payment", async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(catalog)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(mocks.construct).toHaveBeenCalledExactlyOnceWith("rk_live_fixture", expect.objectContaining({ maxNetworkRetries: 0 }))
    expect(mocks.account).toHaveBeenCalledWith()
    expect(mocks.product).toHaveBeenCalledWith(catalog.productId)
    expect(mocks.price).toHaveBeenCalledWith(catalog.priceId)
    expect(mocks.location).toHaveBeenCalledWith(catalog.locationId)
    expect(mocks.token).not.toHaveBeenCalled()
    expect(mocks.auth).toHaveBeenCalledWith({ touchLastSeen: false })
  })
  it.each([
    ["account", { id: "acct_wrong" }], ["account", { charges_enabled: false }],
    ["product", { id: "prod_wrong" }], ["product", { deleted: true }],
    ["product", { active: false }], ["product", { livemode: false }],
    ["price", { id: "price_wrong" }], ["price", { product: "prod_wrong" }],
    ["price", { active: false }], ["price", { livemode: false }],
    ["price", { type: "recurring" }], ["price", { unit_amount: 101 }],
    ["price", { currency: "eur" }], ["price", { lookup_key: "other" }],
    ["location", { id: "tml_wrong" }], ["location", { livemode: false }],
    ["location", { deleted: true }], ["location", { address: { country: "US", line1: "Other school" } }],
  ] as const)("rejects mismatched %s %j before token creation", async (resource, override) => {
    mocks[resource].mockResolvedValue({ ...fixtures[resource], ...override })
    expect((await request({ action: "connection-token" })).status).toBe(503)
    expect(mocks.token).not.toHaveBeenCalled()
  })
  it("creates a location-scoped token only after fresh preflight on every acquisition", async () => {
    const response = await request({ action: "connection-token" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ...catalog, secret: "pst_fixture" })
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(mocks.token).toHaveBeenCalledExactlyOnceWith({ location: catalog.locationId })
    expect(mocks.token.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.location.mock.invocationCallOrder[0])
    mocks.price.mockResolvedValue({ ...fixtures.price, active: false })
    expect((await request({ action: "connection-token" })).status).toBe(503)
    expect(mocks.token).toHaveBeenCalledTimes(1)
  })
  it.each(["account", "product", "price", "location", "token"] as const)("sanitizes %s failures without logging secrets", async (resource) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      mocks[resource].mockRejectedValue(new Error("rk_live_sensitive pst_sensitive"))
      const response = await request({ action: "connection-token" })
      expect(response.status).toBe(502)
      expect(await response.text()).not.toMatch(/sensitive/)
      expect(log).not.toHaveBeenCalled()
      if (resource !== "token") expect(mocks.token).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })
  it.each(["", "   "])("does not return an empty token secret", async (secret) => {
    mocks.token.mockResolvedValue({ secret, location: catalog.locationId })
    expect((await request({ action: "connection-token" })).status).toBe(502)
  })
  it("rejects a token response for a different location", async () => {
    mocks.token.mockResolvedValue({ secret: "pst_fixture", location: "tml_other" })
    expect((await request({ action: "connection-token" })).status).toBe(502)
  })
  it("preserves the ordinary token adapter and its credential independently", async () => {
    const { ConnectionTokenService } = await import("@/apps/backend/src/terminal/connection-token.service")
    expect(mocks.construct).not.toHaveBeenCalled()
    const result = await new ConnectionTokenService().createConnectionToken({
      sessionId: "ordinary_session", terminalId: "ordinary_terminal", terminalSlug: "ordinary",
      terminalName: "Ordinary", terminalLocation: null,
    })
    expect(result).toEqual({ secret: "pst_fixture" })
    expect(mocks.construct).toHaveBeenCalledExactlyOnceWith("sk_test_unrelated", expect.any(Object))
    expect(mocks.token).toHaveBeenCalledExactlyOnceWith()
  })

  describe("signed internal payment attempts", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(new Date("2026-09-23T12:00:00Z"))
      vi.stubEnv("INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED", "true")
      vi.stubEnv("INTERNAL_PURCHASE_ATTEMPT_SECRET", "fixture-signing-secret-at-least-32-bytes")
      vi.stubEnv("INTERNAL_PURCHASE_LIVE_READER_ID", "tmr_fixture")
    })
    const issue = async () => {
      const response = await request({ action: "attempt", phone: "+1 (555) 0101" })
      expect(response.status).toBe(200)
      return (await response.json()).ticket as string
    }
    it("rejects a client-supplied student ID rather than trusting recipient selection", async () => {
      expect((await request({ action: "attempt", studentId: "student_2" })).status).toBe(400)
      expect(mocks.usersFindUnique).not.toHaveBeenCalled()
    })
    it("fails closed when an attempt phone resolves to format-equivalent students", async () => {
      mocks.usersQueryRaw.mockResolvedValue([
        { id: "student_1", name: "One" },
        { id: "student_2", name: "Two" },
      ])
      expect((await request({ action: "attempt", phone: "+1 (555) 0101" })).status).toBe(409)
      expectNoProvider()
    })
    it("reuses the winning pending purchase after a concurrent idempotency-key create conflict", async () => {
      const { Prisma } = await import("@prisma/client")
      mocks.purchaseCreate.mockImplementationOnce(async ({ data }) => {
        boundPurchase = { id: "purchase_internal_1", stripePaymentIntentId: null, ...data }
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "test" })
      })
      const ticket = await issue()
      expect(ticket).toBeTruthy()
      expect(mocks.purchaseCreate).toHaveBeenCalledOnce()
      expect(mocks.purchaseFindUnique).toHaveBeenCalledTimes(2)
    })
    it.each(["INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED", "INTERNAL_PURCHASE_ATTEMPT_SECRET", "INTERNAL_PURCHASE_LIVE_READER_ID"])(
      "fails before provider calls when %s is unset", async (key) => {
        vi.stubEnv(key, undefined)
        expect((await request({ action: "attempt", phone: "+1 (555) 0101" })).status).toBe(503)
        expectNoProvider()
      },
    )
    it.each([{ livemode: false }, { device_type: "simulated_wisepos_e" }, { location: "tml_other" }, { deleted: true }, { id: "tmr_other" }])(
      "denies mismatched reader %j before creating a payment", async (override) => {
        mocks.reader.mockResolvedValue({ id: "tmr_fixture", livemode: true, device_type: "stripe_m2", location: catalog.locationId, ...override })
        expect((await request({ action: "attempt", phone: "+1 (555) 0101" })).status).toBe(503)
        expect(mocks.create).not.toHaveBeenCalled()
      },
    )
    it.each(["actor", "terminal"])("issues a ticket without a payment and rejects tampering/other %s before provider access", async (owner) => {
      const ticket = await issue()
      expect(mocks.create).not.toHaveBeenCalled()
      expect(ticket.length).toBeLessThanOrEqual(500)
      const claims = JSON.parse(Buffer.from(ticket.split(".")[0], "base64url").toString("utf8"))
      expect(claims.expiresAt).toBe(Date.now() + 3600_000)
      mocks.construct.mockClear()
      expect((await request({ action: "payment-intent", ticket: `${ticket}x` })).status).toBe(400)
      const extendedPayload = Buffer.from(JSON.stringify({ ...claims, expiresAt: claims.expiresAt + 86400_000 })).toString("base64url")
      expect((await request({ action: "payment-intent", ticket: `${extendedPayload}.${ticket.split(".")[1]}` })).status).toBe(400)
      mocks.auth.mockResolvedValue({ ok: true, sessionId: owner === "actor" ? "other_actor" : "session_live",
        terminal: { id: owner === "terminal" ? "other_terminal" : "terminal_live" } })
      expect((await request({ action: "payment-intent", ticket })).status).toBe(403)
      expect(mocks.construct).not.toHaveBeenCalled()
    })
    it("creates card-present only, records honest ownership, retrieves current state and recovers a known ID without creating", async () => {
      const ticket = await issue()
      const response = await request({ action: "payment-intent", ticket })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ id: "pi_fixture", status: "requires_payment_method", paid: false, clientSecret: "pi_fixture_secret" })
      expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 100, currency: "usd", payment_method_types: ["card_present"],
        metadata: expect.objectContaining({ flowContext: "pli_internal_purchase_v1", terminalId: "terminal_live", actorSessionId: "session_live", recipientUserId: "student_1", purchaseId: "purchase_internal_1", priceId: catalog.priceId, pliInternalAttempt: ticket }) }),
      { idempotencyKey: expect.stringMatching(/^internal-purchase:v1:/) })
      expect(mocks.retrieve).toHaveBeenCalledWith("pi_fixture")
      expect((await request({ action: "payment-intent", ticket, paymentIntentId: "pi_fixture" })).status).toBe(200)
      expect(mocks.create).toHaveBeenCalledTimes(1)
    })
    it("replays exactly the same create after timeout across module restart, never silently replacing the attempt", async () => {
      const ticket = await issue()
      mocks.create.mockRejectedValueOnce(new Error("unknown outcome"))
      expect((await request({ action: "payment-intent", ticket })).status).toBe(502)
      vi.resetModules()
      expect((await request({ action: "payment-intent", ticket })).status).toBe(200)
      expect(mocks.create.mock.calls[1]).toEqual(mocks.create.mock.calls[0])
    })
    it("uses one stable idempotency key for concurrent requests", async () => {
      const ticket = await issue()
      const responses = await Promise.all([request({ action: "payment-intent", ticket }), request({ action: "payment-intent", ticket })])
      expect(responses.map((response) => response.status)).toEqual([200, 200])
      expect(mocks.create.mock.calls[1]).toEqual(mocks.create.mock.calls[0])
    })
    it("never recreates an expired unknown attempt or an attempt under a changed reader assignment", async () => {
      const ticket = await issue()
      mocks.create.mockRejectedValueOnce(new Error("unknown outcome"))
      expect((await request({ action: "payment-intent", ticket })).status).toBe(502)
      vi.stubEnv("INTERNAL_PURCHASE_LIVE_READER_ID", "tmr_changed")
      expect((await request({ action: "payment-intent", ticket })).status).toBe(409)
      vi.stubEnv("INTERNAL_PURCHASE_LIVE_READER_ID", "tmr_fixture")
      vi.setSystemTime(new Date("2026-09-24T13:00:00Z"))
      expect((await request({ action: "payment-intent", ticket })).status).toBe(409)
      expect(mocks.create).toHaveBeenCalledTimes(1)
    })
    it.each(["INTERNAL_PURCHASE_LIVE_ENABLED", "INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED"])("blocks collection when %s is turned off", async (flag) => {
      const ticket = await issue()
      vi.stubEnv(flag, "false")
      mocks.construct.mockClear()
      expect((await request({ action: "payment-intent", ticket })).status).toBe(503)
      expect(mocks.construct).not.toHaveBeenCalled()
      expect(mocks.create).not.toHaveBeenCalled()
    })
    it("fails closed after one hour but permits signed read-only known-ID recovery with the payment gate off", async () => {
      const ticket = await issue()
      await request({ action: "payment-intent", ticket })
      vi.setSystemTime(new Date("2026-09-23T13:00:00Z"))
      expect((await request({ action: "payment-intent", ticket })).status).toBe(409)
      vi.stubEnv("INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED", undefined)
      const response = await request({ action: "recover", ticket, paymentIntentId: "pi_fixture" })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ id: "pi_fixture", status: "requires_payment_method", paid: false })
      expect(mocks.create).toHaveBeenCalledTimes(1)
    })
    it("uses retrieved succeeded state, not cached create state or a client completion claim", async () => {
      const ticket = await issue()
      await request({ action: "payment-intent", ticket })
      const intent = await mocks.retrieve("pi_fixture")
      mocks.create.mockResolvedValue(intent) // Stripe can replay the original pre-payment creation response.
      mocks.retrieve.mockResolvedValue({ ...intent, status: "succeeded", amount_received: 100 })
      const response = await request({ action: "payment-intent", ticket })
      expect(await response.json()).toEqual({ id: "pi_fixture", status: "succeeded", paid: true })
      expect((await request({ action: "recover", ticket, paymentIntentId: "pi_fixture", status: "succeeded" })).status).toBe(400)
    })
    it.each([{ livemode: false }, { amount: 101 }, { currency: "eur" }, { customer: "cus_other" }, { metadata: {} }, { id: "pi_other" }])(
      "rejects unrelated/mismatched recovered payment %j", async (override) => {
        const ticket = await issue()
        await request({ action: "payment-intent", ticket })
        const intent = await mocks.retrieve("pi_fixture")
        mocks.retrieve.mockResolvedValue({ ...intent, ...override })
        expect((await request({ action: "recover", ticket, paymentIntentId: "pi_fixture" })).status).toBe(409)
        expect(mocks.create).toHaveBeenCalledTimes(1)
      },
    )
    it.each(["accountId", "productId", "priceId", "locationId", "terminalId", "actorSessionId", "readerId", "recipientUserId", "purchaseId"])("rejects altered %s ownership metadata", async (field) => {
      const ticket = await issue()
      await request({ action: "payment-intent", ticket })
      const intent = await mocks.retrieve("pi_fixture")
      mocks.retrieve.mockResolvedValue({ ...intent, metadata: { ...intent.metadata, [field]: "unrelated" } })
      expect((await request({ action: "recover", ticket, paymentIntentId: "pi_fixture" })).status).toBe(409)
    })
    it("rejects an immutable recipient change before creating a replacement payment", async () => {
      const ticket = await issue()
      boundPurchase = { ...boundPurchase!, userId: "student_2" }
      expect((await request({ action: "payment-intent", ticket })).status).toBe(409)
      expect(mocks.create).not.toHaveBeenCalled()
    })
    it("does not query arbitrary payment IDs without a signed attempt", async () => {
      expect((await request({ action: "recover", ticket: "forged", paymentIntentId: "pi_any" })).status).toBe(400)
      expect(mocks.retrieve).not.toHaveBeenCalled()
    })
  })
})
