import { describe, expect, it } from "vitest"

import {
  maskPaymentMethod,
  maskPaymentMethodConfig,
  mergePaymentMethodConfig,
} from "@/lib/payroll/mask-payment-method-config"
import { ADAPTER_TYPES } from "@/lib/payroll/types"

const FIXED_PLACEHOLDER = "••••"

describe("maskPaymentMethodConfig", () => {
  it("masks stripe secretKey and accountId with the fixed placeholder", () => {
    const masked = maskPaymentMethodConfig(ADAPTER_TYPES.STRIPE, {
      secretKey: "sk_live_abcdef1234",
      accountId: "acct_98765",
    })

    expect(masked).toEqual({
      secretKey: { configured: true, preview: FIXED_PLACEHOLDER },
      accountId: { configured: true, preview: FIXED_PLACEHOLDER },
    })
  })

  it("masks mercadopago accessToken and publicKey with the fixed placeholder", () => {
    const masked = maskPaymentMethodConfig(ADAPTER_TYPES.MERCADOPAGO, {
      accessToken: "APP_USR-1234567890",
      publicKey: "APP_USR-public-key",
    })

    expect(masked).toEqual({
      accessToken: { configured: true, preview: FIXED_PLACEHOLDER },
      publicKey: { configured: true, preview: FIXED_PLACEHOLDER },
    })
  })

  it("masks direct_deposit accountNumber/routingNumber with a last-4 preview and passes through non-secret fields", () => {
    const masked = maskPaymentMethodConfig(ADAPTER_TYPES.DIRECT_DEPOSIT, {
      bankName: "Chase",
      routingNumber: "021000021",
      accountNumber: "000123456789",
      accountType: "checking",
    })

    expect(masked).toEqual({
      bankName: "Chase",
      routingNumber: { configured: true, preview: "…0021" },
      accountNumber: { configured: true, preview: "…6789" },
      accountType: "checking",
    })
  })

  it("masks zelle zelleId and venmoUser with the fixed placeholder", () => {
    const masked = maskPaymentMethodConfig(ADAPTER_TYPES.ZELLE, {
      zelleId: "owner@example.com",
      venmoUser: "@owner-handle",
    })

    expect(masked).toEqual({
      zelleId: { configured: true, preview: FIXED_PLACEHOLDER },
      venmoUser: { configured: true, preview: FIXED_PLACEHOLDER },
    })
  })

  it("passes through bank_transfer accountAlias unmasked", () => {
    const masked = maskPaymentMethodConfig(ADAPTER_TYPES.BANK_TRANSFER, {
      accountAlias: "pli",
    })

    expect(masked).toEqual({ accountAlias: "pli" })
  })

  it("returns an empty object for cash regardless of stored keys shape", () => {
    expect(maskPaymentMethodConfig(ADAPTER_TYPES.CASH, {})).toEqual({})
  })

  it("returns an empty object for credits regardless of stored keys shape", () => {
    expect(maskPaymentMethodConfig(ADAPTER_TYPES.CREDITS, {})).toEqual({})
  })

  it("uses the fixed placeholder for short direct_deposit values (<=4 chars) instead of a last-4 preview", () => {
    const masked = maskPaymentMethodConfig(ADAPTER_TYPES.DIRECT_DEPOSIT, {
      accountNumber: "12",
    })

    expect(masked.accountNumber).toEqual({ configured: true, preview: FIXED_PLACEHOLDER })
  })

  it("reports an absent declared secret key as not configured", () => {
    const masked = maskPaymentMethodConfig(ADAPTER_TYPES.STRIPE, {
      secretKey: "sk_live_abcdef1234",
    })

    expect(masked.accountId).toEqual({ configured: false, preview: null })
  })

  it("normalizes null configJson to an empty masked object without throwing", () => {
    expect(() => maskPaymentMethodConfig(ADAPTER_TYPES.CASH, null)).not.toThrow()
    expect(maskPaymentMethodConfig(ADAPTER_TYPES.CASH, null)).toEqual({})
  })

  it("normalizes a non-object configJson (e.g. a string) for an empty-schema adapter to an empty masked object", () => {
    expect(maskPaymentMethodConfig(ADAPTER_TYPES.CASH, "not-an-object")).toEqual({})
  })

  it("masks every string value for an unrecognized adapterType (defensive fallback)", () => {
    const masked = maskPaymentMethodConfig("wire" as never, {
      apiKey: "xyz",
      note: "backup account",
    })

    expect(masked).toEqual({
      apiKey: { configured: true, preview: FIXED_PLACEHOLDER },
      note: { configured: true, preview: FIXED_PLACEHOLDER },
    })
  })

  describe("mask-all-undeclared negative regression", () => {
    it("masks an undeclared secret-shaped key stored under bank_transfer", () => {
      const masked = maskPaymentMethodConfig(ADAPTER_TYPES.BANK_TRANSFER, {
        accountAlias: "pli",
        stripeLikeSecret: "sk_live_LEAKED",
      })

      expect(masked.accountAlias).toBe("pli")
      expect(masked.stripeLikeSecret).toEqual({ configured: true, preview: FIXED_PLACEHOLDER })
      expect(JSON.stringify(masked)).not.toContain("sk_live_LEAKED")
    })

    it("masks an undeclared secret-shaped key stored under cash", () => {
      const masked = maskPaymentMethodConfig(ADAPTER_TYPES.CASH, {
        stripeLikeSecret: "sk_live_LEAKED",
      })

      expect(masked.stripeLikeSecret).toEqual({ configured: true, preview: FIXED_PLACEHOLDER })
      expect(JSON.stringify(masked)).not.toContain("sk_live_LEAKED")
    })

    it("masks an undeclared secret-shaped key stored under credits", () => {
      const masked = maskPaymentMethodConfig(ADAPTER_TYPES.CREDITS, {
        stripeLikeSecret: "sk_live_LEAKED",
      })

      expect(masked.stripeLikeSecret).toEqual({ configured: true, preview: FIXED_PLACEHOLDER })
      expect(JSON.stringify(masked)).not.toContain("sk_live_LEAKED")
    })

    it("never leaks an undeclared secret through maskPaymentMethod(row) -> JSON", () => {
      const row = {
        adapterType: ADAPTER_TYPES.BANK_TRANSFER,
        configJson: { accountAlias: "pli", stripeLikeSecret: "sk_live_LEAKED" },
      }

      const masked = maskPaymentMethod(row)

      expect(JSON.stringify(masked)).not.toContain("sk_live_LEAKED")
    })
  })
})

describe("mergePaymentMethodConfig", () => {
  it("keeps the stored secret when the incoming value is omitted", () => {
    const merged = mergePaymentMethodConfig(
      ADAPTER_TYPES.STRIPE,
      { secretKey: "sk_live_stored" },
      {},
    )

    expect(merged).toEqual({ secretKey: "sk_live_stored" })
  })

  it("keeps the stored secret when the incoming value is an empty string", () => {
    const merged = mergePaymentMethodConfig(
      ADAPTER_TYPES.STRIPE,
      { secretKey: "sk_live_stored" },
      { secretKey: "" },
    )

    expect(merged).toEqual({ secretKey: "sk_live_stored" })
  })

  it("overwrites the stored secret when a new non-sentinel value is supplied", () => {
    const merged = mergePaymentMethodConfig(
      ADAPTER_TYPES.STRIPE,
      { secretKey: "sk_live_stored" },
      { secretKey: "sk_live_new" },
    )

    expect(merged).toEqual({ secretKey: "sk_live_new" })
  })

  it("rejects a masked-shape object as an incoming secret value (treated as no-change)", () => {
    const merged = mergePaymentMethodConfig(
      ADAPTER_TYPES.STRIPE,
      { secretKey: "sk_live_stored" },
      { secretKey: { configured: true, preview: FIXED_PLACEHOLDER } },
    )

    expect(merged).toEqual({ secretKey: "sk_live_stored" })
  })

  it("rejects a string-form preview value as an incoming secret value (treated as no-change)", () => {
    const merged = mergePaymentMethodConfig(
      ADAPTER_TYPES.DIRECT_DEPOSIT,
      { accountNumber: "000123456789" },
      { accountNumber: "…6789" },
    )

    expect(merged).toEqual({ accountNumber: "000123456789" })
  })

  it("never touches secret fields when editing an unrelated non-secret field", () => {
    const merged = mergePaymentMethodConfig(
      ADAPTER_TYPES.MERCADOPAGO,
      { publicKey: "pub_stored", accessToken: "token_stored" },
      { currency: "USD" },
    )

    expect(merged).toEqual({ publicKey: "pub_stored", accessToken: "token_stored" })
  })

  it("preserves a declared non-secret key when the incoming payload omits it (accountAlias survival)", () => {
    const merged = mergePaymentMethodConfig(
      ADAPTER_TYPES.BANK_TRANSFER,
      { accountAlias: "pli" },
      {},
    )

    expect(merged).toEqual({ accountAlias: "pli" })
  })

  it("rejects an incoming object value for a non-secret declared key, preserving the stored value", () => {
    const merged = mergePaymentMethodConfig(
      ADAPTER_TYPES.BANK_TRANSFER,
      { accountAlias: "pli" },
      { accountAlias: { nested: "x" } },
    )

    expect(merged).toEqual({ accountAlias: "pli" })
  })

  it("rejects an incoming array value for a non-secret declared key, preserving the stored value", () => {
    const merged = mergePaymentMethodConfig(
      ADAPTER_TYPES.BANK_TRANSFER,
      { accountAlias: "pli" },
      { accountAlias: ["x", "y"] },
    )

    expect(merged).toEqual({ accountAlias: "pli" })
  })

  it("preserves a stored undeclared/legacy key on a same-adapterType merge that updates only a declared key", () => {
    const merged = mergePaymentMethodConfig(
      ADAPTER_TYPES.BANK_TRANSFER,
      { accountAlias: "pli", legacyFreeFormKey: "old" },
      { accountAlias: "new" },
      ADAPTER_TYPES.BANK_TRANSFER,
    )

    expect(merged).toEqual({ accountAlias: "new", legacyFreeFormKey: "old" })
  })

  describe("incoming undeclared keys are dropped at write time", () => {
    it("drops an undeclared incoming key under zelle while still processing declared keys", () => {
      const merged = mergePaymentMethodConfig(
        ADAPTER_TYPES.ZELLE,
        {},
        { zelleId: "owner@example.com", stripeLikeSecret: "sk_live_LEAKED" },
      )

      expect(merged).toEqual({ zelleId: "owner@example.com" })
    })

    it("drops an undeclared incoming key under bank_transfer while still processing declared keys", () => {
      const merged = mergePaymentMethodConfig(
        ADAPTER_TYPES.BANK_TRANSFER,
        {},
        { accountAlias: "pli", stripeLikeSecret: "sk_live_LEAKED" },
      )

      expect(merged).toEqual({ accountAlias: "pli" })
    })

    it("drops an undeclared incoming key combined with a declared-key update", () => {
      const merged = mergePaymentMethodConfig(
        ADAPTER_TYPES.STRIPE,
        { secretKey: "sk_live_stored" },
        { secretKey: "sk_live_new", extraneous: "should-not-persist" },
      )

      expect(merged).toEqual({ secretKey: "sk_live_new" })
    })
  })

  describe("edge cases", () => {
    it("normalizes null stored config to an empty object before merging", () => {
      const merged = mergePaymentMethodConfig(ADAPTER_TYPES.STRIPE, null, {
        secretKey: "sk_live_new",
      })

      expect(merged).toEqual({ secretKey: "sk_live_new" })
    })

    it("normalizes a non-object stored config (e.g. a string) to an empty object before merging", () => {
      const merged = mergePaymentMethodConfig(ADAPTER_TYPES.STRIPE, "not-an-object", {
        secretKey: "sk_live_new",
      })

      expect(merged).toEqual({ secretKey: "sk_live_new" })
    })

    it("drops old-schema keys when adapterType changes with no config in the body", () => {
      const merged = mergePaymentMethodConfig(
        ADAPTER_TYPES.ZELLE,
        { routingNumber: "021000021", accountNumber: "000123456789" },
        {},
        ADAPTER_TYPES.DIRECT_DEPOSIT,
      )

      expect(merged).toEqual({})
    })

    it("resolves the new schema when adapterType changes WITH a config body", () => {
      const merged = mergePaymentMethodConfig(
        ADAPTER_TYPES.ZELLE,
        { routingNumber: "021000021", accountNumber: "000123456789" },
        { zelleId: "owner@example.com" },
        ADAPTER_TYPES.DIRECT_DEPOSIT,
      )

      expect(merged).toEqual({ zelleId: "owner@example.com" })
    })

    it("preserves stored undeclared keys when adapterType is unchanged (no previousAdapterType supplied)", () => {
      const merged = mergePaymentMethodConfig(
        ADAPTER_TYPES.ZELLE,
        { routingNumber: "021000021", accountNumber: "000123456789" },
        {},
      )

      expect(merged).toEqual({
        routingNumber: "021000021",
        accountNumber: "000123456789",
      })
    })

    it("returns an empty object (never null) when there is no stored config and no incoming config", () => {
      const merged = mergePaymentMethodConfig(ADAPTER_TYPES.STRIPE, null, {})

      expect(merged).toEqual({})
      expect(merged).not.toBeNull()
    })
  })

  describe("sentinel-collision adversarial cases (accepted, pinned limitation)", () => {
    it("treats an incoming value exactly equal to the fixed placeholder as no-change", () => {
      const merged = mergePaymentMethodConfig(
        ADAPTER_TYPES.STRIPE,
        { secretKey: "sk_live_stored" },
        { secretKey: FIXED_PLACEHOLDER },
      )

      expect(merged).toEqual({ secretKey: "sk_live_stored" })
    })

    it("treats an incoming value matching the ellipsis+last-4 format as no-change", () => {
      const merged = mergePaymentMethodConfig(
        ADAPTER_TYPES.DIRECT_DEPOSIT,
        { accountNumber: "000123456789" },
        { accountNumber: "…6789" },
      )

      expect(merged).toEqual({ accountNumber: "000123456789" })
    })

    it("treats an identical short (<=4 char) direct_deposit value re-saved as an idempotent no-op, not a spurious overwrite", () => {
      const merged = mergePaymentMethodConfig(
        ADAPTER_TYPES.DIRECT_DEPOSIT,
        { accountNumber: "12" },
        { accountNumber: "12" },
      )

      expect(merged).toEqual({ accountNumber: "12" })
    })
  })
})

describe("maskPaymentMethod", () => {
  it("returns a new object and does not mutate the original row or its configJson", () => {
    const row = {
      adapterType: ADAPTER_TYPES.STRIPE,
      configJson: { secretKey: "sk_live_original" },
    }
    const originalConfigJsonRef = row.configJson

    const masked = maskPaymentMethod(row)

    expect(masked).not.toBe(row)
    expect(row.configJson).toBe(originalConfigJsonRef)
    expect(row.configJson).toEqual({ secretKey: "sk_live_original" })
    expect((masked.configJson as Record<string, unknown>).secretKey).toEqual({
      configured: true,
      preview: FIXED_PLACEHOLDER,
    })
  })

  it("produces two independently correct results when called twice on the same aliased row", () => {
    const sharedRow = {
      adapterType: ADAPTER_TYPES.ZELLE,
      configJson: { zelleId: "owner@example.com" },
    }

    const maskedFirst = maskPaymentMethod(sharedRow)
    const maskedSecond = maskPaymentMethod(sharedRow)

    expect(maskedFirst).not.toBe(maskedSecond)
    expect(maskedFirst.configJson).toEqual(maskedSecond.configJson)
    expect((maskedFirst.configJson as Record<string, unknown>).zelleId).toEqual({
      configured: true,
      preview: FIXED_PLACEHOLDER,
    })
    expect(sharedRow.configJson).toEqual({ zelleId: "owner@example.com" })
  })

  it("masks a null configJson without throwing", () => {
    const row = { adapterType: ADAPTER_TYPES.CASH, configJson: null }

    expect(() => maskPaymentMethod(row)).not.toThrow()
    expect(maskPaymentMethod(row).configJson).toEqual({})
  })
})
