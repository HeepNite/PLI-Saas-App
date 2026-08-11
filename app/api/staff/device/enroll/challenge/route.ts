import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { isPinTargetBlocked, recordPinAttemptMiss } from "@/lib/security/staff-pin-throttle"
import { issueEnrollmentChallenge } from "@/lib/security/staff-enrollment-challenge"
import { sendSms } from "@/lib/sms/send-sms"
import { enrollmentOtpMessage } from "@/lib/sms/staff-sms-copy"

export const runtime = "nodejs"

/**
 * Mints a single-use SMS OTP enrollment challenge and sends it to the
 * caller's ON-FILE Clerk phone (design v5 ADR 13 fallback: OUT-OF-BAND SMS
 * nonce — this PR's MECHANISM DECISION, see module doc in
 * staff-enrollment-challenge.ts). This route is Clerk-authed (NOT in the
 * middleware public whitelist) — `auth().userId` is the ONLY source of
 * identity; there is no client-suppliable phone number or userId in the
 * request at all (the route takes no body).
 *
 * The app-level SMS-cost ceiling (`enroll:{authUserId}`, reusing the same
 * persistent per-target counter as the PIN routes) is enforced as an
 * early-exit READ before doing any Clerk API calls or minting a challenge.
 * The ceiling unit itself is only CONSUMED (`recordPinAttemptMiss`) AFTER
 * `sendSms` resolves with a confirmed `ok:true` (finalize-staff-device-otp
 * R4 fix) — a failed or no-op send must not cost the caller a throttle
 * unit, since no SMS was actually delivered.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const throttleKey = `enroll:${userId}`

  // Early-exit read — fails fast on an already-exhausted ceiling before
  // doing any Clerk API calls.
  const throttleStatus = await isPinTargetBlocked(throttleKey)
  if (throttleStatus.blocked) {
    return NextResponse.json(
      { error: "Too many enrollment code requests. Please try again later." },
      {
        status: 429,
        headers: throttleStatus.retryAfterSec ? { "Retry-After": String(throttleStatus.retryAfterSec) } : undefined,
      }
    )
  }

  const client = await clerkClient()
  let user
  try {
    user = await client.users.getUser(userId)
  } catch {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  const role = extractStaffRoleFromUserMetadata(user)
  if (!role) {
    return NextResponse.json({ error: "Only staff members can enroll a device." }, { status: 403 })
  }

  const phone = user.primaryPhoneNumber?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber || ""
  if (!phone) {
    return NextResponse.json(
      { error: "No phone number on file. Contact an admin to add one before enrolling a device." },
      { status: 400 }
    )
  }

  const { code } = await issueEnrollmentChallenge(userId)

  const result = await sendSms(phone, enrollmentOtpMessage(code))
  if (!result.ok) {
    // Send failed or no-op'd — do NOT consume an SMS-cost unit for this
    // request (finalize-staff-device-otp: Challenge Send Failure Handling).
    // The freshly-minted challenge from issueEnrollmentChallenge above is
    // now the latest active one; the caller can safely retry.
    return NextResponse.json({ error: "Failed to send verification code. Please try again." }, { status: 502 })
  }

  // Consume one SMS-cost unit for THIS request, only now that the send is
  // confirmed — counts every DELIVERED challenge attempt toward the
  // ceiling regardless of whether the staff member ever completes
  // enrollment.
  const afterIncrement = await recordPinAttemptMiss({ targetKey: throttleKey, kind: "user" })
  if (afterIncrement.blocked) {
    // Crossed the ceiling on THIS request — the SMS for it was already
    // sent (mint-before-send is inherent, see design), but no further
    // requests will succeed until the window/cooldown clears.
    return NextResponse.json(
      { error: "Too many enrollment code requests. Please try again later." },
      {
        status: 429,
        headers: afterIncrement.retryAfterSec ? { "Retry-After": String(afterIncrement.retryAfterSec) } : undefined,
      }
    )
  }

  return NextResponse.json({ ok: true })
}
