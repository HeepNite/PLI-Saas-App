"use client"

import React from "react"
import Image from "next/image"
import { ImagePlus, Loader2, Trash2, X } from "lucide-react"

import type { StaffCategory } from "@/lib/security/staff-category"
import type { StaffRole } from "@/lib/security/staff-role"

import { getInitials } from "./staffPaymentCardPresentation"
import type { useStaffProfileModalAdmin } from "./useStaffProfileModalAdmin"
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  getFixedCategoryForRole,
  ROLE_FORM_LABELS,
} from "./staffAdminConstants"

export type StaffProfileModalProps = ReturnType<typeof useStaffProfileModalAdmin> & {
  assignableRoles: StaffRole[]
}

export default function StaffProfileModal({
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
  assignableRoles,
}: StaffProfileModalProps) {
  if (!profileModalOpen) return null

  const fixedCategory = getFixedCategoryForRole(profileForm.role)
  const visibleCategories = (fixedCategory ? [fixedCategory] : CATEGORY_OPTIONS) as StaffCategory[]

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]">
        <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
          {profileLoading ? (
            <div className="w-full max-w-[70%] space-y-2">
              <div className="h-3 w-28 rounded-full shimmer" />
              <div className="h-7 w-56 rounded-full shimmer" />
              <div className="h-3 w-full rounded-full shimmer" />
            </div>
          ) : (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Staff profile</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">
                Edit {profileTarget ? `${profileTarget.firstName} ${profileTarget.lastName}`.trim() : "user"}
              </h3>
              <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                You can change personal data and set up a quick-access PIN.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={closeProfileModal}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
            aria-label="Close profile editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {profileLoading ? (
          <div className="p-5">
            <div className="space-y-4 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-10 rounded-md shimmer" />
                <div className="h-10 rounded-md shimmer" />
                <div className="h-10 rounded-md shimmer" />
                <div className="h-10 rounded-md shimmer" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-10 rounded-md shimmer md:col-span-2" />
                <div className="h-10 rounded-md shimmer md:col-span-2" />
                <div className="h-10 rounded-md shimmer" />
                <div className="h-10 rounded-md shimmer" />
              </div>
              <div className="h-24 rounded-md shimmer" />
              <div className="ml-auto h-10 w-40 rounded-md shimmer" />
            </div>
          </div>
        ) : (
          <form
            className="space-y-4 p-5"
            onSubmit={(event) => {
              event.preventDefault()
              void saveProfileModal()
            }}
          >
            <section className="rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
              <div className="grid gap-3 md:grid-cols-[112px_minmax(0,1fr)]">
                <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-black/15 bg-white/70 dark:border-white/20 dark:bg-white/10">
                  {profileTarget?.avatarUrl ? (
                    <Image
                      src={profileTarget.avatarUrl}
                      alt={`${profileForm.firstName} ${profileForm.lastName}`.trim() || profileTarget.email}
                      fill
                      unoptimized
                      sizes="112px"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-black dark:text-white">
                      {getInitials(profileForm.firstName, profileForm.lastName, profileTarget?.email || "")}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand,#b61616)]">Avatar</p>
                    <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                      Upload profile photo for this staff user.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-medium text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white">
                    {profileAvatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {profileAvatarUploading ? "Uploading..." : "Upload photo"}
                    <input
                      name="profileAvatar"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={profileAvatarUploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          void uploadProfileAvatar(file)
                        }
                        event.currentTarget.value = ""
                      }}
                    />
                  </label>
                  {profileAvatarError ? (
                    <p className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-2 py-1 text-xs text-[var(--brand,#b61616)]">
                      {profileAvatarError}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand,#b61616)]">Mini gallery</p>
                <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                  Upload images from local device (phone/PC). Up to 6 images.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-medium text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white">
                    {profileGalleryUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {profileGalleryUploading ? "Uploading..." : "Upload images"}
                    <input
                      name="profileGallery"
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      disabled={profileGalleryUploading || profileForm.gallery.length >= 6}
                      onChange={(event) => {
                        const files = event.target.files
                        if (files && files.length > 0) {
                          void uploadProfileGalleryImages(files)
                        }
                        event.currentTarget.value = ""
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={clearProfileGallery}
                    disabled={profileGalleryUploading || profileForm.gallery.length === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-black/20 px-3 py-2 text-xs font-medium text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white"
                  >
                    Clear all
                  </button>
                  <span className="text-xs text-black/60 dark:text-white/60">{profileForm.gallery.length}/6</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {profileForm.gallery.length === 0 ? (
                    <p className="col-span-full rounded-md border border-dashed border-black/20 px-3 py-4 text-center text-xs text-black/60 dark:border-white/20 dark:text-white/60">
                      No gallery images yet.
                    </p>
                  ) : (
                    profileForm.gallery.map((url, index) => (
                      <div key={`gallery-${index}`} className="relative overflow-hidden rounded-lg border border-black/15 dark:border-white/15">
                        <Image
                          src={url}
                          alt={`Gallery ${index + 1}`}
                          width={320}
                          height={96}
                          unoptimized
                          className="h-24 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeProfileGalleryImage(index)}
                          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white"
                          aria-label={`Remove image ${index + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">First name</span>
                <input
                  name="profileFirstName"
                  value={profileForm.firstName}
                  onChange={(e) => updateProfileField("firstName", e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">Last name</span>
                <input
                  name="profileLastName"
                  value={profileForm.lastName}
                  onChange={(e) => updateProfileField("lastName", e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">Role</span>
                <select
                  name="profileRole"
                  value={profileForm.role}
                  onChange={(e) => updateProfileRole(e.target.value as StaffRole)}
                  disabled={!profileCanEditRole}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  {assignableRoles.map((role) => (
                    <option key={`profile-role-${role}`} value={role}>
                      {ROLE_FORM_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">Department</span>
                <select
                  name="profileCategory"
                  value={profileForm.category}
                  onChange={(e) => updateProfileField("category", e.target.value as StaffCategory)}
                  disabled={!profileCanEditRole || Boolean(fixedCategory)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  {visibleCategories.map((category) => (
                    <option key={`profile-category-${category}`} value={category}>
                      {CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">Birth date</span>
                <input
                  name="profileBirthDate"
                  type="date"
                  value={profileForm.birthDate}
                  onChange={(e) => updateProfileField("birthDate", e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">Location</span>
                <input
                  name="profileLocation"
                  value={profileForm.location}
                  onChange={(e) => updateProfileField("location", e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-black/65 dark:text-white/65">Address line 1</span>
                <input
                  name="profileAddressLine1"
                  value={profileForm.addressLine1}
                  onChange={(e) => updateProfileField("addressLine1", e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-black/65 dark:text-white/65">Address line 2</span>
                <input
                  name="profileAddressLine2"
                  value={profileForm.addressLine2}
                  onChange={(e) => updateProfileField("addressLine2", e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">City</span>
                <input
                  name="profileCity"
                  value={profileForm.city}
                  onChange={(e) => updateProfileField("city", e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">State</span>
                <input
                  name="profileState"
                  value={profileForm.state}
                  onChange={(e) => updateProfileField("state", e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">Postal code</span>
                <input
                  name="profilePostalCode"
                  value={profileForm.postalCode}
                  onChange={(e) => updateProfileField("postalCode", e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">Country</span>
                <input
                  name="profileCountry"
                  value={profileForm.country}
                  onChange={(e) => updateProfileField("country", e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">PIN (4 digits)</span>
                <input
                  name="profilePin"
                  value={profileForm.pin}
                  onChange={(e) => updateProfilePin(e.target.value)}
                  placeholder={profileHasPin ? "Configured — type new PIN to replace" : "Set PIN"}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="inline-flex items-end gap-2 pb-2 text-sm text-black/70 dark:text-white/70">
                <input
                  name="profileClearPin"
                  type="checkbox"
                  checked={profileForm.clearPin}
                  onChange={(e) => updateProfileClearPin(e.target.checked)}
                  className="h-4 w-4 rounded border-black/20 bg-white text-[var(--brand,#b61616)]"
                />
                Clear current PIN
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Personal note</span>
              <textarea
                name="profilePersonalNote"
                value={profileForm.personalNote}
                onChange={(e) => updateProfileField("personalNote", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>

            {profileError ? (
              <p className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
                {profileError}
              </p>
            ) : null}
            {profileSuccess ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {profileSuccess}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-black/10 pt-3 dark:border-white/10">
              <button
                type="button"
                onClick={closeProfileModal}
                className="rounded-md border border-black/20 px-3 py-2 text-sm text-black dark:border-white/20 dark:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={profileSaving}
                className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {profileSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
