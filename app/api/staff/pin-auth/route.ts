import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { extractStaffCategoryFromUserMetadata } from "@/lib/security/staff-category"
import { isValidPinHash } from "@/lib/security/staff-pin-auth"

export const runtime = "nodejs"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:pin-auth:post", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : ""
  const pin = typeof payload.pin === "string" ? payload.pin.trim() : ""

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 4 to 8 digits." }, { status: 400 })
  }

  const client = await clerkClient()
  const list = await client.users.getUserList({
    emailAddress: [email],
    limit: 1,
  })
  const user = list.data[0]
  if (!user) {
    return NextResponse.json({ error: "Staff user not found." }, { status: 404 })
  }

  const role = extractStaffRoleFromUserMetadata(user)
  if (!role) {
    return NextResponse.json({ error: "User does not have staff access." }, { status: 403 })
  }
  const category = extractStaffCategoryFromUserMetadata(user) || "guest"
  const privateMetadata =
    user.privateMetadata && typeof user.privateMetadata === "object"
      ? (user.privateMetadata as Record<string, unknown>)
      : {}
  const pinHash = typeof privateMetadata.staffPinHash === "string" ? privateMetadata.staffPinHash : ""
  if (!pinHash || !isValidPinHash(pin, pinHash)) {
    return NextResponse.json({ error: "Invalid PIN for this staff account." }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    staff: {
      id: user.id,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || email,
      email,
      role,
      category,
      hasPin: true,
      validatedAt: new Date().toISOString(),
    },
  })
}
