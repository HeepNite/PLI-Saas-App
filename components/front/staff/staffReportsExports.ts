import { formatMoney } from "./staffAdminFormatters"
import type { ReportsData } from "./staffReportsAggregations"

// Pure string builders for reports CSV/PDF exports.
// Side effects (Blob/anchor click, popup window) stay in the hook caller.

const quoteCsv = (value: string | number): string => `"${String(value ?? "").replace(/"/g, '""')}"`

const escapeHtml = (value: string | number): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

export const buildReportsCsv = (reportsData: ReportsData, rangeLabel: string): string => {
  const lines: string[] = []

  lines.push("Summary")
  lines.push(`${quoteCsv("Range")},${quoteCsv(rangeLabel)}`)
  lines.push(`${quoteCsv("Paid revenue")},${quoteCsv(formatMoney(reportsData.totalRevenueCents))}`)
  lines.push(`${quoteCsv("Paid sales")},${quoteCsv(reportsData.totalPaidSales)}`)
  lines.push(`${quoteCsv("Avg ticket")},${quoteCsv(formatMoney(reportsData.avgTicketCents))}`)
  lines.push(`${quoteCsv("Unique students")},${quoteCsv(reportsData.uniqueStudents)}`)
  lines.push(`${quoteCsv("Check-in rate")},${quoteCsv(`${reportsData.checkInRate}%`)}`)
  lines.push(`${quoteCsv("Stripe pending")},${quoteCsv(reportsData.pendingStripeSales)}`)
  lines.push("")

  lines.push("Top courses")
  lines.push([quoteCsv("Course"), quoteCsv("Paid sales"), quoteCsv("Revenue"), quoteCsv("Check-ins")].join(","))
  for (const row of reportsData.topCourses) {
    lines.push(
      [quoteCsv(row.courseTitle), quoteCsv(row.paidSales), quoteCsv(formatMoney(row.paidRevenueCents)), quoteCsv(row.checkIns)].join(",")
    )
  }
  lines.push("")

  lines.push("Monthly performance")
  lines.push([quoteCsv("Month"), quoteCsv("Paid sales"), quoteCsv("Pending"), quoteCsv("Revenue")].join(","))
  for (const row of reportsData.monthlyPerformance) {
    lines.push(
      [quoteCsv(row.monthLabel), quoteCsv(row.paidSales), quoteCsv(row.pendingSales), quoteCsv(formatMoney(row.paidRevenueCents))].join(",")
    )
  }
  lines.push("")

  lines.push("Payment channels")
  lines.push([quoteCsv("Channel"), quoteCsv("Sales"), quoteCsv("Revenue")].join(","))
  for (const row of reportsData.channelBreakdown) {
    lines.push([quoteCsv(row.key), quoteCsv(row.sales), quoteCsv(formatMoney(row.paidRevenueCents))].join(","))
  }
  lines.push("")

  lines.push("Time windows")
  lines.push([quoteCsv("Window"), quoteCsv("Paid sales"), quoteCsv("Revenue")].join(","))
  for (const row of reportsData.timeWindowRanking) {
    lines.push([quoteCsv(row.window), quoteCsv(row.paidSales), quoteCsv(formatMoney(row.paidRevenueCents))].join(","))
  }
  lines.push("")

  lines.push("Cohort retention")
  lines.push(
    [quoteCsv("Cohort week"), quoteCsv("Students"), quoteCsv("W0"), quoteCsv("W1"), quoteCsv("W2"), quoteCsv("W3"), quoteCsv("W4")].join(",")
  )
  for (const cohort of reportsData.cohortRetention) {
    const [w0, w1, w2, w3, w4] = cohort.rates
    lines.push(
      [
        quoteCsv(cohort.weekLabel),
        quoteCsv(cohort.students),
        quoteCsv(`${w0.percentage}%`),
        quoteCsv(`${w1.percentage}%`),
        quoteCsv(`${w2.percentage}%`),
        quoteCsv(`${w3.percentage}%`),
        quoteCsv(`${w4.percentage}%`),
      ].join(",")
    )
  }

  return lines.join("\n")
}

export const buildReportsPdfHtml = (
  reportsData: ReportsData,
  rangeLabel: string,
  generatedAt: Date = new Date()
): string => {
  const topCoursesRows =
    reportsData.topCourses.length > 0
      ? reportsData.topCourses
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.courseTitle)}</td><td>${escapeHtml(row.paidSales)}</td><td>${escapeHtml(formatMoney(row.paidRevenueCents))}</td><td>${escapeHtml(row.checkIns)}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="4">No paid sales yet.</td></tr>`

  const monthlyRows =
    reportsData.monthlyPerformance.length > 0
      ? reportsData.monthlyPerformance
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.monthLabel)}</td><td>${escapeHtml(row.paidSales)}</td><td>${escapeHtml(row.pendingSales)}</td><td>${escapeHtml(formatMoney(row.paidRevenueCents))}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="4">No monthly data available.</td></tr>`

  const channelRows =
    reportsData.channelBreakdown.length > 0
      ? reportsData.channelBreakdown
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.key)}</td><td>${escapeHtml(row.sales)}</td><td>${escapeHtml(formatMoney(row.paidRevenueCents))}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="3">No channel data available.</td></tr>`

  const timeWindowRows =
    reportsData.timeWindowRanking.length > 0
      ? reportsData.timeWindowRanking
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.window)}</td><td>${escapeHtml(row.paidSales)}</td><td>${escapeHtml(formatMoney(row.paidRevenueCents))}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="3">No time-window data available.</td></tr>`

  const cohortRows =
    reportsData.cohortRetention.length > 0
      ? reportsData.cohortRetention
          .map((row) => {
            const [w0, w1, w2, w3, w4] = row.rates
            return `<tr><td>${escapeHtml(row.weekLabel)}</td><td>${escapeHtml(row.students)}</td><td>${escapeHtml(`${w0.percentage}%`)}</td><td>${escapeHtml(`${w1.percentage}%`)}</td><td>${escapeHtml(`${w2.percentage}%`)}</td><td>${escapeHtml(`${w3.percentage}%`)}</td><td>${escapeHtml(`${w4.percentage}%`)}</td></tr>`
          })
          .join("")
      : `<tr><td colspan="7">No cohort retention data available.</td></tr>`

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Staff Reports</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #111827; }
      h1 { margin: 0 0 8px 0; font-size: 24px; }
      h2 { margin: 24px 0 8px 0; font-size: 16px; }
      p { margin: 4px 0; }
      .meta { color: #4b5563; font-size: 12px; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
      th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; }
      th { background: #f3f4f6; }
    </style>
  </head>
  <body>
    <h1>Staff reports</h1>
    <p class="meta">Range: ${escapeHtml(rangeLabel)}</p>
    <p class="meta">Generated: ${escapeHtml(generatedAt.toLocaleString("en-US"))}</p>

    <div class="grid">
      <div class="card"><strong>Paid revenue</strong><p>${escapeHtml(formatMoney(reportsData.totalRevenueCents))}</p></div>
      <div class="card"><strong>Paid sales</strong><p>${escapeHtml(reportsData.totalPaidSales)}</p></div>
      <div class="card"><strong>Avg ticket</strong><p>${escapeHtml(formatMoney(reportsData.avgTicketCents))}</p></div>
      <div class="card"><strong>Unique students</strong><p>${escapeHtml(reportsData.uniqueStudents)}</p></div>
      <div class="card"><strong>Check-in rate</strong><p>${escapeHtml(reportsData.checkInRate)}%</p></div>
      <div class="card"><strong>Stripe pending</strong><p>${escapeHtml(reportsData.pendingStripeSales)}</p></div>
    </div>

    <h2>Top courses</h2>
    <table>
      <thead><tr><th>Course</th><th>Paid sales</th><th>Revenue</th><th>Check-ins</th></tr></thead>
      <tbody>${topCoursesRows}</tbody>
    </table>

    <h2>Monthly performance</h2>
    <table>
      <thead><tr><th>Month</th><th>Paid sales</th><th>Pending</th><th>Revenue</th></tr></thead>
      <tbody>${monthlyRows}</tbody>
    </table>

    <h2>Payment channels</h2>
    <table>
      <thead><tr><th>Channel</th><th>Sales</th><th>Revenue</th></tr></thead>
      <tbody>${channelRows}</tbody>
    </table>

    <h2>Time windows</h2>
    <table>
      <thead><tr><th>Window</th><th>Paid sales</th><th>Revenue</th></tr></thead>
      <tbody>${timeWindowRows}</tbody>
    </table>

    <h2>Cohort retention</h2>
    <table>
      <thead><tr><th>Cohort week</th><th>Students</th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th></tr></thead>
      <tbody>${cohortRows}</tbody>
    </table>
  </body>
</html>`
}

export const buildReportsCsvFilename = (now: Date = new Date()): string => {
  const stamp = now.toISOString().slice(0, 10)
  return `staff-reports-${stamp}.csv`
}
