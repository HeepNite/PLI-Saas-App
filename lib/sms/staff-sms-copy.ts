/**
 * Shared A2P-aligned message copy for staff device-enrollment SMS
 * (finalize-staff-device-otp). Twilio's A2P 10DLC campaign registration was
 * approved against these exact sample strings — the sent copy MUST stay in
 * sync with the registered samples, so both messages are centralized here
 * instead of inlined at each call site.
 *
 * Every message starts with the "Palladium Latin Art (PLI):" brand prefix
 * and ends with the mandatory "Reply HELP for help, STOP to opt out."
 * compliance footer. The OTP challenge additionally warns the recipient not
 * to share the code.
 */

const BRAND_PREFIX = "Palladium Latin Art (PLI):"
const COMPLIANCE_FOOTER = "Reply HELP for help, STOP to opt out."

/** Single-use device-enrollment OTP challenge sent to the staff member's on-file phone. */
export const enrollmentOtpMessage = (code: string): string =>
  `${BRAND_PREFIX} Your staff device verification code is ${code}. It expires in 5 minutes. Do not share this code. ${COMPLIANCE_FOOTER}`

/** Best-effort notice sent after a new trusted device is enrolled for staff PIN sign-in. */
export const deviceEnrolledMessage = (): string =>
  `${BRAND_PREFIX} A new device was just enrolled for staff PIN sign-in on your account. ${COMPLIANCE_FOOTER}`
