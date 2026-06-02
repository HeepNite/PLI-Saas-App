import React from "react"

type CourseSharePlatform = "facebook" | "x" | "whatsapp" | "instagram" | "tiktok"

type StaffCoursePublishStepProps = {
  visible: boolean
  courseEditingSlug: string | null
  previewPublicHref: string
  schoolBusy: string | null
  courseMediaUploading: "image" | "video" | null
  onCopyCourseLink: () => void
  onShareCourse: (platform: CourseSharePlatform) => void
  onResetCourseBuilder: () => void
}

const SHARE_ACTIONS: Array<{ platform: CourseSharePlatform; label: string }> = [
  { platform: "facebook", label: "Facebook" },
  { platform: "x", label: "X" },
  { platform: "whatsapp", label: "WhatsApp" },
  { platform: "instagram", label: "Instagram" },
  { platform: "tiktok", label: "TikTok" },
]

export default function StaffCoursePublishStep({
  visible,
  courseEditingSlug,
  previewPublicHref,
  schoolBusy,
  courseMediaUploading,
  onCopyCourseLink,
  onShareCourse,
  onResetCourseBuilder,
}: StaffCoursePublishStepProps) {
  if (!visible) return null
  if (!courseEditingSlug) {
    return <p className="mt-4 text-center text-sm text-black/50 dark:text-white/50">Create the course first to configure this step.</p>
  }

  const disabled = schoolBusy !== null || courseMediaUploading !== null

  return (
    <>
      <div className="mt-5">
        <div className="min-w-0 rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">Publish on social</p>
          <p className="mt-1 text-xs text-black/60 dark:text-white/60">Share this course directly from the dashboard.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <SocialButton disabled={!previewPublicHref} onClick={onCopyCourseLink}>Copy link</SocialButton>
            {SHARE_ACTIONS.map((action) => (
              <SocialButton key={action.platform} disabled={!previewPublicHref} onClick={() => onShareCourse(action.platform)}>
                {action.label}
              </SocialButton>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onResetCourseBuilder}
          disabled={disabled}
          className="inline-flex w-full items-center justify-center rounded-md border border-black/20 bg-white px-4 py-2 text-sm font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-60 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {schoolBusy === "course" ? "Saving..." : "Save course"}
        </button>
      </div>
    </>
  )
}

function SocialButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-black/20 bg-white px-2 py-1.5 text-xs font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-40 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
    >
      {children}
    </button>
  )
}
