import { describe, expect, it } from "vitest"
import {
  createStableSpecialClassSlug,
  hashAuthoringPayload,
  isGeneratedSlotMutationBlocked,
  mapInitialSpecialClassProjection,
  normalizeConcreteSpecialClassSlots,
  shouldProjectSpecialClasses,
} from "@/lib/special-classes/authoring-policy"

describe("special class authoring policy", () => {
  it("normalizes concrete school-time slots to sorted UTC instants", () => {
    expect(normalizeConcreteSpecialClassSlots([
      { id: "winter", date: "2026-12-01", time: "09:30" },
      { id: "summer", date: "2026-07-01", time: "09:30" },
    ])).toEqual([
      { id: "summer", startsAt: new Date("2026-07-01T13:30:00.000Z") },
      { id: "winter", startsAt: new Date("2026-12-01T14:30:00.000Z") },
    ])
  })

  it.each([
    [{ date: "2026-03-08", time: "02:30" }, "nonexistent"],
    [{ date: "2026-11-01", time: "01:30" }, "ambiguous"],
    [{ date: "2026-02-30", time: "09:00" }, "invalid"],
  ])("rejects %s school-time input as %s", (slot, reason) => {
    expect(() => normalizeConcreteSpecialClassSlots([slot])).toThrow(reason)
  })

  it("rejects duplicate concrete instants instead of inferring identity", () => {
    expect(() => normalizeConcreteSpecialClassSlots([
      { date: "2026-09-10", time: "18:00" },
      { date: "2026-09-10", time: "18:00" },
    ])).toThrow("Duplicate")
  })

  it("builds a bounded immutable slug from the full stable slot ID", () => {
    const slotId = "5d647c42-387b-48bf-b1a0-19075fd7f57e"
    const slug = createStableSpecialClassSlug(`  ${"Very Long Course ".repeat(10)}  `, slotId)
    expect(slug).toHaveLength(100)
    expect(slug.endsWith(`-${slotId}`)).toBe(true)
    expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it("hashes normalized payloads independently of object key order", () => {
    expect(hashAuthoringPayload({ title: "Workshop", nested: { capacity: 12, enabled: true } }))
      .toBe(hashAuthoringPayload({ nested: { enabled: true, capacity: 12 }, title: "Workshop" }))
    expect(hashAuthoringPayload({ slots: ["a", "b"] })).not.toBe(hashAuthoringPayload({ slots: ["b", "a"] }))
  })

  it("maps only drop-in price and publishes only for an explicit publish intent", () => {
    const input = { dropInPriceCents: 4200, firstClassPriceCents: 900, discountPriceCents: 500 }
    expect(mapInitialSpecialClassProjection({ ...input, intent: "save_draft" })).toEqual({
      currency: "usd", priceCents: 4200, status: "draft",
    })
    expect(mapInitialSpecialClassProjection({ ...input, intent: "publish" }).status).toBe("published")
  })

  it("blocks move, removal, and disable after any commitment", () => {
    expect(isGeneratedSlotMutationBlocked({ holds: 0, purchases: 0, attendances: 0 })).toBe(false)
    expect(isGeneratedSlotMutationBlocked({ holds: 1, purchases: 0, attendances: 0 })).toBe(true)
    expect(isGeneratedSlotMutationBlocked({ holds: 0, purchases: 1, attendances: 0 })).toBe(true)
    expect(isGeneratedSlotMutationBlocked({ holds: 0, purchases: 0, attendances: 1 })).toBe(true)
  })

  it("uses only the explicit operations switch, never course kind", () => {
    expect(shouldProjectSpecialClasses({ specialClassOperationsEnabled: false, kind: "workshop" })).toBe(false)
    expect(shouldProjectSpecialClasses({ specialClassOperationsEnabled: true, kind: "course" })).toBe(true)
  })
})
