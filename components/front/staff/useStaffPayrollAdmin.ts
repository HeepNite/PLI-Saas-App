import React from "react"

import { WEEKDAY_LABELS_LONG } from "./staffAdminConstants"
import { previousWeekday, startOfDay } from "./staffCalendarHelpers"
import type { PayrollDelayModalState, PayrollStaffRow, SelfProfileSnapshot, StaffUserRow } from "./staffAdminTypes"

type UseStaffPayrollAdminOptions = {
  rows: StaffUserRow[]
  nowTs: number
  currentUserId: string
  resolvedSelfProfile: SelfProfileSnapshot
}

export function useStaffPayrollAdmin({ rows, nowTs, currentUserId, resolvedSelfProfile }: UseStaffPayrollAdminOptions) {
  const [delayModal, setDelayModal] = React.useState<PayrollDelayModalState | null>(null)

  const rowById = React.useMemo(() => {
    return rows.reduce<Record<string, StaffUserRow>>((acc, row) => {
      acc[row.id] = row
      return acc
    }, {})
  }, [rows])

  const getLiveSessionMinutes = React.useCallback(
    (row: StaffUserRow) => {
      if (!row.online) return null
      if (!row.staffLastCheckInAt) return null
      const diff = nowTs - row.staffLastCheckInAt
      if (!Number.isFinite(diff) || diff < 0) return null
      return Math.floor(diff / 60_000)
    },
    [nowTs]
  )

  const selfRowFromDirectory = rowById[currentUserId] || null
  const selfIsOnline = selfRowFromDirectory ? selfRowFromDirectory.online : resolvedSelfProfile.presence.online
  const selfLastCheckInAt = selfRowFromDirectory?.staffLastCheckInAt ?? resolvedSelfProfile.presence.staffLastCheckInAt
  const selfLiveSessionMinutes = React.useMemo(() => {
    if (!selfIsOnline || !selfLastCheckInAt) return null
    const diff = nowTs - selfLastCheckInAt
    if (!Number.isFinite(diff) || diff < 0) return null
    return Math.floor(diff / 60_000)
  }, [nowTs, selfIsOnline, selfLastCheckInAt])

  const payrollRows = React.useMemo<PayrollStaffRow[]>(() => {
    const today = new Date()
    return rows.map((row) => {
      const hoursWorked = typeof row.payrollHoursWorked === "number" ? row.payrollHoursWorked : null
      const hourlyRate = typeof row.payrollHourlyRate === "number" ? row.payrollHourlyRate : null
      const amountCents = hoursWorked !== null && hourlyRate !== null ? Math.round(hoursWorked * hourlyRate * 100) : null
      const paydayWeekday = row.payrollPaydayWeekday
      const paydayLabel = paydayWeekday !== null ? WEEKDAY_LABELS_LONG[paydayWeekday] : "Not configured"
      const dueDate = paydayWeekday !== null ? previousWeekday(today, paydayWeekday) : null
      const status: PayrollStaffRow["status"] = row.payrollStatus || "unknown"
      const delayDays =
        status === "pending" && dueDate
          ? Math.max(0, Math.floor((startOfDay(today).getTime() - dueDate.getTime()) / 86_400_000))
          : status === "paid"
            ? 0
            : null

      return {
        userId: row.id,
        name: `${row.firstName} ${row.lastName}`.trim() || row.email,
        role: row.role,
        category: row.category,
        hoursWorked,
        hourlyRate,
        amountCents,
        status,
        delayDays,
        paydayWeekday,
        paydayLabel,
        dueDateLabel: dueDate ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dueDate) : null,
        delayEntries: Array.isArray(row.payrollDelayEntries) ? row.payrollDelayEntries : [],
      }
    })
  }, [rows])

  const payrollSummary = React.useMemo(() => {
    const totals = payrollRows.reduce(
      (acc, row) => {
        if (typeof row.amountCents === "number") {
          acc.total += row.amountCents
        }
        if (row.status === "paid" && typeof row.amountCents === "number") {
          acc.paid += row.amountCents
          acc.paidCount += 1
        } else if (row.status === "pending" && typeof row.amountCents === "number") {
          acc.pending += row.amountCents
          acc.pendingCount += 1
          if (typeof row.delayDays === "number") {
            acc.maxDelay = Math.max(acc.maxDelay, row.delayDays)
          }
        }
        return acc
      },
      { total: 0, paid: 0, pending: 0, paidCount: 0, pendingCount: 0, maxDelay: 0 }
    )

    const fridayCount = payrollRows.filter((row) => row.paydayWeekday === 5).length
    const exceptions = payrollRows
      .filter((row) => typeof row.paydayWeekday === "number" && row.paydayWeekday !== 5)
      .map((row) => ({
        id: row.userId,
        name: row.name,
        dayLabel: WEEKDAY_LABELS_LONG[row.paydayWeekday!],
      }))

    return { ...totals, fridayCount, exceptions }
  }, [payrollRows])

  const openDelayDetails = React.useCallback((row: PayrollStaffRow) => {
    const entries = row.delayEntries
    const totalDelayMinutes = entries.reduce((sum, item) => sum + item.delayMinutes, 0)
    const lateDays = entries.filter((item) => item.delayMinutes > 0).length
    setDelayModal({
      row,
      entries,
      totalDelayMinutes,
      lateDays,
    })
  }, [])

  const closeDelayDetails = React.useCallback(() => {
    setDelayModal(null)
  }, [])

  return {
    delayModal,
    rowById,
    getLiveSessionMinutes,
    selfIsOnline,
    selfLiveSessionMinutes,
    payrollRows,
    payrollSummary,
    openDelayDetails,
    closeDelayDetails,
  }
}
