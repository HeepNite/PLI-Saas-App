"use client"

import React from "react"

/**
 * Compact brands banner to be shown before the masonry grid.
 * - Light theme: glassy card (bg-white/30 + blur + subtle border/shadow, rounded)
 * - Dark theme: keep it minimal/transparent to match existing dark style
 */
export default function BrandsBanner({
  brands = [
    "Sony Music Latin",
    "Universal Music",
    "Warner Music",
    "Spotify",
    "YouTube",
    "Apple Music",
    "TIDAL",
    "Latin Grammy",
  ],
}: {
  brands?: string[]
}) {
  return (
    <section className="w-full mt-10">
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-xl dark:rounded-none bg-white/30 backdrop-blur-md backdrop-saturate-150 border border-white/15 shadow-sm dark:bg-transparent dark:backdrop-blur-0 dark:backdrop-saturate-100 dark:border-white/10/0 dark:shadow-none"
          aria-label="Marcas con las que trabajamos"
        >
          {/* subtle fade edges so it feels like a small banner */}
          <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-black/5 to-transparent pointer-events-none dark:from-white/5" />
          <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-black/5 to-transparent pointer-events-none dark:from-white/5" />

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 sm:py-5">
            {brands.map((b) => (
              <div
                key={b}
                className="inline-flex items-center gap-2 text-sm sm:text-base text-neutral-700 dark:text-neutral-300 opacity-80 hover:opacity-100 transition-opacity"
              >
                {/* dot/icon placeholder to simulate minimalist logo mark */}
                <span className="size-2.5 rounded-full bg-neutral-700/60 dark:bg-neutral-300/60" aria-hidden />
                <span className="font-medium tracking-tight">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
