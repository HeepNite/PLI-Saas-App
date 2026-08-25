import { createHash, randomBytes, randomInt } from "crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const DRAFT_TTL_MS = 15 * 60_000
const TICKET_TTL_MS = 10 * 60_000
const DRAFT_CODE_PATTERN = /^PLI-(?:([1-9]\d*)-)?\d{4}$/
const TICKET_CODE_PATTERN = /^[A-Z0-9_-]{12}$/
const DRAFT_CODE_SPACE = 10_000

type RecoveryIdentity = { phone: string; email?: string; name?: string }

const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const draftCode = (namespace: number, value: number) =>
  namespace === 0
    ? `PLI-${value.toString().padStart(4, "0")}`
    : `PLI-${namespace}-${value.toString().padStart(4, "0")}`
const opaqueTicket = () => randomBytes(9).toString("base64url").toUpperCase().slice(0, 12)
const correlationId = () => randomBytes(12).toString("base64url")
const isCodeHashCollision = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002"

export const normalizeRecoveryCode = (value: unknown) => {
  if (typeof value !== "string") return null
  const code = value.trim().toUpperCase()
  const draftMatch = code.match(DRAFT_CODE_PATTERN)
  if (draftMatch) return code
  return TICKET_CODE_PATTERN.test(code) ? code : null
}

export async function scrubExpiredRecoveryRecords(now = new Date()) {
  await prisma.studentRecoveryTicket.updateMany({
    where: { status: { in: ["issued", "processing"] }, expiresAt: { lte: now } },
    data: { status: "expired", invalidatedAt: now, tokenHash: null },
  })
  await prisma.studentRecoveryDraft.updateMany({
    where: { status: { in: ["issued", "ticket_issued"] }, expiresAt: { lte: now } },
    data: { status: "expired", invalidatedAt: now, codeHash: null, phone: null, email: null, name: null },
  })
}

export async function issueRecoveryDraft(identity: RecoveryIdentity, source: string) {
  await scrubExpiredRecoveryRecords()
  for (let namespace = 0; ; namespace += 1) {
    const firstCandidate = randomInt(DRAFT_CODE_SPACE)
    for (let offset = 0; offset < DRAFT_CODE_SPACE; offset += 1) {
      const code = draftCode(namespace, (firstCandidate + offset) % DRAFT_CODE_SPACE)
      try {
        await prisma.studentRecoveryDraft.create({
          data: {
            codeHash: digest(code),
            recoveryCodeNamespace: namespace,
            correlationId: correlationId(),
            phone: identity.phone,
            email: identity.email || null,
            name: identity.name || null,
            source,
            expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
          },
        })
        return code
      } catch (error) {
        if (!isCodeHashCollision(error)) throw error
      }
    }
  }
}

export async function lookupRecoveryDraft(code: string) {
  await scrubExpiredRecoveryRecords()
  const draft = await prisma.studentRecoveryDraft.findUnique({
    where: { codeHash: digest(code) },
    select: { id: true, correlationId: true, phone: true, email: true, name: true, status: true, expiresAt: true },
  })
  if (!draft || draft.status !== "issued" || draft.expiresAt <= new Date()) return null
  return draft
}

export async function issueRecoveryTicket(draftId: string, staffClerkId: string) {
  await scrubExpiredRecoveryRecords()
  const now = new Date()
  const token = opaqueTicket()
  const ticket = await prisma.$transaction(async (tx) => {
    const claimed = await tx.studentRecoveryDraft.updateMany({
      where: { id: draftId, status: "issued", expiresAt: { gt: now } },
      data: { status: "ticket_issued" },
    })
    if (claimed.count !== 1) return null
    return tx.studentRecoveryTicket.create({
      data: {
        draftId,
        tokenHash: digest(token),
        correlationId: correlationId(),
        staffClerkId,
        expiresAt: new Date(Date.now() + TICKET_TTL_MS),
      },
    })
  })
  if (!ticket) return null
  return { token, correlationId: ticket.correlationId }
}

export async function reserveRecoveryTicket(token: string, staffClerkId?: string) {
  const now = new Date()
  await scrubExpiredRecoveryRecords(now)
  const ticket = await prisma.studentRecoveryTicket.findUnique({
    where: { tokenHash: digest(token) },
    include: { draft: true },
  })
  if (!ticket || !ticket.draft.phone || ticket.status !== "issued" || ticket.expiresAt <= now || ticket.draft.status !== "ticket_issued" || ticket.draft.expiresAt <= now) return null
  if (staffClerkId && ticket.staffClerkId !== staffClerkId) {
    await invalidateRecoveryTicket(token, ticket.staffClerkId)
    return null
  }
  const draft = { ...ticket.draft, phone: ticket.draft.phone }
  const reserved = await prisma.studentRecoveryTicket.updateMany({
    where: { id: ticket.id, status: "issued", expiresAt: { gt: now }, ...(staffClerkId ? { staffClerkId } : {}) },
    data: { status: "processing" },
  })
  if (reserved.count !== 1) return null
  return { ticketId: ticket.id, draftId: ticket.draftId, draft, correlationId: ticket.correlationId, staffClerkId: ticket.staffClerkId }
}

export async function releaseRecoveryTicket(ticketId: string) {
  await prisma.studentRecoveryTicket.updateMany({
    where: { id: ticketId, status: "processing" },
    data: { status: "issued" },
  })
}

export async function invalidateRecoveryDraft(code: string) {
  const now = new Date()
  const draft = await prisma.studentRecoveryDraft.findUnique({
    where: { codeHash: digest(code) },
    select: { id: true },
  })
  if (!draft) return false

  await prisma.$transaction(async (tx) => {
    await tx.studentRecoveryTicket.updateMany({
      where: { draftId: draft.id, status: { in: ["issued", "processing"] } },
      data: { status: "invalidated", invalidatedAt: now, tokenHash: null },
    })
    await tx.studentRecoveryDraft.updateMany({
      where: { id: draft.id, status: { in: ["issued", "ticket_issued"] } },
      data: { status: "invalidated", invalidatedAt: now, codeHash: null, phone: null, email: null, name: null },
    })
  })
  return true
}

export async function invalidateRecoveryTicket(token: string, staffClerkId: string) {
  const ticket = await prisma.studentRecoveryTicket.findFirst({
    where: { tokenHash: digest(token), staffClerkId, status: { in: ["issued", "processing"] } },
    select: { id: true, draftId: true },
  })
  if (!ticket) return false

  const now = new Date()
  const invalidated = await prisma.$transaction(async (tx) => {
    const result = await tx.studentRecoveryTicket.updateMany({
      where: { id: ticket.id, status: { in: ["issued", "processing"] } },
      data: { status: "invalidated", invalidatedAt: now, tokenHash: null },
    })
    if (result.count === 1) await tx.studentRecoveryDraft.updateMany({
      where: { id: ticket.draftId, status: "ticket_issued" },
      data: { status: "invalidated", invalidatedAt: now, codeHash: null, phone: null, email: null, name: null },
    })
    return result.count === 1
  })
  return invalidated
}

export async function consumeRecoveryTicket(ticketId: string, draftId: string, tx: Prisma.TransactionClient) {
  const now = new Date()
  const consumed = await tx.studentRecoveryTicket.updateMany({
    where: { id: ticketId, status: "processing", expiresAt: { gt: now } },
    data: { status: "consumed", consumedAt: now },
  })
  if (consumed.count !== 1) return false
  await tx.studentRecoveryTicket.update({ where: { id: ticketId }, data: { tokenHash: null } })
  await tx.studentRecoveryDraft.updateMany({
    where: { id: draftId, status: "ticket_issued" },
    data: { status: "completed", invalidatedAt: now, codeHash: null, phone: null, email: null, name: null },
  })
  return true
}
