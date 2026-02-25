"use client"

import Image from "next/image"
import React from "react"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import { useThemeObserver } from "@/lib/hooks/useThemeObserver"

type VerticalCarouselProps = {
  images?: string[]
  height?: number | string // container height (px or tailwind class via style)
  speedMs?: number // duration of one full scroll
  gap?: number // gap in pixels between grid rows
  rounded?: string // tailwind radius class name, e.g., "rounded-xl"
  columns?: number // number of columns, default 2
  className?: string
}

const defaultImages = [
  "/images/Kids/Artboard 1.jpg",
  "/images/carousel/_DSC1076.JPG",
  "/images/social-program/Background.jpg",
  "/images/Kids/Artboard 2.jpg",
  "/images/social-program/Background-1.jpg",
  "/images/carousel/_DSC1090.JPG",
  "/images/social-program/Background-3.jpg",
]

export default function VerticalCarousel({
  images = defaultImages,
  height = 520,
  speedMs = 50000,
  gap = 12,
  rounded = "rounded-xl",
  columns = 2,
  className,
}: VerticalCarouselProps) {
  const isSmall = useMediaQuery("(max-width: 768px)")
  const isDark = useThemeObserver()
  const effectiveCols = React.useMemo(() => (isSmall ? 1 : Math.max(1, columns)), [isSmall, columns])
  // Duplicate the array to make the loop seamless
  const loopImages = [...images, ...images]

  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className ?? ""} min-h-[400px] md:min-h-0`}
      style={{
        height: typeof height === "number" ? `${height}px` : (height as string),
      }}
    >


      <div
        className="absolute inset-0"
        style={
          isDark && !isSmall
            ? {
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
                maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
              }
            : undefined
        }
      >
      {/* Top and bottom blur overlays with gradient fade (glassy effect) */}
      <div
        aria-hidden
        className="hidden md:block dark:hidden pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-black/100"
        style={{
          maskImage: "linear-gradient(to bottom, black, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />
      <div
        aria-hidden
        className="hidden md:block dark:hidden pointer-events-none absolute inset-x-0 bottom-0 z-10 h-30 bg-black/100"
        style={{
          maskImage: "linear-gradient(to top, black, transparent)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent)",
        }}
      />

      {/* Scroller: two (or N) independent columns */}
      <div
        className="h-full grid"
        style={{ gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))`, columnGap: `${gap}px` }}
      >
        {Array.from({ length: effectiveCols }).map((_, colIdx) => (
          <div key={colIdx} className="relative h-full overflow-hidden">
            <div
              className="absolute left-0 right-0 will-change-transform"
              style={{
                animation: `vscroll ${speedMs}ms linear infinite`,
                animationDelay: `${(speedMs / (effectiveCols + 1)) * colIdx * -1}ms`,
              }}
            >
              <div className="grid" style={{ gridAutoFlow: "row", rowGap: `${gap}px` }}>
                {loopImages.map((src, idx) => (
                  <figure
                    key={`${colIdx}-${src}-${idx}`}
                    className={`relative w-full overflow-hidden ${rounded}`}
                    style={{ aspectRatio: "3 / 4" }}
                  >
                    <Image
                      src={src}
                      alt={`carousel item ${idx + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                      priority={idx < 3}
                    />
                  </figure>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>

      <style jsx>{`
        @keyframes vscroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>
    </div>
  )
}
