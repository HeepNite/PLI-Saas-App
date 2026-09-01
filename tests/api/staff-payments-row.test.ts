import { describe, expect, it } from "vitest"

import { buildSpecialEventBySlug } from "@/app/api/staff/payments/payments-loader-auxiliary"
import { buildStaffPaymentResponseRow } from "@/app/api/staff/payments/payments-row"

const purchaseCreatedAt = new Date("2026-02-10T14:00:00.000Z")
const purchaseUpdatedAt = new Date("2026-02-10T14:05:00.000Z")
const classStartsAt = new Date("2026-02-10T23:00:00.000Z")

const baseItem = {
  userId: "user_123",
  metadata: {
    serviceId: "drop-in",
    paymentChannel: "cash",
  } as Record<string, unknown>,
  settlementStatus: "paid",
  settlementNote: null,
  settledAt: null,
  classDate: "2026-02-10",
  classTime: "18:00",
  classStartsAt,
  purchase: {
    id: "purchase_123",
    specialClassId: null,
    packageId: null,
    serviceId: "drop-in",
    courseSlug: "salsa",
    courseTitle: "Salsa",
    status: "paid",
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    amount: 2500,
    currency: "usd",
    createdAt: purchaseCreatedAt,
    updatedAt: purchaseUpdatedAt,
    name: "Purchase Name",
    email: null,
    phone: null,
    metadata: {},
  },
}

const emptyContext = {
  mode: "today" as const,
  clerkNameByUserId: new Map<string, string>(),
  dbNameByUserId: new Map<string, string | null>(),
  dbEmailByUserId: new Map<string, string>(),
  dbPhoneByUserId: new Map<string, string>(),
  avatarByUserId: new Map<string, string>(),
  courseLocationBySlug: new Map<string | null, string | null>(),
  dropInPriceBySlug: new Map<string | null, number>(),
  isSpecialEventBySlug: new Map<string, boolean>(),
  pointsByUser: new Map<string, number>(),
  pointsHistoryByUser: new Map<string, unknown[]>(),
  attendanceById: new Map(),
  todayAttendanceByPurchaseId: new Map(),
  attendanceBySlot: new Map(),
  activePackageByUser: new Map(),
  activePackageClassesUsedById: new Map<string, number>(),
  completedClassesByUser: new Map<string, number>(),
  completedOverrideByUser: new Map<string, number>(),
  packageUsedOverrideByUser: new Map<string, number>(),
  outstandingBalanceByUser: new Map<string, number>(),
  packagePurchaseIdByPurchaseId: new Map<string, string>(),
  packageClassNumberByUsageKey: new Map<string, number>(),
  fundingPurchaseByPackagePurchaseId: new Map<string, unknown>(),
  studentPinByUserId: new Map(),
}

describe("buildStaffPaymentResponseRow", () => {
  it("classifies a canonically linked SpecialClass purchase without a catalog match", () => {
    const row = buildStaffPaymentResponseRow({
      ...baseItem,
      purchase: { ...baseItem.purchase, specialClassId: "special_class_123" },
    }, emptyContext)

    expect(row.isSpecialEvent).toBe(true)
  })

  it("keeps a synthetic attendance-only purchase without SpecialClass linkage non-Special", () => {
    const row = buildStaffPaymentResponseRow({
      ...baseItem,
      purchase: {
        ...baseItem.purchase,
        id: "att-attendance_123",
        amount: 0,
        status: "none",
        specialClassId: undefined,
      },
    }, emptyContext)

    expect(row.isSpecialEvent).toBe(false)
  })

  it("projects only the semantic special-event classification", () => {
    expect(buildStaffPaymentResponseRow(baseItem, {
      ...emptyContext,
      isSpecialEventBySlug: new Map([["salsa", true]]),
    }).isSpecialEvent).toBe(true)
    expect(buildStaffPaymentResponseRow(baseItem, emptyContext).isSpecialEvent).toBe(false)
  })

  it("maps customer, payment and default student state for a visible payment row", () => {
    const row = buildStaffPaymentResponseRow(baseItem, {
      ...emptyContext,
      dbNameByUserId: new Map([["user_123", "Database Name"]]),
      dbEmailByUserId: new Map([["user_123", "db@example.com"]]),
      dbPhoneByUserId: new Map([["user_123", "555-0100"]]),
      pointsByUser: new Map([["user_123", 12]]),
      courseLocationBySlug: new Map([["salsa", "Studio A"]]),
      dropInPriceBySlug: new Map<string | null, number>(),
    })

    expect(row).toMatchObject({
      id: "purchase_123",
      userId: "user_123",
      courseSlug: "salsa",
      courseTitle: "Salsa",
      customerName: "Database Name",
      customerEmail: "db@example.com",
      customerPhone: "555-0100",
      paymentChannel: "cash",
      amount: 2500,
      currency: "usd",
      settlementStatus: "paid",
      location: "Studio A",
      pointsBalance: 12,
      checkInStatus: "none",
      studentPin: {
        enabled: false,
        enrolled: false,
        locked: false,
        needsEnrollment: false,
      },
    })
  })

  it("exposes the course drop-in price as dueAmountCents for unpaid zero-amount rows", () => {
    const row = buildStaffPaymentResponseRow(
      {
        ...baseItem,
        settlementStatus: "pending",
        purchase: { ...baseItem.purchase, amount: 0, status: "pending" },
      },
      {
        ...emptyContext,
        dropInPriceBySlug: new Map<string | null, number>([["salsa", 2000]]),
      }
    )

    expect(row.amount).toBe(0)
    expect(row.dueAmountCents).toBe(2000)
    expect(row.classPaid).toBe(false)
  })

  it("preserves a paid cash settlement despite a separate outstanding balance", () => {
    const row = buildStaffPaymentResponseRow(baseItem, {
      ...emptyContext,
      outstandingBalanceByUser: new Map([["user_123", 25]]),
    })

    expect(row.settlementStatus).toBe("paid")
    expect(row.outstandingBalance).toBe(25)
  })

  it("marks completed card rows as paid without an outstanding balance", () => {
    const row = buildStaffPaymentResponseRow(
      {
        ...baseItem,
        metadata: {
          serviceId: "drop-in",
          paymentChannel: "card",
        },
        settlementStatus: "pending",
      },
      emptyContext
    )

    expect(row.paymentChannel).toBe("card")
    expect(row.settlementStatus).toBe("paid")
  })

  it("does not infer slot attendance for package credit rows without explicit attendance linkage", () => {
    const slotKey = `user_123|salsa|${classStartsAt.getTime()}`
    const row = buildStaffPaymentResponseRow(
      {
        ...baseItem,
        metadata: {
          serviceId: "drop-in",
          paymentChannel: "package_credit",
        },
      },
      {
        ...emptyContext,
        attendanceBySlot: new Map([
          [slotKey, {
            id: "attendance_123",
            status: "checked_in",
            checkedInAt: "2026-02-10T23:00:00.000Z",
            checkedOutAt: null,
            packagePurchaseId: "package_purchase_123",
          }],
        ]),
      }
    )

    expect(row.paymentChannel).toBe("package_credit")
    expect(row.attendanceId).toBeNull()
    expect(row.checkInStatus).toBe("none")
  })

  it("resolves history package class numbers from linked slot attendance", () => {
    const slotKey = `user_123|salsa|${classStartsAt.getTime()}`
    const row = buildStaffPaymentResponseRow(
      {
        ...baseItem,
        metadata: {
          ...baseItem.metadata,
          packagePurchaseId: "package_purchase_123",
        },
      },
      {
        ...emptyContext,
        mode: "history",
        attendanceBySlot: new Map([
          [slotKey, {
            id: "attendance_123",
            status: "checked_in",
            checkedInAt: "2026-02-10T23:00:00.000Z",
            checkedOutAt: null,
            packagePurchaseId: "package_purchase_123",
          }],
        ]),
        packageClassNumberByUsageKey: new Map([["package_purchase_123|attendance_123", 3]]),
      }
    )

    expect(row.attendanceId).toBe("attendance_123")
    expect(row.checkInStatus).toBe("checked_in")
    expect(row.packageClassNumber).toBe(3)
  })
})

describe("buildSpecialEventBySlug", () => {
  it.each([
    [{ mode: "special_event", rules: [] }, true],
    [{ mode: "regular", rules: [] }, false],
    [{ mode: "special_event" }, false],
    [null, false],
  ])("classifies parsed schedule rules and fails closed for %j", (scheduleRules, expected) => {
    expect(buildSpecialEventBySlug([{ slug: "course", scheduleRules }]).get("course")).toBe(expected)
  })
})
