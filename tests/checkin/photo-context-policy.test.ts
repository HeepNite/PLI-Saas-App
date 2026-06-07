import { describe, expect, it } from "vitest"
import {
  getPhotoPolicy,
  isPhotoRequiredForAccount,
  parsePhotoFlowContext,
  resolvePhotoFlowContext,
} from "@/lib/checkin/photo-context-policy"

describe("photo context policy", () => {
  it("resolves explicit check-in contexts", () => {
    expect(resolvePhotoFlowContext({ shellVariant: "terminal" })).toBe("kiosk_terminal")
    expect(resolvePhotoFlowContext({ shellVariant: "qr" })).toBe("qr_phone")
    expect(parsePhotoFlowContext("external_web")).toBe("external_web")
    expect(parsePhotoFlowContext("unknown")).toBe("external_web")
  })

  it("requires photo only when the account does not already have an avatar", () => {
    const kioskPolicy = getPhotoPolicy("kiosk_terminal")
    const qrPolicy = getPhotoPolicy("qr_phone")
    const externalPolicy = getPhotoPolicy("external_web")

    expect(isPhotoRequiredForAccount(kioskPolicy, false)).toBe(true)
    expect(isPhotoRequiredForAccount(kioskPolicy, true)).toBe(false)
    expect(isPhotoRequiredForAccount(qrPolicy, false)).toBe(true)
    expect(isPhotoRequiredForAccount(externalPolicy, false)).toBe(false)
  })
})
