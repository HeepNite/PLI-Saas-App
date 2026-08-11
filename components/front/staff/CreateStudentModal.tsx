"use client"

import React from "react"
import { createPortal } from "react-dom"
import { X, UserPlus, QrCode, Banknote, Mail, Phone, AlertCircle, CheckCircle, MessageSquareWarning } from "lucide-react"
import type { CreateStudentFormState, CreateStudentResult, CreateStudentSessionOption } from "./useStaffCreateStudentAdmin"
import { getStudentAttendanceDateBounds } from "./useStaffCreateStudentAdmin"

type CreateStudentModalProps = {
  isOpen: boolean
  form: CreateStudentFormState
  submitting: boolean
  error: string | null
  result: CreateStudentResult | null
  hasAmount: boolean
  canSubmit: boolean
  attendanceSessions: CreateStudentSessionOption[]
  onClose: () => void
  onUpdateField: <K extends keyof CreateStudentFormState>(field: K, value: CreateStudentFormState[K]) => void
  onSubmit: () => void
}

export default function CreateStudentModal({
  isOpen,
  form,
  submitting,
  error,
  result,
  hasAmount,
  canSubmit,
  attendanceSessions,
  onClose,
  onUpdateField,
  onSubmit,
}: CreateStudentModalProps) {
  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="create-student-title" className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-[#1a1d2e] p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[var(--brand,#b61616)]" />
            <h2 id="create-student-title" className="text-lg font-semibold text-white">New student</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 hover:text-white transition-colors"
            aria-label="Close create student dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {result ? (
          <SuccessView result={result} onClose={onClose} />
        ) : (
          <FormView
            form={form}
            submitting={submitting}
            error={error}
            hasAmount={hasAmount}
            canSubmit={canSubmit}
            attendanceSessions={attendanceSessions}
            onUpdateField={onUpdateField}
            onSubmit={onSubmit}
          />
        )}
      </div>
    </div>,
    document.body
  )
}

function FormView({
  form,
  submitting,
  error,
  hasAmount,
  canSubmit,
  attendanceSessions,
  onUpdateField,
  onSubmit,
}: {
  form: CreateStudentFormState
  submitting: boolean
  error: string | null
  hasAmount: boolean
  canSubmit: boolean
  attendanceSessions: CreateStudentSessionOption[]
  onUpdateField: <K extends keyof CreateStudentFormState>(field: K, value: CreateStudentFormState[K]) => void
  onSubmit: () => void
}) {
  const attendanceDateBounds = getStudentAttendanceDateBounds()
  const [recoveryCode, setRecoveryCode] = React.useState("")
  const [recoveryDraft, setRecoveryDraft] = React.useState<{ draftId: string; phone: string; email: string | null; name: string | null } | null>(null)
  const [recoveryBusy, setRecoveryBusy] = React.useState(false)
  const [noSmsConfirmed, setNoSmsConfirmed] = React.useState(false)
  const [phoneValidated, setPhoneValidated] = React.useState(false)
  const [recoveryDialogOpen, setRecoveryDialogOpen] = React.useState(false)
  const [recoveryError, setRecoveryError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const ticket = form.recoveryTicket
    return () => {
      if (!ticket) return
      void fetch("/api/staff/students/recovery/ticket", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
        keepalive: true,
      })
    }
  }, [form.recoveryTicket])

  const lookupRecovery = async () => {
    setRecoveryBusy(true)
    setRecoveryError(null)
    try {
      const response = await fetch("/api/staff/students/recovery/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: recoveryCode }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.draftId) {
        setRecoveryError(data.error || "Recovery code is unavailable.")
        return
      }
      setRecoveryDraft(data)
    } catch {
      setRecoveryError("Unable to review the recovery code. Try again.")
    } finally {
      setRecoveryBusy(false)
    }
  }

  const confirmRecovery = async () => {
    if (!recoveryDraft) return
    setRecoveryBusy(true)
    setRecoveryError(null)
    try {
      const response = await fetch("/api/staff/students/recovery/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: recoveryDraft.draftId, noSmsConfirmed, phoneValidated }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || typeof data.ticket !== "string") {
        setRecoveryError(data.error || "Recovery confirmation is unavailable.")
        return
      }
      onUpdateField("phone", recoveryDraft.phone || "")
      onUpdateField("email", recoveryDraft.email || "")
      onUpdateField("name", recoveryDraft.name || "")
      onUpdateField("recoveryTicket", data.ticket)
      setRecoveryDialogOpen(false)
      setRecoveryDraft(null)
    } catch {
      setRecoveryError("Unable to confirm recovery. Try again.")
    } finally {
      setRecoveryBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-3"
    >
      <button
        type="button"
        onClick={() => setRecoveryDialogOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2.5 text-left text-sm font-medium text-amber-50 transition-colors hover:bg-amber-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
      >
        <span className="flex items-center gap-2"><MessageSquareWarning className="h-4 w-4" />SMS code did not arrive?</span>
        <span className="text-xs text-amber-100/80">Recover student</span>
      </button>
      {form.recoveryTicket && <p className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-2 text-xs text-emerald-100">Recovery confirmed. Continue with the existing form.</p>}
      <FieldInput
        label="Email"
        icon={<Mail className="h-4 w-4" />}
        type="email"
        placeholder="student@example.com"
        value={form.email}
        onChange={(v) => onUpdateField("email", v)}
      />

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <label className="flex items-center gap-2 text-xs text-white/75">
          <input type="checkbox" checked={form.createAttendance} onChange={(event) => onUpdateField("createAttendance", event.target.checked)} />
          Create class check-in
        </label>
        {form.createAttendance && (
          <>
            <FieldInput label="Check-in date" type="date" placeholder="YYYY-MM-DD" value={form.attendanceDate} onChange={(value) => onUpdateField("attendanceDate", value)} min={attendanceDateBounds.minimum} max={attendanceDateBounds.maximum} />
            <select value={form.attendanceSessionId} onChange={(event) => onUpdateField("attendanceSessionId", event.target.value)} className="w-full rounded-xl border border-white/15 bg-white/5 p-2 text-sm text-white">
              <option value="">Select a class session</option>
              {attendanceSessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {new Date(session.startsAt).toLocaleString()}</option>)}
            </select>
          </>
        )}
      </div>
      <FieldInput
        label="Phone (E.164)"
        icon={<Phone className="h-4 w-4" />}
        type="tel"
        placeholder="+1 555 123 4567"
        value={form.phone}
        onChange={(v) => onUpdateField("phone", v)}
      />
      <FieldInput
        label="Name (optional)"
        type="text"
        placeholder="First Last"
        value={form.name}
        onChange={(v) => onUpdateField("name", v)}
      />
      <FieldInput
        label="Amount ($)"
        type="number"
        placeholder="0.00"
        value={form.amountCents}
        onChange={(v) => onUpdateField("amountCents", v)}
        min="0"
        step="0.01"
      />

      {hasAmount && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-white/70">Payment mode</span>
          <div className="flex gap-2">
            <PaymentModeButton
              icon={<Banknote className="h-4 w-4" />}
              label="Cash"
              value="cash"
              selected={form.paymentMode === "cash"}
              onSelect={() => onUpdateField("paymentMode", "cash")}
            />
            <PaymentModeButton
              icon={<QrCode className="h-4 w-4" />}
              label="Card QR"
              value="card_qr"
              selected={form.paymentMode === "card_qr"}
              onSelect={() => onUpdateField("paymentMode", "card_qr")}
            />
          </div>
        </div>
      )}

      <FieldInput
        label="Note (optional)"
        type="text"
        placeholder="Walk-in deposit, etc."
        value={form.note}
        onChange={(v) => onUpdateField("note", v)}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/15 border border-red-500/30 p-2.5 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-xl bg-[var(--brand,#b61616)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create student"}
      </button>
      {recoveryDialogOpen && (
        <RecoveryDialog
          recoveryCode={recoveryCode}
          recoveryDraft={recoveryDraft}
          recoveryBusy={recoveryBusy}
          recoveryError={recoveryError}
          noSmsConfirmed={noSmsConfirmed}
          phoneValidated={phoneValidated}
          recoveryConfirmed={form.recoveryTicket !== ""}
          onClose={() => setRecoveryDialogOpen(false)}
          onCodeChange={setRecoveryCode}
          onLookup={() => void lookupRecovery()}
          onNoSmsConfirmedChange={setNoSmsConfirmed}
          onPhoneValidatedChange={setPhoneValidated}
          onConfirm={() => void confirmRecovery()}
        />
      )}
    </form>
  )
}

function RecoveryDialog({
  recoveryCode,
  recoveryDraft,
  recoveryBusy,
  recoveryError,
  noSmsConfirmed,
  phoneValidated,
  recoveryConfirmed,
  onClose,
  onCodeChange,
  onLookup,
  onNoSmsConfirmedChange,
  onPhoneValidatedChange,
  onConfirm,
}: {
  recoveryCode: string
  recoveryDraft: { draftId: string; phone: string; email: string | null; name: string | null } | null
  recoveryBusy: boolean
  recoveryError: string | null
  noSmsConfirmed: boolean
  phoneValidated: boolean
  recoveryConfirmed: boolean
  onClose: () => void
  onCodeChange: (value: string) => void
  onLookup: () => void
  onNoSmsConfirmedChange: (value: boolean) => void
  onPhoneValidatedChange: (value: boolean) => void
  onConfirm: () => void
}) {
  const codeInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    codeInputRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="SMS recovery" className="relative z-10 w-full max-w-sm rounded-2xl border border-white/15 bg-[#1a1d2e] p-5 shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">SMS recovery</h3>
            <p className="mt-1 text-xs leading-5 text-white/70">Enter the student&apos;s `PLI-1234` or `PLI-1-1234` code to review their identity. The code alone cannot create or verify an account.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-white/50 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Close SMS recovery dialog"><X className="h-5 w-5" /></button>
        </header>
        {!recoveryDraft ? (
          <div className="mt-4 space-y-3">
            <label className="block space-y-1" htmlFor="student-recovery-code">
              <span className="text-xs font-medium text-white/70">Recovery code</span>
              <input ref={codeInputRef} id="student-recovery-code" aria-label="Recovery code" value={recoveryCode} onChange={(event) => onCodeChange(event.target.value)} placeholder="PLI-1234 or PLI-1-1234" className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-200 focus:ring-2 focus:ring-amber-200/30" />
            </label>
            <button type="button" onClick={onLookup} disabled={recoveryBusy || !recoveryCode.trim()} className="w-full rounded-xl border border-amber-300/40 px-3 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50">{recoveryBusy ? "Reviewing..." : "Review code"}</button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/80">
              <p className="font-medium text-white">Review returned identity</p>
              <p className="mt-2">{recoveryDraft.name || "No name"}</p>
              <p>{recoveryDraft.phone}</p>
              <p>{recoveryDraft.email || "No email"}</p>
            </div>
            <label className="flex gap-2 text-sm text-white/80"><input type="checkbox" checked={noSmsConfirmed} onChange={(event) => onNoSmsConfirmedChange(event.target.checked)} /> Student reports no SMS.</label>
            <label className="flex gap-2 text-sm text-white/80"><input type="checkbox" checked={phoneValidated} onChange={(event) => onPhoneValidatedChange(event.target.checked)} /> I validated this phone number.</label>
            <button type="button" onClick={onConfirm} disabled={recoveryBusy || !noSmsConfirmed || !phoneValidated || recoveryConfirmed} className="w-full rounded-xl border border-amber-300/40 px-3 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50">{recoveryBusy ? "Confirming..." : "Confirm recovery"}</button>
          </div>
        )}
        {recoveryError && <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/15 p-2 text-xs text-red-200">{recoveryError}</p>}
      </div>
    </div>,
    document.body,
  )
}

function SuccessView({ result, onClose }: { result: CreateStudentResult; onClose: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-3 text-sm text-emerald-300">
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">
            {result.isExisting ? "Existing student linked" : "Student created"}
          </p>
          {result.activation.emailInvitationAttempted && (
            <p className="text-xs text-emerald-300/80">Invitation/activation email sent.</p>
          )}
          {result.activation.phoneSignInAvailable && (
            <p className="text-xs text-emerald-300/80">Student can sign in later using phone verification.</p>
          )}
          {result.paymentMode === "cash" && result.purchaseId && (
            <p className="text-xs text-emerald-300/80">Pending cash payment created.</p>
          )}
        </div>
      </div>

      {result.stripeCheckoutUrl && (
        <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-center">
          <p className="mb-2 text-xs font-medium text-white/70">Card QR — expires in 30 minutes</p>
          <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-lg bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(result.stripeCheckoutUrl)}`}
              alt="Stripe Checkout QR code"
              width={180}
              height={180}
              className="h-full w-full"
            />
          </div>
          <p className="mt-2 text-[10px] text-white/40 break-all">{result.stripeCheckoutUrl}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
      >
        Done
      </button>
    </div>
  )
}

function FieldInput({
  label,
  icon,
  type,
  placeholder,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  icon?: React.ReactNode
  type: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  step?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-white/70">{label}</span>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={`w-full rounded-xl border border-white/15 bg-white/5 ${icon ? "pl-9" : "pl-3"} pr-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[var(--brand,#b61616)]/60`}
        />
      </div>
    </label>
  )
}

function PaymentModeButton({
  icon,
  label,
  value,
  selected,
  onSelect,
}: {
  icon: React.ReactNode
  label: string
  value: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
        selected
          ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-white"
          : "border-white/15 bg-white/5 text-white/60 hover:border-white/25"
      }`}
      data-value={value}
    >
      {icon}
      {label}
    </button>
  )
}
