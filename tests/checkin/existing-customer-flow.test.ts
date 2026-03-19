import { describe, expect, it } from "vitest"
import {
  getExistingCustomerInitialStep,
  shouldShowCheckInQrPanel,
} from "@/lib/checkin/existing-customer-flow"

describe("existing customer terminal flow helpers", () => {
  it("starts quick checkout existing customers on the confirmation step", () => {
    expect(getExistingCustomerInitialStep(true)).toBe(3)
  })

  it("starts non-repurchase existing customers at the beginning of the purchase flow", () => {
    expect(getExistingCustomerInitialStep(false)).toBe(0)
  })

  it("shows the QR panel for terminal shell on compact tablet viewports", () => {
    expect(
      shouldShowCheckInQrPanel({
        hideQrPanel: false,
        hasQrImage: true,
        isCompactViewport: true,
        isQrEntry: false,
        shellVariant: "terminal",
      })
    ).toBe(true)
  })

  it("keeps the QR panel hidden for phone entry even on terminal shell", () => {
    expect(
      shouldShowCheckInQrPanel({
        hideQrPanel: false,
        hasQrImage: true,
        isCompactViewport: false,
        isQrEntry: true,
        shellVariant: "terminal",
      })
    ).toBe(false)
  })

  it("still hides the QR panel on compact personal QR viewports", () => {
    expect(
      shouldShowCheckInQrPanel({
        hideQrPanel: false,
        hasQrImage: true,
        isCompactViewport: true,
        isQrEntry: false,
        shellVariant: "qr",
      })
    ).toBe(false)
  })
})
