import type { ClerkClient } from "@clerk/backend"
import { upsertUserByIdentifiers } from "@/lib/users"

type ClerkUser = Awaited<ReturnType<ClerkClient["users"]["getUser"]>>
type ClerkWebhookUser = {
  id: string
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  username?: string | null
  email_addresses?: Array<{ id: string; email_address?: string | null }> | null
  primary_email_address_id?: string | null
  phone_numbers?: Array<{ id: string; phone_number?: string | null }> | null
  primary_phone_number_id?: string | null
}

type CanonicalClerkUser = ClerkUser | ClerkWebhookUser

const pickPrimaryValue = (
  items: Array<{ id?: string; value?: string | null }> | undefined,
  primaryId: string | undefined,
) => {
  const primaryMatch = items?.find((item) => item.id === primaryId)?.value
  if (primaryMatch) return primaryMatch
  return items?.find((item) => Boolean(item.value))?.value || undefined
}

export const resolveCanonicalClerkName = (user: CanonicalClerkUser): string | undefined => {
  const firstName = "firstName" in user ? user.firstName : user.first_name
  const lastName = "lastName" in user ? user.lastName : user.last_name
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  if (fullName) return fullName

  const rawFullName = "fullName" in user ? user.fullName : user.full_name
  const unsafeFullName = typeof rawFullName === "string" ? rawFullName.trim() : ""
  if (unsafeFullName) return unsafeFullName

  if (user.username) return user.username
  return undefined
}

/**
 * Extract canonical identity values from a Clerk user (supports both API shape and webhook shape).
 */
export const extractClerkIdentity = (user: CanonicalClerkUser) => {
  const camelEmails = "emailAddresses" in user
    ? user.emailAddresses?.map((email) => ({ id: email.id, value: email.emailAddress }))
    : undefined
  const snakeEmails = "email_addresses" in user
    ? user.email_addresses?.map((email) => ({ id: email.id, value: email.email_address }))
    : undefined
  const email =
    ("primaryEmailAddress" in user ? user.primaryEmailAddress?.emailAddress : undefined) ||
    pickPrimaryValue(camelEmails, "primaryEmailAddressId" in user ? user.primaryEmailAddressId || undefined : undefined) ||
    pickPrimaryValue(snakeEmails, "primary_email_address_id" in user ? user.primary_email_address_id || undefined : undefined)

  const camelPhones = "phoneNumbers" in user
    ? user.phoneNumbers?.map((phone) => ({ id: phone.id, value: phone.phoneNumber }))
    : undefined
  const snakePhones = "phone_numbers" in user
    ? user.phone_numbers?.map((phone) => ({ id: phone.id, value: phone.phone_number }))
    : undefined
  const phone =
    ("primaryPhoneNumber" in user ? user.primaryPhoneNumber?.phoneNumber : undefined) ||
    pickPrimaryValue(camelPhones, "primaryPhoneNumberId" in user ? user.primaryPhoneNumberId || undefined : undefined) ||
    pickPrimaryValue(snakePhones, "primary_phone_number_id" in user ? user.primary_phone_number_id || undefined : undefined)

  return {
    clerkId: user.id,
    name: resolveCanonicalClerkName(user),
    email: email || undefined,
    phone: phone || undefined,
  }
}

export async function syncDbUserFromClerkUser(user: CanonicalClerkUser, options?: { skipPhone?: boolean }) {
  const identity = extractClerkIdentity(user)
  return upsertUserByIdentifiers({
    clerkId: identity.clerkId,
    email: identity.email,
    name: identity.name,
    phone: options?.skipPhone ? undefined : identity.phone,
    nameIsCanonical: true,
  })
}
