import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { DEFAULT_FREE_CLASS_THRESHOLD, getPointsRuleDefinition, POINTS_RULE_KEYS, type PointsRuleKey } from "@/lib/points/constants"

type PointsDbClient = typeof prisma | Prisma.TransactionClient

const isUniqueError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

const normalizeTypeFromKey = (ruleKey: string) =>
  ruleKey
    .replace(/-/g, "_")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .toUpperCase()

export async function resolvePointsRuleValue(options: {
  ruleKey: PointsRuleKey
  fallbackPoints?: number
  db?: PointsDbClient
  allowInactiveRuleFallback?: boolean
}) {
  const db = options.db || prisma
  const definition = getPointsRuleDefinition(options.ruleKey)
  const fallbackPoints = options.fallbackPoints ?? definition?.defaultPoints ?? 0
  const fallbackType = definition?.eventType || normalizeTypeFromKey(options.ruleKey)

  const rule = await db.pointsRule.findUnique({ where: { key: options.ruleKey } })
  if (!rule) {
    return {
      points: fallbackPoints,
      eventType: fallbackType,
      active: true,
      source: "fallback" as const,
      rule: null,
    }
  }

  if (!rule.active && !options.allowInactiveRuleFallback) {
    return {
      points: 0,
      eventType: rule.eventType || fallbackType,
      active: false,
      source: "rule" as const,
      rule,
    }
  }

  if (!rule.active && options.allowInactiveRuleFallback) {
    return {
      points: fallbackPoints,
      eventType: fallbackType,
      active: false,
      source: "fallback" as const,
      rule,
    }
  }

  return {
    points: Number.isFinite(rule.points) ? rule.points : fallbackPoints,
    eventType: rule.eventType || fallbackType,
    active: true,
    source: "rule" as const,
    rule,
  }
}

export async function awardPointsFromRule(options: {
  userId: string
  ruleKey: PointsRuleKey
  eventKey?: string | null
  fallbackPoints?: number
  fallbackType?: string
  meta?: Prisma.InputJsonValue
  db?: PointsDbClient
}) {
  const db = options.db || prisma
  const resolved = await resolvePointsRuleValue({
    ruleKey: options.ruleKey,
    fallbackPoints: options.fallbackPoints,
    db,
  })

  const points = resolved.points
  const type = options.fallbackType || resolved.eventType || normalizeTypeFromKey(options.ruleKey)
  const eventKey = options.eventKey || undefined

  if (!Number.isFinite(points) || points === 0) {
    return {
      awarded: false,
      points: 0,
      type,
      eventKey,
      skipped: true,
    }
  }

  try {
    await db.pointsLedger.create({
      data: {
        userId: options.userId,
        type,
        eventKey,
        points,
        meta: options.meta,
      },
    })
    return {
      awarded: true,
      points,
      type,
      eventKey,
      skipped: false,
    }
  } catch (error) {
    if (isUniqueError(error)) {
      return {
        awarded: false,
        points: 0,
        type,
        eventKey,
        duplicate: true,
        skipped: false,
      }
    }
    throw error
  }
}

export async function getPointsBalance(userId: string, db?: PointsDbClient) {
  const client = db || prisma
  const aggregate = await client.pointsLedger.aggregate({
    where: { userId },
    _sum: { points: true },
  })
  return aggregate._sum.points || 0
}

export async function getFreeClassThresholdPoints(db?: PointsDbClient) {
  const resolved = await resolvePointsRuleValue({
    ruleKey: POINTS_RULE_KEYS.FREE_CLASS_THRESHOLD,
    fallbackPoints: DEFAULT_FREE_CLASS_THRESHOLD,
    db,
    allowInactiveRuleFallback: true,
  })

  const safeThreshold = Number.isFinite(resolved.points) && resolved.points > 0 ? resolved.points : DEFAULT_FREE_CLASS_THRESHOLD
  return safeThreshold
}

