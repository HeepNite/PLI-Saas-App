import { describe, expect, it } from "vitest"

import {
  normalizeStaffProfilePaymentInfo,
  resolveStaffProfilePaymentSummaryCards,
  resolveStaffProfilePayoutMode,
  toStaffProfilePaymentInfoPayload,
} from "@/lib/staff/profile-payment"

describe("staff profile payment helpers", () => {
  it("normalizes USA payout fields from persisted payloads", () => {
    expect(
      normalizeStaffProfilePaymentInfo({
        bankName: " Chase ",
        routingNumber: " 021000021 ",
        accountNumber: " 000123456789 ",
        accountType: " checking ",
        zelleId: " ana@example.com ",
        venmoUser: " @ana-desk ",
      })
    ).toEqual({
      bankName: "Chase",
      routingNumber: "021000021",
      accountNumber: "000123456789",
      accountType: "checking",
      zelleId: "ana@example.com",
      venmoUser: "@ana-desk",
    })
  })

  it("builds the USA payout payload expected by the profile API", () => {
    expect(
      toStaffProfilePaymentInfoPayload({
        bankName: " Chase ",
        routingNumber: " 021000021 ",
        accountNumber: " 000123456789 ",
        accountType: " checking ",
        zelleId: " ana@example.com ",
        venmoUser: " @ana-desk ",
      })
    ).toEqual({
      bankName: "Chase",
      routingNumber: "021000021",
      accountNumber: "000123456789",
      accountType: "checking",
      zelleId: "ana@example.com",
      venmoUser: "@ana-desk",
    })
  })

  it("summarizes direct deposit details with USA banking labels", () => {
    expect(
      resolveStaffProfilePaymentSummaryCards({
        bankName: "Chase",
        routingNumber: "021000021",
        accountNumber: "000123456789",
        accountType: "checking",
      })
    ).toEqual([
      { label: "Bank", value: "Chase" },
      { label: "Routing", value: "021000021" },
      { label: "Account", value: "000123456789", hint: "Checking" },
    ])
  })

  it("summarizes zelle payouts separately from bank transfers", () => {
    expect(resolveStaffProfilePayoutMode({ zelleId: "ana@example.com", venmoUser: "@ana-desk" })).toBe("zelle")
    expect(
      resolveStaffProfilePaymentSummaryCards({
        zelleId: "ana@example.com",
        venmoUser: "@ana-desk",
      })
    ).toEqual([
      { label: "Zelle ID", value: "ana@example.com" },
      { label: "Venmo", value: "@ana-desk" },
    ])
  })
})
