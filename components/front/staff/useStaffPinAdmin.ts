import React from "react"

import type { TerminalPinAlert } from "./StaffStudentsBoardPanel"
import type { PaymentRow, ScheduleEvent, StudentPinModalState } from "./staffAdminTypes"
import { splitCustomerName } from "./staffPaymentCardPresentation"

type StudentProfilePinTarget = {
  userId: string
  displayName: string
  email: string
  provisionalPinExpiresAt?: string
}

type UseStaffPinAdminInput = {
  canAccessStudentsNav: boolean
  isStudentsView: boolean
  scheduleEventsByDay: Record<string, ScheduleEvent[]>
  fetchPayments: () => Promise<void>
  fetchPaymentsMonthlySummary: () => Promise<void>
  handleStaffAuthFailure: (status: number) => boolean
  isInsideCriticalClassWindow: (eventsByDay: Record<string, ScheduleEvent[]>, nowMs?: number) => boolean
}

const TERMINAL_ALERTS_CRITICAL_REFRESH_MS = 5_000
const TERMINAL_ALERTS_NORMAL_REFRESH_MS = 30_000
const TERMINAL_ALERT_PRIORITY: Record<"warning" | "cooldown" | "emergency", number> = {
  emergency: 0,
  cooldown: 1,
  warning: 2,
}

export const useStaffPinAdmin = ({
  canAccessStudentsNav,
  isStudentsView,
  scheduleEventsByDay,
  fetchPayments,
  fetchPaymentsMonthlySummary,
  handleStaffAuthFailure,
  isInsideCriticalClassWindow,
}: UseStaffPinAdminInput) => {
  const [terminalPinAlerts, setTerminalPinAlerts] = React.useState<TerminalPinAlert[]>([])
  const [studentPinModal, setStudentPinModal] = React.useState<StudentPinModalState | null>(null)
  const [studentPinReason, setStudentPinReason] = React.useState("")
  const [studentPinDraft, setStudentPinDraft] = React.useState("")
  const [studentPinSubmitting, setStudentPinSubmitting] = React.useState(false)
  const [studentPinError, setStudentPinError] = React.useState<string | null>(null)
  const [studentPinIssued, setStudentPinIssued] = React.useState<{
    value: string
    masked: string
    expiresAt: string | null
  } | null>(null)
  const [studentPinRevealIssued, setStudentPinRevealIssued] = React.useState(false)

  const fetchTerminalPinAlerts = React.useCallback(async () => {
    try {
      const res = await fetch("/api/staff/terminals", { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setTerminalPinAlerts([])
        return
      }
      const nextAlerts = Array.isArray(data?.items)
        ? data.items.flatMap((item: {
            id: string
            name: string
            location: string | null
            pinAlert?: Omit<TerminalPinAlert, "terminalId" | "terminalName" | "terminalLocation"> | null
          }) =>
            item.pinAlert
              ? [{
                  terminalId: item.id,
                  terminalName: item.name,
                  terminalLocation: item.location,
                  severity: item.pinAlert.severity,
                  label: item.pinAlert.label,
                  message: item.pinAlert.message,
                  blockedUntil: item.pinAlert.blockedUntil,
                  missCount: item.pinAlert.missCount,
                }]
              : []
          )
        : []
      setTerminalPinAlerts(nextAlerts)
    } catch {
      setTerminalPinAlerts([])
    }
  }, [handleStaffAuthFailure])

  const refreshPaymentsBoard = React.useCallback(async () => {
    await Promise.all([fetchPayments(), fetchPaymentsMonthlySummary(), fetchTerminalPinAlerts()])
  }, [fetchPayments, fetchPaymentsMonthlySummary, fetchTerminalPinAlerts])

  const closeStudentPinModal = React.useCallback(() => {
    setStudentPinModal(null)
    setStudentPinReason("")
    setStudentPinDraft("")
    setStudentPinError(null)
    setStudentPinIssued(null)
    setStudentPinRevealIssued(false)
    setStudentPinSubmitting(false)
  }, [])

  const resetStudentPinDraftState = React.useCallback(() => {
    setStudentPinReason("")
    setStudentPinDraft("")
    setStudentPinError(null)
    setStudentPinIssued(null)
    setStudentPinRevealIssued(false)
  }, [])

  const openStudentPinModal = React.useCallback((payment: PaymentRow) => {
    const identity = splitCustomerName(payment.customerName, payment.customerEmail)
    setStudentPinModal({
      userId: payment.userId,
      name: identity.fullName,
      email: payment.customerEmail,
      needsEnrollment: payment.studentPin.needsEnrollment,
      provisionalActive: payment.studentPin.provisionalActive,
      provisionalExpiresAt: payment.studentPin.provisionalExpiresAt,
    })
    resetStudentPinDraftState()
  }, [resetStudentPinDraftState])

  const openStudentPinModalForProfile = React.useCallback((student: StudentProfilePinTarget) => {
    setStudentPinModal({
      userId: student.userId,
      name: student.displayName,
      email: student.email,
      needsEnrollment: false,
      provisionalActive: Boolean(student.provisionalPinExpiresAt),
      provisionalExpiresAt: student.provisionalPinExpiresAt ?? null,
    })
    resetStudentPinDraftState()
  }, [resetStudentPinDraftState])

  const submitStudentPinIssue = React.useCallback(async () => {
    if (!studentPinModal?.userId) return
    const reason = studentPinReason.trim()
    const provisionalPin = studentPinDraft.trim()
    if (reason.length < 8) {
      setStudentPinError("Add a short reason so the audit log explains the recovery.")
      return
    }
    if (provisionalPin && !/^\d{4}$/.test(provisionalPin)) {
      setStudentPinError("Custom provisional PIN must be exactly 4 digits.")
      return
    }
    setStudentPinSubmitting(true)
    setStudentPinError(null)
    try {
      const res = await fetch(`/api/staff/users/${encodeURIComponent(studentPinModal.userId)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_provisional",
          reason,
          provisionalPin: provisionalPin || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setStudentPinError(typeof data?.error === "string" ? data.error : "Unable to issue provisional PIN.")
        return
      }
      setStudentPinIssued({
        value: typeof data?.provisionalPin === "string" ? data.provisionalPin : "",
        masked: typeof data?.provisionalPinMasked === "string" ? data.provisionalPinMasked : "",
        expiresAt: typeof data?.expiresAt === "string" ? data.expiresAt : null,
      })
      setStudentPinRevealIssued(false)
      await refreshPaymentsBoard()
    } catch {
      setStudentPinError("Network error while issuing provisional PIN.")
    } finally {
      setStudentPinSubmitting(false)
    }
  }, [handleStaffAuthFailure, refreshPaymentsBoard, studentPinDraft, studentPinModal, studentPinReason])

  React.useEffect(() => {
    if (!canAccessStudentsNav) return
    if (!isStudentsView) return
    void refreshPaymentsBoard()
  }, [canAccessStudentsNav, isStudentsView, refreshPaymentsBoard])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!isStudentsView) return
    const refreshAlerts = () => {
      if (document.visibilityState !== "visible") return
      void fetchTerminalPinAlerts()
    }
    const inCriticalWindow = isInsideCriticalClassWindow(scheduleEventsByDay)
    const refreshMs = terminalPinAlerts.length > 0 || inCriticalWindow
      ? TERMINAL_ALERTS_CRITICAL_REFRESH_MS
      : TERMINAL_ALERTS_NORMAL_REFRESH_MS
    const interval = window.setInterval(refreshAlerts, refreshMs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void fetchTerminalPinAlerts()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchTerminalPinAlerts, isInsideCriticalClassWindow, isStudentsView, scheduleEventsByDay, terminalPinAlerts.length])

  const prioritizedTerminalPinAlerts = React.useMemo(
    () =>
      [...terminalPinAlerts].sort((left, right) => {
        const severityDiff = TERMINAL_ALERT_PRIORITY[left.severity] - TERMINAL_ALERT_PRIORITY[right.severity]
        if (severityDiff !== 0) return severityDiff
        const leftBlocked = left.blockedUntil ? new Date(left.blockedUntil).getTime() : Number.POSITIVE_INFINITY
        const rightBlocked = right.blockedUntil ? new Date(right.blockedUntil).getTime() : Number.POSITIVE_INFINITY
        return leftBlocked - rightBlocked
      }),
    [terminalPinAlerts]
  )

  return {
    terminalPinAlerts,
    prioritizedTerminalPinAlerts,
    hasAnyTerminalPinAlerts: terminalPinAlerts.length > 0,
    studentPinModal,
    studentPinReason,
    setStudentPinReason,
    studentPinDraft,
    setStudentPinDraft,
    studentPinSubmitting,
    studentPinError,
    setStudentPinError,
    studentPinIssued,
    studentPinRevealIssued,
    setStudentPinRevealIssued,
    fetchTerminalPinAlerts,
    refreshPaymentsBoard,
    closeStudentPinModal,
    openStudentPinModal,
    openStudentPinModalForProfile,
    submitStudentPinIssue,
  }
}
