import { describe, expect, it } from "vitest"

import { parseStaffPaymentsRequest } from "@/app/api/staff/payments/payments-request"

const parse = (query = "") => parseStaffPaymentsRequest(new Request(`http://localhost/api/staff/payments${query}`))

describe("parseStaffPaymentsRequest", () => {
  it("defaults to today mode", () => {
    expect(parse()).toMatchObject({
      ok: true,
      mode: "today",
      query: "",
      settlementFilter: "all",
      userHistoryId: "",
    })
  })

  it("parses valid history mode ranges", () => {
    expect(parse("?mode=history&from=2026-02-01&to=2026-02-28&class=salsa")).toMatchObject({
      ok: true,
      mode: "history",
      selectedClass: "salsa",
      historyRange: {
        from: "2026-02-01",
        to: "2026-02-28",
      },
    })
  })

  it("rejects history mode without from/to or date", () => {
    expect(parse("?mode=history")).toEqual({
      ok: false,
      error: "History mode requires both from and to dates.",
      status: 400,
    })
  })

  it("rejects invalid history range date formats", () => {
    expect(parse("?mode=history&from=02-01-2026&to=2026-02-28")).toEqual({
      ok: false,
      error: "History mode requires valid YYYY-MM-DD from/to dates.",
      status: 400,
    })
  })

  it("rejects history ranges where from is after to", () => {
    expect(parse("?mode=history&from=2026-03-01&to=2026-02-28")).toEqual({
      ok: false,
      error: "History mode requires from to be on or before to.",
      status: 400,
    })
  })

  it("parses user history mode when userId is present", () => {
    expect(parse("?userId=user_123&from=2026-02-01&to=2026-02-28&q=ana")).toMatchObject({
      ok: true,
      mode: "userHistory",
      userHistoryId: "user_123",
      selectedFrom: "2026-02-01",
      selectedTo: "2026-02-28",
      query: "ana",
    })
  })
})
