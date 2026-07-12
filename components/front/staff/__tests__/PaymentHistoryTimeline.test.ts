import { describe, expect, it } from "vitest"
import { formatCurrency, formatDate, computePopoverPositionFromRect } from "@/components/front/staff/PaymentHistoryTimeline"

describe("formatCurrency", () => {
  it("formats whole dollar amounts without cents", () => {
    expect(formatCurrency(150)).toBe("$150")
  })

  it("formats amounts with cents", () => {
    expect(formatCurrency(99.99)).toBe("$99.99")
  })

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0")
  })

  it("formats large amounts with commas", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56")
  })
})

describe("formatDate", () => {
  it("formats a date with time", () => {
    const date = new Date("2026-04-20T10:30:00")
    const result = formatDate(date)
    expect(result).toContain("Apr")
    expect(result).toContain("20")
    expect(result).toContain("2026")
  })

  it("includes time in the output", () => {
    const date = new Date("2026-04-20T14:00:00")
    const result = formatDate(date)
    expect(result).toMatch(/\d{1,2}:\d{2}\s*[AP]M/)
  })

  it("returns the em-dash fallback for an Invalid Date without throwing", () => {
    const invalid = new Date("not-a-date")
    expect(() => formatDate(invalid)).not.toThrow()
    expect(formatDate(invalid)).toBe("—")
  })
})

describe("computePopoverPositionFromRect", () => {
  const defaultRect = { top: 100, left: 200, right: 250, bottom: 130 }

  it("places popover to the right when there is enough space", () => {
    const pos = computePopoverPositionFromRect(defaultRect, 420, 520, 12, 1200, 800)

    expect(pos.placement).toBe("right")
    expect(pos.left).toBe(262) // 250 + 12 padding
  })

  it("places popover to the left when right side is cramped", () => {
    // Viewport 900, anchor near right edge: right=850, left=800
    // spaceRight = 900-850 = 50 (< 420), spaceLeft = 800 (>= 420)
    const rect = { top: 100, left: 800, right: 850, bottom: 130 }
    const pos = computePopoverPositionFromRect(rect, 420, 520, 12, 900, 800)

    expect(pos.placement).toBe("left")
    expect(pos.left).toBe(368) // 800 - 420 - 12
  })

  it("places popover below when both sides are cramped but bottom has space", () => {
    const rect = { top: 100, left: 100, right: 150, bottom: 200 }
    const pos = computePopoverPositionFromRect(rect, 420, 520, 12, 400, 800)

    expect(pos.placement).toBe("bottom")
  })

  it("places popover above when all other sides are cramped", () => {
    const rect = { top: 100, left: 100, right: 150, bottom: 130 }
    const pos = computePopoverPositionFromRect(rect, 420, 520, 12, 400, 200)

    expect(pos.placement).toBe("top")
  })

  it("respects viewport height for top positioning", () => {
    const rect = { top: 550, left: 200, right: 250, bottom: 580 }
    const pos = computePopoverPositionFromRect(rect, 420, 520, 12, 1200, 600)

    // Should cap top so popover doesn't overflow viewport
    expect(pos.top + 520).toBeLessThanOrEqual(600 - 12)
  })

  it("uses default viewport when not provided", () => {
    const pos = computePopoverPositionFromRect(defaultRect)

    expect(pos.placement).toBe("right")
  })
})
