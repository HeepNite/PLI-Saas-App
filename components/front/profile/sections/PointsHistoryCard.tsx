import GlassyCard from "@/components/front/courses/GlassyCard"
import type { PointsEntry } from "../profile-types"
import { formatDateTimeInTimeZone, pointsTypeLabel } from "../profile-formatters"

type PointsHistoryCardProps = {
  pointsBalance: number
  pointsError: string | null
  pointsLoading: boolean
  latestPointEntries: PointsEntry[]
}

export function PointsHistoryCard({ pointsBalance, pointsError, pointsLoading, latestPointEntries }: PointsHistoryCardProps) {
  return (
    <GlassyCard className="order-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Points history</p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-white/70">Recent balance movements.</p>
        </div>
        <div className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-semibold text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
          Balance: {pointsBalance}
        </div>
      </div>
      {pointsError && <p className="mt-3 text-xs text-red-400">{pointsError}</p>}
      {pointsLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={`points-skeleton-${idx}`} className="h-10 animate-pulse rounded-lg border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : latestPointEntries.length > 0 ? (
        <div className="mt-4 space-y-2">
          {latestPointEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-zinc-800 dark:text-white/90">{pointsTypeLabel(entry.type)}</p>
                <p className="text-xs text-zinc-600 dark:text-white/55">{formatDateTimeInTimeZone(entry.createdAt)}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  entry.points >= 0
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    : "border border-red-500/30 bg-red-500/10 text-red-400"
                }`}
              >
                {entry.points >= 0 ? `+${entry.points}` : entry.points}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-zinc-600 dark:text-white/60">You do not have any point activity yet.</p>
      )}
    </GlassyCard>
  )
}
