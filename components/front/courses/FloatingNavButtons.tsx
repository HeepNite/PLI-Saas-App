"use client"

import React from "react"
import { ArrowUp, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function FloatingNavButtons() {
  const router = useRouter()
  const [showTop, setShowTop] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 240)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return (
    <div className="pointer-events-none floating-nav fixed bottom-6 right-6 z-50">
      <button
        type="button"
        onClick={() => (showTop ? window.scrollTo({ top: 0, behavior: "smooth" }) : router.back())}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition hover:translate-y-[-1px] hover:border-white/40"
        aria-label={showTop ? "Back to top" : "Back"}
      >
        {showTop ? <ArrowUp className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
        <span>{showTop ? "Back to top" : "Back"}</span>
      </button>
    </div>
  )
}
