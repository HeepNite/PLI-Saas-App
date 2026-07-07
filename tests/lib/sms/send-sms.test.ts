import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `lib/sms/send-sms.ts` — vendor-swappable SMS send abstraction.
 *
 * Twilio integration goes through a direct `fetch()` call to Twilio's REST
 * API (no `twilio` SDK — this worktree's node_modules is a shared symlink,
 * see harden-staff-pin-auth PR3 constraints). When Twilio env vars are
 * unset, `sendSms` MUST resolve to an inert no-op result and MUST NOT throw.
 */
describe("lib/sms/send-sms: SMS send abstraction", () => {
  const envBackup = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
  }

  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_FROM_NUMBER
  })

  afterEach(() => {
    process.env.TWILIO_ACCOUNT_SID = envBackup.TWILIO_ACCOUNT_SID
    process.env.TWILIO_AUTH_TOKEN = envBackup.TWILIO_AUTH_TOKEN
    process.env.TWILIO_FROM_NUMBER = envBackup.TWILIO_FROM_NUMBER
    vi.restoreAllMocks()
  })

  it("is INERT and does NOT throw when Twilio env vars are unset (no keys configured)", async () => {
    const { sendSms } = await import("@/lib/sms/send-sms")

    const result = await sendSms("+15551234567", "Your code is 123456")

    expect(result.ok).toBe(false)
    expect(result.provider).toBe("noop")
  })

  it("does NOT call fetch when Twilio env vars are unset", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { sendSms } = await import("@/lib/sms/send-sms")

    await sendSms("+15551234567", "Your code is 123456")

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("sends via Twilio REST API (direct fetch, no SDK) when env vars are configured", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test_sid"
    process.env.TWILIO_AUTH_TOKEN = "test_auth_token"
    process.env.TWILIO_FROM_NUMBER = "+15550001111"

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ sid: "SM123" }), { status: 201 }))

    const { sendSms } = await import("@/lib/sms/send-sms")
    const result = await sendSms("+15551234567", "Your code is 123456")

    expect(result.ok).toBe(true)
    expect(result.provider).toBe("twilio")
    expect(fetchSpy).toHaveBeenCalledOnce()

    const [url, init] = fetchSpy.mock.calls[0]!
    expect(String(url)).toBe("https://api.twilio.com/2010-04-01/Accounts/AC_test_sid/Messages.json")
    expect(init?.method).toBe("POST")

    const authHeader = new Headers(init?.headers).get("Authorization")
    expect(authHeader).toBe(`Basic ${Buffer.from("AC_test_sid:test_auth_token").toString("base64")}`)

    const bodyParams = new URLSearchParams(init?.body as string)
    expect(bodyParams.get("To")).toBe("+15551234567")
    expect(bodyParams.get("From")).toBe("+15550001111")
    expect(bodyParams.get("Body")).toBe("Your code is 123456")
  })

  it("returns ok:false (never throws) when Twilio responds with a non-2xx status", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test_sid"
    process.env.TWILIO_AUTH_TOKEN = "test_auth_token"
    process.env.TWILIO_FROM_NUMBER = "+15550001111"

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid phone number" }), { status: 400 })
    )

    const { sendSms } = await import("@/lib/sms/send-sms")
    const result = await sendSms("+1bad", "Your code is 123456")

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.provider).toBe("twilio")
      expect(result.error).toBeTruthy()
    }
  })

  it("returns ok:false (never throws) when fetch rejects (network failure)", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test_sid"
    process.env.TWILIO_AUTH_TOKEN = "test_auth_token"
    process.env.TWILIO_FROM_NUMBER = "+15550001111"

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"))

    const { sendSms } = await import("@/lib/sms/send-sms")
    const result = await sendSms("+15551234567", "Your code is 123456")

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.provider).toBe("twilio")
      expect(result.error).toContain("network down")
    }
  })
})
