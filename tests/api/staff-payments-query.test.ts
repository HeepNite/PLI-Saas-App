import { describe, expect, it } from "vitest"

import { HISTORY_MODE_TAKE_LIMIT, TODAY_MODE_TAKE_LIMIT, type StaffPaymentsRequest } from "@/app/api/staff/payments/payments-request"
import { buildStaffPaymentsFindManyArgs } from "@/app/api/staff/payments/payments-query"

type TodayRequest = Extract<StaffPaymentsRequest, { mode: "today" }>
type HistoryRequest = Extract<StaffPaymentsRequest, { mode: "history" }>
type UserHistoryRequest = Extract<StaffPaymentsRequest, { mode: "userHistory" }>

const todayWindow = {
  startOfTodayNY: new Date("2026-02-10T05:00:00.000Z"),
  endOfTodayNY: new Date("2026-02-11T04:59:59.999Z"),
}

const todayRequest = (overrides: Partial<Omit<TodayRequest, "ok" | "mode" | "userHistoryId">> = {}): TodayRequest => ({
  ok: true,
  mode: "today",
  query: "",
  settlementFilter: "all",
  userHistoryId: "",
  selectedFrom: "",
  selectedTo: "",
  selectedClass: "",
  ...overrides,
})

const historyRequest = (overrides: Partial<Omit<HistoryRequest, "ok" | "mode" | "userHistoryId">> = {}): HistoryRequest => ({
  ok: true,
  mode: "history",
  query: "",
  settlementFilter: "all",
  userHistoryId: "",
  selectedFrom: "2026-02-01",
  selectedTo: "2026-02-28",
  selectedClass: "",
  historyRange: {
    from: "2026-02-01",
    to: "2026-02-28",
  },
  ...overrides,
})

const userHistoryRequest = (overrides: Partial<Omit<UserHistoryRequest, "ok" | "mode">> = {}): UserHistoryRequest => ({
  ok: true,
  mode: "userHistory",
  query: "",
  settlementFilter: "all",
  userHistoryId: "user_123",
  selectedFrom: "",
  selectedTo: "",
  selectedClass: "",
  ...overrides,
})

describe("buildStaffPaymentsFindManyArgs", () => {
  it("scopes today mode purchases to the NY today window", () => {
    expect(buildStaffPaymentsFindManyArgs(todayRequest(), todayWindow)).toEqual({
      where: {
        AND: [
          { createdAt: { gte: todayWindow.startOfTodayNY, lte: todayWindow.endOfTodayNY } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: TODAY_MODE_TAKE_LIMIT,
    })
  })

  it("adds text search conditions to today mode without changing date scoping", () => {
    const args = buildStaffPaymentsFindManyArgs(todayRequest({ query: "ana" }), todayWindow)

    expect(args.where).toMatchObject({
      AND: [
        {
          OR: [
            { email: { contains: "ana", mode: "insensitive" } },
            { name: { contains: "ana", mode: "insensitive" } },
            { phone: { contains: "ana", mode: "insensitive" } },
            {
              user: {
                is: {
                  OR: [
                    { email: { contains: "ana", mode: "insensitive" } },
                    { name: { contains: "ana", mode: "insensitive" } },
                    { phone: { contains: "ana", mode: "insensitive" } },
                  ],
                },
              },
            },
            { courseTitle: { contains: "ana", mode: "insensitive" } },
            { courseSlug: { contains: "ana", mode: "insensitive" } },
          ],
        },
        { createdAt: { gte: todayWindow.startOfTodayNY, lte: todayWindow.endOfTodayNY } },
      ],
    })
  })

  it("scopes history mode to metadata date range and fetches one extra row for truncation", () => {
    expect(buildStaffPaymentsFindManyArgs(historyRequest({ query: "bachata" }), todayWindow)).toMatchObject({
      where: {
        AND: [
          expect.objectContaining({ OR: expect.any(Array) }),
          { metadata: { path: ["date"], gte: "2026-02-01" } },
          { metadata: { path: ["date"], lte: "2026-02-28" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: HISTORY_MODE_TAKE_LIMIT + 1,
    })
  })

  it("scopes user history mode to the user and optional selected date range", () => {
    expect(buildStaffPaymentsFindManyArgs(userHistoryRequest({ selectedFrom: "2026-03-01", selectedTo: "2026-03-31" }), todayWindow)).toEqual({
      where: {
        userId: "user_123",
        AND: [
          { metadata: { path: ["date"], gte: "2026-03-01" } },
          { metadata: { path: ["date"], lte: "2026-03-31" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  })
})
