import { createHash, timingSafeEqual } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit } from "@/lib/security/rate-limit"

export const NATIVE_CONNECTION_TOKEN_SCOPE = "terminal:connection-token"
export const NATIVE_PAYMENT_JOB_CREATE_SCOPE = "terminal:payment-jobs:create"
export const NATIVE_PAYMENT_JOB_RECOVERY_SCOPE = "terminal:payment-jobs:recover"

const RATE_LIMIT_WINDOW_MS = 60_000
const IP_RATE_LIMIT = 60
const READER_RATE_LIMIT = 30
const CONFIG_RETRY_AFTER_SEC = 30

export type NativeReaderRecord = {
  id: string
  name: string
  tokenHash: string
  active: boolean
  revokedAt: Date | null
}

type NativeReaderStore = {
  findById: (id: string) => Promise<NativeReaderRecord | null>
  markUsed: (id: string, usedAt: Date) => Promise<unknown>
}

type RateLimitPort = (input: { key: string; limit: number; windowMs: number }) => {
  ok: boolean
  remaining: number
  retryAfterSec: number
}

type ReaderCredential = {
  raw: string
  readerId: string
  scopes: string[]
}

export class NativeReaderAuthorizationError extends Error {
  constructor(
    readonly status: 401 | 403 | 429 | 503,
    readonly retryAfterSec?: number,
    message = "Native reader authorization rejected"
  ) {
    super(message)
  }
}

const readerStore: NativeReaderStore = {
  findById: (id) =>
    prisma.nativeReader.findUnique({
      where: { id },
      select: { id: true, name: true, tokenHash: true, active: true, revokedAt: true },
    }),
  markUsed: (id, usedAt) => prisma.nativeReader.update({ where: { id }, data: { lastUsedAt: usedAt } }),
}

const parseBearerCredential = (authorization: string | null): ReaderCredential | null => {
  if (!authorization?.startsWith("Bearer ")) return null
  const raw = authorization.slice("Bearer ".length)
  const [readerId, scopeClaim, secret, ...extra] = raw.split(".")
  if (!readerId || !scopeClaim || !secret || extra.length > 0) return null
  const scopes = scopeClaim.split(",").filter(Boolean)
  if (scopes.length === 0) return null
  return { raw, readerId, scopes }
}

export const hashNativeReaderToken = (credential: string, pepper: string) =>
  createHash("sha256").update(`${credential}:${pepper}`).digest("hex")

const hashesMatch = (actual: string, expected: string) => {
  const actualBuffer = Buffer.from(actual, "utf8")
  const expectedBuffer = Buffer.from(expected, "utf8")
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export class NativeReaderAuthService {
  constructor(
    private readonly readers: NativeReaderStore = readerStore,
    private readonly consumeLimit: RateLimitPort = consumeRateLimit
  ) {}

  async authorize(input: {
    authorization: string | null
    ipAddress: string
    requiredScope: string
  }): Promise<Pick<NativeReaderRecord, "id" | "name">> {
    const pepper = process.env.NATIVE_READER_TOKEN_PEPPER?.trim()
    if (!pepper) {
      throw new NativeReaderAuthorizationError(503, CONFIG_RETRY_AFTER_SEC, "Native reader authentication temporarily unavailable")
    }

    const credential = parseBearerCredential(input.authorization)
    if (!credential) throw new NativeReaderAuthorizationError(401)

    this.enforceLimit("ip", input.ipAddress, IP_RATE_LIMIT)
    const reader = await this.readers.findById(credential.readerId)
    if (!reader || !reader.active || reader.revokedAt) {
      throw new NativeReaderAuthorizationError(401)
    }

    const actualHash = hashNativeReaderToken(credential.raw, pepper)
    if (!hashesMatch(actualHash, reader.tokenHash)) throw new NativeReaderAuthorizationError(401)
    if (!credential.scopes.includes(input.requiredScope)) throw new NativeReaderAuthorizationError(403)

    this.enforceLimit("reader", reader.id, READER_RATE_LIMIT)
    await this.readers.markUsed(reader.id, new Date())
    return { id: reader.id, name: reader.name }
  }

  private enforceLimit(scope: "ip" | "reader", identifier: string, limit: number) {
    const result = this.consumeLimit({
      key: buildRateLimitKey(`native-reader:${scope}`, identifier),
      limit,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
    if (!result.ok) throw new NativeReaderAuthorizationError(429, result.retryAfterSec)
  }
}
