import { describe, expect, it } from "vitest"

import { nextKioskInfoPhase, type KioskInfoPhase } from "./kiosk-info-phase"

describe("nextKioskInfoPhase", () => {
  const cases: Array<{
    current: KioskInfoPhase
    service: string
    expected: KioskInfoPhase | "done"
  }> = [
    { current: "name-email", service: "new-student", expected: "phone" },
    { current: "name-email", service: "drop-in", expected: "phone" },
    { current: "phone", service: "new-student", expected: "pin" },
    { current: "phone", service: "drop-in", expected: "done" },
    { current: "pin", service: "new-student", expected: "done" },
    { current: "pin", service: "drop-in", expected: "done" },
  ]

  it.each(cases)("moves $current with $service to $expected", ({ current, service, expected }) => {
    expect(nextKioskInfoPhase(current, service)).toBe(expected)
  })
})
