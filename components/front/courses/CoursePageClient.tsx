"use client"
import React from "react"
import type { CourseData } from "@/constants/courses"
import CourseAsideLeft from "./CourseAsideLeft"
import CourseAsideRight from "./CourseAsideRight"
import CourseSections from "./CourseSections"

// CoursePageClient: 3-column layout wrapper.
// - Left and right columns are sticky on desktop.
// - The center column is the only scrollable area to keep the page short.
// - On mobile/tablet, the layout stacks and page scrolls normally for better UX.
// Tweak the `stickyTop` and `containerPadding` if your header/notification bar heights change.
export default function CoursePageClient({ course }: { course: CourseData }) {
  // Offset for sticky to account for Header + NotificationBar approx height
  const stickyTop = 96 // px (~ top-24)
  const gridRef = React.useRef<HTMLDivElement>(null)
  const leftStickyRef = React.useRef<HTMLDivElement>(null)
  const rightStickyRef = React.useRef<HTMLDivElement>(null)
  const [showSkeleton, setShowSkeleton] = React.useState(true)

  React.useEffect(() => {
    if (typeof document === "undefined") return
    const update = () => {
      document.body.dataset.coursePage = "true"
      document.body.dataset.courseMobile = window.innerWidth < 1024 ? "true" : "false"
    }
    update()
    window.addEventListener("resize", update)
    return () => {
      delete document.body.dataset.coursePage
      delete document.body.dataset.courseMobile
      window.removeEventListener("resize", update)
    }
  }, [])

  React.useEffect(() => {
    const id = window.setTimeout(() => setShowSkeleton(false), 280)
    return () => window.clearTimeout(id)
  }, [course.slug])

  React.useEffect(() => {
    const grid = gridRef.current
    const left = leftStickyRef.current
    const right = rightStickyRef.current
    if (!grid || !left || !right) return

    let frame = 0

    const reset = (el: HTMLDivElement) => {
      el.style.position = ""
      el.style.top = ""
      el.style.left = ""
      el.style.width = ""
      el.style.zIndex = ""
    }

    const update = () => {
      if (window.innerWidth < 1024) {
        reset(left)
        reset(right)
        return
      }

      const scrollY = window.scrollY
      const gridRect = grid.getBoundingClientRect()
      const gridTop = gridRect.top + scrollY
      const gridBottom = gridTop + grid.offsetHeight
      const gridLeft = gridRect.left + window.scrollX
      const gridWidth = gridRect.width

      const leftParent = left.parentElement as HTMLElement | null
      const rightParent = right.parentElement as HTMLElement | null
      const leftWidth = leftParent?.getBoundingClientRect().width ?? left.getBoundingClientRect().width
      const rightWidth = rightParent?.getBoundingClientRect().width ?? right.getBoundingClientRect().width

      const apply = (el: HTMLDivElement, leftPos: number, width: number, maxTop: number) => {
        if (scrollY + stickyTop < gridTop) {
          reset(el)
          return
        }
        if (scrollY + stickyTop >= maxTop) {
          el.style.position = "absolute"
          el.style.top = `${maxTop - gridTop}px`
          el.style.left = `${leftPos - gridLeft}px`
          el.style.width = `${width}px`
          el.style.zIndex = "20"
          return
        }
        el.style.position = "fixed"
        el.style.top = `${stickyTop}px`
        el.style.left = `${leftPos}px`
        el.style.width = `${width}px`
        el.style.zIndex = "20"
      }

      apply(left, gridLeft, leftWidth, gridBottom - left.offsetHeight)
      apply(right, gridLeft + gridWidth - rightWidth, rightWidth, gridBottom - right.offsetHeight)
    }

    const onScroll = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    const resizeObserver = new ResizeObserver(() => onScroll())
    resizeObserver.observe(grid)
    resizeObserver.observe(left)
    resizeObserver.observe(right)

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    update()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      reset(left)
      reset(right)
    }
  }, [])

  const LeftSkeleton = () => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="h-3 w-28 rounded-full shimmer" />
      <div className="mt-4 aspect-[3/4] w-full rounded-2xl shimmer" />
      <div className="mt-4 h-4 w-2/3 rounded-full shimmer" />
      <div className="mt-2 h-3 w-1/2 rounded-full shimmer" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={`left-card-${idx}`} className="h-12 rounded-lg shimmer" />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={`left-pill-${idx}`} className="h-7 w-24 rounded-full shimmer" />
        ))}
      </div>
    </div>
  )

  const LeftSecondarySkeleton = () => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="h-3 w-24 rounded-full shimmer" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={`left-prof-${idx}`} className="h-10 rounded-lg shimmer" />
        ))}
      </div>
    </div>
  )

  const CenterSkeleton = () => (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-4">
        <div className="h-3 w-32 rounded-full shimmer" />
        <div className="mt-4 aspect-[16/9] w-full rounded-2xl shimmer" />
        <div className="mt-4 h-5 w-3/4 rounded-full shimmer" />
        <div className="mt-2 h-3 w-2/3 rounded-full shimmer" />
        <div className="mt-2 h-3 w-1/2 rounded-full shimmer" />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="h-3 w-28 rounded-full shimmer" />
        <div className="mt-3 h-5 w-2/3 rounded-full shimmer" />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={`center-card-${idx}`} className="h-28 rounded-2xl shimmer" />
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="h-3 w-28 rounded-full shimmer" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`center-review-${idx}`} className="h-24 rounded-2xl shimmer" />
          ))}
        </div>
      </div>
    </div>
  )

  const RightSkeleton = () => (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="h-4 w-40 rounded-full shimmer" />
        <div className="mt-3 h-10 w-full rounded-lg shimmer" />
        <div className="mt-3 h-10 w-full rounded-lg shimmer" />
        <div className="mt-3 h-10 w-full rounded-lg shimmer" />
        <div className="mt-5 h-12 w-full rounded-xl shimmer" />
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="h-4 w-28 rounded-full shimmer" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={`right-line-${idx}`} className="h-4 rounded-full shimmer" />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background overflow-visible">
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 py-8">
        {/* Grid shell */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start overflow-visible relative"
        >
          {/* Left sticky */}
          <aside className="lg:col-span-2 lg:self-start lg:h-fit">
            <div ref={leftStickyRef} className="lg:sticky" style={{ top: stickyTop }}>
              <div className="space-y-4">
                {showSkeleton ? <LeftSkeleton /> : <CourseAsideLeft course={course} />}
                {showSkeleton ? <LeftSecondarySkeleton /> : null}
              </div>
            </div>
          </aside>

          {/* Center content */}
          <section className="lg:col-span-7">
            <div className="pr-1">
              {showSkeleton ? <CenterSkeleton /> : <CourseSections course={course} />}
            </div>
          </section>

          {/* Right sticky */}
          <aside
            className="lg:col-span-3 lg:self-start lg:h-fit"
            id="enroll-cta"
          >
            <div ref={rightStickyRef} className="lg:sticky" style={{ top: stickyTop }}>
              {showSkeleton ? <RightSkeleton /> : <CourseAsideRight course={course} />}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
