import { createHash } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  NATIVE_CONNECTION_TOKEN_SCOPE,
  NativeReaderAuthService,
  type NativeReaderRecord,
} from "@/apps/backend/src/terminal/native-reader-auth.service"
import { NativeConnectionTokenController } from "@/apps/backend/src/terminal/native-connection-token.controller"
import { createBackendRequestHandler } from "@/apps/backend/src/main"

const PEPPER = "native-reader-test-pepper"
const READER_ID = "reader_1"
const SECRET = "reader-secret"
const credential = `${READER_ID}.${NATIVE_CONNECTION_TOKEN_SCOPE}.${SECRET}`

const hashCredential = (value: string) => createHash("sha256").update(`${value}:${PEPPER}`).digest("hex")

const activeReader = (overrides: Partial<NativeReaderRecord> = {}): NativeReaderRecord => ({
  id: READER_ID,
  name: "Front desk iPhone",
  tokenHash: hashCredential(credential),
  active: true,
  revokedAt: null,
  ...overrides,
})

const allowedLimit = { ok: true, remaining: 9, retryAfterSec: 0 }
type RateLimitInput = { key: string; limit: number; windowMs: number }
type RateLimitResult = typeof allowedLimit

const createHarness = ({
  reader = activeReader(),
  consumeLimit = vi.fn((_input: RateLimitInput) => allowedLimit),
}: {
  reader?: NativeReaderRecord | null
  consumeLimit?: (input: RateLimitInput) => RateLimitResult
} = {}) => {
  const findById = vi.fn().mockResolvedValue(reader)
  const markUsed = vi.fn().mockResolvedValue(undefined)
  const createConnectionToken = vi.fn().mockResolvedValue({ secret: "stripe_connection_secret" })
  const auth = new NativeReaderAuthService({ findById, markUsed }, consumeLimit)
  const controller = new NativeConnectionTokenController(auth, { createConnectionToken })
  const handleRequest = createBackendRequestHandler({ nativeConnectionTokenController: controller })
  return { consumeLimit, createConnectionToken, findById, handleRequest, markUsed }
}

const requestNativeToken = (
  handleRequest: ReturnType<typeof createBackendRequestHandler>,
  authorization?: string,
  options: { cookie?: string; method?: string; path?: string } = {}
) => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.10" })
  if (authorization) headers.set("authorization", authorization)
  if (options.cookie) headers.set("cookie", options.cookie)
  return handleRequest(
    new Request(`http://backend.internal${options.path ?? "/terminal/native/connection-token"}`, {
      method: options.method ?? "POST",
      headers,
    })
  )
}

describe("native reader connection-token authorization", () => {
  beforeEach(() => {
    process.env.NATIVE_READER_TOKEN_PEPPER = PEPPER
  })

  afterEach(() => {
    delete process.env.NATIVE_READER_TOKEN_PEPPER
    vi.restoreAllMocks()
  })

  it("returns 503 when the token pepper is missing without reader lookup or Stripe", async () => {
    delete process.env.NATIVE_READER_TOKEN_PEPPER
    const harness = createHarness()

    const response = await requestNativeToken(harness.handleRequest, `Bearer ${credential}`)

    expect(response.status).toBe(503)
    expect(response.headers.get("Retry-After")).toBe("30")
    await expect(response.json()).resolves.toEqual({ error: "Native reader authentication temporarily unavailable" })
    expect(harness.findById).not.toHaveBeenCalled()
    expect(harness.markUsed).not.toHaveBeenCalled()
    expect(harness.createConnectionToken).not.toHaveBeenCalled()
  })

  it.each([
    ["missing credentials", undefined, undefined],
    ["basic credentials", "Basic browser-token", undefined],
    ["malformed bearer credentials", "Bearer malformed", undefined],
    ["Clerk browser credentials", undefined, "__session=clerk-browser-session"],
  ])("returns 401 for %s without reader lookup or Stripe", async (_name, authorization, cookie) => {
    const harness = createHarness()

    const response = await requestNativeToken(harness.handleRequest, authorization, { cookie })

    expect(response.status).toBe(401)
    expect(harness.findById).not.toHaveBeenCalled()
    expect(harness.createConnectionToken).not.toHaveBeenCalled()
  })

  it.each([
    ["inactive reader", activeReader({ active: false }), credential],
    ["revoked reader", activeReader({ revokedAt: new Date("2026-08-14T12:00:00.000Z") }), credential],
    ["token hash mismatch", activeReader(), `${READER_ID}.${NATIVE_CONNECTION_TOKEN_SCOPE}.wrong-secret`],
  ])("returns 401 for %s without Stripe", async (_name, reader, presentedCredential) => {
    const harness = createHarness({ reader })

    const response = await requestNativeToken(harness.handleRequest, `Bearer ${presentedCredential}`)

    expect(response.status).toBe(401)
    expect(harness.createConnectionToken).not.toHaveBeenCalled()
    expect(harness.markUsed).not.toHaveBeenCalled()
  })

  it("returns 403 when the authenticated reader token lacks connection-token scope", async () => {
    const unscopedCredential = `${READER_ID}.terminal:jobs.${SECRET}`
    const harness = createHarness({ reader: activeReader({ tokenHash: hashCredential(unscopedCredential) }) })

    const response = await requestNativeToken(harness.handleRequest, `Bearer ${unscopedCredential}`)

    expect(response.status).toBe(403)
    expect(harness.createConnectionToken).not.toHaveBeenCalled()
    expect(harness.markUsed).not.toHaveBeenCalled()
  })

  it.each(["native-reader:ip", "native-reader:reader"])(
    "returns 429 when the %s limit is exhausted without Stripe",
    async (blockedScope) => {
      const consumeLimit = vi.fn((input: RateLimitInput) =>
        input.key.startsWith(blockedScope)
          ? { ok: false, remaining: 0, retryAfterSec: 30 }
          : allowedLimit
      )
      const harness = createHarness({ consumeLimit })

      const response = await requestNativeToken(harness.handleRequest, `Bearer ${credential}`)

      expect(response.status).toBe(429)
      expect(response.headers.get("Retry-After")).toBe("30")
      expect(harness.createConnectionToken).not.toHaveBeenCalled()
      expect(harness.markUsed).not.toHaveBeenCalled()
    }
  )

  it.each([
    ["GET", "/terminal/native/connection-token"],
    ["POST", "/terminal/native/unsupported"],
  ])("returns 404 for unsupported native route %s %s without auth or Stripe", async (method, path) => {
    const harness = createHarness()

    const response = await requestNativeToken(harness.handleRequest, `Bearer ${credential}`, { method, path })

    expect(response.status).toBe(404)
    expect(harness.findById).not.toHaveBeenCalled()
    expect(harness.createConnectionToken).not.toHaveBeenCalled()
  })

  it("allows an authorized reader to obtain a Stripe Terminal connection token through Nest", async () => {
    const harness = createHarness()

    const response = await requestNativeToken(harness.handleRequest, `Bearer ${credential}`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ secret: "stripe_connection_secret" })
    expect(harness.createConnectionToken).toHaveBeenCalledWith({
      sessionId: READER_ID,
      terminalId: READER_ID,
      terminalSlug: READER_ID,
      terminalName: "Front desk iPhone",
      terminalLocation: null,
    })
    expect(harness.markUsed).toHaveBeenCalledWith(READER_ID, expect.any(Date))
  })
})
