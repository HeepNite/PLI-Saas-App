"use client"

import React from "react"

import KioskNumericKeypad from "@/components/front/checkin/KioskNumericKeypad"
import * as phoneDomain from "@/lib/phone"

type PhoneCountry = ReturnType<typeof phoneDomain.getPhoneCountryCatalog>[number]["country"]
type Validation = phoneDomain.PhoneParseFailureReason | "valid" | "error"

export type InternationalPhoneFieldValue = {
  country: PhoneCountry | null
  nationalInput: string
  canonicalPhone: string | null
  touched: boolean
  validation: Validation
  requiresReentry: boolean
}

type CountryOption = { country: PhoneCountry; callingCode: string; name: string; searchText: string }

const normalizeSearch = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/^\+/, "").trim()

const countryName = (country: PhoneCountry) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(country) || country
  } catch {
    return country
  }
}

const countries: CountryOption[] = phoneDomain.getPhoneCountryCatalog()
  .map(({ country, callingCode }) => {
    const name = countryName(country)
    return { country, callingCode, name, searchText: normalizeSearch(`${name} ${country} ${callingCode}`) }
  })
  .sort((left, right) => left.name.localeCompare(right.name))

const emptyValue = (country: PhoneCountry | null, touched = false): InternationalPhoneFieldValue => ({
  country,
  nationalInput: "",
  canonicalPhone: null,
  touched,
  validation: "empty",
  requiresReentry: false,
})

export const createInternationalPhoneFieldValue = (prefill = ""): InternationalPhoneFieldValue => {
  if (!prefill.trim()) return emptyValue("US")

  try {
    const parsed = phoneDomain.parseCanonicalPhone(prefill)
    if (parsed.ok) {
      return { country: parsed.phone.country, nationalInput: parsed.phone.nationalDisplay, canonicalPhone: parsed.phone.e164, touched: false, validation: "valid", requiresReentry: false }
    }
    return { ...emptyValue(null), validation: parsed.reason, requiresReentry: true }
  } catch {
    return { ...emptyValue(null), validation: "error", requiresReentry: true }
  }
}

const deriveValue = (
  input: string,
  country: PhoneCountry | null,
  touched = true,
): InternationalPhoneFieldValue => {
  if (!country) {
    return { ...emptyValue(null, touched), nationalInput: input, validation: input ? "invalid" : "empty" }
  }

  try {
    if (input.startsWith("+")) {
      const parsed = phoneDomain.parseCanonicalPhone(input)
      if (!parsed.ok) {
        return { country, nationalInput: input, canonicalPhone: null, touched, validation: parsed.reason, requiresReentry: false }
      }
      return { country: parsed.phone.country, nationalInput: parsed.phone.nationalDisplay, canonicalPhone: parsed.phone.e164, touched, validation: "valid", requiresReentry: false }
    }

    if (!phoneDomain.isNationalPhoneDraft(input)) {
      return { country, nationalInput: input, canonicalPhone: null, touched, validation: "invalid", requiresReentry: false }
    }
    const nationalInput = phoneDomain.formatNationalDraft(input, country)
    const parsed = phoneDomain.parseNationalPhone(nationalInput, country)
    return { country, nationalInput, canonicalPhone: parsed.ok ? parsed.phone.e164 : null, touched, validation: parsed.ok ? "valid" : parsed.reason, requiresReentry: false }
  } catch {
    return { country, nationalInput: input, canonicalPhone: null, touched, validation: "error", requiresReentry: false }
  }
}

const validationMessage = (value: InternationalPhoneFieldValue) => {
  if (value.requiresReentry) return "Select a country and re-enter the phone number."
  if (!value.touched || value.validation === "valid") return null
  if (value.validation === "error") return "Phone validation is temporarily unavailable. Try again."
  if (value.validation === "empty") return "Enter a phone number."
  if (value.validation === "incomplete") return "Enter the complete phone number."
  return "Enter a valid phone number for the selected country."
}

type InternationalPhoneFieldProps = {
  value: InternationalPhoneFieldValue
  onChange: (value: InternationalPhoneFieldValue) => void
  busy?: boolean
  error?: string | null
  id?: string
}

export default function InternationalPhoneField({ value, onChange, busy = false, error = null, id = "international-phone-number" }: InternationalPhoneFieldProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const selected = countries.find((option) => option.country === value.country)
  const query = normalizeSearch(search)
  const filtered = countries.filter((option) => !query || option.searchText.includes(query))
  const listboxId = `${id}-countries`
  const countryLabelId = `${id}-country-label`
  const countryValueId = `${id}-country-value`
  const errorId = `${id}-error`
  const message = error || validationMessage(value)

  React.useEffect(() => setActiveIndex(0), [query])

  const restoreTriggerFocus = React.useCallback(() => {
    queueMicrotask(() => triggerRef.current?.focus())
  }, [])

  const close = React.useCallback(() => {
    setOpen(false)
    setSearch("")
    restoreTriggerFocus()
  }, [restoreTriggerFocus])

  const openPicker = () => {
    if (busy) return
    setOpen(true)
    queueMicrotask(() => searchRef.current?.focus())
  }

  const selectCountry = (country: PhoneCountry) => {
    if (busy) return
    onChange(deriveValue(value.nationalInput.replace(/\D/g, ""), country))
    close()
  }

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      close()
      return
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const direction = event.key === "ArrowDown" ? 1 : -1
      setActiveIndex((current) => (current + direction + filtered.length) % Math.max(filtered.length, 1))
      return
    }
    if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault()
      selectCountry(filtered[activeIndex].country)
    }
  }

  const updateDigits = (digits: string) => onChange(deriveValue(digits, value.country))
  const currentDigits = value.nationalInput.replace(/\D/g, "")

  return (
    <section className="space-y-3 text-white" aria-busy={busy || undefined}>
      <label htmlFor={id} className="block text-sm font-semibold text-white">Phone number</label>
      <span id={countryLabelId} className="sr-only">Country</span>
      <div className="flex items-stretch gap-2">
        <button ref={triggerRef} type="button" data-country-trigger disabled={busy}
          aria-labelledby={`${countryLabelId} ${countryValueId}`} aria-haspopup="dialog" aria-expanded={open} onClick={openPicker}
          className="min-h-11 min-w-11 rounded-xl border border-white/15 bg-white/[0.05] px-3 text-left text-sm transition-colors hover:border-[rgba(182,22,22,0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 motion-reduce:transition-none"
        >
          <span id={countryValueId}>{selected ? `${selected.name} ${selected.country} +${selected.callingCode}` : "Select country"}</span>
        </button>
        <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" disabled={busy}
          value={value.nationalInput}
          onChange={(event) => onChange(deriveValue(event.target.value, value.country))}
          aria-invalid={message ? "true" : undefined}
          aria-describedby={message ? errorId : undefined}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.05] px-4 text-lg text-white outline-none transition-colors focus:border-white/40 focus:ring-2 focus:ring-white/30 disabled:opacity-50 motion-reduce:transition-none"
        />
      </div>

      {open && (
        <div role="dialog" aria-label="Choose country" className="rounded-2xl border border-white/15 bg-[#11131d] p-3 shadow-2xl">
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-country-search`} className="sr-only">Search countries</label>
            <input ref={searchRef} id={`${id}-country-search`} role="combobox"
              aria-autocomplete="list" aria-expanded="true" aria-controls={listboxId}
              aria-activedescendant={filtered[activeIndex] ? `${listboxId}-${filtered[activeIndex].country}` : undefined}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search name, ISO, or calling code"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.05] px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
            />
            <button type="button" onClick={close} className="min-h-11 min-w-11 rounded-xl border border-white/15 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Close</button>
          </div>
          <div id={listboxId} role="listbox" aria-label="Countries" className="mt-2 flex max-h-64 flex-col gap-2 overflow-y-auto">
            {filtered.map((option, index) => (
              <button key={option.country} id={`${listboxId}-${option.country}`} type="button" role="option"
                aria-selected={option.country === value.country} disabled={busy}
                onMouseMove={() => setActiveIndex(index)} onClick={() => selectCountry(option.country)}
                className={`min-h-11 rounded-xl border px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${index === activeIndex ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.04]"}`}
              >
                {option.name} {option.country} +{option.callingCode}
              </button>
            ))}
            {!filtered.length && <p role="status" className="px-3 py-4 text-sm text-white/75">No countries match your search.</p>}
          </div>
        </div>
      )}

      {message && <p id={errorId} role="alert" className="text-sm text-red-300">{message}</p>}
      <p role="status" aria-live="polite" className="sr-only">
        {value.validation === "valid" ? `${selected?.name || value.country} phone number is valid.` : selected ? `Selected ${selected.name}.` : "Country selection required."}
      </p>
      <KioskNumericKeypad onDigit={(digit) => updateDigits(`${currentDigits}${digit}`)}
        onBackspace={() => updateDigits(currentDigits.slice(0, -1))}
        onClear={() => onChange(emptyValue(value.country, true))} disabled={busy} size="modal"
      />
    </section>
  )
}
