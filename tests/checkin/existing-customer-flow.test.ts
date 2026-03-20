import { describe, expect, it } from "vitest"
import {
  getExistingCustomerInitialStep,
  shouldShowCheckInQrPanel,
} from "@/lib/checkin/existing-customer-flow"

describe("existing customer terminal flow helpers", () => {
  it("starts existing kiosk customers on the contact information step", () => {
    expect(getExistingCustomerInitialStep({ isKioskTerminalFlow: true })).toBe(0)
  })

  it("keeps the non-kiosk entry step stable for the full wizard", () => {
    expect(getExistingCustomerInitialStep()).toBe(2)
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
