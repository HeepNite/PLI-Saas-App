import type { ReactNode } from "react"

export default function RaffleBackdrop({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div
      data-testid="raffle-backdrop"
      className={`bg-black bg-cover bg-center ${className}`}
      style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url("/raffle/event-background.webp")' }}
    >
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
