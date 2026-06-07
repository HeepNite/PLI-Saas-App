import React, { useRef, useEffect } from "react"

// ─── Popover Positioning ─────────────────────────────────────────────────────

export interface PopoverPosition {
  top: number
  left: number
  placement: "right" | "left" | "bottom" | "top"
}

export interface RectLike {
  top: number
  left: number
  right: number
  bottom: number
}

export function computePopoverPositionFromRect(
  rect: RectLike,
  popoverWidth = 420,
  popoverHeight = 520,
  padding = 12,
  viewportW = typeof window !== "undefined" ? window.innerWidth : 1200,
  viewportH = typeof window !== "undefined" ? window.innerHeight : 800,
): PopoverPosition {
  const spaceRight = viewportW - rect.right
  const spaceLeft = rect.left
  const spaceBottom = viewportH - rect.bottom
  const spaceTop = rect.top

  // Prefer right side, then left, then bottom, then top
  if (spaceRight >= popoverWidth) {
    return {
      top: Math.min(rect.top, viewportH - popoverHeight - padding),
      left: rect.right + padding,
      placement: "right",
    }
  }
  if (spaceLeft >= popoverWidth) {
    return {
      top: Math.min(rect.top, viewportH - popoverHeight - padding),
      left: rect.left - popoverWidth - padding,
      placement: "left",
    }
  }
  if (spaceBottom >= popoverHeight) {
    return {
      top: rect.bottom + padding,
      left: Math.min(rect.left, viewportW - popoverWidth - padding),
      placement: "bottom",
    }
  }
  return {
    top: rect.top - popoverHeight - padding,
    left: Math.min(rect.left, viewportW - popoverWidth - padding),
    placement: "top",
  }
}

export function computePopoverPosition(
  anchorEl: HTMLElement,
  popoverWidth = 420,
  popoverHeight = 520,
  padding = 12,
): PopoverPosition {
  const rect = anchorEl.getBoundingClientRect()
  return computePopoverPositionFromRect(rect, popoverWidth, popoverHeight, padding)
}

// ─── Shared Hooks ────────────────────────────────────────────────────────────

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void
) {
  useEffect(() => {
    function listener(event: MouseEvent) {
      const el = ref.current
      if (!el || el.contains(event.target as Node)) return
      handler()
    }
    document.addEventListener("mousedown", listener)
    return () => document.removeEventListener("mousedown", listener)
  }, [ref, handler])
}

export function useKeyboardClose(onClose: () => void) {
  useEffect(() => {
    function listener(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", listener)
    return () => document.removeEventListener("keydown", listener)
  }, [onClose])
}

// ─── Arrow Style Helpers ─────────────────────────────────────────────────────

export function getArrowStyle(position: PopoverPosition | null): React.CSSProperties {
  if (!position) return {}
  switch (position.placement) {
    case "left":
      return { right: "-6px", top: "24px" }
    case "right":
      return { left: "-6px", top: "24px" }
    case "top":
      return { left: "24px", bottom: "-6px" }
    case "bottom":
      return { left: "24px", top: "-6px" }
  }
}

export function getArrowRotation(position: PopoverPosition | null): string {
  if (!position) return ""
  switch (position.placement) {
    case "left":
      return "rotate-45"
    case "right":
      return "-rotate-45"
    case "top":
      return "rotate-[135deg]"
    case "bottom":
      return "-rotate-[135deg]"
  }
}
