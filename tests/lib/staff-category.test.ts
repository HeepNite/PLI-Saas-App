import { describe, expect, it } from "vitest"

import {
  extractStaffCategoryFromMetadata,
  extractStaffSubCategoryFromMetadata,
  parseStaffSubCategory,
  PAYMENT_PREFERENCES,
  STAFF_CATEGORIES,
  STAFF_SUB_CATEGORIES,
  type StaffPaymentInfo,
} from "@/lib/security/staff-category"

describe("staff-category helpers", () => {
  it("normalizes legacy guest_staff metadata to guest", () => {
    expect(extractStaffCategoryFromMetadata({ staffCategory: "guest_staff" })).toBe("guest")
  })

  it("includes guest in the supported staff categories", () => {
    expect(STAFF_CATEGORIES).toContain("guest")
  })

  it("keeps the supported guest sub-categories stable", () => {
    expect(STAFF_SUB_CATEGORIES).toEqual(["front_desk", "manager", "teacher"])
  })

  it("parses valid guest sub-categories and rejects invalid ones", () => {
    expect(parseStaffSubCategory("front_desk")).toBe("front_desk")
    expect(parseStaffSubCategory("invalid")).toBeNull()
  })

  it("extracts a valid guest sub-category from metadata", () => {
    expect(extractStaffSubCategoryFromMetadata({ staffSubCategory: "teacher" })).toBe("teacher")
  })

  it("returns null when metadata has no guest sub-category", () => {
    expect(extractStaffSubCategoryFromMetadata({})).toBeNull()
  })

  it("supports all payment preferences used by staff profiles", () => {
    expect(PAYMENT_PREFERENCES).toEqual(expect.arrayContaining(["cash", "card", "credits"]))
  })

  it("keeps the StaffPaymentInfo shape aligned with the payment profile contract", () => {
    const paymentInfo: StaffPaymentInfo = {
      cbu: "123",
      alias: "test",
      accountHolder: "Test User",
      mercadoPagoId: "mp-123",
      bankName: "Banco Test",
      routingNumber: "021000021",
      accountNumber: "000123456789",
      zelleId: "test@example.com",
      venmoUser: "@test-user",
      accountType: "checking",
    }

    expect(paymentInfo).toEqual({
      cbu: "123",
      alias: "test",
      accountHolder: "Test User",
      mercadoPagoId: "mp-123",
      bankName: "Banco Test",
      routingNumber: "021000021",
      accountNumber: "000123456789",
      zelleId: "test@example.com",
      venmoUser: "@test-user",
      accountType: "checking",
    })
  })
})
