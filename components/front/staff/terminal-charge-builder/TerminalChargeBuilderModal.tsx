"use client"

import React from "react"
import {
  TERMINAL_CHARGE_DESCRIPTION_MAX_LENGTH,
  TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS,
  TERMINAL_CHARGE_GUEST_NAME_MAX_LENGTH,
  type TerminalChargeItemInput,
  type TerminalChargeStatus,
} from "@/lib/terminal-charges/contract"
import type { PaymentRow } from "@/components/front/staff/staffAdminTypes"
import { formatMoney } from "@/components/front/staff/staffAdminFormatters"
import { ATTENDANCE_DEBT_ROW_ID_PREFIX, isAttendanceDebtRowId } from "@/components/front/staff/staffPaymentFilters"
import { ModalActions, ModalError, ModalShell, PrimaryButton, SecondaryButton } from "@/components/front/staff/modals/ModalShell"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import { createTerminalCharge, useTerminalChargeStatus } from "./useTerminalChargeStatus"

type BuilderProps = {
  payerUserId: string
  payerName: string
  openPayments: PaymentRow[]
  /** Refreshes the payments board: when the charge is paid, and when closed while still running. */
  onPaid: () => void
}

const STATUS_LABELS: Record<TerminalChargeStatus, string> = {
  pending: "Waiting on the tablet",
  collecting: "Customer is paying",
  paid: "Paid",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
}

const fieldClass = "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"

// Open rows are either Purchases (id = purchase id) or synthetic attendance-debt rows ("att-<attendanceId>").
const toOutstandingItem = (row: PaymentRow): TerminalChargeItemInput =>
  isAttendanceDebtRowId(row.id)
    ? { kind: "outstanding", outstandingAttendanceId: row.attendanceId || row.id.slice(ATTENDANCE_DEBT_ROW_ID_PREFIX.length) }
    : { kind: "outstanding", outstandingPurchaseId: row.id }

const describeRow = (row: PaymentRow) =>
  [row.courseTitle || row.courseSlug || "Class", row.classDate, row.classTime].filter(Boolean).join(" · ")

/** Pending rows, catalog items and an optional free amount (debts/adjustments); the server prices all but the free amount. */
const buildItems = (rows: PaymentRow[], catalogItems: TerminalChargeItemInput[], amount: string, description: string): TerminalChargeItemInput[] | string => {
  const items = [...rows.map(toOutstandingItem), ...catalogItems]
  if (amount.trim() || description.trim()) {
    const cents = /^\d+(\.\d{1,2})?$/.test(amount.trim()) ? Math.round(Number(amount.trim()) * 100) : 0
    if (cents <= 0) return "Enter an amount greater than $0."
    if (cents > TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS) return `Enter an amount up to $${TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS / 100}.`
    if (!description.trim()) return "Description is required."
    items.push({ kind: "free_amount", amountCents: cents, description: description.trim() })
  }
  return items.length ? items : "Pick a pending item or enter an amount."
}

export function TerminalChargeBuilderModal({ payerUserId, payerName, openPayments, onClose, onPaid }: BuilderProps & { onClose: () => void }) {
  const [terminals, setTerminals] = React.useState<Array<{ id: string; name: string }>>([])
  const [terminalId, setTerminalId] = React.useState("")
  const [selectedRowIds, setSelectedRowIds] = React.useState<string[]>([])
  const [amount, setAmount] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  const [confirmClose, setConfirmClose] = React.useState(false)
  const status = useTerminalChargeStatus(onPaid)
  const charge = status.charge
  const chargeRunning = Boolean(charge) && !status.isFinal
  const { courses } = useCatalogCourses()
  const [catalogItems, setCatalogItems] = React.useState<Array<{ label: string; input: TerminalChargeItemInput }>>([])
  const [courseSlug, setCourseSlug] = React.useState("")
  const [packageId, setPackageId] = React.useState("")
  const [guestName, setGuestName] = React.useState("")
  const course = courses.find((option) => option.slug === courseSlug)
  const pkg = course?.enrollment.packages.find((option) => option.id === packageId)

  // A package goes to this card's student; a guest class is a friend's class on their card.
  const addCatalogItem = (kind: "package" | "guest_class") => {
    if (!course || (kind === "package" && !pkg)) return setError(kind === "package" ? "Pick a course and a package." : "Pick a course.")
    const name = guestName.trim()
    const item = pkg && kind === "package"
      ? { label: `${pkg.label} — ${course.title}`, input: { kind, beneficiaryUserId: payerUserId, courseSlug: course.slug, packageId: pkg.id } }
      : { label: `Guest class — ${course.title}${name ? ` · ${name}` : ""}`, input: { kind: "guest_class" as const, courseSlug: course.slug, ...(name ? { guestName: name } : {}) } }
    setCatalogItems((list) => [...list, item])
    setGuestName("")
    setError(null)
  }

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/staff/terminals", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { items?: Array<{ id: string; name: string; active: boolean }> }
        if (!response.ok) throw new Error("Unable to load tablets")
        const active = (payload.items ?? []).filter((terminal) => terminal.active)
        if (cancelled) return
        setTerminals(active)
        setTerminalId((current) => current || active[0]?.id || "")
      })
      .catch((loadError: Error) => !cancelled && setError(loadError.message))
    return () => {
      cancelled = true
    }
  }, [])

  const send = async () => {
    const items = buildItems(openPayments.filter((row) => selectedRowIds.includes(row.id)), catalogItems.map((item) => item.input), amount, description)
    if (typeof items === "string") return setError(items)
    setSending(true)
    setError(null)
    try {
      status.track(await createTerminalCharge({ terminalId, payerUserId, items }))
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send the charge")
    } finally {
      setSending(false)
    }
  }

  // Closing stops tracking here, so a running charge asks first and refreshes the board once.
  const close = (confirmed = false) => {
    if (chargeRunning && !confirmed) return setConfirmClose(true)
    if (chargeRunning) onPaid()
    onClose()
  }

  return (
    <ModalShell title="Charge on tablet" heading={payerName} closeLabel="Close charge dialog" closeDisabled={confirmClose} onClose={() => close()}>
      {charge ? (
        <div className="space-y-3 text-sm">
          <p aria-live="polite" className="font-semibold">
            {charge.status === "pending" ? `Waiting on ${charge.terminalName}` : STATUS_LABELS[charge.status]}
            {charge.status === "pending" ? <span className="ml-2 text-xs opacity-75">{formatTimeLeft(charge.expiresAt, status.nowMs)}</span> : null}
          </p>
          <ul className="space-y-1">
            {charge.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="truncate">{item.label}</span>
                <span>{formatMoney(item.amountCents, charge.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="text-right font-semibold">Total: {formatMoney(charge.totalCents, charge.currency)}</p>
          <ModalError message={status.pollMessage || status.cancelError} />
          {/* A collecting charge is cancellable too; the server refuses if the card was charged or is processing. */}
          {chargeRunning ? (
            <ModalActions>
              <SecondaryButton onClick={() => void status.cancel()} disabled={status.cancelling}>
                {status.cancelling ? "Cancelling…" : "Cancel charge"}
              </SecondaryButton>
            </ModalActions>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="font-medium">Tablet</span>
            <select value={terminalId} onChange={(event) => setTerminalId(event.target.value)} className={fieldClass}>
              {terminals.length === 0 ? <option value="">No active tablets</option> : null}
              {terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}
            </select>
          </label>
          <fieldset className="space-y-1">
            <legend className="font-medium">Pending items</legend>
            {openPayments.length === 0 ? <p className="text-xs opacity-70">No pending items.</p> : null}
            {openPayments.map((row) => (
              <label key={row.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedRowIds.includes(row.id)}
                  onChange={(event) => setSelectedRowIds((ids) => (event.target.checked ? [...ids, row.id] : ids.filter((id) => id !== row.id)))}
                />
                {describeRow(row)}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="font-medium">Package or guest class</legend>
            {catalogItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between gap-2">
                <span className="truncate">{item.label}</span>
                <SecondaryButton onClick={() => setCatalogItems((list) => list.filter((_, at) => at !== index))}>Remove</SecondaryButton>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="font-medium">Course</span>
                <select value={courseSlug} onChange={(event) => { setCourseSlug(event.target.value); setPackageId("") }} className={fieldClass}>
                  <option value="">Select a course</option>
                  {courses.map((option) => <option key={option.slug} value={option.slug}>{option.title}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-medium">Package</span>
                <select value={packageId} onChange={(event) => setPackageId(event.target.value)} className={fieldClass}>
                  <option value="">Select a package</option>
                  {(course?.enrollment.packages ?? []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <label className="block space-y-1">
              <span className="font-medium">Friend&apos;s name (optional, guest class)</span>
              <input value={guestName} maxLength={TERMINAL_CHARGE_GUEST_NAME_MAX_LENGTH} onChange={(event) => setGuestName(event.target.value)} className={fieldClass} />
            </label>
            <ModalActions>
              <SecondaryButton onClick={() => addCatalogItem("package")}>Add package</SecondaryButton>
              <SecondaryButton onClick={() => addCatalogItem("guest_class")}>Add guest class</SecondaryButton>
            </ModalActions>
          </fieldset>
          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <label className="space-y-1">
              <span className="font-medium">Amount ($)</span>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="70.00" className={fieldClass} />
            </label>
            <label className="space-y-1">
              <span className="font-medium">Description</span>
              <input value={description} maxLength={TERMINAL_CHARGE_DESCRIPTION_MAX_LENGTH} onChange={(event) => setDescription(event.target.value)} placeholder="Extra classes owed" className={fieldClass} />
            </label>
          </div>
          <p className="text-xs opacity-70">The total is calculated when the charge is sent.</p>
          <ModalError message={error} />
          <ModalActions>
            <PrimaryButton onClick={() => void send()} disabled={sending || !terminalId}>
              {sending ? "Sending…" : "Send to tablet"}
            </PrimaryButton>
          </ModalActions>
        </div>
      )}
      {confirmClose && charge ? (
        <div role="alertdialog" className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs">
          <p>The charge is still running on {charge.terminalName}. Close anyway? The board will update on its own.</p>
          <ModalActions>
            <SecondaryButton onClick={() => setConfirmClose(false)}>Keep open</SecondaryButton>
            <SecondaryButton onClick={() => close(true)}>Close anyway</SecondaryButton>
          </ModalActions>
        </div>
      ) : null}
    </ModalShell>
  )
}

const formatTimeLeft = (expiresAt: string, nowMs: number) => {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - nowMs) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} left`
}

export function ChargeOnTabletButton({ disabled = false, ...props }: BuilderProps & { disabled?: boolean }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="Charge on tablet"
        title="Charge on tablet"
        className="min-w-0 flex-1 whitespace-nowrap rounded-md border border-sky-300/35 bg-sky-400/10 px-1.5 py-1 text-[11px] font-semibold text-sky-100 transition-colors hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Charge
      </button>
      {open ? <TerminalChargeBuilderModal {...props} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
