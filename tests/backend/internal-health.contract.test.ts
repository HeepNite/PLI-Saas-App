import { describe, expect, it } from "vitest"
import { AppModule } from "@/apps/backend/src/app.module"
import { bootstrapBackendApp, createBackendRequestHandler } from "@/apps/backend/src/main"
import { HealthController } from "@/apps/backend/src/health/health.controller"

describe("backend internal health contract", () => {
  it("serves GET /internal/health with the readiness payload", async () => {
    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(new Request("http://backend.internal/internal/health"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, service: "nest" })
  })

  it("boots the backend skeleton with the health controller wired", () => {
    const app = bootstrapBackendApp()

    expect(app.module).toBe(AppModule)
    expect(app.controllers).toEqual([HealthController])
  })

  it("rejects unregistered internal routes", async () => {
    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(new Request("http://backend.internal/internal/healthz"))

    expect(response.status).toBe(404)
  })
})
