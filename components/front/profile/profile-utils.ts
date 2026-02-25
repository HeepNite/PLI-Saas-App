export type ProfileFormState = {
  firstName: string
  lastName: string
  birthDate: string
  emergencyContactName: string
  emergencyContactRelation: string
  emergencyContactPhone: string
  billingLine1: string
  billingLine2: string
  billingCity: string
  billingState: string
  billingPostalCode: string
  billingCountry: string
}

export type ProfileUserSnapshot = {
  email?: string
  phone?: string
}

export type ClerkUserSnapshot = {
  firstName?: string | null
  lastName?: string | null
  primaryEmailAddress?: { emailAddress?: string | null } | null
  primaryPhoneNumber?: { phoneNumber?: string | null } | null
}

export type ProfileSnapshot = {
  firstName?: string | null
  lastName?: string | null
  birthDate?: string | Date | null
  emergencyContactName?: string | null
  emergencyContactRelation?: string | null
  emergencyContactPhone?: string | null
  billingAddress?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  } | null
}

export type ProfileUserSource = ClerkUserSnapshot & {
  first_name?: string | null
  last_name?: string | null
}

export type PackageAssignmentSummaryInput = {
  isUnlimited: boolean
  totalCredits: number | null
  remainingCredits: number | null
  queuedCount: number
  assignedBookingsCount: number
}

export type PackageAssignmentSummary = {
  assigned: number
  remaining: number | null
  queued: number
  isUnlimited: boolean
}

export const toDateInput = (value?: string | Date | null) => {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

export const buildProfileFormState = (
  profile?: ProfileSnapshot | null,
  user?: ProfileUserSource | null
): ProfileFormState => ({
  firstName: profile?.firstName || user?.firstName || user?.first_name || "",
  lastName: profile?.lastName || user?.lastName || user?.last_name || "",
  birthDate: toDateInput(profile?.birthDate),
  emergencyContactName: profile?.emergencyContactName || "",
  emergencyContactRelation: profile?.emergencyContactRelation || "",
  emergencyContactPhone: profile?.emergencyContactPhone || "",
  billingLine1: profile?.billingAddress?.line1 || "",
  billingLine2: profile?.billingAddress?.line2 || "",
  billingCity: profile?.billingAddress?.city || "",
  billingState: profile?.billingAddress?.state || "",
  billingPostalCode: profile?.billingAddress?.postalCode || "",
  billingCountry: profile?.billingAddress?.country || "",
})

export const getProfileCompletionPercent = (form: ProfileFormState) => {
  const fields = [
    form.firstName,
    form.lastName,
    form.birthDate,
    form.emergencyContactName,
    form.emergencyContactRelation,
    form.emergencyContactPhone,
  ]
  const completed = fields.filter((value) => value && value.trim().length > 0).length
  return Math.round((completed / fields.length) * 100)
}

export const buildBookingPrefillContact = (
  form: ProfileFormState,
  profileUser: ProfileUserSnapshot,
  clerkUser?: ClerkUserSnapshot | null
) => ({
  firstName: form.firstName || clerkUser?.firstName || "",
  lastName: form.lastName || clerkUser?.lastName || "",
  email: profileUser.email || clerkUser?.primaryEmailAddress?.emailAddress || "",
  phone: profileUser.phone || clerkUser?.primaryPhoneNumber?.phoneNumber || "+1 ",
})

export const getPackageAssignmentSummary = (input: PackageAssignmentSummaryInput): PackageAssignmentSummary => {
  const queued = Math.max(0, input.queuedCount)
  if (input.isUnlimited) {
    return {
      assigned: Math.max(0, input.assignedBookingsCount) + queued,
      remaining: null,
      queued,
      isUnlimited: true,
    }
  }

  const totalCredits = Math.max(0, input.totalCredits ?? 0)
  const remainingCredits = Math.max(0, input.remainingCredits ?? 0)
  const assignedCredits = Math.max(0, totalCredits - remainingCredits)

  return {
    assigned: Math.min(totalCredits, assignedCredits + queued),
    remaining: Math.max(0, remainingCredits - queued),
    queued,
    isUnlimited: false,
  }
}
