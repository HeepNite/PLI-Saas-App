import GlassyCard from "@/components/front/courses/GlassyCard"

type GearCardProps = {
  model: string
  usedKm: number
  maxKm: number
  shoeProgress: number
}

export function GearCard({ model, usedKm, maxKm, shoeProgress }: GearCardProps) {
  return (
    <GlassyCard className="order-9 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Gear</p>
      <div className="mt-4 flex items-center gap-4">
        <div className="h-20 w-28 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/shoes-pli.svg" alt="Shoes" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-zinc-800 dark:text-white/80">Shoes: {model}</p>
          <div className="mt-2 h-3 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-[var(--brand,#b61616)]" style={{ width: `${shoeProgress}%` }} />
          </div>
          <p className="mt-2 text-xs text-zinc-600 dark:text-white/60">
            {usedKm} km used · Recommended replacement at {maxKm} km.
          </p>
        </div>
        <span className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
          {shoeProgress}% life
        </span>
      </div>
    </GlassyCard>
  )
}
