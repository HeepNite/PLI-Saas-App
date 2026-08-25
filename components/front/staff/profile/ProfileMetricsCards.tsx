"use client"

import React from "react"
import type { SelfProfileSnapshot } from "../staffAdminTypes"

type ProfileMetricsCardsProps = {
  resolvedSelfProfile: SelfProfileSnapshot
  selfPerformanceScore: number
}

export default function ProfileMetricsCards(props: ProfileMetricsCardsProps) {
  const { resolvedSelfProfile, selfPerformanceScore } = props

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-[var(--brand,#b61616)]/40 bg-gradient-to-br from-[var(--brand,#b61616)]/24 via-[#5f1737]/16 to-[#1b1330]/18 p-3 dark:border-[var(--brand,#b61616)]/40 dark:bg-gradient-to-br dark:from-[var(--brand,#b61616)]/32 dark:via-[#28163b]/26 dark:to-[#12192f]/24">
        <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Performance score</p>
        <p className="mt-1 text-2xl font-semibold text-black dark:text-white">{selfPerformanceScore}</p>
        <p className="text-xs text-black/70 dark:text-white/70">Based on rating, cadence and reviews.</p>
      </div>
      <div className="rounded-xl border border-sky-500/40 bg-gradient-to-br from-sky-500/20 via-[#1a395b]/16 to-[#12263f]/20 p-3 dark:border-sky-500/40 dark:bg-gradient-to-br dark:from-sky-500/26 dark:via-[#142840]/26 dark:to-[#0f1a2e]/24">
        <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Rating</p>
        <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
          {typeof resolvedSelfProfile.metrics.performanceRating === "number"
            ? `${Math.round(resolvedSelfProfile.metrics.performanceRating * 10) / 10}/5`
            : "—"}
        </p>
        <p className="text-xs text-black/70 dark:text-white/70">
          {resolvedSelfProfile.metrics.performanceReviewsCount || 0} reviews
        </p>
      </div>
      <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-[#164438]/16 to-[#132a25]/20 p-3 dark:border-emerald-500/40 dark:bg-gradient-to-br dark:from-emerald-500/24 dark:via-[#12362d]/26 dark:to-[#102521]/24">
        <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Payroll status</p>
        <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
          {resolvedSelfProfile.metrics.payrollStatus === "paid"
            ? "Paid"
            : resolvedSelfProfile.metrics.payrollStatus === "pending"
              ? "Pending"
              : "—"}
        </p>
        <p className="text-xs text-black/70 dark:text-white/70">
          Hours: {typeof resolvedSelfProfile.metrics.payrollHoursWorked === "number"
            ? resolvedSelfProfile.metrics.payrollHoursWorked.toFixed(1)
            : "—"}
        </p>
      </div>
      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/22 via-[#4d3618]/16 to-[#2c2214]/20 p-3 dark:border-amber-500/40 dark:bg-gradient-to-br dark:from-amber-500/28 dark:via-[#3a2b19]/24 dark:to-[#1d1815]/24">
        <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Review cycle</p>
        <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
          {typeof resolvedSelfProfile.metrics.performanceReviewCycleDays === "number"
            ? `${Math.round(resolvedSelfProfile.metrics.performanceReviewCycleDays)}d`
            : "—"}
        </p>
        <p className="text-xs text-black/70 dark:text-white/70">
          Location: {resolvedSelfProfile.location || "Not set"}
        </p>
      </div>
    </div>
  )
}
