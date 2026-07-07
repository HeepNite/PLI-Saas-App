import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { isPinTargetBlocked, recordPinAttemptMiss } from "@/lib/security/staff-pin-throttle"
import { issueEnrollmentChallenge } from "@/lib/security/staff-enrollment-challenge"
import { sendSms } from "@/lib/sms/send-sms"

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
 * persistent per-target counter as the PIN routes) is enforced HERE, BEFORE
 * `sendSms` is ever called — this is the SMS-triggering step (design v5
 * R4-WARNING fix).
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

  // Consume one SMS-cost unit for THIS request, immediately before the send
  // — counts every challenge attempt toward the ceiling regardless of
  // whether the staff member ever completes enrollment.
  const afterIncrement = await recordPinAttemptMiss({ targetKey: throttleKey, kind: "user" })
  if (afterIncrement.blocked) {
    // Crossed the ceiling on THIS request — do not send an SMS for it.
    return NextResponse.json(
      { error: "Too many enrollment code requests. Please try again later." },
      {
        status: 429,
        headers: afterIncrement.retryAfterSec ? { "Retry-After": String(afterIncrement.retryAfterSec) } : undefined,
      }
    )
  }

  const { code } = await issueEnrollmentChallenge(userId)

  await sendSms(phone, `Your PLI staff device verification code is ${code}. It expires in 5 minutes.`)

  return NextResponse.json({ ok: true })
}
