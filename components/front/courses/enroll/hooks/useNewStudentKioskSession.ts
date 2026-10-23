import React from "react"

import { requestNewStudentKioskSessionApi } from "@/components/front/courses/enroll/effects/checkout-api"
import { normalizePhoneKey } from "@/lib/checkin/new-student-flow"

/**
 * Holds the kiosk session minted for a new student once SMS verification succeeds,
 * so the open enrollment can adopt it mid-flow (native M2 card). A failed mint
 * leaves no token: card reports its usual error and cash stays available.
 */
export function useNewStudentKioskSession({ enabled, phone }: { enabled: boolean; phone: string }) {
  const [minted, setMinted] = React.useState<{ token: string; phoneKey: string } | null>(null)
  const phoneKey = normalizePhoneKey(phone)

  const mint = React.useCallback(async (): Promise<string | null> => {
    if (!enabled) return null
    try {
      const { res, data } = await requestNewStudentKioskSessionApi({ phone })
      const token = res.ok && typeof data?.sessionToken === "string" ? data.sessionToken : ""
      if (token) {
        setMinted({ token, phoneKey })
        return token
      }
    } catch {
      // Fall through: no token means card fails closed and cash remains.
    }
    setMinted(null)
    return null
  }, [enabled, phone, phoneKey])

  const token = enabled && minted && minted.phoneKey === phoneKey ? minted.token : null
  return { token, mint }
}
