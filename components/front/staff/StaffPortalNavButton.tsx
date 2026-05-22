import React from "react"

import type { StaffPortalSection } from "@/lib/security/staff-access"

export type StaffPortalNavItem = {
  key: StaffPortalSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type StaffPortalNavButtonProps = {
  item: StaffPortalNavItem
  active: boolean
  layout: "rail" | "tabs"
  onSelect: (section: StaffPortalSection) => void
}

export default function StaffPortalNavButton({ item, active, layout, onSelect }: StaffPortalNavButtonProps) {
  const Icon = item.icon

  if (layout === "tabs") {
    return (
      <button
        key={item.key}
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={item.label}
        title={item.label}
        onFocus={() => onSelect(item.key)}
        onClick={() => onSelect(item.key)}
        className={`inline-flex h-8 min-w-0 flex-1 basis-0 items-center justify-center rounded-lg border transition ${
          active
            ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/16 text-[var(--brand,#ff3c3c)]"
            : "border-black/10 bg-white/70 text-black/70 hover:border-[var(--brand,#b61616)]/45 hover:text-[var(--brand,#ff3c3c)] dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70"
        }`}
      >
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    )
  }

  return (
    <button
      key={item.key}
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={item.label}
      onFocus={() => onSelect(item.key)}
      onClick={() => onSelect(item.key)}
      className={`group relative z-10 flex h-11 w-11 items-center justify-center rounded-xl border transition ${
        active
          ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/20 text-[var(--brand,#ff3c3c)]"
          : "border-black/10 bg-white/70 text-black/70 hover:border-[var(--brand,#b61616)]/45 hover:text-[var(--brand,#ff3c3c)] dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[200] -translate-y-1/2 whitespace-nowrap rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-black opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-white/10 dark:bg-[#0f1117] dark:text-white">
        {item.label}
      </span>
    </button>
  )
}
