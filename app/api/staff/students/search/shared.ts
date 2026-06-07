import { asText } from "@/app/api/staff/payments/shared"

export type ClerkUserData = {
  firstName: string | null
  lastName: string | null
  primaryEmailAddress: { emailAddress: string } | null
  primaryPhoneNumber: { phoneNumber: string } | null
  imageUrl: string | null
  hasImage: boolean
}

export type IdentityInput = {
  name: string | null
  email: string
  phone: string | null
  purchases: Array<{ name: string | null }>
}

const buildClerkDisplayName = (clerkData: ClerkUserData | null) => {
  if (!clerkData) return ""
  return [clerkData.firstName, clerkData.lastName].map((value) => asText(value)).filter(Boolean).join(" ")
}

export const resolveStudentIdentity = (
  user: IdentityInput,
  clerkData: ClerkUserData | null
): {
  displayName: string
  email: string
  phone: string | null
  avatarUrl: string | null
} => {
  const clerkName = buildClerkDisplayName(clerkData)
  const purchaseName = user.purchases.map((purchase) => asText(purchase.name)).find(Boolean) || ""
  const displayName = clerkName || asText(user.name) || purchaseName || asText(user.email)
  const email = asText(clerkData?.primaryEmailAddress?.emailAddress) || asText(user.email)
  const phone = asText(clerkData?.primaryPhoneNumber?.phoneNumber) || asText(user.phone) || null
  const avatarUrl = clerkData?.hasImage && asText(clerkData.imageUrl) ? clerkData.imageUrl : null

  return {
    displayName,
    email,
    phone,
    avatarUrl,
  }
}
