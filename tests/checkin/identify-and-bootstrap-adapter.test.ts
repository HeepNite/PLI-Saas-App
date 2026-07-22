import { describe, expect, it } from "vitest"
import { adaptIdentifyAndBootstrapResponse } from "@/lib/checkin/identify-and-bootstrap-adapter"
import type {
  FastPathResponse,
  FullPathResponse,
} from "@/lib/checkin/types/identify-and-bootstrap"

const CONTEXT = {
  courseSlug: "salsa",
  courseTitle: "Salsa",
  date: "2026-06-01",
  time: "11:00",
  durationMinutes: 60,
  startsAt: "2026-06-01T15:00:00.000Z",
  endsAt: "2026-06-01T16:00:00.000Z",
  checkInWindow: { isOpen: true, opensAt: "2026-06-01T13:00:00.000Z", closesAt: "2026-06-01T18:00:00.000Z" },
}

const FAST: FastPathResponse = {
  identified: true,
  path: "fast",
  sessionToken: "kiosk_session_fast",
  sessionExpiresAt: "2026-03-31T15:00:00.000Z",
  customer: {
    userId: "user_1",
    name: "Jane Student",
    email: "jane@example.com",
    phone: "15551112222",
  },
  package: {
    id: "pkg_1",
    packageId: "pkg_plan_1",
    packageLabel: "Starter",
    courseSlug: "salsa",
    isUnlimited: false,
    remainingCredits: 4,
    expiresAt: null,
    status: "active",
  },
  context: CONTEXT,
  hasExistingPurchaseForSession: false,
  hasAnyActivePackage: true,
  consecutiveOffer: null,
  quickCheckout: null,
}

const FULL: FullPathResponse = {
  identified: true,
  path: "full",
  sessionToken: "kiosk_session_full",
  sessionExpiresAt: "2026-03-31T15:00:00.000Z",
  customer: {
    userId: "user_2",
    clerkUserId: "clerk_1",
    firstName: "Jane",
    lastName: "Student",
    name: "Jane Student",
    email: "jane@example.com",
    phone: "15551112222",
    hasAvatar: true,
  },
  package: null,
  context: CONTEXT,
  hasExistingPurchaseForSession: false,
  hasAnyActivePackage: false,
  consecutiveOffer: null,
  quickCheckout: null,
}

describe("adaptIdentifyAndBootstrapResponse", () => {
  it("maps the fast-path response into BootstrapResponse shape at parity", () => {
    const result = adaptIdentifyAndBootstrapResponse(FAST)

    expect(result.context).toEqual(CONTEXT)
    expect(result.customer.userId).toBe("user_1")
    expect(result.customer.name).toBe("Jane Student")
    expect(result.customer.clerkUserId).toBe("")
    expect(result.customer.hasAvatar).toBe(false)
    expect(result.package).toEqual(FAST.package)
    expect(result.hasAnyActivePackage).toBe(true)
    expect(result.hasExistingPurchaseForSession).toBe(false)
    expect(result.consecutiveOffer).toBeNull()
    expect(result.quickCheckout).toBeNull()
    // Fields not returned by identify-and-bootstrap default to empty/false —
    // none of these are read by the check-in UI today.
    expect(result.packages).toEqual([])
    expect(result.purchaseHistory).toEqual([])
    expect(result.hasPreviousPurchase).toBe(false)
    expect(result.hasAnyCompletedPurchase).toBe(false)
  })

  it("maps the full-path response, passing through the already-complete customer shape", () => {
    const result = adaptIdentifyAndBootstrapResponse(FULL)

    expect(result.customer).toEqual(FULL.customer)
    expect(result.hasAnyActivePackage).toBe(false)
    expect(result.package).toBeNull()
  })
})
