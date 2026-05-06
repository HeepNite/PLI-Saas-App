import { describe, expect, it } from "vitest"
import {
  buildHistoryStudentCard,
  buildHistoryStudentCards,
  buildHistoryStudentPaidEntries,
  isHistoryAttendanceMatch,
  resolveCardContext,
  resolveHistoryStudentCardAmountPaidCents,
  resolveCardVariant,
  CARD_VARIANT_CONFIGS,
  type HistoryCardPaymentLike,
} from "@/components/front/staff/historyCardAggregates"

const buildPayment = (overrides: Partial<HistoryCardPaymentLike> = {}): HistoryCardPaymentLike => ({
  id: overrides.id || "payment_1",
  userId: overrides.userId || "user_1",
  customerEmail: overrides.customerEmail || "student@example.com",
  courseSlug: overrides.courseSlug || "salsa-beginners",
  courseTitle: overrides.courseTitle || "Salsa Beginners",
  paymentChannel: overrides.paymentChannel || "card",
  purchaseCategory: overrides.purchaseCategory || "dropin",
  amount: overrides.amount ?? 1800,
  currency: overrides.currency || "usd",
  classPaid: overrides.classPaid ?? true,
  createdAt: overrides.createdAt || "2026-03-20T18:00:00.000Z",
  classDate: overrides.classDate ?? "2026-03-20",
  classTime: overrides.classTime ?? "18:00",
  classStartsAt: overrides.classStartsAt ?? "2026-03-20T18:00:00.000Z",
  attendanceId: overrides.attendanceId ?? null,
  checkInStatus: overrides.checkInStatus || "none",
  checkInAt: overrides.checkInAt ?? null,
  checkedOutAt: overrides.checkedOutAt ?? null,
  packageClassNumber: overrides.packageClassNumber ?? null,
  fundingPayment: overrides.fundingPayment ?? null,
  completedClassesTotal: overrides.completedClassesTotal,
  packageClassesUsedTotal: overrides.packageClassesUsedTotal,
})

describe("historyCardAggregates", () => {
  it("builds one student card per user with paid totals and latest attendance semantics", () => {
    const cards = buildHistoryStudentCards([
      buildPayment({
        id: "payment_older",
        createdAt: "2026-03-18T18:00:00.000Z",
        amount: 1200,
        classPaid: true,
        paymentChannel: "cash",
      }),
      buildPayment({
        id: "payment_latest",
        createdAt: "2026-03-20T20:00:00.000Z",
        amount: 1800,
        classPaid: false,
        paymentChannel: "card",
        checkInStatus: "checked_out",
        attendanceId: "attendance_1",
        checkInAt: "2026-03-20T20:01:00.000Z",
        checkedOutAt: "2026-03-20T21:05:00.000Z",
      }),
      buildPayment({
        id: "payment_other_student",
        userId: "user_2",
        customerEmail: "other@example.com",
        createdAt: "2026-03-19T20:00:00.000Z",
        amount: 900,
      }),
    ])

    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatchObject({
      key: "user_1",
      totalPayments: 2,
      totalCollectedCents: 1200,
      paidPayments: 1,
      checkedInPayments: 1,
      coursesPurchasedCount: 1,
    })
    expect(cards[0]?.latestPayment.id).toBe("payment_latest")
    expect(cards[0]?.latestAttendedPayment?.id).toBe("payment_latest")
    expect(cards[0]?.allPayments.map((payment) => payment.id)).toEqual(["payment_latest", "payment_older"])
  })

  it("keeps day-level cards driven by already-scoped API rows", () => {
    const now = new Date()
    const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 18, 0, 0))
    const previousMonthIso = previousMonthDate.toISOString()
    const previousMonthClassDate = previousMonthIso.slice(0, 10)

    const cards = buildHistoryStudentCards(
      [
        buildPayment({
          id: "payment_april",
          userId: "user_april",
          customerEmail: "april@example.com",
          createdAt: previousMonthIso,
          classDate: previousMonthClassDate,
        }),
      ],
      { mode: "daily" }
    )

    expect(cards).toHaveLength(1)
    expect(cards[0]?.latestPayment.id).toBe("payment_april")
  })

  it("builds a history student card from a date-scoped payment even when classTime is missing", () => {
    const cards = buildHistoryStudentCards(
      [
        buildPayment({
          id: "history_date_only_payment",
          userId: "user_date_only",
          customerEmail: "date-only@example.com",
          classDate: "2026-03-18",
          classTime: null,
          classStartsAt: null,
          createdAt: "2026-03-18T18:00:00.000Z",
        }),
      ],
      { mode: "history" }
    )

    expect(cards).toHaveLength(1)
    expect(cards[0]?.key).toBe("user_date_only")
    expect(cards[0]?.latestPayment.id).toBe("history_date_only_payment")
  })

  it("counts package classes consumed by unique attendance within the range", () => {
    const card = buildHistoryStudentCard([
      buildPayment({
        id: "package_payment_1",
        purchaseCategory: "package",
        attendanceId: "attendance_1",
        checkInStatus: "checked_out",
        packageClassNumber: 3,
      }),
      buildPayment({
        id: "package_payment_duplicate",
        purchaseCategory: "package",
        attendanceId: "attendance_1",
        checkInStatus: "checked_out",
        packageClassNumber: 3,
        createdAt: "2026-03-20T18:10:00.000Z",
      }),
      buildPayment({
        id: "package_payment_2",
        purchaseCategory: "package",
        attendanceId: "attendance_2",
        checkInStatus: "checked_in",
        packageClassNumber: 4,
        createdAt: "2026-03-21T18:00:00.000Z",
      }),
    ])

    expect(card).not.toBeNull()
    expect(card?.totalPackageClassesConsumed).toBe(2)
    expect(card?.checkedInPayments).toBe(3)
  })

  it("uses payload totals for history metrics when server provides authoritative totals", () => {
    const card = buildHistoryStudentCard(
      [
        buildPayment({
          id: "history_attended_1",
          checkInStatus: "checked_out",
          attendanceId: "attendance_1",
          packageClassNumber: 2,
          completedClassesTotal: 3,
          packageClassesUsedTotal: 3,
        }),
        buildPayment({
          id: "history_attended_2",
          checkInStatus: "checked_in",
          attendanceId: "attendance_2",
          packageClassNumber: 3,
          createdAt: "2026-03-21T18:00:00.000Z",
          completedClassesTotal: 3,
          packageClassesUsedTotal: 3,
        }),
      ],
      undefined,
      { mode: "history" }
    )

    expect(card).not.toBeNull()
    expect(card?.checkedInPayments).toBe(3)
    expect(card?.totalPackageClassesConsumed).toBe(3)
  })

  it("uses only visible attended rows for daily metrics even when API totals are inflated", () => {
    const card = buildHistoryStudentCard(
      [
        buildPayment({
          id: "daily_attended_visible",
          checkInStatus: "checked_out",
          attendanceId: "attendance_today",
          packageClassNumber: 1,
          completedClassesTotal: 3,
          packageClassesUsedTotal: 6,
        }),
      ],
      undefined,
      { mode: "daily" }
    )

    expect(card).not.toBeNull()
    expect(card?.checkedInPayments).toBe(1)
    expect(card?.totalPackageClassesConsumed).toBe(1)
  })

  it("deduplicates package funding payments when resolving paid entries", () => {
    const paidEntries = buildHistoryStudentPaidEntries([
      buildPayment({
        id: "package_credit_1",
        purchaseCategory: "package",
        amount: 0,
        fundingPayment: {
          id: "funding_payment_1",
          amount: 9000,
          currency: "usd",
          createdAt: "2026-03-01T18:00:00.000Z",
          courseTitle: "10-Class Package",
        },
      }),
      buildPayment({
        id: "package_credit_2",
        purchaseCategory: "package",
        amount: 0,
        createdAt: "2026-03-20T18:10:00.000Z",
        fundingPayment: {
          id: "funding_payment_1",
          amount: 9000,
          currency: "usd",
          createdAt: "2026-03-01T18:00:00.000Z",
          courseTitle: "10-Class Package",
        },
      }),
      buildPayment({
        id: "dropin_paid",
        purchaseCategory: "dropin",
        amount: 1800,
        createdAt: "2026-03-20T20:00:00.000Z",
      }),
    ])

    expect(paidEntries).toEqual([
      {
        id: "dropin_paid",
        amount: 1800,
        currency: "usd",
        createdAt: "2026-03-20T20:00:00.000Z",
        courseTitle: "Salsa Beginners",
      },
      {
        id: "funding_payment_1",
        amount: 9000,
        currency: "usd",
        createdAt: "2026-03-01T18:00:00.000Z",
        courseTitle: "10-Class Package",
      },
    ])
  })

  it("keeps linked funding payments even when the visible package row is categorized as other", () => {
    const paidEntries = buildHistoryStudentPaidEntries([
      buildPayment({
        id: "package_credit_other",
        purchaseCategory: "other",
        amount: 0,
        classPaid: false,
        fundingPayment: {
          id: "funding_payment_linked",
          amount: 9000,
          currency: "usd",
          createdAt: "2026-03-01T18:00:00.000Z",
          courseTitle: "10-Class Package",
        },
      }),
    ])

    expect(paidEntries).toEqual([
      {
        id: "funding_payment_linked",
        amount: 9000,
        currency: "usd",
        createdAt: "2026-03-01T18:00:00.000Z",
        courseTitle: "10-Class Package",
      },
    ])
  })

  it("uses linked funding payments for the visible daily card amount paid", () => {
    const card = buildHistoryStudentCard([
      buildPayment({
        id: "package_credit_today",
        purchaseCategory: "package",
        amount: 0,
        classPaid: false,
        fundingPayment: {
          id: "funding_payment_daily",
          amount: 9000,
          currency: "usd",
          createdAt: "2026-03-01T18:00:00.000Z",
          courseTitle: "10-Class Package",
        },
      }),
    ])

    expect(card).not.toBeNull()
    expect(resolveHistoryStudentCardAmountPaidCents(card!, "daily")).toBe(9000)
    expect(resolveHistoryStudentCardAmountPaidCents(card!, "history")).toBe(0)
  })

  it("matches attendance filters with attended, scheduled, and no-attendance buckets", () => {
    expect(isHistoryAttendanceMatch(buildPayment({ checkInStatus: "checked_out" }), "attended")).toBe(true)
    expect(isHistoryAttendanceMatch(buildPayment({ checkInStatus: "scheduled" }), "scheduled")).toBe(true)
    expect(isHistoryAttendanceMatch(buildPayment({ checkInStatus: "none" }), "no_attendance")).toBe(true)
    expect(isHistoryAttendanceMatch(buildPayment({ checkInStatus: "scheduled" }), "attended")).toBe(false)
  })

  describe("resolveCardContext", () => {
    it("returns 'daily' when isHistoryMode is false and hasSearchResults is false", () => {
      expect(resolveCardContext(false, false)).toBe("daily")
    })

    it("returns 'history' when isHistoryMode is true and hasSearchResults is false", () => {
      expect(resolveCardContext(true, false)).toBe("history")
    })

    it("returns 'global-search' when hasSearchResults is true regardless of isHistoryMode", () => {
      expect(resolveCardContext(false, true)).toBe("global-search")
      expect(resolveCardContext(true, true)).toBe("global-search")
    })
  })

  describe("resolveCardVariant", () => {
    it("returns correct config for 'daily' context", () => {
      const variant = resolveCardVariant("daily")
      expect(variant.context).toBe("daily")
      expect(variant.showCheckout).toBe(true)
      expect(variant.showHistorySubtitle).toBe(false)
      expect(variant.showHistoryTooltip).toBe(false)
      expect(variant.showLatestClassAttended).toBe(true)
      expect(variant.showActivePackage).toBe(true)
      expect(variant.showCheckInStatus).toBe(true)
    })

    it("returns correct config for 'history' context", () => {
      const variant = resolveCardVariant("history")
      expect(variant.context).toBe("history")
      expect(variant.showCheckout).toBe(false)
      expect(variant.showHistorySubtitle).toBe(true)
      expect(variant.showHistoryTooltip).toBe(true)
      expect(variant.showLatestClassAttended).toBe(false)
      expect(variant.showActivePackage).toBe(false)
      expect(variant.showCheckInStatus).toBe(false)
    })

    it("returns correct config for 'global-search' context", () => {
      const variant = resolveCardVariant("global-search")
      expect(variant.context).toBe("global-search")
      expect(variant.showCheckout).toBe(true)
      expect(variant.showHistorySubtitle).toBe(false)
      expect(variant.showHistoryTooltip).toBe(false)
      expect(variant.showLatestClassAttended).toBe(true)
      expect(variant.showActivePackage).toBe(true)
      expect(variant.showCheckInStatus).toBe(true)
    })

    it("CARD_VARIANT_CONFIGS matches the expected variant matrix", () => {
      expect(CARD_VARIANT_CONFIGS.daily.showCheckout).toBe(true)
      expect(CARD_VARIANT_CONFIGS.history.showCheckout).toBe(false)
      expect(CARD_VARIANT_CONFIGS["global-search"].showCheckout).toBe(true)

      expect(CARD_VARIANT_CONFIGS.daily.showHistorySubtitle).toBe(false)
      expect(CARD_VARIANT_CONFIGS.history.showHistorySubtitle).toBe(true)
      expect(CARD_VARIANT_CONFIGS["global-search"].showHistorySubtitle).toBe(false)
    })
  })
})
