"use client"

import React from "react"
import Image from "next/image"
import { Mail, MapPin, Phone } from "lucide-react"
import {
  buildHistoryStudentPaidEntries,
  resolveHistoryStudentCardAmountPaidCents,
} from "@/components/front/staff/historyCardAggregates"
import {
  checkInStateTone,
} from "@/components/front/staff/paymentState"
import {
  formatStudentPaymentCardDateTimeLabel,
  formatStudentPaymentCardSlotLabel,
} from "@/components/front/staff/studentPaymentCardFormatters"
import {
  getInitials,
  getOpenPaymentIds,
  paymentStateTone,
  resolvePackageBadge,
  splitCustomerName,
} from "@/components/front/staff/staffPaymentCardPresentation"
import { canOperateStudentEdits } from "@/lib/security/staff-access"
import { FastClassActionControls } from "@/components/front/staff/FastClassActionControls"
import { ClerkSyncUserBanner } from "./ClerkSyncUserBanner"
import type { PaymentRow } from "@/components/front/staff/staffAdminTypes"
import type { StudentCardsGridProps } from "@/components/front/staff/StudentCardsGrid"
import type { PaymentBackedStudentCard } from "@/components/front/staff/studentsBoardTypes"

type PaymentStudentCardProps = StudentCardsGridProps & {
  student: PaymentBackedStudentCard
}

function PaymentClerkBanner({ payment }: { payment: PaymentRow }) {
  return <ClerkSyncUserBanner userId={payment.userId ?? null} />
}

export function PaymentStudentCard({
  student,
  cardVariant,
  selectedPaymentIds,
  selectPaymentIds,
  deselectPaymentIds,
  onSettlementBulkUpdate,
  paymentHistoryStudentId,
  attendanceHistoryStudentId,
  setPaymentHistoryAnchor,
  setAttendanceHistoryAnchor,
  setPaymentHistoryStudentId,
  setAttendanceHistoryStudentId,
  setAuditHistoryAnchor,
  setAuditHistoryStudentId,
  setAuditHistoryStudentName,
  usersWithAuditEntries,
  openOverrideModal,
  currentRole,
  currentCategory,
  formatMoney,
  paymentsLoading,
  onRefreshPaymentsBoard,
}: PaymentStudentCardProps) {
  const canEditStudentInfo = canOperateStudentEdits(currentRole, currentCategory)
  const payment = student.latestPayment
  const identity = splitCustomerName(payment.customerName, payment.customerEmail)
  const initials = getInitials(identity.firstName, identity.lastName, payment.customerEmail)
  const packageLabel = payment.activePackage?.label || "No active package"
  const packageValue = payment.activePackage
    ? payment.activePackage.isUnlimited
      ? "Unlimited"
      : payment.activePackage.totalCredits
        ? `${Math.max(0, payment.activePackage.remainingCredits || 0)} of ${payment.activePackage.totalCredits} remaining`
        : `${Math.max(0, payment.activePackage.remainingCredits || 0)} credits remaining`
    : "—"
  const outstandingBalanceLabel =
    typeof payment.outstandingBalance === "number" && payment.outstandingBalance > 0
      ? formatMoney(payment.outstandingBalance, payment.currency)
      : null
  const paidEntries =
    cardVariant.context === "daily"
      ? buildHistoryStudentPaidEntries(student.allPayments)
      : student.allPayments.filter((entry) => entry.classPaid).slice(0, 12)
  const totalSpentCents = resolveHistoryStudentCardAmountPaidCents(student, cardVariant.context)
  const totalSpentLabel = formatMoney(totalSpentCents, payment.currency)
  const subtitleSlotLabel = formatStudentPaymentCardSlotLabel(payment.classDate, payment.classTime)
  const courseUnion = [
    ...new Set(
      student.allPayments.map((entry) => entry.courseTitle || entry.courseSlug).filter(Boolean),
    ),
  ]
  const studentOpenIds = getOpenPaymentIds(student.allPayments)
  const historyCashOpenIds =
    cardVariant.context === "history"
      ? student.allPayments.filter((p) => p.paymentChannel === "cash" && p.settlementStatus !== "paid").map((p) => p.id)
      : []
  const isHistoryCashSettlement = cardVariant.context === "history" && historyCashOpenIds.length > 0
  const studentSelectableIds =
    isHistoryCashSettlement
      ? historyCashOpenIds
      : studentOpenIds.length > 0
      ? studentOpenIds
      : student.allPayments.filter((p) => p.paymentChannel === "cash").map((p) => p.id)
  const isSelected = studentSelectableIds.some((id) => selectedPaymentIds.includes(id))
  const packageBadge = resolvePackageBadge(payment.activePackage)
  const pointsHistoryEntries = payment.pointsHistory.slice(0, 10)

  return (
    <article
      className={`relative rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-4 text-white ${
        isHistoryCashSettlement || payment.paymentChannel === "cash" ? "pt-9" : ""
      }`}
    >
      {isHistoryCashSettlement || (cardVariant.context !== "history" && payment.paymentChannel === "cash") ? (
        isSelected ? (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                onSettlementBulkUpdate(
                  !isHistoryCashSettlement && payment.settlementStatus === "paid" ? "mark_pending" : "mark_paid",
                  isHistoryCashSettlement
                    ? studentSelectableIds
                    : payment.settlementStatus === "paid"
                      ? [payment.id]
                      : getOpenPaymentIds(student.allPayments),
                )
              }
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                !isHistoryCashSettlement && payment.settlementStatus === "paid"
                  ? "bg-amber-500/30 border border-amber-500/50 text-amber-200 hover:bg-amber-500/40"
                  : "bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/40"
              }`}
            >
              {!isHistoryCashSettlement && payment.settlementStatus === "paid" ? "Mark pending" : "Mark paid"}
            </button>
            <button
              type="button"
              onClick={() => deselectPaymentIds(studentSelectableIds)}
              className="inline-flex items-center rounded-md bg-black/40 border border-white/20 px-1.5 py-1 text-[10px] text-white/60 hover:text-white/80 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="absolute right-3 top-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/30 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--brand,#b61616)]"
              checked={isSelected}
              onChange={(event) => {
                const checked = event.target.checked
                if (checked) {
                  selectPaymentIds(studentSelectableIds)
                } else {
                  deselectPaymentIds(studentSelectableIds)
                }
              }}
            />
            Select
          </label>
        )
      ) : null}
      <header className="flex items-center gap-3">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-black/35 text-lg font-bold shadow-[0_14px_30px_-18px_rgba(0,0,0,0.85)]">
          {payment.customerAvatarUrl ? (
            <Image
              src={payment.customerAvatarUrl}
              alt={identity.fullName}
              fill
              unoptimized
              sizes="64px"
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-lg font-semibold leading-tight">{identity.fullName}</h4>
          <span className="group relative block cursor-help">
            <p
              className="mt-1 truncate text-[12px] text-white/70"
              title={
                cardVariant.showHistoryTooltip
                  ? courseUnion.join(" · ") || "No class slots"
                  : `${payment.courseTitle} · ${subtitleSlotLabel}`
              }
            >
              {cardVariant.showHistorySubtitle
                ? `${student.totalPayments} records · ${courseUnion.slice(0, 2).join(" · ") || "No class slots"}`
                : `${payment.courseTitle} · ${subtitleSlotLabel}`}
            </p>
            <span className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-1 w-max max-w-[18rem] rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100">
              {cardVariant.showHistoryTooltip
                ? courseUnion.join(" · ") || "No class slots in range"
                : `${payment.courseTitle} · ${subtitleSlotLabel}`}
            </span>
          </span>
        </div>
      </header>

      <PaymentClerkBanner payment={payment} />

      <div className="mt-4 w-full grid grid-cols-2 gap-1.5">
        <button
          type="button"
          ref={(el) => {
            if (el && paymentHistoryStudentId === payment.userId) {
              setPaymentHistoryAnchor(el)
            }
          }}
          onClick={() => {
            setPaymentHistoryStudentId(payment.userId)
            setAttendanceHistoryStudentId(null)
            setAttendanceHistoryAnchor(null)
          }}
          className={`w-full flex cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-[11px] font-semibold hover:opacity-80 transition-opacity ${paymentStateTone(payment)}`}
        >
          Pmt History
        </button>
        <button
          type="button"
          ref={(el) => {
            if (el && attendanceHistoryStudentId === payment.userId) {
              setAttendanceHistoryAnchor(el)
            }
          }}
          onClick={() => {
            setAttendanceHistoryStudentId(payment.userId)
            setPaymentHistoryStudentId(null)
            setPaymentHistoryAnchor(null)
          }}
          className={`w-full flex cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-[11px] font-semibold hover:opacity-80 transition-opacity ${checkInStateTone(payment)}`}
        >
          Attendance
        </button>
        <span
          className={`w-full flex items-center justify-center truncate rounded-md border px-3 py-1.5 text-[11px] font-semibold ${packageBadge.tone}`}
          title={packageBadge.label}
        >
          {packageBadge.label}
        </span>
        <span className="group relative w-full flex cursor-help items-center justify-center rounded-md border border-fuchsia-400/35 bg-fuchsia-400/10 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-200">
          Points: {payment.pointsBalance}
          <span className="pointer-events-auto invisible absolute bottom-full left-0 z-[200] max-h-44 w-[16rem] -translate-x-1/2 translate-y-1 overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <span className="font-semibold text-white">Points history</span>
            <span className="mt-1 block border-t border-white/10" />
            {pointsHistoryEntries.length === 0 ? (
              <span className="mt-1 block text-white/70">No points events yet.</span>
            ) : (
              pointsHistoryEntries.map((entry, index) => (
                <span
                  key={`points-history-${entry.id}`}
                  className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                >
                  <span className="font-semibold text-fuchsia-200">
                    {entry.points > 0 ? `+${entry.points}` : entry.points}
                  </span>
                  <span className="ml-1 capitalize">
                    {entry.type.replaceAll("_", " ").toLowerCase()}
                  </span>
                  <span className="mt-0.5 block text-white/65">
                    {formatStudentPaymentCardDateTimeLabel(entry.createdAt)}
                  </span>
                </span>
              ))
            )}
          </span>
        </span>
      </div>

      <div className="mt-4 space-y-2.5 border-t border-white/10 pt-3.5 text-xs text-white/85">
        <p className="inline-flex w-full items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-white/70">
            <MapPin className="h-3 w-3" />
            Location
          </span>
          <span className="truncate text-right">{payment.location || "—"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-white/70">
            <Mail className="h-3 w-3" />
            Email
          </span>
          <span className="truncate text-right">{payment.customerEmail || "—"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-white/70">
            <Phone className="h-3 w-3" />
            Phone
          </span>
          <span className="truncate text-right">{payment.customerPhone || "—"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Package</span>
          <span className="truncate text-right">{packageLabel}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Amount paid</span>
          <span className="group relative max-w-[62%] cursor-help text-right">
            <span className="truncate text-right">{totalSpentLabel}</span>
            <span className="pointer-events-auto invisible absolute bottom-full right-0 z-[200] max-h-52 w-[17rem] overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <span className="font-semibold text-white">Paid entries</span>
              <span className="mt-1 block border-t border-white/10" />
              {paidEntries.length === 0 ? (
                <span className="mt-1 block text-white/70">No paid entries in this selection.</span>
              ) : (
                paidEntries.slice(0, 12).map((entry, index) => (
                  <span
                    key={`paid-history-${entry.id}`}
                    className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                  >
                    <span className="block">{entry.courseTitle || "Package payment"}</span>
                    <span className="mt-0.5 block text-white/65">
                      {formatMoney(entry.amount, entry.currency)} ·{" "}
                      {formatStudentPaymentCardDateTimeLabel(entry.createdAt)}
                    </span>
                  </span>
                ))
              )}
            </span>
          </span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Credits</span>
          <span>{packageValue}</span>
        </p>
        {outstandingBalanceLabel ? (
          <p className="inline-flex w-full items-center justify-between gap-2 border-b border-[var(--brand,#b61616)]/40 pb-2 text-[var(--brand,#ff9e9e)]">
            <span>Outstanding balance</span>
            <span className="group relative text-[var(--brand,#ffc0c0)]">
              <span className="cursor-help">{outstandingBalanceLabel}</span>
              <span className="pointer-events-auto invisible absolute bottom-full right-0 z-[200] max-h-52 w-[17rem] overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <span className="font-semibold text-white">Outstanding balance breakdown:</span>
                <span className="mt-1 block border-t border-white/10" />
                {student.allPayments
                  .filter(
                    (entry) =>
                      (typeof entry.outstandingBalance === "number" &&
                        entry.outstandingBalance > 0) ||
                      entry.settlementStatus === "pending",
                  )
                  .slice(0, 12)
                  .map((entry, index) => (
                    <span
                      key={`outstanding-${entry.id}`}
                      className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                    >
                      <span className="block">{entry.courseTitle || "Package payment"}</span>
                      <span className="mt-0.5 block text-white/65">
                        {formatMoney(entry.amount, entry.currency)}
                      </span>
                    </span>
                  ))}
                <span className="mt-2 border-t border-white/10 pt-2 block font-semibold text-white/90">
                  Total: {outstandingBalanceLabel}
                </span>
              </span>
            </span>
          </p>
        ) : null}
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Purchased courses</span>
          <span>{student.coursesPurchasedCount}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Completed classes</span>
          <span className="group relative cursor-help">
            <span>{student.completedClassesTotal}</span>
            <span className="pointer-events-auto invisible absolute bottom-full right-0 z-[200] max-h-52 w-[17rem] overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <span className="font-semibold text-white">Completed classes</span>
              <span className="mt-1 block border-t border-white/10" />
              {student.allPayments.filter(
                (p) =>
                  p.checkInStatus === "checked_in" ||
                  p.checkInStatus === "checked_in_no_package" ||
                  p.checkInStatus === "checked_out",
              ).length === 0 ? (
                <span className="mt-1 block text-white/70">No completed classes yet.</span>
              ) : (
                student.allPayments
                  .filter(
                    (p) =>
                      p.checkInStatus === "checked_in" ||
                      p.checkInStatus === "checked_in_no_package" ||
                      p.checkInStatus === "checked_out",
                  )
                  .slice(0, 12)
                  .map((entry, index) => (
                    <span
                      key={`completed-${entry.id}`}
                      className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                    >
                      <span className="block">{entry.courseTitle || "Class"}</span>
                      <span className="mt-0.5 block text-white/65">
                        {formatStudentPaymentCardSlotLabel(entry.classDate, entry.classTime)}
                      </span>
                    </span>
                  ))
              )}
            </span>
          </span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Package classes used</span>
          <span>{student.packageClassesUsedTotal}</span>
        </p>
      </div>

      <div className="mt-4 flex gap-2.5">
        <FastClassActionControls
          activePackage={payment.activePackage}
          disabled={paymentsLoading}
          studentName={identity.fullName}
          userId={payment.userId}
          onRefreshPaymentsBoard={onRefreshPaymentsBoard}
        />
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined" || !payment.customerEmail || payment.customerEmail === "—")
              return
            const subject = encodeURIComponent(`Class payment update · ${payment.courseTitle}`)
            window.location.href = `mailto:${encodeURIComponent(payment.customerEmail)}?subject=${subject}`
          }}
          className="flex-1 whitespace-nowrap rounded-md border border-white/20 px-2 py-1 text-[11px]"
        >
          Notify
        </button>
        {canEditStudentInfo && payment.userId ? (
          <button
            type="button"
            onClick={() => openOverrideModal(payment.userId, identity.fullName)}
            className="flex-1 whitespace-nowrap rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/15 transition-colors"
          >
            Edit info
          </button>
        ) : null}
      </div>

      {canEditStudentInfo &&
        payment.userId &&
        usersWithAuditEntries.has(payment.userId) && (
          <div className="mt-3">
            <button
              type="button"
              onClick={(e) => {
                setAuditHistoryAnchor(e.currentTarget)
                setAuditHistoryStudentId(payment.userId)
                setAuditHistoryStudentName(identity.fullName)
              }}
              className="w-full rounded-md border border-white/15 px-2 py-1.5 text-[11px] text-white/60 hover:text-white/80 hover:border-white/25 transition-colors"
            >
              Change history
            </button>
          </div>
        )}
    </article>
  )
}
