"use client"

import React from "react"
import type { StaffRequestStatus } from "@/lib/security/staff-request"

import type { StaffApprovalFeedItem, StaffRequestSummary } from "./staffAdminTypes"
import {
  REQUEST_STATUS_OPTIONS,
  REQUEST_TYPE_LABELS,
} from "./staffAdminConstants"
import {
  formatPaymentChangeRequestInfoRows,
  formatPaymentChangeRequestMethodLabel,
  PAYMENT_CHANGE_REQUEST_STATUS_LABELS,
} from "./staffApprovals"

type StaffApprovalsPanelProps = {
  showStaffOps: boolean
  requestStatusFilter: StaffRequestStatus | "all"
  approvalsSummary: StaffRequestSummary
  approvalsLoading: boolean
  approvalFeed: StaffApprovalFeedItem[]
  requestBusyId: string | null
  paymentChangeRequestBusyId: string | null
  setRequestStatusFilter: (status: StaffRequestStatus | "all") => void
  updateRequestStatus: (requestId: string, status: StaffRequestStatus) => void
  updatePaymentChangeRequestStatus: (requestId: string, status: "approved" | "rejected") => void
  formatIsoDate: (value: string | null) => string
}

const summaryCards: Array<{ key: keyof StaffRequestSummary; label: string }> = [
  { key: "total", label: "Total" },
  { key: "pending", label: "Pending" },
  { key: "inReview", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
]

export default function StaffApprovalsPanel({
  showStaffOps,
  requestStatusFilter,
  approvalsSummary,
  approvalsLoading,
  approvalFeed,
  requestBusyId,
  paymentChangeRequestBusyId,
  setRequestStatusFilter,
  updateRequestStatus,
  updatePaymentChangeRequestStatus,
  formatIsoDate,
}: StaffApprovalsPanelProps) {
  if (!showStaffOps) return null

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff requests</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Notifications and approvals</h3>
          <p className="mt-1 text-sm text-black/65 dark:text-white/65">
            Day off, shift swaps, schedule changes, pay advance requests and payment method approvals.
          </p>
        </div>
        <div className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRequestStatusFilter("all")}
            className={`rounded-full border px-3 py-1 text-xs ${
              requestStatusFilter === "all"
                ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
            }`}
          >
            All
          </button>
          {REQUEST_STATUS_OPTIONS.map((status) => (
            <button
              key={`request-filter-${status}`}
              type="button"
              onClick={() => setRequestStatusFilter(status)}
              className={`rounded-full border px-3 py-1 text-xs ${
                requestStatusFilter === status
                  ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                  : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
              }`}
            >
              {status.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={`approval-summary-${card.key}`} className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-xs text-black/60 dark:text-white/60">{card.label}</p>
            <p className="mt-1 text-lg font-semibold text-black dark:text-white">{approvalsSummary[card.key]}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {approvalsLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`requests-skeleton-${index}`}
              className="h-[74px] rounded-lg border border-black/10 bg-black/[0.03] shimmer dark:border-white/10 dark:bg-white/[0.03]"
            />
          ))
        ) : approvalFeed.length === 0 ? (
          <p className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
            No approval items found.
          </p>
        ) : (
          approvalFeed.slice(0, 12).map((item) => {
            if (item.kind === "payment_change_request") {
              const request = item.request
              const busy = paymentChangeRequestBusyId === request.id
              const fullName = `${request.staffAccount.firstName} ${request.staffAccount.lastName}`.trim() || "Staff member"
              const requestedMethodLabel = formatPaymentChangeRequestMethodLabel(request.requestedMethod)
              const infoRows = formatPaymentChangeRequestInfoRows(request.requestedInfo)

              return (
                <div
                  key={request.id}
                  className="grid gap-2 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03] lg:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-black dark:text-white">
                        Payment change request · {fullName}
                      </p>
                      <span className="rounded-full border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-sky-300">
                        Payroll
                      </span>
                    </div>
                    <p className="text-xs text-black/60 dark:text-white/60">
                      {request.staffAccount.email} · {formatIsoDate(request.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-black/70 dark:text-white/70">
                      Requested method: {requestedMethodLabel}
                    </p>
                    {request.reason ? (
                      <p className="mt-1 text-xs text-black/70 dark:text-white/70">{request.reason}</p>
                    ) : null}
                    {infoRows.length > 0 ? (
                      <div className="mt-2 grid gap-1 rounded-md border border-black/10 bg-black/[0.03] p-2 text-[11px] text-black/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70">
                        {infoRows.map((row) => (
                          <div key={`${request.id}-${row.key}`} className="flex items-center justify-between gap-3">
                            <span className="uppercase tracking-[0.16em] text-black/45 dark:text-white/45">{row.label}</span>
                            <span className="font-mono text-right">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-white">
                      {PAYMENT_CHANGE_REQUEST_STATUS_LABELS[request.status]}
                    </span>
                    {request.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updatePaymentChangeRequestStatus(request.id, "approved")}
                          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updatePaymentChangeRequestStatus(request.id, "rejected")}
                          className="rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 px-2 py-1 text-xs text-[var(--brand,#ff4b4b)]"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            }

            const request = item.request
            const busy = requestBusyId === request.id
            return (
              <div
                key={request.id}
                className="grid gap-2 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03] lg:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div>
                  <p className="text-sm font-semibold text-black dark:text-white">
                    {REQUEST_TYPE_LABELS[request.type]} · {request.user.name}
                  </p>
                  <p className="text-xs text-black/60 dark:text-white/60">
                    {request.user.email} · {formatIsoDate(request.createdAt)}
                  </p>
                  {request.message ? (
                    <p className="mt-1 text-xs text-black/70 dark:text-white/70">{request.message}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-white">
                    {request.status.replaceAll("_", " ")}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => updateRequestStatus(request.id, "IN_REVIEW")}
                    className="rounded-md border border-white/20 px-2 py-1 text-xs text-white"
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => updateRequestStatus(request.id, "APPROVED")}
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => updateRequestStatus(request.id, "REJECTED")}
                    className="rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 px-2 py-1 text-xs text-[var(--brand,#ff4b4b)]"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </article>
  )
}
