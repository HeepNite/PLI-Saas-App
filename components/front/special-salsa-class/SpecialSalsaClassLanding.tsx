"use client"

import React from "react"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createPortal } from "react-dom"
import { Clock3, Pause, Play, Users, Volume2, VolumeX, X } from "lucide-react"
import {
  SPECIAL_SALSA_CLASS,
  SPECIAL_SALSA_REFUND_POLICY,
  formatSpecialClassTime,
  resolveSpecialClassPricing,
} from "@/lib/special-salsa-class/config"

type FieldName = "name" | "phone" | "email"
type FieldErrors = Partial<Record<FieldName, string>>
type FieldRefs = Record<FieldName, React.RefObject<HTMLInputElement | null>>

export type BannerReservationRequest = {
  id: number
  opener: HTMLAnchorElement
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/
const validate = (values: Record<FieldName, string>): FieldErrors => {
  const errors: FieldErrors = {}
  if (values.name.trim().length < 2) errors.name = "Please enter your name."
  if (!/^\+[1-9]\d{7,14}$/.test(values.phone.replace(/[\s()-]/g, ""))) {
    errors.phone = "Please enter a valid phone number including country code."
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Please enter a valid email address."
  return errors
}

export function SpecialSalsaClassLanding({
  remaining,
  cancelledAttemptId,
  initialNowMs = SPECIAL_SALSA_CLASS.promotion.deadline.getTime(),
  initialDialogOpen = false,
  bannerReservationRequest = null,
}: {
  remaining: number | null
  cancelledAttemptId?: string
  initialNowMs?: number
  initialDialogOpen?: boolean
  bannerReservationRequest?: BannerReservationRequest | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [values, setValues] = React.useState<Record<FieldName, string>>({ name: "", phone: "", email: "" })
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [outcome, setOutcome] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [soldOut, setSoldOut] = React.useState(remaining === 0)
  const [dialogOpen, setDialogOpen] = React.useState(Boolean(cancelledAttemptId) || initialDialogOpen)
  const [nowMs, setNowMs] = React.useState(initialNowMs)
  const [portalReady, setPortalReady] = React.useState(false)
  const attemptIdRef = React.useRef(
    cancelledAttemptId && UUID_PATTERN.test(cancelledAttemptId) ? cancelledAttemptId : "",
  )
  const refs = {
    name: React.useRef<HTMLInputElement>(null),
    phone: React.useRef<HTMLInputElement>(null),
    email: React.useRef<HTMLInputElement>(null),
  }
  const outcomeRef = React.useRef<HTMLDivElement>(null)
  const soldOutRef = React.useRef<HTMLDivElement>(null)
  const reserveButtonRef = React.useRef<HTMLButtonElement>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const dialogOpenerRef = React.useRef<HTMLElement | null>(null)
  const dialogOpenerKindRef = React.useRef<"banner" | "landing">("landing")
  const handledBannerRequestRef = React.useRef(0)
  const queryIntentActiveRef = React.useRef(false)
  const shouldReturnFocusRef = React.useRef(false)
  const shouldFocusSoldOutRef = React.useRef(false)
  const [videoPlaying, setVideoPlaying] = React.useState(false)
  const [videoMuted, setVideoMuted] = React.useState(true)
  const pricing = resolveSpecialClassPricing(new Date(nowMs))

  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const syncPlaying = () => setVideoPlaying(!video.paused)
    const syncMuted = () => setVideoMuted(video.muted)
    const startPlayback = () => {
      const playback = video.play()
      if (playback) void playback.catch(() => setVideoPlaying(false))
    }
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    video.addEventListener("play", syncPlaying)
    video.addEventListener("pause", syncPlaying)
    video.addEventListener("volumechange", syncMuted)
    syncMuted()
    if (!prefersReducedMotion) {
      startPlayback()
    }
    return () => {
      video.removeEventListener("play", syncPlaying)
      video.removeEventListener("pause", syncPlaying)
      video.removeEventListener("volumechange", syncMuted)
    }
  }, [])

  React.useEffect(() => {
    const deadlineMs = SPECIAL_SALSA_CLASS.promotion.deadline.getTime()
    if (initialNowMs >= deadlineMs) return
    const syncClock = () => setNowMs(Math.min(Date.now(), deadlineMs))
    const intervalId = window.setInterval(syncClock, 1000)
    const deadlineId = window.setTimeout(syncClock, Math.max(0, deadlineMs - Date.now()))
    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(deadlineId)
    }
  }, [initialNowMs])

  React.useEffect(() => {
    setPortalReady(true)
  }, [])

  React.useEffect(() => {
    if (!bannerReservationRequest || bannerReservationRequest.id === handledBannerRequestRef.current) return
    handledBannerRequestRef.current = bannerReservationRequest.id
    dialogOpenerRef.current = bannerReservationRequest.opener
    dialogOpenerKindRef.current = "banner"
    setDialogOpen(true)
  }, [bannerReservationRequest])

  const hasReservationIntent = searchParams.get("reserve") === "1"

  React.useEffect(() => {
    if (hasReservationIntent && !queryIntentActiveRef.current) {
      queryIntentActiveRef.current = true
      const focusedElement = document.activeElement
      dialogOpenerRef.current = focusedElement instanceof HTMLElement && focusedElement !== document.body
        ? focusedElement
        : reserveButtonRef.current
      dialogOpenerKindRef.current = focusedElement instanceof HTMLElement && focusedElement.dataset.reservationOpener === "banner"
        ? "banner"
        : "landing"
      setDialogOpen(true)
      return
    }

    if (hasReservationIntent || !queryIntentActiveRef.current) return
    queryIntentActiveRef.current = false
    shouldReturnFocusRef.current = true
    setDialogOpen(false)
  }, [hasReservationIntent])

  React.useEffect(() => {
    if (!dialogOpen && shouldReturnFocusRef.current) {
      shouldReturnFocusRef.current = false
      const opener = dialogOpenerRef.current
      const openerKind = dialogOpenerKindRef.current
      dialogOpenerRef.current = null
      queueMicrotask(() => {
        if (opener?.isConnected) {
          opener.focus()
          return
        }
        if (openerKind === "banner") {
          const currentBannerOpener = document.querySelector<HTMLElement>('[data-reservation-opener="banner"]')
          if (currentBannerOpener) {
            currentBannerOpener.focus()
            return
          }
        }
        reserveButtonRef.current?.focus()
      })
    }
  }, [dialogOpen])

  React.useEffect(() => {
    if (dialogOpen && outcome) outcomeRef.current?.focus()
  }, [dialogOpen, outcome])

  React.useEffect(() => {
    if (!soldOut || !shouldFocusSoldOutRef.current) return
    shouldFocusSoldOutRef.current = false
    soldOutRef.current?.focus()
  }, [soldOut])

  const onChange = (field: FieldName) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const openReservation = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (soldOut) return
    dialogOpenerRef.current = event.currentTarget
    dialogOpenerKindRef.current = "landing"
    setDialogOpen(true)
  }

  const toggleVideoPlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) {
      video.pause()
      return
    }
    const playback = video.play()
    if (playback) void playback.catch(() => setVideoPlaying(false))
  }

  const toggleVideoSound = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setVideoMuted(video.muted)
  }

  const closeReservation = () => {
    if (submitting) return
    if (hasReservationIntent) {
      const nextSearchParams = new URLSearchParams(searchParams.toString())
      nextSearchParams.delete("reserve")
      const nextQuery = nextSearchParams.toString()
      queryIntentActiveRef.current = false
      router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false })
    }
    shouldReturnFocusRef.current = true
    setDialogOpen(false)
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || soldOut) return
    const nextErrors = validate(values)
    const firstInvalid = (["name", "phone", "email"] as FieldName[]).find((field) => nextErrors[field])
    if (firstInvalid) {
      setErrors(nextErrors)
      setOutcome("")
      queueMicrotask(() => refs[firstInvalid].current?.focus())
      return
    }

    setSubmitting(true)
    setOutcome("")
    if (!attemptIdRef.current) attemptIdRef.current = crypto.randomUUID()
    try {
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutKind: SPECIAL_SALSA_CLASS.checkoutKind,
          attemptId: attemptIdRef.current,
          ...values,
        }),
      })
      const result = await response.json().catch(() => null) as { code?: string; error?: string; url?: string } | null
      if (!response.ok || !result?.url) {
        if (result?.code === "CHECKOUT_EXPIRED") attemptIdRef.current = ""
        if (result?.code === "SOLD_OUT") {
          shouldFocusSoldOutRef.current = true
          setSoldOut(true)
        }
        setOutcome(result?.error || "Checkout could not be started. Please try again.")
        return
      }
      window.location.assign(result.url)
    } catch {
      setOutcome("Checkout could not be started. Please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full overflow-x-hidden bg-black text-[#F8FAFC]">
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12 lg:px-8 lg:py-16">
        <article
          data-special-hero
          data-hero-card="joined"
          className="grid overflow-hidden rounded-3xl border border-[#3f3f46] bg-[#09090b] shadow-[0_24px_80px_rgba(0,0,0,0.55)] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        >
          <div
            data-hero-panel
            data-hero-media
            data-hero-video
            className="relative h-[350px] min-h-0 overflow-hidden bg-black lg:h-auto lg:min-h-[540px]"
          >
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover object-center"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={SPECIAL_SALSA_CLASS.videoPosterSrc}
              aria-label={`Promotional video for ${SPECIAL_SALSA_CLASS.displayTitle}`}
            >
              <source src={SPECIAL_SALSA_CLASS.videoSrc} type="video/mp4" />
              Your browser does not support embedded video. All class details are listed below.
            </video>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5 bg-gradient-to-t from-black via-black/70 to-transparent" aria-hidden="true" />
            <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2">
              <button
                type="button"
                data-hero-video-toggle
                aria-pressed={videoPlaying}
                aria-label={videoPlaying ? "Pause promotional video" : "Play promotional video"}
                onClick={toggleVideoPlayback}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-black/75 text-white shadow-lg transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                {videoPlaying ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
              </button>
              <button
                type="button"
                data-hero-video-sound-toggle
                aria-pressed={!videoMuted}
                aria-label={videoMuted ? "Turn sound on for promotional video" : "Mute promotional video"}
                onClick={toggleVideoSound}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-black/75 text-white shadow-lg transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                {videoMuted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
            <span className="pointer-events-none absolute left-4 top-4 z-20 rounded-full bg-[#E11D48] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg">
              SPECIAL EVENT
            </span>
            <div className="pointer-events-none absolute inset-x-4 bottom-12 z-20 flex items-center gap-4 text-xs font-bold text-white sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-[#FB7185]" aria-hidden="true" />
                <span aria-hidden="true">{SPECIAL_SALSA_CLASS.durationMinutes} min</span>
                <span className="sr-only">{SPECIAL_SALSA_CLASS.durationMinutes} minutes</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#FB7185]" aria-hidden="true" />
                {SPECIAL_SALSA_CLASS.capacity} spots
              </span>
            </div>
          </div>
          <div
            data-hero-panel
            data-hero-details
            className="flex flex-col justify-center border-t border-[#3f3f46] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8 xl:p-10"
          >
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#E11D48]">SALSA CLASS</p>
            <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl xl:text-5xl">{SPECIAL_SALSA_CLASS.displayTitle}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Join a focused special salsa caleña class in Jersey City.
            </p>
            <div
              data-event-facts-row
              data-layout-row="responsive"
              className="mt-6 grid grid-cols-2 gap-2"
            >
              <div data-event-fact data-date-card className="flex h-[216px] min-w-0 flex-col overflow-hidden rounded-lg border border-white/15 bg-white/[0.04] p-2">
                <div data-date-representation className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                  <p data-date-month aria-hidden="true" className="text-[13px] font-black uppercase leading-4 tracking-[0.16em] text-[#FB7185]">AUGUST 2026</p>
                  <p data-date-day aria-hidden="true" className="mt-1 text-[84px] font-black leading-[0.82] tracking-[-0.07em] text-[#F8FAFC]">30</p>
                  <time
                    dateTime="2026-08-30T16:00:00-04:00"
                    aria-label="Sunday, August 30, 2026 at 4:00 PM"
                    data-date-supporting-line
                    className="mt-3 flex flex-col items-center justify-center gap-0.5 whitespace-nowrap text-[13px] font-black uppercase leading-4"
                  >
                    <span data-date-weekday className="tracking-[0.16em] text-[#FB7185]">SUNDAY AT</span>
                    <span data-event-time className="tracking-[0.08em] text-[#F8FAFC]">{formatSpecialClassTime(SPECIAL_SALSA_CLASS.startsAt)}</span>
                  </time>
                </div>
              </div>
              <div
                data-event-fact
                data-map-thumbnail
                className="group flex h-[216px] min-w-0 flex-col overflow-hidden rounded-lg border border-white/15 bg-[#111318] transition-colors duration-200 hover:border-white/30"
              >
                <a
                  data-map-link
                  href="https://maps.apple.com/?q=54%20Coles%20St%2C%20Jersey%20City%2C%20NJ%2007302"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open 54 Coles St, Jersey City in Apple Maps (opens in a new tab)"
                  className="flex min-h-0 flex-1 cursor-pointer flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FB7185]"
                >
                  <span data-map-image className="relative min-h-0 flex-1 overflow-hidden bg-[#dfe6e9]">
                    <Image
                      src="/images/salsa-de-cali-coles-st-map.png"
                      alt="Close color street map with one PLI location marker near 54 Coles St, Jersey City"
                      fill
                      sizes="(max-width: 1023px) 45vw, 18vw"
                      unoptimized
                      className="object-cover brightness-[0.82] transition-opacity duration-200 group-hover:opacity-95"
                    />
                  </span>
                  <address data-map-caption className="flex h-9 shrink-0 items-center justify-center whitespace-nowrap bg-[#17171b] px-1 text-center text-[13px] font-bold leading-none tracking-[-0.075em] text-white not-italic">
                    <span className="min-w-0 whitespace-nowrap">{SPECIAL_SALSA_CLASS.address}</span>
                  </address>
                </a>
                <p data-map-attribution className="flex min-h-5 shrink-0 items-center justify-center bg-[#17171b] px-1 text-center text-[8px] leading-3 text-slate-500 sm:text-[9px]">
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" aria-label="OpenStreetMap map data attribution (opens in a new tab)" className="transition-colors hover:text-slate-300 focus-visible:text-slate-200 focus-visible:outline-none focus-visible:underline">Map data © OpenStreetMap contributors</a>
                </p>
              </div>
            </div>
            <div
              data-purchase-row
              data-layout-row="responsive"
              className="mt-5 flex w-full flex-nowrap items-center justify-between gap-3"
            >
              <p data-hero-price className="shrink-0 text-4xl font-black tracking-tight text-white">
                ${pricing.amountCents / 100}
              </p>
              <button
                ref={reserveButtonRef}
                type="button"
                data-hero-cta
                aria-controls="special-reservation-dialog"
                aria-haspopup="dialog"
                aria-expanded={dialogOpen}
                disabled={soldOut}
                onClick={openReservation}
                className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#E11D48] px-3 py-2.5 text-[15px] font-extrabold text-white outline-none transition-colors duration-200 hover:bg-[#BE123C] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:bg-slate-600 sm:px-5 sm:text-base"
              >
                {soldOut ? "Sold out" : "Reserve here"}
              </button>
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-300 sm:text-sm">
              {remaining === null ? "Limited to 40 guests." : `${remaining} of 40 spots remaining.`}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-400">{SPECIAL_SALSA_REFUND_POLICY}</p>
          </div>
        </article>
      </section>
      {portalReady && dialogOpen && createPortal(
        <ReservationDialog
          remaining={remaining}
          cancelledAttemptId={cancelledAttemptId}
          values={values}
          errors={errors}
          outcome={outcome}
          submitting={submitting}
          soldOut={soldOut}
          amountCents={pricing.amountCents}
          refs={refs}
          outcomeRef={outcomeRef}
          soldOutRef={soldOutRef}
          onChange={onChange}
          onSubmit={onSubmit}
          onClose={closeReservation}
        />,
        document.body,
      )}
    </div>
  )
}

function ReservationDialog({
  remaining,
  cancelledAttemptId,
  values,
  errors,
  outcome,
  submitting,
  soldOut,
  amountCents,
  refs,
  outcomeRef,
  soldOutRef,
  onChange,
  onSubmit,
  onClose,
}: {
  remaining: number | null
  cancelledAttemptId?: string
  values: Record<FieldName, string>
  errors: FieldErrors
  outcome: string
  submitting: boolean
  soldOut: boolean
  amountCents: number
  refs: FieldRefs
  outcomeRef: React.RefObject<HTMLDivElement | null>
  soldOutRef: React.RefObject<HTMLDivElement | null>
  onChange: (field: FieldName) => (event: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onClose: () => void
}) {
  const dialogRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  React.useEffect(() => {
    queueMicrotask(() => {
      if (cancelledAttemptId) {
        outcomeRef.current?.focus()
        return
      }
      refs.name.current?.focus({ preventScroll: true })
    })
  }, [cancelledAttemptId, outcomeRef, refs.name])

  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || submitting) return
      event.preventDefault()
      onClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose, submitting])

  const containFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => !element.hasAttribute("hidden"))
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
      return
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const requestClose = () => {
    if (!submitting) onClose()
  }

  return (
    <div
      data-reservation-overlay
      className="fixed inset-0 z-[80] flex items-end justify-center overflow-hidden bg-black/80 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        ref={dialogRef}
        id="special-reservation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="special-reservation-title"
        aria-describedby="special-reservation-description"
        data-reservation-dialog
        onKeyDown={containFocus}
        className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#09090b] text-[#F8FAFC] shadow-[0_24px_90px_rgba(0,0,0,0.75)] sm:max-h-[min(760px,calc(100dvh-2rem))]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <h2 id="special-reservation-title" className="text-xl font-extrabold sm:text-2xl">Reserve your spot</h2>
            <p id="special-reservation-description" className="mt-1 text-sm leading-5 text-slate-300">
              {remaining === null ? "Limited to 40 spots. Enter your contact details to continue." : `${remaining} of 40 spots remaining. Enter your contact details to continue.`}
            </p>
          </div>
          <button
            type="button"
            data-reservation-close
            aria-label="Close reservation dialog"
            disabled={submitting}
            onClick={requestClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/15 text-slate-300 outline-none transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#FB7185] disabled:cursor-wait disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div data-reservation-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] scroll-pb-24 sm:px-6">
          {cancelledAttemptId && (
            <div ref={outcomeRef} tabIndex={-1} role="status" className="mb-5 rounded-lg border border-amber-500 bg-amber-950 p-4 text-sm font-medium text-amber-50 outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
              Payment was not completed. Your reservation is not confirmed, and you may try again.
            </div>
          )}

          {soldOut ? (
            <div ref={soldOutRef} data-sold-out tabIndex={-1} className="rounded-xl border-2 border-[var(--brand,#b61616)] p-5 outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand,#b61616)]/30" role="status">
              <h3 className="text-xl font-bold">Sold out</h3>
              <p className="mt-2">All 40 spots are currently paid or held.</p>
              <button type="button" disabled className="mt-4 min-h-11 w-full cursor-not-allowed rounded-lg bg-neutral-400 px-4 py-3 font-bold text-white">Sold out</button>
            </div>
          ) : (
            <form data-reservation-form className="space-y-4" noValidate onSubmit={onSubmit}>
              {(["name", "phone", "email"] as FieldName[]).map((field) => {
                const labels = { name: "Name", phone: "Phone", email: "Email" }
                const autoComplete = { name: "name", phone: "tel", email: "email" }
                return (
                  <div key={field}>
                    <label htmlFor={`special-${field}`} className="mb-1.5 block text-sm font-bold">{labels[field]}</label>
                    <input
                      ref={refs[field]}
                      id={`special-${field}`}
                      name={field}
                      type={field === "email" ? "email" : "text"}
                      inputMode={field === "phone" ? "tel" : undefined}
                      autoComplete={autoComplete[field]}
                      value={values[field]}
                      onChange={onChange(field)}
                      required
                      aria-required="true"
                      aria-invalid={errors[field] ? "true" : "false"}
                      aria-describedby={errors[field] ? `special-${field}-error` : undefined}
                      className="min-h-12 w-full rounded-lg border border-white/25 bg-black px-3 py-2 text-base text-[#F8FAFC] outline-none transition-colors focus:border-[#E11D48] focus:ring-2 focus:ring-[#E11D48]"
                    />
                    {errors[field] && <p id={`special-${field}-error`} className="mt-1 text-sm font-medium text-rose-300" role="alert">{errors[field]}</p>}
                  </div>
                )
              })}

              {outcome && <div ref={outcomeRef} tabIndex={-1} role="alert" className="rounded-lg border border-rose-500 bg-rose-950 p-3 text-sm font-medium text-rose-50 outline-none focus-visible:ring-2 focus-visible:ring-rose-300">{outcome}</div>}
              <button
                type="submit"
                disabled={submitting}
                className="min-h-12 w-full cursor-pointer rounded-lg bg-[#E11D48] px-4 py-3 text-base font-extrabold text-white shadow-lg outline-none transition-colors duration-200 hover:bg-[#BE123C] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-wait disabled:opacity-70"
              >
                {submitting ? "Opening secure checkout…" : `Reserve for $${amountCents / 100}`}
              </button>
            </form>
          )}

          <p className="mt-5 text-xs leading-5 text-slate-300">{SPECIAL_SALSA_REFUND_POLICY}</p>
        </div>
      </div>
    </div>
  )
}
