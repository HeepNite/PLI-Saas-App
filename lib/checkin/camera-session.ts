const DEFAULT_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
}

export const startCameraSession = async (
  constraints: MediaStreamConstraints = DEFAULT_CAMERA_CONSTRAINTS
) => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is not available on this device.")
  }
  return navigator.mediaDevices.getUserMedia(constraints)
}

export const stopCameraSession = (stream?: MediaStream | null) => {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

export const attachCameraStream = async (video: HTMLVideoElement, stream: MediaStream) => {
  video.srcObject = stream
  const playResult = video.play()
  if (playResult && typeof playResult.then === "function") {
    await playResult
  }
}

export const captureCameraFrame = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  fileName = "profile-photo.jpg"
) => {
  const width = video.videoWidth || 720
  const height = video.videoHeight || 1280
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Unable to capture the photo.")
  }

  context.drawImage(video, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  })

  if (!blob) {
    throw new Error("Unable to capture the photo.")
  }

  return new File([blob], fileName, { type: "image/jpeg" })
}
