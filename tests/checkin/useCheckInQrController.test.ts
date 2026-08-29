import { describe, expect, it } from "vitest"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"
import { getQuickRepeatSpecialClassReservationUrl } from "@/components/front/checkin/hooks/useCheckInQrController"

describe("useCheckInQrController card QR selection", () => {
  it("uses the generic Special Salsa reservation page instead of the checkout-session API", () => {
    const url = getQuickRepeatSpecialClassReservationUrl(SPECIAL_SALSA_CLASS.courseSlug)

    expect(url).toBe(`/special-classes/${SPECIAL_SALSA_CLASS.key}`)
    expect(url).not.toContain("/api/checkout/session")
  })

  it("keeps the regular-class checkout-session path eligible", () => {
    expect(getQuickRepeatSpecialClassReservationUrl("salsa-beginners")).toBeNull()
  })
})
