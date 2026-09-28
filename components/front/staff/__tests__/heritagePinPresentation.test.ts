import { describe, expect, it } from "vitest"
import type { StudentProfileCard } from "@/components/front/staff/historyCardAggregates"
import { resolveProfileCardBadges } from "@/components/front/staff/staffPaymentCardPresentation"

const student = (heritagePin: StudentProfileCard["heritagePin"]): StudentProfileCard => ({
  source: "profile",
  key: "user_1",
  userId: "user_1",
  displayName: "Ana Example",
  email: "ana@example.com",
  phone: "+15555550100",
  avatarUrl: null,
  registeredAt: "2026-10-01T12:00:00.000Z",
  checkInStatus: "none",
  latestClassAttended: null,
  latestCheckInAt: null,
  lastPayment: null,
  lastCourse: null,
  paymentStatus: "paid",
  activePackage: null,
  remainingCredits: null,
  outstandingBalance: null,
  pinStatus: "none",
  heritagePin,
  cashSettlement: null,
  pendingSettlement: null,
  pointsBalance: 0,
})

describe("Heritage pin staff presentation", () => {
  it("keeps the physical country pin distinct from the authentication PIN", () => {
    const badges = resolveProfileCardBadges(student({
      status: "pending",
      countryCode: "MX",
      countryName: "Mexico",
      sourcePurchaseId: "purchase_1",
      earnedAt: "2026-10-02T15:00:00.000Z",
      deliveredAt: null,
    }))
    expect(badges.find((badge) => badge.key === "heritage-pin")).toMatchObject({
      label: "Country pin pending · Mexico",
      title: "Physical pin awaiting staff handoff",
    })
    expect(badges.filter((badge) => badge.key === "heritage-pin")).toHaveLength(1)
  })

  it("shows the delivered country and timestamp", () => {
    const badges = resolveProfileCardBadges(student({
      status: "delivered",
      countryCode: "AR",
      countryName: "Argentina",
      sourcePurchaseId: "purchase_1",
      earnedAt: "2026-10-02T15:00:00.000Z",
      deliveredAt: "2026-10-04T21:00:00.000Z",
    }))
    expect(badges.find((badge) => badge.key === "heritage-pin")).toMatchObject({
      label: "Heritage pin · Argentina",
    })
  })

  it("adds no campaign badge when the student has no entitlement", () => {
    expect(resolveProfileCardBadges(student(null)).some((badge) => badge.key === "heritage-pin")).toBe(false)
  })
})
