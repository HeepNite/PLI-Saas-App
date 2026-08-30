"use client"

import React from "react"

import PaymentHistoryTimeline from "./PaymentHistoryTimeline"
import AttendanceHistoryTimeline from "./AttendanceHistoryTimeline"
import StudentDataOverrideModal from "./StudentDataOverrideModal"
import AuditHistoryPopover from "./AuditHistoryPopover"
import {
  resolveAttendanceHistoryRows,
  resolvePaymentHistoryRows,
  transformPaymentRowsToAttendance,
  transformPaymentRowsToEvents,
} from "./paymentTimelineTransforms"
import type { StaffRole } from "@/lib/security/staff-role"
import type { StaffCategory, StaffSubCategory } from "@/lib/security/staff-category"
import type { PaymentRow } from "./staffAdminTypes"

type OverrideModalStudent = { id: string; name: string } | null

type StaffAdminHistoryOverlaysProps = {
  payments: PaymentRow[]
  userHistoryPayments: PaymentRow[]
  isHistoryMode: boolean
  currentDateNY: string
  historyFrom: string
  historyTo: string
  userHistoryLoading: boolean
  paymentHistoryStudentId: string | null
  paymentHistoryAnchor: HTMLElement | null
  attendanceHistoryStudentId: string | null
  attendanceHistoryAnchor: HTMLElement | null
  auditHistoryStudentId: string | null
  auditHistoryStudentName: string | null
  auditHistoryAnchor: HTMLElement | null
  overrideModalOpen: boolean
  overrideModalStudent: OverrideModalStudent
  currentRole: StaffRole
  currentCategory: StaffCategory | null
  currentSubCategory: StaffSubCategory | null
  onClosePaymentHistory: () => void
  onCloseAttendanceHistory: () => void
  onCloseAuditHistory: () => void
  onCloseOverrideModal: () => void
  onOverrideSuccess: (studentId: string) => void
  resolveHistoryDateIso: (date: Date, timeZone: string) => string
}

export default function StaffAdminHistoryOverlays({
  payments,
  userHistoryPayments,
  isHistoryMode,
  currentDateNY,
  historyFrom,
  historyTo,
  userHistoryLoading,
  paymentHistoryStudentId,
  paymentHistoryAnchor,
  attendanceHistoryStudentId,
  attendanceHistoryAnchor,
  auditHistoryStudentId,
  auditHistoryStudentName,
  auditHistoryAnchor,
  overrideModalOpen,
  overrideModalStudent,
  currentRole,
  currentCategory,
  currentSubCategory,
  onClosePaymentHistory,
  onCloseAttendanceHistory,
  onCloseAuditHistory,
  onCloseOverrideModal,
  onOverrideSuccess,
  resolveHistoryDateIso,
}: StaffAdminHistoryOverlaysProps) {
  const paymentHistoryRows = resolvePaymentHistoryRows({
    paymentHistoryStudentId,
    isHistoryMode,
    payments,
    userHistoryPayments,
    currentDateNY,
  }).filter((payment) => {
    if (isHistoryMode) return true
    // A payment belongs in today's popover when it was made today OR it pays
    // for today's class (e.g. a special-class seat bought days in advance).
    if (payment.classDate === currentDateNY) return true
    const createdAtNyIso = /^\d{4}-\d{2}-\d{2}$/.test(payment.createdAt)
      ? payment.createdAt
      : resolveHistoryDateIso(new Date(payment.createdAt), "America/New_York")
    return createdAtNyIso === currentDateNY
  })

  const attendanceHistoryRows = resolveAttendanceHistoryRows({
    attendanceHistoryStudentId,
    isHistoryMode,
    payments,
    userHistoryPayments,
    historyFrom,
    historyTo,
  })
  const attendanceTimeline = attendanceHistoryStudentId
    ? transformPaymentRowsToAttendance(attendanceHistoryRows)
    : { events: [], summary: { totalAttended: 0, noShows: 0, cancelled: 0 } }

  return (
    <>
      <PaymentHistoryTimeline
        payments={transformPaymentRowsToEvents(paymentHistoryRows)}
        loading={userHistoryLoading}
        anchorEl={paymentHistoryAnchor}
        isOpen={!!paymentHistoryStudentId}
        onClose={onClosePaymentHistory}
      />

      <AttendanceHistoryTimeline
        attendance={attendanceTimeline.events}
        summary={attendanceTimeline.summary}
        loading={userHistoryLoading}
        anchorEl={attendanceHistoryAnchor}
        isOpen={!!attendanceHistoryStudentId}
        onClose={onCloseAttendanceHistory}
      />

      <AuditHistoryPopover
        studentId={auditHistoryStudentId || ""}
        studentName={auditHistoryStudentName || ""}
        anchorEl={auditHistoryAnchor}
        isOpen={!!auditHistoryAnchor}
        onClose={onCloseAuditHistory}
      />

      {overrideModalStudent ? (
        <StudentDataOverrideModal
          open={overrideModalOpen}
          onClose={onCloseOverrideModal}
          studentId={overrideModalStudent.id}
          studentName={overrideModalStudent.name}
           currentRole={currentRole === "staff" ? "staff" : currentRole === "admin" ? "admin" : "owner"}
           currentCategory={currentCategory}
           currentSubCategory={currentSubCategory}
          onSuccess={() => onOverrideSuccess(overrideModalStudent.id)}
        />
      ) : null}
    </>
  )
}
