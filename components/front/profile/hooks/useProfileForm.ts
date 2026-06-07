import React from "react"
import type { ProfileFormState } from "../profile-utils"
import { buildProfileFormState, getProfileCompletionPercent } from "../profile-utils"
import type { ProfileSaveResponse, ProfileStatus } from "../profile-types"
import { toProfileStatus } from "../profile-formatters"
import { mockProfile } from "../mock-profile"

export type ProfileUser = {
  name: string
  email: string
  phone: string
  phoneVerified: boolean
  imageUrl: string
  level: string
  status: ProfileStatus
}

export type ProfileFormHookState = {
  profileLoading: boolean
  profileSaving: boolean
  profileError: string | null
  profileSaved: boolean
  profileComplete: boolean
  showProfileForm: boolean
  setShowProfileForm: React.Dispatch<React.SetStateAction<boolean>>
  profileFormMounted: boolean
  profileFormVisible: boolean
  profileUser: ProfileUser
  profileForm: ProfileFormState
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>
  avatarUploading: boolean
  avatarError: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  completionPercent: number
  avatarSrc: string
  handleAvatarUpload: (file: File) => Promise<void>
  handleProfileSave: () => Promise<void>
}

type ClerkUser = {
  fullName?: string | null
  imageUrl?: string
  primaryEmailAddress?: { emailAddress?: string | null } | null
  primaryPhoneNumber?: { phoneNumber?: string | null; verification?: { status?: string | null } | null } | null
  externalAccounts?: Array<{ imageUrl?: string }> | null
} | null | undefined

export function useProfileForm(
  canLoadProtectedData: boolean,
  clerkUser: ClerkUser,
  onPointsBalanceChange: (balance: number) => void,
  loadPointsHistory: () => Promise<void>
): ProfileFormHookState {
  const [profileLoading, setProfileLoading] = React.useState(false)
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [profileSaved, setProfileSaved] = React.useState(false)
  const [profileComplete, setProfileComplete] = React.useState(false)
  const [showProfileForm, setShowProfileForm] = React.useState(true)
  const [profileFormMounted, setProfileFormMounted] = React.useState(true)
  const [profileFormVisible, setProfileFormVisible] = React.useState(true)
  const [profileUser, setProfileUser] = React.useState<ProfileUser>({
    name: "",
    email: "",
    phone: "",
    phoneVerified: false,
    imageUrl: "",
    level: mockProfile.level,
    status: mockProfile.status,
  })
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const [avatarError, setAvatarError] = React.useState<string | null>(null)
  const [profileForm, setProfileForm] = React.useState(() => buildProfileFormState(null, null))
  const profileSavedTimeout = React.useRef<number | null>(null)

  // Fetch profile on mount
  React.useEffect(() => {
    if (!canLoadProtectedData) return
    let active = true
    setProfileLoading(true)
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return
        const profile = data.profile
        const userPayload = data.user || {}
        const nameFromPayload =
          userPayload.name || [userPayload.firstName, userPayload.lastName].filter(Boolean).join(" ").trim()
        setProfileUser({
          name: nameFromPayload || clerkUser?.fullName || "",
          email: userPayload.email || clerkUser?.primaryEmailAddress?.emailAddress || "",
          phone: userPayload.phone || clerkUser?.primaryPhoneNumber?.phoneNumber || "",
          phoneVerified: Boolean(clerkUser?.primaryPhoneNumber?.verification?.status === "verified"),
          imageUrl: clerkUser?.imageUrl || "",
          level: mockProfile.level,
          status: toProfileStatus(userPayload.status),
        })
        onPointsBalanceChange(data.pointsBalance || 0)
        setProfileComplete(Boolean(data.profileComplete))
        setProfileForm(buildProfileFormState(profile, data.user || clerkUser))
      })
      .catch(() => {
        if (!active) return
        setProfileUser({
          name: clerkUser?.fullName || "",
          email: clerkUser?.primaryEmailAddress?.emailAddress || "",
          phone: clerkUser?.primaryPhoneNumber?.phoneNumber || "",
          phoneVerified: Boolean(clerkUser?.primaryPhoneNumber?.verification?.status === "verified"),
          imageUrl: clerkUser?.imageUrl || "",
          level: mockProfile.level,
          status: "NEW",
        })
        setProfileError("We couldn't load your profile.")
      })
      .finally(() => {
        if (!active) return
        setProfileLoading(false)
      })
    return () => {
      active = false
    }
  }, [canLoadProtectedData, clerkUser, onPointsBalanceChange])

  // Auto-hide form when profile is complete
  React.useEffect(() => {
    if (profileComplete) {
      setShowProfileForm(false)
    }
  }, [profileComplete])

  // Form mount/visibility animation
  React.useEffect(() => {
    if (showProfileForm) {
      setProfileFormMounted(true)
      requestAnimationFrame(() => setProfileFormVisible(true))
      return
    }
    setProfileFormVisible(false)
    const id = window.setTimeout(() => setProfileFormMounted(false), 280)
    return () => window.clearTimeout(id)
  }, [showProfileForm])

  // Cleanup saved timeout
  React.useEffect(() => {
    return () => {
      if (profileSavedTimeout.current) {
        window.clearTimeout(profileSavedTimeout.current)
      }
    }
  }, [])

  const completionPercent = React.useMemo(
    () => getProfileCompletionPercent(profileForm),
    [profileForm]
  )

  const avatarSrc =
    profileUser.imageUrl ||
    clerkUser?.imageUrl ||
    clerkUser?.externalAccounts?.[0]?.imageUrl ||
    mockProfile.avatar

  const handleAvatarUpload = React.useCallback(async (file: File) => {
    setAvatarError(null)
    setAvatarUploading(true)
    try {
      if (file.size > 5 * 1024 * 1024) {
        setAvatarError("La imagen supera los 5MB.")
        return
      }
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAvatarError(data?.error || "Could not update avatar.")
        return
      }
      setProfileUser((prev) => ({ ...prev, imageUrl: data?.imageUrl || prev.imageUrl }))
    } catch {
      setAvatarError("Could not update avatar.")
    } finally {
      setAvatarUploading(false)
    }
  }, [])

  const handleProfileSave = React.useCallback(async () => {
    setProfileSaving(true)
    setProfileError(null)
    setProfileSaved(false)
    try {
      const billingLine1 = profileForm.billingLine1.trim()
      const billingLine2 = profileForm.billingLine2.trim()
      const billingCity = profileForm.billingCity.trim()
      const billingState = profileForm.billingState.trim()
      const billingPostalCode = profileForm.billingPostalCode.trim()
      const billingCountry = profileForm.billingCountry.trim()
      const hasBillingData = [billingLine1, billingLine2, billingCity, billingState, billingPostalCode, billingCountry].some(Boolean)

      if (hasBillingData && (!billingLine1 || !billingCity || !billingState || !billingPostalCode || !billingCountry)) {
        setProfileError("Complete the billing address (line 1, city, state, ZIP, and country).")
        return
      }

      const payload = {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        birthDate: profileForm.birthDate,
        emergencyContactName: profileForm.emergencyContactName,
        emergencyContactRelation: profileForm.emergencyContactRelation,
        emergencyContactPhone: profileForm.emergencyContactPhone,
        billingAddress: hasBillingData
          ? {
              line1: billingLine1,
              line2: billingLine2 || null,
              city: billingCity,
              state: billingState,
              postalCode: billingPostalCode,
              country: billingCountry,
            }
          : null,
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      let data: ProfileSaveResponse | null = null
      try {
        data = await res.json()
      } catch {
        data = null
      }
      if (!res.ok) {
        const fallback = res.status ? `Could not save profile (${res.status}).` : "Could not save profile."
        setProfileError(data?.error || fallback)
        return
      }
      setProfileComplete(Boolean(data?.profileComplete))
      onPointsBalanceChange(typeof data?.pointsBalance === "number" ? data.pointsBalance : 0)
      if (data?.profile) {
        setProfileForm(buildProfileFormState(data.profile, clerkUser))
      }
      void loadPointsHistory()
      setProfileSaved(true)
      if (profileSavedTimeout.current) {
        window.clearTimeout(profileSavedTimeout.current)
      }
      profileSavedTimeout.current = window.setTimeout(() => setProfileSaved(false), 2500)
    } catch {
      setProfileError("Could not save profile.")
    } finally {
      setProfileSaving(false)
    }
  }, [clerkUser, loadPointsHistory, onPointsBalanceChange, profileForm])

  return {
    profileLoading,
    profileSaving,
    profileError,
    profileSaved,
    profileComplete,
    showProfileForm,
    setShowProfileForm,
    profileFormMounted,
    profileFormVisible,
    profileUser,
    profileForm,
    setProfileForm,
    avatarUploading,
    avatarError,
    fileInputRef,
    completionPercent,
    avatarSrc,
    handleAvatarUpload,
    handleProfileSave,
  }
}
