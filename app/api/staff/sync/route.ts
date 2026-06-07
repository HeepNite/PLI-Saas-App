import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { syncStaffAccountFromClerkUser } from "@/lib/security/staff-account-sync"

export const runtime = "nodejs"

const STAFF_SCAN_PAGE_SIZE = 100
const STAFF_SCAN_MAX_USERS = 5000

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:sync:post", getClientIp(req)),
    limit: 20,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  if (authResult.role !== "owner") {
    return NextResponse.json({ error: "Only Owner can run staff sync." }, { status: 403 })
  }

  const client = await clerkClient()
  let scanned = 0
  let synced = 0
  for (let offset = 0; offset < STAFF_SCAN_MAX_USERS; offset += STAFF_SCAN_PAGE_SIZE) {
    const page = await client.users.getUserList({
      limit: STAFF_SCAN_PAGE_SIZE,
      offset,
    })
    scanned += page.data.length
    for (const user of page.data) {
      const role = extractStaffRoleFromUserMetadata(user)
      if (!role) continue
      const account = await syncStaffAccountFromClerkUser(user, { source: "staff_sync_backfill" })
      if (account) synced += 1
    }
    if (page.data.length < STAFF_SCAN_PAGE_SIZE) break
  }

  return NextResponse.json({
    ok: true,
    scanned,
    synced,
  })
}
