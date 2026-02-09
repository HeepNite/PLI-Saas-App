"use client"
import React from "react"
import { useSearchParams } from "next/navigation"
import EnrollModal from "./EnrollModal"
import type { CourseEnrollmentData } from "./types"
import GlassyCard from "./GlassyCard"

// Right sticky aside: inline booking form.
export default function CourseAsideRight({ course }: { course: CourseEnrollmentData }) {
  const searchParams = useSearchParams()
  const stepParam = searchParams.get("step")
  const parsedStep = stepParam ? Number(stepParam) : undefined
  const initialStep = typeof parsedStep === "number" && Number.isFinite(parsedStep) ? parsedStep : undefined
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [mobileOffset, setMobileOffset] = React.useState(24)
  const bookingButtonRef = React.useRef<HTMLDivElement | null>(null)
  const bookingShift = "0px"
  const sideButtonSize = 44
  const sideGapPadding = 64

  React.useEffect(() => {
    const footer = document.getElementById("site-footer")
    if (!footer) return
    const baseOffset = 24
    const updateOffset = () => {
      const rect = footer.getBoundingClientRect()
      const overlap = Math.max(0, window.innerHeight - rect.top)
      const next = overlap > 0 ? overlap + baseOffset : baseOffset
      setMobileOffset(next)
      document.documentElement.style.setProperty("--floating-offset", `${next}px`)
    }
    updateOffset()
    window.addEventListener("scroll", updateOffset, { passive: true })
    window.addEventListener("resize", updateOffset)
    return () => {
      document.documentElement.style.removeProperty("--floating-offset")
      window.removeEventListener("scroll", updateOffset)
      window.removeEventListener("resize", updateOffset)
    }
  }, [])

  React.useEffect(() => {
    const el = bookingButtonRef.current
    if (!el) return
    const updateGap = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 1) return
      const gap = Math.max(84, rect.width / 2 + sideButtonSize / 2 + sideGapPadding)
      document.documentElement.style.setProperty("--floating-gap", `${gap}px`)
      document.documentElement.style.setProperty("--booking-shift", bookingShift)
    }
    updateGap()
    const observer = new ResizeObserver(updateGap)
    observer.observe(el)
    window.addEventListener("resize", updateGap)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateGap)
    }
  }, [mobileOpen])

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <EnrollModal
          course={course}
          open
          onCloseAction={() => undefined}
          initialStep={initialStep}
          mode="inline"
        />
      </div>

      <EnrollModal
        course={course}
        open={mobileOpen}
        onCloseAction={() => setMobileOpen(false)}
        initialStep={initialStep}
        mode="modal"
      />

      {!mobileOpen && (
        <div
          ref={bookingButtonRef}
          className="lg:hidden fixed left-1/2 z-[12000] -translate-x-1/2"
          style={{ bottom: "calc(var(--floating-offset, 24px) - 1.5rem)" }}
        >
          <div style={{ position: "relative", right: "0px" }}>
            <GlassyCard className="rounded-full px-3 py-2 bg-white/15 dark:bg-white/10 border-white/20">
              <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="px-4 py-2 text-sm font-semibold text-white"
            >
              Reservar tu clase
            </button>
            </GlassyCard>
          </div>
        </div>
      )}
    </div>
  )
}
