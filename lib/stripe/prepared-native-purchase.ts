import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"

export const PREPARED_NATIVE_PURCHASE_TTL_MS = 5 * 60_000
const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{43}$/

type Caller = { terminalId: string; sessionId: string }
type IssueInput = Caller & { purchaseId: string }

export class PreparedNativePurchaseError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_reference" | "unavailable",
    readonly status: 400 | 409,
  ) {
    super(message)
    this.name = "PreparedNativePurchaseError"
  }
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const unavailable = () => new PreparedNativePurchaseError("Prepared purchase is unavailable", "unavailable", 409)

function requireReference(value: unknown): string {
  if (typeof value !== "string" || !REFERENCE_PATTERN.test(value)) {
    throw new PreparedNativePurchaseError("Prepared purchase is unavailable", "invalid_reference", 400)
  }
  return value
}

export async function issuePreparedNativePurchase({ purchaseId, terminalId, sessionId }: IssueInput) {
  const reference = randomBytes(32).toString("base64url")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + PREPARED_NATIVE_PURCHASE_TTL_MS)
  const existing = await prisma.preparedNativePurchase.findUnique({ where: { purchaseId } })

  if (existing) {
    if (existing.consumedAt || existing.terminalId !== terminalId || existing.sessionId !== sessionId || existing.expiresAt > now) throw unavailable()
    const rotated = await prisma.preparedNativePurchase.updateMany({
      where: { id: existing.id, terminalId, sessionId, consumedAt: null, expiresAt: { lte: now } },
      data: { referenceHash: digest(reference), expiresAt },
    })
    if (rotated.count !== 1) throw unavailable()
    return reference
  }

  await prisma.preparedNativePurchase.create({
    data: { purchaseId, terminalId, sessionId, referenceHash: digest(reference), expiresAt },
  })
  return reference
}

export async function consumePreparedNativePurchase(reference: unknown, caller: Caller) {
  const referenceHash = digest(requireReference(reference))
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.preparedNativePurchase.updateMany({
      where: {
        referenceHash,
        terminalId: caller.terminalId,
        sessionId: caller.sessionId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    })
    if (consumed.count !== 1) throw unavailable()

    const prepared = await tx.preparedNativePurchase.findUnique({
      where: { referenceHash },
      select: { purchaseId: true },
    })
    if (!prepared) throw unavailable()
    return { purchaseId: prepared.purchaseId }
  })
}
