import type { Prisma } from "@prisma/client"

import {
  HISTORY_MODE_TAKE_LIMIT,
  TODAY_MODE_TAKE_LIMIT,
  type StaffPaymentsRequest,
} from "@/app/api/staff/payments/payments-request"

type TodayWindow = {
  todayNY: string
  startOfTodayNY: Date
  endOfTodayNY: Date
}

const buildStaffPaymentsSearchWhere = (query: string): Prisma.PurchaseWhereInput | undefined => {
  if (!query) return undefined

  return {
    OR: [
      { email: { contains: query, mode: "insensitive" as const } },
      { name: { contains: query, mode: "insensitive" as const } },
      { phone: { contains: query, mode: "insensitive" as const } },
      {
        user: {
          is: {
            OR: [
              { email: { contains: query, mode: "insensitive" as const } },
              { name: { contains: query, mode: "insensitive" as const } },
              { phone: { contains: query, mode: "insensitive" as const } },
            ],
          },
        },
      },
      { courseTitle: { contains: query, mode: "insensitive" as const } },
      { courseSlug: { contains: query, mode: "insensitive" as const } },
    ],
  }
}

const buildStaffPaymentsWhere = (
  paymentsRequest: StaffPaymentsRequest,
  todayWindow: TodayWindow
): Prisma.PurchaseWhereInput | undefined => {
  const searchWhere = buildStaffPaymentsSearchWhere(paymentsRequest.query)

  if (paymentsRequest.mode === "userHistory") {
    return {
      userId: paymentsRequest.userHistoryId,
      ...(paymentsRequest.selectedFrom && paymentsRequest.selectedTo
        ? {
            AND: [
              { metadata: { path: ["date"], gte: paymentsRequest.selectedFrom } },
              { metadata: { path: ["date"], lte: paymentsRequest.selectedTo } },
            ],
          }
        : {}),
    }
  }

  if (paymentsRequest.mode === "history") {
    return {
      AND: [
        ...(searchWhere ? [searchWhere] : []),
        { metadata: { path: ["date"], gte: paymentsRequest.historyRange.from } },
        { metadata: { path: ["date"], lte: paymentsRequest.historyRange.to } },
      ],
    }
  }

  return {
    AND: [
      ...(searchWhere ? [searchWhere] : []),
      {
        OR: [
          { createdAt: { gte: todayWindow.startOfTodayNY, lte: todayWindow.endOfTodayNY } },
          { metadata: { path: ["date"], equals: todayWindow.todayNY } },
        ],
      },
    ],
  }
}

const getStaffPaymentsTakeLimit = (paymentsRequest: StaffPaymentsRequest) => {
  if (paymentsRequest.mode === "userHistory") return 100
  if (paymentsRequest.mode === "history") return HISTORY_MODE_TAKE_LIMIT + 1
  return TODAY_MODE_TAKE_LIMIT
}

export const buildStaffPaymentsFindManyArgs = (
  paymentsRequest: StaffPaymentsRequest,
  todayWindow: TodayWindow
): Pick<Prisma.PurchaseFindManyArgs, "where" | "orderBy" | "take"> => ({
  where: buildStaffPaymentsWhere(paymentsRequest, todayWindow),
  orderBy: { createdAt: "desc" },
  take: getStaffPaymentsTakeLimit(paymentsRequest),
})
