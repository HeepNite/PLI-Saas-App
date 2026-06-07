import { describe, expect, it } from "vitest"

import { ManualDispatchAdapter } from "@/lib/payroll/adapters/ManualDispatchAdapter"
import { getAdapter, UnknownAdapterTypeError, VALID_ADAPTER_TYPES } from "@/lib/payroll/adapters/registry"
import { ADAPTER_TYPES } from "@/lib/payroll/types"

describe("payroll adapter registry", () => {
  it("exposes every supported adapter type", () => {
    expect(VALID_ADAPTER_TYPES).toEqual(Object.values(ADAPTER_TYPES))
  })

  it("resolves every supported adapter to the manual dispatch adapter singleton", () => {
    const adapters = VALID_ADAPTER_TYPES.map((adapterType) => getAdapter(adapterType))

    for (const adapter of adapters) {
      expect(adapter).toBeInstanceOf(ManualDispatchAdapter)
    }

    expect(new Set(adapters).size).toBe(1)
  })

  it("throws a typed error for unknown adapters", () => {
    expect(() => getAdapter("wire" as never)).toThrowError(UnknownAdapterTypeError)
    expect(() => getAdapter("wire" as never)).toThrow("Unknown adapter type: wire")
  })
})
