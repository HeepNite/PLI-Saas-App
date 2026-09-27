"use client"

import React from "react"
import { useRouter } from "next/navigation"
import type { CourseData } from "@/constants/courses"
import {
  buildShareableBookingOccurrences,
  type ShareableBookingOccurrence,
} from "@/lib/checkin/shareable-booking"

export type BookingPageStatus = "loading" | "ready" | "empty" | "error"

type BookingPageContentProps = {
  status: BookingPageStatus
  occurrences: ShareableBookingOccurrence[]
  navigatingId: string | null
  onSelect: (occurrence: ShareableBookingOccurrence) => void
  onRetry?: () => void
}

type CatalogCoursesResponse = {
  courses?: CourseData[]
}

const formatTime = (time: string) => {
  const [hour, minute] = time.split(":").map(Number)
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    .format(new Date(2020, 0, 1, hour, minute))
}

const StateCard = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
    {children}
  </div>
)

export function BookingPageContent({
  status,
  occurrences,
  navigatingId,
  onSelect,
  onRetry,
}: BookingPageContentProps) {
  if (status === "loading") {
    return (
      <StateCard>
        <p className="text-base font-semibold text-neutral-800">Loading upcoming classes…</p>
      </StateCard>
    )
  }

  if (status === "error") {
    return (
      <StateCard>
        <p className="text-xl font-bold text-neutral-900">We couldn’t load upcoming classes</p>
        <p className="mt-2 text-sm text-neutral-600">Please check your connection and try again.</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-6 rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white">
            Try again
          </button>
        ) : null}
      </StateCard>
    )
  }

  if (status === "empty") {
    return (
      <StateCard>
        <p className="text-xl font-bold text-neutral-900">No upcoming classes are available</p>
        <p className="mt-2 text-sm text-neutral-600">Please check back when the next schedule is published.</p>
      </StateCard>
    )
  }

  return (
    <section aria-live="polite" className="space-y-3">
      {occurrences.map((occurrence) => {
        const isNavigating = navigatingId === occurrence.id
        return (
          <article key={occurrence.id} className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-neutral-900">{occurrence.title}</p>
              <p className="mt-1 text-sm text-neutral-600">
                {occurrence.date} · {formatTime(occurrence.time)}
                {occurrence.durationMinutes ? ` · ${occurrence.durationMinutes} min` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={navigatingId !== null}
              onClick={() => onSelect(occurrence)}
              className="rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {isNavigating ? "Opening…" : "Book"}
            </button>
          </article>
        )
      })}
    </section>
  )
}

export default function ShareableBookingPage() {
  const router = useRouter()
  const [status, setStatus] = React.useState<BookingPageStatus>("loading")
  const [occurrences, setOccurrences] = React.useState<ShareableBookingOccurrence[]>([])
  const [navigatingId, setNavigatingId] = React.useState<string | null>(null)
  const navigationStartedRef = React.useRef(false)
  const [requestVersion, setRequestVersion] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()
    setStatus("loading")

    void fetch("/api/catalog/courses", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as CatalogCoursesResponse | null
        if (!response.ok || !Array.isArray(data?.courses)) throw new Error("Invalid catalog response")
        return buildShareableBookingOccurrences(data.courses)
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
  }, [requestVersion])

  const selectOccurrence = (occurrence: ShareableBookingOccurrence) => {
    if (navigationStartedRef.current) return
    navigationStartedRef.current = true
    setNavigatingId(occurrence.id)
    router.push(occurrence.bookingUrl)
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <section className="mx-auto w-full max-w-3xl">
        <header className="mb-8">
          <h1 className="text-4xl font-black text-neutral-950">Upcoming classes</h1>
          <p className="mt-2 text-neutral-600">Choose a class to continue with registration and booking.</p>
        </header>
        <BookingPageContent
          status={status}
          occurrences={occurrences}
          navigatingId={navigatingId}
          onSelect={selectOccurrence}
          onRetry={() => setRequestVersion((version) => version + 1)}
        />
      </section>
    </main>
  )
}
