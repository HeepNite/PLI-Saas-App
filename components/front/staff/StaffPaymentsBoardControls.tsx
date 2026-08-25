"use client"

import React from "react"
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Loader2,
  MapPin,
  Search,
  Users,
} from "lucide-react"

import CalendarPicker from "@/components/front/ui/CalendarPicker"

import { formatMoney } from "./staffAdminFormatters"
import type {
  HistoryAttendanceFilter,
  HistoryPaymentMethodFilter,
  PaymentCategoryFilter,
} from "./staffAdminTypes"
import type { PaymentsBulkBusyAction } from "./useStaffPaymentsAdmin"

type StudentsSummary = {
  totalStudents: number
  totalRevenueCents: number
  pendingByContext: number
  paidStudents: number
  checkedInStudents: number
}

type HistoryDerivedStats = {
  studentCount: number
  paidCount: number
  pendingCount: number
  totalCollected: number
  checkedInCount: number
  packages: number
  dropIn: number
}

type HistoryClassOption = {
  slug: string
  title: string
}

type Props = {
  studentsSummary: StudentsSummary
  paymentCategoryFilter: PaymentCategoryFilter
  onPaymentCategoryChange: (category: PaymentCategoryFilter) => void
  studentSearchQuery: string
  setStudentSearchQuery: (value: string) => void
  isGlobalSearchLoading: boolean
  isHistorySearchLoading: boolean
  globalSearchError: string | null
  paymentsFilter: "all" | "pending" | "paid"
  setPaymentsFilter: (value: "all" | "pending" | "paid") => void
  isHistoryMode: boolean
  historyFrom: string
  historyTo: string
  onHistoryRangeChange: (start: string, end?: string | null) => void
  todayDateIso: string
  historyReadableRange: string
  historyClassKey: string
  setHistoryClassKey: (value: string) => void
  historyClassOptions: HistoryClassOption[]
  historyPaymentMethodFilter: HistoryPaymentMethodFilter
  setHistoryPaymentMethodFilter: (value: HistoryPaymentMethodFilter) => void
  historyAttendanceFilter: HistoryAttendanceFilter
  setHistoryAttendanceFilter: (value: HistoryAttendanceFilter) => void
  historyDerivedStats: HistoryDerivedStats
  isCollectedOrdering: boolean
  activateCollectedOrdering: () => void
  filteredStudentCardsLength: number
  visiblePaymentIds: string[]
  selectPaymentIds: (ids: string[]) => void
  clearSelectedPayments: () => void
  selectedFilteredPaymentIdsLength: number
  cashSelectedCount: number
  paymentsBulkBusyAction: PaymentsBulkBusyAction
  selectedPaymentIds: string[]
  onSettlementBulkUpdate: (action: "mark_paid" | "mark_pending", ids: string[]) => void
  hasGlobalSearchResults: boolean
}

const PAYMENT_CATEGORIES: Array<readonly [PaymentCategoryFilter, string]> = [
  ["all", "All"],
  ["cash", "Cash"],
  ["card", "Card"],
  ["packages", "Packages"],
  ["dropin", "Drop-in"],
  ["history", "History"],
]

export default function StaffPaymentsBoardControls({
  studentsSummary,
  paymentCategoryFilter,
  onPaymentCategoryChange,
  studentSearchQuery,
  setStudentSearchQuery,
  isGlobalSearchLoading,
  isHistorySearchLoading,
  globalSearchError,
  paymentsFilter,
  setPaymentsFilter,
  isHistoryMode,
  historyFrom,
  historyTo,
  onHistoryRangeChange,
  todayDateIso,
  historyReadableRange,
  historyClassKey,
  setHistoryClassKey,
  historyClassOptions,
  historyPaymentMethodFilter,
  setHistoryPaymentMethodFilter,
  historyAttendanceFilter,
  setHistoryAttendanceFilter,
  historyDerivedStats,
  isCollectedOrdering,
  activateCollectedOrdering,
  filteredStudentCardsLength,
  visiblePaymentIds,
  selectPaymentIds,
  clearSelectedPayments,
  selectedFilteredPaymentIdsLength,
  cashSelectedCount,
  paymentsBulkBusyAction,
  selectedPaymentIds,
  onSettlementBulkUpdate,
  hasGlobalSearchResults,
}: Props) {
  return (
    <>
      <div className="mt-1 flex flex-nowrap gap-2 overflow-x-auto pb-1">
        {[
          {
            key: "students",
            label: "Students",
            icon: Users,
            value: studentsSummary.totalStudents,
            cardClass: "bg-gradient-to-br from-[#788fff]/22 via-[#171b38]/40 to-[#0a0f23]/60",
          },
          {
            key: "revenue",
            label: "Total revenue",
            icon: CircleDollarSign,
            value: formatMoney(studentsSummary.totalRevenueCents),
            cardClass: "bg-gradient-to-br from-emerald-500/20 via-[#132a1f]/40 to-[#0a0f23]/60",
          },
          {
            key: "pending",
            label:
              paymentCategoryFilter === "history"
                ? "Pending in scope"
                : paymentCategoryFilter === "cash"
                  ? "Cash pending"
                  : paymentCategoryFilter === "card"
                    ? "Card pending"
                    : "Pending",
            icon: Clock3,
            value: studentsSummary.pendingByContext,
            cardClass: "bg-gradient-to-br from-[#f59e0b]/18 via-[#221631]/40 to-[#0a0f23]/60",
          },
          {
            key: "paid",
            label: "Paid classes",
            icon: CheckCircle2,
            value: studentsSummary.paidStudents,
            cardClass: "bg-gradient-to-br from-[#6366f1]/22 via-[#1e1435]/40 to-[#0a0f23]/60",
          },
          {
            key: "checkin",
            label: "With check-in",
            icon: MapPin,
            value: studentsSummary.checkedInStudents,
            cardClass: "bg-gradient-to-br from-cyan-400/18 via-[#0e2430]/40 to-[#0a0f23]/60",
          },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.key}
              title={item.label}
              className={`min-w-[104px] flex-1 rounded-xl border border-white/[0.08] p-3 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.7)] ${item.cardClass}`}
            >
              <Icon className="mb-1 h-3.5 w-3.5 shrink-0 opacity-60" />
              <p className="text-2xl font-semibold text-white">{item.value}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/50">{item.label}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 md:flex-nowrap">
        <div className="inline-flex shrink-0 flex-wrap items-center gap-1.5 xl:flex-nowrap">
          {PAYMENT_CATEGORIES.map(([category, label]) => (
            <button
              key={`category-filter-${category}`}
              type="button"
              onClick={() => onPaymentCategoryChange(category)}
              className={`h-9 cursor-pointer whitespace-nowrap rounded-full border px-3 text-xs font-medium ${
                paymentCategoryFilter === category
                  ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                  : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="block min-w-0 flex-1 md:basis-[16rem] lg:basis-auto">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/45 dark:text-white/45" />
            <input
              type="search"
              value={studentSearchQuery}
              onChange={(event) => setStudentSearchQuery(event.target.value)}
              placeholder="Search student, email, phone or course"
              className="h-9 w-full rounded-full border border-black/20 bg-white/80 pl-10 pr-9 text-sm text-black placeholder:text-black/45 focus:outline-none focus:ring-2 focus:ring-[var(--brand,#b61616)]/35 dark:border-white/20 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/45"
            />
            {isGlobalSearchLoading || isHistorySearchLoading ? (
              <div role="status" aria-label="Searching..." className="absolute right-3 top-1/2 -translate-y-1/2 text-black/45 dark:text-white/45">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
            ) : null}
          </div>
          {globalSearchError ? (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{globalSearchError}</p>
          ) : null}
        </label>

        <label className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap text-xs text-black/70 dark:text-white/70 md:ml-auto">
          <span className="text-[11px] uppercase tracking-[0.16em] text-black/55 dark:text-white/55">Status</span>
          <div className="relative shrink-0">
            <select
              value={paymentsFilter}
              onChange={(event) => setPaymentsFilter(event.target.value as "all" | "pending" | "paid")}
              className="h-9 cursor-pointer appearance-none rounded-full border border-black/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(241,241,252,0.76))] px-3.5 pr-8 text-xs font-medium text-black shadow-[0_10px_22px_-18px_rgba(0,0,0,0.85)] focus:outline-none focus:ring-2 focus:ring-[var(--brand,#b61616)]/35 dark:border-white/20 dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] dark:text-white"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/55 dark:text-white/55" />
          </div>
        </label>
      </div>

      {isHistoryMode ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(15,17,23,0.94),rgba(20,24,33,0.92))] p-4 shadow-[0_14px_28px_-20px_rgba(0,0,0,0.75)]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <div className="w-full md:min-w-0">
              <CalendarPicker
                rangeMode={true}
                rangeStart={historyFrom}
                rangeEnd={historyTo}
                onRangeChange={onHistoryRangeChange}
                compact
                timezone="America/New_York"
                minDate="1900-01-01"
                isDateDisabled={(isoDate) => isoDate > todayDateIso}
                getDateDisabledReason={(isoDate) =>
                  isoDate > todayDateIso ? "History mode only supports today or past dates." : undefined
                }
              />
            </div>

            <div className="flex min-w-0 w-full flex-col">
              <div className="flex flex-wrap items-center rounded-full px-4 py-2 mb-3 bg-[var(--brand,#b61616)]/10 border border-[var(--brand,#b61616)]/25">
                <span className="rounded-full w-full px-3 py-1 text-sm font-bold text-[var(--brand,#b61616)] whitespace-nowrap">
                  {historyReadableRange || "Select date range"}
                </span>
              </div>

              <div className="grid w-full grid-cols-1 gap-2 rounded-lg py-2 mb-3 sm:grid-cols-3">
                <div className="relative min-w-0">
                  <select
                    value={historyClassKey}
                    onChange={(event) => setHistoryClassKey(event.target.value)}
                    disabled={!historyFrom || !historyTo || historyClassOptions.length === 0}
                    className="h-10 w-full appearance-none rounded-md border border-white/15 bg-white/[0.08] px-2.5 pr-7 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-[var(--brand,#b61616)]/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">All classes</option>
                    {historyClassOptions.map((option) => (
                      <option key={`history-class-${option.slug}`} value={option.slug}>
                        {option.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40" />
                </div>

                <div className="relative min-w-0">
                  <select
                    value={historyPaymentMethodFilter}
                    onChange={(event) => setHistoryPaymentMethodFilter(event.target.value as HistoryPaymentMethodFilter)}
                    className="h-10 w-full appearance-none rounded-md border border-white/15 bg-white/[0.08] px-2.5 pr-7 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-[var(--brand,#b61616)]/50"
                  >
                    <option value="all">All pay</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="package">Pkg</option>
                    <option value="dropin">Dropin</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40" />
                </div>

                <div className="relative min-w-0">
                  <select
                    value={historyAttendanceFilter}
                    onChange={(event) => setHistoryAttendanceFilter(event.target.value as HistoryAttendanceFilter)}
                    className="h-10 w-full appearance-none rounded-md border border-white/15 bg-white/[0.08] px-2.5 pr-7 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-[var(--brand,#b61616)]/50"
                  >
                    <option value="all">All attend</option>
                    <option value="attended">Attended</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="no_attendance">No show</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40" />
                </div>
              </div>

              {historyFrom && historyTo && (
                <div className="grid flex-1 grid-cols-2 gap-2.5">
                  {[
                    ["Students", historyDerivedStats.studentCount, "bg-[var(--brand,#b61616)]/10 text-[var(--brand,#b61616)]"],
                    ["Paid", historyDerivedStats.paidCount, "bg-emerald-500/10 text-emerald-400"],
                    ["Pending", historyDerivedStats.pendingCount, "bg-orange-500/10 text-orange-400"],
                    ["Collected", `$${Math.round(historyDerivedStats.totalCollected / 100)}`, "bg-blue-500/10 text-blue-400"],
                    ["Packages", historyDerivedStats.packages, "bg-fuchsia-500/10 text-fuchsia-300"],
                    ["Drop-in", historyDerivedStats.dropIn, "bg-cyan-400/10 text-cyan-200"],
                  ].map(([label, value, tone]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        if (label === "Students") setPaymentsFilter("all")
                        if (label === "Paid") setPaymentsFilter("paid")
                        if (label === "Pending") setPaymentsFilter("pending")
                        if (label === "Packages") setHistoryPaymentMethodFilter("package")
                        if (label === "Drop-in") setHistoryPaymentMethodFilter("dropin")
                        if (label === "Collected") activateCollectedOrdering()
                      }}
                      className={`flex items-center gap-3 rounded-[1.15rem] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-3 py-2.5 text-left shadow-[0_12px_24px_-22px_rgba(0,0,0,0.85)] ${label === "Collected" && isCollectedOrdering ? "ring-1 ring-blue-400/70" : ""}`}
                    >
                      <div className={`relative flex h-12 min-w-[3rem] shrink-0 items-center justify-center rounded-full px-2 ${tone}`}>
                        <span className="relative whitespace-nowrap text-[1rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">{value}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/45">
                          <span>{label}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {historyFrom && historyTo && filteredStudentCardsLength === 0 && (
                <div className="text-xs text-white/40">No students found in this range</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {(paymentCategoryFilter === "cash" || isHistoryMode || (hasGlobalSearchResults && visiblePaymentIds.length > 0)) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2.5 md:flex-nowrap">
          <p className="inline-flex min-h-10 min-w-0 flex-1 items-center rounded-lg border border-emerald-500/30 bg-[linear-gradient(145deg,rgba(16,185,129,0.2),rgba(7,45,39,0.48))] px-3 py-2 text-xs leading-snug text-emerald-700 dark:text-emerald-300 md:max-w-[36rem]">
            Confirm payment / Mark pending only changes the internal cash status (does not modify Stripe).
          </p>
          <div className="inline-flex shrink-0 flex-wrap items-center justify-end gap-2 md:ml-auto">
            <button
              type="button"
              onClick={() => selectPaymentIds(visiblePaymentIds)}
              className="inline-flex h-10 items-center rounded-full border border-black/20 px-3 text-xs text-black/75 dark:border-white/20 dark:text-white/75"
            >
              Select visible
            </button>
            <button
              type="button"
              onClick={clearSelectedPayments}
              className="inline-flex h-10 items-center rounded-full border border-black/20 px-3 text-xs text-black/75 dark:border-white/20 dark:text-white/75"
            >
              Clear selection
            </button>
            <span className="inline-flex h-10 items-center text-xs text-black/60 dark:text-white/60">Selected: {selectedFilteredPaymentIdsLength}</span>
          </div>
        </div>
      ) : null}

      {cashSelectedCount > 0 ? (
        <div className="sticky bottom-4 z-30 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(19,22,34,0.96),rgba(42,18,45,0.92))] px-4 py-3 shadow-[0_22px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Cash payments</p>
              <p className="mt-1 text-sm font-medium text-white">{cashSelectedCount} payment{cashSelectedCount === 1 ? "" : "s"} selected</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={paymentsBulkBusyAction !== null}
                onClick={() => onSettlementBulkUpdate("mark_paid", selectedPaymentIds)}
                className="rounded-lg border border-emerald-500/60 bg-emerald-500/25 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/35 disabled:opacity-60 transition-colors"
              >
                {paymentsBulkBusyAction === "mark_paid" ? "Processing..." : "Mark all paid"}
              </button>
              {!isHistoryMode ? <button
                type="button"
                disabled={paymentsBulkBusyAction !== null}
                onClick={() => onSettlementBulkUpdate("mark_pending", selectedPaymentIds)}
                className="rounded-lg border border-amber-500/60 bg-amber-500/25 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/35 disabled:opacity-60 transition-colors"
              >
                {paymentsBulkBusyAction === "mark_pending" ? "Processing..." : "Mark all pending"}
              </button> : null}
              <button
                type="button"
                onClick={clearSelectedPayments}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
