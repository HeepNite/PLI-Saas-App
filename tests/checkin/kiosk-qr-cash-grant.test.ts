import { describe, expect, it } from "vitest"
import { createKioskQrCashGrant, verifyKioskQrCashGrant } from "@/lib/checkin/kiosk-qr-cash-grant"

const context = { terminalId: "terminal_1", courseSlug: "salsa-timba", date: "2026-10-23", time: "19:00" }
const secret = "test-kiosk-grant-secret"
const now = new Date("2026-10-23T22:30:00.000Z")

describe("kiosk QR cash grant", () => {
  it("verifies a signed grant for its exact class context", () => {
    const grant = createKioskQrCashGrant(context, { secret, now, ttlSeconds: 300 })
    expect(verifyKioskQrCashGrant(grant, context, { secret, now })).toMatchObject({ ok: true, terminalId: "terminal_1" })
  })

  it("keeps the default grant valid through 29:59 and expires it at 30:00", () => {
    const grant = createKioskQrCashGrant(context, { secret, now })
    expect(verifyKioskQrCashGrant(grant, context, { secret, now: new Date("2026-10-23T22:59:59.000Z") })).toMatchObject({ ok: true })
    expect(verifyKioskQrCashGrant(grant, context, { secret, now: new Date("2026-10-23T23:00:00.000Z") })).toEqual({ ok: false })
  })

  it("rejects tampered, expired, and context-mismatched grants", () => {
    const grant = createKioskQrCashGrant(context, { secret, now, ttlSeconds: 60 })
    expect(verifyKioskQrCashGrant(`${grant}x`, context, { secret, now })).toEqual({ ok: false })
    expect(verifyKioskQrCashGrant(grant, context, { secret, now: new Date("2026-10-23T22:31:00.000Z") })).toEqual({ ok: false })
    expect(verifyKioskQrCashGrant(grant, { ...context, time: "20:00" }, { secret, now })).toEqual({ ok: false })
  })
})
