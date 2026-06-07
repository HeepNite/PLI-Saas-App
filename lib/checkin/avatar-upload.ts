import { getPhotoPolicy, type PhotoFlowContext } from "@/lib/checkin/photo-context-policy"

export type AvatarUploadRequest = {
  context: PhotoFlowContext
  file: File
  userId?: string | null
}

export type AvatarUploadResult =
  | {
      ok: true
      imageUrl: string
    }
  | {
      ok: false
      error: string
      status: number
    }

const buildAvatarRequest = (input: AvatarUploadRequest) => {
  const policy = getPhotoPolicy(input.context)

  if (policy.uploadMode === "terminal_managed") {
    if (!input.userId) {
      throw new Error("A target user is required for terminal avatar upload.")
    }
    return {
      endpoint: `/api/staff/users/${input.userId}/avatar`,
      method: "PATCH" as const,
    }
  }

  if (policy.uploadMode === "customer_self") {
    return {
      endpoint: "/api/profile/avatar",
      method: "POST" as const,
    }
  }

  throw new Error("Avatar upload is not enabled for this flow.")
}

export const uploadAvatar = async (input: AvatarUploadRequest): Promise<AvatarUploadResult> => {
  const request = buildAvatarRequest(input)
  const formData = new FormData()
  formData.append("file", input.file)

  try {
    const res = await fetch(request.endpoint, {
      method: request.method,
      credentials: "include",
      body: formData,
    })
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return {
        ok: false,
        error:
          typeof data?.error === "string" && data.error.trim().length > 0
            ? data.error
            : "Unable to upload the profile photo.",
        status: res.status,
      }
    }

    return {
      ok: true,
      imageUrl: typeof data?.imageUrl === "string" ? data.imageUrl : "",
    }
  } catch (error) {
    console.error("Avatar upload failed", error)
    return {
      ok: false,
      error: "Network error while uploading the profile photo.",
      status: 0,
    }
  }
}
