import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalSection = vi.fn()
const mockGetStudentPinSaturationReport = vi.fn()

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalSectionRequest: (...args: unknown[]) => mockAuthorizePortalSection(...args),
}))

vi.mock("@/lib/security/student-pin-saturation", () => ({
  getStudentPinSaturationReport: (...args: unknown[]) => mockGetStudentPinSaturationReport(...args),
}))

describe("staff PIN saturation report route", () => {
  beforeEach(() => {
    mockAuthorizePortalSection.mockReset()
    mockGetStudentPinSaturationReport.mockReset()

    mockAuthorizePortalSection.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin", category: "manager" })
    mockGetStudentPinSaturationReport.mockResolvedValue({
      activePinCount: 7012,
      totalSpace: 10000,
      availablePinCount: 2988,
      saturationRatio: 0.7012,
      saturationPct: 70.1,
      alertLevel: "warning",
      thresholds: {
        warningPct: 70,
        criticalPct: 90,
      },
    })
  })

  it("returns the current saturation report for authorized staff", async () => {
    const { GET } = await import("@/app/api/staff/reports/pin-saturation/route")
    const res = await GET(new Request("http://localhost/api/staff/reports/pin-saturation"))

    expect(res.status).toBe(200)
    expect(mockAuthorizePortalSection).toHaveBeenCalledWith("reports")
    expect(mockGetStudentPinSaturationReport).toHaveBeenCalledTimes(1)
    await expect(res.json()).resolves.toMatchObject({
      activePinCount: 7012,
      totalSpace: 10000,
      alertLevel: "warning",
    })
  })

  it("returns the auth error when the staff user lacks reports access", async () => {
    mockAuthorizePortalSection.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

    const { GET } = await import("@/app/api/staff/reports/pin-saturation/route")
    const res = await GET(new Request("http://localhost/api/staff/reports/pin-saturation"))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Insufficient role" })
    expect(mockGetStudentPinSaturationReport).not.toHaveBeenCalled()
  })
})
