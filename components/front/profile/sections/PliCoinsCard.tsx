import GlassyCard from "@/components/front/courses/GlassyCard"

type PliCoinsCardProps = {
  pointsToNextFreeClass: number
  freeClassThreshold: number
  progress: number
  currentCoins: number
  freeClassesAvailable: number
}

export function PliCoinsCard({
  pointsToNextFreeClass,
  freeClassThreshold,
  progress,
  currentCoins,
  freeClassesAvailable,
}: PliCoinsCardProps) {
  return (
    <GlassyCard className="order-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">PLI Coins</p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-white/70">
            You are <strong>{pointsToNextFreeClass}</strong> points away from a free class.
          </p>
        </div>
        <div className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
          Goal: {freeClassThreshold} PLI Coins
        </div>
      </div>
      <div className="relative mt-4 h-28 overflow-hidden rounded-2xl border border-white/10">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/carousel/_DSC1087.JPG" alt="Free class" className="h-full w-full object-cover grayscale" />
        </div>
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${progress}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/carousel/_DSC1087.JPG" alt="Free class progress" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-3 left-3 text-sm font-semibold text-white">
          {currentCoins} / {freeClassThreshold} PLI Coins
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-600 dark:text-white/60">
        Available free classes: <strong>{freeClassesAvailable}</strong>
      </p>
    </GlassyCard>
  )
}
