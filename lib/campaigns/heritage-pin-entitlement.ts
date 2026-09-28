import { Prisma, type PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  HERITAGE_PIN_CAMPAIGN_KEY,
  buildPendingHeritagePinMetadata,
  resolveHeritagePinAwardCountry,
  selectHeritagePinEntitlement,
  type HeritagePinEntitlement,
} from "@/lib/campaigns/heritage-pin"

export type HeritagePinDb = Pick<PrismaClient, "purchase">

const entitlementWhere = (userId: string): Prisma.PurchaseWhereInput => ({
  userId,
  metadata: {
    path: ["heritagePinCampaign"],
    equals: HERITAGE_PIN_CAMPAIGN_KEY,
  },
})

export const findHeritagePinEntitlementForUser = async (
  db: HeritagePinDb,
  userId: string,
): Promise<HeritagePinEntitlement | null> => {
  if (!userId) return null
  const purchases = await db.purchase.findMany({
    where: entitlementWhere(userId),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, userId: true, metadata: true, createdAt: true },
  })
  return selectHeritagePinEntitlement(purchases)
}

export const buildHeritagePinEntitlementsByUser = (
  purchases: ReadonlyArray<{ id: string; userId: string; metadata: unknown; createdAt: Date | string }>,
) => {
  const grouped = new Map<string, Array<{ id: string; userId: string; metadata: unknown; createdAt: Date | string }>>()
  for (const purchase of purchases) {
    const bucket = grouped.get(purchase.userId)
    if (bucket) bucket.push(purchase)
    else grouped.set(purchase.userId, [purchase])
  }

  const result = new Map<string, HeritagePinEntitlement>()
  for (const [userId, userPurchases] of grouped) {
    const entitlement = selectHeritagePinEntitlement(userPurchases)
    if (entitlement) result.set(userId, entitlement)
  }
  return result
}

export const awardHeritagePinFromPaidPurchase = async (input: {
  userId: string
  purchaseId: string
  metadata: unknown
  settledAt: Date
}) => {
  const countryCode = resolveHeritagePinAwardCountry(input.metadata, input.settledAt)
  if (!countryCode) return null

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`)

    const existingPurchases = await tx.purchase.findMany({
      where: entitlementWhere(input.userId),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, userId: true, metadata: true, createdAt: true },
    })
    const existing = selectHeritagePinEntitlement(existingPurchases)
    if (existing) return existing

    const sourcePurchase = await tx.purchase.findFirst({
      where: { id: input.purchaseId, userId: input.userId, status: "paid" },
      select: { id: true, userId: true, metadata: true, createdAt: true },
    })
    if (!sourcePurchase) return null

    const metadata = buildPendingHeritagePinMetadata(sourcePurchase.metadata, {
      countryCode,
      earnedAt: input.settledAt,
    })
    const updated = await tx.purchase.update({
      where: { id: sourcePurchase.id },
      data: { metadata: metadata as Prisma.InputJsonValue },
      select: { id: true, userId: true, metadata: true, createdAt: true },
    })
    return selectHeritagePinEntitlement([updated])
  })
}
