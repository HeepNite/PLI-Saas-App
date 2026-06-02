import React from "react"

import type { CourseFormState } from "./staffAdminTypes"

type CourseMediaUploading = "image" | "video" | null

const COURSE_MEDIA_FIELD_CLASS = "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"

type StaffCourseMediaStepProps = {
  visible: boolean
  courseEditingSlug: string | null
  courseForm: CourseFormState
  setCourseForm: React.Dispatch<React.SetStateAction<CourseFormState>>
  courseMediaUploading: CourseMediaUploading
  courseLocalVideoName: string | null
  courseLocalImageName: string | null
  onUploadVideo: () => void
  onUploadImage: () => void
}

export default function StaffCourseMediaStep({
  visible,
  courseEditingSlug,
  courseForm,
  setCourseForm,
  courseMediaUploading,
  courseLocalVideoName,
  courseLocalImageName,
  onUploadVideo,
  onUploadImage,
}: StaffCourseMediaStepProps) {
  if (!visible) return null
  if (!courseEditingSlug) {
    return <p className="mt-4 text-center text-sm text-black/50 dark:text-white/50">Create the course first to configure this step.</p>
  }

  const updateCourseField = <Field extends keyof CourseFormState>(field: Field, value: CourseFormState[Field]) => {
    setCourseForm((previous) => ({ ...previous, [field]: value }))
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Media assets</p>
      <div className="rounded-lg border border-black/10 bg-white/75 p-2.5 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="grid gap-4 md:grid-cols-2">
          <MediaUploadField
            label="Video"
            inputName="coursePreviewVideoUrl"
            value={courseForm.previewVideoUrl}
            placeholder="URL video preview (YouTube/Vimeo/MP4)"
            uploadLabel={courseMediaUploading === "video" ? "Uploading video..." : "Upload local video"}
            localFileLabel={courseLocalVideoName ? `Local video: ${courseLocalVideoName}` : null}
            disabled={courseMediaUploading !== null}
            onChange={(value) => updateCourseField("previewVideoUrl", value)}
            onUpload={onUploadVideo}
          />
          <MediaUploadField
            label="Imagen"
            inputName="coursePreviewImageUrl"
            value={courseForm.previewImageUrl}
            placeholder="URL imagen de portada"
            uploadLabel={courseMediaUploading === "image" ? "Uploading image..." : "Upload local image"}
            localFileLabel={courseLocalImageName ? `Local image: ${courseLocalImageName}` : null}
            disabled={courseMediaUploading !== null}
            onChange={(value) => updateCourseField("previewImageUrl", value)}
            onUpload={onUploadImage}
          />
        </div>
      </div>
    </div>
  )
}

function MediaUploadField({
  label,
  inputName,
  value,
  placeholder,
  uploadLabel,
  localFileLabel,
  disabled,
  onChange,
  onUpload,
}: {
  label: string
  inputName: string
  value: string
  placeholder: string
  uploadLabel: string
  localFileLabel: string | null
  disabled: boolean
  onChange: (value: string) => void
  onUpload: () => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-black/60 dark:text-white/60">{label}</p>
      <input
        name={inputName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={COURSE_MEDIA_FIELD_CLASS}
      />
      <button
        type="button"
        onClick={onUpload}
        disabled={disabled}
        className="inline-flex w-full items-center justify-center rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-black/80 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/80"
      >
        {uploadLabel}
      </button>
      {localFileLabel ? <p className="text-xs text-black/60 dark:text-white/60">{localFileLabel}</p> : null}
    </div>
  )
}
