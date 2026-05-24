import { describe, it, expect } from "vitest"
import {
  toProfileStatus,
  actionRequestStatusLabel,
  formatRequestDate,
  actionRequestMetaLabel,
  getPendingProcessLabel,
  getProcessTypeTone,
  isPendingRequestStatus,
  addDaysToIsoDate,
  pointsTypeLabel,
  formatDateKeyInTimeZone,
  formatTimeKeyInTimeZone,
  formatDateTimeInTimeZone,
} from "@/components/front/profile/profile-formatters"
import type { ActionRequestItem } from "@/components/front/profile/profile-types"

describe("profile formatters", () => {
  describe("toProfileStatus", () => {
    it("returns valid statuses as-is", () => {
      expect(toProfileStatus("NEW")).toBe("NEW")
      expect(toProfileStatus("ACTIVE")).toBe("ACTIVE")
      expect(toProfileStatus("ALUMNI")).toBe("ALUMNI")
    })

    it("returns NEW for invalid values", () => {
      expect(toProfileStatus("UNKNOWN")).toBe("NEW")
      expect(toProfileStatus(null)).toBe("NEW")
      expect(toProfileStatus(undefined)).toBe("NEW")
      expect(toProfileStatus(42)).toBe("NEW")
    })
  })

  describe("actionRequestStatusLabel", () => {
    it("maps known statuses", () => {
      expect(actionRequestStatusLabel("PENDING")).toBe("Pending")
      expect(actionRequestStatusLabel("PROCESSING")).toBe("In progress")
      expect(actionRequestStatusLabel("RESOLVED")).toBe("Resolved")
      expect(actionRequestStatusLabel("REJECTED")).toBe("Rejected")
    })

    it("returns raw status for unknown values", () => {
      expect(actionRequestStatusLabel("CUSTOM")).toBe("CUSTOM")
    })
  })

  describe("formatRequestDate", () => {
    it("formats valid YYYY-MM-DD dates", () => {
      const result = formatRequestDate("2026-03-15")
      expect(result).toBeTruthy()
      expect(result).toContain("2026")
      expect(result).toContain("15")
    })

    it("returns null for non-string values", () => {
      expect(formatRequestDate(null)).toBeNull()
      expect(formatRequestDate(123)).toBeNull()
      expect(formatRequestDate(undefined)).toBeNull()
    })

    it("returns null for invalid date format", () => {
      expect(formatRequestDate("not-a-date")).toBeNull()
      expect(formatRequestDate("2026/03/15")).toBeNull()
    })
  })

  describe("actionRequestMetaLabel", () => {
    it("formats SUSPEND with dates and package", () => {
      const request: ActionRequestItem = {
        id: "1",
        type: "SUSPEND",
        status: "PENDING",
        message: null,
        meta: { startDate: "2026-03-01", endDate: "2026-03-15", packageLabel: "Morning Pack" },
        createdAt: "2026-03-01T00:00:00Z",
        resolvedAt: null,
      }
      const result = actionRequestMetaLabel(request)
      expect(result).toContain("Morning Pack")
      expect(result).toContain("from")
    })

    it("formats CANCEL with effective date and course", () => {
      const request: ActionRequestItem = {
        id: "2",
        type: "CANCEL",
        status: "PENDING",
        message: null,
        meta: { effectiveDate: "2026-04-01", courseTitle: "Salsa" },
        createdAt: "2026-03-01T00:00:00Z",
        resolvedAt: null,
      }
      const result = actionRequestMetaLabel(request)
      expect(result).toContain("Salsa")
      expect(result).toContain("effective")
    })

    it("returns null for CLASS_CHANGE", () => {
      const request: ActionRequestItem = {
        id: "3",
        type: "CLASS_CHANGE",
        status: "PENDING",
        message: null,
        meta: {},
        createdAt: "2026-03-01T00:00:00Z",
        resolvedAt: null,
      }
      expect(actionRequestMetaLabel(request)).toBeNull()
    })
  })

  describe("getPendingProcessLabel", () => {
    it("returns 'Process' for undefined", () => {
      expect(getPendingProcessLabel(undefined)).toBe("Process")
    })

    it("formats type and status", () => {
      const request: ActionRequestItem = {
        id: "1",
        type: "SUSPEND",
        status: "PENDING",
        message: null,
        meta: null,
        createdAt: "2026-03-01T00:00:00Z",
        resolvedAt: null,
      }
      expect(getPendingProcessLabel(request)).toBe("Suspension (pending)")
    })
  })

  describe("getProcessTypeTone", () => {
    it("returns cancel tone", () => {
      const tone = getProcessTypeTone("CANCEL")
      expect(tone.dot).toBe("#f87171")
    })

    it("returns class-change tone", () => {
      const tone = getProcessTypeTone("CLASS_CHANGE")
      expect(tone.dot).toBe("#60a5fa")
    })

    it("returns suspend tone", () => {
      const tone = getProcessTypeTone("SUSPEND")
      expect(tone.dot).toBe("#fbbf24")
    })

    it("returns default tone for null/undefined", () => {
      const tone = getProcessTypeTone(null)
      expect(tone.border).toContain("rgba(255,255,255")
    })
  })

  describe("isPendingRequestStatus", () => {
    it("returns true for PENDING and PROCESSING", () => {
      expect(isPendingRequestStatus("PENDING")).toBe(true)
      expect(isPendingRequestStatus("PROCESSING")).toBe(true)
    })

    it("returns false for other statuses", () => {
      expect(isPendingRequestStatus("RESOLVED")).toBe(false)
      expect(isPendingRequestStatus("REJECTED")).toBe(false)
    })
  })

  describe("addDaysToIsoDate", () => {
    it("adds days to a valid ISO date", () => {
      expect(addDaysToIsoDate("2026-03-15", 5)).toBe("2026-03-20")
    })

    it("handles month boundary", () => {
      expect(addDaysToIsoDate("2026-01-30", 3)).toBe("2026-02-02")
    })

    it("handles year boundary", () => {
      expect(addDaysToIsoDate("2026-12-30", 5)).toBe("2027-01-04")
    })

    it("returns input for invalid format", () => {
      expect(addDaysToIsoDate("not-a-date", 1)).toBe("not-a-date")
    })

    it("handles negative days", () => {
      expect(addDaysToIsoDate("2026-03-15", -5)).toBe("2026-03-10")
    })
  })

  describe("pointsTypeLabel", () => {
    it("maps known types", () => {
      expect(pointsTypeLabel("PROFILE_COMPLETED")).toBe("Profile completed")
      expect(pointsTypeLabel("PACKAGE_PURCHASE")).toBe("Package purchase")
      expect(pointsTypeLabel("PACKAGE_ASSIGNMENT")).toBe("Class assignment")
      expect(pointsTypeLabel("CONSECUTIVE_ATTENDANCE")).toBe("Consecutive attendance")
      expect(pointsTypeLabel("REFERRAL_BONUS")).toBe("Referral")
      expect(pointsTypeLabel("CLASS_MILESTONE")).toBe("Class milestone")
    })

    it("returns raw type for unknown values", () => {
      expect(pointsTypeLabel("UNKNOWN_TYPE")).toBe("UNKNOWN_TYPE")
    })
  })

  describe("formatDateKeyInTimeZone", () => {
    it("formats a UTC date to NY timezone key", () => {
      // 2026-06-15 at noon UTC = still June 15 in NY (EDT, UTC-4)
      const result = formatDateKeyInTimeZone("2026-06-15T12:00:00Z", "America/New_York")
      expect(result).toBe("2026-06-15")
    })

    it("handles timezone offset date shift", () => {
      // 2026-06-16 at 2am UTC = still June 15 at 10pm in NY (EDT)
      const result = formatDateKeyInTimeZone("2026-06-16T02:00:00Z", "America/New_York")
      expect(result).toBe("2026-06-15")
    })

    it("returns empty string for invalid date", () => {
      expect(formatDateKeyInTimeZone("not-a-date")).toBe("")
    })
  })

  describe("formatTimeKeyInTimeZone", () => {
    it("formats time in NY timezone", () => {
      // 2026-06-15 at 18:30 UTC = 14:30 in NY (EDT, UTC-4)
      const result = formatTimeKeyInTimeZone("2026-06-15T18:30:00Z", "America/New_York")
      expect(result).toBe("14:30")
    })

    it("returns empty string for invalid date", () => {
      expect(formatTimeKeyInTimeZone("garbage")).toBe("")
    })
  })

  describe("formatDateTimeInTimeZone", () => {
    it("formats date+time with default options", () => {
      const result = formatDateTimeInTimeZone("2026-06-15T18:30:00Z")
      expect(result).toBeTruthy()
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(5)
    })

    it("returns empty string for invalid date", () => {
      expect(formatDateTimeInTimeZone("invalid")).toBe("")
    })

    it("respects custom options", () => {
      const result = formatDateTimeInTimeZone(
        "2026-06-15T18:30:00Z",
        { year: "numeric", month: "long" },
        "en-US",
        "UTC"
      )
      expect(result).toContain("June")
      expect(result).toContain("2026")
    })
  })
})
