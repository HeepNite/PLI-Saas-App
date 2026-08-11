import { prisma } from "@/lib/prisma"
import { normalizePhone } from "@/lib/shared"
import type { PrismaTransaction } from "@/lib/audit/student-data-audit"

export type UpsertUserInput = {
  clerkId?: string
  email?: string
  name?: string
  phone?: string
  stripeCustomerId?: string
  /**
   * When true, `name` is treated as the authoritative identity name (e.g. from Clerk)
   * and can overwrite an existing user's name.
   * When false/omitted, `name` is only used to fill an empty name — never to overwrite.
   */
  nameIsCanonical?: boolean
}

type ExistingUser = {
  id: string
  clerkId: string | null
  email: string
  name: string | null
  phone: string | null
  stripeCustomerId: string | null
}

const normalize = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

export async function upsertUserByIdentifiers(input: UpsertUserInput, db: PrismaTransaction = prisma) {
  const clerkId = normalize(input.clerkId)
  const email = normalize(input.email)?.toLowerCase()
  const name = normalize(input.name)
  const phone = normalizePhone(input.phone)
  const stripeCustomerId = normalize(input.stripeCustomerId)

  if (!clerkId && !email && !phone) {
    return null
  }

  const byIdentity: { email?: string; phone?: string; stripeCustomerId?: string }[] = []
  if (email) byIdentity.push({ email })
  if (phone) byIdentity.push({ phone })
  if (stripeCustomerId) byIdentity.push({ stripeCustomerId })

  const existingByClerkId = clerkId
    ? await db.user.findUnique({
        where: { clerkId },
      })
    : null

  const identityMatches: ExistingUser[] = byIdentity.length
    ? await db.user.findMany({
        where: { OR: byIdentity },
        orderBy: { createdAt: "asc" },
      })
    : []

  const phoneUnlinkedMatch = phone
    ? identityMatches.find((candidate) => candidate.phone === phone && !candidate.clerkId)
    : undefined
  const emailUnlinkedMatch = email
    ? identityMatches.find((candidate) => candidate.email === email && !candidate.clerkId)
    : undefined
  const unlinkedMatch = identityMatches.find((candidate) => !candidate.clerkId)
  const linkedToDifferentClerk = clerkId
    ? identityMatches.find((candidate) => candidate.clerkId && candidate.clerkId !== clerkId)
    : undefined

  const existing = existingByClerkId || (clerkId
    ? phoneUnlinkedMatch || emailUnlinkedMatch || unlinkedMatch || linkedToDifferentClerk || null
    : identityMatches[0] || null)

  const data: UpsertUserInput = {}
  if (clerkId) data.clerkId = clerkId
  if (email) data.email = email
  if (name) data.name = name
  if (phone) data.phone = phone
  if (stripeCustomerId) data.stripeCustomerId = stripeCustomerId

  if (existing) {
    if (clerkId && existing.clerkId && existing.clerkId !== clerkId) {
      return existing
    }

    const shouldApplyCanonicalClerkData = Boolean(clerkId && (existing.clerkId === clerkId || !existing.clerkId))
    const updateData: Record<string, unknown> = {}

    if (!existing.clerkId && clerkId) updateData.clerkId = clerkId

    if (shouldApplyCanonicalClerkData && email && existing.email !== email) {
      updateData.email = email
    } else if (!existing.email && email) {
      updateData.email = email
    }

    if (input.nameIsCanonical && name && existing.name !== name) {
      updateData.name = name
    } else if (!existing.name && name) {
      updateData.name = name
    }

    if (shouldApplyCanonicalClerkData && phone && existing.phone !== phone) {
      updateData.phone = phone
    } else if (!existing.phone && phone) {
      updateData.phone = phone
    }

    if (!existing.stripeCustomerId && stripeCustomerId) {
      updateData.stripeCustomerId = stripeCustomerId
    }

    if (Object.keys(updateData).length > 0) {
      const user = await db.user.update({
        where: { id: existing.id },
        data: updateData,
      })
      return user
    }
    return existing
  }

  if (!email && !phone) {
    return null
  }

  const user = await db.user.create({
    data: {
      email: email || `phone-${phone}-${Date.now()}@placeholder.pli.local`,
      ...data,
    },
  })
}
