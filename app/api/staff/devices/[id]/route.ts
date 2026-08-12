import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { revokeOwnTrustedDevice } from "@/lib/security/staff-trusted-device"

export const runtime = "nodejs"

/** Revokes a device — scoped to the caller's own staffUserId, never cross-user. */
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Missing device id." }, { status: 400 })
  }

  const result = await revokeOwnTrustedDevice(userId, id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}
