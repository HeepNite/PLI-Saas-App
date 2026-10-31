// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

const bridgeMocks = vi.hoisted(() => ({
  clearNativeCollectionPrompt: vi.fn(),
  handOffPreparedPurchase: vi.fn(),
  pollPreparedPurchaseState: vi.fn(),
}))

vi.mock("@/components/front/courses/enroll/effects/native-payment-bridge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/front/courses/enroll/effects/native-payment-bridge")>()
  return { ...actual, ...bridgeMocks }
})

import { runNativePreparedCheckout } from "@/components/front/courses/enroll/native-prepared-checkout"

const preparedData = { preparedPurchaseReference: "A".repeat(43), state: "prepared" }
const okPrepare = () => Promise.resolve({ res: new Response(null, { status: 200 }), data: preparedData })

function run(overrides: Partial<Parameters<typeof runNativePreparedCheckout>[0]> = {}) {
  const refreshPreparedContext = vi.fn(() => Promise.resolve(true))
  const requestPreparedPurchase = vi.fn(okPrepare)
  const input = { refreshPreparedContext, requestPreparedPurchase, pollIntervalMs: 0, ...overrides }
  return { promise: runNativePreparedCheckout(input), input }
}

beforeEach(() => {
  vi.clearAllMocks()
  bridgeMocks.handOffPreparedPurchase.mockResolvedValue({ admitted: true, state: "accepted", operationReference: "op-1" })
  bridgeMocks.pollPreparedPurchaseState.mockResolvedValue("paid")
})

describe("runNativePreparedCheckout", () => {
  it("returns refresh_failed without preparing when the context refresh fails", async () => {
    const { promise, input } = run({ refreshPreparedContext: vi.fn(() => Promise.resolve(false)) })
    await expect(promise).resolves.toEqual({ kind: "refresh_failed" })
    expect(input.requestPreparedPurchase).not.toHaveBeenCalled()
    expect(bridgeMocks.handOffPreparedPurchase).not.toHaveBeenCalled()
    expect(bridgeMocks.clearNativeCollectionPrompt).toHaveBeenCalledTimes(1)
  })

  it("returns prepare_failed when the prepare request is not ok", async () => {
    const { promise } = run({ requestPreparedPurchase: vi.fn(() => Promise.resolve({ res: new Response(null, { status: 500 }), data: preparedData })) })
    await expect(promise).resolves.toEqual({ kind: "prepare_failed" })
    expect(bridgeMocks.handOffPreparedPurchase).not.toHaveBeenCalled()
  })

  it("returns prepare_failed when the prepare response is malformed", async () => {
    const { promise } = run({ requestPreparedPurchase: vi.fn(() => Promise.resolve({ res: new Response(null, { status: 200 }), data: { state: "prepared" } })) })
    await expect(promise).resolves.toEqual({ kind: "prepare_failed" })
    expect(bridgeMocks.handOffPreparedPurchase).not.toHaveBeenCalled()
  })

  it.each([
    [{ admitted: true, state: "uncertain" }],
    [{ admitted: true, state: "rejected", operationReference: "op-1" }],
    [{ admitted: false, state: "uncertain" }],
    [{ admitted: true, state: "accepted" }],
  ])("returns reader_unresolved when the handoff is not accepted: %o", async (handoff) => {
    bridgeMocks.handOffPreparedPurchase.mockResolvedValue(handoff)
    const { promise } = run()
    await expect(promise).resolves.toEqual({ kind: "reader_unresolved" })
    expect(bridgeMocks.pollPreparedPurchaseState).not.toHaveBeenCalled()
  })

  it("polls the admitted operation from pending to paid", async () => {
    bridgeMocks.pollPreparedPurchaseState.mockResolvedValueOnce("pending").mockResolvedValueOnce("pending").mockResolvedValueOnce("paid")
    const { promise } = run()
    await expect(promise).resolves.toEqual({ kind: "paid" })
    expect(bridgeMocks.handOffPreparedPurchase).toHaveBeenCalledWith(preparedData.preparedPurchaseReference)
    expect(bridgeMocks.pollPreparedPurchaseState).toHaveBeenCalledTimes(3)
    expect(bridgeMocks.pollPreparedPurchaseState).toHaveBeenNthCalledWith(3, "op-1")
    expect(bridgeMocks.clearNativeCollectionPrompt).toHaveBeenCalledTimes(1)
  })

  it.each(["rejected", "uncertain"])("returns reader_unresolved when polling moves from pending to %s", async (terminal) => {
    bridgeMocks.pollPreparedPurchaseState.mockResolvedValueOnce("pending").mockResolvedValueOnce(terminal)
    const { promise } = run()
    await expect(promise).resolves.toEqual({ kind: "reader_unresolved" })
    expect(bridgeMocks.pollPreparedPurchaseState).toHaveBeenCalledTimes(2)
  })

  it("maps an exception before the handoff to prepare_failed", async () => {
    const { promise } = run({ requestPreparedPurchase: vi.fn(() => Promise.reject(new Error("network"))) })
    await expect(promise).resolves.toEqual({ kind: "prepare_failed" })
    expect(bridgeMocks.clearNativeCollectionPrompt).toHaveBeenCalledTimes(1)
  })

  it("maps an exception after the handoff started to reader_unresolved", async () => {
    bridgeMocks.pollPreparedPurchaseState.mockRejectedValue(new Error("bridge gone"))
    const { promise } = run()
    await expect(promise).resolves.toEqual({ kind: "reader_unresolved" })
    expect(bridgeMocks.clearNativeCollectionPrompt).toHaveBeenCalledTimes(1)
  })

  it("never re-prepares or retries the handoff after a non-paid outcome", async () => {
    bridgeMocks.handOffPreparedPurchase.mockResolvedValue({ admitted: true, state: "uncertain" })
    const { promise, input } = run()
    await expect(promise).resolves.toEqual({ kind: "reader_unresolved" })
    expect(input.refreshPreparedContext).toHaveBeenCalledTimes(1)
    expect(input.requestPreparedPurchase).toHaveBeenCalledTimes(1)
    expect(bridgeMocks.handOffPreparedPurchase).toHaveBeenCalledTimes(1)
  })
})
