import { clerkClient } from "@clerk/nextjs/server"
import { updateClerkUserIfMissing } from "@/lib/clerk-users"
import { prisma } from "@/lib/prisma"
import { isEmail, normalizePhone } from "@/lib/shared"
import { upsertUserByIdentifiers } from "@/lib/users"

type IdentityInput = { name?: string; email?: string; phone?: string }

const MIN_E164_DIGITS = 8
const MAX_E164_DIGITS = 15

type ClerkIdentity = {
  id: string
  firstName?: string | null
  lastName?: string | null
  primaryEmailAddress?: { emailAddress: string } | null
  primaryPhoneNumber?: { phoneNumber: string } | null
  primaryPhoneNumberId?: string | null
  phoneNumbers?: Array<{ id: string; phoneNumber: string }>
}

type IdentityDependencies = {
  users: {
    getUserList: (query: { emailAddress?: string[]; phoneNumber?: string[]; limit: number }) => Promise<{ data: ClerkIdentity[] }>
    createUser: (input: Record<string, unknown>) => Promise<ClerkIdentity>
    getUser?: (id: string) => Promise<ClerkIdentity>
  }
  upsertLocalUser: (input: {
    clerkId?: string
    email?: string
    name?: string
    phone?: string
  }) => Promise<{ id: string; clerkId?: string | null; stripeCustomerId?: string | null } | null>
  findLocalUsers?: (email: string, phone: string) => Promise<Array<{
    id: string
    clerkId: string | null
    stripeCustomerId: string | null
  }>>
  updateIfMissing?: (user: ClerkIdentity, input: IdentityInput) => Promise<void>
}

export type SpecialClassIdentityResult =
  | {
      ok: true
      clerkUserId: string
      dbUserId: string
      stripeCustomerId: string | null
      email: string
      phone: string
      name: string
    }
  | { ok: false; code: "INVALID_CONTACT" | "CONTACT_DETAILS_UNAVAILABLE" }

const normalizeContact = (input: IdentityInput) => {
  const name = input.name?.trim().replace(/\s+/g, " ") || ""
  const email = input.email?.trim().toLowerCase() || ""
  const phoneDigits = normalizePhone(input.phone) || ""
  const phone = input.phone?.trim().startsWith("+") && phoneDigits ? `+${phoneDigits}` : ""
  if (
    name.length < 2 ||
    name.length > 100 ||
    !isEmail(email) ||
    !phone ||
    phoneDigits.length < MIN_E164_DIGITS ||
    phoneDigits.length > MAX_E164_DIGITS
  ) return null
  return { name, email, phone }
}

const lookup = async (dependencies: IdentityDependencies, email: string, phone: string) => {
  const [emailResult, phoneResult] = await Promise.all([
    dependencies.users.getUserList({ emailAddress: [email], limit: 2 }),
    dependencies.users.getUserList({ phoneNumber: [phone], limit: 2 }),
  ])
  if (emailResult.data.length > 1 || phoneResult.data.length > 1) return { conflict: true as const }
  const emailUser = emailResult.data[0] || null
  const phoneUser = phoneResult.data[0] || null
  if (emailUser && phoneUser && emailUser.id !== phoneUser.id) return { conflict: true as const }
  return { conflict: false as const, user: emailUser || phoneUser }
}

const getDefaultDependencies = async (): Promise<IdentityDependencies> => {
  const client = await clerkClient()
  return {
    users: client.users as unknown as IdentityDependencies["users"],
    upsertLocalUser: upsertUserByIdentifiers,
    findLocalUsers: (email, phone) => prisma.user.findMany({
      where: { OR: [{ email }, { phone: normalizePhone(phone) }] },
      select: { id: true, clerkId: true, stripeCustomerId: true },
    }),
    updateIfMissing: (user, input) =>
      updateClerkUserIfMissing(user as Parameters<typeof updateClerkUserIfMissing>[0], input),
  }
}

export async function resolveSpecialClassIdentity(
  input: IdentityInput,
  injectedDependencies?: IdentityDependencies,
): Promise<SpecialClassIdentityResult> {
  const contact = normalizeContact(input)
  if (!contact) return { ok: false, code: "INVALID_CONTACT" }

  const dependencies = injectedDependencies || await getDefaultDependencies()
  const localMatches = dependencies.findLocalUsers
    ? await dependencies.findLocalUsers(contact.email, contact.phone)
    : []
  if (new Set(localMatches.map((user) => user.id)).size > 1) {
    return { ok: false, code: "CONTACT_DETAILS_UNAVAILABLE" }
  }

  let resolution = await lookup(dependencies, contact.email, contact.phone)
  if (resolution.conflict) return { ok: false, code: "CONTACT_DETAILS_UNAVAILABLE" }

  let clerkUser = resolution.user
  const localMatch = localMatches[0]
  if (!clerkUser && localMatch?.clerkId && dependencies.users.getUser) {
    clerkUser = await dependencies.users.getUser(localMatch.clerkId)
  }

  if (clerkUser && localMatch?.clerkId && localMatch.clerkId !== clerkUser.id) {
    return { ok: false, code: "CONTACT_DETAILS_UNAVAILABLE" }
  }

  if (!clerkUser) {
    try {
      clerkUser = await dependencies.users.createUser({
        emailAddress: [contact.email],
        phoneNumber: [contact.phone],
        firstName: contact.name.split(" ")[0],
        lastName: contact.name.split(" ").slice(1).join(" ") || undefined,
        skipPasswordRequirement: true,
      })
    } catch {
      resolution = await lookup(dependencies, contact.email, contact.phone)
      if (resolution.conflict || !resolution.user) {
        return { ok: false, code: "CONTACT_DETAILS_UNAVAILABLE" }
      }
      clerkUser = resolution.user
    }
  } else if (dependencies.updateIfMissing) {
    await dependencies.updateIfMissing(clerkUser, contact)
  }

  try {
    const dbUser = await dependencies.upsertLocalUser({
      clerkId: clerkUser.id,
      email: contact.email,
      name: contact.name,
      phone: contact.phone,
    })
    if (!dbUser || dbUser.clerkId !== clerkUser.id) {
      return { ok: false, code: "CONTACT_DETAILS_UNAVAILABLE" }
    }
    return {
      ok: true,
      clerkUserId: clerkUser.id,
      dbUserId: dbUser.id,
      stripeCustomerId: dbUser.stripeCustomerId || null,
      ...contact,
    }
  } catch {
    return { ok: false, code: "CONTACT_DETAILS_UNAVAILABLE" }
  }
}
