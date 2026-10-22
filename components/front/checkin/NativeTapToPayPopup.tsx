"use client"
import React from "react"
import { useNativeCollectionPrompt } from "@/components/front/courses/enroll/hooks/useNativeReader"

/** Owner-supplied clip; the CSS animation below stands in until it exists or if it fails to load. */
const TAP_VIDEO_SRC = "/kiosk/tap-to-pay.mp4"

/**
 * Shown exactly while the native M2 reader waits for a card, then while the read card processes.
 * The existing payment success/error UI takes over once the native sale publishes its result.
 */
export function NativeTapToPayPopup() {
  const prompt = useNativeCollectionPrompt()
  const [videoFailed, setVideoFailed] = React.useState(false)
  if (prompt === "none") return null
  const awaitingCard = prompt === "awaiting_card"

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Card payment"
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] p-6 text-center text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)]">
        <div className="mx-auto flex h-48 w-full items-center justify-center overflow-hidden rounded-2xl bg-white/5">
          {awaitingCard && !videoFailed ? (
            <video
              className="h-full w-full object-contain"
              src={TAP_VIDEO_SRC}
              autoPlay
              loop
              muted
              playsInline
              aria-hidden
              onError={() => setVideoFailed(true)}
            />
          ) : awaitingCard ? (
            <TapFallback />
          ) : (
            <svg className="h-12 w-12 animate-spin text-white/60" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        <div aria-live="assertive" className="mt-5">
          <p className="text-2xl font-semibold">{awaitingCard ? "Tap your card on the reader" : "Processing…"}</p>
          <p className="mt-2 text-sm text-white/60">
            {awaitingCard ? "Hold your card or phone near the card reader." : "Please keep your card nearby."}
          </p>
        </div>
      </div>
    </div>
  )
}

/** A card gliding onto a reader, drawn with CSS only. */
function TapFallback() {
  return (
    <div data-tap-fallback className="relative h-36 w-40" aria-hidden>
      <style>{`@keyframes pliTapCard{0%,15%{transform:translate(-36px,-28px) rotate(-12deg);opacity:.4}55%,80%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(-36px,-28px) rotate(-12deg);opacity:.4}}`}</style>
      <div className="absolute bottom-0 left-1/2 h-24 w-16 -translate-x-1/2 rounded-xl border border-white/25 bg-white/10">
        <div className="mx-auto mt-3 h-6 w-10 rounded-md bg-emerald-400/70" />
      </div>
      <div
        className="absolute left-1/2 top-4 -ml-10 h-12 w-20 rounded-lg bg-[var(--brand,#b61616)] shadow-lg"
        style={{ animation: "pliTapCard 2.4s ease-in-out infinite" }}
      />
    </div>
  )
}
