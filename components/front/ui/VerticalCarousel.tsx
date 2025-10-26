"use client"

import Image from "next/image"
import React from "react"

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
  "/images/carousel/_DSC0998.JPG",
  "/images/carousel/_DSC1076.JPG",
  "/images/carousel/_DSC1079.JPG",
  "/images/carousel/_DSC1087.JPG",
  "/images/carousel/_DSC1090.JPG",
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
  // Responsive columns: 1 column on small screens, otherwise use provided `columns`
  const [effectiveCols, setEffectiveCols] = React.useState(Math.max(1, columns))
  const [isSmall, setIsSmall] = React.useState(false)
  const [isDark, setIsDark] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    const apply = () => {
      const small = mq.matches
      setIsSmall(small)
      setEffectiveCols(small ? 1 : Math.max(1, columns))
    }
    apply()
    // Theme detection
    const root = document.documentElement
    const updateTheme = () => setIsDark(root.classList.contains("dark"))
    updateTheme()
    // Add/remove listener with cross-browser support
    if (mq.addEventListener) {
      mq.addEventListener("change", apply)
    } else {

      mq.addListener(apply)
    }
    const obs = new MutationObserver(updateTheme)
    obs.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply)
      else {

        mq.removeListener(apply)
      }
      obs.disconnect()
    }
  }, [columns])
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
