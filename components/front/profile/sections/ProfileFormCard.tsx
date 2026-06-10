import React from "react"
import { X } from "lucide-react"
import GlassyCard from "@/components/front/courses/GlassyCard"
import type { ProfileFormState } from "../profile-utils"

type ProfileFormCardProps = {
  profileFormMounted: boolean
  profileFormVisible: boolean
  pointsBalance: number
  profileForm: ProfileFormState
  profileComplete: boolean
  profileSaving: boolean
  profileLoading: boolean
  profileError: string | null
  profileSaved: boolean
  userEmail: string
  userPhone: string
  onClose: () => void
  onSave: () => void
  onProfileFieldChange: (field: keyof ProfileFormState, value: string) => void
}

export function ProfileFormCard({
  profileFormMounted,
  profileFormVisible,
  pointsBalance,
  profileForm,
  profileComplete,
  profileSaving,
  profileLoading,
  profileError,
  profileSaved,
  userEmail,
  userPhone,
  onClose,
  onSave,
  onProfileFieldChange,
}: ProfileFormCardProps) {
  if (!profileFormMounted) return null

  return (
    <div
      className={`order-1 transition-all duration-300 ease-out overflow-hidden ${
        profileFormVisible ? "max-h-[1600px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"
      }`}
    >
      <GlassyCard className="p-5 relative">
        {/* Mobile header: coins + close on top row, title below */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Profile</p>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-[var(--brand,#b61616)]/60 bg-[rgba(182,22,22,0.15)] px-3 py-1 text-xs font-semibold text-[var(--brand,#b61616)] shadow-[0_0_20px_rgba(182,22,22,0.25)]">
                PLI Coins: <span className="text-zinc-900 dark:text-white">{pointsBalance}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-black/10 bg-black/[0.05] p-1.5 text-zinc-700 hover:text-zinc-900 dark:border-white/10 dark:bg-black/40 dark:text-white/70 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-white">Complete your profile and earn points</h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-white/60">
            By completing your profile, you earn points to redeem benefits.
          </p>
        </div>

        {/* Desktop header: original layout */}
        <div className="hidden flex-wrap items-start justify-between gap-3 lg:flex">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Profile</p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">Complete your profile and earn points</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-white/60">
              By completing your profile, you earn points to redeem benefits.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[var(--brand,#b61616)]/60 bg-[rgba(182,22,22,0.15)] px-4 py-2 text-sm font-semibold text-[var(--brand,#b61616)] shadow-[0_0_20px_rgba(182,22,22,0.25)]">
              PLI Coins: <span className="text-zinc-900 dark:text-white">{pointsBalance}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/10 bg-black/[0.05] p-2 text-zinc-700 hover:text-zinc-900 dark:border-white/10 dark:bg-black/40 dark:text-white/70 dark:hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:gap-4">
          <fieldset className="space-y-1.5 lg:space-y-2">
            <label className="text-xs font-medium lg:text-sm">First name</label>
            <input
              value={profileForm.firstName}
              onChange={(e) => onProfileFieldChange("firstName", e.target.value)}
              className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-white/15 dark:text-white/90 dark:placeholder:text-white/40"
              placeholder="Your first name"
            />
          </fieldset>
          <fieldset className="space-y-1.5 lg:space-y-2">
            <label className="text-xs font-medium lg:text-sm">Last name</label>
            <input
              value={profileForm.lastName}
              onChange={(e) => onProfileFieldChange("lastName", e.target.value)}
              className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-white/15 dark:text-white/90 dark:placeholder:text-white/40"
              placeholder="Your last name"
            />
          </fieldset>
          <fieldset className="col-span-2 space-y-1.5 lg:space-y-2">
            <label className="text-xs font-medium lg:text-sm">Email</label>
            <input
              value={userEmail}
              readOnly
              className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:text-white/60"
            />
          </fieldset>
          <fieldset className="space-y-1.5 lg:space-y-2">
            <label className="text-xs font-medium lg:text-sm">Phone</label>
            <input
              value={userPhone}
              readOnly
              className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:text-white/60"
            />
          </fieldset>
          <fieldset className="space-y-1.5 lg:space-y-2">
            <label className="text-xs font-medium lg:text-sm">Birthday</label>
            <input
              type="date"
              value={profileForm.birthDate}
              onChange={(e) => onProfileFieldChange("birthDate", e.target.value)}
              className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
            />
          </fieldset>
        </div>

        <div className="mt-6 border-t border-black/8 pt-5 dark:border-white/10">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Emergency contact</p>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:gap-4">
            <fieldset className="space-y-1.5 lg:space-y-2">
              <label className="text-xs font-medium lg:text-sm">Name</label>
              <input
                value={profileForm.emergencyContactName}
                onChange={(e) => onProfileFieldChange("emergencyContactName", e.target.value)}
                className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                placeholder="Full name"
              />
            </fieldset>
            <fieldset className="space-y-1.5 lg:space-y-2">
              <label className="text-xs font-medium lg:text-sm">Relationship</label>
              <input
                value={profileForm.emergencyContactRelation}
                onChange={(e) => onProfileFieldChange("emergencyContactRelation", e.target.value)}
                className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                placeholder="Ex: Mother, Father, Friend"
              />
            </fieldset>
            <fieldset className="col-span-2 space-y-1.5 lg:space-y-2">
              <label className="text-xs font-medium lg:text-sm">Phone</label>
              <input
                value={profileForm.emergencyContactPhone}
                onChange={(e) => onProfileFieldChange("emergencyContactPhone", e.target.value)}
                className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                placeholder="Number"
              />
            </fieldset>
          </div>
        </div>

        <div className="mt-6 border-t border-black/8 pt-5 dark:border-white/10">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Billing address</p>
          <p className="mt-2 text-xs text-zinc-600 dark:text-white/60">
            Used only for card payments (Stripe). You can edit it anytime.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:gap-4">
            <fieldset className="col-span-2 space-y-1.5 lg:space-y-2">
              <label className="text-xs font-medium lg:text-sm">Line 1</label>
              <input
                value={profileForm.billingLine1}
                onChange={(e) => onProfileFieldChange("billingLine1", e.target.value)}
                className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                placeholder="Street and number"
              />
            </fieldset>
            <fieldset className="col-span-2 space-y-1.5 lg:space-y-2">
              <label className="text-xs font-medium lg:text-sm">Line 2 (optional)</label>
              <input
                value={profileForm.billingLine2}
                onChange={(e) => onProfileFieldChange("billingLine2", e.target.value)}
                className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                placeholder="Apt, floor, unit"
              />
            </fieldset>
            <fieldset className="space-y-1.5 lg:space-y-2">
              <label className="text-xs font-medium lg:text-sm">City</label>
              <input
                value={profileForm.billingCity}
                onChange={(e) => onProfileFieldChange("billingCity", e.target.value)}
                className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                placeholder="City"
              />
            </fieldset>
            <fieldset className="space-y-1.5 lg:space-y-2">
              <label className="text-xs font-medium lg:text-sm">State</label>
              <input
                value={profileForm.billingState}
                onChange={(e) => onProfileFieldChange("billingState", e.target.value)}
                className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                placeholder="State"
              />
            </fieldset>
            <fieldset className="space-y-1.5 lg:space-y-2">
              <label className="text-xs font-medium lg:text-sm">ZIP / Postal code</label>
              <input
                value={profileForm.billingPostalCode}
                onChange={(e) => onProfileFieldChange("billingPostalCode", e.target.value)}
                className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                placeholder="ZIP"
              />
            </fieldset>
            <fieldset className="space-y-1.5 lg:space-y-2">
              <label className="text-xs font-medium lg:text-sm">Country</label>
              <input
                value={profileForm.billingCountry}
                onChange={(e) => onProfileFieldChange("billingCountry", e.target.value)}
                className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                placeholder="Country"
              />
            </fieldset>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-zinc-600 dark:text-white/60">
            {profileComplete ? "Profile complete. Keep earning points!" : "Complete your profile to earn 10 points."}
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={profileSaving || profileLoading}
            className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {profileSaving ? "Saving..." : "Save profile"}
          </button>
        </div>
        {profileError && <p className="mt-2 text-sm text-red-400">{profileError}</p>}
        {profileSaved && !profileError && (
          <p className="mt-2 text-sm text-emerald-300">Profile saved.</p>
        )}
      </GlassyCard>
    </div>
  )
}
