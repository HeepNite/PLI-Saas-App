"use client"

import React from "react"
import { Loader2 } from "lucide-react"
import { PAYMENT_PREFERENCES, type StaffPaymentPreference } from "@/lib/security/staff-category"
import { PAYMENT_PREFERENCE_LABELS } from "../staffAdminConstants"
import type { SelfProfileSnapshot, StaffPaymentForm } from "../staffAdminTypes"

type ProfilePaymentFormProps = {
  resolvedSelfProfile: SelfProfileSnapshot
  profilePaymentForm: StaffPaymentForm
  profilePaymentSaving: boolean
  profilePaymentError: string | null
  profilePaymentSuccess: string | null
  setProfilePaymentForm: React.Dispatch<React.SetStateAction<StaffPaymentForm>>
  setProfilePaymentSuccess: React.Dispatch<React.SetStateAction<string | null>>
  saveProfilePaymentInfo: (event: React.FormEvent<HTMLFormElement>) => void
}

export default function ProfilePaymentForm(props: ProfilePaymentFormProps) {
  const {
    resolvedSelfProfile,
    profilePaymentForm,
    profilePaymentSaving,
    profilePaymentError,
    profilePaymentSuccess,
    setProfilePaymentForm,
    setProfilePaymentSuccess,
    saveProfilePaymentInfo,
  } = props

  return (
    <form onSubmit={saveProfilePaymentInfo} className="mt-3 space-y-4 rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">

      {/* Payment method selector */}
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-black/65 dark:text-white/65">Payment method</span>
        <select
          value={profilePaymentForm.paymentPreference}
          onChange={(event) => {
            setProfilePaymentForm((prev) => ({
              ...prev,
              paymentPreference: (event.target.value as StaffPaymentPreference | "") || "",
            }))
            setProfilePaymentSuccess(null)
          }}
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        >
          <option value="">Select a payment method</option>
          {PAYMENT_PREFERENCES.map((preference) => (
            <option key={`profile-payment-preference-${preference}`} value={preference}>
              {PAYMENT_PREFERENCE_LABELS[preference]}
            </option>
          ))}
        </select>
      </label>

      {/* Dynamic fields: Direct Deposit */}
      {profilePaymentForm.paymentPreference === "direct_deposit" && (
        <div className="space-y-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Bank Account Details</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-black/65 dark:text-white/65">Bank name</span>
              <input
                value={profilePaymentForm.bankName}
                onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, bankName: event.target.value })); setProfilePaymentSuccess(null) }}
                placeholder="e.g. Chase, TD Bank"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Routing Number</span>
              <input
                value={profilePaymentForm.routingNumber}
                onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, routingNumber: event.target.value })); setProfilePaymentSuccess(null) }}
                placeholder="9 digits"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Account Number</span>
              <input
                value={profilePaymentForm.accountNumber}
                onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, accountNumber: event.target.value })); setProfilePaymentSuccess(null) }}
                placeholder="Account #"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-black/65 dark:text-white/65">Account Type</span>
              <select
                value={profilePaymentForm.accountType}
                onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, accountType: event.target.value })); setProfilePaymentSuccess(null) }}
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                <option value="">Select account type</option>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Dynamic fields: Zelle / Venmo */}
      {profilePaymentForm.paymentPreference === "zelle" && (
        <div className="space-y-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Zelle / Venmo</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Zelle ID (Email or Phone)</span>
              <input
                value={profilePaymentForm.zelleId}
                onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, zelleId: event.target.value })); setProfilePaymentSuccess(null) }}
                placeholder="e.g. email@mail.com"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Venmo Username (optional)</span>
              <input
                value={profilePaymentForm.venmoUser}
                onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, venmoUser: event.target.value })); setProfilePaymentSuccess(null) }}
                placeholder="@username"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
          </div>
        </div>
      )}

      {/* Dynamic fields: Mercado Pago */}
      {profilePaymentForm.paymentPreference === "mercadopago" && (
        <div className="space-y-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Mercado Pago</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">CBU / CVU</span>
              <input
                value={profilePaymentForm.cbu}
                onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, cbu: event.target.value })); setProfilePaymentSuccess(null) }}
                placeholder="22 digits"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Alias</span>
              <input
                value={profilePaymentForm.alias}
                onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, alias: event.target.value })); setProfilePaymentSuccess(null) }}
                placeholder="e.g. nombre.mp.alias"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-black/65 dark:text-white/65">Account Holder</span>
              <input
                value={profilePaymentForm.accountHolder}
                onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, accountHolder: event.target.value })); setProfilePaymentSuccess(null) }}
                placeholder="Full name as shown in Mercado Pago"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
          </div>
        </div>
      )}

      {/* Cash: no extra info needed */}
      {profilePaymentForm.paymentPreference === "cash" && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
          No additional information needed for cash payments.
        </p>
      )}

      {/* Credits: internship note */}
      {profilePaymentForm.paymentPreference === "credits" && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          Credits are only available for internship/pasante arrangements. Your manager will set this up.
        </p>
      )}

      {/* Stripe: no self-service */}
      {profilePaymentForm.paymentPreference === "stripe" && (
        <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-400">
          Stripe payouts are configured by your school admin. No information needed from your side.
        </p>
      )}

      {profilePaymentError ? (
        <p className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-2.5 py-1.5 text-xs text-[var(--brand,#ff4b4b)]">
          {profilePaymentError}
        </p>
      ) : null}
      {profilePaymentSuccess ? (
        <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
          {profilePaymentSuccess}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={profilePaymentSaving}
        className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/90 disabled:opacity-50"
      >
        {profilePaymentSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : profilePaymentForm.paymentPreference !== "" && profilePaymentForm.paymentPreference !== resolvedSelfProfile.assignedPaymentPreference ? (
          "Request Payment Method Change"
        ) : (
          "Save information"
        )}
      </button>
    </form>
  )
}
