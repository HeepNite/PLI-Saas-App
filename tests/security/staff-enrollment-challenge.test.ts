import { beforeEach, describe, expect, it, vi } from "vitest"

type FakeChallengeRow = {
  id: string
  staffUserId: string
  codeHash: string
  expiresAt: Date
  consumedAt: Date | null
  attempts: number
  createdAt: Date
}

// In-memory fake standing in for the `staffEnrollmentChallenge` Postgres
// table — same convention as tests/security/staff-pin-throttle.test.ts.
let rows: FakeChallengeRow[] = []
let nextId = 1

const mockCreate = vi.fn(async ({ data }: { data: Partial<FakeChallengeRow> & { staffUserId: string; codeHash: string; expiresAt: Date } }) => {
  const row: FakeChallengeRow = {
    id: `challenge_${nextId++}`,
    consumedAt: null,
    attempts: 0,
    createdAt: new Date(),
    ...data,
  }
  rows.push(row)
  return { ...row }
})

const mockUpdateMany = vi.fn(
  async ({
    where,
    data,
  }: {
    where: { staffUserId?: string; consumedAt?: null; id?: string }
    data: Partial<FakeChallengeRow>
  }) => {
    const matched = rows.filter((row) => {
      if (where.staffUserId !== undefined && row.staffUserId !== where.staffUserId) return false
      if (where.consumedAt === null && row.consumedAt !== null) return false
      if (where.id !== undefined && row.id !== where.id) return false
      return true
    })
    matched.forEach((row) => Object.assign(row, data))
    return { count: matched.length }
  }
)

type ChallengeUpdateData = {
  consumedAt?: Date | null
  attempts?: number | { increment?: number }
}

const mockUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: ChallengeUpdateData }) => {
  const row = rows.find((r) => r.id === where.id)
  if (!row) throw new Error("not found")
  const { attempts, ...rest } = data
  Object.assign(row, rest)
  if (typeof attempts === "number") {
    row.attempts = attempts
  } else if (attempts && typeof attempts.increment === "number") {
    row.attempts += attempts.increment
  }
  return { ...row }
})

const mockFindFirst = vi.fn(
  async ({
    where,
  }: {
    where: { staffUserId: string; consumedAt: null; expiresAt: { gt: Date } }
    orderBy?: unknown
  }) => {
    const candidates = rows
      .filter(
        (row) =>
          row.staffUserId === where.staffUserId && row.consumedAt === null && row.expiresAt.getTime() > where.expiresAt.gt.getTime()
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return candidates[0] ? { ...candidates[0] } : null
  }
)

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffEnrollmentChallenge: {
      create: (...args: unknown[]) => (mockCreate as (...a: unknown[]) => unknown)(...args),
      updateMany: (...args: unknown[]) => (mockUpdateMany as (...a: unknown[]) => unknown)(...args),
      update: (...args: unknown[]) => (mockUpdate as (...a: unknown[]) => unknown)(...args),
      findFirst: (...args: unknown[]) => (mockFindFirst as (...a: unknown[]) => unknown)(...args),
    },
  },
}))

describe("lib/security/staff-enrollment-challenge: single-use SMS OTP challenge", () => {
  beforeEach(() => {
    rows = []
    nextId = 1
    mockCreate.mockClear()
    mockUpdateMany.mockClear()
    mockUpdate.mockClear()
    mockFindFirst.mockClear()
    process.env.CLERK_SECRET_KEY = "test-secret"
  })

  it("issues a 6-digit numeric code and stores it HASHED (never plaintext)", async () => {
    const { issueEnrollmentChallenge } = await import("@/lib/security/staff-enrollment-challenge")

    const issued = await issueEnrollmentChallenge("staff_1")

    expect(issued.code).toMatch(/^\d{6}$/)
    expect(mockCreate).toHaveBeenCalledOnce()
    const createArgs = mockCreate.mock.calls[0]![0] as { data: { codeHash: string; staffUserId: string } }
    expect(createArgs.data.staffUserId).toBe("staff_1")
    expect(createArgs.data.codeHash).not.toBe(issued.code)
    expect(createArgs.data.codeHash).toContain(":")
  })

  it("issuing a new challenge invalidates any prior unconsumed challenge for the same staffUserId", async () => {
    const { issueEnrollmentChallenge, consumeEnrollmentChallenge } = await import("@/lib/security/staff-enrollment-challenge")

    const first = await issueEnrollmentChallenge("staff_1")
    await issueEnrollmentChallenge("staff_1")

    const result = await consumeEnrollmentChallenge("staff_1", first.code)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(409)
  })

  it("consumes a valid, fresh code exactly once (single-use)", async () => {
    const { issueEnrollmentChallenge, consumeEnrollmentChallenge } = await import("@/lib/security/staff-enrollment-challenge")

    const issued = await issueEnrollmentChallenge("staff_1")

    const firstAttempt = await consumeEnrollmentChallenge("staff_1", issued.code)
    expect(firstAttempt.ok).toBe(true)

    const replay = await consumeEnrollmentChallenge("staff_1", issued.code)
    expect(replay.ok).toBe(false)
    if (!replay.ok) expect(replay.status).toBe(409)
  })

  it("rejects a WRONG code with 409 and does NOT consume the real challenge", async () => {
    const { issueEnrollmentChallenge, consumeEnrollmentChallenge } = await import("@/lib/security/staff-enrollment-challenge")

    const issued = await issueEnrollmentChallenge("staff_1")

    const wrong = await consumeEnrollmentChallenge("staff_1", "000000" === issued.code ? "111111" : "000000")
    expect(wrong.ok).toBe(false)
    if (!wrong.ok) expect(wrong.status).toBe(409)

    const correct = await consumeEnrollmentChallenge("staff_1", issued.code)
    expect(correct.ok).toBe(true)
  })

  it("rejects an EXPIRED challenge with 409", async () => {
    const { issueEnrollmentChallenge, consumeEnrollmentChallenge } = await import("@/lib/security/staff-enrollment-challenge")

    const issued = await issueEnrollmentChallenge("staff_1")
    rows[0]!.expiresAt = new Date(Date.now() - 1_000)

    const result = await consumeEnrollmentChallenge("staff_1", issued.code)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(409)
  })

  it("rejects a CROSS-USER consume attempt (correct code, wrong staffUserId) with 409", async () => {
    const { issueEnrollmentChallenge, consumeEnrollmentChallenge } = await import("@/lib/security/staff-enrollment-challenge")

    const issued = await issueEnrollmentChallenge("staff_1")

    const result = await consumeEnrollmentChallenge("staff_intruder", issued.code)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(409)
  })

  it("rejects consume when no challenge was ever issued for that staffUserId", async () => {
    const { consumeEnrollmentChallenge } = await import("@/lib/security/staff-enrollment-challenge")

    const result = await consumeEnrollmentChallenge("staff_never_enrolled", "123456")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(409)
  })

  it("caps repeated wrong-code attempts against one active challenge (attempt ceiling)", async () => {
    const { issueEnrollmentChallenge, consumeEnrollmentChallenge } = await import("@/lib/security/staff-enrollment-challenge")

    const issued = await issueEnrollmentChallenge("staff_1")
    const wrongCode = issued.code === "000000" ? "111111" : "000000"

    let lastResult
    for (let i = 0; i < 6; i += 1) {
      lastResult = await consumeEnrollmentChallenge("staff_1", wrongCode)
    }

    expect(lastResult!.ok).toBe(false)

    // Even the CORRECT code no longer works once the attempt ceiling trips —
    // the challenge is burned, forcing the staff member to request a new one.
    const afterCap = await consumeEnrollmentChallenge("staff_1", issued.code)
    expect(afterCap.ok).toBe(false)
  })
})
