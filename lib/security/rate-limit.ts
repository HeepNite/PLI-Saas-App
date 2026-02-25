type RateLimitBucket = {
  count: number
  resetAt: number
}

type RateLimitInput = {
  key: string
  limit: number
  windowMs: number
}

export type RateLimitResult = {
  ok: boolean
  remaining: number
  retryAfterSec: number
}

const globalForRateLimit = globalThis as unknown as {
  pliRateLimitStore?: Map<string, RateLimitBucket>
}

const getStore = () => {
  if (!globalForRateLimit.pliRateLimitStore) {
    globalForRateLimit.pliRateLimitStore = new Map<string, RateLimitBucket>()
  }
  return globalForRateLimit.pliRateLimitStore
}

const shouldBypassRateLimit = () =>
  (process.env.NODE_ENV === "test" && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== "1") ||
  process.env.DISABLE_RATE_LIMIT === "1"

const cleanupExpired = (store: Map<string, RateLimitBucket>, now: number) => {
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key)
    }
  }
}

export const consumeRateLimit = (input: RateLimitInput): RateLimitResult => {
  if (shouldBypassRateLimit()) {
    return {
      ok: true,
      remaining: input.limit,
      retryAfterSec: 0,
    }
  }

  const now = Date.now()
  const store = getStore()
  cleanupExpired(store, now)

  const current = store.get(input.key)
  if (!current || current.resetAt <= now) {
    store.set(input.key, {
      count: 1,
      resetAt: now + input.windowMs,
    })
    return {
      ok: true,
      remaining: Math.max(0, input.limit - 1),
      retryAfterSec: 0,
    }
  }

  if (current.count >= input.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  store.set(input.key, current)
  return {
    ok: true,
    remaining: Math.max(0, input.limit - current.count),
    retryAfterSec: 0,
  }
}

export const getClientIp = (req?: Request) => {
  if (!req) return "unknown"
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "unknown"
}

export const buildRateLimitKey = (scope: string, identifier: string) => `${scope}:${identifier || "unknown"}`
