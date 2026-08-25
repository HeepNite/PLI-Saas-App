"use client"

import React from "react"
import { Loader2 } from "lucide-react"
import type { StaffRequestType } from "@/lib/security/staff-request"
import { PROFILE_REQUEST_TYPE_OPTIONS } from "../staffAdminConstants"
import type { ProfileRequestFormState } from "../staffAdminTypes"
import type { ProfileRequestTypeOption } from "./profileTypes"

type ProfileRequestCreateFormProps = {
  profileRequestForm: ProfileRequestFormState
  profileRequestSubmitting: boolean
  profileRequestError: string | null
  profileRequestSuccess: string | null
  selectedProfileRequestType: ProfileRequestTypeOption
  setProfileRequestForm: React.Dispatch<React.SetStateAction<ProfileRequestFormState>>
  submitProfileRequest: (event: React.FormEvent<HTMLFormElement>) => void
}

export default function ProfileRequestCreateForm(props: ProfileRequestCreateFormProps) {
  const {
    profileRequestForm,
    profileRequestSubmitting,
    profileRequestError,
    profileRequestSuccess,
    selectedProfileRequestType,
    setProfileRequestForm,
    submitProfileRequest,
  } = props

  return (
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
  )
}
