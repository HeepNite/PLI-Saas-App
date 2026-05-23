import React from "react"
import { Award, BookOpen, DoorOpen, Link2, Package } from "lucide-react"

type PackageCounts = {
  all: number
  ACTIVE: number
  SUSPENDED: number
}

type CourseLinkStats = {
  total: number
  active: number
  inactive: number
}

type StaffCatalogSectionProps = {
  schoolLoading: boolean
  fetchSchoolData: () => void
  schoolCoursesCount: number
  activeSchoolCoursesCount: number
  schoolRoomsCount: number
  activeRoomOptionsCount: number
  packageCounts: PackageCounts
  schoolPointsRulesCount: number
  activeSchoolPointsRulesCount: number
  courseLinkStats: CourseLinkStats
  children: React.ReactNode
}

export default function StaffCatalogSection(props: StaffCatalogSectionProps) {
  const {
    schoolLoading,
    fetchSchoolData,
    schoolCoursesCount,
    activeSchoolCoursesCount,
    schoolRoomsCount,
    activeRoomOptionsCount,
    packageCounts,
    schoolPointsRulesCount,
    activeSchoolPointsRulesCount,
    courseLinkStats,
    children,
  } = props

  return (
    <>
      <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">School builder</p>
            <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Courses, packages, and point assignment</h3>
            <p className="mt-1 text-sm text-black/65 dark:text-white/65">School is separate from staff users. Manage only the academic catalog here.</p>
          </div>
          <button type="button" onClick={fetchSchoolData} className="inline-flex items-center justify-center rounded-md border border-[var(--brand,#b61616)]/50 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/15">
            {schoolLoading ? "Refreshing..." : "Refresh school data"}
          </button>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-5 xl:gap-4">
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-[var(--brand,#b61616)]/18 via-[#1a1430]/40 to-[#0a0f23]/60 p-3 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.7)] md:min-w-0">
            <BookOpen className="mb-1 h-3.5 w-3.5 text-[var(--brand,#ff4b4b)]/70" />
            <p className="text-2xl font-semibold text-white">{schoolCoursesCount}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/50">Courses</p>
            <p className="mt-1 text-xs text-white/65">{activeSchoolCoursesCount} active · {schoolCoursesCount - activeSchoolCoursesCount} hold</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#f59e0b]/16 via-[#221631]/40 to-[#0a0f23]/60 p-3 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.7)] md:min-w-0">
            <DoorOpen className="mb-1 h-3.5 w-3.5 text-amber-400/70" />
            <p className="text-2xl font-semibold text-white">{schoolRoomsCount}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/50">Rooms</p>
            <p className="mt-1 text-xs text-white/65">{activeRoomOptionsCount} active · {schoolRoomsCount - activeRoomOptionsCount} hold</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#3b82f6]/16 via-[#171b38]/40 to-[#0a0f23]/60 p-3 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.7)] md:min-w-0">
            <Package className="mb-1 h-3.5 w-3.5 text-blue-400/70" />
            <p className="text-2xl font-semibold text-white">{packageCounts.all}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/50">Packages</p>
            <p className="mt-1 text-xs text-white/65">{packageCounts.ACTIVE} active · {packageCounts.SUSPENDED} hold</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-emerald-500/16 via-[#132a1f]/40 to-[#0a0f23]/60 p-3 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.7)] md:min-w-0">
            <Award className="mb-1 h-3.5 w-3.5 text-emerald-400/70" />
            <p className="text-2xl font-semibold text-white">{schoolPointsRulesCount}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/50">Points rules</p>
            <p className="mt-1 text-xs text-white/65">{activeSchoolPointsRulesCount} active · {schoolPointsRulesCount - activeSchoolPointsRulesCount} hold</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/16 via-[#1e1435]/40 to-[#0a0f23]/60 p-3 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.7)] md:min-w-0">
            <Link2 className="mb-1 h-3.5 w-3.5 text-fuchsia-300/70" />
            <p className="text-2xl font-semibold text-white">{courseLinkStats.total}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/50">Course links</p>
            <p className="mt-1 text-xs text-white/65">{courseLinkStats.active} active · {courseLinkStats.inactive} hold</p>
          </div>
        </div>
      </article>
      {children}
    </>
  )
}
