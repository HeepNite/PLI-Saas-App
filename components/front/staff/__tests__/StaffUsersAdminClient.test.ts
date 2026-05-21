import { describe, expect, it } from "vitest"

import {
  buildStaffApprovalsFeed,
  buildStaffApprovalsSummary,
  buildCourseRoomOptions,
  buildCurrentMonthStudentsSummary,
  buildRoomLookup,
  buildCurrentMonthPaymentsSummarySearchParams,
  buildPaymentsRequestSearchParams,
  checkInStateTone,
  formatStudentPaymentCardDateTimeLabel,
  isInsideCriticalClassWindow,
  isPaymentPaidForUi,
  filterVisibleRooms,
  formatPaymentChangeRequestInfoRows,
  formatPaymentChangeRequestMethodLabel,
  matchesHistoryContentFilters,
  matchesStudentSearchQuery,
  paymentStateLabel,
  resolveStudentPinTone,
  resolveDailyVisiblePayment,
  resolveProfileCardBadges,
  resolveProfileCardDetailRows,
  resolveProfileCashSettlementControl,
  resolveProfileSettlementControl,
  resolveProfileCardDetails,
  resolveRoomCatalogErrorMessage,
  resolveRoomDisableActionState,
  resolveHistoryMaxSelectableDateIso,
  resolveStudentCardPayments,
  resolveHistoryRangeState,
  resolveAttendanceHistoryRows,
  resolvePaymentHistoryRows,
  transformPaymentRowsToEvents,
  transformPaymentRowsToAttendance,
} from "@/components/front/staff/StaffUsersAdminClient"
import { buildHistoryStudentCard, resolveHistoryStudentCardAmountPaidCents } from "@/components/front/staff/historyCardAggregates"

describe("resolveHistoryRangeState", () => {
  it("clears the previous end when a new range start is selected", () => {
    expect(resolveHistoryRangeState("2026-03-15", undefined)).toEqual({
      historyFrom: "2026-03-15",
      historyTo: "",
    })
  })

  it("keeps the provided end when the range is complete", () => {
    expect(resolveHistoryRangeState("2026-03-10", "2026-03-13")).toEqual({
      historyFrom: "2026-03-10",
      historyTo: "2026-03-13",
    })
  })
})

describe("transformPaymentRowsToAttendance", () => {
  it("hides package credit rows without attendance evidence from attendance history", () => {
    const result = transformPaymentRowsToAttendance([
      {
        id: "pkg_credit_future",
        userId: "user_1",
        customerName: "Test",
        customerEmail: "test@example.com",
        customerPhone: "-",
        customerAvatarUrl: null,
        courseTitle: "Salsa Beginner / Open Level",
        courseSlug: "salsa-open",
        packageId: "pkg_1",
        serviceId: null,
        paymentChannel: "package_credit",
        purchaseCategory: "package",
        amount: 0,
        currency: "usd",
        paymentStatus: "pending",
        settlementStatus: "pending",
        settlementNote: "",
        settledAt: null,
        createdAt: "2026-05-04T20:10:00.000Z",
        updatedAt: "2026-05-04T20:10:00.000Z",
        classDate: "2026-05-04",
        classTime: "20:10",
        classStartsAt: "2026-05-04T20:10:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: false,
        attendanceId: null,
        checkInStatus: "none",
        checkInAt: null,
        checkedOutAt: null,
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 3,
        packageClassesUsedTotal: 3,
        outstandingBalance: null,
      },
    ] as never)

    expect(result.summary.totalAttended).toBe(0)
    expect(result.summary.noShows).toBe(0)
    expect(result.events).toHaveLength(0)
  })

  it("does not treat package credit attendanceId-only rows as attended evidence", () => {
    const result = transformPaymentRowsToAttendance([
      {
        id: "pkg_credit_attendance_id_only",
        userId: "user_1",
        customerName: "Test",
        customerEmail: "test@example.com",
        customerPhone: "-",
        customerAvatarUrl: null,
        courseTitle: "Salsa Beginner / Open Level",
        courseSlug: "salsa-open",
        packageId: "pkg_1",
        serviceId: null,
        paymentChannel: "package_credit",
        purchaseCategory: "package",
        amount: 0,
        currency: "usd",
        paymentStatus: "pending",
        settlementStatus: "pending",
        settlementNote: "",
        settledAt: null,
        createdAt: "2026-05-04T20:10:00.000Z",
        updatedAt: "2026-05-04T20:10:00.000Z",
        classDate: "2026-05-04",
        classTime: "20:10",
        classStartsAt: "2026-05-04T20:10:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: false,
        attendanceId: "attendance_no_show_like",
        checkInStatus: "none",
        checkInAt: null,
        checkedOutAt: null,
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 3,
        packageClassesUsedTotal: 3,
        outstandingBalance: null,
      },
    ] as never)

    expect(result.summary.totalAttended).toBe(0)
    expect(result.summary.noShows).toBe(0)
    expect(result.events).toHaveLength(0)
  })

  it("does not treat scheduled package credit with checkInAt as attended evidence", () => {
    const result = transformPaymentRowsToAttendance([
      {
        id: "pkg_credit_scheduled_with_checkin_at",
        userId: "user_1",
        customerName: "Test",
        customerEmail: "test@example.com",
        customerPhone: "-",
        customerAvatarUrl: null,
        courseTitle: "Salsa Beginner / Open Level",
        courseSlug: "salsa-open",
        packageId: "pkg_1",
        serviceId: null,
        paymentChannel: "package_credit",
        purchaseCategory: "package",
        amount: 0,
        currency: "usd",
        paymentStatus: "pending",
        settlementStatus: "pending",
        settlementNote: "",
        settledAt: null,
        createdAt: "2026-05-04T20:10:00.000Z",
        updatedAt: "2026-05-04T20:10:00.000Z",
        classDate: "2026-05-04",
        classTime: "20:10",
        classStartsAt: "2026-05-04T20:10:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: false,
        attendanceId: "attendance_scheduled_1",
        checkInStatus: "scheduled",
        checkInAt: "2026-05-04T20:10:00.000Z",
        checkedOutAt: null,
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 3,
        packageClassesUsedTotal: 3,
        outstandingBalance: null,
      },
    ] as never)

    expect(result.summary.totalAttended).toBe(0)
    expect(result.events).toHaveLength(0)
  })

  it("does not treat package credit checkInAt+attendanceId with non-attended status as attended", () => {
    const result = transformPaymentRowsToAttendance([
      {
        id: "pkg_credit_checkinat_attendanceid_none",
        userId: "user_1",
        customerName: "Palladium Student",
        customerEmail: "test@example.com",
        customerPhone: "-",
        customerAvatarUrl: null,
        courseTitle: "Salsa Beginner / Open Level",
        courseSlug: "salsa-open",
        packageId: "pkg_1",
        serviceId: null,
        paymentChannel: "package_credit",
        purchaseCategory: "package",
        amount: 0,
        currency: "usd",
        paymentStatus: "pending",
        settlementStatus: "pending",
        settlementNote: "",
        settledAt: null,
        createdAt: "2026-05-04T20:10:00.000Z",
        updatedAt: "2026-05-04T20:10:00.000Z",
        classDate: "2026-05-04",
        classTime: "20:10",
        classStartsAt: "2026-05-04T20:10:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: false,
        attendanceId: "attendance_maybe_linked_but_not_real_checkin",
        checkInStatus: "none",
        checkInAt: "2026-05-04T20:10:00.000Z",
        checkedOutAt: null,
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 2,
        packageClassesUsedTotal: 2,
        outstandingBalance: null,
      },
    ] as never)

    expect(result.summary.totalAttended).toBe(0)
    expect(result.events).toHaveLength(0)
  })

  it("does not render attended from attended-like status without real check-in timestamp", () => {
    const result = transformPaymentRowsToAttendance([
      {
        id: "pkg_credit_checked_out_no_checkin_at",
        userId: "user_1",
        customerName: "Palladium Student",
        customerEmail: "test@example.com",
        customerPhone: "-",
        customerAvatarUrl: null,
        courseTitle: "Salsa Beginner / Open Level",
        courseSlug: "salsa-open",
        packageId: "pkg_1",
        serviceId: null,
        paymentChannel: "package_credit",
        purchaseCategory: "package",
        amount: 0,
        currency: "usd",
        paymentStatus: "pending",
        settlementStatus: "pending",
        settlementNote: "",
        settledAt: null,
        createdAt: "2026-05-04T20:10:00.000Z",
        updatedAt: "2026-05-04T20:10:00.000Z",
        classDate: "2026-05-04",
        classTime: "20:10",
        classStartsAt: "2026-05-04T20:10:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: false,
        attendanceId: "attendance_checked_out_but_no_checkin",
        checkInStatus: "checked_out",
        checkInAt: null,
        checkedOutAt: "2026-05-04T21:15:00.000Z",
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 2,
        packageClassesUsedTotal: 2,
        outstandingBalance: null,
      },
    ] as never)

    expect(result.summary.totalAttended).toBe(0)
    expect(result.events).toHaveLength(0)
  })

  it("uses attendance check-in time for attended rows instead of payment metadata classTime", () => {
    const result = transformPaymentRowsToAttendance([
      {
        id: "attended_time_should_use_checkin",
        userId: "user_1",
        customerName: "Palladium Student",
        customerEmail: "test@example.com",
        customerPhone: "-",
        customerAvatarUrl: null,
        courseTitle: "Salsa Beginner / Open Level",
        courseSlug: "salsa-open",
        packageId: "pkg_1",
        serviceId: null,
        paymentChannel: "package_credit",
        purchaseCategory: "package",
        amount: 0,
        currency: "usd",
        paymentStatus: "pending",
        settlementStatus: "pending",
        settlementNote: "",
        settledAt: null,
        createdAt: "2026-05-04T20:10:00.000Z",
        updatedAt: "2026-05-04T20:10:00.000Z",
        classDate: "2026-05-04",
        classTime: "20:10",
        classStartsAt: "2026-05-04T20:10:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: false,
        attendanceId: "attendance_real",
        checkInStatus: "checked_in",
        checkInAt: "2026-05-04T21:10:00.000Z",
        checkedOutAt: null,
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 2,
        packageClassesUsedTotal: 2,
        outstandingBalance: null,
      },
    ] as never)

    expect(result.summary.totalAttended).toBe(1)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.status).toBe("attended")
    const checkInLocal = new Date("2026-05-04T21:10:00.000Z")
    const expectedTime = `${String(checkInLocal.getHours()).padStart(2, "0")}:${String(checkInLocal.getMinutes()).padStart(2, "0")}`
    expect(result.events[0]?.time).toBe(expectedTime)
    expect(result.events[0]?.time).not.toBe("20:10")
  })

  it("renders paid direct purchases without attendance rows as attended history", () => {
    const result = transformPaymentRowsToAttendance([
      {
        id: "paid_direct_without_attendance",
        userId: "user_1",
        customerName: "Sebastian Basantes",
        customerEmail: "sebastian@example.com",
        customerPhone: "19735258381",
        customerAvatarUrl: null,
        courseTitle: "Salsa Beginner / Open Level",
        courseSlug: "salsa-open",
        packageId: null,
        serviceId: "svc_dropin",
        paymentChannel: "cash",
        purchaseCategory: "dropin",
        amount: 1500,
        currency: "usd",
        paymentStatus: "paid",
        settlementStatus: "paid",
        settlementNote: "",
        settledAt: "2026-05-15T20:19:00.000Z",
        createdAt: "2026-05-15T20:19:00.000Z",
        updatedAt: "2026-05-15T20:19:00.000Z",
        classDate: "2026-05-15",
        classTime: "20:10",
        classStartsAt: "2026-05-15T20:10:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: true,
        attendanceId: null,
        checkInStatus: "none",
        checkInAt: null,
        checkedOutAt: null,
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 1,
        packageClassesUsedTotal: 0,
        outstandingBalance: null,
      },
    ] as never)

    expect(result.summary.totalAttended).toBe(1)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.status).toBe("attended")
    expect(result.events[0]?.classType).toBe("Drop-in")
  })
})

describe("transformPaymentRowsToEvents", () => {
  it("converts cents to dollars for timeline amounts", () => {
    const events = transformPaymentRowsToEvents([
      {
        id: "pmt_1",
        userId: "user_1",
        customerName: "Jhon Doe",
        customerEmail: "jhon@example.com",
        customerPhone: "-",
        customerAvatarUrl: null,
        courseTitle: "Salsa timba in New York",
        courseSlug: "salsa-ny",
        packageId: null,
        serviceId: "svc_dropin",
        paymentChannel: "card",
        purchaseCategory: "dropin",
        amount: 2000,
        currency: "usd",
        paymentStatus: "paid",
        settlementStatus: "paid",
        settlementNote: "",
        settledAt: null,
        createdAt: "2026-05-06T14:00:00.000Z",
        updatedAt: "2026-05-06T14:00:00.000Z",
        classDate: "2026-05-06",
        classTime: "14:00",
        classStartsAt: "2026-05-06T14:00:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: true,
        attendanceId: null,
        checkInStatus: "none",
        checkInAt: null,
        checkedOutAt: null,
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 0,
        packageClassesUsedTotal: 0,
        outstandingBalance: null,
        studentPin: { enabled: false, enrolled: false, locked: false, needsEnrollment: false, permanentStatus: null, provisionalActive: false, provisionalExpiresAt: null },
        stripeFailure: null,
      },
    ] as never)

    expect(events).toHaveLength(1)
    expect(events[0].amount).toBe(20)
  })

  it("excludes intermediate non-payment rows with $0 amount", () => {
    const events = transformPaymentRowsToEvents([
      {
        id: "intermediate_0",
        userId: "user_1",
        customerName: "Jhon Doe",
        customerEmail: "jhon@example.com",
        customerPhone: "-",
        customerAvatarUrl: null,
        courseTitle: "Salsa timba in New York",
        courseSlug: "salsa-ny",
        packageId: null,
        serviceId: null,
        paymentChannel: "unknown",
        purchaseCategory: "other",
        amount: 0,
        currency: "usd",
        paymentStatus: "pending",
        settlementStatus: "pending",
        settlementNote: "",
        settledAt: null,
        createdAt: "2026-05-06T14:00:00.000Z",
        updatedAt: "2026-05-06T14:00:00.000Z",
        classDate: "2026-05-06",
        classTime: "14:00",
        classStartsAt: "2026-05-06T14:00:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: false,
        attendanceId: null,
        checkInStatus: "none",
        checkInAt: null,
        checkedOutAt: null,
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 0,
        packageClassesUsedTotal: 0,
        outstandingBalance: null,
        studentPin: { enabled: false, enrolled: false, locked: false, needsEnrollment: false, permanentStatus: null, provisionalActive: false, provisionalExpiresAt: null },
        stripeFailure: null,
      },
      {
        id: "paid_35",
        userId: "user_1",
        customerName: "Jhon Doe",
        customerEmail: "jhon@example.com",
        customerPhone: "-",
        customerAvatarUrl: null,
        courseTitle: "Salsa timba in New York 2",
        courseSlug: "salsa-ny-2",
        packageId: null,
        serviceId: "svc_dropin",
        paymentChannel: "card",
        purchaseCategory: "dropin",
        amount: 3500,
        currency: "usd",
        paymentStatus: "paid",
        settlementStatus: "paid",
        settlementNote: "",
        settledAt: null,
        createdAt: "2026-05-06T14:02:00.000Z",
        updatedAt: "2026-05-06T14:02:00.000Z",
        classDate: "2026-05-06",
        classTime: "14:02",
        classStartsAt: "2026-05-06T14:02:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: true,
        attendanceId: null,
        checkInStatus: "none",
        checkInAt: null,
        checkedOutAt: null,
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 0,
        packageClassesUsedTotal: 0,
        outstandingBalance: null,
        studentPin: { enabled: false, enrolled: false, locked: false, needsEnrollment: false, permanentStatus: null, provisionalActive: false, provisionalExpiresAt: null },
        stripeFailure: null,
      },
    ] as never)

    expect(events).toHaveLength(1)
    expect(events[0].id).toBe("paid_35")
    expect(events[0].amount).toBe(35)
  })
})

describe("attendance class type mapping", () => {
  it("maps non-package drop-in attendance rows as Drop-in", () => {
    const result = transformPaymentRowsToAttendance([
      {
        id: "dropin_attended",
        userId: "user_1",
        customerName: "Jhon Doe",
        customerEmail: "jhon@example.com",
        customerPhone: "-",
        customerAvatarUrl: null,
        courseTitle: "Salsa timba in New York",
        courseSlug: "salsa-ny",
        packageId: null,
        serviceId: "svc_dropin",
        paymentChannel: "card",
        purchaseCategory: "other",
        amount: 2000,
        currency: "usd",
        paymentStatus: "paid",
        settlementStatus: "paid",
        settlementNote: "",
        settledAt: null,
        createdAt: "2026-05-06T14:00:00.000Z",
        updatedAt: "2026-05-06T14:00:00.000Z",
        classDate: "2026-05-06",
        classTime: "14:00",
        classStartsAt: "2026-05-06T14:00:00.000Z",
        location: null,
        pointsBalance: 0,
        pointsHistory: [],
        classPaid: true,
        attendanceId: "att_1",
        checkInStatus: "checked_in",
        checkInAt: "2026-05-06T14:00:00.000Z",
        checkedOutAt: null,
        activePackage: null,
        packageClassNumber: null,
        fundingPayment: null,
        completedClassesTotal: 0,
        packageClassesUsedTotal: 0,
        outstandingBalance: null,
      },
    ] as never)

    expect(result.events).toHaveLength(1)
    expect(result.events[0].classType).toBe("Drop-in")
  })
})

describe("resolveAttendanceHistoryRows", () => {
  it("uses daily board scoped rows in daily mode instead of user full history", () => {
    const dailyRow = { id: "today_1", userId: "user_1", classDate: "2026-05-05" }
    const aprilHistoryRow = { id: "april_1", userId: "user_1", classDate: "2026-04-10" }

    const rows = resolveAttendanceHistoryRows({
      attendanceHistoryStudentId: "user_1",
      isHistoryMode: false,
      payments: [dailyRow as never],
      userHistoryPayments: [dailyRow as never, aprilHistoryRow as never],
      historyFrom: "",
      historyTo: "",
    })

    expect(rows.map((row) => row.id)).toEqual(["today_1"])
  })

  it("uses user history rows constrained by selected range in history mode", () => {
    const mayRow = { id: "may_1", userId: "user_1", classDate: "2026-05-05" }
    const aprilRow = { id: "april_1", userId: "user_1", classDate: "2026-04-10" }

    const rows = resolveAttendanceHistoryRows({
      attendanceHistoryStudentId: "user_1",
      isHistoryMode: true,
      payments: [mayRow as never],
      userHistoryPayments: [mayRow as never, aprilRow as never],
      historyFrom: "2026-05-01",
      historyTo: "2026-05-31",
    })

    expect(rows.map((row) => row.id)).toEqual(["may_1"])
  })
})

describe("resolvePaymentHistoryRows", () => {
  it("uses NY-today payment createdAt in daily mode and excludes older timeline rows", () => {
    const dailyRow = {
      id: "today_1",
      userId: "user_1",
      classDate: "2026-05-05",
      createdAt: "2026-05-05T15:15:00.000Z",
    }
    const aprilHistoryRow = {
      id: "april_1",
      userId: "user_1",
      classDate: "2026-05-05",
      createdAt: "2026-04-10T15:15:00.000Z",
    }
    const mayFirstHistoryRow = {
      id: "may_1",
      userId: "user_1",
      classDate: "2026-05-05",
      createdAt: "2026-05-01T15:15:00.000Z",
    }
    const otherStudentTodayRow = {
      id: "today_2",
      userId: "user_2",
      classDate: "2026-05-05",
      createdAt: "2026-05-05T15:15:00.000Z",
    }

    const rows = resolvePaymentHistoryRows({
      paymentHistoryStudentId: "user_1",
      isHistoryMode: false,
      payments: [dailyRow as never, aprilHistoryRow as never, mayFirstHistoryRow as never, otherStudentTodayRow as never],
      userHistoryPayments: [dailyRow as never, aprilHistoryRow as never],
      currentDateNY: "2026-05-05",
    })

    expect(rows.map((row) => row.id)).toEqual(["today_1"])
  })

  it("uses user history rows in history mode", () => {
    const mayRow = { id: "may_1", userId: "user_1", classDate: "2026-05-05" }
    const aprilRow = { id: "april_1", userId: "user_1", classDate: "2026-04-10" }

    const rows = resolvePaymentHistoryRows({
      paymentHistoryStudentId: "user_1",
      isHistoryMode: true,
      payments: [mayRow as never],
      userHistoryPayments: [mayRow as never, aprilRow as never],
      currentDateNY: "2026-05-05",
    })

    expect(rows.map((row) => row.id)).toEqual(["may_1", "april_1"])
  })

  it("accepts date-only createdAt values for NY-daily filtering", () => {
    const todayRow = {
      id: "today_date_only",
      userId: "user_1",
      createdAt: "2026-05-06",
    }
    const oldRow = {
      id: "old_date_only",
      userId: "user_1",
      createdAt: "2026-05-04",
    }

    const rows = resolvePaymentHistoryRows({
      paymentHistoryStudentId: "user_1",
      isHistoryMode: false,
      payments: [todayRow as never, oldRow as never],
      userHistoryPayments: [],
      currentDateNY: "2026-05-06",
    })

    expect(rows.map((row) => row.id)).toEqual(["today_date_only"])
  })
})

describe("buildPaymentsRequestSearchParams", () => {
  it("keeps history fetch scoped only by date range", () => {
    expect(
      buildPaymentsRequestSearchParams({
        isHistoryMode: true,
        historyFrom: "2026-03-10",
        historyTo: "2026-03-13",
      }).toString()
    ).toBe("mode=history&from=2026-03-10&to=2026-03-13")
  })

  it("includes the student search query for server-scoped payment searches", () => {
    expect(
      buildPaymentsRequestSearchParams({
        isHistoryMode: true,
        historyFrom: "2026-03-10",
        historyTo: "2026-03-13",
        studentSearchQuery: "  elvira  ",
      }).toString()
    ).toBe("q=elvira&mode=history&from=2026-03-10&to=2026-03-13")
  })

  it("leaves today mode without history params", () => {
    expect(
      buildPaymentsRequestSearchParams({
        isHistoryMode: false,
        historyFrom: "2026-03-10",
        historyTo: "2026-03-13",
      }).toString()
    ).toBe("")
  })

  it("keeps today mode searchable without forcing history params", () => {
    expect(
      buildPaymentsRequestSearchParams({
        isHistoryMode: false,
        historyFrom: "2026-03-10",
        historyTo: "2026-03-13",
        studentSearchQuery: "elvira",
      }).toString()
    ).toBe("q=elvira")
  })
})

describe("buildCurrentMonthPaymentsSummarySearchParams", () => {
  it("always requests the full current month in history mode", () => {
    expect(buildCurrentMonthPaymentsSummarySearchParams(new Date("2026-04-15T12:00:00.000Z")).toString()).toBe(
      "mode=history&from=2026-04-01&to=2026-04-30"
    )
  })

  it("handles leap-year month boundaries", () => {
    expect(buildCurrentMonthPaymentsSummarySearchParams(new Date("2024-02-10T12:00:00.000Z")).toString()).toBe(
      "mode=history&from=2024-02-01&to=2024-02-29"
    )
  })
})

describe("resolveHistoryMaxSelectableDateIso", () => {
  it("uses New York date so history can include current NY day", () => {
    expect(resolveHistoryMaxSelectableDateIso(new Date("2026-05-05T02:30:00.000Z"))).toBe("2026-05-04")
    expect(resolveHistoryMaxSelectableDateIso(new Date("2026-05-05T16:30:00.000Z"))).toBe("2026-05-05")
  })
})

describe("buildCurrentMonthStudentsSummary", () => {
  it("keeps the top student cards pinned to the current month summary source", () => {
    expect(
      buildCurrentMonthStudentsSummary({
        summary: {
          totalItems: 99,
          totalCollected: 24500,
          pendingSettlement: 3,
          paidSettlement: 6,
          pendingStripe: 4,
          paidStripe: 11,
        },
        studentCount: 14,
        checkedInStudents: 9,
      })
    ).toEqual({
      totalStudents: 14,
      paidStudents: 11,
      checkedInStudents: 9,
      totalRevenueCents: 24500,
      pendingByContext: 7,
    })
  })
})

describe("staff approvals feed", () => {
  it("merges generic staff requests with payment change requests in reverse chronological order", () => {
    const summary = buildStaffApprovalsSummary(
      {
        total: 1,
        pending: 1,
        inReview: 0,
        approved: 0,
        rejected: 0,
      },
      [
        {
          id: "payment-1",
          staffAccountId: "staff-1",
          requestedMethod: "direct_deposit",
          requestedInfo: { cbu: "123456789" },
          reason: "Updated bank account",
          status: "pending",
          createdAt: "2026-04-13T12:00:00.000Z",
          staffAccount: {
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@example.com",
          },
        },
        {
          id: "payment-2",
          staffAccountId: "staff-2",
          requestedMethod: "cash",
          requestedInfo: {},
          reason: null,
          status: "cancelled",
          createdAt: "2026-04-12T12:00:00.000Z",
          staffAccount: {
            firstName: "Grace",
            lastName: "Hopper",
            email: "grace@example.com",
          },
        },
       ] satisfies Array<{
         id: string
         staffAccountId: string
         requestedMethod: string
         requestedInfo: unknown
         reason: string | null
         status: string
         createdAt: string
         staffAccount: { firstName: string; lastName: string; email: string }
       }>
     )

     expect(summary).toEqual({
      total: 2,
      pending: 2,
      inReview: 0,
      approved: 0,
      rejected: 0,
    })

    const feed = buildStaffApprovalsFeed(
      [
        {
          id: "request-1",
          type: "STAFF_DAY_OFF",
          status: "PENDING",
          message: "Need next Friday off",
          meta: {},
          createdAt: "2026-04-13T10:00:00.000Z",
          updatedAt: "2026-04-13T10:00:00.000Z",
          resolvedAt: null,
          user: {
            id: "user-1",
            name: "Grace Hopper",
            email: "grace@example.com",
            phone: "",
          },
        },
      ] as unknown,
      [
        {
          id: "payment-1",
          staffAccountId: "staff-1",
          requestedMethod: "direct_deposit",
          requestedInfo: { cbu: "123456789" },
          reason: "Updated bank account",
          status: "pending",
          createdAt: "2026-04-13T12:00:00.000Z",
          staffAccount: {
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@example.com",
          },
        },
        {
          id: "payment-2",
          staffAccountId: "staff-2",
          requestedMethod: "cash",
          requestedInfo: {},
          reason: null,
          status: "cancelled",
          createdAt: "2026-04-12T12:00:00.000Z",
          staffAccount: {
            firstName: "Grace",
            lastName: "Hopper",
            email: "grace@example.com",
          },
        },
      ]
    )

    expect(feed).toHaveLength(2)
    expect(feed[0]).toMatchObject({ id: "payment-1", kind: "payment_change_request" })
    expect(feed[1]).toMatchObject({ id: "request-1", kind: "staff_request" })
  })

  it("formats payment change request labels and masks sensitive values", () => {
    expect(formatPaymentChangeRequestMethodLabel("direct_deposit")).toBe("Direct deposit")
    expect(formatPaymentChangeRequestMethodLabel("custom_method")).toBe("custom method")
    expect(
      formatPaymentChangeRequestInfoRows({
        cbu: "123456789",
        alias: "main-account",
        accountNumber: "998877",
        empty: "   ",
      } as unknown)
    ).toEqual([
      { key: "cbu", label: "CBU", value: "•••• 789" },
      { key: "alias", label: "Alias", value: "main-account" },
      { key: "accountNumber", label: "Account number", value: "•••• 877" },
    ])
  })
})

describe("staff approvals helpers", () => {
  it("adds non-cancelled payment change requests into the approvals summary", () => {
    expect(
      buildStaffApprovalsSummary(
        {
          total: 4,
          pending: 1,
          inReview: 1,
          approved: 1,
          rejected: 1,
        },
        [
          {
            id: "pay-1",
            staffAccountId: "staff-1",
            requestedMethod: "zelle",
            requestedInfo: null,
            reason: "Need a faster payout",
            status: "pending",
            createdAt: "2026-04-11T10:00:00.000Z",
            staffAccount: { firstName: "Ana", lastName: "Lopez", email: "ana@example.com" },
          },
          {
            id: "pay-2",
            staffAccountId: "staff-2",
            requestedMethod: "cash",
            requestedInfo: null,
            reason: null,
            status: "approved",
            createdAt: "2026-04-10T10:00:00.000Z",
            staffAccount: { firstName: "Nico", lastName: "Diaz", email: "nico@example.com" },
          },
          {
            id: "pay-3",
            staffAccountId: "staff-3",
            requestedMethod: "stripe",
            requestedInfo: null,
            reason: null,
            status: "cancelled",
            createdAt: "2026-04-09T10:00:00.000Z",
            staffAccount: { firstName: "Lu", lastName: "Perez", email: "lu@example.com" },
          },
        ]
      )
    ).toEqual({
      total: 6,
      pending: 2,
      inReview: 1,
      approved: 2,
      rejected: 1,
    })
  })

  it("keeps payment change requests inside the same approvals feed ordered by newest first", () => {
    const approvalFeed = buildStaffApprovalsFeed(
      [
        {
          id: "req-1",
          type: "STAFF_DAY_OFF",
          status: "PENDING",
          message: "Need next Friday off",
          meta: {},
          createdAt: "2026-04-10T10:00:00.000Z",
          updatedAt: "2026-04-10T10:00:00.000Z",
          resolvedAt: null,
          user: { id: "user-1", name: "Jane Doe", email: "jane@example.com", phone: "123" },
        },
      ],
      [
        {
          id: "pay-1",
          staffAccountId: "staff-1",
          requestedMethod: "zelle",
          requestedInfo: null,
          reason: "Need a faster payout",
          status: "pending",
          createdAt: "2026-04-11T10:00:00.000Z",
          staffAccount: { firstName: "Ana", lastName: "Lopez", email: "ana@example.com" },
        },
        {
          id: "pay-2",
          staffAccountId: "staff-2",
          requestedMethod: "cash",
          requestedInfo: null,
          reason: null,
          status: "cancelled",
          createdAt: "2026-04-12T10:00:00.000Z",
          staffAccount: { firstName: "Lu", lastName: "Perez", email: "lu@example.com" },
        },
      ]
    )

    expect(approvalFeed.map((item) => [item.kind, item.id])).toEqual([
      ["payment_change_request", "pay-1"],
      ["staff_request", "req-1"],
    ])
  })
})

describe("matchesHistoryContentFilters", () => {
  const row = {
    courseSlug: "bachata-int",
    paymentChannel: "card" as const,
    purchaseCategory: "dropin" as const,
    packageId: null,
    classPaid: true,
    checkInStatus: "checked_out" as const,
  }

  it("applies the history class filter only in client content matching", () => {
    expect(
      matchesHistoryContentFilters(row, {
        classKey: "bachata-int",
        paymentMethodFilter: "all",
        attendanceFilter: "all",
        paymentsFilter: "all",
      })
    ).toBe(true)

    expect(
      matchesHistoryContentFilters(row, {
        classKey: "salsa-beginners",
        paymentMethodFilter: "all",
        attendanceFilter: "all",
        paymentsFilter: "all",
      })
    ).toBe(false)
  })

  it("keeps the internal history pay and attendance filters scoped to content matching", () => {
    expect(
      matchesHistoryContentFilters(row, {
        classKey: "",
        paymentMethodFilter: "card",
        attendanceFilter: "attended",
        paymentsFilter: "paid",
      })
    ).toBe(true)

    expect(
      matchesHistoryContentFilters(row, {
        classKey: "",
        paymentMethodFilter: "cash",
        attendanceFilter: "all",
        paymentsFilter: "all",
      })
    ).toBe(false)
  })
})

describe("resolveStudentCardPayments", () => {
  const basePayment = {
    id: "pay-1",
    userId: "user-1",
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    customerPhone: "+54 11 5555 1111",
    courseTitle: "Bachata Int",
    courseSlug: "bachata-int",
    location: "Palermo",
    activePackage: { label: "8 classes" },
    paymentChannel: "card",
    purchaseCategory: "dropin",
    classPaid: false,
    fundingPayment: null,
    checkInStatus: "scheduled",
  }

  const defaultFilters = {
    isHistoryMode: true,
    historyClassKey: "",
    historyPaymentMethodFilter: "all" as const,
    historyAttendanceFilter: "all" as const,
    paymentCategoryFilter: "history" as const,
    paymentsFilter: "paid" as const,
  }

  it("falls back to the searched student when status filter would otherwise hide them", () => {
    expect(
      resolveStudentCardPayments([basePayment], {
        ...defaultFilters,
        studentSearchQuery: "jane",
      })
    ).toEqual([basePayment])
  })

  it("keeps the status filter when the searched student already matches it", () => {
    const paidPayment = { ...basePayment, id: "pay-2", classPaid: true }

    expect(
      resolveStudentCardPayments([basePayment, paidPayment], {
        ...defaultFilters,
        studentSearchQuery: "jane",
      })
    ).toEqual([paidPayment])
  })

  it("still returns nothing when the search does not match the student", () => {
    expect(
      resolveStudentCardPayments([basePayment], {
        ...defaultFilters,
        studentSearchQuery: "maria",
      })
    ).toEqual([])
  })

  it("treats package rows with linked funding payments as paid for UI status filters", () => {
    const fundedPackagePayment = {
      ...basePayment,
      id: "pkg-pay-1",
      paymentChannel: "unknown",
      purchaseCategory: "package",
      classPaid: false,
      fundingPayment: {
        id: "funding-1",
        amount: 22000,
        currency: "usd",
        createdAt: "2026-03-01T18:00:00.000Z",
        courseTitle: "10-Class Package",
      },
    }

    expect(
      resolveStudentCardPayments([fundedPackagePayment], {
        ...defaultFilters,
        paymentsFilter: "paid",
        studentSearchQuery: "",
      })
    ).toEqual([fundedPackagePayment])

    expect(
      resolveStudentCardPayments([fundedPackagePayment], {
        ...defaultFilters,
        paymentsFilter: "pending",
        studentSearchQuery: "",
      })
    ).toEqual([])
  })
})

describe("isPaymentPaidForUi", () => {
  it("uses linked funding payments for package rows even when classPaid is false", () => {
    expect(
      isPaymentPaidForUi({
        purchaseCategory: "package",
        classPaid: false,
        fundingPayment: {
          id: "funding-1",
          amount: 22000,
          currency: "usd",
          createdAt: "2026-03-01T18:00:00.000Z",
          courseTitle: "10-Class Package",
        },
      } as unknown)
    ).toBe(true)
  })

  it("keeps truly pending package rows pending when there is no linked funding payment", () => {
    expect(
      isPaymentPaidForUi({
        purchaseCategory: "package",
        classPaid: false,
        fundingPayment: null,
      } as unknown)
    ).toBe(false)
  })

  it("treats package-backed daily rows as paid even when the visible row is categorized as other", () => {
    expect(
      isPaymentPaidForUi({
        purchaseCategory: "other",
        classPaid: false,
        fundingPayment: {
          id: "funding-2",
          amount: 22000,
          currency: "usd",
          createdAt: "2026-03-01T18:00:00.000Z",
          courseTitle: "10-Class Package",
        },
      } as unknown)
    ).toBe(true)
  })

  it("treats checked-in package rows as paid even before funding payment hydration lands", () => {
    expect(
      isPaymentPaidForUi({
        purchaseCategory: "package",
        classPaid: false,
        fundingPayment: null,
        checkInStatus: "checked_in",
        packageId: "pkg_10",
      } as unknown)
    ).toBe(true)
  })
})

describe("paymentStateLabel", () => {
  it("shows package paid for package-backed rows instead of card pending", () => {
    expect(
      paymentStateLabel({
        paymentChannel: "card",
        settlementStatus: "pending",
        purchaseCategory: "other",
        classPaid: false,
        fundingPayment: {
          id: "funding-1",
          amount: 22000,
          currency: "usd",
          createdAt: "2026-03-01T18:00:00.000Z",
          courseTitle: "10-Class Package",
        },
      } as unknown)
    ).toBe("Package paid")
  })

  it("keeps real unfunded card rows as card pending", () => {
    expect(
      paymentStateLabel({
        paymentChannel: "card",
        settlementStatus: "pending",
        purchaseCategory: "dropin",
        classPaid: false,
        fundingPayment: null,
      } as unknown)
    ).toBe("Card pending")
  })

  it("shows package paid for checked-in package rows even when funding payment is still missing", () => {
    expect(
      paymentStateLabel({
        paymentChannel: "card",
        settlementStatus: "pending",
        purchaseCategory: "package",
        classPaid: false,
        fundingPayment: null,
        checkInStatus: "checked_in",
        packageId: "pkg_10",
      } as unknown)
    ).toBe("Package paid")
  })
})

describe("resolveDailyVisiblePayment", () => {
  it("prefers a package-backed check-in row over a newer pending card row in daily cards", () => {
    const elviraPackageCheckIn = {
      id: "elvira_pkg_checkin",
      userId: "user_elvira",
      customerName: "Elvira",
      customerEmail: "elvira@example.com",
      customerPhone: "+54 11 5555 9999",
      courseTitle: "Salsa Beginners",
      courseSlug: "salsa-beginners",
      location: "Palermo",
      activePackage: { label: "10 classes" },
      packageId: "pkg_10",
      paymentChannel: "card",
      purchaseCategory: "package",
      amount: 0,
      currency: "usd",
      classPaid: false,
      fundingPayment: {
        id: "funding_elvira",
        amount: 22000,
        currency: "usd",
        createdAt: "2026-03-01T18:00:00.000Z",
        courseTitle: "10-Class Package",
      },
      checkInStatus: "checked_in",
      attendanceId: "attendance_elvira",
      checkInAt: "2026-03-20T18:01:00.000Z",
      checkedOutAt: null,
      createdAt: "2026-03-20T18:00:00.000Z",
      classDate: "2026-03-20",
      classTime: "18:00",
      classStartsAt: "2026-03-20T18:00:00.000Z",
    }

    const newerPendingCardRow = {
      ...elviraPackageCheckIn,
      id: "elvira_pending_card",
      packageId: null,
      purchaseCategory: "other",
      fundingPayment: null,
      checkInStatus: "none",
      attendanceId: null,
      checkInAt: null,
      createdAt: "2026-03-20T18:05:00.000Z",
    }

    const card = buildHistoryStudentCard([elviraPackageCheckIn, newerPendingCardRow])

    expect(card).not.toBeNull()
    expect(card?.latestPayment.id).toBe("elvira_pending_card")

    const visiblePayment = resolveDailyVisiblePayment(card!.allPayments as unknown)

    expect(visiblePayment?.id).toBe("elvira_pkg_checkin")
    expect(paymentStateLabel(visiblePayment as unknown)).toBe("Package paid")
    expect(resolveHistoryStudentCardAmountPaidCents(card!, "daily")).toBe(22000)
  })

  it("keeps the daily badge on package paid when the visible package check-in has no linked funding payment yet", () => {
    const elviraVisiblePackageCheckIn = {
      id: "elvira_pkg_checkin_without_funding",
      userId: "user_elvira",
      customerName: "Elvira",
      customerEmail: "elvira@example.com",
      customerPhone: "+54 11 5555 9999",
      courseTitle: "Salsa Beginners",
      courseSlug: "salsa-beginners",
      location: "Palermo",
      activePackage: { label: "10 classes" },
      packageId: "pkg_10",
      paymentChannel: "card",
      purchaseCategory: "package",
      amount: 0,
      currency: "usd",
      classPaid: false,
      fundingPayment: null,
      checkInStatus: "checked_in",
      attendanceId: "attendance_elvira",
      checkInAt: "2026-03-20T18:01:00.000Z",
      checkedOutAt: null,
      createdAt: "2026-03-20T18:00:00.000Z",
      classDate: "2026-03-20",
      classTime: "18:00",
      classStartsAt: "2026-03-20T18:00:00.000Z",
    }

    const newerPendingCardRow = {
      ...elviraVisiblePackageCheckIn,
      id: "elvira_pending_card_without_package",
      packageId: null,
      purchaseCategory: "other",
      fundingPayment: null,
      checkInStatus: "none",
      attendanceId: null,
      checkInAt: null,
      createdAt: "2026-03-20T18:05:00.000Z",
    }

    const card = buildHistoryStudentCard([elviraVisiblePackageCheckIn, newerPendingCardRow])

    expect(card).not.toBeNull()
    expect(card?.latestPayment.id).toBe("elvira_pending_card_without_package")

    const visiblePayment = resolveDailyVisiblePayment(card!.allPayments as unknown)

    expect(visiblePayment?.id).toBe("elvira_pkg_checkin_without_funding")
    expect(paymentStateLabel(visiblePayment as unknown)).toBe("Package paid")
    expect(isPaymentPaidForUi(visiblePayment as unknown)).toBe(true)
  })

  it("uses only visible attended rows for daily metrics even when payload totals are inflated", () => {
    const card = buildHistoryStudentCard([
      {
        id: "elvira_pkg_checkin",
        userId: "user_elvira",
        customerName: "Elvira",
        customerEmail: "elvira@example.com",
        customerPhone: "+54 11 5555 9999",
        courseTitle: "Salsa Beginners",
        courseSlug: "salsa-beginners",
        location: "Palermo",
        activePackage: { label: "8 classes" },
        packageId: "pkg_8",
        paymentChannel: "card",
        purchaseCategory: "package",
        amount: 0,
        currency: "usd",
        classPaid: false,
        fundingPayment: null,
        checkInStatus: "checked_in",
        attendanceId: "attendance_elvira",
        packageClassNumber: 6,
        checkInAt: "2026-03-20T18:01:00.000Z",
        checkedOutAt: null,
        createdAt: "2026-03-20T18:00:00.000Z",
        classDate: "2026-03-20",
        classTime: "18:00",
        classStartsAt: "2026-03-20T18:00:00.000Z",
        completedClassesTotal: 6,
        packageClassesUsedTotal: 6,
      },
      {
        id: "elvira_pending_card",
        userId: "user_elvira",
        customerName: "Elvira",
        customerEmail: "elvira@example.com",
        customerPhone: "+54 11 5555 9999",
        courseTitle: "Salsa Beginners",
        courseSlug: "salsa-beginners",
        location: "Palermo",
        activePackage: { label: "8 classes" },
        packageId: null,
        paymentChannel: "card",
        purchaseCategory: "other",
        amount: 2500,
        currency: "usd",
        classPaid: false,
        fundingPayment: null,
        checkInStatus: "none",
        attendanceId: null,
        packageClassNumber: null,
        checkInAt: null,
        checkedOutAt: null,
        createdAt: "2026-03-20T18:05:00.000Z",
        classDate: "2026-03-20",
        classTime: "18:00",
        classStartsAt: "2026-03-20T18:00:00.000Z",
        completedClassesTotal: 6,
        packageClassesUsedTotal: 6,
      },
    ] as unknown)

    expect(card).not.toBeNull()
    expect(card?.checkedInPayments).toBe(1)
    expect(card?.totalPackageClassesConsumed).toBe(1)
  })

  it("does not inflate daily metrics from package/completed totals when only one attended row is visible", () => {
    const card = buildHistoryStudentCard([
      {
        id: "elvira_pkg_checkin_misaligned",
        userId: "user_elvira",
        customerName: "Elvira",
        customerEmail: "elvira@example.com",
        customerPhone: "+54 11 5555 9999",
        courseTitle: "Salsa Beginners",
        courseSlug: "salsa-beginners",
        location: "Palermo",
        activePackage: { label: "8 classes" },
        packageId: "pkg_8",
        paymentChannel: "card",
        purchaseCategory: "package",
        amount: 0,
        currency: "usd",
        classPaid: false,
        fundingPayment: null,
        checkInStatus: "checked_in",
        attendanceId: "attendance_elvira_real_6",
        packageClassNumber: 6,
        checkInAt: "2026-03-20T18:01:00.000Z",
        checkedOutAt: null,
        createdAt: "2026-03-20T18:00:00.000Z",
        classDate: "2026-03-20",
        classTime: "18:00",
        classStartsAt: "2026-03-20T18:00:00.000Z",
        completedClassesTotal: 2,
        packageClassesUsedTotal: 6,
      },
    ] as unknown)

    expect(card).not.toBeNull()
    expect(card?.checkedInPayments).toBe(1)
    expect(card?.totalPackageClassesConsumed).toBe(1)
  })

  it("applies the requested daily badge tones for check-in and enrolled pin", () => {
    expect(
      checkInStateTone({
        checkInStatus: "checked_in",
      } as unknown)
    ).toBe("border-violet-400/40 bg-violet-400/12 text-violet-200")

    expect(
      resolveStudentPinTone({
        enabled: true,
        provisionalActive: false,
      } as unknown)
    ).toBe("border-blue-400/40 bg-blue-400/12 text-blue-200")
  })
})

describe("matchesStudentSearchQuery", () => {
  it("matches person fields case-insensitively", () => {
    expect(
      matchesStudentSearchQuery(
        {
          customerName: "Jane Doe",
          customerEmail: "jane@example.com",
          customerPhone: "+54 11 5555 1111",
          courseTitle: "Bachata Int",
          courseSlug: "bachata-int",
          location: "Palermo",
          activePackage: { label: "8 classes" },
        } as unknown,
        "JANE@EXAMPLE"
      )
    ).toBe(true)
  })
})

describe("resolveProfileCardDetails", () => {
  it("builds explicit labels for the fallback profile card contract", () => {
    expect(
      resolveProfileCardDetails({
        source: "profile",
        key: "user_1",
        userId: "user_1",
        displayName: "Ana Garcia",
        email: "ana@example.com",
        phone: null,
        avatarUrl: null,
        registeredAt: "2026-04-01T00:00:00.000Z",
        checkInStatus: "checked_in",
        latestClassAttended: {
          courseTitle: "Salsa Beginners",
          courseSlug: "salsa-beginners",
          startsAt: "2026-03-24T18:00:00.000Z",
          location: "Palermo",
        },
        latestCheckInAt: "2026-03-24T18:03:00.000Z",
        lastPayment: {
          date: "2026-03-20T18:00:00.000Z",
          amountCents: 2500,
          purchaseCategory: "dropin",
          courseTitle: "Salsa Beginners",
          paymentChannel: "card",
        },
        lastCourse: {
          courseTitle: "Bachata Intermediate",
          courseSlug: "bachata-intermediate",
        },
        paymentStatus: "failed",
        activePackage: {
          label: "12 Classes",
          remainingCredits: 5,
          isUnlimited: false,
          expiresAt: null,
        },
        remainingCredits: 5,
        outstandingBalance: 4100,
        pinStatus: "provisional",
        provisionalPinExpiresAt: "2026-04-04T23:59:00.000Z",
        cashSettlement: {
          paymentId: "purchase_cash_1",
          settlementStatus: "pending",
          settlementNote: "",
        },
        pendingSettlement: null,
        pointsBalance: 8,
      })
    ).toMatchObject({
      packageLabel: "12 Classes",
      packageValue: "5 credits",
      paymentStatusLabel: "Payment due",
      checkInStatusLabel: "Check-in",
      lastPaymentLabel: "$25.00 · Friday, 20 Mar 2026",
      lastCourseLabel: "Bachata Intermediate",
      outstandingBalanceLabel: "$41.00",
      latestLocationLabel: "Palermo",
      pinStatusLabel: "Provisional PIN",
    })
  })

  it("returns four persistent badges, adds check-in tooltip when available, and only exposes pending settlement controls for profile cards", () => {
    const student = {
      source: "profile",
      key: "user_2",
      userId: "user_2",
      displayName: "Lia Costa",
      email: "lia@example.com",
      phone: null,
      avatarUrl: null,
      registeredAt: "2026-04-01T00:00:00.000Z",
      checkInStatus: "none",
      latestClassAttended: null,
      latestCheckInAt: null,
      lastPayment: null,
      lastCourse: {
        courseTitle: "Kizomba Advanced",
        courseSlug: "kizomba-advanced",
      },
      paymentStatus: "pending",
      activePackage: null,
      remainingCredits: null,
      outstandingBalance: null,
      pinStatus: "enrolled",
      cashSettlement: {
        paymentId: "purchase_cash_2",
        settlementStatus: "paid",
        settlementNote: "settled on desk",
      },
      pendingSettlement: null,
      pointsBalance: 3,
    } as const

    expect(resolveProfileCardBadges(student as unknown).map((badge) => badge.label)).toEqual([
      "Points: 3",
      "Paid in full",
      "Last check-in",
      "PIN enrolled",
    ])
    expect(resolveProfileCardBadges(student as unknown)[2]).not.toHaveProperty("title")
    expect(resolveProfileCashSettlementControl(student as unknown)).toBeNull()
  })

  it("shows a payment due badge when the profile has an outstanding balance", () => {
    expect(
      resolveProfileCardBadges({
        source: "profile",
        key: "user_due",
        userId: "user_due",
        displayName: "Theo Diaz",
        email: "theo@example.com",
        phone: null,
        avatarUrl: null,
        registeredAt: "2026-04-01T00:00:00.000Z",
        checkInStatus: "none",
        latestClassAttended: null,
        latestCheckInAt: null,
        lastPayment: null,
        lastCourse: null,
        paymentStatus: "paid",
        activePackage: null,
        remainingCredits: null,
        outstandingBalance: 1800,
        pinStatus: "none",
        cashSettlement: null,
        pointsBalance: 0,
      } as unknown)[1]
    ).toMatchObject({
      key: "payment",
      label: "Payment due",
      tone: "border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)]",
    })
  })

  it("keeps pending settlement metadata available for processable profile cards", () => {
    expect(
      resolveProfileCashSettlementControl({
        source: "profile",
        key: "user_pending",
        userId: "user_pending",
        displayName: "Luna Perez",
        email: "luna@example.com",
        phone: null,
        avatarUrl: null,
        registeredAt: "2026-04-01T00:00:00.000Z",
        checkInStatus: "none",
        latestClassAttended: null,
        latestCheckInAt: null,
        lastPayment: null,
        lastCourse: null,
        paymentStatus: "pending",
        activePackage: null,
        remainingCredits: null,
        outstandingBalance: 3200,
        pinStatus: "none",
        cashSettlement: {
          paymentId: "purchase_cash_pending",
          settlementStatus: "pending",
          settlementNote: "awaiting desk",
        },
        pointsBalance: 0,
      } as unknown)
    ).toEqual({
      paymentId: "purchase_cash_pending",
      settlementStatus: "pending",
      settlementNote: "awaiting desk",
    })
  })

  it("falls back to pendingSettlement when cashSettlement is absent but outstanding balance exists", () => {
    expect(
      resolveProfileSettlementControl({
        source: "profile",
        key: "user_card_pending",
        userId: "user_card_pending",
        displayName: "Marco Lopez",
        email: "marco@example.com",
        phone: null,
        avatarUrl: null,
        registeredAt: "2026-04-01T00:00:00.000Z",
        checkInStatus: "none",
        latestClassAttended: null,
        latestCheckInAt: null,
        lastPayment: null,
        lastCourse: null,
        paymentStatus: "pending",
        activePackage: null,
        remainingCredits: null,
        outstandingBalance: 5000,
        pinStatus: "none",
        cashSettlement: null,
        pendingSettlement: {
          paymentId: "purchase_card_pending_1",
          settlementStatus: "pending",
          settlementNote: "",
        },
        pointsBalance: 0,
      } as unknown)
    ).toEqual({
      paymentId: "purchase_card_pending_1",
      settlementStatus: "pending",
      settlementNote: "",
    })
  })

  it("returns null from resolveProfileSettlementControl when both settlements are null", () => {
    expect(
      resolveProfileSettlementControl({
        source: "profile",
        key: "user_none",
        userId: "user_none",
        displayName: "No Balance",
        email: "nobalance@example.com",
        phone: null,
        avatarUrl: null,
        registeredAt: "2026-04-01T00:00:00.000Z",
        checkInStatus: "none",
        latestClassAttended: null,
        latestCheckInAt: null,
        lastPayment: null,
        lastCourse: null,
        paymentStatus: "paid",
        activePackage: null,
        remainingCredits: null,
        outstandingBalance: null,
        pinStatus: "none",
        cashSettlement: null,
        pendingSettlement: null,
        pointsBalance: 0,
      } as unknown)
    ).toBeNull()
  })

  it("returns null from resolveProfileSettlementControl after cash settlement is marked paid", () => {
    expect(
      resolveProfileSettlementControl({
        source: "profile",
        key: "user_settled_cash",
        userId: "user_settled_cash",
        displayName: "Settled Cash",
        email: "settled@example.com",
        phone: null,
        avatarUrl: null,
        registeredAt: "2026-04-01T00:00:00.000Z",
        checkInStatus: "none",
        latestClassAttended: null,
        latestCheckInAt: null,
        lastPayment: null,
        lastCourse: null,
        paymentStatus: "paid",
        activePackage: null,
        remainingCredits: null,
        outstandingBalance: null,
        pinStatus: "none",
        cashSettlement: {
          paymentId: "purchase_cash_settled",
          settlementStatus: "paid",
          settlementNote: "",
        },
        pendingSettlement: null,
        pointsBalance: 0,
      } as unknown)
    ).toBeNull()
  })

  it("returns null from resolveProfileSettlementControl after pending settlement is marked paid", () => {
    expect(
      resolveProfileSettlementControl({
        source: "profile",
        key: "user_settled_pending",
        userId: "user_settled_pending",
        displayName: "Settled Pending",
        email: "settled2@example.com",
        phone: null,
        avatarUrl: null,
        registeredAt: "2026-04-01T00:00:00.000Z",
        checkInStatus: "none",
        latestClassAttended: null,
        latestCheckInAt: null,
        lastPayment: null,
        lastCourse: null,
        paymentStatus: "pending",
        activePackage: null,
        remainingCredits: null,
        outstandingBalance: null,
        pinStatus: "none",
        cashSettlement: null,
        pendingSettlement: {
          paymentId: "purchase_card_settled",
          settlementStatus: "paid",
          settlementNote: "",
        },
        pointsBalance: 0,
      } as unknown)
    ).toBeNull()
  })

  it("prefers cashSettlement over pendingSettlement when both are present", () => {
    expect(
      resolveProfileSettlementControl({
        source: "profile",
        key: "user_both",
        userId: "user_both",
        displayName: "Both Types",
        email: "both@example.com",
        phone: null,
        avatarUrl: null,
        registeredAt: "2026-04-01T00:00:00.000Z",
        checkInStatus: "none",
        latestClassAttended: null,
        latestCheckInAt: null,
        lastPayment: null,
        lastCourse: null,
        paymentStatus: "pending",
        activePackage: null,
        remainingCredits: null,
        outstandingBalance: 7000,
        pinStatus: "none",
        cashSettlement: {
          paymentId: "purchase_cash_3",
          settlementStatus: "pending",
          settlementNote: "cash note",
        },
        pendingSettlement: {
          paymentId: "purchase_card_3",
          settlementStatus: "pending",
          settlementNote: "",
        },
        pointsBalance: 0,
      } as unknown)
    ).toEqual({
      paymentId: "purchase_cash_3",
      settlementStatus: "pending",
      settlementNote: "cash note",
    })
  })

  it("adds a full datetime tooltip to the check-in badge when latestCheckInAt exists", () => {
    const checkInBadge = resolveProfileCardBadges({
      source: "profile",
      key: "user_4",
      userId: "user_4",
      displayName: "Tali Gomez",
      email: "tali@example.com",
      phone: null,
      avatarUrl: null,
      registeredAt: "2026-04-01T00:00:00.000Z",
      checkInStatus: "checked_in",
      latestClassAttended: null,
      latestCheckInAt: "2026-04-04T18:03:45.000Z",
      lastPayment: null,
      lastCourse: null,
      paymentStatus: null,
      activePackage: null,
      remainingCredits: null,
      outstandingBalance: null,
      pinStatus: "none",
      cashSettlement: null,
      pointsBalance: 0,
    } as unknown)[2]

    expect(checkInBadge).toMatchObject({
      key: "check-in",
      label: "Last check-in",
      title: formatStudentPaymentCardDateTimeLabel("2026-04-04T18:03:45.000Z"),
    })
  })

  it("applies the dedicated tone to the Last check-in badge", () => {
    const badge = resolveProfileCardBadges({
      source: "profile",
      key: "user_tone",
      userId: "user_tone",
      displayName: "Tone Check",
      email: "tone@example.com",
      phone: null,
      avatarUrl: null,
      registeredAt: "2026-04-01T00:00:00.000Z",
      checkInStatus: "checked_out",
      latestClassAttended: null,
      latestCheckInAt: "2026-04-04T18:03:45.000Z",
      lastPayment: null,
      lastCourse: null,
      paymentStatus: null,
      activePackage: null,
      remainingCredits: null,
      outstandingBalance: null,
      pinStatus: "none",
      cashSettlement: null,
      pointsBalance: 0,
    } as unknown)[2]

    expect(badge).toMatchObject({
      key: "check-in",
      tone: "border-sky-400/40 bg-sky-400/12 text-sky-200",
    })
  })

  it("keeps last course separate from last payment while removing duplicate payment and check-in detail rows", () => {
    const labels = resolveProfileCardDetailRows({
      source: "profile",
      key: "user_3",
      userId: "user_3",
      displayName: "Noa Ruiz",
      email: "noa@example.com",
      phone: "+54 11 3333 2222",
      avatarUrl: null,
      registeredAt: "2026-04-01T00:00:00.000Z",
      checkInStatus: "checked_out",
      latestClassAttended: {
        courseTitle: "Urban Bachata",
        courseSlug: "urban-bachata",
        startsAt: "2026-03-24T18:00:00.000Z",
        location: "Belgrano",
      },
      latestCheckInAt: "2026-03-24T18:01:00.000Z",
        lastPayment: {
          date: "2026-03-20T18:00:00.000Z",
          amountCents: 3200,
          purchaseCategory: "dropin",
          courseTitle: "Salsa Beginners",
          paymentChannel: "cash",
        },
      lastCourse: {
        courseTitle: "Urban Bachata",
        courseSlug: "urban-bachata",
      },
      paymentStatus: "paid",
      activePackage: {
        label: "8 Classes",
        remainingCredits: 2,
        isUnlimited: false,
        expiresAt: null,
      },
      remainingCredits: 2,
      outstandingBalance: 0,
      pinStatus: "none",
      cashSettlement: null,
      pointsBalance: 1,
    } as unknown).map((row) => row.label)

    expect(labels).toEqual([
      "Location",
      "Email",
      "Phone",
      "Package",
      "Credits",
      "Last payment",
      "Last course",
    ])
  })
})

describe("room helpers", () => {
  const rooms = [
    { id: "room-active-1", name: "Studio A", capacity: 24, location: "Main floor", active: true },
    { id: "room-inactive", name: "Studio B", capacity: 18, location: "Upstairs", active: false },
    { id: "room-active-2", name: "Studio C", capacity: 30, location: null, active: true },
  ]

  it("keeps an inactive selected room visible in default-room selectors", () => {
    expect(buildCourseRoomOptions(rooms as unknown, "room-inactive").map((room) => room.id)).toEqual([
      "room-inactive",
      "room-active-1",
      "room-active-2",
    ])
  })

  it("builds room lookup maps and room list filters consistently", () => {
    expect(buildRoomLookup(rooms as unknown)["room-active-1"]?.name).toBe("Studio A")
    expect(filterVisibleRooms(rooms as unknown, "upstairs", "inactive").map((room) => room.id)).toEqual(["room-inactive"])
    expect(filterVisibleRooms(rooms as unknown, "studio", "active").map((room) => room.id)).toEqual([
      "room-active-1",
      "room-active-2",
    ])
  })

  it("resolves disable button state for busy and inactive rooms", () => {
    expect(resolveRoomDisableActionState(rooms[0] as unknown, "room-active-1")).toEqual({
      disabled: true,
      label: "Disabling...",
    })
    expect(resolveRoomDisableActionState(rooms[1] as unknown, null)).toEqual({
      disabled: true,
      label: "Disabled",
    })
  })

  it("prioritizes room API errors in the school catalog banner fallback", () => {
    expect(resolveRoomCatalogErrorMessage([{}, { error: "Room endpoint failed." }, { error: "Packages failed." }])).toBe(
      "Room endpoint failed."
    )
    expect(resolveRoomCatalogErrorMessage([{}, {}, {}])).toBe("Failed to load school catalog.")
  })
})

describe("isInsideCriticalClassWindow", () => {
  const classStartsAt = new Date("2026-05-05T18:00:00.000Z").getTime()
  const eventsByDay = {
    "2026-05-05": [
      {
        attendanceId: "att_1",
        status: "scheduled",
        startsAtIso: new Date(classStartsAt).toISOString(),
        timeLabel: "2:00 PM",
        courseSlug: "salsa-open",
        courseTitle: "Salsa Open",
        userId: "user_1",
        userName: "Test",
        userEmail: "test@example.com",
        userPhone: "",
      },
    ],
  }

  it("returns true 15 minutes before class start", () => {
    const nowMs = classStartsAt - 15 * 60 * 1000
    expect(isInsideCriticalClassWindow(eventsByDay, nowMs)).toBe(true)
  })

  it("returns true at class start", () => {
    expect(isInsideCriticalClassWindow(eventsByDay, classStartsAt)).toBe(true)
  })

  it("returns true 14 minutes after class start", () => {
    const nowMs = classStartsAt + 14 * 60 * 1000
    expect(isInsideCriticalClassWindow(eventsByDay, nowMs)).toBe(true)
  })

  it("returns true at exactly 15 minutes after class start", () => {
    const nowMs = classStartsAt + 15 * 60 * 1000
    expect(isInsideCriticalClassWindow(eventsByDay, nowMs)).toBe(true)
  })

  it("returns false 16 minutes before class start", () => {
    const nowMs = classStartsAt - 16 * 60 * 1000
    expect(isInsideCriticalClassWindow(eventsByDay, nowMs)).toBe(false)
  })

  it("returns false 16 minutes after class start", () => {
    const nowMs = classStartsAt + 16 * 60 * 1000
    expect(isInsideCriticalClassWindow(eventsByDay, nowMs)).toBe(false)
  })

  it("returns false for empty events", () => {
    expect(isInsideCriticalClassWindow({}, classStartsAt)).toBe(false)
  })

  it("handles multiple classes and returns true if any is in window", () => {
    const pastClassStart = new Date("2026-05-05T10:00:00.000Z").toISOString()
    const multiEvents = {
      "2026-05-05": [
        { ...eventsByDay["2026-05-05"][0], startsAtIso: pastClassStart },
        eventsByDay["2026-05-05"][0],
      ],
    }
    // 16 min after past class, but exactly at upcoming class start
    const nowMs = classStartsAt
    expect(isInsideCriticalClassWindow(multiEvents, nowMs)).toBe(true)
  })

  it("skips events with invalid dates", () => {
    const badEvents = {
      "2026-05-05": [{ ...eventsByDay["2026-05-05"][0], startsAtIso: "not-a-date" }],
    }
    expect(isInsideCriticalClassWindow(badEvents, classStartsAt)).toBe(false)
  })
})
