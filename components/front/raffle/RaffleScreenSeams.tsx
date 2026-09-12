"use client"

import { useEffect, useRef, useState } from "react"

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

const QR_IMAGE_SIZE_PX = 160

/**
 * Same `api.qrserver.com` image-endpoint pattern as
 * `StaffTerminalShell.tsx`'s `buildCheckInQrImageUrl` (not imported/
 * modified — that helper is kiosk check-in specific).
 */
function buildRaffleQrImageUrl(entryUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${QR_IMAGE_SIZE_PX}x${QR_IMAGE_SIZE_PX}&format=png&data=${encodeURIComponent(entryUrl)}`
}

/**
 * The public-URL QR code (design.md's QR Code Rendering requirement).
 * Primary render is the `api.qrserver.com` image endpoint; on its `onError`
 * it falls back to a locally generated QR drawn onto a `<canvas>` with the
 * `qrcode` package, imported lazily so that dependency is only loaded once
 * the remote image has actually failed. The URL is always shown as text
 * underneath so a phone can still reach it even if both render paths fail.
 */
export function RaffleQrPanel({ entryUrl }: { entryUrl: string | null }) {
  const [remoteFailed, setRemoteFailed] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    setRemoteFailed(false)
  }, [entryUrl])

  useEffect(() => {
    if (!remoteFailed || !entryUrl || !canvasRef.current) return
    const canvas = canvasRef.current
    let cancelled = false
    import("qrcode").then((QRCode) => {
      if (cancelled) return
      QRCode.toCanvas(canvas, entryUrl, { width: QR_IMAGE_SIZE_PX, margin: 1 }).catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [remoteFailed, entryUrl])

  if (!entryUrl) {
    return (
      <div
        data-testid="raffle-qr-placeholder"
        aria-hidden="true"
        className="flex h-40 w-40 items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-white/40"
      >
        QR
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {remoteFailed ? (
        <canvas
          ref={canvasRef}
          width={QR_IMAGE_SIZE_PX}
          height={QR_IMAGE_SIZE_PX}
          data-testid="raffle-qr-canvas"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={buildRaffleQrImageUrl(entryUrl)}
          alt="Scan to enter the raffle"
          width={QR_IMAGE_SIZE_PX}
          height={QR_IMAGE_SIZE_PX}
          onError={() => setRemoteFailed(true)}
          data-testid="raffle-qr-image"
        />
      )}
      <p className="max-w-[12rem] break-all text-xs text-white/50">{entryUrl}</p>
    </div>
  )
}
