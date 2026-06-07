import { describe, expect, it } from "vitest"
import {
  getActivePinSlotIndex,
  getKioskPinIdentifySuccessMessage,
  getKioskPinPanelCopy,
  resolveActiveKioskPinField,
  resolveKioskPinRotationMode,
} from "@/lib/checkin/kiosk-pin-policy"

describe("kiosk pin policy", () => {
  it("derives regeneration mode for obsolete or permanent credentials", () => {
    expect(
      resolveKioskPinRotationMode({
        credentialKind: "permanent",
        regenerationReason: undefined,
        requiresPinRegeneration: false,
        requiresPinRotation: true,
      })
    ).toBe("regeneration")

    expect(
      resolveKioskPinRotationMode({
        credentialKind: "provisional",
        regenerationReason: "obsolete",
        requiresPinRegeneration: false,
        requiresPinRotation: true,
      })
    ).toBe("regeneration")
  })

  it("derives provisional mode only for rotation-required provisional credentials", () => {
    expect(
      resolveKioskPinRotationMode({
        credentialKind: "provisional",
        regenerationReason: undefined,
        requiresPinRegeneration: false,
        requiresPinRotation: true,
      })
    ).toBe("provisional")

    expect(
      resolveKioskPinRotationMode({
        credentialKind: "provisional",
        regenerationReason: undefined,
        requiresPinRegeneration: false,
        requiresPinRotation: false,
      })
    ).toBe(null)
  })

  it("resolves the active entry field and slot index", () => {
    expect(resolveActiveKioskPinField({ hasKioskPinSession: false, nextPin: "" })).toBe("entry")
    expect(resolveActiveKioskPinField({ hasKioskPinSession: true, nextPin: "12" })).toBe("next")
    expect(resolveActiveKioskPinField({ hasKioskPinSession: true, nextPin: "1234" })).toBe("confirm")
    expect(getActivePinSlotIndex("")).toBe(0)
    expect(getActivePinSlotIndex("123")).toBe(3)
    expect(getActivePinSlotIndex("12345")).toBe(3)
  })

  it("returns panel copy for entry, rotation, and regeneration states", () => {
    expect(getKioskPinPanelCopy({ hasKioskPinSession: false, rotationMode: null })).toEqual({
      title: "Enter your 4-digit PIN",
      description: "We'll identify your account here and continue on this terminal.",
    })

    expect(getKioskPinPanelCopy({ hasKioskPinSession: true, rotationMode: "provisional" }).title).toBe(
      "Create your new 4-digit PIN"
    )
    expect(getKioskPinPanelCopy({ hasKioskPinSession: true, rotationMode: "regeneration" }).title).toBe(
      "Regenerate your 4-digit PIN"
    )
  })

  it("returns success messages aligned with the derived rotation mode", () => {
    expect(
      getKioskPinIdentifySuccessMessage({ requiresPinRotation: false, rotationMode: null })
    ).toBe("Identity confirmed. Loading your current class options...")
    expect(
      getKioskPinIdentifySuccessMessage({ requiresPinRotation: true, rotationMode: "provisional" })
    ).toBe("Identity confirmed. Create your permanent PIN to continue.")
    expect(
      getKioskPinIdentifySuccessMessage({ requiresPinRotation: true, rotationMode: "regeneration" })
    ).toBe("Identity confirmed. Regenerate your PIN to continue.")
  })
})
