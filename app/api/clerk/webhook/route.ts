import { NextResponse } from "next/server"
import { verifyWebhook } from "@clerk/nextjs/webhooks"
import { syncDbUserFromClerkUser } from "@/lib/clerk-user-sync"

export const runtime = "nodejs"

export async function POST(req: Request) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>

  try {
    event = await verifyWebhook(req, {
      signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    })
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  try {
    if (event.type !== "user.updated" && event.type !== "user.created") {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const dbUser = await syncDbUserFromClerkUser(event.data)

    return NextResponse.json({
      ok: true,
      synced: Boolean(dbUser),
      userId: dbUser?.id || null,
    })
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
