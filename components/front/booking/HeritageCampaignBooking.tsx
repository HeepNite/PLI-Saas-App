"use client"

import React from "react"
import { Search, X } from "lucide-react"
import {
  getHeritagePinCountryOptions,
  isHeritagePinAcquisitionDate,
} from "@/lib/campaigns/heritage-pin"
import type { ShareableBookingOccurrence } from "@/lib/checkin/shareable-booking"

const DECORATIVE_FLAG_CODES = ["AR", "MX", "CO", "DO", "PR", "BR", "PE", "CU"] as const

export const countryCodeToFlag = (countryCode: string) =>
  countryCode
    .toUpperCase()
    .replace(/[A-Z]/g, (character) => String.fromCodePoint(127397 + character.charCodeAt(0)))

export const getDecorativeBookingFlag = (occurrenceId: string) => {
  const hash = [...occurrenceId].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return DECORATIVE_FLAG_CODES[hash % DECORATIVE_FLAG_CODES.length]
}

export const isHeritageCampaignAcquiringNow = () => isHeritagePinAcquisitionDate(new Date())

export function HeritageCampaignBanner() {
  return (
    <div className="mb-6 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ef4b55] sm:text-xs">
        ¡Feliz Mes de la Herencia Latina!
      </p>
      <p className="mt-1 text-sm font-bold text-white/72 sm:text-base">
        Your country. Your community.
      </p>
    </div>
  )
}

export function HeritageCampaignPromoDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[12900] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="heritage-promo-title"
        className="relative w-full max-w-sm overflow-hidden rounded-[30px] border border-white/12 bg-[#151217] p-6 text-center shadow-[0_30px_90px_-35px_rgba(213,31,43,0.75)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Heritage celebration"
          className="absolute right-3 top-3 rounded-full border border-white/12 p-2 text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto grid w-fit grid-cols-4 gap-2" aria-label="Latin American and Caribbean flags">
          {DECORATIVE_FLAG_CODES.map((code) => (
            <span
              key={code}
              className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[#74747c] bg-[#24242a] text-2xl shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08),0_6px_16px_rgba(0,0,0,0.4)]"
              aria-hidden="true"
            >
              {countryCodeToFlag(code)}
            </span>
          ))}
        </div>

        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.14em] text-[#ef4b55]">
          ¡Feliz Mes de la Herencia Latina!
        </p>
        <h2 id="heritage-promo-title" className="mt-2 text-2xl font-black leading-tight text-white">
          Your country. Your community.
        </h2>
        <p className="mt-3 text-sm font-semibold text-white/68">
          Book online. Choose your country. Pick up your pin.
        </p>
        <p className="mt-2 text-xs text-white/45">
          $15 Sunday &amp; Monday classes after pickup.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-11 w-full rounded-full bg-[#b61616] text-xs font-black tracking-[0.09em] text-white transition hover:bg-[#d51f2b]"
        >
          EXPLORE CLASSES
        </button>
      </section>
    </div>
  )
}

export function HeritageBookButton({
  occurrence,
  busy,
  disabled,
  onSelect,
}: {
  occurrence: ShareableBookingOccurrence
  busy: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const flagCode = getDecorativeBookingFlag(occurrence.id)
  const label = `Book ${occurrence.title} on ${occurrence.date}`

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
      className="group h-[52px] w-[52px] rounded-full [perspective:600px] disabled:cursor-not-allowed disabled:opacity-45 sm:h-[60px] sm:w-[60px]"
    >
      <span className="relative block h-full w-full rounded-full transition-transform duration-500 [transform-style:preserve-3d] motion-safe:group-hover:[transform:rotateY(180deg)] motion-safe:group-focus-visible:[transform:rotateY(180deg)] motion-reduce:transition-colors">
        <span
          className="absolute inset-0 flex items-center justify-center rounded-full border-[3px] border-[#74747c] bg-[#24242a] text-[25px] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08),0_5px_16px_rgba(0,0,0,0.38)] [backface-visibility:hidden] sm:text-[30px]"
          aria-hidden="true"
        >
          <span>{countryCodeToFlag(flagCode)}</span>
          <span className="absolute bottom-[-2px] rounded-full bg-[#b61616] px-1.5 py-0.5 text-[7px] font-black tracking-[0.08em] text-white shadow sm:hidden">
            BOOK
          </span>
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center rounded-full border-[3px] border-[#74747c] bg-[#b61616] text-[9px] font-black tracking-[0.08em] text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.09),0_5px_16px_rgba(0,0,0,0.38)] [backface-visibility:hidden] [transform:rotateY(180deg)] motion-reduce:[transform:none] motion-reduce:opacity-0 sm:text-[10px]"
          aria-hidden="true"
        >
          {busy ? "OPEN" : "BOOK"}
        </span>
      </span>
    </button>
  )
}

export function HeritageCountryDialog({
  occurrence,
  onCancel,
  onConfirm,
}: {
  occurrence: ShareableBookingOccurrence
  onCancel: () => void
  onConfirm: (countryCode: string) => void
}) {
  const countries = React.useMemo(() => getHeritagePinCountryOptions(), [])
  const [query, setQuery] = React.useState("")
  const [selectedCountry, setSelectedCountry] = React.useState("")
  const searchRef = React.useRef<HTMLInputElement>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCountries = countries.filter(({ code, name }) =>
    !normalizedQuery || code.toLowerCase().includes(normalizedQuery) || name.toLowerCase().includes(normalizedQuery),
  )

  React.useEffect(() => {
    searchRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[13000] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="heritage-country-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[30px] border border-white/12 bg-[#151217] p-5 shadow-2xl sm:rounded-[30px] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ef4b55]">Your country pin</p>
            <h2 id="heritage-country-title" className="mt-2 text-2xl font-black text-white">Which country do you represent?</h2>
            <p className="mt-2 text-sm text-white/60">Choose your pin before booking {occurrence.title}.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close country selection" className="rounded-full border border-white/12 p-2 text-white/65 transition hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search countries"
            placeholder="Search your country"
            className="h-12 w-full rounded-2xl border border-white/12 bg-[#211e24] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#d51f2b]"
          />
        </div>

        <div role="listbox" aria-label="Available country pins" className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
          {filteredCountries.map(({ code, name }) => {
            const selected = selectedCountry === code
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                key={code}
                onClick={() => setSelectedCountry(code)}
                className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-xs font-bold transition ${selected ? "border-[#ef4b55] bg-[#b61616] text-white" : "border-white/10 bg-[#211e24] text-white/72 hover:border-white/25 hover:text-white"}`}
              >
                <span className="text-lg" aria-hidden="true">{countryCodeToFlag(code)}</span>
                <span className="truncate">{name}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          disabled={!selectedCountry}
          onClick={() => onConfirm(selectedCountry)}
          className="mt-5 h-12 w-full rounded-full bg-[#b61616] text-sm font-black tracking-[0.08em] text-white transition hover:bg-[#d51f2b] disabled:cursor-not-allowed disabled:opacity-40"
        >
          CONTINUE TO BOOK
        </button>
        <p className="mt-3 text-center text-[11px] text-white/40">The flag on the class button is decorative and does not choose your pin.</p>
      </section>
    </div>
  )
}
