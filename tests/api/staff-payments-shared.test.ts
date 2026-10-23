import { describe, expect, it } from "vitest"

import {
  buildLatestOpenPurchaseByUser,
  buildOutstandingBalanceByUser,
  buildVerifyBalanceByUser,
  isVerifyCardAttempt,
  isUnchargedCardAttempt,
  readVerifyResolution,
  resolveVerifyReason,
  isCompletedPaymentStatus,
  isOpenPurchase,
  isRefundedCardPurchase,
  isTerminalUnpaidCardAttempt,
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

  it("prefers a fresh unused package over an exhausted one that was used more recently", () => {
    const selected = selectActivePackagesByUser([
      {
        userId: "user_1",
        packageId: "pkg_exhausted",
        packageLabel: "Exhausted",
        remainingCredits: 0,
        isUnlimited: false,
        expiresAt: null,
        lastUsedAt: new Date("2026-04-05T10:00:00.000Z"),
        purchasedAt: new Date("2026-03-01T10:00:00.000Z"),
        status: "active",
      },
      {
        userId: "user_1",
        packageId: "pkg_fresh",
        packageLabel: "Fresh 8/8",
        remainingCredits: 8,
        isUnlimited: false,
        expiresAt: null,
        lastUsedAt: null,
        purchasedAt: new Date("2026-04-01T10:00:00.000Z"),
        status: "active",
      },
    ])

    expect(selected.get("user_1")?.packageId).toBe("pkg_fresh")
  })

  it("treats an unlimited package as usable even with no remainingCredits value", () => {
    const selected = selectActivePackagesByUser([
      {
        userId: "user_1",
        packageId: "pkg_exhausted",
        packageLabel: "Exhausted",
        remainingCredits: 0,
        isUnlimited: false,
        expiresAt: null,
        lastUsedAt: new Date("2026-04-05T10:00:00.000Z"),
        purchasedAt: new Date("2026-03-01T10:00:00.000Z"),
        status: "active",
      },
      {
        userId: "user_1",
        packageId: "pkg_unlimited",
        packageLabel: "Unlimited",
        remainingCredits: null,
        isUnlimited: true,
        expiresAt: null,
        lastUsedAt: null,
        purchasedAt: new Date("2026-03-20T10:00:00.000Z"),
        status: "active",
      },
    ])

    expect(selected.get("user_1")?.packageId).toBe("pkg_unlimited")
  })

  it("reduces outstanding balance from open purchases only", () => {
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

    // The failed card row (1800) is a verify attempt, not debt (owner decision D2).
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

  it.each(["expired", "failed", "cancelled", "canceled"])(
    "treats a never-completed card status %s as open outstanding debt",
    (status) => {
      expect(isOpenPurchase({
        userId: "u1",
        amount: 1000,
        metadata: { paymentChannel: "card", settlementStatus: "pending" },
        status,
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: "cs_terminal",
      }).isOpen).toBe(true)
    }
  )

  it("treats a refunded card purchase as closed", () => {
    expect(isOpenPurchase({
      userId: "u1",
      amount: 1000,
      metadata: { paymentChannel: "card", settlementStatus: "pending" },
      status: "refunded",
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: "cs_terminal",
    }).isOpen).toBe(false)
  })

  it.each(["expired", "failed", "cancelled", "canceled"])(
    "flags a never-completed card attempt with status %s as terminal but keeps it open as outstanding debt",
    (status) => {
      const purchase = {
        userId: "u1",
        amount: 1000,
        metadata: { paymentChannel: "card", settlementStatus: "pending" },
        status,
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: "cs_never_completed",
      }

      expect(isTerminalUnpaidCardAttempt(purchase)).toBe(true)
      expect(isOpenPurchase(purchase).isOpen).toBe(true)
    }
  )

  it("does not classify a refunded card purchase as a terminal unpaid attempt, but marks it refunded and closed", () => {
    const purchase = {
      userId: "u1",
      amount: 1000,
      metadata: { paymentChannel: "card", settlementStatus: "pending" },
      status: "refunded",
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: "cs_refunded",
    }

    expect(isTerminalUnpaidCardAttempt(purchase)).toBe(false)
    expect(isRefundedCardPurchase(purchase)).toBe(true)
    expect(isOpenPurchase(purchase).isOpen).toBe(false)
  })

  it("does not flag a cash purchase with status expired as a terminal card attempt, keeping it open", () => {
    const purchase = {
      userId: "u1",
      amount: 1000,
      metadata: { paymentChannel: "cash", settlementStatus: "pending" },
      status: "expired",
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
    }

    expect(isTerminalUnpaidCardAttempt(purchase)).toBe(false)
    expect(isOpenPurchase(purchase).isOpen).toBe(true)
  })

  it("does not flag a card purchase already settled as paid, even with a never-completed status", () => {
    const purchase = {
      userId: "u1",
      amount: 1000,
      metadata: { paymentChannel: "card", settlementStatus: "paid" },
      status: "expired",
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: "cs_already_paid",
    }

    expect(isTerminalUnpaidCardAttempt(purchase)).toBe(false)
  })

  it("excludes refunded card rows from outstanding balance", () => {
    const balances = buildOutstandingBalanceByUser([
      {
        userId: "user_refunded",
        amount: 4500,
        metadata: { paymentChannel: "card", settlementStatus: "pending" },
        status: "refunded",
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: "cs_refunded_balance",
      },
    ])

    expect(balances.get("user_refunded")).toBeUndefined()
  })

  const cardAttempt = (userId: string, status: string, extra: Record<string, unknown> = {}) => ({
    userId, amount: 2500, courseSlug: "salsa-beginners",
    metadata: { date: "2026-03-20", paymentChannel: "card", settlementStatus: "pending", ...extra },
    status, stripePaymentIntentId: null, stripeCheckoutSessionId: `cs_${userId}`,
  })
  const nativeAttempt = (userId: string, status: string, stripePaymentIntentId: string | null, extra: Record<string, unknown> = {}) => ({
    userId, amount: 100, metadata: { paymentSurface: "native_m2_prepare", ...extra }, status, stripePaymentIntentId, stripeCheckoutSessionId: null,
  })
  const pendingCash = (userId: string) => ({
    userId, amount: 3100, metadata: { paymentChannel: "cash", settlementStatus: "pending" }, status: "pending",
    stripePaymentIntentId: null, stripeCheckoutSessionId: null,
  })

  // Owner decisions D1/D2 (2026-10-23): a card process that did not charge is a visible
  // "Verify" item, never outstanding debt. Only pending cash is debt.
  it.each(["expired", "failed", "cancelled", "canceled"])("treats a %s card attempt as verify, not outstanding balance", (status) => {
    const attempt = cardAttempt("user_card", status)
    expect(isVerifyCardAttempt(attempt)).toBe(true)
    expect(buildOutstandingBalanceByUser([attempt]).get("user_card")).toBeUndefined()
    expect(buildVerifyBalanceByUser([attempt]).get("user_card")).toBe(2500)
  })

  it("treats every uncharged native M2 preparation as verify, with or without a PaymentIntent", () => {
    const attempts = [
      nativeAttempt("user_native_prepared", "pending", null),
      nativeAttempt("user_native_started", "pending", "pi_started"),
      nativeAttempt("user_native_declined", "failed", "pi_declined", { stripeFailure: { eventType: "payment_intent.payment_failed", occurredAt: "2026-03-20T15:00:00.000Z" } }),
      nativeAttempt("user_native_canceled", "canceled", "pi_canceled"),
    ]

    const balances = buildOutstandingBalanceByUser(attempts)
    const verify = buildVerifyBalanceByUser(attempts)
    for (const attempt of attempts) {
      expect(isVerifyCardAttempt(attempt)).toBe(true)
      expect(balances.get(attempt.userId)).toBeUndefined()
      expect(verify.get(attempt.userId)).toBe(100)
    }
  })

  it("never treats pending cash, paid, settled, or refunded purchases as verify", () => {
    const notVerify = [
      pendingCash("user_cash"),
      { ...cardAttempt("user_paid", "paid"), metadata: { paymentChannel: "card", settlementStatus: "paid" } },
      cardAttempt("user_settled", "expired", { settlementStatus: "paid" }),
      cardAttempt("user_refunded", "refunded"),
      nativeAttempt("user_native_paid", "paid", "pi_paid"),
    ]
    for (const purchase of notVerify) expect(isVerifyCardAttempt(purchase)).toBe(false)
    expect(buildVerifyBalanceByUser(notVerify).size).toBe(0)
    expect(buildOutstandingBalanceByUser(notVerify).get("user_cash")).toBe(3100)
  })

  it("keeps pending cash as debt next to a verify attempt for the same student", () => {
    const purchases = [{ ...pendingCash("user_mixed") }, cardAttempt("user_mixed", "failed")]
    expect(buildOutstandingBalanceByUser(purchases).get("user_mixed")).toBe(3100)
    expect(buildVerifyBalanceByUser(purchases).get("user_mixed")).toBe(2500)
  })

  it("never selects a verify attempt as the latest open purchase", () => {
    const latest = buildLatestOpenPurchaseByUser([
      { ...pendingCash("user_latest"), id: "cash_older", createdAt: "2026-03-20T10:00:00.000Z" },
      { ...cardAttempt("user_latest", "failed"), id: "card_newer", createdAt: "2026-03-20T12:00:00.000Z" },
      { ...cardAttempt("user_only_verify", "expired"), id: "card_only", createdAt: "2026-03-20T12:00:00.000Z" },
    ])
    expect(latest.get("user_latest")?.id).toBe("cash_older")
    expect(latest.has("user_only_verify")).toBe(false)
  })

  it.each([
    ["card_declined", cardAttempt("u", "failed", { stripeFailure: { eventType: "payment_intent.payment_failed", occurredAt: "x", error: { code: "card_declined", declineCode: "insufficient_funds" } } })],
    ["payment_failed", cardAttempt("u", "failed", { stripeFailure: { eventType: "checkout.session.async_payment_failed", occurredAt: "x" } })],
    ["payment_failed", cardAttempt("u", "failed")],
    ["checkout_expired", cardAttempt("u", "expired")],
    ["cancelled", cardAttempt("u", "cancelled")],
    ["cancelled", nativeAttempt("u", "canceled", "pi_1", { stripeFailure: { eventType: "payment_intent.canceled", occurredAt: "x" } })],
    ["in_progress", nativeAttempt("u", "pending", null)],
    ["in_progress", nativeAttempt("u", "pending", "pi_1")],
    ["in_progress", cardAttempt("u", "pending")],
    ["card_declined", nativeAttempt("u", "pending", "pi_1", { stripeFailure: { eventType: "payment_intent.payment_failed", occurredAt: "x", error: { code: "card_declined" } } })],
    ["attempt_no_charge", nativeAttempt("u", "pending", "pi_1", { attemptOutcome: { code: "reader_timeout" } })],
    ["cancelled", nativeAttempt("u", "pending", "pi_1", { attemptOutcome: { code: "cancelled_by_customer" } })],
  ])("labels the verify reason as %s", (reason, purchase) => {
    expect(resolveVerifyReason(purchase)).toBe(reason)
  })

  // D5 extension (owner, 2026-10-23): a card process still in progress is Verify, never Pending or debt.
  it("treats an open card checkout still in progress as verify, and a later success leaves verify", () => {
    const inProgress = cardAttempt("user_open_checkout", "pending")
    expect(isVerifyCardAttempt(inProgress)).toBe(true)
    expect(resolveVerifyReason(inProgress)).toBe("in_progress")
    expect(buildOutstandingBalanceByUser([inProgress]).size).toBe(0)
    expect(buildVerifyBalanceByUser([inProgress]).get("user_open_checkout")).toBe(2500)

    const succeeded = { ...inProgress, status: "paid" }
    expect(isVerifyCardAttempt(succeeded)).toBe(false)
    expect(buildVerifyBalanceByUser([succeeded]).size).toBe(0)
  })

  // D4 (owner, 2026-10-23): verify items leave the state only by a manual staff resolution.
  it("takes a dismissed attempt out of verify without turning it into debt", () => {
    const dismissed = cardAttempt("user_dismissed", "failed", {
      verifyResolution: { action: "dismissed", by: "staff_1", byName: "Elvira", at: "2026-10-23T12:00:00.000Z", reason: "Class not taken" },
    })
    expect(isUnchargedCardAttempt(dismissed)).toBe(true)
    expect(isVerifyCardAttempt(dismissed)).toBe(false)
    expect(resolveVerifyReason(dismissed)).toBeNull()
    expect(buildVerifyBalanceByUser([dismissed]).size).toBe(0)
    expect(buildOutstandingBalanceByUser([dismissed]).size).toBe(0)
    expect(buildLatestOpenPurchaseByUser([{ ...dismissed, id: "d", createdAt: "2026-10-23T12:00:00.000Z" }]).size).toBe(0)
  })

  it("never auto-resolves: an unresolved attempt stays verify regardless of other paid purchases", () => {
    const attempt = cardAttempt("user_retry", "failed")
    const paidLater = { ...cardAttempt("user_retry", "paid"), metadata: { paymentChannel: "card", settlementStatus: "paid" } }
    expect(buildVerifyBalanceByUser([attempt, paidLater]).get("user_retry")).toBe(2500)
  })

  it("reads only well-formed verify resolutions", () => {
    expect(readVerifyResolution({ verifyResolution: { action: "collected", by: "staff_1", byName: "Elvira", at: "2026-10-23T12:00:00.000Z", reason: "", extra: "x" } }))
      .toEqual({ action: "collected", by: "staff_1", byName: "Elvira", at: "2026-10-23T12:00:00.000Z", reason: null })
    expect(readVerifyResolution({ verifyResolution: { action: "other", by: "s", at: "x" } })).toBeNull()
    expect(readVerifyResolution({ verifyResolution: { action: "dismissed", at: "x" } })).toBeNull()
    expect(readVerifyResolution(null)).toBeNull()
  })

  it("has no verify reason for purchases outside the verify state", () => {
    expect(resolveVerifyReason(pendingCash("u"))).toBeNull()
  })

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
