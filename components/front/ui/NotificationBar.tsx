"use client"

import React from "react"
import Link from "next/link"
import { ArrowRight, Clock, X } from "lucide-react"
import { useI18n } from "@/lib/i18n"

// Dismissible, sticky notification bar shown above the Header.
// Refactor: always shows on reload (no persistence), includes a live countdown,
// and pushes the Header down to avoid overlap using a CSS variable.

type NotificationBarProps = {
  message?: React.ReactNode
  ctaHref?: string
  ctaLabel?: string
  /** Optional duration for the countdown in milliseconds (default 12h). */
  durationMs?: number
  /** Fixed deadline for an absolute countdown. */
  deadlineMs?: number
  /** Server-rendered clock anchor used to keep hydration deterministic. */
  initialNowMs?: number
  /** Remove the entire announcement when its fixed deadline is reached. */
  hideOnExpiry?: boolean
  /** Use readable day/hour/minute text instead of the generic digital timer. */
  countdownFormat?: "digital" | "human"
  onCtaClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
}

const DEFAULT_DURATION_MS = 12 * 60 * 60 * 1000 // 12 hours
const MINUTE_MS = 60 * 1000

const pluralize = (value: number, unit: "day" | "hour") =>
  `${value} ${unit}${value === 1 ? "" : "s"}`

export const formatHumanRemainingTime = (remainingMs: number) => {
  if (remainingMs < MINUTE_MS) return "Less than 1 min"

  const totalMinutes = Math.floor(remainingMs / MINUTE_MS)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  return [
    days > 0 ? pluralize(days, "day") : null,
    hours > 0 ? pluralize(hours, "hour") : null,
    minutes > 0 ? `${minutes} min` : null,
  ].filter(Boolean).join(" ")
}

const getNextHumanUpdateDelay = (remainingMs: number) => {
  if (remainingMs <= 0) return null
  if (remainingMs < MINUTE_MS) return remainingMs

  const partialMinuteMs = remainingMs % MINUTE_MS
  return partialMinuteMs === 0 ? 1 : partialMinuteMs + 1
}

export default function NotificationBar({
  message,
  ctaHref = "/courses/salsa-nocturno?enroll=1",
  ctaLabel,
  durationMs = DEFAULT_DURATION_MS,
  deadlineMs,
  initialNowMs,
  hideOnExpiry = false,
  countdownFormat = "digital",
  onCtaClick,
}: NotificationBarProps) {
  const { t } = useI18n()
  const initialRemaining = deadlineMs === undefined
    ? durationMs
    : Math.max(0, deadlineMs - (initialNowMs ?? Date.now()))
  const [visible, setVisible] = React.useState(initialRemaining > 0 || !hideOnExpiry)
  const [closing, setClosing] = React.useState(false)
  const [remaining, setRemaining] = React.useState(initialRemaining)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const startedAtRef = React.useRef(Date.now())
  const finalMessage = message ?? t("notif_announcement")
  const finalCtaLabel = ctaLabel ?? t("notif_cta")
  const usesHumanCountdown = countdownFormat === "human"

  // Format remaining time as HH:MM:SS
  const format = (ms: number) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }

  // The generic countdown retains its one-second cadence; fixed human countdowns
  // wake only when their visible minute label can change.
  React.useEffect(() => {
    startedAtRef.current = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startedAtRef.current
      const nextRemaining = deadlineMs === undefined
        ? Math.max(0, durationMs - elapsed)
        : Math.max(0, deadlineMs - Date.now())
      setRemaining(nextRemaining)
      if (hideOnExpiry && nextRemaining === 0) setVisible(false)
      return nextRemaining
    }

    if (usesHumanCountdown) {
      let timeoutId: number | null = null
      const scheduleTick = () => {
        const nextRemaining = tick()
        const nextDelay = getNextHumanUpdateDelay(nextRemaining)
        if (nextDelay !== null) timeoutId = window.setTimeout(scheduleTick, nextDelay)
      }
      scheduleTick()
      return () => {
        if (timeoutId !== null) window.clearTimeout(timeoutId)
      }
    }

    const id = window.setInterval(tick, 1000)
    const expiryDelay = deadlineMs === undefined ? null : deadlineMs - Date.now()
    const expiryId = hideOnExpiry && expiryDelay !== null && expiryDelay > 0
      ? window.setTimeout(tick, expiryDelay)
      : null
    tick()
    return () => {
      window.clearInterval(id)
      if (expiryId !== null) window.clearTimeout(expiryId)
    }
  }, [countdownFormat, deadlineMs, durationMs, hideOnExpiry, initialNowMs, usesHumanCountdown])

  // Manage header offset to avoid overlap (set CSS variable with bar height)
  const updateOffsetVar = React.useCallback(() => {
    const h = visible && containerRef.current ? containerRef.current.offsetHeight : 0
    document.documentElement.style.setProperty("--notif-offset", `${h}px`)
  }, [visible])

  React.useEffect(() => {
    updateOffsetVar()
    const onResize = () => updateOffsetVar()
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      // cleanup on unmount
      document.documentElement.style.setProperty("--notif-offset", "0px")
    }
  }, [updateOffsetVar])

  const onClose = () => {
    // Begin smooth exit; keep mounted for animation
    setClosing(true)
  }

  if (!visible) return null

  return (
    <div
      ref={containerRef}
      data-promotion-banner={usesHumanCountdown ? "" : undefined}
      onTransitionEnd={() => {
        if (closing) {
          setVisible(false)
          // Reset the header offset var after animation completes
          document.documentElement.style.setProperty("--notif-offset", "0px")
        }
      }}
      className={`sticky top-0 z-60 w-full flex items-center border-b-2 border-destructive dark:border-destructive bg-neutral-900/100 backdrop-blur-xl transition-all duration-300 ease-out ${closing ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100 translate-y-0"}`}
    >
      <div className={`mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] ${usesHumanCountdown ? "px-4 sm:px-8 lg:px-10" : "px-6 sm:px-8 lg:px-10"}`}>
        <div className={`flex items-start sm:items-center justify-between text-sm ${usesHumanCountdown ? "gap-2 py-2.5" : "gap-3 py-3"}`}>
          <div className="flex-1 text-card dark:text-white">
            <div className={`flex flex-wrap items-center ${usesHumanCountdown ? "gap-x-2 gap-y-1.5" : "gap-3"}`}>
              <span className={usesHumanCountdown ? "font-medium leading-snug" : undefined}>{finalMessage}</span>
              <span className={usesHumanCountdown
                ? "inline-flex shrink-0 items-center rounded-full border border-primary/60 bg-primary/10 px-2.5 py-1 text-xs font-semibold leading-none text-primary"
                : "inline-flex items-center justify-between gap-3 rounded-md border border-primary bg-background/2 px-3 py-1.5 text-xs"
              }>
                {!usesHumanCountdown && <Clock data-countdown-icon className="h-4.5 w-4.5 text-primary " />}
                <span
                  data-promotion-time={usesHumanCountdown ? "" : undefined}
                  aria-live="polite"
                  aria-atomic
                >
                  {usesHumanCountdown ? formatHumanRemainingTime(remaining) : format(remaining)}
                </span>
              </span>
              <Link
                href={ctaHref}
                onClick={onCtaClick}
                data-reservation-opener={onCtaClick ? "banner" : undefined}
                className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/30 transition-colors"
              >
                {finalCtaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <button
            type="button"
            aria-label={t("notif_close")}
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-primary bg-background/2 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <X className="h-4 w-4 text-primary" />
          </button>
        </div>
      </div>
    </div>
  )
}
