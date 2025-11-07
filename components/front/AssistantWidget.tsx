"use client"

import React from "react"
import Link from "next/link"

// Floating video assistant inspired by the screenshot provided.
// Update: when the user "closes" it, it now minimizes into a bubble instead of disappearing.
// - Fixed to bottom-left
// - Panel view: video + title + quick links + CTA
// - Bubble view: circular button to reopen the panel
// - State is remembered per session (sessionStorage)

export type AssistantLink = {
  label: string
  href: string
  icon?: React.ReactNode
}

type AssistantWidgetProps = {
  videoSrc: string
  poster?: string
  title?: string
  ctaLabel?: string
  onStartChat?: () => void
  startHref?: string // fallback when no onStartChat provided
  links?: AssistantLink[] // e.g., WhatsApp/Email/Calendly
  initialOpen?: boolean
  initialMinimized?: boolean // if true, start as bubble
  bubbleLabel?: string
  className?: string
}

export default function AssistantWidget({
  videoSrc,
  poster,
  title = "¿Hablamos?",
  ctaLabel = "Iniciar chat",
  onStartChat,
  startHref = "/chat",
  links = [],
  initialOpen = true,
  initialMinimized = false,
  bubbleLabel = "Abrir asistente",
  className = "",
}: AssistantWidgetProps) {
  // We maintain two pieces of UI state:
  // - visible: whether the widget exists this session (kept for future extensibility)
  // - minimized: whether it's in bubble mode
  const [visible, setVisible] = React.useState(initialOpen)
  const [minimized, setMinimized] = React.useState(initialMinimized)
  const bubbleRef = React.useRef<HTMLButtonElement | null>(null)
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  // Initialize from sessionStorage
  React.useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem("assistant:dismissed")
      // If older version stored dismissed=1, treat it as minimized now
      if (dismissed === "1") {
        setVisible(true)
        setMinimized(true)
        // migrate to new key
        sessionStorage.removeItem("assistant:dismissed")
        sessionStorage.setItem("assistant:minimized", "1")
        return
      }
      const savedMin = sessionStorage.getItem("assistant:minimized")
      if (savedMin === "1") {
        setVisible(true)
        setMinimized(true)
      }
    } catch {}
  }, [])

  // Keyboard: ESC minimizes when panel is open
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible && !minimized) {
        e.stopPropagation()
        minimize()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [visible, minimized])

  const minimize = () => {
    try {
      sessionStorage.setItem("assistant:minimized", "1")
    } catch {}
    setMinimized(true)
    // Move focus to bubble for accessibility after animation tick
    setTimeout(() => bubbleRef.current?.focus(), 0)
  }

  const expand = () => {
    try {
      sessionStorage.removeItem("assistant:minimized")
    } catch {}
    setMinimized(false)
    setTimeout(() => panelRef.current?.focus(), 0)
  }

  if (!visible) return null

  return (
    <div
      aria-live="polite"
      className={[
        "fixed left-4 bottom-4 z-[9999]",
        "drop-shadow-2xl",
        className,
      ].join(" ")}
    >
      {minimized ? (
        // Bubble button (minimized state)
        <button
          type="button"
          ref={bubbleRef}
          onClick={expand}
          aria-label={bubbleLabel}
          className="relative inline-flex items-center justify-center h-14 w-14 rounded-full bg-[var(--brand,#111)] text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 hover:opacity-95"
        >
          {/* Chat icon */}
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
            <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" />
          </svg>
          {/* subtle ping */}
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand,#111)] opacity-10" />
        </button>
      ) : (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Asistente con opciones de contacto"
          className="relative w-[280px] sm:w-[320px] rounded-2xl overflow-hidden bg-white/90 backdrop-blur border border-black/10"
        >
          {/* Close->minimize button */}
          <button
            type="button"
            aria-label="Minimizar"
            onClick={minimize}
            className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z" />
            </svg>
          </button>

          {/* Video area */}
          <div className="bg-black">
            <video
              aria-label="Asistente en video saludando"
              className="h-[220px] sm:h-[240px] w-full object-cover pointer-events-none"
              src={videoSrc}
              poster={poster}
              playsInline
              autoPlay
              muted
              loop
            />
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4">
            <p className="text-sm font-medium text-neutral-900">
              {title}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {links?.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  {l.icon}
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="mt-4">
              {onStartChat ? (
                <button
                  onClick={onStartChat}
                  className="w-full rounded-full bg-[var(--brand,#111)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
                >
                  {ctaLabel}
                </button>
              ) : (
                <Link
                  href={startHref}
                  className="block w-full rounded-full bg-[var(--brand,#111)] px-4 py-2.5 text-center text-sm font-semibold text-white hover:opacity-95"
                >
                  {ctaLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
