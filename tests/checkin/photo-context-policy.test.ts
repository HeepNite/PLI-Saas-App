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

  it("never requires a photo for kiosk terminal accounts (photo step removed from kiosk flow)", () => {
    const kioskPolicy = getPhotoPolicy("kiosk_terminal")

    // kiosk_terminal has photoRequired: false, so the account avatar state is irrelevant
    expect(isPhotoRequiredForAccount(kioskPolicy, false)).toBe(false)
    expect(isPhotoRequiredForAccount(kioskPolicy, true)).toBe(false)
  })

  it("requires photo for QR phone and external_web accounts without an avatar", () => {
    const qrPolicy = getPhotoPolicy("qr_phone")
    const externalPolicy = getPhotoPolicy("external_web")

    expect(isPhotoRequiredForAccount(qrPolicy, false)).toBe(true)
    expect(isPhotoRequiredForAccount(externalPolicy, false)).toBe(false)
  })

  it("kiosk_terminal policy skips photo capture entirely", () => {
    const policy = getPhotoPolicy("kiosk_terminal")
    expect(policy.photoRequired).toBe(false)
    expect(policy.uploadMode).toBe("none")
    expect(policy.allowCameraCapture).toBe(false)
    expect(policy.allowGalleryUpload).toBe(false)
  })

  it("qr_phone policy requires a customer-uploaded photo", () => {
    const policy = getPhotoPolicy("qr_phone")
    expect(policy.photoRequired).toBe(true)
    expect(policy.uploadMode).toBe("customer_self")
  })

  it("external_web policy does not require a photo", () => {
    const policy = getPhotoPolicy("external_web")
    expect(policy.photoRequired).toBe(false)
  })
})
