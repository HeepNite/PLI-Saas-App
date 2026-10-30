import type { ReactNode } from "react"

export default function RaffleBackdrop({ children, className, backgroundVideoUrl }: {
  children: ReactNode
  className: string
  backgroundVideoUrl?: string
}) {
  return (
    <div
      data-testid="raffle-backdrop"
      className={`bg-black bg-cover bg-center ${className}${backgroundVideoUrl ? " relative isolate" : ""}`}
      style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url("/raffle/event-background.webp")' }}
    >
      {backgroundVideoUrl ? (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <video
            data-testid="raffle-background-video"
            src={backgroundVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
            className="h-full w-full object-fill"
          />
        </div>
      ) : null}
      <div className="w-full max-w-[16rem] shrink-0 rounded-xl bg-white p-3 shadow-lg sm:max-w-[18rem]">
        {/* Already optimized locally; keep the supplied logo's colors and aspect ratio. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/raffle/event-logo.webp" alt="Palladium Latin Events" width={960} height={415}
          className="h-auto w-full object-contain" />
      </div>
      {children}
    </div>
  )
}
