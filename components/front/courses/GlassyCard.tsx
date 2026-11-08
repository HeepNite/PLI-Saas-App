'use client'
import React from "react"

// GlassyCard: simple translucent card with backdrop blur and optional faint background image.
// Props:
// - img: optional background image path (public). It renders with very low opacity.
// - className: additional Tailwind classes.
// - children: card content.
// - blur: backdrop blur behind the card (default true). Disable it on low-end
//   GPUs such as the kiosk tablet, which recompute it on every frame.
type GlassyCardProps = React.HTMLAttributes<HTMLDivElement> & {
  img?: string
  blur?: boolean
  children: React.ReactNode
}

export default function GlassyCard({ img, blur = true, className = "", children, ...rest }: GlassyCardProps) {
  return (
    <div
      {...rest}
      className={[
        // Base glass look in both light and dark themes
        blur ? "relative rounded-2xl border backdrop-blur" : "relative rounded-2xl border",
        "border-black/10 dark:border-white/10",
        "bg-white/60 dark:bg-white/5",
        "shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)]",
        className,
      ].join(" ")}
    >
      {/* Faint background image layer */}
      {img && (
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="h-full w-full object-cover opacity-[0.05]" />
        </div>
      )}
      {/* Content layer */}
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
