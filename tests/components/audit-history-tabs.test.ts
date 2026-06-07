import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getDateRange, type TabKey } from "@/components/front/staff/AuditHistoryPopover"

describe("getDateRange", () => {
  // Fixed date: April 15, 2026 at 12:00:00 UTC
  const FIXED_NOW = new Date("2026-04-15T12:00:00.000Z")

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns undefined dates for 'all-time'", () => {
    const result = getDateRange("all-time")
    expect(result).toEqual({ fromDate: undefined, toDate: undefined })
  })

  it("returns current month range for 'this-month'", () => {
    const result = getDateRange("this-month")
    expect(result.fromDate).toBe("2026-04-01T00:00:00.000Z")
    expect(result.toDate).toBe("2026-04-15T23:59:59.999Z")
  })

  it("returns current quarter range for 'this-quarter' (Q2 starts April)", () => {
    const result = getDateRange("this-quarter")
    // Q2: April, May, June — starts April 1
    expect(result.fromDate).toBe("2026-04-01T00:00:00.000Z")
    expect(result.toDate).toBe("2026-04-15T23:59:59.999Z")
  })

  it("returns current year range for 'this-year'", () => {
    const result = getDateRange("this-year")
    expect(result.fromDate).toBe("2026-01-01T00:00:00.000Z")
    expect(result.toDate).toBe("2026-04-15T23:59:59.999Z")
  })

  it("computes Q1 correctly when date is in February", () => {
    vi.setSystemTime(new Date("2026-02-10T10:00:00.000Z"))
    const result = getDateRange("this-quarter")
    // Q1: January, February, March
    expect(result.fromDate).toBe("2026-01-01T00:00:00.000Z")
    expect(result.toDate).toBe("2026-02-10T23:59:59.999Z")
  })

  it("computes Q3 correctly when date is in July", () => {
    vi.setSystemTime(new Date("2026-07-20T10:00:00.000Z"))
    const result = getDateRange("this-quarter")
    // Q3: July, August, September
    expect(result.fromDate).toBe("2026-07-01T00:00:00.000Z")
    expect(result.toDate).toBe("2026-07-20T23:59:59.999Z")
  })

  it("computes Q4 correctly when date is in November", () => {
    vi.setSystemTime(new Date("2026-11-05T10:00:00.000Z"))
    const result = getDateRange("this-quarter")
    // Q4: October, November, December
    expect(result.fromDate).toBe("2026-10-01T00:00:00.000Z")
    expect(result.toDate).toBe("2026-11-05T23:59:59.999Z")
  })

  it("returns ISO8601 format for all non-all-time tabs", () => {
    const tabs: TabKey[] = ["this-month", "this-quarter", "this-year"]
    for (const tab of tabs) {
      const result = getDateRange(tab)
      expect(result.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(result.toDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    }
  })

  it("sets fromDate at UTC midnight (00:00:00.000)", () => {
    const result = getDateRange("this-month")
    expect(result.fromDate).toMatch(/T00:00:00\.000Z$/)
  })

  it("sets toDate at end of day (23:59:59.999)", () => {
    const result = getDateRange("this-month")
    expect(result.toDate).toMatch(/T23:59:59\.999Z$/)
  })
})
