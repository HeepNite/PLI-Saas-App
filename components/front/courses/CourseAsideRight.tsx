"use client"
import React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import EnrollModal from "./EnrollModal"
import type { CourseEnrollmentData } from "./types"
import GlassyCard from "./GlassyCard"

// Right sticky aside: inline booking form.
export default function CourseAsideRight({ course }: { course: CourseEnrollmentData }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const enrollParam = searchParams.get("enroll")
  const stepParam = searchParams.get("step")
  const parsedStep = stepParam ? Number(stepParam) : undefined
  const initialStep = typeof parsedStep === "number" && Number.isFinite(parsedStep) ? parsedStep : undefined
  const shouldRestoreDraft = enrollParam === "1" || typeof initialStep === "number"
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [dockBooking, setDockBooking] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const bookingButtonRef = React.useRef<HTMLDivElement | null>(null)
  const [dockTarget, setDockTarget] = React.useState<HTMLElement | null>(null)
  const consumedQueryRef = React.useRef(false)
  const bookingShift = "0px"
  const sideButtonSize = 44
  const sideGapPadding = 64

  const clearBookingQuery = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    let changed = false
    if (params.has("enroll")) {
      params.delete("enroll")
      changed = true
    }
    if (params.has("step")) {
      params.delete("step")
      changed = true
    }
    if (!changed) return
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  React.useEffect(() => {
    if (!shouldRestoreDraft || consumedQueryRef.current) return
    consumedQueryRef.current = true
    clearBookingQuery()
  }, [shouldRestoreDraft, clearBookingQuery])

  React.useEffect(() => {
    const footer = document.getElementById("site-footer")
    if (!footer) return
    const baseOffset = 24
    const updateOffset = () => {
      const rect = footer.getBoundingClientRect()
      const overlap = Math.max(0, window.innerHeight - rect.top)
      const next = overlap > 0 ? overlap + baseOffset : baseOffset
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
    const el = containerRef.current
    if (!el) return
    const updateDock = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setDockBooking(false)
        return
      }
      const target = dockTarget ?? el
      const rect = target.getBoundingClientRect()
      const triggerLine = window.innerHeight * 0.7
      const inView = rect.top <= triggerLine && rect.bottom >= triggerLine
      setDockBooking(inView && Boolean(dockTarget))
    }
    updateDock()
    window.addEventListener("scroll", updateDock, { passive: true })
    window.addEventListener("resize", updateDock)
    return () => {
      window.removeEventListener("scroll", updateDock)
      window.removeEventListener("resize", updateDock)
    }
  }, [dockTarget])

  React.useEffect(() => {
    const handler = () => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        setMobileOpen(true)
      }
    }
    window.addEventListener("pli:open-booking", handler)
    return () => window.removeEventListener("pli:open-booking", handler)
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const target = document.getElementById("booking-dock")
    setDockTarget(target)
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
    <div ref={containerRef} className="space-y-4">
      <div className="hidden lg:block">
        <EnrollModal
          course={course}
          open
          onCloseAction={clearBookingQuery}
          initialStep={initialStep}
          useDraft={shouldRestoreDraft}
          mode="inline"
        />
      </div>

      <EnrollModal
        course={course}
        open={mobileOpen}
        onCloseAction={() => {
          setMobileOpen(false)
          clearBookingQuery()
        }}
        initialStep={initialStep}
        useDraft={shouldRestoreDraft}
        mode="modal"
      />

      {!mobileOpen && !dockBooking && (
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
