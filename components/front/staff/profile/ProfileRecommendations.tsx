"use client"

import React from "react"

type ProfileRecommendationsProps = {
  selfRecommendations: string[]
}

export default function ProfileRecommendations({ selfRecommendations }: ProfileRecommendationsProps) {
  return (
    <div className="mt-5 rounded-xl border border-black/10 bg-gradient-to-br from-[#1a1830]/70 via-[#1f1730]/60 to-[#102040]/50 p-3 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#181c31]/70 dark:via-[#251632]/65 dark:to-[#102040]/55">
      <p className="text-xs uppercase tracking-[0.22em] text-black/60 dark:text-white/60">Improvement recommendations</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {selfRecommendations.map((tip, index) => (
          <p
            key={`self-recommendation-${index}`}
            className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-black/75 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/75"
          >
            {tip}
          </p>
        ))}
      </div>
    </div>
  )
}
