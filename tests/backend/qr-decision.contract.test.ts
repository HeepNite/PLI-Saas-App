import { afterEach, describe, expect, it, vi } from "vitest"
import { QrDecisionController } from "@/apps/backend/src/checkin/qr-decision.controller"
import { QrDecisionService } from "@/apps/backend/src/checkin/qr-decision.service"
import { createBackendRequestHandler } from "@/apps/backend/src/main"
import { INTERNAL_AUTH_HEADER } from "@/lib/nest-gateway/auth"

const createQrDecisionRequest = () => ({
  courseSlug: "salsa-femenina-matutina",
  date: "2026-02-24",
  time: "11:00",
  customer: {
    userId: "db_user_1",
    clerkUserId: "clerk_user_1",
    firstName: "Jane",
    lastName: "Student",
    name: "Jane Student",
    email: "student@example.com",
    phone: "15551112222",
    hasAvatar: true,
  },
})

const createQrDecisionResponse = () => ({
  context: {
    courseSlug: "salsa-femenina-matutina",
    courseTitle: "Salsa Femenina Matutina",
    date: "2026-02-24",
    time: "11:00",
    durationMinutes: 60,
    startsAt: "2026-02-24T16:00:00.000Z",
    endsAt: "2026-02-24T17:00:00.000Z",
    checkInWindow: {
      isOpen: true,
      opensAt: "2026-02-24T14:00:00.000Z",
      closesAt: "2026-02-24T17:15:00.000Z",
    },
  },
  customer: {
    userId: "db_user_1",
    clerkUserId: "clerk_user_1",
    firstName: "Jane",
    lastName: "Student",
    name: "Jane Student",
    email: "student@example.com",
    phone: "15551112222",
    hasAvatar: true,
  },
  package: null,
  packages: [],
  quickCheckout: null,
  purchaseHistory: [],
  hasPreviousPurchase: false,
  hasAnyCompletedPurchase: false,
  hasExistingPurchaseForSession: false,
  hasAnyActivePackage: false,
})

const setInternalSecret = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.NEST_GATEWAY_SHARED_SECRET
    return
  }

  process.env.NEST_GATEWAY_SHARED_SECRET = value
}

describe("backend qr-decision contract", () => {
  afterEach(() => {
    delete process.env.NEST_GATEWAY_SHARED_SECRET
  })

  it("delegates qr-decision requests through the service layer", async () => {
    const buildDecisionResponse = vi.fn().mockResolvedValue(createQrDecisionResponse())
    const service = new QrDecisionService(buildDecisionResponse)
    const input = createQrDecisionRequest()

    await expect(service.getQrDecision(input)).resolves.toEqual(createQrDecisionResponse())
    expect(buildDecisionResponse).toHaveBeenCalledWith(input)
  })

  it("delegates qr-decision responses through the controller layer", async () => {
    const getQrDecision = vi.fn().mockResolvedValue(createQrDecisionResponse())
    const controller = new QrDecisionController({ getQrDecision })
    const input = createQrDecisionRequest()

    await expect(controller.getQrDecision(input)).resolves.toEqual(createQrDecisionResponse())
    expect(getQrDecision).toHaveBeenCalledWith(input)
  })

  it("serves POST /internal/checkin/qr/decision through the backend request handler", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler({
      qrDecisionController: {
        getQrDecision: async () => createQrDecisionResponse(),
      },
    })

    const response = await handleRequest(
      new Request("http://backend.internal/internal/checkin/qr/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: JSON.stringify(createQrDecisionRequest()),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      context: { courseSlug: "salsa-femenina-matutina" },
      customer: { userId: "db_user_1" },
    })
  })

  it("rejects POST /internal/checkin/qr/decision when the shared secret is missing", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/checkin/qr/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", date: "2026-02-24", time: "11:00" }),
      })
    )

    expect(response.status).toBe(401)
  })

  it("rejects POST /internal/checkin/qr/decision when the shared secret is invalid", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/checkin/qr/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "wrong-secret",
        },
        body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", date: "2026-02-24", time: "11:00" }),
      })
    )

    expect(response.status).toBe(401)
  })

  it("returns 400 when POST /internal/checkin/qr/decision receives malformed JSON", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/checkin/qr/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: "{",
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" })
  })
})
