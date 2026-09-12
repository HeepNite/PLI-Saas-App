"use client"

/**
 * PR4b2 seam — the fullscreen draw video overlay (design.md D6:
 * `<video preload="auto" playsInline muted>`, mounted hidden and unhidden
 * only during the draw). This slice renders nothing: the `drawing` phase
 * has no video yet, so the reveal fires as soon as `RaffleScreen`'s
 * injectable `isRevealReady` signal allows it (default: immediately).
 * PR4b2 replaces this component's body and wires its `onEnded` handler to
 * that same signal — it does not need to touch the state machine.
 */
export function RaffleDrawVideoOverlay() {
  return null
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
