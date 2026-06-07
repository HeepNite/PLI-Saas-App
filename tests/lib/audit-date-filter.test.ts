import { describe, it, expect } from "vitest"
import { parseAuditDate, buildDateWhereClause } from "@/lib/audit-date-filter"

describe("parseAuditDate", () => {
  it("returns a valid Date for ISO8601 string", () => {
    const result = parseAuditDate("2026-04-01T00:00:00.000Z")
    expect(result).toEqual({ ok: true, date: new Date("2026-04-01T00:00:00.000Z") })
  })

  it("returns a valid Date for YYYY-MM-DD string (normalized to UTC midnight)", () => {
    const result = parseAuditDate("2026-04-01")
    expect(result).toEqual({ ok: true, date: new Date("2026-04-01T00:00:00.000Z") })
  })

  it("returns error for invalid date string", () => {
    const result = parseAuditDate("not-a-date")
    expect(result).toEqual({ ok: false, error: "Invalid date format. Use ISO8601 (e.g. 2026-04-01 or 2026-04-01T00:00:00.000Z)." })
  })

  it("returns error for empty string", () => {
    const result = parseAuditDate("")
    expect(result).toEqual({ ok: false, error: "Invalid date format. Use ISO8601 (e.g. 2026-04-01 or 2026-04-01T00:00:00.000Z)." })
  })
})

describe("buildDateWhereClause", () => {
  it("returns empty object when no dates provided", () => {
    const result = buildDateWhereClause(undefined, undefined)
    expect(result).toEqual({})
  })

  it("returns gte clause when only fromDate provided", () => {
    const result = buildDateWhereClause("2026-04-01T00:00:00.000Z", undefined)
    expect(result).toEqual({
      createdAt: { gte: new Date("2026-04-01T00:00:00.000Z") },
    })
  })

  it("returns lte clause when only toDate provided", () => {
    const result = buildDateWhereClause(undefined, "2026-04-30T23:59:59.999Z")
    expect(result).toEqual({
      createdAt: { lte: new Date("2026-04-30T23:59:59.999Z") },
    })
  })

  it("returns both gte and lte when both dates provided", () => {
    const result = buildDateWhereClause("2026-04-01", "2026-04-30")
    expect(result).toEqual({
      createdAt: {
        gte: new Date("2026-04-01T00:00:00.000Z"),
        lte: new Date("2026-04-30T00:00:00.000Z"),
      },
    })
  })

  it("returns error when fromDate is after toDate", () => {
    const result = buildDateWhereClause("2026-05-01", "2026-04-01")
    expect(result).toEqual({ ok: false, error: "'fromDate' must be on or before 'toDate'." })
  })

  it("returns error when fromDate is invalid", () => {
    const result = buildDateWhereClause("not-a-date", "2026-04-30")
    expect(result).toEqual({ ok: false, error: "Invalid date format. Use ISO8601 (e.g. 2026-04-01 or 2026-04-01T00:00:00.000Z)." })
  })

  it("returns error when toDate is invalid", () => {
    const result = buildDateWhereClause("2026-04-01", "not-a-date")
    expect(result).toEqual({ ok: false, error: "Invalid date format. Use ISO8601 (e.g. 2026-04-01 or 2026-04-01T00:00:00.000Z)." })
  })
})
