import { describe, expect, it } from "vitest"
import { areAllClassesEnded } from "@/components/front/staff/CompletedClassesSelector"

const baseClass = {
  slug: "salsa-nocturno",
  title: "Salsa Nocturno",
  category: "Dance",
  level: "Beginner",
  durationMinutes: 60,
  availableTimes: ["20:10"],
  coverImageUrl: null,
}

describe("areAllClassesEnded", () => {
  it("returns false when at least one class is still running in ET", () => {
    expect(areAllClassesEnded([baseClass], new Date("2026-04-03T01:00:00.000Z"))).toBe(false)
  })

  it("returns true after every class has ended in ET", () => {
    expect(areAllClassesEnded([baseClass], new Date("2026-04-03T03:00:00.000Z"))).toBe(true)
  })

  it("returns false for an empty class list", () => {
    expect(areAllClassesEnded([], new Date("2026-04-03T03:00:00.000Z"))).toBe(false)
  })
})
