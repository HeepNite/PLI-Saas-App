import React from "react"

const COURSE_IMAGE_MAX_BYTES = 2 * 1024 * 1024
const COURSE_VIDEO_MAX_BYTES = 15 * 1024 * 1024
const COURSE_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const COURSE_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"])

export type StaffCoursesUploadInput = {
  handleStaffAuthFailure: (status: number) => boolean
  setSchoolError: (value: string | null) => void
  setSchoolSuccess: (value: string | null) => void
  setCourseFormField: (field: "previewImageUrl" | "previewVideoUrl", value: string) => void
}

export const useStaffCoursesUpload = (input: StaffCoursesUploadInput) => {
  const { handleStaffAuthFailure, setSchoolError, setSchoolSuccess, setCourseFormField } = input

  const [courseLocalImagePreview, setCourseLocalImagePreview] = React.useState("")
  const [courseLocalVideoPreview, setCourseLocalVideoPreview] = React.useState("")
  const [courseLocalImageName, setCourseLocalImageName] = React.useState("")
  const [courseLocalVideoName, setCourseLocalVideoName] = React.useState("")
  const [courseMediaUploading, setCourseMediaUploading] = React.useState<null | "image" | "video">(null)

  const courseImageInputRef = React.useRef<HTMLInputElement>(null)
  const courseVideoInputRef = React.useRef<HTMLInputElement>(null)

  // ─── Revoke blob URLs on unmount ─────────────────────────────────
  React.useEffect(() => {
    return () => {
      if (courseLocalImagePreview.startsWith("blob:")) URL.revokeObjectURL(courseLocalImagePreview)
      if (courseLocalVideoPreview.startsWith("blob:")) URL.revokeObjectURL(courseLocalVideoPreview)
    }
  }, [courseLocalImagePreview, courseLocalVideoPreview])

  const resetUploadState = React.useCallback(() => {
    setCourseLocalImagePreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return ""
    })
    setCourseLocalVideoPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return ""
    })
    setCourseLocalImageName("")
    setCourseLocalVideoName("")
  }, [])

  // ─── Media upload ────────────────────────────────────────────────
  const uploadCourseMedia = React.useCallback(
    async (file: File, kind: "image" | "video"): Promise<string | null> => {
      const payload = new FormData()
      payload.set("file", file)
      payload.set("kind", kind)

      try {
        const res = await fetch("/api/staff/school/courses/upload", {
          method: "POST",
          body: payload,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (handleStaffAuthFailure(res.status)) return null
          setSchoolError(typeof data?.error === "string" ? data.error : `Unable to upload ${kind}.`)
          return null
        }
        const uploadedUrl = typeof data?.url === "string" ? data.url.trim() : ""
        if (!uploadedUrl) {
          setSchoolError(`Upload completed but ${kind} URL was empty.`)
          return null
        }
        return uploadedUrl
      } catch {
        setSchoolError(`Network error while uploading ${kind}.`)
        return null
      }
    },
    [handleStaffAuthFailure, setSchoolError]
  )

  const handleCourseLocalImage = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!COURSE_IMAGE_MIME_TYPES.has(file.type)) {
        setSchoolError("Formato inválido. Solo jpeg/png/webp.")
        event.target.value = ""
        return
      }
      if (file.size > COURSE_IMAGE_MAX_BYTES) {
        setSchoolError("Imagen demasiado grande. Máximo 2MB.")
        event.target.value = ""
        return
      }

      setSchoolError(null)
      setSchoolSuccess(null)
      const localPreviewUrl = URL.createObjectURL(file)
      setCourseLocalImagePreview((prev) => {
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
        return localPreviewUrl
      })
      setCourseMediaUploading("image")
      try {
        const uploadedUrl = await uploadCourseMedia(file, "image")
        if (!uploadedUrl) return
        setCourseFormField("previewImageUrl", uploadedUrl)
        setCourseLocalImagePreview((prev) => {
          if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
          return uploadedUrl
        })
        setCourseLocalImageName(file.name)
        setSchoolSuccess("Course image uploaded and linked. Save course to publish.")
      } finally {
        setCourseMediaUploading((prev) => (prev === "image" ? null : prev))
        event.target.value = ""
      }
    },
    [setSchoolError, setSchoolSuccess, uploadCourseMedia, setCourseFormField]
  )

  const handleCourseLocalVideo = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!COURSE_VIDEO_MIME_TYPES.has(file.type)) {
        setSchoolError("Formato inválido. Solo mp4/webm.")
        event.target.value = ""
        return
      }
      if (file.size > COURSE_VIDEO_MAX_BYTES) {
        setSchoolError("Video demasiado grande. Máximo 15MB.")
        event.target.value = ""
        return
      }

      setSchoolError(null)
      setSchoolSuccess(null)
      const localPreviewUrl = URL.createObjectURL(file)
      setCourseLocalVideoPreview((prev) => {
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
        return localPreviewUrl
      })
      setCourseMediaUploading("video")
      try {
        const uploadedUrl = await uploadCourseMedia(file, "video")
        if (!uploadedUrl) return
        setCourseFormField("previewVideoUrl", uploadedUrl)
        setCourseLocalVideoPreview((prev) => {
          if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
          return uploadedUrl
        })
        setCourseLocalVideoName(file.name)
        setSchoolSuccess("Course video uploaded and linked. Save course to publish.")
      } finally {
        setCourseMediaUploading((prev) => (prev === "video" ? null : prev))
        event.target.value = ""
      }
    },
    [setSchoolError, setSchoolSuccess, uploadCourseMedia, setCourseFormField]
  )

  return {
    courseLocalImagePreview,
    courseLocalVideoPreview,
    courseLocalImageName,
    courseLocalVideoName,
    courseMediaUploading,
    courseImageInputRef,
    courseVideoInputRef,
    resetUploadState,
    uploadCourseMedia,
    handleCourseLocalImage,
    handleCourseLocalVideo,
  }
}
