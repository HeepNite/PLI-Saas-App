import { prisma } from "@/lib/prisma"

export type UpsertUserInput = {
  clerkId?: string
  email?: string
  name?: string
  phone?: string
  stripeCustomerId?: string
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

  const or: { clerkId?: string; email?: string; phone?: string; stripeCustomerId?: string }[] = []
  if (clerkId) or.push({ clerkId })
  if (email) or.push({ email })
  // Include phone in identity lookup to prevent duplicates from same phone with different email
  if (phone) or.push({ phone })
  if (stripeCustomerId) or.push({ stripeCustomerId })

  const existing = or.length
    ? await prisma.user.findFirst({
        where: { OR: or },
      })
    : null

  const data: UpsertUserInput = {}
  if (clerkId) data.clerkId = clerkId
  if (email) data.email = email
  if (name) data.name = name
  if (phone) data.phone = phone
  if (stripeCustomerId) data.stripeCustomerId = stripeCustomerId

  if (existing) {
    // Only fill empty fields — do NOT overwrite existing identity data
    const updateData: Record<string, unknown> = {}
    if (!existing.clerkId && clerkId) updateData.clerkId = clerkId
    if (!existing.email && email) updateData.email = email
    if (!existing.name && name) updateData.name = name
    if (!existing.phone && phone) updateData.phone = phone
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

  // Require at least email or phone to create a new user
  if (!email && !phone) {
    return null
  }

  return prisma.user.create({
    data: {
      // Email is required by schema — use placeholder if only phone is available
      // Format: phone digits + timestamp to ensure uniqueness
      email: email || `phone-${phone}-${Date.now()}@placeholder.pli.local`,
      ...data,
    },
  })
}
