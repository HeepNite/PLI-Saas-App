import { describe, expect, it, vi } from "vitest"
import { api, createCharge, free } from "./setup"
import { TERMINAL_CHARGE_TTL_MS } from "@/lib/terminal-charges/contract"

describe("staff panel routes", () => {
  it("allows one active charge per tablet", async () => {
    await createCharge()
    expect((await api.create([free(500)])).status).toBe(409)
    expect((await api.create([free(500)], "terminal_b")).status).toBe(201)
  })

  it("expires a pending charge lazily after the TTL and frees the tablet", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const id = await createCharge()
    vi.setSystemTime(Date.now() + TERMINAL_CHARGE_TTL_MS + 1)
    expect((await (await api.get(id)).json()).charge).toEqual(expect.objectContaining({ status: "expired", resolvedAt: expect.any(String) }))
    expect((await api.create([free(500)])).status).toBe(201)
  })
})
