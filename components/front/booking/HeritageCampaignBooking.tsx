"use client"

import React from "react"
import Image from "next/image"
import { Search, X } from "lucide-react"
import {
  getHeritagePinCountryOptions,
  HERITAGE_PIN_DECORATIVE_FLAG_CODES,
  isHeritagePinAcquisitionDate,
} from "@/lib/campaigns/heritage-pin"
import type { ShareableBookingOccurrence } from "@/lib/checkin/shareable-booking"

export const countryCodeToFlag = (countryCode: string) =>
  countryCode
    .toUpperCase()
    .replace(/[A-Z]/g, (character) => String.fromCodePoint(127397 + character.charCodeAt(0)))

const stableFlagHash = (value: string) => {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const getDecorativeBookingFlag = (occurrenceId: string, occurrenceIndex?: number) => {
  const index = typeof occurrenceIndex === "number" && occurrenceIndex >= 0
    ? occurrenceIndex
    : stableFlagHash(occurrenceId)
  return HERITAGE_PIN_DECORATIVE_FLAG_CODES[index % HERITAGE_PIN_DECORATIVE_FLAG_CODES.length]
}

function EnamelFlagPin({ code, className = "" }: { code: string; className?: string }) {
  return (
    <span
      className={`relative flex items-center justify-center overflow-hidden rounded-full border-[3px] border-[#777982] bg-[linear-gradient(145deg,#555861,#191a20_72%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.34),inset_0_-5px_10px_rgba(0,0,0,0.42),0_7px_18px_rgba(0,0,0,0.48)] ${className}`}
      aria-hidden="true"
    >
      <span className="absolute inset-[4px] rounded-full bg-[radial-gradient(circle_at_35%_26%,#ffffff_0%,#f4f4f4_46%,#d5d5d5_72%,#8f9198_100%)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.16)]" />
      <span className="relative z-10 scale-[1.18] drop-shadow-[0_1px_1px_rgba(0,0,0,0.28)]">
        {countryCodeToFlag(code)}
      </span>
      <span className="absolute left-[18%] top-[10%] z-20 h-[24%] w-[42%] -rotate-[28deg] rounded-full bg-white/45 blur-[1px]" />
    </span>
  )
}

export function HeritageFlagRails() {
  const leftFlags = HERITAGE_PIN_DECORATIVE_FLAG_CODES.slice(0, 4)
  const rightFlags = HERITAGE_PIN_DECORATIVE_FLAG_CODES.slice(4)

  return (
    <div className="pointer-events-none fixed inset-0 z-0 hidden 2xl:block" aria-hidden="true" data-heritage-flag-rails="true">
      <div className="absolute left-10 top-1/2 flex -translate-y-1/2 flex-col items-center gap-9 opacity-75">
        {leftFlags.map((code, index) => (
          <EnamelFlagPin
            key={code}
            code={code}
            className={`h-12 w-12 text-[27px] ${index % 2 === 0 ? "-translate-x-1 -rotate-6" : "translate-x-3 rotate-6"}`}
          />
        ))}
      </div>
      <div className="absolute right-10 top-1/2 flex -translate-y-1/2 flex-col items-center gap-9 opacity-75">
        {rightFlags.map((code, index) => (
          <EnamelFlagPin
            key={code}
            code={code}
            className={`h-12 w-12 text-[27px] ${index % 2 === 0 ? "translate-x-1 rotate-6" : "-translate-x-3 -rotate-6"}`}
          />
        ))}
      </div>
    </div>
  )
}

export const isHeritageCampaignAcquiringNow = () => isHeritagePinAcquisitionDate(new Date())

export function HeritageCampaignBanner() {
  return (
    <div className="mb-6 flex justify-center">
      <div className="relative flex w-full max-w-sm items-center justify-center gap-2 overflow-hidden py-1 text-center sm:gap-3">
        <Image
          src="/campaigns/mexico-pin.png"
          alt=""
          width={64}
          height={64}
          aria-hidden="true"
          className="relative z-10 h-11 w-11 shrink-0 -rotate-6 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)] sm:h-14 sm:w-14"
        />
        <div className="relative z-10 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#ef4b55] sm:text-xs sm:tracking-[0.14em]">
            ¡Feliz Mes de la Herencia Latina!
          </p>
          <p className="mt-1 text-xs font-bold text-white/72 sm:text-base">
            Your country. Your community.
          </p>
        </div>
        <Image
          src="/campaigns/argentina-pin.png"
          alt=""
          width={64}
          height={64}
          aria-hidden="true"
          className="relative z-10 h-11 w-11 shrink-0 rotate-6 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)] sm:h-14 sm:w-14"
        />
        <span className="heritage-light pointer-events-none absolute inset-y-0 z-20 w-20 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-[1px] motion-reduce:hidden" aria-hidden="true" />
        <style jsx>{`
          @keyframes heritage-light-sweep {
            0%, 18% { left: -30%; opacity: 0; }
            28% { opacity: 0.65; }
            58% { opacity: 0.4; }
            72%, 100% { left: 110%; opacity: 0; }
          }
          .heritage-light {
            left: -30%;
            animation: heritage-light-sweep 4.5s ease-in-out infinite;
          }
        `}</style>
      </div>
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

        <div className="mx-auto grid w-fit grid-cols-4 gap-2" aria-label="Hispanic American and Spanish flags">
          {HERITAGE_PIN_DECORATIVE_FLAG_CODES.map((code) => (
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
  decorativeIndex,
  busy,
  disabled,
  onSelect,
}: {
  occurrence: ShareableBookingOccurrence
  decorativeIndex?: number
  busy: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const flagCode = getDecorativeBookingFlag(occurrence.id, decorativeIndex)
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
        <span className="absolute inset-0 [backface-visibility:hidden]" aria-hidden="true">
          <EnamelFlagPin code={flagCode} className="h-full w-full text-[28px] sm:text-[34px]" />
          <span className="absolute bottom-[-2px] left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/20 bg-[#b61616] px-1.5 py-0.5 text-[7px] font-black tracking-[0.08em] text-white shadow sm:hidden">
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
  const [listScrolling, setListScrolling] = React.useState(false)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const scrollIdleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCountries = countries.filter(({ code, name }) =>
    !normalizedQuery || code.toLowerCase().includes(normalizedQuery) || name.toLowerCase().includes(normalizedQuery),
  )

  React.useEffect(() => {
    searchRef.current?.focus()
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyPosition = document.body.style.position
    const previousBodyTop = document.body.style.top
    const previousBodyWidth = document.body.style.width
    const lockedScrollY = window.scrollY
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.top = `-${lockedScrollY}px`
    document.body.style.width = "100%"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.width = previousBodyWidth
      if (lockedScrollY > 0) window.scrollTo(0, lockedScrollY)
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current)
    }
  }, [onCancel])

  const handleCountryListScroll = React.useCallback(() => {
    setListScrolling(true)
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current)
    scrollIdleTimerRef.current = setTimeout(() => setListScrolling(false), 700)
  }, [])

  const handleCountryListWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.scrollTop += event.deltaY
  }, [])

  return (
    <div className="fixed inset-0 z-[13000] flex items-end justify-center overscroll-none bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="heritage-country-title"
        className="flex h-[min(92dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-[30px] border border-white/12 bg-[#151217] p-5 shadow-2xl sm:rounded-[30px] sm:p-7"
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ef4b55]">Your country pin</p>
            <h2 id="heritage-country-title" className="mt-2 text-2xl font-black text-white">Which country do you represent?</h2>
            <p className="mt-2 text-sm text-white/60">Choose your pin before booking {occurrence.title}.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close country selection" className="rounded-full border border-white/12 p-2 text-white/65 transition hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-6 shrink-0">
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

        <div
          role="listbox"
          aria-label="Available country pins"
          onScroll={handleCountryListScroll}
          onWheel={handleCountryListWheel}
          className={`heritage-country-scroll mt-3 grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto overscroll-contain pr-1 ${listScrolling ? "heritage-country-scroll--active" : ""}`}
        >
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
          className="mt-5 h-12 w-full shrink-0 rounded-full bg-[#b61616] text-sm font-black tracking-[0.08em] text-white transition hover:bg-[#d51f2b] disabled:cursor-not-allowed disabled:opacity-40"
        >
          CONTINUE TO BOOK
        </button>
        <p className="mt-3 shrink-0 text-center text-[11px] text-white/40">The flag on the class button is decorative and does not choose your pin.</p>
      </section>
    </div>
  )
}
