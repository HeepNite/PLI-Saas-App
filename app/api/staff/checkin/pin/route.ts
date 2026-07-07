import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { extractStaffCategoryFromUserMetadata } from "@/lib/security/staff-category"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { createTeacherClockEntryWithSlugs } from "@/lib/clock/teacher-clock"
import { resolveStaffUserByPin } from "@/lib/security/staff-pin-auth"
import { resolveStaffPinGate } from "@/lib/security/staff-pin-gate"
import {
  clearPinAttemptWindow,
  computeTerminalTargetedCap,
  isAnyPinTargetBlocked,
  recordPinAttemptMiss,
} from "@/lib/security/staff-pin-throttle"
import { enrollTrustedDevice, setTrustedDeviceCookie } from "@/lib/security/staff-trusted-device"
import { listStaffRosterForSchool } from "@/lib/security/staff-roster"
import { asObject } from "@/lib/shared"

export const runtime = "nodejs"

const isTerminalKey = (key: string) => key.startsWith("terminal:")
const isTerminalAggregateKey = (key: string) => key.startsWith("terminal:") && key.endsWith(":targeted")

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:checkin:pin:post", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const pin = typeof payload.pin === "string" ? payload.pin.trim() : ""
  const requestedUserId = typeof payload.userId === "string" ? payload.userId.trim() : ""
  const skipSession = payload.skipSession === true

  // Check-in endpoint is check-in only. Reject if caller did not explicitly
  // signal check-in intent via skipSession=true. Use /api/staff/login/pin for
  // authentication/session creation.
  if (!skipSession) {
    return NextResponse.json(
      {
        error:
          "This endpoint is check-in only. Set skipSession=true to record attendance, or use /api/staff/login/pin for sign-in.",
      },
      { status: 400 }
    )
  }

  // TOTAL gate (design v5): resolve a server-derived trusted context BEFORE
  // any PIN evaluation. No context -> 403 in every gate mode.
  const gate = await resolveStaffPinGate()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }
  const { context } = gate

  let restrictToUserId = ""
  let expectedSchoolId: string
  const throttleKeys: string[] = []
  let terminalAggregateKey: string | null = null
  let terminalAggregateCap = 0
  let isScanAll = false

  if (context.kind === "TERMINAL") {
    expectedSchoolId = context.expectedSchoolId
    if (requestedUserId) {
      restrictToUserId = requestedUserId
      terminalAggregateKey = `terminal:${context.terminalSlug}:targeted`
      // Real roster size (design ADR 15) — replaces the PR2 fixed
      // TERMINAL_TARGETED_BASE_CAP constant with min(20, ceil(0.5*roster)).
      const roster = await listStaffRosterForSchool(expectedSchoolId)
      terminalAggregateCap = computeTerminalTargetedCap(roster.length)
      throttleKeys.push(`user:${restrictToUserId}`, terminalAggregateKey)
    } else {
      // Anonymous scan-all mode: allowed ONLY under a trusted TERMINAL
      // context, throttled per-terminal (not per-victim — there is no
      // single victim yet).
      isScanAll = true
      throttleKeys.push(`terminal:${context.terminalSlug}`)
    }
  } else {
    // PERSONAL / CLERK_SESSION: self-restricted to the owning identity.
    if (requestedUserId && requestedUserId !== context.ownerUserId) {
      return NextResponse.json(
        { error: "You may only check in as yourself from this device." },
        { status: 403 }
      )
    }
    restrictToUserId = context.ownerUserId
    expectedSchoolId = context.expectedSchoolId
    throttleKeys.push(`user:${restrictToUserId}`)
  }

  const throttleStatus = await isAnyPinTargetBlocked(throttleKeys)
  if (throttleStatus.blocked) {
    return NextResponse.json(
      { error: throttleStatus.reason || "Too many failed attempts. Please try again later." },
      {
        status: 423,
        headers: throttleStatus.retryAfterSec ? { "Retry-After": String(throttleStatus.retryAfterSec) } : undefined,
      }
    )
  }

  const resolved = await resolveStaffUserByPin({ pin, restrictToUserId, expectedSchoolId })
  if (!resolved.ok) {
    if (resolved.status === 403 && terminalAggregateKey) {
      await recordPinAttemptMiss({
        targetKey: terminalAggregateKey,
        kind: "terminal",
        effectiveCap: terminalAggregateCap,
      })
    } else if (resolved.status === 401) {
      await Promise.all(
        throttleKeys.map((key) =>
          recordPinAttemptMiss({
            targetKey: key,
            kind: isTerminalKey(key) ? "terminal" : "user",
            effectiveCap: isTerminalAggregateKey(key) ? terminalAggregateCap : undefined,
          })
        )
      )
    }
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  await Promise.all(throttleKeys.map((key) => clearPinAttemptWindow(key)))

  const { user: matchedUser, role: matchedRole } = resolved.staff

  const now = new Date().toISOString()
  const client = await clerkClient()
  const privateMetadata = asObject(matchedUser.privateMetadata)
  const currentCount =
    typeof privateMetadata.staffCheckInCount === "number" && Number.isFinite(privateMetadata.staffCheckInCount)
      ? privateMetadata.staffCheckInCount
      : 0

  await client.users.updateUserMetadata(matchedUser.id, {
    privateMetadata: {
      ...privateMetadata,
      staffLastCheckInAt: now,
      staffCheckInCount: currentCount + 1,
      staffPresenceStatus: "online",
      staffPresenceUpdatedAt: now,
    },
  })

  const category = extractStaffCategoryFromUserMetadata(matchedUser)
  if (category === "teacher") {
    const publicMetadata = asObject(matchedUser.publicMetadata)
    const teaching = asObject(publicMetadata.staffTeaching)
    const courseSlugs = Array.isArray(teaching.courseSlugs)
      ? teaching.courseSlugs.filter((s): s is string => typeof s === "string")
      : []

    createTeacherClockEntryWithSlugs(matchedUser.id, new Date(now), courseSlugs).catch((err) =>
      console.error("Failed to create teacher clock entry", err)
    )
  }

  console.info("staff/checkin/pin matched user", {
    userId: matchedUser.id,
    role: matchedRole,
    category,
    context: context.kind,
    scanAll: isScanAll,
  })

  // Anonymous scan-all success is PII-trimmed to just the id — name/role/
  // category are only returned for a deliberately-targeted requestedUserId
  // (design v5: "Anonymous Scan-All-Users Mode Constrained").
  const staffPayload = isScanAll
    ? { id: matchedUser.id }
    : {
        id: matchedUser.id,
        name:
          `${matchedUser.firstName || ""} ${matchedUser.lastName || ""}`.trim() ||
          matchedUser.primaryEmailAddress?.emailAddress ||
          matchedUser.id,
        role: matchedRole,
        category,
      }

  // Check-in only: return attendance confirmation, never session tokens
  const response = NextResponse.json({
    ok: true,
    checkedInAt: now,
    staff: staffPayload,
  })

  // GRANDFATHER auto-enroll (design v5 ADR 1/13): scoped to the CLERK_SESSION
  // context ONLY — see app/api/staff/login/pin/route.ts for the full
  // rationale (a stray same-user session on a SHARED terminal must never
  // convert it into a single-user trusted device).
  if (context.kind === "CLERK_SESSION") {
    const { token } = await enrollTrustedDevice(matchedUser.id)
    setTrustedDeviceCookie(response, token)
    console.warn("staff/checkin/pin GRANDFATHER auto-enroll", { staffUserId: matchedUser.id })
  }

  return response
}
