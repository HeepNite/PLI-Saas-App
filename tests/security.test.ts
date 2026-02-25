import { beforeEach, describe, expect, it } from "vitest"
import { validateCheckInBody } from "@/lib/security/checkin-validation"
import { validateProfileUpdatePayload } from "@/lib/security/profile-validation"
import { buildRateLimitKey, consumeRateLimit } from "@/lib/security/rate-limit"

describe("security helpers", () => {
  beforeEach(() => {
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = "1"
    const globalStore = globalThis as unknown as { pliRateLimitStore?: Map<string, unknown> }
    globalStore.pliRateLimitStore?.clear()
  })

  it("validates profile payload and rejects invalid birth date", () => {
    const invalid = validateProfileUpdatePayload({ birthDate: "2222-12-12" })
    expect("status" in invalid).toBe(true)
    if (!("status" in invalid)) return
    expect(invalid.status).toBe(400)

    const valid = validateProfileUpdatePayload({
      firstName: "Pepe",
      lastName: "Werwer",
      birthDate: "1990-12-22",
      emergencyContactName: "Ana Perez",
      emergencyContactRelation: "Sister",
      emergencyContactPhone: "+1 929 555 5566",
    })
    expect("status" in valid).toBe(false)
  })

  it("validates staff check-in payload", () => {
    const invalid = validateCheckInBody({
      courseSlug: "Musica Bebes",
      email: "not-valid",
    })
    expect("status" in invalid).toBe(true)

    const valid = validateCheckInBody({
      courseSlug: "musica-bebes",
      email: "test@example.com",
      startsAt: "2026-02-20T15:00:00.000Z",
      durationMinutes: 55,
    })
    expect("status" in valid).toBe(false)
  })

  it("rate limits by key and window", () => {
    const key = buildRateLimitKey("test:scope", "127.0.0.1")
    const first = consumeRateLimit({ key, limit: 2, windowMs: 60_000 })
    const second = consumeRateLimit({ key, limit: 2, windowMs: 60_000 })
    const third = consumeRateLimit({ key, limit: 2, windowMs: 60_000 })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(third.ok).toBe(false)
    expect(third.retryAfterSec).toBeGreaterThan(0)
  })
})
