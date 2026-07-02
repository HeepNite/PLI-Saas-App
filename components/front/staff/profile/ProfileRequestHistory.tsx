"use client"

import React from "react"
import type { StaffRequestStatus } from "@/lib/security/staff-request"
import { PROFILE_REQUEST_STATUS_OPTIONS, REQUEST_TYPE_LABELS } from "../staffAdminConstants"
import type { StaffRequestRow, StaffRequestSummary } from "../staffAdminTypes"

type ProfileRequestHistoryProps = {
  profileRequestStatusFilter: StaffRequestStatus | "all"
  requestsSummary: StaffRequestSummary
  requestsLoading: boolean
  staffRequests: StaffRequestRow[]
  setProfileRequestStatusFilter: (value: StaffRequestStatus | "all") => void
  formatIsoDate: (value: string | null) => string
}

export default function ProfileRequestHistory(props: ProfileRequestHistoryProps) {
  const {
    profileRequestStatusFilter,
    requestsSummary,
    requestsLoading,
    staffRequests,
    setProfileRequestStatusFilter,
    formatIsoDate,
  } = props

  return (
    <section className="rounded-xl border border-black/10 bg-white/65 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">My history</p>
          <h4 className="mt-1 text-base font-semibold text-black dark:text-white">Request status</h4>
        </div>
        <div className="inline-flex flex-wrap gap-1">
          {PROFILE_REQUEST_STATUS_OPTIONS.map((status) => (
            <button
              key={`profile-request-status-${status}`}
              type="button"
              onClick={() => setProfileRequestStatusFilter(status)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] ${
                profileRequestStatusFilter === status
                  ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                  : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
              }`}
            >
              {status === "all" ? "All" : status.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-black/10 bg-white/70 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.05]">
          <p className="text-[11px] text-black/60 dark:text-white/60">Total</p>
          <p className="text-base font-semibold text-black dark:text-white">{requestsSummary.total}</p>
        </div>
        <div className="rounded-lg border border-black/10 bg-white/70 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.05]">
          <p className="text-[11px] text-black/60 dark:text-white/60">Pending</p>
          <p className="text-base font-semibold text-black dark:text-white">{requestsSummary.pending}</p>
        </div>
      </div>

      <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {requestsLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`self-requests-skeleton-${index}`}
              className="h-[74px] rounded-lg border border-black/10 bg-black/[0.03] shimmer dark:border-white/10 dark:bg-white/[0.03]"
            />
          ))
        ) : staffRequests.length === 0 ? (
          <p className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
            No requests yet.
          </p>
        ) : (
          staffRequests.slice(0, 10).map((request) => (
            <div
              key={`self-request-${request.id}`}
              className="rounded-lg border border-black/10 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-black dark:text-white">
                  {REQUEST_TYPE_LABELS[request.type]}
                </p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    request.status === "APPROVED"
                      ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-300"
                      : request.status === "REJECTED"
                        ? "border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)]"
                        : request.status === "IN_REVIEW"
                          ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                          : "border-amber-500/45 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  {request.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-black/75 dark:text-white/75">{request.message || "No details provided."}</p>
              <p className="mt-1 text-[11px] text-black/60 dark:text-white/60">
                Created: {formatIsoDate(request.createdAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
