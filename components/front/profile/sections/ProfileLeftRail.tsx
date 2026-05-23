import React from "react"
import { Camera } from "lucide-react"
import GlassyCard from "@/components/front/courses/GlassyCard"
import type { ActivityStats, PackageSummary, ProfilePackageItem } from "../profile-types"
import type { ProfileUser } from "../hooks/useProfileForm"
import { statusLabel } from "../profile-constants"
import { formatDateTimeInTimeZone } from "../profile-formatters"
import { mockProfile } from "../mock-profile"

type ProfileLeftRailProps = {
  leftRailRef: React.RefObject<HTMLDivElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  avatarUploading: boolean
  avatarError: string | null
  avatarSrc: string
  profileUser: ProfileUser
  activityStats: ActivityStats
  setShowProfileForm: React.Dispatch<React.SetStateAction<boolean>>
  completionPercent: number
  profileComplete: boolean
  packagesData: ProfilePackageItem[]
  packagesSummary: PackageSummary
  handleAvatarUpload: (file: File) => Promise<void>
}

export function ProfileLeftRail({
  leftRailRef,
  fileInputRef,
  avatarUploading,
  avatarError,
  avatarSrc,
  profileUser,
  activityStats,
  setShowProfileForm,
  completionPercent,
  profileComplete,
  packagesData,
  packagesSummary,
  handleAvatarUpload,
}: ProfileLeftRailProps) {
  const ringColor =
    completionPercent >= 80 ? "rgba(34,197,94,1)" : completionPercent >= 50 ? "rgba(245,158,11,1)" : "rgba(182,22,22,1)"

  return (
    <aside className="lg:self-start">
      <div ref={leftRailRef} className="profile-left-rail space-y-4">
        <GlassyCard className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative h-full w-full overflow-hidden"
                aria-label="Change avatar"
                title="Change avatar"
                disabled={avatarUploading}
                data-testid="avatar-upload-trigger"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarSrc} alt={profileUser.name || mockProfile.name} className="h-full w-full object-cover" />
                <span
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                  data-testid="avatar-edit-overlay"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold tracking-[0.08em] uppercase">Edit photo</span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleAvatarUpload(file)
                  e.currentTarget.value = ""
                }}
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Student</p>
              <h2 className="text-lg font-semibold">{profileUser.name || mockProfile.name}</h2>
              <p className="text-xs text-zinc-600 dark:text-white/60">{mockProfile.level}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-white/10 px-3 py-2">
              <p className="text-[color:var(--brand)]">Status</p>
              <p className="font-semibold">{statusLabel[profileUser.status]}</p>
            </div>
            <div className="rounded-md border border-white/10 px-3 py-2">
              <p className="text-[color:var(--brand)]">Phone</p>
              <p className="font-semibold">{profileUser.phoneVerified ? "Verified" : "Unverified"}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-white/70">
            <p>{profileUser.email || mockProfile.email}</p>
            <p>{profileUser.phone || mockProfile.phone}</p>
          </div>
          {avatarError && <p className="mt-2 text-xs text-red-400">{avatarError}</p>}
          {avatarUploading && <p className="mt-2 text-xs text-zinc-600 dark:text-white/60">Updating avatar...</p>}

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Activity</p>
            <p className="mt-2">Classes taken: <strong>{activityStats.classesTaken}</strong></p>
            <p>Streak: <strong>{activityStats.streakWeeks} weeks</strong></p>
            <p>Last class: <strong>{activityStats.lastClassLabel || "—"}</strong></p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowProfileForm(true)}
              className="rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-semibold text-zinc-800 hover:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:border-white/30"
            >
              Edit profile
            </button>
            <div
              className="relative h-10 w-10 rounded-full p-[2px]"
              style={{ background: `conic-gradient(${ringColor} ${completionPercent}%, rgba(255,255,255,0.12) 0)` }}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-black/70 text-[11px] font-semibold text-white">
                {completionPercent}%
              </div>
            </div>
            {!profileComplete && (
              <span className="text-[11px] text-[var(--brand,#b61616)]">Complete your profile and earn points</span>
            )}
          </div>

          <div className="mt-5 border-t border-white/10 pt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Packages and promos</p>
            <div className="mt-3 space-y-3 text-sm">
              {packagesData.length > 0 ? (
                packagesData.map((pkg) => (
                  <div key={pkg.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="font-semibold">{pkg.label}</p>
                    <p className="text-xs text-zinc-600 dark:text-white/60">
                      {pkg.isUnlimited ? "Unlimited" : `Remaining: ${pkg.remainingCredits ?? 0}`}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-white/40">
                      {pkg.expiresAt
                        ? `Expires: ${formatDateTimeInTimeZone(pkg.expiresAt, {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}`
                        : "No expiration"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-600 dark:text-white/60">
                  You do not have active packages.
                </div>
              )}
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="font-semibold">Summary</p>
                <p className="text-xs text-zinc-600 dark:text-white/60">
                  Active: {packagesSummary.activePackages} · Credits: {packagesSummary.totalRemainingCredits}
                  {packagesSummary.unlimitedPackages > 0 ? ` · Unlimiteds: ${packagesSummary.unlimitedPackages}` : ""}
                </p>
              </div>
            </div>
          </div>
        </GlassyCard>
      </div>
    </aside>
  )
}
