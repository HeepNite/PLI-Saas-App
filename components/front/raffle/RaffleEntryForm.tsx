"use client"

import React from "react"
import { getPhoneCountryCatalog } from "@/lib/phone"

type SubmitState = "idle" | "submitting" | "entered" | "already_entered" | "closed" | "error"

type EntryFieldErrors = {
  name?: string
  phone?: string
}

type RaffleEntryApiStatus =
  | "entered"
  | "already_entered"
  | "event_closed"
  | "event_not_found"
  | "invalid_name"
  | "invalid_phone"
  | "invalid_body"
  | "rate_limited"

type RaffleEntryApiBody = { status?: RaffleEntryApiStatus } | null | undefined

type RaffleEntrySubmitOutcome =
  | { kind: "success"; state: "entered" | "already_entered" }
  | { kind: "closed" }
  | { kind: "field_error"; errors: EntryFieldErrors }
  | { kind: "error"; message: string }

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again."
export const RATE_LIMITED_MESSAGE = "Too many attempts. Please wait a moment and try again."
export const NAME_FIELD_ERROR_MESSAGE = "Enter your name (2-60 characters, letters only)."
export const PHONE_FIELD_ERROR_MESSAGE = "Enter a valid phone number."

/**
 * Maps the entries endpoint's `{ status }` body (design.md D7 / API contract)
 * to a UI outcome. Pure and exported so the state mapping is testable without
 * mounting the component.
 */
export function resolveRaffleEntrySubmitOutcome(
  httpStatus: number,
  body: RaffleEntryApiBody
): RaffleEntrySubmitOutcome {
  const status = body?.status

  if ((httpStatus === 201 || httpStatus === 200) && (status === "entered" || status === "already_entered")) {
    return { kind: "success", state: status }
  }
  if (httpStatus === 410 || status === "event_closed") {
    return { kind: "closed" }
  }
  if (httpStatus === 400) {
    if (status === "invalid_name") return { kind: "field_error", errors: { name: NAME_FIELD_ERROR_MESSAGE } }
    if (status === "invalid_phone") return { kind: "field_error", errors: { phone: PHONE_FIELD_ERROR_MESSAGE } }
    return { kind: "field_error", errors: { name: NAME_FIELD_ERROR_MESSAGE, phone: PHONE_FIELD_ERROR_MESSAGE } }
  }
  if (httpStatus === 429 || status === "rate_limited") {
    return { kind: "error", message: RATE_LIMITED_MESSAGE }
  }
  if (httpStatus === 404 || status === "event_not_found") {
    return { kind: "error", message: "This event could not be found." }
  }
  return { kind: "error", message: GENERIC_ERROR_MESSAGE }
}

/** Trims the submitted name/phone before they are sent to the API. */
export function buildRaffleEntryPayload(name: string, phone: string, country: string) {
  return { name: name.trim(), phone: phone.trim(), country }
}

type PhoneCountry = ReturnType<typeof getPhoneCountryCatalog>[number]["country"]

const countryDisplayName = (country: PhoneCountry): string => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(country) || country
  } catch {
    return country
  }
}

const countryOptions: { country: PhoneCountry; label: string }[] = getPhoneCountryCatalog()
  .map(({ country, callingCode }) => ({ country, label: `${countryDisplayName(country)} +${callingCode}` }))
  .sort((left, right) => left.label.localeCompare(right.label))

const DEFAULT_COUNTRY: PhoneCountry = "US" as PhoneCountry

type RaffleEntryFormProps = {
  slug: string
  eventTitle: string
  initiallyClosed?: boolean
}

export default function RaffleEntryForm({ slug, eventTitle, initiallyClosed = false }: RaffleEntryFormProps) {
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [country, setCountry] = React.useState<PhoneCountry>(DEFAULT_COUNTRY)
  const [state, setState] = React.useState<SubmitState>(initiallyClosed ? "closed" : "idle")
  const [fieldErrors, setFieldErrors] = React.useState<EntryFieldErrors>({})
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const isSubmitting = state === "submitting"

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    setFieldErrors({})
    setErrorMessage(null)
    setState("submitting")

    try {
      const res = await fetch(`/api/raffle/${encodeURIComponent(slug)}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRaffleEntryPayload(name, phone, country)),
      })
      const data = (await res.json().catch(() => null)) as RaffleEntryApiBody
      const outcome = resolveRaffleEntrySubmitOutcome(res.status, data)

      if (outcome.kind === "success") {
        setState(outcome.state)
        return
      }
      if (outcome.kind === "closed") {
        setState("closed")
        return
      }
      if (outcome.kind === "field_error") {
        setFieldErrors(outcome.errors)
        setState("idle")
        return
      }
      setErrorMessage(outcome.message)
      setState("error")
    } catch {
      setErrorMessage(GENERIC_ERROR_MESSAGE)
      setState("error")
    }
  }

  if (state === "entered" || state === "already_entered") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
        <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
          {state === "entered" ? "You're entered!" : "You're already entered."}
        </p>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          Good luck — check the screen when the draw starts.
        </p>
      </div>
    )
  }

  if (state === "closed") {
    return (
      <div className="rounded-xl border border-black/10 bg-black/[0.02] p-5 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <p className="text-base font-semibold text-black dark:text-white">This raffle has closed.</p>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">Entries are no longer accepted for this event.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-black dark:text-white">{eventTitle}</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">Enter your name and phone for a chance to win.</p>
      </div>

      {state === "error" && errorMessage ? (
        <div role="alert" className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
          {errorMessage}
        </div>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">Name</span>
        <input
          type="text"
          inputMode="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-base text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
        {fieldErrors.name ? (
          <span role="alert" className="text-xs text-[var(--brand,#b61616)]">{fieldErrors.name}</span>
        ) : null}
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">Phone</span>
        <div className="flex gap-2">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as PhoneCountry)}
            disabled={isSubmitting}
            className="min-h-11 rounded-md border border-black/15 bg-white px-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            {countryOptions.map((option) => (
              <option key={option.country} value={option.country}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSubmitting}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-base text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </div>
        {fieldErrors.phone ? (
          <span role="alert" className="text-xs text-[var(--brand,#b61616)]">{fieldErrors.phone}</span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 w-full rounded-lg bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/90 disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Enter raffle"}
      </button>
    </form>
  )
}
