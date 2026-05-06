import { prisma } from "@/lib/prisma"

export type UpsertUserInput = {
  clerkId?: string
  email?: string
  name?: string
  phone?: string
  stripeCustomerId?: string
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

const normalizePhone = (value: string | undefined) => {
  const digits = value?.replace(/\D/g, "")
  return digits && digits.length >= 6 ? digits : undefined
}

export async function upsertUserByIdentifiers(input: UpsertUserInput) {
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
    ? await prisma.user.findUnique({
        where: { clerkId },
      })
    : null

  const identityMatches: ExistingUser[] = byIdentity.length
    ? await prisma.user.findMany({
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

    if (shouldApplyCanonicalClerkData && name && existing.name !== name) {
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
      return prisma.user.update({
        where: { id: existing.id },
        data: updateData,
      })
    }
    return existing
  }

  if (!email && !phone) {
    return null
  }

  return prisma.user.create({
    data: {
      email: email || `phone-${phone}-${Date.now()}@placeholder.pli.local`,
      ...data,
    },
  })
}
