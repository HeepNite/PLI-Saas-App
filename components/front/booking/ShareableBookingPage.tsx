"use client"

import React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { RefreshCw, Search } from "lucide-react"
import type { CourseData } from "@/constants/courses"
import {
  HeritageBookButton,
  HeritageCampaignBanner,
  HeritageCampaignPromoDialog,
  HeritageCountryDialog,
  isHeritageCampaignAcquiringNow,
} from "@/components/front/booking/HeritageCampaignBooking"
import {
  BOOKING_CLASS_TYPE_LABELS,
  buildShareableBookingOccurrences,
  filterBookingOccurrences,
  focusBookingOccurrences,
  getBookingFilterOptions,
  getCurrentBookingDateKey,
  getCurrentBookingMonthKey,
  groupBookingOccurrencesByDate,
  type BookingClassTypeFilter,
  type BookingPromotionFocus,
  type ShareableBookingOccurrence,
} from "@/lib/checkin/shareable-booking"

export type BookingPageStatus = "loading" | "ready" | "empty" | "error"

type BookingPageContentProps = {
  status: BookingPageStatus
  occurrences: ShareableBookingOccurrence[]
  selectedMonth: string | "all"
  selectedClassType: BookingClassTypeFilter
  searchQuery: string
  onMonthChange: (month: string | "all") => void
  onClassTypeChange: (classType: BookingClassTypeFilter) => void
  onSearchQueryChange: (query: string) => void
  navigatingId: string | null
  onSelect: (occurrence: ShareableBookingOccurrence) => void
  onRetry?: () => void
  focused?: boolean
}

type CatalogCoursesResponse = {
  courses?: CourseData[]
}

const formatTime = (time: string) => {
  const [hour, minute] = time.split(":").map(Number)
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    .format(new Date(2020, 0, 1, hour, minute))
}

const formatMonth = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
}

const formatDateHeading = (dateKey: string) => {
  const today = getCurrentBookingDateKey()
  const [year, month, day] = dateKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  const tomorrow = new Date(`${today}T12:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowKey = tomorrow.toISOString().slice(0, 10)
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date).toUpperCase()

  if (dateKey === today) return `TODAY · ${dateLabel.split(", ").at(-1)}`
  if (dateKey === tomorrowKey) return `TOMORROW · ${dateLabel.split(", ").at(-1)}`
  return dateLabel.replace(",", " ·")
}

const StateCard = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/10 bg-[#1d1b21] px-6 py-12 text-center shadow-[0_20px_70px_-44px_rgba(182,22,22,0.75)]">
    {children}
  </div>
)

export function BookingBrandHeader({ focused = false }: { focused?: boolean }) {
  return (
    <header className="mb-9 flex flex-col items-center text-center">
      <Image
        src="/logo/logo-white.png"
        alt="Palladium Latin Art"
        width={224}
        height={89}
        priority
        className="h-auto w-44 object-contain sm:w-52"
      />
      <div className="mt-7 w-full">
        <HeritageCampaignBanner />
      </div>
      <h1 className="text-4xl font-black tracking-[-0.035em] text-white sm:text-5xl">
        {focused ? "Monday Salsa Beginner" : "Upcoming classes"}
      </h1>
      <p className="mt-3 text-base text-white/58">
        {focused ? "Choose an upcoming Monday and reserve your class." : "Choose your month, find your style, and book your class."}
      </p>
    </header>
  )
}

const CourseThumbnail = ({ occurrence }: { occurrence: ShareableBookingOccurrence }) => (
  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#b61616] sm:h-14 sm:w-14">
    {occurrence.coverImageUrl ? (
      // Course media is managed by staff and may come from configured external storage.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={occurrence.coverImageUrl} alt="" className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,#d51f2b,#710b16)]">
        <span className="text-[10px] font-black tracking-[0.16em] text-white">PLI</span>
      </div>
    )}
  </div>
)

const BookingDiscoveryToolbar = ({
  occurrences,
  selectedMonth,
  selectedClassType,
  searchQuery,
  onMonthChange,
  onClassTypeChange,
  onSearchQueryChange,
}: Pick<
  BookingPageContentProps,
  | "occurrences"
  | "selectedMonth"
  | "selectedClassType"
  | "searchQuery"
  | "onMonthChange"
  | "onClassTypeChange"
  | "onSearchQueryChange"
>) => {
  const options = getBookingFilterOptions(occurrences)
  const monthOptions = [...new Set([
    ...(selectedMonth === "all" ? [] : [selectedMonth]),
    ...options.months,
  ])].sort()
  const classTypeOptions = [...new Set([
    ...(selectedClassType === "all" ? [] : [selectedClassType]),
    ...options.classTypes,
  ])]

  const controlClass = "h-10 min-w-0 rounded-full border border-white/12 bg-[#1d1b21] px-2 text-[10px] font-bold text-white outline-none transition focus:border-[#d51f2b] sm:h-11 sm:px-4 sm:text-xs"
  const compactTypeLabel = (classType: keyof typeof BOOKING_CLASS_TYPE_LABELS) => {
    if (classType === "salsa-cubana") return "Cuban"
    if (classType === "salsa-on2") return "On2"
    return BOOKING_CLASS_TYPE_LABELS[classType]
  }

  return (
    <div className="mb-8 grid grid-cols-[2fr_1fr_1fr] gap-1.5 sm:gap-2.5">
      <label className="relative block min-w-0">
        <span className="sr-only">Search classes</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/42 sm:left-4 sm:h-4 sm:w-4" aria-hidden="true" />
        <input
          type="search"
          aria-label="Search classes"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search…"
          className={`${controlClass} w-full pl-8 font-medium placeholder:text-white/35 sm:pl-11`}
        />
      </label>
      <select
        aria-label="Filter by month"
        value={selectedMonth}
        onChange={(event) => onMonthChange(event.target.value)}
        className={controlClass}
      >
        <option value="all">All dates</option>
        {monthOptions.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}
      </select>
      <select
        aria-label="Filter by class type"
        value={selectedClassType}
        onChange={(event) => onClassTypeChange(event.target.value as BookingClassTypeFilter)}
        className={controlClass}
      >
        <option value="all">All</option>
        {classTypeOptions.map((classType) => (
          <option key={classType} value={classType}>{compactTypeLabel(classType)}</option>
        ))}
      </select>
    </div>
  )
}

export function BookingPageContent({
  status,
  occurrences,
  selectedMonth,
  selectedClassType,
  searchQuery,
  onMonthChange,
  onClassTypeChange,
  onSearchQueryChange,
  navigatingId,
  onSelect,
  onRetry,
  focused = false,
}: BookingPageContentProps) {
  if (status === "loading") {
    return (
      <StateCard>
        <div className="mx-auto mb-4 h-7 w-7 animate-spin rounded-full border-2 border-white/15 border-t-[#d51f2b]" />
        <p className="text-base font-semibold text-white">Loading upcoming classes…</p>
      </StateCard>
    )
  }

  if (status === "error") {
    return (
      <StateCard>
        <p className="text-xl font-bold text-white">We couldn’t load upcoming classes</p>
        <p className="mt-2 text-sm text-white/55">Please check your connection and try again.</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mx-auto mt-6 inline-flex items-center gap-2 rounded-xl bg-[#b61616] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#d51f2b]">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        ) : null}
      </StateCard>
    )
  }

  if (status === "empty") {
    return (
      <StateCard>
        <p className="text-xl font-bold text-white">No upcoming classes are available</p>
        <p className="mt-2 text-sm text-white/55">Please check back when the next schedule is published.</p>
      </StateCard>
    )
  }

  const filteredOccurrences = focused
    ? occurrences
    : filterBookingOccurrences(occurrences, selectedMonth, selectedClassType, searchQuery)
  const groups = groupBookingOccurrencesByDate(filteredOccurrences)
  const decorativeFlagIndexes = new Map(filteredOccurrences.map((occurrence, index) => [occurrence.id, index]))

  return (
    <section aria-live="polite">
      {!focused ? (
        <BookingDiscoveryToolbar
          occurrences={occurrences}
          selectedMonth={selectedMonth}
          selectedClassType={selectedClassType}
          searchQuery={searchQuery}
          onMonthChange={onMonthChange}
          onClassTypeChange={onClassTypeChange}
          onSearchQueryChange={onSearchQueryChange}
        />
      ) : null}

      {groups.length === 0 ? (
        <StateCard>
          <p className="text-xl font-bold text-white">No matching classes</p>
          <p className="mt-2 text-sm text-white/55">Try another search, month, or class type.</p>
        </StateCard>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.date}>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                {formatDateHeading(group.date)}
              </p>
              <div className="space-y-2.5">
                {group.occurrences.map((occurrence) => {
                  const isNavigating = navigatingId === occurrence.id
                  const isDisabled = navigatingId !== null

                  return (
                    <article key={occurrence.id} className="grid grid-cols-[48px_minmax(0,1fr)_52px] items-center gap-2.5 rounded-2xl border border-white/12 bg-[#1d1b21] px-3 py-3 shadow-sm sm:grid-cols-[56px_minmax(0,1fr)_60px] sm:gap-4 sm:px-4">
                      <CourseThumbnail occurrence={occurrence} />
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-sm font-bold text-white sm:text-base">{occurrence.title}</p>
                        <p className="mt-1 truncate text-xs font-semibold tabular-nums text-white/68 sm:text-sm">
                          {formatTime(occurrence.time)}
                          {occurrence.durationMinutes ? ` · ${occurrence.durationMinutes} min` : ""}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-white/42 sm:text-xs">{occurrence.instructorName}</p>
                      </div>
                      <HeritageBookButton
                        occurrence={occurrence}
                        decorativeIndex={decorativeFlagIndexes.get(occurrence.id)}
                        busy={isNavigating}
                        disabled={isDisabled}
                        onSelect={() => onSelect(occurrence)}
                      />
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}

export default function ShareableBookingPage({ focus }: { focus?: BookingPromotionFocus }) {
  const router = useRouter()
  const focusCourseSlug = focus?.courseSlug
  const focusWeekday = focus?.weekday
  const [status, setStatus] = React.useState<BookingPageStatus>("loading")
  const [occurrences, setOccurrences] = React.useState<ShareableBookingOccurrence[]>([])
  const [selectedMonth, setSelectedMonth] = React.useState<string | "all">(() => getCurrentBookingMonthKey())
  const [selectedClassType, setSelectedClassType] = React.useState<BookingClassTypeFilter>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [navigatingId, setNavigatingId] = React.useState<string | null>(null)
  const [pendingOccurrence, setPendingOccurrence] = React.useState<ShareableBookingOccurrence | null>(null)
  const [promoOpen, setPromoOpen] = React.useState(false)
  const pendingOccurrenceRef = React.useRef<ShareableBookingOccurrence | null>(null)
  const navigationStartedRef = React.useRef(false)
  const [requestVersion, setRequestVersion] = React.useState(0)
  const navigatingOccurrence = occurrences.find((occurrence) => occurrence.id === navigatingId)

  React.useEffect(() => {
    delete document.documentElement.dataset.qrBooking
    delete document.documentElement.dataset.qrBookingReady
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    setStatus("loading")

    void fetch("/api/catalog/courses", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as CatalogCoursesResponse | null
        if (!response.ok || !Array.isArray(data?.courses)) throw new Error("Invalid catalog response")
        const nextOccurrences = buildShareableBookingOccurrences(data.courses)
        if (!focusCourseSlug || typeof focusWeekday !== "number") return nextOccurrences
        return focusBookingOccurrences(nextOccurrences, { courseSlug: focusCourseSlug, weekday: focusWeekday })
      })
      .then((nextOccurrences) => {
        setOccurrences(nextOccurrences)
        setStatus(nextOccurrences.length > 0 ? "ready" : "empty")
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setOccurrences([])
        setStatus("error")
      })

    return () => controller.abort()
  }, [focusCourseSlug, focusWeekday, requestVersion])

  React.useEffect(() => {
    pendingOccurrenceRef.current = pendingOccurrence
  }, [pendingOccurrence])

  React.useEffect(() => {
    if (!isHeritageCampaignAcquiringNow()) return

    const timer = window.setTimeout(() => {
      if (!pendingOccurrenceRef.current && !navigationStartedRef.current) setPromoOpen(true)
    }, 5_000)
    return () => window.clearTimeout(timer)
  }, [])

  const closePromo = React.useCallback(() => setPromoOpen(false), [])

  const navigateToOccurrence = React.useCallback((occurrence: ShareableBookingOccurrence, countryCode?: string) => {
    if (navigationStartedRef.current) return
    navigationStartedRef.current = true
    setPendingOccurrence(null)
    setNavigatingId(occurrence.id)
    document.documentElement.dataset.qrBooking = "true"
    delete document.documentElement.dataset.qrBookingReady
    if (!countryCode) {
      router.push(occurrence.bookingUrl)
      return
    }
    const separator = occurrence.bookingUrl.includes("?") ? "&" : "?"
    router.push(`${occurrence.bookingUrl}${separator}bookingSource=public_booking&heritagePinCountryCode=${encodeURIComponent(countryCode)}`)
  }, [router])

  const selectOccurrence = (occurrence: ShareableBookingOccurrence) => {
    setPromoOpen(false)
    if (isHeritageCampaignAcquiringNow()) {
      setPendingOccurrence(occurrence)
      return
    }
    navigateToOccurrence(occurrence)
  }

  const closeCountryDialog = React.useCallback(() => setPendingOccurrence(null), [])

  return (
    <main className="min-h-screen bg-[#09070d] px-4 py-8 font-bricolage sm:px-6 sm:py-12 lg:py-16">
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(182,22,22,0.16),transparent_58%)]" />
      <section className="relative z-10 mx-auto w-full max-w-3xl">
        <BookingBrandHeader focused={Boolean(focus)} />
        <BookingPageContent
          status={status}
          occurrences={occurrences}
          selectedMonth={selectedMonth}
          selectedClassType={selectedClassType}
          searchQuery={searchQuery}
          onMonthChange={setSelectedMonth}
          onClassTypeChange={setSelectedClassType}
          onSearchQueryChange={setSearchQuery}
          navigatingId={navigatingId}
          onSelect={selectOccurrence}
          onRetry={() => setRequestVersion((version) => version + 1)}
          focused={Boolean(focus)}
        />
      </section>
      {navigatingOccurrence ? (
        <div className="fixed inset-0 z-[14000] flex items-center justify-center bg-[#09070d] px-6 text-center text-white" aria-live="polite">
          <div className="flex flex-col items-center gap-3">
            <Image src="/logo/logo-white.png" alt="Palladium Latin Art" width={160} height={64} priority className="h-auto w-36" />
            <p className="mt-2 rounded-full bg-[#b61616] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em]">
              Heritage pin booking
            </p>
            <p className="max-w-sm text-lg font-black">{navigatingOccurrence.title}</p>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-[#d51f2b] motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-sm text-white/60">Loading your booking…</p>
          </div>
        </div>
      ) : null}
      {promoOpen ? <HeritageCampaignPromoDialog onClose={closePromo} /> : null}
      {pendingOccurrence ? (
        <HeritageCountryDialog
          occurrence={pendingOccurrence}
          onCancel={closeCountryDialog}
          onConfirm={(countryCode) => navigateToOccurrence(pendingOccurrence, countryCode)}
        />
      ) : null}
    </main>
  )
}
