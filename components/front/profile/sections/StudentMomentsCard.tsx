import GlassyCard from "@/components/front/courses/GlassyCard"

type StudentMomentsCardProps = {
  moments: string[]
}

export function StudentMomentsCard({ moments }: StudentMomentsCardProps) {
  return (
    <GlassyCard className="order-2 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Student moments</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {moments.map((src, idx) => (
          <div key={`moment-${idx}`} className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="moment" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </GlassyCard>
  )
}
