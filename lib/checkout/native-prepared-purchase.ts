import "server-only"
import { createHash } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { preparedNativeFulfillmentMetadata } from "@/lib/stripe/prepared-native-payment"

type Selection = {
  courseSlug: string
  courseTitle: string
  amount: number
  currency: string
  packageId: string
  serviceId: string
  addons: string[]
  participants: number
  coupon: string
}

type PurchaseRecord = {
  id: string
  userId: string
  courseSlug: string
  courseTitle: string | null
  amount: number
  currency: string
  status: string
  email: string | null
  name: string | null
  phone: string | null
  participants: number | null
  coupon: string | null
  packageId: string | null
  serviceId: string | null
  addonsCsv: string | null
  idempotencyKey: string | null
  metadata: unknown
}

export type NativePreparedPurchaseInput = {
  preparedContextId: string
  recipient: { userId: string; email: string; name: string | null; phone: string | null }
  selection: Selection
  fulfillmentMetadata: Record<string, string>
}

export class NativePreparedPurchaseError extends Error {
  constructor(
    readonly code: "mismatch",
    readonly status: 409 = 409,
  ) {
    super("Native prepared purchase is unavailable")
    this.name = "NativePreparedPurchaseError"
  }
}

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

const sameJson = (left: unknown, right: unknown) => stableJson(left) === stableJson(right)

const normalizeSelection = (selection: Selection): Selection => ({
  ...selection,
  currency: selection.currency.trim().toLowerCase(),
  packageId: selection.packageId.trim(),
  serviceId: selection.serviceId.trim(),
  addons: [...selection.addons].sort(),
  coupon: selection.coupon.trim().toUpperCase(),
})

export const buildNativePreparedPurchaseIdempotencyKey = ({ preparedContextId, selection }: Pick<NativePreparedPurchaseInput, "preparedContextId" | "selection">) =>
  `native-m2-prepared:${preparedContextId}:${createHash("sha256").update(stableJson(normalizeSelection(selection))).digest("hex")}`

const unavailable = () => new NativePreparedPurchaseError("mismatch")

const assertExactPurchase = (purchase: PurchaseRecord | null, expected: Omit<PurchaseRecord, "id">): PurchaseRecord => {
  if (!purchase ||
      purchase.userId !== expected.userId ||
      purchase.courseSlug !== expected.courseSlug ||
      purchase.courseTitle !== expected.courseTitle ||
      purchase.amount !== expected.amount ||
      purchase.currency !== expected.currency ||
      purchase.status !== expected.status ||
      purchase.email !== expected.email ||
      purchase.name !== expected.name ||
      purchase.phone !== expected.phone ||
      purchase.participants !== expected.participants ||
      purchase.coupon !== expected.coupon ||
      purchase.packageId !== expected.packageId ||
      purchase.serviceId !== expected.serviceId ||
      purchase.addonsCsv !== expected.addonsCsv ||
      purchase.idempotencyKey !== expected.idempotencyKey ||
      // Attempt annotations (decline reason, kiosk outcome, verify resolution) are not
      // fulfillment facts, so a recorded decline never blocks the idempotent reuse.
      !sameJson(preparedNativeFulfillmentMetadata(purchase.metadata), expected.metadata)) {
    throw unavailable()
  }
  return purchase
}

// A declined card-present attempt keeps its PaymentIntent collectible, so re-preparing the
// same context and selection reopens that Purchase (keeping its recorded decline) instead of
// creating a second one. Canceled and other terminal statuses stay unavailable.
async function reopenDeclinedPurchase(existing: PurchaseRecord, expected: Omit<PurchaseRecord, "id">) {
  assertExactPurchase(existing, { ...expected, status: "failed" })
  await prisma.purchase.updateMany({ where: { id: existing.id, status: "failed" }, data: { status: "pending" } })
  return assertExactPurchase(await prisma.purchase.findUnique({ where: { idempotencyKey: expected.idempotencyKey! } }), expected)
}

export async function createOrReuseNativePreparedPurchase(input: NativePreparedPurchaseInput) {
  const selection = normalizeSelection(input.selection)
  const idempotencyKey = buildNativePreparedPurchaseIdempotencyKey({ ...input, selection })
  const expected = {
    userId: input.recipient.userId,
    courseSlug: selection.courseSlug,
    courseTitle: selection.courseTitle || null,
    amount: selection.amount,
    currency: selection.currency,
    status: "pending",
    email: input.recipient.email || null,
    name: input.recipient.name,
    phone: input.recipient.phone,
    participants: selection.participants,
    coupon: selection.coupon || null,
    packageId: selection.packageId || null,
    serviceId: selection.serviceId || null,
    addonsCsv: selection.addons.join(",") || null,
    idempotencyKey,
    metadata: {
      ...input.fulfillmentMetadata,
      paymentSurface: "native_m2_prepare",
      preparedContextId: input.preparedContextId,
      recipientUserId: input.recipient.userId,
    },
  }

  const existing = await prisma.purchase.findUnique({ where: { idempotencyKey } })
  if (existing?.status === "failed") return reopenDeclinedPurchase(existing, expected)
  if (existing) return assertExactPurchase(existing, expected)

  try {
    const created = await prisma.purchase.create({ data: expected })
    return assertExactPurchase(created, expected)
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error
    return assertExactPurchase(await prisma.purchase.findUnique({ where: { idempotencyKey } }), expected)
  }
}
