"use client"

import { useEffect, useRef } from "react"

export type RaffleDrawVideoOverlayProps = {
  /** The event's own draw video if set, otherwise the shared placeholder — see `lib/raffle/screen-state.ts`. */
  videoUrl: string
  /** True only while a draw is in progress. Toggles visibility via `hidden`, never mount/unmount. */
  active: boolean
  /** Fired once playback truly finishes, or immediately if it never could start. */
  onEnded: () => void
}

/**
 * Fullscreen draw video overlay (design.md D6:
 * `<video preload="auto" playsInline muted>`). Mounted from the very first
 * render — not only while `active` — so the browser has the whole draw
 * slice to buffer the file before it is first needed; visibility toggles
 * via the `hidden` attribute instead of mount/unmount so playback can start
 * the instant a draw begins. `play()` is only called on the transition into
 * `active`. A `play()` that rejects (autoplay blocked, unsupported source,
 * …) — or, in an environment whose `HTMLMediaElement.play()` does not even
 * return a promise, such as jsdom's unimplemented stub — is treated as an
 * immediate `ended`, so a failed/unsupported video never blocks the reveal.
 */
export function RaffleDrawVideoOverlay({ videoUrl, active, onEnded }: RaffleDrawVideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!active) {
      startedRef.current = false
      return
    }
    if (startedRef.current) return
    startedRef.current = true

    const video = videoRef.current
    if (!video) {
      onEnded()
      return
    }

    video.currentTime = 0
    try {
      const playResult = video.play()
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(() => onEnded())
      } else {
        // A spec-compliant browser always returns a promise from play();
        // a non-promise return means this environment cannot actually
        // play the video, so treat it as finished right away.
        onEnded()
      }
    } catch {
      onEnded()
    }
  }, [active, onEnded])

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      preload="auto"
      playsInline
      muted
      hidden={!active}
      onEnded={onEnded}
      className="fixed inset-0 z-40 h-full w-full bg-black object-contain"
      data-testid="raffle-draw-video"
    />
  )
}

/**
 * PR4b2 seam — the public-URL QR code (design.md's QR Code Rendering
 * requirement: `api.qrserver.com` `<img>` with an `onError` fallback to a
 * local `qrcode` canvas render). This slice renders a placeholder region
 * only, sized like the real QR will be, so the surrounding layout does not
 * shift once PR4b2 fills it in.
 */
export function RaffleQrPanel({ entryUrl }: { entryUrl: string | null }) {
  return (
    <div
      data-testid="raffle-qr-placeholder"
      data-entry-url={entryUrl ?? undefined}
      aria-hidden="true"
      className="flex h-40 w-40 items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-white/40"
    >
      QR
    </div>
  )
}
