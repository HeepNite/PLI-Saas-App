import { describe, expect, it, vi } from "vitest"
import { createBackendRequestHandler } from "@/apps/backend/src/main"
import { NativePaymentJobsController } from "@/apps/backend/src/terminal/native-payment-jobs.controller"
import { NativePaymentJobsService } from "@/apps/backend/src/terminal/native-payment-jobs.service"
import { NativeConnectionTokenController } from "@/apps/backend/src/terminal/native-connection-token.controller"

describe("native HTTP failure boundary", () => {
  it.each([
    ["POST", "/connection-token"],
    ["POST", "/jobs"],
    ["GET", "/jobs/job_1"],
    ["POST", "/jobs/job_1/retry"],
    ["POST", "/jobs/job_1/observations"],
  ])("sanitizes unexpected dependency failures for %s %s", async (method, path) => {
    const fail = vi.fn().mockRejectedValue(new Error("Stripe sk_test_private postgres://private pi_secret_private"))
    const authorize = vi.fn().mockResolvedValue({ id: "reader_1" })
    const jobs = new NativePaymentJobsService()
    vi.spyOn(jobs, "create").mockImplementation(fail)
    vi.spyOn(jobs, "get").mockImplementation(fail)
    vi.spyOn(jobs, "recover").mockImplementation(fail)
    vi.spyOn(jobs, "observeClientSuccess").mockImplementation(fail)
    const handler = createBackendRequestHandler({
      nativePaymentJobsController: new NativePaymentJobsController({ authorize }, jobs),
      nativeConnectionTokenController: new NativeConnectionTokenController({ authorize }, { createConnectionToken: fail }),
    })
    const response = await handler(new Request(`http://backend.internal/terminal/native${path}`, {
      method,
      headers: { authorization: "Bearer reader-token", "content-type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify({ retryIdentity: "tap-attempt-1", type: "client_succeeded" }) } : {}),
    }))
    expect(authorize).toHaveBeenCalledOnce()
    expect(fail).toHaveBeenCalledOnce()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Unable to process native terminal request" })
  })
})
