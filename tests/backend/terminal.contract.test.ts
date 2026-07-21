import { afterEach, describe, expect, it, vi } from "vitest"
import { ConnectionTokenController } from "@/apps/backend/src/terminal/connection-token.controller"
import { ConnectionTokenService } from "@/apps/backend/src/terminal/connection-token.service"
import { createBackendRequestHandler } from "@/apps/backend/src/main"
import { INTERNAL_AUTH_HEADER } from "@/lib/nest-gateway/auth"

const createConnectionTokenRequest = () => ({
  sessionId: "terminal_session_1",
  terminalId: "terminal_1",
  terminalSlug: "front-desk",
  terminalName: "Front desk",
  terminalLocation: "Lobby",
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

  it("returns 404 for POST /internal/terminal/payment-intents because payment-intent delegation is deferred to PR4b", async () => {
    setInternalSecret("shared-secret")

    const handleRequest = createBackendRequestHandler()

    const response = await handleRequest(
      new Request("http://backend.internal/internal/terminal/payment-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
        },
        body: JSON.stringify({ some: "payload" }),
      })
    )

    expect(response.status).toBe(404)
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
