import { beforeEach, describe, expect, it, vi } from "vitest"

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))

vi.mock("@sentry/nextjs", () => ({ captureException }))

import { captureBoundaryError } from "@/lib/sentry/capture-boundary-error"

describe("captureBoundaryError", () => {
  beforeEach(() => {
    captureException.mockClear()
  })

  it("captures the same Error object once while retaining the first boundary area", () => {
    const error = new Error("boundary failure")

    captureBoundaryError(error, "staff")
    captureBoundaryError(error, "global")

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledWith(error, { tags: { area: "staff" } })
  })

  it("captures distinct boundary Error objects", () => {
    captureBoundaryError(new Error("first"), "checkin")
    captureBoundaryError(new Error("second"), "app")

    expect(captureException).toHaveBeenCalledTimes(2)
    expect(captureException).toHaveBeenNthCalledWith(1, expect.any(Error), { tags: { area: "checkin" } })
    expect(captureException).toHaveBeenNthCalledWith(2, expect.any(Error), { tags: { area: "app" } })
  })
})
