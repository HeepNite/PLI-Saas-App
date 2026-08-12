import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { isPinTargetBlocked } from "@/lib/security/staff-pin-throttle"
import { consumeEnrollmentChallenge } from "@/lib/security/staff-enrollment-challenge"
import { enrollTrustedDevice, setTrustedDeviceCookie } from "@/lib/security/staff-trusted-device"
import { sendSms } from "@/lib/sms/send-sms"
import { deviceEnrolledMessage } from "@/lib/sms/staff-sms-copy"

export const runtime = "nodejs"

/**
 * Consumes the single-use SMS OTP and mints a `StaffTrustedDevice` bound to
 * `auth().userId` ONLY — the request body carries just `{ code }`; there is
 * no client-suppliable userId or phone number anywhere in this flow.
 * Clerk-authed (NOT in the middleware public whitelist).
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const code = typeof payload.code === "string" ? payload.code.trim() : ""
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Code must be exactly 6 digits." }, { status: 400 })
  }

  const consumed = await consumeEnrollmentChallenge(userId, code)
  if (!consumed.ok) {
    return NextResponse.json({ error: consumed.error }, { status: consumed.status })
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

  // Consume-side re-check of the SMS-cost ceiling — defense in depth
  // (design v5 Enrollment Data Flow step 5).
  const throttleStatus = await isPinTargetBlocked(`enroll:${userId}`)
  if (throttleStatus.blocked) {
    return NextResponse.json(
      { error: "Too many enrollment attempts. Please try again later." },
      {
        status: 429,
        headers: throttleStatus.retryAfterSec ? { "Retry-After": String(throttleStatus.retryAfterSec) } : undefined,
      }
    )
  }

  // Enforces the per-user active-device cap internally (evicts oldest).
  const { token } = await enrollTrustedDevice(userId)

  const response = NextResponse.json({ ok: true })
  setTrustedDeviceCookie(response, token)

  console.warn("staff/device/enroll: new trusted device enrolled", { staffUserId: userId })

  // Best-effort notify — never blocks or fails the response.
  const phone = user.primaryPhoneNumber?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber || ""
  if (phone) {
    sendSms(phone, deviceEnrolledMessage()).catch(() => {})
  }

  return response
}
