import { isEmail } from "@/lib/shared"
import { buildExactPhoneLookup, type PhoneParseResult } from "@/lib/phone"
type Identity = { id: string }
type LocalIdentity = Identity & { clerkId: string | null }
export type ExactIdentitySnapshot<TClerk extends Identity, TLocal extends LocalIdentity> = {
  clerkEmailMatches: TClerk[]
  clerkPhoneMatches: TClerk[]
  localEmailMatches: TLocal[]
  localPhoneMatches: TLocal[]
}
export type ExactIdentityResolution<TClerk extends Identity, TLocal extends LocalIdentity> =
  | { kind: "new"; clerkIdentity: TClerk | null }
  | { kind: "reused"; clerkIdentity: TClerk; localIdentity: TLocal }
  | { kind: "conflict" }
export type ExactContactInput = {
  email: string
  phone: string
  name?: string
  firstName?: string
  lastName?: string
}
type ExactLookup = {
  email: string
  phone: { e164: string; digitCandidates: string[] }
}
export type ExactAccountDependencies<TClerk extends Identity, TLocal extends LocalIdentity> = {
  parsePhone: (input: string) => PhoneParseResult
  readSnapshot: (lookup: ExactLookup) => Promise<ExactIdentitySnapshot<TClerk, TLocal>>
  mutateClerkAfterExactRead: (existing: TClerk | null, input: ExactContactInput) => Promise<TClerk>
  upsertLocalIdentity: (input: ExactContactInput & { clerkId: string }) => Promise<TLocal>
}
export type ExactAccountResult<TClerk extends Identity, TLocal extends LocalIdentity> =
  | {
      ok: true
      outcome: "created" | "reused"
      clerkIdentity: TClerk
      localIdentity: TLocal
    }
  | { ok: false; code: "INVALID_CONTACT" | "CONTACT_DETAILS_UNAVAILABLE" }
const uniqueById = <T extends Identity>(matches: T[]): T[] =>
  [...new Map(matches.map((match) => [match.id, match])).values()]
export function resolveExactIdentity<TClerk extends Identity, TLocal extends LocalIdentity>(
  snapshot: ExactIdentitySnapshot<TClerk, TLocal>,
): ExactIdentityResolution<TClerk, TLocal> {
  const clerkMatches = uniqueById([...snapshot.clerkEmailMatches, ...snapshot.clerkPhoneMatches])
  const localMatches = uniqueById([...snapshot.localEmailMatches, ...snapshot.localPhoneMatches])

  if (clerkMatches.length > 1 || localMatches.length > 1) return { kind: "conflict" }

  const clerkIdentity = clerkMatches[0] || null
  const localIdentity = localMatches[0] || null
  if (!localIdentity) return { kind: "new", clerkIdentity }
  if (!clerkIdentity || localIdentity.clerkId !== clerkIdentity.id) {
    return { kind: "conflict" }
  }
  return { kind: "reused", clerkIdentity, localIdentity }
}
export const createSafeClerkMutation = <TClerk extends Identity>(
  users: { createUser: (input: Record<string, unknown>) => Promise<TClerk> },
  updateExisting: (user: TClerk, input: ExactContactInput) => Promise<void>,
) => async (existing: TClerk | null, input: ExactContactInput): Promise<TClerk> => {
  if (existing) {
    await updateExisting(existing, input)
    return existing
  }

  const nameParts = input.name?.trim().split(/\s+/) || []
  return users.createUser({
    emailAddress: [input.email],
    phoneNumber: [input.phone],
    firstName: input.firstName?.trim() || nameParts.shift() || undefined,
    lastName: input.lastName?.trim() || nameParts.join(" ") || undefined,
    skipPasswordRequirement: true,
  })
}
const unavailable = { ok: false, code: "CONTACT_DETAILS_UNAVAILABLE" } as const
export async function ensureExactAccountIdentity<TClerk extends Identity, TLocal extends LocalIdentity>(
  input: ExactContactInput,
  dependencies: ExactAccountDependencies<TClerk, TLocal>,
): Promise<ExactAccountResult<TClerk, TLocal>> {
  const email = input.email.trim().toLowerCase()
  let parsed: PhoneParseResult
  try {
    parsed = dependencies.parsePhone(input.phone)
  } catch {
    return { ok: false, code: "INVALID_CONTACT" }
  }
  if (!isEmail(email) || !parsed.ok) return { ok: false, code: "INVALID_CONTACT" }

  const exactInput = { ...input, email, phone: parsed.phone.e164 }
  const lookup = { email, phone: buildExactPhoneLookup(parsed.phone) }
  const readResolution = async () =>
    resolveExactIdentity(await dependencies.readSnapshot(lookup))
  const safeReadResolution = async () => {
    try {
      return await readResolution()
    } catch {
      return null
    }
  }

  const resolution = await safeReadResolution()
  if (!resolution || resolution.kind === "conflict") return unavailable
  if (resolution.kind === "reused") {
    return {
      ok: true,
      outcome: "reused",
      clerkIdentity: resolution.clerkIdentity,
      localIdentity: resolution.localIdentity,
    }
  }

  let clerkIdentity: TClerk
  try {
    clerkIdentity = await dependencies.mutateClerkAfterExactRead(
      resolution.clerkIdentity,
      exactInput,
    )
  } catch {
    const afterRace = await safeReadResolution()
    if (!afterRace || afterRace.kind === "conflict" || !afterRace.clerkIdentity) return unavailable
    clerkIdentity = afterRace.clerkIdentity
  }

  const afterClerk = await safeReadResolution()
  if (!afterClerk || afterClerk.kind === "conflict" || afterClerk.clerkIdentity?.id !== clerkIdentity.id) {
    return unavailable
  }
  if (afterClerk.kind === "reused") {
    return {
      ok: true,
      outcome: "reused",
      clerkIdentity: afterClerk.clerkIdentity,
      localIdentity: afterClerk.localIdentity,
    }
  }

  let localIdentity: TLocal
  try {
    localIdentity = await dependencies.upsertLocalIdentity({
      ...exactInput,
      clerkId: clerkIdentity.id,
    })
  } catch {
    const afterRace = await safeReadResolution()
    if (!afterRace || afterRace.kind !== "reused" || afterRace.clerkIdentity.id !== clerkIdentity.id) {
      return unavailable
    }
    return {
      ok: true,
      outcome: "reused",
      clerkIdentity: afterRace.clerkIdentity,
      localIdentity: afterRace.localIdentity,
    }
  }

  const finalResolution = await safeReadResolution()
  if (
    !finalResolution ||
    finalResolution.kind !== "reused" ||
    finalResolution.clerkIdentity.id !== clerkIdentity.id ||
    finalResolution.localIdentity.id !== localIdentity.id ||
    localIdentity.clerkId !== clerkIdentity.id
  ) return unavailable
  return {
    ok: true,
    outcome: "created",
    clerkIdentity: finalResolution.clerkIdentity,
    localIdentity: finalResolution.localIdentity,
  }
}
