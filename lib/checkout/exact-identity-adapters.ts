import type { ClerkClient } from "@clerk/backend"
import { updateClerkUserIfMissing, type ClerkUser } from "@/lib/clerk-users"
import { createSafeClerkMutation, type ExactAccountDependencies } from "@/lib/checkout/identity-safety"
import { buildExactPhoneLookup, parseCanonicalPhone, parseServerPhoneInput } from "@/lib/phone"
import { prisma } from "@/lib/prisma"
type LocalIdentity = { id: string; clerkId: string | null }
type ClerkUsers = ClerkClient["users"]
const readAllClerkMatches = async (
  users: ClerkUsers,
  filter: { emailAddress: string[] } | { phoneNumber: string[] },
): Promise<ClerkUser[]> => {
  const matches: ClerkUser[] = []
  for (let offset = 0; ;) {
    const page = await users.getUserList({ ...filter, limit: 100, offset })
    matches.push(...page.data); offset += page.data.length
    if (!page.data.length || typeof page.totalCount !== "number" || offset >= page.totalCount) return matches
  }
}
export const createCheckoutExactAccountDependencies = (
  client: ClerkClient,
  creation?: { occurred: boolean },
  knownClerkUser?: ClerkUser | null,
): ExactAccountDependencies<ClerkUser, LocalIdentity> => ({
  parsePhone: parseServerPhoneInput,
  readSnapshot: async ({ email, phone }) => {
    const [clerkEmailMatches, clerkPhoneMatches, localEmailMatches, localPhoneMatches] = await Promise.all([
      readAllClerkMatches(client.users, { emailAddress: [email] }),
      readAllClerkMatches(client.users, { phoneNumber: [phone.e164] }),
      prisma.user.findMany({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, clerkId: true } }),
      prisma.user.findMany({ where: { phone: { in: phone.digitCandidates } }, select: { id: true, clerkId: true } }),
    ])
    const knownEmail = knownClerkUser?.primaryEmailAddress?.emailAddress?.trim().toLowerCase()
    const knownPhone = knownClerkUser?.primaryPhoneNumber?.phoneNumber
    const parsedKnownPhone = knownPhone ? parseServerPhoneInput(knownPhone) : null
    if (knownClerkUser && knownEmail === email) clerkEmailMatches.push(knownClerkUser)
    if (knownClerkUser && parsedKnownPhone?.ok && parsedKnownPhone.phone.e164 === phone.e164) {
      clerkPhoneMatches.push(knownClerkUser)
    }
    return { clerkEmailMatches, clerkPhoneMatches, localEmailMatches, localPhoneMatches }
  },
  mutateClerkAfterExactRead: createSafeClerkMutation<ClerkUser>({
    createUser: async (input) => {
      const user = await client.users.createUser(input as Parameters<ClerkUsers["createUser"]>[0])
      if (creation) creation.occurred = true
      return user
    },
  }, (user, input) => updateClerkUserIfMissing(user, input)),
  upsertLocalIdentity: async (input) => {
    const parsed = parseCanonicalPhone(input.phone)
    if (!parsed.ok) throw new Error("Canonical phone became invalid")
    const existing = await prisma.user.findUnique({ where: { clerkId: input.clerkId } })
    if (existing && (existing.email.toLowerCase() !== input.email ||
      !buildExactPhoneLookup(parsed.phone).digitCandidates.includes(existing.phone || ""))) {
      throw new Error("Existing local identity is incompatible")
    }
    return prisma.user.upsert({
      where: { clerkId: input.clerkId }, update: { name: input.name },
      create: { clerkId: input.clerkId, email: input.email, name: input.name, phone: parsed.phone.digits },
    })
  },
})
