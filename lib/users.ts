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

  if (!clerkId && !email) {
    return null
  }

  const or: { clerkId?: string; email?: string; stripeCustomerId?: string }[] = []
  if (clerkId) or.push({ clerkId })
  if (email) or.push({ email })
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
    return prisma.user.update({
      where: { id: existing.id },
      data,
    })
  }

  if (!email) {
    return null
  }

  return prisma.user.create({
    data: {
      email,
      ...data,
    },
  })
}
