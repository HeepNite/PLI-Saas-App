"use client"

import React from "react"
import {
  attachCameraStream,
  captureCameraFrame,
  startCameraSession,
  stopCameraSession,
} from "@/lib/checkin/camera-session"
import { uploadAvatar } from "@/lib/checkin/avatar-upload"
import type { PhotoPolicy } from "@/lib/checkin/photo-context-policy"

type PhotoCaptureStatus = "idle" | "camera_on" | "captured" | "uploading" | "saved" | "error"

export default function ProfilePhotoCapture({
  policy,
  targetUserId,
  onSaved,
}: {
  policy: PhotoPolicy
  targetUserId?: string | null
  onSaved: (result: { imageUrl: string }) => void
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const objectUrlRef = React.useRef<string | null>(null)

  const [status, setStatus] = React.useState<PhotoCaptureStatus>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [draftFile, setDraftFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string>("")

  const clearPreview = React.useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setPreviewUrl("")
  }, [])

  const cleanupCamera = React.useCallback(() => {
    stopCameraSession(streamRef.current)
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startLiveCamera = React.useCallback(async () => {
    if (!policy.allowCameraCapture || !videoRef.current) return

    cleanupCamera()
    setError(null)
    try {
      const stream = await startCameraSession()
      streamRef.current = stream
      await attachCameraStream(videoRef.current, stream)
      setStatus("camera_on")
    } catch (cameraError) {
      console.error("Camera start failed", cameraError)
      setError("We couldn't access the camera. Please allow camera access and try again.")
      setStatus("error")
    }
  }, [cleanupCamera, policy.allowCameraCapture])

  React.useEffect(() => {
    if (policy.allowCameraCapture) {
      void startLiveCamera()
    }

    const handlePageHide = () => {
      cleanupCamera()
    }

    window.addEventListener("pagehide", handlePageHide)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
      cleanupCamera()
      clearPreview()
    }
  }, [cleanupCamera, clearPreview, policy.allowCameraCapture, startLiveCamera])

  const setDraftFromFile = React.useCallback(
    (file: File) => {
      cleanupCamera()
      clearPreview()
      objectUrlRef.current = URL.createObjectURL(file)
      setPreviewUrl(objectUrlRef.current)
      setDraftFile(file)
      setError(null)
      setStatus("captured")
    },
    [cleanupCamera, clearPreview]
  )

  const handleCapture = React.useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    try {
      const file = await captureCameraFrame(videoRef.current, canvasRef.current)
      setDraftFromFile(file)
    } catch (captureError) {
      console.error("Camera capture failed", captureError)
      setError("We couldn't capture the photo. Please try again.")
      setStatus("error")
    }
  }, [setDraftFromFile])

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setDraftFromFile(file)
      event.target.value = ""
    },
    [setDraftFromFile]
  )

  const handleRetake = React.useCallback(() => {
    setDraftFile(null)
    clearPreview()
    setError(null)
    if (policy.allowCameraCapture) {
      void startLiveCamera()
      return
    }
    setStatus("idle")
  }, [clearPreview, policy.allowCameraCapture, startLiveCamera])

  const handleUpload = React.useCallback(async () => {
    if (!draftFile) {
      setError("Take or select a photo before uploading.")
      return
    }

    setStatus("uploading")
    setError(null)
    const result = await uploadAvatar({
      context: policy.context,
      file: draftFile,
      userId: targetUserId,
    })

    if (!result.ok) {
      setError(result.error)
      setStatus("error")
      return
    }

    setStatus("saved")
    onSaved({ imageUrl: result.imageUrl })
  }, [draftFile, onSaved, policy.context, targetUserId])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
        <div className="space-y-1">
          <h4 className="text-base font-semibold">Profile photo</h4>
          <p className="text-sm text-neutral-600 dark:text-white/70">
            {policy.allowGalleryUpload
              ? "Take a live photo or upload one from your gallery before continuing."
              : "Take a live photo before continuing. Gallery upload is not available on this device."}
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-black dark:border-white/10">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Profile photo preview" className="h-72 w-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="h-72 w-full object-cover" />
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
        {status === "saved" && (
          <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-300">
            Profile photo saved successfully.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {previewUrl ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="rounded-md border border-black/10 px-4 py-2 text-sm dark:border-white/10"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={status === "uploading"}
                className="rounded-md bg-[var(--brand,#111)] px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {status === "uploading" ? "Uploading..." : "Save photo"}
              </button>
            </>
          ) : (
            <>
              {policy.allowCameraCapture && (
                <button
                  type="button"
                  onClick={() => void handleCapture()}
                  disabled={status !== "camera_on"}
                  className="rounded-md bg-[var(--brand,#111)] px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  Capture photo
                </button>
              )}
              {policy.allowGalleryUpload && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-black/10 px-4 py-2 text-sm dark:border-white/10"
                  >
                    Upload from gallery
                  </button>
                </>
              )}
              {policy.allowCameraCapture && (
                <button
                  type="button"
                  onClick={() => void startLiveCamera()}
                  className="rounded-md border border-black/10 px-4 py-2 text-sm dark:border-white/10"
                >
                  Restart camera
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
