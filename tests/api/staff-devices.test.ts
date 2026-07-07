import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockListOwnTrustedDevices = vi.fn()
const mockRevokeOwnTrustedDevice = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock("@/lib/security/staff-trusted-device", () => ({
  listOwnTrustedDevices: (...args: unknown[]) => mockListOwnTrustedDevices(...args),
  revokeOwnTrustedDevice: (...args: unknown[]) => mockRevokeOwnTrustedDevice(...args),
}))

const get = () => import("@/app/api/staff/devices/route").then(({ GET }) => GET())

const del = (id: string) =>
  import("@/app/api/staff/devices/[id]/route").then(({ DELETE }) =>
    DELETE(new Request(`http://localhost/api/staff/devices/${id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id }),
    })
  )

describe("staff device list/revoke endpoints (own devices only)", () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockListOwnTrustedDevices.mockReset()
    mockRevokeOwnTrustedDevice.mockReset()
    mockAuth.mockResolvedValue({ userId: "staff_1" })
  })

  describe("GET /api/staff/devices", () => {
    it("rejects an unauthenticated request with 401", async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const res = await get()

      expect(res.status).toBe(401)
      expect(mockListOwnTrustedDevices).not.toHaveBeenCalled()
    })

    it("lists ONLY the caller's own devices", async () => {
      mockListOwnTrustedDevices.mockResolvedValue([
        { id: "device_1", createdAt: new Date("2026-01-01"), lastUsedAt: null },
      ])

      const res = await get()

      expect(res.status).toBe(200)
      expect(mockListOwnTrustedDevices).toHaveBeenCalledWith("staff_1")
      const data = await res.json()
      expect(data.devices).toHaveLength(1)
      expect(data.devices[0].id).toBe("device_1")
    })
  })

  describe("DELETE /api/staff/devices/[id]", () => {
    it("rejects an unauthenticated request with 401", async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const res = await del("device_1")

      expect(res.status).toBe(401)
      expect(mockRevokeOwnTrustedDevice).not.toHaveBeenCalled()
    })

    it("revokes a device scoped to the caller's own staffUserId", async () => {
      mockRevokeOwnTrustedDevice.mockResolvedValue({ ok: true })

      const res = await del("device_1")

      expect(res.status).toBe(200)
      expect(mockRevokeOwnTrustedDevice).toHaveBeenCalledWith("staff_1", "device_1")
    })

    it("returns the underlying error status when revoke fails (e.g. device belongs to someone else)", async () => {
      mockRevokeOwnTrustedDevice.mockResolvedValue({ ok: false, status: 404, error: "Device not found." })

      const res = await del("someone-elses-device")

      expect(res.status).toBe(404)
    })
  })
})
