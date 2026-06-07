import { beforeEach, describe, expect, it, vi } from "vitest"

const mockStudentPinFindFirst = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    studentPinCredential: {
      findFirst: (...args: unknown[]) => mockStudentPinFindFirst(...args),
    },
  },
}))

describe("pin check route", () => {
  beforeEach(() => {
    mockStudentPinFindFirst.mockReset()
  })

  it("returns available: true for a unique PIN", async () => {
    mockStudentPinFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/pin/check/route")
    const req = new Request("http://localhost/api/checkin/pin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "4829" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ available: true })
    expect(mockStudentPinFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["active", "rotation_required"] },
        }),
      })
    )
  })

  it("returns available: false when PIN is already in use", async () => {
    mockStudentPinFindFirst.mockResolvedValue({ id: "cred_existing" })

    const { POST } = await import("@/app/api/checkin/pin/check/route")
    const req = new Request("http://localhost/api/checkin/pin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "1234" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      available: false,
      message: "This PIN is already in use. Please choose a different one.",
    })
  })

  it("returns 400 for PIN with less than 4 digits", async () => {
    const { POST } = await import("@/app/api/checkin/pin/check/route")
    const req = new Request("http://localhost/api/checkin/pin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "12" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "PIN must be exactly 4 digits." })
  })

  it("returns 400 for non-numeric PIN", async () => {
    const { POST } = await import("@/app/api/checkin/pin/check/route")
    const req = new Request("http://localhost/api/checkin/pin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "abcd" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "PIN must be exactly 4 digits." })
  })

  it("returns 400 for PIN with more than 4 digits", async () => {
    const { POST } = await import("@/app/api/checkin/pin/check/route")
    const req = new Request("http://localhost/api/checkin/pin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "12345" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "PIN must be exactly 4 digits." })
  })

  it("returns 400 for missing body", async () => {
    const { POST } = await import("@/app/api/checkin/pin/check/route")
    const req = new Request("http://localhost/api/checkin/pin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Missing PIN" })
  })

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("@/app/api/checkin/pin/check/route")
    const req = new Request("http://localhost/api/checkin/pin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Invalid JSON body" })
  })

  it("returns 400 when PIN is not a string", async () => {
    const { POST } = await import("@/app/api/checkin/pin/check/route")
    const req = new Request("http://localhost/api/checkin/pin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: 1234 }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Missing PIN" })
  })
})
