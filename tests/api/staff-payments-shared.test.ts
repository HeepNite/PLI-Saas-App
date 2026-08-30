import { describe, expect, it } from "vitest"

import {
  buildOutstandingBalanceByUser,
  isCompletedPaymentStatus,
  isOpenPurchase,
  normalizePaymentChannel,
  normalizePurchaseSource,
  selectActivePackagesByUser,
  selectTodayCheckInByUser,
} from "@/app/api/staff/payments/shared"

describe("staff payments shared helpers", () => {
  it("detects completed payment statuses consistently", () => {
    expect(isCompletedPaymentStatus("paid")).toBe(true)
    expect(isCompletedPaymentStatus("Succeeded")).toBe(true)
    expect(isCompletedPaymentStatus("completed")).toBe(true)
    expect(isCompletedPaymentStatus("failed")).toBe(false)
  })

  it("selects the active package by latest use then purchase date", () => {
    const selected = selectActivePackagesByUser([
      {
        userId: "user_1",
        packageId: "pkg_old",
        packageLabel: "Old",
        remainingCredits: 2,
        isUnlimited: false,
        expiresAt: null,
        lastUsedAt: new Date("2026-04-01T10:00:00.000Z"),
        purchasedAt: new Date("2026-03-01T10:00:00.000Z"),
        status: "active",
      },
      {
        userId: "user_1",
        packageId: "pkg_new",
        packageLabel: "New",
        remainingCredits: 5,
        isUnlimited: false,
        expiresAt: null,
        lastUsedAt: new Date("2026-04-03T10:00:00.000Z"),
        purchasedAt: new Date("2026-03-15T10:00:00.000Z"),
        status: "active",
      },
    ])

    expect(selected.get("user_1")?.packageId).toBe("pkg_new")
  })

  it("reduces outstanding balance from genuine open obligations only", () => {
    const balances = buildOutstandingBalanceByUser([
      {
        userId: "user_1",
        amount: 2500,
        metadata: { paymentChannel: "card" },
        status: "paid",
        stripePaymentIntentId: "pi_1",
        stripeCheckoutSessionId: null,
      },
      {
        userId: "user_1",
        amount: 3100,
        metadata: { paymentChannel: "cash", settlementStatus: "pending" },
        status: "paid",
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
      {
        userId: "user_1",
        amount: 1800,
        metadata: { paymentChannel: "card" },
        status: "failed",
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
    ])

    expect(balances.get("user_1")).toBe(3100)
  })

  it("excludes settled cash purchases from outstanding balance", () => {
    // Before settlement: cash purchase with status "pending" is open
    const beforeSettlement = buildOutstandingBalanceByUser([
      {
        userId: "user_1",
        amount: 5000,
        metadata: { paymentChannel: "cash", settlementStatus: "pending" },
        status: "pending",
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
    ])
    expect(beforeSettlement.get("user_1")).toBe(5000)

    // After settlement: cash purchase with status "paid" and settlementStatus "paid" is closed
    const afterSettlement = buildOutstandingBalanceByUser([
      {
        userId: "user_1",
        amount: 5000,
        metadata: { paymentChannel: "cash", settlementStatus: "paid", settledAt: "2026-04-13T12:00:00Z" },
        status: "paid",
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
    ])
    expect(afterSettlement.get("user_1")).toBeUndefined()
  })

  it("excludes settled purchases from outstanding balance regardless of payment channel", () => {
    // A purchase with no paymentChannel metadata and no stripe IDs
    // normalizePaymentChannel returns "unknown" when status is "pending"
    // After settlement, settlementStatus is "paid" so purchase should be closed
    const afterSettlement = buildOutstandingBalanceByUser([
      {
        userId: "user_1",
        amount: 3000,
        metadata: { settlementStatus: "paid" },
        status: "pending",
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
    ])
    expect(afterSettlement.get("user_1")).toBeUndefined()
  })

  it("settles purchases with any payment channel when settlementStatus is paid", () => {
    // Cash purchase with settlement paid → closed
    expect(isOpenPurchase({
      userId: "u1", amount: 1000,
      metadata: { paymentChannel: "cash", settlementStatus: "paid" },
      status: "paid", stripePaymentIntentId: null, stripeCheckoutSessionId: null,
    }).isOpen).toBe(false)

    // Cash purchase with settlement pending → open
    expect(isOpenPurchase({
      userId: "u1", amount: 1000,
      metadata: { paymentChannel: "cash", settlementStatus: "pending" },
      status: "pending", stripePaymentIntentId: null, stripeCheckoutSessionId: null,
    }).isOpen).toBe(true)

    // Unknown channel purchase with settlement paid → closed (the fix)
    expect(isOpenPurchase({
      userId: "u1", amount: 1000,
      metadata: { settlementStatus: "paid" },
      status: "pending", stripePaymentIntentId: null, stripeCheckoutSessionId: null,
    }).isOpen).toBe(false)

    // Unknown channel purchase with settlement pending → open
    expect(isOpenPurchase({
      userId: "u1", amount: 1000,
      metadata: { settlementStatus: "pending" },
      status: "pending", stripePaymentIntentId: null, stripeCheckoutSessionId: null,
    }).isOpen).toBe(true)

    // Card purchase already succeeded → closed regardless of settlement
    expect(isOpenPurchase({
      userId: "u1", amount: 1000,
      metadata: { paymentChannel: "card", settlementStatus: "pending" },
      status: "succeeded", stripePaymentIntentId: "pi_1", stripeCheckoutSessionId: null,
    }).isOpen).toBe(false)
  })

  it.each(["expired", "failed", "cancelled", "canceled", "refunded"])(
    "treats terminal unpaid card status %s as closed",
    (status) => {
      expect(isOpenPurchase({
        userId: "u1",
        amount: 1000,
        metadata: { paymentChannel: "card", settlementStatus: "pending" },
        status,
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: "cs_terminal",
      }).isOpen).toBe(false)
    }
  )

  it("classifies inconsistent stripe+cash metadata rows as card", () => {
    expect(
      normalizePaymentChannel({
        metadata: { paymentMethod: "cash" },
        status: "pending",
        stripePaymentIntentId: "pi_inconsistent",
        stripeCheckoutSessionId: null,
      })
    ).toBe("card")
  })

  it("normalizes staff-created student purchases as front desk source", () => {
    expect(normalizePurchaseSource({ source: "staff_created_student" })).toBe("front_desk")
  })

  it("normalizes explicit admin purchaseSource metadata as admin source", () => {
    expect(normalizePurchaseSource({ purchaseSource: "admin", source: "cash_checkout" })).toBe("admin")
  })

  it("prefers active today check-ins over later lower-priority rows", () => {
    const selected = selectTodayCheckInByUser([
      {
        userId: "user_1",
        status: "checked_out",
        startsAt: "2026-04-04T19:00:00.000Z",
        purchaseCreatedAt: "2026-04-04T18:00:00.000Z",
      },
      {
        userId: "user_1",
        status: "checked_in",
        startsAt: "2026-04-04T18:00:00.000Z",
        purchaseCreatedAt: "2026-04-04T17:00:00.000Z",
      },
    ])

    expect(selected.get("user_1")?.status).toBe("checked_in")
  })
})
