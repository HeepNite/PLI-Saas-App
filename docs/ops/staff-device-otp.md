# Staff Device OTP — Deployment Configuration

Ops runbook for the staff device-enrollment SMS OTP flow
(`POST /api/staff/device/enroll/challenge` and
`POST /api/staff/device/enroll`, see `lib/sms/send-sms.ts` and
`lib/sms/staff-sms-copy.ts`).

## Required environment variables

| Variable | Required | Purpose |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Yes (for real SMS) | Twilio account identifier used for Basic Auth against the REST API. |
| `TWILIO_AUTH_TOKEN` | Yes (for real SMS) | Twilio auth token used for Basic Auth against the REST API. |
| `TWILIO_MESSAGING_SERVICE_SID` | Yes, in production | A2P 10DLC-registered Messaging Service SID. All production SMS (OTP challenge + device-enrolled notice) **must** be sent through a Messaging Service to stay compliant with the registered A2P campaign and message samples. |
| `TWILIO_FROM_NUMBER` | Fallback only | Bare From number. Used **only** when `TWILIO_MESSAGING_SERVICE_SID` is unset. Every send routed through this fallback logs a `console.warn` identifying it as a compliance-risk fallback — do not run production traffic on this path. |
| `STAFF_DEVICE_GATE_MODE` | No (default `monitor`) | See activation note below. |

If neither `TWILIO_MESSAGING_SERVICE_SID` nor `TWILIO_FROM_NUMBER` is set,
`sendSms` degrades to an inert no-op (`{ ok: false, provider: "noop" }`) and
never throws — safe for local dev and pre-provisioning rollout windows, but
no SMS is actually sent.

## Message copy (A2P registered samples)

Both messages are centralized in `lib/sms/staff-sms-copy.ts` and must not be
edited without re-verifying against the registered A2P campaign samples:

- OTP challenge (`enrollmentOtpMessage`): starts with
  `"Palladium Latin Art (PLI):"`, includes `"Do not share this code."`, ends
  with `"Reply HELP for help, STOP to opt out."`.
- Device-enrolled notice (`deviceEnrolledMessage`): starts with
  `"Palladium Latin Art (PLI):"`, ends with
  `"Reply HELP for help, STOP to opt out."`.

## `STAFF_DEVICE_GATE_MODE` activation

`STAFF_DEVICE_GATE_MODE=enforce` **must be explicitly set** to activate
enforcement of the trusted-device/OTP gate on the staff PIN routes.

- **Default / unset (`monitor` mode)**: the gate is inert. Staff PIN
  sign-in continues to auto-mint a 365-day trusted-device cookie on any
  successful Clerk-session hit (the "GRANDFATHER auto-enroll" path) — no
  OTP is required, and enforcement decisions are not applied. Safe default
  for staged rollout.
- **`enforce` mode**: a request that resolves to a bare Clerk-session
  context (no terminal session, no already-trusted device) is rejected
  with a 403 instead of silently grandfathering in a new trusted device.
  Staff must complete the SMS OTP device-enrollment flow first.

Do not set `STAFF_DEVICE_GATE_MODE=enforce` until `TWILIO_MESSAGING_SERVICE_SID`
(or, at minimum, `TWILIO_FROM_NUMBER`) is configured — otherwise staff who
are not yet grandfathered in will be locked out with no way to receive an
OTP.
