"use client"

import React from "react"
import Link from "next/link"
import {ArrowRight, Clock, X} from "lucide-react"
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
}

const DEFAULT_DURATION_MS = 12 * 60 * 60 * 1000 // 12 hours

export default function NotificationBar({
  message,
  ctaHref = "/courses/salsa-nocturno?enroll=1",
  ctaLabel,
  durationMs = DEFAULT_DURATION_MS,
}: NotificationBarProps) {
  const { t } = useI18n()
  const [visible, setVisible] = React.useState(true)
  const [closing, setClosing] = React.useState(false)
  const [remaining, setRemaining] = React.useState(durationMs)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const startedAtRef = React.useRef<number>(Date.now())
  const finalMessage = message ?? t("notif_announcement")
  const finalCtaLabel = ctaLabel ?? t("notif_cta")

  // Format remaining time as HH:MM:SS
  const format = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }

  // Countdown logic (resets on reload by design)
  React.useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startedAtRef.current
      setRemaining(() => {
          return Math.max(0, durationMs - elapsed)
      })
    }
    const id = window.setInterval(tick, 1000)
    tick()
    return () => window.clearInterval(id)
  }, [durationMs])

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
      onTransitionEnd={() => {
        if (closing) {
          setVisible(false)
          // Reset the header offset var after animation completes
          document.documentElement.style.setProperty("--notif-offset", "0px")
        }
      }}
      className={`sticky top-0 z-60 w-full flex items-center border-b-2 border-destructive dark:border-destructive bg-neutral-900/100 backdrop-blur-xl transition-all duration-300 ease-out ${closing ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100 translate-y-0"}`}
    >
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-6 sm:px-8 lg:px-10">
        <div className="flex items-start sm:items-center justify-between gap-3 py-3 text-sm">
          <div className="flex-1 text-card dark:text-white">
            <div className="flex flex-wrap items-center gap-3">
              <span>{finalMessage}</span>
              <span className="inline-flex items-center justify-between gap-3 rounded-md border border-primary bg-background/2 px-3 py-1.5 text-xs">
                <Clock className="h-4.5 w-4.5 text-primary " />
                <span aria-live="polite" aria-atomic>{format(remaining)}</span>
              </span>
              <Link
                href={ctaHref}
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
