export type ProfileFormState = {
  firstName: string
  lastName: string
  birthDate: string
  emergencyContactName: string
  emergencyContactRelation: string
  emergencyContactPhone: string
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

export const toDateInput = (value?: string | Date | null) => {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

export const buildProfileFormState = (profile: any, user: any): ProfileFormState => ({
  firstName: profile?.firstName || user?.firstName || user?.first_name || "",
  lastName: profile?.lastName || user?.lastName || user?.last_name || "",
  birthDate: toDateInput(profile?.birthDate),
  emergencyContactName: profile?.emergencyContactName || "",
  emergencyContactRelation: profile?.emergencyContactRelation || "",
  emergencyContactPhone: profile?.emergencyContactPhone || "",
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
