import React from "react"
import { CircleDollarSign, Clock3 } from "lucide-react"

import StaffPaymentMethodConfigPanel from "@/components/front/staff/payroll/StaffPaymentMethodConfigPanel"
import type { StaffRole } from "@/lib/security/staff-role"
import { CATEGORY_LABELS } from "./staffAdminConstants"
import type { PayrollStaffRow, StaffUserRow } from "./staffAdminTypes"

type PayrollSummary = {
  total: number
  paidCount: number
  pendingCount: number
  pending: number
  fridayCount: number
  exceptions: Array<{
    id: string
    name: string
    dayLabel: string
  }>
  maxDelay: number
}

type StaffPayrollControlPanelProps = {
  showStaffOps: boolean
  currentRole: StaffRole
  payrollRows: PayrollStaffRow[]
  payrollSummary: PayrollSummary
  rowById: Record<string, StaffUserRow>
  busyUserId: string | null
  formatMoney: (amountCents: number) => string
  formatMinutesLabel: (minutes: number) => string
  getLiveSessionMinutes: (row: StaffUserRow) => number | null
  openDelayDetails: (row: PayrollStaffRow) => void
  openPendingPayments: () => void
  runAction: (userId: string, action: string, payload?: Record<string, unknown>) => Promise<void>
}

export default function StaffPayrollControlPanel({
  showStaffOps,
  currentRole,
  payrollRows,
  payrollSummary,
  rowById,
  busyUserId,
  formatMoney,
  formatMinutesLabel,
  getLiveSessionMinutes,
  openDelayDetails,
  openPendingPayments,
  runAction,
}: StaffPayrollControlPanelProps) {
  if (!showStaffOps) return null

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Payroll</p>
        <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Staff payment control</h3>
        <p className="mt-1 text-sm text-black/65 dark:text-white/65">
          Hours worked, payments sent, and payment delay per user.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(180px,0.5fr)]">
        <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_88px_120px_90px_90px_100px] gap-2 px-2 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55 md:grid">
            <span>Staff user</span>
            <span className="text-right">Hours</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Status</span>
            <span className="text-right">Delay</span>
            <span className="text-right">Log out</span>
          </div>

          <div className="space-y-2">
            {payrollRows.length === 0 ? (
              <p className="rounded-lg border border-black/10 bg-white/65 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/65">
                No payroll rows available yet.
              </p>
            ) : (
              payrollRows.map((item) => (
                <PayrollRow
                  key={`payroll-row-${item.userId}`}
                  item={item}
                  sourceRow={rowById[item.userId]}
                  busyUserId={busyUserId}
                  formatMoney={formatMoney}
                  formatMinutesLabel={formatMinutesLabel}
                  getLiveSessionMinutes={getLiveSessionMinutes}
                  openDelayDetails={openDelayDetails}
                  runAction={runAction}
                />
              ))
            )}
          </div>
        </div>

        <PayrollSummaryCards
          payrollSummary={payrollSummary}
          formatMoney={formatMoney}
          openPendingPayments={openPendingPayments}
        />
      </div>

      {currentRole === "owner" ? <StaffPaymentMethodConfigPanel /> : null}
    </article>
  )
}

type PayrollRowProps = {
  item: PayrollStaffRow
  sourceRow: StaffUserRow | undefined
  busyUserId: string | null
  formatMoney: (amountCents: number) => string
  formatMinutesLabel: (minutes: number) => string
  getLiveSessionMinutes: (row: StaffUserRow) => number | null
  openDelayDetails: (row: PayrollStaffRow) => void
  runAction: (userId: string, action: string, payload?: Record<string, unknown>) => Promise<void>
}

function PayrollRow({
  item,
  sourceRow,
  busyUserId,
  formatMoney,
  formatMinutesLabel,
  getLiveSessionMinutes,
  openDelayDetails,
  runAction,
}: PayrollRowProps) {
  const liveMinutes = sourceRow ? getLiveSessionMinutes(sourceRow) : null
  const storedHours = typeof item.hoursWorked === "number" ? item.hoursWorked : null
  const canLogout = Boolean((sourceRow?.online || sourceRow?.authOnline) && sourceRow?.staffLastCheckInAt)

  return (
    <div className="grid gap-2 rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02] md:grid-cols-[minmax(0,1fr)_88px_120px_90px_90px_100px] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-black dark:text-white">{item.name}</p>
        <p className="truncate text-xs text-black/60 dark:text-white/60">
          {CATEGORY_LABELS[item.category]} · Pay day: {item.paydayLabel}
        </p>
      </div>
      <div className="text-sm text-black md:text-right dark:text-white">
        <PayrollHours
          storedHours={storedHours}
          liveMinutes={liveMinutes}
          formatMinutesLabel={formatMinutesLabel}
        />
      </div>
      <p className="text-sm font-semibold text-black md:text-right dark:text-white">
        {typeof item.amountCents === "number" ? formatMoney(item.amountCents) : "—"}
      </p>
      <p className="md:text-right">
        <button
          type="button"
          onClick={() => openDelayDetails(item)}
          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] transition hover:brightness-110 ${
            item.status === "paid"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : item.status === "pending"
                ? "border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)]"
                : "border-white/20 bg-white/5 text-white/75"
          }`}
        >
          {item.status === "paid" ? "Paid" : item.status === "pending" ? "Pending" : "No data"}
        </button>
      </p>
      <p className="md:text-right">
        <button
          type="button"
          onClick={() => openDelayDetails(item)}
          className="text-xs text-black/70 transition hover:text-[var(--brand,#b61616)] dark:text-white/70 dark:hover:text-[var(--brand,#ff4b4b)]"
        >
          {resolveDelayLabel(item)}
        </button>
      </p>
      <p className="md:text-right">
        {canLogout ? (
          <button
            type="button"
            disabled={busyUserId === item.userId}
            onClick={() => void runAction(item.userId, "force_logout")}
            className="inline-flex rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)] disabled:opacity-60"
          >
            {busyUserId === item.userId ? "..." : "Log out"}
          </button>
        ) : (
          <span className="text-xs text-black/60 dark:text-white/60">—</span>
        )}
      </p>
    </div>
  )
}

function PayrollHours({
  storedHours,
  liveMinutes,
  formatMinutesLabel,
}: {
  storedHours: number | null
  liveMinutes: number | null
  formatMinutesLabel: (minutes: number) => string
}) {
  if (storedHours !== null && liveMinutes !== null) {
    const totalHours = storedHours + liveMinutes / 60
    return (
      <>
        <p>{`${totalHours.toFixed(1)}h`}</p>
        <p className="text-[11px] text-emerald-500 dark:text-emerald-300">
          Live +{formatMinutesLabel(liveMinutes)}
        </p>
      </>
    )
  }

  if (storedHours !== null) return <p>{`${storedHours.toFixed(1)}h`}</p>

  if (liveMinutes !== null) {
    return (
      <>
        <p>{formatMinutesLabel(liveMinutes)}</p>
        <p className="text-[11px] text-emerald-500 dark:text-emerald-300">Live</p>
      </>
    )
  }

  return <p>—</p>
}

function resolveDelayLabel(item: PayrollStaffRow) {
  if (item.status === "paid") return "On time"
  if (item.status !== "pending") return "—"
  if (typeof item.delayDays !== "number") return "Pending"
  if (item.delayDays > 0) return `${item.delayDays}d late`
  return "Due today"
}

function PayrollSummaryCards({
  payrollSummary,
  formatMoney,
  openPendingPayments,
}: {
  payrollSummary: PayrollSummary
  formatMoney: (amountCents: number) => string
  openPendingPayments: () => void
}) {
  return (
    <div className="grid gap-3">
      <div className="rounded-xl border border-black/10 bg-white/65 p-4 dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(182,22,22,0.35)_0%,rgba(32,18,51,0.88)_100%)]">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 dark:border-white/20 dark:bg-white/10">
          <CircleDollarSign className="h-4 w-4 text-[var(--brand,#ff4b4b)]" />
        </div>
        <p className="mt-3 text-xs uppercase tracking-[0.24em] text-black/55 dark:text-white/60">Total payroll</p>
        <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
          {formatMoney(payrollSummary.total)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-black/10 bg-white/70 px-2 py-1.5 text-black dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
            Paid: {payrollSummary.paidCount} users
          </div>
          <div className="rounded-md border border-black/10 bg-white/70 px-2 py-1.5 text-black dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
            Pending: {payrollSummary.pendingCount}
          </div>
          <div className="col-span-2 rounded-md border border-black/10 bg-white/70 px-2 py-1.5 text-black dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
            <div className="flex items-center justify-between gap-2">
              <span>Pending amount: {formatMoney(payrollSummary.pending)}</span>
              <button
                type="button"
                disabled={payrollSummary.pending <= 0}
                onClick={openPendingPayments}
                className="rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)] transition disabled:opacity-45"
              >
                Pay
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-black/10 bg-white/65 p-4 dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(182,22,22,0.16)_0%,rgba(17,21,36,0.9)_100%)]">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 dark:border-white/20 dark:bg-white/10">
          <Clock3 className="h-4 w-4 text-[var(--brand,#ff4b4b)]" />
        </div>
        <p className="mt-3 text-xs uppercase tracking-[0.24em] text-black/55 dark:text-white/60">Pay day rules</p>
        <div className="mt-2 space-y-2 text-sm text-black dark:text-white">
          <div className="rounded-md border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.06]">
            General cycle:{" "}
            <span className="font-semibold">
              {payrollSummary.fridayCount > 0 ? `Friday (${payrollSummary.fridayCount} users)` : "Not configured"}
            </span>
          </div>
          <div className="rounded-md border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.06]">
            {payrollSummary.exceptions.length === 0 ? (
              <p className="text-sm">No exceptions configured.</p>
            ) : (
              <div className="space-y-1 text-xs">
                <p className="text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/60">Exceptions</p>
                {payrollSummary.exceptions.slice(0, 4).map((item) => (
                  <p key={`payday-exception-${item.id}`} className="truncate">
                    {item.name}: <span className="font-semibold">{item.dayLabel}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-black/65 dark:text-white/65">
            Max payment delay:{" "}
            <span className="font-semibold">
              {payrollSummary.pendingCount > 0 ? `${payrollSummary.maxDelay} days` : "—"}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
