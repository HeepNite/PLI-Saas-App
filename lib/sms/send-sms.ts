/**
 * Vendor-swappable SMS send abstraction (harden-staff-pin-auth PR3).
 *
 * Used by the staff device-enrollment OTP flow to deliver the single-use
 * code via real SMS. Deliberately implemented via a direct `fetch()` call
 * to Twilio's REST API rather than the `twilio` npm SDK — this worktree's
 * `node_modules` is a shared symlink with a sibling worktree, and
 * `npm install` would corrupt it.
 *
 * Transport selection (finalize-staff-device-otp): prefers
 * `TWILIO_MESSAGING_SERVICE_SID` (required for A2P 10DLC compliance in
 * production); falls back to `TWILIO_FROM_NUMBER` with a loud `console.warn`
 * when the Messaging Service SID is unset. When neither Twilio config is
 * present (local dev, or a rollout window before keys are provisioned),
 * `sendSms` degrades to an inert no-op that NEVER throws — callers can
 * always safely `await sendSms(...)`.
 */

export type SendSmsResult =
  | { ok: true; provider: "twilio" }
  | { ok: false; provider: "twilio" | "noop"; error: string }

export type SendSms = (to: string, body: string) => Promise<SendSmsResult>

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"

type TwilioConfig = {
  accountSid: string
  authToken: string
  messagingServiceSid?: string
  fromNumber?: string
}

const resolveTwilioConfig = (): TwilioConfig | null => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  const fromNumber = process.env.TWILIO_FROM_NUMBER
  if (!accountSid || !authToken) return null
  if (!messagingServiceSid && !fromNumber) return null
  return { accountSid, authToken, messagingServiceSid, fromNumber }
}

const sendViaTwilio = async (to: string, body: string, config: TwilioConfig): Promise<SendSmsResult> => {
  const url = `${TWILIO_API_BASE}/Accounts/${config.accountSid}/Messages.json`
  const authHeader = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`

  // Prefer the Messaging Service (required for A2P 10DLC compliance in
  // production) when configured; otherwise fall back to a bare From number
  // and loudly warn — this fallback is intended for early rollout only.
  const params = config.messagingServiceSid
    ? new URLSearchParams({ To: to, MessagingServiceSid: config.messagingServiceSid, Body: body })
    : new URLSearchParams({ To: to, From: config.fromNumber!, Body: body })

  if (!config.messagingServiceSid) {
    console.warn(
      "lib/sms/send-sms: TWILIO_MESSAGING_SERVICE_SID is not set — falling back to TWILIO_FROM_NUMBER. " +
        "Set TWILIO_MESSAGING_SERVICE_SID before production rollout (A2P 10DLC compliance)."
    )
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      return { ok: false, provider: "twilio", error: `Twilio SMS send failed (${response.status}): ${detail}` }
    }

    return { ok: true, provider: "twilio" }
  } catch (err) {
    return {
      ok: false,
      provider: "twilio",
      error: err instanceof Error ? err.message : "Unknown Twilio SMS send error",
    }
  }
}

/**
 * Inert no-op — logs and resolves without throwing. Used whenever the
 * Twilio provider is not configured.
 */
const sendViaNoop = async (to: string, body: string): Promise<SendSmsResult> => {
  console.warn("lib/sms/send-sms: SMS provider not configured — inert no-op send", {
    to,
    bodyLength: body.length,
  })
  return { ok: false, provider: "noop", error: "SMS provider not configured" }
}

/**
 * Sends an SMS. Resolves the provider from env at CALL time (not module
 * load time) so the provider can be toggled between requests/tests.
 */
export const sendSms: SendSms = async (to, body) => {
  const config = resolveTwilioConfig()
  if (!config) return sendViaNoop(to, body)
  return sendViaTwilio(to, body, config)
}
