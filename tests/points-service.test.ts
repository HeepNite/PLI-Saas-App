import { describe, it, expect, vi } from "vitest"
import { awardPointsFromRule, getFreeClassThresholdPoints, getPointsBalance, resolvePointsRuleValue } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"

const buildDb = () => ({
  pointsRule: {
    findUnique: vi.fn(),
  },
  pointsLedger: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    aggregate: vi.fn(),
  },
})

describe("points service", () => {
  it("uses fallback values when points rule does not exist", async () => {
    const db = buildDb()
    db.pointsRule.findUnique.mockResolvedValue(null)
    const result = await resolvePointsRuleValue({
      db: db as never,
      ruleKey: POINTS_RULE_KEYS.PACKAGE_ASSIGNMENT,
    })
    expect(result.points).toBe(2.5)
    expect(result.eventType).toBe("PACKAGE_ASSIGNMENT")
  })

  it("skips award when rule is inactive", async () => {
    const db = buildDb()
    db.pointsRule.findUnique.mockResolvedValue({
      key: POINTS_RULE_KEYS.PROFILE_COMPLETED,
      points: 25,
      eventType: "PROFILE_COMPLETED",
      active: false,
    })
    const result = await awardPointsFromRule({
      db: db as never,
      userId: "u_1",
      ruleKey: POINTS_RULE_KEYS.PROFILE_COMPLETED,
      eventKey: "profile-completed:u_1",
    })
    expect(result.awarded).toBe(false)
    expect(db.pointsLedger.create).not.toHaveBeenCalled()
  })

  it("awards decimal points from active configured rule", async () => {
    const db = buildDb()
    db.pointsRule.findUnique.mockResolvedValue({
      key: POINTS_RULE_KEYS.PACKAGE_ASSIGNMENT,
      points: 2.5,
      eventType: "PACKAGE_ASSIGNMENT",
      active: true,
    })
    db.pointsLedger.create.mockResolvedValue({ id: "ledger_1" })
    const result = await awardPointsFromRule({
      db: db as never,
      userId: "u_1",
      ruleKey: POINTS_RULE_KEYS.PACKAGE_ASSIGNMENT,
      eventKey: "package-assignment:pkg_1",
    })
    expect(result.awarded).toBe(true)
    expect(result.points).toBe(2.5)
    expect(db.pointsLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u_1",
          points: 2.5,
          type: "PACKAGE_ASSIGNMENT",
        }),
      })
    )
  })

  it("returns duplicate without creating a ledger entry when event key already exists", async () => {
    const db = buildDb()
    db.pointsRule.findUnique.mockResolvedValue({
      key: POINTS_RULE_KEYS.PACKAGE_ASSIGNMENT,
      points: 2.5,
      eventType: "PACKAGE_ASSIGNMENT",
      active: true,
    })
    db.pointsLedger.findUnique.mockResolvedValue({ id: "ledger_existing" })

    const result = await awardPointsFromRule({
      db: db as never,
      userId: "u_1",
      ruleKey: POINTS_RULE_KEYS.PACKAGE_ASSIGNMENT,
      eventKey: "package-assignment:pkg_1",
    })

    expect(result).toEqual({
      awarded: false,
      points: 0,
      type: "PACKAGE_ASSIGNMENT",
      eventKey: "package-assignment:pkg_1",
      duplicate: true,
      skipped: false,
    })
    expect(db.pointsLedger.create).not.toHaveBeenCalled()
  })

  it("returns configured free-class threshold when present", async () => {
    const db = buildDb()
    db.pointsRule.findUnique.mockResolvedValue({
      key: POINTS_RULE_KEYS.FREE_CLASS_THRESHOLD,
      points: 350,
      eventType: "FREE_CLASS_THRESHOLD",
      active: true,
    })
    const threshold = await getFreeClassThresholdPoints(db as never)
    expect(threshold).toBe(350)
  })

  it("returns points balance sum", async () => {
    const db = buildDb()
    db.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 42.5 } })
    const balance = await getPointsBalance("u_1", db as never)
    expect(balance).toBe(42.5)
  })
})
