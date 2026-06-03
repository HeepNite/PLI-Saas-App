import type { LucideIcon } from "lucide-react"
import GlassyCard from "@/components/front/courses/GlassyCard"

type MedalItem = {
  label: string
  icon: LucideIcon
}

type MedalsCardProps = {
  medalItems: MedalItem[]
}

export function MedalsCard({ medalItems }: MedalsCardProps) {
  return (
    <GlassyCard className="order-7 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Medals</p>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {medalItems.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="flex flex-col items-center gap-2 text-center">
              <div className="relative">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[var(--brand,#b61616)] to-[#f97316] p-[2px] shadow-[0_12px_40px_-20px_rgba(182,22,22,0.85)]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-black/70">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 h-4 w-10 -translate-x-1/2 rounded-full bg-[var(--brand,#b61616)]/40 blur-sm" />
              </div>
              <p className="text-xs text-zinc-700 dark:text-white/80">{item.label}</p>
            </div>
          )
        })}
      </div>
    </GlassyCard>
  )
}
