import { afterEach, describe, expect, it } from "vitest"
import { AppModule } from "@/apps/backend/src/app.module"
import { QrDecisionController } from "@/apps/backend/src/checkin/qr-decision.controller"
import { TodayClassesController } from "@/apps/backend/src/checkin/today-classes.controller"
import { bootstrapBackendApp, createBackendRequestHandler } from "@/apps/backend/src/main"
import { HealthController } from "@/apps/backend/src/health/health.controller"
import { ConnectionTokenController } from "@/apps/backend/src/terminal/connection-token.controller"
import { INTERNAL_AUTH_HEADER } from "@/lib/nest-gateway/auth"

const setInternalSecret = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.NEST_GATEWAY_SHARED_SECRET
    return
  }

  process.env.NEST_GATEWAY_SHARED_SECRET = value
}

describe("backend internal health contract", () => {
  afterEach(() => {
    delete process.env.NEST_GATEWAY_SHARED_SECRET
  })

  it("serves GET /internal/health with the readiness payload", async () => {
    setInternalSecret("shared-secret")
    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/health", {
        headers: { [INTERNAL_AUTH_HEADER]: "shared-secret" },
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, service: "nest" })
  })

  it("rejects GET /internal/health when the shared secret is missing", async () => {
    setInternalSecret("shared-secret")
    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(new Request("http://backend.internal/internal/health"))

    expect(response.status).toBe(401)
  })

  it("rejects GET /internal/health when the shared secret is invalid", async () => {
    setInternalSecret("shared-secret")
    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/health", {
        headers: { [INTERNAL_AUTH_HEADER]: "wrong-secret" },
      })
    )

    expect(response.status).toBe(401)
  })

  it("boots the backend skeleton with the internal controllers wired", () => {
    const app = bootstrapBackendApp()

    expect(app.module).toBe(AppModule)
    expect(app.controllers).toEqual([
      HealthController,
      TodayClassesController,
      QrDecisionController,
      ConnectionTokenController,
    ])
  })

  it("rejects unregistered internal routes", async () => {
    setInternalSecret("shared-secret")
    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/healthz", {
        headers: { [INTERNAL_AUTH_HEADER]: "shared-secret" },
      })
    )

    expect(response.status).toBe(404)
  })
})
