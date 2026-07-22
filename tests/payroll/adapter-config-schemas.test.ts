import { describe, expect, it } from "vitest"

import { ADAPTER_CONFIG_SCHEMAS, getAdapterConfigSchema } from "@/lib/payroll/adapters/adapterConfigSchemas"
import { ADAPTER_TYPES } from "@/lib/payroll/types"

describe("adapterConfigSchemas", () => {
  it("declares a schema entry for every known adapter type", () => {
    const knownTypes = Object.values(ADAPTER_TYPES)

    for (const adapterType of knownTypes) {
      expect(ADAPTER_CONFIG_SCHEMAS[adapterType]).toBeDefined()
    }
  })

  it("returns the stripe schema with secretKey and accountId marked secret", () => {
    const schema = getAdapterConfigSchema(ADAPTER_TYPES.STRIPE)

    expect(schema).toEqual([
      { key: "secretKey", secret: true },
      { key: "accountId", secret: true },
    ])
  })

  it("returns the mercadopago schema with accessToken and publicKey marked secret", () => {
    const schema = getAdapterConfigSchema(ADAPTER_TYPES.MERCADOPAGO)

    expect(schema).toEqual([
      { key: "accessToken", secret: true },
      { key: "publicKey", secret: true },
    ])
  })

  it("returns the direct_deposit schema with last-4 preview on secret fields and non-secret bank fields", () => {
    const schema = getAdapterConfigSchema(ADAPTER_TYPES.DIRECT_DEPOSIT)

    expect(schema).toEqual([
      { key: "routingNumber", secret: true, previewTail: 4 },
      { key: "accountNumber", secret: true, previewTail: 4 },
      { key: "bankName", secret: false },
      { key: "accountType", secret: false },
    ])
  })

  it("returns the zelle schema with zelleId and venmoUser marked secret", () => {
    const schema = getAdapterConfigSchema(ADAPTER_TYPES.ZELLE)

    expect(schema).toEqual([
      { key: "zelleId", secret: true },
      { key: "venmoUser", secret: true },
    ])
  })

  it("returns the bank_transfer schema with accountAlias declared non-secret", () => {
    const schema = getAdapterConfigSchema(ADAPTER_TYPES.BANK_TRANSFER)

    expect(schema).toEqual([{ key: "accountAlias", secret: false }])
  })

  it("returns an empty schema for cash", () => {
    expect(getAdapterConfigSchema(ADAPTER_TYPES.CASH)).toEqual([])
  })

  it("returns an empty schema for credits", () => {
    expect(getAdapterConfigSchema(ADAPTER_TYPES.CREDITS)).toEqual([])
  })
})
