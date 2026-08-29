import { describe, expect, it } from "vitest"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"
import { getQuickRepeatSpecialClassReservationUrl } from "@/components/front/checkin/hooks/useCheckInQrController"

describe("useCheckInQrController card QR selection", () => {
  it("uses the international Special Salsa reservation page instead of the checkout-session API", () => {
    const url = getQuickRepeatSpecialClassReservationUrl(SPECIAL_SALSA_CLASS.courseSlug)

    expect(url).toBe("/special-salsa-class?reserve=1")
    expect(url).not.toContain("/api/checkout/session")
  })

  it("keeps the regular-class checkout-session path eligible", () => {
    expect(getQuickRepeatSpecialClassReservationUrl("salsa-beginners")).toBeNull()
  })
})
