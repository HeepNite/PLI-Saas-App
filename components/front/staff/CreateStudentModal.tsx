"use client"

import React from "react"
import { createPortal } from "react-dom"
import { X, UserPlus, QrCode, Banknote, Mail, Phone, AlertCircle, CheckCircle } from "lucide-react"
import type { CreateStudentFormState, CreateStudentResult, CreateStudentSessionOption } from "./useStaffCreateStudentAdmin"

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
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-[#1a1d2e] p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[var(--brand,#b61616)]" />
            <h2 className="text-lg font-semibold text-white">New student</h2>
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
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-3"
    >
      <FieldInput
        label="Email"
        icon={<Mail className="h-4 w-4" />}
        type="email"
        placeholder="student@example.com"
        value={form.email}
        onChange={(v) => onUpdateField("email", v)}
      />
      <FieldInput
        label="Phone"
        icon={<Phone className="h-4 w-4" />}
        type="tel"
        placeholder="1 555 123 4567"
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

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <label className="flex items-start gap-2 text-xs text-white/75">
          <input
            type="checkbox"
            checked={form.createAttendance}
            onChange={(e) => onUpdateField("createAttendance", e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block font-medium text-white/85">Create class check-in</span>
            <span className="text-white/50">Use this when the new student is physically present for class.</span>
          </span>
        </label>

        {form.createAttendance && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-white/70" htmlFor="create-student-session">
              Class session
            </label>
            <select
              id="create-student-session"
              value={form.attendanceSessionId}
              onChange={(e) => onUpdateField("attendanceSessionId", e.target.value)}
              className="w-full rounded-lg border border-white/12 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-[var(--brand,#b61616)]"
            >
              <option value="">Select a class session</option>
              {attendanceSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {formatSessionOption(session)}
                </option>
              ))}
            </select>
            {!form.attendanceSessionId && (
              <p className="text-[11px] text-amber-300">Select a class session or turn off check-in to create the student.</p>
            )}
          </div>
        )}
      </div>

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
    </form>
  )
}

function formatSessionOption(session: CreateStudentSessionOption) {
  const startsAt = new Date(session.startsAt)
  const dateLabel = Number.isNaN(startsAt.getTime())
    ? session.startsAt
    : startsAt.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  return `${session.isCurrent ? "Current · " : ""}${session.title || session.courseSlug} · ${dateLabel}`
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
  step,
}: {
  label: string
  icon?: React.ReactNode
  type: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  min?: string
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
