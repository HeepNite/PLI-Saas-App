import { afterEach, describe, expect, it, vi } from "vitest"
import { ConnectionTokenController } from "@/apps/backend/src/terminal/connection-token.controller"
import { ConnectionTokenService } from "@/apps/backend/src/terminal/connection-token.service"
import { PaymentIntentsController } from "@/apps/backend/src/terminal/payment-intents.controller"
import { PaymentIntentsService } from "@/apps/backend/src/terminal/payment-intents.service"
import { createBackendRequestHandler } from "@/apps/backend/src/main"
import { INTERNAL_AUTH_HEADER } from "@/lib/nest-gateway/auth"

const createConnectionTokenRequest = () => ({
  sessionId: "terminal_session_1",
  terminalId: "terminal_1",
  terminalSlug: "front-desk",
  terminalName: "Front desk",
  terminalLocation: "Lobby",
})

const createPaymentIntentRequest = () => ({
  amount: 2000,
  currency: "usd",
  receiptEmail: "student@example.com",
  idempotencyKey: "terminal-payment-intent:prepared_ctx_1:2000:usd",
  metadata: {
    courseSlug: "salsa-femenina-matutina",
    date: "2026-02-10",
    time: "11:00",
    flowContext: "kiosk_terminal",
  },
})

const setInternalSecret = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.NEST_GATEWAY_SHARED_SECRET
    return
  }

  process.env.NEST_GATEWAY_SHARED_SECRET = value
}

describe("backend terminal contracts", () => {
  afterEach(() => {
    delete process.env.NEST_GATEWAY_SHARED_SECRET
  })

  it("delegates connection-token requests through the service layer", async () => {
    const createConnectionToken = vi.fn().mockResolvedValue({ secret: "nest_connection_secret" })
    const service = new ConnectionTokenService(createConnectionToken)
    const input = createConnectionTokenRequest()

    await expect(service.createConnectionToken(input)).resolves.toEqual({ secret: "nest_connection_secret" })
    expect(createConnectionToken).toHaveBeenCalledWith(input)
  })

  it("delegates connection-token responses through the controller layer", async () => {
    const createConnectionToken = vi.fn().mockResolvedValue({ secret: "nest_connection_secret" })
    const controller = new ConnectionTokenController({ createConnectionToken })
    const input = createConnectionTokenRequest()

    await expect(controller.post(input)).resolves.toEqual({ secret: "nest_connection_secret" })
    expect(createConnectionToken).toHaveBeenCalledWith(input)
  })

  it("serves POST /internal/terminal/connection-token through the backend request handler", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler({
      connectionTokenController: {
        post: async () => ({ secret: "nest_connection_secret" }),
      },
    })

    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/connection-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: JSON.stringify(createConnectionTokenRequest()),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ secret: "nest_connection_secret" })
  })

  it("rejects POST /internal/terminal/connection-token when the shared secret is missing", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/connection-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createConnectionTokenRequest()),
      })
    )

    expect(response.status).toBe(401)
  })

  it("returns 400 when POST /internal/terminal/connection-token receives malformed JSON", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/connection-token", {
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

  it("returns 400 when POST /internal/terminal/connection-token receives an invalid payload shape", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/connection-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: JSON.stringify({
          sessionId: "terminal_session_1",
          terminalId: "",
          terminalSlug: "front-desk",
          terminalName: "Front desk",
          terminalLocation: ["Lobby"],
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid terminal connection-token payload" })
  })

  it("returns 404 for unsupported methods on /internal/terminal/connection-token", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/connection-token", {
        method: "GET",
        headers: { [INTERNAL_AUTH_HEADER]: "shared-secret" },
      })
    )

    expect(response.status).toBe(404)
  })

  it("delegates payment-intent requests through the service layer", async () => {
    const createPaymentIntent = vi.fn().mockResolvedValue({ client_secret: "nest_pi_secret" })
    const service = new PaymentIntentsService({
      paymentIntents: {
        create: createPaymentIntent,
      },
    })
    const input = createPaymentIntentRequest()

    await expect(service.createPaymentIntent(input)).resolves.toEqual({ clientSecret: "nest_pi_secret" })
    expect(createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: input.amount,
        currency: input.currency,
        payment_method_types: ["card_present"],
        receipt_email: input.receiptEmail,
        metadata: input.metadata,
      }),
      { idempotencyKey: input.idempotencyKey }
    )
    expect(createPaymentIntent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_payment_methods: expect.anything(),
      }),
      expect.anything()
    )
  })

  it("delegates payment-intent responses through the controller layer", async () => {
    const createPaymentIntent = vi.fn().mockResolvedValue({ clientSecret: "nest_pi_secret" })
    const controller = new PaymentIntentsController({ createPaymentIntent })
    const input = createPaymentIntentRequest()

    await expect(controller.post(input)).resolves.toEqual({ clientSecret: "nest_pi_secret" })
    expect(createPaymentIntent).toHaveBeenCalledWith(input)
  })

  it("serves POST /internal/terminal/payment-intents through the backend request handler", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler({
      paymentIntentsController: {
        post: async () => ({ clientSecret: "nest_pi_secret" }),
      },
    })

    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/payment-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: JSON.stringify(createPaymentIntentRequest()),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ clientSecret: "nest_pi_secret" })
  })

  it("accepts terminal payment-intent metadata when optional fields are omitted", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler({
      paymentIntentsController: {
        post: async () => ({ clientSecret: "nest_pi_secret" }),
      },
    })

    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/payment-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: JSON.stringify({
          ...createPaymentIntentRequest(),
          metadata: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Course booking",
            date: "2026-02-10",
            time: "11:00",
            serviceId: "dropin",
            userId: "guest",
            participants: "1",
            email: "student@example.com",
            phone: "9293876584",
            flowContext: "kiosk_terminal",
          },
        }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ clientSecret: "nest_pi_secret" })
  })

  it("still rejects unauthenticated internal terminal paths before route matching", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/payment-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "wrong-secret",
        },
        body: JSON.stringify({ some: "payload" }),
      })
    )

    expect(response.status).toBe(401)
  })

  it("returns 400 when POST /internal/terminal/payment-intents receives malformed JSON", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/payment-intents", {
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

  it("returns 400 when POST /internal/terminal/payment-intents receives an invalid payload shape", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/payment-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: JSON.stringify({
          ...createPaymentIntentRequest(),
          idempotencyKey: "",
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid terminal payment-intent payload" })
  })

  it.each([
    {
      name: "a non-positive amount",
      payload: { ...createPaymentIntentRequest(), amount: 0 },
    },
    {
      name: "a non-integer amount",
      payload: { ...createPaymentIntentRequest(), amount: 20.5 },
    },
    {
      name: "an empty currency",
      payload: { ...createPaymentIntentRequest(), currency: "   " },
    },
    {
      name: "an empty receipt email",
      payload: { ...createPaymentIntentRequest(), receiptEmail: "" },
    },
    {
      name: "metadata with blank values",
      payload: {
        ...createPaymentIntentRequest(),
        metadata: {
          ...createPaymentIntentRequest().metadata,
          readerLabel: "   ",
        },
      },
    },
    {
      name: "metadata with non-string values",
      payload: {
        ...createPaymentIntentRequest(),
        metadata: {
          ...createPaymentIntentRequest().metadata,
          readerLabel: 42,
        },
      },
    },
  ])("returns 400 when POST /internal/terminal/payment-intents receives $name", async ({ payload }) => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/payment-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: JSON.stringify(payload),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid terminal payment-intent payload" })
  })

  it("returns 500 when POST /internal/terminal/payment-intents cannot create a Stripe PaymentIntent", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler({
      paymentIntentsController: {
        post: async () => {
          throw new Error("Stripe not configured")
        },
      },
    })

    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/payment-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: JSON.stringify(createPaymentIntentRequest()),
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Unable to create terminal payment intent" })
  })

  it("returns 502 when POST /internal/terminal/payment-intents receives a Stripe intent without a client secret", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler({
      paymentIntentsController: {
        post: async () => {
          throw new Error("Stripe payment intent missing client secret")
        },
      },
    })

    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/payment-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: JSON.stringify(createPaymentIntentRequest()),
      })
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: "Terminal payment intent client secret missing" })
  })

  it("returns 404 for unsupported paths under /internal/terminal/payment-intents", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/payment-intents/unknown", {
        method: "POST",
        headers: { [INTERNAL_AUTH_HEADER]: "shared-secret" },
      })
    )

    expect(response.status).toBe(404)
  })
})
