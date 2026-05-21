import { describe, expect, it } from "vitest"

import { buildCheckInUserLookupCriteria } from "@/app/api/staff/checkin/shared"

describe("staff checkin shared helpers", () => {
  it("builds criteria with clerkId and email preserving order", () => {
    expect(
      buildCheckInUserLookupCriteria({
        userClerkId: "clerk_123",
        email: "test@example.com",
      })
    ).toEqual([{ clerkId: "clerk_123" }, { email: "test@example.com" }])
  })

  it("returns empty criteria when no lookup fields are provided", () => {
    expect(buildCheckInUserLookupCriteria({})).toEqual([])
  })
})
