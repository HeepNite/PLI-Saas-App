import { NextRequest, NextResponse } from "next/server"
import { verifyWebhook } from "@clerk/nextjs/webhooks"
import { syncDbUserFromClerkUser } from "@/lib/clerk-user-sync"

export const runtime = "nodejs"

const CLERK_USER_SYNC_EVENTS = new Set(["user.updated", "user.created"])

const getWebhookUserId = (event: Awaited<ReturnType<typeof verifyWebhook>> | undefined) => {
  const data = event?.data as { id?: unknown } | undefined
  return typeof data?.id === "string" ? data.id : null
}

export async function POST(req: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>

  try {
    event = await verifyWebhook(req, {
      signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    })
  } catch (error) {
    console.error("clerk.webhook.signature_verification_failed", { error })
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  try {
    if (!CLERK_USER_SYNC_EVENTS.has(event.type)) {
      console.info("clerk.webhook.event_ignored", { eventType: event.type })
      return NextResponse.json({ ok: true, ignored: true })
    }

    const dbUser = await syncDbUserFromClerkUser(event.data)

    if (!dbUser) {
      console.warn("clerk.webhook.user_sync_skipped", {
        eventType: event.type,
        clerkId: getWebhookUserId(event),
        reason: "sync returned no db user",
      })
    }

    return NextResponse.json({
      ok: true,
      synced: Boolean(dbUser),
      userId: dbUser?.id || null,
    })
  } catch (error) {
    console.error("clerk.webhook.processing_failed", {
      eventType: event.type,
      clerkId: getWebhookUserId(event),
      error,
    })
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
