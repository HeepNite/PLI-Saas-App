import { WEEKDAY_LABELS } from "./staffAdminConstants"
import { isCheckedInStatus } from "./paymentState"
import type { PaymentRow, ReportsSuggestion } from "./staffAdminTypes"
import {
  parseMinutesFromClassTime,
  resolveTimeWindowByMinute,
} from "./staffCourseScheduleHelpers"

// Pure date helpers used by the reports analytics pipeline.
// Kept here (and not in a generic util) so reports stays a self-contained slice.

export const parseDateInputStart = (value: string): number | null => {
  if (!value) return null
  const ts = Date.parse(`${value}T00:00:00`)
  if (!Number.isFinite(ts)) return null
  return ts
}

export const parseDateInputEnd = (value: string): number | null => {
  if (!value) return null
  const ts = Date.parse(`${value}T23:59:59.999`)
  if (!Number.isFinite(ts)) return null
  return ts
}

export const getWeekStartTs = (input: Date): number => {
  const value = new Date(input)
  value.setHours(0, 0, 0, 0)
  const weekdayMondayZero = (value.getDay() + 6) % 7
  value.setDate(value.getDate() - weekdayMondayZero)
  return value.getTime()
}

export const formatWeekRangeLabel = (weekStartTs: number): string => {
  const start = new Date(weekStartTs)
  const end = new Date(weekStartTs)
  end.setDate(end.getDate() + 6)
  const startLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start)
  const endLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(end)
  return `${startLabel} – ${endLabel}`
}

export const filterPaymentsByDateRange = (
  payments: PaymentRow[],
  dateFrom: string,
  dateTo: string
): PaymentRow[] => {
  const rawStartTs = parseDateInputStart(dateFrom)
  const rawEndTs = parseDateInputEnd(dateTo)
  let startTs = rawStartTs
  let endTs = rawEndTs

  if (startTs !== null && endTs !== null && startTs > endTs) {
    ;[startTs, endTs] = [endTs, startTs]
  }

  return payments.filter((item) => {
    const createdTs = Date.parse(item.createdAt)
    if (!Number.isFinite(createdTs)) return false
    if (startTs !== null && createdTs < startTs) return false
    if (endTs !== null && createdTs > endTs) return false
    return true
  })
}

export const buildReportsRangeLabel = (dateFrom: string, dateTo: string): string => {
  if (!dateFrom && !dateTo) return "All time"
  if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`
  if (dateFrom) return `From ${dateFrom}`
  return `Until ${dateTo}`
}

export type ReportsCourseRow = {
  courseTitle: string
  paidSales: number
  paidRevenueCents: number
  checkIns: number
}

export type ReportsMonthRow = {
  monthKey: string
  monthLabel: string
  paidSales: number
  pendingSales: number
  paidRevenueCents: number
}

export type ReportsChannelRow = {
  key: string
  sales: number
  paidRevenueCents: number
}

export type ReportsWeekdayRow = {
  weekday: number
  label: string
  paidSales: number
  paidRevenueCents: number
}

export type ReportsTimeWindowRow = {
  window: string
  paidSales: number
  paidRevenueCents: number
}

export type ReportsCohortRow = {
  weekStartTs: number
  weekLabel: string
  students: number
  rates: Array<{ offset: number; active: number; percentage: number }>
}

export type ReportsData = {
  totalRevenueCents: number
  totalPaidSales: number
  avgTicketCents: number
  uniqueStudents: number
  checkInRate: number
  topCourses: ReportsCourseRow[]
  monthlyPerformance: ReportsMonthRow[]
  monthlyRevenueSeries: ReportsMonthRow[]
  channelBreakdown: ReportsChannelRow[]
  weekdayPerformance: ReportsWeekdayRow[]
  timeWindowRanking: ReportsTimeWindowRow[]
  cohortRetention: ReportsCohortRow[]
  paidPackageSales: number
  paidDropInSales: number
  pendingStripeSales: number
  totalRows: number
}

export type ReportsChartMeta = {
  maxMonthlyRevenue: number
  maxTopCourseRevenue: number
  maxWindowRevenue: number
}

// Builds all reports KPIs and groupings from the filtered payment rows.
// Keeping the loop body in one place avoids re-iterating payments per metric.
export const buildReportsData = (filteredPayments: PaymentRow[]): ReportsData => {
  const paidPayments = filteredPayments.filter((item) => item.classPaid)
  const totalRevenueCents = paidPayments.reduce((sum, item) => sum + item.amount, 0)
  const totalPaidSales = paidPayments.length
  const avgTicketCents = totalPaidSales > 0 ? Math.round(totalRevenueCents / totalPaidSales) : 0
  const uniqueStudents = new Set(
    paidPayments.map((item) => item.userId || item.customerEmail || item.customerPhone || item.id).filter(Boolean)
  ).size
  const checkedInPaid = paidPayments.filter((item) => isCheckedInStatus(item.checkInStatus)).length
  const checkInRate = totalPaidSales > 0 ? Math.round((checkedInPaid / totalPaidSales) * 100) : 0

  const courseAgg = new Map<string, ReportsCourseRow>()
  const monthAgg = new Map<string, ReportsMonthRow>()
  const channelAgg = new Map<string, ReportsChannelRow>()
  const weekdayAgg = new Map<number, ReportsWeekdayRow>()
  const timeWindowAgg = new Map<string, ReportsTimeWindowRow>()
  const paidWeeksByUser = new Map<string, Set<number>>()
  const firstPaidWeekByUser = new Map<string, number>()
  let paidPackageSales = 0
  let paidDropInSales = 0

  for (const payment of filteredPayments) {
    const isPaid = payment.classPaid
    const courseKey = payment.courseSlug || payment.courseTitle || "unknown-course"
    const courseRow = courseAgg.get(courseKey) || {
      courseTitle: payment.courseTitle || payment.courseSlug || "Untitled course",
      paidSales: 0,
      paidRevenueCents: 0,
      checkIns: 0,
    }
    if (isPaid) {
      courseRow.paidSales += 1
      courseRow.paidRevenueCents += payment.amount
    }
    if (isCheckedInStatus(payment.checkInStatus)) {
      courseRow.checkIns += 1
    }
    courseAgg.set(courseKey, courseRow)

    const created = Date.parse(payment.createdAt)
    if (Number.isFinite(created)) {
      const date = new Date(created)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date)
      const monthRow = monthAgg.get(monthKey) || {
        monthKey,
        monthLabel,
        paidSales: 0,
        pendingSales: 0,
        paidRevenueCents: 0,
      }
      if (isPaid) {
        monthRow.paidSales += 1
        monthRow.paidRevenueCents += payment.amount
      } else {
        monthRow.pendingSales += 1
      }
      monthAgg.set(monthKey, monthRow)

      if (isPaid) {
        const userKey = payment.userId || payment.customerEmail || payment.customerPhone || payment.id
        const weekStartTs = getWeekStartTs(date)
        if (!paidWeeksByUser.has(userKey)) {
          paidWeeksByUser.set(userKey, new Set<number>())
        }
        paidWeeksByUser.get(userKey)!.add(weekStartTs)
        const firstWeek = firstPaidWeekByUser.get(userKey)
        if (typeof firstWeek !== "number" || weekStartTs < firstWeek) {
          firstPaidWeekByUser.set(userKey, weekStartTs)
        }
      }
    }

    const channelKey = payment.paymentChannel === "unknown" ? "other" : payment.paymentChannel
    const channelRow = channelAgg.get(channelKey) || { key: channelKey, sales: 0, paidRevenueCents: 0 }
    channelRow.sales += 1
    if (isPaid) {
      channelRow.paidRevenueCents += payment.amount
    }
    channelAgg.set(channelKey, channelRow)

    if (isPaid) {
      if (payment.purchaseCategory === "package") paidPackageSales += 1
      if (payment.purchaseCategory === "dropin") paidDropInSales += 1

      let weekdaySourceDate: Date | null = null
      const startsAtTs = payment.classStartsAt ? Date.parse(payment.classStartsAt) : NaN
      if (Number.isFinite(startsAtTs)) {
        weekdaySourceDate = new Date(startsAtTs)
      } else if (Number.isFinite(created)) {
        weekdaySourceDate = new Date(created)
      }
      if (weekdaySourceDate) {
        const weekday = weekdaySourceDate.getDay()
        const weekdayRow = weekdayAgg.get(weekday) || {
          weekday,
          label: WEEKDAY_LABELS[weekday] || String(weekday),
          paidSales: 0,
          paidRevenueCents: 0,
        }
        weekdayRow.paidSales += 1
        weekdayRow.paidRevenueCents += payment.amount
        weekdayAgg.set(weekday, weekdayRow)
      }

      let minutesFromMidnight: number | null = null
      if (Number.isFinite(startsAtTs)) {
        const startsAtDate = new Date(startsAtTs)
        minutesFromMidnight = startsAtDate.getHours() * 60 + startsAtDate.getMinutes()
      } else {
        minutesFromMidnight = parseMinutesFromClassTime(payment.classTime)
      }

      if (typeof minutesFromMidnight === "number") {
        const windowLabel = resolveTimeWindowByMinute(minutesFromMidnight)
        const windowRow = timeWindowAgg.get(windowLabel) || {
          window: windowLabel,
          paidSales: 0,
          paidRevenueCents: 0,
        }
        windowRow.paidSales += 1
        windowRow.paidRevenueCents += payment.amount
        timeWindowAgg.set(windowLabel, windowRow)
      }
    }
  }

  const topCourses = [...courseAgg.values()].sort((a, b) => {
    if (b.paidRevenueCents !== a.paidRevenueCents) return b.paidRevenueCents - a.paidRevenueCents
    return b.paidSales - a.paidSales
  })

  const monthlyPerformance = [...monthAgg.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey))
  const channelBreakdown = [...channelAgg.values()].sort((a, b) => b.paidRevenueCents - a.paidRevenueCents)
  const weekdayPerformance = [...weekdayAgg.values()].sort((a, b) => a.weekday - b.weekday)
  const timeWindowRanking = [...timeWindowAgg.values()].sort((a, b) => b.paidRevenueCents - a.paidRevenueCents)
  const monthlyRevenueSeries = [...monthlyPerformance].sort((a, b) => a.monthKey.localeCompare(b.monthKey))

  const cohortUsersByWeek = new Map<number, string[]>()
  for (const [userKey, weekTs] of firstPaidWeekByUser.entries()) {
    const users = cohortUsersByWeek.get(weekTs) || []
    users.push(userKey)
    cohortUsersByWeek.set(weekTs, users)
  }
  const cohortRetention = [...cohortUsersByWeek.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 8)
    .map(([cohortWeekTs, users]) => {
      const students = users.length
      const rates = [0, 1, 2, 3, 4].map((offset) => {
        const activeWeekTs = cohortWeekTs + offset * 7 * 24 * 60 * 60 * 1000
        const active = users.reduce((sum, userKey) => {
          const weeks = paidWeeksByUser.get(userKey)
          if (weeks?.has(activeWeekTs)) return sum + 1
          return sum
        }, 0)
        const percentage = students > 0 ? Math.round((active / students) * 100) : 0
        return { offset, active, percentage }
      })
      return {
        weekStartTs: cohortWeekTs,
        weekLabel: formatWeekRangeLabel(cohortWeekTs),
        students,
        rates,
      }
    })

  return {
    totalRevenueCents,
    totalPaidSales,
    avgTicketCents,
    uniqueStudents,
    checkInRate,
    topCourses,
    monthlyPerformance,
    monthlyRevenueSeries,
    channelBreakdown,
    weekdayPerformance,
    timeWindowRanking,
    cohortRetention,
    paidPackageSales,
    paidDropInSales,
    pendingStripeSales: filteredPayments.filter((item) => !item.classPaid).length,
    totalRows: filteredPayments.length,
  }
}

export const buildReportsChartMeta = (reportsData: ReportsData): ReportsChartMeta => ({
  maxMonthlyRevenue: Math.max(1, ...reportsData.monthlyRevenueSeries.map((item) => item.paidRevenueCents)),
  maxTopCourseRevenue: Math.max(1, ...reportsData.topCourses.slice(0, 8).map((item) => item.paidRevenueCents)),
  maxWindowRevenue: Math.max(1, ...reportsData.timeWindowRanking.map((item) => item.paidRevenueCents)),
})

const resolveMondayPaidSales = (reportsData: ReportsData): number =>
  reportsData.weekdayPerformance.find((item) => item.weekday === 1)?.paidSales || 0

const resolveAvgPaidSalesPerDay = (reportsData: ReportsData): number => {
  if (reportsData.weekdayPerformance.length === 0) return 0
  const total = reportsData.weekdayPerformance.reduce((sum, item) => sum + item.paidSales, 0)
  return total / reportsData.weekdayPerformance.length
}

const resolveLatestCohortW1 = (reportsData: ReportsData): number =>
  reportsData.cohortRetention[0]?.rates[1]?.percentage || 0

const resolvePackageSharePct = (reportsData: ReportsData): number =>
  reportsData.totalPaidSales > 0
    ? Math.round((reportsData.paidPackageSales / reportsData.totalPaidSales) * 100)
    : 0

// Local rule-based suggestion builders. Each builder takes the metrics it needs
// instead of the whole reports object to keep the rule explicit and testable.

const buildMondayDemandSuggestion = (mondayPaidSales: number, avgPaidSalesPerDay: number): ReportsSuggestion => {
  const mondayGap = Math.max(0, Math.round(avgPaidSalesPerDay - mondayPaidSales))
  const priority: ReportsSuggestion["priority"] = mondayGap >= 3 ? "High" : mondayGap >= 1 ? "Medium" : "Low"
  return {
    id: "monday-demand",
    objective: "monday_sales",
    title: "Increase Monday demand",
    priority,
    insight: `Monday paid sales: ${mondayPaidSales} (daily average: ${avgPaidSalesPerDay.toFixed(1)}).`,
    proposal:
      mondayGap > 0
        ? "Launch a Monday-only offer, push reminders on Sunday evening, and test one trial-friendly time slot."
        : "Monday is healthy. Keep momentum with a referral mini-campaign focused on repeat students.",
    actions: [
      "Run a Monday promo code for first-time and returning students.",
      "Send segmented reminders Sunday 6-9 PM with one-click booking links.",
      "A/B test class title copy emphasizing outcomes and class vibe.",
    ],
    aiBrief: `Goal: increase Monday class sales. Context: Monday paid sales ${mondayPaidSales}, average daily ${avgPaidSalesPerDay.toFixed(1)}. Generate a 4-week experiment plan with offers, messaging, and KPI targets.`,
  }
}

const buildClassQualitySuggestion = (checkInRate: number): ReportsSuggestion => {
  const priority: ReportsSuggestion["priority"] = checkInRate < 60 ? "High" : checkInRate < 75 ? "Medium" : "Low"
  return {
    id: "class-quality",
    objective: "class_quality",
    title: "Improve class quality signal",
    priority,
    insight: `Current check-in rate: ${checkInRate}%.`,
    proposal:
      checkInRate < 75
        ? "Standardize pre-class reminders and post-class feedback loops to reduce no-show behavior and improve perceived quality."
        : "Keep current quality baseline and add structured feedback to protect consistency at scale.",
    actions: [
      "Send reminders 24h + 2h before class with a clear class value statement.",
      "Collect a 2-question pulse after class (energy + clarity).",
      "Flag classes below target check-in rate for instructor review.",
    ],
    aiBrief: `Goal: improve class quality and attendance consistency. Current check-in rate is ${checkInRate}%. Propose process, messaging templates, and instructor feedback loops.`,
  }
}

const buildRetentionSuggestion = (w1: number, lastCohort: ReportsCohortRow | undefined): ReportsSuggestion => {
  const priority: ReportsSuggestion["priority"] = w1 < 40 ? "High" : w1 < 60 ? "Medium" : "Low"
  return {
    id: "retention-cohort",
    objective: "retention",
    title: "Raise week-1 retention",
    priority,
    insight: `Latest cohort W1 retention: ${w1}%${lastCohort ? ` (${lastCohort.weekLabel})` : ""}.`,
    proposal:
      w1 < 60
        ? "Introduce a structured second-visit trigger within 72h after first class, with clear next-step recommendation."
        : "Retention is stable. Expand retention playbook to W2 and W3 progression milestones.",
    actions: [
      "Send a personalized follow-up after first class with the best next slot.",
      "Offer a second-class guarantee coupon valid 7 days.",
      "Track W1 conversion by course and instructor to identify friction points.",
    ],
    aiBrief: `Goal: improve cohort retention. Latest W1 is ${w1}%. Build a retention workflow from first class to second booking with messaging and incentives.`,
  }
}

const buildPackageConversionSuggestion = (
  packageShare: number,
  paidPackageSales: number,
  paidDropInSales: number
): ReportsSuggestion => {
  const priority: ReportsSuggestion["priority"] = packageShare < 25 ? "High" : packageShare < 45 ? "Medium" : "Low"
  return {
    id: "package-conversion",
    objective: "package_mix",
    title: "Increase package conversion",
    priority,
    insight: `Package share on paid sales: ${packageShare}% (packages: ${paidPackageSales}, drop-in: ${paidDropInSales}).`,
    proposal:
      packageShare < 45
        ? "Move frequent drop-in students to package plans with clear savings and progression benefits."
        : "Package mix is healthy; improve package upsell timing during peak demand windows.",
    actions: [
      "Show package savings directly in checkout for repeat drop-in users.",
      "Offer a limited-time upgrade after second paid class.",
      "Highlight package benefits in teacher scripts and post-class follow-up.",
    ],
    aiBrief: `Goal: increase package conversion. Current package share is ${packageShare}% with ${paidPackageSales} package sales and ${paidDropInSales} drop-in sales. Create upsell strategy and trigger points.`,
  }
}

const buildPendingRecoverySuggestion = (pendingStripeSales: number): ReportsSuggestion => {
  const priority: ReportsSuggestion["priority"] =
    pendingStripeSales >= 8 ? "High" : pendingStripeSales >= 3 ? "Medium" : "Low"
  return {
    id: "pending-recovery",
    objective: "pending_recovery",
    title: "Recover pending payments",
    priority,
    insight: `Pending Stripe payments in range: ${pendingStripeSales}.`,
    proposal:
      pendingStripeSales > 0
        ? "Automate recovery touchpoints for pending checkouts to reduce lost demand."
        : "Pending volume is controlled. Keep alerts active and monitor anomalies weekly.",
    actions: [
      "Send automated payment recovery reminders at 30m and 24h.",
      "Prioritize manual follow-up for high-intent students (repeat profile or package interest).",
      "Track recovery rate by payment channel and time window.",
    ],
    aiBrief: `Goal: recover pending payments. Current pending Stripe count: ${pendingStripeSales}. Propose automation and manual follow-up playbook with measurable KPIs.`,
  }
}

export const buildLocalReportSuggestions = (reportsData: ReportsData): ReportsSuggestion[] => {
  const mondayPaidSales = resolveMondayPaidSales(reportsData)
  const avgPaidSalesPerDay = resolveAvgPaidSalesPerDay(reportsData)
  const w1 = resolveLatestCohortW1(reportsData)
  const packageShare = resolvePackageSharePct(reportsData)

  return [
    buildMondayDemandSuggestion(mondayPaidSales, avgPaidSalesPerDay),
    buildClassQualitySuggestion(reportsData.checkInRate),
    buildRetentionSuggestion(w1, reportsData.cohortRetention[0]),
    buildPackageConversionSuggestion(packageShare, reportsData.paidPackageSales, reportsData.paidDropInSales),
    buildPendingRecoverySuggestion(reportsData.pendingStripeSales),
  ]
}

export type ReportSuggestionsMetrics = {
  rangeLabel: string
  totalRows: number
  totalPaidSales: number
  totalRevenueCents: number
  avgTicketCents: number
  uniqueStudents: number
  checkInRate: number
  pendingStripeSales: number
  mondayPaidSales: number
  avgPaidSalesPerDay: number
  paidPackageSales: number
  paidDropInSales: number
  packageSharePct: number
  latestCohortWeek: string | null
  latestCohortW1RetentionPct: number
  topCourses: Array<{ title: string; paidSales: number; paidRevenueCents: number; checkIns: number }>
  timeWindowRanking: Array<{ window: string; paidSales: number; paidRevenueCents: number }>
  channelBreakdown: Array<{ key: string; sales: number; paidRevenueCents: number }>
}

export const buildReportSuggestionsMetrics = (
  reportsData: ReportsData,
  rangeLabel: string
): ReportSuggestionsMetrics => {
  const mondayPaidSales = resolveMondayPaidSales(reportsData)
  const avgPaidSalesPerDay =
    reportsData.weekdayPerformance.length > 0
      ? Number(resolveAvgPaidSalesPerDay(reportsData).toFixed(2))
      : 0
  const latestCohort = reportsData.cohortRetention[0]
  const packageSharePct = resolvePackageSharePct(reportsData)

  return {
    rangeLabel,
    totalRows: reportsData.totalRows,
    totalPaidSales: reportsData.totalPaidSales,
    totalRevenueCents: reportsData.totalRevenueCents,
    avgTicketCents: reportsData.avgTicketCents,
    uniqueStudents: reportsData.uniqueStudents,
    checkInRate: reportsData.checkInRate,
    pendingStripeSales: reportsData.pendingStripeSales,
    mondayPaidSales,
    avgPaidSalesPerDay,
    paidPackageSales: reportsData.paidPackageSales,
    paidDropInSales: reportsData.paidDropInSales,
    packageSharePct,
    latestCohortWeek: latestCohort?.weekLabel || null,
    latestCohortW1RetentionPct: latestCohort?.rates?.[1]?.percentage || 0,
    topCourses: reportsData.topCourses.slice(0, 6).map((course) => ({
      title: course.courseTitle,
      paidSales: course.paidSales,
      paidRevenueCents: course.paidRevenueCents,
      checkIns: course.checkIns,
    })),
    timeWindowRanking: reportsData.timeWindowRanking.map((window) => ({
      window: window.window,
      paidSales: window.paidSales,
      paidRevenueCents: window.paidRevenueCents,
    })),
    channelBreakdown: reportsData.channelBreakdown.map((channel) => ({
      key: channel.key,
      sales: channel.sales,
      paidRevenueCents: channel.paidRevenueCents,
    })),
  }
}
