export type PhotoFlowContext = "kiosk_terminal" | "qr_phone" | "external_web"

export type PhotoUploadMode = "terminal_managed" | "customer_self" | "none"

export type PhotoPolicy = {
  context: PhotoFlowContext
  photoRequired: boolean
  allowCameraCapture: boolean
  allowGalleryUpload: boolean
  uploadMode: PhotoUploadMode
}

export type ResolvePhotoFlowContextInput = {
  shellVariant?: "qr" | "terminal"
  isQrEntry?: boolean
}

export const parsePhotoFlowContext = (value: unknown): PhotoFlowContext => {
  if (value === "kiosk_terminal" || value === "qr_phone" || value === "external_web") {
    return value
  }
  return "external_web"
}

export const resolvePhotoFlowContext = (input: ResolvePhotoFlowContextInput): PhotoFlowContext => {
  if (input.shellVariant === "terminal") return "kiosk_terminal"
  if (input.shellVariant === "qr" || input.isQrEntry) return "qr_phone"
  return "external_web"
}

export const getPhotoPolicy = (context: PhotoFlowContext): PhotoPolicy => {
  switch (context) {
    case "kiosk_terminal":
      return {
        context,
        photoRequired: false,
        allowCameraCapture: false,
        allowGalleryUpload: false,
        uploadMode: "none",
      }
    case "qr_phone":
      return {
        context,
        photoRequired: true,
        allowCameraCapture: true,
        allowGalleryUpload: true,
        uploadMode: "customer_self",
      }
    default:
      return {
        context: "external_web",
        photoRequired: false,
        allowCameraCapture: false,
        allowGalleryUpload: false,
        uploadMode: "none",
      }
  }
}

export const isPhotoRequiredForAccount = (policy: PhotoPolicy, hasAvatar: boolean) =>
  policy.photoRequired && !hasAvatar
