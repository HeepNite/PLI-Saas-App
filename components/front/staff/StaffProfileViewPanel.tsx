"use client"

import React from "react"
import Image from "next/image"
import {
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react"

import {
  PAYMENT_PREFERENCES,
  type StaffPaymentPreference,
} from "@/lib/security/staff-category"
import type { StaffRequestStatus, StaffRequestType } from "@/lib/security/staff-request"
import type { StaffProfilePaymentSummaryCard } from "@/lib/staff/profile-payment"

import {
  CATEGORY_LABELS,
  PAYMENT_PREFERENCE_LABELS,
  PROFILE_REQUEST_STATUS_OPTIONS,
  PROFILE_REQUEST_TYPE_OPTIONS,
  REQUEST_TYPE_LABELS,
  ROLE_LABELS,
  WEEKDAY_LABELS,
} from "./staffAdminConstants"
import { monthKey } from "./staffCalendarHelpers"
import type {
  ProfileRequestFormState,
  SelfProfileSnapshot,
  StaffPaymentForm,
  StaffRequestRow,
  StaffRequestSummary,
  StaffUserRow,
} from "./staffAdminTypes"
import StaffProfilePaymentSection from "./StaffProfilePaymentSection"
import StaffProfileRequestsSection from "./StaffProfileRequestsSection"
import EnrollDeviceFlow from "./EnrollDeviceFlow"

type ProfileCalendarCell = {
  day: number
  dateKey: string
  inMonth: boolean
}

type ProfileScheduleEntry = {
  id: string
  dateKey: string
  title: string
  timeLabel: string
}

type ProfileRequestTypeOption = {
  value: StaffRequestType
  label: string
  hint: string
}

type StaffProfileViewPanelProps = {
  isProfileView: boolean
  resolvedSelfProfile: SelfProfileSnapshot
  selfProfileRow: StaffUserRow
  selfProfileLoading: boolean
  selfIsOnline: boolean
  selfLiveSessionMinutes: number | null
  selfPerformanceScore: number
  selfRecommendations: string[]
  profilePaymentExpanded: boolean
  profilePaymentSummaryCards: StaffProfilePaymentSummaryCard[]
  profilePaymentForm: StaffPaymentForm
  profilePaymentSaving: boolean
  profilePaymentError: string | null
  profilePaymentSuccess: string | null
  profileScheduleMonth: Date
  profileScheduleMonthLabel: string
  profileCalendarCells: ProfileCalendarCell[]
  selfScheduleEntries: ProfileScheduleEntry[]
  selfScheduleByDay: Record<string, ProfileScheduleEntry[]>
  selfCalendarGoogleHref: string
  selfCalendarIcsDataUri: string
  profileRequestForm: ProfileRequestFormState
  profileRequestSubmitting: boolean
  profileRequestError: string | null
  profileRequestSuccess: string | null
  profileRequestStatusFilter: StaffRequestStatus | "all"
  selectedProfileRequestType: ProfileRequestTypeOption
  requestsSummary: StaffRequestSummary
  requestsLoading: boolean
  staffRequests: StaffRequestRow[]
  setProfilePaymentExpanded: React.Dispatch<React.SetStateAction<boolean>>
  setProfilePaymentError: React.Dispatch<React.SetStateAction<string | null>>
  setProfilePaymentSuccess: React.Dispatch<React.SetStateAction<string | null>>
  setProfilePaymentForm: React.Dispatch<React.SetStateAction<StaffPaymentForm>>
  setProfileScheduleMonth: React.Dispatch<React.SetStateAction<Date>>
  setProfileRequestForm: React.Dispatch<React.SetStateAction<ProfileRequestFormState>>
  setProfileRequestStatusFilter: (value: StaffRequestStatus | "all") => void
  openProfileModal: (row: StaffUserRow) => void | Promise<void>
  saveProfilePaymentInfo: (event: React.FormEvent<HTMLFormElement>) => void
  submitProfileRequest: (event: React.FormEvent<HTMLFormElement>) => void
  getInitials: (firstName: string, lastName: string, fallback: string) => string
  formatDurationLabel: (minutes: number) => string
  formatIsoDate: (value: string | null) => string
}

const togglePaymentExpanded = (
  setProfilePaymentExpanded: React.Dispatch<React.SetStateAction<boolean>>,
  setProfilePaymentError: React.Dispatch<React.SetStateAction<string | null>>,
  setProfilePaymentSuccess: React.Dispatch<React.SetStateAction<string | null>>,
) => {
  setProfilePaymentExpanded((prev) => !prev)
  setProfilePaymentError(null)
  setProfilePaymentSuccess(null)
}

export default function StaffProfileViewPanel(props: StaffProfileViewPanelProps) {
  const {
    isProfileView,
    resolvedSelfProfile,
    selfProfileRow,
    selfProfileLoading,
    selfIsOnline,
    selfLiveSessionMinutes,
    selfPerformanceScore,
    selfRecommendations,
    profilePaymentExpanded,
    profilePaymentSummaryCards,
    profilePaymentForm,
    profilePaymentSaving,
    profilePaymentError,
    profilePaymentSuccess,
    profileScheduleMonth,
    profileScheduleMonthLabel,
    profileCalendarCells,
    selfScheduleEntries,
    selfScheduleByDay,
    selfCalendarGoogleHref,
    selfCalendarIcsDataUri,
    profileRequestForm,
    profileRequestSubmitting,
    profileRequestError,
    profileRequestSuccess,
    profileRequestStatusFilter,
    selectedProfileRequestType,
    requestsSummary,
    requestsLoading,
    staffRequests,
    setProfilePaymentExpanded,
    setProfilePaymentError,
    setProfilePaymentSuccess,
    setProfilePaymentForm,
    setProfileScheduleMonth,
    setProfileRequestForm,
    setProfileRequestStatusFilter,
    openProfileModal,
    saveProfilePaymentInfo,
    submitProfileRequest,
    getInitials,
    formatDurationLabel,
    formatIsoDate,
  } = props

  if (!isProfileView) return null

  const togglePayment = () =>
    togglePaymentExpanded(setProfilePaymentExpanded, setProfilePaymentError, setProfilePaymentSuccess)

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {resolvedSelfProfile.imageUrl ? (
            <Image
              src={resolvedSelfProfile.imageUrl}
              alt="Staff avatar"
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-2xl border border-black/15 object-cover dark:border-white/15"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-black/15 bg-black/[0.05] text-2xl font-semibold text-black/80 dark:border-white/15 dark:bg-white/[0.05] dark:text-white/85">
              {getInitials(resolvedSelfProfile.firstName, resolvedSelfProfile.lastName, "")}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Employee profile</p>
            <h3 className="mt-2 text-2xl font-semibold text-black dark:text-white">
              {resolvedSelfProfile.firstName || resolvedSelfProfile.lastName
                ? `${resolvedSelfProfile.firstName} ${resolvedSelfProfile.lastName}`.trim()
                : "My staff profile"}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  selfIsOnline
                    ? "border-emerald-500/45 bg-emerald-500/12 text-emerald-300"
                    : "border-zinc-500/35 bg-zinc-500/10 text-zinc-300"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {selfIsOnline ? "Checked in" : "Not checked in"}
              </span>
              <span className="inline-flex rounded-full border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
                {selfLiveSessionMinutes !== null
                  ? `Working ${formatDurationLabel(selfLiveSessionMinutes)}`
                  : "No active work session"}
              </span>
            </div>
            <p className="mt-1 text-sm text-black/65 dark:text-white/65">
              Access level: <span className="font-semibold">{ROLE_LABELS[resolvedSelfProfile.role]}</span> ·{" "}
              <span className="font-semibold">{CATEGORY_LABELS[resolvedSelfProfile.category]}</span>
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selfProfileLoading ? (
            <span className="inline-flex items-center gap-1 text-xs text-black/65 dark:text-white/65">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading profile...
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void openProfileModal(selfProfileRow)}
            className="cursor-pointer rounded-xl border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/15 px-4 py-2 text-sm font-medium text-[var(--brand,#ff4b4b)]"
          >
            Edit my profile
          </button>
        </div>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--brand,#b61616)]/40 bg-gradient-to-br from-[var(--brand,#b61616)]/24 via-[#5f1737]/16 to-[#1b1330]/18 p-3 dark:border-[var(--brand,#b61616)]/40 dark:bg-gradient-to-br dark:from-[var(--brand,#b61616)]/32 dark:via-[#28163b]/26 dark:to-[#12192f]/24">
          <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Performance score</p>
          <p className="mt-1 text-2xl font-semibold text-black dark:text-white">{selfPerformanceScore}</p>
          <p className="text-xs text-black/70 dark:text-white/70">Based on rating, cadence and reviews.</p>
        </div>
        <div className="rounded-xl border border-sky-500/40 bg-gradient-to-br from-sky-500/20 via-[#1a395b]/16 to-[#12263f]/20 p-3 dark:border-sky-500/40 dark:bg-gradient-to-br dark:from-sky-500/26 dark:via-[#142840]/26 dark:to-[#0f1a2e]/24">
          <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Rating</p>
          <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
            {typeof resolvedSelfProfile.metrics.performanceRating === "number"
              ? `${Math.round(resolvedSelfProfile.metrics.performanceRating * 10) / 10}/5`
              : "—"}
          </p>
          <p className="text-xs text-black/70 dark:text-white/70">
            {resolvedSelfProfile.metrics.performanceReviewsCount || 0} reviews
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-[#164438]/16 to-[#132a25]/20 p-3 dark:border-emerald-500/40 dark:bg-gradient-to-br dark:from-emerald-500/24 dark:via-[#12362d]/26 dark:to-[#102521]/24">
          <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Payroll status</p>
          <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
            {resolvedSelfProfile.metrics.payrollStatus === "paid"
              ? "Paid"
              : resolvedSelfProfile.metrics.payrollStatus === "pending"
                ? "Pending"
                : "—"}
          </p>
          <p className="text-xs text-black/70 dark:text-white/70">
            Hours: {typeof resolvedSelfProfile.metrics.payrollHoursWorked === "number"
              ? resolvedSelfProfile.metrics.payrollHoursWorked.toFixed(1)
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/22 via-[#4d3618]/16 to-[#2c2214]/20 p-3 dark:border-amber-500/40 dark:bg-gradient-to-br dark:from-amber-500/28 dark:via-[#3a2b19]/24 dark:to-[#1d1815]/24">
          <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Review cycle</p>
          <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
            {typeof resolvedSelfProfile.metrics.performanceReviewCycleDays === "number"
              ? `${Math.round(resolvedSelfProfile.metrics.performanceReviewCycleDays)}d`
              : "—"}
          </p>
          <p className="text-xs text-black/70 dark:text-white/70">
            Location: {resolvedSelfProfile.location || "Not set"}
          </p>
        </div>
      </div>

      <StaffProfilePaymentSection
        resolvedSelfProfile={resolvedSelfProfile}
        profilePaymentExpanded={profilePaymentExpanded}
        profilePaymentSummaryCards={profilePaymentSummaryCards}
        onToggleExpanded={togglePayment}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">Payment information</p>
            <h4 className="mt-1 text-base font-semibold text-black dark:text-white">How you prefer to get paid</h4>
            <p className="text-xs text-black/60 dark:text-white/60">
              Keep your cash/card/credits preference and payout details updated.
            </p>
          </div>
          <button
            type="button"
            onClick={togglePayment}
            className="inline-flex items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-semibold text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white"
          >
            {profilePaymentExpanded ? "Hide payment form" : "Edit payment details"}
            <ChevronDown className={`h-4 w-4 transition ${profilePaymentExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.05]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Preference</p>
            <p className="mt-1 text-sm font-semibold text-black dark:text-white">
              {resolvedSelfProfile.paymentPreference
                ? PAYMENT_PREFERENCE_LABELS[resolvedSelfProfile.paymentPreference]
                : "Not set"}
            </p>
          </div>
          {profilePaymentSummaryCards.map((card) => (
            <div
              key={`self-profile-payment-summary-${card.label}`}
              className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.05]"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55">{card.label}</p>
              <p className="mt-1 text-sm font-semibold text-black dark:text-white">{card.value}</p>
              {card.hint ? (
                <p className="text-xs text-black/60 dark:text-white/60">{card.hint}</p>
              ) : null}
            </div>
          ))}
        </div>

        {profilePaymentExpanded ? (
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
        ) : null}
      </StaffProfilePaymentSection>

      <section className="mt-5 rounded-xl border border-black/10 bg-white/65 p-3 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">My schedule</p>
            <h4 className="mt-1 text-base font-semibold text-black dark:text-white">Current calendar</h4>
            <p className="text-xs text-black/60 dark:text-white/60">
              Connect this monthly schedule to your preferred calendar provider.
            </p>
          </div>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-black dark:text-white">{profileScheduleMonthLabel}</span>
            <button
              type="button"
              onClick={() => setProfileScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(() => {
            const icsDownload = `pli-staff-schedule-${monthKey(profileScheduleMonth)}.ics`
            const linkClass = `inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
              selfScheduleEntries.length > 0
                ? "cursor-pointer border-black/20 bg-white/70 text-black hover:border-[var(--brand,#b61616)]/45 dark:border-white/20 dark:bg-white/[0.05] dark:text-white"
                : "pointer-events-none border-black/10 bg-black/[0.04] text-black/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45"
            }`
            const calendarLinks: Array<{
              label: string
              href: string
              icon: React.ReactNode
              openInNewTab?: boolean
              downloadAs?: string
            }> = [
              {
                label: "Google",
                href: selfCalendarGoogleHref,
                icon: <ExternalLink className="h-3.5 w-3.5" />,
                openInNewTab: true,
              },
              {
                label: "Outlook",
                href: selfCalendarIcsDataUri,
                icon: <CalendarPlus className="h-3.5 w-3.5" />,
                downloadAs: icsDownload,
              },
              {
                label: "Yahoo",
                href: selfCalendarIcsDataUri,
                icon: <Download className="h-3.5 w-3.5" />,
                downloadAs: icsDownload,
              },
              {
                label: "Apple",
                href: selfCalendarIcsDataUri,
                icon: <Download className="h-3.5 w-3.5" />,
                downloadAs: icsDownload,
              },
            ]
            return calendarLinks.map((link) => (
              <a
                key={`profile-calendar-link-${link.label}`}
                href={link.href}
                {...(link.openInNewTab ? { target: "_blank", rel: "noreferrer" } : {})}
                {...(link.downloadAs ? { download: link.downloadAs } : {})}
                className={linkClass}
              >
                {link.icon}
                {link.label}
              </a>
            ))
          })()}
        </div>

        <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
            {WEEKDAY_LABELS.map((label) => (
              <span key={`profile-weekday-${label}`}>{label}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {profileCalendarCells.map((cell, idx) => {
              const events = selfScheduleByDay[cell.dateKey] || []
              return (
                <div
                  key={`profile-calendar-cell-${cell.dateKey}-${idx}`}
                  className={`min-h-[84px] rounded-md border p-1.5 ${
                    cell.inMonth
                      ? "border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.02]"
                      : "border-black/5 bg-black/[0.02] opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
                  }`}
                >
                  <p className="mb-1 text-right text-xs text-black/70 dark:text-white/70">{cell.day}</p>
                  <div className="space-y-1">
                    {events.slice(0, 2).map((event) => (
                      <p
                        key={`profile-calendar-event-${event.id}`}
                        className="truncate rounded-full bg-[var(--brand,#b61616)]/85 px-2 py-0.5 text-[11px] text-white"
                        title={`${event.title} · ${event.timeLabel}`}
                      >
                        {event.timeLabel}
                      </p>
                    ))}
                    {events.length > 2 ? (
                      <p className="text-[11px] text-black/60 dark:text-white/60">+{events.length - 2} more</p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {selfScheduleEntries.length === 0 ? (
          <p className="mt-2 text-xs text-black/60 dark:text-white/60">
            No recurring schedule configured yet. Set weekdays and shift times in your profile.
          </p>
        ) : null}
      </section>

      <StaffProfileRequestsSection>
        <section className="rounded-xl border border-black/10 bg-white/65 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">Requests</p>
          <h4 className="mt-1 text-base font-semibold text-black dark:text-white">Create request</h4>
          <p className="text-xs text-black/60 dark:text-white/60">
            Ask for schedule changes, vacation/day off, payment review or leave a consultation.
          </p>
          <form onSubmit={submitProfileRequest} className="mt-3 space-y-2.5">
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Request type</span>
              <select
                value={profileRequestForm.type}
                onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, type: event.target.value as StaffRequestType }))}
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                {PROFILE_REQUEST_TYPE_OPTIONS.map((option) => (
                  <option key={`profile-request-type-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="rounded-md border border-black/10 bg-black/[0.03] px-2.5 py-1.5 text-xs text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
              {selectedProfileRequestType.hint}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">Start date</span>
                <input
                  type="date"
                  value={profileRequestForm.startDate}
                  onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">End date</span>
                <input
                  type="date"
                  value={profileRequestForm.endDate}
                  onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Preferred shift / time (optional)</span>
              <input
                value={profileRequestForm.preferredShift}
                onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, preferredShift: event.target.value }))}
                placeholder="e.g. Tue/Thu evening after 6:00 PM"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Consultation topic (optional)</span>
              <input
                value={profileRequestForm.consultTopic}
                onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, consultTopic: event.target.value }))}
                placeholder="Payroll, class support, shift coverage..."
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Details</span>
              <textarea
                value={profileRequestForm.message}
                onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Explain your request with context, date and expected outcome."
                rows={4}
                className="w-full resize-none rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            {profileRequestError ? (
              <p className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-2.5 py-1.5 text-xs text-[var(--brand,#ff4b4b)]">
                {profileRequestError}
              </p>
            ) : null}
            {profileRequestSuccess ? (
              <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
                {profileRequestSuccess}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={profileRequestSubmitting}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {profileRequestSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {profileRequestSubmitting ? "Submitting..." : "Send request"}
            </button>
          </form>
        </section>

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
      </StaffProfileRequestsSection>

      <div className="mt-5 rounded-xl border border-black/10 bg-gradient-to-br from-[#1a1830]/70 via-[#1f1730]/60 to-[#102040]/50 p-3 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#181c31]/70 dark:via-[#251632]/65 dark:to-[#102040]/55">
        <p className="text-xs uppercase tracking-[0.22em] text-black/60 dark:text-white/60">Improvement recommendations</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {selfRecommendations.map((tip, index) => (
            <p
              key={`self-recommendation-${index}`}
              className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-black/75 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/75"
            >
              {tip}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <EnrollDeviceFlow />
      </div>
    </article>
  )
}
