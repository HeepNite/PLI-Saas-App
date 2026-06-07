import React from "react"

type StickyRailsRefs = {
  gridRef: React.RefObject<HTMLDivElement | null>
  leftRailRef: React.RefObject<HTMLDivElement | null>
  rightRailRef: React.RefObject<HTMLDivElement | null>
}

export function useStickyRails(stickyTop: number): StickyRailsRefs {
  const gridRef = React.useRef<HTMLDivElement>(null)
  const leftRailRef = React.useRef<HTMLDivElement>(null)
  const rightRailRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const grid = gridRef.current
    const left = leftRailRef.current
    const right = rightRailRef.current
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

      const apply = (el: HTMLDivElement, leftPos: number, width: number) => {
        if (scrollY + stickyTop < gridTop) {
          reset(el)
          return
        }

        const reachedBottom = scrollY + stickyTop + el.offsetHeight >= gridBottom
        if (reachedBottom) {
          el.style.position = "absolute"
          el.style.top = `${Math.max(0, grid.offsetHeight - el.offsetHeight)}px`
          el.style.left = `${Math.round(leftPos - gridLeft)}px`
          el.style.width = `${Math.round(width)}px`
          el.style.zIndex = "20"
          return
        }

        el.style.position = "fixed"
        el.style.top = `${stickyTop}px`
        el.style.left = `${Math.round(leftPos)}px`
        el.style.width = `${Math.round(width)}px`
        el.style.zIndex = "20"
      }

      apply(left, gridLeft, leftWidth)
      apply(right, gridLeft + gridWidth - rightWidth, rightWidth)
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
  }, [stickyTop])

  return { gridRef, leftRailRef, rightRailRef }
}
