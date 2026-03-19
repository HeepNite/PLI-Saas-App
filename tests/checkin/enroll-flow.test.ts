import { describe, expect, it } from "vitest"
import {
  getCheckInSignInModalVariant,
  resolveEnrollInitialStep,
  shouldIncludePhotoStep,
} from "@/lib/checkin/enroll-flow"

describe("enroll flow helpers", () => {
  it("keeps the existing-customer flow on the requested info step", () => {
    expect(resolveEnrollInitialStep({ initialStep: 2, stepsLength: 5 })).toBe(2)
  })

  it("clamps an invalid initial step to the end of the flow", () => {
    expect(resolveEnrollInitialStep({ initialStep: 9, stepsLength: 4 })).toBe(3)
  })

  it("omits the photo step when the account already has an avatar", () => {
    expect(
      shouldIncludePhotoStep({
        isCheckInFlow: true,
        photoPolicyRequired: true,
        hasAvatar: true,
        photoSaved: false,
      })
    ).toBe(false)
  })

  it("keeps the photo step when the account still needs a photo", () => {
    expect(
      shouldIncludePhotoStep({
        isCheckInFlow: true,
        photoPolicyRequired: true,
        hasAvatar: false,
        photoSaved: false,
      })
    ).toBe(true)
  })

  it("uses the compact sign-in modal variant for check-in flows", () => {
    expect(getCheckInSignInModalVariant(true)).toBe("compact")
    expect(getCheckInSignInModalVariant(false)).toBe("sheet")
  })
})
