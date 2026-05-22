import React from "react"

type StaffCatalogSectionProps = {
  schoolLoading: boolean
  fetchSchoolData: () => void
  schoolCoursesCount: number
  schoolRoomsCount: number
  activeRoomOptionsCount: number
  activePackagesCount: number
  schoolPointsRulesCount: number
  schoolCourseLinkCount: number
  children: React.ReactNode
}

export default function StaffCatalogSection(props: StaffCatalogSectionProps) {
  const {
    schoolLoading,
    fetchSchoolData,
    schoolCoursesCount,
    schoolRoomsCount,
    activeRoomOptionsCount,
    activePackagesCount,
    schoolPointsRulesCount,
    schoolCourseLinkCount,
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
          <div className="rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03] md:min-w-0"><p className="text-[10px] uppercase tracking-[0.14em] text-black/60 dark:text-white/60">Courses</p><p className="mt-1 text-2xl font-semibold text-black dark:text-white">{schoolCoursesCount}</p></div>
          <div className="rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03] md:min-w-0"><p className="text-[10px] uppercase tracking-[0.14em] text-black/60 dark:text-white/60">Rooms</p><p className="mt-1 text-2xl font-semibold text-black dark:text-white">{schoolRoomsCount}</p><p className="mt-1 text-xs text-black/55 dark:text-white/55">{activeRoomOptionsCount} active</p></div>
          <div className="rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03] md:min-w-0"><p className="text-[10px] uppercase tracking-[0.14em] text-black/60 dark:text-white/60">Packages</p><p className="mt-1 text-2xl font-semibold text-black dark:text-white">{activePackagesCount}</p></div>
          <div className="rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03] md:min-w-0"><p className="whitespace-nowrap text-[10px] uppercase tracking-[0.14em] text-black/60 dark:text-white/60">Points rules</p><p className="mt-1 text-2xl font-semibold text-black dark:text-white">{schoolPointsRulesCount}</p></div>
          <div className="rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03] md:min-w-0"><p className="text-[10px] uppercase tracking-[0.14em] text-black/60 dark:text-white/60">Consecutive</p><p className="mt-1 text-2xl font-semibold text-black dark:text-white">{schoolCourseLinkCount}</p><p className="mt-1 text-xs text-black/55 dark:text-white/55">course links</p></div>
        </div>
      </article>
      {children}
    </>
  )
}
