"use client"
import React from "react"
import { useRouter } from "next/navigation"

// Floating Assistant Widget
// - Small panel fixed at the bottom corner with an autoplaying muted video
// - Close button minimizes to a bubble
// - Bubble reopens the panel
// - Remembers minimized state per session (sessionStorage)
// - Accessible: aria labels, ESC to minimize, focus management
//
// Props kept minimal for now; can be expanded if you want to customize from layout
export type AssistantLink = { label: string; href: string }
export default function AssistantWidget({
  videoSrc = "/videos/assistant.mp4",
  poster = "/images/assistant-poster.jpg",
  title = "¡Hola! Soy tu asistente. ¿Cómo te ayudo?",
  ctaLabel = "Iniciar chat",
  startHref = "/chat",
  links = [] as AssistantLink[],
  initialMinimized = false,
  bubbleLabel = "Abrir asistente",
  position = "left" as "left" | "right",
}: {
  videoSrc?: string
  poster?: string
  title?: string
  ctaLabel?: string
  startHref?: string
  links?: AssistantLink[]
  initialMinimized?: boolean
  bubbleLabel?: string
  position?: "left" | "right"
}) {
  const router = useRouter()
  const [minimized, setMinimized] = React.useState(initialMinimized)
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const bubbleRef = React.useRef<HTMLButtonElement | null>(null)

  // Restore state from sessionStorage and migrate any old keys
  React.useEffect(() => {
    try {
      const stored = sessionStorage.getItem("assistant:minimized")
      if (stored !== null) setMinimized(stored === "1")
    } catch {}
  }, [])

  React.useEffect(() => {
    try {
      sessionStorage.setItem("assistant:minimized", minimized ? "1" : "0")
    } catch {}
  }, [minimized])

  // External open trigger (e.g., ChatLauncher)
  React.useEffect(() => {
    const open = () => setMinimized(false)
    window.addEventListener("assistant:open", open as EventListener)
    return () => window.removeEventListener("assistant:open", open as EventListener)
  }, [])

  // ESC to minimize
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !minimized) {
        setMinimized(true)
        bubbleRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [minimized])

  const sidePos = position === "right" ? "right-4" : "left-4"

  if (minimized) {
    return (
      <button
        ref={bubbleRef}
        aria-label={bubbleLabel}
        onClick={() => {
          setMinimized(false)
          // Move focus to panel after opening
          setTimeout(() => panelRef.current?.focus(), 0)
        }}
        className={`fixed bottom-4 ${sidePos} z-[9999] h-14 w-14 rounded-full bg-[var(--brand,#111)] text-white shadow-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/60`}
      >
        {/* Chat bubble icon */}
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
          <path d="M2 12c0-4.97 4.48-9 10-9s10 4.03 10 9-4.48 9-10 9c-1.06 0-2.08-.14-3.04-.41L4 21l.86-3.45A8.59 8.59 0 0 1 2 12z"/>
        </svg>
      </button>
    )
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Asistente flotante"
      tabIndex={-1}
      className={`fixed bottom-4 ${sidePos} z-[9999] w-[320px] sm:w-[360px] rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 backdrop-blur shadow-[0_10px_30px_-10px_rgba(0,0,0,.45)] overflow-hidden`}
    >
      <div className="relative">
        {/* Video header */}
        <video
          className="block w-full h-[160px] object-cover pointer-events-none"
          src={videoSrc}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          aria-label="Saludo del asistente"
        />
        {/* Close (minimize) button */}
        <button
          type="button"
          aria-label="Minimizar asistente"
          onClick={() => {
            setMinimized(true)
            bubbleRef.current?.focus()
          }}
          className="absolute right-2 top-2 z-10 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z"/></svg>
        </button>
      </div>

      <div className="p-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => (startHref ? router.push(startHref) : null)}
            className="flex-1 rounded-md bg-[var(--brand,#111)] text-white px-4 py-2"
          >
            {ctaLabel}
          </button>
          {links?.length > 0 && (
            <div className="flex items-center gap-2">
              {links.slice(0, 2).map((l) => (
                <a key={l.href} href={l.href} target="_blank" className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm">
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
