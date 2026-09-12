import { describe, expect, it } from "vitest"
import { toWinnerView } from "@/lib/raffle/winner-view"

describe("toWinnerView", () => {
  it("returns the name and only the last 4 digits of the phone", () => {
    const view = toWinnerView({ name: "Ana Lopez", phoneE164: "+12125551234" })

    expect(view).toEqual({ name: "Ana Lopez", phoneLast4: "1234" })
  })

  it("never returns the full phone number", () => {
    const view = toWinnerView({ name: "Beto Cruz", phoneE164: "+12125559999" })

    expect(Object.values(view)).not.toContain("+12125559999")
    expect(JSON.stringify(view)).not.toContain("2125559999")
  })
})
