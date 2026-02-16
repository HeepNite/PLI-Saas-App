"use client"

import React from "react"
import Lenis from "lenis"
import { usePathname } from "next/navigation"

export default function SmoothScroll() {
  const pathname = usePathname()

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const media = window.matchMedia("(min-width: 1024px)")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!media.matches || reducedMotion.matches) return

    const lenis = new Lenis({
      smoothWheel: true,
      smoothTouch: false,
      lerp: 0.2,
      wheelMultiplier: 1,
      prevent: (node) => !!node?.closest("[data-lenis-prevent]"),
    })

    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = window.requestAnimationFrame(raf)
    }
    rafId = window.requestAnimationFrame(raf)

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [pathname])

  return null
}
