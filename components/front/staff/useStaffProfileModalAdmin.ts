import React from "react"

import { isStaffCategory, type StaffCategory } from "@/lib/security/staff-category"
import { isStaffRole, type StaffRole } from "@/lib/security/staff-role"

import { normalizeCategoryForRole } from "./staffAdminConstants"
import type { StaffProfileForm, StaffUserRow } from "./staffAdminTypes"

type Input = {
  currentUserId: string
  ensureMinimumLoadingTime: (startedAt: number) => Promise<void>
  canAccessUsersNav: boolean
  refreshRows: () => Promise<void>
  refreshSelfProfile: () => Promise<void>
  updateRowAvatar: (userId: string, imageUrl: string) => void
}

const createEmptyProfileForm = (): StaffProfileForm => ({
  firstName: "",
  lastName: "",
  role: "staff",
  category: "guest",
  birthDate: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  personalNote: "",
  location: "",
  gallery: [],
  pin: "",
  clearPin: false,
})

export const useStaffProfileModalAdmin = ({
  currentUserId,
  ensureMinimumLoadingTime,
  canAccessUsersNav,
  refreshRows,
  refreshSelfProfile,
  updateRowAvatar,
}: Input) => {
  const [profileModalOpen, setProfileModalOpen] = React.useState(false)
  const [profileTarget, setProfileTarget] = React.useState<StaffUserRow | null>(null)
  const [profileLoading, setProfileLoading] = React.useState(false)
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null)
  const [profileHasPin, setProfileHasPin] = React.useState(false)
  const [profileCanEditRole, setProfileCanEditRole] = React.useState(false)
  const [profileAvatarUploading, setProfileAvatarUploading] = React.useState(false)
  const [profileAvatarError, setProfileAvatarError] = React.useState<string | null>(null)
  const [profileGalleryUploading, setProfileGalleryUploading] = React.useState(false)
  const [profileForm, setProfileForm] = React.useState<StaffProfileForm>(createEmptyProfileForm)

  const openProfileModal = React.useCallback(async (row: StaffUserRow) => {
    const startedAt = Date.now()
    setProfileModalOpen(true)
    setProfileTarget(row)
    setProfileLoading(true)
    setProfileError(null)
    setProfileSuccess(null)
    setProfileCanEditRole(false)
    try {
      const res = await fetch(`/api/staff/users/${row.id}/profile`, {
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileError(typeof data?.error === "string" ? data.error : "Failed to load staff profile")
        return
      }
      const user = data?.user || {}
      const profile = user.profile || {}
      const profileImageUrl = typeof user.imageUrl === "string" ? user.imageUrl : row.avatarUrl || ""
      const profileGallery = Array.isArray(profile.gallery)
        ? profile.gallery.filter((item: unknown): item is string => typeof item === "string")
        : []
      setProfileCanEditRole(Boolean(data?.canEditRole))
      setProfileHasPin(Boolean(user.hasPin))
      setProfileAvatarError(null)
      setProfileTarget((prev) => (prev ? { ...prev, avatarUrl: profileImageUrl } : prev))
      const resolvedRole: StaffRole = isStaffRole(user?.role) ? user.role : row.role
      const resolvedCategory: StaffCategory = isStaffCategory(user?.category) ? user.category : row.category

      setProfileForm({
        firstName: typeof user.firstName === "string" ? user.firstName : row.firstName || "",
        lastName: typeof user.lastName === "string" ? user.lastName : row.lastName || "",
        role: resolvedRole,
        category: normalizeCategoryForRole(resolvedRole, resolvedCategory),
        birthDate: typeof profile.birthDate === "string" ? profile.birthDate : "",
        addressLine1: typeof profile.addressLine1 === "string" ? profile.addressLine1 : "",
        addressLine2: typeof profile.addressLine2 === "string" ? profile.addressLine2 : "",
        city: typeof profile.city === "string" ? profile.city : "",
        state: typeof profile.state === "string" ? profile.state : "",
        postalCode: typeof profile.postalCode === "string" ? profile.postalCode : "",
        country: typeof profile.country === "string" ? profile.country : "",
        personalNote: typeof profile.personalNote === "string" ? profile.personalNote : "",
        location: typeof profile.location === "string" ? profile.location : row.location || "",
        gallery: profileGallery.slice(0, 6),
        pin: "",
        clearPin: false,
      })
    } catch {
      setProfileError("Network error while loading staff profile")
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setProfileLoading(false)
    }
  }, [ensureMinimumLoadingTime])

  const closeProfileModal = React.useCallback(() => {
    setProfileModalOpen(false)
    setProfileTarget(null)
    setProfileError(null)
    setProfileSuccess(null)
    setProfileCanEditRole(false)
    setProfileAvatarError(null)
    setProfileGalleryUploading(false)
  }, [])

  const saveProfileModal = React.useCallback(async () => {
    if (!profileTarget) return
    setProfileSaving(true)
    setProfileError(null)
    setProfileSuccess(null)
    try {
      const res = await fetch(`/api/staff/users/${profileTarget.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileError(typeof data?.error === "string" ? data.error : "Unable to save profile")
        return
      }
      setProfileSuccess("Staff profile updated.")
      if (isStaffRole(data?.user?.role)) {
        setProfileForm((prev) => ({ ...prev, role: data.user.role }))
      }
      if (isStaffCategory(data?.user?.category)) {
        setProfileForm((prev) => ({ ...prev, category: data.user.category }))
      }
      setProfileHasPin(Boolean(data?.user?.hasPin))
      setProfileForm((prev) => ({ ...prev, pin: "", clearPin: false }))
      if (canAccessUsersNav) {
        await refreshRows()
      }
      if (profileTarget.id === currentUserId) {
        await refreshSelfProfile()
      }
      closeProfileModal()
    } catch {
      setProfileError("Network error while saving profile")
    } finally {
      setProfileSaving(false)
    }
  }, [canAccessUsersNav, closeProfileModal, currentUserId, profileForm, profileTarget, refreshRows, refreshSelfProfile])

  const uploadProfileAvatar = React.useCallback(async (file: File) => {
    if (!profileTarget) return
    setProfileAvatarUploading(true)
    setProfileAvatarError(null)
    setProfileError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/staff/users/${profileTarget.id}/avatar`, {
        method: "PATCH",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileAvatarError(typeof data?.error === "string" ? data.error : "Unable to upload avatar.")
        return
      }
      const nextImage = typeof data?.imageUrl === "string" ? data.imageUrl : ""
      if (nextImage) {
        updateRowAvatar(profileTarget.id, nextImage)
        setProfileTarget((prev) => (prev ? { ...prev, avatarUrl: nextImage } : prev))
        setProfileSuccess("Avatar updated.")
      }
    } catch {
      setProfileAvatarError("Network error while uploading avatar.")
    } finally {
      setProfileAvatarUploading(false)
    }
  }, [profileTarget, updateRowAvatar])

  const uploadProfileGalleryImages = React.useCallback(async (files: FileList | File[]) => {
    if (!profileTarget) return
    const picked = Array.from(files)
    if (picked.length === 0) return
    setProfileGalleryUploading(true)
    setProfileError(null)
    try {
      for (const file of picked) {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch(`/api/staff/users/${profileTarget.id}/gallery-upload`, {
          method: "POST",
          body: formData,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setProfileError(typeof data?.error === "string" ? data.error : "Unable to upload gallery image.")
          return
        }
        const nextUrl = typeof data?.url === "string" ? data.url : ""
        if (!nextUrl) continue
        setProfileForm((prev) => {
          if (prev.gallery.includes(nextUrl) || prev.gallery.length >= 6) return prev
          return { ...prev, gallery: [...prev.gallery, nextUrl] }
        })
      }
    } catch {
      setProfileError("Network error while uploading gallery images.")
    } finally {
      setProfileGalleryUploading(false)
    }
  }, [profileTarget])

  const updateProfileField = React.useCallback(
    <K extends keyof StaffProfileForm>(field: K, value: StaffProfileForm[K]) => {
      setProfileForm((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const updateProfileRole = React.useCallback((role: StaffRole) => {
    setProfileForm((prev) => ({
      ...prev,
      role,
      category: normalizeCategoryForRole(role, prev.category),
    }))
  }, [])

  const clearProfileGallery = React.useCallback(() => {
    setProfileForm((prev) => ({ ...prev, gallery: [] }))
  }, [])

  const removeProfileGalleryImage = React.useCallback((index: number) => {
    setProfileForm((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((_, idx) => idx !== index),
    }))
  }, [])

  const updateProfilePin = React.useCallback((value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 4)
    setProfileForm((prev) => ({ ...prev, pin: sanitized }))
  }, [])

  const updateProfileClearPin = React.useCallback((checked: boolean) => {
    setProfileForm((prev) => ({ ...prev, clearPin: checked }))
  }, [])

  return {
    profileModalOpen,
    profileTarget,
    profileLoading,
    profileSaving,
    profileError,
    profileSuccess,
    profileHasPin,
    profileCanEditRole,
    profileAvatarUploading,
    profileAvatarError,
    profileGalleryUploading,
    profileForm,
    setProfileForm,
    openProfileModal,
    closeProfileModal,
    saveProfileModal,
    uploadProfileAvatar,
    uploadProfileGalleryImages,
    updateProfileField,
    updateProfileRole,
    clearProfileGallery,
    removeProfileGalleryImage,
    updateProfilePin,
    updateProfileClearPin,
  }
}
