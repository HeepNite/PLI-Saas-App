import { beforeEach, describe, expect, it, vi } from "vitest"

type FakeDeviceRow = {
  id: string
  staffUserId: string
  tokenHash: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}

// In-memory fake standing in for the `staffTrustedDevice` Postgres table —
// same convention as tests/security/staff-pin-throttle.test.ts.
let rows: FakeDeviceRow[] = []
let nextId = 1

const mockCreate = vi.fn(async ({ data }: { data: { staffUserId: string; tokenHash: string } }) => {
  const row: FakeDeviceRow = {
    id: `device_${nextId++}`,
    createdAt: new Date(Date.now() + nextId), // monotonically increasing for ordering
    lastUsedAt: null,
    revokedAt: null,
    ...data,
  }
  rows.push(row)
  return { ...row }
})

const mockFindUnique = vi.fn(async ({ where }: { where: { id?: string; tokenHash?: string } }) => {
  const row = rows.find((r) => (where.id ? r.id === where.id : r.tokenHash === where.tokenHash))
  return row ? { ...row } : null
})

const mockFindMany = vi.fn(async ({ where }: { where: { staffUserId: string; revokedAt: null } }) => {
  return rows
    .filter((r) => r.staffUserId === where.staffUserId && r.revokedAt === null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((r) => ({ ...r }))
})

const mockUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeDeviceRow> }) => {
  const row = rows.find((r) => r.id === where.id)
  if (!row) throw new Error("not found")
  Object.assign(row, data)
  return { ...row }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffTrustedDevice: {
      create: (...args: unknown[]) => (mockCreate as (...a: unknown[]) => unknown)(...args),
      findUnique: (...args: unknown[]) => (mockFindUnique as (...a: unknown[]) => unknown)(...args),
      findMany: (...args: unknown[]) => (mockFindMany as (...a: unknown[]) => unknown)(...args),
      update: (...args: unknown[]) => (mockUpdate as (...a: unknown[]) => unknown)(...args),
    },
  },
}))

describe("lib/security/staff-trusted-device: cookie+DB issue/validate/revoke", () => {
  beforeEach(() => {
    rows = []
    nextId = 1
    mockCreate.mockClear()
    mockFindUnique.mockClear()
    mockFindMany.mockClear()
    mockUpdate.mockClear()
    process.env.CLERK_SECRET_KEY = "test-secret"
  })

  it("enrolls a device, then validates its token to the owning staffUserId", async () => {
    const { enrollTrustedDevice, validateTrustedDeviceToken } = await import("@/lib/security/staff-trusted-device")

    const { token } = await enrollTrustedDevice("staff_1")
    const validated = await validateTrustedDeviceToken(token)

    expect(validated).not.toBeNull()
    expect(validated?.staffUserId).toBe("staff_1")
  })

  it("stores the token HASHED, never in plaintext", async () => {
    const { enrollTrustedDevice } = await import("@/lib/security/staff-trusted-device")

    const { token } = await enrollTrustedDevice("staff_1")

    expect(rows).toHaveLength(1)
    expect(rows[0]!.tokenHash).not.toBe(token)
  })

  it("rejects an unknown token", async () => {
    const { validateTrustedDeviceToken } = await import("@/lib/security/staff-trusted-device")

    const validated = await validateTrustedDeviceToken("not-a-real-token")
    expect(validated).toBeNull()
  })

  it("rejects a REVOKED device's token, even though the row still exists", async () => {
    const { enrollTrustedDevice, revokeOwnTrustedDevice, validateTrustedDeviceToken } = await import(
      "@/lib/security/staff-trusted-device"
    )

    const { token } = await enrollTrustedDevice("staff_1")
    const deviceId = rows[0]!.id
    await revokeOwnTrustedDevice("staff_1", deviceId)

    const validated = await validateTrustedDeviceToken(token)
    expect(validated).toBeNull()
  })

  it("REVOKE is scoped to the caller's own staffUserId — cross-user revoke attempt fails", async () => {
    const { enrollTrustedDevice, revokeOwnTrustedDevice, validateTrustedDeviceToken } = await import(
      "@/lib/security/staff-trusted-device"
    )

    const { token } = await enrollTrustedDevice("staff_victim")
    const deviceId = rows[0]!.id

    const result = await revokeOwnTrustedDevice("staff_attacker", deviceId)
    expect(result.ok).toBe(false)

    // The device must remain valid — the cross-user attempt did not revoke it.
    const validated = await validateTrustedDeviceToken(token)
    expect(validated?.staffUserId).toBe("staff_victim")
  })

  it("enforces the per-user active-device cap by evicting the OLDEST device", async () => {
    const { enrollTrustedDevice, validateTrustedDeviceToken, STAFF_TRUSTED_DEVICE_MAX_ACTIVE } = await import(
      "@/lib/security/staff-trusted-device"
    )

    const tokens: string[] = []
    for (let i = 0; i < STAFF_TRUSTED_DEVICE_MAX_ACTIVE; i += 1) {
      const { token } = await enrollTrustedDevice("staff_1")
      tokens.push(token)
    }

    // One more enrollment past the cap must evict the FIRST (oldest) device.
    await enrollTrustedDevice("staff_1")

    const oldestStillValid = await validateTrustedDeviceToken(tokens[0]!)
    expect(oldestStillValid).toBeNull()

    const newestStillValid = await validateTrustedDeviceToken(tokens[tokens.length - 1]!)
    expect(newestStillValid?.staffUserId).toBe("staff_1")
  })

  it("lists only the caller's own ACTIVE (non-revoked) devices", async () => {
    const { enrollTrustedDevice, revokeOwnTrustedDevice, listOwnTrustedDevices } = await import(
      "@/lib/security/staff-trusted-device"
    )

    await enrollTrustedDevice("staff_1")
    await enrollTrustedDevice("staff_1")
    await enrollTrustedDevice("staff_other")
    const secondDeviceId = rows[1]!.id
    await revokeOwnTrustedDevice("staff_1", secondDeviceId)

    const list = await listOwnTrustedDevices("staff_1")
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(rows[0]!.id)
  })
})
