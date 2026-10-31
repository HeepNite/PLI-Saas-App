import { createHash } from "node:crypto"
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
  reader: vi.fn(), create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn(),
  purchaseFindUnique: vi.fn(), purchaseCreate: vi.fn(), purchaseUpdateMany: vi.fn(),
  preparedFindUnique: vi.fn(), preparedUpdateMany: vi.fn(),
}))
vi.mock("@/lib/security/staff-terminal", () => ({ authorizeStaffTerminalSession: mocks.auth }))
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: mocks.limit,
  buildRateLimitKey: (scope: string, ip: string) => `${scope}:${ip}`,
  getClientIp: () => "127.0.0.1",
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchase: {
      findUnique: (...args: unknown[]) => mocks.purchaseFindUnique(...args),
      create: (...args: unknown[]) => mocks.purchaseCreate(...args),
      updateMany: (...args: unknown[]) => mocks.purchaseUpdateMany(...args),
    },
    preparedNativePurchase: {
      findUnique: (...args: unknown[]) => mocks.preparedFindUnique(...args),
      updateMany: (...args: unknown[]) => mocks.preparedUpdateMany(...args),
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      purchase: {
        findUnique: (...args: unknown[]) => mocks.purchaseFindUnique(...args),
        create: (...args: unknown[]) => mocks.purchaseCreate(...args),
        updateMany: (...args: unknown[]) => mocks.purchaseUpdateMany(...args),
      },
      preparedNativePurchase: {
        findUnique: (...args: unknown[]) => mocks.preparedFindUnique(...args),
        updateMany: (...args: unknown[]) => mocks.preparedUpdateMany(...args),
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
    paymentIntents = { create: mocks.create, retrieve: mocks.retrieve, cancel: mocks.cancel }
  },
}))

let boundPurchase: Record<string, unknown> | null = null
let preparedCapability: {
  purchaseId: string; consumed: boolean; referenceHash: string; terminalId: string; sessionId: string; expiresAt: Date
} | null = null

const catalog = {
  accountId: "acct_1PWRzcRtYdjwed35", productId: "prod_VJV0rf6b1sjK9x",
  priceId: "price_1UIs02RtYdjwed35ZB3jho1F", locationId: "tml_GqQ6wPY5rSAhAt",
  amount: 100, currency: "usd", livemode: true, paymentCreationEnabled: false,
}
const fixtures = {
  account: { id: catalog.accountId, charges_enabled: true, country: "US" },
  location: {
    id: catalog.locationId, livemode: true,
    address: { line1: "54 Coles St", city: "Jersey City", state: "NJ", postal_code: "07302", country: "US" },
  },
}
const request = async (body: unknown = { action: "connection-token" }, query = "") => {
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

describe("internal LIVE connection-token and prepared purchase boundary", () => {
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
    for (const key of ["account", "location"] as const) {
      mocks[key].mockResolvedValue(structuredClone(fixtures[key]))
    }
    // The connection must never depend on the retired USD 1 product/price catalog.
    mocks.product.mockRejectedValue(new Error("catalog must not be read"))
    mocks.price.mockRejectedValue(new Error("catalog must not be read"))
    mocks.token.mockResolvedValue({ secret: "pst_fixture", location: catalog.locationId })
    mocks.reader.mockResolvedValue({ id: "tmr_fixture", livemode: true, device_type: "stripe_m2", location: catalog.locationId })
    mocks.retrieve.mockReset()
    mocks.cancel.mockReset()
    mocks.purchaseFindUnique.mockReset()
    mocks.purchaseCreate.mockReset()
    mocks.purchaseUpdateMany.mockReset()
    mocks.preparedFindUnique.mockReset()
    mocks.preparedUpdateMany.mockReset()
    boundPurchase = null
    preparedCapability = null
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
    mocks.preparedUpdateMany.mockImplementation(async ({ where }) => {
      const expiry = where.expiresAt as { gt: Date }
      if (preparedCapability && !preparedCapability.consumed && where.referenceHash === preparedCapability.referenceHash &&
          where.terminalId === preparedCapability.terminalId && where.sessionId === preparedCapability.sessionId &&
          preparedCapability.expiresAt > expiry.gt) {
        preparedCapability.consumed = true
        return { count: 1 }
      }
      return { count: 0 }
    })
    mocks.preparedFindUnique.mockImplementation(async () => preparedCapability && { purchaseId: preparedCapability.purchaseId })
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
  it.each([
    null, [], {}, "{", { action: ["connection-token"] }, { action: "prepared-payment-intent" },
    // Legacy USD 1 actions are no longer part of the closed protocol.
    { action: "preflight" }, { action: "student-lookup", phone: "+15550101" }, { action: "attempt", phone: "+15550101" },
    { action: "payment-intent", ticket: "ticket" }, { action: "recover", ticket: "ticket", paymentIntentId: "pi_known" },
  ].map((body) => ({ body })))("rejects invalid payload $body", async ({ body }) => {
    expect((await request(body)).status).toBe(400)
    expectNoProvider()
  })
  it("rejects query-string overrides", async () => {
    expect((await request({ action: "connection-token" }, "?amount=1")).status).toBe(400)
    expectNoProvider()
  })
  it.each([
    ["account", { id: "acct_wrong" }], ["account", { charges_enabled: false }],
    ["location", { id: "tml_wrong" }], ["location", { livemode: false }],
    ["location", { deleted: true }], ["location", { address: { country: "US", line1: "Other school" } }],
  ] as const)("rejects mismatched %s %j before token creation", async (resource, override) => {
    mocks[resource].mockResolvedValue({ ...fixtures[resource], ...override })
    expect((await request({ action: "connection-token" })).status).toBe(503)
    expect(mocks.token).not.toHaveBeenCalled()
  })
  it("creates a location-scoped token after merchant and location checks without reading the product or price", async () => {
    const response = await request({ action: "connection-token" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ...catalog, secret: "pst_fixture" })
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(mocks.construct).toHaveBeenCalledExactlyOnceWith("rk_live_fixture", expect.objectContaining({ maxNetworkRetries: 0 }))
    expect(mocks.auth).toHaveBeenCalledWith({ touchLastSeen: false })
    expect(mocks.account).toHaveBeenCalledWith()
    expect(mocks.location).toHaveBeenCalledWith(catalog.locationId)
    expect(mocks.product).not.toHaveBeenCalled()
    expect(mocks.price).not.toHaveBeenCalled()
    expect(mocks.token).toHaveBeenCalledExactlyOnceWith({ location: catalog.locationId })
    expect(mocks.token.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.location.mock.invocationCallOrder[0])
    expect(mocks.token.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.account.mock.invocationCallOrder[0])
  })
  it.each(["account", "location"] as const)("still fails closed when the %s check fails, on every acquisition", async (resource) => {
    expect((await request({ action: "connection-token" })).status).toBe(200)
    mocks[resource].mockResolvedValue({ ...fixtures[resource], livemode: false, charges_enabled: false })
    expect((await request({ action: "connection-token" })).status).toBe(503)
    expect(mocks.token).toHaveBeenCalledTimes(1)
    expect(mocks.product).not.toHaveBeenCalled()
    expect(mocks.price).not.toHaveBeenCalled()
  })
  it.each(["account", "location", "token"] as const)("sanitizes %s failures without logging secrets", async (resource) => {
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

  describe("LIVE payment collection", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(new Date("2026-09-23T12:00:00Z"))
      vi.stubEnv("INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED", "true")
      vi.stubEnv("INTERNAL_PURCHASE_ATTEMPT_SECRET", "fixture-signing-secret-at-least-32-bytes")
      vi.stubEnv("INTERNAL_PURCHASE_LIVE_READER_ID", "tmr_fixture")
    })

    describe("prepared native dynamic Purchase flow", () => {
      const reference = "a".repeat(43)
      const expectNoPreparedProviderReads = () => {
        expect(mocks.construct).not.toHaveBeenCalled()
        for (const key of ["account", "product", "price", "location", "reader", "create", "retrieve"] as const) {
          expect(mocks[key]).not.toHaveBeenCalled()
        }
      }
      const preparePurchase = () => {
        boundPurchase = {
          id: "purchase_dynamic_1", userId: "user_1", amount: 2599, currency: "usd", status: "pending",
          idempotencyKey: "native-m2-prepared:purchase_dynamic_1", stripePaymentIntentId: null,
          metadata: { courseSlug: "salsa", serviceId: "dropin", startsAt: "2026-10-04T17:00:00Z", paymentSurface: "native_m2_prepare" },
        }
        preparedCapability = {
          purchaseId: "purchase_dynamic_1", consumed: false,
          referenceHash: createHash("sha256").update(reference).digest("hex"), terminalId: "terminal_live", sessionId: "session_live",
          expiresAt: new Date(Date.now() + 5 * 60_000),
        }
      }
      const admit = async () => {
        const response = await request({ action: "prepared-attempt", preparedPurchaseReference: reference })
        expect(response.status).toBe(200)
        const body = await response.json() as { ticket: string; readerId: string }
        expect(Object.keys(body).sort()).toEqual(["expiresAt", "locationId", "readerId", "ticket"])
        return body
      }

      it("strictly parses the new closed actions", async () => {
        const { parseInternalPurchaseRequest } = await import("@/lib/stripe/internal-purchase")
        expect(parseInternalPurchaseRequest({ action: "prepared-attempt", preparedPurchaseReference: reference })).toEqual({ action: "prepared-attempt", preparedPurchaseReference: reference })
        expect(parseInternalPurchaseRequest({ action: "prepared-creation-status", ticket: "ticket" })).toEqual({ action: "prepared-creation-status", ticket: "ticket" })
        expect(parseInternalPurchaseRequest({ action: "prepared-payment-intent", ticket: "ticket" })).toEqual({ action: "prepared-payment-intent", ticket: "ticket" })
        expect(parseInternalPurchaseRequest({ action: "prepared-recover", ticket: "ticket", paymentIntentId: "pi_known" })).toEqual({ action: "prepared-recover", ticket: "ticket", paymentIntentId: "pi_known" })
        for (const body of [
          { action: "prepared-attempt" }, { action: "prepared-attempt", preparedPurchaseReference: reference, extra: true },
          { action: "prepared-creation-status" }, { action: "prepared-creation-status", ticket: "ticket", extra: true },
          { action: "prepared-creation-status", ticket: "ticket", paymentIntentId: "pi_known" },
          { action: "prepared-payment-intent", ticket: "ticket", paymentIntentId: 1 },
          { action: "prepared-recover", ticket: "ticket" }, { action: "prepared-recover", ticket: "ticket", paymentIntentId: "pi_known", extra: true },
        ]) expect(parseInternalPurchaseRequest(body)).toBeNull()
      })

      it("consumes the caller-bound reference once, issues no web capability, and creates from exact Purchase facts without catalog reads", async () => {
        preparePurchase()
        const { ticket } = await admit()
        expect((await request({ action: "prepared-attempt", preparedPurchaseReference: reference })).status).toBe(409)
        expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(200)
        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 2599, currency: "usd", payment_method_types: ["card_present"],
          metadata: expect.objectContaining({ purchaseId: "purchase_dynamic_1", recipientUserId: "user_1" }) }),
        { idempotencyKey: "prepared-native-m2:v1:native-m2-prepared:purchase_dynamic_1" })
        expect(mocks.product).not.toHaveBeenCalled()
        expect(mocks.price).not.toHaveBeenCalled()
        expect((await request({ action: "prepared-payment-intent", ticket, paymentIntentId: "pi_other" })).status).toBe(409)
      })

      it("rejects invalid, stale, foreign, and duplicate references before provider reads", async () => {
        preparePurchase()
        vi.clearAllMocks()
        expect((await request({ action: "prepared-attempt", preparedPurchaseReference: "b".repeat(43) })).status).toBe(409)
        expectNoPreparedProviderReads()

        preparePurchase()
        preparedCapability!.expiresAt = new Date(Date.now())
        vi.clearAllMocks()
        expect((await request({ action: "prepared-attempt", preparedPurchaseReference: reference })).status).toBe(409)
        expectNoPreparedProviderReads()

        preparePurchase()
        mocks.auth.mockResolvedValueOnce({ ok: true, sessionId: "foreign", terminal: { id: "terminal_live" } })
        vi.clearAllMocks()
        expect((await request({ action: "prepared-attempt", preparedPurchaseReference: reference })).status).toBe(409)
        expectNoPreparedProviderReads()

        preparePurchase()
        await admit()
        vi.clearAllMocks()
        expect((await request({ action: "prepared-attempt", preparedPurchaseReference: reference })).status).toBe(409)
        expectNoPreparedProviderReads()
      })

      it("reports only exact provider-free prepared creation state without mutating local records", async () => {
        preparePurchase()
        const { ticket } = await admit()
        vi.clearAllMocks()

        const uncreated = await request({ action: "prepared-creation-status", ticket })
        expect(uncreated.status).toBe(200)
        expect(uncreated.headers.get("Cache-Control")).toBe("no-store")
        expect(await uncreated.json()).toEqual({ creation: "UNCREATED" })
        expectNoPreparedProviderReads()
        expect(mocks.purchaseCreate).not.toHaveBeenCalled()
        expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
        expect(mocks.preparedUpdateMany).not.toHaveBeenCalled()

        boundPurchase = { ...boundPurchase!, stripePaymentIntentId: "pi_existing" }
        vi.clearAllMocks()
        const created = await request({ action: "prepared-creation-status", ticket })
        expect(created.status).toBe(200)
        expect(await created.json()).toEqual({ creation: "CREATED" })
        expectNoPreparedProviderReads()
        expect(mocks.purchaseCreate).not.toHaveBeenCalled()
        expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
        expect(mocks.preparedUpdateMany).not.toHaveBeenCalled()
      })

      it("accepts expiry only for coarse creation-status while foreign and mismatched tickets fail closed", async () => {
        preparePurchase()
        const { ticket } = await admit()
        vi.clearAllMocks()
        mocks.auth.mockResolvedValueOnce({ ok: true, sessionId: "foreign", terminal: { id: "terminal_live" } })
        expect((await request({ action: "prepared-creation-status", ticket })).status).toBe(403)
        expectNoPreparedProviderReads()
        expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
        expect(mocks.preparedUpdateMany).not.toHaveBeenCalled()

        preparePurchase()
        const expired = await admit()
        vi.setSystemTime(new Date("2026-09-23T12:06:00Z"))
        vi.clearAllMocks()
        const expiredStatus = await request({ action: "prepared-creation-status", ticket: expired.ticket })
        expect(expiredStatus.status).toBe(200)
        expect(await expiredStatus.json()).toEqual({ creation: "UNCREATED" })
        expectNoPreparedProviderReads()
        expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
        expect(mocks.preparedUpdateMany).not.toHaveBeenCalled()
        expect((await request({ action: "prepared-payment-intent", ticket: expired.ticket })).status).toBe(409)
        expectNoPreparedProviderReads()

        preparePurchase()
        const mismatched = await admit()
        boundPurchase = { ...boundPurchase!, idempotencyKey: "native-m2-prepared:mutated" }
        vi.clearAllMocks()
        expect((await request({ action: "prepared-creation-status", ticket: mismatched.ticket })).status).toBe(409)
        expectNoPreparedProviderReads()
        expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
        expect(mocks.preparedUpdateMany).not.toHaveBeenCalled()

        preparePurchase()
        const metadataMismatch = await admit()
        boundPurchase = { ...boundPurchase!, metadata: { ...(boundPurchase!.metadata as Record<string, unknown>), serviceId: "mutated" } }
        vi.clearAllMocks()
        expect((await request({ action: "prepared-creation-status", ticket: metadataMismatch.ticket })).status).toBe(409)
        expectNoPreparedProviderReads()
        expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
        expect(mocks.preparedUpdateMany).not.toHaveBeenCalled()
      })

      it("retries collection on the bound PaymentIntent after the webhook recorded a decline on the Purchase", async () => {
        preparePurchase()
        const { ticket } = await admit()
        expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(200)
        boundPurchase = {
          ...boundPurchase!, status: "failed",
          metadata: { ...(boundPurchase!.metadata as Record<string, unknown>), stripeFailure: { eventType: "payment_intent.payment_failed", occurredAt: "2026-09-23T12:01:00.000Z", error: { code: "card_declined" } } },
        }
        expect((await request({ action: "prepared-creation-status", ticket })).status).toBe(200)
        const retry = await request({ action: "prepared-payment-intent", ticket })
        expect(retry.status).toBe(200)
        expect(mocks.create).toHaveBeenCalledTimes(1)
      })

      it("creates a fresh PaymentIntent for a canceled attempt reopened on re-prepare", async () => {
        preparePurchase()
        boundPurchase = { ...boundPurchase!, metadata: { ...(boundPurchase!.metadata as Record<string, unknown>), paymentAttemptGeneration: "1" } }
        const { ticket } = await admit()
        expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(200)
        expect(mocks.create).toHaveBeenCalledWith(expect.anything(), { idempotencyKey: "prepared-native-m2:v1:native-m2-prepared:purchase_dynamic_1:r1" })
      })

      it("rejects Purchase mutations before payment creation or retrieval and requires pending for a fresh intent", async () => {
        preparePurchase()
        const { ticket } = await admit()
        boundPurchase = { ...boundPurchase!, idempotencyKey: "native-m2-prepared:mutated" }
        vi.clearAllMocks()
        expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(409)
        expectNoPreparedProviderReads()

        preparePurchase()
        const pending = await admit()
        boundPurchase = { ...boundPurchase!, status: "succeeded" }
        vi.clearAllMocks()
        expect((await request({ action: "prepared-payment-intent", ticket: pending.ticket })).status).toBe(409)
        expectNoPreparedProviderReads()

        preparePurchase()
        const recoverable = await admit()
        expect((await request({ action: "prepared-payment-intent", ticket: recoverable.ticket })).status).toBe(200)
        boundPurchase = { ...boundPurchase!, idempotencyKey: "native-m2-prepared:mutated-recovery" }
        vi.clearAllMocks()
        expect((await request({ action: "prepared-recover", ticket: recoverable.ticket, paymentIntentId: "pi_fixture" })).status).toBe(409)
        expectNoPreparedProviderReads()
      })

      it("allows exact read-only recovery of a non-pending Purchase with a known payment ID", async () => {
        preparePurchase()
        const { ticket } = await admit()
        expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(200)
        boundPurchase = { ...boundPurchase!, status: "succeeded" }
        mocks.create.mockClear()
        mocks.retrieve.mockClear()
        expect((await request({ action: "prepared-recover", ticket, paymentIntentId: "pi_fixture" })).status).toBe(200)
        expect(mocks.create).not.toHaveBeenCalled()
        expect(mocks.retrieve).toHaveBeenCalledExactlyOnceWith("pi_fixture")
      })

      it("limits expired provider recovery to the exact already-bound recover action", async () => {
        preparePurchase()
        const { ticket } = await admit()
        expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(200)
        vi.setSystemTime(new Date("2026-09-23T12:06:00Z"))

        vi.clearAllMocks()
        expect((await request({ action: "prepared-payment-intent", ticket, paymentIntentId: "pi_fixture" })).status).toBe(409)
        expectNoPreparedProviderReads()
        expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()

        boundPurchase = { ...boundPurchase!, stripePaymentIntentId: null }
        vi.clearAllMocks()
        expect((await request({ action: "prepared-recover", ticket, paymentIntentId: "pi_fixture" })).status).toBe(409)
        expectNoPreparedProviderReads()
        expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
      })

      it("expired recovery refuses a binding lost before provider result", async () => {
        preparePurchase()
        const { ticket } = await admit()
        expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(200)
        const intent = await mocks.retrieve("pi_fixture")
        vi.setSystemTime(new Date("2026-09-23T12:06:00Z"))
        mocks.purchaseUpdateMany.mockClear()
        mocks.retrieve.mockImplementationOnce(async () => {
          boundPurchase = { ...boundPurchase!, stripePaymentIntentId: null }
          return intent
        })

        const response = await request({ action: "prepared-recover", ticket, paymentIntentId: "pi_fixture" })

        expect(response.status).toBe(409)
        expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
      })

      it("rejects foreign callers and expired unknown tickets but recovers the same known ID without replacement", async () => {
        preparePurchase()
        const { ticket } = await admit()
        mocks.auth.mockResolvedValueOnce({ ok: true, sessionId: "other", terminal: { id: "terminal_live" } })
        expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(403)
        mocks.create.mockRejectedValueOnce(new Error("unknown outcome"))
        expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(502)
        expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(200)
        expect(mocks.create.mock.calls[1]).toEqual(mocks.create.mock.calls[0])

        preparePurchase()
        const unknown = await admit()
        mocks.create.mockRejectedValueOnce(new Error("unknown outcome"))
        expect((await request({ action: "prepared-payment-intent", ticket: unknown.ticket })).status).toBe(502)
        vi.setSystemTime(new Date("2026-09-23T12:06:00Z"))
        expect((await request({ action: "prepared-payment-intent", ticket: unknown.ticket })).status).toBe(409)
        expect(mocks.create).toHaveBeenCalledTimes(3)

        preparePurchase()
        const fresh = await admit()
        await request({ action: "prepared-payment-intent", ticket: fresh.ticket })
        vi.setSystemTime(new Date("2026-09-23T12:12:00Z"))
        const response = await request({ action: "prepared-recover", ticket: fresh.ticket, paymentIntentId: "pi_fixture" })
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ id: "pi_fixture", status: "requires_payment_method", paid: false })
        expect(mocks.create).toHaveBeenCalledTimes(4)
      })

      describe("prepared-cancel of a confirmed-not-charged attempt", () => {
        const cancelKey = "prepared-native-m2-cancel:v1:pi_fixture"
        const boundAttempt = async () => {
          preparePurchase()
          const { ticket } = await admit()
          expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(200)
          const intent = await mocks.retrieve("pi_fixture") as Record<string, unknown>
          mocks.cancel.mockImplementation(async (id: string) => {
            const canceled = { ...intent, id, status: "canceled" }
            mocks.retrieve.mockResolvedValue(canceled)
            return canceled
          })
          vi.clearAllMocks()
          return { ticket, intent }
        }
        const cancel = (ticket: string, paymentIntentId = "pi_fixture") =>
          request({ action: "prepared-cancel", ticket, paymentIntentId })

        it("strictly parses the closed cancel action with an exact PaymentIntent ID", async () => {
          const { parseInternalPurchaseRequest } = await import("@/lib/stripe/internal-purchase")
          expect(parseInternalPurchaseRequest({ action: "prepared-cancel", ticket: "ticket", paymentIntentId: "pi_known" }))
            .toEqual({ action: "prepared-cancel", ticket: "ticket", paymentIntentId: "pi_known" })
          for (const body of [
            { action: "prepared-cancel", ticket: "ticket" },
            { action: "prepared-cancel", ticket: "ticket", paymentIntentId: "not_a_pi" },
            { action: "prepared-cancel", ticket: "ticket", paymentIntentId: "pi_known", extra: true },
            { action: "prepared-cancel", paymentIntentId: "pi_known" },
          ]) expect(parseInternalPurchaseRequest(body)).toBeNull()
        })

        it.each(["requires_payment_method", "requires_confirmation", "requires_action"])(
          "cancels a %s PaymentIntent with a PaymentIntent-derived idempotency key and returns no secret",
          async (status) => {
            const { ticket, intent } = await boundAttempt()
            mocks.retrieve.mockResolvedValueOnce({ ...intent, status })
            const response = await cancel(ticket)
            expect(response.status).toBe(200)
            expect(response.headers.get("Cache-Control")).toBe("no-store")
            const body = await response.json()
            expect(body).toEqual({ id: "pi_fixture", status: "canceled", paid: false })
            expect(JSON.stringify(body)).not.toContain("secret")
            expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith("pi_fixture", {}, { idempotencyKey: cancelKey })
            expect(mocks.create).not.toHaveBeenCalled()
            expectCanceledRecorded()
          },
        )

        const expectCanceledRecorded = () => {
          const at = new Date().toISOString()
          expect(mocks.purchaseUpdateMany).toHaveBeenCalledExactlyOnceWith({
            where: { id: "purchase_dynamic_1", status: { in: ["pending", "failed", "canceled"] }, stripePaymentIntentId: "pi_fixture" },
            data: {
              status: "canceled",
              metadata: expect.objectContaining({
                paymentSurface: "native_m2_prepare",
                stripeFailure: { eventType: "payment_intent.canceled", occurredAt: at, paymentIntentId: "pi_fixture" },
                paymentAttempts: [{ at, channel: "native_m2", status: "canceled", paymentIntentId: "pi_fixture" }],
              }),
            },
          })
        }

        it("records an already canceled PaymentIntent on the still pending Purchase so staff see Verify", async () => {
          const { ticket, intent } = await boundAttempt()
          mocks.retrieve.mockResolvedValueOnce({ ...intent, status: "canceled" })
          expect((await cancel(ticket)).status).toBe(200)
          expectCanceledRecorded()
        })

        it("does not log the same cancellation twice when the Purchase already recorded it", async () => {
          const { ticket } = await boundAttempt()
          expect((await cancel(ticket)).status).toBe(200)
          boundPurchase = {
            ...boundPurchase!, status: "canceled",
            metadata: { ...(boundPurchase!.metadata as Record<string, unknown>), paymentAttempts: [{ at: "x", channel: "native_m2", status: "canceled", paymentIntentId: "pi_fixture" }] },
          }
          mocks.purchaseUpdateMany.mockClear()
          expect((await cancel(ticket)).status).toBe(200)
          expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
        })

        it("never records a cancellation over a paid Purchase", async () => {
          const { ticket } = await boundAttempt()
          boundPurchase = { ...boundPurchase!, status: "paid" }
          const response = await cancel(ticket)
          expect(response.status).toBe(200)
          expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
        })

        it("reuses the same idempotency key when the kiosk repeats the cancel", async () => {
          const { ticket } = await boundAttempt()
          expect((await cancel(ticket)).status).toBe(200)
          const repeat = await cancel(ticket)
          expect(await repeat.json()).toEqual({ id: "pi_fixture", status: "canceled", paid: false })
          // The second call observes the canceled intent and never re-sends a cancel.
          expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith("pi_fixture", {}, { idempotencyKey: cancelKey })
        })

        it("reports an already canceled PaymentIntent as canceled without another provider cancel", async () => {
          const { ticket, intent } = await boundAttempt()
          mocks.retrieve.mockResolvedValueOnce({ ...intent, status: "canceled" })
          const response = await cancel(ticket)
          expect(await response.json()).toEqual({ id: "pi_fixture", status: "canceled", paid: false })
          expect(mocks.cancel).not.toHaveBeenCalled()
        })

        it("never cancels a succeeded PaymentIntent and reports it paid", async () => {
          const { ticket, intent } = await boundAttempt()
          mocks.retrieve.mockResolvedValueOnce({ ...intent, status: "succeeded", amount_received: 2599 })
          const response = await cancel(ticket)
          expect(response.status).toBe(200)
          expect(await response.json()).toEqual({ id: "pi_fixture", status: "succeeded", paid: true })
          expect(mocks.cancel).not.toHaveBeenCalled()
          expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
        })

        it.each(["processing", "requires_capture"])("leaves an ambiguous %s PaymentIntent untouched and pending", async (status) => {
          const { ticket, intent } = await boundAttempt()
          mocks.retrieve.mockResolvedValueOnce({ ...intent, status })
          const response = await cancel(ticket)
          expect(response.status).toBe(200)
          expect(await response.json()).toEqual({ id: "pi_fixture", status, paid: false })
          expect(mocks.cancel).not.toHaveBeenCalled()
          expect(mocks.purchaseUpdateMany).not.toHaveBeenCalled()
        })

        it("rejects a mismatched, unbound, or foreign attempt before any provider access", async () => {
          const { ticket } = await boundAttempt()
          expect((await cancel(ticket, "pi_other")).status).toBe(409)
          expectNoPreparedProviderReads()
          expect(mocks.cancel).not.toHaveBeenCalled()

          boundPurchase = { ...boundPurchase!, stripePaymentIntentId: null }
          vi.clearAllMocks()
          expect((await cancel(ticket)).status).toBe(409)
          expectNoPreparedProviderReads()
          expect(mocks.cancel).not.toHaveBeenCalled()

          boundPurchase = { ...boundPurchase!, stripePaymentIntentId: "pi_fixture" }
          mocks.auth.mockResolvedValueOnce({ ok: true, sessionId: "foreign", terminal: { id: "terminal_live" } })
          vi.clearAllMocks()
          expect((await cancel(ticket)).status).toBe(403)
          expectNoPreparedProviderReads()
          expect(mocks.cancel).not.toHaveBeenCalled()
        })

        it("refuses a binding lost before the provider cancel", async () => {
          const { ticket, intent } = await boundAttempt()
          mocks.retrieve.mockImplementationOnce(async () => {
            boundPurchase = { ...boundPurchase!, stripePaymentIntentId: null }
            return intent
          })
          expect((await cancel(ticket)).status).toBe(409)
          expect(mocks.cancel).not.toHaveBeenCalled()
        })

        it("still cancels the exact bound PaymentIntent after the ticket expired", async () => {
          const { ticket } = await boundAttempt()
          vi.setSystemTime(new Date("2026-09-23T12:12:00Z"))
          const response = await cancel(ticket)
          expect(response.status).toBe(200)
          expect(await response.json()).toEqual({ id: "pi_fixture", status: "canceled", paid: false })
        })

        it("fails closed with a generic error when the provider cancel fails", async () => {
          const { ticket } = await boundAttempt()
          mocks.cancel.mockRejectedValueOnce(Object.assign(new Error("sk_live_leak pi_fixture_secret"), { type: "StripeInvalidRequestError" }))
          const response = await cancel(ticket)
          expect(response.status).toBe(502)
          const text = await response.text()
          expect(text).not.toContain("sk_live")
          expect(text).not.toContain("secret")
        })

        it("treats a provider cancel that does not end canceled as pending", async () => {
          const { ticket, intent } = await boundAttempt()
          mocks.cancel.mockResolvedValueOnce({ ...intent, status: "processing" })
          const response = await cancel(ticket)
          expect(await response.json()).toEqual({ id: "pi_fixture", status: "processing", paid: false })
        })
      })

      describe("multi-terminal LIVE assignment", () => {
        const ipad = { ok: true, sessionId: "session_ipad", terminal: { id: "terminal_ipad", slug: "ipad", name: "iPad", location: "Lobby", active: true } }
        beforeEach(() => {
          mocks.reader.mockImplementation(async (id: string) => ({ id, livemode: true, device_type: "stripe_m2", location: catalog.locationId }))
          vi.stubEnv("INTERNAL_PURCHASE_LIVE_TERMINALS", " terminal_live=tmr_fixture , terminal_ipad=tmr_ipad ")
        })
        const prepareFor = (terminalId: string, sessionId: string) => {
          preparePurchase()
          preparedCapability = { ...preparedCapability!, terminalId, sessionId }
        }

        it("keeps the legacy single-terminal path unchanged when the list is unset", async () => {
          vi.stubEnv("INTERNAL_PURCHASE_LIVE_TERMINALS", undefined)
          expect((await request({ action: "connection-token" })).status).toBe(200)
          preparePurchase()
          const body = await admit()
          expect(body.readerId).toBe("tmr_fixture")
          expect((await request({ action: "prepared-payment-intent", ticket: body.ticket })).status).toBe(200)
          mocks.auth.mockResolvedValue(ipad)
          expect((await request({ action: "connection-token" })).status).toBe(403)
        })

        it("gives each listed terminal a token and binds attempts to its own reader", async () => {
          vi.stubEnv("INTERNAL_PURCHASE_LIVE_TERMINAL_ID", undefined)
          vi.stubEnv("INTERNAL_PURCHASE_LIVE_READER_ID", undefined)
          expect((await request({ action: "connection-token" })).status).toBe(200)
          mocks.auth.mockResolvedValue(ipad)
          expect((await request({ action: "connection-token" })).status).toBe(200)
          prepareFor("terminal_ipad", "session_ipad")
          const body = await admit()
          expect(body.readerId).toBe("tmr_ipad")
          expect(mocks.reader).toHaveBeenLastCalledWith("tmr_ipad")
          expect((await request({ action: "prepared-payment-intent", ticket: body.ticket })).status).toBe(200)
          expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ terminalId: "terminal_ipad", readerId: "tmr_ipad" }) }), expect.anything())
        })

        it("unions the legacy pair with the list", async () => {
          vi.stubEnv("INTERNAL_PURCHASE_LIVE_TERMINALS", "terminal_ipad=tmr_ipad")
          expect((await request({ action: "connection-token" })).status).toBe(200)
          preparePurchase()
          expect((await admit()).readerId).toBe("tmr_fixture")
          mocks.auth.mockResolvedValue(ipad)
          expect((await request({ action: "connection-token" })).status).toBe(200)
        })

        it("denies a terminal that is not listed", async () => {
          mocks.auth.mockResolvedValue({ ...ipad, terminal: { ...ipad.terminal, id: "terminal_other" } })
          expect((await request({ action: "connection-token" })).status).toBe(403)
          expectNoProvider()
        })

        it.each(["terminal_ipad=", "terminal_ipad"])("lets a terminal without a reader (%s) connect but fails payment creation closed", async (entry) => {
          vi.stubEnv("INTERNAL_PURCHASE_LIVE_TERMINALS", entry)
          mocks.auth.mockResolvedValue(ipad)
          expect((await request({ action: "connection-token" })).status).toBe(200)
          prepareFor("terminal_ipad", "session_ipad")
          const response = await request({ action: "prepared-attempt", preparedPurchaseReference: reference })
          expect(response.status).toBe(503)
          expect(await response.text()).toContain("LIVE reader assignment is not configured")
          expect(mocks.create).not.toHaveBeenCalled()
        })

        it("never lets a terminal use another terminal's attempt or reader", async () => {
          prepareFor("terminal_live", "session_live")
          const { ticket } = await admit()
          mocks.auth.mockResolvedValue(ipad)
          expect((await request({ action: "prepared-payment-intent", ticket })).status).toBe(403)
          expect(mocks.create).not.toHaveBeenCalled()
        })

        it.each([
          "terminal_ipad=tmr_ipad,terminal_ipad=tmr_other", "terminal_ipad=reader_bad", "=tmr_ipad", "terminal_ipad=tmr_ipad,,",
          "terminal ipad=tmr_ipad", "terminal_ipad=tmr_ipad=x", "terminal_live=tmr_other",
        ])("fails closed on malformed or conflicting list %s", async (list) => {
          vi.stubEnv("INTERNAL_PURCHASE_LIVE_TERMINALS", list)
          mocks.auth.mockResolvedValue(ipad)
          expect((await request({ action: "connection-token" })).status).toBe(503)
          expectNoProvider()
        })
      })
    })
  })
})
