"use client"

import React from "react"
import Image from "next/image"
import { Mail, MapPin, Phone } from "lucide-react"
import type { StudentProfileCard } from "@/components/front/staff/historyCardAggregates"
import {
  PROFILE_CARD_BADGE_CLASS,
  resolveProfileCardBadges,
  resolveProfileCardDetailRows,
  resolveProfileSettlementControl,
  splitCustomerName,
  getInitials,
} from "@/components/front/staff/staffPaymentCardPresentation"
import { formatIsoDateLong } from "@/components/front/staff/studentPaymentCardFormatters"
import { canOperateStudentEdits } from "@/lib/security/staff-access"
import { FastClassActionControls } from "@/components/front/staff/FastClassActionControls"
import { ClerkSyncUserBanner } from "./ClerkSyncUserBanner"
import type { StudentCardsGridProps } from "@/components/front/staff/StudentCardsGrid"

type ProfileStudentCardProps = StudentCardsGridProps & {
  student: StudentProfileCard
}

function ProfileClerkBanner({ student }: { student: StudentProfileCard }) {
  return <ClerkSyncUserBanner userId={student.userId} />
}

export function ProfileStudentCard({
  student,
  selectedPaymentIds,
  selectPaymentIds,
  deselectPaymentIds,
  onSettlementBulkUpdate,
  setAuditHistoryAnchor,
  setAuditHistoryStudentId,
  setAuditHistoryStudentName,
  usersWithAuditEntries,
  openOverrideModal,
  currentRole,
  currentCategory,
  paymentsLoading,
  onRefreshPaymentsBoard,
}: ProfileStudentCardProps) {
  const canEditStudentInfo = canOperateStudentEdits(currentRole, currentCategory)
  // Mirror legacy logic: identity, badges, detail rows and settlement control.
  const identity = splitCustomerName(student.displayName, student.email)
  const initials = getInitials(identity.firstName, identity.lastName, student.email)
  const badges = resolveProfileCardBadges(student)
  const detailRows = resolveProfileCardDetailRows(student)
  const settlementControl = resolveProfileSettlementControl(student)
  const isProfileSettlementSelected = settlementControl
    ? selectedPaymentIds.includes(settlementControl.paymentId)
    : false

  return (
    <article
      className={`relative rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-4 text-white ${settlementControl ? "pt-9" : ""}`}
    >
      {settlementControl ? (
        isProfileSettlementSelected ? (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSettlementBulkUpdate("mark_paid", [settlementControl.paymentId])}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--brand,#b61616)]/20 border border-[var(--brand,#b61616)]/40 px-2 py-1 text-[10px] font-semibold text-[var(--brand,#ff4b4b)] hover:bg-[var(--brand,#b61616)]/30 transition-colors"
            >
              Mark paid
            </button>
            <button
              type="button"
              onClick={() => deselectPaymentIds([settlementControl.paymentId])}
              className="inline-flex items-center rounded-md bg-black/30 px-1.5 py-1 text-[10px] text-white/60 hover:text-white/80 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="absolute right-3 top-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/30 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--brand,#b61616)]"
              checked={isProfileSettlementSelected}
              onChange={(event) => {
                const checked = event.target.checked
                if (checked) {
                  selectPaymentIds([settlementControl.paymentId])
                } else {
                  deselectPaymentIds([settlementControl.paymentId])
                }
              }}
            />
            Select
          </label>
        )
      ) : null}
      <header className="flex items-center gap-3">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-black/35 text-lg font-bold shadow-[0_14px_30px_-18px_rgba(0,0,0,0.85)]">
          {student.avatarUrl ? (
            <Image
              src={student.avatarUrl}
              alt={student.displayName}
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
          <h4 className="truncate text-lg font-semibold leading-tight">{student.displayName}</h4>
          <p className="mt-1 truncate text-[12px] text-white/70">
            Registered · {formatIsoDateLong(student.registeredAt)}
          </p>
        </div>
      </header>

      <ProfileClerkBanner student={student} />

      <div className="mt-4 w-full grid grid-cols-2 gap-2.5">
        {badges.map((badge) => (
          <span
            key={badge.key}
            title={badge.title}
            className={`${PROFILE_CARD_BADGE_CLASS} ${badge.tone}`}
          >
            {badge.label}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-2.5 border-t border-white/10 pt-3.5 text-xs text-white/85">
        {detailRows.map((row) => {
          const isOutstandingBalanceRow = row.key === "outstanding-balance"
          const baseRowClasses = "inline-flex w-full items-center justify-between gap-2 text-white/75"
          const rowClass = isOutstandingBalanceRow
            ? `${baseRowClasses} border-b border-[var(--brand,#b61616)]/40 pb-2 text-[var(--brand,#ff8b8b)]`
            : baseRowClasses
          const labelClass = `inline-flex items-center gap-1 ${
            isOutstandingBalanceRow
              ? "text-[var(--brand,#ff9e9e)]"
              : row.key === "location" || row.key === "email" || row.key === "phone"
                ? "text-white/70"
                : ""
          }`
          const valueClass = `truncate text-right ${
            isOutstandingBalanceRow ? "text-[var(--brand,#ffc0c0)]" : ""
          }`

          return (
            <p key={row.key} className={rowClass}>
              <span className={labelClass}>
                {row.key === "location" ? <MapPin className="h-3 w-3" /> : null}
                {row.key === "email" ? <Mail className="h-3 w-3" /> : null}
                {row.key === "phone" ? <Phone className="h-3 w-3" /> : null}
                {row.label}
              </span>
              <span className={valueClass}>{row.value}</span>
            </p>
          )
        })}
      </div>

      <div className="mt-4 flex gap-2.5">
        <FastClassActionControls
          activePackage={student.activePackage}
          disabled={paymentsLoading}
          studentName={student.displayName}
          userId={student.userId}
          onRefreshPaymentsBoard={onRefreshPaymentsBoard}
        />
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined" || !student.email || student.email === "—") return
            const subject = encodeURIComponent(`Student profile update · ${student.displayName}`)
            window.location.href = `mailto:${encodeURIComponent(student.email)}?subject=${subject}`
          }}
          className="flex-1 whitespace-nowrap rounded-md border border-white/20 px-2 py-1 text-[11px]"
        >
          Notify
        </button>
        {canEditStudentInfo && student.userId ? (
          <button
            type="button"
            onClick={() => openOverrideModal(student.userId, student.displayName)}
            className="flex-1 whitespace-nowrap rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/15 transition-colors"
          >
            Edit info
          </button>
        ) : null}
      </div>

      {canEditStudentInfo &&
        student.userId &&
        usersWithAuditEntries.has(student.userId) && (
          <div className="mt-3">
            <button
              type="button"
              onClick={(e) => {
                setAuditHistoryAnchor(e.currentTarget)
                setAuditHistoryStudentId(student.userId)
                setAuditHistoryStudentName(student.displayName)
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
