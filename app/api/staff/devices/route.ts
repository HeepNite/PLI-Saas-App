import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { listOwnTrustedDevices } from "@/lib/security/staff-trusted-device"

export const runtime = "nodejs"

/** Lists ONLY the caller's own trusted devices — never cross-user. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const devices = await listOwnTrustedDevices(userId)

  return NextResponse.json({ devices })
}
