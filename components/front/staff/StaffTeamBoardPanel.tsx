"use client"

import React from "react"
import Image from "next/image"
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Search,
  X,
} from "lucide-react"

import type { StaffCategory } from "@/lib/security/staff-category"
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  ROLE_LABELS,
} from "./staffAdminConstants"
import type {
  PayrollModelActionState,
  PayrollStaffRow,
  StaffPaymentModelOption,
  StaffUserRow,
} from "./staffAdminTypes"

const statusLabel = (row: StaffUserRow) => {
  if (row.banned) return "Banned"
  if (row.locked) return "Locked"
  if (row.online) return "Checked in"
  if (row.authOnline) return "Signed in"
  return "Offline"
}

const getStatusTone = (row: StaffUserRow) => {
  if (row.banned) return "text-red-300 border-red-500/40 bg-red-500/10"
  if (row.locked) return "text-amber-300 border-amber-500/40 bg-amber-500/10"
  if (row.online) return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
  if (row.authOnline) return "text-sky-300 border-sky-500/40 bg-sky-500/10"
  return "text-zinc-300 border-zinc-500/40 bg-zinc-500/10"
}

const formatDate = (value: number | null) => {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return "—"
  }
}

export type StaffTeamBoardFilters = {
  categoryFilter: StaffCategory | "all"
  setCategoryFilter: (value: StaffCategory | "all") => void
}

export type StaffTeamBoardSearch = {
  query: string
  setQuery: (value: string) => void
  submitSearch: () => void
  refresh: () => void
}

export type StaffTeamBoardData = {
  loading: boolean
  rows: StaffUserRow[]
  payrollRows: PayrollStaffRow[]
}

export type StaffTeamBoardPermissions = {
  canManageTarget: (row: StaffUserRow) => boolean
  currentUserId: string
  onPermissionDenied: () => void
}

export type StaffTeamBoardPayrollModels = {
  options: StaffPaymentModelOption[]
  loading: boolean
  error: string | null
  actionByUserId: Record<string, PayrollModelActionState>
  updateModel: (userId: string, paymentModelId: string | null) => void
}

export type StaffTeamBoardPresence = {
  busyUserId: string | null
  presenceMenuUserId: string | null
  setPresenceMenuUserId: React.Dispatch<React.SetStateAction<string | null>>
  getLiveSessionMinutes: (row: StaffUserRow) => number | null
  formatMinutesLabel: (minutes: number) => string
  getInitials: (firstName: string, lastName: string, email: string) => string
}

export type StaffTeamBoardActions = {
  openProfile: (row: StaffUserRow) => void
  openDelayDetails: (row: PayrollStaffRow) => void
  runAction: (userId: string, action: string) => void
  revokeStaff: (userId: string) => void
}

type StaffTeamBoardPanelProps = {
  showStaffOps: boolean
  filters: StaffTeamBoardFilters
  search: StaffTeamBoardSearch
  data: StaffTeamBoardData
  permissions: StaffTeamBoardPermissions
  payrollModels: StaffTeamBoardPayrollModels
  presence: StaffTeamBoardPresence
  actions: StaffTeamBoardActions
}

export default function StaffTeamBoardPanel({
  showStaffOps,
  filters,
  search,
  data,
  permissions,
  payrollModels,
  presence,
  actions,
}: StaffTeamBoardPanelProps) {
  if (!showStaffOps) return null

  const { categoryFilter, setCategoryFilter } = filters
  const { query, setQuery, submitSearch, refresh } = search
  const { loading, rows, payrollRows } = data

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff users</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Team board</h3>
        </div>
      </header>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-3 xl:justify-between">
        <div className="relative md:w-[180px] md:shrink-0 xl:hidden">
          <select
            aria-label="Filter team board by staff category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as StaffCategory | "all")}
            className="h-10 w-full cursor-pointer appearance-none rounded-md border border-black/15 bg-white px-3 pr-9 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            <option value="all">All roles</option>
            {CATEGORY_OPTIONS.map((category) => (
              <option key={`filter-option-${category}`} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45 dark:text-white/45" />
        </div>
        <div className="hidden min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-1 xl:flex">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              categoryFilter === "all"
                ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
            }`}
          >
            All
          </button>
          {CATEGORY_OPTIONS.map((category) => (
            <button
              key={`filter-${category}`}
              type="button"
              onClick={() => setCategoryFilter(category)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                categoryFilter === category
                  ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                  : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
              }`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitSearch()
          }}
          className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center md:flex-1 xl:w-[420px] xl:flex-none"
        >
          <div className="relative w-full sm:min-w-0 sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45 dark:text-white/45" />
            <input
              name="staffSearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email or name"
              className="w-full rounded-md border border-black/15 bg-white py-2 pl-9 pr-3 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>
          <button type="submit" className="shrink-0 whitespace-nowrap rounded-md border border-black/20 px-2.5 py-2 text-sm dark:border-white/20 md:px-3">
            Search
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-black/20 px-2.5 py-2 text-sm dark:border-white/20 md:px-3"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </form>
      </div>

      {!loading && rows.length === 0 ? (
        <p className="rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
          No staff users found.
        </p>
      ) : null}

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:mt-24 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`staff-skeleton-${idx}`}
                className="h-72 rounded-xl border border-black/10 bg-black/5 shimmer dark:border-white/10 dark:bg-white/[0.03]"
              />
            ))
          : rows.map((row) => (
              <StaffTeamCard
                key={row.id}
                row={row}
                rowPayroll={payrollRows.find((item) => item.userId === row.id)}
                permissions={permissions}
                payrollModels={payrollModels}
                presence={presence}
                actions={actions}
              />
            ))}
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// StaffTeamCard — single staff row card.
//
// Internal to this file by design: it inherits the panel's behavior boundaries
// (stopPropagation rules, permission gates, payroll/presence callbacks) and
// has no callers outside `StaffTeamBoardPanel`. Kept here to preserve the
// top-down review readability used elsewhere in this batch.
// ---------------------------------------------------------------------------

type StaffTeamCardProps = {
  row: StaffUserRow
  rowPayroll: PayrollStaffRow | undefined
  permissions: StaffTeamBoardPermissions
  payrollModels: StaffTeamBoardPayrollModels
  presence: StaffTeamBoardPresence
  actions: StaffTeamBoardActions
}

function StaffTeamCard({
  row,
  rowPayroll,
  permissions,
  payrollModels,
  presence,
  actions,
}: StaffTeamCardProps) {
  const { canManageTarget, currentUserId, onPermissionDenied } = permissions
  const {
    options: payrollModelOptions,
    loading: payrollModelLoading,
    error: payrollModelError,
    actionByUserId: payrollModelActionByUserId,
    updateModel: updateStaffPayrollModel,
  } = payrollModels
  const {
    busyUserId,
    presenceMenuUserId,
    setPresenceMenuUserId,
    getLiveSessionMinutes,
    formatMinutesLabel,
    getInitials,
  } = presence
  const { openProfile, openDelayDetails, runAction, revokeStaff } = actions

  const rowBusy = busyUserId === row.id
  const canManageRow = canManageTarget(row)
  const initials = getInitials(row.firstName, row.lastName, row.email)
  const statusTone = getStatusTone(row)
  const fullName = `${row.firstName} ${row.lastName}`.trim() || "No name"
  const liveSessionMinutes = getLiveSessionMinutes(row)
  const payrollModelState = payrollModelActionByUserId[row.id] ?? { status: "idle", message: null }
  const availablePayrollModels = payrollModelOptions.filter(
    (model) => model.active || model.id === row.paymentModelId
  )

  return (
    <article
      className="relative mt-10 cursor-pointer rounded-[18px] border border-white/10 bg-[linear-gradient(155deg,rgba(182,22,22,0.36)_0%,rgba(56,20,67,0.84)_48%,rgba(18,24,46,0.95)_100%)] p-4 pt-12 text-white shadow-[0_20px_36px_-22px_rgba(0,0,0,0.75)] transition hover:border-[var(--brand,#b61616)]/45"
      onClick={() => {
        if (!canManageRow) {
          onPermissionDenied()
          return
        }
        openProfile(row)
      }}
    >
      <button
        type="button"
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white/80"
        aria-label="More options"
        onClick={(event) => {
          event.stopPropagation()
          if (!canManageRow) {
            onPermissionDenied()
            return
          }
          openProfile(row)
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <header className="text-center">
        <div className="absolute left-1/2 top-0 flex h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-[20px] border border-white/20 bg-black/35 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.85)]">
          {row.avatarUrl ? (
            <Image src={row.avatarUrl} alt={fullName} fill unoptimized sizes="88px" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-bold">{initials}</span>
          )}
        </div>
        <h4 className="mx-auto mt-1 w-full max-w-full break-words px-2 text-2xl font-semibold leading-tight">{fullName}</h4>
        <div className="mt-2 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (rowPayroll) openDelayDetails(rowPayroll)
            }}
            className="inline-flex rounded-full bg-[#2e6dff] px-2 py-0.5 text-[11px] font-medium"
          >
            {ROLE_LABELS[row.role]}
          </button>
          <div className="relative inline-flex" data-presence-menu>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setPresenceMenuUserId((prev) => (prev === row.id ? null : row.id))
              }}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${statusTone}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel(row)}
            </button>
            {presenceMenuUserId === row.id ? (
              <div className="absolute left-1/2 top-[calc(100%+8px)] z-50 w-44 -translate-x-1/2 rounded-md border border-black/15 bg-white/95 p-2 shadow-[0_16px_34px_-20px_rgba(0,0,0,0.8)] backdrop-blur dark:border-white/15 dark:bg-[#0f1525]/95">
                {row.online || row.authOnline ? (
                  <button
                    type="button"
                    disabled={rowBusy || !canManageRow}
                    onClick={(event) => {
                      event.stopPropagation()
                      setPresenceMenuUserId(null)
                      runAction(row.id, "force_logout")
                    }}
                    className="inline-flex w-full items-center justify-center rounded-md border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/15 px-2 py-1.5 text-xs font-semibold text-[var(--brand,#ff4b4b)] disabled:opacity-60"
                  >
                    {rowBusy ? "Logging out..." : "Log out user"}
                  </button>
                ) : (
                  <p className="text-center text-xs text-black/65 dark:text-white/65">User is offline</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs text-white/85">
        <p className="inline-flex w-full items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-white/70">
            <MapPin className="h-3.5 w-3.5" />
            Location
          </span>
          <span className="truncate text-right">{row.location || "—"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-white/70">
            <Mail className="h-3.5 w-3.5" />
            Email
          </span>
          <span className="truncate text-right">{row.email || "—"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-white/70">
            <Phone className="h-3.5 w-3.5" />
            Phone
          </span>
          <span className="truncate text-right">{row.phone || "—"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Last sign in</span>
          <span>{formatDate(row.lastSignInAt)}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Checked in</span>
          <span>{row.online ? "Yes" : "No"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Live session</span>
          <span>{liveSessionMinutes !== null ? formatMinutesLabel(liveSessionMinutes) : "—"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>PIN access</span>
          <span>{row.hasPin ? "Configured" : "Not set"}</span>
        </p>
      </div>

      <div
        className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/65">Payroll Model</p>
          {payrollModelState.status === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" /> : null}
        </div>
        <select
          value={row.paymentModelId ?? ""}
          disabled={payrollModelLoading || payrollModelState.status === "saving" || !canManageRow}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation()
            const nextPaymentModelId = event.target.value || null
            updateStaffPayrollModel(row.id, nextPaymentModelId)
          }}
          className="mt-2 w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-[var(--brand,#b61616)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="" className="text-black">
            Set to School Default
          </option>
          {availablePayrollModels.map((model) => (
            <option key={`payroll-model-${row.id}-${model.id}`} value={model.id} className="text-black">
              {model.name}
              {model.isDefault ? " (Default)" : ""}
              {!model.active ? " (Inactive)" : ""}
            </option>
          ))}
        </select>
        <div className="mt-2 min-h-4 text-[11px] text-white/70">
          {payrollModelError ? <span className="text-[#ff9c9c]">{payrollModelError}</span> : null}
          {!payrollModelError && payrollModelState.message ? (
            <span
              className={`inline-flex items-center gap-1 ${
                payrollModelState.status === "error"
                  ? "text-[#ff9c9c]"
                  : payrollModelState.status === "success"
                    ? "text-[#9af0b5]"
                    : "text-white/70"
              }`}
            >
              {payrollModelState.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              {payrollModelState.status === "error" ? <X className="h-3.5 w-3.5" /> : null}
              {payrollModelState.message}
            </span>
          ) : null}
          {!payrollModelError && !payrollModelState.message && payrollModelLoading ? (
            <span>Loading payroll models...</span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={rowBusy || !canManageRow}
          onClick={() => runAction(row.id, row.locked ? "unlock" : "lock")}
          className="rounded-md border border-white/20 px-2 py-1 text-xs"
        >
          {row.locked ? "Unlock" : "Lock"}
        </button>
        <button
          type="button"
          disabled={rowBusy || !canManageRow}
          onClick={() => runAction(row.id, row.banned ? "unban" : "ban")}
          className="rounded-md border border-white/20 px-2 py-1 text-xs"
        >
          {row.banned ? "Unban" : "Ban"}
        </button>
        <button
          type="button"
          disabled={rowBusy || !canManageRow || row.id === currentUserId}
          onClick={() => revokeStaff(row.id)}
          className="rounded-md border border-[var(--brand,#b61616)]/70 px-2 py-1 text-xs text-[var(--brand,#ff4b4b)]"
        >
          Remove
        </button>
      </div>
    </article>
  )
}
