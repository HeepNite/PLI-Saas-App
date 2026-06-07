import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  attachCameraStream,
  captureCameraFrame,
  startCameraSession,
  stopCameraSession,
} from "@/lib/checkin/camera-session"

describe("camera session helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("starts a camera session through mediaDevices", async () => {
    const stream = { id: "stream_1" }
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(stream),
        },
      },
    })

    await expect(startCameraSession()).resolves.toBe(stream)
  })

  it("stops every track during cleanup", () => {
    const stopA = vi.fn()
    const stopB = vi.fn()
    const stream = {
      getTracks: () => [{ stop: stopA }, { stop: stopB }],
    } as unknown as MediaStream

    stopCameraSession(stream)

    expect(stopA).toHaveBeenCalledTimes(1)
    expect(stopB).toHaveBeenCalledTimes(1)
  })

  it("attaches and plays the camera stream", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const video = {
      srcObject: null,
      play,
    } as unknown as HTMLVideoElement

    const stream = { id: "stream_1" } as unknown as MediaStream
    await attachCameraStream(video, stream)

    expect(video.srcObject).toBe(stream)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it("captures a still frame into an image file", async () => {
    const video = {
      videoWidth: 640,
      videoHeight: 480,
    } as HTMLVideoElement
    const drawImage = vi.fn()
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({
        drawImage,
      }),
      toBlob: vi.fn((callback: BlobCallback) => {
        callback(new Blob(["image"], { type: "image/jpeg" }))
      }),
    } as unknown as HTMLCanvasElement

    const file = await captureCameraFrame(video, canvas)

    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe("image/jpeg")
    expect(drawImage).toHaveBeenCalledTimes(1)
  })
})
