import { describe, expect, it } from "vitest"

import { validatePaymentInfo } from "@/lib/security/staff-category"

describe("validatePaymentInfo", () => {
  // ── Valid cases ──────────────────────────────────────────────

  describe("direct_deposit — valid", () => {
    it("accepts all required valid fields", () => {
      expect(
        validatePaymentInfo("direct_deposit", {
          routingNumber: "021000021",
          accountNumber: "12345678",
          accountType: "checking",
          accountHolder: "Jane Doe",
        }),
      ).toEqual({ ok: true })
    })

    it("accepts savings as accountType", () => {
      expect(
        validatePaymentInfo("direct_deposit", {
          routingNumber: "021000021",
          accountNumber: "12345678",
          accountType: "savings",
          accountHolder: "Jane Doe",
        }),
      ).toEqual({ ok: true })
    })

    it("accepts accountType with mixed case", () => {
      expect(
        validatePaymentInfo("direct_deposit", {
          routingNumber: "021000021",
          accountNumber: "12345678",
          accountType: "Checking",
          accountHolder: "Jane Doe",
        }),
      ).toEqual({ ok: true })
    })

    it("accepts minimum-length accountNumber (4 digits)", () => {
      expect(
        validatePaymentInfo("direct_deposit", {
          routingNumber: "021000021",
          accountNumber: "1234",
          accountType: "checking",
          accountHolder: "Jane Doe",
        }),
      ).toEqual({ ok: true })
    })

    it("accepts maximum-length accountNumber (17 digits)", () => {
      expect(
        validatePaymentInfo("direct_deposit", {
          routingNumber: "021000021",
          accountNumber: "12345678901234567",
          accountType: "checking",
          accountHolder: "Jane Doe",
        }),
      ).toEqual({ ok: true })
    })
  })

  describe("zelle — valid", () => {
    it("accepts zelleId only", () => {
      expect(validatePaymentInfo("zelle", { zelleId: "user@example.com" })).toEqual({ ok: true })
    })

    it("accepts venmoUser only", () => {
      expect(validatePaymentInfo("zelle", { venmoUser: "@johndoe" })).toEqual({ ok: true })
    })

    it("accepts both zelleId and venmoUser", () => {
      expect(validatePaymentInfo("zelle", { zelleId: "user@example.com", venmoUser: "@johndoe" })).toEqual({ ok: true })
    })
  })

  describe("mercadopago — valid", () => {
    it("accepts mercadoPagoId only", () => {
      expect(validatePaymentInfo("mercadopago", { mercadoPagoId: "mp-123" })).toEqual({ ok: true })
    })

    it("accepts cbu only", () => {
      expect(validatePaymentInfo("mercadopago", { cbu: "0123456789012345678901" })).toEqual({ ok: true })
    })

    it("accepts alias only", () => {
      expect(validatePaymentInfo("mercadopago", { alias: "mi.alias.mp" })).toEqual({ ok: true })
    })
  })

  describe("cash / card / credits / stripe — valid", () => {
    it("accepts cash with no extra fields", () => {
      expect(validatePaymentInfo("cash", {})).toEqual({ ok: true })
    })

    it("accepts card with no extra fields", () => {
      expect(validatePaymentInfo("card", {})).toEqual({ ok: true })
    })

    it("accepts credits with no extra fields", () => {
      expect(validatePaymentInfo("credits", {})).toEqual({ ok: true })
    })

    it("accepts stripe with no extra fields", () => {
      expect(validatePaymentInfo("stripe", {})).toEqual({ ok: true })
    })
  })

  // ── Invalid cases ────────────────────────────────────────────

  describe("direct_deposit — invalid", () => {
    it("rejects missing routingNumber", () => {
      const result = validatePaymentInfo("direct_deposit", {
        accountNumber: "12345678",
        accountType: "checking",
        accountHolder: "Jane Doe",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
      if (!result.ok) expect(result.error).toContain("routingNumber")
    })

    it("rejects routingNumber with non-digit characters", () => {
      const result = validatePaymentInfo("direct_deposit", {
        routingNumber: "0210abc01",
        accountNumber: "12345678",
        accountType: "checking",
        accountHolder: "Jane Doe",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
      if (!result.ok) expect(result.error).toContain("routingNumber")
    })

    it("rejects routingNumber shorter than 9 digits", () => {
      const result = validatePaymentInfo("direct_deposit", {
        routingNumber: "12345",
        accountNumber: "12345678",
        accountType: "checking",
        accountHolder: "Jane Doe",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
    })

    it("rejects routingNumber longer than 9 digits", () => {
      const result = validatePaymentInfo("direct_deposit", {
        routingNumber: "1234567890",
        accountNumber: "12345678",
        accountType: "checking",
        accountHolder: "Jane Doe",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
    })

    it("rejects missing accountNumber", () => {
      const result = validatePaymentInfo("direct_deposit", {
        routingNumber: "021000021",
        accountType: "checking",
        accountHolder: "Jane Doe",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
      if (!result.ok) expect(result.error).toContain("accountNumber")
    })

    it("rejects accountNumber shorter than 4 digits", () => {
      const result = validatePaymentInfo("direct_deposit", {
        routingNumber: "021000021",
        accountNumber: "123",
        accountType: "checking",
        accountHolder: "Jane Doe",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
    })

    it("rejects accountNumber longer than 17 digits", () => {
      const result = validatePaymentInfo("direct_deposit", {
        routingNumber: "021000021",
        accountNumber: "123456789012345678",
        accountType: "checking",
        accountHolder: "Jane Doe",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
    })

    it("rejects missing accountType", () => {
      const result = validatePaymentInfo("direct_deposit", {
        routingNumber: "021000021",
        accountNumber: "12345678",
        accountHolder: "Jane Doe",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
      if (!result.ok) expect(result.error).toContain("accountType")
    })

    it("rejects invalid accountType", () => {
      const result = validatePaymentInfo("direct_deposit", {
        routingNumber: "021000021",
        accountNumber: "12345678",
        accountType: "investment",
        accountHolder: "Jane Doe",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
      if (!result.ok) expect(result.error).toContain("accountType")
    })

    it("rejects missing accountHolder", () => {
      const result = validatePaymentInfo("direct_deposit", {
        routingNumber: "021000021",
        accountNumber: "12345678",
        accountType: "checking",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
      if (!result.ok) expect(result.error).toContain("accountHolder")
    })

    it("rejects whitespace-only accountHolder", () => {
      const result = validatePaymentInfo("direct_deposit", {
        routingNumber: "021000021",
        accountNumber: "12345678",
        accountType: "checking",
        accountHolder: "   ",
      })
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
    })
  })

  describe("zelle — invalid", () => {
    it("rejects when neither zelleId nor venmoUser provided", () => {
      const result = validatePaymentInfo("zelle", {})
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
      if (!result.ok) expect(result.error).toContain("zelleId")
    })
  })

  describe("mercadopago — invalid", () => {
    it("rejects when none of mercadoPagoId/cbu/alias provided", () => {
      const result = validatePaymentInfo("mercadopago", {})
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
      if (!result.ok) expect(result.error).toContain("mercadoPagoId")
    })
  })

  describe("unknown preference — invalid", () => {
    it("rejects completely unknown preference", () => {
      const result = validatePaymentInfo("paypal", {})
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
      if (!result.ok) expect(result.error).toContain("Invalid payment preference")
    })

    it("rejects empty string preference", () => {
      const result = validatePaymentInfo("", {})
      expect(result).toEqual({ ok: false, error: expect.any(String), status: 422 })
    })
  })
})
