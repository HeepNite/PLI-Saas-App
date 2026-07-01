import { describe, expect, it } from "vitest"

import {
  STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS,
  shouldReserveStaffAssistantColumn,
} from "@/components/front/staff/useStaffAssistantRailLayout"

describe("staff assistant rail layout", () => {
  it("releases the assistant grid column immediately when the rail closes", () => {
    expect(shouldReserveStaffAssistantColumn(true)).toBe(false)
  })

  it("reserves the assistant grid column while the rail is open", () => {
    expect(shouldReserveStaffAssistantColumn(false)).toBe(true)
  })

  it("keeps rail timing visual-only without an artificial layout handoff", () => {
    expect(STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS).toBe(240)
  })
})
