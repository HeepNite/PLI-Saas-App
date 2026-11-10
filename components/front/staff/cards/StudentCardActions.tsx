"use client"

import React from "react"
import type { PaymentRow } from "@/components/front/staff/staffAdminTypes"
import type { StudentCardsGridProps } from "@/components/front/staff/StudentCardsGrid"
import { canCreateTerminalCharge, canOperateStudentEdits } from "@/lib/security/staff-access"
import { FastClassActionControls } from "@/components/front/staff/FastClassActionControls"
import { ChargeOnTabletButton } from "@/components/front/staff/terminal-charge-builder/TerminalChargeBuilderModal"

type StudentCardActionsProps = Pick<
  StudentCardsGridProps,
  "currentRole" | "currentCategory" | "openOverrideModal" | "paymentsLoading" | "onRefreshPaymentsBoard"
> & {
  userId: string
  name: string
  email: string | null | undefined
  mailSubject: string
  activePackage: React.ComponentProps<typeof FastClassActionControls>["activePackage"]
  openPayments: PaymentRow[]
}

/** The action row shared by the payment and profile student cards. */
export function StudentCardActions({
  userId,
  name,
  email,
  mailSubject,
  activePackage,
  openPayments,
  currentRole,
  currentCategory,
  openOverrideModal,
  paymentsLoading,
  onRefreshPaymentsBoard,
}: StudentCardActionsProps) {
  return (
    <div className="mt-4 flex gap-1.5">
      <FastClassActionControls
        activePackage={activePackage}
        disabled={paymentsLoading}
        studentName={name}
        userId={userId}
        onRefreshPaymentsBoard={onRefreshPaymentsBoard}
      />
      <button
        type="button"
        onClick={() => {
          if (typeof window === "undefined" || !email || email === "—") return
          window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(mailSubject)}`
        }}
        className="min-w-0 flex-1 whitespace-nowrap rounded-md border border-white/20 px-1.5 py-1 text-[11px]"
      >
        Notify
      </button>
      {canOperateStudentEdits(currentRole, currentCategory) && userId ? (
        <button
          type="button"
          onClick={() => openOverrideModal(userId, name)}
          className="min-w-0 flex-1 whitespace-nowrap rounded-md border border-white/20 bg-white/10 px-1.5 py-1 text-[11px] font-semibold text-white hover:bg-white/15 transition-colors"
        >
          Edit info
        </button>
      ) : null}
      {canCreateTerminalCharge(currentRole, currentCategory) && userId ? (
        <ChargeOnTabletButton
          payerUserId={userId}
          payerName={name}
          openPayments={openPayments}
          disabled={paymentsLoading}
          onPaid={onRefreshPaymentsBoard}
        />
      ) : null}
    </div>
  )
}
